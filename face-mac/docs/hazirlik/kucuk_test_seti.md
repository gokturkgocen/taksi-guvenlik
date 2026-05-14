# Küçültülmüş Test Seti Planı

20--30 kişilik orijinal hedef yerine pratik düzeyde uygulanabilen
5--8 kişilik bir test seti planı.

## Gönüllüler (hedef sayı 5--8)

| # | Kişi | Rolü |
|---|---|---|
| 1 | Göktürk Göçen   | Proje ekibi (zaten DB'de) |
| 2 | Ekin Ağaoğlu    | Proje ekibi (zaten DB'de) |
| 3 | --- | Yakın arkadaş 1 |
| 4 | --- | Yakın arkadaş 2 |
| 5 | --- | Yakın arkadaş 3 |
| 6 | --- | (opsiyonel) |
| 7 | --- | (opsiyonel) |
| 8 | --- | (opsiyonel) |

> Gönüllülerden **yazılı veya sözlü açık rıza** alınması zorunludur.
> Onay formu örneği bu klasörde `riza_formu.md` olarak ayrıca üretilebilir.

## Veri toplama protokolü

Her gönüllüden:

### Enroll seti (DB'ye girecek)
- 1 adet enroll fotoğrafı
  - Frontal poz, $|$yaw$|$ < 10°
  - 60 cm mesafe
  - 300 lx ofis aydınlatması
  - Düz arka plan
  - Çözünürlük min 320×240, sensor max'tan tercih

### Probe seti (test edilecek)

| Etiket | Aydınlatma | Mesafe | Açıklama |
|---|---|---|---|
| probe_100lx_60cm.jpg  | 100 lx | 60 cm  | Akşam taksi içi |
| probe_300lx_60cm.jpg  | 300 lx | 60 cm  | Gündüz baseline |
| probe_600lx_60cm.jpg  | 600 lx | 60 cm  | Açık hava |
| probe_300lx_30cm.jpg  | 300 lx | 30 cm  | Yakın çekim |
| probe_300lx_120cm.jpg | 300 lx | 120 cm | Uzak çekim |
| probe_replay.jpg      | 300 lx | 60 cm  | Telefondan gösterilen (liveness testi) |

Her etiket en az 1 adet, mümkünse 2 adet (statistical önem için).

### Klasör yapısı

```
test_set/
├── Gokturk/
│   ├── enroll.jpg
│   ├── probe_100lx_60cm.jpg
│   ├── probe_300lx_60cm.jpg
│   ├── probe_600lx_60cm.jpg
│   ├── probe_300lx_30cm.jpg
│   ├── probe_300lx_120cm.jpg
│   └── probe_replay.jpg
├── Ekin/
│   └── ...
└── ...
```

Impostor için: kamuya açık yüz veri setlerinden seçilmiş 3--5 fotoğraf,
`_impostor_001/`, `_impostor_002/` klasörlerine. CC-lisanslı LFW
örneklerinden seçilebilir.

## Ölçüm akışı

```bash
# 1) Test seti hazır olduktan sonra DB'ye enroll
cd face-mac/eval
python bulk_enroll.py /path/to/test_set --db /tmp/test.pkl --clear

# 2) EC2'ye yükle + container restart
scp -i ~/Bitirme/taxi-key.pem /tmp/test.pkl \
    ec2-user@18.192.45.175:/tmp/
ssh -i ~/Bitirme/taxi-key.pem ec2-user@18.192.45.175 \
    'docker cp /tmp/test.pkl taxi-server:/app/data/embeddings.pkl && \
     docker restart taxi-server'

# 3) Ölçüm (gallery: kayıtlı isimleri virgülle listele)
python far_frr.py \
    --dataset /path/to/test_set \
    --gallery Gokturk,Ekin,Friend1,Friend2,Friend3 \
    --server http://18.192.45.175:8000 \
    --frames 10 \
    --out results/run_$(date +%Y%m%d).csv
```

## Çıktılar tezi nasıl besler?

Üretilen 4 dosyadan tezin Bölüm 5'i şu şekilde doldurulur:

| Çıktı | Hedef tablo |
|---|---|
| `run_*_summary.json` → `eer_threshold`, `operating_point` | Bölüm 5.3 "Eşik Optimizasyonu" |
| `run_*.csv` → category × condition group | Tablo 5.1, 5.2 (aydınlatma, mesafe) |
| `run_*.csv` → liveness_score for genuine vs replay | Tablo 5.3 (liveness) |
| `run_*_sweep.csv` → ROC interp values | Şekil 5.x (ROC eğrisi) |
| `run_*_roc.png` → direkt | Şekil 5.x (ROC) |

## Notlar

- Eşit Hata Oranı (EER) küçük örneklemde geniş güven aralıklı çıkar.
  Tezde mutlaka n=... ve test koşulu belirtilmeli. ``Bu sonuç, n=24 probe
  ile 5 gallery üzerinde alınmıştır'' gibi.
- Pasif canlılık ($\sigma$) değerleri, gerçek yüz ile replay arasında
  yaklaşık 1 derece büyüklük farkı gösterir (literatür tahmini). Bizim
  ölçümler bu örüntüyü onaylamalı; eğer onaylamıyorsa, replay protokolünü
  gözden geçir.
- Ölçüm sırasında EC2 sunucusunun yapılandırılmış log'unu kayıt et:
  ```bash
  ssh ec2-user@18.192.45.175 'docker logs taxi-server' > eval_logs.txt
  ```
  Bu sayede her burst için latency dağılımı da raporlanabilir.

## Etik notu

Gönüllü fotoğrafları:
- Tezde **görsel olarak yer almaz** (yalnızca metrik değerler).
- Sergi sonrası **silinir**.
- Embedding vektörleri de sergi sonrası DB'den temizlenir.

Bu, hem KVKK kapsamı hem de proje etiği açısından zorunludur.
