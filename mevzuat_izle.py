# -*- coding: utf-8 -*-
"""
Aylık mevzuat izlemesi (A-06): uygulamanın dayandığı kaynaklarda yeni bir değişiklik var mı?

İki ayak:
  EUR-Lex  kaynak/mevzuat_izleme.tsv'deki her AB metninin en yeni konsolide sürüm tarihi (CELLAR SPARQL uç noktası,
           publications.europa.eu; tek sorgu). Dosyadakinden yeniyse fark.
  ECHA     kaynak/ansiklopedi_temizlik.json'daki 30 maddenin CLP Ek VI uyumlaştırılmış sınıflandırması (ECHA CHEM'in
           C&L envanteri servisi; maddeyi ilk alırken kullanılanla aynı veri). Dizin no, ATP, CELEX ya da yürürlük
           tarihi değiştiyse, kayıt kalktıysa ya da sınıfı olmayan ('firma') maddeye uyumlaştırılmış sınıf geldiyse fark.
           H kodlarının kendisi ayrıca karşılaştırılmaz: Ek VI'daki her değişiklik yeni bir ATP (CELEX) ile gelir.

Resmî Gazete izlenmez (makine okunur akış yok; belgeler/mimari/veri_uretimi.md "Mevzuat izleme").

Kullanım:
  python3 mevzuat_izle.py                  # denetler, sonucu ekrana yazar
  python3 mevzuat_izle.py --rapor r.md     # fark varsa sorun (issue) gövdesini Markdown olarak da yazar
Çıkış kodu: 0 fark yok, 1 fark var, 2 ağ ya da yanıt hatası (iş kırmızı olur, sorun açılmaz).
Veri dosyalarını değiştirmez; fark okunup veriye işlendikten sonra tarih elle güncellenir.
"""
import argparse, json, os, re, ssl, sys, time
import urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UA = "Mozilla/5.0 (tagsis mevzuat izleme; https://github.com/burakkagancan-ux/umi)"
SPARQL = "https://publications.europa.eu/webapi/rdf/sparql"
ECHA = "https://chem.echa.europa.eu/api-cnl-inventory/harmonized/%s/classifications"
EURLEX = "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:%s"
CELEX_RE = re.compile(r"^3(\d{4}[RLD]\d{4})$")
try:  # python.org kurulumunda sistem sertifikaları yok; certifi varsa onu kullan
    import certifi
    SSL = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL = ssl.create_default_context()


class AgHatasi(Exception):
    pass


def getir(url, kabul="application/json", zaman=120):
    """JSON yanıtı; iki denemede de olmazsa AgHatasi"""
    son = None
    for deneme in range(2):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": kabul})
            with urllib.request.urlopen(req, timeout=zaman, context=SSL) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, OSError, ValueError) as e:
            son = e
            time.sleep(3)
    raise AgHatasi("%s: %s" % (url.split("?")[0], son))


# ---------- EUR-Lex ----------

def metinleri_oku(yol=os.path.join(HERE, "kaynak", "mevzuat_izleme.tsv")):
    """[{celex, ad, son, kullanim}]; biçim hatası AssertionError"""
    out = []
    with open(yol, encoding="utf-8") as f:
        for n, ln in enumerate(f, 1):
            if not ln.strip() or ln.startswith("#"):
                continue
            p = ln.rstrip("\n").split("\t")
            assert len(p) == 4, "mevzuat_izleme.tsv satır %d: 4 sütun olmalı" % n
            assert CELEX_RE.match(p[0]), "mevzuat_izleme.tsv satır %d: CELEX biçimi 3YYYY[RLD]NNNN" % n
            assert p[2] == "" or re.match(r"^\d{4}-\d{2}-\d{2}$", p[2]), "mevzuat_izleme.tsv satır %d: tarih YYYY-AA-GG" % n
            out.append({"celex": p[0], "ad": p[1], "son": p[2], "kullanim": p[3]})
    assert len({m["celex"] for m in out}) == len(out), "mevzuat_izleme.tsv: aynı CELEX iki kez"
    return out


