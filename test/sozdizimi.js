// Sözdizimi denetimi: sayfalardaki satır içi <script> blokları ve js/ klasöründeki dosyalar (arayüz kodu node testlerinde çalışmadığı için).
// Ayrıca eski Safari'yi bozan düzenli ifade geriye bakışı ((?<= / (?<!) aranır.
// Çalıştır: node test/sozdizimi.js
const fs=require('fs');let fail=0,n=0;
function check(name,code){n++;try{new Function(code)}catch(e){fail++;console.log('HATA',name,e.message)}if(/\(\?<[=!]/.test(code)){fail++;console.log('HATA',name,'regex lookbehind (eski Safari desteklemez)')}}
for(const f of ['ocr.html','index.html','ansiklopedi.html']){
  const h=fs.readFileSync(__dirname+'/../'+f,'utf8');
  [...h.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].forEach((m,i)=>check(f+' script '+i,m[1]));
  [...h.matchAll(/<script[^>]*\bsrc="(?!https?:)([^"]+)"/g)].forEach(m=>{const p=__dirname+'/../'+m[1];if(!fs.existsSync(p)){fail++;console.log('HATA',f,'dosya yok:',m[1])}});
}
const js=fs.readdirSync(__dirname+'/../js').filter(f=>f.endsWith('.js'));
for(const f of js)check('js/'+f,fs.readFileSync(__dirname+'/../js/'+f,'utf8'));
// Her js dosyası ocr.html, ansiklopedi.html ya da index.html'de yüklenir ve sw.js CORE listesinde bulunur
const ocr=fs.readFileSync(__dirname+'/../ocr.html','utf8')+fs.readFileSync(__dirname+'/../ansiklopedi.html','utf8')+fs.readFileSync(__dirname+'/../index.html','utf8'),sw=fs.readFileSync(__dirname+'/../sw.js','utf8');
for(const f of js){if(ocr.indexOf('"js/'+f+'"')<0){fail++;console.log('HATA','ocr.html/ansiklopedi.html/index.html js/'+f+' yüklemiyor')}if(sw.indexOf('"js/'+f+'"')<0){fail++;console.log('HATA','sw.js CORE listesinde js/'+f+' yok')}}
console.log(n+' script bloğu/dosyası, '+fail+' hata');process.exit(fail?1:0);
