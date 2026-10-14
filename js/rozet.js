/* Rozetler (YOL_HARITASI.md G-01): saf mantık (DOM yok); testler de yükler. Tanımlar data/rozetler.json (gen_rozetler.py), metinler i18n rozet.*.
   Rozet kullanıcının yaptığına verilir, ürüne değil. Hesapsız, yalnızca bu cihazda: localStorage "rozetler" (şema ROZET_SURUM).
   Durum: {v, okur:{gida:[madde kimliği…]}, dedektif:{gida:[iz…]}, gor:{"okur.gida":kademe}}
   - okur: ansiklopedide açılan farklı madde sayfaları; dedektif: okunan farklı etiket ("f:"+metin izi) ya da barkod ("b:"+barkod)
   - gor: kutlaması gösterilmiş en yüksek kademe (yeni kademede bir kez kutlanır)
   Ürün ekleme aileleri (avci, oncu, dogrulayici) sunucudaki doğrulanmış sayımdan gelir (G-02); o zamana kadar tanımda hazir:false. */
var ROZET_SURUM=1;
var ROZET_AYAR={izSiniri:1000};   // bir ailede saklanan en çok farklı öğe (son kademe 1000; ötesi sayılmaz, yer tutmasın)
/* Sayımı cihazda tutulan aileler (sunucudan gelenler G-02 ile eklenir) */
var ROZET_YEREL=["okur","dedektif"];
function rozetBos(){return {v:ROZET_SURUM,okur:{},dedektif:{},gor:{}}}
/* Saklanan ya da yedekten gelen durumu doğrular: bilinmeyen alan atılır, öğeler tekilleşir, sınır uygulanır */
function rozetNorm(d){
  var o=rozetBos();if(!d||typeof d!=="object"||Array.isArray(d))return o;
  ROZET_YEREL.forEach(function(a){
    var s=d[a];if(!s||typeof s!=="object"||Array.isArray(s))return;
    Object.keys(s).forEach(function(tur){
      if(!/^[a-z]{2,8}$/.test(tur)||!Array.isArray(s[tur]))return;
      var g={},l=[];
      s[tur].forEach(function(x){if(typeof x==="string"&&x&&x.length<=80&&!g[x]&&l.length<ROZET_AYAR.izSiniri){g[x]=1;l.push(x)}});
      if(l.length)o[a][tur]=l;
    });
  });
  if(d.gor&&typeof d.gor==="object")Object.keys(d.gor).forEach(function(k){var n=d.gor[k];if(/^[a-z]+\.[a-z]+$/.test(k)&&n===(n|0)&&n>0&&n<=8)o.gor[k]=n});
  return o;
}
/* Metin izi: aynı etiket metni iki kez sayılmasın (boşluk ve büyük/küçük harf farkı yok sayılır). FNV-1a 32 bit, 36 tabanında. */
function rozetIz(s){
  s=String(s||"").toLowerCase().replace(/\s+/g," ").trim();
  var h=0x811c9dc5;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}
  return h.toString(36);
}
function rozetAile(def,id){return (def&&def.aileler||[]).filter(function(a){return a.id===id})[0]||null}
/* Bir ailenin bir türdeki eşikleri. Üst sınırı olan ailede (toplam) sınırdan büyük kademeler düşer, son kademe "hepsi" olur. Toplamı 0 ise []. */
function rozetEsikler(def,aile,tur){
  var a=typeof aile==="string"?rozetAile(def,aile):aile;if(!a)return [];
  var k=def.kademeler.slice();
  if(!a.toplam)return k;
  var ust=a.toplam[tur]|0;if(ust<1)return [];
  return k.filter(function(x){return x<ust}).concat([ust]);
}
/* i. eşiğin (0'dan) ad anahtarı: kademe sırasıyla k1…k8; üst sınırlı ailede son eşik ailenin son adını alır (k8) */
function rozetAdAnahtar(def,aile,tur,i){
  var e=rozetEsikler(def,aile,tur),a=typeof aile==="string"?rozetAile(def,aile):aile;
  if(i<0||i>=e.length)return "";
  return "rozet."+a.id+".k"+(a.toplam&&i===e.length-1?def.kademeler.length:i+1);
}
/* Ad sırası (1-8): simgenin süsü bu sıraya göre zenginleşir; "hepsi" kademesi en süslü (8) */
function rozetSira(def,aile,tur,i){var k=rozetAdAnahtar(def,aile,tur,i);return k?+k.slice(k.lastIndexOf(".k")+2):0}
function rozetSayi(d,aile,tur){var s=d&&d[aile]&&d[aile][tur];return Array.isArray(s)?s.length:0}
/* Bir ailenin bir türdeki durumu: kademe (ulaşılan eşik sayısı), ad anahtarı, sonraki eşik, ilerleme (0-1) */
function rozetDurumu(def,d,aile,tur){
  var a=rozetAile(def,aile),e=rozetEsikler(def,a,tur),n=rozetSayi(d,aile,tur),k=0;
  while(k<e.length&&n>=e[k])k++;
  var onceki=k?e[k-1]:0,sonraki=k<e.length?e[k]:null;
  return {aile:aile,tur:tur,hazir:!!(a&&a.hazir)&&e.length>0,yakinda:!!a&&(!a.hazir||!e.length),n:n,esikler:e,kademe:k,
    ad:k?rozetAdAnahtar(def,a,tur,k-1):"",sira:k?rozetSira(def,a,tur,k-1):0,
    sonraki:sonraki,sonrakiAd:sonraki!=null?rozetAdAnahtar(def,a,tur,k):"",
    ilerleme:sonraki==null?1:Math.max(0,Math.min(1,(n-onceki)/(sonraki-onceki))),hepsi:!!(a&&a.toplam)&&k===e.length&&k>0};
}
/* Sayım: öğe daha önce sayılmadıysa eklenir. Sonuç {d: yeni durum, eklendi} (durum yerinde değişmez) */
function rozetEkle(d,aile,tur,oge){
  d=rozetNorm(d);oge=String(oge||"");
  if(ROZET_YEREL.indexOf(aile)<0||!oge||oge.length>80||!/^[a-z]{2,8}$/.test(tur))return {d:d,eklendi:false};
  var l=d[aile][tur]||[];
  if(l.indexOf(oge)>-1||l.length>=ROZET_AYAR.izSiniri)return {d:d,eklendi:false};
  d[aile][tur]=l.concat([oge]);return {d:d,eklendi:true};
}
/* Kutlanmamış yeni kademe: varsa rozetDurumu, yoksa null. Gösterilince rozetGoruldu ile işaretlenir. */
function rozetYeni(def,d,aile,tur){
  var r=rozetDurumu(def,d,aile,tur);
  return r.hazir&&r.kademe>((d.gor||{})[aile+"."+tur]||0)?r:null;
}
function rozetGoruldu(d,aile,tur,kademe){d=rozetNorm(d);var k=aile+"."+tur;if(kademe>(d.gor[k]||0))d.gor[k]=kademe;return d}
/* Bağlamın en yüksek kademesi (ekranın üstündeki küçük simge); hiç rozet yoksa null */
function rozetBaglam(def,d,aile,tur){var r=rozetDurumu(def,d,aile,tur);return r.hazir&&r.kademe?r:null}
/* Toplam kazanılmış rozet (her ailenin her türündeki kademe sayısı) */
function rozetToplam(def,d){
  var n=0;(def.aileler||[]).forEach(function(a){def.turler.forEach(function(tur){n+=rozetDurumu(def,d,a.id,tur).kademe})});return n;
}
/* Yedekten geri yükleme: iki durum birleşir (öğeler birleşimi, görülen kademe büyük olan) */
function rozetBirlestir(a,b){
  a=rozetNorm(a);b=rozetNorm(b);
  ROZET_YEREL.forEach(function(x){Object.keys(b[x]).forEach(function(tur){
    var l=(a[x][tur]||[]).slice();b[x][tur].forEach(function(o){if(l.indexOf(o)<0&&l.length<ROZET_AYAR.izSiniri)l.push(o)});a[x][tur]=l;
  })});
  Object.keys(b.gor).forEach(function(k){if(b.gor[k]>(a.gor[k]||0))a.gor[k]=b.gor[k]});
  return a;
}
function rozetBosMu(d){d=rozetNorm(d);return !ROZET_YEREL.some(function(x){return Object.keys(d[x]).length})}

