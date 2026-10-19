// Katkı denetimi (O-21) ve topluluk besin tablosunun doğrulanması (O-26) Worker testi: node worker/test_yonetim.mjs
// D1 yerine gerçek SQLite (node:sqlite, Node 22.13+), test_topluluk.mjs ile aynı düzen.
import { DatabaseSync } from "node:sqlite";
console.error = () => {};   // Worker'ın hata kaydı (kayit) satırları test çıktısını kirletmesin; içeriği worker/test.mjs denetler
import { KATKI_ARALIK_MS, besinUyumlu, besinSec, besinGrupla } from "./src/barkod.js";
import { YONETIM_JS, yonetimOzet } from "./src/yonetim.js";
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
  // D1 batch: tek işlem, araya başka yazım girmez (eşzamanlı istekler sırayla); biri hata verirse hepsi geri alınır; her deyimin sonucu döner
  return { db, prepare: st, batch: async (l) => { db.exec("BEGIN"); try { const r = []; for (const s of l) r.push(s.batchRun()); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
}
let SIMDI = 1_800_000_000_000;
Date.now = () => SIMDI;
const ANAHTAR = "k".repeat(40);
const istek = (yol, o = {}) => new Request("https://x.workers.dev" + yol, { method: o.method || "GET",
  headers: { "Content-Type": "application/json", "Origin": o.origin ?? ORIGIN, "CF-Connecting-IP": "1.2.3.4", ...(o.anahtar === null ? {} : { "Authorization": "Bearer " + (o.anahtar || ANAHTAR) }) },
  body: o.body == null ? undefined : JSON.stringify(o.body) });
async function cagir(w, env, yol, o) { const r = await w.fetch(istek(yol, o), env); const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {} return { s: r.status, j, txt, h: r.headers }; }
const A = "a".repeat(32), B = "b".repeat(32), C = "c".repeat(32);
const K1 = "8690504025207", K2 = "4006381333931";
const metinA = "Kakao kitlesi, şeker, kakao yağı, emülgatör (soya lesitini), aroma verici, tuz";
const metinX = "Su, sodyum lauril eter sülfat, kokamidopropil betain, parfüm, metilizotiyazolinon";
const tablo = { b: { kcal: 505, yag: 25.1, doymus: 16, karb: 68.8, seker: 30.5, lif: null, protein: 3.2, tuz: 0.1 }, lt: {}, birim: "g" };
const yanlis = { b: { kcal: 120, yag: 2, doymus: 1, karb: 20, seker: 3, lif: null, protein: 1, tuz: 1.8 }, lt: {}, birim: "g" };

// 1) Besin tablolarının uyumu ve seçimi (O-26)
{
  const v = (b, birim = "g") => ({ b: { kcal: null, yag: null, doymus: null, karb: null, seker: null, lif: null, protein: null, tuz: null, ...b }, lt: {}, birim });
  ok(besinUyumlu(tablo, tablo), "aynı tablo uyumlu");
  ok(besinUyumlu(v({ kcal: 505, yag: 25.1, seker: 30.5, tuz: 0.1 }), v({ kcal: 500, yag: 25, seker: 31, tuz: 0.12, protein: 3 })), "küçük yuvarlama farkı uyumlu");
  ok(!besinUyumlu(v({ kcal: 505, yag: 25.1, seker: 30.5, tuz: 0.1 }), v({ kcal: 505, yag: 25.1, seker: 30.5, tuz: 0.3 })), "tuzda 0,1 → 0,3 uyumsuz (eşik 0,3 g)");
  ok(!besinUyumlu(v({ kcal: 505, yag: 25.1, seker: 30.5 }), v({ kcal: 505, yag: 25.1, seker: 30.5 }, "ml")), "birim farklıysa uyumsuz");
  ok(!besinUyumlu(v({ kcal: 505, yag: 25.1 }), v({ kcal: 505, yag: 25.1 })), "ortak satır 3'ten azsa uyum sayılmaz");
  ok(besinUyumlu(v({ kcal: 505, yag: 25.1, seker: 30.5, tuz: 0.1 }), v({ kcal: 505, yag: 25.1, seker: 30.5 })), "bir tabloda okunmamış satır uyumu bozmaz");
  const s = (b, t, kim) => ({ besin: JSON.stringify(b), t, kim });
  // En yeni tablo yanlış olsa da iki farklı kişinin uyuşan tablosu seçilir
  let r = besinSec([s(yanlis, 5 * KATKI_ARALIK_MS, C), s(tablo, 2 * KATKI_ARALIK_MS, B), s(tablo, 0, A)]);
  ok(r && r.besinDogrulandi && r.besin.b.tuz === 0.1 && r.besinT === 2 * KATKI_ARALIK_MS, "doğrulanmış tablo yeniden önce seçilir", r);
  r = besinSec([s(yanlis, 5 * KATKI_ARALIK_MS, C), s(tablo, 0, A)]);
  ok(r && !r.besinDogrulandi && r.besin.b.tuz === 1.8, "doğrulanmış yoksa en yeni", r);
  r = besinSec([s(tablo, 1000, A), s(tablo, 0, B)]);
  ok(r && !r.besinDogrulandi, "10 dakikadan kısa arayla gelen iki tablo doğrulamaz");
  ok(besinGrupla([s(tablo, 5e6, A), s(tablo, 0, A)])[0].dogrulandi === false, "aynı kişinin iki tablosu doğrulamaz");
  ok(besinSec([{ besin: "bozuk", t: 1 }, s({ b: {} }, 2)]) === null, "geçersiz tablolar atlanır");
}

const w = (await import("./src/index.js?yonetim")).default;
// 2) Yetki: anahtar yoksa ya da kısaysa kapalı; yanlış anahtar 401; CORS başlığı yok
{
  const env = { ALLOWED_ORIGIN: ORIGIN, URUNLER: d1() };
  let r = await cagir(w, env, "/yonetim/api/liste");
  ok(r.s === 404 && r.j.kapali, "YONETIM_ANAHTARI yoksa yönetim kapalı (404)", r.j);
  r = await cagir(w, { ...env, YONETIM_ANAHTARI: "kisa" }, "/yonetim/api/liste", { anahtar: "kisa" });
  ok(r.s === 404 && r.j.kapali, "32 karakterden kısa anahtar kabul edilmez", r.j);
  env.YONETIM_ANAHTARI = ANAHTAR;
  ok((await cagir(w, env, "/yonetim/api/liste", { anahtar: null })).s === 401, "anahtarsız istek 401");
  ok((await cagir(w, env, "/yonetim/api/liste", { anahtar: "x".repeat(40) })).s === 401, "yanlış anahtar 401");
  ok((await cagir(w, env, "/yonetim/api/liste", { anahtar: ANAHTAR + "x" })).s === 401, "uzatılmış anahtar 401");
  r = await cagir(w, env, "/yonetim/api/liste");
  ok(r.s === 200 && Array.isArray(r.j.urunler), "doğru anahtar 200", r.j);
  ok(!r.h.get("Access-Control-Allow-Origin") && r.h.get("Cache-Control") === "no-store", "yönetim yanıtında CORS yok, önbellek yok");
  r = await cagir(w, env, "/yonetim", { anahtar: null });
  ok(r.s === 200 && /Katkı Denetimi/.test(r.txt) && /script-src 'self'/.test(r.h.get("Content-Security-Policy") || "") && r.h.get("X-Frame-Options") === "DENY", "sayfa anahtarsız açılır (veri yok), sıkı CSP", r.h.get("Content-Security-Policy"));
  ok(!/<script>/.test(r.txt) && (await cagir(w, env, "/yonetim/sayfa.js", { anahtar: null })).h.get("Content-Type").startsWith("text/javascript"), "satır içi betik yok; betik ayrı dosya");
  let derlendi = true; try { new Function(YONETIM_JS); } catch (e) { derlendi = false; console.log(e); }
  ok(derlendi, "sayfa betiği sözdizimi");
  ok(!/innerHTML/.test(YONETIM_JS), "kullanıcı metni HTML olarak yazılmaz (yalnızca textContent)");
  ok((await cagir(w, { ...env, BARKOD_LIMIT: { limit: async () => ({ success: false }) } }, "/yonetim/api/liste")).s === 429, "istek sınırı");
  ok((await cagir(w, { YONETIM_ANAHTARI: ANAHTAR }, "/yonetim/api/liste")).s === 503, "D1 yoksa 503");
}

// 3) Veri: iki kişinin uyuşan içeriği ve tablosu, üçüncü kişinin farklı içeriği ve tablosu (çelişki)
{
  const w = (await import("./src/index.js?yonetim-veri")).default;   // tablolar her yeni D1'de kurulsun (D1_HAZIR modül düzeyinde)
  const env = { ALLOWED_ORIGIN: ORIGIN, URUNLER: d1(), YONETIM_ANAHTARI: ANAHTAR };
  const post = (yol, body) => cagir(w, env, yol, { method: "POST", body, anahtar: null });
  await post("/urun", { kod: K1, tur: "gida", dil: "tr", metin: metinA, kim: A });
  await post("/besin", { kod: K1, besin: tablo, kim: A });
  SIMDI += KATKI_ARALIK_MS;
  await post("/urun", { kod: K1, tur: "gida", dil: "tr", metin: metinA + ".", kim: B });
  await post("/besin", { kod: K1, besin: tablo, kim: B });
  SIMDI += KATKI_ARALIK_MS;
  await post("/urun", { kod: K1, tur: "tem", dil: "tr", metin: metinX, kim: C });
  await post("/besin", { kod: K1, besin: yanlis, kim: C });
  SIMDI += 1000;
  await post("/urun", { kod: K2, tur: "koz", dil: "tr", metin: metinX, kim: C });
  await post("/aranan", { kod: "5449000000996", tur: "gida" });
  // Uygulamanın gördüğü: doğrulanmış içerik ve doğrulanmış tablo (C'ninkiler daha yeni olsa da)
  let r = await cagir(w, env, "/urun/" + K1, { anahtar: null });
  ok(r.j.dogrulandi && r.j.tur === "gida" && r.j.besinDogrulandi && r.j.besin.b.tuz === 0.1, "GET /urun: doğrulanmış içerik ve doğrulanmış besin tablosu", r.j);
  ok(!/aaaa|bbbb|cccc/.test(r.txt), "GET /urun yanıtında katkıcı kimliği yok");
  // Liste: son katkılar
  r = await cagir(w, env, "/yonetim/api/liste?gor=son");
  ok(r.j.urunler.map((x) => x.kod).join() === [K2, K1].join(), "son katkılar yeniden eskiye", r.j);
  const o1 = r.j.urunler.find((x) => x.kod === K1);
  ok(o1 && o1.katki === 3 && o1.katkiGrup === 2 && o1.dogrulandi && o1.besin === 3 && o1.besinGrup === 2 && o1.besinDogrulandi && o1.celiski && o1.tur === "gida", "özet: sayılar, gruplar, çelişki", o1);
  ok(!r.j.urunler.find((x) => x.kod === K2).celiski, "tek katkılı barkod çelişki değil");
  r = await cagir(w, env, "/yonetim/api/liste?gor=celiski");
  ok(r.j.urunler.map((x) => x.kod).join() === K1, "çelişenler listesi", r.j);
  r = await cagir(w, env, "/yonetim/api/liste?gor=aranan");
  ok(r.j.aranan.length === 1 && r.j.aranan[0].kod === "5449000000996", "aranan listesi", r.j);
  ok((await cagir(w, env, "/yonetim/api/liste?gor=x")).s === 400, "geçersiz liste 400");
  // Ayrıntı: grup 0 uygulamada gösterilen
  r = await cagir(w, env, "/yonetim/api/urun/" + K1);
  ok(r.j.katki.length === 3 && r.j.katki[0].grup === 0 && r.j.katki[0].dogrulandi && r.j.katki[2].grup === 1 && r.j.katki[2].kim === C && r.j.katki.every((s) => Number.isInteger(s.id)), "ayrıntı: içerik grupları, kimlik ve satır numarası", r.j.katki);
  ok(r.j.besin.length === 3 && r.j.besin[2].grup === 1 && r.j.besin[2].besin.b.tuz === 1.8, "ayrıntı: besin tablosu grupları", r.j.besin);
  ok((await cagir(w, env, "/yonetim/api/urun/abc")).s === 400, "geçersiz barkod 400");
  // Katkıcı görünümü
  r = await cagir(w, env, "/yonetim/api/kim/" + C);
  ok(r.j.katki === 2 && r.j.besin === 1 && r.j.urunler.map((x) => x.kod).sort().join() === [K1, K2].sort().join(), "katkıcının barkodları", r.j);
  ok((await cagir(w, env, "/yonetim/api/kim/xyz")).s === 400, "geçersiz kimlik 400");
  // Silme: tek satır, topluluk sayaçları yeniden sayılır
  await cagir(w, env, "/topluluk", { anahtar: null });
  ok(env.URUNLER.db.prepare("SELECT COUNT(*) AS n FROM toplam").get().n > 0, "sayaçlar var");
  const sil1 = (await cagir(w, env, "/yonetim/api/urun/" + K1)).j.besin[2].id;
  r = await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: { tablo: "besin", id: sil1 } });
  ok(r.s === 200 && r.j.silindi === 1 && env.URUNLER.db.prepare("SELECT COUNT(*) AS n FROM besin").get().n === 2, "tek tablo silinir", r.j);
  ok(env.URUNLER.db.prepare("SELECT COUNT(*) AS n FROM toplam").get().n > 0, "besin tablosu silmek sayaçlara dokunmaz");
  const db = env.URUNLER.db, sayac = () => Object.fromEntries(db.prepare("SELECT ad, n FROM toplam WHERE ad != 'kurulum'").all().map((x) => [x.ad, x.n]));
  const ilkSayac = sayac();
  // Bir kişinin bütün katkıları silinir; çelişki kalkar; sayaçlara yalnızca fark uygulanır (kurulum ve diğer sayaçlar yerinde)
  r = await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: { kim: C } });
  ok(r.j.silindi === 2 && Number.isInteger(r.j.islem) && !db.prepare("SELECT 1 FROM katki WHERE kim = ?").get(C), "katkıcının bütün katkıları silinir", r.j);
  const islemC = r.j.islem;
  ok(db.prepare("SELECT 1 FROM toplam WHERE ad = 'kurulum'").get() && sayac()["urun:gida"] === 1 && !sayac()["urun:koz"] && sayac()["dogrulanan:gida"] === 1, "silme sayaçları silmez; K2 (yalnızca C'nin) ürün sayısından düşer", sayac());
  ok(db.prepare("SELECT COUNT(*) AS n FROM silinen WHERE islem = ?").get(islemC).n === 2, "silinen satırlar saklanır");
  r = await cagir(w, env, "/topluluk", { anahtar: null, origin: ORIGIN });
  ok(r.j.sayilar.urun.gida === 1 && !r.j.sayilar.urun.koz && r.j.sayilar.dogrulanan.gida === 1, "topluluk sayıları doğru", r.j.sayilar);
  r = await cagir(w, env, "/yonetim/api/liste?gor=celiski");
  ok(!r.j.urunler.length, "çelişki kalmadı");
  // Doğrulayan katkıyı silmek doğrulanan sayısını düşürür
  const bId = db.prepare("SELECT id FROM katki WHERE kim = ?").get(B).id;
  r = await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: { tablo: "katki", id: bId } });
  ok(r.j.silindi === 1 && sayac()["urun:gida"] === 1 && sayac()["dogrulanan:gida"] === 0, "doğrulayan katkı silinince doğrulanan 1 → 0", sayac());
  const islemB = r.j.islem;
  r = await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: { tablo: "aranan", kod: "5449000000996" } });
  ok(r.j.silindi === 1 && !(await cagir(w, env, "/yonetim/api/liste?gor=aranan")).j.aranan.length, "aranan listesinden çıkarılır");
  const islemA = r.j.islem;
  r = await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: { tablo: "katki", id: 99999 } });
  ok(r.s === 200 && r.j.silindi === 0 && r.j.islem === null, "olmayan satır: işlem yazılmaz", r.j);
  // İşlem Kaydı ve geri alma
  r = await cagir(w, env, "/yonetim/api/islem");
  ok(r.s === 200 && r.j.islemler.map((x) => x.id).join() === [islemA, islemB, islemC, 1].join() && r.j.islemler.slice(0, 3).every((x) => x.geriAlinabilir) && r.j.islemler[2].ayrinti.kim === C && r.j.islemler[2].ayrinti.n === 2, "işlem kaydı yeniden eskiye", r.j.islemler);
  r = await cagir(w, env, "/yonetim/api/geri", { method: "POST", body: { islem: islemB } });
  ok(r.s === 200 && r.j.geri === 1 && db.prepare("SELECT id FROM katki WHERE kim = ?").get(B).id === bId && sayac()["dogrulanan:gida"] === 1, "geri alma: satır aynı numarayla döner, doğrulanan yeniden 1", [r.j, sayac()]);
  ok((await cagir(w, env, "/yonetim/api/geri", { method: "POST", body: { islem: islemB } })).s === 409, "aynı işlem iki kez geri alınmaz");
  r = await cagir(w, env, "/yonetim/api/geri", { method: "POST", body: { islem: islemC } });
  ok(r.j.geri === 2 && db.prepare("SELECT COUNT(*) AS n FROM katki WHERE kim = ?").get(C).n === 2, "katkıcının iki içerik katkısı geri döner (besin tablosu önceki ayrı silmede)", r.j);
  ok(JSON.stringify(sayac()) === JSON.stringify(ilkSayac), "bütün geri almalardan sonra sayaçlar silmeden önceki gibi", [sayac(), ilkSayac]);
  ok((await cagir(w, env, "/yonetim/api/liste?gor=celiski")).j.urunler.length === 1, "çelişki geri geldi");
  await cagir(w, env, "/yonetim/api/geri", { method: "POST", body: { islem: islemA } });
  ok((await cagir(w, env, "/yonetim/api/liste?gor=aranan")).j.aranan[0].n === 1, "aranan kaydı geri döner");
  r = await cagir(w, env, "/yonetim/api/islem");
  ok(r.j.islemler.slice(0, 3).every((x) => x.geri && !x.geriAlinabilir), "geri alınan işlemler işaretli");
  for (const b of [{}, { islem: "1" }, { islem: 0 }]) ok((await cagir(w, env, "/yonetim/api/geri", { method: "POST", body: b })).s === 400, "geçersiz geri alma 400: " + JSON.stringify(b));
  ok((await cagir(w, env, "/yonetim/api/geri", { method: "POST", body: { islem: 4242 } })).s === 404, "olmayan işlem 404");
  // 90 gün sonra silinen satırlar kalıcı silinir; geri alınamaz
  r = await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: { tablo: "katki", id: bId } });
  const eski = r.j.islem;
  SIMDI += 91 * 864e5;
  await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: { tablo: "aranan", kod: "5449000000996" } });
  ok((await cagir(w, env, "/yonetim/api/geri", { method: "POST", body: { islem: eski } })).s === 410, "90 günden eski silme geri alınamaz (410)");
  ok(!(await cagir(w, env, "/yonetim/api/islem")).j.islemler.find((x) => x.id === eski).geriAlinabilir, "süresi dolan işlem geri alınamaz görünür");
  ok((await cagir(w, env, "/yonetim/api/geri", { method: "POST", body: { islem: 1 }, anahtar: "y".repeat(40) })).s === 401, "anahtarsız geri alma 401");
  for (const b of [{ tablo: "katki" }, { tablo: "katki", id: "1 OR 1=1" }, { tablo: "x", id: 1 }, { kim: "1" }, { tablo: "aranan", kod: "123" }, {}])
    ok((await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: b })).s === 400, "geçersiz silme 400: " + JSON.stringify(b));
  ok((await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: { tablo: "katki", id: 1 }, anahtar: "y".repeat(40) })).s === 401, "anahtarsız silme 401");
  ok((await cagir(w, env, "/yonetim/api/sil")).s === 404, "GET /sil yok");
}
// 3b) Büyük katkıcı: sorgu sayısı satır sayısından bağımsız; aynı anda iki Geri Al tek kez yazar; okuma ile silme arasında gelen satır silinmez
{
  const w = (await import("./src/index.js?yonetim-buyuk")).default;
  const env = { ALLOWED_ORIGIN: ORIGIN, URUNLER: d1(), YONETIM_ANAHTARI: ANAHTAR };
  const db = env.URUNLER.db;
  await cagir(w, env, "/topluluk", { anahtar: null });   // tablolar ve kurulum
  const ekle = db.prepare("INSERT INTO katki (kod, tur, dil, metin, t, kim) VALUES (?, 'gida', 'tr', ?, ?, ?)");
  for (let i = 0; i < 120; i++) { ekle.run(String(20000000 + i), metinA, SIMDI, A); ekle.run(String(20000000 + i), metinA, SIMDI + KATKI_ARALIK_MS, B); }
  db.prepare("INSERT OR REPLACE INTO toplam (ad, n) VALUES ('urun:gida', 120), ('dogrulanan:gida', 120)").run();
  const sayac = () => Object.fromEntries(db.prepare("SELECT ad, n FROM toplam WHERE ad != 'kurulum'").all().map((x) => [x.ad, x.n]));
  let deyim = 0; const asilP = env.URUNLER.prepare, asilB = env.URUNLER.batch;
  env.URUNLER.prepare = (sql) => { deyim++; return asilP(sql); };
  let r = await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: { kim: B } });
  ok(r.j.silindi === 120 && deyim <= 20, "120 satırlık katkıcı silmesi az sayıda deyimle (D1 istek başına 50 sınırı)", deyim);
  ok(sayac()["urun:gida"] === 120 && sayac()["dogrulanan:gida"] === 0, "120 barkodun doğrulaması düşer", sayac());
  deyim = 0; let bekleyen = 0, birak;
  const ikisi = new Promise((x) => { birak = x; });
  env.URUNLER.batch = async (l) => { if (++bekleyen === 2) birak(); await ikisi; return asilB(l); };   // iki istek de ilk denetimi geçip toplu yazıma ulaşsın
  const [g1, g2] = await Promise.all([cagir(w, env, "/yonetim/api/geri", { method: "POST", body: { islem: r.j.islem } }), cagir(w, env, "/yonetim/api/geri", { method: "POST", body: { islem: r.j.islem } })]);
  env.URUNLER.batch = asilB;
  ok(bekleyen === 2 && [g1.s, g2.s].sort().join() === "200,409" && deyim <= 30, "aynı anda iki Geri Al (ikisi de toplu yazıma ulaşır): biri yazar, öteki 409; az deyim", [g1.s, g2.s, deyim]);
  ok(db.prepare("SELECT COUNT(*) AS n FROM katki WHERE kim = ?").get(B).n === 120 && sayac()["dogrulanan:gida"] === 120, "geri alma bir kez uygulanır (satır ve sayaç)", sayac());
  // Okuma ile toplu yazım arasında aynı kimlikten yeni katkı gelir: silinmez (silme okunan numaralarla)
  env.URUNLER.batch = async (l) => { env.URUNLER.batch = asilB; ekle.run("12345670", "Su, sodyum lauril eter sülfat, parfüm", SIMDI, B); return asilB(l); };
  r = await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: { kim: B } });
  ok(r.j.silindi === 120 && db.prepare("SELECT COUNT(*) AS n FROM katki WHERE kim = ?").get(B).n === 1, "okumadan sonra gelen katkı silinmez", r.j);
  // Toplu yazım yarıda kalırsa hiçbir şey değişmez
  env.URUNLER.batch = async (l) => { env.URUNLER.batch = asilB; return asilB([...l.slice(0, -1), asilP("INSERT INTO yok_boyle_tablo VALUES (1)")]); };
  const onceSay = db.prepare("SELECT COUNT(*) AS n FROM katki").get().n, onceIs = db.prepare("SELECT COUNT(*) AS n FROM islem").get().n;
  r = await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: { kim: A } });
  ok(r.s === 500 && db.prepare("SELECT COUNT(*) AS n FROM katki").get().n === onceSay && db.prepare("SELECT COUNT(*) AS n FROM islem").get().n === onceIs, "yarıda kalan silme hiçbir şey yazmaz", r.s);
}
// 4) Özet saf işlev: yalnızca besin tablosu olan barkod gıda sayılır
ok(yonetimOzet(K1, [], [{ besin: JSON.stringify(tablo), t: 1, kim: A }]).tur === "gida", "içeriksiz, tablolu barkod gıda");
console.log(fail ? fail + " hata" : "tüm testler geçti");
process.exit(fail ? 1 : 0);
