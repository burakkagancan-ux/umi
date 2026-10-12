# -*- coding: utf-8 -*-
"""
Uygulamanın gösterdiği kaynak bağlantılarını (data/ altındaki bütün JSON dosyaları) tek tek açıp denetler (O-07).

Kullanım:
  python3 baglanti_denetle.py                 # denetler, özeti ekrana yazar
  python3 baglanti_denetle.py --rapor r.md    # raporu Markdown olarak da yazar (aylık iş bunu sorun olarak açar)
  python3 baglanti_denetle.py --en-cok 20     # yalnızca ilk 20 bağlantı (deneme için)

Sınıflar:
  kırık     404/410 ya da alan adı yok; iki denemede de. Düzeltilmesi gerekir.
  şüpheli   403, 429, 5xx, zaman aşımı, bağlantı hatası. Çoğu sitenin bot engeli (EUR-Lex, Wiley/EFSA Journal);
            elle bakılır, kendiliğinden kırık sayılmaz.
  sağlam    2xx/3xx (yönlendirmeler izlenir).
Çıkış kodu: kırık varsa 1, yoksa 0.
"""
import argparse, concurrent.futures, glob, json, os, re, socket, ssl, sys, time
import urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
URL_RE = re.compile(r'https?://[^\s"<>\\]+')
UA = "Mozilla/5.0 (tagsis kaynak denetimi; https://github.com/burakkagancan-ux/tagsis)"
ZAMAN = 30
KIRIK_KOD = {404, 410}
try:  # python.org kurulumunda sistem sertifikaları yok; certifi varsa onu kullan
    import certifi
    SSL = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL = ssl.create_default_context()
# Her sunucuya sırayla, aralarında bekleyerek gidilir (eCFR gibi siteler hızlı istekte 429 döner)
BEKLE = 1.5


def bul():
    """{bağlantı: [nerede, ...]}; nerede = 'dosya › anahtar yolu'."""
    yer = {}

    def gez(x, yol, dosya):
        if isinstance(x, dict):
            for k, v in x.items():
                gez(v, yol + [str(k)], dosya)
        elif isinstance(x, list):
            for i, v in enumerate(x):
                gez(v, yol + [str(i)], dosya)
        elif isinstance(x, str):
            for u in URL_RE.findall(x):
                u = u.rstrip(".,;)")
                yer.setdefault(u, []).append(dosya + " › " + ".".join(yol[:3]))

    for f in sorted(glob.glob(os.path.join(HERE, "data", "**", "*.json"), recursive=True)):
        with open(f, encoding="utf-8") as fh:
            gez(json.load(fh), [], os.path.relpath(f, HERE))
    return yer


def ac(url):
    """(durum kodu ya da None, hata metni)."""
    ctx = SSL
    for yontem in ("HEAD", "GET"):
        req = urllib.request.Request(url, method=yontem, headers={"User-Agent": UA, "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=ZAMAN, context=ctx) as r:
                return r.status, ""
        except urllib.error.HTTPError as e:
            # Bazı sunucular HEAD'i desteklemez (405/403/404 döner); GET ile yeniden denenir
            if yontem == "HEAD":
                continue
            return e.code, ""
        except urllib.error.URLError as e:
            if isinstance(e.reason, socket.gaierror):
                return None, "alan adı yok"
            if yontem == "HEAD":
                continue
            return None, str(e.reason)[:80]
        except Exception as e:  # zaman aşımı, bağlantı kopması
            if yontem == "HEAD":
                continue
            return None, type(e).__name__
    return None, "yanıt yok"


def sinif(kod, hata):
    if hata == "alan adı yok" or kod in KIRIK_KOD:
        return "kırık"
    if kod is not None and kod < 400:
        return "sağlam"
    return "şüpheli"


def denetle(url):
    kod, hata = ac(url)
    if sinif(kod, hata) == "kırık":
        # Geçici hatayı kırık saymamak için bir kez daha
        time.sleep(5)
        kod, hata = ac(url)
    return url, kod, hata, sinif(kod, hata)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rapor")
    ap.add_argument("--en-cok", type=int)
    a = ap.parse_args()

    yer = bul()
    urls = sorted(yer)[: a.en_cok] if a.en_cok else sorted(yer)
    # Sunucuya göre grupla; her sunucu kendi sırasında, sunucular paralel
    gruplar = {}
    for u in urls:
        gruplar.setdefault(u.split("/")[2].lower(), []).append(u)

    def sunucu(liste):
        out = []
        for u in liste:
            out.append(denetle(u))
            time.sleep(BEKLE)
        return out

    sonuc = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        isler = [ex.submit(sunucu, liste) for liste in gruplar.values()]
        for f in isler:
            sonuc.extend(f.result())

    say = {"sağlam": 0, "şüpheli": 0, "kırık": 0}
    for _, _, _, s in sonuc:
        say[s] += 1
    ozet = "%d bağlantı: %d sağlam, %d şüpheli, %d kırık" % (len(sonuc), say["sağlam"], say["şüpheli"], say["kırık"])
    print(ozet)

    satir = ["# Kaynak bağlantı denetimi", "", ozet + " (" + time.strftime("%d.%m.%Y") + ").", ""]
    for s, baslik in (("kırık", "Kırık (düzeltilmeli)"), ("şüpheli", "Şüpheli (elle bakılmalı; çoğu bot engeli)")):
        liste = sorted((r for r in sonuc if r[3] == s), key=lambda r: r[0])
        if not liste:
            continue
        satir += ["## " + baslik + " (%d)" % len(liste), ""]
        # Şüphelileri sunucuya göre özetle; tek tek listelemek raporu boğar
        if s == "şüpheli":
            sunucular = {}
            for u, kod, hata, _ in liste:
                sunucular.setdefault((u.split("/")[2], kod or hata), []).append(u)
            for (sv, neden), us in sorted(sunucular.items(), key=lambda x: -len(x[1])):
                satir.append("- %s — %s — %d bağlantı (ör. %s)" % (sv, neden, len(us), us[0]))
        else:
            for u, kod, hata, _ in liste:
                nerede = yer[u]
                satir.append("- %s — %s — %s%s" % (u, kod or hata, nerede[0],
                                                   " (+%d yer)" % (len(nerede) - 1) if len(nerede) > 1 else ""))
                print("KIRIK", kod or hata, u)
        satir.append("")
    if a.rapor:
        with open(a.rapor, "w", encoding="utf-8") as fh:
            fh.write("\n".join(satir))
    sys.exit(1 if say["kırık"] else 0)


if __name__ == "__main__":
    main()
