/* Arayüz: açılış modu, alt menü, fotoğraf kırpma ve OCR (fotoğraf seçilince ve çerçeve değişince kendiliğinden okunur). Sayfadaki son betik; açılış işlemleri burada başlar. */
/* Açılış: veri yüklemesi ve mod, tüm betikler yüklendikten ve dil dosyası (js/dil.js, DIL_HAZIR) geldikten sonra başlar.
   Arayüz metinleri t() ile okunduğu için ekrana yazan hiçbir iş dil yüklenmeden çalışmaz. */
getJson("data/e_aciklama.json").then(function(a){ABOUT=a.about||{}}).catch(function(){ABOUT={}});
getJson("data/tagsis.json").then(function(b){BRANDS=buildBrands(b)}).catch(function(){BRANDS=null});
DIL_HAZIR.then(function(){
  // Sonuç gelene kadar "Sonuç" başlığı yerine fotoğraf ipuçları görünür (ocr.html .ipucu)
  new MutationObserver(function(){document.body.classList.add("sonuclu")}).observe($("sonuc"),{childList:true,characterData:true,subtree:true});
  besinYukle();
  loadDb(0);
  setMode(MODE,false);
  window.addEventListener("hashchange",tabSync);tabSync();
  kayitProfil();
  rozetProfil();
  window.addEventListener("hashchange",rozetHash);rozetHash();
  ekleProfil();window.addEventListener("hashchange",ekleHash);ekleHash();
  ekleSunucu(EKLE_AYAR.tazeSn,rozetGoster);   // ürün rozetleri: sunucudaki doğrulanmış sayım (G-02)
  toplulukProfil();window.addEventListener("hashchange",toplulukHash);toplulukHash();   // ortak hedef ve eksik ürünler (G-04)
  olcumAc();   // A-03: günlük açan cihaz, yeni cihaz, geri dönüş (js/arayuz_olcum.js)
});
/* Rozetler (js/arayuz_rozet.js): kutlama kartı sonucun üstüne */
var ROZET_BEKLE=null;
function rozetGoster(c){if($("sonuc").querySelector(".resbar"))sonucUst(c);else ROZET_BEKLE=c}
function rozetSonra(){if(ROZET_BEKLE&&$("sonuc").querySelector(".resbar")){sonucUst(ROZET_BEKLE);ROZET_BEKLE=null}}

/* ---------- Alt menü: "Profil" sekmesi bu sayfadaki profil bölümünü açar ---------- */
function tabSync(){
  var prof=/^#(profil|rozetler|eklediklerim|topluluk)$/.test(location.hash);
  document.querySelectorAll(".tabbar a").forEach(function(a){if(a.getAttribute("data-tab")===(prof?"profil":"oku"))a.setAttribute("aria-current","page");else if(a.getAttribute("data-tab")!=="liste")a.removeAttribute("aria-current")});
  document.body.classList.toggle("mode-profil",prof);
  document.querySelector("h1").textContent=t(prof?"profil.baslik":"sayfa.baslik");
  document.title=t(prof?"profil.baslik":"sayfa.baslik");
  if(prof&&CMP_IDS)closeCompare();
  if(prof){$("pd").open=true;window.scrollTo(0,0)}
}
$("pd").addEventListener("toggle",function(){if(!$("pd").open&&location.hash==="#profil")history.replaceState(null,"",location.pathname+location.search);tabSync()});
try{if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(function(){})}catch(e){}

