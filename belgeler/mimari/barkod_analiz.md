# Barkod sorgulama: derin analiz ve gelecek planı (22.10.2026)

Kullanıcının yapıştırdığı genel "barkod sorgulama arka ucu" istemi (şelale: GS1 ülke öneki → önbellek → Open Food Facts → ticari API (Go-UPC / Barcode Lookup) → GS1 kaydı) Umi'nin bugünkü barkod mimarisiyle karşılaştırıldı. Analiz şu açılardan yapıldı: veri mimarisi, arka uç, ön yüz, yasal durum, ölçek, ölçüm, ilkeler. Buradan doğan işler YOL_HARITASI.md'de C-10–C-17 ve O-28–O-32 olarak yazılı. Bu dosya o işlerin gerekçesidir; iş başlarken önce belgeler/mimari/barkod_worker.md (bugünkü davranış), sonra bu dosya okunur.

## 1. Özet

- İstemdeki şelalenin çoğu Umi'de zaten var, hem de istemden daha iyi biçimde: kontrol hanesi, UPC-E açılımı, 13 haneli anahtar, OFF + Open Beauty Facts + Open Products Facts paralel sorgusu, uygulamaya gömülü Türkiye anlık kopyası, bulunamayan sonucun önbelleği, IP'nin üçüncü tarafa gitmemesi, topluluk katkısı ve iki kişiyle doğrulama, yönetim ve geri alma.
- **Umi'nin ihtiyacı istemdekinden farklı.** İstem ürünün adını, markasını ve görselini arıyor. Umi'nin değeri içerik listesi ve besin tablosu, çünkü analiz bunlardan yapılıyor. Ticari API'ler (Go-UPC, Barcode Lookup) çoğunlukla ad, marka ve görsel verir, içerik listesi nadiren verir. Yani istemin 4. adımı Umi'ye ancak ürünün adını kazandırır, bunun da maliyeti ve kullanım şartı yükü var. **Öneri: ticari API şimdi eklenmez.** Önce ölçülür (C-15). Eklenirse yalnızca ad için ve önbellek süresi sözleşmeye bağlı olarak eklenir.
- **GS1 öneki ürünün menşei değildir.** 868/869, firmanın barkodunu GS1 Türkiye'den aldığını gösterir. Umi'de "Menşei" diye gösterilirse "kaynağa dayalı" ilkesine aykırı yanlış bilgi olur. Gösterilecekse "Barkod kaydı: GS1 Türkiye" ifadesi kullanılır, açıklaması da yanında verilir (C-11).
- Bugünkü düzen Türkiye için doğru, ama küresel hedefte (60 dil, 20 ülke, 10 kat kullanıcı) **üç yer kırılır**:
  - uygulamaya gömülü tek parça OFF dosyası,
  - Worker'ın yalnızca bir veri merkezinde ve geçici tutulan OFF önbelleği,
  - mağaza uygulaması gelince sürümsüz API.

  Üçü de bugün ucuz, sonra pahalı (O-28–O-30).
- **Bugünkü en büyük risk:** OFF'un hız sınırı IP başına dakikada 15 ürün sorgusu. Worker bütün kullanıcılar adına az sayıda IP'den sorduğu için bu sınır ilk duyuruda aşılır ve canlı OFF sorgusu herkes için düşer (O-29, 🔴, §3.3).
- **Katkıların lisansı yazılı değil.** Katkı veritabanı satılabilir tek varlık, ama katkı verenle yazılı bir koşul yok (O-32, 🔴, §5.6).
- **Bugünkü somut hata:** 20–29 (ve 02, 04) ile başlayan mağaza içi tartılı ürün barkodları her mağazada başka ürünü gösterir. Bugün bunlar OFF'a soruluyor, "aranan" listesine giriyor ve katkı kabul ediyor. Bir markette eklenen içerik başka marketin aynı barkodlu peynirine çıkabilir. Bu sorunu C-10 düzeltir ve önceliklidir.

## 2. Bugünkü durum (kısa; ayrıntı barkod_worker.md)

