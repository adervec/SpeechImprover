// Lightweight dependency-free SVG charts: LineChart, RadarChart, Sparkline.

import { formatDate } from '../lib/format.js';

function bandColor(v) {
  if (v >= 85) return 'var(--good)';
  if (v >= 70) return 'var(--accent-2)';
  if (v >= 50) return 'var(--warn)';
  return 'var(--bad)';
}

export function ScoreRing({ value = 0, size = 96, stroke = 9, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={bandColor(value)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="val" style={{ fontSize: size * 0.26 }}>
        {Math.round(value)}
        {label && <div className="tiny muted" style={{ fontWeight: 600 }}>{label}</div>}
      </div>
    </div>
  );
}

export function Sparkline({ points = [], width = 120, height = 32, color = 'var(--accent)' }) {
  const vals = points.map((p) => (typeof p === 'number' ? p : p.value));
  if (vals.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = width / (vals.length - 1);
  const path = vals
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// seriesList: [{ label, color, points: [{date, value, id}] }]
export function LineChart({ seriesList = [], height = 260, yMin = 0, yMax = 100, onPointClick }) {
  const W = 760;
  const H = height;
  const padL = 38;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxLen = Math.max(0, ...seriesList.map((s) => s.points.length));
  if (maxLen < 1) {
    return <div className="empty">Not enough data to chart yet.</div>;
  }
  const xAt = (i, len) => padL + (len <= 1 ? plotW / 2 : (i / (len - 1)) * plotW);
  const yAt = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const gridLines = [0, 25, 50, 75, 100].filter((g) => g >= yMin && g <= yMax);
  const labelSeries = seriesList.find((s) => s.points.length === maxLen) || seriesList[0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
      {gridLines.map((g) => (
        <g key={g}>
          <line x1={padL} x2={W - padR} y1={yAt(g)} y2={yAt(g)} stroke="var(--border)" strokeWidth="1" />
          <text x={padL - 8} y={yAt(g) + 4} textAnchor="end" fontSize="11" fill="var(--text-dim)">
            {g}
          </text>
        </g>
      ))}
      {labelSeries?.points.map((p, i) => {
        const len = labelSeries.points.length;
        if (len > 7 && i % Math.ceil(len / 6) !== 0 && i !== len - 1) return null;
        return (
          <text
            key={p.id || i}
            x={xAt(i, len)}
            y={H - 10}
            textAnchor="middle"
            fontSize="10"
            fill="var(--text-dim)"
          >
            {formatDate(p.date).replace(/,.*/, '')}
          </text>
        );
      })}
      {seriesList.map((s) => {
        const len = s.points.length;
        const d = s.points
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i, len).toFixed(1)},${yAt(p.value).toFixed(1)}`)
          .join(' ');
        return (
          <g key={s.label}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {s.points.map((p, i) => (
              <circle
                key={p.id || i}
                cx={xAt(i, len)}
                cy={yAt(p.value)}
                r="4"
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth="1.5"
                style={{ cursor: onPointClick ? 'pointer' : 'default' }}
                onClick={() => onPointClick && onPointClick(p)}
              >
                <title>{`${formatDate(p.date)}: ${Math.round(p.value)}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// axes: [{key, label}]; datasets: [{label, color, fill?, values:{key:0..100}}]
export function RadarChart({ axes = [], datasets = [], size = 320, max = 100 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 54;
  const n = axes.length;
  if (n < 3) return null;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i, val) => {
    const rad = (val / max) * r;
    return [cx + Math.cos(angle(i)) * rad, cy + Math.sin(angle(i)) * rad];
  };

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} style={{ maxWidth: size }}>
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={axes.map((_, i) => point(i, max * ring).join(',')).join(' ')}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
        />
      ))}
      {axes.map((a, i) => {
        const [x, y] = point(i, max);
        const [lx, ly] = [cx + Math.cos(angle(i)) * (r + 22), cy + Math.sin(angle(i)) * (r + 22)];
        return (
          <g key={a.key}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />
            <text
              x={lx}
              y={ly}
              textAnchor={Math.abs(lx - cx) < 6 ? 'middle' : lx > cx ? 'start' : 'end'}
              dominantBaseline="middle"
              fontSize="10"
              fill="var(--text-dim)"
            >
              {a.label}
            </text>
          </g>
        );
      })}
      {datasets.map((ds) => {
        const pts = axes.map((a, i) => point(i, ds.values[a.key] ?? 0).join(','));
        return (
          <polygon
            key={ds.label}
            points={pts.join(' ')}
            fill={ds.fill ?? `color-mix(in srgb, ${ds.color} 22%, transparent)`}
            stroke={ds.color}
            strokeWidth="2"
          />
        );
      })}
    </svg>
  );
}
