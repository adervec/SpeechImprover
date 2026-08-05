// Google Drive auto two-way sync. 100% client-side: Google Identity Services
// token client + the Drive REST API against the hidden `appDataFolder` — no
// backend, no SDK, no npm dependency. We sync the SAME data the JSON export
// moves: sessions (metadata only) + profile + portable settings. One file:
// `speechimprover-sync.json` in the user's own Drive app-data folder.
//
// Merge model (see mergeDocs):
//   sessions : union by id; local wins on the (uid-unique → near-impossible) collision.
//   deletes  : tombstones, unioned, so a delete propagates instead of resurrecting.
//   profile  : last-write-wins by timestamp.
//   settings : last-write-wins, but ONLY theme + recognitionEnabled — device IDs
//              are per-machine and must never sync.
//
// ponytail: union + last-write-wins, no CRDT. Audio blobs are NOT synced (bulky);
//   upgrade path = one Drive file per blob. Remote changes are polled, not pushed;
//   upgrade path = Drive changes.watch (needs a backend webhook). Background sync
//   only runs while a tab is open — there is no backend to sync when closed.
/* eslint-disable react-refresh/only-export-components -- provider + its hook/helpers share this file. */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useStore } from './store.jsx';
import {
  getAllSessions, putSession, getAudio,
  deleteSession as dbDeleteSession, deleteAudio,
} from './db.js';

// Google OAuth authorizes by ORIGIN, not path — so one client id registered for
// https://adervec.github.io covers every Pages app under it (GymTracker, Tachyread,
// SpeechImprover, …). This is that shared client id (an identifier, not a secret; it
// only works from its registered origins). Result: Drive sync needs zero per-app setup
// on the authorized site. A fork elsewhere supplies its own via VITE_GOOGLE_CLIENT_ID.
const BUILTIN_CLIENT_ID = '547617739897-br6dj2facmsc34qnkjb5u4dbfhju39pu.apps.googleusercontent.com';
const OAUTH_ORIGINS = ['https://adervec.github.io'];
function originAllowed() {
  try {
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return true; // local dev
    return OAUTH_ORIGINS.includes(location.origin);
  } catch { return false; }
}
// A user-supplied id (fork/self-host) wins; otherwise the built-in id on an authorized
// origin; otherwise empty → Drive sync stays off (a fork without its own id).
const CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim() ||
  (originAllowed() ? BUILTIN_CLIENT_ID : '');
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'speechimprover-sync.json';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const POLL_MS = 45000; // pull other devices' changes while the tab is open
const DEBOUNCE_MS = 2500; // coalesce local edits before pushing
const CONNECTED_KEY = 'si.drive.connected';
const PROFILE_TS_KEY = 'si.profileUpdatedAt';
const SETTINGS_TS_KEY = 'si.settingsUpdatedAt';
const TOMBSTONE_KEY = 'si.drive.tombstones';

export function isConfigured() {
  return !!CLIENT_ID;
}

// ---- pure merge (the only non-trivial logic; self-checked in demo() below) ----
export function mergeDocs(local, remote) {
  if (!remote) return { ...local };
  const deleted = new Set([
    ...(local.deletedSessionIds || []),
    ...(remote.deletedSessionIds || []),
  ]);
  const byId = new Map();
  for (const s of remote.sessions || []) byId.set(s.id, s);
  for (const s of local.sessions || []) byId.set(s.id, s); // local wins on collision
  const sessions = [...byId.values()]
    .filter((s) => !deleted.has(s.id))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const profileNewer = (local.profileUpdatedAt || 0) >= (remote.profileUpdatedAt || 0);
  const settingsNewer = (local.settingsUpdatedAt || 0) >= (remote.settingsUpdatedAt || 0);
  return {
    app: 'speechimprover',
    kind: 'sync',
    version: 1,
    sessions,
    deletedSessionIds: [...deleted],
    profile: profileNewer ? local.profile : remote.profile,
    profileUpdatedAt: Math.max(local.profileUpdatedAt || 0, remote.profileUpdatedAt || 0),
    settings: settingsNewer ? local.settings : remote.settings,
    settingsUpdatedAt: Math.max(local.settingsUpdatedAt || 0, remote.settingsUpdatedAt || 0),
  };
}

// ---- Google Identity Services token client ----
let tokenClient = null;
let accessToken = null;
let tokenExpiry = 0;

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google sign-in.')));
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google sign-in.'));
    document.head.appendChild(s);
  });
}

async function ensureTokenClient() {
  await loadGis();
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: () => {},
    });
  }
  return tokenClient;
}

