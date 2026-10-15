// "Birlikte dikkat" eşleşme testleri. Çalıştır: node test/eslesme.js
const fs=require('fs');
const {idx,L}=require('./run.js');
const {K,KL}=require('./kozmetik_cases.js');
Object.assign(globalThis,require('./yukle.js'));const C={};C.findCombos=findCombos;C.comboItemsFood=comboItemsFood;C.comboItemsK=comboItemsK;
const db=JSON.parse(fs.readFileSync(__dirname+'/../data/eslesmeler.json'));const R=db.rules;
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
const food=t=>C.findCombos(R,'gida',C.comboItemsFood(L.analyze(t,idx),idx)).map(c=>c.rule.id).sort();
const koz=t=>C.findCombos(R,'koz',C.comboItemsK(KL.analyzeK(t,K,{}))).map(c=>c.rule.id).sort();
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b.slice().sort());
// Veri
ok(R.length===22,'kural sayısı '+R.length);
R.forEach(r=>{ok(r.sources&&r.sources.length&&r.sources.every(u=>/^https:\/\//.test(u)),r.id+' kaynak');ok(!/tehlikeli|zehir|dönüşüyor/i.test(r.text+r.title),r.id+' abartılı dil');});
// Gıda
let x;
x=food("Su, şeker, sitrik asit, C vitamini, sodyum benzoat");ok(eq(x,['benzen']),'benzen '+x);
x=food("Su, askorbik asit (C vitamini), potasyum sorbat");ok(eq(x,[]),'benzoatsız '+x);
x=food("Su, şeker, koruyucu (sodyum benzoat), renklendiriciler (tartrazin, allura red AC)");ok(eq(x,['southampton']),'southampton '+x);
x=food("Tatlandırıcılar (maltitol, sorbitol), kakao");ok(eq(x,['polioller']),'polioller '+x);
x=food("Tatlandırıcı (maltitol), kakao");ok(eq(x,[]),'tek poliol '+x);
x=food("Tavuk eti, sodyum tripolifosfat, difosfatlar, tuz");ok(eq(x,['fosfatlar']),'fosfatlar '+x);
x=food("Kabartıcı (sodyum alüminyum fosfat), topaklanmayı önleyici (E554)");ok(x.includes('aluminyum'),'alüminyum '+x);
x=food("Üzüm, koruyucu (sülfit)");ok(eq(x,[]),'belirsiz tek sülfit '+x);
x=food("Şarap, sodyum metabisülfit, potasyum metabisülfit");ok(eq(x,['sulfitler']),'sülfitler '+x);
x=food("Sodyum benzoat içermez. Su, C vitamini");ok(eq(x,[]),'olumsuz eşleşme sayıldı '+x);
x=food("İçindekiler: su, C vitamini. Eser miktarda sodyum benzoat içerebilir.");ok(eq(x,[]),'içerebilir sayıldı '+x);
// Kozmetik
x=koz("Aqua, Sodium Laureth Sulfate, Cocamide DEA, 2-Bromo-2-Nitropropane-1,3-Diol, Parfum");ok(x.includes('nitrozamin'),'nitrozamin '+x);
x=koz("Aqua, Triethanolamine, Carbomer, Phenoxyethanol");ok(!x.includes('nitrozamin'),'tek amin '+x);
x=koz("Aqua, DMDM Hydantoin, Imidazolidinyl Urea");ok(eq(x,['formaldehit']),'formaldehit '+x);
x=koz("Aqua, Methylparaben, Propylparaben, Glycerin");ok(eq(x,['parabenler']),'parabenler '+x);
x=koz("Sorbitol, Aqua, Sodium Fluoride, Sodium Monofluorophosphate");ok(eq(x,['florurler']),'florürler '+x);
x=koz("Aqua, Sodium Fluoride, AMPS/HEMA Crosspolymer");ok(eq(x,[]),'yanlış bağlı florür adı '+x);
// 04.10.2026 genişletme
x=food("Cips, tuz, aroma güçlendirici (monosodyum glutamat, E627, E631, E622)");ok(x.includes('glutamatlar'),'glutamatlar '+x);
x=food("Cips, aroma güçlendirici (monosodyum glutamat)");ok(!x.includes('glutamatlar'),'tek glutamat '+x);
x=food("Sucuk: dana eti, tuz, koruyucu (sodyum nitrit, potasyum nitrat)");ok(x.includes('nitrit_nitrat'),'nitrit+nitrat '+x);
x=food("Salam: et, tuz, sodyum nitrit");ok(!x.includes('nitrit_nitrat'),'yalnız nitrit '+x);
x=food("Sos: su, yağ, emülgatör (E433, E435)");ok(x.includes('polisorbatlar'),'polisorbatlar '+x);
x=food("Bitkisel yağ, antioksidan (BHA, E319)");ok(x.includes('gallat_tbhq_bha'),'gallat/TBHQ/BHA '+x);
x=koz("Aqua, Ammonium Thioglycolate, Glyceryl Thioglycolate");ok(x.includes('tiyoglikolat'),'tiyoglikolat '+x);
x=koz("Aqua, Hydrogen Peroxide, Urea Peroxide");ok(x.includes('peroksit'),'peroksit '+x);
x=koz("Aqua, Salicylic Acid, Sodium Salicylate");ok(x.includes('salisilat'),'salisilat '+x);
x=koz("Aqua, Benzoic Acid, Sodium Benzoate, Potassium Sorbate, Sorbic Acid");ok(x.includes('benzoat_koz')&&x.includes('sorbat_koz'),'benzoat/sorbat '+x);
x=koz("Aqua, Cetrimonium Chloride, Behentrimonium Chloride");ok(x.includes('kuaterner'),'kuaterner '+x);
x=koz("Aqua, Retinol, Retinyl Palmitate");ok(x.includes('a_vitamini'),'A vitamini '+x);
x=koz("Aqua, Sodium Sulfite, Sodium Metabisulfite");ok(x.includes('kozmetik_sulfit'),'kozmetik sülfit '+x);
// Gıda kuralı kozmetikte çalışmaz
ok(eq(koz("Aqua, Sodium Benzoate, Ascorbic Acid"),[]),'gıda kuralı kozmetikte');
console.log(n+' eşleşme denetimi, '+fail+' hata');process.exit(fail?1:0);
