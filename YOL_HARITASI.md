# Yol haritası: küresel Umi

Bu dosya projenin ana iş planıdır. Her oturumun başında okunur. Bir iş başlayınca, bitince ya da plan değişince aynı PR içinde güncellenir (durum, tarih, PR numarası).
İlk yazım: 08.10.2026 (rakip analizi ve kullanıcı kararıyla). Son güncelleme: 15.10.2026 (U-02: temizlik ansiklopedisi İngilizce ve sonuç ekranından bağlantı; C-05 bitti, sıradan çıkarıldı; fotoğrafta barkod denendi, verimli bulunmadı, geri alındı).

Durum işaretleri: ⬜ başlamadı · 🔄 sürüyor · ✅ bitti · ⏸ bekletiliyor · 👤 kullanıcının işi

Biten işlerin (✅) satırları aynı başlık ve tablolarla belgeler/arsiv/yol_haritasi_biten.md'de (15.10.2026'dan beri; iş bitince satır oraya taşınır, silinmez). Bir iş kimliğini aramak için: `grep -rn "<kimlik>" YOL_HARITASI.md belgeler/arsiv/`.

---

## 0. Vizyon ve ilkeler (değişmez)

- **Amaç:** Para kazanan, küresel bir uygulama. Hedef onlarca dil (belki 60). Türkiye ilk pazar, son değil.
- **İlke:** Her bilgi kaynağa dayalı, tarafsız ve bilimsel. Gelir bu ilkeyi bozamaz.
  - Markadan para, reklam ya da ücretli sıralama yok.
  - Güvenlik uyarıları, kaynaklar ve kişisel hassasiyet uyarıları her zaman ücretsiz. Ücretli katmanda yalnızca kolaylık özellikleri olur.
  - Skor yok. "Güvenli / zararlı" denmez. Dil olasılık bildirir ("yol açabilir / bildirilmiştir").
- **Konumlanma:** "Etiketi okuyan, her uyarısının kaynağını gösteren, puan vermeyen tarayıcı. Gıda, kozmetik ve temizlik için tek uygulama." Rakiplerin en zayıf yeri bilimsel güvenilirlik; bizim en güçlü yerimiz bu.

### Her yeni özellik için ilke denetimi
Her PR açıklamasında bu beş soru yanıtlanır:
1. Gösterilen her bilginin resmi ya da hakemli bir kaynağı var mı?
2. Bir markayı, reklamı ya da geliri kayıran bir şey var mı? (Olmamalı.)
3. Güvenlik bilgisi ücretli katmana mı kaydı? (Kaymamalı.)
4. Yeni metin çeviri anahtarıyla mı yazıldı? Türkçe sabit metin eklendi mi?
5. Mevzuata bağlı bilgi ülke katmanında mı, yoksa tek ülkeye mi gömüldü?
6. **Ölçek denetimi (§9):** Bu iş, ileride 10 kat kullanıcı, 60 dil, 20 ülke ya da mağaza sürümü geldiğinde yeniden yapılmak zorunda kalır mı? Kalacaksa bugün hangi küçük önlem bunu önler? (Önlem ya PR'da yapılır ya §9'a kimlikli bir iş olarak yazılır.)

---

## 1. Bugünkü durum (08.10.2026)

