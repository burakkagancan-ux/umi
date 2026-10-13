// Besin değeri tablosu (A-02): tutarlılık denetimi, Open Food Facts dönüşümü (uygulama, Worker ve off_al.py aynı sonucu verir),
// etiket metninden tablo ayrıştırma (satır satır, hücre hücre, sütun sütun okunmuş OCR; porsiyon/%RI sütunu; diller; içerik listesiyle aynı metin).
// Çalıştır: node test/besin.js
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
eval(require('./yukle.js')+';global.B={besinDuzey,besinGorunum,besinMetinAnahtar,besinElleEkle,besinElleBul,BESIN_ESIK,besinOff,besinBirim,besinDiziden,besinDenetle,besinAyristir,besinSozluk,besinNorm,besinParcala,barkodOffBul,barkodSec,BESIN_ALAN}');
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
const veri=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','besin.json'),'utf8'));
const S=B.besinSozluk(veri);
const ay=t=>B.besinAyristir(t,S);
const yakin=(a,b)=>a!=null&&Math.abs(a-b)<0.01;
const j=x=>JSON.stringify(x);
(async()=>{
// 1) Tutarlılık denetimi
let d=B.besinDenetle({kcal:505,yag:25.1,doymus:16,karb:68.75,seker:30.5,protein:3.2,tuz:0.1});
ok(d.durum==='tamam'&&!d.sorun.length&&!d.eksik.length,'tutarlı çikolata '+j(d));
d=B.besinDenetle({kcal:132,yag:0,doymus:0,karb:8.1,seker:8.1,lif:0,protein:0,tuz:0});   // gerçek OFF kaydı (ICE tea): kJ değeri kcal yazılmış
ok(d.durum==='suphe'&&d.sorun.includes('kj_kcal'),'kJ yerine kcal '+j(d));
ok(B.besinDenetle({kcal:300,yag:5,doymus:8,karb:50,seker:10,protein:10,tuz:1}).sorun.includes('doymus_yag'),'doymuş yağ > yağ');
ok(B.besinDenetle({kcal:300,yag:5,doymus:1,karb:20,seker:30,protein:10,tuz:1}).sorun.includes('seker_karb'),'şeker > karbonhidrat');
ok(B.besinDenetle({yag:60,karb:50,protein:5,tuz:1}).sorun.includes('toplam'),'toplam 100 g\'ı aşıyor');
ok(B.besinDenetle({kcal:250,yag:25,karb:68,protein:3,doymus:16,seker:30,tuz:0.1}).sorun.includes('enerji'),'enerji makrolarla uyuşmuyor (25 g yağ + 68 g karbonhidrat 250 kcal olamaz)');
ok(B.besinDenetle({tuz:150}).sorun.includes('yuz_asti'),'100 g\'da 150 g tuz');
ok(B.besinDenetle({kcal:3404}).sorun.includes('enerji_ust'),'100 g\'da 900 kcal üstü');
d=B.besinDenetle({kcal:43,yag:0,karb:3.6,seker:0.2,protein:0.4,tuz:0});   // bira: alkol 7 kcal/g, makrolardan hesaplanamaz → sorulur
ok(d.durum==='suphe','alkollü içecekte enerji denetimi geçmez (bilerek: sorulur)');
d=B.besinDenetle({kcal:828,yag:92,doymus:10,karb:0,seker:0,protein:0,tuz:0});
ok(d.durum==='tamam','sıvı yağ (100 ml, 92 g yağ) '+j(d));
d=B.besinDenetle({kcal:40,karb:10});
ok(d.durum==='tamam'&&j(d.eksik)===j(['yag','doymus','seker','tuz']),'eksik ana satırlar listelenir '+j(d));
ok(B.besinDenetle(null).durum==='yok'&&B.besinDenetle({}).durum==='yok','değer yok');
ok(B.besinDenetle({kcal:20,yag:0.1,doymus:0.1,karb:4,seker:4.05,protein:0.5,tuz:0.01}).durum==='tamam','yuvarlama payı (şeker 4,05 > karbonhidrat 4)');

// 2) Open Food Facts → bizim biçim; uygulama, Worker ve off_al.py aynı sonucu verir
const ornekler=[
  [{'energy-kcal_100g':505,fat_100g:25.1,'saturated-fat_100g':16,carbohydrates_100g:68.75,sugars_100g:30.5,proteins_100g:3.2,salt_100g:0.1,sodium_100g:0.04},'100 g'],
  [{'energy-kj_100g':2151.85,fat_100g:'25.1',sodium_100g:0.4},'45cl'],
  [{energy_100g:418.4,fiber_100g:3},'1,5 L'],
  [{fat_100g:-1,proteins_100g:'abc',salt_100g:''},''],
  [{},'250 g'],
  [{'energy-kcal_100g':0,sugars_100g:0},'1 lt'],
];
const W=await import(path.join(__dirname,'..','worker','src','barkod.js'));
const py=JSON.parse(execFileSync('python3',['-I','-c',`
import importlib.util,json,sys
sp=importlib.util.spec_from_file_location('o',sys.argv[1]);o=importlib.util.module_from_spec(sp);sp.loader.exec_module(o)
print(json.dumps([o.besin_al({'nutriments':n,'quantity':q}) for n,q in json.loads(sys.argv[2])]))`,path.join(__dirname,'..','off_al.py'),j(ornekler)]).toString());
ornekler.forEach(([nu,q],i)=>{
  const a=B.besinOff(nu,q),w=W.besinOff(nu,q),p=py[i];
  ok(j(a)===j(w),'Worker farklı #'+i+' '+j(a)+' / '+j(w));
  const norm=x=>x&&Object.fromEntries(Object.entries(x).map(([k,v])=>[k,typeof v==='number'?Math.round(v*1000)/1000:v]));
  ok(j(norm(a))===j(norm(p)&&Object.fromEntries(Object.keys(a||{}).map(k=>[k,norm(p)[k]]))),'off_al.py farklı #'+i+' '+j(a)+' / '+j(p));
});
let o=B.besinOff(ornekler[1][0],ornekler[1][1]);
ok(yakin(o.kcal,514.3)&&yakin(o.tuz,1)&&o.birim==='ml','kJ → kcal, sodyum → tuz, cl → ml '+j(o));
ok(B.besinOff({},'')===null&&B.besinOff(null)===null,'değersiz kayıt null');
ok(B.besinBirim('1,5 L')==='ml'&&B.besinBirim('45cl')==='ml'&&B.besinBirim('250 g')==='g'&&B.besinBirim('2 kg')==='g'&&B.besinBirim('205')==='','ambalaj birimi');
ok(j(B.besinDiziden([505,25.1,16,null,30.5,null,3.2,0.1,'g']))===j({kcal:505,yag:25.1,doymus:16,karb:null,seker:30.5,lif:null,protein:3.2,tuz:0.1,birim:'g'}),'kısa biçimden');

// 3) Barkod: besin OFF kaydından gelir; seçilen kaynak kendi veritabanımızsa OFF'tan eklenir
const off={u:{'8690504025207':['food','Çikolata','X',1700000000,{tr:'Kakao, şeker'},[505,25.1,16,68.75,30.5,null,3.2,0.1,'g']]}};
const r=B.barkodOffBul(off,'8690504025207');
ok(r.besin&&r.besin.kcal===505&&r.besin.birim==='g','uygulamadaki OFF kaydında besin');
const urun={kod:'8690504025207',kaynak:'urun',tur:'gida',ad:'',metin:{tr:'Kakao kitlesi, şeker'},dogrulandi:true};
const sec=B.barkodSec({urun,off:r},['tr']);
ok(sec.kaynak==='urun'&&sec.besin&&sec.besin.yag===25.1&&!urun.besin,'doğrulanmış katkı seçilir, besin OFF\'tan eklenir, asıl kayıt değişmez');
ok(B.barkodSec({off:{...r,metin:{}}},['tr']).besin.kcal===505,'içeriği olmayan üründe de besin taşınır');
ok(!B.barkodSec({urun},['tr']).besin,'OFF yoksa besin yok');
const offVeri=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','barkod_off.json'),'utf8'));
const bes=Object.values(offVeri.u).filter(x=>x.length>5);
ok(!bes.length||j(offVeri.meta.besin_alan)===j([...B.BESIN_ALAN,'birim']),'barkod_off.json besin sırası js/besin.js ile aynı');
ok(bes.every(x=>x[5].length===9&&['g','ml',''].includes(x[5][8])),'barkod_off.json besin dizileri 9 öğe');
if(bes.length){
  const say={};bes.forEach(x=>{const dd=B.besinDenetle(B.besinDiziden(x[5]));say[dd.durum]=(say[dd.durum]||0)+1;dd.sorun.forEach(s=>say[s]=(say[s]||0)+1)});
  console.log('BİLGİ barkod_off.json: '+bes.length+' ürünün besin değeri var; denetim: '+j(say));
}

// 4) Sözlük: her ad tek alana gider; uzun ad kısa adı yutar
ok(S.ad['doymus yag']==='doymus'&&S.ad['yag']==='yag'&&S.ad['trans yag']==='_atla','Türkçe adlar');
ok(B.besinNorm('Eiweiß')==='eiweiss'&&B.besinNorm('Protéines')==='proteines'&&B.besinNorm('ŞEKERLER')==='sekerler'&&B.besinNorm('Белки')==='белки','harf/aksan duyarsız, Latin dışı alfabe korunur');

// 5) Etiket metninden tablo
const T1=`BESİN DEĞERLERİ   100 g'da   Porsiyon (30 g)   %BRD*
Enerji  2151 kJ / 505 kcal   645 kJ / 152 kcal   8%
Yağ  25,1 g   7,5 g   11%
Doymuş Yağ  16 g   4,8 g   24%
Karbonhidrat  68,8 g   20,6 g   8%
Şekerler  30,5 g   9,2 g   10%
Lif  1,2 g  0,4 g
Protein  3,2 g   1,0 g   2%
Tuz  0,1 g   0,03 g   2%
*Referans alım: ortalama bir yetişkin (8400 kJ/2000 kcal)`;
let a=ay(T1);
ok(a&&a.durum==='tamam'&&a.b.kcal===505&&a.b.yag===25.1&&a.b.doymus===16&&a.b.karb===68.8&&a.b.seker===30.5&&a.b.lif===1.2&&a.b.protein===3.2&&a.b.tuz===0.1&&a.birim==='g'&&a.sutun===0,'Türkçe tablo, 100 g ilk sütun '+j(a));
// porsiyon sütunu önde
a=ay(`Besin değerleri | Porsiyon (25 g) | 100 g
Enerji | 126 kcal | 505 kcal
Yağ | 6,3 g | 25,1 g
Doymuş yağ | 4 g | 16 g
Karbonhidrat | 17,2 g | 68,8 g
Şekerler | 7,6 g | 30,5 g
Protein | 0,8 g | 3,2 g
Tuz | 0,03 g | 0,1 g`);
ok(a&&a.sutun===1&&a.b.kcal===505&&a.b.yag===25.1&&a.b.tuz===0.1&&a.durum==='tamam','porsiyon sütunu önce: 100 g sütunu seçilir '+j(a));
// hücre hücre (OCR her hücreyi ayrı satıra yazmış)
a=ay(`Besin Öğeleri\n100 g\nEnerji\n2151 kJ\n505 kcal\nYağ\n25,1 g\nDoymuş yağ\n16 g\nKarbonhidrat\n68,8 g\nŞekerler\n30,5 g\nProtein\n3,2 g\nTuz\n0,1 g`);
ok(a&&a.durum==='tamam'&&a.b.kcal===505&&a.b.seker===30.5&&a.yontem==='satir','hücre hücre okunmuş tablo '+j(a));
// sütun sütun (önce bütün adlar, sonra bütün değerler): sıra tahmin, hep sorulur
a=ay(`100 g\nEnerji\nYağ\nDoymuş yağ\nKarbonhidrat\nŞekerler\nProtein\nTuz\n2151 kJ / 505 kcal\n25,1 g\n16 g\n68,8 g\n30,5 g\n3,2 g\n0,1 g`);
ok(a&&a.yontem==='sutun'&&a.durum==='suphe'&&a.sorun.includes('sutun_sira')&&a.b.kcal===505&&a.b.yag===25.1&&a.b.tuz===0.1,'sütun sütun okunmuş tablo: değerler doğru, durum şüpheli '+j(a));
// İngilizce, tek satıra akmış
a=ay('Nutrition: Typical values per 100g: Energy 1046kJ/250kcal, Fat 9.5g, of which saturates 4.1g, Carbohydrate 31g, of which sugars 2.3g, Fibre 2.0g, Protein 9.8g, Salt 1.2g');
ok(a&&a.durum==='tamam'&&a.b.kcal===250&&a.b.doymus===4.1&&a.b.seker===2.3&&a.b.tuz===1.2,'İngilizce tek satır '+j(a));
// Almanca: binlik ayırıcılı kJ
a=ay('Nährwerte pro 100 g: Brennwert 2.151 kJ / 505 kcal; Fett 25,1 g; davon gesättigte Fettsäuren 16 g; Kohlenhydrate 68,8 g; davon Zucker 30,5 g; Eiweiß 3,2 g; Salz 0,1 g');
ok(a&&a.durum==='tamam'&&a.b.kcal===505&&a.b.doymus===16&&a.b.protein===3.2,'Almanca '+j(a));
// Fransızca, doymamış yağlar atlanır
a=ay(`Valeurs nutritionnelles pour 100 g
Énergie 1580 kJ / 377 kcal
Matières grasses 12 g
dont acides gras saturés 5,2 g
Acides gras monoinsaturés 4 g
Glucides 58 g
dont sucres 20 g
Protéines 7 g
Sel 0,6 g`);
ok(a&&a.durum==='tamam'&&a.b.yag===12&&a.b.doymus===5.2&&a.b.karb===58,'Fransızca, tekli doymamış yağ yağa karışmaz '+j(a));
// Çok dilli satır (aynı değer iki dilde) sorun değil
a=ay(`100 g / 100 g\nEnerji / Energy 505 kcal\nYağ / Fat 25,1 g\nDoymuş yağ / Saturates 16 g\nKarbonhidrat / Carbohydrate 68,8 g\nŞekerler / Sugars 30,5 g\nProtein 3,2 g\nTuz / Salt 0,1 g`);
ok(a&&a.durum==='tamam'&&a.b.doymus===16,'çok dilli satır '+j(a));
// İçecek: 100 ml
a=ay('Besin değerleri (100 ml): Enerji 180 kJ / 42 kcal, Yağ 0 g, Doymuş yağ 0 g, Karbonhidrat 10,6 g, Şekerler 10,6 g, Protein 0 g, Tuz 0 g');
ok(a&&a.birim==='ml'&&a.b.seker===10.6&&a.durum==='tamam','içecek 100 ml '+j(a));
// Sıvı yağ: "Yağ 100 g" değerdir, başlık değil
a=ay('Besin değerleri 100 ml: Enerji 3404 kJ / 828 kcal, Yağ 92 g, Doymuş yağ 10 g, Karbonhidrat 0 g, Şekerler 0 g, Protein 0 g, Tuz 0 g');
ok(a&&a.b.yag===92&&a.durum==='tamam','sıvı yağ '+j(a));
a=ay('100 g: Enerji 900 kcal, Yağ 100 g, Doymuş yağ 50 g, Karbonhidrat 0 g, Protein 0 g, Tuz 0 g');
ok(a&&a.b.yag===100&&a.durum==='tamam','adın hemen ardındaki "100 g" değer '+j(a));
// Virgülü kaybolmuş sayı
a=ay(`100 g\nEnerji 505 kcal\nYağ 25,1 g\nDoymuş yağ 16 g\nKarbonhidrat 68,8 g\nŞekerler 30,5 g\nProtein 3,2 g\nTuz 01 g`);
ok(a&&a.durum==='suphe'&&a.sorun.includes('ondalik'),'"01 g" virgülü kaybolmuş olabilir '+j(a));
// Ondalık kaybı enerji denetimine takılır (25,1 → 251)
a=ay(`100 g\nEnerji 505 kcal\nYağ 251 g\nDoymuş yağ 16 g\nKarbonhidrat 68,8 g\nŞekerler 30,5 g\nProtein 3,2 g\nTuz 0,1 g`);
ok(a&&a.durum==='suphe','"25,1" "251" okunmuş '+j(a&&a.sorun));
// 100 g başlığı yok: ilk sütun alınır ama sorulur
a=ay(`Enerji 505 kcal\nYağ 25,1 g\nDoymuş yağ 16 g\nKarbonhidrat 68,8 g\nŞekerler 30,5 g\nProtein 3,2 g\nTuz 0,1 g`);
ok(a&&a.durum==='suphe'&&a.sorun.includes('yuz_yok')&&a.b.yag===25.1,'100 g başlığı yok '+j(a));
// "<0,5 g", sodyum (mg) → tuz
a=ay(`100 g\nEnerji 52 kcal\nYağ <0,5 g\nDoymuş yağ <0,1 g\nKarbonhidrat 12 g\nŞekerler 10 g\nProtein 0,3 g\nSodyum 400 mg`);
ok(a&&a.lt.yag&&a.lt.doymus&&a.b.yag===0.5&&yakin(a.b.tuz,1)&&a.durum==='tamam','"<" ve sodyum → tuz '+j(a));
// Enerjinin birimi adın yanında
a=ay(`100 g\nEnerji (kJ/kcal) 2151/505\nYağ (g) 25,1\nDoymuş yağ (g) 16\nKarbonhidrat (g) 68,8\nŞekerler (g) 30,5\nProtein (g) 3,2\nTuz (g) 0,1`);
ok(a&&a.b.kcal===505&&a.b.yag===25.1&&a.durum==='tamam','birim sütun başlığında "(kJ/kcal)", "(g)" '+j(a));
a=ay(`100 g\nEnerji 505\nYağ 25,1 g\nDoymuş yağ 16 g\nKarbonhidrat 68,8 g\nProtein 3,2 g\nTuz 0,1 g`);
ok(a&&a.sorun.includes('birim_yok')&&a.durum==='suphe','enerjinin birimi yok '+j(a));
// Aynı satır iki dilde farklı değerle
a=ay(`100 g\nEnerji 505 kcal\nYağ 25,1 g\nFat 52,1 g\nKarbonhidrat 68,8 g\nProtein 3,2 g\nTuz 0,1 g`);
ok(a&&a.sorun.includes('cok_satir')&&a.durum==='suphe','aynı satır farklı değer '+j(a));
// Trans yağ, nişasta yağa/karbonhidrata karışmaz
a=ay(`100 g\nEnerji 505 kcal\nYağ 25,1 g\nDoymuş yağ 16 g\nTrans yağ 0,2 g\nKarbonhidrat 68,8 g\nNişasta 30 g\nŞekerler 30,5 g\nProtein 3,2 g\nTuz 0,1 g`);
ok(a&&a.b.yag===25.1&&a.b.karb===68.8&&a.durum==='tamam','trans yağ ve nişasta atlanır '+j(a));
// İçerik listesi tek başına tablo değildir
ok(ay('İçindekiler: Şeker, kakao yağı (%20), fındık (%13), yağsız süt tozu, peynir altı suyu tozu, emülgatör (soya lesitini), tuz, aroma.')===null,'içerik listesi tablo sayılmaz');
ok(ay('Su, şeker, tuz')===null&&ay('')===null&&ay(null)===null,'boş ve kısa metin');
// İçerik listesi + tablo aynı fotoğrafta: listedeki "yağ", "tuz" tabloyu bozmaz, "100 g" başlık olarak bulunur
a=ay(`İçindekiler: şeker, bitkisel yağ (palm, %25), kakao, süt tozu, tuz. Besin değerleri 100 g: Enerji 2151 kJ / 505 kcal, Yağ 25,1 g, Doymuş yağ 16 g, Karbonhidrat 68,8 g, Şekerler 30,5 g, Protein 3,2 g, Tuz 0,1 g`);
ok(a&&a.durum==='tamam'&&a.b.yag===25.1&&a.b.tuz===0.1&&a.birim==='g','içerik listesi + tablo '+j(a));
a=ay(`İçindekiler: şeker, bitkisel yağ, tuz\nBesin değerleri 100 g\nEnerji 505 kcal\nYağ 25,1 g\nDoymuş yağ 16 g\nKarbonhidrat 68,8 g\nŞekerler 30,5 g\nProtein 3,2 g\nTuz 0,1 g`);
ok(a&&a.durum==='tamam'&&a.b.tuz===0.1&&a.birim==='g','içerik listesi satırı + tablo (satır sonuyla) '+j(a));
// E kodu sayı değildir: içerik listesinde satır adının ardından gelen E kodu değer sanılmaz
a=ay('Şeker, E330\nBesin değerleri 100 g\nEnerji 505 kcal\nYağ 25,1 g\nDoymuş yağ 16 g\nKarbonhidrat 68,8 g\nŞekerler 30,5 g\nProtein 3,2 g\nTuz 0,1 g');
ok(a&&a.b.seker===30.5&&!a.sorun.includes('cok_satir')&&a.durum==='tamam','"Şeker, E330" şekerler 330 g olmaz '+j(a));
ok(ay('Şeker, E 150c, tuz, E1422')===null,'yalnızca E kodlu içerik listesi tablo değil');
// Gerçek OFF kaydındaki tutarsızlık metinden de yakalanır
a=ay('100 ml: Enerji 132 kcal, Yağ 0 g, Doymuş yağ 0 g, Karbonhidrat 8,1 g, Şekerler 8,1 g, Protein 0 g, Tuz 0 g');
ok(a&&a.sorun.includes('kj_kcal'),'kJ yerine kcal (metin) '+j(a&&a.sorun));
// Hız: uzun metin
const uzun=(T1+'\n').repeat(40);const t0=Date.now();for(let i=0;i<20;i++)ay(uzun);
ok(Date.now()-t0<2000,'hız: 20 uzun metin '+(Date.now()-t0)+' ms');
// 4) Renkli gösterim (3. adım): eşikler (Birleşik Krallık FoP 2016, Ek 3), sınırlar, "<" değer, birim ve şüphede renk yok
const dz=B.besinDuzey;
ok(dz('yag',3,false,'g')==='dusuk'&&dz('yag',3.01,false,'g')==='orta'&&dz('yag',17.5,false,'g')==='orta'&&dz('yag',17.51,false,'g')==='yuksek','yağ sınırları (≤3 düşük, >17,5 yüksek)');
ok(dz('doymus',1.5,false,'g')==='dusuk'&&dz('doymus',5.1,false,'g')==='yuksek'&&dz('seker',22.5,false,'g')==='orta'&&dz('seker',22.6,false,'g')==='yuksek','doymuş yağ ve şeker sınırları');
ok(dz('tuz',0.3,false,'g')==='dusuk'&&dz('tuz',1.5,false,'g')==='orta'&&dz('tuz',1.51,false,'g')==='yuksek','tuz sınırları (gıda)');
ok(dz('seker',4,false,'ml')==='orta'&&dz('seker',4,false,'g')==='dusuk'&&dz('tuz',0.8,false,'ml')==='yuksek'&&dz('yag',1.5,false,'ml')==='dusuk','içecek eşikleri ayrı (100 ml)');
ok(dz('tuz',0.5,true,'g')===null&&dz('tuz',0.25,true,'g')==='dusuk','"<" değer: eşiğin altında kalıyorsa düşük, değilse bilinmiyor');
ok(dz('yag',10,false,'')===null&&dz('kcal',500,false,'g')===null&&dz('karb',50,false,'g')===null,'birim yoksa ya da renklenmeyen satırda düzey yok');
const cik={kcal:505,yag:25.1,doymus:16,karb:68.75,seker:30.5,protein:3.2,tuz:0.1};
let g=B.besinGorunum({b:cik,birim:'g',sorun:[]});
ok(g.renk&&j(g.satir.map(s=>s.duzey))===j(['yuksek','yuksek','yuksek','dusuk'])&&g.enerji===505,'tutarlı çikolata renkli '+j(g));
g=B.besinGorunum({b:cik,birim:'',sorun:[]});
ok(!g.renk&&g.neden==='birim'&&g.satir.every(s=>s.duzey===null),'birim bilinmiyorsa renk yok, sorulur');
g=B.besinGorunum({b:cik,birim:'g',sorun:['yuz_yok']});
ok(!g.renk&&g.neden==='suphe'&&g.satir.every(s=>s.duzey===null)&&g.sorun.includes('yuz_yok'),'ayrıştırma şüphesinde renk yok');
g=B.besinGorunum({b:cik,birim:'g',sorun:['yuz_yok'],onay:true});
ok(g.renk,'kullanıcı onaylayınca ayrıştırma şüphesi kalkar');
const bira={kcal:43,yag:0,doymus:0,karb:3.6,seker:0.2,protein:0.4,tuz:0};
ok(!B.besinGorunum({b:bira,birim:'ml'}).renk&&B.besinGorunum({b:bira,birim:'ml',onay:true}).renk,'alkollü içecek: enerji tutmaz, onayla renk');
const ters={kcal:300,yag:5,doymus:8,karb:50,seker:10,protein:10,tuz:1};
ok(!B.besinGorunum({b:ters,birim:'g',onay:true}).renk,'çelişkili değer (doymuş > yağ) onayla da renklenmez');
ok(B.besinGorunum(null)===null&&B.besinGorunum({b:{}})===null,'değer yok');
g=B.besinGorunum({b:{kcal:40,karb:10,seker:4},birim:'g'});
ok(g.renk&&g.satir.filter(s=>s.v==null).length===3&&g.satir[2].duzey==='dusuk','eksik satır boş, olan renkli');
// Metinden uçtan uca: tablo + renk
g=B.besinGorunum(ay(T1));
ok(g&&g.renk&&g.satir[0].duzey==='yuksek','etiket metninden renk '+j(g&&g.satir));
// Eşikler kaynakla aynı (kılavuz Tablo 2 ve 3)
ok(j(B.BESIN_ESIK.g)===j({yag:[3,17.5],doymus:[1.5,5],seker:[5,22.5],tuz:[0.3,1.5]})&&j(B.BESIN_ESIK.ml)===j({yag:[1.5,8.75],doymus:[0.75,2.5],seker:[2.5,11.25],tuz:[0.3,0.75]}),'eşik değerleri');
// Elle düzeltme kaydı: metne bağlı, en yeni önde, sınırlı
const k1=B.besinMetinAnahtar('gida','Şeker, tuz'),k2=B.besinMetinAnahtar('gida',' Şeker, tuz \n');
ok(k1===k2&&k1!==B.besinMetinAnahtar('gida','Şeker, tuzu')&&k1!==B.besinMetinAnahtar('koz','Şeker, tuz'),'anahtar metne ve türe bağlı (kenar boşluğu sayılmaz)');
let L=B.besinElleEkle([],k1,{b:cik,birim:'g',t:1});L=B.besinElleEkle(L,'x',{b:bira,birim:'ml',t:2});L=B.besinElleEkle(L,k1,{b:bira,birim:'ml',t:3});
ok(L.length===2&&L[0].k===k1&&L[0].t===3&&B.besinElleBul(L,k1).birim==='ml'&&B.besinElleBul(L,'yok')===null,'aynı metin tek kayıt, en yeni önde');
for(let i=0;i<150;i++)L=B.besinElleEkle(L,'k'+i,{b:cik,birim:'g'});
ok(L.length===100&&L[0].k==='k149','en çok 100 kayıt');
ok(B.besinElleBul('bozuk',k1)===null&&B.besinElleEkle(null,k1,{b:cik}).length===1,'bozuk depo');
console.log(n+' besin denetimi, '+fail+' hata');process.exit(fail?1:0);
})();
