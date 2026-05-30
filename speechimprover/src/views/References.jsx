import { useState } from 'react';
import { RadarChart } from '../components/charts.jsx';
import { AttributeBars } from '../components/ui.jsx';
import { ATTRIBUTES, REFERENCE_PROFILES } from '../lib/analysis/attributes.js';

const PRINCIPLES = [
  ['Aim for your best natural voice', 'Sustainable improvement amplifies the clarity, pacing and confidence you already have — not an imitation you must maintain.'],
  ['Pick two targets, not seven', 'Choose the two attributes that most affect how you come across; ignore the rest until those improve.'],
  ['Frequency beats marathons', 'Ten focused minutes most days builds motor memory; two hours once a week does not.'],
  ['Pauses read as confidence', 'Replace fillers with brief silent pauses and let statements fall at the end rather than rise.'],
  ['Compare against your past self', 'Re-record the same baseline monthly and listen A/B — far more revealing than judging in isolation.'],
];

export default function References({ route }) {
  const [tab, setTab] = useState(route?.query?.tab === 'guide' ? 'guide' : 'patterns');

  const radarAxes = ATTRIBUTES.map((a) => ({ key: a.key, label: a.label.split(' ')[0] }));

  return (
    <div className="stack">
      <div className="pill-group">
        <button className={`pill ${tab === 'patterns' ? 'active' : ''}`} onClick={() => setTab('patterns')}>Target patterns</button>
        <button className={`pill ${tab === 'guide' ? 'active' : ''}`} onClick={() => setTab('guide')}>Baseline guide</button>
      </div>

      {tab === 'patterns' ? (
        <>
          <div className="card">
            <div className="card-head"><h3>Desirable vs. undesirable speaking patterns</h3></div>
            <p className="muted small" style={{ marginBottom: 16 }}>
              Every session is measured by its <b>distance</b> to these two reference patterns. Moving toward the
              green pattern and away from the red one is the whole game — your “alignment” score captures exactly that.
            </p>
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <RadarChart
                axes={radarAxes}
                size={360}
                datasets={[
                  { label: 'Desirable', color: 'var(--good)', values: REFERENCE_PROFILES.desirable.scores },
                  { label: 'Undesirable', color: 'var(--bad)', values: REFERENCE_PROFILES.undesirable.scores },
                ]}
              />
            </div>
            <div className="row wrap" style={{ justifyContent: 'center', gap: 18, marginTop: 6 }}>
              <span className="tiny" style={{ color: 'var(--good)' }}>● Desirable target</span>
              <span className="tiny" style={{ color: 'var(--bad)' }}>● Undesirable anti-pattern</span>
            </div>
          </div>

          <div className="grid cols-2">
            <div className="card">
              <div className="card-head"><h3 style={{ color: 'var(--good)' }}>✓ {REFERENCE_PROFILES.desirable.label}</h3></div>
              <p className="muted small" style={{ marginBottom: 12 }}>{REFERENCE_PROFILES.desirable.description}</p>
              <AttributeBars scores={REFERENCE_PROFILES.desirable.scores} />
            </div>
            <div className="card">
              <div className="card-head"><h3 style={{ color: 'var(--bad)' }}>✗ {REFERENCE_PROFILES.undesirable.label}</h3></div>
              <p className="muted small" style={{ marginBottom: 12 }}>{REFERENCE_PROFILES.undesirable.description}</p>
              <AttributeBars scores={REFERENCE_PROFILES.undesirable.scores} />
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>What each attribute means</h3></div>
            <div className="stack" style={{ gap: 8 }}>
              {ATTRIBUTES.map((a) => (
                <div key={a.key} className="row spread" style={{ alignItems: 'flex-start', gap: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <b style={{ minWidth: 170 }}>{a.label}</b>
                  <span className="muted small" style={{ flex: 1 }}>{a.blurb}</span>
                  <span className="tiny muted nowrap">{a.guideSection}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Core principles</h3><span className="tiny muted">from the Baseline guide</span></div>
            <div className="grid cols-2">
              {PRINCIPLES.map(([t, d]) => (
                <div key={t} className="card tight" style={{ background: 'var(--bg-2)' }}>
                  <b>{t}</b>
                  <p className="muted small" style={{ marginTop: 4 }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card tight row spread wrap">
            <div>
              <b>The Continuous Speech Improvement Guide</b>
              <div className="tiny muted">The reference principles behind this app’s exercises, attributes and target patterns.</div>
            </div>
            <a className="btn sm" href="/baseline-guide.html" target="_blank" rel="noreferrer">Open in new tab ↗</a>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <iframe
              title="The Continuous Speech Improvement Guide"
              src="/baseline-guide.html"
              style={{ width: '100%', height: '78vh', border: 'none', background: '#fff' }}
            />
          </div>
        </>
      )}
    </div>
  );
}
