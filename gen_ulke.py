# -*- coding: utf-8 -*-
"""Ülke mevzuat katmanı (B-05): data/ulke.json

Kaynak: kaynak/ulke/ulkeler.json (ülkeler, arayüz özellikleri, katkı listelerinin yeri ve kaynakları) + listeler
(kaynak/tgk_ek2_2024.tsv, kaynak/ulke/gb_katki.tsv, kaynak/ulke/us_renk.tsv). Türkiye'nin TGK adı ve notu data/e_kodlari.json'dan
(tgk_name, tgk_note; gen_e_kodlari'ndan sonra çalışır). Bütün ülkeler aynı modelde: uygulama (js/ulke.js) ülke adı bilmez.
Biçim: {"meta": {durumlar, kaynaklar}, "u": {"<KOD>": {"oz": {...}, "kaynak": "<kaynak anahtarı>", "k": {"<E kodu>": [durum, ad?, not?]}}}}
durum: izinli | kisitli | izinli_degil | iptal | belirsiz. not: metin (Türkiye: TGK notu, çevirisi i18n/veri "e.<kod>.tgk_not")
ya da {"tr", "en"} (kaynaktaki ifade ve Türkçesi). Listede yoksa "listede_yoksa" (null: o kod için satır yok, değerlendirilmedi).
Çalıştır: python3 gen_ulke.py
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
KAYNAK = os.path.join(HERE, "kaynak", "ulke", "ulkeler.json")
CIKTI = os.path.join(HERE, "data", "ulke.json")


def tsv(yol):
    for l in open(os.path.join(HERE, yol), encoding="utf-8"):
        l = l.rstrip("\n")
        if l and not l.startswith("#"):
            yield l.split("\t")


def main():
    k = json.load(open(KAYNAK, encoding="utf-8"))
    E = json.load(open(os.path.join(HERE, "data", "e_kodlari.json"), encoding="utf-8"))["ingredients"]
    ids = [x["id"] for x in E]
    by = {x["id"]: x for x in E}
    durumlar, hata, u = set(k["durumlar"]), [], {}
    for kod, c in sorted(k["ulkeler"].items()):
        if not (len(kod) == 2 and kod.isupper()):
            hata.append("%s: ülke kodu ISO 3166 iki büyük harf olmalı" % kod)
        kt = c["katki"]
        if kt["kaynak"] not in k["kaynaklar"]:
            hata.append("%s: tanımsız kaynak %s" % (kod, kt["kaynak"]))
        kayit = {}
        if "liste" in kt:
            liste = {r[0].strip() for r in tsv(kt["liste"])}
            for i in ids:
                # alt türü listede olan ana kod da listede sayılır (E150 → E150a…; E101 (i))
                var = i in liste or any(x.startswith(i) and not x[len(i):len(i) + 1].isdigit() for x in liste)
                d = "izinli" if var else kt["listede_yoksa"]
                if d:
                    kayit[i] = [d]
        if "tablo" in kt:
            for r in tsv(kt["tablo"]):
                if r[0] not in by:
                    hata.append("%s: %s bizim E kodu listemizde yok" % (kod, r[0]))
                    continue
                en_, tr_ = (r[3] if len(r) > 3 else "").strip(), (r[4] if len(r) > 4 else "").strip()
                kayit[r[0]] = [r[1], "", {"tr": tr_, "en": en_} if tr_ or en_ else ""]
        for i, (d, n_tr, n_en) in kt.get("istisna", {}).items():
            kayit[i] = [d, "", {"tr": n_tr, "en": n_en}]
        if kt.get("ad_not") == "e_kodlari":
            for i, v in kayit.items():
                x = by[i]
                ad = x.get("tgk_name") if x.get("tgk_name") and x["tgk_name"].lower() != x["primary_name"].lower() else ""
                kayit[i] = [v[0], ad or "", x.get("tgk_note") or ""]
        for i, v in kayit.items():
            if v[0] not in durumlar:
                hata.append("%s %s: bilinmeyen durum %s" % (kod, i, v[0]))
            while len(v) > 1 and not v[-1]:
                v.pop()
        u[kod] = {"oz": c.get("oz", {}), "kaynak": kt["kaynak"], "k": dict(sorted(kayit.items()))}
    if hata:
        print("\n".join(hata), file=sys.stderr)
        sys.exit(1)
    veri = {"meta": {"aciklama": "gen_ulke.py ile kaynak/ulke/'den üretilir; elle düzenlenmez.", "durumlar": k["durumlar"], "kaynaklar": k["kaynaklar"]}, "u": u}
    with open(CIKTI, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("data/ulke.json:", ", ".join("%s %d katkı" % (c, len(v["k"])) for c, v in u.items()))


if __name__ == "__main__":
    main()
