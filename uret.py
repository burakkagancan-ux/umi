"""Bütün veri üreteçlerini doğru sırayla çalıştırır (tek komut; CI, aylık iş akışları ve yerel çalıştırma aynı listeyi kullanır).

Kullanım:
  python3 uret.py             üreteçleri çalıştırır; yalnızca "generated" tarih satırı değişen dosyaları eski haline döndürür (gürültü olmasın)
  python3 uret.py --denetle   CI: üreteçleri çalıştırır, data/ ve çeviri çıktıları depodakiyle aynı değilse ya da depoya eklenmemiş
                              üretilmiş dosya varsa hata verir (veri değiştiren PR üretilen JSON'u da içermeli)

Yeni üreteç: SIRA listesine bağımlılıklarından sonra eklenir (gen_sw her zaman en son, ayrıca çalışır). Sıra bağımlılıktır: bir üreteç yalnızca kendinden önce gelenlerin
çıktısını okuyabilir (ör. gen_eslesmeler, gen_e_kodlari ve gen_kozmetik'ten sonra; gen_ansiklopedi, gen_temizlik'ten sonra).
"""
import os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
SIRA = [
    "gen_e_kodlari",      # data/e_kodlari.json
    "gen_bilesenler",     # data/bilesenler.json (e_kodlari'ni okur)
    "gen_e_aciklama",     # data/e_aciklama.json
    "gen_kozmetik",       # data/kozmetik.json, kozmetik_inci.json
    "gen_eslesmeler",     # data/eslesmeler.json (e_kodlari + kozmetik)
    "gen_temizlik",       # data/temizlik.json (kozmetik_inci)
    "gen_ansiklopedi",    # data/ansiklopedi*.json (e_kodlari, temizlik)
    "gen_rozetler",       # data/rozetler.json (ansiklopedi)
    "gen_ceviri_veri",    # i18n/veri/<dil>.json (bütün veri metinleri)
    "gen_barkod",         # data/barkod_off.json (bağımsız)
    "gen_besin",          # data/besin.json (bağımsız)
    "gen_manifest",       # manifest.webmanifest, i18n/manifest/ (i18n/<dil>.json)
]
CIKTI = ["data/", "i18n/veri/", "i18n/manifest/", "manifest.webmanifest", "sw.js"]
# En son: sw.js CORE ve CACHE (dosya içeriklerinin özeti). Tarih satırı geri alındıktan sonra çalışır ki özet depodaki içerikten hesaplansın.
SON = "gen_sw"


def git(*a):
    return subprocess.run(["git", *a], cwd=HERE, capture_output=True, text=True).stdout


def yalniz_tarih(dosya):
    """Dosyadaki bütün değişiklikler "generated" tarih satırındaysa True"""
    satir = [l for l in git("diff", "-U0", "--", dosya).splitlines()
             if l[:1] in "+-" and not l.startswith(("+++", "---"))]
    return bool(satir) and all('"generated":' in l for l in satir)


def calistir(g):
    t = time.time()
    r = subprocess.run([sys.executable, g + ".py"], cwd=HERE, capture_output=True, text=True)
    if r.returncode:
        print(r.stdout + r.stderr)
        sys.exit("HATA: %s.py çıkış kodu %d" % (g, r.returncode))
    print("%-18s %.1f sn" % (g, time.time() - t))


def main():
    denetle = "--denetle" in sys.argv
    bas = time.time()
    for g in SIRA:
        calistir(g)
    tarih = [f for f in git("diff", "--name-only", "--", *CIKTI).splitlines() if f and yalniz_tarih(f)]
    if tarih:
        git("checkout", "--", *tarih)   # yalnızca üretilen dosyalar ve yalnızca tarih satırı değişmişse
    calistir(SON)
    print("toplam %.1f sn" % (time.time() - bas))
    degisen = [f for f in git("diff", "--name-only", "--", *CIKTI).splitlines() if f]
    yeni = [f for f in git("ls-files", "--others", "--exclude-standard", "--", *CIKTI).splitlines() if f]
    if degisen:
        print("Değişen üretilmiş dosyalar:\n  " + "\n  ".join(degisen))
    if yeni:
        print("Depoda olmayan üretilmiş dosyalar:\n  " + "\n  ".join(yeni))
    if denetle and (degisen or yeni):
        print(git("diff", "--stat", "--", *CIKTI))
        sys.exit("HATA: data/ kaynak/ ile uyumlu değil: JSON elle düzenlenmiş ya da üreteç çalıştırılmamış (python3 uret.py, çıktıyı PR'a ekleyin)")


if __name__ == "__main__":
    main()