/* ---------- Kırpma: okunacak alanı seçme ---------- */
var CROP={x:0,y:0,w:1,h:1};   // görüntüye oranla (0-1)
function drawCrop(){var c=$("crop");c.style.left=CROP.x*100+"%";c.style.top=CROP.y*100+"%";c.style.width=CROP.w*100+"%";c.style.height=CROP.h*100+"%"}
function resetCrop(){CROP={x:0,y:0,w:1,h:1};drawCrop()}
$("cropreset").onclick=function(){resetCrop();okuIste(0)};
/* Deneme sürümü notu: sayfanın en altındaki bağlantı, metin alt sayfada */
$("denemeb").onclick=function(){openSheet(t("sayfa.deneme"),null,el("p",null,t("sayfa.deneme_not")),$("denemeb"))};
(function(){
  var drag=null,MIN=0.08;
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  $("crop").addEventListener("pointerdown",function(e){
    var h=e.target.getAttribute&&e.target.getAttribute("data-h");if(!h)return;
    e.preventDefault();e.target.setPointerCapture(e.pointerId);
    var r=$("pre").getBoundingClientRect();
    drag={h:h,r:r,x0:e.clientX,y0:e.clientY,c:{x:CROP.x,y:CROP.y,w:CROP.w,h:CROP.h},el:e.target};
  });
  function move(e){
    if(!drag)return;e.preventDefault();
    var dx=(e.clientX-drag.x0)/drag.r.width,dy=(e.clientY-drag.y0)/drag.r.height,c=drag.c,h=drag.h;
    var x1=c.x,y1=c.y,x2=c.x+c.w,y2=c.y+c.h;
    if(h==="move"){var nx=clamp(c.x+dx,0,1-c.w),ny=clamp(c.y+dy,0,1-c.h);x1=nx;y1=ny;x2=nx+c.w;y2=ny+c.h}
    else{
      if(h.indexOf("w")>-1)x1=clamp(c.x+dx,0,x2-MIN);
      if(h.indexOf("e")>-1)x2=clamp(c.x+c.w+dx,x1+MIN,1);
      if(h.indexOf("n")>-1)y1=clamp(c.y+dy,0,y2-MIN);
      if(h.indexOf("s")>-1)y2=clamp(c.y+c.h+dy,y1+MIN,1);
    }
    CROP={x:x1,y:y1,w:x2-x1,h:y2-y1};drawCrop();drag.m=true;
  }
  function end(){if(drag&&drag.m)okuIste(800);drag=null}   // çerçeve bırakılınca seçilen alan yeniden okunur
  $("crop").addEventListener("pointermove",move);
  $("crop").addEventListener("pointerup",end);$("crop").addEventListener("pointercancel",end);
})();
// Kamera (capture) ya da galeri/dosya: ikisi de aynı kırpma ve okuma akışına girer
function fotoSec(){
  var f=this.files[0];if(!f)return;var im=$("pre");im.src=URL.createObjectURL(f);
  $("cropwrap").style.display="block";$("cropbar").style.display="flex";resetCrop();
  OKU.n++;OKU.okundu=false;besinFotoSecildi();im.onload=function(){im.onload=null;okuIste(0)};   // ayrı düğme yok: fotoğraf gelince okunur
  this.value="";   // aynı dosya yeniden seçilebilsin
}
$("foto").onchange=fotoSec;$("dosya").onchange=fotoSec;
// Seçilen fotoğrafı ekrandan kaldırır: kayıttan sonra, sekme değişince, örnek/barkod/kayıtlı ürün açılınca eski görsel kalmasın
function fotoTemizle(){
  var im=$("pre");if(im.src&&im.src.indexOf("blob:")===0)URL.revokeObjectURL(im.src);im.removeAttribute("src");
  $("cropwrap").style.display="none";$("cropbar").style.display="none";resetCrop();
  OKU.n++;OKU.bekle=false;OKU.okundu=false;clearTimeout(OKU.zam);BESIN_EKLE=null;
}
function prep(img,on){
  // Yalnızca seçilen alan okunur; kırpılan alan küçükse daha yüksek çözünürlükte gönderilir
  var W=img.naturalWidth,H=img.naturalHeight,sx=Math.round(CROP.x*W),sy=Math.round(CROP.y*H),sw=Math.max(1,Math.round(CROP.w*W)),sh=Math.max(1,Math.round(CROP.h*H));
  var max=1800,sc=Math.min(1,max/Math.max(sw,sh));
  var c=document.createElement("canvas");c.width=Math.round(sw*sc);c.height=Math.round(sh*sc);
  var x=c.getContext("2d");x.drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);
  if(on){
    var d=x.getImageData(0,0,c.width,c.height),a=d.data,h=new Array(256).fill(0),i,g;
    for(i=0;i<a.length;i+=4){g=(a[i]*0.299+a[i+1]*0.587+a[i+2]*0.114)|0;a[i]=a[i+1]=a[i+2]=g;h[g]++}
    var n=c.width*c.height,lo=0,hi=255,s=0;
    for(i=0;i<256;i++){s+=h[i];if(s>n*0.02){lo=i;break}}s=0;
    for(i=255;i>=0;i--){s+=h[i];if(s>n*0.02){hi=i;break}}
    var r=Math.max(1,hi-lo);
    for(i=0;i<a.length;i+=4){g=Math.max(0,Math.min(255,((a[i]-lo)*255/r)|0));a[i]=a[i+1]=a[i+2]=g}
    x.putImageData(d,0,0);
  }
  return c;
}
/* Okuma: aynı anda tek okuma; sürerken yeni istek gelirse (çerçeve değişti, yeni fotoğraf) eski sonuç atılır ve yeniden okunur.
   Aynı fotoğrafın ilk okuması yeni kayıt açar; çerçeve değişince yapılan yeniden okuma aynı kaydı günceller. */
