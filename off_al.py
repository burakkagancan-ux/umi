# -*- coding: utf-8 -*-
"""
Open Food Facts ailesinden (gıda, kozmetik, temizlik) Türkiye'de satılan ürünlerin barkod, ad, marka,
içerik metnini ve (gıdada) besin değerlerini depoya (kaynak/off/) alır. Barkodla ürün bulmada ilk bakılan yer budur (internetsiz çalışır).

Kaynaklar (lisans: Open Database License (ODbL) 1.0, içerik: Database Contents License; atıf zorunlu):
  gıda      Open Food Facts      search.openfoodfacts.org (ürün listesi) + world.openfoodfacts.org/api/v2/product
  kozmetik  Open Beauty Facts    world.openbeautyfacts.org/api/v2/search + /api/v2/product
  temizlik  Open Products Facts  world.openproductsfacts.org/api/v2/search + /api/v2/product

Kullanım:
  python3 off_al.py            # indirir, kaynak/off/urunler.json yazar
  python3 off_al.py --kategori # yalnızca gıda kategorilerini yeniler (A-08 ürün tipi; birkaç dakika)
Sonra: python3 gen_barkod.py

Kurallar: kendine özgü User-Agent; arama sorguları arasında 6,5 sn (OFF arama sınırı dakikada 10). 429, 401, 403 ve 503 yanıtında
uzun bekleme: OFF çok sorgudan sonra IP'yi bir süre 401 ile de kısıtlıyor (09.10.2026: gıdanın ~3.300 ürün sorgusundan sonra
Open Beauty Facts araması 401 verdi, birkaç saat sonra düzeldi).
Bir veritabanı hiç alınamazsa betik çökmez: o veritabanı için önceki urunler.json'daki kayıtlar korunur, diğerlerinin yeni verisi
yazılır ve sayımda "hata" alanı görünür; çıkış kodu 1 olur (aylık iş PR açmaz, elde edilen veri yerelde kalır).
Ad, marka ve içerik metni klasik arama sonuçlarından gelir (sayfa başına 100 ürün). Gıdada klasik arama 503 verirse yedek yol:
yeni arama servisi (search-a-licious; daha az ürün dizinli) + içerik listesi olan ürünler için tek tek ürün sorgusu (yavaş).
Besin değerleri (A-02, 13.10.2026): OFF'un 100 g / 100 ml'ye çevrilmiş alanları (nutriments.*_100g). Enerji kcal yoksa kJ / 4,184;
tuz yoksa sodyum x 2,5 (AB 1169/2011 Ek I, 11). Tutarlılık burada denetlenmez: uygulama aynı denetimi (js/besin.js) her kaynağa uygular.
Bu veri bizim kullanıcı katkısı veritabanımızla (Worker D1) KARIŞTIRILMAZ (ODbL "aynı lisansla paylaş" kuralı).
"""
import datetime, json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "kaynak", "off")
UA = "Umi/1.0 (https://github.com/burakkagancan-ux/umi; barkod verisi, ayda bir)"
BEKLE_ARAMA = 6.5   # saniye; OFF arama sınırı dakikada 10 sorgu
BEKLE = 1.5   # saniye; OFF ürün sorgusu sınırı dakikada 100 (paylaşılan IP'lerde daha düşük olabiliyor)
DBS = [   # (kısa ad, alan adı)
    ("food", "world.openfoodfacts.org"),
    ("beauty", "world.openbeautyfacts.org"),
    ("products", "world.openproductsfacts.org"),
]
ALAN = "code,product_name,product_name_tr,product_name_en,brands,lang,last_modified_t,ingredients_text,nutriments,quantity,categories_tags"
DILLER = ["tr", "en", "de", "fr", "nl", "ar", "ru", "es", "it"]   # içerik metni alınan diller (ürünün kendi dili ayrıca)


YAVASLA = (401, 403, 429, 503)   # OFF'un "yavaşla" yanıtları: uzun bekleme


def get(url, deneme=5):
    for i in range(deneme):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            kod = getattr(e, "code", None)
            if i == deneme - 1 or kod == 404:
                raise
            time.sleep(60 * (i + 1) if kod in YAVASLA else 5 * (i + 1))
            print("  tekrar:", url[:90], e, file=sys.stderr)


def onceki():
    """Önceki indirmenin ürünleri (veritabanı bazında); bir veritabanı alınamazsa bunlar korunur."""
    try:
        with open(os.path.join(OUT, "urunler.json"), encoding="utf-8") as f:
            return json.load(f).get("urunler", [])
    except (OSError, ValueError):
        return []


