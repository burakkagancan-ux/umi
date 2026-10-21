// Arayüz testi, 9. grup: Son Okutulanlar ve Aylık Özetim bozma turu (21.10.2026) gerileme testleri.
// H1: veri yüklenmeden satıra dokunma (tek ve çift) geçmiş sırasını değiştirmez, aylık özete yazmaz. H2: öneri kartıyla taşımada hedef türde aynı metin
// varsa aylıkta tek ürün. H3: geçmişte tek bozuk kayıt açılışı durdurmaz. H4: İngilizce tekil. H5: ay seçicide son aya gelince odak Geri'ye atlamaz.
// Tek başına çalışmaz; test/arayuz.js bütün grupları kendi sunucularıyla paralel çalıştırır.
const {newPage,watch,scan,ACILIS}=require('./ortak.js');
const KOZ=['Ingredients: Aqua, Glycerin, Methylparaben, Parfum.','Ingredients: Aqua, Sodium Laureth Sulfate, Linalool.'];
const ayOzet=p=>p.evaluate(()=>aylikOzet(aylikLoad(),ayAnahtar(Date.now())));
const sira=p=>p.evaluate(()=>histLoad().map(x=>x.name).join(','));
module.exports=async({br,B,opt,ok})=>{
  // H1: kozmetik verisi geç gelirken eski satıra tek ve çift dokunuş
  {const ctx=await br.newContext(opt),errs=[],p=await newPage(ctx);watch(p,errs);
    await p.goto(B+'ocr.html');await p.waitForFunction(ACILIS);
    for(const k of KOZ)await scan(p,'koz',k);
    // aylık kayıt geçen aya, geçmiş 40 gün geriye: bu ayın sayısı 0 olmalı ve öyle kalmalı
    await p.evaluate(()=>{const o=aylikLoad(),b=ayAnahtar(Date.now()),g=ayKaydir(b,-1);o.ay[g]=o.ay[b];delete o.ay[b];aylikStore(o);
      histStore(histLoad().map(x=>Object.assign(x,{t:x.t-40*864e5})))});
    const once=await sira(p);
    for(const [ad,cift] of [['tek',false],['çift',true]]){
      let birak;const bekle=new Promise(r=>birak=r);
      await p.route('**/data/kozmetik*.json',async r=>{await bekle;r.continue()});
      await p.goto(B+'ocr.html');await p.waitForFunction(ACILIS);await p.waitForSelector('#son button');
      const satir=p.locator('#son button').nth(1);
      if(cift)await satir.dblclick();else await satir.click();
      birak();await p.waitForFunction(()=>/Methylparaben|Linalool|METHYLPARABEN|LINALOOL/i.test(document.getElementById('sonuc').textContent),null,{timeout:10000}).catch(()=>{});
      await p.waitForTimeout(400);await p.unroute('**/data/kozmetik*.json');
      ok(await sira(p)===once,'H1 '+ad+' dokunuş: geçmiş sırası değişmez ('+once+' → '+await sira(p)+')');
      ok((await ayOzet(p)).toplam===0,'H1 '+ad+' dokunuş: aylık özete yazılmaz');
    }
    // Açılan kaydın metni elle değiştirilince aynı kayıt güncellenir ve bu ay sayılır (HGOR sıfırlanır)
    await p.locator('#metin').evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input'))},KOZ[0]+' Limonene.');
    await p.waitForTimeout(1200);
    ok((await ayOzet(p)).toplam===1,'elle değiştirilen kayıt bu ay sayılır');
    ok(!errs.length,'H1: sayfa hatası yok: '+errs.join(' | '));await ctx.close();}
  // H2: taşımada hedef türde aynı metin varsa aylıkta tek ürün, tür kozmetik
  {const ctx=await br.newContext(opt),errs=[],p=await newPage(ctx);watch(p,errs);
    await p.goto(B+'ocr.html');await p.waitForFunction(ACILIS);
    const tasi=async()=>{const b=p.locator('#sonuc button',{hasText:/Kozmetik olarak analiz et/});await b.first().click();await p.waitForFunction(()=>MODE==='koz');await p.waitForTimeout(800)};
    await scan(p,'gida',KOZ[0]);await tasi();
    await scan(p,'gida',KOZ[0]);await tasi();
    const z=await ayOzet(p);
    ok(z.toplam===1&&z.tur.koz===1&&z.tur.gida===0,'H2: taşınan ürün aylıkta tek, kozmetik: '+JSON.stringify(z.tur));
    ok(!errs.length,'H2: sayfa hatası yok: '+errs.join(' | '));await ctx.close();}
  // H3: geçmişte biçimi bozuk kayıt (metin sayı, zaman yok) açılışı durdurmaz
  for(const bozuk of [[{id:'h1',t:1,mode:'gida',name:'X',text:12345}],[{id:'h2',mode:'gida',name:'Y',text:'İçindekiler: su'}]]){
    const ctx=await br.newContext(opt),errs=[],p=await newPage(ctx);watch(p,errs);
    await p.goto(B+'ocr.html');await p.evaluate(b=>localStorage.setItem('taramalar',JSON.stringify(b)),bozuk);
    await p.goto(B+'ocr.html#profil');await p.waitForFunction(ACILIS);await p.waitForTimeout(600);
    ok(await p.locator('#aylikbar button').count()===1&&await p.locator('#rozetbar button').count()===1,'H3: bozuk geçmiş kaydında Profilim kısayolları çizilir');
    ok(!errs.length,'H3: sayfa hatası yok: '+errs.join(' | '));await ctx.close();}
  // H4: İngilizcede tekil; H5: odak ay seçicide kalır
  {const ctx=await br.newContext(Object.assign({},opt,{locale:'en-GB'})),errs=[],p=await newPage(ctx);watch(p,errs);
    await p.goto(B+'ocr.html');await p.evaluate(()=>localStorage.setItem('dil','en'));await p.goto(B+'ocr.html');await p.waitForFunction(ACILIS);
    await scan(p,'gida','Ingredients: water, sugar, sodium nitrite.');
    await p.evaluate(()=>{const o=aylikLoad(),b=ayAnahtar(Date.now());o.ay[ayKaydir(b,-1)]=JSON.parse(JSON.stringify(o.ay[b]));aylikStore(o)});
    await p.goto(B+'ocr.html#aylik');await p.waitForSelector('#aylik:not([hidden])');
    const m=await p.innerText('#aylik');
    ok(!/\b1 products\b/.test(m)&&/1 product\b/.test(m),'H4: İngilizcede "1 product": '+m.match(/[^.]{0,30}1 products?[^.]{0,10}/g));
    ok(!/1 products/.test(await p.innerText('#aylikbar')),'H4: kısayolda tekil');
    await p.getByRole('button',{name:'Previous month'}).click();
    ok(await p.evaluate(()=>{const a=document.activeElement;return !!a&&a.closest('.aynav')!==null}),'H5: en eski aya gelince odak ay seçicide');
    await p.keyboard.press('Enter');await p.waitForTimeout(200);
    ok(await p.evaluate(()=>location.hash==='#aylik'),'H5: Enter ekrandan çıkarmaz');
    await p.getByRole('button',{name:'Next month'}).click();
    ok(await p.evaluate(()=>document.activeElement.closest('.aynav')!==null),'H5: bu aya gelince odak ay seçicide');
    ok(!errs.length,'H4/H5: sayfa hatası yok: '+errs.join(' | '));await ctx.close();}
};
