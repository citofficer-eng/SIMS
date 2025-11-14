// Minimal IndexedDB key-value helper
export const openDB = (dbName = 'sims', storeName = 'kv') => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const getKV = async (key: string, dbName = 'sims', storeName = 'kv'): Promise<any | null> => {
  try {
    const db = await openDB(dbName, storeName);
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const r = store.get(key);
      r.onsuccess = () => resolve(r.result ? r.result.value : null);
      r.onerror = () => reject(r.error);
    });
  } catch (e) {
    console.warn('IndexedDB getKV failed', e);
    return null;
  }
};

export const setKV = async (key: string, value: any, dbName = 'sims', storeName = 'kv'): Promise<boolean> => {
  try {
    const db = await openDB(dbName, storeName);
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const r = store.put({ key, value });
      r.onsuccess = () => resolve(true);
      r.onerror = () => reject(r.error);
    });
  } catch (e) {
    console.warn('IndexedDB setKV failed', e);
    return false;
  }
};

export const delKV = async (key: string, dbName = 'sims', storeName = 'kv'): Promise<boolean> => {
  try {
    const db = await openDB(dbName, storeName);
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const r = store.delete(key);
      r.onsuccess = () => resolve(true);
      r.onerror = () => reject(r.error);
    });
  } catch (e) {
    console.warn('IndexedDB delKV failed', e);
    return false;
  }
};
