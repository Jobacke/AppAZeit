import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';
import 'firebase/compat/messaging';

const firebaseConfig = {
    apiKey: "AIzaSyBExZA4wqpDapFQcxfrthnNgKgvFMFNWt8",
    authDomain: "appazeit.firebaseapp.com",
    projectId: "appazeit",
    storageBucket: "appazeit.firebasestorage.app",
    messagingSenderId: "977328058000",
    appId: "1:977328058000:web:360b79579689552423b215"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const functions = firebase.functions();

let messaging = null;
if (typeof window !== 'undefined' && 'Notification' in window && firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
}
export { messaging, firebase };
