// Renders a transcript with per-word markup of what went well / badly, plus a
// detail-level switch (Summary · Detailed · Granular) and a color legend.

import { useMemo, useState } from 'react';
import {
  annotateTranscript,
  kindVisibleAt,
  KIND_META,
  DETAIL_LEVELS,
} from '../lib/analysis/transcriptAnnotate.js';

function StatChip({ label, value, tone }) {
  return (
    <span className="badge" style={tone ? { color: `var(--${tone})`, borderColor: `color-mix(in srgb, var(--${tone}) 45%, var(--border))` } : undefined}>
      {value} {label}
    </span>
  );
}

export default function AnnotatedTranscript({ session }) {
  const [level, setLevel] = useState('detailed');
  const { transcript, prompt, mode } = session || {};

  const { tokens, stats, hasReference } = useMemo(
    () => annotateTranscript({ transcript: transcript || '', prompt: prompt || '', mode }),
    [transcript, prompt, mode]
  );

  if (!transcript) {
    return <span className="muted">No transcript captured.</span>;
  }

  // Which kinds appear in the legend at this level (and actually occur).
  const legendKinds = ['good', 'fillerHard', 'fillerSoft', 'repeat', 'overused', 'misread', 'extra', 'omission']
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
          {stats.fillers > 0 && <StatChip label="fillers" value={stats.fillers} tone="bad" />}
          {hasReference && stats.misreads > 0 && <StatChip label="misread" value={stats.misreads} tone="warn" />}
          {hasReference && stats.omissions > 0 && <StatChip label="skipped" value={stats.omissions} tone="warn" />}
          {!hasReference && stats.repeats > 0 && <StatChip label="repeats" value={stats.repeats} tone="warn" />}
        </div>
      </div>

      <p className="transcript-body" style={{ lineHeight: 2 }}>{rendered}</p>

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
