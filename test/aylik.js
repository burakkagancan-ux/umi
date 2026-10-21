// Aylık özet (U-09): ay anahtarı, tarama kaydı (aynı ürün ayda bir), düzey dağılımı, en sık maddeler, katkı, rozet, bozuk kayıt, budama.
// Çalıştır: node test/aylik.js
Object.assign(globalThis,require('./yukle.js'));
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
const EKIM=new Date(2026,9,21,12).getTime(),KASIM=new Date(2026,10,2,9).getTime(),EYLUL=new Date(2026,8,30,23,59).getTime();
ok(ayAnahtar(EKIM)==='2026-10'&&ayAnahtar(EYLUL)==='2026-09','ay anahtarı yerel saatle');
ok(ayKaydir('2026-01',-1)==='2025-12'&&ayKaydir('2026-12',1)==='2027-01','ay kaydırma yıl sınırında');
ok(new Date(ayZaman('2026-10')).getMonth()===9,'ayın ilk günü');

// Ürün modelinden kayıt: düzey en yüksek seviyeden, maddeler yalnızca dikkat/uyarı
const P=(mode,ranks)=>{const items=ranks.map((r,i)=>({key:'M'+i,ids:['E10'+i],name:'Madde '+i,rank:r}));const c=[0,0,0,0];ranks.forEach(r=>c[r]++);return {mode,items,counts:c}};
let u=aylikUrun(P('gida',[3,2,0]),it=>it.ids[0]);
ok(u.m==='gida'&&u.r===2&&u.k.length===2&&u.k[0][2]==='E100'&&u.k[0][3]===3,'uyarılı ürün r=2, iki madde: '+JSON.stringify(u));
ok(aylikUrun(P('koz',[2,0]),null).r===1&&aylikUrun(P('tem',[0,0]),null).r===0,'yalnızca dikkat r=1, hiçbiri r=0');
ok(aylikUrun(P('koz',[2]),()=>undefined).k[0][2]===null,'ansiklopedi kimliği yoksa null');

// Tarama: aynı kimlik aynı ayda bir kez (elle düzeltme üzerine yazar); başka ayda yeniden sayılır
let o=aylikTarama(null,EKIM,'h1',aylikUrun(P('gida',[3]),null));
o=aylikTarama(o,EKIM,'h1',aylikUrun(P('gida',[2]),null));
o=aylikTarama(o,EKIM,'h2',aylikUrun(P('koz',[0]),null));
o=aylikTarama(o,KASIM,'h1',aylikUrun(P('gida',[3]),null));
let z=aylikOzet(o,'2026-10');
ok(z.toplam===2&&z.tur.gida===1&&z.tur.koz===1&&z.tur.tem===0,'ekim: iki ürün (aynı kimlik bir kez): '+JSON.stringify(z.tur));
ok(z.dag.uyari===0&&z.dag.dikkat===1&&z.dag.yok===1,'düzeltilen ürünün son düzeyi sayılır: '+JSON.stringify(z.dag));
ok(aylikOzet(o,'2026-11').toplam===1,'kasımda yeniden okutulan ayrıca sayılır');
ok(aylikOzet(o,'2026-09').toplam===0&&aylikOzet(o,'2026-09').maddeler.length===0,'kaydı olmayan ay boş');
ok(aylikAylar(o).join()==='2026-10,2026-11','kaydı olan aylar sıralı');
ok(aylikTarama(o,EKIM,'',{m:'gida',r:0,k:[]})&&aylikOzet(aylikTarama(o,EKIM,'h9',{m:'xx',r:0,k:[]}),'2026-10').toplam===2,'geçersiz tür/kimlik yazılmaz');

