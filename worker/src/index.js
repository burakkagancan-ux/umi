// Etiket Oku OCR Worker'ı (Cloudflare Workers)
// Görev: ocr.html'den gelen fotoğrafı Google Cloud Vision'a gönderip okunan metni döndürmek.
//
// İstek:  POST { "image": "<base64 JPEG/PNG, data: öneki olmadan>" }
// Yanıt:  200 { "text": "..." }  |  4xx/5xx { "error": "Türkçe açıklama" }
//
// Gizlilik: fotoğraf ve okunan metin hiçbir yere yazılmaz, kayda (log) geçirilmez.
// Hata kaydı (Workers Logs, 15.10.2026): yalnızca kayit() satırları; olay adı ve kısa ayrıntı. IP, fotoğraf, metin, barkod ve
// katkıcı kimliği yazılmaz. İstek kayıtları (invocation logs, IP ve başlık içerir) wrangler.toml'da kapalı.
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
//   ARANAN_LIMIT    rate limit      aynı IP + barkod için dakikada bir arama sayımı (G-04)
//   KATKI_TUZ       gizli (secret, isteğe bağlı, en az 32 karakter) katkı izinin anahtarı (katkiIz); yoksa iz yazılmaz
//
// Barkod (08.10.2026):
//   GET  /off/:barkod   Open Food Facts / Open Beauty Facts / Open Products Facts'te arar (kullanıcının IP'si üçüncü tarafa gitmez;
//                       yanıt 1 gün önbellekte). 200 {bulundu, db, ad, marka, t, metin:{dil: metin}}
//   GET  /urun/:barkod  kendi veritabanımız: aynı barkoda gelen katkılar benzerliğe göre gruplanır; farklı zamanlarda gelen iki
//                       benzer katkı "doğrulanmış" sayılır. 200 {bulundu, tur, dil, metin, t, dogrulandi, sayi}
//   POST /urun          {kod, tur, dil, metin, kim?} katkı (yalnızca kullanıcının açık izniyle gönderilir). IP, cihaz ya da kişisel bilgi saklanmaz.
//                       kim: cihazda bir kez rastgele üretilen takma katkıcı kimliği (32 onaltılık hane; kişisel bilgiden türetilmez, O-22).
//                       Katkıları ileride rozet ve "Katkılarım" için sahibine yazmaya yarar; GET yanıtında hiç görünmez.
//   POST /katki         {kim} Eklediklerim ve ürün rozetleri (G-02): bu kimliğin eklediği barkodlar, durumları (bekliyor / doğrulandı,
//                       öncü, doğrulayıcı) ve türe göre sayılar. Kimlik URL'de değil gövdede (kayıtlara ve önbelleklere geçmesin).
//                       200 {eklenen, avci, oncu, dogrulayici: {tür: sayı}, urunler: [{kod, tur, t, dogrulandi, oncu, dogrulayici, ozet}]}
//                       Başkalarının metni ve kimliği yanıta girmez. Kimlik yoksa sayım yok (400).
//   POST /aranan        {kod, tur} Topluluk (G-04): uygulama barkodda içerik bulamayınca bir kez bildirir; barkod başına arama sayısı artar.
//                       Yalnızca barkod, tür, sayı ve ilk/son arama zamanı saklanır; IP, kimlik ya da cihaz bilgisi yok. İçeriği olan
//                       barkod sayılmaz. Aynı IP aynı barkodu dakikada en çok bir kez sayar (ARANAN_LIMIT; IP saklanmaz).
//                       200 {n} (bu barkod kaç kez arandı) | {n: 0, icerikVar: true}
//   GET  /topluluk?tur= Ortak hedef ve eksik ürünler: {sayilar: {urun, dogrulanan: {tür: n}}, eksik: [{kod, tur, n, son}], t}. Herkese açık,
//                       kişisel veri yok; 10 dakika önbellekte. eksik: çok aranan ama içeriği olmayan barkodlar (en çok 50).
//   POST /besin         {kod, besin: {b, lt, birim}, kim?} besin tablosu katkısı (A-02; yalnızca kullanıcının açık izniyle). İçerik katkısından
//                       ayrı tabloda: içeriği OFF'tan gelen ya da hiç olmayan barkoda da eklenebilir. Aynı katkıcı kimliği aynı barkodda
//                       tek satırdır (düzeltince yenilenir). GET /urun yanıtında seçilen tablo: {besin, besinT, besinDogrulandi} (içerik
//                       bulunmasa da). O-26: farklı katkıcıların uyuşan iki tablosu "doğrulanmış" sayılır ve önce gösterilir (barkod.js besinSec).
//   OFF verisi D1'e yazılmaz (ODbL ayrımı).
//
// Katkı denetimi (O-21/O-26, 14.10.2026): GET /yonetim sayfası ve /yonetim/api/* (ayrıntı src/yonetim.js). Veri uç noktaları gizli
//   YONETIM_ANAHTARI (en az 32 karakter; panelde Secret) ile açılır; tanımlı değilse yönetim kapalı (404). CORS başlığı yok.
//
// Paylaşım sayacı: POST /sayac?t=s|d (gövdesiz) günlük toplamı bir artırır (s: paylaşım menüsü, d: indirme).
//   Ürün, metin, IP ya da kişisel bilgi saklanmaz; anahtar yalnızca "g:YYYY-AA-GG:t". GET /sayac son 60 günün toplamlarını döndürür.
//
// Ölçüm (A-03, 16.10.2026): POST /olcum?o=a|n|t|d7|d30[&k=f|b|y&m=gida|koz|tem][&ilk=YYYY-AA-GG] (gövdesiz) D1 `olcum` tablosunda
//   (gun, ad) satırını bir artırır: a günlük açan cihaz, n yeni cihaz, t:<kaynak>:<tür> tarama, d7/d30 geri dönüş (gun = ilk kullanım günü).
//   Kimlik, ürün, metin, barkod ve IP yazılmaz; bilinmeyen değer 400 (js/olcum.js olcumAnahtar). Okuma yalnızca yönetim sayfasından.
//   KV yerine D1: ücretsiz katmanda KV günde 1.000, D1 100.000 yazma; UPSERT eşzamanlı istekte de sayıyı kaybetmez.

