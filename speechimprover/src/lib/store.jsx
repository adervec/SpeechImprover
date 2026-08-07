// App-wide state: sessions (IndexedDB), profile + settings (localStorage).
// The record only ever contains the user's own recordings — there is no sample
// or seed data, and any left over from older versions is purged on load.
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
import { uid } from './format.js';

const PROFILE_KEY = 'si.profile';
const SETTINGS_KEY = 'si.settings';
const PROGRAM_KEY = 'si.program';
const MASTERY_KEY = 'si.mastery';
const PROJECTS_KEY = 'si.projects';

const DEFAULT_PROFILE = {
  name: '',
  dob: '',
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

function loadMastery() {
  try {
    const raw = localStorage.getItem(MASTERY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadProjects() {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProjects(list) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
  } catch {
    /* quota / private mode */
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [profile, setProfile] = useState(() => loadLocal(PROFILE_KEY, DEFAULT_PROFILE));
  const [settings, setSettings] = useState(() => loadLocal(SETTINGS_KEY, DEFAULT_SETTINGS));
  const [program, setProgram] = useState(loadProgram);
  const [masteryProgress, setMasteryProgress] = useState(loadMastery);
  const [projects, setProjects] = useState(loadProjects);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState(null);

  // Initial load. One-time cleanup: purge any sample/seed sessions left over
  // from older versions so the record only ever holds the user's own recordings.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let rows = await getAllSessions();
        const seeds = rows.filter((s) => s.seed);
        if (seeds.length) {
          for (const s of seeds) {
            if (s.audioId) await deleteAudio(s.audioId);
            await dbDeleteSession(s.id);
          }
          rows = rows.filter((s) => !s.seed);
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
  }, []);

  function persistProfile(next) {
    setProfile(next);
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      localStorage.setItem('si.profileUpdatedAt', String(Date.now())); // for Drive sync LWW
    } catch {
      /* quota / private mode */
    }
  }
  function persistSettings(next) {
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      localStorage.setItem('si.settingsUpdatedAt', String(Date.now())); // for Drive sync LWW
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

  // ---- projects (named containers for recordings, e.g. reading a whole book) ----
  const createProject = useCallback((data = {}) => {
    const p = {
      id: uid(),
      name: (data.name || 'Untitled project').trim(),
      notes: data.notes || '',
      text: data.text || '', // optional full work; when present, read in passages
      passageIndex: 0,
      createdAt: new Date().toISOString(),
    };
    setProjects((prev) => {
      const next = [p, ...prev];
      saveProjects(next);
      return next;
    });
    return p;
  }, []);

  const updateProject = useCallback((id, patch) => {
    setProjects((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, ...patch } : x));
      saveProjects(next);
      return next;
    });
  }, []);

  const deleteProject = useCallback((id) => {
    // Sessions keep their projectId (harmlessly dangling); only the container goes.
    setProjects((prev) => {
      const next = prev.filter((x) => x.id !== id);
      saveProjects(next);
      return next;
    });
  }, []);

  // ---- vocal-mastery track (persisted per-stage best score + matched flag) ----
  function persistMastery(next) {
    setMasteryProgress(next);
    try {
      localStorage.setItem(MASTERY_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const recordTechniqueResult = useCallback((techId, stageId, { score = null, matched = false } = {}) => {
    setMasteryProgress((prev) => {
      const cur = prev || {};
      const tech = cur[techId] || { stages: {} };
      const stages = tech.stages || {};
      const old = stages[stageId] || { attempts: 0, best: null, matched: false };
      const best = score == null ? old.best : old.best == null ? score : Math.max(old.best, score);
      const nextStage = {
        attempts: (old.attempts || 0) + 1,
        best,
        matched: old.matched || matched,
        lastAt: new Date().toISOString(),
      };
      const next = { ...cur, [techId]: { ...tech, stages: { ...stages, [stageId]: nextStage } } };
      try {
        localStorage.setItem(MASTERY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const resetMastery = useCallback(() => {
    persistMastery({});
  }, []);

  // Add a finished session (optionally with an audio blob).
  const addSession = useCallback(async (session, blob, mime) => {
    const record = {
      id: uid(),
      createdAt: new Date().toISOString(),
      audioId: null,
      audioMime: null,
      audioBytes: 0,
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
    let blob = null;
    if (s?.audioId) {
      const rec = await getAudio(s.audioId); // grab the blob first so a delete is undoable
      blob = rec?.blob || null;
      await deleteAudio(s.audioId);
    }
    await dbDeleteSession(id);
    setSessions((prev) => prev.filter((x) => x.id !== id));
    return s ? { record: s, blob, mime: s.audioMime } : null;
  }, [sessions]);

  // Re-insert a removed session (with its audio) — powers the Undo toast.
  const restoreSession = useCallback(async (record, blob, mime) => {
    if (!record) return;
    if (blob && record.audioId) await putAudio(record.audioId, blob, mime || record.audioMime || blob.type);
    await putSession(record);
    setSessions((prev) => (prev.some((x) => x.id === record.id)
      ? prev
      : [record, ...prev].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))));
  }, []);

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

  const resetAllData = useCallback(async () => {
    await clearAll();
    setSessions([]);
    persistProgram(null);
  }, []);

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
      masteryProgress,
      projects,
      updateProfile,
      updateSettings,
      startProgram,
      completeProgramStep,
      clearProgram,
      createProject,
      updateProject,
      deleteProject,
      recordTechniqueResult,
      resetMastery,
      addSession,
      updateSession,
      removeSession,
      restoreSession,
      purgeAudio,
      purgeAllAudio,
      resetAllData,
      rescoreAll,
      refresh,
      getAudioBlob,
    }),
    [
      loading, storageError, sessions, profile, settings, program, masteryProgress, projects,
      updateProfile, updateSettings, startProgram, completeProgramStep, clearProgram,
      createProject, updateProject, deleteProject,
      recordTechniqueResult, resetMastery, addSession,
      updateSession, removeSession, restoreSession, purgeAudio, purgeAllAudio,
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
