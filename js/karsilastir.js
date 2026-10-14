/* İki ürünü (gıda, kozmetik ya da temizlik) karşılaştırma: saf mantık (DOM yok); testler de yükler. Skor yok: karar madde seviyelerine, profile ve alerjenlere dayanır.
   Seviye (rank): 0 özel uyarı yok, 1 doğrulanmadı, 2 dikkat, 3 uyarı (gida.js RANK). Bileşenler (seviyesiz) 0 sayılır. */
/* Karar cümlelerinde seviye adı ve madde sözcüğü: çeviri anahtarları kars.sev.0-3, kars.noun.madde/tem */

/* İçerik listesindeki parçalar (virgül/noktalı virgülle ayrılan, ayraç içi üst parçaya dahil). "İçindekiler:" varsa ondan sonraki ilk cümle. */
function cmpSegments(tok){
  var st=0,i,end=tok.length,out=[],dep=0,a;
  for(i=0;i<tok.length;i++)if(tok[i]==="icindekiler"||tok[i]==="bilesenler"||tok[i]==="ingredients"){st=i+1;break}
  if(tok[st]===":")st++;
  a=st;
  function close(b){for(var q=a;q<b;q++)if(/[a-z]{2}/.test(tok[q])){out.push([a,b]);break}a=b+1}
  for(i=st;i<end;i++){
    var w=tok[i];
    if(w==="(")dep++;else if(w===")")dep=Math.max(0,dep-1);
    else if(w===SENT){if(st>0&&dep===0){close(i);return out}if(dep===0)close(i)}   // içerik listesi ilk cümle sonunda biter
    else if(w==="|"&&dep===0)close(i);
  }
  close(end);
  return out;
}
/* Veritabanında bulunmayan sıradan bileşenler: yalnızca "tanınmayan oran" hesabında tanınmış sayılır, madde listesine girmez (normalleştirilmiş sözcükler) */
var CMP_SADE={};("su domates salca zeytin zeytinyagi aycicek kanola misir findik ceviz badem antep fistik hindistan cevizi susam tahin "+
  "karabiber biber pul kimyon nane kekik tarcin zencefil zerdecal kori hardal sumak yenibahar karanfil defne biberiye feslegen dereotu maydanoz "+
  "limon elma portakal mandalina cilek visne kiraz kayisi seftali armut uzum incir hurma muz ananas nar ahududu bogurtlen yaban mersini erik ayva "+
  "nohut mercimek fasulye bezelye pirinc bulgur yulaf arpa cavdar irmik makarna un nisasta patates havuc sogan sarimsak pirasa ispanak lahana mantar "+
  "salatalik kabak patlican tursu sirke maya peynir yogurt tereyagi krema et tavuk dana kuzu hindi balik ton somon kakao bal pekmez meyve sebze "+
  "baharat baharatlar ot otlar suyu puresi konsantre kurutulmus kuru toz tane kirmizi yesil siyah beyaz").split(" ").forEach(function(w){CMP_SADE[w]=1});
function cmpAlName(idx,f){var a=(idx.bmeta&&idx.bmeta.allergens)||[];for(var i=0;i<a.length;i++)if(a[i][0]===f)return veriS(a[i][1],"alerjen."+f);return f}

