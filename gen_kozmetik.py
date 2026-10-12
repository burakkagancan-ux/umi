# -*- coding: utf-8 -*-
"""
Kozmetik bileşen veri tabanını üretir:
  data/kozmetik.json       AB kozmetik yönetmeliği (1223/2009) eklerindeki düzenlenmiş maddeler
  data/kozmetik_inci.json  CosIng INCI ad listesi (işlev + hayvansal kaynak / PFAS bayrakları)
  kozmetik.json "watch"    K3: AB dışı yasaklar ve AB değerlendirme listeleri (kaynak/kozmetik_k3.tsv)

Kullanım:
  python3 gen_kozmetik.py [--cosing kaynak/cosing]
  CosIng verisi depoda (kaynak/cosing/, sürümü kaynak/cosing/surum.txt). Yenilemek için: python3 cosing_al.py

- JSON dosyalarını elle düzenlemeyin; değişikliği kaynak/kozmetik_*.tsv / kozmetik_listeler.json dosyalarında
  (güncellemeler, K3, eş anlamlılar, işlev adları, Türkçe sözcükler, ABD renkleri) ya da bu betikte yapın.
- Ham veri: Avrupa Komisyonu CosIng veritabanı (Komisyon içeriği 2011/833/AB kararıyla kaynak
  gösterilerek yeniden kullanılabilir). cosing_al.py CosIng'in resmi arama servisinden indirip kaynak/cosing/'e yazar.
  kaynak/kozmetik_guncellemeler.tsv, AB değişikliklerine Türkçe not, uygulama tarihi ve Türkiye durumu ekler; CosIng'e
  henüz girmemiş bir değişiklik olursa kaydı da ekler.
- Türkiye: Kozmetik Ürünler Yönetmeliği (RG 08.05.2023, 32184 mük.) ekleri AB ekleriyle uyumludur; 07.10.2026'da madde madde
  karşılaştırıldı, tek fark bor bileşikleri (TR_BY_ID, kaynak/TR_KOZMETIK_KARSILASTIRMA.md).
"""
import argparse, csv, json, os, re, sys
from collections import defaultdict

VERSION = "0.2.0"
LAST_UPDATED = "2026-10-03"
HERE = os.path.dirname(os.path.abspath(__file__))


def kaynak_json(ad):
    """kaynak/ klasöründeki JSON veri dosyası"""
    with open(os.path.join(HERE, "kaynak", ad), encoding="utf-8") as f:
        return json.load(f)


def kaynak_tsv(ad):
    """kaynak/ klasöründeki TSV veri dosyası: boş ve '#' ile başlayan satırlar atlanır, sütunlar sekmeyle ayrılır."""
    with open(os.path.join(HERE, "kaynak", ad), encoding="utf-8") as f:
        return [ln.rstrip("\n").split("\t") for ln in f if ln.strip() and not ln.startswith("#")]


OUT = os.path.join(HERE, "data", "kozmetik.json")
OUT_INCI = os.path.join(HERE, "data", "kozmetik_inci.json")
UPD = os.path.join(HERE, "kaynak", "kozmetik_guncellemeler.tsv")
K3 = os.path.join(HERE, "kaynak", "kozmetik_k3.tsv")
COSING_DIR = os.path.join(HERE, "kaynak", "cosing")
# kaynak/cosing/surum.txt: "cosing-api <indirme tarihi> <CosIng'deki en son yayın tarihi>" (cosing_al.py yazar)
with open(os.path.join(COSING_DIR, "surum.txt"), encoding="utf-8") as _f:
    _, COSING_INDIRME, COSING_SON = _f.read().split()[:3]

# Türkiye durumu (03.10.2026): Kozmetik Ürünler Yönetmeliği (RG 08.05.2023, 32184 mük.) en son 05.03.2024'te
# (RG 32480) değişti; bu değişiklik AB (EU) 2023/1490 ile uyumludur. Ondan sonraki AB değişiklikleri Türkiye'de
# yayımlanmış olarak bulunamadı. Ticaret Bakanlığı'nın Eylül 2026 taslağı (basın haberleri) 2024/996, 2026/78 ve
# 2026/909'daki hükümlerin bir kısmını içeriyor. Kaynak: kaynak/TR_KOZMETIK_KARSILASTIRMA.md
TR_BY_REG = {"(EU) 2024/858": "yok", "(EU) 2024/996": "taslak", "(EU) 2025/877": "yok",
             "(EU) 2026/78": "taslak", "(EU) 2026/909": "taslak"}
# Türkiye ekleriyle satır satır karşılaştırma (07.10.2026, RG 08.05.2023 32184 mük. ekleri + RG 05.03.2024 32480 ekleri,
# Resmî Gazete PDF'lerinden yazı tanıma ile; ayrıntı kaynak/TR_KOZMETIK_KARSILASTIRMA.md): 2023/1545'e kadarki AB kayıtlarının
# hepsi Türk eklerinde var; tek fark bor bileşikleri. Türk Ek II'si 1393'ten 1400'e atlıyor, AB'nin 1394-1397 kayıtları yok.
TR_BY_ID = {"II/1394": "farkli", "II/1395": "farkli", "II/1396": "farkli", "II/1397": "farkli"}
TR_TEXT = {
    "farkli": "Türkiye: Bu madde Türkiye Kozmetik Ürünler Yönetmeliği'nin yasaklı maddeler listesinde (Ek II) yer almıyor; AB'deki bu yasak Türkiye'ye aktarılmadı. Borik asit ve boratlar için Türkiye'de Ek III'teki (1a, 1b) kullanım sınırları geçerli.",
    "yok": "Türkiye: Bu AB değişikliği Türkiye'de henüz yayımlanmadı (07.10.2026 itibarıyla; mevzuat.gov.tr'deki son değişiklik RG 05.03.2024). Türk mevzuatı AB'yi genellikle aylar sonra izler.",
    "taslak": "Türkiye: Bu AB değişikliği henüz yürürlükte değil; benzer hükümler Ticaret Bakanlığı'nın Eylül 2026 yönetmelik taslağında yer alıyor.",
}

