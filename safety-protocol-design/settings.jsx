// Ayar + profil ekranı

function SettingsScreen({ onLogout }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', background: SURFACE }}>
      {/* Profil header */}
      <div style={{
        background: 'linear-gradient(180deg, #0A1F44 0%, #16306B 100%)',
        padding: '60px 24px 32px',
        color: 'white',
      }}>
        <div style={{ fontSize: 12, opacity: 0.65, fontWeight: 500, letterSpacing: 0.5 }}>
          PROFİL & AYARLAR
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          marginTop: 16,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: YELLOW,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: NAVY, fontSize: 22, fontWeight: 800,
            border: '3px solid rgba(255,255,255,0.2)',
          }}>
            AY
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              Ahmet Yıldız
            </div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>
              Şoför · ID 4837
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              marginTop: 6,
              padding: '3px 8px',
              background: 'rgba(31,138,85,0.25)',
              border: '1px solid rgba(31,138,85,0.5)',
              borderRadius: 6,
              fontSize: 11, fontWeight: 700, color: '#7AE0A8',
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%', background: '#7AE0A8',
              }} />
              VARDİYADA
            </div>
          </div>
        </div>

        {/* Plaka kartı */}
        <div style={{
          marginTop: 18,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ color: YELLOW }}>
            <Icon.Plate size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 500, letterSpacing: 0.5 }}>
              AKTİF PLAKA
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, fontFamily: 'monospace' }}>
              34 ABC 123
            </div>
          </div>
          <button style={{
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'transparent',
            color: 'white',
            fontSize: 12, fontWeight: 600,
            padding: '6px 12px', borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            Değiştir
          </button>
        </div>
      </div>

      {/* Hesap */}
      <SettingsGroup title="Hesap">
        <SettingsRow label="Ad Soyad" value="Ahmet Yıldız" />
        <SettingsRow label="Telefon" value="+90 532 *** 47 21" />
        <SettingsRow label="Şoför Belgesi" value="Doğrulandı" valueColor={OK_GREEN} />
      </SettingsGroup>

      {/* Kamera & Tarama */}
      <SettingsGroup title="Kamera & Tarama">
        <SettingsToggle label="Otomatik tarama" subtitle="Yolcu binince başlat" defaultChecked />
        <SettingsToggle label="Yüksek doğruluk modu" subtitle="Daha fazla pil tüketir" />
        <SettingsToggle label="Şüpheli durumda titreşim" defaultChecked />
        <SettingsRow label="Eşleşme eşiği" value="%85" />
      </SettingsGroup>

      {/* Bildirim */}
      <SettingsGroup title="Bildirimler">
        <SettingsToggle label="Şüpheli yolcu uyarıları" defaultChecked />
        <SettingsToggle label="Vardiya hatırlatıcı" defaultChecked />
        <SettingsToggle label="Haftalık özet" />
      </SettingsGroup>

      {/* Diğer */}
      <SettingsGroup title="Diğer">
        <SettingsRow label="Dil" value="Türkçe" arrow />
        <SettingsRow label="Yardım & Destek" arrow />
        <SettingsRow label="Gizlilik politikası" arrow />
        <SettingsRow label="Versiyon" value="1.4.2" />
      </SettingsGroup>

      {/* Çıkış */}
      <div style={{ padding: '8px 16px 100px' }}>
        <button onClick={onLogout} style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '14px',
          background: 'white',
          border: '1px solid rgba(199,66,58,0.25)',
          borderRadius: 14,
          color: WARN_RED,
          fontSize: 14, fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
          <Icon.Logout size={16} /> Vardiyayı bitir ve çık
        </button>
      </div>
    </div>
  );
}

function SettingsGroup({ title, children }) {
  return (
    <div style={{ padding: '20px 16px 0' }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: TEXT_MUTED,
        letterSpacing: 0.8, textTransform: 'uppercase',
        padding: '0 8px 8px',
      }}>
        {title}
      </div>
      <div style={{
        background: 'white',
        borderRadius: 14,
        border: '1px solid #EEF1F7',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ label, value, valueColor, arrow }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '13px 16px',
      borderBottom: '1px solid #F2F4F9',
    }}>
      <div style={{ flex: 1, fontSize: 14, color: NAVY, fontWeight: 500 }}>
        {label}
      </div>
      {value && (
        <div style={{
          fontSize: 13, color: valueColor || TEXT_MUTED, fontWeight: 600,
          marginRight: arrow ? 8 : 0,
        }}>
          {value}
        </div>
      )}
      {arrow && <span style={{ color: TEXT_MUTED }}><Icon.ChevronRight size={16} /></span>}
    </div>
  );
}

function SettingsToggle({ label, subtitle, defaultChecked }) {
  const [on, setOn] = React.useState(defaultChecked || false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '13px 16px',
      borderBottom: '1px solid #F2F4F9',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: NAVY, fontWeight: 500 }}>
          {label}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
      <button onClick={() => setOn(v => !v)} style={{
        width: 42, height: 24, borderRadius: 999,
        background: on ? NAVY_ACCENT : '#D8DEE8',
        border: 'none', cursor: 'pointer', padding: 0,
        position: 'relative',
        transition: 'background 0.2s',
      }}>
        <div style={{
          position: 'absolute',
          top: 2,
          left: on ? 20 : 2,
          width: 20, height: 20,
          background: 'white',
          borderRadius: '50%',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}

window.SettingsScreen = SettingsScreen;