def sparql_sorgu(celexler):
    """Her temel metnin en yeni konsolide sürümünün CELEX'i (0YYYY…-YYYYAAGG). Konsolide sürüm CELEX'i 0 ile başlar."""
    tabanlar = " ".join('"0%s"' % CELEX_RE.match(c).group(1) for c in celexler)
    return ("PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>\n"
            "SELECT ?base (MAX(STR(?celex)) AS ?son) WHERE {\n"
            " VALUES ?base { %s }\n"
            " ?w cdm:resource_legal_id_celex ?celex .\n"
            ' FILTER(STRSTARTS(STR(?celex), CONCAT(?base, "-")))\n'
            "} GROUP BY ?base" % tabanlar)


def sparql_coz(yanit):
    """SPARQL JSON yanıtı → {'3YYYY…': 'YYYY-AA-GG'}; beklenmedik biçim AgHatasi"""
    try:
        satirlar = yanit["results"]["bindings"]
    except (KeyError, TypeError):
        raise AgHatasi("SPARQL yanıtında results.bindings yok")
    out = {}
    for s in satirlar:
        m = re.match(r"^0(\d{4}[RLD]\d{4})-(\d{4})(\d{2})(\d{2})$", s.get("son", {}).get("value", ""))
        if not m:
            raise AgHatasi("SPARQL yanıtında tanınmayan konsolide CELEX: %r" % s)
        out["3" + m.group(1)] = "%s-%s-%s" % m.group(2, 3, 4)
    return out


def eurlex_farklari(metinler, guncel):
    """Dosyadakinden yeni konsolide sürüm → [{celex, ad, eski, yeni, kons}]. Sorgu bir metni hiç döndürmezse
    (ve dosyada tarih varsa) bu bir sorun: sorgu bozulmuş olabilir, sessizce 'değişiklik yok' denmez."""
    fark = []
    for m in metinler:
        yeni = guncel.get(m["celex"], "")
        if not yeni:
            if m["son"]:
                raise AgHatasi("EUR-Lex %s için konsolide sürüm döndürmedi (dosyada %s)" % (m["celex"], m["son"]))
            continue
        if yeni > m["son"]:
            fark.append({"celex": m["celex"], "ad": m["ad"], "eski": m["son"] or "yok", "yeni": yeni,
                         "kons": "0%s-%s" % (m["celex"][1:], yeni.replace("-", ""))})
    return fark


# ---------- ECHA ----------

def echa_farki(kayit, yanit):
    """Bir temizlik maddesinin depodaki `clp` alanı ile ECHA'nın uyumlaştırılmış sınıflandırma listesi → fark metni ya da None"""
    try:
        ogeler = [o for o in yanit["items"] if o.get("dataSource", "CLP Annex VI") == "CLP Annex VI"]
    except (KeyError, TypeError):
        raise AgHatasi("ECHA yanıtında items yok (%s)" % kayit["id"])
    c = kayit["clp"]
    if c["tur"] == "firma":
        if ogeler:
            o = ogeler[0]
            return "artık uyumlaştırılmış sınıfı var: dizin %s, %s (%s), yürürlük %s" % (
                o.get("indexNumber"), o.get("atpCodeName"), o.get("celexNumber"), o.get("effectiveDate"))
        return None
    es = [o for o in ogeler if o.get("indexNumber") == c["index"]]
    if not es:
        simdi = ", ".join("%s %s" % (o.get("indexNumber"), o.get("atpCodeName")) for o in ogeler) or "kayıt yok"
        return "dizin %s artık listede değil (ECHA: %s)" % (c["index"], simdi)
    o = es[0]
    eski = (c["atp"], c["celex"], c["tarih"])
    yeni = (o.get("atpCodeName"), o.get("celexNumber"), o.get("effectiveDate"))
    if eski != yeni:
        return "dizin %s: %s (%s, %s) → %s (%s, %s)" % ((c["index"],) + eski + yeni)
    return None


def echa_farklari(kayitlar, getirici=getir):
    out = []
    for k in kayitlar:
        f = echa_farki(k, getirici(ECHA % k["echa"], zaman=60))
        if f:
            out.append({"cas": k["id"], "ad": k["ad"], "echa": k["echa"], "fark": f})
        time.sleep(0.3)
    return out


# ---------- rapor ----------

