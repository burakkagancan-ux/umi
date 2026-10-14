/* Gıda: E kodu ve bileşen dizini, içerik listesi analizi, özet, marka eşleşmesi. Saf mantık; testler de yükler. */
/* db: e_kodlari.json; bdb: bilesenler.json (isteğe bağlı). Bileşen kimlikleri "B:" ile başlar. */
function capFirst(s){return s&&s.length?s[0].toLocaleUpperCase('tr')+s.slice(1).toLocaleLowerCase('tr'):s}
/* ABD ve İngiltere yazımı (B-08): ad ve metin sözcükleri tek biçime (İngiltere, AB resmi metni) indirilir. Yalnızca Türkçede karşılığı olmayan İngilizce sözcükler
   (sulfur, yogurt, fiber, gelatin Türkçe sülfür/yoğurt/fiber/jelatin ile çakıştığı için listede yok; iki yazım da veride eş anlamlı). */
var ABD_YAZIM={};("aluminum:aluminium color:colour colors:colours colored:coloured coloring:colouring colorings:colourings flavor:flavour flavors:flavours flavored:flavoured "+
  "flavoring:flavouring flavorings:flavourings sulfate:sulphate sulfates:sulphates sulfite:sulphite sulfites:sulphites sulfide:sulphide bisulfite:bisulphite "+
  "metabisulfite:metabisulphite stabilizer:stabiliser stabilizers:stabilisers stabilized:stabilised caramelized:caramelised pasteurized:pasteurised "+
  "homogenized:homogenised hydrolyzed:hydrolysed autolyzed:autolysed oxidized:oxidised").split(" ").forEach(function(x){x=x.split(":");ABD_YAZIM[x[0]]=x[1]});
