// Ölçüm (A-03) Worker testi: POST /olcum gerçek SQLite'a yazar, yönetim görünümü okur. node worker/test_olcum.mjs
// D1 yerine gerçek SQLite (node:sqlite, Node 22.13+), test_yonetim.mjs ile aynı düzen.
import { DatabaseSync } from "node:sqlite";
const KAYIT = []; console.error = (...a) => { KAYIT.push(a.join(" ")); };
import w from "./src/index.js";
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
const SIMDI = Date.parse("2026-10-16T09:00:00Z");
Date.now = () => SIMDI;
const ANAHTAR = "k".repeat(40);
const lim = (n) => { let c = 0; return { limit: async () => ({ success: ++c <= n }) }; };
// Tek veritabanı: Worker tabloları süreç başına bir kez kurar (D1_HAZIR), her ortam aynı SQLite'ı görür
const DB = d1();
const env = () => ({ ALLOWED_ORIGIN: ORIGIN, URUNLER: DB, YONETIM_ANAHTARI: ANAHTAR });
const olc = (e, q, o = {}) => w.fetch(new Request("https://x.workers.dev/olcum" + (q ? "?" + q : ""), { method: o.method || "POST", headers: { "Origin": o.origin ?? ORIGIN, "CF-Connecting-IP": "1.2.3.4" } }), e);
const tablo = (e) => e.URUNLER.db.prepare("SELECT gun, ad, n FROM olcum ORDER BY gun, ad").all().map((r) => r.gun + " " + r.ad + " " + r.n).join(" | ");

{
  const e = env();
  for (const q of ["o=n", "o=a", "o=a", "o=t&k=f&m=gida", "o=t&k=f&m=gida", "o=t&k=b&m=koz", "o=t&k=y", "o=d7&ilk=2026-10-08"]) {
    const r = await olc(e, q); if (r.status !== 204) ok(false, "204 bekleniyordu: " + q, r.status);
  }
  ok(tablo(e) === "2026-10-08 d7 1 | 2026-10-16 a 2 | 2026-10-16 n 1 | 2026-10-16 t:b:koz 1 | 2026-10-16 t:f:gida 2 | 2026-10-16 t:y 1", "satırlar bir artar, geri dönüş ilk kullanım gününe", tablo(e));
  const sutun = e.URUNLER.db.prepare("PRAGMA table_info(olcum)").all().map((c) => c.name).join();
  ok(sutun === "gun,ad,n", "tabloda yalnızca gün, ad, sayı (kimlik, IP, içerik sütunu yok)", sutun);
  for (const q of ["", "o=x", "o=t&k=f&m=x", "o=d7&ilk=2026-10-15", "o=a&kim=" + "a".repeat(32)]) {
    const r = await olc(e, q);
    if (q.includes("kim=")) ok(r.status === 204, "fazladan alan yok sayılır, saklanmaz");
    else ok(r.status === 400, "geçersiz ölçüm 400: " + q, r.status);
  }
  ok(!/kim|aaaa/.test(tablo(e)), "fazladan alan tabloya girmez", tablo(e));
  ok((await olc(e, "o=a", { origin: "https://evil.example" })).status === 403, "yabancı köken reddedilir");
  ok((await olc(e, "o=a", { method: "GET" })).status === 405, "GET reddedilir (okuma yalnızca yönetimden)");
  // Yönetim görünümü
  const y = await w.fetch(new Request("https://x.workers.dev/yonetim/api/olcum", { headers: { "Authorization": "Bearer " + ANAHTAR } }), e);
  const j = await y.json();
  ok(y.status === 200 && j.gunler[0].gun === "2026-10-16" && j.gunler[0].aktif === 3 && j.gunler[0].tarama === 4 && j.gunler.find((g) => g.gun === "2026-10-08").d7 === 1, "yönetim: günlük toplamlar", j.gunler[0]);
  ok((await w.fetch(new Request("https://x.workers.dev/yonetim/api/olcum"), e)).status === 401, "yönetim: anahtarsız 401");
}
{
  const e = env(); e.SAYAC = (() => { const m = new Map([["g:2026-10-16:s", "4"], ["g:2026-10-16:d", "1"]]); return { get: async (k) => m.get(k) ?? null, list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }) }; })();
  const j = await (await w.fetch(new Request("https://x.workers.dev/yonetim/api/olcum", { headers: { "Authorization": "Bearer " + ANAHTAR } }), e)).json();
  ok(j.gunler[0].paylasim === 5 && j.ozet.paylasim === 5, "yönetim: paylaşım sayacı (KV) eklenir", j.ozet);
}
{
  const e = env(); e.SAYAC_LIMIT = lim(10);
  for (let i = 0; i < 10; i++) await olc(e, "o=a");
  ok((await olc(e, "o=a")).status === 429, "IP sınırı (11. istek)");
}
{
  const e = env(); delete e.URUNLER;
  ok((await olc(e, "o=a")).status === 204, "D1 bağlı değilse sayılmadan 204");
}
ok(!KAYIT.some((s) => /1\.2\.3\.4/.test(s)), "hata kaydında IP yok", KAYIT);
console.log(fail ? fail + " hata" : "tamam");
process.exit(fail ? 1 : 0);
