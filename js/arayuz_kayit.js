/* Arayüz: kaydedilen ürünler. Sonuç barında "Kaydet", Profilim'de "Kaydedilen Ürünlerim" ekranı (tür süzgeci, arama, sıralama,
   aç / karşılaştır / yeniden adlandır / sil, yedekle / geri yükle). Saf mantık js/kayit.js. Kayıtlar yalnızca bu cihazda. */
var KAYIT_ACILAN=null;   // listeden açılan kaydın kimliği: sonuç çizilince değerlendirme değişti mi bakılır
function kayitLoad(){return depoDizi("kayitli")}
function kayitStore(a){return depoYaz("kayitli",a)}
function kayitGet(id){return kayitLoad().filter(function(x){return x.id===id})[0]||null}
function kayitTarih(ms){return dilTarih(ms,"gun")}
/* Ekrandaki sonucun özeti (veri yüklüyse) */
function kayitSimdi(mode,text){
  try{if(!karsReady(mode))return null;return kayitOzet(karsProduct({mode:mode,text:text,name:""}))}catch(e){return null}
}
/* Gıdada ekranda gösterilen besin tablosunun kaynağıyla kopyası (js/arayuz_besin.js); tablo yoksa undefined (eski kayıttaki korunur) */
function kayitBesin(mode,text){
  if(mode!=="gida"||typeof besinKaynak!=="function")return undefined;
  return besinKayitKopya(besinKaynak(text))||undefined;
}
/* Sonuç barındaki düğme: kayıtlıysa "Kaydedildi", değilse "Kaydet" */
function kayitBtn(mode){
  var text=$("metin").value.trim(),k=kayitFind(kayitLoad(),mode,text);
  var b=el("button","alt pay kayitb"+(k?" on":""));b.type="button";
  b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>';
  b.appendChild(document.createTextNode(t(k?"kayit.kaydedildi":"kayit.kaydet")));
  b.setAttribute("aria-label",k?t("kayit.kayitli_aria",{ad:k.name}):t("kayit.kaydet_aria"));
  b.onclick=function(){kayitForm(mode,text,b)};
  kayitDegisti(mode,text);
  return b;
}
/* Listeden açılan kayıtta değerlendirme kaydedildiğinden farklıysa bilgi kartı; özet güncellenir */
function kayitDegisti(mode,text){
  if(!KAYIT_ACILAN)return;
  var a=kayitLoad(),k=a.filter(function(x){return x.id===KAYIT_ACILAN})[0];KAYIT_ACILAN=null;
  if(!k||k.mode!==mode||k.text!==text)return;
  var oz=kayitSimdi(mode,text);if(!oz)return;
  var f=kayitFark(k.oz,oz);
  k.oz=oz;kayitStore(a);
  if(!f)return;
  var c=el("div","res "+(f.kotu?"y":"u"));c.appendChild(el("div","t",t("kayit.degisti.baslik")));
  c.appendChild(el("div","ln",t("kayit.degisti.satir",{once:f.once,simdi:f.simdi})));
  c.appendChild(el("div","how",t("kayit.degisti.not")));
  setTimeout(function(){sonucUst(c)},0);
}
/* Kaydet / düzenle formu: ad (zorunlu), not (isteğe bağlı) */
function kayitForm(mode,text,ret){
  var a=kayitLoad(),k=kayitFind(a,mode,text),body=el("div","kform");
  var h=histLoad().filter(function(x){return x.id===HCUR&&x.text===text})[0];
  var def=k?k.name:h&&!histOtoNo(h.name)?h.name:"";
  var l1=el("label","kname");l1.appendChild(el("span",null,t("kars.urun_adi")));
  var inp=document.createElement("input");inp.type="text";inp.maxLength=60;inp.value=def;inp.placeholder=t("kayit.form.ad_ornek");inp.autocomplete="off";l1.appendChild(inp);body.appendChild(l1);
  var l2=el("label","kname");l2.appendChild(el("span",null,t("kayit.form.not")));
  var nt=document.createElement("textarea");nt.maxLength=300;nt.rows=2;nt.value=k?k.note||"":"";nt.placeholder=t("kayit.form.not_ornek");l2.appendChild(nt);body.appendChild(l2);
  body.appendChild(el("div","how",t("kayit.form.tur",{tur:t(KAYIT_TUR[mode])})));
  var msg=el("div","how");
  var go=el("button",null,t(k?"kayit.form.degisiklik":"kayit.kaydet"));go.type="button";
  go.onclick=function(){
    var name=inp.value.trim();if(!name){msg.textContent=t("kayit.form.ad_ver");inp.focus();return}
    var list=kayitLoad();
    if(!kayitFind(list,mode,text)&&list.length>=KAYIT_AYAR.enFazla){msg.textContent=t("kayit.form.sinir",{n:KAYIT_AYAR.enFazla});return}
    list=kayitAdd(list,{id:"k"+Date.now(),t:Date.now(),mode:mode,name:name,note:nt.value,text:text,oz:kayitSimdi(mode,text),besin:kayitBesin(mode,text)},KAYIT_AYAR.enFazla);
    if(!kayitStore(list)){msg.textContent=t("kayit.form.yer_yok");return}
    if(h&&h.name!==name)histRename(h.id,name);   // karşılaştırma ve paylaşım kartı da bu adı kullanır
    closeSheet();setSt(mode,t("kayit.form.kaydedildi",{ad:name}));kayitBarYenile();kayitProfil();fotoTemizle();
  };
  body.appendChild(go);body.appendChild(msg);
  if(k){var del=el("button","alt",t("kayit.form.sil"));del.type="button";
    del.onclick=function(){kayitStore(kayitLoad().filter(function(x){return x.id!==k.id}));closeSheet();setSt(mode,t("kayit.form.silindi",{ad:k.name}));kayitBarYenile();kayitProfil()};
    body.appendChild(del)}
  openSheet(t(k?"kayit.form.baslik_kayitli":"kayit.form.baslik"),null,body,ret);
  setTimeout(function(){inp.focus()},50);
}
function kayitBarYenile(){var o=document.querySelector("#sonuc .resbar .kayitb");if(o)o.parentNode.replaceChild(kayitBtn(MODE),o)}

