// Kabul testi: besin değeri tablosu kartında bütün satırlar (kullanıcının isteği: "Karbonhidrat ve lif besin tablosunda
// gözükmüyor.").
//
// İstenen davranış (yazanla kararlaştırılmış ölçüt 1):
//  - Gıda sonucundaki "Besin Değerleri (100 g başına)" kartı (EN "Nutrition (per 100 g)") etikette okunan Karbonhidrat ve
//    Lif satırlarını değerleriyle gösterir; Protein satırı da görünür.
//  - Yağ, Doymuş yağ, Şekerler, Tuz (değer ve Düşük/Orta/Yüksek düzeyi) ve Enerji (kcal) eskisi gibi kalır.
//  - Bir satır etikette yoksa kart bozulmaz: o satır görünmez, ötekiler görünür, sayfa hatası olmaz.
//  - Sınayanın yorumu (değişmez ilke "her bilgi kaynağa dayalı"): kartın kullandığı eşik kaynağı (UK ön yüz etiketi
//    kılavuzu) karbonhidrat, lif ve protein için eşik vermez; bu satırlarda Düşük/Orta/Yüksek düzeyi yazılmaz.
//
// Kullanıcı yolu: Etiket Oku > Gıda > (a) "Okunan Metin" kutusuna etiket metni yazılır; (b) "Galeriden" ile fotoğraf
// verilir, Worker'ın (inapp-ocr-…workers.dev, dış servis) OCR yanıtı p.route ile taklit edilir. Metinler i18n/*.json'dan.
const {ac,gorunur,yerlesince}=require('./_ortak.js');

const DIL={
  tr:{locale:'tr-TR',mod:'Gıda',kart:'Besin Değerleri (100 g başına)',okunan:'Okunan Metin',metin:/Okunan metin burada görünür/,
    galeri:'Galeriden',tamam:/Okuma tamamlandı/,son:/^(Kaynak:|Okunan Diğer İçerik|Sonuçlar yalnızca okunan metne)/,
    yag:'Yağ',doymus:'Doymuş yağ',karb:'Karbonhidrat',seker:'Şekerler',lif:'Lif',protein:'Protein',tuz:'Tuz',kcal:'Enerji',
    duzey:/^(Düşük|Orta|Yüksek)$/,D:'Düşük',O:'Orta',Y:'Yüksek'},
  en:{locale:'en-US',mod:'Food',kart:'Nutrition (per 100 g)',okunan:'Text Read',metin:/text that was read appears here/i,
    galeri:'From gallery',tamam:/Reading complete/,son:/^(Source:|Other Ingredients Read|Results are based only on the text)/,
    yag:'Fat',doymus:'Saturates',karb:'Carbohydrate',seker:'Sugars',lif:'Fibre',protein:'Protein',tuz:'Salt',kcal:'Energy',
    duzey:/^(Low|Medium|High)$/,D:'Low',O:'Medium',Y:'High'},
};

const METIN_TR=['İçindekiler: Buğday unu, şeker, palm yağı, tuz.','Besin değerleri 100 g','Enerji 2100 kJ / 502 kcal',
  'Yağ 24 g','Doymuş yağ 11 g','Karbonhidrat 63 g','Şekerler 30 g','Lif 3,2 g','Protein 6,5 g','Tuz 0,6 g'];
const METIN_EN=['Ingredients: Wheat flour, sugar, palm oil, salt.','Nutrition per 100 g','Energy 2100 kJ / 502 kcal',
  'Fat 24 g','of which saturates 11 g','Carbohydrate 63 g','of which sugars 30 g','Fibre 3.2 g','Protein 6.5 g','Salt 0.6 g'];
// Lif ve Protein satırları olmayan etiket
const METIN_EKSIK=METIN_TR.filter(s=>!/^(Lif|Protein)/.test(s));

// [alan, değer, düzey(yoksa null)]; düzeyler UK FoP 100 g eşikleri: yağ 24 > 17,5 Y; doymuş 11 > 5 Y; şekerler 30 > 22,5 Y;
// tuz 0,3 < 0,6 ≤ 1,5 O
const ESKI=[['yag','24 g','Y'],['doymus','11 g','Y'],['seker','30 g','Y'],['tuz','0,6 g','O'],['kcal','502 kcal',null]];
const YENI=[['karb','63 g'],['lif','3,2 g'],['protein','6,5 g']];

