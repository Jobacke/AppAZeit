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
    window.signInWithGoogle = signInWithGoogle;
    window.signInWithEmail = signInWithEmail;
    window.registerWithEmail = registerWithEmail;
    window.resetPassword = resetPassword;
    window.signOut = signOut;
    window.showRegisterForm = showRegisterForm;
    window.showLoginForm = showLoginForm;
}

export async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
        const btn = document.getElementById('loginBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ Anmelden...';
        }

        await auth.signInWithPopup(provider);
        console.log('✅ Login erfolgreich');
    } catch (err) {
        console.error('Login Error:', err.code, err.message);

        const btn = document.getElementById('loginBtn');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg class="w-6 h-6" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Mit Google anmelden';
        }

        if (err.code === 'auth/popup-blocked') {
            alert('⚠️ Popup wurde blockiert! Bitte erlaube Popups für diese Seite.');
        } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
            alert('❌ Login fehlgeschlagen: ' + err.message);
        }
    }
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
