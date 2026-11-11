// CoworkSyncHub integration (house "cowork" protocol, manifest v1).
//
// SpeechImprover writes a `cowork.json` manifest + per-channel request/instructions
// into a user-picked local folder; an AI agent (CoworkSyncHub running Claude Code
// headless, or Claude Desktop pointed at the folder) writes JSON replies back, which
// the app imports. Two channels:
//   - coach   → structured coaching read on recent practice (shown in the app)
//   - program → a runnable daily practice program targeting the speaker's weaknesses
//
// Pure + node-testable (see demo()). The shared engine (lib/coworkEngine.jsx) does folder I/O; UI in views/Cowork.jsx.
// Reply parsing is tolerant (bare JSON or an envelope with a `payload`) — see COWORK-PROTOCOL.md.

import { buildProgressSummary } from './progressSummary.js';
import { attributeAverages } from './aggregate.js';
import { EXERCISES, getExercise } from './exercises.js';

// djb2 (hex) — identical to the hash the rest of the cowork ecosystem declares so
// agents can echo requestHash back verbatim (CoworkSyncHub idempotency/correlation).
export function contentHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// Compact snapshot of the speaker's recent practice, attached to every request.
export function buildCoworkDataset(sessions, profile) {
  const summary = buildProgressSummary(sessions, profile);
  const scored = sessions.filter((s) => s.overall != null);
  const recentSessions = scored.slice(0, 10).map((s) => ({
    at: s.createdAt,
    exercise: s.exerciseTitle || s.mode || '—',
    mode: s.mode,
    overall: s.overall ?? null,
    alignment: s.distances?.alignment ?? null,
    targetAttributes: s.targetAttributes || [],
    transcriptExcerpt: (s.transcript || '').slice(0, 240),
    notes: s.notes || '',
  }));
  return { ...summary.json, attributeAverages: attributeAverages(scored.slice(0, 8)), recentSessions };
}

// The exercise catalog the program agent may choose from (only these ids are valid).
export function availableExercises() {
  return EXERCISES.map((e) => ({ id: e.id, title: e.title, category: e.category, targetAttributes: e.targetAttributes || [] }));
}

export function buildManifest() {
  return {
    protocol: 'cowork-manifest',
    protocolVersion: 1,
    app: 'speechimprover',
    channels: [
      { name: 'coach', request: ['coach/request.json'], instructions: 'coach/INSTRUCTIONS.md', replyPath: 'coach/reply.json' },
      { name: 'program', request: ['program/request.json'], instructions: 'program/INSTRUCTIONS.md', replyPath: 'program/reply.json' },
    ],
  };
}

function envelope(protocol, kind, payload) {
  return { protocol, protocolVersion: 1, kind, generatedAt: new Date().toISOString(), requestHash: contentHash(JSON.stringify(payload)), payload };
}
export function buildCoachRequest(dataset) {
  return envelope('speechimprover-coach', 'coach-request', dataset);
}
export function buildProgramRequest(dataset) {
  return envelope('speechimprover-program', 'program-request', { ...dataset, availableExercises: availableExercises() });
}

export const COACH_INSTRUCTIONS = `# SpeechImprover — Coach channel

You are an encouraging, specific speech coach. Read \`coach/request.json\` (a
\`speechimprover-coach\` request envelope; the speaker's data is in \`payload\`).
Base everything on \`payload.recentSessions\`, \`payload.focusAreas\`,
\`payload.attributeAverages\` and the trend — do not invent scores.

Write your reply to \`coach/reply.json\` as JSON:

\`\`\`json
{
  "requestHash": "<copy the request's requestHash verbatim>",
  "analysis": "2-4 plain-language sentences on how they're doing and the trend",
  "focusAreas": [
    { "attribute": "Expressiveness", "why": "flat pitch in recent free takes", "drill": "one concrete thing to practise" }
  ],
  "tips": ["short actionable tip", "..."],
  "encouragement": "one warm, honest line"
}
\`\`\`

Keep it under ~200 words total. Scores are 0-100.

If you cannot do this (missing or unreadable data), write \`coach/reply-error.json\`
instead: \`{ "requestHash": "<copy verbatim>", "reason": "one line on why" }\`.
The speaker reviews every reply before it changes anything in the app.
`;

