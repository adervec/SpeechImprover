// Waveform trim/split editor for one recording. Decodes the take, draws a zoomable
// waveform, and lets you drag in/out handles (trim) and drop split points (cut one take
// into several). "Apply" hands back a region [start,end] + cut times; the caller turns
// that into one trimmed track or N split tracks (each a segment of the same recording),
// which the audiobook export already honors via segment startSec/endSec.

import { useEffect, useMemo, useRef, useState } from 'react';
import { decodeBlob } from '../lib/analysis/audioAnalysis.js';
import { formatDuration } from '../lib/format.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cssVar = (name, fb) => {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; }
  catch { return fb; }
};

export default function WaveformEditor({ session, getAudioBlob, initialStart = 0, initialEnd = null, onApply, onClose }) {
  const [state, setState] = useState('loading'); // loading | ready | error
  const [err, setErr] = useState('');
  const [duration, setDuration] = useState(0);
  const [region, setRegion] = useState([0, 0]);
  const [cuts, setCuts] = useState([]);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pxPerSec, setPxPerSec] = useState(80);

  const peaksRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const dragRef = useRef(null); // 'start' | 'end' | null

  // Load blob → decode → downsampled peak envelope (abs-max per bucket) for fast redraw.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const blob = await getAudioBlob(session.audioId);
        if (!blob) throw new Error('No audio stored for this recording.');
        urlRef.current = URL.createObjectURL(blob);
        const buf = await decodeBlob(blob);
        if (cancelled) return;
        const ch = buf.numberOfChannels;
        const len = buf.length;
        const mono = new Float32Array(len);
        for (let c = 0; c < ch; c += 1) {
          const d = buf.getChannelData(c);
          for (let i = 0; i < len; i += 1) mono[i] += d[i] / ch;
        }
        const N = 4000;
        const peaks = new Float32Array(N);
        const block = Math.max(1, Math.floor(len / N));
        for (let i = 0; i < N; i += 1) {
          let m = 0;
          const s = i * block;
          for (let j = 0; j < block && s + j < len; j += 1) { const a = Math.abs(mono[s + j]); if (a > m) m = a; }
          peaks[i] = m;
        }
        peaksRef.current = peaks;
        const dur = buf.duration;
        setDuration(dur);
        setRegion([clamp(initialStart, 0, dur), clamp(initialEnd == null ? dur : initialEnd, 0, dur)]);
        setState('ready');
      } catch (e) {
        if (!cancelled) { setErr(e.message || String(e)); setState('error'); }
      }
    })();
    return () => { cancelled = true; if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, [session.audioId, getAudioBlob, initialStart, initialEnd]);

  const pxWidth = useMemo(() => {
    if (!duration) return 800;
    const wrapW = wrapRef.current?.clientWidth || 800;
    return Math.round(clamp(duration * pxPerSec, wrapW, 12000));
  }, [duration, pxPerSec]);

  // Draw waveform + region shading + cut markers (NOT the playhead — that's a cheap DOM
  // overlay so 60fps playback never re-rasterizes the wave).
  useEffect(() => {
    if (state !== 'ready') return;
    const cv = canvasRef.current;
    const peaks = peaksRef.current;
    if (!cv || !peaks) return;
    const w = pxWidth;
    const h = 140;
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    const accent = cssVar('--accent', '#7c6cff');
    const dim = cssVar('--border', '#2c3350');
    const good = cssVar('--good', '#34d399');
    const warn = cssVar('--warn', '#fbbf24');
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    for (let x = 0; x < w; x += 1) {
      const p = peaks[Math.floor((x / w) * peaks.length)] || 0;
      const barH = Math.max(1, p * (h * 0.88));
      const t = (x / w) * duration;
      const inside = t >= region[0] && t <= region[1];
      ctx.fillStyle = inside ? accent : dim;
      ctx.globalAlpha = inside ? 1 : 0.45;
      ctx.fillRect(x, mid - barH / 2, 1, barH);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = good;
    ctx.fillRect((region[0] / duration) * w - 1, 0, 2, h);
    ctx.fillRect((region[1] / duration) * w - 1, 0, 2, h);
    ctx.fillStyle = warn;
    for (const c of cuts) ctx.fillRect((c / duration) * w - 1, 0, 2, h);
  }, [state, pxWidth, region, cuts, duration]);

  // Playback loop: advance the playhead, and stop at the out-point so you preview the keep.
  useEffect(() => {
    if (!playing) return undefined;
    let raf;
    const tick = () => {
      const a = audioRef.current;
      if (a) {
        if (a.currentTime >= region[1]) { a.pause(); setPlaying(false); setPlayhead(region[1]); return; }
        setPlayhead(a.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, region]);

  function xToTime(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return clamp(((e.clientX - r.left) / r.width) * duration, 0, duration);
  }
  function onDown(e) {
    const t = xToTime(e);
    const r = canvasRef.current.getBoundingClientRect();
    const tol = (9 / r.width) * duration;
    if (Math.abs(t - region[0]) < tol) dragRef.current = 'start';
    else if (Math.abs(t - region[1]) < tol) dragRef.current = 'end';
    else { seek(t); dragRef.current = null; }
  }
  function onMove(e) {
    if (!dragRef.current) return;
    const t = xToTime(e);
    setRegion(([s, en]) => (dragRef.current === 'start' ? [clamp(t, 0, en - 0.05), en] : [s, clamp(t, s + 0.05, duration)]));
  }
  function onUp() { dragRef.current = null; }

  function seek(t) {
    setPlayhead(t);
    const a = audioRef.current;
    if (a) a.currentTime = t;
  }
  function playPause() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); return; }
    if (playhead < region[0] || playhead >= region[1]) { a.currentTime = region[0]; setPlayhead(region[0]); }
    a.play(); setPlaying(true);
  }
  function addCut() {
    if (playhead > region[0] + 0.05 && playhead < region[1] - 0.05) {
      setCuts((c) => [...c.filter((x) => Math.abs(x - playhead) > 0.02), playhead].sort((a, b) => a - b));
    }
  }
  function onLoadedMeta(e) {
    // resolve Infinity duration on webm blobs so seeking is reliable
    const el = e.currentTarget;
    if (el.duration === Infinity || Number.isNaN(el.duration)) {
      const reset = () => { el.removeEventListener('timeupdate', reset); el.currentTime = 0; };
      el.addEventListener('timeupdate', reset);
      el.currentTime = 1e101;
    }
  }

  const trimmedAway = duration ? region[0] + (duration - region[1]) : 0;
  const pieceCount = cuts.filter((c) => c > region[0] && c < region[1]).length + 1;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 'min(960px, 96vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h3>✂ Edit “{session.alias || session.exerciseTitle || 'recording'}”</h3>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>

        {state === 'loading' && <p className="muted small">Decoding audio…</p>}
        {state === 'error' && <p className="small" style={{ color: 'var(--bad)' }}>⚠️ {err}</p>}
        {state === 'ready' && (
          <>
            <p className="tiny muted" style={{ marginBottom: 8 }}>
              Drag the green handles to trim. Move the playhead (click) and “Split here” to cut this take into
              several tracks. The dimmed audio outside the handles is removed on export.
            </p>
            <div ref={wrapRef} style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-2)' }}>
              <div style={{ position: 'relative', width: pxWidth, height: 140 }}>
                <canvas
                  ref={canvasRef}
                  style={{ display: 'block', width: pxWidth, height: 140, cursor: 'pointer', touchAction: 'none' }}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerLeave={onUp}
                />
                <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: '#fff', pointerEvents: 'none', left: duration ? (playhead / duration) * pxWidth : 0 }} />
              </div>
            </div>

            <div className="row spread wrap" style={{ marginTop: 10, gap: 10 }}>
              <div className="row wrap" style={{ gap: 8 }}>
                <button className="btn sm primary" onClick={playPause}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
                <button className="btn sm" onClick={() => seek(region[0])}>⏮ In-point</button>
                <button className="btn sm" onClick={addCut}>✂ Split here</button>
              </div>
              <label className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span className="tiny muted">Zoom</span>
                <input type="range" min={20} max={400} step={10} value={pxPerSec} onChange={(e) => setPxPerSec(Number(e.target.value))} style={{ width: 120, padding: 0 }} />
              </label>
            </div>

            <div className="row wrap" style={{ gap: 14, marginTop: 10 }}>
              <span className="tiny muted">In <b className="mono">{formatDuration(region[0])}</b></span>
              <span className="tiny muted">Out <b className="mono">{formatDuration(region[1])}</b></span>
              <span className="tiny muted">Keep <b className="mono">{formatDuration(region[1] - region[0])}</b></span>
              {trimmedAway > 0.05 && <span className="tiny muted">Trim <b className="mono">{formatDuration(trimmedAway)}</b></span>}
              {pieceCount > 1 && <span className="badge">→ {pieceCount} tracks</span>}
            </div>

            {cuts.length > 0 && (
              <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                {cuts.map((c, i) => (
                  <span key={i} className="badge" style={{ cursor: 'pointer' }} title="Remove split"
                    onClick={() => setCuts((cs) => cs.filter((_, k) => k !== i))}>
                    ✂ {formatDuration(c)} ✕
                  </span>
                ))}
              </div>
            )}

            <div className="row spread" style={{ marginTop: 16 }}>
              <button className="btn ghost sm" onClick={() => { setRegion([0, duration]); setCuts([]); }}>Reset</button>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={onClose}>Cancel</button>
                <button className="btn primary" onClick={() => onApply(region, cuts.filter((c) => c > region[0] && c < region[1]))}>
                  {pieceCount > 1 ? `Apply — split into ${pieceCount}` : 'Apply trim'}
                </button>
              </div>
            </div>

            <audio ref={audioRef} src={urlRef.current || undefined} onLoadedMetadata={onLoadedMeta} style={{ display: 'none' }} />
          </>
        )}
      </div>
    </div>
  );
}
