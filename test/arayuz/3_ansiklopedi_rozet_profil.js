// Arayüz testi, 3. grup: ansiklopedi, rozetler, Eklediklerim, elle alerjen, Topluluk, Liste (4)
// Tek başına çalışmaz; test/arayuz.js bütün grupları kendi sunucularıyla paralel çalıştırır.
const fs=require('fs'),path=require('path');
const {R,newPage,watch,onbellekte,sample,scan,pairs,ACILIS}=require('./ortak.js');
module.exports=async({br,B,opt,ok,server})=>{
  let ctx=await br.newContext(opt),errs=[],p=await newPage(ctx);watch(p,errs);
  await p.goto(B+'ocr.html');await p.waitForFunction(ACILIS,null,{timeout:15000});
  // Bu grubun beklediği önceki durum (eskiden 1. grubun bıraktığı): bulunan barkodlarla gıda Etiket Dedektifi'nin ilk kademesi ve katkıcı kimliği
  await p.evaluate(()=>{localStorage.setItem('rozetler',JSON.stringify({v:1,okur:{},dedektif:{gida:['b:8690504025208','b:86920131']},gor:{'dedektif.gida':1}}));
    localStorage.setItem('katkici','0123456789abcdef0123456789abcdef')});
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
    // Temizlik ansiklopedisi (15.10.2026): tür seçici, liste yalnızca seçili tür, madde sayfasında gıda kartları yok, seçim hatırlanır
    {
      await p.click('#tur-tem');await p.waitForFunction(()=>/Yüzey Aktif Madde/.test(document.getElementById('ana').textContent),null,{timeout:5000}).catch(()=>{});
      const t2=await p.evaluate(()=>({sec:document.querySelector('#tur-tem').getAttribute('aria-checked'),toplam:[...document.querySelectorAll('#ana p.mut')].map(x=>x.textContent).join('|'),
        gida:/Renklendirici/.test(document.getElementById('ana').textContent),sakli:localStorage.getItem('ans_tur')}));
      ok(t2.sec==='true'&&/30 maddenin/.test(t2.toplam)&&!t2.gida&&t2.sakli==='tem','temizlik türü seçilir, yalnızca temizlik grupları: '+JSON.stringify(t2));
      await p.goto(B+'ansiklopedi.html?id=7681-52-9');await p.waitForSelector('#ana .risk');
      const t3=await p.evaluate(()=>({ad:document.querySelector('#ana h2.name').textContent,risk:document.querySelector('#ana .risk').className,quick:!!document.querySelector('#ana .quick'),
        metin:document.getElementById('ana').textContent}));
      ok(t3.ad==='Sodyum Hipoklorit'&&/red/.test(t3.risk)&&!t3.quick&&/H314/.test(t3.metin)&&/EUH031/.test(t3.metin),'çamaşır suyu sayfası: kırmızı, H ifadeleri, vegan/glüten kartı yok: '+JSON.stringify(t3).slice(0,300));
      await p.goto(B+'ansiklopedi.html');await p.waitForSelector('#tur-tem');
      ok(await p.getAttribute('#tur-tem','aria-checked')==='true','seçili tür hatırlanır');
      await p.click('#tur-gida');await p.waitForSelector('#ana .okfil');
    }
    // Kozmetik ansiklopedisi (15.10.2026, U-01): tür seçici açık, liste yalnızca kozmetik, sayfada INCI adı boşluklu, gıda kartları yok
    {
      await p.click('#tur-koz');await p.waitForFunction(()=>/Koruyucu/.test(document.getElementById('ana').textContent)&&/UV Filtresi/.test(document.getElementById('ana').textContent),null,{timeout:5000}).catch(()=>{});
      const k1=await p.evaluate(()=>({sec:document.querySelector('#tur-koz').getAttribute('aria-checked'),dis:document.querySelector('#tur-koz').getAttribute('aria-disabled'),
        toplam:[...document.querySelectorAll('#ana p.mut')].map(x=>x.textContent).join('|'),tem:/Yüzey Aktif Madde/.test(document.getElementById('ana').textContent)}));
      ok(k1.sec==='true'&&k1.dis===null&&/32 maddenin/.test(k1.toplam)&&!k1.tem,'kozmetik türü seçilir, yalnızca kozmetik grupları: '+JSON.stringify(k1));
      await p.goto(B+'ansiklopedi.html?id=SODIUM_LAURETH_SULFATE');await p.waitForSelector('#ana .risk');
      const k2=await p.evaluate(()=>({kod:document.querySelector('#ana .ecode').textContent,ad:document.querySelector('#ana h2.name').textContent,quick:!!document.querySelector('#ana .quick'),
        tur:document.querySelector('#ana .turr').getAttribute('data-tur'),metin:document.getElementById('ana').textContent}));
      ok(k2.kod==='SODIUM LAURETH SULFATE'&&/SLES/.test(k2.ad)&&!k2.quick&&k2.tur==='koz'&&/H318/.test(k2.metin),'SLES kozmetik sayfası: INCI adı, tür etiketi, ECHA satırı: '+JSON.stringify(k2).slice(0,300));
      await p.goto(B+'ansiklopedi.html');await p.waitForSelector('#tur-koz');await p.click('#tur-gida');await p.waitForSelector('#ana .okfil');
    }
    // Kaydettiklerim açılır liste (14.10.2026): kapalı başlar, sayı başlıkta, süzgeç değişince açık kalır
    await p.evaluate(()=>localStorage.setItem('yerimleri',JSON.stringify(['E322','E330'])));await p.reload();await p.waitForSelector('#ana details.kdrop');
    const kd0=await p.evaluate(()=>{const d=document.querySelector('#ana details.kdrop');return {acik:d.open,bas:d.querySelector('summary').textContent,satir:d.querySelectorAll('a.row').length}});
    await p.click('#ana details.kdrop>summary');await p.click('#ana .rfil.red');
    const kd1=await p.evaluate(()=>{const d=document.querySelector('#ana details.kdrop');return {acik:d.open,gor:d.querySelector('a.row').offsetHeight>0}});
    await p.click('#ana .rfil.tum');await p.evaluate(()=>localStorage.removeItem('yerimleri'));
    ok(!kd0.acik&&/^Kaydettiklerim2$/.test(kd0.bas)&&kd0.satir===2&&kd1.acik&&kd1.gor,'Kaydettiklerim açılır liste: '+JSON.stringify([kd0,kd1]));
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
    ok(!/Çok yakında/.test(await p.textContent('#rozet .rzaile[data-aile="okur"]'))&&/Henüz rozet yok/.test(await p.textContent('#rozet .rzaile[data-aile="dedektif"]')),'kozmetik: Okur açık (ansiklopedi var), Dedektif henüz yok');
    await p.click('#rozet .kback');await p.waitForFunction(()=>location.hash==='#profil'&&!document.body.classList.contains('mode-rozet'));
    // 3 gıda rozeti + yukarıda açılan temizlik ve kozmetik sayfalarının Okur rozetleri (15.10.2026)
    ok(/5 rozet/.test(await p.textContent('#rozetbar')),'Profilim: "Rozetlerim · 5 rozet": '+await p.textContent('#rozetbar'));
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
      ok(/Ortak Hedef/.test(s1.hd)&&/Birlikte 100 doğrulanmış ürüne ulaşalım/.test(s1.hd)&&/37 \/ 100 doğrulanmış ürün/.test(s1.hd)&&s1.bar==='37','ortak hedef: 37 / 100: '+s1.hd.slice(0,200));
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
  // Tür etiketi (15.10.2026): adı aynı gıda ve temizlik maddesi (Sitrik Asit: E330 ve CAS 77-92-9) sonuçta tür adı ve rengiyle ayrılır; tür sekmesi de türün rengini taşır
  await p.fill('#ara','sitrik asit');await p.waitForFunction(()=>document.querySelectorAll('#ana a.row .turr').length>=2,null,{timeout:5000}).catch(()=>{});
  {const r=await p.$$eval('#ana a.row .turr',e=>e.map(x=>x.dataset.tur+'|'+x.textContent+'|'+getComputedStyle(x).color));
   ok(r.some(x=>x.startsWith('gida|Gıda|'))&&r.some(x=>x.startsWith('tem|Temizlik|'))&&new Set(r.map(x=>x.split('|')[2])).size>=2,'tür etiketi: '+r.slice(0,4).join(', '));
   const s=await p.$eval('#tur-gida',b=>[b.dataset.tur,getComputedStyle(b).backgroundColor]);ok(s[0]==='gida'&&s[1]==='rgb(74, 68, 176)','tür sekmesi rengi: '+s.join(' '))}
  await p.fill('#ara','');await p.waitForSelector('#ana .rfil');
  // Tür süzgeci (14.10.2026, kullanıcı kararı): ikinci tür gelince görünür (temizlik 15.10.2026); renk süzgeci ve işlev başlıkları var
  {const s=await p.evaluate(()=>({seg:document.querySelectorAll('#ana .seg').length,fil:[...document.querySelectorAll('#ana .rfil')].map(x=>x.textContent),grp:document.querySelectorAll('#ana details.gdrop').length,acik:document.querySelectorAll('#ana details.gdrop[open]').length}));
   ok(s.seg===1&&s.fil.length===4&&/^Tümü 333/.test(s.fil[0])&&s.grp>5&&s.acik===0,'ansiklopedi: tür süzgeci (Gıda seçili), renk süzgeci ve kapalı açılır gruplar: '+JSON.stringify(s));
   await p.click('#ana .rfil.red');const r=await p.evaluate(()=>{document.querySelectorAll('#ana details.gdrop').forEach(d=>d.open=true);return [...document.querySelectorAll('#ana a.row .rk')].map(x=>x.textContent)});
   ok(r.length===36&&r.every(x=>/Uyarı$/.test(x)),'renk süzgeci: yalnızca uyarılı 36 madde');await p.click('#ana .rfil.tum')}
  // Liste (Türkiye): Türkçe açılış, sayaç ve süzgeç metinleri
  await p.goto(B+'index.html');await p.waitForFunction(()=>/Listelendi/.test((document.getElementById('count')||{}).textContent||''),null,{timeout:10000});
  ok((await p.textContent('h1'))==='Taklit/Tağşiş Listesi'&&(await p.textContent('#il option'))==='Tüm iller','Liste Türkçe açılış');
  ok(!errs.length,'ansiklopedi konsol hatası: '+errs.join(' | '));errs.length=0;
  await ctx.close();
};
