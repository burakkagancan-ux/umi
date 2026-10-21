/* Arayüz: aynı türden (gıda, kozmetik ya da temizlik) iki ürünü karşılaştırma ve tarama geçmişi (localStorage "taramalar" {id,t,mode,name,text,oz}; Etiket Oku'daki Son Okutulanlar da bunu gösterir, js/arayuz_son.js). Saf mantık js/karsilastir.js, ayarlar js/karsilastir_ayar.js. */
var HCUR=null,HSCAN=true,HOCR=false,CMP_IDS=null;   // HCUR: ekrandaki taramanın kaydı; HSCAN: sonraki analiz yeni kayıt açar; HOCR: metin fotoğraftan/örnekten geldi
// Mod değişince kutudaki metin yeni modda yeniden analiz edilir. HMOD: "gor" sekmeyle geçiş (geçmişe yazılmaz, tarama kendi türünde kalır),
// "tasi" öneri kartıyla geçiş ("Kozmetik olarak analiz et": ekrandaki tarama yeni türe taşınır). Kullanıcı metni değiştirince ya da yeni tarama gelince sıfırlanır.
var HMOD=null;
/* HGOR: ekranda yeniden gösterilen kayıt {mode, text} (Son Okutulanlar, kayıtlı ürün, sekmeyle tür değişimi). Aynı tür + metin analizleri geçmişe ve aylık özete
   yazılmaz; yalnızca ilk histSave'i değil, veri yüklenince gelen ikinci run'ı da kapsar (bozma turu 21.10.2026: HMOD tek kullanımlıktı, bekleyen
   loadK().then(run) "elle düzeltme" sayılıp kaydı başa taşıyor, aylık özete yazıyordu). Kullanıcı metni değiştirince ya da yeni tarama gelince sıfırlanır. */
var HGOR=null;
/* Geçersiz kayıtlar (bozuk veri, eski sürüm) okurken atılır: tek bozuk kayıt açılışı ve geçmişi kullanan her işi durdurmasın (bozma turu 21.10.2026) */
function histLoad(){return depoDizi("taramalar").filter(histGecerli)}
function histGecerli(x){return !!x&&typeof x==="object"&&typeof x.id==="string"&&typeof x.text==="string"&&typeof x.t==="number"&&isFinite(x.t)&&(x.name==null||typeof x.name==="string")}
function histStore(a){depoYaz("taramalar",a)}
/* Kayıtlı ürünler de karşılaştırılabilir: kimlik geçmişte yoksa kayıtlarda aranır (js/arayuz_kayit.js) */
function histGet(id){return histLoad().filter(function(x){return x.id===id})[0]||(typeof kayitGet==="function"?kayitGet(id):null)}
function histRename(id,name){var a=histLoad();a.forEach(function(x){if(x.id===id)x.name=name});histStore(a);
  if(typeof kayitLoad==="function"){var k=kayitLoad();if(k.some(function(x){return x.id===id})){k.forEach(function(x){if(x.id===id)x.name=name});kayitStore(k)}}}
