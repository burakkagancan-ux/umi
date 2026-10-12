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
import datetime
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

    ids = set(by)
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
