// Renders a transcript with per-word markup of what went well / badly, plus a
// detail-level switch (Summary · Detailed · Granular) and a color legend.

import { useMemo, useState } from 'react';
import {
  annotateTranscript,
  kindVisibleAt,
  KIND_META,
  DETAIL_LEVELS,
} from '../lib/analysis/transcriptAnnotate.js';
import { paceTimeline } from '../lib/analysis/speechMetrics.js';
import { PaceChart } from './charts.jsx';
import { splitTake, splitsFor } from '../lib/analysis/takeSplits.js';

function StatChip({ label, value, tone }) {
  return (
    <span className="badge" style={tone ? { color: `var(--${tone})`, borderColor: `color-mix(in srgb, var(--${tone}) 45%, var(--border))` } : undefined}>
      {value} {label}
    </span>
  );
}

export default function AnnotatedTranscript({ session }) {
  const [level, setLevel] = useState('detailed');
  const { transcript, prompt, mode, durationSec, paceMarks } = session || {};

  const { tokens, stats, hasReference } = useMemo(
    () => annotateTranscript({ transcript: transcript || '', prompt: prompt || '', mode, durationSec }),
    [transcript, prompt, mode, durationSec]
  );
  const pace = useMemo(() => paceTimeline(paceMarks), [paceMarks]);

  if (!transcript) {
    return <span className="muted">No transcript captured.</span>;
  }

  // Which kinds appear in the legend at this level (and actually occur).
  const legendKinds = ['good', 'fillerHard', 'fillerSoft', 'hedge', 'repeat', 'overused', 'misread', 'extra', 'omission']
    .filter((k) => kindVisibleAt(k, level) === k)
    .filter((k) => (k === 'good' ? hasReference || level === 'granular' : (stats.counts?.[k] || 0) > 0));

  // Words/omissions get a leading space (except the first token); punctuation
  // attaches directly to whatever precedes it.
  const rendered = tokens.map((tok, idx) => {
    if (tok.kind === 'punct') {
      return <span key={idx}>{tok.text}</span>;
    }
    const lead = idx > 0 ? ' ' : '';
    const shown = kindVisibleAt(tok.kind, level);
    const meta = KIND_META[shown] || KIND_META.neutral;
    if (tok.kind === 'omission') {
      // skipped passage word — always show it as a ghost placeholder
      return (
        <span key={idx}>{lead}<span className="tok tok-omission" title={tok.note}>{tok.text}</span></span>
      );
    }
    if (!meta.cls) {
      return <span key={idx}>{lead}{tok.text}</span>;
    }
    return (
      <span key={idx}>{lead}<span className={`tok ${meta.cls}`} title={tok.note}>{tok.text}</span></span>
    );
  });

  return (
    <div className="annotated-transcript">
      <div className="row spread wrap" style={{ marginBottom: 10, gap: 10 }}>
        <div className="pill-group">
          {DETAIL_LEVELS.map((l) => (
            <button key={l.key} className={`pill ${level === l.key ? 'active' : ''}`} onClick={() => setLevel(l.key)} title={l.hint}>
              {l.label}
            </button>
          ))}
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          {hasReference && stats.accuracy != null && (
            <StatChip label="read accurately" value={`${stats.accuracy}%`} tone={stats.accuracy >= 90 ? 'good' : stats.accuracy >= 70 ? 'warn' : 'bad'} />
          )}
          {stats.wcpm != null && <StatChip label="words correct / min" value={stats.wcpm} />}
          {stats.fillers > 0 && <StatChip label="fillers" value={stats.fillers} tone="bad" />}
          {stats.hedges > 0 && <StatChip label={stats.hedges === 1 ? 'hedge' : 'hedges'} value={stats.hedges} tone="warn" />}
          {hasReference && stats.misreads > 0 && <StatChip label="misread" value={stats.misreads} tone="warn" />}
          {hasReference && stats.omissions > 0 && <StatChip label="skipped" value={stats.omissions} tone="warn" />}
          {!hasReference && stats.repeats > 0 && <StatChip label="repeats" value={stats.repeats} tone="warn" />}
        </div>
      </div>

      <p className="transcript-body" style={{ lineHeight: 2 }}>{rendered}</p>

      {pace && (
        <div style={{ marginTop: 14 }}>
          <div className="row spread wrap" style={{ gap: 8 }}>
            <span className="small" style={{ fontWeight: 700 }}>Pace over time</span>
            <span className="tiny muted">
              varies {pace.variation}% · {pace.variation < 15 ? 'steady' : pace.variation < 30 ? 'some drift' : 'uneven — watch for rushing'}
            </span>
          </div>
          <PaceChart points={pace.points} />
          <TakeSplits marks={paceMarks} secs={durationSec} />
        </div>
      )}

      {legendKinds.length > 0 && (
        <div className="row wrap transcript-legend" style={{ gap: 12, marginTop: 12 }}>
          {legendKinds.map((k) => (
            <span key={k} className="tiny muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span className={`tok ${KIND_META[k].cls}`} style={{ padding: '0 6px' }}>Aa</span>
              {KIND_META[k].label}
            </span>
          ))}
        </div>
      )}

      <p className="tiny muted" style={{ marginTop: 10 }}>
        {level === 'summary' && 'Showing only the most important issues. Switch to Detailed or Granular for more.'}
        {level === 'detailed' && 'Fillers, repeats, and (when reading) misread or skipped words are marked. Hover a word for details.'}
        {level === 'granular' && 'Every word is marked, including on-target words. Hover any word for the specifics.'}
      </p>
    </div>
  );
}

// Longer takes: the same take cut into halves / thirds / quarters — each part's
// pace, fillers and pace grade — plus how well the pace held first → last.
// Ported from TachyRead's typing-run splits.
const SPLIT_NAME = { 2: 'Halves', 3: 'Thirds', 4: 'Quarters' };
function TakeSplits({ marks, secs }) {
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
