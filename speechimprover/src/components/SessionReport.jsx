// Full breakdown of one session: overall score, alignment to reference patterns,
// per-attribute bars, radar vs desirable/undesirable, raw metrics, and the
// transcript with fillers highlighted. Reused by the debrief, session detail,
// and the post-recording result.

import { ScoreRing, RadarChart } from './charts.jsx';
import { AttributeBars } from './ui.jsx';
import AnnotatedTranscript from './AnnotatedTranscript.jsx';
import ImprovedVoicePreview from './ImprovedVoicePreview.jsx';
import { ATTRIBUTES, REFERENCE_PROFILES } from '../lib/analysis/attributes.js';
import { formatDuration } from '../lib/format.js';

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

function TechniqueReport({ session, audioUrl }) {
  const t = session.technique || {};
  const ev = t.evaluation || {};
  const m = session.metrics || {};
  const showTranscript = session.transcript && ['read', 'twister', 'free'].includes(session.mode);
  return (
    <div className="stack">
      <div className="card" style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <div style={{ fontSize: 46, lineHeight: 1 }}>{t.icon || '🏆'}</div>
        <div style={{ flex: 1 }}>
          <div className="tag">Mastery · {t.tier} · {t.name}</div>
          <h2 style={{ margin: '2px 0' }}>{t.stageTitle}</h2>
          <p className="muted small">
            {ev.matched ? '✅ ' : ''}{ev.headline}
            {t.stageCount ? ` · stage ${(t.stageIndex ?? 0) + 1} of ${t.stageCount}` : ''}
          </p>
        </div>
        {ev.score != null && <ScoreRing value={ev.score} size={96} />}
      </div>

      {ev.breakdown?.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>How close to the target</h3></div>
          {ev.breakdown.map((b, i) => (
            <div key={i} className="attr-row">
              <span className="small">{b.label} {b.ok ? <span style={{ color: 'var(--good)' }}>✓</span> : ''}</span>
              <span className="mono small">{b.measured}</span>
              <div className="attr-bar-track">
                <div className="attr-bar-fill" style={{ width: `${b.score ?? 0}%`, background: b.ok ? 'var(--good)' : 'var(--accent)' }} />
              </div>
              {b.hint && <span className="tiny muted" style={{ gridColumn: '1 / -1' }}>{b.hint}</span>}
            </div>
          ))}
        </div>
      )}

      {ev.note && (
        <div className="card tight" style={{ borderLeft: '4px solid var(--accent)' }}>
          <p className="small"><b>Coach:</b> {ev.note}</p>
        </div>
      )}

      {showTranscript && (
        <div className="card">
          <div className="card-head"><h3>Transcript — what went well &amp; what to fix</h3></div>
          <AnnotatedTranscript session={session} />
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3>Measured signals</h3></div>
        <div className="grid cols-2">
          <MetricRow label="Median pitch (F0)" value={m.medianF0Hz ? `${Math.round(m.medianF0Hz)} Hz` : 'n/a'} />
          <MetricRow label="Pitch variation" value={`${(m.f0StdSemitones || 0).toFixed(1)} st`} />
          <MetricRow label="Speaking pace" value={m.wpm ? `${Math.round(m.wpm)} wpm` : 'n/a'} />
          <MetricRow label="End-of-phrase pitch" value={`${(m.terminalSlope || 0) >= 0 ? '+' : ''}${(m.terminalSlope || 0).toFixed(1)} st/s`} />
          <MetricRow label="Energy held to end" value={`${Math.round((m.trailingRatio || 0) * 100)}% of body`} />
          <MetricRow label="Length" value={formatDuration(m.durationSec)} />
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

export default function SessionReport({ session, audioUrl, onSelectAttr, focusAttrs = [] }) {
  if (session.assessment === 'completion') {
    return <CompletionReport session={session} audioUrl={audioUrl} />;
  }
  if (session.assessment === 'technique') {
    return <TechniqueReport session={session} audioUrl={audioUrl} />;
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

      <div className="card">
        <div className="card-head"><h3>Transcript — what went well &amp; what to fix</h3></div>
        <AnnotatedTranscript session={session} />
        {!session.recognitionSupported && (
          <p className="tiny muted" style={{ marginTop: 10 }}>
            Live transcription was unavailable in this browser, so pace / filler / vocabulary
            scores were skipped. Try Chrome or Edge for full analysis.
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h3>Measured signals</h3></div>
        <div className="grid cols-2">
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

      {audioUrl && <ImprovedVoicePreview audioUrl={audioUrl} session={session} />}

      {audioUrl && (
        <div className="card">
          <div className="card-head"><h3>Recording</h3></div>
          <audio src={audioUrl} controls style={{ width: '100%' }} />
        </div>
      )}
    </div>
  );
}
