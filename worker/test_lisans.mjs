// Lisans ayrılığı (O-31, 04.11.2026): node worker/test_lisans.mjs
// Kural (belgeler/mimari/barkod_worker.md "Lisans ayrılığı"): Open Food Facts verisi (ODbL, paylaşım koşullu) kullanıcı katkısı tablolarına
// (katki, besin, aranan, toplam ve onların kopyası silinen/islem) hiçbir yolda yazılmaz ve bu tablolarla tek sorguda birleştirilmez.
// Birleşirse ODbL'nin paylaşım koşulu bütün katkı veritabanına bulaşır (D-04'ün varlığı). İki denetim:
//   1) Dinamik: OFF yanıtındaki her alana benzersiz bir işaret konur, Worker'ın bütün barkod yolları çalıştırılır, D1'in her tablosunun
//      her hücresinde işaret aranır (gerçek SQLite).
//   2) Durağan: worker/src'deki her SQL yazımının hedef tablosu bilinen bir tarafta olmalı (KATKI ya da OFF_ON: off_ önekli); yeni tablo
//      sınıflanmadan eklenemez; bir SQL metni iki taraftan tabloyu birlikte anamaz.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
const ORIGIN = "https://burakkagancan-ux.github.io";
let fail = 0;
const ok = (c, m, x) => { if (!c) { fail++; console.log("HATA", m, x === undefined ? "" : JSON.stringify(x)); } else console.log("ok  ", m); };

// Kullanıcı katkısı tarafı (ve yalnızca kendi verimizin kopyasını tutan yönetim tabloları). OFF tarafı: adı off_ ile başlayan tablolar (O-29 off_onbellek).
export const KATKI_TABLO = ["katki", "besin", "aranan", "toplam", "olcum", "islem", "silinen"];
const OFF_TABLO = /^off_/;

