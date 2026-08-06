// Projects: named containers you assign recordings to — a free-speaking series,
// or reading an entire book passage by passage (with a tracked position).

import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { ScoreBadge, EmptyState, Modal, useToast } from '../components/ui.jsx';
import { splitIntoPassages } from '../lib/passages.js';
import { averageOverall } from '../lib/aggregate.js';
import { formatDuration } from '../lib/format.js';
import { exportProjectAudiobook, reconcileTracks, orderedProjectSessions } from '../lib/audiobook.js';
import { decodeBlob } from '../lib/analysis/audioAnalysis.js';
import { encodeWav, resampleLinear } from '../lib/audioEnhance.js';
import WaveformEditor from '../components/WaveformEditor.jsx';

function projectStats(project, sessions) {
  const mine = sessions.filter((s) => s.projectId === project.id);
  const scored = mine.filter((s) => s.overall != null);
  const duration = mine.reduce((sum, s) => sum + (s.durationSec || s.metrics?.durationSec || 0), 0);
  const passages = project.text?.trim() ? splitIntoPassages(project.text, project.chunkWords) : [];
  return { mine, count: mine.length, avg: averageOverall(scored), duration, passages };
}

export default function Projects({ route, navigate }) {
  const { projects, sessions, createProject, updateProject, deleteProject, getAudioBlob } = useStore();

  if (route.param) {
    const project = projects.find((p) => p.id === route.param);
    if (!project) {
      return <EmptyState icon="📁" title="Project not found" action={<button className="btn primary" onClick={() => navigate('projects')}>All projects</button>}>It may have been deleted.</EmptyState>;
    }
    return <ProjectDetail project={project} sessions={sessions} updateProject={updateProject} deleteProject={deleteProject} navigate={navigate} getAudioBlob={getAudioBlob} />;
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

// Inline-editable track title (the recording's alias within the project).
function EditableTitle({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { setEditing(false); if (val.trim() && val.trim() !== value) onSave(val.trim()); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { setVal(value); setEditing(false); }
        }}
        style={{ width: 'auto', minWidth: 160, maxWidth: '60vw', padding: '4px 8px' }}
      />
    );
  }
  return (
    <button className="btn ghost sm" style={{ padding: '2px 6px', fontWeight: 700 }} title="Rename track"
      onClick={() => { setVal(value); setEditing(true); }}>
      {value} ✎
    </button>
  );
}

