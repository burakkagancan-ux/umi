// Barkod yardımcıları (Worker). Uygulamayla ortak hesaplar (kontrol hanesi, benzerlik, Open Food Facts besin dönüşümü, porsiyon süzgeci)
// kopya değil: js/barkod.js ve js/besin.js'ten içe aktarılır (U-07, 15.10.2026); wrangler dağıtımda paketler. Burada yalnızca Worker'a özgü olanlar.
import { BARKOD_AYAR, barkodBenzer, barkodGecerli, barkodKontrol, barkodSozcukler } from "../../js/barkod.js";
import { BESIN_ALAN, besinBirim, besinOff, besinPorNorm } from "../../js/besin.js";
export { barkodGecerli, BESIN_ALAN, besinBirim, besinOff, besinPorNorm };
export const kontrolHanesi = barkodKontrol, sozcukler = barkodSozcukler, benzerlik = barkodBenzer;
export const BENZERLIK = BARKOD_AYAR.benzerlik;
export const KATKI_ARALIK_MS = 10 * 60_000;   // doğrulama: iki benzer katkı arasında en az 10 dakika


// Katkılar benzerliğe göre gruplanır (aynı tür, grubun ilk katkısına benzerlik ≥ BENZERLIK; satırlar yeniden eskiye sıralı gelir).
// Grubun içinde en az KATKI_ARALIK_MS arayla gelmiş iki katkı varsa doğrulanmış. Aynı katkıcı kimliğinden (kim) gelen iki katkı
// birbirini doğrulamaz; kimliği olmayan (O-22 öncesi) katkılar ayrı kişi sayılır.
function dogrulayanCift(a, b) { return Math.abs(a.t - b.t) >= KATKI_ARALIK_MS && !(a.kim && a.kim === b.kim); }
export function grupla(satirlar) {
  const gruplar = [];
  for (const s of satirlar) {
    const g = gruplar.find((x) => x.tur === s.tur && benzerlik(x.ilk.metin, s.metin) >= BENZERLIK);
    if (g) g.s.push(s); else gruplar.push({ tur: s.tur, ilk: s, s: [s] });
  }
  for (const g of gruplar) {
    g.dogrulandi = g.s.some((a, i) => g.s.some((b, j) => j > i && dogrulayanCift(a, b)));
    g.son = g.s.reduce((a, b) => (b.t > a.t ? b : a));
  }
  return gruplar;
}
// En iyi grup: doğrulanmış > kalabalık > yeni. Gösterilen metin grubun en yeni katkısı; kim yanıta girmez.
export function urunSec(satirlar) {
  const gruplar = grupla(satirlar);
  gruplar.sort((a, b) => (b.dogrulandi - a.dogrulandi) || (b.s.length - a.s.length) || (b.son.t - a.son.t));
  const g = gruplar[0];
  if (!g) return { bulundu: false };
  return { bulundu: true, tur: g.son.tur, dil: g.son.dil || "", metin: g.son.metin, t: g.son.t, dogrulandi: g.dogrulandi, sayi: g.s.length };
}

// Eklediklerim ve ürün rozetleri (G-02): bir katkıcının eklediği barkodlar ve rozet sayıları. satirlar: bu katkıcının eklediği
// barkodların bütün katkıları {kod, tur, metin, t, kim} (yeniden eskiye). Barkod başına bir kez sayılır, sayılar türe göre:
//   avci: eklediği içerik doğrulanmış (Ürün Avcısı) · oncu: barkodun ilk katkısı onunki ve doğrulanmış (Öncü) ·
//   dogrulayici: doğrulanmış grupta, başkasının en az KATKI_ARALIK_MS önce eklediği içeriği o eklemiş (Doğrulayıcı) · eklenen: toplam barkod.
// Başkalarının metni ve kimliği yanıta girmez; listede yalnızca katkıcının kendi metninin başı.
export const EKLEDIKLERIM_EN_COK = 200;
export function katkiOzet(satirlar, kim) {
  const say = { eklenen: {}, avci: {}, oncu: {}, dogrulayici: {} }, urunler = [], kodlar = new Map();
  for (const s of satirlar) { if (!kodlar.has(s.kod)) kodlar.set(s.kod, []); kodlar.get(s.kod).push(s); }
  const art = (o, tur) => { o[tur] = (o[tur] || 0) + 1; };
  for (const [kod, l] of kodlar) {
    const benim = l.filter((s) => s.kim === kim);
    if (!benim.length) continue;
    const gruplar = grupla(l), son = benim.reduce((a, b) => (b.t > a.t ? b : a)), tur = son.tur;
    const gb = gruplar.filter((g) => g.dogrulandi && g.s.some((s) => s.kim === kim));
    const ilk = l.reduce((a, b) => (b.t < a.t ? b : a));
    const dogrulandi = gb.length > 0;
    const oncu = ilk.kim === kim && gruplar.some((g) => g.dogrulandi && g.s.includes(ilk));
    const dogrulayici = gb.some((g) => g.s.some((m) => m.kim === kim && g.s.some((o) => o.kim !== kim && m.t - o.t >= KATKI_ARALIK_MS)));
    art(say.eklenen, tur); if (dogrulandi) art(say.avci, tur); if (oncu) art(say.oncu, tur); if (dogrulayici) art(say.dogrulayici, tur);
    urunler.push({ kod, tur, t: son.t, dogrulandi, oncu, dogrulayici, ozet: String(son.metin).slice(0, 80) });
  }
  urunler.sort((a, b) => b.t - a.t);
  return { ...say, urunler: urunler.slice(0, EKLEDIKLERIM_EN_COK) };
}

