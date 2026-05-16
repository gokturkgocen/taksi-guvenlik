// Ekin Ağaoğlu — Bitirme Sunumu (21 slayt, Türkçe)
// Çıktı: face-mac/docs/sunum/sunum.pptx
// Renk paleti: ink/paper/accent/signal — tez & Beamer ile tutarlı

const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";  // 10" × 5.625"
pres.author = "Ekin Ağaoğlu";
pres.company = "Ege Üniversitesi · Elektrik-Elektronik Mühendisliği";
pres.title = "Yüz Tanıma Tabanlı Sürücü Güvenlik ve Acil Durum Bildirim Sistemi";

// ---- palet ----
const C = {
    ink:     "11162A",  // koyu lacivert
    inkSoft: "2A3047",
    paper:   "F1ECE0",  // krem
    paper2:  "E7E0CC",
    accent:  "8C631A",  // altın
    accent2: "B8862B",
    signal:  "9C2A21",  // oxblood kırmızı
    mute:    "5B6075",
    line:    "C9C0AB",
    white:   "FFFFFF",
};
const F = { head: "Cambria", body: "Calibri", mono: "Consolas" };

// helper: footer + slide number on every slide
function addFooter(slide, n, total, sectionLabel) {
    slide.addText(`Ekin Ağaoğlu  ·  Bitirme Sunumu  ·  ${sectionLabel || ""}`, {
        x: 0.5, y: 5.2, w: 6.5, h: 0.3, fontSize: 9,
        color: C.mute, fontFace: F.body, margin: 0,
    });
    slide.addText(`${n} / ${total}`, {
        x: 8.8, y: 5.2, w: 0.8, h: 0.3, fontSize: 9,
        color: C.mute, fontFace: F.body, align: "right", margin: 0,
    });
    // sağ üst köşede ince accent
    slide.addShape(pres.shapes.RECTANGLE, {
        x: 9.7, y: 0, w: 0.3, h: 5.625,
        fill: { color: C.accent }, line: { type: "none" },
    });
}

function addTitle(slide, text, kicker) {
    if (kicker) {
        slide.addText(kicker.toUpperCase(), {
            x: 0.5, y: 0.35, w: 8, h: 0.3, fontSize: 10, charSpacing: 4,
            color: C.accent, fontFace: F.mono, bold: false, margin: 0,
        });
    }
    slide.addText(text, {
        x: 0.5, y: 0.65, w: 8.8, h: 0.7, fontSize: 28, bold: true,
        color: C.ink, fontFace: F.head, margin: 0,
    });
    // başlığın altında ince ayraç çizgi (accent rule etiketi değil, sade)
    slide.addShape(pres.shapes.LINE, {
        x: 0.5, y: 1.4, w: 1.0, h: 0,
        line: { color: C.accent, width: 2 },
    });
}

const TOTAL = 21;

// ============================================================================
// 1) KAPAK
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.ink };

    // sağ kenarda büyük dikey accent şerit
    s.addShape(pres.shapes.RECTANGLE, {
        x: 9.4, y: 0, w: 0.6, h: 5.625,
        fill: { color: C.accent }, line: { type: "none" },
    });

    // üst kısımda küçük kicker
    s.addText("LİSANS BİTİRME PROJESİ · 2025–2026", {
        x: 0.6, y: 0.5, w: 9, h: 0.4, fontSize: 11, charSpacing: 5,
        color: C.accent2, fontFace: F.mono, margin: 0,
    });

    s.addText("Yüz Tanıma Tabanlı", {
        x: 0.6, y: 1.4, w: 9, h: 0.7, fontSize: 36, bold: true,
        color: C.white, fontFace: F.head, margin: 0,
    });
    s.addText("Sürücü Güvenlik ve Acil Durum Bildirim Sistemi", {
        x: 0.6, y: 2.05, w: 9, h: 1.0, fontSize: 36, bold: true,
        color: C.white, fontFace: F.head, margin: 0,
    });
    s.addText("Driver Safety and Emergency Notification System Based on Facial Recognition", {
        x: 0.6, y: 3.05, w: 9, h: 0.45, fontSize: 14, italic: true,
        color: "B8B8C8", fontFace: F.head, margin: 0,
    });

    // ayraç
    s.addShape(pres.shapes.LINE, {
        x: 0.6, y: 3.7, w: 2, h: 0,
        line: { color: C.accent, width: 2 },
    });

    s.addText([
        { text: "Ekin Ağaoğlu", options: { fontSize: 16, bold: true, color: C.white, breakLine: true } },
        { text: "Danışman: Prof. Dr. Aydoğan Savran", options: { fontSize: 12, color: "B8B8C8", breakLine: true } },
        { text: "Ege Üniversitesi · Elektrik-Elektronik Mühendisliği Bölümü", options: { fontSize: 11, color: C.mute, breakLine: true } },
        { text: "", options: { fontSize: 10, breakLine: true } },
        { text: "Mayıs 2026", options: { fontSize: 11, color: C.accent2, fontFace: F.mono } },
    ], {
        x: 0.6, y: 3.95, w: 9, h: 1.4, fontFace: F.body, margin: 0,
    });
}

// ============================================================================
// 2) SUNUM AKIŞI
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Sunum Akışı", "Gündem");

    const items = [
        ["01", "Problem ve motivasyon"],
        ["02", "Literatür ve tasarım kararları"],
        ["03", "Sistem mimarisi ve veri akışı"],
        ["04", "Donanım ve yazılım gerçeklemesi"],
        ["05", "Sürücü uygulaması + kullanıcı yönetimi"],
        ["06", "Ölçüm planı ve sonuçlar"],
        ["07", "Sonuç ve gelecek çalışmalar"],
    ];

    items.forEach(([num, text], i) => {
        const y = 1.7 + i * 0.45;
        s.addText(num, {
            x: 0.5, y, w: 0.6, h: 0.4, fontSize: 14, bold: true,
            color: C.accent, fontFace: F.mono, margin: 0, valign: "middle",
        });
        s.addText(text, {
            x: 1.2, y, w: 7.5, h: 0.4, fontSize: 16,
            color: C.ink, fontFace: F.head, margin: 0, valign: "middle",
        });
    });

    addFooter(s, 2, TOTAL, "Sunum Akışı");
}

