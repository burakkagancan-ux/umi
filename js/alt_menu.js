/* Alt menünün küçülmesi (16.10.2026, kullanıcı isteği: "sayfayı aşağı kaydırınca biraz küçülsün", Instagram'daki gibi): aşağı kayınca .tabbar'a
   .kucuk sınıfı eklenir (yazılar gizlenir, simgeler kalır), yukarı kayınca ya da sayfanın başına dönünce kaldırılır. Görünüm tema.css'te.
   Üç sayfada (ocr.html, ansiklopedi.html, index.html) yukari.js'ten sonra. */
(function(){
  var ESIK=8,UST=24;   // parmak titremesi küçültüp büyütmesin; sayfanın başında hep tam boy
  var son=window.scrollY,bekliyor=false;
  function bak(){
    bekliyor=false;
    var m=document.querySelector(".tabbar");if(!m)return;
    var y=window.scrollY,f=y-son;
    if(y<=UST)m.classList.remove("kucuk");
    else if(f>ESIK)m.classList.add("kucuk");
    else if(f<-ESIK)m.classList.remove("kucuk");
    else return;   // küçük kıpırtıda başlangıç noktası yerinde kalır, yavaş kaydırma da sonunda eşiği geçer
    son=y;
  }
  window.addEventListener("scroll",function(){if(!bekliyor){bekliyor=true;requestAnimationFrame(bak)}},{passive:true});
})();
