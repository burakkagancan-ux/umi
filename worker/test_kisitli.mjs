// Kısıtlı önekli barkodlar (C-10, 04.11.2026): node worker/test_kisitli.mjs
// Ürünü tanımlamayan barkod (mağaza içi / tartılı, yayın, kupon; kaynak/gs1_onek.tsv) OFF'a sorulmaz, D1'de aranmaz, hiçbir tabloya yazılmaz;
// eski veride kalmışsa topluluk listesinde görünmez, yönetimde "kisitli" görünümünde listelenir. Gerçek SQLite (node:sqlite).
import { DatabaseSync } from "node:sqlite";
const ORIGIN = "https://burakkagancan-ux.github.io";
let fail = 0;
const ok = (c, m, x) => { if (!c) { fail++; console.log("HATA", m, x === undefined ? "" : JSON.stringify(x)); } else console.log("ok  ", m); };
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
let offIstek = [];
globalThis.fetch = async (url) => { offIstek.push(String(url)); return new Response(JSON.stringify({ status: 0 }), { status: 200 }); };
const ANAHTAR = "k".repeat(40);
const istek = (yol, o = {}) => new Request("https://x.workers.dev" + yol, { method: o.method || "GET",
  headers: { "Content-Type": "application/json", "Origin": ORIGIN, "CF-Connecting-IP": "1.2.3.4", ...(o.yonetim ? { "Authorization": "Bearer " + ANAHTAR } : {}) },
  body: o.body === undefined ? undefined : JSON.stringify(o.body) });
async function cagir(w, env, yol, o) { const r = await w.fetch(istek(yol, o), env); const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {} return { s: r.status, j, txt }; }

const KISITLI = [["2012345001503", "magaza"], ["212345678909", "magaza"], ["0212345678909", "magaza"], ["0000000123457", "magaza"], ["9780306406157", "yayin"],
  ["9771234567003", "yayin"], ["9912345678909", "urun_degil"], ["9801234567892", "urun_degil"], ["9521234567899", "urun_degil"], ["0501234567890", "urun_degil"]];
const NORMAL = "8690504025207", SINIR = "981123456786";   // 12 hane → 0981…: GS1 US, kısıtlı değil
const metin = "Kakao kitlesi, şeker, kakao yağı, emülgatör (soya lesitini), aroma verici, tuz";
const tablo = { b: { kcal: 505, yag: 25.1, doymus: 16, karb: 68.8, seker: 30.5, lif: null, protein: 3.2, tuz: 0.1 }, lt: {}, birim: "g" };

