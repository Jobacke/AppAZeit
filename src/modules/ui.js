import { state } from '../store.js';
import { filterEntries } from './entries.js';
import { renderProjects } from './projects.js';
import { updateDashboard } from './dashboard.js';
import { renderTasks } from './tasks.js';
import { updateTimerDisplay } from './timer.js';
// I will keep purely UI helper functions here that don't depend on complex logic, 
// or I will move the logic to respective modules (entries.js, etc.) and import them.

// Since I haven't created entries.js yet, I will define stubs or exported functions there.
// For now, let's put UI manipulation helpers here.

export function showToast(message) {
    // Basic toast implementation
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-lg border border-gray-600 z-50 animate-bounce';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

export function showLogin() {
    document.getElementById('loginScreen')?.classList.remove('hidden');
    document.getElementById('app')?.classList.add('hidden');
    document.getElementById('registerForm')?.classList.add('hidden');
    document.getElementById('emailLoginForm')?.classList.remove('hidden');
}

export function showApp() {
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');

    // User Info
    const user = state.currentUser;
    const userPhoto = document.getElementById('userPhoto');
    const userAvatar = document.getElementById('userAvatar');

    if (user && user.photoURL) {
        userPhoto.src = user.photoURL;
        userPhoto.style.display = 'block';
    } else {
        userPhoto.src = '';
        userPhoto.style.display = 'none';
        userAvatar.innerHTML = '👤';
    }

    const displayName = user.displayName || user.email?.split('@')[0] || 'User';
    document.getElementById('userName').textContent = displayName;
    document.getElementById('userEmail').textContent = user.email || '';

    // Make sure initUI is called from main
    showTab('timer');
}

export function setSyncStatus(status) {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    el.classList.remove('syncing');

    switch (status) {
        case 'syncing':
            el.innerHTML = '🔄 Sync...';
            el.className = 'sync-indicator syncing text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full';
            break;
        case 'synced':
            el.innerHTML = '☁️ Sync';
            el.className = 'sync-indicator text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full';
            break;
        case 'error':
            el.innerHTML = '⚠️ Offline';
            el.className = 'sync-indicator text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full';
            break;
    }
}

export function showTab(tabName) {
    ['timer', 'tasks', 'entries', 'projects', 'dashboard', 'export'].forEach(t => {
        document.getElementById(`content-${t}`)?.classList.add('hidden');
        document.getElementById(`tab-${t}`)?.classList.remove('tab-active');
        document.getElementById(`tab-${t}`)?.classList.add('text-br-200');
    });
    document.getElementById(`content-${tabName}`)?.classList.remove('hidden');
    document.getElementById(`tab-${tabName}`)?.classList.add('tab-active');
    document.getElementById(`tab-${tabName}`)?.classList.remove('text-br-200');

    // Trigger updates
    if (tabName === 'entries') window.filterEntries && window.filterEntries();
    if (tabName === 'projects') window.renderProjects && window.renderProjects();
    if (tabName === 'dashboard') window.updateDashboard && window.updateDashboard();
    if (tabName === 'tasks') window.renderTasks && window.renderTasks();
}

export function initUI() {
    document.getElementById('manualDate').value = new Date().toISOString().split('T')[0];

    // Sort Order
    const savedSortOrder = localStorage.getItem('zeiterfassung_sortOrder');
    if (savedSortOrder === 'asc') {
        state.sortOrderDescending = false;
        document.getElementById('btnSortOrder').innerHTML = '⬆️';
        document.getElementById('btnSortOrder').title = 'Sortierung: Älteste zuerst';
    }

    // Attach Tab listeners
    window.showTab = showTab;
}


export function updateTodayView() {
    // Use local date to avoid timezone issues (UTC vs Local)
    const now = new Date();
    const today = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const todayEntries = state.entries.filter(e => e.datum === today);

    // Calculate totals
    let totalHours = 0;
    let hoHours = 0;
    let officeHours = 0;

    todayEntries.forEach(e => {
        const hours = parseFloat(e.stunden || 0);
        totalHours += hours;
        if (e.homeoffice) {
            hoHours += hours;
        } else {
            officeHours += hours;
        }
    });

    // Update Progress Bar
    const targetHours = 7.8;
    const rawPercentage = (totalHours / targetHours) * 100;
    const displayPercentage = Math.round(rawPercentage);
    const barPercentage = Math.min(100, rawPercentage);

    document.getElementById('todayWorkProgress').textContent = `${totalHours.toFixed(1)}h / ${targetHours}h`;
    document.getElementById('todayWorkPercentText').textContent = `${displayPercentage}%`;

    const bar = document.getElementById('todayWorkBar');
    if (bar) bar.style.width = `${barPercentage}%`;

    const percentLabel = document.getElementById('todayWorkPercent');
    if (percentLabel) {
        percentLabel.textContent = displayPercentage > 10 ? `${displayPercentage}%` : '';
    }

    // Update Homeoffice/Office Split
    const totalSplit = hoHours + officeHours;
    const hoPercent = totalSplit > 0 ? (hoHours / totalSplit) * 100 : 50;
    const officePercent = totalSplit > 0 ? (officeHours / totalSplit) * 100 : 50;

    document.getElementById('todayHoBar').style.width = `${hoPercent}%`;
    document.getElementById('todayOfficeBar').style.width = `${officePercent}%`;
    document.getElementById('todayHoLabel').textContent = hoPercent > 10 ? `${Math.round(hoPercent)}%` : '';
    document.getElementById('todayOfficeLabel').textContent = officePercent > 10 ? `${Math.round(officePercent)}%` : '';

    document.getElementById('todayHoHours').textContent = `${hoHours.toFixed(1)}h`;
    document.getElementById('todayOfficeHours').textContent = `${officeHours.toFixed(1)}h`;

    document.getElementById('todayTotal').textContent = `${totalHours.toFixed(2)} h`;

    // Render Today's List
    const listContainer = document.getElementById('todayEntries');
    if (listContainer) {
        if (todayEntries.length === 0) {
            listContainer.innerHTML = '<div class="p-4 text-center text-br-300 text-sm">Noch keine Einträge heute</div>';
        } else {
            // Sort by start time
            todayEntries.sort((a, b) => (a.start || '').localeCompare(b.start || ''));

            listContainer.innerHTML = todayEntries.map(e => `
                <div class="p-3 border-b border-br-600 flex items-center justify-between hover:bg-br-700/50 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="w-1 h-8 rounded" style="background: ${state.projects[e.projekt]?.color || '#6B7280'}"></div>
                        <div>
                            <div class="text-sm font-medium">${e.start} - ${e.ende}</div>
                            <div class="text-xs text-br-200">${e.projekt || 'Allgemein'} • ${e.taetigkeit || '-'}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="font-mono text-sm">${(e.stunden || 0).toFixed(2)}h</div>
                        <div class="text-xs">${e.homeoffice ? '🏠' : '🏢'}</div>
                    </div>
                </div>
            `).join('');
        }
    }
}

// Placeholder for missing imports resolution

// updateNotificationButton logic needs to be implemented or imported
export function updateNotificationButton() {
    // Stub implementation to avoid build error
    console.log('updateNotificationButton called');
}

export function hideUserMenu() {
    document.getElementById('userMenu')?.classList.add('hidden');
}


export function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
    } catch (e) {
        return dateString;
    }
}

// Export to window for HTML onClick handlers
window.showUserMenu = () => document.getElementById('userMenu').classList.toggle('hidden');
window.hideUserMenu = hideUserMenu;
window.formatDate = formatDate;
window.updateTodayView = updateTodayView;
window.setLocation = setLocation;

export function setLocation(isHomeoffice) {
    state.isHomeoffice = isHomeoffice;

    // Update UI Buttons
    const btnHo = document.getElementById('btn-ho');
    const btnOffice = document.getElementById('btn-office');

    if (isHomeoffice) {
        btnHo.classList.replace('bg-br-700', 'bg-br-500');
        btnOffice.classList.replace('bg-br-500', 'bg-br-700');
    } else {
        btnHo.classList.replace('bg-br-500', 'bg-br-700');
        btnOffice.classList.replace('bg-br-700', 'bg-br-500');
    }
}
