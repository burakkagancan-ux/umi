/* Fotoğraf okuma: otomatik kırpma önerisi (YOL_HARITASI.md A-04, 21.10.2026). Saf mantık (DOM yok), testli (test/foto.js).
   Girdi: Worker'ın Vision yanıtı {text, boyut:[g,y], kutu:[[sözcük, x0,y0,x1,y1,x2,y2,x3,y3, blok, satır_sonu], …]} (worker/README.md, kutu_surum 1).
   Çıktı: içerik listesinin fotoğraftaki bölgesi ve metni; liste başlığı (İçindekiler / Ingredients / Zutaten …) yoksa ya da bölge metnin
   neredeyse tamamıysa null. Bölge: başlığın satırından başlar; okuma sırasında sonraki satırlar aynı sütundaysa (yatay örtüşme) ve yakınsa
   eklenir; başka bölümün başlığıyla (besin değerleri, üretici, saklama, net …) ya da başka dilin içerik başlığıyla biter. Öteki sütundaki
   satırlar (yan yana ikinci dil) atlanır. Metin Vision'ın metninden kesilir (boşluk ve noktalama aynen kalır).
   GÜVENLİK (bozma turu 21.10.2026: bölge bulma dönük fotoğrafta, iki sütuna bölünmüş listede, kesik kutularda listenin bir kısmını atıyordu):
   bölge ne kadar iyi bulunursa bulunsun, atılan metin ancak gürültü olduğu kanıtlanırsa atılır (kirpPlan + kirpGuvenli): üretici/adres bölümü
   her zaman atılabilir; öteki satırlar (başka dilin listesi dahil) yalnızca içlerindeki her madde ve alerjen tutulan metinde zaten varsa.
   Değilse öneri hiç gösterilmez. */
export var FOTO_AYAR={enAzSozcuk:4,enFazlaOran:0.8,dolgu:0.6,yakinlik:1.8,ortusme:0.5};
/* İçerik listesi başlıkları ve dili (küçük harf, sondaki noktalama atılmış) */
export var ICERIK_BASLIK={"içindekiler":"tr","i̇çindekiler":"tr","bileşenler":"tr","ingredients":"en","ingredient":"en","zutaten":"de","ingrédients":"fr","ingrediënten":"nl","ingredienten":"nl","ingredienti":"it","ingredientes":"es","składniki":"pl","összetevők":"hu","ingrediente":"ro","sastojci":"hr","съставки":"bg","состав":"ru","مكونات":"ar","المكونات":"ar"};
/* Başka bölümün başladığını gösteren satır başı sözcükleri (bölgeyi bitirir) */
export var BOLUM_SON=["besin","nutrition","nutritional","enerji","energy","nährwerte","nährwertangaben","valeurs","voedingswaarde","üretici","imalatçı","ithalatçı","üretim","dağıtıcı","tüketici","manufacturer","produced","distributed","importer","hersteller","saklama","saklayınız","serin","storage","store","aufbewahrung","net","tett","stt","son","best","mindestens","parti","lot","menşei","origin","hazırlanışı","hazırlama","kullanım","preparation","zubereitung"];
/* Küçük harf: Türkçe İ → i; düz I de i olur (başlıklar birden çok dilde: "Ingredients" "ıngredients" olmamalı) */
function kucuk(s){return String(s||"").replace(/İ/g,"i").toLowerCase().replace(/[:：.,;]+$/,"")}
function kutuDikdortgen(k){var xs=[k[1],k[3],k[5],k[7]],ys=[k[2],k[4],k[6],k[8]];return {x0:Math.min.apply(null,xs),y0:Math.min.apply(null,ys),x1:Math.max.apply(null,xs),y1:Math.max.apply(null,ys)}}
/* Sözcükleri satırlara böler; her sözcüğün Vision metnindeki yeri (sıra aynı) bulunur */
export function fotoSatirlar(V){
  var K=V&&Array.isArray(V.kutu)?V.kutu:[],tx=V&&V.text||"",imlec=0,satirlar=[],cur=null;
  K.forEach(function(k){
    if(!Array.isArray(k)||typeof k[0]!=="string")return;
    var r=kutuDikdortgen(k),i=tx.indexOf(k[0],imlec),w={s:k[0],r:r,blok:k[9],bas:i,bit:i<0?-1:i+k[0].length};
    if(i>=0)imlec=i+k[0].length;
    if(!cur){cur={w:[],blok:k[9]};satirlar.push(cur)}
    cur.w.push(w);
    if(k[10])cur=null;
  });
  satirlar.forEach(function(s){s.r={x0:Math.min.apply(null,s.w.map(function(w){return w.r.x0})),y0:Math.min.apply(null,s.w.map(function(w){return w.r.y0})),
    x1:Math.max.apply(null,s.w.map(function(w){return w.r.x1})),y1:Math.max.apply(null,s.w.map(function(w){return w.r.y1}))};s.h=Math.max(1,median(s.w.map(function(w){return w.r.y1-w.r.y0})))});
  return satirlar;
}
function median(a){a=a.slice().sort(function(x,y){return x-y});return a.length?a[a.length>>1]:0}
function baslikDili(w){return ICERIK_BASLIK[kucuk(w.s)]||null}
/* Satır bir içerik listesi başlığıyla mı başlıyor: başlık satırın ilk sözcüğü ve ardından ":" gelir (ya da satırda yalnız). Cümle içindeki
   "ingredients" / "bileşenler" başlık değildir (bozma turu: "see ingredients in bold below" listeyi atıyordu). Dil ya da null */
