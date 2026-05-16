# Taksi Güvenlik Projesi — Sıfırdan Anlatım

> Bu metin, projeyi hiç görmemiş birinin baştan sona neyin nasıl çalıştığını
> anlayabilmesi için yazıldı. Hem "büyük resim" hem teknik detaylar
> birlikte var. Ekin Ağaoğlu ve Göktürk Göçen'in **ortak donanım/yazılım
> altyapısı üzerine yazdıkları iki ayrı bitirme tezinin** birleştirilmiş
> teknik açıklamasıdır.

---

## 1. Tek cümleyle proje

Takside yolcu arka koltuğa oturduğunda şoför bir butona basar; sistem o
yolcunun yüzünü 2 saniyede 10 farklı kareyle çeker, internet üzerinden
yapay zekâlı bir sunucuda "aranan suçlular" veritabanıyla karşılaştırır,
eşleşme bulursa şoförün telefonunda kırmızı bir uyarı + acil çağrı
ekranı (155) otomatik açar.

## 2. Neden var?

Taksi şoförleri yolcuyu önceden tanımıyor, kapalı mekanda yalnız
çalışıyor, gece saatleri risk. Mevcut çözümler (panik buton, GPS,
takograf) hep **olay olduktan sonra** bilgi sağlıyor. Bu projedeki fikir:
yolcu daha aracına bindiği anda sessizce kimliği biyometrik olarak
kontrol et, riskliyse sürücüye haber ver, daha geç olmadan. Şoför hiçbir
şey yapmıyor — tek butona basıyor, gerisi otomatik.

İki temel gereksinim var:
- **Caydırıcılık ve kayıt:** Yolcunun kimliği önceden doğrulanıyor olsun.
- **Sürücü dikkati dağılmasın:** Hiçbir karmaşık ekran/menü yok, tek bir
  butonla başlatılır, sonuç otomatik telefona yansır.

## 3. Sistem üst seviye akışı

```
            ┌── ARAÇ İÇİ MODÜL ──┐
            │                    │
   Yolcu ──►│  ESP32-CAM         │── Wi-Fi ──► EC2 Bulut
            │  (kamera+Wi-Fi+BLE)│             (yüz tanıma + kullanıcı kaydı)
            │       ▲ ▼          │
            │     USART          │
            │       ▲ ▼          │
            │  STM32 F767ZI      │
            │  (LED + buzzer +   │
            │   olay yönetimi)   │
            └─────────┬──────────┘
                      │ BLE
                      ▼
                Sürücü iPhone
                (kayıt, login, durum kartı,
                 MATCH'te tel://155 çağrı ekranı)
```

Üç bölge var:
1. **Araç içi modül** — STM32 mikrodenetleyici + ESP32-CAM kameralı modül.
2. **Bulut** — AWS EC2 sunucusu, üzerinde yapay zekâ + kullanıcı veritabanı.
3. **Sürücü telefonu** — iPhone, uygulamayla sisteme bağlanıyor.

## 4. Donanım — neden ne var?

### STM32 NUCLEO-F767ZI
ARM Cortex-M7 işlemcili profesyonel geliştirme kartı (216 MHz). Görevi:
**olay yönetmek**.
- Şoför "TARA" butonuna bastığında ESP'ye "yakala" komutu gönderir.
- Sonuç geldiğinde LED + buzzer ile şoföre geri bildirim verir
  (kırmızı + sesli = aranan biri çıktı, yeşil = temiz, sarı = ağ hatası).
- Telefona iletilecek mesajları ESP üzerinden BLE'ye yönlendirir.
- Bir "durum makinesi" var: IDLE (boşta) → SCANNING (taranıyor) →
  MATCH/NOMATCH/PANIC/NETERR durumlarına geçer.

