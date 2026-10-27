#!/usr/bin/env python3
"""PreToolUse (Edit/Write/MultiEdit) kancası: kullanıcıya görünen koda ilk dokunuştan önce kabul testi var mı?

Kural (CLAUDE.md "Yazan ile sınayan ayrı", testler.md 1. adım): kullanıcıya görünen işte kabul testi koddan ÖNCE,
kodu görmeyen ayrı bir ajana yazdırılır. Kural yazılıydı ve bağlamdaydı, yine de kod önce yazıldı (gözlem 0027);
kabul_denetle.py yalnızca commit sırasına bakar, gerçek sırayı göremez. Bu kanca sırayı ilk dokunuşta denetler.

Görünen dosya (kabul_denetle.py GORUNUR: js/, css/, i18n/, worker/src/, tema.css, kökteki .html) düzenlenecekse ve
dal main değilse, şunlardan biri olmalı:
  - dalda (origin/main'den beri, commit'li ya da çalışma ağacında) test/kabul/ altında değişiklik;
  - daldaki bir commit iletisinde "Kabul-yok:";
  - <git-dir>/kabul-yok dosyası (davranışı değiştirmeyen iş; içinde gerekçe; commit'e "Kabul-yok: <gerekçe>" yine yazılır).
Yoksa düzenleme reddedilir. Git çözülemezse engel olmaz.
"""
import json
import os
import subprocess
import sys

GORUNUR = ("js/", "css/", "i18n/", "worker/src/")


def git(args, cwd):
    r = subprocess.run(["git"] + args, cwd=cwd, capture_output=True, text=True, timeout=8)
    return r.stdout.strip() if r.returncode == 0 else None


def gorunur(yol):
    return yol.startswith(GORUNUR) or yol == "tema.css" or ("/" not in yol and yol.endswith(".html"))


def main():
    try:
        veri = json.load(sys.stdin)
    except Exception:
        return 0
    yol = (veri.get("tool_input") or {}).get("file_path") or ""
    if not yol:
        return 0
    dizin = os.path.dirname(os.path.abspath(yol))
    while not os.path.isdir(dizin):
        dizin = os.path.dirname(dizin)
    kok = git(["rev-parse", "--show-toplevel"], dizin)
    if not kok or not os.path.exists(os.path.join(kok, "kabul_denetle.py")):
        return 0
    goreli = os.path.relpath(os.path.abspath(yol), kok)
    if not gorunur(goreli):
        return 0
    dal = git(["rev-parse", "--abbrev-ref", "HEAD"], kok)
    if dal in (None, "HEAD", "main", "master"):
        return 0
    taban = git(["merge-base", "origin/main", "HEAD"], kok)
    if not taban:
        return 0
    degisen = (git(["diff", "--name-only", taban, "--", "test/kabul/"], kok) or "") + \
        (git(["status", "--porcelain", "--untracked-files=all", "--", "test/kabul/"], kok) or "")
    if degisen.strip():
        return 0
    if "Kabul-yok:" in (git(["log", "--format=%B", taban + "..HEAD"], kok) or ""):
        return 0
    gitdir = git(["rev-parse", "--git-dir"], kok) or ""
    if os.path.exists(os.path.join(kok, gitdir, "kabul-yok")):
        return 0
    neden = (
        f"Durduruldu: {goreli} kullanıcıya görünen kod; bu dalda henüz kabul testi yok. Sıra: önce kodu görmeyen "
        "sınayan ajan test/kabul/<konu>.js'i yazar (testler.md 'Sınayan ajan istemi'), ayrı commit; sonra kod. "
        "Davranışı değiştirmeyen işse (yeniden yapılanma, yalnızca biçim) gerekçeyi "
        "`echo '<gerekçe>' > \"$(git rev-parse --git-dir)/kabul-yok\"` ile yaz ve commit iletisine "
        "'Kabul-yok: <gerekçe>' ekle."
    )
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": neden,
    }}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