function satirBaslik(s){
  var w=s.w[0],d=w&&baslikDili(w);if(!d)return null;
  return /[:：]$/.test(w.s)||(s.w[1]&&/^[:：]/.test(s.w[1].s))||s.w.length===1?d:null;
}
function satirMetin(s,tx){var w=s.w.filter(function(x){return x.bas>=0});return w.length?tx.slice(w[0].bas,w[w.length-1].bit):""}
function bolumSonu(s){var w=s.w[0];return w&&BOLUM_SON.indexOf(kucuk(w.s))>=0}
function ortusme(a,b){var o=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0);return o/Math.max(1,Math.min(a.x1-a.x0,b.x1-b.x0))}
/* Önerilen bölge: {x,y,w,h} (fotoğrafa oranla 0–1), metin, dil, sozcuk (bölgedeki sözcük sayısı); bulunamazsa null.
   dil: arayüz dili; birden çok içerik başlığı varsa o dildeki seçilir, yoksa okuma sırasındaki ilk */
export function icerikBolge(V,dil){
  var S=fotoSatirlar(V),tx=V&&V.text||"",B=V&&V.boyut;if(!S.length||!Array.isArray(B)||!(B[0]>0&&B[1]>0))return null;
  if(V.kutu_kesik)return null;   // kutular 3.000 sözcükte kesildi: listenin sonu kutularda olmayabilir
  var adaylar=[];
  S.forEach(function(s,si){var d=satirBaslik(s);if(d)adaylar.push({si:si,dil:d})});
  if(!adaylar.length)return null;
  var a=adaylar.filter(function(x){return x.dil===dil})[0]||adaylar[0];
  var ilk=S[a.si],bolge=[ilk],idx=[a.si],R={x0:ilk.r.x0,y0:ilk.r.y0,x1:ilk.r.x1,y1:ilk.r.y1},h=ilk.h;
  for(var i=a.si+1;i<S.length;i++){
    var s=S[i];
    if(ortusme(s.r,R)<FOTO_AYAR.ortusme)continue;   // başka sütun (yan yana ikinci dil, sağdaki tablo): atlanır
    if(s.r.y0-R.y1>h*FOTO_AYAR.yakinlik)break;      // aynı sütunda uzak: bölge bitti
    if(satirBaslik(s))break;                        // başka dilin içerik listesi
    // Bölüm başı sözcüğü yalnızca liste bitmişse (önceki satır nokta ile bitiyor) ya da ardından ":" geliyorsa bölgeyi bitirir:
    // satır sonunda bölünen listede "serin kurutulmuş üzüm", "Origin: …" değil "origin cocoa" gibi satırlar listeye aittir
    if(bolumSonu(s)&&(/[.!]\s*$/.test(satirMetin(bolge[bolge.length-1],tx))||/[:：]$/.test(s.w[0].s)||(s.w[1]&&/^[:：]/.test(s.w[1].s))))break;
    bolge.push(s);idx.push(i);R={x0:Math.min(R.x0,s.r.x0),y0:Math.min(R.y0,s.r.y0),x1:Math.max(R.x1,s.r.x1),y1:Math.max(R.y1,s.r.y1)};
  }
  var parca=bolge.map(function(b){return satirMetin(b,tx)}).filter(Boolean),metin=parca.join("\n");
  var sozcuk=bolge.reduce(function(n,b){return n+b.w.length},0);
  if(sozcuk<FOTO_AYAR.enAzSozcuk||!metin)return null;
  if(metin.replace(/\s+/g,"").length>tx.replace(/\s+/g,"").length*FOTO_AYAR.enFazlaOran)return null;   // fotoğraf zaten çoğunlukla liste: öneri gereksiz
  var p=h*FOTO_AYAR.dolgu,x0=Math.max(0,R.x0-p),y0=Math.max(0,R.y0-p),x1=Math.min(B[0],R.x1+p),y1=Math.min(B[1],R.y1+p);
  return {x:x0/B[0],y:y0/B[1],w:(x1-x0)/B[0],h:(y1-y0)/B[1],metin:metin,dil:a.dil,sozcuk:sozcuk,satir:idx};
}
/* Besin değeri tablosu bölümü (gıdada öneri uygulanınca tablo kaybolmasın; js/besin.js aynı metinden okur): başlığından sonraki satırlar,
   başka bölüme ya da içerik listesine kadar, sütun ayrımı yapılmadan (tablo iki sütunludur). Yoksa "" */
