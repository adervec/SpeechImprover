import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { RadarChart, ScoreRing } from '../components/charts.jsx';
import { EmptyState } from '../components/ui.jsx';
import { ATTRIBUTES, REFERENCE_PROFILES } from '../lib/analysis/attributes.js';
import { formatDateTime } from '../lib/format.js';

function useAudioUrl(audioId, getAudioBlob) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let u = null;
    let active = true;
    (async () => {
      setUrl(null);
      if (!audioId) return;
      const blob = await getAudioBlob(audioId);
      if (blob && active) { u = URL.createObjectURL(blob); setUrl(u); }
    })();
    return () => { active = false; if (u) URL.revokeObjectURL(u); };
  }, [audioId, getAudioBlob]);
  return url;
}

function Picker({ label, value, onChange, sessions }) {
  return (
    <label className="field" style={{ flex: 1, minWidth: 220 }}>
      {label}
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select a session…</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>{formatDateTime(s.createdAt)} · {s.exerciseTitle || s.mode} ({s.overall})</option>
        ))}
      </select>
    </label>
  );
}

export default function Compare({ route, navigate }) {
  const { sessions, getAudioBlob } = useStore();
  const [aId, setAId] = useState(route.query.a || '');
  const [bId, setBId] = useState(route.query.b || '');

  const a = sessions.find((s) => s.id === aId);
  const b = sessions.find((s) => s.id === bId);

  const urlA = useAudioUrl(a?.audioId, getAudioBlob);
  const urlB = useAudioUrl(b?.audioId, getAudioBlob);

  // Order older→newer for the delta direction.
  const [older, newer] = useMemo(() => {
    if (a && b) return a.createdAt <= b.createdAt ? [a, b] : [b, a];
    return [a, b];
  }, [a, b]);

  if (!sessions.length) {
    return <EmptyState title="Nothing to compare yet" action={<button className="btn" onClick={() => navigate('practice')}>Record a session</button>} />;
  }

  const radarAxes = ATTRIBUTES.map((at) => ({ key: at.key, label: at.label.split(' ')[0] }));
  const datasets = [
    { label: 'Desirable', color: 'var(--good)', values: REFERENCE_PROFILES.desirable.scores, fill: 'transparent' },
  ];
  if (older) datasets.push({ label: 'Older', color: 'var(--text-dim)', values: older.scores, fill: 'transparent' });
  if (newer) datasets.push({ label: 'Newer', color: 'var(--accent)', values: newer.scores });

  const improvements = older && newer
    ? ATTRIBUTES.map((at) => ({
        key: at.key, label: at.label,
        a: older.scores?.[at.key], b: newer.scores?.[at.key],
      })).filter((r) => r.a != null && r.b != null)
    : [];
  const improved = improvements.filter((r) => r.b > r.a).length;
  const regressed = improvements.filter((r) => r.b < r.a).length;

  return (
    <div className="stack">
      <div className="card">
        <div className="row wrap" style={{ gap: 14 }}>
          <Picker label="Session A" value={aId} onChange={setAId} sessions={sessions} />
          <Picker label="Session B" value={bId} onChange={setBId} sessions={sessions} />
        </div>
      </div>

      {!a || !b ? (
        <EmptyState icon="⇄" title="Pick two sessions to compare">Select a session in each slot above. Tip: use this for monthly A/B reviews of the same baseline prompt.</EmptyState>
      ) : (
        <>
          <div className="grid cols-2">
            {[older, newer].map((s, i) => {
              const isNewer = i === 1;
              const url = s.id === a.id ? urlA : urlB;
              return (
                <div className="card" key={s.id} style={isNewer ? { borderColor: 'var(--accent)' } : undefined}>
                  <div className="card-head">
                    <div>
                      <div className="tag" style={isNewer ? { color: 'var(--accent)' } : undefined}>{isNewer ? 'Newer' : 'Older'}</div>
                      <h3>{s.exerciseTitle || s.mode}</h3>
                      <div className="tiny muted">{formatDateTime(s.createdAt)}</div>
                    </div>
                    <ScoreRing value={s.overall} size={74} />
                  </div>
                  {url ? (
                    <audio src={url} controls style={{ width: '100%' }} />
                  ) : (
                    <p className="tiny muted">Audio purged or unavailable for this session.</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid cols-2">
            <div className="card">
              <div className="card-head"><h3>Overlay</h3></div>
              <div style={{ display: 'grid', placeItems: 'center' }}>
                <RadarChart axes={radarAxes} datasets={datasets} size={320} />
              </div>
              <div className="row wrap" style={{ justifyContent: 'center', gap: 14, marginTop: 6 }}>
                <span className="tiny" style={{ color: 'var(--text-dim)' }}>● Older</span>
                <span className="tiny" style={{ color: 'var(--accent)' }}>● Newer</span>
                <span className="tiny" style={{ color: 'var(--good)' }}>● Desirable</span>
              </div>
            </div>

            <div className="card">
              <div className="card-head"><h3>Attribute change</h3>
                <span className="small"><b style={{ color: 'var(--good)' }}>{improved}↑</b> · <b style={{ color: 'var(--bad)' }}>{regressed}↓</b></span>
              </div>
              <table className="data">
                <thead><tr><th>Attribute</th><th>Older</th><th>Newer</th><th>Δ</th></tr></thead>
                <tbody>
                  {improvements.map((r) => {
                    const d = r.b - r.a;
                    return (
                      <tr key={r.key}>
                        <td>{r.label}</td>
                        <td className="mono">{r.a}</td>
                        <td className="mono">{r.b}</td>
                        <td className="mono" style={{ color: d > 0 ? 'var(--good)' : d < 0 ? 'var(--bad)' : 'var(--text-dim)' }}>
                          {d > 0 ? '+' : ''}{d}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="divider" />
              <div className="row spread">
                <span className="muted small">Overall change</span>
                <span className="mono" style={{ fontWeight: 800, color: newer.overall - older.overall >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                  {newer.overall - older.overall >= 0 ? '+' : ''}{newer.overall - older.overall}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