function png(){return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64')}
const satirlar=t=>t.split('\n').map(x=>x.trim()).filter(Boolean);

// Kartın satırları: başlıktan "Kaynak:" / alt nota kadar; yoksa null
function kart(t,d){
  const s=satirlar(t),i=s.indexOf(d.kart);
  if(i<0)return null;
  let j=s.findIndex((x,k)=>k>i&&d.son.test(x));if(j<0)j=Math.min(s.length,i+40);
  return s.slice(i+1,j);
}
// Alan adı ayrı bir satırsa (ya da "Ad değer" biçiminde tek satırsa) adın ardından gelen metin (değer ve varsa düzey)
function satir(k,ad){
  const i=k.findIndex(x=>x===ad||x.startsWith(ad+' ')||x.startsWith(ad+':'));
  if(i<0)return null;
  const out=[k[i].slice(ad.length).replace(/^[:\s]+/,'')].filter(Boolean);
  for(let j=i+1;j<Math.min(k.length,i+3);j++){
    if(out.length&&!/^[<\d]/.test(k[j])&&!/^(Düşük|Orta|Yüksek|Low|Medium|High)$/.test(k[j]))break;
    out.push(k[j]);
  }
  return out.join(' ');
}
const degerRe=(v,dil)=>new RegExp('(^|[^\\d,.])'+v.replace(/[,.]/,'[,.]').replace(' ','\\s*')+'([^\\d]|$)');

function denetle(ad,t,d,dil,ok,beklenenYeni){
  const k=kart(t,d);
  ok(!!k,ad+': "'+d.kart+'" kartı görünmüyor');
  if(!k)return;
  for(const [alan,v] of beklenenYeni){
    const s=satir(k,d[alan]);
    ok(s!==null,ad+': kartta "'+d[alan]+'" satırı yok (kart: '+k.join(' | ')+')');
    if(s===null)continue;
    ok(degerRe(v).test(s),ad+': "'+d[alan]+'" satırında '+v+' yok: "'+s+'"');
    ok(!/(Düşük|Orta|Yüksek|Low|Medium|High)/.test(s),ad+': "'+d[alan]+'" satırında kaynağı olmayan bir düzey yazılı: "'+s+'"');
  }
  for(const [alan,v,duzey] of ESKI){
    const s=satir(k,d[alan]);
    ok(s!==null,ad+': kartta "'+d[alan]+'" satırı artık yok (kart: '+k.join(' | ')+')');
    if(s===null)continue;
    ok(degerRe(v).test(s),ad+': "'+d[alan]+'" satırında '+v+' yok: "'+s+'"');
    if(duzey)ok(new RegExp('(^|\\s)'+d[duzey]+'(\\s|$)').test(s),ad+': "'+d[alan]+'" satırında düzey "'+d[duzey]+'" yok: "'+s+'"');
  }
}

async function sayfa(ctx,B,ocrMetni){
  const {p,errs}=await ac(ctx,B+'ocr.html');
  const istek=[];
  await p.route(/inapp-ocr-[^/]*\.workers\.dev/,r=>{
    const q=r.request();
    if(q.method()==='POST'&&/"image"/.test(q.postData()||'')&&ocrMetni){istek.push(1);
      return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({text:ocrMetni})})}
    return r.abort();
  });
  return {p,errs,istek};
}
async function metinYaz(p,d,metin){
  const mod=p.getByRole('radio',{name:d.mod,exact:true});
  if(await gorunur(mod,2000))await mod.click();
  const kutu=p.getByPlaceholder(d.metin);
  if(!await gorunur(kutu,500))await p.getByText(d.okunan,{exact:true}).click();
  await kutu.first().fill(metin);
}
const govde=p=>yerlesince(()=>p.locator('body').innerText(),8000,400);

async function durum(br,B,opt,ok,ad,dil,yol,metin,beklenenYeni,ek){
  const d=DIL[dil],ctx=await br.newContext({...opt,locale:d.locale});
  try{
    const {p,errs,istek}=await sayfa(ctx,B,yol==='foto'?metin:null);
    if(yol==='foto'){
      const mod=p.getByRole('radio',{name:d.mod,exact:true});
      if(await gorunur(mod,2000))await mod.click();
      const fc=p.waitForEvent('filechooser',{timeout:5000});
      await p.getByText(d.galeri,{exact:true}).click();
      await (await fc).setFiles({name:'tablo.png',mimeType:'image/png',buffer:png()});
      ok(await gorunur(p.getByText(d.tamam),10000),ad+': fotoğraf okunmadı (test önkoşulu)');
      ok(istek.length===1,ad+': Worker\'a '+istek.length+' okuma isteği gitti (1 bekleniyordu; test önkoşulu)');
    }else await metinYaz(p,d,metin);
    ok(await gorunur(p.getByText(d.kart,{exact:true}),8000),ad+': "'+d.kart+'" kartı gelmedi');
    const t=await govde(p);
    denetle(ad,t,d,dil,ok,beklenenYeni);
    if(ek)ek(kart(t,d)||[],d);
    ok(errs.length===0,ad+': sayfa hatası: '+errs.join(' | '));
  }finally{await ctx.close()}
}

module.exports=async({br,B,opt,ok})=>{
  const en=YENI.map(([a,v])=>[a,v.replace(',','.')]);
  await Promise.all([
    // Etiket metni (Okunan Metin kutusu), Türkçe
    durum(br,B,opt,ok,'metin tr','tr','metin',METIN_TR.join('\n'),YENI),
    // Etiket metni, İngilizce arayüz ve İngilizce etiket
    durum(br,B,opt,ok,'metin en','en','metin',METIN_EN.join('\n'),en),
    // Fotoğraf: Galeriden, Worker'ın okuduğu metin satır satır tablo
    durum(br,B,opt,ok,'fotoğraf tr','tr','foto',METIN_TR.join('\n'),YENI),
    // Lif ve Protein etikette yok: kart bozulmaz, Karbonhidrat ve eski satırlar görünür, olmayan satır uydurulmaz
    durum(br,B,opt,ok,'eksik satır','tr','metin',METIN_EKSIK.join('\n'),[['karb','63 g']],(k,d)=>{
      // Satır hiç görünmeyebilir ya da "okunamadı" gibi değersiz görünebilir; değer uydurulmaz
      for(const a of ['lif','protein']){const s=satir(k,d[a]);
        ok(s===null||!/\d/.test(s),'eksik satır: etikette '+d[a]+' yokken kartta değerli "'+d[a]+'" satırı var: "'+s+'"')}
    }),
  ]);
};
