/* Aylık özet (YOL_HARITASI.md U-09, 21.10.2026): saf mantık (DOM yok), testli (test/aylik.js). Arayüz js/arayuz_aylik.js.
   Yalnızca cihazdaki kayıttan hesaplanır, sunucuya bir şey gitmez; puan yok. localStorage "aylik" (VERI_ANAHTAR):
   {v:1, ay:{"YYYY-AA":{u:{<tarama kimliği>:{m:tür, r:0|1|2, k:[[anahtar, ad, ansiklopedi kimliği|null, sıra 2|3]]}}, e:{<barkod>:1}, z:[[aile, tür, kademe, ad anahtarı]]}}}
   r: ürünün en yüksek düzeyi (2 uyarı, 1 dikkat, 0 özel uyarı yok). Ürün tarama geçmişindeki kimliğiyle sayılır: aynı ürün (aynı tür + metin)
   ya da elle düzeltmesi aynı ayda bir kez; başka ayda yeniden okutulursa o ayda da sayılır. Tarama geçmişi silinince ya da 20 kayıtla kesilince
   özet değişmez (ayrı kayıt). */
export var AYLIK_SURUM=1;
export var AYLIK_AYAR={enFazlaAy:24,enFazlaUrun:1000,enFazlaMadde:40,enSik:5};
export function ayAnahtar(ms){var d=new Date(ms);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")}
/* "YYYY-AA" ± n ay */
export function ayKaydir(ay,n){var m=/^(\d{4})-(\d{2})$/.exec(ay||"");if(!m)return ay;var d=new Date(+m[1],+m[2]-1+n,1);return ayAnahtar(d.getTime())}
export function ayZaman(ay){var m=/^(\d{4})-(\d{2})$/.exec(ay||"");return m?new Date(+m[1],+m[2]-1,1).getTime():0}
var TURLER={gida:1,koz:1,tem:1};
/* Bozuk ya da eski kaydı geçerli biçime getirir (okurken; geçersiz kısımlar atılır) */
export function aylikNorm(o){
  var r={v:AYLIK_SURUM,ay:{}};
  if(!o||typeof o!=="object"||!o.ay||typeof o.ay!=="object")return r;
  Object.keys(o.ay).forEach(function(ay){
    if(!/^\d{4}-\d{2}$/.test(ay))return;var a=o.ay[ay];if(!a||typeof a!=="object")return;
    var n={u:{},e:{},z:[]};
    if(a.u&&typeof a.u==="object")Object.keys(a.u).forEach(function(id){var x=a.u[id];
      if(x&&TURLER[x.m]&&(x.r===0||x.r===1||x.r===2))n.u[id]={m:x.m,r:x.r,k:Array.isArray(x.k)?x.k.filter(function(k){return Array.isArray(k)&&typeof k[0]==="string"&&typeof k[1]==="string"&&(k[3]===2||k[3]===3)&&(k[2]==null||typeof k[2]==="string")}):[]}});
    if(a.e&&typeof a.e==="object")Object.keys(a.e).forEach(function(k){if(/^\d{6,14}$/.test(k))n.e[k]=1});
    if(Array.isArray(a.z))n.z=a.z.filter(function(z){return Array.isArray(z)&&/^[a-z]{2,20}$/.test(z[0])&&/^[a-z]{2,8}$/.test(z[1])&&z[2]===(z[2]|0)&&z[2]>0&&z[2]<=20&&(z[3]==null||typeof z[3]==="string")});
    r.ay[ay]=n;
  });
  return aylikBudama(r);
}
function aylikBudama(o){
  var ay=Object.keys(o.ay).sort();
  ay.slice(0,Math.max(0,ay.length-AYLIK_AYAR.enFazlaAy)).forEach(function(a){delete o.ay[a]});
  return o;
}
function ayAl(o,ms){var a=ayAnahtar(ms);if(!o.ay[a])o.ay[a]={u:{},e:{},z:[]};return o.ay[a]}
/* Ürün modelinden (js/degerlendirme.js degerlendir) ayın kaydı: düzey ve uyarı/dikkat düzeyindeki maddeler.
   ans(item): maddenin ansiklopedi kimliği ya da null (arayüz verir; veri türe göre farklı dizinde) */
export function aylikUrun(P,ans){
  var c=P&&P.counts||[],r=c[3]?2:c[2]?1:0,k=[];
  (P&&P.items||[]).forEach(function(it){if(it.rank>=2&&k.length<AYLIK_AYAR.enFazlaMadde)k.push([String(it.key),String(it.name),ans?ans(it)||null:null,it.rank])});
  return {m:P.mode,r:r,k:k};
}
/* Tarama: aynı kimlik aynı ayda üzerine yazılır (elle düzeltme, öneri kartıyla tür değişimi) */
export function aylikTarama(o,ms,id,urun){
  o=aylikNorm(o);if(!id||!urun||!TURLER[urun.m])return o;
  var a=ayAl(o,ms);
  if(!a.u[id]&&Object.keys(a.u).length>=AYLIK_AYAR.enFazlaUrun)return o;
  a.u[id]=urun;return aylikBudama(o);
}
/* Tarama kimliğini bir ayın kaydından siler (öneri kartıyla taşınan tarama hedef türdeki aynı kayda katılınca) */
export function aylikSil(o,ms,id){o=aylikNorm(o);var a=o.ay[ayAnahtar(ms)];if(a&&a.u[id])delete a.u[id];return o}
/* Bu cihazdan gönderilen barkod katkısı (aynı barkod ayda bir) */
export function aylikKatki(o,ms,kod){o=aylikNorm(o);kod=String(kod||"");if(!/^\d{6,14}$/.test(kod))return o;ayAl(o,ms).e[kod]=1;return aylikBudama(o)}
/* Yeni rozet kademesi (rozetYeni sonucu: aile, tur, kademe, ad) */
export function aylikRozet(o,ms,r){
  o=aylikNorm(o);if(!r||!r.aile||!r.tur||!r.kademe)return o;
  var a=ayAl(o,ms);if(!a.z.some(function(z){return z[0]===r.aile&&z[1]===r.tur&&z[2]===r.kademe}))a.z.push([r.aile,r.tur,r.kademe,String(r.ad||"")]);
  return aylikBudama(o);
}
/* Kaydı olan aylar, eskiden yeniye */
export function aylikAylar(o){o=aylikNorm(o);return Object.keys(o.ay).filter(function(a){var x=o.ay[a];return Object.keys(x.u).length||Object.keys(x.e).length||x.z.length}).sort()}
/* Bir ayın özeti: toplam ve türe göre ürün, düzey dağılımı, en sık uyarı/dikkat maddeleri (kaç üründe; eşitlikte daha yüksek düzey, sonra ad), katkı, rozetler */
export function aylikOzet(o,ay){
  o=aylikNorm(o);var a=o.ay[ay]||{u:{},e:{},z:[]};
  var tur={gida:0,koz:0,tem:0},dag={uyari:0,dikkat:0,yok:0},say={},ids=Object.keys(a.u);
  ids.forEach(function(id){var x=a.u[id];tur[x.m]++;dag[x.r===2?"uyari":x.r===1?"dikkat":"yok"]++;
    var gor={};x.k.forEach(function(k){var key=x.m+"|"+k[0];if(gor[key])return;gor[key]=1;
      var s=say[key]||(say[key]={mode:x.m,key:k[0],name:k[1],ans:k[2]||null,rank:k[3]||2,n:0});s.n++;if((k[3]||2)>s.rank)s.rank=k[3];if(!s.ans&&k[2])s.ans=k[2]})});
  var m=Object.keys(say).map(function(k){return say[k]}).sort(function(x,y){return y.n-x.n||y.rank-x.rank||x.name.localeCompare(y.name)}).slice(0,AYLIK_AYAR.enSik);
  return {ay:ay,toplam:ids.length,tur:tur,dag:dag,maddeler:m,katki:Object.keys(a.e).length,rozetler:a.z.slice()};
}
