// Arayüz testi: sayfalar gerçek bir tarayıcıda (Chromium, telefon genişliği) açılır ve tıklanır.
// Gerekli: npm i --no-save playwright@1.47.2 && npx playwright install chromium. Çalıştır: node test/arayuz.js
// Denetlenen: konsol hatası yok; üç modda örnek analiz; üç modda karşılaştırma; ansiklopedi renkleri ve arama;
// İngilizce tur (dil seçimi, üç modda analiz, paylaşım kartı, karşılaştırma, çevrilmemiş veri işareti, sağdan sola kart çizimi);
// çevrimdışı açılış (service worker önbelleğinden kozmetik ve temizlik analizi).
// Tarayıcının dili: Türkçe bölümler tr-TR ile açılır (Playwright varsayılanı en-US; o zaman sayfa İngilizce açılırdı).
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const R=path.join(__dirname,'..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css',
  '.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const server=http.createServer((q,s)=>{
  let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  const f=path.join(R,p);
  if(!f.startsWith(R)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}
  s.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s);
});
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
// Dış adresler (Tesseract CDN, OCR Worker, sayaç) testte engellenir; onların yüklenememesi hata sayılmaz
const external=u=>!/^http:\/\/localhost:/.test(u);
function watch(page,errs){
  page.on('pageerror',e=>errs.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))errs.push(m.text())});
}
async function newPage(ctx){
  const p=await ctx.newPage();
  await p.route('**/*',r=>external(r.request().url())?r.abort():r.continue());
  return p;
}
// Service worker önbelleğinde bulunan dosyalar (verilen listeden)
async function onbellekte(p,list){
  return p.evaluate(async list=>{const out=[];for(const k of await caches.keys()){const c=await caches.open(k);for(const f of list)if(!out.includes(f)&&await c.match(f))out.push(f)}return out.sort()},list);
}
// Örnek metinle analiz: "Örnek metin dene" düğmesi
async function sample(p,mode){
  await p.click('#m-'+mode);
  await p.evaluate(()=>{HSCAN=true});
  await p.click('#ornek');
  await p.waitForFunction(()=>document.querySelectorAll('#sonuc .res').length>0,null,{timeout:15000});
}
async function scan(p,mode,text){
  await p.click('#m-'+mode);
  await p.evaluate(t=>{HSCAN=true;document.getElementById('metin').value=t;run()},text);
  await p.waitForFunction(()=>document.querySelectorAll('#sonuc .res').length>0,null,{timeout:15000});
}

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const B='http://localhost:'+server.address().port+'/';
  const br=await chromium.launch();
  const opt={viewport:{width:390,height:844},serviceWorkers:'block',locale:'tr-TR'};

  // 1) Ana sayfa ve Etiket Oku açılışı
  let ctx=await br.newContext(opt),errs=[],p=await newPage(ctx);watch(p,errs);
  await p.goto(B+'index.html');await p.waitForLoadState('networkidle');
  ok(!errs.length,'index.html konsol hatası: '+errs.join(' | '));errs.length=0;
  ok(await p.evaluate(()=>localStorage.getItem('veri_surum')===String(VERI_SURUM)),'açılışta cihaz verisi sürümü yazılır (O-06)');
  // Sürümsüz eski veri: bozuk kayıt açılıştan önce temizlenir, sayfa hatasız açılır
  await p.evaluate(()=>{localStorage.removeItem('veri_surum');localStorage.setItem('kayitli','{bozuk');localStorage.setItem('dil','tr')});
  await p.goto(B+'ocr.html');await p.waitForFunction(()=>typeof IDX!=='undefined'&&IDX,null,{timeout:15000});
  ok(await p.evaluate(()=>localStorage.getItem('kayitli')===null&&localStorage.getItem('dil')==='tr'&&localStorage.getItem('veri_surum')===String(VERI_SURUM)),'sürümsüz veri yükseltilir: bozuk kayıt silinir, ayar kalır');
  ok(!errs.length,'eski veriyle ocr.html konsol hatası: '+errs.join(' | '));errs.length=0;

  // 1b) Fotoğraf: kameranın yanında galeriden/dosyadan yükleme (capture olmayan ikinci girdi) kırpma ekranını açar
  ok(await p.isVisible('label.dosya')&&await p.getAttribute('#dosya','capture')===null&&await p.getAttribute('#foto','capture')==='environment','kamera ve dosya yükleme düğmeleri');
  await p.setInputFiles('#dosya',require('path').join(__dirname,'..','icon-192.png'));
  await p.waitForFunction(()=>getComputedStyle(document.getElementById('cropwrap')).display==='block',null,{timeout:5000});
  ok(await p.evaluate(()=>/^blob:/.test(document.getElementById('pre').src)),'dosyadan yüklenen fotoğraf kırpma ekranında');
  // Sekme değişince ve örnek metinde eski fotoğraf ekranda kalmaz
  const fotoYok=()=>p.evaluate(()=>getComputedStyle(document.getElementById('cropwrap')).display==='none'&&!document.getElementById('pre').hasAttribute('src'));
  await p.click('#m-koz');ok(await fotoYok(),'sekme değişince fotoğraf temizlenir');await p.click('#m-gida');
  await p.setInputFiles('#dosya',require('path').join(__dirname,'..','icon-192.png'));
  await p.waitForFunction(()=>getComputedStyle(document.getElementById('cropwrap')).display==='block',null,{timeout:5000});
  await p.click('#ornek');ok(await fotoYok(),'örnek metinde fotoğraf temizlenir');
  await p.setInputFiles('#dosya',require('path').join(__dirname,'..','icon-192.png'));
  await p.waitForFunction(()=>getComputedStyle(document.getElementById('cropwrap')).display==='block',null,{timeout:5000});
  await p.waitForSelector('#sonuc .resbar .kayitb');await p.click('#sonuc .resbar .kayitb');
  await p.waitForSelector('#sheet:not([hidden]) .kname input');await p.fill('#sheet .kname input','Foto deneme');
  await p.evaluate(()=>[...document.querySelectorAll('#sheet button')].find(b=>b.textContent===t('kayit.kaydet')).click());
  await p.waitForFunction(()=>getComputedStyle(document.getElementById('cropwrap')).display==='none',null,{timeout:5000}).catch(()=>{});
  ok(await fotoYok(),'kaydedince fotoğraf temizlenir');
  await p.evaluate(()=>{localStorage.removeItem('kayitli');kayitProfil()});
  // 1b2) Ayrı okuma düğmesi yok: fotoğraf seçilince kendiliğinden okunur; çerçeve değişince yeniden okunur ve aynı kayıt güncellenir
  {
  let istek=0;
  const ocr=await p.evaluate(()=>OCR_URL),ocrYol=u=>u.href.startsWith(ocr);
  await p.route(ocrYol,r=>{istek++;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:istek===1?'Şeker, E330, E621':'Şeker, E330'})})});
  ok(!(await p.$('#oku')),'Analiz Et düğmesi yok');
  await p.click('#m-gida');const n0=await p.evaluate(()=>histLoad().length);
  await p.setInputFiles('#dosya',require('path').join(__dirname,'..','icon-192.png'));
  await p.waitForFunction(()=>document.getElementById('metin').value==='Şeker, E330, E621'&&document.querySelectorAll('#sonuc .res').length>0,null,{timeout:8000}).catch(()=>{});
  ok(istek===1&&await p.inputValue('#metin')==='Şeker, E330, E621','fotoğraf seçilince kendiliğinden okunur ve analiz edilir');
  await p.click('#cropreset');
  await p.waitForFunction(()=>document.getElementById('metin').value==='Şeker, E330',null,{timeout:8000}).catch(()=>{});
  ok(istek===2&&await p.inputValue('#metin')==='Şeker, E330','çerçeve değişince yeniden okunur');
  ok(await p.evaluate(()=>histLoad().length)===n0+1,'yeniden okuma yeni kayıt açmaz');
  await p.unroute(ocrYol);
  await p.click('#ornek');
  }

  // 1c) Barkod: elle giriş (kamera testte yok) → uygulamadaki Open Food Facts verisinden içerik + kaynak kartı; geçersiz ve bulunamayan barkod
  {
    const D=JSON.parse(fs.readFileSync(path.join(R,'data','barkod_off.json'),'utf8')).u;
    const kod=Object.keys(D).find(k=>D[k][0]==='food'&&D[k][4].tr&&D[k][1]&&/^869\d{10}$/.test(k));
    const yok=['4006381333931','5000112637922','3017620422003'].find(k=>!D[k]&&!D['0'+k]);
    ok(kod&&yok,'barkod testi için veri: '+kod+' / '+yok);
    await p.evaluate(()=>localStorage.removeItem('rozetler'));   // önceki bölümlerde okunan fotoğraflar sayılmış olabilir
    await p.click('#barkodb');await p.waitForSelector('#sheet:not([hidden]) .belle input');
    await p.waitForFunction(()=>/Kamera açılamadı|Barkodu çerçevenin/.test(document.querySelector('#sheet .bsheet>.how').textContent),null,{timeout:8000});
    await p.fill('#sheet .belle input','8690504025208');await p.click('#sheet .belle button');
    ok(/Geçersiz barkod/.test(await p.textContent('#sheet .bsheet>.how'))&&!await p.isHidden('#sheet'),'geçersiz barkod reddedilir, alt sayfa açık kalır');
    await p.fill('#sheet .belle input',kod);await p.click('#sheet .belle button');
    await p.waitForSelector('#sonuc .bkaynak',{timeout:15000});
    const st=await p.evaluate(()=>({mod:MODE,metin:document.getElementById('metin').value,kart:document.querySelector('#sonuc .bkaynak').textContent,link:(document.querySelector('#sonuc .bkaynak a')||{}).href,gecmis:histLoad()[0]}));
    ok(st.mod==='gida'&&st.metin===D[kod][4].tr.trim(),'barkod: gıda modu ve Türkçe içerik kutuda');
    ok(/Open Food Facts/.test(st.kart)&&/etiket farklı olabilir/.test(st.kart)&&/fotoğrafıyla doğrula/.test(st.kart)&&/openfoodfacts\.org\/product\//.test(st.link),'kaynak kartı: atıf, "etiket asıl kaynak", doğrula düğmesi: '+st.kart.slice(0,160));
    ok(await p.isVisible('#sonuc .resbar')&&await p.evaluate(()=>document.querySelectorAll('#sonuc .res').length>1),'analiz sonucu kaynak kartının altında');
    ok(st.gecmis&&st.gecmis.text===st.metin&&!/^Tarama \d+$/.test(st.gecmis.name),'tarama geçmişinde ürün adıyla: '+(st.gecmis&&st.gecmis.name));
    ok(await p.isHidden('#sheet'),'alt sayfa kapandı');
    // Rozet (G-01): bulunan ilk barkod gıda Etiket Dedektifi'nin ilk kademesi; kutlama kartı sonucun üstünde, üstte küçük simge
    await p.waitForSelector('#sonuc .rozetkut',{timeout:5000}).catch(()=>{});
    ok(/Yeni rozet/.test(await p.textContent('#sonuc .rozetkut').catch(()=>''))&&/Gözlemci/.test(await p.textContent('#sonuc .rozetkut').catch(()=>'')),'ilk barkod: "Gözlemci" kutlama kartı');
    ok(await p.isVisible('#rozetsimge')&&/Gözlemci/.test(await p.getAttribute('#rozetsimge','aria-label')),'Etiket Oku üstünde gıda Etiket Dedektifi simgesi');
    await p.click('#m-koz');ok(await p.isHidden('#rozetsimge'),'kozmetikte rozet yok: simge gizli');await p.click('#m-gida');
    await p.click('#barkodb');await p.waitForSelector('#sheet:not([hidden]) .belle input');
    await p.fill('#sheet .belle input',yok);await p.click('#sheet .belle button');
    await p.waitForFunction(()=>/henüz veritabanında yok/.test((document.querySelector('#sonuc .bkaynak')||{}).textContent||''),null,{timeout:15000});
    ok(await p.evaluate(()=>document.getElementById('metin').value==='')&&await p.isVisible('#sonuc .bkaynak button'),'bulunamadı: kutu boş, "İçerik listesini fotoğrafla" düğmesi');
    ok(await p.evaluate(()=>{const s=document.querySelector('#profil .pbark select');return !!s&&s.value===''&&[...s.options].map(o=>o.value).join()===',evet,hayir'}),'Hassasiyetlerim: katkı tercihi, varsayılan "her seferinde sor"');
    // Bulunamayan ürünün etiketi okununca katkı önerisi; "Kaydet" yalnızca barkod, tür, dil ve içerik metnini gönderir
    let gonderilen=null;
    await p.route(/workers\.dev\/urun$/,r=>{gonderilen=r.request().postDataJSON();r.fulfill({status:201,contentType:'application/json',body:'{"tamam":true}'})});
    await p.evaluate(()=>{document.getElementById('metin').value=t('ornek.gida');HSCAN=HOCR=true;barkodFoto();run()});
    await p.waitForFunction(()=>/başka kullanıcılar için kaydedelim/.test(document.getElementById('sonuc').textContent),null,{timeout:10000});
    ok(!gonderilen,'izin verilmeden hiçbir şey gönderilmez');
    await p.click('#sonuc .bkaynak .row button:not(.alt)');
    await p.waitForFunction(()=>/Teşekkürler/.test(document.getElementById('sonuc').textContent),null,{timeout:5000});
    for(let i=0;i<20&&!gonderilen;i++)await p.waitForTimeout(100);
    ok(gonderilen&&Object.keys(gonderilen).sort().join()==='dil,kim,kod,metin,tur'&&gonderilen.kod===yok&&gonderilen.tur==='gida'&&gonderilen.dil==='tr','katkı: yalnızca kod, tür, dil, metin, katkıcı: '+JSON.stringify(gonderilen&&Object.keys(gonderilen)));
    ok(/^[0-9a-f]{32}$/.test(gonderilen&&gonderilen.kim)&&await p.evaluate(k=>localStorage.getItem('katkici')===k&&katkiciKimlik()===k,gonderilen&&gonderilen.kim),'katkıcı kimliği rastgele, bu cihazda saklanır ve sonraki katkıda aynı');
    ok(await p.evaluate(k=>JSON.parse(kayitYedek([],0,katkiciAl())).katkici===k,gonderilen&&gonderilen.kim),'katkıcı kimliği yedek dosyasına girer');
    ok(await p.evaluate(()=>localStorage.getItem('barkod_katki')===null),'"hatırla" seçilmedikçe tercih kaydedilmez');
    ok(/tablonun fotoğrafını da ekleyin/.test(await p.textContent('#sonuc')),'teşekkürden sonra tablo eklenebileceği söylenir');
    // Besin tablosu (A-02, isteğe bağlı): içerik kaydedildikten sonra tablonun fotoğrafı eklenince tablo da barkoda gider (POST /besin)
    const ICERIK='İçindekiler: şeker, buğday unu, bitkisel yağ (palm), kakao, yağsız süt tozu, emülgatör (soya lesitini), tuz, aroma verici.';
    await p.evaluate(([k,m])=>{barkodYok(k,null);document.getElementById('metin').value=m;HSCAN=HOCR=true;barkodFoto();run()},[yok,ICERIK]);
    await p.waitForFunction(()=>/başka kullanıcılar için kaydedelim/.test(document.getElementById('sonuc').textContent),null,{timeout:10000});
    gonderilen=null;await p.click('#sonuc .bkaynak .row button:not(.alt)');
    for(let i=0;i<20&&!gonderilen;i++)await p.waitForTimeout(100);
    const TAB='Besin değerleri 100 g\nEnerji 2151 kJ / 505 kcal\nYağ 25,1 g\nDoymuş yağ 16 g\nKarbonhidrat 68,8 g\nŞekerler 30,5 g\nProtein 3,2 g\nTuz 0,1 g';
    const ocr=await p.evaluate(()=>OCR_URL),ocrYol=u=>u.href.startsWith(ocr)&&!/\/(urun|besin|aranan)/.test(u.href);
    let besinG=[],urunN=1;
    await p.route(ocrYol,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:TAB})}));
    await p.route(/workers\.dev\/besin$/,r=>{besinG.push(r.request().postDataJSON());r.fulfill({status:201,contentType:'application/json',body:'{"tamam":true}'})});
    await p.unroute(/workers\.dev\/urun$/);await p.route(/workers\.dev\/urun$/,r=>{urunN++;r.fulfill({status:201,contentType:'application/json',body:'{"tamam":true}'})});
    const tabloEkle=async()=>{const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.evaluate(()=>[...document.querySelectorAll('#sonuc .besin button')].find(b=>b.textContent===t('besin.foto_ekle')).click())]);
      await fc.setFiles(path.join(R,'icon-192.png'));await p.waitForFunction(()=>document.querySelectorAll('#sonuc .besin .bdz').length===4,null,{timeout:8000}).catch(()=>{})};
    await tabloEkle();
    for(let i=0;i<20&&!besinG.length;i++)await p.waitForTimeout(100);
    const bg=besinG[0]||{};
    ok(besinG.length===1&&Object.keys(bg).sort().join()==='besin,kim,kod'&&bg.kod===yok&&bg.kim===gonderilen.kim&&bg.besin.birim==='g'&&bg.besin.b.yag===25.1&&bg.besin.b.tuz===0.1,'içerik kaydedilmişse tablo sormadan barkoda gider: '+JSON.stringify(besinG));
    ok(/Besin tablosu barkodla/.test(await p.textContent('#sonuc'))&&urunN===1,'tablo gitti notu; içerik yeniden gönderilmez');
    await p.evaluate(()=>run());await p.waitForTimeout(300);
    ok(besinG.length===1,'aynı tablo yeniden gönderilmez');
    // İçerik sorusu yanıtlanmadan tablo eklenirse soru yerinde kalır; "Kaydet" ikisini birden gönderir
    besinG=[];
    await p.evaluate(([k,m])=>{barkodYok(k,null);document.getElementById('metin').value=m;HSCAN=HOCR=true;barkodFoto();run()},[yok,ICERIK]);
    await p.waitForFunction(()=>/başka kullanıcılar için kaydedelim/.test(document.getElementById('sonuc').textContent),null,{timeout:10000});
    ok(/Besin tablosunun fotoğrafını da eklerseniz/.test(await p.textContent('#sonuc')),'içerik sorusu tablonun da gidebileceğini söyler');
    await tabloEkle();
    ok(/başka kullanıcılar için kaydedelim/.test(await p.textContent('#sonuc'))&&!besinG.length&&urunN===1,'tablo eklenince soru yerinde, izinsiz gönderim yok');
    await p.click('#sonuc .bkaynak .row button:not(.alt)');
    for(let i=0;i<20&&(!besinG.length||urunN<2);i++)await p.waitForTimeout(100);
    ok(urunN===2&&besinG.length===1&&/içerik ve besin tablosu/.test(await p.textContent('#sonuc')),'"Kaydet": içerik ve tablo birlikte gider');
    await p.unroute(ocrYol);await p.unroute(/workers\.dev\/besin$/);
    await p.evaluate(()=>fotoTemizle());
    await p.unroute(/workers\.dev\/urun$/);
    await p.evaluate(()=>{BARKOD=null;document.getElementById('metin').value='';document.getElementById('sonuc').textContent=''});
  }

  // 1d) Besin değeri tablosu (A-02): tablolu metinde dört satır renkli; tablosuzda "tablonun fotoğrafını ekle"; şüphede renk yok,
  // düzeltince renk; tablo fotoğrafı metnin sonuna eklenir ve aynı tarama güncellenir; elle düzeltme metne bağlı saklanır
  {
    const TABLO='İçindekiler: şeker, bitkisel yağ (palm), kakao, tuz.\nBesin değerleri 100 g\nEnerji 2151 kJ / 505 kcal\nYağ 25,1 g\nDoymuş yağ 16 g\nKarbonhidrat 68,8 g\nŞekerler 30,5 g\nProtein 3,2 g\nTuz 0,1 g';
    const kart=()=>p.evaluate(()=>{const d=document.querySelector('#sonuc .besin');return d?{t:d.querySelector('.t').textContent,dz:[...d.querySelectorAll('.bdz')].map(x=>x.className.split(' ')[1]),deg:[...d.querySelectorAll('.bdeg')].map(x=>x.textContent),metin:d.textContent,btn:[...d.querySelectorAll('button')].map(b=>b.textContent)}:null});
    await p.evaluate(()=>localStorage.removeItem('besin_elle'));
    await scan(p,'gida',TABLO);
    await p.waitForFunction(()=>document.querySelector('#sonuc .besin .btab'),null,{timeout:8000}).catch(()=>{});
    let k=await kart();
    ok(k&&k.t==='Besin değerleri (100 g başına)'&&k.dz.join()==='yuksek,yuksek,yuksek,dusuk'&&k.deg.slice(0,4).join('|')==='25,1 g|16 g|30,5 g|0,1 g'&&k.deg[4]==='505 kcal','besin kartı: dört satır, düzey etiketleri, enerji renksiz: '+JSON.stringify(k));
    ok(k&&/okunan etiket metnindeki tablo/.test(k.metin),'kaynak satırı');
    ok(await p.evaluate(()=>{const s=document.querySelector('#sonuc .sumbox');return s&&s.nextElementSibling&&s.nextElementSibling.classList.contains('besin')}),'kart özetin hemen altında');
    await p.click('#sonuc .besin .info');
    ok(/Birleşik Krallık Sağlık Bakanlığı/.test(await p.textContent('#sonuc .besin .ipanel'))&&/17,5 g/.test(await p.textContent('#sonuc .besin .ipanel'))&&await p.isVisible('#sonuc .besin .ipanel a'),'(i): eşikler ve kaynak bağlantısı');
    // Tablo yok
    await scan(p,'gida','Şeker, kakao yağı, süt tozu, E322');
    await p.waitForFunction(()=>document.querySelector('#sonuc .besin .t'),null,{timeout:8000}).catch(()=>{});
    k=await kart();
    ok(k&&!k.dz.length&&/besin değeri tablosu yok/.test(k.metin)&&k.btn.includes('Tablonun fotoğrafını çek'),'tablosuz metin: renk yok, fotoğraf ekle düğmesi: '+JSON.stringify(k&&k.btn));
    // Tablo yokken elle giriş (14.10.2026): boş form, birim seçilir, kaydedince renk ve "siz girdiniz"; metin değişmez
    {
      const m0=await p.inputValue('#metin');
      await p.evaluate(()=>[...document.querySelectorAll('#sonuc .besin button')].find(b=>b.textContent===t('besin.elle_gir')).click());
      await p.waitForSelector('#sheet:not([hidden]) .bform');
      ok(await p.inputValue('#sheet input[data-alan="yag"]')===''&&!(await p.evaluate(()=>[...document.querySelectorAll('#sheet .bform button')].some(b=>b.textContent===t('besin.form.geri')))),'elle giriş: form boş, "okunan değerlere dön" yok');
      await p.evaluate(()=>[...document.querySelectorAll('#sheet .brad button')].find(b=>b.textContent==='100 g').click());
      for(const [a,v] of [['yag','30'],['doymus','12'],['seker','40'],['tuz','0,2']])await p.fill('#sheet input[data-alan="'+a+'"]',v);
      await p.evaluate(()=>[...document.querySelectorAll('#sheet .bform button')].find(b=>b.textContent===t('besin.form.kaydet')).click());
      await p.waitForFunction(()=>document.getElementById('sheet').hidden,null,{timeout:3000}).catch(()=>{});
      k=await kart();
      ok(k&&k.dz.join()==='yuksek,yuksek,yuksek,dusuk'&&k.deg[0]==='30 g'&&/siz girdiniz/.test(k.metin)&&k.btn.includes('Tablonun fotoğrafını çek')&&await p.inputValue('#metin')===m0,'elle girilen tablo renkli, metin aynı, fotoğraf eklenebilir: '+JSON.stringify(k));
      await p.evaluate(()=>{localStorage.removeItem('besin_elle');run()});
      await p.waitForFunction(()=>/besin değeri tablosu yok/.test((document.querySelector('#sonuc .besin')||{}).textContent||''),null,{timeout:8000}).catch(()=>{});
    }
    // Tablo fotoğrafı: okunan metin sona eklenir, yeni tarama açılmaz
    {
      const ocr=await p.evaluate(()=>OCR_URL),ocrYol=u=>u.href.startsWith(ocr);
      await p.route(ocrYol,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:'Besin değerleri 100 g\nEnerji 2151 kJ / 505 kcal\nYağ 25,1 g\nDoymuş yağ 16 g\nKarbonhidrat 68,8 g\nŞekerler 30,5 g\nProtein 3,2 g\nTuz 0,1 g'})}));
      const n0=await p.evaluate(()=>histLoad().length);
      // Kaydedilmiş ürüne tablo eklenince kayıt yeni metne taşınır (ikinci kayıt açılmaz)
      await p.evaluate(()=>{localStorage.removeItem('kayitli');kayitStore(kayitAdd([],{id:'k1',t:Date.now(),mode:'gida',name:'Deneme',text:document.getElementById('metin').value,oz:null}))});
      const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.evaluate(()=>[...document.querySelectorAll('#sonuc .besin button')].find(b=>b.textContent===t('besin.foto_ekle')).click())]);
      await fc.setFiles(path.join(R,'icon-192.png'));
      await p.waitForFunction(()=>document.querySelectorAll('#sonuc .besin .bdz').length===4,null,{timeout:8000}).catch(()=>{});
      const m=await p.inputValue('#metin');
      ok(m.startsWith('Şeker, kakao yağı, süt tozu, E322\n\nBesin değerleri 100 g')&&(await kart()).dz.length===4,'tablo fotoğrafı metnin sonuna eklendi, kart renkli');
      ok(await p.evaluate(m=>{const a=kayitLoad();return a.length===1&&a[0].text===m.trim()&&a[0].besin&&a[0].besin.kaynak==='etiket'&&a[0].besin.b.yag===25.1&&!!a[0].oz},m)&&await p.evaluate(()=>/Kaydedildi/.test(document.querySelector('#sonuc .kayitb').textContent)),'kayıtlı ürün tabloyla güncellendi, "Kaydedildi" kalır');
      await p.evaluate(()=>localStorage.removeItem('kayitli'));
      ok(await p.evaluate(()=>histLoad().length)===n0&&await p.evaluate(m=>histLoad()[0].text===m.trim(),m),'aynı tarama güncellendi (yeni kayıt yok)');
      ok(await p.evaluate(()=>/E322/.test(document.getElementById('sonuc').textContent)),'içerik analizi sürüyor (E322)');
      // Tablo okunmuşken yeniden fotoğraf (14.10.2026): metne ikinci tablo eklenmez, yeni değerler formda onaya gelir
      k=await kart();
      ok(k.btn.includes('Tablonun fotoğrafını yeniden çek')&&!k.btn.includes('Tablonun fotoğrafını çek'),'okunmuş tabloda "yeniden çek" düğmesi: '+JSON.stringify(k.btn));
      await p.unroute(ocrYol);
      await p.route(ocrYol,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:'Besin değerleri 100 g\nEnerji 1500 kJ / 360 kcal\nYağ 3 g\nDoymuş yağ 1 g\nKarbonhidrat 70 g\nŞekerler 4 g\nProtein 9 g\nTuz 0,9 g'})}));
      const n1=await p.evaluate(()=>histLoad().length);
      const [fc2]=await Promise.all([p.waitForEvent('filechooser'),p.evaluate(()=>[...document.querySelectorAll('#sonuc .besin button')].find(b=>b.textContent===t('besin.foto_yeniden')).click())]);
      await fc2.setFiles(path.join(R,'icon-192.png'));
      await p.waitForSelector('#sheet:not([hidden]) .bform',{timeout:8000}).catch(()=>{});
      ok(await p.inputValue('#sheet input[data-alan="yag"]').catch(()=>'')==='3'&&await p.inputValue('#metin')===m&&(await kart()).deg[0]==='25,1 g','yeniden çekilen tablo formda, metin ve eski değerler kaydedilene kadar aynı');
      await p.evaluate(()=>[...document.querySelectorAll('#sheet .bform button')].find(b=>b.textContent===t('besin.form.kaydet')).click());
      await p.waitForFunction(()=>document.getElementById('sheet').hidden,null,{timeout:3000}).catch(()=>{});
      k=await kart();
      ok(k&&k.deg.slice(0,4).join('|')==='3 g|1 g|4 g|0,9 g'&&/siz girdiniz/.test(k.metin)&&await p.evaluate(()=>histLoad().length)===n1,'kaydedince yeni değerler, yeni tarama yok: '+JSON.stringify(k));
      await p.evaluate(()=>localStorage.removeItem('besin_elle'));
      await p.unroute(ocrYol);
      await p.evaluate(()=>fotoTemizle());
    }
    // Şüpheli: 100 g başlığı yok → renk yok; düzeltince renk ve "siz girdiniz"; aynı metin yeniden açılınca düzeltme geri gelir
    const SUPHE='Enerji 505 kcal\nYağ 25,1 g\nDoymuş yağ 16 g\nKarbonhidrat 68,8 g\nŞekerler 30,5 g\nProtein 3,2 g\nTuz 0,1 g';
    await p.evaluate(t=>{HSCAN=true;document.getElementById('metin').value=t;run()},SUPHE);
    await p.waitForFunction(()=>document.querySelector('#sonuc .besin .btab'),null,{timeout:8000}).catch(()=>{});
    k=await kart();
    ok(k&&/eşleşme|bulunamadı/i.test(await p.textContent('#sonuc')),'yalnızca tablo okunmuşsa: içerik bulunamadı notu + besin kartı');
    ok(k&&!k.dz.length&&/tutarlı görünmüyor/.test(k.metin)&&/100 g sütunu bulunamadı/.test(k.metin),'şüpheli tabloda renk yok, nedeni yazılı: '+JSON.stringify(k&&k.metin));
    await p.evaluate(()=>[...document.querySelectorAll('#sonuc .besin button')].find(b=>b.textContent===t('besin.duzelt')).click());
    await p.waitForSelector('#sheet:not([hidden]) .bform');
    ok(await p.inputValue('#sheet input[data-alan="yag"]')==='25,1'&&await p.inputValue('#sheet input[data-alan="kcal"]')==='505','form okunan değerlerle dolu');
    await p.evaluate(()=>[...document.querySelectorAll('#sheet .bform button')].find(b=>b.textContent===t('besin.form.kaydet')).click());
    ok(/100 g ya da 100 ml/.test(await p.textContent('#sheet .bform')),'birim seçilmeden kaydedilmez');
    await p.evaluate(()=>[...document.querySelectorAll('#sheet .brad button')].find(b=>b.textContent==='100 g').click());
    await p.fill('#sheet input[data-alan="tuz"]','abc');
    await p.evaluate(()=>[...document.querySelectorAll('#sheet .bform button')].find(b=>b.textContent===t('besin.form.kaydet')).click());
    ok(/Geçersiz değer: Tuz/.test(await p.textContent('#sheet .bform')),'geçersiz değer reddedilir');
    await p.fill('#sheet input[data-alan="tuz"]','<0,1');
    await p.evaluate(()=>[...document.querySelectorAll('#sheet .bform button')].find(b=>b.textContent===t('besin.form.kaydet')).click());
    await p.waitForFunction(()=>document.getElementById('sheet').hidden,null,{timeout:3000}).catch(()=>{});
    k=await kart();
    ok(k&&k.dz.join()==='yuksek,yuksek,yuksek,dusuk'&&k.deg[3]==='< 0,1 g'&&/siz girdiniz/.test(k.metin),'düzeltince renk, "<" değer: '+JSON.stringify(k));
    await scan(p,'gida','Su, tuz');await p.evaluate(t=>{HSCAN=true;document.getElementById('metin').value=t;run()},SUPHE);
    await p.waitForFunction(()=>document.querySelector('#sonuc .besin .btab'),null,{timeout:8000}).catch(()=>{});
    ok((await kart()).dz.length===4,'aynı metin yeniden açılınca düzeltme geri gelir');
    await p.evaluate(()=>[...document.querySelectorAll('#sonuc .besin button')].find(b=>b.textContent===t('besin.duzelt')).click());
    await p.waitForSelector('#sheet:not([hidden]) .bform');
    await p.evaluate(()=>[...document.querySelectorAll('#sheet .bform button')].find(b=>b.textContent===t('besin.form.geri')).click());
    k=await kart();
    ok(k&&!k.dz.length&&await p.evaluate(()=>JSON.parse(localStorage.getItem('besin_elle')).length===0),'"okunan değerlere dön" düzeltmeyi siler');
    // Kayıtlı ürün, karşılaştırma ve paylaşım kartı: barkoddan gelen OFF değerleri kayıtla saklanır; barkodsuz açılınca, yedekten
    // geri yüklenince ve karşılaştırmada tablo geri gelir; elle düzeltme kayda yazılır; paylaşım kartı modelinde dört satır
    {
      const kod='86920131';   // data/barkod_off.json: Eti Puf, tutarlı OFF besin değerleri
      await p.evaluate(()=>{localStorage.removeItem('besin_elle');localStorage.removeItem('kayitli')});
      await p.evaluate(k=>barkodIsle(k),kod);
      await p.waitForFunction(()=>document.querySelectorAll('#sonuc .besin .bdz').length===4,null,{timeout:15000}).catch(()=>{});
      const metin=await p.inputValue('#metin');
      ok(/Open Food Facts/.test((await kart()||{}).metin||''),'barkoddan OFF değerleri: '+JSON.stringify(await kart()));
      await p.click('#sonuc .resbar .kayitb');await p.waitForSelector('#sheet:not([hidden]) .kform input');
      await p.fill('#sheet .kform input','Puf');
      await p.evaluate(()=>[...document.querySelectorAll('#sheet .kform button')].find(b=>b.textContent===t('kayit.kaydet')).click());
      const kb=await p.evaluate(()=>kayitLoad()[0].besin);
      ok(kb&&kb.kaynak==='off'&&kb.b.yag===8.9&&kb.birim==='g','kayıtta OFF tablosu kaynağıyla: '+JSON.stringify(kb));
      // Barkodsuz açılış (BARKOD yok): tablo kayıttan
      await p.evaluate(()=>{BARKOD=null;kayitSonuc(kayitLoad()[0])});
      await p.waitForFunction(()=>document.querySelectorAll('#sonuc .besin .bdz').length===4,null,{timeout:8000}).catch(()=>{});
      k=await kart();ok(k&&k.dz.join()==='orta,yuksek,yuksek,dusuk'&&/Open Food Facts/.test(k.metin),'kayıt barkodsuz açılınca tablo ve kaynağı geri gelir: '+JSON.stringify(k));
      // Paylaşım kartı modeli
      const pb=await p.evaluate(()=>{const s=paySource();return s.besin&&s.besin.satir.map(x=>x.alan+':'+x.duzey).join()});
      ok(pb==='yag:orta,doymus:yuksek,seker:yuksek,tuz:dusuk','paylaşım kartında besin satırları: '+pb);
      // Yedek → başka cihaz (kayıt yok) → geri yükle
      await p.evaluate(()=>{const y=kayitYedek(kayitLoad(),0);localStorage.removeItem('kayitli');const r=kayitGeriYukle([],y);kayitStore(r.list);BARKOD=null;kayitSonuc(kayitLoad()[0])});
      await p.waitForFunction(()=>document.querySelectorAll('#sonuc .besin .bdz').length===4,null,{timeout:8000}).catch(()=>{});
      ok((await kart()).dz.length===4,'yedekten geri yüklenen kayıtta tablo');
      // Elle düzeltme kayda yazılır; düzeltme bu cihazdan silinse de (başka cihaz) kayıttaki elle değer önce gelir
      await p.evaluate(()=>[...document.querySelectorAll('#sonuc .besin button')].find(b=>b.textContent===t('besin.duzelt')).click());
      await p.waitForSelector('#sheet:not([hidden]) .bform');
      await p.fill('#sheet input[data-alan="seker"]','4');
      await p.evaluate(()=>[...document.querySelectorAll('#sheet .bform button')].find(b=>b.textContent===t('besin.form.kaydet')).click());
      await p.waitForFunction(()=>document.getElementById('sheet').hidden,null,{timeout:3000}).catch(()=>{});
      ok(await p.evaluate(()=>{const b=kayitLoad()[0].besin;return b.kaynak==='elle'&&b.b.seker===4&&b.onay===true}),'elle düzeltme kayda yazıldı');
      await p.evaluate(()=>{localStorage.removeItem('besin_elle');BARKOD=null;kayitSonuc(kayitLoad()[0])});
      await p.waitForFunction(()=>document.querySelectorAll('#sonuc .besin .bdz').length===4,null,{timeout:8000}).catch(()=>{});
      k=await kart();ok(k&&k.dz[2]==='dusuk'&&/siz girdiniz/.test(k.metin),'kayıttaki elle değer başka cihazda da: '+JSON.stringify(k));
      // Karşılaştırma: tablolu ve tablosuz iki kayıtlı gıda
      await p.evaluate(()=>{localStorage.setItem('kayitli',JSON.stringify(kayitAdd(kayitLoad(),{id:'k2',t:Date.now()+1,mode:'gida',name:'Kraker',text:'Buğday unu, tuz, maya'})))});
      await p.evaluate(()=>showCompare(kayitLoad()[1].id,'k2'));
      await p.waitForSelector('#kars:not([hidden]) .ktab');
      const kr=await p.evaluate(()=>{const c=[...document.querySelectorAll('#kars .ktab > div')].map(x=>x.textContent);const i=c.indexOf(t('besin.baslik'));return {bas:c.slice(i,i+3),yag:c.slice(c.indexOf(t('besin.alan.yag')),c.indexOf(t('besin.alan.yag'))+3),dz:document.querySelectorAll('#kars .ktab .bdz').length}});
      ok(kr.bas.join('|')==='Besin değerleri|100 g|Tablo yok'&&kr.yag.join('|')==='Yağ|8,9 g Orta|—'&&kr.dz===4,'karşılaştırmada besin satırları: '+JSON.stringify(kr));
      await p.evaluate(()=>closeCompare());
      await p.evaluate(()=>localStorage.removeItem('kayitli'));
    }
    // Kozmetikte kart yok
    await sample(p,'koz');ok(!await p.$('#sonuc .besin'),'kozmetikte besin kartı yok');
    await p.click('#m-gida');
  }

  // 2) Üç modda örnek analiz
  for(const m of ['gida','koz','tem']){
    await sample(p,m);
    ok(await p.$$eval('#sonuc .res',e=>e.length)>2,m+': sonuç kartları');
    ok(await p.isVisible('#sonuc .resbar .pay'),m+': paylaş düğmesi');
  }
  ok(!errs.length,'örnek analiz konsol hatası: '+errs.join(' | '));errs.length=0;

  // 3) Üç modda karşılaştırma: iki tarama, seçim, karar kartı, satırlar, madde alt sayfası
  const pairs={
    gida:['İçindekiler: Şeker, kakao, E322.','İçindekiler: Şeker, kakao, E250.','A'],
    koz:['Ingredients: Aqua, Glycerin, Parfum, Linalool, Phenoxyethanol.','Ingredients: Aqua, Glycerin, Butylphenyl Methylpropional, Phenoxyethanol.','A'],
    tem:['İçindekiler: %5-15 anyonik yüzey aktif maddeler, parfüm. DİKKAT. Cilt tahrişine yol açar.','İçindekiler: %5-15 anyonik yüzey aktif maddeler. TEHLİKE. Ciddi göz hasarına yol açar.','A']};
  for(const m of Object.keys(pairs)){
    // Mod değişince kutudaki metin o modda yeniden analiz edilir; temiz başlangıç için kutu ve geçmiş boşaltılır
    await p.evaluate(()=>{document.getElementById('metin').value='';localStorage.removeItem('taramalar')});
    await scan(p,m,pairs[m][0]);await scan(p,m,pairs[m][1]);
    ok(await p.isVisible('#karsla'),m+': Karşılaştır düğmesi görünür');
    await p.click('#karsla');
    const items=await p.$$('#sheet .kpick button.kitem');
    ok(items.length===2,m+': seçim listesinde yalnızca bu türün 2 taraması var ('+items.length+')');
    for(const it of items)if(await it.getAttribute('aria-pressed')!=='true')await it.click();
    await p.click('#sheet .kpick button:not(.kitem):not(.kclr)');
    await p.waitForSelector('#kars:not([hidden]) .kdec');
    const first=(await p.$$eval('#kars .kn',e=>e.map(x=>x.value)))[0];
    ok((await p.textContent('#kars .kdec .t')).indexOf(first+' içerik açısından daha iyi')===0,m+': ilk (risksiz) ürün öne çıkar');
    ok(await p.$$eval('#kars .ktab .kl',e=>e.length)>=7,m+': satır tablosu');
    ok(!(await p.$$eval('#kars .kcnt .ic.g',e=>e.length)),m+': "özel uyarı yok" sayısı yeşil onay değil, gri tire');
    if(m!=='gida')ok(!(await p.$$eval('#kars .ic.g',e=>e.length)),m+': kozmetik/temizlikte yeşil onay yok (üretim yolu bilgisi yok)');
    await p.click('#kars details.kgrp summary');
    await p.click('#kars details.kgrp[open] button.kmad');
    ok(await p.isVisible('#sheet .sheet-pn'),m+': maddeye dokununca alt sayfa açılır');
    await p.evaluate(()=>{closeSheet();closeCompare()});
  }
  // Tür ayrımı: sekmeyle geçişte tarama kendi türünde kalır; öneri kartıyla geçişte yeni türe taşınır; yeni türde yazılan metin o türe kaydedilir
  const hist=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('taramalar')||'[]').map(x=>x.mode));
  await p.click('#m-gida');await p.evaluate(()=>{document.getElementById('metin').value='';localStorage.removeItem('taramalar')});
  await scan(p,'gida',pairs.gida[0]);
  await p.click('#m-tem');await p.waitForTimeout(800);await p.click('#m-koz');await p.waitForTimeout(800);
  ok(JSON.stringify(await hist())==='["gida"]','sekmeyle geçiş geçmişe yazılmaz: '+JSON.stringify(await hist()));
  await p.fill('#metin',pairs.koz[0]).catch(()=>p.evaluate(t=>{const m=document.getElementById('metin');m.value=t;m.dispatchEvent(new Event('input'))},pairs.koz[0]));
  await p.waitForTimeout(1200);
  ok(JSON.stringify((await hist()).sort())==='["gida","koz"]','yeni türde yazılan metin o türe kaydedilir: '+JSON.stringify(await hist()));
  await p.evaluate(()=>{document.getElementById('metin').value='';localStorage.removeItem('taramalar')});
  await scan(p,'gida',pairs.tem[1]);
  ok(await p.isVisible('#sonuc .suggest button'),'temizlik metninde öneri kartı');
  await p.click('#sonuc .suggest button');await p.waitForTimeout(1500);
  ok(JSON.stringify(await hist())==='["tem"]','öneri kartıyla tarama temizliğe taşınır: '+JSON.stringify(await hist()));
  await p.click('#m-gida');await p.evaluate(()=>{document.getElementById('metin').value='';localStorage.removeItem('taramalar')});await p.click('#karsla');
  ok(/en az iki gıda ürünü/.test(await p.textContent('#st')),'tek tarama yokken uyarı');
  ok(!errs.length,'karşılaştırma konsol hatası: '+errs.join(' | '));errs.length=0;

  // 3b) Kaydedilen ürünler: kaydet (ad + not), Kaydedildi durumu, profilde liste, tür süzgeci, arama, açma, karşılaştırma, düzenleme, silme, yedek
  await p.evaluate(()=>{localStorage.removeItem('kayitli');localStorage.removeItem('taramalar');localStorage.removeItem('kayit_suz');document.getElementById('metin').value=''});
  p.on('dialog',d=>d.accept());
  async function kaydet(mode,text,name,note){
    await scan(p,mode,text);
    ok(/Kaydet$/.test((await p.textContent('#sonuc .resbar .kayitb')).trim()),mode+': Kaydet düğmesi');
    await p.click('#sonuc .resbar .kayitb');
    await p.fill('#sheet .kform input',name);if(note)await p.fill('#sheet .kform textarea',note);
    await p.click('#sheet .kform button:not(.alt)');
    ok(/Kaydedildi/.test(await p.textContent('#sonuc .resbar .kayitb')),mode+': kaydedildi durumu');
  }
  await kaydet('gida',pairs.gida[0],'Gofret A','Market');
  await kaydet('gida',pairs.gida[1],'Salam B');
  await kaydet('koz',pairs.koz[0],'Şampuan C','Kızım için');
  await kaydet('tem',pairs.tem[1],'Deterjan D');
  // boş ad reddedilir
  await scan(p,'tem',pairs.tem[0]);await p.click('#sonuc .resbar .kayitb');await p.fill('#sheet .kform input','');await p.click('#sheet .kform button:not(.alt)');
  ok(/ad verin/.test(await p.textContent('#sheet .kform')),'boş ad reddedilir');await p.evaluate(()=>closeSheet());
  // paylaşım kartı kayıtlı adı kullanır
  await scan(p,'koz',pairs.koz[0]);ok(await p.evaluate(()=>payName().name)==='Şampuan C','paylaşım kartında kayıtlı ad');
  // Profil > Kaydedilen Ürünlerim
  await p.goto(B+'ocr.html#profil');await p.waitForSelector('#kayitbar .kayitac');
  ok(/4 ürün/.test(await p.textContent('#kayitbar')),'profilde kayıt sayısı: '+(await p.textContent('#kayitbar')));
  await p.click('#kayitbar .kayitac');await p.waitForSelector('#kayit:not([hidden]) .kkayit');
  ok(await p.$$eval('#kayit .kkayit',e=>e.length)===4,'liste 4 kayıt');
  ok(/Tümü \(4\).*Gıda \(2\).*Kozmetik \(1\).*Temizlik \(1\)/.test(await p.textContent('#kayit .kseg')),'süzgeç sayıları');
  await p.click('#kayit .kseg button[data-m="gida"]');ok((await p.$$eval('#kayit .kkayit .kin',e=>e.map(x=>x.textContent))).sort().join()==='Gofret A,Salam B','gıda süzgeci');
  await p.click('#kayit .kseg button[data-m=""]');await p.fill('#kara','KIZIM');ok(await p.$$eval('#kayit .kkayit',e=>e.length)===1,'notta arama');
  await p.fill('#kara','');await p.selectOption('#ksira','risk');ok((await p.textContent('#kayit .kkayit .kin'))!=='Gofret A','önce uyarılı sıralama');
  ok(/uyarı|dikkat|Özel uyarı yok/.test(await p.textContent('#kayit .kkayit .koz')),'satırda özet');
  // Aç: sonuç ekranı, geçmişe yazılmaz
  const hl=await p.evaluate(()=>JSON.parse(localStorage.getItem('taramalar')||'[]').length);
  await p.click('#kayit .kseg button[data-m="koz"]');await p.click('#kayit .kkayit');await p.click('#sheet .kpick button:not(.alt)');
  await p.waitForFunction(()=>document.querySelectorAll('#sonuc .res').length>0&&!document.body.classList.contains('mode-profil')&&MODE==='koz');
  ok(/Kaydedildi/.test(await p.textContent('#sonuc .resbar .kayitb')),'açılan kayıt sonuç ekranında, kaydedildi durumunda');
  ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('taramalar')||'[]').length)===hl,'açmak geçmişe yazmaz');
  // Değerlendirme değişti bildirimi: kayıttaki özet bilerek bozulur, açınca kart çıkar ve özet düzelir
  await p.evaluate(()=>{const a=JSON.parse(localStorage.getItem('kayitli'));a.forEach(x=>{if(x.name==='Gofret A')x.oz={u:5,d:0,top:[]}});localStorage.setItem('kayitli',JSON.stringify(a))});
  await p.evaluate(()=>kayitSonuc(kayitLoad().filter(x=>x.name==='Gofret A')[0]));await p.waitForTimeout(500);
  ok(/değerlendirme değişti/.test(await p.textContent('#sonuc')),'değerlendirme değişti kartı');
  ok(await p.evaluate(()=>kayitLoad().filter(x=>x.name==='Gofret A')[0].oz.u)===0,'özet güncellendi');
  // Karşılaştırma: iki kayıtlı gıda
  await p.evaluate(()=>{kayitAc()});await p.click('#kayit .kseg button[data-m="gida"]');
  await p.click('#kayit .kkayit');await p.click('#sheet .kpick button:has-text("karşılaştır")');await p.click('#sheet .kpick button.kitem');
  await p.waitForSelector('#kars:not([hidden]) .kdec');
  ok((await p.$$eval('#kars .kn',e=>e.map(x=>x.value))).sort().join()==='Gofret A,Salam B','kayıtlı ürünler karşılaştırıldı');
  await p.evaluate(()=>closeCompare());
  // Karşılaştır düğmesinin listesinde kayıtlılar "Kayıtlı" etiketiyle
  await p.evaluate(()=>{localStorage.removeItem('taramalar');HCUR=null});await p.click('#m-gida');await p.click('#karsla');
  ok(await p.$$eval('#sheet .kpick .kitem .chip',e=>e.filter(x=>x.textContent==='Kayıtlı').length)===2,'Karşılaştır listesinde kayıtlılar');await p.evaluate(()=>closeSheet());
  // Düzenle ve sil
  await p.evaluate(()=>kayitAc());await p.click('#kayit .kseg button[data-m="tem"]');await p.click('#kayit .kkayit');
  await p.click('#sheet .kpick button:has-text("düzenle")');await p.waitForSelector('#sheet .kform');
  await p.fill('#sheet .kform input','Deterjan E');await p.click('#sheet .kform button:not(.alt)');
  ok(await p.evaluate(()=>kayitLoad().some(x=>x.name==='Deterjan E')&&kayitLoad().length===4),'yeniden adlandırma, kayıt sayısı aynı');
  const yedek=await p.evaluate(()=>kayitYedek(kayitLoad()));
  await p.evaluate(()=>kayitAc());await p.click('#kayit .kseg button[data-m="tem"]');await p.click('#kayit .kkayit');await p.click('#sheet .kpick button.kclr');
  ok(await p.evaluate(()=>kayitLoad().length)===3,'silme');
  // Yedekten geri yükleme (dosya seçimi)
  await p.setInputFiles('#kyedekdosya',{name:'y.json',mimeType:'application/json',buffer:Buffer.from(yedek)});await p.waitForTimeout(400);
  ok(await p.evaluate(()=>kayitLoad().length)===4&&/1 ürün eklendi/.test(await p.textContent('#kayit .kyedek')),'yedekten geri yükleme: '+(await p.textContent('#kayit .kyedek')).slice(-60));
  await p.evaluate(()=>kayitKapat());
  ok(!errs.length,'kayıt konsol hatası: '+errs.join(' | '));errs.length=0;

  // 4) Ansiklopedi: renk kuralı (yeşil yalnızca doğal üretimde), arama
  for(const [id,cls] of [['E322','green'],['E162','green'],['E330','green n'],['E250','red'],['E553b','red'],['E211','amber']]){
    await p.goto(B+'ansiklopedi.html?id='+id);await p.waitForSelector('#ana .risk');
    const c=await p.getAttribute('#ana .risk','class');
    ok(c.split(' ').slice(2).join(' ')===cls,id+' risk kartı sınıfı "'+c+'", beklenen '+cls);
  }
  // Türkçede veri metni Türkçe (12.10.2026: yedek dil İngilizce seçili dilin üstüne yazıyordu)
  await p.goto(B+'ansiklopedi.html?id=E322');await p.waitForSelector('#ana .risk');
  {const s=await p.textContent('#ana');ok(/Lesitinler/.test(s)&&!/Lecithins/.test(s),'ansiklopedi Türkçe metin: '+s.slice(0,80))}
  // Rozet (G-01): açılan her farklı sayfa gıda Okuru'na sayılır; ilk sayfada kutlama, sonra yalnızca yeni kademede
  {
    const o=await p.evaluate(()=>({n:rozetLoad().okur.gida.length,g:rozetLoad().gor['okur.gida'],kut:!!document.querySelector('#ana .rozetkut'),simge:document.getElementById('rozetsimge').getAttribute('aria-label')}));
    ok(o.n===6&&o.g===1&&!o.kut,'ansiklopedi: 6 farklı sayfa sayıldı, aynı sayfa bir kez, kutlama yalnızca ilkinde: '+JSON.stringify(o));
    ok(/Meraklı/.test(o.simge||''),'ansiklopedi üstünde gıda Okuru simgesi: '+o.simge);
    await p.evaluate(()=>localStorage.setItem('rozetler',JSON.stringify({v:1,okur:{gida:'E100,E101,E102,E104,E110,E120,E122,E123,E124'.split(',')},dedektif:rozetLoad().dedektif,gor:{'okur.gida':1,'dedektif.gida':1}})));
    await p.goto(B+'ansiklopedi.html?id=E127');await p.waitForSelector('#ana .risk');await p.waitForSelector('#ana .rozetkut',{timeout:5000}).catch(()=>{});
    ok(/Okur/.test(await p.textContent('#ana .rozetkut').catch(()=>''))&&/10 farklı ansiklopedi sayfası/.test(await p.textContent('#ana .rozetkut').catch(()=>'')),'10. sayfa: "Okur" kademesi kutlanır');
    await p.goto(B+'ansiklopedi.html');await p.waitForSelector('#ara');await p.waitForSelector('#ana .okfil');
    const t0=await p.evaluate(()=>({okd:document.querySelectorAll('#ana a.row .okd').length,satir:document.querySelectorAll('#ana a.row').length,fil:document.querySelector('#ana .okfil').textContent}));
    ok(t0.okd>=10&&/Okumadıklarım \(\d+\)/.test(t0.fil),'okunan sayfalar işaretli, süzgeç sayısı: '+JSON.stringify(t0));
    await p.click('#ana .okfil');
    const t1=await p.evaluate(()=>({okd:document.querySelectorAll('#ana a.row .okd').length,satir:document.querySelectorAll('#ana a.row').length,bas:document.querySelector('#ana .okfil').getAttribute('aria-pressed')}));
    ok(t1.bas==='true'&&t1.satir===t0.satir-10&&t1.okd===0,'"Okumadıklarım": okunanlar listeden çıkar: '+JSON.stringify(t1));
    await p.click('#ana .okfil');
    // Rozetlerim (Profilim altında): aileler, ilerleme, kademeler, yakında olanlar, paylaşım
    await p.goto(B+'ocr.html#rozetler');await p.waitForSelector('#rozet:not([hidden]) .rzaile');
    const r=await p.evaluate(()=>{const k=q=>document.querySelector('#rozet .rzaile[data-aile="'+q+'"]');return {mod:document.body.classList.contains('mode-rozet'),aile:document.querySelectorAll('#rozet .rzaile').length,
      okur:k('okur').textContent,kad:k('okur').querySelectorAll('.rzk').length,on:k('okur').querySelectorAll('.rzk.on').length,son:k('okur').querySelector('.rzk:last-child').textContent,avci:k('avci').className,avt:k('avci').textContent,sek:document.querySelector('#rozet .seg button[aria-checked="true"]').textContent}});
    ok(r.mod&&r.aile===5&&/Okur/.test(r.okur)&&/10 \/ 25 · sonraki: Kitap Kurdu/.test(r.okur),'Rozetlerim: beş aile, gıda Okuru ilerlemesi: '+r.okur.slice(0,120));
    ok(r.kad===7&&r.on===2&&r.son==='hepsi','gıda Okuru 7 kademe (son "hepsi"), 2 kazanıldı: '+JSON.stringify([r.kad,r.on,r.son]));
    ok(!/yakinda/.test(r.avci)&&/Henüz rozet yok/.test(r.avt)&&/henüz alınamadı/.test(r.avt)&&r.sek==='Gıda (3)','ürün aileleri: sunucuya ulaşılamadı, henüz rozet yok; Gıda sekmesinde 3 rozet: '+r.avt.slice(0,160)+' / '+r.sek);
    await p.waitForSelector('#rozet .rzaile[data-aile="okur"] .rzrow button:not([disabled])',{timeout:8000}).catch(()=>{});
    ok(await p.isEnabled('#rozet .rzaile[data-aile="okur"] .rzrow button').catch(()=>false),'rozet paylaşım görseli hazırlandı');
    await p.click('#rozet .seg button[data-tur="koz"]');
    ok(/Çok yakında/.test(await p.textContent('#rozet .rzaile[data-aile="okur"]'))&&/Henüz rozet yok/.test(await p.textContent('#rozet .rzaile[data-aile="dedektif"]')),'kozmetik: Okur yakında, Dedektif henüz yok');
    await p.click('#rozet .kback');await p.waitForFunction(()=>location.hash==='#profil'&&!document.body.classList.contains('mode-rozet'));
    ok(/3 rozet/.test(await p.textContent('#rozetbar')),'Profilim: "Rozetlerim · 3 rozet": '+await p.textContent('#rozetbar'));
    ok(await p.evaluate(()=>JSON.parse(kayitYedek([],0,'',rozetLoad())).rozetler.okur.gida.length===10),'rozetler yedek dosyasına girer');
    // G-02: ürün rozetleri ve Eklediklerim sunucudan (POST /katki {kim}); kimlik gövdede, yanıt sayıları ve listeyi verir
    {
      let istek=null;
      const yanit={eklenen:{gida:3},avci:{gida:10},oncu:{gida:1},dogrulayici:{gida:2},urunler:[
        {kod:'8690504025207',tur:'gida',t:Date.now()-86400000,dogrulandi:true,oncu:true,dogrulayici:false,ozet:'Kakao kitlesi, şeker'},
        {kod:'4006381333931',tur:'gida',t:Date.now()-3600000,dogrulandi:false,oncu:false,dogrulayici:false,ozet:'Su, şeker'}]};
      await p.route(/workers\.dev\/katki$/,r=>{istek={yontem:r.request().method(),url:r.request().url(),govde:r.request().postDataJSON()};r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(yanit)})});
      await p.evaluate(()=>{const d=rozetLoad();delete d.sunucu;localStorage.setItem('rozetler',JSON.stringify(d))});
      await p.goto(B+'ocr.html#eklediklerim');await p.waitForSelector('#ekle:not([hidden]) .ekitem',{timeout:10000}).catch(()=>{});
      const kim=await p.evaluate(()=>katkiciAl());
      ok(istek&&istek.yontem==='POST'&&/\/katki$/.test(istek.url)&&istek.govde&&istek.govde.kim===kim&&Object.keys(istek.govde).join()==='kim'&&!istek.url.includes(kim),'istek: POST /katki, yalnızca kimlik ve gövdede: '+JSON.stringify(istek));
      const e1=await p.evaluate(()=>({n:document.querySelectorAll('#ekle .ekitem').length,ilk:document.querySelector('#ekle .ekitem').textContent,ikinci:document.querySelectorAll('#ekle .ekitem')[1].textContent,ozet:document.querySelector('#ekle .klistk>p').textContent,kut:[...document.querySelectorAll('#sonuc .rozetkut, #ekle .rozetkut')].map(x=>x.querySelector('.rza').textContent)}));
      ok(e1.n===2&&/Doğrulandı/.test(e1.ilk)&&/Öncü/.test(e1.ilk)&&/Doğrulanmayı bekliyor/.test(e1.ikinci)&&/2 ürün eklediniz, 1 tanesi doğrulandı/.test(e1.ozet),'Eklediklerim listesi ve durumlar: '+JSON.stringify(e1));
      ok(e1.kut.length===1&&await p.evaluate(()=>/\+2 yeni rozet daha/.test(document.querySelector('#ekle .rozetkut').textContent)&&/İzci/.test(document.querySelector('#ekle .rozetkut').textContent)&&/İlk Adım/.test(document.querySelector('#ekle .rozetkut').textContent)&&/İkinci Göz/.test(document.querySelector('#ekle .rozetkut').textContent)),'sunucudan gelen üç yeni kademe tek kartta kutlanır: '+e1.kut.join(','));
      await p.click('#ekle .kback');await p.waitForFunction(()=>location.hash==='#profil');
      ok(/Eklediklerim/.test(await p.textContent('#eklebar'))&&/2 ürün/.test(await p.textContent('#eklebar')),'Profilim: Eklediklerim düğmesi');
      await p.goto(B+'ocr.html#rozetler');await p.waitForSelector('#rozet .rzaile[data-aile="avci"]');
      await p.click('#rozet .seg button[data-tur="gida"]');   // bu sayfada önceden Kozmetik sekmesi seçilmişti
      const r2=await p.evaluate(()=>({avci:document.querySelector('#rozet .rzaile[data-aile="avci"]').textContent,sek:document.querySelector('#rozet .seg button[aria-checked="true"]').textContent,kut:document.querySelectorAll('#rozet .rozetkut').length}));
      ok(/İzci/.test(r2.avci)&&/10 \/ 25 · sonraki: Avcı/.test(r2.avci)&&/Sunucudaki sayım/.test(r2.avci)&&r2.sek==='Gıda (7)'&&r2.kut===0,'Rozetlerim: Ürün Avcısı sunucudan, aynı kademe yeniden kutlanmaz: '+JSON.stringify(r2).slice(0,240));
      // Sayılar 6 saat içinde yeniden sorulmaz (açılış), kimliği olmayan cihaz hiç sormaz
      istek=null;await p.goto(B+'ocr.html');await p.waitForFunction(()=>typeof IDX!=='undefined'&&IDX);await p.waitForTimeout(600);
      ok(!istek,'açılışta taze sayım varsa istek yok');
      await p.evaluate(()=>{localStorage.removeItem('katkici');const d=rozetLoad();delete d.sunucu;localStorage.setItem('rozetler',JSON.stringify(d))});
      await p.goto(B+'ocr.html#profil');await p.reload();await p.waitForFunction(()=>typeof IDX!=='undefined'&&IDX);await p.waitForTimeout(600);
      ok(!istek&&(await p.textContent('#eklebar'))==='','kimlik yoksa istek yok ve Eklediklerim düğmesi yok');
      await p.unroute(/workers\.dev\/katki$/);
    }
    // Profilim › Alerjenler: listede olmayan alerjeni yazarak ekleme, liste, yineleme engeli, silme; gıda ve kozmetik sonucunda kart
    {
      await p.evaluate(()=>{localStorage.setItem('profil',JSON.stringify({al:[]}));localStorage.setItem('tur','gida')});
      await p.goto(B+'ocr.html#profil');await p.reload();await p.waitForSelector('#profil .pozel input',{state:'attached'});
      await p.evaluate(()=>{document.querySelector('#profil .pozel').closest('details').open=true});
      for(const ad of ['Kivi','kakao','KİVİ'])await p.fill('#profil .pozel input',ad),await p.press('#profil .pozel input','Enter');
      const o1=await p.evaluate(()=>({chip:[...document.querySelectorAll('#profil .pozc')].map(c=>c.firstChild.textContent),uy:document.querySelector('#profil .pozel p.mut').textContent,
        kayit:JSON.parse(localStorage.getItem('profil')).alOzel,say:document.querySelector('#profil .pdrop .pcnt').textContent}));
      ok(o1.chip.join()==='kivi,kakao'&&o1.kayit.join()==='Kivi,kakao'&&/zaten ekli/.test(o1.uy)&&o1.say==='2 seçili','elle alerjen: eklenir, cihazda saklanır, aynısı eklenmez: '+JSON.stringify(o1));
      // Dil değişince: sözlükteki ad seçili dilde görünür, İngilizcesi (kiwi) aynı alerjen sayılır; sözlükte olmayan yazıldığı gibi kalır ve belirtilir
      for(const ad of ['lateks'])await p.fill('#profil .pozel input',ad),await p.press('#profil .pozel input','Enter');
      await p.evaluate(()=>localStorage.setItem('dil','en'));await p.reload();await p.waitForSelector('#profil .pozc',{state:'attached'});
      await p.evaluate(()=>{document.querySelector('#profil .pozel').closest('details').open=true});
      await p.fill('#profil .pozel input','Kiwi');await p.press('#profil .pozel input','Enter');
      const o2=await p.evaluate(()=>({chip:[...document.querySelectorAll('#profil .pozc')].map(c=>c.firstChild.textContent),uy:document.querySelector('#profil .pozel p.mut').textContent,
        sz:document.querySelector('#profil .pozsz').textContent,sil:[...document.querySelectorAll('#profil .pozsil')].map(x=>x.getAttribute('aria-label'))}));
      ok(o2.chip.join()==='kiwi,cocoa,lateks'&&/kiwi is already added/.test(o2.uy)&&/lateks/.test(o2.sz)&&!/kiwi|cocoa/.test(o2.sz)&&o2.sil[0]==='Remove kiwi','İngilizcede elle alerjen adı İngilizce, kiwi yinelenmez, sözlükte olmayan belirtilir: '+JSON.stringify(o2));
      await p.evaluate(()=>{const pr=JSON.parse(localStorage.getItem('profil'));pr.alOzel=pr.alOzel.filter(x=>x!=='lateks');localStorage.setItem('profil',JSON.stringify(pr));localStorage.removeItem('dil')});
      await p.goto(B+'ocr.html');await p.waitForFunction(()=>typeof IDX!=='undefined'&&IDX);
      await p.click('#m-gida');await p.evaluate(()=>{document.getElementById('metin').value='Şeker, kivili jöle, su. Eser miktarda kakao içerebilir.';run()});
      const g=await p.evaluate(()=>[...document.querySelectorAll('#sonuc .res.prof')].map(c=>c.className+' '+c.textContent).find(x=>/alerjen/.test(x))||'');
      ok(/\br\b/.test(g)&&/kivi: kivili/.test(g)&&/kakao: kakao/.test(g),'gıda: eklenen alerjen kırmızı kartta, içerebilir ayrı: '+g.slice(0,200));
      await p.click('#m-koz');await p.evaluate(()=>{document.getElementById('metin').value='Aqua, Glycerin, Actinidia Chinensis (Kiwi) Fruit Extract';run()});
      await p.waitForFunction(()=>document.querySelectorAll('#sonuc .res').length>0);
      const k=await p.evaluate(()=>[...document.querySelectorAll('#sonuc .res.prof')].map(c=>c.className+' '+c.textContent).find(x=>/alerjen/.test(x))||'');
      ok(/\br\b/.test(k)&&/kivi: Kiwi/.test(k),'kozmetik: etikette "Kiwi" yazılmış, "Kivi" eklenmiş: sözlük karşılığıyla bulunur: '+k.slice(0,200));
      await p.goto(B+'ocr.html#profil');await p.waitForSelector('#profil .pozsil',{state:'attached'});
      await p.evaluate(()=>{document.querySelector('#profil .pozel').closest('details').open=true});
      await p.click('#profil .pozsil[aria-label="kivi silinsin"]');
      ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('profil')).alOzel.join()==='kakao'&&document.querySelectorAll('#profil .pozc').length===1),'elle alerjen silinir');
      await p.evaluate(()=>{localStorage.setItem('profil',JSON.stringify({al:[]}));localStorage.removeItem('tur')});
    }
    // G-04: Topluluk ekranı (ortak hedef + eksik ürünler, GET /topluluk) ve içerik bulunamayan barkodun bir kez bildirilmesi (POST /aranan)
    {
      const D=JSON.parse(fs.readFileSync(path.join(R,'data','barkod_off.json'),'utf8')).u;
      const gec=k=>p.evaluate(x=>barkodGecerli(x),k);
      const adli=[];for(const k of Object.keys(D))if(!Object.keys(D[k][4]||{}).length&&D[k][1]&&k.length===13&&await gec(k)){adli.push(k);break}
      const icerikli=Object.keys(D).find(k=>D[k][4]&&D[k][4].tr&&/^869\d{10}$/.test(k));
      const yok='5000112637922';
      ok(adli.length&&icerikli&&!D[yok],'topluluk testi için veri: '+adli[0]+' / '+icerikli);
      const istekler=[];
      await p.route(/workers\.dev\/topluluk/,r=>{istekler.push(r.request().url());r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({
        sayilar:{urun:{gida:40,koz:3},dogrulanan:{gida:30,koz:7}},t:Date.now(),
        eksik:[{kod:icerikli,tur:'gida',n:12,son:Date.now()},{kod:yok,tur:'gida',n:4,son:Date.now()-86400000},{kod:adli[0],tur:'gida',n:2,son:Date.now()}]})})});
      let aranan=[];
      await p.route(/workers\.dev\/aranan$/,r=>{aranan.push(r.request().postDataJSON());r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"n":5}'})});
      await p.evaluate(()=>{localStorage.removeItem('aranan');localStorage.setItem('tur','gida')});
      await p.goto(B+'ocr.html#profil');await p.waitForSelector('#toplulukbar button');
      await p.evaluate(()=>setMode('gida',true));   // ekran seçili türle açılır
      ok(/Topluluk/.test(await p.textContent('#toplulukbar')),'Profilim: Topluluk düğmesi');
      await p.click('#toplulukbar button');await p.waitForSelector('#topluluk:not([hidden]) .tpitem',{timeout:10000}).catch(()=>{});
      const s1=await p.evaluate(()=>({hd:document.querySelector('#topluluk .tphedef').textContent,bar:document.querySelector('#topluluk .rzbar').getAttribute('aria-valuenow'),
        l:[...document.querySelectorAll('#topluluk .tpitem')].map(x=>x.textContent),mod:document.body.classList.contains('mode-topluluk'),h:location.hash,tab:document.querySelector('.tabbar a[aria-current]').getAttribute('data-tab')}));
      ok(s1.mod&&s1.h==='#topluluk'&&s1.tab==='profil','#topluluk ekranı Profilim sekmesinde: '+JSON.stringify([s1.h,s1.tab]));
      ok(/Ortak hedef/.test(s1.hd)&&/Birlikte 100 doğrulanmış ürüne ulaşalım/.test(s1.hd)&&/37 \/ 100 doğrulanmış ürün/.test(s1.hd)&&s1.bar==='37','ortak hedef: 37 / 100: '+s1.hd.slice(0,200));
      ok(/Gıda: 40 ürün eklendi, 30 tanesi doğrulandı/.test(s1.hd)&&/Temizlik: 0 ürün eklendi/.test(s1.hd)&&/kişisel sıralama yoktur/.test(s1.hd),'türlere göre sayılar, sıralama yok');
      ok(s1.l.length===2&&s1.l[0].includes(yok)&&/4 kez arandı/.test(s1.l[0])&&s1.l[1].includes(adli[0])&&s1.l[1].includes(D[adli[0]][1])&&!s1.l.join().includes(icerikli),'eksik ürünler: uygulamada içeriği olan çıkar, adı bilinen adıyla: '+JSON.stringify(s1.l));
      ok(istekler.length===1&&/\/topluluk\?tur=gida$/.test(istekler[0]),'istek: GET /topluluk?tur=gida (kimlik yok): '+istekler.join());
      await p.click('#topluluk .seg button[data-tur="koz"]');await p.waitForFunction(()=>document.querySelectorAll('#topluluk .tpitem').length===0&&/Bu türde/.test(document.querySelector('#topluluk .klistk').textContent)||document.querySelectorAll('#topluluk .tpitem').length>0,null,{timeout:5000}).catch(()=>{});
      ok(/\/topluluk\?tur=koz$/.test(istekler.at(-1)),'Kozmetik süzgeci: tur=koz');
      await p.click('#topluluk .seg button[data-tur="gida"]');await p.waitForSelector('#topluluk .tpitem');
      await p.evaluate(()=>setMode('tem',true));   // ürün gıda: "Bu ürün elimde" gıdaya geçer
      // "Bu ürün elimde": ekran kapanır, barkod Etiket Oku'da aranır, bulunamayınca bir kez bildirilir ve kaç kez arandığı yazar
      await p.click('#topluluk .tpitem button');
      await p.waitForFunction(()=>/henüz veritabanında yok/.test((document.querySelector('#sonuc .bkaynak')||{}).textContent||''),null,{timeout:15000});
      await p.waitForFunction(()=>/5 kez arandı/.test(document.querySelector('#sonuc .bkaynak').textContent),null,{timeout:5000}).catch(()=>{});
      const s2=await p.evaluate(()=>({mod:document.body.classList.contains('mode-topluluk'),h:location.hash,kart:document.querySelector('#sonuc .bkaynak').textContent,ar:JSON.parse(localStorage.getItem('aranan')||'[]')}));
      ok(await p.evaluate(()=>MODE==='gida'),'"Bu ürün elimde" ürünün türüne geçer');
      ok(!s2.mod&&s2.h===''&&/5 kez arandı/.test(s2.kart)&&/ilk ekleyen siz/.test(s2.kart),'"Bu ürün elimde" → Etiket Oku, bulunamadı kartında arama sayısı: '+s2.kart.slice(0,160));
      ok(aranan.length===1&&JSON.stringify(aranan[0])===JSON.stringify({kod:yok,tur:'gida'})&&s2.ar.join()===yok,'POST /aranan yalnızca barkod ve tür; cihazda hatırlanır: '+JSON.stringify(aranan));
      await p.evaluate(k=>barkodIsle(k),yok);await p.waitForTimeout(800);
      ok(aranan.length===1,'aynı barkod bu cihazdan ikinci kez bildirilmez');
      await p.unroute(/workers\.dev\/topluluk/);await p.unroute(/workers\.dev\/aranan$/);
    }
    ok(!errs.length,'rozet konsol hatası: '+errs.join(' | '));errs.length=0;
  }
  await p.goto(B+'ansiklopedi.html');await p.waitForSelector('#ara');await p.fill('#ara','lesitin');
  // Arama kutusu boşken bütün elle incelenmiş maddeler listelenir; arama sonucu gelince liste kısalır
  await p.waitForFunction(()=>{const n=document.querySelectorAll('#ana a.row').length;return n>0&&n<50},null,{timeout:10000});
  {const f=await p.$$eval('#ana a.row .rk',e=>e.map(x=>x.textContent.split(' · ')[0]));ok(f[0]==='E322','ansiklopedi araması: '+f.slice(0,5).join(','))}
  await p.fill('#ara','');await p.waitForSelector('#ana .rfil');
  // Tür süzgeci (14.10.2026, kullanıcı kararı): kozmetik ve temizlik ansiklopedisi gelene kadar görünmez; renk süzgeci ve işlev başlıkları var
  {const s=await p.evaluate(()=>({seg:document.querySelectorAll('#ana .seg').length,fil:[...document.querySelectorAll('#ana .rfil')].map(x=>x.textContent),grp:document.querySelectorAll('#ana h3.grph').length}));
   ok(s.seg===0&&s.fil.length===4&&/^Tümü 333/.test(s.fil[0])&&s.grp>5,'ansiklopedi: tür süzgeci yok, renk süzgeci ve gruplar: '+JSON.stringify(s));
   await p.click('#ana .rfil.red');const r=await p.evaluate(()=>[...document.querySelectorAll('#ana a.row .rk')].map(x=>x.textContent));
   ok(r.length===36&&r.every(x=>/Uyarı$/.test(x)),'renk süzgeci: yalnızca uyarılı 36 madde');await p.click('#ana .rfil.tum')}
  // Liste (Türkiye): Türkçe açılış, sayaç ve süzgeç metinleri
  await p.goto(B+'index.html');await p.waitForFunction(()=>/Listelendi/.test((document.getElementById('count')||{}).textContent||''),null,{timeout:10000});
  ok((await p.textContent('h1'))==='Taklit/Tağşiş Listesi'&&(await p.textContent('#il option'))==='Tüm iller','Liste Türkçe açılış');
  ok(!errs.length,'ansiklopedi konsol hatası: '+errs.join(' | '));errs.length=0;
  await ctx.close();

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
  ok(await p.evaluate(()=>{const s=DIL;try{dilKur('ar',{tr:DIL.sozluk.tr,en:DIL.sozluk.en,ar:{}},{ar:{ad:'العربية',yon:'rtl'}});const c=document.createElement('canvas'),L=PAYLAS_AYAR.yerlesim.hikaye;c.width=L.w;c.height=L.h;
    const out=payDraw(c.getContext('2d'),payModel(paySource(),{name:'X'},PAYLAS_AYAR,L),L,PAYLAS_AYAR,null);return out.length>5}finally{DIL=s}}),'sağdan sola kart çizimi');
  // Ansiklopedi ve Liste arayüzü İngilizce (12.10.2026); Bakanlık verisi Türkçe kalır
  await p.goto(B+'ansiklopedi.html?id=E322');await p.waitForSelector('#ana .risk');
  ok(await p.getAttribute('html','lang')==='en'&&(await p.textContent('h1'))==='Encyclopedia','ansiklopedi İngilizce başlık');
  ok(/What does it do\?/.test(await p.textContent('#ana .panel'))&&(await p.textContent('#tab-otorite'))==='Authorities','ansiklopedi sekmeleri İngilizce');
  {const k=await anahtarVar();ok(!k,'ansiklopedi: çıplak anahtar: '+k)}
  await p.goto(B+'ansiklopedi.html');await p.waitForSelector('#ara');
  ok((await p.getAttribute('#ara','placeholder')).startsWith('Name or E number')&&/^All 333$/.test(await p.textContent('#ana .rfil.tum')),'ansiklopedi arama ve süzgeç İngilizce');
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

  await br.close();
  console.log(n+' arayüz denetimi, '+fail+' hata');process.exit(fail?1:0);
})().catch(e=>{console.log('HATA',e.message,e.stack.split('\n').filter(l=>l.includes('arayuz.js')).join(' | '));process.exit(1)});
