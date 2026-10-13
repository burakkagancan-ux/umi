/* Besin değeri tablosu (A-02): saf mantık (DOM yok; testler de yükler).
   Değerler iki yoldan gelir: (1) barkod → Open Food Facts'in 100 g / 100 ml değerleri (besinOff, data/barkod_off.json ve Worker /off);
   (2) etiket fotoğrafından okunan metin (besinAyristir). İkisi de aynı tutarlılık denetiminden geçer (besinDenetle): denetimi geçmeyen
   değer "şüpheli" olur; ekran şüpheli değerle renk göstermez, kullanıcıya sorar. Emin olunmayan renk hiç gösterilmez.
   Satır adları ve sütun başlıkları data/besin.json'da (kaynak/besin_adlari.tsv → gen_besin.py); yeni dil kod değişikliği istemez. */
var BESIN_ALAN=["kcal","yag","doymus","karb","seker","lif","protein","tuz"];   // off_al.py ve Worker aynı adları kullanır
var BESIN_AYAR={
  kjKcal:4.184,                 // 1 kcal = 4,184 kJ (AB 1169/2011 Ek XIV)
  tuzSodyum:2.5,                // tuz = sodyum x 2,5 (AB 1169/2011 Ek I, 11)
  katsayi:{yag:9,karb:4,protein:4,lif:2},   // kcal/g (AB 1169/2011 Ek XIV)
  enerjiPay:20,                 // enerji denetimi: beyan ile hesap arasında kabul edilen fark en az 20 kcal ...
  enerjiOran:0.2,               // ... ya da büyük olanın %20'si (yuvarlama; polioller 2,4, organik asitler 3 kcal/g). Alkollü içecek geçemez (7 kcal/g): sorulur.
  yuvarlama:0.1,                // alt satır üst satırı bu kadar aşabilir (doymuş yağ > yağ, şekerler > karbonhidrat)
  toplamUst:101,                // 100 g'da yağ + karbonhidrat + protein + lif + tuz en çok
  kcalUst:900,                  // 100 g'da en çok (saf yağ)
  anaSatir:["yag","doymus","seker","tuz"],   // renkli gösterimin dört satırı; eksikse "eksik" listesinde
  enAzSatir:3,                  // metinde tablo sayılması için değeri okunan en az satır (enerji satırı ya da "100 g" başlığı varsa 2)
  adlarArasiSozcuk:2            // satır adıyla değeri arasında (aynı satırda) atlanabilecek bilinmeyen sözcük ("Yağ (toplam)", "Fett gesamt")
};
function besinSayi(v){return typeof v==="number"&&isFinite(v)?v:null}
function besinYuvarla(v){return v==null?null:Math.round(v*1000)/1000}

/* Ambalaj miktarından ("1,5 L", "45cl", "250 g") 100 g mı 100 ml mi: "ml" | "g" | "" (bilinmiyor). off_al.py birim() ile aynı. */
function besinBirim(miktar){
  var s=String(miktar==null?"":miktar).toLowerCase();
  if(/\d\s*(ml|cl|dl|l|lt|litre|liter|litres|liters)\b/.test(s))return "ml";
  return /\d\s*(g|gr|kg|gram|grams)\b/.test(s)?"g":"";
}
/* Open Food Facts nutriments (yalnızca *_100g alanları) → {kcal, yag, doymus, karb, seker, lif, protein, tuz, birim}; hiç değer yoksa null.
   off_al.py besin_al() ve Worker (worker/src/barkod.js besinOff) ile aynı hesap; test/besin.js karşılaştırır. */
