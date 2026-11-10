import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { useRecorder } from '../lib/recorderContext.jsx';
import { useToast } from '../components/ui.jsx';
import SessionReport from '../components/SessionReport.jsx';
import ArticulationModel from '../components/ArticulationModel.jsx';
import RecordingAudio from '../components/RecordingAudio.jsx';
import LiveFeedback from '../components/LiveFeedback.jsx';
import LiveWave from '../components/LiveWave.jsx';
import EmotiveText, { EmotiveToggle } from '../components/EmotiveText.jsx';
import ReadingProgress from '../components/ReadingProgress.jsx';
import { stripTags } from '../lib/emotive.js';
import { analyzeTranscript, readingCoverage } from '../lib/analysis/speechMetrics.js';
import { analyzeRecording, assessCompletion } from '../lib/analysis/index.js';
import { ATTRIBUTE_MAP } from '../lib/analysis/attributes.js';
import {
  getExercise,
  READING_LIBRARY,
  PASSAGE_GROUPS,
  passageLabel,
  FREE_PROMPTS,
  INTERVIEW_PROMPTS,
  suggestNextExercise,
  withFreshVariant,
  freshPrompt,
  recencyIndex,
  partitionSeen,
  leastRecent,
} from '../lib/exercises.js';
import { weakestAttributes, computeStreak, groupIntoSessions } from '../lib/aggregate.js';
import { annotateTranscript } from '../lib/analysis/transcriptAnnotate.js';
import { getTechniqueExercise, evaluateStage } from '../lib/vocalMastery.js';
import { splitIntoPassages } from '../lib/passages.js';
import { formatDuration } from '../lib/format.js';
import { isTTSSupported, speak, cancelTTS, prepareText } from '../lib/tts.js';

const TALK_LENGTHS = [30, 60, 90, 120, 180];

// Toastmasters-style light: neutral until 75% of the target, then green,
// yellow once you hit it, red 15% over.
function timerZone(elapsedSec, targetSec) {
  const r = elapsedSec / targetSec;
  if (r >= 1.15) return { tone: 'bad', label: 'over time — finish now' };
  if (r >= 1) return { tone: 'warn', label: 'wrap up' };
  if (r >= 0.75) return { tone: 'good', label: 'in the zone' };
  return { tone: null, label: 'keep going' };
}

