export const state = {
    currentUser: null,
    entries: [],
    projects: {},
    tasks: [],
    timerInterval: null,
    timerStart: null,
    timerSeconds: 0,
    isRunning: false,
    isHomeoffice: true,
    entriesPageSize: 50,
    entriesCurrentPage: 1,
    sortOrderDescending: true,
    dashboardPeriod: 'week',
    unsubscribeEntries: null,
    unsubscribeProjects: null,
    unsubscribeTasks: null,
    tasksDashboardShown: false
};

// Simple event bus for state changes
const listeners = new Set();
export const subscribe = (listener) => listeners.add(listener);
export const notify = () => listeners.forEach(l => l());
