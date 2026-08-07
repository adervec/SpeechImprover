// Cmd/Ctrl-K quick-jump. Filter destinations, ↑/↓ to move, Enter to go.
import { useEffect, useMemo, useRef, useState } from 'react';

const COMMANDS = [
  { id: '', label: 'Dashboard', hint: 'Home & stats' },
  { id: 'practice', label: 'Practice', hint: 'Record a new session' },
  { id: 'exercises', label: 'Exercises', hint: 'Drills & daily program' },
  { id: 'projects', label: 'Projects', hint: 'Books & recording series' },
  { id: 'mastery', label: 'Vocal mastery', hint: 'Advanced techniques' },
  { id: 'voicelab', label: 'Voice lab', hint: 'Experiment with your voice' },
  { id: 'trends', label: 'Trends', hint: 'Progress charts' },
  { id: 'history', label: 'Recordings', hint: 'History & data' },
  { id: 'coach', label: 'AI coach', hint: 'Feedback & summary' },
  { id: 'references', label: 'References', hint: 'Goals & targets' },
  { id: 'profile', label: 'Profile', hint: 'About you' },
  { id: 'settings', label: 'Settings', hint: 'Preferences & data' },
  { id: 'help', label: 'Help & guide', hint: 'How it works' },
];

export default function CommandPalette({ onClose, navigate }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(s) || c.hint.toLowerCase().includes(s));
  }, [q]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const run = (c) => { if (c) { navigate(c.id); onClose(); } };
  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(filtered[idx]); }
    else if (e.key === 'Escape') { onClose(); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()} style={{ alignItems: 'flex-start', paddingTop: '12vh' }}>
      <div className="modal" style={{ width: 'min(560px, 96vw)', padding: 0, overflow: 'hidden' }} role="dialog" aria-modal="true">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setIdx(0); }}
          onKeyDown={onKey}
          placeholder="Jump to…  (↑ ↓ then Enter)"
          aria-label="Jump to a page"
          style={{ width: '100%', border: 'none', borderRadius: 0, borderBottom: '1px solid var(--border)', fontSize: '1rem', padding: '14px 16px' }}
        />
        <div style={{ maxHeight: '46vh', overflowY: 'auto' }}>
          {filtered.length === 0 && <div className="muted small" style={{ padding: 16 }}>No matches.</div>}
          {filtered.map((c, i) => (
            <button
              key={c.id || 'home'}
              onMouseEnter={() => setIdx(i)}
              onClick={() => run(c)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', border: 'none', background: i === idx ? 'var(--surface-2)' : 'transparent', color: 'var(--text)', padding: '11px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}
            >
              <span style={{ fontWeight: 600 }}>{c.label}</span>
              <span className="tiny muted">{c.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
