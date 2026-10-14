// İki ürünü karşılaştırma: karar mantığı, madde farkları, tanınmayan oran, geçmiş. Çalıştır: node test/karsilastir.js
const src=require('./yukle.js');
eval(src+';global.K={cmpProduct,cmpProductK,cmpProductT,cmpDecide,cmpDiff,cmpMisfit,cmpMisfitOzel,ozelAra,histAdd,histName,KARS_AYAR,buildTIndex}');
const {idx}=require('./run.js');
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
const cfg=K.KARS_AYAR;
// Sahte ürün: yalnızca kararın baktığı alanlar
const P=(name,o)=>Object.assign({name,misfit:[],maxRank:0,yellow:0,top:[],palm:[],sugar:[],unknown:{total:5,found:5,ratio:0}},o||{});
const red=[{name:'E250 Sodyum nitrit',rank:3}];
let d;
// 1) Profil uyumsuzluğu her şeyden önce gelir
d=K.cmpDecide(P('A',{misfit:['Süt içerir (Süt tozu)']}),P('B',{maxRank:3,yellow:4,top:red}),cfg);
ok(d.winner==='B'&&d.kind==='profil','profil önce: '+JSON.stringify(d));
ok(/A profilinize uymuyor: Süt içerir/.test(d.reason),'profil nedeni');
d=K.cmpDecide(P('A',{maxRank:3,top:red}),P('B',{misfit:['Vegan değil (Jelatin)']}),cfg);
ok(d.winner==='A','B uyumsuz, A kırmızılı olsa da öne çıkar');
// 2) İkisi de uyumsuz: kazanan yok
d=K.cmpDecide(P('A',{misfit:['x']}),P('B',{misfit:['y']}),cfg);
ok(d.winner===null&&d.kind==='ikisi_uyumsuz','ikisi uyumsuz '+JSON.stringify(d));
// 3) En riskli madde
d=K.cmpDecide(P('A',{maxRank:3,yellow:0,top:red}),P('B',{maxRank:2,yellow:5,top:[{name:'E407',rank:2}]}),cfg);
ok(d.winner==='B'&&d.kind==='en_riskli','kırmızı > sarı '+JSON.stringify(d));
ok(/E250 Sodyum nitrit/.test(d.reason)&&/yalnızca A içinde/.test(d.reason),'en riskli nedeni: '+d.reason);
d=K.cmpDecide(P('A',{maxRank:0}),P('B',{maxRank:2,yellow:1,top:[{name:'E407',rank:2}]}),cfg);
ok(d.winner==='A','sarı > yeşil');
// 4) Sarı sayısı
d=K.cmpDecide(P('A',{maxRank:2,yellow:3}),P('B',{maxRank:2,yellow:1,palm:[]}),cfg);
ok(d.winner==='B'&&d.kind==='dikkat'&&/A 3, B 1|B 1, A 3/.test(d.reason),'sarı sayısı '+JSON.stringify(d));
d=K.cmpDecide(P('A',{maxRank:2,yellow:3,palm:['Palm yağı'],sugar:['Şeker','Glukoz şurubu']}),P('B',{maxRank:2,yellow:1,sugar:['Şeker']}),cfg);
ok(/Palm yağı yalnızca A içinde/.test(d.reason),'palm ek nedeni: '+d.reason);
d=K.cmpDecide(P('A',{maxRank:2,yellow:3,sugar:['Şeker','Glukoz şurubu']}),P('B',{maxRank:2,yellow:1,sugar:['Şeker']}),cfg);
ok(/Şeker kaynağı sayısı: B 1, A 2/.test(d.reason),'şeker ek nedeni: '+d.reason);
// 5) Eşitlik: Benzer
d=K.cmpDecide(P('A',{maxRank:2,yellow:2}),P('B',{maxRank:2,yellow:2}),cfg);
ok(d.winner===null&&d.kind==='benzer'&&d.title==='Benzer','benzer '+JSON.stringify(d));
// 6) Tanınmayan oran yüksek: kazanan yok
const hu={unknown:{total:6,found:2,ratio:4/6}};
d=K.cmpDecide(P('A',Object.assign({maxRank:0},hu)),P('B',{maxRank:3,top:red}),cfg);
ok(d.winner===null&&d.kind==='taninmadi'&&/A ürününün bazı içerikleri tanınamadı/.test(d.title),'tanınmayan '+JSON.stringify(d));
d=K.cmpDecide(P('A',{misfit:['x']}),P('B',hu),cfg);
ok(d.winner===null&&d.kind==='taninmadi','profil uyumsuz + diğeri tanınmamış: kazanan yok');
d=K.cmpDecide(P('A',{unknown:{total:2,found:0,ratio:1}}),P('B',{maxRank:2,yellow:1,top:[{name:'E407',rank:2}]}),cfg);
ok(d.winner==='A','çok kısa listede oran uygulanmaz (enAzParca)');
// Dil: "sağlıklı" yok, kazanan başlığı
d=K.cmpDecide(P('A',{maxRank:3,top:red}),P('B'),cfg);
ok(d.title==='B içerik açısından daha iyi görünüyor','başlık '+d.title);
ok(![d].concat([]).some(x=>/sağlık|zehir|tehlike/i.test(x.title+x.reason)),'korku/sağlık dili');

