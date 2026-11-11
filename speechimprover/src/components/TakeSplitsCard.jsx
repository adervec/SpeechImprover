// Halves / thirds / quarters of a take (ported from TachyRead's typing-run splits):
// every attribute scored per part, plus the change from the first part to the last,
// so you can see what held up and what faded. Sessions recorded before per-part
// analysis fall back to the pace-only table (from phrase timings).

import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { ATTRIBUTES } from '../lib/analysis/attributes.js';
import { scoreParts } from '../lib/analysis/index.js';
import { splitTake, splitsFor, holdGrade } from '../lib/analysis/takeSplits.js';

const SPLIT_NAME = { 2: 'Halves', 3: 'Thirds', 4: 'Quarters' };
const tone = (v) => (v == null ? 'var(--text-dim)' : v >= 70 ? 'var(--good)' : v >= 45 ? 'var(--warn)' : 'var(--bad)');

export default function TakeSplitsCard({ session }) {
  const { profile } = useStore();
  const parts = session.metrics?.parts;
  const scored = useMemo(() => (parts ? scoreParts(parts, profile) : null), [parts, profile]);
  const options = scored ? Object.keys(scored).map(Number).sort() : splitsFor(session.durationSec || 0);
  const [n, setN] = useState(options[0] || 2);
  const k = options.includes(n) ? n : options[0];
  if (!k) return null;
  if (!scored) {
    if (!session.paceMarks?.length) return null;
    return (
      <div className="card">
        <div className="card-head"><h3>Over the take</h3><span className="tiny muted">pace only — recorded before per-part analysis</span></div>
        <PaceSplits marks={session.paceMarks} secs={session.durationSec} />
      </div>
    );
  }
  const list = scored[k];
  const rows = [{ key: 'overall', label: 'Overall', vals: list.map((p) => p.overall) }]
    .concat(ATTRIBUTES.map((a) => ({ key: a.key, label: a.label, vals: list.map((p) => p.scores[a.key]) })))
    .filter((r) => r.vals.some((v) => v != null));
  const wpm = (parts[k] || []).map((p) => p.wpm).filter((v) => v > 0);
  const paceDrift = wpm.length === k && wpm[0] > 0 ? Math.round(((wpm[k - 1] - wpm[0]) / wpm[0]) * 100) : null;
  return (
    <div className="card take-splits">
      <div className="card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h3>Over the take</h3>
        <div className="pill-group">
          {options.map((o) => (
            <button key={o} type="button" className={`pill ${o === k ? 'active' : ''}`} aria-pressed={o === k} onClick={() => setN(o)}>{SPLIT_NAME[o]}</button>
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="take-splits-table">
          <thead>
            <tr><th style={{ textAlign: 'left' }}>Attribute</th>{list.map((_, i) => <th key={i}>Part {i + 1}</th>)}<th title="Last part minus first part">Change</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const first = r.vals[0];
              const last = r.vals[k - 1];
              const d = first != null && last != null ? Math.round(last - first) : null;
              return (
                <tr key={r.key} style={r.key === 'overall' ? { fontWeight: 700 } : undefined}>
                  <td style={{ textAlign: 'left' }}>{r.label}</td>
                  {r.vals.map((v, i) => <td key={i} style={{ color: tone(v) }}>{v == null ? '–' : Math.round(v)}</td>)}
                  <td style={{ color: d == null || d === 0 ? 'var(--text-dim)' : d > 0 ? 'var(--good)' : 'var(--bad)' }}>
                    {d == null ? '–' : `${d > 0 ? '▲' : d < 0 ? '▼' : ''}${Math.abs(d)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
        {paceDrift != null && <>Pace held <b className={`g-${holdGrade(paceDrift)}`}>{holdGrade(paceDrift)}</b> ({paceDrift > 0 ? '+' : ''}{paceDrift}% first → last part) · </>}
        Each part is scored on its own audio and the words said in it. Short parts give noisier scores.
      </p>
    </div>
  );
}

// Longer takes: the same take cut into halves / thirds / quarters — each part's
// pace, fillers and pace grade — plus how well the pace held first → last.
// Ported from TachyRead's typing-run splits.
function PaceSplits({ marks, secs }) {
  const options = splitsFor(secs || 0);
  const [n, setN] = useState(options[0] || 2);
  const k = options.includes(n) ? n : options[0];
  const sp = k ? splitTake(marks, secs, k) : null;
  if (!sp) return null;
  return (
    <div className="take-splits">
      <div className="row wrap" style={{ gap: 6, alignItems: 'center', margin: '10px 0 6px' }}>
        <div className="pill-group">
          {options.map((o) => (
            <button key={o} type="button" className={`pill ${o === k ? 'active' : ''}`} aria-pressed={o === k} onClick={() => setN(o)}>{SPLIT_NAME[o]}</button>
          ))}
        </div>
        <span className={`small g-${sp.diffGrade}`} style={{ marginLeft: 'auto' }}
          title="Pace held: last part's pace against the first's. Within 5% either way is an A; rushing or flagging both cost grades.">
          Pace held <b>{sp.diffGrade}</b> ({sp.diffPct > 0 ? '+' : ''}{sp.diffPct}%)
        </span>
      </div>
      <table className="take-splits-table">
        <thead><tr><th>Part</th><th>Pace</th><th>Fillers</th><th>Pace score</th><th>Grade</th></tr></thead>
        <tbody>
          {sp.parts.map((p, i) => (
            <tr key={i}><td>{i + 1}</td><td>{p.wpm} wpm</td><td>{p.fillers}</td><td>{p.score}</td><td className={`g-${p.grade}`}>{p.grade}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
