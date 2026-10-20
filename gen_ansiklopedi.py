#!/usr/bin/env python3
"""Ansiklopedi (madde sözlüğü) verisini üretir.

Girdi: kaynak/ansiklopedi.json (elle yazılan tam kayıtlar, kategori tanımları, kurum ve bayrak eşlemeleri),
data/e_kodlari.json (ad, eş anlamlılar, kategori, risk, bayraklar, kaynaklar), data/e_aciklama.json (tek cümlelik tanım),
data/bilesenler.json (alerjen adları).
Çıktı: data/ansiklopedi.json (dizin: arama ve liste için kısaltılmış kayıtlar; metinler yerine çeviri anahtarı),
data/ansiklopedi_tr.json (dizinin ve ortak Türkçe metinler), data/ansiklopedi/<kimlik>.json (madde sayfasının tam kaydı) ve
data/ansiklopedi/tr/<kimlik>.json (yalnızca o sayfanın Türkçe metinleri). Sayfa dosyaları madde açılınca iner.
gen_e_kodlari.py ve gen_e_aciklama.py'den SONRA çalıştırılır. Elle incelenmemiş E kodlarının sayfası otomatik oluşturulur
(review: "auto"); bunlarda kanıt düzeyi ve son inceleme tarihi boştur.
"""
import csv
import datetime
import hashlib
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
VERSION = "0.1.0"
TRMAP = str.maketrans("çğıöşüâîûÇĞİÖŞÜÂÎÛI", "cgiosuaiuCGIOSUAIUI")
RISK = {"green": "green", "yellow": "amber", "red": "red", "unrated": "amber"}

# Arayüzde kullanılan sabit adlar (ileride başka dil eklenirse ansiklopedi_<dil>.json'a çevrilir)
UI = {
    "risk.green": "Özel uyarı yok", "risk.amber": "Dikkat", "risk.red": "Uyarı",
    "evidence.strong": "Güçlü", "evidence.moderate": "Orta", "evidence.limited": "Sınırlı",
    "status.approved": "İzinli", "status.label_required": "Etiket uyarısı", "status.restricted": "Sınırlı izin",
    "status.concern": "Uyarı notu", "status.classified": "Sınıflandırıldı", "status.banned": "Yasak",
    "status.withdrawn": "İzni kaldırıldı", "status.not_listed": "Listede yok", "status.reviewed": "Değerlendirildi",
    "region.EU": "AB", "region.TR": "Türkiye", "region.US": "ABD", "region.US-CA": "Kaliforniya", "region.INT": "Uluslararası",
    "diet.yes": "Evet", "diet.no": "Hayır", "diet.unknown": "Bilinmiyor",
    "source.plant": "Bitkisel", "source.animal": "Hayvansal", "source.insect": "Böcek", "source.synthetic": "Sentetik",
    "source.mineral": "Mineral", "source.plant_or_animal": "Bitkisel ya da hayvansal", "source.unknown": "Bilinmiyor",
    "ptype.food": "Gıda", "ptype.cosmetic": "Kozmetik", "ptype.cleaning": "Temizlik",
    "profile.vegan": "Vegan", "profile.veg": "Vejetaryen", "profile.lactose": "Laktoz intoleransı",
    "profile.preg": "Hamilelik / emzirme", "profile.baby": "Bebek (1 yaş altı)", "profile.child": "Çocuk",
    "profile.pku": "Fenilketonüri (PKU)", "profile.pet": "Evcil hayvan", "profile.salt": "Tansiyon / tuz kısıtlaması",
    "eval.inventory": "Bu uygulamanın uyarı ölçütlerinden (AB yasağı, zorunlu uyarı, IARC sınıflaması vb.) hiçbirine girmiyor. Bu bir onay değildir.",
    "reg.tr_listed": "Türk Gıda Kodeksi'nin izinli katkı maddeleri listesinde.",
    "reg.tr_not_listed": "Türk Gıda Kodeksi'nin güncel (2023) izinli katkı maddeleri listesinde yok.",
    "eff.resmi": "Resmi uyarı", "eff.bildirildi": "Bazı kişilerde bildirildi", "eff.tutarsiz": "Kanıt tutarsız",
    "eff.hayvan": "Yalnızca hayvan çalışmasında", "eff.asim": "Sınır aşılabilir", "eff.belirsiz": "Değerlendirilemedi",
    "eff.yok": "Bilinen yan etki yok", "eff.none_text": "Normal kullanımda bilinen bir yan etki yok.",
    "eff.doctor": "Bir şikâyetiniz varsa hekiminize danışın. Bu liste teşhis ya da tedavi önerisi değildir.",
}
EFF_LEVELS = ("resmi", "bildirildi", "tutarsiz", "hayvan", "asim", "belirsiz", "yok")
from uretec_ortak import koz_kimlik   # kozmetik kaydı kimliği (sonuç ekranındaki bağlantıyla aynı, gen_kozmetik.py ans)
from gen_e_kodlari import TGK_2024, TGK_2024_ESDEGER   # Türkiye güncel izinli liste (kaynak/tgk_ek2_2024.tsv)

EU_STATUS = {"banned": ("banned", "AB'de gıda katkısı olarak yasak."), "withdrawn": ("withdrawn", "AB'de izni geri çekildi."),
             "not_listed": ("not_listed", "AB'nin izinli gıda katkı maddeleri listesinde yer almıyor.")}


def fold(s):
    return s.translate(TRMAP).lower()


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", fold(s)).strip("-")


def num(i):
    m = re.match(r"E(\d+)", i)
    return int(m.group(1)) if m else 0


def short_pub(p):
    """Kaynak satırındaki kısa kurum adı: "EFSA (EFSA Journal …)" -> "EFSA"."""
    for k, v in (("EFSA", "EFSA"), ("IARC", "IARC"), ("JECFA", "JECFA"), ("JMPR", "JMPR"), ("SCF", "SCF"), ("FDA", "FDA"),
                 ("eCFR", "FDA"), ("CFS", "Hong Kong CFS"), ("FSAI", "FSAI"), ("Avrupa", "AB"), ("legislation.gov.uk", "AB"),
                 ("Dünya Sağlık", "DSÖ"), ("ECHA", "ECHA"), ("Tarım", "Tarım ve Orman Bakanlığı")):
        if k in p:
            return v
    return p


