// Barkod yardımcıları (Worker). js/barkod.js ile aynı hesaplar: Worker ayrı dağıtıldığı için kopya; test/barkod.js ikisini karşılaştırır.
export const KATKI_ARALIK_MS = 10 * 60_000;   // doğrulama: iki benzer katkı arasında en az 10 dakika
export const BENZERLIK = 0.85;                // js/barkod.js BARKOD_AYAR.benzerlik ile aynı

export function kontrolHanesi(govde) {
  let t = 0;
  for (let i = govde.length - 1, w = 3; i >= 0; i--, w = 4 - w) t += Number(govde[i]) * w;
  return (10 - (t % 10)) % 10;
}
function upcE(e) {
  if (!/^[01]\d{7}$/.test(e)) return null;
  const s = e[0], d = e.slice(1, 7), c = e[7], x = d[5];
  const g = x <= "2" ? d.slice(0, 2) + x + "0000" + d.slice(2, 5) : x === "3" ? d.slice(0, 3) + "00000" + d.slice(3, 5) : x === "4" ? d.slice(0, 4) + "00000" + d[4] : d.slice(0, 5) + "0000" + x;
  return s + g + c;
}
export function barkodGecerli(s) {
  s = String(s || "").replace(/[^0-9]/g, "");
  if (s.length === 13 || s.length === 12) return kontrolHanesi(s.slice(0, -1)) === Number(s.slice(-1));
  if (s.length === 8) {
    if (kontrolHanesi(s.slice(0, 7)) === Number(s[7])) return true;
    const a = upcE(s); return !!a && kontrolHanesi(a.slice(0, 11)) === Number(a[11]);
  }
  return false;
}
export function sozcukler(s) {
  const m = { "ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g", "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c" };
  return String(s || "").replace(/[ıİşŞğĞüÜöÖçÇ]/g, (c) => m[c]).toLowerCase().split(/[^a-z0-9%]+/).filter((w) => w.length > 1);
}
export function benzerlik(a, b) {
  const A = new Set(sozcukler(a)), B = new Set(sozcukler(b));
  let n = 0; for (const w of A) if (B.has(w)) n++;
  const u = A.size + B.size - n; return u ? n / u : 0;
}

// Katkılar benzerliğe göre gruplanır; grubun içinde en az KATKI_ARALIK_MS arayla gelmiş iki katkı varsa doğrulanmış.
// Aynı katkıcı kimliğinden (kim) gelen iki katkı birbirini doğrulamaz; kimliği olmayan (O-22 öncesi) katkılar ayrı kişi sayılır.
// En iyi grup: doğrulanmış > kalabalık > yeni. Gösterilen metin grubun en yeni katkısı; kim yanıta girmez.
export function urunSec(satirlar) {
  const gruplar = [];
  for (const s of satirlar) {
    const g = gruplar.find((x) => x.tur === s.tur && benzerlik(x.ilk.metin, s.metin) >= BENZERLIK);
    if (g) g.s.push(s); else gruplar.push({ tur: s.tur, ilk: s, s: [s] });
  }
  for (const g of gruplar) {
    g.dogrulandi = g.s.some((a, i) => g.s.some((b, j) => j > i && Math.abs(a.t - b.t) >= KATKI_ARALIK_MS && !(a.kim && a.kim === b.kim)));
    g.son = g.s.reduce((a, b) => (b.t > a.t ? b : a));
  }
  gruplar.sort((a, b) => (b.dogrulandi - a.dogrulandi) || (b.s.length - a.s.length) || (b.son.t - a.son.t));
  const g = gruplar[0];
  if (!g) return { bulundu: false };
  return { bulundu: true, tur: g.son.tur, dil: g.son.dil || "", metin: g.son.metin, t: g.son.t, dogrulandi: g.dogrulandi, sayi: g.s.length };
}


// Besin değerleri (A-02): Open Food Facts nutriments (*_100g) → {kcal, yag, doymus, karb, seker, lif, protein, tuz, birim}; değer yoksa null.
// js/besin.js besinOff ve off_al.py besin_al ile aynı hesap (test/besin.js karşılaştırır). Tutarlılık uygulamada denetlenir.
const BESIN_OFF = { yag: "fat", doymus: "saturated-fat", karb: "carbohydrates", seker: "sugars", lif: "fiber", protein: "proteins", tuz: "salt" };
export function besinBirim(miktar) {
  const s = String(miktar == null ? "" : miktar).toLowerCase();
  if (/\d\s*(ml|cl|dl|l|lt|litre|liter|litres|liters)\b/.test(s)) return "ml";
  return /\d\s*(g|gr|kg|gram|grams)\b/.test(s) ? "g" : "";
}
export function besinOff(n, miktar) {
  if (!n || typeof n !== "object") return null;
  const f = (k) => { let v = n[k]; if (v === "" || v == null) return null; v = Number(v); return Number.isFinite(v) && v >= 0 ? v : null; };
  const b = { kcal: f("energy-kcal_100g") };
  if (b.kcal == null) { let kj = f("energy-kj_100g"); if (kj == null) kj = f("energy_100g"); b.kcal = kj == null ? null : kj / 4.184; }
  for (const k in BESIN_OFF) b[k] = f(BESIN_OFF[k] + "_100g");
  if (b.tuz == null) { const na = f("sodium_100g"); b.tuz = na == null ? null : na * 2.5; }
  const alan = ["kcal", "yag", "doymus", "karb", "seker", "lif", "protein", "tuz"];
  if (alan.every((a) => b[a] == null)) return null;
  for (const a of alan) b[a] = b[a] == null ? null : Math.round(b[a] * 1000) / 1000;
  b.birim = besinBirim(miktar);
  return b;
}
