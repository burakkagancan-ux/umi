// Barkod: kontrol hanesi, biçim dönüşümü, içerik dili, kaynak sırası, katkı kuralı; Worker ile aynı benzerlik hesabı; data/barkod_off.json yapısı.
// Çalıştır: node test/barkod.js
const fs=require('fs'),path=require('path');
Object.assign(globalThis,require('./yukle.js'));global.B={barkodTemiz,barkodKontrol,barkodUpcE,barkodGecerli,barkodNorm,barkodAdaylar,barkodTur,barkodMetin,barkodOffBul,barkodSec,barkodKatkiUygun,barkodBenzer,katkiciGecerli,katkiciUret,BARKOD_AYAR};
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
(async()=>{
// 1) Kontrol hanesi ve biçimler (örnekler: GS1 / Wikipedia)
ok(B.barkodGecerli('8690504025207'),'EAN-13 (Türkiye, 869)');
ok(B.barkodGecerli('4006381333931'),'EAN-13');
ok(!B.barkodGecerli('8690504025208'),'yanlış kontrol hanesi reddedilir');
ok(B.barkodGecerli('96385074'),'EAN-8');
ok(B.barkodGecerli('036000291452'),'UPC-A');
ok(B.barkodUpcE('01234565')==='012345000065'&&B.barkodGecerli('01234565'),'UPC-E açılır: '+B.barkodUpcE('01234565'));
ok(!B.barkodGecerli('12345')&&!B.barkodGecerli('')&&!B.barkodGecerli(null),'kısa/boş reddedilir');
ok(B.barkodTemiz(' 869 0504 025207\n')==='8690504025207','boşluklar temizlenir');
ok(B.barkodNorm('036000291452')==='0036000291452','UPC-A 13 haneye tamamlanır');
ok(B.barkodNorm('01234565')==='01234565'&&B.barkodAdaylar('01234565').includes('0012345000065'),'8 hane EAN-8 de UPC-E de olabilir: iki biçim de aranır');
ok(B.barkodNorm('04252614')==='0042100005264','yalnızca UPC-E geçerliyse açılır: '+B.barkodNorm('04252614'));
ok(B.barkodNorm('96385074')==='96385074','EAN-8 aynen');
ok(B.barkodNorm('8690504025208')===null,'geçersizde null');
ok(B.barkodAdaylar('036000291452').join()==='0036000291452,036000291452','12 haneli kayıt da aranır');
// 2) Tür ve içerik dili
ok(B.barkodTur('food')==='gida'&&B.barkodTur('beauty')==='koz'&&B.barkodTur('products')==='tem'&&B.barkodTur('x')==='gida','tür eşlemesi');
const M={en:'Sugar, cocoa',tr:'Şeker, kakao',de:'Zucker'};
ok(B.barkodMetin(M,['tr','en']).dil==='tr','Türkçe arayüzde Türkçe metin');
ok(B.barkodMetin(M,['en','tr']).dil==='en','İngilizce arayüzde İngilizce metin');
ok(B.barkodMetin({de:'Zucker'},['en','tr']).dil==='de','başka dil yoksa eldeki metin');
ok(B.barkodMetin({tr:'  '},['tr'])===null&&B.barkodMetin(null,['tr'])===null,'boş metin yok sayılır');
// 3) Uygulamadaki OFF verisinde arama
const V={u:{'0036000291452':['food','Ad','Marka',1700000000,{en:'Water'}],'8690504025207':['beauty','Krem','',0,{}]}};
const o=B.barkodOffBul(V,'036000291452');
ok(o&&o.kod==='0036000291452'&&o.tur==='gida'&&o.t===1700000000000&&o.metin.en==='Water'&&o.kaynak==='off','UPC-A ile 13 haneli kayıt bulunur');
ok(B.barkodOffBul(V,'8690504025207').tur==='koz','kozmetik kaydı');
ok(B.barkodOffBul(V,'4006381333931')===null&&B.barkodOffBul(null,'4006381333931')===null,'yoksa null');
// 4) Kaynak sırası: doğrulanmış kendi kaydımız > OFF (uygulamada) > OFF canlı > doğrulanmamış kendi kaydımız; içerik yoksa yalnızca ad
const urunD={kaynak:'urun',dogrulandi:true,metin:{tr:'a, b'}},urunU={kaynak:'urun',dogrulandi:false,metin:{tr:'u, v'}};
const off={kaynak:'off',metin:{tr:'c, d'},ad:'X'},canli={kaynak:'off',canli:true,metin:{tr:'e'},ad:'Y'},adYalniz={kaynak:'off',metin:{},ad:'Z',tur:'gida'};
ok(B.barkodSec({urun:urunD,off,offCanli:canli},['tr'])===urunD,'doğrulanmış kendi kaydı önce');
ok(B.barkodSec({urun:urunU,off,offCanli:canli},['tr'])===off,'OFF, doğrulanmamış kendi kaydından önce');
ok(B.barkodSec({urun:urunU,off:null,offCanli:canli},['tr'])===canli,'OFF canlı, doğrulanmamış kendi kaydından önce');
ok(B.barkodSec({urun:urunU},['tr'])===urunU,'yalnızca doğrulanmamış kayıt varsa o');
const r=B.barkodSec({off:adYalniz},['tr']);ok(r&&r.icerikYok&&r.ad==='Z','içerik yoksa ad taşınır, içerik için fotoğraf istenir');
ok(B.barkodSec({},['tr'])===null,'hiçbiri yok');
// 5) Katkı önerisi yalnızca okunmuş bir içerik listesinde
ok(B.barkodKatkiUygun('gida',10,8)&&!B.barkodKatkiUygun('gida',10,5)&&!B.barkodKatkiUygun('gida',2,2),'gıda: en az 3 parça, %60 tanınmış');
ok(B.barkodKatkiUygun('tem',0,1)&&!B.barkodKatkiUygun('tem',0,0),'temizlik: en az bir tanınan ifade/madde');
// 6) Benzerlik: Türkçe harf ve noktalama duyarsız; Worker'daki hesapla aynı
const a='İçindekiler: Buğday unu, şeker, palm yağı, kakao (%4), tuz.',b='icindekiler buğday unu seker palm yagi kakao %4 tuz';
ok(B.barkodBenzer(a,b)===1,'aynı içerik farklı yazım: '+B.barkodBenzer(a,b));
ok(B.barkodBenzer(a,'Su, şeker, karbondioksit, aroma')<B.BARKOD_AYAR.benzerlik,'farklı içerik benzer sayılmaz');
const W=await import(path.join(__dirname,'..','worker','src','barkod.js'));
const ciftler=[[a,b],[a,'Su, şeker, karbondioksit'],['Aqua, Glycerin, Parfum','AQUA GLYCERIN PARFUM LINALOOL'],['','x y'],['ÇĞİÖŞÜ ıi','cgiosu ii']];
ok(ciftler.every(([x,y])=>W.benzerlik(x,y)===B.barkodBenzer(x,y)),'Worker ve uygulama benzerliği aynı');
ok(W.BENZERLIK===B.BARKOD_AYAR.benzerlik,'eşik aynı');
ok(['8690504025207','96385074','036000291452','01234565','8690504025208','123'].every(k=>W.barkodGecerli(k)===B.barkodGecerli(k)),'Worker ve uygulama kontrol hanesi aynı');
// 6b) Katkıcı kimliği (O-22): 16 rastgele bayttan 32 onaltılık hane; başka biçim geçmez
const kb=Array.from({length:16},(_,i)=>i*17);
ok(B.katkiciUret(kb)==='00112233445566778899aabbccddeeff'&&B.katkiciGecerli(B.katkiciUret(kb)),'kimlik üretimi: '+B.katkiciUret(kb));
ok(B.katkiciUret(new Uint8Array(16)).length===32&&B.katkiciUret([255,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14]).startsWith('ff0001'),'tek haneli baytlar sıfırla tamamlanır');
ok(!B.katkiciGecerli('')&&!B.katkiciGecerli(null)&&!B.katkiciGecerli('ali@ornek.com')&&!B.katkiciGecerli('0'.repeat(31))&&!B.katkiciGecerli('G'.repeat(32))&&!B.katkiciGecerli('A'.repeat(32)),'geçersiz kimlik reddedilir');
// 7) data/barkod_off.json: yapı ve atıf
const F=path.join(__dirname,'..','data','barkod_off.json');
if(fs.existsSync(F)){
  const d=JSON.parse(fs.readFileSync(F,'utf8')),u=d.u,ks=Object.keys(u);
  ok(/ODbL/.test(d.meta.lisans)&&/Open Food Facts/.test(d.meta.atif),'lisans ve atıf yazılı');
  ok(ks.length===d.meta.sayi&&ks.filter(k=>Object.keys(u[k][4]).length).length===d.meta.icerikli,'sayılar meta ile uyumlu');
  ok(ks.every(k=>/^\d{8,14}$/.test(k)&&Array.isArray(u[k])&&(u[k].length===5||(u[k].length===6&&Array.isArray(u[k][5]))||(u[k].length===7&&(u[k][5]===null||Array.isArray(u[k][5]))&&Array.isArray(u[k][6])&&u[k][6].length>0&&u[k][6].every(e=>/^[a-z]{2}:[a-z0-9-]+$/.test(e))))&&['food','beauty','products'].includes(u[k][0])&&typeof u[k][4]==='object'),'her kayıt [db, ad, marka, t, {dil: metin}, besin?, kat?] (kat: dolu OFF kategori dizisi, besin yoksa null)');
  ok(ks.length>1000,'Türkiye verisi yüklü: '+ks.length);
}else ok(false,'data/barkod_off.json yok (python3 off_al.py && python3 gen_barkod.py)');
console.log(n+' barkod denetimi, '+fail+' hata');process.exit(fail?1:0);
})();
