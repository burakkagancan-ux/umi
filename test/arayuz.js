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
  await p.goto(B+'ocr.html');await p.waitForFunction(()=>typeof IDX!=='undefined'&&IDX,null,{timeout:15000});

  // 1b) Fotoğraf: kameranın yanında galeriden/dosyadan yükleme (capture olmayan ikinci girdi) kırpma ekranını açar
  ok(await p.isVisible('label.dosya')&&await p.getAttribute('#dosya','capture')===null&&await p.getAttribute('#foto','capture')==='environment','kamera ve dosya yükleme düğmeleri');
  await p.setInputFiles('#dosya',require('path').join(__dirname,'..','icon-192.png'));
  await p.waitForFunction(()=>getComputedStyle(document.getElementById('cropwrap')).display==='block'&&!document.getElementById('oku').disabled,null,{timeout:5000});
  ok(await p.evaluate(()=>/^blob:/.test(document.getElementById('pre').src)),'dosyadan yüklenen fotoğraf kırpma ekranında');

  // 1c) Barkod: elle giriş (kamera testte yok) → uygulamadaki Open Food Facts verisinden içerik + kaynak kartı; geçersiz ve bulunamayan barkod
  {
    const D=JSON.parse(fs.readFileSync(path.join(R,'data','barkod_off.json'),'utf8')).u;
    const kod=Object.keys(D).find(k=>D[k][0]==='food'&&D[k][4].tr&&D[k][1]&&/^869\d{10}$/.test(k));
    const yok=['4006381333931','5000112637922','3017620422003'].find(k=>!D[k]&&!D['0'+k]);
    ok(kod&&yok,'barkod testi için veri: '+kod+' / '+yok);
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
    ok(gonderilen&&Object.keys(gonderilen).sort().join()==='dil,kod,metin,tur'&&gonderilen.kod===yok&&gonderilen.tur==='gida'&&gonderilen.dil==='tr','katkı: yalnızca kod, tür, dil, metin: '+JSON.stringify(gonderilen&&Object.keys(gonderilen)));
    ok(await p.evaluate(()=>localStorage.getItem('barkod_katki')===null),'"hatırla" seçilmedikçe tercih kaydedilmez');
    await p.unroute(/workers\.dev\/urun$/);
    await p.evaluate(()=>{BARKOD=null;document.getElementById('metin').value='';document.getElementById('sonuc').textContent=''});
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
  await p.goto(B+'ansiklopedi.html');await p.waitForSelector('#ara');await p.fill('#ara','lesitin');
  // Arama kutusu boşken bütün elle incelenmiş maddeler listelenir; arama sonucu gelince liste kısalır
  await p.waitForFunction(()=>{const n=document.querySelectorAll('#ana a.row').length;return n>0&&n<50},null,{timeout:10000});
  {const f=await p.$$eval('#ana a.row .rc',e=>e.map(x=>x.textContent));ok(f[0]==='E322','ansiklopedi araması: '+f.slice(0,5).join(','))}
  ok(!errs.length,'ansiklopedi konsol hatası: '+errs.join(' | '));errs.length=0;
  await ctx.close();

  // 4b) İngilizce: tarayıcı dili en-US, kayıtlı seçim yok → sayfa İngilizce açılır
  ctx=await br.newContext(Object.assign({},opt,{locale:'en-US'}));p=await newPage(ctx);watch(p,errs);
  await p.goto(B+'ocr.html');await p.waitForFunction(()=>typeof IDX!=='undefined'&&IDX,null,{timeout:15000});
  ok(await p.getAttribute('html','lang')==='en'&&(await p.textContent('h1'))==='Read Label','İngilizce açılış: lang ve başlık');
  ok((await p.textContent('#oku'))==='Analyse'&&(await p.getAttribute('#metin','placeholder')).startsWith('The text'),'İngilizce düğme ve placeholder');
  const anahtarVar=()=>p.evaluate(()=>{const m=document.body.innerText.match(/\b(ortak|gida|koz|tem|kars|kayit|pay|profil|risk|sayfa|ulke|veri|kanser|eslesme|foto|ocr|nav|birim)\.[a-z0-9_]+(\.[a-z0-9_]+)*\b/);return m?m[0]:''});
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
  // Dil seçimi: Hassasiyetlerim'den Türkçe → sayfa Türkçe yeniden yüklenir
  await p.goto(B+'ocr.html#profil');await p.waitForSelector('#dilsec');
  await Promise.all([p.waitForNavigation(),p.selectOption('#dilsec','tr')]);await p.waitForFunction(()=>typeof IDX!=='undefined'&&IDX);
  ok(await p.getAttribute('html','lang')==='tr'&&await p.evaluate(()=>localStorage.getItem('dil'))==='tr','dil seçici: Türkçe kaydedildi ve uygulandı');
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
  ok(await p.$$eval('#ana a.row .rc',e=>e.length&&e[0].textContent==='E322'),'çevrimdışı: ansiklopedi araması');
  ok(!errs.length,'çevrimdışı konsol hatası: '+errs.join(' | '));
  await ctx.close();

  await br.close();
  console.log(n+' arayüz denetimi, '+fail+' hata');process.exit(fail?1:0);
})().catch(e=>{console.log('HATA',e.message);process.exit(1)});
