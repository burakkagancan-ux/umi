// Katkı denetimi (O-21, TEKNIK_BORC "D1'deki katkıları denetleyecek yönetim aracı yok"; O-26 çelişen besin tabloları).
// Sayfa Worker'ın kendisinden sunulur (GET /yonetim; uygulamaya ve service worker'a girmez). Veri uç noktaları /yonetim/api/* yalnızca
// panelde tanımlanan gizli YONETIM_ANAHTARI ile ("Authorization: Bearer <anahtar>") açılır; anahtar tanımlı değilse ya da kısaysa
// yönetim kapalıdır (404). Yanıtlarda CORS başlığı yok: başka bir siteden okunamaz. Kayıt (log) yok, IP saklanmaz.
//
//   GET  /yonetim                       sayfa (anahtar sayfada girilir, yalnızca o sekmede tutulur)
//   GET  /yonetim/api/liste?gor=son|celiski|aranan&sayfa=N
//        son: en son katkı alan barkodlar; celiski: içerik ya da besin tablosu birbirine uymayan (birden çok grup) barkodlar;
//        aranan: "aranıyor" listesi (G-04; kötüye kullanılan barkod çıkarılabilir)
//   GET  /yonetim/api/urun/:barkod      bir barkodun bütün içerik katkıları ve besin tabloları, grup ve gösterilen grup bilgisiyle
//   GET  /yonetim/api/kim/:kimlik       bir katkıcı kimliğinin bütün katkıları (kötü niyetli katkıcıyı bulmak için)
//   POST /yonetim/api/sil               {tablo: "katki"|"besin", id} tek satır · {kim} o kimliğin bütün katkıları ve tabloları ·
//                                       {tablo: "aranan", kod} aranan listesinden çıkar. Silinen satırlar `silinen` tablosuna taşınır
//                                       (SILINEN_OMUR_GUN gün), her silme `islem` tablosuna yazılır; topluluk sayaçlarına yalnızca
//                                       etkilenen barkodların farkı uygulanır (eskiden bütün sayaçlar silinip baştan sayılıyordu).
//   GET  /yonetim/api/islem?sayfa=N     İşlem Kaydı: silmeler, kaç satır, geri alındı mı
//   POST /yonetim/api/geri              {islem} o silmeyi geri alır (satırlar aynı numarayla geri yazılır, sayaçlara fark uygulanır)
//   GET  /yonetim/api/olcum             A-03 ölçümü: son 60 günün günlük toplamları (D1 olcum + paylaşım sayacı KV) ve son 7 günün özeti
import { barkodGecerli, besinGrupla, grupla, toplamFark, urunSec } from "./barkod.js";
import { OLCUM_AYAR, olcumGun, olcumOzet } from "../../js/olcum.js";

export const YONETIM_ANAHTAR_EN_AZ = 32;   // daha kısa anahtar kabul edilmez (yönetim kapalı kalır)
const SAYFA_BOY = 50;
const CELISKI_TARA = 1000;                 // çelişen barkodlar en son katkı alan bu kadar barkod içinde aranır
const KATKICI_RE = /^[0-9a-f]{32}$/;
const SILINEN_OMUR_GUN = 90;               // silinen satırlar bu kadar gün geri alınabilir, sonra kalıcı silinir
// Geri yazılırken yalnızca bu sütunlar kabul edilir (silinen.satir JSON'undan; tablo adı da yalnızca bu listeden)
const SUTUNLAR = { katki: ["id", "kod", "tur", "dil", "metin", "t", "kim", "iz"], besin: ["id", "kod", "besin", "t", "kim", "iz"], aranan: ["kod", "tur", "n", "ilk", "son"] };

// Sabit süreli karşılaştırma: iki değerin SHA-256 özeti karşılaştırılır (uzunluk ve ilk farklı harf zamanlamadan anlaşılmaz)
async function ozet(s) { return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)))); }
export async function yonetimYetki(env, request) {
  const anahtar = env.YONETIM_ANAHTARI;
  if (!anahtar || String(anahtar).length < YONETIM_ANAHTAR_EN_AZ) return "kapali";
  const m = /^Bearer (.+)$/.exec(request.headers.get("Authorization") || "");
  if (!m) return "yok";
  const [a, b] = await Promise.all([ozet(m[1]), ozet(anahtar)]);
  let fark = 0;
  for (let i = 0; i < a.length; i++) fark |= a[i] ^ b[i];
  return fark === 0 ? "tamam" : "yok";
}

