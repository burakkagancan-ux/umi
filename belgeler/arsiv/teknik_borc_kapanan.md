# Teknik borç: kapanan maddeler

TEKNIK_BORC.md'den taşındı (15.10.2026, U-07 9. adım; metin aynı, başlıklar ana dosyadakiyle aynı). Açık maddeler TEKNIK_BORC.md'de.

## 2. Worker'ın kayıt (log) tutmaması — KAPANDI (kodda log yok, observability kapalı, panelde Exports/Logpush tanımlı değil)
- `ocr.html` gizlilik notu "fotoğraf ve metin kaydedilmez" diyor. Worker kodunda `console.log` ile görüntü ya da metin yazılmadığı ve Workers Logs/Logpush'ın kapalı olduğu kontrol edilmeli.

## 3. Google Fonts
- ÇÖZÜLDÜ (04.10.2026): Yazı tipleri depoda (şimdi Bricolage Grotesque + Figtree; Schibsted kaldırıldı 04.10.2026) (fonts/, SIL OFL 1.1, @fontsource 5.3.0; latin + latin-ext, 400/600/800 woff2). Google'a istek gitmiyor; service worker önbelleğe alıyor (tagsis-v5).

## 4. Kozmetik verisi (data/kozmetik.json) — KAPANDI (07.10.2026)
- **Türkiye ekleri — KAPANDI:** Ek II–VI, Resmî Gazete'deki ek PDF'lerinden (2023 yönetmeliği ve 05.03.2024 değişikliği) yazı tanımayla okunup AB'nin 2.291 kaydıyla satır satır karşılaştırıldı (kaynak/TR_KOZMETIK_KARSILASTIRMA.md). Tek fark: AB Ek II 1394–1397 (boric oxide, borik asit, boratlar, sodyum perborat) Türkiye'de yasaklı listede yok; bu kayıtlarda `tr: farkli`, kartın (i) panelinde açıklanıyor. Sınır: yazı tanıma yüzde ve ürün tipi değerlerinin tek tek karşılaştırılmasına yetmiyor; karşılaştırma maddenin listede olup olmadığını kapsıyor.
- **Anlık görüntü yaşı — KAPANDI:** `cosing_al.py` artık Komisyon'un CosIng arama servisinden indiriyor (inhouse-work/cosing kopyası bırakıldı). Veri 28.04.2026'ya (2026/909) kadar güncel; 2026/78 ve 2026/909 ayrıca resmi metinden doğrulandı, numara çakışması CosIng'in konsolide numaralarıyla çözüldü (Ek II 1767; Ek III 381–386). 2025/877'nin eksik 7 CMR kaydı eklendi. CosIng'den çıkarılan 1.474 INCI adı `kaynak/cosing/ingredients_eski.csv`'de korunuyor (eski etiketlerde tanınsın diye).
  - Düzeltilen eski hatalar: CosIng'de aynı numarayı taşıyan iki kaydın biri kayboluyordu (ör. Ek III 269 BASIC RED 51); "Please consider entry 419…" gibi koşullu CosIng notları artık yasak sayılmıyor (MINERAL OIL, SQUALENE gibi yaygın adlar kırmızı olmuyor); gümüş çinko zeolit Ek V/61 ile koşullu izinli göründüğü için artık kırmızı değil.
