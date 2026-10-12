# -*- coding: utf-8 -*-
"""
E kodlu gıda katkı maddeleri veri tabanını (data/e_kodlari.json) üretir.

Kullanım:  python3 gen_e_kodlari.py
- data/e_kodlari.json bu betikle üretilir; JSON'u elle düzenlemeyin. Veri kaynak/e_kodlari_maddeler.json
  (maddeler) ve kaynak/e_kodlari_ek.json'dadır (meta, bağlam eş anlamlıları, TGK notları, kaynak doğrulaması).
- Her kayıt için E kodu eş anlamlıları (e100, e-100, e 100, ins 100, ins100; harfli
  kodlarda e150(a), e 150 (a)) ve Türkçe karakterleri sadeleştirilmiş yazımlar
  (zerdeçal -> zerdecal) otomatik eklenir.
- "Bu listedeki özel uyarı ölçütlerinden hiçbirine girmiyor" açıklaması, reason=None
  olan kayıtlara kategori adıyla otomatik yazılır.
- counts (sayımlar) her çalıştırmada yeniden hesaplanır.

Not: Bu betik 03.10.2026'da depodaki e_kodlari.json v0.2.1'den geri üretildi
(özgün betik kayboldu). v0.3.0: TGK izinli katkı listesi (kaynak/tgk_ek2_2013.tsv)
ile karşılaştırma -> tgk_name / tgk_note alanları, resmi adlar eş anlamlı olarak eklendi,
eksik 4 madde (E420, E421, E907, E964) eklendi.
"""
import json, os, re

VERSION = '0.3.1'
LAST_UPDATED = '2026-10-04'
HERE = os.path.dirname(os.path.abspath(__file__))


def kaynak_json(ad):
    """kaynak/ klasöründeki JSON veri dosyası"""
    with open(os.path.join(HERE, "kaynak", ad), encoding="utf-8") as f:
        return json.load(f)


OUT = os.path.join(HERE, "data", "e_kodlari.json")

TR = str.maketrans("çğıöşüâîûİ", "cgiosuaiui")
def fold(s):
    return s.translate(TR)

TGK_TSV = os.path.join(HERE, "kaynak", "tgk_ek2_2013.tsv")

# TGK listesiyle karşılaştırmada özel durumlar (2013 metninden sonraki değişiklikler, bağlam)
# meta, baglam, tgk_notlari ve dogrulama: kaynak/e_kodlari_ek.json
EK = kaynak_json("e_kodlari_ek.json")
TGK_NOTES = EK["tgk_notlari"]
TGK_MISSING = "Türk Gıda Kodeksi izinli katkı listesinin 2013 metninde yok; Türkiye'deki güncel izin durumu doğrulanmadı."
# Güncel izinli liste (Bakanlık kılavuzu, Ekim 2024; 2023 yönetmeliği). 2013 listesinde olmayanların TR durumu buna göre yazılır.
TGK_2024 = {k: v for k, v in (l.split("\t") for l in open(os.path.join(HERE, "kaynak", "tgk_ek2_2024.tsv"), encoding="utf-8").read().splitlines()
                              if l and not l.startswith("#"))}
TGK_2024_ESDEGER = {"E960": "E960a"}   # 2023 yönetmeliği steviol glikozitlerini E960a olarak listeliyor
TGK_YOK_2024 = "Türkiye'de izinli değil: Türk Gıda Kodeksi Gıda Katkı Maddeleri Yönetmeliği'nin (2023) izinli katkı listesinde yok (Bakanlık kılavuzu, Ekim 2024)."
TGK_VAR_2024 = "2013 tarihli izinli listede yoktu; Türk Gıda Kodeksi'nin güncel izinli listesinde var (2023 yönetmeliği, Bakanlık kılavuzu Ekim 2024)."


def tgk_2024_var(eid):
    return eid in TGK_2024 or TGK_2024_ESDEGER.get(eid) in TGK_2024


def load_tgk(path=TGK_TSV):
    """kaynak/tgk_ek2_2013.tsv -> {E kodu: resmi Türkçe ad}"""
    out = {}
    if not os.path.exists(path):
        return out
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            k, v = line.rstrip("\n").split("\t")
            out[k] = v
    return out