function ProjectDetail({ project, sessions, updateProject, deleteProject, navigate, getAudioBlob }) {
  const toast = useToast();
  const [confirmDel, setConfirmDel] = useState(false);
  const [openIds, setOpenIds] = useState(() => new Set());
  const [exporting, setExporting] = useState(null); // null | { i, total, title }
  const [editing, setEditing] = useState(null); // track index being trimmed/split
  const st = useMemo(() => projectStats(project, sessions), [project, sessions]);
  const total = st.passages.length;
  const idx = Math.min(project.passageIndex || 0, total);
  const pct = total ? Math.round(idx / total * 100) : null;
  const chunkWords = project.chunkWords || 90;

  // Curated tracklist over the recordings (may not be 1:1: reordered, renamed, later split/merged).
  const ordered = useMemo(() => orderedProjectSessions(project, sessions), [project, sessions]);
  const tracks = useMemo(() => reconcileTracks(project.tracks, ordered), [project.tracks, ordered]);
  const byId = useMemo(() => Object.fromEntries(sessions.map((s) => [s.id, s])), [sessions]);

  function setPos(i) {
    updateProject(project.id, { passageIndex: Math.max(0, Math.min(i, total)) });
  }
  function commitTracks(next) {
    updateProject(project.id, { tracks: next });
  }
  function moveTrack(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= tracks.length) return;
    const next = [...tracks];
    [next[i], next[j]] = [next[j], next[i]];
    commitTracks(next);
  }
  function renameTrack(i, title) {
    commitTracks(tracks.map((t, k) => (k === i ? { ...t, title } : t)));
  }
  // Apply a waveform edit: region [start,end] + cut times → one trimmed track, or N split
  // tracks (each a segment of the same recording). Only single-segment tracks are editable.
  function applyEdit(i, [start, end], cuts) {
    const t = tracks[i];
    const sid = t.segments[0].sessionId;
    const bounds = [start, ...cuts, end];
    const pieces = [];
    for (let k = 0; k < bounds.length - 1; k += 1) {
      pieces.push({
        id: `t-${sid}-${Math.round(bounds[k] * 1000)}`,
        title: bounds.length > 2 ? `${t.title} (${k + 1})` : t.title,
        segments: [{ sessionId: sid, startSec: +bounds[k].toFixed(3), endSec: +bounds[k + 1].toFixed(3) }],
      });
    }
    commitTracks([...tracks.slice(0, i), ...pieces, ...tracks.slice(i + 1)]);
    setEditing(null);
    toast(pieces.length > 1 ? `Split into ${pieces.length} tracks.` : 'Trim applied.');
  }
  function toggleOpen(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function trackMeta(t) {
    const segs = t.segments.map((seg) => byId[seg.sessionId]).filter(Boolean);
    const duration = segs.reduce((n, s) => n + (s.durationSec || s.metrics?.durationSec || 0), 0);
    const scored = segs.filter((s) => s.overall != null);
    const avg = scored.length ? Math.round(scored.reduce((n, s) => n + s.overall, 0) / scored.length) : null;
    const transcript = segs.map((s) => s.transcript).filter(Boolean).join('\n\n');
    return { segs, duration, avg, transcript, firstId: segs[0]?.id || null };
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function exportAudiobook() {
    setExporting({ i: 0, total: tracks.length, title: '' });
    try {
      const res = await exportProjectAudiobook(
        project,
        sessions,
        { getAudioBlob, decodeBlob, encodeWav, resampleLinear },
        (p) => setExporting(p),
      );
      download(res.blob, res.filename);
      toast(`Exported ${res.trackCount} track${res.trackCount === 1 ? '' : 's'} · ${formatDuration(res.totalSec)}.`);
    } catch (e) {
      toast(e.message || 'Export failed.');
    } finally {
      setExporting(null);
    }
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

          <div style={{ marginTop: 16 }}>
            <div className="row spread">
              <span className="tiny muted">Passage size</span>
              <span className="tiny mono">~{chunkWords} words · {total} passages</span>
            </div>
            <input
              type="range" min={30} max={200} step={10} value={chunkWords} style={{ padding: 0 }}
              onChange={(e) => updateProject(project.id, { chunkWords: Number(e.target.value) })}
            />
            <p className="tiny muted" style={{ marginTop: 4 }}>
              Splits on paragraph breaks first, then fills up to this many words per passage. Changing it re-chunks the text.
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div>
            <h3>🎧 Tracklist</h3>
            <span className="tiny muted">reorder, rename &amp; preview — this is exactly what the audiobook exports</span>
          </div>
          <button className="btn primary sm" disabled={!tracks.length || !!exporting} onClick={exportAudiobook}>
            {exporting ? `Rendering ${Math.min(exporting.i + 1, exporting.total)}/${exporting.total}…` : '⬇ Export audiobook'}
          </button>
        </div>
        {tracks.length === 0 ? (
          <p className="muted small">No recordings assigned yet. Use “Record into this project”.</p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {tracks.map((t, i) => {
              const m = trackMeta(t);
              const open = openIds.has(t.id);
              return (
                <div key={t.id} className="card tight" style={{ background: 'var(--bg-2)' }}>
                  <div className="row spread wrap" style={{ gap: 8 }}>
                    <div className="row" style={{ gap: 8, minWidth: 0 }}>
                      <div className="stack" style={{ gap: 2 }}>
                        <button className="btn ghost sm" style={{ padding: '0 7px', lineHeight: 1.2 }} disabled={i === 0} onClick={() => moveTrack(i, -1)} aria-label="Move up">▲</button>
                        <button className="btn ghost sm" style={{ padding: '0 7px', lineHeight: 1.2 }} disabled={i === tracks.length - 1} onClick={() => moveTrack(i, 1)} aria-label="Move down">▼</button>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="row" style={{ gap: 8 }}>
                          <span className="tag">#{i + 1}</span>
                          <EditableTitle value={t.title} onSave={(v) => renameTrack(i, v)} />
                        </div>
                        <span className="tiny muted">
                          {formatDuration(m.duration)}{m.segs.length > 1 ? ` · ${m.segs.length} clips` : ''}{m.avg != null ? ` · avg ${m.avg}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn ghost sm" onClick={() => toggleOpen(t.id)}>{open ? '▴ hide' : '▾ transcript'}</button>
                      {t.segments.length === 1 && byId[t.segments[0].sessionId]?.audioId && (
                        <button className="btn ghost sm" onClick={() => setEditing(i)}>✂ Edit</button>
                      )}
                      {m.firstId && <button className="btn ghost sm" onClick={() => navigate('session', { param: m.firstId })}>Open</button>}
                    </div>
                  </div>
                  {open && (
                    <p className="tiny" style={{ marginTop: 8, whiteSpace: 'pre-wrap', color: 'var(--text-dim)' }}>
                      {m.transcript || 'No transcript captured for this recording.'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing != null && tracks[editing]?.segments.length === 1 && byId[tracks[editing].segments[0].sessionId] && (
        <WaveformEditor
          session={byId[tracks[editing].segments[0].sessionId]}
          getAudioBlob={getAudioBlob}
          initialStart={tracks[editing].segments[0].startSec ?? 0}
          initialEnd={tracks[editing].segments[0].endSec ?? null}
          onApply={(region, cuts) => applyEdit(editing, region, cuts)}
          onClose={() => setEditing(null)}
        />
      )}

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
