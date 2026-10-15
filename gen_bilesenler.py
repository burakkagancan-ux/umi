# -*- coding: utf-8 -*-
"""
E kodu olmayan bileşenler listesini (data/bilesenler.json) üretir.
Faz 1 kapsamı: gizli şeker, palm yağı, 14 yasal alerjen (gluten dahil),
laktoz, hayvansal kaynak (vegan/vejetaryen), ultra işlenmiş gıda (UPF) işaretleri.

Kullanım:  python3 gen_bilesenler.py   (data/e_kodlari.json ile aynı depoda)
- e_kodlari.json içinde zaten bulunan isimler (jelatin, karmin, soya lesitini...)
  burada tekrar edilmez; çakışan eş anlamlılar atılır ve ekrana yazılır.
"""
import json, re, os, datetime

VERSION = "0.3.0"
HERE = os.path.dirname(os.path.abspath(__file__))
from uretec_ortak import kaynak_json, load_en   # ortak yardımcılar (uretec_ortak.py)


OUT = os.path.join(HERE, "data", "bilesenler.json")
EDB = os.path.join(HERE, "data", "e_kodlari.json")

TR = str.maketrans("çğıöşüâîû", "cgiosuaiu")
def norm(s):
    s = s.replace("İ", "i").replace("I", "ı").lower().translate(TR)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

# Bayraklar ve maddeler: kaynak/bilesenler.json
BL = kaynak_json("bilesenler.json")
FLAGS = BL["bayraklar"]

# Profil ekranındaki alerjen listesi (TGK Etiketleme Yönetmeliği Ek-1 sırası ve adları; kısa gösterim)
ALLERGENS = [
    ["allergen_gluten", "Gluten içeren tahıllar"], ["allergen_crustacean", "Kabuklular"],
    ["allergen_egg", "Yumurta"], ["allergen_fish", "Balık"], ["allergen_peanut", "Yer fıstığı"],
    ["allergen_soy", "Soya"], ["allergen_milk", "Süt"], ["allergen_nuts", "Sert kabuklu meyveler"],
    ["allergen_celery", "Kereviz"], ["allergen_mustard", "Hardal"], ["allergen_sesame", "Susam"],
    ["allergen_sulphite", "Kükürt dioksit ve sülfitler"], ["allergen_lupin", "Acı bakla (lupin)"], ["allergen_mollusc", "Yumuşakçalar"],
]

# E kodu kategorisi -> UPF işaret sınıfı (NOVA'daki "kozmetik katkılar")
UPF_E_CATEGORIES = {
    "Renklendirici": "renklendirici", "Lezzet artırıcı": "lezzet artırıcı",
    "Tatlandırıcı": "tatlandırıcı", "Emülgatör": "emülgatör",
    "Kıvam artırıcı / jelleştirici": "kıvam artırıcı", "Modifiye nişasta": "modifiye nişasta",
    "Parlatıcı / kaplama maddesi": "parlatıcı",
}

# kaynak/bilesenler.json "maddeler": {id, ad, adlar (eş anlamlılar), bayraklar, not, ek}
# ek: upf_class = UPF sınıfı adı; short_ok = 3 harften kısa eş anlamlıya izin. Düz metin satırları bölüm başlığıdır, atlanır.
ITEMS = [(x["id"], x["ad"], x["adlar"], x["bayraklar"], x["not"], x["ek"]) for x in BL["maddeler"] if isinstance(x, dict)]

# Cümle düzeyinde "eser miktarda içerebilir" tetikleyicileri (normalize edilmiş)
MAY_TRIGGERS = ["icerebilir", "iceribilir", "eser", "ayni tesiste", "ayni hatta", "ayni uretim", "bulunabilir"]
# İngilizce "may contain" ifadeleri ileriye bakar: tetikleyiciden cümle sonuna kadar (Türkçe "içerebilir" geriye bakar). (08.10.2026, B-08)
MAY_FORWARD = ["may contain", "may also contain", "may contain traces", "traces of", "made in a factory", "made in a facility",
               "produced in a factory", "produced in a facility", "manufactured in a facility", "manufactured in a factory",
               "manufactured on shared equipment", "processed in a facility", "packed in a facility", "facility that also",
               "factory that also", "factory which also", "shared equipment", "same equipment", "same production line"]
