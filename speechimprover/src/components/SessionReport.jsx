// Full breakdown of one session: overall score, alignment to reference patterns,
// per-attribute bars, radar vs desirable/undesirable, raw metrics, and the
// transcript with fillers highlighted. Reused by the debrief, session detail,
// and the post-recording result.

import { ScoreRing, RadarChart } from './charts.jsx';
import { AttributeBars } from './ui.jsx';
import { ATTRIBUTES, REFERENCE_PROFILES } from '../lib/analysis/attributes.js';
import { FILLER_WORDS, FILLER_PHRASES } from '../lib/analysis/speechMetrics.js';
import { formatDuration } from '../lib/format.js';

function HighlightedTranscript({ text }) {
  if (!text) return <span className="muted">No transcript captured.</span>;
  const phrases = FILLER_PHRASES.map((p) => p.replace(/\s+/g, '\\s+'));
  const pattern = new RegExp(`\\b(${[...phrases, ...FILLER_WORDS].join('|')})\\b`, 'gi');
  const parts = [];
  let lastIndex = 0;
  let match = pattern.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={parts.length}>{text.slice(lastIndex, match.index)}</span>);
    }
    parts.push(<span key={parts.length} className="highlight-filler">{match[0]}</span>);
    lastIndex = pattern.lastIndex;
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
    match = pattern.exec(text);
  }
  if (lastIndex < text.length) parts.push(<span key={parts.length}>{text.slice(lastIndex)}</span>);
  return <p style={{ lineHeight: 1.8 }}>{parts}</p>;
}

