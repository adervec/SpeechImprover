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
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'mastery', label: 'Vocal mastery', icon: '🏆' },
  { id: 'voicelab', label: 'Voice lab', icon: '🗣️' },
  { id: 'trends', label: 'Trends', icon: '📈' },
  { id: 'history', label: 'Recordings', icon: '🕘' },
  { id: 'coach', label: 'AI coach', icon: '🤝' },
  { id: 'references', label: 'References', icon: '🎯' },
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'help', label: 'Help & guide', icon: '❔' },
];

export function Sidebar({ route, navigate, open, onClose }) {
  const go = (id) => { navigate(id); onClose?.(); };
  return (
    <>
      {open && <button className="nav-backdrop" aria-label="Close menu" onClick={onClose} />}
      <nav className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-logo">
          {/* matches favicon.svg: rising voice/equalizer bars */}
          <svg width="20" height="20" viewBox="0 0 32 32" fill="#fff" aria-hidden="true">
            <rect x="4.5" y="11.5" width="3" height="9" rx="1.5" />
            <rect x="9.5" y="8.5" width="3" height="15" rx="1.5" />
            <rect x="14.5" y="10.5" width="3" height="11" rx="1.5" />
            <rect x="19.5" y="6.5" width="3" height="19" rx="1.5" />
            <rect x="24.5" y="4.5" width="3" height="23" rx="1.5" />
          </svg>
        </div>
        <div>
          <div className="brand-name">SpeechImprover</div>
          <div className="brand-sub">English · v0</div>
        </div>
      </div>
      {NAV.map((n) => (
        <button
          type="button"
          key={n.id}
          className={`nav-link ${route.page === n.id ? 'active' : ''}`}
          aria-current={route.page === n.id ? 'page' : undefined}
          onClick={() => go(n.id)}
        >
          <span className="ico">{n.icon}</span>
          {n.label}
        </button>
      ))}
      <div className="nav-spacer" />
      <button type="button" className="nav-link primary-cta" onClick={() => go('practice')} style={{ color: 'var(--accent)' }}>
        <span className="ico">＋</span>New session
      </button>
      </nav>
    </>
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
