// Cloud sync through font.js's appFont.cloud (house standards 1 and 30): no Google code of
// our own. We sync what the JSON export moves (sessions without audio, profile, the one
// portable setting) as ONE file in the reader's private app folder. appFont.cloud.syncDoc
// reads the cloud copy first whenever it changed, merges (syncMerge.js), and writes only
// when the result differs and nobody wrote meanwhile.
// ponytail: polled while a tab is open, no push channel; audio blobs never leave the device.
/* eslint-disable react-refresh/only-export-components -- provider + its hook share this file. */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useStore } from './store.jsx';
import { getAllSessions, putSession, deleteSession as dbDeleteSession, deleteAudio } from './db.js';
import { mergeDocs, forSync } from './syncMerge.js';

const FILE_NAME = 'speechimprover-sync.json';
const POLL_MS = 45000;
const DEBOUNCE_MS = 2500;
const CONNECTED_KEY = 'si.drive.connected';
const PROFILE_TS_KEY = 'si.profileUpdatedAt';
const SETTINGS_TS_KEY = 'si.settingsUpdatedAt';
const TOMBSTONE_KEY = 'si.drive.tombstones';

const cloud = () => globalThis.window?.appFont?.cloud;
export const isConfigured = () => !!cloud()?.syncDoc;

function loadTombstones() {
  try { return JSON.parse(localStorage.getItem(TOMBSTONE_KEY)) || []; } catch { return []; }
}
function saveTombstones(ids) {
  try { localStorage.setItem(TOMBSTONE_KEY, JSON.stringify([...new Set(ids)])); } catch { /* full or blocked */ }
}

const DriveSyncContext = createContext(null);

export function DriveSyncProvider({ children }) {
  const { profile, settings, sessions, updateProfile, updateSettings, refresh } = useStore();
  const [connected, setConnected] = useState(() => localStorage.getItem(CONNECTED_KEY) === '1');
  const [status, setStatus] = useState('idle'); // idle | syncing | synced | error
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [error, setError] = useState(null);
  const [account, setAccount] = useState(() => window.appFont?.getAccount?.() || null);
  const syncingRef = useRef(false);
  const debounceRef = useRef(null);
  const prevIdsRef = useRef(null);

  const load = useCallback(async () => {
    const rows = await getAllSessions();
    return mergeDocs({
      sessions: rows.map(forSync),
      deletedSessionIds: loadTombstones(),
      profile,
      profileUpdatedAt: Number(localStorage.getItem(PROFILE_TS_KEY)) || 0,
      settings: { recognitionEnabled: settings.recognitionEnabled }, // the theme is the house picker's, per device
      settingsUpdatedAt: Number(localStorage.getItem(SETTINGS_TS_KEY)) || 0,
    }, { sessions: [] }); // normalise order and shape, so an unchanged copy compares equal
  }, [profile, settings]);

  // Keep the merged copy on this device. Audio fields are this device's own and stay.
  const save = useCallback(async (merged) => {
    const localById = new Map((await getAllSessions()).map((s) => [s.id, s]));
    const gone = new Set(merged.deletedSessionIds || []);
    for (const s of localById.values()) {
      if (!gone.has(s.id)) continue;
      if (s.audioId) await deleteAudio(s.audioId);
      await dbDeleteSession(s.id);
    }
    for (const s of merged.sessions || []) {
      const mine = localById.get(s.id);
      if (mine && JSON.stringify(forSync(mine)) === JSON.stringify(s)) continue;
      const audio = mine
        ? { audioId: mine.audioId ?? null, audioBytes: mine.audioBytes || 0, audioMime: mine.audioMime }
        : { audioId: null, audioBytes: 0 };
      await putSession({ ...s, ...audio });
    }
    if ((merged.profileUpdatedAt || 0) > (Number(localStorage.getItem(PROFILE_TS_KEY)) || 0) && merged.profile) {
      updateProfile(merged.profile);
      localStorage.setItem(PROFILE_TS_KEY, String(merged.profileUpdatedAt)); // keep the cloud's stamp, not "now"
    }
    if ((merged.settingsUpdatedAt || 0) > (Number(localStorage.getItem(SETTINGS_TS_KEY)) || 0) && merged.settings) {
      updateSettings({ recognitionEnabled: merged.settings.recognitionEnabled });
      localStorage.setItem(SETTINGS_TS_KEY, String(merged.settingsUpdatedAt));
    }
    saveTombstones(merged.deletedSessionIds || []);
    await refresh();
  }, [updateProfile, updateSettings, refresh]);

  const runSync = useCallback(async ({ interactive = false } = {}) => {
    const c = cloud();
    if (!isConfigured() || syncingRef.current) return;
    syncingRef.current = true;
    setStatus('syncing');
    setError(null);
    try {
      await c.signIn({ silent: !interactive });
      setAccount(window.appFont?.getAccount?.() || null);
      await c.syncDoc(FILE_NAME, { load, save, merge: mergeDocs });
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
  }, [load, save]);

  const connect = useCallback(() => runSync({ interactive: true }), [runSync]);

  const disconnect = useCallback(() => {
    cloud()?.signOut();
    setAccount(null);
    setConnected(false);
    setStatus('idle');
    setError(null);
    localStorage.removeItem(CONNECTED_KEY);
  }, []);

  // Latest runSync for the listeners below, so they are armed once per connection.
  const runRef = useRef(runSync);
  useEffect(() => { runRef.current = runSync; }, [runSync]);

  // On start (deferred a tick: no setState in the effect body), on focus, when the network
  // returns, and every POLL_MS while connected.
  useEffect(() => {
    if (!connected || !isConfigured()) return undefined;
    const go = () => runRef.current({ interactive: false });
    const first = setTimeout(go, 0);
    const poll = setInterval(go, POLL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') go(); };
    window.addEventListener('online', go);
    window.addEventListener('focus', go);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      window.removeEventListener('online', go);
      window.removeEventListener('focus', go);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [connected]);

  // Shortly after a local change; a removed session becomes a tombstone.
  useEffect(() => {
    if (!connected || !isConfigured()) return undefined;
    const ids = new Set(sessions.map((s) => s.id));
    if (prevIdsRef.current) {
      const removed = [...prevIdsRef.current].filter((id) => !ids.has(id));
      if (removed.length) saveTombstones([...loadTombstones(), ...removed]);
    }
    prevIdsRef.current = ids;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runRef.current({ interactive: false }), DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [connected, sessions, profile, settings]);

  const value = {
    configured: isConfigured(),
    label: cloud()?.label?.() || 'Google Drive',
    connected, account, status, lastSyncedAt, error,
    connect, disconnect,
    syncNow: () => runSync({ interactive: false }),
  };
  return <DriveSyncContext.Provider value={value}>{children}</DriveSyncContext.Provider>;
}

export function useDriveSync() {
  const ctx = useContext(DriveSyncContext);
  if (!ctx) throw new Error('useDriveSync must be used within DriveSyncProvider');
  return ctx;
}
