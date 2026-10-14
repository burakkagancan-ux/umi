/* Ortak metin araçları: Türkçe harf eşleme, normalleştirme, bantlı Levenshtein. Saf mantık (DOM yok); testler de yükler. */
var TRMAP={"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","â":"a","î":"i","û":"u"};
var UNITS={g:1,mg:1,kg:1,ml:1,kcal:1,kj:1,gr:1,lt:1,cl:1,l:1};
var RANK={red:3,yellow:2,unrated:1,green:0};
var SENT="zzsentzz";
var SEP={"|":1,"(":1,")":1,":":1,"zzsentzz":1};
var ROMAN=["iii","vii","vi","iv","ii","v","i"];
function low(s){return s.replace(/İ/g,"i").replace(/I/g,"ı").toLowerCase().replace(/[çğıöşüâîû]/g,function(c){return TRMAP[c]})}
function norm(s){return low(s).replace(/[^a-z0-9]+/g," ").trim()}
function normText(s){return low(s.replace(/[.!?]+(?=\s|$)/g," "+SENT+" ")).replace(/[,;\[\]\/•·*]+/g," | ").replace(/\(/g," ( ").replace(/\)/g," ) ").replace(/:/g," : ").replace(/[^a-z0-9|():]+/g," ").trim()}
function hasSep(a){for(var i=0;i<a.length;i++)if(SEP[a[i]])return true;return false}
function lev(a,b,max){   // bantlı Levenshtein: yalnızca |i-j|<=max hücreleri; max'ı aşınca max+1 döner
  var n=a.length,m=b.length,INF=max+1;
  if(Math.abs(n-m)>max)return INF;
  var prev=new Array(m+2),cur=new Array(m+2),i,j,tmp;
  for(j=0;j<=m;j++)prev[j]=j<=max?j:INF;prev[m+1]=INF;
  for(i=1;i<=n;i++){
    var lo=Math.max(1,i-max),hi=Math.min(m,i+max),mn=INF,ca=a.charCodeAt(i-1);
    cur[0]=i<=max?i:INF;if(lo>1)cur[lo-1]=INF;if(cur[0]<mn&&lo===1)mn=cur[0];
    for(j=lo;j<=hi;j++){
      var v=prev[j-1]+(ca===b.charCodeAt(j-1)?0:1),x=prev[j]+1;if(x<v)v=x;x=cur[j-1]+1;if(x<v)v=x;
      if(v>INF)v=INF;cur[j]=v;if(v<mn)mn=v;
    }
    cur[hi+1]=INF;
    if(mn>max)return INF;
    tmp=prev;prev=cur;cur=tmp;
  }
  return prev[m]>max?INF:prev[m];
}
/* Kullanıcının kendi yazdığı alerjen (Profilim › Alerjenler): etiket metninde sözcük olarak aranır. Saf mantık (DOM yok).
   Çok sözcüklü ad sırayla aranır; son sözcük 4+ harfse önek gibi eşleşir (kivi → kivili) ve Türkçe ünsüz yumuşaması tutulur
   (fıstık → fıstığı, kebap → kebabı); kısa adlar (et, su) yalnızca tam sözcük. "İçerebilir / may contain / eser miktar"
   geçen cümledeki eşleşme may'e gider. ad bir biçim ya da biçim dizisi olabilir (sözlük karşılıkları); çok sözcüklü biçim önce
   denenir ve tuttuğu sözcükler bir daha sayılmaz ("kiwi fruit" ile "kiwi" aynı yerde iki kez çıkmaz).
   Sonuç: {yes:[...], may:[...]} etikette yazıldığı biçimiyle, tekrarsız. */
var OZEL_YUM={k:"[kg]",p:"[pb]",t:"[td]"};
var OZEL_MAY=/ (icerebilir|iz miktar|eser miktar|may contain|traces?) /;
function ozelAra(metin,ad){
  var o={yes:[],may:[]};
  var bs=[].concat(ad).map(function(a){return norm(a).split(" ").filter(Boolean)}).filter(function(w){return w.length&&w.join("").length>=2})
    .sort(function(a,b){return b.length-a.length}).map(function(w){var s=w[w.length-1];
      return {w:w,s:s,son:s.length>=4?new RegExp("^"+s.slice(0,-1)+(OZEL_YUM[s.slice(-1)]||s.slice(-1))):null}});
  if(!bs.length)return o;
  String(metin||"").split(/[.!?\n]+/).forEach(function(cu){
    var tk=(cu.match(/[0-9A-Za-zÀ-ɏ]+/g)||[]).map(function(x){return {r:x,n:norm(x)}}).filter(function(x){return x.n}),
        kind=OZEL_MAY.test(" "+norm(cu)+" ")?"may":"yes",tut={};
    bs.forEach(function(b){var w=b.w;
      for(var i=0;i+w.length<=tk.length;i++){
        var j=0;while(j<w.length-1&&!tut[i+j]&&tk[i+j].n===w[j])j++;
        if(j<w.length-1||tut[i+j])continue;
        var z=tk[i+j].n;if(!(z===b.s||b.son&&b.son.test(z)))continue;
        var r=tk.slice(i,i+w.length).map(function(x){return x.r}).join(" ");
        for(j=0;j<w.length;j++)tut[i+j]=1;
        if(o[kind].indexOf(r)<0)o[kind].push(r);
      }
    });
  });
  o.may=o.may.filter(function(x){return o.yes.indexOf(x)<0});
  return o;
}
/* Elle eklenen alerjenin dil karşılıkları (data/alerjen_sozluk.json; yüklenince ozelSozlukKur). Yazılan ad sözlükte herhangi bir dildeki
   biçimle aynıysa (harf duyarsız) o kaydın bütün dillerdeki biçimleri aranır (etiketin dili arayüzün dilinden farklı olabilir) ve ad
   seçili dilde gösterilir; sözlükte yoksa yazıldığı gibi. Kayıt yine kullanıcının yazdığı addır, göç gerekmez. */
var OZEL_SOZLUK={};
function ozelSozlukKur(j){OZEL_SOZLUK={};((j&&j.k)||[]).forEach(function(k){Object.keys(k.ad).forEach(function(d){k.ad[d].forEach(function(f){OZEL_SOZLUK[norm(f)]=k})})})}
function ozelKayit(ad){return OZEL_SOZLUK[norm(ad)]||null}
function ozelGoster(ad,dil){var k=ozelKayit(ad);return k&&k.ad[dil]?k.ad[dil][0]:ad}
function ozelAyni(a,b){var x=ozelKayit(a),y=ozelKayit(b);return x||y?x===y:norm(a)===norm(b)}
function ozelAraHepsi(metin,ad){var k=ozelKayit(ad);return ozelAra(metin,k?[].concat.apply([],Object.keys(k.ad).map(function(d){return k.ad[d]})):ad)}