def read_effects(path):
    """kaynak/ansiklopedi_etkiler.tsv -> {kod: [satır, ...]} (dosyadaki sırayla)."""
    out = {}
    for n, line in enumerate(open(path, encoding="utf-8"), 1):
        if not line.strip() or line.startswith("#"):
            continue
        c = line.rstrip("\n").split("\t")
        if len(c) != 6:
            raise SystemExit("ansiklopedi_etkiler.tsv %d. satır: 6 sütun olmalı" % n)
        ids, lvl, txt, who, amt, src = [x.strip() for x in c]
        if lvl not in EFF_LEVELS:
            raise SystemExit("ansiklopedi_etkiler.tsv %d. satır: düzey geçersiz: %s" % (n, lvl))
        if (lvl == "yok") != (txt == "-"):
            raise SystemExit("ansiklopedi_etkiler.tsv %d. satır: belirti yalnızca 'yok' düzeyinde boş olur" % n)
        for i in ids.split():
            out.setdefault(i, []).append({"level": lvl, "text": None if txt == "-" else txt, "who": None if who == "-" else who,
                                          "amount": None if amt == "-" else amt, "src": None if src == "-" else src, "line": n})
    return out


TEM_DUZEY = {"red": "red", "yellow": "amber", "info": "green"}


# Temizlik maddelerinin ülke sınıflandırma listeleri (kaynak/ansiklopedi_temizlik.json kayıtlarında `ulke`)
TEM_ULKE = {"TR": {"kurum": "Çevre, Şehircilik ve İklim Değişikliği Bakanlığı", "kaynak": "sea", "yil": 2020,
                   "liste": "Türkiye SEA Yönetmeliği Ek-6 (RG 10.12.2020)"}}


