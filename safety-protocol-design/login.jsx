// Giriş ekranı - sade, taksiyi tepeye yerleştir

function InputField({ label, placeholder, type = 'text', value, onChange, icon, flexFill }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{
      ...(flexFill ? { flex: 1, minWidth: 0 } : {}),
    }}>
      <label style={{
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: '#5B6883',
        marginBottom: 7,
        letterSpacing: 0.2,
      }}>
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#F4F6FB',
        border: '1.5px solid ' + (focus ? NAVY_ACCENT : 'transparent'),
        borderRadius: 12,
        padding: '13px 14px',
        transition: 'border-color 0.15s',
      }}>
        {icon && <span style={{ color: focus ? NAVY_ACCENT : '#8A95B0' }}>{icon}</span>}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1, minWidth: 0,
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: 15, color: NAVY,
            fontFamily: 'inherit',
            fontWeight: 500,
          }}
        />
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [plate, setPlate] = React.useState('34 ABC 123');
  const [name, setName] = React.useState('Ahmet');
  const [surname, setSurname] = React.useState('Yıldız');
  const [pin, setPin] = React.useState('••••');

  const ready = plate && name && surname && pin;

  return (
    <div style={{
      flex: 1,
      display: 'flex', flexDirection: 'column',
      background: '#FFFFFF',
      overflow: 'auto',
    }}>
      {/* Üst lacivert blok - taksi içeride */}
      <div style={{
        background: 'linear-gradient(180deg, #0A1F44 0%, #16306B 100%)',
        padding: '40px 24px 28px',
        color: 'white',
        position: 'relative',
        flexShrink: 0,
      }}>
        {/* Status bar boşluğu */}
        <div style={{ height: 14 }} />

        {/* Taksi - ortalı, container'a sığdırılmış */}
        <div style={{
          display: 'flex', justifyContent: 'center',
          marginTop: 4,
        }}>
          <TaxiIllustration width={310} height={210} />
        </div>

        <div style={{ marginTop: 18, textAlign: 'left' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: YELLOW,
            letterSpacing: 1.2, textTransform: 'uppercase',
          }}>
            Şoför Girişi
          </div>
          <div style={{
            fontSize: 26, fontWeight: 700, marginTop: 6,
            letterSpacing: -0.3,
          }}>
            Hoş geldin
          </div>
          <div style={{
            fontSize: 14, opacity: 0.7, marginTop: 6,
            lineHeight: 1.4,
          }}>
            Vardiyana başlamak için bilgilerini gir.
          </div>
        </div>
      </div>

      {/* Form alanı - beyaz, üst köşeleri yuvarlatılmış, üste binmiş */}
      <div style={{
        background: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -20,
        padding: '28px 24px 32px',
        flex: 1,
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <InputField
          label="Plaka"
          placeholder="34 ABC 123"
          value={plate}
          onChange={setPlate}
          icon={<Icon.Plate />}
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <InputField
            flexFill
            label="İsim"
            placeholder="Ahmet"
            value={name}
            onChange={setName}
            icon={<Icon.User size={18} />}
          />
          <InputField
            flexFill
            label="Soyisim"
            placeholder="Yıldız"
            value={surname}
            onChange={setSurname}
          />
        </div>

        <InputField
          label="PIN Kodu"
          placeholder="••••"
          type="password"
          value={pin}
          onChange={setPin}
          icon={<Icon.Lock size={18} />}
        />

        <button
          onClick={onLogin}
          disabled={!ready}
          style={{
            marginTop: 8,
            width: '100%',
            padding: '15px',
            background: ready ? NAVY : '#C5CCDB',
            border: 'none',
            borderRadius: 14,
            color: ready ? YELLOW : 'white',
            fontSize: 15, fontWeight: 700,
            cursor: ready ? 'pointer' : 'not-allowed',
            letterSpacing: 0.3,
            fontFamily: 'inherit',
            boxShadow: ready ? '0 8px 20px rgba(10,31,68,0.25)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          Vardiyaya başla
        </button>

        <div style={{
          textAlign: 'center', fontSize: 13, color: TEXT_MUTED,
          marginTop: 4,
        }}>
          PIN'ini mi unuttun? <span style={{ color: NAVY_ACCENT, fontWeight: 600 }}>Yardım al</span>
        </div>
      </div>
    </div>
  );
}

window.LoginScreen = LoginScreen;
