// App orchestrator - login -> ana app (3 sekmeli)

function StatusBar() {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: 44,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px',
      color: 'white',
      fontSize: 15, fontWeight: 600,
      zIndex: 100,
      pointerEvents: 'none',
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {/* signal */}
        <svg width="19" height="12" viewBox="0 0 19 12" fill="white">
          <rect x="0" y="8" width="3" height="4" rx="0.5" />
          <rect x="5" y="5" width="3" height="7" rx="0.5" />
          <rect x="10" y="2" width="3" height="10" rx="0.5" />
          <rect x="15" y="0" width="3" height="12" rx="0.5" />
        </svg>
        {/* wifi */}
        <svg width="17" height="12" viewBox="0 0 17 12" fill="white">
          <path d="M8.5 2.5C5 2.5 2 4 0 6.5l1.5 1.5C3 6 5.5 5 8.5 5s5.5 1 7 3L17 6.5C15 4 12 2.5 8.5 2.5zM8.5 6c-2 0-4 0.7-5.5 2L4.5 9.5C5.5 8.5 7 8 8.5 8s3 0.5 4 1.5L14 8c-1.5-1.3-3.5-2-5.5-2zM8.5 9.5c-1 0-2 0.4-2.7 1L8.5 12l2.7-1.5c-0.7-0.6-1.7-1-2.7-1z" />
        </svg>
        {/* battery */}
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
          <rect x="0.5" y="0.5" width="22" height="12" rx="3" stroke="white" opacity="0.5" />
          <rect x="2" y="2" width="19" height="9" rx="1.5" fill="white" />
          <rect x="24" y="4" width="2" height="5" rx="1" fill="white" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

function PhoneFrame({ children }) {
  return (
    <div style={{
      width: 390,
      height: 844,
      background: '#000',
      borderRadius: 56,
      padding: 14,
      boxShadow:
        '0 30px 60px rgba(15, 23, 42, 0.18),' +
        '0 12px 24px rgba(15, 23, 42, 0.12),' +
        '0 1px 2px rgba(15, 23, 42, 0.10)',
    }}>
      <div style={{
        width: '100%', height: '100%',
        background: '#FFFFFF',
        borderRadius: 44,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Notch */}
        <div style={{
          position: 'absolute',
          top: 11,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120, height: 36,
          background: '#000',
          borderRadius: 22,
          zIndex: 200,
        }} />
        <StatusBar />
        {children}
        {/* Home indicator */}
        <div style={{
          position: 'absolute', bottom: 8, left: '50%',
          transform: 'translateX(-50%)',
          width: 134, height: 5,
          background: 'rgba(0,0,0,0.85)',
          borderRadius: 3,
          zIndex: 300,
        }} />
      </div>
    </div>
  );
}

function App() {
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [tab, setTab] = React.useState('home'); // home | logs | settings

  return (
    <div style={{
      width: '100%', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#E8ECF3',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
      boxSizing: 'border-box',
    }}>
      <PhoneFrame>
        {!loggedIn && (
          <LoginScreen onLogin={() => { setLoggedIn(true); setTab('home'); }} />
        )}

        {loggedIn && (
          <React.Fragment>
            {tab === 'home' && (
              <HomeScreen
                onGoToLogs={() => setTab('logs')}
                onGoToCamera={() => {}}
              />
            )}
            {tab === 'logs' && <LogsScreen />}
            {tab === 'settings' && (
              <SettingsScreen onLogout={() => setLoggedIn(false)} />
            )}
            <BottomNav active={tab} onChange={setTab} />
          </React.Fragment>
        )}
      </PhoneFrame>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
