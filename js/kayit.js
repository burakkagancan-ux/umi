/* Kaydedilen ürünler: saf mantık (DOM yok); testler de yükler. Kayıtlar yalnızca bu cihazda (localStorage "kayitli").
   Kayıt: {id, t (kayıt zamanı), u (son güncelleme), mode: gida|koz|tem, name, note, text, oz: özet, besin?: gıdada besin değeri tablosu}
   besin (js/besin.js besinKayitNorm): kaydederken ekranda gösterilen tablonun kaynağıyla kopyası (barkoddan, okunan etiketten ya da elle);
   kayıt açılınca, karşılaştırmada ve yedekten geri yüklenince tablo bununla geri gelir.
   Özet (oz): kaydederken ve her açılışta hesaplanır; listede veri yüklemeden göstermek ve değerlendirme değişince haber vermek için.
   {u: uyarı sayısı, d: dikkat sayısı, top: en riskli en çok 3 ad} — karşılaştırmadaki ürün özetinden (rank 3 uyarı, rank 2 dikkat). */
var KAYIT_AYAR={enFazla:100};
var KAYIT_TUR={gida:"kayit.tur.gida",koz:"kayit.tur.koz",tem:"kayit.tur.tem"};   // geçerli türler ve ad anahtarları
function kayitOzet(P){
  return {u:P.counts[3]||0,d:P.counts[2]||0,top:P.items.filter(function(it){return it.rank>=2}).slice(0,3).map(function(it){return it.name})};
}
/* Aynı tür + aynı metin tek kayıttır: yeniden kaydedince ad, not ve özet güncellenir, kayıt başa geçer */
function kayitAdd(list,e,max){
  var tx=(e.text||"").trim();if(!tx||!KAYIT_TUR[e.mode])return (list||[]).slice();
  var old=(list||[]).filter(function(x){return x.mode===e.mode&&(x.text||"").trim()===tx})[0];
  var n={id:old?old.id:e.id,t:old?old.t:e.t,u:e.t,mode:e.mode,name:(e.name||"").trim()||(old&&old.name)||t("kayit.adsiz"),note:(e.note||"").trim(),text:tx,oz:e.oz||(old&&old.oz)||null};
  var bs=e.besin!==undefined?e.besin:old&&old.besin;if(bs&&e.mode==="gida")n.besin=bs;   // undefined: eskisi korunur, null: silinir
  var out=(list||[]).filter(function(x){return x!==old});out.unshift(n);
  return out.slice(0,max||KAYIT_AYAR.enFazla);
}
function kayitFind(list,mode,text){var tx=(text||"").trim();return (list||[]).filter(function(x){return x.mode===mode&&(x.text||"").trim()===tx})[0]||null}
/* Liste: tür süzgeci, ad/not araması (Türkçe harf duyarsız), sıralama (yeni | ad | risk) */
function kayitFold(s){return String(s||"").replace(/İ/g,"i").replace(/I/g,"ı").toLowerCase().replace(/[çğıöşü]/g,function(c){return {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u"}[c]})}
function kayitList(list,mode,q,sira){
  var f=kayitFold(q).trim();
  var out=(list||[]).filter(function(x){return (!mode||x.mode===mode)&&(!f||kayitFold(x.name+" "+(x.note||"")).indexOf(f)>-1)});
  if(sira==="ad")out.sort(function(a,b){return dilKarsilastir(a.name,b.name)});
  else if(sira==="risk")out.sort(function(a,b){var oa=a.oz||{u:0,d:0},ob=b.oz||{u:0,d:0};return ob.u-oa.u||ob.d-oa.d||(b.u||b.t)-(a.u||a.t)});
  else out.sort(function(a,b){return (b.u||b.t)-(a.u||a.t)});
  return out;
}
function kayitSay(list){var o={"":0,gida:0,koz:0,tem:0};(list||[]).forEach(function(x){o[""]++;if(o[x.mode]!=null)o[x.mode]++});return o}
/* Kaydedildiğinden bu yana değerlendirme değişti mi? (veri güncellemesi, ör. bir maddenin rengi değişti). Değişiklik yoksa null. */
function kayitFark(eski,yeni){
  if(!eski||!yeni)return null;
  if(eski.u===yeni.u&&eski.d===yeni.d)return null;
  var s=function(o){return t("kayit.fark_say",{u:o.u,d:o.d})};
  return {once:s(eski),simdi:s(yeni),kotu:yeni.u>eski.u||(yeni.u===eski.u&&yeni.d>eski.d)};
}
/* Yedek dosyası: {uygulama:"tagsis", tur:"kayitli", surum:1, kayitlar:[...], katkici?, rozetler?}. Geri yüklerken yalnızca geçerli kayıtlar alınır; var olanlarla birleştirilir.
   katkici: barkod katkıcı kimliği (O-22); cihaz ya da adres değişince katkılar aynı kişiye yazılmaya devam etsin diye. Doğrulaması arayüzde (katkiciGecerli).
   rozetler: rozet sayımı (G-01, js/rozet.js); geri yüklenince bu cihazdakiyle birleşir (rozetBirlestir). Eski yedekte yoktur. */
function kayitYedek(list,now,katkici,rozetler){
  var d={uygulama:"tagsis",tur:"kayitli",surum:1,tarih:now||Date.now(),kayitlar:list||[]};if(katkici)d.katkici=katkici;if(rozetler)d.rozetler=rozetler;
  return JSON.stringify(d);
}
function kayitGeriYukle(list,json,max){
  var d;try{d=JSON.parse(json)}catch(e){return {ok:false,hata:t("kayit.yedek.okunamadi")}}
  if(!d||d.tur!=="kayitli"||!Array.isArray(d.kayitlar))return {ok:false,hata:t("kayit.yedek.degil")};
  var out=(list||[]).slice(),eklenen=0;
  d.kayitlar.forEach(function(x){
    if(!x||!KAYIT_TUR[x.mode]||typeof x.text!=="string"||!x.text.trim()||String(x.text).length>20000)return;
    if(kayitFind(out,x.mode,x.text))return;
    out.push({id:String(x.id||"k"+Math.random().toString(36).slice(2)),t:+x.t||Date.now(),u:+x.u||+x.t||Date.now(),mode:x.mode,
      name:String(x.name||t("kayit.adsiz")).slice(0,60),note:String(x.note||"").slice(0,300),text:x.text.trim(),oz:x.oz&&typeof x.oz.u==="number"?x.oz:null});
    var bs=x.mode==="gida"&&typeof besinKayitNorm==="function"?besinKayitNorm(x.besin):null;if(bs)out[out.length-1].besin=bs;
    eklenen++;
  });
  out.sort(function(a,b){return (b.u||b.t)-(a.u||a.t)});
  return {ok:true,list:out.slice(0,max||KAYIT_AYAR.enFazla),eklenen:eklenen,fazla:Math.max(0,out.length-(max||KAYIT_AYAR.enFazla)),katkici:typeof d.katkici==="string"?d.katkici:"",rozetler:d.rozetler&&typeof d.rozetler==="object"?d.rozetler:null};
}
