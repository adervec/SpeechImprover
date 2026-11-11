// "Erase everything on this device" — removes ONLY SpeechImprover's own storage.
// Every app shares the adervec.github.io origin, so this never calls
// localStorage.clear(): it removes the `si.*` keys, deletes the `speechimprover`
// IndexedDB and the `si-` service-worker cache. Shared portal keys
// (portal-activity, portal-installed, maker-font) belong to the hub and stay.
// The Drive copy is not touched — the caller disconnects Drive first.

export const KEY_PREFIX = 'si.';
export const DB_NAME = 'speechimprover';
export const CACHE_PREFIX = 'si-';
// The shared cowork engine keeps this app's state under its own names.
export const EXACT_KEYS = ['cowork-state:speechimprover'];

export function ownKeys(storage) {
  const out = [];
  for (let i = 0; i < storage.length; i += 1) {
    const k = storage.key(i);
    if (k && (k.startsWith(KEY_PREFIX) || EXACT_KEYS.includes(k))) out.push(k);
  }
  return out;
}

// The cowork engine's remembered folder handle: our key in its shared "cowork-ui" DB.
export function dropCoworkFolder(idb = globalThis.indexedDB) {
  return new Promise((resolve) => {
    if (!idb) return resolve();
    const open = idb.open('cowork-ui', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('dirs');
    open.onerror = () => resolve();
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('dirs', 'readwrite');
      tx.objectStore('dirs').delete('speechimprover');
      tx.oncomplete = tx.onerror = () => { db.close(); resolve(); };
    };
  });
}

export async function eraseAllLocalData({ storage = globalThis.localStorage, deleteDb, cachesApi = globalThis.caches, dropFolder } = {}) {
  for (const k of ownKeys(storage)) storage.removeItem(k);
  if (deleteDb) await deleteDb();
  if (dropFolder) await dropFolder();
  if (cachesApi) {
    for (const name of await cachesApi.keys()) if (name.startsWith(CACHE_PREFIX)) await cachesApi.delete(name);
  }
}

// Self-check with fake storage / caches (npm test).
export async function demo() {
  const ok = (c, m) => { if (!c) throw new Error(m); };
  const map = new Map(Object.entries({
    'si.settings': '{}', 'si.drive.connected': '1', 'si.projects': '[]', 'cowork-state:speechimprover': '{}', 'cowork-state:tachyread': '{}', 'cowork-device': 'abc',
    'maker-font': 'serif', 'portal-activity': '[]', 'tr.settings': '{}', 'sim': 'not ours',
  }));
  const storage = {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => map.delete(k),
  };
  const cacheNames = new Set(['si-v1', 'tachyread-v3']);
  const cachesApi = { keys: async () => [...cacheNames], delete: async (n) => cacheNames.delete(n) };
  let dbDeleted = false;
  await eraseAllLocalData({ storage, cachesApi, deleteDb: async () => { dbDeleted = true; } });
  ok(![...map.keys()].some((k) => k.startsWith('si.')), 'all si.* keys gone');
  ok(!map.has('cowork-state:speechimprover'), 'our cowork engine state gone');
  ok(map.has('maker-font') && map.has('portal-activity') && map.has('tr.settings') && map.has('sim') && map.has('cowork-state:tachyread') && map.has('cowork-device'), "other apps' keys untouched");
  ok(dbDeleted, 'own IndexedDB deleted');
  ok(!cacheNames.has('si-v1') && cacheNames.has('tachyread-v3'), 'only our SW cache removed');
  return 'eraseAll.demo: ok';
}
