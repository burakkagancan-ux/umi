# -*- coding: utf-8 -*-
"""Ürünü tanımlamayan GS1 önekleri (C-10): js/barkod_onek.js

Kaynak: kaynak/gs1_onek.tsv (GS1 önek tablosu; kaynağı dosyanın başında). Çıktı küçük bir ES modülüdür: hem uygulama (js/barkod.js)
hem Worker (worker/src/barkod.js, js/barkod.js üzerinden) aynı tabloyu içe aktarır, ayrı veri isteği gerekmez. Elle düzenlenmez.
Biçim: BARKOD_ONEK = [[bas, son, tur], ...] (bas/son aynı uzunlukta önek, uçlar dahil); BARKOD_ONEK_TUR = tür listesi.
Denetimler: aralık uçları aynı uzunlukta ve rakam, bas <= son, bilinen tür, aralıklar çakışmaz.
Çalıştır: python3 gen_gs1_onek.py
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
KAYNAK = os.path.join(HERE, "kaynak", "gs1_onek.tsv")
CIKTI = os.path.join(HERE, "js", "barkod_onek.js")
TURLER = ["magaza", "yayin", "urun_degil"]


def satirlar():
    for n, l in enumerate(open(KAYNAK, encoding="utf-8"), 1):
        l = l.rstrip("\n")
        if l and not l.startswith("#"):
            yield n, l.split("\t")


def main():
    hata, tablo = [], []
    for n, s in satirlar():
        if len(s) != 4:
            hata.append("%d. satır: 4 sütun bekleniyordu" % n)
            continue
        bas, son, tur, _ = s
        if not (bas.isdigit() and son.isdigit() and len(bas) == len(son)):
            hata.append("%d. satır: önek uçları aynı uzunlukta rakam olmalı" % n)
        elif bas > son:
            hata.append("%d. satır: bas > son" % n)
        if tur not in TURLER:
            hata.append("%d. satır: bilinmeyen tür %s" % (n, tur))
        tablo.append([bas, son, tur])
    # Çakışma: 13 haneli uzaya açılan aralıklar kesişmemeli (bir barkod tek türde olsun)
    def uzay(a):
        return (a[0] + "0" * (13 - len(a[0])), a[1] + "9" * (13 - len(a[1])))
    for i, a in enumerate(tablo):
        for b in tablo[i + 1:]:
            x, y = uzay(a), uzay(b)
            if x[0] <= y[1] and y[0] <= x[1]:
                hata.append("çakışan aralıklar: %s–%s ve %s–%s" % (a[0], a[1], b[0], b[1]))
    if hata:
        print("\n".join(hata), file=sys.stderr)
        sys.exit(1)
    with open(CIKTI, "w", encoding="utf-8") as f:
        f.write("/* gen_gs1_onek.py ile kaynak/gs1_onek.tsv'den üretilir; elle düzenlenmez. Ürünü tanımlamayan GS1 önekleri (C-10). */\n")
        f.write("export var BARKOD_ONEK_TUR=" + json.dumps(TURLER) + ";\n")
        f.write("export var BARKOD_ONEK=" + json.dumps(tablo) + ";\n")
    print("js/barkod_onek.js: %d aralık" % len(tablo))


if __name__ == "__main__":
    main()
