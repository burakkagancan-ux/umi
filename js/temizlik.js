/* Temizlik ürünleri: H/EUH/P ifadeleri, deterjan içerik grupları, INCI maddeleri, özet. Saf mantık; testler de yükler. */
/* ---------- Temizlik ürünleri ---------- */
/* tdb: temizlik.json. Zararlılık ifadeleri hem koddan (H318, EUH208) hem metinden (Türkçe/İngilizce) bulunur. */
function tVariants(p){var out=[p];if(p.indexOf("yol acabilir")>-1){out.push(p.replace(/yol acabilir/g,"neden olabilir"));out.push(p.replace(/yol acabilir/g,"yol acar"))}if(p.indexOf("yol acar")>-1)out.push(p.replace(/yol acar/g,"neden olur"));return out}
function buildTIndex(tdb){
  var byCode={},phrases=[],pByCode={},pphrases=[];
  // Varyant ("yol açar") başka bir ifadenin asıl metnine denk gelirse eklenmez (H371 -> H370 olmasın)
  var prim={};tdb.hazards.concat(tdb.combos||[],tdb.precautions||[]).forEach(function(h){prim[norm(h.tr)]=1});
  function addPh(list,txt,codes){tVariants(norm(txt)).forEach(function(p,i){if(p.length>=8&&!(i&&prim[p]))list.push({p:p,tk:p.split(" "),codes:codes})})}
  tdb.hazards.forEach(function(h){byCode[h.code]=h;addPh(phrases,h.tr,[h.code]);addPh(phrases,h.en,[h.code]);(h.alt||[]).forEach(function(a){addPh(phrases,a,[h.code])})});
  (tdb.combos||[]).forEach(function(c){addPh(phrases,c.tr,c.codes);addPh(phrases,c.en,c.codes)});
  (tdb.precautions||[]).forEach(function(q){pByCode[q.code]=q;addPh(pphrases,q.tr,[q.code]);addPh(pphrases,q.en,[q.code]);(q.alt||[]).forEach(function(a){addPh(pphrases,a,[q.code])})});
  function rx(a){return a.map(function(s){return new RegExp(s,"g")})}
  var groups=tdb.groups.map(function(g){return {g:g,rx:rx(g.pat)}});
  var subs=tdb.subs.map(function(s){return {s:s,rx:rx(s.pat||[])}});
  var subByInci={};tdb.subs.forEach(function(s){s.inci.forEach(function(a){subByInci[a]=s})});
  var cap=tdb.capsule?{rx:rx(tdb.capsule.pat),d:tdb.capsule}:null;
  return {byCode:byCode,phrases:phrases,pByCode:pByCode,pphrases:pphrases,cap:cap,uzem:tdb.uzem||"",groups:groups,subs:subs,subByInci:subByInci,meta:tdb.meta,mix:tdb.mix_rule,aliases:tdb.aliases||[],am:null};
}
/* Temizlik eş anlamlıları (kaynak/temizlik_esanlamlilar.tsv) kozmetik dizinindeki INCI kayıtlarına bağlanır; ilk kullanımda kurulur */
function tAliasMap(T,K){
  if(T.am)return T.am;
  var am=new Map();
  function uniq(a){return a.filter(function(x,i){return a.indexOf(x)===i})}
  T.aliases.forEach(function(a){
    var ts=a[1].map(function(x){return K.map.get(norm(x))}).filter(Boolean);if(!ts.length)return;
    var s=ts.length===1?ts[0]:{name:a[1].join(" / "),funcs:uniq([].concat.apply([],ts.map(function(x){return x.funcs}))),flags:uniq([].concat.apply([],ts.map(function(x){return x.flags}))),reg:[],k3:[]};
    am.set(norm(a[0]),{s:s,kisa:a[2]==="kisa",ad:a[0]});
  });
  return T.am=am;
}
/* Birebir arama: temizlik eş anlamlısı, kozmetik dizini, boşluksuz yazım, "sulph" -> "sulf". Kısaltmalar (LAS, BIT) yalnızca büyük harfle yazılmışsa. */
function tLook(key,raw,K,T){
  if(!key)return null;
  var a=tAliasMap(T,K).get(key);
  if(a){if(!a.kisa||new RegExp("(^|[^A-Za-z])"+key.toUpperCase()+"([^A-Za-z]|$)").test(raw))return {s:a.s,how:"isim",key:key,alias:true};return null}
  var s=K.map.get(key);if(s)return {s:s,how:"isim",key:key};
  var ns=K.nos.get(key.replace(/ /g,""));if(ns)return {s:K.map.get(ns),how:"isim",key:ns};
  if(key.indexOf("sulph")>-1)return tLook(key.replace(/sulph/g,"sulf"),raw,K,T);
  return null;
}
/* Kodlar: "H318", "EUH 208", "H301+H311", "H360FD". Geçersiz son ek atılır (OCR "H302Yutulması"). */
function tCodes(text,T){
  var out=[],re=/(^|[^A-Za-z])(EUH|H)\s?(\d{3})([A-Za-z]{0,2})/g,m;
  while((m=re.exec(text))){
    var base=m[2]+m[3],c=base+m[4];
    if(!T.byCode[c]&&m[4].length===2&&T.byCode[base+m[4][0]])c=base+m[4][0];
    if(!T.byCode[c])c=base;
    if(T.byCode[c]&&out.indexOf(c)<0)out.push(c);
  }
  return out;
}
/* Metin eşleşmesi: ifadenin en az 5 harfli bir sözcüğü metinde aynen geçiyorsa çevresindeki pencere benzer yazımla karşılaştırılır. */
/* Önlem kodları: "P305+P351+P338"; birleşik kod listede yoksa tek tek */
function tPCodes(text,T){
  var out=[],re=/(^|[^A-Za-z])P\s?(\d{3})((?:\s?\+\s?P\s?\d{3})*)/g,m;
  while((m=re.exec(text))){
    var parts=["P"+m[2]].concat((m[3].match(/\d{3}/g)||[]).map(function(d){return "P"+d})),c=parts.join("+");
    if(T.pByCode[c]){if(out.indexOf(c)<0)out.push(c)}
    else parts.forEach(function(x){if(T.pByCode[x]&&out.indexOf(x)<0)out.push(x)});
  }
  return out;
}
/* EUH208 içinde adı geçen madde: "X içerir. Alerjik reaksiyona..." / "Contains X. May produce an allergic reaction" */
/* Tehlike/önlem ifadesinin ekrandaki metni: veride CLP'nin resmi metni var (tr: SEA'ya dayalı, en: CLP Ek III/IV); başka dilde çevirisi yoksa İngilizce.
   hzKisa: kart başlığında ve listelerde "içerir. " öneki (Türkçe birleşik ifadeler) ve sondaki nokta atılır. */
