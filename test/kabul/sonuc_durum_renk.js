// Kabul testi: sonucun en üstü en yüksek durumun renginde (renklendirme, seçenek C ile birlikte).
// Kullanıcının isteği (değiştirmeden):
//  "Uygulamayı biraz renklendir: zemin seçeneği C (zemin daha koyu) + sonucun en üstü en yüksek durumun renginde."
//
// Kabul ölçütleri (Etiket Oku ocr.html):
//  1. Zemin (seçenek C): açık tema sayfa zemini #E9EDEA, kartlar #FFFFFF; koyu tema zemini #080A09, kartlar #1D2320.
//     (Bu ölçüt eklediklerim_renk.js'te ölçülür; bu dosya yalnızca kart rengini "normal kart" beklentisi için kullanır.)
//  2. Sonucun en üstündeki özet kartı ("Özet" / EN "Summary" aria etiketli bölge; başlığı "N maddede uyarı",
//     "N maddede dikkat" ya da "Özel uyarısı olan madde yok") zemini en yüksek durumun açık tonunda:
//       uyarı varsa turuncu-açık   açık #FCE9DA, koyu #36200F
//       uyarı yok, dikkat varsa    sarı-açık  açık #FFF3D1, koyu #2F260E
//       hiç özel uyarı yoksa       yeşil-açık açık #E6EFE9, koyu #14261D
//     Değerlendirilecek madde yoksa ("Değerlendirilecek madde bulunamadı") kart normal kart renginde kalır.
//  3. Renk tek başına bilgi taşımaz: özet başlığındaki yazı aynen görünür (TR ve EN).
//
// Kullanıcı yolu (uygulamada gözlendi, 22.10.2026): Etiket Oku > "Gıda" > "Okunan Metin" açılır > kutuya içerik yazılır;
// sonuç kendiliğinden gelir. Gözlenen başlıklar: "un, E102, E211, su" → "1 maddede uyarı"; "un, E211, su" →
// "1 maddede dikkat"; "un, E330, su" → "Özel uyarısı olan madde yok"; "un, şeker, su" → "Değerlendirilecek madde
// bulunamadı". Kozmetik "Aqua, glycerin." → "Özel uyarısı olan madde yok". Koyu tema Profilim > Görünüm seçiminden.
// Renk ekran görüntüsünden piksel okunarak ölçülür (evaluate yok): özet kartının sağ iç kenarında yukarıdan aşağı bir
// sütun örneklenir, en sık görülen renk kartın zeminidir (yazı ve çubuklar o sütuna ulaşmaz ya da azınlıkta kalır).
const zlib=require('zlib');
const {ac,gorunur}=require('./_ortak.js');

// --- PNG (ekran görüntüsü) çözücü: 8 bit RGB/RGBA, taramasız (eklediklerim_renk.js ile aynı) ---
function pngCoz(buf){
  let o=8,w=0,h=0,tip=0;const idat=[];
  while(o<buf.length){
    const n=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),d=buf.subarray(o+8,o+8+n);
    if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);tip=d[9]}
    else if(t==='IDAT')idat.push(d);
    o+=12+n;
  }
  const bpp=tip===6?4:3,ham=zlib.inflateSync(Buffer.concat(idat)),st=w*bpp,px=Buffer.alloc(st*h);
  for(let y=0;y<h;y++){
    const f=ham[y*(st+1)],s=ham.subarray(y*(st+1)+1,(y+1)*(st+1));
    for(let x=0;x<st;x++){
      const a=x>=bpp?px[y*st+x-bpp]:0,b=y?px[(y-1)*st+x]:0,c=x>=bpp&&y?px[(y-1)*st+x-bpp]:0;
      let v=s[x];
      if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;
      else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c}
      px[y*st+x]=v&255;
    }
  }
  return {w,h,at:(x,y)=>{x=Math.round(x);y=Math.round(y);const i=y*st+x*bpp;return [px[i],px[i+1],px[i+2]]}};
}
const hex=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
const fark=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
const yaz=c=>'rgb('+c.join(',')+')';

const RENK={
  'Açık':{uyari:'#FCE9DA',dikkat:'#FFF3D1',temiz:'#E6EFE9',kart:'#FFFFFF'},
  'Koyu':{uyari:'#36200F',dikkat:'#2F260E',temiz:'#14261D',kart:'#1D2320'},
};
const DURUMLAR=[
  {ad:'uyarı',tur:'Gıda',metin:'İçindekiler: un, E102, E211, su.',baslik:'1 maddede uyarı',renk:'uyari'},
  {ad:'dikkat',tur:'Gıda',metin:'İçindekiler: un, E211, su.',baslik:'1 maddede dikkat',renk:'dikkat'},
  {ad:'özel uyarı yok',tur:'Gıda',metin:'İçindekiler: un, E330, su.',baslik:'Özel uyarısı olan madde yok',renk:'temiz'},
  {ad:'özel uyarı yok (kozmetik)',tur:'Kozmetik',metin:'Aqua, glycerin.',baslik:'Özel uyarısı olan madde yok',renk:'temiz'},
  {ad:'değerlendirilecek madde yok',tur:'Gıda',metin:'İçindekiler: un, şeker, su.',baslik:'Değerlendirilecek madde bulunamadı',renk:'kart'},
];
const EN_DURUMLAR=[
  {ad:'EN uyarı',tur:'Food',metin:'Ingredients: flour, E102, E211, water.',baslik:'1 ingredient with a warning',renk:'uyari'},
  {ad:'EN dikkat',tur:'Food',metin:'Ingredients: flour, E211, water.',baslik:'1 ingredient needs caution',renk:'dikkat'},
];