# Resmi adda virgül/eğik çizgi ayrı adları ayırıyorsa (ör. "Koşineal, Karminik asit, Karminler") parçalar
# ayrı eş anlamlı olur. Diğerlerinde virgül adın parçasıdır ("Balmumu, beyaz ve sarı"), bölünmez.
TGK_SPLIT = {"E110", "E120", "E122", "E124", "E132", "E151", "E160b", "E160c", "E162",
             "E410", "E413", "E427", "E466", "E468", "E469"}


def tgk_aliases(eid, name):
    """Resmi adı etiketlerde geçebilecek biçimlere çevirir: parantezsiz ad, (izinliyse) parçalar, anlamlı parantez içi."""
    if not name:
        return []
    low = name.replace("İ", "i").replace("I", "ı").lower()
    out = []
    def add(x):
        x = " ".join(x.split()).strip(" ,/")
        if len(re.sub(r"[^a-zçğıöşü]", "", x)) >= 4 and x not in out:
            out.append(x)
    inner, outer = [], low
    while "(" in outer:
        m = re.search(r"\(([^()]*)\)", outer)
        if not m:
            break
        inner.append(m.group(1))
        outer = outer[:m.start()] + " " + outer[m.end():]
    if eid in TGK_SPLIT:
        for part in re.split(r"[,/]", outer):
            add(part)
    else:
        add(outer)
        if "(" in low:
            add(low)
    for x in inner:
        if re.search(r"[a-zçğıöşü]{4}", x):
            add(x)
    return out


DEFAULT_REASON = "{K}. Bu listedeki özel uyarı ölçütlerinden hiçbirine girmiyor; bu uygulamada ayrıntılı bir değerlendirme yapılmadı."

# Bağlam gerektiren eş anlamlılar (ör. "karamel" yalnızca "renklendirici (karamel)" gibi kullanımlarda E150 sayılır)
CONTEXT = EK["baglam"]

META = EK["meta"]

# Maddeler: kaynak/e_kodlari_maddeler.json. Alanlar: id, ad (primary_name), en (name_en), kategori, adlar (eş anlamlılar),
# bayraklar, risk, gerekce (reason; null -> DEFAULT_REASON), kurumlar (agencies), ab (eu_status), inceleme (needs_review),
# dogrulama (verification), baglam (context -> CONTEXT anahtarı)
ITEM_KEYS = ["id", "ad", "en", "kategori", "adlar", "bayraklar", "risk", "gerekce", "kurumlar", "ab", "inceleme", "dogrulama", "baglam"]
ITEMS = [tuple(x[k] for k in ITEM_KEYS) for x in kaynak_json("e_kodlari_maddeler.json")["maddeler"]]

# 03.10.2026 kaynak doğrulaması (kaynak/e_kodlari_ek.json "dogrulama"). Anahtar: E kodu -> {sources, isteğe bağlı reason/risk/flags/partial}.
# partial=True: iddianın bir kısmı doğrulandı (needs_review kalır). TR izin durumu belirsiz kayıtlar da needs_review kalır.
VERIFY = EK["dogrulama"]


# Günlük kabul edilebilir alım (ADI): kaynak/e_adi.tsv (04.10.2026). E kodu -> adi alanı.
ADI_TSV = os.path.join(HERE, "kaynak", "e_adi.tsv")


def load_adi(path=ADI_TSV):
    out = {}
    head = None
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            cols = line.split("\t")
            if head is None:
                head = cols
                continue
            r = dict(zip(head, cols))
            v = r["deger"]
            assert r["birim"] in ("gun", "hafta"), line
            a = {"st": v if v in ("ns", "yok") else "set", "per": r["birim"], "src": r["kurum"]}
            if a["st"] == "set":
                a["v"] = float(v)
            for k, key in (("ifade", "as"), ("not", "note"), ("kaynak", "url")):
                if r[k]:
                    a[key] = r[k]
            a["ok"] = r["dogrulandi"] == "1"
            for eid in r["kodlar"].split(","):
                assert eid not in out, eid
                out[eid] = a
    return out


