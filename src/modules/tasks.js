import { state } from '../store.js';
import { db, firebase } from '../config.js';
import { showToast, setSyncStatus, formatDate } from './ui.js';

export function initTasks() {
    window.addTask = addTask;
    window.toggleTaskStatus = toggleTaskStatus;
    window.editTask = editTask;
    window.saveTaskEdit = saveTaskEdit;
    window.closeEditTaskModal = closeEditTaskModal;
    window.renderTasks = renderTasks;
}

export function renderTasks() {
    const tasks = state.tasks || [];
    const hideCompleted = document.getElementById('hideCompleted')?.checked;
    const filterPriority = document.getElementById('filterTaskPriority')?.value;
    const filterStatus = document.getElementById('filterTaskStatus')?.value;

    const today = new Date().toISOString().split('T')[0];

    // Filter
    let filtered = tasks.filter(t => {
        if (hideCompleted && t.status === 'erledigt') return false;
        if (filterPriority && t.prioritaet !== filterPriority) return false;
        if (filterStatus && (t.status || 'offen') !== filterStatus) return false;
        return true;
    });

    // Buckets
    const overdue = [];
    const todayTasks = [];
    const upcoming = [];
    const completed = [];

    filtered.forEach(t => {
        if (t.status === 'erledigt') {
            completed.push(t);
            return;
        }

        if (!t.faelligAm) {
            upcoming.push(t); // No due date = upcoming/general
            return;
        }

        if (t.faelligAm < today) overdue.push(t);
        else if (t.faelligAm === today) todayTasks.push(t);
        else upcoming.push(t);
    });

    // Render Lists
    renderTaskList('overdueTasksList', overdue, 'overdueTasks', 'overdueCount');
    renderTaskList('todayTasksList', todayTasks, 'todayTasks', 'todayTasksCount');
    renderTaskList('upcomingTasksList', upcoming, null, 'upcomingCount');
    renderTaskList('completedTasksList', completed, 'completedTasksSection', 'completedCount');

    // Show/Hide Messages
    const totalActive = overdue.length + todayTasks.length + upcoming.length;
    const noTasksMsg = document.getElementById('noTasksMessage');
    if (noTasksMsg) {
        if (totalActive === 0 && filtered.length === 0) noTasksMsg.classList.remove('hidden');
        else noTasksMsg.classList.add('hidden');
    }
}

function renderTaskList(containerId, tasks, sectionId, countId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Update Section Visibility
    if (sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            if (tasks.length > 0) section.classList.remove('hidden');
            else section.classList.add('hidden');
        }
    }

    // Update Count
    if (countId) {
        const countEl = document.getElementById(countId);
        if (countEl) countEl.textContent = tasks.length;
    }

    // Helper for priority color
    const getPrioColor = (p) => {
        if (p === 'hoch') return 'text-red-400';
        if (p === 'mittel') return 'text-yellow-400';
        return 'text-green-400'; // niedrig
    };

    container.innerHTML = tasks.map(t => `
        <div class="p-3 flex items-start gap-3 hover:bg-br-700/30 transition-colors">
             <input type="checkbox" ${t.status === 'erledigt' ? 'checked' : ''} 
                onclick="toggleTaskStatus('${t.id}')" 
                class="mt-1 w-4 h-4 rounded border-gray-500 bg-gray-700 checked:bg-blue-500">
             <div class="flex-1 cursor-pointer" onclick="editTask('${t.id}')">
                <div class="flex justify-between items-start">
                    <span class="${t.status === 'erledigt' ? 'line-through text-br-400' : 'text-white'}">
                        ${t.aufgabe}
                    </span>
                    ${t.prioritaet ? `<span class="text-[10px] ${getPrioColor(t.prioritaet)} border border-current px-1 rounded ml-2 uppercase">${t.prioritaet}</span>` : ''}
                </div>
                <div class="flex gap-3 mt-1 text-xs text-br-300">
                    <span>📅 ${t.faelligAm ? formatDate(t.faelligAm) : 'Kein Datum'}</span>
                    ${t.notizen ? '<span title="Notizen vorhanden">📝</span>' : ''}
                </div>
             </div>
        </div>
    `).join('');
}

export async function addTask() {
    const title = document.getElementById('newTaskTitle').value.trim();
    if (!title) {
        alert('Bitte eine Aufgabe eingeben');
        return;
    }

    const task = {
        aufgabe: title,
        faelligAm: document.getElementById('newTaskDue').value,
        prioritaet: document.getElementById('newTaskPriority').value,
        notizen: document.getElementById('newTaskNotes').value,
        status: 'offen',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('users').doc(state.currentUser.uid).collection('tasks').add(task);
        showToast('✅ Aufgabe hinzugefügt');

        // Reset inputs
        document.getElementById('newTaskTitle').value = '';
        document.getElementById('newTaskNotes').value = '';
        // Keep date/priority for convenience or reset? Let's reset date.
        document.getElementById('newTaskDue').value = '';
    } catch (e) {
        console.error(e);
        showToast('❌ Fehler beim Speichern');
    }
}