// En sık maddeler: kaç üründe (aynı üründe iki kez bir sayılır), eşitlikte yüksek düzey önce, en çok 5
o=null;
const urun=(id,ks)=>{o=aylikTarama(o,EKIM,id,{m:'gida',r:2,k:ks})};
urun('a',[['E250','Sodyum nitrit','E250',3],['E250','Sodyum nitrit','E250',3],['E330','Sitrik asit',null,2]]);
urun('b',[['E250','Sodyum nitrit','E250',3],['E471','Mono','E471',2]]);
urun('c',[['E330','Sitrik asit','E330',2],['E102','Tartrazin','E102',3]]);
urun('d',[['E1','A',null,2],['E2','B',null,2],['E3','C',null,2]]);
z=aylikOzet(o,'2026-10');
ok(z.maddeler.length===5,'en çok 5 madde');
ok(z.maddeler[0].key==='E250'&&z.maddeler[0].n===2,'en sık önce, aynı üründe iki kez bir sayılır: '+JSON.stringify(z.maddeler[0]));
ok(z.maddeler[1].key==='E330'&&z.maddeler[1].n===2&&z.maddeler[1].ans==='E330','ansiklopedi kimliği bir üründe yoksa ötekinden alınır');
ok(z.maddeler[2].key==='E102','eşit sayıda uyarı düzeyi dikkatten önce: '+z.maddeler.map(m=>m.key).join());
ok(z.dag.uyari===4,'dört ürün uyarılı');

// Katkı ve rozet
o=aylikKatki(o,EKIM,'8690504025207');o=aylikKatki(o,EKIM,'8690504025207');o=aylikKatki(o,EKIM,'abc');
o=aylikRozet(o,EKIM,{aile:'dedektif',tur:'gida',kademe:2,ad:'rozet.dedektif.k2'});o=aylikRozet(o,EKIM,{aile:'dedektif',tur:'gida',kademe:2,ad:'rozet.dedektif.k2'});
z=aylikOzet(o,'2026-10');
ok(z.katki===1,'aynı barkod ayda bir, geçersiz barkod yok sayılır');
ok(z.rozetler.length===1&&z.rozetler[0][3]==='rozet.dedektif.k2','aynı kademe bir kez');
const sadeceKatki=aylikKatki(null,KASIM,'4006381333931');
ok(aylikAylar(sadeceKatki).join()==='2026-11'&&aylikOzet(sadeceKatki,'2026-11').toplam===0,'yalnızca katkı olan ay da listede');

// Bozuk kayıt: okunurken geçersiz kısımlar atılır, geçerliler kalır
const boz=aylikNorm({ay:{'2026-10':{u:{x:{m:'gida',r:2,k:[['E1','A',null,2],'bozuk']},y:{m:'?',r:1},z:null},e:{'123':1,'8690504025207':1},z:[['a','gida',1,''],['b']]},'kotu':{},'2026-11':'x'}});
ok(Object.keys(boz.ay).join()==='2026-10','geçersiz ay anahtarı ve değer atılır');
ok(Object.keys(boz.ay['2026-10'].u).join()==='x'&&boz.ay['2026-10'].u.x.k.length===1,'geçersiz ürün ve madde atılır');
ok(Object.keys(boz.ay['2026-10'].e).join()==='8690504025207'&&boz.ay['2026-10'].z.length===1,'geçersiz barkod ve rozet atılır');
ok(aylikNorm('x').v===AYLIK_SURUM&&aylikNorm(null).ay&&Object.keys(aylikNorm([]).ay).length===0,'bozuk kök boş kayıt olur');

// Budama: en çok AYLIK_AYAR.enFazlaAy ay, en eskiler düşer; ayda en çok enFazlaUrun ürün (var olan güncellenir)
o=null;for(let i=0;i<AYLIK_AYAR.enFazlaAy+3;i++)o=aylikTarama(o,new Date(2024,i,5).getTime(),'h'+i,{m:'tem',r:0,k:[]});
const ay=aylikAylar(o);ok(ay.length===AYLIK_AYAR.enFazlaAy&&ay[0]==='2024-04','en eski ay(lar) düşer: '+ay[0]);
const eski=AYLIK_AYAR.enFazlaUrun;AYLIK_AYAR.enFazlaUrun=2;
o=null;['a','b','c'].forEach(id=>{o=aylikTarama(o,EKIM,id,{m:'gida',r:0,k:[]})});o=aylikTarama(o,EKIM,'a',{m:'gida',r:2,k:[]});
z=aylikOzet(o,'2026-10');ok(z.toplam===2&&z.dag.uyari===1,'ürün sınırı: yeni ürün eklenmez, var olan güncellenir');
AYLIK_AYAR.enFazlaUrun=eski;

console.log(n+' test, '+fail+' hata');process.exit(fail?1:0);