// --- 1) Dinamik denetim ---
function d1() {
  const db = new DatabaseSync(":memory:");
  const st = (sql) => ({ args: [], bind(...a) { this.args = a; return this; },
    async all() { return { results: db.prepare(sql).all(...this.args) }; },
    async first() { return db.prepare(sql).get(...this.args) ?? null; },
    async run() { const r = db.prepare(sql).run(...this.args); return { meta: { changes: Number(r.changes) } }; },
    batchRun() { const q = db.prepare(sql); if (/RETURNING/.test(sql)) return { results: q.all(...this.args), meta: {} }; const r = q.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; } });
  return { db, prepare: st, batch: async (l) => { db.exec("BEGIN"); try { const r = []; for (const s of l) r.push(s.batchRun()); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
}
const lim = () => ({ limit: async () => ({ success: true }) });
let SIMDI = 1_800_000_000_000;
Date.now = () => SIMDI;
// İşaret: OFF'tan gelen her metin alanında; besin değerlerinde katkıda kullanılmayan, benzersiz sayılar
const IS = "OFFISARETI7Q";
const IS_SAYI = [777.71, 77.71, 7.771, 0.7771];
const KOD = "8690504025207";
const offUrun = { code: KOD, product_name: "Ad " + IS, product_name_tr: "Ad " + IS, brands: "Marka" + IS, lang: "tr", ingredients_text: "İçerik " + IS + ", şeker",
  ingredients_text_tr: "İçerik " + IS + ", şeker", ingredients_text_en: "Ingredients " + IS, last_modified_t: 1700000000, categories_tags: ["en:" + IS.toLowerCase()],
  nutriments: { "energy-kcal_100g": IS_SAYI[0], fat_100g: IS_SAYI[1], "saturated-fat_100g": IS_SAYI[2], sugars_100g: IS_SAYI[1], salt_100g: IS_SAYI[3], proteins_100g: IS_SAYI[2] }, quantity: "100 g" };
let offIstek = 0;
globalThis.fetch = async (url) => {
  const m = /https:\/\/([^/]+)\/api\/v2\/product\/(\d+)/.exec(String(url));
  if (m) offIstek++;
  const p = m && m[1] === "world.openfoodfacts.org" && m[2] === KOD ? offUrun : null;
  return new Response(JSON.stringify(p ? { status: 1, product: p } : { status: 0 }), { status: 200 });
};
const istek = (yol, o = {}) => new Request("https://x.workers.dev" + yol, { method: o.method || "GET",
  headers: { "Content-Type": "application/json", "Origin": ORIGIN, "CF-Connecting-IP": o.ip || "1.2.3.4" }, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
async function cagir(w, env, yol, o) { const r = await w.fetch(istek(yol, o), env); const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {} return { s: r.status, j, txt }; }

{
  const w = (await import("./src/index.js?lisans")).default;
  const env = { ALLOWED_ORIGIN: ORIGIN, URUNLER: d1(), ARANAN_LIMIT: lim(), BARKOD_LIMIT: lim(), KATKI_TUZ: "t".repeat(40) };
  const A = "a".repeat(32), B = "b".repeat(32);
  const kendiMetin = "Kakao kitlesi, şeker, kakao yağı, emülgatör (soya lesitini), aroma verici, tuz";
  const kendiTablo = { b: { kcal: 505, yag: 25.1, doymus: 16, karb: 68.8, seker: 30.5, lif: null, protein: 3.2, tuz: 0.1 }, lt: {}, birim: "g" };
  // OFF canlı sorgu gerçekten işareti taşıyor (taklit doğru kurulmuş mu)
  let r = await cagir(w, env, "/off/" + KOD);
  ok(r.s === 200 && r.j && r.j.bulundu && r.txt.includes(IS), "dinamik: /off yanıtı OFF işaretini taşıyor (taklit çalışıyor)", r.j);
  ok(offIstek > 0, "dinamik: OFF'a istek gitti");
  // Barkodun bütün yolları: ürün yok, aranan bildirimi, iki kişiden katkı ve tablo, topluluk, ürün yeniden
  await cagir(w, env, "/urun/" + KOD);
  await cagir(w, env, "/aranan", { method: "POST", body: { kod: KOD, tur: "gida" } });
  await cagir(w, env, "/urun", { method: "POST", body: { kod: KOD, tur: "gida", dil: "tr", metin: kendiMetin, kim: A } });
  await cagir(w, env, "/besin", { method: "POST", body: { kod: KOD, besin: kendiTablo, kim: A } });
  SIMDI += 11 * 60000;
  await cagir(w, env, "/urun", { method: "POST", ip: "5.6.7.8", body: { kod: KOD, tur: "gida", dil: "tr", metin: kendiMetin + ".", kim: B } });
  await cagir(w, env, "/besin", { method: "POST", ip: "5.6.7.8", body: { kod: KOD, besin: kendiTablo, kim: B } });
  await cagir(w, env, "/off/" + KOD);
  r = await cagir(w, env, "/urun/" + KOD);
  ok(r.s === 200 && r.j && r.j.bulundu, "dinamik: katkı yolu çalıştı (kendi veritabanında ürün var)", r.j);
  await cagir(w, env, "/topluluk");
  // D1'in her tablosunun her hücresi
  const db = env.URUNLER.db;
  const tablolar = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((x) => x.name);
  ok(tablolar.includes("katki") && tablolar.includes("besin"), "dinamik: katkı tabloları kuruldu", tablolar);
  const sayiRe = new RegExp("(^|[^0-9.])(" + IS_SAYI.map((n) => String(n).replace(".", "\\.")).join("|") + ")([^0-9]|$)");
  for (const t of tablolar) {
    if (OFF_TABLO.test(t)) continue;   // OFF tarafının kendi tablosu (O-29) OFF verisi taşıyabilir
    const dokum = JSON.stringify(db.prepare("SELECT * FROM " + t).all());
    ok(!dokum.includes(IS) && !dokum.toLowerCase().includes(IS.toLowerCase()), "dinamik: " + t + " tablosunda OFF metni yok");
    ok(!sayiRe.test(dokum), "dinamik: " + t + " tablosunda OFF besin değeri yok");
  }
  // Ölçer kendini sınar: işaret bir katkı satırına bilerek yazılınca yakalanmalı
  db.prepare("INSERT INTO katki (kod, tur, dil, metin, t) VALUES (?, 'gida', 'tr', ?, ?)").run(KOD, "x " + IS, SIMDI);
  ok(JSON.stringify(db.prepare("SELECT * FROM katki").all()).includes(IS), "dinamik: ölçer bilerek yazılan işareti bulur");
}

// --- 2) Durağan denetim: SQL yazımlarının hedef tabloları ---
export function sqlTablolar(src) {
  // Yalnızca SQL dizgileri: "..." ya da `...` içinde, SQL anahtar sözcüğüyle başlayan
  const yaz = [], anilan = [];
  const dizgi = /"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = dizgi.exec(src))) {
    const s = m[1] ?? m[2];
    if (!/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|REPLACE)\b/.test(s)) continue;
    const ad = [];
    for (const x of s.matchAll(/\b(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE|CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|DELETE\s+FROM)\s+([A-Za-z_]\w*)/g)) yaz.push(x[1]);
    for (const x of s.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|TABLE(?:\s+IF\s+NOT\s+EXISTS)?)\s+([A-Za-z_]\w*)/g)) ad.push(x[1]);
    anilan.push({ sql: s, tablolar: [...new Set(ad)] });
  }
  return { yaz: [...new Set(yaz)], anilan };
}
{
  const dizin = new URL("./src/", import.meta.url);
  const dosyalar = readdirSync(dizin).filter((f) => f.endsWith(".js"));
  ok(dosyalar.length >= 2, "durağan: worker/src dosyaları okundu", dosyalar);
  const ANAHTAR = new Set(["IF", "NOT", "EXISTS", "SELECT", "WHERE", "VALUES", "SET"]);
  for (const f of dosyalar) {
    const { yaz, anilan } = sqlTablolar(readFileSync(new URL(f, dizin), "utf-8"));
    const bilinmeyen = yaz.filter((t) => !ANAHTAR.has(t) && !KATKI_TABLO.includes(t) && !OFF_TABLO.test(t));
    ok(!bilinmeyen.length, "durağan: " + f + " yalnızca sınıflanmış tablolara yazar (yeni tablo KATKI_TABLO'ya ya da off_ önekine)", bilinmeyen);
    const karisik = anilan.filter((a) => a.tablolar.some((t) => KATKI_TABLO.includes(t)) && a.tablolar.some((t) => OFF_TABLO.test(t)));
    ok(!karisik.length, "durağan: " + f + " katkı ve OFF tablolarını tek sorguda birleştirmez", karisik.map((a) => a.sql));
  }
  // Ölçer kendini sınar
  const s1 = sqlTablolar('db.prepare("INSERT INTO off_onbellek (kod, yanit) VALUES (?, ?)"); db.prepare("CREATE TABLE IF NOT EXISTS urunler_hepsi (kod TEXT)")');
  ok(s1.yaz.includes("off_onbellek") && s1.yaz.includes("urunler_hepsi"), "durağan: ölçer INSERT ve CREATE TABLE hedefini bulur", s1.yaz);
  ok(!KATKI_TABLO.includes("urunler_hepsi") && !OFF_TABLO.test("urunler_hepsi"), "durağan: sınıflanmamış yeni tablo düşer");
  const s2 = sqlTablolar('db.prepare(`SELECT k.metin, o.yanit FROM katki k JOIN off_onbellek o ON o.kod = k.kod`)');
  ok(s2.anilan.some((a) => a.tablolar.includes("katki") && a.tablolar.includes("off_onbellek")), "durağan: ölçer katkı + OFF birleşimini bulur", s2.anilan);
}
if (fail) { console.log("\n" + fail + " hata"); process.exit(1); }
console.log("\nlisans ayrılığı: hepsi geçti");