| İstemdeki adım | Umi'de | Not |
|---|---|---|
| 1. Çevrimdışı ülke öneki | Yok | Kontrol hanesi ve biçim var; önek tablosu yok |
| 2. Önbellek | Var | Uygulamada data/barkod_off.json (2.879 TR ürünü, 528 KB, ayda bir yenilenir) + Worker Cache API (1 gün; bulunamayan 6 saat) + tarayıcı önbelleği |
| 3. Open Food Facts | Var | Üç veritabanı paralel, 3 sn zaman aşımı, User-Agent yazılı |
| 4. Ticari API | Yok | Bilinçli; bkz. §5 |
| 5. GS1 kaydı / son çare | Kendi yöntemimiz | Bulunamazsa "İçerik listesini fotoğrafla" + katkı + iki kişiyle doğrulama |
| Arama sırası | — | D1 doğrulanmış → gömülü OFF → canlı OFF → D1 doğrulanmamış (barkodSec) |

İstemde olmayıp Umi'de olanlar:
- IP'nin üçüncü tarafa gitmemesi
- katkıcı kimliği ve ağ izi
- yönetim sayfası ve geri alma
- ölçüm
- topluluk listesi
- dil sırası (seçili dil → tr → en)

## 3. Veri mimarisi

### 3.1 Anahtar
- **Anahtar 13 hane (`barkodNorm`) ve doğru.** UPC-A önüne 0 alır, UPC-E açılır, EAN-8 olduğu gibi kalır. GTIN-14 (koli, ITF-14) tüketici taramasında çıkmaz, gerek yok.
- **Eksik: önekin türü.** 20–29, 02 ve 04 kısıtlı dağıtımdır: mağaza içi kod ya da fiyatı ve ağırlığı gömülü tartılı ürün. 978–979 ISBN'dir, 977 ISSN, 98–99 kupon. Bu barkodlar gıda veritabanında aranmaz, katkı almaz, aranan listesine girmez (C-10). Tablo küçük ve durağan: kaynak/gs1_onek.tsv + gen_*.py. Ayrıntılı ülke tablosu C-11'de aynı dosyaya eklenir.

### 3.2 Kaynakların ayrılığı (lisans sınırı)
- **Bugün doğru kurulu:** OFF verisi (ODbL) ile kullanıcı katkısı (D1) ayrı tutuluyor, birleştirilmiyor. Bu, kendi veritabanımızın lisansını serbest bırakıyor ve D-04 (B2B veri lisansı) için tek satılabilir varlık bu ayrım.
- **Kural yazılı değil, yalnızca uygulanıyor.** Bir sonraki geliştirici "OFF verisini D1'e yazıp tek sorgu yapalım" derse ODbL'nin paylaşım koşulu (share-alike) bütün katkı veritabanına bulaşır. Önlem O-31:
  - kural barkod_worker.md'ye yazılır,
  - OFF'tan gelen alanın D1 tablolarına yazılmasını yakalayan bir test eklenir.
- Ticari API eklenirse üçüncü ayrı depo olur. Kendi `expires_at` süresi ve gece temizliği olur, D1 katkılarıyla da OFF'la da birleşmez (§5).

### 3.3 Önbellek katmanları ve ölçek
- **Gömülü dosya (data/barkod_off.json):** Türkiye'de 2.879 ürün, 528 KB, ilk barkodda bütünü iner.
  - OFF'ta Almanya tek başına yüz binlerce, dünya genelinde milyonlarca ürün var. F-03 (DACH ve Benelux) geldiğinde ülke başına tek dosya onlarca MB eder, telefona inmez.
  - Ucuz önlem (O-28): dosyayı **barkodun ilk 4 hanesine göre parçalara** bölmek (data/barkod/<önek>.json). Uygulama yalnızca okuttuğu barkodun parçasını indirir, sw.js indirilen parçayı önbelleğe alır.
  - Parçalama bugün 2.879 ürünle bir öğleden sonralık iş. Ülke sayısı arttığında ise hem üreteç hem önbellek hem test baştan yazılır.
  - Ülke filtresi (countries_tags) üreteçte kalır, parçalama ülkeden bağımsızdır.
