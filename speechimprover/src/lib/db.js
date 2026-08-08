// Minimal promise-based IndexedDB wrapper. No external deps.
// Two stores: `sessions` (metrics + metadata) and `audio` (bulky blobs, purgeable).

const DB_NAME = 'speechimprover';
const DB_VERSION = 2;
const STORE_SESSIONS = 'sessions';
const STORE_AUDIO = 'audio';
const STORE_FS = 'fsHandles';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FS)) {
        // File System Access handles (the chosen cowork folder). Structured-cloneable
        // but NOT JSON — kept out of export/import. key string → handle.
        db.createObjectStore(STORE_FS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        let result;
        Promise.resolve(fn(store))
          .then((r) => {
            result = r;
          })
          .catch(reject);
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
  );
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---- Sessions ----

export async function getAllSessions() {
  const rows = await tx(STORE_SESSIONS, 'readonly', (store) =>
    reqToPromise(store.getAll())
  );
  return (rows || []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function putSession(session) {
  await tx(STORE_SESSIONS, 'readwrite', (store) => reqToPromise(store.put(session)));
  return session;
}

export async function getSession(id) {
  return tx(STORE_SESSIONS, 'readonly', (store) => reqToPromise(store.get(id)));
}

export async function deleteSession(id) {
  return tx(STORE_SESSIONS, 'readwrite', (store) => reqToPromise(store.delete(id)));
}

// ---- Audio blobs ----

export async function putAudio(id, blob, mime) {
  const record = { id, blob, mime, bytes: blob.size };
  await tx(STORE_AUDIO, 'readwrite', (store) => reqToPromise(store.put(record)));
  return record;
}

export async function getAudio(id) {
  return tx(STORE_AUDIO, 'readonly', (store) => reqToPromise(store.get(id)));
}

export async function deleteAudio(id) {
  return tx(STORE_AUDIO, 'readwrite', (store) => reqToPromise(store.delete(id)));
}

export async function getAllAudioMeta() {
  const rows = await tx(STORE_AUDIO, 'readonly', (store) => reqToPromise(store.getAll()));
  return (rows || []).map((r) => ({ id: r.id, bytes: r.bytes, mime: r.mime }));
}

export async function clearAll() {
  await tx(STORE_SESSIONS, 'readwrite', (store) => reqToPromise(store.clear()));
  await tx(STORE_AUDIO, 'readwrite', (store) => reqToPromise(store.clear()));
}

// ---- File System Access handles (e.g. the cowork folder) ----

export async function getFsHandle(key) {
  return tx(STORE_FS, 'readonly', (store) => reqToPromise(store.get(key)));
}

export async function setFsHandle(key, handle) {
  return tx(STORE_FS, 'readwrite', (store) =>
    reqToPromise(handle == null ? store.delete(key) : store.put(handle, key)));
}
