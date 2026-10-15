/* Arayüz: sonuç ekranının üst barı ve paylaşılabilir sonuç kartı (önizleme + yerel paylaşım menüsü). Saf mantık js/paylas.js, ayarlar js/paylas_ayar.js.
   Görsel cihazda çizilir, çevrimdışı çalışır. Kişisel uyarılar yalnızca "Kişisel uyarılarımı ekle" seçilince karta girer. */
var PAY_SRC=null,PAY_LOGO=null;
/* Sonuç ekranı çizildikten sonra çağrılır: üste bar ekler. src: {mode, text} (gıda) | {mode, res, S} (kozmetik) | {mode, A, S} (temizlik) */
function payBar(box,src){
  PAY_SRC=src;
  var bar=el("div","resbar");   // başlık sayfadaki "Sonuç" (h2); bar yalnızca düğmeleri taşır
  var acts=el("span","racts");bar.appendChild(acts);
  if(typeof kayitBtn==="function")acts.appendChild(kayitBtn(src.mode));   // Kaydet (js/arayuz_kayit.js)
  if(!PAYLAS_AYAR.acik){box.insertBefore(bar,box.firstChild);return}
  var b=el("button","alt pay");b.type="button";b.setAttribute("aria-label",t("pay.dugme_aria"));
  b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3"/></svg>';
  b.appendChild(document.createTextNode(t("pay.dugme")));
  b.onclick=function(){payOpen(b)};
  acts.appendChild(b);box.insertBefore(bar,box.firstChild);
}
/* Sonucun üstüne kart eklemek için (öneri kartları bar'ın altına girer) */
function sonucUst(c){var box=$("sonuc"),bar=box.querySelector(".resbar");box.insertBefore(c,bar?bar.nextSibling:box.firstChild)}
/* Profil kartlarından kişisel uyarı satırları: yalnızca kırmızı/sarı olanlar, başlık + ilk satır (satır başlığı tekrar ediyorsa yalnızca satır) */
function payPersonal(cards){
  return cards.filter(function(c){return c.classList.contains("r")||c.classList.contains("y")}).map(function(c){
    var b=c.querySelector(".t"),l=c.querySelector(".ln");b=b?b.textContent:"";l=l?l.textContent:"";
    return {t:l&&l.indexOf(b)===0?l:b+(l?": "+l:""),lvl:c.classList.contains("r")?2:1};
  });
}
function paySource(){
  var s=PAY_SRC,o;if(!s)return null;
  if(s.mode==="gida"){var P=degerlendir("gida",s.text,degBaglam(),PROF,"");o=payFromFood(s.text,IDX,P);o.personal=P.misfit.map(function(s){return {t:s,lvl:2}});   // karşılaştırmadaki "profilinize uymuyor" satırları (ortak ürün modeli)
    var K=typeof besinKaynak==="function"?besinKaynak(s.text):null;o.besin=K?besinOzet(K.k):null}   // sonuçtaki besin kartıyla aynı değerler; renk yoksa kartta yok
  else if(s.mode==="koz"){o=payFromK(s.res,s.S,KIDX);o.personal=payPersonal(kProfileCards(s.S,s.res))}
  else{o=payFromT(s.A,s.S);o.personal=payPersonal(tProfileCards(s.S,s.A))}
  return o;
}
/* Kartın adı ve tarama zamanı: kayıtlı ürünün adı önce, sonra tarama geçmişi */
function payName(){var tx=$("metin").value.trim(),k=typeof kayitFind==="function"?kayitFind(kayitLoad(),MODE,tx):null;if(k)return {name:k.name,t:k.t};var e=histLoad().filter(function(x){return x.id===HCUR&&(x.text||"").trim()===tx})[0];return {name:payAd(e||null,Date.now()),t:e&&e.t||Date.now()}}
function payBoyut(){var b=null;try{b=localStorage.getItem("pay_boyut")}catch(e){}return PAYLAS_AYAR.yerlesim[b]?b:PAYLAS_AYAR.boyut}
function payFonts(){
  if(!document.fonts||!document.fonts.load)return Promise.resolve();
  return Promise.all(["700 76px "+payYazi(true),"400 32px "+payYazi(false),"600 32px "+payYazi(false)].map(function(f){return document.fonts.load(f,t("pay.yazi_ornek")).catch(function(){})}));
}
function payLogo(){
  if(PAY_LOGO)return Promise.resolve(PAY_LOGO);
  return new Promise(function(ok){var i=new Image();i.onload=function(){PAY_LOGO=i;ok(i)};i.onerror=function(){ok(null)};i.src=PAYLAS_AYAR.logo});
}
function payOpen(ret){
  var src=paySource();if(!src)return;
  var bo=payBoyut(),L=PAYLAS_AYAR.yerlesim[bo],nm=payName(),opt={name:nm.name,t:nm.t,kisisel:false},blob=null,M=null;
  var body=el("div","paysheet"),cv=document.createElement("canvas");cv.className="paypre";cv.setAttribute("role","img");
  // Biçim seçici: hikâye (9:16) ya da gönderi (4:5); seçim hatırlanır
  var ks=Object.keys(PAYLAS_AYAR.yerlesim);
  if(ks.length>1){
    var seg=el("div","seg payseg");seg.setAttribute("role","radiogroup");seg.setAttribute("aria-label",t("pay.bicim"));
    ks.forEach(function(k){var b=el("button",null,PAYLAS_AYAR.yerlesim[k].etiket||k);b.type="button";b.setAttribute("role","radio");b.setAttribute("aria-checked",String(k===bo));
      b.onclick=function(){if(k===bo)return;bo=k;L=PAYLAS_AYAR.yerlesim[k];try{localStorage.setItem("pay_boyut",k)}catch(e){}
        seg.querySelectorAll("button").forEach(function(x){x.setAttribute("aria-checked",String(x===b))});draw()};
      seg.appendChild(b)});
    body.appendChild(seg);
  }
  var cw=el("div","paywrap");cw.appendChild(cv);body.appendChild(cw);   // çok uzun kart önizlemede kaydırılır
  var chk=null;
  if(src.personal.length){
    var lb=el("label","pc paychk");chk=document.createElement("input");chk.type="checkbox";chk.checked=false;
    lb.appendChild(chk);lb.appendChild(document.createTextNode(" "+t("pay.kisisel")));body.appendChild(lb);
    body.appendChild(el("div","how",t("pay.kisisel_not")));
    chk.onchange=function(){opt.kisisel=chk.checked;draw()};
  }
  var go=el("button",null,t("pay.dugme"));go.type="button";go.disabled=true;body.appendChild(go);
  var st=el("div","how");body.appendChild(st);
  function draw(){
    M=payModel(src,opt,PAYLAS_AYAR,L);go.disabled=true;blob=null;cv.width=L.w;cv.height=L.h;cv.classList.toggle("uzun",L.h/L.w>1.5);
    payDraw(cv.getContext("2d"),M,L,PAYLAS_AYAR,PAY_LOGO);var oran=cv.height/cv.width;cv.classList.toggle("uzun",oran>1.5&&oran<=2.2);cv.classList.toggle("cokuzun",oran>2.2);   // L.oto: yükseklik içeriğe göre
    cv.setAttribute("aria-label",payText(M));
    // Görsel önceden hazırlanır: Safari paylaşım menüsünü yalnızca dokunuşun içinde açar
    cv.toBlob(function(b){blob=b;go.disabled=!b},"image/png");
  }
  go.onclick=function(){
    if(!blob)return;
    var text=payText(M),file=null;
    try{file=new File([blob],t("pay.dosya_adi"),{type:"image/png"})}catch(e){}
    if(file&&navigator.canShare&&navigator.share&&navigator.canShare({files:[file]})){
      navigator.share({files:[file],text:text,title:M.name}).then(function(){payCount("s");st.textContent=t("pay.paylasildi")},function(e){if(!e||e.name!=="AbortError")payFallback(blob,text,st)});
    }else payFallback(blob,text,st);
  };
  openSheet(t("pay.baslik"),null,body,ret);
  st.textContent=t("pay.hazirlaniyor");
  Promise.all([payFonts(),payLogo()]).then(function(){draw();st.textContent=""});
}
/* Paylaşım menüsü yoksa (çoğu bilgisayar tarayıcısı): görsel indirilir, metin panoya kopyalanır */
function payFallback(blob,text,st){
  var a=document.createElement("a"),u=URL.createObjectURL(blob);a.href=u;a.download=t("pay.dosya_adi");document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(u)},4000);
  var msg=t("pay.indirildi");
  try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(function(){st.textContent=msg+" "+t("pay.panoya")},function(){})}}catch(e){}
  st.textContent=msg;payCount("d");
}
/* Anonim paylaşım sayacı: gövdesiz istek; ürün, metin ya da kişisel bilgi gönderilmez. t: s (paylaşım menüsü) | d (indirme) */
function payCount(tur){
  if(!PAYLAS_AYAR.sayac||!OCR_URL)return;
  var u=OCR_URL.replace(/\/$/,"")+PAYLAS_AYAR.sayac+"?t="+tur;
  try{if(navigator.sendBeacon&&navigator.sendBeacon(u))return}catch(e){}
  try{fetch(u,{method:"POST",mode:"no-cors",keepalive:true}).catch(function(){})}catch(e){}
}
