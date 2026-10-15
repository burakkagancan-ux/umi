// Arayüz testi grupları için ortak yardımcılar: yerel sunucu, sayfa açma, örnek ve metinle analiz, karşılaştırma çiftleri.
const http=require('http'),fs=require('fs'),path=require('path');
const R=path.join(__dirname,'..','..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css',
  '.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
// Her grup kendi sunucusunu açar: 4. grup çevrimdışı denetimde sunucuyu kapatır, diğerleri etkilenmez
function sunucu(){
  return http.createServer((q,s)=>{
    let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
    const f=path.join(R,p);
    if(!f.startsWith(R)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}
    s.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s);
  });
}
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
// Etiket Oku açıldı: gıda dizini yüklendi
const ACILIS=()=>typeof IDX!=='undefined'&&IDX;
// Karşılaştırma çiftleri (2. ve 4. grup): ilk ürün risksiz, ikincisi riskli
const pairs={
  gida:['İçindekiler: Şeker, kakao, E322.','İçindekiler: Şeker, kakao, E250.','A'],
  koz:['Ingredients: Aqua, Glycerin, Parfum, Linalool, Phenoxyethanol.','Ingredients: Aqua, Glycerin, Butylphenyl Methylpropional, Phenoxyethanol.','A'],
  tem:['İçindekiler: %5-15 anyonik yüzey aktif maddeler, parfüm. DİKKAT. Cilt tahrişine yol açar.','İçindekiler: %5-15 anyonik yüzey aktif maddeler. TEHLİKE. Ciddi göz hasarına yol açar.','A']};
module.exports={R,sunucu,watch,newPage,onbellekte,sample,scan,ACILIS,pairs};