export async function toggleTaskStatus(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    const newStatus = task.status === 'erledigt' ? 'offen' : 'erledigt';

    // Optimistic UI update handled by re-rendering on snapshot, 
    // but for immediate feedback we relies on the snapshot listener which is fast.
    // Or we can manually update state if offline.

    await db.collection('users').doc(state.currentUser.uid).collection('tasks').doc(id).update({
        status: newStatus
    });
}

// Edit Logic
export function editTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    state.editingTaskId = id;

    // Populate Modal
    document.getElementById('editTaskTitle').value = task.aufgabe;
    document.getElementById('editTaskDue').value = task.faelligAm || '';
    document.getElementById('editTaskPriority').value = task.prioritaet || 'mittel';
    document.getElementById('editTaskStatus').value = task.status || 'offen';
    document.getElementById('editTaskNotes').value = task.notizen || '';

    // Show Modal
    document.getElementById('editTaskModal').style.display = 'flex';
}

export async function saveTaskEdit() {
    if (!state.editingTaskId) return;

    const updates = {
        aufgabe: document.getElementById('editTaskTitle').value,
        faelligAm: document.getElementById('editTaskDue').value,
        prioritaet: document.getElementById('editTaskPriority').value,
        status: document.getElementById('editTaskStatus').value,
        notizen: document.getElementById('editTaskNotes').value
    };

    try {
        await db.collection('users').doc(state.currentUser.uid).collection('tasks').doc(state.editingTaskId).update(updates);
        showToast('✅ Gespeichert');
        closeEditTaskModal();
    } catch (e) {
        showToast('❌ Fehler');
    }
}

export async function deleteTask() {
    if (!state.editingTaskId || !confirm('Aufgabe wirklich löschen?')) return;

    try {
        await db.collection('users').doc(state.currentUser.uid).collection('tasks').doc(state.editingTaskId).delete();
        showToast('🗑️ Gelöscht');
        closeEditTaskModal();
    } catch (e) {
        showToast('❌ Fehler');
    }
}

export function closeEditTaskModal() {
    state.editingTaskId = null;
    document.getElementById('editTaskModal').style.display = 'none';
}

export function showTasksDashboardOnStart() {
    // Check if we have urgent tasks
    const tasks = state.tasks || [];
    const today = new Date().toISOString().split('T')[0];

    const overdue = tasks.filter(t => t.status !== 'erledigt' && t.faelligAm && t.faelligAm < today);
    const todayTasks = tasks.filter(t => t.status !== 'erledigt' && t.faelligAm === today);

    if (overdue.length > 0 || todayTasks.length > 0) {
        // Render dashboard lists
        const renderSimple = (list, containerId) => {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = list.map(t => `
                <div class="bg-br-700/50 p-2 rounded flex justify-between items-center">
                    <span class="${t.faelligAm < today ? 'text-red-300 font-bold' : ''}">${t.aufgabe}</span>
                    <button onclick="closeTasksDashboard(); editTask('${t.id}')" class="text-xs bg-br-600 px-2 py-1 rounded">✏️</button>
                </div>
            `).join('');
        };

        if (overdue.length > 0) {
            document.getElementById('dashOverdue')?.classList.remove('hidden');
            renderSimple(overdue, 'dashOverdueList');
        } else {
            document.getElementById('dashOverdue')?.classList.add('hidden');
        }

        if (todayTasks.length > 0) {
            document.getElementById('dashToday')?.classList.remove('hidden');
            renderSimple(todayTasks, 'dashTodayList');
        } else {
            document.getElementById('dashToday')?.classList.add('hidden');
        }

        document.getElementById('dashNoUrgent')?.classList.add('hidden');

        // Show Modal
        state.tasksDashboardShown = true;
        const modal = document.getElementById('tasksDashboardModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');

            // Optional: Add Sound for "Alarm"
            // const audio = new Audio('path/to/alert.mp3'); audio.play().catch(e=>{});
        }
    }
}

// Global expose
window.closeTasksDashboard = function () {
    document.getElementById('tasksDashboardModal').classList.add('hidden');
    document.getElementById('tasksDashboardModal').classList.remove('flex');
};
window.deleteTask = deleteTask;

