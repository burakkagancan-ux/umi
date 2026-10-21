#!/usr/bin/env python3
"""Çeviri oranı raporu (B-03, 21.10.2026): kaynak dildeki (Türkçe) içeriğin her dilde ne kadarı çevrilmiş.
Üç aile: arayüz (i18n/<dil>.json, tr.json'daki anahtarlar), veri metinleri (gerekçe, not, etiket: ceviri_kaynak.tr_metinler
anahtarları, i18n/veri/<dil>.json'da bayat olmayan çeviri), ansiklopedi (data/ansiklopedi_<dil>.json dizini ve
data/ansiklopedi/<dil>/*.json sayfaları). Kaynak başlıkları (kaynak.*) özgün dilinde kalır, sayılmaz.
Çalıştır: python3 ceviri_oran.py [--md]   (--md: Markdown tablo; PR açıklaması ve belge için)
Rapor kipinde çıkış kodu her zaman 0. `--denetle` (B-03 2. adım, 21.10.2026; CI, test/ceviri_oran.py): İngilizce (bütün öteki dillerin
çeviri kaynağı, O-12) dört ailede eksiksiz olmalı: Türkçe yazılan her yeni metin İngilizcesiyle (bayat olmayan) birlikte girer; eksik ya da
bayat İngilizce varsa anahtarları yazılır, çıkış kodu 1. Öteki diller rapor olarak kalır (O-24: eksik metin İngilizce görünür)."""
import glob, json, os, sys

K = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, K)
import ceviri_kaynak  # noqa: E402


def oku(*p):
    with open(os.path.join(K, *p), encoding="utf-8") as f:
        return json.load(f)


def sayilir(k):
    return not k.startswith("kaynak.") and not k.startswith("_")


def eksik(kaynak, hedef, metinle=False):
    """Çevrilmemiş anahtarlar. metinle: veri metinlerinde arayüzün ikinci yolu da sayılır ("metin:<Türkçe>", js/ceviri.js veriMetin)"""
    return [k for k in kaynak if sayilir(k) and not (hedef.get(k) or (metinle and hedef.get("metin:" + kaynak[k])))]


def oran(kaynak, hedef, metinle=False):
    ks = [k for k in kaynak if sayilir(k)]
    return len(ks) - len(eksik(kaynak, hedef, metinle)), len(ks)


def dil_eksikleri(d):
    """Bir dilin dört ailedeki çevrilmemiş anahtarları: {aile: [anahtar, …]} (sayfalarda "<sayfa>:<anahtar>")"""
    ui = oku("i18n", d + ".json") if os.path.exists(os.path.join(K, "i18n", d + ".json")) else {}
    yv = os.path.join(K, "i18n", "veri", d + ".json")
    veri = oku("i18n", "veri", d + ".json") if os.path.exists(yv) else {}
    ya = os.path.join(K, "data", "ansiklopedi_" + d + ".json")
    ans = oku("data", "ansiklopedi_" + d + ".json")["t"] if os.path.exists(ya) else {}
    sy = []
    for p in sorted(glob.glob(os.path.join(K, "data", "ansiklopedi", "tr", "*.json"))):
        q = os.path.join(K, "data", "ansiklopedi", d, os.path.basename(p))
        h = json.load(open(q, encoding="utf-8"))["t"] if os.path.exists(q) else {}
        sy += [os.path.basename(p)[:-5] + ":" + k for k in eksik(json.load(open(p, encoding="utf-8"))["t"], h)]
    return {"arayüz": eksik(oku("i18n", "tr.json"), ui), "veri": eksik(ceviri_kaynak.tr_metinler(), veri, True),
            "ansiklopedi dizini": eksik(oku("data", "ansiklopedi_tr.json")["t"], ans), "ansiklopedi sayfaları": sy}


def denetle(d="en"):
    """B-03: İngilizce eksiksiz mi; eksikleri yazar, hata sayısını döndürür"""
    e = dil_eksikleri(d)
    n = sum(len(v) for v in e.values())
    for aile, ks in e.items():
        if ks:
            print("HATA %s %s: %d metin İngilizcesiz ya da bayat: %s%s" % (d, aile, len(ks), ", ".join(ks[:15]), " …" if len(ks) > 15 else ""))
    if n:
        print("Yeni ya da değişen Türkçe metnin İngilizcesi aynı PR'da yazılır (B-03; veri: kaynak/ceviri_en*.tsv, `python3 ceviri_kaynak.py --eksik en`; ansiklopedi: kaynak/ansiklopedi_en.json).")
    return n


def main():
    if "--denetle" in sys.argv:
        sys.exit(1 if denetle("en") else 0)
    diller = [d for d in oku("i18n", "diller.json")["diller"] if d != "tr"]
    tr_ui = oku("i18n", "tr.json")
    tr_veri = ceviri_kaynak.tr_metinler()
    tr_ans = oku("data", "ansiklopedi_tr.json")["t"]
    sayfalar = sorted(glob.glob(os.path.join(K, "data", "ansiklopedi", "tr", "*.json")))
    satir = []
    for d in diller:
        ui = oku("i18n", d + ".json") if os.path.exists(os.path.join(K, "i18n", d + ".json")) else {}
        yv = os.path.join(K, "i18n", "veri", d + ".json")
        veri = oku("i18n", "veri", d + ".json") if os.path.exists(yv) else {}
        ya = os.path.join(K, "data", "ansiklopedi_" + d + ".json")
        ans = oku("data", "ansiklopedi_" + d + ".json")["t"] if os.path.exists(ya) else {}
        sv = st = 0
        for p in sayfalar:
            q = os.path.join(K, "data", "ansiklopedi", d, os.path.basename(p))
            a, b = oran(json.load(open(p, encoding="utf-8"))["t"], json.load(open(q, encoding="utf-8"))["t"] if os.path.exists(q) else {})
            sv, st = sv + a, st + b
        satir.append((d, oran(tr_ui, ui), oran(tr_veri, veri, True), oran(tr_ans, ans), (sv, st)))
    yuz = lambda v: "%d/%d (%%%d)" % (v[0], v[1], 100 * v[0] // v[1] if v[1] else 100)
    if "--md" in sys.argv:
        print("| Dil | Arayüz | Veri metinleri | Ansiklopedi dizini | Ansiklopedi sayfaları |\n|---|---|---|---|---|")
        for d, *v in satir:
            print("| %s | %s |" % (d, " | ".join(yuz(x) for x in v)))
    else:
        for d, *v in satir:
            print("%s  arayüz %s  veri %s  ansiklopedi dizini %s  sayfalar %s" % (d, *(yuz(x) for x in v)))


if __name__ == "__main__":
    main()
