# tagsis — Proje dokümanı

Terminalden (Claude Code CLI) devam etmek için tek sayfalık özet. Son güncelleme: 07.10.2026.
Ayrıntılar: [CLAUDE.md](CLAUDE.md) (kararlar, veri, mimari), [YOL_HARITASI.md](YOL_HARITASI.md) (küresel iş planı), [TEKNIK_BORC.md](TEKNIK_BORC.md) (ertelenen işler).

## 1. Proje özeti

Gıda, kozmetik ve temizlik ürünlerinin etiketindeki içerik listesini fotoğraftan okuyup analiz eden, ayrıca Tarım ve Orman Bakanlığı taklit/tağşiş listesini gösteren PWA.

- Site: https://burakkagancan-ux.github.io/tagsis/ (GitHub Pages, `main` dalından)
- Depo: https://github.com/burakkagancan-ux/tagsis
- Sayfalar: Liste (`index.html`), Etiket Oku (`ocr.html`; Gıda / Kozmetik / Temizlik modu), Ansiklopedi (`ansiklopedi.html`), Profilim.
- OCR: `ocr.html` → Cloudflare Worker (`worker/`) → Google Cloud Vision; Worker'a ulaşılamazsa Tesseract.js.
- Gelir modeli henüz seçilmedi (YOL_HARITASI.md D-01).

## 2. Ürün kuralları (değişmez)

- **Skor yok.** 0–100 puan planı bırakıldı. Sonuç: madde başına risk seviyesi (yeşil / sarı / kırmızı), alerjen ve profil uyarıları.
- **Kırmızı yalnızca kişisel uyarıda** (profil kartı). Genel "uyarı" koyu turuncu + ünlem.
- Uygulama asla "güvenli/uygun" demez; "bulunamadı, bu bir onay değildir" der. "Zararlı" her zaman kaynağa (yönetmelik, tarih) bağlanır.
- **Sponsorlu içerik etiketlidir, sonucu asla etkilemez.**
- Bakanlık verisi değiştirilmez; marka eşleşmesi suçlama değil, nötr bağlantı.
- Okunan metin yalnızca cihazda saklanır.
- Her yeni uyarı/kural resmi kaynağa dayanır; dil olasılık bildirir ("oluşabilir", "bildirilmiştir").

## 3. Mimari ve dosya yapısı

Düz HTML/JS, derleme adımı yok.

| Yol | İçerik |
| --- | --- |
| `index.html`, `ocr.html`, `ansiklopedi.html` | Sayfalar |
| `js/` | Saf mantık: `ortak.js`, `gida.js`, `kozmetik.js`, `temizlik.js`, `eslesme.js`, `karsilastir.js`, `paylas.js`, `ansiklopedi.js`. Arayüz: `arayuz*.js` (sıra önemli, `arayuz_sayfa.js` en son) |
| `kaynak/` | Elle yazılan kaynak veri (JSON/TSV). Düzenleme burada yapılır |
| `gen_*.py` | `kaynak/` → `data/` üreteçleri (yalnızca mantık) |
| `data/` | Üretilmiş JSON (uygulama bunu okur; elle düzenlenmez) |
| `worker/` | Cloudflare Worker (OCR + paylaşım sayacı KV). `main`'den otomatik dağıtılır |
| `test/` | Testler (CI: `.github/workflows/test.yml`) |
| `fetch_data*.py`, `dogrula_veri.py` | Bakanlık verisi; `.github/workflows/update.yml` her gün 05:00 UTC |
| `sw.js`, `manifest.webmanifest`, `tema.css`, `fonts/` | PWA, ortak görünüm, yerel yazı tipleri |

Yeni `js/` dosyası eklenirse: `ocr.html` script sırası, `sw.js` `CORE` listesi + `CACHE` sürümü, gerekirse `test/yukle.js`.

## 4. Çalıştırma ve test

```bash
# Yerelde aç
python3 -m http.server 8765      # sonra http://localhost:8765/

# Veri üret (sıra önemli; veri değiştiren PR üretilen data/ dosyalarını da içermeli)
python3 gen_e_kodlari.py && python3 gen_bilesenler.py && python3 gen_e_aciklama.py \
  && python3 gen_kozmetik.py && python3 gen_eslesmeler.py && python3 gen_temizlik.py \
  && python3 gen_ansiklopedi.py

# Tüm testler (CI ile aynı)
for t in sozdizimi cases e_dogrulama sodyum kanser eslesme uretim ocr_tolerans \
         kozmetik_veri kozmetik_cases kozmetik_k3 temizlik karsilastir ansiklopedi paylas; do
  node test/$t.js || break; done
python3 test/dogrula_veri.py && node worker/test.mjs
```

CI ayrıca üreteçleri çalıştırıp `data/` değişmiş mi bakar. Tarayıcı testi: Playwright + yerel sunucu (bkz. CLAUDE.md "Testler").

## 5. Çalışma kuralları

- Dil Türkçe, yanıtlar kısa. BKC kod yazmaz (iş mimarı); telefon testlerini BKC yapar. Neyin test edildiği/edilmediği her seferinde söylenir.
- Değişiklik `claude/...` dalında, PR ile. BKC GitHub'da "Merge pull request" der.
- Bir iş = bir konu. PR birleşince yeni iş güncel `main`'den başlar.
- Büyük özellik: önce kısa plan, onaydan sonra kod.
- Model seçimi: küçük arayüz/metin/veri → Sonnet; yapısal, araştırma, veri doğruluğu, riskli → en güçlü model.

