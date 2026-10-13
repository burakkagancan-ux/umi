# -*- coding: utf-8 -*-
"""Dile göre uygulama manifesti: ana ekrana eklenen uygulamanın adı, açıklaması ve kısayolları seçili dilde.

Kaynak: i18n/diller.json (diller) ve i18n/<dil>.json (manifest.ad, manifest.kisa_ad, manifest.aciklama; kısayol adları
sayfa.baslik ve nav.ansiklopedi). Eksik anahtar İngilizceye, o da yoksa Türkçeye düşer (uygulamadaki sırayla aynı).
Çıktı: manifest.webmanifest (kaynak dil Türkçe; sayfalardaki <link rel="manifest">, sw.js CORE) ve
i18n/manifest/<dil>.webmanifest (öteki diller; js/dil.js seçili dile göre bağlantıyı değiştirir, kurulumda inmez).
Uygulamanın kimliği (id) bütün dillerde aynı: dil değişince ana ekrandaki uygulama yeni bir uygulama sayılmaz.
Çalıştır: python3 gen_manifest.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
I18N = os.path.join(HERE, "i18n")
KAYNAK_DIL, YEDEK_DIL = "tr", "en"


def oku(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def manifest(kod, bilgi, sozluk, kok):
    def t(k):
        for d in (kod, YEDEK_DIL, KAYNAK_DIL):
            if k in sozluk.get(d, {}):
                return sozluk[d][k]
        raise SystemExit("i18n anahtarı yok: " + k)

    ikon = lambda ad, boy, amac=None: dict({"src": kok + ad, "sizes": boy, "type": "image/png"}, **({"purpose": amac} if amac else {}))
    kisayol = lambda ad, url: {"name": ad, "short_name": ad, "url": kok + url, "icons": [ikon("icon-192.png", "192x192")]}
    return {
        # id start_url'e göre çözülür: her dosyada kök dizin (eski manifestte id yoktu, start_url "./" kimlikti)
        "id": "./",
        "name": t("manifest.ad"),
        "short_name": t("manifest.kisa_ad"),
        "description": t("manifest.aciklama"),
        "lang": kod,
        "dir": bilgi.get("yon", "ltr"),
        "start_url": kok + "ocr.html",
        "scope": kok or "./",
        "display": "standalone",
        "background_color": "#eef1ee",
        "theme_color": "#1d4d3a",
        "icons": [ikon("icon-192.png", "192x192"), ikon("icon-512.png", "512x512"), ikon("icon-maskable-512.png", "512x512", "maskable")],
        "shortcuts": [kisayol(t("sayfa.baslik"), "ocr.html"), kisayol(t("nav.ansiklopedi"), "ansiklopedi.html")],
    }


def yaz(p, veri):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, indent=1)
        f.write("\n")


def main():
    diller = oku(os.path.join(I18N, "diller.json"))["diller"]
    sozluk = {k: oku(os.path.join(I18N, k + ".json")) for k in diller}
    os.makedirs(os.path.join(I18N, "manifest"), exist_ok=True)
    for kod, bilgi in diller.items():
        if kod == KAYNAK_DIL:
            yaz(os.path.join(HERE, "manifest.webmanifest"), manifest(kod, bilgi, sozluk, ""))
        else:
            yaz(os.path.join(I18N, "manifest", kod + ".webmanifest"), manifest(kod, bilgi, sozluk, "../../"))
    print("manifest:", len(diller), "dil")


if __name__ == "__main__":
    main()