import { barkodGecerli, besinKatki, besinOff, besinSec, katkiOzet, sozcukler, toplamFark, toplulukSay, urunSec } from "./barkod.js";
import { YONETIM_CSP, YONETIM_CSS, YONETIM_HTML, YONETIM_JS, sayacGunler, toplamUygula, yonetimApi, yonetimYetki } from "./yonetim.js";
import { olcumAnahtar } from "../../js/olcum.js";

const MAX_BODY = 4_000_000;          // ~4 MB (eski Worker'la aynı); uygulama 1800 px JPEG gönderir (genelde 0,3-1 MB)
const VISION_TIMEOUT_MS = 20_000;
const KUTU_EN_COK = 3000;             // istek {kutu: true} ise döndürülen en çok sözcük kutusu (yanıt boyutu sınırı)

// Vision fullTextAnnotation → sözcük kutuları (A-02, besin tablosunu konumdan kurmak için; yalnızca {kutu: true} isteyene).
// Yalnızca ilk sayfa (fotoğrafta Vision tek sayfa verir). boyut: [genişlik, yükseklik]; kutu_surum: alan eklenirse artar (yeni alan sona).
// kutu: [[sözcük, x0, y0, x1, y1, x2, y2, x3, y3, blok, satır_sonu], …] Vision'ın okuma sırasıyla; köşeler Vision'daki sırayla
// (yazının sol üstünden saat yönünde: fotoğraf dönükse x0,y0 → x1,y1 yazının yönüdür); eksik koordinat 0; blok = Vision bloğunun sırası;
// satır_sonu 1 = sözcükten sonra satır biter (detectedBreak LINE_BREAK / EOL_SURE_SPACE). Bozuk yapı istisna atmaz, o parça atlanır.
const KUTU_SURUM = 1;
const dizi = x => (Array.isArray(x) ? x : []);
const tam = x => { const n = Math.round(Number(x)); return Number.isFinite(n) ? n : 0; };
export function visionKutular(fta) {
  const kutu = [], sayfa = (fta && dizi(fta.pages)[0]) || {};
  let kesik = false;
  tum: for (const [b, bl] of dizi(sayfa.blocks).entries()) {
    for (const pa of dizi(bl && bl.paragraphs)) for (const wd of dizi(pa && pa.words)) {
      const sem = dizi(wd && wd.symbols).filter(x => x && typeof x.text === "string");
      const yazi = sem.map(x => x.text).join("");
      if (!yazi) continue;
      if (kutu.length >= KUTU_EN_COK) { kesik = true; break tum; }
      const v = dizi(wd.boundingBox && wd.boundingBox.vertices), k = [yazi];
      for (let i = 0; i < 4; i++) k.push(tam(v[i] && v[i].x), tam(v[i] && v[i].y));
      const br = (((sem[sem.length - 1].property || {}).detectedBreak) || {}).type;
      k.push(b, br === "LINE_BREAK" || br === "EOL_SURE_SPACE" ? 1 : 0);
      kutu.push(k);
    }
  }
  const sonuc = { boyut: [tam(sayfa.width), tam(sayfa.height)], kutu_surum: KUTU_SURUM, kutu };
  if (kesik) sonuc.kutu_kesik = true;
  return sonuc;
}

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