# K3 listeleri (kaynak/kozmetik_listeler.json). level: kartın en az alacağı renk (AB Ek II'deki madde kırmızı kalır).
# Karar (03.10.2026, kullanıcı): başka büyük pazarda yasak -> turuncu; AB değerlendirme listeleri ve SIN List -> sarı.
WATCH_LISTS = kaynak_json("kozmetik_listeler.json")["listeler"]

# kaynak/cosing/annex.*.csv sütunları (cosing_al.py COLS ile aynı sıra)
H2 = ["ref", "inn", "cas", "ec", "regulation", "other_regulations", "sccs", "chemical_name",
      "identified", "cmr", "update_date"]
H3 = ["ref", "inn", "common", "cas", "ec", "product_type", "max", "other", "wording", "regulation",
      "other_regulations", "sccs", "chemical_name", "identified", "cmr", "update_date"]
H4 = ["ref", "inn", "ci", "cas", "ec", "colour", "product_type", "max", "other", "wording",
      "regulation", "other_regulations", "sccs", "chemical_name", "identified", "cmr", "update_date"]
HEADERS = {"II": H2, "III": H3, "IV": H4, "V": H3, "VI": H3}

LEVELS = {
    "red": "AB kozmetik yönetmeliği Ek II'de (yasaklı maddeler) yer alıyor ya da AB'de şüpheli kanserojen (CMR kategori 2, Carc. 2) sınıfında (09.10.2026, kullanıcı kararı).",
    "orange": "Resmi bir tehlike sınıflaması var (ör. AB'de mutajen ya da üreme toksiği CMR kategori 2) ya da büyük bir pazarda yasak.",
    "yellow": "Yasal sınırla izinli (Ek III kısıtlaması) ya da bilinen bir alerjen/formaldehit salıcı.",
    "info": "İzinli listede (renklendirici, koruyucu, UV filtresi) ya da yalnızca profil için önemli. 'Güvenli' anlamına gelmez.",
}

FLAGS = {
    "allergen_fragrance": "Koku alerjeni (etikette adıyla yazılması zorunlu)",
    "allergen_hairdye": "Saç boyası alerjeni",
    "allergen_preservative": "Bilinen koruyucu alerjeni",
    "formaldehyde_releaser": "Formaldehit salıcı koruyucu",
    "cmr2": "AB'de CMR kategori 2 (şüpheli kanserojen/mutajen/üreme toksiği)",
"cmr2_carc": "AB'de şüpheli kanserojen (CMR kategori 2)",
    "cmr_ban": "CMR (kanserojen, mutajen, üreme toksiği) sınıflaması nedeniyle yasak",
    "nano": "Nano biçim",
    "pfas": "PFAS (florlu, doğada kalıcı madde grubu)",
    "non_vegan": "Hayvansal kaynaklı",
    "non_veg": "Kesim ya da böcek kaynaklı (vejetaryen değil)",
    "vegan_unsure": "Kaynağı bitkisel, sentetik ya da hayvansal olabilir",
}

# Formaldehit salıcılar: 2022/1181 ile "releases formaldehyde" uyarısı getirilen Ek V koruyucuları.
FORMALDEHYDE_RELEASERS = [
    "DMDM HYDANTOIN", "IMIDAZOLIDINYL UREA", "DIAZOLIDINYL UREA", "QUATERNIUM-15",
    "2-BROMO-2-NITROPROPANE-1,3-DIOL", "BRONOPOL", "SODIUM HYDROXYMETHYLGLYCINATE", "METHENAMINE",
    "5-BROMO-5-NITRO-1,3-DIOXANE", "BENZYLHEMIFORMAL", "METHENAMINE 3-CHLOROALLYLOCHLORIDE",
    "POLYMETHOXY BICYCLIC OXAZOLIDINE",
]
PRESERVATIVE_ALLERGENS = ["METHYLISOTHIAZOLINONE", "METHYLCHLOROISOTHIAZOLINONE",
                          "METHYLCHLOROISOTHIAZOLINONE AND METHYLISOTHIAZOLINONE", "METHYLDIBROMO GLUTARONITRILE"]

# Hayvansal kaynak (INCI adında sözcük olarak geçerse). non_veg = kesim/böcek; non_vegan = hayvandan elde.
NON_VEG_WORDS = ["TALLOW", "TALLOWATE", "TALLOWAMIDE", "GELATIN", "COLLAGEN", "ELASTIN", "PLACENTAL",
                 "PLACENTA", "MINK", "MINKATE", "SHARK", "FISH", "CAVIAR", "GUANINE", "CIVETONE",
                 "VIVERRA", "CASTOREUM", "BOVINE", "PORCINE", "KERATIN", "SNAIL", "SPERMACETI", "CETACEUM",
                 "CI 75470", "CARMINE", "ANIMAL"]
NON_VEGAN_WORDS = ["LANOLIN", "CERA ALBA", "BEESWAX", "SILK", "SERICIN", "LACTIS", "MILK", "SHELLAC",
                   "MEL", "HONEY", "PROPOLIS", "ROYAL JELLY", "CASEIN", "EGG", "OVUM", "LACTOSE", "WHEY"]
VEGAN_UNSURE = ["SQUALENE", "SQUALANE", "CHOLESTEROL", "CHITOSAN", "AMBERGRIS", "HYALURONIC ACID",
                "SODIUM HYALURONATE", "STEARIC ACID", "GLYCERIN", "LACTIC ACID", "PANTHENOL", "ALLANTOIN"]
