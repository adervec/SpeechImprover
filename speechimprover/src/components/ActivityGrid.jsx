// GitHub-style contribution heatmap of practice activity. Pure layout over
// buildActivityGrid(); tooltips on hover, no interaction needed.

import { useMemo } from 'react';
import { buildActivityGrid } from '../lib/aggregate.js';

const LEVEL_BG = [
  'color-mix(in srgb, var(--text) 8%, transparent)',
  'color-mix(in srgb, var(--accent) 28%, transparent)',
  'color-mix(in srgb, var(--accent) 50%, transparent)',
  'color-mix(in srgb, var(--accent) 74%, transparent)',
  'var(--accent)',
];

export default function ActivityGrid({ sessions, weeks = 53 }) {
  const { columns, total } = useMemo(() => buildActivityGrid(sessions, weeks), [sessions, weeks]);
  const cell = { width: 11, height: 11, borderRadius: 2 };

  return (
    <div>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ minWidth: weeks * 14 }}>
          <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '11px', columnGap: 3, height: 12, marginBottom: 4 }}>
            {columns.map((c, i) => (
              <span key={i} className="tiny muted" style={{ whiteSpace: 'nowrap', overflow: 'visible', fontSize: 9, lineHeight: '12px' }}>{c.month || ''}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 11px)', gridAutoFlow: 'column', gridAutoColumns: '11px', gap: 3 }}>
            {columns.flatMap((c) => c.days).map((d) => (
              <span
                key={d.key}
                title={d.future ? '' : `${d.key}: ${d.count} session${d.count === 1 ? '' : 's'}`}
                style={{
                  ...cell,
                  background: d.future ? 'transparent' : LEVEL_BG[d.level],
                  outline: d.isToday ? '1px solid var(--text)' : 'none',
                  outlineOffset: -1,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="row spread" style={{ marginTop: 8, alignItems: 'center' }}>
        <span className="tiny muted">{total} sessions in the last {weeks} weeks</span>
        <span className="row tiny muted" style={{ gap: 4, alignItems: 'center' }}>
          Less
          {LEVEL_BG.map((bg, i) => <span key={i} style={{ ...cell, background: bg, display: 'inline-block' }} />)}
          More
        </span>
      </div>
    </div>
  );
}
