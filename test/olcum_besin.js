// Besin tablosu ölçümü (A-02 4. adım; CI'da değil, CI test/besin.js ile yalnızca "yanlış renk yok" koşulunu denetler).
// Gerçek etiket setinde (test/veri/besin_etiketler.json) satır satır doğru / yanlış / boş sayısı ve yanlış renk gösterilen satırlar.
// Kullanım: node test/olcum_besin.js [--metin]   (--metin: değeri yanlış ya da tablosu bulunamayan etiketin OCR metnini de yazar)
const fs=require('fs'),path=require('path');
Object.assign(globalThis,require('./yukle.js'));global.B={BESIN_ALAN,besinAyristir,besinSozluk,besinGorunum,besinDuzey};
const S=B.besinSozluk(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','besin.json'),'utf8')));
const E=JSON.parse(fs.readFileSync(path.join(__dirname,'veri','besin_etiketler.json'),'utf8')).etiketler,metinYaz=process.argv.includes('--metin');
const say={yok:0,suphe:0,tamam:0,renkli:0,yanlisRenk:0},alan={};
for(const e of E){
  const r=B.besinAyristir(e.metin,S),c=e.porsiyon?100/e.porsiyon:1;
  if(!r){say.yok++;console.log(`${e.id}  tablo bulunamadı  (${e.ad})`);if(metinYaz)console.log(e.metin+'\n');continue}
  say[r.durum==='suphe'?'suphe':'tamam']++;
  const yanlis=[];
  B.BESIN_ALAN.forEach((a,i)=>{const d=e.d[i];if(d==null)return;const v=r.b[a],s=alan[a]=alan[a]||{dogru:0,yanlis:0,bos:0};
    if(v==null){s.bos++;yanlis.push(a+': boş')}else if(Math.abs(v-d*c)<=Math.max(0.011,d*c*0.005))s.dogru++;else{s.yanlis++;yanlis.push(`${a}: ${v} ≠ ${d}`)}});
  const g=B.besinGorunum({b:r.b,lt:r.lt,birim:r.birim,sorun:r.sorun,por:r.por}),renk=!!(g&&g.renk),kotu=[];
  if(renk){say.renkli++;for(const s of g.satir){if(!s.duzey)continue;const d=e.d[B.BESIN_ALAN.indexOf(s.alan)];
    if(d==null||B.besinDuzey(s.alan,d*c,false,e.birim||'g')!==s.duzey)kotu.push(s.alan)}}
  if(kotu.length)say.yanlisRenk++;
  console.log(`${e.id}  ${r.durum}${renk?' renkli':''}${kotu.length?' YANLIŞ RENK: '+kotu.join(', '):''}  ${yanlis.join('; ')||'hepsi doğru'}  [${r.sorun.join(', ')}]  (${e.ad})`);
  if(metinYaz&&yanlis.length)console.log(e.metin+'\n');
}
console.log(`\n${E.length} etiket: tablo bulunamadı ${say.yok}, şüpheli ${say.suphe}, tamam ${say.tamam}; renk gösterilen ${say.renkli}, yanlış renkli ${say.yanlisRenk}`);
for(const a of B.BESIN_ALAN)if(alan[a])console.log(`  ${a.padEnd(8)} doğru ${alan[a].dogru}  yanlış ${alan[a].yanlis}  boş ${alan[a].bos}`);
