"""Veri üreteçlerinin (gen_*.py) ortak yardımcıları: kaynak/ altındaki JSON ve TSV dosyalarını okuma, İngilizce eş anlamlılar.
Her üreteç kendi kopyasını taşıyordu (15.10.2026'da buraya toplandı); davranış birebir aynı (CI veri adımı data/ değişmediğini denetler)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))


def kaynak_json(ad):
    """kaynak/ klasöründeki JSON veri dosyası"""
    with open(os.path.join(HERE, "kaynak", ad), encoding="utf-8") as f:
        return json.load(f)


def kaynak_tsv(ad):
    """kaynak/ klasöründeki TSV veri dosyası: '#' ile başlayan ve boş satırlar atlanır, satır sekmeyle bölünür"""
    with open(os.path.join(HERE, "kaynak", ad), encoding="utf-8") as f:
        return [ln.rstrip("\n").split("\t") for ln in f if ln.strip() and not ln.startswith("#")]


def oku_json(yol):
    """Depo köküne göre (ya da mutlak) yoldaki JSON dosyası"""
    with open(os.path.join(HERE, yol), encoding="utf-8") as f:
        return json.load(f)


def load_en(path=os.path.join(HERE, "kaynak", "ingilizce_esanlamlilar.tsv")):
    """İngilizce eş anlamlılar (B-08): hedef<TAB>ad<TAB>koşul<TAB>kaynak → {hedef: [(ad, koşul)]}; hedefte virgülle birden çok kimlik olabilir"""
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
