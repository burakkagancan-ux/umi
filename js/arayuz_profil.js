/* Arayüz: Profilim (seçimler, kişisel bilgiler, BKİ, elle eklenen alerjenler, ayarlar, hakkında). Klasik betik; arayuz_ortak.js'ten sonra.
   Profil kartlarının kuralları saf mantıkta (js/profil_kart.js); burada yalnızca Profilim ekranı ve PROF. */
var PROF={al:[],alOzel:[],lactose:false,koku:false,astim:false,preg:false,emziriyorum:false,baby:false,child:false,vegan:false,veg:false,pku:false,pet:false,salt:false,cinsiyet:"",yas:null,boy:null,kilo:null};
(function(){var sp=depoJson("profil",null);if(sp&&sp.al)Object.keys(sp).forEach(function(k){PROF[k]=sp[k]})})();
/* Seçenek: [profil alanı, çeviri anahtarı] */
var LIFE=[["baby","profil.secenek.baby"],["child","profil.secenek.child"],["preg","profil.secenek.preg"],["emziriyorum","profil.secenek.emziriyorum"],["vegan","profil.secenek.vegan"],["veg","profil.secenek.veg"],["pet","profil.secenek.pet"]];
var OTHER=[["lactose","profil.secenek.lactose"],["koku","profil.secenek.koku"],["astim","profil.secenek.astim"],["salt","profil.secenek.salt"],["pku","profil.secenek.pku"]];
/* Profilim'in altındaki sorumluluk reddi beyanı (metin i18n dosyalarında profil.sorumluluk.1-4) */
var SORUMLULUK=["profil.sorumluluk.1","profil.sorumluluk.2","profil.sorumluluk.3","profil.sorumluluk.4"];
function saveProf(){depoYaz("profil",PROF)}
function buildProfile(){
  var box=$("profil");box.textContent="";
  if(!BDB){box.appendChild(el("div","mut",t("profil.bilesen_gerekli")));return}
  function degisti(){saveProf();updProfSum();[b1,b2,b3].forEach(function(b){if(b)b._upd()});if(LAST.length||$("metin").value.trim())run()}
  function cb(label,checked,on){var l=el("label","pc");var i=document.createElement("input");i.type="checkbox";i.checked=checked;i.onchange=function(){on(i.checked);degisti()};l.appendChild(i);l.appendChild(document.createTextNode(" "+label));return l}
  // Bölüm: başlık, isteğe bağlı kısa açıklama ve içerik kutusu (liste ya da kart)
  // Her bölümün kendi renkli simgesi (14.10.2026, kullanıcı isteği: profil daha renkli); renkler risk renklerinden ayrı
  var PBIC={uy:'<path d="M12 3l7 3v5c0 4.5-3 8.3-7 9.5C8 19.3 5 15.5 5 11V6z"/><path d="M9 12l2 2 4-4"/>',
    ki:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    ay:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    hk:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>'};
  function bolum(ad,not,cls,ik){var sc=el("section","pbol pb-"+ik),h=el("h2");h.innerHTML='<span class="pbic"><svg viewBox="0 0 24 24" aria-hidden="true">'+PBIC[ik]+'</svg></span>';h.appendChild(document.createTextNode(ad));sc.appendChild(h);if(not)sc.appendChild(el("p","mut",not));var k=el("div",cls);sc.appendChild(k);box.appendChild(sc);return k}
  // Açılır satır (kapalı başlar); başlıkta seçili sayısı görünür. n(): o satırdaki seçim sayısı
  function pdrop(ust,ad,n){var d=document.createElement("details");d.className="pdrop";var sm=el("summary","pt",ad),c=el("span","pcnt");sm.appendChild(c);d.appendChild(sm);ust.appendChild(d);
    d._upd=function(){var k=n();c.textContent=k?t("profil.secili",{n:k}):""};d._upd();return d}
  function abc(a){return a.map(function(x){return [x[0],t(x[1])]}).sort(function(x,y){return dilKarsilastir(x[1],y[1])})}
  var uy=bolum(t("profil.uyarilar"),t("profil.uyarilar_not"),"plist","uy"),
      kb=bolum(t("profil.kisisel"),t("profil.kilo_notu"),"pkart","ki"),
      ay=bolum(t("profil.ayarlar"),null,"plist pset","ay"),
      hk=bolum(t("profil.hakkinda"),null,"plist","hk");
  // Sizin için uyarılar: Alerjenler, Yaşam Evresi, Diğer (seçimler düğme gibi görünen onay kutuları)
  var b1=null,b2=null,b3=null;
  b1=pdrop(uy,t("profil.alerjenler"),function(){return PROF.al.length+PROF.alOzel.length});var g=el("div","pg");
  alAbc(BDB.meta.allergens).forEach(function(a){g.appendChild(cb(a[1],PROF.al.indexOf(a[0])>-1,function(v){PROF.al=PROF.al.filter(function(x){return x!==a[0]});if(v)PROF.al.push(a[0])}))});
  b1.appendChild(g);
  b1.appendChild(ozelAlerjenKutusu(degisti));
  b2=pdrop(uy,t("profil.yasam"),function(){return LIFE.filter(function(x){return PROF[x[0]]}).length});var g2=el("div","pg");
  abc(LIFE).forEach(function(x){g2.appendChild(cb(x[1],!!PROF[x[0]],function(v){PROF[x[0]]=v}))});
  b2.appendChild(g2);
  b3=pdrop(uy,t("profil.diger"),function(){return OTHER.filter(function(x){return PROF[x[0]]}).length});var g3=el("div","pg");
  abc(OTHER).forEach(function(x){g3.appendChild(cb(x[1],!!PROF[x[0]],function(v){PROF[x[0]]=v}))});
  b3.appendChild(g3);
  // Kişisel bilgiler: cinsiyet, yaş, boy, kilo (2×2) ve BKİ
  var g0=el("div","pg pnum");
  var cl=el("label","pn");cl.appendChild(el("span",null,t("profil.cinsiyet")));var cs=document.createElement("select");
  [["","profil.secin"],["kadin","profil.kadin"],["erkek","profil.erkek"]].forEach(function(o){var op=document.createElement("option");op.value=o[0];op.textContent=t(o[1]);if(PROF.cinsiyet===o[0])op.selected=true;cs.appendChild(op)});
  cs.onchange=function(){PROF.cinsiyet=cs.value;saveProf();updProfSum()};cl.appendChild(cs);g0.appendChild(cl);
  [["yas","profil.yas","profil.yil",0,120],["boy","profil.boy","birim.cm",80,220],["kilo","profil.kilo","birim.kg",2,300]].forEach(function(f){
    var l=el("label","pn");l.appendChild(el("span",null,t(f[1])));var i=document.createElement("input");i.type="text";i.inputMode="decimal";i.autocomplete="off";
    if(PROF[f[0]]!=null)i.value=dilSayi(PROF[f[0]],6);
    i.onchange=function(){var v=parseFloat(String(i.value).replace(",","."));if(isNaN(v)||v<f[3]||v>f[4]){PROF[f[0]]=null;i.value=""}else{PROF[f[0]]=f[0]==="yas"?Math.floor(v):v;i.value=dilSayi(PROF[f[0]],6)}saveProf();updProfSum();updBmi();if(LAST.length||$("metin").value.trim())run()};
    l.appendChild(i);l.appendChild(el("span","mut",t(f[2])));g0.appendChild(l)});
  kb.appendChild(g0);
  var bmiRow=el("div","bmi");kb.appendChild(bmiRow);
  function updBmi(){
    bmiRow.textContent="";
    var lab=el("span",null,t("profil.bki.etiket"));bmiRow.appendChild(lab);
    if(PROF.boy&&PROF.kilo){
      var v=PROF.kilo/Math.pow(PROF.boy/100,2),d=bkiDilim(v),c=[d.renk,t("profil.bki."+d.k)];
      var dot=el("span","bmidot");dot.style.background=c[0];bmiRow.appendChild(dot);
      var val=el("b",null,sayi(Math.round(v*10)/10)+" · "+c[1]);val.style.color=c[0];bmiRow.appendChild(val);
    }else bmiRow.appendChild(el("span","mut",t("profil.bki.girin")));
    var bb=el("button","info sm","i");bb.type="button";bb.setAttribute("aria-label",t("profil.bki.nedir"));
    bb.onclick=function(){bkiSayfa(bb)};
    bmiRow.appendChild(bb);
  }
  updBmi();
  // Ayarlar: dil, ülke, barkodlu ürün katkısı (satırda ad solda, seçim sağda)
  // Dil: seçim localStorage "dil"de; sayfa o dilde yeniden yüklenir (i18n/diller.json'daki her dil kendi adıyla)
  var dl=el("label","pn"),ds=document.createElement("select");ds.id="dilsec";ds.setAttribute("aria-label",t("profil.dil"));
  Object.keys(DIL.bilgi).forEach(function(k){var op=document.createElement("option");op.value=k;op.textContent=DIL.bilgi[k].ad;op.lang=k;if(k===DIL.kod)op.selected=true;ds.appendChild(op)});
  ds.onchange=function(){depoYazMetin("dil",ds.value);location.reload()};
  dl.appendChild(el("span",null,t("profil.dil")));dl.appendChild(ds);ay.appendChild(dl);
  // Ülke: seçim localStorage "ulke"de ("" = seçilmedi); ülkeye özgü kartlar ve notlar buna göre gösterilir
  var ul=el("label","pn"),us=document.createElement("select");us.id="ulkesec";us.setAttribute("aria-label",t("profil.ulke"));
  [""].concat(ULKELER.slice().sort(function(a,b){return t("ulke.ad."+a.toLowerCase()).localeCompare(t("ulke.ad."+b.toLowerCase()),DIL.kod)})).forEach(function(k){var op=document.createElement("option");op.value=k;op.textContent=t(k?"ulke.ad."+k.toLowerCase():"ulke.secilmedi");if(k===ulke())op.selected=true;us.appendChild(op)});
  us.onchange=function(){depoYazMetin("ulke",us.value);ulkeIsaretle(ulke());if(LAST.length||$("metin").value.trim())run()};
  ul.appendChild(el("span",null,t("profil.ulke")));ul.appendChild(us);ay.appendChild(ul);
  if(typeof barkodAyarKutusu==="function")ay.appendChild(barkodAyarKutusu());   // barkodlu ürün katkısı tercihi
  ay.parentNode.appendChild(el("div","how",t("profil.dil_not")+" "+t("profil.ulke_not")));
  // Hakkında: sorumluluk reddi ve gizlilik (15.10.2026'dan beri yalnızca burada; Etiket Oku altbilgisinden kaldırıldı)
  var sr=document.createElement("details");sr.className="pdrop sorumlu";sr.appendChild(el("summary","pt",t("profil.sorumluluk_baslik")));
  SORUMLULUK.forEach(function(k){sr.appendChild(el("p",null,t(k)))});hk.appendChild(sr);
  var gk=document.createElement("details");gk.className="pdrop gzp";gk.appendChild(el("summary","pt",t("gizlilik.baslik")));
  var gl=document.createElement("ul");["gizlilik.1","gizlilik.2","gizlilik.3","gizlilik.4","gizlilik.5"].forEach(function(k){gl.appendChild(el("li",null,t(k)))});gk.appendChild(gl);hk.appendChild(gk);
  box.appendChild(el("p","mut pcihaz",t("profil.cihazda")));
  updProfSum();
}
/* BKİ dilimleri (WHO): üst sınır (dahil değil) ve renk; Profilim satırı ve bilgi sayfası aynı listeyi kullanır */
var BKI=[{k:"zayif",ust:18.5,renk:"#3B7DD8"},{k:"normal",ust:25,renk:"#2E8B57"},{k:"fazla",ust:30,renk:"#D98E04"},{k:"obez",ust:Infinity,renk:"#C2410C"}];
function bkiDilim(v){for(var i=0;i<BKI.length;i++)if(v<BKI[i].ust)return BKI[i];return BKI[BKI.length-1]}
/* BKİ bilgi sayfası (14.10.2026, kullanıcı isteği: düz uyarı kutusu karışık görünüyordu): formül kutusu, girilmişse kişinin değeri,
   renkli dilim satırları (kişinin dilimi vurgulu), not ve kaynak */
function bkiSayfa(ret){
  var b=el("div","bkis"),v=PROF.boy&&PROF.kilo?PROF.kilo/Math.pow(PROF.boy/100,2):null,dv=v!=null?bkiDilim(v):null;
  b.appendChild(el("div","bkif",t("profil.bki.formul")));
  if(dv){var sz=el("div","bkiv");sz.style.setProperty("--c",dv.renk);sz.appendChild(el("span",null,t("profil.bki.siz")));
    sz.appendChild(el("b",null,sayi(Math.round(v*10)/10)+" · "+t("profil.bki."+dv.k)));b.appendChild(sz)}
  var ls=el("div","bkil");
  BKI.forEach(function(d){var r=el("div","bkir"+(d===dv?" on":""));r.style.setProperty("--c",d.renk);
    r.appendChild(el("span","bkid"));r.appendChild(el("b",null,t("profil.bki."+d.k)));r.appendChild(el("span","bkia",t("profil.bki.aralik."+d.k)));
    if(d===dv)r.appendChild(el("span","bkit",t("profil.bki.siz_kisa")));ls.appendChild(r)});
  b.appendChild(ls);
  b.appendChild(el("p","bkin",t("profil.bki.not")));
  b.appendChild(el("p","mut",t("profil.bki.kaynak")));
  openSheet(t("profil.bki.baslik"),null,b,ret);
}
/* Listede olmayan alerjen: kullanıcı adını yazar, eklediklerini görür ve siler (PROF.alOzel; etiket metninde ozelAraHepsi ile aranır).
   Etikette yazılan ad seçili dilde gösterilir (ozelGoster); sözlükte olmayan adlar yazıldığı gibi kalır ve altta ayrıca belirtilir. */
var OZEL_EN_COK=30;
function ozelAlerjenKutusu(degisti){
  var k=el("div","pozel");k.appendChild(el("div","pt",t("profil.ozel.baslik")));
  var f=document.createElement("form"),i=document.createElement("input"),b=el("button",null,t("profil.ozel.ekle")),ls=el("div","pozl"),uy=el("p","mut"),sz=el("p","mut pozsz");
  i.type="text";i.maxLength=40;i.autocomplete="off";i.placeholder=t("profil.ozel.yer");i.setAttribute("aria-label",t("profil.ozel.baslik"));b.type="submit";
  f.appendChild(i);f.appendChild(b);k.appendChild(f);k.appendChild(uy);k.appendChild(ls);k.appendChild(sz);k.appendChild(el("p","mut",t("profil.ozel.not")));
  function ciz(){
    ls.textContent="";
    PROF.alOzel.forEach(function(ad){
      var g=ozelGoster(ad,DIL.kod),c=el("span","chip pozc",g),x=el("button","pozsil","×");x.type="button";x.setAttribute("aria-label",t("profil.ozel.sil",{ad:g}));
      x.onclick=function(){PROF.alOzel=PROF.alOzel.filter(function(y){return y!==ad});ciz();degisti()};
      c.appendChild(x);ls.appendChild(c)});
    var yok=PROF.alOzel.filter(function(ad){return !ozelKayit(ad)});sz.textContent=yok.length?t("profil.ozel.sozluksuz",{l:yok.join(", ")}):"";
    var dolu=PROF.alOzel.length>=OZEL_EN_COK;i.disabled=b.disabled=dolu;uy.textContent=dolu?t("profil.ozel.cok",{n:OZEL_EN_COK}):"";
  }
  f.onsubmit=function(e){
    e.preventDefault();var ad=i.value.replace(/\s+/g," ").trim();i.value="";if(!ad)return;
    if(norm(ad).replace(/ /g,"").length<2){uy.textContent=t("profil.ozel.kisa");return}
    if(PROF.alOzel.some(function(y){return ozelAyni(y,ad)})){uy.textContent=t("profil.ozel.var",{ad:ozelGoster(ad,DIL.kod)});return}
    if(PROF.alOzel.length>=OZEL_EN_COK)return;
    PROF.alOzel.push(ad);ciz();degisti();i.focus();
  };
  ciz();return k;
}
/* Alerjen adları veriden (bilesenler.json meta.allergens; çevirisi i18n/veri "alerjen.<kimlik>"); sıralama dilin alfabesine göre */
function alAbc(a){return a.map(function(x){return [x[0],veriS(x[1],"alerjen."+x[0])]}).sort(function(x,y){return dilKarsilastir(x[1],y[1])})}
function alName(f){var a=(BDB&&BDB.meta.allergens)||[];for(var i=0;i<a.length;i++)if(a[i][0]===f)return veriS(a[i][1],"alerjen."+f);return f}
function updProfSum(){
  var n=(PROF.cinsiyet?1:0)+(PROF.kilo!=null?1:0)+(PROF.yas!=null?1:0)+(PROF.boy!=null?1:0)+PROF.al.length+PROF.alOzel.length+LIFE.filter(function(x){return PROF[x[0]]}).length+OTHER.filter(function(x){return PROF[x[0]]}).length;
  $("profsum").textContent=n?t("profil.ozet_secim",{n:n}):t("profil.baslik");
}

