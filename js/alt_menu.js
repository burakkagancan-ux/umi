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
/* Seçili sekme işareti (17.10.2026, kullanıcı isteği: küçük hareket detayları): menünün üst kenarında, seçili sekmenin üstünde kısa bir çizgi; sekme
   değişince eski sekmeden yenisine kayar, yeni sekmenin simgesi hafifçe zıplar. Başka sayfaya geçerken eski sekme sessionStorage'a yazılır, yeni sayfa
   işareti oradan başlatıp kaydırır; aynı sayfadaki geçiş (Etiket Oku ↔ Profilim, js/arayuz_sayfa.js tabSync) aria-current değişiminden izlenir.
   Görünüm tema.css'te; "hareketi azalt" açıksa işaret kaymadan yerine konur. */
(function(){
  var m=document.querySelector(".tabbar");if(!m)return;
  var is=document.createElement("span");is.className="sekme-isaret";is.setAttribute("aria-hidden","true");m.appendChild(is);
  function secili(){return m.querySelector('a[aria-current="page"]')}
  function koy(a,kay){
    if(!a||!a.offsetWidth){is.style.opacity="0";return}
    is.classList.toggle("kay",!!kay);is.style.opacity="";is.style.transform="translateX("+(a.offsetLeft+a.offsetWidth/2)+"px)";
  }
  function zipla(a){var s=a&&a.querySelector("svg");if(!s)return;s.classList.remove("zipla");void s.getBoundingClientRect();s.classList.add("zipla");setTimeout(function(){s.classList.remove("zipla")},450)}
  var once=null,son=secili();
  try{once=sessionStorage.getItem("sekme_once");sessionStorage.removeItem("sekme_once")}catch(e){}
  var o=once&&/^[a-z]+$/.test(once)&&m.querySelector('a[data-tab="'+once+'"]');
  if(o&&son&&o!==son){koy(o,false);requestAnimationFrame(function(){requestAnimationFrame(function(){koy(secili(),true);zipla(secili())})})}
  else koy(son,false);
  m.addEventListener("click",function(e){
    var x=e.target.closest&&e.target.closest("a[data-tab]"),a=secili();
    if(x&&a&&x!==a&&x.pathname!==location.pathname){try{sessionStorage.setItem("sekme_once",a.getAttribute("data-tab"))}catch(er){}}
  });
  new MutationObserver(function(){var a=secili();if(a!==son){son=a;koy(a,true);zipla(a)}}).observe(m,{subtree:true,attributes:true,attributeFilter:["aria-current"]});
  // Sekme genişliği değişince (ekran döndü, dil değişti, Liste sekmesi açıldı) işaret yeniden yerine konur
  if(typeof ResizeObserver==="function"){var ilk=true,ro=new ResizeObserver(function(){if(ilk){ilk=false;return}koy(secili(),false)});   // ilk bildirim gözlem başlarken gelir; açılıştaki kaymayı bozmasın
  [].forEach.call(m.querySelectorAll("a[data-tab]"),function(a){ro.observe(a)})}
  else window.addEventListener("resize",function(){koy(secili(),false)});
})();