function MetricRow({ label, value }) {
  return (
    <div className="row spread" style={{ padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="muted small">{label}</span>
      <span className="mono small" style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function CompletionReport({ session, audioUrl }) {
  const c = session.completion || {};
  const m = session.metrics || {};
  const ok = c.completed;
  return (
    <div className="stack">
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ fontSize: 46, lineHeight: 1 }}>{ok ? '✅' : '⚠️'}</div>
        <div>
          <div className="tag">Warm-up · completion only</div>
          <h2 style={{ margin: '2px 0' }}>{ok ? 'Completed' : 'Not quite complete'}</h2>
          <p className="muted small">{c.note}</p>
        </div>
      </div>
      <div className="grid cols-3">
        <div className="card stat"><span className="big">{formatDuration(m.durationSec)}</span><span className="lbl">Length</span></div>
        <div className="card stat"><span className="big">{Math.round((c.soundRatio || 0) * 100)}%</span><span className="lbl">Sound detected</span></div>
        <div className="card stat"><span className="big" style={{ textTransform: 'capitalize', fontSize: '1.4rem' }}>{c.quality || '—'}</span><span className="lbl">Assessment</span></div>
      </div>
      <div className="card">
        <p className="muted small">
          Warm-ups (breathing, humming, lip trills) are tracked for <b>completion</b> rather than scored on the
          full attribute scale — they build breath support and resonance, not measurable speech patterns. They
          don't affect your scored trends.
        </p>
      </div>
      {audioUrl && (
        <div className="card">
          <div className="card-head"><h3>Recording</h3></div>
          <audio src={audioUrl} controls style={{ width: '100%' }} />
        </div>
      )}
    </div>
  );
}

export default function SessionReport({ session, audioUrl, onSelectAttr, focusAttrs = [] }) {
  if (session.assessment === 'completion') {
    return <CompletionReport session={session} audioUrl={audioUrl} />;
  }
  const { scores, overall, distances, metrics } = session;
  const m = metrics || {};

  const radarAxes = ATTRIBUTES.map((a) => ({ key: a.key, label: a.label.split(' ')[0] }));
  const radarDatasets = [
    { label: 'Desirable', color: 'var(--good)', values: REFERENCE_PROFILES.desirable.scores, fill: 'transparent' },
    { label: 'Undesirable', color: 'var(--bad)', values: REFERENCE_PROFILES.undesirable.scores, fill: 'transparent' },
    { label: 'This session', color: 'var(--accent)', values: scores },
  ];

  return (
    <div className="stack">
      <div className="grid cols-3">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <ScoreRing value={overall} size={120} />
          <div className="tag">Overall score</div>
        </div>
        <div className="card stack" style={{ gap: 10, justifyContent: 'center' }}>
          <div className="stat">
            <span className="big" style={{ color: 'var(--accent-2)' }}>{distances?.alignment ?? 0}%</span>
            <span className="lbl">Alignment to target</span>
          </div>
          <div className="small muted">
            How much closer your pattern sits to the <b style={{ color: 'var(--good)' }}>desirable</b> reference than
            the <b style={{ color: 'var(--bad)' }}>undesirable</b> one.
          </div>
        </div>
        <div className="card stack" style={{ gap: 8, justifyContent: 'center' }}>
          <MetricRow label="Distance to desirable" value={distances?.desirable ?? '-'} />
          <MetricRow label="Distance to undesirable" value={distances?.undesirable ?? '-'} />
          <MetricRow label="Duration" value={formatDuration(m.durationSec)} />
          <MetricRow label="Words / fillers" value={`${m.wordCount ?? 0} / ${m.fillerTotal ?? 0}`} />
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head"><h3>Attribute scores</h3><span className="tiny muted">click for detail</span></div>
          <AttributeBars scores={scores} onSelect={onSelectAttr} highlight={focusAttrs} />
        </div>
        <div className="card">
          <div className="card-head"><h3>Pattern map</h3></div>
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <RadarChart axes={radarAxes} datasets={radarDatasets} size={300} />
          </div>
          <div className="row wrap" style={{ justifyContent: 'center', gap: 16, marginTop: 6 }}>
            <span className="tiny" style={{ color: 'var(--good)' }}>● Desirable</span>
            <span className="tiny" style={{ color: 'var(--bad)' }}>● Undesirable</span>
            <span className="tiny" style={{ color: 'var(--accent)' }}>● This session</span>
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head"><h3>Transcript</h3>
            <span className="tiny muted">fillers <span className="highlight-filler">highlighted</span></span>
          </div>
          <HighlightedTranscript text={session.transcript} />
          {!session.recognitionSupported && (
            <p className="tiny muted" style={{ marginTop: 10 }}>
              Live transcription was unavailable in this browser, so pace / filler / vocabulary
              scores were skipped. Try Chrome or Edge for full analysis.
            </p>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h3>Measured signals</h3></div>
          <MetricRow label="Speaking pace" value={`${Math.round(m.wpm || 0)} wpm`} />
          <MetricRow label="Fillers / min" value={(m.fillersPerMin || 0).toFixed(1)} />
          <MetricRow label="Median pitch (F0)" value={m.medianF0Hz ? `${Math.round(m.medianF0Hz)} Hz` : 'n/a'} />
          <MetricRow label="Pitch variation" value={`${(m.f0StdSemitones || 0).toFixed(1)} st`} />
          <MetricRow label="End-of-phrase pitch" value={`${(m.terminalSlope || 0) >= 0 ? '+' : ''}${(m.terminalSlope || 0).toFixed(1)} st/s`} />
          <MetricRow label="Vocabulary (TTR)" value={`${Math.round((m.typeTokenRatio || 0) * 100)}%`} />
          <MetricRow label="Pause / silence" value={`${Math.round((m.silenceRatio || 0) * 100)}% · ${m.pauseCount || 0} breaks`} />
          <MetricRow label="Energy trailing-off" value={`${Math.round((m.trailingRatio || 0) * 100)}% of body`} />
        </div>
      </div>

      {audioUrl && (
        <div className="card">
          <div className="card-head"><h3>Recording</h3></div>
          <audio src={audioUrl} controls style={{ width: '100%' }} />
        </div>
      )}
    </div>
  );
}
