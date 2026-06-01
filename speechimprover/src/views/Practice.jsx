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
import { formatDuration } from '../lib/format.js';

const MODE_LABELS = {
  read: 'Read provided text',
  free: 'Free / improv speaking',
  twister: 'Articulation drill',
  breath: 'Warm-up',
  sustain: 'Sustained tone',
};

function buildCustomExercise(mode, prompt, passageId) {
  return {
    id: passageId || `custom-${mode}`,
    title: mode === 'read' ? 'Read aloud (custom)' : 'Free speaking',
    category: 'Custom',
    mode,
    durationSec: mode === 'read' ? 60 : 90,
    targetAttributes:
      mode === 'read'
        ? ['pace', 'clarity', 'projection', 'noUptalk']
        : ['fillers', 'nonRepetition', 'pace', 'expressiveness'],
    instructions:
      mode === 'read'
        ? 'Read the text below at a deliberate, even pace. Pause at punctuation.'
        : 'Speak unscripted. Replace fillers with brief pauses; let statements fall at the end.',
    prompt,
    type: mode,
  };
}

export default function Practice({ route, navigate }) {
  const { profile, settings, addSession, updateSession, program, completeProgramStep, recordTechniqueResult } = useStore();
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
  const [exercise, setExercise] = useState(queryExercise);
  const [result, setResult] = useState(null); // { session, audioUrl }
  const [showModel, setShowModel] = useState(true);
  const [notes, setNotes] = useState('');
  const audioUrlRef = useRef(null);

  // Clean up object URLs.
  useEffect(() => () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const activeExercise = useMemo(() => {
    if (exercise) return exercise;
    if (chooserMode === 'read') {
      const passage = READING_LIBRARY.find((p) => p.id === selectedPassage);
      const text = customText.trim() || passage?.text || '';
      return buildCustomExercise('read', text, customText.trim() ? null : passage?.id);
    }
    return buildCustomExercise('free', freePrompt, null);
  }, [exercise, chooserMode, selectedPassage, customText, freePrompt]);

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

  async function handleStop() {
    setPhase('analyzing');
    const rec = await recorder.stopRecording();
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
      const audioUrl = URL.createObjectURL(rec.blob);
      audioUrlRef.current = audioUrl;
      setResult({ session: saved, audioUrl });
      setNotes('');
      setPhase('result');
    } catch (e) {
      toast(`Analysis failed: ${e.message || e}`);
      setPhase('setup');
    }
  }

  function reset() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
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
                  <label className="field">
                    Prompt (improv / topic)
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
                </div>
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
