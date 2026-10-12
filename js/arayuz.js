/* Arayüz: ortak yardımcılar, veri yükleme, Hassasiyetlerim, gıda sonuç ekranı, mod anahtarı. */
var OCR_URL="https://inapp-ocr-3a8f.burakkagancan.workers.dev";   // Cloudflare Worker adresi; boşsa telefonda Tesseract kullanılır
var DB=null,BDB=null,ABOUT={},IDX=null,FLAGS={},BRANDS=null,ST=document.getElementById("st"),LAST=[],LASTSUM=null,LASTBR=[];
var CLS=["g","u","y","r"],LBL_K=["risk.yok","risk.dogrulanmadi","risk.dikkat","risk.uyari"];
function LBL(i){return t(LBL_K[i])}
function $(i){return document.getElementById(i)}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
/* Veri metni öğesi: seçili dilde çevirisi yoksa metin kendi dilinde (lang) gösterilir, yanına küçük "henüz çevrilmedi" işareti eklenir (js/ceviri.js veriMetin) */
function vEl(tag,cls,tr,anahtar,resmi){var r=veriMetin(tr,anahtar,resmi);return vIsaret(el(tag,cls,r.s),r)}
function vIsaret(e,r){if(!r||!r.cevrilmedi)return e;e.lang=r.kod;var m=el("span","cvm",t("veri.cevrilmedi"));m.title=t("veri.cevrilmedi_aria");e.appendChild(document.createTextNode(" "));e.appendChild(m);return e}
function secBox(box,title,n){var d=el("details","sec");d.appendChild(el("summary",null,t("ortak.baslik_sayi",{ad:title,n:n})));box.appendChild(d);return d}   // varsayılan kapalı açılır bölüm
/* Durum satırı her mod için ayrı tutulur; mod değişince o modun mesajı gösterilir */
var STMSG={gida:"",koz:"",tem:""};
function setSt(mode,msg){STMSG[mode]=msg;if((typeof MODE==="undefined"||!MODE?"gida":MODE)===mode)ST.textContent=msg}
window.onerror=function(m,src,l){ST.textContent=t("ortak.sayfa_hatasi",{m:m,l:l});};

/* ---------- Veri yükleme ---------- */
var PATHS=["data/e_kodlari.json","e_kodlari.json"];
var COMBO=null;getJson("data/eslesmeler.json").then(function(j){COMBO=j.rules}).catch(function(){COMBO=null});
function getJson(p){return fetch(p,{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error(t("ortak.dosya_yok",{p:p}));return r.json()})}
function loadDb(i){
  if(i>=PATHS.length){var msg=t("gida.liste_yok");setSt("gida",msg);$("sonuc").textContent=msg;return}
  getJson(PATHS[i]).then(function(j){
    DB=j;FLAGS=(j.meta&&j.meta.flags)||{};
    return getJson("data/bilesenler.json").then(function(b){BDB=b},function(){BDB=null});
  }).then(function(){
    IDX=buildIndex(DB,BDB);
    setSt("gida",BDB?t("gida.yuklendi",{n:DB.ingredients.length,b:BDB.items.length}):t("gida.yuklendi_bilesensiz",{n:DB.ingredients.length}));
    buildProfile();
  }).catch(function(){if(!DB)loadDb(i+1)});
}

