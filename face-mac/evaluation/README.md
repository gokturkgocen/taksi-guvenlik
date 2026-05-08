# Evaluation — tez metrik ölçümleri

Rapor Bölüm 5.2'deki kabul testlerini otomatikleştiren scriptler. Her biri CSV
üretir, `analyze_events.py` matplotlib ile PDF grafik yapar.

## Kullanım

```bash
cd ~/Bitirme/face-mac
source venv/bin/activate

# 1) FAR / FRR — farklı threshold'larda yanlış kabul/ret oranları
python evaluation/test_far_frr.py \
  --known known_faces/ \
  --unknown unknown_faces/ \
  --out results_far_frr.csv

# 2) E2E latency — 60 sn webcam'den frame alıp pipeline süresini ölç
python evaluation/test_latency.py --seconds 60 --out results_latency.csv

# 3) Spoof detection rate — baskı/telefon/video saldırılarına karşı
python evaluation/test_spoof.py --attacks spoof_samples/ --out results_spoof.csv

# 4) Runtime event analizi — canlı sırada oluşan events.jsonl'ı görselleştir
python evaluation/analyze_events.py events.jsonl --out plots/
```

## Dataset hazırlığı

### `known_faces/` (zaten var, enrollment için)
```
known_faces/
├── Gokturk/
│   ├── 1.jpg
│   └── 2.jpg
├── Ekin/
│   └── 1.jpg
```

### `unknown_faces/` (FAR ölçümü için)
20–30 farklı kişinin fotoları, DB'de olmayan. LFW dataset'inden indirebilirsin:
http://vis-www.cs.umass.edu/lfw/lfw-funneled.tgz
(sadece birer foto yeter)

### `spoof_samples/` (spoof testi için)
```
spoof_samples/
├── print/        # duvara bantladığın baskı fotolar — webcam'le çekim
│   ├── print1.mp4
│   └── print2.mp4
├── screen/       # telefondan gösterilen fotolar
│   ├── phone1.mp4
│   └── phone2.mp4
└── replay/       # video replay (telefonda oynatılan video)
    └── replay1.mp4
```
Her video ~10 sn, içinde sadece spoof attack olsun. Script her frame'in
"canlı mı spoof mu" kararını ölçer, detection rate hesaplar.

## Çıktıların tezde nereye gidiyor

| Script | Tez bölümü | Grafik |
|---|---|---|
| `test_far_frr.py` | 5.2 Doğruluk | ROC eğrisi, EER |
| `test_latency.py` | 5.2 E2E gecikme | Histogram, p50/p95/p99 |
| `test_spoof.py` | 5.2 Anti-spoof | Bar chart (attack type × detection rate) |
| `analyze_events.py` | 4.2 Ara sonuçlar | Timeline, karar dağılımı |
