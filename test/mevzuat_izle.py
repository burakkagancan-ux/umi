"""Aylık mevzuat izlemesi (mevzuat_izle.py, A-06): ağsız, taklit yanıtlarla. Fark bulunur, aynıysa sessiz, bozuk yanıt hata."""
import copy, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))
import mevzuat_izle as M

hata = 0


def bak(ad, kosul):
    global hata
    if not kosul:
        hata += 1
        print("  HATA:", ad)


def hata_verir(ad, f):
    try:
        f()
    except (M.AgHatasi, AssertionError):
        return
    bak(ad + " hata vermeliydi", False)


# --- veri dosyası
metinler = M.metinleri_oku()
celex = {m["celex"] for m in metinler}
for c in ("32008R1333", "32011R1169", "32009R1223", "32008R1272", "32004R0648"):
    bak("izlenen metinlerde " + c, c in celex)
bak("her metnin tarihi dolu", all(m["son"] for m in metinler))
sorgu = M.sparql_sorgu(sorted(celex))
bak("sorgu konsolide tabanı (0…) soruyor", '"02008R1333"' in sorgu and '"32008R1333"' not in sorgu)

# --- EUR-Lex: taklit SPARQL yanıtı
def yanit(d):
    return {"results": {"bindings": [{"base": {"value": "0" + c[1:]}, "son": {"value": "0%s-%s" % (c[1:], t.replace("-", ""))}} for c, t in d.items()]}}

ayni = {m["celex"]: m["son"] for m in metinler}
bak("aynı tarihler: fark yok", M.eurlex_farklari(metinler, M.sparql_coz(yanit(ayni))) == [])
yeni = dict(ayni, **{"32008R1333": "2099-01-01"})
f = M.eurlex_farklari(metinler, M.sparql_coz(yanit(yeni)))
bak("yeni konsolide sürüm bulunur", len(f) == 1 and f[0]["celex"] == "32008R1333" and f[0]["yeni"] == "2099-01-01")
bak("bağlantı konsolide sürüme", f and f[0]["kons"] == "02008R1333-20990101")
eski = dict(ayni, **{"32008R1333": "2000-01-01"})
bak("eski tarih fark sayılmaz", M.eurlex_farklari(metinler, M.sparql_coz(yanit(eski))) == [])
eksik = {k: v for k, v in ayni.items() if k != "32011R1169"}
hata_verir("sorgu bir metni döndürmezse", lambda: M.eurlex_farklari(metinler, M.sparql_coz(yanit(eksik))))
hata_verir("bindings yoksa", lambda: M.sparql_coz({"head": {}}))
hata_verir("tanınmayan CELEX", lambda: M.sparql_coz({"results": {"bindings": [{"son": {"value": "32008R1333"}}]}}))

# --- ECHA: taklit sınıflandırma listesi
kayitlar = json.load(open("kaynak/ansiklopedi_temizlik.json", encoding="utf-8"))["kayitlar"]
bak("30 madde", len(kayitlar) == 30)
bak("her maddede ECHA kimliği", all(k.get("echa") for k in kayitlar))
har = next(k for k in kayitlar if k["clp"]["tur"] == "harmonize")
firma = next(k for k in kayitlar if k["clp"]["tur"] == "firma")
c = har["clp"]
oge = {"indexNumber": c["index"], "atpCodeName": c["atp"], "celexNumber": c["celex"], "effectiveDate": c["tarih"], "dataSource": "CLP Annex VI"}
bak("uyumlaştırılmış, aynı: fark yok", M.echa_farki(har, {"items": [oge]}) is None)
bak("yeni ATP bulunur", "ATP99" in (M.echa_farki(har, {"items": [dict(oge, atpCodeName="ATP99", celexNumber="32099R0001")]}) or ""))
bak("yürürlük tarihi değişti", M.echa_farki(har, {"items": [dict(oge, effectiveDate="01-01-2099")]}) is not None)
bak("dizin kalktı", "listede değil" in (M.echa_farki(har, {"items": []}) or ""))
bak("firma, liste boş: fark yok", M.echa_farki(firma, {"items": []}) is None)
bak("firma maddesine uyumlaştırılmış sınıf geldi", "artık" in (M.echa_farki(firma, {"items": [oge]}) or ""))
hata_verir("ECHA yanıtında items yok", lambda: M.echa_farki(har, {"hata": 1}))

# firma: öne çıkan sanayi bildirimi (sınıflar ve oran)
fc = firma["clp"]
def bildirim(yuzde=fc["yuzde"], one=True, kaynak="REACH Joint"):
    return {"items": [{"classificationId": "9", "isProminentFlag": False, "substanceNotificationPercentage": 5.0},
                      {"classificationId": "1", "isProminentFlag": one, "dataSource": kaynak, "substanceNotificationPercentage": yuzde}]}
