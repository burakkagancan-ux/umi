# Rakip incelemesi: Lupa

20.10.2026, kullanıcı isteği. Kaynaklar: applupa.com, App Store sayfası, Android uygulamasının 1.0.7 sürümü (sürüm kodu 46; kullanıcının telefonundaki kurulu paketin içindeki arayüz metinleri ve kullandığı kütüphaneler; uygulama çalıştırılmadı). Uygulama içi metinlerden çıkarılan her şey, uygulamayı kuran herkesin ekranda görebildiği bilgidir; sunucu adresleri ve iç yapı bilerek bu belgeye yazılmadı (depo herkese açık).

Yol haritasına giren işler: A-08, C-09, G-06, U-09; değişen satırlar: E-01, D-01, §1, §4, §7, §8 (YOL_HARITASI.md).

## 1. Lupa nedir

- Türkiye'ye özel, barkodla çalışan gıda uygulaması. Ağustos 2026'da çıktı, iki kişilik ekip. Android ve iOS mağazasında; Flutter ile yazılmış, kendi sunucusu var.
- Yalnızca gıda, yalnızca Türkçe. Kozmetik, temizlik, İngilizce, helal yok.
- Katalog: elle doğrulanmış ~24 bin Türk ürünü (web sitesindeki iddia).

## 2. Değerlendirme yöntemi (uygulamanın kendi anlatımı)

