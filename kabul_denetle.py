# -*- coding: utf-8 -*-
"""
Yazan ile sınayanın ayrımı (20.10.2026, kullanıcı kararı; belgeler/mimari/testler.md "Kabul testi ve bozma turu").

Kabul testleri (test/kabul/) kodu görmeyen ayrı bir ajan tarafından, koddan ÖNCE, kullanıcının istediği davranıştan
yazılır. Kodu yazan ajan onları değiştirerek testi geçemesin diye bu denetim PR'daki commit'leri sırayla okur:

  1. Bir commit hem test/kabul/ hem kod değiştiremez.
  2. İlk kod commit'inden sonra test/kabul/ ancak commit iletisinde "Kabul-degisikligi: <gerekçe>" satırıyla değişir.
  3. Kullanıcıya görünen kod (js/, css/, worker/src/, i18n/, kökteki .html, tema.css) değiştiyse PR'da test/kabul/
     altında en az bir dosya eklenmiş ya da değişmiş olmalı; yoksa bir commit iletisinde "Kabul-yok: <gerekçe>"
     (ör. davranışı değiştirmeyen yeniden yapılanma; altın çıktı ve arayüz testleri onu korur).
  4. Kabul testi uygulamanın içine bakmaz: id/sınıf seçicisi, querySelector, evaluate, waitForFunction yok; öğeler
     kullanıcının gördüğü şeyle (rol, görünen metin, aria etiketi, placeholder) bulunur.

"Kod": test/, belgeler/, .github/ dışındaki ve .md olmayan her dosya (veri ve üreteçler dahil).

Kullanım:
  python3 kabul_denetle.py <taban>   # ör. origin/main; taban ile HEAD arasındaki commit'ler (birleştirme commit'leri hariç)
  python3 kabul_denetle.py           # yalnızca 4. kural (test/kabul/ dosyalarının içeriği)
Çıkış kodu: kural ihlali varsa 1.
"""
import os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
KABUL = "test/kabul/"
GORUNUR = ("js/", "css/", "worker/src/", "i18n/", "tema.css")
YASAK = [
    (re.compile(r"""locator\(\s*['"`]\s*[#.\[]"""), "id/sınıf/öznitelik seçicisi (locator('#…'))"),
    (re.compile(r"""\.(click|fill|check|hover|type|press|waitForSelector|\$|\$\$|\$eval|\$\$eval)\(\s*['"`]\s*[#.\[]"""), "id/sınıf seçicisi (click('#…') vb.)"),
    (re.compile(r"querySelector"), "querySelector"),
    (re.compile(r"\bevaluate(Handle)?\s*\("), "evaluate (uygulamanın içine bakar)"),
    (re.compile(r"waitForFunction"), "waitForFunction (uygulamanın içine bakar)"),
    (re.compile(r"""require\(\s*['"`]\.\./arayuz/"""), "arayüz testinin yardımcıları (iç işlevleri çağırır; test/kabul/_ortak.js kullanılır)"),
]
GEREKCE = lambda ad: re.compile(r"^" + ad + r":\s*\S", re.M)


def kod_mu(f):
    return not (f.startswith(("test/", "belgeler/", ".github/")) or f.endswith(".md"))


def gorunur_mu(f):
    return f.startswith(GORUNUR) or ("/" not in f and f.endswith(".html"))


def kurallar(commitler):
    """commitler: eskiden yeniye [(kısa_kimlik, ileti, [dosyalar])]. Hata iletileri listesi döner."""
    hatalar, kod_basladi, kabul_var, gorunur, kabul_yok = [], False, False, False, False
    for kim, ileti, dosyalar in commitler:
        kabul = [f for f in dosyalar if f.startswith(KABUL)]
        kod = [f for f in dosyalar if kod_mu(f)]
        if any(gorunur_mu(f) for f in kod):
            gorunur = True
        if GEREKCE("Kabul-yok").search(ileti):
            kabul_yok = True
        if kabul:
            kabul_var = True
            if kod:
                hatalar.append(f"{kim}: aynı commit hem kabul testini ({kabul[0]}) hem kodu ({kod[0]}) değiştiriyor; kabul testi ayrı ve önce gelir")
            elif kod_basladi and not GEREKCE("Kabul-degisikligi").search(ileti):
                hatalar.append(f"{kim}: kod yazıldıktan sonra kabul testi değişti ({kabul[0]}); gerekçe gerekiyor: commit iletisine 'Kabul-degisikligi: <neden>'")
        if kod:
            kod_basladi = True
    if gorunur and not kabul_var and not kabul_yok:
        hatalar.append("kullanıcıya görünen kod değişti ama test/kabul/ altında kabul testi yok; ya kabul testi ekleyin ya bir commit iletisine 'Kabul-yok: <neden>'")
    return hatalar


def icerik_denetle(dosyalar):
    """{yol: metin} → hata listesi (4. kural)."""
    hatalar = []
    for yol, metin in sorted(dosyalar.items()):
        for no, satir in enumerate(metin.splitlines(), 1):
            kod = satir.split("//", 1)[0]
            for desen, ad in YASAK:
                if desen.search(kod):
                    hatalar.append(f"{yol}:{no}: {ad}; kabul testi öğeyi rolüyle ya da görünen metniyle bulur")
    return hatalar


def git(*a):
    return subprocess.run(["git", *a], cwd=HERE, check=True, capture_output=True, text=True).stdout


def git_commitleri(taban):
    taban_nokta = git("merge-base", taban, "HEAD").strip()
    out = []
    for kim in git("rev-list", "--reverse", "--no-merges", f"{taban_nokta}..HEAD").split():
        ileti = git("log", "-1", "--format=%B", kim)
        dosyalar = [f for f in git("diff-tree", "--no-commit-id", "--name-only", "-r", kim).splitlines() if f]
        out.append((kim[:7], ileti, dosyalar))
    return out


def kabul_dosyalari():
    d = os.path.join(HERE, KABUL)
    if not os.path.isdir(d):
        return {}
    return {KABUL + f: open(os.path.join(d, f), encoding="utf-8").read() for f in sorted(os.listdir(d)) if f.endswith(".js")}


def main():
    hatalar = icerik_denetle(kabul_dosyalari())
    if len(sys.argv) > 1:
        commitler = git_commitleri(sys.argv[1])
        hatalar += kurallar(commitler)
        print(f"{len(commitler)} commit okundu")
    for h in hatalar:
        print("HATA", h)
    print(f"Kabul ayrımı: {len(hatalar)} hata")
    sys.exit(1 if hatalar else 0)


if __name__ == "__main__":
    main()
