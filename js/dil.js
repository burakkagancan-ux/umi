/* Arayüz: dil dosyalarını yükler (i18n/diller.json, i18n/<dil>.json, i18n/veri/<dil>.json), <html lang dir>, dile özel yazı tipi,
   sayfadaki data-i18n işaretli metinler. Saf mantık js/ceviri.js'te. Açılış işleri DIL_HAZIR çözülünce başlar (js/arayuz_sayfa.js). */
function dilGetir(p){return fetch(p).then(function(r){if(!r.ok)throw new Error(p);return r.json()})}
/* Dile ve sayfaya bağlı dosyalar kurulumda önbelleğe inmez (sw.js); sayfa kullandıklarını service worker'a bildirir ki internetsiz de açılsın.
   (İlk ziyarette sayfa henüz service worker'ın denetiminde değil; kendi isteği önbelleğe yazılmaz.) */
function dilOnbellege(u){try{if(navigator.serviceWorker)navigator.serviceWorker.ready.then(function(r){if(r.active)r.active.postMessage({onbellek:u})})}catch(e){}}
function dilKayitli(){try{return localStorage.getItem("dil")}catch(e){return null}}
function ulkeKayitli(){try{return localStorage.getItem("ulke")}catch(e){return null}}
function ulke(){return ulkeSec(ulkeKayitli(),DIL.kod)}   // ULKELER'den biri ya da "" (seçilmedi)
/* <html data-ulke>: alt menüdeki Liste (Bakanlık listesi) yalnızca Türkiye seçiliyken görünür (tema.css). Dil dosyası inmeden önce tahminle
   konur ki Türkiye'de menü açılışta kaymasın; dil kurulunca ve ülke değişince kesinleşir. */
function ulkeIsaretle(u){document.documentElement.setAttribute("data-ulke",u)}
ulkeIsaretle(ulkeSec(ulkeKayitli(),dilSec(dilKayitli(),navigator.languages||[navigator.language],["tr","en"])));
var DIL_HAZIR=dilGetir("i18n/diller.json").catch(function(){return {diller:{tr:{ad:"Türkçe",yon:"ltr"}}}}).then(function(b){
  var bilgi=b.diller||{},destek=Object.keys(bilgi);
  var kod=dilSec(dilKayitli(),navigator.languages||[navigator.language],destek);
  var gerek=[DIL_KAYNAK,kod===DIL_KAYNAK?null:DIL_YEDEK,kod].filter(function(x,i,a){return x&&a.indexOf(x)===i});
  var u=gerek.map(function(k){return "i18n/"+k+".json"}),vu="i18n/veri/"+kod+".json";
  var veri=kod===DIL_KAYNAK?Promise.resolve(null):dilGetir(vu).catch(function(){return null});
  return Promise.all(u.map(function(p){return dilGetir(p).catch(function(){return {}})}).concat([veri])).then(function(v){
    var s={};gerek.forEach(function(k,i){s[k]=v[i]});
    var vd={};if(v[gerek.length])vd[kod]=v[gerek.length];
    dilKur(kod,s,bilgi,vd);dilUygula(document);ulkeIsaretle(ulke());
    var mf=dilManifest(document);
    dilOnbellege(u.concat(v[gerek.length]?[vu]:[],DIL.yazi&&DIL.yazi.css?[DIL.yazi.css]:[],mf?[mf]:[]));
  });
});
/* Ana ekrana eklenen uygulamanın adı ve kısayolları seçili dilde: kaynak dilde manifest.webmanifest, öteki dillerde
   i18n/manifest/<dil>.webmanifest (gen_manifest.py). Bağlantı değişince tarayıcı yeni manifesti okur. Döner: değişen dosya ya da null */
function dilManifest(doc){
  var ad=doc.querySelector('meta[name="apple-mobile-web-app-title"]');if(ad)ad.setAttribute("content",t("manifest.kisa_ad"));
  var l=doc.querySelector('link[rel="manifest"]');if(!l||DIL.kod===DIL_KAYNAK)return null;
  var p="i18n/manifest/"+DIL.kod+".webmanifest";l.setAttribute("href",p);return p;
}
/* <html lang dir>, yazı tipi (dil dosyasında tanımlıysa) ve data-i18n / data-i18n-attr ("aria-label:anahtar;placeholder:anahtar").
   lang/dir yalnızca arayüzü çevrilen sayfada değişir (<html data-cevrilen>: ocr.html, ansiklopedi.html, index.html). */
function dilUygula(doc){
  var h=doc.documentElement;if(!h.hasAttribute("data-cevrilen"))return;
  h.lang=DIL.kod;h.dir=DIL.yon;
  if(DIL.yazi){
    if(DIL.yazi.baslik)h.style.setProperty("--hf",DIL.yazi.baslik);
    if(DIL.yazi.govde)h.style.setProperty("--bf",DIL.yazi.govde);
    if(DIL.yazi.css&&!doc.querySelector('link[data-dil-yazi]')){var l=doc.createElement("link");l.rel="stylesheet";l.href=DIL.yazi.css;l.setAttribute("data-dil-yazi","");doc.head.appendChild(l)}
  }
  doc.querySelectorAll("[data-i18n]").forEach(function(e){e.textContent=t(e.getAttribute("data-i18n"))});
  doc.querySelectorAll("[data-i18n-attr]").forEach(function(e){
    e.getAttribute("data-i18n-attr").split(";").forEach(function(p){var kv=p.split(":");if(kv.length===2)e.setAttribute(kv[0].trim(),t(kv[1].trim()))});
  });
}
