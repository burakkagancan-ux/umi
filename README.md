# Umi

Gıda, kozmetik ve temizlik ürünlerinin etiketindeki içerik listesini fotoğraftan okuyup analiz eden, ayrıca Tarım ve Orman Bakanlığı taklit/tağşiş listesini gösteren bir PWA.

Site: https://burakkagancan-ux.github.io/umi/

## Ne yapar

- **Liste:** Bakanlığın taklit/tağşiş listesi (firma ve ürün arama). Veri her gün otomatik güncellenir.
- **Etiket Oku:** Etiket fotoğrafından (ya da yazılan metinden) içerikleri okur; Gıda, Kozmetik ve Temizlik modları vardır.
  - Gıda: E kodları, bileşen grupları, birlikte dikkat edilecek eşleşmeler, günlük kabul edilebilir alım, üretim yolu.
  - Kozmetik: AB 1223/2009 ekleri, CosIng INCI listesi, tartışmalı madde notları.
  - Temizlik: H/EUH/P ifadeleri, deterjan içerik grupları, karıştırma uyarıları.
  - İki gıda ürününü karşılaştırma ve sonucu görsel olarak paylaşma.
- **Ansiklopedi:** E kodları için kaynaklı madde sayfaları.
- **Profilim:** Alerjen, vegan, hamilelik, bebek, PKU, tuz kısıtlaması gibi profillere göre kişisel uyarılar.

## İlkeler

- Puan ya da skor yoktur. Maddeler risk seviyesiyle (yeşil, sarı, kırmızı), alerjenlerle ve profil uyarılarıyla gösterilir. Kırmızı yalnızca kişisel uyarılarda kullanılır.
- Uygulama "güvenli" ya da "uygun" demez; "bulunamadı, bu bir onay değildir" der. Her uyarı kaynağa bağlanır.
- Sponsorlu içerik etiketlidir ve sonucu etkilemez.
- Okunan metin yalnızca cihazda saklanır.

## Yapı

Düz HTML/JS; derleme adımı yoktur.

| Yol | İçerik |
| --- | --- |
| `index.html`, `ocr.html`, `ansiklopedi.html` | Sayfalar |
| `js/` | Saf mantık (`gida.js`, `kozmetik.js`, `temizlik.js`, …) ve arayüz (`arayuz*.js`) |
| `data/` | Üretilmiş JSON verisi (uygulama bunu okur) |
| `kaynak/` | Elle yazılan kaynak veri (JSON/TSV) |
| `gen_*.py` | `kaynak/` → `data/` üreteçleri |
| `worker/` | OCR için Cloudflare Worker (Google Cloud Vision; Tesseract.js yalnızca Worker adresi boşsa) |
| `test/` | Testler |
| `sw.js`, `manifest.webmanifest` | PWA |

## Geliştirme

Yerelde çalıştırma:

```
python3 -m http.server 8765
```

Sonra http://localhost:8765/ adresini açın.

Veri üretimi (sırası önemlidir):

```
python3 gen_e_kodlari.py && python3 gen_bilesenler.py && python3 gen_e_aciklama.py \
  && python3 gen_kozmetik.py && python3 gen_eslesmeler.py && python3 gen_temizlik.py \
  && python3 gen_ansiklopedi.py
```

Veri değiştiren değişiklik, üretilen `data/` dosyalarını da içermelidir.

Testler (Node.js): `node test/cases.js`, `node test/sozdizimi.js`, `node worker/test.mjs` ve `test/` altındaki diğerleri. Tümü her PR'da CI ile çalışır (`.github/workflows/test.yml`).

Yeni bir `js/` dosyası eklenirse `ocr.html` ve `sw.js` içindeki `CORE` listesi ile `CACHE` sürümü güncellenir.

## Daha fazlası

Ayrıntılı kararlar, veri kaynakları ve bilinen sınırlamalar için [CLAUDE.md](CLAUDE.md) ve konu dosyaları [belgeler/mimari/](belgeler/mimari/), ertelenen işler için [TEKNIK_BORC.md](TEKNIK_BORC.md).

## Lisans

Tüm hakları saklıdır (bkz. [LICENSE](LICENSE)). Depo şeffaflık için görünürdür; kod ve veri yazılı izin olmadan kopyalanamaz, başka bir üründe ya da veritabanında kullanılamaz. Üçüncü taraf verileri (AB CosIng, Open Food Facts madde sözlüğü ve barkodlu ürün verisi (ODbL), ZXing barkod kütüphanesi (Apache 2.0), resmi mevzuat metinleri) kendi lisanslarına tabidir; kaynakları ilgili dosyanın başında yazılıdır.
