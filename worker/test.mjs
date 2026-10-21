// Worker'ın yerel testi: node worker/test.mjs  (Vision ve rate limit taklit edilir)
import w from "./src/index.js";
import { urunSec, barkodGecerli, katkiOzet, KATKI_ARALIK_MS, KIMLIKSIZ_SON, ayniKisi, toplamFark } from "./src/barkod.js";
import { agOnek, visionKutular } from "./src/index.js";
const ORIGIN = "https://burakkagancan-ux.github.io";
let calls = 0, visionReply = () => ({ status: 200, body: { responses: [{ fullTextAnnotation: { text: "Aqua, Glycerin" } }] } });
globalThis.fetch = async (url, opt) => { calls++; const v = visionReply(url, opt); return new Response(JSON.stringify(v.body), { status: v.status }); };
const lim = n => { let c = 0; return { limit: async () => ({ success: ++c <= n }) }; };
const env = () => ({ VISION_KEY: "k", ALLOWED_ORIGIN: ORIGIN, IP_LIMIT: lim(6), GLOBAL_LIMIT: lim(30) });
const img = "/9j/" + "A".repeat(200);
const req = (body, o = {}) => new Request("https://x.workers.dev/", { method: o.method || "POST", headers: { "Content-Type": "application/json", "Origin": o.origin ?? ORIGIN, "CF-Connecting-IP": "1.2.3.4", ...(o.h || {}) }, body: o.method === "OPTIONS" || o.method === "GET" ? undefined : body });
let fail = 0;
// Hata kaydı (kayit): console.error satırları toplanır; sonda IP ve içerik geçmiyor mu denetlenir
const KAYIT = [], TUM_KAYIT = []; console.error = (...a) => { KAYIT.push(a.join(" ")); TUM_KAYIT.push(a.join(" ")); };
async function t(name, r, e, status, check) {
  const res = await w.fetch(r, e); const txt = await res.text(); let j = {}; try { j = JSON.parse(txt); } catch {}
  const ok = res.status === status && (!check || check(j, res));
  if (!ok) { fail++; console.log("HATA", name, res.status, txt); } else console.log("ok  ", name, res.status, j.error || j.text || "");
}
await t("başarılı okuma", req(JSON.stringify({ image: img })), env(), 200, j => j.text === "Aqua, Glycerin");
// Sözcük kutuları (A-02): yalnızca {kutu: true} isteyene; istemeyenin yanıtı eskisi gibi yalnızca text
{ const sem = (y, v) => ({ symbols: [...y].map(c => ({ text: c })), boundingBox: { vertices: v } });
  const fta = { text: "Yağ 12,5", pages: [{ width: 1800, height: 1200, blocks: [{ paragraphs: [{ words: [
    sem("Yağ", [{ x: 10, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 40 }, { x: 10, y: 40 }]),
    sem("12,5", [{ x: 300, y: 21 }, { y: 21 }, { x: 350, y: 41 }, { x: 300, y: 41 }]), { symbols: [] } ] }] }] }] };
  const eski = visionReply; visionReply = () => ({ status: 200, body: { responses: [{ fullTextAnnotation: fta }] } });
  await t("kutu istenmedi: yalnızca text", req(JSON.stringify({ image: img })), env(), 200, j => j.text === "Yağ 12,5" && Object.keys(j).join() === "text");
  await t("kutu: \"1\" kutu sayılmaz", req(JSON.stringify({ image: img, kutu: "1" })), env(), 200, j => !("kutu" in j));
  await t("kutu istendi", req(JSON.stringify({ image: img, kutu: true })), env(), 200, j => j.text === "Yağ 12,5" && JSON.stringify(j.boyut) === "[1800,1200]"
    && JSON.stringify(j.kutu) === JSON.stringify([["Yağ", 10, 20, 60, 20, 60, 40, 10, 40], ["12,5", 300, 21, 0, 21, 350, 41, 300, 41]]) && !("kutu_kesik" in j));
  visionReply = () => ({ status: 200, body: { responses: [{}] } });
  await t("kutu istendi, metin yok", req(JSON.stringify({ image: img, kutu: true })), env(), 200, j => j.text === "" && j.kutu.length === 0 && JSON.stringify(j.boyut) === "[0,0]");
  visionReply = eski;
  const cok = visionKutular({ pages: [{ width: 1, height: 1, blocks: [{ paragraphs: [{ words: Array.from({ length: 3001 }, () => sem("a", [])) }] }] }] });
  if (cok.kutu.length !== 3000 || cok.kutu_kesik !== true || cok.kutu[0].length !== 9) { fail++; console.log("HATA kutu sınırı", cok.kutu.length, cok.kutu_kesik); } else console.log("ok   kutu sınırı 3000, kutu_kesik");
  const tam = visionKutular({ pages: [{ blocks: [{ paragraphs: [{ words: Array.from({ length: 3000 }, () => sem("a", [])) }] }] }] });
  if (tam.kutu.length !== 3000 || "kutu_kesik" in tam) { fail++; console.log("HATA tam 3000 kesik sayılmamalı"); } else console.log("ok   tam 3000 kesik değil"); }
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
    async all() {
      if (/WHERE kim = \?/.test(sql)) { const kodlar = new Set(rows.filter((r) => r.kim === this.args[0]).map((r) => r.kod));
        return { results: rows.filter((r) => kodlar.has(r.kod)).sort((a, b) => b.t - a.t).map(({ kod, tur, metin, t, kim }) => ({ kod, tur, metin, t, kim })) }; }
      return { results: rows.filter((r) => r.kod === this.args[0]).sort((a, b) => b.t - a.t).map(({ tur, dil, metin, t, kim }) => ({ tur, dil, metin, t, kim })) }; },
    async first() { return { n: rows.filter((r) => r.kod === this.args[0]).length }; },
    async run() { sqls.push(sql);
      if (/^ALTER/.test(sql)) { if (!eskiTablo) throw new Error("duplicate column name: kim"); return {}; }
      if (!/^INSERT INTO katki/.test(sql)) return {};
      const [kod, tur, dil, metin, t, kim, iz] = this.args; rows.push({ kod, tur, dil, metin, t, kim, iz }); return {}; } });
  return { rows, sqls, get ddl() { return ddl; }, prepare: st, batch: async (l) => { ddl += l.length; return []; } }; };