var OKU={n:0,mesgul:false,bekle:false,okundu:false,zam:null};
function okuIste(ms){clearTimeout(OKU.zam);OKU.zam=setTimeout(fotoOku,ms)}
function fotoOku(){
  var im=$("pre");if(!im.getAttribute("src")||!im.naturalWidth)return;
  if(!OCR_URL&&!window.Tesseract){ST.textContent=t("ocr.bilesen_yok");return}
  if(OKU.mesgul){OKU.bekle=true;return}
  var n=OKU.n,t0=Date.now();OKU.mesgul=true;ST.textContent=t("ocr.hazirlaniyor");
  function gecerli(){return n===OKU.n&&!OKU.bekle}
  function yaz(tx,msj){
    if(!gecerli())return;
    // Besin tablosunun fotoğrafı: okunan metin içerik metninin sonuna eklenir, aynı tarama güncellenir (js/arayuz_besin.js)
    var yo=besinYenidenOku(n,tx);if(yo!=null){OKU.okundu=true;ST.textContent=yo;return}
    var ek=besinEkMetin(n,tx);
    if(ek!=null){besinEkUygula(ek);$("metin").value=ek;HSCAN=false;HOCR=true;OKU.okundu=true;ST.textContent=besinEkMesaj(ek,msj);run();return}
    $("metin").value=tx;HSCAN=!OKU.okundu;HOCR=true;OKU.okundu=true;
    if(HSCAN&&tx.trim()){rozetSay("dedektif",MODE,"f:"+rozetIz(tx),rozetGoster);olcumTarama("f",MODE)}   // aynı fotoğrafın yeniden okunması (çerçeve) sayılmaz
    if(typeof barkodFoto==="function")barkodFoto();ST.textContent=msj;run();
  }
  function hata(m){if(gecerli())ST.textContent=m}
  function bitti(){OKU.mesgul=false;if(OKU.bekle){OKU.bekle=false;fotoOku()}}
  // Gri ton + kontrast germe yalnızca yedek OCR'da (Tesseract) yarar; Google Vision kendi ön işlemesini yapar
  var cv=prep(im,!OCR_URL);
  if(OCR_URL){
    ST.textContent=t("ocr.okunuyor");
    fetch(OCR_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:cv.toDataURL("image/jpeg",0.85).split(",")[1]})})
    .then(function(r){return r.json().catch(function(){return {}}).then(function(j){if(!r.ok||j.error){var er=new Error(j.error||("HTTP "+r.status));er.srv=true;throw er}return j})})
    .then(function(j){yaz(j.text||"",t("ocr.tamam_vision",{sn:dilSayi((Date.now()-t0)/1000,1,true)}))})
    .catch(function(e){hata(t(e.srv?"ocr.hata":"ocr.hata_internet",{m:e.message}))}).then(bitti);
    return;
  }
  Tesseract.createWorker("tur+eng",1,{logger:function(m){if(m.status&&gecerli())ST.textContent=m.status+(m.progress?" %"+Math.round(m.progress*100):"")}}).then(function(w){
    return w.recognize(cv).then(function(r){
      yaz(r.data.text,t("ocr.tamam",{sn:dilSayi((Date.now()-t0)/1000,1,true)}));
      return w.terminate();
    });
  }).catch(function(e){hata(t("ocr.hata",{m:e&&e.message?e.message:e}))}).then(bitti);
}
