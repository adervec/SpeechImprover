// Mounts the shared cowork engine (https://adervec.github.io/cowork.js, fs mode,
// cowork v2) ONCE for the whole app, into a hidden holder, so its per-channel
// schedules and 5-minute reply checks keep running whichever page is open. The
// Cowork page borrows the panel element while it is shown (useCoworkPanel).
//
// The engine supplies the house-standard guarantees: one sync device runs the
// schedules, review-before-applying (default on, per channel), requestHash
// echo check, a ledger so a reply is never applied twice, processed/ archive,
// <channel>/reply-error.json reasons, a run history and undo.
/* eslint-disable react-refresh/only-export-components -- engine component + its hook. */

import { useEffect, useRef, useState } from 'react';
import { useStore } from './store.jsx';
import {
  buildManifest, buildCoworkDataset, buildCoachRequest, buildProgramRequest,
  COACH_INSTRUCTIONS, PROGRAM_INSTRUCTIONS, coachPreview, coachRecord, programPreview,
  programStepsFromAccepted, loadCoworkState, saveCoworkState,
} from './cowork.js';

export const COWORK_APP = 'speechimprover';
let panel = null; // the one <cowork-panel>, created on first mount
let holder = null; // hidden parking spot while no page shows it
const listeners = new Set(); // pages that re-read coach feedback after an apply/undo
const notify = () => listeners.forEach((fn) => fn());

function park() {
  if (!holder) {
    holder = document.createElement('div');
    holder.hidden = true;
    holder.id = 'cowork-engine-holder';
    document.body.appendChild(holder);
  }
  if (panel && panel.parentNode !== holder) holder.appendChild(panel);
}

function setCoach(coach) {
  saveCoworkState({ ...loadCoworkState(), coach });
  notify();
}

// Renders nothing; keeps the engine's callbacks pointed at the latest store data.
export function CoworkEngine() {
  const store = useStore();
  const live = useRef(store);
  useEffect(() => { live.current = store; });

  useEffect(() => {
    // cowork.js is a deferred script after the app module, so it may land a moment later.
    if (panel) return undefined;
    if (!window.cowork?.mount) {
      if (document.readyState === 'complete') return undefined; // never loaded (offline): manual flow only
      const retry = () => { if (window.cowork?.mount) mountEngine(live); };
      window.addEventListener('load', retry, { once: true });
      return () => window.removeEventListener('load', retry);
    }
    mountEngine(live);
    return undefined;
  }, []);
  return null;
}

function mountEngine(live) {
    if (panel) return;
    park();
    const dataset = () => buildCoworkDataset(live.current.sessions, live.current.profile);
    panel = window.cowork.mount(holder, {
      app: COWORK_APP,
      manifest: buildManifest(),
      files: (ch) => (ch === 'coach'
        ? { 'coach/INSTRUCTIONS.md': COACH_INSTRUCTIONS, 'coach/request.json': buildCoachRequest(dataset()) }
        : { 'program/INSTRUCTIONS.md': PROGRAM_INSTRUCTIONS, 'program/request.json': buildProgramRequest(dataset()) }),
      channels: {
        coach: {
          label: 'Coach feedback',
          schedule: 'off',
          review: true,
          preview: coachPreview,
          apply: (reply, accepted) => {
            if (accepted && !accepted.includes('coach')) return { summary: 'coach feedback not taken' };
            const prev = loadCoworkState().coach || null;
            setCoach(coachRecord(reply));
            return { summary: 'new coach feedback shown', undo: { prev } };
          },
          undo: (data) => setCoach(data?.prev || null),
        },
        program: {
          label: 'Daily program',
          schedule: 'off',
          review: true,
          preview: programPreview,
          apply: (reply, accepted) => {
            const steps = programStepsFromAccepted(reply, accepted);
            if (!steps.length) return { summary: 'no exercises taken — program unchanged' };
            const prev = live.current.program || null;
            const focus = (dataset().focusAreas || []).map((f) => f.attribute);
            live.current.startProgram(steps, focus);
            return { summary: `${steps.length}-step daily program started`, undo: { prev } };
          },
          undo: (data) => live.current.restoreProgram(data?.prev || null),
        },
      },
    });
}

// The Cowork page: show the shared panel inside `hostRef` while mounted, and
// re-render when an apply/undo changes the coach feedback. Returns [ready, coach].
export function useCoworkPanel(hostRef) {
  const [coach, setCoachState] = useState(() => loadCoworkState().coach);
  const [ready, setReady] = useState(() => !!panel);
  useEffect(() => {
    const sync = () => setCoachState(loadCoworkState().coach);
    listeners.add(sync);
    let t = null;
    const attach = () => {
      if (panel && hostRef.current) { hostRef.current.appendChild(panel); setReady(true); return true; }
      return false;
    };
    t = setInterval(() => { if (attach()) clearInterval(t); }, 50); // deferred (no setState in the effect body); engine may mount a tick later
    return () => { listeners.delete(sync); clearInterval(t); if (panel) park(); };
  }, [hostRef]);
  return [ready, coach];
}

// Manual flow (no folder): apply a pasted reply directly — the speaker already chose it.
export { setCoach as applyCoachRecord };
