// Worker'ın yerel testi: node worker/test.mjs  (Vision ve rate limit taklit edilir)
import w from "./src/index.js";
import { urunSec, barkodGecerli, KATKI_ARALIK_MS } from "./src/barkod.js";
const ORIGIN = "https://burakkagancan-ux.github.io";
let calls = 0, visionReply = () => ({ status: 200, body: { responses: [{ fullTextAnnotation: { text: "Aqua, Glycerin" } }] } });
globalThis.fetch = async (url, opt) => { calls++; const v = visionReply(url, opt); return new Response(JSON.stringify(v.body), { status: v.status }); };
const lim = n => { let c = 0; return { limit: async () => ({ success: ++c <= n }) }; };
const env = () => ({ VISION_KEY: "k", ALLOWED_ORIGIN: ORIGIN, IP_LIMIT: lim(6), GLOBAL_LIMIT: lim(30) });
const img = "/9j/" + "A".repeat(200);
const req = (body, o = {}) => new Request("https://x.workers.dev/", { method: o.method || "POST", headers: { "Content-Type": "application/json", "Origin": o.origin ?? ORIGIN, "CF-Connecting-IP": "1.2.3.4", ...(o.h || {}) }, body: o.method === "OPTIONS" || o.method === "GET" ? undefined : body });
let fail = 0;
async function t(name, r, e, status, check) {
  const res = await w.fetch(r, e); const txt = await res.text(); let j = {}; try { j = JSON.parse(txt); } catch {}
  const ok = res.status === status && (!check || check(j, res));
  if (!ok) { fail++; console.log("HATA", name, res.status, txt); } else console.log("ok  ", name, res.status, j.error || j.text || "");
}
await t("başarılı okuma", req(JSON.stringify({ image: img })), env(), 200, j => j.text === "Aqua, Glycerin");
await t("CORS başlığı", req(JSON.stringify({ image: img })), env(), 200, (j, r) => r.headers.get("Access-Control-Allow-Origin") === ORIGIN);
await t("ön kontrol (OPTIONS)", req(null, { method: "OPTIONS" }), env(), 204);
await t("yabancı köken", req(JSON.stringify({ image: img }), { origin: "https://evil.example" }), env(), 403);
await t("GET reddi", req(null, { method: "GET" }), env(), 405);
await t("bozuk JSON", req("{x"), env(), 400);
await t("resim değil", req(JSON.stringify({ image: "SGVsbG8".repeat(30) })), env(), 415);
await t("çok büyük", req(JSON.stringify({ image: "/9j/" + "A".repeat(4_100_000) })), env(), 413);
{ const e = env(); for (let i = 0; i < 6; i++) await w.fetch(req(JSON.stringify({ image: img })), e); await t("IP sınırı (7. istek)", req(JSON.stringify({ image: img })), e, 429, (j, r) => r.headers.get("Retry-After") === "60"); }
{ const e = env(); e.IP_LIMIT = lim(1000); for (let i = 0; i < 30; i++) await w.fetch(req(JSON.stringify({ image: img })), e); await t("genel sınır (31. istek)", req(JSON.stringify({ image: img })), e, 429); }
visionReply = () => ({ status: 429, body: { error: { status: "RESOURCE_EXHAUSTED" } } });
await t("Vision kotası doldu", req(JSON.stringify({ image: img })), env(), 429);
visionReply = () => ({ status: 400, body: { responses: [{ error: { message: "API key not valid" } }] } });
await t("Vision hatası mesajı iletilir", req(JSON.stringify({ image: img })), env(), 502, j => j.error === "OCR hatası: API key not valid");
{ const e = env(); e.ALLOWED_ORIGIN = "http://localhost:8765, " + ORIGIN; visionReply = () => ({ status: 200, body: { responses: [{ fullTextAnnotation: { text: "x" } }] } });
  await t("birden çok köken", req(JSON.stringify({ image: img }), { origin: "http://localhost:8765" }), e, 200, (j, r) => r.headers.get("Access-Control-Allow-Origin") === "http://localhost:8765"); }
{ const e = env(); delete e.VISION_KEY; visionReply = () => ({ status: 200, body: {} }); await t("anahtar yok", req(JSON.stringify({ image: img })), e, 500); }
// Paylaşım sayacı
const kv = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }) }; };
const sreq = (q, o = {}) => new Request("https://x.workers.dev/sayac" + q, { method: o.method || "POST", headers: { "Origin": o.origin ?? ORIGIN, "CF-Connecting-IP": "1.2.3.4" } });
{ const e = env(); const before = calls; await t("sayaç bağlı değil: 204", sreq("?t=s"), e, 204); if (calls !== before) { fail++; console.log("HATA sayaç Vision'a gitti"); } }
{ const e = env(); e.SAYAC = kv(); await w.fetch(sreq("?t=s"), e); await w.fetch(sreq("?t=s"), e); await w.fetch(sreq("?t=d"), e);
  const gun = new Date().toISOString().slice(0, 10);
  await t("sayaç artar (2 paylaşım, 1 indirme)", sreq("", { method: "GET" }), e, 200, (j) => j.gunler[gun].s === 2 && j.gunler[gun].d === 1);
  if ([...e.SAYAC.m.keys()].some((k) => !/^g:\d{4}-\d{2}-\d{2}:[sd]$/.test(k))) { fail++; console.log("HATA sayaç anahtarı yalnızca gün + tür olmalı"); }
  await t("sayaç: yabancı köken sayılmaz", sreq("?t=s", { origin: "https://evil.example" }), e, 403);
  await t("sayaç: bilinmeyen tür s sayılır", sreq("?t=<x>"), e, 204, () => e.SAYAC.m.get("g:" + gun + ":s") === "3"); }
{ const e = env(); e.SAYAC = kv(); e.SAYAC_LIMIT = lim(10); for (let i = 0; i < 10; i++) await w.fetch(sreq("?t=s"), e); await t("sayaç IP sınırı (11. istek)", sreq("?t=s"), e, 429); }
// Barkod: /off (Open Food Facts taklit), /urun (D1 taklit)
const breq = (yol, o = {}) => new Request("https://x.workers.dev" + yol, { method: o.method || "GET", headers: { "Content-Type": "application/json", "Origin": o.origin ?? ORIGIN, "CF-Connecting-IP": "1.2.3.4" }, body: o.body });
let offCalls = [];
const offYanit = (urunler) => (url) => { offCalls.push(url); const m = /https:\/\/([^/]+)\/api\/v2\/product\/(\d+)/.exec(url); const p = m && urunler[m[1] + "/" + m[2]];
  return p ? { status: 200, body: { status: 1, product: p } } : { status: 200, body: { status: 0 } }; };
