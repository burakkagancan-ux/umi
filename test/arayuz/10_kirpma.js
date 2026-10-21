// Arayüz testi, 10. grup: A-04 otomatik kırpma önerisi bozma turu (21.10.2026) gerileme testleri.
// K8: öneri kartı çıktıktan sonra yeni fotoğraf seçilince ya da çerçeve değişince eski kart kalkar; eski düğme metne ve çerçeveye dokunmaz.
// K9: kozmetik verisi geç gelirken okunan fotoğrafta kart veri gelince çıkar (yeniden çizimde kaybolmaz).
// Tek başına çalışmaz; test/arayuz.js bütün grupları kendi sunucularıyla paralel çalıştırır.
const path=require('path');
const {R,newPage,watch,ACILIS}=require('./ortak.js');
const SET=require('../veri/foto_sentetik.json').etiketler,V=ad=>SET.find(e=>e.ad===ad).vision;
const KOZ={text:'Ingredients: Aqua, Glycerin, Phenoxyethanol, Parfum, Linalool.\nKeep out of reach of children.\nManufacturer: Example Cosmetics Ltd, 12 High Street, London',boyut:[1000,1000],
  kutu:(()=>{const k=[];[['Ingredients: Aqua, Glycerin, Phenoxyethanol, Parfum, Linalool.',10],['Keep out of reach of children.',200],['Manufacturer: Example Cosmetics Ltd, 12 High Street, London',400]].forEach(([m,y],b)=>{let x=10;const ws=m.split(' ');ws.forEach((w,i)=>{const g=10*w.length;k.push([w,x,y,x+g,y,x+g,y+20,x,y+20,b,i===ws.length-1?1:0]);x+=g+8})});return k})()};
module.exports=async({br,B,opt,ok})=>{
  // K8: eski kart yeni fotoğrafa uygulanmaz
  {const ctx=await br.newContext(opt),errs=[],p=await newPage(ctx);watch(p,errs);
    await p.goto(B+'ocr.html');await p.waitForFunction(ACILIS);
    const ocr=await p.evaluate(()=>OCR_URL),ocrYol=u=>u.href.startsWith(ocr)&&u.pathname==='/';
    let istek=0,birak=null;
    await p.route(ocrYol,async r=>{istek++;if(istek===1)return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(V('tek_sutun_cevreli__duz'))});
      await new Promise(x=>birak=x);r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:'Şeker, E330, E621'})})});
    await p.click('#m-gida');await p.setInputFiles('#dosya',path.join(R,'icon-192.png'));
    await p.waitForSelector('#sonuc .kirponer button',{timeout:8000}).catch(()=>{});
    const eski=await p.$('#sonuc .kirponer button');ok(!!eski,'K8 ön koşul: öneri kartı çıktı');
    await p.setInputFiles('#dosya',path.join(R,'icon-512.png'));   // ikinci fotoğraf; okuması bekletiliyor
    await p.waitForFunction(()=>true);await p.waitForTimeout(300);
    ok(await p.locator('#sonuc .kirponer').count()===0,'K8: yeni fotoğraf seçilince eski kart kalkar');
    if(eski)await eski.evaluate(b=>b.click()).catch(()=>{});   // ekrandan kalkmış düğmeye basılsa da
    const crop=await p.evaluate(()=>JSON.stringify(CROP));
    ok(crop==='{"x":0,"y":0,"w":1,"h":1}','K8: eski düğme çerçeveyi değiştirmez: '+crop);
    ok(!/^İçindekiler: Buğday unu/.test(await p.inputValue('#metin'))||/Üretici/.test(await p.inputValue('#metin')),'K8: eski düğme metni kırpmaz');
    if(birak)birak();await p.waitForFunction(()=>document.getElementById('metin').value==='Şeker, E330, E621',null,{timeout:8000}).catch(()=>{});
    ok(await p.inputValue('#metin')==='Şeker, E330, E621','K8: ikinci fotoğrafın metni yerinde');
    // çerçeve değişince (yeniden okuma) kart kalkar
    await p.unroute(ocrYol);await p.route(ocrYol,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(V('tek_sutun_cevreli__duz'))}));
    await p.setInputFiles('#dosya',path.join(R,'icon-192.png'));await p.waitForSelector('#sonuc .kirponer button',{timeout:8000}).catch(()=>{});
    ok(await p.locator('#sonuc .kirponer').count()===1,'K8 ön koşul: ikinci kez kart');
    let birak2;const bekle2=new Promise(x=>birak2=x);
    await p.unroute(ocrYol);await p.route(ocrYol,async r=>{await bekle2;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(V('tek_sutun_cevreli__duz'))})});
    await p.click('#cropreset');await p.waitForTimeout(200);
    ok(await p.locator('#sonuc .kirponer').count()===0,'K8: çerçeve yeniden okunurken eski kart kalkar');
    birak2();
    ok(!errs.length,'K8: sayfa hatası yok: '+errs.join(' | '));await ctx.close();}
  // K9: kozmetik verisi geç gelirken kart veri gelince çıkar
  {const ctx=await br.newContext(opt),errs=[],p=await newPage(ctx);watch(p,errs);
    let birak;const bekle=new Promise(r=>birak=r);
    await p.route('**/data/kozmetik*.json',async r=>{await bekle;r.continue()});
    await p.goto(B+'ocr.html');await p.evaluate(()=>localStorage.setItem('tur','koz'));await p.goto(B+'ocr.html');await p.waitForFunction(ACILIS);
    const ocr=await p.evaluate(()=>OCR_URL),ocrYol=u=>u.href.startsWith(ocr)&&u.pathname==='/';
    await p.route(ocrYol,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(KOZ)}));
    await p.setInputFiles('#dosya',path.join(R,'icon-192.png'));
    await p.waitForFunction(()=>/Ingredients/.test(document.getElementById('metin').value),null,{timeout:8000}).catch(()=>{});
    await p.waitForTimeout(300);birak();
    await p.waitForSelector('#sonuc .kirponer button',{timeout:8000}).catch(()=>{});
    ok(await p.locator('#sonuc .kirponer').count()===1,'K9: kozmetik verisi gelince öneri kartı görünür');
    ok(!errs.length,'K9: sayfa hatası yok: '+errs.join(' | '));await ctx.close();}
};
