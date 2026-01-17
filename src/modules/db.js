import { db, firebase } from '../config.js';
import { state } from '../store.js';
import { updateTodayView, setSyncStatus } from './ui.js';
import { filterEntries } from './entries.js';
import { updateTimerDisplay } from './timer.js';
import { renderProjects, updateProjectSelects, initializeProjects } from './projects.js';
import { renderTasks, showTasksDashboardOnStart } from './tasks.js';
import { updateDashboard } from './dashboard.js';

export function setupRealtimeSync() {
    if (!state.currentUser) return;

    setSyncStatus('syncing');

    // Entries listener
    state.unsubscribeEntries = db.collection('users').doc(state.currentUser.uid)
        .collection('entries')
        .orderBy('datum', 'desc')
        .onSnapshot(snapshot => {
            state.entries = [];
            snapshot.forEach(doc => {
                state.entries.push({ id: doc.id, ...doc.data() });
            });
            updateTodayView();
            // Optional: call these if UI elements exist
            filterEntries();
            updateDashboard();
            setSyncStatus('synced');
        }, err => {
            console.error('Entries sync error:', err);
            setSyncStatus('error');
        });

    // Projects listener
    state.unsubscribeProjects = db.collection('users').doc(state.currentUser.uid)
        .collection('projects')
        .onSnapshot(snapshot => {
            if (snapshot.empty) {
                // Initialize with default projects
                initializeProjects();
            } else {
                state.projects = {};
                snapshot.forEach(doc => {
                    state.projects[doc.id] = doc.data();
                });
                updateProjectSelects();
                renderProjects();
            }
        }, err => {
            console.error('Projects sync error:', err);
        });

    // Tasks listener
    state.unsubscribeTasks = db.collection('users').doc(state.currentUser.uid)
        .collection('tasks')
        .orderBy('faelligAm', 'asc')
        .onSnapshot(snapshot => {
            state.tasks = [];
            snapshot.forEach(doc => {
                state.tasks.push({ id: doc.id, ...doc.data() });
            });
            renderTasks();

            if (!state.tasksDashboardShown) {
                showTasksDashboardOnStart();
            }
            setSyncStatus('synced');
        }, err => {
            console.error('Tasks sync error:', err);
            setSyncStatus('error');
        });
}

export function cleanupSync() {
    if (state.unsubscribeEntries) state.unsubscribeEntries();
    if (state.unsubscribeProjects) state.unsubscribeProjects();
    if (state.unsubscribeTasks) state.unsubscribeTasks();
}

// === CRUD Operations ===

export async function addEntry(entry) {
    if (!state.currentUser) return;
    setSyncStatus('syncing');
    try {
        await db.collection('users').doc(state.currentUser.uid).collection('entries').add(entry);
        setSyncStatus('synced');
    } catch (err) {
        console.error('Add entry error:', err);
        setSyncStatus('error');
    }
}

export async function updateEntry(id, data) {
    if (!state.currentUser) return;
    setSyncStatus('syncing');
    try {
        await db.collection('users').doc(state.currentUser.uid).collection('entries').doc(id).update(data);
        setSyncStatus('synced');
    } catch (err) {
        console.error('Update entry error:', err);
        setSyncStatus('error');
    }
}

export async function deleteEntryFromDB(id) {
    if (!state.currentUser) return;
    setSyncStatus('syncing');
    try {
        await db.collection('users').doc(state.currentUser.uid).collection('entries').doc(id).delete();
        setSyncStatus('synced');
    } catch (err) {
        console.error('Delete entry error:', err);
        setSyncStatus('error');
    }
}

export async function saveCloudTimer(alarmTime, project) {
    if (!state.currentUser) return;
    try {
        await db.collection('users').doc(state.currentUser.uid)
            .collection('timers').doc('current').set({
                alarmTime: alarmTime,
                project: project || '',
                active: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        console.log('☁️ Cloud Timer gespeichert');
    } catch (error) {
        console.error('Cloud Timer Fehler:', error);
    }
}

export async function clearCloudTimer() {
    if (!state.currentUser) return;
    try {
        await db.collection('users').doc(state.currentUser.uid)
            .collection('timers').doc('current').update({
                active: false
            });
        console.log('☁️ Cloud Timer deaktiviert');
    } catch (error) {
        console.error('Cloud Timer löschen Fehler:', error);
    }
}

export async function clearAllData() {
    if (!confirm('⚠️ ALLE Daten unwiderruflich löschen?')) return;
    setSyncStatus('syncing');

    const entriesSnapshot = await db.collection('users').doc(state.currentUser.uid).collection('entries').get();
    const batch = db.batch();
    entriesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    setSyncStatus('synced');
}