/* ---------- Profil ---------- */
var PROF={al:[],lactose:false,koku:false,astim:false,preg:false,emziriyorum:false,baby:false,child:false,vegan:false,veg:false,pku:false,pet:false,salt:false,cinsiyet:"",yas:null,boy:null,kilo:null};
try{var sp=JSON.parse(localStorage.getItem("profil")||"null");if(sp&&sp.al)Object.keys(sp).forEach(function(k){PROF[k]=sp[k]})}catch(e){}
/* Seçenek: [profil alanı, çeviri anahtarı] */
var LIFE=[["baby","profil.secenek.baby"],["child","profil.secenek.child"],["preg","profil.secenek.preg"],["emziriyorum","profil.secenek.emziriyorum"],["vegan","profil.secenek.vegan"],["veg","profil.secenek.veg"],["pet","profil.secenek.pet"]];
var OTHER=[["lactose","profil.secenek.lactose"],["koku","profil.secenek.koku"],["astim","profil.secenek.astim"],["salt","profil.secenek.salt"],["pku","profil.secenek.pku"]];
/* Hassasiyetlerim'in altındaki sorumluluk reddi beyanı (metin i18n dosyalarında profil.sorumluluk.1-4) */
var SORUMLULUK=["profil.sorumluluk.1","profil.sorumluluk.2","profil.sorumluluk.3","profil.sorumluluk.4"];
function saveProf(){try{localStorage.setItem("profil",JSON.stringify(PROF))}catch(e){}}
function buildProfile(){
  var box=$("profil");box.textContent="";
  if(!BDB){box.appendChild(el("div","mut",t("profil.bilesen_gerekli")));return}
  function cb(label,checked,on){var l=el("label","pc");var i=document.createElement("input");i.type="checkbox";i.checked=checked;i.onchange=function(){on(i.checked);saveProf();updProfSum();[b1,b2,b3].forEach(function(b){if(b)b._upd()});if(LAST.length||$("metin").value.trim())run()};l.appendChild(i);l.appendChild(document.createTextNode(" "+label));return l}
  function pbox(ad){var d=el("div","pbox");d.appendChild(el("div","pt",ad));box.appendChild(d);return d}
  // Açılır kutu (kapalı başlar); başlıkta seçili sayısı görünür. n(): o kutudaki seçim sayısı
  function pdrop(ad,n){var d=document.createElement("details");d.className="pbox pdrop";var sm=el("summary","pt",ad),c=el("span","pcnt");sm.appendChild(c);d.appendChild(sm);box.appendChild(d);
    d._upd=function(){var k=n();c.textContent=k?t("profil.secili",{n:k}):""};d._upd();return d}
  function abc(a){return a.map(function(x){return [x[0],t(x[1])]}).sort(function(x,y){return dilKarsilastir(x[1],y[1])})}
  // Dil: seçim localStorage "dil"de; sayfa o dilde yeniden yüklenir (i18n/diller.json'daki her dil kendi adıyla)
  var bd=pbox(t("profil.dil")),dl=el("label","pn"),ds=document.createElement("select");ds.id="dilsec";ds.setAttribute("aria-label",t("profil.dil"));
  Object.keys(DIL.bilgi).forEach(function(k){var op=document.createElement("option");op.value=k;op.textContent=DIL.bilgi[k].ad;op.lang=k;if(k===DIL.kod)op.selected=true;ds.appendChild(op)});
  ds.onchange=function(){try{localStorage.setItem("dil",ds.value)}catch(e){}location.reload()};
  dl.appendChild(ds);bd.appendChild(dl);bd.appendChild(el("div","mut",t("profil.dil_not")));
  // Ülke: seçim localStorage "ulke"de ("" = seçilmedi); ülkeye özgü kartlar ve notlar buna göre gösterilir
  var ul=el("label","pn"),us=document.createElement("select");us.id="ulkesec";us.setAttribute("aria-label",t("profil.ulke"));
  [""].concat(ULKELER).forEach(function(k){var op=document.createElement("option");op.value=k;op.textContent=t(k?"ulke.ad."+k.toLowerCase():"ulke.secilmedi");if(k===ulke())op.selected=true;us.appendChild(op)});
  us.onchange=function(){try{localStorage.setItem("ulke",us.value)}catch(e){}if(LAST.length||$("metin").value.trim())run()};
  ul.appendChild(el("span",null,t("profil.ulke")));ul.appendChild(us);bd.appendChild(ul);bd.appendChild(el("div","mut",t("profil.ulke_not")));
  var b0=pbox(t("profil.kisisel")),g0=el("div","pg pnum");
  var cl=el("label","pn");cl.appendChild(el("span",null,t("profil.cinsiyet")));var cs=document.createElement("select");
  [["","profil.secin"],["kadin","profil.kadin"],["erkek","profil.erkek"]].forEach(function(o){var op=document.createElement("option");op.value=o[0];op.textContent=t(o[1]);if(PROF.cinsiyet===o[0])op.selected=true;cs.appendChild(op)});
  cs.onchange=function(){PROF.cinsiyet=cs.value;saveProf();updProfSum()};cl.appendChild(cs);g0.appendChild(cl);
  [["yas","profil.yas","profil.yil",0,120],["boy","profil.boy","birim.cm",80,220],["kilo","profil.kilo","birim.kg",2,300]].forEach(function(f){
    var l=el("label","pn");l.appendChild(el("span",null,t(f[1])));var i=document.createElement("input");i.type="text";i.inputMode="decimal";i.autocomplete="off";
    if(PROF[f[0]]!=null)i.value=dilSayi(PROF[f[0]],6);
    i.onchange=function(){var v=parseFloat(String(i.value).replace(",","."));if(isNaN(v)||v<f[3]||v>f[4]){PROF[f[0]]=null;i.value=""}else{PROF[f[0]]=f[0]==="yas"?Math.floor(v):v;i.value=dilSayi(PROF[f[0]],6)}saveProf();updProfSum();updBmi();if(LAST.length||$("metin").value.trim())run()};
    l.appendChild(i);l.appendChild(el("span","mut",t(f[2])));g0.appendChild(l)});
  b0.appendChild(g0);
  var bmiRow=el("div","bmi");b0.appendChild(bmiRow);
  function updBmi(){
    bmiRow.textContent="";
    var lab=el("span",null,t("profil.bki.etiket"));bmiRow.appendChild(lab);
    if(PROF.boy&&PROF.kilo){
      var v=PROF.kilo/Math.pow(PROF.boy/100,2),c=v<18.5?["#3B7DD8",t("profil.bki.zayif")]:v<25?["#2E8B57",t("profil.bki.normal")]:v<30?["#D98E04",t("profil.bki.fazla")]:["#C2410C",t("profil.bki.obez")];
      var dot=el("span","bmidot");dot.style.background=c[0];bmiRow.appendChild(dot);
      var val=el("b",null,sayi(Math.round(v*10)/10)+" · "+c[1]);val.style.color=c[0];bmiRow.appendChild(val);
    }else bmiRow.appendChild(el("span","mut",t("profil.bki.girin")));
    var bb=el("button","info sm","i");bb.type="button";bb.setAttribute("aria-label",t("profil.bki.nedir"));
    bb.onclick=function(){alert(t("profil.bki.aciklama"))};
    bmiRow.appendChild(bb);
  }
  updBmi();
  b0.appendChild(el("div","mut",t("profil.kilo_notu")));
  var b1=null,b2=null,b3=null;
  b1=pdrop(t("profil.alerjenler"),function(){return PROF.al.length});var g=el("div","pg");
  alAbc(BDB.meta.allergens).forEach(function(a){g.appendChild(cb(a[1],PROF.al.indexOf(a[0])>-1,function(v){PROF.al=PROF.al.filter(function(x){return x!==a[0]});if(v)PROF.al.push(a[0])}))});
  b1.appendChild(g);
  b2=pdrop(t("profil.yasam"),function(){return LIFE.filter(function(x){return PROF[x[0]]}).length});var g2=el("div","pg");
  abc(LIFE).forEach(function(x){g2.appendChild(cb(x[1],!!PROF[x[0]],function(v){PROF[x[0]]=v}))});
  b2.appendChild(g2);
  b3=pdrop(t("profil.diger"),function(){return OTHER.filter(function(x){return PROF[x[0]]}).length});var g3=el("div","pg");
  abc(OTHER).forEach(function(x){g3.appendChild(cb(x[1],!!PROF[x[0]],function(v){PROF[x[0]]=v}))});
  b3.appendChild(g3);
  if(typeof barkodAyarKutusu==="function")box.appendChild(barkodAyarKutusu());   // barkodlu ürün katkısı tercihi
  box.appendChild(el("div","mut",t("profil.cihazda")));
  var sr=el("div","sorumlu");sr.appendChild(el("div","pt",t("profil.sorumluluk_baslik")));
  SORUMLULUK.forEach(function(k){sr.appendChild(el("p",null,t(k)))});box.appendChild(sr);
  updProfSum();
}
/* Alerjen adları veriden (bilesenler.json meta.allergens; çevirisi i18n/veri "alerjen.<kimlik>"); sıralama dilin alfabesine göre */
function alAbc(a){return a.map(function(x){return [x[0],veriS(x[1],"alerjen."+x[0])]}).sort(function(x,y){return dilKarsilastir(x[1],y[1])})}
function alName(f){var a=(BDB&&BDB.meta.allergens)||[];for(var i=0;i<a.length;i++)if(a[i][0]===f)return veriS(a[i][1],"alerjen."+f);return f}
function updProfSum(){
  var n=(PROF.cinsiyet?1:0)+(PROF.kilo!=null?1:0)+(PROF.yas!=null?1:0)+(PROF.boy!=null?1:0)+PROF.al.length+LIFE.filter(function(x){return PROF[x[0]]}).length+OTHER.filter(function(x){return PROF[x[0]]}).length;
  $("profsum").textContent=n?t("profil.ozet_secim",{n:n}):t("profil.baslik");
}

