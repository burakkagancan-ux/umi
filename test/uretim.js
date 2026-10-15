// Üretim yolu (sentetik / işlenmiş / fermentasyon) testleri. Çalıştır: node test/uretim.js
const fs=require('fs');
const {idx,L}=require('./run.js');
Object.assign(globalThis,require('./yukle.js'));const C={};C.uretimSinif=uretimSinif;C.uretimOzet=uretimOzet;C.uretimMetin=uretimMetin;C.URETIM_AD=URETIM_AD;
const db=JSON.parse(fs.readFileSync(__dirname+'/../data/e_kodlari.json'));const E={};db.ingredients.forEach(i=>E[i.id]=i);
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
// Veri bütünlüğü
db.ingredients.forEach(i=>{const u=i.uretim;
  ok(u&&['dogal','fermente','islenmis','sentetik','belirsiz'].includes(u.s),i.id+' sınıf');
  ok(u&&u.n&&u.n.length>10,i.id+' not');
  ok(u&&(!u.ok||/^https:\/\//.test(u.u||'')),i.id+' doğrulanan kayıtta kaynak');
  ok(!/zararlı|tehlikeli|zehir|kimyasal madde içerir/i.test(u.n),i.id+' dil');});
// Bilinen örnekler (AB 231/2012 ve 2008/84/AT tanımları)
const S={E102:'sentetik',E129:'sentetik',E172:'sentetik',E100:'dogal',E120:'dogal',E162:'dogal',E150a:'islenmis',E150d:'islenmis',E141:'islenmis',
  E234:'fermente',E235:'fermente',E270:'belirsiz',E160a:'belirsiz',E170:'belirsiz',E306:'dogal',E322:'dogal',
  E330:'fermente',E415:'fermente',E1422:'islenmis',E471:'islenmis',E951:'sentetik',E211:'sentetik',E300:'islenmis'};
Object.keys(S).forEach(k=>ok(E[k].uretim.s===S[k],k+' '+E[k].uretim.s+' != '+S[k]));
['E100','E102','E120','E172','E270'].forEach(k=>ok(E[k].uretim.ok,k+' doğrulandı'));
// Risk rengi üretim yolundan bağımsız: sentetik ama yeşil maddeler yeşil kalır
['E133','E955','E1422','E330'].forEach(k=>ok(E[k].risk_level==='green',k+' yeşil kalmalı'));
// Etiket: doğal ve belirsiz için yok
ok(C.uretimSinif(['E100'],idx)===null,'doğal etiket yok');
ok(C.uretimSinif(['E270'],idx)===null,'belirsiz etiket yok');
ok(C.uretimSinif(['E102'],idx)==='sentetik','sentetik etiket');
ok(C.URETIM_AD.fermente&&!C.URETIM_AD.dogal,'etiket adları');
ok(C.uretimSinif(['E102','E330'],idx)===null,'farklı sınıflı olası kodlar etiketsiz');
// Etiket özeti
let o=C.uretimOzet(L.analyze("Su, şeker, sitrik asit, koyulaştırıcı (ksantan gum), renklendirici (tartrazin), aroma, kurkumin, modifiye mısır nişastası (E1422)",idx),idx);
ok(o.sentetik.length===1&&o.sentetik[0]==='E102','sentetik '+JSON.stringify(o));
ok(o.fermente.length===2,'fermente '+JSON.stringify(o));
ok(o.islenmis.includes('E1422'),'işlenmiş '+JSON.stringify(o));
ok(C.uretimMetin(o)==='1 sentetik, '+o.islenmis.length+' işlenmiş, 2 fermentasyonla üretilmiş','metin '+C.uretimMetin(o));
o=C.uretimOzet(L.analyze("Domates, tuz, şeker. Koruyucu içermez: sodyum benzoat içermez.",idx),idx);
ok(!o.sentetik.length,'içermez sayılmaz '+JSON.stringify(o));
ok(C.uretimMetin(C.uretimOzet(L.analyze("Süt, kültür",idx),idx))==='','boş metin');
console.log(n+' denetim, '+fail+' hata');process.exit(fail?1:0);