def temizlik_kayitlari(T, official):
    """Temizlik ansiklopedisi (kaynak/ansiklopedi_temizlik.json, kimlik CAS). Tehlike sınıfları ECHA CHEM'den alınmış CLP verisi;
    renk sınıfın H/EUH kodlarının temizlik verisindeki (data/temizlik.json) en yüksek düzeyi: sonuç ekranıyla aynı kural.
    Sınıflandırması olmayan madde yeşildir. Her H kodu "olası etkiler"de resmi satır olur (metin temizlik verisindeki Türkçesi)."""
    K = json.load(open(os.path.join(HERE, "kaynak", "ansiklopedi_temizlik.json"), encoding="utf-8"))
    tdb = json.load(open(os.path.join(HERE, "data", "temizlik.json"), encoding="utf-8"))
    HZ = {h["code"]: h for h in tdb["hazards"]}
    SRC = K["kaynaklar"]
    for code, (ad, ne) in K["kategoriler"].items():
        T["cat." + code], T["cat." + code + ".what"] = ad, ne
    T["profile.koku"], T["profile.astim"] = "Koku alerjisi", "Astım / solunum hassasiyeti"
    T["tem.eff.miktar"] = "Sınıf saf ya da derişik madde içindir; üründeki etki orana göre değişir ve etiketteki tehlike ifadelerinde yazılır."
    T["tem.eff.yok"] = "AB'de bir tehlike sınıfına girmiyor (kayıt yaptıranların ortak bildirimi)."
    T["tem.eval"] = "Renk, maddenin AB tehlike sınıflarının en ciddisine göre verilir (temizlik sonuç ekranıyla aynı kural). Sınıf saf madde içindir; ürünün kendi tehlike ifadeleri etiketinde yazılır."
    recs, ids = [], set(x["id"] for x in K["kayitlar"])
    for k in K["kayitlar"]:
        rid, c = k["id"], k["clp"]
        kodlar = list(c["h"]) + list(c.get("euh", []))
        eksik = [x for x in kodlar if x not in HZ]
        if eksik:
            raise SystemExit(rid + ": temizlik verisinde olmayan tehlike kodu: " + ", ".join(eksik))
        duzey = max((HZ[x]["level"] for x in kodlar), key=lambda l: {"info": 0, "yellow": 1, "red": 2}[l], default="info")
        echa = "https://chem.echa.europa.eu/%s/overview" % k["echa"]
        T[rid + ".name"] = k["ad"]
        T[rid + ".summary"], T[rid + ".what"], T[rid + ".agn"] = k["ozet"], k["ne"], k["not"]
        for n, x in enumerate(k["nerede"]):
            T["%s.found.%d" % (rid, n)] = x
        ad_echa = "ECHA CHEM: %s (EC %s)" % (next((a for a in k["adlar"] if a.isupper()), "CAS " + rid), k["ec"])
        kaynak_echa = {"title": ad_echa, "publisher": "European Chemicals Agency (ECHA)", "year": 2026, "url": echa, "official": True}
        if c["tur"] == "harmonize":
            yil = int(c["tarih"][-4:])
            eurlex = "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:" + c["celex"]
            T[rid + ".reg.clp"] = "AB'nin bağlayıcı (uyumlaştırılmış) sınıflandırması, CLP Ek VI dizin no %s (%s): %s.%s" % (
                c["index"], c["atp"], ", ".join(c["siniflar"]), (" Ek etiket ifadesi: " + ", ".join(c["euh"]) + ".") if c.get("euh") else "")
            regs = [{"agency": "European Commission", "region": "EU", "status": "classified", "detail": rid + ".reg.clp", "year": yil, "source_url": eurlex}]
            srcs = [kaynak_echa, {"title": "CLP Annex VI entry %s (%s, CELEX %s)" % (c["index"], c["atp"], c["celex"]), "publisher": "European Commission",
                                  "year": yil, "url": eurlex, "official": True}]
            ef_src = {"label": "ECHA", "year": yil, "url": echa, "title": ad_echa}
        else:
            yuzde = ("%.1f" % c["yuzde"]).replace(".", ",")
            T[rid + ".reg.clp"] = ("AB'de uyumlaştırılmış sınıflandırması yok. Kayıt yaptıranların ortak bildirimi (bildirimlerin %%%s'i): %s." % (
                yuzde, ", ".join(c["siniflar"]) if c["siniflar"] else "sınıflandırılmamış"))
            regs = [{"agency": "ECHA", "region": "EU", "status": "classified" if c["siniflar"] else "reviewed", "detail": rid + ".reg.clp", "year": 2026, "source_url": echa}]
            srcs = [kaynak_echa]
            ef_src = {"label": "ECHA", "year": 2026, "url": echa, "title": ad_echa}
        effs = [{"level": "resmi", "text": "tem.h." + x, "who": None, "amount": "tem.eff.miktar", "source": dict(ef_src)} for x in kodlar]
        for x in kodlar:
            T["tem.h." + x] = "%s %s" % (x, HZ[x]["tr"])
        if not effs:
            effs = [{"level": "yok", "text": "tem.eff.yok", "who": None, "amount": None, "source": dict(ef_src)}]
        # Deterjan etiketinde adıyla yazılma ve fosfor sınırı (AB 648/2004 Ek VII, 259/2012)
        if k["kategori"] in ("tem_koruyucu", "tem_enzim", "tem_dezenfektan", "tem_koku"):
            T[rid + ".reg.det"] = {"tem_koruyucu": "Deterjan etiketinde oranı ne olursa olsun koruyucu olarak adıyla (INCI) yazılır.",
                                   "tem_enzim": "Deterjan etiketinde oranı ne olursa olsun enzim olarak yazılır.",
                                   "tem_dezenfektan": "Deterjan etiketinde oranı ne olursa olsun dezenfektan olarak yazılır.",
                                   "tem_koku": "Koku alerjeni: deterjanda %0,01'i aşarsa etikette adıyla yazılır."}[k["kategori"]]
            regs.append({"agency": "European Parliament and Council", "region": "EU", "status": "label_required", "detail": rid + ".reg.det",
                         "year": 2004, "source_url": SRC["det648"]["url"]})
            k["ek_kaynak"] = k["ek_kaynak"] + ["det648"]
        if rid == "7758-29-4":
            T[rid + ".reg.p"] = "Ev tipi çamaşır deterjanında standart doz başına toplam fosfor en çok 0,5 g (2013'ten beri), ev tipi bulaşık makinesi deterjanında 0,3 g (2017'den beri)."
            regs.append({"agency": "European Parliament and Council", "region": "EU", "status": "restricted", "detail": rid + ".reg.p",
                         "year": 2012, "source_url": SRC["fosfor259"]["url"]})
            k["ek_kaynak"] = k["ek_kaynak"] + ["fosfor259"]
        # Ülke satırı (B-05'e hazırlık): ülkenin sınıflandırma listesi AB'den farklıysa `ulke.<kod>`; fark AB satırından hesaplanır
        for ul, u in sorted(k.get("ulke", {}).items()):
            if ul not in TEM_ULKE or c["tur"] != "harmonize":
                raise SystemExit(rid + ": ulke.%s bilinmiyor ya da madde AB'de uyumlaştırılmış değil" % ul)
            m = TEM_ULKE[ul]
            if u.get("yok"):
                T["%s.reg.ulke.%s" % (rid, ul)] = "%s listesinde yok; AB bu sınıflandırmayı %s ile ekledi (%s)." % (m["liste"], c["atp"], ", ".join(c["siniflar"]))
            else:
                ab = c["siniflar"] + c.get("euh", [])
                bu = u["siniflar"] + u.get("euh", [])
                fark = []
                if [x for x in ab if x not in bu]:
                    fark.append("AB'de olup burada olmayan: " + ", ".join(x for x in ab if x not in bu))
                if [x for x in bu if x not in ab]:
                    fark.append("burada olup AB'de olmayan: " + ", ".join(x for x in bu if x not in ab))
                if not fark:
                    raise SystemExit(rid + ": ulke.%s AB ile aynı; satır yalnızca fark varsa yazılır" % ul)
                T["%s.reg.ulke.%s" % (rid, ul)] = "%s, dizin no %s: %s. AB'den farkı: %s." % (m["liste"], u["index"], ", ".join(bu), "; ".join(fark))
            regs.append({"agency": m["kurum"], "region": ul, "status": "not_listed" if u.get("yok") else "classified",
                         "detail": "%s.reg.ulke.%s" % (rid, ul), "year": m["yil"], "source_url": SRC[m["kaynak"]]["url"]})
            if m["kaynak"] not in k["ek_kaynak"]:
                k["ek_kaynak"] = k["ek_kaynak"] + [m["kaynak"]]
        for s in k["ek_kaynak"]:
            srcs.append(dict(SRC[s]))
        if k.get("pubchem"):
            srcs.append({"title": "PubChem: Use and Manufacturing (HSDB, Haz-Map)", "publisher": "U.S. National Library of Medicine",
                         "year": 2026, "url": "https://pubchem.ncbi.nlm.nih.gov/compound/%d#section=Use-and-Manufacturing" % k["pubchem"], "official": False})
        pws = []
        for n, w in enumerate(k["profil"]):
            T["%s.pw.%d" % (rid, n)] = w["text"]
            pws.append({"profile": w["profile"], "severity": w["severity"], "text": "%s.pw.%d" % (rid, n)})
        ayni = [x["id"] for x in K["kayitlar"] if x["kategori"] == k["kategori"] and x["id"] != rid]
        ilgili = [x for x in k["ilgili"] if x in ids or re.fullmatch(r"E\d{3,4}[a-z]?", x)]
        ilgili = (ilgili + [x for x in ayni if x not in ilgili])[:4]   # elle verilenler önce, sonra aynı kategoridekiler
        aliases = []
        for a in [rid, k["ec"], fold(k["ad"])] + k["adlar"]:
            a = a.lower()
            if a and a not in aliases:
                aliases.append(a)
        recs.append({
            "id": rid, "slug": slugify(k["ad"]), "names": {"primary": rid + ".name", "aliases": aliases},
            "category": k["kategori"], "product_types": ["cleaning"], "risk_level": TEM_DUZEY[duzey], "review": "curated",
            "evidence_level": "strong" if c["tur"] == "harmonize" else "moderate", "summary": rid + ".summary", "evaluation": "tem.eval",
            "content": {"what_it_does": rid + ".what", "found_in": ["%s.found.%d" % (rid, n) for n in range(len(k["nerede"]))], "in_the_body": None},
            "effects": effs, "agency_note": rid + ".agn",
            "diet_flags": {"vegan": "unknown", "source": "unknown", "gluten": "unknown"},
            "regulatory": regs, "profile_warnings": pws, "related_ids": ilgili, "sources": srcs, "last_reviewed": k["inceleme"]})
    return recs


KOZ_SIRA = {"info": 0, "yellow": 1, "orange": 2, "red": 3}
KOZ_RISK = {"info": "green", "yellow": "amber", "orange": "red", "red": "red"}
COSING = "https://ec.europa.eu/growth/tools-databases/cosing/"
COSING_MADDE = COSING + "details/%s"   # maddenin CosIng sayfası; kimlik kaynak/cosing/ingredients.csv substance_id (cosing_al.py)
# Türkiye ek durumu (kozmetik.json e.tr / updates[].tr, gen_kozmetik.py TR_BY_REG / TR_BY_ID): durum ve metin anahtarı.
# Metin kozmetik.json meta.tr_text'ten (Etiket Oku'daki kartla aynı cümle). Dayanak Kozmetik Ürünler Yönetmeliği (RG 08.05.2023).
KOZ_TR = {"farkli": "restricted", "yok": "not_listed", "taslak": "concern"}
KOZ_TR_YON = {"title": "Kozmetik Ürünler Yönetmeliği (Resmî Gazete 08.05.2023, 32184 mükerrer)", "publisher": "Ticaret Bakanlığı", "year": 2023,
              "url": "https://www.resmigazete.gov.tr/eskiler/2023/05/20230508M1-1-1.pdf", "official": True}
