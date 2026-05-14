# face-mac/docs — Tez, Sunum, Hazırlık

Bu klasör, projenin akademik çıktıları için yazılan kaynak dosyaları
toplar.

| Klasör | İçerik |
|---|---|
| `tez/`        | Lisans bitirme tezi LaTeX kaynağı (chapters + bibliografi) |
| `sunum/`      | Jüri defansı + sergi sunumu (Beamer) |
| `hazirlik/`   | Donanım bring-up planı, sergi kurulum kılavuzu, küçültülmüş test seti planı |

## Hızlı bakış

**Tez:**
```bash
cd face-mac/docs/tez
latexmk -pdf main.tex          # main.pdf üretir
```

**Sunum:**
```bash
cd face-mac/docs/sunum
latexmk -pdf main.tex          # main.pdf (16:9 slaytlar)
```

**Hazırlık dokümanları:** sadece markdown; doğrudan oku, GitHub'da da
güzel render edilir.

## Tez ve sunum tutarlılığı

Hem tez hem sunum:
- Aynı renk paletini kullanır (ink `#11162A`, brass `#8C631A`, oxblood `#9C2A21`)
- Aynı TikZ diyagramlarını paylaşır (sistem mimarisi + FSM)
- Aynı tablo isimlendirmesini kullanır (Tablo 5.1, 5.2, ...)
- Aynı yöntem kararlarına atıfta bulunur

Tutarlılık jüri için önemli; sunumda bir slayttaki diyagramın tezdeki
versiyonuyla aynı olması güven verir.

## Henüz tamamlanması gereken alanlar

| Yer | Eylem |
|---|---|
| `tez/chapters/00_kapak.tex` | Öğrenci numarası placeholder |
| `tez/chapters/05_sonuclar.tex` | Tablo 5.1--5.4: ölçüm sonrası dolacak |
| `tez/kaynakca.bib` | İhtiyaç olursa yeni referans ekle |
| `sunum/main.tex` slayt 16 | Mevcut durum sergi gününde güncellenmeli |
| `hazirlik/kucuk_test_seti.md` | Gönüllü isimleri |
| `hazirlik/sergi_demo_kurulumu.md` | Sergi günü detayları (lokasyon, saat) |
