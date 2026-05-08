// Taksi - kullanıcı tarafından sağlanan PNG görseli
function TaxiIllustration({ width = 300, height = 220 }) {
  return (
    <img
      src="assets/taxi.png"
      alt="Sarı taksi"
      style={{
        width,
        height: 'auto',
        maxHeight: height,
        display: 'block',
        objectFit: 'contain',
        filter: 'drop-shadow(0 12px 20px rgba(0,0,0,0.35))',
      }}
    />
  );
}

function _TaxiIllustration_unused({ width = 300, height = 220 }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 400 290"
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bodyT" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE066" />
          <stop offset="45%" stopColor="#F5B400" />
          <stop offset="100%" stopColor="#B07700" />
        </linearGradient>
        <linearGradient id="hoodHL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF1A0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <linearGradient id="bumperG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3a3a" />
          <stop offset="100%" stopColor="#0d0d0d" />
        </linearGradient>
        <linearGradient id="wsG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2D4664" />
          <stop offset="55%" stopColor="#7A98B8" />
          <stop offset="100%" stopColor="#C5D6E6" />
        </linearGradient>
        <radialGradient id="hlG" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#FFF6C8" />
          <stop offset="100%" stopColor="#C99A1F" />
        </radialGradient>
        <radialGradient id="drlG" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#E8F6FF" />
          <stop offset="60%" stopColor="#9DDCFF" />
          <stop offset="100%" stopColor="#1F6FA5" />
        </radialGradient>
        <linearGradient id="tireG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
      </defs>

      {/* yer gölgesi - geniş */}
      <ellipse cx="200" cy="270" rx="170" ry="11" fill="rgba(0,0,0,0.32)" />

      {/* === TAXI levhası === */}
      <rect x="172" y="40" width="3.5" height="12" fill="#0d0d0d" />
      <rect x="224" y="40" width="3.5" height="12" fill="#0d0d0d" />
      <rect x="148" y="14" width="104" height="28" rx="4" fill="#FFFFFF" stroke="#0d0d0d" strokeWidth="1.8" />
      <rect x="148" y="14" width="104" height="6" fill="#F5B400" opacity="0.4" />
      <text
        x="200"
        y="35"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="17"
        fontWeight="900"
        fill="#0d0d0d"
        letterSpacing="3"
      >
        TAXI
      </text>

      {/* === ÇATI / TAVAN === */}
      {/* daha geniş kabin için tavan da geniş */}
      <path
        d="M82 96
           Q200 72 318 96
           L312 116
           L88 116
           Z"
        fill="url(#bodyT)"
      />
      {/* tavan üst highlight */}
      <path
        d="M92 92
           Q200 78 308 92
           L304 100
           L96 100
           Z"
        fill="rgba(255,255,255,0.35)"
      />

      {/* === ÖN CAM ÇERÇEVESİ === */}
      <path
        d="M76 116
           L324 116
           L308 188
           L92 188
           Z"
        fill="#0d0d0d"
      />
      {/* ön cam (geniş, yolcuların daha rahat görüldüğü) */}
      <path
        d="M88 122
           L312 122
           L298 182
           L102 182
           Z"
        fill="url(#wsG)"
      />
      {/* cam içi yansıma şeritleri */}
      <path d="M96 124 L130 124 L114 178 L102 178 Z" fill="rgba(255,255,255,0.18)" />
      <path d="M286 124 L308 124 L300 158 L278 158 Z" fill="rgba(255,255,255,0.12)" />

      {/* === Cam orta direği (A-pillar) === */}
      <rect x="198.5" y="122" width="3" height="60" fill="#0d0d0d" opacity="0.55" />

      {/* === YOLCU (sol koltuk) === */}
      <g>
        {/* koltuk arkası gölge */}
        <path d="M112 184 L182 184 L174 152 Q150 144 122 152 Z"
          fill="rgba(0,0,0,0.25)" />
        {/* gövde - daha küçük ve mesafeli (geniş kabin hissi) */}
        <path d="M132 180 Q133 154 152 154 Q171 154 172 180 Z" fill="#264870" />
        {/* yaka */}
        <path d="M144 154 L152 161 L160 154 L156 170 L148 170 Z" fill="#FFFFFF" />
        <path d="M152 161 L149 170 L155 170 Z" fill="#C13A3A" />
        {/* baş */}
        <ellipse cx="152" cy="142" rx="10.5" ry="11.5" fill="#E8B894" />
        {/* saç */}
        <path d="M141 140 Q141 128 152 127 Q163 128 163 140 L161 137 Q156 132 152 134 Q147 132 143 137 Z"
          fill="#3C2A18" />
        <ellipse cx="142" cy="144" rx="1.2" ry="2" fill="#C99270" />
        {/* gözler / hat soft */}
        <ellipse cx="148.5" cy="142" rx="0.9" ry="1.2" fill="#1a1a1a" />
        <ellipse cx="155.5" cy="142" rx="0.9" ry="1.2" fill="#1a1a1a" />
      </g>

      {/* === ŞOFÖR (sağ koltuk) === */}
      <g>
        <path d="M218 184 L288 184 L280 152 Q256 144 228 152 Z"
          fill="rgba(0,0,0,0.25)" />
        {/* gövde */}
        <path d="M228 180 Q229 154 248 154 Q267 154 268 180 Z" fill="#2a2a2a" />
        {/* yaka açık gri */}
        <path d="M240 154 L248 161 L256 154 L252 170 L244 170 Z" fill="#D8D8D8" />
        {/* baş */}
        <ellipse cx="248" cy="142" rx="10.5" ry="11.5" fill="#E8B894" />
        {/* saç dağınık */}
        <path d="M237 140 Q237 126 248 125 Q259 126 259 140 L257 148 Q254 144 248 144 Q242 144 239 148 Z"
          fill="#4A3520" />
        {/* sakal */}
        <path d="M242 147 Q248 152 254 147 L254 150 Q248 154 242 150 Z" fill="#3A2A18" />
        {/* gözler */}
        <ellipse cx="244.5" cy="142" rx="0.9" ry="1.2" fill="#1a1a1a" />
        <ellipse cx="251.5" cy="142" rx="0.9" ry="1.2" fill="#1a1a1a" />
        {/* direksiyon */}
        <ellipse cx="248" cy="178" rx="14" ry="3.5" fill="none" stroke="#0d0d0d" strokeWidth="2" />
        <circle cx="248" cy="177" r="2" fill="#0d0d0d" />
        {/* eller direksiyonda */}
        <ellipse cx="236" cy="177" rx="3" ry="2.2" fill="#E8B894" />
        <ellipse cx="260" cy="177" rx="3" ry="2.2" fill="#E8B894" />
      </g>

      {/* === ANA GÖVDE (kaput + ön panel) === */}
      <path
        d="M40 188
           L62 180
           L102 178
           L298 178
           L338 180
           L360 188
           L376 220
           L376 250
           L24 250
           L24 220
           Z"
        fill="url(#bodyT)"
      />
      {/* kaput üst highlight şerit */}
      <path
        d="M50 188 L350 188 L338 206 L62 206 Z"
        fill="url(#hoodHL)"
        opacity="0.85"
      />
      {/* gövde alt vurgu */}
      <path d="M24 232 L376 232" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" />

      {/* yan aynalar */}
      <g>
        <path d="M40 184 L52 178 L52 192 L40 196 Z" fill="url(#bodyT)" stroke="#0d0d0d" strokeWidth="1.2" />
        <ellipse cx="46" cy="187" rx="3" ry="4" fill="#3F5C7E" />
      </g>
      <g>
        <path d="M360 184 L348 178 L348 192 L360 196 Z" fill="url(#bodyT)" stroke="#0d0d0d" strokeWidth="1.2" />
        <ellipse cx="354" cy="187" rx="3" ry="4" fill="#3F5C7E" />
      </g>

      {/* === IZGARA === */}
      <rect x="148" y="206" width="104" height="22" rx="3" fill="#0d0d0d" />
      <rect x="152" y="210" width="96" height="1.5" fill="#3a3a3a" />
      <rect x="152" y="215" width="96" height="1.5" fill="#3a3a3a" />
      <rect x="152" y="220" width="96" height="1.5" fill="#3a3a3a" />
      {/* logo plakası ortada */}
      <rect x="192" y="212" width="16" height="10" rx="1.5" fill="#F5B400" />

      {/* === FARLAR === */}
      {/* sol */}
      <path d="M36 200 L138 200 L130 230 L46 230 Z" fill="#0d0d0d" />
      <ellipse cx="86" cy="214" rx="38" ry="11" fill="url(#drlG)" opacity="0.95" />
      <ellipse cx="74" cy="210" rx="8" ry="3.5" fill="#FFFFFF" opacity="0.75" />
      {/* sağ */}
      <path d="M262 200 L364 200 L354 230 L270 230 Z" fill="#0d0d0d" />
      <ellipse cx="314" cy="214" rx="38" ry="11" fill="url(#drlG)" opacity="0.95" />
      <ellipse cx="302" cy="210" rx="8" ry="3.5" fill="#FFFFFF" opacity="0.75" />

      {/* === TAMPON === */}
      <path d="M16 240 L384 240 L376 266 L24 266 Z" fill="url(#bumperG)" />
      <path d="M18 246 L382 246" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {/* sis farları */}
      <ellipse cx="60" cy="252" rx="11" ry="5" fill="url(#hlG)" />
      <ellipse cx="340" cy="252" rx="11" ry="5" fill="url(#hlG)" />

      {/* PLAKA */}
      <rect x="166" y="246" width="68" height="16" rx="2" fill="#FFFFFF" stroke="#0d0d0d" strokeWidth="1" />
      <text
        x="200"
        y="258"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="10"
        fontWeight="800"
        fill="#0d0d0d"
        letterSpacing="0.6"
      >
        34 ABC 123
      </text>

      {/* === TEKERLEKLER === */}
      {/* sol */}
      <ellipse cx="60" cy="266" rx="22" ry="7" fill="rgba(0,0,0,0.45)" />
      <rect x="40" y="244" width="40" height="22" rx="4" fill="url(#tireG)" />
      <ellipse cx="60" cy="262" rx="6" ry="3" fill="#3a3a3a" />
      {/* sağ */}
      <ellipse cx="340" cy="266" rx="22" ry="7" fill="rgba(0,0,0,0.45)" />
      <rect x="320" y="244" width="40" height="22" rx="4" fill="url(#tireG)" />
      <ellipse cx="340" cy="262" rx="6" ry="3" fill="#3a3a3a" />

      {/* TAXI yan sticker - kapı üstünde küçük damalı şerit */}
      <g opacity="0.85">
        {[0,1,2,3,4,5,6,7].map(i => (
          <rect key={i}
            x={108 + i * 22} y={224}
            width="11" height="6"
            fill={i % 2 === 0 ? '#0d0d0d' : '#FFFFFF'}
          />
        ))}
      </g>
    </svg>
  );
}

window.TaxiIllustration = TaxiIllustration;
