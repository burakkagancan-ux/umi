/* Ansiklopedi sayfası arayüzü (ansiklopedi.html). ?m=<slug> ya da ?id=E322 madde sayfasını, parametresiz açılış arama ve kayıtlı maddeleri gösterir. */
var AD=null,AT={},AIDX=null,ABY={},ACUR=null;
var AREPO="https://github.com/burakkagancan-ux/tagsis/issues/new";
function a$(i){return document.getElementById(i)}
function h(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function at(k){return ansT(AT,k)}   // ansiklopedi veri metni (data/ansiklopedi_<dil>.json); arayüz metni için t() (js/ceviri.js) ayrı
function atAd(k){return at(k)||k}   // kaynak başlığı, yayımcı, kurum adı: anahtar (kaynak.*); eski veride düz metin olabilir
function svg(path,cls){var s=document.createElementNS("http://www.w3.org/2000/svg","svg");s.setAttribute("viewBox","0 0 24 24");s.setAttribute("aria-hidden","true");if(cls)s.setAttribute("class",cls);s.innerHTML=path;return s}
/* Risk ikonları renkle birlikte şekille de ayrılır: yeşil onay, sarı üçgen, kırmızı ünlem */
var RICON={
  green:'<circle cx="12" cy="12" r="10" fill="#1F4D3A"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  amber:'<path d="M12 2.5L23 21.5H1z" fill="#8A5A00"/><path d="M12 9v6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="18.2" r="1.4" fill="#fff"/>',
  red:'<circle cx="12" cy="12" r="10" fill="#A4470B"/><path d="M12 6.5v7" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.5" fill="#fff"/>',
  notr:'<circle cx="12" cy="12" r="10" fill="#8A8F8B"/><path d="M7.5 12h9" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>'
};
/* Sonuç ekranıyla aynı kural: yeşil onay yalnızca "doğal" üretim yolunda; diğer uyarısız maddeler nötr (gri) */
function notr(r){return r.risk_level==="green"&&!(r.production&&r.production.class==="dogal")}
function rico(r){return RICON[notr(r)?"notr":r.risk_level]}
var PWICON='<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 6.5v7" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.5" fill="#fff"/>';
function tarih(s){var m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(s||"");return m?dilTarih(Date.UTC(+m[1],m[2]-1,+m[3],12),"gun"):""}
function prof(){try{return JSON.parse(localStorage.getItem("profil")||"null")}catch(e){return null}}
function marks(){try{var a=JSON.parse(localStorage.getItem("yerimleri")||"[]");return Array.isArray(a)?a:[]}catch(e){return[]}}
function setMarks(a){try{localStorage.setItem("yerimleri",JSON.stringify(a))}catch(e){}}
function link(r){return "ansiklopedi.html?m="+encodeURIComponent(r.slug)}

/* ---------- Madde sayfası ---------- */
function showRecord(r){
  ACUR=r;var box=a$("ana");box.textContent="";
  var name=at(r.names.primary);
  document.title=r.id+" "+name+" · "+t("nav.ansiklopedi");
  var bm=a$("kaydet");bm.hidden=false;syncMark();
  var bd=h("div","badges");bd.appendChild(h("span","ecode",r.id));bd.appendChild(h("span","cat",at("cat."+r.category)));box.appendChild(bd);
  box.appendChild(h("h2","name",name));
  if(r.summary)box.appendChild(h("p","sum",at(r.summary)));
  // Genel değerlendirme
  var rk=h("section","card risk "+r.risk_level+(notr(r)?" n":""));rk.setAttribute("aria-label",t("ans.genel_aria"));
  rk.appendChild(svg(rico(r),"ico"));
  var rt=h("div");rt.appendChild(h("div","lbl",at("risk."+r.risk_level)));
  rt.appendChild(h("div","mut",r.review==="curated"?t("ans.kanit",{kanit:at("evidence."+r.evidence_level),tarih:tarih(r.last_reviewed)}):t("ans.kanit_yok")));
  if(r.evaluation)rt.appendChild(h("p",null,at(r.evaluation)));
  rk.appendChild(rt);box.appendChild(rk);
  // Profil uyarısı: yalnızca kullanıcının seçtiği hassasiyetle eşleşirse
  ansProfileWarnings(r,prof()).forEach(function(w){
    var d=h("section","pw "+w.severity);d.setAttribute("role","note");
    var tt=h("div","t");var ic=svg(PWICON);ic.style.color=w.severity==="high"?"#B3261E":"#8A5A00";tt.appendChild(ic);
    tt.appendChild(document.createTextNode(t("ans.profil_eslesti",{ad:at("profile."+w.profile)||w.profile})));d.appendChild(tt);
    d.appendChild(h("p",null,at(w.text)));box.appendChild(d);
  });
  if(r.review!=="curated")box.appendChild(h("div","auto",t("ans.otomatik")));
  // Hızlı bilgi kartları (otomatik kayıtta bilinmeyenler gösterilmez)
  var q=h("div","quick"),df=r.diet_flags,cur=r.review==="curated";
  [[t("ans.hizli.vegan"),df.vegan==="unknown"&&!cur?null:at("diet."+df.vegan)],[t("ans.hizli.kaynak"),(df.source==="unknown"&&!cur)||(r.production&&(df.source==="synthetic"||df.source==="mineral"))?null:at("source."+df.source)],[t("ans.hizli.uretim"),r.production?uretimAd(r.production.class):null],[t("ans.hizli.gluten"),df.gluten==="unknown"&&!cur?null:(df.gluten==="no"?t("ans.gluten.icermez"):df.gluten==="yes"?t("ans.gluten.icerir"):at("diet.unknown"))]]
    .forEach(function(x){if(x[1]==null)return;var c=h("div");c.appendChild(h("b",null,x[0]));c.appendChild(h("span",null,x[1]));q.appendChild(c)});
  if(q.childNodes.length)box.appendChild(q);
  // Sekmeler
  var tabs=h("div","tabs");tabs.setAttribute("role","tablist");tabs.setAttribute("aria-label",t("ans.sekme_aria"));box.appendChild(tabs);
  var P=[["genel",t("ans.sekme.genel"),panelGenel(r)],["otorite",t("ans.sekme.otorite"),panelOtorite(r)],["kaynak",t("ans.sekme.kaynak"),panelKaynak(r)]];
  P.forEach(function(p,i){
    var b=h("button","tab",p[1]);b.type="button";b.id="tab-"+p[0];b.setAttribute("role","tab");b.setAttribute("aria-controls","pn-"+p[0]);
    var pn=p[2];pn.id="pn-"+p[0];pn.className="panel";pn.setAttribute("role","tabpanel");pn.setAttribute("aria-labelledby",b.id);pn.tabIndex=0;
    b.onclick=function(){sel(i,true)};
    b.onkeydown=function(e){if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();sel((i+(e.key==="ArrowRight"?1:P.length-1))%P.length,true)}};
    tabs.appendChild(b);box.appendChild(pn);
  });
  function sel(i,focus){P.forEach(function(p,j){var b=a$("tab-"+p[0]);b.setAttribute("aria-selected",i===j?"true":"false");b.tabIndex=i===j?0:-1;a$("pn-"+p[0]).hidden=i!==j});if(focus)a$("tab-"+P[i][0]).focus()}
  sel(0,false);
  // Benzer maddeler
  var rel=r.related_ids.map(function(x){return ABY[x]}).filter(Boolean);
  if(rel.length){
    box.appendChild(h("h2","sec",t("ans.benzer")));
    var rw=h("div","rel");
    rel.forEach(function(x){var a=h("a");a.href=link(x);var b=h("b");b.appendChild(svg(rico(x),"mini"));b.appendChild(document.createTextNode(x.id));a.appendChild(b);a.appendChild(h("span",null,at(x.names.primary)));a.setAttribute("aria-label",x.id+" "+at(x.names.primary)+", "+at("risk."+x.risk_level));rw.appendChild(a)});
    box.appendChild(rw);
  }
  footer(box,r);
}
function uretimAd(c){return {dogal:t("ans.uretim.dogal"),fermente:t("ans.uretim.fermente"),islenmis:t("ans.uretim.islenmis"),sentetik:t("ans.uretim.sentetik"),belirsiz:t("ans.uretim.belirsiz")}[c]}
function panelGenel(r){
  var p=h("div"),c=r.content;
  p.appendChild(h("h3",null,t("ans.ne_ise")));p.appendChild(h("p",null,at(c.what_it_does)));
  if(r.production){
    p.appendChild(h("h3",null,t("ans.nasil")));p.appendChild(h("p",null,at(r.production.note)));
    p.appendChild(h("p","mut",t(r.production.verified?"ans.uretim_not":"ans.uretim_not_dogrulanmadi")));
  }
  if(c.found_in.length){p.appendChild(h("h3",null,t("ans.nerede")));var ul=h("ul");c.found_in.forEach(function(k){ul.appendChild(h("li",null,at(k)))});p.appendChild(ul)}
  if(r.effects&&r.effects.length){
    p.appendChild(h("h3",null,t("ans.etkiler")));
    var el=h("ul","eff");
    r.effects.forEach(function(x){
      var li=h("li"),s=x.source;
      li.appendChild(h("span","lv",at("eff."+x.level)));
      li.appendChild(h("p",null,at(x.text)));
      if(x.who)li.appendChild(effRow(t("ans.kimde"),at(x.who)));
      if(x.amount)li.appendChild(effRow(t("ans.miktar"),at(x.amount)));
      var k=h("div","mut"),a=h("a",null,atAd(s.label)+(s.year?", "+s.year:""));a.href=s.url;a.target="_blank";a.rel="noopener";a.title=atAd(s.title);
      k.appendChild(document.createTextNode(t("ortak.kaynak")));k.appendChild(a);li.appendChild(k);
      el.appendChild(li);
    });
    p.appendChild(el);p.appendChild(h("p","mut",at("eff.doctor")));
  }
  if(c.in_the_body){p.appendChild(h("h3",null,t("ans.vucut")));p.appendChild(h("p",null,at(c.in_the_body)))}
  if(r.review!=="curated")p.appendChild(h("p","mut",t("ans.yazilmadi")));
  return p;
}
function effRow(k,v){var d=h("div","er");d.appendChild(h("b",null,t("ortak.etiket_iki_nokta",{ad:k})));d.appendChild(document.createTextNode(v));return d}
function panelOtorite(r){
  var p=h("div");
  if(r.agency_note){p.appendChild(h("h3",null,t("ans.kurum_not")));p.appendChild(h("p",null,at(r.agency_note)))}
  if(!r.regulatory.length){p.appendChild(h("p","mut",t("ans.kurum_yok")));return p}
  r.regulatory.forEach(function(g){
    var row=h("div","ag"),l=h("div");
    l.appendChild(h("div","who",atAd(g.agency)+" · "+(at("region."+g.region)||g.region)+(g.year?" · "+g.year:"")));
    l.appendChild(h("div","d",at(g.detail)));
    if(g.source_url){var a=h("a",null,t("ans.kaynagi_ac"));a.href=g.source_url;a.target="_blank";a.rel="noopener";a.style.fontSize="14px";l.appendChild(a)}
    row.appendChild(l);row.appendChild(h("span","st "+g.status,at("status."+g.status)));p.appendChild(row);
  });
  return p;
}
function panelKaynak(r){
  var p=h("div");
  if(!r.sources.length){p.appendChild(h("p","mut",t("ans.kaynak_yok")));return p}
  r.sources.forEach(function(s){
    var d=h("div","src");
    if(s.url){var a=h("a",null,atAd(s.title));a.href=s.url;a.target="_blank";a.rel="noopener";d.appendChild(a)}else d.appendChild(h("span","ttl",atAd(s.title)));
    if(s.official)d.appendChild(h("span","tag",t("ans.resmi")));
    d.appendChild(h("div","mut",atAd(s.publisher)+(s.year?", "+s.year:"")+(s.todo?" · "+t("ans.baglanti_yok"):"")));
    p.appendChild(d);
  });
  return p;
}
function footer(box,r){
  var f=h("div","foot");f.appendChild(h("div",null,t("ans.sorumluluk")));
  var a=h("a",null,t("ans.hata_bildir"));
  a.href=AREPO+"?title="+encodeURIComponent(r?t("ans.hata.baslik_madde",{ad:r.id+" "+at(r.names.primary)}):t("ans.hata.baslik"))+"&body="+encodeURIComponent(t("ans.hata.govde",{url:location.href}));
  a.target="_blank";a.rel="noopener";f.appendChild(a);box.appendChild(f);
}
function syncMark(){var b=a$("kaydet"),on=!!ACUR&&marks().indexOf(ACUR.id)>-1;b.setAttribute("aria-pressed",on?"true":"false");b.setAttribute("aria-label",on?t("ans.kaydet_cikar"):t("ans.kaydet"))}
a$("kaydet").onclick=function(){if(!ACUR)return;var m=marks().filter(function(x){return x!==ACUR.id});if(m.length===marks().length)m.unshift(ACUR.id);setMarks(m);syncMark()};
a$("geri").onclick=function(){
  var same=document.referrer&&document.referrer.indexOf(location.origin)===0;
  if(same&&history.length>1)history.back();else location.href=ACUR?"ansiklopedi.html":"ocr.html";
};

