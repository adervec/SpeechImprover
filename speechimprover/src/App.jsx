import { useEffect } from 'react';
import { StoreProvider, useStore } from './lib/store.jsx';
import { RecorderProvider, useRecorder } from './lib/recorderContext.jsx';
import { ToastProvider } from './components/ui.jsx';
import { Sidebar, DeviceBar, RecordingIndicator } from './components/layout.jsx';
import { useRouter } from './hooks/useRouter.js';
import { applyTheme } from './styles/themes.js';

import Dashboard from './views/Dashboard.jsx';
import Practice from './views/Practice.jsx';
import Exercises from './views/Exercises.jsx';
import Trends from './views/Trends.jsx';
import History from './views/History.jsx';
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
  trends: 'Trends',
  history: 'History',
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
      return <Practice key={`${route.query.exercise || 'new'}-${route.query.step ?? ''}`} route={route} navigate={navigate} />;
    case 'exercises':
      return <Exercises route={route} navigate={navigate} />;
    case 'trends':
      return <Trends route={route} navigate={navigate} />;
    case 'history':
      return <History route={route} navigate={navigate} />;
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

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  return (
    <>
      {isRecording && <div style={{ height: 36 }} />}
      <RecordingIndicator />
      <div className="app-shell">
        <Sidebar route={route} navigate={navigate} />
        <div className="main">
          <header className="topbar">
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
        <RecorderProvider>
          <Shell />
        </RecorderProvider>
      </StoreProvider>
    </ToastProvider>
  );
}
