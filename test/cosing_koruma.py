"""cosing_al.py indirme koruması (ağsız): servis INCI adlarının bir kısmını döndürmezse yeniden indirip birleştirir,
birleşimde de %0,5'ten fazla ad düşüyorsa dosya yazmadan durur; --zorla korumayı atlar.
İndirme (cosing_al.fetch) taklit edilir, çıktı geçici bir klasöre yazılır; depodaki kaynak/cosing/ değişmez."""
import contextlib, csv, io, os, shutil, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import cosing_al

N = 1000
ADLAR = ["AD %04d" % i for i in range(N)]
hata = 0


def kayit(ad, islev="EMOLLIENT", ref=None):
    return {"inciName": [ad], "functionName": [islev], "substanceId": [str(1000 + ADLAR.index(ad)) if ad in ADLAR else "9"],
            "reference": [ref or ad]}


SUB = [{"annexNo": ["II"], "refNo": ["1"], "inciName": ["X"], "publicationDate": ["2026-10-01T00:00:00"],
        "reference": ["s1"]}]


def kur(onceki):
    """Geçici çıktı klasörü; onceki adlarla bir ingredients.csv yazar (None: dosya yok, ilk indirme)."""
    d = tempfile.mkdtemp()
    cosing_al.OUT = d
    if onceki is not None:
        with open(os.path.join(d, "ingredients.csv"), "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(cosing_al.ING_COLS)
            w.writerows([n, "", "EMOLLIENT", "1"] for n in sorted(onceki))
    return d


def calistir(indirmeler, argv=()):
    """indirmeler: sırayla dönecek ingredient yanıtları. (çıkış kodu, ingredient çağrı sayısı, stderr) döndürür."""
    sira = list(indirmeler)
    sayac = {"ingredient": 0}

    def sahte(tur):
        if tur == "substance":
            return SUB
        sayac["ingredient"] += 1
        return sira.pop(0)
    cosing_al.fetch = sahte
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        kod = cosing_al.main(list(argv))
    return kod or 0, sayac["ingredient"], err.getvalue()


def adlar(d, fn):
    p = os.path.join(d, fn)
    return {r["inci_name"]: r for r in csv.DictReader(open(p, encoding="utf-8"))} if os.path.exists(p) else {}


def bekle(ad, kosul):
    global hata
    print(("  tamam: " if kosul else "  HATA: ") + ad)
    hata += 0 if kosul else 1


tam = [kayit(n) for n in ADLAR]
eksik10 = [kayit(n) for n in ADLAR[10:]]     # %1 düşüş (eşik %0,5)
eksik5 = [kayit(n) for n in ADLAR[5:]]       # %0,5: eşik aşılmıyor (5 > 5 değil)
eksik6 = [kayit(n) for n in ADLAR[6:]]       # %0,6: eşik aşılıyor

# 1. Eşik altı (%0,5): tek indirme, yazılır, düşen 5 ad eskiye geçer
d = kur(ADLAR)
kod, n, _ = calistir([eksik5])
bekle("eşik altında tek indirme yapılır ve yazılır", kod == 0 and n == 1 and len(adlar(d, "ingredients.csv")) == N - 5
      and set(adlar(d, "ingredients_eski.csv")) == set(ADLAR[:5]))
shutil.rmtree(d)

# 2. Eşik aşılır, ikinci indirme eksikleri getirir: birleşim yazılır, eskiye kayan yok
d = kur(ADLAR)
ikinci = [kayit(n) for n in ADLAR[:500]]   # ikinci indirme de eksik ama farklı yerden
kod, n, _ = calistir([eksik10, ikinci])
bekle("eşik aşılınca bir kez daha indirilir ve birleşim yazılır", kod == 0 and n == 2
      and len(adlar(d, "ingredients.csv")) == N and not adlar(d, "ingredients_eski.csv"))
shutil.rmtree(d)

# 3. Aynı ad iki indirmede farklıysa ikincisi kullanılır
d = kur(ADLAR)
ikinci = [kayit(ADLAR[i], "HUMECTANT" if i == 0 else "EMOLLIENT") for i in range(10)]
kod, n, _ = calistir([[kayit(n) for n in ADLAR[:1] + ADLAR[10:]], ikinci])
bekle("aynı ad iki indirmede farklıysa ikincisi", kod == 0 and adlar(d, "ingredients.csv")[ADLAR[0]]["functions"] == "HUMECTANT")
shutil.rmtree(d)

# 4. Birleşimde de eşik aşılıyor: dosya yazılmaz, sıfır olmayan çıkış, örnek adlar basılır
d = kur(ADLAR)
once = open(os.path.join(d, "ingredients.csv"), encoding="utf-8").read()
kod, n, err = calistir([eksik6, eksik6])
bekle("birleşimde de düşüş varsa sıfır olmayan çıkış kodu", kod == cosing_al.DUR_KODU and kod != 0 and n == 2)
bekle("durunca ingredients.csv değişmez", open(os.path.join(d, "ingredients.csv"), encoding="utf-8").read() == once)
bekle("durunca başka dosya yazılmaz", sorted(os.listdir(d)) == ["ingredients.csv"])
bekle("düşen adlardan örnek basılır", ADLAR[0] in err and ADLAR[5] in err and "--zorla" in err)
shutil.rmtree(d)

# 5. --zorla: düşüş kabul edilir, düşen adlar eskiye geçer
d = kur(ADLAR)
kod, n, _ = calistir([eksik10, eksik10], ["--zorla"])
bekle("--zorla ile yazılır", kod == 0 and len(adlar(d, "ingredients.csv")) == N - 10
      and set(adlar(d, "ingredients_eski.csv")) == set(ADLAR[:10]))
shutil.rmtree(d)

# 6. İlk indirme (önceki dosya yok): karşılaştırma yok, tek indirme
d = kur(None)
kod, n, _ = calistir([eksik10])
bekle("önceki dosya yoksa koruma devreye girmez", kod == 0 and n == 1 and len(adlar(d, "ingredients.csv")) == N - 10)
shutil.rmtree(d)

print("cosing indirme koruması: %d hata" % hata)
sys.exit(1 if hata else 0)