# Sözcük eşleşmesine rağmen hayvansal olmayanlar
ANIMAL_EXCEPT = re.compile(r"HONEYSUCKLE|GELATINUM|COCONUT MILK|ALMOND MILK|OAT MILK|SOY MILK|RICE MILK|"
                           r"MILK THISTLE|MILKWEED|EGGPLANT|^R-|\bRH-|\bSH-|RECOMBINANT|MILK VETCH|"
                           r"FISH MINT|STARFISH|SHELLFISH")
PFAS_RE = re.compile(r"PERFLUOR|POLYPERFLUOR|\bPTFE\b|TETRAFLUOROETHYLENE|TRIFLUORO|NONAFLUORO|"
                     r"TRIDECAFLUORO|HEPTADECAFLUORO|CHLOROTRIFLUOROETHYLENE|FLUOROALKYL")

# CosIng işlev adlarının Türkçesi (kaynak/kozmetik_islevler.tsv; boş = gösterilmez)
FUNC_TR = {r[0]: r[1] or None for r in kaynak_tsv("kozmetik_islevler.tsv")}


def clean(s):
    return re.sub(r"\s+", " ", (s or "").replace(" ", " ")).strip()


def norm_alias(s):
    s = clean(s).upper().strip(" ,;.*-")
    s = re.sub(r"\s*\(\s*NANO\s*\)", " (NANO)", s)
    s = re.sub(r"\s*/\s*", "/", s)
    if s.count("(") < s.count(")"):
        s = s.replace(")", "")
    return s


def split_names(s, comma=True):
    """INCI listesini böler. "1,2-HEXANEDIOL" gibi rakam arası virgüller bölünmez."""
    s = clean(s)
    if not s:
        return []
    parts = re.split(r"\s*;\s*|\s+/\s+" + (r"|,(?!\d)|(?<!\d)," if comma else ""), s)
    out = []
    for p in parts:
        p = norm_alias(p)
        if len(p) >= 3 and p not in ("MOVED OR DELETED",) and not re.fullmatch(r"[\d\-/ .]+", p):
            out.append(p)
    return out


def split_cas(s):
    return [c for c in re.findall(r"\d{2,7}-\d{2}-\d", s or "")]


def trim(s, n=400):
    s = clean(s)
    return s if len(s) <= n else s[:n - 1].rstrip() + "…"


CHEM_STOP = {"INN", "ISO", "INNM", "NANO", "INCI", "CAS", "SALTS", "ESTERS", "ISOMERS", "ETHYL", "METHYL",
             "PROPYL", "BUTYL", "FRUIT", "COAL", "ACID", "OILS", "WATER", "EXTRACT", "POWDER"}
# Bir kayda yanlışlıkla bağlanan genel adlar (kayıt id -> çıkarılacak adlar)
# II/1388 (D4): CosIng, D4 içerebileceği için CYCLOMETHICONE adını da bağlıyor; ama cyclomethicone (D4/D5/D6 karışımı)
# kozmetik yönetmeliğinde yasak değil. Etikette görülünce "AB'de yasak" denmemesi için çıkarıldı.
# III/12 (hidrojen peroksit salan maddeler): CosIng SODIUM PERBORATE'ı buraya da bağlıyor; perboratlar CMR 1B olarak
# Ek II/1397'de yasak (2026/78 ile birleştirildi). Ad III/12'de kalırsa II kaydından düşüyor ve sarı görünüyordu.
ALIAS_EXCLUDE = {"V/59": {"CITRIC ACID"}, "II/1388": {"CYCLOMETHICONE"}, "III/12": {"SODIUM PERBORATE"}}
# CosIng'in güncel INCI listesinde bağlantısı yalnızca "Please consider entry ..." notu olarak kalan ya da kopan, ama ek
# kaydının kendisi olan adlar. II/450 "Verbena oil (Lippia citriodora Kunth.)": bu adlar verbena yağının kendisidir.
# III/157 adında "delta-Damascone" geçiyor; CosIng ad kaydı artık olmayan III/161'i gösteriyor.
ALIAS_INCLUDE = {"II/450": {"LIPPIA CITRIODORA LEAF OIL", "LIPPIA CITRIODORA FLOWER/LEAF/STEM OIL"},
                 "III/157": {"DELTA-DAMASCONE"}}


def short_chem(s):
    """Kimyasal addan eş anlamlı olarak kullanılabilecek kısa adları çıkarır (liste).
    "2,6-Dihydroxy-4-methylbenzaldehyde (Atranol)" -> ["ATRANOL"]; "Mercury and its compounds" -> ["MERCURY"]."""
    out = []
    s = clean(s)
    paren = [p for p in re.findall(r"(?:^|\s)\(([^()]{4,30})\)", s) if re.fullmatch(r"[A-Za-z][A-Za-z\- ]+", p)]
    s = re.sub(r"\((INN|ISO|INNM)\)", "", s, flags=re.I)
    for part in re.split(r"\s*;\s*", s) + paren:
        part = re.sub(r",? (and|its|or) (its |their )?(salts|esters|ethers|isomers|derivatives|compounds|mixtures).*$", "", part, flags=re.I)
        part = clean(re.sub(r"[\[\]]", "", part)).strip(" ,;")
        if 4 <= len(part) <= 40 and re.search(r"[A-Za-z]{3}", part) and part.upper() not in CHEM_STOP \
                and not re.fullmatch(r"[\d\s,.\-]+", part) and "(" not in part:
            out.append(norm_alias(part))
    return list(dict.fromkeys(out))


def read_annex(cdir, annex):
    path = os.path.join(cdir, "annex.%s.csv" % annex)
    rows = list(csv.reader(open(path, encoding="utf-8")))[1:]
    H = HEADERS[annex]
    out = []
    for r in rows:
        if len(r) != len(H):
            print("uyarı: Ek %s satır sütun sayısı beklenmedik (%d): %s" % (annex, len(r), r[:2]), file=sys.stderr)
            continue
        d = dict(zip(H, r))
        if "moved or deleted" in d["inn"].lower() or clean(d["inn"]) in ("", "-"):
            if not clean(d.get("identified")):
                continue
        out.append(d)
    return out


