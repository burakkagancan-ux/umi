# -*- coding: utf-8 -*-
"""
Değerlendirme değişiklik kaydı (O-05, E-02'nin altyapısı).

Her maddenin veride taşıdığı renk (gıda: data/e_kodlari.json risk_level; kozmetik: data/kozmetik.json level;
temizlik: data/temizlik.json H kodu, grup ve madde level) kaynak/renk_anlik.tsv'de saklanır. Veride bir renk
değişirse, yeni madde gelirse ya da madde çıkarsa kaynak/degisiklik_kaydi.tsv'ye tarihi, gerekçesi ve kaynağıyla
bir satır yazılmadan anlık dosya güncellenemez; CI anlık dosyanın veriyle aynı olduğunu denetler.

Kullanım:
  python3 degisiklik_kaydi.py              # denetler: veri anlık dosyayla aynı mı, kayıt dosyası geçerli mi (CI)
  python3 degisiklik_kaydi.py --guncelle   # her fark kayıtta karşılanıyorsa anlık dosyayı veriden yeniden yazar
Çıkış kodu: fark ya da geçersiz satır varsa 1.

Kayıt sütunları: tarih (GG.AA.YYYY) | tür (gida, kozmetik, temizlik) | kimlikler (boşlukla ayrılır) | eski | yeni |
gerekçe | kaynak (resmi metin ya da görüşün adı/bağlantısı) | PR. Renk değerleri verideki gibidir (green, yellow,
orange, red, info); "-" listede yok demektir (yeni eklenen ya da çıkarılan madde).
"""
import datetime, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ANLIK = os.path.join(HERE, "kaynak", "renk_anlik.tsv")
KAYIT = os.path.join(HERE, "kaynak", "degisiklik_kaydi.tsv")
TURLER = ("gida", "kozmetik", "temizlik")
RENKLER = {"green", "yellow", "orange", "red", "info", "unrated", "-"}


def veri_renkleri():
    """{(tür, kimlik): renk} — verinin bugünkü hâli."""
    def oku(ad):
        with open(os.path.join(HERE, "data", ad), encoding="utf-8") as f:
            return json.load(f)
    out = {}
    for i in oku("e_kodlari.json")["ingredients"]:
        out[("gida", i["id"])] = i["risk_level"]
    for i in oku("kozmetik.json")["entries"]:
        out[("kozmetik", i["id"])] = i["level"]
    t = oku("temizlik.json")
    for i in t["hazards"]:
        out[("temizlik", i["code"])] = i["level"]
    # Grup ve madde kimlikleri H koduyla ya da birbiriyle çakışmasın diye önekli
    for alan, onek in (("groups", "grup:"), ("subs", "madde:")):
        for i in t[alan]:
            out[("temizlik", onek + i["id"])] = i["level"]
    return out


def anlik_oku():
    out = {}
    with open(ANLIK, encoding="utf-8") as f:
        for s in f:
            if s.startswith("#") or not s.strip():
                continue
            tur, kim, renk = s.rstrip("\n").split("\t")
            out[(tur, kim)] = renk
    return out


def kayit_oku():
    """Geçerli satırlar ve hata listesi."""
    satirlar, hatalar = [], []
    with open(KAYIT, encoding="utf-8") as f:
        for n, s in enumerate(f, 1):
            if s.startswith("#") or not s.strip():
                continue
            p = s.rstrip("\n").split("\t")
            if len(p) != 8:
                hatalar.append("%d. satır: 8 sütun olmalı, %d var" % (n, len(p)))
                continue
            tarih, tur, kimler, eski, yeni, gerekce, kaynak, pr = [x.strip() for x in p]
            try:
                datetime.datetime.strptime(tarih, "%d.%m.%Y")
            except ValueError:
                hatalar.append("%d. satır: tarih GG.AA.YYYY olmalı: %s" % (n, tarih))
            if tur not in TURLER:
                hatalar.append("%d. satır: tür geçersiz: %s" % (n, tur))
            if eski not in RENKLER or yeni not in RENKLER or eski == yeni:
                hatalar.append("%d. satır: eski/yeni renk geçersiz: %s → %s" % (n, eski, yeni))
            if not kimler or not gerekce or gerekce == "-" or not kaynak or kaynak == "-":
                hatalar.append("%d. satır: kimlik, gerekçe ve kaynak boş olamaz" % n)
            if not re.fullmatch(r"#\d+|-", pr):
                hatalar.append("%d. satır: PR '#123' ya da '-' olmalı: %s" % (n, pr))
            for k in kimler.split():
                satirlar.append({"satir": n, "tur": tur, "kim": k, "eski": eski, "yeni": yeni})
    return satirlar, hatalar


def farklar(anlik, veri):
    return sorted((k, anlik.get(k, "-"), veri.get(k, "-"))
                  for k in set(anlik) | set(veri) if anlik.get(k, "-") != veri.get(k, "-"))


def karsilanmayanlar(fark, satirlar):
    """Kayıtta eşleşen satırı (aynı tür, kimlik, eski ve yeni renk) olmayan farklar."""
    var = {(s["tur"], s["kim"], s["eski"], s["yeni"]) for s in satirlar}
    return [f for f in fark if (f[0][0], f[0][1], f[1], f[2]) not in var]


def anlik_yaz(veri):
    with open(ANLIK, "w", encoding="utf-8") as f:
        f.write("# Her maddenin veride taşıdığı renk. Elle değiştirilmez: python3 degisiklik_kaydi.py --guncelle\n")
        f.write("# (yalnızca her fark kaynak/degisiklik_kaydi.tsv'de karşılanıyorsa yazar). Sütunlar: tür | kimlik | renk\n")
        for (tur, kim), renk in sorted(veri.items()):
            f.write("%s\t%s\t%s\n" % (tur, kim, renk))


def main():
    guncelle = "--guncelle" in sys.argv[1:]
    satirlar, hatalar = kayit_oku()
    veri = veri_renkleri()
    if not os.path.exists(ANLIK):   # ilk kurulum: geçmiş değişiklikler kayıtta, bugünkü hâl başlangıç olur
        if not guncelle:
            print("kaynak/renk_anlik.tsv yok: python3 degisiklik_kaydi.py --guncelle")
            return 1
        anlik_yaz(veri)
        print("renk_anlik.tsv oluşturuldu: %d madde." % len(veri))
        return 0
    fark = farklar(anlik_oku(), veri)
    eksik = karsilanmayanlar(fark, satirlar)
    for h in hatalar:
        print("HATA kaynak/degisiklik_kaydi.tsv " + h)
    for (tur, kim), eski, yeni in eksik:
        print("KAYIT YOK %s %s: %s → %s" % (tur, kim, eski, yeni))
    if hatalar or eksik:
        print("Renk değişikliklerini kaynak/degisiklik_kaydi.tsv'ye tarih, gerekçe ve kaynakla yazın, sonra "
              "python3 degisiklik_kaydi.py --guncelle çalıştırın.")
        return 1
    if fark:
        if guncelle:
            anlik_yaz(veri)
            print("renk_anlik.tsv güncellendi: %d fark, hepsi kayıtta." % len(fark))
            return 0
        print("%d fark kayıtta karşılanıyor ama renk_anlik.tsv eski: python3 degisiklik_kaydi.py --guncelle" % len(fark))
        return 1
    print("değişiklik kaydı: %d madde, %d kayıt satırı, veri anlık dosyayla aynı." % (len(veri), len(satirlar)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
