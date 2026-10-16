/* Yukarı çık düğmesi (14.10.2026, kullanıcı isteği: "çok aşağı inince yukarı çıkmak zor"): sayfa bir buçuk ekrandan fazla kaydırılınca
   sağ altta, alt menünün üstünde görünür; dokununca sayfanın başına kayar. Üç sayfada (ocr.html, ansiklopedi.html, index.html) dil.js'ten sonra. */
(function(){
  /* Stil burada (tema.css'te değil): sayfa yeni, tema.css tarayıcı önbelleğinden eski gelirse düğme Etiket Oku'nun genel düğme stiline
     (geniş yeşil kutu) düşüyor ya da Ansiklopedi'de hiç görünmüyordu (14.10.2026). "button.yukari" sayfaların button kurallarını geçer.
     Alt menünün üstünde, alt sayfaların (z-index 40) altında. */
  var st=document.createElement("style");
  st.textContent='button.yukari{position:fixed;inset-inline-end:16px;bottom:calc(80px + env(safe-area-inset-bottom,0px));z-index:30;width:48px;height:48px;min-height:0;margin:0;padding:0;display:flex;align-items:center;justify-content:center;border-radius:50%;border:0;background:var(--ok,#2741C8);color:#fff;box-shadow:0 2px 6px rgba(27,33,30,.18),0 6px 18px rgba(27,33,30,.14);cursor:pointer}'+
    'button.yukari[hidden]{display:none}button.yukari svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}';
  document.head.appendChild(st);
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