const d1 = (eskiTablo) => { const rows = [], sqls = []; let ddl = 0;
  const st = (sql) => ({ sql, args: [], bind(...a) { this.args = a; return this; },
    async all() { return { results: rows.filter((r) => r.kod === this.args[0]).sort((a, b) => b.t - a.t).map(({ tur, dil, metin, t, kim }) => ({ tur, dil, metin, t, kim })) }; },
    async first() { return { n: rows.filter((r) => r.kod === this.args[0]).length }; },
    async run() { sqls.push(sql);
      if (/^ALTER/.test(sql)) { if (!eskiTablo) throw new Error("duplicate column name: kim"); return {}; }
      if (!/^INSERT/.test(sql)) return {};
      const [kod, tur, dil, metin, t, kim] = this.args; rows.push({ kod, tur, dil, metin, t, kim }); return {}; } });
  return { rows, sqls, get ddl() { return ddl; }, prepare: st, batch: async (l) => { ddl += l.length; return []; } }; };
const metinA = "İçindekiler: buğday unu, şeker, palm yağı, kakao tozu, tuz, emülgatör (soya lesitini), kabartıcı (sodyum bikarbonat).";
{ visionReply = offYanit({ "world.openfoodfacts.org/8690504025207": { code: "8690504025207", product_name_tr: "Bitter Çikolata", brands: "Ülker,X", lang: "tr", ingredients_text_tr: "Kakao kitlesi, şeker", ingredients_text: "Kakao kitlesi, şeker", last_modified_t: 1700000000 },
    "world.openbeautyfacts.org/4005900036650": { code: "4005900036650", product_name: "Krem", brands: "N", lang: "de", ingredients_text: "Aqua, Glycerin" } });
  offCalls = [];
  await t("off: gıda bulundu", breq("/off/8690504025207"), env(), 200, (j) => j.bulundu && j.db === "food" && j.ad === "Bitter Çikolata" && j.marka === "Ülker" && j.metin.tr === "Kakao kitlesi, şeker" && j.t === 1700000000000);
  if (offCalls.some((u) => !/^https:\/\/world\.open(food|beauty|products)facts\.org\/api\/v2\/product\/8690504025207\?/.test(u))) { fail++; console.log("HATA off: beklenmeyen adres", offCalls); }
  await t("off: kozmetik (dil = etiket dili)", breq("/off/4005900036650"), env(), 200, (j) => j.bulundu && j.db === "beauty" && j.metin.de === "Aqua, Glycerin");
  await t("off: bulunamadı", breq("/off/4006381333931"), env(), 200, (j) => j.bulundu === false);
  await t("off: geçersiz barkod biçimi", breq("/off/12ab"), env(), 400);
  await t("off: yabancı köken", breq("/off/8690504025207", { origin: "https://evil.example" }), env(), 403);
  visionReply = () => { throw new Error("ağ yok"); };
  await t("off: ağ hatası sessizce bulunamadı", breq("/off/8690504025207"), env(), 200, (j) => j.bulundu === false);
  const e = env(); e.BARKOD_LIMIT = lim(30); for (let i = 0; i < 30; i++) await w.fetch(breq("/off/12345670"), e);
  await t("barkod IP sınırı (31. istek)", breq("/off/12345670"), e, 429); }
{ const e = env();
  await t("urun: D1 yok, GET sessiz", breq("/urun/8690504025207"), e, 200, (j) => j.bulundu === false && j.devreDisi);
  await t("urun: D1 yok, POST sessiz 204", breq("/urun", { method: "POST", body: JSON.stringify({ kod: "8690504025207", tur: "gida", dil: "tr", metin: metinA }) }), e, 204); }
{ const e = env(); e.URUNLER = d1(); const post = (b) => breq("/urun", { method: "POST", body: JSON.stringify(b) });
  await t("urun: geçersiz kontrol hanesi", post({ kod: "8690504025208", tur: "gida", dil: "tr", metin: metinA }), e, 400);
  await t("urun: geçersiz tür", post({ kod: "8690504025207", tur: "x", dil: "tr", metin: metinA }), e, 400);
  await t("urun: kısa metin", post({ kod: "8690504025207", tur: "gida", dil: "tr", metin: "su" }), e, 400);
  await t("urun: katkı kaydedildi", post({ kod: "8690504025207", tur: "gida", dil: "tr", metin: metinA }), e, 201);
  const r = e.URUNLER.rows[0];
  if (!r || Object.keys(r).sort().join() !== "dil,kim,kod,metin,t,tur" || r.kim !== null) { fail++; console.log("HATA urun: satırda yalnızca kod, tür, dil, metin, zaman, katkıcı olmalı (IP yok); kimliksiz katkıda kim boş", r); }
  await t("urun: tek katkı doğrulanmamış", breq("/urun/8690504025207"), e, 200, (j) => j.bulundu && !j.dogrulandi && j.sayi === 1 && j.tur === "gida");
  if (e.URUNLER.ddl !== 2 || !e.URUNLER.sqls.some((q) => /CREATE INDEX IF NOT EXISTS katki_kim/.test(q))) { fail++; console.log("HATA urun: tablo ve indeksler otomatik oluşmalı (CREATE IF NOT EXISTS)"); }
  // Katkıcı kimliği (O-22)
  const kim = "0123456789abcdef0123456789abcdef";
  await t("urun: geçersiz katkıcı kimliği", post({ kod: "4006381333931", tur: "gida", dil: "tr", metin: metinA, kim: "ali@ornek.com" }), e, 400);
  await t("urun: kimlikli katkı", post({ kod: "4006381333931", tur: "gida", dil: "tr", metin: metinA, kim }), e, 201, () => e.URUNLER.rows.at(-1).kim === kim);
  await t("urun: GET yanıtında kimlik yok", breq("/urun/4006381333931"), e, 200, (j) => j.bulundu && !("kim" in j) && !JSON.stringify(j).includes(kim)); }
{ const e = env(); e.URUNLER = d1(true); const w2 = (await import("./src/index.js?eski-tablo")).default;   // tablo hazırlığı modül başına bir kez: yeni kopya
  const res = await w2.fetch(breq("/urun/8690504025207"), e);
  if (res.status !== 200 || !e.URUNLER.sqls.includes("ALTER TABLE katki ADD COLUMN kim TEXT")) { fail++; console.log("HATA urun: eski tabloya kim sütunu eklenmeli", res.status, e.URUNLER.sqls); } else console.log("ok   urun: eski tabloya kim sütunu eklenir"); }
