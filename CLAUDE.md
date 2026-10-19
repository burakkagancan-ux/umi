# Proje notları (Claude için)

Bu dosya her oturumda kendiliğinden okunur; kısa tutulur (15.10.2026'dan beri çekirdek + konu dosyaları). Ayrıntı `belgeler/mimari/` altında, yalnızca o alana dokunulunca okunur. Bilgi silinmez: taşınır.

## Oturum başında okuma (en az bağlam, eksiksiz bilgi)
- Her zaman: bu dosya. Başka hiçbir belge oturum başında bütünüyle okunmaz.
- Bir işe başlarken: işin dokunduğu alanın konu dosyası (aşağıdaki dizin) bütünüyle; birden çok alana dokunuyorsa her biri. Konu dosyası okunmadan o alanda kural değiştirilmez ya da "yok" denmez.
- İş seçerken / "ne kaldı": YOL_HARITASI.md §4 (önerilen sıra) ve §6 (kullanıcı kararları); ayrıntı için ilgili iş kimliği `grep` ile (ör. `grep -n "A-02" YOL_HARITASI.md`). TEKNIK_BORC.md yalnızca açık maddeleri taşır; kapananlar belgeler/arsiv/.
- Bir şeyin nerede yazdığı bilinmiyorsa: `grep -rn "<terim>" CLAUDE.md belgeler/ YOL_HARITASI.md TEKNIK_BORC.md` (arşiv dahil). Tahminle yazılmaz.
- Kod okurken: önce dosyanın başındaki açıklama ve ilgili işlev (`grep -n "^function ad\|^export function ad"`); büyük dosya baştan sona okunmaz.

## Belgeyi güncelleme
- İş bitince değişen davranış ilgili konu dosyasına yazılır (aynı PR). Bu dosya yalnızca kural, dizin, dosya haritası ya da komut değişince güncellenir.
- "Son güncelleme" satırı tutulmaz: ne zaman ne değiştiği `git log -p <dosya>`'da. (Her PR'ın aynı satırı değiştirmesi birleştirme çakışması ve gereksiz okuma demekti.)
- Kapanan teknik borç maddesi belgeler/arsiv/teknik_borc_kapanan.md'ye, biten yol haritası satırı belgeler/arsiv/yol_haritasi_biten.md'ye taşınır (silinmez).
- Yeni konu doğarsa yeni konu dosyası açılır ve aşağıdaki dizine bir satır eklenir.

## Konu dizini
| Dosya | İçerik (ne zaman okunur) |
|---|---|
| [Ürün ve veri kaynakları](belgeler/mimari/urun.md) | gıda, kozmetik, temizlik verisi; K3 listeleri, ADI, üretim yolu, birlikte dikkat, ansiklopedi, görünüm, Bakanlık verisi, OCR |
| [Veri üretimi](belgeler/mimari/veri_uretimi.md) | kaynak/ altındaki TSV/JSON, gen_*.py, uret.py, sw.js üretimi, İngilizce eş anlamlılar |
| [Etiket Oku (ocr.html) ve sonuç ekranı](belgeler/mimari/etiket_oku.md) | arayüz dosyaları, modül yapısı, cihaz deposu, profil kartları, analiz kuralları (olumsuzluk, benzer yazım, İngilizce metin), değerlendirme modeli, karşılaştırma, kayıtlı ürünler, paylaşım kartı |
| [Çok dil](belgeler/mimari/cok_dil.md) | çeviri anahtarları, veri çevirisi, bayat çeviri, yeni dil ekleme, manifest, sağdan sola |
| [Rozetler, Eklediklerim, Topluluk](belgeler/mimari/rozet_topluluk.md) | G-01, G-02, G-04 |
| [Barkod ve Worker](belgeler/mimari/barkod_worker.md) | barkod akışı, OFF verisi, katkı, D1, Worker uç noktaları ve korumaları, yönetim sayfası |
| [Besin değeri tablosu](belgeler/mimari/besin.md) | A-02: ayrıştırıcı, denetim, eşikler, porsiyon, ölçüm, topluluk tablosu |
| [Testler](belgeler/mimari/testler.md) | test komutları ve her testin denetledikleri, altın çıktı, tarayıcı testi, CI |
| [Kararlar, sınırlamalar, gelişim alanları](belgeler/mimari/kararlar.md) | kullanıcı kararları (tam metin), bilinen sınırlamalar, eş anlamlı ölçümü, gelişim alanları, araştırma belgeleri |
| YOL_HARITASI.md | iş planı: fazlar, iş kimlikleri, sıra (§4), kararlar (§6), öngörülen engeller (§9) |
| TEKNIK_BORC.md | açık teknik borç; kapananlar belgeler/arsiv/teknik_borc_kapanan.md |
| i18n/sozluk.md | terim sözlüğü ve başlık yazımı (arayüz metni yazarken) |

