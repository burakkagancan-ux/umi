# -*- coding: utf-8 -*-
"""
Katkı maddeleri için "Nedir / nerede kullanılır" açıklamaları -> data/e_aciklama.json
Sağlık/mevzuat değerlendirmesi burada YOK (o, e_kodlari.json içindeki 'reason' alanında).
Bu dosya e_kodlari.json'dan bağımsızdır; gen_e_kodlari.py yeniden çalıştırılsa da açıklamalar kaybolmaz.
Doğrulama düzeyi: genel bilgi (model bilgisi). Kimyasal tanım ve tipik kullanım alanı içerir.

Kullanım: python3 gen_e_aciklama.py
"""
import json, os, datetime

VERSION = "0.1.1"
HERE = os.path.dirname(os.path.abspath(__file__))
from uretec_ortak import kaynak_tsv   # ortak yardımcılar (uretec_ortak.py)


# Açıklamalar: kaynak/e_aciklama.tsv. "@AD<TAB>metin" satırları ortak metindir; "E214<TAB>@PARABEN" o metni kullanır.
ORTAK, A = {}, {}
for _k, _v in kaynak_tsv("e_aciklama.tsv"):
    if _k.startswith("@"):
        ORTAK[_k] = _v
    else:
        assert _k not in A, "tekrar: " + _k
        A[_k] = ORTAK[_v] if _v.startswith("@") else _v


def main():
    edb = json.load(open(os.path.join(HERE, "data", "e_kodlari.json"), encoding="utf-8"))
    ids = [i["id"] for i in edb["ingredients"]]
    missing = [i for i in ids if i not in A]
    extra = [k for k in A if k not in ids]
    if missing or extra:
        raise SystemExit("Eksik: %s\nFazla: %s" % (missing, extra))
    out = {"meta": {"version": VERSION, "generated": datetime.date.today().isoformat(),
                    "description": "Katkı maddelerinin ne olduğu ve nerede kullanıldığı. Sağlık/mevzuat değerlendirmesi içermez.",
                    "verification": "general_knowledge: model bilgisine dayanır; kimyasal tanım ve tipik kullanım alanıdır.",
                    "count": len(ids)},
           "about": {i: A[i] for i in ids}}
    p = os.path.join(HERE, "data", "e_aciklama.json")
    json.dump(out, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("Yazıldı:", p, len(ids), "açıklama")

if __name__ == "__main__":
    main()
