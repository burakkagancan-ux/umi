/* Liste sayfası (index.html): Tarım ve Orman Bakanlığı taklit/tağşiş listesi. Türkiye'ye özgü (metinler ulke.tr.liste.*).
   Bakanlık verisi değiştirilmez. Firma, marka, ürün ve yer adları çevrilmez; ürün grubu ve uygunsuzluk türü adları ekranda
   i18n/veri/<dil>.json "liste:<Türkçe ad>" ile çevrilir (kaynak/ceviri_en_liste.tsv), süzgeç değeri Türkçe kalır.
   RAW: sayfadaki küçük önizleme verisi (index.html); güncel liste data/tagsis.json + data/arsiv.json. Açılış DIL_HAZIR çözülünce. */
function clean(s){return String(s||"").replace(/\s+/g," ").trim()}
function fold(s){return s.toLocaleLowerCase("tr").replace(/ı/g,"i").normalize("NFD").replace(/[̀-ͯ]/g,"")}
function dash(s){s=clean(s);return s==="-"?"":s}
function build(raw){return raw.map(function(r){
  var ms=parseInt(String(r.DuyuruTarihi).replace(/\D/g,""),10);
  var tur=String(r.Uygunsuzluk||"").split(/<\/br>/i).map(function(x){return clean(x).replace(/[,\s]+$/,"")}).filter(function(x){return !/^[-–—\s]*$/.test(x)});
  var o={tarih:new Date(ms),firma:clean(r.FirmaAdi),marka:dash(r.Marka),urun:clean(r.UrunAdi),tur:tur,parti:dash(r.PartiSeriNo),il:dash(r.FirmaIl),ilce:dash(r.FirmaIlce),grup:clean(r.UrunGrupAdi),liste:String(r._liste||"304"),cikti:r._cikti?new Date(r._cikti+"T12:00:00Z"):null};
  o.hay=fold([o.firma,o.marka,o.urun].join(" "));return o;
}).sort(function(a,b){return b.tarih-a.tarih})}
var DATA=build(RAW),IMPORTED=false;
depoSil("tagsis_raw");   // eski "Veriyi güncelle" ile kaydedilmiş veri artık kullanılmaz
function el(tag,c,x){var e=document.createElement(tag);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
/* Ürün grubu ve uygunsuzluk türü: seçili dildeki ad; çevirisi yoksa Türkçe (lang="tr") */
function grupAd(v){return veriMetin(v,"liste:"+v)}
function adEl(tag,c,v){var r=grupAd(v),e=el(tag,c,r.s);if(r.kod!==DIL.kod)e.lang=r.kod;return e}
/* Seçenek değeri Bakanlık verisindeki Türkçe ad; görünen ad çevrilmişse sıralama seçili dilde, değilse Türkçe alfabeye göre */
function fill(sel,vals,cevir){Array.from(new Set(vals)).filter(Boolean).map(function(v){return [v,cevir?grupAd(v).s:v]}).sort(function(a,b){return cevir?dilKarsilastir(a[1],b[1]):a[1].localeCompare(b[1],"tr")}).forEach(function(v){var o=el("option",null,v[1]);o.value=v[0];sel.appendChild(o)})}
var $q=document.getElementById("q"),$il=document.getElementById("il"),$tur=document.getElementById("tur"),$list=document.getElementById("list"),$count=document.getElementById("count");
var SON=0,KONTROL=0;
var LST="",$ilce=document.getElementById("ilce"),$srt=document.getElementById("srt"),$chips=document.getElementById("chips"),$grup=document.getElementById("grup"),$note=document.getElementById("note");
function listeAd(ls){return {saglik:t("ulke.tr.liste.ln.saglik"),"304":t("ulke.tr.liste.ln.304"),"305":t("ulke.tr.liste.ln.305")}[ls]||t("ulke.tr.liste.diger",{l:ls})}
function cmp(){return $srt.value==="tarih"?function(a,b){return b.tarih-a.tarih}:function(a,b){return a.firma.localeCompare(b.firma,"tr")||b.tarih-a.tarih}}
function ilceOpts(){
  $ilce.textContent="";var o=el("option",null,$il.value?t("ulke.tr.liste.tum_ilceler"):t("ulke.tr.liste.il_once"));o.value="";$ilce.appendChild(o);
  $ilce.value="";$ilce.disabled=!$il.value;
  if($il.value)fill($ilce,DATA.filter(function(d){return d.il===$il.value}).map(function(d){return d.ilce}).filter(Boolean));
}
function chips(){
  $chips.textContent="";
  var ks=[["",t("ulke.tr.liste.cip.tumu")],["saglik",t("ulke.tr.liste.cip.saglik")],["304",t("ulke.tr.liste.cip.304")],["305",t("ulke.tr.liste.cip.305")]];
  if(DATA.some(function(d){return d.cikti}))ks.push(["cikti",t("ulke.tr.liste.cip.cikti")]);
  ks.forEach(function(k){
    var n=k[0]?DATA.filter(function(d){return inList(d,k[0])}).length:DATA.length;
    var b=el("button","chip",t("ortak.baslik_sayi",{ad:k[1],n:n}));b.type="button";b.setAttribute("aria-pressed",String(LST===k[0]));
    b.addEventListener("click",function(){LST=k[0];chips();render()});
    $chips.appendChild(b);
  });
}
function inList(d,ls){return ls==="cikti"?!!d.cikti:d.liste===ls}
function opts(){
  [[$il,t("ulke.tr.liste.tum_iller")],[$grup,t("ulke.tr.liste.tum_gruplar")],[$tur,t("ulke.tr.liste.tum_turler")]].forEach(function(p){p[0].textContent="";var o=el("option",null,p[1]);o.value="";p[0].appendChild(o)});
  fill($il,DATA.map(function(d){return d.il}));
  fill($grup,DATA.map(function(d){return d.grup}),true);
  fill($tur,[].concat.apply([],DATA.map(function(d){return d.tur})),true);
  chips();ilceOpts();$note.style.display=IMPORTED?"none":"block";
  $note.textContent=t("ulke.tr.liste.onizleme",{n:DATA.length});
}
function dt(d){return dilTarih(+d,"gun")}
function render(){
  var q=fold($q.value.trim()),il=$il.value,tur=$tur.value,gr=$grup.value,ls=LST,ic=$ilce.value;
  var rows=DATA.filter(function(d){return (!q||d.hay.indexOf(q)>-1)&&(!il||d.il===il)&&(!gr||d.grup===gr)&&(!ls||inList(d,ls))&&(!ic||d.ilce===ic)&&(!tur||d.tur.indexOf(tur)>-1)});
  rows.sort(cmp());$count.textContent="";
  $count.appendChild(el("div","cnt",t("ulke.tr.liste.sayac",{n:rows.length})));
  var nb=function(s){return s.replace(/ /g," ")};   // tarih satır sonunda bölünmesin
  var ds=[KONTROL&&t("ulke.tr.liste.son_kontrol",{l:nb(dt(KONTROL))}),SON&&t("ulke.tr.liste.son_guncelleme",{l:nb(dt(SON))})].filter(Boolean).join(" · ");
  if(ds)$count.appendChild(el("div",null,ds));
  $list.textContent="";
  if(!rows.length){$list.appendChild(el("div","empty",t("ulke.tr.liste.sonuc_yok")));return}
  rows.forEach(function(d){
    var b=el("button","rec"+(d.cikti?" out":""));b.type="button";b.setAttribute("aria-expanded","false");if(d.liste==="saglik")b.style.borderLeftWidth="10px";
    if(d.cikti)b.appendChild(el("span","outtag",t("ulke.tr.liste.cikti",{l:dt(d.cikti)})));
    b.appendChild(el("div","brand",d.marka||d.firma));
    b.appendChild(el("div","prod",d.urun));
    var tg=el("div","tags");d.tur.forEach(function(x){tg.appendChild(adEl("span","tag",x))});b.appendChild(tg);
    b.appendChild(el("div","meta",t("ulke.tr.liste.meta",{yer:[d.ilce,d.il].filter(Boolean).join(", ")||t("ulke.tr.liste.yer_yok"),l:dt(d.tarih)})));
    var dl=el("dl","det");
    [[t("ulke.tr.liste.det.liste"),listeAd(d.liste)],[t("ulke.tr.liste.det.firma"),d.firma],[t("ulke.tr.liste.det.grup"),d.grup,true],[t("ulke.tr.liste.det.parti"),d.parti||t("ulke.tr.liste.belirtilmemis")]].concat(d.cikti?[[t("ulke.tr.liste.det.durum"),t("ulke.tr.liste.durum_cikti",{l:dt(d.cikti)})]]:[]).forEach(function(p){dl.appendChild(el("dt",null,p[0]));dl.appendChild(p[2]?adEl("dd",null,p[1]):el("dd",null,p[1]))});
    var s=el("div","src",t("ulke.tr.liste.kaynak"));
    var a=el("a",null,t("ulke.tr.liste.resmi_sayfa"));a.href="https://guvenilirgida.tarimorman.gov.tr/gkd";a.target="_blank";a.rel="noopener";
    a.addEventListener("click",function(e){e.stopPropagation()});s.appendChild(a);dl.appendChild(s);b.appendChild(dl);
    b.addEventListener("click",function(){b.setAttribute("aria-expanded",b.getAttribute("aria-expanded")==="true"?"false":"true")});
    $list.appendChild(b);
  });
}
function getJ(p){return fetch(p,{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json()})}
DIL_HAZIR.then(function(){
  $il.addEventListener("input",ilceOpts);[$q,$il,$grup,$tur,$ilce,$srt].forEach(function(e){e.addEventListener("input",render)});
  try{var QP=new URLSearchParams(location.search).get("q");if(QP)$q.value=QP}catch(e){}
  opts();render();
  // Güncel liste + arşiv (listeden çıkan kayıtlar). Arşiv yoksa yalnızca güncel liste gösterilir.
  Promise.all([getJ("data/tagsis.json"),getJ("data/arsiv.json").catch(function(){return null})]).then(function(res){
    var j=res[0],ar=res[1];
    var arr=[];Object.keys(j.listeler).forEach(function(k){j.listeler[k].forEach(function(x){x._liste=k;arr.push(x)})});
    if(!arr.length)return;
    if(ar&&ar.kayitlar)ar.kayitlar.forEach(function(a){var x=Object.assign({},a.kayit);x._liste=a.liste;x._cikti=a.kaldirilma;arr.push(x)});
    DATA=build(arr);IMPORTED=true;
    if(j.guncelleme)SON=+new Date(j.guncelleme);
    opts();render();
  }).catch(function(){});
  // Son kontrol zamanı: liste değişmese de günlük güncelleme her çalıştığında yenilenir
  getJ("data/durum.json").then(function(d){if(d.son_kontrol){KONTROL=+new Date(d.son_kontrol);render()}}).catch(function(){});
});
try{if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(function(){})}catch(e){}
