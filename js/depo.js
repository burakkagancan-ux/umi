/* Cihaz deposu (U-07 7. adım, 15.10.2026): uygulamanın cihazda sakladığı her şeye tek giriş noktası. Klasik betik; üç sayfada da ilk betik
   (veri_surum.js'ten önce). Arka uç bugün tarayıcının localStorage'ı; mağaza sürümünde (C-02) iOS web görünümü depolama sıkışınca
   localStorage'ı silebildiği için kalıcı depoya (ör. Capacitor Preferences) geçilecek: o zaman yalnızca depoArka değişir.
   Bütün işlevler hatayı yutar (gizli sekme, kota dolu, depo kapalı): okuma varsayılanı, yazma false döner; sayfa hiçbir zaman kırılmaz.
   Anahtarlar ve biçimleri js/veri_surum.js VERI_ANAHTAR'da (test/veri_surum.js kodu tarar). Yeni kod localStorage'a doğrudan erişmez. */
var DEPO_ARKA=null;   // testler ya da mağaza sürümü için başka bir {getItem, setItem, removeItem}
function depoArka(){if(DEPO_ARKA)return DEPO_ARKA;try{return window.localStorage}catch(e){return null}}
/* Düz metin; yoksa ya da okunamazsa null */
function depoMetin(k){try{var a=depoArka();return a?a.getItem(k):null}catch(e){return null}}
/* JSON; yoksa, bozuksa ya da okunamazsa bos */
function depoJson(k,bos){var s=depoMetin(k);if(s==null||s==="")return bos;try{return JSON.parse(s)}catch(e){return bos}}
/* JSON dizi; dizi değilse boş dizi */
function depoDizi(k){var v=depoJson(k,null);return Array.isArray(v)?v:[]}
/* JSON yazar; başarılıysa true */
function depoYaz(k,v){try{depoArka().setItem(k,JSON.stringify(v));return true}catch(e){return false}}
/* Düz metin yazar; başarılıysa true */
function depoYazMetin(k,s){try{depoArka().setItem(k,String(s));return true}catch(e){return false}}
function depoSil(k){try{depoArka().removeItem(k);return true}catch(e){return false}}
