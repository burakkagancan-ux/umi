// Kabul testi (A-02, besin tablosunun konumdan kurulması): fotoğraftan okunan besin tablosu karışık sırayla gelse de
// (OCR önce bütün satır adlarını, sonra bütün değerleri verir) Worker'ın döndürdüğü sözcük kutularının konumundan tablo
// satır satır kurulur; "Besin Değerleri (100 g başına)" kartında yağ, doymuş yağ, şekerler, tuz doğru değerle ve yazılı
// düzeyle (Düşük/Orta/Yüksek; Birleşik Krallık ön yüz etiketi eşikleri) görünür. Emin olunmayan renk hiç gösterilmez:
// kutu yoksa ya da kutulardan kurulan tablo tutarsızsa düzey yazılmaz. Satır satır gelen metinde gerileme yok; içerik
// listesinin analizi bozulmaz; elle düzeltilen metin kutulara göre yeniden değiştirilmez.
//
// Kullanıcı yolu: Etiket Oku (ocr.html), Gıda modu, "Galeriden" dosya girdisine beyaz bir PNG verilir. Worker
// (inapp-ocr-…workers.dev) dış servistir: gövdesinde "image" olan POST'a testin kurduğu yanıt döner
// ({text, boyut, kutu_surum:1, kutu:[[sözcük, x0,y0, x1,y1, x2,y2, x3,y3, blok, satır_sonu], …]}); kutu dizisi text'teki
// sözcüklerle aynı sırada. Durumlar ayrı bağlamlarda paralel koşar.
const zlib=require('zlib');
const {ac,gorunur}=require('./_ortak.js');

// Metinler i18n/tr.json ve i18n/en.json'dan
const DIL={
  tr:{locale:'tr-TR',mod:'Gıda',galeri:'Galeriden',tamam:/Okuma tamamlandı/,metin:/Okunan metin burada görünür/,
    kart:'Besin Değerleri (100 g başına)',yag:'Yağ',doymus:'Doymuş yağ',seker:'Şekerler',tuz:'Tuz',
    D:'Düşük',O:'Orta',Y:'Yüksek',alerjen:'Alerjenler',icerir:'İçerir',gluten:/Gluten/,okunan:'Okunan Metin',
    bolum:'Besin Değerleri',son:/^(Okunan Diğer İçerik|Sonuçlar yalnızca okunan metne)/,
    // Renk gösterilmediğinde bölümde görünebilecek açıklamalar (besin.yok, besin.suphe, besin.duzelt, besin.foto_okunamadi, kars.besin.renksiz)
    renksiz:/Okunan metinde besin değeri tablosu yok|tutarlı görünmüyor|Değerleri kontrol et ve düzelt|besin değeri tablosu okunamadı|Değerler doğrulanmadı/},
  en:{locale:'en-US',mod:'Food',galeri:'From gallery',tamam:/Reading complete/,metin:/text that was read appears here/i,
    kart:'Nutrition (per 100 g)',yag:'Fat',doymus:'Saturates',seker:'Sugars',tuz:'Salt',
    D:'Low',O:'Medium',Y:'High',alerjen:'Allergens',icerir:'Contains',gluten:/Gluten|Cereals containing gluten/i,okunan:'Text Read',
    bolum:'Nutrition',son:/^(Other Ingredients Read|Results are based only on the text)/,
    renksiz:/No nutrition table in the text|do not look consistent|Check and correct the values|No nutrition table could be read|Values not confirmed/},
};

// Beklenen düzeyler (UK FoP, 100 g): yağ 24 > 17,5 Yüksek; doymuş 11 > 5 Yüksek; şekerler 30 > 22,5 Yüksek;
// tuz 0,3 < 0,6 ≤ 1,5 Orta
const BEKLENEN=[['yag','24','Y'],['doymus','11','Y'],['seker','30','Y'],['tuz','0,6','O']];

function png(w,h){
  const T=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;T[n]=c>>>0}
  const crc=b=>{let c=0xffffffff;for(const x of b)c=T[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0};
  const parca=(tur,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(tur),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=0;
  const ham=Buffer.alloc((w+1)*h,255);for(let y=0;y<h;y++)ham[y*(w+1)]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),parca('IHDR',ih),parca('IDAT',zlib.deflateSync(ham)),parca('IEND',Buffer.alloc(0))]);
}

