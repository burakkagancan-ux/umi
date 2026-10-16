/* Küçük hareket detayları (17.10.2026, kullanıcı isteği: "ufak gözüken ama güzel detaylar"). Üç sayfada (ocr.html, ansiklopedi.html, index.html)
   alt_menu.js'ten sonra. Görünüm tema.css'te ("Küçük hareket detayları"); seçili sekme işareti js/alt_menu.js'te.
   - Seçim pop'u: aria-pressed düğme, onay kutusu ya da seçenek dokunuşla seçili olunca .pop (Kaydet ayrıca .halka). Süzgeçler tıklanınca baştan
     çizildiği için tıklanan öğe artık sayfada yoksa, aynı sınıflı öğeler içindeki sırasıyla yerine çizilen bulunur.
   - hareketTamam(düğme): iş bitince düğmenin başında bir an ✓ (paylaşıldı).
   - hareketCik(öğe, sonra): öğe küçülüp kaybolur, yeri kapanır, ardından sonra() (silme).
   - hareketSay(kök): kökteki 1–3 basamaklı sayılar sıfırdan sayar; bitince metin birebir eski hâline döner (özet kartı).
   "Hareketi azalt" açıksa hiçbiri oynamaz: sonra() hemen çağrılır, sayılar olduğu gibi kalır. */
(function(){
  var SEC='button[aria-pressed],input[type="checkbox"],input[type="radio"],[role="tab"],[role="radio"]';
  function az(){try{return matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){return false}}
  function secili(x){return x.getAttribute("aria-pressed")==="true"||x.getAttribute("aria-checked")==="true"||x.getAttribute("aria-selected")==="true"||x.checked===true}
  function oynat(x,cls,ms){x.classList.remove(cls);void x.offsetWidth;x.classList.add(cls);setTimeout(function(){x.classList.remove(cls)},ms)}
  function anahtar(x){return x.tagName+"|"+x.className.replace(/(^|\s)(pop|halka|tamam)(?=\s|$)/g," ").trim()}
  function esler(k){return [].filter.call(document.querySelectorAll(SEC),function(y){return anahtar(y)===k})}
  window.hareketAz=az;

  var son=null;
  document.addEventListener("click",function(e){   // yakalama evresi: öğenin kendi işleyicisi (ve olası yeniden çizim) çalışmadan önce
    son=null;var x=e.target&&e.target.closest&&e.target.closest(SEC);if(!x||az())return;
    var k=anahtar(x);son={x:x,k:k,i:esler(k).indexOf(x)};
  },true);
  document.addEventListener("click",function(){   // kabarcık evresi: işleyiciler çalıştıktan sonra
    var s=son;son=null;if(!s)return;
    var x=s.x.isConnected?s.x:esler(s.k)[s.i];
    if(!x||!secili(x))return;
    oynat(x,"pop",400);if(x.id==="kaydet")oynat(x,"halka",600);
  });

  window.hareketTamam=function(b){if(b)oynat(b,"tamam",1500)};

  window.hareketCik=function(x,sonra){
    if(!x||!x.isConnected||az()||!x.animate){sonra();return}
    var bitti=false;function bit(){if(!bitti){bitti=true;sonra()}}
    var cs=getComputedStyle(x),pcs=getComputedStyle(x.parentNode);
    var yatay=/inline/.test(cs.display)||(/flex/.test(pcs.display)&&!/column/.test(pcs.flexDirection));   // yan yana öğede genişlik, alt alta öğede yükseklik kapanır
    var bas=yatay?{width:x.offsetWidth+"px",marginInlineStart:cs.marginInlineStart,marginInlineEnd:cs.marginInlineEnd,paddingInlineStart:cs.paddingInlineStart,paddingInlineEnd:cs.paddingInlineEnd}
                 :{height:x.offsetHeight+"px",marginTop:cs.marginTop,marginBottom:cs.marginBottom,paddingTop:cs.paddingTop,paddingBottom:cs.paddingBottom};
    var bit0={};Object.keys(bas).forEach(function(p){bit0[p]="0px"});
    x.style.overflow="hidden";x.style.pointerEvents="none";if(yatay)x.style.whiteSpace="nowrap";
    x.animate([{opacity:1,transform:"none"},{opacity:0,transform:"scale(.9)"}],{duration:140,easing:"ease-in",fill:"forwards"}).finished
      .then(function(){return x.animate([bas,bit0],{duration:110,easing:"ease-out",fill:"forwards"}).finished}).then(bit,bit);
    setTimeout(bit,600);   // animasyon bir nedenle bitmezse silme yine de tamamlanır
  };

  window.hareketSay=function(kok){
    if(!kok||az()||!window.requestAnimationFrame)return;
    var w=document.createTreeWalker(kok,NodeFilter.SHOW_TEXT),d=[],n;
    while((n=w.nextNode()))if(/\b\d{1,3}\b/.test(n.nodeValue))d.push({n:n,s:n.nodeValue});
    if(!d.length)return;
    var t0=null,SURE=450;
    function adim(z){
      if(t0===null)t0=z;var p=Math.min(1,(z-t0)/SURE),e=1-Math.pow(1-p,3);
      d.forEach(function(o){o.n.nodeValue=p<1?o.s.replace(/\b\d{1,3}\b/g,function(m){return String(Math.round(+m*e))}):o.s});
      if(p<1)requestAnimationFrame(adim);
    }
    requestAnimationFrame(adim);
  };
})();
