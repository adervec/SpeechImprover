// App-wide state: sessions (IndexedDB), profile + settings (localStorage).
// Seeds historical sample sessions on first run.
/* eslint-disable react-refresh/only-export-components -- context provider + its hook. */

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  getAllSessions,
  getSession,
  putSession,
  deleteSession as dbDeleteSession,
  putAudio,
  getAudio,
  deleteAudio,
  clearAll,
} from './db.js';
import { rescore } from './analysis/index.js';
import { buildSeedSessions } from './sampleData.js';
import { uid } from './format.js';

const PROFILE_KEY = 'si.profile';
const SETTINGS_KEY = 'si.settings';
const PROGRAM_KEY = 'si.program';

const DEFAULT_PROFILE = {
  name: '',
  age: '',
  gender: '',
  nativeLanguage: 'English',
  countryOfBirth: '',
  targets: [],
  notes: '',
};

const DEFAULT_SETTINGS = {
  theme: 'aurora',
  inputDeviceId: '',
  outputDeviceId: '',
  recognitionEnabled: true,
  seededOnce: false,
};

function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function loadProgram() {
  try {
    const raw = localStorage.getItem(PROGRAM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [profile, setProfile] = useState(() => loadLocal(PROFILE_KEY, DEFAULT_PROFILE));
  const [settings, setSettings] = useState(() => loadLocal(SETTINGS_KEY, DEFAULT_SETTINGS));
  const [program, setProgram] = useState(loadProgram);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState(null);

  // Initial load (+ seed on first run).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let rows = await getAllSessions();
        if (!settings.seededOnce && rows.length === 0) {
          const seeds = buildSeedSessions(profile);
          for (const s of seeds) await putSession(s);
          rows = await getAllSessions();
          persistSettings({ ...settings, seededOnce: true });
        }
        if (!cancelled) setSessions(rows);
      } catch (e) {
        if (!cancelled) setStorageError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount; profile/settings are read as initial values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistProfile(next) {
    setProfile(next);
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    } catch {
      /* quota / private mode */
    }
  }
  function persistSettings(next) {
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  function persistProgram(next) {
    setProgram(next);
    try {
      if (next) localStorage.setItem(PROGRAM_KEY, JSON.stringify(next));
      else localStorage.removeItem(PROGRAM_KEY);
    } catch {
      /* ignore */
    }
  }

  const updateProfile = useCallback((patch) => {
    persistProfile({ ...loadLocal(PROFILE_KEY, DEFAULT_PROFILE), ...patch });
  }, []);

  const updateSettings = useCallback((patch) => {
    persistSettings({ ...loadLocal(SETTINGS_KEY, DEFAULT_SETTINGS), ...patch });
  }, []);

  // ---- daily program (persisted, with per-step completion) ----
  const startProgram = useCallback((steps, targets = []) => {
    const prog = {
      id: uid(),
      createdAt: new Date().toISOString(),
      targets,
      steps: (steps || []).map((ex) => ({ exercise: ex, status: 'pending', sessionId: null })),
    };
    persistProgram(prog);
    return prog;
  }, []);

  const completeProgramStep = useCallback((index, sessionId) => {
    setProgram((prev) => {
      if (!prev || !prev.steps[index]) return prev;
      const steps = prev.steps.map((s, i) => (i === index ? { ...s, status: 'done', sessionId } : s));
      const next = { ...prev, steps };
      try {
        localStorage.setItem(PROGRAM_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const clearProgram = useCallback(() => {
    persistProgram(null);
  }, []);

  // Add a finished session (optionally with an audio blob).
  const addSession = useCallback(async (session, blob, mime) => {
    const record = {
      id: uid(),
      createdAt: new Date().toISOString(),
      audioId: null,
      audioMime: null,
      audioBytes: 0,
      seed: false,
      ...session,
    };
    if (blob) {
      const audioId = `A-${record.id}`;
      await putAudio(audioId, blob, mime || blob.type);
      record.audioId = audioId;
      record.audioMime = mime || blob.type;
      record.audioBytes = blob.size;
    }
    await putSession(record);
    setSessions((prev) => [record, ...prev].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    return record;
  }, []);

  const updateSession = useCallback(async (id, patch) => {
    let next = null;
    setSessions((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        next = { ...x, ...patch };
        return next;
      })
    );
    if (next) await putSession(next);
    else {
      const existing = await getSession(id);
      if (existing) await putSession({ ...existing, ...patch });
    }
  }, []);

  const removeSession = useCallback(async (id) => {
    const s = sessions.find((x) => x.id === id);
    if (s?.audioId) await deleteAudio(s.audioId);
    await dbDeleteSession(id);
    setSessions((prev) => prev.filter((x) => x.id !== id));
  }, [sessions]);

  const purgeAudio = useCallback(async (id) => {
    const s = sessions.find((x) => x.id === id);
    if (!s?.audioId) return;
    await deleteAudio(s.audioId);
    const next = { ...s, audioId: null, audioBytes: 0 };
    await putSession(next);
    setSessions((prev) => prev.map((x) => (x.id === id ? next : x)));
  }, [sessions]);

  const purgeAllAudio = useCallback(async () => {
    const withAudio = sessions.filter((s) => s.audioId);
    for (const s of withAudio) {
      await deleteAudio(s.audioId);
      await putSession({ ...s, audioId: null, audioBytes: 0 });
    }
    setSessions((prev) => prev.map((x) => (x.audioId ? { ...x, audioId: null, audioBytes: 0 } : x)));
  }, [sessions]);

  const clearSeedData = useCallback(async () => {
    const seeds = sessions.filter((s) => s.seed);
    for (const s of seeds) {
      if (s.audioId) await deleteAudio(s.audioId);
      await dbDeleteSession(s.id);
    }
    setSessions((prev) => prev.filter((x) => !x.seed));
  }, [sessions]);

  const resetAllData = useCallback(async () => {
    await clearAll();
    setSessions([]);
    persistProgram(null);
    persistSettings({ ...settings, seededOnce: true });
  }, [settings]);

  // Recompute scores for all sessions (e.g. after a profile change that affects
  // reference-relative attributes like resonant depth).
  const rescoreAll = useCallback(async (nextProfile) => {
    const updated = [];
    for (const s of sessions) {
      if (!s.metrics) {
        updated.push(s);
        continue;
      }
      const { scores, overall, distances } = rescore(s.metrics, nextProfile);
      const next = { ...s, scores, overall, distances };
      await putSession(next);
      updated.push(next);
    }
    setSessions(updated.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
  }, [sessions]);

  const refresh = useCallback(async () => {
    const rows = await getAllSessions();
    setSessions(rows);
  }, []);

  const getAudioBlob = useCallback(async (audioId) => {
    if (!audioId) return null;
    const rec = await getAudio(audioId);
    return rec?.blob || null;
  }, []);

  const value = useMemo(
    () => ({
      loading,
      storageError,
      sessions,
      profile,
      settings,
      program,
      updateProfile,
      updateSettings,
      startProgram,
      completeProgramStep,
      clearProgram,
      addSession,
      updateSession,
      removeSession,
      purgeAudio,
      purgeAllAudio,
      clearSeedData,
      resetAllData,
      rescoreAll,
      refresh,
      getAudioBlob,
    }),
    [
      loading, storageError, sessions, profile, settings, program, updateProfile,
      updateSettings, startProgram, completeProgramStep, clearProgram, addSession,
      updateSession, removeSession, purgeAudio, purgeAllAudio, clearSeedData,
      resetAllData, rescoreAll, refresh, getAudioBlob,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
