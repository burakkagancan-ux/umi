// Arayüz testi, 7. grup: önyüz değerlendirmesinin dört önceliği (19.10.2026).
// a) Barkod alt sayfası hangi yoldan kapanırsa kapansın (×, arka plan, Esc, üstüne başka sayfa) kamera durur. Kamera, testte tuvalden üretilen sahte akışla taklit edilir.
// b) Sonuç kutusundaki başlıklar gri değil, yazı renginde (#sonuc boş-durum sınıfı .mut'u taşıyor).
// c) Uyarı ve dikkat şeridi dolguları (--hic, --ambc) açık ve koyu temada parlaklıkça ayrışır (en az 1,5:1); şeritler bu belirteçleri kullanır.
// d) Tesseract.js açılışta yüklenmez, dış adrese istek gitmez.
// Tek başına çalışmaz; test/arayuz.js bütün grupları kendi sunucularıyla paralel çalıştırır.
const {newPage,watch,sample,ACILIS}=require('./ortak.js');
module.exports=async({br,B,opt,ok})=>{
  let ctx=await br.newContext({...opt,reducedMotion:'reduce'}),errs=[],p=await newPage(ctx);watch(p,errs);
  // Sahte kamera: getUserMedia her çağrıda tuvalden yeni bir akış verir; son akış window.__akis'ta
  await ctx.addInitScript(()=>{
    if(!navigator.mediaDevices)return;
    navigator.mediaDevices.getUserMedia=async()=>{const c=document.createElement('canvas');c.width=320;c.height=240;c.getContext('2d').fillRect(0,0,10,10);
      window.__akis=c.captureStream(5);return window.__akis};
  });
  const disIstek=[];p.on('request',r=>{if(/jsdelivr|tesseract/i.test(r.url()))disIstek.push(r.url())});
  await p.goto(B+'ocr.html');await p.waitForFunction(ACILIS,null,{timeout:15000});

  // d) Tesseract açılışta yok
  ok(!await p.evaluate(()=>!!document.querySelector('script[src*="tesseract"]')||!!window.Tesseract),'açılışta Tesseract betiği yüklenmez');
  ok(!disIstek.length,'açılışta jsDelivr/Tesseract isteği yok: '+disIstek.join(' '));

  // a) Barkod kamerası her kapatma yolunda durur
  const kamera=()=>p.evaluate(()=>({canli:!!(window.__akis&&window.__akis.getTracks().some(t=>t.readyState==='live')),akis:BARKOD_AKIS!==null}));
  const ac=async()=>{await p.click('#barkodb');await p.waitForSelector('#sheet:not([hidden]) .belle input');
    await p.waitForFunction(()=>window.__akis&&BARKOD_AKIS===window.__akis,null,{timeout:5000})};
  for(const [ad,kapat] of [
    ['×',()=>p.click('#sheet-x')],
    ['arka plan',()=>p.evaluate(()=>document.getElementById('sheet-bg').click())],
    ['Esc',()=>p.keyboard.press('Escape')],
    ['üstüne başka alt sayfa',()=>p.evaluate(()=>openSheet('x',null,document.createElement('div')))],
  ]){
    await ac();
    ok((await kamera()).canli,ad+': açılınca kamera çalışıyor');
    await kapat();
    const k=await kamera();
    ok(!k.canli&&!k.akis,ad+' ile kapanınca kamera durur: '+JSON.stringify(k));
    if(!await p.isHidden('#sheet'))await p.click('#sheet-x');
  }
  // Kapatma yolu bir kez değiştirildikten sonra sıradan bir alt sayfa kapanışı barkodu yeniden durdurmaya çalışmaz (iç geri çağrı bir kez)
  ok(await p.evaluate(()=>SHEET_KAPAN===null),'kapanınca işlevi sayfa kapanınca temizlenir');

  // b) Sonuç başlıkları yazı renginde
  await sample(p,'gida');
  const renk=await p.evaluate(()=>{const ink=getComputedStyle(document.body).color,o=[];
    // Grup etiketi (h3.grp, küçük büyük harfli üst satır) bilerek gri: kendi kuralı var. Burada miras alan kart başlıkları ve kart metni denetlenir
    for(const s of ['#sonuc .res .t','#sonuc .res:not(.prof)']){const e=document.querySelector(s);if(e)o.push([s,getComputedStyle(e).color])}
    return {ink,o}});
  ok(renk.o.length&&renk.o.every(x=>x[1]===renk.ink),'sonuç başlıkları yazı renginde ('+renk.ink+'): '+JSON.stringify(renk.o));
  ok(!errs.length,'konsol hatası yok: '+errs.join(' | '));
  await ctx.close();

  // c) Şerit renkleri: açık ve koyu temada uyarı ile dikkat ayrışır, şeritler belirteçleri kullanır
  for(const tema of ['light','dark']){
    ctx=await br.newContext({...opt,colorScheme:tema,reducedMotion:'reduce'});p=await newPage(ctx);
    await p.goto(B+'ocr.html');await p.waitForFunction(ACILIS,null,{timeout:15000});await sample(p,'gida');
    const r=await p.evaluate(()=>{
      const hex=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      const lin=c=>{c/=255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4)};
      const L=h=>{const n=parseInt(h.slice(1),16);return .2126*lin(n>>16)+.7152*lin(n>>8&255)+.0722*lin(n&255)};
      const k=(a,b)=>{a=L(a);b=L(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      const h=document.createElement('span');h.style.background='var(--hic)';document.body.appendChild(h);const beklenen=getComputedStyle(h).backgroundColor;h.remove();
      const s=document.querySelector('#sonuc .oz-serit .r');
      return {ayrim:k(hex('--hic'),hex('--ambc')),serit:s?getComputedStyle(s).backgroundColor===beklenen:null};
    });
    ok(r.ayrim>=1.5,tema+': uyarı/dikkat şerit dolguları ayrışır (≥1,5:1): '+r.ayrim.toFixed(2));
    ok(r.serit!==false,tema+': özet şeridindeki uyarı parçası --hic kullanır');
    await ctx.close();
  }
};