// Bir barkodun özeti. katki: {id, tur, dil, metin, t, kim}; besin: {id, besin, t, kim} (yeniden eskiye).
// celiski: içerikte ya da besin tablosunda birden çok grup (birbirine benzemeyen katkılar).
function kGrupla(katki) {
  const g = grupla(katki);
  g.sort((a, b) => (b.dogrulandi - a.dogrulandi) || (b.s.length - a.s.length) || (b.son.t - a.son.t));   // urunSec ile aynı sıra
  return g;
}
export function yonetimOzet(kod, katki, besin) {
  const kg = kGrupla(katki), bg = besinGrupla(besin);
  const son = Math.max(0, ...katki.map((s) => s.t), ...besin.map((s) => s.t));
  return {
    kod, son, tur: kg[0] ? kg[0].son.tur : besin.length ? "gida" : "",
    katki: katki.length, katkiGrup: kg.length, dogrulandi: !!(kg[0] && kg[0].dogrulandi), ozet: kg[0] ? String(kg[0].son.metin).slice(0, 90) : "",
    besin: besin.length, besinGrup: bg.length, besinDogrulandi: !!(bg[0] && bg[0].dogrulandi),
    celiski: kg.length > 1 || bg.length > 1,
  };
}
// Barkodun ayrıntısı: her satıra grup numarası (0 = uygulamada gösterilen grup) ve grubun doğrulanma durumu
export function yonetimUrun(kod, katki, besin, aranan) {
  const kg = kGrupla(katki), bg = besinGrupla(besin);
  const kSat = [], bSat = [];
  kg.forEach((g, i) => g.s.forEach((s) => kSat.push({ id: s.id, tur: s.tur, dil: s.dil || "", metin: s.metin, t: s.t, kim: s.kim || "", iz: s.iz || "", grup: i, dogrulandi: g.dogrulandi })));
  bg.forEach((g, i) => g.s.forEach((s) => bSat.push({ id: s.id, besin: s.v, t: s.t, kim: s.kim || "", iz: s.iz || "", grup: i, dogrulandi: g.dogrulandi })));
  const t = (a, b) => (a.grup - b.grup) || (b.t - a.t);
  return { kod, ozet: yonetimOzet(kod, katki, besin), katki: kSat.sort(t), besin: bSat.sort(t), aranan: aranan || null };
}
function kodlaraGore(satirlar) {
  const m = new Map();
  for (const s of satirlar || []) { if (!m.has(s.kod)) m.set(s.kod, []); m.get(s.kod).push(s); }
  return m;
}
function ozetler(katki, besin) {
  const k = kodlaraGore(katki), b = kodlaraGore(besin), kodlar = new Set([...k.keys(), ...b.keys()]);
  return [...kodlar].map((kod) => yonetimOzet(kod, k.get(kod) || [], b.get(kod) || [])).sort((a, b) => b.son - a.son);
}

const SON_KODLAR = "SELECT kod FROM (SELECT kod, t FROM katki UNION ALL SELECT kod, t FROM besin) GROUP BY kod ORDER BY MAX(t) DESC LIMIT ? OFFSET ?";
async function satirlar(db, kosul, ...args) {
  const [{ results: k }, { results: b }] = await Promise.all([
    db.prepare("SELECT id, kod, tur, dil, metin, t, kim, iz FROM katki WHERE " + kosul + " ORDER BY t DESC").bind(...args).all(),
    db.prepare("SELECT id, kod, besin, t, kim, iz FROM besin WHERE " + kosul + " ORDER BY t DESC").bind(...args).all(),
  ]);
  return [k || [], b || []];
}

