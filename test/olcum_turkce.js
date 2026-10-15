// Türkçe etiket derleminin analiz sonuçlarını yazar ya da kayıtlı anlık görüntüyle karşılaştırır (CI'da değil).
// Kullanım: node test/olcum_turkce.js [kök klasör]   → sonuçları JSON olarak yazar (stdout)
//           node test/olcum_turkce.js --fark a.json b.json → iki çıktı arasındaki farkları listeler
// Derlem: test/veri/turkce_etiketler.json + test/*.js içinde analyze()'a giden Türkçe dizgeler.
const fs=require('fs'),path=require('path');
if(process.argv[2]==='--fark'){
  const a=JSON.parse(fs.readFileSync(process.argv[3])),b=JSON.parse(fs.readFileSync(process.argv[4]));let n=0;
  for(const k of Object.keys(a)){const x=a[k],y=b[k]||[];const yeni=y.filter(v=>!x.includes(v)),kayip=x.filter(v=>!y.includes(v));
    if(yeni.length||kayip.length){n++;console.log('• '+k.slice(0,140)+'\n   yeni: '+(yeni.join(', ')||'—')+'\n   kaybolan: '+(kayip.join(', ')||'—'))}}
  console.log(`\n${Object.keys(a).length} metin, ${n} metinde fark`);process.exit(0);
}
const kok=path.resolve(process.argv[2]||path.join(__dirname,'..'));
// Kök başka bir çalışma kopyası olabilir (öncesi/sonrası karşılaştırması): js/ ES modülüyse (15.10.2026 sonrası) içe aktarılır, değilse eski yolla birleştirilip çalıştırılır
const trSoz=JSON.parse(fs.readFileSync(path.join(kok,'i18n','tr.json'),'utf8')),trBilgi={tr:{ad:"Türkçe",yon:"ltr",yerel:"tr-TR"}};
if(/^\s*export /m.test(fs.readFileSync(path.join(kok,'js','gida.js'),'utf8'))){
  const C=require(path.join(kok,'js','ceviri.js'));C.dilKur('tr',{tr:trSoz},trBilgi,{tr:{}});global.G=require(path.join(kok,'js','gida.js'));
}else{
  const js=['ceviri','ortak','gida'].map(f=>fs.readFileSync(path.join(kok,'js',f+'.js'),'utf8')).join('\n');
  eval(js+';dilKur("tr",'+JSON.stringify({tr:trSoz})+','+JSON.stringify(trBilgi)+',{tr:{}});global.G={analyze,buildIndex,summarize}');
}
const db=JSON.parse(fs.readFileSync(path.join(kok,'data','e_kodlari.json'))),bdb=JSON.parse(fs.readFileSync(path.join(kok,'data','bilesenler.json')));
const idx=G.buildIndex(db,bdb);
const D=JSON.parse(fs.readFileSync(path.join(__dirname,'veri','turkce_etiketler.json'))).etiketler.slice();
// Testlerdeki gıda metinleri (yalnızca Türkçe harf içeren ya da "İçindekiler" geçen dizgeler)
for(const f of ['cases.js','ocr_tolerans.js','sodyum.js','eslesme.js','kanser.js','karsilastir.js','paylas.js']){
  const s=fs.readFileSync(path.join(__dirname,f),'utf8');
  for(const m of s.matchAll(/(["'`])((?:(?!\1)[^\\\n]|\\.){12,}?)\1/g)){const v=m[2];if(/[çğışöüÇĞİŞÖÜ]/.test(v)&&/[ ,]/.test(v)&&!/\$\{/.test(v)&&!D.includes(v))D.push(v)}
}
const out={};
for(const t of D){const res=G.analyze(t,idx),S=G.summarize(res,idx);
  out[t]=[...new Set(res.map(r=>r.ids.join('/')+(r.how==='benzer'?'~benzer':'')+(r.may?'~may':'')+(r.neg?'~neg':'')+(r.aroma?'~aroma':'')+(r.isB?'':'#'+r.rank)))].sort()
    .concat(Object.keys(S.allergen).sort().map(k=>'AL:'+k.replace('allergen_','')+(S.allergen[k].yes.length?'':'~may')))}
console.log(JSON.stringify(out,null,0));