def level_reason(e):
    a, f = e["annex"], set(e["flags"])
    reg = e.get("regulation") or ""
    if a == "II":
        r = "AB kozmetik yönetmeliği Ek II'de yasaklı maddeler arasında (giriş %s%s)." % (e["ref"], ", " + reg if reg else "")
        if "cmr_ban" in f:
            r += " Kanserojen, mutajen ya da üreme için toksik (CMR) sınıflaması nedeniyle yasaklandı."
        return r + " Etikette görülmesi okuma hatası ya da AB/Türkiye dışı bir ürün olduğunu gösterebilir."
    parts = []
    if a == "III":
        if "allergen_fragrance" in f and not e.get("max"):
            parts.append("Koku alerjeni: AB'de durulanmayan üründe %0,001, durulanan üründe %0,01'in üzerindeyse etikette adıyla yazılması zorunlu.")
        else:
            parts.append("AB Ek III'te kısıtlı madde: yalnızca belirli ürün tiplerinde ve üst sınırla kullanılabilir.")
            if "allergen_fragrance" in f:
                parts.append("Aynı zamanda etikette adıyla yazılması zorunlu bir koku alerjenidir.")
    elif a == "IV":
        parts.append("İzinli renklendirici (AB Ek IV).")
    elif a == "V":
        parts.append("İzinli koruyucu (AB Ek V), üst sınırla.")
    elif a == "VI":
        parts.append("İzinli UV filtresi (AB Ek VI), üst sınırla.")
    if "cmr2_carc" in f:
        parts.append("AB'de şüpheli kanserojen (CMR kategori 2) sınıfında; bu yüzden yalnızca sınırlı kullanıma izin veriliyor.")
    elif "cmr2" in f:
        parts.append("AB'de CMR kategori 2 (şüpheli) sınıflaması var; bu yüzden yalnızca sınırlı kullanıma izin veriliyor.")
    if "formaldehyde_releaser" in f:
        parts.append("Formaldehit salabilir. Formaldehit AB'de kanserojen (1B) sınıfındadır ve yaygın bir alerjendir; toplam formaldehit %0,001'i aşarsa etikette \"releases formaldehyde\" yazılması zorunludur.")
    if "allergen_preservative" in f:
        parts.append("Temas alerjisine sık yol açan bir koruyucu; AB'de kullanım koşulları bu yüzden daraltıldı.")
    if "allergen_hairdye" in f:
        parts.append("Saç boyası maddesi; ciddi alerjik reaksiyonlara yol açabileceği için etikette uyarı zorunludur.")
    if e["annex"] in ("III", "V", "VI") and e.get("max"):
        parts.append("Etikette yüzde yazmadığı için sınırın aşılıp aşılmadığı anlaşılamaz.")
    return " ".join(parts)


ONLY_TR = [
    (r"artificial nail systems", "yapay tırnak sistemlerinde (profesyonel kullanım)"),
    (r"hair dye substance", "saç boyalarında"),
    (r"oral products|toothpaste", "ağız ve diş bakım ürünlerinde"),
    (r"nail products|nail hardener", "tırnak ürünlerinde"),
    (r"(products intended for colouring eyelashes|eye products)", "göz/kirpik ürünlerinde"),
    (r"hair waving or straightening", "saç kıvırma/düzleştirme ürünlerinde"),
    (r"depilator", "tüy dökücülerde"),
    (r"hair products", "saç ürünlerinde"),
]


def use_fields(e):
    """Ürün tipine bağlı kuralları istemci için sadeleştirir: rinse_only, kids_under, only_tr."""
    pt = (e.get("product_type") or "")
    mx = (e.get("max") or "")
    allt = " ".join([pt, mx, e.get("conditions_en") or "", e.get("note_tr") or ""] + [u.get("note_tr", "") for u in e.get("updates", [])])
    if e["annex"] in ("III", "V") and not e.get("_skip_use"):
        scope = pt or mx
        if re.search(r"rinse[\s\-\u00ad]*off", scope, re.I) and not re.search(r"leave[\s\-\u00ad]*on|other products|\(b\)|b\)", scope, re.I):
            e["rinse_only"] = True
        if pt and not re.search(r"\(b\)|b\)|other products|all cosmetic", pt, re.I) and not e.get("rinse_only"):
            for rx, tr in ONLY_TR:
                if re.match(r"\s*(\(a\)\s*)?" + rx, pt.replace("\u00ad", ""), re.I):
                    e["only_tr"] = tr
                    break
    ages = [int(x) for x in re.findall(r"children under (\d+)", allt, re.I)] + \
           [int(x) for x in re.findall(r"(\d+) yaş altı", allt)]
    if ages:
        e["kids_under"] = min(ages)


def compute_level(e):
    f = set(e["flags"])
    if e["annex"] == "II":
        return "red"
    if "cmr2_carc" in f:
        return "red"
    if "cmr2" in f:
        return "orange"
    if e["annex"] == "III":
        if "allergen_fragrance" in f and not e.get("max"):
            return "info"
        return "yellow"
    if f & {"formaldehyde_releaser", "allergen_preservative"}:
        return "yellow"
    return "info"


