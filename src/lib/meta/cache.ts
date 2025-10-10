interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const CACHE_NAME = 'cinemeta-cache';

async function getDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return null;

  return new Promise((resolve) => {
    const request = indexedDB.open(CACHE_NAME, 1);

    request.onerror = () => resolve(null);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache');
      }
    };
  });
}

async function getFromIndexedDB(key: string): Promise<any | null> {
  const db = await getDB();
  if (!db) return null;

  return new Promise((resolve) => {
    const tx = db.transaction('cache', 'readonly');
    const store = tx.objectStore('cache');
    const request = store.get(key);

    request.onsuccess = () => {
      const entry = request.result as CacheEntry | undefined;
      if (!entry) {
        resolve(null);
        return;
      }

      const now = Date.now();
      if (now - entry.timestamp > entry.ttl) {
        resolve(null);
        return;
      }

      resolve(entry.data);
    };

    request.onerror = () => resolve(null);
  });
}

async function setToIndexedDB(key: string, data: any, ttl: number): Promise<void> {
  const db = await getDB();
  if (!db) return;

  return new Promise((resolve) => {
    const tx = db.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    store.put(entry, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function getFromLocalStorage(key: string): any | null {
  try {
    const item = localStorage.getItem(`cinemeta:${key}`);
    if (!item) return null;

    const entry = JSON.parse(item) as CacheEntry;
    const now = Date.now();

    if (now - entry.timestamp > entry.ttl) {
      localStorage.removeItem(`cinemeta:${key}`);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

function setToLocalStorage(key: string, data: any, ttl: number): void {
  try {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    localStorage.setItem(`cinemeta:${key}`, JSON.stringify(entry));
  } catch {
    // Ignore localStorage errors
  }
}

export async function getCached(key: string): Promise<any | null> {
  const indexed = await getFromIndexedDB(key);
  if (indexed !== null) return indexed;

  return getFromLocalStorage(key);
}

export async function setCache(key: string, data: any, ttl: number): Promise<void> {
  await setToIndexedDB(key, data, ttl);
  setToLocalStorage(key, data, ttl);
}

export function shouldDebug(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('debug') === 'cinemeta';
}