// Gerçek metinle ürün özeti
const A=K.cmpProduct('İçindekiler: Buğday unu, şeker, palm yağı, soya lesitini, renklendirici (E 110), tuz.',idx,{al:['allergen_gluten']},'Kraker');
const B=K.cmpProduct('İçindekiler: Pirinç unu, ayçiçek yağı, emülgatör (E322), tuz.',idx,{al:['allergen_gluten']},'Patlak');
ok(A.misfit.length===1&&/Gluten/.test(A.misfit[0])&&!B.misfit.length,'çölyak + glüten uyumsuz '+JSON.stringify([A.misfit,B.misfit]));
ok(A.gluten==='var'&&B.gluten==='yok','glüten durumu');
ok(A.maxRank===3&&A.top[0].name.startsWith('E110'),'en riskli E110');
ok(!A.items.some(x=>x.key.startsWith('B:upf_sinif_')),'sınıf adı madde sayılmaz');
d=K.cmpDecide(A,B,cfg);ok(d.winner==='B'&&d.kind==='profil','gerçek metin kararı '+JSON.stringify(d));
// Madde farkları: E322 ile soya lesitini tek madde
const df=K.cmpDiff(A,B),keys=a=>a.map(x=>x.key);
ok(keys(df.both).includes('E322')&&keys(df.both).includes('B:tuz'),'ikisinde de: '+keys(df.both));
ok(!keys(df.onlyA).includes('E322')&&!keys(df.onlyB).includes('E322'),'E322 tek madde');
ok(keys(df.onlyA).includes('E110')&&keys(df.onlyA).includes('B:palm'),'sadece A: '+keys(df.onlyA));
ok(keys(df.onlyB).includes('B:n_glutensiz_un'),'sadece B: '+keys(df.onlyB));
ok(keys(df.both).length+keys(df.onlyA).length===A.items.length,'A maddeleri eksiksiz dağıldı');
const C=K.cmpProduct('İçindekiler: Kakao, E322, şeker.',idx,{},'C'),D=K.cmpProduct('İçindekiler: Kakao, soya lesitini, şeker.',idx,{},'D');
ok(!K.cmpDiff(C,D).onlyA.length&&!K.cmpDiff(C,D).onlyB.length,'E322 = soya lesitini');
ok(K.cmpDecide(C,D,cfg).kind==='benzer','aynı içerik benzer');
// Simge kuralı (ansiklopedi ve sonuç ekranıyla aynı): yeşil onay yalnızca üretim yolu doğal olan uyarısız maddede
const U=K.cmpProduct('İçindekiler: Şeker, E100, E330, E300, tuz.',idx,{},'U'),ug=k=>U.items.filter(x=>x.key===k)[0];
ok(ug('E100')&&ug('E100').dogal===true,'E100 doğal');
ok(ug('E330')&&ug('E330').dogal===false&&ug('E300')&&ug('E300').dogal===false,'fermente ve işlenmiş doğal sayılmaz');
ok(ug('B:tuz')&&!ug('B:tuz').dogal,'bileşen doğal simgesi almaz');
const UD=K.cmpDiff(U,U).both.filter(x=>x.key==='E100')[0];ok(UD&&UD.dogal===true,'ikisinde de listesinde doğal bilgisi korunur');
// "İçermez" ve "içerebilir" madde sayılmaz
const E=K.cmpProduct('İçindekiler: Kakao, şeker. Palm yağı içermez. Fındık içerebilir.',idx,{al:['allergen_nuts']},'E');
ok(!E.items.some(x=>x.key==='B:palm'),'içermez sayılmaz');ok(!E.misfit.length,'içerebilir uyumsuzluk sayılmaz');
// Tanınmayan oran: sıradan bileşenler tanınmış, bozuk okuma tanınmamış
ok(K.cmpProduct('İçindekiler: Domates, su, tuz, zeytinyağı, sarımsak, karabiber.',idx,{},'x').unknown.ratio===0,'sade bileşenler tanınır');
ok(K.cmpProduct('İçindekiler: Bvğday vnu, şkr, plm yğ, glkz şrb, tuz.',idx,{},'x').unknown.ratio>cfg.taninmayanOran,'bozuk okuma tanınmaz');
ok(K.cmpProduct('İçindekiler: Kakao, şeker. Besin değerleri: Enerji 500 kcal, Yağ 30 g',idx,{},'x').unknown.total===2,'besin tablosu parça sayılmaz');
// Profil uyumsuzluğu türleri
const pr=(t,p)=>K.cmpProduct(t,idx,p,'x').misfit;
ok(pr('Süt tozu, şeker',{lactose:true}).length===1,'laktoz');
ok(pr('Jelatin, şeker',{vegan:true}).length===1,'vegan');
ok(pr('Bal, yulaf',{baby:true}).length===1,'bebek + bal');
ok(pr('Bal, yulaf',{}).length===0,'profil yoksa uyumsuzluk yok');
// Kozmetik: AB'de yasak bileşen uyarı (3), koku alerjeni profil uyumsuzluğu, tanınmayan oran
const KX=require('./kozmetik_cases.js').K,TX=K.buildTIndex(JSON.parse(require('fs').readFileSync(__dirname+'/../data/temizlik.json')));
const ka=K.cmpProductK('Ingredients: Aqua, Glycerin, Parfum, Linalool, Phenoxyethanol.',KX,{},'KA');
const kb=K.cmpProductK('Ingredients: Aqua, Glycerin, Butylphenyl Methylpropional, Phenoxyethanol.',KX,{},'KB');
ok(ka.mode==='koz'&&ka.items.some(x=>x.name==='LINALOOL'),'kozmetik maddeler');
ok(kb.maxRank===3&&kb.top.some(x=>/BUTYLPHENYL|LILIAL/.test(x.name)),'kozmetik AB yasağı uyarı: '+JSON.stringify(kb.top));
d=K.cmpDecide(ka,kb,cfg);ok(d.winner==='A'&&d.kind==='en_riskli','kozmetik karar '+JSON.stringify(d));
ok(K.cmpDecide(K.cmpProductK('Ingredients: Aqua, Glycerin, Parfum, Linalool.',KX,{koku:true},'X'),K.cmpProductK('Ingredients: Aqua, Glycerin.',KX,{koku:true},'Y'),cfg).kind==='profil','koku alerjisi profili');
ok(!K.cmpDiff(ka,ka).onlyA.length&&K.cmpDiff(ka,kb).onlyA.some(x=>x.name==='LINALOOL'),'kozmetik madde farkı');
// Temizlik: ciddi tehlike ifadesi (H318) uyarı, palm/şeker ek nedeni yok
const ta=K.cmpProductT('İçindekiler: %5-15 anyonik yüzey aktif maddeler, parfüm. DİKKAT. Cilt tahrişine yol açar.',TX,KX,{},'TA');
const tb=K.cmpProductT('İçindekiler: %5-15 anyonik yüzey aktif maddeler. TEHLİKE. Ciddi göz hasarına yol açar.',TX,KX,{},'TB');
ok(tb.items.some(x=>x.key==='H318'&&x.rank===3)&&ta.items.some(x=>x.key==='H315'&&x.rank===2),'temizlik ifadeleri: '+JSON.stringify(ta.items.concat(tb.items).map(x=>x.key+x.rank)));
d=K.cmpDecide(ta,tb,cfg);ok(d.winner==='A'&&/ifade ya da madde/.test(d.reason),'temizlik karar '+JSON.stringify(d));
ok(K.cmpProductT('Benzisothiazolinone. Methylisothiazolinone. Cilt tahrişine yol açar.',TX,KX,{baby:true},'x').misfit.length===0,'sarı ifade bebek uyumsuzluğu değil');
ok(K.cmpProductT('TEHLİKE. H304 Yutulması ve solunum yollarına girmesi halinde öldürücü olabilir.',TX,KX,{child:true},'x').misfit.length>0,'çocuk + yutma ciddi tehlike');
// Geçmiş
let h=[];for(let i=0;i<25;i++)h=K.histAdd(h,{mode:'gida',text:'metin '+i,t:i},20);
ok(h.length===20&&h[0].text==='metin 24','geçmiş 20 kayıt, en yeni başta');
h=K.histAdd(h,{mode:'gida',text:' metin 10 ',t:99},20);
ok(h.length===20&&h[0].t===99&&h.filter(x=>x.text.trim()==='metin 10').length===1,'aynı metin tekrar eklenmez');
ok(K.histAdd(h,{mode:'gida',text:'  '},20).length===20,'boş metin eklenmez');
ok(K.histName([])==='Tarama 1','ilk ad');
ok(K.histName([{name:'Tarama 2'},{name:'Süt'},{name:'Tarama 7'}])==='Tarama 8','sıra numarası');
// Profilim'de elle eklenen alerjen (ozelAra, cmpMisfitOzel): sözcük başında, ek ve ünsüz yumuşamasıyla; "içerebilir" cümlesi may
const OA=(m,a)=>JSON.stringify(K.ozelAra(m,a));
ok(OA('Şeker, kivi püresi, FISTIĞI ezmesi.','kivi')==='{"yes":["kivi"],"may":[]}','kivi bulunur');
ok(OA('Kivili yoğurt','kivi')==='{"yes":["Kivili"],"may":[]}','ek alan sözcük');
ok(OA('Şeker, FISTIĞI ezmesi, fistik','fıstık')==='{"yes":["FISTIĞI","fistik"],"may":[]}','ünsüz yumuşaması ve büyük harf');
ok(OA('Kebabı','kebap')==='{"yes":["Kebabı"],"may":[]}','p → b');
ok(OA('Yer fıstığı yağı, fıstık','yer fıstığı')==='{"yes":["Yer fıstığı"],"may":[]}','iki sözcüklü ad sırayla');
ok(OA('Un. Eser miktarda susam içerebilir.','susam')==='{"yes":[],"may":["susam"]}','içerebilir cümlesi may');
ok(OA('Susam. Susam içerebilir.','susam')==='{"yes":["Susam"],"may":[]}','hem var hem içerebilir: yalnızca var');
ok(OA('susamlı, su','su')==='{"yes":["su"],"may":[]}','kısa ad yalnızca tam sözcük');
ok(OA('Mısır nişastası','kakao')==='{"yes":[],"may":[]}','olmayan ad');
ok(OA('kakao',' ')==='{"yes":[],"may":[]}'&&OA('a b','a')==='{"yes":[],"may":[]}','boş ya da tek harf aranmaz');
ok(OA('May contain traces of kiwi.','kiwi')==='{"yes":[],"may":["kiwi"]}','İngilizce may contain');
const MO=K.cmpMisfitOzel('Kivi, şeker. Susam içerebilir.',{alOzel:['kivi','susam','kakao']});
ok(MO.length===1&&/kivi/.test(MO[0]),'karşılaştırmada yalnızca kesin içerilen eklenen alerjen: '+JSON.stringify(MO));
ok(K.cmpMisfitOzel('kivi',{al:[]}).length===0&&K.cmpMisfitOzel('kivi',null).length===0,'alOzel yok (eski profil)');
console.log(n+' karşılaştırma denetimi, '+fail+' hata');process.exit(fail?1:0);
