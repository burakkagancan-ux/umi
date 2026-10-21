/* Barkod: saf mantık (DOM yok; testler de yükler). Kontrol hanesi, biçim dönüşümü, içerik metninin dil seçimi, kaynak sırası, katkı kuralları.
   Akış (arayüz js/arayuz_barkod.js): barkod → (1) uygulamadaki Open Food Facts verisi (data/barkod_off.json) ve (2) kendi veritabanımız (Worker /urun, D1)
   → (3) Open Food Facts canlı sorgu (Worker /off) → (4) bulunamadı: etiketin fotoğrafı. Ürünün üzerindeki etiket her zaman asıl kaynaktır. */
import {besinDiziden} from "./besin.js";
export var BARKOD_AYAR={
  acik:true,
  offDosya:"data/barkod_off.json",
  zamanAsimi:3500,         // Worker sorguları (ms); aşılırsa sıradaki adıma geçilir
  katkiEnAzParca:3,        // katkı önerisi için içerik listesinde en az parça
  katkiEnAzOran:0.6,       // ve tanınan parça oranı (gıda, kozmetik)
  benzerlik:0.85           // iki katkı metni bu orandan benzerse aynı içerik sayılır (Worker'da da aynı)
};
/* Yalnızca rakamlar */
export function barkodTemiz(s){return String(s==null?"":s).replace(/[^0-9]/g,"")}
/* GS1 kontrol hanesi (EAN-8, UPC-A, EAN-13): sağdan başlayarak 3,1,3,1… ağırlık */
export function barkodKontrol(govde){
  var top=0;for(var i=govde.length-1,w=3;i>=0;i--,w=4-w)top+=(+govde[i])*w;
  return (10-top%10)%10;
}
/* UPC-E (8 hane, 0 ya da 1 ile başlar) → UPC-A (12 hane) */
export function barkodUpcE(e){
  if(!/^[01]\d{7}$/.test(e))return null;
  var s=e[0],d=e.slice(1,7),c=e[7],x=d[5],g;
  if(x<="2")g=d.slice(0,2)+x+"0000"+d.slice(2,5);
  else if(x==="3")g=d.slice(0,3)+"00000"+d.slice(3,5);
  else if(x==="4")g=d.slice(0,4)+"00000"+d[4];
  else g=d.slice(0,5)+"0000"+x;
  return s+g+c;
}
/* Geçerli mi? EAN-13, EAN-8, UPC-A (12), UPC-E (8, 0/1 ile başlayan; önce UPC-A'ya açılır) */
export function barkodGecerli(s){
  s=barkodTemiz(s);
  if(s.length===13||s.length===12)return barkodKontrol(s.slice(0,-1))===+s.slice(-1);
  if(s.length===8){
    if(barkodKontrol(s.slice(0,7))===+s[7])return true;   // EAN-8
    var a=barkodUpcE(s);return !!a&&barkodKontrol(a.slice(0,11))===+a[11];
  }
  return false;
}
/* Arama anahtarı: Open Food Facts gibi 13 haneye tamamlanır (UPC-A önüne 0; UPC-E önce açılır). EAN-8 olduğu gibi kalır. Geçersizse null. */
export function barkodNorm(s){
  s=barkodTemiz(s);if(!barkodGecerli(s))return null;
  if(s.length===12)return "0"+s;
  if(s.length===8&&barkodKontrol(s.slice(0,7))!==+s[7])return "0"+barkodUpcE(s);
  return s;
}
/* Aynı ürün için denenecek anahtarlar (veride 12 haneli UPC ya da başında 0 olmadan kayıtlı olabilir) */
export function barkodAdaylar(s){
  var n=barkodNorm(s);if(!n)return [];
  var a=[n];if(n.length===13&&n[0]==="0")a.push(n.slice(1));
  var tm=barkodTemiz(s);if(a.indexOf(tm)<0)a.push(tm);
  // 8 hane hem EAN-8 hem UPC-E olabilir (okuyucu biçimi her zaman bildirmez): UPC-E açılımı da denenir
  var e=tm.length===8?barkodUpcE(tm):null;
  if(e&&barkodKontrol(e.slice(0,11))===+e[11])["0"+e,e].forEach(function(x){if(a.indexOf(x)<0)a.push(x)});
  return a;
}
/* Veritabanı → uygulamanın türü */
export var BARKOD_TUR={food:"gida",beauty:"koz",products:"tem",gida:"gida",koz:"koz",tem:"tem"};
export function barkodTur(db){return BARKOD_TUR[db]||"gida"}
/* İçerik metni hangi dilde gösterilecek: seçili dil → ürünün etiket dili (Türkiye'de tr) → İngilizce → kalan ilk metin.
   metin: {dil: metin}; sira: tercih sırası (ör. ["en","tr"]). Döner: {s, dil} ya da null. */
