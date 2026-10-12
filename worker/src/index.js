// Etiket Oku OCR Worker'ı (Cloudflare Workers)
// Görev: ocr.html'den gelen fotoğrafı Google Cloud Vision'a gönderip okunan metni döndürmek.
//
// İstek:  POST { "image": "<base64 JPEG/PNG, data: öneki olmadan>" }
// Yanıt:  200 { "text": "..." }  |  4xx/5xx { "error": "Türkçe açıklama" }
//
// Gizlilik: fotoğraf ve okunan metin hiçbir yere yazılmaz, kayda (log) geçirilmez.
//
// Ortam (Cloudflare panelinde / wrangler.toml):
//   VISION_KEY      gizli (secret)  Google Cloud Vision API anahtarı
//   ALLOWED_ORIGIN  değişken/gizli  https://burakkagancan-ux.github.io (virgülle birden çok adres verilebilir)
//   IP_LIMIT        rate limit      IP başına dakikada en fazla istek (wrangler.toml)
//   GLOBAL_LIMIT    rate limit      tüm kullanıcılar için dakikada en fazla istek (Cloudflare konumu başına)
//   SAYAC           KV (isteğe bağlı) anonim paylaşım sayacı; bağlı değilse /sayac istekleri sayılmadan 204 döner
//   SAYAC_LIMIT     rate limit      paylaşım sayacı için IP başına sınır
//
//   URUNLER         D1 (isteğe bağlı) barkodlu ürün veritabanı (kullanıcı katkısı); bağlı değilse /urun sessizce devre dışı
//   BARKOD_LIMIT    rate limit      barkod uç noktaları için IP başına sınır
//
// Barkod (08.10.2026):
//   GET  /off/:barkod   Open Food Facts / Open Beauty Facts / Open Products Facts'te arar (kullanıcının IP'si üçüncü tarafa gitmez;
//                       yanıt 1 gün önbellekte). 200 {bulundu, db, ad, marka, t, metin:{dil: metin}}
//   GET  /urun/:barkod  kendi veritabanımız: aynı barkoda gelen katkılar benzerliğe göre gruplanır; farklı zamanlarda gelen iki
//                       benzer katkı "doğrulanmış" sayılır. 200 {bulundu, tur, dil, metin, t, dogrulandi, sayi}
//   POST /urun          {kod, tur, dil, metin, kim?} katkı (yalnızca kullanıcının açık izniyle gönderilir). IP, cihaz ya da kişisel bilgi saklanmaz.
//                       kim: cihazda bir kez rastgele üretilen takma katkıcı kimliği (32 onaltılık hane; kişisel bilgiden türetilmez, O-22).
//                       Katkıları ileride rozet ve "Katkılarım" için sahibine yazmaya yarar; GET yanıtında hiç görünmez.
//   OFF verisi D1'e yazılmaz (ODbL ayrımı).
//
// Paylaşım sayacı: POST /sayac?t=s|d (gövdesiz) günlük toplamı bir artırır (s: paylaşım menüsü, d: indirme).
//   Ürün, metin, IP ya da kişisel bilgi saklanmaz; anahtar yalnızca "g:YYYY-AA-GG:t". GET /sayac son 60 günün toplamlarını döndürür.

import { barkodGecerli, sozcukler, urunSec } from "./barkod.js";

const MAX_BODY = 4_000_000;          // ~4 MB (eski Worker'la aynı); uygulama 1800 px JPEG gönderir (genelde 0,3-1 MB)
const VISION_TIMEOUT_MS = 20_000;

