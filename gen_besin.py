# -*- coding: utf-8 -*-
"""Besin değeri tablosu sözlüğü: data/besin.json (A-02)

Kaynak: kaynak/besin_adlari.tsv (satır adları ve sütun başlıkları, dil ve kaynakla). Uygulamada js/besin.js besinSozluk okur;
eşleşme harf ve aksan duyarsızlığı orada yapılır (aynı ad burada değiştirilmez).
Biçim: {"meta": {...}, "adlar": [[alan, dil, ad], ...], "istisna": {...}}
istisna (A-08): kaynak/besin_istisna.json'dan (renk gösterilmeyen ürün tipleri; açıklama dosyanın kendisinde), denetlenip olduğu gibi.
Çalıştır: python3 gen_besin.py
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
KAYNAK = os.path.join(HERE, "kaynak", "besin_adlari.tsv")
ISTISNA = os.path.join(HERE, "kaynak", "besin_istisna.json")
TIP_ALAN = {"id", "kaynak", "madde", "not", "sivi", "etiket", "haric_etiket", "haric_ad", "olmaz", "isaret", "isaret_re", "isaret_degil", "ana", "ek", "ek_e_kodu"}
CIKTI = os.path.join(HERE, "data", "besin.json")
ALANLAR = {"enerji", "yag", "doymus", "karb", "seker", "lif", "protein", "tuz", "sodyum", "kalori", "_atla", "_porsiyon", "_ri", "_boy"}
KAYNAKLAR = {
    "off": "Open Food Facts besin taksonomisi (openfoodfacts-server, taxonomies/nutrients.txt), ODbL 1.0",
    "ab1169": "AB 1169/2011 Ek XV (beslenme beyanının ifade biçimi)",
    "etiket": "Etiketlerde görülen yazım",
}


def istisna_oku(hata):
    """kaynak/besin_istisna.json: tip kimlikleri tekil, kaynaklar tanımlı, alanlar bilinen, düzenli ifadeler derlenir."""
    with open(ISTISNA, encoding="utf-8") as f:
        v = json.load(f)
    gorulen = set()
    for r in v.get("yoksay_re", []):
        try:
            re.compile(r)
        except re.error as e:
            hata.append("istisna yoksay_re %s: %s" % (r, e))
    for t in v["tip"]:
        if not re.fullmatch(r"[a-z_]{1,20}", t.get("id", "")) or t["id"] in gorulen:
            hata.append("istisna: geçersiz ya da tekrarlanan kimlik %r" % t.get("id"))
        gorulen.add(t.get("id"))
        for k in t:
            if k not in TIP_ALAN:
                hata.append("istisna %s: bilinmeyen alan %s" % (t.get("id"), k))
        for k in t.get("kaynak", []):
            if k not in v["kaynaklar"]:
                hata.append("istisna %s: tanımsız kaynak %s" % (t.get("id"), k))
        if not t.get("kaynak"):
            hata.append("istisna %s: kaynak yok" % t.get("id"))
        for r in t.get("isaret_re", []):
            try:
                re.compile(r)
            except re.error as e:
                hata.append("istisna %s isaret_re %s: %s" % (t.get("id"), r, e))
        if not (t.get("etiket") or t.get("isaret") or t.get("ana")):
            hata.append("istisna %s: tanıma yolu yok (etiket, isaret ya da ana)" % t.get("id"))
    v = {k: v[k] for k in ("kaynaklar", "dolgu", "yoksay_re", "tip") if k in v}
    return v


def main():
    adlar, gorulen, hata = [], set(), []
    with open(KAYNAK, encoding="utf-8") as f:
        for n, satir in enumerate(f, 1):
            satir = satir.rstrip("\n")
            if not satir.strip() or satir.startswith("#"):
                continue
            p = satir.split("\t")
            if len(p) != 4:
                hata.append("%d: 4 sütun olmalı" % n)
                continue
            alan, dil, ad, kaynak = (x.strip() for x in p)
            if alan not in ALANLAR:
                hata.append("%d: bilinmeyen alan %s" % (n, alan))
            if kaynak not in KAYNAKLAR:
                hata.append("%d: bilinmeyen kaynak %s" % (n, kaynak))
            if not ad or len(dil) != 2:
                hata.append("%d: ad ya da dil eksik" % n)
            anahtar = ad.casefold()
            if anahtar in gorulen:
                # Aynı ad iki dilde olabilir (Protein, Energie); farklı alana gidiyorsa hata
                onceki = next(a for a in adlar if a[2].casefold() == anahtar)
                if onceki[0] != alan:
                    hata.append("%d: %s iki farklı alanda (%s, %s)" % (n, ad, onceki[0], alan))
                continue
            gorulen.add(anahtar)
            adlar.append([alan, dil, ad])
    istisna = istisna_oku(hata)
    if hata:
        print("\n".join(hata), file=sys.stderr)
        sys.exit(1)
    veri = {
        "meta": {
            "aciklama": "Besin değeri tablosu satır adları ve sütun başlıkları: [alan, dil, ad]. gen_besin.py ile kaynak/besin_adlari.tsv'den üretilir; elle düzenlenmez.",
            "kaynaklar": KAYNAKLAR,
            "diller": sorted({a[1] for a in adlar}),
        },
        "adlar": adlar,
        "istisna": istisna,
    }
    with open(CIKTI, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("data/besin.json:", len(adlar), "ad,", len(veri["meta"]["diller"]), "dil")


if __name__ == "__main__":
    main()