/* Analizden sonra çağrılır (mode: gida/koz/tem; karşılaştırma ekrandaki türün kayıtlarını kullanır, paylaşım kartı adı ve sırayı buradan alır). Fotoğraf/örnek yeni kayıt açar; elle düzeltme aynı kaydı günceller. */
function histSave(text,mode){
  if(!KARS_AYAR.acik)return;
  mode=mode||"gida";
  var tx=(text||"").trim(),a=histLoad(),scan=HSCAN,hm=HMOD;
  if(!tx)return;
  HSCAN=false;HOCR=false;HMOD=null;
  if(scan)HGOR=null;
  if(!scan&&hm==="gor"){HGOR={mode:mode,text:tx};return}
  if(!scan&&HGOR&&HGOR.mode===mode&&HGOR.text===tx)return;
  if(!scan&&hm==="tasi"&&HCUR){   // ekrandaki tarama yeni türe taşınır; o türde aynı metin varsa eski kayıt silinir
    var mv=a.filter(function(x){return x.id===HCUR})[0],dup=a.filter(function(x){return x.mode===mode&&x.text===tx})[0];
    if(mv&&dup&&dup.id!==mv.id){a=a.filter(function(x){return x.id!==mv.id});HCUR=dup.id;histStore(a);
      if(typeof aylikSilYaz==="function")aylikSilYaz(mv.id);histAylik(dup.id,tx,histUrun(mode,tx));return}
    if(mv){var Pm=histUrun(mode,tx);mv.mode=mode;mv.text=tx;mv.oz=Pm?kayitOzet(Pm):null;histStore(a);histAylik(mv.id,tx,Pm);return}
  }
  var same=a.filter(function(x){return x.mode===mode&&x.text===tx})[0],cur=!scan&&HCUR?a.filter(function(x){return x.id===HCUR&&x.mode===mode})[0]:null,e;
  if(same)e=same;
  else if(cur){e=cur;e.text=tx}
  else e={id:"h"+Date.now(),t:Date.now(),mode:mode,name:histName(a),text:tx};
  var P=histUrun(mode,tx);
  e.oz=P?kayitOzet(P):e.oz||null;
  a=histAdd(a.filter(function(x){return x.id!==e.id}),e,KARS_AYAR.gecmisBoyut);
  histStore(a);HCUR=e.id;
  histAylik(e.id,tx,P);
}
/* Ekrandaki ürünün modeli (js/degerlendirme.js); oz: uyarı/dikkat özeti (js/kayit.js kayitOzet; Son Okutulanlar listesi veri yüklemeden gösterir).
   Veri yüklü değilse null */