function origins(env) {
  return (env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function cors(env, origin) {
  const list = origins(env);
  return {
    "Access-Control-Allow-Origin": list.includes(origin) ? origin : list[0] || "",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function reply(env, origin, status, obj, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors(env, origin), ...(extra || {}) },
  });
}

async function sayac(request, env, allowed, R) {
  if (request.method === "GET") {
    if (!env.SAYAC) return R(200, { gunler: {}, not: "Sayaç bağlı değil." });
    const list = await env.SAYAC.list({ prefix: "g:" });
    const keys = list.keys.map((k) => k.name).sort().slice(-120);
    const gunler = {};
    for (const k of keys) {
      const [, gun, t] = k.split(":");
      (gunler[gun] = gunler[gun] || {})[t] = Number(await env.SAYAC.get(k)) || 0;
    }
    return R(200, { gunler });
  }
  if (request.method !== "POST") return R(405, { error: "Yalnızca POST isteği kabul edilir." });
  if (!allowed) return R(403, { error: "Bu adresten istek kabul edilmiyor." });
  if (env.SAYAC_LIMIT) {
    const ip = request.headers.get("CF-Connecting-IP") || "bilinmiyor";
    const { success } = await env.SAYAC_LIMIT.limit({ key: "sayac:" + ip });
    if (!success) return new Response(null, { status: 429 });
  }
  if (!env.SAYAC) return new Response(null, { status: 204 });
  const t = new URL(request.url).searchParams.get("t") === "d" ? "d" : "s";
  const key = "g:" + new Date().toISOString().slice(0, 10) + ":" + t;
  const n = Number(await env.SAYAC.get(key)) || 0;   // yaklaşık sayım: aynı anda gelen iki istek tek sayılabilir
  await env.SAYAC.put(key, String(n + 1));
  return new Response(null, { status: 204 });
}

// ---------- Barkod ----------
const OFF_TIMEOUT_MS = 3_000;
const OFF_CACHE_SN = 86_400;           // bulunan ürün 1 gün, bulunamayan 6 saat önbellekte
const OFF_UA = "Tagsis/1.0 (https://github.com/burakkagancan-ux/tagsis; barkod sorgusu)";
const OFF_DB = [["food", "world.openfoodfacts.org"], ["beauty", "world.openbeautyfacts.org"], ["products", "world.openproductsfacts.org"]];
const OFF_DIL = ["tr", "en", "de", "fr", "nl", "ar", "ru", "es", "it"];
const KATKI_BARKOD_EN_COK = 30;        // bir barkoda en çok bu kadar katkı (kötüye kullanım sınırı)
const KATKICI_RE = /^[0-9a-f]{32}$/;   // js/barkod.js katkiciGecerli ile aynı

async function offAra(kod) {
  const f = "code,product_name,product_name_tr,product_name_en,brands,lang,last_modified_t,ingredients_text," + OFF_DIL.map((d) => "ingredients_text_" + d).join(",");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OFF_TIMEOUT_MS);
  try {
    const sonuc = await Promise.all(OFF_DB.map(async ([db, alan]) => {
      try {
        const r = await fetch(`https://${alan}/api/v2/product/${kod}?fields=${f}`, { headers: { "User-Agent": OFF_UA }, signal: ctrl.signal });
        if (!r.ok) return null;
        const j = await r.json();
        return j && j.status === 1 && j.product ? [db, j.product] : null;
      } catch { return null; }
    }));
    const hit = sonuc.find(Boolean);   // sıra: gıda, kozmetik, temizlik
    if (!hit) return { bulundu: false };
    const [db, p] = hit, metin = {};
    for (const d of OFF_DIL) { const v = String(p["ingredients_text_" + d] || "").trim(); if (v) metin[d] = v.slice(0, 4000); }
    const genel = String(p.ingredients_text || "").trim(), lang = String(p.lang || "");
    if (genel && /^[a-z]{2}$/.test(lang) && !metin[lang]) metin[lang] = genel.slice(0, 4000);
    let marka = p.brands || ""; if (Array.isArray(marka)) marka = marka.join(",");
    return { bulundu: true, db, ad: String(p.product_name_tr || p.product_name || p.product_name_en || "").slice(0, 200),
      marka: String(marka).split(",")[0].trim().slice(0, 100), t: Number(p.last_modified_t || 0) * 1000, metin };
  } finally { clearTimeout(timer); }
}

async function off(request, kod, R) {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const key = new Request("https://onbellek.tagsis/off/" + kod);
  if (cache) { const c = await cache.match(key); if (c) return R(200, await c.json()); }
  const j = await offAra(kod);
  if (cache) await cache.put(key, new Response(JSON.stringify(j), { headers: { "Cache-Control": "max-age=" + (j.bulundu ? OFF_CACHE_SN : OFF_CACHE_SN / 4) } }));
  return R(200, j);
}