// ============================================================================
// 3) PROBLEM
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Taksilerde Sürücü Güvenliği", "Problem");

    // sol kolon: mevcut çözümlerin eksikleri
    s.addText("Mevcut çözümlerin eksikleri", {
        x: 0.5, y: 1.7, w: 4.3, h: 0.4, fontSize: 13, bold: true,
        color: C.signal, fontFace: F.head, margin: 0,
    });
    s.addText([
        { text: "Yolcu kimliği önceden doğrulanmıyor", options: { bullet: true, breakLine: true } },
        { text: "Panik buton + GPS olay sonrası bilgi", options: { bullet: true, breakLine: true } },
        { text: "Sürücünün aktif eylem gerektiren sistemler dikkat dağıtıcı", options: { bullet: true } },
    ], {
        x: 0.5, y: 2.15, w: 4.3, h: 2.5, fontSize: 13,
        color: C.ink, fontFace: F.body, paraSpaceAfter: 6, margin: 0,
    });

    // sağ kolon: iki temel ihtiyaç
    s.addShape(pres.shapes.RECTANGLE, {
        x: 5.2, y: 1.7, w: 4.0, h: 3.0,
        fill: { color: C.ink }, line: { type: "none" },
    });
    s.addText("İki temel ihtiyaç", {
        x: 5.4, y: 1.85, w: 3.6, h: 0.4, fontSize: 13, bold: true,
        color: C.accent2, fontFace: F.head, margin: 0,
    });
    s.addText([
        { text: "1", options: { fontSize: 28, bold: true, color: C.accent, fontFace: F.mono, breakLine: true } },
        { text: "Caydırıcı bir kimlik doğrulama altyapısı", options: { fontSize: 12, color: C.white, fontFace: F.body, breakLine: true } },
        { text: " ", options: { fontSize: 10, breakLine: true } },
        { text: "2", options: { fontSize: 28, bold: true, color: C.accent, fontFace: F.mono, breakLine: true } },
        { text: "Sürücünün dikkatini bozmayan otomatik bildirim", options: { fontSize: 12, color: C.white, fontFace: F.body } },
    ], {
        x: 5.4, y: 2.3, w: 3.6, h: 2.3, margin: 0,
    });

    addFooter(s, 3, TOTAL, "Problem");
}

// ============================================================================
// 4) TASARIM HEDEFLERİ
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Başarı Ölçütleri", "Tasarım Hedefleri");

    const rows = [
        ["Uçtan uca tanıma gecikmesi", "≤ 7 s", "10 karelik burst, Wi-Fi ≥ 10 Mbps"],
        ["Eşit Hata Oranı (EER)", "≤ 5 %", "küçültülmüş test seti üzerinde"],
        ["Aydınlatma aralığı", "100–600 lx", "alacakaranlık → gün ışığı"],
        ["Yolcu–kamera mesafesi", "30–120 cm", "yakın / orta / uzak"],
        ["Acil çağrı dialer açılma süresi", "≤ 3 s", "MATCH kararından itibaren"],
        ["Ek donanım maliyeti", "≤ 500 TL", "STM32 kartı hariç"],
    ];

    rows.forEach(([metric, target, note], i) => {
        const y = 1.65 + i * 0.55;
        // sol: metric
        s.addText(metric, {
            x: 0.5, y, w: 4.3, h: 0.5, fontSize: 13, bold: true,
            color: C.ink, fontFace: F.head, valign: "middle", margin: 0,
        });
        // orta: target (vurgu)
        s.addText(target, {
            x: 4.9, y, w: 1.6, h: 0.5, fontSize: 18, bold: true,
            color: C.signal, fontFace: F.mono, align: "left", valign: "middle", margin: 0,
        });
        // sağ: note (mute)
        s.addText(note, {
            x: 6.6, y, w: 3.0, h: 0.5, fontSize: 11, italic: true,
            color: C.mute, fontFace: F.body, valign: "middle", margin: 0,
        });
    });

    addFooter(s, 4, TOTAL, "Tasarım Hedefleri");
}

// ============================================================================
// 5) ARCFACE + INSIGHTFACE SEÇİMİ
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Yüz Tanıma: Yöntem Seçimi", "Literatür");

    // sol kolon: seçilen
    s.addShape(pres.shapes.RECTANGLE, {
        x: 0.5, y: 1.7, w: 4.4, h: 3.0,
        fill: { color: C.white }, line: { color: C.line, width: 1 },
    });
    s.addText("Seçilen", {
        x: 0.7, y: 1.85, w: 4.0, h: 0.3, fontSize: 10, charSpacing: 3, bold: true,
        color: C.accent, fontFace: F.mono, margin: 0,
    });
    s.addText("InsightFace buffalo_l", {
        x: 0.7, y: 2.15, w: 4.0, h: 0.45, fontSize: 18, bold: true,
        color: C.ink, fontFace: F.head, margin: 0,
    });
    s.addText([
        { text: "Açık kaynak (Apache 2)", options: { bullet: true, breakLine: true } },
        { text: "RetinaFace + ArcFace-R100 (Glint360K)", options: { bullet: true, breakLine: true } },
        { text: "512-D embedding, kosinüs benzerliği", options: { bullet: true, breakLine: true } },
        { text: "Model ve eşik bizim kontrolümüzde", options: { bullet: true, breakLine: true } },
        { text: "KVKK uyumu doğal: veri kendi sunucumuzda", options: { bullet: true } },
    ], {
        x: 0.7, y: 2.65, w: 4.0, h: 2.0, fontSize: 11,
        color: C.ink, fontFace: F.body, paraSpaceAfter: 4, margin: 0,
    });

    // sağ kolon: reddedilenler
    s.addShape(pres.shapes.RECTANGLE, {
        x: 5.1, y: 1.7, w: 4.4, h: 3.0,
        fill: { color: "EFE5D2" }, line: { color: C.line, width: 1 },
    });
    s.addText("Reddedilen", {
        x: 5.3, y: 1.85, w: 4.0, h: 0.3, fontSize: 10, charSpacing: 3, bold: true,
        color: C.signal, fontFace: F.mono, margin: 0,
    });
    s.addText("Kapalı kutu bulut API'ları", {
        x: 5.3, y: 2.15, w: 4.0, h: 0.45, fontSize: 18, bold: true,
        color: C.ink, fontFace: F.head, margin: 0,
    });
    s.addText([
        { text: "AWS Rekognition, Azure Face, Face++", options: { bullet: true, breakLine: true } },
        { text: "KVKK belirsizliği (veri yurt dışına)", options: { bullet: true, breakLine: true } },
        { text: "Eşik / model kontrolümüzde değil", options: { bullet: true, breakLine: true } },
        { text: "Fiyat değişikliği / kapatma riski", options: { bullet: true, breakLine: true } },
        { text: "FAR/FRR tezde dolgun savunma yok", options: { bullet: true } },
    ], {
        x: 5.3, y: 2.65, w: 4.0, h: 2.0, fontSize: 11,
        color: C.ink, fontFace: F.body, paraSpaceAfter: 4, margin: 0,
    });

    addFooter(s, 5, TOTAL, "Literatür");
}

