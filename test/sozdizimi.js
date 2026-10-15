// Sözdizimi denetimi: sayfalardaki satır içi <script> blokları ve js/ klasöründeki dosyalar (arayüz kodu node testlerinde çalışmadığı için).
// Ayrıca eski Safari'yi bozan düzenli ifade geriye bakışı ((?<= / (?<!) aranır; sayfadaki betikler arasında global ad çakışması aranır (O-15).
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
// Global ad çakışması (YOL_HARITASI.md O-15): bir sayfanın betikleri tek global alanı paylaşır; iki dosyada aynı üst düzey
// var/function adı sessizce birbirinin üstüne yazar (sonraki kazanır), let/const/class çakışması sayfayı açılışta kırar.
// Betikler sayfadaki sırayla tek bir boş bağlamda çalıştırılmadan bildirilir ("throw 0" ilk satırda: kod çalışmaz, bildirimler yine yapılır).
{const vm=require('vm');
  const bildir=(c,code)=>{try{vm.runInContext('throw 0;\n'+code,c)}catch(e){if(e!==0)return e.message}};
  for(const f of ['ocr.html','index.html','ansiklopedi.html']){
    const h=fs.readFileSync(__dirname+'/../'+f,'utf8'),c=vm.createContext({}),g=vm.runInContext('this',c),kim=new Map();let i=0;
    for(const m of h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
      const s=/\bsrc="([^"]+)"/.exec(m[1]);if(s&&/^https?:/.test(s[1]))continue;
      const ad=s?s[1]:f+' script '+(i++),p=s&&__dirname+'/../'+s[1];if(s&&!fs.existsSync(p))continue;
      const code=s?fs.readFileSync(p,'utf8'):m[2],ayri=vm.createContext({}),once=new Set(Object.getOwnPropertyNames(vm.runInContext('this',ayri)));
      bildir(ayri,code);
      for(const a of Object.getOwnPropertyNames(vm.runInContext('this',ayri)))if(!once.has(a)){if(kim.has(a)){fail++;console.log('HATA',f,'global ad iki dosyada:',a,'('+kim.get(a)+', '+ad+')')}else kim.set(a,ad)}
      const e=bildir(c,code);if(e){fail++;console.log('HATA',f,ad,'global ad çakışması (let/const/class):',e)}
    }
  }
}
console.log(n+' script bloğu/dosyası, '+fail+' hata');process.exit(fail?1:0);
