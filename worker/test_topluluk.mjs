// Topluluk (G-04) Worker testi: node worker/test_topluluk.mjs
// D1 yerine gerçek SQLite (node:sqlite, Node 22.13+): SQL sözdizimi (ON CONFLICT, RETURNING, NOT EXISTS) gerçekten çalıştırılır.
import { DatabaseSync } from "node:sqlite";
import { toplulukSay, KATKI_ARALIK_MS } from "./src/barkod.js";
const ORIGIN = "https://burakkagancan-ux.github.io";
let fail = 0;
const ok = (c, m, x) => { if (!c) { fail++; console.log("HATA", m, x === undefined ? "" : JSON.stringify(x)); } else console.log("ok  ", m); };
// D1 bağlamasının kullandığımız kadarı: prepare().bind().all/first/run, batch
function d1() {
  const db = new DatabaseSync(":memory:");
  const st = (sql) => ({ args: [], bind(...a) { this.args = a; return this; },
    async all() { return { results: db.prepare(sql).all(...this.args) }; },
    async first() { return db.prepare(sql).get(...this.args) ?? null; },
    async run() { const r = db.prepare(sql).run(...this.args); return { meta: { changes: Number(r.changes) } }; } });
  return { db, prepare: st, batch: async (l) => { for (const s of l) await s.run(); return []; } };
}
// Rate limit taklidi: anahtar başına dakikada n
const lim = (n) => { const m = new Map(); return { m, limit: async ({ key }) => { m.set(key, (m.get(key) || 0) + 1); return { success: m.get(key) <= n }; } }; };
let ip = "1.2.3.4", SIMDI = 1_800_000_000_000;
Date.now = () => SIMDI;
const istek = (yol, o = {}) => new Request("https://x.workers.dev" + yol, { method: o.method || "GET", headers: { "Content-Type": "application/json", "Origin": o.origin ?? ORIGIN, "CF-Connecting-IP": ip }, body: o.body == null ? undefined : JSON.stringify(o.body) });
async function cagir(w, env, yol, o) { const r = await w.fetch(istek(yol, o), env); const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {} return { s: r.status, j, txt }; }
const metinA = "Kakao kitlesi, şeker, kakao yağı, emülgatör (soya lesitini), aroma verici, tuz";
const A = "a".repeat(32), B = "b".repeat(32);
const K1 = "8690504025207", K2 = "4006381333931", K3 = "5449000000996", KK = "3600523614875";