/* ---------- Sonuç ekranı ---------- */
function card(cls,title,lines){
  var d=el("div","res prof "+cls);d.appendChild(el("div","t",title));
  (lines||[]).forEach(function(l){if(l)d.appendChild(typeof l==="string"?el("div","ln",l):l)});
  return d;
}
function profileCards(S){
  var out=[],any=PROF.al.length||LIFE.some(function(x){return PROF[x[0]]})||OTHER.some(function(x){return PROF[x[0]]});
  if(!any)return out;
  if(PROF.al.length){
    var yes=[],may=[];
    PROF.al.forEach(function(f){var a=S.allergen[f];if(!a)return;if(a.yes.length)yes.push(alName(f)+": "+a.yes.join(", "));if(a.may.length)may.push(alName(f)+": "+a.may.join(", "))});
    if(yes.length)out.push(card("r",t("gida.prof.alerjen_var"),yes.concat(may.length?[t("gida.prof.ayrica_icerebilir",{l:may.join("; ")})]:[])));
    else if(may.length)out.push(card("y",t("gida.prof.alerjen_icerebilir"),may));
    else out.push(card("g",t("gida.prof.alerjen_yok"),[t("gida.prof.alerjen_yok_not")]));
  }
  if(PROF.lactose){
    var L=S.lactose;
    if(L.yes.length)out.push(card("r",t("gida.prof.laktoz_var"),[L.yes.join(", ")].concat(L.low.length?[t("gida.prof.laktoz_dusuk_l",{l:L.low.join(", ")})]:[])));
    else if(L.low.length||L.may.length)out.push(card("y",t("gida.prof.laktoz_belirsiz"),[L.low.length?t("gida.prof.laktoz_dusuk_l",{l:L.low.join(", ")}):"",L.may.length?t("gida.prof.laktoz_aroma",{l:L.may.join(", ")}):""]));
    else out.push(card("g",t("gida.prof.laktoz_yok"),[t("ortak.onay_degil_etiket")]));
  }
  if(PROF.vegan){
    var V=S.vegan;
    if(V.no.length)out.push(card("r",t("gida.prof.vegan_degil"),[V.no.join(", ")].concat(V.unsure.length?[t("gida.prof.kaynak_belirsiz",{l:V.unsure.join(", ")})]:[])));
    else if(V.unsure.length)out.push(card("y",t("gida.prof.vegan_belirsiz"),[t("gida.prof.vegan_belirsiz_l",{l:V.unsure.join(", ")})]));
    else out.push(card("g",t("gida.prof.hayvansal_yok"),[t("ortak.onay_degil_vegan")]));
  }
  if(PROF.veg){
    var G=S.veg;
    if(G.no.length||G.insect.length)out.push(card("r",t("gida.prof.vejetaryen_degil"),[G.no.length?G.no.join(", "):"",G.insect.length?t("gida.prof.bocek",{l:G.insect.join(", ")}):""].concat(G.unsure.length?[t("gida.prof.kaynak_belirsiz",{l:G.unsure.join(", ")})]:[])));
    else if(G.unsure.length)out.push(card("y",t("gida.prof.vejetaryen_belirsiz"),[t("gida.prof.kaynak_belirsiz",{l:G.unsure.join(", ")})]));
    else out.push(card("g",t("gida.prof.et_yok"),[t("ortak.onay_degil_etiket")]));
  }
  return out.concat(lifeCards(S.life,S.sodium));
}
/* Yaşam evresi, PKU ve evcil hayvan kartları. Satır: [seviye "r"/"y", metin]. Hiçbir zaman "uygun" denmez. */
function lifeCard(title,rows,okTitle,okNote,extra){
  rows=rows.filter(function(r){return r});
  if(!rows.length)return card("g",okTitle,[okNote]);
  var red=rows.some(function(r){return r[0]==="r"});
  return card(red?"r":"y",title,rows.map(function(r){return r[1]}).concat(extra?[extra]:[]));
}
function lifeCards(L,NA){
  var out=[],j=function(a){return a.join(", ")};
  var raw=L.raw.length?["r",t("gida.yasam.cig",{l:j(L.raw)})]:null;
  var alc=L.alcohol.length?["r",t("gida.yasam.alkol",{l:j(L.alcohol)})]:null;
  var trace=L.alcoholTrace.length?["y",t("gida.yasam.alkolsuz")]:null;
  var hyp=L.hyper.length?["y",t("gida.yasam.renk",{l:j(L.hyper)})]:null;
  if(PROF.preg)out.push(lifeCard(t("gida.yasam.hamile"),[alc,raw,
    L.caffeine.length?["y",t("gida.yasam.kafein_hamile",{l:j(L.caffeine)})]:null,trace],
    t("gida.yasam.hamile_yok"),t("gida.yasam.onay_doktor")));
  if(PROF.emziriyorum)out.push(lifeCard(t("gida.yasam.emzirme"),[alc,raw,trace],
    t("gida.yasam.emzirme_yok"),t("gida.yasam.onay_doktor")));
  if(PROF.baby)out.push(lifeCard(t("gida.yasam.bebek"),[
    L.honey.length?["r",t("gida.yasam.bal")]:null,alc,
    L.caffeine.length?["r",t("gida.yasam.kafein",{l:j(L.caffeine)})]:null,raw,
    L.sweet.length?["y",t("gida.yasam.tatlandirici_bebek",{l:j(L.sweet)})]:null,hyp,trace],
    t("gida.yasam.bebek_yok"),t("gida.yasam.bebek_onay")));
  if(PROF.child)out.push(lifeCard(t("gida.yasam.cocuk"),[alc,hyp,
    L.caffeine.length?["y",t("gida.yasam.kafein_cocuk",{l:j(L.caffeine)})]:null,
    L.sweet.length?["y",t("gida.yasam.tatlandirici",{l:j(L.sweet)})]:null,trace],
    t("gida.yasam.cocuk_yok"),t("ortak.onay_degil_etiket")));
  if(PROF.pku)out.push(lifeCard(t("gida.yasam.pku"),[L.phe.length?["r",t("gida.yasam.aspartam",{l:j(L.phe)})]:null],
    t("gida.yasam.aspartam_yok"),t("gida.yasam.pku_not")));
  if(PROF.pet)out.push(lifeCard(t("gida.yasam.pet"),[L.pet.length?["r",t("gida.yasam.pet_l",{l:j(L.pet)})]:null],
    t("gida.yasam.pet_yok"),t("gida.yasam.pet_onay"),
    t("gida.yasam.pet_ek")));
  if(PROF.salt&&NA)out.push(lifeCard(t("gida.yasam.tuz"),[
    NA.salt.length?["y",NA.saltOrd&&NA.saltOrd<=3?t("gida.yasam.tuz_sira",{n:NA.saltOrd}):t("gida.yasam.tuz_var")]:null,
    NA.hidden.length?["y",t("gida.yasam.sodyum_gizli",{l:j(NA.hidden)})]:null],
    t("gida.yasam.tuz_yok"),t("gida.yasam.tuz_onay"),
    t("gida.yasam.tuz_ek")));
  return out;
}
function summaryCard(S,res){
  var d=el("div","res sumbox");d.appendChild(el("div","t",t("ortak.ozet")));
  function row(label,val,cls){var r=el("div","srow");r.appendChild(el("span","sl",label));var v=el("span","sv"+(cls?" "+cls:""));if(typeof val==="string")v.textContent=val;else v.appendChild(val);r.appendChild(v);d.appendChild(r)}
  var E=res.filter(function(r){return !r.isB&&!r.neg}),cnt=[0,0,0,0];E.forEach(function(r){cnt[r.rank]++});
  row(t("gida.ozet.katki"),E.length?t(cnt[1]?"gida.ozet.katki_say_dog":"gida.ozet.katki_say",{n:E.length,u:cnt[3],d:cnt[2],v:cnt[1]}):t("ortak.bulunamadi"),cnt[3]?"r":cnt[2]?"y":"");
  if(S.sugar.length){
    var f=document.createDocumentFragment();
    f.appendChild(document.createTextNode(t("gida.ozet.kaynak_say",{n:S.sugar.length})));
    S.sugar.forEach(function(s,i){if(i)f.appendChild(document.createTextNode(", "));f.appendChild(document.createTextNode(s.name));if(s.hidden){f.appendChild(document.createTextNode(" "));f.appendChild(el("span","chip",t("gida.ozet.gizli")))}});
    row(t("gida.ozet.seker"),f,S.sugar.some(function(s){return s.hidden})?"y":"");
  }else row(t("gida.ozet.seker"),t("gida.ozet.kaynak_yok"));
  row(t("gida.ozet.palm"),S.palm.length?t("ortak.var_l",{l:S.palm.join(", ")}):t("ortak.bulunamadi"),S.palm.length?"y":"");
  var u=Object.keys(S.upf).map(function(k){return veriS(capFirst(k),null)});
  row(t("gida.ozet.upf"),u.length?t("gida.ozet.upf_say",{n:u.length,l:u.join(", ")}):t("gida.ozet.upf_yok"),u.length>=2?"y":"");
  var ay=[],am=[];Object.keys(S.allergen).forEach(function(f){var a=S.allergen[f];if(a.yes.length)ay.push(alName(f));else if(a.may.length)am.push(alName(f))});
  row(t("profil.alerjenler"),ay.length||am.length?((ay.length?t("ortak.icerir_l",{l:ay.join(", ")}):"")+(ay.length&&am.length?" · ":"")+(am.length?t("ortak.icerebilir_l",{l:am.join(", ")}):"")):t("ortak.bulunamadi"));
  var UO=uretimOzet(res,IDX),um=uretimMetin(UO);
  if(um)row(t("gida.ozet.uretim"),t("gida.ozet.uretim_l",{l:um}));
  if(S.claims.length)row(t("gida.ozet.beyan"),S.claims.join(", "));
  if(S.cancer.length)row(t("gida.ozet.kanser"),S.cancer.map(function(c){return typeof c==="string"?c:c.name}).join(", "),"r");
  if(u.length)d.appendChild(el("div","how upfnote",t("gida.ozet.upf_not")));
  return d;
}
function brandCard(br){
  var d=el("div","res u");d.appendChild(el("div","t",t("ulke.tr.marka.baslik")));
  br.forEach(function(b){
    var r=el("div","ln");r.appendChild(document.createTextNode(t("ulke.tr.marka.satir",{ad:b.label,n:b.n})));
    var a=el("a",null,t("ulke.tr.marka.gor"));a.href="index.html?q="+encodeURIComponent(b.q);r.appendChild(a);d.appendChild(r);
  });
  d.appendChild(el("div","how",t("ulke.tr.marka.not")));
  return d;
}
// Günlük kabul edilebilir alım (ADI) satırı; değer mg/kg vücut ağırlığı (per=hafta: haftalık)
function sayi(x){return dilSayi(Math.round(x*100)/100)}
function yuv(x){return x>=100?Math.round(x):x>=10?Math.round(x*10)/10:x}
function mgTxt(x){return x>=1000?t("birim.g_l",{n:sayi(yuv(x/1000))}):t("birim.mg_l",{n:sayi(yuv(x))})}
function adiBlock(a,pre){
  var w=a.per==="hafta",kg=PROF.kilo,box=el("div","adi"),row=el("div","adr"),m;
  var lb=t("gida.adi."+(w?"haftalik":"gunluk")+(a.st==="set"&&kg?"_kisi":""));
  if(a.st==="set")m=kg?t(a.as?"gida.adi.yaklasik_as":"gida.adi.yaklasik",{mg:mgTxt(a.v*kg),kg:sayi(kg),as:veriS(a.as,null)}):t(a.as?"gida.adi.kilo_basina_as":"gida.adi.kilo_basina",{n:sayi(a.v),as:veriS(a.as,null)});
  else m=a.st==="ns"?t("gida.adi.ns"):t("gida.adi.yok");
  var lx=el("div","ln");lx.appendChild(el("b",null,(pre?pre+" · ":"")+t("ortak.etiket_iki_nokta",{ad:lb})));lx.appendChild(document.createTextNode(m));row.appendChild(lx);
  var bt=el("button","info sm","i");bt.type="button";bt.setAttribute("aria-label",t("gida.adi.kaynagi",{ad:lb}));bt.setAttribute("aria-expanded","false");row.appendChild(bt);
  box.appendChild(row);
  var pn=el("div","ipanel");pn.hidden=true;
  var p=el("div","ln");
  if(a.st==="set")p.appendChild(document.createTextNode(t(a.as?"gida.adi.tanim_as":"gida.adi.tanim",{ad:t(w?"gida.adi.twi":"gida.adi.adi"),n:sayi(a.v),as:veriS(a.as,null),src:a.src})+(kg?t("gida.adi.hesap",{n:sayi(a.v),kg:sayi(kg),mg:mgTxt(a.v*kg)}):"")));
  else p.appendChild(document.createTextNode(a.st==="ns"?t("gida.adi.ns_src",{src:a.src}):a.src+"."));
  if(a.note){var rn=veriMetin(a.note,null);p.appendChild(document.createTextNode(" "+rn.s));vIsaret(p,rn)}
  pn.appendChild(p);
  var ps=el("div","how");
  if(a.url){ps.appendChild(document.createTextNode(t("ortak.kaynak")));var l=el("a",null,a.url.replace(/^https?:\/\/(www\.)?/,"").split("/")[0]);l.href=a.url;l.target="_blank";l.rel="noopener";ps.appendChild(l)}
  if(!a.ok)ps.appendChild(document.createTextNode((a.url?" · ":"")+t("gida.adi.dogrulanmadi")));
  if(ps.childNodes.length)pn.appendChild(ps);
  if(a.st==="set"){
    if(PROF.yas===0)pn.appendChild(el("div","how",t("gida.adi.bebek16")));
    pn.appendChild(el("div","how",t("gida.adi.aciklama")));
  }
  box.appendChild(pn);
  bt.onclick=function(){pn.hidden=!pn.hidden;bt.setAttribute("aria-expanded",pn.hidden?"false":"true");bt.classList.toggle("on",!pn.hidden)};
  return box;
}
function additiveCard(r){
  var items=r.ids.map(function(id){return IDX.byId[id]});
  var notr=r.rank===0&&!uretimDogal(r.ids,IDX);   // yeşil tik yalnızca "doğal" üretim yolunda; diğer uyarısız maddeler nötr (gri)
  var d=el("div","res "+CLS[r.rank]+(notr?" n":""));
  var it=items.slice().sort(function(a,b){return RANK[b.risk_level]-RANK[a.risk_level]})[0];
  var top=el("div","hd");
  var grp=items.every(function(i){return i.category===items[0].category})?veriS(items[0].category,null):t("gida.ozet.katki");
  top.appendChild(el("div","t",items.length===1?(items[0].id+" · "+itAd(items[0])):t("gida.kart.olasi_grup",{l:items.map(function(i){return i.id}).join(", "),grp:grp})));
  var b=el("button","info","i");b.type="button";b.setAttribute("aria-label",t("ortak.hakkinda",{ad:itAd(it)}));b.setAttribute("aria-expanded","false");
  top.appendChild(b);d.appendChild(top);
  d.appendChild(el("div","how",LBL(r.rank)+" · "+(r.how==="kod"?t(r.fixed?"gida.kart.kodla_duzeltildi":"gida.kart.kodla"):r.how==="isim"?t("ortak.isimle"):t("ortak.benzer",{l:r.text}))+(r.may?t("ortak.icerebilir_bolum"):"")));
  it.flags.forEach(function(f){if((f==="sodium"&&!PROF.salt)||f==="aluminium"||f==="gmo_suspect")return;/* sodyum etiketi yalnızca tuz kısıtlaması seçiliyse */d.appendChild(el("span","chip",veriS(FLAGS[f]||f,"e.bayrak."+f)))});
  var us=uretimSinif(r.ids,IDX);   // üretim yolu: gri bilgi etiketi, risk rengini değiştirmez
  if(us){var uc=el("span","chip uret");var ui=el("span","uic");ui.setAttribute("aria-hidden","true");uc.appendChild(ui);uc.appendChild(document.createTextNode(t(URETIM_AD[us])));d.appendChild(uc)}
  var seenA={};items.forEach(function(x){if(!x.adi)return;var k=JSON.stringify(x.adi);if(seenA[k])return;seenA[k]=1});
  var nA=Object.keys(seenA).length,doneA={};
  items.forEach(function(x){if(!x.adi)return;var k=JSON.stringify(x.adi);if(doneA[k])return;doneA[k]=1;d.appendChild(adiBlock(x.adi,nA>1||items.length>1&&items.some(function(y){return !y.adi})?x.id:""))});
  var pn=el("div","ipanel");pn.hidden=true;
  var same=items.length>1&&items.every(function(x){return ABOUT[x.id]===ABOUT[items[0].id]&&!(x.tgk_note&&ulke()==="TR")});
  if(same){var r4=veriMetin(ABOUT[items[0].id]||"","e."+items[0].id+".about"),p4=el("div","ln");p4.appendChild(el("b",null,t("gida.kart.nedir")));p4.appendChild(document.createTextNode(r4.s));pn.appendChild(vIsaret(p4,r4))}
  else items.forEach(function(x){
    var ab=ABOUT[x.id];
    if(items.length>1)pn.appendChild(el("div","ih",x.id+" · "+itAd(x)));
    if(ab){var r1=veriMetin(ab,"e."+x.id+".about"),p1=el("div","ln");p1.appendChild(el("b",null,t("gida.kart.nedir")));p1.appendChild(document.createTextNode(r1.s));pn.appendChild(vIsaret(p1,r1))}
    if(ulke()==="TR"&&items.length===1&&x.tgk_name&&x.tgk_name.toLowerCase()!==x.primary_name.toLowerCase()){var p0=el("div","ln");p0.appendChild(el("b",null,t("ulke.tr.tgk_adi")));var tn=el("span",null,x.tgk_name);tn.lang="tr";p0.appendChild(tn);pn.appendChild(p0)}   // Türk Gıda Kodeksi'ndeki ad: çevrilmez
    if(x.tgk_note&&ulke()==="TR"){var r3=veriMetin(x.tgk_note,"e."+x.id+".tgk_not"),p3=el("div","ln");p3.appendChild(el("b",null,t("ulke.tr.etiket")));p3.appendChild(document.createTextNode(r3.s));pn.appendChild(vIsaret(p3,r3))}
  });
  items.forEach(function(x){   // üretim yolu notu
    var u=x.uretim;if(!u)return;
    var ru=veriMetin(u.n,"e."+x.id+".uretim"),pu=el("div","ln");pu.appendChild(el("b",null,(items.length>1?x.id+" · ":"")+t("gida.kart.nasil_uretilir")));pu.appendChild(document.createTextNode(ru.s));vIsaret(pu,ru);
    if(u.u){pu.appendChild(document.createTextNode(" "+t("ortak.kaynak")));var a=el("a",null,u.u.replace(/^https?:\/\/(www\.)?/,"").split("/")[0]);a.href=u.u;a.target="_blank";a.rel="noopener";pu.appendChild(a)}
    if(!u.ok)pu.appendChild(document.createTextNode(" "+t("gida.kart.uretim_dogrulanmadi")));
    pn.appendChild(pu);
  });
  if(uretimSinif(r.ids,IDX))pn.appendChild(el("div","how",t("gida.kart.uretim_not")));
  var p2=el("div","ln");p2.appendChild(el("b",null,t("gida.kart.degerlendirme")));
  var r2=it.verification==="inventory_only"?{s:t("gida.kart.olcut_yok")}:veriMetin(it.reason,"e."+it.id+".reason");
  p2.appendChild(document.createTextNode(r2.s));
  pn.appendChild(vIsaret(p2,r2));
  if(it.sources&&it.sources.length){   // doğrulama kaynakları: bağlantı metni alan adı
    var ps=el("div","how",t("ortak.kaynak"));
    it.sources.forEach(function(u,i){var a=el("a",null,u.replace(/^https?:\/\/(www\.)?/,"").split("/")[0]);a.href=u;a.target="_blank";a.rel="noopener";if(i)ps.appendChild(document.createTextNode(" · "));ps.appendChild(a)});
    pn.appendChild(ps);
  }
  var dn=!it.needs_review?null:it.sources&&it.verification!=="partially_checked"?(ulke()==="TR"?"ulke.tr.izin_dogrulanmadi":null):it.sources?"gida.kart.kismen_dogrulanmadi":"gida.kart.dogrulanmadi";   // TR izin durumu notu yalnızca Türkiye seçiliyse
  if(dn)pn.appendChild(el("div","how",t(dn)));
  // Ayrıntı alt sayfada açılır: (i) düğmesi ya da kartın kendisine dokunma; her madde için "Ansiklopedide oku"
  pn.hidden=false;pn.className="";
  items.forEach(function(x){var a=el("a","ans",(items.length>1?x.id+" · ":"")+t("gida.kart.ansiklopedi"));a.href="ansiklopedi.html?id="+encodeURIComponent(x.id);pn.appendChild(a)});
  var ttl=items.length===1?items[0].id+" · "+itAd(items[0]):t("gida.kart.olasi",{l:items.map(function(i){return i.id}).join(", ")});
  b.removeAttribute("aria-expanded");b.setAttribute("aria-haspopup","dialog");
  b.onclick=function(e){e.stopPropagation();openSheet(ttl,LBL(r.rank),pn,b)};
  d.classList.add("tap");
  d.addEventListener("click",function(e){if(e.target.closest("button,a,.adi"))return;openSheet(ttl,LBL(r.rank),pn,b)});
  d._open=function(ret){openSheet(ttl,LBL(r.rank),pn,ret||b)};   // karşılaştırma ekranından açmak için
  return d;
}
/* Alt sayfa: başlık, durum satırı ve içerik; kapatınca odak açan düğmeye döner */
var SHEET_RET=null;
function openSheet(title,how,body,ret){
  $("sheet-t").textContent=title;var sb=$("sheet-b");sb.textContent="";
  if(how)sb.appendChild(el("div","how",how));sb.appendChild(body);
  SHEET_RET=ret||null;$("sheet").hidden=false;document.body.style.overflow="hidden";$("sheet-x").focus();
}
function closeSheet(){if($("sheet").hidden)return;$("sheet").hidden=true;document.body.style.overflow="";if(SHEET_RET)SHEET_RET.focus()}
$("sheet-x").onclick=closeSheet;$("sheet-bg").onclick=closeSheet;
document.addEventListener("keydown",function(e){if(e.key==="Escape")closeSheet()});
function comboCard(c){
  var R=c.rule,d=el("div","res "+(R.level==="yellow"?"y":"g")),top=el("div","hd"),ttl=veriS(R.title,"eslesme."+R.id+".baslik");
  top.appendChild(el("div","t",ttl));
  var b=el("button","info","i");b.type="button";b.setAttribute("aria-label",t("ortak.hakkinda",{ad:ttl}));b.setAttribute("aria-expanded","false");
  top.appendChild(b);d.appendChild(top);
  var p=el("div","ln");p.appendChild(el("b",null,t("eslesme.bu_urunde")));
  p.appendChild(document.createTextNode(c.hits.map(function(h,i){return (R.type==="cift"?veriS(R.groups[i].label,"eslesme."+R.id+".grup."+i)+": ":"")+h.join(", ")}).join(" · ")));d.appendChild(p);
  // Ayrıntı (açıklama, kaynak, not) yalnızca (i) düğmesine basınca görünür
  var pn=el("div","ipanel");pn.hidden=true;
  pn.appendChild(vEl("div","ln",R.text,"eslesme."+R.id+".metin"));
  var ps=el("div","how",t("ortak.kaynak"));
  (R.sources||[]).forEach(function(u,i){var a=el("a",null,u.replace(/^https?:\/\/(www\.)?/,"").split("/")[0]);a.href=u;a.target="_blank";a.rel="noopener";if(i)ps.appendChild(document.createTextNode(" · "));ps.appendChild(a)});
  pn.appendChild(ps);
  pn.appendChild(el("div","how",t("eslesme.not")));
  d.appendChild(pn);
  b.onclick=function(){pn.hidden=!pn.hidden;b.setAttribute("aria-expanded",pn.hidden?"false":"true");b.classList.toggle("on",!pn.hidden)};
  return d;
}
function comboSection(box,list){
  if(!list.length)return;
  box.appendChild(el("h2",null,t("eslesme.baslik")));
  list.forEach(function(c){box.appendChild(comboCard(c))});
}
function render(res,br){
  var box=$("sonuc");box.textContent="";LAST=res;LASTBR=br||[];
  var S=summarize(res,IDX);LASTSUM=S;
  if(!res.length&&!LASTBR.length){box.textContent=t("gida.eslesme_yok");return}
  if(S.cancer.length){
    var canc={yes:[],may:[]};S.cancer.forEach(function(c){(c.may?canc.may:canc.yes).push(typeof c==="string"?c:c.name)});
    var cd=el("div","res prof r"),hd=el("div","hd"),b=el("button","info sm","i");b.type="button";b.setAttribute("aria-label",t("kanser.hakkinda"));
    hd.appendChild(el("div","t",t("kanser.baslik")));hd.appendChild(b);cd.appendChild(hd);
    if(canc.yes.length)cd.appendChild(el("div","ln",canc.yes.join(", ")));
    if(canc.may.length){var d=el("div","ln");d.appendChild(el("b",null,t("ortak.icerebilir_iki")));d.appendChild(document.createTextNode(canc.may.join(", ")));cd.appendChild(d)}
    var ipan=el("div","ipanel");ipan.hidden=true;
    ipan.appendChild(el("div","how",t("kanser.gida_not")));
    cd.appendChild(ipan);b.onclick=function(){ipan.hidden=!ipan.hidden;b.setAttribute("aria-expanded",ipan.hidden?"false":"true");b.classList.toggle("on",!ipan.hidden)};
    box.appendChild(cd);
  }
  profileCards(S).forEach(function(c){box.appendChild(c)});
  box.appendChild(summaryCard(S,res));
  if(LASTBR.length&&ulke()==="TR")box.appendChild(brandCard(LASTBR));
  comboSection(box,findCombos(COMBO,"gida",comboItemsFood(res,IDX)));
  var E=res.filter(function(r){return !r.isB&&!r.neg});
  if(E.length){box.appendChild(el("h2",null,t("gida.katkilar")));E.forEach(function(r){box.appendChild(additiveCard(r))})}
  var B=res.filter(function(r){return r.isB&&!r.neg}),notes=B.map(function(r){return IDX.byId[r.ids[0]]}).filter(function(it){return it.note});
  if(B.length){
    var bd=secBox(box,t("gida.diger_icerik"),B.length);
    var seen={};B.forEach(function(r){var it=IDX.byId[r.ids[0]];if(seen[it.id])return;seen[it.id]=1;var l=el("div","ln");l.appendChild(el("b",null,itAd(it)));if(it.note){var rn=veriMetin(it.note,"b."+it.id+".not");l.appendChild(document.createTextNode(": "+rn.s));vIsaret(l,rn)}bd.appendChild(l)});
  }
  box.appendChild(el("div","how it",t("gida.alt_not")));
  payBar(box,{mode:"gida",text:$("metin").value});
}
/* Analiz; ardından barkod kaynağı/katkı kartı (js/arayuz_barkod.js) */
function run(){runIc();if(typeof barkodSonra==="function")barkodSonra()}
function runIc(){
  var tx=$("metin").value;
  if(MODE==="koz"){
    if(!tx.trim()){$("sonuc").textContent=t("ortak.once_metin");return}
    if(!KIDX){$("sonuc").textContent=t("koz.yukleniyor");loadK().then(run,function(){$("sonuc").textContent=t("koz.yuklenemedi")});return}
    try{renderK(analyzeK(tx,KIDX,{ptype:PTYPE}));histSave(tx,"koz")}catch(e){$("sonuc").textContent=t("ortak.analiz_hatasi",{m:e.message})}
    if(looksCleaning(tx))sonucUst(suggestCardT());
    return;
  }
  if(MODE==="tem"){
    if(!tx.trim()){$("sonuc").textContent=t("ortak.once_metin");return}
    if(!TIDX){$("sonuc").textContent=t("tem.yukleniyor");loadT().then(run,function(){$("sonuc").textContent=t("tem.yuklenemedi")});return}
    try{renderT(analyzeT(tx,TIDX,KIDX));histSave(tx,"tem")}catch(e){$("sonuc").textContent=t("ortak.analiz_hatasi",{m:e.message})}
    return;
  }
  if(!IDX){$("sonuc").textContent=t("gida.yuklenmedi");return}
  if(!tx.trim()){$("sonuc").textContent=t("ortak.once_metin");return}
  try{render(analyze(tx,IDX),BRANDS?findBrands(tx,BRANDS):[]);histSave(tx)}catch(e){$("sonuc").textContent=t("ortak.analiz_hatasi",{m:e.message})}
  if(looksCleaning(tx))sonucUst(suggestCardT());
  else if(looksCosmetic(tx))sonucUst(suggestCard());
}
// Metin elle düzeltildiğinde sonuç kendiliğinden güncellenir (yazmayı bitirmesi beklenir)
var RUN_T=null;$("metin").addEventListener("input",function(){HMOD=null;clearTimeout(RUN_T);RUN_T=setTimeout(run,600)});
/* "Örnek metin dene": etiket metni örnekleri dil dosyasında (ornek.gida/koz/tem); her dil kendi pazarındaki gibi bir etiket yazabilir */
$("ornek").onclick=function(){HSCAN=HOCR=true;$("metin").value=t("ornek."+(MODE==="koz"?"koz":MODE==="tem"?"tem":"gida"));run()};
