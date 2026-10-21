/* Arayüz: sonuç ekranı (özet kartı, gıda sonucu, katkı ve birlikte dikkat kartları), run() (moda göre analiz), örnek metin. Klasik betik;
   arayuz_profil.js'ten sonra. Kozmetik ve temizlik sonucu arayuz_kozmetik.js, arayuz_temizlik.js. */
/* Ülke katmanı (B-05): katkının seçili ülkedeki durumu. Kendi notu olan ülkede (oz.katki_not) satır yok; öteki ülkelerde AB'den farklıysa,
   kısıtlı/iptal/belirsizse ya da kaynak notu varsa "<Ülke>: <durum>" + not + kaynak. */
function ulkeKatkiSatir(UK,x,cok){
  var kk=UK.katki(x.id);if(!kk||ulkeOzellik(UK,"katki_not"))return null;
  var not=ulkeNot(kk.not,DIL.kod),abIzinli=x.eu_status==="listed";
  if(kk.d==="izinli"&&abIzinli&&!not)return null;
  var p=el("div","ln ulkekatki");
  p.appendChild(el("b",null,(cok?x.id+" · ":"")+t("ulke.katki.satir",{ulke:t("ulke.ad."+UK.kod.toLowerCase()),durum:t("ulke.durum."+kk.d)})));
  if(not)p.appendChild(document.createTextNode(" "+not+(/[.!?)]$/.test(not)?"":".")));
  if(UK.kaynak){p.appendChild(document.createTextNode(" "+t("ortak.kaynak")));var a=el("a",null,UK.kaynak.kisa);a.href=UK.kaynak.url;a.target="_blank";a.rel="noopener";p.appendChild(a)}
  return p;
}
function ulkeAdDil(UK){return ulkeOzellik(UK,"ad_dil")||""}
function profileCards(S,metin){return profilKartGida(S,metin==null?$("metin").value:metin,PROF,alName).map(kartEl)}
/* Sonucun en üstündeki özet: kaç maddede uyarı/dikkat var, renk şeridi. Puan değil, yalnızca sayılar.
   ranks: her madde için 3 uyarı, 2 dikkat, 1 doğrulanmadı, 0 özel uyarı yok (koz/tem kendi seviyelerini bu ölçeğe çevirir) */
