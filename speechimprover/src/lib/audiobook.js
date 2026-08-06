// Export a project's recordings as an audiobook: a curated TRACKLIST (which may or
// may not map 1:1 to the raw recordings) rendered to per-track WAVs and bundled in a
// ZIP with a .cue sheet, a human chapters.txt, and an .m3u playlist.
//
// This module is import-clean (no Web Audio at module top) so its packaging logic is
// node-testable — the async codecs (decodeBlob/encodeWav/resampleLinear/getAudioBlob)
// are INJECTED by the caller. See demo() for the runnable self-check.
//
// Track model (stored on project.tracks): [{ id, title, segments: [{ sessionId, startSec?, endSec? }] }]
//   - a segment with no startSec/endSec is the whole take; the waveform editor sets them later.
//   - null/absent project.tracks  → one track per recording, in reading (chronological) order.

// ---------- track model ----------
export function orderedProjectSessions(project, sessions) {
  // Reading order = oldest first (chapter 1 was recorded first).
  return sessions
    .filter((s) => s.projectId === project.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

function sessionTitle(s, i) {
  return s.alias || s.exerciseTitle || (s.mode ? `${s.mode} recording` : `Track ${i + 1}`);
}

export function defaultTracks(sessions) {
  return sessions.map((s, i) => ({
    id: `t-${s.id}`,
    title: sessionTitle(s, i),
    segments: [{ sessionId: s.id }],
  }));
}

// Keep an existing tracklist valid against the current recordings: drop segments whose
// recording was deleted (and now-empty tracks), then append tracks for any new recordings.
export function reconcileTracks(tracks, orderedSessions) {
  if (!tracks) return defaultTracks(orderedSessions);
  const valid = new Set(orderedSessions.map((s) => s.id));
  const kept = tracks
    .map((t) => ({ ...t, segments: t.segments.filter((seg) => valid.has(seg.sessionId)) }))
    .filter((t) => t.segments.length);
  const referenced = new Set(kept.flatMap((t) => t.segments.map((seg) => seg.sessionId)));
  const missing = orderedSessions.filter((s) => !referenced.has(s.id));
  return [...kept, ...defaultTracks(missing)];
}

// ---------- text sidecars ----------
function pad2(n) { return String(n).padStart(2, '0'); }

export function secToStamp(sec) {
  const t = Math.max(0, Math.round(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}:${pad2(m)}:${pad2(s)}`;
}

function slug(title) {
  return (String(title || 'track').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)) || 'track';
}

function cueEsc(s) { return String(s || '').replace(/"/g, "'"); }

export function buildCue(albumTitle, cueTracks) {
  const lines = ['REM audiobook exported by SpeechImprover', `TITLE "${cueEsc(albumTitle)}"`];
  for (const t of cueTracks) {
    lines.push(`FILE "${t.file}" WAVE`);
    lines.push(`  TRACK ${pad2(t.index)} AUDIO`);
    lines.push(`    TITLE "${cueEsc(t.title)}"`);
    lines.push('    INDEX 01 00:00:00'); // each track is its own file → starts at 0
  }
  return lines.join('\n') + '\n';
}

export function buildChaptersTxt(cueTracks) {
  // Cumulative timeline, as if the tracks were played back to back.
  return cueTracks.map((t) => `${secToStamp(t.startSec)}  ${t.title}`).join('\n') + '\n';
}

export function buildM3u(cueTracks) {
  const lines = ['#EXTM3U'];
  for (const t of cueTracks) {
    lines.push(`#EXTINF:${Math.round(t.durationSec)},${t.title}`);
    lines.push(t.file);
  }
  return lines.join('\n') + '\n';
}

// ---------- store-only ZIP (no dependency; WAV/PCM barely deflates anyway) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let crc = ~0;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (~crc) >>> 0;
}

function concatBytes(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

// files: [{ name: ASCII string, bytes: Uint8Array }] → Uint8Array (a valid .zip).
export function zipStore(files) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.bytes);
    const size = f.bytes.length;
    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true);      // store
    lv.setUint16(12, 0x0021, true); // 1980-01-01
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lh.set(nameBytes, 30);
    locals.push(lh, f.bytes);

    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(14, 0x0021, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);
    centrals.push(ch);
    offset += lh.length + size;
  }
  const cd = concatBytes(centrals);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cd.length, true);
  ev.setUint32(16, offset, true);
  return concatBytes([...locals, cd, eocd]);
}

