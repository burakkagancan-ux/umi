/* Arayüz: barkodla ürün bulma (Etiket Oku). Saf mantık js/barkod.js; Worker uç noktaları /urun ve /off (worker/src/index.js).
   Akış: barkod (kamera, barkodun fotoğrafı ya da elle) → uygulamadaki Open Food Facts verisi ve kendi veritabanımız → OFF canlı sorgu
   → bulunursa içerik kutuya yazılır ve bugünkü analiz çalışır, üstte kaynak kartı ("etiket farklı olabilir", "fotoğrafla doğrula");
   bulunamazsa içerik listesinin fotoğrafı istenir ve okunan metin, kullanıcının açık izniyle barkodla birlikte kaydedilir.
   Kamera: tarayıcının BarcodeDetector'ı; yoksa (iOS Safari) js/vendor/zxing (yalnızca gerekince yüklenir). */
var BARKOD=null;                 // {kod, r: bulunan sonuç ya da null, metin: kutuya yazılan içerik, t: zaman, foto: sonrasında etiket fotoğrafı okundu, katki: öneri bitti}
var BARKOD_OFF=null;             // data/barkod_off.json (ilk barkodda yüklenir)
var BARKOD_FOTO_SURE=10*60000;   // barkoddan sonra en çok bu süre içinde okunan etiket fotoğrafı o barkodla ilişkilendirilir
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
    if(!j||!j.bulundu)return null;
    var m={};m[j.dil||"?"]=j.metin;
    return {kod:kod,kaynak:"urun",tur:barkodTur(j.tur),ad:"",marka:"",t:j.t,metin:m,dogrulandi:!!j.dogrulandi,sayi:j.sayi||1};
  });
}
function barkodOffCanli(kod){
  return barkodWorker("/off/"+kod).then(function(j){
    if(!j||!j.bulundu)return null;
    return {kod:kod,kaynak:"off",canli:true,db:j.db,tur:barkodTur(j.db),ad:j.ad||"",marka:j.marka||"",t:j.t||0,metin:j.metin||{},dogrulandi:null};
  });
}
/* Barkod bulundu: sırayla ara, sonucu göster */
function barkodIsle(ham){
  var kod=barkodNorm(ham);
  if(!kod){ST.textContent=t("barkod.gecersiz",{kod:barkodTemiz(ham)});return}
  ST.textContent=t("barkod.araniyor",{kod:kod});
  var sira=barkodSira(),s={};
  Promise.all([barkodOffYukle().then(function(v){s.off=barkodOffBul(v,kod)}),barkodUrun(kod).then(function(u){s.urun=u})]).then(function(){
    var r=barkodSec(s,sira);
    if(r&&!r.icerikYok)return r;
    return barkodOffCanli(kod).then(function(c){s.offCanli=c;return barkodSec(s,sira)});
  }).then(function(r){
    if(r&&r.ad&&!r.icerikYok&&s.off&&s.off.ad&&!r.ad){r.ad=s.off.ad;r.marka=s.off.marka}
    if(!r||r.icerikYok)barkodYok(kod,r);else barkodGoster(kod,r);
  });
}
function barkodAd(r){return r&&r.ad?((r.marka&&r.ad.toLocaleLowerCase(DIL.yerel).indexOf(r.marka.toLocaleLowerCase(DIL.yerel))<0?r.marka+" ":"")+r.ad):""}
function barkodGoster(kod,r){
  var m=barkodMetin(r.metin,barkodSira());
  BARKOD={kod:kod,r:r,metin:m.s,dil:m.dil,t:Date.now(),foto:false,katki:false,ad:false};
  fotoTemizle();
  $("metin").value="";HMOD=null;
  if(r.tur!==MODE)setMode(r.tur,true);
  $("metin").value=m.s;HSCAN=HOCR=true;
  ST.textContent=t("barkod.bulundu",{kod:kod});
  run();
}
function barkodYok(kod,r){
  BARKOD={kod:kod,r:null,ad:r?barkodAd(r):"",metin:null,t:Date.now(),foto:false,katki:false};
  fotoTemizle();
  if(r&&r.tur&&r.tur!==MODE){$("metin").value="";setMode(r.tur,true)}
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
}
/* Etiket fotoğrafı okundu (js/arayuz_sayfa.js çağırır): barkoddan sonra süre içindeyse o barkodla ilişkilenir */
function barkodFoto(){
  if(!BARKOD)return;
  if(Date.now()-BARKOD.t>BARKOD_FOTO_SURE){BARKOD=null;return}
  BARKOD.foto=true;BARKOD.katki=false;
}
/* Her analizden sonra (run) çağrılır: kaynak kartı, geçmişte ürün adı, katkı önerisi */
function barkodSonra(){
  if(!BARKOD||!$("sonuc").querySelector(".resbar"))return;
  var tx=$("metin").value.trim();
  if(BARKOD.metin&&tx===BARKOD.metin.trim()&&!BARKOD.foto){
    sonucUst(barkodKaynakKart());
    if(!BARKOD.adVerildi){BARKOD.adVerildi=true;barkodGecmisAdi(barkodAd(BARKOD.r))}
    return;
  }
  if(BARKOD.foto&&tx){
    if(BARKOD.ad&&!BARKOD.adVerildi){BARKOD.adVerildi=true;barkodGecmisAdi(BARKOD.ad)}
    if(!BARKOD.katki)barkodKatki(tx);
    return;
  }
  BARKOD=null;   // metin elle başka bir şeye çevrildi: barkodla ilişki biter
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
    if(MODE==="koz"){if(!KIDX)return false;var S=summarizeK(analyzeK(tx,KIDX,{ptype:PTYPE}),KIDX);return barkodKatkiUygun("koz",S.total,S.found)}
    if(MODE==="tem"){if(!TIDX)return false;var A=analyzeT(tx,TIDX,KIDX);return barkodKatkiUygun("tem",0,A.hazards.length+A.subs.length+A.inci.length)}
    if(!IDX)return false;var P=cmpProduct(tx,IDX,null,"");return barkodKatkiUygun("gida",P.unknown.total,P.unknown.found);
  }catch(e){return false}
}
function barkodIzin(){try{return localStorage.getItem("barkod_katki")||""}catch(e){return ""}}
function barkodIzinYaz(v){try{if(v)localStorage.setItem("barkod_katki",v);else localStorage.removeItem("barkod_katki")}catch(e){}}
function barkodDil(tx){return /[ğışĞİŞ]|içindekiler/i.test(tx)?"tr":/\b(ingredients|contains)\b/i.test(tx)?"en":""}
function barkodGonder(tx){
  return barkodWorker("/urun",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kod:BARKOD.kod,tur:MODE,dil:barkodDil(tx),metin:tx})});
}
function barkodKatki(tx){
  BARKOD.katki=true;
  var iz=barkodIzin();
  if(iz==="hayir"||!OCR_URL||!barkodUygun(tx))return;
  if(iz==="evet"){barkodGonder(tx);sonucUst(el("div","res u bkaynak how",t("barkod.katki_gitti",{kod:BARKOD.kod})));return}
  var d=el("div","res u bkaynak");
  d.appendChild(el("div","t",t("barkod.katki_soru")));
  d.appendChild(el("div","ln",t("barkod.katki_ne",{kod:BARKOD.kod})+(BARKOD.ad?" ("+BARKOD.ad+")":"")));
  d.appendChild(el("div","how",t("barkod.katki_gizlilik")));
  var lb=el("label","pc"),cb=document.createElement("input");cb.type="checkbox";lb.appendChild(cb);lb.appendChild(document.createTextNode(" "+t("barkod.katki_hatirla")));
  var row=el("div","row"),e=el("button",null,t("barkod.katki_evet")),h=el("button","alt",t("barkod.katki_hayir"));e.type=h.type="button";
  e.onclick=function(){if(cb.checked)barkodIzinYaz("evet");barkodGonder(tx);d.textContent="";d.appendChild(el("div","how",t("barkod.katki_tesekkur")))};
  h.onclick=function(){if(cb.checked)barkodIzinYaz("hayir");d.remove()};
  row.appendChild(e);row.appendChild(h);d.appendChild(row);d.appendChild(lb);
  sonucUst(d);
}
/* Hassasiyetlerim: katkı tercihi (Sor / Her zaman kaydet / Kaydetme) */
function barkodAyarKutusu(){
  var d=el("div","pbark");d.appendChild(el("div","pt",t("barkod.ayar_baslik")));
  d.appendChild(el("div","mut",t("barkod.ayar_metin")));
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
/* Çözücü: kaynak (video, resim ya da tuval) → barkod metni ya da null */
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
function barkodZxCozucu(){
  return barkodZxYukle().then(function(Z){
    var h=new Map(),F=Z.BarcodeFormat;h.set(Z.DecodeHintType.POSSIBLE_FORMATS,[F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E]);h.set(Z.DecodeHintType.TRY_HARDER,true);
    var rd=new Z.MultiFormatReader();rd.setHints(h);
    var cv=document.createElement("canvas"),x=cv.getContext("2d",{willReadFrequently:true});
    return function(src){
      var w=src.videoWidth||src.naturalWidth||src.width,hh=src.videoHeight||src.naturalHeight||src.height;if(!w||!hh)return Promise.resolve(null);
      var sc=Math.min(1,1280/Math.max(w,hh));cv.width=Math.round(w*sc);cv.height=Math.round(hh*sc);x.drawImage(src,0,0,cv.width,cv.height);
      try{var bm=new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv)));return Promise.resolve(rd.decode(bm).getText())}
      catch(e){return Promise.resolve(null)}
    };
  });
}
function barkodAc(ret){
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
  function bitti(kod){barkodDur();closeSheet();barkodIsle(kod)}
  f.onsubmit=function(e){e.preventDefault();var k=barkodTemiz(inp.value);if(!barkodGecerli(k)){st.textContent=t("barkod.gecersiz",{kod:k});inp.focus();return}bitti(k)};
  var coz=null;
  fi.onchange=function(){
    var fl0=fi.files[0];if(!fl0)return;var im=new Image();st.textContent=t("barkod.foto_okunuyor");
    im.onload=function(){(coz||barkodCozucu()).then(function(c){coz=coz||Promise.resolve(c);return c(im)}).then(function(k){
      URL.revokeObjectURL(im.src);if(k&&barkodGecerli(k))bitti(k);else st.textContent=t("barkod.fotoda_yok")}).catch(function(){st.textContent=t("barkod.fotoda_yok")})};
    im.src=URL.createObjectURL(fl0);fi.value="";
  };
  openSheet(t("barkod.baslik"),null,body,ret);
  var kapat=$("sheet-x").onclick;$("sheet-x").onclick=function(){barkodDur();$("sheet-x").onclick=kapat;kapat()};
  $("sheet-bg").onclick=$("sheet-x").onclick;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){st.textContent=t("barkod.kamera_yok");vid.hidden=true;return}
  navigator.mediaDevices.getUserMedia({video:{facingMode:"environment",width:{ideal:1280},height:{ideal:720}},audio:false}).then(function(s){
    if($("sheet").hidden){s.getTracks().forEach(function(tr){tr.stop()});return}
    BARKOD_AKIS=s;vid.srcObject=s;return vid.play().then(function(){
      st.textContent=t("barkod.kamera_hazir");
      return barkodCozucu().then(function(c){
        coz=Promise.resolve(c);
        (function tara(){
          if(!BARKOD_AKIS)return;
          c(vid).then(function(k){
            if(k&&barkodGecerli(k)){try{if(navigator.vibrate)navigator.vibrate(60)}catch(e){}bitti(k);return}
            BARKOD_DONGU=setTimeout(tara,250);
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
