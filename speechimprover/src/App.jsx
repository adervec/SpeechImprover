import { Component, useEffect, useState } from 'react';
import { StoreProvider, useStore } from './lib/store.jsx';
import { DriveSyncProvider } from './lib/driveSync.jsx';
import { RecorderProvider, useRecorder } from './lib/recorderContext.jsx';
import { ToastProvider } from './components/ui.jsx';
import { Sidebar, DeviceBar, RecordingIndicator } from './components/layout.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import { useRouter } from './hooks/useRouter.js';
import { applyTheme } from './styles/themes.js';

import Dashboard from './views/Dashboard.jsx';
import Practice from './views/Practice.jsx';
import Exercises from './views/Exercises.jsx';
import Projects from './views/Projects.jsx';
import Mastery from './views/Mastery.jsx';
import VoiceLab from './views/VoiceLab.jsx';
import Trends from './views/Trends.jsx';
import History from './views/History.jsx';
import Coach from './views/Coach.jsx';
import SessionDetail from './views/SessionDetail.jsx';
import Compare from './views/Compare.jsx';
import References from './views/References.jsx';
import Profile from './views/Profile.jsx';
import Settings from './views/Settings.jsx';
import Help from './views/Help.jsx';

const TITLES = {
  '': 'Dashboard',
  practice: 'Practice',
  exercises: 'Exercises',
  projects: 'Projects',
  mastery: 'Vocal mastery',
  voicelab: 'Voice lab',
  trends: 'Trends',
  history: 'Recordings & data',
  coach: 'AI coach',
  session: 'Session detail',
  compare: 'Compare sessions',
  references: 'References',
  profile: 'Profile',
  settings: 'Settings',
  help: 'Help & guide',
};

// One thrown view shouldn't white-screen the whole app. Reset on navigation via
// a route-derived key (remount clears the caught error).
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ borderColor: 'var(--bad)' }}>
          <h3 style={{ color: 'var(--bad)', marginTop: 0 }}>This screen hit an error.</h3>
          <p className="muted small">{String(this.state.error?.message || this.state.error)}</p>
          <button className="btn" onClick={() => window.location.reload()}>Reload app</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function View({ route, navigate }) {
  switch (route.page) {
    case 'practice':
      return <Practice key={`${route.query.exercise || route.query.technique || 'new'}-${route.query.step ?? route.query.stage ?? ''}`} route={route} navigate={navigate} />;
    case 'exercises':
      return <Exercises route={route} navigate={navigate} />;
    case 'projects':
      return <Projects route={route} navigate={navigate} />;
    case 'mastery':
      return <Mastery route={route} navigate={navigate} />;
    case 'voicelab':
      return <VoiceLab route={route} navigate={navigate} />;
    case 'trends':
      return <Trends route={route} navigate={navigate} />;
    case 'history':
      return <History route={route} navigate={navigate} />;
    case 'coach':
      return <Coach route={route} navigate={navigate} />;
    case 'session':
      return <SessionDetail key={route.param} route={route} navigate={navigate} />;
    case 'compare':
      return <Compare route={route} navigate={navigate} />;
    case 'references':
      return <References route={route} navigate={navigate} />;
    case 'profile':
      return <Profile route={route} navigate={navigate} />;
    case 'settings':
      return <Settings route={route} navigate={navigate} />;
    case 'help':
      return <Help route={route} navigate={navigate} />;
    default:
      return <Dashboard route={route} navigate={navigate} />;
  }
}

function Shell() {
  const { settings, loading, storageError } = useStore();
  const { isRecording } = useRecorder();
  const { route, navigate } = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  // Cmd/Ctrl-K opens the quick-jump palette.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Capture the PWA install event so we can offer an explicit "Install" button.
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallPrompt(e); };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // Per-route tab title so history/bookmarks/multi-tab are distinguishable.
  useEffect(() => {
    document.title = `${TITLES[route.page] ?? 'SpeechImprover'} · SpeechImprover`;
  }, [route.page]);

  const showBack = route.page === 'session' || route.page === 'compare';

  return (
    <>
      {isRecording && <div style={{ height: 36 }} />}
      <RecordingIndicator />
      <div className="app-shell">
        <Sidebar route={route} navigate={navigate} open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="main">
          <header className="topbar">
            <button className="nav-toggle" aria-label="Open menu" onClick={() => setNavOpen(true)}>☰</button>
            {showBack && (
              <button className="btn ghost sm" onClick={() => window.history.back()} aria-label="Go back">‹ Back</button>
            )}
            <h1 style={{ fontSize: '1.15rem' }}>{TITLES[route.page] ?? 'SpeechImprover'}</h1>
            <button className="btn ghost sm" onClick={() => setPaletteOpen(true)} title="Quick jump (Ctrl/⌘ K)" aria-label="Quick jump">🔎</button>
            {installPrompt && (
              <button className="btn ghost sm" title="Install as an app" onClick={async () => { installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }}>⤓ Install</button>
            )}
            <DeviceBar />
          </header>
          <main className="content">
            {storageError && (
              <div className="card" style={{ borderColor: 'var(--bad)', marginBottom: 18 }}>
                <strong style={{ color: 'var(--bad)' }}>Storage unavailable.</strong>{' '}
                <span className="muted">{storageError} — history and saving are disabled in this browser/mode.</span>
              </div>
            )}
            {loading ? (
              <div className="empty">Loading your history…</div>
            ) : (
              <ErrorBoundary key={`${route.page}/${route.param}`}>
                <View route={route} navigate={navigate} />
              </ErrorBoundary>
            )}
          </main>
        </div>
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} navigate={navigate} />}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <StoreProvider>
        <DriveSyncProvider>
          <RecorderProvider>
            <Shell />
          </RecorderProvider>
        </DriveSyncProvider>
      </StoreProvider>
    </ToastProvider>
  );
}
