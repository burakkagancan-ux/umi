# Teknik borç

Bilerek ertelenen işler. Yayına (mağaza/duyuru) çıkmadan önce kapatılmalı.
Kapanan maddeler aynı başlıklarla belgeler/arsiv/teknik_borc_kapanan.md'de (15.10.2026'dan beri; madde kapanınca oraya taşınır, silinmez).

## Besin tablosu okuma oranı (A-02, 15.10.2026)
- Güvenlik ölçütü sağlandı (34 gerçek etiketin hiçbirinde yanlış renk yok; CI denetler), ama okuma oranı düşük: 3 etikette tablo bulunamadı, 17'si şüpheli (renk yok, kullanıcıya soruluyor), yalnızca 14'ünde renk var. Ölçüm: `node test/olcum_besin.js --metin`.
- Başlıca nedenler (Google Vision'ın metin sırası): değerler satır adından önce ya da tablonun sonunda toplu okunuyor (IMG_3937, 3933, 3943, 3949, 3951); "Yağ" OCR'da "Yad" okunuyor (3926); kJ/kcal ters sırada ("682 kcal/2667k", 3926; "kcal/kj", 3939); yalnızca Almanca/Fransızca/Felemenkçe/İsveççe tablo (3932, Türkçe yok); küçük, düşük çözünürlüklü fotoğraf (3931, 3924).
- Kalıcı çözüm adayı: Worker'ın Vision yanıtındaki sözcük kutularını (koordinat) da döndürüp tabloyu satır/sütun konumundan kurmak; metin sırasına dayanan kurallar bu tür hataları tek tek yamıyor. Ölçek kuralı açısından: diller çoğaldıkça metin sırası kuralları büyür, koordinat yöntemi dilden bağımsızdır.
- Bilinen kalan risk: IMG_3944'te "Protein" "Prote" okunduğu ve lif satırının adı kaybolduğu için tuz 0,8 yerine 1,2 okunuyor; renk tesadüfen aynı (Orta). Bu tür (ad kaybolup değerin bir satır kayması) metinden ucuzca yakalanamıyor; koordinat yöntemi çözer.

## 4. Kozmetik verisi (data/kozmetik.json) — KAPANDI (07.10.2026)
- **Eş anlamlılar — KAPANDI (ABD renkleri):** `kaynak/kozmetik_abd_renkler.tsv`'deki 33 satırın hepsi 21 CFR 74/82'deki (eCFR) kimyasal tanımla ve AB Ek IV CAS'ıyla tutarlı; eksik 3 ABD rengi eklendi (FD&C Blue No. 2, D&C Black No. 2 ve 3). Eş anlamlıların hepsi yeni INCI listesinde geçerli hedefe bağlı.
  - Kalan: Kurala göre üretilen Türkçe kimyasal adlar (992 ad) gerçek Türk etiketlerinde görülen yazımlarla denetlenmeli; bunun için etiket fotoğrafı gerekiyor.

## 5. Kozmetik K3 (kaynak/kozmetik_k3.tsv) — KAPANDI (07.10.2026)
- **AB endokrin listesi:** Komisyon sayfasında (07.10.2026) B grubu için yeni veri çağrısı yok; 28 madde değişmedi. Taslak tüzük B grubundan 4 maddeyi kapsıyor.
- Kalan `inceleme=1` satırlar ikincil kaynaklı listeler: Danimarka (resmi duyuru bulunamadı), komedojenite (Fulton 1989 taranmış tablo; 16.10.2026'da sınırdaki 6 madde için ikinci kaynak yine bulunamadı), Türkiye taslağı (resmi metin yok).

## Ansiklopedi: eksik bilgiler (05.10.2026)
Ansiklopedi yalnızca E kodlarını kapsıyor (333 sayfa). Temizlik ve kozmetikte ansiklopedi sayfası yok. Aşağıdakiler bilerek sonraya bırakıldı; sayılar `data/ansiklopedi.json`, `data/e_kodlari.json`, `data/kozmetik.json`, `data/temizlik.json`'dan 05.10.2026'da sayıldı.

### Gıda (E kodları)
- KAPANDI (15.10.2026, kullanıcı kararı): vegan durumu, üretim yolu doğrulaması, gözden geçirilecek kayıtlar (needs_review), boş "Vücutta" bölümleri, AB konsolide metin karşılaştırması ve TGK 2023. Ayrıntı ve eski maddeler belgeler/arsiv/teknik_borc_kapanan.md "Gıda (E kodları)" altında. Açık kalan tek gıda maddesi aşağıdaki belirtiler (Olası etkiler).
- Olası etkiler (08.10.2026'da yapı kuruldu; ayrıntı arşivde):
  - Açık: Belirtiler mevcut kaynaklardan (çoğu EFSA/JECFA özeti) yazıldı; yeni kaynak okunmadı. (12.10.2026: E128 askıya alma gerekçesi EFSA 2007 görüşünden (PMC13129613) kurum notuna yazıldı: vücutta büyük ölçüde aniline dönüşür, anilin kemirgenlerde genotoksik ve kanserojen; ADI geri çekildi.) Benzoatlar için duyarlılık tepkisi (kurdeşen vb.) kaynakta doğrulanamadığı için eklenmedi.
  - KISMEN ÇÖZÜLDÜ (13.10.2026): İlk partinin belirtileri birincil kaynaktan yeniden okundu, 7 yeni "bildirildi" satırı eklendi (TR + EN). Benzoatlar E210–E213: kurdeşen, kaşıntı, burun akıntısı/tıkanıklığı; astım ve egzama belirtilerini tetikleyebilir; tek olguda anafilaksi; atopik dermatit, kronik kurdeşen, kaşıntı ya da kalıcı riniti olanlarda, günlük sınırın altında bile (EFSA 2016 §3.2.6, kullanıcının indirdiği tam metin). Sülfitler: astım krizi, kurdeşen, anjiyoödem; astımlıların %3–10'u; tepki başlatan en düşük miktar bilinmiyor; çoğu gerçek alerji değil (EFSA 2016 tam metni, yeni kaynak `efsa_sulfite_2016`; 2022 görüşü aynı şeyi söylüyor). Polioller, miktarıyla (JECFA monografları, `jecfa_mono_e420/e421/e953/e966/e967`): sorbitol günde 50 g'ın üstünde ishal (25 g'da yok), mannitol tek seferde 10–20 g'dan laksatif, izomalt 20 g'da genelde ishalsiz / 40 g'da çocukların ~%10'unda hafif ishal, laktitol 50 g'da ishal (24 g'da yok), ksilitol çocuklarda günde 45 g'dan gaz, 65–80 g'da geçici ishal. Southampton renkleri satırı (AB 1333/2008 Ek V uyarısı; EFSA nedensel bağı doğrulamadı) değişmedi. Kalan: E964 ve E965 (JECFA monograflarında insanda ishal eşiği yok); diğer kodların belirtileri hâlâ eldeki özetlerden.

### Kozmetik
- Ansiklopedi sayfası yok. Veride 2.009 AB kaydı (`kozmetik.json`) ve 35.081 INCI adı (`kozmetik_inci.json`) var; yalnızca durum/gerekçe cümlesi ve CosIng işlevi var, "ne işe yarar / nerelerde bulunur / vücutta" açıklaması yok.
- `tr` (Türkiye ek durumu): Türk ekleriyle satır satır karşılaştırıldı; yalnızca 2024 sonrası AB değişikliklerinde ve bor bileşiklerinde dolu, diğerleri AB ile aynı (bkz. 4).
- 225 kaydın bayrağı var; 302'si bilgi (komedojenite vb.) düzeyinde. En çok aranan ~200–300 yaygın madde (UV filtreleri, koruyucular, parabenler, yağlar, asitler, koku alerjenleri) için elle kayıt öncelikli; tamamı gerekmez.
- Yapılacak: ansiklopedi modeline `product_types: cosmetic` kayıtları (model ve doğrulama bunu zaten kabul ediyor), kayıt anahtarı INCI.
- Ansiklopedi sayfaları — İLK PARTİ (15.10.2026): 32 madde (kaynak/ansiklopedi_kozmetik.json, kimlik INCI; ayrıntı belgeler/mimari/urun.md). Açık kalanlar: (1) madde sayısı ~300'e çıkarılmalı (öncelik: koku alerjenlerinin tamamı, öteki koruyucular ve formaldehit salıcılar, saç boyaları, AHA'lar); (2) 16 maddenin etki satırı 'değerlendirilemedi' (ekte olmayan maddeler ve sodyum benzoat, avobenzon): SCCS/CIR görüşleri madde madde okunmadı, yalnızca fenoksietanolün SCCS 2016 görüşü kaynak olarak bağlandı; ~~(3) sonuç ekranından bağlantı~~ KAPANDI (16.10.2026): dikkat kartı ayrıntısında "Ansiklopedide oku", tüm içerik listesinde "ansiklopedi" (data/kozmetik.json `ans`). ~~(4) Türkiye ek durumu~~ KAPANDI (16.10.2026): `tr` varsa ayrı kurum satırı (retinol: taslak). ~~(5) CosIng bağlantısı~~ KAPANDI (16.10.2026): maddenin kendi sayfası cosing/details/<substance_id> (kimlik cosing_al.py ile ingredients.csv'de; 33.607 adın 2'sinde bulunamadı, onlarda arama sayfası).
- CosIng indirmesi kararsız (16.10.2026): `cosing_al.py` bir indirmede 33.656 INCI kaydından 33.240'ını döndürdü; 401 güncel ad (ör. 2-AMINO-4-HYDROXYETHYLAMINOANISOLE, ISOPROPYL JOJOBATE) servis aramasında hâlâ var ama listeden düştü, ek CSV'lerinde de yalnızca ad sırası değişti. Aylık bot PR'ında bu adlar ingredients_eski.csv'ye kayar (tanınmaya devam eder, ama işlev ve kimlik sütunu boşalır). Ucuz önlem: indirmeyi iki kez yapıp birleştirmek ya da öncekinden %0,5'ten fazla ad düşerse durmak. Bu PR'da substance_id yeniden indirmeden alındı, mevcut ad listesi değiştirilmedi.

### Temizlik
- Ansiklopedi sayfası yok. `temizlik.json`: 8 madde notu (`subs`: MIT/CMIT/BIT/OIT, sodyum hipoklorit, asit, amonyak, enzimler), 22 içerik grubu, 98 temizliğe özgü eş anlamlı. Notu olmayan yaygın maddeler (LAS, SLES, STPP, perkarbonat, kostik soda, butil glikol, DDAC, zeolit, EDTA, sitrik asit…) yalnızca "tanınan madde" olarak CosIng işleviyle listeleniyor; açıklama yok.
- H/EUH/P ifadelerinin Türkçesi — KAPANDI (12.10.2026): SEA Yönetmeliği'nin Resmî Gazete'deki asıl metni (RG 11.12.2013, 28848 Mük., 20131211M1-1.pdf, 1.668 sayfa taranmış görüntü) indirildi; Ek-3 İkinci/Üçüncü Bölüm (EUH, s. 158–159) ve Ek-4 (P, s. 160–190) okundu. 23 EUH ve 39 P ifadesinin Türkçesi resmi metin oldu; eski çeviri "diğer yazım" olarak tanınmaya devam ediyor. EUH206'da resmi metnin "(klorür)" yazımı yerine klor bırakıldı (AB: chlorine). Açık: EUH211, EUH212 ve 2023'te eklenen EUH380–EUH451 SEA'nın 2013 metninde yok (çeviri, needs_review); SEA'nın 2013 sonrası değişiklikleri okunmadı, P101/P210/P211/P251 gibi ifadelerde AB'nin sonraki değişiklikleri Türkçe metne işlenmemiş.
- Ansiklopedi sayfaları — İLK ADIM KAPANDI (15.10.2026): 30 madde (kaynak/ansiklopedi_temizlik.json, kimlik CAS). Tehlike sınıfları ECHA CHEM API'sinden (CLP Ek VI; 8 maddede uyumlaştırılmış sınıf yok, REACH kayıt yaptıranlarının ortak bildirimi ve oranı yazılı), kullanım bilgisi PubChem'deki HSDB/Haz-Map satırlarından (resmi sayılmadı). ~~(1) İngilizce metinler~~ KAPANDI (15.10.2026): 307 metin kaynak/ansiklopedi_en.json'da (elle; CLP sınıf satırları ve H ifadeleri resmi İngilizce metinden); kaynak başlıkları zaten özgün dilinde. ~~(2) Sonuç ekranından bağlantı~~ KAPANDI (15.10.2026): madde notu kartının ayrıntısında "Ansiklopedide oku", tanınan maddeler listesinde "ansiklopedi" bağlantısı (data/temizlik.json `ans`: INCI adı → CAS; 30 bağlantı, 29 madde; Sülfamik Asit INCI dizininde olmadığı için bağlanmıyor). Açık kalanlar: (3) Türkiye SEA Yönetmeliği'nin Ek-6 listesi madde madde karşılaştırılmadı (yeni ATP'ler, ör. BIT ATP21, 2-bütoksietanol ATP18, SEA'da olmayabilir), (4) ECHA verisi elle alındı; sınıflar değişirse kendiliğinden güncellenmez. 19.10.2026'dan beri aylık mevzuat izlemesi (A-06, mevzuat_izle.py) uyumlaştırılmış sınıfın dizin/ATP/CELEX/yürürlük tarihi değişince ya da 'firma' maddesine Ek VI sınıfı gelince sorun açıyor; güncelleme hâlâ elle (clp alanı ve İngilizce satırlar). REACH ortak bildirimindeki oran (`yuzde`) izlenmiyor.

## Çok dil: eksikler (08.10.2026)
Altyapı ve İngilizce arayüz tamam (belgeler/mimari/cok_dil.md "Çok dil"). Bilerek bırakılanlar:

### Ana ekrana eklenen uygulama (manifest) — KAPANDI (13.10.2026)
- Uygulama adı, açıklaması ve kısayolları dile göre: `python3 gen_manifest.py` i18n/<dil>.json'daki manifest.* (ve sayfa.baslik, nav.ansiklopedi) anahtarlarından manifest.webmanifest (Türkçe) ve i18n/manifest/<dil>.webmanifest üretir; js/dil.js bağlantıyı seçili dile çevirir. Liste menüden kalktığı için başlangıç sayfası ocr.html, ikinci kısayol Ansiklopedi; kimlik (id) değişmedi. Ad 15.10.2026'da "Umi" oldu (O-02, kullanıcı kararı; manifest.ad, manifest.kisa_ad). Paylaşım kartındaki ad da O-02 ile.

Eski not (08.10.2026): (İngilizcede Türkçe + "not yet translated" işaretiyle görünür)
Sayılar data/ ve i18n/veri/en.json'dan 08.10.2026'da sayıldı. Ansiklopedi hariç toplam 1.164 metin.

| Metin | Sayı |
|---|---|
| E kodu gerekçesi (elle yazılmış; 206 ortak şablon arayüz anahtarıyla çevrili) | 127 |
| E kodu üretim yolu notu (uretim.n) | 333 |
| E kodu kısa açıklaması (e_aciklama) | 333 |
| E kodu Türkiye notu (tgk_note; ülke katmanı) | 13 |
| ADI notu | 19 |
| Bileşen notu | 38 |
| Birlikte dikkat kuralları (başlık, metin, grup adı) | 70 |
| Kozmetik notu ve değişiklik notu (note_tr) | 70 |
| K3 liste açıklaması ve madde notu | 13 + 76 |
| Kozmetik Türkiye durumu (tr_text; ülke katmanı) | 3 |
| Temizlik ifade notu, içerik grubu açıklaması, madde notu, karıştırma/kapsül metni | 37 + 22 + 8 + 2 |
| Ansiklopedi (data/ansiklopedi_en.json yok) | 4.038 |

Çevrilenler (i18n/veri/en.json, 380): alerjen adları (AB 1169/2011 Ek II), katkı işlev sınıfları (AB 1333/2008 Ek I), CosIng işlev adları (85, resmi), deterjan içerik grupları ve yüzde bantları (AB 648/2004 Ek VII), 115 bileşen adı, gıda ve kozmetik bayrak etiketleri, K3 liste adları ve çipleri, ADI ekleri, K3 dayanakları. Resmi metinden doğrudan: CLP H/EUH/P ifadeleri (veride `en`), E kodu adları (`name_en`; kaynağı FAIA envanteri, AB 1333/2008 Ek II metniyle tek tek karşılaştırılmadı), INCI adları. Kozmetik AB gerekçelerinin 2.009'u da kalıptan (koz.gerekce.*) İngilizce.

### Çevrilmeyen sayfalar — KAPANDI (12.10.2026)
- ansiklopedi.html arayüzü (`ans.*` anahtarları) ve index.html (Liste; `ulke.tr.liste.*`, kod js/arayuz_liste.js'e taşındı) iki dilde; alt menü üç sayfada çevrili. Bakanlık verisinde firma, ürün ve yer adları çevrilmez; ürün grubu ve uygunsuzluk türü 12.10.2026'dan beri çevrili (İngilizcede başlık altındaki not buna göre). test/ceviri.js üç sayfayı da denetler; tarayıcı testinde İngilizce ansiklopedi ve Liste turu. Ansiklopedide inceleme tarihi artık dile göre ("8 Ekim 2026" / "8 October 2026"; önce 08.10.2026).
- KISMEN ÇÖZÜLDÜ (09.10.2026, PR #105): Ülke ayarı var (Profilim > Dil kutusu; `ulke()`, saf mantık `ulkeSec`). Türkiye'ye özgü bilgiler (TGK adı/notu, Bakanlık listesi kartı, kozmetik TR durumu, TR izin notu, UZEM) yalnızca Türkiye seçiliyse görünür. Kalan (B-05): ikinci ülkenin verisi (Birleşik Krallık FSA, ABD FDA) ve ülkeye göre öne çıkan kural.

### İngilizce etiket tanıma (B-08, 08.10.2026)
- Ölçüm: `node test/olcum_ingilizce.js` (30 etiket: 10 İngiltere/AB, 10 ABD, 10 zor durum; test/veri/ingilizce_etiketler.json). CI'da `node test/ingilizce.js` eşikleri denetler: içerik parçası ≥ %85, beklenen alerjen %100, yanlış uyarı 0.
- Önce (eski 10 etiket): içerik %42 (30/72), alerjen %56 (5/9), "Sodium Citrate" → E250 yanlış uyarısı. Sonra (30 etiket): içerik %100 (239/239), alerjen %100 (49/49, türü de doğru), E kodu %100 (109/109), yanlış uyarı 0. Bu set ayar yapılırken kullanıldı; iyimser bir ölçüdür.
- Kör set (test/veri/ingilizce_kor.json, 10 etiket, ayar bittikten sonra yazıldı): ilk ölçümde içerik %92 (86/93), alerjen %100, gerçek yanlış uyarı 0 (beklenti dosyasında 2 hatam vardı: soya lesitini ve pepperonideki sodyum nitrit etikette gerçekten yazıyordu), bir yanlış eşleşme ("ammonium hydrogen carbonate" → E949 hidrojen; yeşil, uyarı değil) ve tanınmayan vitamin adları. Bunlar düzeltildi; şimdi %98, yanlış uyarı 0.
- Kalanlar:
  - Yalın "flour" eşleştirilmez (İngiltere'de tahıl adı zorunlu; ABD'de "flour" buğday demek ama "X flour" ile karışırsa yanlış gluten uyarısı olur). "Enriched flour (wheat flour…)" parantezden bulunur.
  - "Milk chocolate", "white chocolate" ayrı ad değil: süt yalnızca "milk" sözcüğünden ya da parantezdeki içerikten bulunur (Türkçedeki "sütlü çikolata" ile aynı kural).
  - Rafine soya yağı (soybean oil) soya alerjeni sayılmaz (AB 1169/2011 Ek II muafiyeti; Türkçe veriyle aynı).
  - Balık türleri ve peynir adlarının yalnızca yaygın olanları var (Open Food Facts'te ~150 balık, ~200 peynir adı); "cheese culture(s)" süt sayılır; "Penicillium roqueforti" benzer yazımla "roquefort" (süt) olur.
  - İngilizce olumsuzluk yalnızca maddenin hemen önünde ("no", "non", "without", "free from", "no added", "does not contain") ya da arkasında ("free"); daha karmaşık cümleler yok.
  - İngilizce işareti olmayan (başlıksız, bağlaçsız) kısa İngilizce parçalar Türkçe kurallarla okunur: kısa sözcükte Türkçe benzer yazım ("salad" → salam) açık, İngilizceye özgü kısa adlar (salt, soy, ham, tuna, rum) kapalı.
  - OCR'lı başlık ("lngredlents") metni İngilizce sayar ama içerik listesinin başlangıcı sayılmaz.
  - Hardal yaprağı (mustard greens) hardal alerjeni sayılır (İngiltere FSA: hardal bitkisinin yaprağı da alerjen).
  - Türkçe OCR toleransında küçük kayıp: sözlükte gerçek sözcük olan bozulmalar artık düzeltilmiyor ("karya zamkı" karaya mı kasya mı belirsiz; "çam bazı" → çam balı değil). Yapay tek harf testi %94,4 → %94,3; başka maddeye düşen 13 → 10, bunlardan dikkat/uyarı verenler 3 → 0.
- Türkçe derlem karşılaştırması: `node test/olcum_turkce.js <kök>` iki sürümün çıktısını yazar, `--fark a.json b.json` farkları listeler (test/veri/turkce_etiketler.json + testlerdeki Türkçe metinler).

## Barkod (08.10.2026)
- **Ölçüm (08.10.2026):** Open Food Facts'te Türkiye'de satılan gıda: klasik dizinde ~11.500, yeni arama servisinde (search-a-licious) 3.345 ürün; bunların yalnızca 563'ünün (%17) içerik listesi tam. Open Beauty Facts 1.031, Open Products Facts 101 ürün. Büyük markalarda içerik listesi olan ürün sayısı az (search-a-licious; ürün / içerikli): Ülker 95/36, Eti 63/19, Pınar 22/3, Torku 21/10, Nestlé 29/3, Sütaş 2/1, Komili 0. Yani ilk günlerde barkodların çoğu "içerik yok" ya da "bulunamadı" verecek; kullanıcı katkısı (D1) asıl veriyi oluşturacak.
- Open Food Facts'e geri katkı (kullanıcının izniyle; OFF uygulama hesabı ve "fotoğraf + içerik" yazma API'si) yapılmadı. Lisans gereği değil (veriyi biz göndermiyoruz) ama hem OFF'a hem tanınırlığa yarar.
- Hukuki görüşte sorulacak: OFF verisinin uygulama içinde gösterimi ve atıf biçimi yeterli mi (ODbL "Produced Work" sayılır mı); kullanıcı katkısı veritabanımızın lisansı ve kullanım koşulları; katkının "kişisel veri" olmadığı (barkod + içerik metni) değerlendirmesi.
- D1'deki katkıları denetleyecek yönetim aracı — KAPANDI (14.10.2026): Worker /yonetim sayfası (YONETIM_ANAHTARI ile; içerik ve besin tablosu satırı, bir katkıcının bütün katkıları, aranan listesinden barkod silinir; çelişenler listesi). Bkz. belgeler/mimari/barkod_worker.md "Katkı denetimi". Anahtarın panelde tanımlanması kullanıcıda.
- Barkodun kamerayla okunması bu ortamda test edilemedi (telefon testi). iOS Safari'de BarcodeDetector yok; ZXing yedeği yükleniyor (~330 KB, yalnızca gerekince). 19.10.2026: ZXing yolu ortada olmayan ve yan duran barkodu okumuyordu, düzeltildi (belgeler/mimari/barkod_worker.md); hız ve okuma oranı yapay sahnelerle ölçüldü, gerçek kamerada (iPhone) denenmedi.
- Topluluk (G-04, 14.10.2026): "aranıyor" sayısı kimliksiz ve IP saklanmadan tutulduğu için kötü niyetli biri farklı IP'lerden bir barkodu listenin başına taşıyabilir (zarar: yalnızca sıralama; veri bozulmaz, içerik eklenince barkod listeden çıkar). Kötüye kullanım görülürse: sayımı katkıcı kimliğiyle sınırlamak ya da en az iki farklı günde aranmış olma şartı. Topluluk sayaçları (D1 `toplam`) aynı anda gelen iki katkıda bir doğrulamayı iki kez sayabilir (yaklaşık sayım); gerekirse `DELETE FROM toplam` ile ilk açılışta baştan sayılır (19.10.2026'dan beri parçalı ve yarıda kalırsa yeniden denenir; ama barkod sayısı çok büyürse tek istekte ücretsiz plandaki 50 D1 sorgusu / CPU sınırına takılabilir: 200'lük parçayla yaklaşık 4.000 barkoda kadar; aşılırsa sayım birkaç isteğe bölünür ya da Cron tetikleyicisine taşınır).
- Mağaza sürümünde (C-08): Worker'ın /off ve /urun uç noktaları ALLOWED_ORIGIN ve BARKOD_LIMIT ile uygulama içinden yeniden denetlenir; mağaza sürümünde barkod okuma ML Kit'e geçebilir.

