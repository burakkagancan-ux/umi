// Rozetler (G-01): eşikler ve "hepsi" kademesi, ad anahtarları, sayım ve tekilleştirme, kutlama bir kez, yedek birleştirme, simge, paylaşım kartı,
// tanım dosyası ve metinler. Çalıştır: node test/rozet.js
const fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
Object.assign(globalThis,require('./yukle.js'));global.Z={rozetBos,rozetNorm,rozetIz,rozetEsikler,rozetAdAnahtar,rozetSira,rozetDurumu,rozetEkle,rozetYeni,rozetGoruldu,rozetBaglam,rozetToplam,rozetBirlestir,rozetBosMu,rozetSunucuYaz,rozetSvg,rozetKartCiz,ROZET_AYAR,ROZET_ISARET,ROZET_STIL,kayitYedek,kayitGeriYukle,t};
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
const def=JSON.parse(fs.readFileSync(path.join(R,'data/rozetler.json'),'utf8'));
const ans=JSON.parse(fs.readFileSync(path.join(R,'data/ansiklopedi.json'),'utf8'));
const gidaSayfa=ans.records.filter(r=>r.product_types[0]==='food').length;

// Tanım dosyası: üreteçle aynı, her ailenin simgesi var, toplam ansiklopediyle aynı
ok(JSON.stringify(def.kademeler)==='[1,10,25,50,100,250,500,1000]','kademeler: '+def.kademeler);
ok(def.aileler.map(a=>a.id).join()==='okur,dedektif,avci,oncu,dogrulayici','beş aile');
def.aileler.forEach(a=>ok(Z.ROZET_ISARET[a.simge],'simge yok: '+a.id));
ok(def.aileler[0].toplam.gida===gidaSayfa,'gıda Okuru üst sınırı ansiklopedi sayfa sayısı: '+def.aileler[0].toplam.gida+' / '+gidaSayfa);
ok(def.aileler.every(a=>a.hazir)&&def.aileler.filter(a=>a.sunucu).map(a=>a.id).join()==='avci,oncu,dogrulayici','ürün ekleme ailelerinin sayımı sunucudan (G-02)');

// Eşikler: üst sınırlı ailede büyük kademeler düşer, son kademe toplam ("hepsi")
const e=Z.rozetEsikler(def,'okur','gida');
ok(JSON.stringify(e)===JSON.stringify([1,10,25,50,100,250].filter(x=>x<gidaSayfa).concat([gidaSayfa])),'gıda Okuru eşikleri: '+e);
ok(Z.rozetEsikler(def,'okur','koz').length===0,'ansiklopedisi olmayan türde eşik yok');
ok(Z.rozetEsikler(def,'dedektif','tem').join()==='1,10,25,50,100,250,500,1000','sınırsız ailede sekiz kademe');
ok(Z.rozetEsikler({kademeler:def.kademeler,aileler:[{id:'okur',toplam:{gida:250}}]},'okur','gida').join()==='1,10,25,50,100,250','toplam bir kademeye eşitse o kademe son');
ok(Z.rozetEsikler({kademeler:def.kademeler,aileler:[{id:'okur',toplam:{gida:7}}]},'okur','gida').join()==='1,7','küçük toplam: 1 ve hepsi');
ok(Z.rozetEsikler({kademeler:def.kademeler,aileler:[{id:'okur',toplam:{gida:1200}}]},'okur','gida').join()==='1,10,25,50,100,250,500,1000,1200'.split(',').slice(0,8).concat(['1200']).join(),'toplam büyüyünce eşik kendiliğinden');
// Ad anahtarları: kademe sırasıyla, son ("hepsi") kademe ailenin son adı (k8)
ok(Z.rozetAdAnahtar(def,'okur','gida',0)==='rozet.okur.k1'&&Z.rozetAdAnahtar(def,'okur','gida',e.length-1)==='rozet.okur.k8','Okur ad anahtarları');
ok(Z.rozetAdAnahtar(def,'okur','gida',e.length-2)==='rozet.okur.k'+(e.length-1),'sondan bir önceki kendi sırasında');
ok(Z.rozetAdAnahtar(def,'dedektif','gida',7)==='rozet.dedektif.k8'&&Z.rozetAdAnahtar(def,'dedektif','gida',8)==='','sınırsız ailede k8 = 1000');
ok(Z.rozetSira(def,'okur','gida',e.length-1)===8,'"hepsi" en süslü simge');

