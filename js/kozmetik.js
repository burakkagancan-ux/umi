/* Kozmetik (INCI): dizin, listeyi bölme, OCR toleranslı arama, analiz ve özet. Saf mantık; testler de yükler. */
/* ---------- Kozmetik (INCI) ---------- */
var KRANK={info:0,yellow:1,orange:2,red:3};
/* kdb: kozmetik.json, kinci: kozmetik_inci.json. Anahtar: norm(INCI adı). */
function buildKIndex(kdb,kinci){
  var map=new Map(),byFirst={};
  function slot(k,name){var s=map.get(k);if(!s){s={name:name,funcs:[],flags:[],reg:[],k3:[]};map.set(k,s)}return s}
  (kinci?kinci.items:[]).forEach(function(it){var k=norm(it[0]);if(!k)return;var s=slot(k,it[0]);s.funcs=it[1].map(function(i){return kinci.functions[i]});s.flags=it[2]||[]});
  kdb.entries.forEach(function(e){e.inci.forEach(function(a){var k=norm(a);if(k.length<3)return;var s=slot(k,a);if(s.reg.indexOf(e)<0)s.reg.push(e);if(e.pfas_inci&&e.pfas_inci.indexOf(a)>-1&&s.flags.indexOf("pfas")<0)s.flags=s.flags.concat("pfas")})});
  // K3: AB dışı yasaklar ve AB değerlendirme listeleri (kozmetik.json "watch")
  (kdb.watch||[]).forEach(function(w){w.inci.forEach(function(a){var k=norm(a);if(k.length<3)return;var s=slot(k,a);if(s.k3.indexOf(w)<0)s.k3.push(w)})});
  // Eş anlamlılar (Türkçe ad, ABD etiket adı, kısaltma): hedef INCI kaydına bağlanır; birden çok hedef birleştirilir
  function uniq(a){return a.filter(function(x,i){return a.indexOf(x)===i})}
  (kinci&&kinci.aliases||[]).forEach(function(a){
    var k=norm(a[0]);if(!k||map.has(k))return;
    var ts=a[1].map(function(x){return map.get(norm(x))}).filter(Boolean);if(!ts.length)return;
    map.set(k,ts.length===1?ts[0]:{name:a[1].join(" / "),funcs:uniq([].concat.apply([],ts.map(function(x){return x.funcs}))),
      flags:uniq([].concat.apply([],ts.map(function(x){return x.flags}))),reg:uniq([].concat.apply([],ts.map(function(x){return x.reg}))),
      k3:uniq([].concat.apply([],ts.map(function(x){return x.k3})))});
  });
  // Benzer yazım araması için kova: ilk harf + uzunluk; ilk harfi düşmüş okumalar için ikinci harf + uzunluk
  var bySecond={};
  map.forEach(function(s,k){var b=k[0]+k.length;(byFirst[b]=byFirst[b]||[]).push(k);if(k.length>7){b=k[1]+(k.length-1);(bySecond[b]=bySecond[b]||[]).push(k)}});
  var nos=new Map();map.forEach(function(s,k){if(k.indexOf(" ")>-1)nos.set(k.replace(/ /g,""),k)});
  var m=kdb.meta||{};
  return {map:map,nos:nos,byFirst:byFirst,bySecond:bySecond,flagLevels:m.inci_flag_levels||{},flagReasons:m.inci_flag_reasons||{},flags:m.flags||{},watchLists:m.watch_lists||{},trText:m.tr_text||{}};
}
/* Metin kozmetik etiketine benziyor mu? (Gıda seçiliyken öneri göstermek için) */
function looksCosmetic(text){
  var tx=" "+norm(text)+" ",n=0;
  ["aqua","parfum","ingredients","glycerin","cetearyl","sodium laureth","dimethicone","phenoxyethanol","tocopheryl","peg ","ci 77","butylene glycol","propylene glycol","xanthan gum","sodium benzoate","citric acid","fragrance","limonene","linalool","carbomer","isopropyl","paraben","stearate","gliserin","setearil","sodyum lauril","sodyum lauret","fenoksietanol","dimetikon","shea"].forEach(function(w){if(tx.indexOf(" "+w)>-1)n++});
  var food=["seker","tuz","un ","sut","yag","icindekiler","bugday","nisasta","aroma verici","enerji","protein"].filter(function(w){return tx.indexOf(" "+w)>-1}).length;
  return n>=3&&n>food;
}
/* INCI listesini öğelere böler. Dönüş: [{raw, may}] */
function inciItems(text){
  var tx=String(text||"").replace(/\r/g,"");
  var m=/(ingredients|ingrédients|ingredientes|zutaten|İçindekiler|İÇİNDEKİLER|içindekiler|i̇çindekiler|bileşenler|Bileşenler|BİLEŞENLER|bilesenler|composition|inci)\s*[:：]/i.exec(tx);
  if(m)tx=tx.slice(m.index+m[0].length);
  tx=tx.replace(/-\s*\n\s*/g,"-").replace(/\s*\n\s*/g," ");
  var mayAt=tx.search(/\[\s*\+\s*\/?\s*-|\(\s*\+\s*\/?\s*-|\+\s*\/\s*-|may contain|peut contenir|puede contener|içerebilir|icerebilir/i);
  var segs=mayAt>-1?[[tx.slice(0,mayAt),false],[tx.slice(mayAt),true]]:[[tx,false]];
  var out=[];
  segs.forEach(function(sg){
    // "No. 5", "Ext. D&C", "Alcohol denat." gibi kısaltma noktaları ayırıcı sayılmaz
    var s=sg[0].replace(/(\d),(\d)/g,"$1\u0001$2").replace(/\b(no|nr|ext|denat)\.(?=\s|,|$)/gi,"$1").replace(/\.(\s|$)/g,",$1");
    s.split(/[,;•·•]/).forEach(function(p){
      p=p.replace(/\u0001/g,",").replace(/\[\s*\+\s*\/?\s*-?\s*\]?|\(\s*\+\s*\/?\s*-?\s*\)|\+\s*\/\s*-|may contain|peut contenir|puede contener|içerebilir|icerebilir/ig," ");
      p=p.replace(/[\[\]{}*°†‡¹²³]+/g," ").replace(/\s+/g," ").replace(/^[\s:.\-–]+|[\s:.\-–]+$/g,"");
      if(p.length>=2&&/[a-zA-Z]{2}/.test(p))out.push({raw:p,may:sg[1]});
    });
  });
  return out;
}
/* Sık OCR karışmaları: "rn"->"m" ("Parfurn"), harf içindeki rakam ("8enzyl", "50dium", "Pantheh0l").
   Rakam yalnızca en az 3 harf içeren sözcükte ve sözcüğün sonunda değilse harfe çevrilir (PEG-32, C12-15, CI 77891 korunur). */
var KSHORT=["water","parfum","aroma","silica","butane","kaolin","glycol"];
var KNOFUZZ=["chloride","chlorides","chlorite","silikat"];   // tek başına kalan iyon adı başka maddeye benzetilmez ("CHLORIDE" -> CHLORINE, AB'de yasak olmasın)   // 4 harfliler (aqua, mica, talc, urea) bilerek yok: "area", "talk" gibi sözcüklerle karışır
var OCRD={"0":"o","1":"l","5":"s","8":"b","6":"g"};
function ocrFix(k){
  return k.split(" ").map(function(w){
    if(w.indexOf("rn")>-1)w=w.replace(/rn/g,"m");
    if(/\d/.test(w)&&(w.match(/[a-z]/g)||[]).length>=3)w=w.replace(/\d+(?=[a-z])/g,function(ds){return ds.replace(/\d/g,function(d){return OCRD[d]||d})});
    return w;
  }).join(" ");
}
function kLookup(k,K,noFix){
  if(!k)return null;
  var s=K.map.get(k);if(s)return {s:s,how:"isim",key:k};
  var ns=K.nos.get(k.replace(/ /g,""));if(ns)return {s:K.map.get(ns),how:"isim",key:ns};
  var ci=/^c[il1] ?([0-9oils]{5})$/.exec(k);
  if(ci){var d=ci[1].replace(/o/g,"0").replace(/[il]/g,"1").replace(/s/g,"5"),k2="ci "+d;s=K.map.get(k2);if(s)return {s:s,how:d!==ci[1]?"benzer":"isim",key:k2}}
  if(KNOFUZZ.indexOf(k)>-1)return null;
  if(!noFix){var fx=ocrFix(k);if(fx!==k){var hf=kLookup(fx,K,true);if(hf)return {s:hf.s,how:"benzer",key:hf.key,dist:(hf.dist||0)+1}}}
  if(k.length<7){   // kısa adlarda benzer yazım yalnızca çok sık görülen birkaç ad için (yanlış eşleşmeyi önlemek için)
    if(k.length<5)return null;
    var hit=null;for(var j=0;j<KSHORT.length;j++)if(lev(k,KSHORT[j],1)===1){if(hit)return null;hit=KSHORT[j]}
    return hit&&K.map.get(hit)?{s:K.map.get(hit),how:"benzer",key:hit,dist:1}:null;
  }
  if(k.length>60)return null;
  var tol=k.length>=14?2:1,best=null,bd=tol+1,tie=false,ln,q,list,c,d2;
  function scan(bucket,ref){
    for(ln=k.length-tol;ln<=k.length+tol;ln++){list=bucket[ref+ln]||[];
      for(q=0;q<list.length;q++){c=list[q];d2=lev(k,c,tol);if(d2<bd){bd=d2;best=c;tie=false}else if(d2===bd&&best&&K.map.get(best)!==K.map.get(c))tie=true}}
  }
  scan(K.byFirst,k[0]);
  if(!best)scan(K.bySecond,k[0]);   // ilk harf okunmamış olabilir ("SOHEXADECANE" -> ISOHEXADECANE)
  if(best&&!tie&&bd<=tol)return {s:K.map.get(best),how:"benzer",key:best,dist:bd};
  return null;
}
function kMatch(raw,K){
  var cands=[raw],inner=[];
  raw.replace(/\(([^)]*)\)/g,function(x,a){inner.push(a)});
  var noPar=raw.replace(/\([^)]*\)/g," ").replace(/\s+/g," ").trim();
  if(noPar&&noPar!==raw)cands.push(noPar);
  cands=cands.concat(inner);
  if(raw.indexOf("/")>-1)cands=cands.concat(noPar.split("/"));
  for(var i=0;i<cands.length;i++){var h=kLookup(norm(cands[i]),K);if(h&&h.how==="isim")return h}
  for(i=0;i<cands.length;i++){h=kLookup(norm(cands[i]),K);if(h)return h}
  return null;
}
/* Virgülü kaybolmuş ya da birleşmiş öğeyi bilinen INCI adlarına böler (dinamik programlama).
   Dönüş: {segs:[{h,text}], left:[kalan sözcük grupları]} ya da null */
