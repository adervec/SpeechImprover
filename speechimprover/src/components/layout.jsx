// Layout chrome: Sidebar nav, DeviceBar (always-visible I/O devices + live mic
// level), and the global RecordingIndicator banner.

import { useRecorder } from '../lib/recorderContext.jsx';
import { useStore } from '../lib/store.jsx';
import { useMediaDevices } from '../hooks/useMediaDevices.js';
import { formatDuration } from '../lib/format.js';

const NAV = [
  { id: '', label: 'Dashboard', icon: '◎' },
  { id: 'practice', label: 'Practice', icon: '●' },
  { id: 'exercises', label: 'Exercises', icon: '✦' },
  { id: 'trends', label: 'Trends', icon: '📈' },
  { id: 'history', label: 'History', icon: '🕘' },
  { id: 'references', label: 'References', icon: '🎯' },
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'help', label: 'Help & guide', icon: '❔' },
];

export function Sidebar({ route, navigate }) {
  return (
    <nav className="sidebar">
      <div className="brand">
        <div className="brand-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" fill="#fff" stroke="none" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </div>
        <div>
          <div className="brand-name">SpeechImprover</div>
          <div className="brand-sub">English · v0</div>
        </div>
      </div>
      {NAV.map((n) => (
        <a
          key={n.id}
          className={`nav-link ${route.page === n.id ? 'active' : ''}`}
          onClick={() => navigate(n.id)}
        >
          <span className="ico">{n.icon}</span>
          {n.label}
        </a>
      ))}
      <div className="nav-spacer" />
      <a className="nav-link primary-cta" onClick={() => navigate('practice')} style={{ color: 'var(--accent)' }}>
        <span className="ico">＋</span>New session
      </a>
    </nav>
  );
}

function MicLevelMeter() {
  const { level, isActive, isRecording } = useRecorder();
  return (
    <div className="mic-meter" title="Microphone input level">
      <span className={`mic-dot ${isActive ? 'live' : ''}`} style={isRecording ? { background: 'var(--rec)' } : undefined} />
      <div className="mic-meter-track">
        <div className="mic-meter-fill" style={{ width: `${isActive ? Math.round(level * 100) : 0}%` }} />
      </div>
    </div>
  );
}

export function DeviceBar() {
  const { settings } = useStore();
  const { inputs, outputs, hasLabels } = useMediaDevices();
  const { isActive, isMonitoring, isRecording, startMonitor, stopMonitor } = useRecorder();

  const inDev = inputs.find((d) => d.deviceId === settings.inputDeviceId) || inputs[0];
  const outDev = outputs.find((d) => d.deviceId === settings.outputDeviceId) || outputs[0];

  const inLabel = inDev?.label || (hasLabels ? 'Default mic' : 'Microphone (grant access)');
  const outLabel = outDev?.label || 'System default output';

  return (
    <div className="devicebar">
      <div className="device-chip" title={inLabel}>
        🎤 <b>{inLabel}</b>
      </div>
      <div className="device-chip" title={outLabel}>
        🔊 <b>{outLabel}</b>
      </div>
      <MicLevelMeter />
      {!isRecording && (
        <button
          className={`btn sm ${isMonitoring ? '' : 'ghost'}`}
          onClick={() => (isMonitoring ? stopMonitor() : startMonitor(settings.inputDeviceId))}
        >
          {isMonitoring ? 'Stop test' : 'Test mic'}
        </button>
      )}
      <span className="tiny muted nowrap">
        {isRecording ? 'recording' : isActive ? 'monitoring' : 'idle'}
      </span>
    </div>
  );
}

export function RecordingIndicator() {
  const { isRecording, elapsedMs } = useRecorder();
  if (!isRecording) return null;
  return (
    <div className="rec-banner">
      <span className="rec-dot" />
      RECORDING — your microphone is live · {formatDuration(elapsedMs / 1000)}
    </div>
  );
}