{ const w = (await import("./src/index.js?g04-1")).default;
  const env = { ALLOWED_ORIGIN: ORIGIN, URUNLER: d1(), ARANAN_LIMIT: lim(1) };
  // /aranan: doğrulama
  ok((await cagir(w, env, "/aranan", { method: "POST", body: { kod: "8690504025208", tur: "gida" } })).s === 400, "aranan: geçersiz kontrol hanesi 400");
  ok((await cagir(w, env, "/aranan", { method: "POST", body: { kod: K1, tur: "x" } })).s === 400, "aranan: geçersiz tür 400");
  ok((await cagir(w, env, "/aranan")).s === 405, "aranan: GET 405");
  ok((await cagir(w, env, "/aranan", { method: "POST", body: { kod: K1, tur: "gida" }, origin: "https://evil.example" })).s === 403, "aranan: yabancı köken 403");
  ok((await cagir(w, env, "/aranan", { method: "POST", body: "x".repeat(600) })).s === 413, "aranan: uzun gövde 413");
  // Sayım: ilk arama 1, başka IP 2; aynı IP aynı barkod dakikada bir kez
  let r = await cagir(w, env, "/aranan", { method: "POST", body: { kod: K1, tur: "gida" } });
  ok(r.s === 200 && r.j.n === 1, "aranan: ilk arama n=1", r);
  r = await cagir(w, env, "/aranan", { method: "POST", body: { kod: K1, tur: "gida" } });
  ok(r.s === 429, "aranan: aynı IP aynı barkodu dakikada bir kez sayar", r);
  ip = "5.6.7.8"; r = await cagir(w, env, "/aranan", { method: "POST", body: { kod: K1, tur: "gida" } });
  ok(r.s === 200 && r.j.n === 2, "aranan: başka IP n=2", r);
  ip = "9.9.9.9"; await cagir(w, env, "/aranan", { method: "POST", body: { kod: K1, tur: "gida" } });
  await cagir(w, env, "/aranan", { method: "POST", body: { kod: K2, tur: "gida" } });
  await cagir(w, env, "/aranan", { method: "POST", body: { kod: KK, tur: "koz" } });
  SIMDI += 1000; await cagir(w, env, "/aranan", { method: "POST", body: { kod: K3, tur: "gida" } });
  // Saklanan: yalnızca barkod, tür, sayı, ilk/son zaman; IP hiçbir tabloda yok
  const sut = env.URUNLER.db.prepare("PRAGMA table_info(aranan)").all().map((c) => c.name).join();
  ok(sut === "kod,tur,n,ilk,son", "aranan tablosu yalnızca kod, tür, sayı, zaman", sut);
  const dokum = JSON.stringify(["aranan", "toplam", "katki"].map((t) => env.URUNLER.db.prepare("SELECT * FROM " + t).all()));
  ok(!/1\.2\.3\.4|5\.6\.7\.8|9\.9\.9\.9/.test(dokum), "IP adresi veritabanına yazılmaz");
  // /topluluk: eksik ürünler çok arananlar önce, aynı sayıda yeni aranan önce; tür süzgeci
  r = await cagir(w, env, "/topluluk?tur=gida");
  ok(r.s === 200 && r.j.eksik.map((x) => x.kod + ":" + x.n).join() === [K1 + ":3", K3 + ":1", K2 + ":1"].join(), "topluluk: gıda eksikleri sıralı", r.j);
  ok(r.j.eksik.every((x) => Object.keys(x).sort().join() === "kod,n,son,tur"), "topluluk: eksik kaydında yalnızca kod, tür, sayı, son arama");
  r = await cagir(w, env, "/topluluk");
  ok(r.j.eksik.length === 4 && r.j.eksik.some((x) => x.kod === KK && x.tur === "koz"), "topluluk: tür verilmezse hepsi", r.j.eksik);
  ok((await cagir(w, env, "/topluluk?tur=koz")).j.eksik.map((x) => x.kod).join() === KK, "topluluk: kozmetik süzgeci");
  ok((await cagir(w, env, "/topluluk", { method: "POST", body: {} })).s === 405, "topluluk: POST 405");
  ok((await cagir(w, env, "/topluluk", { origin: "https://evil.example" })).s === 403, "topluluk: yabancı köken 403");
  // İçerik eklenince barkod listeden çıkar, ürün sayısı artar; yeniden aranırsa sayılmaz
  r = await cagir(w, env, "/urun", { method: "POST", body: { kod: K1, tur: "gida", dil: "tr", metin: metinA, kim: A } });
  ok(r.s === 201, "urun: katkı", r);
  r = await cagir(w, env, "/topluluk?tur=gida");
  ok(!r.j.eksik.some((x) => x.kod === K1) && r.j.sayilar.urun.gida === 1 && !r.j.sayilar.dogrulanan.gida, "içerik eklenen barkod eksiklerden çıkar; ürün 1, doğrulanan 0", r.j);
  ip = "7.7.7.7"; r = await cagir(w, env, "/aranan", { method: "POST", body: { kod: K1, tur: "gida" } });
  ok(r.s === 200 && r.j.icerikVar && r.j.n === 0 && !env.URUNLER.db.prepare("SELECT 1 FROM aranan WHERE kod = ?").get(K1), "içeriği olan barkod sayılmaz", r.j);
  // Aynı kişinin ikinci katkısı doğrulamaz; başka kişinin 10 dk sonraki benzer katkısı doğrular (bir kez sayılır)
  SIMDI += KATKI_ARALIK_MS; await cagir(w, env, "/urun", { method: "POST", body: { kod: K1, tur: "gida", dil: "tr", metin: metinA, kim: A } });
  ok(!(await cagir(w, env, "/topluluk?tur=gida")).j.sayilar.dogrulanan.gida, "aynı kişinin ikinci katkısı doğrulanan saymaz");
  await cagir(w, env, "/urun", { method: "POST", body: { kod: K1, tur: "gida", dil: "tr", metin: metinA + ".", kim: B } });
  r = await cagir(w, env, "/topluluk?tur=gida");
  ok(r.j.sayilar.dogrulanan.gida === 1 && r.j.sayilar.urun.gida === 1, "başkasının benzer katkısı: doğrulanan 1", r.j.sayilar);
  SIMDI += KATKI_ARALIK_MS; await cagir(w, env, "/urun", { method: "POST", body: { kod: K1, tur: "gida", dil: "tr", metin: metinA, kim: "c".repeat(32) } });
  ok((await cagir(w, env, "/topluluk")).j.sayilar.dogrulanan.gida === 1, "doğrulanmış ürüne yeni katkı yeniden saymaz");
  ok(!/kim|metin|aaaa|bbbb/.test((await cagir(w, env, "/topluluk")).txt), "topluluk yanıtında kimlik ve içerik metni yok");
  // 180 gündür aranmayan barkod silinir
  SIMDI += 181 * 86_400_000; r = await cagir(w, env, "/topluluk");
  ok(r.j.eksik.length === 0 && !env.URUNLER.db.prepare("SELECT COUNT(*) AS n FROM aranan").get().n, "180 gündür aranmayan barkod silinir", r.j.eksik);
  // D1 yoksa sessiz
  const e2 = { ALLOWED_ORIGIN: ORIGIN };
  ok((await cagir(w, e2, "/aranan", { method: "POST", body: { kod: K2, tur: "gida" } })).s === 204, "D1 yok: aranan 204");
  r = await cagir(w, e2, "/topluluk"); ok(r.s === 200 && r.j.devreDisi && !r.j.eksik.length, "D1 yok: topluluk devre dışı"); }

