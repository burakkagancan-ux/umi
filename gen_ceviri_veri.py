#!/usr/bin/env python3
"""Veri etiketlerinin çevirisi: i18n/veri/<dil>.json üretir.
Kaynaklar: kaynak/ceviri_<dil>.tsv (elle; anahtar<TAB>metin<TAB>kaynak) ve İngilizce için CosIng işlev adları
(kaynak/kozmetik_islevler.tsv: CosIng'in resmi İngilizce adı → Türkçesi; ekranda Türkçe ad "k.islev:<Türkçe>" ile resmi ada çevrilir).
Uzun veri metinleri (gerekçe, not, açıklama) bu dosyalara henüz girmedi; arayüz onları Türkçe ve "henüz çevrilmedi" işaretiyle gösterir.
Çalıştır: python3 gen_ceviri_veri.py"""
import json, os

K = os.path.join(os.path.dirname(os.path.abspath(__file__)))


def tsv(p):
    for l in open(p, encoding="utf-8"):
        if l.startswith("#") or not l.strip():
            continue
        yield l.rstrip("\n").split("\t")


def cosing_islevler():
    """Türkçe işlev adı → CosIng İngilizce adı (birden çok resmi ad aynı Türkçeye düşerse en kısası; büyük harf cümle düzenine çevrilir)."""
    m = {}
    for r in tsv(os.path.join(K, "kaynak", "kozmetik_islevler.tsv")):
        if len(r) < 2 or not r[1]:
            continue
        en = r[0].strip()
        if r[1] not in m or len(en) < len(m[r[1]]):
            m[r[1]] = en
    return {"k.islev:" + tr: en[:1] + en[1:].lower() for tr, en in m.items()}


def uret(dil):
    out = {"_aciklama": "Üretildi: gen_ceviri_veri.py (kaynak/ceviri_%s.tsv%s). Elle düzenlemeyin." % (dil, " + CosIng işlev adları" if dil == "en" else "")}
    if dil == "en":
        out.update(cosing_islevler())
    ekler = sorted(f for f in os.listdir(os.path.join(K, "kaynak")) if f.startswith("ceviri_%s_" % dil) and f.endswith(".tsv"))
    for r in (r for f in ["ceviri_%s.tsv" % dil] + ekler for r in tsv(os.path.join(K, "kaynak", f))):
        if len(r) < 2:
            raise SystemExit("eksik sütun: %r" % r)
        if r[0] in out and out[r[0]] != r[1]:
            raise SystemExit("çakışan anahtar: %s" % r[0])
        out[r[0]] = r[1]
    p = os.path.join(K, "i18n", "veri", dil + ".json")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(dict(sorted(out.items())), open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(p, len(out) - 1, "çeviri")


if __name__ == "__main__":
    for f in sorted(os.listdir(os.path.join(K, "kaynak"))):
        if f.startswith("ceviri_") and f.endswith(".tsv") and len(f) == len("ceviri_xx.tsv"):   # ceviri_<dil>_<ek>.tsv uret() içinde birleşir
            uret(f[len("ceviri_"):-4])
