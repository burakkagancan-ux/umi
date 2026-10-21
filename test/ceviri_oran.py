"""B-03 (21.10.2026): İngilizce dört ailede eksiksiz (ceviri_oran.py --denetle); denetim eksik ve bayat metni gerçekten yakalıyor mu."""
import io, os, sys, contextlib
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import ceviri_oran as C

hata = 0


def bak(ad, kosul):
    global hata
    if not kosul:
        hata += 1
        print("  HATA:", ad)


out = io.StringIO()
with contextlib.redirect_stdout(out):
    n = C.denetle("en")
bak("İngilizce dört ailede eksiksiz:\n" + out.getvalue(), n == 0)

# Bozarak sınama: Türkçeye İngilizcesi olmayan yeni metin eklenince her ailede yakalanır
asil_oku, asil_tr = C.oku, C.ceviri_kaynak.tr_metinler
try:
    def oku_ek(*p):
        d = asil_oku(*p)
        if p == ("i18n", "tr.json"):
            d = dict(d, **{"deneme.yeni_anahtar": "Yeni metin"})
        if p == ("data", "ansiklopedi_tr.json"):
            d = dict(d, t=dict(d["t"], **{"deneme.ozet": "Yeni özet"}))
        return d
    C.oku = oku_ek
    C.ceviri_kaynak.tr_metinler = lambda: dict(asil_tr(), **{"e.E999.reason": "Yeni gerekçe, henüz çevrilmedi"})
    e = C.dil_eksikleri("en")
    bak("yeni arayüz anahtarı yakalanır", "deneme.yeni_anahtar" in e["arayüz"])
    bak("yeni veri metni yakalanır", "e.E999.reason" in e["veri"])
    bak("yeni ansiklopedi dizin metni yakalanır", "deneme.ozet" in e["ansiklopedi dizini"])
    with contextlib.redirect_stdout(io.StringIO()):
        bak("denetim hata sayar", C.denetle("en") == 3)
finally:
    C.oku, C.ceviri_kaynak.tr_metinler = asil_oku, asil_tr
bak("kaynak başlıkları sayılmaz", C.eksik({"kaynak.abc": "X", "_m": "Y", "a": "Z"}, {}) == ["a"])
bak("veri metninde 'metin:' yolu çeviri sayılır", C.eksik({"b.x.not": "Kısa"}, {"metin:Kısa": "Short"}, True) == [])

print("ceviri_oran: %s" % ("tüm testler geçti" if not hata else "%d hata" % hata))
sys.exit(1 if hata else 0)
