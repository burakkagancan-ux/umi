/* Arayüz: Etiket Oku'da sonuç yokken "Son Okutulanlar" (21.10.2026, kullanıcı isteği). Tarama geçmişinin (localStorage "taramalar",
   js/arayuz_karsilastir.js) en yeni SON_EN_FAZLA kaydı; dokununca o taramanın sonucu yeniden açılır, geçmişe yeni kayıt yazılmaz.
   Neden: sonuçtan başka sayfaya (yöntem, alt menü, Geri) gidip dönünce sonuç kayboluyordu. Kayıtlar yalnızca cihazda; istek gitmez. */
var SON_EN_FAZLA=10;
function sonCiz(){
  var box=$("son");if(!box)return;box.textContent="";
  var a=histLoad().filter(function(x){return x&&x.id&&(x.text||"").trim()}).slice(0,SON_EN_FAZLA);   // en yeni başta (histAdd)
  box.hidden=!a.length;if(!a.length)return;
  box.appendChild(el("h2",null,t("son.baslik")));
  var dz=!1;
  a.forEach(function(x){
    var m=x.mode||"gida";
    if(!x.oz){var o=kayitSimdi(m,x.text);if(o){x.oz=o;dz=!0}}   // eski kayıtlar: veri yüklüyse özet bir kez hesaplanıp saklanır
    var b=el("button","kitem kkayit");b.type="button";
    b.appendChild(el("span","kin",x.name||""));
    var s=el("span","kis"),tc=el("span","chip turr",t(KAYIT_TUR[m]||"kayit.tur.gida"));tc.setAttribute("data-tur",m);s.appendChild(tc);
    s.appendChild(document.createTextNode(" "+dilTarih(x.t,"gun")));b.appendChild(s);
    var oz=el("span","koz");
    if(x.oz){
      if(x.oz.u){oz.appendChild(cmpIcon(3));oz.appendChild(document.createTextNode(t("kars.say.uyari",{n:x.oz.u})+"  "))}
      if(x.oz.d){oz.appendChild(cmpIcon(2));oz.appendChild(document.createTextNode(t("kars.say.dikkat",{n:x.oz.d})))}
      if(!x.oz.u&&!x.oz.d){oz.appendChild(cmpIcon(0));oz.appendChild(document.createTextNode(t("risk.yok")))}
    }
    b.appendChild(oz);
    b.onclick=function(){sonAc(x)};
    box.appendChild(b);
  });
  box.appendChild(el("div","how it",t("son.not",{n:SON_EN_FAZLA})));
  if(dz){var h=histLoad();h.forEach(function(y){a.forEach(function(x){if(x.id===y.id&&x.oz&&!y.oz)y.oz=x.oz})});histStore(h)}
}
/* Satır: metin kutuya konur, tür seçilir, analiz edilir. HMOD "gor": geçmişe yazılmaz; HCUR: sonra elle düzeltilirse aynı kayıt güncellenir */
function sonAc(x){
  if(CMP_IDS)closeCompare();
  fotoTemizle();
  $("metin").value=x.text;HSCAN=false;HMOD="gor";HCUR=x.id;
  if(MODE!==(x.mode||"gida"))setMode(x.mode||"gida",true);else run();
  var s=$("sonuc");if(s&&s.scrollIntoView)s.scrollIntoView({block:"start"});
}
window.addEventListener("storage",function(e){if(e.key==="taramalar"&&!document.body.classList.contains("sonuclu"))sonCiz()});   // başka sekmede taranınca
