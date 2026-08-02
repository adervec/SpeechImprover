import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './lib/store.jsx';
import { DriveSyncProvider } from './lib/driveSync.jsx';
import { RecorderProvider, useRecorder } from './lib/recorderContext.jsx';
import { ToastProvider } from './components/ui.jsx';
import { Sidebar, DeviceBar, RecordingIndicator } from './components/layout.jsx';
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

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  return (
    <>
      {isRecording && <div style={{ height: 36 }} />}
      <RecordingIndicator />
      <div className="app-shell">
        <Sidebar route={route} navigate={navigate} open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="main">
          <header className="topbar">
            <button className="nav-toggle" aria-label="Open menu" onClick={() => setNavOpen(true)}>☰</button>
            <h1 style={{ fontSize: '1.15rem' }}>{TITLES[route.page] ?? 'SpeechImprover'}</h1>
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
              <View route={route} navigate={navigate} />
            )}
          </main>
        </div>
      </div>
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
