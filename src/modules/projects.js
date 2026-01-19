import { state } from '../store.js';
import { db } from '../config.js';
import { showToast } from './ui.js';

export function initProjects() {
    window.addProject = addProject;
    window.editProject = editProject;
    window.deleteProject = deleteProject;
    window.renderProjects = renderProjects;
}

export function initializeProjects() {
    // Initial content if empty
}

export function updateProjectSelects() {
    const projects = state.projects;
    const currentSelect = document.getElementById('currentProject');
    const filterSelect = document.getElementById('filterProject');
    const editSelect = document.getElementById('editProject');

    if (!currentSelect) return;

    const options = Object.keys(projects).sort().map(p => `<option value="${p}">${p}</option>`).join('');
    // Add a static "Pause" option that is not stored in Firestore
    const pauseOption = `<option value="Pause">Pause</option>`;

    currentSelect.innerHTML = '<option value="">-- Kein Projekt --</option>' + pauseOption + options;
    filterSelect.innerHTML = '<option value="">Alle Projekte</option>' + pauseOption + options;
    if (editSelect) editSelect.innerHTML = '<option value="">-- Kein Projekt --</option>' + pauseOption + options;
}

export function renderProjects() {
    const container = document.getElementById('projectsList');
    if (!container) return;

    const keys = Object.keys(state.projects).sort();
    container.innerHTML = keys.map(p => `
        <div class="bg-br-800 rounded-lg p-4 border border-br-600 flex items-center gap-3">
            <div class="w-4 h-4 rounded" style="background: ${state.projects[p].color}"></div>
            <div class="flex-1">
                <div class="font-medium">${p}</div>
            </div>
            <button onclick="editProject('${p}')" class="p-2 hover:bg-br-600 rounded">✏️</button>
            <button onclick="deleteProject('${p}')" class="p-2 hover:bg-red-900 rounded">🗑️</button>
        </div>
    `).join('');
}

export async function addProject() {
    const name = document.getElementById('newProjectName').value.trim();
    const color = document.getElementById('newProjectColor').value;

    if (!name) return;

    await db.collection('users').doc(state.currentUser.uid).collection('projects').doc(name).set({
        name: name,
        color: color,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    document.getElementById('newProjectName').value = '';
    showToast('✅ Projekt erstellt');
}

export async function editProject(name) {
    const project = state.projects[name];
    if (!project) return;

    const newName = prompt("Neuer Projektname:", name);
    if (newName && newName !== name) {
        // Create new, delete old (Firestore doc ID is the name)
        await db.collection('users').doc(state.currentUser.uid).collection('projects').doc(newName).set({
            name: newName,
            color: project.color,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection('users').doc(state.currentUser.uid).collection('projects').doc(name).delete();
        showToast('✅ Projekt umbenannt');
    }
}

export async function deleteProject(name) {
    if (confirm(`Projekt "${name}" wirklich löschen?`)) {
        await db.collection('users').doc(state.currentUser.uid).collection('projects').doc(name).delete();
        showToast('🗑️ Projekt gelöscht');
    }
}
