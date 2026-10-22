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
  sonCiz();   // Son Okutulanlar (js/arayuz_son.js); sonuç gelince gizlenir (css/ocr.css body.sonuclu)
  if(typeof barkodGeriAl==="function")barkodGeriAl();   // kamera açılırken sayfa yeniden yüklendiyse bulunamayan barkod geri gelir
  window.addEventListener("hashchange",tabSync);tabSync();
  kayitProfil();
  rozetProfil();
  window.addEventListener("hashchange",rozetHash);rozetHash();
  ekleProfil();window.addEventListener("hashchange",ekleHash);ekleHash();
  ekleSunucu(EKLE_AYAR.tazeSn,rozetGoster);   // ürün rozetleri: sunucudaki doğrulanmış sayım (G-02)
  toplulukProfil();window.addEventListener("hashchange",toplulukHash);toplulukHash();   // ortak hedef ve eksik ürünler (G-04)
  aylikProfil();window.addEventListener("hashchange",aylikHash);aylikHash();   // Aylık Özetim (U-09, js/arayuz_aylik.js)
  olcumAc();   // A-03: günlük açan cihaz, yeni cihaz, geri dönüş (js/arayuz_olcum.js)
});
/* Rozetler (js/arayuz_rozet.js): kutlama kartı sonucun üstüne */
var ROZET_BEKLE=null;
function rozetGoster(c){if($("sonuc").querySelector(".resbar"))sonucUst(c);else ROZET_BEKLE=c}
function rozetSonra(){if(ROZET_BEKLE&&$("sonuc").querySelector(".resbar")){sonucUst(ROZET_BEKLE);ROZET_BEKLE=null}}

