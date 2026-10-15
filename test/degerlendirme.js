// Ortak değerlendirme modeli (js/degerlendirme.js): tür kaydı, degerlendir, degHazir, degTanima. Çalıştır: node test/degerlendirme.js
const fs=require('fs'),path=require('path');
const L=require('./yukle.js');
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
const oku=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',f),'utf8'));
const idx=L.buildIndex(oku('e_kodlari.json'),oku('bilesenler.json')),K=L.buildKIndex(oku('kozmetik.json'),oku('kozmetik_inci.json')),T=L.buildTIndex(oku('temizlik.json'),K);
const c={idx,K,T,ptype:'leave'},D=JSON.parse(fs.readFileSync(path.join(__dirname,'veri','altin_metinler.json'),'utf8'));
const prof={al:['allergen_milk'],alOzel:['kivi'],vegan:true,koku:true,astim:true,baby:true};
const j=x=>JSON.stringify(x);
// 1) Her tür kayıtlı ve gerekli dizini biliyor
ok(j(Object.keys(L.TURLER).sort())==='["gida","koz","tem"]','türler: '+Object.keys(L.TURLER));
ok(L.degHazir('gida',{idx})&&!L.degHazir('gida',{})&&L.degHazir('koz',{K})&&!L.degHazir('tem',{T})&&L.degHazir('tem',{T,K})&&!L.degHazir('yok',c),'degHazir: türün dizinleri');
// 2) degerlendir = türün ürün modeli + mode (sonuç değişmez; altın test ayrıca bütün çıktıyı denetler)
const ayni=(a,b)=>{const x=Object.assign({},a),y=Object.assign({},b);delete x.mode;delete y.mode;return j(x)===j(y)};   // kozmetik ve temizlik modelinde mode zaten var
for(const m of D.gida.slice(0,40))ok(ayni(L.degerlendir('gida',m,c,prof,'A'),L.cmpProduct(m,idx,prof,'A'))&&L.degerlendir('gida',m,c,prof,'A').mode==='gida','gıda modeli: '+m.slice(0,50));
for(const x of D.koz.slice(0,30)){const m=typeof x==='string'?x:x.m;ok(ayni(L.degerlendir('koz',m,c,prof),L.cmpProductK(m,K,prof,'',{ptype:'leave'})),'kozmetik modeli (ürün tipi bağlamdan): '+m.slice(0,50))}
for(const m of D.tem.slice(0,30))ok(ayni(L.degerlendir('tem',m,c,prof),L.cmpProductT(m,T,K,prof,'')),'temizlik modeli: '+m.slice(0,50));
ok(L.degerlendir('bilinmeyen','Şeker, E330',c).mode==='gida','bilinmeyen tür gıda sayılır');
ok(j(L.degerlendir('gida','Şeker',c).misfit)==='[]','profil verilmezse uyumsuzluk yok');
// 3) Her modelde ortak alanlar
for(const m of ['gida','koz','tem']){const P=L.degerlendir(m,L.t('ornek.'+m),c,prof);
  ok(Array.isArray(P.items)&&P.counts.length===4&&typeof P.maxRank==='number'&&Array.isArray(P.top)&&P.unknown&&Array.isArray(P.misfit)&&P.S,m+': ortak alanlar')}
// 4) degTanima: barkod katkısının eski hesaplarıyla aynı
{const m=L.t('ornek.gida'),P=L.degerlendir('gida',m,c);ok(j(L.degTanima(P))===j({total:P.unknown.total,found:P.unknown.found}),'gıda tanıma')}
{const m=L.t('ornek.koz'),S=L.summarizeK(L.analyzeK(m,K,{ptype:'leave'}),K);ok(j(L.degTanima(L.degerlendir('koz',m,c)))===j({total:S.total,found:S.found}),'kozmetik tanıma')}
{const m=L.t('ornek.tem'),A=L.analyzeT(m,T,K);ok(j(L.degTanima(L.degerlendir('tem',m,c)))===j({total:0,found:A.hazards.length+A.subs.length+A.inci.length}),'temizlik tanıma')}
// 5) Paylaşım kartı hazır modelle aynı sonucu verir (yeniden hesaplamadan)
{const m=L.t('ornek.gida'),P=L.degerlendir('gida',m,c,prof);ok(j(L.payFromFood(m,idx,P))===j(L.payFromFood(m,idx)),'payFromFood hazır modelle aynı (profil kartı etkilemez)')}
console.log(n+' değerlendirme denetimi, '+fail+' hata');process.exit(fail?1:0);