function kayit(olay, ayrinti) {
  console.error(JSON.stringify(ayrinti == null ? { olay } : { olay, ayrinti: String(ayrinti).slice(0, 200) }));
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
    return R(200, { gunler: await sayacGunler(env.SAYAC) });
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

async function olcum(request, env, allowed, R) {
  if (request.method !== "POST") return R(405, { error: "Yalnızca POST isteği kabul edilir." });
  if (!allowed) return R(403, { error: "Bu adresten istek kabul edilmiyor." });
  if (env.SAYAC_LIMIT) {   // paylaşım sayacıyla aynı sınır, ayrı anahtar (IP saklanmaz, yalnızca sınırın anahtarı)
    const { success } = await env.SAYAC_LIMIT.limit({ key: "olcum:" + (request.headers.get("CF-Connecting-IP") || "bilinmiyor") });
    if (!success) return new Response(null, { status: 429 });
  }
  const a = olcumAnahtar(new URL(request.url).searchParams, Date.now());
  if (!a) return R(400, { error: "Geçersiz ölçüm." });
  if (!env.URUNLER) return new Response(null, { status: 204 });
  const db = await d1(env);
  await db.prepare("INSERT INTO olcum (gun, ad, n) VALUES (?, ?, 1) ON CONFLICT (gun, ad) DO UPDATE SET n = n + 1").bind(a.gun, a.ad).run();
  return new Response(null, { status: 204 });
}

// ---------- Barkod ----------
const OFF_TIMEOUT_MS = 3_000;
const OFF_CACHE_SN = 86_400;           // bulunan ürün 1 gün, bulunamayan 6 saat önbellekte
const OFF_UA = "Umi/1.0 (https://github.com/burakkagancan-ux/umi; barkod sorgusu)";
const OFF_DB = [["food", "world.openfoodfacts.org"], ["beauty", "world.openbeautyfacts.org"], ["products", "world.openproductsfacts.org"]];
const OFF_DIL = ["tr", "en", "de", "fr", "nl", "ar", "ru", "es", "it"];
const KATKI_BARKOD_EN_COK = 30;        // bir barkoda en çok bu kadar katkı (kötüye kullanım sınırı)
const KATKI_IZ_EN_COK = 2;             // aynı izden (ağdan) bir barkoda en çok bu kadar içerik katkısı ya da besin tablosu
const KATKICI_RE = /^[0-9a-f]{32}$/;   // js/barkod.js katkiciGecerli ile aynı

// Katkı izi: HMAC-SHA256(KATKI_TUZ, ağ + ":" + barkod) ilk 8 baytı (16 onaltılık hane). IP saklanmaz ve izden geri çıkarılamaz
// (anahtar yalnızca panelde); barkod da girdiği için iki barkodun izi birbirine bağlanamaz. Yalnızca aynı barkoda aynı ağdan gelen
// katkıların birbirini "doğrulamasını" ve barkodu doldurmasını önler (barkod.js ayniKisi). IPv6'da ağ = ilk 64 bit (cihaz kendi
// adresini o ağ içinde değiştirebilir). KATKI_TUZ yoksa ya da kısaysa iz yazılmaz (null).
export function agOnek(ip) {
  ip = String(ip || "").trim().toLowerCase();
  if (!ip.includes(":")) return ip;
  const [bas, son = ""] = ip.split("::"), b = bas ? bas.split(":") : [], s2 = ip.includes("::") && son ? son.split(":") : [];
  const tam = ip.includes("::") ? [...b, ...Array(Math.max(0, 8 - b.length - s2.length)).fill("0"), ...s2] : b;
  return tam.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}
async function katkiIz(env, request, kod) {
  const tuz = env.KATKI_TUZ, ip = request.headers.get("CF-Connecting-IP");
  if (!tuz || String(tuz).length < 32 || !ip) return null;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(tuz)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(agOnek(ip) + ":" + kod)));
  return [...h.slice(0, 8)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function offAra(kod) {
  const f = "code,product_name,product_name_tr,product_name_en,brands,lang,last_modified_t,ingredients_text,nutriments,quantity,categories_tags," + OFF_DIL.map((d) => "ingredients_text_" + d).join(",");
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
      marka: String(marka).split(",")[0].trim().slice(0, 100), t: Number(p.last_modified_t || 0) * 1000, metin,
      besin: db === "food" ? besinOff(p.nutriments, p.quantity) : null,
      // A-08: ürün tipi (renk gösterilmeyen tipler) uygulamada kaynak/besin_istisna.json ile bulunur; burada yalnızca etiketler
      kat: db === "food" && Array.isArray(p.categories_tags) ? p.categories_tags.filter((x) => typeof x === "string" && x.length <= 80).slice(0, 60) : [] };
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
      // G-04: aranan = içerik bulunamayan barkodların arama sayısı (kişisel veri yok); toplam = topluluk sayaçları ("urun:gida", "dogrulanan:koz"…)
      env.URUNLER.prepare("CREATE TABLE IF NOT EXISTS aranan (kod TEXT PRIMARY KEY, tur TEXT NOT NULL, n INTEGER NOT NULL, ilk INTEGER NOT NULL, son INTEGER NOT NULL)"),
      env.URUNLER.prepare("CREATE INDEX IF NOT EXISTS aranan_sira ON aranan (tur, n DESC, son DESC)"),
      env.URUNLER.prepare("CREATE INDEX IF NOT EXISTS aranan_son ON aranan (son)"),
      env.URUNLER.prepare("CREATE TABLE IF NOT EXISTS toplam (ad TEXT PRIMARY KEY, n INTEGER NOT NULL)"),
      // A-02: barkoda bağlı besin tablosu (besin: JSON {b, lt, birim}); kişisel veri yok, kim yalnızca aynı kişinin satırını yenilemek için
      env.URUNLER.prepare("CREATE TABLE IF NOT EXISTS besin (id INTEGER PRIMARY KEY AUTOINCREMENT, kod TEXT NOT NULL, besin TEXT NOT NULL, t INTEGER NOT NULL, kim TEXT)"),
      env.URUNLER.prepare("CREATE INDEX IF NOT EXISTS besin_kod ON besin (kod, t DESC)"),
      // A-03: günlük ölçüm toplamları (gun "YYYY-AA-GG", ad "a"|"n"|"t:f:gida"…|"d7"|"d30"); kimlik ve içerik yok
      env.URUNLER.prepare("CREATE TABLE IF NOT EXISTS olcum (gun TEXT NOT NULL, ad TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (gun, ad))"),
      // Yönetimde silinen satırlar geri alınabilsin diye (yonetim.js): islem = her silme ve geri alma; silinen = silinen satırın
      // tamamı (JSON), SILINEN_OMUR_GUN gün sonra kalıcı silinir
      env.URUNLER.prepare("CREATE TABLE IF NOT EXISTS islem (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, ne TEXT NOT NULL, ayrinti TEXT NOT NULL, geri INTEGER)"),
      env.URUNLER.prepare("CREATE TABLE IF NOT EXISTS silinen (id INTEGER PRIMARY KEY AUTOINCREMENT, islem INTEGER NOT NULL, tablo TEXT NOT NULL, satir TEXT NOT NULL, t INTEGER NOT NULL)"),
    ]);
    // Sonradan eklenen sütunlar (eski satırlarda boş kalır): kim O-22, iz katkı izi. Sütun zaten varsa SQLite hata verir; yok sayılır.
    for (const [tablo, sutun] of [["katki", "kim"], ["katki", "iz"], ["besin", "iz"]])
      try { await env.URUNLER.prepare("ALTER TABLE " + tablo + " ADD COLUMN " + sutun + " TEXT").run(); } catch (e) { if (!/duplicate column/i.test(e && e.message)) kayit("d1_alter", e && e.message); }
    await env.URUNLER.prepare("CREATE INDEX IF NOT EXISTS katki_kim ON katki (kim)").run();
    D1_HAZIR = true;
  }
  return env.URUNLER;
}

