// Arayüz testi, 6. grup: küçük hareket detayları (17.10.2026; js/hareket.js, js/alt_menu.js, tema.css). Hareket açık bağlamda: seçilen süzgeç .pop alır,
// seçili sekme işareti sekmenin ortasında ve sekme değişince oraya kayar (aynı sayfada ve sayfalar arası), sayılar sayıp birebir eski metne döner,
// silinen öğe kaybolduktan sonra işlem tamamlanır, ✓ sınıfı konur; "hareketi azalt" açıkken sayılar değişmez ve silme hemen tamamlanır.
// Tek başına çalışmaz; test/arayuz.js bütün grupları kendi sunucularıyla paralel çalıştırır.
const {newPage,watch,sample,ACILIS}=require('./ortak.js');
module.exports=async({br,B,opt,ok})=>{
  let ctx=await br.newContext({...opt,reducedMotion:'no-preference'}),errs=[],p=await newPage(ctx);watch(p,errs);
  // İşaret sayfaya ilk konduğu andaki konumu (sayfalar arası kaymanın eski sekmeden başladığını görmek için)
  await ctx.addInitScript(()=>{new MutationObserver((m,o)=>{const i=document.querySelector('.tabbar .sekme-isaret');if(i){window.__ilk=i.style.transform;o.disconnect()}}).observe(document,{childList:true,subtree:true})});
  // İşaretin ortası ile seçili sekmenin ortası arasındaki fark (piksel)
  const isaretFark=()=>p.evaluate(()=>{const i=document.querySelector('.tabbar .sekme-isaret').getBoundingClientRect(),a=document.querySelector('.tabbar a[aria-current="page"]').getBoundingClientRect();
    return Math.abs((i.left+i.width/2)-(a.left+a.width/2))});
  // Seçili sekme işareti: açılışta yerinde; Profilim'e (aynı sayfa) geçince kayar ve simge zıplar
  await p.goto(B+'ocr.html');await p.waitForFunction(ACILIS,null,{timeout:15000});
  ok(await isaretFark()<1.5,'açılışta sekme işareti seçili sekmenin üstünde: fark '+(await isaretFark()).toFixed(1));
  ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.tabbar')).viewTransitionName)==='tabbar','sayfa geçişinde menü yerinde kalır (view-transition-name)');
  await p.click('.tabbar a[data-tab="profil"]');
  ok(await p.evaluate(()=>{const s=document.querySelector('.tabbar a[data-tab="profil"] svg');return s.classList.contains('zipla')&&document.querySelector('.sekme-isaret').classList.contains('kay')}),'Profilim seçilince simge zıplar, işaret kayar');
  await p.waitForTimeout(400);
  ok(await isaretFark()<1.5,'kayma bitince işaret Profilim\'in üstünde: fark '+(await isaretFark()).toFixed(1));
  // Sayfalar arası: Ansiklopedi'ye geçilince işaret eski sekmeden başlar, Ansiklopedi'de durur
  await p.click('.tabbar a[data-tab="ansiklopedi"]');await p.waitForSelector('#ana .okfil');
  await p.waitForTimeout(400);
  ok(await isaretFark()<1.5,'başka sayfada işaret yeni sekmenin üstünde: fark '+(await isaretFark()).toFixed(1));
  ok(await p.evaluate(()=>{const a=document.querySelector('.tabbar a[data-tab="profil"]'),x=parseFloat((window.__ilk||'').replace('translateX(',''));return Math.abs(x-(a.offsetLeft+a.offsetWidth/2))<1.5}),
    'başka sayfada işaret eski sekmeden (Profilim) başlar: '+await p.evaluate(()=>window.__ilk));
  ok(await p.evaluate(()=>sessionStorage.getItem('sekme_once'))===null,'eski sekme bilgisi okunduktan sonra silinir');
  // Seçim pop'u: süzgeç baştan çizilse de yeni seçili düğme .pop alır; seçimi kaldırmak pop vermez
  await p.click('#ana .rfil.red');
  ok(await p.evaluate(()=>{const b=document.querySelector('#ana .rfil.red');return b.getAttribute('aria-pressed')==='true'&&b.classList.contains('pop')}),'seçilen süzgeç bir an büyür (.pop)');
  await p.waitForTimeout(450);
  ok(await p.evaluate(()=>!document.querySelector('#ana .pop')),'.pop kısa süre sonra kalkar');
  await p.click('#ana .okfil');await p.click('#ana .okfil');
  ok(await p.evaluate(()=>!document.querySelector('#ana .okfil').classList.contains('pop')),'seçimi kaldırılan düğme pop almaz');
  // Yardımcılar: sayma, silme, ✓
  const yard=await p.evaluate(async()=>{
    const d=document.createElement('div');d.textContent='12 madde, E330, %5';document.body.appendChild(d);hareketSay(d);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const ara=d.textContent;
    await new Promise(r=>setTimeout(r,600));const son=d.textContent;d.remove();
    const ul=document.createElement('div'),li=document.createElement('div');li.textContent='x';ul.appendChild(li);document.body.appendChild(ul);
    let bitti=false;hareketCik(li,()=>{bitti=true});const hemen=bitti;await new Promise(r=>setTimeout(r,400));ul.remove();
    const b=document.createElement('button');document.body.appendChild(b);hareketTamam(b);const tm=b.classList.contains('tamam');b.remove();
    return {ara,son,hemen,bitti,tm};
  });
  ok(yard.ara!=='12 madde, E330, %5'&&/E330/.test(yard.ara),'sayılar sayarken değişir, madde kodu (E330) değişmez: '+yard.ara);
  ok(yard.son==='12 madde, E330, %5','sayma bitince metin birebir eski hâli');
  ok(!yard.hemen&&yard.bitti,'silinen öğe kaybolduktan sonra işlem tamamlanır');
  ok(yard.tm,'iş bitince düğmede ✓ (.tamam)');
  // Özet kartı gerçek analizde de sonunda doğru sayıyı gösterir
  await p.goto(B+'ocr.html');await p.waitForFunction(ACILIS,null,{timeout:15000});await sample(p,'gida');
  await p.waitForTimeout(600);
  ok(await p.evaluate(()=>{const o=document.querySelector('#sonuc .ozet .oz-ust');return !!o&&/[1-9]/.test(o.textContent)}),'özet kartı sayma sonrası sıfır olmayan sayıyı gösterir');
  ok(!errs.length,'hareket açıkken konsol hatası yok: '+errs.join(' | '));
  await ctx.close();
  // "Hareketi azalt" açık: sayılar değişmez, silme hemen tamamlanır, süzgeç pop almaz
  ctx=await br.newContext({...opt,reducedMotion:'reduce'});errs=[];p=await newPage(ctx);watch(p,errs);
  await p.goto(B+'ansiklopedi.html');await p.waitForSelector('#ana .okfil');
  await p.click('#ana .rfil.red');
  const az=await p.evaluate(()=>{
    const d=document.createElement('div');d.textContent='12 madde';document.body.appendChild(d);hareketSay(d);const s=d.textContent;d.remove();
    const li=document.createElement('div');document.body.appendChild(li);let bitti=false;hareketCik(li,()=>{bitti=true});li.remove();
    return {s,bitti,pop:!!document.querySelector('#ana .pop')};
  });
  ok(az.s==='12 madde'&&az.bitti&&!az.pop,'hareketi azalt: sayı sabit, silme hemen, pop yok: '+JSON.stringify(az));
  ok(!errs.length,'hareketi azaltta konsol hatası yok: '+errs.join(' | '));
  await ctx.close();
};
