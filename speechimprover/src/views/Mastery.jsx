import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Modal } from '../components/ui.jsx';
import {
  TIERS,
  TECHNIQUES,
  TECHNIQUE_MAP,
  getTechnique,
  masteryStatus,
  techniqueProgress,
  isTechniqueUnlocked,
} from '../lib/vocalMastery.js';

const gradientBg = {
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 22%, var(--surface)), var(--surface))',
};

function TechniqueCard({ tech, progress, unlocked, onOpen }) {
  const prog = techniqueProgress(progress, tech.id);
  const pct = prog.total ? (prog.matched / prog.total) * 100 : 0;
  return (
    <div className="card tight technique-card" data-locked={!unlocked}>
      <div className="row spread">
        <span style={{ fontSize: 26 }}>{tech.icon}</span>
        <span className="badge" style={prog.complete ? { color: 'var(--good)', borderColor: 'color-mix(in srgb, var(--good) 45%, var(--border))' } : undefined}>
          {prog.matched}/{prog.total}
        </span>
      </div>
      <h3 style={{ fontSize: '1rem', margin: '8px 0 2px' }}>{tech.name}</h3>
      <p className="tiny muted" style={{ flex: 1 }}>{tech.tagline}</p>
      <div className="attr-bar-track" style={{ margin: '10px 0' }}>
        <div className="attr-bar-fill" style={{ width: `${pct}%`, background: prog.complete ? 'var(--good)' : 'var(--accent)' }} />
      </div>
      <button className={`btn sm block ${unlocked && !prog.complete ? 'primary' : ''}`} onClick={onOpen}>
        {!unlocked ? '🔒 Locked' : prog.complete ? '✓ Mastered · review' : prog.attempted ? 'Continue →' : 'Open →'}
      </button>
    </div>
  );
}

function TechniqueModal({ tech, progress, unlocked, onClose, onStart }) {
  return (
    <Modal title={`${tech.icon}  ${tech.name}`} onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <p className="small">{tech.overview}</p>
      <div className="card tight" style={{ margin: '12px 0', background: 'var(--bg-2)' }}>
        <p className="tiny"><b>Why it works:</b> {tech.science}</p>
      </div>
      {!unlocked && (
        <p className="small" style={{ color: 'var(--warn)' }}>
          🔒 Unlock by mastering: {tech.prerequisites.map((id) => TECHNIQUE_MAP[id]?.name).filter(Boolean).join(', ')}.
        </p>
      )}

      <h4 style={{ margin: '14px 0 6px' }}>Staged drills</h4>
      <div className="stack" style={{ gap: 8 }}>
        {tech.stages.map((s, i) => {
          const rec = progress?.[tech.id]?.stages?.[s.id];
          const measured = typeof s.target === 'function' || s.target;
          return (
            <div key={s.id} className="card tight" style={{ background: 'var(--bg-2)', borderColor: rec?.matched ? 'color-mix(in srgb, var(--good) 45%, var(--border))' : 'var(--border)' }}>
              <div className="row spread">
                <span className="small"><b>{i + 1}. {s.title}</b> {rec?.matched ? <span style={{ color: 'var(--good)' }}>✓</span> : ''}</span>
                {rec?.best != null && <span className="badge">best {rec.best}</span>}
              </div>
              <p className="tiny muted" style={{ margin: '4px 0 8px' }}>{s.instructions}</p>
              <div className="row spread">
                <span className="tiny muted">{measured ? '📊 scored vs target' : '✔️ completion + self-check'}</span>
                <button className="btn sm primary" disabled={!unlocked} onClick={() => onStart(i)}>
                  {rec?.attempts ? 'Retry →' : 'Start →'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <h4 style={{ margin: '14px 0 6px' }}>Coaching tips</h4>
      <ul className="small muted" style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {tech.tips.map((tip, i) => <li key={i}>{tip}</li>)}
      </ul>
    </Modal>
  );
}

export default function Mastery({ navigate }) {
  const { masteryProgress, resetMastery } = useStore();
  const progress = masteryProgress || {};
  const status = masteryStatus(progress);
  const [openId, setOpenId] = useState(null);
  const open = openId ? getTechnique(openId) : null;
  const openUnlocked = open ? isTechniqueUnlocked(open, progress) : false;

  function startStage(techId, idx) {
    setOpenId(null);
    navigate('practice', { query: { technique: techId, stage: String(idx) } });
  }

  // Progress *within* the current level (empties right after leveling up), not total XP / next.
  const pctToNext = status.nextAt != null
    ? Math.min(100, Math.max(0, ((status.xp - status.levelAt) / (status.nextAt - status.levelAt)) * 100))
    : 100;

  return (
    <div className="stack">
      <div className="card" style={gradientBg}>
        <div className="row spread wrap">
          <div>
            <div className="tag">Vocal mastery · the endgame</div>
            <h2 style={{ margin: '2px 0' }}>{status.title}</h2>
          </div>
          <button className="btn ghost sm" onClick={() => { if (confirm('Reset all mastery progress?')) resetMastery(); }}>Reset progress</button>
        </div>
        <p className="muted small" style={{ margin: '8px 0 14px' }}>
          Advanced techniques that build on your everyday speech work — pitch &amp; range, resonance, mimicry,
          accents, character voices, ventriloquism, and the complete vocal-actor toolkit. Clear staged,
          measured drills to level up. Higher tiers unlock as you master the foundations.
        </p>
        <div className="row spread" style={{ marginBottom: 6 }}>
          <span className="small muted">{status.xp} of {status.totalStages} mastery drills cleared</span>
          <span className="small mono">Level {status.level + 1} · {status.title}</span>
        </div>
        <div className="attr-bar-track">
          <div className="attr-bar-fill" style={{ width: `${pctToNext}%`, background: 'var(--accent)' }} />
        </div>
        {status.nextAt != null && (
          <span className="tiny muted">{status.nextAt - status.xp} more drill{status.nextAt - status.xp === 1 ? '' : 's'} to reach the next level.</span>
        )}
      </div>

      {TIERS.map((tier) => {
        const items = TECHNIQUES.filter((t) => t.tier === tier.key);
        if (!items.length) return null;
        return (
          <div key={tier.key}>
            <div className="card-head" style={{ marginBottom: 8 }}>
              <div>
                <h3 style={{ marginBottom: 2 }}>{tier.label}</h3>
                <p className="tiny muted" style={{ maxWidth: 720 }}>{tier.blurb}</p>
              </div>
            </div>
            <div className="grid cols-3">
              {items.map((tech) => (
                <TechniqueCard
                  key={tech.id}
                  tech={tech}
                  progress={progress}
                  unlocked={isTechniqueUnlocked(tech, progress)}
                  onOpen={() => setOpenId(tech.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {open && (
        <TechniqueModal
          tech={open}
          progress={progress}
          unlocked={openUnlocked}
          onClose={() => setOpenId(null)}
          onStart={(i) => startStage(open.id, i)}
        />
      )}
    </div>
  );
}