## 6. Mevcut durum (07.10.2026)

Birleşen son PR'lar (#49–#68):

- #49–#53 Karşılaştırma (karar mantığı, düğme, ekran)
- #54 "alkol ve domuz içermez" düzeltmesi · #55 Paylaşılabilir sonuç kartı · #56 Üretim yolu etiketi
- #57 README · #58 E1422 çift kart · #59 Günlük veri güncellemesi önce doğrulanır
- #60, #63 TEKNIK_BORC eklemeleri · #61 Ansiklopedi +40 madde · #62 Üretim yolu: 176/333 kaynaklı
- #64 E311/E312/E483 artık "AB'de izni kaldırıldı" · #65 Paylaşım sayacı KV bağlandı
- #66 Ansiklopedi 6. parti (39 madde) · #67 Uyarısız katkı kartları nötr görünüm · #68 Ansiklopedi 7. parti (40 madde)

Google Cloud Vision dakikalık kotası düşürüldü (tamam).

**Açık: Ansiklopedi kaynaklandırma**

- **PR #69** (8. parti, 40 madde): CI yeşil, merge bekliyor. Merge sonrası otomatik sayfa 73 → 33.
- 2 karar verildi (07.10.2026, ikisine de evet; uygulandı):
  1. Yeşil maddelerdeki "ayrıntılı bir değerlendirme yapılmamıştır" cümlesi "bu uygulamada ayrıntılı değerlendirme yapılmadı" olsun mu? (`gen_e_kodlari.py` `DEFAULT_REASON`)
  2. E459 (beta-siklodekstrin) EFSA 2016'ya göre ADI aşılabildiği için sarıya geçsin mi? (E407 ve E968 aynı ölçütle sarı.)
- Kalan **33 madde** (4. ve son grup): #69 birleşince başlanır. E101, E160d, E162, E172, E920 gibi kaynağı okunamayanlar otomatik kalabilir, nedeni kayda yazılır.

## 7. Açık teknik borç (birleşik liste)

"Teknik borç taraması" dizisindeki birleşik listenin güncel hâli. Kapananlar: E311/E312/E483 (#64), paylaşım sayacı KV (#65), Vision kotası.

**Yüksek**
1. **Kozmetik verisi eski:** CosIng 2024 başı. 2026/78 (15 CMR) ve 2026/909 eksik; `inceleme=1` satırları EUR-Lex'le doğrulanmadı; `tr` alanı 1.942 kayıtta boş. Aylık mevzuat izleme buna bağlı.
2. ~~Tesseract CDN~~ — KAPANDI (07.10.2026): tesseract.js@5.1.1 sabitlendi, SRI (sha384) eklendi.
3. **"Vücutta ne olur?" → "Olası etkiler":** yapılandırılmış belirti listesi önerisi hazır (TEKNIK_BORC.md); önce kısa plan.

**Orta**
4. Paylaşım kartı ve karşılaştırma revizesi: BKC'nin ayrıntısını bekliyor (karşılaştırma 08.10.2026'da kozmetik ve temizliğe genişletildi).
5. Ansiklopedi: 333 sayfanın hepsi elle yazıldı (08.10.2026). Kalan: eski kayıtların güncel AB konsolide metniyle karşılaştırılması, TGK 2023.
6. Üretim yolu: 157 E kodu kaynakla doğrulanmadı.
7. Kozmetik (~200–300 madde) ve temizlik (~30 madde) ansiklopedisi yok.
8. ~~Arayüzün otomatik testi yok~~ — KAPANDI (08.10.2026): test/arayuz.js, CI "arayuz" işi.

**Düşük**
10. Kaynak denetimleri: FDA renk tablosu ve eş anlamlılar, Kaliforniya listesi (resmi site), EUH ve P ifadelerinin Türkçesi.
11. ~~Kozmetik ve temizlik verisi çevrimdışı önbelleğe alınmıyor~~ — KAPANDI (08.10.2026): sw.js CORE, tagsis-v24.
12. Helal ("kaynağı belirsiz, sertifikaya bakın"), besin değeri tablosu.
13. Hukuki görüş (KVKK / Google Vision, "zararlı" dili, arşiv gösterimi): en son.

## 8. Sıradaki adımlar

1. BKC: —
2. ~~Ansiklopedi son 33 madde~~ (07.10.2026: 32 madde yazıldı, E1203 otomatik kaldı).
3. Kozmetik verisi güncellemesi (2026/78, 2026/909) — veri doğruluğu, en güçlü model.
4. ~~Tesseract CDN sürüm sabitleme + SRI~~ (yapıldı).
5. "Olası etkiler" için kısa plan → onay → kod.
6. Telefon testleri (BKC) ve sonuçlara göre ayar; sonra besin tablosu, aylık mevzuat izleme, hukuki görüş.

## 9. Terminalden başlamak

```bash
git clone https://github.com/burakkagancan-ux/tagsis && cd tagsis
claude
```

Claude Code `CLAUDE.md`'yi kendiliğinden okur. İlk mesaj önerisi:

> PROJE.md ve TEKNIK_BORC.md'yi oku. Sıradaki adımlardan 2. maddeyle devam et.
