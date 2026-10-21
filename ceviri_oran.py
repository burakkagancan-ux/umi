#!/usr/bin/env python3
"""Çeviri oranı raporu (B-03, 21.10.2026): kaynak dildeki (Türkçe) içeriğin her dilde ne kadarı çevrilmiş.
Üç aile: arayüz (i18n/<dil>.json, tr.json'daki anahtarlar), veri metinleri (gerekçe, not, etiket: ceviri_kaynak.tr_metinler
anahtarları, i18n/veri/<dil>.json'da bayat olmayan çeviri), ansiklopedi (data/ansiklopedi_<dil>.json dizini ve
data/ansiklopedi/<dil>/*.json sayfaları). Kaynak başlıkları (kaynak.*) özgün dilinde kalır, sayılmaz.
Çalıştır: python3 ceviri_oran.py [--md]   (--md: Markdown tablo; PR açıklaması ve belge için)
Çıkış kodu her zaman 0: rapordur, denetim değil (tr ve en'in eksiksizliği test/ceviri.js'te zorunlu)."""
import glob, json, os, sys

K = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, K)
import ceviri_kaynak  # noqa: E402


def oku(*p):
    with open(os.path.join(K, *p), encoding="utf-8") as f:
        return json.load(f)


def sayilir(k):
    return not k.startswith("kaynak.") and not k.startswith("_")


def oran(kaynak, hedef, metinle=False):
    """metinle: veri metinlerinde arayüzün ikinci yolu da sayılır ("metin:<Türkçe>", js/ceviri.js veriMetin)"""
    ks = [k for k in kaynak if sayilir(k)]
    return sum(1 for k in ks if hedef.get(k) or (metinle and hedef.get("metin:" + kaynak[k]))), len(ks)


def main():
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
