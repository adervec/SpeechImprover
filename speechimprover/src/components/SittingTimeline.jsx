// The review of a long sitting: any attribute charted across its parts, the
// strongest and weakest parts with playback from that spot, and where things
// drifted. Shown by SessionReport when the session has `chunks`.

import { useRef, useState } from 'react';
import { ATTRIBUTES } from '../lib/analysis/attributes.js';
import { driftNudges } from '../lib/sitting.js';
import { formatDuration } from '../lib/format.js';
import RecordingAudio from './RecordingAudio.jsx';
import SittingTrends from './SittingTrends.jsx';
import { AttrLabel } from './ui.jsx';
import { t } from '../lib/i18n.js';

function driftText(id) {
  switch (id) {
    case 'paceUp': return t('Your pace crept up over the sitting.');
    case 'paceDown': return t('Your pace dropped over the sitting.');
    case 'energyFading': return t('Your energy faded over the sitting.');
    case 'pitchFlattening': return t('Your pitch flattened over the sitting.');
    case 'clarityFading': return t('Your consonants softened over the sitting.');
    case 'fillersRising': return t('Fillers crept in over the sitting.');
    default: return '';
  }
}

function PartRow({ c, title, from, onPlay }) {
  return (
    <div className="row spread wrap" style={{ gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="small">
        <b>{title}</b> · {t('part {n}, from {time}', { n: c.i + 1, time: formatDuration(from) })} · {t('score {score}', { score: c.overall })}
        {c.wpm ? <> · {c.wpm} wpm</> : null}
      </span>
      {onPlay && <button className="btn ghost sm" onClick={onPlay}>▶ {t('Play from here')}</button>}
    </div>
  );
}

export default function SittingTimeline({ session, audioUrl }) {
  const [key, setKey] = useState('overall');
  const audioRef = useRef(null);
  const chunks = session.chunks || [];
  if (chunks.length < 2) return null;

  const value = (c) => (key === 'overall' ? c.overall : key === 'wpm' ? c.wpm : c.scores[key]);
  const keys = ['overall', 'wpm', ...ATTRIBUTES.map((a) => a.key).filter((k) => chunks.some((c) => c.scores[k] != null))];
  const label = (k) => (k === 'overall' ? t('Overall') : k === 'wpm' ? t('Pace (wpm)') : <AttrLabel attrKey={k} />);

  // x = speaking time at the middle of each part
  const startOf = (c) => chunks.slice(0, c.i).reduce((a, x) => a + x.speakSec, 0);
  const pts = chunks.map((c) => ({ c, x: startOf(c) + c.speakSec / 2, v: value(c) })).filter((p) => p.v != null);
  const total = chunks.reduce((a, c) => a + c.speakSec, 0);
  const W = 640; const H = 170; const padL = 34; const padR = 10; const padT = 10; const padB = 22;
  const yMax = key === 'wpm' ? Math.max(220, ...pts.map((p) => p.v)) : 100;
  const xAt = (x) => padL + (x / total) * (W - padL - padR);
  const yAt = (v) => padT + (H - padT - padB) * (1 - v / yMax);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${xAt(p.x).toFixed(1)},${yAt(p.v).toFixed(1)}`).join(' ');

  const ranked = [...chunks].sort((a, b) => b.overall - a.overall);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const play = (c) => { const el = audioRef.current; if (!el) return; el.currentTime = c.recStart; el.play().catch(() => {}); };
  const drift = driftNudges(chunks);

  return (
    <div className="card">
      <div className="card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h3>{t('Across the sitting')}</h3>
        <span className="tiny muted">
          {t('{time} of speaking', { time: formatDuration(session.durationSec) })} · {t.n('{n} part', '{n} parts', chunks.length)}
          {session.breaks ? <> · {t.n('{n} break', '{n} breaks', session.breaks)}</> : null}
          {session.book ? <> · {t('book reading: word choice not scored')}</> : null}
        </span>
      </div>
      <div className="pill-group" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
        {keys.map((k) => (
          <button key={k} type="button" className={`pill ${k === key ? 'active' : ''}`} aria-pressed={k === key} onClick={() => setKey(k)}>{label(k)}</button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }} role="img" aria-label={t('Score of each part across the sitting')}>
        {(key === 'wpm' ? [0, 100, 200] : [0, 50, 100]).map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={yAt(g)} y2={yAt(g)} stroke="var(--border)" />
            <text x={padL - 6} y={yAt(g) + 4} textAnchor="end" fontSize="10" fill="var(--text-dim)">{g}</text>
          </g>
        ))}
        {key === 'wpm' && <rect x={padL} width={W - padL - padR} y={yAt(150)} height={yAt(110) - yAt(150)} fill="color-mix(in srgb, var(--good) 14%, transparent)" />}
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p) => (
          <circle key={p.c.i} cx={xAt(p.x)} cy={yAt(p.v)} r="3.5" fill="var(--accent)" style={{ cursor: audioUrl ? 'pointer' : 'default' }} onClick={() => play(p.c)}>
            <title>{`${formatDuration(startOf(p.c))}: ${Math.round(p.v)}`}</title>
          </circle>
        ))}
        <text x={padL} y={H - 5} fontSize="10" fill="var(--text-dim)">0:00</text>
        <text x={W - padR} y={H - 5} textAnchor="end" fontSize="10" fill="var(--text-dim)">{formatDuration(total)}</text>
      </svg>

      {drift.length > 0 && (
        <div style={{ marginTop: 8 }}>{drift.map((id) => <div key={id} className="small">💡 {driftText(id)}</div>)}</div>
      )}

      <div style={{ marginTop: 8 }}>
        <PartRow c={best} title={`✅ ${t('Strongest part')}`} from={startOf(best)} onPlay={audioUrl ? () => play(best) : null} />
        {best.i !== worst.i && <PartRow c={worst} title={`🎯 ${t('Weakest part')}`} from={startOf(worst)} onPlay={audioUrl ? () => play(worst) : null} />}
      </div>
      <details style={{ marginTop: 12 }}>
        <summary className="small" style={{ cursor: 'pointer', fontWeight: 700 }}>{t('Trend lines: overall and every component')}</summary>
        <div style={{ marginTop: 10 }}><SittingTrends chunks={chunks} /></div>
      </details>
      {audioUrl && (
        <div style={{ marginTop: 10 }}>
          <RecordingAudio src={audioUrl} audioRef={audioRef} />
          <span className="tiny muted">{t('Tap a point on the chart to hear that part.')}</span>
        </div>
      )}
    </div>
  );
}
