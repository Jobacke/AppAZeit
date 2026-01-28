
import { state } from '../store.js';
import { db, firebase } from '../config.js';
import { showToast, formatDate } from './ui.js';

// Global state
let pendingImportFile = null;
let pendingImportInput = null;
let cachedEvents = [];


export function initCalendar() {
    window.addAppointment = addAppointment;
    window.editAppointment = editAppointment;
    window.saveAppointment = saveAppointment;
    window.deleteAppointment = deleteAppointment;
    window.closeEditAppointmentModal = closeEditAppointmentModal;
    window.renderCalendar = renderCalendar;
    window.handleIcsUpload = handleIcsUpload;


    // Modal buttons
    window.executeReset = executeReset;
    window.cancelReset = cancelReset;
}



export function renderCalendar() {
    const container = document.getElementById('calendar-events-list');
    if (!container) return;

    container.innerHTML = '<div class="text-center p-4"><div class="spinner"></div></div>';

    Promise.all([
        db.collection('app_events').get()
    ]).then(([appSnap]) => {
        let events = [];

        appSnap.forEach(doc => {
            events.push({ id: doc.id, ...doc.data(), type: 'app' });
        });

        // Filter valid dates and Sort
        cachedEvents = events.filter(e => e.start).sort((a, b) => new Date(a.start) - new Date(b.start));
        renderEventsList(cachedEvents);

    }).catch(err => {
        console.error("Error loading calendar:", err);
        container.innerHTML = `<div class="text-red-400 p-4">Fehler beim Laden: ${err.message}</div>`;
    });
}