function kSegment(raw,K){
  var tk=norm(raw).split(" ").filter(Boolean),n=tk.length;
  if(n<2||n>160)return null;
  var best=[{sc:0}],i,L;
  function upd(k,sc,from,h){if(!best[k]||sc>best[k].sc)best[k]={sc:sc,from:from,h:h}}
  for(i=0;i<n;i++){
    if(!best[i])continue;
    upd(i+1,best[i].sc,i,null);
    for(L=Math.min(8,n-i);L>=1;L--){
      var key=tk.slice(i,i+L).join(" ");
      if(L===1&&(key.length<4||/^\d/.test(key)))continue;
      var h=kLookup(key,K);if(!h)continue;
      if(h.how==="benzer"&&key.length<7)continue;   // kısa sözcükte benzer yazım yalnızca virgülle ayrılmış öğede kabul edilir ("later" -> WATER olmasın)
      if(h.how==="benzer"&&(/^\d+$/.test(tk[i])||/^\d+$/.test(tk[i+L-1]))&&h.key.indexOf(tk[i+L-1])<0)continue;   // "SODIUM FLUORIDE 0" gibi sayı yutan eşleşme olmaz
      upd(i+L,best[i].sc+L*10-1-(h.how==="benzer"?4+(h.dist||1)*2:0),i,h);
    }
  }
  var segs=[],left=[],cur=[],k=n;
  while(k>0){var b=best[k];if(b.h){if(cur.length){left.unshift(cur.reverse().join(" "));cur=[]}segs.unshift({h:b.h,text:tk.slice(b.from,k).join(" ")})}else cur.push(tk[b.from]);k=b.from}
  if(cur.length)left.unshift(cur.reverse().join(" "));
  return segs.length?{segs:segs,left:left}:null;
}
/* İçerik listesi olmayan metin mi? (Türkçe kullanım talimatı, adres, telefon, firma) */
var MARKER_RE=/^(ingredients?|icindekiler|bilesenler|composition|inci|ingredientes|zutaten)$/;
var PROSE_RE=/[çğışöüÇĞŞÖÜİ]|\b(ve|ile|icin|bir|gibi|olan|ise|kez|gunde|kullan\w*|sakla\w*|uyari\w*|dikkat|tarafindan|ithal|uretici\w*|imalat\w*|icerir|ppm|mah|sk|cad|sok|no|tel|ltd|sti|made in|lot|skt|exp|www|http|danis\w*|cocuk\w*|bebek\w*)\b|\d{3}\s?\d{3}\s?\d{2}\s?\d{2}/i;
function isProse(raw){var w=raw.trim().split(/\s+/).length;return PROSE_RE.test(raw)||PROSE_RE.test(norm(raw))||w>=9}
function kResult(raw,h,may,pos,K,opts){
  var r={raw:raw,may:may,pos:pos,found:!!h,how:h?h.how:null,name:h?h.s.name:raw,funcs:h?h.s.funcs:[],iflags:h?h.s.flags:[],reg:h?h.s.reg:[],k3:h?(h.s.k3||[]):[],level:"info",notes:[]};
  r.reg.forEach(function(e){if(KRANK[e.level]>KRANK[r.level])r.level=e.level});
  r.iflags.forEach(function(f){var l=K.flagLevels[f];if(l&&KRANK[l]>KRANK[r.level])r.level=l});
  r.k3.forEach(function(w){var L=K.watchLists[w.list],l=L&&L.level;if(l&&KRANK[l]>KRANK[r.level])r.level=l});
  if(/\bnano\b/i.test(raw))r.nano=true;
  var leaveLike=opts.ptype==="leave"||opts.ptype==="makeup"||opts.ptype==="baby";
  function note(k){if(r.notes.indexOf(k)<0)r.notes.push(k)}   // aynı madde birden çok AB kaydında olabilir (ör. MIT: V/39 ve V/57); not bir kez yazılır. Not kodu: "rinse", "k:<yaş>", "o:<ürün tipi>" (metni kNot)
  r.reg.forEach(function(e){
    if(e.rinse_only&&leaveLike){note("rinse");if(KRANK[r.level]<2)r.level="orange"}
    if(e.kids_under&&opts.ptype==="baby"){note("k:"+e.kids_under);if(KRANK[r.level]<2)r.level="orange"}
    if(e.only_tr)note("o:"+e.only_tr);
  });
  r.rank=KRANK[r.level];
  return r;
}
/* Kart notu kodundan ekrandaki metin */
function kNot(n){
  if(n==="rinse")return t("koz.not.durulanan");
  if(n.indexOf("k:")===0)return t("koz.not.cocuk",{n:n.slice(2)});
  if(n.indexOf("o:")===0)return t("koz.not.yalnizca",{l:veriS(n.slice(2),null)});
  return n;
}
/* AB kaydının kalıp gerekçesi (gen_kozmetik.py level_reason ile aynı kurgu, metinler koz.gerekce.* anahtarlarında).
   tt: biçimleyici (varsayılan t; Türkçe karşılaştırma için tDil). Veri dosyasındaki gerekçe bu kalıptan farklıysa (elle yazılmış) kGerekceMetin veriyi gösterir. */