def build(cdir):
    entries = {}
    alias_from_ingredients = defaultdict(set)

    # INCI listesi -> ek referansları (ör. "III/60")
    ing = list(csv.DictReader(open(os.path.join(cdir, "ingredients.csv"), encoding="utf-8")))
    eski = os.path.join(cdir, "ingredients_eski.csv")   # CosIng'den çıkarılmış adlar: yalnızca tanıma için
    if os.path.exists(eski):
        ing += list(csv.DictReader(open(eski, encoding="utf-8")))
    for r in ing:
        s = r["restriction"] or ""
        # Koşul bildiren notlarda ("II/778 ... contain > 3 % w/w DMSO extract", "II/875 ... except full refining history
        # known", "Please consider entry 419 Annex II ... applicable", "For nano form please II/1727", "II/1354 (... used
        # in hair dye products)") madde her durumda yasak değildir: Ek II bağlantısı alınmaz, izinli eklere (III-VI)
        # bağlantı kalır. Yoksa MINERAL OIL, SQUALENE, C13-15 ALKANE gibi yaygın adlar kırmızı görünür.
        cond = re.search(r"\b(please|consider|if|except|contains?|used)\b|>", s, re.I)
        for m in re.finditer(r"\b(II|III|IV|V|VI)\s*/\s*(\d+[a-z]?)", s):
            if not cond or m.group(1) != "II":
                alias_from_ingredients["%s/%s" % (m.group(1), m.group(2))].add(norm_alias(r["inci_name"]))

    for annex in ["II", "III", "IV", "V", "VI"]:
        for d in read_annex(cdir, annex):
            eid = "%s/%s" % (annex, d["ref"])
            if eid in entries:   # CosIng'de aynı numarayı taşıyan ikinci madde (ör. III/269): üzerine yazılmasın
                eid += "-2"
            inci = []
            for k in ("common", "identified"):
                if d.get(k):
                    inci += split_names(d[k])
            if annex == "IV" and clean(d.get("ci")):
                inci.append(norm_alias(d["ci"]))
            inci += sorted(alias_from_ingredients.get(eid, set()) | ALIAS_INCLUDE.get(eid, set()))
            chem = clean(d.get("chemical_name")) or clean(d["inn"])
            if not inci or annex == "II":
                inci += short_chem(d["inn"])
            # Koku alerjenlerinin etikette yazılacak toplu adı (ör. 'Lavandula Oil/Extract', 'Rose Flower Oil/Extract')
            for q in re.findall(r"indicated (?:as )?[\u2018'\"]([^\u2019'\"]{3,60})[\u2019'\"]", d.get("other", "") + " " + d.get("wording", "")):
                inci.append(norm_alias(q))
            # "TITANIUM DIOXIDE/CI 77891" gibi ad+CI birleşimleri iki ayrı ada bölünür
            inci = [p for a in inci for p in (a.split("/") if re.search(r"/CI \d{5}$", a) else [a])]
            inci = list(dict.fromkeys(a for a in inci if a and a not in ALIAS_EXCLUDE.get(eid, ())
                                      and a not in CHEM_STOP))
            if not inci:
                continue
            flags = []
            cmr = clean(d.get("cmr"))
            if annex != "II" and re.search(r"(Carcinogenic|Mutagenic|Reprotoxic)", cmr):
                flags.append("cmr2")
            if annex != "II" and "Carcinogenic" in cmr:
                flags.append("cmr2_carc")
            txt = " ".join(clean(d.get(k)) for k in ("product_type", "max", "other", "wording"))
            if annex == "III" and re.search(r"(shall|must) be indicated", txt, re.I):
                flags.append("allergen_fragrance")
            if annex == "III" and re.search(r"allergic reaction", txt, re.I):
                flags.append("allergen_hairdye")
            if any("(NANO)" in a for a in inci):
                flags.append("nano")
            e = {
                "id": eid, "annex": annex, "ref": d["ref"],
                "name": inci[0] if inci and not inci[0].startswith(("CI ",)) else trim(chem, 90),
                "inci": inci, "cas": split_cas(d["cas"])[:6],
                "flags": flags, "regulation": clean(d["regulation"]),
            }
            if annex != "II":
                if clean(d.get("product_type")): e["product_type"] = trim(d["product_type"], 300)
                if clean(d.get("max")).strip("-") : e["max"] = trim(d["max"], 200)
                cond = " ".join(x for x in (clean(d.get("other")), clean(d.get("wording"))) if x)
                if cond: e["conditions_en"] = trim(cond, 400)
            entries[eid] = e
    return entries, ing


