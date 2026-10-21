// Temizlik ürünü analizi testleri. Çalıştır: node test/temizlik.js
const fs=require('fs');
const {K}=require('./kozmetik_cases.js');
Object.assign(globalThis,require('./yukle.js'));global.TL={buildTIndex,analyzeT,summarizeT,looksCleaning,looksCosmetic};
const tdb=JSON.parse(fs.readFileSync(__dirname+'/../data/temizlik.json'));
const T=TL.buildTIndex(tdb);
let fail=0,n=0;
function ok(c,msg){n++;if(!c){fail++;console.log('HATA',msg)}}
const same=(a,b)=>a.slice().sort().join()===b.slice().sort().join();

// Veri bütünlüğü
ok(tdb.hazards.length>=100,'ifade sayısı');
tdb.hazards.forEach(x=>{ok(['red','yellow','info'].includes(x.level),'seviye '+x.code);ok(x.tr&&x.en,'metin '+x.code);ok(tdb.meta.group_labels[x.group],'grup '+x.code)});
['H314','H318','H304','H334','H350','H360','H300','H301','H330','H331'].forEach(c=>ok(T.byCode[c].level==='red','ciddi tehlike kırmızı '+c));
['H302','H315','H317','H319','H335','H412','EUH208','EUH206'].forEach(c=>ok(T.byCode[c].level==='yellow','uyarı sarı '+c));
tdb.groups.forEach(g=>g.pat.forEach(p=>{ok(!/\(\?<[=!]/.test(p),'lookbehind '+g.id);new RegExp(p)}));
tdb.subs.forEach(s=>s.inci.forEach(a=>ok(K.map.has(a.toLowerCase()),'INCI dizinde yok '+a)));
// Sonuç ekranından ansiklopediye bağlantı: her ad INCI dizininde, her kimlik ansiklopedide bir sayfa; madde notları bağlanır
Object.keys(tdb.ans).forEach(a=>{ok(K.map.has(a.toLowerCase()),'ans: INCI dizinde yok '+a);ok(fs.existsSync(__dirname+'/../data/ansiklopedi/'+tdb.ans[a]+'.json'),'ans: sayfa yok '+tdb.ans[a])});
ok(Object.keys(tdb.ans).length>=29,'ans bağlantı sayısı '+Object.keys(tdb.ans).length);
['hipoklorit','mit','cmit','bit','hcl','amonyak','enzim'].forEach(id=>{const s=tdb.subs.find(x=>x.id===id);ok(s&&s.inci.some(a=>tdb.ans[a]),'madde notu ansiklopediye bağlanmıyor '+id)});

// [metin, beklenen ifadeler, beklenen gruplar {id: bant|null|"neg"}, ek denetim(A,S)]
const cases=[
 ["İçindekiler: %5-15 anyonik yüzey aktif maddeler, %5'ten az noniyonik yüzey aktif maddeler, sabun, fosfonatlar, enzimler, optik parlatıcılar, parfüm (Hexyl Cinnamal, Limonene, Linalool), koruyucu (Benzisothiazolinone, Methylisothiazolinone). TEHLİKE. Ciddi göz hasarına yol açar. Cilt tahrişine yol açar. Çocukların ulaşamayacağı yerde saklayın. Koruyucu eldiven kullanın.",
  ['H318','H315'],{anyonik:'b5_15',noniyonik:'b5',sabun:'b5',fosfonat:'b5',enzim:null,optik:null,parfum:null,koruyucu:null},
  (A,S)=>same(S.fragrance,['HEXYL CINNAMAL','LIMONENE','LINALOOL'])&&S.pres.includes('BENZISOTHIAZOLINONE')&&S.pres.includes('METHYLISOTHIAZOLINONE')&&A.signal==='tehlike'&&S.level==='red'&&S.enzyme&&!S.mix],
 ["Sodyum hipoklorit içerir. %5'ten az klor bazlı ağartıcı, noniyonik yüzey aktif madde, parfüm. DİKKAT. Cilt tahrişine yol açar. Ciddi göz tahrişine yol açar. Sucul ortamda uzun süre kalıcı, zararlı etki. EUH206 Dikkat! Diğer ürünlerle birlikte kullanmayın. Tehlikeli gazlar açığa çıkarabilir (klor). EUH031: Asitlerle temas ettiğinde toksik gaz açığa çıkarır.",
  ['H315','H319','H412','EUH206','EUH031'],{klor:'b5',noniyonik:'b5',parfum:null},
  (A,S)=>S.mix&&A.signal==='dikkat'&&S.level==='yellow'&&A.subs.some(x=>x.s.id==='hipoklorit')],
 ["H314 H290 EUH208 Contains: 1,2-benzisothiazol-3(2H)-one. May produce an allergic reaction.",
  ['H314','H290','EUH208'],{},(A,S)=>A.subs.some(x=>x.s.id==='bit')&&A.hazards.find(x=>x.code==='EUH208').how.includes('metin')],
 ["Ingredients: 5-15% anionic surfactants, <5% non-ionic surfactants, phosphonates, enzymes, perfume, preservatives (Phenoxyethanol). Causes serious eye irritation. Harmful to aquatic life with long lasting effects.",
  ['H319','H412'],{anyonik:'b5_15',noniyonik:'b5',fosfonat:'b5',enzim:null,parfum:null,koruyucu:null},(A,S)=>S.pres.includes('PHENOXYETHANOL')],
 // OCR bozulması: eksik harf, ş->s
 ["Ciddi göz hasarina yol acar. Cilt tahrisine yol açr.",['H318','H315'],{},(A)=>A.hazards.every(x=>x.how.includes('benzer')||x.how.includes('metin'))],
 // Birebir yazım "benzer" sayılmaz: daha uzun bir diğer yazım (EUH206 "(klorür)", P263 2020 metni) çakışınca da (20.10.2026)
 ["EUH206 Dikkat! Diğer ürünlerle birlikte kullanmayın. Tehlikeli gazlar açığa çıkarabilir (klor).",['EUH206'],{},(A)=>A.hazards[0].how.includes('metin')&&!A.hazards[0].how.includes('benzer')],
 ["Su ile şiddetli tepkime verir. Hamilelikte/anne sütü verirken temastan kaçının.",['EUH014'],{},(A)=>{var p=A.prec.find(x=>x.code==='P263');return p&&p.how.join()==='metin'}],
 ["Su ile şiddetli tepkime verir. Hamilelikte ve anne sütü verirken temastan kaçınm.",['EUH014'],{},(A)=>{var p=A.prec.find(x=>x.code==='P263');return p&&p.how.join()==='benzer'}],
 // 2020 metninin Ek-1 tablo yazımı ve "…" yerinin başka doldurulması da metinden tanınır (bozma turu, 20.10.2026)
 ...[["P211","Açık aleve veya diğer tutuşturucu kaynaklara doğru püskürtmeyin."],
     ["P312","Kendinizi iyi hissetmezseniz, ULUSAL ZEHİR DANIŞMA MERKEZİNİN 114 NOLU TELEFONUNU/doktoru/hekimi arayın."],
     ["P301+P312","YUTULDUĞUNDA: Kendinizi iyi hissetmiyorsanız ULUSAL ZEHİR DANIŞMA MERKEZİNİN 114 NOLU TELEFONUNU/doktoru/hekimi arayın."],
     ["P301+P310","YUTULDUĞUNDA: ULUSAL ZEHİR DANIŞMA MERKEZİNİN 114 NOLU TELEFONUNU veya doktoru arayın."],
     ["P302+P352","CİLT İLE TEMAS HALİNDE İSE: Bol su ve sabun ile yıkayın."],
     ["P302+P352","DERİ İLE TEMAS HALİNDE İSE: Bol sabun ve su ile yıkayın."],
     ["P302+P352","İçindekiler: %5'ten az sabun, parfüm. CİLT İLE TEMAS HALİNDE İSE: Bol sabun ve su ile yıkayın.",{sabun:'b5',parfum:null}]].map(([c,m,g])=>["Su ile şiddetli tepkime verir. "+m,['EUH014'],g||{},(A)=>A.prec.some(x=>x.code===c)]),
 // Önlem ifadesindeki "sabun" içerik grubu sayılmaz (20.10.2026); içerik listesindeki sabun kaybolmaz
 // Çakışan H ve P aralıkları (EUH202 P102'yi içerir; H300 ile P301+P310) maskeyi kaydırıp arkadaki içerik listesini yutmaz (bozma turu, 20.10.2026)
 ["Siyanoakrilat. Tehlike. Saniyeler içinde cildi ve gözleri yapıştırır. Çocukların erişemeyeceği yerde saklayın. İçindekiler: %5-15 anyonik yüzey aktif maddeler, sabun, parfüm.",
  ['EUH202'],{anyonik:'b5_15',sabun:'b5_15',parfum:null}],
 ["Fatal if swallowed. Immediately call a POISON CENTER/doctor. 5-15% anionic surfactants, soap, perfume.",
  ['H300'],{anyonik:'b5_15',sabun:'b5_15',parfum:null}],
 // Aynı önlem ifadesi iki kez, CLP'nin 2008 İngilizcesi, başlıksız yıkama talimatı: "sabun" grup değildir; içerik listesindeki kalır (21.10.2026)
 ["Su ile şiddetli tepkime verir. CİLT İLE TEMAS HALİNDE İSE: Bol sabun ve su ile yıkayın. Çocukların erişemeyeceği yerde saklayın. CİLT İLE TEMAS HALİNDE İSE: Bol sabun ve su ile yıkayın.",['EUH014'],{},(A)=>A.prec.some(x=>x.code==='P302+P352')],
 ["Reacts violently with water. IF ON SKIN: Wash with plenty of soap and water.",['EUH014'],{},(A)=>A.prec.some(x=>x.code==='P302+P352')],
 ["Su ile şiddetli tepkime verir. Bol sabun ve su ile yıkayın.",['EUH014'],{}],
 ["Su ile şiddetli tepkime verir. Bol sabun ve suyla yıkayın.",['EUH014'],{}],
 ["Su ile şiddetli tepkime verir. Temas halinde su ve sabun ile yıkayın.",['EUH014'],{sabun:null}],   // bilinen sınır
 ["Reacts violently with water. Ingredients: less than 5% soap, perfume. IF ON SKIN: Wash with plenty of soap and water.",['EUH014'],{sabun:'b5',parfum:null}],
 ["İçindekiler: %5'ten az sabun, parfüm. Bol sabun ve suyla yıkayın.",[],{sabun:'b5',parfum:null}],
 ["İçindekiler: su, sabun, parfüm.",[],{sabun:null,parfum:null}],
 ["Reacts violently with water. Wash with plenty of soap and water.",['EUH014'],{}],
 ["Reacts violently with water. In case of contact, rinse with water and soap.",['EUH014'],{sabun:null}],   // bilinen sınır
 ["Reacts violently with water. Ingredients: soap, perfume.",['EUH014'],{sabun:null,parfum:null}],
 ["Reacts violently with water. Wash with plenty of soap.",['EUH014'],{sabun:null}],   // bilinen sınır
 ["Reacts violently with water. Wash skin with soap and water.",['EUH014'],{sabun:null}],   // bilinen sınır
 ["Su ile şiddetli tepkime verir. Sabun ve su ile yıkayın.",['EUH014'],{sabun:null}],   // bilinen sınır
 ["Su ile şiddetli tepkime verir. Bol sabun ile yıkayın.",['EUH014'],{sabun:null}],   // bilinen sınır
 ["İçindekiler: %5'ten az sabun ve suda çözünen polimer.",[],{sabun:'b5'}],
 // Bant grubun arkasında
 ["Anyonik yüzey aktif maddeler %15-30, noniyonik yüzey aktif maddeler %5'ten az, sabun.",[],{anyonik:'b15_30',noniyonik:'b5',sabun:null}],
 ["Fosfat içermez. %5-15 anyonik yüzey aktif madde.",[],{fosfat:'neg',anyonik:'b5_15'}],
 ["Fosfatsız formül. Zeolit, polikarboksilatlar.",[],{fosfat:'neg',zeolit:null,polikarboksilat:null}],
 ["%30 ve üzeri: zeolit. %5-15: oksijen bazlı ağartıcılar, polikarboksilatlar.",[],{zeolit:'b30',oksijen:'b5_15',polikarboksilat:'b5_15'}],
 // H413 metni H412'yi içerir: yalnızca uzun olan
 ["Sucul ortamda uzun süre kalıcı, zararlı etki yapabilir.",['H413'],{}],
 ["Yutulduğunda veya solunduğunda zararlıdır.",['H302','H332'],{}],
 ["Solunması halinde kansere yol açabilir.",['H350i'],{}],
 ["Soluma ile kansere yol açabilir.",['H350i'],{}],
 ["Hava ile temas ettiğinde ani yangınlara yol açar.",['H250'],{}],
 ["Hava ile temas ettiğinde ani yangınlara yol açabilir.",['H250'],{}],
 ["Koruyucu gözlük kullanın. Göz koruyucu takın.",[],{}],
 ["Sodyum hidroksit içerir. TEHLİKE H314 Ciddi cilt yanıklarına ve göz hasarına yol açar. H290 Metalleri aşındırabilir.",['H314','H290'],{},
  (A,S)=>A.hazards.find(x=>x.code==='H314').how.join()==='kod,metin'&&S.eye.includes('H314')&&S.level==='red'],
 // "Neden olur" biçimi ve kod son eki
 ["H319 Ciddi göz tahrişine neden olur. H360FD",['H319','H360FD'],{}],
 ["Solunması halinde nefes alma zorlukları, astım nöbetleri veya alerjiye yol açabilir. Subtilisin, Protease.",['H334'],{},(A,S)=>S.resp.includes('H334')&&S.enzyme],
 // Asitli ürün: çamaşır suyuyla karıştırma uyarısı
 ["Hidroklorik asit içerir. Çamaşır suyu ile karıştırmayın. H314",['H314'],{},(A,S)=>S.mix],
];
cases.forEach(([t,hz,gr,chk],i)=>{
  const A=TL.analyzeT(t,T,K),S=TL.summarizeT(A);
  ok(same(A.hazards.map(x=>x.code),hz),i+': ifadeler '+JSON.stringify(A.hazards.map(x=>x.code))+' beklenen '+JSON.stringify(hz));
  const got={};A.groups.forEach(g=>got[g.id]=g.neg?'neg':g.band);
  ok(JSON.stringify(Object.keys(got).sort())===JSON.stringify(Object.keys(gr).sort()),i+': gruplar '+JSON.stringify(got));
  Object.keys(gr).forEach(k=>ok(got[k]===gr[k],i+': bant '+k+' '+got[k]+' beklenen '+gr[k]));
  if(chk)ok(chk(A,S),i+': ek denetim '+JSON.stringify({sig:A.signal,mix:S.mix,fr:S.fragrance,pres:S.pres,lvl:S.level,subs:A.subs.map(x=>x.s.id)}));
});

// Eş anlamlılar ve CI renklendiriciler: [metin, tanınması gereken INCI, tanınmaması gereken INCI, ek denetim]
ok(tdb.aliases.length>=90,'eş anlamlı sayısı');
const AL=[
 ["Bileşenler: LAS, SLES, sodyum perkarbonat, STPP, kostik soda, renklendirici: CI 42090, Cl 19140. Koruyucu: BIT, MIT.",
  ['SODIUM DODECYLBENZENESULFONATE','SODIUM LAURETH SULFATE','SODIUM CARBONATE PEROXIDE','PENTASODIUM TRIPHOSPHATE','SODIUM HYDROXIDE','CI 42090','CI 19140','BENZISOTHIAZOLINONE','METHYLISOTHIAZOLINONE'],[],
  (A,S)=>same(S.color,['CI 42090','CI 19140'])&&S.pres.includes('BENZISOTHIAZOLINONE')&&A.groups.some(g=>g.id==='renklendirici')&&A.subs.some(x=>x.s.id==='bit')],
 // Kısaltma küçük harfle düz yazıda eşleşmez ("bit", "las")
 ["Bir bit bile kalmaz, las vegas.",[],['BENZISOTHIAZOLINONE','SODIUM DODECYLBENZENESULFONATE']],
 ["Ingredients: Sodium Dodecylbenzene Sulphonate, Sodium Lauryl Ether Sulphate, Colorant (CI42090).",
  ['SODIUM DODECYLBENZENESULFONATE','SODIUM LAURETH SULFATE','CI 42090'],[],(A,S)=>A.groups.some(g=>g.id==='renklendirici')],
 ["İçerik: lineer alkil benzen sülfonat, alkil poliglukozit, sodyum sitrat, tuz ruhu, butil glikol, izopropil alkol, benzalkonyum klorür, proteaz, amilaz.",
  ['SODIUM DODECYLBENZENESULFONATE','DECYL GLUCOSIDE / LAURYL GLUCOSIDE / COCO-GLUCOSIDE','SODIUM CITRATE','HYDROCHLORIC ACID','BUTOXYETHANOL','ISOPROPYL ALCOHOL','BENZALKONIUM CHLORIDE','PROTEASE','AMYLASE'],[],
  (A,S)=>S.mix&&S.enzyme&&S.pres.includes('BENZALKONIUM CHLORIDE')],
 // Uzun cümle içindeki ad
 ["Ürün 1,2-benzisotiyazol içerir; ayrıca renklendirici CI 42090 ve sodyum perkarbonat vardır.",['CI 42090','SODIUM CARBONATE PEROXIDE'],[]],
];
AL.forEach(([t,yes,no,chk],i)=>{
  const A=TL.analyzeT(t,T,K),S=TL.summarizeT(A),got=A.inci.map(x=>x.name);
  yes.forEach(y=>ok(got.includes(y),'eş '+i+': '+y+' yok; bulunan '+JSON.stringify(got)));
  no.forEach(y=>ok(!got.includes(y),'eş '+i+': '+y+' olmamalı'));
  if(chk)ok(chk(A,S),'eş '+i+': ek denetim '+JSON.stringify({color:S.color,pres:S.pres,groups:A.groups.map(g=>g.id),subs:A.subs.map(x=>x.s.id)}));
});

// Önlem ifadeleri, kapsül, EUH208 içindeki ad, "yol açar" biçimi (H371 metni H370'e kaymamalı)
{
 const t="Sıvı çamaşır deterjanı kapsülü. 1,2-benzisotiyazol-3(2H)-on içerir. Alerjik reaksiyona yol açabilir. P102 Çocukların erişemeyeceği yerde saklayın. P305+P351+P338 GÖZLE TEMASI HALİNDE: Su ile birkaç dakika dikkatlice durulayın. YUTULDUĞUNDA: Hemen ZEHİR DANIŞMA MERKEZİNİ veya doktoru arayın. Talep halinde güvenlik bilgi formu temin edilebilir.";
 const A=TL.analyzeT(t,T,K);
 ok(A.capsule,'kapsül bulunmadı');
 ok(same(A.prec.map(x=>x.code),['P102','P305+P351+P338','P301+P310']),'önlem '+JSON.stringify(A.prec.map(x=>x.code)));
 ok(JSON.stringify(A.euh208)===JSON.stringify(['1,2-benzisotiyazol-3(2H)-on']),'EUH208 adı '+JSON.stringify(A.euh208));
 ok(A.hazards.some(x=>x.code==='EUH210'),'EUH210 eski çeviri');
 ok(!TL.analyzeT("Bulaşık makinesi kapsülü. Ciddi göz hasarına yol açar.",T,K).capsule,'bulaşık kapsülü çamaşır kuralına girmemeli');
 ok(same(TL.analyzeT("Organlarda hasara yol açabilir.",T,K).hazards.map(x=>x.code),['H371']),'H371');
 ok(same(TL.analyzeT("Organlarda hasara yol açar.",T,K).hazards.map(x=>x.code),['H370']),'H370');
 ok(same(TL.analyzeT("Alerjik cilt reaksiyonlarına yol açar.",T,K).hazards.map(x=>x.code),['H317']),'H317 yol açar');
 ok(same(TL.analyzeT("EUH208: Contains Linalool, Limonene. May produce an allergic reaction.",T,K).euh208,['Linalool, Limonene']),'EUH208 İngilizce');
 ok(tdb.precautions.length>=35&&tdb.precautions.every(p=>p.tr&&p.en),'önlem verisi');
 ok(!T.byCode.EUH208.needs_review&&!T.byCode.EUH071.needs_review&&T.byCode.EUH211.needs_review&&T.byCode.EUH380.needs_review,'EUH doğrulama bayrakları (SEA Ek-3)');
ok(tdb.precautions.every(p=>!p.needs_review),'önlem ifadeleri SEA Ek-4 ile karşılaştırıldı');
// Maske ifadenin her geçişini alır (sabun dışlamasından bağımsız: tekrarlanan ifadenin ikinci geçişi de maskelenir)
{const t="CİLT İLE TEMAS HALİNDE İSE: Bol sabun ve su ile yıkayın. Çocukların erişemeyeceği yerde saklayın. CİLT İLE TEMAS HALİNDE İSE: Bol sabun ve su ile yıkayın.";
 const r=tPhrases(t,T,T.pphrases,true),h=r.hepsi.filter(x=>x.codes.join()==='P302+P352');
 ok(r.filter(x=>x.codes.join()==='P302+P352').length===1,'tPhrases: gösterim için ifade başına tek eşleşme');
 ok(h.length===2&&h[0].s!==h[1].s,'tPhrases hepsi: iki geçiş '+JSON.stringify(h));
 ok(!/sabun/.test(tMaske(t,r.hepsi)),'tMaske: iki geçiş de maskelendi');
 ok(tPhrases(t,T,T.pphrases).hepsi===undefined,'tPhrases: hepsi istenmezse alan yok');}
// İçerik listesindeki sabun yıkama talimatı sayılmaz: sözcük sonu, "of", listede "su ve sabun", arkasında başka madde (bozma turu, 21.10.2026; eski kalıpla hepsi düşüyordu)
["İçindekiler: limon kokusu ve sabun, parfüm.","Lavanta kokusu ve sabun içerir.","Ingredients: rosewater and soap, perfume.","Ingredients: seawater and soap.","Waterproof soap.",
 "Contains: 5-15% anionic surfactants; less than 5% of: soap, phosphonates, perfume.","Ingredients: less than 5% of soap, perfume.","Contains: blend of soap, perfume.","Ingredients: mix of soap.",
 "İçindekiler: su ve sabun, parfüm.","İçindekiler: deiyonize su ve sabun, parfüm.","İçindekiler: arıtılmış su ve sabun.","İçindekiler: %5'ten az noniyonik yüzey aktif madde, saf su ve sabun.",
 "Ingredients: water and soap, perfume.","Ingredients: aqua (water) and soap, perfume.","Ingredients: less than 5% soap and water softener, perfume.","İçindekiler: su, sabun ve su yumuşatıcı.",
 "İçindekiler: %5'ten az sabun ve su bazlı polimer.","Composition: <5% soap and water-soluble polymers.","Ingredients: 5-15% anionic surfactants, less than 5% soap and water, perfume.",
 "İÇİNDEKİLER: %5'TEN AZ SABUN VE SU, PARFÜM.","İçindekiler: %5-15 anyonik yüzey aktif madde ve sabun ve su.","Ingredients: 15-30% soap and water.",
 "İçindekiler: %5'ten az anyonik yüzey aktif madde, bol\nsabun, parfüm.",
 "İçindekiler: su ve sabun, parfüm. Göze temasında suyla yıkayın.",
 "Çamaşır yıkama sıvısı. Lavanta kokusu ve sabun içeren yıkama sıvısı.","Çamaşır yıkama deterjanı: %5'ten az sabun ve suda çözünen polimer."
].forEach(t=>{ok(analyzeT(t,T).groups.some(g=>g.id==='sabun'),'içerik listesindeki sabun kayboldu: '+t);ok(analyzeT('Su ile şiddetli tepkime verir. '+t,T).groups.some(g=>g.id==='sabun'),'EUH014 ile sabun kayboldu: '+t)});
// Yıkama sözcüğü ürün adında (yıkama deterjanı, washing, rinse aid) ya da noktasız OCR'da talimat içerik listesine bitişik: sabun kalır (bozma turu 2, 21.10.2026).
// 0: maskelenen başlıksız yazım, sabun sayılmaz. 2 ve "bilinen sınır": veride olmayan talimat yazımında sabun (bilgi düzeyi) grup sayılır. Komşu sözcüğe bakan
// dışlama kuralı üç bozma turunda da gerçek içerik listelerinde sabunu sildi; içerik kaybı yerine zararsız bir bilgi grubu seçildi. Biri genişletirse bu satırlar düşer.
[
 ["Çamaşır yıkama deterjanı. İçindekiler: su ve sabun, parfüm.",1],
 ["Çamaşır yıkama deterjanı içindekiler: su ve sabun, parfüm.",1],
 ["Bulaşık yıkama sıvısı: su ve sabun, parfüm",1],
 ["Dishwashing liquid: water and soap, perfume.",1],
 ["Dishwashing liquid. Ingredients: water and soap, perfume.",1],
 ["For washing: soap and water softener, perfume.",1],
 ["Washing powder. Ingredients: less than 5% soap and water softener.",1],
 ["Ingredients for hand washing: <5% soap and water, perfume.",1],
 ["İçindekiler: %5'ten az sabun ve su Bol su ile yıkayın",1],
 ["İçindekiler: %5'ten az sabun ve su, parfüm Kullanımdan sonra elleri yıkayın",1],
 ["Ingredients: less than 5% soap and water, perfume Wash hands after use",1],
 ["Ingredients: 5% soap and water Rinse thoroughly",1],
 ["ÇAMAŞIR YIKAMA DETERJANI İÇİNDEKİLER: SU VE SABUN, PARFÜM",1],
 ["Çamaşır yıkama\ndeterjanı\nİçindekiler: su ve sabun\nparfüm",1],
 ["Rinse aid. Contains: water and soap.",1],
 ["Rinse aid contains water and soap",1],
 ["Yıkama suyu ve sabun içerir",1],
 ["Elde yıkama için: bol köpüklü sabun ve su yumuşatıcı",1],
 ["Washing-up liquid with plenty of soap",1],
 ["Çamaşır yıkamada: %5'ten az sabun ve suyu yumuşatan fosfonatlar.",1],
 ["Yıkanabilir yüzeyler için. İçindekiler: arıtılmış su ve sabun",1],
 ["Wash & clean: aqua, soap and water softeners (zeolite).",1],
 ["İçindekiler 5-15% anyonik yüzey aktif madde, saf su ve sabun, yıkama sonrası durulayın",1],
 ["Sabun ve bol suyla yıkayınız.",2],
 ["Wash thoroughly with soap and plenty of water.",2],
 ["Elleri sabunla yıkayın.",0],
 ["Elleri sabun ile yıkayın.",2],
 ["Cilde temasında sabunlu suyla yıkayın.",0],
 ["Wash skin with soap.",2],
 ["Rinse with soap and water.",2],
 ["Wash with soap and running water.",2],
 ["Wash with soap and warm water.",2],
 ["Sabun ve ılık su ile yıkayın.",2],
 ["Bol sabunlu su ile yıkayın.",0],
 ["Deriyi su ve sabunla yıkayın.",0],
 ["Cildi bol su ve sabunla yıkayınız.",0],
 ["WASH WITH PLENTY OF SOAP AND WATER",0],
 ["Bol sabun ve su ile\nyıkayın.",0],
 ["Bol sabun ve su ile yı-\nkayın.",0],
 ["Bol sabun ve suyla iyice yıkanmalıdır.",2],
 ["Wash off with soap and water.",2],
 ["Bol su ve sabun ile durulayın.",2],
 ["Cilt ile temas halinde sabun ve su ile temizleyin.",2],
 ["Take off contaminated clothing and wash it before reuse. Wash with soap and water.",2],
 ["Wash the affected area thoroughly with plenty of warm water and soap.",2],
 ["Rinse with running water and soap.",2],
 ["Handwash with soap, aloe vera, perfume.",1],
 ["Sabun ve su ile yıkayınca köpürür.",1],
 // Bozma turu 3 (21.10.2026): beyaz listeli sözcüklerle kurulan içerik listeleri, ürün adında "wash/clean", noktasız OCR
 ["Clean: water, soap, perfume.",1],
 ["Clean water, soap, perfume.",1],
 ["Ingredients: water, soap, perfume.",1],
 ["Rinse aid: water and soap.",1],
 ["Cleaning gel with water and soap.",1],
 ["Hand wash with soap and aloe vera.",1],
 ["Body wash with soap and glycerin.",1],
 ["Hand wash: water, soap, perfume.",1],
 ["Dish wash, water, soap, perfume",1],
 ["Face wash - water, soap.",1],
 ["Wash & Clean. Ingredients: water and soap.",1],
 ["Clean & Fresh: water, soap",1],
 ["Rinse-free formula with soap",1],
 ["Laundry wash with soap flakes",1],
 ["Gentle hand wash with mild soap",1],
 ["Washing liquid. Wash with soap power!",1],
 ["Pre-wash: soap, enzymes.",1],
 ["Clean with soap and water based formula",1],
 ["Ingredients: <5% soap. Wash with water. Rinse.",1],
 ["Rinse with water and soap containing formula",1],
 ["Ingredients: less than 5% soap Rinse with water",1],
 ["İçindekiler: %5'ten az sabun, su Yıkayın",1],
 ["İçindekiler: %5'ten az sabun\nSu ile durulayın",1],
 ["İçindekiler: anyonik yüzey aktif madde, sabun Bol su ile durulayın.",1],
 ["İçindekiler: sabun Temizleyin",1],
 ["İçindekiler: su, sabun Kullandıktan sonra iyice durulayın",1],
 ["İçindekiler: sabun, su Ilık suyla yıkayın",1],
 ["İçindekiler: %5'ten az sabun ve su ile temizleyin",1],
 ["Doğal sabun ile temizleyin, %5'ten az sabun içerir.",1],
 ["İçeriğindeki sabun ile yüzeyleri temizleyin.",1],
 ["Sabun içerir. Sabun ile temizleyin.",1],
 ["%5'ten az sabun içerir ve su ile temizleyin",1],
 ["İçindekiler: sabun ve su Yı-\nkayın",1],
 ["İçindekiler: %5'ten az sabun, ılık su ile iyice durulayın",1],
 ["İçindekiler: %5-15 anyonik, sabun SICAK SU İLE YIKAYIN",1],
].forEach(([t,v])=>ok(analyzeT('Su ile şiddetli tepkime verir. '+t,T).groups.some(g=>g.id==='sabun')===!!v,(v?'sabun kayboldu: ':'talimattaki sabun grup sayıldı: ')+t));
// Maskeye özel yazımlar (veride `maske`) resmi ifade değildir: P302+P352 diye listelenmez, yalnızca grup aramasından çıkar
["Bol sabun ve su ile yıkayın.","Bol sabun ve suyla yıkayın.","Bol su ve sabun ile yıkayın.","Wash with plenty of soap and water."].forEach(t=>{const A=analyzeT('Su ile şiddetli tepkime verir. '+t,T);
 ok(!A.prec.some(x=>x.code==='P302+P352'),'maske yazımı ifade sayıldı: '+t);ok(!A.groups.some(g=>g.id==='sabun'),'maske yazımında sabun: '+t)});
ok(T.mphrases.length>=4&&tdb.precautions.every(p=>!(p.maske||[]).some(m=>(p.alt||[]).indexOf(m)>-1||m===p.tr||m===p.en)),'maske yazımları resmi/diğer yazımlarla aynı değil');
// analyzeT grupları her geçişi maskelenmiş metinde arar: yapay grup "eldiven", P280 iki kez yazılı
{const G={g:{id:'deneme',noband:true},rx:[/(?:^|[^a-z])eldiven(?![a-z])/g]},T2=Object.assign({},T,{groups:[G]});
 const t="Koruyucu eldiven/koruyucu kıyafet/göz koruyucu/yüz koruyucu kullanın. Çocukların erişemeyeceği yerde saklayın. Koruyucu eldiven/koruyucu kıyafet/göz koruyucu/yüz koruyucu kullanın.";
 ok(analyzeT(t,T2).prec.some(x=>x.code==='P280'),'analyzeT: P280 tanındı');
 ok(!analyzeT(t,T2).groups.length,'analyzeT: tekrarlanan ifadenin ikinci geçişi de maskelendi '+JSON.stringify(analyzeT(t,T2).groups.map(x=>x.id)));
 ok(analyzeT("İçindekiler: eldiven.",T2).groups.length===1,'analyzeT: yapay grup ifade dışında bulunur');}
for(const [t,p,h] of [['Su ile şiddetli reaksiyona girer. Gebelik sırasında ve emzirirken temastan kaçının.','P263','EUH014'],
  ['Su ile şiddetli tepkime verir. Hamilelikte/anne sütü verirken temastan kaçının.','P263','EUH014']]){
 const A=TL.analyzeT(t,T,K);
 ok(A.prec.some(x=>x.code===p)&&A.hazards.some(x=>x.code===h),'SEA metni ve eski yazım tanınır: '+t);
}
}

// Yanlış eşleşme olmamalı: gıda ve kozmetik etiketleri
const FOOD="İçindekiler: Şeker, buğday unu, bitkisel yağ (palm), glikoz şurubu, yağsız süt tozu, koruyucu (E 202), aroma verici. Enerji 450 kcal. Fındık içerebilir.";
const COS="Ingredients: Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Glycerin, Parfum, Citric Acid, Sodium Benzoate, Linalool.";
[FOOD,COS].forEach((t,i)=>{const A=TL.analyzeT(t,T,K);ok(A.hazards.length===0,'yanlış ifade '+i+' '+A.hazards.map(x=>x.code))});
ok(!TL.looksCleaning(FOOD),'looksCleaning gıda');
ok(!TL.looksCleaning(COS),'looksCleaning kozmetik');
ok(TL.looksCleaning(cases[0][0]),'looksCleaning çamaşır');
ok(TL.looksCleaning(cases[1][0]),'looksCleaning çamaşır suyu');

// Hız: uzun metin
const long=cases.map(c=>c[0]).join(' ').repeat(3);const t0=Date.now();TL.analyzeT(long,T,K);const ms=Date.now()-t0;
ok(ms<1500,'yavaş: '+ms+' ms');
console.log(n+' denetim ('+cases.length+' temizlik durumu, '+AL.length+' eş anlamlı durumu, '+ms+' ms), '+fail+' hata');
process.exit(fail?1:0);
