import { auth, firebase } from '../config.js';
import { state } from '../store.js';
import { setupRealtimeSync, cleanupSync } from './db.js';
import { showApp, showLogin, showToast, hideUserMenu, initUI, updateNotificationButton } from './ui.js';
import { restoreTimerState } from './timer.js';

export function initAuth() {
    auth.onAuthStateChanged(user => {
        console.log('Auth State:', user ? user.email : 'nicht angemeldet');
        if (user) {
            state.currentUser = user;
            showApp();
            setupRealtimeSync();
            restoreTimerState();
        } else {
            state.currentUser = null;
            showLogin();
            cleanupSync();
        }
    });

    // Attach global event handlers for Auth

    window.signInWithEmail = signInWithEmail;
    window.registerWithEmail = registerWithEmail;
    window.resetPassword = resetPassword;
    window.signOut = signOut;
    window.showRegisterForm = showRegisterForm;
    window.showLoginForm = showLoginForm;
}



export function signOut() {
    auth.signOut();
    hideUserMenu();
}

// E-Mail Auth implementation
export function showRegisterForm() {
    document.getElementById('emailLoginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
}

export function showLoginForm() {
    document.getElementById('registerForm')?.classList.add('hidden');
    document.getElementById('emailLoginForm')?.classList.remove('hidden');
}

export async function signInWithEmail() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        alert('Bitte E-Mail und Passwort eingeben.');
        return;
    }

    const btn = document.getElementById('emailLoginBtn');
    btn.disabled = true;
    btn.innerHTML = '⏳ Anmelden...';

    try {
        await auth.signInWithEmailAndPassword(email, password);
        console.log('✅ E-Mail Login erfolgreich');
    } catch (err) {
        console.error('E-Mail Login Error:', err.code, err.message);

        btn.disabled = false;
        btn.innerHTML = '📧 Mit E-Mail anmelden';

        switch (err.code) {
            case 'auth/user-not-found':
                alert('❌ Kein Konto mit dieser E-Mail gefunden.\n\nMöchtest du dich registrieren?');
                break;
            case 'auth/wrong-password':
                alert('❌ Falsches Passwort.');
                break;
            case 'auth/invalid-email':
                alert('❌ Ungültige E-Mail-Adresse.');
                break;
            case 'auth/too-many-requests':
                alert('⚠️ Zu viele Versuche. Bitte warte einen Moment.');
                break;
            default:
                alert('❌ Login fehlgeschlagen: ' + err.message);
        }
    }
}

export async function registerWithEmail() {
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

    if (!email || !password) {
        alert('Bitte E-Mail und Passwort eingeben.');
        return;
    }

    if (password.length < 6) {
        alert('Das Passwort muss mindestens 6 Zeichen haben.');
        return;
    }

    if (password !== passwordConfirm) {
        alert('Die Passwörter stimmen nicht überein.');
        return;
    }

    try {
        await auth.createUserWithEmailAndPassword(email, password);
        console.log('✅ Registrierung erfolgreich');
        showToast('✅ Konto erstellt! Du bist jetzt angemeldet.');
    } catch (err) {
        console.error('Registrierung Error:', err.code, err.message);

        switch (err.code) {
            case 'auth/email-already-in-use':
                alert('❌ Diese E-Mail ist bereits registriert.\n\nBitte melde dich an oder nutze "Passwort vergessen".');
                break;
            default:
                alert('❌ Registrierung fehlgeschlagen: ' + err.message);
        }
    }
}

export async function resetPassword() {
    const email = document.getElementById('loginEmail').value.trim();

    if (!email) {
        alert('Bitte gib zuerst deine E-Mail-Adresse ein.');
        return;
    }

    try {
        await auth.sendPasswordResetEmail(email);
        alert('✅ Passwort-Reset E-Mail gesendet!\n\nBitte prüfe dein Postfach (auch Spam-Ordner).');
    } catch (err) {
        console.error('Password Reset Error:', err.code, err.message);
        alert('❌ Fehler: ' + err.message);
    }
}
