/* Gizlilik dostu ölçüm (A-03, 16.10.2026): saf mantık; cihaz (js/arayuz_olcum.js) ve Worker (POST /olcum, yönetim sayfası) ortak kullanır.
   Yalnızca günlük toplamlar sayılır; cihaz kimliği, ürün, okunan metin, barkod numarası ve IP sunucuya yazılmaz.
   Cihazda tutulan tek şey depo "olcum" nesnesi: {ilk: ilk kullanım günü, son: son "aktif" sayılan gün, d7/d30: geri dönüş bir kez sayıldı,
   eski: ölçümden önce de kullanılan cihaz (yeni ve geri dönüş sayılmaz; yoksa bütün eski kullanıcılar ilk gün "yeni" görünürdü), kapali: kullanıcı kapattı}.
   Günler UTC "YYYY-AA-GG" (cihaz ve Worker aynı takvimi kullansın diye).
   Geri dönüş oranı kimliksiz hesaplanır: X günü ilk kez açan cihaz sayısı (gun X, "n") ile X'te başlayıp 7–13. günde yeniden açan cihaz sayısı
   (gun X, "d7"; cihaz ilk kullanım gününü gönderir) karşılaştırılır. */
export const OLCUM_AYAR={
  yol:"/olcum",     // OCR Worker adresine eklenir
  d7:[7,13],        // ilk kullanımdan 7–13 gün sonra açan cihaz "7. günde dönen" sayılır (ikinci hafta)
  d30:[30,59],      // 30–59 gün sonra açan "30. günde dönen"
  gunSay:60         // yönetim sayfasında gösterilen gün sayısı
};
const TURLER=new Set(["gida","koz","tem"]);
const KAYNAKLAR=new Set(["f","b"]);   // f: fotoğraf, b: barkodla bulunan ürün; y (barkodla bulunamayan) türsüz sayılır
const GUN_RE=/^\d{4}-\d{2}-\d{2}$/;
const GUN_MS=864e5;

export function olcumGun(ms){return new Date(ms).toISOString().slice(0,10)}
function gunMs(g){return Date.parse(g+"T00:00:00Z")}
export function olcumGunGecerli(g){if(typeof g!=="string"||!GUN_RE.test(g))return false;const ms=gunMs(g);return !isNaN(ms)&&olcumGun(ms)===g}
/* a'dan b'ye kaç gün (b önceyse eksi) */
export function olcumFark(a,b){return Math.round((gunMs(b)-gunMs(a))/GUN_MS)}

/* Açılış: cihazın ölçüm durumu ve bugün gönderilecek olaylar. eskiVeri: cihazda ölçümden önceki kullanımın izi var (tarama, kayıt, profil).
   Dönen durum yazılamazsa olaylar gönderilmemeli (her açılış yeniden "yeni" sayılmasın). */
export function olcumAcilis(durum,simdi,eskiVeri){
  let d=durum&&typeof durum==="object"&&!Array.isArray(durum)?{...durum}:null;
  const bugun=olcumGun(simdi),olaylar=[];
  if(d&&d.kapali)return {durum:d,olaylar};
  if(!d||!olcumGunGecerli(d.ilk)||olcumFark(d.ilk,bugun)<0){
    // İlk açılış. Bozuk ya da ileri tarihli durum da eski cihaz sayılır: aynı cihaz ikinci kez "yeni" olmasın
    const eski=!!eskiVeri||!!d;
    d={ilk:bugun};
    if(eski)d.eski=true;else olaylar.push({o:"n"});
  }
  if(d.son!==bugun){d.son=bugun;olaylar.push({o:"a"})}
  if(!d.eski){
    const f=olcumFark(d.ilk,bugun);
    for(const o of ["d7","d30"]){const p=OLCUM_AYAR[o];if(!d[o]&&f>=p[0]&&f<=p[1]){d[o]=1;olaylar.push({o,ilk:d.ilk})}}
  }
  return {durum:d,olaylar};
}
/* Yeni tarama olayı. k: "f" fotoğraf, "b" barkodla bulunan, "y" barkodla bulunamayan (tür bilinmez) */
export function olcumTaramaOlay(k,m){return k==="y"?{o:"t",k:"y"}:{o:"t",k,m}}
/* Olayın sorgu metni (gövdesiz istek; sendBeacon) */
export function olcumSorgu(ol){return ["o","k","m","ilk"].filter(a=>ol[a]!=null).map(a=>a+"="+encodeURIComponent(ol[a])).join("&")}

