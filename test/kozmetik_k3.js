// Kozmetik K3 (AB dışı yasaklar, AB olası endokrin bozucu listesi) testleri. Çalıştır: node test/kozmetik_k3.js
const {K,KL}=require('./kozmetik_cases.js');
const fs=require('fs');
const kdb=JSON.parse(fs.readFileSync(__dirname+'/../data/kozmetik.json'));
let fail=0,n=0;
function ok(c,msg){n++;if(!c){fail++;console.log('HATA',msg)}}
function norm(s){return s.replace(/İ/g,"i").replace(/I/g,"ı").toLowerCase().replace(/[çğıöşüâîû]/g,c=>({ç:"c",ğ:"g",ı:"i",ö:"o",ş:"s",ü:"u",â:"a",î:"i",û:"u"})[c]).replace(/[^a-z0-9]+/g," ").trim()}

// Veri bütünlüğü (kdb ayrı okunduğu için nesneler değil alanlar karşılaştırılır)
const WL=kdb.meta.watch_lists;
ok(Array.isArray(kdb.watch)&&kdb.watch.length>=70,'watch kayıt sayısı '+(kdb.watch||[]).length);
kdb.watch.forEach(w=>{
  ok(WL[w.list],'bilinmeyen liste '+w.list);
  ok(/^https:\/\//.test(w.source||''),'kaynak yok '+w.inci);
  ok(w.inci.length>0,'INCI yok '+JSON.stringify(w));
  w.inci.forEach(a=>ok(K.map.has(norm(a))&&K.map.get(norm(a)).k3.some(x=>x.list===w.list&&x.date===w.date&&x.inci.join()===w.inci.join()),'indekste yok '+a));
});
['yellow','orange'].forEach(l=>ok(Object.values(WL).some(x=>x.level===l),'seviye eksik '+l));
ok(WL.ca.level==='orange'&&WL.asean.level==='orange'&&WL.ab_ed_a.level==='yellow'&&WL.ab_ed_b.level==='yellow','renk kararı (kademeli)');

// [metin, {ad: [seviye, beklenen liste(ler)]}, özet denetimi]
const cases=[
 // Salicylic acid AB'de CMR 2 olduğu için zaten turuncu; K3 rengi düşürmez
 ["Aqua, Methylparaben, Propylparaben, Salicylic Acid, Glycerin",
  {"METHYLPARABEN":["yellow",["ab_ed_b"]],"PROPYLPARABEN":["yellow",["ab_ed_a","dk"]],"SALICYLIC ACID":["orange",["ab_ed_b"]],"GLYCERIN":["info",[]]},
  s=>s.ed.length===3&&s.ban.length===0],
 // Çinko borat, MEA-borat: AB'de kısıtlı ama Kaliforniya'da 2027'den itibaren yasak -> turuncu.
 // Sodyum perborat AB Ek II/1397'de yasak (CMR 1B) -> kırmızı; Kaliforniya notu yine eklenir.
 ["Aqua, Sodium Perborate, Zinc Borate, MEA-Borate",
  {"SODIUM PERBORATE":["red",["ca"]],"ZINC BORATE":["orange",["ca"]],"MEA-BORATE":["orange",["ca"]]},s=>s.ban.length===3],
 // AB'de zaten yasak: kırmızı kalır, K3 bilgisi eklenir
 ["Aqua, Isobutylparaben, Cyclotetrasiloxane, Butylphenyl Methylpropional",
  {"ISOBUTYLPARABEN":["red",["ca","fr"]],"CYCLOTETRASILOXANE":["red",["ab_reach","ca"]],"BUTYLPHENYL METHYLPROPIONAL":["red",["ab_ed_b","ca"]]},s=>s.red.length===3&&s.ban.length===3],
 // Cyclomethicone artık "AB'de yasak" (D4 kaydı) sayılmaz; endokrin listesi B grubu
 ["Cyclomethicone, Dimethicone",{"CYCLOMETHICONE":["yellow",["ab_ed_b","ab_reach"]],"DIMETHICONE":["info",[]]},s=>s.red.length===0],
 ["Aqua, Miconazole Nitrate",{"MICONAZOLE NITRATE":["orange",["asean"]]},s=>s.ban.length===1],
 // UV filtreleri: AB Ek VI (bilgi) + A grubu -> sarı
 ["C12-15 Alkyl Benzoate, Benzophenone-3, Octocrylene, Homosalate, Butyl Methoxydibenzoylmethane",
  {"BENZOPHENONE-3":["yellow",["ab_ed_a"]],"OCTOCRYLENE":["yellow",["ab_ed_a"]],"HOMOSALATE":["yellow",["ab_ed_a"]],"BUTYL METHOXYDIBENZOYLMETHANE":["info",[]]},s=>s.ed.length===3],
 // Eş anlamlı / Türkçe ad üzerinden de gelir
 ["Su, Gliserin, Metilparaben, BHT",{"METHYLPARABEN":["yellow",["ab_ed_b"]]},s=>s.ed.length===2],
 // D5: AB REACH kısıtlaması + Türkiye taslağı + AB endokrin B grubu; özette yalnızca endokrin satırına girer
 ["Cyclopentasiloxane, Cyclohexasiloxane",{"CYCLOPENTASILOXANE":["yellow",["ab_ed_b","ab_reach","tr_taslak"]],"CYCLOHEXASILOXANE":["yellow",["ab_reach"]]},s=>s.ed.length===1&&s.ban.length===0],
 // Endokrin: REACH aday listesi, AB Eylül 2026 taslağı, Danimarka, Fransa (04.10.2026)
 // 04.10.2026: 4-MBC (SVHC 2022, endokrin) ve ftalatlar (AB 2017/1210); AB'de yasak oldukları için kırmızı kalır
 ["Aqua, 4-Methylbenzylidene Camphor, Dibutyl Phthalate",{"4-METHYLBENZYLIDENE CAMPHOR":["red",["ab_ed_a","eu_svhc_ed","fr"]],"DIBUTYL PHTHALATE":["red",["ca","eu_svhc_ed","fr"]]},s=>s.ed.length===2],
 ["Aqua, Butylparaben, Benzophenone-1, Resorcinol",{"BUTYLPARABEN":["yellow",["ab_ed_b","ab_taslak","dk","eu_svhc_ed","fr"]],"BENZOPHENONE-1":["yellow",["ab_ed_b","ab_taslak"]],"RESORCINOL":["yellow",["ab_ed_a","eu_svhc_ed"]]},
  s=>s.ed.length===3&&s.child.length===1&&s.ban.length===0],
 // 16.10.2026: Fransa kararnamesinin Tablo A'sı (resmi metin); 3-benziliden kafur AB'de yasak, kırmızı kalır
 ["Aqua, Nonoxynol-9, Octoxynol-9, 3-Benzylidene Camphor, Tris(Nonylphenyl)Phosphite",
  {"NONOXYNOL-9":["yellow",["fr"]],"OCTOXYNOL-9":["yellow",["fr"]],"3-BENZYLIDENE CAMPHOR":["red",["fr"]],"TRIS(NONYLPHENYL)PHOSPHITE":["yellow",["fr"]]},s=>s.ed.length===4],
 // Komedojenite: bilgi notu, renk değiştirmez; ABD yazımıyla da bulunur
 ["Aqua, Isopropyl Myristate, Cocos Nucifera (Coconut) Oil, Theobroma Cacao Seed Butter, Glycerin",
  {"ISOPROPYL MYRISTATE":["info",["komedo"]],"COCOS NUCIFERA OIL":["info",["komedo"]],"THEOBROMA CACAO SEED BUTTER":["info",["komedo"]],"GLYCERIN":["info",[]]},
  s=>s.comedo.length===3&&s.ed.length===0&&s.yellow.length===0],
 // 04.10.2026 genişletme: izopropil palmitat ve oleil alkol; 3 alan (sınırda) bütil stearat listede değil
 ["Aqua, Isopropyl Palmitate, Oleyl Alcohol, Butyl Stearate",{"ISOPROPYL PALMITATE":["info",["komedo"]],"OLEYL ALCOHOL":["info",["komedo"]],"BUTYL STEARATE":["info",[]]},s=>s.comedo.length===2],
 ["Aqua, Laureth-4, Propylparaben",{"LAURETH-4":["info",["komedo"]],"PROPYLPARABEN":["yellow",["ab_ed_a","dk"]]},s=>s.comedo.length===1&&s.ed.length===1],
 // PFAS: Kaliforniya AB 2771 bilgisi bayrak açıklamasında
 ["PTFE, Mica",{"PTFE":["orange",[]]},s=>s.pfas.length===1],
];
for(const [t,exp,chk] of cases){
  const r=KL.analyzeK(t,K,{}),by={};r.forEach(x=>by[x.name]=x);
  for(const nm in exp){
    const x=by[nm],[lv,lists]=exp[nm];
    ok(x&&x.level===lv,t.slice(0,30)+' '+nm+' seviye beklenen '+lv+' bulunan '+(x&&x.level));
    const got=x?[...new Set(x.k3.map(w=>w.list))].sort():[];
    ok(JSON.stringify(got)===JSON.stringify(lists.slice().sort()),nm+' listeler beklenen '+lists+' bulunan '+got);
  }
  const S=KL.summarizeK(r,K);
  ok(!chk||chk(S),'özet '+t.slice(0,30)+' '+JSON.stringify({ban:S.ban,ed:S.ed,red:S.red,pfas:S.pfas}));
}
ok(/AB 2771/.test(kdb.meta.inci_flag_reasons.pfas),'PFAS açıklamasında AB 2771 yok');
// Türkiye durumu: 2023/1490 sonrası AB değişikliklerinde "tr" alanı ve açıklama metni
const TRT=kdb.meta.tr_text;ok(TRT&&TRT.yok&&TRT.taslak,'meta.tr_text yok');
const byId={};kdb.entries.forEach(e=>byId[e.id]=e);
ok(byId['II/1730']&&byId['II/1730'].tr==='taslak','4-MBC (2024/996) tr=taslak değil');
ok(byId['II/1731']&&byId['II/1731'].tr==='yok','TPO (2025/877) tr=yok değil');
ok(kdb.entries.filter(e=>e.annex==='II'&&!e.tr&&!(e.updates||[]).some(u=>u.tr)).length>1000,'eski kayıtlara tr eklenmemeli');
// 28'lik listedeki sonuçlanmış maddelerin durum notu var
const mbc=kdb.watch.find(w=>w.list==='ab_ed_a'&&w.inci.includes('4-METHYLBENZYLIDENE CAMPHOR'));ok(mbc&&/yasakland/.test(mbc.note_tr||''),'4-MBC durum notu');
['eu_svhc_ed','ab_taslak','dk','fr'].forEach(l=>ok(WL[l]&&WL[l].level==='yellow','yeni liste sarı: '+l));
ok(WL.fr.kind==='ed'&&WL.eu_svhc_ed.kind==='ed'&&WL.dk.kind==='child','liste türleri');
ok(kdb.meta.known_gaps.some(g=>/Fransa listesi/.test(g)),'gelişim alanı notu');
// 16.10.2026: Fransa listesi resmi metinle (28.09.2023 kararnamesi) karşılaştırıldı; ikincil kaynaklı satır kalmadı
const FR=kdb.watch.filter(w=>w.list==='fr');
ok(FR.length===12&&FR.every(w=>!w.needs_review&&/aida\.ineris\.fr/.test(w.source)),'fr 12 satır, hepsi resmi metinden');
ok(FR.some(w=>w.inci.includes('NONOXYNOL-9'))&&FR.some(w=>w.inci.includes('OCTOXYNOL-9')),'fr nonoksinol/oktoksinol grubu');
ok(WL.komedo&&WL.komedo.level==='info'&&WL.komedo.kind==='comedo','komedo listesi bilgi düzeyinde');
ok(kdb.watch.filter(w=>w.list==='komedo').length===21,'komedo 21 madde');
ok(kdb.meta.known_gaps.some(g=>/Komedojenite/.test(g)),'komedojenite gelişim notu');
// summarizeK eski çağrı biçimi (K olmadan) çalışmaya devam etmeli
ok(KL.summarizeK(KL.analyzeK("Aqua, Methylparaben",K,{})).ed.length===1,'summarizeK K olmadan');
console.log(n+' K3 denetimi, '+fail+' hata');
process.exit(fail?1:0);