function ozetKart(tur,ranks){
  var c=[0,0,0,0];ranks.forEach(function(k){c[k]++});
  var d=el("section","ozet");d.setAttribute("aria-label",t("ortak.ozet"));
  d.appendChild(el("div","oz-ust",t("ozet.ust."+tur,{n:ranks.length})));
  var tm=tur==="tem",b=c[3]?["r",t(tm?"ozet.uyari_tem":"ozet.uyari",{n:c[3]})]:c[2]?["y",t(tm?"ozet.dikkat_tem":"ozet.dikkat",{n:c[2]})]:ranks.length?["g",t("ozet.temiz")]:["",t("ozet.madde_yok")];
  d.appendChild(el("div","oz-b "+b[0],b[1]));
  var alt=[];if(c[3]&&c[2])alt.push(t("ozet.say.dikkat",{n:c[2]}));if(c[1])alt.push(t("ozet.say.dogrulanmadi",{n:c[1]}));if(c[0]&&(c[3]||c[2]))alt.push(t("ozet.say.yok",{n:c[0]}));
  if(alt.length)d.appendChild(el("div","oz-alt",alt.join(" · ")));
  if(ranks.length){var sr=el("div","oz-serit");sr.setAttribute("aria-hidden","true");ranks.slice().sort(function(x,y){return y-x}).forEach(function(k){sr.appendChild(el("span",CLS[k]))});d.appendChild(sr)}
  if(typeof hareketSay==="function")hareketSay(d);   // sayılar sıfırdan sayar (js/hareket.js)
  return d;
}
/* Kilo girilmemişse günlük sınır notu sayfada bir kez (her kartta tekrar etmez) */
function kiloNotu(){var a=el("a","kilonot",t("gida.adi.kilo_gir"));a.href="#profil";return a}
/* Maddeleri seviyeye göre gruplar: her grubun küçük başlığı "Uyarı · 3"; kart(r) her madde için kartı üretir */
function gruplu(box,list,rank,kart){
  var g={};list.forEach(function(r){var k=rank(r);(g[k]=g[k]||[]).push(r)});
  Object.keys(g).sort(function(a,b){return b-a}).forEach(function(k){
    box.appendChild(el("h3","grp",LBL(+k)+" · "+dilSayi(g[k].length)));
    g[k].forEach(function(r){box.appendChild(kart(r))});
  });
}
function summaryCard(S,res){
  var d=el("div","res sumbox");d.appendChild(el("div","t",t("ortak.ozet")));
  function row(label,val,cls){ozetSatir(d,label,val,cls)}
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
  // Kartın yüzünde yalnızca ad, durum ve bayraklar (tek satır); etiketler ve günlük sınır dokununca açılan ayrıntı sayfasında
  var pn=el("div","ipanel");pn.hidden=true;
  var bay=[];
  it.flags.forEach(function(f){if((f==="sodium"&&!PROF.salt)||f==="aluminium"||f==="gmo_suspect")return;/* sodyum etiketi yalnızca tuz kısıtlaması seçiliyse */var a=veriS(FLAGS[f]||f,"e.bayrak."+f);bay.push(a);pn.appendChild(el("span","chip",a))});
  if(bay.length)d.appendChild(el("div","ln neden",bay.join(" · ")));
  var us=uretimSinif(r.ids,IDX);   // üretim yolu: gri bilgi etiketi, risk rengini değiştirmez
  if(us){var uc=el("span","chip uret");var ui=el("span","uic");ui.setAttribute("aria-hidden","true");uc.appendChild(ui);uc.appendChild(document.createTextNode(t(URETIM_AD[us])));pn.appendChild(uc)}
  var seenA={};items.forEach(function(x){if(!x.adi)return;var k=JSON.stringify(x.adi);if(seenA[k])return;seenA[k]=1});
  var nA=Object.keys(seenA).length,doneA={};
  items.forEach(function(x){if(!x.adi)return;var k=JSON.stringify(x.adi);if(doneA[k])return;doneA[k]=1;pn.appendChild(adiBlock(x.adi,nA>1||items.length>1&&items.some(function(y){return !y.adi})?x.id:""))});
  var UK=ulkeK();   // seçili ülkenin katmanı (B-05): katkının o ülkedeki durumu öne çıkar; ülke adı kodda yok
  if(UK)items.forEach(function(x){var s=ulkeKatkiSatir(UK,x,items.length>1);if(s)pn.appendChild(s)});
  var same=items.length>1&&items.every(function(x){var kk=UK&&UK.katki(x.id);return ABOUT[x.id]===ABOUT[items[0].id]&&!(kk&&kk.not&&ulkeOzellik(UK,"katki_not"))});
  if(same){var r4=veriMetin(ABOUT[items[0].id]||"","e."+items[0].id+".about"),p4=el("div","ln");p4.appendChild(el("b",null,t("gida.kart.nedir")));p4.appendChild(document.createTextNode(r4.s));pn.appendChild(vIsaret(p4,r4))}
  else items.forEach(function(x){
    var ab=ABOUT[x.id];
    if(items.length>1)pn.appendChild(el("div","ih",x.id+" · "+itAd(x)));
    if(ab){var r1=veriMetin(ab,"e."+x.id+".about"),p1=el("div","ln");p1.appendChild(el("b",null,t("gida.kart.nedir")));p1.appendChild(document.createTextNode(r1.s));pn.appendChild(vIsaret(p1,r1))}
    var kk=UK&&UK.katki(x.id);   // ülkenin resmi listesindeki ad (çevrilmez) ve ülke notu; etiketleri ülkenin özellik anahtarından
    if(kk&&kk.ad&&items.length===1&&ulkeOzellik(UK,"katki_ad")){var p0=el("div","ln");p0.appendChild(el("b",null,t(ulkeOzellik(UK,"katki_ad"))));var tn=el("span",null,kk.ad);tn.lang=ulkeAdDil(UK);p0.appendChild(tn);pn.appendChild(p0)}
    if(kk&&typeof kk.not==="string"&&kk.not&&ulkeOzellik(UK,"katki_not")){var r3=veriMetin(kk.not,"e."+x.id+".tgk_not"),p3=el("div","ln");p3.appendChild(el("b",null,t(ulkeOzellik(UK,"katki_not"))));p3.appendChild(document.createTextNode(r3.s));pn.appendChild(vIsaret(p3,r3))}
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
  var dn=!it.needs_review?null:it.sources&&it.verification!=="partially_checked"?(ulkeOz("izin_dogrulanmadi")||null):it.sources?"gida.kart.kismen_dogrulanmadi":"gida.kart.dogrulanmadi";   // TR izin durumu notu yalnızca Türkiye seçiliyse
  if(dn)pn.appendChild(el("div","how",t(dn)));
  // Ayrıntı alt sayfada açılır: (i) düğmesi ya da kartın kendisine dokunma; her madde için "Ansiklopedide oku"
  pn.hidden=false;pn.className="";
  items.forEach(function(x){var a=el("a","ans",(items.length>1?x.id+" · ":"")+t("gida.kart.ansiklopedi"));a.href="ansiklopedi.html?id="+encodeURIComponent(x.id);pn.appendChild(a)});
  var ttl=items.length===1?items[0].id+" · "+itAd(items[0]):t("gida.kart.olasi",{l:items.map(function(i){return i.id}).join(", ")});
  b.removeAttribute("aria-expanded");b.setAttribute("aria-haspopup","dialog");
  b.onclick=function(e){e.stopPropagation();openSheet(ttl,LBL(r.rank),pn,b)};
  d.classList.add("tap");
  d.addEventListener("click",function(e){if(e.target.closest("button,a"))return;openSheet(ttl,LBL(r.rank),pn,b)});
  d._open=function(ret){openSheet(ttl,LBL(r.rank),pn,ret||b)};   // karşılaştırma ekranından açmak için
  return d;
}
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
  if(!res.length&&!LASTBR.length){
    box.textContent=t("gida.eslesme_yok");
    // Yalnızca besin değeri tablosu okunmuşsa (içerik listesi yok) tablo yine gösterilir
    var tx=$("metin").value;if(BESIN_SOZ&&besinKaynak(tx)){box.textContent="";box.appendChild(el("div","how",t("gida.eslesme_yok")));box.appendChild(besinKart(tx))}
    return;
  }
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
  var E=res.filter(function(r){return !r.isB&&!r.neg});
  box.insertBefore(ozetKart("gida",E.map(function(r){return r.rank})),box.firstChild);
  profileCards(S).forEach(function(c){box.appendChild(c)});
  if(PROF.kilo==null&&E.some(function(r){return r.ids.some(function(id){var a=IDX.byId[id].adi;return a&&a.st==="set"})}))box.appendChild(kiloNotu());
  box.appendChild(summaryCard(S,res));
  box.appendChild(besinKart($("metin").value));   // besin değeri tablosu (js/arayuz_besin.js)
  if(LASTBR.length&&ulkeOz("marka_listesi"))box.appendChild(brandCard(LASTBR));
  comboSection(box,findCombos(COMBO,"gida",comboItemsFood(res,IDX)));
  if(E.length){box.appendChild(el("h2",null,t("gida.katkilar")));gruplu(box,E,function(r){return r.rank},additiveCard)}
  var B=res.filter(function(r){return r.isB&&!r.neg}),notes=B.map(function(r){return IDX.byId[r.ids[0]]}).filter(function(it){return it.note});
  if(B.length){
    var bd=secBox(box,t("gida.diger_icerik"),B.length);
    var seen={};B.forEach(function(r){var it=IDX.byId[r.ids[0]];if(seen[it.id])return;seen[it.id]=1;var l=el("div","ln");l.appendChild(el("b",null,itAd(it)));if(it.note){var rn=veriMetin(it.note,"b."+it.id+".not");l.appendChild(document.createTextNode(": "+rn.s));vIsaret(l,rn)}bd.appendChild(l)});
  }
  box.appendChild(el("div","how it",t("gida.alt_not")));
  box.appendChild(yontemBag());
  payBar(box,{mode:"gida",text:$("metin").value});
}
/* Analiz; ardından barkod kaynağı/katkı kartı (js/arayuz_barkod.js) */
function run(){runIc();if(typeof barkodSonra==="function")barkodSonra();if(typeof rozetSonra==="function")rozetSonra()}
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
$("ornek").onclick=function(){HSCAN=HOCR=true;fotoTemizle();$("metin").value=t("ornek."+(MODE==="koz"?"koz":MODE==="tem"?"tem":"gida"));run()};
