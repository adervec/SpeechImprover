import { useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { useRecorder } from '../lib/recorderContext.jsx';
import { useMediaDevices } from '../hooks/useMediaDevices.js';
import { Modal, useToast } from '../components/ui.jsx';
import { THEMES, THEME_KEYS } from '../styles/themes.js';
import { exportData, importData, downloadJson } from '../lib/exportImport.js';
import { formatBytes } from '../lib/format.js';

export default function Settings() {
  const {
    settings, updateSettings, profile, updateProfile, sessions,
    purgeAllAudio, resetAllData, refresh,
  } = useStore();
  const { startMonitor, stopMonitor, isMonitoring, recognitionSupported } = useRecorder();
  const { inputs, outputs, hasLabels, refresh: refreshDevices } = useMediaDevices();
  const toast = useToast();
  const fileRef = useRef(null);
  const [confirm, setConfirm] = useState(null);
  const [includeAudio, setIncludeAudio] = useState(true);

  const totalAudio = useMemo(() => sessions.reduce((sum, s) => sum + (s.audioBytes || 0), 0), [sessions]);
  const audioCount = useMemo(() => sessions.filter((s) => s.audioId).length, [sessions]);

  async function grantAccess() {
    await startMonitor(settings.inputDeviceId);
    await refreshDevices();
    setTimeout(() => stopMonitor(), 800);
  }

  async function doExport() {
    const data = await exportData({ includeAudio, profile, settings });
    downloadJson(data, `speechimprover-export-${new Date().toISOString().slice(0, 10)}.json`);
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
        <div className="card-head"><h3>Theme</h3></div>
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
          <button className="btn danger" disabled={!sessions.length} onClick={() => setConfirm('all')}>Delete everything</button>
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Purging audio frees space while preserving all scores and trends. Deleting everything cannot be undone — export first.
        </p>
      </div>

      {confirm && (
        <Modal
          title={confirm === 'audio' ? 'Purge all audio?' : 'Delete everything?'}
          onClose={() => setConfirm(null)}
          footer={<>
            <button className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
            <button
              className={`btn ${confirm === 'all' ? 'danger' : 'primary'}`}
              onClick={async () => {
                if (confirm === 'audio') { await purgeAllAudio(); toast('All audio purged.'); }
                else { await resetAllData(); toast('All data deleted.'); }
                setConfirm(null);
              }}
            >
              {confirm === 'audio' ? 'Purge audio' : 'Delete all'}
            </button>
          </>}
        >
          <p className="muted">
            {confirm === 'audio' && `This deletes ${audioCount} audio recording(s) (${formatBytes(totalAudio)}) but keeps every score, metric and trend.`}
            {confirm === 'all' && 'This permanently deletes all sessions, scores and audio from this device. Consider exporting first.'}
          </p>
        </Modal>
      )}
    </div>
  );
}
