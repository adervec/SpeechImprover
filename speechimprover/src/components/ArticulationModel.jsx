// Animated reference of the *ideal* lip, tongue and jaw movements for a piece of
// text. Two synced views — front (lips) and sagittal cross-section (tongue/jaw) —
// morph through a timed viseme track in real time so the speaker can mimic them.
// Can run on its own (Play) or follow along automatically while recording.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  VISEMES,
  textToVisemes,
  wpmToSpeed,
  lerpViseme,
} from '../lib/articulation.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------- front view (lips, teeth, tongue tip) ----------
function FrontView({ g }) {
  const cx = 60;
  const cy = 60;
  const w = clamp(15 + 25 * g.lipSpread - 10 * g.lipRound, 8, 42);
  const open = 1.5 + 32 * g.lipOpen;
  const top = cy - open;
  const bot = cy + open;
  const leftX = cx - w;
  const rightX = cx + w;
  const upperLipH = 7 + 6 * g.lipRound;
  const lowerLipH = 9 + 6 * g.lipRound;
  const showUpperTeeth = open > 4;
  const showLowerTeeth = g.jaw > 0.6 && open > 9;
  const tipUp = g.tongueTip > 0.7 && !g.tipTeeth;

  return (
    <svg viewBox="0 0 120 120" className="artic-svg" role="img" aria-label="Front view of mouth">
      <ellipse cx={cx} cy={cy} rx={48} ry={50} fill="color-mix(in srgb, var(--surface-2) 60%, transparent)" />
      {/* mouth opening */}
      <ellipse cx={cx} cy={cy} rx={Math.max(2, w * 0.9)} ry={Math.max(1, open)} fill="var(--bg)" />
      {/* upper teeth */}
      {showUpperTeeth && (
        <rect x={cx - w * 0.72} y={top + 0.5} width={w * 1.44} height={Math.min(7, open * 0.9)} rx="2"
          fill="#f3f4fb" stroke="color-mix(in srgb, var(--text-dim) 40%, transparent)" strokeWidth="0.5" />
      )}
      {/* lower teeth */}
      {showLowerTeeth && (
        <rect x={cx - w * 0.6} y={bot - Math.min(6, open * 0.7)} width={w * 1.2} height={Math.min(6, open * 0.7)} rx="2"
          fill="#e9eaf3" />
      )}
      {/* tongue tip raised (t/d/l/s) */}
      {tipUp && (
        <ellipse cx={cx} cy={top + Math.min(8, open * 0.9)} rx={w * 0.5} ry={Math.min(5, open * 0.5)}
          fill="color-mix(in srgb, var(--bad) 70%, #d23)" />
      )}
      {/* tongue between teeth (th) */}
      {g.tipTeeth && (
        <ellipse cx={cx} cy={cy} rx={w * 0.55} ry={3.2} fill="color-mix(in srgb, var(--bad) 70%, #d23)" />
      )}
      {/* lips */}
      <path d={`M ${leftX} ${cy} Q ${cx} ${cy - open - upperLipH} ${rightX} ${cy} Q ${cx} ${top} ${leftX} ${cy} Z`}
        fill="var(--bad)" opacity="0.92" />
      <path d={`M ${leftX} ${cy} Q ${cx} ${cy + open + lowerLipH} ${rightX} ${cy} Q ${cx} ${bot} ${leftX} ${cy} Z`}
        fill="var(--bad)" opacity="0.8" />
    </svg>
  );
}

