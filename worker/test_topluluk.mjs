// Topluluk (G-04) Worker testi: node worker/test_topluluk.mjs
// D1 yerine gerçek SQLite (node:sqlite, Node 22.13+): SQL sözdizimi (ON CONFLICT, RETURNING, NOT EXISTS) gerçekten çalıştırılır.
import { DatabaseSync } from "node:sqlite";
import { toplulukSay, KATKI_ARALIK_MS, KIMLIKSIZ_SON } from "./src/barkod.js";
const ORIGIN = "https://burakkagancan-ux.github.io";
let fail = 0;
const ok = (c, m, x) => { if (!c) { fail++; console.log("HATA", m, x === undefined ? "" : JSON.stringify(x)); } else console.log("ok  ", m); };
// D1 bağlamasının kullandığımız kadarı: prepare().bind().all/first/run, batch
function d1() {
  const db = new DatabaseSync(":memory:");
  const st = (sql) => ({ args: [], bind(...a) { this.args = a; return this; },
    async all() { return { results: db.prepare(sql).all(...this.args) }; },
    async first() { return db.prepare(sql).get(...this.args) ?? null; },
    async run() { const r = db.prepare(sql).run(...this.args); return { meta: { changes: Number(r.changes) } }; },
    batchRun() { const q = db.prepare(sql); if (/RETURNING/.test(sql)) return { results: q.all(...this.args), meta: {} }; const r = q.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; } });
  // D1 batch: tek işlem, araya başka yazım girmez (eşzamanlı istekler sırayla); biri hata verirse hepsi geri alınır; her deyimin sonucu döner
  return { db, prepare: st, batch: async (l) => { db.exec("BEGIN"); try { const r = []; for (const s of l) r.push(s.batchRun()); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
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
  ok(env.URUNLER.db.prepare("SELECT COUNT(*) AS n FROM katki WHERE kod = ? AND kim = ?").get(K1, A).n === 1, "aynı kimliğin ikinci katkısı öncekinin yerine geçer (tek satır)");
  SIMDI += KATKI_ARALIK_MS; await cagir(w, env, "/urun", { method: "POST", body: { kod: K1, tur: "gida", dil: "tr", metin: metinA + ".", kim: B } });
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
  const E = KIMLIKSIZ_SON - 86_400_000;
  ekle.run(KK, "koz", "Aqua, Glycerin, Cetearyl Alcohol, Parfum, Linalool", E, null);
  ekle.run(KK, "koz", "Aqua, Glycerin, Cetearyl Alcohol, Parfum, Linalool", E + KATKI_ARALIK_MS, null);   // kimliksiz eski (O-22 öncesi) katkılar ayrı kişi
  ekle.run("12345670", "tem", "Su, sodyum lauril eter sülfat, parfüm, limonen", T, null);
  ekle.run("12345670", "tem", "Su, sodyum lauril eter sülfat, parfüm, limonen", T + KATKI_ARALIK_MS, null);   // yeni kimliksiz iki katkı: tek kişi
  let r = await cagir(w, env, "/topluluk");
  ok(JSON.stringify(r.j.sayilar) === JSON.stringify({ urun: { gida: 2, koz: 1, tem: 1 }, dogrulanan: { gida: 1, koz: 1, tem: 0 } }), "ilk açılışta eski katkılar sayılır (yeni kimliksiz ikili doğrulamaz)", r.j.sayilar);
  ekle.run(K3, "gida", metinA, T, A);   // doğrudan tabloya: sayaç artmaz, sayım bir daha baştan yapılmaz
  r = await cagir(w, env, "/topluluk");
  ok(r.j.sayilar.urun.gida === 2, "baştan sayım yalnızca bir kez", r.j.sayilar);
  const s = toplulukSay([{ kod: "1", tur: "gida", metin: metinA, t: T, kim: A }, { kod: "1", tur: "gida", metin: metinA, t: T + 1000, kim: B }, { kod: "2", tur: "tem", metin: "x y z", t: T, kim: A }]);
  ok(JSON.stringify(s) === JSON.stringify({ urun: { gida: 1, tem: 1 }, dogrulanan: {} }), "toplulukSay: 10 dakikadan kısa arayla gelen iki katkı doğrulamaz", s); }

// A-02: barkoda bağlı besin tablosu (POST /besin, GET /urun yanıtında besin)
{ const w = (await import("./src/index.js?besin")).default;
  const env = { ALLOWED_ORIGIN: ORIGIN, URUNLER: d1() };
  const tablo = { b: { kcal: 520, yag: 28, doymus: 12, karb: 58, seker: 45, lif: 3, protein: 6, tuz: 0.2 }, lt: { tuz: true, yag: "x" }, birim: "g" };
  const post = (body) => cagir(w, env, "/besin", { method: "POST", body });
  ok((await post({ kod: "8690504025208", besin: tablo })).s === 400, "besin: geçersiz barkod 400");
  ok((await post({ kod: K1, besin: { b: { yag: 5 } } })).s === 400, "besin: tek değer yetmez 400");
  ok((await post({ kod: K1, besin: { b: { yag: 150, tuz: 1 } } })).s === 400, "besin: 100 g üstü 400");
  ok((await post({ kod: K1, besin: { b: { yag: "5", tuz: 1 } } })).s === 400, "besin: sayı olmayan değer 400");
  ok((await post({ kod: K1, besin: tablo, kim: "kisa" })).s === 400, "besin: geçersiz kimlik 400");
  ok((await cagir(w, env, "/besin")).s === 405, "besin: GET 405");
  ok((await cagir(w, env, "/besin", { method: "POST", body: { kod: K1, besin: tablo }, origin: "https://evil.example" })).s === 403, "besin: yabancı köken 403");
  ok((await cagir(w, { ALLOWED_ORIGIN: ORIGIN }, "/besin", { method: "POST", body: { kod: K1, besin: tablo } })).s === 204, "besin: D1 yok 204");
  ok((await post({ kod: K1, besin: tablo, kim: A })).s === 201, "besin: kaydedildi 201");
  // İçerik katkısı olmayan barkodda da tablo döner; içerik yine bulunamadı sayılır
  let r = await cagir(w, env, "/urun/" + K1);
  ok(r.j.bulundu === false && r.j.besin && r.j.besin.b.yag === 28 && r.j.besin.lt.tuz === true && r.j.besin.lt.yag === undefined && r.j.besin.birim === "g" && r.j.besinT === SIMDI, "urun: içeriksiz barkodda besin tablosu", r.j);
  ok(!/aaaa/.test(r.txt), "urun: besin yanıtında kimlik yok");
  // Aynı kimlik düzeltince tek satır kalır; başka kimlik ayrı satır, en yenisi gösterilir
  SIMDI += 1000; await post({ kod: K1, besin: { ...tablo, b: { ...tablo.b, yag: 27 } }, kim: A });
  ok(env.URUNLER.db.prepare("SELECT COUNT(*) AS n FROM besin WHERE kod = ?").get(K1).n === 1, "besin: aynı kimlik tek satır");
  SIMDI += 1000; await post({ kod: K1, besin: { ...tablo, b: { ...tablo.b, yag: 26 } }, kim: B });
  r = await cagir(w, env, "/urun/" + K1);
  ok(r.j.besin.b.yag === 26 && env.URUNLER.db.prepare("SELECT COUNT(*) AS n FROM besin").get().n === 2, "besin: en yeni tablo gösterilir", r.j);
  // İçerik katkısıyla birlikte: içerik sayılarını değiştirmez
  await cagir(w, env, "/urun", { method: "POST", body: { kod: K1, tur: "gida", dil: "tr", metin: metinA, kim: A } });
  r = await cagir(w, env, "/urun/" + K1);
  ok(r.j.bulundu && r.j.sayi === 1 && r.j.besin.b.yag === 26, "urun: içerik ve besin birlikte; besin katkısı sayıyı artırmaz", r.j);
  const sut = env.URUNLER.db.prepare("PRAGMA table_info(besin)").all().map((c) => c.name).join();
  ok(sut === "id,kod,besin,t,kim,iz", "besin tablosunda yalnızca barkod, tablo, zaman, katkıcı, iz", sut); }

// Katkı izi (KATKI_TUZ): aynı ağdan her seferinde yeni rastgele kimlikle gelen katkılar birbirini doğrulamaz ve barkodu dolduramaz
{ const w = (await import("./src/index.js?iz")).default;
  const env = { ALLOWED_ORIGIN: ORIGIN, URUNLER: d1(), KATKI_TUZ: "t".repeat(40) };
  const rasgele = (i) => String(i).padStart(32, "f");
  const post = (kod, kim, metin = metinA) => cagir(w, env, "/urun", { method: "POST", body: { kod, tur: "gida", dil: "tr", metin, kim } });
  ip = "203.0.113.7";
  ok((await post(K1, rasgele(1))).s === 201, "iz: ilk katkı");
  SIMDI += KATKI_ARALIK_MS; ok((await post(K1, rasgele(2))).s === 201, "iz: aynı ağdan yeni kimlikle ikinci katkı kabul edilir");
  let r = await cagir(w, env, "/urun/" + K1);
  ok(r.j.bulundu && !r.j.dogrulandi && r.j.sayi === 2, "iz: aynı ağdan iki katkı doğrulamaz", r.j);
  SIMDI += KATKI_ARALIK_MS; ok((await post(K1, rasgele(3))).s === 429, "iz: aynı ağdan üçüncü katkı 429 (barkod doldurulamaz)");
  ok((await post(K1, null)).s === 429, "iz: kimliksiz de sayılır");
  ok((await post(K1, rasgele(1), metinA + " ")).s === 201, "iz: kendi katkısını yenilemek sınıra takılmaz");
  ip = "198.51.100.9"; SIMDI += KATKI_ARALIK_MS; ok((await post(K1, rasgele(4))).s === 201, "iz: başka ağdan katkı");
  r = await cagir(w, env, "/urun/" + K1);
  ok(r.j.dogrulandi && !/iz|203\.0|198\.51/.test(r.txt), "iz: başka ağdan benzer katkı doğrular; yanıtta iz ve IP yok", r.j);
  ip = "2a02:4780:a:c0de::1"; ok((await post(K2, rasgele(5))).s === 201, "iz: IPv6 katkı");
  ip = "2a02:4780:a:c0de:ffff::2"; SIMDI += KATKI_ARALIK_MS; await post(K2, rasgele(6));
  ok(!(await cagir(w, env, "/urun/" + K2)).j.dogrulandi, "iz: IPv6'da aynı /64 ağı aynı kişi");
  const izler = env.URUNLER.db.prepare("SELECT kod, iz FROM katki").all();
  ok(izler.every((x) => /^[0-9a-f]{16}$/.test(x.iz)) && !JSON.stringify(env.URUNLER.db.prepare("SELECT * FROM katki").all()).includes("203.0.113.7"), "iz: 16 onaltılık hane, IP saklanmaz");
  ip = "203.0.113.7"; await post(K3, rasgele(7));
  const iz1 = izler.find((x) => x.kod === K1).iz, iz3 = env.URUNLER.db.prepare("SELECT iz FROM katki WHERE kod = ?").get(K3).iz;
  ok(iz1 !== iz3, "iz: aynı ağın iki barkoddaki izi farklı (barkodlar arası bağlanamaz)");
  // Besin tablosu: aynı ağdan en çok iki tablo
  for (let i = 0; i < 2; i++) { SIMDI += 1000; ok((await cagir(w, env, "/besin", { method: "POST", body: { kod: KK, besin: { b: { yag: 1, tuz: 1, seker: 2 } }, kim: rasgele(10 + i) } })).s === 201, "iz: besin " + (i + 1)); }
  ok((await cagir(w, env, "/besin", { method: "POST", body: { kod: KK, besin: { b: { yag: 1, tuz: 1, seker: 2 } }, kim: rasgele(12) } })).s === 429, "iz: aynı ağdan üçüncü besin tablosu 429");
  ok((await cagir(w, env, "/besin", { method: "POST", body: { kod: KK, besin: { b: { yag: 1, tuz: 1, seker: 3 } }, kim: rasgele(10) } })).s === 201, "iz: kendi tablosunu yenilemek sınıra takılmaz");
  // Kısa anahtar: iz yazılmaz
  const e2 = { ALLOWED_ORIGIN: ORIGIN, URUNLER: d1(), KATKI_TUZ: "kisa" };
  await cagir((await import("./src/index.js?iz-kisa")).default, e2, "/urun", { method: "POST", body: { kod: K1, tur: "gida", dil: "tr", metin: metinA } });   // yeni D1: tablolar yeni modülde kurulur
  ok(e2.URUNLER.db.prepare("SELECT iz FROM katki").get().iz === null, "iz: kısa anahtarla iz yazılmaz"); }

// Sayaç kurulumu: parçalarla okunur; yarıda kalırsa "kurulum" yazılmaz, sonraki istek yeniden sayar
{ const w = (await import("./src/index.js?kurulum")).default;
  const env = { ALLOWED_ORIGIN: ORIGIN, URUNLER: d1() };
  const db = env.URUNLER.db;
  const r0 = await cagir(w, env, "/topluluk");   // tablolar kurulsun
  ok(r0.s === 200, "kurulum: boş veritabanı", r0);
  const ekle = db.prepare("INSERT INTO katki (kod, tur, dil, metin, t, kim) VALUES (?, 'gida', 'tr', ?, ?, ?)");
  for (let i = 0; i < 450; i++) ekle.run(String(10000000 + i), metinA, SIMDI, A);   // 450 barkod: üç parça
  ekle.run("10000000", metinA, SIMDI + KATKI_ARALIK_MS, B);
  db.exec("DELETE FROM toplam");
  const asil = env.URUNLER.batch; let bozuk = true;
  env.URUNLER.batch = async (l) => { if (bozuk) { bozuk = false; throw new Error("CPU sınırı (taklit)"); } return asil(l); };
  let r = await cagir(w, env, "/topluluk");
  ok(r.s === 500 && !db.prepare("SELECT 1 FROM toplam WHERE ad = 'kurulum'").get() && !db.prepare("SELECT COUNT(*) AS n FROM toplam").get().n, "kurulum: yarıda kalan sayım hiçbir şey yazmaz", r.s);
  r = await cagir(w, env, "/topluluk");
  ok(r.s === 200 && r.j.sayilar.urun.gida === 450 && r.j.sayilar.dogrulanan.gida === 1 && db.prepare("SELECT 1 FROM toplam WHERE ad = 'kurulum'").get(), "kurulum: sonraki istek bütün parçaları sayar", r.j.sayilar); }

console.log(fail ? fail + " hata" : "tüm testler geçti");
process.exit(fail ? 1 : 0);