// ============================================================================
// 6) TEK-SHOT vs MULTI-FRAME BURST
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Tek Snapshot vs. 10-Frame Burst", "Kararlar");

    // sol: tek-shot
    s.addShape(pres.shapes.RECTANGLE, {
        x: 0.5, y: 1.7, w: 4.4, h: 3.0,
        fill: { color: "EFE5D2" }, line: { color: C.line, width: 1 },
    });
    s.addText("Tek-shot", {
        x: 0.7, y: 1.85, w: 4.0, h: 0.4, fontSize: 16, bold: true,
        color: C.signal, fontFace: F.head, margin: 0,
    });
    s.addText([
        { text: "Hareket bulanıklığına duyarlı", options: { bullet: true, breakLine: true } },
        { text: "Kırpılan veya yan duran yüze duyarlı", options: { bullet: true, breakLine: true } },
        { text: "Tek ışık değişimi sonucu bozar", options: { bullet: true, breakLine: true } },
        { text: "Canlılık sinyali yok", options: { bullet: true, breakLine: true } },
        { text: "Photo replay saldırısına açık", options: { bullet: true } },
    ], {
        x: 0.7, y: 2.3, w: 4.0, h: 2.3, fontSize: 12,
        color: C.ink, fontFace: F.body, paraSpaceAfter: 5, margin: 0,
    });

    // sağ: burst
    s.addShape(pres.shapes.RECTANGLE, {
        x: 5.1, y: 1.7, w: 4.4, h: 3.0,
        fill: { color: C.white }, line: { color: C.accent, width: 2 },
    });
    s.addText("Seçilen: 10-frame burst", {
        x: 5.3, y: 1.85, w: 4.0, h: 0.4, fontSize: 16, bold: true,
        color: C.accent, fontFace: F.head, margin: 0,
    });
    s.addText([
        { text: "5 FPS × 2 s = 10 kare", options: { bullet: true, breakLine: true } },
        { text: "Per-frame kalite filtresi (det, alan, yaw, blur)", options: { bullet: true, breakLine: true } },
        { text: "Geçen kare ≥ 5 → embedding centroid", options: { bullet: true, breakLine: true } },
        { text: "Cross-frame σ → bedava pasif canlılık", options: { bullet: true, breakLine: true } },
        { text: "Maliyet: ~5–7 s gecikme, biniş başına bir kez", options: { bullet: true } },
    ], {
        x: 5.3, y: 2.3, w: 4.0, h: 2.3, fontSize: 12,
        color: C.ink, fontFace: F.body, paraSpaceAfter: 5, margin: 0,
    });

    addFooter(s, 6, TOTAL, "Kararlar");
}

// ============================================================================
// 7) BLE TELEFON vs GSM
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Acil Çağrı: BLE Köprü vs. GSM Modülü", "Kararlar");

    s.addShape(pres.shapes.RECTANGLE, {
        x: 0.5, y: 1.7, w: 4.4, h: 3.0,
        fill: { color: "EFE5D2" }, line: { color: C.line, width: 1 },
    });
    s.addText("GSM modülü (SIM800/7600)", {
        x: 0.7, y: 1.85, w: 4.0, h: 0.4, fontSize: 14, bold: true,
        color: C.signal, fontFace: F.head, margin: 0,
    });
    s.addText([
        { text: "+ Donanım maliyeti ≥ 250 TL", options: { bullet: true, breakLine: true } },
        { text: "+ Ayrı SIM kart yönetimi", options: { bullet: true, breakLine: true } },
        { text: "+ Operatör onay süreci", options: { bullet: true, breakLine: true } },
        { text: "+ Anten/sinyal düzenleme", options: { bullet: true, breakLine: true } },
        { text: "+ Ek yazılım kütüphanesi", options: { bullet: true } },
    ], {
        x: 0.7, y: 2.3, w: 4.0, h: 2.3, fontSize: 12,
        color: C.ink, fontFace: F.body, paraSpaceAfter: 5, margin: 0,
    });

    s.addShape(pres.shapes.RECTANGLE, {
        x: 5.1, y: 1.7, w: 4.4, h: 3.0,
        fill: { color: C.white }, line: { color: C.accent, width: 2 },
    });
    s.addText("Seçilen: ESP32-CAM BLE + iPhone", {
        x: 5.3, y: 1.85, w: 4.0, h: 0.4, fontSize: 14, bold: true,
        color: C.accent, fontFace: F.head, margin: 0,
    });
    s.addText([
        { text: "Sürücünün telefonu zaten arabada", options: { bullet: true, breakLine: true } },
        { text: "Ek BLE modülü gerek yok — entegre", options: { bullet: true, breakLine: true } },
        { text: "iPhone: tel://155 dialer otomatik açılır", options: { bullet: true, breakLine: true } },
        { text: "Tek dokunuş ≡ yanlış pozitif arama koruması", options: { bullet: true, breakLine: true } },
        { text: "Sıfır operatör bağımlılığı, sıfır SIM yönetimi", options: { bullet: true } },
    ], {
        x: 5.3, y: 2.3, w: 4.0, h: 2.3, fontSize: 12,
        color: C.ink, fontFace: F.body, paraSpaceAfter: 5, margin: 0,
    });

    addFooter(s, 7, TOTAL, "Kararlar");
}

// ============================================================================
// 8) UÇTAN UCA MİMARİ
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Uçtan Uca Mimari", "Sistem Mimarisi");

    // 5 kutu yatay düzen
    // Box renkleri: araç içi = ink, bulut = signal, telefon = accent
    function box(x, y, w, h, label, sub, color, textColor) {
        s.addShape(pres.shapes.RECTANGLE, {
            x, y, w, h,
            fill: { color }, line: { type: "none" },
            shadow: { type: "outer", color: "000000", blur: 8, offset: 2, angle: 135, opacity: 0.15 },
        });
        s.addText(label, {
            x: x+0.1, y: y+0.15, w: w-0.2, h: 0.4, fontSize: 12, bold: true,
            color: textColor, fontFace: F.head, align: "center", valign: "middle", margin: 0,
        });
        s.addText(sub, {
            x: x+0.1, y: y+0.55, w: w-0.2, h: 0.5, fontSize: 9,
            color: textColor, fontFace: F.mono, align: "center", valign: "middle", margin: 0,
        });
    }

    function arrow(x1, y1, x2, y2, label, dy) {
        s.addShape(pres.shapes.LINE, {
            x: x1, y: y1, w: x2-x1, h: y2-y1,
            line: { color: C.ink, width: 1.5, endArrowType: "triangle" },
        });
        if (label) {
            s.addText(label, {
                x: (x1+x2)/2 - 0.6, y: (y1+y2)/2 + (dy||-0.18), w: 1.2, h: 0.25,
                fontSize: 8, color: C.mute, fontFace: F.mono,
                align: "center", valign: "middle", margin: 0,
            });
        }
    }

    // Üst sıra: ESP-CAM → Wi-Fi → EC2
    box(0.5, 1.7, 2.2, 1.1, "ESP32-CAM", "kamera + Wi-Fi + BLE", C.ink, C.white);
    box(3.5, 1.7, 1.7, 1.1, "Wi-Fi 2.4 GHz", "hotspot", C.mute, C.white);
    box(6.0, 1.7, 3.2, 1.1, "AWS EC2 (Flask)", "InsightFace + /auth", C.signal, C.white);

    arrow(2.7, 2.25, 3.5, 2.25, "JPEG", -0.30);
    arrow(5.2, 2.25, 6.0, 2.25, "JSON", -0.30);

    // Alt sıra: STM32 → iPhone
    box(0.5, 3.65, 2.2, 1.1, "STM32 F767ZI", "olay yöneticisi", C.ink, C.white);
    box(6.5, 3.65, 2.7, 1.1, "iPhone (SwiftUI)", "tel:// dialer", C.accent, C.white);

    arrow(1.6, 2.8, 1.6, 3.65, "USART6", -0.05);  // ESP → STM
    arrow(2.7, 4.20, 6.5, 4.20, "BLE FFE0/FFE1 · MTU 247", -0.30);  // STM → ESP → iPhone (ESP forward)
    arrow(7.8, 3.65, 7.8, 2.8, "/auth", -0.05);  // iPhone → EC2

    addFooter(s, 8, TOTAL, "Sistem Mimarisi");
}