def rapor(ef, cf, ay):
    s = ["Aylık mevzuat izlemesi (`mevzuat_izle.py`, %s) bir değişiklik buldu. Veri dosyaları kendiliğinden güncellenmedi." % ay, ""]
    if ef:
        s += ["## EUR-Lex: yeni konsolide sürüm", "", "| Metin | Eski → yeni | EUR-Lex |", "|---|---|---|"]
        s += ["| %s (%s) | %s → %s | %s |" % (f["ad"], f["celex"], f["eski"], f["yeni"], EURLEX % f["kons"]) for f in ef]
        s += ["", "**Ne yapılmalı:** konsolide metnin başındaki değiştiren tüzükler listesinden yeni geleni bul; uygulamanın kullandığı "
              "kısma (bkz. `kaynak/mevzuat_izleme.tsv` son sütun) dokunuyorsa veriyi güncelle, bir maddenin rengi değişirse "
              "`kaynak/degisiklik_kaydi.tsv`'ye yaz (O-05). Sonra `kaynak/mevzuat_izleme.tsv`'deki tarihi yeni tarihle değiştir. "
              "Kozmetikte (1223/2009) CosIng iş akışı ayrıca PR açar.", ""]
    if cf:
        s += ["## ECHA: CLP Ek VI uyumlaştırılmış sınıf değişti (temizlik ansiklopedisi)", "", "| Madde (CAS) | Değişiklik | ECHA |", "|---|---|---|"]
        s += ["| %s (%s) | %s | https://chem.echa.europa.eu/%s/overview |" % (f["ad"], f["cas"], f["fark"], f["echa"]) for f in cf]
        s += ["", "**Ne yapılmalı:** maddenin ECHA sayfasındaki yeni sınıfları ve H/EUH kodlarını `kaynak/ansiklopedi_temizlik.json` "
              "`clp` alanına işle, İngilizce satırları (`kaynak/ansiklopedi_en.json`) yenile, `python3 uret.py`; renk değişirse O-05 kaydı. "
              "Türkiye SEA Ek-6'nın bu ATP'yi alıp almadığını ayrıca belirt (TEKNIK_BORC Temizlik (3)).", ""]
    s += ["Resmî Gazete otomatik izlenmiyor; elle bakılır (belgeler/mimari/veri_uretimi.md)."]
    return "\n".join(s) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rapor")
    a = ap.parse_args()
    metinler = metinleri_oku()
    kayitlar = json.load(open(os.path.join(HERE, "kaynak", "ansiklopedi_temizlik.json"), encoding="utf-8"))["kayitlar"]
    try:
        guncel = sparql_coz(getir(SPARQL + "?" + urllib.parse.urlencode(
            {"query": sparql_sorgu([m["celex"] for m in metinler])}), kabul="application/sparql-results+json"))
        print("EUR-Lex (en yeni konsolide sürüm):")
        for m in metinler:
            print("  %-11s %-55s dosya %-10s EUR-Lex %s" % (m["celex"], m["ad"][:55], m["son"] or "-", guncel.get(m["celex"], "-")))
        ef = eurlex_farklari(metinler, guncel)
        cf = echa_farklari(kayitlar)
    except AgHatasi as e:
        print("HATA (ağ ya da yanıt):", e, file=sys.stderr)
        return 2
    print("ECHA: %d madde denetlendi (%d uyumlaştırılmış, %d firma bildirimi)" % (
        len(kayitlar), sum(k["clp"]["tur"] == "harmonize" for k in kayitlar), sum(k["clp"]["tur"] == "firma" for k in kayitlar)))
    for f in ef:
        print("  DEĞİŞTİ EUR-Lex %s %s: %s → %s" % (f["celex"], f["ad"], f["eski"], f["yeni"]))
    for f in cf:
        print("  DEĞİŞTİ ECHA %s %s: %s" % (f["cas"], f["ad"], f["fark"]))
    if not ef and not cf:
        print("Değişiklik yok.")
        return 0
    if a.rapor:
        with open(a.rapor, "w", encoding="utf-8") as f:
            f.write(rapor(ef, cf, time.strftime("%Y-%m")))
    print("%d EUR-Lex, %d ECHA değişikliği." % (len(ef), len(cf)))
    return 1


if __name__ == "__main__":
    sys.exit(main())
