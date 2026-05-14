# Sergi Demo Kurulumu

Bu doküman, bitirme sergisinde standı kurarken yapılacakları sıraya
sokar. Sergi günü içinde stres altında işe yarayacak bir kontrol listesi
olarak yazılmıştır.

---

## Sergiye getirilecek malzeme

### Donanım
- [ ] STM32 NUCLEO-F767ZI + USB kablo
- [ ] ESP32-CAM AI-Thinker + bağlı USB-TTL dönüştürücü (USB-A → mikro USB)
- [ ] HM-10 BLE modülü (jumper kabloları ile birlikte)
- [ ] Breadboard + 3 LED + 3x 220Ω direnç + aktif buzzer + 2 buton
- [ ] Yedek jumper kablo seti (en az 20 erkek-erkek, 10 erkek-dişi)
- [ ] Multimeter (acil ölçüm için)
- [ ] Demo telefonu (Samsung Galaxy S20 FE, SIM kartlı, TaxiGuard yüklü)
- [ ] Telefon şarjı + power bank
- [ ] Yedek MicroSD kart (ESP-CAM image backup için)

### Bilgisayar
- [ ] Mac (geliştirme), tam şarjlı + şarj cihazı
- [ ] HDMI kablo + dongle (slayt için)
- [ ] USB hub (USB-TTL + STM + ESP-CAM aynı anda bağlı kalsın)
- [ ] Klavye + mouse (opsiyonel)

### Yedek planlar
- [ ] Önceden çekilmiş demo video (telefonda + Mac'te kopyası)
- [ ] Slayt PDF'i (online erişim varsayma, offline'a hazır)
- [ ] Poster baskısı (70×100 cm)
- [ ] Tez basılı kopyası (jüri ister)
- [ ] Yedek hotspot için: alternatif telefon veya MiFi cihaz

### Belgeler
- [ ] Demo kılavuzu yazılı kart (kısa, 1 sayfa)
- [ ] BOM ve bütçe çıktısı (jüri sorarsa)
- [ ] Etik rıza formu (test kişileri için)

---

## Stand kurulumu (sergi açılışından 1 saat önce)

### 1. Donanım kurulumu (~20 dakika)

1. Breadboard'u stand üzerinde sağlam yere koy
2. STM32 + breadboard arası jumper kablolarını adım adım bağla:
   - Önce GND'leri çift kontrol et
   - LED'lerin polaritelerini doğru bağla
   - Buzzer'ın + ucunu PD13'e bağla
3. ESP32-CAM'i USB-TTL üzerinden Mac'e bağla
4. HM-10'u STM UART2'ye bağla (GND + VCC + TX + RX)
5. Mac'ten ESP-CAM monitor'ünü aç (`pio device monitor`)

### 2. Yazılım hazırlığı (~10 dakika)