- **Worker önbelleği (Cache API):** Cloudflare'de veri merkezi başınadır, kalıcı değildir.
  - **OFF'un sınırı IP başınadır: ürün sorgusu dakikada 15, arama dakikada 10 (§5.1).** Worker bütün kullanıcıların sorgusunu Cloudflare'in az sayıdaki çıkış IP'sinden gönderir, yani bu sınır kullanıcı başına değil hepimiz için ortaktır. Bugünkü GLOBAL_LIMIT (30/dk) ve BARKOD_LIMIT (30/dk/IP) OFF'un 15'inden yüksek. Türkiye'nin ilk duyurusunda, aynı dakikada 15'ten fazla yeni barkod okutulduğunda canlı sorgu herkes için düşer.
  - Aynı barkod her veri merkezinden ayrı ayrı OFF'a sorulur (önbellek veri merkezi başına).
  - Önlem (O-29, 🔴):
    - canlı OFF sonucu D1'de ayrı bir `off_onbellek` tablosuna (kod, yanıt, alindi, bitis) da yazılır, Cache API önünde kalır;
    - aynı barkoda aynı anda gelen istekler birleştirilir;
    - Worker OFF'a giden çağrıları kendisi sayar ve dakikada 15'in altında tutar (paylaşılan sayaç);
    - OFF 503 (sınır aşıldı; 429 değil) ya da 429 verince geri çekilir ve bu sürede yalnızca önbellek kullanılır;
    - User-Agent'a iletişim e-postası eklenir (OFF'un istediği biçim: `Umi/1.0 (e-posta)`).
  - Kalıcı çözüm Türkiye için zaten var: gömülü kopya canlı sorguyu azaltıyor. Ülkeler eklenince C-16'nın gece dökümü canlı sorguyu "kopyada olmayan yeni ürün" ile sınırlar.
  - Bu tablo OFF verisidir, katkı tablolarıyla birleşmez (§3.2).