// Sayım: tekilleştirme, sınır, geçersiz girdi
let d=Z.rozetBos();
for(let i=0;i<12;i++)d=Z.rozetEkle(d,'okur','gida','E'+(100+i)).d;
let s=Z.rozetEkle(d,'okur','gida','E100');ok(!s.eklendi&&Z.rozetDurumu(def,s.d,'okur','gida').n===12,'aynı sayfa bir kez sayılır');
ok(!Z.rozetEkle(d,'avci','gida','x').eklendi,'sunucu ailesi cihazda sayılmaz');
ok(!Z.rozetEkle(d,'okur','GIDA','x').eklendi&&!Z.rozetEkle(d,'okur','gida','').eklendi,'geçersiz tür ya da boş öğe');
const once=JSON.stringify(d);Z.rozetEkle(d,'okur','gida','E999');ok(JSON.stringify(d)===once,'durum yerinde değişmez');
let r=Z.rozetDurumu(def,d,'okur','gida');
ok(r.kademe===2&&r.ad==='rozet.okur.k2'&&r.sonraki===25&&r.sonrakiAd==='rozet.okur.k3'&&Math.abs(r.ilerleme-2/15)<1e-9,'12 sayfa: 2. kademe, sonraki 25: '+JSON.stringify(r));
ok(Z.rozetDurumu(def,Z.rozetBos(),'okur','gida').kademe===0&&!Z.rozetBaglam(def,Z.rozetBos(),'okur','gida'),'hiç rozet yoksa bağlam simgesi yok');
ok(Z.rozetDurumu(def,d,'avci','gida').hazir&&Z.rozetDurumu(def,d,'avci','gida').n===0,'ürün ailesi hazır, sunucu yanıtı yoksa 0');
ok(!Z.rozetEkle(d,'oncu','gida','1').eklendi,'ürün ailesi cihazda sayılmaz');
{let s1=Z.rozetSunucuYaz(d,{eklenen:{gida:5},avci:{gida:12,koz:1},oncu:{gida:3},dogrulayici:{gida:'x',KOZ:4,tem:-1}},1000);
 ok(Z.rozetDurumu(def,s1,'avci','gida').n===12&&Z.rozetDurumu(def,s1,'avci','gida').ad==='rozet.avci.k2'&&Z.rozetDurumu(def,s1,'oncu','gida').kademe===1,'sunucu sayıları: Ürün Avcısı 12 → İzci, Öncü 3');
 ok(JSON.stringify(s1.sunucu.dogrulayici)==='{}'&&!('eklenen' in s1.sunucu),'sunucu yanıtındaki geçersiz sayılar atılır');
 ok(Z.rozetYeni(def,s1,'avci','gida').kademe===2,'sunucudan gelen kademe kutlanır');
 ok(JSON.stringify(Z.rozetNorm(JSON.parse(JSON.stringify(s1))).sunucu)===JSON.stringify(s1.sunucu),'saklanan sunucu sayıları korunur');
 const yeni=Z.rozetSunucuYaz(Z.rozetBos(),{avci:{gida:20}},2000),eski=Z.rozetSunucuYaz(Z.rozetBos(),{avci:{gida:1}},500);
 ok(Z.rozetBirlestir(eski,yeni).sunucu.avci.gida===20&&Z.rozetBirlestir(yeni,eski).sunucu.avci.gida===20,'birleştirmede daha yeni sunucu sayısı');
 ok(Z.rozetToplam(def,s1)>=Z.rozetToplam(def,d)+3,'toplam rozete sunucu aileleri de girer')}
