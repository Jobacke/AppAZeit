import { state } from '../store.js';
import { db, firebase } from '../config.js';
import { showToast } from './ui.js';

export function initProjects() {
    window.addProject = addProject;
    window.editProject = editProject;
    window.deleteProject = deleteProject;
    window.renderProjects = renderProjects;
    window.closeEditProjectModal = closeEditProjectModal;
    window.saveProjectEdit = saveProjectEdit;
}

export function initializeProjects() {
    // Initial content if empty
}

export function updateProjectSelects() {
    const projects = state.projects;
    const currentSelect = document.getElementById('currentProject');
    const filterSelect = document.getElementById('filterProject');
    const dashFilterSelect = document.getElementById('dashProjectFilter');
    const editSelect = document.getElementById('editProject');

    if (!currentSelect) return;

    const allProjectNames = [...Object.keys(projects), 'Pause'];
    allProjectNames.sort();

    const options = allProjectNames.map(p => `<option value="${p}">${p}</option>`).join('');

    currentSelect.innerHTML = '<option value="">-- Kein Projekt --</option>' + options;
    filterSelect.innerHTML = '<option value="">Alle Projekte</option>' + options;
    if (dashFilterSelect) {
        // Preserve selection if possible
        const currentVal = dashFilterSelect.value;
        dashFilterSelect.innerHTML = '<option value="">Alle Projekte</option>' + options;
        dashFilterSelect.value = currentVal;
    }
    if (editSelect) editSelect.innerHTML = '<option value="">-- Kein Projekt --</option>' + options;
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

export function editProject(name) {
    const project = state.projects[name];
    if (!project) return;

    state.editingProjectName = name; // Store original name

    document.getElementById('editProjectNameInput').value = name;
    document.getElementById('editProjectColorInput').value = project.color;

    const modal = document.getElementById('editProjectModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

export function closeEditProjectModal() {
    const modal = document.getElementById('editProjectModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    state.editingProjectName = null;
}

export async function saveProjectEdit() {
    const originalName = state.editingProjectName;
    if (!originalName) return;

    const newName = document.getElementById('editProjectNameInput').value.trim();
    const newColor = document.getElementById('editProjectColorInput').value;

    if (!newName) {
        alert("Projektname darf nicht leer sein!");
        return;
    }

    if (newName.includes('/') || newName.includes('\\')) {
        alert("Projektname darf keine Schrägstriche ('/' oder '\\') enthalten.\nBitte verwenden Sie Bindestriche oder Unterstriche.");
        return;
    }

    try {
        if (!db || !firebase) throw new Error('Database connection invalid');

        const batch = db.batch();
        const userRef = db.collection('users').doc(state.currentUser.uid);

        // 1. Update/Create Project Doc
        if (newName !== originalName) {
            // Check existence
            if (state.projects[newName]) {
                if (!confirm(`Ein Projekt mit dem Namen "${newName}" existiert bereits. Möchtest du die Projekte zusammenführen?`)) {
                    return;
                }
            }

            // Create new (safe)
            const newProjectRef = userRef.collection('projects').doc(newName);
            batch.set(newProjectRef, {
                name: newName,
                color: newColor,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Prepare to delete old
            let deleteOldSuccess = false;
            try {
                if (originalName.includes('/') || originalName.includes('\\')) {
                    console.warn("Old project name has invalid characters, skipping delete to avoid crash:", originalName);
                } else {
                    const oldProjectRef = userRef.collection('projects').doc(originalName);
                    batch.delete(oldProjectRef);
                    deleteOldSuccess = true;
                }
            } catch (refError) {
                console.warn("Could not create ref for old project:", refError);
            }

            // Update Entries
            const entriesSnapshot = await userRef.collection('entries').where('projekt', '==', originalName).get();
            entriesSnapshot.forEach(doc => {
                batch.update(doc.ref, { projekt: newName });
            });
            console.log(`Migrating ${entriesSnapshot.size} entries.`);

            await batch.commit();

            if (!deleteOldSuccess && (originalName.includes('/') || originalName.includes('\\'))) {
                alert("✅ Projekt wurde kopiert und Einträge verschoben.\n\nDas alte Projekt konnte aufgrund des Sonderzeichens ('/') nicht automatisch gelöscht werden. Es ist jetzt leer und kann ignoriert werden.");
            } else {
                showToast('✅ Projekt umbenannt & Einträge migriert');
            }

        } else {
            // Only color changed - easy case
            if (originalName.includes('/') || originalName.includes('\\')) {
                alert("⚠️ Dieses Projekt hat einen ungültigen Namen ('/'). Bitte benennen Sie es erst um (ohne Sonderzeichen), bevor Sie die Farbe ändern.");
                return;
            }

            const projectRef = userRef.collection('projects').doc(originalName);
            batch.update(projectRef, { color: newColor });
            await batch.commit();
            showToast('✅ Farbe aktualisiert');
        }

        closeEditProjectModal();

    } catch (err) {
        console.error("Error saving project:", err);
        alert("Fehler beim Speichern: " + err.message);
    }
}

export async function deleteProject(name) {
    if (confirm(`Projekt "${name}" wirklich löschen?`)) {
        await db.collection('users').doc(state.currentUser.uid).collection('projects').doc(name).delete();
        showToast('🗑️ Projekt gelöscht');
    }
}
