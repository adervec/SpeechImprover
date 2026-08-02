// AI / co-work integration hub. For now this is the single place a machine-
// readable progress summary is produced, so a daily-report task or AI coach has
// one thing to read. Copy it, download it, or paste it into your assistant.
// ponytail: no live endpoint yet — the "link" is copy/download. Wire a real
// push (Drive/webhook/API) here when an actual daily task exists to receive it.

import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { useToast } from '../components/ui.jsx';
import { buildProgressSummary } from '../lib/progressSummary.js';

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function Coach() {
  const { sessions, profile } = useStore();
  const toast = useToast();
  const [format, setFormat] = useState('text'); // text | json
  // Recompute when sessions/profile change; `new Date()` is fine here (render-time only).
  const summary = useMemo(() => buildProgressSummary(sessions, profile), [sessions, profile]);

  const payload = format === 'json' ? JSON.stringify(summary.json, null, 2) : summary.text;

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      toast('Progress summary copied.');
    } catch {
      toast('Copy failed — select the text and copy manually.');
    }
  }

  return (
    <div className="stack">
      <div className="card" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, var(--surface)), var(--surface))' }}>
        <div className="tag">AI &amp; co-work</div>
        <h2 style={{ margin: '2px 0 6px' }}>Feed your progress to an AI coach</h2>
        <p className="muted small">
          A compact, machine-readable summary of your practice — sessions, streak, recent scores and focus
          areas. Point a daily-report task or assistant at it: copy it in, download it on a schedule, or paste
          it into a chat for analysis. Everything is generated locally from your own data.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Progress summary</h3>
          <div className="pill-group">
            <button className={`pill ${format === 'text' ? 'active' : ''}`} onClick={() => setFormat('text')}>Markdown</button>
            <button className={`pill ${format === 'json' ? 'active' : ''}`} onClick={() => setFormat('json')}>JSON</button>
          </div>
        </div>
        {sessions.length === 0 ? (
          <p className="muted small">Record a session first — there's nothing to summarize yet.</p>
        ) : (
          <>
            <pre className="prompt-box" style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto', fontFamily: 'var(--mono, ui-monospace, monospace)' }}>{payload}</pre>
            <div className="row wrap" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={copy}>⧉ Copy</button>
              <button className="btn" onClick={() => (format === 'json'
                ? download(`speechimprover-progress-${summary.generatedAt.slice(0, 10)}.json`, JSON.stringify(summary.json, null, 2), 'application/json')
                : download(`speechimprover-progress-${summary.generatedAt.slice(0, 10)}.md`, summary.text, 'text/markdown'))}>
                ⬇ Download {format === 'json' ? '.json' : '.md'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h3>Wiring a daily report</h3></div>
        <p className="small muted">
          There's no server here, so there's no live endpoint to push to yet. Today the integration is
          pull-based: on a schedule, have your task read the downloaded summary (or the copied JSON) and analyze
          it — e.g. “compare today's focus areas to last week and suggest one drill.” When a real receiving task
          exists, this screen is where an automatic push (a synced file, webhook or API) gets wired in.
        </p>
      </div>
    </div>
  );
}
