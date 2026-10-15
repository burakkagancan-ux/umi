// Arayüz testi, 4. grup: İngilizce tur, dil dosyalarının önbelleğe inmesi, çevrimdışı açılış (4b–5)
// Tek başına çalışmaz; test/arayuz.js bütün grupları kendi sunucularıyla paralel çalıştırır.
const fs=require('fs'),path=require('path');
const {R,newPage,watch,onbellekte,sample,scan,pairs,ACILIS}=require('./ortak.js');
module.exports=async({br,B,opt,ok,server})=>{
  let ctx,p,errs=[];
  // 4b) İngilizce: tarayıcı dili en-US, kayıtlı seçim yok → sayfa İngilizce açılır
  ctx=await br.newContext(Object.assign({},opt,{locale:'en-US'}));p=await newPage(ctx);watch(p,errs);
  await p.goto(B+'ocr.html');await p.waitForFunction(()=>typeof IDX!=='undefined'&&IDX,null,{timeout:15000});
  ok(await p.getAttribute('html','lang')==='en'&&(await p.textContent('h1'))==='Read Label','İngilizce açılış: lang ve başlık');
  {
    // Ana ekrana eklenen uygulama: manifest İngilizce, kimlik ve başlangıç sayfası Türkçeyle aynı
    const mf=await p.getAttribute('link[rel="manifest"]','href');
    const m=await p.evaluate(async h=>{const r=await fetch(h);const j=await r.json();const u=x=>new URL(x,new URL(h,location.href)).pathname;return {ad:j.name,ac:j.description,k:j.shortcuts.map(s=>[s.name,u(s.url)]),bas:u(j.start_url),id:new URL(j.id,new URL(j.start_url,new URL(h,location.href))).pathname,ikon:u(j.icons[0].src)}},mf);
    const tr=await p.evaluate(async()=>{const j=await (await fetch('manifest.webmanifest')).json();const b=new URL('manifest.webmanifest',location.href);return {bas:new URL(j.start_url,b).pathname,id:new URL(j.id,new URL(j.start_url,b)).pathname}});
    ok(mf==='i18n/manifest/en.webmanifest'&&/^Scan/.test(m.ac)&&m.k.map(x=>x[0]).join()==='Read Label,Encyclopedia'&&m.k[0][1]==='/ocr.html'&&m.ikon==='/icon-192.png','İngilizce manifest: açıklama, kısayollar, yollar: '+JSON.stringify(m));
    ok(m.bas==='/ocr.html'&&tr.bas==='/ocr.html'&&m.id==='/'&&tr.id==='/','manifest kimliği ve başlangıç sayfası iki dilde aynı: '+JSON.stringify([m,tr]));
  }
  ok((await p.textContent('#ornek'))==='Try sample text'&&(await p.getAttribute('#metin','placeholder')).startsWith('The text'),'İngilizce düğme ve placeholder');
  const anahtarVar=()=>p.evaluate(()=>{const m=document.body.innerText.match(/\b(ortak|gida|koz|tem|kars|kayit|pay|profil|risk|sayfa|ulke|veri|kanser|eslesme|foto|ocr|nav|birim|ans|besin)\.[a-z0-9_]+(\.[a-z0-9_]+)*\b/);return m?m[0]:''});
  for(const m of ['gida','koz','tem']){
    await sample(p,m);
    ok(await p.$$eval('#sonuc .res',e=>e.length)>2,'en '+m+': sonuç kartları');
    ok(/Summary/.test(await p.textContent('#sonuc .sumbox .t')),'en '+m+': özet başlığı İngilizce');
    const k=await anahtarVar();ok(!k,'en '+m+': ekranda çıplak anahtar: '+k);
    ok((await p.textContent('#sonuc .resbar button.pay:not(.kayitb)')).trim()==='Share','en '+m+': Share düğmesi');
    await p.click('#sonuc .resbar button.pay:not(.kayitb)');await p.waitForFunction(()=>{const c=document.querySelector('#sheet canvas');return c&&c.width>0&&/I checked the ingredients/.test(c.getAttribute('aria-label')||'')},null,{timeout:10000});
    ok(true,'en '+m+': paylaşım kartı çizildi');await p.evaluate(()=>closeSheet());
  }
  // Veri metinleri İngilizcede çevrili (12.10.2026): örnek gıdanın kartında "not yet translated" işareti yok.
  // Çevrilmemiş metne düşme (Türkçe + işaret) davranışı test/ceviri.js'te (veriMetin) denetlenir.
  await sample(p,'gida');await p.evaluate(()=>document.querySelector('#sonuc .res.tap').click());
  ok(await p.$$eval('#sheet .cvm',e=>e.length===0),'gıda kartında çevrilmemiş veri işareti yok');
  ok(/Read in the encyclopedia/.test(await p.textContent('#sheet')),'alt sayfa İngilizce');await p.evaluate(()=>closeSheet());
  // Resmi İngilizce: E kodu adı (name_en), CLP tehlike ifadesi
  ok(/E110 Sunset Yellow FCF/i.test(await p.textContent('#sonuc')),'E kodu resmi İngilizce adı');
  await sample(p,'tem');ok(/Causes serious eye damage/.test(await p.textContent('#sonuc')),'CLP ifadesinin resmi İngilizcesi');
  // Karşılaştırma (üç mod)
  for(const m of Object.keys(pairs)){
    await p.evaluate(()=>{document.getElementById('metin').value='';localStorage.removeItem('taramalar')});
    await scan(p,m,pairs[m][0]);await scan(p,m,pairs[m][1]);await p.click('#karsla');
    for(const it of await p.$$('#sheet .kpick button.kitem'))if(await it.getAttribute('aria-pressed')!=='true')await it.click();
    await p.click('#sheet .kpick button:not(.kitem):not(.kclr)');await p.waitForSelector('#kars:not([hidden]) .kdec');
    ok(/looks better in terms of ingredients/.test(await p.textContent('#kars .kdec .t')),'en '+m+': karşılaştırma kararı İngilizce');
    const k=await anahtarVar();ok(!k,'en '+m+' karşılaştırma: çıplak anahtar: '+k);
    await p.evaluate(()=>closeCompare());
  }
  // Sağdan sola dil: kart aynalanarak çizilir, hata vermez (Arapça çevirisi yok; yalnızca altyapı)
  ok(await p.evaluate(()=>{const s={kod:DIL.kod,sozluk:DIL.sozluk,bilgi:DIL.bilgi,veri:DIL.veri};try{dilKur('ar',{tr:DIL.sozluk.tr,en:DIL.sozluk.en,ar:{}},{ar:{ad:'العربية',yon:'rtl'}});const c=document.createElement('canvas'),L=PAYLAS_AYAR.yerlesim.hikaye;c.width=L.w;c.height=L.h;
    const out=payDraw(c.getContext('2d'),payModel(paySource(),{name:'X'},PAYLAS_AYAR,L),L,PAYLAS_AYAR,null);return out.length>5}finally{dilKur(s.kod,s.sozluk,s.bilgi,s.veri)}}),'sağdan sola kart çizimi');
  // Ansiklopedi ve Liste arayüzü İngilizce (12.10.2026); Bakanlık verisi Türkçe kalır
  await p.goto(B+'ansiklopedi.html?id=E322');await p.waitForSelector('#ana .risk');
  ok(await p.getAttribute('html','lang')==='en'&&(await p.textContent('h1'))==='Encyclopedia','ansiklopedi İngilizce başlık');
  ok(/What does it do\?/.test(await p.textContent('#ana .panel'))&&(await p.textContent('#tab-otorite'))==='Authorities','ansiklopedi sekmeleri İngilizce');
  {const k=await anahtarVar();ok(!k,'ansiklopedi: çıplak anahtar: '+k)}
  await p.goto(B+'ansiklopedi.html');await p.waitForSelector('#ara');
  ok((await p.getAttribute('#ara','placeholder')).startsWith('Name, E number or CAS')&&/^All 333$/.test(await p.textContent('#ana .rfil.tum')),'ansiklopedi arama ve süzgeç İngilizce');
  await p.goto(B+'index.html');await p.waitForFunction(()=>/listed/.test((document.getElementById('count')||{}).textContent||''),null,{timeout:10000});
  ok(await p.getAttribute('html','lang')==='en'&&/Adulteration List/.test(await p.textContent('h1'))&&(await p.textContent('#il option'))==='All provinces','Liste İngilizce');
  ok((await p.textContent('.tabbar a[data-tab="oku"]'))==='Read Label','alt menü İngilizce');
  // Ürün grubu ve uygunsuzluk türü İngilizce görünür, süzgeç Bakanlık verisindeki Türkçe değerle çalışır (12.10.2026)
  await p.waitForFunction(()=>[...document.querySelectorAll('#grup option')].some(o=>o.textContent==='Meat and meat products'),null,{timeout:10000});
  {const g=await p.$eval('#grup option[value="Et ve Et Ürünleri"]',o=>o.textContent);ok(g==='Meat and meat products','Liste ürün grubu İngilizce: '+g);
   await p.selectOption('#grup','Et ve Et Ürünleri');
   const tg=await p.$$eval('#list .rec .tag',e=>e.map(x=>x.textContent));
   ok(tg.length&&tg.every(x=>!/Tespit|Olması|Edilmemesi/.test(x))&&tg.includes('Poultry meat detected'),'Liste uygunsuzluk türleri İngilizce: '+tg.slice(0,4).join(', '));
   const dd=await p.$eval('#list .rec dd:nth-of-type(3)',e=>e.textContent);ok(dd==='Meat and meat products','Liste ayrıntıda ürün grubu İngilizce: '+dd);
   await p.selectOption('#grup','')}
  // Alt menü (12.10.2026): Ansiklopedi solda, Etiket Oku ortada, Profilim sağda; Liste şimdilik gizli (sayfa çalışır)
  ok((await p.$$eval('.tabbar a',a=>a.map(x=>x.dataset.tab).join(',')))==='ansiklopedi,oku,liste,profil','alt menü sırası');
  ok(!(await p.isVisible('.tabbar a[data-tab="liste"]'))&&await p.isVisible('.tabbar a[data-tab="profil"]'),'ülke seçilmemişken Liste menüde görünmüyor');
  {const k=await anahtarVar();ok(!k,'Liste: çıplak anahtar: '+k)}
  // Dil seçimi: Profilim'den Türkçe → sayfa Türkçe yeniden yüklenir
  await p.goto(B+'ocr.html#profil');await p.waitForSelector('#dilsec');
  await Promise.all([p.waitForNavigation(),p.selectOption('#dilsec','tr')]);await p.waitForFunction(()=>typeof IDX!=='undefined'&&IDX);
  ok(await p.getAttribute('html','lang')==='tr'&&await p.evaluate(()=>localStorage.getItem('dil'))==='tr','dil seçici: Türkçe kaydedildi ve uygulandı');
  ok(await p.getAttribute('link[rel="manifest"]','href')==='manifest.webmanifest','Türkçede manifest değişmez');
  ok(!(await p.isVisible('.tabbar a[data-tab="liste"]'))&&await p.isVisible('.tabbar a[data-tab="oku"]'),'Liste şimdilik menüde yok (Türkiye seçiliyken de)');
  ok((await p.$$eval('#ulkesec option',o=>o.length))>20,'İngilizce konuşulan ülkeler listede');
  ok(!errs.length,'İngilizce tur konsol hatası: '+errs.join(' | '));errs.length=0;
  await ctx.close();

  // 4c) Seçili dilin dosyaları kurulumda inmez; ilk ziyarette (sayfa henüz service worker denetiminde değilken) sayfa bildirir, önbelleğe iner.
  //     İstek yönlendirmesiz bağlam: yönlendirme açıkken service worker kurulmuyor
  ctx=await br.newContext({viewport:opt.viewport,locale:'en-US'});p=await ctx.newPage();watch(p,errs);
  await p.goto(B+'ocr.html');
  {let c=[];for(let i=0;i<60&&c.length<2;i++){c=await onbellekte(p,['i18n/en.json','i18n/veri/en.json']);if(c.length<2)await p.waitForTimeout(500)}
   ok(c.length===2,'İngilizce dosyaları ilk ziyarette önbelleğe inmedi: '+c.join(','))}
  ok(!errs.length,'İngilizce önbellek konsol hatası: '+errs.join(' | '));errs.length=0;
  await ctx.close();

  // 5) Çevrimdışı: service worker önbelleği dolunca sunucu kapatılır (ctx.setOffline service worker isteklerini kesmiyor);
  //    sayfa yeniden yüklenir, üç modda analiz önbellekten çalışmalı. Kozmetik ve temizlik verisi bu modlara hiç girilmeden önbellekte olmalı.
  // Bu bölümde istek yönlendirme kullanılmaz: yönlendirme açıkken service worker sayfayı denetlemez
  ctx=await br.newContext({viewport:opt.viewport,locale:'tr-TR'});p=await ctx.newPage();watch(p,errs);
  await p.goto(B+'ocr.html');
  // Açılan ansiklopedi sayfası internetsiz de açılır (madde sayfaları kurulumda inmez)
  await p.waitForFunction(()=>navigator.serviceWorker.controller,null,{timeout:15000});
  await p.goto(B+'ansiklopedi.html?id=E250');await p.waitForSelector('#ana .risk');await p.goto(B+'ocr.html');
  const need=['data/kozmetik.json','data/kozmetik_inci.json','data/temizlik.json','data/eslesmeler.json'];
  let have=[];
  for(let i=0;i<60;i++){   // waitForFunction async işlevi beklemez; elle yoklanır
    have=await p.evaluate(async need=>{const r=await navigator.serviceWorker.getRegistration();if(!r||!r.active||!navigator.serviceWorker.controller)return [];
      const out=[];for(const k of await caches.keys()){const c=await caches.open(k);for(const f of need)if(await c.match(f))out.push(f)}return out},need);
    if(need.every(f=>have.includes(f)))break;await p.waitForTimeout(500);
  }
  need.forEach(f=>ok(have.includes(f),'kurulumda önbelleğe alınmadı: '+f));
  {const c=await onbellekte(p,['i18n/en.json','i18n/veri/en.json','data/ansiklopedi/E322.json','data/ansiklopedi/E250.json','data/ansiklopedi/tr/E250.json']);
   ok(c.join()==='data/ansiklopedi/E250.json,data/ansiklopedi/tr/E250.json','Türkçe kullanıcıda yalnızca açılan sayfa önbellekte olmalı: '+c.join(','))}
  await new Promise(r=>{server.close(r);server.closeAllConnections()});
  await p.reload();await p.waitForFunction(()=>typeof IDX!=='undefined'&&IDX,null,{timeout:15000});
  for(const m of ['koz','tem','gida']){
    try{await sample(p,m);ok(await p.$$eval('#sonuc .res',e=>e.length)>2,'çevrimdışı '+m+' analizi')}
    catch(e){ok(false,'çevrimdışı '+m+' analizi: '+(await p.textContent('#sonuc')).slice(0,80))}
  }
  await p.goto(B+'ansiklopedi.html?id=E250');await p.waitForSelector('#ana .risk',{timeout:10000}).catch(()=>{});
  ok(/E250/.test(await p.textContent('#ana .badges').catch(()=>''))&&(await p.$$('#ana .panel')).length===3,'çevrimdışı: açılmış ansiklopedi sayfası');
  await p.goto(B+'ansiklopedi.html?id=E322');await p.waitForFunction(()=>/henüz bu cihaza inmedi/.test(document.getElementById('ana').textContent),null,{timeout:10000}).catch(()=>{});
  ok(/henüz bu cihaza inmedi/.test(await p.textContent('#ana')),'çevrimdışı: açılmamış sayfa notu: '+(await p.textContent('#ana')).slice(0,80));
  await p.goto(B+'ansiklopedi.html');await p.waitForSelector('#ara');await p.fill('#ara','lesitin');
  await p.waitForFunction(()=>{const n=document.querySelectorAll('#ana a.row').length;return n>0&&n<50},null,{timeout:10000}).catch(()=>{});
  ok(await p.$$eval('#ana a.row .rk',e=>e.length&&e[0].textContent.startsWith('E322 ·')),'çevrimdışı: ansiklopedi araması');
  ok(!errs.length,'çevrimdışı konsol hatası: '+errs.join(' | '));
  await ctx.close();

};