ok(Z.rozetDurumu(def,d,'okur','koz').yakinda,'kozmetik ansiklopedisi yok: yakında');
let tam=Z.rozetBos();for(let i=0;i<gidaSayfa;i++)tam=Z.rozetEkle(tam,'okur','gida','E'+i).d;
r=Z.rozetDurumu(def,tam,'okur','gida');ok(r.hepsi&&r.sonraki==null&&r.ilerleme===1&&r.ad==='rozet.okur.k8','bütün sayfalar: hepsi');
let cok=Z.rozetBos();for(let i=0;i<1005;i++)cok=Z.rozetEkle(cok,'dedektif','gida','f:'+i).d;
ok(cok.dedektif.gida.length===Z.ROZET_AYAR.izSiniri&&Z.rozetDurumu(def,cok,'dedektif','gida').ad==='rozet.dedektif.k8','1000 öğede durur, son kademe');
// Metin izi: boşluk ve büyük/küçük harf farkı aynı etiket
ok(Z.rozetIz('Şeker,  Kakao\n')===Z.rozetIz('şeker, kakao')&&Z.rozetIz('a')!==Z.rozetIz('b'),'metin izi');

// Kutlama bir kez: yeni kademe → görüldü → aynı kademe yeniden kutlanmaz, sonraki kutlanır
d=Z.rozetEkle(Z.rozetBos(),'dedektif','koz','b:1').d;
let y=Z.rozetYeni(def,d,'dedektif','koz');ok(y&&y.kademe===1&&y.ad==='rozet.dedektif.k1','ilk okuma: Gözlemci');
d=Z.rozetGoruldu(d,'dedektif','koz',1);ok(!Z.rozetYeni(def,d,'dedektif','koz'),'görülen kademe yeniden kutlanmaz');
for(let i=2;i<=10;i++)d=Z.rozetEkle(d,'dedektif','koz','b:'+i).d;
ok(Z.rozetYeni(def,d,'dedektif','koz').kademe===2,'10. okuma: yeni kademe');
ok(Z.rozetToplam(def,d)===2,'toplam rozet');

// Doğrulama ve yedek birleştirme
ok(JSON.stringify(Z.rozetNorm(null))===JSON.stringify(Z.rozetBos())&&JSON.stringify(Z.rozetNorm([1]))===JSON.stringify(Z.rozetBos()),'bozuk durum boş');
let nd=Z.rozetNorm({okur:{gida:['E1','E1',5,'E2'],'GIDA':['x']},dedektif:'x',gor:{'okur.gida':3,'x':2,'okur.koz':99},kotu:1});
ok(nd.okur.gida.join()==='E1,E2'&&!nd.okur.GIDA&&nd.gor['okur.gida']===3&&!nd.gor.x&&!nd.gor['okur.koz']&&!('kotu' in nd),'doğrulama: '+JSON.stringify(nd));
let a1=Z.rozetNorm({okur:{gida:['E1','E2']},gor:{'okur.gida':1}}),b1=Z.rozetNorm({okur:{gida:['E2','E3']},dedektif:{tem:['b:5']},gor:{'okur.gida':2}});
let bb=Z.rozetBirlestir(a1,b1);ok(bb.okur.gida.join()==='E1,E2,E3'&&bb.dedektif.tem.join()==='b:5'&&bb.gor['okur.gida']===2,'birleştirme: '+JSON.stringify(bb));
ok(Z.rozetBosMu(Z.rozetBos())&&!Z.rozetBosMu(a1),'boş mu');
const yd=Z.kayitYedek([],5,'',bb),g=Z.kayitGeriYukle([],yd);
ok(g.ok&&JSON.stringify(Z.rozetNorm(g.rozetler))===JSON.stringify(bb),'rozetler yedekte gidip geliyor');
ok(!('rozetler' in JSON.parse(Z.kayitYedek([],5))),'rozet yoksa yedekte alan yok');
ok(Z.kayitGeriYukle([],JSON.stringify({tur:'kayitli',kayitlar:[]})).rozetler===null,'eski yedekte rozet yok');

