# -*- coding: utf-8 -*-
"""Barkodla ürün bulma verisi: data/barkod_off.json

Kaynak: kaynak/off/urunler.json (off_al.py; Open Food Facts, Open Beauty Facts, Open Products Facts'te Türkiye'de satılan ürünler).
Lisans: Open Database License (ODbL) 1.0. Atıf uygulamada her gösterimde yapılır. Bu dosya kullanıcı katkısı veritabanımızla
(Worker D1) birleştirilmez.

Biçim (küçük olsun diye dizi): {"meta": {...}, "u": {"<barkod>": [db, ad, marka, son_degisiklik_sn, {dil: içerik metni}, besin?]}}
db: food | beauty | products (uygulamada gıda | kozmetik | temizlik). İçerik metni yoksa {} (ürün adı bilinir, içerik için fotoğraf istenir).
besin (A-02, yalnızca değeri olan üründe): [kcal, yag, doymus, karb, seker, lif, protein, tuz, birim], 100 g ya da 100 ml başına;
değer yoksa null, birim "g" | "ml" | "" (bilinmiyor). Tutarlılık uygulamada denetlenir (js/besin.js besinDenetle).
Çalıştır: python3 gen_barkod.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
BESIN_ALAN = ["kcal", "yag", "doymus", "karb", "seker", "lif", "protein", "tuz"]   # js/besin.js BESIN_ALAN ile aynı sıra
KAYNAK = os.path.join(HERE, "kaynak", "off", "urunler.json")
CIKTI = os.path.join(HERE, "data", "barkod_off.json")


def main():
    with open(KAYNAK, encoding="utf-8") as f:
        k = json.load(f)
    u = {}
    for p in k["urunler"]:
        kod = str(p["kod"]).strip()
        if not kod.isdigit() or not 8 <= len(kod) <= 14:
            continue
        metin = {d: " ".join(str(v).split())[:4000] for d, v in sorted(p.get("metin", {}).items()) if str(v).strip()}
        u[kod] = [p["db"], p.get("ad", "")[:200], p.get("marka", "")[:100], int(p.get("t") or 0), metin]
        b = p.get("besin")
        if b and any(b.get(k) is not None for k in BESIN_ALAN):
            u[kod].append([b.get(k) for k in BESIN_ALAN] + [b.get("birim") or ""])
    veri = {
        "meta": {
            "surum": k["surum"],
            "kaynak": k["kaynak"],
            "lisans": k["lisans"],
            "atif": k["atif"],
            "sayi": len(u),
            "icerikli": sum(1 for v in u.values() if v[4]),
            "besinli": sum(1 for v in u.values() if len(v) > 5),
            "besin_alan": BESIN_ALAN + ["birim"],
            "aciklama": "Barkod -> [db, ad, marka, son değişiklik (sn), {dil: içerik metni}, besin?]; besin: besin_alan sırasıyla 100 g / 100 ml başına (Open Food Facts). gen_barkod.py ile kaynak/off/urunler.json'dan üretilir; elle düzenlenmez.",
        },
        "u": dict(sorted(u.items())),
    }
    with open(CIKTI, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("data/barkod_off.json:", veri["meta"]["sayi"], "ürün,", veri["meta"]["icerikli"], "içerikli,", veri["meta"]["besinli"], "besin değerli")


if __name__ == "__main__":
    main()
