# Terim sözlüğü (çeviri)

Her dilde aynı kavram aynı terimle yazılır. Yeni dil eklenirken bu tabloya o dilin sütunu eklenir; çeviri dosyası (i18n/<kod>.json) bu terimlere uyar.
İngilizce: AB resmi metinlerinin yazımı (İngiliz İngilizcesi: colour, flavouring, analyse, authorisation).

## Dil ilkeleri (her dilde)

- Mevzuat ve bilim dili: olasılık bildirilir ("may cause", "has been reported"); kesin hüküm yok.
- "Güvenli / safe", "zararsız / harmless", "zararlı / harmful", "sağlıklı / healthy", "uygun / suitable" (onay anlamında) kullanılmaz. Bulunamayan şey için "bulunamadı, bu bir onay değildir" (EN: "not found; this is not an approval").
- Skor, puan, not, yıldız yok.
- Kaynak her zaman görünür (kurum, yıl, yönetmelik numarası çevrilmez: EFSA 2017, (EC) No 1272/2008).
- Türkiye'ye özgü bilgi (Bakanlık listesi, TGK, SEA Yönetmeliği, UZEM) açıkça "Türkiye'de / In Türkiye" diye işaretlenir (anahtarlar `ulke.tr.*`); ülke ayarı ayrı iş.
- Resmi karşılığı olan metin çeviriden önce gelir: CLP H/EUH/P ifadeleri (Ek III/IV), E kodu adları (`name_en`), INCI adları (çevrilmez), CosIng işlev adları, AB 1169/2011 Ek II alerjen adları, AB 1333/2008 Ek I işlev sınıfları, AB 648/2004 Ek VII deterjan içerik grupları ve yüzde bantları.

## Terimler

| Türkçe | İngilizce | Not |
|---|---|---|
| Özel uyarı yok | No specific warning | Risk seviyesi 0; gri tire simgesi. "Safe" değil. |
| Dikkat | Caution | Risk seviyesi (sarı üçgen). |
| Uyarı | Warning | Risk seviyesi (koyu turuncu ünlem). |
| Durum doğrulanmadı | Status not verified | |
| Ciddi tehlike | Serious hazard | Temizlik, CLP'nin ciddi sınıfları. |
| Bilgi | Information | Temizlik, bilgi düzeyi. |
| AB'de yasak | Banned in the EU | Kozmetik Ek II. |
| Başka ülkede yasak | Banned in another country | |
| Uyarı kelimesi | Signal word | CLP. |
| TEHLİKE / DİKKAT (uyarı kelimesi) | DANGER / WARNING | CLP'nin resmi uyarı kelimeleri; risk seviyesi "Dikkat" (Caution) ile karıştırılmaz. |
| Tehlike ifadesi (H, EUH) | Hazard statement | CLP Ek III. |
| Önlem ifadesi (P) | Precautionary statement | CLP Ek IV. |
| Katkı maddesi | Additive | |
| Bileşen | Ingredient | Gıda ve kozmetik listesindeki öğe. |
| Madde | Substance | |
| İçerik listesi / İçindekiler | Ingredient list / Ingredients | |
| Kabul edilebilir günlük alım (ADI) | Acceptable daily intake (ADI) | |
| Haftalık kabul edilebilir alım (TWI) | Tolerable weekly intake (TWI) | |
| Günlük sınır | Daily limit | ADI'nin kiloya göre karşılığı. |
| Üretim yolu | Production method | Sentetik = Synthetic, İşlenmiş = Processed, Fermentasyonla üretilir = Produced by fermentation. |
| Birlikte dikkat | Caution in combination | |
| Kanserojen olabilecek madde | Substance that may be carcinogenic | IARC: Grup 2A "probably", 2B "possibly carcinogenic". |
| Endokrin bozucu şüphesi | Suspected endocrine disruptor | "Şüphe / aday" dili korunur. |
| Koku alerjeni | Fragrance allergen | |
| Koruyucu | Preservative | |
| Formaldehit salıcı | Formaldehyde releaser | |
| Gözenek tıkayıcı olabilir | May clog pores | Bilgi notu; skor yok. |
| Durulanan / Durulanmayan | Rinse-off / Leave-on | |
| Profilim | My profile | Arayüzde tek ad; "Hassasiyetlerim" kullanılmaz (14.10.2026). |
| Kişisel uyarılar | Personal alerts | |
| Bu bir onay değildir | This is not an approval | |
| Karşılaştır | Compare | Karar dili: "içerik açısından daha iyi görünüyor" = "looks better in terms of ingredients". |
| Kaydet / Kaydedildi | Save / Saved | |
| Paylaş | Share | |
| Tarama N | Scan N | Otomatik ad; dil değişse de eski adlar tanınır (histOtoNo). |
| Henüz çevrilmedi | Not yet translated | Veri metninin yanındaki işaret. |
| Etiket Oku | Read Label | Sayfa adı. |
| Analiz Et | Analyse | |
| Ürün Avcısı | Product Hunter | Ürün ekleyen kullanıcının rozeti. Kullanıcının ürün eklemesi için "katkı / katkıcı" denmez: uygulamada "katkı" katkı maddesi (uyarı) çağrıştırır (kullanıcı kararı 14.10.2026). Arayüzde "ürün ekle / eklediklerim". |
| Rozet / Rozetlerim | Badge / My badges | Kullanıcının yaptığına verilir, ürüne değil (G-01). |
| Okur · Etiket Dedektifi · Öncü · Doğrulayıcı | Reader · Label Detective · Pioneer · Verifier | Rozet aileleri; kademe adları i18n rozet.<aile>.k1–k8. |
| Yeni rozet | New badge | Kutlama kartı ve paylaşım kartı başlığı. |
| Okumadıklarım | Not read yet | Ansiklopedi süzgeci. |
| Eklediklerim | Products I added | Barkodla eklenen ürünler ekranı (G-02). |
| Doğrulandı / Doğrulanmayı bekliyor | Verified / Awaiting verification | Eklenen ürünün durumu. |
| Topluluk | Community | Ortak hedef ve eksik ürünler ekranı (G-04). |
| Ortak hedef | Shared goal | Herkesin doğrulanmış ürünlerinin toplamı; kişisel sıralama yok. |
| Aranan ama henüz içeriği olmayan ürünler | Wanted products without ingredients yet | "Eksik ürünler" listesi. |
| Bu ürün elimde | I have this product | Listeden barkodu Etiket Oku'da açar. |
