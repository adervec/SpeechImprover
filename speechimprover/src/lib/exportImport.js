// Data import / export. Exports profile + settings + all sessions to a JSON
// file. Audio blobs are optionally included as base64 (they are bulky).

import { getAllSessions, putSession, getAudio, putAudio } from './db.js';

const EXPORT_VERSION = 1;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, mime) {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime || 'audio/webm' });
}

export async function exportData({ includeAudio = false, profile, settings } = {}) {
  const sessions = await getAllSessions();
  const out = {
    app: 'speechimprover',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    profile: profile || null,
    settings: settings || null,
    sessions,
    audio: [],
  };

  if (includeAudio) {
    for (const s of sessions) {
      if (s.audioId) {
        const rec = await getAudio(s.audioId);
        if (rec?.blob) {
          out.audio.push({
            id: s.audioId,
            mime: rec.mime,
            data: await blobToBase64(rec.blob),
          });
        }
      }
    }
  }
  return out;
}

export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Returns { importedSessions, importedAudio, profile, settings }.
export async function importData(json) {
  if (!json || json.app !== 'speechimprover' || !Array.isArray(json.sessions)) {
    throw new Error('Not a valid SpeechImprover export file.');
  }
  const existing = await getAllSessions();
  const existingIds = new Set(existing.map((s) => s.id));

  // Restore audio first so session.audioId references resolve.
  let importedAudio = 0;
  if (Array.isArray(json.audio)) {
    for (const a of json.audio) {
      if (a?.id && a.data) {
        await putAudio(a.id, base64ToBlob(a.data, a.mime), a.mime);
        importedAudio += 1;
      }
    }
  }

  let importedSessions = 0;
  for (const s of json.sessions) {
    if (!s?.id || existingIds.has(s.id)) continue;
    // If audio wasn't included in the export, drop the dangling reference.
    const hasAudio = Array.isArray(json.audio) && json.audio.some((a) => a.id === s.audioId);
    await putSession({ ...s, audioId: hasAudio ? s.audioId : null });
    importedSessions += 1;
  }

  return {
    importedSessions,
    importedAudio,
    profile: json.profile || null,
    settings: json.settings || null,
  };
}