/* Worker: sorgudan sayılacak satır {gun, ad} ya da null (geçersiz). q: URLSearchParams gibi get(ad) olan nesne.
   Bilinmeyen değer hiçbir satıra yazılmaz: toplam tablosu küçük ve tahmin edilebilir kalır. */
export function olcumAnahtar(q,simdi){
  const o=q.get("o"),bugun=olcumGun(simdi);
  if(o==="a"||o==="n")return {gun:bugun,ad:o};
  if(o==="t"){
    const k=q.get("k"),m=q.get("m");
    if(k==="y")return {gun:bugun,ad:"t:y"};
    return KAYNAKLAR.has(k)&&TURLER.has(m)?{gun:bugun,ad:"t:"+k+":"+m}:null;
  }
  if(o==="d7"||o==="d30"){
    const ilk=q.get("ilk");if(!olcumGunGecerli(ilk))return null;
    const f=olcumFark(ilk,bugun),p=OLCUM_AYAR[o];
    return f>=p[0]&&f<=p[1]+1?{gun:ilk,ad:o}:null;   // +1: cihaz saati bir gün geride olabilir
  }
  return null;
}

/* Yönetim sayfası: satırlar [{gun, ad, n}] ve paylaşım sayacı {gun: {s, d}} → gün gün tablo ve son 7 günün özeti.
   Geri dönüş oranı yalnızca penceresi kapanmış günler için kesindir (acik7/acik30: pencere sürüyor, sayı artabilir). */
export function olcumOzet(satirlar,paylasim,simdi,gunSay){
  const bugun=olcumGun(simdi),n=gunSay||OLCUM_AYAR.gunSay,S={};
  for(const r of satirlar||[]){(S[r.gun]=S[r.gun]||{})[r.ad]=(Number(r.n)||0)}
  const gunler=[];
  for(let i=0;i<n;i++){
    const gun=olcumGun(gunMs(bugun)-i*GUN_MS),s=S[gun]||{},p=(paylasim&&paylasim[gun])||{};
    const tur={gida:0,koz:0,tem:0},kaynak={f:0,b:0,y:s["t:y"]||0};
    for(const m of TURLER)for(const k of KAYNAKLAR){const v=s["t:"+k+":"+m]||0;tur[m]+=v;kaynak[k]+=v}
    const f=olcumFark(gun,bugun);
    gunler.push({gun,aktif:s.a||0,yeni:s.n||0,tarama:kaynak.f+kaynak.b+kaynak.y,tur,kaynak,
      paylasim:(Number(p.s)||0)+(Number(p.d)||0),d7:s.d7||0,d30:s.d30||0,acik7:f<=OLCUM_AYAR.d7[1],acik30:f<=OLCUM_AYAR.d30[1]});
  }
  const son7=gunler.slice(0,7),top=(l,a)=>l.reduce((x,g)=>x+g[a],0);
  // Kesinleşmiş geri dönüş: penceresi kapanmış günlerin toplamı (yeni cihazı olmayan gün oranı etkilemez)
  const oran=(a,acik)=>{const l=gunler.filter(g=>!g[acik]&&g.yeni);const y=top(l,"yeni");return y?{oran:top(l,a)/y,yeni:y,gun:l.length}:null};
  const ozet={aktif:top(son7,"aktif"),yeni:top(son7,"yeni"),tarama:top(son7,"tarama"),paylasim:top(son7,"paylasim"),
    tur:{gida:0,koz:0,tem:0},kaynak:{f:0,b:0,y:0},d7:oran("d7","acik7"),d30:oran("d30","acik30")};
  for(const g of son7){for(const m in ozet.tur)ozet.tur[m]+=g.tur[m];for(const k in ozet.kaynak)ozet.kaynak[k]+=g.kaynak[k]}
  return {bugun,gunler,ozet};
}