export const PROGRAM_INSTRUCTIONS = `# SpeechImprover — Program channel

Build a short daily practice program targeting this speaker's weaknesses. Read
\`program/request.json\`; the speaker's data is in \`payload\`, and
\`payload.availableExercises\` is the ONLY set of exercises you may use (pick by \`id\`).

Choose 3-6 exercises ordered as a sensible session: an optional warm-up first, then
drills on the weakest attributes in \`payload.focusAreas\`, then an applied/free piece.
Prefer exercises whose \`targetAttributes\` overlap the focus areas.

Write your reply to \`program/reply.json\`:

\`\`\`json
{
  "requestHash": "<copy verbatim>",
  "title": "e.g. Expressiveness & pace — Tuesday",
  "exercises": ["<id from availableExercises>", "..."],
  "note": "one line on why this program"
}
\`\`\`

Use only ids that appear in \`payload.availableExercises\`. Return 3-6 ids.

If you cannot do this, write \`program/reply-error.json\` instead:
\`{ "requestHash": "<copy verbatim>", "reason": "one line on why" }\`.
The speaker reviews the program (and can untick exercises) before it starts.
`;

// The exact files the app drops into the folder for one push.
export function buildRequestFiles(dataset) {
  return [
    { path: 'cowork.json', text: JSON.stringify(buildManifest(), null, 2) },
    { path: 'coach/INSTRUCTIONS.md', text: COACH_INSTRUCTIONS },
    { path: 'coach/request.json', text: JSON.stringify(buildCoachRequest(dataset), null, 2) },
    { path: 'program/INSTRUCTIONS.md', text: PROGRAM_INSTRUCTIONS },
    { path: 'program/request.json', text: JSON.stringify(buildProgramRequest(dataset), null, 2) },
  ];
}

// Tolerant: accept a bare reply object or an envelope wrapping it in `payload`.
export function parseReply(text) {
  const obj = JSON.parse(text);
  if (obj && typeof obj === 'object' && obj.payload && obj.analysis == null && obj.exercises == null) return obj.payload;
  return obj;
}

// Map a program reply's exercise ids to runnable exercises, dropping any unknown ids.
export function programStepsFromReply(reply) {
  const ids = Array.isArray(reply?.exercises) ? reply.exercises : [];
  return ids.map((id) => getExercise(id)).filter(Boolean);
}

// ---- review rows + apply data for the shared engine (cowork v2, house standard 3) ----
// Review-first is on by default per channel: the panel lists these rows, the speaker
// ticks what to accept, and apply() returns undo data the run history can reverse.

// Coach: one row — show this feedback (replacing the current one).
export function coachPreview(reply) {
  const r = parseReplyObject(reply);
  const focus = (r.focusAreas || []).map((f) => f.attribute).filter(Boolean);
  return [{
    id: 'coach',
    label: 'Show this coach feedback in SpeechImprover (replaces the current one)',
    detail: [r.analysis, focus.length ? `Focus: ${focus.join(', ')}` : ''].filter(Boolean).join(' · ').slice(0, 400),
  }];
}
export function coachRecord(reply) {
  const r = parseReplyObject(reply);
  return {
    analysis: r.analysis || '',
    focusAreas: Array.isArray(r.focusAreas) ? r.focusAreas : [],
    tips: Array.isArray(r.tips) ? r.tips : [],
    encouragement: r.encouragement || '',
    at: new Date().toISOString(),
  };
}

