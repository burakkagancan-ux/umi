# -*- coding: utf-8 -*-
"""Temizlik ürünleri verisi: data/temizlik.json

Üç katman:
  hazards  : CLP / SEA zararlılık ifadeleri (H ve EUH). Etikette kodla ya da metinle yazılır.
  groups   : AB 648/2004 Ek VII A (TR Deterjanlar Hakkında Yönetmelik Ek-7) içerik grupları; yüzde bandıyla yazılır.
  subs     : Temizlik ürününde ayrıca not gerektiren, INCI adıyla yazılan maddeler (koruyucu, çamaşır suyu, asit, amonyak, enzim).
Koku alerjenleri ve diğer koruyucular kozmetik INCI dizininden (kozmetik.json, kozmetik_inci.json) tanınır.

Renk kararı (kullanıcı, 04.10.2026): ciddi tehlike (yanık, ciddi göz hasarı, zehirlilik, CMR, solunum hassaslaşması) kırmızı;
diğer sağlık uyarıları sarı; bilgi gri. Kırmızı burada "yasak" değil, ürünün resmi tehlike sınıfıdır.
Veri kaynak/temizlik_*.tsv ve kaynak/temizlik_gruplar.json dosyalarındadır.
Çalıştır: python3 gen_temizlik.py   (gen_kozmetik.py'den sonra; INCI adlarını kozmetik_inci.json ile denetler)
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
from uretec_ortak import kaynak_json, kaynak_tsv   # ortak yardımcılar (uretec_ortak.py)


OUT = os.path.join(HERE, "data", "temizlik.json")
VERSION = "0.1.0"
LAST_UPDATED = "2026-10-12"

CLP = "https://eur-lex.europa.eu/eli/reg/2008/1272/oj"
H_TR = "https://www.crad.com.tr/UPLOAD/URUN/FILES/Hcode-17140911685.pdf"
# SEA Yönetmeliği'nin Resmî Gazete'deki asıl metni; Ek-3 (H, EUH) ve Ek-4 (P) taranmış PDF'te (20131211M1-1.pdf, s. 152–190)
SEA = "https://www.resmigazete.gov.tr/eskiler/2013/12/20131211M1-1.htm"
# SEA'nın 2013 metninde olmayan EUH ifadeleri (EUH211, EUH212; 2023'te eklenen EUH380–EUH451) AB metninden çevrildi
EUH_AB = "https://eur-lex.europa.eu/eli/reg_del/2023/707/oj"
DET = "https://www.legislation.gov.uk/eur/2004/648/annex/VII"
DET_TR = "https://www.lexpera.com.tr/mevzuat/yonetmelikler/deterjanlar-hakkinda-yonetmelik-1"
SB_REHBER = "https://hsgm.saglik.gov.tr/depo/birimler/kronik-hastaliklar-ve-yasli-sagligi-db/Dokumanlar/Kitaplar/Saglikli_Temizlik_Rehberi_18.04.2022.pdf"

# ---------------------------------------------------------------------------
# Zararlılık ifadeleri (H ve EUH): kaynak/temizlik_ifadeler.tsv [kod, seviye, grup, TR metin, EN metin, sade açıklama]
# TR metinleri: H için SEA Yönetmeliği (RG 11.12.2013, 28848) Ek-3'e dayalı liste (CRAD); EUH için SEA Ek-3'ün resmi metni,
# SEA'da olmayan EUH'lar için çeviri (needs_review). 7. sütun: etikette görülebilecek diğer Türkçe yazımlar (" | " ile).
# ---------------------------------------------------------------------------
H, EUH = [], []
for _r in kaynak_tsv("temizlik_ifadeler.tsv"):
    (EUH if _r[0].startswith("EUH") else H).append(_r)
# Birleşik ifadeler (etikette tek cümle olarak yazılır): kaynak/temizlik_birlesik.tsv [kodlar, TR, EN]
HCOMB = [[r[0].split(";"), r[1], r[2]] for r in kaynak_tsv("temizlik_birlesik.tsv")]

# Türkçe metni SEA Ek-3'teki resmi metinle karşılaştırılan EUH ifadeleri (12.10.2026)
EUH_SEA = {"EUH014", "EUH018", "EUH019", "EUH044", "EUH029", "EUH031", "EUH032", "EUH066", "EUH070", "EUH071", "EUH201",
           "EUH201A", "EUH202", "EUH203", "EUH204", "EUH205", "EUH206", "EUH207", "EUH208", "EUH209", "EUH209A", "EUH210",
           "EUH401"}
# Eski ya da farklı firma çevirileri (TSV'nin 7. sütununa ek): aynı ifadeye bağlanır
TR_ALT = {"EUH210": ["Talep halinde güvenlik bilgi formu temin edilebilir."],
          "H361fd": ["Doğurganlığı muhtemelen kısıtlayabilir. Çocuğa anne karnında muhtemelen zarar verebilir."]}


def alt(r, i):
    """i. sütundaki " | " ile ayrılmış diğer yazımlar"""
    return [x.strip() for x in r[i].split(" | ") if x.strip()] if len(r) > i else []


# Önlem ifadeleri (P): kaynak/temizlik_onlemler.tsv [kod, TR, EN, ilk_yardim 1/0, diğer yazımlar]
# TR: SEA Ek-4'ün resmi metni (12.10.2026: 2013 metni; 20.10.2026: 2020 değişikliğiyle karşılaştırıldı).
PREC = [[r[0], r[1], r[2], int(r[3]), alt(r, 4)] for r in kaynak_tsv("temizlik_onlemler.tsv")]

# Sıvı çamaşır deterjanı kapsülleri: CLP Ek II 3.3 (AB 1297/2014 ile eklendi)
CAPSULE = {
 "pat": [r"kaps[uü]l", r"(?:^|[^a-z])capsules?(?![a-z])", r"(?:^|[^a-z])pods?(?![a-z])", r"suda" + r"[^a-z0-9%]+" + r"(?:cozunen|eriyen)" + r"[^a-z0-9%]+" + r"(?:film|ambalaj|paket)", r"water" + r"[^a-z0-9%]+" + r"soluble" + r"[^a-z0-9%]+" + r"(?:film|pouch|packaging)"],
 "title": "Deterjan kapsülü: çocuklar için ayrı dikkat",
 "text": "Sıvı çamaşır deterjanı kapsülleri AB'de özel kurallara bağlıdır (CLP Ek II 3.3): dış ambalaj içini göstermeyen, çocuğun açmakta zorlanacağı kilitli kapaklı olmalı ve üzerinde “Çocukların erişemeyeceği yerde saklayın” (P102) yazmalıdır. Kapsülün filminde ağza alınınca 6 saniye içinde tükürtecek acı bir madde bulunmalı, film 30 saniye suya ve 300 N basınca dayanmalıdır. Bu kurallar, kapsülleri şekere benzeten küçük çocuklarda yutma ve göze kaçma kazaları yüzünden getirildi.",
 "sources": ["https://reachonline.eu/clp/en/annex-ii-3-3.3.html", "https://www.legislation.gov.uk/eur/2014/1297/introduction"],
}
UZEM = "Türkiye'de Ulusal Zehir Danışma Merkezi (UZEM): 114."

GROUP_LABEL = {"cilt_goz": "Cilt ve göz", "solunum": "Solunum", "yutma": "Yutma", "zehir": "Zehirlilik",
               "cmr": "Kanser, genetik hasar, üreme (CMR)", "organ": "Organ hasarı", "cevre": "Çevre",
               "fiziksel": "Yangın, patlama, basınç", "karistirma": "Karıştırma", "alerji": "Alerji",
               "endokrin": "Endokrin bozucu", "diger": "Diğer"}

# ---------------------------------------------------------------------------
# İçerik grupları (648/2004 Ek VII A; TR Ek-7) ve ayrıca not gerektiren INCI adları: kaynak/temizlik_gruplar.json.
# pat: low()+sadeleştirilmiş metinde aranan düzenli ifadeler (ASCII, Türkçe harfler eşlenmiş); {W} sözcük arasıdır.
# Lookbehind kullanılmaz (eski Safari). about: sade açıklama.
# ---------------------------------------------------------------------------
W = r"[^a-z0-9%]+"   # sözcük arası
GG = kaynak_json("temizlik_gruplar.json")


def with_w(o):
    """pat içindeki {W} yer tutucusunu sözcük arası ifadesiyle değiştirir"""
    o = dict(o)
    o["pat"] = [p.replace("{W}", W) for p in o["pat"]]
    return o


GROUPS = [with_w(g) for g in GG["gruplar"]]
SUBS = [with_w(s) for s in GG["maddeler"]]

BANDS = {"b5": "%5'ten az", "b5_15": "%5-15", "b15_30": "%15-30", "b30": "%30 ve üzeri"}

MIX_RULE = {"title": "Başka ürünlerle karıştırmayın",
            "text": "Klorlu ürünler (çamaşır suyu) asitli ürünlerle (tuz ruhu, kireç çözücü) karışınca klor gazı, amonyakla karışınca zehirli gaz açığa çıkarır. Sağlık Bakanlığı bu ürünlerin karıştırılmamasını öneriyor; aktif klor içeren ürünlerin etiketinde EUH206 uyarısı zorunludur.",
            "sources": [SB_REHBER, CLP]}


ALIAS_TSV = os.path.join(HERE, "kaynak", "temizlik_esanlamlilar.tsv")


def read_aliases(known):
    out, seen = [], set()
    for ln in open(ALIAS_TSV, encoding="utf-8"):
        if not ln.strip() or ln.startswith("#"):
            continue
        ad, hedef, tur = [x.strip() for x in ln.rstrip("\n").split("\t")]
        ts = [t.strip() for t in hedef.split(";")]
        for t in ts:
            assert t in known, "INCI listesinde yok: %s (%s)" % (t, ad)
        assert tur in ("tr", "en", "kisa", "halk"), tur
        assert ad.lower() not in seen, "tekrar: " + ad
        seen.add(ad.lower())
        out.append([ad, ts, tur])
    return out


def ans_baglari(known):
    """Sonuç ekranından ansiklopediye bağlantı: INCI adı → temizlik ansiklopedisi kimliği (CAS). Adlar kaynak/ansiklopedi_temizlik.json
    'adlar' alanından; yalnızca INCI dizininde olanlar (sonuç ekranı maddeyi INCI adıyla tanır). Bir ad iki maddeye gidemez."""
    o = {}
    for r in kaynak_json("ansiklopedi_temizlik.json")["kayitlar"]:
        for a in r["adlar"]:
            if a in known:
                assert o.get(a, r["id"]) == r["id"], a
                o[a] = r["id"]
    return o


def main():
    ki = json.load(open(os.path.join(HERE, "data", "kozmetik_inci.json"), encoding="utf-8"))
    known = {x[0] for x in ki["items"]}
    aliases = read_aliases(known)
    for s in SUBS:
        for a in s["inci"]:
            assert a in known, a
    hz, seen = [], set()
    for row in H + EUH:
        code, lvl, grp, tr, en, note = row[:6]
        assert code not in seen, code
        seen.add(code)
        assert grp in GROUP_LABEL, grp
        e = {"code": code, "level": lvl, "group": grp, "tr": tr, "en": en}
        if note:
            e["note"] = note
        if code.startswith("EUH") and code not in EUH_SEA:
            e["needs_review"] = True   # SEA'nın 2013 metninde yok; Türkçe metin çeviri
        a = alt(row, 6) + TR_ALT.get(code, [])
        if a:
            e["alt"] = a
        hz.append(e)
    prec = []
    for code, tr, en, aid, a in PREC:
        e = {"code": code, "tr": tr, "en": en}
        if aid:
            e["aid"] = True
        if a:
            e["alt"] = a
        prec.append(e)
    for c in HCOMB:
        for x in c[0]:
            assert x in seen, x
    out = {
        "version": VERSION, "last_updated": LAST_UPDATED,
        "meta": {
            "description": "Temizlik ürünü etiketi: zararlılık ifadeleri (CLP/SEA), deterjan içerik grupları (AB 648/2004 Ek VII, TR Deterjanlar Hakkında Yönetmelik Ek-7) ve ayrıca not gerektiren maddeler.",
            "sources": {"clp": CLP, "h_tr": H_TR, "sea": SEA, "euh": EUH_AB, "det": DET, "det_tr": DET_TR, "sb": SB_REHBER},
            "hazard_source": "SEA Yönetmeliği (RG 11.12.2013, 28848) / AB CLP (EC) 1272/2008 Ek III. H ifadelerinin Türkçe metni SEA'ya dayalı listeden; EUH ve P ifadelerinin Türkçesi SEA'nın Resmî Gazete'deki metninden (Ek-3, Ek-4); SEA'da olmayan EUH ifadeleri çeviri.",
            "group_source": "AB 648/2004 Ek VII A ve TR Deterjanlar Hakkında Yönetmelik (RG 27.01.2018, 30314) Ek-7: %0,2'yi aşan gruplar bant halinde; enzim, dezenfektan, optik parlatıcı, parfüm her oranda; koruyucular INCI adıyla; %0,01'i aşan koku alerjenleri adıyla yazılır. AB 2026/405 sayılı yeni tüzük 2029'da uygulanmaya başlar.",
            "levels": {"red": "Ürünün resmi tehlike sınıfı ciddi: yanık, ciddi göz hasarı, zehirlilik, kanser/genetik/üreme (CMR), solunum hassaslaşması.",
                       "yellow": "Uyarı düzeyinde tehlike, alerji, karıştırma ya da çevre uyarısı.",
                       "info": "Bilgi."},
            "group_labels": GROUP_LABEL, "bands": BANDS,
            "word_sep": W,
        },
        "hazards": hz,
        "combos": [{"codes": c[0], "tr": c[1], "en": c[2]} for c in HCOMB],
        "groups": GROUPS, "subs": SUBS, "aliases": aliases,
        "precautions": prec, "capsule": CAPSULE, "uzem": UZEM, "mix_rule": MIX_RULE,
        "ans": ans_baglari(known),
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("temizlik.json: %d ifade (%d EUH), %d birleşik, %d önlem, %d grup, %d madde notu, %d eş anlamlı, %d ansiklopedi bağlantısı" % (
        len(hz), len(EUH), len(HCOMB), len(prec), len(GROUPS), len(SUBS), len(aliases), len(out["ans"])))


if __name__ == "__main__":
    main()