const metinA = "İçindekiler: buğday unu, şeker, palm yağı, kakao tozu, tuz, emülgatör (soya lesitini), kabartıcı (sodyum bikarbonat).";
{ visionReply = offYanit({ "world.openfoodfacts.org/8690504025207": { code: "8690504025207", product_name_tr: "Bitter Çikolata", brands: "Ülker,X", lang: "tr", ingredients_text_tr: "Kakao kitlesi, şeker", ingredients_text: "Kakao kitlesi, şeker", last_modified_t: 1700000000,
    nutriments: { "energy-kcal_100g": 505, fat_100g: 25.1, "saturated-fat_100g": 16, sugars_100g: 30.5, sodium_100g: 0.04 }, quantity: "100 g" },
    "world.openbeautyfacts.org/4005900036650": { code: "4005900036650", product_name: "Krem", brands: "N", lang: "de", ingredients_text: "Aqua, Glycerin" } });
  offCalls = [];
  await t("off: gıda bulundu", breq("/off/8690504025207"), env(), 200, (j) => j.bulundu && j.db === "food" && j.ad === "Bitter Çikolata" && j.marka === "Ülker" && j.metin.tr === "Kakao kitlesi, şeker" && j.t === 1700000000000
    && j.besin && j.besin.kcal === 505 && j.besin.yag === 25.1 && j.besin.tuz === 0.1 && j.besin.karb === null && j.besin.birim === "g");
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
  if (!r || Object.keys(r).sort().join() !== "dil,iz,kim,kod,metin,t,tur" || r.kim !== null || r.iz !== null) { fail++; console.log("HATA urun: satırda yalnızca kod, tür, dil, metin, zaman, katkıcı, iz olmalı (IP yok); kimliksiz katkıda kim, KATKI_TUZ yokken iz boş", r); }
  await t("urun: tek katkı doğrulanmamış", breq("/urun/8690504025207"), e, 200, (j) => j.bulundu && !j.dogrulandi && j.sayi === 1 && j.tur === "gida");
  if (e.URUNLER.ddl !== 11 || !e.URUNLER.sqls.some((q) => /CREATE INDEX IF NOT EXISTS katki_kim/.test(q))) { fail++; console.log("HATA urun: tablo ve indeksler otomatik oluşmalı (CREATE IF NOT EXISTS)"); }
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
  // Aynı kişi (ayniKisi): kimlik cihazda üretildiği için iz de karşılaştırılır; iz yoksa yeni kimliksiz katkılar tek kişi
  const Y = KIMLIKSIZ_SON + 1000, s = (kim, iz, t = Y) => ({ kim, iz, t });
  const kurallar = [
    [ayniKisi(s(A, "1"), s(B, "1")), true, "farklı kimlik, aynı iz: aynı kişi"],
    [ayniKisi(s(A, "1"), s(A, "2")), true, "aynı kimlik, farklı iz: aynı kişi"],
    [ayniKisi(s(A, "1"), s(B, "2")), false, "farklı kimlik ve iz: farklı kişi"],
    [ayniKisi(s(null, "1"), s(null, "2")), false, "kimliksiz ama farklı iz: farklı kişi"],
    [ayniKisi(s(null, null), s(null, null)), true, "iz yok, yeni kimliksiz iki katkı: tek kişi"],
    [ayniKisi(s(null, null, T0), s(null, null, T0 + 1)), false, "iz yok, eski (O-22 öncesi) kimliksiz katkılar: ayrı kişi"],
    [ayniKisi(s(null, null), s(A, null)), false, "kimliksiz ile kimlikli: farklı kişi"],
    [ayniKisi(s(A, "1"), s(B, null)), false, "bir tarafta iz yoksa kimliğe bakılır"],
  ];
  for (const [g, b, m] of kurallar) if (g !== b) { fail++; console.log("HATA ayniKisi:", m); } else console.log("ok   ayniKisi:", m);
  const tf = (o, n) => JSON.stringify(toplamFark(o, n));
  if (tf({ bulundu: false }, { bulundu: true, tur: "gida", dogrulandi: false }) !== '[["urun:gida",1]]'
    || tf({ bulundu: true, tur: "gida", dogrulandi: true }, { bulundu: true, tur: "gida", dogrulandi: false }) !== '[["dogrulanan:gida",-1]]'
    || tf({ bulundu: true, tur: "gida", dogrulandi: true }, { bulundu: false }) !== '[["urun:gida",-1],["dogrulanan:gida",-1]]'
    || tf({ bulundu: true, tur: "gida", dogrulandi: false }, { bulundu: true, tur: "koz", dogrulandi: false }) !== '[["urun:gida",-1],["urun:koz",1]]'
    || tf({ bulundu: true, tur: "gida", dogrulandi: true }, { bulundu: true, tur: "gida", dogrulandi: true }) !== "[]") { fail++; console.log("HATA toplamFark"); } else console.log("ok   toplamFark: ekleme, doğrulamanın düşmesi, silme, tür değişimi, değişmeyen");
  const ag = [["1.2.3.4", "1.2.3.4"], ["2a02:4780:a:c0de::1", "2a02:4780:a:c0de::/64"], ["2A02:4780:000A:C0DE:1:2:3:4", "2a02:4780:a:c0de::/64"], ["2a02::5", "2a02:0:0:0::/64"], ["::1", "0:0:0:0::/64"]];
  for (const [g, b] of ag) if (agOnek(g) !== b) { fail++; console.log("HATA agOnek", g, agOnek(g), b); }
  console.log("ok   agOnek: IPv4 aynen, IPv6 ilk 64 bit");
  if (!barkodGecerli("8690504025207") || barkodGecerli("8690504025208") || !barkodGecerli("012345678905") || !barkodGecerli("01234565")) { fail++; console.log("HATA barkodGecerli"); } }