function kGerekce(e,tt){
  tt=tt||t;var a=e.annex,f=e.flags||[],has=function(x){return f.indexOf(x)>-1},reg=e.regulation||"";
  if(a==="II"){var r=tt("koz.gerekce.ek2",{ref:e.ref,reg:reg?", "+reg:""});if(has("cmr_ban"))r+=" "+tt("koz.gerekce.ek2_cmr");return r+" "+tt("koz.gerekce.ek2_okuma")}
  var p=[];
  if(a==="III"){if(has("allergen_fragrance")&&!e.max)p.push(tt("koz.gerekce.koku"));else{p.push(tt("koz.gerekce.ek3"));if(has("allergen_fragrance"))p.push(tt("koz.gerekce.ek3_koku"))}}
  else if(a==="IV")p.push(tt("koz.gerekce.ek4"));else if(a==="V")p.push(tt("koz.gerekce.ek5"));else if(a==="VI")p.push(tt("koz.gerekce.ek6"));
  if(has("cmr2_carc"))p.push(tt("koz.gerekce.cmr2_kanser"));else if(has("cmr2"))p.push(tt("koz.gerekce.cmr2"));
  if(has("formaldehyde_releaser"))p.push(tt("koz.gerekce.formaldehit"));
  if(has("allergen_preservative"))p.push(tt("koz.gerekce.koruyucu_alerjen"));
  if(has("allergen_hairdye"))p.push(tt("koz.gerekce.sac_boyasi"));
  if((a==="III"||a==="V"||a==="VI")&&e.max)p.push(tt("koz.gerekce.yuzde"));
  return p.join(" ");
}
/* Ekrandaki gerekçe: veri kalıptan üretilmişse seçili dilde kalıp, değilse veri metni (çevirisi yoksa işaretli) */
function kGerekceMetin(e){
  if(e.reason&&kGerekce(e,function(k,v){return tDil(DIL_KAYNAK,k,v)})===e.reason)return {s:kGerekce(e),cevrilmedi:false};
  return veriMetin(e.reason,"k."+e.id+".reason");
}
/* CosIng işlev adı (veride Türkçe; resmi İngilizcesi i18n/veri/en.json "k.islev:<Türkçe>", gen_ceviri_veri.py) */
function kIslevAd(f){return veriS(f,"k.islev:"+f)}
/* opts: {ptype:"rinse"|"leave"|"makeup"|"baby"|""}. Dönüş dizisinin .extra alanı: liste dışında kalan metin. */
function analyzeK(text,K,opts){
  opts=opts||{};
  var items=inciItems(text),out=[],seen={},extra=[],found=0,ended=false,pos=0;
  function add(raw,h,may){var key=h?h.s.name:"?"+norm(raw);if(seen[key])return;seen[key]=1;if(h)found++;out.push(kResult(raw,h,may,pos++,K,opts))}
  items.forEach(function(it){
    var h=kMatch(it.raw,K);
    if(h&&!ended){add(it.raw,h,it.may);return}
    var sg=kSegment(it.raw,K);
    if(sg&&!(ended&&sg.segs.length<2&&isProse(it.raw))){
      sg.segs.forEach(function(x){add(x.text.toUpperCase(),x.h,it.may)});
      sg.left.forEach(function(l){if(l.replace(/[^a-z]/g,"").length>=6&&!/\d/.test(l)&&!isProse(l)&&!ended&&!MARKER_RE.test(l))add(l.toUpperCase(),null,it.may);else extra.push(l)});
      return;
    }
    if(h){add(it.raw,h,it.may);return}
    // Listenin sonu: en az 2 bileşen bulunduktan sonra gelen düz yazı, talimat, adres
    if(isProse(it.raw)){extra.push(it.raw);if(found>=2)ended=true;return}
    if(ended){extra.push(it.raw);return}
    add(it.raw,null,it.may);
  });
  out.extra=extra;
  return out;
}
function summarizeK(res,K){
  var o={total:res.length,found:0,red:[],euBan:[],carc:[],orange:[],yellow:[],ban:[],ed:[],child:[],comedo:[],fragrance:[],formaldehyde:[],preservative:[],pfas:[],nonVegan:[],nonVeg:[],veganUnsure:[],cancer:[],parfum:false,unknown:[],kids:[],vitA:[],hairdye:[],fuzzy:[]};
  function push(a,v){if(a.indexOf(v)<0)a.push(v)}
  res.forEach(function(r){
    if(!r.found){o.unknown.push(r.raw);if(/^(parfum|fragrance|aroma|perfume|parfüm)$/i.test(r.raw.trim()))o.parfum=true;return}
    o.found++;
    if(r.how==="benzer")o.fuzzy.push(r.raw);
    if(/^(PARFUM|FRAGRANCE|AROMA|PERFUME)\b/.test(r.name))o.parfum=true;
    if(r.level==="red"){push(o.red,r.name);push(r.reg.some(function(e){return e.annex==="II"})?o.euBan:o.carc,r.name)}else if(r.level==="orange")push(o.orange,r.name);else if(r.level==="yellow")push(o.yellow,r.name);
    var fl={};r.reg.forEach(function(e){e.flags.forEach(function(f){fl[f]=1});if(e.kids_under)push(o.kids,r.name);if(/^III\/376$/.test(e.id))push(o.vitA,r.name)});
    r.iflags.forEach(function(f){fl[f]=1});
    (r.k3||[]).forEach(function(w){var L=K&&K.watchLists[w.list],kind=L?L.kind:(w.list==="ca"||w.list==="asean"?"ban":"ed");
      if(kind==="ban")push(o.ban,r.name);else if(kind==="ed")push(o.ed,r.name);else if(kind==="child")push(o.child,r.name);else if(kind==="comedo")push(o.comedo,r.name)});
    // AB CMR sınıfı ya da açıklamasında "kanserojen" geçen kayıt (formaldehit salıcılar dahil)
    if(fl.cmr_ban||fl.cmr2||r.reg.some(function(e){return /kanserojen/i.test((e.reason||"")+" "+(e.note_tr||""))})||r.k3.some(function(w){return /kanserojen/i.test(w.note_tr||"")}))push(o.cancer,r.name);
    if(fl.allergen_fragrance)push(o.fragrance,r.name);
    if(fl.formaldehyde_releaser)push(o.formaldehyde,r.name);
    if(fl.allergen_hairdye)push(o.hairdye,r.name);
    if(fl.pfas)push(o.pfas,r.name);
    if(fl.non_veg)push(o.nonVeg,r.name);else if(fl.non_vegan)push(o.nonVegan,r.name);else if(fl.vegan_unsure)push(o.veganUnsure,r.name);
    if(r.funcs.indexOf("Koruyucu")>-1||r.reg.some(function(e){return e.annex==="V"}))push(o.preservative,r.name);
  });
  return o;
}
