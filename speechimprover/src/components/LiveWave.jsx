// Live sound monitor for non-verbal exercises (humming, breath work, sustained
// tones) — a scrolling waveform of the last ~15s with a pitch trace overlaid.
// Bars: accent = voiced (pitched hum), green = unvoiced sound (breath/hiss),
// dim = silence. The white line is the hum's pitch on a log scale (70–400 Hz),
// so "glide up and down" is literally visible. Data = liveMetrics.history.

import { useEffect, useRef } from 'react';
import { MIN_F0, MAX_F0 } from '../lib/analysis/audioAnalysis.js';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function noteName(hz) {
  if (!hz) return '';
  const n = Math.round(12 * Math.log2(hz / 440)) + 69; // MIDI note number
  return `${NOTES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}

const cssVar = (name, fb) => {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; }
  catch { return fb; }
};

export default function LiveWave({ history = [] }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const w = cv.clientWidth || 600;
    const h = 120;
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if (!history.length) return;

    const accent = cssVar('--accent', '#7c6cff');
    const good = cssVar('--good', '#34d399');
    const dim = cssVar('--border', '#2c3350');
    const text = cssVar('--text', '#e8eaf2');

    const maxRms = Math.max(1e-4, ...history.map((p) => p.rms));
    const bw = w / 140; // fixed slot width = the analyzer's history cap, scrolls right→left
    for (let i = 0; i < history.length; i += 1) {
      const p = history[i];
      const x = w - (history.length - i) * bw;
      const bh = Math.max(2, (p.rms / maxRms) * (h * 0.9));
      ctx.fillStyle = p.f0 ? accent : p.speech ? good : dim;
      ctx.globalAlpha = p.f0 || p.speech ? 0.9 : 0.45;
      ctx.fillRect(x, (h - bh) / 2, Math.max(1, bw - 1.5), bh);
    }

    // Pitch trace (log scale MIN_F0..MAX_F0), broken across unvoiced gaps.
    ctx.globalAlpha = 1;
    ctx.strokeStyle = text;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const lo = Math.log2(MIN_F0);
    const span = Math.log2(MAX_F0) - lo;
    let pen = false;
    for (let i = 0; i < history.length; i += 1) {
      const p = history[i];
      if (!p.f0) { pen = false; continue; }
      const x = w - (history.length - i) * bw + bw / 2;
      const y = h - ((Math.log2(p.f0) - lo) / span) * (h - 10) - 5;
      if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      pen = true;
    }
    ctx.stroke();
  }, [history]);

  const voiced = history.filter((p) => p.f0 > 0);
  const cur = voiced.length ? voiced[voiced.length - 1].f0 : 0;
  const loHz = voiced.length ? Math.min(...voiced.map((p) => p.f0)) : 0;
  const hiHz = voiced.length ? Math.max(...voiced.map((p) => p.f0)) : 0;
  const soundPct = history.length ? Math.round((history.filter((p) => p.speech).length / history.length) * 100) : 0;

  return (
    <div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 120, display: 'block' }} aria-label="Live sound waveform" />
      <div className="row wrap" style={{ gap: 16, marginTop: 8 }}>
        <span className="tiny muted">Pitch <b className="mono" style={{ color: cur ? 'var(--accent)' : undefined }}>{cur ? `${Math.round(cur)} Hz · ${noteName(cur)}` : '—'}</b></span>
        {hiHz > 0 && <span className="tiny muted">Glide range <b className="mono">{Math.round(loHz)}–{Math.round(hiHz)} Hz</b></span>}
        <span className="tiny muted">Sound <b className="mono">{soundPct}%</b> of the window</span>
      </div>
    </div>
  );
}