/* ---------- Profilim: "Kaydedilen Ürünlerim" düğmesi ---------- */
function kayitProfil(){
  var box=$("kayitbar");if(!box)return;box.textContent="";
  var n=kayitLoad().length,b=el("button","kayitac");b.type="button";
  b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>';
  var s=el("span","kt");s.appendChild(el("b",null,t("kayit.baslik")));s.appendChild(el("span","mut say",n?t("kayit.urun_say",{n:n}):t("kayit.henuz_yok")));b.appendChild(s);
  b.onclick=function(){kayitAc()};box.appendChild(b);
}

/* ---------- Kaydedilen Ürünlerim ekranı ---------- */
var KAYIT_SUZ={mode:"",q:"",sira:"yeni"};
(function(){var ks=depoJson("kayit_suz",null);if(ks&&typeof ks==="object"){KAYIT_SUZ.mode=KAYIT_TUR[ks.mode]?ks.mode:"";KAYIT_SUZ.sira=["yeni","ad","risk"].indexOf(ks.sira)>-1?ks.sira:"yeni"}})();
function kayitAc(){
  var box=$("kayit");box.textContent="";
  var bk=el("button","alt kback",t("kayit.geri"));bk.type="button";bk.onclick=kayitKapat;box.appendChild(bk);
  box.appendChild(el("h2",null,t("kayit.baslik")));
  var all=kayitLoad(),say=kayitSay(all);
  // Tür süzgeci
  var sg=el("div","seg kseg");sg.setAttribute("role","radiogroup");sg.setAttribute("aria-label",t("kayit.suzgec"));
  [["","kayit.tumu"],["gida","kayit.tur.gida"],["koz","kayit.tur.koz"],["tem","kayit.tur.tem"]].forEach(function(x){
    var b=el("button",null,t("ortak.baslik_sayi",{ad:t(x[1]),n:say[x[0]]}));b.type="button";b.setAttribute("role","radio");b.setAttribute("data-m",x[0]);if(x[0])b.setAttribute("data-tur",x[0]);b.setAttribute("aria-checked",String(KAYIT_SUZ.mode===x[0]));
    b.onclick=function(){KAYIT_SUZ.mode=x[0];kayitSuzKaydet();kayitAc()};sg.appendChild(b);
  });
  box.appendChild(sg);
  var row=el("div","krow");
  var q=document.createElement("input");q.type="search";q.id="kara";q.placeholder=t("kayit.ara_ph");q.value=KAYIT_SUZ.q;q.setAttribute("aria-label",t("kayit.ara"));row.appendChild(q);
  var so=document.createElement("select");so.id="ksira";so.setAttribute("aria-label",t("kayit.siralama"));
  [["yeni","kayit.sira.yeni"],["ad","kayit.sira.ad"],["risk","kayit.sira.risk"]].forEach(function(o){var op=document.createElement("option");op.value=o[0];op.textContent=t(o[1]);if(KAYIT_SUZ.sira===o[0])op.selected=true;so.appendChild(op)});
  so.onchange=function(){KAYIT_SUZ.sira=so.value;kayitSuzKaydet();ciz()};row.appendChild(so);
  box.appendChild(row);
  var ul=el("div","klistk");box.appendChild(ul);
  function ciz(){
    ul.textContent="";
    var L=kayitList(kayitLoad(),KAYIT_SUZ.mode,KAYIT_SUZ.q,KAYIT_SUZ.sira);
    if(!L.length){ul.appendChild(el("p","mut",t(all.length?"kayit.suzgec_bos":"kayit.liste_bos")));return}
    L.forEach(function(k){ul.appendChild(kayitSatir(k))});
  }
  q.oninput=function(){KAYIT_SUZ.q=q.value;ciz()};
  ciz();
  // Yedekleme: kayıtlar yalnızca bu cihazda; telefon değişince ya da tarayıcı verisi silinince kaybolmasın
  var yd=el("div","kyedek");yd.appendChild(el("h3",null,t("kayit.yedek.baslik")));
  yd.appendChild(el("div","how",t("kayit.yedek.not")));
  var r2=el("div","row");
  var ex=el("button","alt",t("kayit.yedek.indir"));ex.type="button";ex.disabled=!all.length&&!katkiciAl()&&rozetBosMu(rozetLoad());
  ex.onclick=function(){
    var blob=new Blob([kayitYedek(kayitLoad(),0,katkiciGecerli(katkiciAl())?katkiciAl():"",rozetBosMu(rozetLoad())?null:rozetLoad())],{type:"application/json"}),a=document.createElement("a"),d=new Date();
    a.href=URL.createObjectURL(blob);a.download="umi-kayitlar-"+d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate()+".json";document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);
  };
  var im=el("button","alt",t("kayit.yedek.yukle"));im.type="button";
  var fi=document.createElement("input");fi.type="file";fi.accept="application/json,.json";fi.className="vh";fi.id="kyedekdosya";
  im.onclick=function(){fi.click()};
  var ym=el("div","how");
  fi.onchange=function(){
    var f=fi.files&&fi.files[0];if(!f)return;
    var rd=new FileReader();rd.onload=function(){
      var r=kayitGeriYukle(kayitLoad(),String(rd.result),KAYIT_AYAR.enFazla);
      if(!r.ok){ym.textContent=r.hata;return}
      // Katkıcı kimliği yalnızca bu cihazda henüz yoksa alınır (bu cihazdaki katkılar başka kimliğe geçmesin)
      if(r.katkici&&!katkiciGecerli(katkiciAl()))katkiciYaz(r.katkici);
      if(r.rozetler){rozetStore(rozetBirlestir(rozetLoad(),r.rozetler));rozetProfil()}   // rozetler birleşir; geri gelen kademe yeniden kutlanmaz (gor da birleşir)
      kayitStore(r.list);kayitProfil();kayitAc();
      $("kayit").querySelector(".kyedek .how:last-child").textContent=t("kayit.yedek.eklendi",{n:r.eklenen})+(r.fazla?" "+t("kayit.yedek.fazla",{n:r.fazla,s:KAYIT_AYAR.enFazla}):"");
    };rd.readAsText(f);
  };
  r2.appendChild(ex);r2.appendChild(im);r2.appendChild(fi);yd.appendChild(r2);yd.appendChild(ym);box.appendChild(yd);
  document.body.classList.add("mode-kayit");box.hidden=false;window.scrollTo(0,0);bk.focus();
}
function kayitSuzKaydet(){depoYaz("kayit_suz",{mode:KAYIT_SUZ.mode,sira:KAYIT_SUZ.sira})}
function kayitKapat(){document.body.classList.remove("mode-kayit");$("kayit").hidden=true;window.scrollTo(0,0)}
/* Liste satırı: ad, tür, tarih, özet; dokununca işlemler */
function kayitSatir(k){
  var b=el("button","kitem kkayit");b.type="button";b.setAttribute("data-k",k.id);
  b.appendChild(el("span","kin",k.name));
  var m=el("span","kis");var tc=el("span","chip turr",t(KAYIT_TUR[k.mode]));tc.setAttribute("data-tur",k.mode);m.appendChild(tc);m.appendChild(document.createTextNode(" "+kayitTarih(k.u||k.t)));b.appendChild(m);
  var oz=el("span","koz");
  if(k.oz){
    if(k.oz.u){oz.appendChild(cmpIcon(3));oz.appendChild(document.createTextNode(t("kars.say.uyari",{n:k.oz.u})+"  "))}
    if(k.oz.d){oz.appendChild(cmpIcon(2));oz.appendChild(document.createTextNode(t("kars.say.dikkat",{n:k.oz.d})))}
    if(!k.oz.u&&!k.oz.d){oz.appendChild(cmpIcon(0));oz.appendChild(document.createTextNode(t("risk.yok")))}
  }
  b.appendChild(oz);
  if(k.note)b.appendChild(el("span","kis",k.note));
  b.onclick=function(){kayitIslem(k,b)};
  return b;
}
function kayitIslem(k,ret){
  var body=el("div","kpick");
  if(k.oz&&k.oz.top.length)body.appendChild(el("div","ln",t("kayit.islem.en_riskli",{l:k.oz.top.join(", ")})));
  function btn(txt,cls,fn){var b=el("button",cls,txt);b.type="button";b.onclick=fn;body.appendChild(b);return b}
  btn(t("kayit.islem.ac"),null,function(){closeSheet();kayitSonuc(k)});
  // Paylaş (14.10.2026, kullanıcı isteği): kayıt sonuç ekranında açılır, ardından paylaşım kartı (aynı payOpen)
  if(typeof PAYLAS_AYAR!=="undefined"&&PAYLAS_AYAR.acik)btn(t("pay.dugme"),"alt",function(){closeSheet();kayitSonuc(k,"paylas")});
  var ayni=kayitLoad().filter(function(x){return x.mode===k.mode&&x.id!==k.id});
  var kb=btn(t("kayit.islem.kars"),"alt",function(){closeSheet();kayitKarsSec(k,ret)});
  if(!ayni.length){kb.disabled=true;body.appendChild(el("div","how",t("kayit.islem.kars_az")))}
  btn(t("kayit.islem.duzenle"),"alt",function(){closeSheet();kayitSonuc(k,"duzenle")});
  btn(t("kayit.islem.sil"),"alt kclr",function(){
    if(!confirm(t("kayit.islem.sil_onay",{ad:k.name})))return;
    kayitStore(kayitLoad().filter(function(x){return x.id!==k.id}));closeSheet();
    // Satır listede görünüyorsa küçülüp kaybolur, alttakiler yukarı gelir, sonra liste yeniden çizilir (js/hareket.js)
    var sat=[].filter.call(document.querySelectorAll(".kkayit"),function(x){return x.getAttribute("data-k")===String(k.id)})[0];
    function yenile(){kayitProfil();kayitAc()}
    if(sat&&typeof hareketCik==="function")hareketCik(sat,yenile);else yenile();
  });
  openSheet(k.name,t(KAYIT_TUR[k.mode])+" · "+kayitTarih(k.u||k.t),body,ret);
}
/* Kaydı sonuç ekranında açar: tür seçilir, metin kutuya konur, analiz edilir (tarama geçmişine yazılmaz).
   sonra: "duzenle" (Kaydet düğmesi açılır) ya da "paylas" (paylaşım kartı açılır); sonuç bu kayıtla çizilince (PAY_SRC bu türde) basılır */
