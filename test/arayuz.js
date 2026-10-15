// Arayüz testi: sayfalar gerçek bir tarayıcıda (Chromium, telefon genişliği) açılır ve tıklanır.
// Gerekli: npm i --no-save playwright@1.47.2 && npx playwright install chromium. Çalıştır: node test/arayuz.js [grup numarası …]
// Gruplar test/arayuz/<n>_*.js; her biri kendi tarayıcı bağlamı ve sunucusuyla, birbirinden bağımsız ve paralel çalışır.
// Bir grup önceki bir grubun bıraktığı duruma dayanmaz; gerekiyorsa başında o durumu kendisi kurar.
// Denetlenen: konsol hatası yok; üç modda örnek analiz; üç modda karşılaştırma; ansiklopedi renkleri ve arama;
// İngilizce tur (dil seçimi, üç modda analiz, paylaşım kartı, karşılaştırma, çevrilmemiş veri işareti, sağdan sola kart çizimi);
// çevrimdışı açılış (service worker önbelleğinden kozmetik ve temizlik analizi).
// Tarayıcının dili: Türkçe bölümler tr-TR ile açılır (Playwright varsayılanı en-US; o zaman sayfa İngilizce açılırdı).
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const {sunucu}=require('./arayuz/ortak.js');
const D=path.join(__dirname,'arayuz');
const secili=process.argv.slice(2);
const gruplar=fs.readdirSync(D).filter(f=>/^\d+_.*\.js$/.test(f)&&(!secili.length||secili.includes(f.split('_')[0]))).sort();

(async()=>{
  const br=await chromium.launch();
  const opt={viewport:{width:390,height:844},serviceWorkers:'block',locale:'tr-TR'};
  let n=0,fail=0;
  const sonuc=await Promise.all(gruplar.map(async g=>{
    const ad=g.replace(/\.js$/,''),bas=Date.now(),server=sunucu();
    await new Promise(r=>server.listen(0,r));
    const B='http://localhost:'+server.address().port+'/';
    const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA ['+ad+']',m)}};
    try{await require(path.join(D,g))({br,B,opt,ok,server})}
    catch(e){fail++;console.log('HATA ['+ad+'] durdu:',e.message,(e.stack||'').split('\n').filter(l=>l.includes('/test/arayuz/')).join(' | '))}
    await new Promise(r=>{server.close(r);server.closeAllConnections()});
    return ad+' '+((Date.now()-bas)/1000).toFixed(1)+' sn';
  }));
  await br.close();
  console.log(sonuc.join(' · '));
  console.log(n+' arayüz denetimi, '+fail+' hata');process.exit(fail?1:0);
})().catch(e=>{console.log('HATA',e.message);process.exit(1)});
