import { state } from '../store.js';
import { addEntry, updateEntry, deleteEntryFromDB } from './db.js';
import { showToast, formatDate } from './ui.js';
import { firebase } from '../config.js';

// ... imports remain the same ...

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

const VACATION_PROJECT = 'Urlaub';
const VACATION_HOURS = 7.8;

function isVacationProject(p) {
    return p && p.toLowerCase() === 'urlaub';
}

export function addManualEntry() {
    const datum = document.getElementById('manualDate').value;
    const projectInput = document.getElementById('currentProject').value;
    const isVacation = isVacationProject(projectInput);

    // Initial basic validation
    if (!datum) {
        alert('Bitte Datum eingeben!');
        return;
    }

    if (!isVacation) {
        const start = document.getElementById('manualStart').value;
        const ende = document.getElementById('manualEnd').value;
        if (!start || !ende) {
            alert('Bitte Start und Ende eingeben!');
            return;
        }
        if (checkCollision(datum, start, ende)) return;
    }

    // Check Vacation Constraints
    const existingEntriesOnDate = state.entries.filter(e => e.datum === datum);

    if (isVacation) {
        if (existingEntriesOnDate.length > 0) {
            alert('Urlaub kann nur für einen leeren Tag eingetragen werden! Bitte lösche zuerst die anderen Einträge.');
            return;
        }
    } else {
        // Normal entry, but check if there is a vacation entry
        const hasVacation = existingEntriesOnDate.some(e => isVacationProject(e.projekt));
        if (hasVacation) {
            alert('An diesem Tag ist bereits Urlaub eingetragen. Keine weiteren Einträge möglich.');
            return;
        }
    }

    const activity = document.getElementById('currentActivity').value;

    const entry = {
        datum,
        start: isVacation ? '00:00' : document.getElementById('manualStart').value,
        ende: isVacation ? '00:00' : document.getElementById('manualEnd').value,
        projekt: projectInput,
        taetigkeit: isVacation ? (activity || 'Urlaub') : activity,
        homeoffice: document.getElementById('manualLocation').value === 'true',
        stunden: isVacation ? VACATION_HOURS : calculateHours(document.getElementById('manualStart').value, document.getElementById('manualEnd').value),
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
        if (e.id === excludeId) return false;
        if (e.datum !== date) return false;

        // Skip collision check against vacation entries here (handled separately)
        if (isVacationProject(e.projekt)) return false;

        const [eh1, em1] = (e.start || '00:00').split(':').map(Number);
        const [eh2, em2] = (e.ende || '00:00').split(':').map(Number);
        const eStartMin = eh1 * 60 + em1;
        const eEndMin = eh2 * 60 + em2;

        return (startMin < eEndMin) && (endMin > eStartMin);
    });

    if (collision) {
        return !confirm(`⚠️ Achtung: Dieser Eintrag überschneidet sich mit:\n"${collision.projekt}" (${collision.start} - ${collision.ende})\n\nTrotzdem speichern?`);
    }
    return false;
}

export function filterEntries() {
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

    if (filtered.length === 0) {
        container.innerHTML = '<div class="p-8 text-br-300 text-center">Keine Einträge gefunden</div>';
    } else {
        container.innerHTML = pageEntries.map(e => {
            const isVacation = isVacationProject(e.projekt);
            const timeDisplay = isVacation ? 'Ganztägig' : `${e.start} - ${e.ende}`;

            return `
             <div class="bg-br-800 rounded-lg p-3 border border-br-600 flex items-center gap-3">
                <div class="w-1 h-12 rounded" style="background: ${e.projekt === 'Pause' ? '#60A5FA' : (state.projects[e.projekt]?.color || '#6B7280')}"></div>
                <div class="flex-1">
                    <div class="text-sm font-medium">${formatDate(e.datum)}</div>
                    <div class="text-xs text-br-200">${timeDisplay} • ${e.projekt || 'Allgemein'}</div>
                    ${e.taetigkeit ? `<div class="text-xs text-br-300">${e.taetigkeit}</div>` : ''}
                </div>
                <div class="text-right">
                    <div class="font-mono">${(e.stunden || 0).toFixed(2)}h</div>
                    <div class="text-xs">${e.homeoffice ? '🏠' : '🏢'}</div>
                </div>
                <button onclick="editEntry('${e.id}')" class="p-2 hover:bg-br-600 rounded">✏️</button>
                <button onclick="deleteEntry('${e.id}')" class="p-2 hover:bg-red-900 rounded">🗑️</button>
            </div>
        `}).join('');
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
    document.getElementById('editProject').value = entry.projekt || '';
    document.getElementById('editActivity').value = entry.taetigkeit || '';
    document.getElementById('editLocation').value = entry.homeoffice ? 'true' : 'false';

    // Toggle inputs based on initial project
    const event = new Event('change');
    document.getElementById('editProject').dispatchEvent(event);

    const editModal = document.getElementById('editModal');
    editModal.classList.remove('hidden');
    editModal.classList.add('flex');
}

export function saveEdit() {
    if (!state.editingEntryId) return;
    const newProject = document.getElementById('editProject').value;
    const isPause = newProject === 'Pause';
    const isVacation = isVacationProject(newProject);
    const datum = document.getElementById('editDate').value;

    // Constraint Checking
    const existingEntriesOnDate = state.entries.filter(e => e.datum === datum && e.id !== state.editingEntryId);

    if (isVacation) {
        if (existingEntriesOnDate.length > 0) {
            alert('Urlaub kann nur für einen leeren Tag eingetragen werden! Bitte lösche zuerst die anderen Einträge.');
            return;
        }
    } else {
        const hasVacation = existingEntriesOnDate.some(e => isVacationProject(e.projekt));
        if (hasVacation) {
            alert('An diesem Tag ist bereits Urlaub eingetragen. Keine weiteren Einträge möglich.');
            return;
        }
    }

    let pauseVal = 0;
    if (isPause) {
        const [h1, m1] = document.getElementById('editStart').value.split(':').map(Number);
        const [h2, m2] = document.getElementById('editEnd').value.split(':').map(Number);
        const min1 = h1 * 60 + m1;
        const min2 = h2 * 60 + m2;
        pauseVal = Math.max(0, min2 - min1);
    }

    let updated;
    if (isVacation) {
        updated = {
            datum,
            start: '00:00',
            ende: '00:00',
            projekt: newProject,
            taetigkeit: document.getElementById('editActivity').value || 'Urlaub',
            stunden: VACATION_HOURS,
            pause: 0,
            homeoffice: document.getElementById('editLocation').value === 'true'
        };
    } else {
        const start = document.getElementById('editStart').value;
        const end = document.getElementById('editEnd').value;
        if (!start || !end) {
            alert('Bitte Start und Ende eingeben!');
            return;
        }

        updated = {
            datum,
            start,
            ende: end,
            projekt: newProject,
            taetigkeit: document.getElementById('editActivity').value,
            stunden: calculateHours(start, end),
            pause: pauseVal,
            homeoffice: document.getElementById('editLocation').value === 'true'
        };

        if (checkCollision(updated.datum, updated.start, updated.ende, state.editingEntryId)) return;
    }

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

function calculateHours(start, ende) {
    if (!start || !ende) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = ende.split(':').map(Number);
    const min1 = h1 * 60 + m1;
    const min2 = h2 * 60 + m2;
    return Math.round((min2 - min1) / 60 * 100) / 100;
}
