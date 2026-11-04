// Kabul testi: C-10 kısıtlı GS1 önekleri (kullanıcı onaylı iş). Bazı barkod önekleri bir ürünü tanımlamaz: mağaza içi /
// tartılı ürün (020–029, 040–049, 200–299, 0000000), yayın (977 ISSN, 978–979 ISBN/nota), ürün dışı (050–059 ayrılmış,
// 952 örnek, 980 iade fişi, 981–983 ve 99 kupon). Barkod 13 haneye tamamlanarak (12 haneli UPC-A'nın önüne 0) sınıflanır.
// Böyle bir barkod okutulunca/girilince uygulama:
//  - ürün veritabanında ARAMAZ, katkı ALMAZ, "aranıyor" listesine BİLDİRMEZ: Worker'a GET /off/…, GET /urun/…, POST /urun,
//    POST /besin, POST /aranan isteklerinden HİÇBİRİ gitmez (route ile sayılır: 0);
//  - açıklayıcı bir kart gösterir (başlıklar: "Mağaza İçi Barkod" / "Kitap ya da Dergi Barkodu" / "Ürün Barkodu Değil";
//    İngilizcede "In-Store Barcode" / "Book or Magazine Barcode" / "Not a Product Barcode"); kartın altında "Barkod: <kod>";
//  - mağaza kartında "İçerik listesini fotoğrafla" ve galeri ("Galeriden ya da dosyadan fotoğraf yükle") düğmeleri; bunlarla
//    verilen fotoğraf normal analiz edilir ama barkodla EŞLEŞMEZ: "Bu ürünün içeriğini başka kullanıcılar için kaydedelim mi?"
//    sorusu çıkmaz, POST /urun gitmez.
// Sınır ve gerileme denetimleri (bugün de yeşil olmalı): normal barkod (8690123456789, 8690000000012) eskisi gibi aranır
// (Worker'a /urun ya da /off isteği, "Bu ürün henüz veritabanında yok" kartı); 12 haneli 981123456786 → 0981… = 098 (GS1 US),
// kısıtlı DEĞİL, normal aranır; kontrol hanesi yanlış barkod "Geçersiz barkod: …" iletisini verir.
//
// Yollar: 1 elle numara girme (Etiket Oku > "Barkod okut" > "Barkod numarası" > "Ara"); 2 ters sıra (ana "Galeriden" ile
// içerik fotoğrafı, OCR yanıtı taklit; sonuçtaki "Barkodu okut ve eşleştir"); 3 mağaza kartının fotoğraf düğmeleri
// (filechooser); 4 yeniden yükleme (telefonun kamera açarken sekmeyi yeniden yüklemesi dahil); 5 Profilim › Topluluk (eksik
// ürünler listesi Worker'dan, GET /topluluk?tur=…, yanıtı {eksik:[{kod,…}]}: biçim 04.11.2026'da tarayıcıda kara kutu
// olarak denenip bulundu, kod okunmadı); 6 İngilizce arayüz (en-US bağlam).
// Metinler i18n/tr.json ve i18n/en.json'dan (barkod.*, foto.*); kısıtlı kart metinleri kullanıcının isteğinden (yeni anahtar).
const {ac,gorunur,yerlesince}=require('./_ortak.js');

const TR={
  dugme:'Barkod okut',elle:'Barkod numarası',ara:'Ara',
  yok:'Bu ürün henüz veritabanında yok',kartFoto:'İçerik listesini fotoğrafla',kartGaleri:'Galeriden ya da dosyadan fotoğraf yükle',
  anaGaleri:'Galeriden',soru:'Bu ürünün içeriğini başka kullanıcılar için kaydedelim mi?',eslestir:'Barkodu okut ve eşleştir',
  gecersiz:k=>'Geçersiz barkod: '+k+'. Numarayı kontrol edin.',kod:k=>new RegExp('^Barkod: 0?'+k.replace(/^0/,'')+'$'),
  eslesti:/barkoduyla eşleştirildi/,
  magaza:'Mağaza İçi Barkod',yayin:'Kitap ya da Dergi Barkodu',disi:'Ürün Barkodu Değil',
  magazaMetin:'Bu barkod mağazanın kendi tartı ya da raf etiketidir; her mağazada başka bir ürünü gösterebilir, ürünü tanımlamaz. İçeriği öğrenmek için ambalajdaki içerik listesini fotoğraflayın.',
  yayinMetin:'Bu barkod bir kitap, dergi ya da nota yayınını tanımlar (ISBN, ISSN); gıda, kozmetik ya da temizlik ürünü değildir.',
  disiMetin:'Bu barkod kupon, fiş ya da örnek için ayrılmış; bir ürünü tanımlamaz.',
};
const EN={
  dugme:'Scan barcode',elle:'Barcode number',ara:'Search',yok:'This product is not in the database yet',
  kod:k=>new RegExp('^Barcode: 0?'+k.replace(/^0/,'')+'$'),
  magaza:'In-Store Barcode',yayin:'Book or Magazine Barcode',disi:'Not a Product Barcode',
};
const BASLIKLAR=d=>[d.magaza,d.yayin,d.disi];