- **Doğrulama — KAPANDI:** `kaynak/kozmetik_guncellemeler.tsv`'de `inceleme=1` satır kalmadı (2025/877 N,N-dimethyl-p-toluidine resmi metinle doğrulandı).
- **Otomatik güncelleme — KAPANDI:** `.github/workflows/cosing.yml` ayda bir (her ayın 1'i) CosIng'den indirir; değişiklik varsa testleri çalıştırıp PR açar. Yeni AB değişikliği gelirse güncelleme tablosuna Türkçe not ve Türkiye durumu elle eklenir.

## 5. Kozmetik K3 (kaynak/kozmetik_k3.tsv) — KAPANDI (07.10.2026)
- **Kaliforniya — KAPANDI:** Satırlar HSC §108980'in resmi metniyle (AB 60 ile değişik hali, yürürlük 01.01.2026; Kaliforniya Yasama Meclisi toplu veri dosyası) karşılaştırıldı. Eksikler eklendi: perborat ve boratların ek CAS'ları, musk ketone (yasak değil üst sınır; yeni sarı liste `ca_sinir`).
- **ASEAN — KAPANDI:** Mikonazol, Singapur HSA'nın yayımladığı resmi ASEAN ekleriyle (sürüm 2026-1, 22.06.2026) doğrulandı; aynı sürümde eklenen 4 mantar ilacı (bifonazol, klotrimazol, tiyabendazol, tiyokonazol) eklendi.
- **AB taslağı — KAPANDI:** `ab_taslak` satırları Komisyon'un Konsey'e 21.09.2026'da ilettiği resmi taslakla (D117774) doğrulandı; taslaktaki diğer maddeler (Basic Brown 16, Basic Blue 99, prostaglandin benzeri kirpik serumu maddeleri, cıvalı koruyucular, CBD sınırı) eklendi. Kabul edilince güncelleme tablosuna taşınmalı.
- **REACH D4/D5/D6 — KAPANDI:** (EU) 2024/1328 resmi metniyle doğrulandı; D6 tarihi düzeltildi (durulanan üründe de 6 Haziran 2027).

## ocr.html tek dosyada — KAPANDI (04.10.2026)
- ~1.550 satırlık ocr.html gıda, kozmetik, temizlik ve arayüz kodunu birlikte taşıyordu. Kod `js/` klasöründe alana göre 9 dosyaya bölündü (derleme adımı yok, davranış değişmedi; eski ve yeni sayfanın sonuç ekranları tarayıcıda birebir karşılaştırıldı). Arayüz testi KAPANDI (08.10.2026): test/arayuz.js CI'da ayrı işte Chromium ile çalışıyor.

## Veri kod dosyalarının içinde — KAPANDI (04.10.2026)
- Üreteçlerdeki (gen_e_kodlari.py 120 KB, gen_e_aciklama.py, gen_bilesenler.py, gen_temizlik.py, gen_kozmetik.py) gömülü veri `kaynak/` altındaki JSON/TSV dosyalarına taşındı: `e_kodlari_maddeler.json`, `e_kodlari_ek.json`, `e_aciklama.tsv`, `bilesenler.json`, `temizlik_ifadeler.tsv`, `temizlik_birlesik.tsv`, `temizlik_onlemler.tsv`, `temizlik_gruplar.json`, `kozmetik_listeler.json`, `kozmetik_islevler.tsv`, `kozmetik_tr_sozcukler.tsv`, `kozmetik_abd_renkler.tsv`. Üretilen data/*.json dosyaları birebir aynı kaldı.
- CI ("Testler") üreteçleri çalıştırıp data/ değişmiş mi diye bakar: kaynak dosya düzeltilip üreteç çalıştırılmazsa ya da JSON elle düzenlenirse hata verir.

## CosIng verisi depo dışında — KAPANDI (04.10.2026)
- gen_kozmetik.py artık `../cosing` kopyasına ihtiyaç duymaz; kullanılan kısım `kaynak/cosing/` altında (Ek II–VI aynen, INCI listesinden 3 sütun; ~3 MB, sürüm `surum.txt`, lisans `LICENSE.txt`). Yenilemek için `python3 cosing_al.py`. Verinin eski olması (2024 başı) ayrı sorun, bkz. 4.

## Temizlik: "Adı Yazılan Maddeler" bölümü (UX, 04.10.2026) — KAPANDI (05.10.2026; 5. madde 07.10.2026'da kullanıcı kararıyla listeden çıkarıldı)
Bölüm etikette adı yazan maddeleri gösteriyor (js/arayuz_temizlik.js, renderT): notu olanlar (MIT, BIT, hipoklorit…) kart, diğerleri düz liste. 05.10.2026: sonuç ekranı gıda/kozmetik düzenine getirildi: tek "Dikkat Gerektirenler" başlığı (karıştırma, kapsül, tehlike ifadeleri, madde notları kart olarak; madde notunun ilk iki cümlesi görünür), listeler kapalı açılır bölümlerde ("Önlem İfadeleri", "İçerik Grupları", "Tanınan Maddeler"; tüm tanınan maddeler, CosIng notu altta, ad ve "Koruyucu" çipi tekrarı yok).

Alt maddeler:
1. Başlık özetteki "Tanınan madde" satırıyla uyuşmuyor; "Tanınan Maddeler" olmalı. — KAPANDI
2. Madde kartlarında açıklama yalnızca (i) arkasında; tehlike kartlarındaki gibi bir satırlık açıklama görünmeli. — KAPANDI
3. Kartlar ve düz liste karışık; liste "Diğer maddeler (N)" adıyla kapalı açılır bölüme (secBox) girmeli. — KAPANDI
4. "İşlevler AB…" notu bölümün başında; listenin altına inmeli. — KAPANDI
6. İşlev adı tekrarı ("PARFUM · Koku, Parfüm") kaldırılmalı. — KAPANDI

## Paylaşım sayacı KV bağlaması — KAPANDI (06.10.2026)
- `paylasim-sayac` KV namespace'i Cloudflare panelinde oluşturuldu, ID `worker/wrangler.toml` içinde `SAYAC` olarak bağlandı. Dağıtımdan sonra /sayac sayım yapar (ürün, metin, IP saklanmaz).

### Gıda (E kodları)
- ÇÖZÜLDÜ (06.10.2026, 6. parti): 11 renkli madde (E123, E154, E160f, E216, E217, E230, E284, E285, E320, E924a, E952) resmi kaynakla elle yazıldı; e_kodlari kaynakları Wikipedia/ikincil siteler yerine EFSA, EUR-Lex, JECFA/IARC (inchem), FDA. Gerekçe düzeltmeleri: E154 (EFSA 2010, 1129/2011), E230 (2003/114/AT), E924a (IARC 1999), E952 ("1996" ve "1970" kaldırıldı; SCF 2000), E216/E217 (2006/52/AT; "doğrulanmalı" kalktı). Aynı partide koruyucular (E214, E215, E218, E219, E239, E242, E243, E261–E263, E1105), lezzet artırıcılar (E626–E635, E640, E650), tatlandırıcılar (E957, E959, E960, E961, E969).
  - KAPANDI (07.10.2026): E920 (L-sistein) AB kullanım koşulları (Ek II: unda quantum satis, bebek bisküvilerinde 1.000 mg/kg) ve şartnamesi (231/2012: insan saçı kaynak olarak kullanılamaz, başka hammadde belirtilmez) okundu; tarama gerekçesi kaynaklandı. Ansiklopedi sayfası "son 33 madde" işinde yazılacak.
  - KAPANDI (07.10.2026): E285 boraks (disodyum tetraborat susuz, dekahidrat, pentahidrat) CLP Repr. 1B H360FD sınıfı Tüzük 790/2009 Ek VI'da doğrulandı; kaynak eklendi.
  - KAPANDI (12.10.2026): California AB 418 kaynağı artık resmi metin (leginfo.legislature.ca.gov, enrolled metin 14.09.2023; kullanıcı indirdi). Dört madde (bromlu bitkisel yağ, potasyum bromat, propil paraben, Red dye 3) ve 01.01.2027 tarihi veriyle aynı; LegiScan bağlantıları (`ca_ab418`, E216/E217/E924a) değiştirildi. KAPANDI: eCFR, SCF (food.ec.europa.eu), ECHA ve FAO kaynakları resmi sayıldı (`resmi_alan_adlari`).
  - KAPANDI (07.10.2026): Yeşil maddelerin tarama ekranı gerekçeleri (E239, E242, E243, E261–E263, E626–E629, E640, E650) ansiklopedideki EFSA/JECFA kaynaklarıyla yeniden yazıldı (`kaynak/e_kodlari_ek.json` `dogrulama`). Paraben grubundaki (E214, E215, E218, E219) desteklenmeyen "endokrin etkileri tartışmalı" ifadesi ve `debated` bayrağı kaldırıldı; gerekçe EFSA 2004 grup ADI'sine dayanıyor.
- ÇÖZÜLDÜ (06.10.2026, 7. parti): 40 asitlik düzenleyici (E260–E524 arası). EFSA yeniden değerlendirmesi olanlar: tartaratlar E334–E337, E353, E354 (2020), klorürler E507–E509, E511 (2019), sülfatlar E513–E517 (2019), E512 (2018). Diğerleri JECFA + AB Ek II (çoğu Grup I, quantum satis) kaynaklı, kanıt düzeyi "sınırlı". AB 2024/1451 ile tartaratlar Grup I'den çıkıp üst sınırlı yeni gruba alındı (16.12.2024).
  - KAPANDI (07.10.2026, kullanıcı kararı): Ortak gerekçe (`DEFAULT_REASON`) "…bu uygulamada ayrıntılı bir değerlendirme yapılmadı." oldu; kurum değerlendirmesi yokmuş gibi okunmuyor.
  - KAPANDI (07.10.2026): E270 üretim kaynağı yürürlükten kalkan 2008/84/AT yerine AB 231/2012 şartnamesi; E353 üretim kaynağı EFSA 2020 görüşü (L(+)-tartarik asidin 150 °C üzerinde ısıtılması).
  - KAPANDI (07.10.2026): E355–E357 dolgu/kaplama (2.000 mg/kg) ve içecek tozu (10.000 mg/kg) kullanımları Ek II'den okunup ansiklopediye eklendi.
- ÇÖZÜLDÜ (06.10.2026, 8. parti): asitlik düzenleyiciler E525–E530, E574–E579, E585; kıvam artırıcılar E405, E406, E413, E416–E418, E425–E427, E441, E1204; gazlar E290, E938, E939, E941–E944, E948, E949; dengeleyiciler E444, E445, E459, E999, E1201, E1202.
  - KAPANDI (07.10.2026, kullanıcı kararı): E459 (beta-siklodekstrin) K6 ölçütüyle sarıya geçti (EFSA 2016: markaya bağlı tüketim senaryosunda ADI aşımı), E407/E968 ile aynı.
  - KAPANDI (07.10.2026): E425 (konjak) tarama gerekçesine EFSA 2017 günde 3 g koşulu ve AB 2003/52/AT jöleli şekerleme yasağı yazıldı. Risk rengi yeşil kaldı (K1–K7 ölçütlerinden hiçbirine girmiyor).
  - KAPANDI (07.10.2026): E579/E585 kategorisi "Stabilizatör / dolgu" oldu (AB 1333/2008 Ek I: rengi koruyan maddeler stabilizatör sayılır).
  - KAPANDI (07.10.2026): E441 (jelatin) için AB 1333/2008 Madde 3 ve 853/2004 Ek III kaynakları e_kodlari.json'a eklendi.
- ÇÖZÜLDÜ (07.10.2026, 9. parti, son): 32 madde elle yazıldı (E101, E160d, E162, E172, E385, E431, E535, E536, E538, E551, E552, E553a, E553b, E558, E901–E907, E912, E914, E920, E927b, E1103, E1200, E1205, E1505, E1517–E1519, E1521). Kaynaklar: EFSA görüşleri (özetler OpenAlex/Europe PMC üzerinden; efsa.europa.eu ve Wiley bu ortamdan 403), JECFA (INCHEM), AB 1333/2008 Ek II–III (31.12.2020 metni).
  - KAPANDI (08.10.2026): E1203 sayfası AB konsolide metni (18.08.2026; yalnızca takviye kapsül/tabletleri, 18.000 mg/kg) ve JECFA şartnamesiyle yazıldı. EFSA 2006 görüşünün yalnızca varlığı belirtildi, sonucu okunamadığı için aktarılmadı.
  - KAPANDI (08.10.2026, kullanıcı kararı): E553b (talk) IARC 2025 Grup 2A (Monografi 136) nedeniyle K4 ile sarı.
  - KAPANDI (08.10.2026): E431 güncel konsolide metinde (18.08.2026) de Bölüm B'de var, hiçbir gıda kategorisinde kullanım koşulu yok; sayfaya yazıldı.
  - KAPANDI (08.10.2026): E101, E162, E172 sayfalarına Grup II (quantum satis) kullanımları konsolide metinden eklendi.
- ÇÖZÜLDÜ (08.10.2026): **Günlük sınır (ADI) doğrulaması** (`kaynak/e_adi.tsv`). Bilgiye dayalı 43 değerin hepsi kaynakla doğrulandı (102/102). Kaynaklar: EFSA görüş özetleri (DOAJ, Europe PMC, kurumsal arşiv kopyası: E127, E129), EFSA yem katkısı görüşlerinin tam metninde ANS Panel değerini aktaran cümle (E102, E110, E120, E124, E131, E132, E142), SCF 2000 (E952), JECFA veri tabanı (polioller). Düzeltmeler: E280–E283 `ns` (gerek görülmedi) değil `yok` (EFSA 2014: veri sınır belirlemeye yetmedi); E203 EFSA 2015'te sorbat grup sınırından çıkarıldı (ayrı satır, `yok`); E319 kurumu "JECFA 1998, EFSA 2004"; polioller SCF/EFSA yerine JECFA (aynı sonuç: belirlenmedi). Not: E102 için JECFA 2016'da sınırı 10 mg/kg'a çıkardı; uygulama AB değerini (7,5) gösteriyor.

## Kozmetik: PFAS işareti AB kaydının tüm INCI adlarına geçiyor (08.10.2026) — KAPANDI (09.10.2026)
- KAPANDI (09.10.2026, PR #105): Bayrak artık ad düzeyinde (kayıtta `pfas_inci`; INCI listesindeki adlar kozmetik_inci.json'dan). Etkilenen florsuz ad sayısı 2 değil 282'ydi (III/61 etanolaminler, III/62 alkilaminler). test/kozmetik_cases.js denetler.
  Eski not: gen_kozmetik.py kayıt düzeyinde `pfas` bayrağını, kaydın INCI listesindeki herhangi bir ad PFAS_RE'ye uyarsa kaydın tüm adlarına veriyor. Bu yüzden florsuz DIBEHENYL METHYLAMINE ve AMP-ACRYLATES/DIACETONEACRYLAMIDE COPOLYMER sonuç ekranında ve paylaşım kartında "PFAS" görünüyor. Bayrak ad düzeyinde (yalnızca PFAS_RE'ye uyan ada) verilmeli; hangi kayıtların etkilendiği sayılmadı.

### Çevrilmemiş veri metinleri — KAPANDI (12.10.2026, PR #105)
- Uzun veri metinlerinin hepsi (1.172: gerekçe, üretim yolu, açıklama, TR notu, bileşen notu, birlikte dikkat, kozmetik ve K3 notları, temizlik notları) `kaynak/ceviri_en_veri.tsv`'de; ansiklopedinin 4.043 metninin hepsi `kaynak/ansiklopedi_en.json`'da (her çeviri çevrildiği Türkçeyi `tr` olarak taşır; Türkçe değişirse çeviri bayat sayılır ve yazılmaz, metin Türkçe + "not yet translated" görünür). Çeviri i18n/sozluk.md terimleriyle yapıldı; sayı, Türkçe kalıntı ve "safe/harmless" denetimi geçti (geçen "safe" kelimelerinin hepsi Türkçede "güvenli" diye kurumdan aktarılan cümleler).
- KAPANDI (12.10.2026): Çeviride görülen iki kaynak hatası düzeltildi: E151 "Vücutta" metni artık resmi adla (parlak siyah BN / brilliant black BN; "Black PN" eş adı ve JECFA monografı başlığı olarak kalır), E1517 üretim yolu "gliserolün asetik asitle esterleştirilmesi" (eski metin "sitrik asit ya da gliserol" diyordu; kayıt `dogrulandi=0` kaldı, yöntem kaynakla doğrulanmadı). Arayüz sayfaları aşağıda.
- Yeni Türkçe metin eklenince İngilizcesi aynı PR'da eklenir (O-09).
- 13.10.2026 (O-25): `kaynak/ceviri_en_veri.tsv`'de de her çeviri çevrildiği Türkçeyi taşıyor (3. sütun); Türkçe değişince gen_ceviri_veri.py çeviriyi yazmaz ve BAYAT diye listeler. Türkçe metni düzelten PR İngilizcesini ve 3. sütunu da günceller. Kısa etiketler (kaynak/ceviri_en.tsv: madde adı, alerjen, işlev) bu denetimde değil; çoğu "metin:<Türkçe>" anahtarlı (Türkçe değişince kendiliğinden düşer) ya da resmi ad.
