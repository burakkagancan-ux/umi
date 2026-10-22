// Ölçüm (A-02 / O-27): besin tablosunu sözcük kutularının konumundan kurmak (js/besin.js besinKonumSec) okuma oranını artırıyor mu.
// Set: test/veri/besin_sentetik.json (yapay etiketler, gerçek Vision yanıtı; test/uret_besin_sentetik.js). Her etikette eski yol (yalnızca
// Vision metni) ile yeni yol (konumdan seçilen metin) yan yana: tablo durumu, doğru / yanlış / boş satır, renk ve yanlış renk.
// Kullanım: node test/olcum_besin_konum.js [set.json] [--metin]   (--metin: yeni yolda yanlış ya da şüpheli kalan etiketin metni)
// CI eşiği test/besin.js'te ("Konumdan tablo").
const fs=require('fs'),path=require('path');
Object.assign(globalThis,require('./yukle.js'));
const S=besinSozluk(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','besin.json'),'utf8')));

function degerlendir(metin,e){
  const r=besinAyristir(metin,S),o={durum:r?r.durum:'yok',dogru:0,yanlis:[],bos:0,renk:false,yanlisRenk:[],sorun:r?r.sorun:[]};
  if(!r)return o;
  BESIN_ALAN.forEach((a,i)=>{const d=e.d[i];if(d==null)return;const v=r.b[a];
    if(v==null)o.bos++;else if(Math.abs(v-d)<=Math.max(0.011,d*0.005))o.dogru++;else o.yanlis.push(`${a}: ${v} ≠ ${d}`)});
  const g=besinGorunum({b:r.b,lt:r.lt,birim:r.birim,sorun:r.sorun,por:r.por});
  if(g&&g.renk){o.renk=true;for(const s of g.satir){if(!s.duzey)continue;const d=e.d[BESIN_ALAN.indexOf(s.alan)];
    if(d==null||besinDuzey(s.alan,d,false,e.birim||'g')!==s.duzey)o.yanlisRenk.push(s.alan)}}
  return o;
}
function olc(E){
  const top={eski:{renk:0,yanlisRenk:0,dogru:0,yanlis:0},yeni:{renk:0,yanlisRenk:0,dogru:0,yanlis:0},degisen:0,satir:[]};
  for(const e of E){
    const V=e.vision,tx=V.text||'',yeni=besinKonumSec(tx,V,S),a=degerlendir(tx,e),b=degerlendir(yeni,e);
    if(yeni!==tx)top.degisen++;
    for(const [k,o] of [['eski',a],['yeni',b]]){top[k].renk+=o.renk;top[k].yanlisRenk+=o.yanlisRenk.length>0;top[k].dogru+=o.dogru;top[k].yanlis+=o.yanlis.length}
    top.satir.push({e,a,b,yeni,degisti:yeni!==tx});
  }
  return top;
}
module.exports={olc};
if(require.main===module){
  const arg=process.argv.slice(2),dosya=arg.find(x=>!x.startsWith('--'))||path.join(__dirname,'veri','besin_sentetik.json');
  const E=JSON.parse(fs.readFileSync(dosya,'utf8')).etiketler.filter(e=>e.d&&e.vision),T=olc(E),yaz=o=>`${o.durum}${o.renk?' renkli':''}${o.yanlisRenk.length?' YANLIŞ RENK: '+o.yanlisRenk.join(','):''} ${o.dogru} doğru${o.yanlis.length?', yanlış '+o.yanlis.join('; '):''}${o.bos?', boş '+o.bos:''}${o.sorun.length?' ['+o.sorun.join(',')+']':''}`;
  for(const s of T.satir){
    console.log(`${s.e.ad.padEnd(34)} eski: ${yaz(s.a)}\n${''.padEnd(34)} yeni: ${yaz(s.b)}${s.degisti?'  (konumdan)':''}`);
    if(arg.includes('--metin')&&(s.b.durum!=='tamam'||s.b.yanlis.length))console.log(s.yeni+'\n');
  }
  console.log(`\n${E.length} etiket, konumdan kurulan ${T.degisen}`);
  for(const k of ['eski','yeni'])console.log(`  ${k}: renk gösterilen ${T[k].renk}, yanlış renkli ${T[k].yanlisRenk}, doğru satır ${T[k].dogru}, yanlış satır ${T[k].yanlis}`);
}
