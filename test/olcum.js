// Gizlilik dostu ölçüm (A-03): cihazın açılış olayları, geri dönüş penceresi, Worker'ın kabul ettiği satırlar, yönetim özeti.
// Çalıştır: node test/olcum.js
const {OLCUM_AYAR,olcumGun,olcumGunGecerli,olcumFark,olcumAcilis,olcumTaramaOlay,olcumSorgu,olcumAnahtar,olcumOzet}=require('./yukle.js');
let fail=0,n=0;const ok=(c,m,x)=>{n++;if(!c){fail++;console.log('HATA',m,x===undefined?'':JSON.stringify(x))}};
const G=g=>Date.parse(g+'T12:00:00Z');
const adlar=r=>r.olaylar.map(o=>o.o).join();
const q=s=>new URLSearchParams(s);

// 1) Gün hesabı
ok(olcumGun(G('2026-10-16'))==='2026-10-16','UTC günü');
ok(olcumGunGecerli('2026-02-28')&&!olcumGunGecerli('2026-02-30')&&!olcumGunGecerli('2026-1-01')&&!olcumGunGecerli(null)&&!olcumGunGecerli('x'),'gün biçimi denetlenir');
ok(olcumFark('2026-10-09','2026-10-16')===7&&olcumFark('2026-10-16','2026-10-09')===-7,'gün farkı');
ok(olcumFark('2026-03-28','2026-03-30')===2,'yaz saati geçişi gün farkını bozmaz (UTC)');

// 2) Cihaz: ilk açılış, aynı gün, ertesi gün, geri dönüş
let r=olcumAcilis(null,G('2026-10-01'),false);
ok(adlar(r)==='n,a'&&r.durum.ilk==='2026-10-01'&&r.durum.son==='2026-10-01'&&!r.durum.eski,'ilk açılış: yeni + açan',r);
r=olcumAcilis(r.durum,G('2026-10-01')+3600e3,false);ok(adlar(r)==='','aynı gün ikinci açılış sayılmaz',r);
r=olcumAcilis(r.durum,G('2026-10-02'),false);ok(adlar(r)==='a','ertesi gün yalnızca açan',r);
r=olcumAcilis(r.durum,G('2026-10-07'),false);ok(adlar(r)==='a','6. gün geri dönüş sayılmaz',r);
r=olcumAcilis(r.durum,G('2026-10-08'),false);ok(adlar(r)==='a,d7'&&r.olaylar[1].ilk==='2026-10-01'&&r.durum.d7===1,'7. gün: geri dönüş, ilk kullanım günüyle',r);
r=olcumAcilis(r.durum,G('2026-10-09'),false);ok(adlar(r)==='a','7. gün geri dönüşü bir kez sayılır',r);
r=olcumAcilis(r.durum,G('2026-11-15'),false);ok(adlar(r)==='a,d30','30–59. gün: 30. gün geri dönüşü',r);
{const d=olcumAcilis(null,G('2026-10-01'),false).durum;const x=olcumAcilis(d,G('2026-10-14'),false);ok(adlar(x)==='a,d7','13. gün hâlâ 7. gün penceresinde',x);
 const y=olcumAcilis(d,G('2026-10-15'),false);ok(adlar(y)==='a','14. gün pencere dışında',y);}
// Ölçümden önce de kullanılan cihaz: yeni ve geri dönüş sayılmaz, açan sayılır
r=olcumAcilis(null,G('2026-10-01'),true);ok(adlar(r)==='a'&&r.durum.eski===true,'eski cihaz yeni sayılmaz',r);
r=olcumAcilis(r.durum,G('2026-10-09'),false);ok(adlar(r)==='a','eski cihazın geri dönüşü sayılmaz',r);
// Bozuk ya da ileri tarihli durum: eski cihaz sayılır (aynı cihaz ikinci kez yeni olmasın)
ok(adlar(olcumAcilis({ilk:'bozuk'},G('2026-10-01'),false))==='a','bozuk durum eski cihaz');
ok(adlar(olcumAcilis({ilk:'2027-01-01'},G('2026-10-01'),false))==='a','ileri tarihli durum eski cihaz');
ok(adlar(olcumAcilis([],G('2026-10-01'),false))==='n,a','dizi durum yok sayılır');
// Kapalı: hiçbir şey sayılmaz, durum korunur
r=olcumAcilis({ilk:'2026-10-01',son:'2026-10-01',kapali:true},G('2026-10-09'),false);ok(adlar(r)===''&&r.durum.kapali&&!r.durum.d7,'kapalıyken sayılmaz',r);