async function urun(request, env, kod, R) {
  if (request.method === "GET") {
    if (!env.URUNLER) return R(200, { bulundu: false, devreDisi: true });
    const db = await d1(env);
    const { results } = await db.prepare("SELECT tur, dil, metin, t, kim, iz FROM katki WHERE kod = ? ORDER BY t DESC LIMIT 50").bind(kod).all();
    const { results: bs } = await db.prepare("SELECT besin, t, kim, iz FROM besin WHERE kod = ? ORDER BY t DESC LIMIT " + BESIN_BARKOD_EN_COK).bind(kod).all();
    return R(200, { ...urunSec(results || []), ...(besinSec(bs) || {}) });
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
  const { results } = await db.prepare("SELECT tur, dil, metin, t, kim, iz FROM katki WHERE kod = ? ORDER BY t DESC LIMIT 50").bind(k).all();
  const once = results || [];
  // Aynı katkıcı kimliği bir barkodda tek satırdır (yeniden gönderince yenilenir): tek kimlik barkodu dolduramaz
  const kalan = kim ? once.filter((s) => s.kim !== kim) : once;
  if (kalan.length >= KATKI_BARKOD_EN_COK) return R(429, { error: "Bu ürün için yeterli katkı var." });
  const iz = await katkiIz(env, request, k);
  if (iz && kalan.filter((s) => s.iz === iz).length >= KATKI_IZ_EN_COK) return R(429, { error: "Bu ürün için yeterli katkı var." });
  const yeni = { tur, dil, metin, t: Date.now(), kim, iz };
  if (kalan.length < once.length) await db.prepare("DELETE FROM katki WHERE kod = ? AND kim = ?").bind(k, kim).run();
  await db.prepare("INSERT INTO katki (kod, tur, dil, metin, t, kim, iz) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(k, tur, dil, metin, yeni.t, kim, iz).run();
  // Topluluk sayaçları (G-04): barkodun önceki ve sonraki durumunun farkı (ilk içerik → ürün +1, doğrulanmaya geçiş → doğrulanan +1;
  // kendi katkısını değiştiren katkıcı durumu geri de alabilir). İlk içerikte barkod eksik ürünler listesinden çıkar.
  // Yaklaşık sayım: aynı barkoda aynı anda gelen iki katkı geçişi iki kez sayabilir (önemsiz).
  if (!once.length) await db.prepare("DELETE FROM aranan WHERE kod = ?").bind(k).run();
  await toplamUygula(db, toplamFark(urunSec(once), urunSec([yeni, ...kalan])));
  return R(201, { tamam: true });
}

// POST /besin: barkoda besin tablosu (A-02). Kimlikli katkı aynı barkodda önceki satırını değiştirir; kimliksiz her gönderim yeni satır
// (aynı izden en çok KATKI_IZ_EN_COK).
const BESIN_BARKOD_EN_COK = 20;
async function besinEkle(request, env, R) {
  let j;
  try { const raw = await request.text(); if (raw.length > 2000) return R(413, { error: "Geçersiz istek." }); j = JSON.parse(raw); } catch { return R(400, { error: "Geçersiz istek." }); }
  const kod = String((j && j.kod) || "").replace(/[^0-9]/g, "");
  const kim = j && j.kim != null && j.kim !== "" ? String(j.kim) : null;
  if (!barkodGecerli(kod)) return R(400, { error: "Geçersiz barkod." });
  if (kim && !KATKICI_RE.test(kim)) return R(400, { error: "Geçersiz katkıcı kimliği." });
  const b = besinKatki(j && j.besin);
  if (!b) return R(400, { error: "Besin tablosu uygun değil." });
  if (!env.URUNLER) return new Response(null, { status: 204 });
  const db = await d1(env);
  const iz = await katkiIz(env, request, kod);
  if (iz) {   // aynı izden en çok KATKI_IZ_EN_COK tablo (aynı kimliğin kendi satırı sayılmaz, aşağıda yenilenir)
    const m = await db.prepare("SELECT COUNT(*) AS n FROM besin WHERE kod = ? AND iz = ? AND (kim IS NULL OR kim != ?)").bind(kod, iz, kim || "").first();
    if (m && m.n >= KATKI_IZ_EN_COK) return R(429, { error: "Bu ürün için yeterli katkı var." });
  }
  if (kim) await db.prepare("DELETE FROM besin WHERE kod = ? AND kim = ?").bind(kod, kim).run();
  const n = await db.prepare("SELECT COUNT(*) AS n FROM besin WHERE kod = ?").bind(kod).first();
  if (n && n.n >= BESIN_BARKOD_EN_COK) return R(429, { error: "Bu ürün için yeterli katkı var." });
  await db.prepare("INSERT INTO besin (kod, besin, t, kim, iz) VALUES (?, ?, ?, ?, ?)").bind(kod, JSON.stringify(b), Date.now(), kim, iz).run();
  return R(201, { tamam: true });
}

// ---------- Topluluk (G-04) ----------
const TURLER = ["gida", "koz", "tem"];
const TOPLULUK_CACHE_SN = 600;         // GET /topluluk yanıtı 10 dakika önbellekte (D1 okumasını sınırlar)
const EKSIK_EN_COK = 50;               // listede en çok bu kadar barkod
const ARANAN_OMUR_MS = 180 * 86_400_000;   // 180 gündür aranmayan barkod listeden silinir
async function aranan(request, env, R) {
  let j;
  try { const raw = await request.text(); if (raw.length > 500) return R(413, { error: "Geçersiz istek." }); j = JSON.parse(raw); } catch { return R(400, { error: "Geçersiz istek." }); }
  const kod = String((j && j.kod) || "").replace(/[^0-9]/g, ""), tur = j && j.tur;
  if (!barkodGecerli(kod)) return R(400, { error: "Geçersiz barkod." });
  if (!TURLER.includes(tur)) return R(400, { error: "Geçersiz tür." });
  if (!env.URUNLER) return new Response(null, { status: 204 });
  if (env.ARANAN_LIMIT) {   // aynı IP aynı barkodu dakikada bir kez sayar; IP yalnızca bu sınırın anahtarında, saklanmaz
    const ip = request.headers.get("CF-Connecting-IP") || "bilinmiyor";
    const { success } = await env.ARANAN_LIMIT.limit({ key: "aranan:" + ip + ":" + kod });
    if (!success) return R(429, { error: "Bu barkod az önce sayıldı." });
  }
  const db = await d1(env);
  if (await db.prepare("SELECT 1 AS x FROM katki WHERE kod = ? LIMIT 1").bind(kod).first()) return R(200, { n: 0, icerikVar: true });
  const t = Date.now();
  const r = await db.prepare("INSERT INTO aranan (kod, tur, n, ilk, son) VALUES (?, ?, 1, ?, ?) ON CONFLICT(kod) DO UPDATE SET n = n + 1, son = excluded.son, tur = excluded.tur RETURNING n")
    .bind(kod, tur, t, t).first();
  return R(200, { n: (r && r.n) || 1 });
}
// Sayaçlar ilk açılışta (G-04 öncesi katkılar için) bir kez bütün katkılardan sayılır. Barkodlar TOPLULUK_KUR_PARCA'lık parçalarla
// okunur (bütün tablo belleğe alınmaz); "kurulum" satırı sayaçlarla aynı toplu yazımda, sayım bittikten sonra yazılır: yarıda kalan
// sayım hiçbir şey yazmaz, sonraki istek yeniden dener. Yönetimde silme ve geri alma artık sayaçları silmez, yalnızca farkı uygular
// (yonetim.js), bu yüzden baştan sayım yalnızca boş veritabanında ya da toplam tablosu elle silinince olur.
const TOPLULUK_KUR_PARCA = 200;
async function toplulukKur(db) {
  if (await db.prepare("SELECT 1 AS x FROM toplam WHERE ad = 'kurulum'").first()) return;
  const o = { urun: {}, dogrulanan: {} };
  for (let son = ""; ;) {
    const { results: kodlar } = await db.prepare("SELECT DISTINCT kod FROM katki WHERE kod > ? ORDER BY kod LIMIT " + TOPLULUK_KUR_PARCA).bind(son).all();
    if (!kodlar || !kodlar.length) break;
    son = kodlar[kodlar.length - 1].kod;
    const { results } = await db.prepare("SELECT kod, tur, metin, t, kim, iz FROM katki WHERE kod >= ? AND kod <= ?").bind(kodlar[0].kod, son).all();
    const p = toplulukSay(results || []);
    for (const a of ["urun", "dogrulanan"]) for (const [tur, n] of Object.entries(p[a])) o[a][tur] = (o[a][tur] || 0) + n;
    if (kodlar.length < TOPLULUK_KUR_PARCA) break;
  }
  const yaz = [];
  for (const a of ["urun", "dogrulanan"]) for (const tur of TURLER)
    yaz.push(db.prepare("INSERT OR REPLACE INTO toplam (ad, n) VALUES (?, ?)").bind(a + ":" + tur, o[a][tur] || 0));
  yaz.push(db.prepare("INSERT OR REPLACE INTO toplam (ad, n) VALUES ('kurulum', ?)").bind(Date.now()));
  await db.batch(yaz);
}
async function topluluk(request, env, R) {
  const q = new URL(request.url).searchParams.get("tur") || "";
  const tur = TURLER.includes(q) ? q : "";
  const bos = { sayilar: { urun: {}, dogrulanan: {} }, eksik: [], t: Date.now() };
  if (!env.URUNLER) return R(200, { ...bos, devreDisi: true });
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const key = new Request("https://onbellek.tagsis/topluluk/" + (tur || "hepsi"));
  if (cache) { const c = await cache.match(key); if (c) return R(200, await c.json()); }
  const db = await d1(env);
  await toplulukKur(db);
  await db.prepare("DELETE FROM aranan WHERE son < ?").bind(Date.now() - ARANAN_OMUR_MS).run();
  const { results: say } = await db.prepare("SELECT ad, n FROM toplam").all();
  const sayilar = { urun: {}, dogrulanan: {} };
  for (const r of say || []) { const [a, tr] = String(r.ad).split(":"); if (sayilar[a] && TURLER.includes(tr)) sayilar[a][tr] = Number(r.n) || 0; }
  const eksikSql = "SELECT kod, tur, n, son FROM aranan WHERE " + (tur ? "tur = ? AND " : "") +
    "NOT EXISTS (SELECT 1 FROM katki WHERE katki.kod = aranan.kod) ORDER BY n DESC, son DESC LIMIT " + EKSIK_EN_COK;
  const st = db.prepare(eksikSql);
  const { results: eksik } = await (tur ? st.bind(tur) : st).all();
  const j = { sayilar, eksik: (eksik || []).map((r) => ({ kod: r.kod, tur: r.tur, n: r.n, son: r.son })), t: Date.now() };
  if (cache) await cache.put(key, new Response(JSON.stringify(j), { headers: { "Cache-Control": "max-age=" + TOPLULUK_CACHE_SN } }));
  return R(200, j);
}
const KATKICI_BARKOD_EN_COK = 500;     // Eklediklerim: bir kimliğin en yeni bu kadar barkodu değerlendirilir
async function katki(request, env, R) {
  let j;
  try { const raw = await request.text(); if (raw.length > 1000) return R(413, { error: "Geçersiz istek." }); j = JSON.parse(raw); } catch { return R(400, { error: "Geçersiz istek." }); }
  const kim = String((j && j.kim) || "");
  if (!KATKICI_RE.test(kim)) return R(400, { error: "Geçersiz katkıcı kimliği." });
  const bos = { eklenen: {}, avci: {}, oncu: {}, dogrulayici: {}, urunler: [] };
  if (!env.URUNLER) return R(200, { ...bos, devreDisi: true });
  const db = await d1(env);
  const { results } = await db.prepare("SELECT kod, tur, metin, t, kim, iz FROM katki WHERE kod IN (SELECT kod FROM katki WHERE kim = ? GROUP BY kod ORDER BY MAX(t) DESC LIMIT " + KATKICI_BARKOD_EN_COK + ") ORDER BY t DESC").bind(kim).all();
  return R(200, katkiOzet(results || [], kim));   // reply zaten no-store
}

// Katkı denetimi: sayfa, betik ve stil Worker'dan; veri anahtarla. Yanıtlar CORS'suz (yalnızca bu adresten okunur), önbelleğe girmez.
const YONETIM_BASLIK = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY" };
async function yonetim(request, env, yol) {
  const dosya = { "/yonetim": [YONETIM_HTML, "text/html"], "/yonetim/sayfa.js": [YONETIM_JS, "text/javascript"], "/yonetim/sayfa.css": [YONETIM_CSS, "text/css"] }[yol];
  if (dosya) {
    if (request.method !== "GET") return new Response(null, { status: 405, headers: YONETIM_BASLIK });
    return new Response(dosya[0], { headers: { ...YONETIM_BASLIK, "Content-Type": dosya[1] + "; charset=utf-8", "Content-Security-Policy": YONETIM_CSP } });
  }
  const R = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { ...YONETIM_BASLIK, "Content-Type": "application/json; charset=utf-8" } });
  if (!yol.startsWith("/yonetim/api/")) return R(404, { error: "Bulunamadı." });
  if (env.BARKOD_LIMIT) {   // anahtar denemesi de sınırlı (IP saklanmaz)
    const { success } = await env.BARKOD_LIMIT.limit({ key: "yonetim:" + (request.headers.get("CF-Connecting-IP") || "bilinmiyor") });
    if (!success) return R(429, { error: "Çok sık istek. Biraz sonra tekrar deneyin." });
  }
  const yetki = await yonetimYetki(env, request);
  if (yetki === "kapali") return R(404, { error: "Yönetim kapalı.", kapali: true });
  if (yetki !== "tamam") { kayit("yonetim_yetkisiz"); return R(401, { error: "Anahtar geçersiz." }); }
  if (!env.URUNLER) return R(503, { error: "Veritabanı bağlı değil." });
  return yonetimApi(request, env, await d1(env), yol, R);
}

