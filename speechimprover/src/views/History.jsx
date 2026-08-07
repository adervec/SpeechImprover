import { Fragment, useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { ScoreBadge, EmptyState, Modal, useToast } from '../components/ui.jsx';
import { formatDateTime, formatBytes } from '../lib/format.js';
import RecordingAudio from '../components/RecordingAudio.jsx';

export default function History({ navigate }) {
  const { sessions, removeSession, restoreSession, purgeAudio, getAudioBlob, updateSession } = useStore();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });
  const [compareSel, setCompareSel] = useState([]);
  const [audioUrls, setAudioUrls] = useState({});
  const [playingId, setPlayingId] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [quota, setQuota] = useState(null);

  useEffect(() => () => {
    Object.values(audioUrls).forEach((u) => URL.revokeObjectURL(u));
  }, [audioUrls]);

  // Browser storage headroom, so "purge to free space" has a target the user can gauge.
  useEffect(() => {
    navigator.storage?.estimate?.().then(setQuota).catch(() => {});
  }, [sessions.length]);

  const modes = useMemo(() => [...new Set(sessions.map((s) => s.mode).filter(Boolean))], [sessions]);
  const audioCount = useMemo(() => sessions.filter((s) => s.audioId).length, [sessions]);
  const totalAudio = useMemo(() => sessions.reduce((sum, s) => sum + (s.audioBytes || 0), 0), [sessions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (modeFilter !== 'all' && s.mode !== modeFilter) return false;
      if (favOnly && !s.favorite) return false;
      if (!q) return true;
      return (
        (s.exerciseTitle || '').toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q) ||
        (s.transcript || '').toLowerCase().includes(q)
      );
    });
  }, [sessions, search, modeFilter, favOnly]);

  const sorted = useMemo(() => {
    const get = (s) => (sort.key === 'alignment' ? (s.distances?.alignment ?? null)
      : sort.key === 'audioBytes' ? (s.audioBytes || 0)
        : s[sort.key]);
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av = get(a); let bv = get(b);
      let c;
      if (sort.key === 'createdAt' || sort.key === 'exerciseTitle') {
        c = String(av ?? '').localeCompare(String(bv ?? ''));
      } else {
        av = av == null ? -Infinity : av; bv = bv == null ? -Infinity : bv;
        c = av - bv;
      }
      return sort.dir === 'asc' ? c : -c;
    });
    return arr;
  }, [filtered, sort]);

  function sortBy(key) {
    setSort((s) => (s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'exerciseTitle' ? 'asc' : 'desc' }));
  }
  const th = (k, label, style) => (
    <th key={k} style={{ cursor: 'pointer', userSelect: 'none', ...style }} onClick={() => sortBy(k)} aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      {label}{sort.key === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );

  async function togglePlay(s) {
    if (!s.audioId) return;
    if (playingId === s.id) {
      setPlayingId(null);
      return;
    }
    if (!audioUrls[s.id]) {
      const blob = await getAudioBlob(s.audioId);
      if (!blob) {
        toast('Audio is no longer available.');
        return;
      }
      const url = URL.createObjectURL(blob);
      setAudioUrls((prev) => ({ ...prev, [s.id]: url }));
    }
    setPlayingId(s.id);
  }

  function toggleCompare(id) {
    setCompareSel((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return prev.length >= 2 ? [prev[1], id] : [...prev, id];
    });
  }

  async function downloadAudio(s) {
    if (!s.audioId) return;
    const blob = await getAudioBlob(s.audioId);
    if (!blob) { toast('Audio is no longer available.'); return; }
    const url = URL.createObjectURL(blob);
    const ext = (s.audioMime || '').includes('ogg') ? 'ogg' : (s.audioMime || '').includes('webm') ? 'webm' : 'audio';
    const a = document.createElement('a');
    a.href = url;
    a.download = `speech-${(s.exerciseTitle || s.mode || 'session').replace(/[^\w-]+/g, '_')}-${s.id}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function doPurge(s) {
    await purgeAudio(s.id);
    toast('Audio purged — scores kept.');
  }
  async function doDelete(s) {
    const removed = await removeSession(s.id);
    setConfirmDel(null);
    toast('Session deleted.', {
      action: { label: 'Undo', onClick: () => removed && restoreSession(removed.record, removed.blob, removed.mime) },
    });
  }

  if (!sessions.length) {
    return <EmptyState icon="🕘" title="No sessions yet" action={<button className="btn primary" onClick={() => navigate('practice')}>Record one</button>}>Everything you record is historized here by default.</EmptyState>;
  }

  return (
    <div className="stack">
      <div className="row spread wrap">
        <div className="row wrap">
          <input placeholder="Search title, notes, transcript…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 280 }} />
          <div className="pill-group">
            <button className={`pill ${modeFilter === 'all' ? 'active' : ''}`} onClick={() => setModeFilter('all')}>All</button>
            {modes.map((m) => <button key={m} className={`pill ${modeFilter === m ? 'active' : ''}`} onClick={() => setModeFilter(m)}>{m}</button>)}
            <button className={`pill ${favOnly ? 'active' : ''}`} onClick={() => setFavOnly((v) => !v)} title="Show only favorites">★ Favorites</button>
          </div>
        </div>
        <span className="small muted">{sorted.length} of {sessions.length}</span>
      </div>

      <div className="card tight">
        <div className="grid cols-3">
          <div className="stat"><span className="big" style={{ fontSize: '1.3rem' }}>{sessions.length}</span><span className="lbl">Recordings</span></div>
          <div className="stat"><span className="big" style={{ fontSize: '1.3rem' }}>{audioCount}</span><span className="lbl">With audio</span></div>
          <div className="stat"><span className="big" style={{ fontSize: '1.3rem' }}>{formatBytes(totalAudio)}</span><span className="lbl">Audio stored</span></div>
        </div>
        {quota?.quota > 0 && (
          <p className="tiny muted" style={{ margin: '10px 0 0' }}>
            Browser storage: <b>{formatBytes(quota.usage || 0)}</b> of {formatBytes(quota.quota)} used ({Math.round((quota.usage / quota.quota) * 100)}%).
          </p>
        )}
        <p className="tiny muted" style={{ margin: '6px 0 0' }}>
          Play, download or delete any recording below. Bulk export/import and one-click purge live in <a onClick={() => navigate('settings')} style={{ cursor: 'pointer', color: 'var(--accent)' }}>Settings → Data &amp; storage</a>.
        </p>
      </div>

      {compareSel.length === 2 && (
        <div className="card tight row spread" style={{ borderColor: 'var(--accent)' }}>
          <span className="small">2 sessions selected for comparison.</span>
          <div className="row">
            <button className="btn ghost sm" onClick={() => setCompareSel([])}>Clear</button>
            <button className="btn primary sm" onClick={() => navigate('compare', { query: { a: compareSel[0], b: compareSel[1] } })}>Compare A vs B →</button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState icon="🔍" title="No sessions match"
          action={<button className="btn" onClick={() => { setSearch(''); setModeFilter('all'); setFavOnly(false); }}>Clear filters</button>}>
          Nothing matches your current search and filters.
        </EmptyState>
      ) : (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data">
          <thead>
            <tr>
              {th('createdAt', 'When')}
              {th('exerciseTitle', 'Exercise')}
              <th>Mode</th>
              {th('overall', 'Overall')}
              {th('alignment', 'Align')}
              {th('audioBytes', 'Audio')}
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <Fragment key={s.id}>
                <tr>
                  <td className="nowrap small">{formatDateTime(s.createdAt)}</td>
                  <td>{s.exerciseTitle || '—'}{s.notes && <div className="tiny muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📝 {s.notes}</div>}</td>
                  <td><span className="badge">{s.mode}</span></td>
                  <td>{s.assessment === 'completion' ? <span className={`badge ${s.completion?.completed ? 'good' : 'fair'}`}>{s.completion?.completed ? '✓ done' : 'partial'}</span> : <ScoreBadge score={s.overall} />}</td>
                  <td className="mono small">{s.assessment === 'completion' ? '—' : `${s.distances?.alignment ?? '—'}%`}</td>
                  <td className="small nowrap">{s.audioId ? formatBytes(s.audioBytes) : <span className="muted">purged</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                      <button className="btn ghost sm" title={s.favorite ? 'Unfavorite' : 'Favorite'} aria-pressed={!!s.favorite} style={{ color: s.favorite ? 'var(--warn)' : undefined }} onClick={() => updateSession(s.id, { favorite: !s.favorite })}>{s.favorite ? '★' : '☆'}</button>
                      {s.audioId && <button className="btn ghost sm" onClick={() => togglePlay(s)}>{playingId === s.id ? '❚❚' : '▶'}</button>}
                      {s.audioId && <button className="btn ghost sm" title="Download audio" onClick={() => downloadAudio(s)}>⬇</button>}
                      <button className="btn ghost sm" onClick={() => navigate('session', { param: s.id })}>Open</button>
                      {s.exerciseId && <button className="btn ghost sm" onClick={() => navigate('practice', { query: { exercise: s.exerciseId } })}>Repeat</button>}
                      <button className={`btn sm ${compareSel.includes(s.id) ? 'primary' : 'ghost'}`} onClick={() => toggleCompare(s.id)}>⇄</button>
                      {s.audioId && <button className="btn ghost sm" title="Purge audio (keep scores)" onClick={() => doPurge(s)}>🗑audio</button>}
                      <button className="btn ghost sm danger" onClick={() => setConfirmDel(s)}>✕</button>
                    </div>
                  </td>
                </tr>
                {playingId === s.id && audioUrls[s.id] && (
                  <tr>
                    <td colSpan={7} style={{ background: 'var(--bg-2)' }}>
                      <RecordingAudio src={audioUrls[s.id]} autoPlay />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {confirmDel && (
        <Modal
          title="Delete this session?"
          onClose={() => setConfirmDel(null)}
          footer={<>
            <button className="btn ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
            <button className="btn danger" onClick={() => doDelete(confirmDel)}>Delete permanently</button>
          </>}
        >
          <p className="muted">This removes <b>{confirmDel.exerciseTitle || 'the session'}</b> and its audio for good. To free space without losing your scores, use the “🗑audio” purge instead.</p>
        </Modal>
      )}
    </div>
  );
}