function kayitSonuc(k,sonra){
  kayitKapat();
  if(location.hash==="#profil"){history.replaceState(null,"",location.pathname+location.search);$("pd").open=false;tabSync()}
  if(CMP_IDS)closeCompare();
  KAYIT_ACILAN=k.id;$("metin").value=k.text;HSCAN=false;HMOD="gor";HGOR={mode:k.mode,text:(k.text||"").trim()};fotoTemizle();if(sonra)PAY_SRC=null;
  if(MODE!==k.mode)setMode(k.mode,true);else run();
  if(sonra){var sec=sonra==="paylas"?"#sonuc .resbar .pay:not(.kayitb)":"#sonuc .resbar .kayitb";
    var w=setInterval(function(){var b=PAY_SRC&&PAY_SRC.mode===k.mode&&document.querySelector(sec);if(b){clearInterval(w);b.click()}},100);setTimeout(function(){clearInterval(w)},8000)}
  var s=$("sonuc");if(s)s.scrollIntoView({block:"start"});
}
/* İki kayıtlı ürünü karşılaştırma: kayıtlar karşılaştırma ekranına geçmiş kaydı gibi verilir */
function kayitKarsSec(k,ret){
  var list=kayitList(kayitLoad(),k.mode,"","yeni").filter(function(x){return x.id!==k.id}),body=el("div","kpick");
  body.appendChild(el("h3",null,t("kayit.kars_ile",{ad:k.name})));
  list.forEach(function(x){
    var b=el("button","kitem");b.type="button";b.appendChild(el("span","kin",x.name));b.appendChild(el("span","kis",kayitTarih(x.u||x.t)));
    b.onclick=function(){closeSheet();kayitKarsAc(k,x)};body.appendChild(b);
  });
  openSheet(t("kars.dugme"),t(KAYIT_TUR[k.mode]),body,ret);
}
function kayitKarsAc(a,b){
  var hazir=karsReady(a.mode)?Promise.resolve():a.mode==="koz"?loadK():a.mode==="tem"?loadT():Promise.reject();
  hazir.then(function(){kayitKapat();if(location.hash==="#profil"){history.replaceState(null,"",location.pathname+location.search);$("pd").open=false;tabSync()}showCompare(a.id,b.id)},
    function(){alert(t("kayit.yuklenemedi_"+a.mode))});
}
// İlk çizim açılışta (js/arayuz_sayfa.js, dil yüklendikten sonra)
window.addEventListener("hashchange",kayitProfil);   // Profilim sekmesine her girişte sayı güncel
window.addEventListener("storage",function(e){if(e.key==="kayitli")kayitProfil()});   // başka sekmede kaydedilince