/* Profile uymayan (sonuç ekranında kırmızı profil kartı çıkaran) durumlar. prof: localStorage "profil" biçimi. */
function cmpMisfit(S,prof,idx){
  var o=[],L=S.life,j=function(a){return a.join(", ")};
  if(!prof)return o;
  (prof.al||[]).forEach(function(f){var a=S.allergen[f];if(a&&a.yes.length)o.push(t("kars.uyum.alerjen",{ad:cmpAlName(idx,f),l:j(a.yes)}))});
  if(prof.lactose&&S.lactose.yes.length)o.push(t("kars.uyum.laktoz",{l:j(S.lactose.yes)}));
  if(prof.vegan&&S.vegan.no.length)o.push(t("kars.uyum.vegan",{l:j(S.vegan.no)}));
  if(prof.veg&&(S.veg.no.length||S.veg.insect.length))o.push(t("kars.uyum.vejetaryen",{l:j(S.veg.no.concat(S.veg.insect))}));
  var alc=L.alcohol.length?t("kars.uyum.alkol",{l:j(L.alcohol)}):null,raw=L.raw.length?t("kars.uyum.cig",{l:j(L.raw)}):null;
  function kim(k,x){return t("kars.uyum."+k,{l:x})}
  if(prof.preg){if(alc)o.push(kim("hamile",alc));if(raw)o.push(kim("hamile",raw))}
  if(prof.emziriyorum){if(alc)o.push(kim("emzirme",alc));if(raw)o.push(kim("emzirme",raw))}
  if(prof.baby){
    if(L.honey.length)o.push(t("kars.uyum.bal"));
    if(alc)o.push(kim("bebek",alc));if(L.caffeine.length)o.push(t("kars.uyum.kafein",{l:j(L.caffeine)}));if(raw)o.push(kim("bebek",raw));
  }
  if(prof.child&&alc)o.push(kim("cocuk",alc));
  if(prof.pku&&L.phe.length)o.push(t("kars.uyum.fenilalanin",{l:j(L.phe)}));
  if(prof.pet&&L.pet.length)o.push(t("kars.uyum.pet",{l:j(L.pet)}));
  return o.filter(function(x,i){return o.indexOf(x)===i});
}

/* Okunan metinden karşılaştırma için ürün özeti */
function cmpProduct(text,idx,prof,name){
  var res=analyze(text,idx),S=summarize(res,idx),tok=normText(text).split(" ").filter(Boolean);
  var by={},items=[];
  res.forEach(function(r){
    if(r.neg||r.may||r.ids.every(function(id){return id.indexOf("B:upf_sinif_")===0}))return;   // "renklendirici" gibi sınıf adları madde sayılmaz
    var key=r.ids.slice().sort().join("+"),rk=Math.max(0,r.rank);
    var nm=r.ids.map(function(id){var it=idx.byId[id];return it.isB?itAd(it):it.id+" "+itAd(it)}).join(" / ");
    if(by[key]){if(rk>by[key].rank)by[key].rank=rk;return}
    by[key]={key:key,ids:r.ids,name:nm,rank:rk,isB:r.isB,dogal:uretimDogal(r.ids,idx)};items.push(by[key]);
  });
  items.sort(function(x,y){return y.rank-x.rank||x.name.localeCompare(y.name,"tr")});
  var cnt=[0,0,0,0];items.forEach(function(it){cnt[it.rank]++});
  var maxRank=items.length?items[0].rank:0;
  var segs=cmpSegments(tok),hit=0;
  segs.forEach(function(s){
    if(res.some(function(r){return r.pos>=s[0]&&r.pos<s[1]}))return hit++;
    for(var q=s[0];q<s[1];q++)if(CMP_SADE[tok[q]])return hit++;
  });
  var al={yes:[],may:[]};
  Object.keys(S.allergen).forEach(function(f){var a=S.allergen[f];if(a.yes.length)al.yes.push(cmpAlName(idx,f));else if(a.may.length)al.may.push(cmpAlName(idx,f))});
  var gl=S.allergen.allergen_gluten,sugar=[];
  S.sugar.forEach(function(s){if(sugar.indexOf(s.name)<0)sugar.push(s.name)});
  return {name:name||"",text:text,res:res,S:S,items:items,counts:cnt,maxRank:maxRank,yellow:cnt[2],
    top:items.filter(function(it){return it.rank===maxRank&&maxRank>0}),
    unknown:{total:segs.length,found:hit,ratio:segs.length?(segs.length-hit)/segs.length:0},
    misfit:cmpMisfit(S,prof,idx).concat(cmpMisfitOzel(text,prof)),allergen:al,
    gluten:gl&&gl.yes.length?"var":gl&&gl.may.length?"icerebilir":"yok",
    vegan:S.vegan.no.length?"degil":S.vegan.unsure.length?"belirsiz":"yok",
    palm:S.palm.slice(),sugar:sugar,uretim:uretimOzet(res,idx)};
}

