// Kaydedilen ürünler: ekleme, tekrar kaydetme, süzgeç, arama, sıralama, değerlendirme değişikliği, yedek. Çalıştır: node test/kayit.js
const src=require('./yukle.js');
eval(src+';global.K={kayitAdd,kayitFind,kayitList,kayitSay,kayitFark,kayitOzet,kayitYedek,kayitGeriYukle,cmpProduct,KAYIT_AYAR}');
const {idx}=require('./run.js');
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
let L=[];
L=K.kayitAdd(L,{id:'k1',t:1,mode:'gida',name:'Gofret',text:'Şeker, kakao',oz:{u:0,d:1,top:['E407']}});
L=K.kayitAdd(L,{id:'k2',t:2,mode:'koz',name:'Şampuan',note:'Kızımın',text:'Aqua, Parfum',oz:{u:1,d:0,top:['X']}});
L=K.kayitAdd(L,{id:'k3',t:3,mode:'tem',name:'Çamaşır suyu',text:'Sodyum hipoklorit',oz:{u:0,d:0,top:[]}});
ok(L.length===3&&L[0].id==='k3','en yeni başta');
L=K.kayitAdd(L,{id:'k9',t:9,mode:'gida',name:'Gofret 2',text:' Şeker, kakao ',oz:null});
ok(L.length===3&&L[0].id==='k1'&&L[0].name==='Gofret 2'&&L[0].t===1&&L[0].u===9&&L[0].oz.d===1,'aynı tür + metin tek kayıt, ad güncellenir, özet korunur: '+JSON.stringify(L[0]));
ok(K.kayitAdd(L,{id:'x',t:10,mode:'gida',name:'a',text:'  '}).length===3,'boş metin kaydedilmez');
ok(K.kayitAdd(L,{id:'x',t:10,mode:'ilac',name:'a',text:'b'}).length===3,'bilinmeyen tür kaydedilmez');
ok(K.kayitAdd(L,{id:'x',t:10,mode:'gida',name:'',text:'yeni'})[0].name==='Adsız ürün','adsız');
ok(K.kayitAdd(L,{id:'x',t:10,mode:'koz',name:'a',text:'Şeker, kakao'}).length===4,'aynı metin başka türde ayrı kayıt');
let M=[];for(let i=0;i<120;i++)M=K.kayitAdd(M,{id:'k'+i,t:i,mode:'gida',name:'n'+i,text:'t'+i},K.KAYIT_AYAR.enFazla);
ok(M.length===100&&M[0].name==='n119','en fazla 100 kayıt');
// Süzgeç, arama, sıralama
ok(K.kayitList(L,'koz').length===1&&K.kayitList(L,'').length===3,'tür süzgeci');
ok(K.kayitList(L,'','KIZIMIN').length===1,'notta arama, Türkçe büyük harf');
ok(K.kayitList(L,'','camasir').length===1&&K.kayitList(L,'','ÇAMAŞIR').length===1,'Türkçe harf duyarsız');
ok(K.kayitList(L,'','','ad').map(x=>x.name).join()==='Çamaşır suyu,Gofret 2,Şampuan','ada göre (Türkçe sıra)');
ok(K.kayitList(L,'','','risk')[0].name==='Şampuan'&&K.kayitList(L,'','','risk')[1].name==='Gofret 2','önce uyarılı');
ok(K.kayitList(L,'','','yeni')[0].name==='Gofret 2','en yeni (son güncelleme)');
ok(JSON.stringify(K.kayitSay(L))==='{"":3,"gida":1,"koz":1,"tem":1}','sayılar');
// Özet ve değerlendirme değişikliği
const oz=K.kayitOzet(K.cmpProduct('İçindekiler: Şeker, E123, E407.',idx,{},'x'));
ok(oz.u===1&&oz.d===1&&/^E123 /.test(oz.top[0]),'özet: '+JSON.stringify(oz));
ok(K.kayitFark({u:0,d:1},{u:0,d:1})===null,'değişiklik yok');
let f=K.kayitFark({u:0,d:1},{u:0,d:2});ok(f&&f.kotu&&f.once==='0 uyarı, 1 dikkat'&&f.simdi==='0 uyarı, 2 dikkat','kötüleşme');
f=K.kayitFark({u:1,d:0},{u:0,d:3});ok(f&&!f.kotu,'uyarı azaldı iyileşme sayılır');
ok(K.kayitFark(null,{u:1,d:0})===null,'eski özet yoksa haber yok');
// Yedek
const y=K.kayitYedek(L,5);
let g=K.kayitGeriYukle([],y);ok(g.ok&&g.eklenen===3&&g.list.length===3,'yedekten geri yükleme');
g=K.kayitGeriYukle(L,y);ok(g.ok&&g.eklenen===0&&g.list.length===3,'var olanlar yeniden eklenmez');
ok(!K.kayitGeriYukle(L,'bozuk').ok&&!K.kayitGeriYukle(L,'{"tur":"baska"}').ok,'geçersiz dosya reddedilir');
g=K.kayitGeriYukle([],JSON.stringify({tur:'kayitli',kayitlar:[{mode:'gida',text:'a',name:'x'.repeat(200)},{mode:'zehir',text:'b'},{mode:'koz'},null]}));
ok(g.ok&&g.eklenen===1&&g.list[0].name.length===60,'bozuk kayıtlar atlanır, ad kısaltılır');
// Yedekte katkıcı kimliği (O-22)
const kim='0123456789abcdef0123456789abcdef';
ok(!('katkici' in JSON.parse(K.kayitYedek(L,5))),'katkı yapılmamışsa yedekte kimlik yok');
g=K.kayitGeriYukle([],K.kayitYedek([],5,kim));ok(g.ok&&g.katkici===kim&&g.eklenen===0,'yalnızca kimlik içeren yedek de geri yüklenir');
ok(K.kayitGeriYukle([],y).katkici==='','kimliksiz yedekte boş');
console.log(n+' kayıt denetimi, '+fail+' hata');process.exit(fail?1:0);