export var BESIN_BASLIK=/^(besin|nutrition|nutritional|nährwert|valeurs|voedingswaarde|energi|enerji)/i;
export function besinBolum(V){
  var S=fotoSatirlar(V),tx=V&&V.text||"",i=S.findIndex(function(s){return BESIN_BASLIK.test(kucuk(s.w[0]&&s.w[0].s))});if(i<0)return "";
  var out=[S[i]];
  for(var j=i+1;j<S.length;j++){var s=S[j],k=kucuk(s.w[0]&&s.w[0].s);if(BESIN_BASLIK.test(k)){out.push(s);continue}
    if(BOLUM_SON.indexOf(k)>=0||baslikDili(s.w[0]))break;out.push(s)}
  return out.map(function(b){var w=b.w.filter(function(x){return x.bas>=0});return w.length?tx.slice(w[0].bas,w[w.length-1].bit):""}).filter(Boolean).join("\n");
}
/* Alerjen bildirimi ve iz uyarısı cümleleri ("Laktoz içerir", "Contains milk", "… içerebilir", "… kullanılan tesiste üretilmiştir", "may contain", "Kann Spuren von … enthalten"):
   içerik listesinin dışında da olsa ürüne aittir; kırpma önerisi bunları metne geri ekler (atılırsa alerjen uyarısı kaybolur). */
export var IZ_CUMLE=/(içerebilir|\biçerir\b|\bcontains\b|alerjen|allergen|allergy|allergie|enthält|contient|bevat|eser miktar|iz miktar|kullanılan (bir )?tesiste|aynı tesiste|may contain|traces? of|produced in a factory|made in a factory|kann spuren|spuren von|peut contenir|traces? éventuelles|kan sporen|può contenere|puede contener)/i;
export function izCumleleri(tx){
  // Büyük harfli yazım ("FINDIK İÇEREBİLİR"): /i bayrağı İ'yi i saymaz; iki küçültmeyle de (I → ı ve I → i) denenir
  return String(tx||"").replace(/\n/g," ").replace(/([.!?])\s+/g,"$1\u0000").split("\u0000").map(function(s){return s.trim()})
    .filter(function(s){if(!s)return false;var a=s.replace(/İ/g,"i");return IZ_CUMLE.test(a.replace(/I/g,"ı").toLowerCase())||IZ_CUMLE.test(a.toLowerCase())});
}
/* Önerinin uygulanacak metni: içerik listesi + (liste dışındaysa) iz uyarısı cümleleri + (gıdada) besin tablosu bölümü */
export function kirpMetni(V,B,gida){
  var tx=B.metin,ek=izCumleleri(V&&V.text).filter(function(c){return tx.replace(/\s+/g," ").indexOf(c)<0});
  if(ek.length)tx+="\n"+ek.join(" ");
  if(gida){var bs=besinBolum(V);if(bs&&tx.indexOf(bs)<0)tx+="\n"+bs}
  return tx;
}
/* Kırpma planı: bölge, uygulanacak metin ve atılacak satırlar üç grupta: adres (üretici/ithalatçı/tüketici hattı … ile başlayan bölüm,
   aynı Vision bloğunda sürer; her zaman atılabilir), dil2 (başka dilin içerik listesi), diger (geri kalan: saklama, uyarı, ikinci sütun,
   bölge bulmanın kaçırdığı her şey). Besin tablosu bölümü sayılmaz (gıdada metne eklenir). Bölge yoksa null. */
