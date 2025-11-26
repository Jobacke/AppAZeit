const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Cloud Function die jede Minute läuft und abgelaufene Timer prüft
 * Trigger: Cloud Scheduler (jede Minute)
 */
exports.checkTimers = functions.pubsub
    .schedule('every 1 minutes')
    .timeZone('Europe/Berlin')
    .onRun(async (context) => {
        const now = Date.now();
        
        console.log('⏰ Timer-Check läuft...', new Date(now).toISOString());
        
        try {
            // Finde alle aktiven Timer die abgelaufen sind
            const snapshot = await db.collectionGroup('timers')
                .where('active', '==', true)
                .where('alarmTime', '<=', now)
                .get();
            
            if (snapshot.empty) {
                console.log('Keine abgelaufenen Timer gefunden');
                return null;
            }
            
            console.log(`${snapshot.size} abgelaufene Timer gefunden`);
            
            const batch = db.batch();
            const notifications = [];
            
            for (const doc of snapshot.docs) {
                const timer = doc.data();
                const userId = doc.ref.parent.parent.id;
                
                console.log(`Timer abgelaufen für User: ${userId}`);
                
                // Timer als inaktiv markieren
                batch.update(doc.ref, { 
                    active: false, 
                    notifiedAt: admin.firestore.FieldValue.serverTimestamp() 
                });
                
                // FCM Token des Users holen
                const userDoc = await db.collection('users').doc(userId).get();
                const fcmToken = userDoc.data()?.fcmToken;
                
                if (fcmToken) {
                    notifications.push({
                        token: fcmToken,
                        notification: {
                            title: '⏰ Zeit abgelaufen!',
                            body: timer.project ? `Timer für "${timer.project}" ist beendet.` : 'Dein Countdown ist beendet.'
                        },
                        webpush: {
                            notification: {
                                icon: 'https://jobacke.github.io/AppAZeit/icon-192.png',
                                badge: 'https://jobacke.github.io/AppAZeit/icon-192.png',
                                vibrate: [200, 100, 200, 100, 200],
                                requireInteraction: true,
                                tag: 'timer-alarm',
                                actions: [
                                    { action: 'open', title: 'App öffnen' }
                                ]
                            },
                            fcmOptions: {
                                link: 'https://jobacke.github.io/AppAZeit/'
                            }
                        },
                        // Hohe Priorität für sofortige Zustellung
                        android: {
                            priority: 'high',
                            notification: {
                                sound: 'default',
                                priority: 'high'
                            }
                        },
                        apns: {
                            payload: {
                                aps: {
                                    sound: 'default',
                                    badge: 1,
                                    'content-available': 1
                                }
                            },
                            headers: {
                                'apns-priority': '10'
                            }
                        }
                    });
                }
            }
            
            // Batch-Update ausführen
            await batch.commit();
            
            // Notifications senden
            if (notifications.length > 0) {
                const results = await Promise.allSettled(
                    notifications.map(msg => messaging.send(msg))
                );
                
                results.forEach((result, i) => {
                    if (result.status === 'fulfilled') {
                        console.log(`✅ Notification gesendet: ${result.value}`);
                    } else {
                        console.error(`❌ Notification fehlgeschlagen:`, result.reason);
                    }
                });
            }
            
            return null;
        } catch (error) {
            console.error('Fehler beim Timer-Check:', error);
            return null;
        }
    });

/**
 * HTTP Function zum Testen der Push-Notification
 */
exports.testNotification = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Nicht angemeldet');
    }
    
    const userId = context.auth.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    const fcmToken = userDoc.data()?.fcmToken;
    
    if (!fcmToken) {
        throw new functions.https.HttpsError('failed-precondition', 'Kein FCM Token gefunden');
    }
    
    try {
        const message = {
            token: fcmToken,
            notification: {
                title: '🔔 Test-Benachrichtigung',
                body: 'Push-Notifications funktionieren!'
            },
            webpush: {
                notification: {
                    icon: 'https://jobacke.github.io/AppAZeit/icon-192.png',
                    vibrate: [200, 100, 200],
                    tag: 'test'
                }
            }
        };
        
        const response = await messaging.send(message);
        console.log('Test-Notification gesendet:', response);
        return { success: true, messageId: response };
    } catch (error) {
        console.error('Fehler beim Senden:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