// Topluluk sayaçlarına fark ([[ad, ±n]]; aynı ad toplanır, en çok 6 deyim). Sayaç sıfırın altına inmez. toplamDeyimler deyimleri
// döndürür (bir toplu yazıma eklensin diye); kosul verilirse her deyim yalnızca o SQL koşulu doğruyken yazar.
export function toplamDeyimler(db, fark, kosul, ...kArgs) {
  const m = new Map();
  for (const [ad, n] of fark) m.set(ad, (m.get(ad) || 0) + n);
  return [...m].filter(([, n]) => n).map(([ad, n]) =>
    db.prepare("INSERT INTO toplam (ad, n) SELECT ?, MAX(0, ?) WHERE " + (kosul || "1") + " ON CONFLICT(ad) DO UPDATE SET n = MAX(0, n + ?)").bind(ad, n, ...kArgs, n));
}
export async function toplamUygula(db, fark) {
  for (const d of toplamDeyimler(db, fark)) await d.run();
}
// Barkodların içerik katkıları (tek sorgu; D1'in istek başına sorgu sınırı yüzünden barkod başına sorgu yok) → Map(kod → satırlar)
async function kodSatirlari(db, kodlar) {
  const m = new Map(kodlar.map((k) => [k, []]));
  if (!kodlar.length) return m;
  const { results } = await db.prepare("SELECT id, kod, tur, dil, metin, t, kim, iz FROM katki WHERE kod IN (SELECT value FROM json_each(?)) ORDER BY t DESC").bind(JSON.stringify(kodlar)).all();
  for (const r of results || []) m.get(r.kod).push(r);
  return m;
}
// Silmeden ya da geri almadan önceki ve sonraki satırlardan barkod başına sayaç farkı
function satirFark(once, sonraFn) {
  const f = [];
  for (const [kod, l] of once) f.push(...toplamFark(urunSec(l), urunSec(sonraFn(kod, l))));
  return f;
}
// Satırı belirleyen sütun (aranan'da numara yok, barkod tektir)
const ANAHTAR = { katki: "id", besin: "id", aranan: "kod" };
const jsonNesne = (tablo) => "json_object(" + SUTUNLAR[tablo].map((c) => "'" + c + "', " + c).join(", ") + ")";
// Silme: seçilen satırlar okunur; işlem kaydı, silinen tablosuna kopya, silme ve sayaç farkı tek toplu yazımda (D1 batch tek işlemdir:
// yarıda kalmaz). Kopya ve silme okunan satırların anahtarlarıyla yapılır (okuma ile yazma arasında gelen yeni satır silinmez) ve tablo
// başına tek deyimdir: sorgu sayısı satır sayısından bağımsız (D1 istek başına sorgu sınırı). secim: [[tablo, koşul, ...bağlar]].
async function silVeKaydet(db, ne, ayrinti, secim) {
  const anahtarlar = [], kodlar = new Set(), katkiKod = new Set(), silinen = new Set();
  for (const [tablo, kosul, ...args] of secim) {
    const { results } = await db.prepare("SELECT " + ANAHTAR[tablo] + " AS a, kod FROM " + tablo + " WHERE " + kosul).bind(...args).all();
    const l = results || [];
    if (l.length) anahtarlar.push([tablo, l.map((r) => r.a)]);
    for (const r of l) { kodlar.add(r.kod); if (tablo === "katki") { katkiKod.add(r.kod); silinen.add(r.a); } }
  }
  const n = anahtarlar.reduce((a, [, l]) => a + l.length, 0);
  if (!n) return { n: 0 };
  const once = await kodSatirlari(db, [...katkiKod]);
  const t = Date.now(), ozet = { ...ayrinti, n, kodlar: [...kodlar].slice(0, 20) };
  const r = await db.batch([
    db.prepare("INSERT INTO islem (t, ne, ayrinti) VALUES (?, ?, ?) RETURNING id").bind(t, ne, JSON.stringify(ozet)),
    ...anahtarlar.flatMap(([tablo, l]) => {
      const k = ANAHTAR[tablo] + " IN (SELECT value FROM json_each(?))", js = JSON.stringify(l);
      return [
        db.prepare("INSERT INTO silinen (islem, tablo, satir, t) SELECT (SELECT MAX(id) FROM islem), ?, " + jsonNesne(tablo) + ", ? FROM " + tablo + " WHERE " + k).bind(tablo, t, js),
        db.prepare("DELETE FROM " + tablo + " WHERE " + k).bind(js),
      ];
    }),
    ...toplamDeyimler(db, satirFark(once, (kod, l) => l.filter((x) => !silinen.has(x.id)))),
    db.prepare("DELETE FROM silinen WHERE t < ?").bind(t - SILINEN_OMUR_GUN * 864e5),
  ]);
  return { n, islem: r[0].results[0].id };
}
// Geri alma: önce işlem "geri alındı" diye işaretlenir (yalnızca henüz işaretlenmemişse); satırların geri yazılması ve sayaç farkı aynı
// toplu yazımda yalnızca bu işaret bu isteğin damgasını taşıyorsa yapılır. Aynı anda gelen iki Geri Al'dan yalnızca biri yazar.
async function geriAl(db, id, R) {
  const is = await db.prepare("SELECT id, geri FROM islem WHERE id = ?").bind(id).first();
  if (!is) return R(404, { error: "İşlem bulunamadı." });
  if (is.geri) return R(409, { error: "Bu işlem zaten geri alındı." });
  const { results } = await db.prepare("SELECT tablo, satir FROM silinen WHERE islem = ?").bind(id).all();
  if (!results || !results.length) return R(410, { error: SILINEN_OMUR_GUN + " günden eski; satırlar kalıcı silindi." });
  const geriK = results.filter((r) => r.tablo === "katki").map((r) => JSON.parse(r.satir));
  const once = await kodSatirlari(db, [...new Set(geriK.map((r) => r.kod))]);
  const damga = Date.now() * 1000 + Math.floor(Math.random() * 1000), bizim = "EXISTS (SELECT 1 FROM islem WHERE id = ? AND geri = ?)";
  const tablolar = [...new Set(results.map((r) => r.tablo))].filter((t) => SUTUNLAR[t]);
  const r = await db.batch([
    db.prepare("UPDATE islem SET geri = ? WHERE id = ? AND geri IS NULL").bind(damga, id),
    // INSERT OR IGNORE: aynı numara (id) ya da aranan listesinde o arada yeniden eklenmiş barkod varsa olan kalır
    ...tablolar.map((tablo) => db.prepare("INSERT OR IGNORE INTO " + tablo + " (" + SUTUNLAR[tablo].join(", ") + ") SELECT " +
      SUTUNLAR[tablo].map((c) => "json_extract(satir, '$." + c + "')").join(", ") + " FROM silinen WHERE islem = ? AND tablo = ? AND " + bizim).bind(id, tablo, id, damga)),
    ...toplamDeyimler(db, satirFark(once, (kod, l) => [...l.filter((x) => !geriK.some((g) => g.id === x.id)), ...geriK.filter((g) => g.kod === kod)].sort((a, b) => b.t - a.t)), bizim, id, damga),
    db.prepare("DELETE FROM silinen WHERE islem = ? AND " + bizim).bind(id, id, damga),
  ]);
  const deg = r[0] && r[0].meta ? r[0].meta.changes : 1;
  if (!deg) return R(409, { error: "Bu işlem zaten geri alındı." });
  return R(200, { geri: results.length });
}

/* Paylaşım sayacı (KV "g:YYYY-AA-GG:s|d") → {gun: {s, d}}; son 60 gün (GET /sayac ve ölçüm görünümü) */
export async function sayacGunler(kv) {
  const list = await kv.list({ prefix: "g:" });
  const keys = list.keys.map((k) => k.name).sort().slice(-120);
  const gunler = {};
  for (const k of keys) {
    const [, gun, t] = k.split(":");
    (gunler[gun] = gunler[gun] || {})[t] = Number(await kv.get(k)) || 0;
  }
  return gunler;
}

