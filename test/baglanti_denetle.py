"""Kaynak bağlantı denetimi (baglanti_denetle.py, O-07): ağsız. Sınıflar ve kırık bağlantı için Wayback arşiv kopyası."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import baglanti_denetle as B

hata = 0


def bak(ad, kosul):
    global hata
    if not kosul:
        hata += 1
        print("  HATA:", ad)


# --- sınıflar
bak("404 kırık", B.sinif(404, "") == "kırık")
bak("alan adı yok kırık", B.sinif(None, "alan adı yok") == "kırık")
bak("403 şüpheli", B.sinif(403, "") == "şüpheli")
bak("zaman aşımı şüpheli", B.sinif(None, "TimeoutError") == "şüpheli")
bak("301 sağlam", B.sinif(301, "") == "sağlam")

# --- Wayback (CDX yanıtı taklit)
istenen = []
BAS = ["urlkey", "timestamp", "original", "mimetype", "statuscode", "digest", "length"]
def cdx(satirlar):
    def g(url):
        istenen.append(url)
        return satirlar
    return g

a = B.arsiv("https://ornek.org/a.htm?x=1", cdx([BAS, ["k", "20200101000000", "http://ornek.org/a.htm?x=1", "text/html", "200", "d", "1"],
                                               ["k", "20260316084828", "https://www.ornek.org/a.htm?x=1", "text/html", "200", "d", "1"]]))
bak("son kopya seçilir", a == "https://web.archive.org/web/20260316084828/https://www.ornek.org/a.htm?x=1")
bak("sorguda yalnızca 200 ve son kayıt", "statuscode%3A200" in istenen[-1] and "limit=-1" in istenen[-1])
bak("sorguda şemasız adres, sorgu dizesi korunur", "url=ornek.org%2Fa.htm%3Fx%3D1" in istenen[-1])
bak("kopya yok: boş", B.arsiv("https://ornek.org/yok", cdx([])) == "")
bak("yalnız başlık satırı: boş", B.arsiv("https://ornek.org/yok", cdx([BAS])) == "")
def patlar(url):
    raise OSError("429")
bak("sorgu hatası: None (denetim sürer)", B.arsiv("https://ornek.org/a", patlar) is None)
bak("bozuk yanıt: None", B.arsiv("https://ornek.org/a", cdx({"x": 1})) is None)
bak("metin: kopya", B.arsiv_metni("https://web.archive.org/web/1/x") == "arşiv: https://web.archive.org/web/1/x")
bak("metin: yok", B.arsiv_metni("") == "arşivde kopya yok")
bak("metin: sorgulanamadı", B.arsiv_metni(None) == "arşiv sorgulanamadı")

print("baglanti_denetle: %s" % ("tamam" if not hata else "%d HATA" % hata))
sys.exit(1 if hata else 0)
