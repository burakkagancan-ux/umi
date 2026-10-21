"""sw.js'in kurulumda önbelleğe aldığı dosya listesini (CORE) ve önbellek adını (CACHE) üretir (15.10.2026; önce elle yazılıyordu).

CORE: sayfaların (index.html, ocr.html, ansiklopedi.html, yontem.html) yüklediği yerel dosyalar ve modüllerin içe aktardıkları, CSS'teki yazı tipleri, uygulama simgeleri,
js/*.js'in adıyla okuduğu data/*.json dosyaları ve kaynak dil (Türkçe). Dile ve sayfaya bağlı dosyalar (seçili dil, ansiklopedi
madde sayfaları) CORE'a girmez, sayfa açılınca iner (sw.js DINAMIK). İstek geldikçe önbelleğe alınanlar ISTEKLE'de.
CACHE: "tagsis-" + CORE dosyalarının içerik özeti. Kod, çeviri ya da veri değişince ad kendiliğinden değişir, service worker
yeni sürümü kurar; elle sürüm artırmak gerekmez. Bakanlık verisi (her gün update.yml ile değişir) özete girmez: önce ağdan okunur.

Çıktı sw.js'te "// <uretilen gen_sw.py>" ile "// </uretilen>" arasına yazılır; dosyanın geri kalanı elle yazılır.
python3 uret.py çalıştırır; CI (uret.py --denetle) sw.js'in güncel olduğunu denetler. test/onbellek.js bağımsız denetimdir.
"""
import hashlib, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SAYFALAR = ["index.html", "ocr.html", "ansiklopedi.html", "yontem.html"]
KAYNAK_DIL = ["i18n/diller.json", "i18n/tr.json", "data/ansiklopedi_tr.json"]   # Türkçe her dilin son yedeği; öteki diller DINAMIK
ISTEKLE = {"data/barkod_off.json"}                                              # kurulumu büyütmesin: istek geldikçe önbelleğe girer
GUNLUK = {"data/tagsis.json", "data/arsiv.json", "data/durum.json"}             # update.yml her gün yazar; CACHE özetine girmez
SW = os.path.join(HERE, "sw.js")
BAS, SON = "// <uretilen gen_sw.py>", "// </uretilen>"


def oku(yol, kip="r"):
    with open(os.path.join(HERE, yol), kip, **({} if "b" in kip else {"encoding": "utf-8"})) as f:
        return f.read()


def core_listesi():
    dosya = []

    def ekle(f):
        f = os.path.normpath(f).replace(os.sep, "/")
        if f not in dosya and f not in ISTEKLE:
            assert os.path.isfile(os.path.join(HERE, f)), "CORE için dosya yok: " + f
            dosya.append(f)

    for s in SAYFALAR:
        ekle(s)
    for s in SAYFALAR:
        for m in re.finditer(r'(?:src|href)="([^"#:?]+\.(?:js|css|png|webmanifest|json))"', oku(s)):
            ekle(m.group(1))
    # ES modülleri: sayfadaki giriş modülünün içe aktardıkları (zincirle); "import … from "./x.js"" satırları
    i = 0
    while i < len(dosya):
        f = dosya[i]
        if f.endswith(".js"):
            for m in re.finditer(r'^\s*(?:import|export)\b[^;]*?\bfrom\s*"(\.{1,2}/[^"]+\.js)"', oku(f), re.M):
                ekle(os.path.join(os.path.dirname(f), m.group(1)))
        i += 1
    for css in [f for f in dosya if f.endswith(".css")]:
        for m in re.finditer(r"url\(([^)\"']+)\)", oku(css)):
            ekle(os.path.join(os.path.dirname(css), m.group(1)))
    for ic in json.loads(oku("manifest.webmanifest")).get("icons", []):
        ekle(ic["src"])
    for f in sorted(os.listdir(os.path.join(HERE, "js"))):
        if f.endswith(".js"):
            for m in re.finditer(r'"(data/[a-z_]+\.json)"', oku("js/" + f)):
                ekle(m.group(1))
    for f in KAYNAK_DIL:
        ekle(f)
    return dosya


def main():
    core = core_listesi()
    oz = hashlib.sha256()
    for f in core:
        if f not in GUNLUK:
            oz.update(f.encode() + b"\0" + oku(f, "rb") + b"\0")
    satirlar = [BAS,
                "// Elle düzenlenmez: python3 uret.py (gen_sw.py) yazar. CACHE dosya içeriklerinin özeti; CORE kurulumda önbelleğe alınanlar.",
                'const CACHE = "tagsis-%s";' % oz.hexdigest()[:12],
                "const CORE = [", '  "./",']
    satirlar += ['  "%s",' % f for f in core]
    satirlar += ["];", SON]
    sw = oku("sw.js")
    a, b = sw.index(BAS), sw.index(SON) + len(SON)
    yeni = sw[:a] + "\n".join(satirlar) + sw[b:]
    if yeni != sw:
        with open(SW, "w", encoding="utf-8") as f:
            f.write(yeni)
    print("sw.js: %d dosya, %s" % (len(core) + 1, satirlar[2]))


if __name__ == "__main__":
    main()
