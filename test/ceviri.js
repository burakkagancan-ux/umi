// Çok dil denetimi. Çalıştır: node test/ceviri.js
// 1) i18n/diller.json'daki her dilin dosyası var; tr ve en tr.json'daki her anahtarı içeriyor (diğer diller kapsama raporu); yer tutucular ({n}, {ad}) her dilde aynı.
// 2) Kodda (js/*.js, sayfalar) kullanılan her anahtar tanımlı; tr.json'da kullanılmayan anahtar yok.
// 3) Arayüz dosyalarında anahtara taşınmamış Türkçe metin kalmadı (ğüşıöç taraması; bilinçli istisnalar aşağıda, gerekçesiyle).
// 4) Sayfalardaki (ocr.html, ansiklopedi.html, index.html) data-i18n metinleri tr.json ile aynı (sayfa ilk açılışta Türkçe görünür, dil dosyası gelince aynı metin yazılır).
// 5) Hiçbir js dosyası t() işlevini yerel bir "t" değişkeniyle gölgelemiyor.
// 6) t(), çoğul, sayı ve tarih biçimi (Türkçe çıktı eski görünümle aynı).
const fs=require('fs'),path=require('path'),R=path.join(__dirname,'..'),I=path.join(R,'i18n');
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
const oku=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const tr=oku(path.join(I,'tr.json')),bilgi=oku(path.join(I,'diller.json')).diller;
// Yer tutucular: düz metinde ya da çoğul nesnesinin bütün biçimlerinde
const yt=v=>[...new Set((typeof v==='string'?[v]:Object.values(v)).join(' ').match(/\{\w+\}/g)||[])].sort().join(',');
const ANAHTAR=/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
// Eksiksiz olması zorunlu diller: kaynak (tr) ve ilk yedek (en). Diğer dillerde eksik ya da artık anahtar hata değil, kapsama raporu
// (YOL_HARITASI.md O-24): yeni özellik 60 dilin çevirisini beklemeden birleşir, eksik metin İngilizce görünür (dilBul sırası).
const ZORUNLU=['tr','en'];

// 1) Dil dosyaları
ok(bilgi.tr,'diller.json: tr kaydı yok');
for(const k of Object.keys(tr)){ok(ANAHTAR.test(k),'anahtar biçimi (küçük harf, ASCII, nokta): '+k);const v=tr[k];ok(typeof v==='string'||(v&&typeof v==='object'&&typeof v.other==='string'),'değer metin ya da {one,other}: '+k)}
for(const [kod,b] of Object.entries(bilgi)){
  ok(typeof b.ad==='string'&&b.ad,'diller.json '+kod+': ad');ok(b.yon==='ltr'||b.yon==='rtl','diller.json '+kod+': yon ltr|rtl');
  if(b.yazi)ok(typeof b.yazi.govde==='string'||typeof b.yazi.baslik==='string','diller.json '+kod+': yazi.baslik/govde');
  if(b.yazi&&b.yazi.css)ok(fs.existsSync(path.join(R,b.yazi.css)),'diller.json '+kod+': yazı tipi dosyası yok '+b.yazi.css);
  const p=path.join(I,kod+'.json');ok(fs.existsSync(p),'dil dosyası yok: i18n/'+kod+'.json');if(!fs.existsSync(p))continue;
  const d=oku(p),eksik=Object.keys(tr).filter(k=>!(k in d)),fazla=Object.keys(d).filter(k=>!(k in tr));
  if(ZORUNLU.includes(kod)){
    ok(!eksik.length,kod+'.json eksik anahtar ('+eksik.length+'): '+eksik.slice(0,10).join(', '));
    ok(!fazla.length,kod+'.json tr.json\'da olmayan anahtar: '+fazla.slice(0,10).join(', '));
  }else if(eksik.length||fazla.length)console.log('BİLGİ '+kod+'.json kapsama %'+Math.floor(100*(Object.keys(tr).length-eksik.length)/Object.keys(tr).length)+' (eksik '+eksik.length+(fazla.length?', artık '+fazla.length:'')+'; eksikler İngilizce görünür)');
  for(const k of Object.keys(tr))if(k in d){ok(yt(tr[k])===yt(d[k]),kod+'.json yer tutucu farklı: '+k+' ('+yt(tr[k])+' / '+yt(d[k])+')');ok(typeof d[k]==='string'||(d[k]&&d[k].other),kod+'.json değer: '+k)}
}
// Veri çevirileri (i18n/veri/<kod>.json): yalnızca desteklenen dillerde
const VD=path.join(I,'veri');if(fs.existsSync(VD))for(const f of fs.readdirSync(VD)){ok(bilgi[f.replace(/\.json$/,'')],'i18n/veri/'+f+': diller.json\'da yok');const d=oku(path.join(VD,f));for(const k of Object.keys(d))if(!k.startsWith('_'))ok(typeof d[k]==='string','i18n/veri/'+f+' değer metin değil: '+k)}