// ---------- audio render (injected codecs) ----------
function toMono(audioBuffer) {
  const ch = audioBuffer.numberOfChannels;
  const len = audioBuffer.length;
  const out = new Float32Array(len);
  for (let c = 0; c < ch; c += 1) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < len; i += 1) out[i] += data[i] / ch;
  }
  return out;
}

// Render one track = decode each segment, apply its [startSec,endSec] trim, resample to a
// common rate, concatenate. deps: { getAudioBlob, decodeBlob, resampleLinear, targetSr }.
export async function renderTrackSamples(track, sessionsById, deps) {
  const { getAudioBlob, decodeBlob, resampleLinear, targetSr } = deps;
  const parts = [];
  for (const seg of track.segments) {
    const s = sessionsById[seg.sessionId];
    if (!s?.audioId) continue;
    const blob = await getAudioBlob(s.audioId);
    if (!blob) continue;
    const buf = await decodeBlob(blob);
    const sr = buf.sampleRate;
    let mono = toMono(buf);
    let a = seg.startSec != null ? Math.floor(seg.startSec * sr) : 0;
    let b = seg.endSec != null ? Math.floor(seg.endSec * sr) : mono.length;
    a = Math.max(0, Math.min(a, mono.length));
    b = Math.max(a, Math.min(b, mono.length));
    if (b > a) parts.push(resampleLinear(mono.subarray(a, b), sr, targetSr));
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Full export. deps also needs encodeWav. onProgress({ i, total, title }) is optional.
export async function exportProjectAudiobook(project, sessions, deps, onProgress) {
  const { encodeWav, targetSr = 22050 } = deps;
  const ordered = orderedProjectSessions(project, sessions);
  const tracks = reconcileTracks(project.tracks, ordered).filter((t) => t.segments.length);
  if (!tracks.length) throw new Error('This project has no recordings to export.');
  const sessionsById = Object.fromEntries(sessions.map((s) => [s.id, s]));

  const files = [];
  const cueTracks = [];
  let acc = 0;
  for (let i = 0; i < tracks.length; i += 1) {
    const t = tracks[i];
    onProgress?.({ i, total: tracks.length, title: t.title });
    const samples = await renderTrackSamples(t, sessionsById, { ...deps, targetSr });
    const durationSec = samples.length / targetSr;
    const wav = encodeWav(samples, targetSr);
    const bytes = new Uint8Array(await wav.arrayBuffer());
    const file = `${pad2(i + 1)}-${slug(t.title)}.wav`;
    files.push({ name: file, bytes });
    cueTracks.push({ index: i + 1, title: t.title, file, startSec: acc, durationSec });
    acc += durationSec;
  }

  const enc = new TextEncoder();
  files.push({ name: 'chapters.cue', bytes: enc.encode(buildCue(project.name, cueTracks)) });
  files.push({ name: 'chapters.txt', bytes: enc.encode(buildChaptersTxt(cueTracks)) });
  files.push({ name: 'playlist.m3u', bytes: enc.encode(buildM3u(cueTracks)) });

  const zip = zipStore(files);
  return {
    blob: new Blob([zip], { type: 'application/zip' }),
    filename: `${slug(project.name)}-audiobook.zip`,
    trackCount: tracks.length,
    totalSec: acc,
  };
}

// ---------- self-check ----------
export function demo() {
  const enc = new TextEncoder();
  console.assert(crc32(enc.encode('123456789')) === 0xcbf43926, 'crc32 known vector');
  const zip = zipStore([{ name: 'a.txt', bytes: enc.encode('hi') }]);
  console.assert(zip[0] === 0x50 && zip[1] === 0x4b && zip[2] === 0x03 && zip[3] === 0x04, 'zip local-header sig PK\\3\\4');
  const tail = zip.slice(zip.length - 22);
  console.assert(tail[0] === 0x50 && tail[1] === 0x4b && tail[2] === 0x05 && tail[3] === 0x06, 'zip EOCD sig PK\\5\\6');
  const dt = defaultTracks([{ id: 's1', alias: 'Intro' }, { id: 's2' }]);
  console.assert(dt.length === 2 && dt[0].segments[0].sessionId === 's1' && dt[0].title === 'Intro', 'one track per recording, aliased title');
  const rec = reconcileTracks(dt, [{ id: 's2', createdAt: '2020' }, { id: 's3', createdAt: '2021' }]);
  console.assert(rec.length === 2 && rec.some((t) => t.segments[0].sessionId === 's3'), 'drops deleted s1, appends new s3');
  console.assert(secToStamp(3661) === '1:01:01', 'HH:MM:SS');
  return zip;
}
