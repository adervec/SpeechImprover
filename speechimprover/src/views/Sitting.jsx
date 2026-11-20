// "Just speak": an open-ended sitting with no prompt. Talk (or read a book aloud)
// for as long as you like, with breaks; lib/sitting.js scores it in chunks as you
// go, this screen shows a little of that while you speak, and the full review
// comes at the end. Each finished chunk is checkpointed, so a crash loses at most
// one chunk and the sitting can be recovered.

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { useRecorder } from '../lib/recorderContext.jsx';
import { useToast } from '../components/ui.jsx';
import SessionReport from '../components/SessionReport.jsx';
import LiveFeedback from '../components/LiveFeedback.jsx';
import { createSitting, summarizeSitting, driftNudges, CHUNK_SEC } from '../lib/sitting.js';
import { putAudio, getAudio, deleteAudio } from '../lib/db.js';
import { requestSpeechReview } from '../lib/coworkEngine.jsx';
import { formatDuration } from '../lib/format.js';
import { t } from '../lib/i18n.js';

const DRAFT_KEY = 'si.sittingDraft';
const DRAFT_AUDIO = 'sitting-draft';

function loadDraft() {
  try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY)); return d?.chunks?.length ? d : null; } catch { return null; }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* private mode */ }
  deleteAudio(DRAFT_AUDIO).catch(() => {});
}

const tone = (v) => (v == null ? 'var(--border)' : v >= 70 ? 'var(--good)' : v >= 45 ? 'var(--warn)' : 'var(--bad)');

// One-line nudges for drift over the sitting (ids from driftNudges()).
function nudgeText(id) {
  switch (id) {
    case 'paceUp': return t('Your pace is creeping up — slow down a little.');
    case 'paceDown': return t('Your pace is dropping — pick it back up.');
    case 'energyFading': return t('Your energy is fading — breathe low and send the last word out.');
    case 'pitchFlattening': return t('Your pitch is flattening — let it move again.');
    case 'clarityFading': return t('Your consonants are softening — open your mouth more.');
    case 'fillersRising': return t('Fillers are creeping in — pause instead.');
    default: return '';
  }
}

function sessionFrom(summary) {
  return {
    type: 'sitting',
    mode: 'free',
    exerciseId: summary.book ? 'sitting-book' : 'sitting',
    exerciseTitle: summary.book ? t('Just speak · reading a book') : t('Just speak'),
    prompt: '',
    targetAttributes: [],
    assessment: 'full',
    recognitionConfidence: 0,
    notes: '',
    ...summary,
  };
}

