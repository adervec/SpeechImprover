import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { LineChart } from '../components/charts.jsx';
import { EmptyState } from '../components/ui.jsx';
import { ATTRIBUTES } from '../lib/analysis/attributes.js';
import { trendSeries, trendDelta, subsetOptions } from '../lib/aggregate.js';

const PALETTE = ['var(--accent)', 'var(--accent-2)', 'var(--good)', 'var(--warn)', 'var(--bad)'];
const METRICS = [{ key: 'overall', label: 'Overall' }, ...ATTRIBUTES.map((a) => ({ key: a.key, label: a.label }))];

export default function Trends({ navigate }) {
  const { sessions } = useStore();
  const [subset, setSubset] = useState('all');
  const [selected, setSelected] = useState(['overall']);

  const opts = useMemo(() => subsetOptions(sessions), [sessions]);

  const filterFn = useMemo(() => {
    if (subset === 'all') return null;
    const [kind, value] = subset.split(':');
    if (kind === 'mode') return (s) => s.mode === value;
    if (kind === 'type') return (s) => s.type === value;
    if (kind === 'exercise') return (s) => s.exerciseId === value;
    return null;
  }, [subset]);

  const seriesList = useMemo(
    () =>
      selected.map((key, i) => ({
        label: METRICS.find((m) => m.key === key)?.label || key,
        color: PALETTE[i % PALETTE.length],
        points: trendSeries(sessions, key, filterFn),
        key,
      })),
    [selected, sessions, filterFn]
  );

  function toggleMetric(key) {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.length === 1 ? prev : prev.filter((k) => k !== key);
      return prev.length >= 5 ? [...prev.slice(1), key] : [...prev, key];
    });
  }

  if (sessions.length < 2) {
    return <EmptyState icon="📈" title="Not enough history yet">Record at least two sessions to start trending your progress.</EmptyState>;
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head"><h3>Filter a coherent subset</h3></div>
        <div className="row wrap">
          <label className="field" style={{ minWidth: 260 }}>
            Subset
            <select value={subset} onChange={(e) => setSubset(e.target.value)}>
              <option value="all">All sessions ({sessions.length})</option>
              <optgroup label="By mode">
                {opts.modes.map((m) => <option key={m} value={`mode:${m}`}>Mode: {m}</option>)}
              </optgroup>
              <optgroup label="By type">
                {opts.types.map((t) => <option key={t} value={`type:${t}`}>Type: {t}</option>)}
              </optgroup>
              <optgroup label="By exercise">
                {opts.exercises.map((e) => <option key={e.id} value={`exercise:${e.id}`}>{e.title}</option>)}
              </optgroup>
            </select>
          </label>
        </div>
        <div className="divider" />
        <div className="tiny muted" style={{ marginBottom: 8 }}>Metrics to plot (up to 5)</div>
        <div className="pill-group">
          {METRICS.map((m) => (
            <button key={m.key} className={`pill ${selected.includes(m.key) ? 'active' : ''}`} onClick={() => toggleMetric(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Progress</h3>
          <div className="row wrap" style={{ gap: 14 }}>
            {seriesList.map((s) => (
              <span key={s.key} className="tiny" style={{ color: s.color }}>● {s.label}</span>
            ))}
          </div>
        </div>
        <LineChart seriesList={seriesList} height={300} onPointClick={(p) => navigate('session', { param: p.id })} />
      </div>

      <div className="grid cols-3">
        {seriesList.map((s) => {
          const pts = s.points;
          const delta = trendDelta(pts);
          const best = pts.length ? Math.max(...pts.map((p) => p.value)) : 0;
          return (
            <div className="card" key={s.key}>
              <div className="tag" style={{ color: s.color }}>{s.label}</div>
              <div className="grid cols-3" style={{ marginTop: 10, gap: 8 }}>
                <div className="stat"><span className="big" style={{ fontSize: '1.4rem' }}>{pts.length ? Math.round(pts[pts.length - 1].value) : '—'}</span><span className="lbl">Latest</span></div>
                <div className="stat"><span className="big" style={{ fontSize: '1.4rem', color: delta >= 0 ? 'var(--good)' : 'var(--bad)' }}>{delta >= 0 ? '+' : ''}{delta}</span><span className="lbl">Change</span></div>
                <div className="stat"><span className="big" style={{ fontSize: '1.4rem' }}>{best}</span><span className="lbl">Best</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
