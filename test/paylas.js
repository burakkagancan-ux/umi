// Paylaşılabilir sonuç kartı: kart modeli, kişisel uyarı gizliliği, en riskli 3 madde, uzun ad, olumlu kart, dil, paylaşım metni.
// Çizim sahte bir 2B bağlamla yapılır; karta yazılan metinler kaydedilir. Çalıştır: node test/paylas.js
const fs=require('fs');
const src=require('./yukle.js');
eval(src+';global.P={payOzet,payNedenE,payNedenK,payModel,payText,payWrap,payDraw,payAd,payFromFood,payFromK,payFromT,PAYLAS_AYAR,buildTIndex,analyzeT,summarizeT}');
const {idx}=require('./run.js');
const {K,KL}=require('./kozmetik_cases.js');
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
const cfg=P.PAYLAS_AYAR,L=cfg.yerlesim[cfg.boyut];

// Sahte canvas bağlamı: harf başına yazı boyutunun 0,55'i genişlik
function fakeCtx(){
  const texts=[];let px=16;
  const c={texts,fillStyle:'',strokeStyle:'',lineWidth:1,lineCap:'',lineJoin:'',textAlign:'',textBaseline:'',
    set font(f){this._f=f;px=+(/(\d+)px/.exec(f)||[0,16])[1]},get font(){return this._f},
    measureText:s=>({width:String(s).length*px*0.55}),
    fillText(s,x,y){texts.push({s,x,y,px,w:String(s).length*px*0.55,al:this.textAlign})}};
  'fillRect beginPath moveTo lineTo quadraticCurveTo closePath fill stroke arc save restore translate scale clip drawImage'.split(' ').forEach(k=>c[k]=()=>{});
  return c;
}
const draw=M=>{const c=fakeCtx();P.payDraw(c,M,L,cfg,null);return c.texts};
const joined=t=>t.map(x=>x.s).join(' | ');

const pers=[{t:'Gluten içeren tahıllar içerir (Buğday unu)',lvl:2},{t:'Hamilelik: Alkol (Rom)',lvl:2}];
const src5={mode:'gida',items:[
  {name:'Buğday unu',lvl:0},{name:'E322 Lesitinler',lvl:0},{name:'E407 Karagenan',lvl:1},{name:'E110 Gün batımı sarısı FCF',lvl:2},
  {name:'E250 Sodyum nitrit',lvl:2},{name:'E621 Monosodyum glutamat',lvl:1},{name:'E129 Allura kırmızısı AC',lvl:2}],
  unverified:0,allergens:'İçerir: Gluten içeren tahıllar',personal:pers};

// 1) Kişisel uyarılar varsayılan olarak kartta yok
let M=P.payModel(src5,{name:'Kraker'});
ok(M.personal.length===0&&M.hasPersonal,'varsayılan: kişisel satır yok, seçenek gösterilir');
let T=draw(M);
ok(!/Hamilelik|Buğday unu\)/.test(joined(T)),'varsayılan çizimde kişisel uyarı yok: '+joined(T));
M=P.payModel(src5,{name:'Kraker',kisisel:false});
ok(!/Hamilelik/.test(joined(draw(M))),'kisisel:false');
ok(!/Hamilelik|Gluten içeren tahıllar içerir/.test(P.payText(M)),'paylaşım metninde kişisel bilgi yok');

// 2) Seçenek açılınca eklenir
M=P.payModel(src5,{name:'Kraker',kisisel:true});T=draw(M);
ok(M.personal.length===2,'açıkken 2 satır');
ok(/Gluten içeren tahıllar içerir \(Buğday unu\)/.test(joined(T))&&/Hamilelik: Alkol \(Rom\)/.test(joined(T)),'açıkken çizimde: '+joined(T));
M=P.payModel(Object.assign({},src5,{personal:pers.concat([{t:'Üçüncü',lvl:1}])}),{kisisel:true});
ok(M.personal.length===cfg.enFazlaKisisel,'kişisel satır sınırı');
ok(!P.payModel(Object.assign({},src5,{personal:[]}),{}).hasPersonal,'kişisel uyarı yoksa seçenek gösterilmez');