// Program: one row per recognised exercise, so the speaker can drop any of them.
export function programPreview(reply) {
  const r = parseReplyObject(reply);
  return programStepsFromReply(r).map((ex, i) => ({
    id: ex.id,
    label: `${i + 1}. ${ex.title}`,
    detail: [ex.category, (ex.targetAttributes || []).join(', ')].filter(Boolean).join(' · ') + (i === 0 && r.note ? ` — ${r.note}` : ''),
  }));
}
// Accepted ids, in the reply's order, as runnable exercises.
export function programStepsFromAccepted(reply, acceptedIds) {
  const keep = acceptedIds ? new Set(acceptedIds) : null;
  return programStepsFromReply(parseReplyObject(reply)).filter((ex) => !keep || keep.has(ex.id));
}

// The engine hands over parsed JSON; the manual paste flow hands over text.
function parseReplyObject(reply) {
  return typeof reply === 'string' ? parseReply(reply) : (reply?.payload && reply.analysis == null && reply.exercises == null ? reply.payload : reply || {});
}

// ---- persisted cowork UI state (localStorage) ----
const KEY = 'si.cowork';
const DEFAULT = { dirName: '', lastPush: null, coachHash: null, programHash: null, coach: null };
export function loadCoworkState() {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT }; }
  catch { return { ...DEFAULT }; }
}
export function saveCoworkState(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* quota / private mode */ }
}

// ---- self-check ----
export function demo() {
  const sessions = [{ id: '1', createdAt: '2026-07-12T10:00:00Z', overall: 70, mode: 'free', exerciseTitle: 'Free', distances: { alignment: 60 }, scores: { pace: 80, expressiveness: 40 }, transcript: 'hello world', targetAttributes: ['expressiveness'] }];
  const ds = buildCoworkDataset(sessions, { name: 'Ada' });
  console.assert(ds.app === 'SpeechImprover', 'dataset app');
  console.assert(ds.recentSessions.length === 1 && ds.recentSessions[0].overall === 70, 'recent sessions');
  const req = buildCoachRequest(ds);
  console.assert(req.protocol === 'speechimprover-coach' && req.requestHash === contentHash(JSON.stringify(ds)), 'coach hash echoes payload');
  const files = buildRequestFiles(ds);
  console.assert(files.some((f) => f.path === 'cowork.json') && files.length === 5, 'five request files incl. manifest');
  const man = JSON.parse(files[0].text);
  console.assert(man.protocol === 'cowork-manifest' && man.channels.length === 2, 'manifest shape');
  console.assert(parseReply(JSON.stringify({ protocol: 'x', payload: { analysis: 'good' } })).analysis === 'good', 'envelope unwrapped');
  console.assert(parseReply(JSON.stringify({ analysis: 'bare' })).analysis === 'bare', 'bare reply kept');
  const steps = programStepsFromReply({ exercises: ['baseline-read', 'nope-xyz'] });
  console.assert(steps.length === 1 && steps[0].id === 'baseline-read', 'program keeps only valid ids');
  // v2 review rows (thrown, not console.assert, so npm test catches them)
  const ok = (c, m) => { if (!c) throw new Error(`cowork: ${m}`); };
  const ids = EXERCISES.slice(0, 3).map((e) => e.id);
  const prog = { requestHash: 'x', exercises: [...ids, 'nope-xyz'], note: 'why' };
  const rows = programPreview(prog);
  ok(rows.length === 3 && rows.every((r, i) => r.id === ids[i]), 'one review row per known exercise, unknown dropped');
  ok(programStepsFromAccepted(prog, [ids[2], ids[0]]).map((e) => e.id).join() === [ids[0], ids[2]].join(), 'only ticked rows, in reply order');
  ok(programStepsFromAccepted(prog, null).length === 3, 'review off → everything');
  ok(coachPreview({ analysis: 'Good pace', focusAreas: [{ attribute: 'Expressiveness' }] })[0].detail.includes('Expressiveness'), 'coach row shows focus');
  ok(coachRecord({ payload: { analysis: 'wrapped' } }).analysis === 'wrapped', 'envelope reply unwrapped');
  return ds;
}
