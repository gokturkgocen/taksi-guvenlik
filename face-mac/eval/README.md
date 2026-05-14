# Evaluation Harness — FAR / FRR Measurement

Bu klasör, taksi yüz-tanıma servisinin doğruluk metriklerini (FAR, FRR, EER)
ölçmek için yazılmış offline araç setini içerir. Donanım gelmeden, sadece
mevcut EC2 sunucusuna karşı çalışabilir.

İki ayrı script var:

| Script           | Ne yapar?                                                              |
| ---------------- | ---------------------------------------------------------------------- |
| `bulk_enroll.py` | Bir gallery klasörünü (`<isim>/<foto>.jpg`) toplu olarak DB'ye yazar.  |
| `far_frr.py`     | Probe setini çalışan sunucuya burst olarak gönderir, FAR/FRR raporlar. |

İkisi birlikte standart akış:

```bash
# 1) Test setini yerel pickle'a enroll et
python bulk_enroll.py /path/to/gallery --db /tmp/run_001.pkl --clear

# 2) DB'yi EC2'ye taşı + container'a kopyala
scp -i /Users/gokturkgocen/Bitirme/taxi-key.pem \
    /tmp/run_001.pkl ec2-user@18.192.45.175:/tmp/
ssh -i /Users/gokturkgocen/Bitirme/taxi-key.pem ec2-user@18.192.45.175 \
    'docker cp /tmp/run_001.pkl taxi-server:/app/data/embeddings.pkl \
     && docker restart taxi-server'

# 3) FAR/FRR ölçümü
python far_frr.py \
    --dataset /path/to/probe_set \
    --gallery Alice_Yilmaz,Bob_Demir,Carol_Soylu \
    --server http://18.192.45.175:8000 \
    --frames 10 \
    --out results/run_2026_05_14.csv
```

## Veri seti düzeni

Hem gallery hem probe seti aynı düzeni kullanır:

```
gallery/
├── Alice_Yilmaz/
│   ├── 01.jpg
│   ├── 02.jpg            ← bulk_enroll en kaliteli olanı seçer
│   └── 03.jpg
├── Bob_Demir/
│   └── 01.jpg
└── Carol_Soylu/
    └── 01.jpg
```

```
probe_set/
├── Alice_Yilmaz/         ← gallery'de var → genuine probe
│   ├── morning.jpg
│   └── 600lx.jpg
├── Bob_Demir/            ← gallery'de var → genuine probe
│   ├── close_30cm.jpg
│   └── far_120cm.jpg
├── _stranger_01/         ← gallery'de YOK → impostor probe
│   └── face.jpg
└── _stranger_02/
    └── face.jpg
```

Klasör adları "gerçek kimlik" olarak yorumlanır. `--gallery` listesinde adı
geçen klasörler **genuine**; geçmeyen tüm klasörler **impostor** olarak
sayılır.

## Çıktılar

`--out results/run_001.csv` verdiğinde 4 dosya üretir:

| Dosya                      | İçerik                                                    |
| -------------------------- | --------------------------------------------------------- |
| `run_001.csv`              | Her probe için bir satır (sim, matched_name, category…)   |
| `run_001_sweep.csv`        | τ ∈ [0, 1] eşiğinde FAR/FRR/TA/FA tablosu (101 satır)     |
| `run_001_summary.json`     | EER eşiği, operating point, sayımlar — tek bakışta özet   |
| `run_001_roc.png`          | FAR-FRR eğrisi + EER işaretli (matplotlib varsa)          |

Stdout'a EER (eşit hata oranı) ve `--max-far 0.01` altındaki en iyi
operating point yazılır:

```
=== summary ===
  probes: 64 (genuine=40, impostor=24)
  quality-failed bursts: 2
  transport errors: 0
  EER ≈ 0.0250  @ threshold 0.43  (FRR 0.0250)
  best @ FAR ≤ 0.010: τ=0.47  TA=37  FA=0  FAR=0.0000  FRR=0.0750
```

## Burst boyutu seçimi

`--frames 10` ESP32-CAM'in gerçek davranışıyla aynı (5 fps × 2 s).
Server `MIN_QUALITY_FRAMES=5` (varsayılan) ile en az 5 kalite-geçen frame
istiyor; tek bir kare gönderirsen `insufficient_quality_frames` döner ve
similarity rapor edilmez. Smoke test için bile `--frames 10` kullan.

## Sunucu eşik değeri

`server/app.py` içindeki `MATCH_THRESHOLD` env var'ı sunucunun kendi
karar verdiği eşik (varsayılan **0.40**). Harness bu eşiği değiştirmek
yerine **ham similarity değerlerini** kaydeder ve τ üzerinde offline sweep
yapar — yani sweep tablosu sunucuyu yeniden başlatmadan tüm aralığı
gösterir.

Üretim eşiğini yeni veriyle değiştirmek istersen, sweep CSV'sinden seçtiğin
τ'yu Docker env olarak ver:

```bash
ssh ec2-user@18.192.45.175 \
    'docker run -d --restart unless-stopped --name taxi-server \
       -p 8000:8000 -e MATCH_THRESHOLD=0.47 \
       -v /home/ec2-user/data:/app/data taxi-server:latest'
```

## Hızlı smoke test (donanım yokken)

EC2'de `Gokturk` ve `Ekin` enrolled olduğuna göre, tek bir fotoğrafla
mevcut servisi anlık doğrulamak için:

```bash
# Senin yüzünden bir foto al, gokturk/ klasörüne koy
mkdir -p /tmp/smoke/Gokturk
cp ~/Desktop/me.jpg /tmp/smoke/Gokturk/01.jpg

# (impostor için Internet'ten bir random foto)
mkdir -p /tmp/smoke/stranger_01
cp ~/Downloads/random_face.jpg /tmp/smoke/stranger_01/01.jpg

python far_frr.py \
    --dataset /tmp/smoke \
    --gallery Gokturk,Ekin \
    --server http://18.192.45.175:8000 \
    --frames 10 \
    --out results/smoke.csv
```

Beklenen: `Gokturk/01.jpg` → matched=Gokturk, sim ≥ 0.5; `stranger_01/*` →
ya match=False ya çok düşük similarity.

## Gerekli paketler

`face-mac/server/requirements.txt` zaten çoğunu içeriyor. Eval için ek
olarak:

```bash
pip install requests matplotlib
```

`matplotlib` opsiyonel — yoksa ROC plot atlanır, CSV'ler yine yazılır.