## Dosya haritası
- Sayfalar: ocr.html (Etiket Oku), ansiklopedi.html, index.html (Liste). Stil: fonts/ansiklopedi.css → tema.css → css/<sayfa>.css.
- js/ saf mantık (ES modülü, testli): ceviri, ortak, gida, kozmetik, temizlik, eslesme, degerlendirme (ortak ürün modeli), profil_kart, karsilastir(_ayar), paylas(_ayar), kayit, besin, barkod, rozet, topluluk, ansiklopedi, olcum. Sayfa girişleri giris_*.js + kopru.js.
- js/ arayüz (klasik betik, `defer`, sayfadaki sırayla; yalnızca depo.js ve tema.js <head>'de defer'siz): depo.js (cihaz deposu, ilk), tema.js (açık/koyu), veri_surum.js, dil.js, yukari.js, alt_menu.js, hareket.js (küçük hareket detayları), arayuz_ortak/profil/sonuc.js, arayuz_<alan>.js.
- worker/: Cloudflare Worker (OCR, barkod, D1, yönetim); ortak hesapları js/'ten içe aktarır.
- kaynak/: elle yazılan veri (TSV/JSON) → gen_*.py → data/ (üretilir, elle düzenlenmez). sw.js'in CORE/CACHE'i gen_sw.py ile üretilir. kaynak/simge/: uygulama simgesinin SVG kaynağı (gen_simge.js).
- test/: birim testleri, test/arayuz/ (tarayıcı grupları), test/kabul/ (kabul testleri; kodu görmeyen ajan yazar), test/veri/ (etiket setleri, altın çıktı).

