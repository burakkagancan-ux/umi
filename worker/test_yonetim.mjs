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
    async run() { const r = db.prepare(sql).run(...this.args); return { meta: { changes: Number(r.changes) } }; } });
  return { db, prepare: st, batch: async (l) => { for (const s of l) await s.run(); return []; } };
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
  // Bir kişinin bütün katkıları silinir; çelişki kalkar; sayaçlar baştan sayılır
  r = await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: { kim: C } });
  ok(r.j.silindi === 2 && !env.URUNLER.db.prepare("SELECT 1 FROM katki WHERE kim = ?").get(C), "katkıcının bütün katkıları silinir", r.j);
  ok(env.URUNLER.db.prepare("SELECT COUNT(*) AS n FROM toplam").get().n === 0, "içerik silinince sayaçlar sıfırlanır");
  r = await cagir(w, env, "/topluluk", { anahtar: null, origin: ORIGIN });
  ok(r.j.sayilar.urun.gida === 1 && !r.j.sayilar.urun.koz && r.j.sayilar.dogrulanan.gida === 1, "sayaçlar baştan sayıldı", r.j.sayilar);
  r = await cagir(w, env, "/yonetim/api/liste?gor=celiski");
  ok(!r.j.urunler.length, "çelişki kalmadı");
  r = await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: { tablo: "aranan", kod: "5449000000996" } });
  ok(r.j.silindi === 1 && !(await cagir(w, env, "/yonetim/api/liste?gor=aranan")).j.aranan.length, "aranan listesinden çıkarılır");
  for (const b of [{ tablo: "katki" }, { tablo: "katki", id: "1 OR 1=1" }, { tablo: "x", id: 1 }, { kim: "1" }, { tablo: "aranan", kod: "123" }, {}])
    ok((await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: b })).s === 400, "geçersiz silme 400: " + JSON.stringify(b));
  ok((await cagir(w, env, "/yonetim/api/sil", { method: "POST", body: { tablo: "katki", id: 1 }, anahtar: "y".repeat(40) })).s === 401, "anahtarsız silme 401");
  ok((await cagir(w, env, "/yonetim/api/sil")).s === 404, "GET /sil yok");
}
// 4) Özet saf işlev: yalnızca besin tablosu olan barkod gıda sayılır
ok(yonetimOzet(K1, [], [{ besin: JSON.stringify(tablo), t: 1, kim: A }]).tur === "gida", "içeriksiz, tablolu barkod gıda");
console.log(fail ? fail + " hata" : "tüm testler geçti");
process.exit(fail ? 1 : 0);
