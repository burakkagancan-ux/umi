/* Arayüz: barkodla ürün bulma (Etiket Oku). Saf mantık js/barkod.js; Worker uç noktaları /urun ve /off (worker/src/index.js).
   Akış: barkod (kamera, barkodun fotoğrafı ya da elle) → uygulamadaki Open Food Facts verisi ve kendi veritabanımız → OFF canlı sorgu
   → bulunursa içerik kutuya yazılır ve bugünkü analiz çalışır, üstte kaynak kartı ("etiket farklı olabilir", "fotoğrafla doğrula");
   bulunamazsa içerik listesinin fotoğrafı istenir ve okunan metin, kullanıcının açık izniyle barkodla birlikte kaydedilir.
   Bekleyen barkod sessionStorage'da da tutulur: telefon kamerayı açarken sayfayı yeniden yüklerse eşleşme kaybolmasın.
   Ters sıra (isteğe bağlı): önce içerik fotoğrafı okunur, sonuçtaki "Barkodu okut ve eşleştir" ile barkod sonradan bağlanır.
   Besin tablosu (A-02, isteğe bağlı): barkodun ekranındaki metne tablonun fotoğrafı eklenince (js/arayuz_besin.js) okunan değerler de
   açık izinle barkoda bağlanır (Worker POST /besin); içerik katkısından ayrıdır, içeriği bulunmuş ürüne de eklenebilir.
   Kamera: tarayıcının BarcodeDetector'ı; yoksa (iOS Safari) js/vendor/zxing (yalnızca gerekince yüklenir). */
var BARKOD=null;                 // {kod, r: bulunan sonuç ya da null, metin: kutuya yazılan içerik, t: zaman, foto: sonrasında etiket fotoğrafı okundu, katki: öneri bitti,
                                 //  icerik: fotoğraftan okunan içerik (katkı metni), ek: besin tablosu eklenmiş metin, soru/besinSoru: yanıtlanmamış soru kartı,
                                 //  cevap/besinCevap: "evet"|"hayir", besinGitti: gönderilen tablo (aynısı yeniden gitmez)}