- Her ürüne 0–100 puan. **%65 besin kalitesi + %35 katkı maddeleri.**
- Besin kalitesi Nutri-Score yöntemine dayanır: 100 g / 100 ml'de enerji, şeker, doymuş yağ ve tuz puanı düşürür; lif, protein ve meyve-sebze oranı yükseltir. İçecekler ve yağlar ayrı tabloyla.
- Her katkının 1–4 arası risk seviyesi; kaynak EFSA ve IARC (DSÖ). **Yüksek riskli katkı içeren ürün 49 puanı geçemez.** Aynı endişeyi taşıyan akraba katkılar (fosfatlar gibi) iki kez cezalandırılmaz.
- "Organik ek puanı" var.
- **Puan verilmeyen durumlar:** zorunlu değerler (enerji, şeker, doymuş yağ) eksikse ("tahmin etmeyiz"); etiket verisi fiziksel olarak imkânsızsa (toplamı 100 g'ı aşan değerler); baharat, tuz, sirke ve sakız (100 g üzerinden kıyas anlamsız); 0–3 yaş bebek gıdası (ayrı mevzuat).
- Çay ve kahvede puan içildiği (demlenmiş) hâline göre; ürün sayfasındaki tablo ambalajdakini gösterir.
- Etiketi olmayan temel gıdalarda (bal, yumurta) değerler TürKomp'tan (Ulusal Gıda Kompozisyon Veri Tabanı).
- Sorumluluk dili: "Lupa puanı, Lupa'nın kendi değerlendirmesidir; resmî bir beslenme derecesi ya da sağlık tavsiyesi değildir."

## 3. Özellikler ve para modeli

- **Ücretsiz:** barkod tarama (her zaman), puan ve açıklaması, alerjen ve beslenme tercihi uyarısı, son 20 ürünlük geçmiş, karşılaştırma, benzer ürünler ("aynı ya da yakın raftan, puanlarıyla").
- **Premium (49,99 TL/ay; Google Play / App Store aboneliği):** ürünü adıyla ya da markasıyla arama, favoriler, son 200 ürünlük geçmiş. Uyarılar ücretli katmanda değil.
- **Davet kodu:** arkadaş kodla üye olunca iki tarafa 1 ay Premium.
- **Eksik ürün:** üç fotoğraf (ön yüz, besin tablosu, içindekiler) → hemen "ön puan" → ekip etiketi kontrol edince ürün herkese açılır.
- **Katkı ve rozet:** onaylanan gönderim kullanıcının hesabına katkı olarak sayılır, rozet basamakları; ekip hesaplarının gönderimleri rozete sayılmaz. Düzeltme isteği ayrı akış.
- **Özetim:** aylık puan dağılımı, en çok taranan reyonlar, en sık taranan ürünler, katkılar; telefondaki tarama kaydından.
- **Enerji profili:** kilo ve en fazla 3 spor seçimi; ürünün enerjisini harcamakla ilişkilendiriyor (ayrıntısı metinlerden çıkmıyor).
- **Hesap:** Google, Apple ya da e-postaya 6 haneli kod. Favoriler, Premium ve katkılar sunucuda hesaba bağlı; hesap silinince sunucudan silinir.
- **Ölçüm ve gizlilik:** Firebase Analytics ve bildirim; konumdan yalnızca il ve ilçe adı, analitik kapalıysa hiç; tam konum gönderilmez.
- Web'de "Yeni eklenenler" listesi ve ürün sayfaları (applupa.com/urun), E kodu rehberi (arama motoru trafiği).

## 4. Karşılaştırma

| Konu | Lupa | Umi | Kim önde |
|---|---|---|---|
| Konumlanma | Tek puanla hızlı karar | Puansız, her uyarısı kaynaklı tarayıcı | Farklı yol; aşağıda §5 |
| Kapsam | Gıda | Gıda, kozmetik, temizlik | Umi |
| Giriş yolu | Barkod; katalog dışı ürün ekip onayını bekler | Etiket fotoğrafı (her ürün, barkodsuz da) + barkod | Umi (ölçeklenir); Lupa katalogda daha hızlı |
| Katalog | ~24 bin, elle doğrulanmış | 2.879 OFF Türkiye ürünü + D1 topluluk kaydı | Lupa, açık farkla |
| Eksik üründe | Ön puan, ekip onayı (darboğaz ekip) | Fotoğrafta anında tam analiz; iki eşleşen katkıyla kendiliğinden doğrulama | Umi (insan darboğazı yok) |
| Değerlendirmenin anlatımı | Uygulama içinde yöntem ekranı, her parçanın etkisi açılıyor | Kaynak her maddede var; derli toplu yöntem sayfası yok (E-01 ⬜) | Lupa |
| Katkı maddesi bilgisi | 172 E kodu, 1–4 risk | 333 sayfa ansiklopedi; ADI, üretim yolu, birlikte dikkat, olası etkiler, değişiklik kaydı, TGK karşılaştırması | Umi |
| Besin değeri | Nutri-Score tabanlı; ürün tipine göre istisnalar (baharat, çay/kahve, bebek) | 4 satır renk (UK FoP eşikleri), tutarlılık denetimi, şüpheli değerde renk yok, elle giriş; ürün tipi istisnası yok | Denetimde eşit; istisnalarda Lupa → A-08 |
| Kişisel uyarı | Alerjen, beslenme tercihi, enerji/spor | 11 profil, elle alerjen, BKİ, gizli sodyum | Umi |
| Arama, benzer ürün | Adla arama (Premium), benzer ürünler | Yok (C-07 ⬜, katalog yetersiz) | Lupa → C-09, C-07 |
| Karşılaştırma | Var | Var (üç türde) | Eşit |
| Topluluk | Katkı + rozet + ekip onayı | Rozetler, Eklediklerim, topluluk hedefleri, hesapsız | Eşit; bizim doğrulamamız insansız ölçeklenir |
| Hesap ve eşitleme | Hesap, sunucuda favoriler | Hesapsız, cihazda, yedek dosyası (O-18) | Gizlilikte Umi, kolaylıkta Lupa |
| Gelir | Premium satışta | Yok (D-01 👤) | Lupa |
| Dağıtım | Play ve App Store | PWA, mağazada yok (C-01–C-03) | Lupa |
| Dil ve ülke | Türkçe, Türkiye | TR + EN, 24 ülke seçimi, çok dilli altyapı, ülke katmanı planı (B-05) | Umi |
| Mevzuat kaynakları | EFSA, IARC, TGK | AB, TR, ABD, Kaliforniya, ASEAN, REACH, CLP; aylık izleme (A-06) | Umi |
| Bakanlık taklit/tağşiş listesi | Yok | Var | Umi |

## 5. Değerlendirme

**Türkiye gıda pazarında** Lupa hedeflediğimiz ürüne bizden önce ulaştı: yayında, satışta, kataloğu büyük, yöntemini açık anlatıyor. Barkodla gıda kataloğunda kafa kafaya yarışmak bizim için yanlış alan; onlar önde ve hızlılar.

**Küresel ölçekte** Lupa'nın yapısı ölçeklenmiyor: güvenilirliği elle doğrulanmış kataloğundan geliyor ve bu emek her ülkede yeniden gerekiyor. Open Food Facts bağlamak eksik ve hatalı veriyi getirir; "tahmin etmeyiz" ilkesiyle çatışır. Dil eklemek mevzuatı çözmez. Küreselde aynı bileşim (OFF + Nutri-Score + katkı puanı) zaten Yuka'nın alanı.

**Bizim ayrıştığımız yerler** (korunacak, öne çıkarılacak): barkodsuz etiket fotoğrafıyla her ürün (katalog beklemeden her ülkede çalışır), kozmetik ve temizlik, puansız ve kaynaklı anlatım, Bakanlık listesi, çok dilli ve çok ülkeli altyapı.

**Puan konusu:** Puan vermemek değişmez kararımız (CLAUDE.md). Lupa'nın bile "kendi yorumumuzdur" diye yazmak zorunda kalması bu kararın gerekçesini destekliyor. Kullanıcının "tek bakışta" ihtiyacı puansız karşılanır: sonuç üstündeki sayılar ve renkler. Bunun yetip yetmediği ölçümle izlenir (A-03: tarama sonrası geri dönüş, paylaşım).

## 6. Alınacak dersler → yol haritası

| Ders | Yol haritası |
|---|---|
| 100 g renginin anlamsız olduğu ürün tipleri (baharat, tuz, sirke, sakız, kuru çay/kahve) ve bebek gıdası | **A-08** (yeni, küçük) |
| Yöntemin tek yerde, sade ve uygulama içinden anlatılması güven getiriyor | **E-01** genişletildi, öne alınması önerildi |
| Ürün adıyla arama Premium'a ödeme sebebi | **C-09** (yeni), D-01 adaylarına eklendi |
| Davet kodu: iki tarafa Premium | **G-06** (yeni; G-03 ile aynı ödül birimi) |
| Aylık özet geri dönüş sebebi | **U-09** (yeni; puansız, cihazda) |
| Benzer ürün önerisi | C-07 (var; katalog büyüyünce) |
| Web'de ürün ve E kodu sayfaları | F-02 (var) |
| Etiketsiz temel gıdalar için resmi kompozisyon verisi (TürKomp) | İş açılmadı: uygulamamız etiketi okur, etiketsiz ürün kapsam dışı. Lisans ve gerek kullanıcı talebiyle yeniden değerlendirilir |

Bilerek alınmayanlar: puan (değişmez karar), ekip onayına dayalı katalog (ölçeklenmez; doğrulama toplulukta kalır), hesap zorunluluğu (gizlilik; eşitleme O-18'de hesapsız seçeneklerle).
