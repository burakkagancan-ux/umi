// Mutasyon ölçümü (20.10.2026; belgeler/mimari/testler.md "Mutasyon ölçümü"): testler gerçekten hata yakalıyor mu?
// Bir kaynak dosyaya tek tek küçük hatalar sokulur (=== → !==, < → <=, && → ||, true → false, ! silinir, +1 → -1),
// her birinde test komutu çalıştırılır. Test düşerse hata "yakalandı"; geçerse "kaçtı": o satırı hiçbir test sınamıyor.
// Kaçanlar ipucudur, hata değildir: bazı değişiklikler davranışı gerçekten değiştirmez (eşdeğer mutasyon).
// Depo geçici bir kopyada değiştirilir; asıl dosyalara dokunulmaz. CI'da değil (dakikalar sürer).
// Kullanım: node test/olcum_mutasyon.js js/besin.js [--test "node test/besin.js"] [--en-cok 150] [--tohum 1]
//   --test verilmezse bütün birim testleri (node test/hepsi.js, ~2 sn/mutasyon). Çıkış kodu her zaman 0 (ölçüm).
const fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process');
const K=path.join(__dirname,'..');
const arg=process.argv.slice(2),sec=(ad,v)=>{const i=arg.indexOf(ad);return i>-1?arg[i+1]:v};
const hedef=arg[0];
if(!hedef||hedef.startsWith('--')||!fs.existsSync(path.join(K,hedef))){console.log('Kullanım: node test/olcum_mutasyon.js <dosya> [--test "komut"] [--en-cok N] [--tohum N]');process.exit(0)}
const komut=sec('--test','node test/hepsi.js'),enCok=+sec('--en-cok',150),tohum=+sec('--tohum',1);

const KURAL=[
  [/===/g,'!=='],[/!==/g,'==='],[/<=/g,'<'],[/>=/g,'>'],[/(?<![<=!>])<(?![=<])/g,'<='],[/(?<![-=>])>(?![=>])/g,'>='],
  [/&&/g,'||'],[/\|\|/g,'&&'],[/\btrue\b/g,'false'],[/\bfalse\b/g,'true'],[/!(?=[\w($])/g,''],[/\+\s*1\b/g,'-1'],[/-\s*1\b/g,'+1'],
];
// Satırda konum dize/regex/yorum içinde mi (kaba: tırnak sayısı ve // sonrası)
function kodMu(satir,i){
  const once=satir.slice(0,i),yorum=once.indexOf('//');
  if(yorum>-1&&!/['"`]/.test(once.slice(0,yorum).replace(/(['"`])(?:\\.|(?!\1).)*\1/g,'')))return false;
  for(const q of ["'",'"','`'])if((once.match(new RegExp('(?<!\\\\)'+q,'g'))||[]).length%2)return false;
  return true;
}
const kaynak=fs.readFileSync(path.join(K,hedef),'utf8'),satirlar=kaynak.split('\n');
let adaylar=[],blok=false;
satirlar.forEach((s,no)=>{
  const t=s.trim();
  if(blok){if(t.includes('*/'))blok=false;return}
  if(t.startsWith('/*')){if(!t.includes('*/'))blok=true;return}
  if(t.startsWith('//')||t.startsWith('*')||/^(import|export\s+\{)/.test(t))return;
  for(const [re,yeni] of KURAL){re.lastIndex=0;let m;while((m=re.exec(s))){if(kodMu(s,m.index))adaylar.push({no,i:m.index,eski:m[0],yeni})}}
});
// Belirlenimli örneklem (aynı tohum aynı mutasyonları seçer; öncesi/sonrası karşılaştırılabilir)
let r=tohum;const rnd=()=>(r=(r*1103515245+12345)%2147483648)/2147483648;
const toplamAday=adaylar.length;
if(adaylar.length>enCok){for(let i=adaylar.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[adaylar[i],adaylar[j]]=[adaylar[j],adaylar[i]]}adaylar=adaylar.slice(0,enCok).sort((a,b)=>a.no-b.no||a.i-b.i)}

// Geçici kopya (.git ve node_modules hariç; node_modules bağlanır)
const T=fs.mkdtempSync(path.join(os.tmpdir(),'umi-mutasyon-'));
fs.cpSync(K,T,{recursive:true,filter:k=>!/[\\/](\.git|node_modules)$/.test(k)});
if(fs.existsSync(path.join(K,'node_modules')))fs.symlinkSync(path.join(K,'node_modules'),path.join(T,'node_modules'));
const calistir=()=>spawnSync('sh',['-c',komut],{cwd:T,encoding:'utf8',timeout:120000}).status;
const yol=path.join(T,hedef);
if(calistir()!==0){console.log('Test komutu değiştirilmemiş kodda da düşüyor; önce testler geçmeli: '+komut);fs.rmSync(T,{recursive:true,force:true});process.exit(0)}

const bas=Date.now();let yakalandi=0,gecersiz=0;const kacan=[];
adaylar.forEach((a,k)=>{
  const ss=satirlar.slice();ss[a.no]=ss[a.no].slice(0,a.i)+a.yeni+ss[a.no].slice(a.i+a.eski.length);
  fs.writeFileSync(yol,ss.join('\n'));
  if(spawnSync('node',['--check',yol]).status!==0){gecersiz++;return}
  if(calistir()!==0)yakalandi++;else kacan.push(a);
  if((k+1)%25===0)process.stderr.write(`${k+1}/${adaylar.length}\n`);
});
fs.rmSync(T,{recursive:true,force:true});
const gecerli=adaylar.length-gecersiz;
console.log(`${hedef}: ${toplamAday} olası mutasyondan ${adaylar.length} denendi (${gecersiz} sözdizimi bozuk, sayılmadı); komut: ${komut}`);
for(const a of kacan)console.log(`KAÇTI ${hedef}:${a.no+1}  ${a.eski} → ${a.yeni || '(silindi)'}  | ${satirlar[a.no].trim().slice(0,100)}`);
console.log(`Yakalanan: ${yakalandi}/${gecerli} (%${gecerli?Math.round(100*yakalandi/gecerli):0}), kaçan ${kacan.length}; ${((Date.now()-bas)/1000).toFixed(0)} sn`);
