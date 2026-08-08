// Cowork Sync — hand recent practice to an AI agent via CoworkSyncHub's folder
// handshake (cowork-manifest v1). Push requests into a chosen local folder; the hub
// (or any agent pointed at the folder) writes replies back, which we import: coach
// feedback shows here; a program reply becomes a runnable daily program.

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { useToast } from '../components/ui.jsx';
import { formatDateTime } from '../lib/format.js';
import {
  buildCoworkDataset, buildRequestFiles, availableExercises, contentHash,
  parseReply, programStepsFromReply, loadCoworkState, saveCoworkState,
} from '../lib/cowork.js';
import {
  FS_SUPPORTED, pickCoworkDir, getSavedDir, forgetDir, ensurePermission, readFileAt, writeFiles,
} from '../lib/coworkFs.js';

export default function Cowork({ navigate }) {
  const { sessions, profile, startProgram } = useStore();
  const toast = useToast();
  const [dir, setDir] = useState(null);
  const [st, setSt] = useState(loadCoworkState);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [pasteChannel, setPasteChannel] = useState('coach');
  const [pasted, setPasted] = useState('');

  const dataset = useMemo(() => buildCoworkDataset(sessions, profile), [sessions, profile]);

  useEffect(() => {
    getSavedDir().then((h) => { if (h) setDir(h); }).catch(() => {});
  }, []);

  function persist(patch) { setSt((prev) => { const next = { ...prev, ...patch }; saveCoworkState(next); return next; }); }

  async function chooseFolder() {
    setMsg('');
    try {
      const h = await pickCoworkDir();
      setDir(h);
      persist({ dirName: h.name });
      setMsg('Folder connected — push your requests next.');
    } catch (e) { if (e?.name !== 'AbortError') setMsg(`Could not open folder: ${e?.message || e}`); }
  }

  async function disconnect() {
    await forgetDir().catch(() => {});
    setDir(null);
    persist({ dirName: '' });
  }

  async function pushRequests() {
    if (!dir) return;
    setBusy(true); setMsg('');
    try {
      if (!(await ensurePermission(dir, 'readwrite'))) { setMsg('Folder write permission was declined.'); setBusy(false); return; }
      await writeFiles(dir, buildRequestFiles(dataset));
      persist({
        lastPush: new Date().toISOString(),
        coachHash: contentHash(JSON.stringify(dataset)),
        programHash: contentHash(JSON.stringify({ ...dataset, availableExercises: availableExercises() })),
      });
      setMsg('Wrote cowork.json + coach & program requests. Run CoworkSyncHub (or point an agent at the folder), then Import replies.');
      toast('Cowork requests written.', { type: 'success' });
    } catch (e) { setMsg(`Write failed: ${e?.message || e}`); }
    setBusy(false);
  }

  function importCoach(reply) {
    persist({
      coach: {
        analysis: reply.analysis || '',
        focusAreas: Array.isArray(reply.focusAreas) ? reply.focusAreas : [],
        tips: Array.isArray(reply.tips) ? reply.tips : [],
        encouragement: reply.encouragement || '',
        at: new Date().toISOString(),
        stale: !!(st.coachHash && reply.requestHash && reply.requestHash !== st.coachHash),
      },
    });
    toast('Coach feedback imported.', { type: 'success' });
  }
  function importProgram(reply) {
    const steps = programStepsFromReply(reply);
    if (!steps.length) { setMsg('The program reply had no exercise ids I recognise.'); return false; }
    if (st.programHash && reply.requestHash && reply.requestHash !== st.programHash) {
      setMsg('Note: the program reply answered an older request — importing anyway.');
    }
    startProgram(steps, (dataset.focusAreas || []).map((f) => f.attribute));
    toast(`Imported a ${steps.length}-step program.`, { type: 'success' });
    return true;
  }

  async function importReplies() {
    if (!dir) return;
    setBusy(true); setMsg('');
    try {
      if (!(await ensurePermission(dir, 'readwrite'))) { setMsg('Folder permission was declined.'); setBusy(false); return; }
      let found = 0; let started = false;
      const coachText = await readFileAt(dir, 'coach/reply.json');
      if (coachText) { importCoach(parseReply(coachText)); found += 1; }
      const programText = await readFileAt(dir, 'program/reply.json');
      if (programText) { started = importProgram(parseReply(programText)); found += programText ? 1 : 0; }
      if (!found) setMsg('No replies yet (looking for coach/reply.json or program/reply.json).');
      else if (started) { setTimeout(() => navigate('exercises'), 400); }
    } catch (e) { setMsg(`Import failed: ${e?.message || e}`); }
    setBusy(false);
  }

  function downloadRequest(channel) {
    const f = buildRequestFiles(dataset).find((x) => x.path === `${channel}/request.json`);
    const url = URL.createObjectURL(new Blob([f.text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `speechimprover-${channel}-request.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function importPasted() {
    setMsg('');
    let reply;
    try { reply = parseReply(pasted); } catch { setMsg('That is not valid JSON.'); return; }
    if (pasteChannel === 'coach') importCoach(reply); else if (importProgram(reply)) setTimeout(() => navigate('exercises'), 400);
    setPasted('');
  }

  const canRun = sessions.length > 0;

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head"><h3>🤝 Cowork Sync</h3><span className="tiny muted">CoworkSyncHub · manifest v1</span></div>
        <p className="muted small" style={{ margin: 0 }}>
          Hand your recent practice to an AI agent through a shared folder. SpeechImprover writes a
          <b> cowork.json</b> manifest plus two channel requests — <b>coach</b> (feedback) and <b>program</b>
          {' '}(a targeted daily plan). <a href="https://github.com/adervec/CoworkSyncHub" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>CoworkSyncHub</a> runs
          Claude on them and writes replies back, which you import here. Everything stays on your device.
        </p>
      </div>

      {!canRun && (
        <div className="card tight" style={{ borderColor: 'var(--warn)' }}>
          <span className="small">Record a session or two first — there's nothing to coach yet.</span>
        </div>
      )}

      {FS_SUPPORTED ? (
        <div className="card">
          <div className="card-head"><h3>1 · Folder</h3>{dir && <span className="badge good">connected</span>}</div>
          {dir ? (
            <div className="row spread wrap" style={{ gap: 10 }}>
              <span className="small">📁 <b>{dir.name}</b>{st.lastPush && <span className="tiny muted"> · last push {formatDateTime(st.lastPush)}</span>}</span>
              <div className="row">
                <button className="btn ghost sm" onClick={chooseFolder}>Change</button>
                <button className="btn ghost sm danger" onClick={disconnect}>Disconnect</button>
              </div>
            </div>
          ) : (
            <div className="row wrap" style={{ gap: 10 }}>
              <button className="btn primary" onClick={chooseFolder}>Choose cowork folder…</button>
              <span className="small muted">Pick (or make) a folder the hub watches. Its handle is remembered on this device.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="card tight" style={{ borderColor: 'var(--warn)' }}>
          <span className="small">This browser can't write folders directly. Use the manual flow below (download a request, run the agent, paste its reply). For the full folder handshake, use Chrome or Edge on desktop.</span>
        </div>
      )}

      {FS_SUPPORTED && dir && (
        <div className="grid cols-2">
          <div className="card">
            <div className="card-head"><h3>2 · Push requests</h3></div>
            <p className="tiny muted" style={{ marginTop: 0 }}>
              Writes <span className="mono">cowork.json</span>, <span className="mono">coach/</span> and <span className="mono">program/</span> with your latest {dataset.totals?.sessions ?? 0} sessions of context.
            </p>
            <button className="btn primary block" disabled={busy || !canRun} onClick={pushRequests}>⬆ Write coach + program requests</button>
          </div>
          <div className="card">
            <div className="card-head"><h3>3 · Import replies</h3></div>
            <p className="tiny muted" style={{ marginTop: 0 }}>
              Reads <span className="mono">coach/reply.json</span> and <span className="mono">program/reply.json</span> back. A program reply starts a daily program.
            </p>
            <button className="btn block" disabled={busy} onClick={importReplies}>⬇ Import replies</button>
          </div>
        </div>
      )}

      {msg && <div className="card tight"><span className="small">{msg}</span></div>}

      {st.coach && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="card-head">
            <h3>🧠 Coach feedback</h3>
            <span className="tiny muted">{st.coach.at ? formatDateTime(st.coach.at) : ''}{st.coach.stale ? ' · from an earlier request' : ''}</span>
          </div>
          {st.coach.analysis && <p className="small" style={{ marginTop: 0 }}>{st.coach.analysis}</p>}
          {st.coach.focusAreas?.length > 0 && (
            <div className="stack" style={{ gap: 8, marginBottom: 8 }}>
              {st.coach.focusAreas.map((f, i) => (
                <div key={i} className="card tight" style={{ background: 'var(--bg-2)' }}>
                  <b className="small">{f.attribute}</b>
                  {f.why && <div className="tiny muted">{f.why}</div>}
                  {f.drill && <div className="tiny" style={{ marginTop: 2 }}>🎯 {f.drill}</div>}
                </div>
              ))}
            </div>
          )}
          {st.coach.tips?.length > 0 && (
            <ul className="small" style={{ margin: '4px 0', paddingLeft: 18 }}>
              {st.coach.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
          {st.coach.encouragement && <p className="small" style={{ color: 'var(--good)', marginBottom: 0 }}>{st.coach.encouragement}</p>}
        </div>
      )}

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Manual flow (no folder access)</summary>
        <p className="tiny muted">Download a request, hand it to any agent, then paste the reply JSON back.</p>
        <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
          <button className="btn ghost sm" disabled={!canRun} onClick={() => downloadRequest('coach')}>⬇ coach request</button>
          <button className="btn ghost sm" disabled={!canRun} onClick={() => downloadRequest('program')}>⬇ program request</button>
        </div>
        <div className="pill-group" style={{ marginBottom: 8 }}>
          {['coach', 'program'].map((c) => (
            <button key={c} className={`pill ${pasteChannel === c ? 'active' : ''}`} onClick={() => setPasteChannel(c)}>{c} reply</button>
          ))}
        </div>
        <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={`Paste the ${pasteChannel} reply JSON here…`} rows={5} />
        <button className="btn sm" style={{ marginTop: 8 }} disabled={!pasted.trim()} onClick={importPasted}>Import pasted {pasteChannel} reply</button>
      </details>
    </div>
  );
}