function abYazim(s){return s.indexOf(" ")<0?(ABD_YAZIM[s]||s):s.split(" ").map(function(w){return ABD_YAZIM[w]||w}).join(" ")}
function buildIndex(db,bdb){
  var exact=new Map(),nos=new Map(),byK={},ks={1:1,2:1,3:1,4:1},byId={},ctx={},exactEn=new Map(),trKey={},voc={};
  function add(m,k,id){if(!m.has(k))m.set(k,new Set());m.get(k).add(id)}
  function ekle(m,a,it,tr){   // tr: Türkçe/genel eş anlamlı (benzer yazımla da aranır); İngilizce ad (aliases_en, en_only) yalnızca birebir
    if(!it.bil&&/^(e[-\s]?\d|ins\s?\d)/.test(a))return;
    var n=abYazim(norm(a));if(!n||(n.length<3&&!it.short_ok))return;
    if(it.bil&&m.has(n)&&Array.from(m.get(n)).some(function(x){return x.indexOf("B:")!==0}))return;   // E kodu adıyla aynı (ABD yazımı tek biçime inince): bileşen eklenmez, gen_bilesenler.py kuralı
    add(m,n,it.id);if(tr)trKey[n]=1;
    n.split(" ").forEach(function(w){voc[w]=1});
    if(m===exact&&n.indexOf(" ")>-1&&n.length>=8)add(nos,n.replace(/ /g,""),it.id);
  }
  var list=db.ingredients.slice();
  if(bdb)bdb.items.forEach(function(b){list.push({id:"B:"+b.id,bil:b,aliases:b.aliases,aliases_en:b.aliases_en,en_only:b.en_only,short_ok:b.short_ok})});
  list.forEach(function(it){
    byId[it.id]=it.bil?it.bil:it;
    if(it.bil)byId[it.id].isB=true;
    it.aliases.forEach(function(a){ekle(exact,a,it,true)});
    (it.aliases_en||[]).forEach(function(a){ekle(exact,a,it,false)});
    (it.en_only||[]).forEach(function(a){ekle(exactEn,a,it,false)});
    (it.context_aliases||[]).forEach(function(c){
      var k=norm(c.alias);(ctx[k]=ctx[k]||{req:c.requires_any.map(norm),ids:[]}).ids.push(it.id);
    });
  });
  var short1=[];   // kısa tek sözcüklü bileşen adları (alerjen, şeker vb.; E kodu adları hariç: "niasin" -> nisin olmasın). Yalnızca tek adayla benzer yazım ("svt" değil, "susarn" -> susam). İngilizce adlar girmez.
  function grup(ids,n){var k=n.split(" ").length;ks[k]=1;if(n.length>=8){(byK[k]=byK[k]||[]).push({n:n,ids:Array.from(ids)})}return k}
  exact.forEach(function(ids,n){var k=grup(ids,n);
    if(k===1&&trKey[n]&&n.length>=4&&n.length<=8&&!/\d/.test(n))short1.push({n:n,ids:Array.from(ids)})});
  exactEn.forEach(function(ids,n){ks[n.split(" ").length]=1});
  var m=(bdb&&bdb.meta)||{};
  return {exact:exact,nos:nos,exactEn:exactEn,voc:voc,byK:byK,short1:short1,ks:Object.keys(ks).map(Number),byId:byId,ctx:ctx,
    bmeta:m,may:(m.may_triggers||[]),mayFwd:(m.may_forward||[]),neg:(m.negations||[]),negPre:(m.neg_prefix||[]),aromaNext:(m.aroma_next||[])};
}
function codeId(cand,idx){
  var list=[cand];ROMAN.forEach(function(r){if(cand.length-r.length>=4&&cand.slice(-r.length)===r)list.push(cand.slice(0,-r.length))});
  for(var q=0;q<list.length;q++){
    var m=/^e([0-9oli]{3,4})([a-z]?)$/.exec(list[q]);if(!m)continue;
    if((m[1].match(/[0-9]/g)||[]).length<2)continue;
    var digits=m[1].replace(/o/g,"0").replace(/[li]/g,"1");
    var id="E"+digits+m[2];
    if(idx.byId[id])return {id:id,fixed:digits!==m[1]};
  }
  return null;
}
function findCodes(tok,idx){
  var out=[],i,k;
  for(i=0;i<tok.length;i++){
    if(!/^e([0-9oli]|$)/.test(tok[i]))continue;
    if(/^vitamini?$/.test(tok[i-1]||""))continue;
    for(k=2;k>=0;k--){
      if(i+k>=tok.length)continue;
      var part=tok.slice(i,i+k+1);if(hasSep(part))continue;
      var hit=codeId(part.join(""),idx);if(!hit)continue;
      var nx=tok[i+k+1];if(nx&&UNITS[nx])break;
      out.push({a:i,b:i+k+1,ids:[hit.id],how:"kod",fixed:hit.fixed,text:part.join(" ")});
      i+=k;break;
    }
  }
  return out;
}
var OCRDF={"0":"o","1":"l","5":"s","8":"b","6":"g"};
function ocrFixF(w,voc){   // voc verilirse sözlükte zaten olan (gerçek) sözcük değiştirilmez: "corn" -> "com" olmaz
  return w.split(" ").map(function(x){
    if(voc&&voc[x])return x;
    if(x.indexOf("rn")>-1&&x.indexOf("karnauba")<0)x=x.replace(/rn/g,"m");
    if(/\d/.test(x)&&(x.match(/[a-z]/g)||[]).length>=3)x=x.replace(/\d+(?=[a-z])/g,function(ds){return ds.replace(/\d/g,function(d){return OCRDF[d]||d})});
    return x;
  }).join(" ");
}
/* İngilizce tekil/çoğul: son sözcüğün biçimleri ("sodium citrate" <-> "sodium citrates", "tomatoes" -> "tomato"). Yalnızca İngilizce metinde, birebir aramada. */
function enCogul(w){
  var p=w.split(" "),l=p[p.length-1],v=[],b=p.slice(0,-1);
  if(l.length<4||/\d/.test(l))return v;
  if(/ies$/.test(l))v.push(l.slice(0,-3)+"y");
  if(/(ch|sh|x|o|ss)es$/.test(l))v.push(l.slice(0,-2));
  if(/[^s]s$/.test(l))v.push(l.slice(0,-1));
  else{v.push(l+"s");if(/(ch|sh|x|o|ss)$/.test(l))v.push(l+"es");if(/[^aeiou]y$/.test(l))v.push(l.slice(0,-1)+"ies")}
  return v.map(function(x){return b.concat(x).join(" ")});
}
function cogulCift(a,b){return a+"s"===b||b+"s"===a||a+"es"===b||b+"es"===a}
/* Yalnızca son ek farkı (aynı kök + farklı İngilizce ek): biçim ya da kimyasal ad farkıdır, yazım hatası değil.
   sweeten-ed/-er, nitr-ate/-ite, cellul-ase/-ose, chlor-ide/-ate, ferr-ic/-ous, invert/invert-ed. Sondaki tek harf eksiği/fazlası (OCR) bu kurala girmez. */
