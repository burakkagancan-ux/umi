# -*- coding: utf-8 -*-
"""
"Birlikte dikkat" eşleşmelerini üretir: data/eslesmeler.json

Kullanım:  python3 gen_eslesmeler.py   (önce gen_e_kodlari.py ve gen_kozmetik.py çalışmış olmalı)

İki tür kural var:
  - "cift":   iki grubun her birinden en az bir madde aynı listede (ör. benzoat + C vitamini)
  - "toplam": aynı gruptan en az iki farklı madde (AB'nin "toplam" sınırı ya da grup ADI'si olan maddeler)
Her kural resmi bir kaynağa dayanır. Kaynağı olmayan "şu ikisi birlikte zehir olur" türü iddialar eklenmez.
Metinler risk değil olasılık bildirir; miktar etiketten bilinemez.
Kozmetik INCI listeleri kozmetik.json'daki AB koşul metinlerinden üretilir (nitrozamin, florür toplamı).
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "eslesmeler.json")
VERSION = "0.1.0"
LAST_UPDATED = "2026-10-16"

FDA_BENZ = "https://www.fda.gov/food/process-contaminants-food/questions-and-answers-occurrence-benzene-soft-drinks-and-other-beverages"
HC_BENZ = "https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/chemical-contaminants/food-processing-induced-chemicals/benzene.html"
BFR_SOUTH = "https://www.bfr.bund.de/cm/349/hyperactivity_and_additives_is_there_an_association.pdf"
POLY = "https://www.cargill.com/food-beverage/emea/eu-labeling-and-legislation"
PHOS = "https://www.foodingredientsfirst.com/news/EFSA-issues-new-EU-phosphates-limits-advice-warns-that-safe-levels-may-be-being-exceeded.html"
ALU = "https://www.nutraingredients.com/Article/2008/07/16/efsa-sets-new-intake-level-for-aluminium-in-food/"
SULF = "https://www.denib.gov.tr/files/downloads/sirku_ekleri/2016-02-ek1-1.pdf"
COSING = "https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en"
FORM = "https://cosmetic.chemlinked.com/news/cosmetic-news/eu-lowers-the-labelling-threshold-for-formaldehyde-releasers-in-cosmetics-regulation"
GLU = "https://www.efsa.europa.eu/en/press/news/170712"
NIT = "https://www.efsa.europa.eu/en/press/news/170615"
NIT_OP = "https://efsa.europa.eu/en/efsajournal/pub/4786"
PS = "https://www.legislation.gov.uk/eur/2020/356"
GAL = "https://eur-lex.europa.eu/eli/reg/2018/1481/oj"
VITA = "https://eur-lex.europa.eu/eli/reg/2024/996/oj"
SORB_BENZ = "https://www.legislation.gov.uk/eur/2008/1333/annex/II/table/34/group/1/2020-12-31"
CARR = "https://www.efsa.europa.eu/en/efsajournal/pub/5238"
SORBITAN = "https://www.efsa.europa.eu/en/efsajournal/pub/4788"


def food_rules(edb):
    alu = sorted(i["id"] for i in edb["ingredients"] if "aluminium" in i["flags"])
    return [
        {"id": "benzen", "mode": "gida", "type": "cift", "level": "yellow",
         "title": "Birlikte Dikkat: Benzoat + C vitamini",
         "groups": [{"label": "Benzoat", "ids": ["E210", "E211", "E212", "E213"]},
                    {"label": "C vitamini", "ids": ["E300", "E301", "E302"]}],
         "text": "Benzoatlı koruyucu ile C vitamini (askorbik asit) birlikte bulunduğunda ısı, ışık ve metal iyonlarının etkisiyle eser miktarda benzen oluşabilir. Benzen kanserojen bir maddedir. Kanada'nın 2007 taramasında 139 içeceğin çoğunda miktar içme suyu sınırının (5 µg/L) altında kaldı; üreticiler formüllerini buna göre düzenledi. Ürünü serin ve karanlık yerde saklamak oluşumu azaltır.",
         "sources": [HC_BENZ, FDA_BENZ]},
        {"id": "southampton", "mode": "gida", "type": "cift", "level": "yellow",
         "title": "Birlikte Dikkat: Southampton renklendiricileri + sodyum benzoat",
         "groups": [{"label": "Renklendirici", "ids": ["E102", "E104", "E110", "E122", "E124", "E129"]},
                    {"label": "Sodyum benzoat", "ids": ["E211"]}],
         "text": "2007'deki Southampton çalışmasında çocuklara bu renklendiriciler sodyum benzoatla birlikte karışım olarak verildi ve davranış üzerinde olası bir etki görüldü. Bu üründe aynı ikili var. Etkinin hangi maddeden geldiği ayırt edilemedi; Alman BfR açık bir neden-sonuç kanıtı olmadığını belirtti. AB, renklendiriciler için uyarı etiketini zorunlu tuttu.",
         "sources": [BFR_SOUTH]},
        {"id": "polioller", "mode": "gida", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla poliol (şeker alkolü)",
         "groups": [{"label": "Poliol", "ids": ["E420", "E421", "E953", "E964", "E965", "E966", "E967", "E968"]}],
         "text": "Poliollerin laksatif (ishal yapıcı) etkisi toplam miktara bağlıdır. AB kuralına göre eklenen poliollerin toplamı %10'u aşarsa etikette “aşırı tüketimi laksatif etki yapabilir” uyarısı zorunludur.",
         "sources": [POLY]},
        {"id": "fosfatlar", "mode": "gida", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla fosfat katkısı",
         "groups": [{"label": "Fosfat", "ids": ["E338", "E339", "E340", "E341", "E343", "E450", "E451", "E452"]}],
         "text": "EFSA 2019'da fosfat katkıları için fosfor cinsinden ortak bir günlük alım sınırı (40 mg/kg vücut ağırlığı) belirledi ve bebek, çocuk ve fosfatlı gıdaları çok tüketen gençlerde bu sınırın aşılabileceğini bildirdi. Sınır tüm fosfat katkılarının toplamı içindir.",
         "sources": [PHOS]},
        {"id": "aluminyum", "mode": "gida", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla alüminyumlu katkı",
         "groups": [{"label": "Alüminyumlu katkı", "ids": alu}],
         "text": "EFSA 2008'de alüminyum için haftalık alım sınırını 1 mg/kg vücut ağırlığı olarak belirledi ve çok tüketen kişilerde bu sınırın aşılabileceğini bildirdi. Sınır tüm kaynakların toplamı içindir.",
         "sources": [ALU]},
        {"id": "sulfitler", "mode": "gida", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla sülfit",
         "groups": [{"label": "Sülfit", "ids": ["E220", "E221", "E222", "E223", "E224", "E226", "E227", "E228"]}],
         "text": "Sülfit alerjeni için eşik tek tek maddelere değil toplama bakar: toplam kükürt dioksit 10 mg/kg (ya da 10 mg/L) üzerindeyse alerjen olarak etikette belirtilmesi zorunludur.",
         "sources": [SULF]},
        # 04.10.2026 genişletme
        {"id": "glutamatlar", "mode": "gida", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla glutamat",
         "groups": [{"label": "Glutamat", "ids": ["E620", "E621", "E622", "E623", "E624", "E625"]}],
         "text": "EFSA 2017'de glutamik asit ve tuzları (E 620–625) için altısına ortak bir günlük alım sınırı belirledi: 30 mg/kg vücut ağırlığı. Bazı grupların, özellikle küçük çocukların, bu sınırı aşabileceğini bildirdi. Sınır tüm glutamat katkılarının toplamı içindir.",
         "sources": [GLU]},
        {"id": "nitrit_nitrat", "mode": "gida", "type": "cift", "level": "yellow",
         "title": "Birlikte Dikkat: Nitrit + nitrat",
         "groups": [{"label": "Nitrit", "ids": ["E249", "E250"]}, {"label": "Nitrat", "ids": ["E251", "E252"]}],
         "text": "Nitrat vücutta kısmen nitrite dönüşür. EFSA 2017'de yalnızca katkılardan gelen alımın güvenli sınırlar içinde kaldığını, ama sebze ve su gibi tüm kaynaklar birlikte hesaplandığında sınırın her yaş grubunda aşılabileceğini bildirdi. Onaylı miktarlarda kullanılan nitritin nitrozamin oluşumuna katkısını düşük endişe olarak değerlendirdi.",
         "sources": [NIT, NIT_OP]},
        {"id": "polisorbatlar", "mode": "gida", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla polisorbat",
         "groups": [{"label": "Polisorbat", "ids": ["E432", "E433", "E434", "E435", "E436"]}],
         "text": "EFSA 2015'te polisorbatlar (E 432–436) için ortak bir günlük alım sınırı belirledi: 25 mg/kg vücut ağırlığı. Sınır tüm polisorbatların toplamı içindir.",
         "sources": [PS]},
        {"id": "gallat_tbhq_bha", "mode": "gida", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla sentetik antioksidan",
         "groups": [{"label": "Propil gallat, TBHQ, BHA", "ids": ["E310", "E319", "E320"]}],
         "text": "AB katkı tüzüğüne göre propil gallat, TBHQ ve BHA birlikte kullanılırsa her birinin miktarı orantılı olarak azaltılmalıdır; üst sınır toplama uygulanır.",
         "sources": [GAL]},
        # 16.10.2026 genişletme
        {"id": "sorbat_benzoat", "mode": "gida", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla sorbat ya da benzoat",
         "groups": [{"label": "Sorbat / benzoat", "ids": ["E200", "E202", "E210", "E211", "E212", "E213"]}],
         "text": "AB katkı tüzüğü birçok gıda grubunda sorbik asit, sorbatlar, benzoik asit ve benzoatlar için tek bir üst sınır koyar: bu koruyucular tek başına ya da birlikte eklenebilir, sınır toplama uygulanır ve serbest asit cinsinden hesaplanır.",
         "sources": [SORB_BENZ]},
        {"id": "karagenan", "mode": "gida", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Karagenan + işlenmiş Eucheuma yosunu",
         "groups": [{"label": "Karagenan", "ids": ["E407", "E407a"]}],
         "text": "EFSA 2018'de karagenan (E 407) ve işlenmiş Eucheuma yosunu (E 407a) için ortak bir günlük alım sınırı belirledi: 75 mg/kg vücut ağırlığı. Verilerdeki belirsizlikler nedeniyle sınırı geçici saydı. Sınır ikisinin toplamı içindir.",
         "sources": [CARR]},
        {"id": "sorbitan", "mode": "gida", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla sorbitan esteri",
         "groups": [{"label": "Sorbitan esteri", "ids": ["E491", "E492", "E493", "E494", "E495"]}],
         "text": "EFSA 2017'de sorbitan esterleri (E 491–495) için ortak bir günlük alım sınırı belirledi: sorbitan cinsinden 10 mg/kg vücut ağırlığı. Hiçbir yaş grubunda alımın bu sınırı aşmadığını bildirdi. Sınır tüm sorbitan esterlerinin toplamı içindir.",
         "sources": [SORBITAN]},
    ]


def cos_rules(kdb):
    amines, nitros, fluor = set(), set(), set()
    for e in kdb["entries"]:
        t = " ".join([e.get("product_type", ""), e.get("max", ""), e.get("conditions_en", "")])
        if e["annex"] == "III" and re.search(r"use with nitro\s?sating|nitrosating (agents|systems)", t, re.I):
            amines.update(e["inci"])
        if re.search(r"Avoid formation of nitrosamines|Not to be used with secondary and/or tertiary amines", t, re.I):
            nitros.update(e["inci"])
        if re.search(r"total F concentration", t, re.I):
            fluor.update(a for a in e["inci"] if "FLUOR" in a)
    fr = sorted({a for e in kdb["entries"] if "formaldehyde_releaser" in e["flags"] for a in e["inci"]})
    par = sorted({a for e in kdb["entries"] if e["id"] in ("V/12", "V/12a") for a in e["inci"]
                  if re.search(r"PARABEN$", a) and "/" not in a})
    def grp(*ids):
        return sorted({a for e in kdb["entries"] if e["id"] in ids for a in e["inci"] if "/" not in a and "(" not in a})
    extra = [
        {"id": "tiyoglikolat", "mode": "koz", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla tiyoglikolat",
         "groups": [{"label": "Tiyoglikolat", "inci": grp("III/2a", "III/2b")}],
         "text": "Perma, düzleştirici ve tüy dökücülerde kullanılan tiyoglikolatların AB sınırı tiyoglikolik asit cinsinden hesaplanır; aynı üründeki tüm tiyoglikolatlar bu sınıra birlikte sayılır.",
         "sources": [COSING]},
        {"id": "peroksit", "mode": "koz", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla hidrojen peroksit kaynağı",
         "groups": [{"label": "Hidrojen peroksit ya da salan madde", "inci": grp("III/12")}],
         "text": "AB'de hidrojen peroksit sınırı ürünün “içerdiği ya da saldığı” toplam miktara uygulanır (ör. diş beyazlatıcıda tüketiciye satılanlarda en fazla %0,1). Karbamid peroksit gibi salan maddeler de bu toplama girer.",
         "sources": [COSING]},
        {"id": "kozmetik_sulfit", "mode": "koz", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla sülfit",
         "groups": [{"label": "Sülfit", "inci": grp("III/99", "V/9")}],
         "text": "Kozmetikte inorganik sülfit ve bisülfitlerin AB sınırı serbest kükürt dioksit cinsinden hesaplanır; aynı üründeki tüm sülfitler bu sınıra birlikte sayılır. Sülfit hassasiyeti olanlar için ayrıca önemlidir.",
         "sources": [COSING]},
        {"id": "salisilat", "mode": "koz", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Salisilik asit ve tuzları",
         "groups": [{"label": "Salisilik asit / salisilat", "inci": grp("III/98", "V/3")}],
         "text": "Salisilik asit ve tuzlarının AB sınırı asit cinsinden hesaplanır ve birlikte değerlendirilir. 3 yaş altı çocuklara yönelik ürünlerde (şampuan hariç) kullanılmaz.",
         "sources": [COSING]},
        {"id": "benzoat_koz", "mode": "koz", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Benzoik asit ve sodyum benzoat",
         "groups": [{"label": "Benzoik asit / benzoat", "inci": grp("V/1")}],
         "text": "Koruyucu olarak benzoik asit ve sodyum benzoatın AB sınırı asit cinsinden hesaplanır; ikisi birlikte bu sınıra sayılır.",
         "sources": [COSING]},
        {"id": "sorbat_koz", "mode": "koz", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Sorbik asit ve sorbatlar",
         "groups": [{"label": "Sorbik asit / sorbat", "inci": grp("V/4")}],
         "text": "Koruyucu olarak sorbik asit ve tuzlarının AB sınırı asit cinsinden %0,6'dır; aynı üründekiler bu sınıra birlikte sayılır.",
         "sources": [COSING]},
        {"id": "kuaterner", "mode": "koz", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla kuaterner amonyum yumuşatıcı",
         "groups": [{"label": "Setrimonyum / steartrimonyum / behentrimonyum klorür", "inci": ["BEHENTRIMONIUM CHLORIDE", "CETRIMONIUM CHLORIDE", "STEARTRIMONIUM CHLORIDE"]}],
         "text": "Saç kremi gibi ürünlerde bu maddelerin AB sınırı tek tek değil, birlikte kullanıldığında toplamları üzerinden belirlenir (durulanan saç ürünlerinde toplam %2,5 ya da behentrimonyum ile %5).",
         "sources": [COSING]},
        {"id": "a_vitamini", "mode": "koz", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla A vitamini türevi",
         "groups": [{"label": "Retinol ve esterleri", "inci": grp("III/376")}],
         "text": "AB 2024/996 ile retinol, retinil asetat ve retinil palmitat için toplam sınır getirildi: vücut losyonlarında %0,05, diğer ürünlerde %0,3 retinol eşdeğeri. Sınır üçünün toplamına uygulanır; günlük A vitamini alımının bir kısmının kozmetikten gelebileceği gerekçesiyle.",
         "sources": [VITA, COSING]},
    ]
    return extra + [
        {"id": "nitrozamin", "mode": "koz", "type": "cift", "level": "yellow",
         "title": "Birlikte Dikkat: Nitrozamin oluşturabilecek ikili",
         "groups": [{"label": "Nitrozamin oluşturan maddelerle birlikte kullanılmaması gereken madde", "inci": sorted(amines - nitros)},
                    {"label": "Nitrozamin oluşturabilen madde", "inci": sorted(nitros)}],
         "text": "Bazı aminler, nitrit ya da bronopol gibi maddelerle birlikte nitrozamin oluşturabilir; nitrozaminlerin bir kısmı kanserojendir. AB kozmetik yönetmeliği bu yüzden bu aminlerin “nitrozamin oluşturan sistemlerle birlikte kullanılmamasını” şart koşar. Bu üründe iki grup birlikte görünüyor.",
         "sources": [COSING]},
        {"id": "formaldehit", "mode": "koz", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla formaldehit salıcı",
         "groups": [{"label": "Formaldehit salıcı", "inci": fr}],
         "text": "AB'de etiket uyarısı (“releases formaldehyde”) tek bir koruyucuya değil, üründe salınabilecek toplam formaldehite bakar: toplam %0,001'i aşarsa uyarı zorunludur. Birden fazla salıcı bu toplamı artırır.",
         "sources": [FORM]},
        {"id": "parabenler", "mode": "koz", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla paraben",
         "groups": [{"label": "Paraben", "inci": par}],
         "text": "AB'de parabenlerin tek tek sınırının yanında toplam sınırı da vardır: propil ve bütil paraben toplamı %0,14'ü, tüm parabenlerin toplamı %0,8'i geçemez.",
         "sources": [COSING]},
        {"id": "florurler", "mode": "koz", "type": "toplam", "level": "yellow", "min": 2,
         "title": "Birlikte Dikkat: Birden fazla florür",
         "groups": [{"label": "Florür", "inci": sorted(fluor)}],
         "text": "AB'de ağız bakım ürünlerinde florür bileşikleri birlikte kullanılırsa toplam flor %0,15'i geçemez. 6 yaş altı çocuklar için diş macununda özel uyarılar vardır; çocuklar için ayrıca etikete bakın.",
         "sources": [COSING]},
    ]


def main():
    edb = json.load(open(os.path.join(HERE, "data", "e_kodlari.json"), encoding="utf-8"))
    kdb = json.load(open(os.path.join(HERE, "data", "kozmetik.json"), encoding="utf-8"))
    rules = food_rules(edb) + cos_rules(kdb)
    known = {i["id"] for i in edb["ingredients"]}
    for r in rules:
        for g in r["groups"]:
            for i in g.get("ids", []):
                assert i in known, (r["id"], i)
            assert g.get("ids") or g.get("inci"), (r["id"], g["label"])
    out = {"version": VERSION, "last_updated": LAST_UPDATED,
           "meta": {"description": "Birlikte bulunduğunda ayrıca dikkat gerektiren madde eşleşmeleri. cift: iki grubun her birinden en az biri; toplam: aynı gruptan en az 'min' farklı madde.",
                    "note": "Metinler olasılık bildirir; miktar etiketten bilinmez. Her kural resmi bir kaynağa dayanır."},
           "rules": rules}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("eslesmeler.json: %d kural" % len(rules), {r["id"]: sum(len(g.get("ids", g.get("inci", []))) for g in r["groups"]) for r in rules})


if __name__ == "__main__":
    main()