// ---- Worker yanıtının kurulması ----
// Bir satır: {s:[sözcükler], x, y, b(blok)}. Sözcük kutusu: genişlik ≈ 11 px/harf, yükseklik 20 px; noktalama işaretleri
// öncekine yapışık (Vision'daki gibi ayrı sözcük). Satırlar verilen sırayla text'e ve kutu dizisine yazılır.
const BOYUT=[1000,900];
const YAPISIK_SOL=/^[,.:;)%]$/,YAPISIK_SAG=/^\($/;
function yanitKur(satirlar,kutulu){
  const kutu=[],metin=[];
  for(const st of satirlar){
    let x=st.x,parca='',onceki=null;
    st.s.forEach((w,i)=>{
      const g=Math.max(5,Math.round(w.length*11));
      if(onceki!==null&&!YAPISIK_SOL.test(w)&&!YAPISIK_SAG.test(onceki)){x+=8;parca+=' '}
      parca+=w;
      kutu.push([w,x,st.y,x+g,st.y,x+g,st.y+20,x,st.y+20,st.b,i===st.s.length-1?1:0]);
      x+=g;onceki=w;
    });
    metin.push(parca);
  }
  const r={text:metin.join('\n'),boyut:BOYUT};
  if(kutulu){r.kutu_surum=1;r.kutu=kutu}
  return r;
}
const ICERIK={s:['İçindekiler',':','Buğday','unu',',','şeker',',','palm','yağı',',','tuz','.'],x:100,y:100,b:0};
// Ad sütunu x≈200, değer sütunu x≈700; satırlar 50 px arayla
function tablo(degerler){
  const adlar=[['Besin','değerleri'],['Enerji'],['Yağ'],['Doymuş','yağ'],['Karbonhidrat'],['Şekerler'],['Protein'],['Tuz']];
  const ad=adlar.map((s,i)=>({s,x:200,y:200+i*50,b:1}));
  const deger=[['100','g'],...degerler].map((s,i)=>({s,x:s.length>2?620:700,y:200+i*50,b:2}));
  return {ad,deger};
}
const DOGRU=[['2100','kJ','/','502','kcal'],['24','g'],['11','g'],['63','g'],['30','g'],['6,5','g'],['0,6','g']];
// Tutarsız tablo: kutulara göre yağ 63 g, karbonhidrat 24 g, enerji 900 kcal (şekerler 30 > karbonhidrat 24, enerji
// yağ/karbonhidrat/proteinle uyuşmaz). text'teki değer sırası da kutuların yukarıdan aşağı sırasıyla aynı (Vision gibi),
// yani sıraya dayanarak da doğru tabloya varılamaz.
const TUTARSIZ=[['3766','kJ','/','900','kcal'],['63','g'],['11','g'],['24','g'],['30','g'],['6,5','g'],['0,6','g']];
// Karışık sıra: önce içerik satırı, sonra bütün adlar, sonra bütün değerler
const karisik=(deg,kutulu)=>{const t=tablo(deg);return yanitKur([ICERIK,...t.ad,...t.deger],kutulu)};
// Satır satır: her tablo satırı ad + değer tek satırda (ad bloğu ve değer bloğu sözcükleri aynı satırda)
function sirali(deg,kutulu){
  const t=tablo(deg),satirlar=[ICERIK];
  t.ad.forEach((a,i)=>{const d=t.deger[i];satirlar.push({birlesik:[a,d]})});
  // Birleşik satırları yanitKur'un anlayacağı biçime çevir: iki parça aynı satırda, satır sonu yalnızca değerden sonra
  const kutu=[],metin=[];
  for(const st of satirlar){
    const parcalar=st.birlesik||[st];let yazi='';
    parcalar.forEach((pc,j)=>{
      const r=yanitKur([pc],true);
      r.kutu.forEach((k,i)=>{if(j<parcalar.length-1&&i===r.kutu.length-1)k[10]=0;kutu.push(k)});
      yazi+=(j?' ':'')+r.text;
    });
    metin.push(yazi);
  }
  const r={text:metin.join('\n'),boyut:BOYUT};
  if(kutulu){r.kutu_surum=1;r.kutu=kutu}
  return r;
}

// ---- Sayfa ----
async function sayfa(ctx,B,yanit){
  const {p,errs}=await ac(ctx,B+'ocr.html');
  const istekler=[];
  await p.route(/inapp-ocr-[^/]*\.workers\.dev/,r=>{
    const q=r.request();let g=null;
    if(q.method()==='POST'){try{g=JSON.parse(q.postData()||'')}catch(e){}}
    if(g&&typeof g.image==='string'){istekler.push(g);return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(yanit)})}
    return r.abort();
  });
  return {p,errs,istekler};
}
async function yukle(p,d){
  const mod=p.getByRole('radio',{name:d.mod,exact:true});
  if(await gorunur(mod,2000))await mod.check().catch(()=>{});
  await p.getByLabel(d.galeri,{exact:true}).setInputFiles({name:'etiket.png',mimeType:'image/png',buffer:png(BOYUT[0],BOYUT[1])});
  await gorunur(p.getByText(d.tamam),10000);
  await p.waitForTimeout(1000);
}
const govde=p=>p.locator('body').innerText();
const satirlar=t=>t.split('\n').map(x=>x.trim()).filter(Boolean);

