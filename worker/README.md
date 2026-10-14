# OCR Worker

`ocr.html`'den gelen fotoğrafı Google Cloud Vision'a gönderip okunan metni döndüren Cloudflare Worker'ı.
Adres: https://inapp-ocr-3a8f.burakkagancan.workers.dev

## Korumalar
- **İstek sınırı:** IP başına dakikada 6, toplamda dakikada 30 okuma (Cloudflare konumu başına; yaklaşık sayım). Aşınca 429 ve Türkçe mesaj.
- **Köken denetimi:** Yalnızca `ALLOWED_ORIGIN` adresleri kabul edilir (virgülle birden çok adres yazılabilir; panelde tanımlı).
- **Boyut ve biçim:** En fazla ~4 MB; yalnızca JPEG, PNG, WebP.
- **Kayıt yok:** Kodda `console.log` yok; `wrangler.toml` içinde gözlemlenebilirlik (Workers Logs) kapalı.
- **Zaman aşımı:** Vision 20 saniyede yanıt vermezse istek kesilir.

## Dağıtım (Cloudflare Workers Builds)
1. Cloudflare paneli → Workers & Pages → `inapp-ocr-3a8f` → Settings → Builds → **Connect**.
2. GitHub'ı bağla, `burakkagancan-ux/tagsis` deposunu seç. Dal: `main`. **Root directory: `worker`**. Deploy command: `npx wrangler deploy` (varsayılan).
3. Varsa "Build watch paths" alanına `worker/*` yaz; böylece günlük veri güncellemeleri gereksiz dağıtım tetiklemez.
4. `VISION_KEY` ve `ALLOWED_ORIGIN` panelde kalır, dağıtım onları silmez (`keep_vars = true`).

`wrangler.toml` içindeki `name`, paneldeki Worker adıyla aynı olmalıdır.

## Test
`node worker/test.mjs` — Vision ve istek sınırı taklit edilerek 13 durum denenir.
`node worker/test_topluluk.mjs` — topluluk uç noktaları (/aranan, /topluluk) ve sayaçlar, D1 yerine gerçek SQLite ile (Node 22.13+).

## Ek güvence (kod dışı)
Google Cloud Console → APIs & Services → Cloud Vision API → Quotas → "Requests per minute" değerini düşürmek, Worker atlatılsa bile harcamaya üst sınır koyar.