// Doğrulama kuralı (saf): farklı zamanlarda iki benzer katkı doğrulanmış; aynı anda gelen iki katkı doğrulanmamış; farklı içerik ayrı grup
{ const T0 = 1_700_000_000_000, b = metinA.replace("tuz", "tuz,");
  const s1 = urunSec([{ tur: "gida", dil: "tr", metin: metinA, t: T0 }, { tur: "gida", dil: "tr", metin: b, t: T0 + KATKI_ARALIK_MS }]);
  const s2 = urunSec([{ tur: "gida", dil: "tr", metin: metinA, t: T0 }, { tur: "gida", dil: "tr", metin: b, t: T0 + 1000 }]);
  const s3 = urunSec([{ tur: "gida", dil: "tr", metin: "Su, şeker, karbondioksit, aroma vericiler, asitlik düzenleyici (sitrik asit)", t: T0 + 5 }, { tur: "gida", dil: "tr", metin: metinA, t: T0 }, { tur: "gida", dil: "tr", metin: b, t: T0 + KATKI_ARALIK_MS }]);
  const ok = s1.dogrulandi && s1.sayi === 2 && !s2.dogrulandi && s3.dogrulandi && s3.metin === b && !urunSec([]).bulundu;
  if (!ok) { fail++; console.log("HATA urunSec doğrulama kuralı", s1, s2, s3); } else console.log("ok   urunSec doğrulama kuralı");
  // Aynı katkıcı kendi katkısını doğrulayamaz; farklı katkıcı ya da kimliksiz eski katkı doğrular
  const A = "a".repeat(32), B = "b".repeat(32), k = (kim, t) => ({ tur: "gida", dil: "tr", metin: metinA, t, kim });
  const ayni = urunSec([k(A, T0), k(A, T0 + KATKI_ARALIK_MS)]), farkli = urunSec([k(A, T0), k(B, T0 + KATKI_ARALIK_MS)]);
  const eski = urunSec([k(null, T0), k(A, T0 + KATKI_ARALIK_MS)]), uc = urunSec([k(A, T0), k(A, T0 + KATKI_ARALIK_MS), k(B, T0 + 1000)]);
  if (ayni.dogrulandi || !farkli.dogrulandi || !eski.dogrulandi || uc.dogrulandi || "kim" in farkli) { fail++; console.log("HATA urunSec katkıcı kuralı", ayni, farkli, eski, uc); } else console.log("ok   urunSec: aynı katkıcı kendini doğrulamaz");
  if (!barkodGecerli("8690504025207") || barkodGecerli("8690504025208") || !barkodGecerli("012345678905") || !barkodGecerli("01234565")) { fail++; console.log("HATA barkodGecerli"); } }
console.log(fail ? fail + " hata" : "tüm testler geçti");
process.exit(fail ? 1 : 0);
