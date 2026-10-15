/* Rozetler (YOL_HARITASI.md G-01): saf mantık (DOM yok); testler de yükler. Tanımlar data/rozetler.json (gen_rozetler.py), metinler i18n rozet.*.
   Rozet kullanıcının yaptığına verilir, ürüne değil. Hesapsız, yalnızca bu cihazda: localStorage "rozetler" (şema ROZET_SURUM).
   Durum: {v, okur:{gida:[madde kimliği…]}, dedektif:{gida:[iz…]}, gor:{"okur.gida":kademe}, sunucu?:{t, avci:{gida:n}, oncu:{…}, dogrulayici:{…}}}
   - okur: ansiklopedide açılan farklı madde sayfaları; dedektif: okunan farklı etiket ("f:"+metin izi) ya da barkod ("b:"+barkod)
   - gor: kutlaması gösterilmiş en yüksek kademe (yeni kademede bir kez kutlanır)
   - sunucu: ürün ekleme ailelerinin (tanımda sunucu:true: avci, oncu, dogrulayici) doğrulanmış sayısı; Worker POST /katki yanıtından
     (G-02, rozetSunucuYaz). Cihazda sayılamaz: doğrulama başka bir kullanıcının eklemesiyle sunucuda olur. */
export var ROZET_SURUM=1;
export var ROZET_AYAR={izSiniri:1000};   // bir ailede saklanan en çok farklı öğe (son kademe 1000; ötesi sayılmaz, yer tutmasın)
/* Sayımı cihazda tutulan aileler (sunucudan gelenler G-02 ile eklenir) */
export var ROZET_YEREL=["okur","dedektif"];
export var ROZET_SUNUCU=["avci","oncu","dogrulayici"];   // Worker /katki yanıtındaki alan adlarıyla aynı
export function rozetBos(){return {v:ROZET_SURUM,okur:{},dedektif:{},gor:{}}}
/* Saklanan ya da yedekten gelen durumu doğrular: bilinmeyen alan atılır, öğeler tekilleşir, sınır uygulanır */
export function rozetNorm(d){
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
  if(d.sunucu&&typeof d.sunucu==="object"&&d.sunucu.t>0){var su={t:+d.sunucu.t};ROZET_SUNUCU.forEach(function(a){su[a]=rozetSayilar(d.sunucu[a])});o.sunucu=su}
  if(d.gor&&typeof d.gor==="object")Object.keys(d.gor).forEach(function(k){var n=d.gor[k];if(/^[a-z]+\.[a-z]+$/.test(k)&&n===(n|0)&&n>0&&n<=8)o.gor[k]=n});
  return o;
}
/* {tür: sayı} doğrulaması (sunucu yanıtı ya da saklanan durum): yalnızca bilinen biçimde tür ve 0-100000 arası tam sayı */
export function rozetSayilar(o){var r={};if(o&&typeof o==="object"&&!Array.isArray(o))Object.keys(o).forEach(function(tur){var n=o[tur];if(/^[a-z]{2,8}$/.test(tur)&&n===(n|0)&&n>0&&n<=100000)r[tur]=n});return r}
/* Sunucu yanıtını (Worker POST /katki) duruma yazar; zaman: yanıt zamanı (ms). Durum yerinde değişmez. */
export function rozetSunucuYaz(d,j,zaman){d=rozetNorm(d);if(!j||typeof j!=="object")return d;var su={t:zaman||1};ROZET_SUNUCU.forEach(function(a){su[a]=rozetSayilar(j[a])});d.sunucu=su;return d}
/* Metin izi: aynı etiket metni iki kez sayılmasın (boşluk ve büyük/küçük harf farkı yok sayılır). FNV-1a 32 bit, 36 tabanında. */
export function rozetIz(s){
  s=String(s||"").toLowerCase().replace(/\s+/g," ").trim();
  var h=0x811c9dc5;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}
  return h.toString(36);
}
export function rozetAile(def,id){return (def&&def.aileler||[]).filter(function(a){return a.id===id})[0]||null}
/* Bir ailenin bir türdeki eşikleri. Üst sınırı olan ailede (toplam) sınırdan büyük kademeler düşer, son kademe "hepsi" olur. Toplamı 0 ise []. */
export function rozetEsikler(def,aile,tur){
  var a=typeof aile==="string"?rozetAile(def,aile):aile;if(!a)return [];
  var k=def.kademeler.slice();
  if(!a.toplam)return k;
  var ust=a.toplam[tur]|0;if(ust<1)return [];
  return k.filter(function(x){return x<ust}).concat([ust]);
}
/* i. eşiğin (0'dan) ad anahtarı: kademe sırasıyla k1…k8; üst sınırlı ailede son eşik ailenin son adını alır (k8) */
export function rozetAdAnahtar(def,aile,tur,i){
  var e=rozetEsikler(def,aile,tur),a=typeof aile==="string"?rozetAile(def,aile):aile;
  if(i<0||i>=e.length)return "";
  return "rozet."+a.id+".k"+(a.toplam&&i===e.length-1?def.kademeler.length:i+1);
}
/* Ad sırası (1-8): simgenin süsü bu sıraya göre zenginleşir; "hepsi" kademesi en süslü (8) */
export function rozetSira(def,aile,tur,i){var k=rozetAdAnahtar(def,aile,tur,i);return k?+k.slice(k.lastIndexOf(".k")+2):0}
export function rozetSayi(d,aile,tur){
  if(ROZET_SUNUCU.indexOf(aile)>-1){var su=d&&d.sunucu&&d.sunucu[aile];return su?su[tur]|0:0}
  var s=d&&d[aile]&&d[aile][tur];return Array.isArray(s)?s.length:0;
}
/* Bir ailenin bir türdeki durumu: kademe (ulaşılan eşik sayısı), ad anahtarı, sonraki eşik, ilerleme (0-1) */
export function rozetDurumu(def,d,aile,tur){
  var a=rozetAile(def,aile),e=rozetEsikler(def,a,tur),n=rozetSayi(d,aile,tur),k=0;
  while(k<e.length&&n>=e[k])k++;
  var onceki=k?e[k-1]:0,sonraki=k<e.length?e[k]:null;
  return {aile:aile,tur:tur,hazir:!!(a&&a.hazir)&&e.length>0,yakinda:!!a&&(!a.hazir||!e.length),n:n,esikler:e,kademe:k,
    ad:k?rozetAdAnahtar(def,a,tur,k-1):"",sira:k?rozetSira(def,a,tur,k-1):0,
    sonraki:sonraki,sonrakiAd:sonraki!=null?rozetAdAnahtar(def,a,tur,k):"",
    ilerleme:sonraki==null?1:Math.max(0,Math.min(1,(n-onceki)/(sonraki-onceki))),hepsi:!!(a&&a.toplam)&&k===e.length&&k>0};
}
/* Sayım: öğe daha önce sayılmadıysa eklenir. Sonuç {d: yeni durum, eklendi} (durum yerinde değişmez) */
export function rozetEkle(d,aile,tur,oge){
  d=rozetNorm(d);oge=String(oge||"");
  if(ROZET_YEREL.indexOf(aile)<0||!oge||oge.length>80||!/^[a-z]{2,8}$/.test(tur))return {d:d,eklendi:false};
  var l=d[aile][tur]||[];
  if(l.indexOf(oge)>-1||l.length>=ROZET_AYAR.izSiniri)return {d:d,eklendi:false};
  d[aile][tur]=l.concat([oge]);return {d:d,eklendi:true};
}
/* Kutlanmamış yeni kademe: varsa rozetDurumu, yoksa null. Gösterilince rozetGoruldu ile işaretlenir. */
export function rozetYeni(def,d,aile,tur){
  var r=rozetDurumu(def,d,aile,tur);
  return r.hazir&&r.kademe>((d.gor||{})[aile+"."+tur]||0)?r:null;
}
export function rozetGoruldu(d,aile,tur,kademe){d=rozetNorm(d);var k=aile+"."+tur;if(kademe>(d.gor[k]||0))d.gor[k]=kademe;return d}
/* Bağlamın en yüksek kademesi (ekranın üstündeki küçük simge); hiç rozet yoksa null */
export function rozetBaglam(def,d,aile,tur){var r=rozetDurumu(def,d,aile,tur);return r.hazir&&r.kademe?r:null}
/* Toplam kazanılmış rozet (her ailenin her türündeki kademe sayısı) */
export function rozetToplam(def,d){
  var n=0;(def.aileler||[]).forEach(function(a){def.turler.forEach(function(tur){n+=rozetDurumu(def,d,a.id,tur).kademe})});return n;
}
/* Yedekten geri yükleme: iki durum birleşir (öğeler birleşimi, görülen kademe büyük olan) */
export function rozetBirlestir(a,b){
  a=rozetNorm(a);b=rozetNorm(b);
  ROZET_YEREL.forEach(function(x){Object.keys(b[x]).forEach(function(tur){
    var l=(a[x][tur]||[]).slice();b[x][tur].forEach(function(o){if(l.indexOf(o)<0&&l.length<ROZET_AYAR.izSiniri)l.push(o)});a[x][tur]=l;
  })});
  Object.keys(b.gor).forEach(function(k){if(b.gor[k]>(a.gor[k]||0))a.gor[k]=b.gor[k]});
  if(b.sunucu&&(!a.sunucu||b.sunucu.t>a.sunucu.t))a.sunucu=b.sunucu;   // sunucu sayısı: daha yeni olan
  return a;
}
export function rozetBosMu(d){d=rozetNorm(d);return !ROZET_YEREL.some(function(x){return Object.keys(d[x]).length})}

