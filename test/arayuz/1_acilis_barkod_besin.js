// Arayüz testi, 1. grup: açılış ve eski veri, fotoğraf, barkod ve katkı, besin değeri tablosu (1–1d)
// Tek başına çalışmaz; test/arayuz.js bütün grupları kendi sunucularıyla paralel çalıştırır.
const fs=require('fs'),path=require('path');
const {R,newPage,watch,onbellekte,sample,scan,pairs,ACILIS}=require('./ortak.js');
module.exports=async({br,B,opt,ok,server})=>{
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
  await p.setInputFiles('#dosya',path.join(R,'icon-192.png'));
  await p.waitForFunction(()=>getComputedStyle(document.getElementById('cropwrap')).display==='block',null,{timeout:5000});
  ok(await p.evaluate(()=>/^blob:/.test(document.getElementById('pre').src)),'dosyadan yüklenen fotoğraf kırpma ekranında');
  // Sekme değişince ve örnek metinde eski fotoğraf ekranda kalmaz
  const fotoYok=()=>p.evaluate(()=>getComputedStyle(document.getElementById('cropwrap')).display==='none'&&!document.getElementById('pre').hasAttribute('src'));
  await p.click('#m-koz');ok(await fotoYok(),'sekme değişince fotoğraf temizlenir');await p.click('#m-gida');
  await p.setInputFiles('#dosya',path.join(R,'icon-192.png'));
  await p.waitForFunction(()=>getComputedStyle(document.getElementById('cropwrap')).display==='block',null,{timeout:5000});
  await p.click('#ornek');ok(await fotoYok(),'örnek metinde fotoğraf temizlenir');
  await p.setInputFiles('#dosya',path.join(R,'icon-192.png'));
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
  const ocr=await p.evaluate(()=>OCR_URL),ocrYol=u=>u.href.startsWith(ocr)&&u.pathname==='/';   // yalnızca OCR (ölçüm /olcum ve sayaç ayrı yol)
  await p.route(ocrYol,r=>{istek++;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:istek===1?'Şeker, E330, E621':'Şeker, E330'})})});
  ok(!(await p.$('#oku')),'Analiz Et düğmesi yok');
  await p.click('#m-gida');const n0=await p.evaluate(()=>histLoad().length);
  await p.setInputFiles('#dosya',path.join(R,'icon-192.png'));
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
    const ocr=await p.evaluate(()=>OCR_URL),ocrYol=u=>u.href.startsWith(ocr)&&u.pathname==='/';
    let besinG=[],urunN=1;
    await p.route(ocrYol,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:TAB})}));
    await p.route(/workers\.dev\/besin$/,r=>{besinG.push(r.request().postDataJSON());r.fulfill({status:201,contentType:'application/json',body:'{"tamam":true}'})});
    await p.unroute(/workers\.dev\/urun$/);await p.route(/workers\.dev\/urun$/,r=>{urunN++;r.fulfill({status:201,contentType:'application/json',body:'{"tamam":true}'})});
    const tabloEkle=async()=>{const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.evaluate(()=>[...document.querySelectorAll('#sonuc .besin button')].find(b=>b.getAttribute('aria-label')===t('besin.foto_ekle')).click())]);
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
    const kart=()=>p.evaluate(()=>{const d=document.querySelector('#sonuc .besin');return d?{t:d.querySelector('.t').textContent,dz:[...d.querySelectorAll('.bdz')].map(x=>x.className.split(' ')[1]),deg:[...d.querySelectorAll('.bdeg')].map(x=>x.textContent),metin:d.textContent,btn:[...d.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||b.textContent)}:null});
    await p.evaluate(()=>localStorage.removeItem('besin_elle'));
    await scan(p,'gida',TABLO);
    await p.waitForFunction(()=>document.querySelector('#sonuc .besin .btab'),null,{timeout:8000}).catch(()=>{});
    let k=await kart();
    ok(k&&k.t==='Besin Değerleri (100 g başına)'&&k.dz.join()==='yuksek,yuksek,yuksek,dusuk'&&k.deg.slice(0,4).join('|')==='25,1 g|16 g|30,5 g|0,1 g'&&k.deg[4]==='505 kcal','besin kartı: dört satır, düzey etiketleri, enerji renksiz: '+JSON.stringify(k));
    ok(k&&/okunan etiket metnindeki tablo/.test(k.metin),'kaynak satırı');
    ok(await p.evaluate(()=>{const s=document.querySelector('#sonuc .sumbox');return s&&s.nextElementSibling&&s.nextElementSibling.classList.contains('besin')}),'kart özetin hemen altında');
    await p.click('#sonuc .besin .info');
    ok(/Birleşik Krallık Sağlık Bakanlığı/.test(await p.textContent('#sonuc .besin .ipanel'))&&/17,5 g/.test(await p.textContent('#sonuc .besin .ipanel'))&&await p.isVisible('#sonuc .besin .ipanel a'),'(i): eşikler ve kaynak bağlantısı');
    // Porsiyon başına etiket (ABD, O-23): 100 g'a çevrilir, not yazılır, yuvarlama aralığı eşiği kesen satır düzeysiz
    await scan(p,'gida','Ingredients: whole grain oats, sugar, salt.\nNutrition Facts\nServing size 2/3 cup (55g)\nAmount per serving\nCalories 230\n% Daily Value*\nTotal Fat 8g 10%\nSaturated Fat 1g 5%\nSodium 160mg 7%\nTotal Carbohydrate 37g 13%\nDietary Fiber 4g 14%\nTotal Sugars 12g\nProtein 3g');
    await p.waitForFunction(()=>document.querySelector('#sonuc .besin .btab'),null,{timeout:8000}).catch(()=>{});
    k=await kart();
    ok(k&&k.dz.join()==='orta,orta'&&k.deg.slice(0,4).join('|')==='14,55 g|1,82 g|21,82 g|0,73 g'&&/porsiyon \(55 g\) başına yazılı; 100 g'a çevrildi/.test(k.metin),'ABD etiketi: 100 g\'a çevrilir, not, belirsiz satır düzeysiz: '+JSON.stringify(k));
    // Tablo yok
    await scan(p,'gida','Şeker, kakao yağı, süt tozu, E322');
    await p.waitForFunction(()=>document.querySelector('#sonuc .besin .t'),null,{timeout:8000}).catch(()=>{});
    k=await kart();
    ok(k&&!k.dz.length&&/besin değeri tablosu yok/.test(k.metin)&&k.btn.includes('Tablonun fotoğrafını çek'),'tablosuz metin: renk yok, fotoğraf ekle düğmesi: '+JSON.stringify(k&&k.btn));
    // Tablo yokken elle giriş (14.10.2026): boş form, birim seçilir, kaydedince renk ve "siz girdiniz"; metin değişmez
    {
      const m0=await p.inputValue('#metin');
      await p.evaluate(()=>[...document.querySelectorAll('#sonuc .besin button')].find(b=>b.getAttribute('aria-label')===t('besin.elle_gir')).click());
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
      const ocr=await p.evaluate(()=>OCR_URL),ocrYol=u=>u.href.startsWith(ocr)&&u.pathname==='/';   // yalnızca OCR (ölçüm /olcum ve sayaç ayrı yol)
      await p.route(ocrYol,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:'Besin değerleri 100 g\nEnerji 2151 kJ / 505 kcal\nYağ 25,1 g\nDoymuş yağ 16 g\nKarbonhidrat 68,8 g\nŞekerler 30,5 g\nProtein 3,2 g\nTuz 0,1 g'})}));
      const n0=await p.evaluate(()=>histLoad().length);
      // Kaydedilmiş ürüne tablo eklenince kayıt yeni metne taşınır (ikinci kayıt açılmaz)
      await p.evaluate(()=>{localStorage.removeItem('kayitli');kayitStore(kayitAdd([],{id:'k1',t:Date.now(),mode:'gida',name:'Deneme',text:document.getElementById('metin').value,oz:null}))});
      const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.evaluate(()=>[...document.querySelectorAll('#sonuc .besin button')].find(b=>b.getAttribute('aria-label')===t('besin.foto_ekle')).click())]);
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
      const [fc2]=await Promise.all([p.waitForEvent('filechooser'),p.evaluate(()=>[...document.querySelectorAll('#sonuc .besin button')].find(b=>b.getAttribute('aria-label')===t('besin.foto_yeniden')).click())]);
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
    await p.evaluate(()=>[...document.querySelectorAll('#sonuc .besin button')].find(b=>b.getAttribute('aria-label')===t('besin.duzelt')).click());
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
    await p.evaluate(()=>[...document.querySelectorAll('#sonuc .besin button')].find(b=>b.getAttribute('aria-label')===t('besin.duzelt')).click());
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
      await p.evaluate(()=>[...document.querySelectorAll('#sonuc .besin button')].find(b=>b.getAttribute('aria-label')===t('besin.duzelt')).click());
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
      ok(kr.bas.join('|')==='Besin Değerleri|100 g|Tablo yok'&&kr.yag.join('|')==='Yağ|8,9 g Orta|—'&&kr.dz===4,'karşılaştırmada besin satırları: '+JSON.stringify(kr));
      // Yukarı çık düğmesi: uzun sayfada aşağı inince görünür, dokununca başa döner
      const yk=await p.evaluate(async()=>{const b=document.querySelector('button.yukari');if(!b)return {yok:1};document.body.style.minHeight='6000px';
        const once=b.hidden;window.scrollTo(0,4000);await new Promise(r=>setTimeout(r,100));const sonra=b.hidden;
        window.matchMedia=()=>({matches:true});b.click();await new Promise(r=>setTimeout(r,100));const y=window.scrollY;document.body.style.minHeight='';
        return {once,sonra,y,ad:b.getAttribute('aria-label')}});
      ok(yk.once===true&&yk.sonra===false&&yk.y===0&&yk.ad==='Yukarı çık','yukarı çık düğmesi: '+JSON.stringify(yk));
      await p.evaluate(()=>closeCompare());
      await p.evaluate(()=>localStorage.removeItem('kayitli'));
    }
    // Kozmetikte kart yok
    await sample(p,'koz');ok(!await p.$('#sonuc .besin'),'kozmetikte besin kartı yok');
    await p.click('#m-gida');
  }
  ok(!errs.length,'1. grup konsol hatası: '+errs.join(' | '));
  await ctx.close();
};