/* ---------- Simge: her ailenin kendi işareti; ad sırası (1-8) yükseldikçe çerçeve ve süs zenginleşir ----------
   1 düz madalya · 2 dış halka · 3 çift halka · 4 bir yıldız · 5 üç yıldız · 6 altın halka · 7 altın yıldızlar · 8 tırtıllı altın kenar + beş yıldız.
   Renkler risk renklerinden ayrı: madalya ana yeşil, süs altın; kazanılmamış gri. Şekil hep daire (uyarı üçgeni ve ünlemiyle karışmaz). */
var ROZET_RENK={ana:"#1F4D3A",altin:"#B8902A",gri:"#B9B5AC",griAcik:"#D6D2C8",beyaz:"#FFFFFF"};
var ROZET_ISARET={
  kitap:'<path d="M12 16.5c-2.6-1.6-5.6-2-8.5-1.6v-9c2.9-.4 5.9 0 8.5 1.6 2.6-1.6 5.6-2 8.5-1.6v9c-2.9-.4-5.9 0-8.5 1.6zM12 7.5v9" fill="none" stroke="#FFF" stroke-width="1.7" stroke-linejoin="round"/>',
  buyutec:'<circle cx="10.5" cy="10.5" r="5" fill="none" stroke="#FFF" stroke-width="2"/><path d="M14.2 14.2l5 5" stroke="#FFF" stroke-width="2.4" stroke-linecap="round"/>',
  hedef:'<circle cx="12" cy="12" r="7" fill="none" stroke="#FFF" stroke-width="1.7"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="#FFF" stroke-width="1.7"/><circle cx="12" cy="12" r="1" fill="#FFF"/>',
  bayrak:'<path d="M7 20V4.5M7 5h10l-2.5 3.5L17 12H7" fill="none" stroke="#FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  onay:'<path d="M3.5 12.5l3.5 3.5 7-7.5M10.5 15.5l1 1 7.5-8" fill="none" stroke="#FFF" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'
};
function rozetYildiz(cx,cy,r,renk){
  var p=[];for(var i=0;i<10;i++){var a=Math.PI/2+i*Math.PI/5,rr=i%2?r*0.45:r;p.push((cx+rr*Math.cos(a)).toFixed(2)+","+(cy-rr*Math.sin(a)).toFixed(2))}
  return '<polygon points="'+p.join(" ")+'" fill="'+renk+'"/>';
}
/* simge: ROZET_ISARET anahtarı; sira: 0 (hiç) ya da 1-8; kazanildi false ise gri. 48x48 görünümlü SVG metni döner. */
function rozetSvg(simge,sira,kazanildi){
  var s=Math.max(1,Math.min(8,sira|0)),R=ROZET_RENK,ana=kazanildi?R.ana:R.gri,sus=kazanildi?(s>=6?R.altin:R.ana):R.griAcik,yil=kazanildi?(s>=8?R.ana:s>=7?R.altin:R.ana):R.gri,o=[];
  o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">');
  if(s>=8){var p=[];for(var i=0;i<32;i++){var a=i*Math.PI/16,rr=i%2?21.2:23;p.push((24+rr*Math.cos(a)).toFixed(2)+","+(25+rr*Math.sin(a)).toFixed(2))}o.push('<polygon points="'+p.join(" ")+'" fill="'+sus+'"/>')}
  else if(s>=2)o.push('<circle cx="24" cy="25" r="21" fill="none" stroke="'+sus+'" stroke-width="'+(s>=6?2.4:1.6)+'"/>');
  o.push('<circle cx="24" cy="25" r="17" fill="'+ana+'"/>');
  if(s>=3)o.push('<circle cx="24" cy="25" r="15" fill="none" stroke="'+(kazanildi?(s>=8?R.altin:"#FFFFFF"):R.griAcik)+'" stroke-width="1" opacity=".7"/>');
  o.push('<g transform="translate(14 15) scale(.8333)">'+(ROZET_ISARET[simge]||"")+'</g>');
  var y=[[],[],[],[24],[16,24,32],[16,24,32],[16,24,32],[10,17,24,31,38]][s-1];
  y.forEach(function(x){var dy=s>=8?Math.abs(x-24)*0.18:Math.abs(x-24)*0.25;o.push(rozetYildiz(x,4.5+dy,s>=8?3.2:3.6,yil))});
  o.push('</svg>');return o.join("");
}

