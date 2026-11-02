// Kabul testi: barkodla ürün eklemeden sonra gösterişli teşekkür kartı.
// Kullanıcının isteği (değiştirmeden):
//  "umi için Barkod ile ürün eşleştirme sonrasında bir teşekkür mesajı çıkartıyoruz ama bu biraz daha gösterişli
//   kullanıcıyı mutlu eden bir görsel ile olabilir"
// Kullanıcı önizlemedeki "A · Kutlama" seçeneğini seçti: mavi madalyonda çizilen onay işareti + kısa konfeti, büyük
// "Teşekkürler!" başlığı, açıklama cümlesi, bu ayki katkı sayısını gösteren küçük etiket; kart sonucun üstünde satır
// içi durur, × ile kapanır.
//
// Kabul ölçütleri (Etiket Oku, ocr.html; bulunamayan barkod → içerik fotoğrafı → "Bu ürünün içeriğini başka
// kullanıcılar için kaydedelim mi?" → "Kaydet"):
//  1. "Kaydet"e basınca bir durum kartı görünür (role=status). İçinde başlık "Teşekkürler!" ve metin "İçerik barkodla
//     kaydedildi. Bu ürünü okutan bir sonraki kişi fotoğraf çekmeden sonucu görecek." İngilizce: "Thank you!" ve "The
//     ingredients were saved with the barcode. The next person who scans this product will see the result without
//     taking a photo." Kart sonucun ("Özet") üstünde durur.
//  2. Kartta bu ayki katkı etiketi: bu cihazdan bu ay ilk katkıysa "Bu ay eklediğiniz ilk ürün" (EN "Your first product
//     added this month"); aynı ay içinde farklı bir ikinci barkod kaydedilince "Bu ay eklediğiniz 2. ürün" (EN "You've
//     added 2 products this month"). Aynı barkod yeniden sayılmaz. (Türetilen: "bu ay" olduğu için yeni ayda sayım
//     yeniden "ilk"ten başlar; page.clock ile denetlenir.)
//  3. Kartta aria etiketi "Kapat" (EN "Close") olan bir düğme; basınca kart kaybolur ("Teşekkürler!" görünmez).
//  4. Besin tablosu da gönderildiyse metin "İçerik ve besin tablosu barkodla kaydedildi. Bu ürünü okutan bir sonraki
//     kişi fotoğraf çekmeden sonucu görecek." (EN "The ingredients and the nutrition table were saved with the barcode.
//     The next person who scans this product will see the result without taking a photo.")
//  5. Gıda modunda tablo gönderilmediyse kartın altında mevcut ipucu kalır: "İsterseniz aşağıdaki Besin değerleri
//     kartından tablonun fotoğrafını da ekleyin; o da bu barkoda eklenir (isteğe bağlı)."
//  6. Profilim'deki "Barkodlu Ürün Katkısı" tercihi "Sormadan kaydet" ise (soru sorulmadan kaydedilir) aynı kart çıkar
//     ve altında "Bu tercihi Profilim'den değiştirebilirsiniz." (EN "You can change this in My profile.") yazar.
//  7. "Hareketi azalt" (reducedMotion: 'reduce') açıkken kart ve başlık hemen görünür (bekleme yok): kart bölgesinin
//     hemen alınan ekran görüntüsü ile 1,5 sn sonrakinin aynı olması (hareket yok) ile ölçülür.
//  8. Değişmez: kartta "güvenli/uygun" (EN safe/suitable) geçmez; konsol/sayfa hatası yok.
//  9. "Kaydet" denmedikçe ("Hayır") kart çıkmaz.
//
// Kullanıcı yolu (uygulamada gözlendi, 01.11.2026): "Barkod okut" > "Barkod numarası" > "Ara" (Worker'ın ürün
// aramaları kapalı → bulunamadı) > "Galeriden ya da dosyadan fotoğraf yükle" (beyaz PNG) > Worker OCR taklidi metni
// döndürür > soru > "Kaydet" (POST …/urun taklidi {ok:true}). Okunan metinde besin tablosu varsa (Besin Değerleri
// (100 g başına) kartı dolar) tablo da gönderilir. "Sormadan kaydet" Profilim'deki "Barkodlu Ürün Katkısı" seçimidir.
const zlib=require('zlib');
const {ac,gorunur}=require('./_ortak.js');