def apply_updates(entries):
    if not os.path.exists(UPD):
        return []
    log = []
    by_inci = defaultdict(list)
    for e in entries.values():
        for a in e["inci"]:
            by_inci[a].append(e["id"])
    head = None
    auto = 0
    for line in open(UPD, encoding="utf-8"):
        if line.startswith("#") or not line.strip():
            continue
        cols = line.rstrip("\n").split("\t")
        if head is None:
            head = cols
            continue
        cols += [""] * (len(head) - len(cols))
        r = dict(zip(head, cols))
        op, annex, ref = r["islem"], r["ek"], r["ref"]
        inci = split_names(r["inci"], comma=False)
        upd = {"regulation": r["yonetmelik"], "applies_from": r["uygulama"], "note_tr": r["not_tr"], "source": r["kaynak"]}
        if TR_BY_REG.get(r["yonetmelik"]): upd["tr"] = TR_BY_REG[r["yonetmelik"]]
        if op == "sil":
            eid = "%s/%s" % (annex, ref)
            if entries.pop(eid, None):
                log.append("sil " + eid)
            continue
        if op == "guncelle":
            eid = "%s/%s" % (annex, ref)
            if eid not in entries and inci:
                ids = [i for a in inci for i in by_inci.get(a, []) if i.startswith(annex + "/")]
                eid = ids[0] if ids else eid
            if eid not in entries:
                print("uyarı: güncellenecek kayıt yok: %s %s" % (eid, inci), file=sys.stderr)
                continue
            e = entries[eid]
            e.setdefault("updates", []).append(upd)
            if r["inceleme"] == "1": e["needs_review"] = True
            log.append("guncelle " + eid)
            continue
        if op == "ekle" and "%s/%s" % (annex, ref) in entries:
            # CosIng kaydı zaten var: koşullar CosIng'den kalır, Türkçe not ve tarih bu satırdan eklenir
            e = entries["%s/%s" % (annex, ref)]
            for a in inci:
                if a not in e["inci"]:
                    e["inci"].append(a); by_inci[a].append(e["id"])
            e.update({k: upd[k] for k in ("regulation", "applies_from", "note_tr", "source", "tr") if upd.get(k)})
            if annex == "II" and "CMR" in r["not_tr"] and "cmr_ban" not in e["flags"]:
                e["flags"].append("cmr_ban")
            if any("(NANO)" in a for a in e["inci"]) and "nano" not in e["flags"]:
                e["flags"].append("nano")
            if r["inceleme"] == "1": e["needs_review"] = True
            log.append("ekle(CosIng'de var) " + e["id"])
            continue
        if op == "ekle":
            if ref == "?":
                auto += 1
                ref = "y%d" % auto
            eid = "%s/%s" % (annex, ref)
            names = inci[:] or []
            if not names:  # INCI verilmemişse kimyasal addan kısa ad üret (Türkçe açıklamalardan değil)
                names = short_chem(r["ad"])
            e = {"id": eid, "annex": annex, "ref": ref if not ref.startswith("y") else "?",
                 "name": names[0] if names else r["ad"], "inci": names, "cas": split_cas(r["cas"]),
                 "flags": [], "regulation": r["yonetmelik"], "applies_from": r["uygulama"],
                 "note_tr": r["not_tr"], "source": r["kaynak"]}
            if TR_BY_REG.get(r["yonetmelik"]): e["tr"] = TR_BY_REG[r["yonetmelik"]]
            if annex == "II" and "CMR" in r["not_tr"]:
                e["flags"].append("cmr_ban")
            if any("(NANO)" in a for a in names):
                e["flags"].append("nano")
            if r["inceleme"] == "1":
                e["needs_review"] = True
            # Aynı INCI başka ekte eski kayıtla duruyorsa (ör. TPO Ek III'ten Ek II'ye) eski kayıt kalkar
            for a in names:
                for old in by_inci.get(a, []):
                    if old in entries and old != eid and entries[old]["annex"] != annex and annex == "II":
                        entries.pop(old, None)
                        log.append("taşındı %s -> %s" % (old, eid))
            entries[eid] = e
            for a in names:
                by_inci[a].append(eid)
            log.append("ekle " + eid)
    return log


def read_watch(known):
    """kaynak/kozmetik_k3.tsv -> watch kayıtları. Her kayıt: liste, INCI adları, tarih, dayanak, kaynak."""
    if not os.path.exists(K3):
        return []
    out, head = [], None
    for line in open(K3, encoding="utf-8"):
        if line.startswith("#") or not line.strip():
            continue
        c = line.rstrip("\n").split("\t")
        if head is None:
            head = c
            continue
        c += [""] * (len(head) - len(c))
        r = dict(zip(head, c))
        if r["liste"] not in WATCH_LISTS:
            print("uyarı: K3 bilinmeyen liste: %s" % r["liste"], file=sys.stderr)
            continue
        names = split_names(r["inci"], comma=False)
        for n in names:
            if n not in known:
                print("uyarı: K3 adı CosIng/eklerde yok (yine de eklendi): %s" % n, file=sys.stderr)
        w = {"list": r["liste"], "inci": names, "cas": split_cas(r["cas"]), "date": r["tarih"],
             "basis": r["dayanak"], "source": r["kaynak"]}
        if r["ad"]: w["name"] = r["ad"]
        if r["not_tr"]: w["note_tr"] = r["not_tr"]
        if r["inceleme"] == "1": w["needs_review"] = True
        out.append(w)
    return out


def finalize(entries):
    fr = set(FORMALDEHYDE_RELEASERS)
    pa = set(PRESERVATIVE_ALLERGENS)
    for e in entries.values():
        if "tr" not in e and TR_BY_REG.get(e.get("regulation")):
            e["tr"] = TR_BY_REG[e["regulation"]]
        if e["id"] in TR_BY_ID:
            e["tr"] = TR_BY_ID[e["id"]]
        s = set(e["inci"])
        if e["annex"] in ("V", "III") and s & fr: e["flags"].append("formaldehyde_releaser")
        if e["annex"] == "V" and s & pa: e["flags"].append("allergen_preservative")
        # PFAS ad düzeyinde: kayıt bayrağı kaydın florsuz adlarına da geçiyordu (III/61, III/62: 282 ad; 09.10.2026).
        # INCI listesinde olmayan kayıt adları (ör. Ek II PFOA) için hangi adların PFAS olduğu kayıtta yazılır.
        pf = [a for a in e["inci"] if PFAS_RE.search(a)]
        if pf: e["pfas_inci"] = pf
        e["flags"] = list(dict.fromkeys(e["flags"]))

    # Aynı ad hem yasaklı (II) hem izinli bir ekte geçiyorsa: II'deki ad o maddenin başka bir
    # biçimine/kullanımına aittir (ör. bir tuzu, bir ürün tipi). Ad II kaydından çıkarılır.
    allowed = defaultdict(set)
    for e in entries.values():
        if e["annex"] != "II":
            for a in e["inci"]:
                allowed[a].add(e["id"])
    dropped = 0
    for eid in list(entries):
        e = entries[eid]
        if e["annex"] != "II":
            continue
        keep = [a for a in e["inci"] if a not in allowed]
        if len(keep) != len(e["inci"]):
            e["partly_allowed"] = sorted({i for a in e["inci"] if a in allowed for i in allowed[a]})
            dropped += len(e["inci"]) - len(keep)
            e["inci"] = keep
            if not keep:
                del entries[eid]
                continue
            if e["name"] not in keep:
                e["name"] = keep[0]
    for e in entries.values():
        use_fields(e)
        e["level"] = compute_level(e)
        e["reason"] = level_reason(e)
    return dropped