function histUrun(mode,tx){try{return karsReady(mode)?karsProduct({mode:mode,text:tx,name:""}):null}catch(e){return null}}
/* Aylık Özetim (U-09, js/arayuz_aylik.js): "Örnek metin dene"nin metni (yüklü her dilde, değiştirilmemiş) sayılmaz; değiştirilince kullanıcının metni sayılır */
function histAylik(id,tx,P){if(typeof aylikTaramaYaz==="function"&&!histOrnek(tx))aylikTaramaYaz(id,P)}
function histOrnek(tx){for(var k in DIL.sozluk){var s=DIL.sozluk[k]||{};if(["gida","koz","tem"].some(function(m){return (s["ornek."+m]||"").trim()===tx}))return true}return false}
/* Türe göre karşılaştırma özeti; liste yüklenmemişse null */
var KARS_TUR={gida:"gida",koz:"koz",tem:"tem"};   // çeviri anahtarı ekleri (kars.az_*, kars.yukleniyor_*, kars.baslik_*)
function karsReady(mode){return degHazir(mode,degBaglam())}
function karsProduct(e){return degerlendir(e.mode,e.text,degBaglam(),PROF,e.name)}
/* Fotoğraf düğmelerinin altındaki düğme: ekrandaki türün son taramalarından iki ürün seçtirir */
function karsOpen(pre,ret){
  if(!KARS_AYAR.acik)return;
  var mode=MODE||"gida",list=histLoad().filter(function(x){return (x.mode||"gida")===mode});
  if(typeof kayitLoad==="function")kayitLoad().forEach(function(k){   // kayıtlı ürünler de listede; aynı metinli tarama yerine kayıtlı ad görünür
    if(k.mode!==mode)return;var h=list.filter(function(x){return x.text===k.text})[0];
    if(h){list[list.indexOf(h)]=k;if(pre===h.id)pre=k.id}else list.push(k);
  });
  if(list.length<2){ST.textContent=t("kars.az_"+KARS_TUR[mode]);return}
  if(!karsReady(mode)){ST.textContent=t("kars.yukleniyor_"+KARS_TUR[mode]);return}
  var sel=pre&&list.some(function(x){return x.id===pre})?[pre]:[],body=el("div","kpick"),btns={};
  var cnt=el("div","how"),go=el("button",null,t("kars.dugme"));go.type="button";
  function upd(){
    list.forEach(function(x){btns[x.id].setAttribute("aria-pressed",String(sel.indexOf(x.id)>=0))});
    cnt.textContent=t("kars.secildi",{n:sel.length});go.disabled=sel.length!==2;
  }
  body.appendChild(el("h3",null,t("kars.son_taramalar")));
  list.forEach(function(x){
    var b=el("button","kitem");b.type="button";btns[x.id]=b;
    b.appendChild(el("span","kin",x.name));if(/^k/.test(x.id))b.appendChild(el("span","chip",t("kars.kayitli")));b.appendChild(el("span","kis",x.text.replace(/\s+/g," ").slice(0,70)));
    b.onclick=function(){var i=sel.indexOf(x.id);if(i>=0)sel.splice(i,1);else{sel.push(x.id);if(sel.length>2)sel.shift()}upd()};
    body.appendChild(b);
  });
  body.appendChild(cnt);
  go.onclick=function(){if(sel.length!==2)return;var p=sel.slice();closeSheet();showCompare(p[0],p[1])};
  body.appendChild(go);
  var cl=el("button","alt kclr",t("kars.temizle"));cl.type="button";
  cl.onclick=function(){histStore([]);HCUR=null;closeSheet();ST.textContent=t("kars.silindi");if(typeof sonCiz==="function")sonCiz()};
  body.appendChild(cl);
  body.appendChild(el("div","how",t("kars.gizlilik",{n:KARS_AYAR.gecmisBoyut})));
  upd();
  openSheet(t("kars.dugme"),t("kars.iki_urun"),body,ret);
}
/* Karşılaştırma ekranı */
/* Simgeler sonuç ekranı ve ansiklopediyle aynı: yeşil onay yalnızca doğal kaynaklı uyarısız maddede (dogal), diğer uyarısızlar ve "özel uyarı yok" sayısı gri tire */
var CMP_ICON=["n","u","y","r"];
function cmpIcon(rank,dogal){var s=el("span","ic "+(rank===0&&dogal?"g":CMP_ICON[rank]));s.setAttribute("aria-hidden","true");return s}
function showCompare(ida,idb){
  var ea=histGet(ida),eb=histGet(idb);if(!ea||!eb||ea.mode!==eb.mode||!karsReady(ea.mode||"gida"))return;
  var mode=ea.mode||"gida";
  if((eb.t||0)<(ea.t||0)){var sw=ea;ea=eb;eb=sw;ida=ea.id;idb=eb.id}   // önce taranan (küçük numaralı) solda; ad değişse de kayıt zamanı aynı kalır
  CMP_IDS=[ida,idb];
  var A=karsProduct(ea),B=karsProduct(eb),D=cmpDecide(A,B,KARS_AYAR),F=cmpDiff(A,B);
  var box=$("kars");box.textContent="";
  var bk=el("button","alt kback",t("kars.geri"));bk.type="button";bk.onclick=closeCompare;box.appendChild(bk);
  box.appendChild(el("h2",null,t("kars.baslik_"+KARS_TUR[mode])));
  // 1) İki sütun: ad + risk özeti
  var hd=el("div","kcols");
  [[A,ea],[B,eb]].forEach(function(pe,i){
    var P=pe[0],c=el("div","kcol kc"+(i+1));
    var inp=document.createElement("input");inp.type="text";inp.className="kn";inp.value=P.name;inp.maxLength=40;inp.setAttribute("aria-label",t("kars.urun_adi"));
    inp.onchange=function(){var v=inp.value.trim();if(v){histRename(pe[1].id,v);showCompare(ida,idb)}else inp.value=P.name};
    c.appendChild(inp);
    var cn=el("div","kcnt");
    [[0,"kars.say.yok"],[2,"kars.say.dikkat"],[3,"kars.say.uyari"],[1,"kars.say.dogrulanmadi"]].forEach(function(x){
      if(x[0]===1&&!P.counts[1])return;
      var s=el("span","kc");s.appendChild(cmpIcon(x[0]));s.appendChild(document.createTextNode(t(x[1],{n:P.counts[x[0]]})));cn.appendChild(s);
    });
    c.appendChild(cn);hd.appendChild(c);
  });
  box.appendChild(hd);
  // 2) Karar kartı
  var dc=el("div","res kdec "+(D.winner?"g":D.kind==="benzer"?"u":"y"));
  dc.appendChild(el("div","t",D.title));if(D.reason)dc.appendChild(el("div","ln",D.reason));
  dc.appendChild(el("div","how",t(mode==="tem"?"kars.dayanak_tem":"kars.dayanak")));
  box.appendChild(dc);
  // 3) Satır satır
  // Üstte iki ürünün adı (kaydırınca yapışık kalır, sütunlar renkle eşleşir); iki değer farklıysa satır belirgin (.fark)
  var tb=el("div","ktab"),th=el("div","kth");
  [A,B].forEach(function(P,i){th.appendChild(el("div","khd kc"+(i+1),P.name))});tb.appendChild(th);
  function tr(label,fa,fb){
    var kl=el("div","kl",label),cs=[fa(A),fb?fb(B):fa(B)].map(function(v,i){var c=el("div","kv kc"+(i+1));if(typeof v==="string")c.textContent=v;else c.appendChild(v);return c});
    if(cs[0].textContent!==cs[1].textContent){kl.classList.add("fark");kl.setAttribute("data-fark",t("kars.farkli"));cs.forEach(function(c){c.classList.add("fark")})}
    tb.appendChild(kl);cs.forEach(function(c){tb.appendChild(c)});
  }
  var lst=function(a){return a.length?t("ortak.say_liste",{n:a.length,l:a.join(", ")}):t("ortak.bulunamadi")};
  tr(t(mode==="tem"?"kars.satir.en_riskli_tem":"kars.satir.en_riskli"),function(P){
    if(!P.top.length)return t("risk.yok");
    var f=document.createDocumentFragment();f.appendChild(cmpIcon(P.maxRank));f.appendChild(document.createTextNode(P.top.map(function(x){return x.name}).join(", ")));return f});
  tr(t(mode==="tem"?"kars.satir.dikkat_tem":"kars.satir.dikkat"),function(P){return String(P.yellow)});
  if(mode==="koz"){
    tr(t("koz.seviye.red"),function(P){return lst(P.S.euBan)});
    tr(t("koz.ozet.kanserojen"),function(P){return lst(P.S.carc)});
    tr(t("koz.ozet.baska_ulke"),function(P){return lst(P.S.ban)});
    tr(t("koz.ozet.koku"),function(P){return lst(P.S.fragrance)});
    tr(t("koz.ozet.parfum"),function(P){return P.S.parfum?t("ortak.var"):t("koz.ozet.yazmiyor")});
    tr(t("koz.ozet.koruyucu"),function(P){return lst(P.S.preservative)});
    tr(t("koz.ozet.formaldehit"),function(P){return lst(P.S.formaldehyde)});
    tr(t("koz.ozet.endokrin"),function(P){return lst(P.S.ed)});
    tr(t("profil.secenek.vegan"),function(P){var no=P.S.nonVeg.concat(P.S.nonVegan);return no.length?t("gida.prof.vegan_degil"):P.S.veganUnsure.length?t("kars.satir.belirsiz_bilesen"):t("koz.prof.hayvansal_yok")});
    tr(t("kars.satir.taninan_bilesen"),function(P){return P.unknown.total?P.unknown.found+"/"+P.unknown.total:"—"});
  }
  if(mode==="tem"){
    tr(t("kars.satir.sozcuk"),function(P){return P.A.signal==="tehlike"?t("kars.satir.tehlike_buyuk"):P.A.signal==="dikkat"?t("kars.satir.dikkat_buyuk"):t("tem.ozet.okunmadi")});
    tr(t("kars.satir.ciddi"),function(P){return lst(P.S.red)});
    tr(t("kars.satir.karistirma"),function(P){return P.S.mix?t("ortak.var"):t("ortak.bulunamadi")});
    tr(t("kars.satir.solunum"),function(P){return P.S.resp.length?P.S.resp.join(", "):P.S.enzyme?t("kars.satir.enzim"):t("ortak.bulunamadi")});
    tr(t("koz.ozet.koku"),function(P){return lst(P.S.fragrance)});
    tr(t("koz.ozet.koruyucu"),function(P){return lst(P.S.pres)});
    tr(t("kars.satir.kapsul"),function(P){return P.A.capsule?t("ortak.evet"):t("ortak.hayir")});
  }
  if(mode==="gida"){
  tr(t("profil.alerjenler"),function(P){var a=P.allergen;return a.yes.length||a.may.length?(a.yes.length?t("ortak.icerir_l",{l:a.yes.join(", ")}):"")+(a.yes.length&&a.may.length?" · ":"")+(a.may.length?t("ortak.icerebilir_l",{l:a.may.join(", ")}):""):t("ortak.bulunamadi")});
  tr(t("kars.satir.gluten"),function(P){return t({var:"kars.satir.icerir",icerebilir:"kars.satir.icerebilir",yok:"ortak.bulunamadi"}[P.gluten])});
  tr(t("profil.secenek.vegan"),function(P){return t({degil:"gida.prof.vegan_degil",belirsiz:"kars.satir.belirsiz_madde",yok:"gida.prof.hayvansal_yok"}[P.vegan])});
  tr(t("gida.ozet.palm"),function(P){return P.palm.length?t("ortak.var"):t("ortak.bulunamadi")});
  tr(t("kars.satir.seker"),function(P){return P.sugar.length?t("ortak.say_liste",{n:P.sugar.length,l:P.sugar.join(", ")}):t("ortak.bulunamadi")});
  tr(t("gida.ozet.uretim"),function(P){return uretimMetin(P.uretim)||t("kars.satir.uretim_yok")});
  karsBesin(A,B,tr);
  tr(t("kars.satir.taninan_icerik"),function(P){return P.unknown.total?P.unknown.found+"/"+P.unknown.total:"—"});
  }
  box.appendChild(tb);
  // 4) Madde farkları
  box.appendChild(el("h2",null,t(mode==="tem"?"kars.fark_tem":"kars.fark")));
  var g2=el("div","kcols kdiff");
  g2.appendChild(diffList(t("kars.sadece",{ad:A.name}),F.onlyA,A,"kc1"));g2.appendChild(diffList(t("kars.sadece",{ad:B.name}),F.onlyB,B,"kc2"));
  box.appendChild(g2);box.appendChild(diffList(t("kars.ikisinde"),F.both,A,"kc0"));
  // 5) Kişisel uyarılar
  box.appendChild(el("h2",null,t("kars.kisisel")));
  var g3=el("div","kcols kpers");
  [A,B].forEach(function(P,i){
    var c=el("div","kcol kc"+(i+1));c.appendChild(el("h3",null,P.name));
    var cards=mode==="koz"?kProfileCards(P.S,P.res,P.text):mode==="tem"?tProfileCards(P.S,P.A,P.text):profileCards(P.S,P.text);
    if(!cards.length)c.appendChild(el("div","mut",t("kars.kisisel_bos")));
    cards.forEach(function(x){c.appendChild(x)});g3.appendChild(c);
  });
  box.appendChild(g3);
  var ch=el("button","alt",t("kars.baska"));ch.type="button";
  ch.onclick=function(){karsOpen(ida,ch)};box.appendChild(el("div","row")).appendChild(ch);
  document.body.classList.add("mode-kars");box.hidden=false;window.scrollTo(0,0);bk.focus();
}
/* Besin değerleri (A-02): iki üründen birinde tablo varsa birim satırı + dört satır (değer ve düzey). Renk gösterilemeyen tablo (şüpheli,
   birim bilinmiyor) değersiz yazılır; karar (cmpDecide) besin değerlerini kullanmaz: madde seviyelerine ve profile dayanır. */