const DIL={
  tr:{
    barkod:'Barkod okut',elle:'Barkod numarası',ara:'Ara',yukle:'Galeriden ya da dosyadan fotoğraf yükle',
    soru:'Bu ürünün içeriğini başka kullanıcılar için kaydedelim mi?',kaydet:'Kaydet',hayir:'Hayır',
    baslik:'Teşekkürler!',
    metin:'İçerik barkodla kaydedildi. Bu ürünü okutan bir sonraki kişi fotoğraf çekmeden sonucu görecek.',
    metinBesin:'İçerik ve besin tablosu barkodla kaydedildi. Bu ürünü okutan bir sonraki kişi fotoğraf çekmeden sonucu görecek.',
    ilk:'Bu ay eklediğiniz ilk ürün',iki:'Bu ay eklediğiniz 2. ürün',uc:/Bu ay eklediğiniz 3\. ürün/,
    kapat:'Kapat',ozet:'Özet',besinBaslik:/Besin Değerleri \(100 g başına\)/,
    ipucu:'İsterseniz aşağıdaki Besin değerleri kartından tablonun fotoğrafını da ekleyin; o da bu barkoda eklenir (isteğe bağlı).',
    tercih:'Bu tercihi Profilim\'den değiştirebilirsiniz.',
    yasak:/güvenli|uygun/i},
  en:{
    barkod:'Scan barcode',elle:'Barcode number',ara:'Search',yukle:'Upload a photo from gallery or file',
    soru:'Save this product\'s ingredients for other users?',kaydet:'Save',hayir:'No',
    baslik:'Thank you!',
    metin:'The ingredients were saved with the barcode. The next person who scans this product will see the result without taking a photo.',
    metinBesin:'The ingredients and the nutrition table were saved with the barcode. The next person who scans this product will see the result without taking a photo.',
    ilk:'Your first product added this month',iki:'You\'ve added 2 products this month',uc:/You've added 3 products this month/,
    kapat:'Close',ozet:'Summary',besinBaslik:/Nutrition \(per 100 g\)/,
    ipucu:'If you like, add a photo of the nutrition table from the Nutrition card below; it is added to this barcode too (optional).',
    tercih:'You can change this in My profile.',
    yasak:/\bsafe\b|suitable/i},
};

const EKIM='2026-10-15T10:00:00',KASIM='2026-11-12T10:00:00';
const ICERIK='İçindekiler: buğday unu, şeker, su.';
const BESINLI='İçindekiler: buğday unu, şeker, su.\nBesin değerleri 100 g için: Enerji 1500 kJ / 357 kcal; Yağ 10 g; Doymuş yağ 2 g; Karbonhidrat 60 g; Şekerler 20 g; Protein 8 g; Tuz 0,5 g';
// Geçerli EAN-13 (son hane denetim hanesi)
function ean(on2){
  const d=on2.split('').map(Number);
  const t=d.reduce((s,x,i)=>s+x*(i%2?3:1),0);
  return on2+((10-t%10)%10);
}
const KOD=['869123456789','869100000011','869100000022','869100000033','869100000044','869100000055','869100000066','869100000077'].map(ean);

const H={'access-control-allow-origin':'*'};
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:H,body:JSON.stringify(o)});
const tek=s=>String(s||'').replace(/\s+/g,' ').trim();

// Beyaz PNG (yalnızca dosya girdisi; okunan metni Worker taklidi verir)
function png(w,h){
  const T=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;T[n]=c>>>0}
  const crc=b=>{let c=0xffffffff;for(const x of b)c=T[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0};
  const parca=(tur,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(tur),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=0;
  const ham=Buffer.alloc((w+1)*h,255);for(let y=0;y<h;y++)ham[y*(w+1)]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),parca('IHDR',ih),parca('IDAT',zlib.deflateSync(ham)),parca('IEND',Buffer.alloc(0))]);
}

