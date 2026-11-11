// Cowork Sync — hand recent practice to an AI agent through a shared folder, with
// the maker's shared engine (cowork v2, fs mode — see lib/coworkEngine.jsx): named
// channels (coach, program), a schedule per channel on the one sync device,
// review before applying (on by default, per channel), run history with undo.
// A manual download / paste flow remains for browsers without folder access.

import { useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { useToast } from '../components/ui.jsx';
import { formatDateTime } from '../lib/format.js';
import {
  buildCoworkDataset, buildRequestFiles, parseReply, coachRecord, programStepsFromAccepted,
} from '../lib/cowork.js';
import { useCoworkPanel, applyCoachRecord } from '../lib/coworkEngine.jsx';

export default function Cowork({ navigate }) {
  const { sessions, profile, startProgram } = useStore();
  const toast = useToast();
  const hostRef = useRef(null);
  const [ready, coach] = useCoworkPanel(hostRef);
  const [pasteChannel, setPasteChannel] = useState('coach');
  const [pasted, setPasted] = useState('');
  const [msg, setMsg] = useState('');
  const dataset = useMemo(() => buildCoworkDataset(sessions, profile), [sessions, profile]);
  const canRun = sessions.length > 0;

  function downloadRequest(channel) {
    const f = buildRequestFiles(dataset).find((x) => x.path === `${channel}/request.json`);
    const url = URL.createObjectURL(new Blob([f.text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `speechimprover-${channel}-request.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // Pasting a reply by hand IS the review step — the speaker chose to apply it.
  function importPasted() {
    setMsg('');
    let reply;
    try { reply = parseReply(pasted); } catch { setMsg('That is not valid JSON.'); return; }
    if (pasteChannel === 'coach') {
      applyCoachRecord(coachRecord(reply));
      toast('Coach feedback imported.', { type: 'success' });
    } else {
      const steps = programStepsFromAccepted(reply, null);
      if (!steps.length) { setMsg('The program reply had no exercise ids I recognise.'); return; }
      startProgram(steps, (dataset.focusAreas || []).map((f) => f.attribute));
      toast(`Imported a ${steps.length}-step program.`, { type: 'success' });
      setTimeout(() => navigate('exercises'), 400);
    }
    setPasted('');
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head"><h3>🤝 Cowork Sync</h3><span className="tiny muted">CoworkSyncHub · cowork v2</span></div>
        <p className="muted small" style={{ margin: 0 }}>
          Hand your recent practice to an AI agent through a shared folder. SpeechImprover writes a
          <b> cowork.json</b> manifest plus two channels — <b>coach</b> (feedback) and <b>program</b> (a targeted
          daily plan). <a href="https://github.com/adervec/CoworkSyncHub" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>CoworkSyncHub</a> (or
          any agent pointed at the folder) writes replies back. <b>Every reply waits for your review</b> before it
          changes anything — untick “review first” on a channel to apply its replies automatically. Applied replies
          can be undone from the run history. Everything stays on your device.
        </p>
      </div>

      {!canRun && (
        <div className="card tight" style={{ borderColor: 'var(--warn)' }}>
          <span className="small">Record a take or two first — there's nothing to coach yet.</span>
        </div>
      )}

      <div ref={hostRef} />
      {!ready && (
        <div className="card tight" style={{ borderColor: 'var(--warn)' }}>
          <span className="small">
            The shared cowork panel couldn't load (it comes from adervec.github.io — are you offline?). Use the
            manual flow below for now.
          </span>
        </div>
      )}

      {coach && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="card-head">
            <h3>🧠 Coach feedback</h3>
            <span className="tiny muted">{coach.at ? formatDateTime(coach.at) : ''}</span>
          </div>
          {coach.analysis && <p className="small" style={{ marginTop: 0 }}>{coach.analysis}</p>}
          {coach.focusAreas?.length > 0 && (
            <div className="stack" style={{ gap: 8, marginBottom: 8 }}>
              {coach.focusAreas.map((f, i) => (
                <div key={i} className="card tight" style={{ background: 'var(--bg-2)' }}>
                  <b className="small">{f.attribute}</b>
                  {f.why && <div className="tiny muted">{f.why}</div>}
                  {f.drill && <div className="tiny" style={{ marginTop: 2 }}>🎯 {f.drill}</div>}
                </div>
              ))}
            </div>
          )}
          {coach.tips?.length > 0 && (
            <ul className="small" style={{ margin: '4px 0', paddingLeft: 18 }}>
              {coach.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
          {coach.encouragement && <p className="small" style={{ color: 'var(--good)', marginBottom: 0 }}>{coach.encouragement}</p>}
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
        {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}
      </details>
    </div>
  );
}