// G-04 öncesi katkılar: sayaçlar ilk açılışta bir kez bütün katkılardan sayılır
{ const w = (await import("./src/index.js?g04-2")).default;
  const env = { ALLOWED_ORIGIN: ORIGIN, URUNLER: d1() };
  const db = env.URUNLER.db, T = SIMDI - 86_400_000;
  db.exec("CREATE TABLE katki (id INTEGER PRIMARY KEY AUTOINCREMENT, kod TEXT NOT NULL, tur TEXT NOT NULL, dil TEXT, metin TEXT NOT NULL, t INTEGER NOT NULL, kim TEXT)");
  const ekle = db.prepare("INSERT INTO katki (kod, tur, dil, metin, t, kim) VALUES (?, ?, 'tr', ?, ?, ?)");
  ekle.run(K1, "gida", metinA, T, A); ekle.run(K1, "gida", metinA, T + KATKI_ARALIK_MS, B);   // doğrulanmış
  ekle.run(K2, "gida", metinA, T, A);                                                            // tek katkı
  ekle.run(KK, "koz", "Aqua, Glycerin, Cetearyl Alcohol, Parfum, Linalool", T, null);
  ekle.run(KK, "koz", "Aqua, Glycerin, Cetearyl Alcohol, Parfum, Linalool", T + KATKI_ARALIK_MS, null);   // kimliksiz eski katkılar ayrı kişi
  let r = await cagir(w, env, "/topluluk");
  ok(JSON.stringify(r.j.sayilar) === JSON.stringify({ urun: { gida: 2, koz: 1, tem: 0 }, dogrulanan: { gida: 1, koz: 1, tem: 0 } }), "ilk açılışta eski katkılar sayılır", r.j.sayilar);
  ekle.run(K3, "gida", metinA, T, A);   // doğrudan tabloya: sayaç artmaz, sayım bir daha baştan yapılmaz
  r = await cagir(w, env, "/topluluk");
  ok(r.j.sayilar.urun.gida === 2, "baştan sayım yalnızca bir kez", r.j.sayilar);
  const s = toplulukSay([{ kod: "1", tur: "gida", metin: metinA, t: T, kim: A }, { kod: "1", tur: "gida", metin: metinA, t: T + 1000, kim: B }, { kod: "2", tur: "tem", metin: "x y z", t: T, kim: A }]);
  ok(JSON.stringify(s) === JSON.stringify({ urun: { gida: 1, tem: 1 }, dogrulanan: {} }), "toplulukSay: 10 dakikadan kısa arayla gelen iki katkı doğrulamaz", s); }

console.log(fail ? fail + " hata" : "tüm testler geçti");
process.exit(fail ? 1 : 0);