// Eklediklerim ve ürün rozetleri (G-02): POST /katki {kim}
{ const e = env(); e.URUNLER = d1(); const A = "a".repeat(32), B = "b".repeat(32), C = "c".repeat(32), T0 = 1_700_000_000_000, M = KATKI_ARALIK_MS;
  const satir = (kod, kim, t, metin = metinA, tur = "gida") => e.URUNLER.rows.push({ kod, tur, dil: "tr", metin, t, kim });
  satir("8690504025207", A, T0); satir("8690504025207", B, T0 + M);                 // A öncü ve avcı; B doğrulayıcı ve avcı
  satir("4006381333931", B, T0); satir("4006381333931", A, T0 + 1000);              // aynı anda: doğrulanmamış
  satir("5000112637922", A, T0); satir("5000112637922", A, T0 + M);                 // A kendini doğrulayamaz
  satir("3017620422003", null, T0); satir("3017620422003", A, T0 + M, metinA, "gida"); // kimliksiz eski katkıyı A doğrular
  satir("12345670", C, T0, "Aqua, Glycerin, Parfum, Linalool, Limonene", "koz");    // A'nın olmayan barkod
  const kreq = (b, o = {}) => breq("/katki", { method: o.method || "POST", origin: o.origin, body: b == null ? undefined : JSON.stringify(b) });
  await t("katki: geçersiz kimlik", kreq({ kim: "x" }), e, 400);
  await t("katki: GET reddi", breq("/katki"), e, 405);
  await t("katki: yabancı köken", kreq({ kim: A }, { origin: "https://evil.example" }), e, 403);
  await t("katki: A'nın sayıları", kreq({ kim: A }), e, 200, (j, r) => j.eklenen.gida === 4 && j.avci.gida === 2 && j.oncu.gida === 1 && j.dogrulayici.gida === 1 && j.urunler.length === 4 && r.headers.get("Cache-Control") === "no-store");
  await t("katki: liste durumları", kreq({ kim: A }), e, 200, (j) => { const u = Object.fromEntries(j.urunler.map((x) => [x.kod, x]));
    return u["8690504025207"].dogrulandi && u["8690504025207"].oncu && !u["8690504025207"].dogrulayici && !u["4006381333931"].dogrulandi && !u["5000112637922"].dogrulandi
      && u["3017620422003"].dogrulandi && u["3017620422003"].dogrulayici && !u["3017620422003"].oncu && !u["12345670"]; });
  await t("katki: başkalarının kimliği ve metni yok", kreq({ kim: A }), e, 200, (j) => !JSON.stringify(j).includes(B) && !JSON.stringify(j).includes("Linalool") && j.urunler.every((u) => Object.keys(u).sort().join() === "dogrulandi,dogrulayici,kod,oncu,ozet,t,tur"));
  await t("katki: B doğrulayıcı", kreq({ kim: B }), e, 200, (j) => j.avci.gida === 1 && j.dogrulayici.gida === 1 && !j.oncu.gida && j.eklenen.gida === 2);
  await t("katki: hiç eklemeyen kimlik", kreq({ kim: "d".repeat(32) }), e, 200, (j) => !j.urunler.length && !Object.keys(j.avci).length);
  const e2 = env(); await t("katki: D1 yok", kreq({ kim: A }), e2, 200, (j) => j.devreDisi && !j.urunler.length); }
