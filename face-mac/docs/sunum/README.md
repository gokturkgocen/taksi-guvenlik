# Bitirme Sunumu (Beamer)

LaTeX Beamer ile yazılmış jüri defansı + sergi sunumu. Hedef süre
~15 dakika; 16:9 oranlı (HDMI projeksiyon için).

## Derleme

```bash
cd face-mac/docs/sunum
latexmk -pdf main.tex
```

Çıktı `main.pdf`. Tez ile aynı renk paleti ve TikZ çizimleri kullanılır;
harici görsel gerektirmez.

## Slayt akışı

| # | Konu |
|---|---|
| 1 | Kapak |
| 2 | Sunum akışı |
| 3 | Problem |
| 4 | Tasarım hedefleri |
| 5 | Yüz tanıma yöntem seçimi |
| 6 | Tek snapshot vs.\ multi-frame burst |
| 7 | Acil çağrı: BLE vs.\ GSM |
| 8 | Sistem mimarisi (TikZ) |
| 9 | Veri akışı (10-frame burst) |
| 10 | Donanım listesi (BOM) |
| 11 | Sunucu — Flask + InsightFace |
| 12 | STM32 olay yöneticisi |
| 13 | Android — TaxiGuard v2 |
| 14 | Ölçüm harness'ı |
| 15 | Ölçüm planı — 3 eksen |
| 16 | Mevcut durum (test edilen / kalan) |
| 17 | Özgün katkılar |
| 18 | Gelecek çalışmalar |
| 19 | Teşekkürler / Sorular |

## Sergi varyantı

Defans sunumunda ``Mevcut Durum'' slaydını atlamayabilirsin. Sergide
ziyaretçilere göstermek için aynı dosya kullanılabilir; demo videosunu
sona eklemek istersen:

```latex
\begin{frame}[plain]
    \includegraphics[width=\linewidth]{figures/demo_screenshot.png}
\end{frame}
```

(`figures/` klasörü ekle, görselleri yerleştir.)

## Notlar

- `seahorse` color theme + minimal infolines outer. Footer slayt numarası
  gösterir, üst bar yok (dikkat dağıtmasın).
- Tez ile aynı renk paleti: ink (\#11162A), accent altın (\#8C631A),
  signal oxblood (\#9C2A21).
- TikZ diagramları tezdekiyle bire bir aynı; tutarlılık için
  jüriye gösterirken kafa karıştırmaz.
