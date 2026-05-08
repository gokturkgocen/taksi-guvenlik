// Detaylı log ekranı - yolculuk bazlı, anonim yolcular
// Sadece "şüpheli" durumda kameradan çekilmiş yüz görseli görünür

function LogsScreen() {
  const [filter, setFilter] = React.useState('all'); // all | clean | flagged
  const [search, setSearch] = React.useState('');

  const filtered = SAMPLE_LOGS.filter(log => {
    if (filter !== 'all' && log.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!log.pickup.toLowerCase().includes(q) &&
          !log.dropoff.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const grouped = filtered.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date].push(log);
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, overflow: 'auto', background: SURFACE }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, #0A1F44 0%, #16306B 100%)',
        padding: '60px 24px 20px',
        color: 'white',
      }}>
        <div style={{ fontSize: 12, opacity: 0.65, fontWeight: 500, letterSpacing: 0.5 }}>
          GEÇMİŞ
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
          Yolculuk Kayıtları
        </div>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
          {SAMPLE_LOGS.length} yolculuk · son 7 gün
        </div>

        <div style={{
          marginTop: 18,
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 12,
          padding: '11px 14px',
          color: 'rgba(255,255,255,0.7)',
        }}>
          <Icon.Search size={16} />
          <input
            type="text"
            placeholder="Konuma göre ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              color: 'white', fontSize: 14, outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Filtre chip'ler */}
      <div style={{
        display: 'flex', gap: 8, padding: '14px 20px',
        overflowX: 'auto', flexWrap: 'nowrap',
        background: '#FFFFFF',
        borderBottom: '1px solid #EEF1F7',
      }}>
        {[
          { id: 'all', label: 'Tümü', count: SAMPLE_LOGS.length },
          { id: 'clean', label: 'Temiz', count: SAMPLE_LOGS.filter(l => l.status === 'clean').length },
          { id: 'flagged', label: 'Şüpheli', count: SAMPLE_LOGS.filter(l => l.status === 'flagged').length },
        ].map(f => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '7px 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid ' + (active ? NAVY : '#E0E5EE'),
              background: active ? NAVY : 'transparent',
              color: active ? 'white' : NAVY,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
            }}>
              {f.label} <span style={{
                opacity: active ? 0.7 : 0.5,
                marginLeft: 4,
              }}>{f.count}</span>
            </button>
          );
        })}
      </div>

      {/* Liste */}
      <div style={{ padding: '8px 16px 100px' }}>
        {Object.entries(grouped).map(([date, logs]) => (
          <div key={date} style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: TEXT_MUTED,
              letterSpacing: 0.8, textTransform: 'uppercase',
              padding: '0 8px 8px',
            }}>
              {date}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {logs.map((log) => (
                <TripLogCard key={log.id} log={log} />
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: TEXT_MUTED, fontSize: 14,
          }}>
            Eşleşen yolculuk bulunamadı
          </div>
        )}
      </div>
    </div>
  );
}

// Şüpheli yolcu için sahte kamera yakalaması
function FlaggedFaceThumb() {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 10,
      background: 'linear-gradient(135deg, #1a2540 0%, #0a1628 100%)',
      flexShrink: 0,
      overflow: 'hidden',
      position: 'relative',
      border: '2px solid ' + WARN_RED,
    }}>
      {/* Yüz silueti */}
      <svg viewBox="0 0 56 56" style={{ width: '100%', height: '100%', display: 'block' }}>
        <ellipse cx="28" cy="22" rx="11" ry="13" fill="rgba(232,184,148,0.7)" />
        <path d="M17 20 Q17 10 28 9 Q39 10 39 20 L37 18 Q32 14 28 16 Q24 14 19 18 Z" fill="rgba(40,30,18,0.85)" />
        <ellipse cx="24" cy="22" rx="1.2" ry="1.6" fill="rgba(20,15,10,0.9)" />
        <ellipse cx="32" cy="22" rx="1.2" ry="1.6" fill="rgba(20,15,10,0.9)" />
        <path d="M25 28 Q28 30 31 28" stroke="rgba(20,15,10,0.7)" strokeWidth="1" fill="none" />
        <path d="M14 50 Q14 38 28 36 Q42 38 42 50 Z" fill="rgba(40,60,90,0.85)" />
      </svg>
      {/* "ŞÜPHELİ" ikonu badge */}
      <div style={{
        position: 'absolute', bottom: -2, right: -2,
        width: 20, height: 20, borderRadius: '50%',
        background: WARN_RED, color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '2px solid white',
      }}>
        <Icon.ShieldAlert size={11} />
      </div>
    </div>
  );
}

