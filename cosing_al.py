# -*- coding: utf-8 -*-
"""
CosIng verisinin gen_kozmetik.py'nin kullandığı kısmını depoya (kaynak/cosing/) alır.
Kaynak: Avrupa Komisyonu CosIng veritabanının resmi arama servisi (ec.europa.eu/growth/tools-databases/cosing
sayfasının kullandığı api.tech.ec.europa.eu search-api, veri tabanı GROWTH_COSING).

Kullanım:
  python3 cosing_al.py                  # servisten indirir, kaynak/cosing/ altına yazar
  python3 cosing_al.py --ham <klasör>   # ham yanıtları (JSON) ayrıca bu klasöre kaydeder

Yazılanlar:
  kaynak/cosing/annex.II.csv ... annex.VI.csv  AB 1223/2009 Ek II-VI (gen_kozmetik.py'nin HEADERS sütunları)
  kaynak/cosing/ingredients.csv                INCI listesi; inci_name, restriction, functions, substance_id sütunları
                                               (substance_id: CosIng'deki madde sayfasının kimliği, .../cosing/details/<id>)
  kaynak/cosing/ingredients_eski.csv           CosIng'den sonradan çıkarılan INCI adları (eski etiketlerde
                                               hâlâ görülebilir; tanınmaya devam etsin diye saklanır, hiç silinmez)
  kaynak/cosing/surum.txt                      kaynak, indirme tarihi ve CosIng'deki en son yayın tarihi
Sonra: python3 gen_kozmetik.py && python3 gen_eslesmeler.py && python3 gen_temizlik.py
"""
import argparse, csv, datetime, json, os, re, subprocess, sys, time
from collections import defaultdict

API = ("https://api.tech.ec.europa.eu/search-api/prod/rest/search"
       "?apiKey=285a77fd-1257-4271-8507-f0c6b2961203&text=*&pageSize=%d&pageNumber=%d")
PAGE = 200      # servis sayfa başına en fazla 200 kayıt döndürür
LIMIT = 10000   # bir sorguda sayfalanabilen en fazla kayıt
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "kaynak", "cosing")
ANNEXES = ["II", "III", "IV", "V", "VI"]
ING_COLS = ["inci_name", "restriction", "functions", "substance_id"]   # substance_id: CosIng madde sayfası (cosing/details/<id>)
# gen_kozmetik.py HEADERS ile aynı sıra
COLS = {
    "II": ["reference_number", "inn", "cas_number", "ec_number", "regulation", "other_regulations", "sccs_opinions",
           "chemical_name", "identified_ingredients", "cmr", "update_date"],
    "III": ["reference_number", "inn", "common_ingredients", "cas_number", "ec_number", "product_type",
            "maximum_concentration", "other", "wording_of_conditions", "regulation", "other_regulations",
            "sccs_opinions", "chemical_name", "identified_ingredients", "cmr", "update_date"],
    "IV": ["reference_number", "inn", "colour_index_number", "cas_number", "ec_number", "colour", "product_type",
           "maximum_concentration", "other", "wording_of_conditions", "regulation", "other_regulations",
           "sccs_opinions", "chemical_name", "identified_ingredients", "cmr", "update_date"],
}
COLS["V"] = COLS["VI"] = COLS["III"]


def query(q, size, page):
    for _ in range(5):
        r = subprocess.run(["curl", "-sS", "-m", "120", "-X", "POST", API % (size, page),
                            "-F", "query=%s;type=application/json" % json.dumps(q),
                            "-F", 'languages=["en"];type=application/json'], capture_output=True, text=True)
        try:
            d = json.loads(r.stdout)
            if "results" in d:
                return d
        except ValueError:
            pass
        time.sleep(5)
    sys.exit("CosIng servisine ulaşılamadı")


