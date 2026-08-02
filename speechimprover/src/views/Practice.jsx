import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { useRecorder } from '../lib/recorderContext.jsx';
import { useToast } from '../components/ui.jsx';
import SessionReport from '../components/SessionReport.jsx';
import ArticulationModel from '../components/ArticulationModel.jsx';
import { analyzeRecording, assessCompletion } from '../lib/analysis/index.js';
import { ATTRIBUTE_MAP } from '../lib/analysis/attributes.js';
import {
  getExercise,
  READING_LIBRARY,
  PASSAGE_GROUPS,
  passageLabel,
  FREE_PROMPTS,
  INTERVIEW_PROMPTS,
} from '../lib/exercises.js';
import { getTechniqueExercise, evaluateStage } from '../lib/vocalMastery.js';
import { splitIntoPassages } from '../lib/passages.js';
import { formatDuration } from '../lib/format.js';

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

function buildCustomExercise(mode, prompt, passageId, tone) {
  if (mode === 'free') {
    const t = tone || TONE_TARGETS[0];
    return {
      id: passageId || `custom-free-${t.id}`,
      title: `Free speaking · ${t.label}`,
      category: 'Custom',
      mode: 'free',
      durationSec: 90,
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
  const { profile, settings, addSession, updateSession, program, completeProgramStep, recordTechniqueResult, projects, updateProject } = useStore();
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
        ? getExercise(queryExerciseId) || null
        : null;

  const [phase, setPhase] = useState('setup'); // setup | recording | analyzing | result
  const [chooserMode, setChooserMode] = useState(queryExercise ? queryExercise.mode : 'free');
  const [customText, setCustomText] = useState('');
  const [selectedPassage, setSelectedPassage] = useState(READING_LIBRARY[0].id);
  const [freePrompt, setFreePrompt] = useState(FREE_PROMPTS[0]);
  const [freeTone, setFreeTone] = useState(TONE_TARGETS[0]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(route.query.project || '');
  const [exercise, setExercise] = useState(queryExercise);
  const [result, setResult] = useState(null); // { session, audioUrl }
  const [pendingRec, setPendingRec] = useState(null); // finished take awaiting submit/restart/abandon
  const [showModel, setShowModel] = useState(true);
  const [notes, setNotes] = useState('');
  const audioUrlRef = useRef(null);
  const pendingUrlRef = useRef(null);

  // Clean up object URLs.
  useEffect(() => () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
  }, []);

  // Selected project. A project with `text` is a "reading" project — recorded a
  // passage at a time, tracking a position through the whole work.
  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;
  const readingProject = selectedProject && selectedProject.text?.trim() ? selectedProject : null;
  const passages = useMemo(() => (readingProject ? splitIntoPassages(readingProject.text) : []), [readingProject]);
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
    return buildCustomExercise('free', customPrompt.trim() || freePrompt, null, freeTone);
  }, [exercise, readingProject, passages, passageIdx, chooserMode, selectedPassage, customText, freePrompt, customPrompt, freeTone]);

  const recognitionOn = settings.recognitionEnabled && recorder.recognitionSupported;

  // Program progress (reflects the latest store state, incl. the step we just finished).
  const progSteps = inProgramMode ? program?.steps || [] : [];
  const progTotal = progSteps.length;
  const progDone = progSteps.filter((s) => s.status === 'done').length;
  const nextPendingIdx = progSteps.findIndex((s) => s.status === 'pending');

  async function handleStart() {
    await recorder.startRecording(settings.inputDeviceId, { recognition: recognitionOn });
    setPhase('recording');
  }

  // Stop the mic and hold the take for review — no analysis yet.
  async function handleStop() {
    const rec = await recorder.stopRecording();
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    pendingUrlRef.current = URL.createObjectURL(rec.blob);
    setPendingRec({ ...rec, previewUrl: pendingUrlRef.current });
    setPhase('review');
  }

  // Analyze + save the take the user chose to submit.
  async function submitRecording() {
    const rec = pendingRec;
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
    return (
      <div className="stack">
        <div className="row spread wrap" style={{ marginBottom: 2 }}>
          <div>
            <div className="tag">
              {result.session.exerciseTitle}
              {inProgramMode && progTotal ? ` · program ${progDone}/${progTotal} done` : ''}
            </div>
            <h1 style={{ margin: '2px 0' }}>Session debrief</h1>
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
          />
        )}

        <SessionReport session={result.session} audioUrl={result.audioUrl} focusAttrs={result.session.targetAttributes} />

        <DecisionBar
          program={programInfo}
          isTechnique={isTechnique}
          onAgain={reset}
          onNext={() => goToStep(nextPendingIdx)}
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
          {pendingRec.previewUrl && <audio src={pendingRec.previewUrl} controls style={{ width: '100%' }} />}
          <div className="row wrap" style={{ marginTop: 16 }}>
            <button className="btn primary lg" onClick={submitRecording}>✓ Submit for analysis</button>
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

      {!recognitionOn && (
        <div className="card tight" style={{ borderColor: 'var(--warn)' }}>
          <span className="small">
            ⚠️ Live transcription is {settings.recognitionEnabled ? 'not supported in this browser' : 'turned off'}.
            Pitch, energy & articulation are still analyzed; pace / filler / vocabulary need transcription
            {settings.recognitionEnabled ? ' (try Chrome or Edge)' : ' (enable it in Settings)'}.
          </span>
        </div>
      )}

      {!recording && (
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
                      {PASSAGE_GROUPS.map((g) => (
                        <optgroup key={g.key} label={`${g.label} (${g.items.length})`}>
                          {g.items.map((p) => <option key={p.id} value={p.id}>{passageLabel(p)}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }}
                    onClick={() => {
                      const r = READING_LIBRARY[Math.floor(Math.random() * READING_LIBRARY.length)];
                      setSelectedPassage(r.id);
                      setCustomText('');
                    }}>
                    🎲 Random passage
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
                  <label className="field">
                    Prompt — pick a topic…
                    <select value={freePrompt} onChange={(e) => setFreePrompt(e.target.value)}>
                      <optgroup label="Free / improv">
                        {FREE_PROMPTS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </optgroup>
                      <optgroup label="High-pressure">
                        {INTERVIEW_PROMPTS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </optgroup>
                    </select>
                  </label>
                  <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }}
                    onClick={() => setFreePrompt(FREE_PROMPTS[Math.floor(Math.random() * FREE_PROMPTS.length)])}>
                    🎲 Shuffle prompt
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
        <div className="card-head">
          <h3>{recording ? 'Recording in progress' : 'Your prompt'}</h3>
          {recording && <span className="badge needs-work">● LIVE · {formatDuration(recorder.elapsedMs / 1000)}</span>}
        </div>
        {activeExercise.instructions && !recording && (
          <p className="muted small" style={{ marginBottom: 12 }}>{activeExercise.instructions}</p>
        )}
        {activeExercise.prompt ? (
          <div className="prompt-box">{activeExercise.prompt}</div>
        ) : (
          <div className="prompt-box muted">Speak freely — no script for this one.</div>
        )}

        {recording && (
          <div className="card tight" style={{ marginTop: 14, background: 'var(--bg-2)' }}>
            <div className="tag" style={{ marginBottom: 6 }}>Live transcript</div>
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

        {recorder.error && <p className="small" style={{ color: 'var(--bad)', marginTop: 10 }}>⚠️ {recorder.error}</p>}

        <div className="row" style={{ marginTop: 18 }}>
          {!recording ? (
            <button className="btn rec lg" onClick={handleStart}>● Start recording</button>
          ) : (
            <button className="btn lg" onClick={handleStop}>■ Stop & analyze</button>
          )}
          <span className="small muted">
            {recording
              ? 'Your microphone is live — speak naturally. The red banner above confirms recording.'
              : 'Check your input device and the mic level meter in the top bar before you start.'}
          </span>
        </div>
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
function DebriefPanel({ session, notes, setNotes, onSaveNotes, program }) {
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
function DecisionBar({ program, isTechnique, onAgain, onNext, onToProgram, onDone }) {
  const hasNext = program && program.nextPendingIdx >= 0;
  return (
    <div className="card" style={{ borderColor: 'var(--accent)' }}>
      <div className="row spread wrap" style={{ gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>What next?</h3>
          <span className="tiny muted">This session{isTechnique ? '' : ' and your note'} {isTechnique ? 'is' : 'are'} already saved.</span>
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
              <button className="btn" onClick={onAgain}>↻ Practice again</button>
              <button className="btn primary" onClick={onDone}>{isTechnique ? 'Back to mastery' : 'Done'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
