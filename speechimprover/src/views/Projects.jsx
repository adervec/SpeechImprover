// Projects: named containers you assign recordings to — a free-speaking series,
// or reading an entire book passage by passage (with a tracked position).

import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { ScoreBadge, EmptyState, Modal, useToast } from '../components/ui.jsx';
import { splitIntoPassages } from '../lib/passages.js';
import { averageOverall } from '../lib/aggregate.js';
import { formatDuration, formatDateTime } from '../lib/format.js';

function projectStats(project, sessions) {
  const mine = sessions.filter((s) => s.projectId === project.id);
  const scored = mine.filter((s) => s.overall != null);
  const duration = mine.reduce((sum, s) => sum + (s.durationSec || s.metrics?.durationSec || 0), 0);
  const passages = project.text?.trim() ? splitIntoPassages(project.text) : [];
  return { mine, count: mine.length, avg: averageOverall(scored), duration, passages };
}

export default function Projects({ route, navigate }) {
  const { projects, sessions, createProject, updateProject, deleteProject } = useStore();

  if (route.param) {
    const project = projects.find((p) => p.id === route.param);
    if (!project) {
      return <EmptyState icon="📁" title="Project not found" action={<button className="btn primary" onClick={() => navigate('projects')}>All projects</button>}>It may have been deleted.</EmptyState>;
    }
    return <ProjectDetail project={project} sessions={sessions} updateProject={updateProject} deleteProject={deleteProject} navigate={navigate} />;
  }

  return <ProjectList projects={projects} sessions={sessions} createProject={createProject} navigate={navigate} />;
}