NEGATIONS = ["icermez", "icermiyor", "yoktur", "yok", "icermemektedir", "bulunmaz", "bulunmamaktadir", "ilave edilmemistir", "eklenmemistir", "katilmamistir", "kullanilmamistir", "kullanilmamaktadir", "free"]
# İngilizce önden olumsuzluk ("no added sugar", "free from milk"): yalnızca İngilizce görünen metinde, maddenin hemen önünde
NEG_PREFIX = ["no", "non", "without", "no added", "free from", "contains no", "no artificial", "not contain", "contain no"]
AROMA_NEXT = ["aromasi", "aromali", "aroma", "esansi", "flavour", "flavouring", "flavor", "flavoring", "flavoured", "flavored"]

# İngilizce eş anlamlılar: kaynak/ingilizce_esanlamlilar.tsv (hedef<TAB>ad<TAB>koşul<TAB>kaynak); E kodu satırlarını gen_e_kodlari.py okur.
EN = load_en()

def main():
    edb = json.load(open(EDB, encoding="utf-8"))
    e_aliases = {}
    for it in edb["ingredients"]:
        for a in it["aliases"] + it.get("aliases_en", []) + it.get("en_only", []):
            ids = e_aliases.setdefault(norm(a), [])
            if it["id"] not in ids: ids.append(it["id"])
    seen, items, dropped = {}, [], []
    for (iid, name, aliases, flags, note, extra) in ITEMS:
        for f in flags:
            assert f in FLAGS, (iid, f)
        keep = []
        for a in aliases:
            n = norm(a)
            if not n: continue
            if len(n) < 3 and not extra.get("short_ok"):
                dropped.append((iid, a, "çok kısa")); continue
            if n in e_aliases:
                dropped.append((iid, a, "e_kodlari.json'da var: " + ",".join(e_aliases[n]))); continue
            if seen.get(n) == iid:
                continue
            if n in seen:
                raise SystemExit("Aynı eş anlamlı iki maddede: %s (%s, %s)" % (a, seen[n], iid))
            seen[n] = iid
            keep.append(a)
        rec = {"id": iid, "name": name, "aliases": keep, "flags": flags}
        for a, k in EN.get(iid, []):
            n = norm(a)
            if n in e_aliases:
                dropped.append((iid, a, "e_kodlari.json'da var: " + ",".join(e_aliases[n]))); continue
            if seen.get(n) == iid:
                continue
            if n in seen:
                raise SystemExit("İngilizce eş anlamlı başka maddede: %s (%s, %s)" % (a, seen[n], iid))
            seen[n] = iid
            rec.setdefault("en_only" if k == "en" else "aliases_en", []).append(a)
        if note: rec["note"] = note
        if extra.get("upf_class"): rec["upf_class"] = extra["upf_class"]
        if extra.get("short_ok"): rec["short_ok"] = True
        items.append(rec)
    out = {
        "meta": {
            "version": VERSION,
            "generated": datetime.date.today().isoformat(),
            "description": "E kodu olmayan bileşenler: gizli şeker, palm yağı, 14 yasal alerjen, laktoz, hayvansal kaynak, ultra işlenmiş gıda (UPF) işaretleri.",
            "flags": FLAGS,
            "allergens": ALLERGENS,
            "upf_e_categories": UPF_E_CATEGORIES,
            "may_triggers": MAY_TRIGGERS,
            "negations": NEGATIONS,
            "may_forward": MAY_FORWARD,
            "neg_prefix": NEG_PREFIX,
            "aroma_next": AROMA_NEXT,
            "sources": [
                {"name": "TGK Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği, Ek-1 (alerjenler)", "ref": "Resmî Gazete 26.01.2017, sayı 29960 (1. mükerrer); son değişiklik 06.04.2024",
                 "note": "03.10.2026'da Ek-1'in Türkçe metniyle karşılaştırıldı (DENİB genelge eki kopyası: https://www.denib.gov.tr/files/downloads/sirku_ekleri/2016-02-ek1-1.pdf ; resmi metin mevzuat.gov.tr'den okunamadı). 14 madde, sıra ve muafiyetler uyumlu; kılçıksız buğday, tritikale (melez), Brezilya fındığı, Queensland fındığı, balık jelatini/isinglass ve bitkisel sterol muafiyetleri eklendi."},
                {"name": "DSÖ (WHO) Guideline: Sugars intake for adults and children (2015)", "note": "'Serbest şeker' tanımı: eklenen şekerler + bal, şuruplar, meyve suyu ve konsantreleri."},
                {"name": "Monteiro ve ark., Ultra-processed foods, diet quality, and health using the NOVA classification system (FAO, 2019)", "note": "UPF işaretleri: aroma vericiler, lezzet artırıcılar, renklendiriciler, emülgatörler, tatlandırıcılar, kıvam artırıcılar; invert şeker, maltodekstrin, dekstroz, laktoz, yüksek fruktozlu mısır şurubu, meyve suyu konsantresi; hidrojenize/interesterifiye yağlar; hidrolize proteinler, soya protein izolatı, gluten, kazein, peynir altı suyu proteini, mekanik ayrılmış et."},
            ],
            "sources_faz2": [
                {"name": "TGK Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği, Ek-2 (ek bilgi gerektiren gıdalar)", "note": "Yüksek kafein (150 mg/L üzeri), tatlandırıcı, aspartam (fenilalanin kaynağı), poliol (%10 üzeri laksatif) ve meyankökü ifadeleri. Metin: https://www.denib.gov.tr/files/downloads/sirku_ekleri/2016-02-ek1-1.pdf"},
                {"name": "TGK Gıda Katkı Maddeleri Yönetmeliği / AB 1333/2008 Ek V", "note": "E102, E104, E110, E122, E124, E129 içeren gıdalarda çocukların aktivitesi ve dikkatine ilişkin uyarı zorunludur."},
                {"name": "EFSA (2015) Scientific Opinion on the safety of caffeine", "note": "Hamile ve emziren kadınlar için günde 200 mg'a kadar kafein endişe oluşturmaz."},
                {"name": "Bebeklerde botulizm: bal 1 yaşından küçüklere verilmez (DSÖ, CDC, Sağlık Bakanlığı önerileri)", "note": "Genel bilgi; bu çalışmada tek tek kaynakla doğrulanmadı."},
                {"name": "Evcil hayvanlar için zehirli gıdalar (ASPCA Animal Poison Control)", "note": "Ksilitol, kakao/çikolata, üzüm/kuru üzüm, soğan/sarımsak, makadamya, alkol, kafein. Genel bilgi; bu çalışmada tek tek kaynakla doğrulanmadı."},
            ],
            "caveats": [
                "Bileşen eşleştirme yalnızca etiketteki 'İçindekiler' yazısına dayanır; miktar bilgisi yoktur.",
                "Alerjen sonucu bir onay değildir: 'tespit edilmedi' ürünün güvenli olduğu anlamına gelmez.",
                "UPF işaretleri bir puan değildir; NOVA'nın tanımladığı işaret maddelerinin listesidir.",
                "Vegan/vejetaryen sonucu yalnızca içerik adlarına dayanır; üretim süreci ve çapraz bulaşma bilinmez.",
                "Hamile/bebek/çocuk, PKU ve evcil hayvan kontrolleri yalnızca bilinen maddeleri arar; miktar bilinmez ve sonuç bir onay değildir.",
            ],
            "counts": {"items": len(items), "aliases": sum(len(i["aliases"]) for i in items),
                       "aliases_en": sum(len(i.get("aliases_en", [])) + len(i.get("en_only", [])) for i in items)},
        },
        "items": items,
    }
    ids = set(i["id"] for i in items) | set(it["id"] for it in edb["ingredients"])
    for k in EN:
        assert k in ids, ("ingilizce_esanlamlilar.tsv: bilinmeyen hedef", k)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("Yazıldı:", OUT, out["meta"]["counts"])
    for d in dropped: print("  atıldı:", d)

if __name__ == "__main__":
    main()