var BARKOD_OFF=null;             // data/barkod_off.json (ilk barkodda yüklenir)
var BARKOD_FOTO_SURE=10*60000;   // barkoddan sonra en çok bu süre içinde okunan etiket fotoğrafı o barkodla ilişkilendirilir
var BARKOD_FOTO_METIN=null;      // son okunan içerik fotoğrafının metni ("Barkodu okut ve eşleştir" yalnızca ona sunulur)
var BARKOD_BEKLE="barkod_bekleyen";   // sessionStorage: bulunamayan barkod {kod, ad, tur, t}, fotoğraf gelene kadar
function barkodSira(){return [DIL.kod,"tr","en"].filter(function(x,i,a){return a.indexOf(x)===i})}
function barkodWorker(yol,opt){
  if(!OCR_URL)return Promise.resolve(null);
  var c=typeof AbortController!=="undefined"?new AbortController():null,tm=setTimeout(function(){if(c)c.abort()},BARKOD_AYAR.zamanAsimi);
  var o=opt||{};if(c)o.signal=c.signal;
  return fetch(OCR_URL.replace(/\/$/,"")+yol,o).then(function(r){return r.ok?r.json():null}).catch(function(){return null}).then(function(j){clearTimeout(tm);return j});
}
function barkodOffYukle(){
  if(BARKOD_OFF)return Promise.resolve(BARKOD_OFF);
  return getJson(BARKOD_AYAR.offDosya).then(function(j){BARKOD_OFF=j;return j}).catch(function(){return null});
}
function barkodUrun(kod){
  return barkodWorker("/urun/"+kod).then(function(j){
    if(!j||(!j.bulundu&&!j.besin))return null;
    var m={};if(j.bulundu)m[j.dil||"?"]=j.metin;   // içeriksiz kayıt yalnızca besin tablosu taşır (barkodBesinEkle)
    var r={kod:kod,kaynak:"urun",tur:j.bulundu?barkodTur(j.tur):"gida",ad:"",marka:"",t:j.t||0,metin:m,dogrulandi:!!j.dogrulandi,sayi:j.sayi||1};
    var bs=j.besin&&typeof besinKayitNorm==="function"?besinKayitNorm(j.besin):null;
    if(bs){r.besin=bs.b;r.besin.birim=bs.birim;r.besinLt=bs.lt;r.besinPor=bs.por||null;r.besinKaynak="topluluk";r.besinT=j.besinT||0;r.besinDogrulandi=!!j.besinDogrulandi}
    return r;
  });
}
function barkodOffCanli(kod){
  return barkodWorker("/off/"+kod).then(function(j){
    if(!j||!j.bulundu)return null;
    return {kod:kod,kaynak:"off",canli:true,db:j.db,tur:barkodTur(j.db),ad:j.ad||"",marka:j.marka||"",t:j.t||0,metin:j.metin||{},dogrulandi:null,besin:j.besin||null,kat:Array.isArray(j.kat)?j.kat:[]};
  });
}
/* Barkodu sırayla arar → bulunan sonuç (içeriksiz olabilir: r.icerikYok) ya da null */
function barkodAra(kod){
  var sira=barkodSira(),s={};
  return Promise.all([barkodOffYukle().then(function(v){s.off=barkodOffBul(v,kod)}),barkodUrun(kod).then(function(u){s.urun=u})]).then(function(){
    var r=barkodSec(s,sira);
    if(r&&!r.icerikYok)return r;
    return barkodOffCanli(kod).then(function(c){s.offCanli=c;return barkodSec(s,sira)});
  }).then(function(r){
    if(r&&r.ad&&!r.icerikYok&&s.off&&s.off.ad&&!r.ad){r.ad=s.off.ad;r.marka=s.off.marka}
    return r;
  });
}
/* Barkod bulundu: sırayla ara, sonucu göster */
function barkodIsle(ham){
  var kod=barkodNorm(ham);
  if(!kod){ST.textContent=t("barkod.gecersiz",{kod:barkodTemiz(ham)});return}
  ST.textContent=t("barkod.araniyor",{kod:kod});
  barkodAra(kod).then(function(r){if(!r||r.icerikYok)barkodYok(kod,r);else barkodGoster(kod,r)});
}
function barkodAd(r){return r&&r.ad?((r.marka&&r.ad.toLocaleLowerCase(DIL.yerel).indexOf(r.marka.toLocaleLowerCase(DIL.yerel))<0?r.marka+" ":"")+r.ad):""}
function barkodGoster(kod,r){
  var m=barkodMetin(r.metin,barkodSira());
  BARKOD={kod:kod,r:r,metin:m.s,dil:m.dil,t:Date.now(),foto:false,katki:false,ad:false};
  barkodBekleSil();fotoTemizle();
  $("metin").value="";HMOD=null;
  if(r.tur!==MODE)setMode(r.tur,true);
  $("metin").value=m.s;HSCAN=HOCR=true;
  ST.textContent=t("barkod.bulundu",{kod:kod});
  rozetSay("dedektif",r.tur,"b:"+kod,rozetGoster);   // aynı barkod bir kez sayılır
  olcumTarama("b",r.tur);
  run();
}
function barkodYok(kod,r){
  BARKOD={kod:kod,r:null,ad:r?barkodAd(r):"",kat:r&&r.kat||[],metin:null,t:Date.now(),foto:false,katki:false};
  barkodBekleYaz();
  olcumTarama("y");
  fotoTemizle();
  if(r&&r.tur&&r.tur!==MODE){$("metin").value="";setMode(r.tur,true)}
  barkodYokKart(kod,(r&&r.tur)||MODE,true);
}
/* "Henüz veritabanında yok" kartı; bildir: eksik ürünler listesine bildirilir (sayfa yeniden açılınca bir daha bildirilmez) */
function barkodYokKart(kod,tur,bildir){
  $("metin").value="";
  var box=$("sonuc");box.textContent="";
  var d=el("div","res u bkaynak");
  d.appendChild(el("div","t",BARKOD.ad?t("barkod.icerik_yok",{ad:BARKOD.ad}):t("barkod.yok_baslik")));
  d.appendChild(el("div","ln",t("barkod.yok_metin")));
  d.appendChild(el("div","how",t("barkod.kod",{kod:kod})));
  var row=el("div","row"),b=el("button",null,t("barkod.foto_cek"));b.type="button";b.onclick=function(){$("foto").click()};
  var g=el("button","alt",t("foto.dosya"));g.type="button";g.onclick=function(){$("dosya").click()};
  row.appendChild(b);row.appendChild(g);d.appendChild(row);box.appendChild(d);
  ST.textContent=t("barkod.yok_durum",{kod:kod});
  // Topluluk (G-04): eksik ürünler listesi için bir kez bildirilir; başkaları da aradıysa söylenir
  if(bildir)arananBildir(kod,tur,function(n){if(BARKOD&&BARKOD.kod===kod&&d.isConnected)d.insertBefore(el("div","how",t("topluluk.yok_arandi",{n:n,s:dilSayi(n)})),row)});
}
/* Etiket fotoğrafı okundu (js/arayuz_sayfa.js çağırır): barkoddan sonra süre içindeyse o barkodla ilişkilenir */
function barkodFoto(){
  BARKOD_FOTO_METIN=$("metin").value.trim();barkodBekleSil();
  if(!BARKOD)return;
  if(Date.now()-BARKOD.t>BARKOD_FOTO_SURE){BARKOD=null;return}
  BARKOD.foto=true;BARKOD.katki=false;
  ["icerik","ek","soru","cevap","besinSoru","besinCevap","besinGitti"].forEach(function(k){BARKOD[k]=null});   // yeni içerik fotoğrafı: baştan
}
/* Bekleyen (bulunamayan) barkod oturum deposunda: kamera açılırken sayfa yeniden yüklenirse barkodGeriAl geri getirir */
function barkodBekleYaz(){try{sessionStorage.setItem(BARKOD_BEKLE,JSON.stringify({kod:BARKOD.kod,ad:BARKOD.ad,kat:BARKOD.kat||[],tur:MODE,t:BARKOD.t}))}catch(e){}}
function barkodBekleSil(){try{sessionStorage.removeItem(BARKOD_BEKLE)}catch(e){}}
function barkodGeriAl(){   // açılışta, dil ve mod hazır olunca (js/arayuz_sayfa.js)
  if(!BARKOD_AYAR.acik||!$("barkodb"))return;
  var b=null;try{b=JSON.parse(sessionStorage.getItem(BARKOD_BEKLE)||"null")}catch(e){}
  if(!b||!barkodGecerli(b.kod)||!(Date.now()-b.t<BARKOD_FOTO_SURE)||BARKOD||$("metin").value.trim()){barkodBekleSil();return}
  BARKOD={kod:b.kod,r:null,ad:String(b.ad||""),kat:Array.isArray(b.kat)?b.kat.filter(function(x){return typeof x==="string"}).slice(0,60):[],metin:null,t:b.t,foto:false,katki:false};
  if(b.tur&&b.tur!==MODE&&["gida","koz","tem"].indexOf(b.tur)>-1)setMode(b.tur,true);
  barkodYokKart(b.kod,MODE,false);
}
/* Metin barkodun ekranındaki metin mi: bulunan içerik (fotoğrafsız), fotoğraftan okunan içerik ya da tablosu eklenmiş hali */
function barkodEkranda(tx){
  if(!BARKOD)return false;tx=String(tx||"").trim();
  return !!tx&&(tx===BARKOD.ek||(BARKOD.foto?tx===BARKOD.icerik:!!BARKOD.metin&&tx===BARKOD.metin.trim()));
}
/* Besin kartı için metnin bağlı olduğu barkod (A-08 ürün tipi: kategori ve ad). Fotoğraf barkoddan sonra okunduysa ilk çizimde
   BARKOD.icerik henüz atanmamıştır (barkodSonra kart çizildikten sonra atar): o anda ekrandaki metin o fotoğrafın metnidir. */