let D1_HAZIR = false;
async function d1(env) {
  if (!D1_HAZIR) {
    await env.URUNLER.batch([
      env.URUNLER.prepare("CREATE TABLE IF NOT EXISTS katki (id INTEGER PRIMARY KEY AUTOINCREMENT, kod TEXT NOT NULL, tur TEXT NOT NULL, dil TEXT, metin TEXT NOT NULL, t INTEGER NOT NULL, kim TEXT)"),
      env.URUNLER.prepare("CREATE INDEX IF NOT EXISTS katki_kod ON katki (kod)"),
    ]);
    // O-22 öncesi oluşmuş tabloya kim sütunu (eski satırlarda boş kalır). Sütun zaten varsa SQLite hata verir; yok sayılır.
    try { await env.URUNLER.prepare("ALTER TABLE katki ADD COLUMN kim TEXT").run(); } catch {}
    await env.URUNLER.prepare("CREATE INDEX IF NOT EXISTS katki_kim ON katki (kim)").run();
    D1_HAZIR = true;
  }
  return env.URUNLER;
}

async function urun(request, env, kod, R) {
  if (request.method === "GET") {
    if (!env.URUNLER) return R(200, { bulundu: false, devreDisi: true });
    const db = await d1(env);
    const { results } = await db.prepare("SELECT tur, dil, metin, t, kim FROM katki WHERE kod = ? ORDER BY t DESC LIMIT 50").bind(kod).all();
    return R(200, urunSec(results || []));
  }
  // POST: katkı
  let j;
  try { const raw = await request.text(); if (raw.length > 20_000) return R(413, { error: "Metin çok uzun." }); j = JSON.parse(raw); } catch { return R(400, { error: "Geçersiz istek." }); }
  const k = String((j && j.kod) || "").replace(/[^0-9]/g, ""), tur = j && j.tur, dil = String((j && j.dil) || "");
  const metin = String((j && j.metin) || "").replace(/\s+/g, " ").trim();
  const kim = j && j.kim != null && j.kim !== "" ? String(j.kim) : null;   // eski uygulama sürümleri kimlik göndermez
  if (!barkodGecerli(k)) return R(400, { error: "Geçersiz barkod." });
  if (!["gida", "koz", "tem"].includes(tur)) return R(400, { error: "Geçersiz tür." });
  if (dil && !/^[a-z]{2}$/.test(dil)) return R(400, { error: "Geçersiz dil." });
  if (kim && !KATKICI_RE.test(kim)) return R(400, { error: "Geçersiz katkıcı kimliği." });
  if (metin.length < 20 || metin.length > 4000 || sozcukler(metin).length < 3) return R(400, { error: "İçerik metni uygun değil." });
  if (!env.URUNLER) return new Response(null, { status: 204 });
  const db = await d1(env);
  const say = await db.prepare("SELECT COUNT(*) AS n FROM katki WHERE kod = ?").bind(k).first();
  if (say && say.n >= KATKI_BARKOD_EN_COK) return R(429, { error: "Bu ürün için yeterli katkı var." });
  await db.prepare("INSERT INTO katki (kod, tur, dil, metin, t, kim) VALUES (?, ?, ?, ?, ?, ?)").bind(k, tur, dil, metin, Date.now(), kim).run();
  return R(201, { tamam: true });
}

