// Arayüz testi: sayfalar gerçek bir tarayıcıda (Chromium, telefon genişliği) açılır ve tıklanır.
// Gerekli: npm i --no-save playwright@1.47.2 && npx playwright install chromium. Çalıştır: node test/arayuz.js [grup numarası … | kabul]
// Gruplar test/arayuz/<n>_*.js ve test/kabul/*.js (kabul testleri; belgeler/mimari/testler.md); her biri kendi tarayıcı bağlamı ve sunucusuyla, birbirinden bağımsız ve paralel çalışır.
// Bir grup önceki bir grubun bıraktığı duruma dayanmaz; gerekiyorsa başında o durumu kendisi kurar.
// Denetlenen: konsol hatası yok; üç modda örnek analiz; üç modda karşılaştırma; ansiklopedi renkleri ve arama;
// İngilizce tur (dil seçimi, üç modda analiz, paylaşım kartı, karşılaştırma, çevrilmemiş veri işareti, sağdan sola kart çizimi);
// çevrimdışı açılış (service worker önbelleğinden kozmetik ve temizlik analizi).
// Tarayıcının dili: Türkçe bölümler tr-TR ile açılır (Playwright varsayılanı en-US; o zaman sayfa İngilizce açılırdı).
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const {sunucu}=require('./arayuz/ortak.js');
const D=path.join(__dirname,'arayuz'),KD=path.join(__dirname,'kabul');
const secili=process.argv.slice(2);
// Kabul testleri (test/kabul/*.js, _ ile başlayan yardımcılar hariç) de birer grup: "kabul" seçimiyle yalnızca onlar çalışır
const gruplar=[
  ...fs.readdirSync(D).filter(f=>/^\d+_.*\.js$/.test(f)&&(!secili.length||secili.includes(f.split('_')[0]))).sort().map(f=>path.join(D,f)),
  ...(fs.existsSync(KD)?fs.readdirSync(KD):[]).filter(f=>/^[^_].*\.js$/.test(f)&&(!secili.length||secili.includes('kabul'))).sort().map(f=>path.join(KD,f))];

(async()=>{
  const br=await chromium.launch();
  const opt={viewport:{width:390,height:844},serviceWorkers:'block',locale:'tr-TR'};
  let n=0,fail=0;
  const sonuc=await Promise.all(gruplar.map(async g=>{
    const ad=path.relative(__dirname,g).replace(/^arayuz[\\/]/,'').replace(/\.js$/,''),bas=Date.now(),server=sunucu();
    await new Promise(r=>server.listen(0,r));
    const B='http://localhost:'+server.address().port+'/';
    const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA ['+ad+']',m)}};
    try{await require(g)({br,B,opt,ok,server})}
    catch(e){fail++;console.log('HATA ['+ad+'] durdu:',e.message,(e.stack||'').split('\n').filter(l=>/\/test\/(arayuz|kabul)\//.test(l)).join(' | '))}
    await new Promise(r=>{server.close(r);server.closeAllConnections()});
    return ad+' '+((Date.now()-bas)/1000).toFixed(1)+' sn';
  }));
  await br.close();
  console.log(sonuc.join(' · '));
  console.log(n+' arayüz denetimi, '+fail+' hata');process.exit(fail?1:0);
})().catch(e=>{console.log('HATA',e.message);process.exit(1)});
