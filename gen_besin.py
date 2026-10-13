# -*- coding: utf-8 -*-
"""Besin değeri tablosu sözlüğü: data/besin.json (A-02)

Kaynak: kaynak/besin_adlari.tsv (satır adları ve sütun başlıkları, dil ve kaynakla). Uygulamada js/besin.js besinSozluk okur;
eşleşme harf ve aksan duyarsızlığı orada yapılır (aynı ad burada değiştirilmez).
Biçim: {"meta": {...}, "adlar": [[alan, dil, ad], ...]}
Çalıştır: python3 gen_besin.py
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
KAYNAK = os.path.join(HERE, "kaynak", "besin_adlari.tsv")
CIKTI = os.path.join(HERE, "data", "besin.json")
ALANLAR = {"enerji", "yag", "doymus", "karb", "seker", "lif", "protein", "tuz", "sodyum", "_atla", "_porsiyon", "_ri"}
KAYNAKLAR = {
    "off": "Open Food Facts besin taksonomisi (openfoodfacts-server, taxonomies/nutrients.txt), ODbL 1.0",
    "ab1169": "AB 1169/2011 Ek XV (beslenme beyanının ifade biçimi)",
    "etiket": "Etiketlerde görülen yazım",
}


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
    }
    with open(CIKTI, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("data/besin.json:", len(adlar), "ad,", len(veri["meta"]["diller"]), "dil")


if __name__ == "__main__":
    main()
