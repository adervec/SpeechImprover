// "Hear an improved version of your voice" — on demand, re-processes the user's
// own recording (EQ, dynamics, pacing, silence editing) targeting the weaknesses
// the session measured, and lets them A/B it against the original.

import { useEffect, useRef, useState } from 'react';
import { enhanceRecording } from '../lib/audioEnhance.js';
import { formatDuration } from '../lib/format.js';
import RecordingAudio from './RecordingAudio.jsx';

export default function ImprovedVoicePreview({ audioUrl, session }) {
  const [status, setStatus] = useState('idle'); // idle | working | ready | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const urlRef = useRef(null);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  async function generate() {
    setStatus('working');
    setError('');
    try {
      const blob = await fetch(audioUrl).then((r) => r.blob());
      const res = await enhanceRecording(blob, { metrics: session.metrics, scores: session.scores });
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = res.url;
      setResult(res);
      setStatus('ready');
    } catch (e) {
      setError(e.message || String(e));
      setStatus('error');
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>✨ Hear an improved version of your voice</h3>
          <span className="tiny muted">your own recording, re-processed to target your weak spots — not a synthetic voice</span>
        </div>
        <button className="btn primary sm" onClick={generate} disabled={status === 'working'}>
          {status === 'working' ? 'Processing…' : status === 'ready' ? '↻ Regenerate' : '✨ Generate preview'}
        </button>
      </div>

      {status === 'idle' && (
        <p className="muted small">
          Build a cleaned-up take that steadies your projection, sharpens clarity, tightens over-long
          pauses and eases your pace toward the ideal band — then compare it back to back with your original.
        </p>
      )}
      {status === 'working' && (
        <p className="muted small">Processing your audio locally — evening out level, EQ and pacing…</p>
      )}
      {status === 'error' && (
        <p className="small" style={{ color: 'var(--bad)' }}>⚠️ Couldn’t process this clip: {error}</p>
      )}

      {status === 'ready' && result && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="grid cols-2">
            <div>
              <div className="tag">Original</div>
              <RecordingAudio src={audioUrl} style={{ marginTop: 6 }} />
            </div>
            <div>
              <div className="tag" style={{ color: 'var(--good)' }}>Improved</div>
              <RecordingAudio src={result.url} style={{ marginTop: 6 }} />
            </div>
          </div>

          <div className="row wrap" style={{ gap: 8 }}>
            {result.before.wpm && result.after.wpm && result.before.wpm !== result.after.wpm && (
              <span className="badge">Pace {result.before.wpm} → <b style={{ color: 'var(--good)' }}>{result.after.wpm}</b> wpm</span>
            )}
            <span className="badge">
              Length {formatDuration(result.before.durationSec)} → {formatDuration(result.after.durationSec)}
            </span>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            {result.steps.map((s, i) => (
              <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.1rem', lineHeight: 1.2 }}>{s.icon}</span>
                <div>
                  <b className="small">{s.label}</b>
                  <p className="tiny muted" style={{ margin: 0 }}>{s.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="tiny muted">
            A digital-signal-processing enhancement of your real recording (EQ, dynamics, pacing) — a target
            to aim for, not an AI voice clone. Pitch and identity are preserved.
          </p>
        </div>
      )}
    </div>
  );
}