// 3) 3'ten fazla riskli maddede yalnızca en riskli 3
M=P.payModel(src5,{name:'Kraker'});
ok(M.top.length===3,'en fazla 3 madde: '+M.top.length);
ok(M.top.every(x=>x.lvl===2)&&M.top.map(x=>x.name).join()==='E110 Gün batımı sarısı FCF,E250 Sodyum nitrit,E129 Allura kırmızısı AC','en riskliden başlar, eşitlikte okunduğu sıra: '+M.top.map(x=>x.name));
ok(M.more===2,'+2 madde daha: '+M.more);
ok(M.counts.ok===2&&M.counts.dikkat===2&&M.counts.uyari===3,'sayılar '+JSON.stringify(M.counts));
T=draw(M);
ok(!/E407|E621/.test(joined(T))&&/\+2 madde daha/.test(joined(T)),'çizimde 4. ve 5. madde yok');
M=P.payModel({mode:'gida',items:[{name:'A',lvl:1},{name:'B',lvl:2},{name:'C',lvl:1},{name:'D',lvl:1}]},{});
ok(M.top.map(x=>x.name).join()==='B,A,C','sarılar kırmızıdan sonra: '+M.top.map(x=>x.name));

// 4) Uzun ürün adı taşmadan kısaltılır
const uzun='Çikolatalı fındık kremalı gofret süper ekonomik aile boyu paket 500 gram ve daha fazlası';
M=P.payModel(src5,{name:uzun});T=draw(M);
const ad=T.filter(x=>x.px===L.ad);
ok(ad.length===L.adSatir,'ad en fazla '+L.adSatir+' satır: '+ad.length);
ok(ad.every(x=>x.w<=L.w-2*L.pad),'ad satırları genişliği aşmaz');
ok(/…$/.test(ad[ad.length-1].s),'son satır … ile biter: '+ad[ad.length-1].s);
{const out=T.filter(x=>x.al==="right"?x.x-x.w<0:x.x+x.w>L.w);ok(!out.length,"hiçbir metin kartın dışına taşmaz: "+JSON.stringify(out))}
const w=P.payWrap('Tekçokuzunbirsözcükolanürünadıburadabölünmeli',200,2,s=>s.length*20);
ok(w.length===1&&w[0].length*20<=200&&/…$/.test(w[0]),'tek uzun sözcük kesilir: '+w);
ok(P.payWrap('Kısa ad',500,2,s=>s.length*20).join()==='Kısa ad','kısa ad aynen kalır');
ok(P.payWrap('a b c d e f',60,2,s=>s.length*20).length===2,'iki satır sınırı');

// 5) Hiç riskli madde yoksa olumlu ve dengeli kart
M=P.payModel({mode:'gida',items:[{name:'Pirinç unu',lvl:0},{name:'Tuz',lvl:0},{name:'E330 Sitrik asit',lvl:0}],allergens:''},{name:'Patlak'});
T=draw(M);
ok(M.top.length===0&&M.counts.ok===3,'riskli yok');
ok(/Özel uyarı bulunan madde yok/.test(joined(T))&&/Okunan 3 maddede dikkat işareti çıkmadı/.test(joined(T)),'olumlu kutu: '+joined(T));
ok(!T.some(x=>x.s==='Uyarı'||x.s==='Dikkat'),'madde satırı yok');
ok(!/güvenli|uygun|sağlıklı|temiz ürün/i.test(joined(T)+P.payText(M)),'olumlu kartta onay dili yok');
ok(/dikkat gerektiren madde çıkmadı/.test(P.payText(M)),'olumlu paylaşım metni: '+P.payText(M));

// 6) Dil: kartın kendi metinleri yalnızca olgu, korku/yargı dili yok (madde adları hariç)
const own=[];
[src5,{mode:'koz',items:[{name:'X',lvl:1}],allergens:'Koku alerjeni: LINALOOL'},{mode:'tem',items:[]}].forEach(s=>{
  [false,true].forEach(k=>{const m=P.payModel(Object.assign({personal:[]},s),{name:'Ürün',kisisel:k});
    draw(m).forEach(x=>{if(!m.top.some(t=>t.name===x.s)&&x.s!=='Ürün')own.push(x.s)});own.push(P.payText(m))});
});
ok(!own.some(s=>/zararlı|uzak dur|kaçının|tehlikeli|zehir|kesinlikle|asla|korkunç|kanser/i.test(s)),'yargı/korku dili: '+own.filter(s=>/zararlı|uzak|kaçın|tehlike|zehir/i.test(s)));
ok(own.some(s=>s.indexOf(cfg.not)===0),'"Bilgilendirme amaçlıdır." notu');
ok(own.includes(cfg.uygulamaAdi)&&own.includes(cfg.slogan),'alt bant: uygulama adı ve slogan');