- **Ürün:** Tarayıcıdan çalışan uygulama (PWA). Bakanlık taklit/tağşiş listesi; fotoğraftan etiket okuma (gıda, kozmetik, temizlik); 333 sayfalık kaynaklı E kodu ansiklopedisi; karşılaştırma; kaydedilen ürünler; paylaşım kartı (hikâye ve gönderi boyutu).
- **Diller:** Türkçe ve İngilizce arayüz (#95, #96). Veri metinleri ve ansiklopedinin 4.058 metni İngilizce (#105; 12.10.2026: +15 "Vücutta nasıl işlenir?" metni). Üç sayfanın da (Etiket Oku, Ansiklopedi, Liste) arayüzü iki dilde (12.10.2026); Liste'de Bakanlık'ın ürün, firma ve yer adları Türkçe kalır, ürün grubu ve uygunsuzluk türü çevrili; ansiklopedinin kaynak adları çevrili (12.10.2026).
- **Mevzuat:** AB, Türkiye (TGK 2013 listesi, kozmetik ekleri), ABD (FDA renkleri), Kaliforniya, ASEAN, AB endokrin listeleri, REACH.
- **Dağıtım:** GitHub Pages. Mağazada yok.
- **Gelir:** Yok, model seçilmedi.
- **Rakipler (ayrıntı: §8):** Yuka (85 milyon kullanıcı iddiası, 2025 geliri ~11,9 M$, Türkiye'de yok), Open Food Facts, CodeCheck, INCI Beauty, Think Dirty, EWG, Olive, Fig. Türkiye'de ÇabukBak ve Ürün Dedektörü (küçük, barkodlu, puanlı). 20.10.2026: Lupa (Ağustos 2026, mağazada, Premium satışta, ~24 bin elle doğrulanmış ürün, 0–100 puan; karşılaştırma: belgeler/rakipler/lupa.md).

---

## 2. Fazlar

| Faz | Amaç | Çıkış ölçütü |
|---|---|---|
| **A. Temel** | Türkiye'de ürünü olgunlaştırmak | Telefon testleri tamam, besin değeri tablosu var, ölçüm çalışıyor |
| **B. Küresel altyapı** | Yeni dil ve ülke eklemeyi veri işine indirmek | İngilizce arayüz yayında, ülke katmanı çalışıyor, yeni dil eklemek = bir çeviri dosyası |
| **C. Mağaza ve hız** | Bulunurluk, hız, maliyet | Android ve iOS mağazada, cihaz içi okuma, barkod |
| **D. Gelir** | Sürdürülebilir gelir, ilkeyi bozmadan | Premium satışta, Bağımsızlık sayfası yayında |
| **E. Güven ve yönetişim** | Küresel ölçekte güven ve hukuki koruma | Yöntem sayfası, değişiklik kaydı, danışma kurulu, hukuki görüş |
| **F. Pazarlar** | Türkiye'den dünyaya | Sırayla: Türkiye → DACH ve Benelux → İngilizce pazarlar → MENA → ABD → 60 dil |
| **G. Topluluk ve oyunlaştırma** | Kullanıcıyı ürün eklemeye ve doğrulamaya teşvik etmek | Rozetler yayında, katkılar sahiplendiriliyor, barkodla bulunma oranı artıyor |

Fazlar kısmen paralel yürür. A ve B şimdi; C, B'nin ilk PR'larından sonra; D, C'den sonra (mağaza içi satın alma gerekiyor); E'nin bir kısmı her fazda; F, C'den sonra; G, C-05 barkod katkısından sonra (O-22 hemen).

---

## 3. İş paketleri

Sütunlar: kimlik · iş · sahibi · bağımlılık · kabul ölçütü · durum.

### Faz A: Temel

| Kimlik | İş | Sahibi | Bağımlı | Kabul ölçütü | Durum |
|---|---|---|---|---|---|
| A-01 | Telefon testleri ve sonuçlara göre ayar | 👤 + Claude | — | Kullanıcının bulduğu her sorun PR'la kapanır | 🔄 👤 |
| A-02 | Besin değeri tablosu (şeker, yağ, doymuş yağ, tuz; 100 g başına; NHS/AB eşikleri; puansız renkli gösterim). Adımlar: (1) barkod → Open Food Facts besin değerleri ✅ 13.10.2026; (2) etiket metninden tablo ayrıştırıcı + tutarlılık denetimi ✅ 13.10.2026 (js/besin.js, test/besin.js; denetimi geçmeyen değer "şüpheli", renk gösterilmez, kullanıcıya sorulur); (3) ekran: dört satır renkli, eşik kaynağı, düzeltilebilir değerler, "tabloyu da ekle" düğmesi ✅ 13.10.2026 (eşikler Birleşik Krallık FoP 2016 Ek 3; js/arayuz_besin.js); (3b) tablo kayıtlı ürüne (kaynağıyla saklanır, yedekle gider), karşılaştırmaya (dört satır; karar değişmez) ve paylaşım kartına (yalnızca renk gösterilebilen tablo) ✅ 14.10.2026; (4) gerçek etiket setiyle ölçüm ✅ 15.10.2026 (34 Türk etiketi, test/veri/besin_etiketler.json, test/olcum_besin.js; yanlış renk 5 → 0, CI denetler; kalan: okuma oranı, bkz. TEKNIK_BORC.md) | Claude + 👤 | — | Etiketteki tablo okunur, eşik kaynakları görünür, testli; gerçek etiket setinde hiç yanlış renk güvenle gösterilmez | ✅ 15.10.2026 |
| A-04 | Fotoğraf okuma kalitesi: iki sütunlu etiket, kavisli ambalaj, otomatik kırpma önerisi (galeriden yükleme eklendi, #90) | Claude | — | Gerçek etiket setinde ölçülen iyileşme | 🔄 |
| A-05 | Helal katmanı ("kaynağı belirsiz, sertifikaya bakın"; hüküm vermez) | Claude | — | Kaynaklı, yalnızca bilgi; MENA pazarının ön koşulu | ⬜ |
| A-06 | Aylık mevzuat izleme (EUR-Lex, Resmî Gazete; CosIng zaten var) | Claude | — | Değişiklik varsa otomatik issue ya da PR | 🔄 19.10.2026: EUR-Lex (8 AB metni, konsolide sürüm) ve ECHA CLP Ek VI (temizlik ansiklopedisinin 30 maddesi) ayda bir izleniyor, değişiklikte sorun açılır (mevzuat.yml, veri_uretimi.md). Kalan: Resmî Gazete otomatik izlenmiyor (makine okunur akış yok; elle) |

### Faz B: Küresel altyapı

| Kimlik | İş | Sahibi | Bağımlı | Kabul ölçütü | Durum |
|---|---|---|---|---|---|
| B-03 | Ana içerik dili İngilizce: ansiklopedi, gerekçeler ve notlar önce İngilizce yazılır, Türkçe dahil öteki diller oradan çevrilir | Claude | B-02 | Yeni içerik İngilizce anahtarla girer; mevcut Türkçe içeriğin çevrilme oranı raporlanır | 🔄 21.10.2026: 1. adım, çeviri oranı raporu (`python3 ceviri_oran.py`; en: arayüz, veri, ansiklopedi %100). 2. adım (👤 karar): yeni içeriği İngilizce yazıp Türkçeyi ondan çevirmek; içeriği gözden geçiren kullanıcı Türkçe okuduğu için iş akışını değiştirir |
| B-04 | Resmi çok dilli adlar: AB katkı adları ve CLP ifadeleri (24 AB dili, resmi metin), Open Food Facts madde sözlüğü (ODbL, atıfla) | Claude | B-01 | Kaynak ve lisans her dosyada yazılı | ⬜ |
| B-05 | Ülke mevzuat katmanı: kullanıcının ülkesine göre öne çıkan kural; yeni ülke = yeni veri dosyası. İlk eklenecekler: Birleşik Krallık (FSA), ABD (FDA katkı listeleri) | Claude | B-01 | Türkiye/AB/ABD/Birleşik Krallık aynı modelde; kodda ülke adı geçmez | 🔄 21.10.2026: model ve ilk üç ülke (TR, GB katkı listesi FSA; ABD gıda renklendiricileri 21 CFR 73/74 + siklamat); kodda ülke koşulu yok (test/ulke.js). Kalan: ABD'nin renklendirici dışı katkıları (GRAS, 21 CFR 172/184), kozmetik ve temizlikte GB/ABD, besin eşiklerinin ülkeye göre seçimi, ansiklopedide ülke satırı |
| B-06 | Çeviri iş akışı: resmi çeviri > makine çevirisi + uzman kontrolü; her metinde "kontrol edildi / edilmedi" işareti; 60 dile ölçeklenir | Claude + 👤 (çevirmen bulmak) | B-02 | Kontrol edilmemiş metin arayüzde işaretli | ⬜ |
| B-07 | Latin dışı alfabeler: Noto yazı tipi yedeği, sağdan sola yerleşim (Arapça, Farsça, İbranice, Urduca) | Claude | B-01 | İlk Latin dışı dil eklenince | ⬜ |
| B-08 | İngilizce etiketlerde madde tanıma ölçümü ve eksik eş anlamlılar | Claude | B-02 | 10+ gerçekçi İngilizce etikette ölçüm | ✅ 08.10.2026: 30 etiket (İngiltere/AB, ABD, zor durum) içerik %100, alerjen %100, yanlış uyarı 0; ayarsız kör sette içerik %92 → %98. CI eşiği test/ingilizce.js. 638 kaynaklı İngilizce ad satırı (kaynak/ingilizce_esanlamlilar.tsv). Telefon testi 👤 (A-01). Kalanlar TEKNIK_BORC.md |

### Faz C: Mağaza ve hız

| Kimlik | İş | Sahibi | Bağımlı | Kabul ölçütü | Durum |
|---|---|---|---|---|---|
| C-01 | Geliştirici hesapları: Google Play (tek sefer 25 $), Apple Developer (yıllık 99 $); mümkünse şirket adına (bkz. D-06) | 👤 | — | Hesaplar açık | ⬜ 👤 |
| C-02 | Android sürümü (TWA ya da Capacitor), kapalı test, sonra yayın | Claude | C-01 | Play Store'da yayında | ⬜ |
| C-03 | iOS sürümü (Capacitor) | Claude | C-01 | App Store'da yayında | ⬜ |
| C-04 | Cihaz içi metin okuma (Google ML Kit / Apple Vision); Google Vision yedek kalır. Tarama maliyeti sıfırlanır, bütün alfabeler okunur | Claude | C-02, C-03 | İnternetsiz okuma çalışır | ⬜ |
| C-06 | Mağaza sayfaları çok dilli (ekran görüntüleri, açıklama) | Claude | B-02, C-02 | Türkçe ve İngilizce sayfa | ⬜ |
| C-07 | Alternatif ürün önerisi (aynı kategoride daha az uyarılı ürün; markadan para alınmaz) | Claude | C-05 | Yalnızca veritabanı yeterliyse | ⬜ |
| C-09 | **Ürün adıyla ya da markasıyla arama** (20.10.2026, Lupa karşılaştırmasından; Lupa'da Premium'un ana sebebi). Barkodu okunamayan ya da elde olmayan ürünü barkod verisinde (data/barkod_off.json + D1 doğrulanmış kayıtlar) adla bulmak; Türkçe harf duyarsız. Sonuç bulunan ürünün değerlendirmesini açar, uyarılar hiçbir yolda kısılmaz. D-01'de Premium adayı (kolaylık; ilke denetimi 3'e aykırı değil) | Claude | D-01 (ücretli mi kararı), katalog büyüklüğü | Arama cihazda çalışır, sonuç değerlendirmeyi değiştirmez; bulunamayınca fotoğraf yolu önerilir | ⬜ |
| C-08 | **Mağaza sürümünde sayaç ve sınır denetimi (unutulmasın).** Uygulama içinden gelen isteklerde: paylaşım sayacı (/sayac, sendBeacon ve Web Share uygulama içinde çalışıyor mu, s/d ayrımı doğru mu), barkod uç noktaları (/urun, /off), Worker hız sınırları (IP_LIMIT 6/dk, GLOBAL_LIMIT 30/dk, SAYAC_LIMIT 10/dk; uygulama trafiği tek IP'den mi görünüyor), ALLOWED_ORIGIN'e uygulamanın kaynağı (capacitor://localhost, https://localhost vb.) eklendi mi, cihaz içi okumaya geçince OCR sayımı. Ölçüm (A-03) eklenmişse o da. | Claude | C-02, C-03 | Kapalı testte her sayaç ve sınır elle doğrulanır, sonuç bu satıra yazılır | ⬜ |

### Faz D: Gelir

| Kimlik | İş | Sahibi | Bağımlı | Kabul ölçütü | Durum |
|---|---|---|---|---|---|
| D-01 | Gelir modeli kararı. Öneri: ücretsiz çekirdek + Premium kolaylık. **Her zaman ücretsiz:** bütün uyarılar, kaynaklar, kişisel uyarılar, ansiklopedi, paylaşım. **Premium adayları:** sınırsız kayıt ve geçmiş, aile profilleri, cihazlar arası eşitleme, gelişmiş karşılaştırma, internetsiz tam veri, reklamsız (zaten reklam yok) destek rozeti. 20.10.2026 kıyas (Lupa, 49,99 TL/ay): Premium'u ürün adıyla arama (C-09), favoriler ve uzun geçmişle satıyor; tarama ve uyarılar ücretsiz, yani bizim ilkemizle aynı ayrım | 👤 karar, Claude öneri | — | Liste bu dosyaya yazılır | ⬜ 👤 |
| D-02 | Uygulama içi satın alma (Apple/Google; komisyon %15–30) | Claude | C-02, C-03, D-01 | Satın alma çalışır, geri yükleme çalışır | ⬜ |
| D-03 | Bağımsızlık sayfası: gelir kaynakları ve dağılımı herkese açık (Yuka örneği) | Claude + 👤 | D-02 | Yılda bir güncellenir | ⬜ |
| D-04 | B2B veri ve API lisansı (kaynaklı madde veritabanı; diyetisyen, eczane, e-ticaret). Sözleşmede: lisans alan değerlendirmeyi etkileyemez | 👤 + Claude | E-01 | Örnek sözleşme maddesi ve API taslağı | ⬜ |
| D-05 | Hibeler: TÜBİTAK BiGG ve 1512, KOSGEB, AB programları. Claude başvuru metnini hazırlar, kullanıcı başvurur | 👤 + Claude | — | Uygun çağrı listesi ve takvim | ⬜ |
| D-06 | Şirketleşme, vergi, mağaza hesaplarının şirkete geçmesi | 👤 | — | — | ⬜ 👤 |

### Faz E: Güven ve yönetişim

| Kimlik | İş | Sahibi | Bağımlı | Kabul ölçütü | Durum |
|---|---|---|---|---|---|
| E-02 | Herkese açık değişiklik kaydı: her değerlendirme değişikliği tarihi ve kaynağıyla (ör. E553b sarı oldu, IARC 2025) | Claude | O-05 ✅ | Veri değişikliklerinden otomatik üretilir | 🔄 veri ve zorunlu kayıt hazır (O-05, 13.10.2026); kullanıcıya gösterilen sayfa ve çevirisi yok |
| E-03 | Düzeltme süreci: "Hata bildir" → yanıt süresi hedefi → değişiklik kaydı | Claude + 👤 | E-02 | Süreç yöntem sayfasında yazılı | ⬜ |
| E-04 | Bilim danışma kurulu (gıda bilimi, toksikoloji, dermatoloji) | 👤 | — | En az bir danışman; adları yöntem sayfasında | ⬜ 👤 |
| E-05 | Hukuki görüş (KVKK/GDPR, Google Vision, "zararlı" dili, ürün adı geçen paylaşım, Bakanlık listesi gösterimi, varsayılan açık ve kapatılabilir anonim kullanım sayımı A-03). **Tetik:** mağazaya çıkış, ilk ücretli özellik ya da ilk yurtdışı pazar; hangisi önce gelirse | 👤 | Tetik | Görüş alındı, gereken değişiklikler PR'la yapıldı | ⏸ 👤 |
| E-06 | Gizlilik politikası ve kullanım koşulları, çok dilli | Claude + 👤 | E-05 | Mağaza zorunluluğu | ⬜ |

### Faz F: Pazarlar

| Kimlik | Pazar | Neden | Ön koşul | Durum |
|---|---|---|---|---|
| F-01 | **Türkiye** (mağaza lansmanı) | Bakanlık listesi en güçlü koz; Yuka yok; yerli rakipler küçük | C-02, E-05 | ⬜ |
| F-02 | **Arama motoru sayfaları:** her madde için kaynaklı web sayfası, pazarlama bütçesi olmadan trafik | Bütün pazarlar | B-03, E-01 | ⬜ |
| F-03 | **Almanya, Avusturya, Hollanda, Belçika** (Türkçe + Almanca + Felemenkçe) | 3–4 milyon Türkçe konuşan; AB mevzuatı hazır; CodeCheck zayıf | B-02, C-02 | ⬜ |
| F-04 | **İngilizce pazarlar** (Birleşik Krallık, İrlanda, Kanada, Avustralya) | "Kanıta dayalı alternatif" konumu | B-05 (Birleşik Krallık katmanı) | ⬜ |
| F-05 | **Körfez ve MENA** (Arapça) | Yuka yok, helal talebi yüksek | A-05, B-07, GSO mevzuat katmanı | ⬜ |
| F-06 | **ABD** | En çok ödeme yapan pazar; en kalabalık | B-05 (FDA + eyaletler), D-02 | ⬜ |
| F-07 | **60 dile ölçek.** Yeni dil ölçütü: kullanıcı talebi + resmi kaynak varlığı + çeviri kontrolcüsü | Küresel hedef | B-06 | ⬜ |

### Faz G: Topluluk ve oyunlaştırma (12.10.2026, kullanıcı isteği)

Amaç: kullanıcıları barkodlu ürün eklemeye (C-05 katkısı) ve doğrulamaya teşvik etmek; ürün veritabanı büyüdükçe barkodla bulma oranı artar, tarama maliyeti düşer.

**Kurallar (§0'dan):** Ödül ve rozet kullanıcının **katkısına** verilir, ürüne değil (ürüne puan/rozet yok). Güvenlik bilgisi hiçbir zaman ödülle açılan bir hak olmaz. Ödül yalnızca **doğrulanmış** katkıya verilir (iki eşleşen katkı, C-05), yoksa sahte katkı teşvik edilir (O-08, O-21). Korku ve kaygı dili yok; gün serisi ("streak") gibi baskı kuran mekanikler yok. Rozet adları ve açıklamaları çeviri anahtarıyla; rozet tanımları veri dosyasında (yeni rozet = veri, kod değil).

**"1 ürün ekle, 1 tarama hakkı kazan" (kullanıcı önerisi) hakkında:** Tarama hakkı sınırlanırsa uyarılar sınırlanmış olur; bu §0'daki "güvenlik uyarıları her zaman ücretsiz" ilkesine ve ilke denetiminin 3. sorusuna aykırı. Yuka da taramayı sınırlamıyor; sınırlamak rakip karşısında zayıflık. Öneri: aynı "ver-al" mantığı, ödül olarak **Premium kolaylık günü** (G-03). Tek istisna adayı maliyet: bulut okuma (Google Vision) cihaz içi okumaya (C-04) kadar ücretli; günlük kota gerekirse yalnızca kötüye kullanıma karşı yüksek bir sınır olur (ör. günde 50), ödül mekanizması olmaz.

| Kimlik | İş | Sahibi | Bağımlı | Kabul ölçütü | Durum |
|---|---|---|---|---|---|
| G-03 | **Ver-al teşviki (öneri).** Doğrulanmış her katkı → N gün Premium kolaylık (D-01'deki liste; ör. 1 katkı = 3 gün, üst sınır 90 gün). Premium satışa çıkana kadar katkılar birikir; açılışta "kurucu katkıcı" olarak karşılığı verilir. Mağaza kuralları (Apple 3.1.1, ödüllendirilmiş eylemler) ve KVKK E-05'te sorulur | 👤 karar (ödül türü ve oranı), Claude | G-02, D-01, D-02 | Ödül yalnızca doğrulanmış katkıya; güvenlik bilgisi ödüle bağlı değil (ilke denetimi 3) | ⬜ 👤 |
| G-06 | **Davet** (20.10.2026, Lupa karşılaştırmasından; Lupa'da arkadaş kodla üye olunca iki tarafa 1 ay Premium). Hesapsız: cihazdaki katkıcı kimliğinden (O-22) türeyen davet kodu; ödül G-03 ile aynı birim (Premium kolaylık günü), yalnızca davet edilen ilk doğrulanmış katkısını ya da ilk taramasını yapınca (sahte cihazla kötüye kullanıma karşı). Mağaza kuralları ve KVKK E-05'te sorulur | 👤 karar (ödül), Claude | G-03, D-01, D-02 | Güvenlik bilgisi ödüle bağlı değil (ilke denetimi 3); aynı cihaz kendini davet edemez | ⬜ 👤 |
| G-05 | Ölçüm (A-03 ile): katkı sayısı, doğrulanma oranı, rozet kazananların 7/30 gün geri dönüşü, barkodla bulunma oranının zamanla değişimi | Claude | A-03, G-01 | §5'te izlenir | ⬜ |

### Sürekli ürün işleri (her fazla paralel)

| Kimlik | İş | Durum |
|---|---|---|
| U-01 | Kozmetik ansiklopedisi (en yaygın ~300 madde; önce İngilizce, B-03). 15.10.2026 (ilk parti): 32 madde yayında, Türkçe + İngilizce (kimlik INCI; renk ve kurum satırları Etiket Oku'daki kozmetik verisinden, AB 1223/2009 ekleri ve izlenen listeler); tür seçicide Kozmetik açık. 16.10.2026: sonuç ekranından ansiklopediye bağlantı, Türkiye ek durumu ayrı satır, CosIng bağlantısı maddenin kendi sayfası. Kalan: madde sayısını ~300'e çıkarmak, SCCS görüşlerinin madde madde okunması | ◐ |
| U-02 | Temizlik ansiklopedisi (~30 madde). 15.10.2026: 30 madde yayında (kimlik CAS; tehlike sınıfı ECHA CHEM, CLP Ek VI ya da kayıt yaptıranların ortak bildirimi); tür seçicide Temizlik açık. 15.10.2026 (2. adım): İngilizce metinler ve sonuç ekranındaki maddeden ansiklopediye bağlantı yapıldı. Kalan: SEA Ek-6 karşılaştırması, madde sayısını artırmak | ◐ |
| U-03 | Temizlik: AB 2026/405 dijital ürün pasaportu hazırlığı (QR'dan içerik listesi okuma; 23.09.2029'dan itibaren zorunlu) | ⬜ |
| U-05 | Kozmetik PFAS bayrağının ad düzeyine indirilmesi (TEKNIK_BORC.md) | ⬜ |
| U-06 | Gelişim alanları ve teknik borç: belgeler/mimari/kararlar.md "Gelişim alanları" ve TEKNIK_BORC.md | 🔄 |
| U-07 | **Altyapı yenilemesi (15.10.2026, kullanıcı onayı; her adım ayrı PR, sırayla birleşir):** (1) altın çıktı testi + test toplayıcı + tarayıcı testi paralel grup ✅ PR 1; (2) tek üreteç komutu uret.py + ortak üreteç yardımcıları ✅ PR 2; (3) sw.js CORE ve CACHE sürümünün üretilmesi ✅ PR 3; (4) saf mantığın ES modüllerine geçişi, Worker kopyasının kalkması ✅ PR 4; (5) ortak değerlendirme modeli (üç tür tek sonuç biçimi; karşılaştırma, paylaşım, kayıt ona bağlı) ✅ PR 5; (6) arayuz.js'in bölünmesi ve profil kartı verisinin saf mantığa taşınması ✅ PR 6 (arayüz dosyalarının modüle geçişi bilerek ertelendi: mağaza sürümündeki paketleyiciyle, O-15); (7) tek depolama modülü ✅ PR 7; (8) satır içi CSS'in sayfa dosyalarına taşınması, ortak kuralların tema.css'e ✅ PR 8; (9) belge bölme ve oturum başına okunan bağlamın küçültülmesi ✅ PR 9. PR'lar #158–#166, sırayla birleşir | ✅ 15.10.2026 |
| U-08 | **Diyet ve yaşam tarzı profilleri (ileriki faz; 16.10.2026, kullanıcı isteği).** Sporcu, ketojenik, zayıflama, Dukan gibi profiller; mevcut 100 g besin değerleri üstüne hesap katmanı (ör. "bu ürün günlük net karbonhidrat kotanın %X'i", boy/kiloya göre kalori). Ön koşullar: (1) **kaynak ve tarafsızlık:** eşik ve kotalar resmi/hakemli kaynaktan (EFSA DRV, ACSM/ISSN, keto için 20–50 g net karbonhidrat aralığı kaynakla); bilimsel dayanağı zayıf ticari diyetler (Dukan) yalnızca "kurallarına uyar/uymaz" diye gösterilir, önerilmez; (2) **sağlık verisi:** boy, kilo, yaş ve cinsiyet zaten Profilim > Kişisel Bilgiler'de (BKİ için, cihazda); diyet seçimi de özel nitelikli kişisel veri (KVKK/GDPR), cihazda kalır; cihazlar arası eşitleme (D-01) gelirse E-05 hukuki görüşüne eklenir; (3) **tıbbi sınır:** "tıbbi tavsiye değildir" notu; keto profilinde diyabet ve böbrek hastalığı için "doktorunuza danışın" uyarısı (ücretsiz, ilke denetimi 3). Ucuz hazırlık (ölçek kuralı): bugün profiller js/arayuz_profil.js'te sabit alanlar (PROF, LIFE/OTHER listeleri); diyet eklenmeden önce eşiklerini ve kaynağını taşıyan veri kaydına dönüşsün, yeni diyet eklemek kod değil veri eklemek olsun. Hesaplı kişisel kotalar Premium adayı (D-01) | ⬜ ileriki faz |

---

## 4. Önerilen sıra (bir sonraki iş)

> 08.10.2026: bulut oturumu kullanılmıyor; işler bu (yerel) oturumda yapılır. Bulut için yazılan barkod işi başlamadan kaldı; İngilizce tanıma (B-08) bitti.

1. ~~C-05 barkod~~ ✅ 15.10.2026 (kullanıcı kararıyla sıradan çıkarıldı; dört adım yayında).
   - Paralelde, ucuzken yapılacak önleyici işler (§9.1): 👤 O-01 alan adı, ~~O-02 küresel ad~~ ✅ 15.10.2026 (Umi), O-03 lisans kararları; ◐ O-04 hesap güvenliği (2FA ✅ 15.10.2026; kalan: organizasyon, şirket adına hesaplar), ~~O-08 bütçe uyarıları~~ ✅ 15.10.2026, ~~O-05 değişiklik kaydı~~ ✅ 13.10.2026, ~~O-06 cihaz verisi sürümü~~ ✅ 12.10.2026, ~~O-07 bağlantı denetimi~~ ✅ 12.10.2026.
   - C-05'ten hemen sonra: ~~O-22 katkıcı kimliği~~ ✅ 12.10.2026 → ~~G-01 rozetler~~ ✅ → ~~G-02 katkı ilerlemesi~~ ✅ 14.10.2026 → ~~G-04 topluluk hedefleri~~ ✅ 14.10.2026. G-03 ödülü D-01 kararını bekler.
2. A-02 besin değeri tablosu
3. C-01 👤 hesaplar → C-02 Android → C-04 cihaz içi okuma → **C-08 sayaç ve sınır denetimi**
4. ~~A-03 ölçüm~~ ✅ 16.10.2026 (sonuçlar /yonetim › Ölçüm)
5. B-05 ülke katmanı, B-03 İngilizce ana içerik
6. D-01 👤 gelir kararı → D-02
7. E-05 tetik gelince hukuki görüş → F-01 Türkiye lansmanı → F-03

20.10.2026, Lupa karşılaştırmasından öneri (👤 onay; sıra değişmedi): ~~A-08 küçük ve kaynaklı, araya alınabilir~~ ✅ 21.10.2026; ~~E-01 yöntem sayfasının B-02'yi beklemeden Türkçe ve İngilizce yazılması önerilir (Lupa'nın en güçlü güven aracı)~~ ✅ 21.10.2026. C-09 ve G-06 D-01 gelir kararıyla birlikte ele alınır; ~~U-09~~ ✅ 21.10.2026 (kullanıcı isteği, ücretsiz).

Sıra kullanıcı kararıyla değişebilir; değişince bu bölüm güncellenir.

---

## 5. Ölçütler

| Faz | İzlenecek |
|---|---|
| A–C | Günlük tarama, mod dağılımı, paylaşım oranı, 7 ve 30 gün sonra geri dönen kullanıcı oranı (A-03 ✅: /yonetim › Ölçüm), okuma başarısı (tanınma oranı) |
| D | Premium'a geçiş oranı (kıyas: Yuka Fransa %0,3, ABD %2), kullanıcı başına gelir, iptal oranı |
| E | Hata bildirimi sayısı ve çözülme süresi, değerlendirme değişikliği sayısı |
| F | Ülke ve dil başına kullanıcı, mağaza puanı, arama motorundan gelen trafik |
| G | Günlük katkı ve doğrulanma oranı, barkodla bulunma oranı, rozet kazananların geri dönüş oranı |

---

## 6. Kullanıcıdan beklenen kararlar ve işler

- 👤 Telefon testleri (A-01, sürekli)
- 👤 Geliştirici hesapları (C-01)
- 👤 Gelir modeli kararı (D-01)
- 👤 Şirketleşme (D-06)
- 👤 Danışma kurulu (E-04)
- 👤 Hukuki görüş, tetik gelince (E-05)
- 👤 Barkod kararı, C-05 ölçümünden sonra (CLAUDE.md'deki "barkod en sona, belki hiç" kararı bu ölçümle yeniden değerlendirilecek)
- 👤 Çeviri kontrolcüleri (B-06)
- 👤 Ver-al ödülünün türü ve oranı (G-03; öneri: tarama hakkı değil Premium günü)
- 👤 **Önleyici kararlar (§9.1, ucuzken):** alan adı (O-01), ~~küresel marka adı (O-02)~~ ✅ 15.10.2026 (Umi), depo ve veri lisansı (O-03), GitHub organizasyonu ve şirket adına hesaplar (O-04; 2FA ✅ 15.10.2026); ~~bulut bütçe uyarıları (O-08)~~ ✅ 15.10.2026

---

## 7. Riskler

| Risk | Önlem |
|---|---|
| Hukuki (yeni ülkelerde "zararlı" dili, ürün adı geçen paylaşım) | Kaynaklı, olasılık dili; E-05 tetiği; yöntem sayfası |
| Çeviri hatası 60 dilde katlanır | Ana içerik İngilizce (B-03), resmi çeviri önceliği, kontrol işareti (B-06) |
| Mevzuat bakımı her ülkede yük | Otomatik izleme (A-06), ülke katmanı veri olarak (B-05) |
| Tarama maliyeti ölçekle artar (Google Vision ~1,5 $ / 1.000 görüntü) | Cihaz içi okuma (C-04) |
| Barkodlu rakiplere göre yavaşlık | A-04, C-05 |
| Kişiye bağımlılık (bir mimar + Claude) | Belgeler güncel; büyüyünce insan geliştirici ve danışman (E-04) |
| Gelir baskısı ilkeyi aşındırır | §0 kuralları, Bağımsızlık sayfası (D-03), sözleşme maddesi (D-04) |
| Yerli rakiplerin hızlanması (Ürün Dedektörü 12 dilde; Lupa mağazada ve satışta, 20.10.2026) | Kaynak derinliği, kozmetik ve temizlik, barkodsuz etiket okuma, Bakanlık listesi ve çok ülkeli altyapı ile ayrışma; Türkiye gıda barkod kataloğunda kafa kafaya yarışılmaz (belgeler/rakipler/lupa.md §5) |
| Ölçekle büyüyen teknik ve hukuki engeller | §9 (öngörülen engeller ve önleyici işler) |

---

## 8. Rakip izleme (üç ayda bir güncellenir)

Son bakış: 08.10.2026 (genel); 20.10.2026 (Lupa, belgeler/rakipler/lupa.md). Yeni rakip incelemesi belgeler/rakipler/ altına yazılır.

| Rakip | Ne izlenir |
|---|---|
| Yuka | Ülke listesi (Türkiye eklenirse kritik), gelir (yuka.io/en/independence), yeni özellikler |
| Open Food Facts | Türkiye ürün sayısı (08.10.2026: ~11.500) |
| ÇabukBak, Ürün Dedektörü, Besin App | İndirme sayısı, dil sayısı, özellikler |
| Lupa | Katalog büyüklüğü, yeni dil ya da ülke, kozmetik/temizlik eklenmesi, Open Food Facts bağlantısı, Premium fiyatı ve içeriği, mağaza puanı |
| Olive, Fig, Bobby Approved | ABD'deki fiyatlama ve büyüme |
| CodeCheck, INCI Beauty, Think Dirty, EWG | Kozmetik ve temizlik kapsamı |
| Mevzuat | AB 2026/405 dijital ürün pasaportu takvimi; kozmetik için pasaport kararı |

Analizin kaynakları 08.10.2026 oturumunda toplandı: Yuka yardım ve bağımsızlık sayfaları, UPI, CBS, Fox News, Glossy, Sensor Tower, Osana, Olive, CodeCheck, INCI Beauty, Think Dirty, EWG, Open Food Facts, ÇabukBak, Ürün Dedektörü, REACH24H, SGS.

---

## 9. Öngörülen engeller ve önleyici işler (09.10.2026)

Amaç: bugün bir saatte yapılabilecek bir önlemin, iş büyüdükten sonra günler süren bir düzeltmeye dönüşmesini önlemek. Her satırda: engel, ne zaman ortaya çıkar, bugün yapılırsa maliyeti, geç kalınırsa maliyeti, önleyici iş. Liste her büyük adımda (yeni dil, yeni ülke, mağaza, gelir) yeniden gözden geçirilir; yeni öngörü eklenir.

Önem: 🔴 geri dönüşü zor ya da kullanıcı verisi kaybı · 🟠 maliyeti hızla büyür · 🟡 izlenmesi yeterli

### 9.1 Hemen (önümüzdeki birkaç hafta; mağazadan ve ilk kullanıcı tabanından önce)

| Kimlik | Önem | Engel | Ne zaman çıkar | Bugün | Geç kalınırsa | Önleyici iş |
|---|---|---|---|---|---|---|
| O-01 | 🔴 | **Alan adı.** Uygulama `burakkagancan-ux.github.io/umi` adresinde (15.10.2026'ya kadar `/tagsis`; eski adres yönlendirme deposuyla `/umi/`ye gider). Tarayıcı, kayıtlı ürünleri, tarama geçmişini ve profili **adrese bağlı** saklar; adres değişince kullanıcıların bütün verisi görünmez olur. Paylaşılan bağlantılar, mağaza sayfaları ve Worker izinleri de eski adrese bağlı kalır. | Kendi alan adına geçildiği gün | Alan adı al (yıllık ~10–15 $), GitHub Pages'e bağla, ALLOWED_ORIGIN'e ekle: ~1 saat | Kullanıcı verisinin taşınması için ayrı bir aktarma akışı, kırık bağlantılar, mağaza güncellemesi: günler | 👤 Alan adı kararı ve satın alma → Claude bağlar; eski adres yeni adrese yönlenir |
| O-02 | 🔴 | **Küresel marka adı.** "Tağşiş" Türkçe dışında okunmuyor, yazılamıyor (ğ, ş), anlamı yalnızca Türkçede var. Mağaza adı, alan adı, sosyal medya hesapları ve marka tescili sonradan değişirse kullanıcı ve bağlantı kaybı olur. | Mağazaya çıkış ve ilk yurtdışı pazar | Ad kararı + alan adı ve hesapların ayrılması + Türkpatent/EUIPO ön araştırması | Mağazada yeniden adlandırma, yeni hesaplar, karışan kullanıcılar | 👤 Küresel ad kararı (Türkiye'de "Tağşiş" kalabilir, uluslararası ad ayrı olabilir); Claude ad uygunluğu ve çakışma araştırması yapabilir. ✅ 15.10.2026 (kullanıcı kararı): ad **Umi** (kızı Umay'ın kısaltması; Japonca "deniz", Arapça "annem"). Uygulama adı, paylaşım kartı, depo adı (burakkagancan-ux/umi) değişti; eski /tagsis/ adresi yönlendirme deposuyla /umi/'ye gider. Bakanlık listesindeki "taklit/tağşiş" hukuki terim olduğu için kaldı; iç tanıtıcılar (data/tagsis.json, tagsis_raw, D1 tagsis-urunler, önbellek adı) bilerek değişmedi. Ön araştırma: aynı alanda uygulama ya da AB markası bulunmadı; ABD'de "UMI" (Umi Care, 99751782, sağlık ve beslenme veritabanı) başvurusu var; umi.com, umi.app alınmış. Kalan: Türkpatent/EUIPO/TMview resmi taraması, alan adı (O-01) |
| O-03 | 🔴 | **Depo herkese açık ve lisanssız.** Elle, kaynakla hazırlanmış veri (333 ansiklopedi sayfası, renk ölçütleri, eş anlamlılar) bizim asıl değerimiz; herkes indirebiliyor. Lisans yazılı olmadığı için hukuken "tüm hakları saklı", ama koruma ve kullanım koşulları belirsiz. Sonradan kapatmak, yayılmış kopyaları geri almaz. | Rakiplerin ilgisi ya da veri satışı (D-04) gündeme gelince | Karar: kod ve veri için ayrı lisans (ör. kod açık, veri "tüm hakları saklı" ya da CC BY-NC); README'ye yazmak | Kopyalanmış veri geri alınamaz; B2B lisans pazarlığı zayıflar | 👤 Lisans kararı (Claude seçenekleri yazar). Not: GitHub Pages ücretsiz planda depo açık olmalı; depo gizlenirse barındırma Cloudflare Pages'e taşınır (ücretsiz). **09.10.2026 (kullanıcı kararı):** ilk adım yapıldı: LICENSE "tüm hakları saklıdır" (üçüncü taraf verisi kendi lisansında), README'de Lisans bölümü. Kalan: depoyu gizlemek (O-01 alan adı + Cloudflare Pages taşımasıyla birlikte, ya da GitHub Pro); ODbL "paylaşımda aynı lisans" koşulunun OFF'tan türeyen eş anlamlılara etkisi hukuki görüşte (E-05) sorulacak |
| O-04 | 🔴 | **Hesaplar kişisel e-postada.** GitHub, Cloudflare, Google Cloud, ileride mağaza hesapları tek kişiye bağlı. Hesap kilitlenirse ya da şirket kurulunca devir zahmetli. | Şirketleşme, ekip, para akışı | İki aşamalı doğrulama + kurtarma kodları; GitHub organizasyonu açıp depoyu taşımak (bağlantılar otomatik yönlenir) | Mağaza hesabı devri haftalar sürer; Apple/Google şirket doğrulaması ayrıca | 👤 2FA ve kurtarma kodları; mağaza hesapları baştan şirket adına (D-06). ◐ 15.10.2026 (kullanıcı): Google, GitHub ve Cloudflare hesaplarında 2FA açık. Kalan: GitHub organizasyonu, mağaza ve alan adı hesaplarında 2FA (açıldıkları gün), şirket adına hesaplar (D-06) |
| O-05 | 🟠 | **Değerlendirme değişiklik kaydı.** Yöntem sayfası ve "neden değişti" sorusu (E-02) için her renk değişikliğinin tarihi ve kaynağı gerekiyor. Şu an bu bilgi PR'lara ve CLAUDE.md'ye dağınık. | Yöntem sayfası, ilk şikâyet ya da hukuki soru | Makinece okunur bir kayıt (kaynak/degisiklik_kaydi.tsv: tarih, kimlik, eski → yeni, gerekçe, kaynak) + veride renk değişirse kaydı zorunlu kılan test: ~2 saat; geçmiş 20–30 değişikliği şimdi doldurmak kolay | Aylar sonra git geçmişinden yeniden çıkarmak: günler, eksik kalır | Claude ✅ 13.10.2026: `kaynak/degisiklik_kaydi.tsv` (tarih, tür, kimlikler, eski → yeni, gerekçe, kaynak, PR) + `kaynak/renk_anlik.tsv` (2.480 maddenin bugünkü rengi) + `degisiklik_kaydi.py` (CI: veri anlık dosyadan farklıysa ve farkın kayıt satırı yoksa düşer; `--guncelle` yalnızca her fark kayıttaysa yazar). Geçmiş git'ten çıkarıldı: PR #18–#105, 29 satır, 87 madde değişikliği (ilk kurulum PR'ları hariç). Aylık CosIng PR'ı denetim sonucunu açıklamasına yazar (bot PR'ında Testler çalışmaz). Kozmetik kimlikleri ek/numara olduğu için yeniden numaralamada kimlik değişikliği de satır ister. |
| O-06 | 🟠 | **Cihazdaki kullanıcı verisinin sürümü.** localStorage'daki kayıtlarda (kayitli, taramalar, profil) şema sürümü yok. Yapı değişince ya da mağaza uygulamasına geçince eski veri okunamayabilir. Ayrıca web'deki veri mağaza uygulamasına kendiliğinden geçmez. | Veri yapısı değişikliği, mağaza sürümü | Her kayda `v` alanı + açılışta sürüm yükseltme işlevi + testi: ~2 saat. Yedek dosyası zaten var (aktarma yolu). | Bozuk kayıtlar, kullanıcı şikâyeti, tek tek göç kodu | Claude ✅ (12.10.2026: kayıt başına `v` yerine tek sürüm anahtarı `veri_surum`; js/veri_surum.js her sayfada ilk betik, açılışta VERI_GOC adımlarını sırayla uygular, daha yeni sürümün verisine dokunmaz; bütün anahtarların listesi VERI_ANAHTAR, test kodda listede olmayan anahtarı yakalar; mağazaya aktarma yolu yedek dosyası) |
| O-07 | 🟠 | **Kaynak bağlantılarının çürümesi.** Binlerce kaynak bağlantısı (EUR-Lex, EFSA, PMC…) zamanla taşınıyor ya da kırılıyor; ilkemiz kaynağa dayalı olduğu için kırık bağlantı güveni zedeler. | Sürekli; birikerek | Aylık bağlantı denetimi (GitHub Actions; kırık listesi issue olarak) + önemli kaynaklar için Wayback arşiv bağlantısı | Yüzlerce kırık bağlantıyı bir anda düzeltmek | Claude ✅ 12.10.2026: `baglanti_denetle.py` + `.github/workflows/baglanti.yml` (her ayın 15'i; kırık varsa "Kırık kaynak bağlantıları" sorunu). İlk denetim: 693 bağlantı, 3 kırık (temizlik SDS/EUH kaynakları; aynı PR'da SEA'nın resmi metniyle değiştirildi), ~180 şüpheli (çoğu EFSA/doi.org/DOAJ bot engeli 403, eCFR 429). Wayback ✅ 20.10.2026: kırık bağlantının yanına son sağlam arşiv kopyası yazılıyor (kaynak verisine kendiliğinden yazılmaz; düzeltme elle). |
| O-08 | 🟠 | **Bulut maliyet ve kötüye kullanım koruması.** Worker herkese açık; ALLOWED_ORIGIN tarayıcı dışı istemcileri durdurmaz. Google Vision anahtarı kötüye kullanılırsa fatura çıkar. D1 katkılarına sahte veri girilebilir. | Uygulama duyulunca | Google Cloud'da bütçe uyarısı + günlük kota (kota düşürülmüştü, bütçe uyarısı kontrol edilmeli); Cloudflare'de Worker kullanım uyarısı; D1 katkıları için basit inceleme sayfası (TEKNIK_BORC.md) | Sürpriz fatura, kirli veritabanı | 👤 Bütçe uyarıları (Claude adım adım tarif eder); Claude inceleme sayfası. ✅ 15.10.2026 (kullanıcı): Google Cloud bütçe uyarısı, Vision kotası ve anahtar kısıtlaması, Cloudflare planı denetlendi; inceleme sayfası 14.10.2026'da yapıldı (Worker /yonetim). ◐ 19.10.2026 (arka uç incelemesi): topluluk doğrulamasında katkı izi (IP + barkoddan gizli anahtarlı özet, IP saklanmaz; aynı ağdan katkı doğrulamaz, barkod başına ağdan en çok 2), aynı kimlik barkodda tek satır, yönetimde silme geri alınabilir (İşlem Kaydı, 90 gün). Kalan: farklı ağlardan (VPN) gelen saldırgana karşı Cloudflare Turnstile ve mağaza sürümünde Play Integrity / App Attest; 7 günden uzun D1 yedeği (kullanıcı kararı 19.10.2026: şimdilik Time Travel 7 gün yeter; kullanıcı sayısı artınca ya da mağaza öncesi haftalık dışa aktarım gizli depoya) |
| O-22 | 🔴 | **Katkıcı kimliği yok.** D1 `katki` tablosunda yalnızca {kod, tur, dil, metin, t} var; kimin eklediği bilinmiyor. Rozet, "Katkılarım" ve ver-al ödülü (G-01–G-03) geldiğinde o güne kadarki katkılar kimseye yazılamaz; ilk ve en değerli katkıcılar ödülsüz kalır. | Faz G başladığı gün | Cihazda bir kez üretilen rastgele takma kimlik (kişisel bilgiden türetilmez), katkıyla birlikte gönderilir; `katki` tablosuna `kim` sütunu (ALTER TABLE, boş olabilir); gizlilik notuna bir satır; yedek dosyasına girer: ~2 saat | Geçmiş katkılar geri dönüp sahiplendirilemez; kullanıcı güveni | Claude: bir sonraki barkod/Worker PR'ında ✅ (12.10.2026: `kim` sütunu, cihazda rastgele kimlik, yedek dosyasında, gizlilik notunda; aynı kimlik kendi katkısını doğrulayamaz) |
| O-09 | 🟡 | **Dağınık kaynak dili.** Yeni içerik Türkçe yazıldıkça çevrilecek metin birikiyor (bugün 1.164 veri + 4.038 ansiklopedi metni). | Her yeni dilde | Bundan sonra yazılan yeni içerik İngilizce anahtarla da girer (B-03'ün "yeni içerik" kısmı hemen başlar) | Her dil için katlanan çeviri | Claude: kural CLAUDE.md'de |

### 9.2 Yakın (4. dilden, 2. ülkeden ya da mağazadan önce)

| Kimlik | Önem | Engel | Tetik | Önleyici iş |
|---|---|---|---|---|
| O-11 | 🟠 (09.10.2026: ülke ayarı #105) | **Türkiye'ye gömülü kod.** TGK, Bakanlık listesi, `tr` durum alanları, UZEM, "In Türkiye" metinleri kodda Türkiye'yi varsayıyor. | 2. ülke | B-05 ülke katmanı, 2. ülkeden önce. Yeni Türkiye'ye özgü bilgi bugünden ülke anahtarıyla eklenir. |
| O-12 | ◐ 15.10.2026 (kaynak dil İngilizce: kullanıcı kararı, veri çevirisi buna göre; kalan: platform seçimi, lisans kararına bağlı) | **Çeviri yönetimi.** 60 dil × ~700 arayüz anahtarı + veri metinleri elle JSON düzenlenerek yönetilemez. | 3.–4. dil | Çeviri platformu (açık kaynaklara ücretsiz Weblate ya da Crowdin); bugünkü düz anahtarlı JSON biçimi buna uygun, değiştirilmez. Terim sözlüğü (i18n/sozluk.md) platformun sözlüğüne aktarılır. Çevirmenin kaynak dili İngilizce (15.10.2026): Türkçe → İngilizce → diğer diller; veri çevirisinin bayatlığı İngilizceye göre denetlenir. Not: Weblate/Crowdin ücretsiz planı açık kaynak lisansı ister, depo "All rights reserved"; seçenekler: ücretli plan, kendi sunucumuzda Weblate ya da lisans değişikliği (kullanıcı kararı). |
| O-13 | 🟠 | **Mobil uygulamada veri güncellemesi.** Veri uygulamanın içine gömülürse her bilgi düzeltmesi mağaza onayı bekler. | C-02 | Uygulama verinin bir kopyasıyla gelir, açılışta sitemizden güncelini çeker (bugünkü önbellek mantığı). Veri sürüm numarası + uyumluluk denetimi. |
| O-14 | 🟠 | **Mağaza gereksinimleri.** Gizlilik politikası, Google "veri güvenliği" formu, Apple gizlilik etiketleri, yaş sınıflandırması; Apple sağlık bilgisi veren uygulamalarda kaynak ve sorumluluk reddi ister. | C-02, C-03 | E-06 metinleri mağazadan önce; bugünkü gizlilik notları ve sorumluluk reddi temel alınır. Veri toplama listesi (sayaç, barkod katkısı) güncel tutulur. |
| O-15 | ◐ 15.10.2026 (çakışma denetimi; saf mantık ES modülü, U-07 4. adım; arayuz.js bölündü, U-07 6. adım; kalan: arayüz dosyalarının modüle geçişi, tetik C-02 paketleyici) | **Arayüz kodunun büyümesi.** 20'den fazla betik, ortak global değişkenler, yükleme sırası önemli. Büyüdükçe çakışma ve hata riski artar. | Mağaza sürümü ya da ikinci geliştirici | Saf mantık ayrımı korunur (testler bunu kullanıyor); sozdizimi testi global ad çakışmalarını da denetler. Gerekirse mağaza sürümünden önce modül yapısına geçiş, tek PR'da. |
| O-23 | ◐ 14.10.2026 (porsiyon çevirme ve ABD/Kanada adları yapıldı; kalan: eşiklerin ülke katmanı, Latin dışı alfabe adları) | **Besin tablosu yalnızca "100 g / 100 ml" sütununu okuyor.** ABD (FDA) ve Kanada etiketlerinde 100 g sütunu yok, değerler porsiyon başına ve sodyum mg; ayrıştırıcı bunları "100 g başlığı yok" diye şüpheli sayar. Satır adları 7 Latin alfabeli dilde (tr, en, de, fr, it, es, nl). | ABD/Kanada pazarı ya da Latin dışı alfabeli dil | Porsiyon büyüklüğünden 100 g'a çevirme (porsiyon gramı okunursa), eksik ABD satır adları (Total Sugars, Calories) ve eşiklerin ülke katmanı (B-05). Yeni dilin satır adları kaynak/besin_adlari.tsv'ye; kod değişmez (eşleşme \p{L} ile her alfabede). |
| O-17 | 🟡 | **Düşük donanımlı telefonda hız.** Eş anlamlı sözlükleri ve benzer yazım araması büyüdükçe analiz yavaşlar. | Yeni dillerin eş anlamlıları | Hız bütçesi testi (temizlik testindeki gibi): 30 etiketlik sette analiz süresi sınırı. |

### 9.3 Uzak (gelir ve küresel ölçek)

| Kimlik | Engel | Tetik | Önleyici iş |
|---|---|---|---|
| O-18 | **Hesap ve cihazlar arası eşitleme.** Ücretli kullanıcı birden çok cihaz ister; hesap yok. | D-02 | Hesapsız eşitleme seçenekleri (ör. şifreli yedek bağlantısı) önce değerlendirilir; hesap gerekiyorsa KVKK/GDPR ve veri yeri (AB) baştan seçilir. |
| O-19 | **Uygulama içi satın alma ve vergi.** Ülkelere göre KDV, mağaza komisyonu, fatura. | D-02 | Satışı mağaza üzerinden yapmak (vergiyi mağaza yönetir); web'de ödeme sonraya. |
| O-20 | **Bilgi bakım yükü.** 20 ülkede mevzuat takibi tek kişiyle sürdürülemez. | 3. ülke | Otomatik izleme (A-06) her ülke eklenirken kurulur; ülke başına "bakım sahibi" (danışman). |
| O-21 | **Ürün veritabanının kalitesi.** Kullanıcı katkısı büyüdükçe yanlış ya da kötü niyetli kayıt. | Katkı sayısı ~1.000 | ◐ 14.10.2026: inceleme sayfası (Worker /yonetim, anahtarla) ve çelişen katkı listesi yapıldı. Kalan: gerekirse güvenilir katkıcı mantığı; moderatör ekibi gelince sayfanın çevirisi ve kişi başına anahtar (bugün tek anahtar). |
| O-27 | Orta | **Besin tablosu metin sırasına dayanıyor.** Google Vision tabloyu çoğu zaman sütun sütun ya da karışık sırayla veriyor; ayrıştırıcı bu düzenleri tek tek kuralla yakalıyor (34 gerçek etikette yalnızca 14'ünde renk gösterilebiliyor, bkz. TEKNIK_BORC.md). Her yeni dil ve etiket düzeni yeni kural ister. | İkinci dil pazarı ya da A-04 fotoğraf okuma kalitesi işine başlarken | Worker Vision yanıtındaki sözcük kutularını (koordinat) da döndürür; tablo satır/sütun konumundan kurulur, metin sırası kuralları yedek kalır. Ölçüt: test/olcum_besin.js'te renk gösterilen etiket sayısı artar, yanlış renk 0 kalır. 21.10.2026: 1. adım, Worker `kutu: true` ile sözcük kutularını döndürüyor (worker/README.md); sıradaki: ölçüm setini kutularla yeniden okutmak, ayrıştırıcı. |

### 9.4 Kural
- Her PR'da 6. ilke sorusu (ölçek denetimi) yanıtlanır.
- Bu bölüm her büyük adımda (yeni dil, yeni ülke, mağaza, gelir, kullanıcı sayısında 10 kat artış) yeniden gözden geçirilir; kapanan satırın durumu yazılır, yeni öngörü eklenir.
- 👤 işaretli kararlar beklerken ilgili teknik iş başlamaz; ama Claude kararın seçeneklerini ve maliyetini önceden hazırlar.
