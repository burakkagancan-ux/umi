// Kabul testi (A-04, fotoğraf okuma kalitesi): otomatik kırpma önerisi.
// Fotoğrafın tamamı okunduğunda (kullanıcı çerçeveyi değiştirmemişse), Worker sözcük kutularını döndürdüyse ve metinde
// içerik listesinin dışında başka bölümler de varsa (besin tablosu, adres, uyarı, ikinci dil) sonucun üstünde bir öneri
// kartı çıkar: başlık "Yalnızca İçerik Listesi Okunsun mu?" (EN "Read Only the Ingredient List?"), düğme "Yalnızca
// içerik listesini analiz et" (EN "Analyse only the ingredient list"); liste dışındaki yazıdan gelen ve sonuçtan
// çıkacak maddeler "Liste dışındaki yazıdan gelen ve sonuçtan çıkacaklar: …" satırında sayılır. Düğmeye basınca Worker'a
// yeni istek gitmez, Okunan Metin içerik listesiyle sınırlanır, sonuç yeniden çizilir, durum satırında "Çerçeve içerik
// listesine çizildi…" yazar ve kart kaybolur. Alerjen iz/bildirim cümlesi liste dışında olsa da korunur.
//
// Kullanıcı yolu: Etiket Oku açılır, "Galeriden" dosya girdisine bir resim verilir (boyutu Worker yanıtındaki "boyut" ile
// aynı, beyaz PNG). Worker (inapp-ocr-…workers.dev) dış servistir: gövdesinde "image" olan POST'a test/veri/
// foto_sentetik.json'daki gerçek Google Vision yanıtı ({text, boyut, kutu}) döner; isteğin kutu:true taşıdığı da
// denetlenir. Sayaç (/olcum) istekleri kapalı kalır. Durumlar ayrı bağlamlarda paralel koşar.
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const {ac,gorunur}=require('./_ortak.js');

const VERI=JSON.parse(fs.readFileSync(path.join(__dirname,'..','veri','foto_sentetik.json'),'utf8')).etiketler;
const kayit=ad=>{const r=VERI.find(k=>k.ad===ad);if(!r)throw new Error('foto_sentetik.json: '+ad+' yok');return r};

const DIL={
  tr:{locale:'tr-TR',galeri:'Galeriden',baslik:'Yalnızca İçerik Listesi Okunsun mu?',dugme:'Yalnızca içerik listesini analiz et',
    cikacak:/Liste dışındaki yazıdan gelen ve sonuçtan çıkacaklar:/,durum:/Çerçeve içerik listesine çizildi/,
    metin:/Okunan metin burada görünür/,ornek:'Örnek metin dene',tamam:/Okuma tamamlandı/,kars:'Karşılaştır',tarama:/^Tarama \d+$/},
  en:{locale:'en-US',galeri:'From gallery',baslik:'Read Only the Ingredient List?',dugme:'Analyse only the ingredient list',
    metin:/text that was read appears here/i,tamam:/Reading complete/},
};

// Verilen boyutta beyaz, gri tonlu PNG (yalnızca girdi; okunan metni Worker taklidi verir)
function png(w,h){
  const T=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;T[n]=c>>>0}
  const crc=b=>{let c=0xffffffff;for(const x of b)c=T[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0};
  const parca=(tur,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(tur),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=0;
  const ham=Buffer.alloc((w+1)*h,255);for(let y=0;y<h;y++)ham[y*(w+1)]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),parca('IHDR',ih),parca('IDAT',zlib.deflateSync(ham)),parca('IEND',Buffer.alloc(0))]);
}

// Sayfayı açar, Worker'ı taklit eder. Döner: {p, errs, istekler:[gövde]}
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

async function yukle(p,d,boyut){
  await p.getByLabel(d.galeri,{exact:true}).setInputFiles({name:'etiket.png',mimeType:'image/png',buffer:png(boyut[0],boyut[1])});
  await gorunur(p.getByText(d.tamam),10000);
  await p.waitForTimeout(800);
}

const metinKutusu=(p,d)=>p.getByPlaceholder(d.metin);
const govde=p=>p.locator('body').innerText();

// "Alerjenler" başlığının altındaki satır: "İçerir: A, B · İçerebilir: C"
function alerjen(t){
  const s=t.split('\n').map(x=>x.trim());const i=s.indexOf('Alerjenler');
  const satir=i>=0?(s.slice(i+1).find(x=>/İçerir:|İçerebilir:/.test(x))||''):'';
  const al=ad=>{const m=satir.match(new RegExp(ad+':\\s*([^·]*)'));return m?m[1].split(',').map(x=>x.trim()).filter(Boolean):[]};
  return {satir,icerir:al('İçerir'),icerebilir:al('İçerebilir')};
}

