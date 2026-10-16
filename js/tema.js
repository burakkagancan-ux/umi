/* Tema seçimi (17.10.2026, kullanıcı isteği: "profilin içine tema seçeneği koy, dark veya normal"): Profilim > Ayarlar > Görünüm: Telefona göre | Açık | Koyu.
   Seçim cihaz deposunda "tema" ("acik" | "koyu"; yoksa telefona göre). Klasik betik; üç sayfada <head>'de depo.js'ten hemen sonra, defer'siz:
   sayfa çizilmeden <html data-tema="acik|koyu"> konur, açılışta yanlış renk bir an bile görünmez. Koyu renkler tema.css ve sayfa dosyalarında
   :root[data-tema="koyu"] / [data-tema="koyu"] ile (önceki @media (prefers-color-scheme:dark) yerine). Telefona göre seçiliyken telefonun modu
   değişince sayfa da değişir; başka sekmede seçim değişince bu sekme de uyar. Tarayıcı çubuğunun rengi (theme-color) seçime uyar. */
var TEMA_RENK={acik:"#2741c8",koyu:"#0F1211"};
/* Kayıtlı seçim: "acik", "koyu" ya da "" (telefona göre) */
function temaSecim(){var s=depoMetin("tema");return s==="acik"||s==="koyu"?s:""}
function temaTelefonKoyu(){try{return !!(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)}catch(e){return false}}
function temaUygula(){
  var s=temaSecim(),g=s||(temaTelefonKoyu()?"koyu":"acik");   // görünen tema
  document.documentElement.setAttribute("data-tema",g);
  // theme-color: seçim varsa iki etiket de seçilen renkte; telefona göreyse her etiket kendi media koşulunun rengine döner
  var ms=document.querySelectorAll('meta[name="theme-color"]');
  for(var i=0;i<ms.length;i++)ms[i].setAttribute("content",TEMA_RENK[s||(/dark/.test(ms[i].getAttribute("media")||"")?"koyu":"acik")]);
}
/* Seçimi kaydeder ve uygular ("" = telefona göre) */
function temaSec(s){if(s==="acik"||s==="koyu")depoYazMetin("tema",s);else depoSil("tema");temaUygula()}
temaUygula();
(function(){
  try{var mq=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)");
    if(mq){if(mq.addEventListener)mq.addEventListener("change",temaUygula);else if(mq.addListener)mq.addListener(temaUygula)}}catch(e){}
  window.addEventListener("storage",function(e){if(e.key==="tema"||e.key===null)temaUygula()});
})();
