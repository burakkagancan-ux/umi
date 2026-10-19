// Arayüz testi, 5. grup: koyu tema (17.10.2026). Telefon koyu moddayken her ekranda görünen her yazı zeminine karşı okunur mu (kontrast en az 3:1)
// ve koyu temada açık (beyaz) zemin kalmış mı. Sayfa dosyasına sabit renk yazılıp koyu karşılığı unutulursa burada yakalanır.
// Hareket kapalı açılır (reducedMotion), ölçüm belirme hareketinin ortasına denk gelmesin.
// Tek başına çalışmaz; test/arayuz.js bütün grupları kendi sunucularıyla paralel çalıştırır.
const {newPage,watch,sample,scan,pairs,ACILIS}=require('./ortak.js');

// Risk renklerinin BİRBİRİNDEN ayrımı (19.10.2026). Yukarıdaki denetim yazı/zemin farkını ölçer; risk düzeyi dolguları (özet şeridi, ansiklopedi
// dağılım çubuğu ve süzgeç noktası) yanlarında simge ya da yazı olmadan yalnızca renkle ayrılır. Ölçülen basamaklar: --hic (uyarı), --ambc (dikkat),
// --yesil (bulunamadı/doğal), --bos (bilgi yok). Şeritte bulunmayan düzey düştüğünde herhangi iki basamak yan yana gelebilir; bu yüzden her çift.
// Kabul ölçütü, her çift için en az biri:
//  (a) WCAG 2.x göreli parlaklık oranı ≥ 1,5 (parlaklık farkı renk körlüğünde de korunur), ya da
//  (b) döteranopi VE protanopi benzetiminde CIEDE2000 ΔE ≥ 20.
//     Benzetim: Machado, Oliveira, Fernandes 2009, "A Physiologically-based Model for Simulation of Color Vision Deficiency", IEEE TVCG 15(6),
//     şiddet 1,0 matrisleri, doğrusal sRGB'de. ΔE2000: Sharma, Wu, Dalal 2005 (Color Res. Appl. 30(1)) formülasyonu; Lab D65.
//     Eşik neden 20 (büyük yüzey için yaygın ~10–15 değil): dolgular küçük (6–10 px şerit, 9 px nokta). Stone, Szafir, Setlur 2014 ("An Engineering
//     Model for Color Difference as a Function of Size") küçük işaretlerde ayırt edilebilir farkın büyüdüğünü, en çok renk (a*, b*) ekseninde
//     küçüldüğünü gösterir; parlaklık farkı ise korunur. Bu yüzden renk farkına parlaklıktan daha yüksek bir eşik.
const lin=c=>{c/=255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)};
const parlak=l=>.2126*l[0]+.7152*l[1]+.0722*l[2];
const oran=(a,b)=>{a=parlak(a.map(lin));b=parlak(b.map(lin));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
const MACHADO={doteranopi:[[.367322,.860646,-.227968],[.280085,.672501,.047413],[-.01182,.04294,.968881]],
  protanopi:[[.152286,1.052583,-.204868],[.114503,.786281,.099216],[-.003882,-.048116,1.051998]]};
const benzet=(c,m)=>{const l=c.map(lin);return m.map(r=>Math.min(1,Math.max(0,r[0]*l[0]+r[1]*l[1]+r[2]*l[2])))};
const lab=l=>{const f=t=>t>216/24389?Math.cbrt(t):(24389/27*t+16)/116;
  const X=(.4124564*l[0]+.3575761*l[1]+.1804375*l[2])/.95047,Y=.2126729*l[0]+.7151522*l[1]+.072175*l[2],Z=(.0193339*l[0]+.119192*l[1]+.9503041*l[2])/1.08883;
  return [116*f(Y)-16,500*(f(X)-f(Y)),200*(f(Y)-f(Z))]};
function de2000([L1,a1,b1],[L2,a2,b2]){
  const d=Math.PI/180,C7=c=>Math.sqrt(c**7/(c**7+25**7));
  const G=.5*(1-C7((Math.hypot(a1,b1)+Math.hypot(a2,b2))/2)),p1=(1+G)*a1,p2=(1+G)*a2,C1=Math.hypot(p1,b1),C2=Math.hypot(p2,b2);
  const aci=(x,y)=>{if(!x&&!y)return 0;const t=Math.atan2(y,x)/d;return t<0?t+360:t},h1=aci(p1,b1),h2=aci(p2,b2);
  let dh=0;if(C1*C2){dh=h2-h1;if(dh>180)dh-=360;else if(dh<-180)dh+=360}
  const dH=2*Math.sqrt(C1*C2)*Math.sin(dh/2*d),Lm=(L1+L2)/2,Cm=(C1+C2)/2;
  let hm=h1+h2;if(C1*C2){if(Math.abs(h1-h2)>180)hm+=hm<360?360:-360;hm/=2}
  const T=1-.17*Math.cos((hm-30)*d)+.24*Math.cos(2*hm*d)+.32*Math.cos((3*hm+6)*d)-.2*Math.cos((4*hm-63)*d);
  const SL=1+.015*(Lm-50)**2/Math.sqrt(20+(Lm-50)**2),SC=1+.045*Cm,SH=1+.015*Cm*T,RT=-Math.sin(2*30*Math.exp(-(((hm-275)/25)**2))*d)*2*C7(Cm);
  const x=(L2-L1)/SL,y=(C2-C1)/SC,z=dH/SH;return Math.sqrt(x*x+y*y+z*z+RT*y*z)}
const RISK=[['--hic','uyarı'],['--ambc','dikkat'],['--yesil','yeşil'],['--bos','bilgi yok']];
// Belirteçler sayfanın hesaplanmış stilinden okunur (tema.css'te elle kopyalanmış değer değil): her biri bir öğenin zemini yapılıp rgb'si alınır
async function riskAyrimi(p,tema,ok){
  const renk=await p.evaluate(adlar=>adlar.map(v=>{const e=document.createElement('span');e.style.background='var('+v+')';document.body.appendChild(e);
    const m=getComputedStyle(e).backgroundColor.match(/[\d.]+/g).map(Number);e.remove();return m.slice(0,3)}),RISK.map(r=>r[0]));
  for(let i=0;i<RISK.length;i++)for(let j=i+1;j<RISK.length;j++){
    const a=renk[i],b=renk[j],k=oran(a,b),de=Object.values(MACHADO).map(m=>de2000(lab(benzet(a,m)),lab(benzet(b,m)))),dmin=Math.min(...de);
    ok(k>=1.5||dmin>=20,tema+': risk renkleri ayrışır '+RISK[i][1]+'/'+RISK[j][1]+' (parlaklık ≥1,5 ya da döteranopi ve protanopide ΔE2000 ≥20): '+
      k.toFixed(2)+':1, ΔE '+de.map(x=>x.toFixed(1)).join('/'));
  }
}
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
  await riskAyrimi(p,'koyu',ok);
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
  // Elle seçim (Profilim > Ayarlar > Görünüm): telefon koyuyken "Açık" seçilince açık zemin, seçim yeniden açılışta da geçerli
  const zemin=()=>p.evaluate(()=>[document.documentElement.dataset.tema,getComputedStyle(document.body).backgroundColor,document.querySelector('meta[name="theme-color"]').content]);
  await p.goto(B+'ocr.html#profil');await p.waitForSelector('#temasec');
  ok(await p.$eval('#temasec',s=>s.value)==='','görünüm: varsayılan telefona göre');
  await p.selectOption('#temasec','acik');
  let z=await zemin();ok(z[0]==='acik'&&z[1]==='rgb(255, 255, 255)'&&z[2]==='#2741c8','görünüm: telefon koyuyken Açık seçilince açık: '+z);
  await p.goto(B+'ansiklopedi.html');z=await zemin();ok(z[0]==='acik'&&z[1]==='rgb(255, 255, 255)','görünüm: seçim başka sayfada da geçerli: '+z);
  await p.goto(B+'ocr.html#profil');await p.waitForSelector('#temasec');await p.selectOption('#temasec','');
  z=await zemin();ok(z[0]==='koyu','görünüm: telefona göreye dönünce yeniden koyu: '+z);
  ok(!errs.length,'koyu tema: konsol hatası yok: '+errs.join(' | '));
  await ctx.close();
  // Telefon açıkken "Koyu" seçimi: koyu zemin, açılışta (betik çalışmadan önce değil, ilk çizimde) koyu
  const ctx2=await br.newContext({...opt,colorScheme:'light',reducedMotion:'reduce'}),errs2=[],p2=await newPage(ctx2);watch(p2,errs2);
  await p2.goto(B+'ocr.html');await p2.waitForFunction(ACILIS,null,{timeout:15000});
  ok(await p2.evaluate(()=>document.documentElement.dataset.tema)==='acik','görünüm: telefon açıkken telefona göre açık');
  await riskAyrimi(p2,'açık',ok);
  await p2.evaluate(()=>localStorage.setItem('tema','koyu'));
  await p2.goto(B+'ocr.html');await p2.waitForFunction(ACILIS,null,{timeout:15000});
  z=await p2.evaluate(()=>[document.documentElement.dataset.tema,getComputedStyle(document.body).backgroundColor,document.querySelector('meta[name="theme-color"][media*="light"]').content]);
  ok(z[0]==='koyu'&&z[1]==='rgb(15, 18, 17)'&&z[2]==='#0F1211','görünüm: telefon açıkken Koyu seçimi koyu: '+z);
  ok(!errs2.length,'görünüm: konsol hatası yok: '+errs2.join(' | '));
  await ctx2.close();
};