// Öneri kartı görünür mü; görünürse düğmeye basar. Döner: {kart, cikacak (satır metni), basildi}
async function uygula(p,d,ad,ok){
  const kart=await gorunur(p.getByText(d.baslik,{exact:true}),5000);
  ok(kart,ad+': öneri kartı ("'+d.baslik+'") çıkmadı');
  const dugme=p.getByRole('button',{name:d.dugme});
  ok(!kart||await gorunur(dugme,2000),ad+': kartta "'+d.dugme+'" düğmesi yok');
  let cikacak='';
  if(d.cikacak&&await gorunur(p.getByText(d.cikacak),1000))cikacak=await p.getByText(d.cikacak).first().innerText();
  if(!kart||!await gorunur(dugme,500))return {kart:false,cikacak,basildi:false};
  await dugme.click();
  await p.waitForTimeout(1200);
  return {kart,cikacak,basildi:true};
}

// Kart çıkmamalı: sonuç oluştuktan sonra bir süre bekleyip bakar
async function kartYok(p,d,ad,ok,errs){
  await p.waitForTimeout(1200);
  ok(await p.getByText(d.baslik,{exact:true}).count()===0,ad+': öneri kartı çıkmamalıydı');
  ok(await p.getByRole('button',{name:d.dugme}).count()===0,ad+': "'+d.dugme+'" düğmesi çıkmamalıydı');
  ok(errs.length===0,ad+': sayfa hatası: '+errs.join(' | '));
}

const ortak=(ad,d,istekler,ok)=>{
  ok(istekler.length===1,ad+': Worker\'a '+istekler.length+' okuma isteği gitti (1 bekleniyordu)');
  ok(istekler[0]&&istekler[0].kutu===true,ad+': Worker isteğinde kutu:true yok (gövde anahtarları: '+(istekler[0]?Object.keys(istekler[0]).join(','):'-')+')');
};

// 1) tek_sutun_cevreli__duz: adres/üretici adından gelen yanlış süt çıkar; içerikler ve besin tablosu kalır.
//    Aynı sayfada: Karşılaştır'da yeni tarama kaydı açılmaz; çerçeve değiştirilip yeniden okutulunca ve "Örnek metin
//    dene" ile kart çıkmaz.
async function d1(br,B,opt,ok){
  const ad='tek_sutun',d=DIL.tr,r=kayit('tek_sutun_cevreli__duz');
  const ctx=await br.newContext({...opt,locale:d.locale});
  try{
    const {p,errs,istekler}=await sayfa(ctx,B,r.vision);
    await yukle(p,d,r.vision.boyut);
    ortak(ad,d,istekler,ok);
    const a0=alerjen(await govde(p));
    ok(a0.icerir.includes('Süt'),ad+': ön koşul: tüm metinde adresten gelen süt alerjeni görünmüyor ('+a0.satir+')');
    const u=await uygula(p,d,ad,ok);
    ok(/Süt/.test(u.cikacak),ad+': "çıkacaklar" satırı süt\'ü saymıyor: "'+u.cikacak+'"');
    ok(istekler.length===1,ad+': düğmeye basınca Worker\'a yeni istek gitti ('+istekler.length+')');
    if(u.basildi){
      ok(await gorunur(p.getByText(d.durum),3000),ad+': durum satırında "Çerçeve içerik listesine çizildi" yok');
      ok(await p.getByText(d.baslik,{exact:true}).count()===0,ad+': uygulamadan sonra kart kaybolmadı');
      const m=(await metinKutusu(p,d).inputValue()).trim();
      ok(/^İçindekiler/.test(m),ad+': Okunan Metin "İçindekiler" ile başlamıyor: '+m.slice(0,60));
      ok(!/Üretici|Sütçü|Tüketici hattı|Eyüpsultan/.test(m),ad+': Okunan Metin adres/üretici içeriyor: '+m.slice(0,300));
      const t=await govde(p),a=alerjen(t);
      ok(!a.icerir.includes('Süt')&&!a.icerebilir.includes('Süt'),ad+': süt alerjeni sonuçtan çıkmadı ('+a.satir+')');
      ok(a.icerir.includes('Soya'),ad+': soya (lesitin) alerjeni kayboldu ('+a.satir+')');
      ok(a.icerir.includes('Gluten içeren tahıllar'),ad+': buğday (gluten) alerjeni kayboldu ('+a.satir+')');
      ok(a.icerebilir.includes('Sert kabuklu meyveler')&&a.icerebilir.includes('Susam'),ad+': fındık/susam "içerebilir" kayboldu ('+a.satir+')');
      ok(/E322/.test(t),ad+': E322 (soya lesitini) sonuçta yok');
      ok(/Besin Değerleri \(100 g başına\)/.test(t)||/Besin Değerleri/.test(m),ad+': besin değeri tablosu kayboldu (ne sonuçta Besin Değerleri kartı ne metinde satırı var)');
    }
    // 6) "Örnek metin dene" ile kart çıkmaz
    await p.getByRole('button',{name:d.ornek}).click();
    await p.waitForTimeout(800);
    await kartYok(p,d,ad+' (örnek metin)',ok,errs);
    // 8) aynı tarama güncellenir: fotoğraf + örnek metin = Karşılaştır'daki son taramalarda 2 kayıt (uygulama yeni kayıt
    //    açsaydı 3); fotoğrafın kaydı artık kırpılmış metinle ("İçindekiler: Buğday unu") görünür
    if(u.basildi){
      await p.getByRole('button',{name:d.kars,exact:true}).click();
      const dlg=p.getByRole('dialog',{name:d.kars});
      if(await gorunur(dlg,3000)){
        await p.waitForTimeout(400);
        const s=(await dlg.innerText()).split('\n').map(x=>x.trim());
        const n=s.filter(x=>d.tarama.test(x)).length;
        ok(n===2,ad+': Karşılaştır\'daki son taramalarda '+n+' kayıt var (fotoğraf + örnek metin = 2; kırpma aynı taramayı güncellemeli)');
        ok(s.some(x=>/^İçindekiler: Buğday unu/.test(x)),ad+': Karşılaştır\'da fotoğrafın taraması görünmüyor');
        ok(!s.some(x=>/^Üretici|Sütçü/.test(x)),ad+': Karşılaştır\'da kırpılmamış (adresli) bir tarama kaydı var');
        await dlg.getByRole('button',{name:'Kapat'}).click({timeout:2000}).catch(()=>{});
        await p.waitForTimeout(300);
      }else ok(false,ad+': Karşılaştır penceresi açılmadı');
    }
    // 6) çerçeve değiştirilip yeniden okutulunca kart çıkmaz: fotoğraf yeniden yüklenir (tam okuma), sonra çerçevenin sol
    //    üst köşesi içeri sürüklenir (bırakınca yeniden okunur)
    await yukle(p,d,r.vision.boyut);
    const img=p.getByRole('img',{name:'Seçilen fotoğraf'});
    const bb=await gorunur(img,3000)?await img.boundingBox():null;
    if(bb){
      const once=istekler.length;
      await p.mouse.move(bb.x+3,bb.y+3);await p.mouse.down();
      await p.mouse.move(bb.x+bb.width*0.1,bb.y+bb.height*0.1,{steps:5});
      await p.mouse.move(bb.x+bb.width*0.15,bb.y+bb.height*0.15,{steps:5});
      await p.mouse.up();
      await p.waitForTimeout(2000);
      ok(istekler.length===once+1,ad+': çerçeve sürüklenince yeniden okunmadı (test önkoşulu)');
      await kartYok(p,d,ad+' (çerçeve değişti)',ok,errs);
    }else ok(false,ad+': seçilen fotoğraf görünmüyor');
  }finally{await ctx.close()}
}