// ---------- sagittal view (cross-section: palate, jaw, tongue, lips) ----------
function SagittalView({ g }) {
  const floor = 78 + g.jaw * 14;
  const jawAngle = g.jaw * 15;
  const hx = 42 + g.tongueX * 42;
  const hy = floor - (10 + g.tongueY * 36);
  const backY = floor - (6 + g.tongueY * (g.tongueX < 0.5 ? 34 : 16));
  let tx = 66 + g.tongueX * 20;
  let ty = floor - (5 + g.tongueTip * 30);
  if (g.tipTeeth) { tx = 92; ty = 54; }
  const protr = g.lipRound * 5;
  const lipGap = 2 + g.lipOpen * 9;

  const tonguePath =
    `M 32 ${floor} C ${34} ${backY} ${hx - 12} ${hy} ${hx} ${hy} ` +
    `S ${tx - 8} ${ty} ${tx} ${ty} L ${tx} ${floor} Z`;

  return (
    <svg viewBox="0 0 130 120" className="artic-svg" role="img" aria-label="Cross-section of mouth showing tongue and jaw">
      {/* head / face backdrop */}
      <path d="M 30 18 Q 96 14 104 44 L 112 50 Q 114 54 108 56 L 100 58 Q 98 66 92 68 L 92 96 Q 70 112 36 104 L 30 96 Z"
        fill="color-mix(in srgb, var(--surface-2) 55%, transparent)" stroke="var(--border)" strokeWidth="1" />
      {/* nose hint */}
      <path d="M 104 44 L 112 50 Q 114 54 108 56" fill="none" stroke="var(--text-dim)" strokeWidth="1" opacity="0.6" />
      {/* hard palate (roof) */}
      <path d="M 34 50 Q 62 38 90 50" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" />
      {/* soft palate / velum */}
      <path d="M 34 50 Q 30 58 33 64" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" opacity="0.7" />
      {/* upper teeth */}
      <rect x="87" y="50" width="5" height="9" rx="1" fill="#f3f4fb" />
      {/* pharynx back wall */}
      <line x1="31" y1="50" x2="31" y2="92" stroke="var(--border)" strokeWidth="1.5" />

      {/* lower jaw (rotates open) */}
      <g transform={`rotate(${jawAngle} 33 74)`}>
        <path d="M 33 74 Q 70 88 92 80 L 92 92 Q 64 104 36 96 Z"
          fill="color-mix(in srgb, var(--surface) 80%, transparent)" stroke="var(--border)" strokeWidth="1" />
        <rect x="87" y="70" width="5" height="9" rx="1" fill="#e9eaf3" />
      </g>

      {/* tongue */}
      <path d={tonguePath}
        fill="color-mix(in srgb, var(--bad) 62%, #c0304a)" stroke="color-mix(in srgb, var(--bad) 80%, #000)" strokeWidth="1" />
      {(g.tongueTip > 0.55 || g.tipTeeth) && (
        <circle cx={tx} cy={ty} r="2.4" fill="var(--warn)" />
      )}

      {/* lips at the front */}
      <ellipse cx={97 + protr} cy={60 - lipGap} rx={4} ry={3 + g.lipRound * 2.5} fill="var(--bad)" />
      <ellipse cx={97 + protr} cy={60 + lipGap + g.jaw * 6} rx={4} ry={3 + g.lipRound * 2.5} fill="var(--bad)" opacity="0.85" />
      {g.teethLip && <rect x="94" y={60 + lipGap} width="5" height="3.5" rx="1" fill="#f3f4fb" />}
    </svg>
  );
}

// Pure: resolve the posture + caption for a given elapsed time within a track.
function computeFrame(elapsed, track, cum, total) {
  let i = 0;
  while (i < track.length - 1 && cum[i + 1] <= elapsed) i += 1;
  const seg = track[i] || track[track.length - 1] || { v: 'rest', label: '·', word: '', durationMs: 1 };
  const segStart = cum[i] ?? 0;
  const segDur = seg.durationMs || 1;
  const prevId = i > 0 ? track[i - 1].v : 'rest';
  const t = clamp((elapsed - segStart) / (segDur * 0.6), 0, 1);
  return {
    geom: lerpViseme(prevId, seg.v, t),
    label: seg.label,
    tip: VISEMES[seg.v]?.tip || '',
    word: seg.word,
    progress: clamp(elapsed / total, 0, 1),
  };
}