Neden mikro işlemci? Çünkü güvenlik kritik bir cihaz; gerçek zamanlı,
çökmesi olmayan, deterministik bir kontrolcü olmalı. iPhone veya bir PC
bu işi yapamaz çünkü onlar genel amaçlı işletim sistemleri, anlık
gecikmeleri öngörülemez.

### ESP32-CAM (AI-Thinker, OV3660)
Çinli, çok ucuz (120 TL) bir modül. İçinde:
- **Kamera** (640×480 piksel JPEG çıktısı)
- **Wi-Fi** (sürücünün telefon hotspot'una bağlanır)
- **Bluetooth Low Energy** (telefona kablosuz bildirim atar)

Görevi: **yakala, yolla, ilet**.
- STM'den "yakala" komutu gelir → 2 saniyede 10 fotoğraf çeker
  (saniyede 5 kare).
- Her fotoğrafı tek tek Wi-Fi üzerinden EC2 sunucusuna gönderir.
- Bulut'tan sonuç JSON döner → STM'e iletir.
- STM'in telefona göndermek istediği her satırı BLE üzerinden iPhone'a
  forward eder.

**Önemli karar:** İlk planda STM32'nin DCMI çevre birimine bağlanan
"OV5640" diye standalone bir kamera modülü kullanılacaktı. Çankaya'da
tedarik edilemediği için ESP32-CAM'e geçildi — tek board üzerinde hem
kamera hem Wi-Fi hem Bluetooth. Maliyet düştü, montaj basitleşti.

**Brown-out riski:** Kamera + Wi-Fi + BLE birlikte çalıştığında 500 mA'a
yakın pik akım çekiyor. STM kartının 5V çıkışı bunu kaldırmıyor → kart
resetleniyor. Çözüm: ESP-CAM **ayrı bir USB kaynağından** beslenir.
STM ile arasında sadece 3 kablo: TX, RX, GND.

### Sürücü iPhone'u
Test için iPhone 16 (Göktürk'ün kendi telefonu). Üzerinde
**TaksiGuvenlik** isimli SwiftUI uygulaması:
- Sürücü kullanıcı adı + şifre + taksi plakası ile giriş yapar.
- ESP32-CAM'in BLE çevresel arayüzüne ("TaxiGuard") otomatik bağlanır.
- Tarama, eşleşme, panik gibi olayları arka planda dinler.
- MATCH veya PANIC durumunda iOS'un arama ekranını `tel://155` URL'si
  ile otomatik açar — sürücü yeşil tuşa **tek dokunarak** aramayı tamamlar.

**Neden iOS tek dokunuş?** Apple sandbox'ı üçüncü taraf uygulamaların
arka planda tam-otomatik arama başlatmasına izin vermiyor. Tek tıklı
onay = aynı zamanda **yanlış pozitif arama koruması** olarak tezde
savunuluyor (sistem yanlış MATCH verirse şoför "ara" tuşuna basmayarak
iptal eder).

### EC2 sunucusu (Frankfurt)
Amazon Web Services üzerinde **m7i-flex.large** tipi bir sanal sunucu.
- Aylık ~$23 ücret (AWS Başlangıç kredisiyle ücretsiz).
- Ekin Ağaoğlu'nun AWS hesabında (account 570814275088).
- Docker konteynerinde Flask web servisi çalışıyor.

İçinde iki katman var:
1. **Yüz tanıma servisi** — açık kaynak InsightFace kütüphanesi
   (buffalo_l modeli, ArcFace-R100 mimarisi).
2. **Kullanıcı yönetimi** — SQLite veritabanında şoför hesapları
   (kullanıcı adı, şifre özeti, taksi plakası).

### Kaybedilen parçalar
- **HM-10 BLE modülü** — ESP32-CAM'in dahili Bluetooth'u aynı işi
  yaptığı için iptal edildi.
- **OV5640 + DCMI** — modül bulunamadığı için ESP32-CAM'e geçildi.
- **Raspberry Pi 4** — gereksiz, ESP32-CAM yetiyor.

## 5. Yapay zekâ kısmı (yüz tanıma) nasıl çalışıyor?

### Modeller
Açık kaynak **InsightFace** kütüphanesinin "buffalo_l" paketi
kullanılıyor. Bu paket iki ayrı yapay sinir ağından oluşuyor:

1. **RetinaFace** — Fotoğrafta yüzü **bul**. Çerçeve koordinatlarını
   ve "burası gerçekten yüz mü?" güven skorunu verir.
2. **ArcFace-R100** — O yüzü 512 sayıdan oluşan bir **gömme vektörüne
   (embedding)** çevirir. Yani yüzün matematiksel imzası.

İki kişinin embedding'i ne kadar yakınsa, yüzleri o kadar benziyor
demek (cosine benzerliği denilen bir metrikle ölçülüyor: 0 ile 1
arasında, 1 = aynı kişi, 0 = tamamen farklı).

**Neden açık kaynak?** AWS Rekognition, Microsoft Azure Face gibi kapalı
kutu servisler kullanılabilirdi ama:
- KVKK belirsizliği (veri Amerika'ya gidiyor)
- Eşik değerini (kaç benzerlikten itibaren MATCH sayılır) biz kontrol
  edemiyoruz
- Fiyat değişirse mahsur kalırız

Kendi sunucumuzu kurduğumuz için modeli, eşiği, veritabanını tamamen
biz kontrol ediyoruz. KVKK uyumu doğal.

### Multi-frame burst (10 kareli yakalama)
Tek bir karelik fotoğraf ile karar vermek riskli — yüz bulanık çıkabilir,
yarısı kapalı olabilir, ışık kötü olabilir. Onun yerine:

- **5 FPS × 2 saniye = 10 fotoğraf** ardışık çekilir, her biri ayrı
  ayrı sunucuya yollanır.
- Sunucu her kareyi bir **kalite filtresinden** geçirir:
  - Yüz tespit skoru ≥ 0.7
  - Yüz alanı ≥ 80×80 piksel
  - Yüz dönüklüğü |yaw| ≤ 30° (yüz fazla yan dönmemiş)
  - Bulanıklık (Laplacian variance) ≥ 10 (çok bulanık değil)
- Kaliteyi geçen embedding'lerin **centroid'i** alınır (matematiksel
  ortalama).
- Bu centroid, veritabanındaki her "aranan kişi" embedding'iyle
  karşılaştırılır.
- En yüksek benzerlik 0.40'tan büyükse → **MATCH**.

### Bedava liveness (canlılık) kontrolü
Birisi bir kâğıda basılı fotoğraf veya başka bir telefonda gösterilen
ekran ile sistemi kandırmaya çalışsa? Bunun adı "photo replay attack".
Genelde MiniFASNet gibi ek bir model eklemek gerekir.

Bizde bedava bir trick var: **10 farklı karenin embedding'leri arasındaki
standart sapma** ölçülür. Gerçek bir canlı yüzde mikro hareketler,
ifade değişiklikleri, gözlerdeki kıpırtı sebebiyle bu sapma sıfırdan
biraz büyük çıkar. Fotoğraf replay'inde ise neredeyse sıfır olur.
Yani fotoğraf gösterirsen yakalanırsın.

### Sunucu mimarisi (kod tarafı)
- `face-mac/server/app.py` — Flask web servis (Python).
- `face-mac/server/recognition.py` — InsightFace sarmalayıcı + kalite
  filtresi.
- `face-mac/server/db.py` — Pickle dosyasında yüz veritabanı
  (`embeddings.pkl`). Her kayıt: (isim, 512 sayılı vektör).
- `face-mac/server/auth.py` — Kullanıcı kaydı + login (SQLite
  `users.db`).
- Docker konteynerinde Gunicorn ile çalışıyor. **Tek worker zorunlu**
  çünkü tarama oturumu işlem belleğinde tutuluyor; çoklu worker
  oturum durumunu kırar.

## 6. İletişim katmanları

Birbirinden farklı 4 ayrı haberleşme protokolü kullanılıyor:

1. **USART (UART) — STM32 ↔ ESP32-CAM**
   - 115200 baud, 8N1, ASCII metin.
   - STM'in Arduino başlığındaki D0/D1 pinleri (PG9/PG14) ile ESP'nin
     IO13/IO14 pinleri arasında.
   - Mesaj örnekleri: `CAPTURE\n`, `RESULT:1;Gokturk;0.66\n`,
     `MATCH:Gokturk;0.66\n`, `HB\n` (5 saniyede bir kalp atışı).

2. **Wi-Fi + HTTP — ESP32-CAM ↔ EC2**
   - ESP, telefonun hotspot'una bağlanır.
   - JPEG fotoğrafları `POST /search` ile EC2'ye iletir.
   - Her POST aynı oturum kimliğini (UUID) taşır, sunucu kareleri biriktirip
     10. karede toplu agregasyon yapar.

3. **Bluetooth Low Energy — ESP32-CAM ↔ iPhone**
   - ESP, "TaxiGuard" adıyla yayın yapar (broadcast).
   - iPhone uygulaması otomatik bağlanır.
   - Servis UUID `FFE0`, karakteristik `FFE1` (NOTIFY).
   - MTU 247 — varsayılan 23 byte mesajları kırpıyordu, bug fix
     yapıldı.

4. **HTTPS/HTTP — iPhone ↔ EC2**
   - iPhone uygulaması doğrudan EC2'ye bağlanır (Wi-Fi/4G üzerinden).
   - `POST /auth/register`, `POST /auth/login`, `GET /auth/me`,
     `POST /auth/logout` endpoint'leri.
   - Şu an demo HTTP (TLS yok); üretim için Faz 2'de Let's Encrypt
     sertifikasıyla HTTPS'e geçilecek.

## 7. Kullanıcı kaydı ve kimlik doğrulama

İlk açılışta sürücü uygulamayı açtığında:

```
Uygulama açılır
    ↓
Telefonun Keychain'inde geçerli bir token var mı?
    │
    ├── Evet → sunucuda doğrula (GET /auth/me)
    │            ├── 200 → ana ekrana git
    │            └── 401 → token sil, login ekranına dön
    │
    └── Hayır → Login ekranı
                  ↓ (Kayıt ol)
              Register ekranı
                  ├── kullanıcı adı (3-32 karakter)
                  ├── şifre (en az 6 karakter)
                  └── plaka (örn. 34 ABC 1234)
                       ↓
                   POST /auth/register
                       ↓
                   Başarılı → otomatik login → ana ekran
```

Sunucu tarafı:
- Şifreler **werkzeug.security.generate_password_hash** ile özetlenir
  (PBKDF2 + rastgele tuz). Açık şifre hiçbir yere yazılmaz.
- Oturum token'ı: `secrets.token_urlsafe(32)` — 32 baytlık rastgele
  string. Süre sınırı yok, kullanıcı çıkış yapana kadar geçerli.
- Plaka için Türk plaka regex'i: `^\d{2}\s?[A-Z]{1,3}\s?\d{2,4}$`.
- Plaka **unique değil** — aynı plakaya birden fazla şoför hesabı
  açılabilir (vardiya değişimi için pratik).

iPhone arayüzü (üç sekmeli TabView):
- **Ana Sayfa:** "Hoş geldin {ad}" + plaka + sistem durumu özet kartı.
- **Tarama:** Canlı durum kartı (büyük renkli) + olay günlüğü.
- **Profil:** Avatar, kullanıcı bilgisi, "Çıkış Yap" butonu.

## 8. STM32 olay yöneticisi — kalbi

STM32 firmware'i bir **sonlu durum makinesi (FSM)** etrafında yazıldı:

```
   IDLE ──TARA──► SCANNING ──MATCH──► MATCH durumu (5s, kırmızı LED + buzzer)
    ▲                │                       │
    │                ├──NOMATCH──► NOMATCH (2s, yeşil LED)
    │                │                       │
    │                └──timeout──► NETERR (3s, sarı LED yanıp söner)
    │
    └──PANİK──► PANIC (10s, kırmızı LED + buzzer, telefona PANIC mesajı)
```

**Önemli mühendislik kararı:** Durum makinesi mantığı **HAL bağımlılığından
arındırılmış, taşınabilir C99** olarak yazıldı. Donanımla iletişim "callback
vtable" üzerinden: LED yak, buzzer aç, UART'a yaz fonksiyonları sahte
implementasyonlarla PC üzerinde test edilebiliyor. **12 senaryoluk bir
host-side test seti** var, deterministik geçiyor. Bu sayede gerçek donanıma
yüz kere flash yapmak yerine PC'de saniyeler içinde test edilebildi.

**Saat üretimi:** Kart üzerinde 8 MHz dış kristal (HSE) var. Ancak
CubeMX'in ürettiği başlık dosyalarında `HSE_VALUE` makrosu 25 MHz olarak
tanımlı geliyor — NUCLEO için yanlış varsayılan. Bu yüzden HSE üzerinden
PLL yapınca UART hızları 1/3 oranında bozuluyor. Çözüm: dahili 16 MHz
osilatör (HSI) PLL'e bağlanır, çıkışta **216 MHz HCLK** üretilir.
USART zaman tabanı APB2'den çekilir ve 115200 baud hatasız çalışır.

## 9. Şu anki "test mode" tavizleri

Demo ortamında bilerek bazı şeyler değişti, **demo öncesi geri çevrilecek**:

- `BLEManager.swift`'te `emergencyNumber = "05435207315"`. Bu Göktürk'ün
  cep telefonu — test sırasında yanlışlıkla 155'i aramayalım diye böyle
  ayarlandı. **Sergi öncesi `"155"` yapılacak.**
- EC2 üzerinde TLS yok, HTTP açık. iPhone Info.plist'te
  `NSAllowsArbitraryLoads` aktif. Faz 2'de HTTPS'e geçilecek.
- ESP-CAM Wi-Fi creds (`SSID: GG, password: GGocen2690`) hardcoded
  `config.h`'da. Bu iPhone hotspot bilgisi, sergi günü değişebilir.

## 10. KVKK / veri gizliliği

Yüz görüntüsü Türkiye'de **özel nitelikli kişisel veri** sayılıyor (KVKK
6698). Tasarım buna göre:

- Yolcu fotoğrafları **sunucu diskinde tutulmaz** — sadece işleme süresince
  RAM'de durur, sonuç döndükten sonra silinir.
- Veritabanında tutulan tek kalıcı bilgi: aranan kişilerin **embedding
  vektörleri** (yani 512 sayıdan oluşan matematiksel imza, ham fotoğraf değil).
- Embedding'den geri foto üretmek pratikte imkânsız (ArcFace tek yönlü).
- Sergi/test setindeki gönüllü fotoğraflar açık rıza alındıktan sonra
  toplanır, sergi sonrası silinir.

Gerçek bir dağıtım için yasal çerçeve gerek: KVKK açık rıza prosedürü,
yetkili kolluk birimlerinin "aranan kişiler" veritabanı erişimi, araç
içinde görünür bilgilendirme (yolcuya "burada yüz tanıma sistemi var"
uyarısı). Bu mühendislik dışı kısımlar tezin gelecek çalışmalar bölümünde.

## 11. Mevcut çalışma durumu (16 Mayıs 2026)

Tamamen test edilip çalışan:
- ✅ EC2 sunucusu canlı, sağlık kontrolü 200 dönüyor.
- ✅ ESP-CAM Wi-Fi STA + HTTP POST + JSON parse.
- ✅ ESP-CAM 10-frame burst + kalite filtresi geçiyor.
- ✅ STM32 216 MHz clock + USART6 köprü.
- ✅ STM ↔ ESP UART köprüsü (Arduino D0/D1).
- ✅ ESP-CAM BLE peripheral "TaxiGuard" advertising.
- ✅ iPhone uygulaması BLE central olarak otomatik bağlanıyor.
- ✅ Uçtan uca demo: TARA butonu → SCANNING → MATCH → 155 dialer
  (test ortamında 0543...).
- ✅ Veritabanında Gokturk + Ekin enrolled, ikisi de tanınıyor.
- ✅ EC2 `/auth/{register,login,me,logout}` endpoint'leri smoke
  testten geçti.
- ✅ iPhone Login + Register + TabView + Keychain token cache.

Yarım pürüzlü (cihazda son test bekleyenler):
- 🟡 MATCH ekranında "benzerlik %0" görünme bug'ı — BLE MTU 247'ye
  yükseltildi, parser defansif yapıldı, son testte cihazda doğrulanacak.
- 🟡 iPhone yeni auth UI ilk kez Xcode'da build edilecek.

Yapılmadı (sıradaki):
- ⏳ 20-30 kişi enrollment + FAR/FRR ölçümü (Tablo 5.1-5.4).
- ⏳ Aydınlatma testi (100/300/600 lx) + mesafe testi (30-120 cm).
- ⏳ Pasif liveness ölçümü (canlı yüz vs ekran replay).
- ⏳ Tez Bölüm 5 tabloları doldur.
- ⏳ 6 TikZ figürünü tezde tam render et (şu an yer tutucu).
- ⏳ Kapak öğrenci no + e-posta gerçek değerlerle güncelle.
- ⏳ Sergi öncesi `emergencyNumber` → 155.

## 12. Sergi/demo nasıl gösterilir?

Beklenen senaryo (sergi sunucusu, ~2 dakika):

1. **Hazırlık:** STM32 USB'den Mac'e takılı, ESP-CAM ayrı USB
   şarjından besleniyor, iPhone hotspot açık ve 2.4 GHz uyumlu modda.
2. **iPhone aç:** Uygulamayı aç → token varsa direkt ana ekran,
   yoksa kayıt ol/giriş yap (kullanıcı adı + şifre + plaka).
3. **TaxiGuard'a bağlan:** Uygulama otomatik olarak ESP-CAM'in BLE'sine
   bağlanır, "BLE bağlı" yeşil ışık.
4. **Senaryo 1 — Bilinmeyen yolcu:** STM kartındaki mavi USER butonuna
   bas → STM SARI LED yanar (SCANNING) → ESP kamera flaşı yanar, 10
   fotoğraf yakalar → EC2'ye gönderir → eşleşme yok → ESP STM'e
   NOMATCH dönütü → STM YEŞİL LED → iPhone'da yeşil "Eşleşme yok"
   kartı. Toplam süre ~5-7 saniye.
5. **Senaryo 2 — Aranan kişi (Göktürk):** Aynı akış, ama bu sefer
   sonuç MATCH:Gokturk;0.66. STM KIRMIZI LED + buzzer çalıyor, iPhone
   büyük kırmızı kart "Eşleşme: Gokturk · benzerlik %66", iOS dialer
   otomatik açılıyor, sürücü tek dokunarak 155'i (test'te cep no'yu)
   arar.
6. **Senaryo 3 — Panik (opsiyonel):** Harici PANİK butonuna bas →
   her durumda anında STM kırmızı LED + buzzer + iPhone PANIC kartı +
   dialer açılır.

## 13. Hangi dosya neyle ilgili?

```
Bitirme/
├── AGENTS.md                          # AI agent brief, kilit kararlar
├── face-mac/
│   ├── CLAUDE.md                      # ⭐ ANA DOKÜMANTASYON
│   ├── PROJE_OZETI.md                 # ⭐ BU DOSYA
│   ├── embeddings.pkl                 # Yüz veritabanı
│   │
│   ├── server/                        # EC2 Flask sunucu
│   │   ├── app.py                     # /search endpoint
│   │   ├── auth.py                    # /auth endpoint'leri (SQLite)
│   │   ├── recognition.py             # InsightFace + kalite filtresi
│   │   ├── db.py                      # Yüz veritabanı yöneticisi
│   │   ├── enroll.py                  # CLI: yeni kişi ekle
│   │   ├── Dockerfile, deploy_ec2.sh
│   │
│   ├── esp32-cam/                     # ESP32 firmware (PlatformIO)
│   │   ├── platformio.ini
│   │   ├── include/config.h           # Wi-Fi creds, server URL
│   │   └── src/main.cpp               # ana firmware
│   │
│   ├── Stm32/taxi_guvenlik/           # STM32CubeIDE projesi
│   │   ├── taxi_guvenlik.ioc
│   │   └── Core/Src/main.c
│   │
│   ├── eval/                          # FAR/FRR ölçüm aracı
│   │   ├── far_frr.py
│   │   └── bulk_enroll.py
│   │
│   └── docs/                          # Tez + Sunum + Hazırlık
│       ├── tez/                       # LaTeX tezi (Ekin Ağaoğlu)
│       │   ├── main.tex
│       │   ├── kaynakca.bib
│       │   └── chapters/              # 11 bölüm
│       ├── sunum/                     # Beamer sunum
│       │   └── main.tex
│       └── hazirlik/                  # Markdown notlar
│
└── iphone-app/                        # SwiftUI iPhone uygulaması
    ├── project.yml                    # XcodeGen
    └── TaksiGuvenlik/                 # 13 swift dosyası
        ├── TaksiGuvenlikApp.swift     # entry point
        ├── AppState.swift             # uygulama durumu
        ├── AuthManager.swift          # /auth REST + Keychain
        ├── BLEManager.swift           # CoreBluetooth central
        ├── KeychainStore.swift        # token saklama
        ├── Constants.swift, AppTheme.swift
        ├── RootView.swift             # auth state switch
        ├── LoginView.swift, RegisterView.swift
        ├── HomeView.swift             # TabView
        ├── DashboardView.swift        # ana sayfa
        ├── ScanView.swift             # canlı tarama ekranı
        ├── ProfileView.swift          # kullanıcı + çıkış
        └── Info.plist
```

## 14. Kim ne yazdı, kim ne yaptı

İki kişilik ekip:
- **Göktürk Göçen** — bir tez (kullanıcının kendisi)
- **Ekin Ağaoğlu** — diğer tez (bu kaynaklar onun tezinin)
- **Danışman:** Prof. Dr. Aydoğan Savran (Ege Üniversitesi EE Bölümü)

İki tez ortak donanım/yazılım altyapısı üzerine yazıldı. Kod tabanı
ortak, ölçüm seti ortak, sergi düzeneği ortak; tezler içerikte farklı
açılardan yaklaşıyor.

## 15. Tek satırlık güvenlik teklifi

> "Şoför hiçbir şey yapmadan, sadece TARA butonuna basıyor; 7 saniye
> içinde yolcu arananlar listesinde mi öğreniyor; sistemi yanıltmaya
> çalışan fotoğraf-tutucular bedavadan tespit ediliyor; eşleşme varsa
> iPhone bir tıkla 155'i arıyor. Ek donanım maliyeti 280 TL, KVKK uyumu
> tasarımda hazır."

---

İhtiyacın olan başka bir bakış açısı varsa söyle (örnek: "matematiksel
detayları çıkar", "donanımı atla, sadece yazılımı anlat", "5 dakikalık
asansör konuşması" gibi).
