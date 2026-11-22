// The merge behind cloud sync (house standard 30), kept apart from the React glue so
// `npm test` can run the two-device check below.
//   sessions : record by record, the most recent change (updatedAt) wins; a record with no
//              updatedAt counts as old. Audio stays on its device, so audio fields never sync.
//   deletes  : deleted ids are kept (tombstones) and unioned, so a stale device cannot bring
//              a deleted take back.
//   profile, settings : each one record, the newer stamp wins.

const DEVICE_ONLY = ['audioId', 'audioBytes', 'audioMime'];
export const forSync = (s) => {
  const out = { ...s };
  for (const k of DEVICE_ONLY) delete out[k];
  return out;
};
const stamp = (r) => Number(r.updatedAt) || 0;

function mergeSessions(a, b) {
  const byId = new Map();
  for (const r of [...b, ...a]) {
    const o = byId.get(r.id);
    // equal stamps: settle by content so every device picks the same copy
    if (!o || stamp(r) > stamp(o) || (stamp(r) === stamp(o) && JSON.stringify(r) > JSON.stringify(o))) byId.set(r.id, r);
  }
  return [...byId.values()];
}

export function mergeDocs(local, remote) {
  if (!remote) return local;
  const deleted = [...new Set([...(remote.deletedSessionIds || []), ...(local.deletedSessionIds || [])])].sort();
  const gone = new Set(deleted);
  const sessions = mergeSessions((local.sessions || []).map(forSync), (remote.sessions || []).map(forSync))
    .filter((s) => !gone.has(s.id))
    .sort((x, y) => (x.createdAt < y.createdAt ? 1 : x.createdAt > y.createdAt ? -1 : x.id < y.id ? 1 : -1));
  const lp = (local.profileUpdatedAt || 0) >= (remote.profileUpdatedAt || 0);
  const ls = (local.settingsUpdatedAt || 0) >= (remote.settingsUpdatedAt || 0);
  return {
    app: 'speechimprover', kind: 'sync', version: 2,
    sessions,
    deletedSessionIds: deleted,
    profile: lp ? local.profile : remote.profile,
    profileUpdatedAt: Math.max(local.profileUpdatedAt || 0, remote.profileUpdatedAt || 0),
    settings: ls ? local.settings : remote.settings,
    settingsUpdatedAt: Math.max(local.settingsUpdatedAt || 0, remote.settingsUpdatedAt || 0),
  };
}

// Two devices against one pretend cloud: both edits survive, a deletion stays deleted.
export function demo() {
  const ok = (c, m) => { if (!c) throw new Error(`syncMerge: ${m}`); };
  const base = { sessions: [{ id: '1', createdAt: '2026-01-01', overall: 50 }, { id: '2', createdAt: '2026-01-02' }], deletedSessionIds: [], profile: { name: 'P' }, profileUpdatedAt: 1, settings: {}, settingsUpdatedAt: 1 };
  let cloud = mergeDocs(base, null);
  // device A: reviews take 1, deletes take 2, syncs
  const A = { ...cloud, sessions: [{ id: '1', createdAt: '2026-01-01', overall: 50, aiReview: 'B+', updatedAt: 100 }], deletedSessionIds: ['2'] };
  cloud = mergeDocs(A, cloud);
  // stale device B: still has both takes, adds take 3, renames the profile, syncs
  const B = { ...base, sessions: [...base.sessions, { id: '3', createdAt: '2026-01-03', audioId: 'A-3' }], profile: { name: 'Q' }, profileUpdatedAt: 50 };
  cloud = mergeDocs(B, cloud);
  const ids = cloud.sessions.map((s) => s.id).join();
  ok(ids === '3,1', `B's new take and A's take survive, the deleted one stays gone (got ${ids})`);
  ok(cloud.sessions.find((s) => s.id === '1').aiReview === 'B+', "A's newer edit beats B's stale copy");
  ok(cloud.profile.name === 'Q', 'the newer profile wins');
  ok(!('audioId' in cloud.sessions[0]), 'audio fields stay on their device');
  ok(JSON.stringify(mergeDocs(cloud, cloud)) === JSON.stringify(cloud), 'merging a synced copy changes nothing');
  return 'syncMerge.demo: ok';
}