def fetch(item_type):
    """Tüm kayıtları indirir. Bir sorgu en fazla 10.000 kayıt sayfalayabildiği için substanceId'nin ilk hanesine
    göre bölünür; 9 ile başlayanlar için üst sınır yazılamadığından (servis ":" ve harf kabul etmiyor) onlar
    "1–9 aralığı dışı" sorgusuyla gelir. Servis bazı kayıtları iki kez döndürüyor; reference ile tekilleştirilir."""
    t = {"term": {"itemType": item_type}}
    rng = lambda lo, hi: {"range": {"substanceId": {"gte": lo, "lt": hi}}}
    parts = [{"bool": {"must": [t, rng(c, chr(ord(c) + 1))]}} for c in "12345678"]
    parts.append({"bool": {"must": [t], "must_not": [rng("1", "9")]}})
    total = query({"bool": {"must": [t]}}, 1, 1)["totalResults"]
    out = {}
    for q in parts:
        n = query(q, 1, 1)["totalResults"]
        if n > LIMIT:
            sys.exit("sorgu parçası çok büyük (%d), bölme yeniden ayarlanmalı" % n)
        for page in range(1, n // PAGE + 2):
            for x in query(q, PAGE, page)["results"]:
                out[x["metadata"]["reference"][0]] = x["metadata"]
    print("%s: %d kayıt (servisin bildirdiği %d, fark tekrarlanan kayıtlar)" % (item_type, len(out), total))
    return list(out.values())


def v(m, k, sep="; "):
    return sep.join(x.strip() for x in (m.get(k) or []) if x and x.strip() and x.strip() != "<empty>")


def cmr_text(m):
    """'[["2","Reprotoxic",""]]' -> 'Reprotoxic Cat. 2' (eski CSV biçimi)."""
    try:
        cls = json.loads((m.get("classificationInformation") or ["[]"])[0])
    except ValueError:
        return ""
    return ", ".join("%s Cat. %s" % (c[1], c[0]) for c in cls if len(c) >= 2)


def newest_reg(m):
    regs = m.get("relatedRegulations") or []
    key = lambda r: tuple(int(x) for x in re.findall(r"\d+", r)[:2]) or (0,)
    return max(regs, key=key) if regs else ""


def annex_row(m, annex, names_by_id):
    ref = v(m, "refNo").replace(" ", "")
    identified = "; ".join(names_by_id[i] for i in (m.get("identifiedIngredient") or []) if i in names_by_id)
    d = {
        "reference_number": ref, "inn": v(m, "inciName"), "common_ingredients": v(m, "nameOfCommonIngredientsGlossary"),
        "colour_index_number": v(m, "nameOfCommonIngredientsGlossary"), "colour": v(m, "colour"),
        "cas_number": v(m, "casNo", " / "), "ec_number": v(m, "ecNo", " / "),
        "product_type": v(m, "productTypeBodyParts", "\n"), "maximum_concentration": v(m, "maximumConcentration", "\n"),
        "other": v(m, "other", "\n"), "wording_of_conditions": v(m, "wordingOfConditions", "\n"),
        "regulation": newest_reg(m), "other_regulations": v(m, "otherRegulations"), "sccs_opinions": v(m, "sccsOpinion", ","),
        "chemical_name": v(m, "chemicalName"), "identified_ingredients": identified, "cmr": cmr_text(m),
        "update_date": (v(m, "publicationDate")[:10]),
    }
    return [re.sub(r"\r\n?", "\n", d[c]) for c in COLS[annex]]


def ref_key(row):
    m = re.match(r"(\d+)(.*)", row[0])
    return (int(m.group(1)), m.group(2)) if m else (99999, row[0])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ham", help="ham JSON yanıtlarının kaydedileceği klasör")
    a = ap.parse_args()
    ing, sub = fetch("ingredient"), fetch("substance")
    if a.ham:
        os.makedirs(a.ham, exist_ok=True)
        json.dump(ing, open(os.path.join(a.ham, "ingredient.json"), "w"))
        json.dump(sub, open(os.path.join(a.ham, "substance.json"), "w"))
    names_by_id = {m["substanceId"][0]: v(m, "inciName") for m in ing if m.get("substanceId") and v(m, "inciName")}

    os.makedirs(OUT, exist_ok=True)
    csv.field_size_limit(10 ** 9)
    current = {n.upper() for n in names_by_id.values()}
    for annex in ANNEXES:
        rows = sorted((annex_row(m, annex, names_by_id) for m in sub if v(m, "annexNo") == annex), key=ref_key)
        # Bir ek kaydının bağlı olduğu INCI adı CosIng'den çıkarılınca (ör. II/360 SAFROLE) servis artık o adı
        # döndürmüyor. Önceki CSV'deki bu adlar korunur; yoksa etikette görülen eski ad yasak kaydıyla eşleşmez.
        p = os.path.join(OUT, "annex.%s.csv" % annex)
        if os.path.exists(p):
            k = COLS[annex].index("identified_ingredients")
            prev = defaultdict(list)
            for r in list(csv.reader(open(p, encoding="utf-8")))[1:]:
                if len(r) == len(COLS[annex]):
                    prev[r[0]].append(r[k])
            seen = defaultdict(int)
            for row in rows:
                seen[row[0]] += 1
            for row in rows:
                if seen[row[0]] != 1 or len(prev.get(row[0], [])) != 1:
                    continue   # aynı numarayı taşıyan birden çok kayıt: hangisinin hangisi olduğu belirsiz
                have = {n.strip().upper() for n in row[k].split(";")}
                keep = [n.strip() for n in re.split(r";|,(?!\d)|(?<!\d),", prev[row[0]][0])
                        if n.strip() and n.strip().upper() not in current and n.strip().upper() not in have]
                if keep:
                    row[k] = "; ".join([row[k]] + keep if row[k] else keep)
        with open(os.path.join(OUT, "annex.%s.csv" % annex), "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(COLS[annex])
            w.writerows(rows)
        print("Ek %s: %d satır" % (annex, len(rows)))

    new = {}
    for m in ing:
        n = v(m, "inciName")
        if n:
            new[n] = [n, v(m, "cosmeticRestriction", ", "), ", ".join(m.get("functionName") or []), v(m, "substanceId")]
    # Önceki listede olup CosIng'den çıkarılan adlar ingredients_eski.csv'de birikir
    csv.field_size_limit(10 ** 9)
    old = {}
    for fn in ("ingredients_eski.csv", "ingredients.csv"):
        p = os.path.join(OUT, fn)
        if os.path.exists(p):
            for r in csv.DictReader(open(p, encoding="utf-8")):
                n = r["inci_name"].strip()
                if n and n not in new:
                    old[n] = [n, r["restriction"], r["functions"], r.get("substance_id", "")]   # ek bağlantısı korunur (ör. SAFROLE -> II/360)
    for fn, data in (("ingredients.csv", new), ("ingredients_eski.csv", old)):
        with open(os.path.join(OUT, fn), "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(ING_COLS)
            w.writerows(data[k] for k in sorted(data))
    print("INCI: %d güncel, %d CosIng'den çıkarılmış (eski)" % (len(new), len(old)))

    son = max(v(m, "publicationDate")[:10] for m in sub)
    with open(os.path.join(OUT, "surum.txt"), "w", encoding="utf-8") as f:
        f.write("cosing-api %s %s\n" % (datetime.date.today().isoformat(), son))
    with open(os.path.join(OUT, "LICENSE.txt"), "w", encoding="utf-8") as f:
        f.write("Kaynak: Avrupa Komisyonu, CosIng veritabanı (https://ec.europa.eu/growth/tools-databases/cosing/).\n"
                "Komisyon belgelerinin yeniden kullanımı 2011/833/AB Komisyon Kararı ile kaynak gösterilerek serbesttir.\n")
    print("kaynak/cosing yazıldı (CosIng'deki en son yayın: %s)" % son)


if __name__ == "__main__":
    sys.exit(main())