var SONEK=["ed","er","ing","ate","ite","ide","ase","ose","ic","ous"];
function sonEkFarki(a,b){
  var ek=[""].concat(SONEK);
  for(var i=0;i<ek.length;i++){var s1=ek[i];if(a.length-s1.length<3||a.slice(a.length-s1.length)!==s1)continue;
    var kok=a.slice(0,a.length-s1.length);if(b.indexOf(kok)!==0)continue;
    var s2=b.slice(kok.length);if(s2!==s1&&(s2===""||SONEK.indexOf(s2)>-1)&&(s1!==""||s2!==""))return true}
  return false;
}
function tekHarfKisa(a,b){return b.length===a.length+1&&b.indexOf(a)===0}   // "soy" -> "soya", "yag" -> "yagi": sondaki harf okunmamış
/* İngilizce görünen metin: "ingredients", "contains", "allergens" sözcükleri ya da İngilizce bağlaçların Türkçelerden belirgin fazla olması */
var EN_KESIN={ingredients:1,ingredient:1,contains:1,allergens:1,allergy:1};
var EN_SOZ={and:1,of:1,with:1,from:1,contains:1,contain:1,may:1,including:1,the:1,"for":1,or:1};
var TR_SOZ={ve:1,ile:1,icindekiler:1,icerir:1,icerebilir:1,bilesenler:1,veya:1,icin:1,bu:1,urun:1};
function enBaslik(w){return w.length>=10&&w.length<=12&&(w[0]==="i"||w[0]==="l")&&lev(w,"ingredients",2)<=2}   // OCR'lı başlık: "lngredlents"
function enMetin(tok){
  var e=0,r=0;
  for(var i=0;i<tok.length;i++){var w=tok[i];if(EN_KESIN[w]||enBaslik(w))return true;if(EN_SOZ[w])e++;else if(TR_SOZ[w])r++}
  return e>=2&&e>2*r;
}
function riskOf(ids,idx){var r=-1;ids.forEach(function(id){var it=idx.byId[id];if(!it.isB)r=Math.max(r,RANK[it.risk_level])});return r}
/* Benzer yazım (08.10.2026'ya kadar ilk aday alınırdı; "sodium citrate" -> E250 sodium nitrite). Kurallar (B-08, 08.10.2026):
   1) Metindeki sözcük sözlükte gerçek bir sözcükse (başka bir maddenin adında geçiyorsa) değiştirilmez; yalnızca İngilizce tekil/çoğul farkı ve
      (Türkçe metinde) sondaki tek harf eksiği serbest ("soy sütü" -> soya sütü, "yağ" -> yağı).
   2) Her sözcükte en çok 1 harf farkı (10 harf ve üstü sözcükte 2); fark yalnızca son ekteyse (sonEkFarki) eşleşme yok.
   3) En yakın aday alınır; aynı uzaklıkta farklı madde varsa eşleşme yok (belirsiz).
   4) Benzer yazım risk yükseltemez: daha düşük riskli farklı bir aday bir harf daha uzaktaysa bile eşleşme yok. */