## Komutlar
- `python3 uret.py`: bütün veri üreteçleri + sw.js (veri ya da kod değişince; CI `--denetle` ile denetler).
- `node test/hepsi.js [süzgeç]`: bütün birim testleri (~2 sn). `node test/altin.js`: davranış birebir aynı mı (bilerek değişince `--guncelle`, PR'da nedeniyle).
- `node test/arayuz.js [grup]`: tarayıcı testi (~11 sn; Playwright 1.47.2).
- `node gen_simge.js`: uygulama simgeleri (kaynak/simge/*.svg → kökteki PNG'ler; simge değişince, ardından `python3 uret.py`).
- `node test/arayuz.js kabul`: yalnızca kabul testleri. `python3 kabul_denetle.py origin/main`: PR'daki commit'ler yazan/sınayan ayrımına uyuyor mu (CI).
- Ölçümler (CI'da değil): `node test/olcum_mutasyon.js <dosya>` (testler hata yakalıyor mu), `node test/olcum_besin.js`, `node test/olcum_ingilizce.js`, `node test/olcum_turkce.js`.

## Roller ve dil
- Kullanıcı (BKC) iş mimarı, kod yazmıyor. Claude yazılımcı. Dil: Türkçe.
- Neyin test edildiği / edilemediği her seferinde açıkça söylenir. Telefon testlerini kullanıcı yapar.
- **Yazan ile sınayan ayrı (20.10.2026, kullanıcı kararı):** kullanıcıya görünen ya da Worker davranışını değiştiren her işte kabul testini kodu görmeyen ayrı bir ajan koddan önce yazar (test/kabul/), PR'dan önce ayrı bir ajan (Reality Checker) değişikliği kırmaya çalışır, bulduğu her hata gerileme testine döner. Kodu yazan kabul testine dokunmaz. Süreç, ajan istemi ve CI kuralları (kabul_denetle.py): belgeler/mimari/testler.md "Yazan ile sınayanın ayrımı".
- Test ile commit/push/PR aynı zincirde çalıştırılmaz (`test | tail && git commit` hatayı gizler; zorunluysa `set -o pipefail`); PR'daki test sayıları çalıştırma çıktısından alınır. Test yazma kuralları: belgeler/mimari/testler.md.
- Değişiklikler `claude/...` dalında yapılır, PR açılır; kullanıcı GitHub'da "Merge pull request" der.
- Kullanıcıya "birleştirin" denmiş bir PR'a yeni iş eklenmez: yeni istek güncel main'den açılan yeni dala ve yeni PR'a gider (kullanıcı o arada birleştirmiş olabilir). İstisnada itmeden önce ve sonra `gh pr view <no> --json state` bakılır; MERGED ise commit'in main'de olup olmadığı `git merge-base --is-ancestor <commit> origin/main` ile denetlenir.

## Vizyon ve ilkeler (kullanıcı kararı, 08.10.2026)
- Amaç: para kazanan, küresel bir uygulama (hedef onlarca dil, olası 60). Türkiye ilk pazar, son değil.
- Değişmez ilke: her bilgi kaynağa dayalı, tarafsız ve bilimsel. Gelir bu ilkeyi bozamaz: markadan para, reklam, ücretli sıralama yok; güvenlik uyarıları hiçbir zaman ücretli katmana konmaz.
- İş planı: **YOL_HARITASI.md** (fazlar, iş paketleri, sıra, kullanıcı kararları, riskler). İş seçerken §4 (sıra) ve ilgili iş satırı okunur (bütün dosya değil; bkz. Oturum başında okuma); iş başlayınca/bitince aynı PR'da durumu güncellenir. Her PR açıklamasında oradaki 5 maddelik ilke denetimi yanıtlanır.
- **Ölçek ve öngörü kuralı (kullanıcı, 09.10.2026):** Bugün bir saatte yapılabilecek işin ileride günler süren düzeltmeye dönüşmesine izin verilmez. Her iş planlanırken ve her PR'da "10 kat kullanıcı, 60 dil, 20 ülke ya da mağaza sürümü gelince bu yeniden yapılmak zorunda kalır mı?" sorusu sorulur; ucuz önlem o PR'da yapılır, yapılamıyorsa YOL_HARITASI.md §9'a kimlikli (O-xx) iş olarak yazılır. §9 her büyük adımda yeniden gözden geçirilir.
- Teknik sonucu: yeni kod ve veri baştan çok dilli ve çok ülkeli düşünülür (metinler çeviri anahtarıyla, maddeler evrensel kimlikle: E kodu, INCI, CAS, H/EUH kodu; mevzuat ülke katmanı olarak). Yeni Türkçe sabit metin eklemeden önce çeviri anahtarı düşünülür.

## Değişmez kararlar (tam metin ve diğer kararlar: belgeler/mimari/kararlar.md)
- Uygulama asla "güvenli/uygun" demez; "bulunamadı, bu bir onay değildir" der. "Zararlı" ifadesi her zaman kaynağa (yönetmelik, tarih) bağlanır.
- Bakanlık verisi değiştirilmez. Marka eşleşmesi suçlama değil, nötr bağlantı.
- Skor yok; dil olasılık bildirir ("yol açabilir / bildirilmiştir"); renk hiçbir zaman tek başına değil.
- Lisans: depo "tüm hakları saklıdır"; üçüncü taraf verisinin kaynağı ve lisansı dosya başına ve LICENSE'a yazılır.

## Sıradaki işler
- Ana plan YOL_HARITASI.md'de (08.10.2026'dan beri). Eski liste oraya taşındı: telefon testleri A-01, besin değeri tablosu A-02, helal A-05, aylık mevzuat izleme A-06, hukuki görüş E-05, barkod C-05, temizlik ikinci sürüm U-03/U-06.
