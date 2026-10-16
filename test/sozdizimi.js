// Sözdizimi denetimi: sayfalardaki satır içi <script> blokları ve js/ klasöründeki dosyalar (arayüz kodu node testlerinde çalışmadığı için).
// Ayrıca eski Safari'yi bozan düzenli ifade geriye bakışı ((?<= / (?<!) aranır; sayfadaki betikler arasında global ad çakışması aranır (O-15).
// js/ altında iki tür dosya var (U-07, 15.10.2026): ES modülleri (import/export; saf mantık, köprü, sayfa girişleri) ve klasik betikler (arayüz).
// Çalıştır: node test/sozdizimi.js
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');let fail=0,n=0;
const R=path.join(__dirname,'..'),J=path.join(R,'js');
const modulMu=code=>/^\s*(import|export)\b/m.test(code);
function geriBakis(name,code){if(/\(\?<[=!]/.test(code)){fail++;console.log('HATA',name,'regex lookbehind (eski Safari desteklemez)')}}
function check(name,code){n++;try{new Function(code)}catch(e){fail++;console.log('HATA',name,e.message)}geriBakis(name,code)}
// Modül: node --check (js/package.json "type": "module")
function checkModul(name,file){n++;const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status){fail++;console.log('HATA',name,(r.stderr||'').split('\n').filter(Boolean).slice(0,4).join(' | '))}geriBakis(name,fs.readFileSync(file,'utf8'))}
const SAYFALAR=['ocr.html','index.html','ansiklopedi.html'];
for(const f of SAYFALAR){
  const h=fs.readFileSync(path.join(R,f),'utf8');
  [...h.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].forEach((m,i)=>check(f+' script '+i,m[1]));
  [...h.matchAll(/<script[^>]*\bsrc="(?!https?:)([^"]+)"/g)].forEach(m=>{if(!fs.existsSync(path.join(R,m[1]))){fail++;console.log('HATA',f,'dosya yok:',m[1])}});
}
const js=fs.readdirSync(J).filter(f=>f.endsWith('.js'));
const kod={};for(const f of js)kod[f]=fs.readFileSync(path.join(J,f),'utf8');
for(const f of js)modulMu(kod[f])?checkModul('js/'+f,path.join(J,f)):check('js/'+f,kod[f]);
// Bir modülün içe aktardığı js/ dosyaları (zincirle)
function iceAktarilan(f,gor){gor=gor||new Set();if(gor.has(f)||!kod[f])return gor;gor.add(f);
  for(const m of kod[f].matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s*"\.\/([^"/]+\.js)"/gm))iceAktarilan(m[1],gor);return gor}
// Sayfanın yüklediği js dosyaları: klasik betikler ve modül girişleri (girişin içe aktardıklarıyla)
function sayfaDosyalari(f){const h=fs.readFileSync(path.join(R,f),'utf8'),o=new Set();
  for(const m of h.matchAll(/<script\b[^>]*\bsrc="js\/([^"]+)"/g))for(const x of iceAktarilan(m[1]))o.add(x);return o}
// Her js dosyası bir sayfada (doğrudan ya da bir modülün içe aktarmasıyla) yüklenir ve sw.js CORE listesinde bulunur
{const yuklu=new Set();SAYFALAR.forEach(f=>sayfaDosyalari(f).forEach(x=>yuklu.add(x)));const sw=fs.readFileSync(path.join(R,'sw.js'),'utf8');
 for(const f of js){if(!yuklu.has(f)){fail++;console.log('HATA','hiçbir sayfa js/'+f+' yüklemiyor')}if(sw.indexOf('"js/'+f+'"')<0){fail++;console.log('HATA','sw.js CORE listesinde js/'+f+' yok (python3 uret.py)')}}}
// Çizimden önce <head>'de defer'siz çalışan betikler (17.10.2026: tema seçimi açılışta yanlış renk görünmesin; js/tema.js). Yalnızca kendi
// aralarındaki adları kullanırlar, köprülenen (modül) adlarına dokunmazlar. Başka betik buraya eklenmez: sayfanın çizimini geciktirir.
const ERKEN=new Set(['depo.js','tema.js']);
// Modül değilken modül sözdizimi kullanan sayfa betiği: <script type="module"> olmadan yüklenen dosyada import/export olamaz
for(const f of SAYFALAR){const h=fs.readFileSync(path.join(R,f),'utf8');
  for(const m of h.matchAll(/<script\b([^>]*)\bsrc="js\/([^"]+)"/g)){const tip=/type="module"/.test(m[1]);if(kod[m[2]]&&modulMu(kod[m[2]])!==tip){fail++;console.log('HATA',f,'js/'+m[2],tip?'type="module" ama dosya modül değil':'modül dosyası type="module" olmadan yükleniyor')}
    if(!tip&&!/\bdefer\b/.test(m[1])&&!(ERKEN.has(m[2])&&h.indexOf(m[0])<h.indexOf('</head>'))){fail++;console.log('HATA',f,'js/'+m[2],'klasik betik defer olmadan: modül girişinden önce çalışır, köprülenen adları göremez')}}}