var BESIN_OFF={yag:"fat",doymus:"saturated-fat",karb:"carbohydrates",seker:"sugars",lif:"fiber",protein:"proteins",tuz:"salt"};
function besinOff(n,miktar){
  if(!n||typeof n!=="object")return null;
  var f=function(k){var v=n[k];if(v===""||v==null)return null;v=Number(v);return isFinite(v)&&v>=0?v:null};
  var b={},kj;
  b.kcal=f("energy-kcal_100g");
  if(b.kcal==null){kj=f("energy-kj_100g");if(kj==null)kj=f("energy_100g");b.kcal=kj==null?null:kj/BESIN_AYAR.kjKcal}   // OFF'ta "energy" kJ'dir
  for(var k in BESIN_OFF)b[k]=f(BESIN_OFF[k]+"_100g");
  if(b.tuz==null){var na=f("sodium_100g");b.tuz=na==null?null:na*BESIN_AYAR.tuzSodyum}
  if(BESIN_ALAN.every(function(a){return b[a]==null}))return null;
  BESIN_ALAN.forEach(function(a){b[a]=besinYuvarla(b[a])});
  b.birim=besinBirim(miktar);
  return b;
}
/* data/barkod_off.json'daki kısa biçim: [kcal, yag, doymus, karb, seker, lif, protein, tuz, birim] */
function besinDiziden(a){
  if(!a||!a.length)return null;
  var b={};BESIN_ALAN.forEach(function(k,i){b[k]=besinSayi(a[i])});b.birim=a[BESIN_ALAN.length]||"";
  return b;
}

/* Tutarlılık denetimi. b: {kcal, yag, doymus, karb, seker, lif, protein, tuz} (100 g ya da 100 ml başına, g; enerji kcal).
   Döner: {durum: "tamam" | "suphe" | "yok", sorun: [kod], eksik: [anaSatir'dan eksikler], hesap: makro besinlerden kcal}.
   Sorun kodları: eksi, yuz_asti (bir satır 100 g'ı aşıyor), doymus_yag, seker_karb, toplam (satırların toplamı 100 g'ı aşıyor),
   enerji_ust, kj_kcal (enerji kJ olarak yazılmış/okunmuş görünüyor), enerji (beyan edilen enerji makro besinlerle uyuşmuyor). */
function besinDenetle(b){
  var A=BESIN_AYAR,v=function(k){return b?besinSayi(b[k]):null},s=[];
  var eksik=A.anaSatir.filter(function(k){return v(k)==null});
  if(!b||BESIN_ALAN.every(function(k){return v(k)==null}))return {durum:"yok",sorun:[],eksik:eksik,hesap:null};
  var ekle=function(k){if(s.indexOf(k)<0)s.push(k)};
  BESIN_ALAN.forEach(function(k){var x=v(k);if(x!=null&&x<0)ekle("eksi");if(x!=null&&k!=="kcal"&&x>100)ekle("yuz_asti")});
  if(v("doymus")!=null&&v("yag")!=null&&v("doymus")>v("yag")+A.yuvarlama)ekle("doymus_yag");
  if(v("seker")!=null&&v("karb")!=null&&v("seker")>v("karb")+A.yuvarlama)ekle("seker_karb");
  var top=0;["yag","karb","protein","lif","tuz"].forEach(function(k){top+=v(k)||0});
  if(top>A.toplamUst)ekle("toplam");
  if(v("kcal")!=null&&v("kcal")>A.kcalUst)ekle("enerji_ust");
  var h=null;
  if(v("kcal")!=null&&v("yag")!=null&&v("karb")!=null&&v("protein")!=null){
    var K=A.katsayi;h=K.yag*v("yag")+K.karb*v("karb")+K.protein*v("protein")+K.lif*(v("lif")||0);
    var pay=function(x,y){return Math.max(A.enerjiPay,A.enerjiOran*Math.max(x,y))};
    if(Math.abs(v("kcal")-h)>pay(v("kcal"),h)){
      if(h>0&&Math.abs(v("kcal")-h*A.kjKcal)<=pay(v("kcal"),h*A.kjKcal))ekle("kj_kcal");else ekle("enerji");
    }
    h=besinYuvarla(h);
  }
  return {durum:s.length?"suphe":"tamam",sorun:s,eksik:eksik,hesap:h};
}

/* ---------- Etiket metninden tablo ---------- */
/* Harf duyarsız, aksansız, her alfabede: "Doymuş Yağ" → "doymus yag", "Eiweiß" → "eiweiss", "Protéines" → "proteines" */
function besinNorm(s){
  return low(String(s==null?"":s).replace(/ß/g,"ss").normalize("NFD").replace(/[̀-ͯ]/g,"")).replace(/[^\p{L}\p{N}%]+/gu," ").trim();
}
/* data/besin.json → arama sözlüğü. adlar: [alan, dil, ad]; "_" ile başlayan alanlar işaret: _atla (tabloda olan ama kullanılmayan satır:
   trans yağ, nişasta…; daha kısa bir adın yanlış eşleşmesini önler), _porsiyon ve _ri (sütun başlıkları). */
