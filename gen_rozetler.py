# -*- coding: utf-8 -*-
"""Rozet tanımları (YOL_HARITASI.md G-01): kaynak/rozetler.json -> data/rozetler.json.

Üst sınırlı ailelerin (ust: "ansiklopedi") tür başına toplamı data/ansiklopedi.json'daki sayfa sayısından gelir; ansiklopedi
büyüyünce eşik kendiliğinden güncellenir (gıda Okuru: 1, 10, 25, 50, 100, 250, 333). Toplamı 0 olan tür (henüz ansiklopedisi
yok) o ailede "çok yakında" görünür. "_" ile başlayan alanlar açıklamadır, çıktıya girmez.
gen_ansiklopedi.py'den SONRA çalıştır.
Çalıştır: python3 gen_rozetler.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
from uretec_ortak import oku_json as oku   # ortak yardımcılar (uretec_ortak.py)
TUR = {"food": "gida", "cosmetic": "koz", "cleaning": "tem"}


def temiz(d):
    return {k: v for k, v in d.items() if not k.startswith("_")}


def main():
    src = oku("kaynak/rozetler.json")
    kad = src["kademeler"]
    if kad != sorted(set(kad)) or len(kad) != 8 or kad[0] < 1:
        raise SystemExit("kademeler artan 8 sayı olmalı (her kademenin bir adı var: k1-k8)")
    say = {t: 0 for t in src["turler"]}
    for r in oku("data/ansiklopedi.json")["records"]:
        for p in r["product_types"]:
            if TUR.get(p) in say:
                say[TUR[p]] += 1
    aileler = []
    for a in src["aileler"]:
        a = temiz(a)
        if a.get("ust") == "ansiklopedi":
            a["toplam"] = say
        elif a.get("ust"):
            raise SystemExit("bilinmeyen üst sınır: " + a["ust"])
        aileler.append(a)
    out = {"kademeler": kad, "turler": src["turler"], "aileler": aileler}
    with open(os.path.join(HERE, "data/rozetler.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("data/rozetler.json:", len(aileler), "aile, ansiklopedi sayfası", say)


if __name__ == "__main__":
    main()