export async function yonetimApi(request, env, db, yol, R) {
  const p = yol.split("/").filter(Boolean).slice(2);   // ["yonetim", "api", ...]
  const url = new URL(request.url);
  if (request.method === "GET" && p[0] === "olcum" && p.length === 1) {
    const simdi = Date.now(), ilk = olcumGun(simdi - (OLCUM_AYAR.gunSay - 1) * 864e5);
    const { results } = await db.prepare("SELECT gun, ad, n FROM olcum WHERE gun >= ?").bind(ilk).all();
    return R(200, olcumOzet(results || [], env.SAYAC ? await sayacGunler(env.SAYAC) : {}, simdi));
  }
  if (request.method === "GET" && p[0] === "liste" && p.length === 1) {
    const gor = url.searchParams.get("gor") || "son";
    const sayfa = Math.max(0, Math.min(1000, parseInt(url.searchParams.get("sayfa") || "0", 10) || 0));
    if (gor === "aranan") {
      const { results } = await db.prepare("SELECT kod, tur, n, ilk, son FROM aranan ORDER BY n DESC, son DESC LIMIT ? OFFSET ?").bind(SAYFA_BOY, sayfa * SAYFA_BOY).all();
      return R(200, { gor, sayfa, aranan: results || [], devam: (results || []).length === SAYFA_BOY });
    }
    if (gor === "celiski") {
      const [k, b] = await satirlar(db, "kod IN (" + SON_KODLAR + ")", CELISKI_TARA, 0);
      const hepsi = ozetler(k, b).filter((o) => o.celiski);
      return R(200, { gor, sayfa, urunler: hepsi.slice(sayfa * SAYFA_BOY, (sayfa + 1) * SAYFA_BOY), devam: hepsi.length > (sayfa + 1) * SAYFA_BOY, tarama: CELISKI_TARA });
    }
    if (gor !== "son") return R(400, { error: "Geçersiz liste." });
    const [k, b] = await satirlar(db, "kod IN (" + SON_KODLAR + ")", SAYFA_BOY, sayfa * SAYFA_BOY);
    const urunler = ozetler(k, b);
    return R(200, { gor, sayfa, urunler, devam: urunler.length === SAYFA_BOY });
  }
  if (request.method === "GET" && p[0] === "urun" && p.length === 2) {
    if (!/^\d{8,14}$/.test(p[1])) return R(400, { error: "Geçersiz barkod." });
    const [k, b] = await satirlar(db, "kod = ?", p[1]);
    const ar = await db.prepare("SELECT kod, tur, n, ilk, son FROM aranan WHERE kod = ?").bind(p[1]).first();
    return R(200, yonetimUrun(p[1], k, b, ar));
  }
  if (request.method === "GET" && p[0] === "kim" && p.length === 2) {
    if (!KATKICI_RE.test(p[1])) return R(400, { error: "Geçersiz katkıcı kimliği." });
    const [k, b] = await satirlar(db, "kod IN (SELECT kod FROM katki WHERE kim = ?1 UNION SELECT kod FROM besin WHERE kim = ?1)", p[1]);
    return R(200, { kim: p[1], katki: k.filter((s) => s.kim === p[1]).length, besin: b.filter((s) => s.kim === p[1]).length, urunler: ozetler(k, b) });
  }
  if (request.method === "POST" && p[0] === "sil" && p.length === 1) {
    let j;
    try { const raw = await request.text(); if (raw.length > 500) return R(413, { error: "Geçersiz istek." }); j = JSON.parse(raw); } catch { return R(400, { error: "Geçersiz istek." }); }
    let r;
    if (j && (j.tablo === "katki" || j.tablo === "besin") && Number.isInteger(j.id) && j.id > 0)
      r = await silVeKaydet(db, "satir", { tablo: j.tablo, id: j.id }, [[j.tablo, "id = ?", j.id]]);
    else if (j && j.tablo === "aranan" && barkodGecerli(String(j.kod || "")))
      r = await silVeKaydet(db, "aranan", { kod: String(j.kod) }, [["aranan", "kod = ?", String(j.kod)]]);
    else if (j && !j.tablo && KATKICI_RE.test(String(j.kim || "")))
      r = await silVeKaydet(db, "katkici", { kim: j.kim }, [["katki", "kim = ?", j.kim], ["besin", "kim = ?", j.kim]]);
    else return R(400, { error: "Geçersiz silme isteği." });
    return R(200, { silindi: r.n, islem: r.islem || null });
  }
  if (request.method === "POST" && p[0] === "geri" && p.length === 1) {
    let j;
    try { const raw = await request.text(); if (raw.length > 200) return R(413, { error: "Geçersiz istek." }); j = JSON.parse(raw); } catch { return R(400, { error: "Geçersiz istek." }); }
    if (!j || !Number.isInteger(j.islem) || j.islem < 1) return R(400, { error: "Geçersiz işlem." });
    return geriAl(db, j.islem, R);
  }
  if (request.method === "GET" && p[0] === "islem" && p.length === 1) {
    const sayfa = Math.max(0, Math.min(1000, parseInt(url.searchParams.get("sayfa") || "0", 10) || 0));
    const { results } = await db.prepare("SELECT id, t, ne, ayrinti, geri, (SELECT COUNT(*) FROM silinen WHERE silinen.islem = islem.id) AS kalan FROM islem ORDER BY id DESC LIMIT ? OFFSET ?").bind(SAYFA_BOY, sayfa * SAYFA_BOY).all();
    const islemler = (results || []).map((r) => ({ id: r.id, t: r.t, ne: r.ne, ayrinti: JSON.parse(r.ayrinti), geri: r.geri ? Math.floor(r.geri / 1000) : null, geriAlinabilir: !r.geri && r.kalan > 0 }));
    return R(200, { sayfa, islemler, devam: islemler.length === SAYFA_BOY, omur: SILINEN_OMUR_GUN });
  }
  return R(404, { error: "Bulunamadı." });
}