export default function ArticulationModel({ text, targetWpm = 130, recording = false, compact = false }) {
  const [speedMult, setSpeedMult] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [followAlong, setFollowAlong] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);

  const speed = wpmToSpeed(targetWpm) * speedMult;

  const { track, cum, total } = useMemo(() => {
    const t = textToVisemes(text || '', { speed });
    const c = [0];
    for (let i = 0; i < t.length; i += 1) c.push(c[i] + t[i].durationMs);
    return { track: t, cum: c, total: c[c.length - 1] || 1 };
  }, [text, speed]);

  const pausedElapsedRef = useRef(0);
  const startWallRef = useRef(0);

  // While recording with follow-along on, playback is forced; otherwise it's the
  // manual play state. (Parent remounts via `key` to reset when the text changes.)
  const guiding = recording && followAlong;
  const effectivePlaying = guiding || playing;

  const frame = useMemo(() => computeFrame(elapsedMs, track, cum, total), [elapsedMs, track, cum, total]);

  // The animation loop. Ref mutations happen here (inside the effect/its callback,
  // never during render); setElapsedMs runs inside the rAF callback so it doesn't
  // cascade synchronously from the effect body.
  useEffect(() => {
    if (!effectivePlaying) return undefined;
    if (recording) pausedElapsedRef.current = 0; // recording always starts at the top
    startWallRef.current = performance.now() - pausedElapsedRef.current;
    let raf;
    const step = (now) => {
      let e = now - startWallRef.current;
      if (e >= total) {
        if (loop) {
          startWallRef.current = now;
          e = 0;
        } else {
          pausedElapsedRef.current = total;
          setElapsedMs(total);
          setPlaying(false);
          return;
        }
      }
      pausedElapsedRef.current = e;
      setElapsedMs(e);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [effectivePlaying, recording, loop, total]);

  const togglePlay = () => {
    // restart from the top if we're sitting at the end
    if (!playing && pausedElapsedRef.current >= total - 1) {
      pausedElapsedRef.current = 0;
      startWallRef.current = performance.now();
      setElapsedMs(0);
    }
    setPlaying((p) => !p);
  };
  const restart = () => {
    pausedElapsedRef.current = 0;
    startWallRef.current = performance.now();
    setElapsedMs(0);
    setPlaying(true);
  };
  const seek = (frac) => {
    const e = clamp(frac, 0, 1) * total;
    pausedElapsedRef.current = e;
    startWallRef.current = performance.now() - e;
    setElapsedMs(e);
  };

  const g = frame.geom;
  return (
    <div className="artic">
      <div className="artic-views">
        <figure>
          <FrontView g={g} />
          <figcaption className="tiny muted">Lips (front)</figcaption>
        </figure>
        <figure>
          <SagittalView g={g} />
          <figcaption className="tiny muted">Tongue &amp; jaw (cross-section)</figcaption>
        </figure>
      </div>

      <div className="artic-readout">
        <span className="artic-sound mono">{frame.label}</span>
        {frame.word && <span className="artic-word">{frame.word}</span>}
        {guiding && <span className="badge needs-work">● guiding</span>}
      </div>
      <p className="tiny muted artic-tip">{frame.tip || 'Press play to see the ideal movements.'}</p>

      {/* progress / scrub */}
      <div
        className="artic-progress"
        role="slider"
        aria-label="Animation progress"
        aria-valuenow={Math.round(frame.progress * 100)}
        tabIndex={0}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          seek((e.clientX - r.left) / r.width);
        }}
      >
        <div className="artic-progress-fill" style={{ width: `${frame.progress * 100}%` }} />
      </div>

      <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
        <button className="btn sm primary" onClick={togglePlay} disabled={guiding}>
          {effectivePlaying ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button className="btn sm ghost" onClick={restart}>↺ Restart</button>
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <span className="tiny muted">Speed</span>
          <select value={speedMult} onChange={(e) => setSpeedMult(Number(e.target.value))} style={{ width: 'auto' }}>
            <option value={0.6}>0.6×</option>
            <option value={0.8}>0.8×</option>
            <option value={1}>1×</option>
            <option value={1.3}>1.3×</option>
          </select>
        </label>
        <button className={`pill ${loop ? 'active' : ''}`} onClick={() => setLoop((l) => !l)}>⟳ Loop</button>
        {!compact && (
          <button className={`pill ${followAlong ? 'active' : ''}`} onClick={() => setFollowAlong((f) => !f)}
            title="Auto-play this model while you record">
            ⏺ Follow while recording
          </button>
        )}
      </div>
    </div>
  );
}