export function barkodMetin(metin,sira){
  if(!metin)return null;
  var ks=Object.keys(metin).filter(function(k){return metin[k]&&String(metin[k]).trim()});
  if(!ks.length)return null;
  for(var i=0;i<(sira||[]).length;i++)if(ks.indexOf(sira[i])>-1)return {s:String(metin[sira[i]]).trim(),dil:sira[i]};
  return {s:String(metin[ks[0]]).trim(),dil:ks[0]};
}
/* data/barkod_off.json kaydı → ortak ürün biçimi. Kayıt: [db, ad, marka, t(sn), {dil: metin}, besin?, kat?] (besin: js/besin.js besinDiziden;
   kat: A-08 ürün tipi için OFF kategori etiketleri, yalnızca besin_istisna.json'da geçenler) */
export function barkodOffKayit(kod,r){
  if(!r)return null;
  return {kod:kod,kaynak:"off",db:r[0],tur:barkodTur(r[0]),ad:r[1]||"",marka:r[2]||"",t:(r[3]||0)*1000,metin:r[4]||{},dogrulandi:null,besin:besinDiziden(r[5]),kat:Array.isArray(r[6])?r[6]:[]};
}
export function barkodOffBul(veri,kod){
  var u=veri&&veri.u;if(!u)return null;
  var a=barkodAdaylar(kod);
  for(var i=0;i<a.length;i++)if(u[a[i]])return barkodOffKayit(a[i],u[a[i]]);
  return null;
}
/* İçeriği olan sonuç mu */
export function barkodIcerikli(r,sira){return !!(r&&barkodMetin(r.metin,sira))}
/* Kaynak sırası: kendi veritabanımızda doğrulanmış kayıt → uygulamadaki OFF verisi → OFF canlı → kendi doğrulanmamış kaydımız.
   Gerekçe: doğrulanmış kayıt güncel paketin iki ayrı fotoğrafından gelir; OFF verisi topluluk kaydıdır ama eski olabilir;
   tek fotoğraftan gelen doğrulanmamış kayıt en son çaredir. İçeriği olmayan sonuç yalnızca ürün adını taşır (içerik için fotoğraf istenir).
   s: {urun, off, offCanli}; döner: içerikli ilk sonuç; yoksa adı bilinen ilk sonuç ({...,icerikYok:true}); hiçbiri yoksa null. */
