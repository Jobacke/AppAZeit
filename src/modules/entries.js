import { state } from '../store.js';
import { addEntry, updateEntry, deleteEntryFromDB } from './db.js';
import { showToast, formatDate } from './ui.js';
import { firebase } from '../config.js';

export function initEntries() {
    window.addManualEntry = addManualEntry;
    window.editEntry = editEntry;
    window.saveEdit = saveEdit;
    window.deleteEntry = deleteEntry;
    window.closeEditModal = closeEditModal;
    window.changeEntriesPage = changeEntriesPage;
    window.changeEntriesPageSize = changeEntriesPageSize;
    window.filterChanged = true;
    window.filterEntries = filterEntries;
    window.toggleSortOrder = toggleSortOrder;
}

export function addManualEntry() {
    const datum = document.getElementById('manualDate').value;
    const start = document.getElementById('manualStart').value;
    const ende = document.getElementById('manualEnd').value;
    const projekt = document.getElementById('currentProject').value;
    const activity = document.getElementById('currentActivity').value;

    if (!datum || !start || !ende) {
        alert('Bitte Datum, Start und Ende eingeben!');
        return;
    }

    if (checkCollision(datum, start, ende)) return;

    const entry = {
        datum,
        start,
        ende,
        projekt,
        taetigkeit: activity,
        homeoffice: document.getElementById('manualLocation').value === 'true',
        stunden: calculateHours(start, ende),
        pause: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };


    addEntry(entry);
    showToast('✅ Eintrag hinzugefügt!');

    document.getElementById('manualStart').value = '';
    document.getElementById('manualEnd').value = '';
}

function checkCollision(date, start, end, excludeId = null) {
    if (!state.entries) return false;

    // Convert new times to minutes for easier comparison
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const startMin = h1 * 60 + m1;
    const endMin = h2 * 60 + m2;

    const collision = state.entries.find(e => {
        if (e.id === excludeId) return false; // Ignore self when editing
        if (e.datum !== date) return false;   // Only check same day

        const [eh1, em1] = (e.start || '00:00').split(':').map(Number);
        const [eh2, em2] = (e.ende || '00:00').split(':').map(Number);
        const eStartMin = eh1 * 60 + em1;
        const eEndMin = eh2 * 60 + em2;

        // Overlap logic: (StartA < EndB) and (EndA > StartB)
        return (startMin < eEndMin) && (endMin > eStartMin);
    });

    if (collision) {
        return !confirm(`⚠️ Achtung: Dieser Eintrag überschneidet sich mit:\n"${collision.projekt}" (${collision.start} - ${collision.ende})\n\nTrotzdem speichern?`);
    }
    return false;
}

export function filterEntries() {
    // Logic to filter entries and render list
    const filterDate = document.getElementById('filterDate').value;
    const filterProject = document.getElementById('filterProject').value;

    if (window.filterChanged) {
        state.entriesCurrentPage = 1;
        window.filterChanged = false;
    }

    let filtered = [...state.entries];

    if (filterDate) filtered = filtered.filter(e => e.datum === filterDate);
    if (filterProject) filtered = filtered.filter(e => e.projekt === filterProject);

    filtered.sort((a, b) => {
        if (state.sortOrderDescending) {
            if (a.datum !== b.datum) return b.datum.localeCompare(a.datum);
            return (b.start || '').localeCompare(a.start || '');
        } else {
            if (a.datum !== b.datum) return a.datum.localeCompare(b.datum);
            return (a.start || '').localeCompare(b.start || '');
        }
    });

    const container = document.getElementById('entriesList');
    if (!container) return;

    const pageSize = state.entriesPageSize;
    const currentPage = state.entriesCurrentPage;
    const pageEntries = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const totalPages = Math.ceil(filtered.length / pageSize);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="p-8 text-br-300 text-center">Keine Einträge gefunden</div>';
    } else {
        container.innerHTML = pageEntries.map(e => `
             <div class="bg-br-800 rounded-lg p-3 border border-br-600 flex items-center gap-3">
                <div class="w-1 h-12 rounded" style="background: ${e.projekt === 'Pause' ? '#60A5FA' : (state.projects[e.projekt]?.color || '#6B7280')}"></div>
                <div class="flex-1">
                    <div class="text-sm font-medium">${formatDate(e.datum)}</div>
                    <div class="text-xs text-br-200">${e.start} - ${e.ende} • ${e.projekt || 'Allgemein'}</div>
                    ${e.taetigkeit ? `<div class="text-xs text-br-300">${e.taetigkeit}</div>` : ''}
                </div>
                <div class="text-right">
                    <div class="font-mono">${(e.stunden || 0).toFixed(2)}h</div>
                    <div class="text-xs">${e.homeoffice ? '🏠' : '🏢'}</div>
                </div>
                <button onclick="editEntry('${e.id}')" class="p-2 hover:bg-br-600 rounded">✏️</button>
                <button onclick="deleteEntry('${e.id}')" class="p-2 hover:bg-red-900 rounded">🗑️</button>
            </div>
        `).join('');

    }
    document.getElementById('entriesStats').textContent = `${filtered.length} Einträge`;
}

