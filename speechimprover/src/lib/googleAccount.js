// The connected Google account (name, email, photo) for the Drive-sync UI.
// Cosmetic only: any failure — including a token granted without the profile
// scope, which userinfo answers with 401/403 — yields null and sync carries on.
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export function parseUserinfo(j) {
  if (!j || (!j.name && !j.email && !j.picture)) return null;
  return { name: j.name || j.email || 'Google account', email: j.email || '', picture: j.picture || '' };
}

export async function fetchAccount(token, fetchImpl = fetch) {
  try {
    const r = await fetchImpl(USERINFO_URL, { headers: { Authorization: `Bearer ${token}` } });
    return r.ok ? parseUserinfo(await r.json()) : null;
  } catch {
    return null;
  }
}

// Self-check with a stubbed userinfo endpoint (npm test).
export async function demo() {
  const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
  const stub = (status, body) => async (url, opts) => {
    ok(url === USERINFO_URL && opts.headers.Authorization === 'Bearer T', 'bearer token sent to userinfo');
    return { ok: status === 200, status, json: async () => body };
  };
  const a = await fetchAccount('T', stub(200, { name: 'Ada', email: 'ada@example.com', picture: 'https://lh3.googleusercontent.com/a/x' }));
  ok(a.name === 'Ada' && a.email === 'ada@example.com' && a.picture.startsWith('https://lh3.'), 'profile parsed');
  ok((await fetchAccount('T', stub(200, { email: 'ada@example.com' }))).name === 'ada@example.com', 'no name → email');
  ok((await fetchAccount('T', stub(403, {}))) === null, 'no profile scope (403) → no account, no throw');
  ok((await fetchAccount('T', async () => { throw new Error('offline'); })) === null, 'network error → null');
  return 'googleAccount.demo: ok';
}