// ============================================================================
// 9) VERİ AKIŞI (10-FRAME BURST)
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Veri Akışı — 10-Frame Burst", "Sistem Mimarisi");

    const steps = [
        ["1", "TARA basıldı", "STM32 SCANNING, KIRMIZI/SARI LED"],
        ["2", "STM → ESP: CAPTURE", "USART6 (Arduino D0/D1)"],
        ["3", "ESP 5 FPS × 2 s burst", "10 × JPEG (~30 KB), flash LED açık"],
        ["4", "HTTP POST → EC2 /search", "X-Session-Id, X-Frame-Index"],
        ["5", "Kalite filtresi + centroid", "det ≥ 0.7, blur ≥ 10, ≥ 5 kare"],
        ["6", "Cosine sim ≥ 0.40 → MATCH", "ArcFace 512-D, L2 normalize"],
        ["7", "ESP → STM: RESULT:1;name;sim", "STM MATCH durumuna geçer"],
        ["8", "BLE notify → iPhone", "tel://155 dialer açılır, 1 dokunuş"],
    ];

    steps.forEach(([num, action, detail], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 0.5 + col * 4.55;
        const y = 1.65 + row * 0.85;
        s.addShape(pres.shapes.OVAL, {
            x, y: y+0.05, w: 0.4, h: 0.4,
            fill: { color: C.accent }, line: { type: "none" },
        });
        s.addText(num, {
            x, y: y+0.05, w: 0.4, h: 0.4, fontSize: 14, bold: true,
            color: C.white, fontFace: F.mono, align: "center", valign: "middle", margin: 0,
        });
        s.addText(action, {
            x: x+0.55, y, w: 4.0, h: 0.35, fontSize: 12, bold: true,
            color: C.ink, fontFace: F.head, margin: 0,
        });
        s.addText(detail, {
            x: x+0.55, y: y+0.35, w: 4.0, h: 0.35, fontSize: 9,
            color: C.mute, fontFace: F.mono, margin: 0,
        });
    });

    s.addText("Tipik uçtan uca süre: ~5–7 saniye", {
        x: 0.5, y: 4.95, w: 9, h: 0.3, fontSize: 12, italic: true, bold: true,
        color: C.signal, fontFace: F.head, align: "center", margin: 0,
    });

    addFooter(s, 9, TOTAL, "Veri Akışı");
}

// ============================================================================
// 10) DONANIM LİSTESİ
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Donanım Listesi", "Gerçekleme");

    const headerRow = [
        { text: "Parça", options: { bold: true, color: C.white, fill: { color: C.ink }, fontSize: 12, fontFace: F.head } },
        { text: "Adet", options: { bold: true, color: C.white, fill: { color: C.ink }, fontSize: 12, fontFace: F.head, align: "center" } },
        { text: "Fiyat", options: { bold: true, color: C.white, fill: { color: C.ink }, fontSize: 12, fontFace: F.head, align: "right" } },
    ];
    const rows = [
        ["STM32 NUCLEO-F767ZI",                   "1", "(mevcut)"],
        ["ESP32-CAM AI-Thinker (OV3660)",         "1", "120 TL"],
        ["ESP32-CAM-MB programlama dock'u",       "1", "80 TL"],
        ["Aktif buzzer 5 V",                       "1", "15 TL"],
        ["Push button taktil (PANİK, opsiyonel)",  "1", "5 TL"],
        ["LED'ler (NUCLEO onboard yeterli)",       "—", "0 TL"],
        ["Jumper kablo + breadboard",              "—", "60 TL"],
    ].map(r => [
        { text: r[0], options: { fontSize: 12, fontFace: F.body } },
        { text: r[1], options: { fontSize: 12, fontFace: F.mono, align: "center" } },
        { text: r[2], options: { fontSize: 12, fontFace: F.mono, align: "right" } },
    ]);

    const totalRow = [
        { text: "Toplam ek donanım", options: { bold: true, color: C.ink, fontSize: 13, fontFace: F.head } },
        { text: "", options: {} },
        { text: "≈ 280 TL", options: { bold: true, color: C.signal, fontSize: 14, fontFace: F.mono, align: "right" } },
    ];

    s.addTable([headerRow, ...rows, totalRow], {
        x: 0.5, y: 1.7, w: 9, colW: [5.5, 1.5, 2.0],
        border: { pt: 0.5, color: C.line },
        rowH: 0.35,
        valign: "middle",
    });

    s.addText("İlk Plan B'deki HM-10 BLE modülü mimariden çıkarıldı — ESP32-CAM entegre Bluetooth aynı işi tek board üzerinde sağlıyor.", {
        x: 0.5, y: 4.95, w: 9, h: 0.4, fontSize: 11, italic: true,
        color: C.mute, fontFace: F.body, margin: 0,
    });

    addFooter(s, 10, TOTAL, "Gerçekleme");
}