function hzMetin(h){return veriS(h.tr,null,{en:h.en})}
function hzKisa(h){return hzMetin(h).replace(/^içerir\. /,"").replace(/\.$/,"")}
/* İçerik grubu adı (AB 648/2004 Ek VII) */
function tGrupAd(g){return veriS(g.tr,"t.grup."+g.id)}
function tEuh208(text){
  var out=[],tx=String(text||"").replace(/\s+/g," "),m;
  var re1=/(?:^|[.:;!]\s*|EUH\s?208\s*:?\s*)([^.:;!]{3,140}?)\s+i[cç]erir\.?\s*Alerjik reaksiyon/gi;
  var re2=/Contains:?\s*([^.;!]{3,140}?)\.?\s*May produce an allergic reaction/gi;
  [re1,re2].forEach(function(r){while((m=r.exec(tx))){var n=m[1].replace(/^(EUH\s?208\s*:?\s*)/i,"").trim();if(n&&out.indexOf(n)<0)out.push(n)}});
  return out;
}
function tPhrases(text,T,list){
  var tk=norm(text).split(" ").filter(Boolean),pos={},cands=[];
  tk.forEach(function(w,i){(pos[w]=pos[w]||[]).push(i)});
  (list||T.phrases).forEach(function(ph){
    var m=ph.tk.length,max=ph.p.length>=30?3:ph.p.length>=16?2:ph.p.length>=10?1:0,best=null,tried={};
    ph.tk.forEach(function(w,j){
      if(w.length<5||!pos[w])return;
      pos[w].forEach(function(i){
        for(var s=i-j-1;s<=i-j+1;s++)for(var L=m-1;L<=m+1;L++){
          if(s<0||L<1||s+L>tk.length||tried[s+":"+L])continue;tried[s+":"+L]=1;
          var d=lev(tk.slice(s,s+L).join(" "),ph.p,max);
          if(d<=max&&(!best||d<best.d||(d===best.d&&L===m)))best={s:s,e:s+L,d:d};
        }
      });
    });
    if(best)cands.push({codes:ph.codes,s:best.s,e:best.e,d:best.d,len:ph.p.length});
  });
  cands.sort(function(a,b){return b.len-a.len||a.d-b.d});
  var acc=[];
  cands.forEach(function(c){if(acc.some(function(a){return c.s<a.e&&a.s<c.e}))return;acc.push(c)});
  return acc;
}
/* Gruplar ve bantlar için sadeleştirilmiş metin: Türkçe harfler eşlenir, nokta cümle sonu "|" olur, %<>- korunur */
function tPrep(text){return low(String(text||"")).replace(/\.(?=\s|$)/g," | ").replace(/[^a-z0-9%<>≤≥|\-–]+/g," ")}
var TBANDS=[
  ["b15_30",/%\s?15\s?[-–]\s?%?\s?30|(?:^|[^0-9])15\s?[-–]\s?30\s?%/g],
  ["b5_15",/%\s?5\s?[-–]\s?%?\s?15|(?:^|[^0-9])5\s?[-–]\s?15\s?%/g],
  ["b30",/%\s?30\s(?:ve\s|veya\s)?(?:uzeri|ustu|fazla)|(?:>|≥)\s?%?\s?30|30\s?%\s(?:and|or)\s(?:over|more|above)|%\s?30\s?\+/g],
  ["b5",/%\s?5\s(?:ten\s|den\s|in\s)?(?:az|asagi|altinda|dusuk)|(?:<|≤)\s?%?\s?5(?![0-9])|less than 5\s?%|(?:^|[^0-9])5\s?%\s(?:ten\s|den\s)?az/g]
];
function tGroups(N,T){
  var bands=[],hits=[],m;
  TBANDS.forEach(function(b){b[1].lastIndex=0;while((m=b[1].exec(N))){var s=m.index+(/^[^%<>≤≥0-9l]/.test(m[0])?1:0);if(!bands.some(function(x){return s<x.e&&x.s<m.index+m[0].length}))bands.push({b:b[0],s:s,e:m.index+m[0].length})}});
  bands.sort(function(a,b){return a.s-b.s});
  T.groups.forEach(function(G){G.rx.forEach(function(r){r.lastIndex=0;while((m=r.exec(N))){
    var s=m.index+(/^[^a-z]/.test(m[0])?1:0),e=m.index+m[0].length,x=/^\s(?:madde(?:ler|leri|si)?|surfactants?)(?![a-z])/.exec(N.slice(e));
    if(x)e+=x[0].length;
    if(G.g.id==="koruyucu"&&/(?:goz|yuz)\s$/.test(N.slice(Math.max(0,s-5),s)))continue;
    hits.push({id:G.g.id,g:G.g,s:s,e:e})}})});
  hits.sort(function(a,b){return a.s-b.s});
  hits=hits.filter(function(h,i){return !hits.some(function(o,j){return j!==i&&o.s<=h.s&&o.e>=h.e&&(o.e-o.s)>(h.e-h.s)})});
  // Bant grubun hemen arkasında mı ("anyonik ... %5-15") yoksa önünde mi ("%5-15: anyonik ...")?
  hits.forEach(function(h){var bb=bands.filter(function(b){return b.s>=h.e&&b.s<=h.e+3})[0];h.trail=bb?bb.b:null});
  var trailMode=hits.some(function(h){return h.trail})&&bands.length&&hits.length&&bands[0].s>hits[0].s;
  var out={};
  hits.forEach(function(h){
    var after=N.slice(h.e,h.e+18),neg=/^\s?(?:icermez|icermemek|yoktur|yok|free|siz)/.test(after),band=null;
    if(trailMode)band=h.trail;
    else{
      var lb=null;bands.forEach(function(b){if(b.e<=h.s)lb=b});
      if(lb){var mid=N.slice(lb.e,h.s);if(!/\||(?:^|\s)(?:ayrica|also|diger)(?:\s|$)/.test(mid))band=lb.b}
    }
    if(h.g.noband)band=null;   // enzim, parfüm, koruyucu vb. her oranda yazılır; bandı yoktur
    var o=out[h.id];
    if(!o)out[h.id]={id:h.id,g:h.g,band:band,neg:neg};
    else{if(!neg)o.neg=false;if(!o.band&&band)o.band=band}
  });
  if(/fosfat\s?siz|phosphate\s?free/.test(N)&&!out.fosfat)out.fosfat={id:"fosfat",g:T.groups.filter(function(G){return G.g.id==="fosfat"})[0].g,band:null,neg:true};
  return Object.keys(out).map(function(k){return out[k]});
}
/* INCI ile yazılmış maddeler (parfüm alerjenleri, koruyucular): parantez, virgül, iki nokta ile bölünen kısa parçalar kozmetik dizininde aranır */
function tInci(text,K,T){
  var out=[],seen={};
  function take(h,raw){
    var s=h.s;if(seen[s.name])return;
    var fl={};(s.reg||[]).forEach(function(e){e.flags.forEach(function(f){fl[f]=1})});(s.flags||[]).forEach(function(f){fl[f]=1});
    var pres=s.funcs.indexOf("Koruyucu")>-1||(s.reg||[]).some(function(e){return e.annex==="V"});
    var color=/^CI \d{5}/.test(s.name)||s.funcs.indexOf("Renklendirici")>-1&&(s.reg||[]).some(function(e){return e.annex==="IV"});
    seen[s.name]=1;out.push({name:s.name,raw:raw,how:h.how,alias:!!h.alias,fragrance:!!fl.allergen_fragrance,pres:pres,color:color,fl:fl,funcs:s.funcs});
  }
  String(text||"").split(/[,;:()\[\]\n•·]|\.(?=\s|$)/).forEach(function(p){
    p=p.replace(/\s+/g," ").trim();if(p.length<3)return;
    var w=p.split(" ").length,h;
    if(w<=4){
      h=tLook(norm(p),p,K,T);
      // Benzer yazım (OCR hatası) yalnızca düz yazı olmayan, en az 8 harfli kısa parçada
      if(!h&&p.length>=4){h=kMatch(p,K);if(h&&h.how!=="isim"&&(norm(p).length<8||isProse(p)))h=null}
      if(h){take(h,p);return}
    }
    // Uzun parçada (ör. "Benzisothiazolinone içerir", "renklendirici CI 42090") yalnızca birebir ad aranır: en uzun eşleşme önce
    var tk=norm(p).split(" ").filter(Boolean);
    for(var i=0;i<tk.length;i++)for(var L=Math.min(6,tk.length-i);L>=1;L--){
      var key=tk.slice(i,i+L).join(" "),hh=tLook(key,p,K,T);
      if(hh&&(key.length>=6||hh.alias)){take(hh,hh.alias&&tAliasMap(T,K).get(key).kisa||!hh.alias?key.toUpperCase():key);i+=L-1;break}
    }
  });
  return out;
}
function analyzeT(text,T,K){
  var N=tPrep(text),hz={},order=[];
  function add(code,how){var h=T.byCode[code];if(!h)return;if(!hz[code]){hz[code]={code:code,h:h,how:[]};order.push(code)}if(hz[code].how.indexOf(how)<0)hz[code].how.push(how)}
  tCodes(text,T).forEach(function(c){add(c,"kod")});
  tPhrases(text,T).forEach(function(p){p.codes.forEach(function(c){add(c,p.d?"benzer":"metin")})});
  var hazards=order.map(function(c){return hz[c]});
  var groups=tGroups(N,T);
  var subs=[],seenS={};
  function addSub(s,how){if(seenS[s.id])return;seenS[s.id]=1;subs.push({s:s,how:how})}
  T.subs.forEach(function(S){S.rx.some(function(r){r.lastIndex=0;return r.test(N)})&&addSub(S.s,"isim")});
  var inci=K?tInci(text,K,T):[];
  inci.forEach(function(x){var s=T.subByInci[x.name];if(s)addSub(s,"isim")});
  var pr={},po=[];
  function addP(c,how){if(!T.pByCode[c])return;if(!pr[c]){pr[c]={code:c,p:T.pByCode[c],how:[]};po.push(c)}if(pr[c].how.indexOf(how)<0)pr[c].how.push(how)}
  tPCodes(text,T).forEach(function(c){addP(c,"kod")});
  tPhrases(text,T,T.pphrases).forEach(function(p){p.codes.forEach(function(c){addP(c,p.d?"benzer":"metin")})});
  // Birleşik ifade bulunduysa parçaları ayrıca gösterilmez (P305+P351+P338 varsa P338 yok)
  var prec=po.map(function(c){return pr[c]}).filter(function(x){return !po.some(function(o){return o!==x.code&&o.indexOf("+")>-1&&o.split("+").indexOf(x.code)>-1})});
  var capsule=!!(T.cap&&T.cap.rx.some(function(r){r.lastIndex=0;return r.test(N)})&&/camasir|laundry/.test(N));
  var sig=/(^|[^A-Za-zÇĞİÖŞÜçğıöşü])(TEHL[İI]KE|DANGER)(?![A-Za-zÇĞİÖŞÜçğıöşü])/.test(text)?"tehlike":/(^|[^A-Za-zÇĞİÖŞÜçğıöşü])(D[İI]KKAT|WARNING)(?![A-Za-zÇĞİÖŞÜçğıöşü])/.test(text)?"dikkat":"";
  var e208=tEuh208(text);if(hz.EUH208)hz.EUH208.names=e208;
  return {hazards:hazards,groups:groups,subs:subs,inci:inci,signal:sig,prec:prec,capsule:capsule,euh208:e208};
}
var TRANK={info:0,yellow:1,red:2};
function summarizeT(A){
  var o={red:[],yellow:[],info:[],byGroup:{},cmr:[],cancer:[],ed:[],resp:[],swallow:[],eye:[],mix:false,mixWhy:[],fragrance:[],pres:[],color:[],parfum:false,enzyme:false,level:"info"};
  function push(a,v){if(a.indexOf(v)<0)a.push(v)}
  A.hazards.forEach(function(x){
    var h=x.h;push(o[h.level],h.code);(o.byGroup[h.group]=o.byGroup[h.group]||[]).push(h.code);
    if(TRANK[h.level]>TRANK[o.level])o.level=h.level;
    if(h.group==="cmr")push(o.cmr,h.code);
    if(/^H35[01]/.test(h.code))push(o.cancer,h.code);
    if(h.group==="endokrin")push(o.ed,h.code);
    if(/^(H33[0-6]|EUH071|EUH211|EUH212)$/.test(h.code))push(o.resp,h.code);
    if(/^(H30[0-4])$/.test(h.code))push(o.swallow,h.code);
    if(/^(H314|H318|H319|EUH070)$/.test(h.code))push(o.eye,h.code);
    if(/^(EUH206|EUH031|EUH032|EUH029)$/.test(h.code)){o.mix=true;push(o.mixWhy,h.code)}
  });
  A.groups.forEach(function(g){if(g.neg)return;if(g.g.mix){o.mix=true;push(o.mixWhy,tGrupAd(g.g))}if(g.id==="parfum")o.parfum=true;if(g.g.resp)o.enzyme=true});
  A.subs.forEach(function(x){if(x.s.mix){o.mix=true;push(o.mixWhy,x.s.inci[0])}if(x.s.resp)o.enzyme=true});
  A.inci.forEach(function(x){if(x.fragrance)push(o.fragrance,x.name);if(x.pres)push(o.pres,x.name);if(x.color)push(o.color,x.name)});
  A.subs.forEach(function(x){if(x.s.kind==="koruyucu")push(o.pres,x.s.inci[0])});
  return o;
}
/* Metin temizlik ürünü etiketine benziyor mu? */
function looksCleaning(text){
  var N=" "+tPrep(text)+" ",n=0;
  [/yuzey\s(?:aktif|etken)/,/surfactant/,/(?:^|[^a-z])euh\s?\d{3}/,/(?:^|[^a-z])h\s?3[0-9]{2}(?![0-9])/,/deterjan/,/agartici/,/zeolit/,/fosfonat/,/polikarboksilat/,/optik\s(?:parlatici|beyazlatici|agartici)/,/camasir/,/bulasik/,/yumusatici/,/tehlike/,/cocuklarin\sulasamayacagi/].forEach(function(r){if(r.test(N))n++});
  return n>=2;
}