export function editEntry(id) {
    const entry = state.entries.find(e => e.id === id);
    if (!entry) return;
    state.editingEntryId = id;

    document.getElementById('editDate').value = entry.datum;
    document.getElementById('editStart').value = entry.start;
    document.getElementById('editEnd').value = entry.ende;
    document.getElementById('editProject').value = entry.projekt || ''; // Fix: Set project
    document.getElementById('editActivity').value = entry.taetigkeit || ''; // Fix: Set activity
    document.getElementById('editLocation').value = entry.homeoffice ? 'true' : 'false';

    const editModal = document.getElementById('editModal');
    editModal.classList.remove('hidden');
    editModal.classList.add('flex');
}

export function saveEdit() {
    if (!state.editingEntryId) return;
    const newProject = document.getElementById('editProject').value;
    const isPause = newProject === 'Pause';

    // Calculate duration in minutes for Pause entries if needed, but for now we just handle stunden=0
    // If we want to preserve the "pause" field in minutes when editing a Pause entry, we might need more logic,
    // but the current requirement focuses on stunden=0 for reports.
    // Ideally we re-calculate 'pause' in minutes if it is a Pause project.
    let pauseVal = 0;
    if (isPause) {
        // Calculate minutes
        const [h1, m1] = document.getElementById('editStart').value.split(':').map(Number);
        const [h2, m2] = document.getElementById('editEnd').value.split(':').map(Number);
        const min1 = h1 * 60 + m1;
        const min2 = h2 * 60 + m2;
        pauseVal = Math.max(0, min2 - min1);
    }

    const updated = {
        datum: document.getElementById('editDate').value,
        start: document.getElementById('editStart').value,
        ende: document.getElementById('editEnd').value,
        projekt: newProject,
        taetigkeit: document.getElementById('editActivity').value,
        stunden: calculateHours(document.getElementById('editStart').value, document.getElementById('editEnd').value),
        pause: pauseVal, // Update pause minutes if it is a pause entry
        homeoffice: document.getElementById('editLocation').value === 'true'
    };

    if (checkCollision(updated.datum, updated.start, updated.ende, state.editingEntryId)) return;

    updateEntry(state.editingEntryId, updated);
    closeEditModal();
    showToast('✅ Gespeichert');
}

export function closeEditModal() {
    const editModal = document.getElementById('editModal');
    editModal.classList.add('hidden');
    editModal.classList.remove('flex');
    state.editingEntryId = null;
}

export function deleteEntry(id) {
    if (confirm('Löschen?')) deleteEntryFromDB(id);
}

export function changeEntriesPage(page) {
    state.entriesCurrentPage = page;
    filterEntries();
}

export function changeEntriesPageSize(size) {
    state.entriesPageSize = parseInt(size);
    state.entriesCurrentPage = 1;
    filterEntries();
}

export function toggleSortOrder() {
    state.sortOrderDescending = !state.sortOrderDescending;
    filterEntries();
}

export async function fixPauseDurations() {
    if (!state.currentUser) return;
    if (!confirm('Sollen alle bestehenden "Pause"-Einträge (die aktuell 0h haben) nachträglich berechnet werden?')) return;

    const pauseEntries = state.entries.filter(e => e.projekt === 'Pause' && (!e.stunden || e.stunden === 0));

    if (pauseEntries.length === 0) {
        showToast('ℹ️ Keine Einträge gefunden, die korrigiert werden müssen.');
        return;
    }

    showToast(`⏳ Korrigiere ${pauseEntries.length} Einträge...`);

    // Process in batches of 400 to be safe (limit is 500)
    const chunkSize = 400;
    for (let i = 0; i < pauseEntries.length; i += chunkSize) {
        const chunk = pauseEntries.slice(i, i + chunkSize);
        const batch = db.batch();
        let ops = 0;

        chunk.forEach(e => {
            if (e.start && e.ende) {
                const newHours = calculateHours(e.start, e.ende);
                // Only update if we actually calculated a value > 0
                if (newHours > 0) {
                    const ref = db.collection('users').doc(state.currentUser.uid).collection('entries').doc(e.id);
                    batch.update(ref, { stunden: newHours });
                    ops++;
                }
            }
        });

        if (ops > 0) {
            await batch.commit();
        }
    }

    showToast(`✅ ${pauseEntries.length} Pausen-Einträge aktualisiert.`);
}

// Helpers
function calculateHours(start, ende) {
    if (!start || !ende) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = ende.split(':').map(Number);
    const min1 = h1 * 60 + m1;
    const min2 = h2 * 60 + m2;
    return Math.round((min2 - min1) / 60 * 100) / 100;
}