// Veri çevirisi anahtarları gerçek bir kayda ya da veri metnine denk gelmeli (yazım hatasıyla boşa düşen çeviri olmasın)
{
  const D=f=>oku(path.join(R,'data',f)),E=D('e_kodlari.json'),B=D('bilesenler.json'),K=D('kozmetik.json'),KI=D('kozmetik_inci.json'),T=D('temizlik.json');
  const tum=['e_kodlari.json','bilesenler.json','kozmetik.json','temizlik.json','eslesmeler.json'].map(f=>fs.readFileSync(path.join(R,'data',f),'utf8')).join('\n');
  const varMi={alerjen:new Set(B.meta.allergens.map(a=>a[0])),'e.bayrak':new Set(Object.keys(E.meta.flags)),'k.bayrak':new Set(Object.keys(K.meta.flags)),'k.bayrak_neden':new Set(Object.keys(K.meta.inci_flag_reasons)),
    'k.liste':new Set(Object.keys(K.meta.watch_lists)),'t.grup':new Set(T.groups.map(g=>g.id)),'t.bant':new Set(Object.keys(T.meta.bands)),'t.grup_etiket':new Set(Object.keys(T.meta.group_labels)),b:new Set(B.items.map(x=>x.id)),e:new Set(E.ingredients.map(x=>x.id))};
  const islev=new Set(KI.functions);
  // Bakanlık listesindeki ürün grubu ve uygunsuzluk türü adları (js/arayuz_liste.js build ile aynı ayıklama; arşivdekiler dahil)
  var LADLAR=new Set();{const cl=s=>String(s||'').replace(/\s+/g,' ').trim(),L=D('tagsis.json').listeler,A=D('arsiv.json').kayitlar;
    [].concat(...Object.values(L),A.map(a=>a.kayit)).forEach(r=>{LADLAR.add(cl(r.UrunGrupAdi));String(r.Uygunsuzluk||'').split(/<\/br>/i).forEach(x=>LADLAR.add(cl(x).replace(/[,\s]+$/,'')))});
    LADLAR.forEach(x=>{if(/^[-–—\s]*$/.test(x))LADLAR.delete(x)})}
  // Bakanlık yeni ad eklerse günlük güncelleme testi kırmasın: çevirisi olmayan ad yalnızca bildirilir (ekranda Türkçe görünür)
  if(fs.existsSync(VD))for(const f of fs.readdirSync(VD)){const d=oku(path.join(VD,f)),yok=[...LADLAR].filter(x=>!('liste:'+x in d));if(yok.length)console.log('BİLGİ i18n/veri/'+f+': çevirisi olmayan Liste adı ('+yok.length+'): '+yok.join(' | '))}
  if(fs.existsSync(VD))for(const f of fs.readdirSync(VD))for(const k of Object.keys(oku(path.join(VD,f)))){
    if(k.startsWith('_'))continue;
    if(k.startsWith('metin:')){const m=k.slice(6),js=JSON.stringify(m).slice(1,-1);ok(tum.indexOf('"'+js+'"')>-1||tum.indexOf(js)>-1&&/^[a-zçğıöşü]/.test(m)||Object.keys(E.ingredients.reduce((o,x)=>(x.category&&(o[x.category]=1),o),{})).includes(m)||B.items.some(x=>x.upf_class&&x.upf_class[0].toLocaleUpperCase('tr')+x.upf_class.slice(1)===m),'i18n/veri/'+f+': veride olmayan metin: '+k);continue}
    if(k.startsWith('k.islev:')){ok(islev.has(k.slice(8)),'i18n/veri/'+f+': CosIng işlevi yok: '+k);continue}
    if(k.startsWith('liste:')){ok(LADLAR.has(k.slice(6)),'i18n/veri/'+f+': Bakanlık listesinde böyle bir ürün grubu/uygunsuzluk yok: '+k);continue}
    if(k==='t.uzem'||k.startsWith('t.karistirma.')||k.startsWith('t.kapsul.'))continue;
    // Kimliği nokta içerebilen anahtarlar: kozmetik kayıt (II/12), K3 notu (liste.INCI), temizlik madde/ifade notu, eşleşme kuralı, Türkiye durumu
    if(k.startsWith('k.izle.')){const r=k.slice(7),i=r.indexOf('.');ok(K.watch.some(w=>w.list===r.slice(0,i)&&(w.inci||[])[0]===r.slice(i+1)),'i18n/veri/'+f+': K3 kaydı yok: '+k);continue}
    if(k.startsWith('k.tr_durum.')){ok(k.slice(11) in (K.meta.tr_text||{}),'i18n/veri/'+f+': TR durumu yok: '+k);continue}
    if(/^k\.[IV]+\//.test(k)){const id=k.slice(2).replace(/\.(reason|not|degisiklik\.\d+)$/,'');ok(K.entries.some(e=>e.id===id),'i18n/veri/'+f+': kozmetik kaydı yok: '+k);continue}
    if(k.startsWith('t.madde.')){ok(T.subs.some(x=>x.id===k.split('.')[2]),'i18n/veri/'+f+': temizlik maddesi yok: '+k);continue}
    if(k.startsWith('t.ifade.')){ok(T.hazards.some(x=>x.code===k.split('.')[2]),'i18n/veri/'+f+': tehlike ifadesi yok: '+k);continue}
    if(k.startsWith('eslesme.')){ok(D('eslesmeler.json').rules.some(x=>x.id===k.split('.')[1]),'i18n/veri/'+f+': eşleşme kuralı yok: '+k);continue}
    const p=k.split('.'),on=['e.bayrak','k.bayrak','k.bayrak_neden','k.liste','t.grup','t.bant','t.grup_etiket'].find(x=>k.startsWith(x+'.'))||p[0],id=k.slice(on.length+1).split('.')[0];
    ok(varMi[on]&&varMi[on].has(id),'i18n/veri/'+f+': kayıt yok: '+k);
  }
}
// JS kaynağını parçalara ayırır: dizgeler (tırnaklı), düzenli ifadeler ve yorumlar ayrılır (kaba ama bu kod tabanının yazımı için yeterli)
function parcala(src){
  const out={str:[],code:''};let i=0,prev='';
  const reOnce=/[(,=:[!&|?{};+\-*%<>~^]$|^$|return$|typeof$|case$/;
  while(i<src.length){
    const c=src[i],c2=src[i+1];
    if(c==='/'&&c2==='*'){const e=src.indexOf('*/',i+2);i=e<0?src.length:e+2;continue}
    if(c==='/'&&c2==='/'){const e=src.indexOf('\n',i);i=e<0?src.length:e;continue}
    if(c==='"'||c==="'"||c==='`'){let j=i+1,s='';while(j<src.length&&src[j]!==c){if(src[j]==='\\'){s+=src[j]+src[j+1];j+=2;continue}s+=src[j++]}out.str.push({s,i});out.code+='""';i=j+1;prev='"';continue}
    if(c==='/'){const w=(out.code.match(/(\S+)\s*$/)||['',''])[1];if(reOnce.test(w)){let j=i+1,sinif=false;while(j<src.length&&(src[j]!=='/'||sinif)){if(src[j]==='\\'){j+=2;continue}if(src[j]==='[')sinif=true;else if(src[j]===']')sinif=false;if(src[j]==='\n')break;j++}j++;while(/[a-z]/.test(src[j]||''))j++;out.code+='/re/';i=j;continue}}
    out.code+=c;if(!/\s/.test(c))prev=c;i++;
  }
  return out;
}
const JS=fs.readdirSync(path.join(R,'js')).filter(f=>f.endsWith('.js'));
const kaynak={};JS.forEach(f=>kaynak['js/'+f]=fs.readFileSync(path.join(R,'js',f),'utf8'));
// Arayüzü çevrilen sayfalar (data-i18n). index.html'in satır içi betiği yalnızca Bakanlık önizleme verisini (RAW) taşır.
const SAYFALAR=['ocr.html','ansiklopedi.html','index.html'];
const sayfaHtml={};SAYFALAR.forEach(f=>sayfaHtml[f]=fs.readFileSync(path.join(R,f),'utf8'));

// 2) Kullanılan anahtarlar: koddaki anahtar biçimli dizgeler + sayfalardaki data-i18n. Birleştirilerek kurulan anahtarlar ("kars.az_"+tür) DINAMIK listesinde.
const DINAMIK=['besin.tip.','ulke.durum.','ulke.ad.','profil.bki.','profil.bki.aralik.','kars.az_','kars.yukleniyor_','kars.baslik_','kars.sev.','kars.noun.','kars.uyum.','kars.uyum.cmr_','kars.uyum.ed_','kars.uyum.yutma_','kars.uyum.kapsul_','gida.uretim.say_','kayit.yuklenemedi_','foto.kamera_','gida.adi.','gida.uretim.say_','pay.kart.ust_','pay.neden.','pay.nedenk.','pay.metin.','tem.prof.','ornek.','koz.yukleniyor','tem.yukleniyor','gida.yukleniyor','besin.alan.','besin.duzey.','besin.sorun.','besin.esik_','besin.baslik_','besin.birim_',
  'manifest.','rozet.okur.','rozet.dedektif.','rozet.avci.','rozet.oncu.','rozet.dogrulayici.','rozet.tur.','ozet.ust.'];   // ozet.ust.<tür>: js/arayuz_sonuc.js ozetKart   // rozet.<aile>.*: aile kimliği data/rozetler.json'dan   // manifest.*: gen_manifest.py okur (uygulama adı ve açıklaması)
const NS=new Set(Object.keys(tr).map(k=>k.split('.')[0]));
const kullanilan=new Set(),dinamikKullanim=new Set();
for(const [f,src] of Object.entries(kaynak)){
  for(const {s} of parcala(src).str){
    if(ANAHTAR.test(s)&&NS.has(s.split('.')[0])&&!DINAMIK.includes(s)&&!/\.html$/.test(s))kullanilan.add(s);   // "ocr.html" bağlantıdır, anahtar değil
    const m=/^([a-z]+\.[a-z0-9_.]*)$/.exec(s);if(m&&DINAMIK.some(p=>s===p||s.startsWith(p)))dinamikKullanim.add(s);
  }
}
// Ülke katmanının (B-05) arayüz özellikleri çeviri anahtarı taşıyabilir (data/ulke.json u.<ülke>.oz): kullanılmış sayılır, tanımlı olmalı
for(const u of Object.values(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','ulke.json'),'utf8')).u))
  for(const v of Object.values(u.oz||{}))if(typeof v==='string'&&ANAHTAR.test(v)&&NS.has(v.split('.')[0])){kullanilan.add(v);ok(v in tr,'data/ulke.json özelliğindeki anahtar tr.json\'da yok: '+v)}
for(const html of Object.values(sayfaHtml)){
  for(const m of html.matchAll(/data-i18n="([^"]+)"/g))kullanilan.add(m[1]);
  for(const m of html.matchAll(/data-i18n-attr="([^"]+)"/g))m[1].split(';').forEach(p=>kullanilan.add(p.split(':')[1].trim()));
}
for(const k of kullanilan)ok(k in tr,'kodda kullanılan anahtar tr.json\'da yok: '+k);
for(const p of DINAMIK)ok(Object.keys(tr).some(k=>k.startsWith(p)),'dinamik önek için anahtar yok: '+p);
const kullanilmayan=Object.keys(tr).filter(k=>!kullanilan.has(k)&&!DINAMIK.some(p=>k.startsWith(p)));
ok(!kullanilmayan.length,'tr.json\'da kullanılmayan anahtar ('+kullanilmayan.length+'): '+kullanilmayan.join(', '));

// 3) Taşınmamış Türkçe metin: arayüz ve saf mantık dosyalarındaki dizgeler. İstisnalar: etiket okuma sözlükleri ve veri değerleri (arayüz metni değil).
const TR=/[ğüşıöçĞÜŞİÖÇ]/;
const ISTISNA={
  'js/gida.js':['ilave edilmemiştir','domuz kaynaklı madde içermez',' içermez','tatlandırıcı','Tatlandırıcı','alkolü'],   // olumsuzluk ve tatlandırıcı eşleştirmesi: etiket dilindeki sözcükler / veri kategorisi
  'js/kozmetik.js':['ingrédients'],   // etiket başlığı sözcükleri (düzenli ifade dışındaki dizge)
  'js/arayuz_temizlik.js':['Saç boyası','Saç bakımı','Cilt bakımı','Ağız bakımı','Tırnak bakımı','Bronzlaştırıcı','Kepek önleyici'],   // TFUNC_SKIP: kozmetik_inci.json işlev değerleri
  'js/paylas_ayar.js':['Umi'],   // uygulamanın adı (marka; çevrilmez)
  'js/dil.js':['Türkçe'],   // diller.json yüklenemezse yedek: dilin kendi adı
};
for(const [f,src] of Object.entries(kaynak)){
  if(f==='js/ansiklopedi.js')continue;   // ansValidate: veri doğrulama hata iletileri (üreteç ve test için; kullanıcıya görünmez)
  const ist=ISTISNA[f]||[];
  for(const {s} of parcala(src).str){
    if(!TR.test(s)||s.length<=2)continue;   // tek harf eşlemeleri (ç->c) metin değil
    if(ist.some(x=>s===x||s.indexOf(x)===0&&x.length>12))continue;
    if(/^[a-zçğıöşü ]+$/.test(s)&&s.split(' ').length>8)continue;   // uzun sözcük listeleri (GENERIC, CMP_SADE): tanıma sözlüğü
    ok(false,f+': anahtara taşınmamış Türkçe metin: "'+s.slice(0,80)+'"');
  }
}
// Sayfalar: görünen metin ve erişilebilirlik öznitelikleri data-i18n ile işaretli olmalı; 4) HTML'deki Türkçe metin tr.json ile aynı
for(const [ad,html] of Object.entries(sayfaHtml)){
  const govde=html.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<!--[\s\S]*?-->/g,'');
  for(const m of govde.matchAll(/<([a-z0-9]+)([^>]*)>([^<]*)/g)){
    const [_,tag,attr,txt]=m;
    if(txt.trim()&&/[A-Za-zğüşıöçĞÜŞİÖÇ]{2}/.test(txt)&&!/data-i18n="/.test(attr))ok(false,ad+': data-i18n yok: <'+tag+'> '+txt.trim().slice(0,60));
    for(const a of ['placeholder','aria-label','alt','title']){const v=new RegExp('\\b'+a+'="([^"]*)"').exec(attr);if(v&&/[A-Za-z]{2}/.test(v[1]))ok(new RegExp('data-i18n-attr="[^"]*'+a+':').test(attr),ad+': '+a+' çevrilmiyor: '+v[1])}
  }
  for(const m of html.matchAll(/data-i18n="([^"]+)"[^>]*>([^<]*)</g))ok(tr[m[1]]===m[2],ad+' metni tr.json ile farklı: '+m[1]+' ("'+m[2].slice(0,40)+'" / "'+String(tr[m[1]]).slice(0,40)+'")');
  for(const m of html.matchAll(/<[^>]*data-i18n-attr="([^"]+)"[^>]*>/g))m[1].split(';').forEach(p=>{const [a,k]=p.split(':').map(x=>x.trim()),v=new RegExp('\\b'+a+'="([^"]*)"').exec(m[0]);ok(v&&tr[k]===v[1],ad+' '+a+' tr.json ile farklı: '+k)});
}
// 5) t() gölgeleme: yerel "t" bildirimi ya da parametresi yok
for(const [f,src] of Object.entries(kaynak)){
  if(f==='js/ceviri.js')continue;
  const code=parcala(src).code;
  const m=code.match(/(?:\b(?:var|let|const)\s+(?:[\w$]+\s*=[^;]*?,\s*)*t\s*[=,;)]|function\s*[\w$]*\s*\(([^)]*?,\s*)?t\s*[,)]|\bfunction\s+t\s*\(|[,(]\s*t\s*=>)/);
  ok(!m,f+': t() yerel "t" ile gölgeleniyor: '+(m&&m[0]));
}

// 6) Çalışma: Türkçe biçimler eski görünümle aynı
global.C=require('../js/ceviri.js');
C.dilKur('tr',{tr:Object.assign({},tr,{'test.cogul':{one:'{n} madde',other:'{n} maddeler'}})},bilgi);
ok(C.t('kars.sadece',{ad:'Süt'})==='Sadece Süt','yer tutucu: '+C.t('kars.sadece',{ad:'Süt'}));
ok(C.t('yok.boyle.anahtar')==='yok.boyle.anahtar','tanımsız anahtar kendisini döndürür');
ok(C.t('test.cogul',{n:1})==='1 madde'&&C.t('test.cogul',{n:3})==='3 maddeler','çoğul (Türkçede tek biçim "other")');
ok(C.dilSayi(62.5)==='62,5'&&C.dilSayi(1234.567)==='1234,57'&&C.dilSayi(3)==='3','sayı: virgül, binlik ayırıcı yok');
ok(C.dilSayi(2,1,true)==='2,0','sabit ondalık');
const t0=new Date(2026,9,5,9,5).getTime();
ok(C.dilTarih(t0,'gun')==='5 Ekim 2026'&&C.dilTarih(t0,'gunsaat')==='5 Ekim 09:05'&&C.dilTarih(t0,'ayyil')==='Ekim 2026','tarih: '+[C.dilTarih(t0,'gun'),C.dilTarih(t0,'gunsaat'),C.dilTarih(t0,'ayyil')].join(' | '));
ok(C.veriMetin('Türkçe not','x.y').s==='Türkçe not'&&!C.veriMetin('Türkçe not','x.y').cevrilmedi,'veri metni: Türkçede olduğu gibi');
// Eksik çeviride sıra: seçili dil → İngilizce → Türkçe
C.dilKur('de',{tr:{'a.b':'tr','a.c':'tr','a.d':'tr'},en:{'a.b':'en','a.c':'en'},de:{'a.b':'de'}},{tr:{ad:'Türkçe',yon:'ltr'},de:{ad:'Deutsch',yon:'ltr'}});
ok(C.t('a.b')==='de'&&C.t('a.c')==='en'&&C.t('a.d')==='tr','geri düşme sırası: seçili → en → tr');
C.dilKur('ar',{tr:{},ar:{}},{ar:{ad:'العربية',yon:'rtl',yazi:{govde:'"Noto Sans Arabic",sans-serif'}}});
ok(C.DIL.yon==='rtl'&&C.DIL.yazi&&/Noto/.test(C.DIL.yazi.govde),'sağdan sola dil ve yazı tipi bilgisi');
const r=C.veriMetin('Türkçe not','x.y');ok(r.cevrilmedi&&r.s==='Türkçe not','veri çevirisi yoksa Türkçe + çevrilmedi işareti');
ok(C.veriMetin('Türkçe','x.y',{ar:'رسمي'}).s==='رسمي','veride resmi metin (ör. CLP) varsa o');
ok(C.ulkeSec(null,'tr')==='TR'&&C.ulkeSec(null,'en')===''&&C.ulkeSec('','tr')===''&&C.ulkeSec('TR','en')==='TR'&&C.ulkeSec('XX','tr')==='TR'&&C.ulkeSec('US','tr')==='US','ülke seçimi: kayıtlı > Türkçe → Türkiye > seçilmedi');
ok(C.dilSec(null,['de-DE','tr-TR'],['tr','en'])==='tr'&&C.dilSec(null,['en-US'],['tr','en'])==='en'&&C.dilSec(null,['de'],['tr','en'])==='en'&&C.dilSec('tr',['en'],['tr','en'])==='tr','dil seçimi: kayıtlı > tarayıcı > İngilizce');
// 7) Her dilde paylaşım kartı: sayı kutusu etiketleri kutuya, metinler karta sığar (test/paylas.js'teki sahte ölçüm: karakter başına 0,55 px)
for(const kod of Object.keys(bilgi)){
  const sozluk={tr};for(const k of new Set(['en',kod]))if(fs.existsSync(path.join(I,k+'.json')))sozluk[k]=oku(path.join(I,k+'.json'));
  const P=require('./yukle.js');P.dilKur(kod,sozluk,bilgi,{});
  const L=P.PAYLAS_AYAR.yerlesim.hikaye,c=(()=>{const T=[];let px=30;return {texts:T,set font(f){px=+(/(\d+)px/.exec(f)||[0,30])[1]},measureText:s=>({width:String(s).length*px*0.55}),
    fillText:(s,X,Y)=>T.push({s,x:X,y:Y,w:String(s).length*px*0.55}),fillRect(){},beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},closePath(){},fill(){},stroke(){},arc(){},save(){},restore(){},translate(){},scale(){},clip(){},drawImage(){},set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set lineCap(v){},set lineJoin(v){},set textAlign(v){},set textBaseline(v){},set direction(v){}}})();
  const M=P.payModel({mode:'gida',items:[{name:'A',lvl:0},{name:'B',lvl:1,why:'x'},{name:'C',lvl:2,why:'y'}],facts:[],allergens:''},{name:'Ürün'},P.PAYLAS_AYAR,L);
  P.payDraw(c,M,L,P.PAYLAS_AYAR,null);
  const CW=L.w-2*L.pad,bw=(CW-40)/3;
  ['pay.kart.kutu_yok','pay.kart.kutu_dikkat','pay.kart.kutu_uyari'].forEach((k,i)=>{const s=(sozluk[kod][k]||(sozluk.en||{})[k]||tr[k]),sag=L.pad+i*(bw+20)+bw-12,e=c.texts.filter(x=>s.indexOf(x.s.replace(/…$/,''))===0&&x.x>=L.pad+i*(bw+20)&&x.x<sag);ok(e.length&&e.every(x=>x.x+x.w<=sag),kod+': sayı kutusu etiketi taşıyor: '+s)});
}
console.log(n+' çeviri denetimi ('+Object.keys(tr).length+' anahtar, '+Object.keys(bilgi).length+' dil), '+fail+' hata');process.exit(fail?1:0);