/* ---------- Arama ve kayıtlı maddeler ---------- */
function rowFor(r){
  var a=h("a","row");a.href=link(r);a.appendChild(svg(rico(r)));a.appendChild(h("span","rc",r.id));
  var n=h("span","rn",at(r.names.primary));n.appendChild(h("span","rk",at("cat."+r.category)+" · "+at("risk."+r.risk_level)));a.appendChild(n);return a;
}
function showSearch(){
  ACUR=null;a$("kaydet").hidden=true;document.title=t("nav.ansiklopedi");
  var box=a$("ana");box.textContent="";
  var lb=h("label","vh",t("ans.ara"));lb.htmlFor="ara";box.appendChild(lb);
  var inp=h("input");inp.type="search";inp.id="ara";inp.placeholder=t("ans.ara_yer");inp.autocomplete="off";inp.setAttribute("enterkeyhint","search");box.appendChild(inp);
  var out=h("div","list");out.setAttribute("aria-live","polite");box.appendChild(out);
  function draw(){
    var q=inp.value;out.textContent="";
    try{history.replaceState(null,"",q.trim()?"ansiklopedi.html?q="+encodeURIComponent(q):"ansiklopedi.html")}catch(e){}
    if(q.trim()){
      var res=ansSearch(AIDX,q,40);
      out.appendChild(h("p","mut",res.length?t("ans.sonuc",{n:res.length,s:res.length+(res.length===40?"+":"")}):t("ans.sonuc_yok")));
      res.forEach(function(r){out.appendChild(rowFor(r))});return;
    }
    var m=marks().map(function(x){return ABY[x]}).filter(Boolean);
    out.appendChild(h("h2","sec",t("ans.kaydettiklerim")));
    if(m.length)m.forEach(function(r){out.appendChild(rowFor(r))});else out.appendChild(h("p","mut",t("ans.kayit_yok")));
    out.appendChild(h("h2","sec",t("ans.incelenen")));
    AD.records.filter(function(r){return r.review==="curated"}).forEach(function(r){out.appendChild(rowFor(r))});
    out.appendChild(h("p","mut",t("ans.toplam",{n:AD.records.length})));
  }
  var tm=null;inp.addEventListener("input",function(){clearTimeout(tm);tm=setTimeout(draw,150)});
  var q0=new URLSearchParams(location.search).get("q");if(q0)inp.value=q0;
  draw();
  footer(box,null);
}

