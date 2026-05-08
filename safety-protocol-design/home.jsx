// Ana ekran - canlı kamera + son yolculuk özetleri (anonim)

function CameraView() {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '4 / 3',
      background: 'linear-gradient(135deg, #1a2540 0%, #0a1628 100%)',
      borderRadius: 18,
      overflow: 'hidden',
      boxShadow: '0 8px 24px rgba(10,31,68,0.18)',
    }}>
      {/* Sahte taksi içi arka plan */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(ellipse at 30% 60%, rgba(80,100,140,0.4) 0%, transparent 50%),' +
          'radial-gradient(ellipse at 75% 30%, rgba(60,80,120,0.3) 0%, transparent 60%)',
      }} />

      {/* Yolcu silueti */}
      <svg viewBox="0 0 400 300" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <path d="M120 300 Q120 220 200 200 Q280 220 280 300 Z" fill="rgba(40,60,90,0.7)" />
        <ellipse cx="200" cy="160" rx="44" ry="50" fill="rgba(232,184,148,0.85)" />
        <path d="M156 150 Q156 110 200 108 Q244 110 244 150 L240 142 Q220 134 200 138 Q180 134 160 142 Z"
          fill="rgba(60,42,24,0.85)" />
        <ellipse cx="186" cy="158" rx="3.5" ry="4.5" fill="rgba(40,30,20,0.7)" />
        <ellipse cx="214" cy="158" rx="3.5" ry="4.5" fill="rgba(40,30,20,0.7)" />
        <path d="M192 178 Q200 184 208 178" stroke="rgba(40,30,20,0.6)" strokeWidth="2" fill="none" />
      </svg>

      {/* Yüz tanıma çerçevesi */}
      <div style={{
        position: 'absolute',
        left: '32%', top: '28%', width: '36%', height: '46%',
        pointerEvents: 'none',
      }}>
        {[
          { top: 0, left: 0, borderTop: 3, borderLeft: 3 },
          { top: 0, right: 0, borderTop: 3, borderRight: 3 },
          { bottom: 0, left: 0, borderBottom: 3, borderLeft: 3 },
          { bottom: 0, right: 0, borderBottom: 3, borderRight: 3 },
        ].map((c, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: 20, height: 20,
            borderColor: YELLOW,
            borderStyle: 'solid',
            borderWidth: 0,
            borderTopWidth: c.borderTop || 0,
            borderLeftWidth: c.borderLeft || 0,
            borderRightWidth: c.borderRight || 0,
            borderBottomWidth: c.borderBottom || 0,
            top: c.top, bottom: c.bottom, left: c.left, right: c.right,
          }} />
        ))}
      </div>

      {/* CANLI rozeti */}
      <div style={{
        position: 'absolute', top: 12, left: 12,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px',
        background: 'rgba(199,66,58,0.95)',
        borderRadius: 6,
        color: 'white',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.8,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: 'white',
          animation: 'pulse 1.4s ease-in-out infinite',
        }} />
        CANLI
      </div>

      {/* Konum rozeti (üst sağ) */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 10px',
        background: 'rgba(10,22,40,0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        borderRadius: 6,
        color: 'white',
        fontSize: 11,
        fontWeight: 600,
      }}>
        <Icon.Pin size={11} />
        Beşiktaş
      </div>

      {/* Tarama durumu - alt */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, right: 12,
        background: 'rgba(10,22,40,0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: 12,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: 'white',
      }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 500, letterSpacing: 0.5 }}>
            DURUM
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
            Yolcu taranıyor…
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: 'rgba(31,138,85,0.25)',
          border: '1px solid rgba(31,138,85,0.5)',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          color: '#7AE0A8',
        }}>
          <Icon.Check size={13} />
          Temiz
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}

