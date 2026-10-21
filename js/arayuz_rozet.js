/* Arayüz: rozetler (YOL_HARITASI.md G-01). Saf mantık js/rozet.js, tanımlar data/rozetler.json, metinler rozet.*.
   İki sayfada yüklenir (ocr.html, ansiklopedi.html); sayfaya özgü yardımcılara (el, $, openSheet) dayanmaz.
   - Sayım: rozetSay(aile, tür, öğe) → yeni kademe varsa kutlama kartı (bir kez; sayfaya satır içi kart, açılır pencere değil)
   - Rozetlerim ekranı (yalnızca ocr.html: #rozet, ocr.html#rozetler) ve rozet paylaşım kartı (ürün ve kişisel bilgi yok) */
var ROZET_DEF=null,ROZET_DEF_SOZ=null,ROZET_SUZ="gida";
function rzEl(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function rozetDefYukle(){
  if(!ROZET_DEF_SOZ)ROZET_DEF_SOZ=fetch("data/rozetler.json").then(function(r){if(!r.ok)throw new Error("rozetler");return r.json()}).then(function(d){ROZET_DEF=d;return d});
  return ROZET_DEF_SOZ;
}
function rozetLoad(){try{return rozetNorm(depoJson("rozetler",null))}catch(e){return rozetBos()}}
function rozetStore(d){return depoYaz("rozetler",rozetNorm(d))}
function rozetSimgeAdi(aile){var a=rozetAile(ROZET_DEF,aile);return a?a.simge:""}
function rozetSvgEl(aile,sira,kazanildi,cls){var s=rzEl("span","rzs"+(cls?" "+cls:""));s.innerHTML=rozetSvg(rozetSimgeAdi(aile),sira,kazanildi);return s}
/* Açıklama: ne yapıldığı (sayıyla); üst sınırlı ailenin son kademesinde "hepsi" metni */
function rozetAciklama(r){return t(r.hepsi?"rozet."+r.aile+".acik_hepsi":"rozet."+r.aile+".acik",{n:r.n,tur:t("rozet.tur."+r.tur)})}
function rozetAileAdi(r){return t("rozet."+r.aile+".ad")+" · "+t("kayit.tur."+r.tur)}

/* Sayım: öğe ilk kez görülüyorsa eklenir; yeni kademe varsa kutlama kartı goster(kart) ile sayfaya konur. Veri yüklenemezse sessizce geçer. */
function rozetSay(aile,tur,oge,goster){
  return rozetDefYukle().then(function(def){
    var s=rozetEkle(rozetLoad(),aile,tur,oge);if(!s.eklendi)return null;
    var d=s.d,y=rozetYeni(def,d,aile,tur);
    if(y)d=rozetGoruldu(d,aile,tur,y.kademe);
    if(!rozetStore(d))return null;   // saklanamıyorsa (gizli sekme) kutlama da yok: bir sonraki açılışta yeniden kutlanmasın
    if(y&&typeof aylikRozetYaz==="function")aylikRozetYaz(y);   // Aylık Özetim (U-09)
    if(y&&goster)goster(rozetKutlama(y));
    return y;
  }).catch(function(){return null});
}
/* Kutlama kartı: madalya, "Yeni rozet", kademe adı, aile · tür, açıklama; Paylaş, Rozetlerim, kapat */
function rozetKutlama(r){
  var c=rzEl("section","rozetkut");c.setAttribute("role","status");
  var x=rzEl("button","rzx","×");x.type="button";x.setAttribute("aria-label",t("ortak.kapat"));x.onclick=function(){c.remove()};c.appendChild(x);
  c.appendChild(rozetSvgEl(r.aile,r.sira,true,"buyuk"));
  var g=rzEl("div","rzg");
  g.appendChild(rzEl("div","rzu",t("rozet.yeni")));
  g.appendChild(rzEl("div","rza",t(r.ad)));
  g.appendChild(rzEl("div","rzf",rozetAileAdi(r)));
  g.appendChild(rzEl("p","rzp",rozetAciklama(r)));
  var row=rzEl("div","rzrow");
  var pb=rzEl("button",null,t("rozet.paylas"));pb.type="button";row.appendChild(pb);
  var lk=rzEl("a","rzlink",t("rozet.baslik"));lk.href="ocr.html#rozetler";row.appendChild(lk);
  g.appendChild(row);
  var st=rzEl("div","how");g.appendChild(st);
  c.appendChild(g);
  rozetPaylasHazirla(r,pb,st);
  return c;
}
/* Paylaşım: görsel kart hazırlanınca düğme açılır (Safari paylaşım menüsünü yalnızca dokunuşun içinde açar) */
function rozetPaylasHazirla(r,btn,st){
  var blob=null;btn.disabled=true;
  rozetKartGorsel(r).then(function(b){blob=b;btn.disabled=!b},function(){btn.disabled=true});
  btn.onclick=function(){
    if(!blob)return;
    var text=t("rozet.paylas_metin",{ad:t(r.ad),aciklama:rozetAciklama(r)}),file=null;
    try{file=new File([blob],t("rozet.dosya_adi"),{type:"image/png"})}catch(e){}
    if(file&&navigator.canShare&&navigator.share&&navigator.canShare({files:[file]})){
      navigator.share({files:[file],text:text,title:t(r.ad)}).then(function(){st.textContent=t("pay.paylasildi");if(typeof hareketTamam==="function")hareketTamam(btn)},function(e){if(!e||e.name!=="AbortError")rozetIndir(blob,st)});
    }else rozetIndir(blob,st);
  };
}
function rozetIndir(blob,st){
  var a=document.createElement("a"),u=URL.createObjectURL(blob);a.href=u;a.download=t("rozet.dosya_adi");document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(u)},4000);st.textContent=t("pay.indirildi");
}
function rozetResim(src){return new Promise(function(ok){var i=new Image();i.onload=function(){ok(i)};i.onerror=function(){ok(null)};i.src=src})}
function rozetKartGorsel(r){
  var y=typeof DIL!=="undefined"&&DIL.yazi||{},yazi={baslik:y.baslik,govde:y.govde,rtl:typeof DIL!=="undefined"&&DIL.yon==="rtl"};
  var svg=rozetSvg(rozetSimgeAdi(r.aile),r.sira,true).replace("<svg ",'<svg width="'+ROZET_KART.madalya+'" height="'+ROZET_KART.madalya+'" ');
  var fl=document.fonts&&document.fonts.load?Promise.all(["700 96px "+(yazi.baslik||PAY_HF_R),"400 42px "+(yazi.govde||PAY_BF_R),"600 46px "+(yazi.govde||PAY_BF_R)].map(function(f){return document.fonts.load(f).catch(function(){})})):Promise.resolve();
  return Promise.all([rozetResim("data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg)),rozetResim(PAYLAS_AYAR.logo),fl]).then(function(v){
    var cv=document.createElement("canvas");cv.width=ROZET_KART.w;cv.height=ROZET_KART.h;
    rozetKartCiz(cv.getContext("2d"),{ust:t("rozet.yeni"),ad:t(r.ad),aile:rozetAileAdi(r),aciklama:rozetAciklama(r),tarih:dilTarih(Date.now(),"gun")},PAYLAS_AYAR,v[0],v[1],yazi);
    return new Promise(function(ok){cv.toBlob(function(b){ok(b)},"image/png")});
  });
}
var PAY_HF_R='"Manrope",system-ui,sans-serif',PAY_BF_R='"Manrope",system-ui,sans-serif';

/* ---------- Rozetlerim (ocr.html) ---------- */
function rozetProfil(){
  var box=document.getElementById("rozetbar");if(!box)return;
  rozetDefYukle().then(function(def){
    box.textContent="";
    var n=rozetToplam(def,rozetLoad()),b=rzEl("button","kayitac rozetac");b.type="button";
    b.appendChild(rozetSvgEl("okur",1,n>0));
    var s=rzEl("span","kt");s.appendChild(rzEl("b",null,t("rozet.baslik")));s.appendChild(rzEl("span","mut say",n?t("rozet.say",{n:n}):t("rozet.henuz_yok")));b.appendChild(s);
    b.onclick=function(){location.hash="#rozetler"};box.appendChild(b);
  },function(){});
}
function rozetAc(){
  var box=document.getElementById("rozet");if(!box)return;
  rozetDefYukle().then(function(def){
    box.textContent="";
    var bk=rzEl("button","alt kback",t("kayit.geri"));bk.type="button";bk.onclick=rozetKapat;box.appendChild(bk);
    box.appendChild(rzEl("h2",null,t("rozet.baslik")));
    var d=rozetLoad();
    var sg=rzEl("div","seg kseg");sg.setAttribute("role","radiogroup");sg.setAttribute("aria-label",t("sayfa.urun_turu"));
    def.turler.forEach(function(tur){
      var n=0;def.aileler.forEach(function(a){n+=rozetDurumu(def,d,a.id,tur).kademe});
      var b=rzEl("button",null,t("ortak.baslik_sayi",{ad:t("kayit.tur."+tur),n:n}));b.type="button";b.setAttribute("role","radio");b.setAttribute("data-tur",tur);b.setAttribute("aria-checked",String(ROZET_SUZ===tur));
      b.onclick=function(){ROZET_SUZ=tur;rozetAc()};sg.appendChild(b);
    });
    box.appendChild(sg);
    def.aileler.forEach(function(a){box.appendChild(rozetAileKart(def,d,a.id,ROZET_SUZ))});
    box.appendChild(rzEl("p","how",t("rozet.not")));
    document.body.classList.add("mode-rozet");box.hidden=false;window.scrollTo(0,0);bk.focus();
    // Ürün rozetleri sunucudan (G-02; yalnızca ocr.html): sayılar değiştiyse ekran yeniden çizilir, yeni kademe kutlanır
    if(typeof ekleSunucu==="function"&&!rozetAc.yenilendi){
      var once=JSON.stringify(d.sunucu||null),kut=[];
      ekleSunucu(EKLE_AYAR.ekranTazeSn,function(c){kut.push(c)}).then(function(){
        if(!document.body.classList.contains("mode-rozet"))return;
        if(JSON.stringify(rozetLoad().sunucu||null)!==once||kut.length){rozetAc.yenilendi=true;rozetAc();rozetAc.yenilendi=false;kut.forEach(function(c){box.insertBefore(c,box.querySelector(".seg"))})}
      });
    }
  },function(){});
}
/* Aile kartı: simge (en yüksek kademe; yoksa gri), ad, kademe adı, ilerleme çubuğu, bütün kademeler (kazanılmamışlar soluk) */
function rozetAileKart(def,d,aile,tur){
  var r=rozetDurumu(def,d,aile,tur),c=rzEl("section","rzaile"+(r.yakinda?" yakinda":""));c.setAttribute("data-aile",aile);
  var hd=rzEl("div","rzhd");
  hd.appendChild(rozetSvgEl(aile,r.sira||1,r.kademe>0,"orta"));
  var g=rzEl("div","rzg");
  g.appendChild(rzEl("h3",null,t("rozet."+aile+".ad")));
  g.appendChild(rzEl("div","rza",r.kademe?t(r.ad):r.yakinda?t("ans.cok_yakinda"):t("rozet.henuz_yok")));
  hd.appendChild(g);c.appendChild(hd);
  c.appendChild(rzEl("p","how",t("rozet."+aile+".ne")));
  var adf=rozetAile(def,aile);
  if(adf&&adf.sunucu){   // sayım sunucudan: ne zaman alındığı ya da neden henüz olmadığı
    var su=d.sunucu,kimVar=typeof katkiciAl==="function"&&katkiciGecerli(katkiciAl());
    c.appendChild(rzEl("p","how rzsun",su?t("rozet.sunucu_t",{t:dilTarih(su.t,"gunsaat")}):t(kimVar?"rozet.sunucu_yok":"rozet.sunucu_kimlik_yok")));
  }
  if(r.yakinda){c.appendChild(rzEl("p","mut",t(rozetAile(def,aile).hazir?"rozet.yakinda_ans":"rozet.yakinda_urun")));return c}
  var bar=rzEl("div","rzbar");bar.setAttribute("role","progressbar");bar.setAttribute("aria-valuemin","0");bar.setAttribute("aria-valuemax","100");bar.setAttribute("aria-valuenow",String(Math.round(r.ilerleme*100)));
  var ic=rzEl("span");ic.style.width=Math.round(r.ilerleme*100)+"%";bar.appendChild(ic);c.appendChild(bar);
  c.appendChild(rzEl("div","rzil",r.sonraki!=null?t("rozet.ilerleme",{n:r.n,s:r.sonraki,ad:t(r.sonrakiAd)}):t("rozet.tamam")));
  bar.setAttribute("aria-label",c.lastChild.textContent);
  var ks=rzEl("div","rzks");
  r.esikler.forEach(function(e,i){
    var k=rzEl("span","rzk"+(i<r.kademe?" on":""));
    var son=!!rozetAile(def,aile).toplam&&i===r.esikler.length-1;
    k.appendChild(rozetSvgEl(aile,rozetSira(def,aile,tur,i),i<r.kademe));
    k.appendChild(rzEl("span","rzkn",son?t("rozet.hepsi"):dilSayi(e)));
    k.title=t(son?"rozet.kademe_hepsi":"rozet.kademe",{ad:t(rozetAdAnahtar(def,aile,tur,i)),s:e});k.setAttribute("aria-label",k.title);k.setAttribute("role","img");
    ks.appendChild(k);
  });
  c.appendChild(ks);
  if(r.kademe){var row=rzEl("div","rzrow"),pb=rzEl("button","alt",t("rozet.paylas"));pb.type="button";row.appendChild(pb);c.appendChild(row);var st=rzEl("div","how");c.appendChild(st);rozetPaylasHazirla(r,pb,st)}
  return c;
}
function rozetKapat(){
  document.body.classList.remove("mode-rozet");var box=document.getElementById("rozet");if(box)box.hidden=true;
  if(location.hash==="#rozetler")location.replace("#profil");
  rozetProfil();
}
function rozetHash(){if(location.hash==="#rozetler")rozetAc();else if(document.body.classList.contains("mode-rozet")){document.body.classList.remove("mode-rozet");document.getElementById("rozet").hidden=true}}