/* Kozmetik ürün özeti. Seviye: AB'de yasak ve başka pazarda yasak (red/orange) 3, dikkat (yellow) 2, diğerleri 0.
   Tanınmayan oran: INCI listesindeki bileşenlerden tanınmayanlar. */
var CMP_KRANK={red:3,orange:3,yellow:2,info:0};
/* Profilim'de elle eklenen alerjenler (prof.alOzel): her üç türde etiket metninde aranır (ozelAra, js/ortak.js) */
function cmpMisfitOzel(text,prof){
  return ((prof&&prof.alOzel)||[]).map(function(ad){var r=ozelAra(text,ad);return r.yes.length?t("kars.uyum.alerjen",{ad:ad,l:r.yes.join(", ")}):null}).filter(Boolean);
}
function cmpMisfitK(S,prof){
  var o=[],j=function(a){return a.join(", ")};
  if(!prof)return o;
  if(prof.koku&&S.fragrance.length)o.push(t("kars.uyum.koku",{l:j(S.fragrance)}));
  var no=S.nonVeg.concat(S.nonVegan);
  if(prof.vegan&&no.length)o.push(t("kars.uyum.vegan",{l:j(no)}));
  if(prof.veg&&S.nonVeg.length)o.push(t("kars.uyum.vejetaryen",{l:j(S.nonVeg)}));
  return o;
}
function cmpProductK(text,K,prof,name,opts){
  var res=analyzeK(text,K,opts),S=summarizeK(res,K),items=[],by={};
  res.forEach(function(r){
    if(!r.found)return;
    var rk=CMP_KRANK[r.level]||0;
    if(by[r.name]){if(rk>by[r.name].rank)by[r.name].rank=rk;return}
    by[r.name]={key:r.name,ids:[r.name],name:r.name,rank:rk};items.push(by[r.name]);
  });
  return cmpWrap({mode:"koz",name:name||"",text:text,res:res,S:S,noun:"madde",
    unknown:{total:S.total,found:S.found,ratio:S.total?(S.total-S.found)/S.total:0},misfit:cmpMisfitK(S,prof).concat(cmpMisfitOzel(text,prof))},items);
}

/* Temizlik ürün özeti. Tehlike ifadeleri ve madde notları: ciddi tehlike (red) 3, uyarı (yellow) 2, bilgi 0; adı yazılan diğer maddeler 0.
   Temizlik etiketinde tam içerik listesi olmadığı için tanınmayan oran uygulanmaz. */
