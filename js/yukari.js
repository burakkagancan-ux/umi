/* Yukarı çık düğmesi (14.10.2026, kullanıcı isteği: "çok aşağı inince yukarı çıkmak zor"): sayfa bir buçuk ekrandan fazla kaydırılınca
   sağ altta, alt menünün üstünde görünür; dokununca sayfanın başına kayar. Üç sayfada (ocr.html, ansiklopedi.html, index.html) dil.js'ten sonra. */
(function(){
  var b=document.createElement("button");
  b.type="button";b.className="yukari";b.hidden=true;
  b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  b.addEventListener("click",function(){
    var az=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({top:0,behavior:az?"auto":"smooth"});
  });
  function bak(){var g=window.scrollY>window.innerHeight*1.5;if(b.hidden===g)b.hidden=!g}
  window.addEventListener("scroll",bak,{passive:true});
  function ekle(){document.body.appendChild(b);bak()}
  if(document.body)ekle();else document.addEventListener("DOMContentLoaded",ekle);
  if(typeof DIL_HAZIR!=="undefined")DIL_HAZIR.then(function(){b.setAttribute("aria-label",t("ortak.yukari"))});
})();
