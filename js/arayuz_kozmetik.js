/* Arayüz: kozmetik sonuç ekranı. */
/* ---------- Kozmetik modu ---------- */
var MODE="gida",PTYPE="",KDB=null,KINCI=null,KIDX=null,KLOAD=null;
try{var tu=localStorage.getItem("tur");MODE=tu==="koz"||tu==="tem"?tu:"gida";PTYPE=localStorage.getItem("ktip")||""}catch(e){}
function loadK(){
  if(KIDX)return Promise.resolve(KIDX);
  if(KLOAD)return KLOAD;
  setSt("koz",t("koz.yukleniyor"));
  KLOAD=Promise.all([getJson("data/kozmetik.json"),getJson("data/kozmetik_inci.json").catch(function(){return null})]).then(function(a){
    KDB=a[0];KINCI=a[1];KIDX=buildKIndex(KDB,KINCI);
    setSt("koz",KINCI?t("koz.yuklendi",{n:KDB.entries.length,i:KINCI.items.length}):t("koz.yuklendi_incisiz",{n:KDB.entries.length}));
    return KIDX;
  }).catch(function(e){KLOAD=null;setSt("koz",t("koz.yuklenemedi_st"));throw e});
  return KLOAD;
}
function setMode(m,save,tasi){
  if(m!==MODE&&$("metin").value.trim()&&typeof HMOD!=="undefined")HMOD=tasi?"tasi":"gor";   // yeniden analiz geçmişi bozmasın
  MODE=m;
  ["gida","koz","tem"].forEach(function(x){$("m-"+x).setAttribute("aria-checked",String(m===x))});
  $("ptype").hidden=m!=="koz";
  $("karsla").hidden=!KARS_AYAR.acik;
  $("camtxt").textContent=t("foto.kamera_"+(m==="koz"?"koz":m==="tem"?"tem":"gida"));
  if(save)try{localStorage.setItem("tur",m)}catch(e){}
  ST.textContent=STMSG[m]||t((m==="koz"?"koz":m==="tem"?"tem":"gida")+".yukleniyor");
  if(m==="koz")loadK().then(function(){if($("metin").value.trim())run()},function(){});
  else if(m==="tem")loadT().then(function(){if($("metin").value.trim())run()},function(){});
  else if($("metin").value.trim())run();
}
$("m-gida").onclick=function(){setMode("gida",true)};
$("m-koz").onclick=function(){setMode("koz",true)};
$("m-tem").onclick=function(){setMode("tem",true)};
document.querySelectorAll("#ptype button").forEach(function(b){
  b.onclick=function(){
    PTYPE=PTYPE===b.getAttribute("data-p")?"":b.getAttribute("data-p");
    document.querySelectorAll("#ptype button").forEach(function(x){x.setAttribute("aria-pressed",String(x.getAttribute("data-p")===PTYPE))});
    try{localStorage.setItem("ktip",PTYPE)}catch(e){}
    if(MODE==="koz"&&$("metin").value.trim())run();
  };
  b.setAttribute("aria-pressed",String(b.getAttribute("data-p")===PTYPE));
});
function suggestCard(){
  var d=el("div","res suggest");d.appendChild(el("div","t",t("koz.oneri.baslik")));
  d.appendChild(el("div","ln",t("koz.oneri.metin")));
  var b=el("button",null,t("koz.oneri.dugme"));b.type="button";b.onclick=function(){setMode("koz",true,true);window.scrollTo(0,0)};d.appendChild(b);
  return d;
}
var KCLS={red:"r",orange:"o",yellow:"y",info:"g n"},KLBL={red:"koz.seviye.red",orange:"risk.uyari",yellow:"risk.dikkat",info:"risk.yok"};   // çeviri anahtarları
function kChips(r){
  var out=[],seen={},F=KIDX.flags;
  r.reg.forEach(function(e){e.flags.forEach(function(f){if(!seen[f]&&f!=="cmr_ban"){seen[f]=1;out.push(veriS(F[f]||f,"k.bayrak."+f))}})});
  r.iflags.forEach(function(f){if(!seen[f]){seen[f]=1;out.push(veriS(F[f]||f,"k.bayrak."+f))}});
  if(r.nano&&!seen.nano)out.push(t("koz.nano"));
  (r.k3||[]).forEach(function(w){var L=KIDX.watchLists[w.list],c=L?L.chip:w.list;if(L&&L.kind==="comedo"&&PTYPE==="rinse")return;if(!seen["k3:"+c]){seen["k3:"+c]=1;out.push(veriS(c,"k.liste."+w.list+".cip"))}});
  return out;
}
/* K3 tarih ifadesi: "2027-01-01" -> "1 Ocak 2027 tarihinden itibaren yasak" / "...beri yasak"; "2019" -> "Listeye giriş: 2019" (tarih dile göre Intl ile) */
function k3When(w,kind){
  var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(w.date||"");
  var ym=/^(\d{4})-(\d{2})$/.exec(w.date||"");
  if(ym)return t("koz.k3.tarih",{d:dilTarih(new Date(+ym[1],+ym[2]-1,1).getTime(),"ayyil")});
  if(!m)return w.date?t("koz.k3.giris",{d:w.date}):"";
  var d=dilTarih(new Date(+m[1],+m[2]-1,+m[3]).getTime(),"gun"),today=new Date().toISOString().slice(0,10);
  if(kind!=="ban")return t("koz.k3.tarih",{d:d});
  return w.date>today?t("koz.k3.yasak_olacak",{d:d}):t("koz.k3.yasak_beri",{d:d});
}
function kCard(r){
  var d=el("div","res "+KCLS[r.level]),top=el("div","hd");
  top.appendChild(el("div","t",r.name));
  var b=el("button","info","i");b.type="button";b.setAttribute("aria-label",t("ortak.hakkinda",{ad:r.name}));b.setAttribute("aria-expanded","false");
  top.appendChild(b);d.appendChild(top);
  d.appendChild(el("div","how",t(r.level==="red"&&!r.reg.some(function(e){return e.annex==="II"})?"koz.seviye.kanserojen":KLBL[r.level])+" · "+(r.how==="benzer"?t("ortak.benzer",{l:r.raw}):t("ortak.isimle"))+(r.may?t("ortak.icerebilir_bolum"):"")));
  kChips(r).forEach(function(c){d.appendChild(el("span","chip",c))});
  r.notes.forEach(function(n){d.appendChild(el("div","ln",kNot(n)))});
  var pn=el("div","ipanel");pn.hidden=true;
  // txt: düz metin ya da veriMetin sonucu ({s, cevrilmedi}); çevrilmemiş veri metnine işaret eklenir
  function line(lbl,txt){if(!txt||typeof txt==="object"&&!txt.s)return;var p=el("div","ln");p.appendChild(el("b",null,lbl+" "));p.appendChild(document.createTextNode(typeof txt==="object"?txt.s:txt));pn.appendChild(typeof txt==="object"?vIsaret(p,txt):p)}
  line(t("koz.kart.islevi"),r.funcs.map(kIslevAd).join(", "));
  var seen={};
  r.reg.forEach(function(e){
    if(seen[e.id])return;seen[e.id]=1;
    if(r.reg.length>1)pn.appendChild(el("div","ih",t("koz.kart.ek",{ek:e.annex})+(e.ref&&e.ref!=="?"?t("koz.kart.giris",{n:e.ref}):"")));
    line(t("koz.kart.degerlendirme"),kGerekceMetin(e));
    line(t("koz.kart.not"),veriMetin(e.note_tr,"k."+e.id+".not"));
    (e.updates||[]).forEach(function(u,i){line(t("koz.kart.degisiklik",{r:u.regulation+(u.applies_from?", "+u.applies_from:"")}),veriMetin(u.note_tr,"k."+e.id+".degisiklik."+i))});
    var cond=[e.product_type&&t("koz.kart.urun_tipi",{l:e.product_type}),e.max&&t("koz.kart.ust_sinir",{l:e.max}),e.conditions_en].filter(Boolean).join(" · ");
    if(cond)pn.appendChild(el("div","how",t("koz.kart.ab_kosulu",{l:cond})));
    pn.appendChild(el("div","how",t("koz.kart.kaynak",{r:e.regulation||"(EC) 1223/2009"})+(e.applies_from?t("koz.kart.uygulama",{d:e.applies_from}):"")));
    var trs=[e.tr].concat((e.updates||[]).map(function(u){return u.tr})).filter(Boolean)[0];   // AB değişikliğinin Türkiye'deki durumu
    if(trs&&KIDX.trText[trs]&&ulke()==="TR")pn.appendChild(vEl("div","how",KIDX.trText[trs],"k.tr_durum."+trs));   // Türkiye'deki durum (ülke katmanı)
    if(e.needs_review)pn.appendChild(el("div","how",t("koz.kart.kayit_dogrulanmadi")));
  });
  r.iflags.forEach(function(f){line(t("koz.kart.degerlendirme"),veriMetin(KIDX.flagReasons[f],"k.bayrak_neden."+f))});
  if(r.k3&&r.k3.length){
    pn.appendChild(el("div","ih",t("koz.kart.diger_listeler")));
    r.k3.forEach(function(w){
      var L=KIDX.watchLists[w.list]||{label:w.list,text:""},lt=veriMetin(L.text,"k.liste."+w.list+".metin"),wn=w.note_tr?veriMetin(w.note_tr,"k.izle."+w.list+"."+(w.inci||[])[0]):null;
      line(veriS(L.label,"k.liste."+w.list+".ad")+":",{s:lt.s+(wn?" "+wn.s:""),cevrilmedi:lt.cevrilmedi||!!(wn&&wn.cevrilmedi),kod:DIL_KAYNAK});
      var src=el("div","how",[k3When(w,L.kind),veriS(w.basis||"",null)].filter(Boolean).join(" · ")+" · ");
      if(w.source){var a=el("a",null,t("ortak.kaynak_bag"));a.href=w.source;a.target="_blank";a.rel="noopener";src.appendChild(a)}
      pn.appendChild(src);
      if(w.needs_review)pn.appendChild(el("div","how",t("koz.kart.bilgi_dogrulanmadi")));
    });
  }
  d.appendChild(pn);
  b.onclick=function(){pn.hidden=!pn.hidden;b.setAttribute("aria-expanded",pn.hidden?"false":"true");b.classList.toggle("on",!pn.hidden)};
  return d;
}
function kSummaryCard(S){
  var d=el("div","res sumbox");d.appendChild(el("div","t",t("ortak.ozet")));
  function row(label,val,cls){var r=el("div","srow");r.appendChild(el("span","sl",label));r.appendChild(el("span","sv"+(cls?" "+cls:""),val));d.appendChild(r)}
  function lst(a){return a.length?t("ortak.say_liste",{n:a.length,l:a.join(", ")}):t("ortak.bulunamadi")}
  row(t("koz.ozet.bilesen"),t("koz.ozet.tanindi",{f:S.found,n:S.total})+(S.unknown.length?t("koz.ozet.taninmadi",{n:S.unknown.length}):""));
  row(t("koz.seviye.red"),lst(S.euBan),S.euBan.length?"r":"");
  if(S.carc.length)row(t("koz.ozet.kanserojen"),lst(S.carc),"r");
  var w=S.orange.concat(S.yellow);
  row(t("koz.ozet.uyari_dikkat"),lst(w),S.orange.length?"o":S.yellow.length?"y":"");
  row(t("koz.ozet.koku"),lst(S.fragrance),"");
  row(t("koz.ozet.parfum"),S.parfum?t("koz.ozet.parfum_var"):t("koz.ozet.yazmiyor"));
  row(t("koz.ozet.koruyucu"),lst(S.preservative));
  if(S.formaldehyde.length)row(t("koz.ozet.formaldehit"),lst(S.formaldehyde),"y");
  if(S.pfas.length)row(t("koz.ozet.pfas"),lst(S.pfas),"o");
  if(S.ban.length)row(t("koz.ozet.baska_ulke"),lst(S.ban),"o");
  if(S.ed.length)row(t("koz.ozet.endokrin"),lst(S.ed),"y");
  if(S.comedo.length&&PTYPE!=="rinse")row(t("koz.ozet.komedo"),lst(S.comedo),"");
  if(S.fuzzy.length)d.appendChild(el("div","how",t("koz.ozet.benzer")));
  return d;
}
function kProfileCards(S,res){
  var out=[],j=function(a){return a.join(", ")};
  if(PROF.koku){
    if(S.fragrance.length)out.push(card("r",t("koz.prof.koku_var"),[j(S.fragrance)].concat(S.parfum?[t("koz.prof.koku_parfum")]:[])));
    else if(S.parfum)out.push(card("y",t("koz.prof.parfum"),[t("koz.prof.parfum_not")]));
    else out.push(card("g",t("koz.prof.koku_yok"),[t("ortak.onay_degil_okuma")]));
  }
  if(PROF.vegan){
    var no=S.nonVeg.concat(S.nonVegan);
    if(no.length)out.push(card("r",t("gida.prof.vegan_degil"),[j(no)].concat(S.veganUnsure.length?[t("gida.prof.kaynak_belirsiz",{l:j(S.veganUnsure)})]:[])));
    else if(S.veganUnsure.length)out.push(card("y",t("gida.prof.vegan_belirsiz"),[t("koz.prof.vegan_belirsiz_l",{l:j(S.veganUnsure)})]));
    else out.push(card("g",t("koz.prof.hayvansal_yok"),[t("ortak.onay_degil_vegan")]));
  }
  if(PROF.veg){
    if(S.nonVeg.length)out.push(card("r",t("gida.prof.vejetaryen_degil"),[t("koz.prof.kesim_l",{l:j(S.nonVeg)})]));
    else out.push(card("g",t("koz.prof.kesim_yok"),[t("ortak.onay_degil_etiket")]));
  }
  // Endokrin bozucu şüphesi: hamilelik ve küçük çocuklar için ayrı kart (yalnızca madde bulunursa)
  if((PROF.preg||PROF.baby||PROF.child||PTYPE==="baby")&&(S.ed.length||S.child.length)){
    var el2=[];
    if(S.ed.length)el2.push(t("koz.prof.endokrin_l",{l:j(S.ed)}));
    if(S.child.length&&(PROF.baby||PROF.child||PTYPE==="baby"))el2.push(t("koz.prof.danimarka",{l:j(S.child)}));
    el2.push(PROF.preg?t("koz.prof.hamile_doktor"):t("koz.prof.cocuk_doktor"));
    out.push(card("y",t("koz.ozet.endokrin"),el2));
  }
  if(PROF.preg){
    if(S.vitA.length)out.push(card("y",t("koz.prof.hamile"),[t("koz.prof.vita",{l:j(S.vitA)})]));
    else out.push(card("g",t("gida.yasam.hamile_yok"),[t("koz.prof.hamile_onay")]));
  }
  if(PROF.baby||PROF.child||PTYPE==="baby"){
    var rows=[];res.forEach(function(r){var a=null;r.reg.forEach(function(e){if(e.kids_under&&(a===null||e.kids_under<a))a=e.kids_under});if(a)rows.push(t("koz.prof.cocuk_satir",{ad:r.name,n:a}))});
    if(rows.length)out.push(card("y",t("koz.prof.cocuk"),rows.concat([t("koz.prof.cocuk_not")])));
    else out.push(card("g",t("koz.prof.cocuk_yok"),[t("ortak.onay_degil_etiket")]));
  }
  return out;
}
/* Gözenek tıkayıcılık (komedojenite) bilgi notu: skor yok, renk yok; ayrıntı (i) düğmesinde. Durulanan üründe gösterilmez. */
function comedoCard(res){
  var L=KIDX.watchLists.komedo||{text:""},hits=[];
  res.forEach(function(r){if(!r.found||r.may)return;(r.k3||[]).forEach(function(w){if(w.list==="komedo")hits.push({r:r,w:w})})});
  var d=el("div","res u"),top=el("div","hd");
  top.appendChild(el("div","t",t("koz.komedo.baslik")));
  var b=el("button","info","i");b.type="button";b.setAttribute("aria-label",t("koz.komedo.hakkinda"));b.setAttribute("aria-expanded","false");
  top.appendChild(b);d.appendChild(top);
  d.appendChild(el("div","ln",hits.map(function(h){return h.r.name}).filter(function(x,i,a){return a.indexOf(x)===i}).join(", ")));
  d.appendChild(el("div","how",t("koz.komedo.bilgi")));
  var pn=el("div","ipanel");pn.hidden=true;
  pn.appendChild(vEl("div","ln",L.text,"k.liste.komedo.metin"));
  hits.forEach(function(h){var rn=veriMetin(h.w.note_tr||"","k.izle.komedo."+(h.w.inci||[])[0]),p=el("div","ln");p.appendChild(el("b",null,h.r.name+": "));p.appendChild(document.createTextNode(rn.s));pn.appendChild(vIsaret(p,rn))});
  pn.appendChild(el("div","how",t("koz.komedo.not")));
  var src=el("div","how",t("koz.komedo.kaynak"));
  var a=el("a",null,t("koz.komedo.makale"));a.href="https://library.scconline.org/v040n06/13";a.target="_blank";a.rel="noopener";src.appendChild(a);pn.appendChild(src);
  d.appendChild(pn);
  b.onclick=function(){pn.hidden=!pn.hidden;b.setAttribute("aria-expanded",pn.hidden?"false":"true");b.classList.toggle("on",!pn.hidden)};
  return d;
}
function renderK(res){
  var box=$("sonuc");box.textContent="";
  if(!res.length){box.textContent=t("koz.liste_yok");return}
  var S=summarizeK(res,KIDX);
  if(S.cancer.length){
    var cd=el("div","res prof r"),hd=el("div","hd"),b=el("button","info sm","i");b.type="button";b.setAttribute("aria-label",t("kanser.hakkinda"));
    hd.appendChild(el("div","t",t("kanser.baslik")));hd.appendChild(b);cd.appendChild(hd);
    cd.appendChild(el("div","ln",S.cancer.join(", ")));
    var ipan=el("div","ipanel");ipan.hidden=true;
    ipan.appendChild(el("div","how",t("kanser.koz_not")));
    cd.appendChild(ipan);b.onclick=function(){ipan.hidden=!ipan.hidden;b.setAttribute("aria-expanded",ipan.hidden?"false":"true");b.classList.toggle("on",!ipan.hidden)};
    box.appendChild(cd);
  }
  kProfileCards(S,res).forEach(function(c){box.appendChild(c)});
  box.appendChild(kSummaryCard(S));
  if(S.comedo.length&&PTYPE!=="rinse")box.appendChild(comedoCard(res));
  comboSection(box,findCombos(COMBO,"koz",comboItemsK(res)));
  var W=res.filter(function(r){return r.found&&r.rank>0}).sort(function(a,b){return b.rank-a.rank||a.pos-b.pos});
  if(W.length){box.appendChild(el("h2",null,t("koz.dikkat_baslik")));W.forEach(function(r){box.appendChild(kCard(r))})}
  var tb=secBox(box,t("koz.tum"),res.length);
  var ol=el("ol","klist");
  res.forEach(function(r){
    var li=el("li");
    if(!r.found){li.appendChild(document.createTextNode(r.raw+" "));li.appendChild(el("span","fn",t("koz.taninmadi")));ol.appendChild(li);return}
    var b=el("b",null,r.name);li.appendChild(b);
    if(r.funcs.length)li.appendChild(el("span","fn"," · "+r.funcs.map(kIslevAd).join(", ")));
    if(r.how==="benzer")li.appendChild(el("span","fn",t("koz.okunan",{l:r.raw})));
    else if(norm(r.raw).indexOf(norm(r.name))<0)li.appendChild(el("span","fn",t("koz.etikette",{l:r.raw})));
    if(r.may)li.appendChild(el("span","fn",t("koz.icerebilir")));
    kChips(r).forEach(function(c){li.appendChild(el("span","chip",c))});
    ol.appendChild(li);
  });
  tb.appendChild(ol);
  if(res.extra&&res.extra.length){
    var dx=el("details","gz");dx.appendChild(el("summary",null,t("koz.disinda",{n:res.extra.length})));
    var ul=el("ul");res.extra.forEach(function(x){ul.appendChild(el("li",null,x))});dx.appendChild(ul);
    dx.appendChild(el("div","how",t("koz.disinda_not")));
    tb.appendChild(dx);
  }
  if(S.parfum)box.appendChild(el("div","ln nt",t("koz.parfum_not")));
  box.appendChild(el("div","how it",t("koz.alt_not",{tr:ulke()==="TR"?t("ulke.tr.koz_uyum"):""})));
  payBar(box,{mode:"koz",res:res,S:S});
}
