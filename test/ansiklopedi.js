// Ansiklopedi: veri bütünlüğü, model doğrulama, Türkçe harf duyarsız arama, profil uyarısı eşleşmesi.
// Çalıştır: node test/ansiklopedi.js
const fs=require('fs');
Object.assign(globalThis,require('./yukle.js'));
// Dizin (data/ansiklopedi.json, ansiklopedi_tr.json) açılışta, madde sayfası (data/ansiklopedi/<kimlik>.json, data/ansiklopedi/tr/<kimlik>.json) açılınca iner
const J=f=>JSON.parse(fs.readFileSync(__dirname+'/../data/'+f));
const D=J('ansiklopedi.json'),TI=J('ansiklopedi_tr.json').t,T=Object.assign({},TI);
const E=J('e_kodlari.json');
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
const R=D.records.map(x=>J('ansiklopedi/'+x.id+'.json')),by={};R.forEach(r=>by[r.id]=r);
// 0. Bölme: dizin kaydı tam kaydın kısaltması; sayfa metinleri yalnızca o sayfada, dizinde ve öteki sayfalarda yok; dizinde ad ve liste metinleri var
const ALAN=['id','slug','names','category','product_types','risk_level','review'];
D.records.forEach((x,i)=>{const r=R[i];
  ok(JSON.stringify(x)===JSON.stringify(Object.assign(Object.fromEntries(ALAN.map(k=>[k,r[k]])),r.production?{production:{class:r.production.class}}:{})),x.id+' dizin kaydı tam kayıtla uyuşmuyor');
  const pt=J('ansiklopedi/tr/'+x.id+'.json').t;
  Object.keys(pt).forEach(k=>{ok(!(k in T),x.id+' sayfa metni başka yerde de var: '+k);T[k]=pt[k]});
  ok(TI[x.names.primary]&&TI['cat.'+x.category]&&TI['risk.'+x.risk_level],x.id+' liste satırının metni dizinde yok');
});
{const f=fs.readdirSync(__dirname+'/../data/ansiklopedi').filter(x=>x.endsWith('.json')).length,g=fs.readdirSync(__dirname+'/../data/ansiklopedi/tr').length;
 ok(f===D.records.length&&g===D.records.length,'artık sayfa dosyası: '+f+'/'+g+', kayıt '+D.records.length)}