// Sayfayı (isteğe bağlı saatle) açar, Worker'ı taklit eder: OCR (image) → metin, ürün/besin kaydı (POST) → {ok:true}
async function sayfa(ctx,adres,metin,zaman){
  let r;
  if(zaman){
    // _ortak.ac ile aynı, saat ayarı goto'dan önce
    const p=await ctx.newPage(),errs=[];
    p.on('pageerror',e=>errs.push(e.message));
    p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))errs.push(m.text())});
    await p.clock.setSystemTime(new Date(zaman));
    await p.route('**/*',q=>/^http:\/\/localhost:/.test(q.request().url())?q.continue():q.abort());
    await p.goto(adres);
    await p.waitForLoadState('networkidle');
    r={p,errs};
  }else r=await ac(ctx,adres);
  r.kayit=[];
  await r.p.route(/inapp-ocr-[^/]*\.workers\.dev/,q=>{
    const rq=q.request();let g=null;
    if(rq.method()==='POST'){try{g=JSON.parse(rq.postData()||'')}catch(e){}}
    const u=rq.url().split('?')[0];
    if(g&&typeof g.image==='string')return json(q,{text:metin||ICERIK});
    if(rq.method()==='POST'&&/\/(urun|besin)(\/|$)/.test(u)){r.kayit.push(u);return json(q,{ok:true})}
    return q.abort();
  });
  return r;
}

// Bulunamayan barkod → fotoğraf → (soru). cevap: 'kaydet' | 'hayir' | null (sormadan kaydet: soru beklenmez)
// Döner: {p,errs,kayit,soru}
async function ekle(ctx,B,d,kod,o,ok,e){
  o=o||{};
  const r=await sayfa(ctx,B+'ocr.html',o.metin,o.zaman);
  const p=r.p;
  await p.getByRole('button',{name:d.barkod}).click();
  const kutu=p.getByLabel(d.elle);
  ok(await gorunur(kutu,3000),e+': "'+d.elle+'" kutusu görünmüyor');
  await kutu.first().fill(kod);
  await p.getByRole('button',{name:d.ara,exact:true}).click();
  const yukle=p.getByText(d.yukle);
  ok(await gorunur(yukle,8000),e+': bulunamayan barkodda "'+d.yukle+'" görünmüyor');
  const [fc]=await Promise.all([p.waitForEvent('filechooser'),yukle.first().click()]);
  await fc.setFiles({name:'etiket.png',mimeType:'image/png',buffer:png(600,400)});
  if(o.cevap){
    r.soru=await gorunur(p.getByText(d.soru),8000);
    ok(r.soru,e+': kaydetme sorusu ("'+d.soru+'") çıkmadı');
    if(o.besin)ok(await gorunur(p.getByText(d.besinBaslik),3000),e+' (kurulum): okunan metindeki besin tablosu ekranda değil');
    if(r.soru)await p.getByRole('button',{name:o.cevap==='kaydet'?d.kaydet:d.hayir,exact:true}).last().click();
  }
  return r;
}
const kartBul=(p,d)=>p.getByRole('status').filter({hasText:d.baslik});
async function kartMetni(p,d){
  const k=kartBul(p,d);
  return await k.count()?tek(await k.first().innerText()):'';
}