/* ---------- Simge: her ailenin kendi şekli, rengi ve işareti; kademe (ad sırası 1-8) yükseldikçe her biri bir öncekinden gösterişli ----------
   Aile: Okur lacivert daire · Etiket Dedektifi mor altıgen · Ürün Avcısı petrol kalkan · Öncü kahve yuvarlak kare · Doğrulayıcı yeşil mühür (tırtıllı).
   Kademe (14.10.2026, kullanıcı isteği: "her rozet bir öncekinden daha havalı"; her adımda yeni bir öğe eklenir, öncekiler kalır):
     1 düz bronz çerçeve · 2 parlak (degrade) bronz + kurdele + yıldız · 3 gümüş + iç halka · 4 gümüş + iki yıldız + parıltı
     · 5 altın + arkada ışın · 6 altın + üç yıldız + uzun ışın · 7 altın + defne dalları + hale · 8 koyu altın, taç, beş yıldız, ışıltılar.
   Renkler risk renklerinden (kırmızı, turuncu, sarı) ayrı; uyarı üçgeni ya da eşkenar dörtgen şekli yok. Kazanılmamış: gri, degradesiz. */
export var ROZET_RENK={bronz:"#A0703F",gumus:"#8F979E",altin:"#B8902A",gri:"#B9B5AC",griAcik:"#D6D2C8",beyaz:"#FFFFFF"};
export var ROZET_STIL={
  kitap:{sekil:"daire",renk:"#234A7A"},
  buyutec:{sekil:"altigen",renk:"#5A3E8E"},
  hedef:{sekil:"kalkan",renk:"#155E63"},
  bayrak:{sekil:"kare",renk:"#6E4A2A"},
  onay:{sekil:"muhur",renk:"#1F4D3A"}
};
export var ROZET_ISARET={
  kitap:'<path d="M12 16.5c-2.6-1.6-5.6-2-8.5-1.6v-9c2.9-.4 5.9 0 8.5 1.6 2.6-1.6 5.6-2 8.5-1.6v9c-2.9-.4-5.9 0-8.5 1.6zM12 7.5v9" fill="none" stroke="#FFF" stroke-width="1.7" stroke-linejoin="round"/>',
  buyutec:'<circle cx="10.5" cy="10.5" r="5" fill="none" stroke="#FFF" stroke-width="2"/><path d="M14.2 14.2l5 5" stroke="#FFF" stroke-width="2.4" stroke-linecap="round"/>',
  hedef:'<circle cx="12" cy="12" r="7" fill="none" stroke="#FFF" stroke-width="1.7"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="#FFF" stroke-width="1.7"/><circle cx="12" cy="12" r="1" fill="#FFF"/>',
  bayrak:'<path d="M7 20V4.5M7 5h10l-2.5 3.5L17 12H7" fill="none" stroke="#FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  onay:'<path d="M3.5 12.5l3.5 3.5 7-7.5M10.5 15.5l1 1 7.5-8" fill="none" stroke="#FFF" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'
};
export function rozetYildiz(cx,cy,r,renk){
  var p=[];for(var i=0;i<10;i++){var a=Math.PI/2+i*Math.PI/5,rr=i%2?r*0.45:r;p.push((cx+rr*Math.cos(a)).toFixed(2)+","+(cy-rr*Math.sin(a)).toFixed(2))}
  return '<polygon points="'+p.join(" ")+'" fill="'+renk+'"/>';
}
/* Ailenin şekli (cx,cy merkezli, r yarıçaplı); öznitelikler (fill/stroke) metin olarak eklenir */
export function rozetSekil(sekil,cx,cy,r,oz){
  var f=function(n){return n.toFixed(2)},i,p=[];
  if(sekil==="altigen"){for(i=0;i<6;i++){var a=Math.PI/6+i*Math.PI/3;p.push(f(cx+r*Math.cos(a))+","+f(cy+r*Math.sin(a)))}return '<polygon points="'+p.join(" ")+'" stroke-linejoin="round" '+oz+'/>'}
  if(sekil==="muhur"){for(i=0;i<48;i++){var b=i*Math.PI/24,rr=r*(0.94+0.06*Math.cos(12*b));p.push(f(cx+rr*Math.cos(b))+","+f(cy+rr*Math.sin(b)))}return '<polygon points="'+p.join(" ")+'" '+oz+'/>'}
  if(sekil==="kare"){var k=r*0.86;return '<rect x="'+f(cx-k)+'" y="'+f(cy-k)+'" width="'+f(2*k)+'" height="'+f(2*k)+'" rx="'+f(k*0.42)+'" '+oz+'/>'}
  if(sekil==="kalkan"){var w=r*0.9,ust=cy-r*0.88;return '<path d="M'+f(cx-w)+' '+f(ust+r*0.14)+'Q'+f(cx-w)+' '+f(ust)+' '+f(cx-w+r*0.14)+' '+f(ust)+'H'+f(cx+w-r*0.14)+'Q'+f(cx+w)+' '+f(ust)+' '+f(cx+w)+' '+f(ust+r*0.14)+'V'+f(cy+r*0.12)+'Q'+f(cx+w)+' '+f(cy+r*0.72)+' '+f(cx)+' '+f(cy+r*1.06)+'Q'+f(cx-w)+' '+f(cy+r*0.72)+' '+f(cx-w)+' '+f(cy+r*0.12)+'Z" '+oz+'/>'}
  return '<circle cx="'+cx+'" cy="'+cy+'" r="'+f(r)+'" '+oz+'/>';
}
/* Defne dalları: alttan iki yana kıvrılan yapraklar */
export function rozetDefne(cx,cy,r,renk){
  var o=['<path d="M'+(cx-r*0.5).toFixed(2)+' '+(cy+r*0.87).toFixed(2)+'A'+r+' '+r+' 0 0 1 '+(cx-r*0.94).toFixed(2)+' '+(cy-r*0.34).toFixed(2)+'M'+(cx+r*0.5).toFixed(2)+' '+(cy+r*0.87).toFixed(2)+'A'+r+' '+r+' 0 0 0 '+(cx+r*0.94).toFixed(2)+' '+(cy-r*0.34).toFixed(2)+'" fill="none" stroke="'+renk+'" stroke-width=".9" stroke-linecap="round"/>'];
  [-1,1].forEach(function(yon){
    for(var i=0;i<5;i++){var a=Math.PI/2+yon*(0.6+i*0.34),x=cx+(r+1.2)*Math.cos(a),y=cy+(r+1.2)*Math.sin(a),d=a*180/Math.PI+90-yon*28;
      o.push('<ellipse cx="'+x.toFixed(2)+'" cy="'+y.toFixed(2)+'" rx="3.1" ry="1.3" transform="rotate('+d.toFixed(1)+' '+x.toFixed(2)+' '+y.toFixed(2)+')" fill="'+renk+'"/>')}
  });
  return o.join("");
}
/* Kurdele: madalyanın altından iki yana inen uçlar */
export function rozetKurdele(cx,y,renk,kenar){
  var o=[],f=function(n){return n.toFixed(2)};
  [-1,1].forEach(function(yn){var x0=cx+yn*3,x1=cx+yn*10.5;
    o.push('<path d="M'+f(x0)+' '+f(y)+'L'+f(x0+yn*4)+' '+f(y)+'L'+f(x1)+' 46.5L'+f(x1-yn*3.4)+' 44.2L'+f(x1-yn*5.6)+' 47.2Z" fill="'+renk+'"'+(kenar?' stroke="'+kenar+'" stroke-width=".7" stroke-linejoin="round"':'')+'/>')});
  return o.join("");
}
/* Işınlar: madalyanın arkasında güneş patlaması (n ışın, iç ve dış yarıçap) */
export function rozetIsin(cx,cy,ic,dis,n,renk,op){
  var p=[],f=function(v){return v.toFixed(2)};
  for(var i=0;i<n;i++){var a=i*2*Math.PI/n-Math.PI/2,w=Math.PI/n*0.45;
    p.push('M'+f(cx+ic*Math.cos(a-w))+' '+f(cy+ic*Math.sin(a-w))+'L'+f(cx+dis*Math.cos(a))+' '+f(cy+dis*Math.sin(a))+'L'+f(cx+ic*Math.cos(a+w))+' '+f(cy+ic*Math.sin(a+w))+'Z')}
  return '<path d="'+p.join("")+'" fill="'+renk+'" opacity="'+op+'"/>';
}
/* Işıltı: dört köşeli küçük parıltı */
export function rozetIsilti(x,y,r,renk){
  var f=function(v){return v.toFixed(2)},k=r*0.28;
  return '<path d="M'+f(x)+' '+f(y-r)+'L'+f(x+k)+' '+f(y-k)+'L'+f(x+r)+' '+f(y)+'L'+f(x+k)+' '+f(y+k)+'L'+f(x)+' '+f(y+r)+'L'+f(x-k)+' '+f(y+k)+'L'+f(x-r)+' '+f(y)+'L'+f(x-k)+' '+f(y-k)+'Z" fill="'+renk+'"/>';
}
/* Taç: en üst kademenin tepesinde */
export function rozetTac(cx,y,renk){
  var f=function(v){return v.toFixed(2)};
  return '<path d="M'+f(cx-6)+' '+f(y)+'L'+f(cx-7)+' '+f(y-5.5)+'L'+f(cx-3.2)+' '+f(y-2.6)+'L'+f(cx)+' '+f(y-7)+'L'+f(cx+3.2)+' '+f(y-2.6)+'L'+f(cx+7)+' '+f(y-5.5)+'L'+f(cx+6)+' '+f(y)+'Z" fill="'+renk+'" stroke="#FFF" stroke-width=".6" stroke-linejoin="round"/>';
}
/* Metal degradesi: açık üst, koyu alt (kademenin malzemesi) */
export var ROZET_METAL={bronz:["#D9A06B","#A0703F","#6E4622"],gumus:["#F2F4F6","#B4BBC1","#7C848B"],altin:["#FBE29A","#B8902A","#8C6A12"]};
/* simge: ROZET_ISARET anahtarı; sira: 0 (hiç) ya da 1-8; kazanildi false ise gri. 48x48 görünümlü SVG metni döner. */
export function rozetSvg(simge,sira,kazanildi){
  var s=Math.max(1,Math.min(8,sira|0)),R=ROZET_RENK,st=ROZET_STIL[simge]||ROZET_STIL.kitap,k=!!kazanildi,o=[];
  var tur=s>=5?"altin":s>=3?"gumus":"bronz",id="rz"+simge+s+(k?"k":"g");
  var kurdele=s>=2,cx=24,cy=s>=8?24:kurdele?(s%2?21.5:23):24;   // yıldızlı kademede (2, 4, 6) madalya biraz aşağıda: yıldızlara yer
  var rDis=s>=7?15.8:s>=5?16.2:kurdele?16.6:18.5,rIc=rDis-(s>=8?3.2:s>=5?3:s>=2?2.6:2.2);
  var M=ROZET_METAL[tur],metal=!k?R.griAcik:s===1?M[1]:"url(#"+id+"m)",ana=k?st.renk:R.gri,yil=k?(s>=5?R.altin:M[1]):R.gri,isik=k?R.altin:R.griAcik;
  o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">');
  if(k&&s>=2){
    o.push('<defs><linearGradient id="'+id+'m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+M[0]+'"/><stop offset=".55" stop-color="'+M[1]+'"/><stop offset="1" stop-color="'+M[2]+'"/></linearGradient>');
    if(s>=7)o.push('<radialGradient id="'+id+'h"><stop offset=".45" stop-color="#FBE29A" stop-opacity=".75"/><stop offset="1" stop-color="#FBE29A" stop-opacity="0"/></radialGradient>');
    o.push('</defs>');
  }
  if(s>=7&&k)o.push('<circle cx="'+cx+'" cy="'+cy+'" r="23.5" fill="url(#'+id+'h)"/>');
  if(s>=5)o.push(rozetIsin(cx,cy,rDis-1,s>=6?23:20.5,s>=8?24:s>=6?16:12,isik,s>=8?.9:.7));
  if(s>=7)o.push(rozetDefne(cx,cy+0.5,rDis+3.2,k?R.altin:R.griAcik));
  if(kurdele)o.push(rozetKurdele(cx,cy+rDis*0.55,k?st.renk:R.gri,k&&s>=5?R.altin:null));
  o.push(rozetSekil(st.sekil,cx,cy,rDis,'fill="'+metal+'"'+(s>=3&&k?' stroke="'+M[2]+'" stroke-width=".6"':'')));
  o.push(rozetSekil(st.sekil,cx,cy,rIc,'fill="'+ana+'"'));
  if(s>=3)o.push(rozetSekil(st.sekil,cx,cy,rIc-1.6,'fill="none" stroke="'+(k?(s>=5?R.altin:R.beyaz):R.griAcik)+'" stroke-width="'+(s>=8?1.3:s>=5?1:.8)+'" opacity="'+(s>=5?1:.6)+'"'));
  if(s>=4&&k)o.push('<path d="M'+(cx-rIc*0.75).toFixed(2)+' '+(cy-rIc*0.3).toFixed(2)+'Q'+(cx-rIc*0.55).toFixed(2)+' '+(cy-rIc*0.85).toFixed(2)+' '+cx+' '+(cy-rIc*0.82).toFixed(2)+'" fill="none" stroke="#FFF" stroke-width="1.1" stroke-linecap="round" opacity=".45"/>');
  var ik=(rIc*2*0.62)/24;
  o.push('<g transform="translate('+(cx-12*ik).toFixed(2)+' '+(cy-12*ik).toFixed(2)+') scale('+ik.toFixed(3)+')">'+(ROZET_ISARET[simge]||"")+'</g>');
  var y=[[],[24],[],[19,29],[],[16,24,32],[],[13,18.5,24,29.5,35]][s-1],ust=cy-rDis-0.2;
  if(s===8)y=[13,18.5,29.5,35];   // ortadaki yerde taç
  // Yıldızlar madalyanın kenarının üstünde durur, içine girmez (14.10.2026, kullanıcı isteği: "simgeyle iç içe geçmiş gibi")
  var yr=s>=6?2.7:3.1;
  y.forEach(function(x){o.push(rozetYildiz(x,Math.max(yr,ust-yr*0.6+Math.abs(x-24)*0.12),yr,yil))});
  if(s===8){o.push(rozetTac(cx,ust+1.2,k?R.altin:R.gri));if(k){o.push(rozetIsilti(5,9,2.6,"#FBE29A"));o.push(rozetIsilti(43,12,2,"#FBE29A"));o.push(rozetIsilti(42.5,40,1.8,"#FBE29A"))}}
  o.push('</svg>');return o.join("");
}

/* ---------- Paylaşım kartı (hikâye 1080x1920): madalya, kademe adı, aile ve tür, açıklama; ürün ve kişisel bilgi yok ----------
   M: {ust, ad, aile, aciklama, tarih}; cfg: PAYLAS_AYAR (uygulama adı, slogan, adres); madalya ve logo: yüklenmiş görüntü ya da null.
   Çizilen metinler sırayla döner (test için). */
export var ROZET_KART={w:1080,h:1920,pad:90,bant:120,madalya:560};
export function rozetKartCiz(x,M,cfg,madalya,logo,yazi){
  var L=ROZET_KART,W=L.w,H=L.h,P=L.pad,out=[],hf=(yazi&&yazi.baslik)||'"Bricolage Grotesque",system-ui,sans-serif',bf=(yazi&&yazi.govde)||'"Figtree",system-ui,sans-serif';
  var rtl=!!(yazi&&yazi.rtl);
  function font(w,px,h){x.font=w+" "+px+"px "+(h?hf:bf)}
  function txt(s,X,Y,c,al){x.fillStyle=c;x.textAlign=al||"center";x.fillText(s,X,Y);out.push(s)}
  function sar(s,maxW){var w=String(s||"").split(/\s+/),l=[],c="";w.forEach(function(k){var d=c?c+" "+k:k;if(c&&x.measureText(d).width>maxW){l.push(c);c=k}else c=d});if(c)l.push(c);return l}
  x.direction=rtl?"rtl":"ltr";
  x.fillStyle="#FFFFFF";x.fillRect(0,0,W,H);
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
