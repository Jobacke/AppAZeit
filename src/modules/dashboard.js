import { state } from '../store.js';


export function initDashboard() {
    window.updateDashboard = updateDashboard;
    window.setDashboardPeriod = setDashboardPeriod;
    state.dashboardPeriod = 'week';
}

export function setDashboardPeriod(period) {
    state.dashboardPeriod = period;

    // Toggle date range visibility
    const dateRange = document.getElementById('dashboardDateRange');
    if (dateRange) {
        if (period === 'custom') {
            dateRange.classList.remove('hidden');
        } else {
            dateRange.classList.add('hidden');
        }
    }

    updateDashboard();
}


export function updateDashboard() {
    const period = state.dashboardPeriod || 'week';
    const entries = state.entries;

    if (!entries) return;

    // Filter Logic
    const { start, end } = getDashboardDateRange(period);
    const filtered = entries.filter(e => e.datum >= start && e.datum <= end);

    // Stats Calculations
    let totalHours = 0;
    let hoHours = 0;
    let officeHours = 0;
    const days = new Set();
    const projectHours = {};

    const projectFilter = document.getElementById('dashProjectFilter')?.value;

    filtered.forEach(e => {
        const pId = e.projekt || 'unknown';

        // Apply Project Filter
        if (projectFilter && projectFilter !== '' && pId !== projectFilter) {
            return;
        }

        const h = parseFloat(e.stunden || 0);

        // Special handling for Pause
        if (pId === 'Pause') {
            const pauseDuration = parseFloat(e.stunden || 0);

            // If we are explicitly filtering for "Pause", we treat it as the main stat for "Total Hours" context
            // otherwise verify if user wants to see it. 
            // Standard logic: exclude from TOTAL WORK HOURS if mixed with others.
            // If filtered specifically for Pause, we likely want to see the sum.

            if (projectFilter === 'Pause') {
                totalHours += pauseDuration;
                if (e.homeoffice) hoHours += pauseDuration;
                else officeHours += pauseDuration;
                days.add(e.datum);
            }

            if (!projectHours[pId]) projectHours[pId] = 0;
            projectHours[pId] += pauseDuration;

            // If NOT filtered for Pause (i.e. 'All Projects'), we continue to exclude it from totals
            return;
        }

        totalHours += h;
        days.add(e.datum);

        if (e.homeoffice) hoHours += h;
        else officeHours += h;

        if (!projectHours[pId]) projectHours[pId] = 0;
        projectHours[pId] += h;
    });

    const numDays = days.size;
    const avgHours = numDays > 0 ? (totalHours / numDays) : 0;

    // Render Basic Stats
    setText('statTotalHours', totalHours.toFixed(1));
    setText('statAvgPerDay', avgHours.toFixed(1));
    setText('statWorkDays', numDays);
    setText('statEntries', filtered.length);

    // Render Homeoffice vs Office Split
    const totalSplit = hoHours + officeHours;
    const hoPercent = totalSplit > 0 ? (hoHours / totalSplit) * 100 : 0;
    const officePercent = totalSplit > 0 ? (officeHours / totalSplit) * 100 : 0;

    setText('statHomeoffice', `${Math.round(hoPercent)}%`);
    setText('statOffice', `${Math.round(officePercent)}%`);

    const hoBar = document.getElementById('hoBar');
    const officeBar = document.getElementById('officeBar');
    if (hoBar) hoBar.style.width = `${hoPercent}%`;
    if (officeBar) officeBar.style.width = `${officePercent}%`;

    // Render Project Stats
    const projectStatsContainer = document.getElementById('projectStats');
    if (projectStatsContainer) {
        const sortedProjects = Object.entries(projectHours).sort((a, b) => b[1] - a[1]);

        projectStatsContainer.innerHTML = sortedProjects.map(([pId, hours]) => {
            let project = state.projects[pId];
            if (pId === 'Pause') {
                project = { name: 'Pause', color: '#60A5FA' }; // Blau
            } else if (!project) {
                project = { name: pId === 'unknown' ? 'Ohne Projekt' : pId, color: '#6B7280' };
            }

            const pName = project.name;
            const percent = totalHours > 0 ? (hours / totalHours) * 100 : 0; // Relative to Working Hours

            return `
                <div>
                    <div class="flex justify-between text-xs mb-1">
                        <span class="text-br-200">${pName}</span>
                        <span class="font-mono">${hours.toFixed(1)}h (${Math.round(percent)}%)</span>
                    </div>
                    <div class="w-full h-2 bg-br-700 rounded-full overflow-hidden">
                        <div class="h-full rounded-full" style="width: ${percent}%; background-color: ${project.color}"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function getDashboardDateRange(period) {
    const now = new Date();
    // Use local date for logic
    const today = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    if (period === 'custom') {
        const f = document.getElementById('dashFrom')?.value;
        const t = document.getElementById('dashTo')?.value;
        return { start: f || '0000-00-00', end: t || '9999-99-99' };
    }

    if (period === 'all') return { start: '0000-00-00', end: '9999-99-99' };
    if (period === 'today') return { start: today, end: today };

    if (period === 'week') {
        const curr = new Date(now); // use raw now for day calculation
        const day = curr.getDay() || 7;
        curr.setDate(curr.getDate() - day + 1);
        const start = curr.toISOString().split('T')[0];
        const end = today; // up to today
        return { start, end };
    }

    if (period === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        return { start, end };
    }

    if (period === 'year') {
        const start = `${now.getFullYear()}-01-01`;
        const end = `${now.getFullYear()}-12-31`;
        return { start, end };
    }

    return { start: today, end: today };
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}