// Kısıtlı örnekler (kontrol haneleri doğru); sinif: beklenen kart
const KISITLI=[
  ['2012345001503','magaza'],['212345678909','magaza'],['0000000123457','magaza'],
  ['9780306406157','yayin'],['9771234567003','yayin'],
  ['9912345678909','disi'],['9801234567892','disi'],['9521234567899','disi'],['0501234567890','disi'],
];
const NORMAL=['8690123456789','8690000000012','981123456786'];   // son: 0981… = 098, GS1 US; kısıtlı değil
const GECERSIZ=['2012345001504','9780306406158'];                   // kontrol hanesi yanlış

// İçerik fotoğrafının okunan metni (OCR taklidi); sonuçta "E322 · Lesitinler" satırıyla tanınır
const METIN='İçindekiler: Buğday unu, şeker, palm yağı, tuz, E322.';
const SONUC=/E322 · Lesitinler/;
const png=()=>Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64');
const json=(q,o)=>q.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});

// Sayfayı açar; Worker'ı taklit eder ve ürün/katkı isteklerini sayar. r.yasak: kısıtlı barkodda hiç gitmemesi gereken
// istekler ("GET /urun/…" vb.); r.ocr: okuma isteği sayısı. Ürün sorgusu kesilir (veritabanında yok), OCR METIN'i verir.
async function sayfa(ctx,adres,eksik){
  const r=await ac(ctx,adres);
  r.yasak=[];r.ocr=0;
  await r.p.route(/inapp-ocr-[^/]*\.workers\.dev/,q=>{
    const rq=q.request(),m=rq.method(),yol=new URL(rq.url()).pathname,g=rq.postData()||'';
    if(m==='POST'&&/"image"/.test(g)){r.ocr++;return json(q,{text:METIN})}
    if((m==='GET'&&/^\/(off|urun)\//.test(yol))||(m==='POST'&&/^\/(urun|besin|aranan)\/?$/.test(yol)))r.yasak.push(m+' '+yol);
    if(m==='POST'&&/^\/(urun|besin|aranan)\/?$/.test(yol))return json(q,{ok:true});
    if(m==='GET'&&/^\/topluluk/.test(yol)&&eksik)return json(q,{eksik});
    return q.abort();
  });
  return r;
}
async function barkodAra(p,kod,d){
  d=d||TR;
  const dg=p.getByRole('button',{name:d.dugme});
  if(await gorunur(dg,3000))await dg.first().click();
  const el=p.getByLabel(d.elle);
  await el.first().fill(kod);
  await p.getByRole('button',{name:d.ara,exact:true}).click();
}
async function dosyaVer(p,loc){
  const fc=p.waitForEvent('filechooser',{timeout:5000});
  await loc.first().click();
  await (await fc).setFiles({name:'icerik.png',mimeType:'image/png',buffer:png()});
}
const govde=p=>yerlesince(()=>p.locator('body').innerText(),8000,400);
const say=r=>r.yasak.length?r.yasak.join(', '):'yok';

async function durum(br,B,opt,ok,ad,fn){
  const ctx=await br.newContext(opt);
  try{
    const r=await fn(ctx);
    if(r)ok(r.errs.length===0,ad+': sayfa hatası: '+r.errs.join(' | '));
  }catch(e){ok(false,ad+': durdu: '+e.message)}
  finally{await ctx.close()}
}
// Aynı anda en çok n durum (barkod_foto_eslesme yoğun koşuda zaman aşımına düşebiliyor)
async function sirayla(isler,n){const k=[...isler];await Promise.all(Array.from({length:n},async()=>{while(k.length)await k.shift()()}))}

// Kısıtlı kart ekranda mı: beklenen başlık, metin, "Barkod: <kod>"; yanlış sınıfın başlığı ve "bulunamadı" kartı yok
async function kartDenetle(ad,p,kod,sinif,ok,d){
  d=d||TR;
  ok(await gorunur(p.getByText(d[sinif],{exact:true}),8000),ad+': "'+d[sinif]+'" başlıklı kart çıkmadı');
  if(d===TR)ok(await gorunur(p.getByText(d[sinif+'Metin'],{exact:true}),1000),ad+': kart metni yok: "'+d[sinif+'Metin']+'"');
  ok(await gorunur(p.getByText(d.kod(kod)),1000),ad+': kartta barkod numarası ("'+d.kod(kod).source+'") görünmüyor');
  const t=await govde(p);
  for(const b of BASLIKLAR(d))if(b!==d[sinif])ok(!t.includes(b),ad+': yanlış sınıf, "'+b+'" görünüyor');
  ok(!t.includes(d.yok),ad+': "'+d.yok+'" (bulunamadı kartı) görünüyor; kısıtlı barkod ürün gibi arandı');
}

module.exports=async({br,B,opt,ok})=>{
  const isler=[];
  const ekle=(ad,fn)=>isler.push(()=>durum(br,B,opt,ok,ad,fn));

  // Yol 1: elle giriş; her kısıtlı örnek doğru kartı verir, Worker'a ürün/katkı/aranan isteği gitmez
  for(const [kod,sinif] of KISITLI)ekle('1 elle '+kod,async ctx=>{
    const ad='1 elle '+kod+' ('+sinif+')',r=await sayfa(ctx,B+'ocr.html'),{p}=r;
    await barkodAra(p,kod);
    await kartDenetle(ad,p,kod,sinif,ok);
    if(sinif==='magaza'){
      ok(await gorunur(p.getByRole('button',{name:TR.kartFoto}),1000),ad+': mağaza kartında "'+TR.kartFoto+'" düğmesi yok');
      ok(await gorunur(p.getByText(TR.kartGaleri,{exact:true}),1000),ad+': mağaza kartında "'+TR.kartGaleri+'" düğmesi yok');
    }
    ok(!r.yasak.length,ad+': Worker\'a ürün/katkı/aranan isteği gitti: '+say(r));
    return r;
  });

  // Yol 1, gerileme: normal barkod eskisi gibi aranır (098 sınırı dahil); kısıtlı kart çıkmaz
  for(const kod of NORMAL)ekle('1 normal '+kod,async ctx=>{
    const ad='1 normal '+kod,r=await sayfa(ctx,B+'ocr.html'),{p}=r;
    await barkodAra(p,kod);
    ok(await gorunur(p.getByText(TR.yok,{exact:true}),8000),ad+': "'+TR.yok+'" kartı çıkmadı (normal barkod aranmadı mı?)');
    ok(r.yasak.some(x=>/^GET \/(urun|off)\//.test(x)),ad+': Worker\'a /urun ya da /off isteği gitmedi (kısıtlama aşırı geniş): '+say(r));
    const t=await govde(p);
    for(const b of BASLIKLAR(TR))ok(!t.includes(b),ad+': normal barkodda "'+b+'" kartı görünüyor');
    return r;
  });

  // Yol 1, gerileme: kontrol hanesi yanlış → "Geçersiz barkod", kısıtlı kart değil, Worker'a istek yok
  for(const kod of GECERSIZ)ekle('1 geçersiz '+kod,async ctx=>{
    const ad='1 geçersiz '+kod,r=await sayfa(ctx,B+'ocr.html'),{p}=r;
    await barkodAra(p,kod);
    ok(await gorunur(p.getByText(TR.gecersiz(kod)),5000),ad+': "'+TR.gecersiz(kod)+'" iletisi çıkmadı');
    const t=await govde(p);
    for(const b of BASLIKLAR(TR))ok(!t.includes(b),ad+': geçersiz barkodda "'+b+'" kartı görünüyor');
    ok(!r.yasak.length,ad+': geçersiz barkodda Worker\'a istek gitti: '+say(r));
    return r;
  });

  // Yol 2: ters sıra. Önce içerik fotoğrafı (ana "Galeriden"), sonra "Barkodu okut ve eşleştir" ile barkod
  const tersSira=async(ctx,ad,kod)=>{
    const r=await sayfa(ctx,B+'ocr.html'),{p}=r;
    await dosyaVer(p,p.getByText(TR.anaGaleri,{exact:true}));
    ok(await gorunur(p.getByText(SONUC),10000),ad+': içerik fotoğrafının sonucu gelmedi (test önkoşulu)');
    const es=p.getByRole('button',{name:TR.eslestir});
    ok(await gorunur(es,5000),ad+': sonuçta "'+TR.eslestir+'" düğmesi yok (test önkoşulu)');
    await es.first().click();
    await barkodAra(p,kod);
    return r;
  };
  for(const [kod,sinif] of [['2012345001503','magaza'],['9780306406157','yayin'],['9912345678909','disi']])ekle('2 ters '+kod,async ctx=>{
    const ad='2 ters sıra '+kod+' ('+sinif+')',r=await tersSira(ctx,ad,kod),{p}=r;
    ok(await gorunur(p.getByText(TR[sinif],{exact:true}),8000),ad+': "'+TR[sinif]+'" kartı ya da açıklaması çıkmadı');
    ok(!await gorunur(p.getByText(TR.soru,{exact:true}),3000),ad+': içerik kısıtlı barkodla eşleşti, "'+TR.soru+'" sorusu çıktı');
    const t=await govde(p);
    ok(!TR.eslesti.test(t),ad+': "… barkoduyla eşleştirildi" yazısı görünüyor');
    ok(!r.yasak.some(x=>/^POST \/urun/.test(x)),ad+': Worker\'a POST /urun gitti');
    ok(!r.yasak.length,ad+': Worker\'a ürün/katkı/aranan isteği gitti: '+say(r));
    return r;
  });
  // Yol 2, gerileme: normal barkodla ters sıra bugünkü gibi eşleşir (soru çıkar) — yolun kendisinin çalıştığının kanıtı
  ekle('2 ters normal',async ctx=>{
    const kod='8690123456789',ad='2 ters sıra normal '+kod,r=await tersSira(ctx,ad,kod),{p}=r;
    ok(await gorunur(p.getByText(TR.soru,{exact:true}),10000),ad+': normal barkodla ters sırada "'+TR.soru+'" çıkmadı');
    return r;
  });

  // Yol 3: mağaza kartının kamera ve galeri düğmeleri → analiz çalışır, eşleşme/katkı sorusu yok, POST /urun yok
  for(const [hangi,bul] of [['kamera',p=>p.getByRole('button',{name:TR.kartFoto})],['galeri',p=>p.getByText(TR.kartGaleri,{exact:true})]])
    ekle('3 mağaza '+hangi,async ctx=>{
      const kod='2012345001503',ad='3 mağaza kartı '+hangi,r=await sayfa(ctx,B+'ocr.html'),{p}=r;
      await barkodAra(p,kod);
      ok(await gorunur(p.getByText(TR.magaza,{exact:true}),8000),ad+': "'+TR.magaza+'" kartı çıkmadı');
      if(!await gorunur(bul(p),2000)){ok(false,ad+': kartta '+hangi+' düğmesi yok');return r}
      await dosyaVer(p,bul(p));
      ok(await gorunur(p.getByText(SONUC),10000),ad+': fotoğraf analiz edilmedi (sonuç gelmedi)');
      ok(r.ocr>=1,ad+': Worker\'a okuma isteği gitmedi');
      ok(!await gorunur(p.getByText(TR.soru,{exact:true}),3000),ad+': "'+TR.soru+'" sorusu çıktı (içerik mağaza barkoduyla eşleşti)');
      ok(!TR.eslesti.test(await govde(p)),ad+': "… barkoduyla eşleştirildi" yazısı görünüyor');
      ok(!r.yasak.length,ad+': Worker\'a ürün/katkı/aranan isteği gitti: '+say(r));
      return r;
    });

  // Yol 4a: kısıtlı barkoddan sonra yeniden yükleme → bekleyen "bulunamadı / içerik listesini fotoğrafla" kartı gelmez;
  // ardından ana düğmeyle verilen fotoğraf da o barkoda bağlanmaz
  for(const kod of ['2012345001503','9780306406157'])ekle('4 yeniden '+kod,async ctx=>{
    const ad='4 yeniden yükleme '+kod,r=await sayfa(ctx,B+'ocr.html'),{p}=r;
    await barkodAra(p,kod);
    ok(await gorunur(p.getByText(new RegExp('^('+BASLIKLAR(TR).join('|')+')$')),8000),ad+': kısıtlı kart çıkmadı (önkoşul)');
    await p.reload();await p.waitForLoadState('networkidle');
    ok(!await gorunur(p.getByText(TR.yok,{exact:true}),2500),ad+': yeniden yüklemede "'+TR.yok+'" kartı geldi');
    ok(!await gorunur(p.getByRole('button',{name:TR.kartFoto}),500),ad+': yeniden yüklemede bekleyen barkodun "'+TR.kartFoto+'" kartı geldi');
    await dosyaVer(p,p.getByText(TR.anaGaleri,{exact:true}));
    ok(await gorunur(p.getByText(SONUC),10000),ad+': yeniden yüklemeden sonra fotoğrafın sonucu gelmedi');
    ok(!await gorunur(p.getByText(TR.soru,{exact:true}),3000),ad+': yeniden yüklemeden sonra "'+TR.soru+'" çıktı (eski kısıtlı barkoda bağlandı)');
    ok(!r.yasak.length,ad+': Worker\'a ürün/katkı/aranan isteği gitti: '+say(r));
    return r;
  });
  // Yol 4b: mağaza kartının kamerası açılırken sekme yeniden yüklenir (telefon) → fotoğraf yine eşleşmez
  ekle('4 kamera yeniden',async ctx=>{
    const kod='2012345001503',ad='4 kamera + yeniden yükleme',r=await sayfa(ctx,B+'ocr.html'),{p}=r;
    await barkodAra(p,kod);
    const kf=p.getByRole('button',{name:TR.kartFoto});
    if(!await gorunur(kf,8000)){ok(false,ad+': mağaza kartında "'+TR.kartFoto+'" yok (önkoşul)');return r}
    const fc=p.waitForEvent('filechooser',{timeout:5000});await kf.first().click();await fc;
    await p.reload();await p.waitForLoadState('networkidle');
    ok(!await gorunur(p.getByText(TR.yok,{exact:true}),2500),ad+': yeniden yüklemede "'+TR.yok+'" kartı geldi');
    await dosyaVer(p,await gorunur(kf,500)?kf:p.getByText(TR.anaGaleri,{exact:true}));
    ok(await gorunur(p.getByText(SONUC),10000),ad+': fotoğrafın sonucu gelmedi');
    ok(!await gorunur(p.getByText(TR.soru,{exact:true}),3000),ad+': "'+TR.soru+'" çıktı (mağaza barkoduyla eşleşti)');
    ok(!r.yasak.length,ad+': Worker\'a ürün/katkı/aranan isteği gitti: '+say(r));
    return r;
  });

  // Yol 5: Profilim › Topluluk; Worker'ın eksik ürünler listesinde kısıtlı barkod olsa da gösterilmez, normaller görünür
  ekle('5 topluluk',async ctx=>{
    const ad='5 topluluk';
    const it=kod=>({kod,tur:'gida',sayi:5,s:5,n:5,adet:5,son:Date.now()-86400000});
    const goster=['8690123456789','0981123456786'],gizle=['2012345001503','0212345678909','9780306406157','9771234567003','9912345678909','9801234567892'];
    const r=await sayfa(ctx,B+'ocr.html#profil',[...goster,...gizle].map(it)),{p}=r;
    const dg=p.getByRole('button',{name:/^Topluluk/});
    if(!await gorunur(dg,5000)){ok(false,ad+': Profilim\'de "Topluluk" düğmesi yok (önkoşul)');return r}
    await dg.first().click();
    ok(await gorunur(p.getByText(goster[0],{exact:true}),8000),ad+': normal barkod '+goster[0]+' listede görünmüyor (önkoşul: taklit yanıt okunmadı)');
    ok(await gorunur(p.getByText(goster[1],{exact:true}),1000),ad+': 098 önekli '+goster[1]+' (kısıtlı değil) listede görünmüyor');
    const t=await govde(p);
    for(const k of gizle)ok(!t.includes(k)&&!t.includes(k.replace(/^0/,'')),ad+': kısıtlı barkod '+k+' eksik ürünler listesinde görünüyor');
    return r;
  });

  // Yol 6: İngilizce arayüz (en-US): her sınıftan bir kart; normal barkod İngilizcede de aranır
  for(const [kod,sinif] of [['2012345001503','magaza'],['9780306406157','yayin'],['9801234567892','disi']])
    isler.push(()=>durum(br,B,{...opt,locale:'en-US'},ok,'6 EN '+kod,async ctx=>{
      const ad='6 EN '+kod+' ('+sinif+')',r=await sayfa(ctx,B+'ocr.html'),{p}=r;
      await barkodAra(p,kod,EN);
      await kartDenetle(ad,p,kod,sinif,ok,EN);
      ok(!r.yasak.length,ad+': Worker\'a ürün/katkı/aranan isteği gitti: '+say(r));
      return r;
    }));
  isler.push(()=>durum(br,B,{...opt,locale:'en-US'},ok,'6 EN normal',async ctx=>{
    const kod='8690123456789',ad='6 EN normal '+kod,r=await sayfa(ctx,B+'ocr.html'),{p}=r;
    await barkodAra(p,kod,EN);
    ok(await gorunur(p.getByText(EN.yok,{exact:true}),8000),ad+': "'+EN.yok+'" kartı çıkmadı');
    ok(r.yasak.some(x=>/^GET \/(urun|off)\//.test(x)),ad+': Worker\'a /urun ya da /off isteği gitmedi');
    return r;
  }));

  await sirayla(isler,4);
};