function barkodBesinBag(tx){
  if(!BARKOD)return null;
  if(barkodEkranda(tx))return BARKOD;
  return BARKOD.foto&&!BARKOD.icerik&&String(tx||"").trim()?BARKOD:null;
}
/* Besin tablosu metne eklendi (js/arayuz_besin.js besinEkUygula; eski: tablodan önceki metin(ler)) */
function barkodBesinEk(eski,ek){
  if(BARKOD&&eski.some(barkodEkranda))BARKOD.ek=String(ek||"").trim();
}
/* Her analizden sonra (run) çağrılır: kaynak kartı, geçmişte ürün adı, katkı önerisi */
function barkodSonra(){
  if(!$("sonuc").querySelector(".resbar")){
    // Fotoğrafta hiçbir şey tanınmadı: eşleşme bekliyor, nedeni ve çaresi söylenir (çerçeve değişince yeniden okunur)
    if(BARKOD&&BARKOD.foto&&$("metin").value.trim()&&OCR_URL)$("sonuc").appendChild(el("div","res u bkaynak how",t("barkod.uygun_degil",{kod:BARKOD.kod})));
    return;
  }
  if(!BARKOD){barkodEslestirOner();return}
  var tx=$("metin").value.trim(),ek=!!BARKOD.ek&&tx===BARKOD.ek;
  if(BARKOD.metin&&!BARKOD.foto&&(ek||tx===BARKOD.metin.trim())){
    sonucUst(barkodKaynakKart());
    if(!BARKOD.adVerildi){BARKOD.adVerildi=true;barkodGecmisAdi(barkodAd(BARKOD.r))}
    barkodBesinKatki();
    return;
  }
  if(BARKOD.foto&&tx){
    if(!ek){BARKOD.icerik=tx;BARKOD.ek=null}
    if(BARKOD.ad&&!BARKOD.adVerildi){BARKOD.adVerildi=true;barkodGecmisAdi(BARKOD.ad)}
    if(BARKOD.sonradan)sonucUst(el("div","res u bkaynak how",t("barkod.eslesti",{kod:BARKOD.kod})));
    barkodKatki();
    barkodBesinKatki();
    return;
  }
  BARKOD=null;   // metin elle başka bir şeye çevrildi: barkodla ilişki biter
  barkodEslestirOner();
}
/* Ters sıra: içerik fotoğrafı okunmuş, barkod yok → sonuçta "Barkodu okut ve eşleştir" (yalnızca içerik listesine benzeyen metinde) */
function barkodEslestirOner(){
  var tx=$("metin").value.trim();
  if(!BARKOD_AYAR.acik||!OCR_URL||!$("barkodb")||!tx||tx!==BARKOD_FOTO_METIN||!barkodUygun(tx))return;
  var d=el("div","res u bkaynak beslestir");
  d.appendChild(el("div","how",t("barkod.eslestir_metin")));
  var b=el("button","alt",t("barkod.eslestir"));b.type="button";
  b.onclick=function(){barkodAc(b,function(ham){barkodEslestir(ham,tx,d)})};
  d.appendChild(b);sonucUst(d);
}
/* Okutulan barkod ekrandaki (fotoğraftan okunmuş) içerikle eşleşir: içerik fotoğraftan kalır, barkoddan yalnızca ürün adı alınır */
function barkodEslestir(ham,tx,kart){
  var kod=barkodNorm(ham);
  if(!kod){ST.textContent=t("barkod.gecersiz",{kod:barkodTemiz(ham)});return}
  if($("metin").value.trim()!==tx){barkodIsle(kod);return}   // arada metin değişti: olağan barkod akışı
  var B=BARKOD={kod:kod,r:null,ad:"",metin:null,t:Date.now(),foto:true,katki:false,sonradan:true};
  if(kart)kart.remove();
  ST.textContent=t("barkod.araniyor",{kod:kod});
  barkodAra(kod).then(function(r){
    if(B!==BARKOD)return;
    B.ad=r?barkodAd(r):"";B.kat=r&&r.kat||[];
    // A-08: besin kartı barkoddan önce çizildi; ürün tipi kategoriden bilinince kart yeniden çizilir
    var bk=$("sonuc").querySelector(".res.besin");if(bk&&B.kat.length&&typeof besinKart==="function")bk.replaceWith(besinKart(tx));
    ST.textContent=t("barkod.eslesti",{kod:kod});
    barkodSonra();
  });
}
function barkodGecmisAdi(ad){
  if(!ad||!HCUR)return;
  var e=histLoad().filter(function(x){return x.id===HCUR})[0];
  if(e&&histOtoNo(e.name))histRename(HCUR,ad.slice(0,60));
}
function barkodKaynakKart(){
  var r=BARKOD.r,d=el("div","res u bkaynak");
  d.appendChild(el("div","t",barkodAd(r)||t("barkod.kod",{kod:BARKOD.kod})));
  var l=el("div","ln");
  if(r.kaynak==="off"){
    var dom={food:"world.openfoodfacts.org",beauty:"world.openbeautyfacts.org",products:"world.openproductsfacts.org"}[r.db]||"world.openfoodfacts.org";
    l.appendChild(document.createTextNode(r.t?t("barkod.kaynak_off",{tarih:dilTarih(r.t,"gun")}):t("barkod.kaynak_off_tarihsiz")));
    l.appendChild(document.createTextNode(" "));
    var a=el("a",null,t("barkod.off_ad"));a.href="https://"+dom+"/product/"+BARKOD.kod;a.target="_blank";a.rel="noopener";l.appendChild(a);
  }else l.appendChild(document.createTextNode(r.dogrulandi?t("barkod.kaynak_urun_dogru",{n:r.sayi}):t("barkod.kaynak_urun")));
  d.appendChild(l);
  if(BARKOD.dil&&BARKOD.dil!==DIL.kod)d.appendChild(el("div","how",t("barkod.dil",{dil:barkodDilAdi(BARKOD.dil)})));
  d.appendChild(el("div","how",t("barkod.etiket_asil")));
  var b=el("button","alt",t("barkod.dogrula"));b.type="button";b.onclick=function(){BARKOD.t=Date.now();$("foto").click()};
  d.appendChild(b);
  return d;
}
function barkodDilAdi(k){
  if(DIL.bilgi&&DIL.bilgi[k]&&DIL.bilgi[k].ad)return DIL.bilgi[k].ad;
  try{return new Intl.DisplayNames([DIL.yerel],{type:"language"}).of(k)}catch(e){return k}
}
/* Okunan içerik, kaydetmeye uygun mu (çoğu tanınmış bir içerik listesi) */
function barkodUygun(tx){
  try{
    var c=degBaglam();if(!degHazir(MODE,c))return false;
    var P=degerlendir(MODE,tx,c,null,""),n=degTanima(P);return barkodKatkiUygun(P.mode,n.total,n.found);
  }catch(e){return false}
}
function barkodIzin(){return depoMetin("barkod_katki")||""}
function barkodIzinYaz(v){if(v)depoYazMetin("barkod_katki",v);else depoSil("barkod_katki")}
/* Katkıcı kimliği yalnızca ilk katkıda üretilir (katkı yapmayanın cihazında hiç yoktur); yedek dosyasına girer */
function katkiciAl(){return depoMetin("katkici")||""}
function katkiciYaz(k){if(katkiciGecerli(k))depoYazMetin("katkici",k)}
function katkiciKimlik(){
  var k=katkiciAl();if(katkiciGecerli(k))return k;
  try{var b=new Uint8Array(16);crypto.getRandomValues(b);k=katkiciUret(b)}catch(e){return ""}
  katkiciYaz(k);return katkiciAl()===k?k:"";   // saklanamıyorsa (gizli sekme) kimliksiz gönderilir
}
function barkodDil(tx){return /[ğışĞİŞ]|içindekiler/i.test(tx)?"tr":/\b(ingredients|contains)\b/i.test(tx)?"en":""}
function barkodGonder(B,tx){
  return barkodWorker("/urun",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kod:B.kod,tur:MODE,dil:barkodDil(tx),metin:tx,kim:katkiciKimlik()||undefined})});
}
/* İçerik katkısı önerisi (fotoğraftan okunan içerik için bir kez). Sonuç yeniden çizilince (ör. tablo eklendi) yanıtlanmamış soru yerinde kalır. */
function barkodKatki(){
  var B=BARKOD,tx=B.icerik;
  if(B.katki){if(B.soru&&!B.soru.isConnected)sonucUst(B.soru);else if(B.uygunDegil&&!B.uygunDegil.isConnected)sonucUst(B.uygunDegil);return}
  B.katki=true;B.uygunDegil=null;
  var iz=barkodIzin();
  if(iz==="hayir"||!OCR_URL)return;
  // İçerik listesine benzemiyorsa (ör. bütün paket okundu) sessizce düşmesin: nedeni ve çaresi söylenir
  if(!barkodUygun(tx)){B.uygunDegil=el("div","res u bkaynak how",t("barkod.uygun_degil",{kod:B.kod}));sonucUst(B.uygunDegil);return}
  if(iz==="evet"){barkodGonder(B,tx);B.cevap="evet";sonucUst(el("div","res u bkaynak how",t("barkod.katki_gitti",{kod:B.kod})));return}
  var d=el("div","res u bkaynak");
  d.appendChild(el("div","t",t("barkod.katki_soru")));
  d.appendChild(el("div","ln",t("barkod.katki_ne",{kod:B.kod})+(B.ad?" ("+B.ad+")":"")));
  if(MODE==="gida")d.appendChild(el("div","how",t("barkod.katki_besin")));
  d.appendChild(el("div","how",t("barkod.katki_gizlilik")));
  var lb=el("label","pc"),cb=document.createElement("input");cb.type="checkbox";lb.appendChild(cb);lb.appendChild(document.createTextNode(" "+t("barkod.katki_hatirla")));
  var row=el("div","row"),e=el("button",null,t("barkod.katki_evet")),h=el("button","alt",t("barkod.katki_hayir"));e.type=h.type="button";
  e.onclick=function(){
    if(cb.checked)barkodIzinYaz("evet");barkodGonder(B,tx);B.cevap="evet";B.soru=null;
    var bs=B===BARKOD&&barkodBesinGonder(B);   // tablo eklenmişse o da gider (soru tabloyu da anlatıyor)
    d.textContent="";d.appendChild(el("div","how",t(bs?"barkod.katki_tesekkur_besin":"barkod.katki_tesekkur")));
    if(!bs&&MODE==="gida")d.appendChild(el("div","how",t("barkod.besin_ipucu")));
  };
  h.onclick=function(){if(cb.checked)barkodIzinYaz("hayir");B.cevap="hayir";B.soru=null;d.remove()};
  row.appendChild(e);row.appendChild(h);d.appendChild(row);d.appendChild(lb);
  B.soru=d;sonucUst(d);
}
/* Ekrandaki, etiketten okunmuş (ya da okunup elle düzeltilmiş) besin tablosu; şüpheliyse ya da OFF'tan geliyorsa null (OFF verisi
   kendi veritabanımıza yazılmaz, ODbL ayrımı). Döner {b, lt, birim, por?} (por: porsiyondan çevrildi, yuvarlama aralığıyla; O-23). */