function ProjectList({ projects, sessions, createProject, navigate }) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const toast = useToast();

  function create() {
    if (!name.trim()) { toast('Give the project a name.'); return; }
    const p = createProject({ name, notes, text });
    setName(''); setNotes(''); setText(''); setOpen(false);
    toast('Project created.');
    navigate('projects', { param: p.id });
  }

  return (
    <div className="stack">
      <div className="row spread wrap">
        <p className="muted small" style={{ maxWidth: 560, margin: 0 }}>
          Group recordings toward a goal — a free-speaking series, or read an entire book passage by passage.
        </p>
        <button className="btn primary" onClick={() => setOpen(true)}>＋ New project</button>
      </div>

      {projects.length === 0 ? (
        <EmptyState icon="📁" title="No projects yet" action={<button className="btn primary" onClick={() => setOpen(true)}>Create one</button>}>
          A project lets you record a long work across many sessions and track your progress through it.
        </EmptyState>
      ) : (
        <div className="grid cols-2">
          {projects.map((p) => {
            const st = projectStats(p, sessions);
            const pct = st.passages.length ? Math.round(Math.min(p.passageIndex || 0, st.passages.length) / st.passages.length * 100) : null;
            return (
              <button key={p.id} className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate('projects', { param: p.id })}>
                <div className="row spread">
                  <h3 style={{ margin: 0 }}>{p.text?.trim() ? '📖 ' : '📁 '}{p.name}</h3>
                  {st.avg > 0 && <ScoreBadge score={st.avg} />}
                </div>
                {p.notes && <p className="tiny muted" style={{ margin: '6px 0 0' }}>{p.notes}</p>}
                <div className="row" style={{ gap: 16, marginTop: 10 }}>
                  <span className="tiny muted">{st.count} recording{st.count === 1 ? '' : 's'}</span>
                  <span className="tiny muted">{formatDuration(st.duration)}</span>
                </div>
                {pct != null && (
                  <div style={{ marginTop: 10 }}>
                    <div className="row spread"><span className="tiny muted">Reading progress</span><span className="tiny mono">{pct}%</span></div>
                    <div className="attr-bar-track"><div className="attr-bar-fill" style={{ width: `${pct}%`, background: 'var(--accent)' }} /></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {open && (
        <Modal
          title="New project"
          onClose={() => setOpen(false)}
          footer={<>
            <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" onClick={create}>Create</button>
          </>}
        >
          <label className="field">Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Read “The Great Gatsby”" autoFocus /></label>
          <label className="field" style={{ marginTop: 12 }}>Notes / goal (optional)<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. One chapter a day, clear and unhurried" /></label>
          <label className="field" style={{ marginTop: 12 }}>
            Full text to read (optional) — paste a book/essay and you'll read it passage by passage
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Paste the whole work here. Leave empty for a free-speaking project you just file recordings under." />
          </label>
          {text.trim() && <p className="tiny muted" style={{ marginTop: 8 }}>≈ {splitIntoPassages(text).length} passages.</p>}
        </Modal>
      )}
    </div>
  );
}

function ProjectDetail({ project, sessions, updateProject, deleteProject, navigate }) {
  const toast = useToast();
  const [confirmDel, setConfirmDel] = useState(false);
  const st = useMemo(() => projectStats(project, sessions), [project, sessions]);
  const total = st.passages.length;
  const idx = Math.min(project.passageIndex || 0, total);
  const pct = total ? Math.round(idx / total * 100) : null;

  function setPos(i) {
    updateProject(project.id, { passageIndex: Math.max(0, Math.min(i, total)) });
  }

  return (
    <div className="stack">
      <div className="row spread wrap">
        <button className="btn ghost sm" onClick={() => navigate('projects')}>← All projects</button>
        <div className="row">
          <button className="btn primary" onClick={() => navigate('practice', { query: { project: project.id } })}>
            ● {total ? 'Record next passage' : 'Record into this project'}
          </button>
          <button className="btn ghost sm danger" onClick={() => setConfirmDel(true)}>Delete</button>
        </div>
      </div>

      <div className="card">
        <label className="field">Project name
          <input defaultValue={project.name} onBlur={(e) => e.target.value.trim() && updateProject(project.id, { name: e.target.value.trim() })} />
        </label>
        <label className="field" style={{ marginTop: 12 }}>Notes / goal
          <input defaultValue={project.notes} onBlur={(e) => updateProject(project.id, { notes: e.target.value })} />
        </label>
        <div className="grid cols-3" style={{ marginTop: 16 }}>
          <div className="stat"><span className="big">{st.count}</span><span className="lbl">Recordings</span></div>
          <div className="stat"><span className="big">{st.avg || '—'}</span><span className="lbl">Avg score</span></div>
          <div className="stat"><span className="big">{formatDuration(st.duration)}</span><span className="lbl">Total length</span></div>
        </div>
      </div>

      {total > 0 && (
        <div className="card">
          <div className="card-head"><h3>📖 Reading progress</h3><span className="mono small">passage {Math.min(idx + 1, total)} of {total} · {pct}%</span></div>
          <div className="attr-bar-track" style={{ marginBottom: 12 }}><div className="attr-bar-fill" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--good)' : 'var(--accent)' }} /></div>
          {idx < total ? (
            <div className="prompt-box" style={{ marginBottom: 12 }}>{st.passages[idx]}</div>
          ) : (
            <p className="small" style={{ marginBottom: 12 }}>🎉 You've read the whole work.</p>
          )}
          <div className="row wrap">
            <button className="btn sm" disabled={idx <= 0} onClick={() => setPos(idx - 1)}>◀ Previous</button>
            <button className="btn sm" disabled={idx >= total} onClick={() => setPos(idx + 1)}>Skip ▶</button>
            <button className="btn ghost sm" onClick={() => setPos(0)}>Reset to start</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-head" style={{ padding: '14px 16px 0' }}><h3>Recordings</h3></div>
        {st.mine.length === 0 ? (
          <p className="muted small" style={{ padding: '8px 16px 16px' }}>No recordings assigned yet. Use “Record into this project”.</p>
        ) : (
          <table className="data">
            <thead><tr><th>When</th><th>Title</th><th>Overall</th><th>Length</th><th></th></tr></thead>
            <tbody>
              {st.mine.map((s) => (
                <tr key={s.id}>
                  <td className="nowrap small">{formatDateTime(s.createdAt)}</td>
                  <td>{s.exerciseTitle || s.mode}</td>
                  <td>{s.overall != null ? <ScoreBadge score={s.overall} /> : '—'}</td>
                  <td className="mono small">{formatDuration(s.durationSec || s.metrics?.durationSec)}</td>
                  <td className="nowrap" style={{ textAlign: 'right' }}><button className="btn ghost sm" onClick={() => navigate('session', { param: s.id })}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmDel && (
        <Modal
          title="Delete this project?"
          onClose={() => setConfirmDel(false)}
          footer={<>
            <button className="btn ghost" onClick={() => setConfirmDel(false)}>Cancel</button>
            <button className="btn danger" onClick={() => { deleteProject(project.id); toast('Project deleted.'); navigate('projects'); }}>Delete project</button>
          </>}
        >
          <p className="muted">This removes the project container. Your {st.count} recording{st.count === 1 ? '' : 's'} are kept in History — only the grouping is deleted.</p>
        </Modal>
      )}
    </div>
  );
}
