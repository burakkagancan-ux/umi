// Saf mantık modüllerini (js/, ES modülü) yükler ve bütün dışa aktarımlarını tek nesnede verir; testler buradan alır.
// Çeviri: Türkçe sözlük (i18n/tr.json) ve İngilizce yedek kurulur; başka dil için DIL_TEST ortam değişkeni (ör. DIL_TEST=en)
// ya da dilYukle(kod). Modüller tekildir: dil değiştirmek bütün modülleri etkiler (tarayıcıdaki gibi).
// Kullanım: const L=require('./yukle.js'); L.analyze(...)   ya da   Object.assign(globalThis,require('./yukle.js'))
const fs=require('fs'),path=require('path');
const I=path.join(__dirname,'..','i18n');
const MODULLER=['ceviri','ortak','gida','kozmetik','eslesme','temizlik','degerlendirme','karsilastir_ayar','karsilastir','paylas_ayar','paylas','kayit','besin','barkod','rozet','topluluk','ansiklopedi'];
const L={};
for(const f of MODULLER)Object.assign(L,require(path.join(__dirname,'..','js',f+'.js')));
const oku=k=>{const p=path.join(I,k+'.json');return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{}};
const bilgi=fs.existsSync(path.join(I,'diller.json'))?JSON.parse(fs.readFileSync(path.join(I,'diller.json'),'utf8')).diller:{};
// Seçili dil + İngilizce + Türkçe sözlükleri ve seçili dilin veri çevirisi (i18n/veri/<dil>.json)
function dilYukle(dil){
  const sozluk={};for(const k of new Set(['tr','en',dil]))sozluk[k]=oku(k);
  const vp=path.join(I,'veri',dil+'.json'),veri={};veri[dil]=fs.existsSync(vp)?JSON.parse(fs.readFileSync(vp,'utf8')):{};
  L.dilKur(dil,sozluk,bilgi,veri);
}
dilYukle(process.env.DIL_TEST||'tr');
L.dilYukle=dilYukle;
module.exports=L;