// 1. Veri bütünlüğü: her kayıt geçerli, slug ve id tekil, tarama verisindeki her E kodunun sayfası var
R.forEach(r=>{const e=ansValidate(r,T,by);ok(!e.length,r.id+': '+e.join('; '))});
ok(new Set(R.map(r=>r.slug)).size===R.length,'slug tekil değil');
const RG=R.filter(r=>r.product_types[0]==='food'),RT=R.filter(r=>r.product_types[0]==='cleaning'),RK=R.filter(r=>r.product_types[0]==='cosmetic');
ok(RG.length===E.ingredients.length&&E.ingredients.every(i=>by[i.id])&&RG.length+RT.length+RK.length===R.length,'her E kodunun ansiklopedi kaydı olmalı');
RG.forEach(r=>ok(r.slug===ansSlug(r.id+' '+T[r.names.primary]),r.id+' slug JS ile aynı üretilmeli: '+r.slug));
const cur=R.filter(r=>r.review==='curated');
ok(cur.length>=5&&by.E322.review==='curated','en az 5 elle incelenmiş kayıt, E322 dahil');
cur.forEach(r=>{ok(r.sources.some(s=>s.official&&/^https:\/\//.test(s.url)),r.id+' resmi kaynak');ok(r.regulatory.length&&r.related_ids.length&&r.content.found_in.length&&r.effects.length,r.id+' tüm alanlar dolu')});
// Olası etkiler: her elle kayıtta en az bir satır; "yok" satırı aynı kayıtta başka belirtiyle çelişmez; dil "yapar" değil
cur.forEach(r=>{
  const lv=r.effects.map(x=>x.level);
  ok(!(lv.indexOf('yok')>-1&&lv.some(l=>l==='resmi'||l==='bildirildi'||l==='hayvan')&&!r.effects.some(x=>x.level==='yok'&&x.who)),r.id+' "bilinen yan etki yok" ile belirti satırı birlikte (kişi belirtilmeden)');
  r.effects.forEach(x=>ok(!/ yapar\b|neden olur\b|kesin(likle)? (zarar|hastal)/i.test(T[x.text]),r.id+' etkiler dili: '+T[x.text]));
  // Kurum cümleleri Otoriteler sekmesinde; "Vücutta nasıl işlenir?" kurum değerlendirmesi içermez
  if(r.content.in_the_body)ok(!/EFSA|JECFA|ADI|IARC/.test(T[r.content.in_the_body]),r.id+' vücutta bölümünde kurum cümlesi');
  ok(r.content.in_the_body||r.agency_note,r.id+' vücutta ya da kurum notu olmalı');
  // "Vücutta nasıl işlenir?" ve kurum notu üretim yolu, gıdadaki kimya ya da madde tanımı anlatmaz (bunlar Nasıl üretilir? / Ne işe yarar?)
  const nb=/(?<!bakterilerince de )üretil|elde edil|hammadde|Mayalandırma|^Gıdada |^Suda |soy gaz|alkanlar|grubundandır|^Riboflavin B2 vitaminidir|gerekli bir mineral|doğal minerallerdir|doğal olarak (da )?bulunan bir amino|sebzelerle de alınır/;
  if(r.content.in_the_body)ok(!nb.test(T[r.content.in_the_body]),r.id+' vücutta bölümünde üretim/tanım cümlesi: '+T[r.content.in_the_body]);
  if(r.agency_note)T[r.agency_note].split(/(?<=\.)\s+/).forEach(c=>ok(!/^(Mayalandırma|Sentetik olarak) |hammadde olarak kullanılamaz|^Jelatin, /.test(c),r.id+' kurum notunda üretim cümlesi: '+c));
});
ok(by.E420.effects.some(x=>x.level==='resmi'&&/ishal/.test(T[x.text])),'poliol: ishal resmi uyarı');
ok(by.E951.effects.some(x=>x.level==='resmi'&&/PKU/.test(T[x.who])),'aspartam: PKU');
ok(by.E621.effects.some(x=>x.level==='tutarsiz'&&/baş ağrısı/i.test(T[x.text])),'MSG: baş ağrısı kanıt tutarsız');
ok(by.E102.effects.some(x=>x.level==='resmi'&&/Çocuk/.test(T[x.who])),'tartrazin: çocuk uyarısı');
ok(T[by.E441.production.note].indexOf('domuz derisi')>-1&&T[by.E150c.production.note].indexOf('4-MEI')>-1,'üretim ayrıntısı Nasıl üretilir? bölümünde');
ok(by.E440.effects.length===1&&by.E440.effects[0].level==='yok'&&T[by.E440.effects[0].text].indexOf('bilinen bir yan etki yok')>-1,'pektin: bilinen yan etki yok');
// Risk düzeyi tarama verisiyle aynı (iki yerde farklı renk görünmesin)
const RM={green:'green',yellow:'amber',red:'red'};
E.ingredients.forEach(i=>ok(by[i.id].risk_level===RM[i.risk_level],i.id+' risk tarama verisiyle farklı'));
// Korku dili yok
const scary=/zehir|ölümcül|tehlikeli|kesinlikle uzak/i;
Object.keys(T).forEach(k=>ok(!scary.test(T[k]),'korku dili: '+k));

// 2. Model doğrulama: zorunlu alanlar ve geçersiz değerler yakalanır
const good=JSON.parse(JSON.stringify(by.E322));
ok(ansValidate(good,T,by).length===0,'E322 geçerli olmalı');
function bad(mut,expect){const r=JSON.parse(JSON.stringify(good));mut(r);const e=ansValidate(r,T,by);ok(e.some(x=>x.indexOf(expect)>-1),'beklenen hata yok: '+expect+' → '+JSON.stringify(e))}
bad(r=>r.risk_level='orange','risk_level geçersiz');
bad(r=>r.risk_level='yellow','risk_level geçersiz');
bad(r=>r.evidence_level='weak','evidence_level geçersiz');
bad(r=>delete r.evidence_level,'evidence_level geçersiz');
bad(r=>delete r.id,'id eksik');
bad(r=>r.slug='E322 Lesitin','slug geçersiz');
bad(r=>r.names.aliases=[],'names.aliases boş');
bad(r=>r.summary='YOK.anahtar','summary eksik');
bad(r=>r.content.found_in=[],'content.found_in boş');
bad(r=>r.diet_flags.vegan='maybe','diet_flags.vegan geçersiz');
bad(r=>r.regulatory[0].status='ok','regulatory.status geçersiz');
bad(r=>r.profile_warnings[0].severity='critical','profile_warnings.severity geçersiz');
bad(r=>r.related_ids=['E99999'],'related_ids bulunamadı');
bad(r=>r.sources=r.sources.filter(s=>!s.official),'resmi kaynak yok');
bad(r=>r.sources[0].url='http://uydurma','sources url geçersiz');
bad(r=>r.product_types=['drug'],'product_types geçersiz');
bad(r=>r.last_reviewed=null,'last_reviewed eksik');
bad(r=>r.effects=[],'effects boş');
bad(r=>r.effects[0].level='orta','effects.level geçersiz');
bad(r=>r.effects[0].source.url='http://x','effects.source geçersiz');
bad(r=>r.effects[0].text='YOK.anahtar','effects.text eksik');
// Bilinmeyen URL boş + todo ile girilebilir
{const r=JSON.parse(JSON.stringify(good));r.sources.push({title:'x',publisher:'y',year:null,url:'',todo:'URL doğrulanamadı'});ok(ansValidate(r,T,by).length===0,'boş url + todo kabul edilmeli')}
// Otomatik kayıtta kanıt düzeyi ve inceleme tarihi boş olabilir
{const a=JSON.parse(JSON.stringify(by.E1203));a.review='auto';a.evidence_level=null;a.last_reviewed=null;a.effects=[];a.content.in_the_body=null;a.agency_note=null;ok(ansValidate(a,T,by).length===0,'otomatik kayıt geçerli')}

// 3. Türkçe harf duyarsız arama
const IX=ansIndex(D.records,TI),first=q=>{const s=ansSearch(IX,q,5);return s.length?s[0].id:null};
[['E322','E322'],['e-322','E322'],['E 322','E322'],['soya lesitini','E322'],['SOYA LESİTİNİ','E322'],['Soya Lesıtını','E322'],['soy lecithin','E322'],
 ['aycicegi lesitini','E322'],['ayçiçeği lesitini','E322'],['AYÇİÇEĞİ LESİTİNİ','E322'],
 ['sodyum benzoat','E211'],['SODYUM BENZOAT','E211'],['sodyum benzoat'.replace('s','ş'),'E211'],['aspartam','E951'],['ASPARTAM','E951'],
 ['tartrazin','E102'],['TARTRAZİN','E102'],['karmin','E120'],['KARMİN','E120'],['kırmızı 2g','E128'],['kirmizi 2G','E128'],['KIRMIZI 2G','E128'],['zerdeçal','E100'],['ZERDEÇAL','E100']]
 .forEach(([q,id])=>ok(first(q)===id,'arama "'+q+'" → '+first(q)+' (beklenen '+id+')'));
ok(ansSearch(IX,'lesitin',30).some(r=>r.id==='E322')&&ansSearch(IX,'lesitin',30)[0].id==='E322','tam eşleşme önce gelir');
ok(ansSearch(IX,'',30).length===0&&ansSearch(IX,'  - ',30).length===0,'boş arama sonuç döndürmez');
ok(ansSearch(IX,'qqqzzz',30).length===0,'eşleşmeyen arama');
ok(ansFold('Işık')==='isik'&&ansFold('ŞEKER')==='seker'&&ansFold('İçindekiler')==='icindekiler','ansFold Türkçe harfler');

// 4. Profil uyarısı yalnızca eşleşen profilde
const pw=(id,p)=>ansProfileWarnings(by[id],p).map(w=>w.profile).join(',');
ok(pw('E322',{al:['allergen_soy']})==='allergen_soy','soya alerjisi → E322 soya uyarısı');
ok(pw('E322',{al:['allergen_milk']})==='','süt alerjisi → E322 uyarısı yok');
ok(pw('E322',{al:[],vegan:false})==='','profil boş → uyarı yok');
ok(pw('E322',null)==='','profil yok → uyarı yok');
ok(pw('E322',{al:['allergen_soy','allergen_egg'],vegan:true})==='allergen_soy,allergen_egg,vegan','birden çok eşleşme');
ok(pw('E951',{al:[],pku:true})==='pku','PKU → aspartam');
ok(pw('E951',{al:[],vegan:true,child:true})==='','vegan/çocuk → aspartam uyarısı yok');
ok(pw('E120',{al:[],vegan:true})==='vegan'&&pw('E120',{al:[],veg:true})==='veg','karmin vegan/vejetaryen');
ok(pw('E102',{al:[],child:true})==='child'&&pw('E102',{al:[],preg:true})==='','tartrazin yalnızca çocuk/bebek');
ok(pw('E102',{al:[],child:'true'})==='','profil değeri tam true olmalı');
ok(pw('E220',{al:['allergen_sulphite']})==='allergen_sulphite','otomatik kayıt: sülfit');
ok(pw('E211',{al:[],salt:true})==='salt','sodyum benzoat → tuz kısıtlaması');

// 5. Kaynak başlığı, yayımcı ve kurum adı çeviri anahtarı (12.10.2026); İngilizcede Türkçe ad kalmaz (çevirisi yoksa özgün ad görünür)
{const EN=Object.assign({},J('ansiklopedi_en.json').t);fs.readdirSync(__dirname+'/../data/ansiklopedi/en').forEach(f=>Object.assign(EN,J('ansiklopedi/en/'+f).t));
 R.forEach(r=>{const ad=[...r.sources.flatMap(s=>[s.title,s.publisher]),...r.regulatory.map(g=>g.agency),...(r.effects||[]).flatMap(x=>[x.source.label,x.source.title])];
  ad.forEach(k=>{ok(/^kaynak\.[0-9a-f]{10}$/.test(k)&&T[k],r.id+' kaynak adı anahtar değil: '+k);
   const s=EN[k]||T[k]||'';ok(!/[çğıöşüÇĞİÖŞÜ]/.test(s.replace(/Türkiye/g,''))&&!/\b(ve|kopyası|özeti|Tüzük|Avrupa|metin)\b/.test(s),r.id+' İngilizcede Türkçe kaynak adı: '+s)})})}

// Vegan durumu (12.10.2026): "evet" yalnızca doğrulanmış üretim yolu hayvansal hammadde içermiyorsa; hayvansal yolu olabilenler bilinmiyor kalır
{const v=RG.filter(r=>r.diet_flags.vegan==='unknown').map(r=>r.id);
 ok(v.length<=55,'vegan bilinmeyen kayıt arttı: '+v.length);
 ['E471','E422','E322','E640','E920','E570'].forEach(id=>ok(by[id].diet_flags.vegan!=='yes',id+' hayvansal kaynaklı olabilir, vegan evet olmamalı'));
 R.filter(r=>r.diet_flags.vegan==='yes').forEach(r=>{const i=E.ingredients.find(x=>x.id===r.id);
  ok(!i.flags.some(f=>['non_vegan','vegan_suspect','insect_derived'].includes(f)),r.id+' vegan evet ama bayrağı hayvansal')});
 ok(by.E966.diet_flags.vegan==='no'&&E.ingredients.find(x=>x.id==='E966').flags.includes('non_vegan'),'E966 laktitol laktozdan üretilir, vegan değil');}

// 6. Temizlik ansiklopedisi (15.10.2026): kimlik CAS, renk temizlik verisindeki H/EUH düzeyinden (sonuç ekranıyla aynı kural)
{const TDB=J('temizlik.json'),HZ={};TDB.hazards.forEach(h=>HZ[h.code]=h);const RK={red:2,yellow:1,info:0},RM2={2:'red',1:'amber',0:'green'};
 const K=JSON.parse(fs.readFileSync(__dirname+'/../kaynak/ansiklopedi_temizlik.json','utf8')).kayitlar;
 ok(RT.length===30&&K.length===30,'30 temizlik maddesi: '+RT.length);
 K.forEach(k=>{const r=by[k.id];if(!r){ok(false,k.id+' kaydı yok');return}
  ok(/^\d{2,7}-\d\d-\d$/.test(k.id),k.id+' CAS biçimi');
  // CAS kontrol hanesi
  const d=k.id.replace(/-/g,''),g=d.slice(0,-1).split('').reverse().reduce((a,c,i)=>a+(+c)*(i+1),0);ok(g%10===+d.slice(-1),k.id+' CAS kontrol hanesi');
  const kod=k.clp.h.concat(k.clp.euh||[]),en=Math.max(0,...kod.map(c=>RK[HZ[c].level]));
  ok(r.risk_level===RM2[en],k.id+' renk H kodlarıyla uyuşmuyor: '+r.risk_level);
  ok(r.effects.length===Math.max(1,kod.length)&&r.effects.every(x=>x.level===(kod.length?'resmi':'yok')),k.id+' her H kodu bir etki satırı');
  ok(r.sources.some(s=>s.official&&/^https:\/\/chem\.echa\.europa\.eu\/100\.\d{3}\.\d{3}\/overview$/.test(s.url)),k.id+' ECHA CHEM kaynağı');
  if(k.clp.tur==='harmonize')ok(r.regulatory.some(g=>g.status==='classified'&&/CELEX:3\d{4}R\d{4}$/.test(g.source_url))&&r.evidence_level==='strong',k.id+' uyumlaştırılmış sınıf EUR-Lex bağlantısıyla');
  else ok(/uyumlaştırılmış sınıflandırması yok/.test(T[r.regulatory[0].detail])&&r.evidence_level==='moderate',k.id+' firma sınıflandırması olduğu yazılı');
  ok(r.related_ids.length>0&&r.agency_note,k.id+' benzer maddeler ve not');
 });
 ok(by['7681-52-9'].risk_level==='red'&&by['144-55-8'].risk_level==='green'&&by['77-92-9'].risk_level==='amber','çamaşır suyu kırmızı, karbonat yeşil, sitrik asit sarı');
 ok(first('çamaşır suyu')==='7681-52-9'&&ansSearch(IX,'kostik soda',2).some(r=>r.id==='1310-73-2')&&first('SLES')==='68891-38-3'&&first('7681-52-9')==='7681-52-9'&&ansSearch(IX,'tuz ruhu',2).some(r=>r.id==='7647-01-0'),'temizlik araması (ad, halk adı, kısaltma, CAS)');
 ok(pw('9014-01-1',{al:[],astim:true})==='astim'&&pw('5989-27-5',{al:[],koku:true})==='koku'&&pw('5989-27-5',{al:[]})==='','temizlik profil uyarıları (astım, koku)');
 RT.forEach(r=>ok(!r.production&&r.diet_flags.vegan==='unknown',r.id+' gıda alanı yok'));
}
// 7. Kozmetik ansiklopedisi (15.10.2026, U-01 ilk parti): kimlik INCI (boşluk yerine _), renk Etiket Oku'daki kozmetik sonucuyla (kResult) aynı
{const KDB=J('kozmetik.json'),KI=buildKIndex(KDB,J('kozmetik_inci.json')),RM3={info:'green',yellow:'amber',orange:'red',red:'red'};
 const K=JSON.parse(fs.readFileSync(__dirname+'/../kaynak/ansiklopedi_kozmetik.json','utf8')).kayitlar;
 ok(RK.length===K.length&&K.length>=30,'kozmetik maddesi: '+RK.length);
 K.forEach(k=>{const id=k.inci.replace(/ /g,'_'),r=by[id];if(!r){ok(false,id+' kaydı yok');return}
  ok(/^[A-Z0-9_\-]+$/.test(id),id+' kimlik dosya adına uygun');
  const s=KI.map.get(norm(k.inci));ok(s,id+' INCI dizinde yok');
  if(s){const kr=kResult(k.inci,{s:s,how:'tam'},false,0,KI,{});ok(r.risk_level===RM3[kr.level],id+' renk Etiket Oku ile aynı değil: '+r.risk_level+' / '+kr.level)}
  const ents=KDB.entries.filter(e=>e.inci.includes(k.inci));
  ok(r.regulatory.filter(g=>/\.reg\.\d+$/.test(g.detail)).length===ents.length,id+' her AB ek kaydı bir kurum satırı');
  ok(ents.length||r.regulatory.some(g=>g.status==='not_listed'),id+' ekte yoksa "listede yok" satırı');
  r.regulatory.filter(g=>/\.reg\.\d+$|^koz\.reg\.yok$/.test(g.detail)).forEach(g=>ok(/CELEX:3\d{4}R\d{4}$/.test(g.source_url),id+' EUR-Lex bağlantısı: '+g.source_url));
  ok(r.sources.some(s=>s.official&&s.url==='https://ec.europa.eu/growth/tools-databases/cosing/'),id+' CosIng kaynağı');
  ok(r.effects.length>0&&r.related_ids.length>0,id+' etki ve benzer madde');
  ok(r.slug===ansSlug(k.inci),id+' slug INCI adından');
 });
 ok(by.PHENOXYETHANOL.risk_level==='green'&&by.METHYLISOTHIAZOLINONE.risk_level==='amber'&&by.SALICYLIC_ACID.risk_level==='red'&&by.GLYCERIN.risk_level==='green','fenoksietanol yeşil, MIT sarı, salisilik asit (CMR 2) turuncu-kırmızı, gliserin yeşil');
 ok(first('phenoxyethanol')==='PHENOXYETHANOL'&&ansSearch(IX,'SODIUM LAURETH SULFATE',2).some(r=>r.id==='SODIUM_LAURETH_SULFATE')&&ansSearch(IX,'oksibenzon',3).some(r=>r.id==='BENZOPHENONE-3')&&ansSearch(IX,'shea',3).some(r=>r.id==='BUTYROSPERMUM_PARKII_BUTTER'),'kozmetik araması (INCI, Türkçe ad, halk adı)');
 ok(ansSearch(IX,'limonen',5).some(r=>r.id==='LIMONENE')&&ansSearch(IX,'limonen',5).some(r=>r.id==='5989-27-5'),'aynı madde kozmetik ve temizlikte ayrı sayfa');
 ok(pw('LIMONENE',{al:[],koku:true})==='koku'&&pw('PROPYLPARABEN',{al:[],baby:true})==='baby'&&pw('BENZOPHENONE-3',{al:[],preg:true})==='preg'&&pw('GLYCERIN',{al:[],koku:true,preg:true})==='','kozmetik profil uyarıları (koku, bebek, endokrin listesi)');
 ok(by.SODIUM_LAURETH_SULFATE.effects.some(x=>x.text==='tem.h.H318'&&x.amount==='koz.eff.miktar'),'SLES: saf maddenin ECHA sınıfı etki satırı');
 RK.forEach(r=>ok(!r.production,r.id+' üretim yolu alanı yok'));
}
console.log(n+' ansiklopedi denetimi, '+fail+' hata');process.exit(fail?1:0);