async function barkod(request, env, allowed, R, yol) {
  if (request.method === "OPTIONS") return new Response(null, { status: allowed ? 204 : 403, headers: cors(env, request.headers.get("Origin") || "") });
  if (!allowed) return R(403, { error: "Bu adresten istek kabul edilmiyor." });
  if (env.BARKOD_LIMIT) {
    const ip = request.headers.get("CF-Connecting-IP") || "bilinmiyor";
    const { success } = await env.BARKOD_LIMIT.limit({ key: "barkod:" + ip });
    if (!success) return R(429, { error: "Çok sık sorgu yapıldı. Lütfen biraz sonra tekrar deneyin." }, { "Retry-After": "60" });
  }
  const p = yol.split("/").filter(Boolean);   // ["off", kod] | ["urun", kod] | ["urun"]
  if (p[0] === "urun" && request.method === "POST" && p.length === 1) return urun(request, env, null, R);
  if (request.method !== "GET" || p.length !== 2) return R(405, { error: "Geçersiz istek." });
  const kod = p[1];
  if (!/^\d{8,14}$/.test(kod)) return R(400, { error: "Geçersiz barkod." });
  return p[0] === "off" ? off(request, kod, R) : urun(request, env, kod, R);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = origins(env).includes(origin);
    const R = (status, obj, extra) => reply(env, origin, status, obj, extra);
    const yol = new URL(request.url).pathname;
    if (yol === "/sayac") return sayac(request, env, allowed, R);
    if (/^\/(off|urun)(\/|$)/.test(yol)) return barkod(request, env, allowed, R, yol);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: allowed ? 204 : 403, headers: cors(env, origin) });
    }
    if (request.method !== "POST") return R(405, { error: "Yalnızca POST isteği kabul edilir." });
    if (!allowed) return R(403, { error: "Bu adresten istek kabul edilmiyor." });

    // 1) İstek sınırı: önce IP başına, sonra genel sınır
    const ip = request.headers.get("CF-Connecting-IP") || "bilinmiyor";
    if (env.IP_LIMIT) {
      const { success } = await env.IP_LIMIT.limit({ key: "ip:" + ip });
      if (!success) return R(429, { error: "Çok sık okuma yapıldı. Lütfen bir dakika sonra tekrar deneyin." }, { "Retry-After": "60" });
    }
    if (env.GLOBAL_LIMIT) {
      const { success } = await env.GLOBAL_LIMIT.limit({ key: "global" });
      if (!success) return R(429, { error: "Hizmet şu an yoğun. Lütfen biraz sonra tekrar deneyin." }, { "Retry-After": "60" });
    }

    // 2) Boyut ve biçim denetimi
    const len = Number(request.headers.get("Content-Length") || "0");
    if (len > MAX_BODY) return R(413, { error: "Fotoğraf çok büyük. Daha küçük bir alan seçip tekrar deneyin." });
    let raw;
    try { raw = await request.text(); } catch { return R(400, { error: "İstek okunamadı." }); }
    if (raw.length > MAX_BODY) return R(413, { error: "Fotoğraf çok büyük. Daha küçük bir alan seçip tekrar deneyin." });
    let image;
    try { image = JSON.parse(raw).image; } catch { return R(400, { error: "Geçersiz istek." }); }
    if (typeof image !== "string" || image.length < 100) return R(400, { error: "Fotoğraf bulunamadı." });
    // Yalnızca JPEG (/9j/), PNG (iVBOR) ve WebP (UklGR) kabul edilir
    if (!/^(\/9j\/|iVBOR|UklGR)/.test(image) || /[^A-Za-z0-9+/=]/.test(image)) {
      return R(415, { error: "Desteklenmeyen dosya biçimi." });
    }

    if (!env.VISION_KEY) return R(500, { error: "Okuma hizmeti yapılandırılmamış." });

    // 3) Google Cloud Vision
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), VISION_TIMEOUT_MS);
    try {
      const r = await fetch("https://vision.googleapis.com/v1/images:annotate?key=" + encodeURIComponent(env.VISION_KEY), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: image },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: { languageHints: ["tr", "en"] },
          }],
        }),
        signal: ctrl.signal,
      });
      const j = await r.json().catch(() => ({}));
      const res = (j.responses && j.responses[0]) || {};
      if (!r.ok || res.error) {
        const code = r.status === 429 || (j.error && j.error.status === "RESOURCE_EXHAUSTED") ? 429 : 502;
        if (code === 429) return R(429, { error: "Okuma kapasitesi doldu. Lütfen daha sonra tekrar deneyin." });
        // Google'ın hata mesajı (ör. "API key not valid") sorun tespiti için iletilir; anahtarı içermez
        const msg = (res.error && res.error.message) || (j.error && j.error.message) || ("HTTP " + r.status);
        return R(502, { error: "OCR hatası: " + String(msg).slice(0, 200) });
      }
      return R(200, { text: (res.fullTextAnnotation && res.fullTextAnnotation.text) || "" });
    } catch (e) {
      return R(504, { error: e && e.name === "AbortError" ? "Okuma zaman aşımına uğradı." : "Okuma hizmetine ulaşılamadı." });
    } finally {
      clearTimeout(timer);
    }
  },
};
