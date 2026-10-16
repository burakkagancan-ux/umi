// Arayüz testi, 2. grup: üç modda örnek analiz, karşılaştırma ve tür ayrımı, kaydedilen ürünler (2–3b)
// Tek başına çalışmaz; test/arayuz.js bütün grupları kendi sunucularıyla paralel çalıştırır.
const fs=require('fs'),path=require('path');
const {R,newPage,watch,onbellekte,sample,scan,pairs,ACILIS}=require('./ortak.js');
module.exports=async({br,B,opt,ok,server})=>{
  let ctx=await br.newContext(opt),errs=[],p=await newPage(ctx);watch(p,errs);
  await p.goto(B+'ocr.html');await p.waitForFunction(ACILIS,null,{timeout:15000});
  // 2) Üç modda örnek analiz
  for(const m of ['gida','koz','tem']){
    await sample(p,m);
    ok(await p.$$eval('#sonuc .res',e=>e.length)>2,m+': sonuç kartları');
    ok(await p.isVisible('#sonuc .resbar .pay'),m+': paylaş düğmesi');
    // Özet satırı (17.10.2026): telefonda ad değerin üstünde; düzeyli satırda adın önünde simge ve ekran okuyucu için düzey adı; değer yazı renginde
    {const o=await p.evaluate(()=>{const r=[...document.querySelectorAll('#sonuc .sumbox .srow')],d=r.find(x=>x.querySelector('.sl .ic'));
      const l=r[0].querySelector('.sl').getBoundingClientRect(),v=r[0].querySelector('.sv').getBoundingClientRect();
      return {n:r.length,ust:l.bottom<=v.top+1,ic:!!d,vh:d?d.querySelector('.sl .vh').textContent:'',renk:d?getComputedStyle(d.querySelector('.sv')).color===getComputedStyle(document.body).color:false}});
     ok(o.n>=3&&o.ust&&o.ic&&/^(Uyarı|Dikkat): $/.test(o.vh)&&o.renk,m+': özet satırı düzeni: '+JSON.stringify(o))}
    // Kaydet / Paylaş çubuğu aşağı kayınca ekranın üstünde kalır
    {await p.evaluate(()=>window.scrollTo(0,document.querySelector('#sonuc').getBoundingClientRect().top+scrollY+900));await p.waitForTimeout(100);
     const t=await p.evaluate(()=>document.querySelector('#sonuc .resbar').getBoundingClientRect().top);ok(t>=-1&&t<5,m+': Kaydet/Paylaş çubuğu üstte kalıyor ('+t+')')}
  }
  ok(!errs.length,'örnek analiz konsol hatası: '+errs.join(' | '));errs.length=0;

  // 3) Üç modda karşılaştırma: iki tarama, seçim, karar kartı, satırlar, madde alt sayfası
  // Karşılaştırma çiftleri: ortak.js pairs
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
  await p.fill('#metin',pairs.koz[0],{timeout:2000}).catch(()=>p.evaluate(t=>{const m=document.getElementById('metin');m.value=t;m.dispatchEvent(new Event('input'))},pairs.koz[0]));
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
  // Kısayol kutusu küçük; adet simgenin yanında (aynı satırda, sağında), ad altında
  const ks=await p.$eval('#kayitbar .kayitac',k=>{const r=e=>k.querySelector(e).getBoundingClientRect(),i=r('svg'),s=r('.say'),a=r('b');
    return {yan:Math.abs((s.top+s.bottom)/2-(i.top+i.bottom)/2)<4&&s.left>i.right,alt:a.top>=i.bottom,boy:Math.round(k.getBoundingClientRect().height)}});
  ok(ks.yan&&ks.alt&&ks.boy<100,'Kaydedilen kutusu: adet simgenin yanında, küçük: '+JSON.stringify(ks));
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
  await p.evaluate(()=>kayitAc());await p.click('#kayit .kseg button[data-m="tem"]');const sid=await p.getAttribute('#kayit .kkayit','data-k');await p.click('#kayit .kkayit');await p.click('#sheet .kpick button.kclr');
  await p.waitForFunction(id=>!document.querySelector('#kayit .kkayit[data-k="'+id+'"]'),sid);   // satır küçülüp kaybolduktan sonra liste yeniden çizilir (js/hareket.js)
  ok(await p.evaluate(()=>kayitLoad().length)===3,'silme');
  // Yedekten geri yükleme (dosya seçimi)
  await p.setInputFiles('#kyedekdosya',{name:'y.json',mimeType:'application/json',buffer:Buffer.from(yedek)});await p.waitForTimeout(400);
  ok(await p.evaluate(()=>kayitLoad().length)===4&&/1 ürün eklendi/.test(await p.textContent('#kayit .kyedek')),'yedekten geri yükleme: '+(await p.textContent('#kayit .kyedek')).slice(-60));
  await p.evaluate(()=>kayitKapat());
  ok(!errs.length,'kayıt konsol hatası: '+errs.join(' | '));errs.length=0;
  await ctx.close();
};
