// Trend lines for a sitting, live and in the review. Split so each chart answers
// one question and no chart carries more than four lines:
//   1. Overall: each part's score, and the sitting's running score (where you stand).
//   2-4. The components in three families (voice, melody & flow, words), switchable
//        between the running score and the score of each part.
// The vertical scale zooms to the data, because scores usually sit in a 20-point
// band and a 0-100 axis would flatten every trend.

import { useState } from 'react';
import { runningScores } from '../lib/sitting.js';
import { AttrLabel } from './ui.jsx';
import { t } from '../lib/i18n.js';

const COLORS = ['var(--accent)', 'var(--good)', 'var(--warn)', 'var(--bad)'];
const DASHES = ['', '7 4', '2 4', '9 3 2 3']; // told apart without colour too

const FAMILIES = [
  { id: 'voice', keys: ['projection', 'clarity', 'resonantDepth', 'nonNasal'] },
  { id: 'flow', keys: ['pace', 'expressiveness', 'noUptalk', 'breath'] },
  { id: 'words', keys: ['fillers', 'nonRepetition'] },
];
function familyTitle(id) {
  if (id === 'voice') return t('Voice');
  if (id === 'flow') return t('Melody & flow');
  return t('Words');
}

// series: [{ label, values: [number|null per part], color, dash, bold }]
function TrendChart({ title, hint, series, height = 150, width = 420 }) {
  const all = series.flatMap((s) => s.values).filter((v) => v != null);
  if (!all.length) return null;
  const n = Math.max(...series.map((s) => s.values.length));
  const lo = Math.max(0, Math.floor((Math.min(...all) - 6) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...all) + 6) / 10) * 10);
  const W = width; const padL = 30; const padR = 10; const padT = 8; const padB = 20;
  const xAt = (i) => (n === 1 ? (padL + W - padR) / 2 : padL + (i / (n - 1)) * (W - padL - padR));
  const yAt = (v) => padT + (height - padT - padB) * (1 - (v - lo) / (hi - lo || 1));
  const grid = [lo, Math.round((lo + hi) / 2), hi];
  return (
    <div>
      <div className="row spread wrap" style={{ gap: 6, marginBottom: 2 }}>
        <b className="small">{title}</b>
        {hint && <span className="tiny muted">{hint}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} style={{ display: 'block' }} role="img" aria-label={title}>
        {grid.map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={yAt(g)} y2={yAt(g)} stroke="var(--border)" />
            <text x={padL - 5} y={yAt(g) + 3.5} textAnchor="end" fontSize="10" fill="var(--text-dim)">{g}</text>
          </g>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : [xAt(i), yAt(v)])).filter(Boolean);
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
          return (
            <g key={s.key}>
              {pts.length > 1 && <path d={d} fill="none" stroke={s.color} strokeWidth={s.bold ? 3 : 1.8} strokeDasharray={s.dash || undefined} strokeLinejoin="round" strokeLinecap="round" />}
              {(pts.length === 1 || s.dots) && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={s.bold ? 3.5 : 2.6} fill={s.color} />)}
            </g>
          );
        })}
        <text x={padL} y={height - 5} fontSize="10" fill="var(--text-dim)">1</text>
        {n > 1 && <text x={W - padR} y={height - 5} textAnchor="end" fontSize="10" fill="var(--text-dim)">{n}</text>}
      </svg>
      <div className="row wrap" style={{ gap: '2px 12px' }}>
        {series.map((s) => {
          const last = [...s.values].reverse().find((v) => v != null);
          return (
            <span key={s.key} className="tiny" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg width="22" height="8" aria-hidden="true"><line x1="1" x2="21" y1="4" y2="4" stroke={s.color} strokeWidth={s.bold ? 3 : 2} strokeDasharray={s.dash || undefined} /></svg>
              {s.label} <b className="mono">{last ?? '–'}</b>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function SittingTrends({ chunks }) {
  const [view, setView] = useState('running'); // components: running score | each part
  if (!chunks?.length) return null;
  const running = runningScores(chunks);
  const source = view === 'running' ? running : chunks;

  const overall = [
    { key: 'running', label: t('Sitting score so far'), values: running.map((r) => r.overall), color: 'var(--accent)', bold: true },
    { key: 'parts', label: t('Each part'), values: chunks.map((c) => c.overall), color: 'var(--text-dim)', dash: '2 4', dots: true },
  ];

  return (
    <div className="stack" style={{ gap: 14 }}>
      <TrendChart title={t('Overall')} hint={t('part 1 to part {n}', { n: chunks.length })} series={overall} height={170} width={900} />

      <div className="row spread wrap" style={{ gap: 8 }}>
        <b className="small">{t('Components')}</b>
        <div className="pill-group">
          <button type="button" className={`pill ${view === 'running' ? 'active' : ''}`} aria-pressed={view === 'running'} onClick={() => setView('running')}>{t('Score so far')}</button>
          <button type="button" className={`pill ${view === 'parts' ? 'active' : ''}`} aria-pressed={view === 'parts'} onClick={() => setView('parts')}>{t('Each part')}</button>
        </div>
      </div>
      <div className="grid cols-3" style={{ gap: 14 }}>
        {FAMILIES.map((f) => {
          const series = f.keys
            .map((k, i) => ({ key: k, label: <AttrLabel attrKey={k} />, values: source.map((r) => r.scores[k]), color: COLORS[i], dash: DASHES[i], dots: view === 'parts' }))
            .filter((s) => s.values.some((v) => v != null));
          return series.length ? <TrendChart key={f.id} title={familyTitle(f.id)} series={series} /> : null;
        })}
      </div>
    </div>
  );
}
