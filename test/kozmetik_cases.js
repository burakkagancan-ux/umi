// Kozmetik (INCI) analizi testleri. Çalıştır: node test/kozmetik_cases.js
const fs=require('fs');
const src=require('./yukle.js');
eval(src+';global.KL={buildKIndex,analyzeK,summarizeK,inciItems,looksCosmetic}');
const K=KL.buildKIndex(JSON.parse(fs.readFileSync(__dirname+'/../data/kozmetik.json')),JSON.parse(fs.readFileSync(__dirname+'/../data/kozmetik_inci.json')));
module.exports={K,KL};
if(require.main!==module)return;
const names=(t,o)=>KL.analyzeK(t,K,o);
// [metin, seçenekler, beklenenler: {ad: seviye}, özet denetimi]
const cases=[
 ["Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Parfum, Linalool, Limonene, Phenoxyethanol, CI 77891.",{},
  {"AQUA":"info","LINALOOL":"info","PHENOXYETHANOL":"info","CI 77891":"info"},s=>s.fragrance.length===2&&s.parfum&&s.unknown.length===0],
 ["AQUA (WATER), SODIUM LAURETH SULFATE, COCAMIDOPROPYL BETAINE, METHYLCHLOROISOTHIAZOLINONE, METHYLISOTHIAZOLINONE, DMDM HYDANTOIN",{ptype:"rinse"},
  {"METHYLISOTHIAZOLINONE":"yellow","DMDM HYDANTOIN":"yellow"},s=>s.formaldehyde.length===1&&s.preservative.length>=2],
 ["Aqua, Methylisothiazolinone",{ptype:"leave"},{"METHYLISOTHIAZOLINONE":"orange"},null],
 ["Ingredients: Butyl Acetate, Ethyl Acetate, Nitrocellulose, Trimethylbenzoyl Diphenylphosphine Oxide, Triphenyl Phosphate",{},
  {"TRIMETHYLBENZOYL DIPHENYLPHOSPHINE OXIDE":"red","TRIPHENYL PHOSPHATE":"red"},s=>s.red.length===2],
 ["Aqua, Butylphenyl Methylpropional, Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde",{},{"BUTYLPHENYL METHYLPROPIONAL":"red","HYDROXYISOHEXYL 3-CYCLOHEXENE CARBOXALDEHYDE":"red"},null],
 // OCR hataları: harf/rakam karışması, tire, satır sonu
 ["INGREDIENTS: AQUA, GLYCERlN, PROPYLENE GLYC0L, Cl 77891, PEG-40 HYDROGENATED CASTOR OIL, 1,2-HEXANEDIOL, PHENOXY-\nETHANOL",{},
  {"GLYCERIN":"info","PROPYLENE GLYCOL":"info","CI 77891":"info","PEG-40 HYDROGENATED CASTOR OIL":"info","1,2-HEXANEDIOL":"info","PHENOXYETHANOL":"info"},s=>s.unknown.length===0],
 ["Aqua, Retinol, Salicylic Acid, Lanolin, Cera Alba, Hydrolyzed Collagen, Squalane",{ptype:"baby"},
  {"RETINOL":"yellow","SALICYLIC ACID":"orange","LANOLIN":"info"},s=>s.vitA.length===1&&s.kids.length===1&&s.nonVegan.length===2&&s.nonVeg.length===1&&s.veganUnsure.length===1],
 ["Cyclopentasiloxane, PTFE, Perfluorodecalin, Titanium Dioxide (nano)",{},{"PTFE":"orange","PERFLUORODECALIN":"orange"},s=>s.pfas.length===2],
 // PFAS ad düzeyinde: aynı AB kaydındaki florsuz adlar PFAS sayılmaz (09.10.2026); INCI listesinde olmayan Ek II adı (PFOA) sayılır
 ["Aqua, Ethanolamine, Dibehenyl Methylamine, AMP-Acrylates/Diacetoneacrylamide Copolymer, Perfluorooctanoic Acid",{},{"ETHANOLAMINE":"yellow","PERFLUOROOCTANOIC ACID":"red"},s=>s.pfas.length===1&&s.pfas[0]==="PERFLUOROOCTANOIC ACID"],
 ["Talc, Mica, Dimethicone [+/- CI 77491, CI 77492, CI 77499]",{},{"TALC":"yellow","CI 77491":"info"},null],
 ["Aqua, Lavandula Angustifolia Oil, Rose Flower Oil/Extract",{},{"LAVANDULA ANGUSTIFOLIA OIL":"info","ROSE FLOWER OIL/EXTRACT":"info"},s=>s.fragrance.length===2],
];
let fail=0;
for(const [t,o,exp,chk] of cases){
  const r=names(t,o),by={};r.forEach(x=>by[x.name]=x.level);
  for(const n in exp)if(by[n]!==exp[n]){fail++;console.log('HATA',JSON.stringify(t).slice(0,60),n,'beklenen',exp[n],'bulunan',by[n]);}
  if(chk&&!chk(KL.summarizeK(r))){fail++;console.log('HATA özet',JSON.stringify(t).slice(0,60),JSON.stringify(KL.summarizeK(r)));}
}
// Kullanıcının telefon testindeki gerçek OCR çıktıları (03.10.2026)
const REAL=[
 ["Ingredients: Aqua, Glycerin, Olea Europaea fru Come Nucifera O, Butyrospermum Parki Butter, Persea Grafis Cinnamomum Cassic Extract, Triethyl Citrate, Glyceryl Capryla Magresium Sulfate, Tocopherol, Parfum, Limonene ndod Berzy Salicylate, Cra \"Doğal kaynaklardan elde edilmi Hindistan Ceviz Yağ, ci Hario kullanamigindir Çocu yumaya yardima ulayamayacağ yerde soko, Hamile vevo ema den du Click korumaya döneminde, locular ok Hinddan Cevin Yog, herhangi bir hastalih klerden ve kirden mud fceri 4850 255 90 00",
  ["BUTYROSPERMUM PARKII BUTTER","GLYCERYL CAPRYLATE","MAGNESIUM SULFATE","LIMONENE","BENZYL SALICYLATE","CINNAMOMUM CASSIA EXTRACT"],5,3],
 ["ISODOCECANE POLYETHYLENE TRIMETHYLSILOXYPHENYL DIMETHICONE SOHEXADECANE-DIMETHICONE ACRYLATES/OIMETHICONE CUPOLYMER-POLYPROPYLSILSESQUIOXANE HYDROGENATED POLYSOBUTENE HYDROGENATED STYRENE METHYL STYPENE INDENE COPOLYMER ALUMINA SINTETIC FLUORPHLOGOPITE CALCIUM ALUMINUM BORDSLICATE ETHYLENEVA COPOLYMER-ACRYLATES COPOLYMER BENZVE ALCOHOL",
  ["ISODODECANE","POLYETHYLENE","TRIMETHYLSILOXYPHENYL DIMETHICONE","ISOHEXADECANE","ACRYLATES/DIMETHICONE COPOLYMER","HYDROGENATED POLYISOBUTENE","SYNTHETIC FLUORPHLOGOPITE","CALCIUM ALUMINUM BOROSILICATE","BENZYL ALCOHOL"],0,0],
 ["İçindekiler: Aqua, Hydrated Silica, Sorbitol, Glycerin, PEG-6, Sodium Lauryl Sulfate, Aroma, Limonene, CI 77491. Sodium Fluoride %0.31 w/w (1400ppm Fluoride) içerir. AMBALAJ ÜZERİNDEKİ UYARILARA UYUNUZ. Dişlerinizi günde 2 kez fırçalayınız. Haleon Tüketici Sağlığı A.Ş. Esentepe Mah. Bahar Sk. Özdilek River Plaza No: 13 Şişli/İstanbul tarafından ithal edilmiştir.",
  ["AQUA","HYDRATED SILICA","PEG-6","CI 77491","SODIUM FLUORIDE"],6,0],
];
for(const [t,must,minExtra,maxUnknown] of REAL){
  const t0=Date.now(),r=KL.analyzeK(t,K,{}),ms=Date.now()-t0,got=r.filter(x=>x.found).map(x=>x.name),unk=r.filter(x=>!x.found).length;
  const miss=must.filter(m=>!got.includes(m));
  if(miss.length||r.extra.length<minExtra||unk>maxUnknown||ms>3000){fail++;console.log('HATA gerçek etiket',t.slice(0,30),'eksik:',miss,'liste dışı:',r.extra.length,'tanınmayan:',unk,ms+'ms')}
  if(got.includes('ICINDEKILER')||r.some(x=>/ICINDEKILER|ICERIR|1400PPM/.test(x.name))){fail++;console.log('HATA başlık/talimat bileşen sayıldı')}
}
// Eş anlamlılar: Türkçe etiket, ABD etiketi, kısaltmalar
const ESA=[
 // 04.10.2026 eklenen yaygın Türkçe adlar (papaya, papatyaya benzetilmemeli)
 ["İçindekiler: Su, Seramid NP, Centella özü, Nar çekirdeği yağı, Çörek otu yağı, Mango yağı, Papaya özü, Aktif kömür, Beyaz kil, Koenzim Q10, Avobenzon, Oktokrilen, Heksil sinnamal, Askorbil glukozit",
  ["AQUA","CERAMIDE NP","CENTELLA ASIATICA EXTRACT","PUNICA GRANATUM SEED OIL","NIGELLA SATIVA SEED OIL","MANGIFERA INDICA SEED BUTTER","CARICA PAPAYA FRUIT EXTRACT","CHARCOAL POWDER","KAOLIN","UBIQUINONE","BUTYL METHOXYDIBENZOYLMETHANE","OCTOCRYLENE","HEXYL CINNAMAL","ASCORBYL GLUCOSIDE"]],
 ["İçindekiler: Su, Gliserin, Shea yağı, Hindistan cevizi yağı, E vitamini, Parfüm, Sodyum benzoat, Potasyum sorbat, Sitrik asit, Setearil alkol, Ksantan gam, Pantenol",
  ["AQUA","GLYCERIN","BUTYROSPERMUM PARKII BUTTER","COCOS NUCIFERA OIL","TOCOPHEROL","PARFUM","SODIUM BENZOATE","POTASSIUM SORBATE","CITRIC ACID","CETEARYL ALCOHOL","XANTHAN GUM","PANTHENOL"]],
 ["Ingredients: Water, Glycerin, Butyrospermum Parkii (Shea) Butter, Mineral Oil, Fragrance, FD&C Yellow No. 5, Red 40 Lake, D&C Red No. 7 Calcium Lake, Iron Oxides, Mica, Titanium Dioxide (CI 77891)",
  ["WATER","GLYCERIN","BUTYROSPERMUM PARKII BUTTER","MINERAL OIL","PARFUM","CI 19140","CI 16035","CI 15850","CI 77491 / CI 77492 / CI 77499","MICA","TITANIUM DIOXIDE"]],
 ["Aqua, SLES, CAPB, MIT, Sodyum lauril sülfat, Kokamidopropil betain, Salisilik asit, Hyalüronik asit, Niasinamid",
  ["AQUA","SODIUM LAURETH SULFATE","COCAMIDOPROPYL BETAINE","METHYLISOTHIAZOLINONE","SODIUM LAURYL SULFATE","SALICYLIC ACID","HYALURONIC ACID","NIACINAMIDE"]],
];
for(const [t,must] of ESA){
  const r=KL.analyzeK(t,K,{}),got=r.filter(x=>x.found).map(x=>x.name),miss=must.filter(m=>!got.includes(m));
  if(miss.length){fail++;console.log('HATA eş anlamlı',t.slice(0,30),'eksik:',miss,'bulunan:',got)}
}
// Eş anlamlı üzerinden gelen kayıt düzenleme bilgisini korumalı: "Fragrance" -> PARFUM, "SLES" yüzey aktif, "MIT" sarı
{const r=KL.analyzeK("Aqua, MIT, Fragrance",K,{});const mit=r.find(x=>x.name==="METHYLISOTHIAZOLINONE");if(!mit||mit.level!=="yellow"){fail++;console.log('HATA MIT seviyesi',mit&&mit.level)}if(!KL.summarizeK(r).parfum){fail++;console.log('HATA Fragrance parfüm sayılmadı')}}
// "may contain" bölümü
const mi=KL.inciItems("Talc, Mica [+/- CI 77491, CI 77891]");
if(!(mi.length===4&&mi[2].may&&!mi[1].may)){fail++;console.log('HATA may',JSON.stringify(mi))}
// Aynı not iki kez yazılmaz (MIT iki AB kaydında: V/39, V/57)
{const r=KL.analyzeK("Aqua, Methylchloroisothiazolinone, Methylisothiazolinone",K,{ptype:"leave"});
 r.forEach(x=>{const u=new Set(x.notes);if(u.size!==x.notes.length){fail++;console.log('HATA tekrarlanan not',x.name,x.notes)}});
 if(!r.filter(x=>/ISOTHIAZOLINONE/.test(x.name)).every(x=>x.notes.length===1)){fail++;console.log('HATA durulanan notu eksik',r.map(x=>x.notes))}}
// Tek başına kalan "CHLORIDE" / "CHLORITE" CHLORINE (AB'de yasak) sayılmaz
{const r=KL.analyzeK("Aqua, Benzalkonium, Chloride, Chlorite, Sodium Silikat",K,{});
 if(r.some(x=>x.name==="CHLORINE")){fail++;console.log('HATA CHLORIDE -> CHLORINE')}}
// Kozmetik/gıda ayrımı
if(!KL.looksCosmetic("Ingredients: Aqua, Glycerin, Parfum, Phenoxyethanol")){fail++;console.log('HATA looksCosmetic kozmetik')}
if(KL.looksCosmetic("İçindekiler: Şeker, buğday unu, bitkisel yağ, süt tozu, tuz, sitrik asit")){fail++;console.log('HATA looksCosmetic gıda')}
console.log(cases.length+REAL.length+ESA.length+6+' kozmetik durum, '+fail+' hata');
process.exit(fail?1:0);
