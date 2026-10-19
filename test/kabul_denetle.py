# -*- coding: utf-8 -*-
"""kabul_denetle.py'nin kuralları (yazan ile sınayanın ayrımı). Her kural hem geçen hem düşen durumla sınanır."""
import os, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from kabul_denetle import kurallar, icerik_denetle, kabul_dosyalari

n = hata = 0


def ok(kosul, ad):
    global n, hata
    n += 1
    if not kosul:
        hata += 1
        print("HATA", ad)


K, KOD, GOR, BELGE = "test/kabul/barkod.js", "js/besin.js", "ocr.html", "belgeler/mimari/testler.md"

# Doğru sıra: önce kabul testi, sonra kod
ok(kurallar([("a", "kabul", [K]), ("b", "kod", [KOD, BELGE])]) == [], "önce kabul sonra kod geçer")
# 1. kural: aynı commit
h = kurallar([("a", "ikisi", [K, KOD])])
ok(len(h) == 1 and "aynı commit" in h[0], "kabul ve kod aynı commit'te düşer")
ok(kurallar([("a", "kabul + belge", [K, BELGE])]) == [], "kabul ile belge aynı commit'te olabilir")
# 2. kural: koddan sonra gerekçesiz değişiklik
h = kurallar([("a", "kabul", [K]), ("b", "kod", [KOD]), ("c", "testi gevşet", [K])])
ok(len(h) == 1 and "gerekçe" in h[0], "koddan sonra gerekçesiz kabul değişikliği düşer")
ok(kurallar([("a", "kabul", [K]), ("b", "kod", [KOD]), ("c", "düzelt\n\nKabul-degisikligi: istek yanlış anlaşılmıştı, kullanıcı onayladı", [K])]) == [], "gerekçeli değişiklik geçer")
ok(len(kurallar([("a", "kabul", [K]), ("b", "kod", [KOD]), ("c", "x\n\nKabul-degisikligi:", [K])])) == 1, "boş gerekçe sayılmaz")
# 3. kural: görünen kod değişti, kabul testi yok
h = kurallar([("a", "kod", [GOR])])
ok(len(h) == 1 and "kabul testi yok" in h[0], "görünen kod kabulsüz düşer")
ok(len(kurallar([("a", "kod", ["worker/src/index.js"])])) == 1, "worker/src görünen sayılır")
ok(len(kurallar([("a", "kod", ["i18n/tr.json"])])) == 1, "çeviri metni görünen sayılır")
ok(kurallar([("a", "kod\n\nKabul-yok: yeniden yapılanma, altın çıktı 0 fark", [GOR])]) == [], "Kabul-yok gerekçesiyle geçer")
ok(kurallar([("a", "veri", ["data/e_kodlari.json", "kaynak/x.tsv"])]) == [], "yalnızca veri değişikliği kabul istemez")
ok(kurallar([("a", "belge", [BELGE, "YOL_HARITASI.md"])]) == [], "yalnızca belge kabul istemez")
ok(kurallar([]) == [], "boş PR geçer")

# 4. kural: kabul testi içeriği
iyi = "await p.getByRole('button',{name:'Barkod okut'}).click();\nawait expect(p.getByText('Bulunamadı')).toBeVisible(); // #sonuc değil\n"
ok(icerik_denetle({"test/kabul/iyi.js": iyi}) == [], "rol ve metinle seçen test geçer")
for kotu, ad in [("await p.click('#foto')", "click #id"), ("p.locator('.res')", "locator .sinif"), ("p.locator(\"[data-x]\")", "öznitelik"),
                 ("await p.evaluate(()=>IDX)", "evaluate"), ("await p.waitForFunction(()=>1)", "waitForFunction"),
                 ("document.querySelector('x')", "querySelector"), ("const {sample}=require('../arayuz/ortak.js')", "arayüz yardımcısı"),
                 ("await p.fill('#metin','x')", "fill #id")]:
    ok(len(icerik_denetle({"test/kabul/k.js": kotu})) == 1, "yasak: " + ad)

# Depodaki kabul testleri kurala uyuyor
h = icerik_denetle(kabul_dosyalari())
ok(h == [], "depodaki kabul testleri: " + "; ".join(h))

print(f"{n} denetim, {hata} hata")
sys.exit(1 if hata else 0)
