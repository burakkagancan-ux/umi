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
ok(d('GB','E483')==='izinli'&&d('GB','E431')==='izinli','GB: E483 izinli (AB çıkardı), E431 izinli (FSA kaydı; GOV.UK sayfasında yok)');
ok(/Kuzey İrlanda/.test(U.ulkeNot(U.ulkeKatman(V,'GB').katki('E171').not,'tr'))&&/Northern Ireland/.test(U.ulkeNot(U.ulkeKatman(V,'GB').katki('E171').not,'en')),'GB: E171 Kuzey İrlanda notu');
ok(d('US','E170')==='kisitli'&&d('US','E180')==='izinli_degil','US: E170 yalnızca belirli gıdalarda (73.70), E180 listede yok');
// AB'de katkı sayılmayan madde (jelatin) hiçbir ülkede 'izinli değil' görünmez (bozma turu: "jelatin İngiltere'de yasak" okunuyordu)
for(const k of Object.keys(V.u))E.filter(x=>x.eu_status==='not_an_additive_in_eu').forEach(x=>ok(d(k,x.id)!=='izinli_degil',k+' '+x.id+': AB\'de katkı değil, izinli değil denmez'));
// data/ulke.json gelmese de özellikler kodla gelir (zehir hattı, marka listesi kaybolmaz)
ok(U.ulkeOzellik(U.ulkeKatman(null,'TR'),'zehir_hatti')===true&&U.ulkeKatman(null,'TR').katki('E171')===null,'veri yokken TR özellikleri ULKE_OZ\'den');
ok(U.ulkeKatman(V,'TR').katki('E150a').d==='izinli','alt türlü kod (E150a) listede sayılır');
// Model: seçilmemiş ya da katmanı olmayan ülke → null (bugünkü davranış)
ok(U.ulkeKatman(V,'')===null&&U.ulkeKatman(V,'IE')===null&&U.ulkeKatman(null,'IE')===null,'katmanı olmayan ülke: null');
ok(U.ulkeOzellik(U.ulkeKatman(V,'TR'),'marka_listesi')===true&&U.ulkeOzellik(U.ulkeKatman(V,'GB'),'marka_listesi')===null,'ülkeye özgü kart özellikle');
ok(U.ulkeNot({tr:'a',en:'b'},'tr')==='a'&&U.ulkeNot({tr:'',en:'b'},'de')==='b'&&U.ulkeNot('x','en')==='x'&&U.ulkeNot('', 'tr')==='','not dili: seçili → İngilizce');
// Kodda ülke adı/kodu koşulu yok (B-05 kabul ölçütü)
const js=fs.readdirSync(path.join(R,'js')).filter(f=>/\.js$/.test(f));
// her iki yön, tek/çift tırnak; arayüz dosyalarında iki büyük harfli dize sabiti de (ULKELER tanımı js/ceviri.js'te, üretilmiş ulke_oz.js hariç)
const kosul=js.filter(f=>{const s=fs.readFileSync(path.join(R,'js',f),'utf8');
  return /ulke\(\)\s*[!=]==?\s*["'][A-Z]{2}["']|["'][A-Z]{2}["']\s*[!=]==?\s*ulke\(\)/.test(s)||(/^arayuz_/.test(f)&&/["'](TR|US|GB|IE|CA|AU|DE|FR|NL)["']/.test(s))});
ok(!kosul.length,'js/ içinde ülke koduyla koşul yok: '+kosul.join(', '));
console.log(n+' ülke denetimi, '+fail+' hata');process.exit(fail?1:0);
})();
