// Bütün birim testlerini bulur ve paralel çalıştırır (CI "test" işi). Yeni test dosyası eklemek için başka bir yere yazmak gerekmez.
// Kapsam: test/*.js (yardımcılar ve ölçüm betikleri hariç), test/*.py, worker/test*.mjs. Tarayıcı testi ayrı: node test/arayuz.js
// Kullanım: node test/hepsi.js [ad süzgeci …]   ör. node test/hepsi.js besin barkod
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const K=path.join(__dirname,'..');
// Test olmayan dosyalar: yükleyici, komut satırı aracı, ölçüm raporları, tarayıcı testi
const DEGIL=new Set(['hepsi.js','yukle.js','run.js','arayuz.js']);
const testler=[
  ...fs.readdirSync(__dirname).filter(f=>f.endsWith('.js')&&!DEGIL.has(f)&&!f.startsWith('olcum_')).map(f=>['node',path.join('test',f)]),
  ...fs.readdirSync(__dirname).filter(f=>f.endsWith('.py')).map(f=>['python3',path.join('test',f)]),
  ...fs.readdirSync(path.join(K,'worker')).filter(f=>/^test.*\.mjs$/.test(f)).map(f=>['node',path.join('worker',f)]),
].filter(([,f])=>process.argv.length<3||process.argv.slice(2).some(s=>f.includes(s)));

function calistir([kom,dosya]){
  return new Promise(son=>{
    const bas=Date.now(),c=spawn(kom,[dosya],{cwd:K});let cikti='';
    c.stdout.on('data',d=>cikti+=d);c.stderr.on('data',d=>cikti+=d);
    c.on('close',kod=>son({dosya,kod,cikti,sure:Date.now()-bas}));
  });
}
(async()=>{
  const bas=Date.now(),kuyruk=testler.slice(),sonuc=[];
  await Promise.all(Array.from({length:Math.max(2,os.cpus().length)},async()=>{while(kuyruk.length)sonuc.push(await calistir(kuyruk.shift()))}));
  sonuc.sort((a,b)=>a.dosya.localeCompare(b.dosya));
  const kotu=sonuc.filter(x=>x.kod!==0);
  for(const x of sonuc){const s=x.cikti.trim().split('\n').pop()||'';console.log((x.kod?'HATA ':'tamam')+'  '+x.dosya.padEnd(30)+(x.sure/1000).toFixed(1).padStart(5)+' sn  '+s.slice(0,110))}
  for(const x of kotu)console.log('\n===== '+x.dosya+' (çıkış '+x.kod+') =====\n'+x.cikti.trim());
  console.log(`\n${sonuc.length} test dosyası, ${kotu.length} hatalı, ${((Date.now()-bas)/1000).toFixed(1)} sn`);
  process.exit(kotu.length?1:0);
})();