function barkodBesinAl(){
  if(MODE!=="gida"||typeof besinKaynak!=="function")return null;
  var tx=$("metin").value;if(!barkodEkranda(tx))return null;
  var K=besinKaynak(tx);if(!K||!K.okunan||(K.kaynak!=="etiket"&&K.kaynak!=="elle"))return null;
  var G=besinGorunum(K.k);if(!G||G.neden==="suphe")return null;
  var o={b:K.k.b,lt:K.k.lt||{},birim:G.birim};if(K.k.por)o.por=K.k.por;
  return o;
}
/* Tabloyu barkoda gönderir. Döner: 0 tablo yok, 1 aynısı zaten gitti, 2 şimdi gönderildi */
function barkodBesinGonder(B){
  var p=barkodBesinAl();if(!p)return 0;
  var k=JSON.stringify(p);if(B.besinGitti===k)return 1;
  B.besinGitti=k;
  barkodWorker("/besin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kod:B.kod,besin:p,kim:katkiciKimlik()||undefined})});
  return 2;
}
/* Besin tablosu katkısı: içerik için "Kaydet" denmişse (ya da tercih "her zaman") sormadan, yoksa ayrı soruyla. İçerik sorusu
   bekliyorsa onun "Kaydet"i tabloyu da gönderir. Düzeltilen tablo yeniden gider (Worker aynı katkıcının satırını yeniler). */
function barkodBesinKatki(){
  var B=BARKOD,iz=barkodIzin();
  if(!B||iz==="hayir"||B.cevap==="hayir"||B.besinCevap==="hayir"||!OCR_URL||B.soru||!barkodBesinAl())return;
  if(iz==="evet"||B.cevap==="evet"||B.besinCevap==="evet"){
    if(barkodBesinGonder(B)===2)sonucUst(el("div","res u bkaynak how",t("barkod.besin_gitti",{kod:B.kod})));
    return;
  }
  if(B.besinSoru){if(!B.besinSoru.isConnected)sonucUst(B.besinSoru);return}
  var d=el("div","res u bkaynak"),ad=B.ad||barkodAd(B.r);
  d.appendChild(el("div","t",t("barkod.besin_soru")));
  d.appendChild(el("div","ln",t("barkod.besin_ne",{kod:B.kod})+(ad?" ("+ad+")":"")));
  d.appendChild(el("div","how",t("barkod.katki_gizlilik")));
  var lb=el("label","pc"),cb=document.createElement("input");cb.type="checkbox";lb.appendChild(cb);lb.appendChild(document.createTextNode(" "+t("barkod.katki_hatirla")));
  var row=el("div","row"),e=el("button",null,t("barkod.katki_evet")),h=el("button","alt",t("barkod.katki_hayir"));e.type=h.type="button";
  e.onclick=function(){
    if(cb.checked)barkodIzinYaz("evet");B.besinCevap="evet";B.besinSoru=null;
    var g=B===BARKOD&&barkodBesinGonder(B);
    d.textContent="";d.appendChild(el("div","how",g?t("barkod.besin_gitti",{kod:B.kod}):t("barkod.katki_tesekkur")));
  };
  h.onclick=function(){if(cb.checked)barkodIzinYaz("hayir");B.besinCevap="hayir";B.besinSoru=null;d.remove()};
  row.appendChild(e);row.appendChild(h);d.appendChild(row);d.appendChild(lb);
  B.besinSoru=d;sonucUst(d);
}
/* Profilim: katkı tercihi (Sor / Her zaman kaydet / Kaydetme) */
function barkodAyarKutusu(){
  var d=el("div","pbark"),hd=el("div","pt",t("barkod.ayar_baslik"));d.appendChild(hd);
  // açıklama (i) düğmesinin arkasında, alt sayfada
  var ib=el("button","info sm","i");ib.type="button";ib.setAttribute("aria-label",t("ortak.hakkinda",{ad:t("barkod.ayar_baslik")}));
  ib.onclick=function(){openSheet(t("barkod.ayar_baslik"),null,el("p",null,t("barkod.ayar_metin")),ib)};hd.appendChild(ib);
  var s=document.createElement("select");s.setAttribute("aria-label",t("barkod.ayar_baslik"));
  [["",t("barkod.ayar_sor")],["evet",t("barkod.ayar_evet")],["hayir",t("barkod.ayar_hayir")]].forEach(function(o){var op=document.createElement("option");op.value=o[0];op.textContent=o[1];s.appendChild(op)});
  s.value=barkodIzin();s.onchange=function(){barkodIzinYaz(s.value)};
  d.appendChild(s);return d;
}

/* ---------- Okuma: kamera, barkodun fotoğrafı ya da elle ---------- */
var BARKOD_AKIS=null,BARKOD_DONGU=null,BARKOD_ZX=null;
function barkodDur(){
  clearTimeout(BARKOD_DONGU);BARKOD_DONGU=null;
  if(BARKOD_AKIS){BARKOD_AKIS.getTracks().forEach(function(tr){tr.stop()});BARKOD_AKIS=null}
}
function barkodZxYukle(){
  if(window.ZXing)return Promise.resolve(window.ZXing);
  if(BARKOD_ZX)return BARKOD_ZX;
  BARKOD_ZX=new Promise(function(ok,no){var s=document.createElement("script");s.src="js/vendor/zxing-0.21.3.min.js";s.onload=function(){ok(window.ZXing)};s.onerror=no;document.head.appendChild(s)});
  return BARKOD_ZX;
}
/* Çözücü: (kaynak: video, resim ya da tuval; tum: bütün yönler bir seferde, fotoğraf için) → barkod metni ya da null */
function barkodCozucu(){
  if("BarcodeDetector" in window){
    return Promise.resolve(BarcodeDetector.getSupportedFormats?BarcodeDetector.getSupportedFormats():["ean_13"]).then(function(f){
      var bi=["ean_13","ean_8","upc_a","upc_e"].filter(function(x){return f.indexOf(x)>-1});
      if(!bi.length)throw new Error("format");
      var det=new BarcodeDetector({formats:bi});
      return function(src){return det.detect(src).then(function(l){return l.length?l[0].rawValue:null},function(){return null})};
    }).catch(barkodZxCozucu);
  }
  return barkodZxCozucu();
}
/* ZXing çizgi barkodu yalnızca yataya yakınken (±30°) okur: kare döndürülerek denenir. Canlı kamerada her karede bir yön (yatay ve dik
   daha sık), fotoğrafta hepsi. ZXing'in kendi 90° denemesi kapalı (kare başına tek geçiş). decodeWithState: decode(bm) ipuçlarını siler,
   TRY_HARDER düşer ve yalnızca görüntünün ortasındaki birkaç satır taranır (barkod ortada ve yatay değilse okunmuyordu). */
var BARKOD_YON=[0,90,45,0,90,135];
function barkodZxCozucu(){
  return barkodZxYukle().then(function(Z){
    var h=new Map(),F=Z.BarcodeFormat;h.set(Z.DecodeHintType.POSSIBLE_FORMATS,[F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E]);h.set(Z.DecodeHintType.TRY_HARDER,true);
    var rd=new Z.MultiFormatReader();rd.setHints(h);
    var cv=document.createElement("canvas"),x=cv.getContext("2d",{willReadFrequently:true}),n=0;
    function dene(src,w,hh,a){
      var sc=Math.min(1,1280/Math.max(w,hh)),W=w*sc,H=hh*sc,r=a*Math.PI/180,c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r));
      cv.width=Math.round(W*c+H*s);cv.height=Math.round(W*s+H*c);
      if(a){x.fillStyle="#fff";x.fillRect(0,0,cv.width,cv.height);x.save();x.translate(cv.width/2,cv.height/2);x.rotate(r);x.drawImage(src,-W/2,-H/2,W,H);x.restore()}
      else x.drawImage(src,0,0,cv.width,cv.height);
      try{var ls=new Z.HTMLCanvasElementLuminanceSource(cv);ls.isRotateSupported=function(){return false};
        return rd.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(ls))).getText()}
      catch(e){return null}
    }
    return function(src,tum){
      var w=src.videoWidth||src.naturalWidth||src.width,hh=src.videoHeight||src.naturalHeight||src.height;if(!w||!hh)return Promise.resolve(null);
      if(!tum)return Promise.resolve(dene(src,w,hh,BARKOD_YON[n++%BARKOD_YON.length]));
      for(var i=0,k=null;i<4&&!k;i++)k=dene(src,w,hh,[0,90,45,135][i]);
      return Promise.resolve(k);
    };
  });
}
/* Destekleyen tarayıcıda (çoğu Android) sürekli odak: yakın tutulan barkod bulanık kalmasın. iOS Safari yok sayar. */
function barkodOdak(s){
  try{var tr=s.getVideoTracks()[0],k=tr&&tr.getCapabilities&&tr.getCapabilities();
    if(k&&k.focusMode&&k.focusMode.indexOf("continuous")>-1)tr.applyConstraints({advanced:[{focusMode:"continuous"}]}).catch(function(){})}catch(e){}
}
/* isle: okunan barkodla ne yapılacağı (verilmezse barkodIsle: ürünü bul ve göster) */
function barkodAc(ret,isle){
  var body=el("div","bsheet"),vid=document.createElement("video");vid.setAttribute("playsinline","");vid.muted=true;vid.className="bvid";
  var st=el("div","how",t("barkod.kamera_aciliyor"));
  body.appendChild(vid);body.appendChild(st);
  // Barkodun fotoğrafı (kamera açılamazsa ya da bilgisayarda)
  var fl=el("label","dosya"),fi=document.createElement("input");fi.type="file";fi.accept="image/*";fi.className="vh";
  fl.appendChild(document.createTextNode(t("barkod.foto_sec")));fl.appendChild(fi);body.appendChild(fl);
  // Elle giriş
  var f=document.createElement("form");f.className="row belle";
  var inp=document.createElement("input");inp.type="text";inp.inputMode="numeric";inp.autocomplete="off";inp.maxLength=14;inp.setAttribute("aria-label",t("barkod.elle"));inp.placeholder=t("barkod.elle");
  var ara=el("button",null,t("barkod.ara"));ara.type="submit";f.appendChild(inp);f.appendChild(ara);body.appendChild(f);
  body.appendChild(el("div","how",t("barkod.not")));
  function bitti(kod){barkodDur();closeSheet();(isle||barkodIsle)(kod)}
  // Kamerada tanınınca görüntü bir an yeşil çerçeveyle göçer (css/ocr.css), sonra kapanır; arada alt sayfa kapatıldıysa (akış durdu) bir şey yapılmaz
  function bulundu(kod){if(typeof hareketAz==="function"&&hareketAz()){bitti(kod);return}body.classList.add("bulundu");setTimeout(function(){if(BARKOD_AKIS)bitti(kod)},220)}
  f.onsubmit=function(e){e.preventDefault();var k=barkodTemiz(inp.value);if(!barkodGecerli(k)){st.textContent=t("barkod.gecersiz",{kod:k});inp.focus();return}bitti(k)};
  var coz=null;
  fi.onchange=function(){
    var fl0=fi.files[0];if(!fl0)return;var im=new Image();st.textContent=t("barkod.foto_okunuyor");
    im.onload=function(){(coz||barkodCozucu()).then(function(c){coz=coz||Promise.resolve(c);return c(im,true)}).then(function(k){
      URL.revokeObjectURL(im.src);if(k&&barkodGecerli(k))bitti(k);else st.textContent=t("barkod.fotoda_yok")}).catch(function(){st.textContent=t("barkod.fotoda_yok")})};
    im.src=URL.createObjectURL(fl0);fi.value="";
  };
  openSheet(t("barkod.baslik"),null,body,ret,null,barkodDur);
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){st.textContent=t("barkod.kamera_yok");vid.hidden=true;return}
  navigator.mediaDevices.getUserMedia({video:{facingMode:"environment",width:{ideal:1280},height:{ideal:720}},audio:false}).then(function(s){
    if($("sheet").hidden){s.getTracks().forEach(function(tr){tr.stop()});return}
    BARKOD_AKIS=s;vid.srcObject=s;barkodOdak(s);return vid.play().then(function(){
      st.textContent=t("barkod.kamera_hazir");
      return barkodCozucu().then(function(c){
        coz=Promise.resolve(c);
        (function tara(){
          if(!BARKOD_AKIS)return;
          c(vid).then(function(k){
            if(k&&barkodGecerli(k)){try{if(navigator.vibrate)navigator.vibrate(60)}catch(e){}bulundu(k);return}
            BARKOD_DONGU=setTimeout(tara,100);   // çözme kendisi kare başına ~30-200 ms; bekleme işlemciyi biraz dinlendirir
          });
        })();
      });
    });
  }).catch(function(){barkodDur();vid.hidden=true;st.textContent=t("barkod.kamera_yok")});
}
if($("barkodb")){
  $("barkodb").hidden=!BARKOD_AYAR.acik;
  $("barkodb").onclick=function(){barkodAc($("barkodb"))};
}