ADI = load_adi()


# Üretim yolu: kaynak/e_uretim.tsv (05.10.2026). E kodu -> uretim alanı {s: sınıf, n: not, u: kaynak, ok}.
URETIM_TSV = os.path.join(HERE, "kaynak", "e_uretim.tsv")
URETIM_SINIF = ("dogal", "fermente", "islenmis", "sentetik", "belirsiz")


def load_uretim(path=URETIM_TSV):
    out = {}
    head = None
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            cols = line.split("\t")
            if head is None:
                head = cols
                continue
            r = dict(zip(head, cols))
            assert r["sinif"] in URETIM_SINIF, line
            assert r["not"], line
            assert r["dogrulandi"] in ("0", "1") and (r["dogrulandi"] == "0" or r["kaynak"]), line
            u = {"s": r["sinif"], "n": r["not"], "ok": r["dogrulandi"] == "1"}
            if r["kaynak"]:
                u["u"] = r["kaynak"]
            for eid in r["kodlar"].split(","):
                assert eid not in out, eid
                out[eid] = u
    return out


URETIM = load_uretim()


def apply_verify(rec, review):
    v = VERIFY.get(rec["id"])
    if not v:
        return review
    rec["sources"] = v["sources"]
    if "reason" in v: rec["reason"] = v["reason"]
    if "risk" in v: rec["risk_level"] = v["risk"]
    if "flags" in v:
        keep = [f for f in rec["flags"] if f not in ("debated", "banned_eu")]
        rec["flags"] = keep + [f for f in v["flags"] if f not in keep]
    rec["verification"] = "partially_checked" if v.get("partial") else "checked_2026_10"
    return True if v.get("partial") else False


# İngilizce eş anlamlılar (08.10.2026, B-08): kaynak/ingilizce_esanlamlilar.tsv. hedef<TAB>ad<TAB>koşul<TAB>kaynak.
# E kodu satırları "aliases_en" alanına (koşul "en" ise "en_only"; hedef virgülle birden çok kod olabilir); bileşen satırlarını gen_bilesenler.py okur.
EN_TSV = os.path.join(HERE, "kaynak", "ingilizce_esanlamlilar.tsv")


def load_en(path=EN_TSV):
    out = {}
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            line = line.rstrip("\n")
            if not line.strip() or line.startswith("#"):
                continue
            p = line.split("\t")
            assert len(p) == 4 and p[0] and p[1] and p[3], ("ingilizce_esanlamlilar.tsv satır %d: 4 sütun, ad ve kaynak dolu olmalı" % n, line)
            assert p[2] in ("", "en"), ("ingilizce_esanlamlilar.tsv satır %d: koşul boş ya da 'en'" % n, line)
            for h in p[0].split(","):          # birden çok E kodu: "E1404,E1410"
                out.setdefault(h, []).append((p[1], p[2]))
    return out


EN = load_en()


def code_aliases(eid):
    c = eid[1:].lower()
    a = ["e" + c, "e-" + c, "e " + c, "ins " + c, "ins" + c]
    m = re.match(r"^(\d+)([a-z])$", c)
    if m:
        a += ["e%s(%s)" % m.groups(), "e %s (%s)" % m.groups()]
    return a


def with_folds(names):
    extra = []
    for x in names:
        f = fold(x)
        if f != x and f not in names and f not in extra:
            extra.append(f)
    return names + extra


