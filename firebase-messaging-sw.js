// Firebase Messaging Service Worker
// Diese Datei MUSS im Root-Verzeichnis liegen und firebase-messaging-sw.js heißen!

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase Config - MUSS identisch sein mit der App!
firebase.initializeApp({
    apiKey: "AIzaSyDJcK71mE0pjol-2loS9q9XhXFwxnJMu6U",
  authDomain: "appazeit.firebaseapp.com",
  projectId: "appazeit",
  storageBucket: "appazeit.firebasestorage.app",
  messagingSenderId: "977328058000",
  appId: "1:977328058000:web:360b79579689552423b215"
};

const messaging = firebase.messaging();

// Background Message Handler
messaging.onBackgroundMessage((payload) => {
    console.log('🔔 Background Message empfangen:', payload);
    
    const notificationTitle = payload.notification?.title || '⏰ Timer-Alarm';
    const notificationOptions = {
        body: payload.notification?.body || 'Dein Timer ist abgelaufen!',
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        tag: 'timer-alarm',
        requireInteraction: true,
        actions: [
            { action: 'open', title: '📱 App öffnen' },
            { action: 'dismiss', title: '✓ OK' }
        ],
        data: payload.data
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
    console.log('Notification geklickt:', event);
    
    event.notification.close();
    
    if (event.action === 'dismiss') {
        return;
    }
    
    // App öffnen oder in Vordergrund bringen
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Prüfe ob App schon offen ist
            for (const client of clientList) {
                if (client.url.includes('jobacke.github.io/AppAZeit') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Sonst neues Fenster öffnen
            if (clients.openWindow) {
                return clients.openWindow('https://jobacke.github.io/AppAZeit/');
            }
        })
    );
});
