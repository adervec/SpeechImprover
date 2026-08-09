// Live "what's good / what's off" dashboard shown while recording. Reuses the exact
// attributes.js score() + detail() functions on the streaming metrics, so a green/amber/
// red chip here means the same thing it will in the final report. Attributes light up as
// enough signal accumulates ("listening…" until then).

import { ATTRIBUTES } from '../lib/analysis/attributes.js';

// Shorter labels for the compact live chips.
const SHORT = {
  pace: 'Pace',
  clarity: 'Clarity',
  fillers: 'Fillers',
  nonRepetition: 'Word variety',
  resonantDepth: 'Resonant depth',
  expressiveness: 'Expressiveness',
  nonNasal: 'Non-nasal',
  noUptalk: 'No uptalk',
  projection: 'Projection',
  breath: 'Breath & pauses',
};
const PITCH_BASED = new Set(['resonantDepth', 'expressiveness', 'noUptalk']);

function band(score) {
  if (score >= 72) return 'var(--good)';
  if (score >= 50) return 'var(--warn)';
  return 'var(--bad)';
}

function ready(attr, m, wordCount) {
  if (!m) return false;
  if (attr.requiresTranscript) return wordCount > 0;
  if (PITCH_BASED.has(attr.key)) return m.medianF0Hz > 0 && m.voicedSamples >= 3;
  return m.samples >= 3 && m.meanRms > 0;
}

// focusAttrs: the exercise's targetAttributes — chips outside that set are greyed
// (still measured, but visually parked) and sorted after the relevant ones.
export default function LiveFeedback({ metrics, profile, wordCount = 0, focusAttrs = [] }) {
  const focus = focusAttrs?.length ? new Set(focusAttrs) : null;
  const list = focus
    ? [...ATTRIBUTES].sort((a, b) => (focus.has(a.key) ? 0 : 1) - (focus.has(b.key) ? 0 : 1))
    : ATTRIBUTES;
  return (
    <div className="live-feedback">
      {list.map((attr) => {
        const label = SHORT[attr.key] || attr.label;
        const off = focus ? !focus.has(attr.key) : false;
        if (off) {
          const isReady = ready(attr, metrics, wordCount);
          return (
            <div key={attr.key} className="lf-chip off" title={`${attr.blurb} — not a focus of this exercise`}>
              <span className="lf-dot" style={{ background: 'var(--border)' }} />
              <span className="lf-label muted">{label}</span>
              <span className="lf-detail muted">{isReady ? attr.detail(metrics) : '—'}</span>
            </div>
          );
        }
        if (!ready(attr, metrics, wordCount)) {
          return (
            <div key={attr.key} className="lf-chip" title={attr.blurb}>
              <span className="lf-dot" style={{ background: 'var(--border)' }} />
              <span className="lf-label">{label}</span>
              <span className="lf-detail muted">listening…</span>
            </div>
          );
        }
        const score = Math.round(attr.score(metrics, profile));
        const color = band(score);
        return (
          <div key={attr.key} className="lf-chip" title={`${attr.blurb} — score ${score}/100`} style={{ borderColor: color }}>
            <span className="lf-dot" style={{ background: color }} />
            <span className="lf-label">{label}</span>
            <span className="lf-detail" style={{ color }}>{attr.detail(metrics)}</span>
          </div>
        );
      })}
    </div>
  );
}