{
  const w = (await import("./src/index.js?kisitli")).default;
  const env = { ALLOWED_ORIGIN: ORIGIN, URUNLER: d1(), ARANAN_LIMIT: lim(), BARKOD_LIMIT: lim(), YONETIM_ANAHTARI: ANAHTAR };
  for (const [kod, tur] of KISITLI) {
    offIstek = [];
    let r = await cagir(w, env, "/off/" + kod);
    ok(r.s === 200 && r.j.bulundu === false && r.j.kisitli === tur && offIstek.length === 0, "GET /off/" + kod + ": OFF'a sorulmaz, kisitli=" + tur, [r.j, offIstek.length]);
    r = await cagir(w, env, "/urun/" + kod);
    ok(r.s === 200 && r.j.bulundu === false && r.j.kisitli === tur, "GET /urun/" + kod + ": aranmaz", r.j);
    r = await cagir(w, env, "/urun", { method: "POST", body: { kod, tur: "gida", dil: "tr", metin, kim: "a".repeat(32) } });
    ok(r.s === 400 && r.j.kisitli === tur, "POST /urun " + kod + ": 400", r.j);
    r = await cagir(w, env, "/besin", { method: "POST", body: { kod, besin: tablo, kim: "a".repeat(32) } });
    ok(r.s === 400 && r.j.kisitli === tur, "POST /besin " + kod + ": 400", r.j);
    r = await cagir(w, env, "/aranan", { method: "POST", body: { kod, tur: "gida" } });
    ok(r.s === 400 && r.j.kisitli === tur, "POST /aranan " + kod + ": 400", r.j);
  }
  // Boşluklu ya da tireli gövde de aynı barkod sayılır (Worker rakam dışını atar)
  let r = await cagir(w, env, "/urun", { method: "POST", body: { kod: "201-2345-001503", tur: "gida", dil: "tr", metin } });
  ok(r.s === 400 && r.j.kisitli === "magaza", "POST /urun tireli kısıtlı barkod da 400", r.j);
  const db = env.URUNLER.db;
  // Kısıtlama aşırı geniş değil: normal ve sınır barkodu eskisi gibi
  offIstek = [];
  r = await cagir(w, env, "/off/" + NORMAL);
  ok(r.s === 200 && r.j.kisitli === undefined && offIstek.length > 0, "normal barkod OFF'a sorulur", [r.j, offIstek.length]);
  offIstek = [];
  r = await cagir(w, env, "/off/" + SINIR);
  ok(r.s === 200 && r.j.kisitli === undefined && offIstek.length > 0, "0981… (GS1 US) kısıtlı sayılmaz, OFF'a sorulur", r.j);
  r = await cagir(w, env, "/urun", { method: "POST", body: { kod: NORMAL, tur: "gida", dil: "tr", metin, kim: "a".repeat(32) } });
  ok(r.s === 201, "normal barkoda katkı yazılır", r);
  r = await cagir(w, env, "/aranan", { method: "POST", body: { kod: SINIR, tur: "gida" } });
  ok(r.s === 200, "sınır barkodu aranan listesine girer", r);
  const dokum = JSON.stringify(["katki", "besin", "aranan"].map((t) => db.prepare("SELECT kod FROM " + t).all()));
  ok(dokum === JSON.stringify([[{ kod: NORMAL }], [], [{ kod: SINIR }]]), "D1'de yalnızca normal ve sınır barkodu var; hiçbir kısıtlı barkod yazılmadı", dokum);

  // Eski veri: güncellemeden önce girmiş kısıtlı satırlar (12 haneli kayıt dahil)
  db.prepare("INSERT INTO katki (kod, tur, dil, metin, t, kim) VALUES ('2012345001503', 'gida', 'tr', ?, ?, ?)").run(metin, SIMDI, "b".repeat(32));
  db.prepare("INSERT INTO katki (kod, tur, dil, metin, t, kim) VALUES ('212345678909', 'gida', 'tr', ?, ?, ?)").run(metin, SIMDI, "b".repeat(32));
  db.prepare("INSERT INTO besin (kod, besin, t, kim) VALUES ('9780306406157', ?, ?, ?)").run(JSON.stringify(tablo), SIMDI, "b".repeat(32));
  db.prepare("INSERT INTO aranan (kod, tur, n, ilk, son) VALUES ('9912345678909', 'gida', 9, ?, ?)").run(SIMDI, SIMDI);
  db.prepare("INSERT INTO aranan (kod, tur, n, ilk, son) VALUES ('0291234567890', 'gida', 8, ?, ?)").run(SIMDI, SIMDI);
  r = await cagir(w, env, "/topluluk?tur=gida");
  ok(r.s === 200 && r.j.eksik.map((x) => x.kod).join() === SINIR, "topluluk: eski kısıtlı aranan satırları listelenmez, sınır barkodu listelenir", r.j.eksik);
  r = await cagir(w, env, "/yonetim/api/liste?gor=kisitli", { yonetim: true });
  const kodlar = r.j && r.j.urunler ? r.j.urunler.map((u) => u.kod).sort().join() : "";
  ok(r.s === 200 && kodlar === ["2012345001503", "212345678909", "9780306406157"].sort().join(), "yönetim kisitli: eski katkı ve tablo satırları (12 haneli kayıt dahil)", r.j);
  ok(r.j && r.j.aranan.map((x) => x.kod).join() === "9912345678909,0291234567890", "yönetim kisitli: aranan listesindeki kısıtlı barkodlar", r.j && r.j.aranan);
  ok(!r.txt.includes(NORMAL) && !r.txt.includes(SINIR), "yönetim kisitli: normal ve sınır barkodu listelenmez");
  ok((await cagir(w, env, "/yonetim/api/liste?gor=kisitli")).s !== 200, "yönetim kisitli: anahtarsız açılmaz");
}