- **Toplu veri:** Ülke sayısı arttıkça tek tek ürün sorgusu yerine OFF'un toplu dışa aktarımı (günlük dosya ya da Parquet) CI'da işlenir (off_al.py'nin 2. sürümü, C-16). Bugünkü arama servisi sayfalaması (34 sayfa) Türkiye için yetiyor, Almanya için yetmez.

### 3.4 D1 sınırları
- **Tek veritabanı, AB yargı alanı:** AB dışındaki kullanıcı için gecikme artar ama KVKK/GDPR açısından doğru seçim. Okuma kopyası (read replication) gerekince açılır, sorgular buna uygun (yazmadan sonra okuma yok).
- **Boyut sınırı yakın değil:** Katkı yalnızca metin, barkod başına en çok 30 satır. Topluluk sayacının tek istekte ~4.000 barkoda kadar çalışması zaten TEKNIK_BORC'ta yazılı, Cron'a taşınması C-17 ile birlikte yapılır.
- **7 günden uzun yedek yok:** O-08'de kullanıcı kararıyla bekliyor. Mağaza öncesi haftalık dışa aktarım şart, çünkü katkı veritabanı D-04'ün varlığıdır.

## 4. Ön yüz

- **Okuma:** BarcodeDetector (Android), ZXing (iOS Safari), elle numara. Mağaza sürümünde (C-02/C-03) cihaz içi ML Kit / Apple Vision tarayıcısı hem hızlı hem güvenilir. C-04 ile aynı eklenti katmanında yapılır, js/barkod.js'in saf mantığı değişmez.
- **Kısıtlı önek (C-10):** Tartılı ürün barkodu okununca "Bu, mağazanın kendi tartı etiketi; ürünü tanımlamaz. İçerik listesini fotoğrafla" kartı çıkar. Katkı sorusu, aranan bildirimi ve OFF sorgusu yapılmaz. ISBN için "Bu bir kitap barkodu" kartı çıkar.
- **Kayıt ülkesi (C-11, isteğe bağlı):** Kaynak kartında küçük bir satır olur: "Barkod kaydı: GS1 Türkiye (üretim yeri olmayabilir)". (i) düğmesinde açıklama durur. Asla bayrak ya da "yerli" rozeti kullanılmaz: önek menşei kanıtlamaz, rozet de ilkeyle çelişen bir yargı olur. Çeviri anahtarıyla yazılır, ülke adları ulke.* anahtarlarından gelir.
- **Parçalı veri (O-28):** `BARKOD_OFF` tek nesne yerine parça önbelleği olur (önek → nesne). İnternet yokken indirilmiş parçalar çalışır, indirilmemişte "çevrimdışı, bulunamadı" ile "bulunamadı" ayrı gösterilir.
- **Ad araması (C-09) ile ilişki:** Parçalama barkoda göre olduğu için adla arama parçaları kullanamaz. C-09 cihazda kalacaksa ayrı, küçük bir ad dizini üretilir (ad + marka → barkod). C-09 başlarken bu karar verilir; O-28 buna engel değil.
- **Görsel:** Bugün ürün görseli gösterilmiyor. Gösterilirse yalnızca URL ile gösterilir, sunucuya indirilmez. OFF görselinin lisansı ve atfı §5.1'de, ticari API görseli sözleşmeye bağlı. Öneri: görsel kanıt değil, süs. "Paketteki etiket farklı olabilir" uyarısının yanında yanlış güven verir. Şimdilik eklenmez.

## 5. Yasal ve ticari kaynaklar

Bu bölümün kaynak denetimi 22.10.2026'da birincil kaynaklardan yapıldı (aşağıdaki maddelerde bağlantılarıyla). Hukuki görüş yerine geçmez; E-05'te sorulacaklar ayrıca listelendi.

Kaynak denetimi general-purpose ajanla yapıldı. "Kısmen" yazan maddelerde sağlayıcı sayfası bota 403 verdi; metin arama motorunun alıntısından alındı, iş başlarken tarayıcıdan yeniden okunur.

### 5.1 Open Food Facts
- **Ticari kullanım serbest.** "for all purposes, including commercial use, under certain conditions" (terms-of-use).
- **Kullanım kuralları.**
  - "1 API call = 1 real scan by a user"; API ile veritabanını kazımak engellenir.
  - Birkaç yüz üründen fazlası için toplu dosya kullanılır: gece üretilen JSONL/CSV, Parquet ya da son 14 günün günlük delta dosyası.
  - Delta dosyası silinen ürünleri bildirmez, bu yüzden ara sıra tam karşılaştırma gerekir (C-16).
  - Bugünkü kullanımımız bu kurala uyuyor: canlı sorgu yalnızca kullanıcı taraması, toplu veri ayda bir arama servisinden. Ülke sayısı artınca off_al.py toplu dosyaya geçer.
- **Hız sınırı.** Ürün sorgusu dakikada 15, arama dakikada 10, ikisi de IP başına. Aşılınca HTTP 503 döner. Arama "search-as-you-type" için kullanılmaz; bu C-09 için önemli: ad araması OFF'a değil kendi dizinimize yapılır.
- **User-Agent zorunlu.** Biçim "AppName/Version (ContactEmail)". Bizimki e-posta yerine depo bağlantısı taşıyor (O-29'da düzeltilir).
- **ODbL.**
  - Ekranda gösterilen sorgu sonucu "Produced Work"tür. Yalnızca bildirim ister: ODbL ve OFF'a bağlantıyla "Contains data from Open Food Facts…".
  - OFF verisinin büyük bir kısmı değiştirilerek yeni bir veritabanına alınırsa bu "Derivative Database" olur. Herkese açık kullanılırsa ODbL'yle paylaşılması ve makine okunur kopyasının verilmesi gerekir.
  - OFF verisi değiştirilmeden, bağımsız veritabanlarının yanında tutulursa koleksiyonun bütünü ODbL'ye girmez (4.5a). Ama OFF kısmı ODbL'de kalır.
  - Bizim durumumuz:
    - Kaynak kartı atfı veriyor.
    - data/barkod_off.json OFF'tan süzülmüş bir türev; meta alanında ODbL lisansıyla ve herkese açık yayımlanıyor, yani koşul sağlanıyor.
    - D1 katkıları ayrı (§3.2).
    - O-29'un `off_onbellek` tablosu da OFF kısmıdır ve ayrı kalır.
- **Görseller CC BY-SA.** Lisans fotoğrafı kapsar; paketteki tasarım ve logo üreticinin hakkı olabilir. Doğrudan görsel bağlantısı (hotlink) için ne izin ne yasak bulundu. Belge uygun boyutu kullanmayı, toplu iş için AWS Open Data kopyasını öneriyor. Görsel eklenirse önce reuse@openfoodfacts.org'a sorulur.

### 5.2 Ticari barkod API'leri
| Sağlayıcı | Fiyat (aylık) | Hız | Kritik madde |
|---|---|---|---|
| Go-UPC | 74,95 $ / 5.000 · 245 $ / 45.000 · 795 $ / 450.000 | 2/sn | "Resell, redistribute, or make publicly available … Product Data" yasak. Son kullanıcıya gösterim bile yazılı izin ister. Bitişte bütün veriyi silme yükümlülüğü. Önbellek süresi yazılı değil. ABD hukuku. Veri ABD'de, IP ve sorgu kaydediliyor |
| Barcode Lookup | 99 $ / 5.000 – 949 $ / 500.000 | 100/dk | Alt lisans verilemez. Bitişte önbellek ve yedekler dahil silme. Görsel ve açıklama "üçüncü taraf içeriği", hak verilmiyor (kısmen) |
| UPCitemdb | Ücretsiz: 100/gün, 6/dk | 429 döner | Yalnızca müşterinin kendi işi için (kısmen) |
| EAN-Search | 19 € / 5.000 – 149 € / 300.000 | — | Saklama ve yeniden dağıtım maddesi yok; Alman hukuku |

**Umi için sonuç:**
- **Hiçbiri içerik listesi için tasarlanmamış.** Umi'nin asıl ihtiyacı olan içerik listesini karşılamıyorlar.
- **Ürün adı için bile riskli.** Go-UPC ve Barcode Lookup sözleşmeleri, adı kalıcı katalogda tutmayı, Premium'da ya da B2B'de (D-04) yeniden sunmayı yasaklıyor ya da bu konuda belirsiz. Ad için kullanılacaksa:
  - ayrı depoda tutulur,
  - abonelik bitince yedekler dahil silinebilir olur,
  - D1 katkılarıyla ve OFF'la birleşmez,
  - C-09 ad dizinine girmez,
  - son kullanıcıya gösterim için sağlayıcıdan yazılı izin alınır.
- **Karar C-15'in verisine bağlı (C-12).**

### 5.3 GS1
- **"The GS1 Prefix does not show the country of origin."** Bu ifade GS1'in kendi destek sayfasında geçiyor. Önek satırı yalnızca "barkod kaydı" olarak gösterilir (C-11).
- **GEPIR kapandı.** 31.12.2023'te yerini Verified by GS1 aldı. Ücretsiz sorgu 24 saatte 30 barkodla sınırlı. Sonuçlar "internal use only"; satılamaz, yayımlanamaz. Herkese açık API yok, API yalnızca ulusal GS1 üyesi üzerinden. GS1 Türkiye'nin sitesinde de aynı sorgu var; API'si ya da şartları bulunamadı.
- **Sonuç:** İstemin 5. adımı ("GS1 kaydından firma adı") yasal olarak otomatikleştirilemez. Ancak GS1 Türkiye ile sözleşme yapılırsa iş olur (C-13, koşullu); bugün yapılacak bir şey yok.

### 5.4 Türkiye resmi kaynakları
- **TİTCK ÜTS (kozmetik):** Vatandaş sorgusunda barkodla arama var. Kamuya açık API ya da toplu veri bulunamadı, makine erişimi yalnızca kayıtlı firmaya. Kazınmaz.
- **Tarım ve Orman Bakanlığı:** Barkodla ürün sorgusu bulunamadı. Taklit/tağşiş listesi zaten kullanılıyor (data/tagsis.json).
- **Gelecek fırsatı:** ÜTS için resmi veri paylaşımı başvurusu, kozmetikte barkod → kayıtlı ürün eşleşmesi demek. Tarafsızlık ilkesine uygun ve rakiplerde yok. E-05 hukuki görüşünden sonra, F-01 öncesi değerlendirilir; şimdilik iş açılmadı, §9 kararlar'a not.

### 5.5 KVKK / GDPR
- **Dinamik IP kişisel veridir** (ABAD Breyer, C-582/14). Ticari sağlayıcılar (ör. Go-UPC) IP'yi ve sorguyu ABD'de kaydediyor.
- **Bugünkü kural doğru ve korunmalı:** bütün dış çağrılar Worker'dan gider, kullanıcının IP'si ve kimliği dışarı çıkmaz. Böylece yurt dışı aktarım (KVKK m.9, 7499 sayılı değişiklik) oluşmaz.
- **Ticari API eklenirse:**
  - Worker'dan gider; yalnızca barkod gönderilir, katkıcı kimliği ya da iz gönderilmez.
  - Gizlilik notuna bir satır eklenir.

### 5.6 Kullanıcı katkısının lisansı (O-32)
- **Sorun:** Katkı veritabanı D-04'ün tek satılabilir varlığı, ama katkı verenle aramızda yazılı bir koşul yok. Kullanıcı içerik metnini gönderiyor, hakkın kimde olduğu, bizim ne yapabileceğimiz ve OFF'a aktarıp aktaramayacağımız (C-14) belirsiz.
- **Önlem:** Katkı onayının yanında kısa bir koşul metni olur. İçinde şunlar yazar:
  - etiket metninin bir gerçek olduğu,
  - Umi'ye süresiz, devredilebilir kullanım izni verildiği,
  - isteğe bağlı olarak OFF'a ODbL ile aktarım izni,
  - silme hakkı (GDPR; arka uç incelemesindeki "kullanıcı kendi katkısını silemiyor" maddesi).
- **Bugün yapılırsa** ilk katkıcılardan itibaren geçerli olur. **Sonra yapılırsa** o güne kadarki katkıların durumu belirsiz kalır; bu, O-22 katkıcı kimliğiyle aynı tür bir engel. Metnin son biçimi E-05'te sorulur.

### 5.7 E-05 hukuki görüşüne eklenecek sorular
1. data/barkod_off.json herkese açık bir türev veritabanı mı, mevcut meta ve atıf yeterli mi?
2. D1 katkıları ile `off_onbellek` aynı Worker'da ayrı tablolar; bu "Collective Database" sayılır mı?
3. Katkı koşulları metni (O-32) KVKK, tüketici hukuku ve mağaza kuralları açısından yeterli mi?
4. GS1 önek satırının ifadesi yanıltıcı reklam ya da menşei beyanı riski taşıyor mu?

## 6. Ölçek ve gelecek (ilke denetimi 6)

| Tetik | Bugünkü düzende ne olur | Önlem |
|---|---|---|
| 2. ülke pazarı (F-03) | Ülke başına tek parça dosya şişer; off_al.py sayfalaması yetmez | O-28 parçalama, C-16 toplu veri |
| 10 kat kullanıcı | Veri merkezi başına önbellek, OFF hız sınırı, tek IP'den gelen mobil operatör trafiği (CGNAT) BARKOD_LIMIT'e takılır | O-29 kalıcı önbellek + istek birleştirme; C-08'de sınırların yeniden ölçülmesi |
| Mağaza uygulaması (C-02) | Eski sürüm uygulamalar yıllarca aynı uç noktayı çağırır; yanıt biçimi değişirse kırılır | O-30 API sürümü (/v1/) ve yanıt sözleşmesi testi |
| Premium / B2B (D-01, D-04) | Satılabilir olan yalnızca kendi katkı veritabanımız; katkının lisansı yazılı değil | O-32 katkı koşulları; §3.2 ayrılığı (O-31) |
| OFF şeması değişir | Alan adları sessizce boş döner; "bulunamadı" sanılır | C-17 haftalık sözleşme denetimi (canary) |
| Kötü niyetli katkı (VPN) | İz denetimi aşılır | O-08'deki Turnstile / App Attest (mevcut) |

## 7. Ölçüm: ticari API kararı veriyle verilir (C-15)

A-03 bugün barkodla bulunan ve bulunamayan taramayı ayrı sayıyor ama nedenini ayırmıyor. Eklenecek sayımlar (kişisel veri yok, yalnızca sayı):
- kaynağa göre bulunma (d1 doğrulanmış / gömülü / canlı / d1 doğrulanmamış),
- "adı biliniyor, içerik yok",
- "hiç bulunamadı",
- "kısıtlı önek".

**Karar kuralı (öneri):**
- **"Hiç bulunamadı" oranı:** 30 günlük ortalamada %30'un üstündeyse yalnızca ad için ticari API denenir. Önce sözleşme okunur, sonra 1 aylık deneme yapılır, ölçüm yeniden alınır.
- **"İçerik yok" oranı:** Yüksekse çözüm ticari API değil. Katkı kolaylığı, OFF'a geri katkı (C-14) ve fotoğraf yolu çözümdür.

## 8. Agent kullanımı (her iş için)

Genel kural ~/.claude/CLAUDE.md ve depo CLAUDE.md'deki gibidir: kullanıcıya görünen ya da Worker davranışını değiştiren her PR'da kabul testini kodu görmeyen bir sınayan ajan (general-purpose) koddan önce yazar, PR'dan önce Reality Checker bozma turu yapar.

| İş | Kabul testi ajanı | Reality Checker | Başka ajan | Gerekçe |
|---|---|---|---|---|
| C-10 kısıtlı önek | ✔ | ✔ | — | Küçük ama Worker ve arayüz davranışı değişiyor |
| C-11 kayıt ülkesi satırı | ✔ | ✔ | — | Metin ve tablo doğrudan; UI Designer gerekmez (tek satır) |
| O-28 parçalı veri | ✔ | ✔ | Explore (bir kez: barkod_off.json'u okuyan bütün yerler) | Çok dosyaya yayılan bağımlılık; arama sonucu yeterli |
| O-29 kalıcı OFF önbelleği | ✔ | ✔ (eşzamanlılık ve 429 senaryoları) | — | Worker davranışı |
| O-30 API sürümü | ✔ | ✔ | — | Worker sözleşmesi |
| O-31 lisans ayrılığı testi | — | — | — | Yalnızca test ve belge |
| O-32 katkı koşulları | — | — | general-purpose (emsal katkı koşulları araştırması) | Metin; son sözü hukuki görüş (E-05) |
| C-14 OFF'a geri katkı | ✔ | ✔ | — | Dış sisteme yazma; izin akışı kullanıcıya görünür |
| C-15 ölçüm | ✔ | ✔ | — | A-03 genişlemesi |
| C-16 toplu veri | — | ✔ (veri taşıma) | — | Üreteç; kanıtlı-yeniden-yapılanma becerisi (çıktı eşdeğerliği) |
| C-17 sözleşme denetimi | — | — | — | CI işi |
| C-12 ticari API (koşullu) | ✔ | ✔ | general-purpose (sözleşme yeniden okuma) | Yalnızca C-15 verisi isterse |
| C-13 GS1 kayıt sorgusu (koşullu) | — | — | — | Yalnızca sözleşmeyle; bugün iş değil |

Kullanılmayacaklar ve neden:
- **UI Designer / Frontend Developer:** Yeni sayfa yok, iki kart ve bir satır var.
- **i18n Engineer:** Yeni dil yok, yalnızca anahtar ekleniyor.
- **SEO Specialist:** Ürün sayfaları (barkod başına web sayfası) F-02 ile birlikte ayrıca düşünülür. OFF verisinden üretilen sayfa ODbL atfı ister ve "ince içerik" riski taşır; o zaman ayrı iş olur.

## 9. Kaynaklar

Hepsine 22.10.2026'da erişildi.
- OFF API ve hız sınırları: https://openfoodfacts.github.io/openfoodfacts-server/api/
- OFF veri ve toplu indirme: https://world.openfoodfacts.org/data
- OFF kullanım koşulları: https://world.openfoodfacts.org/terms-of-use
- OFF görsel indirme: https://openfoodfacts.github.io/openfoodfacts-server/api/how-to-download-images/
- ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/
- Go-UPC koşullar / fiyat / gizlilik: https://go-upc.com/terms-and-conditions/ · https://go-upc.com/plans · https://go-upc.com/privacy-policy/
- Barcode Lookup (kısmen): https://www.barcodelookup.com/terms-and-conditions · https://www.barcodelookup.com/api
- UPCitemdb: https://www.upcitemdb.com/wp/docs/main/development/api-rate-limits/ · https://devs.upcitemdb.com/termsofservice (kısmen)
- EAN-Search: https://www.ean-search.org/ean-database-api.html · https://www.ean-search.org/tos.html
- GS1 önek menşei değil: https://support.gs1.org/support/solutions/articles/43000734188 · https://www.gs1.org/standards/id-keys/company-prefix
- Verified by GS1 sınırı ve GEPIR: https://support.gs1.org/support/solutions/articles/43000734075 · https://support.gs1.org/support/solutions/articles/43000718983 · https://www.gs1.org/docs/verified-by-gs1/public-verified-by-gs1-tou.pdf (kısmen)
- TİTCK ÜTS vatandaş sorgusu (kısmen): https://utsuygulama.saglik.gov.tr/UTS/vatandas
- ABAD Breyer C-582/14: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62014CJ0582
- KVKK yurt dışı aktarım rehberi: https://www.kvkk.gov.tr/Icerik/8142/Kisisel-Verilerin-Yurt-Disina-Aktarilmasi-Rehberi
