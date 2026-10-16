/* Arayüz: gizlilik dostu ölçüm (A-03). Açılışta günde bir "açan cihaz" (ilk açılışta "yeni", 7–13 ve 30–59. günde bir kez "geri dönen"),
   her yeni taramada tür ve kaynağı (fotoğraf, barkod, barkod bulunamadı) sayılır; paylaşım ayrı sayaçta (js/arayuz_paylas.js payCount).
   Saf mantık js/olcum.js. Gönderilen yalnızca olayın adı, geri dönüşte ilk kullanım günü; kimlik, ürün, metin, barkod gitmez.
   Profilim › Ayarlar'dan kapatılır; tarayıcıda Global Privacy Control ya da Do Not Track açıksa hiç gönderilmez ve cihaza da yazılmaz. */
function olcumTarayiciKapali(){try{return navigator.globalPrivacyControl===true||navigator.doNotTrack==="1"}catch(e){return false}}
function olcumAcik(){return !!OCR_URL&&!olcumTarayiciKapali()&&!depoJson("olcum",{}).kapali}
function olcumGonder(ol){
  if(!olcumAcik())return;
  var u=OCR_URL.replace(/\/$/,"")+OLCUM_AYAR.yol+"?"+olcumSorgu(ol);
  try{if(navigator.sendBeacon&&navigator.sendBeacon(u))return}catch(e){}
  try{fetch(u,{method:"POST",mode:"no-cors",keepalive:true}).catch(function(){})}catch(e){}
}
/* Açılışta bir kez (js/arayuz_sayfa.js). Durum yazılamazsa (gizli sekme, depo kapalı) hiçbir şey sayılmaz: her açılış "yeni" görünmesin. */
function olcumAc(){
  if(!olcumAcik())return;
  var eski=depoDizi("taramalar").length>0||depoDizi("kayitli").length>0||depoMetin("profil")!=null;
  var r=olcumAcilis(depoJson("olcum",null),Date.now(),eski);
  if(depoYaz("olcum",r.durum))r.olaylar.forEach(olcumGonder);
}
/* Yeni tarama: k "f" fotoğraf, "b" barkodla bulunan, "y" barkodla bulunamayan; m tür (gida/koz/tem) */
function olcumTarama(k,m){olcumGonder(olcumTaramaOlay(k,m))}
/* Profilim › Ayarlar: açık/kapalı seçici; açıklama (i) düğmesinin arkasında (barkodAyarKutusu ile aynı görünüm) */
function olcumAyarKutusu(){
  var d=el("div","pbark"),hd=el("div","pt",t("olcum.ayar_baslik"));d.appendChild(hd);
  var ib=el("button","info sm","i");ib.type="button";ib.setAttribute("aria-label",t("ortak.hakkinda",{ad:t("olcum.ayar_baslik")}));
  ib.onclick=function(){openSheet(t("olcum.ayar_baslik"),null,el("p",null,t("olcum.ayar_metin")),ib)};hd.appendChild(ib);
  var s=document.createElement("select");s.id="olcumsec";s.setAttribute("aria-label",t("olcum.ayar_baslik"));
  [["acik",t("olcum.ayar_acik")],["kapali",t("olcum.ayar_kapali")]].forEach(function(o){var op=document.createElement("option");op.value=o[0];op.textContent=o[1];s.appendChild(op)});
  s.value=depoJson("olcum",{}).kapali?"kapali":"acik";
  s.onchange=function(){var dr=depoJson("olcum",{});if(!dr||typeof dr!=="object"||Array.isArray(dr))dr={};if(s.value==="kapali")dr.kapali=true;else delete dr.kapali;depoYaz("olcum",dr)};
  d.appendChild(s);return d;
}
