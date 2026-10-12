// Kanserojen uyarısı (gıda, kozmetik, temizlik). Çalıştır: node test/kanser.js
const fs=require('fs');
const {idx,L}=require('./run.js');
const {K,KL}=require('./kozmetik_cases.js');
eval(require('./yukle.js')+';global.TL={buildTIndex,analyzeT,summarizeT}');
const T=TL.buildTIndex(JSON.parse(fs.readFileSync(__dirname+'/../data/temizlik.json')));
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
const g=t=>L.summarize(L.analyze(t,idx),idx).cancer.map(c=>typeof c==='string'?c:c.name).join();
const k=t=>KL.summarizeK(KL.analyzeK(t,K,{}),K).cancer.join();
const tm=t=>TL.summarizeT(TL.analyzeT(t,T,K)).cancer.join();
// Gıda: maddenin kendisi IARC 1/2A/2B
ok(/E250/.test(g("İçindekiler: Dana eti, tuz, koruyucu (sodyum nitrit)")),'nitrit');
ok(/E951/.test(g("İçindekiler: Su, tatlandırıcı (aspartam)")),'aspartam');
ok(/E150d/.test(g("İçindekiler: Su, renklendirici (E150d)")),'karamel E150d');
ok(g("İçindekiler: Su, koruyucu (sodyum benzoat), askorbik asit")==='','benzoat kanserojen sayıldı');
ok(g("İçindekiler: Su, tatlandırıcı (sakarin)")==='','sakarin (IARC Grup 3) kanserojen sayıldı');
ok(g("İçindekiler: Pirinç, renklendirici (kurkumin)")==='','kurkumin ("kanser yapıcı bulunmadı") sayıldı');
// Kozmetik: CMR ya da formaldehit salıcı
ok(k("Aqua, Glycerin, DMDM Hydantoin")!=='','formaldehit salıcı');
ok(k("Aqua, Glycerin, Cetearyl Alcohol, Parfum")==='','sıradan liste kanserojen sayıldı');
// Temizlik: yalnızca H350/H350i/H351
ok(/H351/.test(tm("DİKKAT. Kansere yol açma şüphesi var.")),'H351');
ok(/H350/.test(tm("H350 Kansere yol açabilir.")),'H350');
ok(tm("H360 Doğmamış çocukta hasara yol açabilir.")==='','H360 kanser sayıldı');
// Renk kuralı (09.10.2026, kullanıcı kararı): IARC Grup 1/2A/2B olan madde (ya da üretim yan ürünü/ayrışma ürünü) kırmızı.
// İstisna: kanserojenin yalnızca belirli koşullarda oluşabildiği maddeler (benzoat + C vitamini → benzen) sarı kalır.
for(const e of JSON.parse(fs.readFileSync(__dirname+'/../data/e_kodlari.json')).ingredients){
  if(!/Grup (1|2A|2B)\b/.test(e.reason||''))continue;
  const kosullu=/benzen oluşturabilir/.test(e.reason);
  ok(kosullu?e.risk_level==='yellow':e.risk_level==='red',e.id+' IARC rengi '+e.risk_level);
}
console.log(n+' durum, '+fail+' hata');process.exit(fail?1:0);
