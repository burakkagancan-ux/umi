// Arayüz testi, 8. grup: ülke katmanı (B-05) dayanıklılığı. Bozma turu (21.10.2026): data/ulke.json gelmeyince Türkiye'ye özgü kartlar
// (zehir danışma hattı 114, kozmetik Türkiye satırı) kayboluyordu; askıda kalınca gıda listesi hiç açılmıyordu.
// Tek başına çalışmaz; test/arayuz.js bütün grupları kendi sunucularıyla paralel çalıştırır.
const {newPage,watch}=require('./ortak.js');
module.exports=async({br,B,opt,ok})=>{
  const TEM='TEHLİKE. Ciddi göz hasarına yol açar. P101 Tıbbi tavsiye gerekiyorsa, ambalajı veya etiketi saklayın.';
  for(const [ad,yol] of [['abort',r=>r.abort()],['askıda',()=>{}]]){
    const ctx=await br.newContext(opt),errs=[],p=await newPage(ctx);watch(p,errs);
    await p.route('**/data/ulke.json',yol);
    await p.goto(B+'ocr.html');await p.evaluate(()=>{localStorage.setItem('ulke','TR');localStorage.setItem('dil','tr')});
    await p.goto(B+'ocr.html');
    // gıda listesi ülke verisini en çok 3 sn bekler
    const acildi=await p.waitForFunction(()=>typeof IDX!=='undefined'&&IDX,null,{timeout:6000}).then(()=>true,()=>false);
    ok(acildi,'ulke.json '+ad+': gıda listesi 6 sn içinde açılır');
    if(acildi){await p.evaluate(()=>{document.getElementById('metin').value='İçindekiler: şeker, renklendirici (E171).';HSCAN=HOCR=true;run()});
      ok(/E171/.test(await p.textContent('#sonuc')),'ulke.json '+ad+': gıda sonucu çizilir')}
    await p.click('#m-tem');await p.waitForFunction(()=>typeof TIDX!=='undefined'&&TIDX,null,{timeout:8000}).catch(()=>{});
    await p.evaluate(m=>{document.getElementById('metin').value=m;HSCAN=HOCR=true;run()},TEM);await p.waitForTimeout(300);
    ok(/114/.test(await p.textContent('#sonuc')),'ulke.json '+ad+': temizlikte zehir danışma hattı 114 kalır');
    ok(!errs.length,'ulke.json '+ad+': sayfa hatası yok: '+errs.join(' | '));
    await ctx.close();
  }
  // Geç gelen ülke verisi: gıda sonucu açıldıktan sonra gelince sonuç ülke satırıyla yeniden çizilir
  {const ctx=await br.newContext(opt),p=await newPage(ctx);let birak;const bekle=new Promise(r=>birak=r);
    await p.route('**/data/ulke.json',async r=>{await bekle;r.continue()});
    await p.goto(B+'ocr.html');await p.evaluate(()=>{localStorage.setItem('ulke','GB')});await p.goto(B+'ocr.html');
    await p.waitForFunction(()=>typeof IDX!=='undefined'&&IDX,null,{timeout:6000}).catch(()=>{});
    await p.evaluate(()=>{document.getElementById('metin').value='İçindekiler: şeker, renklendirici (E171).';HSCAN=HOCR=true;run()});
    birak();await p.waitForFunction(()=>!!ULKE_VERI,null,{timeout:5000}).catch(()=>{});await p.waitForTimeout(300);
    await p.locator('#sonuc button.info').first().click();await p.waitForTimeout(300);
    ok(/Birleşik Krallık: izinli/.test(await p.textContent('#sheet')),'geç gelen ülke verisi: sonuç ülke satırıyla yeniden çizilir');
    await ctx.close()}
};
