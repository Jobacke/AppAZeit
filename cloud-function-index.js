const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Hilfsfunktion: Alle FCM Tokens eines Users holen
 */
function getAllTokens(userData) {
    const tokens = [];
    if (!userData) return tokens;
    
    // Haupttoken
    if (userData.fcmToken) {
        tokens.push({ key: 'fcmToken', token: userData.fcmToken });
    }
    
    // Nummerierte Tokens (fcmToken0, fcmToken1, fcmToken2, ...)
    for (let i = 0; i <= 10; i++) {
        const key = `fcmToken${i}`;
        if (userData[key]) {
            tokens.push({ key, token: userData[key] });
        }
    }
    
    return tokens;
}

/**
 * Hilfsfunktion: Ungültige Tokens aus der Datenbank löschen
 */
async function removeInvalidTokens(userId, invalidKeys) {
    if (invalidKeys.length === 0) return;
    
    const updateData = {};
    invalidKeys.forEach(key => {
        updateData[key] = admin.firestore.FieldValue.delete();
    });
    
    await db.collection('users').doc(userId).update(updateData);
    console.log(`🗑️ Ungültige Tokens gelöscht für User ${userId}:`, invalidKeys);
}

/**
 * Hilfsfunktion: Notifications an alle Tokens eines Users senden
 */
async function sendToAllTokens(userId, tokens, notificationPayload) {
    if (tokens.length === 0) {
        console.log(`Keine Tokens für User ${userId}`);
        return;
    }
    
    console.log(`📤 Sende an ${tokens.length} Token(s) für User ${userId}`);
    
    const invalidKeys = [];
    const results = await Promise.allSettled(
        tokens.map(async ({ key, token }) => {
            const message = {
                token: token,
                ...notificationPayload
            };
            
            try {
                const response = await messaging.send(message);
                console.log(`✅ Gesendet an ${key}: ${response}`);
                return { success: true, key };
            } catch (error) {
                console.error(`❌ Fehler bei ${key}:`, error.code, error.message);
                
                // Token ist ungültig - zum Löschen markieren
                if (error.code === 'messaging/invalid-registration-token' ||
                    error.code === 'messaging/registration-token-not-registered' ||
                    error.code === 'messaging/invalid-argument') {
                    invalidKeys.push(key);
                }
                
                return { success: false, key, error: error.code };
            }
        })
    );
    
    // Ungültige Tokens löschen
    await removeInvalidTokens(userId, invalidKeys);
    
    const successCount = results.filter(r => r.value?.success).length;
    console.log(`📊 Ergebnis: ${successCount}/${tokens.length} erfolgreich`);
    
    return results;
}

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
            const userNotifications = new Map(); // userId -> notificationPayload
            
            for (const doc of snapshot.docs) {
                const timer = doc.data();
                const userId = doc.ref.parent.parent.id;
                
                console.log(`Timer abgelaufen für User: ${userId}`);
                
                // Timer als inaktiv markieren
                batch.update(doc.ref, { 
                    active: false, 
                    notifiedAt: admin.firestore.FieldValue.serverTimestamp() 
                });
                
                // Notification-Payload für diesen User speichern
                userNotifications.set(userId, {
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
            
            // Batch-Update ausführen
            await batch.commit();
            
            // Notifications an alle User senden
            for (const [userId, payload] of userNotifications) {
                const userDoc = await db.collection('users').doc(userId).get();
                const tokens = getAllTokens(userDoc.data());
                await sendToAllTokens(userId, tokens, payload);
            }
            
            return null;
        } catch (error) {
            console.error('Fehler beim Timer-Check:', error);
            return null;
        }
    });

/**
 * HTTP Function zum Testen der Push-Notification
 * Sendet an ALLE registrierten Geräte des Users
 */
exports.testNotification = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Nicht angemeldet');
    }
    
    const userId = context.auth.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    const tokens = getAllTokens(userDoc.data());
    
    if (tokens.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'Keine FCM Tokens gefunden');
    }
    
    const payload = {
        notification: {
            title: '🔔 Test-Benachrichtigung',
            body: `Push funktioniert! (${tokens.length} Gerät${tokens.length > 1 ? 'e' : ''})`
        },
        webpush: {
            notification: {
                icon: 'https://jobacke.github.io/AppAZeit/icon-192.png',
                vibrate: [200, 100, 200],
                tag: 'test'
            }
        }
    };
    
    try {
        await sendToAllTokens(userId, tokens, payload);
        return { success: true, tokenCount: tokens.length };
    } catch (error) {
        console.error('Fehler beim Senden:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Cleanup-Function: Entfernt alte/doppelte Tokens
 * Kann manuell aufgerufen werden um aufzuräumen
 */
exports.cleanupTokens = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Nicht angemeldet');
    }
    
    const userId = context.auth.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const tokens = getAllTokens(userData);
    
    console.log(`🧹 Cleanup für User ${userId}: ${tokens.length} Token(s) gefunden`);
    
    // Duplikate finden
    const uniqueTokens = new Map();
    const duplicateKeys = [];
    
    tokens.forEach(({ key, token }) => {
        if (uniqueTokens.has(token)) {
            duplicateKeys.push(key); // Duplikat
        } else {
            uniqueTokens.set(token, key);
        }
    });
    
    // Alle Tokens testen und ungültige markieren
    const invalidKeys = [...duplicateKeys];
    
    for (const { key, token } of tokens) {
        if (duplicateKeys.includes(key)) continue; // Überspringe Duplikate
        
        try {
            // Dry-run: Token validieren ohne zu senden
            await messaging.send({
                token: token,
                notification: { title: 'test' }
            }, true); // dry_run = true
        } catch (error) {
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
                invalidKeys.push(key);
            }
        }
    }
    
    // Ungültige Tokens löschen
    await removeInvalidTokens(userId, invalidKeys);
    
    return { 
        success: true, 
        totalTokens: tokens.length,
        removedTokens: invalidKeys.length,
        remainingTokens: tokens.length - invalidKeys.length
    };
});