// Ölçüt 1, 3, 5, 8 ve etiket (ilk/2.) — kayıttan sonra kartı denetler; kapat=true ise × ile kapatır
async function kartDenetle(r,d,e,ok,b){
  const p=r.p,k=kartBul(p,d);
  const var_=await gorunur(k,5000);
  ok(var_,e+': "'+d.kaydet+'" sonrasında "'+d.baslik+'" içeren durum kartı (role=status) görünmüyor');
  ok(r.kayit.length>0,e+': Worker\'a kayıt (POST /urun) gitmedi');
  if(!var_)return '';
  ok(await gorunur(k.getByRole('heading',{name:d.baslik}),1000),e+': kartta "'+d.baslik+'" başlığı (heading) yok');
  const m=await kartMetni(p,d);
  const beklenen=b.besin?d.metinBesin:d.metin;
  ok(m.includes(beklenen),e+': kart metni "'+beklenen+'" değil: "'+m+'"');
  if(b.etiket)ok(m.includes(b.etiket),e+': kartta bu ayki katkı etiketi "'+b.etiket+'" yok: "'+m+'"');
  if(b.etiketDegil)ok(!m.includes(b.etiketDegil),e+': kartta yanlış etiket "'+b.etiketDegil+'" var');
  ok(!d.yasak.test(m),e+': kartta "güvenli/uygun" (safe/suitable) geçiyor: "'+m+'"');
  // Sonucun üstünde
  const kb=await k.first().boundingBox(),oz=p.getByText(d.ozet,{exact:true});
  const ob=await gorunur(oz,2000)?await oz.first().boundingBox():null;
  ok(kb&&ob&&kb.y<ob.y,e+': kart sonucun ("'+d.ozet+'") üstünde değil');
  // Ölçüt 5: tablo gönderilmediyse ipucu kartın altında
  if(b.ipucu){
    const ip=p.getByText(d.ipucu);
    ok(await gorunur(ip,2000),e+': tablo gönderilmediğinde "'+d.ipucu.slice(0,40)+'…" ipucu görünmüyor');
    const tb=await k.first().getByText(d.metin).boundingBox().catch(()=>null);
    const ib=await ip.count()?await ip.first().boundingBox():null;
    ok(tb&&ib&&ib.y>tb.y,e+': ipucu kart metninin altında değil');
  }
  if(b.besin)ok(!await gorunur(p.getByText(d.ipucu),500),e+': tablo gönderildiği hâlde "tablonun fotoğrafını da ekleyin" ipucu duruyor');
  if(b.tercih)ok(await gorunur(p.getByText(d.tercih),2000),e+': sormadan kayıtta "'+d.tercih+'" yazmıyor');
  // Ölçüt 3: × (aria "Kapat") kartı kapatır
  if(b.kapat){
    const x=k.getByRole('button',{name:d.kapat,exact:true});
    ok(await gorunur(x,1000),e+': kartta "'+d.kapat+'" etiketli düğme yok');
    if(await x.count()){
      await x.first().click();
      let gitti=false;
      for(let i=0;i<15&&!gitti;i++){gitti=!await p.getByText(d.baslik,{exact:true}).isVisible();if(!gitti)await p.waitForTimeout(200)}
      ok(gitti,e+': "'+d.kapat+'" düğmesine basınca kart kapanmadı ("'+d.baslik+'" hâlâ görünüyor)');
    }
  }
  ok(r.errs.length===0,e+': sayfa hatası: '+r.errs.join(' | '));
  return m;
}

async function dilSec(ctx,B,dil,ok){
  const {p}=await ac(ctx,B+'ocr.html#profil');
  const s=p.getByLabel(/Dil · Language/);
  ok(await gorunur(s,5000),'"Dil · Language" seçimi görünmüyor');
  await s.first().selectOption({label:dil});
  await p.waitForTimeout(1500);
  await p.close();
}

