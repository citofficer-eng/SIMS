import { initializeApp } from 'firebase/app';
import { getDatabase, Database, ref, set, onValue, off, DataSnapshot, push } from 'firebase/database';

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

/**
 * Publish a message to a channel (stores in Realtime DB with auto-increment keys)
 * Messages sync across all connected devices in real-time
 */
export function publishMessage(channelName: string, eventName: string, data: any): Promise<void> {
  const database = initFirebase();
  if (!database) return Promise.reject(new Error('Firebase not initialized'));

  const timestamp = new Date().toISOString();
  const channelRef = ref(database, `channels/${channelName}/${eventName}`);
  const newMessageRef = push(channelRef);
  
  return set(newMessageRef, { 
    ...data, 
    timestamp,
    id: newMessageRef.key 
  });
}

/**
 * Subscribe to real-time updates on a channel
 * Callback fires whenever data changes on any device
 */
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
      const allMessages = snapshot.val();
      if (typeof allMessages === 'object' && allMessages !== null) {
        // Get the most recent message
        const latestKey = Object.keys(allMessages).sort().pop();
        if (latestKey) {
          callback(allMessages[latestKey]);
        }
      } else {
        callback(allMessages);
      }
    }
  };

  onValue(messagesRef, listener);
  
  // Return unsubscribe function
  return () => off(messagesRef, 'value', listener);
}

/**
 * Subscribe to all data in a path (for leaderboards, user lists, etc.)
 */
export function subscribeToData(
  path: string,
  callback: (data: any) => void
): () => void {
  const database = initFirebase();
  if (!database) return () => {};

  const dataRef = ref(database, path);
  
  const listener = (snapshot: DataSnapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    } else {
      callback(null);
    }
  };

  onValue(dataRef, listener);
  
  return () => off(dataRef, 'value', listener);
}

/**
 * Update data at a specific path (overwrites)
 */
export function updateData(path: string, data: any): Promise<void> {
  const database = initFirebase();
  if (!database) return Promise.reject(new Error('Firebase not initialized'));

  const dataRef = ref(database, path);
  return set(dataRef, data);
}

export function shutdownFirebase() {
  // Firebase doesn't have a built-in shutdown, but we can cleanup refs
  db = null;
}