function karsBesin(A,B,tr){
  if(typeof besinKaynak!=="function")return;
  [A,B].forEach(function(P){var K=besinKaynak(P.text);P.besinVar=!!K;P.besin=K?besinOzet(K.k):null});
  if(!A.besinVar&&!B.besinVar)return;
  tr(t("besin.baslik"),function(P){return P.besin?t("besin.birim_"+P.besin.birim):t(P.besinVar?"kars.besin.renksiz":"kars.besin.yok")});
  BESIN_AYAR.anaSatir.forEach(function(a){
    tr(t("besin.alan."+a),function(P){
      var s=P.besin&&P.besin.satir.filter(function(x){return x.alan===a})[0];if(!s)return "—";
      var f=document.createDocumentFragment();f.appendChild(document.createTextNode(besinDeger(s.v,s.lt)+" "));
      if(s.duzey)f.appendChild(el("span","bdz "+s.duzey,t("besin.duzey."+s.duzey)));return f;
    });
  });
}
function diffList(title,items,P,renk){
  var d=document.createElement("details");d.className="kgrp "+(renk||"");d.appendChild(el("summary",null,t("ortak.baslik_sayi",{ad:title,n:items.length})));
  if(!items.length){d.appendChild(el("div","mut",t("ortak.yok")));return d}
  items.forEach(function(it){
    var b=el("button","kitem kmad");b.type="button";b.appendChild(cmpIcon(it.rank,it.dogal));b.appendChild(el("span","kin",it.name));
    b.onclick=function(){openItem(it,P,b)};d.appendChild(b);
  });
  return d;
}
/* Maddeye dokununca mevcut alt sayfa: katkı maddesinde sonuç ekranındaki özet, bileşende adı ve notu; kozmetik ve temizlikte sonuç ekranındaki kart */
function openItem(it,P,ret){
  if(P.mode==="koz"){
    var kr=P.res.filter(function(x){return x.found&&x.name===it.key})[0];
    if(kr){openSheet(kr.name,t("koz.ozet.bilesen"),kCard(kr),ret);return}
  }
  if(P.mode==="tem"){
    var tb=el("div");
    if(it.kind==="hz")tb.appendChild(hzCard(it.x));
    else if(it.kind==="sub"){tb.appendChild(vEl("div","ln",it.x.s.text,"t.madde."+it.x.s.id+".metin"));tb.appendChild(srcLinks(it.x.s.sources))}
    else{var fs=it.x.funcs||[];tb.appendChild(el("div","ln",fs.length?t("kars.islevi",{l:fs.map(kIslevAd).join(", ")}):t("kars.not_yok_madde")))}
    openSheet(it.name,it.kind==="hz"?t("tem.ozet.ifade"):t("kars.madde"),tb,ret);return;
  }
  var r=P.res.filter(function(x){return !x.neg&&!x.may&&x.ids.slice().sort().join("+")===it.key})[0];
  if(r&&!r.isB){additiveCard(r)._open(ret);return}
  var body=el("div");
  it.ids.forEach(function(id){var x=IDX.byId[id];if(x&&x.note)body.appendChild(vEl("div","ln",x.note,"b."+x.id+".not"))});
  if(!body.childNodes.length)body.appendChild(el("div","ln",t("kars.not_yok_bilesen")));
  openSheet(it.name,t("koz.ozet.bilesen"),body,ret);
}
function closeCompare(){
  document.body.classList.remove("mode-kars");$("kars").hidden=true;CMP_IDS=null;
  var s=$("sonuc");if(s)s.scrollIntoView({block:"start"});
}
$("karsla").onclick=function(){karsOpen(HCUR,$("karsla"))};