async function barkod(request, env, allowed, R, yol) {
  if (request.method === "OPTIONS") return new Response(null, { status: allowed ? 204 : 403, headers: cors(env, request.headers.get("Origin") || "") });
  if (!allowed) return R(403, { error: "Bu adresten istek kabul edilmiyor." });
  if (env.BARKOD_LIMIT) {
    const ip = request.headers.get("CF-Connecting-IP") || "bilinmiyor";
    const { success } = await env.BARKOD_LIMIT.limit({ key: "barkod:" + ip });
    if (!success) { kayit("sinir_barkod"); return R(429, { error: "Çok sık sorgu yapıldı. Lütfen biraz sonra tekrar deneyin." }, { "Retry-After": "60" }); }
  }
  const p = yol.split("/").filter(Boolean);   // ["off", kod] | ["urun", kod] | ["urun"] | ["besin"] | ["katki"] | ["aranan"] | ["topluluk"]
  if (p[0] === "urun" && request.method === "POST" && p.length === 1) return urun(request, env, null, R);
  if (p[0] === "besin") return request.method === "POST" && p.length === 1 ? besinEkle(request, env, R) : R(405, { error: "Geçersiz istek." });
  if (p[0] === "katki") return request.method === "POST" && p.length === 1 ? katki(request, env, R) : R(405, { error: "Geçersiz istek." });
  if (p[0] === "aranan") return request.method === "POST" && p.length === 1 ? aranan(request, env, R) : R(405, { error: "Geçersiz istek." });
  if (p[0] === "topluluk") return request.method === "GET" && p.length === 1 ? topluluk(request, env, R) : R(405, { error: "Geçersiz istek." });
  if (request.method !== "GET" || p.length !== 2) return R(405, { error: "Geçersiz istek." });
  const kod = p[1];
  if (!/^\d{8,14}$/.test(kod)) return R(400, { error: "Geçersiz barkod." });
  return p[0] === "off" ? off(request, kod, R) : urun(request, env, kod, R);
}