# İzlenen listeler (kozmetik.json meta.watch_lists): kurum, bölge; durum listenin türünden (kind)
KOZ_LISTE = {"ab_ed_a": ("European Commission", "EU"), "ab_ed_b": ("European Commission", "EU"), "ab_reach": ("European Commission", "EU"),
             "ab_taslak": ("European Commission", "EU"), "eu_svhc_ed": ("European Chemicals Agency (ECHA)", "EU"), "ca": ("California", "US-CA"),
             "ca_sinir": ("California", "US-CA"), "asean": ("ASEAN", "ASEAN"), "dk": ("Danimarka", "DK"), "fr": ("ANSES", "FR"),
             "tr_taslak": ("Ticaret Bakanlığı", "TR")}
KOZ_KIND = {"ban": "banned", "limit": "restricted", "eu": "restricted", "child": "restricted", "ed": "concern", "tr": "concern", "comedo": "reviewed"}


def eurlex_celex(reg):
    """'(EU) 2022/1176' ya da '(EC) 2009/1223' → (yıl, EUR-Lex adresi)."""
    m = re.search(r"(\d{4})/(\d+)", reg)
    return int(m.group(1)), "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:3%sR%04d" % (m.group(1), int(m.group(2)))


def kozmetik_kayitlari(T, official, tem):
    """Kozmetik ansiklopedisi (kaynak/ansiklopedi_kozmetik.json, kimlik INCI). Elle yazılan yalnızca açıklama, not ve olası etkiler;
    risk rengi, kurum satırları ve kaynaklar data/kozmetik.json'dan: Etiket Oku'daki kozmetik sonucuyla (js/kozmetik.js kResult) aynı kural,
    yani AB ek kayıtlarının, INCI bayraklarının ve izlenen listelerin en yüksek düzeyi. 'clp' verilmişse temizlik ansiklopedisindeki
    aynı maddenin sağlık tehlike sınıfları (H3xx) "resmi" etki satırı olur. tem: temizlik kayıtları (kimlik CAS)."""
    K = json.load(open(os.path.join(HERE, "kaynak", "ansiklopedi_kozmetik.json"), encoding="utf-8"))
    kdb = json.load(open(os.path.join(HERE, "data", "kozmetik.json"), encoding="utf-8"))
    kinci = json.load(open(os.path.join(HERE, "data", "kozmetik_inci.json"), encoding="utf-8"))
    TK = json.load(open(os.path.join(HERE, "kaynak", "ansiklopedi_temizlik.json"), encoding="utf-8"))
    TEM = {x["id"]: x for x in TK["kayitlar"]}
    temr = {r["id"]: r for r in tem}
    INCI = {x[0]: x for x in kinci["items"]}
    csv.field_size_limit(10 ** 9)
    SID = {r["inci_name"]: r["substance_id"] for r in csv.DictReader(open(os.path.join(HERE, "kaynak", "cosing", "ingredients.csv"), encoding="utf-8"))}
    M = kdb["meta"]
    WL, FLV = M["watch_lists"], M.get("inci_flag_levels", {})
    for d, x in M.get("tr_text", {}).items():
        T["koz.tr." + d] = x
    SRC = K["kaynaklar"]
    for code, (ad, ne) in K["kategoriler"].items():
        T["cat." + code], T["cat." + code + ".what"] = ad, ne
    T["profile.koku"], T["profile.astim"] = "Koku alerjisi", "Astım / solunum hassasiyeti"
    T["region.DK"], T["region.FR"], T["region.ASEAN"] = "Danimarka", "Fransa", "ASEAN"
    T["koz.reg.yok"] = ("AB kozmetik yönetmeliğinin eklerinde (yasak, kısıtlı ve izinli listeler) yer almıyor; bu maddeye özgü bir sınır ya da etiket kuralı yok. "
                        "Her ürün için genel güvenlik değerlendirmesi kuralı geçerlidir.")
    T["koz.eff.miktar"] = "Sınıf saf madde içindir; kozmetikte seyreltik kullanıldığından üründeki etki orana göre değişir."
    T["koz.pw.koku"] = "Koku alerjeni: AB'de belirli oranı aşınca içerik listesinde adıyla yazılır; etikette adını arayın."
    T["koz.pw.ed"] = "AB'nin olası endokrin bozucu (hormon sistemini etkileyebileceği şüphesi olan) maddeler öncelik listesinde. Liste bir hüküm değildir."
    ek_ad = {"II": "Yasaklı madde", "III": "Kısıtlı madde: ürün tipine göre üst sınır ve kullanım koşulları var.", "IV": "İzinli renklendirici.",
             "V": "İzinli koruyucu, üst sınırla.", "VI": "İzinli UV filtresi, üst sınırla."}
    rid_of = {k["inci"]: koz_kimlik(k["inci"]) for k in K["kayitlar"]}
    recs = []
    for k in K["kayitlar"]:
        inci, rid = k["inci"], rid_of[k["inci"]]
        if inci not in INCI:
            raise SystemExit(rid + ": INCI adı CosIng listesinde yok")
        it = INCI[inci]
        iflags = it[2] if len(it) > 2 else []
        ents = [e for e in kdb["entries"] if inci in e["inci"]]
        wats = [w for w in kdb.get("watch", []) if inci in w["inci"]]
        duzeyler = [e["level"] for e in ents] + [FLV[f] for f in iflags if f in FLV] + [WL[w["list"]]["level"] for w in wats if WL.get(w["list"], {}).get("level")]
        duzey = max(duzeyler, key=lambda l: KOZ_SIRA[l], default="info")
        T[rid + ".name"] = k["ad"]
        T[rid + ".summary"], T[rid + ".what"], T[rid + ".agn"] = k["ozet"], k["ne"], k["not"]
        for n, x in enumerate(k["nerede"]):
            T["%s.found.%d" % (rid, n)] = x
        cosing = COSING_MADDE % SID[inci] if SID.get(inci) else COSING   # kimliği bulunamayan (2 ad) arama sayfasına gider
        srcs = [{"title": "CosIng: %s" % inci, "publisher": "European Commission", "year": 2026, "url": cosing, "official": True}]
        regs = []
        for n, e in enumerate(ents):
            yil, url = eurlex_celex(e.get("regulation") or "(EC) 2009/1223")
            fl = e.get("flags", [])
            if e["annex"] == "II":
                st = "banned"
            elif e["annex"] == "III":
                st = "label_required" if "allergen_fragrance" in fl and not e.get("max") else "restricted"
            elif e["annex"] in ("V", "VI"):
                st = "restricted" if e.get("max") else "approved"
            else:
                st = "approved"
            metin = "AB kozmetik yönetmeliği Ek %s, giriş %s: %s" % (e["annex"], e["ref"], ek_ad[e["annex"]])
            if "allergen_fragrance" in fl:
                metin = "AB kozmetik yönetmeliği Ek %s, giriş %s: koku alerjeni; belirli oranı aşınca içerik listesinde adıyla yazılır." % (e["annex"], e["ref"])
            if "nano" in fl:
                metin += " (Nano biçimi.)"
            for f in ("cmr2_carc", "cmr2", "cmr_ban"):
                if f in fl:
                    metin += " " + M["flags"][f] + "."
                    break
            T["%s.reg.%d" % (rid, n)] = metin
            regs.append({"agency": "European Commission", "region": "EU", "status": st, "detail": "%s.reg.%d" % (rid, n), "year": yil, "source_url": url})
            if url not in [s["url"] for s in srcs]:
                srcs.append({"title": "Regulation %s amending Regulation (EC) No 1223/2009 on cosmetic products" % e["regulation"] if yil != 2009 else
                             "Regulation (EC) No 1223/2009 on cosmetic products", "publisher": "European Parliament and Council" if yil == 2009 else "European Commission",
                             "year": yil, "url": url, "official": True})
        trs = sorted({x for e in ents for x in [e.get("tr")] + [u.get("tr") for u in e.get("updates", [])] if x})
        for d in trs:   # Türkiye satırı yalnızca AB'den farklıysa; yoksa Türk ekleri AB ile aynı (TEKNIK_BORC.md Kozmetik)
            regs.append({"agency": "Ticaret Bakanlığı", "region": "TR", "status": KOZ_TR[d], "detail": "koz.tr." + d, "year": 2023, "source_url": KOZ_TR_YON["url"]})
        if trs:
            srcs.append(dict(KOZ_TR_YON))
        if not ents:
            yil, url = eurlex_celex("(EC) 2009/1223")
            regs.append({"agency": "European Commission", "region": "EU", "status": "not_listed", "detail": "koz.reg.yok", "year": yil, "source_url": url})
            srcs.append({"title": "Regulation (EC) No 1223/2009 on cosmetic products", "publisher": "European Parliament and Council", "year": yil, "url": url, "official": True})
        for n, w in enumerate(wats):
            L = WL[w["list"]]
            ajans, bolge = KOZ_LISTE.get(w["list"], (L["label"], "INT"))
            T["%s.k3.%d" % (rid, n)] = L["label"] + ". " + (w.get("note_tr") or L["text"])
            yil = int(w["date"][:4]) if re.match(r"\d{4}", w.get("date") or "") else None
            regs.append({"agency": ajans, "region": bolge, "status": KOZ_KIND.get(L.get("kind"), "concern"), "detail": "%s.k3.%d" % (rid, n), "year": yil, "source_url": w["source"]})
            if w["source"] not in [s["url"] for s in srcs]:
                dom = re.sub(r"^https?://([^/]+).*", r"\1", w["source"])
                srcs.append({"title": L["label"], "publisher": ajans, "year": yil or 2026, "url": w["source"],
                             "official": any(dom == d or dom.endswith("." + d) for d in official + ["europa.eu"])})

        def etki_kaynak(key):
            if key.startswith("reg:"):
                e = next(e for e in ents if e["id"] == key[4:])
                yil, url = eurlex_celex(e.get("regulation") or "(EC) 2009/1223")
                return {"label": "AB", "year": yil, "url": url, "title": "Regulation %s" % (e.get("regulation") or "(EC) 2009/1223")}
            if key.startswith("k3:"):
                w = next(w for w in wats if w["list"] == key[3:])
                return {"label": KOZ_LISTE.get(w["list"], ("AB",))[0], "year": int(w["date"][:4]) if re.match(r"\d{4}", w.get("date") or "") else 2026,
                        "url": w["source"], "title": WL[w["list"]]["label"]}
            if key == "cosing":
                return {"label": "CosIng", "year": 2026, "url": cosing, "title": "CosIng: " + inci}
            s = SRC[key]
            if s["url"] not in [x["url"] for x in srcs]:
                srcs.append(dict(s))
            return {"label": s["publisher"].split("(")[-1].rstrip(")") if "(" in s["publisher"] else s["publisher"], "year": s["year"], "url": s["url"], "title": s["title"]}
        effs = []
        for n, x in enumerate(k["etkiler"]):
            T["%s.eff.%d" % (rid, n)] = x["metin"]
            effs.append({"level": x["duzey"], "text": "%s.eff.%d" % (rid, n), "who": None, "amount": None, "source": etki_kaynak(x["kaynak"])})
        if k.get("clp"):
            c, tr = TEM[k["clp"]], temr[k["clp"]]
            echa = next(s for s in tr["sources"] if s["url"].startswith("https://chem.echa.europa.eu/"))
            for h in [x for x in c["clp"]["h"] if re.fullmatch(r"H3\d\d", x)]:
                effs.append({"level": "resmi", "text": "tem.h." + h, "who": None, "amount": "koz.eff.miktar",
                             "source": {"label": "ECHA", "year": echa["year"], "url": echa["url"], "title": echa["title"]}})
            if echa["url"] not in [s["url"] for s in srcs]:
                srcs.append(dict(echa))
        if not effs:
            raise SystemExit(rid + ": olası etki satırı yok")
        pws = []
        for n, w in enumerate(k["profil"]):
            T["%s.pw.%d" % (rid, n)] = w["text"]
            pws.append({"profile": w["profile"], "severity": w["severity"], "text": "%s.pw.%d" % (rid, n)})
        elle = set(w["profile"] for w in pws)
        if any("allergen_fragrance" in e.get("flags", []) for e in ents) and "koku" not in elle:
            pws.append({"profile": "koku", "severity": "medium", "text": "koz.pw.koku"})
        if any(WL.get(w["list"], {}).get("kind") == "ed" for w in wats):
            pws += [{"profile": p, "severity": "low", "text": "koz.pw.ed"} for p in ("preg", "child") if p not in elle]
        ilgili = [rid_of.get(x, x) for x in k["ilgili"]]
        ayni = [rid_of[x["inci"]] for x in K["kayitlar"] if x["kategori"] == k["kategori"] and x["inci"] != inci]
        ilgili = (ilgili + [x for x in ayni if x not in ilgili])[:4]
        aliases = []
        for a in [inci, fold(k["ad"])] + k["adlar"]:
            a = a.lower()
            if a and a not in aliases:
                aliases.append(a)
        vegan = "no" if ("non_vegan" in iflags or "non_veg" in iflags) else "unknown"
        recs.append({
            "id": rid, "slug": slugify(inci), "names": {"primary": rid + ".name", "aliases": aliases},
            "category": k["kategori"], "product_types": ["cosmetic"], "risk_level": KOZ_RISK[duzey], "review": "curated",
            "evidence_level": "strong" if ents else "moderate", "summary": rid + ".summary", "evaluation": None,
            "content": {"what_it_does": rid + ".what", "found_in": ["%s.found.%d" % (rid, n) for n in range(len(k["nerede"]))], "in_the_body": None},
            "effects": effs, "agency_note": rid + ".agn",
            "diet_flags": {"vegan": vegan, "source": "animal" if vegan == "no" else "unknown", "gluten": "unknown"},
            "regulatory": regs, "profile_warnings": pws, "related_ids": ilgili, "sources": srcs, "last_reviewed": k["inceleme"]})
    return recs


