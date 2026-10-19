# OCR Worker

`ocr.html`'den gelen fotoğrafı Google Cloud Vision'a gönderip okunan metni döndüren Cloudflare Worker'ı.
Adres: https://inapp-ocr-3a8f.burakkagancan.workers.dev

## Korumalar
- **İstek sınırı:** IP başına dakikada 6, toplamda dakikada 30 okuma (Cloudflare konumu başına; yaklaşık sayım). Aşınca 429 ve Türkçe mesaj.
- **Köken denetimi:** Yalnızca `ALLOWED_ORIGIN` adresleri kabul edilir (virgülle birden çok adres yazılabilir; panelde tanımlı).
- **Boyut ve biçim:** En fazla ~4 MB; yalnızca JPEG, PNG, WebP.
- **Hata kaydı (15.10.2026):** Workers Logs açık, ama yalnızca Worker'ın kendi `kayit()` satırları yazılır: olay adı (ör. `vision_hata`, `vision_kota`, `vision_zaman_asimi`, `sinir_ip`, `sinir_genel`, `sinir_barkod`, `yonetim_yetkisiz`, `beklenmeyen`) ve en çok 200 karakter ayrıntı. IP, fotoğraf, okunan metin, barkod ve katkıcı kimliği yazılmaz (`worker/test.mjs` denetler). İstek kayıtları (`invocation_logs`, IP ve başlık içerir) `wrangler.toml`'da kapalı. Görmek için: panel → Workers & Pages → `inapp-ocr-3a8f` → Observability → Logs. Ücretsiz planda günde 200.000 satıra kadar, 3 gün saklanır.
- **Yakalanmayan hata:** (ör. D1 kesintisi) Cloudflare'in CORS'suz hata sayfası yerine JSON 500 döner ve `beklenmeyen` satırı yazılır (yolun yalnızca ilk parçası, ör. `/urun`).
- **Zaman aşımı:** Vision 20 saniyede yanıt vermezse istek kesilir.
- **Topluluk doğrulaması (19.10.2026):** Katkıcı kimliğini cihaz kendisi ürettiği için tek başına "farklı kişi"yi kanıtlamaz. Her içerik katkısı ve besin tablosuyla bir *iz* saklanır: gizli `KATKI_TUZ` anahtarıyla IP (IPv6'da ilk 64 bit) + barkoddan türetilen 16 haneli özet. IP saklanmaz; iz barkoda özgüdür. Aynı izden iki katkı birbirini doğrulamaz, bir barkoda aynı izden en çok 2 katkı/tablo girer; aynı kimlik bir barkodda tek satırdır. `KATKI_TUZ` panelde Secret olarak tanımlanmazsa iz yazılmaz.

## Dağıtım (Cloudflare Workers Builds)
1. Cloudflare paneli → Workers & Pages → `inapp-ocr-3a8f` → Settings → Builds → **Connect**.
2. GitHub'ı bağla, `burakkagancan-ux/umi` deposunu seç. Dal: `main`. **Root directory: `worker`**. Deploy command: `npx wrangler deploy` (varsayılan).
3. Varsa "Build watch paths" alanına `worker/*` yaz; böylece günlük veri güncellemeleri gereksiz dağıtım tetiklemez.
4. `VISION_KEY` ve `ALLOWED_ORIGIN` panelde kalır, dağıtım onları silmez (`keep_vars = true`).

`wrangler.toml` içindeki `name`, paneldeki Worker adıyla aynı olmalıdır.

## Test
`node worker/test.mjs` — Vision ve istek sınırı taklit edilerek 13 durum denenir.
`node worker/test_topluluk.mjs` — topluluk uç noktaları (/aranan, /topluluk), barkoda bağlı besin tablosu (/besin), katkı izi ve sayaçlar (yarıda kalan kurulum dahil), D1 yerine gerçek SQLite ile (Node 22.13+).
`node worker/test_yonetim.mjs` — yönetim sayfası: listeler, silme, İşlem Kaydı ve geri alma, sayaç farkları.

## Veritabanını geri yükleme (D1 Time Travel)
D1 son 7 günün (ücretsiz plan) her anına geri dönebilir; ayrıca kurmak gerekmez. Geri yükleme veritabanının tamamının üzerine yazar
(o andan sonraki bütün katkılar gider), bu yüzden tek satır için yönetim sayfasındaki İşlem Kaydı → Geri Al kullanılır.
```
npx wrangler d1 time-travel info tagsis-urunler --timestamp=<unix saniye>      # o anın yer imi
npx wrangler d1 time-travel restore tagsis-urunler --timestamp=<unix saniye>   # çıktıdaki eski yer imiyle geri alınabilir
```

## Ek güvence (kod dışı)
Google Cloud Console → APIs & Services → Cloud Vision API → Quotas → "Requests per minute" değerini düşürmek, Worker atlatılsa bile harcamaya üst sınır koyar.
