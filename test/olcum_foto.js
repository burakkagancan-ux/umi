// Ölçüm (A-04): otomatik kırpma önerisi (js/foto.js icerikBolge) fotoğrafın bütün metnine göre gıda sonucunu iyileştiriyor mu.
// Çalıştır: node test/olcum_foto.js [set.json]   (varsayılan test/veri/foto_sentetik.json; CI eşiği test/foto.js'te)
// Her etiket: Worker'ın gerçek Vision yanıtı (metin + sözcük kutuları), etiketin temiz içerik listesi ve varsa listenin dışındaki alerjen iz uyarısı (iz).
// Referans: liste + iz uyarısının analizi (iz uyarısı ürüne aittir; kırpma onu kaybetmemeli).
// "Fazla": referansta olmayan alerjen (içerir/içerebilir) ya da dikkat/uyarı seviyeli E kodu (başka bölümden gelen gürültü).
// "Eksik": referanstaki alerjen ya da E kodunun bulunmaması (kırpma listeyi kesti).
Object.assign(globalThis,require('./yukle.js'));
const {idx}=require('./run.js');
const bulP=tx=>kirpBulgu(degerlendir('gida',tx,{idx},null,''));
function bulgu(metin){
  const res=analyze(metin,idx),S=summarize(res,idx),b=new Set();
  for(const k of Object.keys(S.allergen)){const a=S.allergen[k];if(a.yes.length)b.add('alerjen:'+k.replace('allergen_',''));else if(a.may.length)b.add('alerjen:'+k.replace('allergen_','')+'?')}
  res.filter(r=>!r.isB&&!r.neg&&r.rank>=2).forEach(r=>b.add(r.ids.join('/')));
  return b;
}
function fark(a,ref){return {fazla:[...a].filter(x=>!ref.has(x)),eksik:[...ref].filter(x=>!a.has(x))}}
function olc(set){
  const o={etiket:[],tam:{fazla:0,eksik:0},oneri:{fazla:0,eksik:0},bulunan:0,toplam:0};
  for(const e of set){
    const V=e.vision;if(!V||!V.text)continue;o.toplam++;
    const ref=bulgu(e.icerik+(e.iz?'\n'+e.iz:'')),tam=fark(bulgu(V.text),ref),pl=kirpPlan(V,'tr',true),G=pl&&kirpGuvenli(pl,bulP),B=G&&G.ok?pl.B:null,on=B?fark(bulgu(pl.metin),ref):tam;
    if(B)o.bulunan++;
    o.tam.fazla+=tam.fazla.length;o.tam.eksik+=tam.eksik.length;o.oneri.fazla+=on.fazla.length;o.oneri.eksik+=on.eksik.length;
    o.etiket.push({ad:e.ad,bolge:!!B,tam,oneri:on,metin:B&&pl.metin,engel:G&&!G.ok?G.eksik:null});
  }
  return o;
}
module.exports={olc,bulgu};
if(require.main===module){
  const set=require(process.argv[2]?require('path').resolve(process.argv[2]):'./veri/foto_sentetik.json').etiketler;
  const o=olc(set);
  for(const e of o.etiket)console.log(`${e.ad}: öneri ${e.bolge?'var':'YOK'+(e.engel?' (güvenlik: '+e.engel+')':'')} | tüm metin fazla [${e.tam.fazla}] eksik [${e.tam.eksik}] | öneri fazla [${e.oneri.fazla}] eksik [${e.oneri.eksik}]`);
  console.log(`\n${o.toplam} etiket, öneri ${o.bulunan}; tüm metin: ${o.tam.fazla} fazla, ${o.tam.eksik} eksik; öneriyle: ${o.oneri.fazla} fazla, ${o.oneri.eksik} eksik`);
}
