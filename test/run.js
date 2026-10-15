const fs=require('fs');
Object.assign(globalThis,require('./yukle.js'));global.L={buildIndex,analyze,summarize,buildBrands,findBrands,normText};
const db=JSON.parse(fs.readFileSync(__dirname+'/../data/e_kodlari.json'));
const bdb=JSON.parse(fs.readFileSync(__dirname+'/../data/bilesenler.json'));
const tg=JSON.parse(fs.readFileSync(__dirname+'/../data/tagsis.json'));
const idx=L.buildIndex(db,bdb);
module.exports={idx,L,tg};
if(require.main===module){
  const t=process.argv[2];
  const r=L.analyze(t,idx);
  console.log(r.map(x=>x.ids.join('+')+(x.may?' [may]':'')+(x.neg?' [neg]':'')+(x.aroma?' [aroma]':'')+' «'+x.text+'»').join('\n'));
  console.log(JSON.stringify(L.summarize(r,idx),null,1));
}