module.exports=async({br,B,opt,ok})=>{
  const T=DIL.tr,E=DIL.en;
  await Promise.all([
    // --- Türkçe: Hayır (kart yok), ilk ürün, aynı barkod yeniden, ikinci ürün, besin tablolu, yeni ay ---
    (async()=>{
      const ctx=await br.newContext(opt);
      try{
        // Ölçüt 9: Hayır → kart çıkmaz, kayıt gitmez
        {
          const r=await ekle(ctx,B,T,KOD[0],{cevap:'hayir',zaman:EKIM},ok,'TR Hayır');
          await r.p.waitForTimeout(1500);
          ok(!await gorunur(r.p.getByText(T.baslik,{exact:true}),500),'TR Hayır: "Hayır" sonrasında "'+T.baslik+'" kartı çıktı');
          ok(r.kayit.length===0,'TR Hayır: "Hayır" sonrasında Worker\'a kayıt gitti');
          ok(r.errs.length===0,'TR Hayır: sayfa hatası: '+r.errs.join(' | '));
          await r.p.close();
        }
        // Ölçüt 1, 2 (ilk), 3, 5, 8
        {
          const r=await ekle(ctx,B,T,KOD[1],{cevap:'kaydet',zaman:EKIM},ok,'TR ilk');
          await kartDenetle(r,T,'TR ilk',ok,{etiket:T.ilk,etiketDegil:T.iki,ipucu:true,kapat:true});
          await r.p.close();
        }
        // Ölçüt 2: aynı barkod yeniden sayılmaz (kart çıkarsa yine "ilk")
        {
          const r=await ekle(ctx,B,T,KOD[1],{zaman:EKIM},ok,'TR aynı barkod');
          const soru=await gorunur(r.p.getByText(T.soru),6000);
          if(soru){
            await r.p.getByRole('button',{name:T.kaydet,exact:true}).last().click();
            const k=kartBul(r.p,T);
            if(await gorunur(k,5000)){
              const m=await kartMetni(r.p,T);
              ok(!m.includes(T.iki),'TR aynı barkod: aynı barkod yeniden sayıldı (kartta "'+T.iki+'"): "'+m+'"');
            }
          }
          ok(r.errs.length===0,'TR aynı barkod: sayfa hatası: '+r.errs.join(' | '));
          await r.p.close();
        }
        // Ölçüt 2: farklı ikinci barkod → "2. ürün"
        {
          const r=await ekle(ctx,B,T,KOD[2],{cevap:'kaydet',zaman:EKIM},ok,'TR ikinci');
          const m=await kartDenetle(r,T,'TR ikinci',ok,{etiket:T.iki,etiketDegil:T.ilk,ipucu:true});
          ok(!T.uc.test(m),'TR ikinci: aynı barkod iki kez sayılmış ("3. ürün")');
          await r.p.close();
        }
        // Ölçüt 4: besin tablosu da gönderildi (3. ürün)
        {
          const r=await ekle(ctx,B,T,KOD[3],{cevap:'kaydet',zaman:EKIM,metin:BESINLI,besin:true},ok,'TR besinli');
          const m=await kartDenetle(r,T,'TR besinli',ok,{besin:true});
          ok(T.uc.test(m),'TR besinli: üçüncü farklı barkodda "Bu ay eklediğiniz 3. ürün" yok: "'+m+'"');
          await r.p.close();
        }
        // Ölçüt 2 (türetilen): yeni ayda sayım yeniden başlar
        {
          const r=await ekle(ctx,B,T,KOD[4],{cevap:'kaydet',zaman:KASIM},ok,'TR yeni ay');
          await kartDenetle(r,T,'TR yeni ay',ok,{etiket:T.ilk,etiketDegil:T.iki});
          await r.p.close();
        }
      }finally{await ctx.close()}
    })(),

    // --- Türkçe: Profilim'de "Sormadan kaydet" (ölçüt 6) ---
    (async()=>{
      const ctx=await br.newContext(opt);
      try{
        {
          const {p}=await ac(ctx,B+'ocr.html#profil');
          const s=p.getByLabel('Barkodlu Ürün Katkısı',{exact:true});
          ok(await gorunur(s,5000),'TR sormadan: Profilim\'de "Barkodlu Ürün Katkısı" seçimi yok');
          if(await s.count())await s.first().selectOption({label:'Sormadan kaydet'});
          await p.waitForTimeout(800);
          await p.close();
        }
        const r=await ekle(ctx,B,T,KOD[5],{},ok,'TR sormadan');
        await kartDenetle(r,T,'TR sormadan',ok,{etiket:T.ilk,tercih:true,ipucu:true,kapat:true});
        ok(!await r.p.getByText(T.soru).isVisible(),'TR sormadan: "Sormadan kaydet" seçiliyken soru soruldu');
        await r.p.close();
      }finally{await ctx.close()}
    })(),

    // --- Türkçe: hareketi azalt (ölçüt 7) ---
    (async()=>{
      const ctx=await br.newContext({...opt,reducedMotion:'reduce'});
      try{
        const r=await ekle(ctx,B,T,KOD[6],{cevap:'kaydet'},ok,'TR hareketi azalt');
        const k=kartBul(r.p,T);
        const bas=Date.now();
        const hemen=await gorunur(k.getByRole('heading',{name:T.baslik}),1500);
        ok(hemen,'TR hareketi azalt: "'+T.baslik+'" başlığı hemen (1,5 sn içinde) görünmedi');
        if(hemen){
          const kb=await k.first().boundingBox();
          if(kb){
            const clip={x:Math.max(0,kb.x),y:Math.max(0,kb.y),width:Math.min(kb.width,390-Math.max(0,kb.x)),height:Math.min(kb.height,600)};
            const a=await r.p.screenshot({clip});
            await r.p.waitForTimeout(1500);
            const b2=await r.p.screenshot({clip});
            ok(a.equals(b2),'TR hareketi azalt: kart görüntüsü ilk anda ve 1,5 sn sonra farklı (hareket/canlandırma sürüyor; başlık '+(Date.now()-bas)+' ms içinde)');
          }else ok(false,'TR hareketi azalt: kartın yeri ölçülemedi');
          ok((await kartMetni(r.p,T)).includes(T.metin),'TR hareketi azalt: kart metni görünmüyor');
        }
        ok(r.errs.length===0,'TR hareketi azalt: sayfa hatası: '+r.errs.join(' | '));
        await r.p.close();
      }finally{await ctx.close()}
    })(),

    // --- İngilizce: ilk, ikinci, besinli ---
    (async()=>{
      const ctx=await br.newContext(opt);
      try{
        await dilSec(ctx,B,'English',ok);
        {
          const r=await ekle(ctx,B,E,KOD[1],{cevap:'kaydet',zaman:EKIM},ok,'EN ilk');
          const m=await kartDenetle(r,E,'EN ilk',ok,{etiket:E.ilk,etiketDegil:E.iki,ipucu:true,kapat:true});
          ok(!/Teşekkür|kaydedildi|Bu ay/.test(m),'EN ilk: kartta Türkçe metin var: "'+m+'"');
          await r.p.close();
        }
        {
          const r=await ekle(ctx,B,E,KOD[2],{cevap:'kaydet',zaman:EKIM},ok,'EN ikinci');
          await kartDenetle(r,E,'EN ikinci',ok,{etiket:E.iki,etiketDegil:E.ilk});
          await r.p.close();
        }
        {
          const r=await ekle(ctx,B,E,KOD[7],{cevap:'kaydet',zaman:EKIM,metin:BESINLI,besin:true},ok,'EN besinli');
          await kartDenetle(r,E,'EN besinli',ok,{besin:true});
          await r.p.close();
        }
      }finally{await ctx.close()}
    })(),

    // --- İngilizce: sormadan kaydet ---
    (async()=>{
      const ctx=await br.newContext(opt);
      try{
        {
          const {p}=await ac(ctx,B+'ocr.html#profil');
          const s=p.getByLabel('Barkodlu Ürün Katkısı',{exact:true});
          if(await gorunur(s,5000))await s.first().selectOption({label:'Sormadan kaydet'});
          else ok(false,'EN sormadan (kurulum): "Barkodlu Ürün Katkısı" seçimi yok');
          await p.waitForTimeout(800);
          await p.close();
        }
        await dilSec(ctx,B,'English',ok);
        const r=await ekle(ctx,B,E,KOD[0],{},ok,'EN sormadan');
        await kartDenetle(r,E,'EN sormadan',ok,{etiket:E.ilk,tercih:true});
        await r.p.close();
      }finally{await ctx.close()}
    })(),
  ]);
};
