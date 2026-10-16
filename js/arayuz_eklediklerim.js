/* Arayüz: Eklediklerim ve ürün rozetlerinin sunucu sayımı (YOL_HARITASI.md G-02). Yalnızca ocr.html (OCR_URL ve barkodWorker gerekir).
   Barkodla eklenen ürünler cihazda değil sunucuda doğrulanır (başka biri aynı içeriği en az 10 dakika sonra ekleyince). Uygulama bu cihazın
   takma katkıcı kimliğiyle (O-22) Worker'a POST /katki {kim} sorar; yanıt: türe göre sayılar ve eklenen barkodların durumu.
   Kimlik URL'de değil gövdede gider. Kimlik yoksa (hiç ürün eklenmemiş) hiçbir istek yapılmaz. */
var EKLE_AYAR={tazeSn:6*3600,ekranTazeSn:60};   // açılışta en çok 6 saatte bir; Rozetlerim/Eklediklerim açılınca en çok dakikada bir
/* Sunucu sayılarını yeniler; yeni kademe varsa goster(kart) ile kutlar. Yanıtı döndürür (alınamazsa null).
   Son yanıt tazeSn'den yeniyse istek yapılmaz; liste gerekiyorsa (Eklediklerim) bu sayfada alınmış yanıt da aranır. */
function ekleSunucu(tazeSn,goster,liste){
  var kim=katkiciAl();if(!katkiciGecerli(kim)||!OCR_URL)return Promise.resolve(null);
  var d0=rozetLoad();if(d0.sunucu&&Date.now()-d0.sunucu.t<tazeSn*1000&&(!liste||EKLE_SON))return Promise.resolve(EKLE_SON);
  return barkodWorker("/katki",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kim:kim})}).then(function(j){
    if(!j||j.devreDisi||!Array.isArray(j.urunler))return null;
    EKLE_SON=j;
    return rozetDefYukle().then(function(def){
      var d=rozetSunucuYaz(rozetLoad(),j,Date.now()),yeni=[];
      ROZET_SUNUCU.forEach(function(a){def.turler.forEach(function(tur){var y=rozetYeni(def,d,a,tur);if(y){yeni.push(y);d=rozetGoruldu(d,a,tur,y.kademe)}})});
      if(!rozetStore(d))return j;
      rozetProfil();
      // Birden çok yeni kademe (ör. ilk eşitlemede) tek kartta: en yükseği gösterilir, ötekiler sayıyla
      if(goster&&yeni.length){
        yeni.sort(function(a,b){return b.sira-a.sira});
        var c=rozetKutlama(yeni[0]);
        if(yeni.length>1)c.querySelector(".rzg").insertBefore(el("p","how",t("rozet.daha",{n:yeni.length-1,l:yeni.slice(1).map(function(y){return t(y.ad)}).join(", ")})),c.querySelector(".rzrow"));
        goster(c);
      }
      return j;
    });
  }).catch(function(){return null});
}
var EKLE_SON=null;   // son yanıt (bu sayfa açıkken)

/* ---------- Profilim: "Eklediklerim" düğmesi (yalnızca bu cihazdan ürün eklendiyse) ---------- */
function ekleProfil(){
  var box=$("eklebar");if(!box)return;box.textContent="";
  if(!katkiciGecerli(katkiciAl()))return;
  var b=el("button","kayitac");b.type="button";
  b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6v12M7 6v12M10 6v12M14 6v12M16 6v12M20 6v12"/></svg>';
  var s=el("span","kt");s.appendChild(el("b",null,t("ekle.baslik")));
  var n=EKLE_SON?EKLE_SON.urunler.length:null;s.appendChild(el("span",n==null?"mut":"mut say",n==null?t("ekle.alt"):t("ekle.urun_say",{n:n})));b.appendChild(s);
  b.onclick=function(){location.hash="#eklediklerim"};box.appendChild(b);
}
/* ---------- Eklediklerim ekranı ---------- */
function ekleAc(){
  var box=$("ekle");box.textContent="";
  var bk=el("button","alt kback",t("kayit.geri"));bk.type="button";bk.onclick=ekleKapat;box.appendChild(bk);
  box.appendChild(el("h2",null,t("ekle.baslik")));
  box.appendChild(el("p","how",t("ekle.not")));
  var ul=el("div","klistk");ul.appendChild(el("p","mut",t("ortak.yukleniyor")));box.appendChild(ul);
  document.body.classList.add("mode-ekle");box.hidden=false;window.scrollTo(0,0);bk.focus();
  if(!katkiciGecerli(katkiciAl())){ul.textContent="";ul.appendChild(el("p","mut",t("ekle.bos")));return}
  ekleSunucu(EKLE_AYAR.ekranTazeSn,function(c){box.insertBefore(c,ul)},true).then(function(j){
    if(!document.body.classList.contains("mode-ekle"))return;
    ul.textContent="";
    if(!j){ul.appendChild(el("p","mut",t("ekle.ulasilamadi")));return}
    if(!j.urunler.length){ul.appendChild(el("p","mut",t("ekle.bos")));return}
    var say=0;j.urunler.forEach(function(u){if(u.dogrulandi)say++});
    ul.appendChild(el("p","mut",t("ekle.ozet",{n:j.urunler.length,d:say})));
    j.urunler.forEach(function(u){ul.appendChild(ekleSatir(u))});
    ekleProfil();
  });
}
function ekleSatir(u){
  var c=el("div","kitem ekitem");
  var hd=el("span","kin",u.kod);c.appendChild(hd);
  var m=el("span","kis");var tc=el("span","chip turr",t(KAYIT_TUR[u.tur]||"kayit.tur.gida"));tc.setAttribute("data-tur",KAYIT_TUR[u.tur]?u.tur:"gida");m.appendChild(tc);m.appendChild(document.createTextNode(" "+dilTarih(u.t,"gun")));c.appendChild(m);
  var dr=el("span","ekdurum");
  dr.appendChild(el("span","chip "+(u.dogrulandi?"ekok":"ekbek"),t(u.dogrulandi?"ekle.dogrulandi":"ekle.bekliyor")));
  if(u.oncu)dr.appendChild(el("span","chip ekok",t("rozet.oncu.ad")));
  if(u.dogrulayici)dr.appendChild(el("span","chip ekok",t("rozet.dogrulayici.ad")));
  c.appendChild(dr);
  if(u.ozet)c.appendChild(el("span","kis",u.ozet+(u.ozet.length>=80?"…":"")));
  return c;
}
function ekleKapat(){
  document.body.classList.remove("mode-ekle");$("ekle").hidden=true;
  if(location.hash==="#eklediklerim")location.replace("#profil");
  ekleProfil();
}
function ekleHash(){if(location.hash==="#eklediklerim")ekleAc();else if(document.body.classList.contains("mode-ekle")){document.body.classList.remove("mode-ekle");$("ekle").hidden=true}}