function renderEventsList(events) {
    const container = document.getElementById('calendar-events-list');
    if (!container) return;

    if (events.length === 0) {
        container.innerHTML = '<div class="text-br-400 text-center py-8">Keine Termine vorhanden</div>';
        return;
    }

    // Group by Date
    const groups = {};
    events.forEach(evt => {
        const dateKey = evt.start.split('T')[0];
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(evt);
    });

    let html = '';
    const sortedDates = Object.keys(groups).sort();

    // Helper helper
    const getWeekday = (d) => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(d).getDay()];

    sortedDates.forEach(date => {
        const list = groups[date];
        const dateObj = new Date(date);
        const dateStr = `${getWeekday(date)} ${dateObj.getDate()}.${dateObj.getMonth() + 1}.`;

        html += `<div class="mb-4">
            <h3 class="text-br-200 text-sm font-bold mb-2 sticky top-0 bg-br-900/90 backdrop-blur py-1 px-2 rounded -mx-2">${dateStr}</h3>
            <div class="space-y-2">`;

        list.forEach(evt => {
            const timeStr = evt.allDay ? 'Ganztägig' : (evt.start.split('T')[1]?.substring(0, 5) || '??:??');
            const isApp = evt.type === 'app';
            const bgColor = isApp ? 'bg-br-700' : 'bg-br-800 opacity-75';
            const border = isApp ? 'border-l-4 border-accent-500' : 'border-l-4 border-br-500';

            html += `
                <div class="${bgColor} p-3 rounded-lg ${border} flex justify-between items-center group cursor-pointer" 
                    onclick="editAppointment('${evt.id}', '${evt.type}')">
                    <div class="flex-1 min-w-0 pr-2">
                        <div class="font-medium text-white truncate">${evt.subject || '(Kein Betreff)'}</div>
                        <div class="text-xs text-br-300 flex items-center gap-2">
                            <span>🕒 ${timeStr}</span>
                            <span>📍 ${evt.location || '-'}</span>
                            ${evt.source === 'imported' ? '<span class="text-xs bg-br-600 px-1 rounded">Import</span>' : ''}
                        </div>
                    </div>
                    ${isApp ? '<span class="text-br-400 group-hover:text-white">✏️</span>' : ''}
                </div>
            `;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
}

// --- CRUD ---

function addAppointment() {
    const modal = document.getElementById('editAppointmentModal');
    if (!modal) return;

    document.getElementById('modalTitleAppt').innerText = '✨ Neuer Termin';
    document.getElementById('apptId').value = '';
    document.getElementById('apptSubject').value = '';
    document.getElementById('apptLocation').value = '';

    // Default: Next full hour
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const end = new Date(now);
    end.setHours(end.getHours() + 1);

    // ISO String helpers (local time trickery)
    const toLocalISO = (d) => {
        const pad = n => n < 10 ? '0' + n : n;
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    document.getElementById('apptStart').value = toLocalISO(now);
    document.getElementById('apptEnd').value = toLocalISO(end);
    document.getElementById('apptAllDay').checked = false;
    document.getElementById('apptDescription').value = '';

    document.getElementById('btnDeleteAppt').classList.add('hidden');
    modal.classList.remove('hidden');
}

async function editAppointment(id, type) {
    if (type !== 'app') {
        showToast('Exchange-Termine können hier nicht bearbeitet werden.', 'info');
        return;
    }

    const doc = await db.collection('app_events').doc(id).get();
    if (!doc.exists) return;
    const data = doc.data();

    const modal = document.getElementById('editAppointmentModal');
    if (!modal) return;

    document.getElementById('modalTitleAppt').innerText = '✏️ Termin bearbeiten';
    document.getElementById('apptId').value = id;
    document.getElementById('apptSubject').value = data.subject || '';
    document.getElementById('apptLocation').value = data.location || '';
    document.getElementById('apptStart').value = data.start || '';
    document.getElementById('apptEnd').value = data.end || '';
    document.getElementById('apptAllDay').checked = data.allDay || false;
    const cleanDesc = (data.description || '').trim();
    document.getElementById('apptDescription').value = cleanDesc === '{' ? '' : cleanDesc;

    document.getElementById('btnDeleteAppt').classList.remove('hidden');
    document.getElementById('btnDeleteAppt').onclick = () => deleteAppointment(id);

    modal.classList.remove('hidden');
}

function closeEditAppointmentModal() {
    document.getElementById('editAppointmentModal').classList.add('hidden');
}

async function saveAppointment() {
    const id = document.getElementById('apptId').value;
    const subject = document.getElementById('apptSubject').value;
    const location = document.getElementById('apptLocation').value;
    const start = document.getElementById('apptStart').value;
    const end = document.getElementById('apptEnd').value;
    const allDay = document.getElementById('apptAllDay').checked;
    const description = document.getElementById('apptDescription').value;

    if (!subject || !start) {
        showToast('Betreff und Startzeit sind Pflichtfelder.', 'error');
        return;
    }

    const data = {
        subject, location, start, end, allDay, description,
        updatedAt: new Date()
    };

    try {
        if (id) {
            await db.collection('app_events').doc(id).update(data);
            showToast('Termin aktualisiert');
        } else {
            data.createdAt = new Date();
            data.source = 'manual';
            await db.collection('app_events').add(data);
            showToast('Termin erstellt');
        }
        closeEditAppointmentModal();
        renderCalendar();
    } catch (e) {
        console.error(e);
        showToast('Fehler beim Speichern', 'error');
    }
}

async function deleteAppointment(id) {
    if (!confirm('Termin wirklich löschen?')) return;
    try {
        await db.collection('app_events').doc(id).delete();
        showToast('Termin gelöscht');
        closeEditAppointmentModal();
        renderCalendar();
    } catch (e) {
        console.error(e);
        showToast('Fehler beim Löschen', 'error');
    }
}


// --- IMPORT / RESET LOGIC (New Modal) ---

async function handleIcsUpload(input) {
    console.log("DEBUG: handleIcsUpload called with", input);

    if (!input.files || !input.files[0]) {
        console.log("No file selected.");
        return;
    }

    // Store references
    pendingImportInput = input;
    pendingImportFile = input.files[0];

    // Show Custom Modal (NO native confirm)
    const modal = document.getElementById('resetConfirmModal');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        // Fallback if modal missing in DOM
        if (confirm('⚠️ ACHTUNG: DOM Element #resetConfirmModal fehlt. Dies löscht trotzdem ALLE Termine. Fortfahren?')) {
            executeReset();
        }
    }
}

async function executeReset() {
    // Hide modal
    const modal = document.getElementById('resetConfirmModal');
    if (modal) modal.classList.add('hidden');

    if (!pendingImportFile) return;

    const file = pendingImportFile;
    console.log("Starting reset with file:", file.name);

    try {
        const text = await file.text();
        const eventsRaw = parseICS(text);

        // Filter: Only future events (from yesterday onwards)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayIso = yesterday.toISOString().split('T')[0];

        const events = eventsRaw.filter(e => {
            if (!e.start) return false;
            const eventDate = e.start.split('T')[0];
            return eventDate >= yesterdayIso;
        });

        if (events.length === 0) {
            alert(`Keine zukünftigen Termine in der Datei gefunden. Reset abgebrochen.`);
            if (pendingImportInput) pendingImportInput.value = '';
            return;
        }

        const collectionRef = db.collection('app_events');

        console.log("Cleaning up ALL old data (Full Reset)...");

        // A) Delete ALL 'app_events'
        const appEventsSnapshot = await collectionRef.get();
        await deleteInBatches(db, appEventsSnapshot.docs);

        // B) Delete ALL 'exchange_events'
        const exchangeSnapshot = await db.collection('exchange_events').get();
        await deleteInBatches(db, exchangeSnapshot.docs);

        // --- IMPORT NEW ---
        console.log("Starting upload of new events...");
        const CHUNK_SIZE = 400;
        const chunks = [];
        for (let i = 0; i < events.length; i += CHUNK_SIZE) chunks.push(events.slice(i, i + CHUNK_SIZE));

        let totalUploaded = 0;
        for (const chunk of chunks) {
            const batch = db.batch();
            chunk.forEach(evt => {
                const docRef = collectionRef.doc();
                batch.set(docRef, {
                    ...evt,
                    source: 'imported',
                    createdAt: new Date()
                });
            });
            await batch.commit();
            totalUploaded += chunk.length;
        }

        console.log("All done.");
        alert(`✅ Reset erfolgreich! ${totalUploaded} Termine importiert.`);
        renderCalendar();

    } catch (e) {
        console.error("Import Error:", e);
        alert('Fehler: ' + e.message);
    } finally {
        if (pendingImportInput) pendingImportInput.value = '';
        pendingImportFile = null;
        pendingImportInput = null;
    }
}

function cancelReset() {
    const modal = document.getElementById('resetConfirmModal');
    if (modal) modal.classList.add('hidden');
    if (pendingImportInput) pendingImportInput.value = '';
    pendingImportFile = null;
    pendingImportInput = null;
}

// --- HELPER ---

function parseICS(icsData) {
    const events = [];
    const lines = icsData.split(/\r\n|\n|\r/);
    let currentEvent = null;

    lines.forEach(line => {
        if (line.startsWith('BEGIN:VEVENT')) {
            currentEvent = {};
        } else if (line.startsWith('END:VEVENT')) {
            if (currentEvent) events.push(currentEvent);
            currentEvent = null;
        } else if (currentEvent) {
            const parts = line.split(':');
            let key = parts[0];
            let value = parts.slice(1).join(':');

            // Handle properties with params (e.g. DTSTART;VALUE=DATE:...)
            if (key.includes(';')) key = key.split(';')[0];

            if (key === 'SUMMARY') currentEvent.subject = value;
            if (key === 'LOCATION') currentEvent.location = value;
            if (key === 'DESCRIPTION') currentEvent.description = value;
            if (key === 'DTSTART') {
                currentEvent.start = formatICSDate(value);
                if (value.length === 8) currentEvent.allDay = true;
            }
            if (key === 'DTEND') currentEvent.end = formatICSDate(value);
        }
    });
    return events;
}

function formatICSDate(icsDate) {
    if (!icsDate) return '';
    if (icsDate.length === 8) { // YYYYMMDD
        return `${icsDate.substring(0, 4)}-${icsDate.substring(4, 6)}-${icsDate.substring(6, 8)}T00:00:00`;
    }
    // YYYYMMDDTHHMMSSZ or similar
    // Simple parse, ignoring timezone complex logic for now (assuming local or Z)
    const year = icsDate.substring(0, 4);
    const month = icsDate.substring(4, 6);
    const day = icsDate.substring(6, 8);
    const time = icsDate.includes('T') ? icsDate.split('T')[1].substring(0, 6) : '000000';
    return `${year}-${month}-${day}T${time.substring(0, 2)}:${time.substring(2, 4)}:${time.substring(4, 6)}`;
}

async function deleteInBatches(db, docs) {
    const CHUNK_SIZE = 400;
    const chunks = [];
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) chunks.push(docs.slice(i, i + CHUNK_SIZE));
    for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
}