// ============================================================================
// 11) SUNUCU
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Sunucu — Flask + InsightFace + Auth", "Gerçekleme");

    // sol kolon: stack
    s.addText("Yığın", {
        x: 0.5, y: 1.65, w: 4.3, h: 0.35, fontSize: 11, bold: true, charSpacing: 3,
        color: C.accent, fontFace: F.mono, margin: 0,
    });
    s.addText([
        { text: "Python 3.11 · Flask 3 · gunicorn -w 1", options: { bullet: true, breakLine: true } },
        { text: "AWS EC2 m7i-flex.large · eu-central-1", options: { bullet: true, breakLine: true } },
        { text: "Docker konteyneri, /app/data volume", options: { bullet: true, breakLine: true } },
        { text: "ONNX Runtime CPU, OpenCV headless", options: { bullet: true } },
    ], {
        x: 0.5, y: 2.0, w: 4.3, h: 1.8, fontSize: 11,
        color: C.ink, fontFace: F.body, paraSpaceAfter: 4, margin: 0,
    });

    s.addText("Endpoint'ler", {
        x: 0.5, y: 3.85, w: 4.3, h: 0.35, fontSize: 11, bold: true, charSpacing: 3,
        color: C.accent, fontFace: F.mono, margin: 0,
    });
    s.addText([
        { text: "POST /search  — 10-frame burst tanıma", options: { fontSize: 10, fontFace: F.mono, breakLine: true } },
        { text: "POST /auth/register · /auth/login", options: { fontSize: 10, fontFace: F.mono, breakLine: true } },
        { text: "GET  /auth/me · POST /auth/logout", options: { fontSize: 10, fontFace: F.mono } },
    ], {
        x: 0.5, y: 4.2, w: 4.3, h: 0.9, color: C.ink, margin: 0,
    });

    // sağ kolon: warning box -w 1
    s.addShape(pres.shapes.RECTANGLE, {
        x: 5.1, y: 1.65, w: 4.4, h: 1.5,
        fill: { color: C.ink }, line: { type: "none" },
    });
    s.addText("gunicorn -w 1 ZORUNLU", {
        x: 5.3, y: 1.8, w: 4.0, h: 0.35, fontSize: 12, bold: true, charSpacing: 2,
        color: C.signal, fontFace: F.mono, margin: 0,
    });
    s.addText([
        { text: "Oturum durumu in-memory, process başına ayrı.", options: { fontSize: 10, color: C.white, fontFace: F.body, breakLine: true } },
        { text: "2+ worker → burst kareleri farklı process'lere", options: { fontSize: 10, color: C.white, fontFace: F.body, breakLine: true } },
        { text: "dağılır → centroid agregasyonu kırılır.", options: { fontSize: 10, color: C.white, fontFace: F.body } },
    ], {
        x: 5.3, y: 2.2, w: 4.0, h: 0.9, margin: 0,
    });

    // alt sağ: kalite filtresi
    s.addText("Kalite filtresi (per-frame)", {
        x: 5.1, y: 3.3, w: 4.4, h: 0.35, fontSize: 11, bold: true, charSpacing: 3,
        color: C.accent, fontFace: F.mono, margin: 0,
    });
    s.addText([
        { text: "det_score ≥ 0.7", options: { bullet: true, breakLine: true } },
        { text: "bbox area ≥ 80×80 px", options: { bullet: true, breakLine: true } },
        { text: "|yaw| ≤ 30°", options: { bullet: true, breakLine: true } },
        { text: "Laplacian varyans ≥ 10 (ESP-CAM için)", options: { bullet: true } },
    ], {
        x: 5.1, y: 3.65, w: 4.4, h: 1.5, fontSize: 11, fontFace: F.mono,
        color: C.ink, paraSpaceAfter: 3, margin: 0,
    });

    addFooter(s, 11, TOTAL, "Sunucu");
}

// ============================================================================
// 12) STM32 OLAY YÖNETİCİSİ
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "STM32 Olay Yöneticisi", "Gerçekleme");

    // sol kolon
    s.addText([
        { text: "Cortex-M7 @ 216 MHz", options: { bullet: true, breakLine: true } },
        { text: "HSI×PLL (HSE_VALUE makro tuzağı bypass)", options: { bullet: true, breakLine: true } },
        { text: "USART6 (Arduino D0/D1, PG9/PG14), 115200 8N1", options: { bullet: true, breakLine: true } },
        { text: "EXTI13 = TARA (B1 USER), EXTI0 = PANİK", options: { bullet: true, breakLine: true } },
        { text: "FSM: IDLE / SCANNING / MATCH / NOMATCH / PANIC / NETERR", options: { bullet: true, breakLine: true } },
        { text: "PANIC her durumdan erişilebilir", options: { bullet: true } },
    ], {
        x: 0.5, y: 1.7, w: 5.0, h: 2.5, fontSize: 11,
        color: C.ink, fontFace: F.body, paraSpaceAfter: 5, margin: 0,
    });

    // sağ kolon: host-side test
    s.addShape(pres.shapes.RECTANGLE, {
        x: 5.8, y: 1.7, w: 3.7, h: 2.7,
        fill: { color: C.white }, line: { color: C.accent, width: 2 },
    });
    s.addText("Host-side birim test", {
        x: 6.0, y: 1.85, w: 3.3, h: 0.35, fontSize: 12, bold: true, charSpacing: 2,
        color: C.accent, fontFace: F.mono, margin: 0,
    });
    s.addText([
        { text: "HAL'dan soyutlanmış taşınabilir C99", options: { fontSize: 10, color: C.ink, fontFace: F.body, breakLine: true } },
        { text: "Callback vtable: LED, buzzer, UART, clock", options: { fontSize: 10, color: C.ink, fontFace: F.body, breakLine: true } },
        { text: "gcc -O2 -Wall ile PC'de derlenir", options: { fontSize: 10, color: C.ink, fontFace: F.body, breakLine: true } },
        { text: "12 senaryo deterministik geçer", options: { fontSize: 10, bold: true, color: C.signal, fontFace: F.body, breakLine: true } },
        { text: " ", options: { fontSize: 8, breakLine: true } },
        { text: "→ donanım üzerinde flash–flash döngüsü minimize", options: { fontSize: 10, italic: true, color: C.mute, fontFace: F.body } },
    ], {
        x: 6.0, y: 2.25, w: 3.3, h: 2.0, paraSpaceAfter: 3, margin: 0,
    });

    // alt: HSE bug açıklaması
    s.addShape(pres.shapes.RECTANGLE, {
        x: 0.5, y: 4.5, w: 9.0, h: 0.65,
        fill: { color: C.inkSoft }, line: { type: "none" },
    });
    s.addText([
        { text: "HSE_VALUE bug:", options: { bold: true, color: C.signal, fontSize: 11, fontFace: F.mono } },
        { text: "  stm32f7xx_hal_conf.h'da 25 MHz tanımlı, NUCLEO'da gerçek HSE 8 MHz. HSE üzerinden PLL → HAL'in UART BRR hesabı 1/3 oranında bozuluyor. Çözüm: HSI 16 MHz × PLL_M=8 × N=216 / P=2 → SYSCLK 216 MHz, BRR doğru.",
          options: { color: C.white, fontSize: 11, fontFace: F.body } },
    ], {
        x: 0.65, y: 4.55, w: 8.7, h: 0.6, valign: "middle", margin: 0,
    });

    addFooter(s, 12, TOTAL, "STM32");
}