function requestToken({ interactive }) {
  return new Promise((resolve, reject) => {
    ensureTokenClient()
      .then((tc) => {
        tc.callback = (resp) => {
          if (resp.error) return reject(new Error(resp.error));
          accessToken = resp.access_token;
          tokenExpiry = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000; // refresh 1min early
          resolve(accessToken);
        };
        // prompt:'' = silent (only works once the user has granted before);
        // prompt:'consent' forces the interactive grant on first connect.
        tc.requestAccessToken({ prompt: interactive ? 'consent' : '' });
      })
      .catch(reject);
  });
}

async function getToken({ interactive = false } = {}) {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  return requestToken({ interactive });
}

// ---- Drive REST (fetch, no gapi) ----
async function api(url, opts = {}, retry = true) {
  const token = await getToken();
  const resp = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (resp.status === 401 && retry) {
    accessToken = null; // force a refresh and retry once
    await getToken({ interactive: false });
    return api(url, opts, false);
  }
  if (!resp.ok) throw new Error(`Drive error ${resp.status}`);
  return resp;
}

async function findFileId() {
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const resp = await api(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id)&q=${q}`
  );
  const data = await resp.json();
  return data.files?.[0]?.id || null;
}

async function readRemote() {
  const id = await findFileId();
  if (!id) return null;
  const resp = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
  const text = await resp.text();
  try {
    return { id, doc: JSON.parse(text) };
  } catch {
    return { id, doc: null }; // corrupt remote → treat as empty, never lose local
  }
}

async function writeRemote(id, doc) {
  let fileId = id;
  if (!fileId) {
    const created = await api('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] }),
    });
    fileId = (await created.json()).id;
  }
  await api(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });
  return fileId;
}

// ---- tombstones (persisted locally) ----
function loadTombstones() {
  try {
    return JSON.parse(localStorage.getItem(TOMBSTONE_KEY)) || [];
  } catch {
    return [];
  }
}
function saveTombstones(ids) {
  try {
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* ignore */
  }
}

// ---- React glue ----
const DriveSyncContext = createContext(null);

export function DriveSyncProvider({ children }) {
  const { profile, settings, updateProfile, updateSettings, refresh } = useStore();
  const sessions = useStore().sessions;
  const [connected, setConnected] = useState(() => localStorage.getItem(CONNECTED_KEY) === '1');
  const [status, setStatus] = useState('idle'); // idle | syncing | synced | error
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [error, setError] = useState(null);
  const syncingRef = useRef(false);
  const debounceRef = useRef(null);
  const prevIdsRef = useRef(null);

  const buildLocalDoc = useCallback(async () => {
    const rows = await getAllSessions();
    return {
      app: 'speechimprover',
      kind: 'sync',
      version: 1,
      sessions: rows,
      deletedSessionIds: loadTombstones(),
      profile,
      profileUpdatedAt: Number(localStorage.getItem(PROFILE_TS_KEY)) || 0,
      settings: { theme: settings.theme, recognitionEnabled: settings.recognitionEnabled },
      settingsUpdatedAt: Number(localStorage.getItem(SETTINGS_TS_KEY)) || 0,
    };
  }, [profile, settings]);

  const applyMerged = useCallback(
    async (merged) => {
      const localRows = await getAllSessions();
      const localById = new Map(localRows.map((s) => [s.id, s]));
      const deleted = new Set(merged.deletedSessionIds || []);

      for (const s of localRows) {
        if (deleted.has(s.id)) {
          if (s.audioId) await deleteAudio(s.audioId);
          await dbDeleteSession(s.id);
        }
      }
      for (const s of merged.sessions || []) {
        if (localById.has(s.id)) continue; // local already has it (local wins)
        // arriving from another device: its audio blob isn't synced — drop the
        // dangling reference so playback UI degrades gracefully (same as import).
        const hasBlob = s.audioId ? !!(await getAudio(s.audioId)) : false;
        await putSession({ ...s, audioId: hasBlob ? s.audioId : null, audioBytes: hasBlob ? s.audioBytes : 0 });
      }

      const localProfileTs = Number(localStorage.getItem(PROFILE_TS_KEY)) || 0;
      if ((merged.profileUpdatedAt || 0) > localProfileTs && merged.profile) {
        updateProfile(merged.profile);
        localStorage.setItem(PROFILE_TS_KEY, String(merged.profileUpdatedAt)); // keep remote stamp, not "now"
      }
      const localSettingsTs = Number(localStorage.getItem(SETTINGS_TS_KEY)) || 0;
      if ((merged.settingsUpdatedAt || 0) > localSettingsTs && merged.settings) {
        updateSettings({
          theme: merged.settings.theme,
          recognitionEnabled: merged.settings.recognitionEnabled,
        });
        localStorage.setItem(SETTINGS_TS_KEY, String(merged.settingsUpdatedAt));
      }

      saveTombstones(merged.deletedSessionIds || []);
      await refresh();
    },
    [updateProfile, updateSettings, refresh]
  );

  const runSync = useCallback(
    async ({ interactive = false } = {}) => {
      if (!isConfigured() || syncingRef.current) return;
      syncingRef.current = true;
      setStatus('syncing');
      setError(null);
      try {
        await getToken({ interactive });
        const remote = await readRemote();
        const local = await buildLocalDoc();
        const merged = mergeDocs(local, remote?.doc || null);
        merged.exportedAt = new Date().toISOString();
        await applyMerged(merged);
        await writeRemote(remote?.id || null, merged);
        setLastSyncedAt(Date.now());
        setStatus('synced');
        setConnected(true);
        localStorage.setItem(CONNECTED_KEY, '1');
      } catch (e) {
        setError(e.message || String(e));
        setStatus('error');
      } finally {
        syncingRef.current = false;
      }
    },
    [buildLocalDoc, applyMerged]
  );

  const connect = useCallback(() => runSync({ interactive: true }), [runSync]);

  const disconnect = useCallback(() => {
    if (accessToken && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(accessToken);
      } catch {
        /* ignore */
      }
    }
    accessToken = null;
    tokenExpiry = 0;
    setConnected(false);
    setStatus('idle');
    setError(null);
    localStorage.removeItem(CONNECTED_KEY);
  }, []);

  // Auto-resume a previously-connected session once on load (silent token).
  // Deferred a tick so the first sync's setState doesn't fire synchronously in
  // the effect body (avoids cascading renders / the set-state-in-effect rule).
  useEffect(() => {
    const t = setTimeout(() => {
      if (connected && isConfigured()) runSync({ interactive: false });
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for other devices' changes while connected.
  useEffect(() => {
    if (!connected || !isConfigured()) return undefined;
    const t = setInterval(() => runSync({ interactive: false }), POLL_MS);
    return () => clearInterval(t);
  }, [connected, runSync]);

  // Debounced push on any local change; diff session ids to record deletes.
  useEffect(() => {
    if (!connected || !isConfigured()) return undefined;
    const ids = new Set(sessions.map((s) => s.id));
    if (prevIdsRef.current) {
      const removed = [...prevIdsRef.current].filter((id) => !ids.has(id));
      if (removed.length) saveTombstones([...loadTombstones(), ...removed]);
    }
    prevIdsRef.current = ids;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSync({ interactive: false }), DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [connected, sessions, profile, settings, runSync]);

  const value = {
    configured: isConfigured(),
    connected,
    status,
    lastSyncedAt,
    error,
    connect,
    disconnect,
    syncNow: () => runSync({ interactive: false }),
  };
  return <DriveSyncContext.Provider value={value}>{children}</DriveSyncContext.Provider>;
}

export function useDriveSync() {
  const ctx = useContext(DriveSyncContext);
  if (!ctx) throw new Error('useDriveSync must be used within DriveSyncProvider');
  return ctx;
}

// Runnable self-check for the merge (the only tricky logic). Call from a console:
//   import('./lib/driveSync.jsx').then(m => m.demo())
export function demo() {
  const A = {
    sessions: [{ id: '1', createdAt: '2026-01-01' }],
    deletedSessionIds: [],
    profile: { name: 'A' }, profileUpdatedAt: 10,
    settings: { theme: 'aurora' }, settingsUpdatedAt: 10,
  };
  const B = {
    sessions: [{ id: '2', createdAt: '2026-01-02' }],
    deletedSessionIds: ['1'],
    profile: { name: 'B' }, profileUpdatedAt: 20,
    settings: { theme: 'ember' }, settingsUpdatedAt: 5,
  };
  const m = mergeDocs(A, B);
  console.assert(m.sessions.length === 1 && m.sessions[0].id === '2', 'tombstone drops 1, keeps 2');
  console.assert(m.profile.name === 'B', 'newer profile (B) wins LWW');
  console.assert(m.settings.theme === 'aurora', 'newer settings (A) wins LWW');
  console.assert(mergeDocs(A, null).sessions[0].id === '1', 'no remote → local unchanged');
  return 'driveSync.demo: ok';
}