function besinSozluk(veri){
  var S={ad:{},enUzun:1};
  ((veri&&veri.adlar)||[]).forEach(function(r){
    var k=besinNorm(r[2]);if(!k)return;
    var n=k.split(" ").length;if(n>S.enUzun)S.enUzun=n;
    if(!S.ad[k])S.ad[k]=r[0];
  });
  return S;
}
var BESIN_BIRIM={kcal:"kcal",kj:"kj",g:"g",gr:"g",mg:"mg","µg":"ug",mcg:"ug",ug:"ug",ml:"ml","%":"%"};
/* Metni parçalara ayırır: sayı (ondalık virgül/nokta, "<" ve bitişik birim), birim, sözcük, satır sonu */
function besinParcala(metin){
  var re=/([<≤]\s*)?(\d+(?:[.,]\d+)?)\s*(kcal|kj|mg|µg|mcg|ug|gr|g|ml|%)?(?![\p{L}\p{N}])|%|[\p{L}][\p{L}\p{M}'’-]*|\n|\.(?!\d)/giu,m,out=[];
  // E kodu ("E330", "E 150c") sayı değildir: içerik listesinde satır adının ardından gelirse değer sanılırdı ("Şeker, E330" → şekerler 330 g)
  var s=String(metin==null?"":metin).replace(/\r/g,"").replace(/(^|[^\p{L}\p{N}])[Ee][ -]?\d{3,4}[a-j]?(?![\p{L}\p{N}])/gu,"$1ekodu");
  while((m=re.exec(s))){
    if(m[0]==="\n"||m[0]==="."){out.push({t:"nl"});continue}   // cümle sonu da satır sonu gibi: "…, tuz. Besin değerleri" 
    if(m[2]!=null){
      var ham=m[2],v=Number(ham.replace(",",".")),u=m[3]?BESIN_BIRIM[m[3].toLowerCase()]:"";
      // "2.151 kJ": binlik ayırıcı (kJ'de üç ondalık hane olmaz)
      if(u==="kj"&&/^\d\.\d{3}$/.test(ham))v=Number(ham.replace(".",""));
      out.push({t:"s",v:v,u:u||"",lt:!!m[1],ham:ham,sifir:/^0\d/.test(ham)});
      continue;
    }
    if(m[0]==="%"){out.push({t:"u",u:"%"});continue}
    var w=besinNorm(m[0]);if(!w)continue;
    var bu=BESIN_BIRIM[w];
    if(bu&&w!=="g"||w==="g")out.push({t:"u",u:bu});
    else out.push({t:"w",w:w});
  }
  // birimi ayrı yazılmış sayı ("25,1 g" OCR'da "25,1" + "g"): birim sayıya bağlanır
  for(var i=0;i<out.length-1;i++)if(out[i].t==="s"&&!out[i].u&&out[i+1].t==="u"&&out[i+1].u!=="%"){out[i].u=out[i+1].u;out.splice(i+1,1)}
  // "%11": yüzde işareti sayıdan önce
  for(i=0;i<out.length-1;i++)if(out[i].t==="u"&&out[i].u==="%"&&out[i+1].t==="s"&&!out[i+1].u){out[i+1].u="%";out.splice(i,1)}
  return out;
}
/* Parçaların i'sinden başlayan en uzun satır adı ya da işaret: {alan, n: kullanılan parça sayısı} ya da null. Satır sonu atlanır. */
function besinAdBul(p,i,S){
  var ws=[],ix=[];
  for(var j=i;j<p.length&&ws.length<S.enUzun;j++){if(p[j].t==="nl")continue;if(p[j].t!=="w")break;ws.push(p[j].w);ix.push(j)}
  for(var n=ws.length;n>0;n--){var a=S.ad[ws.slice(0,n).join(" ")];if(a)return {alan:a,son:ix[n-1]}}
  return null;
}
/* Satırdaki sayılar → hücreler (sütunlar). Enerji satırında yan yana kJ + kcal tek hücredir. Birimsiz sayı: enerji satırında
   adın yanındaki "(kJ/kcal)" sırasıyla, diğer satırlarda g. Döner: [{v (g ya da kcal), lt, yuzde, sifir, birimsiz}] */
function besinHucre(sat){
  var out=[],q=sat.birimler.slice(),enerji=sat.alan==="enerji";
  for(var i=0;i<sat.s.length;i++){
    var x=sat.s[i],u=x.u;
    if(!u&&enerji&&q.length){u=q[0];q.push(q.shift())}
    if(u==="%"){out.push({yuzde:true});continue}
    if(enerji){
      var y=sat.s[i+1],uy=y&&(y.u||(!y.u&&q.length?q[0]:""));
      if((u==="kj"||u==="kcal")&&y&&(uy==="kj"||uy==="kcal")&&uy!==u){
        if(!y.u){q.push(q.shift())}
        var kcal=u==="kcal"?x:y;out.push({v:kcal.v,lt:kcal.lt,sifir:x.sifir||y.sifir});i++;continue;
      }
      if(u==="kcal")out.push({v:x.v,lt:x.lt,sifir:x.sifir});
      else if(u==="kj")out.push({v:x.v/BESIN_AYAR.kjKcal,lt:x.lt,sifir:x.sifir});
      else out.push({v:x.v,lt:x.lt,sifir:x.sifir,birimsiz:true});
      continue;
    }
    var g=u==="mg"?x.v/1000:u==="ug"?x.v/1e6:x.v;
    if(u==="kcal"||u==="kj"||u==="ml"){out.push({yuzde:true});continue}   // bu satırda anlamsız birim: sütun olarak sayılır, değer alınmaz
    out.push({v:g,lt:x.lt,sifir:x.sifir});
  }
  return out;
}
/* Etiket metninden besin değeri tablosu. metin: OCR çıktısı (satır sonları korunur); S: besinSozluk(data/besin.json).
   Döner: null (tablo yok) ya da {b, lt: {alan: "<" ile yazılmış}, birim: "g"|"ml"|"", sutun, yontem: "satir"|"sutun", durum, sorun, eksik, hesap}.
   Sütun: başlıktaki "100 g / 100 ml" sütununun sırası (porsiyon ve %RI sütunlarına göre); başlık yoksa ilk sütun alınır ama durum "suphe" olur.
   Ayrıştırma sorunları (yuz_yok: 100 g başlığı yok, sutun_sira: adlar ve değerler ayrı bloklarda, ondalik: "05" gibi virgülü kaybolmuş
   olabilecek sayı, birim_yok: enerjinin birimi yok, cok_satir: aynı satır iki kez) de durumu "suphe" yapar. */
function besinAyristir(metin,S){
  var p=besinParcala(metin),A=BESIN_AYAR,rows=[],cur=null,isaret=[],i,j,satirSonu=false,atlanan=0;
  for(i=0;i<p.length;i++){
    var x=p[i];
    if(x.t==="nl"){satirSonu=true;continue}
    if(x.t==="w"){
      var a=besinAdBul(p,i,S);
      if(a&&a.alan.charAt(0)!=="_"||a&&a.alan==="_atla"){
        cur={alan:a.alan,s:[],birimler:[]};rows.push(cur);
        i=a.son;satirSonu=false;atlanan=0;continue;
      }
      if(a&&(a.alan==="_porsiyon"||a.alan==="_ri")){isaret.push(a.alan==="_ri"?"ri":"porsiyon");i=a.son;cur=null;continue}
      // bilinmeyen sözcük: değeri okunmuş satırı bitirir; değeri henüz yoksa aynı satırda birkaç sözcük atlanır ("Enerji değeri")
      if(cur&&(cur.s.length||satirSonu||++atlanan>A.adlarArasiSozcuk))cur=null;
      continue;
    }
    if(x.t==="u"){if(cur&&!cur.s.length&&(x.u==="kj"||x.u==="kcal"))cur.birimler.push(x.u);continue}
    // sayı. Tablo başlığı "100 g" / "100 ml": açık satır yokken ya da satır adından sonra bilinmeyen sözcük gelmişken ("Tuz Besin değerleri 100 g").
    // Adın hemen ardındaki 100 g değerdir ("Yağ 100 g": sıvı yağ).
    if(x.v===100&&(x.u==="g"||x.u==="ml")&&(!cur||(!cur.s.length&&atlanan>0))){isaret.push(x.u==="ml"?"yuz_ml":"yuz_g");cur=null;continue}
    if(cur){cur.s.push(x);satirSonu=false}
  }
  rows=rows.filter(function(r){return r.alan!=="_atla"});
  // Adlar ve değerler ayrı bloklarda (OCR tabloyu sütun sütun okumuş): değersiz satırlar art arda, sonra tek satırda bütün değerler
  // Sütun: başlıktaki işaretlerin (100 g, porsiyon, %RI) sırasında "100 g"nin yeri
  var sutun=0,birim="",sorun=[],yi=-1;
  for(i=0;i<isaret.length;i++)if(isaret[i].indexOf("yuz")===0){yi=i;break}
  if(yi>=0){sutun=yi;birim=isaret[yi]==="yuz_ml"?"ml":"g"}else sorun.push("yuz_yok");
  var yontem="satir",bos=0;
  for(i=0;i<rows.length&&!rows[i].s.length;i++)bos++;
  // Akıştaki hücreler sütun sütun sırayla satırlara verilir; kJ ve kcal yan yanaysa tek hücre. Sıra tahmin olduğu için durum hep "suphe".
  if(bos>=2&&bos<rows.length&&rows.slice(bos+1).every(function(r){return !r.s.length})){
    var blok=rows.slice(0,bos+1),akis=rows[bos].s,hucreler=[];
    for(j=0;j<akis.length;j++){
      var y=akis[j],z=akis[j+1];
      if(z&&((y.u==="kj"&&z.u==="kcal")||(y.u==="kcal"&&z.u==="kj"))){hucreler.push([y,z]);j++}else hucreler.push([y]);
    }
    var bas=sutun*blok.length;
    if(hucreler.length>=bas+blok.length){
      blok.forEach(function(r,k){r.s=hucreler[bas+k]});
      rows=blok;yontem="sutun";sorun.push("sutun_sira");
    }
  }
  var hs=yontem==="sutun"?0:sutun;   // sütun sütun okunmuşsa her satırda tek hücre kaldı
  var b={},lt={},gorulen={};
  BESIN_ALAN.forEach(function(k){b[k]=null});
  var na=null;
  rows.forEach(function(r){
    var h=besinHucre(r)[hs];if(!h||h.yuzde||h.v==null||!isFinite(h.v))return;
    var k=r.alan==="enerji"?"kcal":r.alan;
    if(k==="sodyum"){if(na==null)na=h;return}
    if(BESIN_ALAN.indexOf(k)<0)return;
    if(gorulen[k]){if(Math.abs(b[k]-h.v)>1e-9&&sorun.indexOf("cok_satir")<0)sorun.push("cok_satir");return}   // çok dilli etikette aynı satır tekrar: aynıysa sorun yok
    gorulen[k]=1;b[k]=besinYuvarla(h.v);if(h.lt)lt[k]=true;
    if(h.sifir&&sorun.indexOf("ondalik")<0)sorun.push("ondalik");
    if(h.birimsiz&&sorun.indexOf("birim_yok")<0)sorun.push("birim_yok");
  });
  if(b.tuz==null&&na){b.tuz=besinYuvarla(na.v*A.tuzSodyum);if(na.lt)lt.tuz=true}
  var n=BESIN_ALAN.filter(function(k){return b[k]!=null}).length;
  if(n<A.enAzSatir&&!(n>=2&&(b.kcal!=null||yi>=0)))return null;
  var d=besinDenetle(b),hepsi=sorun.concat(d.sorun);
  return {b:b,lt:lt,birim:birim,sutun:sutun,yontem:yontem,durum:hepsi.length?"suphe":d.durum,sorun:hepsi,eksik:d.eksik,hesap:d.hesap};
}

/* ---------- Renkli gösterim (3. adım) ----------
   Eşikler: Birleşik Krallık Sağlık Bakanlığı, ön yüz besin etiketi kılavuzu (2016), Ek 3, Tablo 2 (gıda, 100 g) ve Tablo 3 (içecek, 100 ml).
   Düşük (yeşil) üst sınırı AB 1924/2006 "düşük" beslenme beyanı eşiği. Düşük ≤ alt; alt < Orta ≤ üst; Yüksek > üst.
   Porsiyon ölçütü (porsiyon > 100 g ya da 150 ml ise %30 RI) uygulanmaz: porsiyon büyüklüğü bilinmiyor; ekranda yazılır.
   Enerji renklendirilmez (kılavuz). Yeni ülkenin eşikleri ayrı kayıt olarak eklenir (ülke katmanı B-05). */
var BESIN_ESIK={
  kaynak:"uk_fop_2016",
  url:"https://www.gov.uk/government/publications/front-of-pack-nutrition-labelling-guidance",
  g:{yag:[3,17.5],doymus:[1.5,5],seker:[5,22.5],tuz:[0.3,1.5]},
  ml:{yag:[1.5,8.75],doymus:[0.75,2.5],seker:[2.5,11.25],tuz:[0.3,0.75]}
};
/* Kullanıcı onayından sonra da renk göstermeyen sorunlar (değerler birbiriyle çelişiyor). Enerji ve ayrıştırma sorunları onayla kalkar
   (alkollü içecek, okunamayan başlık): renklenen dört satır enerjiye bağlı değil. */
var BESIN_KESIN=["eksi","yuz_asti","doymus_yag","seker_karb","toplam"];
/* v: değer (g / 100 g ya da 100 ml), lt: "<" ile yazılmış, birim: "g" | "ml". Döner: "dusuk" | "orta" | "yuksek" | null (bilinmiyor) */
function besinDuzey(alan,v,lt,birim){
  var e=BESIN_ESIK[birim]&&BESIN_ESIK[birim][alan];v=besinSayi(v);
  if(!e||v==null)return null;
  if(lt)return v<=e[0]?"dusuk":null;   // "< 0,5 g": eşiğin altında kalıyorsa düşük; yoksa gerçek değer bilinmiyor
  return v<=e[0]?"dusuk":v<=e[1]?"orta":"yuksek";
}
/* Ekrandaki model. k: {b, lt, birim, sorun (ayrıştırma + denetim), onay (kullanıcı değerleri doğruladı ya da düzeltti)}.
   Döner: {renk: bool, neden: "suphe"|"birim"|"" , birim, satir: [{alan, v, lt, duzey}], enerji, sorun, eksik} ya da null (değer yok).
   Renk yalnızca: birim biliniyor ve (sorun yok ya da kullanıcı onayladı ve kesin çelişki yok). */
function besinGorunum(k){
  if(!k||!k.b)return null;
  var d=besinDenetle(k.b);if(d.durum==="yok")return null;
  var sorun=(k.sorun||[]).slice();d.sorun.forEach(function(s){if(sorun.indexOf(s)<0)sorun.push(s)});
  var kesin=sorun.some(function(s){return BESIN_KESIN.indexOf(s)>=0});
  var birim=k.birim==="ml"||k.birim==="g"?k.birim:"";
  var neden=kesin||(sorun.length&&!k.onay)?"suphe":!birim?"birim":"";
  var lt=k.lt||{};
  return {
    renk:!neden,neden:neden,birim:birim,sorun:sorun,eksik:d.eksik,onay:!!k.onay,
    enerji:besinSayi(k.b.kcal),
    satir:BESIN_AYAR.anaSatir.map(function(a){var v=besinSayi(k.b[a]);return {alan:a,v:v,lt:!!lt[a],duzey:neden?null:besinDuzey(a,v,lt[a],birim)}})
  };
}
/* Kullanıcının elle düzelttiği tablo, metne bağlı saklanır (localStorage "besin_elle"): aynı metin yeniden açılınca düzeltme geri gelir.
   Anahtar metnin özeti (djb2); en çok BESIN_ELLE_EN kayıt, en eskisi düşer. */
var BESIN_ELLE_EN=100;
function besinMetinAnahtar(mode,metin){
  var s=(mode||"gida")+"\n"+String(metin==null?"":metin).trim(),h=5381;
  for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;
  return (h>>>0).toString(36)+"_"+s.length.toString(36);
}
function besinElleEkle(liste,anahtar,kayit){
  var a=(Array.isArray(liste)?liste:[]).filter(function(x){return x&&x.k!==anahtar});
  a.unshift({k:anahtar,b:kayit.b,birim:kayit.birim||"",t:kayit.t||0});
  return a.slice(0,BESIN_ELLE_EN);
}
function besinElleBul(liste,anahtar){return (Array.isArray(liste)?liste:[]).filter(function(x){return x&&x.k===anahtar&&x.b})[0]||null}