// Same word count ReadingProgress uses, so a TTS char offset maps to its word index.
const wordsBefore = (text) => text.toLowerCase().replace(/[^a-z'\s]/g, ' ').split(/\s+/).filter(Boolean).length;

const MODE_LABELS = {
  read: 'Read provided text',
  free: 'Free / improv speaking',
  twister: 'Articulation drill',
  breath: 'Warm-up',
  sustain: 'Sustained tone',
};

// Target tone/emotion presets for free speaking. Each maps to attributes the
// analysis engine already scores — a target delivery *style*, scored the normal
// way (SessionReport focuses on these).
// ponytail: attribute-emphasis presets, not an ML emotion classifier — add one
// only if per-emotion detection is actually needed.
const TONE_TARGETS = [
  { id: 'natural', emoji: '💬', label: 'Natural / conversational', attrs: ['fillers', 'nonRepetition', 'pace', 'clarity'], hint: 'Relaxed and clear, like talking to a friend.' },
  { id: 'energetic', emoji: '⚡', label: 'Energetic / excited', attrs: ['expressiveness', 'pace', 'projection'], hint: 'Lively pitch and pace, strong projection.' },
  { id: 'calm', emoji: '🌿', label: 'Calm / authoritative', attrs: ['resonantDepth', 'noUptalk', 'projection', 'breath'], hint: 'Grounded, unhurried, statements that land.' },
  { id: 'warm', emoji: '☀️', label: 'Warm / friendly', attrs: ['expressiveness', 'nonNasal', 'noUptalk'], hint: 'Open, approachable, gently varied tone.' },
  { id: 'persuasive', emoji: '🎯', label: 'Persuasive / confident', attrs: ['projection', 'noUptalk', 'clarity', 'pace'], hint: 'Firm, clear, no uptalk — carry the room.' },
];

function buildCustomExercise(mode, prompt, passageId, tone, targetSec = 90) {
  if (mode === 'free') {
    const t = tone || TONE_TARGETS[0];
    return {
      id: passageId || `custom-free-${t.id}`,
      title: `Free speaking · ${t.label}`,
      category: 'Custom',
      mode: 'free',
      durationSec: targetSec,
      targetAttributes: t.attrs,
      instructions: `Speak unscripted in a ${t.label.toLowerCase()} style — ${t.hint} Replace fillers with brief pauses.`,
      prompt,
      tone: t.id,
      type: 'free',
    };
  }
  return {
    id: passageId || `custom-${mode}`,
    title: 'Read aloud (custom)',
    category: 'Custom',
    mode,
    durationSec: 60,
    targetAttributes: ['pace', 'clarity', 'projection', 'noUptalk'],
    instructions: 'Read the text below at a deliberate, even pace. Pause at punctuation.',
    prompt,
    type: mode,
  };
}

export default function Practice({ route, navigate }) {
  const { profile, settings, updateSettings, sessions, addSession, updateSession, program, completeProgramStep, recordTechniqueResult, projects, updateProject } = useStore();
  const recorder = useRecorder();
  const toast = useToast();

  // Program context (a step of the persisted daily program).
  const inProgramMode = route.query.program === '1';
  const programStepIndex =
    inProgramMode && route.query.step != null && route.query.step !== ''
      ? parseInt(route.query.step, 10)
      : -1;
  const programStep = programStepIndex >= 0 && program?.steps ? program.steps[programStepIndex] : null;

  // Resolve the exercise: from the program step, else from the URL exercise id.
  const queryExerciseId = route.query.exercise;
  const techniqueId = route.query.technique;
  const queryExercise = programStep
    ? programStep.exercise
    : techniqueId
      ? getTechniqueExercise(techniqueId, route.query.stage ? parseInt(route.query.stage, 10) : 0)
      : queryExerciseId
        ? withFreshVariant(getExercise(queryExerciseId), sessions) || null
        : null;

  const [phase, setPhase] = useState('setup'); // setup | recording | analyzing | result
  const [chooserMode, setChooserMode] = useState(queryExercise ? queryExercise.mode : 'free');
  const [customText, setCustomText] = useState('');
  // Provided-text pickers: never-used first, already-used sink to a final group.
  const recency = useMemo(() => recencyIndex(sessions), [sessions]);
  const passagePick = useMemo(() => {
    const all = partitionSeen(READING_LIBRARY, recency);
    const groups = PASSAGE_GROUPS.map((g) => ({ ...g, items: partitionSeen(g.items, recency).fresh })).filter((g) => g.items.length);
    return { ...all, groups };
  }, [recency]);
  const promptPick = useMemo(() => {
    const id = (s) => s;
    const free = partitionSeen(FREE_PROMPTS, recency, id, () => null);
    const interview = partitionSeen(INTERVIEW_PROMPTS, recency, id, () => null);
    return { free: free.fresh, interview: interview.fresh, seen: [...free.seen, ...interview.seen].sort((a, b) => free.seenAt(a) - free.seenAt(b)), seenAt: free.seenAt };
  }, [recency]);
  const seenLabel = (t) => `✓ read ${new Date(t).toLocaleDateString()}`;
  const [selectedPassage, setSelectedPassage] = useState(() => (passagePick.fresh[0] || READING_LIBRARY[0]).id);
  const [freePrompt, setFreePrompt] = useState(() => freshPrompt(FREE_PROMPTS, sessions));
  const [freeTone, setFreeTone] = useState(TONE_TARGETS[0]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(route.query.project || '');
  const [exercise, setExercise] = useState(queryExercise);
  // "Just speak" (?quick=1): free speaking with the setup folded away, counting in straight away.
  const quick = route.query.quick === '1' && !queryExercise;
  const [showSetup, setShowSetup] = useState(!quick);
  const [result, setResult] = useState(null); // { session, audioUrl }
  const [pendingRec, setPendingRec] = useState(null); // finished take awaiting submit/restart/abandon
  const [showModel, setShowModel] = useState(true);
  const [notes, setNotes] = useState('');
  const [starting, setStarting] = useState(false);
  const [countdown, setCountdown] = useState(0); // 3..1 pre-roll, 0 = not counting
  const [talkTarget, setTalkTarget] = useState(90); // free-speech target length (s)
  const [listen, setListen] = useState(null); // { text, pos } while "Listen first" plays

  useEffect(() => () => cancelTTS(), []);
  const audioUrlRef = useRef(null);
  const pendingUrlRef = useRef(null);

  // Clean up object URLs.
  useEffect(() => () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
  }, []);

  // 3-2-1 pre-roll, then actually start capturing. The mic is already warm
  // (monitor opened in handleStart) so the first word isn't clipped.
  useEffect(() => {
    if (!countdown) return undefined;
    const t = setTimeout(async () => {
      if (countdown > 1) { setCountdown((c) => c - 1); return; }
      setCountdown(0);
      setStarting(true);
      const ok = await recorder.startRecording(settings.inputDeviceId, { recognition: liveRecognition });
      setStarting(false);
      if (ok) setPhase('recording');
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // Hands-free Space to start/stop (ignored while typing or when a control is focused).
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A' || e.target?.isContentEditable) return;
      if (phase === 'setup' && !countdown && !starting) { e.preventDefault(); handleStart(); }
      else if (phase === 'recording') { e.preventDefault(); handleStop(); }
      else if (phase === 'result' && !inProgramMode) { e.preventDefault(); saveNotes(); reset(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown, starting]);

  // Selected project. A project with `text` is a "reading" project — recorded a
  // passage at a time, tracking a position through the whole work.
  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;
  const readingProject = selectedProject && selectedProject.text?.trim() ? selectedProject : null;
  const passages = useMemo(() => (readingProject ? splitIntoPassages(readingProject.text, readingProject.chunkWords) : []), [readingProject]);
  const passageIdx = readingProject ? Math.min(readingProject.passageIndex || 0, Math.max(0, passages.length - 1)) : 0;

  const activeExercise = useMemo(() => {
    if (exercise) return exercise;
    if (readingProject && passages.length) {
      return buildCustomExercise('read', passages[passageIdx], `project-${readingProject.id}-${passageIdx}`);
    }
    if (chooserMode === 'read') {
      const passage = READING_LIBRARY.find((p) => p.id === selectedPassage);
      const text = customText.trim() || passage?.text || '';
      return buildCustomExercise('read', text, customText.trim() ? null : passage?.id);
    }
    return buildCustomExercise('free', customPrompt.trim() || freePrompt, null, freeTone, talkTarget);
  }, [exercise, readingProject, passages, passageIdx, chooserMode, selectedPassage, customText, freePrompt, customPrompt, freeTone, talkTarget]);

  const recognitionOn = settings.recognitionEnabled && recorder.recognitionSupported;
  // Humming / breath / sustained-tone drills are non-verbal: transcribing them is
  // noise, so recognition stays off and the live view is a waveform, not a transcript.
  const nonVerbal = activeExercise.mode === 'breath' || activeExercise.mode === 'sustain' || activeExercise.category === 'Warm-up';
  const liveRecognition = recognitionOn && !nonVerbal;

  // How much of the provided text has been read (final transcript only — the
  // high-confidence signal). Drives the live "% read" badge and auto-submit.
  const readCov = phase === 'recording' && activeExercise.mode === 'read' && activeExercise.prompt && recognitionOn
    ? readingCoverage(activeExercise.prompt, recorder.finalText)
    : null;
  const recorderLive = useRef(recorder);
  useEffect(() => { recorderLive.current = recorder; });
  const autoSubmitRef = useRef(false);
  useEffect(() => {
    if (phase !== 'recording') { autoSubmitRef.current = false; return; }
    if (!settings.autoSubmitRead || autoSubmitRef.current) return;
    if (!readCov || readCov.coverage < 0.95) return;
    autoSubmitRef.current = true;
    toast('📖 Whole text read — submitting…', { type: 'success' });
    // Grace period so a trailing word can finalize, then stop + submit directly
    // (skips the review screen — the user opted into hands-free completion).
    setTimeout(async () => {
      if (!recorderLive.current.isRecording) return; // user already stopped manually
      const rec = await recorderLive.current.stopRecording();
      if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
      pendingUrlRef.current = URL.createObjectURL(rec.blob);
      const take = { ...rec, previewUrl: pendingUrlRef.current };
      setPendingRec(take); // a failed analysis still lands on the review screen
      submitRecording(take);
    }, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, readCov?.coverage, settings.autoSubmitRead]);

  // Program progress (reflects the latest store state, incl. the step we just finished).
  const progSteps = inProgramMode ? program?.steps || [] : [];
  const progTotal = progSteps.length;
  const progDone = progSteps.filter((s) => s.status === 'done').length;
  const nextPendingIdx = progSteps.findIndex((s) => s.status === 'pending');

  function startListen(text) {
    // id guards against a cancelled earlier utterance's late onend clearing this one.
    const id = Date.now();
    const mine = (fn) => setListen((l) => (l?.id === id ? fn(l) : l));
    setListen({ id, text, pos: -1 });
    speak(text, {
      rate: 0.95,
      onBoundary: ({ charIndex }) => mine((l) => ({ ...l, pos: wordsBefore(prepareText(text).slice(0, charIndex)) })),
      onEnd: () => mine(() => null),
    });
  }
  function stopListen() {
    cancelTTS();
    setListen(null);
  }

  useEffect(() => {
    if (!quick) return undefined;
    const t = setTimeout(handleStart, 0); // deferred: no synchronous setState in an effect
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStart() {
    if (starting || countdown) return;
    stopListen();
    // Warm the mic while the pre-roll counts down (see countdown effect).
    recorder.startMonitor(settings.inputDeviceId);
    setCountdown(3);
  }
  function cancelCountdown() {
    setCountdown(0);
    recorder.stopMonitor();
  }

  // Stop the mic and hold the take for review — no analysis yet.
  async function handleStop() {
    const rec = await recorder.stopRecording();
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    pendingUrlRef.current = URL.createObjectURL(rec.blob);
    setPendingRec({ ...rec, previewUrl: pendingUrlRef.current });
    setPhase('review');
  }

  // Analyze + save the take the user chose to submit (or an explicit take when
  // auto-submit fires straight from recording, skipping the review phase).
  async function submitRecording(recArg) {
    const rec = recArg || pendingRec;
    if (!rec) return;
    setPhase('analyzing');
    try {
      const isWarmup = activeExercise.mode === 'breath' || activeExercise.category === 'Warm-up';
      const isTechnique = !!activeExercise.technique;
      const analysis = await analyzeRecording({
        blob: rec.blob,
        durationSec: rec.durationSec,
        transcript: rec.transcript,
        recognitionConfidence: rec.confidence,
        recognitionSupported: recorder.recognitionSupported,
        profile,
      });
      const base = {
        type: activeExercise.type || activeExercise.mode,
        mode: activeExercise.mode,
        exerciseId: activeExercise.id,
        exerciseTitle: activeExercise.title,
        prompt: activeExercise.prompt || '',
        targetAttributes: activeExercise.targetAttributes || [],
        durationSec: rec.durationSec,
        transcript: rec.transcript,
        recognitionConfidence: rec.confidence,
        recognitionSupported: recorder.recognitionSupported,
        paceMarks: rec.paceMarks || [],
        metrics: analysis.metrics,
        projectId: selectedProjectId || null,
        notes: '',
      };
      let session;
      if (isTechnique) {
        const evaluation = evaluateStage(activeExercise.stage, analysis.metrics, analysis.scores, profile);
        session = {
          ...base,
          assessment: 'technique',
          scores: null,
          overall: null,
          distances: null,
          technique: { ...activeExercise.technique, evaluation },
        };
      } else if (isWarmup) {
        session = {
          ...base,
          assessment: 'completion',
          completion: assessCompletion(analysis.metrics),
          scores: null,
          overall: null,
          distances: null,
        };
      } else {
        session = {
          ...base,
          assessment: 'full',
          scores: analysis.scores,
          overall: analysis.overall,
          distances: analysis.distances,
        };
      }
      // Celebrate a new personal best (only once there's a prior scored take to beat).
      const priorFull = sessions.filter((s) => s.assessment === 'full' && s.overall != null);
      const isNewBest = session.assessment === 'full' && analysis.overall != null
        && priorFull.length > 0 && analysis.overall > Math.max(...priorFull.map((s) => s.overall));
      const saved = await addSession(session, rec.blob, rec.mime);
      if (isTechnique) {
        recordTechniqueResult(activeExercise.technique.id, activeExercise.technique.stageId, {
          score: session.technique.evaluation.score,
          matched: session.technique.evaluation.matched,
        });
      }
      if (programStepIndex >= 0) completeProgramStep(programStepIndex, saved.id);
      // Advance the reading position for a book/work project (only when we read
      // its current passage, not a URL-provided exercise).
      if (readingProject && !exercise && passages.length) {
        updateProject(readingProject.id, { passageIndex: Math.min(passageIdx + 1, passages.length) });
      }
      // Reuse the review preview URL (same blob) as the result's audio URL.
      audioUrlRef.current = rec.previewUrl || URL.createObjectURL(rec.blob);
      pendingUrlRef.current = null;
      setPendingRec(null);
      setResult({ session: saved, audioUrl: audioUrlRef.current });
      setNotes('');
      setPhase('result');
      if (isNewBest) toast(`🎉 New personal best — ${analysis.overall}!`, { type: 'success' });
    } catch (e) {
      toast(`Analysis failed: ${e.message || e}`);
      setPhase('review'); // keep the take so they can retry or abandon
    }
  }

  function discardPending() {
    if (pendingUrlRef.current) {
      URL.revokeObjectURL(pendingUrlRef.current);
      pendingUrlRef.current = null;
    }
    setPendingRec(null);
  }

  async function restartRecording() {
    discardPending();
    await handleStart();
  }

  function abandonRecording() {
    discardPending();
    setPhase('setup');
  }

  function reset() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    discardPending();
    setResult(null);
    setExercise(queryExercise);
    setPhase('setup');
  }

  // Misread / skipped passage words from this take → a short read-aloud drill of just those.
  function drillMisses(words) {
    saveNotes();
    discardPending();
    setResult(null);
    setExercise({
      ...buildCustomExercise('read', `${words.join(', ')}.
${words.join(', ')}.`, `miss-drill-${Date.now()}`),
      title: 'Drill the misses',
      instructions: 'The words you misread or skipped last take, twice each. Say every one fully and clearly.',
      durationSec: 20,
    });
    setPhase('setup');
  }

  function saveNotes() {
    if (!result) return;
    updateSession(result.session.id, { notes });
    setResult((r) => (r ? { ...r, session: { ...r.session, notes } } : r));
  }

  function goToStep(i) {
    saveNotes();
    const st = program?.steps?.[i];
    if (!st) return;
    navigate('practice', { query: { exercise: st.exercise.id, program: '1', step: String(i) } });
  }

  // ---------- render ----------
  if (phase === 'result' && result) {
    const isTechnique = !!result.session.technique;
    const programInfo = inProgramMode ? { done: progDone, total: progTotal, nextPendingIdx } : null;

    // Always offer a next thing to do when this wasn't a mid-program step. Priority: continue the
    // project this take belongs to → resume an active daily program → a fresh weakest-targeting drill.
    let suggestion = null;
    if (!inProgramMode && !isTechnique) {
      const proj = result.session.projectId ? projects.find((p) => p.id === result.session.projectId) : null;
      const pendingIdx = program?.steps ? program.steps.findIndex((s) => s.status === 'pending') : -1;
      if (proj) {
        const projPassages = proj.text?.trim() ? splitIntoPassages(proj.text, proj.chunkWords) : [];
        const readAll = projPassages.length > 0 && (proj.passageIndex || 0) >= projPassages.length;
        suggestion = {
          kind: 'project',
          label: !projPassages.length
            ? `Record another into “${proj.name}” →`
            : readAll ? `“${proj.name}” fully read — record more →` : `Next passage of “${proj.name}” →`,
        };
      } else if (pendingIdx >= 0) {
        suggestion = { kind: 'program', stepIdx: pendingIdx, label: `Resume program: ${program.steps[pendingIdx].exercise.title} →` };
      } else {
        const weakKeys = weakestAttributes(sessions, 2).map((w) => w.key);
        const ex = suggestNextExercise(weakKeys, result.session.exerciseId, sessions);
        if (ex) suggestion = { kind: 'single', exerciseId: ex.id, label: `Next: ${ex.title} →` };
      }
    }
    return (
      <div className="stack">
        <div className="row spread wrap" style={{ marginBottom: 2 }}>
          <div>
            <div className="tag">
              {result.session.exerciseTitle}
              {inProgramMode && progTotal ? ` · program ${progDone}/${progTotal} done` : ''}
            </div>
            <h1 style={{ margin: '2px 0' }}>Exercise debrief</h1>
            <p className="muted small" style={{ margin: 0 }}>
              Review your transcript and the ideal articulation below, then decide whether to practice again or continue.
            </p>
          </div>
          <button className="btn ghost sm" onClick={() => { saveNotes(); navigate('session', { param: result.session.id }); }}>
            Full detail ↗
          </button>
        </div>

        {!isTechnique && (
          <DebriefPanel
            session={result.session}
            notes={notes}
            setNotes={setNotes}
            onSaveNotes={saveNotes}
            program={programInfo}
            sessions={sessions}
          />
        )}

        <SessionReport session={result.session} audioUrl={result.audioUrl} focusAttrs={result.session.targetAttributes} />

        <DecisionBar
          program={programInfo}
          isTechnique={isTechnique}
          suggestion={suggestion}
          onAgain={reset}
          misses={result.session.mode === 'read' ? missedWords(result.session) : []}
          onDrillMisses={drillMisses}
          onNext={() => goToStep(nextPendingIdx)}
          onSuggested={() => {
            saveNotes();
            if (suggestion.kind === 'program') goToStep(suggestion.stepIdx);
            else if (suggestion.kind === 'project') reset(); // re-setup in place; passage already advanced
            else navigate('practice', { query: { exercise: suggestion.exerciseId } });
          }}
          onToProgram={() => { saveNotes(); navigate('exercises'); }}
          onDone={() => { saveNotes(); navigate(isTechnique ? 'mastery' : ''); }}
        />
      </div>
    );
  }

  if (phase === 'review' && pendingRec) {
    return (
      <div className="stack">
        <div className="card">
          <div className="card-head">
            <h3>Recording finished</h3>
            <span className="tag">{formatDuration(pendingRec.durationSec)}</span>
          </div>
          <p className="muted small" style={{ marginBottom: 12 }}>
            Review your transcript, then submit it for analysis, re-record, or abandon this take.
          </p>
          {nonVerbal ? (
            <p className="tiny muted" style={{ marginBottom: 12 }}>Non-verbal drill — no transcript. Sound &amp; pitch get analyzed when you press Submit.</p>
          ) : (
          <div className="card tight" style={{ background: 'var(--bg-2)', marginBottom: 12 }}>
            <div className="tag" style={{ marginBottom: 6 }}>Transcript</div>
            <p style={{ minHeight: 40, whiteSpace: 'pre-wrap' }}>
              {pendingRec.transcript || (
                <span className="muted">
                  {recognitionOn
                    ? 'No speech was transcribed. Nothing is analyzed yet — pitch, energy & articulation get scored when you press Submit.'
                    : 'Transcription is off. Nothing is analyzed yet — pitch, energy & articulation get scored when you press Submit.'}
                </span>
              )}
            </p>
          </div>
          )}
          {pendingRec.previewUrl && <RecordingAudio src={pendingRec.previewUrl} />}
          <div className="row wrap" style={{ marginTop: 16 }}>
            <button className="btn primary lg" onClick={() => submitRecording()}>✓ Submit for analysis</button>
            <button className="btn lg" onClick={restartRecording}>↻ Restart</button>
            <button className="btn ghost danger lg" onClick={abandonRecording}>✕ Abandon</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'analyzing') {
    return <div className="empty"><div style={{ fontSize: 40 }}>🧠</div><h3>Analyzing your speech…</h3><p className="muted">Decoding audio, measuring pitch, energy and articulation.</p></div>;
  }

  const recording = phase === 'recording';
  const listenPos = listen && listen.text === activeExercise.prompt ? listen.pos : null;
  // Live per-attribute feedback while speaking: acoustic snapshot from the recorder
  // merged with transcript-derived metrics, scored by the same attribute functions.
  const liveTx = recording ? analyzeTranscript(`${recorder.finalText} ${recorder.interim}`.trim(), Math.max(1, recorder.elapsedMs / 1000)) : null;
  const liveMerged = recording ? { ...(recorder.liveMetrics || {}), ...(liveTx || {}), recognitionConfidence: 0 } : null;
  // Where the reader is in the provided text (final + interim, for responsiveness).
  // null = not a live read; -1 = reading, nothing recognised yet.
  const readPos = recording && liveRecognition && activeExercise.mode === 'read' && activeExercise.prompt
    ? readingCoverage(activeExercise.prompt, `${recorder.finalText} ${recorder.interim}`).lastMatched
    : null;

  return (
    <div className="stack">
      {inProgramMode && progTotal > 0 && (
        <div className="card tight" style={{ borderColor: 'var(--accent)' }}>
          <div className="row spread" style={{ marginBottom: 6 }}>
            <span className="small">
              <b>Daily program</b> · step {programStepIndex + 1} of {progTotal}
            </span>
            <span className="small mono">{progDone}/{progTotal} done</span>
          </div>
          <div className="attr-bar-track">
            <div className="attr-bar-fill" style={{ width: `${(progDone / progTotal) * 100}%`, background: 'var(--accent)' }} />
          </div>
        </div>
      )}

      {!recognitionOn && !nonVerbal && (
        <div className="card tight" style={{ borderColor: 'var(--warn)' }}>
          <span className="small">
            ⚠️ Live transcription is {settings.recognitionEnabled ? 'not supported in this browser' : 'turned off'}.
            Pitch, energy & articulation are still analyzed; pace / filler / vocabulary need transcription
            {settings.recognitionEnabled ? ' (try Chrome or Edge)' : ' (enable it in Settings)'}.
          </span>
        </div>
      )}

      {!recording && !showSetup && !exercise && (
        <div className="card tight">
          <div className="row spread wrap" style={{ gap: 8 }}>
            <span className="small">
              <b>🎙️ Just speaking</b> · {freeTone.emoji} {freeTone.label} · {formatDuration(talkTarget)} target
            </span>
            <button className="btn ghost sm" onClick={() => setShowSetup(true)}>Change setup</button>
          </div>
        </div>
      )}

      {!recording && (showSetup || exercise) && (
        <div className="card">
          <div className="card-head"><h3>What do you want to practice?</h3></div>
          {exercise ? (
            <div className="row spread wrap">
              <div>
                <div className="tag">{exercise.category} · {MODE_LABELS[exercise.mode]}</div>
                <h2 style={{ marginTop: 4 }}>{exercise.title}</h2>
              </div>
              {!inProgramMode && <button className="btn ghost sm" onClick={() => setExercise(null)}>Choose something else</button>}
            </div>
          ) : (
            <>
              {projects.length > 0 && (
                <label className="field" style={{ marginBottom: 14 }}>
                  Project (optional — e.g. reading a book)
                  <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                    <option value="">None — one-off recording</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.text?.trim() ? '📖 ' : '📁 '}{p.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {readingProject ? (
                <div className="card tight" style={{ borderColor: 'var(--accent)' }}>
                  <div className="row spread">
                    <span className="small"><b>📖 {readingProject.name}</b></span>
                    <span className="tiny mono">passage {Math.min(passageIdx + 1, passages.length)} of {passages.length}</span>
                  </div>
                  <p className="tiny muted" style={{ margin: '6px 0 0' }}>
                    Reading the next passage of this project. Your position advances when you submit; change it on the project page.
                  </p>
                </div>
              ) : (
              <>
              <div className="pill-group" style={{ marginBottom: 14 }}>
                {['free', 'read'].map((m) => (
                  <button key={m} className={`pill ${chooserMode === m ? 'active' : ''}`} onClick={() => setChooserMode(m)}>
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
              {chooserMode === 'read' ? (
                <div className="stack">
                  <label className="field">
                    Provided passage — {READING_LIBRARY.length} from the public-domain library
                    <select value={selectedPassage} onChange={(e) => { setSelectedPassage(e.target.value); setCustomText(''); }}>
                      {passagePick.groups.map((g) => (
                        <optgroup key={g.key} label={`${g.label} (${g.items.length})`}>
                          {g.items.map((p) => <option key={p.id} value={p.id}>{passageLabel(p)}</option>)}
                        </optgroup>
                      ))}
                      {passagePick.seen.length > 0 && (
                        <optgroup label={`✓ Already read (${passagePick.seen.length}) — least recent first`}>
                          {passagePick.seen.map((p) => <option key={p.id} value={p.id}>{seenLabel(passagePick.seenAt(p))} · {passageLabel(p)}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </label>
                  <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }}
                    onClick={() => {
                      const r = leastRecent(READING_LIBRARY.filter((p) => p.id !== selectedPassage), passagePick.seenAt);
                      setSelectedPassage(r.id);
                      setCustomText('');
                    }}>
                    🎲 Random unread passage
                  </button>
                  <label className="field">
                    …or paste your own / an unseen paper to read
                    <textarea value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Paste any English text to read aloud…" />
                  </label>
                </div>
              ) : (
                <div className="stack">
                  <div className="field">
                    Target tone / emotion
                    <div className="pill-group" style={{ flexWrap: 'wrap' }}>
                      {TONE_TARGETS.map((t) => (
                        <button key={t.id} className={`pill ${freeTone.id === t.id ? 'active' : ''}`} onClick={() => setFreeTone(t)}>
                          {t.emoji} {t.label}
                        </button>
                      ))}
                    </div>
                    <span className="tiny muted">{freeTone.hint} — you're scored on: {freeTone.attrs.join(', ')}.</span>
                  </div>
                  <div className="field">
                    Talk length — the timer turns green near the target, yellow at it, red when over
                    <div className="pill-group">
                      {TALK_LENGTHS.map((t) => (
                        <button key={t} className={`pill ${talkTarget === t ? 'active' : ''}`} onClick={() => setTalkTarget(t)}>
                          {formatDuration(t)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="field">
                    Prompt — pick a topic…
                    <select value={freePrompt} onChange={(e) => setFreePrompt(e.target.value)}>
                      {promptPick.free.length > 0 && (
                        <optgroup label={`Free / improv (${promptPick.free.length})`}>
                          {promptPick.free.map((p) => <option key={p} value={p}>{p}</option>)}
                        </optgroup>
                      )}
                      {promptPick.interview.length > 0 && (
                        <optgroup label={`High-pressure (${promptPick.interview.length})`}>
                          {promptPick.interview.map((p) => <option key={p} value={p}>{p}</option>)}
                        </optgroup>
                      )}
                      {promptPick.seen.length > 0 && (
                        <optgroup label={`✓ Already used (${promptPick.seen.length}) — least recent first`}>
                          {promptPick.seen.map((p) => <option key={p} value={p}>{seenLabel(promptPick.seenAt(p))} · {p}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </label>
                  <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }}
                    onClick={() => setFreePrompt(freshPrompt([...FREE_PROMPTS, ...INTERVIEW_PROMPTS].filter((p) => p !== freePrompt), sessions))}>
                    🎲 Fresh prompt
                  </button>
                  <label className="field">
                    …or make something up — type your own prompt / topic (overrides the picker)
                    <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="e.g. Pitch your favourite hobby to a stranger in 60 seconds." />
                  </label>
                </div>
              )}
              </>
              )}
            </>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
          <h3>{recording ? 'Recording in progress' : 'Your prompt'}</h3>
          {activeExercise.prompt && activeExercise.mode !== 'free' && (
            <EmotiveToggle on={!!settings.emotiveTags} onChange={(v) => updateSettings({ emotiveTags: v })} />
          )}
          {!recording && activeExercise.mode === 'read' && activeExercise.prompt && isTTSSupported() && (
            listenPos != null ? (
              <button type="button" className="btn ghost sm" onClick={stopListen}>■ Stop listening</button>
            ) : (
              <button type="button" className="btn ghost sm" title="Hear the passage read aloud first, then record your own read"
                onClick={() => startListen(activeExercise.prompt)}>🔊 Listen first</button>
            )
          )}
          {!recording && activeExercise.variants?.length > 1 && (
            <button type="button" className="btn ghost sm" title="Show a different version of this drill's text"
              onClick={() => setExercise((ex) => {
                const i = ((ex.variantIndex ?? 0) + 1) % ex.variants.length;
                return { ...ex, prompt: stripTags(ex.variants[i]), taggedPrompt: ex.variants[i], variantIndex: i };
              })}>
              🎲 Another version ({(activeExercise.variantIndex ?? 0) + 1}/{activeExercise.variants.length})
            </button>
          )}
          {recording && (() => {
            const zone = activeExercise.mode === 'free' && activeExercise.durationSec
              ? timerZone(recorder.elapsedMs / 1000, activeExercise.durationSec) : null;
            return (
              <span className="badge needs-work" role="status"
                style={zone?.tone ? { color: `var(--${zone.tone})`, borderColor: `var(--${zone.tone})` } : undefined}>
                ● LIVE · {formatDuration(recorder.elapsedMs / 1000)}
                {activeExercise.durationSec ? ` / ${formatDuration(activeExercise.durationSec)} target` : ''}
                {zone ? ` · ${zone.label}` : ''}
              </span>
            );
          })()}
        </div>
        {activeExercise.instructions && !recording && (
          <p className="muted small" style={{ marginBottom: 12 }}>{activeExercise.instructions}</p>
        )}
        {activeExercise.prompt ? (
          <div className="prompt-box">
            {readPos != null || listenPos != null
              // ponytail: live progress view is plain text — study the emotive tags before you start.
              ? <ReadingProgress text={activeExercise.prompt} upTo={readPos ?? listenPos} />
              : settings.emotiveTags && activeExercise.mode !== 'free'
                ? <EmotiveText text={activeExercise.prompt} tagged={activeExercise.taggedPrompt} />
                : activeExercise.prompt}
          </div>
        ) : (
          <div className="prompt-box muted">Speak freely — no script for this one.</div>
        )}

        {recording && nonVerbal && (
          <div className="card tight" style={{ marginTop: 14, background: 'var(--bg-2)' }}>
            <div className="row spread" style={{ marginBottom: 8 }}>
              <div className="tag" style={{ margin: 0 }}>Sound monitor</div>
              <span className="tiny muted">non-verbal drill — watch the waveform &amp; pitch glide</span>
            </div>
            <LiveWave history={recorder.liveMetrics?.history || []} />
          </div>
        )}

        {recording && !nonVerbal && (
          <div className="card tight" style={{ marginTop: 14, background: 'var(--bg-2)' }}>
            <div className="mic-meter" title="Live input level" style={{ marginBottom: 10 }}>
              <span className="mic-dot live" style={{ background: 'var(--rec)' }} />
              <div className="mic-meter-track"><div className="mic-meter-fill" style={{ width: `${Math.round(recorder.level * 100)}%` }} /></div>
            </div>
            <div className="row spread" style={{ marginBottom: 6 }}>
              <div className="tag" style={{ margin: 0 }}>Live transcript</div>
              {readCov && (
                <span className="tiny mono" style={{ color: readCov.coverage >= 0.95 ? 'var(--good)' : 'var(--text-dim)' }}>
                  📖 {Math.round(readCov.coverage * 100)}% read
                </span>
              )}
            </div>
            <p style={{ minHeight: 40 }}>
              {recorder.finalText} <span className="muted">{recorder.interim}</span>
              {!recorder.finalText && !recorder.interim && (
                <span className="muted">{recognitionOn ? 'Listening… start speaking' : 'Transcription off.'}</span>
              )}
            </p>
            {recorder.recognitionError && (
              <p className="tiny" style={{ color: 'var(--warn)', margin: '4px 0 0' }}>⚠️ {recorder.recognitionError}</p>
            )}
          </div>
        )}

        {recording && (
          <div className="card tight" style={{ marginTop: 14, background: 'var(--bg-2)' }}>
            <div className="row spread" style={{ marginBottom: 8 }}>
              <div className="tag" style={{ margin: 0 }}>Live feedback</div>
              <span className="tiny muted">updates as you speak · live estimates</span>
            </div>
            <LiveFeedback metrics={liveMerged} profile={profile} wordCount={liveTx?.wordCount || 0} focusAttrs={activeExercise.targetAttributes || []} />
          </div>
        )}

        {recorder.error && (
          <p className="small" style={{ color: 'var(--bad)', marginTop: 10 }} role="alert">
            ⚠️ {recorder.error}
            <br /><span className="muted">Allow the microphone via your browser's address-bar icon, then press Start again.</span>
          </p>
        )}

        <div className="row" style={{ marginTop: 18 }}>
          {recording ? (
            <button className="btn lg" onClick={handleStop}>■ Stop &amp; analyze</button>
          ) : countdown ? (
            <button className="btn rec lg" onClick={cancelCountdown}>Starting in {countdown}… · cancel</button>
          ) : (
            <button className="btn rec lg" onClick={handleStart} disabled={starting}>
              {starting ? 'Starting…' : '● Start recording'}
            </button>
          )}
          <span className="small muted">
            {recording
              ? 'Speak naturally — press Space or Stop when done.'
              : 'Press Space or Start. A 3-2-1 pre-roll warms the mic so your first word isn’t clipped.'}
          </span>
        </div>
        {activeExercise.mode === 'read' && activeExercise.prompt && recognitionOn && !recording && (
          <label className="row" style={{ gap: 6, alignItems: 'center', marginTop: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!settings.autoSubmitRead}
              onChange={(e) => updateSettings({ autoSubmitRead: e.target.checked })}
              style={{ width: 'auto' }}
            />
            <span className="small muted">Auto-submit when the whole text has been read (skips the review step)</span>
          </label>
        )}
      </div>

      {(activeExercise.mode === 'read' || activeExercise.mode === 'twister') && activeExercise.prompt && (
        <div className="card">
          <div className="card-head">
            <div>
              <h3>🫦 Ideal mouth movements</h3>
              <span className="tiny muted">a real-time model of the lips, tongue &amp; jaw — mimic along, or let it follow while you record</span>
            </div>
            <button className="btn ghost sm" onClick={() => setShowModel((s) => !s)}>{showModel ? 'Hide' : 'Show'}</button>
          </div>
          {showModel && (
            <ArticulationModel
              key={activeExercise.id}
              text={activeExercise.prompt}
              targetWpm={activeExercise.mode === 'twister' ? 95 : 130}
              recording={recording}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Inline summary + per-session note. Rendered in the page flow (no modal) so the
// user can read it alongside the full transcript and articulation review.
function DebriefPanel({ session, notes, setNotes, onSaveNotes, program, sessions = [] }) {
  const isCompletion = session.assessment === 'completion';
  const scored = Object.entries(session.scores || {}).filter(([, v]) => v != null);
  const best = scored.slice().sort((a, b) => b[1] - a[1])[0];
  const worst = scored.slice().sort((a, b) => a[1] - b[1])[0];
  const bestAttr = best && ATTRIBUTE_MAP[best[0]];
  const worstAttr = worst && ATTRIBUTE_MAP[worst[0]];
  const programComplete = program && program.nextPendingIdx < 0;

  return (
    <div className="card">
      {program && (
        <div style={{ marginBottom: 16 }}>
          <div className="row spread" style={{ marginBottom: 6 }}>
            <span className="small">
              {programComplete ? '🎉 Program complete!' : `Program progress · ${program.done} of ${program.total} steps`}
            </span>
            <span className="small mono">{program.total ? Math.round((program.done / program.total) * 100) : 0}%</span>
          </div>
          <div className="attr-bar-track">
            <div className="attr-bar-fill" style={{ width: `${program.total ? (program.done / program.total) * 100 : 0}%`, background: programComplete ? 'var(--good)' : 'var(--accent)' }} />
          </div>
        </div>
      )}
      {isCompletion ? (
        <div>
          <p style={{ marginBottom: 10 }}>
            {session.completion?.completed ? '✅' : '⚠️'} <b>{session.completion?.completed ? 'Warm-up complete.' : 'Warm-up not quite complete.'}</b> {session.completion?.note}
          </p>
          <div className="grid cols-2" style={{ marginBottom: 14 }}>
            <div className="stat"><span className="big">{formatDuration(session.metrics?.durationSec)}</span><span className="lbl">Length</span></div>
            <div className="stat"><span className="big">{Math.round((session.completion?.soundRatio || 0) * 100)}%</span><span className="lbl">Sound detected</span></div>
          </div>
          <p className="tiny muted" style={{ marginBottom: 14 }}>Warm-ups are tracked for completion, not scored.</p>
        </div>
      ) : (
        <>
          <div className="grid cols-3" style={{ marginBottom: 16 }}>
            <div className="stat"><span className="big">{session.overall}</span><span className="lbl">Overall</span></div>
            <div className="stat"><span className="big" style={{ color: 'var(--accent-2)' }}>{session.distances?.alignment}%</span><span className="lbl">Alignment</span></div>
            <div className="stat"><span className="big">{formatDuration(session.metrics?.durationSec)}</span><span className="lbl">Length</span></div>
          </div>
          {bestAttr && (
            <p style={{ marginBottom: 10 }}>
              ✅ <b>What went well:</b> {bestAttr.label} ({best[1]}). {bestAttr.blurb}
            </p>
          )}
          {worstAttr && (
            <p style={{ marginBottom: 16 }}>
              🎯 <b>To revisit next time:</b> {worstAttr.label} ({worst[1]}). {worstAttr.blurb}
            </p>
          )}
        </>
      )}
      <RunContext session={session} sessions={sessions} />
      <label className="field">
        One note for next time (saved with this session)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={onSaveNotes}
          placeholder="e.g. Pauses felt more natural; still rushing the ending."
        />
      </label>
    </div>
  );
}

// Bottom-of-page "what next?" bar so the retry/continue decision comes after the
// user has scrolled through the transcript and articulation review.
function DecisionBar({ program, isTechnique, suggestion, onAgain, misses = [], onDrillMisses, onNext, onSuggested, onToProgram, onDone }) {
  const hasNext = program && program.nextPendingIdx >= 0;
  return (
    <div className="card" style={{ borderColor: 'var(--accent)' }}>
      <div className="row spread wrap" style={{ gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>What next?</h3>
          <span className="tiny muted">This recording{isTechnique ? '' : ' and your note'} {isTechnique ? 'is' : 'are'} already saved.</span>
        </div>
        <div className="row wrap">
          {program ? (
            <>
              <button className="btn" onClick={onToProgram}>Back to program</button>
              {hasNext ? (
                <button className="btn primary" onClick={onNext}>Next step →</button>
              ) : (
                <button className="btn primary" onClick={onToProgram}>Finish 🎉</button>
              )}
            </>
          ) : (
            <>
              <button className="btn ghost" onClick={onAgain} title="Space">↻ Again</button>
              {misses.length > 0 && (
                <button className="btn" onClick={() => onDrillMisses(misses)} title={misses.join(', ')}>🎯 Drill the misses ({misses.length})</button>
              )}
              <button className="btn" onClick={onDone}>{isTechnique ? 'Back to mastery' : 'Done'}</button>
              {suggestion && <button className="btn primary" onClick={onSuggested}>{suggestion.label}</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Unique misread / skipped passage words in a read take (what the passage said).
function missedWords(session) {
  const { tokens } = annotateTranscript({ transcript: session.transcript || '', prompt: session.prompt || '', mode: 'read' });
  const out = new Set();
  for (const t of tokens) {
    const w = t.kind === 'misread' ? t.expected : t.kind === 'omission' ? t.text : null;
    if (w) out.add(w.toLowerCase().replace(/[^a-z'-]/g, ''));
  }
  return [...out].filter(Boolean).slice(0, 20);
}

// Ported from TachyRead's run results: how this take compares to your last one on
// the same exercise, a per-exercise best, today's streak, and the takes this sitting.
function RunContext({ session, sessions }) {
  const others = sessions.filter((s) => s.id !== session.id);
  const same = others.filter((s) => s.exerciseId === session.exerciseId && s.overall != null);
  const prev = same[0]; // sessions are newest-first
  const isBestHere = session.overall != null && same.length > 0 && session.overall > Math.max(...same.map((s) => s.overall));
  const all = others.concat(session);
  const streak = computeStreak(all);
  const today = new Date().toDateString();
  const todays = all.filter((s) => new Date(s.createdAt).toDateString() === today);
  const todaySec = todays.reduce((a, s) => a + (s.durationSec || 0), 0);
  const sitting = groupIntoSessions(all)[0];
  const sittingTakes = sitting && sitting.count > 1 ? all.filter((s) => sitting.ids.includes(s.id)).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)) : [];
  const delta = (a, b, unit = '', lowerIsBetter = false) => {
    if (a == null || b == null) return null;
    const d = Math.round(a - b);
    const good = lowerIsBetter ? d < 0 : d > 0;
    return <b style={{ color: d === 0 ? 'var(--text-dim)' : good ? 'var(--good)' : 'var(--bad)' }}>{d > 0 ? '+' : ''}{d}{unit}</b>;
  };
  const m = session.metrics || {};
  const pm = prev?.metrics || {};
  return (
    <div className="stack" style={{ gap: 8, marginBottom: 16 }}>
      {isBestHere && <p style={{ margin: 0 }}>🥇 <b>Your best on this exercise</b> (previous best {Math.max(...same.map((s) => s.overall))}).</p>}
      {prev && session.overall != null && (
        <p className="small" style={{ margin: 0 }}>
          ↔ <b>vs last time on this exercise</b> ({new Date(prev.createdAt).toLocaleDateString()}): overall {delta(session.overall, prev.overall)}
          {m.wpm && pm.wpm ? <> · pace {delta(m.wpm, pm.wpm, ' wpm')}</> : null}
          {m.fillerTotal != null && pm.fillerTotal != null ? <> · fillers {delta(m.fillerTotal, pm.fillerTotal, '', true)}</> : null}
        </p>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        🔥 {streak}-day streak · today: {todays.length} take{todays.length === 1 ? '' : 's'}, {formatDuration(todaySec)} spoken
      </p>
      {sittingTakes.length > 1 && (
        <details>
          <summary className="small" style={{ cursor: 'pointer' }}>Takes this sitting ({sittingTakes.length})</summary>
          <table className="take-splits-table" style={{ marginTop: 6 }}>
            <thead><tr><th>#</th><th>Time</th><th>Exercise</th><th>Overall</th><th>Pace</th><th>Fillers</th></tr></thead>
            <tbody>
              {sittingTakes.map((s, i) => (
                <tr key={s.id} style={s.id === session.id ? { fontWeight: 700 } : undefined}>
                  <td>{i + 1}</td>
                  <td>{new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ textAlign: 'left' }}>{s.exerciseTitle}</td>
                  <td>{s.overall ?? '–'}</td>
                  <td>{s.metrics?.wpm ? Math.round(s.metrics.wpm) : '–'}</td>
                  <td>{s.metrics?.fillerTotal ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
