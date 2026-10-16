/* Cihazdaki kullanıcı verisinin şema sürümü (YOL_HARITASI.md O-06): saf mantık (DOM yok); testler de yükler.
   localStorage'daki bütün kayıtlar tek bir sürüm numarasıyla ("veri_surum") işaretlenir. Sayfa açılırken, başka hiçbir betik
   veriyi okumadan önce veriGoc çalışır: kayıtlı sürüm eskiyse VERI_GOC'taki adımlar sırayla uygulanır ve sürüm yazılır.
   Veri yapısı değişince: VERI_SURUM +1, VERI_GOC'a yeni adım (n-1'den n'e), test/veri_surum.js'e eski biçimden örnek.
   Yedek dosyasının kendi sürümü var (js/kayit.js kayitYedek "surum"); eski yedekler geri yüklenirken kayitGeriYukle'de dönüştürülür. */
var VERI_SURUM=1;
/* Uygulamanın localStorage'da tuttuğu anahtarlar ve biçimleri (mağaza uygulamasına aktarma ve göç için tek liste).
   dizi/nesne: JSON; yazi: düz metin */
var VERI_ANAHTAR={
  kayitli:"dizi",      // kaydedilen ürünler (js/kayit.js)
  taramalar:"dizi",    // tarama geçmişi, karşılaştırma için (js/arayuz_karsilastir.js)
  yerimleri:"dizi",    // ansiklopedide kaydedilen maddeler (js/arayuz_ansiklopedi.js)
  profil:"nesne",      // hassasiyetler (js/arayuz.js)
  kayit_suz:"nesne",   // kayıt listesinin süzgeci ve sırası
  aranan:"dizi",       // bu cihazdan "aranıyor" diye bildirilen barkodlar, bir kez sayılsın diye (js/arayuz_topluluk.js, G-04)
  besin_elle:"dizi",   // elle düzeltilen besin değeri tabloları, metne bağlı (js/arayuz_besin.js)
  rozetler:"nesne",    // rozet sayımı (G-01, js/rozet.js; kendi şema sürümü "v": ROZET_SURUM, rozetNorm okurken doğrular)
  dil:"yazi",ulke:"yazi",tur:"yazi",ktip:"yazi",pay_boyut:"yazi",
  barkod_katki:"yazi",katkici:"yazi",   // barkod katkı izni ve katkıcı kimliği (O-22)
  ans_tur:"yazi",   // ansiklopedide seçili tür (gida/tem)
  tema:"yazi",      // görünüm seçimi: acik | koyu; yoksa telefona göre (js/tema.js)
  olcum:"nesne"     // ölçüm durumu: ilk kullanım günü, son sayılan gün, kapalı mı (A-03, js/olcum.js); yedeğe girmez
};
/* Göç adımları: VERI_GOC[n] verisi n-1 sürümünde olan depoyu n sürümüne getirir. depo: {getItem, setItem, removeItem} */
var VERI_GOC={
  /* 0 → 1 (sürümsüz veri): yapısı bozuk JSON kayıtları silinir (her okuyan zaten boş sayıyordu); eski liste önbelleği kaldırılır */
  1:function(depo){
    Object.keys(VERI_ANAHTAR).forEach(function(k){
      var tur=VERI_ANAHTAR[k];if(tur==="yazi")return;
      var s=depo.getItem(k);if(s==null)return;
      var v;try{v=JSON.parse(s)}catch(e){v=undefined}
      var gecerli=tur==="dizi"?Array.isArray(v):!!v&&typeof v==="object"&&!Array.isArray(v);
      if(!gecerli)depo.removeItem(k);
    });
    depo.removeItem("tagsis_raw");
  }
};
/* Kayıtlı sürüm: yoksa 0 (bu iş öncesi veri). Sayı değilse 0 sayılır. */
function veriSurumu(depo){var v=parseInt(depo.getItem("veri_surum"),10);return v>=0?v:0}
/* Sonuç: {once, simdi, adim: uygulanan adım sayısı, ileri: veri bu sürümden yeni (dokunulmaz)} */
function veriGoc(depo,hedef){
  hedef=hedef||VERI_SURUM;
  var once=veriSurumu(depo),v=once;
  // Daha yeni bir sürümün yazdığı veri (ör. önbellekten eski sayfa açıldı): bozmamak için dokunulmaz
  if(once>hedef)return {once:once,simdi:once,adim:0,ileri:true};
  while(v<hedef){
    var f=VERI_GOC[v+1];if(!f)break;
    try{f(depo)}catch(e){break}   // adım yarıda kalırsa sürüm yazılmaz; bir sonraki açılışta yeniden denenir
    v++;depo.setItem("veri_surum",String(v));
  }
  return {once:once,simdi:v,adim:v-once,ileri:false};
}
// Tarayıcıda yüklenir yüklenmez çalışır (node testlerinde window yok)
if(typeof window!=="undefined")try{var _d=depoArka();if(_d)veriGoc(_d)}catch(e){}   // arka uç js/depo.js
