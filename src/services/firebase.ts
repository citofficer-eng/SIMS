import { initializeApp } from 'firebase/app';
import { getDatabase, Database, ref, set, onValue, off, DataSnapshot } from 'firebase/database';

let db: Database | null = null;

export function initFirebase() {
  if (db) return db;

  const firebaseConfig = {
    apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY,
    authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID,
    storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
    databaseURL: (import.meta as any).env?.VITE_FIREBASE_DATABASE_URL,
    appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID,
  };

  // Validate required config
  if (!firebaseConfig.projectId || !firebaseConfig.databaseURL) {
    console.warn('[Firebase] Missing Firebase config. Realtime disabled.');
    return null;
  }

  try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    console.log('[Firebase] Initialized successfully');
    return db;
  } catch (err) {
    console.error('[Firebase] Initialization failed:', err);
    return null;
  }
}

export function publishMessage(channelName: string, eventName: string, data: any): Promise<void> {
  const database = initFirebase();
  if (!database) return Promise.reject(new Error('Firebase not initialized'));

  const timestamp = new Date().toISOString();
  const msgRef = ref(database, `channels/${channelName}/${eventName}/${Date.now()}`);
  return set(msgRef, { ...data, timestamp });
}

export function subscribeToChannel(
  channelName: string,
  eventName: string,
  callback: (data: any) => void
): () => void {
  const database = initFirebase();
  if (!database) return () => {};

  const messagesRef = ref(database, `channels/${channelName}/${eventName}`);
  const listener = (snapshot: DataSnapshot) => {
    if (snapshot.exists()) {
      const messages = snapshot.val();
      // Get latest message (most recent by timestamp)
      const latestKey = Object.keys(messages).sort().pop();
      if (latestKey) {
        callback(messages[latestKey]);
      }
    }
  };

  onValue(messagesRef, listener);
  return () => off(messagesRef, 'value', listener);
}

export function shutdownFirebase() {
  // Firebase doesn't have a built-in shutdown, but we can cleanup refs
  db = null;
}