export function barkodSec(s,sira){
  var u=s.urun,d=u&&u.dogrulandi?u:null,dd=u&&!u.dogrulandi?u:null;
  var aday=[d,s.off,s.offCanli,dd].filter(Boolean);
  for(var i=0;i<aday.length;i++)if(barkodIcerikli(aday[i],sira))return barkodKatEkle(barkodBesinEkle(aday[i],s),s);
  for(i=0;i<aday.length;i++)if(aday[i].ad){var o=barkodBesinEkle(aday[i],s);if(o===aday[i]){o={};for(var k in aday[i])o[k]=aday[i][k]}o.icerikYok=true;return barkodKatEkle(o,s)}
  return null;
}
/* Ürün tipi için OFF kategorileri (A-08): seçilen kaynakta yoksa (kendi veritabanımız) aynı barkodun OFF kaydından. Kopya döner. */
export function barkodKatEkle(r,s){
  if(!r||(r.kat&&r.kat.length))return r;
  var b=[s.off,s.offCanli].filter(function(x){return x&&x.kat&&x.kat.length})[0];
  if(!b)return r;
  var o={};for(var k in r)o[k]=r[k];o.kat=b.kat;return o;
}
/* Besin değerleri (A-02) Open Food Facts'ten ya da kullanıcıların barkoda bağladığı etiket tablosundan (Worker /urun yanıtında besin,
   besinKaynak "topluluk") gelir. Seçilen kaynakta yoksa sırayla: OFF (uygulamadaki veri → canlı sorgu) → topluluk.
   Seçilen kayıt değiştirilmez, kopyası döner. */
export function barkodBesinEkle(r,s){
  if(!r||r.besin)return r;
  var b=[s.off,s.offCanli,s.urun].filter(function(x){return x&&x.besin})[0];
  if(!b)return r;
  var o={};for(var k in r)o[k]=r[k];
  o.besin=b.besin;o.besinT=b.besinT||b.t;o.besinLt=b.besinLt;o.besinPor=b.besinPor||null;o.besinKaynak=b.besinKaynak;o.besinDogrulandi=!!b.besinDogrulandi;return o;
}
/* Fotoğrafla okunan metnin katkı olarak önerilmesi: içerik listesi gibi görünmeli (gıda, kozmetik: parçaların çoğu tanınmış;
   temizlik: en az bir tehlike ifadesi ya da madde tanınmış). Yanlış okunmuş metin veritabanına girmesin. */
export function barkodKatkiUygun(mode,toplam,taninan){
  if(mode==="tem")return taninan>=1;
  return toplam>=BARKOD_AYAR.katkiEnAzParca&&taninan/toplam>=BARKOD_AYAR.katkiEnAzOran;
}
/* Katkıcı kimliği (O-22): cihazda bir kez üretilen rastgele 32 onaltılık hane; kişisel bilgiden türetilmez.
   Katkıyla birlikte gider; ileride rozet ve "Katkılarım" için katkıyı sahibine yazar. Worker aynı biçimi denetler. */
export function katkiciGecerli(s){return /^[0-9a-f]{32}$/.test(String(s==null?"":s))}
export function katkiciUret(bayt){   // bayt: 16 rastgele bayt (crypto.getRandomValues)
  var o="";for(var i=0;i<16;i++)o+=(256+(bayt[i]&255)).toString(16).slice(1);return o;
}
/* İki içerik metni aynı ürünün içeriği mi: sözcük kümelerinin benzerliği (Jaccard). Büyük/küçük harf, noktalama ve Türkçe harfler duyarsız.
   Worker (worker/src/index.js) aynı hesabı kullanır; değiştirilirse ikisi birlikte değişir (test/barkod.js denetler). */
export function barkodSozcukler(s){
  var m={"ı":"i","İ":"i","ş":"s","Ş":"s","ğ":"g","Ğ":"g","ü":"u","Ü":"u","ö":"o","Ö":"o","ç":"c","Ç":"c"};
  return String(s||"").replace(/[ıİşŞğĞüÜöÖçÇ]/g,function(c){return m[c]}).toLowerCase().split(/[^a-z0-9%]+/).filter(function(w){return w.length>1});
}
export function barkodBenzer(a,b){
  var A={},B={},n=0,ka=0,kb=0,k;
  barkodSozcukler(a).forEach(function(w){A[w]=1});barkodSozcukler(b).forEach(function(w){B[w]=1});
  for(k in A){ka++;if(B[k])n++}for(k in B)kb++;
  var u=ka+kb-n;return u?n/u:0;
}
