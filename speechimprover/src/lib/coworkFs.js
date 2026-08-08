// File System Access helpers for the cowork folder. The chosen directory handle is
// persisted in IndexedDB so it survives reloads; writes are atomic (createWritable
// commits on close). Everything stays on-device — these are local file ops only.

import { getFsHandle, setFsHandle } from './db.js';

const KEY = 'coworkDir';
export const FS_SUPPORTED = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

export async function pickCoworkDir() {
  const handle = await window.showDirectoryPicker({ id: 'speechimprover-cowork', mode: 'readwrite' });
  await setFsHandle(KEY, handle);
  return handle;
}
export function getSavedDir() {
  return getFsHandle(KEY);
}
export async function forgetDir() {
  await setFsHandle(KEY, null);
}

// Returns true if we hold (or the user just granted) readwrite on the folder.
export async function ensurePermission(dir, mode = 'readwrite') {
  if (!dir) return false;
  const q = await (dir.queryPermission?.({ mode }) ?? 'granted');
  if (q === 'granted') return true;
  const r = await (dir.requestPermission?.({ mode }) ?? 'granted');
  return r === 'granted';
}

async function fileHandleForPath(dir, path, create) {
  const parts = path.split('/');
  const name = parts.pop();
  let d = dir;
  for (const p of parts) d = await d.getDirectoryHandle(p, { create });
  return d.getFileHandle(name, { create });
}

export async function writeFileAt(dir, path, text) {
  const fh = await fileHandleForPath(dir, path, true);
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
}

export async function readFileAt(dir, path) {
  try {
    const fh = await fileHandleForPath(dir, path, false);
    return await (await fh.getFile()).text();
  } catch {
    return null; // missing file / no reply yet
  }
}

// Write a whole batch of { path, text } files (used for one request push).
export async function writeFiles(dir, files) {
  for (const f of files) await writeFileAt(dir, f.path, f.text);
}