def inci_file(ing):
    funcs, fidx, items = [], {}, []
    for r in ing:
        name = norm_alias(r["inci_name"])
        if not name:
            continue
        fl = []
        for f in (r["functions"] or "").split(","):
            f = clean(f)
            tr = FUNC_TR.get(f)
            if not tr:
                continue
            if tr not in fidx:
                fidx[tr] = len(funcs); funcs.append(tr)
            if fidx[tr] not in fl:
                fl.append(fidx[tr])
        flags = []
        if not ANIMAL_EXCEPT.search(name):
            if any(re.search(r"\b%s\b" % re.escape(w), name) for w in NON_VEG_WORDS):
                flags.append("non_veg")
            elif any(re.search(r"\b%s\b" % re.escape(w), name) for w in NON_VEGAN_WORDS):
                flags.append("non_vegan")
            elif name in VEGAN_UNSURE:
                flags.append("vegan_unsure")
        if PFAS_RE.search(name):
            flags.append("pfas")
        it = [name, fl]
        if flags:
            it.append(flags)
        items.append(it)
    items.sort(key=lambda x: x[0])
    return funcs, items


# ---------------- Eş anlamlılar ----------------
ESA = os.path.join(HERE, "kaynak", "kozmetik_esanlamlilar.tsv")

# ABD sertifikalı renklendiricileri (FD&C / D&C adları) -> CI numarası (kaynak/kozmetik_abd_renkler.tsv)
US_COLORS = {(r[0], int(r[1])): r[2] for r in kaynak_tsv("kozmetik_abd_renkler.tsv")}


def us_color_aliases():
    out = []
    for (c, n), ci in US_COLORS.items():
        for pre in ("", "FD&C ", "D&C ", "EXT. D&C "):
            for mid in ("%s %d", "%s NO. %d"):
                base = pre + (mid % (c, n))
                for suf in ("", " LAKE", " ALUMINUM LAKE", " CALCIUM LAKE", " BARIUM LAKE", " AL LAKE", " CA LAKE"):
                    out.append((base + suf, [ci], "abd"))
    return out


# Türkçe kimyasal ad kuralları (kaynak/kozmetik_tr_sozcukler.tsv): INCI'deki her sözcük bu sözlükte (ya da sayı) ise Türkçe biçim üretilir.
TR_WORD = {r[0]: r[1].split(";") for r in kaynak_tsv("kozmetik_tr_sozcukler.tsv")}


def tr_rule_aliases(names):
    out = []
    for n in names:
        words = re.split(r"[\s\-]+", n)
        if not words or any(w not in TR_WORD and not re.fullmatch(r"\d+", w) for w in words):
            continue
        forms = [""]
        for w in words:
            opts = TR_WORD.get(w, [w])
            forms = [(f + " " + o).strip() for f in forms for o in opts][:8]
        for f in forms:
            if f.upper() != n:
                out.append((f, [n], "tr_kural"))
    return out