function benzerAday(w,list,tol,idx,en){
  var ws=w.split(" "),best=null,bd=tol+1,amb=false,adaylar=[];
  for(var q=0;q<list.length;q++){
    var c=list[q];if(c.n[0]!==w[0]||Math.abs(c.n.length-w.length)>tol)continue;
    var d=lev(w,c.n,tol);if(!(d>0&&d<=tol))continue;
    var cs=c.n.split(" "),ok=cs.length===ws.length;
    for(var j=0;ok&&j<ws.length;j++){
      if(ws[j]===cs[j]||cogulCift(ws[j],cs[j]))continue;
      if((idx.voc[ws[j]]&&!(!en&&tekHarfKisa(ws[j],cs[j])))||sonEkFarki(ws[j],cs[j])){ok=false;break}
      var cap=ws[j].length>=10?2:1;if(lev(ws[j],cs[j],cap)>cap)ok=false;
    }
    if(!ok)continue;
    adaylar.push({c:c,d:d});
    if(d<bd){bd=d;best=c;amb=false}else if(d===bd&&best.ids.join()!==c.ids.join())amb=true;
  }
  if(!best||amb)return null;
  var r=riskOf(best.ids,idx);
  for(q=0;q<adaylar.length;q++){var a=adaylar[q];if(a.d<=bd+1&&a.c.ids.join()!==best.ids.join()&&riskOf(a.c.ids,idx)<r)return null}
  return best;
}
function findNames(tok0,idx,en){
  var out=[],i,voc=idx.voc||{},tok=en?tok0.map(abYazim):tok0;   // ABD yazımı yalnızca İngilizce metinde tek biçime iner
  function ex(k){return idx.exact.get(k)||(en&&idx.exactEn&&idx.exactEn.get(k))}
  idx.ks.forEach(function(k){
    for(i=0;i+k<=tok.length;i++){
      var part=tok.slice(i,i+k);if(hasSep(part))continue;
      var w=part.join(" "),ow=tok0.slice(i,i+k).join(" "),hit=ex(w);
      if(!hit&&k<=4)hit=idx.nos.get(part.join(""));
      if(hit){out.push({a:i,b:i+k,ids:Array.from(hit),how:"isim",text:ow});continue}
      if(en){var cv=enCogul(w),q1;for(q1=0;q1<cv.length&&!hit;q1++)hit=ex(cv[q1]);
        if(hit){out.push({a:i,b:i+k,ids:Array.from(hit),how:"isim",text:ow,alias:cv[q1-1]});continue}}
      var fx=ocrFixF(w,voc);   // sık OCR karışmaları: "rn"->"m", harf arasındaki rakam ("5itrik", "fınd1k"); sözlükteki gerçek sözcük değişmez
      if(fx!==w&&(hit=ex(fx))){out.push({a:i,b:i+k,ids:Array.from(hit),how:"benzer",text:ow,alias:fx});continue}
      if(k===1&&w.length>=5&&w.length<8&&idx.short1){
        if(en||voc[w])continue;   // İngilizce metinde kısa sözcükte benzer yazım yok (batter -> butter); gerçek sözcük değiştirilmez
        var one=null,many=false;
        for(var q0=0;q0<idx.short1.length&&!many;q0++){var c0=idx.short1[q0];
          if((c0.n[0]!==fx[0]&&!(/[il]/.test(c0.n[0])&&/[il]/.test(fx[0])))||Math.abs(c0.n.length-fx.length)>1)continue;
          if(fx.indexOf(c0.n)===0||c0.n.indexOf(fx)===0)continue;   // yalnızca sondaki ek farkı: Türkçe çekim eki olabilir ("alkolü" -> alkol değil)
          if(lev(fx,c0.n,1)===1){if(one&&one.ids.join()!==c0.ids.join())many=true;else one=c0}}
        if(one&&!many&&one.ids.every(function(x){return x.indexOf("B:")===0}))out.push({a:i,b:i+k,ids:one.ids,how:"benzer",text:ow,alias:one.n});
        continue;
      }
      var list=idx.byK[k];if(!list||w.length<8)continue;
      var c=benzerAday(w,list,w.length>=12?2:1,idx,en);
      if(c)out.push({a:i,b:i+k,ids:c.ids,how:"benzer",text:ow,alias:c.n});
    }
  });
  return out;
}
function findContext(tok,idx){
  var out=[];
  tok.forEach(function(tk,i){
    var c=idx.ctx[tk];if(!c)return;
    var prev=[];
    for(var j=i-1;j>=0&&prev.length<4;j--){if(tok[j]==="|"||tok[j]===")"||tok[j]===SENT)break;if(SEP[tok[j]])continue;prev.unshift(tok[j])}
    var s=" "+prev.join(" ")+" ";
    if(c.req.some(function(r){return s.indexOf(" "+r+" ")>-1}))out.push({a:i,b:i+1,ids:c.ids.slice(),how:"isim",text:tk});
  });
  return out;
}
/* "Eser miktarda ... içerebilir" bölgeleri: token aralıkları [a,b) */
function mayZones(tok,idx){
  var z=[],trig={},fwd={};idx.may.forEach(function(tg){trig[tg]=1});(idx.mayFwd||[]).forEach(function(tg){fwd[tg]=1});
  function sentStart(i){for(var j=i-1;j>=0;j--)if(tok[j]===SENT)return j+1;return 0}
  function sentEnd(i){for(var j=i+1;j<tok.length;j++)if(tok[j]===SENT)return j;return tok.length}
  for(var i=0;i<tok.length;i++){
    var tk=tok[i],two=tk+" "+(tok[i+1]||"");
    if(tk==="eser"){z.push([i,sentEnd(i)]);continue}
    if(fwd[two]||fwd[two+" "+(tok[i+2]||"")]){z.push([i,sentEnd(i)]);continue}   // İngilizce "may contain …": ileriye, cümle sonuna kadar
    if(trig[two]){var s=sentStart(i),e=sentEnd(i);z.push([Math.max(s,i-12),Math.min(e,i+14)]);continue}
    if(trig[tk]){
      var s0=sentStart(i),st=Math.max(s0,i-10);
      for(var j=i-1;j>=s0;j--)if(tok[j]==="eser"){st=j;break}
      z.push([st,i]);
    }
  }
  return z;
}
// Olumsuzluk: madde ile "içermez" arasında geçebilecek sözcükler ve maddeleri bağlayan sözcükler
var NEGFILL={kaynakli:1,kokenli:1,menseli:1,madde:1,maddesi:1,maddeler:1,maddeleri:1,urun:1,urunu:1,urunleri:1,eti:1,yagi:1,yaglari:1,turevi:1,turevleri:1,katki:1,katkisi:1,katkilar:1,katkilari:1,bilesen:1,bileseni:1,bilesenler:1,bilesenleri:1,hicbir:1,kesinlikle:1,iz:1,miktarda:1};
var NEGJOIN={ve:1,veya:1,ile:1,ya:1,da:1,de:1,hem:1,ne:1,"|":1,and:1,or:1,nor:1};
function analyze(text,idx){
  var tok=normText(text).split(" ").filter(Boolean),en=enMetin(tok);
  var all=findCodes(tok,idx).concat(findNames(tok,idx,en),findContext(tok,idx));
  var pr={kod:3,isim:2,benzer:1};
  all.sort(function(x,y){return (y.b-y.a)-(x.b-x.a)||pr[y.how]-pr[x.how]});
  var used={},kept=[];
  all.forEach(function(m){
    for(var i=m.a;i<m.b;i++)if(used[i])return;
    for(i=m.a;i<m.b;i++)used[i]=1;kept.push(m);
  });
  // Genel ad ("modifiye mısır nişastası") hemen ardından parantezli/yanında E kodu gelirse (E1422) ad, kodun kendisi olur: çift kart olmaz
  kept=kept.filter(function(m){
    if(m.how==="kod"||m.ids.length<2)return true;
    return !kept.some(function(c){return c.how==="kod"&&m.ids.indexOf(c.ids[0])>-1&&(c.a===m.b||(c.a===m.b+1&&tok[m.b]==="("))});
  });
  // Besin değerleri tablosu satırı ("Tuz 1,2 g", "Şeker 30 g"): ad + sayı + birim -> bileşen sayılmaz
  kept=kept.filter(function(m){
    if(!/^\d/.test(tok[m.b]||""))return true;
    if(/^\d+(g|mg|kg|ml|kcal|kj)$/.test(tok[m.b]))return false;   // "Salt 0.5g" -> "0 5g"
    for(var q=m.b+1;q<=m.b+4&&q<tok.length;q++){if(UNITS[tok[q]]||/^\d+(g|mg|kg|ml|kcal|kj)$/.test(tok[q]))return false;if(!/^\d/.test(tok[q])&&tok[q]!=="|")break}
    return true;
  });
  // İçerik listesindeki sıra (bileşenler çoktan aza yazılır): "İçindekiler:" sonrası, ayraç dışındaki virgüller sayılır
  var st=0;for(var q0=0;q0<tok.length;q0++)if(tok[q0]==="icindekiler"||tok[q0]==="bilesenler"||tok[q0]==="ingredients"){st=q0+1;break}
  kept.forEach(function(m){
    if(m.a<st)return;
    var dep=0,n=1;
    for(var q=st;q<m.a;q++){var tk=tok[q];if(tk==="(")dep++;else if(tk===")")dep=Math.max(0,dep-1);else if(tk===SENT&&dep===0){n=0;break}else if(tk==="|"&&dep===0)n++}
    if(n)m.ord=n;
  });
  var zones=mayZones(tok,idx),negs={},arn={},npre={};
  idx.neg.forEach(function(n){negs[n]=1});idx.aromaNext.forEach(function(n){arn[n]=1});(idx.negPre||[]).forEach(function(n){npre[n]=1});
  kept.forEach(function(m){
    m.may=zones.some(function(z){return m.a>=z[0]&&m.a<z[1]});
    var n1=tok[m.b]||"",n2=tok[m.b+1]||"";
    m.neg=!!(negs[n1]||negs[n1+" "+n2]||(negs[n2]&&!SEP[n1]&&n1!=="ve"));   // iki sözcüklü olumsuzluk: "ilave edilmemiştir"
    if(!m.neg){var q=m.b;while(q<m.b+5&&(NEGFILL[tok[q]]||(NEGJOIN[tok[q]]&&tok[q]!=="|")))q++;m.neg=q>m.b&&!!(negs[tok[q]]||negs[tok[q]+" "+(tok[q+1]||"")])}   // "domuz kaynaklı madde içermez"
    if(!m.neg&&en){var p1=tok[m.a-1]||"",p2=tok[m.a-2]||"";m.neg=m.pre=!!(npre[p1]||npre[p2+" "+p1]||(p1===":"&&npre[p2+" "+(tok[m.a-3]||"")]))}   // İngilizce önden olumsuzluk: "no added sugar", "free from milk"
    m.aroma=!!(arn[n1]&&m.ids.every(function(id){var it=idx.byId[id];return it.isB&&!it.upf_class}));
  });
  // Sıralı olumsuzluk: "alkol ve domuz içermez", "koruyucu, renklendirici içermez" -> öndeki maddeler de olumsuz.
  // Virgülle bağlı zincir yalnızca içerik listesi dışında ve en çok 4 maddeyse (noktası okunmamış liste sonu yanlışlıkla olumsuz sayılmasın).
  var byPos=kept.slice().sort(function(x,y){return x.a-y.a}),inList=function(a){for(var q=a-1;q>=0&&tok[q]!==SENT;q--)if(tok[q]===":"||tok[q]==="icindekiler"||tok[q]==="bilesenler"||tok[q]==="ingredients")return true;return false};
  for(var k=byPos.length-2;k>=0;k--){
    var m=byPos[k],nx=byPos[k+1];
    if(m.neg||!nx.neg||nx.a<m.b)continue;
    var ok=true,comma=false;
    for(var q=m.b;q<nx.a;q++){if(tok[q]==="|")comma=true;else if(!NEGJOIN[tok[q]]){ok=false;break}}
    if(!ok)continue;
    if(comma){if(inList(m.a))continue;var c=1;for(var j=k+1;j<byPos.length&&byPos[j].neg&&j-k<5;j++)c++;if(c>4)continue}
    m.neg=true;
  }
  // İngilizce önden olumsuzluğun ardından gelenler: "free from milk, egg and gluten" (içerik listesi dışında, en çok 4 madde)
  for(k=0;k<byPos.length-1;k++){
    m=byPos[k];if(!m.pre||inList(m.a))continue;
    for(j=k+1,c=1;j<byPos.length&&c<4;j++,c++){
      nx=byPos[j];ok=nx.a>=byPos[j-1].b;
      for(q=byPos[j-1].b;ok&&q<nx.a;q++)if(!NEGJOIN[tok[q]])ok=false;
      if(!ok)break;nx.neg=true;
    }
  }
  var merged={};
  kept.forEach(function(m){
    var key=m.ids.slice().sort().join("+")+"/"+(m.neg?"n":"")+(m.may?"m":"")+(m.aroma?"a":"");
    var cur=merged[key],ps=(cur?cur.poslar:[]).concat(m.a);
    if(!cur||pr[m.how]>pr[cur.how])merged[key]=m;
    merged[key].poslar=ps;
  });
  var res=Object.keys(merged).map(function(k){
    var m=merged[k],isB=idx.byId[m.ids[0]].isB;
    var lv=isB?-1:Math.max.apply(null,m.ids.map(function(id){return RANK[idx.byId[id].risk_level]}));
    return {ids:m.ids,how:m.how,fixed:!!m.fixed,text:m.text,alias:m.alias,rank:lv,isB:isB,may:m.may,neg:m.neg,aroma:m.aroma,pos:m.a,poslar:m.poslar,ord:m.ord};
  });
  res.sort(function(x,y){return y.rank-x.rank||x.pos-y.pos});
  return res;
}
/* Analiz sonucunu özet bilgiye çevirir: şeker, palm, UPF, alerjen, laktoz, vegan, vejetaryen */
/* Ekranda maddenin adı: E kodunda seçili dildeki resmi ad (İngilizcede name_en), bileşende veri çevirisi; yoksa Türkçe */
function itAd(it){return it.isB?veriS(it.name,"b."+it.id+".ad"):veriS(it.primary_name,"e."+it.id+".ad",{en:it.name_en})}
function summarize(res,idx){
  var bm=idx.bmeta,upfE=bm.upf_e_categories||{};
  var o={sugar:[],palm:[],upf:{},allergen:{},lactose:{yes:[],low:[],may:[]},vegan:{no:[],unsure:[]},veg:{no:[],insect:[],unsure:[]},claims:[],cancer:[],
    life:{caffeine:[],alcohol:[],alcoholTrace:[],raw:[],honey:[],sweet:[],hyper:[],phe:[],pet:[]},
    sodium:{salt:[],hidden:[],saltOrd:null}};
  var LF=o.life;
  function has(fl,f){return fl.indexOf(f)>-1}
  function al(f,kind,name){var a=o.allergen[f]=o.allergen[f]||{yes:[],may:[]};if(a[kind].indexOf(name)<0)a[kind].push(name)}
  function push(arr,v){if(arr.indexOf(v)<0)arr.push(v)}
  res.forEach(function(r){
    r.ids.forEach(function(id){
      var it=idx.byId[id],bn=itAd(it),name=it.isB?bn:(it.id+" "+bn),fl=it.flags||[];
      if(r.neg){push(o.claims,t("gida.ozet.icermez",{ad:bn}));return}
      if(!it.isB&&it.reason&&/kanserojen/.test(it.reason)&&!/Grup 3/.test(it.reason))push(o.cancer,{name:name,may:r.may});   // maddenin kendisi IARC 1/2A/2B; benzoatların benzen notu (koşula bağlı) sayılmaz
      if(it.isB){
        if(r.aroma){
          fl.forEach(function(f){if(f.indexOf("allergen_")===0)al(f,"may",name+" (aroma)")});
          if(fl.indexOf("lactose")>-1)push(o.lactose.may,name+" (aroma)");
          if(fl.indexOf("non_vegan")>-1)push(o.vegan.unsure,name+" (aroma)");
          if(fl.indexOf("non_vegetarian")>-1)push(o.veg.unsure,name+" (aroma)");
          return;
        }
        fl.forEach(function(f){if(f.indexOf("allergen_")===0)al(f,r.may?"may":"yes",bn)});
        if(r.may){if(fl.indexOf("lactose")>-1)push(o.lactose.may,bn);return}
        if(fl.indexOf("sugar")>-1)o.sugar.push({name:bn,hidden:fl.indexOf("sugar_hidden")>-1,text:r.text});
        if(fl.indexOf("palm")>-1)push(o.palm,bn);
        if(it.upf_class)(o.upf[it.upf_class]=o.upf[it.upf_class]||[]).push(capFirst(r.text));
        if(fl.indexOf("lactose")>-1)push(o.lactose.yes,bn);
        if(fl.indexOf("lactose_low")>-1)push(o.lactose.low,bn);
        if(fl.indexOf("non_vegan")>-1)push(o.vegan.no,bn);
        if(fl.indexOf("vegan_suspect")>-1)push(o.vegan.unsure,bn);
        if(fl.indexOf("non_vegetarian")>-1)push(o.veg.no,bn);
        if(fl.indexOf("vegetarian_suspect")>-1||fl.indexOf("vegan_suspect")>-1)push(o.veg.unsure,bn);
        if(has(fl,"caffeine"))push(LF.caffeine,bn);
        if(has(fl,"alcohol"))push(LF.alcohol,bn);
        if(has(fl,"alcohol_trace"))push(LF.alcoholTrace,bn);
        if(has(fl,"raw_milk"))push(LF.raw,bn);
        if(has(fl,"infant_honey"))push(LF.honey,bn);
        if(has(fl,"pet_toxic"))push(LF.pet,bn);
        if(has(fl,"salt")){push(o.sodium.salt,r.text);if(r.ord&&(o.sodium.saltOrd===null||r.ord<o.sodium.saltOrd))o.sodium.saltOrd=r.ord}
        if(has(fl,"sodium_hidden"))push(o.sodium.hidden,bn);
        if(it.upf_class==="tatlandırıcı")push(LF.sweet,bn);
      }else{
        var txt=" "+r.text+" ",kind=r.may?"may":"yes";
        if(fl.indexOf("allergen_sulphite")>-1)al("allergen_sulphite",kind,name);
        if(fl.indexOf("allergen_egg")>-1)al("allergen_egg",kind,name);
        if(fl.indexOf("allergen_soy_possible")>-1&&!/ (aycicek|aycicegi|kolza|sunflower|rapeseed|canola|yumurta|egg) /.test(txt))   // kaynağı yazan lesitin: ayçiçek/kolza/yumurta ise soya şüphesi yok
          al("allergen_soy",txt.indexOf(" soy")>-1?kind:"may",txt.indexOf(" soy")>-1?name:t("gida.soya_olabilir",{ad:name}));   // "soya lesitini", "soy lecithin"
        if(/ (bugday|wheat) /.test(txt))al("allergen_gluten",kind,name);   // "modifiye buğday nişastası", "modified wheat starch": buğday AB 1169/2011 Ek II muafiyetinde değil
        if(r.may)return;
        var cl=upfE[it.category];if(cl)(o.upf[cl]=o.upf[cl]||[]).push(capFirst(it.id));
        if(fl.indexOf("non_vegan")>-1)push(o.vegan.no,name);
        if(fl.indexOf("vegan_suspect")>-1){push(o.vegan.unsure,name);push(o.veg.unsure,name)}
        if(fl.indexOf("insect_derived")>-1)push(o.veg.insect,name);
        else if(fl.indexOf("non_vegetarian")>-1)push(o.veg.no,name);
        if(has(fl,"hyperactivity"))push(LF.hyper,name);
        if(has(fl,"phenylalanine"))push(LF.phe,name);
        if(has(fl,"pet_risk"))push(LF.pet,name);
        if(has(fl,"sodium"))push(o.sodium.hidden,name);
        if(it.category==="Tatlandırıcı")push(LF.sweet,name);
      }
    });
  });
  var genel=idx.byId["B:upf_sinif_tatlandirici"],ga=genel?itAd(genel):"";
  if(LF.sweet.length>1)LF.sweet=LF.sweet.filter(function(x){return x!==ga});   // genel "tatlandırıcı" sözcüğü, adı geçen tatlandırıcı varken tekrar edilmez
  return o;
}
/* Bakanlık listesindeki marka adlarını metinde arar (yalnızca bilgi amaçlı bağlantı) */
var GENERIC=("sut urunleri urun gida ciftlik ciftligi mandira mandirasi koy koyu koop doga dogal yore yoresel kasap kasabi lokma petek royal elmas zirve sirin damar fidan sacak pelit yildiz makbul gurme baharat baharatlari peynir peyniri sucuk sucugu et eti bal bali zeytinyagi sizma naturel taze tam yagli kasar isil islem gormus ve ltd sti san tic sanayi ticaret limited sirketi organik ev evi evim lezzet lezzeti anadolu ege karadeniz akdeniz altin ozel premium gold super hakiki asil nefis kral sultan saray tatli aile usta has saf tabii kuzu kinali yaylasi yayla yag yagi tereyagi kaymak yogurt ayran helva lokum pekmez tahin firin firini unlu mamulleri kahve cay bitki market gurme lezzetleri kofte doner tavuk dana sigir tadinda tadi kekik oregano zeytin bahcesi keyif zamani dunyasi natural siyah mevsimsel park gross pek ala al guven sera lop i ehl urla binbir since life balance kids hayat ornek harika mutlu cenneti piknik").split(" ");
function buildBrands(tg){
  var stop={},map={};GENERIC.forEach(function(w){stop[w]=1});
  var recs=[];Object.keys(tg.listeler||{}).forEach(function(k){recs=recs.concat(tg.listeler[k]||[])});
  recs.forEach(function(r){[r.FirmaIl,r.FirmaIlce].forEach(function(x){if(x)norm(x).split(" ").forEach(function(w){stop[w]=1})})});
  recs.forEach(function(r){
    var raw=(r.Marka||"").trim();if(!raw||raw==="-")return;
    var w=norm(raw).split(" ").filter(Boolean);if(!w.length)return;
    if(w.length>4)w=w.slice(0,2);
    if(w.every(function(x){return stop[x]||/^\d+$/.test(x)}))return;
    var p=w.join(" ");
    if(w.length===1&&p.length<5)return;
    if(p.length<6&&w.length>1)return;
    var e=map[p]=map[p]||{label:raw,q:w.length>2||raw.length<=40?raw:w.join(" "),n:0};e.n++;
  });
  return map;
}
function findBrands(text,brands){
  var tok=normText(text).split(" ").filter(Boolean).map(function(tk){return SEP[tk]?"|":tk}),s=" "+tok.join(" ")+" ",out=[];
  Object.keys(brands).forEach(function(p){if(s.indexOf(" "+p+" ")>-1)out.push(brands[p])});
  return out;
}

