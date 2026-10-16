// Arayüz testi, 5. grup: koyu tema (17.10.2026). Telefon koyu moddayken her ekranda görünen her yazı zeminine karşı okunur mu (kontrast en az 3:1)
// ve koyu temada açık (beyaz) zemin kalmış mı. Sayfa dosyasına sabit renk yazılıp koyu karşılığı unutulursa burada yakalanır.
// Hareket kapalı açılır (reducedMotion), ölçüm belirme hareketinin ortasına denk gelmesin.
// Tek başına çalışmaz; test/arayuz.js bütün grupları kendi sunucularıyla paralel çalıştırır.
const {newPage,watch,sample,scan,pairs,ACILIS}=require('./ortak.js');
module.exports=async({br,B,opt,ok})=>{
  const ctx=await br.newContext({...opt,colorScheme:'dark',reducedMotion:'reduce'}),errs=[],p=await newPage(ctx);watch(p,errs);
  // Görünen her yazının rengi ile ilk opak atasının zemini arasındaki kontrast (WCAG göreli parlaklık); açık zeminli kutular ayrıca
  const denetle=async ad=>{
    const r=await p.evaluate(()=>{
      const rgb=s=>{const m=s.match(/[\d.]+/g);return m?m.map(Number):[0,0,0,0]};
      const lin=c=>{c/=255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4)};
      const L=c=>.2126*lin(c[0])+.7152*lin(c[1])+.0722*lin(c[2]);
      const zemin=e=>{for(;e;e=e.parentElement){const c=rgb(getComputedStyle(e).backgroundColor);if((c[3]??1)>=.5)return c}return rgb(getComputedStyle(document.body).backgroundColor)};
      const gor=e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return b.width>1&&b.height>1&&s.visibility!=='hidden'&&+s.opacity>.3&&!e.closest('.vh,[hidden],[aria-hidden="true"]')};
      const kotu=[],acik=[];
      for(const e of document.querySelectorAll('body *')){
        if(!gor(e))continue;
        const c=rgb(getComputedStyle(e).backgroundColor);
        if((c[3]??1)>=.5&&L(c)>.6&&!e.closest('canvas,img,video,#crop'))acik.push(e.tagName.toLowerCase()+'.'+e.className+' '+getComputedStyle(e).backgroundColor);
        if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
        const a=L(rgb(getComputedStyle(e).color)),z=L(zemin(e)),k=(Math.max(a,z)+.05)/(Math.min(a,z)+.05);
        if(k<3)kotu.push(e.tagName.toLowerCase()+'.'+e.className+' "'+e.textContent.trim().slice(0,30)+'" '+k.toFixed(2));
      }
      return {kotu:[...new Set(kotu)].slice(0,8),acik:[...new Set(acik)].slice(0,8),bg:L(rgb(getComputedStyle(document.body).backgroundColor))};
    });
    ok(r.bg<.02,ad+': koyu zemin ('+r.bg.toFixed(3)+')');
    ok(!r.kotu.length,ad+': okunmayan yazı: '+r.kotu.join(' | '));
    ok(!r.acik.length,ad+': koyu temada açık zemin: '+r.acik.join(' | '));
  };
  await p.goto(B+'ocr.html');await p.waitForFunction(ACILIS,null,{timeout:15000});
  await denetle('Etiket Oku açılış');
  for(const m of ['gida','koz','tem']){await sample(p,m);await denetle('sonuç '+m)}
  // Alt sayfa ve karşılaştırma (gıda)
  await p.evaluate(()=>localStorage.removeItem('taramalar'));
  await scan(p,'gida',pairs.gida[0]);await scan(p,'gida',pairs.gida[1]);
  await p.click('#sonuc .res.tap');await p.waitForSelector('#sheet .sheet-pn',{state:'visible'});await denetle('alt sayfa');
  await p.evaluate(()=>closeSheet());
  await p.click('#karsla');
  for(const it of await p.$$('#sheet .kpick button.kitem'))if(await it.getAttribute('aria-pressed')!=='true')await it.click();
  await p.click('#sheet .kpick button:not(.kitem):not(.kclr)');await p.waitForSelector('#kars:not([hidden]) .kdec');
  await denetle('karşılaştırma');
  await p.evaluate(()=>closeCompare());
  await p.goto(B+'ocr.html#profil');await p.waitForSelector('#kayitbar .kayitac');
  await p.evaluate(()=>document.querySelectorAll('#profil details').forEach(d=>d.open=true));
  await denetle('Profilim');
  await p.goto(B+'ansiklopedi.html');await p.waitForSelector('#ana .gdrop');
  await p.evaluate(()=>document.querySelector('#ana .gdrop').open=true);
  await denetle('Ansiklopedi listesi');
  for(const id of ['E322','E250','E211']){await p.goto(B+'ansiklopedi.html?id='+id);await p.waitForSelector('#ana .risk');await denetle('Ansiklopedi '+id)}
  ok(!errs.length,'koyu tema: konsol hatası yok: '+errs.join(' | '));
  await ctx.close();
};