// Yakalanmayan hata (ör. D1 kesintisi): Cloudflare'in CORS'suz hata sayfası yerine JSON 500 ve bir kayıt satırı (yolun yalnızca ilk parçası)
export default {
  async fetch(request, env) {
    try { return await isle(request, env); }
    catch (e) {
      kayit("beklenmeyen", "/" + (new URL(request.url).pathname.split("/")[1] || "") + " " + ((e && e.message) || e));
      return reply(env, request.headers.get("Origin") || "", 500, { error: "Beklenmeyen bir hata oldu. Lütfen biraz sonra tekrar deneyin." });
    }
  },
};

async function isle(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = origins(env).includes(origin);
  const R = (status, obj, extra) => reply(env, origin, status, obj, extra);
  const yol = new URL(request.url).pathname;
  if (yol === "/sayac") return sayac(request, env, allowed, R);
  if (yol === "/olcum") return olcum(request, env, allowed, R);
  if (/^\/(off|urun|besin|katki|aranan|topluluk)(\/|$)/.test(yol)) return barkod(request, env, allowed, R, yol);
  if (yol === "/yonetim" || yol.startsWith("/yonetim/")) return yonetim(request, env, yol);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: allowed ? 204 : 403, headers: cors(env, origin) });
  }
  if (request.method !== "POST") return R(405, { error: "Yalnızca POST isteği kabul edilir." });
  if (!allowed) return R(403, { error: "Bu adresten istek kabul edilmiyor." });

  // 1) İstek sınırı: önce IP başına, sonra genel sınır
  const ip = request.headers.get("CF-Connecting-IP") || "bilinmiyor";
  if (env.IP_LIMIT) {
    const { success } = await env.IP_LIMIT.limit({ key: "ip:" + ip });
    if (!success) { kayit("sinir_ip"); return R(429, { error: "Çok sık okuma yapıldı. Lütfen bir dakika sonra tekrar deneyin." }, { "Retry-After": "60" }); }
  }
  if (env.GLOBAL_LIMIT) {
    const { success } = await env.GLOBAL_LIMIT.limit({ key: "global" });
    if (!success) { kayit("sinir_genel"); return R(429, { error: "Hizmet şu an yoğun. Lütfen biraz sonra tekrar deneyin." }, { "Retry-After": "60" }); }
  }

  // 2) Boyut ve biçim denetimi
  const len = Number(request.headers.get("Content-Length") || "0");
  if (len > MAX_BODY) return R(413, { error: "Fotoğraf çok büyük. Daha küçük bir alan seçip tekrar deneyin." });
  let raw;
  try { raw = await request.text(); } catch { return R(400, { error: "İstek okunamadı." }); }
  if (raw.length > MAX_BODY) return R(413, { error: "Fotoğraf çok büyük. Daha küçük bir alan seçip tekrar deneyin." });
  let image, kutuIste;
  try { const g = JSON.parse(raw); image = g.image; kutuIste = g.kutu === true; } catch { return R(400, { error: "Geçersiz istek." }); }
  if (typeof image !== "string" || image.length < 100) return R(400, { error: "Fotoğraf bulunamadı." });
  // Yalnızca JPEG (/9j/), PNG (iVBOR) ve WebP (UklGR) kabul edilir
  if (!/^(\/9j\/|iVBOR|UklGR)/.test(image) || /[^A-Za-z0-9+/=]/.test(image)) {
    return R(415, { error: "Desteklenmeyen dosya biçimi." });
  }

  if (!env.VISION_KEY) { kayit("vision_anahtar_yok"); return R(500, { error: "Okuma hizmeti yapılandırılmamış." }); }

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
      if (code === 429) { kayit("vision_kota"); return R(429, { error: "Okuma kapasitesi doldu. Lütfen daha sonra tekrar deneyin." }); }
      // Google'ın hata mesajı (ör. "API key not valid") sorun tespiti için iletilir; anahtarı içermez
      const msg = (res.error && res.error.message) || (j.error && j.error.message) || ("HTTP " + r.status);
      kayit("vision_hata", msg);
      return R(502, { error: "OCR hatası: " + String(msg).slice(0, 200) });
    }
    const text = (res.fullTextAnnotation && res.fullTextAnnotation.text) || "";
    if (!kutuIste) return R(200, { text });
    // Kutular yardımcı iş: ne olursa olsun okunan metni düşürmez
    let kt;
    try { kt = visionKutular(res.fullTextAnnotation); }
    catch (e) { kayit("kutu_hata", e && e.message); kt = { kutu_hata: true }; }
    return R(200, { text, ...kt });
  } catch (e) {
    kayit(e && e.name === "AbortError" ? "vision_zaman_asimi" : "vision_ulasilamadi", e && e.message);
    return R(504, { error: e && e.name === "AbortError" ? "Okuma zaman aşımına uğradı." : "Okuma hizmetine ulaşılamadı." });
  } finally {
    clearTimeout(timer);
  }
}
