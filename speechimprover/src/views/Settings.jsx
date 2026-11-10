import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { useDriveSync } from '../lib/driveSync.jsx';
import { useRecorder } from '../lib/recorderContext.jsx';
import { useMediaDevices } from '../hooks/useMediaDevices.js';
import { Modal, useToast } from '../components/ui.jsx';
import { THEMES, THEME_KEYS } from '../styles/themes.js';
import { exportData, importData, downloadJson } from '../lib/exportImport.js';
import { formatBytes, localDayKey } from '../lib/format.js';
import { eraseAllLocalData } from '../lib/eraseAll.js';
import { deleteDatabase } from '../lib/db.js';
import {
  FS_SUPPORTED, pickNarrationDir, getNarrationDir, forgetNarrationDir,
  ensureReadPermission, scanNarrationDir,
} from '../lib/narrationWatch.js';

export default function Settings() {
  const {
    settings, updateSettings, profile, updateProfile, sessions,
    purgeAllAudio, refresh, addSession,
  } = useStore();
  const drive = useDriveSync();
  const { startMonitor, stopMonitor, isMonitoring, recognitionSupported } = useRecorder();
  const { inputs, outputs, hasLabels, refresh: refreshDevices } = useMediaDevices();
  const toast = useToast();
  const fileRef = useRef(null);
  const [confirm, setConfirm] = useState(null);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [narrationDir, setNarrationDir] = useState(null);
  const [scanning, setScanning] = useState(false);
  useEffect(() => { getNarrationDir().then((d) => d && setNarrationDir(d)).catch(() => {}); }, []);

  async function linkNarrationFolder() {
    try {
      const dir = await pickNarrationDir();
      setNarrationDir(dir);
      await runNarrationScan(dir);
    } catch { /* cancelled */ }
  }
  async function runNarrationScan(dir = narrationDir) {
    if (!dir) return;
    setScanning(true);
    try {
      if (!(await ensureReadPermission(dir, true))) { toast('Folder access was denied.'); return; }
      const res = await scanNarrationDir(dir, addSession);
      toast(res.imported
        ? `Imported ${res.imported} session${res.imported === 1 ? '' : 's'} from Tachyread.`
        : res.seen ? 'No new Tachyread sessions — everything already imported.' : 'No Tachyread logs in that folder yet.');
    } catch (err) {
      toast(`Scan failed: ${err.message || err}`);
    } finally {
      setScanning(false);
    }
  }

  const totalAudio = useMemo(() => sessions.reduce((sum, s) => sum + (s.audioBytes || 0), 0), [sessions]);
  const audioCount = useMemo(() => sessions.filter((s) => s.audioId).length, [sessions]);

  async function grantAccess() {
    await startMonitor(settings.inputDeviceId);
    await refreshDevices();
    setTimeout(() => stopMonitor(), 800);
  }

  async function doExport() {
    const data = await exportData({ includeAudio, profile, settings });
    downloadJson(data, `speechimprover-export-${localDayKey()}.json`);
    toast(`Exported ${data.sessions.length} sessions${includeAudio ? ' with audio' : ''}.`);
  }

  async function onImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const res = await importData(json);
      if (res.profile) updateProfile(res.profile);
      if (res.settings?.theme) updateSettings({ theme: res.settings.theme });
      await refresh();
      toast(`Imported ${res.importedSessions} sessions, ${res.importedAudio} audio clips.`);
    } catch (err) {
      toast(`Import failed: ${err.message || err}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="stack">
      {/* Themes */}
      <div className="card">
        <div className="card-head">
          <h3>Theme</h3>
          {/* Shared house-font picker from adervec.github.io/font.js — the choice applies to every app there. */}
          <app-font-picker label="Font" class="small"></app-font-picker>
        </div>
        <div className="grid cols-3">
          {THEME_KEYS.map((key) => {
            const t = THEMES[key];
            const active = settings.theme === key;
            return (
              <button
                key={key}
                onClick={() => updateSettings({ theme: key })}
                className="card tight"
                style={{
                  textAlign: 'left', cursor: 'pointer',
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                  borderWidth: active ? 2 : 1, borderStyle: 'solid',
                }}
              >
                <div className="row spread">
                  <b>{t.label}</b>
                  {active && <span className="tag">active</span>}
                </div>
                <div className="row" style={{ gap: 6, marginTop: 10 }}>
                  <span style={{ width: 40, height: 22, borderRadius: 6, background: t.vars['--bg'], border: '1px solid var(--border)' }} />
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: t.swatch[0] }} />
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: t.swatch[1] }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Devices */}
      <div className="card">
        <div className="card-head"><h3>Audio devices</h3>
          {!hasLabels && <button className="btn sm" onClick={grantAccess}>Grant mic access</button>}
        </div>
        {!hasLabels && <p className="tiny muted" style={{ marginBottom: 12 }}>Grant microphone access to see device names. The mic level meter is always in the top bar.</p>}
        <div className="grid cols-2">
          <label className="field">Input (microphone)
            <select value={settings.inputDeviceId || ''} onChange={(e) => updateSettings({ inputDeviceId: e.target.value })}>
              <option value="">System default</option>
              {inputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 6)}`}</option>)}
            </select>
          </label>
          <label className="field">Output (playback)
            <select value={settings.outputDeviceId || ''} onChange={(e) => updateSettings({ outputDeviceId: e.target.value })}>
              <option value="">System default</option>
              {outputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Output ${d.deviceId.slice(0, 6)}`}</option>)}
            </select>
          </label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className={`btn sm ${isMonitoring ? 'primary' : ''}`} onClick={() => (isMonitoring ? stopMonitor() : startMonitor(settings.inputDeviceId))}>
            {isMonitoring ? 'Stop mic test' : 'Test microphone'}
          </button>
          <span className="tiny muted">Watch the level meter in the top bar respond to your voice.</span>
        </div>
      </div>

      {/* Recognition */}
      <div className="card">
        <div className="card-head"><h3>Live transcription</h3></div>
        <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={!!settings.recognitionEnabled} onChange={(e) => updateSettings({ recognitionEnabled: e.target.checked })} />
          <span>Use the browser's speech recognition for live transcript & pace/filler/vocabulary scoring (English).</span>
        </label>
        {!recognitionSupported && <p className="tiny" style={{ color: 'var(--warn)', marginTop: 8 }}>⚠️ Not supported in this browser — try Chrome or Edge. Pitch, energy and articulation are still analyzed.</p>}
      </div>

      {/* Tachyread narration + reading aloud → sessions */}
      <div className="card">
        <div className="card-head"><h3>Tachyread speech</h3></div>
        <p className="small muted" style={{ marginTop: 0 }}>
          Speaking in Tachyread is speech practice. Point this app at the <b>speech/</b> subfolder of
          your Tachyread folder: Tachyread drops a small log per session there (no audio, no text).
          Audiobook <b>narration</b> comes in as a completed training session (pace, quality,
          steadiness); <b>reading aloud to advance the text</b> comes in <b>scored</b> — Tachyread’s
          live voice scores on this app’s attributes, pace and filler economy rescored from the words
          read, and its face-camera presenting scores (eye contact, head steadiness, expressiveness,
          articulation) when that was on. All of it counts toward your streak, activity grid, trends
          and practice time.
        </p>
        {!FS_SUPPORTED && <p className="small muted">Folder watching needs a Chromium browser (Chrome, Edge, Brave).</p>}
        {FS_SUPPORTED && (
          <div className="row wrap">
            {narrationDir ? (
              <>
                <span className="badge">📁 {narrationDir.name}</span>
                <button className="btn" disabled={scanning} onClick={() => runNarrationScan()}>{scanning ? 'Scanning…' : '↻ Scan now'}</button>
                <button className="btn" onClick={async () => { await forgetNarrationDir(); setNarrationDir(null); }}>Forget folder</button>
              </>
            ) : (
              <button className="btn" onClick={linkNarrationFolder}>📁 Watch Tachyread’s speech folder…</button>
            )}
          </div>
        )}
        {narrationDir && (
          <p className="tiny muted" style={{ marginTop: 10 }}>
            The folder is also scanned automatically when the app opens (when the browser has kept
            permission). Already-imported sessions are never duplicated.
          </p>
        )}
      </div>

      {/* Cloud sync */}
      <CloudSync />

      {/* Data management */}
      <div className="card">
        <div className="card-head"><h3>Data &amp; storage</h3></div>
        <div className="grid cols-3" style={{ marginBottom: 16 }}>
          <div className="stat"><span className="big" style={{ fontSize: '1.4rem' }}>{sessions.length}</span><span className="lbl">Sessions</span></div>
          <div className="stat"><span className="big" style={{ fontSize: '1.4rem' }}>{audioCount}</span><span className="lbl">With audio</span></div>
          <div className="stat"><span className="big" style={{ fontSize: '1.4rem' }}>{formatBytes(totalAudio)}</span><span className="lbl">Audio stored</span></div>
        </div>

        <div className="divider" />
        <h4 style={{ margin: '12px 0 8px' }}>Export</h4>
        <label className="row" style={{ gap: 10, cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={includeAudio} onChange={(e) => setIncludeAudio(e.target.checked)} />
          <span className="small">Include audio (much larger file)</span>
        </label>
        <div className="row wrap">
          <button className="btn" onClick={doExport}>⬇ Export data (JSON)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>⬆ Import data</button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onImportFile} style={{ display: 'none' }} />
        </div>

        <div className="divider" style={{ marginTop: 16 }} />
        <h4 style={{ margin: '12px 0 8px' }}>Purge &amp; reset</h4>
        <div className="row wrap">
          <button className="btn" disabled={!audioCount} onClick={() => setConfirm('audio')}>Purge all audio (keep scores)</button>
          <button className="btn danger" onClick={() => setConfirm('all')}>Erase everything on this device</button>
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Purging audio frees space while preserving all scores and trends. Erasing removes every SpeechImprover recording, setting, project and program from this device and cannot be undone — export first. Other apps' data is left alone.
        </p>
      </div>

      {confirm && (
        <Modal
          title={confirm === 'audio' ? 'Purge all audio?' : 'Erase everything on this device?'}
          onClose={() => setConfirm(null)}
          footer={<>
            <button className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
            <button
              className={`btn ${confirm === 'all' ? 'danger' : 'primary'}`}
              onClick={async () => {
                if (confirm === 'audio') { await purgeAllAudio(); toast('All audio purged.'); }
                else {
                  if (drive.connected) drive.disconnect(); // stop sync first so nothing re-downloads
                  await eraseAllLocalData({ deleteDb: deleteDatabase });
                  window.location.reload(); // drop in-memory state too; app restarts empty
                  return;
                }
                setConfirm(null);
              }}
            >
              {confirm === 'audio' ? 'Purge audio' : 'Erase everything'}
            </button>
          </>}
        >
          <p className="muted">
            {confirm === 'audio' && `This deletes ${audioCount} audio recording(s) (${formatBytes(totalAudio)}) but keeps every score, metric and trend.`}
            {confirm === 'all' && (
              <>
                This permanently deletes all of SpeechImprover’s data on this device — sessions, scores, audio,
                projects, program, profile and settings — then restarts the app empty. Consider exporting first.
                {drive.connected && <> Google Drive will be disconnected; <b>the copy in your Drive is not touched</b> (reconnect later to restore it, or remove it from Drive’s “Manage apps”).</>}
                {' '}Other apps on this site keep their data.
              </>
            )}
          </p>
        </Modal>
      )}
    </div>
  );
}

const SYNC_LABEL = { syncing: 'Syncing…', synced: 'Up to date', error: 'Sync error', idle: 'Idle' };

function CloudSync() {
  const { configured, connected, account, status, lastSyncedAt, error, connect, disconnect, syncNow } = useDriveSync();

  if (!configured) {
    return (
      <div className="card">
        <div className="card-head"><h3>Cloud sync</h3></div>
        <p className="tiny muted">
          Google Drive sync is disabled on this build. To enable it (e.g. on your own fork), set{' '}
          <code>VITE_GOOGLE_CLIENT_ID</code> to a Google OAuth client ID at build time. Your local JSON
          export/import below works regardless.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3>Cloud sync</h3>
        {connected && <span className="tag">{SYNC_LABEL[status] || status}</span>}
      </div>
      {!connected ? (
        <>
          <p className="small" style={{ marginBottom: 12 }}>
            Optionally sync your sessions, profile and theme across devices via your own Google Drive.
            Data lives in a private app folder in <b>your</b> Drive — opt-in, and never on our servers.
            Audio recordings stay on this device.
          </p>
          <button className="btn primary" onClick={connect}>☁ Connect Google Drive</button>
        </>
      ) : (
        <>
          {account && (
            <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 10 }}>
              {account.picture && (
                <img src={account.picture} alt="" referrerPolicy="no-referrer" width="24" height="24"
                  style={{ borderRadius: '50%', objectFit: 'cover' }} />
              )}
              <span className="small">
                Signed in as <b>{account.name}</b>{account.email && account.email !== account.name ? <span className="muted"> · {account.email}</span> : null}
              </span>
            </div>
          )}
          <p className="small" style={{ marginBottom: 12 }}>
            {status === 'error'
              ? <span style={{ color: 'var(--bad)' }}>Couldn’t sync: {error} — try “Sync now”, or reconnect.</span>
              : <>Last synced {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'never'}. Changes sync automatically while this tab is open.</>}
          </p>
          <div className="row wrap">
            <button className="btn" onClick={syncNow} disabled={status === 'syncing'}>↻ Sync now</button>
            <button className="btn ghost" onClick={disconnect}>Disconnect</button>
          </div>
        </>
      )}
    </div>
  );
}