// --- Bozma turu gerileme testleri (04.11.2026) ---
import { barkodKisitli as jsKisitli, barkodKontrol } from "../js/barkod.js";
import { kisitliKosul } from "./src/barkod.js";
{
  // O1: topluluk süzmesi LIMIT'ten önce: 60 eski kısıtlı aranan satırı + 1 normal → normal listede
  const w = (await import("./src/index.js?kisitli-o1")).default;
  const env = { ALLOWED_ORIGIN: ORIGIN, URUNLER: d1(), ARANAN_LIMIT: lim(), BARKOD_LIMIT: lim(), YONETIM_ANAHTARI: ANAHTAR };
  await cagir(w, env, "/aranan", { method: "POST", body: { kod: NORMAL, tur: "gida" } });   // tabloları kurar, normal n=1
  const db = env.URUNLER.db;
  const kodlar = [];
  for (let i = 0; i < 60; i++) { const g = "20" + String(i).padStart(10, "0"); const k = g + barkodKontrol(g); kodlar.push(k);
    db.prepare("INSERT INTO aranan (kod, tur, n, ilk, son) VALUES (?, 'gida', ?, ?, ?)").run(k, 1000 - i, SIMDI, SIMDI); }
  let r = await cagir(w, env, "/topluluk?tur=gida");
  ok(r.s === 200 && r.j.eksik.map((x) => x.kod).join() === NORMAL, "O1: 60 eski kısıtlı aranan satırı normal barkodu listeden itmez", r.j && r.j.eksik.length);
  // O2: yönetim kisitli sayfalı (50'lik sayfa; 2. sayfa 10 satır, devam yok)
  r = await cagir(w, env, "/yonetim/api/liste?gor=kisitli&sayfa=0", { yonetim: true });
  ok(r.s === 200 && r.j.aranan.length === 50 && r.j.devam === true && r.j.sayfa === 0, "O2: kisitli 1. sayfa 50 satır, devam var", r.j && [r.j.aranan.length, r.j.devam]);
  const r2 = await cagir(w, env, "/yonetim/api/liste?gor=kisitli&sayfa=1", { yonetim: true });
  ok(r2.s === 200 && r2.j.aranan.length === 10 && r2.j.devam === false && r2.j.sayfa === 1 && !r2.j.aranan.some((x) => r.j.aranan.some((y) => y.kod === x.kod)), "O2: 2. sayfa kalan 10 satır, tekrar yok", r2.j && [r2.j.aranan.length, r2.j.devam]);
  ok(Array.isArray(r.j.onek) && r.j.onek.some((o) => o.aralik === "981–983" && o.tur === "urun_degil") && r.j.onek.some((o) => o.aralik === "0000000"), "D5: yönetim açıklaması üretilmiş tablodan (981–983, 0000000)", r.j.onek);
  // D1: Eklediklerim eski kısıtlı katkıyı saymaz ve listelemez
  const K = "c".repeat(32);
  db.prepare("INSERT INTO katki (kod, tur, dil, metin, t, kim) VALUES ('2012345001503', 'gida', 'tr', ?, ?, ?)").run(metin, SIMDI, K);
  db.prepare("INSERT INTO katki (kod, tur, dil, metin, t, kim) VALUES ('9780306406157', 'gida', 'tr', ?, ?, ?)").run(metin, SIMDI, K);
  db.prepare("INSERT INTO katki (kod, tur, dil, metin, t, kim) VALUES (?, 'gida', 'tr', ?, ?, ?)").run(NORMAL, metin, SIMDI, K);
  r = await cagir(w, env, "/katki", { method: "POST", body: { kim: K } });
  ok(r.s === 200 && r.j.urunler.map((u) => u.kod).join() === NORMAL && r.j.eklenen.gida === 1, "D1: Eklediklerim eski kısıtlı katkıyı saymaz", r.j);
  // D3: 14 haneli GTIN-14 (başı 0) kısıtlı sayılır, OFF'a sorulmaz
  offIstek = [];
  r = await cagir(w, env, "/off/02012345001503");
  ok(r.s === 200 && r.j.kisitli === "magaza" && offIstek.length === 0, "D3: GTIN-14 02012345001503 kısıtlı, OFF'a istek yok", [r.j, offIstek.length]);
}
{
  // D2: JS kuralı ile SQL koşulu aynı (8/12/13/14 haneli rastgele geçerli kodlar + tümü sıfır UPC-E + sınırlar)
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE t (kod TEXT)");
  let tohum = 7; const rnd = (n) => { tohum = (tohum * 48271) % 2147483647; return tohum % n; };
  const kodlar = new Set(["00000030", "00000107", "02012345001503", "00000000123457", "12012345001503", "981123456786", "20123451"]);
  for (let i = 0; i < 20000; i++) {
    const L = [7, 11, 12, 13][rnd(4)];
    let g = ""; const bas = ["0", "00", "02", "04", "05", "2", "97", "98", "99", "95", "1", "3", "8", ""][rnd(14)];
    g = bas; while (g.length < L) g += String(rnd(10)); g = g.slice(0, L);
    kodlar.add(g + barkodKontrol(g));
  }
  const ekle = db.prepare("INSERT INTO t (kod) VALUES (?)");
  for (const k of kodlar) ekle.run(k);
  const sql = new Set(db.prepare("SELECT kod FROM t WHERE " + kisitliKosul("kod")).all().map((x) => x.kod));
  const fark = [...kodlar].filter((k) => !!jsKisitli(k) !== sql.has(k));
  ok(fark.length === 0, "D2: " + kodlar.size + " kodda JS kuralı (barkodKisitli) ile SQL koşulu (kisitliKosul) aynı", fark.slice(0, 10));
  ok(sql.size > 1000 && sql.size < kodlar.size - 1000, "D2: örneklem iki tarafı da kapsıyor (" + sql.size + " kısıtlı)");
  ok(!jsKisitli("00000030") && !sql.has("00000030"), "D2: tümü sıfır UPC-E iki kuralda da kısıtlı değil");
}
if (fail) { console.log("\n" + fail + " hata"); process.exit(1); }
console.log("\nkısıtlı önek: hepsi geçti");
