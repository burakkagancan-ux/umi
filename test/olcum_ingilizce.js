// Ölçüm: İngilizce gıda etiketlerinde içerik, alerjen ve E kodu tanıma; yanlış uyarı sayısı. Çalıştır: node test/olcum_ingilizce.js
// Set: test/veri/ingilizce_etiketler.json (30 etiket: 10 İngiltere/AB, 10 ABD, 10 zor durum). CI'daki eşik denetimi test/ingilizce.js'te (aynı olc() işlevi).
// İçerik parçası: içerik listesinin ayraç dışındaki virgülle ayrılmış öğesi; içinde en az bir madde eşleştiyse tanınmış sayılır.
// Yanlış uyarı: beklenmeyen alerjen (içerir ya da içerebilir) ve beklenmeyen dikkat/uyarı seviyeli E kodu; beklenen kod beklenenden yüksek seviyeyle de sayılır.
Object.assign(globalThis,require('./yukle.js'));global.G={analyze,summarize,buildIndex,normText,cmpSegments};
const {idx}=require('./run.js');
const SET=require(process.argv[2]&&require.main===module?require('path').resolve(process.argv[2]):'./veri/ingilizce_etiketler.json').etiketler;   // başka set: node test/olcum_ingilizce.js test/veri/ingilizce_kor.json
function olc(etiketler){
  const o={parca:[0,0],alerjen:[0,0],alerjenTur:[0,0],kod:[0,0],yanlis:[],kayipParca:{},etiket:[]};
  for(const e of etiketler||SET){
    const res=G.analyze(e.m,idx),S=G.summarize(res,idx),tok=G.normText(e.m).split(' ').filter(Boolean),seg=G.cmpSegments(tok);
    const pos=[].concat(...res.map(r=>r.poslar||[r.pos]));
    const hit=seg.filter(s=>pos.some(p=>p>=s[0]&&p<s[1]));
    const miss=seg.filter(s=>!hit.includes(s)).map(s=>tok.slice(s[0],s[1]).filter(w=>w!=='|'&&w!=='('&&w!==')').join(' '));
    miss.forEach(m=>o.kayipParca[m]=(o.kayipParca[m]||0)+1);
    o.parca[0]+=hit.length;o.parca[1]+=seg.length;
    const bul={};for(const k of Object.keys(S.allergen)){const a=S.allergen[k];if(a.yes.length||a.may.length)bul[k.replace('allergen_','')]=a.yes.length?'yes':'may'}
    const al=Object.keys(e.al),alBul=al.filter(k=>bul[k]),alTur=al.filter(k=>bul[k]===e.al[k]);
    o.alerjen[0]+=alBul.length;o.alerjen[1]+=al.length;o.alerjenTur[0]+=alTur.length;o.alerjenTur[1]+=al.length;
    const yan=[];
    for(const k of Object.keys(bul))if(!e.al[k])yan.push('alerjen '+k+' ('+bul[k]+')');
    const E=res.filter(r=>!r.isB&&!r.neg),kod={};E.forEach(r=>{const k=r.ids.join('/');kod[k]=Math.max(kod[k]===undefined?-1:kod[k],r.rank)});
    const bek=Object.keys(e.e),kodBul=bek.filter(k=>kod[k]!==undefined);
    o.kod[0]+=kodBul.length;o.kod[1]+=bek.length;
    for(const k of Object.keys(kod)){
      if(e.e[k]===undefined){if(kod[k]>=2)yan.push(k+' seviye '+kod[k]+' (beklenmiyordu)')}
      else if(kod[k]>e.e[k])yan.push(k+' seviye '+kod[k]+' (beklenen '+e.e[k]+')');
    }
    yan.forEach(y=>o.yanlis.push(e.ad+': '+y));
    o.etiket.push({ad:e.ad,grup:e.grup,parca:[hit.length,seg.length],miss,alEksik:al.filter(k=>!bul[k]),alTur:al.filter(k=>bul[k]&&bul[k]!==e.al[k]).map(k=>k+' '+bul[k]+'≠'+e.al[k]),
      kodEksik:bek.filter(k=>kod[k]===undefined),kodFazla:Object.keys(kod).filter(k=>e.e[k]===undefined),yan,res});
  }
  o.oran={parca:o.parca[0]/o.parca[1],alerjen:o.alerjen[1]?o.alerjen[0]/o.alerjen[1]:1,kod:o.kod[1]?o.kod[0]/o.kod[1]:1};
  return o;
}
module.exports={olc,SET};
if(require.main===module){
  const o=olc(),y=x=>'%'+Math.round(x*100);
  for(const e of o.etiket){
    console.log(`[${e.grup}] ${e.ad}: parça ${e.parca[0]}/${e.parca[1]}`+(e.alEksik.length?'; eksik alerjen: '+e.alEksik.join(', '):'')+(e.alTur.length?'; alerjen türü: '+e.alTur.join(', '):'')+
      (e.kodEksik.length?'; eksik kod: '+e.kodEksik.join(', '):'')+(e.kodFazla.length?'; beklenmeyen kod: '+e.kodFazla.join(', '):'')+(e.yan.length?'; YANLIŞ UYARI: '+e.yan.join(', '):''));
    console.log('  bulunan: '+[...new Set(e.res.map(r=>r.ids.join('/')+(r.neg?'~olumsuz':'')+(r.may?'~içerebilir':'')+(r.how==='benzer'?'~benzer':'')))].join(', '));
  }
  for(const g of [...new Set(SET.map(e=>e.grup))]){const s=olc(SET.filter(e=>e.grup===g));console.log(`${g}: parça ${y(s.oran.parca)}, alerjen ${y(s.oran.alerjen)}, E kodu ${y(s.oran.kod)}, yanlış uyarı ${s.yanlis.length}`)}
  console.log(`\nToplam (${SET.length} etiket): parça ${o.parca[0]}/${o.parca[1]} (${y(o.oran.parca)}), alerjen ${o.alerjen[0]}/${o.alerjen[1]} (${y(o.oran.alerjen)}; türü doğru ${o.alerjenTur[0]}), E kodu ${o.kod[0]}/${o.kod[1]} (${y(o.oran.kod)}), yanlış uyarı ${o.yanlis.length}`);
  if(o.yanlis.length)console.log('Yanlış uyarılar: '+o.yanlis.join(' | '));
  console.log('Tanınmayan parçalar: '+Object.keys(o.kayipParca).sort().join(' | '));
}
