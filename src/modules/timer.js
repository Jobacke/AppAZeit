import { state } from '../store.js';
import { addEntry, saveCloudTimer, clearCloudTimer } from './db.js';
import { showToast, setSyncStatus } from './ui.js';
import { firebase } from '../config.js';

export function initTimer() {
    window.toggleTimer = toggleTimer;
    window.startTimer = startTimer;
    window.stopTimer = stopTimer;
    window.resetTimer = resetTimer;
    window.toggleCountdownMode = toggleCountdownMode;
    window.testAlarm = testAlarm;
    window.activateNotifications = activateNotifications;
}

export function toggleTimer() {
    if (state.isRunning) {
        stopTimer();
    } else {
        startTimer();
    }
}

export function startTimer() {
    const useCountdown = document.getElementById('useCountdown').checked;

    // Audio Context
    initAudioContext();

    // Notifications
    requestNotificationPermission();

    const countdownMinutes = parseInt(document.getElementById('countdownMinutes').value) || 60;
    const project = document.getElementById('currentProject').value;

    if (useCountdown) {
        state.timerSeconds = countdownMinutes * 60;
        const alarmTime = Date.now() + (countdownMinutes * 60 * 1000);
        saveCloudTimer(alarmTime, project);
    } else {
        state.timerSeconds = 0;
    }

    state.timerStart = new Date();
    state.isRunning = true;

    updateTimerUI(true, useCountdown);
    saveTimerState();

    state.timerInterval = setInterval(() => {
        const now = new Date();
        const elapsedSeconds = Math.floor((now - state.timerStart) / 1000);

        if (useCountdown) {
            state.timerSeconds = Math.max(0, (countdownMinutes * 60) - elapsedSeconds);
            if (state.timerSeconds <= 0) {
                state.timerSeconds = 0;
                stopTimer();
                notifyTimerEnd();
            }
        } else {
            state.timerSeconds = elapsedSeconds;
        }
        updateTimerDisplay();
    }, 1000);
}

export function stopTimer() {
    clearInterval(state.timerInterval);
    state.isRunning = false;

    updateTimerUI(false);

    // Auto-save entry if > 60s
    if (state.timerStart) {
        const elapsedSeconds = Math.floor((new Date() - state.timerStart) / 1000);
        if (elapsedSeconds > 60) {
            saveTimerEntry();
        }
    }

    clearCloudTimer();
    clearTimerState();
}

export function resetTimer() {
    clearInterval(state.timerInterval);
    state.isRunning = false;
    state.timerSeconds = 0;
    state.timerStart = null;

    updateTimerUI(false);
    document.getElementById('timerStatus').textContent = 'Bereit zum Starten';
    updateTimerDisplay();

    clearCloudTimer();
    clearTimerState();
}

function updateTimerUI(running, countdownMode = false) {
    const btn = document.getElementById('btnStartStop');
    const display = document.getElementById('timerDisplay');
    const status = document.getElementById('timerStatus');

    if (running) {
        btn.innerHTML = '⏸️ Stop';
        btn.classList.replace('bg-green-600', 'bg-red-600');
        btn.classList.replace('hover:bg-green-500', 'hover:bg-red-500');
        display.classList.add('timer-active');
        status.textContent = countdownMode ? '⏱️ Countdown läuft... (Cloud-Alarm aktiv ☁️)' : 'Timer läuft...';
    } else {
        btn.innerHTML = '▶️ Start';
        btn.classList.replace('bg-red-600', 'bg-green-600');
        btn.classList.replace('hover:bg-red-500', 'hover:bg-green-500');
        display.classList.remove('timer-active');
        status.textContent = 'Timer gestoppt';
    }
}

