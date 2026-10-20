"""Temizlik ansiklopedisi ülke satırı (gen_ansiklopedi.py sinif_farki, ulke.<kod> korumaları; 20.10.2026, bozma turunun bulguları)."""
import copy, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))
import gen_ansiklopedi as G

hata = 0


def bak(ad, kosul):
    global hata
    if not kosul:
        hata += 1
        print("  HATA:", ad)


F = G.sinif_farki
# Asgari sınıflandırma işareti (*) fark sayılmaz
bak("yıldız fark değil", F(["Acute Tox. 4 (Oral)*", "Eye Dam. 1"], ["Acute Tox. 4 (Oral)", "Eye Dam. 1"]) == "")
bak("sıra fark değil", F(["Eye Dam. 1", "Skin Irrit. 2"], ["Skin Irrit. 2", "Eye Dam. 1"]) == "")
# Aynı sınıf ve yol kategoride ayrılınca "yok/var" değil, kategori farkı
f = F(["Acute Tox. 3 (Inhalation)", "Acute Tox. 4 (Oral)"], ["Acute Tox. 4 (Inhalation)", "Acute Tox. 4 (Dermal)", "Acute Tox. 4 (Oral)"])
bak("yol korunur, kategori farkı: " + f, "Acute Tox. (Inhalation) AB'de 3 / burada 4" in f and "yalnızca burada: Acute Tox. 4 (Dermal)" in f
    and "yalnızca AB'de" not in f and "Oral" not in f)
f = F(["Skin Sens. 1A", "Acute Tox. 2 (Inhalation)", "EUH071"], ["Skin Sens. 1"])
bak("alt kategori ve yalnızca AB'de: " + f, "Skin Sens. AB'de 1A / burada 1" in f and "yalnızca AB'de: Acute Tox. 2 (Inhalation), EUH071" in f)

# Korumalar: üreteç geçersiz ülke satırında adıyla durur. Veri bellekte değiştirilir; kaynak/ ve data/ dosyalarına yazılmaz.
import io
K = json.load(open("kaynak/ansiklopedi_temizlik.json", encoding="utf-8"))
gercek_open = open


def dur(ad, degis, beklenen):
    d = copy.deepcopy(K)
    degis({k["id"]: k for k in d["kayitlar"]})
    G.open = lambda p, *a, **k: io.StringIO(json.dumps(d)) if str(p).endswith("ansiklopedi_temizlik.json") else gercek_open(p, *a, **k)
    try:
        G.temizlik_kayitlari({}, set())
        mesaj = "(durmadı)"
    except SystemExit as e:
        mesaj = str(e)
    finally:
        del G.open
    bak(ad + ": " + mesaj[:160], beklenen in mesaj)


dur("değişmemiş veri", lambda by: None, "(durmadı)")
dur("EDTA, AB ile yalnızca yıldız farkı", lambda by: by["64-02-8"].update(
    ulke={"TR": {"index": "607-428-00-2", "siniflar": ["Acute Tox. 4 (Oral)", "Eye Dam. 1"], "h": ["H302", "H318"]}}), "AB ile aynı")
dur("index eksik", lambda by: by["2634-33-5"]["ulke"]["TR"].pop("index"), "2634-33-5: ulke.TR eksik")
dur("sınıf başına H yok", lambda by: by["2634-33-5"]["ulke"]["TR"]["h"].pop(), "2634-33-5: ulke.TR eksik ya da tutarsız")
dur("firma maddesine ülke", lambda by: by["144-55-8"].update(ulke={"TR": {"yok": True}}), "uyumlaştırılmış değil")
dur("bilinmeyen ülke", lambda by: by["77-92-9"].update(ulke={"XX": {"yok": True}}), "ulke.XX bilinmiyor")

print("tem_ulke: %s" % ("tamam" if not hata else "%d HATA" % hata))
sys.exit(1 if hata else 0)