// ---------- Sayfa (Türkçe; yalnızca yönetici kullanır, uygulama arayüzü değildir) ----------
export const YONETIM_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export const YONETIM_HTML = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer">
<title>Katkı Denetimi</title><link rel="stylesheet" href="/yonetim/sayfa.css"></head>
<body>
<header><h1>Katkı Denetimi</h1><button id="cikis" class="alt" hidden>Çıkış</button></header>
<main>
<section id="giris">
  <p>Yönetim anahtarını girin. Anahtar yalnızca bu sekmede tutulur; sekme kapanınca silinir.</p>
  <input id="anahtar" type="password" autocomplete="off" placeholder="Yönetim anahtarı">
  <button id="gir">Giriş</button>
  <p id="giris_msj" class="msj"></p>
</section>
<section id="ana" hidden>
  <nav id="sekmeler">
    <button data-gor="son" class="on">Son Katkılar</button><button data-gor="celiski">Çelişenler</button><button data-gor="aranan">Aranan Listesi</button><button data-gor="olcum">Ölçüm</button><button data-gor="islem">İşlem Kaydı</button>
  </nav>
  <div class="ara"><input id="ara" placeholder="Barkod ya da katkıcı kimliği" autocomplete="off"><button id="ara_b">Aç</button></div>
  <p id="msj" class="msj"></p>
  <div id="icerik"></div>
