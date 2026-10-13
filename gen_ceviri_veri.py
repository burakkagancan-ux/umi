#!/usr/bin/env python3
"""Veri etiketlerinin çevirisi: i18n/veri/<dil>.json üretir.
Kaynaklar: kaynak/ceviri_<dil>.tsv (elle; anahtar<TAB>metin<TAB>kaynak), ek dosyalar kaynak/ceviri_<dil>_<ek>.tsv ve İngilizce için
CosIng işlev adları (kaynak/kozmetik_islevler.tsv: CosIng'in resmi İngilizce adı → Türkçesi; ekranda Türkçe ad "k.islev:<Türkçe>" ile resmi ada çevrilir).
Uzun veri metinleri (gerekçe, not, açıklama, üretim yolu) kaynak/ceviri_<dil>_veri.tsv'de: anahtar<TAB>çeviri<TAB>çevrildiği Türkçe metin
(YOL_HARITASI.md O-25). Verideki Türkçe değişmişse çeviri bayattır: yazılmaz (arayüz Türkçeyi "henüz çevrilmedi" işaretiyle gösterir)
ve BAYAT diye listelenir; yeniden çevrilip 3. sütun yeni Türkçeyle güncellenir. Türkçe metin ceviri_kaynak.py'den gelir.
Çalıştır: python3 gen_ceviri_veri.py   (çevrilecekler: python3 ceviri_kaynak.py --eksik <dil>)"""
import json, os
from ceviri_kaynak import tr_metinler, tr_metin

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
    bayat, sahipsiz = [], []
    for f in ["ceviri_%s.tsv" % dil] + ekler:
        veri = f == "ceviri_%s_veri.tsv" % dil
        for r in tsv(os.path.join(K, "kaynak", f)):
            if len(r) < (3 if veri else 2):
                raise SystemExit("eksik sütun (%s): %r" % (f, r))
            if r[0] in out and out[r[0]] != r[1]:
                raise SystemExit("çakışan anahtar: %s" % r[0])
            if veri:
                simdi = tr_metin(r[0], TR)
                if simdi is None:
                    sahipsiz.append(r[0])
                    continue
                if simdi != r[2]:
                    bayat.append(r[0])
                    continue
            out[r[0]] = r[1]
    for k in sahipsiz:
        print("SAHİPSİZ %s: veride yok (madde silinmiş ya da anahtar ailesi ceviri_kaynak.py'de değil); satır silinmeli" % k)
    for k in bayat:
        print("BAYAT %s: Türkçe değişti, çeviri yazılmadı (yeniden çevir, 3. sütunu güncelle)" % k)
    p = os.path.join(K, "i18n", "veri", dil + ".json")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(dict(sorted(out.items())), open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(p, len(out) - 1, "çeviri")


if __name__ == "__main__":
    TR = tr_metinler()
    for f in sorted(os.listdir(os.path.join(K, "kaynak"))):
        if f.startswith("ceviri_") and f.endswith(".tsv") and len(f) == len("ceviri_xx.tsv"):   # ceviri_<dil>_<ek>.tsv uret() içinde birleşir
            uret(f[len("ceviri_"):-4])
