# Bitirme Tezi — LaTeX Kaynak

Bu klasör, Ekin Ağaoğlu'nun Lisans Bitirme Tezi LaTeX kaynaklarını içerir.
Şablon gelişme raporu (`Ekin_Ag_aog_lu_Gelis_imRaporu.pdf`) ile aynı stilde
tutulmuştur: `report` class, `babel turkish`, Computer Modern.

## Derleme

```bash
# Ana derleme (en kolay yol):
cd face-mac/docs/tez
latexmk -pdf main.tex

# Veya manuel:
pdflatex main
bibtex main
pdflatex main
pdflatex main
```

Çıktı: `main.pdf`. TikZ figürleri kaynaktan otomatik çizilir; ek
görüntü dosyası gerekmiyor.

## Yapı

```
docs/tez/
├── main.tex                       # ana doküman
├── kaynakca.bib                   # BibTeX kaynakça
├── chapters/
│   ├── 00_kapak.tex
│   ├── 00_onsoz.tex
│   ├── 00_ozet.tex                # ÖZET + ABSTRACT
│   ├── 01_giris.tex               # Bölüm 1
│   ├── 02_literatur.tex           # Bölüm 2
│   ├── 03_yontem.tex              # Bölüm 3 — TikZ blok şeması + FSM
│   ├── 04_gerceklestirme.tex      # Bölüm 4
│   ├── 05_sonuclar.tex            # Bölüm 5 — yer tutucu tablolar
│   ├── 06_sonuc_ve_oneriler.tex   # Bölüm 6
│   ├── ek_a_protokol.tex          # Ek A — mesaj çerçeveleri
│   └── ek_b_pin_plani.tex         # Ek B — pin tablosu + bring-up
└── figures/                       # opsiyonel; png/pdf görseller
```

## Henüz tamamlanması gereken yerler

Ölçüm dönemi tamamlandıktan sonra:

1. `chapters/05_sonuclar.tex` — `--` ile doldurulmuş tablolar (Tablo 5.1,
   5.2, 5.3, 5.4) gerçek sayılarla güncellenecek. `far_frr.py` aracının
   ürettiği summary.json ve sweep.csv buraya doğrudan kaynak olur.
2. `chapters/05_sonuclar.tex` — Eşik optimizasyonu satırı ($\tau^\star_{EER}$,
   $\tau^\star_{op}$) ölçüm sonrası doldurulacak.
3. `chapters/04_gerceklestirme.tex` Tablo 4.4 (host-side test sonuçları)
   `make run` çıktısından alınmıştır; donanım üzerinde ek senaryolar
   eklendiğinde güncellenir.
4. `kaynakca.bib` — kullanılan eserler ekleniyorsa girdi ekle.

## Notlar

- Kapakta öğrenci numarası `05200000XXX` placeholder; final teslimden önce
  gerçek numarayla değiştirilecek.
- Şekiller TikZ ile yazılır — düzenleme kolay, PDF içine vektör gömülür.
  PNG/JPG görsel eklemek için `figures/` klasörünü kullan ve
  `\includegraphics{figures/foo.png}` ile çağır.
- IEEE biçimi (`ieeetr`) seçildi; danışman başka bir biçim isterse
  `main.tex`'de tek satır değişir (`\bibliographystyle{...}`).
- LaTeX kurulu değilse: TeX Live (Linux/macOS) ya da MacTeX en kolay yol.
  Online derleyici olarak Overleaf'e dosyaları yükleyip aynı şekilde
  derleyebilirsin.