/* ---------- Açılış ---------- */
function aGet(p){return fetch(p).then(function(r){if(!r.ok)throw new Error(p);return r.json()})}
/* Metinler dile göre: seçili dil → İngilizce → Türkçe (anahtar bazında; dosya yoksa Türkçe). Dil js/dil.js'ten (DIL_HAZIR).
   Açılışta dizin metni (data/ansiklopedi_<dil>.json), madde açılınca o sayfanın metni (data/ansiklopedi/<dil>/<kimlik>.json). */
/* Sıra önemli: sonraki dosya öncekinin üstüne yazar, seçili dil en sonda. Kaynak dil eksiksiz; Türkçede yedek inmez (js/dil.js gibi). */
function ansKodlar(){return DIL.kod===DIL_KAYNAK?[DIL_KAYNAK]:[DIL_KAYNAK,DIL_YEDEK,DIL.kod].filter(function(x,i,a){return a.indexOf(x)===i})}
function ansMetinGetir(yol){
  var u=ansKodlar().map(function(k){return yol(k)});
  return Promise.all(u.map(function(p,i){var g=aGet(p);return i?g.catch(function(){return {t:{}}}):g})).then(function(v){
    dilOnbellege(u);var m={};v.forEach(function(x){var tt=(x&&x.t)||{};for(var k in tt)m[k]=tt[k]});return m;
  });
}
function ansMetin(){return ansMetinGetir(function(k){return "data/ansiklopedi_"+k+".json"})}
/* Madde sayfası: tam kayıt ve metinleri (dizindeki kayıt yalnızca arama ve liste alanlarını taşır) */
function ansSayfa(r){
  var p="data/ansiklopedi/"+r.id+".json";
  return Promise.all([aGet(p),ansMetinGetir(function(k){return "data/ansiklopedi/"+k+"/"+r.id+".json"})]).then(function(v){
    dilOnbellege([p]);for(var k in v[1])AT[k]=v[1][k];return v[0];
  });
}
Promise.all([aGet("data/ansiklopedi.json"),DIL_HAZIR.then(ansMetin)]).then(function(v){
  AD=v[0];AT=v[1];AD.records.forEach(function(r){ABY[r.id]=r});AIDX=ansIndex(AD.records,AT);
  var sp=new URLSearchParams(location.search),m=sp.get("m"),id=sp.get("id"),r=null;
  if(m)r=AD.records.filter(function(x){return x.slug===m})[0]||null;
  if(!r&&id){var f=ansFold(id);r=AD.records.filter(function(x){return ansFold(x.id)===f})[0]||null}
  if(r){
    try{if(sp.get("m")!==r.slug)history.replaceState(null,"","ansiklopedi.html?m="+r.slug)}catch(e){}
    return ansSayfa(r).then(showRecord,function(){
      document.title=r.id+" "+at(r.names.primary)+" · "+t("nav.ansiklopedi");var box=a$("ana");box.textContent="";
      box.appendChild(h("h2","name",r.id+" "+at(r.names.primary)));
      box.appendChild(h("p","mut",t("ans.inmedi")));
      footer(box,r);
    });
  }
  showSearch();if(m||id)a$("ana").insertBefore(h("p","mut",t("ans.bulunamadi")),a$("ana").firstChild);
}).catch(function(){a$("ana").textContent=t("ans.yuklenemedi")});
try{if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(function(){})}catch(e){}
