// Topluluk (G-04): ortak hedef eşikleri, eksik ürün listesinin süzülmesi, arama bildiriminin tekilleştirilmesi, metinler.
// Çalıştır: node test/topluluk.js
const fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
Object.assign(globalThis,require('./yukle.js'));global.Z={toplulukHedef,toplulukToplam,toplulukEksik,arananEkle,TOPLULUK_AYAR,t};
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};

// Ortak hedef: sıradaki eşik, bir önceki eşikten bu yana ilerleme; son eşik geçilince tamam
const h=(x)=>Z.toplulukHedef(x);
ok(h(0).hedef===100&&h(0).oran===0&&h(0).onceki===0,'0 ürün: hedef 100');
ok(h(37).hedef===100&&Math.abs(h(37).oran-0.37)<1e-9,'37 ürün: 37/100');
ok(h(100).hedef===1000&&h(100).oran===0&&h(100).onceki===100,'eşiğe ulaşınca sıradaki eşik başlar');
ok(h(5500).hedef===10000&&Math.abs(h(5500).oran-0.5)<1e-9,'5.500: 1.000 ile 10.000 arasının yarısı');
ok(h(2e6).tamam&&h(2e6).oran===1&&h(2e6).hedef===1e6,'son eşik geçilince tamam');
ok(h(-3).n===0&&h('x').n===0&&h(12.7).n===12,'geçersiz sayı 0, kesir aşağı');
ok(Z.TOPLULUK_AYAR.hedefler.every((x,i,a)=>!i||x>a[i-1]),'eşikler artan sırada');
ok(Z.toplulukToplam({gida:3,koz:2,tem:'1'})===6&&Z.toplulukToplam(null)===0,'türlerin toplamı');

// Eksik ürünler: uygulamadaki OFF verisinde içeriği olan çıkar, adı bilinen ad alır, bozuk kayıt atlanır
const off={u:{'8690504025207':['food','Bitter Çikolata','Marka',0,{tr:'Kakao kitlesi, şeker'}],'4006381333931':['food','Kalem Ürün','Marka X',0,{}]}};
const l=Z.toplulukEksik([{kod:'8690504025207',tur:'gida',n:9,son:1},{kod:'4006381333931',tur:'gida',n:5,son:2},{kod:'5449000000996',tur:'koz',n:2,son:3},
  {kod:'8690504025208',tur:'gida',n:4},{kod:'5449000000996',tur:'gida',n:0},null],off,['tr','en']);
ok(l.length===2,'içerikli ve bozuk kayıtlar çıkar: '+JSON.stringify(l));
ok(l[0].kod==='4006381333931'&&l[0].ad==='Kalem Ürün'&&l[0].marka==='Marka X'&&l[0].n===5,'adı OFF verisinden (içeriksiz kayıt): '+JSON.stringify(l[0]));
ok(l[1].tur==='koz'&&l[1].ad===''&&l[1].son===3,'bilinmeyen ürün adsız');
ok(Z.toplulukEksik([{kod:'8690504025207',tur:'gida',n:1}],null,['tr']).length===1,'OFF verisi yüklenemezse liste olduğu gibi');

// Arama bildirimi: aynı barkod bir kez; en çok N barkod hatırlanır (en eskisi düşer)
let a=Z.arananEkle([],'1');ok(a&&a.join()==='1','ilk bildirim');
ok(Z.arananEkle(a,'1')===null,'aynı barkod ikinci kez bildirilmez');
a=Z.arananEkle(['1','2','3'],'4',3);ok(a.join()==='2,3,4','en çok 3: en eski düşer');
ok(Z.arananEkle({x:1},'5').join()==='5'&&Z.arananEkle(['a',7,null],'6').join()==='a,6','bozuk liste onarılır');

// Metinler: Türkçe ve İngilizce her anahtar var, "katkı" sözcüğü ürün eklemede kullanılmaz (i18n/sozluk.md)
const tr=JSON.parse(fs.readFileSync(path.join(R,'i18n/tr.json'),'utf8')),en=JSON.parse(fs.readFileSync(path.join(R,'i18n/en.json'),'utf8'));
const kk=Object.keys(tr).filter(k=>k.startsWith('topluluk.'));
ok(kk.length>=15&&kk.every(k=>en[k]),'topluluk metinleri iki dilde');
ok(kk.every(k=>!/katkı/i.test(JSON.stringify(tr[k]))&&!/contribut/i.test(JSON.stringify(en[k]).replace('contributor number',''))),'ürün eklemeye "katkı" denmez');
ok(kk.every(k=>!/sıralama|ranking/i.test(JSON.stringify(tr[k])+JSON.stringify(en[k]))||k==='topluluk.hedef_not'),'kişisel sıralama yalnızca "yok" diye geçer');
ok(Z.t('topluluk.arandi',{n:3,s:'3'})==='3 kez arandı','Türkçe metin');

console.log(n+' topluluk denetimi, '+fail+' hata');
process.exit(fail?1:0);