// Besin bölümünün metni: "Besin Değerleri" / "Nutrition" ile başlayan satırdan "Okunan Diğer İçerik" / alt nota kadar.
// Döner: {baslik, satirlar} ya da null
function bolum(t,d){
  const s=satirlar(t);
  const i=s.findIndex(x=>x.startsWith(d.bolum));
  if(i<0)return null;
  let j=s.findIndex((x,k)=>k>i&&d.son.test(x));if(j<0)j=Math.min(s.length,i+41);
  return {baslik:s[i],satirlar:s.slice(i+1,j)};
}
function kartMetni(t,d){const b=bolum(t,d);return b&&b.baslik===d.kart?b.satirlar:null}
// Bir besin satırının görünen metni: alan adıyla başlayan satır ve ardından gelen 3 satır (değer, düzey ayrı öğe olabilir)
function besinSatiri(kart,ad){
  const i=kart.findIndex(x=>x===ad||x.startsWith(ad+' ')||x.startsWith(ad+':')||x.startsWith(ad+'\t'));
  if(i<0)return '';
  // Sonraki alan adına kadar
  const out=[kart[i]];
  for(let j=i+1;j<Math.min(kart.length,i+4);j++){if(/^[A-Za-zÇĞİÖŞÜçğıöşü][a-zçğıöşü ]+$/.test(kart[j])&&!/^(Düşük|Orta|Yüksek|Low|Medium|High)$/.test(kart[j]))break;out.push(kart[j])}
  return out.join(' ');
}
const duzeyVar=(kart,d)=>kart.some(x=>new RegExp('(^|[^\\p{L}])('+d.D+'|'+d.O+'|'+d.Y+')([^\\p{L}]|$)','u').test(x));

function alerjen(t,d){
  const s=satirlar(t);const i=s.indexOf(d.alerjen);
  return i>=0?(s.slice(i+1,i+6).find(x=>x.includes(d.icerir+':'))||''):'';
}

// Doğru tablo beklentisi: dört satır doğru değerle ve doğru düzeyle
function dogruDenetle(ad,t,d,ok){
  const kart=kartMetni(t,d);
  ok(!!kart,ad+': "'+d.kart+'" kartı görünmüyor');
  if(!kart)return;
  for(const [alan,deger,duzey] of BEKLENEN){
    const s=besinSatiri(kart,d[alan]);
    ok(!!s,ad+': kartta "'+d[alan]+'" satırı yok');
    if(!s)continue;
    const degerRe=new RegExp('(^|[^\\d,.])'+deger.replace(',','[,.]')+'\\s*g','u');
    ok(degerRe.test(s),ad+': '+d[alan]+' satırında '+deger+' g yok: "'+s+'"');
    const beklenen=d[duzey],digerleri=['D','O','Y'].filter(x=>x!==duzey).map(x=>d[x]);
    const kelime=w=>new RegExp('(^|[^\\p{L}])'+w+'([^\\p{L}]|$)','u');
    ok(kelime(beklenen).test(s),ad+': '+d[alan]+' satırında düzey "'+beklenen+'" yok: "'+s+'"');
    ok(!digerleri.some(w=>kelime(w).test(s)),ad+': '+d[alan]+' satırında yanlış düzey: "'+s+'"');
  }
}
// Renk yok beklentisi: besin bölümü görünür, içinde düzey sözcüğü (Düşük/Orta/Yüksek) yok, neden renk olmadığı yazılı
function renksizDenetle(ad,t,d,ok){
  const b=bolum(t,d);
  ok(!!b,ad+': "'+d.bolum+'" bölümü görünmüyor');
  if(!b)return;
  ok(!duzeyVar(b.satirlar,d),ad+': emin olunamayan tabloda düzey ('+d.D+'/'+d.O+'/'+d.Y+') gösterildi: '+b.satirlar.slice(0,16).join(' | '));
  ok(b.satirlar.some(x=>d.renksiz.test(x)),ad+': renk gösterilmeyen besin bölümünde nedeni/düzeltme yolu yazmıyor: '+b.satirlar.slice(0,8).join(' | '));
}