/* Üretim yolu (05.10.2026): risk rengini değiştirmez, gri bilgi etiketi. dogal ve belirsiz için etiket yok. */
var URETIM_AD={sentetik:"gida.uretim.sentetik",islenmis:"gida.uretim.islenmis",fermente:"gida.uretim.fermente"};   // çeviri anahtarları
function uretimSinif(ids,idx){   // birden çok olası kod varsa hepsi aynı sınıftaysa
  var s=null;
  for(var i=0;i<ids.length;i++){var it=idx.byId[ids[i]];if(!it||it.isB||!it.uretim)return null;if(s&&s!==it.uretim.s)return null;s=it.uretim.s}
  return URETIM_AD[s]?s:null;
}
/* Yeşil onay simgesi yalnızca üretim yolu "doğal" olan uyarısız maddede (ansiklopedi, sonuç, karşılaştırma aynı kural); diğer uyarısızlar gri tire */
function uretimDogal(ids,idx){return ids.length>0&&ids.every(function(id){var it=idx.byId[id];return it&&!it.isB&&it.uretim&&it.uretim.s==="dogal"})}
function uretimOzet(res,idx){
  var o={sentetik:[],islenmis:[],fermente:[]},seen={};
  res.forEach(function(r){
    if(r.neg||r.may)return;
    var s=uretimSinif(r.ids,idx),k=r.ids.slice().sort().join("+");
    if(!s||seen[k])return;seen[k]=1;
    o[s].push(r.ids.map(function(id){return idx.byId[id].id}).join("/"));
  });
  return o;
}
function uretimMetin(o){
  var p=[];["sentetik","islenmis","fermente"].forEach(function(s){if(o[s].length)p.push(t("gida.uretim.say_"+s,{n:o[s].length}))});
  return p.join(", ");
}
