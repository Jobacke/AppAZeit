import { state } from '../store.js';
import { db, firebase } from '../config.js';
import { showToast, setSyncStatus } from './ui.js';

export function initTasks() {
    window.addTask = addTask;
    window.toggleTaskStatus = toggleTaskStatus;
    window.editTask = editTask;
    window.saveTaskEdit = saveTaskEdit;
    window.closeEditTaskModal = closeEditTaskModal;
    window.renderTasks = renderTasks;
}

export function renderTasks() {
    // Basic rendering stub
    const container = document.getElementById('tasksList');
    if (!container) return;

    container.innerHTML = state.tasks.map(t => `
        <div class="bg-br-800 p-3 rounded border border-br-600 flex items-start gap-3">
             <input type="checkbox" ${t.status === 'erledigt' ? 'checked' : ''} onclick="toggleTaskStatus('${t.id}')" class="mt-1">
             <div class="flex-1">
                <div class="${t.status === 'erledigt' ? 'line-through text-br-400' : ''}">${t.aufgabe}</div>
                <div class="text-xs text-br-300">Fällig: ${t.faelligAm || 'Nie'}</div>
             </div>
             <button onclick="editTask('${t.id}')">✏️</button>
        </div>
    `).join('');
}

export async function addTask() {
    const title = document.getElementById('newTaskTitle').value.trim();
    if (!title) return;

    await db.collection('users').doc(state.currentUser.uid).collection('tasks').add({
        aufgabe: title,
        status: 'offen',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    document.getElementById('newTaskTitle').value = '';
    showToast('✅ Aufgabe hinzugefügt');
}

export async function toggleTaskStatus(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    const newStatus = task.status === 'erledigt' ? 'offen' : 'erledigt';

    // Optimistic update
    task.status = newStatus;
    renderTasks();

    await db.collection('users').doc(state.currentUser.uid).collection('tasks').doc(id).update({
        status: newStatus
    });
}

export function editTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    state.editingTaskId = id;
    const newTitle = prompt("Aufgabe bearbeiten:", task.aufgabe);
    if (newTitle && newTitle !== task.aufgabe) {
        saveTaskEdit(id, newTitle);
    }
}

export async function saveTaskEdit(id, newTitle) {
    await db.collection('users').doc(state.currentUser.uid).collection('tasks').doc(id).update({
        aufgabe: newTitle
    });
    showToast('✅ Aufgabe aktualisiert');
}

export function closeEditTaskModal() {
    state.editingTaskId = null;
    // If we had a modal, we would hide it here. 
    // Currently using prompt() for simplicity to ensure functionality first.
}

export function showTasksDashboardOnStart() {
    // Stub
}
