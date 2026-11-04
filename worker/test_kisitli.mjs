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
if (fail) { console.log("\n" + fail + " hata"); process.exit(1); }
console.log("\nkısıtlı önek: hepsi geçti");