// ============================================================================
// 13) ESP32-CAM
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "ESP32-CAM — Kamera + Wi-Fi + BLE", "Gerçekleme");

    s.addText([
        { text: "AI-Thinker modülü, ESP32-WROOM-32 SoC, OV3660 sensör", options: { bullet: true, breakLine: true } },
        { text: "PlatformIO + Arduino-ESP32 framework", options: { bullet: true, breakLine: true } },
        { text: "Wi-Fi STA (sürücü hotspot) → HTTP POST /search", options: { bullet: true, breakLine: true } },
        { text: "BLE peripheral “TaxiGuard”: servis FFE0, char FFE1", options: { bullet: true, breakLine: true } },
        { text: "STM telefon-yön mesajlarını BLE notify'a forward eder", options: { bullet: true } },
    ], {
        x: 0.5, y: 1.7, w: 5.5, h: 2.5, fontSize: 12,
        color: C.ink, fontFace: F.body, paraSpaceAfter: 5, margin: 0,
    });

    // sağ kolon: MTU 247 callout
    s.addShape(pres.shapes.RECTANGLE, {
        x: 6.3, y: 1.7, w: 3.3, h: 1.5,
        fill: { color: C.signal }, line: { type: "none" },
    });
    s.addText("MTU 247", {
        x: 6.4, y: 1.8, w: 3.1, h: 0.4, fontSize: 22, bold: true,
        color: C.white, fontFace: F.head, margin: 0,
    });
    s.addText("Varsayılan ATT MTU 23 → payload 20 byte. MATCH:Name;0.66 satırı 2 pakete bölünüyor, parser similarity 0 görüyor. setMTU(247) fix.", {
        x: 6.4, y: 2.25, w: 3.1, h: 0.9, fontSize: 10,
        color: C.white, fontFace: F.body, margin: 0,
    });

    // brown-out callout
    s.addShape(pres.shapes.RECTANGLE, {
        x: 6.3, y: 3.4, w: 3.3, h: 1.45,
        fill: { color: C.ink }, line: { type: "none" },
    });
    s.addText("Güç notu", {
        x: 6.4, y: 3.5, w: 3.1, h: 0.4, fontSize: 14, bold: true,
        color: C.accent2, fontFace: F.head, margin: 0,
    });
    s.addText("Kamera + Wi-Fi + BLE eşzamanlı ≈ 500 mA pik. STM 5 V pininden besleme brown-out reset'e yol açar — ESP-CAM ayrı USB kaynağından beslenir.", {
        x: 6.4, y: 3.9, w: 3.1, h: 0.9, fontSize: 10,
        color: C.white, fontFace: F.body, margin: 0,
    });

    addFooter(s, 13, TOTAL, "ESP32-CAM");
}

// ============================================================================
// 14) iPhone UYGULAMASI
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "iPhone Uygulaması — TaksiGuvenlik", "Gerçekleme");

    s.addText([
        { text: "SwiftUI · iOS 17 · @Observable macro", options: { bullet: true, breakLine: true } },
        { text: "CoreBluetooth central role, “TaxiGuard”a otomatik bağlanır", options: { bullet: true, breakLine: true } },
        { text: "AuthManager: URLSession async REST + Keychain token cache", options: { bullet: true, breakLine: true } },
        { text: "RootView: auth durumuna göre Login / Register / Home", options: { bullet: true, breakLine: true } },
        { text: "HomeView: TabView (Ana Sayfa · Tarama · Profil)", options: { bullet: true } },
    ], {
        x: 0.5, y: 1.65, w: 5.5, h: 2.5, fontSize: 12,
        color: C.ink, fontFace: F.body, paraSpaceAfter: 5, margin: 0,
    });

    // sağ kolon: 3 tab özeti
    const tabs = [
        ["Ana Sayfa", "Selamlama, plaka, sistem durumu özet kartı"],
        ["Tarama", "Canlı renkli durum kartı + olay günlüğü"],
        ["Profil", "Kullanıcı bilgisi + Çıkış Yap"],
    ];
    tabs.forEach(([title, sub], i) => {
        const y = 1.7 + i * 0.95;
        s.addShape(pres.shapes.RECTANGLE, {
            x: 6.3, y, w: 3.3, h: 0.85,
            fill: { color: C.white }, line: { color: C.line, width: 1 },
        });
        s.addText(title, {
            x: 6.45, y: y+0.1, w: 3.0, h: 0.3, fontSize: 12, bold: true,
            color: C.accent, fontFace: F.head, margin: 0,
        });
        s.addText(sub, {
            x: 6.45, y: y+0.4, w: 3.0, h: 0.4, fontSize: 10,
            color: C.ink, fontFace: F.body, margin: 0,
        });
    });

    // alt: tel:// sandbox
    s.addText([
        { text: "iOS sandbox tam-otomatik aramaya izin vermez:", options: { bold: true, color: C.signal, fontSize: 11 } },
        { text: " UIApplication.shared.open(URL(\"tel://155\")) → dialer açılır, sürücü 1 tıkla onaylar. Tek dokunuş ≡ yanlış pozitif arama koruması.", options: { color: C.ink, fontSize: 11 } },
    ], {
        x: 0.5, y: 4.55, w: 9.1, h: 0.6, fontFace: F.body, margin: 0,
    });

    addFooter(s, 14, TOTAL, "iPhone");
}

// ============================================================================
// 15) KULLANICI YÖNETİMİ AKIŞI
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Kullanıcı Yönetimi Akışı", "Auth");

    // 5 kutu, soldan sağa yatay akış
    const xs = [0.5, 2.3, 4.1, 5.9, 7.7];
    const labels = ["Uygulama açılır", "Keychain'de token?", "GET /auth/me", "200 → HomeView", "Login / Register"];
    const colors = [C.ink, C.inkSoft, C.accent, "2C5F2D", C.signal];
    const sub = ["", "evet ↗ / hayır ↘", "doğrula", "TabView", "kayıt ol → token"];

    xs.forEach((x, i) => {
        s.addShape(pres.shapes.RECTANGLE, {
            x, y: 2.0, w: 1.7, h: 1.2,
            fill: { color: colors[i] }, line: { type: "none" },
            shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.18 },
        });
        s.addText(labels[i], {
            x: x+0.1, y: 2.15, w: 1.5, h: 0.7, fontSize: 11, bold: true,
            color: C.white, fontFace: F.head, align: "center", valign: "middle", margin: 0,
        });
        s.addText(sub[i], {
            x: x+0.1, y: 2.85, w: 1.5, h: 0.3, fontSize: 9,
            color: "DDDDDD", fontFace: F.mono, align: "center", margin: 0,
        });

        if (i < xs.length - 1) {
            s.addShape(pres.shapes.LINE, {
                x: x + 1.7, y: 2.6, w: 0.1, h: 0,
                line: { color: C.ink, width: 2, endArrowType: "triangle" },
            });
        }
    });

    // alt: detaylar
    s.addText([
        { text: "Sunucu: ", options: { bold: true, color: C.accent, fontSize: 11, fontFace: F.mono } },
        { text: "SQLite users.db · werkzeug PBKDF2-SHA256 600k iter · secrets.token_urlsafe(32) bearer token", options: { color: C.ink, fontSize: 11, fontFace: F.body, breakLine: true } },
        { text: "Plaka: ", options: { bold: true, color: C.accent, fontSize: 11, fontFace: F.mono } },
        { text: "regex ^\\d{2}\\s?[A-Z]{1,3}\\s?\\d{2,4}$ — “34 ABC 1234” formatı, istemci + sunucu çift doğrulama, plaka unique değil.", options: { color: C.ink, fontSize: 11, fontFace: F.body, breakLine: true } },
        { text: "iPhone: ", options: { bold: true, color: C.accent, fontSize: 11, fontFace: F.mono } },
        { text: "Token + username + plate iOS Keychain'de; bootstrap'ta /auth/me ile sessiz doğrulama, network hatası kullanıcı oturumunu silmez.", options: { color: C.ink, fontSize: 11, fontFace: F.body } },
    ], {
        x: 0.5, y: 3.6, w: 9.1, h: 1.5, fontFace: F.body, paraSpaceAfter: 3, margin: 0,
    });

    addFooter(s, 15, TOTAL, "Auth");
}

