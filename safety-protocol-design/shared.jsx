// Ortak UI parçaları + ikonlar + sahte log verisi
// MODEL: Yolcular anonim. Sadece şüpheli (aranan kişi eşleşmesi) durumunda
// kameradan çekilen görsel saklanır. Her log = bir yolculuk (biniş + iniş + konum + güven).

const NAVY = '#0A1F44';
const NAVY2 = '#16306B';
const NAVY_ACCENT = '#1B3A6B';
const SURFACE = '#F4F6FB';
const TEXT_MUTED = '#6B7A99';
const YELLOW = '#FFD43A';

const OK_GREEN = '#1F8A55';
const WARN_RED = '#C7423A';

// === İkonlar ===
const Icon = {
  Plate: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <line x1="7" y1="10" x2="7" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="11" y1="10" x2="11" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="15" y1="10" x2="15" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  User: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  Lock: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="1.3" fill="currentColor" />
    </svg>
  ),
  Camera: ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  Logs: ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8" y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  Settings: ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  TaxiMini: ({ size = 26, color }) => {
    // Yandan görünüm - modern, detaylı taksi ikonu
    const main = color || 'currentColor';
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        {/* TAXI tepe levhası */}
        <rect x="16" y="3" width="9" height="3.5" rx="0.6" fill={main} stroke={main} strokeWidth="0.6" />
        <line x1="18" y1="6.5" x2="18" y2="9" stroke={main} strokeWidth="0.8" />
        <line x1="23" y1="6.5" x2="23" y2="9" stroke={main} strokeWidth="0.8" />

        {/* Üst kabin (cam çerçevesi) */}
        <path
          d="M11 18 L13 10 Q13.5 8.5 15 8.5 L29 8.5 Q30.5 8.5 31 10 L33 18 Z"
          fill={main}
        />
        {/* Ön cam */}
        <path
          d="M14 17 L15.2 11.5 Q15.4 10.5 16 10.5 L21 10.5 L21 17 Z"
          fill="rgba(255,255,255,0.55)"
        />
        {/* Arka cam */}
        <path
          d="M30 17 L28.8 11.5 Q28.6 10.5 28 10.5 L23 10.5 L23 17 Z"
          fill="rgba(255,255,255,0.55)"
        />
        {/* B-pillar */}
        <rect x="21.4" y="10.5" width="1.2" height="6.5" fill="rgba(0,0,0,0.25)" />

        {/* Ana gövde */}
        <path
          d="M5 27 L5 22 Q5 21 6 20.5 L9 19 L35 19 L37 20.5 Q38 21 38 22 L38 27 Q38 28 37 28 L34 28 L33 28 Q32.5 25.5 30 25.5 Q27.5 25.5 27 28 L16 28 Q15.5 25.5 13 25.5 Q10.5 25.5 10 28 L9 28 L6 28 Q5 28 5 27 Z"
          fill={main}
        />

        {/* Damalı yan şerit */}
        <g>
          <rect x="12" y="20.8" width="1.4" height="1.4" fill="rgba(0,0,0,0.85)" />
          <rect x="14.8" y="20.8" width="1.4" height="1.4" fill="rgba(0,0,0,0.85)" />
          <rect x="17.6" y="20.8" width="1.4" height="1.4" fill="rgba(0,0,0,0.85)" />
          <rect x="20.4" y="20.8" width="1.4" height="1.4" fill="rgba(0,0,0,0.85)" />
          <rect x="23.2" y="20.8" width="1.4" height="1.4" fill="rgba(0,0,0,0.85)" />
          <rect x="26" y="20.8" width="1.4" height="1.4" fill="rgba(0,0,0,0.85)" />
          <rect x="28.8" y="20.8" width="1.4" height="1.4" fill="rgba(0,0,0,0.85)" />
        </g>

        {/* Ön far - parlak */}
        <circle cx="36.5" cy="22" r="1" fill="rgba(255,255,255,0.95)" />
        {/* Arka stop lamba */}
        <rect x="5.5" y="21.5" width="1.5" height="2" rx="0.3" fill="rgba(0,0,0,0.5)" />

        {/* Tekerlekler - dış */}
        <circle cx="13" cy="29" r="3.5" fill="#0d0d0d" />
        <circle cx="30" cy="29" r="3.5" fill="#0d0d0d" />
        {/* jant */}
        <circle cx="13" cy="29" r="1.5" fill="rgba(255,255,255,0.85)" />
        <circle cx="30" cy="29" r="1.5" fill="rgba(255,255,255,0.85)" />
        <circle cx="13" cy="29" r="0.6" fill={main} />
        <circle cx="30" cy="29" r="0.6" fill={main} />
      </svg>
    );
  },
  ChevronRight: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Check: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  X: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  Search: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <line x1="16" y1="16" x2="20" y2="20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  Clock: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  Bell: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 8a6 6 0 1112 0v5l2 3H4l2-3V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  Logout: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 8l-4 4 4 4M6 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Pin: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 22s7-7.5 7-13a7 7 0 10-14 0c0 5.5 7 13 7 13z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  ArrowDownRight: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 7v10h10M7 7l10 10" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ShieldAlert: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  ),
};