def fold_key(s):
    """İstemcideki norm() ile aynı anahtar: Türkçe harfler sadeleşir, harf/rakam dışı boşluk olur."""
    s = s.replace("İ", "i").replace("I", "ı").lower()
    s = s.translate(str.maketrans("çğıöşüâîû", "cgiosuaiu"))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def build_aliases(inci_names, reg_names):
    known = set(inci_names) | set(reg_names)
    rows = []
    if os.path.exists(ESA):
        head = None
        for line in open(ESA, encoding="utf-8"):
            if line.startswith("#") or not line.strip():
                continue
            c = line.rstrip("\n").split("\t")
            if head is None:
                head = c
                continue
            rows.append((c[0].strip(), [t.strip() for t in c[1].split(";") if t.strip()], c[2].strip() if len(c) > 2 else ""))
    rows += us_color_aliases()
    rows += tr_rule_aliases(sorted(inci_names))
    existing = {fold_key(n): n for n in known}
    out, seen, skipped = [], {}, []
    for ad, targets, tur in rows:
        bad = [t for t in targets if t not in known]
        if bad:
            skipped.append((ad, bad)); continue
        k = fold_key(ad)
        if len(k) < (2 if tur == "tr" else 3):   # "Su" gibi kısa Türkçe adlar yalnızca elle eklenen listeden
            continue
        if k in existing:          # etiketteki ad zaten bir INCI adı: eş anlamlıya gerek yok
            continue
        if k in seen:
            if seen[k] != targets:
                print("uyarı: '%s' iki farklı hedefe bağlanıyor: %s / %s" % (ad, seen[k], targets), file=sys.stderr)
            continue
        seen[k] = targets
        out.append([ad, targets, tur])
    for ad, bad in skipped:
        print("uyarı: eş anlamlı hedefi listede yok: %s -> %s" % (ad, bad), file=sys.stderr)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cosing", default=os.environ.get("COSING_DIR", COSING_DIR))
    a = ap.parse_args()
    if not os.path.exists(os.path.join(a.cosing, "annex.II.csv")):
        sys.exit("CosIng verisi bulunamadı: %s (betiğin başındaki kullanım notuna bakın)" % a.cosing)
    entries, ing = build(a.cosing)
    log = apply_updates(entries)
    dropped = finalize(entries)
    known = {norm_alias(r["inci_name"]) for r in ing} | {a for e in entries.values() for a in e["inci"]}
    watch = read_watch(known)
    order = {"II": 0, "III": 1, "V": 2, "VI": 3, "IV": 4}
    def rk(e):
        m = re.match(r"(\d+)", e["ref"]); return (order[e["annex"]], int(m.group(1)) if m else 99999, e["ref"])
    lst = sorted(entries.values(), key=rk)
    counts = defaultdict(int)
    for e in lst:
        counts["annex_" + e["annex"]] += 1; counts["level_" + e["level"]] += 1
        for f in e["flags"]: counts["flag_" + f] += 1
    out = {
        "version": VERSION, "last_updated": LAST_UPDATED,
        "meta": {
            "description": "AB kozmetik yönetmeliği (EC) 1223/2009 eklerindeki düzenlenmiş maddeler. Türkiye Kozmetik Ürünler Yönetmeliği ekleri AB ile uyumludur.",
            "source": "Avrupa Komisyonu CosIng veritabanı (resmi arama servisinden %s tarihinde indirildi; en son yayın %s) + kaynak/kozmetik_guncellemeler.tsv (değişikliklere Türkçe not ve Türkiye durumu)." % (COSING_INDIRME, COSING_SON),
            "license": "CosIng içeriği Komisyon'un 2011/833/AB kararıyla kaynak gösterilerek yeniden kullanılabilir.",
            "tr_status": "Türkiye Kozmetik Ürünler Yönetmeliği ekleri AB ile (EU) 2023/1490'a kadar uyumlu (son değişiklik RG 05.03.2024, 32480). Sonraki AB değişikliklerinin Türkiye durumu kayıtlardaki 'tr' alanında. Ekler 07.10.2026'da Resmî Gazete metniyle satır satır karşılaştırıldı: tek fark bor bileşikleri (AB Ek II 1394-1397 Türkiye'de yasak değil, 'tr': 'farkli').",
            "tr_text": TR_TEXT,
            "match": "inci alanındaki adlar büyük harfle, etiketteki INCI adlarıyla eşleştirilir.",
            "levels": LEVELS, "flags": FLAGS,
            "inci_flag_levels": {"pfas": "orange"},
            "inci_flag_reasons": {
                "pfas": "PFAS grubundan (florlu, doğada parçalanmayan madde). Fransa'da 1 Ocak 2026'dan itibaren kozmetikte yasak (Kanun 2025-188); ABD Kaliforniya'da 1 Ocak 2025'ten itibaren kozmetiğe kasıtlı eklenen tüm PFAS yasak (AB 2771); AB'de genel kısıtlama önerisi değerlendiriliyor. AB/Türkiye'de şu an yasak değil.",
                "non_vegan": "Hayvandan elde edilen bir bileşen.",
                "non_veg": "Kesim, balık ya da böcek kaynaklı bir bileşen.",
                "vegan_unsure": "Bitkisel, sentetik ya da hayvansal kaynaklı olabilir; etikette kaynak yazmaz."},
            "known_gaps": [
                "AB taslak tüzüğü D117774 (benzofenon-1/-2, BHA, butilparaben, CBD, cıvalı koruyucular, prostaglandinler, 2 saç boyası): henüz kabul edilmedi, K3 'ab_taslak' listesinde izleniyor; ek tabloları (yeni CMR maddeleri) Konsey belgesinde yok.",
                "Türkiye Eylül 2026 taslağının resmi metni bulunamadı (TİTCK görüş platformunda yok); bilgiler basın haberlerinden.",
                "K3: ChemSec SIN List eklenmedi (verinin uygulamada yeniden kullanımı için ChemSec'ten yazılı izin gerekiyor).",
                "K3: Kanada Hotlist, Çin, Japonya, Kore, Brezilya ve ABD'nin diğer eyalet yasakları (ör. Washington) eklenmedi.",
                "Endokrin: Fransa ANSES listesinin tam metni (Légifrance) ve edlists.org listeleri eklenmedi; yalnızca ikincil kaynaklarda adı geçen Fransa maddeleri var.",
                "Endokrin: AB CLP ED HH 1/2 sınıflandırması almış maddeler henüz taranmadı.",
                "Komedojenite: Fulton 1989'da 4–5 bulunan 20 madde + metinde anılan 1 (izostearil neopentanoat, tabloda 3). Tek kaynak; tablo metni taranmış sayfadan okunduğu için yeni 12 satır inceleme=1. 3 alan sınırdakiler (bütil stearat, desil oleat, miristik asit, sorbitan oleat, gliseril stearat SE) eklenmedi; PEG-16 lanolin (Solulan 16) INCI karşılığı belirsiz.",
            ],
            "watch_lists": WATCH_LISTS,
            "watch_match": "watch kayıtları yalnızca inci alanındaki adlarla eşleşir; level, kartın en az alacağı renktir.",
            "counts": dict(sorted(counts.items())),
            "updates_applied": len(log), "aliases_dropped_ii_conflict": dropped,
        },
        "entries": lst,
        "watch": watch,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    funcs, items = inci_file(ing)
    aliases = build_aliases([i[0] for i in items], [a for e in lst for a in e["inci"]])
    with open(OUT_INCI, "w", encoding="utf-8") as f:
        json.dump({"version": VERSION, "last_updated": LAST_UPDATED,
                   "meta": {"source": "Avrupa Komisyonu CosIng INCI listesi (%s tarihinde indirildi) + CosIng'den sonradan çıkarılmış adlar (kaynak/cosing/ingredients_eski.csv)" % COSING_INDIRME,
                            "item": "[INCI adı, [işlev indeksleri], [bayraklar]?]",
                            "aliases": "[etiketteki ad, [hedef INCI adları], tür (tr | tr_kural | en | abd | kisa)]; kaynak/kozmetik_esanlamlilar.tsv + Türkçe ad kuralları + ABD renklendirici adları", "flags": {k: FLAGS[k] for k in ("non_vegan", "non_veg", "vegan_unsure", "pfas")}},
                   "functions": funcs, "items": items, "aliases": aliases}, f, ensure_ascii=False, separators=(",", ":"))
    print("kozmetik.json: %d kayıt %s" % (len(lst), json.dumps(dict(counts), ensure_ascii=False)))
    import collections
    print("kozmetik_inci.json: %d INCI adı, %d işlev, %d eş anlamlı %s" % (len(items), len(funcs), len(aliases), dict(collections.Counter(a[2] for a in aliases))))
    print("güncellemeler: %d işlem; II çakışmasıyla çıkarılan ad: %d" % (len(log), dropped))
    print("K3 (watch): %d kayıt %s" % (len(watch), dict(collections.Counter(w["list"] for w in watch))))


if __name__ == "__main__":
    main()
