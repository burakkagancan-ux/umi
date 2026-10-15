/* Topluluk (YOL_HARITASI.md G-04): saf mantık (DOM yok; testler de yükler). barkod.js'ten sonra yüklenir.
   - Ortak hedef: toplulukta doğrulanmış ürün sayısı, bir sonraki eşiğe ilerleme. Kişisel sıralama yok (sahte eklemeyi teşvik eder).
   - Eksik ürünler: çok aranan ama içeriği olmayan barkodlar (Worker GET /topluluk). Uygulamadaki Open Food Facts verisinde içeriği olan
     barkod listeden çıkar (kullanıcı onu zaten bulur), adı biliniyorsa ad eklenir (ad yalnızca ekranda, sunucuya gitmez).
   - Arama bildirimi: içerik bulunamayan barkod bu cihazdan bir kez bildirilir (localStorage "aranan"); aynı kişi aynı ürünü şişirmez. */
import {barkodGecerli, barkodIcerikli, barkodOffBul, barkodTur} from "./barkod.js";
export var TOPLULUK_AYAR={
  hedefler:[100,1000,10000,100000,1000000],   // ortak hedef eşikleri (doğrulanmış ürün); sıradaki eşik gösterilir
  arananEnCok:300                              // bu cihazdan bildirilen barkodların en çok bu kadarı hatırlanır
};
/* n doğrulanmış ürün → {n, hedef, onceki, oran (0-1, bir önceki eşikten bu yana), tamam: son eşik de geçildi} */
export function toplulukHedef(n,hedefler){
  var h=hedefler||TOPLULUK_AYAR.hedefler;n=Math.max(0,Math.floor(+n||0));
  for(var i=0;i<h.length;i++)if(n<h[i]){var o=i?h[i-1]:0;return {n:n,hedef:h[i],onceki:o,oran:(n-o)/(h[i]-o),tamam:false}}
  return {n:n,hedef:h[h.length-1],onceki:h.length>1?h[h.length-2]:0,oran:1,tamam:true};
}
/* {tür: n} → toplam */
export function toplulukToplam(o){var s=0;for(var k in o||{})s+=+o[k]||0;return s}
/* Sunucunun eksik listesi → ekrandaki liste. off: data/barkod_off.json (yoksa null); sira: içerik dil sırası.
   İçeriği uygulamadaki veride olan barkod çıkar; adı biliniyorsa {ad, marka} eklenir. Bozuk kayıt atlanır. */
export function toplulukEksik(liste,off,sira){
  var o=[];
  (liste||[]).forEach(function(x){
    if(!x||!barkodGecerli(x.kod)||!(+x.n>0))return;
    var r=off?barkodOffBul(off,x.kod):null;
    if(r&&barkodIcerikli(r,sira))return;
    o.push({kod:String(x.kod),tur:barkodTur(x.tur),n:+x.n,son:+x.son||0,ad:r&&r.ad||"",marka:r&&r.marka||""});
  });
  return o;
}
/* Bildirilen barkodlar listesi (en yeni sonda): bildirilmemişse eklenmiş yeni liste, bildirilmişse null */
export function arananEkle(liste,kod,enCok){
  var l=Array.isArray(liste)?liste.filter(function(x){return typeof x==="string"}):[];
  if(l.indexOf(kod)>-1)return null;
  l.push(kod);
  var m=enCok||TOPLULUK_AYAR.arananEnCok;
  return l.length>m?l.slice(l.length-m):l;
}
