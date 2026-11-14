// Cmd/Ctrl-K quick-jump. Filter destinations, ↑/↓ to move, Enter to go.
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../lib/i18n.js';

// Translated at render time (a function, not a constant).
const commands = () => [
  { id: '', label: t('Dashboard'), hint: t('Home & stats') },
  { id: 'practice', label: t('Just speak'), hint: t('Free speaking — start recording now'), query: { quick: '1' } },
  { id: 'practice', label: t('Practice'), hint: t('Record a new session') },
  { id: 'exercises', label: t('Exercises'), hint: t('Drills & daily program') },
  { id: 'projects', label: t('Projects'), hint: t('Books & recording series') },
  { id: 'mastery', label: t('Vocal mastery'), hint: t('Advanced techniques') },
  { id: 'voicelab', label: t('Voice lab'), hint: t('Experiment with your voice') },
  { id: 'trends', label: t('Trends'), hint: t('Progress charts') },
  { id: 'history', label: t('Recordings'), hint: t('History & data') },
  { id: 'coach', label: t('AI coach'), hint: t('Feedback & summary') },
  { id: 'cowork', label: t('Cowork sync'), hint: t('AI folder handshake') },
  { id: 'references', label: t('References'), hint: t('Goals & targets') },
  { id: 'profile', label: t('Profile'), hint: t('About you') },
  { id: 'settings', label: t('Settings'), hint: t('Preferences & data') },
  { id: 'help', label: t('Help & guide'), hint: t('How it works') },
];

export default function CommandPalette({ onClose, navigate }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = commands();
    if (!s) return all;
    return all.filter((c) => c.label.toLowerCase().includes(s) || c.hint.toLowerCase().includes(s));
  }, [q]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const run = (c) => { if (c) { navigate(c.id, c.query ? { query: c.query } : undefined); onClose(); } };
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
          placeholder={t('Jump to…  (↑ ↓ then Enter)')}
          aria-label={t('Jump to a page')}
          style={{ width: '100%', border: 'none', borderRadius: 0, borderBottom: '1px solid var(--border)', fontSize: '1rem', padding: '14px 16px' }}
        />
        <div style={{ maxHeight: '46vh', overflowY: 'auto' }}>
          {filtered.length === 0 && <div className="muted small" style={{ padding: 16 }}>{t('No matches.')}</div>}
          {filtered.map((c, i) => (
            <button
              key={c.label}
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