// 7) Paylaşım metni ve uygulama adı tek sabitten
M=P.payModel(src5,{name:'Kraker'});
ok(P.payText(M)==='Kraker içeriğine baktım: 5 madde dikkat gerektiriyor. Tağşiş ile sen de tara: https://burakkagancan-ux.github.io/tagsis/','metin: '+P.payText(M));
const c2=Object.assign({},cfg,{uygulamaAdi:'YeniAd',adres:'https://ornek.app/'});
ok(/YeniAd ile sen de tara: https:\/\/ornek\.app\/$/.test(P.payText(M,c2)),'ad sabitten okunur');
{const c=fakeCtx();P.payDraw(c,M,L,c2,null);ok(c.texts.some(x=>x.s==='YeniAd')&&c.texts.some(x=>x.s==='ornek.app'),'kartta yeni ad ve adres')}

// 8) Ad: tarama sırası + tarih ve saat
const t0=new Date(2026,9,5,14,30).getTime();
ok(P.payAd({name:'Tarama 3',t:t0})==='Tarama 3 · 5 Ekim 14:30','otomatik ad: '+P.payAd({name:'Tarama 3',t:t0}));
ok(P.payAd({name:'Kraker',t:t0})==='Kraker','verilen ad aynen');
ok(P.payAd(null,new Date(2026,0,9,8,5).getTime())==='Tarama · 9 Ocak 08:05','kayıt yok');

// 9) Gerçek metinlerden kart kaynağı
let F=P.payFromFood('İçindekiler: Buğday unu, şeker, palm yağı, soya lesitini, renklendiriciler (E 110, E 129, E 102), koruyucu (E 211), tuz. Fındık içerebilir.',idx);
M=P.payModel(F,{});
ok(M.top.length===3&&M.top.every(x=>x.lvl===2)&&M.more>=1,'gıda: en riskli 3 '+JSON.stringify(M.top));
ok(/İçerir: .*Gluten/.test(F.allergens)&&/İçerebilir: /.test(F.allergens),'gıda alerjen satırı: '+F.allergens);
ok(!F.items.some(x=>/renklendirici/i.test(x.name)),'sınıf adı madde sayılmaz');
const kr=KL.analyzeK('Ingredients: Aqua, Glycerin, Butylparaben, Parfum, Linalool, Limonene.',K,{});
F=P.payFromK(kr,KL.summarizeK(kr,K));
ok(F.items.some(x=>x.name==='BUTYLPARABEN'&&x.lvl>=1)&&/LINALOOL/.test(F.allergens)&&!/Koku alerjeni/.test(F.allergens),'kozmetik: '+JSON.stringify(F));
const Ti=P.buildTIndex(JSON.parse(fs.readFileSync(__dirname+'/../data/temizlik.json')));
const A=P.analyzeT('TEHLİKE H318 Ciddi göz hasarına yol açar. EUH208 Contains limonene.',Ti,K);
F=P.payFromT(A,P.summarizeT(A));
ok(F.items.some(x=>/^H318 /.test(x.name)&&x.lvl===2)&&!F.items.some(x=>/^EUH208 içerir/.test(x.name)),'temizlik: '+JSON.stringify(F.items));

// 10) Kısa gerekçe: gıda bayraklarından, kozmetikte liste/bayraktan; korku dili yok
const Ei=id=>idx.byId[id];
ok(P.payNedenE(['E102'],idx)==="AB'de zorunlu uyarı etiketi",'E102: '+P.payNedenE(['E102'],idx));
ok(/^IARC Grup (1|2A|2B)$/.test(P.payNedenE(['E250'],idx))||P.payNedenE(['E250'],idx)!=='','E250: '+P.payNedenE(['E250'],idx));
ok(P.payNedenE(['E211'],idx)==='C vitaminiyle benzen oluşabilir','E211 benzenin grubunu almaz: '+P.payNedenE(['E211'],idx));
ok(P.payNedenE(['E150d'],idx)==='Yan ürünü IARC Grup 2B','E150d: '+P.payNedenE(['E150d'],idx));
ok(P.payNedenE(['E239'],idx)==='Formaldehite ayrışabilir','E239: '+P.payNedenE(['E239'],idx));
ok(['E407','E968','E621','E459'].every(i=>P.payNedenE([i],idx)==='Günlük alım sınırı aşılabilir (EFSA)'),'ADI aşımı tartışmadan önce: '+['E407','E968','E621','E459'].map(i=>P.payNedenE([i],idx)));
ok(P.payNedenE(['E951'],idx)==='IARC Grup 2B','E951: '+P.payNedenE(['E951'],idx));
ok(P.payNedenE(['E459'],idx)!=='','bayraksız sarı maddede de gerekçe: '+P.payNedenE(['E459'],idx));
F=P.payFromFood('İçindekiler: Şeker, palm yağı, renklendirici (E 102), koruyucu (E 250), süt tozu.',idx);
ok(F.items.filter(x=>x.lvl>0).every(x=>x.why),'gıda: her riskli maddede gerekçe '+JSON.stringify(F.items));
ok(F.facts.includes('Palm yağı içerir')&&F.facts.some(x=>/^Eklenmiş şeker/.test(x))&&F.facts.includes('Vegan değil'),'gıda olguları: '+F.facts);
ok(F.recog&&F.recog.total>=3,'tanınma bilgisi: '+JSON.stringify(F.recog));
F=P.payFromK(kr,KL.summarizeK(kr,K),K);
ok(F.items.find(x=>x.name==='BUTYLPARABEN').why,'kozmetik gerekçe: '+JSON.stringify(F.items.find(x=>x.name==='BUTYLPARABEN')));
const why=[];[['E102'],['E250'],['E407'],['E621'],['E220'],['E951'],['E420']].forEach(i=>why.push(P.payNedenE(i,idx)));
ok(!why.some(s=>/zararlı|tehlikeli|zehir|kanser/i.test(s)),'gerekçe dili: '+why);