export var ADRES_BAS=["üretici","imalatçı","ithalatçı","dağıtıcı","tüketici","üretim","adres","manufacturer","manufactured","produced","distributed","importer","imported","hersteller","importeur","fabricant","adres:","tel","e-posta","www"];
export function kirpPlan(V,dil,gida){
  var B=icerikBolge(V,dil);if(!B)return null;
  var S=fotoSatirlar(V),tx=V.text||"",tut={},besin={},o={B:B,metin:kirpMetni(V,B,gida),adres:[],dil2:[],diger:[]};
  B.satir.forEach(function(i){tut[i]=1});
  var bi=S.findIndex(function(s){return BESIN_BASLIK.test(kucuk(s.w[0]&&s.w[0].s))});
  if(bi>=0){besin[bi]=1;for(var j=bi+1;j<S.length;j++){var k=kucuk(S[j].w[0]&&S[j].w[0].s);if(BESIN_BASLIK.test(k)){besin[j]=1;continue}if(BOLUM_SON.indexOf(k)>=0||satirBaslik(S[j]))break;besin[j]=1}}
  var tur=null,blok=null;
  S.forEach(function(s,i){
    if(tut[i]||besin[i]){tur=null;return}
    var ilk=kucuk(s.w[0]&&s.w[0].s);
    if(ADRES_BAS.indexOf(ilk)>=0){tur="adres";blok=s.blok}
    else if(satirBaslik(s)){tur="dil2";blok=s.blok}
    else if(s.blok!==blok||bolumSonu(s))tur=null;
    o[tur||"diger"].push(satirMetin(s,tx));
  });
  return o;
}
/* Ürün modelinden (js/degerlendirme.js degerlendir) karşılaştırılabilir bulgular: dikkat/uyarı/bilgi seviyeli madde ("m:"+anahtar),
   seviyesiz madde ("m0:"+anahtar) ve gıdada alerjen
   ("a:"+ad: içerir, "a:"+ad+"?": içerebilir). Madde anahtarı dilden bağımsız (E kodu, INCI, bileşen kimliği) */
export function kirpBulgu(P){
  var o=new Set();if(!P)return o;
  (P.items||[]).forEach(function(it){o.add((it.rank>=1?"m:":"m0:")+it.key)});
  var al=P.S&&P.S.allergen;if(al)Object.keys(al).forEach(function(k){var a=al[k];if(a.yes.length)o.add("a:"+k);else if(a.may.length)o.add("a:"+k+"?")});
  return o;
}
/* Güvenlik: adres dışında atılan satırların her bulgusu tutulan metinde de olmalı ("içerebilir", "içerir"le de karşılanır; seviyesiz madde
   seviyelisiyle). Başka dilin listesinde yalnızca alerjen ve seviyeli madde aranır: aynı ürünün iki dildeki listesi, sıradan bileşenlerde
   ("Water" / "Su") eşleştirme farkı gösterebilir, bu farklar uyarı kaybettirmez. bul(metin) → kirpBulgu kümesi. Sonuç {ok, eksik:[bulgu]} */
export function kirpGuvenli(plan,bul){
  if(!plan)return {ok:false,eksik:[]};
  var tut=bul(plan.metin),eksik=[];
  function var_(x){return tut.has(x)||(/\?$/.test(x)&&tut.has(x.slice(0,-1)))||(/^m0:/.test(x)&&tut.has("m:"+x.slice(3)))}
  function bak(tx,seviyesiz){if(tx.trim())bul(tx).forEach(function(x){if((seviyesiz||!/^m0:/.test(x))&&!var_(x)&&eksik.indexOf(x)<0)eksik.push(x)})}
  bak(plan.diger.join("\n"),true);bak(plan.dil2.join("\n"),false);
  return {ok:!eksik.length,eksik:eksik};
}