def sinif_getir(siniflar):
    def g(url, zaman=0):
        bak("ayrıntı öne çıkan bildirimden", url.endswith("/classification/1"))
        return {"items": [{"hazardClassAndCategoryCode": x} for x in siniflar]}
    return g
bak("firma, aynı: fark yok", M.firma_farki(firma, bildirim(), sinif_getir(fc["siniflar"])) is None)
bak("firma, sıra farklı: fark yok", M.firma_farki(firma, bildirim(), sinif_getir(list(reversed(fc["siniflar"])))) is None)
bak("firma, küçük oran kayması: fark yok", M.firma_farki(firma, bildirim(fc["yuzde"] + 0.04), sinif_getir(fc["siniflar"])) is None)
bak("firma, oran eşik kadar kaydı", "oran" in (M.firma_farki(firma, bildirim(fc["yuzde"] - M.ORAN_ESIK), sinif_getir(fc["siniflar"])) or ""))
bak("firma, yeni sınıf", "Carc. 2" in (M.firma_farki(firma, bildirim(), sinif_getir(fc["siniflar"] + ["Carc. 2"])) or ""))
bak("firma, sınıf kalktı", "→ yok" in (M.firma_farki(firma, bildirim(), sinif_getir([])) or "") or not fc["siniflar"])
bak("firma, fark metninde kaynak", "CLP Submission" in (M.firma_farki(firma, bildirim(kaynak="CLP Submission"), sinif_getir(["Carc. 2"])) or ""))
bak("firma, öne çıkan bildirim yok", "öne çıkan" in (M.firma_farki(firma, bildirim(one=False), sinif_getir([])) or ""))
hata_verir("bildirim yanıtında items yok", lambda: M.firma_farki(firma, {"x": 1}, sinif_getir([])))
hata_verir("bildirimde oran yok", lambda: M.firma_farki(firma, {"items": [{"classificationId": "1", "isProminentFlag": True}]}, sinif_getir([])))

# echa_farklari taklit getiriciyle bütün liste (ağsız): her madde kendi kaydıyla aynı → fark yok
M.time.sleep = lambda s: None
def taklit_ile(kayitlar):
    def taklit(url, zaman=0):
        if "/industry/classification/" in url:
            k = next(k for k in kayitlar if url.endswith("/" + k["echa"]))
            return {"items": [{"hazardClassAndCategoryCode": x} for x in k["clp"]["siniflar"]]}
        k = next(k for k in kayitlar if ("/%s/" % k["echa"]) in url)
        c = k["clp"]
        if "/industry/" in url:
            return {"items": [{"classificationId": k["echa"], "isProminentFlag": True, "dataSource": "REACH Joint",
                               "substanceNotificationPercentage": c["yuzde"]}]}
        if c["tur"] == "firma":
            return {"items": []}
        return {"items": [{"indexNumber": c["index"], "atpCodeName": c["atp"], "celexNumber": c["celex"], "effectiveDate": c["tarih"]}]}
    return taklit
taklit = taklit_ile(kayitlar)
bak("30 madde taklit yanıtla: fark yok", M.echa_farklari(kayitlar, taklit) == [])
bozuk = copy.deepcopy(kayitlar)
bozuk[0]["clp"]["atp"] = "ATP00"
bak("30 madde, biri farklı: tek fark", len(M.echa_farklari(bozuk, taklit)) == 1)
oranli = copy.deepcopy(kayitlar)
i = next(i for i, k in enumerate(oranli) if k["clp"]["tur"] == "firma")
oranli[i]["clp"]["yuzde"] += 10
f2 = M.echa_farklari(oranli, taklit_ile(kayitlar))
bak("30 madde, bir firma oranı kaydı: tek fark", len(f2) == 1 and f2[0]["cas"] == oranli[i]["id"] and "oran" in f2[0]["fark"])

# --- rapor
r = M.rapor(f, [{"cas": "1-1-1", "ad": "X", "echa": "100.0", "fark": "dizin d: a → b"}], "2099-01")
bak("raporda eski → yeni ve bağlantı", "→ 2099-01-01" in r and "CELEX:02008R1333-20990101" in r)
bak("raporda ne yapılmalı", r.count("Ne yapılmalı") == 2 and "mevzuat_izleme.tsv" in r)
bak("raporda ay", "2099-01" in r)

print("mevzuat_izle: %s" % ("tamam" if not hata else "%d HATA" % hata))
sys.exit(1 if hata else 0)
