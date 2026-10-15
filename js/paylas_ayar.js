/* Paylaşılabilir sonuç kartı: ayarlar. Uygulama adı ve adres yalnızca buradan okunur; slogan ve not dil dosyasında (pay.slogan, pay.not).
   Özelliği kapatmak için acik:false yapın; sonuç ekranındaki paylaş düğmesi görünmez. */
import {t} from "./ceviri.js";
export var PAYLAS_AYAR={
  acik:true,
  uygulamaAdi:"Umi",                                       // marka adı (O-02, 15.10.2026); yalnızca burası değişir
  adres:"https://burakkagancan-ux.github.io/umi/",         // mağaza bağlantısı olunca burası değişir
  get slogan(){return t("pay.slogan")},
  get not(){return t("pay.not")},
  logo:"icon-192.png",
  enFazlaMadde:3,          // kartta gösterilen en riskli madde sayısı (yerleşimde enFazlaMadde varsa o geçerli)
  enFazlaKisisel:2,        // "Kişisel uyarılarımı ekle" açıkken en fazla satır
  sayac:"/sayac",          // anonim paylaşım sayacı: OCR Worker adresine eklenir; boş bırakılırsa sayılmaz
  boyut:"hikaye",          // kart her zaman hikâye genişliğinde (1080), en az 1920 yüksekliğinde çizilir
  yerlesim:{               // yeni boyut buraya bir kayıt olarak eklenir; birden fazla kayıt olursa paylaşım ekranında seçici çıkar
    // bant: alttaki ince uygulama bandının yüksekliği (eski büyük bant 240 idi; boşalan yer içeriğe verildi)
    // hepsi + oto (14.10.2026, kullanıcı isteği: "dikkat ve uyarı gerektiren maddelerin hepsi gözüksün, sabit boyut olmasın"): bütün riskli maddeler
    // kartta; kart en az h (1080x1920), içerik sığmazsa enBoy'a kadar uzar (telefon tarayıcılarının canvas alanı sınırının altında kalır).
    // enBoy'a da sığmazsa eski kural: madde satırı azalır, "+N madde daha".
    hikaye:{get etiket(){return t("pay.boyut.hikaye")},w:1080,h:1920,pad:80,ad:84,adSatir:2,sayi:104,madde:44,maddeSatir:132,bant:120,hepsi:true,oto:true,enBoy:8000}
  }
};