1. Mac'te terminal aç:
   - Tab 1: ESP-CAM serial monitor
   - Tab 2: STM UART1 monitor (USB-TTL #2 ile)
   - Tab 3: SSH EC2 ile `docker logs -f taxi-server`
   - Tab 4: Hazırda `python far_frr.py --help` (gösterim için)
2. Telefonu Wi-Fi hotspot moduna al, ESP-CAM'in `config.h`'daki SSID ile
   eşleştiğinden emin ol
3. Telefonda TaxiGuard uygulamasını başlat → "Servisi Başlat" → HM-10
   bağlantısı kurulduğunu doğrula
4. Demo telefon arama izinlerini bir kez tetikle (Dev: Simulate MATCH
   butonuyla)

### 3. Doğrulama smoke testi (~10 dakika)

- [ ] TARA butonuna bas → STM SARI LED + UART'ta CAPTURE + ESP burst başlar
- [ ] EC2 logunda `burst_complete` JSON satırı görünür
- [ ] STM RESULT alır → DB'de Gokturk varsa MATCH, yoksa NOMATCH
- [ ] HM-10 → telefon notification doğru frame ile geliyor
- [ ] MATCH durumunda telefon 155'i çeviriyor (TEST: hemen iptal et!)
- [ ] PANİK butonu → kırmızı LED + buzzer + telefon 155 dial

---

## Ziyaretçi sunumu (60--90 saniye)

Standa biri gelirse:

> "Bu, taksi sürücülerinin güvenliği için tasarladığımız bir sistem.
> Sürücü, arka koltuktaki yolcuyu tek butona basarak --- görüyorsunuz ---
> tarayabiliyor. Kameradan alınan 10 karelik bir görüntü öbeği, Wi-Fi
> üzerinden bulutumuza gidiyor ve InsightFace açık kaynak yüz tanıma
> kütüphanesi aranan kişi veri tabanıyla karşılaştırıyor.
>
> [TARA butonuna bas, ekran/STM göstergesine işaret et]
>
> Eşleşme olduğunda kırmızı LED yanıyor, buzzer ötüyor, ve telefon
> otomatik olarak 155'i çağırıyor.
>
> [Telefon ekranını göster, 155 araması başladığını göster, hemen iptal et]
>
> Eşleşme yoksa yeşil LED yanıyor, hiçbir aksiyon olmuyor.
>
> [NOMATCH demo]
>
> Tüm bileşenleri açık kaynak yazılım + ucuz hazır modüllerle yaptık,
> ek donanım maliyeti 500 TL altında. Detaylar poster ve tezde."

## Jüri sorularına hazırlık

### Olası sorular ve kısa cevaplar

**S: Yüz tanıma yanlış pozitif vermez mi?**  
C: Sistemde kosinüs benzerliği eşiği var (varsayılan 0.40). Bu eşik
ölçümlerle belirlendi. Ayrıca 10 karelik bir burst ile çalışıyoruz; tek
karelik snapshot'a göre belirgin biçimde daha gürbüz.

**S: Fotoğraf gösterirsem yine tanır mı? (Liveness)**  
C: Cross-frame embedding standart sapması bizim pasif canlılık
göstergemiz. Canlı yüzde mikro hareketler nedeniyle sıfırdan farklı,
fotoğraf replay'de neredeyse sabit. Aktif canlılık eklemek gelecek
çalışmalardan biri.

**S: Sunucu yoksa ne olur?**  
C: Sistem güvenli moda geçer; 15 saniyelik scan timeout sonrası sarı LED
yanıp söner ve telefona NETERR notification gider. Sürücü çağrı yapmaz,
ama durumdan haberdar olur.

**S: KVKK durumu?**  
C: Yolcu görüntüleri sunucu diskinde tutulmaz; yalnızca işleme süresince
RAM'de. Aranan kişi veri tabanı için yetkili idari/kolluk birimlerinin
girdiği bir senaryo varsayılmış. Detaylar tezin etik bölümünde.

**S: AWS Rekognition gibi hazır bir servis kullansaydık olmaz mıydı?**  
C: Bu yolu reddettik çünkü (1) eşik değeri ve model üzerinde kontrolümüz
olmazdı, (2) KVKK belirsizliği, (3) fiyat değişiklik / kapatma riski.
Açık kaynak InsightFace kendi sunucumuzda → tam kontrol + KVKK uyumlu.

**S: Neden ESP32-CAM, neden STM32-merkezli OV5640 değil?**  
C: İlk plan (Plan A) STM32 DCMI + standalone OV5640'tı. Sergi takvimi
içinde DVP arayüzlü OV5640 modülü bulunamadı. Plan B'de kamera + Wi-Fi
tek board'da, STM olay yöneticisi rolünde kaldı. Tezin Bölüm 3.5'te bu
değişiklik açıkça raporlanmış.

**S: Neden Android, neden iOS değil?**  
C: iOS'un sandbox kısıtı `Intent.ACTION_CALL` dengini desteklemiyor;
kullanıcı dokunması olmadan otomatik arama yapamıyor. Bu projenin "tek
butona bas, dikkat dağıtma" prensibine aykırı.

**S: Test kaç kişiyle yapıldı?**  
C: Sergi takvimi içinde 5--8 kişilik küçültülmüş bir setle yapıldı.
Mimari aynı; ölçeklendirilebilirlik için tasarımda kısıt yok. Daha geniş
ölçekli ölçüm gelecek çalışmalar arasında.

**S: Sergi sırasında çağrı yanlışlıkla 155'i ararsa?**  
C: (Test sırasında) hemen iptal ediyoruz. Aslında çağrı tetikleyiciyi
sergi modunda fake bir numaraya yönlendirmek için bir flag eklenebilir.

---

## Acil durum planları

### Wi-Fi çalışmazsa
1. Telefon hotspot'unu kontrol et (data açık mı, bayrak açık mı)
2. Plan B: Mac'i hotspot olarak kullan
3. Plan C: ESP-CAM'in `config.h`'sını bir başka SSID'ye flash et

### EC2 ulaşılamazsa
1. SSH ile bağlan, `docker ps` → container yaşıyor mu?
2. `docker logs taxi-server --tail 100` → hata var mı?
3. Plan B: Mac üzerinde `python app.py` ile yerel server çalıştır, ESP-CAM
   `config.h`'sini Mac'in IP'sine flash et (önce LAN'da olduklarından emin ol)

### STM32 takılırsa (state stuck)
1. Reset butonuna bas
2. Sorun devam ederse: ST-Link Utility veya CubeProgrammer ile yeniden flash

### Telefon BLE'yi göremezse
1. HM-10'u USB-TTL ile aç, `AT+RESET` AT komutu gönder
2. Telefonun Bluetooth'unu kapat-aç
3. Plan B: Dev modu kullan ("Simulate MATCH" butonu) --- BLE olmadan
   uygulama akışı hâlâ çalışıyor

### Demo telefonu pille biterse
1. Power bank
2. Yedek olarak Mac'te Android Studio emulator'ü açılabilir (uygulama
   yüklü), gerçek BLE olmasa da simulate match çalışır

---

## Sergi sonrası

- [ ] Tüm fiziksel kabloları sök, breadboard düzenli sökülmüş halde
- [ ] STM ve ESP-CAM'in son flash'ı backup'lı (PlatformIO'da `pio run -t buildfs` çıktısı)
- [ ] Telefonu fabrika ayarlarına döndürmeden önce TaxiGuard APK'sını
      yedekle (gelecekte demo için)
- [ ] EC2 instance'ı kapat ya da `docker stop taxi-server` (maliyet)
- [ ] Test fotoğrafları lokal diskte → gönüllülere "silindi" bildirimi