// 3) Sorgu: yalnızca olay alanları
ok(olcumSorgu({o:'a'})==='o=a','açan sorgusu');
ok(olcumSorgu(olcumTaramaOlay('f','koz'))==='o=t&k=f&m=koz'&&olcumSorgu(olcumTaramaOlay('y','gida'))==='o=t&k=y','tarama sorgusu (bulunamayan türsüz)');
ok(olcumSorgu({o:'d7',ilk:'2026-10-01'})==='o=d7&ilk=2026-10-01','geri dönüş sorgusu');

// 4) Worker: kabul edilen satırlar
const S=G('2026-10-16');
const A=s=>JSON.stringify(olcumAnahtar(q(s),S));
ok(A('o=a')==='{"gun":"2026-10-16","ad":"a"}'&&A('o=n')==='{"gun":"2026-10-16","ad":"n"}','açan ve yeni bugüne');
ok(A('o=t&k=f&m=gida')==='{"gun":"2026-10-16","ad":"t:f:gida"}'&&A('o=t&k=b&m=tem')==='{"gun":"2026-10-16","ad":"t:b:tem"}'&&A('o=t&k=y&m=koz')==='{"gun":"2026-10-16","ad":"t:y"}','tarama satırı');
ok(A('o=d7&ilk=2026-10-09')==='{"gun":"2026-10-09","ad":"d7"}'&&A('o=d30&ilk=2026-09-16')==='{"gun":"2026-09-16","ad":"d30"}','geri dönüş ilk kullanım gününe yazılır');
ok(A('o=d7&ilk=2026-10-02')!=='null','bir gün saat payı (14. gün) kabul');
for(const s of ['','o=x','o=t','o=t&k=f','o=t&k=f&m=x','o=t&k=constructor&m=gida','o=t&k=f&m=__proto__','o=d7','o=d7&ilk=2026-10-10','o=d7&ilk=2026-09-01','o=d30&ilk=2026-10-01','o=d7&ilk=2026-02-30','o=d7&ilk=../x'])
  ok(A(s)==='null','geçersiz ölçüm reddedilir: '+s);

// 5) Yönetim özeti
{
  const sat=[{gun:'2026-10-16',ad:'a',n:10},{gun:'2026-10-16',ad:'n',n:3},{gun:'2026-10-16',ad:'t:f:gida',n:5},{gun:'2026-10-16',ad:'t:b:koz',n:2},{gun:'2026-10-16',ad:'t:y',n:1},
    {gun:'2026-10-01',ad:'n',n:20},{gun:'2026-10-01',ad:'d7',n:5},{gun:'2026-10-05',ad:'n',n:10},{gun:'2026-10-05',ad:'d7',n:1},{gun:'2026-08-20',ad:'n',n:99}];
  const o=olcumOzet(sat,{'2026-10-16':{s:2,d:1}},S);
  const g0=o.gunler[0];
  ok(o.gunler.length===OLCUM_AYAR.gunSay&&g0.gun==='2026-10-16'&&o.gunler[59].gun==='2026-08-18','60 gün, en yeni önce');
  ok(g0.aktif===10&&g0.yeni===3&&g0.tarama===8&&g0.tur.gida===5&&g0.tur.koz===2&&g0.kaynak.y===1&&g0.paylasim===3,'günün toplamları',g0);
  ok(o.ozet.tarama===8&&o.ozet.paylasim===3&&o.ozet.aktif===10,'son 7 gün özeti',o.ozet);
  // 01.10 penceresi kapandı (15 gün), 05.10 sürüyor (11 gün): oran yalnızca kapanmışlardan
  // 20.08: hiç dönen yok ama yeni cihazı var, paydaya girer
  ok(o.ozet.d7&&o.ozet.d7.yeni===119&&o.ozet.d7.gun===2&&Math.abs(o.ozet.d7.oran-5/119)<1e-9,'7. gün oranı yalnızca penceresi kapanmış günlerden',o.ozet.d7);
  ok(o.gunler.find(g=>g.gun==='2026-10-05').acik7&&!o.gunler.find(g=>g.gun==='2026-10-01').acik7,'pencere sürüyor işareti');
  ok(o.ozet.d30===null,'30. gün penceresi kapanmış yeni cihazlı gün yoksa oran yok');
  ok(olcumOzet([],{},S).ozet.d7===null,'boş tablo');
}

console.log(fail?fail+' hata / '+n:'tamam: '+n+' denetim');
process.exit(fail?1:0);
