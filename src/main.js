import './styles.css';
import { initAuth } from './modules/auth.js';
import { initUI } from './modules/ui.js';
import { initTimer } from './modules/timer.js';
import { initEntries } from './modules/entries.js';
import { initProjects } from './modules/projects.js';
import { initTasks } from './modules/tasks.js';
import { initDashboard } from './modules/dashboard.js';
import { initExport } from './modules/export.js';


document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initTimer();
    initEntries();
    initProjects();
    initTasks();
    initDashboard();
    initExport();


    // Initialize Auth last as it might trigger UI updates immediately
    initAuth();
});