// 11) Özet satırı ve olgular kartta
M=P.payModel(src5,{name:'Kraker'});
ok(P.payOzet(M)==='7 maddeden 5 tanesi dikkat gerektiriyor','özet: '+P.payOzet(M));
ok(P.payOzet(P.payModel({mode:'gida',items:[{name:'A',lvl:0}]},{}))==='','riskli yoksa özet satırı yok');
M=P.payModel(Object.assign({},src5,{facts:['Vegan değil','Palm yağı içerir'],recog:{total:10,found:8}}),{name:'Kraker'},cfg,L);T=draw(M);
ok(/Vegan değil/.test(joined(T))&&/Okunan 10 bileşenden 8 tanesi tanındı/.test(joined(T)),'olgu ve tanınma satırı: '+joined(T));
ok(/Alerjenler: /.test(joined(T)),'gıdada alerjen başlığı');
M=P.payModel({mode:'koz',items:[{name:'X',lvl:1}],allergens:'LINALOOL'},{});
ok(/Koku alerjenleri: /.test(joined(draw(M)))&&!/Alerjenler: /.test(joined(draw(M))),'kozmetikte koku alerjeni başlığı tek');

// 12) İki yerleşimde de hiçbir bölüm alttaki notun ya da bandın üstüne binmez (en kalabalık kart)
const kal=Object.assign({},src5,{items:src5.items.concat([1,2,3,4,5].map(i=>({name:'E9'+i+' Uzun adlı bir katkı maddesi '+i,lvl:1,why:'Bilimsel tartışma var'}))),
  facts:['Vegan değil','Palm yağı içerir','Eklenmiş şeker (3 tür)','Tatlandırıcı içerir','Kafein içerir','Alkol içerir'],recog:{total:20,found:15},
  allergens:'İçerir: Gluten içeren tahıllar, Süt, Yumurta, Soya · İçerebilir: Fındık, Yer fıstığı, Susam, Hardal, Kereviz'});