async function temaSec(ctx,B,tema,ok,etiket){
  const {p}=await ac(ctx,B+'ocr.html#profil');
  const g=p.getByLabel(etiket||'Görünüm');
  ok(await gorunur(g,5000),tema+' tema: Profilim\'de "'+(etiket||'Görünüm')+'" seçimi yok');
  if(await g.count()){await g.first().selectOption({label:tema});await p.waitForTimeout(800)}
  await p.close();
}
async function dilSec(ctx,B,dil,ok){
  const {p}=await ac(ctx,B+'ocr.html#profil');
  const s=p.getByLabel(/Dil · Language/);
  ok(await gorunur(s,5000),'"Dil · Language" seçimi görünmüyor');
  if(await s.count()){await s.first().selectOption({label:dil});await p.waitForTimeout(1500)}
  await p.close();
}

// Özet kartının zemin rengi: sağ iç kenarda dikey sütunun en sık rengi
function kartZemini(img,b){
  const x=b.x+b.width-14,say=new Map();
  for(let y=Math.ceil(b.y+14);y<b.y+b.height-14;y+=2){
    if(y<0||y>=img.h)continue;
    const c=img.at(x,y),k=c.join(',');
    say.set(k,(say.get(k)||0)+1);
  }
  let en=null,n=0;for(const [k,v] of say)if(v>n){n=v;en=k}
  return en?en.split(',').map(Number):null;
}

// Bir durumu açar, özet kartını bulur, zemin rengini ve başlığı denetler
async function durumDenetle(ctx,B,d,R,e,ok,en){
  const {p,errs}=await ac(ctx,B+'ocr.html');
  try{
    await p.getByRole('radio',{name:d.tur,exact:true}).click();
    const kutu=p.getByPlaceholder(en?/The text that was read appears here/:/Okunan metin burada görünür/);
    if(!await gorunur(kutu,500))await p.getByText(en?'Text Read':'Okunan Metin',{exact:true}).click();
    await kutu.first().fill(d.metin);
    const oz=p.getByRole('region',{name:en?'Summary':'Özet',exact:true});
    if(!await gorunur(oz,8000)){ok(false,e+': "'+(en?'Summary':'Özet')+'" etiketli özet bölgesi görünmedi');return}
    // Başlık yazısı aynen görünür (renk tek başına değil)
    const bas=oz.first().getByText(d.baslik,{exact:true});
    ok(await gorunur(bas,5000),e+': özet kartında "'+d.baslik+'" başlığı görünmüyor: "'+(await oz.first().innerText()).replace(/\n/g,' ⏎ ')+'"');
    // Kartı ekranın üst yarısına getir (alt menü örtmesin)
    await oz.first().scrollIntoViewIfNeeded();
    let b=await oz.first().boundingBox();
    if(b&&b.y+b.height>700){await p.mouse.move(195,300);await p.mouse.wheel(0,b.y+b.height-600);await p.waitForTimeout(400);b=await oz.first().boundingBox()}
    await p.waitForTimeout(500);
    b=await oz.first().boundingBox();
    if(!b){ok(false,e+': özet kartının yeri ölçülemedi');return}
    const img=pngCoz(await p.screenshot());
    const c=kartZemini(img,b),beklenen=R[d.renk];
    ok(c&&fark(c,hex(beklenen))<=3,e+': özet kartı ("'+d.baslik+'") zemini '+beklenen+' değil: '+(c?yaz(c):'ölçülemedi'));
    ok(errs.length===0,e+': sayfa hatası: '+errs.join(' | '));
  }finally{await p.close()}
}

module.exports=async({br,B,opt,ok})=>{
  await Promise.all([
    ...['Açık','Koyu'].map(tema=>(async()=>{
      const ctx=await br.newContext(opt);
      try{
        await temaSec(ctx,B,tema,ok);
        for(const d of DURUMLAR)await durumDenetle(ctx,B,d,RENK[tema],tema+' tema, '+d.ad,ok,false);
      }finally{await ctx.close()}
    })()),
    // İngilizce (açık tema): başlık yazısı İngilizce, renk aynı kural
    (async()=>{
      const ctx=await br.newContext(opt);
      try{
        await dilSec(ctx,B,'English',ok);
        for(const d of EN_DURUMLAR)await durumDenetle(ctx,B,d,RENK['Açık'],'Açık tema, '+d.ad,ok,true);
      }finally{await ctx.close()}
    })(),
  ]);
};