def main():
    K = json.load(open(os.path.join(HERE, "kaynak", "ansiklopedi.json"), encoding="utf-8"))
    edb = json.load(open(os.path.join(HERE, "data", "e_kodlari.json"), encoding="utf-8"))
    about = json.load(open(os.path.join(HERE, "data", "e_aciklama.json"), encoding="utf-8"))["about"]
    bdb = json.load(open(os.path.join(HERE, "data", "bilesenler.json"), encoding="utf-8"))
    SRC, CAT, AG, FL, CUR = K["kaynaklar"], K["kategoriler"], K["ajanslar"], K["bayrak_uyarilari"], K["kayitlar"]
    official = K["resmi_alan_adlari"]
    EFF = read_effects(os.path.join(HERE, "kaynak", "ansiklopedi_etkiler.tsv"))
    titles = {s["url"]: s["name"] for s in edb["meta"].get("sources", []) if s.get("url")}
    T = dict(UI)
    for code, name in bdb["meta"]["allergens"]:
        T["profile." + code] = name + " alerjisi"
    for c in CAT.values():
        if isinstance(c, dict):
            T["cat." + c["code"]] = c["ad"]
            T["cat." + c["code"] + ".what"] = c["ne"]
    for k, a in AG.items():
        if not k.startswith("_"):
            T["agency." + k] = a["detail"]
    for f, ws in FL.items():
        if not f.startswith("_"):
            for n, w in enumerate(ws):
                T["flag.%s.%d" % (f, n)] = w["text"]

    def src_obj(key):
        s = SRC[key]
        o = {"title": s["title"], "publisher": s["publisher"], "year": s["year"], "url": s["url"], "official": s["official"]}
        if not s["url"]:
            o["todo"] = "URL doğrulanamadı"
        return o

    def url_src(u):
        dom = re.sub(r"^https?://(www\.)?", "", u).split("/")[0]
        for s in SRC.values():
            if s["url"] == u:
                return {"title": s["title"], "publisher": s["publisher"], "year": s["year"], "url": u, "official": s["official"]}
        return {"title": titles.get(u, dom), "publisher": dom, "year": None, "url": u,
                "official": any(dom == d or dom.endswith("." + d) for d in official)}

    items = edb["ingredients"]
    by = {i["id"]: i for i in items}
    bycat = {}
    for i in items:
        bycat.setdefault(i["category"], []).append(i["id"])
    recs = []
    for it in items:
        rid = it["id"]
        cat = CAT[it["category"]]
        cur = CUR.get(rid)
        T[rid + ".name"] = it["primary_name"]
        r = {"id": rid, "slug": slugify(rid + " " + it["primary_name"]),
             "names": {"primary": rid + ".name", "aliases": it["aliases"]},
             "category": cat["code"], "product_types": ["food"], "risk_level": RISK[it["risk_level"]],
             "review": "curated" if cur else "auto"}
        # Genel değerlendirme metni: uygulamanın tarama ekranında da gösterilen gerekçe
        if it.get("verification") == "inventory_only":
            ev = "eval.inventory"
        else:
            ev = rid + ".eval"
            T[ev] = it["reason"]
        fl = it["flags"]
        if rid in about:
            T[rid + ".summary"] = about[rid]
        vegan = "no" if ("non_vegan" in fl or "insect_derived" in fl) else "unknown"
        source = ("insect" if "insect_derived" in fl else "animal" if ("non_vegan" in fl or "non_vegetarian" in fl)
                  else "plant_or_animal" if "vegan_suspect" in fl else "unknown")
        regs = []
        urls = list(it.get("sources") or [])
        for a in it["agencies"]:
            g = AG[a]
            regs.append({"agency": g["agency"], "region": g["region"], "status": g["status"], "detail": "agency." + a,
                         "year": g["year"], "source_url": ""})   # dayanağı Kaynaklar sekmesinde
        st = EU_STATUS.get(it.get("eu_status"))
        extra = (cur or {}).get("regulatory_extra", [])   # elle yazılan AB satırı varsa genel satır eklenmez
        if st and not any(g["region"] == "EU" and g["status"] in ("banned", "withdrawn", "not_listed") for g in regs + extra):
            T[rid + ".reg.eu"] = st[1]
            regs.append({"agency": "Avrupa Komisyonu", "region": "EU", "status": st[0], "detail": rid + ".reg.eu",
                         "year": None, "source_url": ""})
        # Türkiye: güncel izinli liste (Bakanlık kılavuzu 2024, kaynak/tgk_ek2_2024.tsv); jelatin gibi katkı sayılmayanlar satırsız
        tr_var = rid in TGK_2024 or TGK_2024_ESDEGER.get(rid) in TGK_2024
        if "TR_withdrawn_2024" not in it["agencies"] and rid != "E441" and (tr_var or it.get("tgk_name") or it.get("tgk_note")):
            regs.append({"agency": "Tarım ve Orman Bakanlığı", "region": "TR", "status": "approved" if tr_var else "not_listed",
                         "detail": "reg.tr_listed" if tr_var else "reg.tr_not_listed", "year": 2024,
                         "source_url": SRC["tgk2024k"]["url"]})
        pws = []
        for f in fl:
            for n, w in enumerate(FL.get(f, [])):
                if not any(p["profile"] == w["profile"] for p in pws):
                    pws.append({"profile": w["profile"], "severity": w["severity"], "text": "flag.%s.%d" % (f, n)})
        if it.get("adi") and it["adi"].get("url"):
            urls.append(it["adi"]["url"])
        if it["uretim"].get("u"):
            urls.append(it["uretim"]["u"])
        srcs, seen = [], set()
        for u in urls:
            if u not in seen:
                seen.add(u)
                srcs.append(url_src(u))
        if it.get("tgk_name"):
            srcs.append(src_obj("tgk2013"))
        if any(g["region"] == "TR" and g["source_url"] == SRC["tgk2024k"]["url"] for g in regs):
            srcs.append(src_obj("tgk2024k"))
        same = sorted((x for x in bycat[it["category"]] if x != rid), key=lambda x: (abs(num(x) - num(rid)), x))
        r.update({"evidence_level": None, "summary": rid + ".summary" if rid in about else None, "evaluation": ev,
                  "content": {"what_it_does": "cat." + cat["code"] + ".what", "found_in": [], "in_the_body": None},
                  "effects": [], "agency_note": None,
                  "diet_flags": {"vegan": vegan, "source": source, "gluten": "unknown"},
                  "regulatory": regs, "profile_warnings": pws, "related_ids": same[:4], "sources": srcs,
                  "last_reviewed": None,
                  "production": {"class": it["uretim"]["s"], "note": rid + ".prod", "verified": it["uretim"]["ok"]}})
        T[rid + ".prod"] = it["uretim"]["n"]
        # Elle incelenen kayıt: yazılan alanlar otomatik olanların yerine geçer; yazılmayanlar (kurumlar,
        # profil uyarıları, benzer maddeler, diyet) otomatik kalır. Kaynaklar birleştirilir (önce elle yazılanlar).
        if cur:
            r["review"] = "curated"
            if cur.get("summary"):
                T[rid + ".summary"] = cur["summary"]
                r["summary"] = rid + ".summary"
            T[rid + ".what"] = cur["what_it_does"]
            for n, x in enumerate(cur["found_in"]):
                T["%s.found.%d" % (rid, n)] = x
            r["content"] = {"what_it_does": rid + ".what",
                            "found_in": ["%s.found.%d" % (rid, n) for n in range(len(cur["found_in"]))],
                            "in_the_body": None}
            # "Vücutta nasıl işlenir?" yalnızca metabolizma; kurum değerlendirmesi Otoriteler sekmesine gider
            if cur["in_the_body"]:
                T[rid + ".body"] = cur["in_the_body"]
                r["content"]["in_the_body"] = rid + ".body"
            if cur.get("uretim_ek"):   # elle yazılan üretim ayrıntısı "Nasıl üretilir?" metnine eklenir
                T[rid + ".prod"] = T[rid + ".prod"] + " " + cur["uretim_ek"]
            if cur.get("agency_note"):
                T[rid + ".agn"] = cur["agency_note"]
                r["agency_note"] = rid + ".agn"
            # Olası etkiler: belirti, kimde, hangi miktarda, kanıt düzeyi ve kaynak (kaynak/ansiklopedi_etkiler.tsv)
            effs = []
            for n, e in enumerate(EFF.get(rid, [])):
                sk = e["src"] or cur["sources"][0]
                if sk not in SRC:
                    raise SystemExit("ansiklopedi_etkiler.tsv %d. satır: kaynak bulunamadı: %s" % (e["line"], sk))
                s = SRC[sk]
                o = {"level": e["level"], "text": "eff.none_text", "who": None, "amount": None,
                     "source": {"label": short_pub(s["publisher"]), "year": s["year"], "url": s["url"], "title": s["title"]}}
                for f, suf in (("text", "t"), ("who", "w"), ("amount", "a")):
                    if e[f]:
                        T["%s.eff.%d.%s" % (rid, n, suf)] = e[f]
                        o[f] = "%s.eff.%d.%s" % (rid, n, suf)
                effs.append(o)
                if sk not in cur["sources"]:
                    cur["sources"].append(sk)
            r["effects"] = effs
            if "regulatory" in cur:
                regs = []
                for n, g in enumerate(cur["regulatory"]):
                    T["%s.reg.%d" % (rid, n)] = g["detail"]
                    regs.append({"agency": g["agency"], "region": g["region"], "status": g["status"],
                                 "detail": "%s.reg.%d" % (rid, n), "year": g["year"], "source_url": SRC[g["src"]]["url"]})
                r["regulatory"] = regs
            for n, g in enumerate(cur.get("regulatory_extra", [])):   # otomatik kurum satırlarına ek
                T["%s.regx.%d" % (rid, n)] = g["detail"]
                r["regulatory"].insert(n, {"agency": g["agency"], "region": g["region"], "status": g["status"],
                                           "detail": "%s.regx.%d" % (rid, n), "year": g["year"], "source_url": SRC[g["src"]]["url"]})
            if "profile_warnings" in cur:
                pws = []
                for n, w in enumerate(cur["profile_warnings"]):
                    T["%s.pw.%d" % (rid, n)] = w["text"]
                    pws.append({"profile": w["profile"], "severity": w["severity"], "text": "%s.pw.%d" % (rid, n)})
                r["profile_warnings"] = pws
            for k in ("diet_flags", "related_ids", "evidence_level", "last_reviewed"):
                if k in cur:
                    r[k] = cur[k]
            mine = [src_obj(x) for x in cur["sources"]]
            have = set(x["url"] for x in mine)
            r["sources"] = mine + [x for x in r["sources"] if x["url"] not in have]
        recs.append(r)

    tem = temizlik_kayitlari(T, official)
    recs += tem + kozmetik_kayitlari(T, official, tem)
    ids = set(by) | set(r["id"] for r in recs)
    for r in recs:
        missing = [x for x in r["related_ids"] if x not in ids]
        if missing:
            raise SystemExit(r["id"] + ": related_ids bulunamadı: " + ", ".join(missing))
    for k in EFF:
        if k not in CUR:
            raise SystemExit(k + ": ansiklopedi_etkiler.tsv'de var ama elle incelenmiş kayıt değil")
    for k in CUR:
        if k not in EFF:
            raise SystemExit(k + ": olası etkiler satırı yok (kaynak/ansiklopedi_etkiler.tsv)")
        if k not in ids:
            raise SystemExit(k + ": e_kodlari.json'da yok")
    # Kaynak başlığı, yayımcı ve kurum adları da çeviri anahtarı (kaynak.<metnin özeti>): Türkçe yazılmış adlar başka dilde
    # çevrilir; özgün dilinde (çoğu İngilizce) olanın çevirisi gerekmez, eksik anahtar Türkçe metne, yani özgün ada düşer.
    def ad_key(s):
        if not s:
            return s
        k = "kaynak." + hashlib.sha1(s.encode("utf-8")).hexdigest()[:10]
        T[k] = s
        return k
    for r in recs:
        for s in r["sources"]:
            s["title"], s["publisher"] = ad_key(s["title"]), ad_key(s["publisher"])
        for g in r["regulatory"]:
            g["agency"] = ad_key(g["agency"])
        for x in r.get("effects") or []:
            x["source"]["label"], x["source"]["title"] = ad_key(x["source"]["label"]), ad_key(x["source"]["title"])
    today = datetime.date.today().isoformat()
    n_cur = sum(1 for r in recs if r["review"] == "curated")
    n_noff = sum(1 for r in recs if not any(s["official"] for s in r["sources"]))
    meta = {"version": VERSION, "generated": today, "lang": ["tr"], "count": len(recs), "curated": n_cur,
            "without_official_source": n_noff,
            "description": "Madde sözlüğü dizini; tam kayıtlar ansiklopedi/<kimlik>.json'da. Metin alanları çeviri anahtarıdır; Türkçe metinler ansiklopedi_tr.json ve ansiklopedi/tr/<kimlik>.json'da. review=auto kayıtlar e_kodlari.json'dan otomatik oluşturuldu, elle incelenmedi."}
    # Açılışta yalnızca dizin iner (arama, liste, benzer maddeler); madde sayfasının tam kaydı ve metinleri sayfa açılınca
    # (data/ansiklopedi/<kimlik>.json, data/ansiklopedi/<dil>/<kimlik>.json). Böylece dil ve madde sayısı arttıkça açılış hafif kalır.
    def keys_in(x, out):
        if isinstance(x, str):
            if x in T:
                out.add(x)
        elif isinstance(x, dict):
            for v in x.values():
                keys_in(v, out)
        elif isinstance(x, list):
            for v in x:
                keys_in(v, out)
        return out
    used = {r["id"]: keys_in(r, set()) for r in recs}
    count = {}
    for ks in used.values():
        for k in ks:
            count[k] = count.get(k, 0) + 1
    names = set(r["names"]["primary"] for r in recs)
    # Yalnızca tek kaydın kullandığı metin o kaydın sayfa dosyasına gider; adlar ve ortak metinler dizinde kalır
    page_t = {i: {k: T[k] for k in sorted(ks) if count[k] == 1 and k not in names} for i, ks in used.items()}
    moved = set(k for d in page_t.values() for k in d)
    index_t = {k: v for k, v in T.items() if k not in moved}

    def index_rec(r):
        x = {k: r[k] for k in ("id", "slug", "names", "category", "product_types", "risk_level", "review")}
        if r.get("production"):
            x["production"] = {"class": r["production"]["class"]}
        return x

    def dump(path, text):
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)

    d = os.path.join(HERE, "data", "ansiklopedi")
    dt = os.path.join(d, "tr")
    for dd in (d, dt):
        os.makedirs(dd, exist_ok=True)
        for f in os.listdir(dd):   # kaldırılan maddelerin eski sayfa dosyaları kalmasın
            if f.endswith(".json"):
                os.remove(os.path.join(dd, f))
    for r in recs:
        dump(os.path.join(d, r["id"] + ".json"), json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")
        dump(os.path.join(dt, r["id"] + ".json"), json.dumps({"t": page_t[r["id"]]}, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n")
    p = os.path.join(HERE, "data", "ansiklopedi.json")
    dump(p, '{"meta":' + json.dumps(meta, ensure_ascii=False) + ',\n"records":[\n'
         + ",\n".join(json.dumps(index_rec(r), ensure_ascii=False, separators=(",", ":")) for r in recs) + "\n]}\n")
    p2 = os.path.join(HERE, "data", "ansiklopedi_tr.json")
    dump(p2, '{"meta":' + json.dumps({"lang": "tr", "generated": today, "count": len(T)}, ensure_ascii=False) + ',\n"t":{\n'
         + ",\n".join(json.dumps(k, ensure_ascii=False) + ":" + json.dumps(v, ensure_ascii=False) for k, v in sorted(index_t.items())) + "\n}}\n")
    # Başka diller: kaynak/ansiklopedi_<dil>.json (anahtar → metin; elle/çeviriyle). Türkçeyle aynı bölünme; eksik anahtar Türkçeye düşer
    # (arayüz "henüz çevrilmedi" işaretler). Türkçesi değişen metnin çevirisi "_tr" parmak iziyle bayatlar ve yazılmaz.
    for f in sorted(os.listdir(os.path.join(HERE, "kaynak"))):
        m = re.fullmatch(r"ansiklopedi_([a-z]{2}(?:-[a-z]+)?)\.json", f)
        if not m:
            continue
        dil, C = m.group(1), json.load(open(os.path.join(HERE, "kaynak", f), encoding="utf-8"))["t"]
        ok = {k: c["s"] for k, c in C.items() if k in T and c.get("tr") == T[k]}
        bayat = sum(1 for k, c in C.items() if k in T and c.get("tr") != T[k])
        dd = os.path.join(d, dil)
        os.makedirs(dd, exist_ok=True)
        for x in os.listdir(dd):
            if x.endswith(".json"):
                os.remove(os.path.join(dd, x))
        for r in recs:
            pt = {k: ok[k] for k in page_t[r["id"]] if k in ok}
            if pt:
                dump(os.path.join(dd, r["id"] + ".json"), json.dumps({"t": pt}, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n")
        it = {k: ok[k] for k in index_t if k in ok}
        dump(os.path.join(HERE, "data", "ansiklopedi_%s.json" % dil), '{"meta":' + json.dumps({"lang": dil, "generated": today, "count": len(ok)}, ensure_ascii=False) + ',\n"t":{\n'
             + ",\n".join(json.dumps(k, ensure_ascii=False) + ":" + json.dumps(v, ensure_ascii=False) for k, v in sorted(it.items())) + "\n}}\n")
        print("ansiklopedi %s: %d/%d metin çevrili, %d bayat" % (dil, len(ok), len(T), bayat))
    print("ansiklopedi: %d kayıt (%d elle incelenmiş, %d resmi kaynaksız), %d metin" % (len(recs), n_cur, n_noff, len(T)))


if __name__ == "__main__":
    main()
