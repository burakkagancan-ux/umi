// Ülke mevzuat katmanı (B-05): data/ulke.json (gen_ulke.py) ve js/ulke.js. Bütün ülkeler aynı modelde; arayüzde ülke koşulu kodda yazılmaz.
// Çalıştır: node test/ulke.js
const fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
(async()=>{
const U=await import(path.join(R,'js','ulke.js'));
const V=JSON.parse(fs.readFileSync(path.join(R,'data','ulke.json'),'utf8'));
const E=JSON.parse(fs.readFileSync(path.join(R,'data','e_kodlari.json'),'utf8')).ingredients,by=Object.fromEntries(E.map(x=>[x.id,x]));
ok(['TR','GB','US'].every(k=>V.u[k]),'Türkiye, Birleşik Krallık, ABD aynı dosyada');
for(const [k,u] of Object.entries(V.u)){
  ok(V.meta.kaynaklar[u.kaynak]&&/^https:\/\//.test(V.meta.kaynaklar[u.kaynak].url),k+': kaynağı ve bağlantısı var');
  ok(Object.entries(u.k).every(([i,r])=>by[i]&&U.ULKE_DURUMLAR.includes(r[0])),k+': her satır bilinen E kodu ve durum');
}
// Kaynakla doğrulanmış örnekler (21.10.2026)
const d=(u,i)=>{const r=U.ulkeKatman(V,u).katki(i);return r&&r.d};
ok(d('TR','E171')==='izinli_degil','TR: E171 izinli değil (TGK 2023)');
ok(d('GB','E171')==='izinli','GB: E171 izinli (FSA listesi)');
ok(d('US','E171')==='izinli'&&/%1|1 ?%/.test(U.ulkeNot(U.ulkeKatman(V,'US').katki('E171').not,'tr')),'US: E171 izinli, %1 sınırı (21 CFR 73.575)');
ok(d('US','E127')==='iptal','US: E127 izni iptal (FDA 2025)');
ok(d('US','E124')==='izinli_degil'&&d('US','E952')==='izinli_degil','US: E124 listede yok, siklamat yasak (21 CFR 189.135)');
ok(d('US','E141')==='kisitli','US: bakır klorofilin yalnızca kuru içecek karışımında');
ok(d('US','E330')===null,'US: renklendirici olmayan katkı değerlendirilmedi (satır yok)');
ok(d('GB','E483')==='izinli'&&d('GB','E431')==='belirsiz','GB: E483 izinli (AB çıkardı), E431 doğrulanmadı');
ok(U.ulkeKatman(V,'TR').katki('E150a').d==='izinli','alt türlü kod (E150a) listede sayılır');
// Model: seçilmemiş ya da katmanı olmayan ülke → null (bugünkü davranış)
ok(U.ulkeKatman(V,'')===null&&U.ulkeKatman(V,'IE')===null&&U.ulkeKatman(null,'TR')===null,'katmanı olmayan ülke: null');
ok(U.ulkeOzellik(U.ulkeKatman(V,'TR'),'marka_listesi')===true&&U.ulkeOzellik(U.ulkeKatman(V,'GB'),'marka_listesi')===null,'ülkeye özgü kart özellikle');
ok(U.ulkeNot({tr:'a',en:'b'},'tr')==='a'&&U.ulkeNot({tr:'',en:'b'},'de')==='b'&&U.ulkeNot('x','en')==='x'&&U.ulkeNot('', 'tr')==='','not dili: seçili → İngilizce');
// Kodda ülke adı/kodu koşulu yok (B-05 kabul ölçütü)
const js=fs.readdirSync(path.join(R,'js')).filter(f=>/\.js$/.test(f));
const kosul=js.filter(f=>/ulke\(\)\s*[!=]==?\s*"[A-Z]{2}"/.test(fs.readFileSync(path.join(R,'js',f),'utf8')));
ok(!kosul.length,'js/ içinde ülke koduyla koşul yok: '+kosul.join(', '));
console.log(n+' ülke denetimi, '+fail+' hata');process.exit(fail?1:0);
})();
