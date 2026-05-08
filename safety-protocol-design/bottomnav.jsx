// Bottom navigation - sol: log, orta: ana ekran (taksi şeklinde), sağ: ayar

function BottomNav({ active, onChange }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      background: 'white',
      borderTop: '1px solid #EEF1F7',
      paddingBottom: 24,
      paddingTop: 10,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      flexShrink: 0,
      zIndex: 10,
    }}>
      <NavTab
        label="Geçmiş"
        icon={<Icon.Logs size={22} />}
        active={active === 'logs'}
        onClick={() => onChange('logs')}
      />
      <CenterTaxiTab
        active={active === 'home'}
        onClick={() => onChange('home')}
      />
      <NavTab
        label="Ayarlar"
        icon={<Icon.Settings size={22} />}
        active={active === 'settings'}
        onClick={() => onChange('settings')}
      />
    </div>
  );
}

function NavTab({ label, icon, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: '6px 0',
      color: active ? NAVY : '#9AA5BD',
      fontFamily: 'inherit',
    }}>
      {icon}
      <span style={{
        fontSize: 11, fontWeight: active ? 700 : 500,
        letterSpacing: 0.2,
      }}>
        {label}
      </span>
    </button>
  );
}

// Orta - taksi şeklinde, kabarık FAB stili buton
function CenterTaxiTab({ active, onClick }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      position: 'relative',
    }}>
      <button onClick={onClick} style={{
        position: 'relative',
        width: 64, height: 64,
        borderRadius: '50%',
        background: active
          ? 'linear-gradient(180deg, #FFE066 0%, #F5B400 100%)'
          : 'linear-gradient(180deg, #FFE066 0%, #F5B400 100%)',
        border: '4px solid white',
        boxShadow: active
          ? '0 8px 22px rgba(245,180,0,0.45), 0 0 0 4px rgba(245,180,0,0.15)'
          : '0 6px 16px rgba(245,180,0,0.35)',
        cursor: 'pointer',
        marginTop: -28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: NAVY,
        transition: 'all 0.2s',
        padding: 0,
      }}>
        <Icon.TaxiMini size={36} color={NAVY} />
      </button>
      <span style={{
        fontSize: 11, fontWeight: active ? 700 : 500,
        letterSpacing: 0.2,
        color: active ? NAVY : '#9AA5BD',
        marginTop: 4,
      }}>
        Ana Ekran
      </span>
    </div>
  );
}

window.BottomNav = BottomNav;
