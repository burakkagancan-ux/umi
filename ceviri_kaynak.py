#!/usr/bin/env python3
"""Veri metinlerinin Türkçe kaynağı: çeviri anahtarı → bugünkü Türkçe metin (YOL_HARITASI.md O-25).
Anahtarlar arayüzdeki veriMetin/veriS çağrılarıyla aynı kurulur (js/arayuz*.js, js/kozmetik.js, js/temizlik.js);
yeni bir anahtar ailesi eklenince buraya da eklenir (gen_ceviri_veri.py bilinmeyen anahtarda durur).
gen_ceviri_veri.py bunu çevirinin hangi Türkçeden yapıldığını denetlemek için kullanır: Türkçe değişmişse çeviri bayattır.
Çalıştır: python3 ceviri_kaynak.py <anahtar>   (o anahtarın bugünkü Türkçesi)
          python3 ceviri_kaynak.py --eksik <dil>   (çevrilmemiş ya da bayat veri metinleri, ceviri_<dil>_veri.tsv biçiminde;
          çeviri sütunu boş: çevirmen ya da çeviri platformu doldurur, satırlar dosyaya eklenir)
Çevirmenin kaynak dili İngilizce (O-12): --eksik en Türkçeyi, diğer diller İngilizceyi verir; İngilizcesi henüz olmayan metin
diğer dillerde listelenmez (önce İngilizce çevrilir)."""
import json, os, sys

K = os.path.dirname(os.path.abspath(__file__))


def _oku(veri, f):
    return json.load(open(os.path.join(veri, f), encoding="utf-8"))


def tr_metinler(veri=None):
    """{anahtar: Türkçe metin}. veri: data/ klasörü (varsayılan deponun data/'sı; eski sürümle karşılaştırmak için başka klasör)."""
    veri = veri or os.path.join(K, "data")
    m = {}

    def koy(k, v):
        if isinstance(v, str) and v:
            m[k] = v

    e = _oku(veri, "e_kodlari.json")
    for x in e["ingredients"]:
        if x.get("verification") != "inventory_only":   # ortak gerekçe veride değil, gida.kart.olcut_yok anahtarında
            koy("e.%s.reason" % x["id"], x.get("reason"))
        koy("e.%s.tgk_not" % x["id"], x.get("tgk_note"))
        koy("e.%s.uretim" % x["id"], (x.get("uretim") or {}).get("n"))
    for i, v in _oku(veri, "e_aciklama.json")["about"].items():
        koy("e.%s.about" % i, v)
    for x in _oku(veri, "bilesenler.json")["items"]:
        koy("b.%s.not" % x["id"], x.get("note"))
    for r in _oku(veri, "eslesmeler.json")["rules"]:
        koy("eslesme.%s.baslik" % r["id"], r.get("title"))
        koy("eslesme.%s.metin" % r["id"], r.get("text"))
        for i, g in enumerate(r.get("groups") or []):
            koy("eslesme.%s.grup.%d" % (r["id"], i), g.get("label"))
    k = _oku(veri, "kozmetik.json")
    for x in k["entries"]:   # gerekçe (reason) yok: hepsi kGerekce kalıbından, çevirisi koz.gerekce.* anahtarlarında
        koy("k.%s.not" % x["id"], x.get("note_tr"))
        for i, u in enumerate(x.get("updates") or []):
            koy("k.%s.degisiklik.%d" % (x["id"], i), u.get("note_tr"))
    for s, v in (k["meta"].get("tr_text") or {}).items():
        koy("k.tr_durum." + s, v)
    for f, v in (k["meta"].get("inci_flag_reasons") or {}).items():
        koy("k.bayrak_neden." + f, v)
    for l, L in (k["meta"].get("watch_lists") or {}).items():
        koy("k.liste.%s.metin" % l, L.get("text"))
        koy("k.liste.%s.ad" % l, L.get("label"))
        koy("k.liste.%s.cip" % l, L.get("chip"))
    for w in k["watch"]:
        koy("k.izle.%s.%s" % (w["list"], (w.get("inci") or [""])[0]), w.get("note_tr"))
    t = _oku(veri, "temizlik.json")
    for h in t["hazards"]:
        koy("t.ifade.%s.not" % h["code"], h.get("note"))
    for g in t["groups"]:
        koy("t.grup." + g["id"], g.get("tr"))
        koy("t.grup.%s.about" % g["id"], g.get("about"))
    for s in t["subs"]:
        koy("t.madde.%s.metin" % s["id"], s.get("text"))
    for b, v in (t["meta"].get("bands") or {}).items():
        koy("t.bant." + b, v)
    for g, v in (t["meta"].get("group_labels") or {}).items():
        koy("t.grup_etiket." + g, v)
    koy("t.kapsul.baslik", t["capsule"].get("title"))
    koy("t.kapsul.metin", t["capsule"].get("text"))
    koy("t.karistirma.baslik", t["mix_rule"].get("title"))
    koy("t.karistirma.metin", t["mix_rule"].get("text"))
    koy("t.uzem", t.get("uzem"))
    return m


def tr_metin(anahtar, metinler):
    """Anahtarın bugünkü Türkçesi; "metin:<Türkçe>" ve "liste:<Türkçe>" anahtarları metnin kendisini taşır."""
    for on in ("metin:", "liste:"):
        if anahtar.startswith(on):
            return anahtar[len(on):]
    return metinler.get(anahtar)


def eksikler(dil, metinler):
    """Dilde karşılığı olmayan ya da kaynağı değişmiş (bayat) veri metinleri: [(anahtar, kaynak metin)].
    Kaynak: İngilizcede Türkçe, diğer dillerde İngilizce (gen_ceviri_veri.kaynak_metin ile aynı kural)."""
    kaynak = os.path.join(K, "kaynak")
    if dil == "en":
        hedef = dict(metinler)
    else:
        import gen_ceviri_veri as g   # döngüsel içe aktarma: gen_ceviri_veri bu dosyayı içe aktarır
        g.TR = metinler
        en = g.uret("en", yaz=False)
        hedef = {k: en[k] for k in metinler if k in en}
    var = set()
    for f in sorted(os.listdir(kaynak)):
        if not (f == "ceviri_%s.tsv" % dil or f.startswith("ceviri_%s_" % dil) and f.endswith(".tsv")):
            continue
        for l in open(os.path.join(kaynak, f), encoding="utf-8"):
            if l.startswith("#") or not l.strip():
                continue
            r = l.rstrip("\n").split("\t")
            if f != "ceviri_%s_veri.tsv" % dil or len(r) > 2 and hedef.get(r[0], tr_metin(r[0], metinler) if dil == "en" else None) == r[2]:
                var.add(r[0])
    return [(k, v) for k, v in sorted(hedef.items()) if k not in var and "metin:" + metinler[k] not in var]   # veriMetin metnin kendisiyle de arar


if __name__ == "__main__":
    M = tr_metinler()
    if sys.argv[1:2] == ["--eksik"]:
        for k, v in eksikler(sys.argv[2], M):
            print("%s\t\t%s" % (k, v))
    else:
        for a in sys.argv[1:]:
            print(a, "\t", tr_metin(a, M))