// 2) uyari_ve_adres_ustte__duz: listenin dışındaki "Yumurta ve süt kullanılan tesiste üretilmiştir." uyarısı korunur
async function d2(br,B,opt,ok){
  const ad='uyari_ustte',d=DIL.tr,r=kayit('uyari_ve_adres_ustte__duz');
  const ctx=await br.newContext({...opt,locale:d.locale});
  try{
    const {p,errs,istekler}=await sayfa(ctx,B,r.vision);
    await yukle(p,d,r.vision.boyut);
    ortak(ad,d,istekler,ok);
    const u=await uygula(p,d,ad,ok);
    if(u.basildi){
      const m=await metinKutusu(p,d).inputValue();
      ok(/Yumurta ve süt kullanılan tesiste üretilmiştir/.test(m),ad+': alerjen uyarısı kırpmada kayboldu: '+m.slice(0,300));
      ok(/İçindekiler: Domates salçası/.test(m),ad+': içerik listesi metinde yok');
      ok(!/Üretici|Tüketici hattı/.test(m),ad+': adres metinde kaldı');
      const a=alerjen(await govde(p));
      // Uyarının "içerir" mi "içerebilir" mi sayılacağı bu işin konusu değil (analiz kuralı); burada yalnızca korunması aranır
      ok([...a.icerir,...a.icerebilir].includes('Yumurta'),ad+': uyarıdaki yumurta sonuçtan kayboldu ('+a.satir+')');
      ok([...a.icerir,...a.icerebilir].includes('Süt'),ad+': uyarıdaki süt sonuçtan kayboldu ('+a.satir+')');
    }
    ok(errs.length===0,ad+': sayfa hatası: '+errs.join(' | '));
  }finally{await ctx.close()}
}