// ============================================================================
// 16) ÖLÇÜM HARNESS
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Ölçüm Harness'ı — eval/far_frr.py", "Ölçüm");

    s.addText([
        { text: "Veri seti klasörünü (gallery + genuine + impostor) tarar", options: { bullet: true, breakLine: true } },
        { text: "Her fotoğrafı 10-frame burst olarak /search'e gönderir", options: { bullet: true, breakLine: true } },
        { text: "Similarity skorlarını CSV'ye yazar", options: { bullet: true, breakLine: true } },
        { text: "Eşik τ ∈ [0, 1] üzerinde 0.01 adım sweep → FAR/FRR tablosu", options: { bullet: true, breakLine: true } },
        { text: "EER eşiği ve FAR ≤ 1% operating point'i raporlar", options: { bullet: true, breakLine: true } },
        { text: "Matplotlib varsa FAR–FRR (ROC) eğrisini PNG'e basar", options: { bullet: true } },
    ], {
        x: 0.5, y: 1.65, w: 9, h: 2.5, fontSize: 12,
        color: C.ink, fontFace: F.body, paraSpaceAfter: 5, margin: 0,
    });

    // çıktı dosyaları kutusu
    s.addShape(pres.shapes.RECTANGLE, {
        x: 0.5, y: 4.0, w: 9.0, h: 1.1,
        fill: { color: C.ink }, line: { type: "none" },
    });
    s.addText("Çıktılar  →  tez Bölüm 5 tablolarına doğrudan kaynak", {
        x: 0.7, y: 4.1, w: 8.6, h: 0.3, fontSize: 11, bold: true, charSpacing: 2,
        color: C.accent2, fontFace: F.mono, margin: 0,
    });
    s.addText([
        { text: "<run>.csv ", options: { fontFace: F.mono, color: C.white, fontSize: 10 } },
        { text: "her probe satırı  ·  ", options: { color: "B8B8C8", fontSize: 10 } },
        { text: "<run>_sweep.csv ", options: { fontFace: F.mono, color: C.white, fontSize: 10 } },
        { text: "eşik tablosu  ·  ", options: { color: "B8B8C8", fontSize: 10 } },
        { text: "<run>_summary.json ", options: { fontFace: F.mono, color: C.white, fontSize: 10 } },
        { text: "EER + op. point  ·  ", options: { color: "B8B8C8", fontSize: 10 } },
        { text: "<run>_roc.png", options: { fontFace: F.mono, color: C.white, fontSize: 10 } },
    ], {
        x: 0.7, y: 4.45, w: 8.6, h: 0.6, margin: 0,
    });

    addFooter(s, 16, TOTAL, "Ölçüm");
}

// ============================================================================
// 17) ÖLÇÜM PLANI 3 EKSEN
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Ölçüm Planı — Üç Eksen", "Ölçüm");

    const axes = [
        ["Aydınlatma", "100 lx · alacakaranlık\n300 lx · ofis\n600 lx · gün ışığı"],
        ["Mesafe", "30–60 cm · yakın\n60–90 cm · orta\n90–120 cm · uzak"],
        ["Pasif canlılık", "Gerçek yüz vs.\nekran replay\n(cross-frame σ)"],
    ];

    axes.forEach(([title, body], i) => {
        const x = 0.5 + i * 3.05;
        s.addShape(pres.shapes.RECTANGLE, {
            x, y: 1.7, w: 2.9, h: 3.0,
            fill: { color: C.white }, line: { color: C.line, width: 1 },
            shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.10 },
        });
        // üst şerit
        s.addShape(pres.shapes.RECTANGLE, {
            x, y: 1.7, w: 2.9, h: 0.4,
            fill: { color: C.ink }, line: { type: "none" },
        });
        s.addText(`Eksen 0${i+1}`, {
            x: x+0.15, y: 1.74, w: 2.6, h: 0.32, fontSize: 9, charSpacing: 4,
            color: C.accent2, fontFace: F.mono, valign: "middle", margin: 0,
        });
        s.addText(title, {
            x: x+0.2, y: 2.3, w: 2.5, h: 0.5, fontSize: 18, bold: true,
            color: C.ink, fontFace: F.head, margin: 0,
        });
        s.addText(body, {
            x: x+0.2, y: 2.85, w: 2.5, h: 1.6, fontSize: 12,
            color: C.ink, fontFace: F.body, margin: 0,
        });
    });

    s.addText("Test seti: ekip + gönüllüler (5–8 kişi), sergi takvimi içinde uygulanabilir kapsam.", {
        x: 0.5, y: 4.95, w: 9, h: 0.3, fontSize: 11, italic: true,
        color: C.mute, fontFace: F.body, align: "center", margin: 0,
    });

    addFooter(s, 17, TOTAL, "Ölçüm Planı");
}