var CMP_TRANK={red:3,yellow:2,info:0};
function cmpMisfitT(S,A,T,prof){
  var o=[],j=function(a){return a.join(", ")},lv=function(c){return T.byCode[c]&&T.byCode[c].level};
  if(!prof)return o;
  if(prof.koku&&S.fragrance.length)o.push(t("kars.uyum.koku",{l:j(S.fragrance)}));
  if(prof.astim){var rs=S.resp.filter(function(c){return /^(H334|EUH071)$/.test(c)});if(rs.length)o.push(t("kars.uyum.astim",{l:j(rs)}))}
  var who=prof.preg?"hamile":prof.baby?"bebek":prof.child?"cocuk":"";
  if(who&&S.cmr.length)o.push(t("kars.uyum.cmr_"+who,{l:j(S.cmr)}));
  if(who&&S.ed.length)o.push(t("kars.uyum.ed_"+who,{l:j(S.ed)}));
  if(prof.baby||prof.child){
    var sw=S.swallow.concat(S.eye).filter(function(c){return lv(c)==="red"});
    if(sw.length)o.push(t("kars.uyum.yutma_"+(prof.baby?"bebek":"cocuk"),{l:j(sw)}));
    if(A.capsule)o.push(t("kars.uyum.kapsul_"+(prof.baby?"bebek":"cocuk")));
  }
  return o.filter(function(x,i){return o.indexOf(x)===i});
}
function cmpProductT(text,T,K,prof,name){
  var A=analyzeT(text,T,K),S=summarizeT(A),items=[],by={};
  function add(key,nm,rk,kind,x){if(by[key]){if(rk>by[key].rank)by[key].rank=rk;return}by[key]={key:key,ids:[key],name:nm,rank:rk,kind:kind,x:x};items.push(by[key])}
  A.hazards.forEach(function(x){add(x.code,x.code+" "+hzKisa(x.h),CMP_TRANK[x.h.level]||0,"hz",x)});
  A.subs.forEach(function(x){var s=x.s;add(s.inci[0],s.inci.length>1?"Enzim: "+s.inci.join(", ").toLowerCase():s.inci[0],CMP_TRANK[s.level]||0,"sub",x)});
  A.inci.forEach(function(x){add(x.name,x.name,0,"inci",x)});
  return cmpWrap({mode:"tem",name:name||"",text:text,A:A,S:S,noun:"tem",
    unknown:{total:0,found:0,ratio:0},misfit:cmpMisfitT(S,A,T,prof).concat(cmpMisfitOzel(text,prof))},items);
}
/* Ortak alanlar: sayılar, en riskli seviye, en riskli maddeler */
function cmpWrap(P,items){
  items.sort(function(x,y){return y.rank-x.rank||x.name.localeCompare(y.name,"tr")});
  var cnt=[0,0,0,0];items.forEach(function(it){cnt[it.rank]++});
  P.items=items;P.counts=cnt;P.maxRank=items.length?items[0].rank:0;P.yellow=cnt[2];
  P.top=items.filter(function(it){return it.rank===P.maxRank&&P.maxRank>0});
  return P;
}

/* Madde farkları: anahtar madde kimliğidir (E322 ile "soya lesitini" aynı madde) */
function cmpDiff(A,B){
  var kb={},ka={},o={onlyA:[],onlyB:[],both:[]};
  B.items.forEach(function(it){kb[it.key]=it});A.items.forEach(function(it){ka[it.key]=it});
  A.items.forEach(function(it){if(kb[it.key])o.both.push({key:it.key,ids:it.ids,name:it.name,rank:Math.max(it.rank,kb[it.key].rank),dogal:it.dogal,kind:it.kind,x:it.x});else o.onlyA.push(it)});
  B.items.forEach(function(it){if(!ka[it.key])o.onlyB.push(it)});
  return o;
}

function cmpHighUnknown(P,cfg){return P.unknown.total>=cfg.enAzParca&&P.unknown.ratio>cfg.taninmayanOran}

/* Karar (sırayla): profil uyumu, en riskli maddenin seviyesi, dikkat (sarı) madde sayısı, yoksa "Benzer".
   Tanınmayan oranı yüksek üründe kazanan ilan edilmez. Dil: "içerik açısından daha iyi görünüyor"; "sağlıklı" denmez. */