// === Sahte yolculuk verisi ===
// Her log = bir yolculuk: biniş + iniş zamanı, biniş ve iniş konumu, güven skoru, durum
// status: 'clean' (temiz, anonim) | 'flagged' (şüpheli - aranan kişi eşleşmesi)
const SAMPLE_LOGS = [
  { id: 1, pickupTime: '14:23', dropoffTime: '14:51', date: '04 May 2026',
    pickup: 'Beşiktaş, İstanbul', dropoff: 'Şişli, İstanbul',
    status: 'clean', confidence: 96 },
  { id: 2, pickupTime: '13:41', dropoffTime: '14:08', date: '04 May 2026',
    pickup: 'Kadıköy, İstanbul', dropoff: 'Beşiktaş, İstanbul',
    status: 'clean', confidence: 91 },
  { id: 3, pickupTime: '12:55', dropoffTime: '13:18', date: '04 May 2026',
    pickup: 'Levent, İstanbul', dropoff: 'Maslak, İstanbul',
    status: 'flagged', confidence: 87,
    flagReason: 'Interpol kırmızı bülten eşleşmesi' },
  { id: 4, pickupTime: '11:14', dropoffTime: '11:32', date: '04 May 2026',
    pickup: 'Mecidiyeköy, İstanbul', dropoff: 'Nişantaşı, İstanbul',
    status: 'clean', confidence: 94 },
  { id: 5, pickupTime: '10:08', dropoffTime: '10:47', date: '04 May 2026',
    pickup: 'Bakırköy, İstanbul', dropoff: 'Beşiktaş, İstanbul',
    status: 'clean', confidence: 93 },
  { id: 6, pickupTime: '22:48', dropoffTime: '23:15', date: '03 May 2026',
    pickup: 'Taksim, İstanbul', dropoff: 'Sarıyer, İstanbul',
    status: 'flagged', confidence: 82,
    flagReason: 'Yerel kolluk arananlar listesi' },
  { id: 7, pickupTime: '20:12', dropoffTime: '20:38', date: '03 May 2026',
    pickup: 'Ortaköy, İstanbul', dropoff: 'Beyoğlu, İstanbul',
    status: 'clean', confidence: 89 },
  { id: 8, pickupTime: '18:34', dropoffTime: '19:02', date: '03 May 2026',
    pickup: 'Ataşehir, İstanbul', dropoff: 'Üsküdar, İstanbul',
    status: 'clean', confidence: 95 },
  { id: 9, pickupTime: '16:21', dropoffTime: '16:54', date: '03 May 2026',
    pickup: 'Bahçelievler, İstanbul', dropoff: 'Levent, İstanbul',
    status: 'clean', confidence: 88 },
];

const STATUS_META = {
  clean: { label: 'Temiz', color: OK_GREEN, bg: 'rgba(31,138,85,0.10)' },
  flagged: { label: 'Şüpheli', color: WARN_RED, bg: 'rgba(199,66,58,0.10)' },
};

Object.assign(window, {
  NAVY, NAVY2, NAVY_ACCENT, SURFACE, TEXT_MUTED, YELLOW, OK_GREEN, WARN_RED,
  Icon, SAMPLE_LOGS, STATUS_META,
});