def build():
    tgk = load_tgk()
    seen = set()
    items = []
    for (eid, name, en, cat, names, flags, risk, reason, agencies, eu, review, verif, ctx) in ITEMS:
        assert eid not in seen, eid
        seen.add(eid)
        for f in flags:
            assert f in META["flags"], (eid, f)
        assert risk in META["risk_levels"], (eid, risk)
        assert verif in META["verification"], (eid, verif)
        names = list(names)
        if tgk:
            for a in tgk_aliases(eid, tgk.get(eid, "")):
                if a not in names:
                    names.append(a)
            if eid not in tgk and not review and eid not in TGK_NOTES and risk == "green" and not TGK_2024:
                review = True            # TR izin durumu belirsiz: doğrulanana kadar işaretli
        rec = {"id": eid, "ins": eid[1:], "primary_name": name, "name_en": en, "category": cat,
               "aliases": code_aliases(eid) + with_folds(names), "flags": list(flags),
               "risk_level": risk, "reason": reason if reason is not None else DEFAULT_REASON.replace("{K}", cat),
               "agencies": list(agencies), "eu_status": eu, "needs_review": review, "verification": verif}
        tr_unknown = bool(tgk) and eid not in tgk and eid not in TGK_NOTES and rec["risk_level"] == "green" and not TGK_2024
        rec["needs_review"] = apply_verify(rec, review) or (review and eid not in VERIFY) or tr_unknown
        if eid in tgk:
            rec["tgk_name"] = tgk[eid]
        if eid in TGK_NOTES or (tgk and eid not in tgk):
            rec["tgk_note"] = TGK_NOTES.get(eid) or (TGK_VAR_2024 if tgk_2024_var(eid) else TGK_YOK_2024)
        elif not tgk_2024_var(eid):
            rec["tgk_note"] = TGK_YOK_2024   # 2013'te vardı, güncel listede yok
        if ctx:
            rec["context_aliases"] = CONTEXT[ctx]
        var = set(a.lower() for a in rec["aliases"])
        for a, k in EN.get(eid, []):
            if a.lower() in var:
                continue
            var.add(a.lower())
            rec.setdefault("en_only" if k == "en" else "aliases_en", []).append(a)
        if eid in ADI:
            rec["adi"] = ADI[eid]
        assert eid in URETIM, ("e_uretim.tsv: eksik kod", eid)
        rec["uretim"] = URETIM[eid]
        items.append(rec)
    for eid in ADI:
        assert eid in seen, ("e_adi.tsv: bilinmeyen kod", eid)
    for eid in URETIM:
        assert eid in seen, ("e_uretim.tsv: bilinmeyen kod", eid)
    for eid in EN:
        assert eid in seen or not re.match(r"^E\d", eid), ("ingilizce_esanlamlilar.tsv: bilinmeyen kod", eid)
    meta = dict(META)
    cnt = {"total": len(items)}
    for lv in ("green", "red", "yellow", "unrated"):
        cnt[lv] = sum(1 for i in items if i["risk_level"] == lv)
    cnt["needs_review"] = sum(1 for i in items if i["needs_review"])
    cnt["adi"] = sum(1 for i in items if "adi" in i)
    for k in URETIM_SINIF:
        cnt["uretim_" + k] = sum(1 for i in items if i["uretim"]["s"] == k)
    meta["counts"] = cnt
    meta["adi"] = ("adi: günlük kabul edilebilir alım, mg/kg vücut ağırlığı (per=hafta ise haftalık). st: set (v sayı), "
                   "ns (belirlenmedi), yok (geri çekildi / konamadı). ok=false: değer kaynak bağlantısıyla doğrulanmadı.")
    meta["uretim"] = ("uretim: üretim yolu, risk rengini değiştirmez. s: dogal (fiziksel yolla), fermente, islenmis (doğal hammadde "
                      "kimyasal/ısıl/enzimatik işlemle değiştirilmiş), sentetik, belirsiz (birden çok yol). n: açıklama. "
                      "ok=false: genel bilgiye dayalı, kaynakla doğrulanmadı.")
    return {"version": VERSION, "last_updated": LAST_UPDATED, "meta": meta, "ingredients": items}


def write(db, path=OUT):
    s = "{\n"
    s += '"version": ' + json.dumps(db["version"]) + ",\n"
    s += '"last_updated": ' + json.dumps(db["last_updated"]) + ",\n"
    s += '"meta": ' + json.dumps(db["meta"], ensure_ascii=False, indent=1) + ",\n"
    s += '"ingredients": [\n'
    s += ",\n".join(json.dumps(i, ensure_ascii=False) for i in db["ingredients"])
    s += "\n]\n}\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(s)


if __name__ == "__main__":
    db = build()
    write(db)
    print("Yazıldı:", OUT, db["meta"]["counts"])
