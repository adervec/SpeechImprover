import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import SessionReport from '../components/SessionReport.jsx';
import { EmptyState, useToast } from '../components/ui.jsx';
import { formatDateTime } from '../lib/format.js';

export default function SessionDetail({ route, navigate }) {
  const { sessions, getAudioBlob, updateSession, purgeAudio, removeSession } = useStore();
  const toast = useToast();
  const session = sessions.find((s) => s.id === route.param);
  const [audioUrl, setAudioUrl] = useState(null);
  const [notes, setNotes] = useState(session?.notes || '');

  const audioId = session?.audioId;
  useEffect(() => {
    let url = null;
    let active = true;
    (async () => {
      if (!audioId) return;
      const blob = await getAudioBlob(audioId);
      if (blob && active) {
        url = URL.createObjectURL(blob);
        setAudioUrl(url);
      }
    })();
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [audioId, getAudioBlob]);

  if (!session) {
    return <EmptyState icon="🔎" title="Session not found" action={<button className="btn" onClick={() => navigate('history')}>Back to history</button>} />;
  }

  return (
    <div className="stack">
      <div className="row spread wrap">
        <div>
          <div className="tag">{formatDateTime(session.createdAt)}{session.seed && ' · sample data'}</div>
          <h1>{session.exerciseTitle || session.mode}</h1>
        </div>
        <div className="row wrap">
          <button className="btn ghost sm" onClick={() => navigate('history')}>← History</button>
          {session.exerciseId && <button className="btn sm" onClick={() => navigate('practice', { query: { exercise: session.exerciseId } })}>Repeat exercise</button>}
          <button className="btn sm" onClick={() => navigate('compare', { query: { a: session.id } })}>Compare ⇄</button>
          {session.audioId && <button className="btn sm" onClick={() => { purgeAudio(session.id); toast('Audio purged.'); }}>Purge audio</button>}
          <button className="btn sm danger" onClick={() => { removeSession(session.id); navigate('history'); }}>Delete</button>
        </div>
      </div>

      {session.prompt && (
        <div className="card tight">
          <div className="tag" style={{ marginBottom: 6 }}>Prompt</div>
          <p className="small">{session.prompt}</p>
        </div>
      )}

      <SessionReport session={session} audioUrl={audioUrl} focusAttrs={session.targetAttributes} />

      <div className="card">
        <div className="card-head"><h3>Notes</h3>
          <button className="btn sm" onClick={() => { updateSession(session.id, { notes }); toast('Notes saved.'); }}>Save</button>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note about this session…" />
      </div>
    </div>
  );
}