// Global ad çakışması (YOL_HARITASI.md O-15): bir sayfanın klasik betikleri tek global alanı paylaşır; iki dosyada aynı üst düzey
// var/function adı sessizce birbirinin üstüne yazar (sonraki kazanır), let/const/class çakışması sayfayı açılışta kırar.
// Modüllerin dışa aktardıkları köprüyle (js/kopru.js) window'a bağlanır; klasik betikte aynı ad da çakışmadır (köprülenen ada yazmak hata verir).
// Betikler sayfadaki sırayla tek bir boş bağlamda çalıştırılmadan bildirilir ("throw 0" ilk satırda: kod çalışmaz, bildirimler yine yapılır).
{const vm=require('vm');
  const bildir=(c,code)=>{try{vm.runInContext('throw 0;\n'+code,c)}catch(e){if(e!==0)return e.message}};
  for(const f of SAYFALAR){
    const h=fs.readFileSync(path.join(R,f),'utf8'),c=vm.createContext({}),kim=new Map();let i=0;
    for(const m of h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
      const s=/\bsrc="([^"]+)"/.exec(m[1]);if(s&&/^https?:/.test(s[1]))continue;
      const ad=s?s[1]:f+' script '+(i++),p=s&&path.join(R,s[1]);if(s&&!fs.existsSync(p))continue;
      if(/type="module"/.test(m[1])){   // giriş modülü: içe aktardığı modüllerin dışa aktardıkları köprülenir
        for(const x of iceAktarilan(path.basename(s[1])))if(x!=='kopru.js'&&x!==path.basename(s[1]))
          for(const a of Object.keys(require(path.join(J,x)))){if(kim.has(a)&&kim.get(a)!=='js/'+x){fail++;console.log('HATA',f,'global ad iki dosyada:',a,'('+kim.get(a)+', js/'+x+')')}else kim.set(a,'js/'+x)}
        continue;
      }
      const code=s?fs.readFileSync(p,'utf8'):m[2],ayri=vm.createContext({}),once=new Set(Object.getOwnPropertyNames(vm.runInContext('this',ayri)));
      bildir(ayri,code);
      for(const a of Object.getOwnPropertyNames(vm.runInContext('this',ayri)))if(!once.has(a)){if(kim.has(a)){fail++;console.log('HATA',f,'global ad iki dosyada:',a,'('+kim.get(a)+', '+ad+')')}else kim.set(a,ad)}
      const e=bildir(c,code);if(e){fail++;console.log('HATA',f,ad,'global ad çakışması (let/const/class):',e)}
    }
  }
}
console.log(n+' script bloğu/dosyası, '+fail+' hata');process.exit(fail?1:0);