// Anonim yolcu - hiçbir görsel yok, sadece nötr kutu
function AnonPassengerThumb() {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 10,
      background: SURFACE,
      border: '1px dashed #C8D0DE',
      flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#A0AAC2',
      fontSize: 9, fontWeight: 700,
      letterSpacing: 0.5,
      textAlign: 'center',
      lineHeight: 1.2,
    }}>
      ANONİM
    </div>
  );
}

function TripLogCard({ log }) {
  const meta = STATUS_META[log.status];
  const flagged = log.status === 'flagged';

  return (
    <div style={{
      background: 'white',
      borderRadius: 14,
      border: flagged
        ? '1px solid rgba(199,66,58,0.35)'
        : '1px solid #EEF1F7',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px', display: 'flex', gap: 12 }}>
        {flagged ? <FlaggedFaceThumb /> : <AnonPassengerThumb />}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: NAVY,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Icon.Clock size={12} />
              {log.pickupTime} – {log.dropoffTime}
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700, padding: '3px 7px',
              borderRadius: 5, background: meta.bg, color: meta.color,
              letterSpacing: 0.4, flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {flagged && <Icon.ShieldAlert size={10} />}
              {meta.label.toUpperCase()}
            </div>
          </div>

          {/* Konumlar - biniş -> iniş */}
          <div style={{
            marginTop: 10,
            display: 'flex', flexDirection: 'column', gap: 6,
            position: 'relative',
          }}>
            <RoutePoint icon="up" label="Biniş" location={log.pickup} />
            {/* dikey çizgi */}
            <div style={{
              position: 'absolute',
              left: 5.5, top: 14, bottom: 14,
              width: 1.5, borderLeft: '1.5px dotted #C8D0DE',
            }} />
            <RoutePoint icon="down" label="İniş" location={log.dropoff} />
          </div>

          {/* Alt bilgi - güven skoru */}
          <div style={{
            marginTop: 10, paddingTop: 10,
            borderTop: '1px solid #F2F4F9',
            display: 'flex', alignItems: 'center', gap: 12,
            fontSize: 11, color: TEXT_MUTED, fontWeight: 600,
          }}>
            <span>Güven %{log.confidence}</span>
            {flagged && (
              <span style={{
                color: WARN_RED, display: 'flex', alignItems: 'center', gap: 4,
                fontWeight: 700,
              }}>
                · {log.flagReason}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoutePoint({ icon, label, location }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 12, height: 12, borderRadius: '50%',
        background: icon === 'up' ? OK_GREEN : NAVY,
        border: '2px solid white',
        boxShadow: '0 0 0 1.5px ' + (icon === 'up' ? OK_GREEN : NAVY),
        flexShrink: 0,
      }} />
      <div style={{
        fontSize: 12, color: TEXT_MUTED, fontWeight: 500,
        marginRight: 4,
      }}>
        {label}:
      </div>
      <div style={{
        fontSize: 13, color: NAVY, fontWeight: 600,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1, minWidth: 0,
      }}>
        {location}
      </div>
    </div>
  );
}

window.LogsScreen = LogsScreen;
window.TripLogCard = TripLogCard;
window.FlaggedFaceThumb = FlaggedFaceThumb;
window.AnonPassengerThumb = AnonPassengerThumb;