export default function Sitting({ route, navigate }) {
  const { profile, settings, updateSettings, addSession, removeSession } = useStore();
  const recorder = useRecorder();
  const toast = useToast();
  const [phase, setPhase] = useState('setup'); // setup | running | saving | review
  const [result, setResult] = useState(null); // { session, audioUrl }
  const [draft, setDraft] = useState(loadDraft);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const engineRef = useRef(null);
  const wakeRef = useRef(null);
  const savedChunksRef = useRef(0);
  const urlRef = useRef(null);
  const book = !!settings.sittingBook;
  // Part length: 2 minutes of speaking; `?chunk=60` in the address overrides it (10 s at least).
  const chunkSec = Math.max(10, Number(route?.query?.chunk) || CHUNK_SEC);
  const recognitionOn = settings.recognitionEnabled && recorder.recognitionSupported;
  const live = recorder.sittingLive;

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  // Keep the screen awake while a sitting runs (re-acquired when the tab comes back).
  useEffect(() => {
    if (phase !== 'running' || !navigator.wakeLock) return undefined;
    const acquire = () => navigator.wakeLock.request('screen').then((l) => { wakeRef.current = l; }).catch(() => {});
    const onVis = () => { if (document.visibilityState === 'visible') acquire(); };
    acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); wakeRef.current?.release?.().catch(() => {}); wakeRef.current = null; };
  }, [phase]);

  // Checkpoint after every finished chunk: the scores so far (small JSON) and the audio so far.
  const chunkCount = live?.chunks.length || 0;
  useEffect(() => {
    if (phase !== 'running' || !chunkCount || chunkCount === savedChunksRef.current || !engineRef.current) return;
    savedChunksRef.current = chunkCount;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(engineRef.current.checkpoint())); } catch { /* quota: the sitting still runs */ }
    const part = recorder.partialBlob();
    if (part) putAudio(DRAFT_AUDIO, part.blob, part.mime).catch(() => {});
  }, [phase, chunkCount, recorder]);

  async function start() {
    clearDraft();
    setDraft(null);
    savedChunksRef.current = 0;
    const ok = await recorder.startRecording(settings.inputDeviceId, {
      recognition: recognitionOn,
      sitting: (sampleRate) => { engineRef.current = createSitting({ sampleRate, profile, book, chunkSec }); return engineRef.current; },
    });
    if (ok) setPhase('running');
  }

  async function save(summary, blob, mime) {
    const saved = await addSession(sessionFrom({ ...summary, recognitionSupported: recorder.recognitionSupported }), blob, mime);
    clearDraft();
    setDraft(null);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = blob ? URL.createObjectURL(blob) : null;
    setResult({ session: saved, audioUrl: urlRef.current });
    setConfirmDiscard(false);
    setPhase('review');
    requestSpeechReview();
  }

  async function end() {
    setPhase('saving');
    const engine = engineRef.current;
    const rec = await recorder.stopRecording();
    const summary = engine?.finish();
    engineRef.current = null;
    if (!summary) {
      clearDraft();
      toast(t('Nothing was spoken, so nothing was saved.'));
      setPhase('setup');
      return;
    }
    try { await save(summary, rec.blob, rec.mime); } catch (e) { toast(t('Could not save the sitting: {error}', { error: e.message || String(e) })); setPhase('setup'); }
  }

  async function recover() {
    const summary = summarizeSitting(draft);
    const audio = await getAudio(DRAFT_AUDIO).catch(() => null);
    setPhase('saving');
    try { await save(summary, audio?.blob || null, audio?.mime); } catch (e) { toast(t('Could not save the sitting: {error}', { error: e.message || String(e) })); setPhase('setup'); }
  }

  // Space: start, then pause / resume. (Ending is a button, so a stray key never ends an hour.)
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A' || e.target?.isContentEditable) return;
      if (phase === 'setup') { e.preventDefault(); start(); }
      else if (phase === 'running') { e.preventDefault(); if (recorder.paused) recorder.resumeRecording(); else recorder.pauseRecording(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, recorder.paused]);

  if (phase === 'saving') {
    return <div className="empty"><div style={{ fontSize: 40 }}>🧠</div><h3>{t('Putting your sitting together…')}</h3></div>;
  }

  if (phase === 'review' && result) {
    return (
      <div className="stack">
        <div className="row spread wrap" style={{ gap: 10 }}>
          <div>
            <div className="tag">{result.session.exerciseTitle}</div>
            <h1 style={{ margin: '2px 0' }}>{t('Sitting review')}</h1>
          </div>
          <div className="row wrap">
            {confirmDiscard ? (
              <>
                <span className="small">{t('Delete this sitting for good?')}</span>
                <button className="btn danger sm" onClick={async () => { await removeSession(result.session.id); toast(t('Sitting discarded.')); setResult(null); setPhase('setup'); }}>{t('Yes, discard')}</button>
                <button className="btn ghost sm" onClick={() => setConfirmDiscard(false)}>{t('Keep it')}</button>
              </>
            ) : (
              <button className="btn ghost sm danger" onClick={() => setConfirmDiscard(true)}>{t('Discard this sitting')}</button>
            )}
          </div>
        </div>
        <SessionReport session={result.session} audioUrl={result.audioUrl} />
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="row spread wrap" style={{ gap: 12 }}>
            <span className="small muted">{t('This sitting is saved with your recordings.')}</span>
            <div className="row wrap">
              <button className="btn ghost" onClick={() => { setResult(null); setPhase('setup'); }}>↻ {t('New sitting')}</button>
              <button className="btn primary" onClick={() => navigate('')}>{t('Done')}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'running') {
    const speakSec = live?.speakSec || 0;
    const status = recorder.paused ? t('Paused') : live?.onBreak ? t('On a break — speak to carry on') : t('Listening');
    const nudges = live ? driftNudges(live.chunks) : [];
    return (
      <div className="stack">
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="tag">{book ? t('Just speak · reading a book') : t('Just speak')}</div>
          <div className="mono" style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.1 }} role="timer">{formatDuration(speakSec)}</div>
          <div className="small muted" role="status" aria-live="polite">
            {t('speaking time')} · {status}
            {live?.breaks ? <> · {t.n('{n} break', '{n} breaks', live.breaks)}</> : null}
          </div>
          <div className="mic-meter" title={t('Microphone input level')} style={{ maxWidth: 320, margin: '12px auto' }}>
            <span className="mic-dot live" style={{ background: recorder.paused ? 'var(--text-dim)' : 'var(--rec)' }} />
            <div className="mic-meter-track"><div className="mic-meter-fill" style={{ width: `${recorder.paused ? 0 : Math.round(recorder.level * 100)}%` }} /></div>
          </div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: 6 }}>
            {recorder.paused
              ? <button className="btn primary lg" onClick={recorder.resumeRecording}>▶ {t('Resume')}</button>
              : <button className="btn lg" onClick={recorder.pauseRecording}>❚❚ {t('Pause')}</button>}
            <button className="btn rec lg" onClick={end}>■ {t('End & review')}</button>
          </div>
          <p className="tiny muted" style={{ marginTop: 10, marginBottom: 0 }}>
            {t('Space pauses and resumes. Silences longer than a few seconds are not counted. Keep this tab in front for the most accurate scores.')}
          </p>
          {recorder.recognitionError && <p className="tiny" style={{ color: 'var(--warn)', margin: '6px 0 0' }}>⚠️ {recorder.recognitionError}</p>}
        </div>

        {nudges.length > 0 && (
          <div className="card tight" style={{ borderInlineStart: '4px solid var(--warn)' }} role="status" aria-live="polite">
            {nudges.map((id) => <div key={id} className="small">💡 {nudgeText(id)}</div>)}
          </div>
        )}

        <div className="card">
          <div className="card-head">
            <h3>{t('So far')}</h3>
            <span className="tiny muted">{t.n('{n} part scored', '{n} parts scored', chunkCount)} · {t('a new part every {time} of speaking', { time: formatDuration(chunkSec) })}</span>
          </div>
          {chunkCount === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>{t('Your first scores appear after {time} of speaking.', { time: formatDuration(chunkSec) })}</p>
          ) : (
            <div className="row wrap" style={{ gap: 4 }} aria-label={t('Score of each part so far')}>
              {live.chunks.map((c) => (
                <span key={c.i} title={`${formatDuration(c.i * chunkSec)} · ${c.overall}`}
                  style={{ minWidth: 30, padding: '4px 0', textAlign: 'center', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, color: 'var(--bg)', background: tone(c.overall) }}>
                  {c.overall}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h3>{t('This part, live')}</h3>
            <span className="tiny muted">{t('{time} into this part · live estimates', { time: formatDuration(live?.chunkSec || 0) })}</span>
          </div>
          <LiveFeedback metrics={live?.metrics || null} profile={profile} wordCount={live?.wordCount || 0} />
        </div>
      </div>
    );
  }

  // setup
  return (
    <div className="stack">
      {draft && (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          <div className="card-head"><h3>{t('An unfinished sitting was found')}</h3></div>
          <p className="small" style={{ marginTop: 0 }}>
            {t('It stopped unexpectedly after {time} of speaking. You can save what was scored up to then.', { time: formatDuration(draft.chunks.reduce((a, c) => a + c.speakSec, 0)) })}
          </p>
          <div className="row wrap">
            <button className="btn primary" onClick={recover}>{t('Recover it')}</button>
            <button className="btn ghost" onClick={() => { clearDraft(); setDraft(null); }}>{t('Discard it')}</button>
          </div>
        </div>
      )}

      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44 }}>🎙️</div>
        <h2 style={{ margin: '4px 0 8px' }}>{t('Just speak')}</h2>
        <p className="muted small" style={{ maxWidth: 520, margin: '0 auto 14px' }}>
          {t('No topic, no time limit. Talk or read aloud for as long as you like — an hour is fine — and take breaks whenever you want. You are scored in parts as you go, with the full review at the end.')}
        </p>
        <label className="row" style={{ gap: 8, justifyContent: 'center', cursor: 'pointer', marginBottom: 16 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={book} onChange={(e) => updateSettings({ sittingBook: e.target.checked })} />
          <span className="small">{t('I am reading a book aloud (do not score word choice or fillers)')}</span>
        </label>
        <button className="btn rec lg" onClick={start}>● {t('Start speaking')}</button>
        <p className="tiny muted" style={{ marginTop: 10, marginBottom: 0 }}>{t('Or press Space.')}</p>
        {recorder.error && (
          <p className="small" style={{ color: 'var(--bad)', marginTop: 10 }} role="alert">⚠️ {recorder.error}</p>
        )}
        {!recognitionOn && (
          <p className="tiny" style={{ color: 'var(--warn)', marginTop: 10, marginBottom: 0 }}>
            {t('Live transcription is off or not supported here, so pace, fillers and vocabulary will not be scored.')}
          </p>
        )}
      </div>
    </div>
  );
}