/* ---------- Alt menü: "Profil" sekmesi bu sayfadaki profil bölümünü açar ---------- */
function tabSync(){
  var prof=/^#(profil|rozetler|eklediklerim|topluluk|aylik)$/.test(location.hash);
  document.querySelectorAll(".tabbar a").forEach(function(a){if(a.getAttribute("data-tab")===(prof?"profil":"oku"))a.setAttribute("aria-current","page");else if(a.getAttribute("data-tab")!=="liste")a.removeAttribute("aria-current")});
  document.body.classList.toggle("mode-profil",prof);
  document.querySelector("h1").textContent=t(prof?"profil.baslik":"sayfa.baslik");
  document.title=t(prof?"profil.baslik":"sayfa.baslik");
  if(prof&&CMP_IDS)closeCompare();
  if(prof&&location.hash!=="#profil"&&document.body.classList.contains("mode-kayit"))kayitKapat();   // Kaydedilen Ürünlerim hash kullanmaz: tarayıcı ileri/geri ile ikinci ekran üstüne açılmasın
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
  OKU.n++;OKU.okundu=false;kirpKaldir();besinFotoSecildi();im.onload=function(){im.onload=null;okuIste(0)};   // ayrı düğme yok: fotoğraf gelince okunur
  this.value="";   // aynı dosya yeniden seçilebilsin
}
$("foto").onchange=fotoSec;$("dosya").onchange=fotoSec;
// Seçilen fotoğrafı ekrandan kaldırır: kayıttan sonra, sekme değişince, örnek/barkod/kayıtlı ürün açılınca eski görsel kalmasın
function fotoTemizle(){
  var im=$("pre");if(im.src&&im.src.indexOf("blob:")===0)URL.revokeObjectURL(im.src);im.removeAttribute("src");
  $("cropwrap").style.display="none";$("cropbar").style.display="none";resetCrop();
  OKU.n++;OKU.bekle=false;OKU.okundu=false;clearTimeout(OKU.zam);BESIN_EKLE=null;kirpKaldir();
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
function okuIste(ms){kirpKaldir();clearTimeout(OKU.zam);OKU.zam=setTimeout(fotoOku,ms)}
function fotoOku(){
  var im=$("pre");if(!im.getAttribute("src")||!im.naturalWidth)return;
  if(OKU.mesgul){OKU.bekle=true;return}
  var n=OKU.n,t0=Date.now();OKU.mesgul=true;ST.textContent=t("ocr.hazirlaniyor");
  function gecerli(){return n===OKU.n&&!OKU.bekle}
  function yaz(tx,msj,V){
    if(!gecerli())return;
    // Besin tablosunun fotoğrafı: okunan metin içerik metninin sonuna eklenir, aynı tarama güncellenir (js/arayuz_besin.js)
    var yo=besinYenidenOku(n,tx);if(yo!=null){OKU.okundu=true;ST.textContent=yo;return}
    var ek=besinEkMetin(n,tx);
    if(ek!=null){besinEkUygula(ek);$("metin").value=ek;HSCAN=false;HOCR=true;OKU.okundu=true;ST.textContent=besinEkMesaj(ek,msj);run();return}
    $("metin").value=tx;HSCAN=!OKU.okundu;HOCR=true;OKU.okundu=true;
    if(HSCAN&&tx.trim()){rozetSay("dedektif",MODE,"f:"+rozetIz(tx),rozetGoster);olcumTarama("f",MODE)}   // aynı fotoğrafın yeniden okunması (çerçeve) sayılmaz
    if(typeof barkodFoto==="function")barkodFoto();ST.textContent=msj;run();
    kirpOner(V);
  }
  function hata(m){if(gecerli())ST.textContent=m}
  function bitti(){OKU.mesgul=false;if(OKU.bekle){OKU.bekle=false;fotoOku()}}
  // Gri ton + kontrast germe yalnızca yedek OCR'da (Tesseract) yarar; Google Vision kendi ön işlemesini yapar
  var cv=prep(im,!OCR_URL);
  if(OCR_URL){
    ST.textContent=t("ocr.okunuyor");
    fetch(OCR_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:cv.toDataURL("image/jpeg",0.85).split(",")[1],kutu:true})})
    .then(function(r){return r.json().catch(function(){return {}}).then(function(j){if(!r.ok||j.error){var er=new Error(j.error||("HTTP "+r.status));er.srv=true;throw er}return j})})
    .then(function(j){yaz(j.text||"",t("ocr.tamam_vision",{sn:dilSayi((Date.now()-t0)/1000,1,true)}),j)})
    .catch(function(e){hata(t(e.srv?"ocr.hata":"ocr.hata_internet",{m:e.message}))}).then(bitti);
    return;
  }
  tesseractYukle().then(function(){
    return Tesseract.createWorker("tur+eng",1,{logger:function(m){if(m.status&&gecerli())ST.textContent=m.status+(m.progress?" %"+Math.round(m.progress*100):"")}}).then(function(w){
      return w.recognize(cv).then(function(r){
        yaz(r.data.text,t("ocr.tamam",{sn:dilSayi((Date.now()-t0)/1000,1,true)}));
        return w.terminate();
      });
    }).catch(function(e){hata(t("ocr.hata",{m:e&&e.message?e.message:e}))});
  },function(){hata(t("ocr.bilesen_yok"))}).then(bitti);
}
/* Tesseract.js yalnızca OCR_URL boşsa ve ilk okumada yüklenir (19.10.2026: önceden her açılışta jsDelivr'den iniyordu, OCR_URL dolu olduğu için hiç kullanılmıyordu).
   Sürüm sabit + SRI; sürüm yükseltilirse integrity yeniden hesaplanır */
var TESS_YUK=null;
function tesseractYukle(){
  if(window.Tesseract)return Promise.resolve();
  if(!TESS_YUK)TESS_YUK=new Promise(function(ok,no){var s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    s.integrity="sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F";s.crossOrigin="anonymous";
    s.onload=function(){ok()};s.onerror=function(){TESS_YUK=null;no()};document.head.appendChild(s)});
  return TESS_YUK;
}
/* ---------- Otomatik kırpma önerisi (A-04, 21.10.2026; saf mantık js/foto.js icerikBolge) ----------
   Fotoğrafın tamamı okunduğunda (çerçeve değiştirilmemişse) ve metinde içerik listesi başlığının dışında başka bölümler de varsa (besin tablosu,
   adres, uyarı, ikinci dil) öneri kartı (liste dışındaki alerjen iz uyarısı cümleleri korunur, kirpMetni): çerçeve listeye çizilir, "Yalnızca içerik listesini analiz et" yeni okuma yapmadan (sözcük kutularından)
   metni listeyle sınırlar. Kartta listenin dışında geçip sonuçtan çıkacak alerjen ve dikkat/uyarı maddeleri yazılır (ör. ayrı satırdaki
   "… içerebilir"). Temizlikte önerilmez: tehlike ve önlem ifadeleri içerik listesinin dışındadır. Gıdada besin tablosu metni korunur. */