// katkiOzet: farklı içerik ayrı grup; doğrulanmış ama benim olmayan grup sayılmaz
{ const A = "a".repeat(32), B = "b".repeat(32), C = "c".repeat(32), T0 = 1e12, M = KATKI_ARALIK_MS;
  const o = katkiOzet([{ kod: "1", tur: "gida", metin: "Su, şeker, karbondioksit, aroma vericiler, asitlik düzenleyici", t: T0 + 2 * M, kim: A },
    { kod: "1", tur: "gida", metin: metinA, t: T0 + M, kim: C }, { kod: "1", tur: "gida", metin: metinA, t: T0, kim: B }], A);
  if (o.avci.gida || o.oncu.gida || o.dogrulayici.gida || o.eklenen.gida !== 1 || o.urunler[0].dogrulandi) { fail++; console.log("HATA katkiOzet: başka içerikteki doğrulama sayılmamalı", o); } else console.log("ok   katkiOzet: farklı içerik ayrı"); }
// Hata kaydı ve yakalanmayan hata (15.10.2026)
visionReply = () => ({ status: 400, body: { responses: [{ error: { message: "API key not valid" } }] } });
{ KAYIT.length = 0; await w.fetch(req(JSON.stringify({ image: img })), env());
  const k = KAYIT.map((x) => JSON.parse(x));
  if (k.length !== 1 || k[0].olay !== "vision_hata" || k[0].ayrinti !== "API key not valid") { fail++; console.log("HATA kayıt: Vision hatası tek satır olmalı", KAYIT); } else console.log("ok   kayıt: Vision hatası"); }
{ const e = env(); e.IP_LIMIT = lim(0); KAYIT.length = 0; await w.fetch(req(JSON.stringify({ image: img })), e);
  if (!KAYIT.some((x) => JSON.parse(x).olay === "sinir_ip")) { fail++; console.log("HATA kayıt: IP sınırı", KAYIT); } else console.log("ok   kayıt: IP sınırı"); }
{ const e = env(); e.URUNLER = { prepare() { throw new Error("D1 çöktü"); }, batch: async () => { throw new Error("D1 çöktü"); } }; KAYIT.length = 0;
  await t("beklenmeyen hata: JSON 500 ve CORS", new Request("https://x.workers.dev/urun/8690504025207", { headers: { Origin: ORIGIN, "CF-Connecting-IP": "1.2.3.4" } }), e, 500,
    (j, r) => j.error && r.headers.get("Access-Control-Allow-Origin") === ORIGIN);
  const k = KAYIT.map((x) => JSON.parse(x));
  if (!k.some((x) => x.olay === "beklenmeyen" && x.ayrinti.startsWith("/urun ") && !x.ayrinti.includes("8690504025207"))) { fail++; console.log("HATA kayıt: beklenmeyen hata yolun ilk parçasıyla, barkodsuz", KAYIT); } else console.log("ok   kayıt: beklenmeyen hata"); }
// Bütün testler boyunca kayda IP, fotoğraf ya da okunan metin geçmedi
{ const hepsi = TUM_KAYIT.join("\n");
  if (/1\.2\.3\.4|\/9j\/AAAA|Aqua, Glycerin/.test(hepsi)) { fail++; console.log("HATA kayıt: IP ya da içerik kayda geçti"); } else console.log("ok   kayıt: IP ve içerik yok"); }
console.log(fail ? fail + " hata" : "tüm testler geçti");
process.exit(fail ? 1 : 0);
