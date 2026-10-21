// Çevrimdışı açılış: sayfaların ve arayüz kodunun yüklediği her yerel dosya sw.js CORE listesinde olmalı. Dile ve sayfaya bağlı dosyalar
// (seçili dil, ansiklopedi madde sayfaları) CORE'da olmaz, sayfa açılınca iner (sw.js DINAMIK). Kurulumda inen toplam boyut bütçeyi aşmaz.
// Çalıştır: node test/onbellek.js
const fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
const sw=fs.readFileSync(path.join(R,'sw.js'),'utf8'),core=new Set((/const CORE = \[([\s\S]*?)\];/.exec(sw)[1].match(/"([^"]+)"/g)||[]).map(s=>s.slice(1,-1)));
const want=new Set();
['index.html','ocr.html','ansiklopedi.html','yontem.html'].forEach(p=>{
  want.add(p);
  for(const m of fs.readFileSync(path.join(R,p),'utf8').matchAll(/(?:src|href)="((?:js|fonts|data)\/[^"]+|[a-z_]+\.(?:css|webmanifest))"/g))want.add(m[1]);
});
fs.readdirSync(path.join(R,'js')).filter(f=>f.endsWith('.js')).forEach(f=>{
  for(const m of fs.readFileSync(path.join(R,'js',f),'utf8').matchAll(/"(data\/[a-z_]+\.json)"/g))want.add(m[1]);
});
// Kaynak dil (Türkçe, her dilin son yedeği) ve dil listesi kurulumda iner; öteki dillerin dosyaları ve madde sayfaları inmez, DINAMIK'e uyar
['i18n/diller.json','i18n/tr.json','data/ansiklopedi_tr.json'].forEach(f=>want.add(f));
const DIN=eval(/const DINAMIK = (\/.*\/);/.exec(sw)[1]),dinamik=[];
const ls=d=>fs.existsSync(path.join(R,d))?fs.readdirSync(path.join(R,d),{withFileTypes:true}):[];
ls('i18n').forEach(e=>{if(e.isFile()&&e.name.endsWith('.json')&&e.name!=='diller.json'&&e.name!=='tr.json')dinamik.push('i18n/'+e.name)});
ls('i18n/manifest').forEach(e=>{if(e.name.endsWith('.webmanifest'))dinamik.push('i18n/manifest/'+e.name)});
ls('i18n/veri').forEach(e=>{if(e.name.endsWith('.json'))dinamik.push('i18n/veri/'+e.name)});
ls('data').forEach(e=>{if(/^ansiklopedi_[a-z-]+\.json$/.test(e.name)&&e.name!=='ansiklopedi_tr.json')dinamik.push('data/'+e.name)});
(function gez(d){ls(d).forEach(e=>e.isDirectory()?gez(d+'/'+e.name):dinamik.push(d+'/'+e.name))})('data/ansiklopedi');
ok(dinamik.includes('i18n/en.json')&&dinamik.includes('data/ansiklopedi/E322.json')&&dinamik.includes('data/ansiklopedi/tr/E322.json'),'dinamik dosya listesi eksik');
dinamik.forEach(f=>{ok(!core.has(f),'dile ya da sayfaya bağlı dosya kurulumda inmemeli: '+f);ok(DIN.test(f),'sw.js DINAMIK önbelleğe almıyor: '+f)});
// İstek geldikçe önbelleğe alınanlar (kurulumu büyütmesin): barkod verisi (Open Food Facts) ve iOS barkod kütüphanesi
const ISTEKLE=new Set(['data/barkod_off.json']);ISTEKLE.forEach(f=>want.delete(f));
want.forEach(f=>{ok(core.has(f),'sw.js CORE listesinde yok: '+f);ok(fs.existsSync(path.join(R,f)),'dosya yok: '+f)});
core.forEach(f=>{if(f!=='./')ok(fs.existsSync(path.join(R,f)),'CORE listesindeki dosya yok: '+f)});
// Boyut bütçesi: kurulumda inen toplam. Aşılırsa önce dosyayı bölmeyi düşünün (YOL_HARITASI.md O-10); bütçe bilerek artırılır.
const BUTCE=4.5*1048576;let top=0;core.forEach(f=>{if(f!=='./'&&fs.existsSync(path.join(R,f)))top+=fs.statSync(path.join(R,f)).size});
ok(top<=BUTCE,'kurulumda inen toplam '+(top/1048576).toFixed(2)+' MB, bütçe '+(BUTCE/1048576)+' MB');
console.log('kurulumda inen: '+(top/1048576).toFixed(2)+' MB / '+(BUTCE/1048576)+' MB');
console.log(n+' önbellek denetimi, '+fail+' hata');process.exit(fail?1:0);