async function durum(br,B,opt,ok,ad,dil,yanit,denetle){
  const d=DIL[dil],ctx=await br.newContext({...opt,locale:d.locale});
  try{
    const {p,errs,istekler}=await sayfa(ctx,B,yanit);
    await yukle(p,d);
    ok(istekler.length===1,ad+': Worker\'a '+istekler.length+' okuma isteği gitti (1 bekleniyordu; test önkoşulu)');
    ok(istekler[0]&&istekler[0].kutu===true,ad+': Worker isteğinde kutu:true yok');
    const t=await govde(p);
    if(process.env.BESIN_KONUM_DOKUM)console.log('---',ad,'---\n'+t);
    await denetle(p,t,d);
    ok(errs.length===0,ad+': sayfa hatası: '+errs.join(' | '));
  }finally{await ctx.close()}
}

module.exports=async({br,B,opt,ok})=>{
  const glutenVar=(ad,t,d)=>{const a=alerjen(t,d);ok(d.gluten.test(a),ad+': Alerjenler\'de gluten "'+d.icerir+'" olarak görünmüyor ("'+a+'")')};
  await Promise.all([
    // 1 + 5: karışık sıra, kutulu
    durum(br,B,opt,ok,'karisik_kutulu','tr',karisik(DOGRU,true),async(p,t,d)=>{dogruDenetle('karisik_kutulu',t,d,ok);glutenVar('karisik_kutulu',t,d)}),
    // 2 + 5: aynı yanıt kutusuz
    durum(br,B,opt,ok,'karisik_kutusuz','tr',karisik(DOGRU,false),async(p,t,d)=>{renksizDenetle('karisik_kutusuz',t,d,ok);glutenVar('karisik_kutusuz',t,d)}),
    // 3: kutulardan kurulan tablo tutarsız
    durum(br,B,opt,ok,'tutarsiz_kutulu','tr',karisik(TUTARSIZ,true),async(p,t,d)=>{renksizDenetle('tutarsiz_kutulu',t,d,ok)}),
    // 4: satır satır sıralı metin (kutulu ve kutusuz)
    durum(br,B,opt,ok,'sirali_kutulu','tr',sirali(DOGRU,true),async(p,t,d)=>{dogruDenetle('sirali_kutulu',t,d,ok);glutenVar('sirali_kutulu',t,d)}),
    durum(br,B,opt,ok,'sirali_kutusuz','tr',sirali(DOGRU,false),async(p,t,d)=>{dogruDenetle('sirali_kutusuz',t,d,ok);glutenVar('sirali_kutusuz',t,d)}),
    // 6: İngilizce arayüz
    durum(br,B,opt,ok,'karisik_kutulu en','en',karisik(DOGRU,true),async(p,t,d)=>{dogruDenetle('karisik_kutulu en',t,d,ok)}),
    // 7: elle düzeltilen metin aynen kalır, sonuç ona göre güncellenir
    durum(br,B,opt,ok,'elle_duzeltme','tr',karisik(DOGRU,true),async(p,t,d)=>{
      const kutu=p.getByPlaceholder(d.metin);
      if(!await gorunur(kutu,1000))await p.getByText(d.okunan,{exact:true}).first().click();
      ok(await gorunur(kutu,3000),'elle_duzeltme: Okunan Metin kutusu görünmüyor');
      const once=await kutu.inputValue();
      ok(/Buğday unu/.test(once),'elle_duzeltme: okunan metinde "Buğday unu" yok (test önkoşulu)');
      const yeni=once.replace('Buğday unu','Pirinç unu');
      await kutu.fill(yeni);
      await p.waitForTimeout(2500);
      const sonra=await kutu.inputValue();
      ok(sonra===yeni,'elle_duzeltme: elle düzeltilen metin değişti\n  yazılan: '+JSON.stringify(yeni.slice(0,200))+'\n  görünen: '+JSON.stringify(sonra.slice(0,200)));
      const a=alerjen(await govde(p),d);
      ok(!d.gluten.test(a),'elle_duzeltme: "Pirinç unu" yazıldıktan sonra gluten hâlâ "İçerir" ("'+a+'"); sonuç elle düzeltilen metne göre güncellenmedi');
    }),
  ]);
};