// Simge: her ailede 8 sıra; aileler şekil ve renkle ayrışır; kazanılmamış gri; altın yalnızca üst sıralarda; risk renkleri kullanılmaz
for(const a of Object.keys(Z.ROZET_ISARET))for(let k=1;k<=8;k++){
  const sv=Z.rozetSvg(a,k,true);ok(/^<svg[^>]*viewBox="0 0 48 48"/.test(sv)&&sv.endsWith('</svg>'),'svg: '+a+k);
  ok(!/#8A5A00|#A4470B|#B3261E/i.test(sv),'simgede risk rengi: '+a+k);
}
ok(!/#B8902A/.test(Z.rozetSvg('kitap',4,true))&&/#B8902A/.test(Z.rozetSvg('kitap',5,true)),'altın 5. sıradan');
const stiller=Object.keys(Z.ROZET_ISARET).map(a=>Z.ROZET_STIL[a]);
ok(stiller.every(Boolean),'her işaretin stili var');
ok(new Set(stiller.map(x=>x.renk)).size===stiller.length&&new Set(stiller.map(x=>x.sekil)).size===stiller.length,'aileler renk ve şekille ayrışır');
for(const a of Object.keys(Z.ROZET_ISARET))ok(!Z.rozetSvg(a,8,false).includes(Z.ROZET_STIL[a].renk)&&!/#B8902A/.test(Z.rozetSvg(a,8,false)),'kazanılmamış gri: '+a);
const tum=new Set();for(const a of Object.keys(Z.ROZET_ISARET))for(let k=1;k<=8;k++)tum.add(Z.rozetSvg(a,k,true));
ok(tum.size===Object.keys(Z.ROZET_ISARET).length*8,'her aile × kademe simgesi farklı');
ok(Z.rozetSvg('kitap',8,true).length>Z.rozetSvg('kitap',1,true).length,'sıra yükseldikçe süs artar');

// Paylaşım kartı: ürün ve kişisel bilgi yok; çizilen metinler
function sahte(){const o={out:[],measureText:s=>({width:String(s).length*20})};['fillRect','drawImage','fillText'].forEach(f=>o[f]=function(){if(f==='fillText')o.out.push(arguments[0])});return o}
const x=sahte(),M={ust:'Yeni rozet',ad:'Kitap Kurdu',aile:'Okur · Gıda',aciklama:'25 farklı ansiklopedi sayfası okudunuz (gıda).',tarih:'14 Ekim 2026'};
const cik=Z.rozetKartCiz(x,M,{uygulamaAdi:'Tağşiş',slogan:'s',adres:'https://ornek.org/'},null,null);
ok(cik.includes('Kitap Kurdu')&&cik.includes('Okur · Gıda')&&cik.includes('ornek.org')&&cik.includes('14 Ekim 2026'),'kart metinleri: '+cik.join(' | '));
const izinli=[M.ust,M.ad,M.aile,M.tarih,'Tağşiş','s','ornek.org'].join(' ')+' '+M.aciklama;
ok(cik.every(l=>izinli.includes(l)),'kartta yalnızca rozet bilgisi ve bant: '+cik.join(' | '));

// Metinler: her aile ve kademe adı, açıklamalar Türkçe ve İngilizcede var; "katkı" sözcüğü rozet metinlerinde yok (sözlük)
const tr=JSON.parse(fs.readFileSync(path.join(R,'i18n/tr.json'),'utf8')),en=JSON.parse(fs.readFileSync(path.join(R,'i18n/en.json'),'utf8'));
for(const a of def.aileler){
  for(const k of ['ad','acik','ne'].concat([1,2,3,4,5,6,7,8].map(i=>'k'+i))){const key='rozet.'+a.id+'.'+k;ok(tr[key]&&en[key],'metin yok: '+key)}
  if(a.toplam)ok(tr['rozet.'+a.id+'.acik_hepsi']&&en['rozet.'+a.id+'.acik_hepsi'],'hepsi metni yok: '+a.id);
}
def.turler.forEach(tur=>ok(tr['rozet.tur.'+tur]&&en['rozet.tur.'+tur],'tür adı yok: '+tur));
const adlar=new Set();def.aileler.forEach(a=>{for(let i=1;i<=8;i++){const v=tr['rozet.'+a.id+'.k'+i];ok(!adlar.has(a.id+v),'aynı ailede tekrar eden ad: '+v);adlar.add(a.id+v)}});
Object.keys(tr).filter(k=>k.startsWith('rozet.')).forEach(k=>ok(!/katkı/i.test(JSON.stringify(tr[k])),'rozet metninde "katkı": '+k));
ok(/Bütün|bütün/.test(Z.t('rozet.okur.acik_hepsi',{n:333,tur:'gıda'})),'hepsi metni');

console.log(n+' rozet denetimi, '+fail+' hata');process.exit(fail?1:0);