// Topluluk (G-04): içeriği eklenen ve doğrulanan ürün sayıları. POST /urun her katkıda barkodun önceki ve sonraki durumunu karşılaştırır;
// sayaçlar yalnızca durum değişince artar (doğrulama geri alınmaz: katkı silinmez, urunSec doğrulanmış grubu öne alır).
// satirlar: katkiOzet ile aynı biçim, bütün barkodlar. Döner: {urun: {tür: n}, dogrulanan: {tür: n}} (tür: barkodun en iyi grubunun türü).
export function toplulukSay(satirlar) {
  const kodlar = new Map(), o = { urun: {}, dogrulanan: {} };
  for (const s of satirlar) { if (!kodlar.has(s.kod)) kodlar.set(s.kod, []); kodlar.get(s.kod).push(s); }
  for (const l of kodlar.values()) {
    const u = urunSec(l.sort((a, b) => b.t - a.t));
    o.urun[u.tur] = (o.urun[u.tur] || 0) + 1;
    if (u.dogrulandi) o.dogrulanan[u.tur] = (o.dogrulanan[u.tur] || 0) + 1;
  }
  return o;
}


// Topluluk besin tablosu (A-02): kullanıcı etiketteki tabloyu okutup (açık izniyle) barkoda bağlar. İçerik katkısından ayrı saklanır:
// tablo içerik metnine bağlı değildir, içeriği OFF'tan gelen ya da hiç olmayan barkoda da eklenebilir. Gelen değer burada yalnızca
// biçim ve sınırlarla süzülür ({b: {alan: sayı|null}, lt: {alan: true}, birim: "g"|"ml"|"", por?}); tutarlılık uygulamada denetlenir (besinDenetle).
// por (O-23): porsiyon başına yazılmış etiketten 100 g'a çevrildi {m, u, ara: {alan: [alt, üst]}}; js/besin.js besinPorNorm ile aynı süzgeç.
export function besinKatki(x) {
  if (!x || typeof x !== "object" || !x.b || typeof x.b !== "object") return null;
  const b = {}, lt = {};
  let n = 0;
  for (const a of BESIN_ALAN) {
    const v = x.b[a];
    if (v == null) { b[a] = null; continue; }
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > (a === "kcal" ? 1000 : 100)) return null;
    b[a] = Math.round(v * 1000) / 1000; n++;
    if (x.lt && x.lt[a] === true) lt[a] = true;
  }
  if (n < 2) return null;
  const birim = x.birim === "g" || x.birim === "ml" ? x.birim : "";
  const por = besinPorNorm(x.por);
  return por ? { b, lt, birim, por } : { b, lt, birim };
}
// O-26: topluluk tabloları içerik katkısı gibi doğrulanır. İki tablo uyumlu: birim aynı, ikisinde de okunmuş en az BESIN_UYUM.enAz satır
// var ve bu satırların her birinde fark en çok max(pay[satır], oran x büyük değer). Aynı etiketin iki okuması genelde birebir aynıdır;
// pay yuvarlama ve tarif değişikliği içindir (tuzda küçük: eşik 0,3 g). Bir tabloda okunmamış satır uyumu bozmaz
// (OCR o satırı kaçırmış olabilir). Uyumlu tablolar gruplanır (grubun ilk tablosuna göre); grupta en az KATKI_ARALIK_MS arayla gelmiş,
// farklı katkıcıdan iki tablo varsa grup doğrulanmış (dogrulayanCift, içerikle aynı kural).
export const BESIN_UYUM = { oran: 0.05, pay: { kcal: 10, tuz: 0.05, diger: 0.2 }, enAz: 3 };
export function besinUyumlu(a, b) {
  if (!a || !b || a.birim !== b.birim) return false;
  let n = 0;
  for (const k of BESIN_ALAN) {
    const x = a.b[k], y = b.b[k];
    if (x == null || y == null) continue;
    n++;
    const pay = Math.max(BESIN_UYUM.pay[k] ?? BESIN_UYUM.pay.diger, BESIN_UYUM.oran * Math.max(x, y));
    if (Math.abs(x - y) > pay + 1e-9) return false;
  }
  return n >= BESIN_UYUM.enAz;
}
// satirlar: {besin (JSON metni), t, kim, id?} yeniden eskiye; geçersiz satır atlanır. Döner [{ilk, s: [{v, t, kim, id}], dogrulandi, son}].
export function besinGrupla(satirlar) {
  const gruplar = [];
  for (const r of satirlar || []) {
    let v = null;
    try { v = besinKatki(JSON.parse(r.besin)); } catch {}
    if (!v) continue;
    const s = { v, t: r.t, kim: r.kim || null, id: r.id };
    const g = gruplar.find((x) => besinUyumlu(x.ilk.v, v));
    if (g) g.s.push(s); else gruplar.push({ ilk: s, s: [s] });
  }
  for (const g of gruplar) {
    g.dogrulandi = g.s.some((a, i) => g.s.some((b, j) => j > i && dogrulayanCift(a, b)));
    g.son = g.s.reduce((a, b) => (b.t > a.t ? b : a));
  }
  gruplar.sort((a, b) => (b.dogrulandi - a.dogrulandi) || (b.s.length - a.s.length) || (b.son.t - a.son.t));
  return gruplar;
}
// Gösterilecek tablo: doğrulanmış grup > kalabalık grup > yeni; grubun en yeni tablosu. Döner {besin, besinT, besinDogrulandi} ya da null.
// Kimlik yanıta girmez.
export function besinSec(satirlar) {
  const g = besinGrupla(satirlar)[0];
  return g ? { besin: g.son.v, besinT: g.son.t, besinDogrulandi: g.dogrulandi } : null;
}