// Mini log satırı - ana ekran özet
function MiniLogRow({ log, isLast }) {
  const meta = STATUS_META[log.status];
  const flagged = log.status === 'flagged';
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 4px',
      borderBottom: isLast ? 'none' : '1px solid #EEF1F7',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: meta.bg,
        color: meta.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {flagged ? <Icon.ShieldAlert size={18} /> : <Icon.Check size={18} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: NAVY,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {log.pickupTime} <span style={{ color: TEXT_MUTED, fontWeight: 500 }}>→</span> {log.dropoffTime}
        </div>
        <div style={{
          fontSize: 11.5, color: TEXT_MUTED, marginTop: 2,
          display: 'flex', alignItems: 'center', gap: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <Icon.Pin size={10} />
          <span style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {log.pickup.split(',')[0]} → {log.dropoff.split(',')[0]}
          </span>
        </div>
      </div>
      <div style={{
        fontSize: 10, fontWeight: 700, padding: '4px 8px',
        borderRadius: 6, background: meta.bg, color: meta.color,
        letterSpacing: 0.4, flexShrink: 0,
      }}>
        {meta.label.toUpperCase()}
      </div>
    </div>
  );
}

function HomeScreen({ onGoToLogs }) {
  const recent = SAMPLE_LOGS.slice(0, 3);
  const todayCount = SAMPLE_LOGS.filter(l => l.date === '04 May 2026').length;
  const todayClean = SAMPLE_LOGS.filter(l => l.date === '04 May 2026' && l.status === 'clean').length;
  const todayFlagged = SAMPLE_LOGS.filter(l => l.date === '04 May 2026' && l.status === 'flagged').length;

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#FFFFFF' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, #0A1F44 0%, #16306B 100%)',
        padding: '60px 24px 24px',
        color: '#FFFFFF',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.65, fontWeight: 500, letterSpacing: 0.5 }}>
              VARDİYA AKTİF
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
              Merhaba, Ahmet
            </div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Icon.Pin size={11} />
              Beşiktaş, İstanbul · 6 sa 12 dk
            </div>
          </div>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', position: 'relative',
          }}>
            <Icon.Bell />
            <div style={{
              position: 'absolute', top: 8, right: 9,
              width: 8, height: 8, borderRadius: '50%', background: WARN_RED,
              border: '1.5px solid #16306B',
            }} />
          </div>
        </div>

        {/* Hızlı stat kartları */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <StatCard label="Bugün yolculuk" value={String(todayCount)} />
          <StatCard label="Temiz" value={String(todayClean)} accent="#7AE0A8" />
          <StatCard label="Şüpheli" value={String(todayFlagged)} accent={todayFlagged > 0 ? '#FF8A82' : 'white'} />
        </div>
      </div>

      {/* Canlı kamera */}
      <div style={{ padding: '24px 20px 12px' }}>
        <SectionHeader title="Canlı Kamera" />
        <div style={{ marginTop: 12 }}>
          <CameraView />
        </div>
      </div>

      {/* Son yolculuklar */}
      <div style={{ padding: '20px 20px 100px' }}>
        <SectionHeader
          title="Son Yolculuklar"
          action="Tümünü gör"
          onAction={onGoToLogs}
        />
        <div style={{
          marginTop: 8,
          background: 'white',
          borderRadius: 14,
          padding: '4px 14px',
          border: '1px solid #EEF1F7',
        }}>
          {recent.map((log, i) => (
            <MiniLogRow key={log.id} log={log} isLast={i === recent.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{
      flex: 1,
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 12,
      padding: '12px 12px',
    }}>
      <div style={{
        fontSize: 22, fontWeight: 700, color: accent || 'white',
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 11, color: 'rgba(255,255,255,0.6)',
        marginTop: 6, fontWeight: 500, letterSpacing: 0.3,
      }}>
        {label}
      </div>
    </div>
  );
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: NAVY, letterSpacing: -0.2 }}>
        {title}
      </div>
      {action && (
        <button onClick={onAction} style={{
          border: 'none', background: 'transparent',
          color: NAVY_ACCENT, fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 4,
          cursor: 'pointer', padding: 0,
          fontFamily: 'inherit',
        }}>
          {action} <Icon.ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

window.HomeScreen = HomeScreen;