// 3) iki_dil_yan_yana_tablo__duz: Türkçe arayüzde Türkçe liste, "Contains milk." korunur; İngilizce arayüzde İngilizce liste
async function d3(br,B,opt,ok,dil){
  const ad='iki_dil '+dil,d=DIL[dil],r=kayit('iki_dil_yan_yana_tablo__duz');
  const ctx=await br.newContext({...opt,locale:d.locale});
  try{
    const {p,errs,istekler}=await sayfa(ctx,B,r.vision);
    await yukle(p,d,r.vision.boyut);
    ortak(ad,d,istekler,ok);
    const u=await uygula(p,d,ad,ok);
    ok(istekler.length===1,ad+': düğmeye basınca Worker\'a yeni istek gitti ('+istekler.length+')');
    if(u.basildi){
      const m=(await metinKutusu(p,d).inputValue()).trim();
      if(dil==='tr'){
        ok(/^İçindekiler/.test(m),ad+': metin "İçindekiler" ile başlamıyor: '+m.slice(0,60));
        ok(!/Ingredients:/.test(m),ad+': İngilizce "Ingredients:" sütunu metne girdi');
        ok(/Contains milk/.test(m),ad+': öteki dildeki "Contains milk." bildirimi kayboldu');
        ok(!/Üretici|Sütçü/.test(m),ad+': adres metinde kaldı');
        const a=alerjen(await govde(p));
        ok([...a.icerir,...a.icerebilir].includes('Süt'),ad+': "Contains milk." ile gelen süt sonuçta yok ('+a.satir+')');
      }else{
        ok(/^Ingredients/.test(m),ad+': metin "Ingredients" ile başlamıyor: '+m.slice(0,60));
        ok(!/İçindekiler/.test(m),ad+': Türkçe "İçindekiler" listesi metne girdi');
        ok(/Contains milk/.test(m),ad+': "Contains milk." kayboldu');
      }
    }
    ok(errs.length===0,ad+': sayfa hatası: '+errs.join(' | '));
  }finally{await ctx.close()}
}

// 4) cok_dil_alt_alta__duz: Almanca "Kann Spuren von Milch enthalten." korunur
async function d4(br,B,opt,ok){
  const ad='cok_dil',d=DIL.tr,r=kayit('cok_dil_alt_alta__duz');
  const ctx=await br.newContext({...opt,locale:d.locale});
  try{
    const {p,errs,istekler}=await sayfa(ctx,B,r.vision);
    await yukle(p,d,r.vision.boyut);
    ortak(ad,d,istekler,ok);
    const u=await uygula(p,d,ad,ok);
    if(u.basildi){
      const m=(await metinKutusu(p,d).inputValue()).trim();
      ok(/^İçindekiler/.test(m),ad+': metin Türkçe "İçindekiler" ile başlamıyor: '+m.slice(0,60));
      ok(/Kann Spuren von Milch enthalten/.test(m),ad+': Almanca "Kann Spuren von Milch enthalten." kayboldu');
    }
    ok(errs.length===0,ad+': sayfa hatası: '+errs.join(' | '));
  }finally{await ctx.close()}
}

// 5) Temizlik modunda kart çıkmaz; 7) kutu yoksa ve içerik başlığı yoksa kart çıkmaz
async function dKartYok(br,B,opt,ok,ad,yanit,temizlik){
  const d=DIL.tr,ctx=await br.newContext({...opt,locale:d.locale});
  try{
    const {p,errs,istekler}=await sayfa(ctx,B,yanit);
    if(temizlik)await p.getByRole('radio',{name:'Temizlik'}).click();
    await yukle(p,d,yanit.boyut||[1096,765]);
    ok(istekler.length===1,ad+': Worker\'a okuma isteği gitmedi (test önkoşulu)');
    ok((await metinKutusu(p,d).inputValue()).trim().length>0,ad+': okunan metin boş (test önkoşulu)');
    await kartYok(p,d,ad,ok,errs);
  }finally{await ctx.close()}
}

module.exports=async({br,B,opt,ok})=>{
  const tek=kayit('tek_sutun_cevreli__duz').vision;
  // İçerik başlığı olmayan metin: "İçindekiler:" hem metinden hem kutulardan çıkarılır
  const basliksiz={text:tek.text.replace(/^İçindekiler:\s*/,''),boyut:tek.boyut,kutu:tek.kutu.filter((k,i)=>!(k[0]==='İçindekiler'||(i>0&&tek.kutu[i-1][0]==='İçindekiler'&&k[0]===':')))};
  await Promise.all([
    d1(br,B,opt,ok),
    d2(br,B,opt,ok),
    d3(br,B,opt,ok,'tr'),
    d3(br,B,opt,ok,'en'),
    d4(br,B,opt,ok),
    dKartYok(br,B,opt,ok,'temizlik',tek,true),
    dKartYok(br,B,opt,ok,'kutusuz',{text:tek.text},false),
    dKartYok(br,B,opt,ok,'basliksiz',basliksiz,false),
  ]);
};