export function updateTimerDisplay() {
    const hours = Math.floor(state.timerSeconds / 3600);
    const minutes = Math.floor((state.timerSeconds % 3600) / 60);
    const seconds = state.timerSeconds % 60;
    document.getElementById('timerValue').textContent =
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function toggleCountdownMode() {
    const checked = document.getElementById('useCountdown').checked;
    document.getElementById('countdownMinutes').disabled = !checked;
}

function saveTimerEntry() {
    const useCountdown = document.getElementById('useCountdown').checked;
    const project = document.getElementById('currentProject').value;
    const activity = document.getElementById('currentActivity').value;

    let endTime;
    if (useCountdown) {
        const countdownMinutes = parseInt(document.getElementById('countdownMinutes').value) || 60;
        endTime = new Date(state.timerStart.getTime() + (countdownMinutes * 60 * 1000));
    } else {
        endTime = new Date();
    }

    // Calculate total elapsed minutes
    const elapsedMs = endTime - state.timerStart;
    const elapsedMinutes = Math.round(elapsedMs / 60000);

    const isPause = project === 'Pause';
    const entry = {
        datum: state.timerStart.toISOString().split('T')[0],
        start: state.timerStart.toTimeString().slice(0, 5),
        ende: endTime.toTimeString().slice(0, 5),
        projekt: project,
        taetigkeit: activity,
        homeoffice: state.isHomeoffice,
        // For pause entries, work hours are 0 and pause minutes are recorded
        stunden: isPause ? 0 : calculateHours(state.timerStart.toTimeString().slice(0, 5), endTime.toTimeString().slice(0, 5)),
        pause: isPause ? elapsedMinutes : 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    addEntry(entry);
    state.timerStart = null;
    showToast('✅ Zeiteintrag gespeichert!');
}

// Helpers
function calculateHours(start, ende) {
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(ende);
    return Math.round((endMin - startMin) / 60 * 100) / 100;
}
function timeToMinutes(time) {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

// State Persistence
function saveTimerState() {
    localStorage.setItem('zeiterfassung_timer', JSON.stringify({
        timerStart: state.timerStart?.toISOString(),
        isRunning: state.isRunning,
        isCountdown: document.getElementById('useCountdown').checked,
        countdownMinutes: document.getElementById('countdownMinutes').value,
        project: document.getElementById('currentProject').value,
        activity: document.getElementById('currentActivity').value,
        homeoffice: state.isHomeoffice
    }));
}

function clearTimerState() {
    localStorage.removeItem('zeiterfassung_timer');
}

export function restoreTimerState() {
    const saved = localStorage.getItem('zeiterfassung_timer');
    if (!saved) return;

    const s = JSON.parse(saved);
    if (!s.isRunning || !s.timerStart) return;

    const startTime = new Date(s.timerStart);
    const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const countdownMinutes = parseInt(s.countdownMinutes) || 60;

    state.timerStart = startTime;
    document.getElementById('currentProject').value = s.project || '';
    document.getElementById('currentActivity').value = s.activity || '';

    // Restore and update Homeoffice UI
    window.setLocation(s.homeoffice);

    if (s.isCountdown) {
        document.getElementById('useCountdown').checked = true;
        document.getElementById('countdownMinutes').value = countdownMinutes;
        state.timerSeconds = Math.max(0, (countdownMinutes * 60) - elapsed);
        if (state.timerSeconds <= 0) {
            state.timerSeconds = 0;
            clearTimerState();
            // notifyTimerEnd();
            return;
        }
    } else {
        state.timerSeconds = elapsed;
    }

    state.isRunning = true;
    updateTimerUI(true, s.isCountdown);
    showToast('⏱️ Timer wiederhergestellt!');

    state.timerInterval = setInterval(() => {
        const now = new Date();
        const elapsedNow = Math.floor((now - state.timerStart) / 1000);
        if (s.isCountdown) {
            state.timerSeconds = Math.max(0, (countdownMinutes * 60) - elapsedNow);
            if (state.timerSeconds <= 0) {
                state.timerSeconds = 0;
                stopTimer();
                notifyTimerEnd();
            }
        } else {
            state.timerSeconds = elapsedNow;
        }
        updateTimerDisplay();
    }, 1000);
}

// Audio Stuff
let audioCtx = null;
function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function notifyTimerEnd() {
    // Basic implementation
    showToast('⏰ Zeit abgelaufen!');
    playAlarmSound();
}

function playAlarmSound() {
    // Simplified beep
    if (audioCtx) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 880;
        osc.start();
        osc.stop(audioCtx.currentTime + 1);
    }
}

export function testAlarm() {
    initAudioContext();
    playAlarmSound();
}

// Notifications
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
}
export function activateNotifications() {
    requestNotificationPermission();
}