</section>
</main>
<script src="/yonetim/sayfa.js"></script>
</body></html>`;
export const YONETIM_CSS = `:root{--ana:#2741C8;--cizgi:#E3E5E3;--sunk:#F1F2F1;--yazi:#1B1F1C;--soluk:#5D655F;--amb:#9A6700;--hi:#B4470F}
*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--yazi);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--cizgi)}
h1{font-size:20px;margin:0;color:var(--ana)}h2{font-size:17px;margin:18px 0 8px;color:var(--ana)}
main{max-width:980px;margin:0 auto;padding:12px 16px 40px}
button{font:inherit;border:1px solid var(--ana);background:var(--ana);color:#fff;border-radius:8px;padding:6px 12px;cursor:pointer}
button.alt{background:#fff;color:var(--ana)}button.sil{background:#fff;color:var(--hi);border-color:var(--hi)}
input{font:inherit;padding:7px 10px;border:1px solid var(--cizgi);border-radius:8px;min-width:0}
#giris input{width:min(420px,100%);margin-right:8px}
nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}nav button{background:#fff;color:var(--ana)}nav button.on{background:var(--ana);color:#fff}
.ara{display:flex;gap:6px;margin-bottom:8px}.ara input{flex:1}
.msj{color:var(--soluk);min-height:1.2em}.msj.hata{color:var(--hi)}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--cizgi);vertical-align:top}
th{font-weight:600;color:var(--soluk);font-size:13px}tr.tik{cursor:pointer}tr.tik:hover{background:var(--sunk)}
.kod{font-family:ui-monospace,Menlo,monospace}.kucuk{font-size:13px;color:var(--soluk)}
.rozet{display:inline-block;font-size:12px;border-radius:10px;padding:1px 8px;margin-left:4px;background:var(--sunk)}
.rozet.ok{background:#E3F1E8;color:var(--ana)}.rozet.uyari{background:#FBEBDD;color:var(--hi)}
.kart{border:1px solid var(--cizgi);border-radius:10px;padding:10px 12px;margin:8px 0}
.kart.g0{border-left:4px solid var(--ana)}.metin{white-space:pre-wrap;word-break:break-word;margin:6px 0}
.dugmeler{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.tablo{overflow-x:auto}
@media (max-width:640px){.gizle{display:none}}`;
export const YONETIM_JS = `(function(){
"use strict";
var A=null;try{A=sessionStorage.getItem("yonetim_anahtar")}catch(e){}
var GOR="son",SAYFA=0;
function $(i){return document.getElementById(i)}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=String(txt);return e}
function tarih(t){return t?new Date(t).toLocaleString("tr-TR",{dateStyle:"medium",timeStyle:"short"}):"—"}
function kimKisa(k){return k?k.slice(0,8)+"…":"(kimliksiz)"}
function izKisa(z){return z?" · ağ "+z.slice(0,6):""}   // aynı barkodda aynı ağ izi = büyük olasılıkla aynı kişi
var TUR={gida:"Gıda",koz:"Kozmetik",tem:"Temizlik"};
var ALAN=[["kcal","Enerji (kcal)"],["yag","Yağ"],["doymus","Doymuş Yağ"],["karb","Karbonhidrat"],["seker","Şekerler"],["lif","Lif"],["protein","Protein"],["tuz","Tuz"]];
function msj(s,hata){var m=$("msj");m.textContent=s||"";m.className="msj"+(hata?" hata":"")}
function api(yol,govde){
  return fetch("/yonetim/api"+yol,{method:govde?"POST":"GET",headers:Object.assign({"Authorization":"Bearer "+A},govde?{"Content-Type":"application/json"}:{}),body:govde?JSON.stringify(govde):undefined})
  .then(function(r){return r.json().catch(function(){return {}}).then(function(j){
    if(r.status===401){cikis("Anahtar geçersiz.");throw new Error("Anahtar geçersiz.")}
    if(r.status===404&&j&&j.kapali){cikis("Yönetim kapalı: Cloudflare panelinde YONETIM_ANAHTARI tanımlı değil.");throw new Error("Yönetim kapalı.")}
    if(!r.ok)throw new Error(j.error||("Hata "+r.status));return j})});
}
function goster(){var g=!!A;$("giris").hidden=g;$("ana").hidden=!g;$("cikis").hidden=!g;if(g)liste(GOR,0)}
function cikis(neden){A=null;try{sessionStorage.removeItem("yonetim_anahtar")}catch(e){}$("giris_msj").textContent=neden||"";goster()}
$("gir").onclick=function(){var v=$("anahtar").value.trim();if(!v)return;A=v;try{sessionStorage.setItem("yonetim_anahtar",v)}catch(e){}$("anahtar").value="";goster()};
$("anahtar").onkeydown=function(e){if(e.key==="Enter")$("gir").click()};
$("cikis").onclick=function(){cikis("")};
[].forEach.call(document.querySelectorAll("#sekmeler button"),function(b){b.onclick=function(){liste(b.getAttribute("data-gor"),0)}});
$("ara_b").onclick=function(){var v=$("ara").value.trim().toLowerCase();if(/^\\d{8,14}$/.test(v))urun(v);else if(/^[0-9a-f]{32}$/.test(v))kim(v);else msj("Barkod (8–14 hane) ya da 32 haneli katkıcı kimliği yazın.",true)};
$("ara").onkeydown=function(e){if(e.key==="Enter")$("ara_b").click()};
function sekme(g){[].forEach.call(document.querySelectorAll("#sekmeler button"),function(b){b.classList.toggle("on",b.getAttribute("data-gor")===g)})}
function hata(e){msj(e.message||String(e),true)}
function urunTablo(l){
  var w=el("div","tablo"),tb=el("table"),h=el("tr");
  ["Barkod","Tür","İçerik","Besin Tablosu","Son Katkı"].forEach(function(x,i){h.appendChild(el("th",i===1||i===4?"gizle":null,x))});tb.appendChild(h);
  l.forEach(function(o){
    var r=el("tr","tik");r.onclick=function(){urun(o.kod)};
    var c=el("td");c.appendChild(el("span","kod",o.kod));if(o.celiski)c.appendChild(el("span","rozet uyari","çelişki"));r.appendChild(c);
    r.appendChild(el("td","gizle",TUR[o.tur]||o.tur||"—"));
    c=el("td");if(o.katki){c.appendChild(document.createTextNode(o.katki+" katkı, "+o.katkiGrup+" grup"));c.appendChild(el("span","rozet"+(o.dogrulandi?" ok":""),o.dogrulandi?"doğrulandı":"bekliyor"));c.appendChild(el("div","kucuk",o.ozet))}else c.textContent="—";r.appendChild(c);
    c=el("td");if(o.besin){c.appendChild(document.createTextNode(o.besin+" tablo, "+o.besinGrup+" grup"));c.appendChild(el("span","rozet"+(o.besinDogrulandi?" ok":""),o.besinDogrulandi?"doğrulandı":"bekliyor"))}else c.textContent="—";r.appendChild(c);
    r.appendChild(el("td","gizle kucuk",tarih(o.son)));
    tb.appendChild(r);
  });
  w.appendChild(tb);return w;
}
function sayfaDugme(j,f){var d=el("div","dugmeler");if(j.sayfa>0){var g=el("button","alt","← Önceki");g.onclick=function(){f(j.sayfa-1)};d.appendChild(g)}if(j.devam){var s=el("button","alt","Sonraki →");s.onclick=function(){f(j.sayfa+1)};d.appendChild(s)}return d}
function liste(g,s){
  if(g==="olcum")return olcum();
  if(g==="islem")return islem(s);
  GOR=g;SAYFA=s;sekme(g);msj("Yükleniyor…");
  return api("/liste?gor="+g+"&sayfa="+s).then(function(j){
    var d=$("icerik");d.textContent="";msj("");
    if(g==="aranan"){
      if(!j.aranan.length){d.appendChild(el("p",null,"Aranan listesi boş."));return}
      var tb=el("table"),h=el("tr");["Barkod","Tür","Arama","Son Arama",""].forEach(function(x){h.appendChild(el("th",null,x))});tb.appendChild(h);
      j.aranan.forEach(function(o){var r=el("tr");r.appendChild(el("td","kod",o.kod));r.appendChild(el("td",null,TUR[o.tur]||o.tur));r.appendChild(el("td",null,o.n));r.appendChild(el("td","kucuk",tarih(o.son)));
        var c=el("td"),b=el("button","sil","Listeden Çıkar");b.onclick=function(){if(confirm(o.kod+" aranan listesinden çıkarılsın mı? (Kötüye kullanılan barkod için.)"+GERI))api("/sil",{tablo:"aranan",kod:o.kod}).then(function(){liste("aranan",SAYFA)}).catch(hata)};c.appendChild(b);r.appendChild(c);tb.appendChild(r)});
      var w=el("div","tablo");w.appendChild(tb);d.appendChild(w);d.appendChild(sayfaDugme(j,function(n){liste("aranan",n)}));return;
    }
    if(g==="celiski")d.appendChild(el("p","kucuk","Son "+j.tarama+" barkod içinde birbirine uymayan içerik ya da besin tablosu olanlar. Uygulama en kalabalık ve doğrulanmış grubu gösterir; yanlış grubu silin."));
    if(!j.urunler.length){d.appendChild(el("p",null,g==="celiski"?"Çelişen katkı yok.":"Henüz katkı yok."));return}
    d.appendChild(urunTablo(j.urunler));d.appendChild(sayfaDugme(j,function(n){liste(g,n)}));
  }).catch(hata);
}
var GERI=" İşlem Kaydı'ndan geri alınabilir.";
function sil(soru,govde,sonra){if(!confirm(soru))return;api("/sil",govde).then(function(j){return Promise.resolve(sonra()).then(function(){msj(j.silindi+" satır silindi."+(j.silindi?GERI:""))})}).catch(hata)}
function besinTablo(b){
  var tb=el("table");ALAN.forEach(function(a){var v=b.b[a[0]];if(v==null)return;var r=el("tr");r.appendChild(el("td",null,a[1]));r.appendChild(el("td",null,(b.lt&&b.lt[a[0]]?"< ":"")+String(Math.round(v*100)/100).replace(".",",")+(a[0]==="kcal"?"":" g")));tb.appendChild(r)});
  return tb;
}
function urun(kod){
  sekme("");msj("Yükleniyor…");
  return api("/urun/"+kod).then(function(j){
    var d=$("icerik");d.textContent="";msj("");
    var geri=el("button","alt","← Listeye Dön");geri.onclick=function(){liste(GOR,SAYFA)};d.appendChild(geri);
    var h=el("h2");h.appendChild(el("span","kod",kod));if(j.ozet.celiski)h.appendChild(el("span","rozet uyari","çelişki"));d.appendChild(h);
    if(j.aranan){var p=el("p","kucuk","Aranan listesinde: "+j.aranan.n+" arama, son "+tarih(j.aranan.son)+" ");var ab=el("button","sil","Listeden Çıkar");ab.onclick=function(){sil(kod+" aranan listesinden çıkarılsın mı?"+GERI,{tablo:"aranan",kod:kod},function(){return urun(kod)})};p.appendChild(ab);d.appendChild(p)}
    d.appendChild(el("h2",null,"İçerik Katkıları ("+j.katki.length+")"));
    if(!j.katki.length)d.appendChild(el("p","kucuk","İçerik katkısı yok."));
    j.katki.forEach(function(s){
      var k=el("div","kart g"+s.grup),m=el("div","kucuk");
      m.textContent="Grup "+(s.grup+1)+(s.grup===0?" (uygulamada gösterilen)":"")+(s.dogrulandi?" · doğrulanmış grup":"")+" · "+(TUR[s.tur]||s.tur)+(s.dil?" · "+s.dil:"")+" · "+tarih(s.t)+" · katkıcı "+kimKisa(s.kim)+izKisa(s.iz);
      k.appendChild(m);k.appendChild(el("div","metin",s.metin));
      var dg=el("div","dugmeler"),b=el("button","sil","Bu Katkıyı Sil");b.onclick=function(){sil("Bu içerik katkısı silinsin mi?"+GERI,{tablo:"katki",id:s.id},function(){return urun(kod)})};dg.appendChild(b);
      if(s.kim){var kb=el("button","alt","Katkıcının Bütün Katkıları");kb.onclick=function(){kim(s.kim)};dg.appendChild(kb)}
      k.appendChild(dg);d.appendChild(k);
    });
    d.appendChild(el("h2",null,"Besin Tabloları ("+j.besin.length+")"));
    if(!j.besin.length)d.appendChild(el("p","kucuk","Besin tablosu yok."));
    j.besin.forEach(function(s){
      var k=el("div","kart g"+s.grup),m=el("div","kucuk");
      m.textContent="Grup "+(s.grup+1)+(s.grup===0?" (uygulamada gösterilen)":"")+(s.dogrulandi?" · doğrulanmış grup":"")+" · 100 "+(s.besin.birim||"?")+" başına"+(s.besin.por?" · porsiyondan çevrildi ("+s.besin.por.m+" "+s.besin.por.u+")":"")+" · "+tarih(s.t)+" · katkıcı "+kimKisa(s.kim)+izKisa(s.iz);
      k.appendChild(m);k.appendChild(besinTablo(s.besin));
      var dg=el("div","dugmeler"),b=el("button","sil","Bu Tabloyu Sil");b.onclick=function(){sil("Bu besin tablosu silinsin mi?"+GERI,{tablo:"besin",id:s.id},function(){return urun(kod)})};dg.appendChild(b);
      if(s.kim){var kb=el("button","alt","Katkıcının Bütün Katkıları");kb.onclick=function(){kim(s.kim)};dg.appendChild(kb)}
      k.appendChild(dg);d.appendChild(k);
    });
  }).catch(hata);
}
function kim(k){
  sekme("");msj("Yükleniyor…");
  return api("/kim/"+k).then(function(j){
    var d=$("icerik");d.textContent="";msj("");
    var geri=el("button","alt","← Listeye Dön");geri.onclick=function(){liste(GOR,SAYFA)};d.appendChild(geri);
    d.appendChild(el("h2",null,"Katkıcı "+kimKisa(k)));
    d.appendChild(el("p",null,j.katki+" içerik katkısı, "+j.besin+" besin tablosu. Aşağıda katkı yaptığı barkodlar (başkalarının katkılarıyla birlikte)."));
    var b=el("button","sil","Bu Katkıcının Bütün Katkılarını Sil");
    b.onclick=function(){sil("Bu katkıcının "+(j.katki+j.besin)+" katkısı ve tablosu silinsin mi? Yalnızca kötü niyetli katkıcı için."+GERI,{kim:k},function(){return kim(k)})};
    d.appendChild(b);
    if(j.urunler.length)d.appendChild(urunTablo(j.urunler));
  }).catch(hata);
}
// İşlem Kaydı: silmeler ve geri almalar. Silinen satırlar belli bir süre saklanır; "Geri Al" onları aynı numarayla geri yazar.
var NE={satir:"Tek satır silindi",katkici:"Katkıcının bütün katkıları silindi",aranan:"Aranan listesinden çıkarıldı"};
function islem(s){
  GOR="islem";SAYFA=s;sekme("islem");msj("Yükleniyor…");
  return api("/islem?sayfa="+s).then(function(j){
    var d=$("icerik");d.textContent="";msj("");
    d.appendChild(el("p","kucuk","Silinen satırlar "+j.omur+" gün saklanır ve geri alınabilir; sonra kalıcı silinir."));
    if(!j.islemler.length){d.appendChild(el("p",null,"Henüz işlem yok."));return}
    var tb=el("table"),h=el("tr");["Zaman","İşlem","Ayrıntı",""].forEach(function(x,i){h.appendChild(el("th",i===2?"gizle":null,x))});tb.appendChild(h);
    j.islemler.forEach(function(o){
      var r=el("tr"),a=o.ayrinti||{};
      r.appendChild(el("td","kucuk",tarih(o.t)));
      r.appendChild(el("td",null,(NE[o.ne]||o.ne)+" ("+a.n+" satır)"));
      r.appendChild(el("td","gizle kucuk",(a.tablo?a.tablo+" ":"")+(a.kim?"katkıcı "+kimKisa(a.kim)+" ":"")+(a.kodlar||[]).join(", ")));
      var c=el("td");
      if(o.geri)c.appendChild(el("span","rozet ok","geri alındı "+tarih(o.geri)));
      else if(o.geriAlinabilir){var b=el("button","alt","Geri Al");b.onclick=function(){if(confirm("Bu işlem geri alınsın mı? Silinen satırlar geri yazılır."))api("/geri",{islem:o.id}).then(function(x){return islem(SAYFA).then(function(){msj(x.geri+" satır geri yazıldı.")})}).catch(hata)};c.appendChild(b)}
      else c.appendChild(el("span","kucuk","süresi doldu"));
      r.appendChild(c);tb.appendChild(r);
    });
    var w=el("div","tablo");w.appendChild(tb);d.appendChild(w);d.appendChild(sayfaDugme(j,islem));
  }).catch(hata);
}
// Ölçüm (A-03): günlük toplamlar; kimlik yok. Geri dönüş oranı = o gün ilk kez açan cihazlardan 7–13 (30–59) gün sonra yeniden açanlar.
function yuzde(a,b){return b?String(Math.round(a/b*1000)/10).replace(".",",")+" %":"—"}
function oranMetin(o){return o?yuzde(o.oran,1)+" ("+o.yeni+" yeni cihaz, "+o.gun+" gün)":"henüz yok (pencere kapanmadı)"}
function olcum(){
  GOR="olcum";SAYFA=0;sekme("olcum");msj("Yükleniyor…");
  return api("/olcum").then(function(j){
    var d=$("icerik"),o=j.ozet,tt=o.tur.gida+o.tur.koz+o.tur.tem;d.textContent="";msj("");
    d.appendChild(el("p","kucuk","Günler UTC. Kimlik, ürün, metin ve barkod sayılmaz; yalnızca günlük toplamlar. Ayarlardan kapatan ve tarayıcısında izlenme karşıtı ayar açık olan kullanıcılar sayılmaz."));
    d.appendChild(el("h2",null,"Son 7 Gün"));
    var ul=el("ul");
    [["Açan cihaz (günlük toplam)",o.aktif],["Yeni cihaz",o.yeni],["Tarama",o.tarama+" (fotoğraf "+o.kaynak.f+", barkod "+o.kaynak.b+", barkod bulunamadı "+o.kaynak.y+")"],
     ["Tür dağılımı","Gıda "+yuzde(o.tur.gida,tt)+" · Kozmetik "+yuzde(o.tur.koz,tt)+" · Temizlik "+yuzde(o.tur.tem,tt)],
     ["Paylaşım",o.paylasim+" (taramaya oranı "+yuzde(o.paylasim,o.tarama)+")"],
     ["7. günde geri dönen",oranMetin(o.d7)],["30. günde geri dönen",oranMetin(o.d30)]].forEach(function(x){var li=el("li");li.appendChild(el("b",null,x[0]+": "));li.appendChild(document.createTextNode(String(x[1])));ul.appendChild(li)});
    d.appendChild(ul);
    d.appendChild(el("h2",null,"Gün Gün"));
    var tb=el("table"),h=el("tr");["Gün","Açan","Yeni","Tarama","Gıda / Koz. / Tem.","Foto / Barkod / Yok","Paylaşım","7. Gün","30. Gün"].forEach(function(x,i){h.appendChild(el("th",i===4||i===5?"gizle":null,x))});tb.appendChild(h);
    j.gunler.forEach(function(g){
      var r=el("tr");
      r.appendChild(el("td","kod",g.gun));r.appendChild(el("td",null,g.aktif));r.appendChild(el("td",null,g.yeni));r.appendChild(el("td",null,g.tarama));
      r.appendChild(el("td","gizle",g.tur.gida+" / "+g.tur.koz+" / "+g.tur.tem));r.appendChild(el("td","gizle",g.kaynak.f+" / "+g.kaynak.b+" / "+g.kaynak.y));
      r.appendChild(el("td",null,g.paylasim));
      [["d7","acik7"],["d30","acik30"]].forEach(function(a){r.appendChild(el("td",g[a[1]]?"kucuk":null,g.yeni||g[a[0]]?g[a[0]]+" ("+yuzde(g[a[0]],g.yeni)+")"+(g[a[1]]?" sürüyor":""):"—"))});
      tb.appendChild(r);
    });
    var w=el("div","tablo");w.appendChild(tb);d.appendChild(w);
  }).catch(hata);
}
goster();
})();`;