/* ---------- Paylaşım kartı (hikâye 1080x1920): madalya, kademe adı, aile ve tür, açıklama; ürün ve kişisel bilgi yok ----------
   M: {ust, ad, aile, aciklama, tarih}; cfg: PAYLAS_AYAR (uygulama adı, slogan, adres); madalya ve logo: yüklenmiş görüntü ya da null.
   Çizilen metinler sırayla döner (test için). */
var ROZET_KART={w:1080,h:1920,pad:90,bant:120,madalya:560};
function rozetKartCiz(x,M,cfg,madalya,logo,yazi){
  var L=ROZET_KART,W=L.w,H=L.h,P=L.pad,out=[],hf=(yazi&&yazi.baslik)||'"Bricolage Grotesque",system-ui,sans-serif',bf=(yazi&&yazi.govde)||'"Figtree",system-ui,sans-serif';
  var rtl=!!(yazi&&yazi.rtl);
  function font(w,px,h){x.font=w+" "+px+"px "+(h?hf:bf)}
  function txt(s,X,Y,c,al){x.fillStyle=c;x.textAlign=al||"center";x.fillText(s,X,Y);out.push(s)}
  function sar(s,maxW){var w=String(s||"").split(/\s+/),l=[],c="";w.forEach(function(k){var d=c?c+" "+k:k;if(c&&x.measureText(d).width>maxW){l.push(c);c=k}else c=d});if(c)l.push(c);return l}
  x.direction=rtl?"rtl":"ltr";
  x.fillStyle="#F5F1E8";x.fillRect(0,0,W,H);
  var foot=H-L.bant,y=260;
  font(600,44);txt(M.ust,W/2,y,"#5A615C");
  var ms=L.madalya,my=y+70;
  if(madalya)x.drawImage(madalya,(W-ms)/2,my,ms,ms);
  y=my+ms+130;
  font(700,96,true);sar(M.ad,W-2*P).slice(0,2).forEach(function(l){txt(l,W/2,y,"#1B211E");y+=110});
  y+=10;font(600,46);txt(M.aile,W/2,y,"#1F4D3A");
  y+=100;font(400,42);sar(M.aciklama,W-2*P-40).slice(0,4).forEach(function(l){txt(l,W/2,y,"#1B211E");y+=58});
  if(M.tarih){font(400,34);txt(M.tarih,W/2,foot-60,"#5A615C")}
  // Alt bant: sonuç kartıyla aynı (logo açık çerçeveyle, ad + slogan, adres)
  x.fillStyle="#1F4D3A";x.fillRect(0,foot,W,L.bant);
  var ls=Math.min(112,L.bant-40),ly=foot+(L.bant-ls)/2,lx=rtl?W-P-ls:P;
  if(logo){x.fillStyle="#FFFFFF";x.fillRect(lx-4,ly-4,ls+8,ls+8);x.drawImage(logo,lx,ly,ls,ls)}
  var bx=rtl?W-P-(logo?ls+28:0):P+(logo?ls+28:0),al=rtl?"right":"left";
  font(700,38,true);txt(cfg.uygulamaAdi,bx,ly+ls*0.48,"#FFFFFF",al);
  font(600,26);txt(cfg.slogan,bx,ly+ls*0.95,"#CFE0D6",al);
  font(400,26);txt(cfg.adres.replace(/^https?:\/\//,"").replace(/\/$/,""),rtl?P:W-P,ly+ls*0.48,"#CFE0D6",rtl?"left":"right");
  return out;
}
