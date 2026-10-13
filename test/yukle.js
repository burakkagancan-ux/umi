// ocr.html'nin saf mantık dosyalarını (js/) sayfadaki sırayla birleştirir; testler bu metni eval ile yükler.
// Çeviri: js/ceviri.js önce yüklenir ve Türkçe sözlük (i18n/tr.json) kurulur; başka dil için DIL_TEST ortam değişkeni (ör. DIL_TEST=en).
const fs=require('fs'),path=require('path');
const dil=process.env.DIL_TEST||'tr',I=path.join(__dirname,'..','i18n');
const oku=k=>{const p=path.join(I,k+'.json');return fs.existsSync(p)?fs.readFileSync(p,'utf8'):'{}'};
const sozluk='{'+[...new Set(['tr','en',dil])].map(k=>JSON.stringify(k)+':'+oku(k)).join(',')+'}';
const bilgi=fs.existsSync(path.join(I,'diller.json'))?fs.readFileSync(path.join(I,'diller.json'),'utf8'):'{"diller":{}}';
const veri=fs.existsSync(path.join(I,'veri',dil+'.json'))?fs.readFileSync(path.join(I,'veri',dil+'.json'),'utf8'):'{}';
module.exports=['ceviri','ortak','gida','kozmetik','eslesme','temizlik','karsilastir_ayar','karsilastir','paylas_ayar','paylas','kayit','besin','barkod'].map(f=>fs.readFileSync(__dirname+'/../js/'+f+'.js','utf8')).join('\n')+
  '\n;dilKur('+JSON.stringify(dil)+','+sozluk+',('+bilgi+').diller,{'+JSON.stringify(dil)+':'+veri+'});\n';