var KIRP_ONERI=null,KIRP_SAY=0;   // KIRP_SAY: her kaldırmada artar; bekleyen karar ve eski kartın düğmesi geçersiz olur
/* Kart, o fotoğrafın okumasına (OKU.n) ve çerçevesine bağlıdır: yeni fotoğraf, çerçeve değişimi ya da yeni okuma kartı kaldırır, eski kartın
   düğmesi hiçbir şey yapmaz (bozma turu 21.10.2026). Veri (kozmetik/temizlik listesi) henüz yüklenmediyse yüklenince karar verilir; güvenlik
   denetimi (js/foto.js kirpGuvenli) veri ister: adres dışında atılacak satırlardaki her madde ve alerjen tutulan metinde yoksa öneri yok. */
function kirpKaldir(){KIRP_ONERI=null;KIRP_SAY++;document.querySelectorAll(".kirponer").forEach(function(x){x.remove()})}
function kirpOner(V){
  kirpKaldir();
  if(MODE==="tem"||!V||!Array.isArray(V.kutu)||!V.kutu.length)return;
  if(CROP.x!==0||CROP.y!==0||CROP.w!==1||CROP.h!==1)return;   // kullanıcı çerçeveyi kendisi seçti
  var n=KIRP_SAY,mode=MODE,tam=$("metin").value;
  var hazir=degHazir(mode,degBaglam())?Promise.resolve():mode==="koz"?loadK():Promise.reject();
  hazir.then(function(){
    if(n!==KIRP_SAY||MODE!==mode||$("metin").value!==tam)return;   // bu arada yeni fotoğraf, tür değişimi ya da elle düzeltme
    var plan=kirpPlan(V,DIL.kod,mode==="gida");if(!plan)return;
    var bul=function(tx){return kirpBulgu(degerlendir(mode,tx,degBaglam(),PROF,""))};
    if(!kirpGuvenli(plan,bul).ok)return;
    var O={B:plan.B,metin:plan.metin,tam:tam,n:n};KIRP_ONERI=O;
    var c=el("div","res u kirponer");c.setAttribute("role","status");
    c.appendChild(el("div","t",t("foto.oneri.baslik")));
    c.appendChild(el("div","ln",t("foto.oneri.ne")));
    var cik=kirpCikanlar(mode,tam,plan.metin);
    if(cik.length)c.appendChild(el("div","ln",t("foto.oneri.cikacak",{l:cik.join(", ")})));
    var b=el("button",null,t("foto.oneri.uygula"));b.type="button";b.onclick=function(){kirpUygula(O)};c.appendChild(b);
    sonucUst(c);
  },function(){});
}
/* Listenin dışında kalıp sonuçtan çıkacaklar (yalnızca adres bölümünden gelebilir; öteki atılanlar güvenlik denetiminde): dikkat/uyarı
   seviyeli maddeler ve (gıdada) alerjenler */
function kirpCikanlar(mode,tam,kesik){
  try{
    var A=degerlendir(mode,tam,degBaglam(),PROF,""),K=degerlendir(mode,kesik,degBaglam(),PROF,""),var_={},o=[];
    K.items.forEach(function(it){var_[it.key]=1});
    A.items.forEach(function(it){if(it.rank>=2&&!var_[it.key])o.push(it.name)});
    if(mode==="gida"&&A.S&&K.S){Object.keys(A.S.allergen).forEach(function(k){var a=A.S.allergen[k],b=K.S.allergen[k];
      if((a.yes.length||a.may.length)&&!(b&&(b.yes.length||b.may.length)))o.push(alName(k))})}
    return o;
  }catch(e){return []}
}
function kirpUygula(O){
  if(!O||O!==KIRP_ONERI||O.n!==KIRP_SAY||$("metin").value!==O.tam){kirpKaldir();return}
  kirpKaldir();
  CROP={x:O.B.x,y:O.B.y,w:O.B.w,h:O.B.h};drawCrop();
  $("metin").value=O.metin;HSCAN=false;HOCR=true;   // aynı tarama güncellenir (yeni kayıt açılmaz)
  ST.textContent=t("foto.oneri.uygulandi");run();
  var s=$("sonuc");if(s&&s.scrollIntoView)s.scrollIntoView({block:"start"});
}