// ============================================================================
// 18) MEVCUT DURUM
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Mevcut Çalışma Durumu", "Durum");

    const rows = [
        ["✓", "EC2 sunucu (/search + /auth) canlı, smoke test OK",       C.signal],
        ["✓", "ESP32-CAM Wi-Fi + HTTP POST + JSON parse",                  C.signal],
        ["✓", "ESP32-CAM BLE “TaxiGuard” advertising",                     C.signal],
        ["✓", "STM32 HSI×PLL 216 MHz + USART6 köprüsü",                    C.signal],
        ["✓", "STM state machine — 12/12 host-side test geçti",            C.signal],
        ["✓", "iPhone Login/Register/TabView + Keychain (kod hazır)",      C.signal],
        ["✓", "Uçtan uca: B1 → MATCH → tel:// dialer (Gokturk+Ekin)",      C.signal],
        ["○", "BLE MTU 247 fix cihazda doğrulama (push'lu commit)",        C.accent],
        ["○", "iPhone yeni auth UI Xcode ilk build",                       C.accent],
        ["…", "FAR/FRR ölçümü (20–30 kişi)",                                C.mute],
        ["…", "Aydınlatma + mesafe testleri",                              C.mute],
        ["…", "Demo öncesi emergencyNumber → 155",                          C.mute],
    ];

    rows.forEach(([mark, text, color], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 0.5 + col * 4.55;
        const y = 1.65 + row * 0.50;
        s.addText(mark, {
            x, y, w: 0.4, h: 0.4, fontSize: 14, bold: true,
            color, fontFace: F.mono, align: "center", valign: "middle", margin: 0,
        });
        s.addText(text, {
            x: x+0.45, y, w: 4.0, h: 0.4, fontSize: 11,
            color: C.ink, fontFace: F.body, valign: "middle", margin: 0,
        });
    });

    addFooter(s, 18, TOTAL, "Durum");
}

// ============================================================================
// 19) ÖZGÜN KATKILAR
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Özgün Katkılar", "Sonuç");

    const items = [
        ["01", "InsightFace + ESP32-CAM entegrasyonu",
               "Açık kaynak yüz tanıma motoru küçük gömülü donanımla taksi senaryosuna uyarlandı."],
        ["02", "Tek board · kamera + Wi-Fi + BLE",
               "ESP32-CAM'in entegre Bluetooth'u sayesinde ek BLE modülü (HM-10) gereksiz kaldı."],
        ["03", "Bedava pasif canlılık",
               "Cross-frame embedding standart sapması ile ek model yükü olmadan replay tespiti."],
        ["04", "Taşınabilir STM32 durum makinesi",
               "HAL'dan soyutlanmış, host-side birim testten geçen C99 modülü."],
        ["05", "Hafif kullanıcı kaydı altyapısı",
               "SQLite + werkzeug + secrets — ek bağımlılık gerektirmeyen auth katmanı."],
        ["06", "Tekrarlanabilir FAR/FRR ölçüm aracı",
               "eval/far_frr.py ile tablolar otomatik üretilir, tezin Bölüm 5'i bu çıktılardan beslenir."],
    ];

    items.forEach(([num, head, body], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 0.5 + col * 4.55;
        const y = 1.65 + row * 1.15;

        s.addShape(pres.shapes.OVAL, {
            x, y, w: 0.5, h: 0.5,
            fill: { color: C.ink }, line: { type: "none" },
        });
        s.addText(num, {
            x, y, w: 0.5, h: 0.5, fontSize: 12, bold: true,
            color: C.accent2, fontFace: F.mono, align: "center", valign: "middle", margin: 0,
        });
        s.addText(head, {
            x: x+0.6, y, w: 3.9, h: 0.4, fontSize: 12, bold: true,
            color: C.ink, fontFace: F.head, margin: 0,
        });
        s.addText(body, {
            x: x+0.6, y: y+0.4, w: 3.9, h: 0.7, fontSize: 10,
            color: C.mute, fontFace: F.body, margin: 0,
        });
    });

    addFooter(s, 19, TOTAL, "Özgün Katkılar");
}

// ============================================================================
// 20) GELECEK ÇALIŞMALAR
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.paper };
    addTitle(s, "Gelecek Çalışmalar", "Sonuç");

    const items = [
        ["Faz 2 — HTTPS + sertleştirme", "Caddy/nginx + Let's Encrypt, SHARED_SECRET aktif, token süresi (örn. 30 gün)"],
        ["Android istemcisi",            "Intent.ACTION_CALL ile tek-dokunuşsuz çağrı + 5 s iptal geri sayımı"],
        ["Edge inference",                "ESP32-S3 üzerinde nicemlenmiş ön-eleme, bulut maliyetinde düşüş"],
        ["Filo entegrasyonu",             "MQTT/WebSocket olay panosu, plaka eşleme yönetimi"],
        ["Aktif canlılık",                "Arka koltukta sessiz kafa-jest doğrulaması, 3B maske direnci"],
        ["Yasal çerçeve",                 "KVKK açık rıza prosedürü, yetkili veri tabanı erişimi, yolcu bilgilendirme"],
    ];

    items.forEach(([title, body], i) => {
        const y = 1.65 + i * 0.55;
        s.addShape(pres.shapes.RECTANGLE, {
            x: 0.5, y, w: 0.18, h: 0.45,
            fill: { color: C.accent }, line: { type: "none" },
        });
        s.addText(title, {
            x: 0.8, y, w: 3.5, h: 0.45, fontSize: 12, bold: true,
            color: C.ink, fontFace: F.head, valign: "middle", margin: 0,
        });
        s.addText(body, {
            x: 4.4, y, w: 5.2, h: 0.45, fontSize: 11,
            color: C.mute, fontFace: F.body, valign: "middle", margin: 0,
        });
    });

    addFooter(s, 20, TOTAL, "Gelecek Çalışmalar");
}

// ============================================================================
// 21) TEŞEKKÜRLER
// ============================================================================
{
    const s = pres.addSlide();
    s.background = { color: C.ink };

    // sağ accent
    s.addShape(pres.shapes.RECTANGLE, {
        x: 9.4, y: 0, w: 0.6, h: 5.625,
        fill: { color: C.accent }, line: { type: "none" },
    });

    s.addText("TEŞEKKÜRLER", {
        x: 0.5, y: 1.7, w: 8.5, h: 1.0, fontSize: 56, bold: true, charSpacing: 8,
        color: C.white, fontFace: F.head, align: "center", margin: 0,
    });

    s.addShape(pres.shapes.LINE, {
        x: 4.0, y: 2.85, w: 1.5, h: 0,
        line: { color: C.accent, width: 2 },
    });

    s.addText("Sorular?", {
        x: 0.5, y: 3.05, w: 8.5, h: 0.5, fontSize: 22, italic: true,
        color: C.accent2, fontFace: F.head, align: "center", margin: 0,
    });

    s.addText([
        { text: "Ekin Ağaoğlu", options: { fontSize: 14, bold: true, color: C.white, fontFace: F.body, breakLine: true } },
        { text: "Danışman: Prof. Dr. Aydoğan Savran", options: { fontSize: 11, color: "B8B8C8", fontFace: F.body, breakLine: true } },
        { text: "Ege Üniversitesi · EE Bölümü · 2025–2026", options: { fontSize: 10, color: C.mute, fontFace: F.body } },
    ], {
        x: 0.5, y: 4.2, w: 8.5, h: 1.0, align: "center", margin: 0,
    });
}

// ============================================================================
pres.writeFile({ fileName: "/Users/gokturkgocen/Bitirme/face-mac/docs/sunum/sunum.pptx" })
    .then(fn => console.log("OK:", fn))
    .catch(e => { console.error("ERR:", e); process.exit(1); });