Object.keys(cfg.yerlesim).forEach(b=>{
  const Lb=cfg.yerlesim[b],m=P.payModel(kal,{name:uzun,kisisel:true},cfg,Lb),c=fakeCtx(),Hb=P.payDraw(c,m,Lb,cfg,null).h;
  const not=c.texts.find(x=>x.s.indexOf(cfg.not)===0),tan=c.texts.find(x=>/bileşenden/.test(x.s)),ust=Math.min(not.y,tan?tan.y:1e9)-30;
  const ni=c.texts.indexOf(not),body=c.texts.slice(0,ni).filter(x=>x.y<Hb-Lb.bant&&x!==tan&&x.y>ust);   // not ve sonrası alt bölüm
  ok(!body.length,b+': not alanına binen metin yok: '+JSON.stringify(body.map(x=>x.s)));
  ok(c.texts.some(x=>/Hamilelik/.test(x.s)),b+': kişisel uyarı sığdı');
  // Bütün uyarı ve dikkat maddeleri kartta; kart içeriğe göre uzar (14.10.2026, kullanıcı isteği)
  ok(m.top.length===10&&!m.more,b+': bütün riskli maddeler kartta '+m.top.length);
  ok(m.top.every(it=>c.texts.some(x=>x.s.indexOf(it.name.slice(0,12))===0)),b+': her madde çizildi');
  ok(Hb>Lb.h&&Hb<=Lb.enBoy&&!c.texts.some(x=>/madde daha/.test(x.s)),b+': kart uzadı, "+N madde daha" yok: '+Hb);
  const out=c.texts.filter(x=>x.al==='right'?x.x-x.w<0:x.al==='center'?x.x-x.w/2<0||x.x+x.w/2>Lb.w:x.x+x.w>Lb.w);
  ok(!out.length,b+': genişlik taşması yok: '+JSON.stringify(out.map(x=>x.s)));
});
ok(cfg.yerlesim[cfg.boyut].h===1920,'varsayılan hikâye (1080x1920)');
// Az maddeli kart 1920'de kalır; aşırı uzun listede kart enBoy'da durur ve "+N madde daha" yazılır
{const c=fakeCtx(),h=P.payDraw(c,P.payModel(src5,{name:'Kraker'},cfg,L),L,cfg,null).h;ok(h===1920,'az maddede 1920: '+h);
 const cok={mode:'gida',items:Array.from({length:120},(_,i)=>({name:'E'+(100+i)+' Madde',lvl:i%2+1}))},c2=fakeCtx(),h2=P.payDraw(c2,P.payModel(cok,{name:'Çok'},cfg,L),L,cfg,null).h;
 ok(h2===L.enBoy&&c2.texts.some(x=>/madde daha/.test(x.s)),'120 maddede kart '+L.enBoy+' ve "+N madde daha": '+h2)}

// 13) Olumlu kartta okunan maddeler listelenir
M=P.payModel({mode:'gida',items:[{name:'Pirinç unu',lvl:0},{name:'Tuz',lvl:0}]},{name:'Patlak'},cfg,L);T=draw(M);
ok(/Okunan maddeler/.test(joined(T))&&T.some(x=>x.s==='Pirinç unu'),'okunan maddeler: '+joined(T));
// 14) Besin değerleri: yalnızca düzeyi olan satırlar, birimle başlık; tablo yoksa bölüm yok; sığmazsa olgulardan sonra düşer
{
  const bes={birim:'g',satir:[{alan:'yag',v:12,lt:false,duzey:'orta'},{alan:'doymus',v:6,lt:false,duzey:'yuksek'},{alan:'seker',v:3.25,lt:false,duzey:'dusuk'},{alan:'tuz',v:0.5,lt:true,duzey:null}]};
  M=P.payModel(Object.assign({},src5,{besin:bes}),{name:'Kraker'},cfg,L);T=draw(M);
  ok(/Besin Değerleri \(100 g başına\)/.test(joined(T))&&T.some(x=>x.s==='Yağ 12 g · Orta')&&T.some(x=>x.s==='Doymuş yağ 6 g · Yüksek')&&T.some(x=>x.s==='Şekerler 3,25 g · Düşük'),'besin satırları: '+joined(T));
  ok(!/Tuz/.test(joined(T)),'düzeyi bilinmeyen satır kartta yok');
  ok(!/Besin Değerleri/.test(joined(draw(P.payModel(src5,{name:'Kraker'},cfg,L)))),'tablo yoksa bölüm yok');
  M=P.payModel({mode:'gida',items:[{name:'Pirinç unu',lvl:0}],besin:bes},{name:'Patlak'},cfg,L);
  ok(/Besin Değerleri/.test(joined(draw(M))),'olumlu kartta da besin bölümü');
  // En kalabalık kartta (12. bölümdeki) besin bölümü notun üstüne binmez; yer yoksa düşer, kişisel uyarı kalır
  const c=fakeCtx(),m=P.payModel(Object.assign({},kal,{besin:bes}),{name:uzun,kisisel:true},cfg,L),Hc=P.payDraw(c,m,L,cfg,null).h;
  const not=c.texts.find(x=>x.s.indexOf(cfg.not)===0),tan=c.texts.find(x=>/bileşenden/.test(x.s)),ust=Math.min(not.y,tan?tan.y:1e9)-30;
  const body=c.texts.slice(0,c.texts.indexOf(not)).filter(x=>x.y<Hc-L.bant&&x!==tan&&x.y>ust);
  ok(!body.length&&c.texts.some(x=>/Hamilelik/.test(x.s)),'besinli kalabalık kartta not alanına binen metin yok: '+JSON.stringify(body.map(x=>x.s)));
}

console.log(n+' durum, '+fail+' hata');process.exit(fail?1:0);
