// Ansiklopedi: veri bütünlüğü, model doğrulama, Türkçe harf duyarsız arama, profil uyarısı eşleşmesi.
// Çalıştır: node test/ansiklopedi.js
const fs=require('fs');
eval(['ortak','ansiklopedi'].map(f=>fs.readFileSync(__dirname+'/../js/'+f+'.js','utf8')).join('\n'));
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
ok(R.length===E.ingredients.length&&E.ingredients.every(i=>by[i.id]),'her E kodunun ansiklopedi kaydı olmalı');
R.forEach(r=>ok(r.slug===ansSlug(r.id+' '+T[r.names.primary]),r.id+' slug JS ile aynı üretilmeli: '+r.slug));
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

console.log(n+' ansiklopedi denetimi, '+fail+' hata');process.exit(fail?1:0);