def sayi(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def ara_food():
    """Gıda: klasik arama servisi yoğunlukta 503 verdiği için yeni arama servisi (search-a-licious).
    Ad, marka, dil ve içerik sayısı buradan; içerik metni yalnızca ingredients_n > 0 olanlar için ürün sorgusuyla."""
    out, sayfa = [], 1
    while True:
        q = urllib.parse.urlencode({"q": 'countries_tags:"en:turkey"', "page_size": 100, "page": sayfa,
                                    "fields": "code,product_name,brands,lang,last_modified_t,ingredients_n,nutriments,quantity,categories_tags"})
        j = get("https://search.openfoodfacts.org/search?" + q)
        out += j.get("hits", [])
        if sayfa >= j.get("page_count", 0):
            return out
        sayfa += 1
        time.sleep(BEKLE)


def ara_klasik(alan):
    """Kozmetik ve temizlik: klasik arama içerik metnini de döndürür (ürün başına sorgu gerekmez)."""
    out, sayfa = [], 1
    f = ALAN + "," + ",".join("ingredients_text_" + d for d in DILLER)
    while True:
        q = urllib.parse.urlencode({"countries_tags_en": "turkey", "page_size": 100, "page": sayfa, "fields": f})
        j = get("https://%s/api/v2/search?%s" % (alan, q))
        out += j.get("products", [])
        if sayfa * 100 >= j.get("count", 0):
            return out
        sayfa += 1
        time.sleep(BEKLE_ARAMA)


def urun(alan, kod):
    f = ALAN + "," + ",".join("ingredients_text_" + d for d in DILLER)
    j = get("https://%s/api/v2/product/%s?fields=%s" % (alan, urllib.parse.quote(kod), f))
    if j.get("status") != 1:
        return None
    return cevir(j["product"], kod)


# OFF alanı -> bizim besin kimliğimiz (js/besin.js BESIN_ALAN ile aynı adlar)
BESIN_OFF = [("yag", "fat"), ("doymus", "saturated-fat"), ("karb", "carbohydrates"), ("seker", "sugars"),
             ("lif", "fiber"), ("protein", "proteins"), ("tuz", "salt")]


def sayi_f(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f and f >= 0 else None   # NaN ve eksi değer yok sayılır


def birim(miktar):
    """Ambalaj miktarından (\"1,5 L\", \"45cl\", \"250 g\") 100 g mı 100 ml mi: "ml" | "g" | "" (bilinmiyor)."""
    m = re.search(r"\d\s*(ml|cl|dl|l|lt|litre|liter|litres|liters)\b", str(miktar or "").lower())
    if m:
        return "ml"
    return "g" if re.search(r"\d\s*(g|gr|kg|gram|grams)\b", str(miktar or "").lower()) else ""


def besin_al(p):
    """OFF nutriments -> {kcal, yag, doymus, karb, seker, lif, protein, tuz, birim}; değer yoksa None (hiç değer yoksa None döner)."""
    n = p.get("nutriments") or {}
    if not isinstance(n, dict):
        return None
    b = {}
    kcal = sayi_f(n.get("energy-kcal_100g"))
    if kcal is None:
        kj = sayi_f(n.get("energy-kj_100g"))
        if kj is None:
            kj = sayi_f(n.get("energy_100g"))   # OFF'ta "energy" kJ'dir
        kcal = kj / 4.184 if kj is not None else None
    b["kcal"] = kcal
    for k, o in BESIN_OFF:
        b[k] = sayi_f(n.get(o + "_100g"))
    if b["tuz"] is None:
        na = sayi_f(n.get("sodium_100g"))
        b["tuz"] = na * 2.5 if na is not None else None
    if all(v is None for v in b.values()):
        return None
    b = {k: (round(v, 3) if v is not None else None) for k, v in b.items()}
    b["birim"] = birim(p.get("quantity"))
    return b


def kategoriler(p):
    """OFF kategori etiketleri (categories_tags; A-08 ürün tipi için). Liste değilse boş."""
    k = p.get("categories_tags")
    return [str(x) for x in k if isinstance(x, str)][:60] if isinstance(k, list) else []


def kategori_ekle():
    """Yalnızca kategorileri yeniler (A-08; tam indirme ~1 saat sürdüğü için): arama servisinden code + categories_tags,
    mevcut kaynak/off/urunler.json'daki gıda ürünlerine yazılır. Başka alan değişmez."""
    yol = os.path.join(OUT, "urunler.json")
    with open(yol, encoding="utf-8") as f:
        veri = json.load(f)
    kat, sayfa = {}, 1
    while True:
        q = urllib.parse.urlencode({"q": 'countries_tags:"en:turkey"', "page_size": 100, "page": sayfa, "fields": "code,categories_tags"})
        j = get("https://search.openfoodfacts.org/search?" + q)
        for h in j.get("hits", []):
            kat[str(h.get("code", ""))] = kategoriler(h)
        if sayfa >= j.get("page_count", 0):
            break
        sayfa += 1
        time.sleep(BEKLE)
    n = 0
    for u in veri["urunler"]:
        if u.get("db") == "food" and u["kod"] in kat:
            u.pop("kat", None)
            if kat[u["kod"]]:
                u["kat"] = kat[u["kod"]]
                n += 1
    with open(yol, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, indent=0, sort_keys=True)
        f.write("\n")
    print("kategori:", len(kat), "barkod alındı,", n, "gıda ürününe yazıldı", file=sys.stderr)


def cevir(p, kod=""):
    metin = {}
    for d in DILLER:
        v = (p.get("ingredients_text_" + d) or "").strip()
        if v:
            metin[d] = v
    lang = (p.get("lang") or "").strip()
    genel = (p.get("ingredients_text") or "").strip()
    if genel and lang and lang not in metin:
        metin[lang] = genel
    elif genel and not metin:
        metin["?"] = genel   # dili bilinmeyen metin
    marka = p.get("brands") or ""
    if isinstance(p.get("product_name"), list):
        p["product_name"] = ""
    if isinstance(marka, list):
        marka = ", ".join(marka)
    u = {
        "kod": str(p.get("code") or kod),
        "ad": (p.get("product_name_tr") or p.get("product_name") or p.get("product_name_en") or "").strip(),
        "marka": marka.split(",")[0].strip(),
        "dil": lang,
        "metin": metin,
        "t": sayi(p.get("last_modified_t")),
        "besin": besin_al(p),
    }
    if kategoriler(p):
        u["kat"] = kategoriler(p)
    return u


def indir(db, alan):
    liste = None
    try:
        liste = [cevir(p, p.get("code", "")) for p in ara_klasik(alan) if str(p.get("code", "")).isdigit()]
        print(db, len(liste), "barkod (klasik arama)", file=sys.stderr)
    except Exception as e:
        print(db, "klasik arama başarısız:", e, file=sys.stderr)
        if db != "food":
            raise
    if liste is None:
        hits = [h for h in ara_food() if str(h.get("code", "")).isdigit()]
        print(db, len(hits), "barkod;", sum(1 for h in hits if sayi(h.get("ingredients_n")) > 0), "içerikli", file=sys.stderr)
        liste = []
        for i, h in enumerate(hits):
            u = None
            if sayi(h.get("ingredients_n")) > 0:
                try:
                    u = urun(alan, h["code"])
                except Exception as e:
                    print("  atlandı:", h["code"], e, file=sys.stderr)
                time.sleep(BEKLE)
            if not u:
                m = h.get("brands") or ""
                u = cevir({"code": h["code"], "product_name": h.get("product_name") or "", "brands": m if isinstance(m, str) else ",".join(m),
                           "lang": h.get("lang") or "", "last_modified_t": sayi(h.get("last_modified_t")),
                           "nutriments": h.get("nutriments"), "quantity": h.get("quantity"), "categories_tags": h.get("categories_tags")}, h["code"])
            liste.append(u)
            if i % 200 == 0:
                print("  ", db, i, "/", len(hits), file=sys.stderr)
    return liste


def main():
    os.makedirs(OUT, exist_ok=True)
    eski = onceki()
    urunler = {}
    sayim = {}
    hatali = []
    for db, alan in DBS:
        bulunan = icerikli = besinli = 0
        try:
            liste = indir(db, alan)
            hata = None
        except Exception as e:
            hata = str(e)
            liste = [dict(u) for u in eski if u.get("db") == db]
            hatali.append(db)
            print(db, "alınamadı:", hata, "- önceki indirmeden", len(liste), "kayıt korunuyor", file=sys.stderr)
        for u in liste:
            if not u or not (u["ad"] or u["metin"] or u.get("besin")):
                continue
            bulunan += 1
            icerikli += bool(u["metin"])
            besinli += bool(u.get("besin"))
            u["db"] = db
            urunler.setdefault(u["kod"], u)   # aynı barkod iki veritabanında: önce gelen (gıda) kalır
        sayim[db] = {"urun": bulunan, "icerikli": icerikli, "besinli": besinli}
        if hata:
            sayim[db]["hata"] = hata
    veri = {
        "surum": datetime.date.today().isoformat(),
        "kaynak": "Open Food Facts, Open Beauty Facts, Open Products Facts (countries_tags = en:turkey)",
        "lisans": "Open Database License (ODbL) 1.0; içerik Database Contents License (DbCL) 1.0. https://opendatacommons.org/licenses/odbl/1-0/",
        "atif": "© Open Food Facts katkıcıları, https://openfoodfacts.org",
        "sayim": sayim,
        "urunler": [urunler[k] for k in sorted(urunler)],
    }
    with open(os.path.join(OUT, "urunler.json"), "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, indent=0, sort_keys=True)
        f.write("\n")
    print(json.dumps(sayim, ensure_ascii=False), file=sys.stderr)
    if hatali:
        print("UYARI: alınamayan veritabanı:", ", ".join(hatali), "(yeniden çalıştırın)", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    kategori_ekle() if "--kategori" in sys.argv[1:] else main()