function cmpDecide(A,B,cfg){
  var P={A:A,B:B},o=function(w,kind,title,reason){return {winner:w,kind:kind,title:title,reason:reason||""}};
  var other=function(k){return k==="A"?"B":"A"};
  var winT=function(k){return t("kars.karar.daha_iyi",{ad:P[k].name})};
  var mA=A.misfit.length>0,mB=B.misfit.length>0;
  if(mA&&mB)return o(null,"ikisi_uyumsuz",t("kars.karar.ikisi_uyumsuz"),t("kars.karar.ikisi_uyumsuz_not"));
  if(mA||mB){
    var lk=mA?"A":"B",wk=other(lk),why=t("kars.karar.uymuyor",{ad:P[lk].name,l:P[lk].misfit[0]});
    if(cmpHighUnknown(P[wk],cfg))return o(null,"taninmadi",t("kars.karar.taninamadi_bir",{ad:P[wk].name}),why+" "+t("kars.karar.diger_karar_yok"));
    return o(wk,"profil",winT(wk),why);
  }
  var hu=["A","B"].filter(function(k){return cmpHighUnknown(P[k],cfg)});
  if(hu.length)return o(null,"taninmadi",hu.length>1?t("kars.karar.taninamadi_iki",{a:P[hu[0]].name,b:P[hu[1]].name}):t("kars.karar.taninamadi_bir",{ad:P[hu[0]].name}),t("kars.karar.kontrol"));
  var w,l,r;
  if(A.maxRank!==B.maxRank){
    w=A.maxRank<B.maxRank?"A":"B";l=other(w);
    r=t("kars.karar.yalnizca",{sev:t("kars.sev."+P[l].maxRank),noun:t("kars.noun."+(P[l].noun||"madde")),l:P[l].top.slice(0,2).map(function(x){return x.name}).join(", "),ad:P[l].name});
    return o(w,"en_riskli",winT(w),cmpExtra(r,P[w],P[l]));
  }
  if(A.yellow!==B.yellow){
    w=A.yellow<B.yellow?"A":"B";l=other(w);
    r=t("kars.karar.dikkat_sayisi",{noun:t("kars.noun."+(P[w].noun||"madde")),a:P[w].name,na:P[w].yellow,b:P[l].name,nb:P[l].yellow});
    return o(w,"dikkat",winT(w),cmpExtra(r,P[w],P[l]));
  }
  return o(null,"benzer",t("kars.karar.benzer"),t("kars.karar.benzer_not"));
}
/* Kazananın lehine tek bir ek fark (yalnızca gıda): palm yağı ya da şeker kaynağı sayısı */
function cmpExtra(r,W,L){
  if(!L.palm||!W.palm)return r;   // kozmetik ve temizlikte bu ek fark yok
  if(L.palm.length&&!W.palm.length)return r+" "+t("kars.karar.palm",{ad:L.name});
  if(L.sugar.length>W.sugar.length)return r+" "+t("kars.karar.seker",{a:W.name,na:W.sugar.length,b:L.name,nb:L.sugar.length});
  return r;
}

/* Tarama geçmişi: en yeni başta, aynı tür + aynı metin tekrar eklenmez, en fazla max kayıt */
/* Varsayılan ad: "Tarama N" (dile göre kars.tarama_n); N, geçmişteki en büyük sıra numarasının bir fazlası */
function histName(list){var n=0;(list||[]).forEach(function(x){var k=histOtoNo(x.name);if(k>n)n=k});return t("kars.tarama_n",{n:n+1})}
/* Otomatik ad mı? Yüklü her dilin biçimi tanınır (dil değişse de eski "Tarama 3" otomatik sayılır); sıra numarasını, değilse 0 döndürür */
function histOtoNo(name){
  name=name||"";
  for(var k in DIL.sozluk){var p=DIL.sozluk[k]&&DIL.sozluk[k]["kars.tarama_n"];if(!p||p.indexOf("{n}")<0)continue;
    var re=new RegExp("^"+p.split("{n}").map(function(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}).join("(\\d+)")+"$"),m=re.exec(name);if(m)return +m[1]}
  return 0;
}
function histAdd(list,e,max){
  var tx=(e.text||"").trim();if(!tx)return list.slice(0,max);
  var out=(list||[]).filter(function(x){return !(x.mode===e.mode&&(x.text||"").trim()===tx)});
  out.unshift(e);return out.slice(0,max);
}
