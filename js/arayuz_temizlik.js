/* Arayüz: temizlik sonuç ekranı. */
/* ---------- Temizlik modu ---------- */
var TDB=null,TIDX=null,TLOAD=null;
/* Zehir danışma hattı: Türkiye seçiliyse UZEM 114; ülke seçilmediyse genel acil durum notu (başka ülkenin numarası gösterilmez) */
function zehirHatti(){return ulke()==="TR"&&TIDX.uzem?veriS(TIDX.uzem,"t.uzem"):t("ulke.yok.zehir")}
function loadT(){
  if(TIDX&&KIDX)return Promise.resolve(TIDX);
  if(TLOAD)return TLOAD;
  setSt("tem",t("tem.yukleniyor"));
  // Koku alerjenleri ve koruyucular kozmetik INCI listesinden tanınır
  TLOAD=Promise.all([getJson("data/temizlik.json"),loadK()]).then(function(a){
    TDB=a[0];TIDX=buildTIndex(TDB);
    setSt("tem",t("tem.yuklendi",{n:TDB.hazards.length,g:TDB.groups.length}));
    return TIDX;
  }).catch(function(e){TLOAD=null;setSt("tem",t("tem.yuklenemedi_st"));throw e});
  return TLOAD;
}
function suggestCardT(){
  var d=el("div","res suggest");d.appendChild(el("div","t",t("tem.oneri.baslik")));
  d.appendChild(el("div","ln",t("tem.oneri.metin")));
  var b=el("button",null,t("tem.oneri.dugme"));b.type="button";b.onclick=function(){setMode("tem",true,true);window.scrollTo(0,0)};d.appendChild(b);
  return d;
}
/* Kozmetiğe özgü CosIng işlevleri (veri değerleri, kozmetik_inci.json "functions"; arayüz metni değil) */
var TFUNC_SKIP=["Saç boyası","Deodorant","Saç bakımı","Cilt bakımı","Ağız bakımı","Tırnak bakımı","Keratolitik","Bronzlaştırıcı","Cilt koruyucu","Kepek önleyici"];
var TCLS={red:"r",yellow:"y",info:"g n"},TLBL={red:"tem.seviye.red",yellow:"risk.uyari",info:"tem.seviye.info"};   // çeviri anahtarları
function srcLinks(urls){
  var ps=el("div","how",t("ortak.kaynak"));
  (urls||[]).forEach(function(u,i){var a=el("a",null,u.replace(/^https?:\/\/(www\.)?/,"").split("/")[0]);a.href=u;a.target="_blank";a.rel="noopener";if(i)ps.appendChild(document.createTextNode(" · "));ps.appendChild(a)});
  return ps;
}
function infoCard(cls,title,how,body){
  var d=el("div","res "+cls),top=el("div","hd");
  top.appendChild(el("div","t",title));
  var b=el("button","info","i");b.type="button";b.setAttribute("aria-label",t("ortak.hakkinda",{ad:title}));b.setAttribute("aria-expanded","false");
  top.appendChild(b);d.appendChild(top);
  if(how)d.appendChild(el("div","how",how));
  var pn=el("div","ipanel");pn.hidden=true;body(pn,d);d.appendChild(pn);
  b.onclick=function(){pn.hidden=!pn.hidden;b.setAttribute("aria-expanded",pn.hidden?"false":"true");b.classList.toggle("on",!pn.hidden)};
  return d;
}
function hzCard(x){
  var h=x.h,M=TIDX.meta,how=t(x.how.indexOf("benzer")>-1&&x.how.indexOf("kod")<0?"tem.how.benzer":x.how.indexOf("kod")>-1&&x.how.indexOf("metin")>-1?"tem.how.kod_metin":x.how.indexOf("kod")>-1?"tem.how.kod":"tem.how.metin");
  return infoCard(TCLS[h.level],h.code+" · "+hzKisa(h),t(TLBL[h.level])+" · "+veriS(M.group_labels[h.group]||h.group,"t.grup_etiket."+h.group)+" · "+how,function(pn,d){
    if(h.note)d.appendChild(vEl("div","ln",h.note,"t.ifade."+h.code+".not"));
    if(h.code==="EUH208"&&x.names&&x.names.length)d.appendChild(el("div","ln",t("tem.hz.adi_gecen",{l:x.names.join("; ")})));
    pn.appendChild(el("div","ln",t("tem.hz.zorunlu")));
    var eu=h.code.indexOf("EUH")===0;
    pn.appendChild(el("div","how",t("tem.hz.mevzuat")+t(!eu?"tem.hz.metin_h":h.needs_review?"tem.hz.metin_euh_ceviri":"tem.hz.metin_euh_sds")));
    pn.appendChild(srcLinks([M.sources.clp,!eu?M.sources.h_tr:h.needs_review?M.sources.euh:(TIDX.sds_tr||[])[0]||M.sources.euh]));
  });
}
function tSummaryCard(S,A){
  var d=el("div","res sumbox");d.appendChild(el("div","t",t("ortak.ozet")));
  function row(label,val,cls){var r=el("div","srow");r.appendChild(el("span","sl",label));r.appendChild(el("span","sv"+(cls?" "+cls:""),val));d.appendChild(r)}
  function lst(a){return a.length?t("ortak.say_liste",{n:a.length,l:a.join(", ")}):t("ortak.bulunamadi")}
  var n=A.hazards.length;
  row(t("tem.ozet.ifade"),n?t(S.info.length?"tem.ozet.ifade_say_bilgi":"tem.ozet.ifade_say",{n:n,r:S.red.length,y:S.yellow.length,i:S.info.length}):t("ortak.bulunamadi"),S.red.length?"r":S.yellow.length?"y":"");
  row(t("tem.ozet.kelime"),A.signal==="tehlike"?t("tem.ozet.tehlike"):A.signal==="dikkat"?t("tem.ozet.dikkat_kelime"):t("tem.ozet.okunmadi"),A.signal==="tehlike"?"r":A.signal==="dikkat"?"y":"");
  var g=A.groups.filter(function(x){return !x.neg});
  row(t("tem.ozet.grup"),g.length?t("ortak.say_liste",{n:g.length,l:g.map(function(x){return tGrupAd(x.g)}).join(", ")}):t("ortak.bulunamadi"));
  row(t("koz.ozet.koku"),lst(S.fragrance));
  row(t("koz.ozet.koruyucu"),lst(S.pres));
  if(S.color.length)row(t("tem.ozet.renk"),lst(S.color));
  row(t("tem.ozet.parfum"),S.parfum?t("ortak.var"):t("koz.ozet.yazmiyor"));
  if(A.inci.length)row(t("tem.ozet.taninan"),t("tem.ozet.adet_asagida",{n:A.inci.length}));
  if(S.mix)row(t("tem.ozet.karistirma"),t("tem.ozet.karistirma_l"),"y");
  if(A.capsule)row(t("tem.ozet.kapsul"),t("tem.ozet.kapsul_l"),"y");
  if(A.prec&&A.prec.length)row(t("tem.ozet.onlem"),t("tem.ozet.adet_asagida",{n:A.prec.length}));
  if(!n)d.appendChild(el("div","how",t("tem.ozet.ifade_yok")));
  if(A.hazards.some(function(x){return x.how.indexOf("benzer")>-1&&x.how.indexOf("kod")<0}))d.appendChild(el("div","how",t("tem.ozet.benzer")));
  return d;
}
function tProfileCards(S,A){
  var out=[],j=function(a){return a.join(", ")},has=function(c){return A.hazards.some(function(x){return x.code===c})};
  function name(c){return c+" ("+hzKisa(TIDX.byCode[c])+")"}
  if(PROF.koku){
    var e208=has("EUH208")?[A.euh208&&A.euh208.length?t("tem.prof.euh208_l",{l:A.euh208.join("; ")}):t("tem.prof.euh208")]:[];
    if(S.fragrance.length)out.push(card("r",t("koz.prof.koku_var"),[j(S.fragrance)].concat(e208,S.parfum?[t("tem.prof.parfum_ek")]:[])));
    else if(S.parfum||e208.length)out.push(card("y",t("koz.prof.parfum"),e208.concat([t("tem.prof.parfum_not")])));
    else out.push(card("g",t("koz.prof.koku_yok"),[t("ortak.onay_degil_okuma")]));
  }
  if(PROF.astim){
    var rows=[];
    if(S.resp.length)rows.push([S.resp.some(function(c){return /^(H334|EUH071)$/.test(c)})?"r":"y",t("tem.prof.solunum_l",{l:S.resp.map(name).join("; ")})]);
    if(S.enzyme)rows.push(["y",t("tem.prof.enzim")]);
    if(["H222","H223","H229","EUH211"].some(has))rows.push(["y",t("tem.prof.sprey")]);
    if(S.parfum)rows.push(["y",t("tem.prof.parfum_var")]);
    out.push(lifeCard(t("tem.prof.astim"),rows,t("tem.prof.solunum_yok"),t("ortak.onay_degil_okuma")));
  }
  if(PROF.preg||PROF.baby||PROF.child){
    var r2=[];
    if(S.cmr.length)r2.push(["r",t("tem.prof.cmr_l",{l:S.cmr.map(name).join("; ")})]);
    if(S.ed.length)r2.push(["r",t("tem.prof.ed_l",{l:S.ed.map(name).join("; ")})]);
    if(PROF.baby||PROF.child){
      var sw=S.swallow.concat(S.eye).filter(function(c){return TIDX.byCode[c].level==="red"});
      if(sw.length)r2.push(["r",t("tem.prof.yutma_ciddi",{l:sw.map(name).join("; ")})]);
      else if(S.swallow.length||S.eye.length)r2.push(["y",t("tem.prof.yutma",{l:S.swallow.concat(S.eye).map(name).join("; ")})]);
    }
    if((PROF.baby||PROF.child)&&A.capsule)r2.push(["r",t("tem.prof.kapsul")]);
    var who=PROF.preg?"hamile":PROF.baby?"bebek":"cocuk";
    out.push(lifeCard(t("tem.prof."+who),r2,t("tem.prof."+who+"_yok"),t("tem.prof.onay_sakla"),r2.length?zehirHatti():null));
  }
  return out;
}
function renderT(A){
  var box=$("sonuc");box.textContent="";
  if(!A.hazards.length&&!A.groups.length&&!A.inci.length&&!A.subs.length){box.textContent=t("tem.bos");return}
  var S=summarizeT(A),M=TIDX.meta;
  if(S.cancer.length){
    var cd=el("div","res prof r"),hd=el("div","hd"),b=el("button","info sm","i");b.type="button";b.setAttribute("aria-label",t("kanser.tem_hakkinda"));
    hd.appendChild(el("div","t",t("kanser.tem_baslik")));hd.appendChild(b);cd.appendChild(hd);
    cd.appendChild(el("div","ln",S.cancer.map(function(c){return c+" "+hzMetin(TIDX.byCode[c])}).join(" ")));
    var ipan=el("div","ipanel");ipan.hidden=true;
    ipan.appendChild(el("div","how",t("kanser.tem_not")));
    cd.appendChild(ipan);b.onclick=function(){ipan.hidden=!ipan.hidden;b.setAttribute("aria-expanded",ipan.hidden?"false":"true");b.classList.toggle("on",!ipan.hidden)};
    box.appendChild(cd);
  }
  tProfileCards(S,A).forEach(function(c){box.appendChild(c)});
  box.appendChild(tSummaryCard(S,A));
  // Kozmetik ve gıda ekranlarındaki düzen: dikkat gerektirenler kart olarak, listeler kapalı açılır bölümlerde
  var notes=A.subs.filter(function(x){return !x.s.mix});
  if(S.mix||(A.capsule&&TIDX.cap)||A.hazards.length||notes.length)box.appendChild(el("h2",null,t("tem.dikkat_baslik")));
  if(S.mix){
    var R=TIDX.mix;
    box.appendChild(infoCard("y",veriS(R.title,"t.karistirma.baslik"),null,function(pn,d){
      var p=el("div","ln");p.appendChild(el("b",null,t("eslesme.bu_urunde")));p.appendChild(document.createTextNode(S.mixWhy.join(", ")));d.appendChild(p);
      pn.appendChild(vEl("div","ln",R.text,"t.karistirma.metin"));pn.appendChild(srcLinks(R.sources));
    }));
  }
  if(A.capsule&&TIDX.cap){
    var C=TIDX.cap.d;
    box.appendChild(infoCard("y",veriS(C.title,"t.kapsul.baslik"),t("tem.cocuk_guvenligi"),function(pn){pn.appendChild(vEl("div","ln",C.text,"t.kapsul.metin"));pn.appendChild(srcLinks(C.sources))}));
  }
  A.hazards.slice().sort(function(a,b){return TRANK[b.h.level]-TRANK[a.h.level]}).forEach(function(x){box.appendChild(hzCard(x))});
  notes.forEach(function(x){
    var s=x.s,sm=veriMetin(s.text,"t.madde."+s.id+".metin"),m=/^(.+?\.\s.+?\.)(\s[A-ZÇĞİÖŞÜ].*)?$/.exec(sm.s),vis=m?m[1]:sm.s,rest=m&&m[2]?m[2].trim():"";   // ilk iki cümle görünür, kalanı (i) arkasında
    box.appendChild(infoCard(TCLS[s.level],s.inci.length>1?t("tem.enzim_l",{l:s.inci.join(", ").toLowerCase()}):s.inci[0],t(TLBL[s.level])+" · "+(s.kind==="koruyucu"?t("koz.ozet.koruyucu"):s.kind==="enzim"?t("tem.enzim"):s.kind),function(pn,d){
      d.appendChild(vIsaret(el("div","ln",vis),sm));if(rest)pn.appendChild(vIsaret(el("div","ln",rest),sm));pn.appendChild(srcLinks(s.sources));
    }));
  });
  if(A.prec&&A.prec.length){
    var P=A.prec.slice().sort(function(a,b){return (b.p.aid?1:0)-(a.p.aid?1:0)});
    var pb=secBox(box,t("tem.onlemler"),P.length),pu=el("ul","klist");
    P.forEach(function(x){var li=el("li");li.appendChild(el("b",null,x.code+" "));li.appendChild(document.createTextNode(veriS(x.p.tr,null,{en:x.p.en})));if(x.p.aid)li.appendChild(el("span","chip",t("tem.ilk_yardim")));if(x.how.indexOf("benzer")>-1&&x.how.indexOf("kod")<0)li.appendChild(el("span","fn"," · "+t("tem.how.benzer")));pu.appendChild(li)});
    pb.appendChild(pu);
    if(P.some(function(x){return x.p.aid}))pb.appendChild(el("div","ln",zehirHatti()));
    if(P.some(function(x){return x.p.needs_review}))pb.appendChild(el("div","how",t("tem.onlem_ceviri")));
  }
  var G=A.groups.slice();
  if(G.length){
    var ib=secBox(box,t("tem.gruplar"),G.length);
    var ol=el("ul","klist");
    G.forEach(function(x){
      var li=el("li");li.appendChild(el("b",null,tGrupAd(x.g)));
      if(x.neg)li.appendChild(el("span","fn",t("tem.icermez_beyan")));
      else if(x.band)li.appendChild(el("span","chip",veriS(M.bands[x.band],"t.bant."+x.band)));
      li.appendChild(vEl("div","fn",x.g.about,"t.grup."+x.g.id+".about"));ol.appendChild(li);
    });
    ib.appendChild(ol);
    ib.appendChild(el("div","how it",t("tem.bant_not")));
  }
  var named=A.inci.slice().sort(function(a,b){return (b.fragrance||b.pres?1:0)-(a.fragrance||a.pres?1:0)});
  if(named.length){
    var nb=secBox(box,t("tem.taninan_baslik"),named.length),ul=el("ul","klist");
    named.forEach(function(x){
      var li=el("li");li.appendChild(el("b",null,x.name));
      var fs=x.funcs.filter(function(f){return TFUNC_SKIP.indexOf(f)<0&&norm(f)!==norm(x.name)&&!(x.pres&&f==="Koruyucu")});   // kozmetiğe özgü işlevler ve adın tekrarı gösterilmez
      if(fs.length)li.appendChild(el("span","fn"," · "+fs.map(kIslevAd).join(", ")));
      if(x.how==="benzer")li.appendChild(el("span","fn",t("koz.okunan",{l:x.raw})));
      else if(norm(x.raw)!==norm(x.name))li.appendChild(el("span","fn",t("koz.etikette",{l:x.raw})));
      if(x.fragrance)li.appendChild(el("span","chip",t("koz.ozet.koku")));if(x.pres)li.appendChild(el("span","chip",t("koz.ozet.koruyucu")));if(x.color)li.appendChild(el("span","chip",t("tem.ozet.renk")));
      ul.appendChild(li);
    });
    nb.appendChild(ul);
    nb.appendChild(el("div","how it",t("tem.islev_not")));
  }
  box.appendChild(el("div","how it",t("tem.alt_not")));
  payBar(box,{mode:"tem",A:A,S:S});
}
