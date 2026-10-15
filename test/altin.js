// Altın çıktı testi: sabit derlemin (test/veri/altin_metinler.json) saf mantıktaki bütün çıktısı kayıtlı anlık görüntüyle birebir aynı mı.
// Amaç: yeniden yapılanmada (modül yapısı, ortak değerlendirme modeli) davranışın hiç değişmediğini kanıtlamak.
// Kapsam: üç türde analiz + özet + karşılaştırma ürünü (profilsiz, dolu profil, bebek profili), paylaşım kartı modeli, profil kartları (15.10.2026'dan beri)
// ve paylaşım kartının kişisel satırları; besin tablosu ayrıştırma; Türkçe ve İngilizce.
// Kullanım: node test/altin.js              → karşılaştırır (CI)
//           node test/altin.js --guncelle   → anlık görüntüyü yeniden yazar. Yalnızca davranış BİLEREK değiştiğinde; PR açıklamasında nedeni yazılır.
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const V=path.join(__dirname,'veri'),D=JSON.parse(fs.readFileSync(path.join(V,'altin_metinler.json'),'utf8'));
const oku=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',f),'utf8'));
const GORUNTU=path.join(V,'altin_cikti.json.gz');

// Anahtarları sıralı, işlevsiz, döngüsüz kararlı JSON (karşılaştırma için)
function kararli(x,yol){
  yol=yol||[];
  if(x===null||typeof x!=='object')return typeof x==='function'?undefined:(typeof x==='number'&&!isFinite(x)?String(x):x);
  if(yol.includes(x))return '[döngü]';
  const y=yol.concat([x]);
  if(x instanceof Map)return kararli(Object.fromEntries(x),yol);
  if(x instanceof Set)return [...x].map(v=>kararli(v,y));
  if(x instanceof RegExp)return String(x);
  if(Array.isArray(x))return x.map(v=>{const k=kararli(v,y);return k===undefined?null:k});
  const o={};for(const k of Object.keys(x).sort()){const v=kararli(x[k],y);if(v!==undefined)o[k]=v}
  return o;
}

// İngilizce turda dilden bağımsız ham eşleşmeler (res, A) Türkçeyle aynı olduğu için yalnızca Türkçede saklanır; metin anahtarda zaten var
function urunAyikla(P,dil){const o=Object.assign({},P);delete o.text;if(dil!=='tr'){delete o.res;delete o.A}return o}
function calistir(dil){
  const L=require('./yukle.js');L.dilYukle(dil);
  const idx=L.buildIndex(oku('e_kodlari.json'),oku('bilesenler.json'));
  const K=L.buildKIndex(oku('kozmetik.json'),oku('kozmetik_inci.json'));
  const T=L.buildTIndex(oku('temizlik.json'),K);
  const al=((idx.bmeta&&idx.bmeta.allergens)||[]).map(a=>a[0]);
  const dolu={al:al,alOzel:['kivi','susam','lanolin'],lactose:true,koku:true,astim:true,preg:true,emziriyorum:true,baby:false,child:false,vegan:true,veg:true,pku:true,pet:true,salt:true};
  const bebek=Object.assign({},dolu,{preg:false,emziriyorum:false,baby:true});
  const out={gida:{},koz:{},tem:{},besin:{}};
  for(const m of D.gida){
    const P=L.cmpProduct(m,idx,dolu,'');
    const al=f=>L.cmpAlName(idx,f);
    out.gida[m]=kararli({urun:urunAyikla(P,dil),bebek:L.cmpMisfit(P.S,bebek,idx).concat(L.cmpMisfitOzel(m,bebek)),pay:L.payModel(L.payFromFood(m,idx)),
      kart:L.profilKartGida(P.S,m,dolu,al),kartBebek:L.profilKartGida(P.S,m,bebek,al)});
  }
  for(const x of D.koz){
    const m=typeof x==='string'?x:x.m,o=typeof x==='string'?undefined:x.o,P=L.cmpProductK(m,K,dolu,'',o);
    const kb=L.profilKartKoz(P.S,P.res,m,bebek,'baby');
    out.koz[JSON.stringify(x)]=kararli({urun:urunAyikla(P,dil),bebek:L.cmpMisfitK(P.S,bebek),pay:L.payModel(L.payFromK(P.res,P.S,K)),
      kart:L.profilKartKoz(P.S,P.res,m,dolu,''),kartBebek:kb,kisisel:L.kisiselSatirlar(kb)});
  }
  for(const m of D.tem){
    const P=L.cmpProductT(m,T,K,dolu,'');
    const kb=L.profilKartTem(P.S,P.A,m,bebek,T);
    out.tem[m]=kararli({urun:urunAyikla(P,dil),bebek:L.cmpMisfitT(P.S,P.A,T,bebek),pay:L.payModel(L.payFromT(P.A,P.S)),
      kart:L.profilKartTem(P.S,P.A,m,dolu,T),kartBebek:kb,kisisel:L.kisiselSatirlar(kb)});
  }
  const BS=L.besinSozluk(oku('besin.json'));
  for(const e of JSON.parse(fs.readFileSync(path.join(V,'besin_etiketler.json'),'utf8')).etiketler){
    const r=L.besinAyristir(e.metin,BS);
    out.besin[e.id]=kararli({r:r,g:r?L.besinGorunum({b:r.b,lt:r.lt,birim:r.birim,sorun:r.sorun,por:r.por}):null});
  }
  return out;
}

// İlk farkın yolu ve iki değer
function ilkFark(a,b,yol){
  if(JSON.stringify(a)===JSON.stringify(b))return null;
  if(a&&b&&typeof a==='object'&&typeof b==='object'){
    for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const f=ilkFark(a[k],b[k],yol+'.'+k);if(f)return f}
  }
  const kisa=v=>{const s=JSON.stringify(v);return s===undefined?'(yok)':s.length>200?s.slice(0,200)+'…':s};
  return yol+'\n      önce: '+kisa(a)+'\n      şimdi: '+kisa(b);
}

const simdi={tr:calistir('tr'),en:calistir('en')};
if(process.argv.includes('--guncelle')){
  // Kaç durumun değiştiği yazılır (aylık veri güncellemesi PR'ında görünsün)
  let eski={},degisen=0;try{eski=JSON.parse(zlib.gunzipSync(fs.readFileSync(GORUNTU)))}catch(e){}
  for(const dil of Object.keys(simdi))for(const tur of Object.keys(simdi[dil]))for(const k of Object.keys(simdi[dil][tur]))
    if(JSON.stringify(((eski[dil]||{})[tur]||{})[k])!==JSON.stringify(simdi[dil][tur][k]))degisen++;
  if(degisen)fs.writeFileSync(GORUNTU,zlib.gzipSync(JSON.stringify(simdi),{level:9}));
  const n=Object.values(simdi.tr).reduce((s,x)=>s+Object.keys(x).length,0);
  console.log('Altın çıktı: '+n+' durum × 2 dil, '+degisen+' durum değişti'+(degisen?' → '+path.relative(process.cwd(),GORUNTU)+' yazıldı':' (dosya aynı kaldı)'));
  process.exit(0);
}
if(!fs.existsSync(GORUNTU)){console.log('HATA altın çıktı yok; node test/altin.js --guncelle');process.exit(1)}
const once=JSON.parse(zlib.gunzipSync(fs.readFileSync(GORUNTU)));
let n=0,fail=0;
for(const dil of Object.keys(simdi))for(const tur of Object.keys(simdi[dil])){
  const A=(once[dil]||{})[tur]||{},B=simdi[dil][tur];
  for(const k of new Set([...Object.keys(A),...Object.keys(B)])){
    n++;
    if(!(k in A)){fail++;console.log(`HATA [${dil}/${tur}] anlık görüntüde yok (yeni durum: --guncelle): ${k.slice(0,100)}`);continue}
    if(!(k in B)){fail++;console.log(`HATA [${dil}/${tur}] derlemden çıkmış: ${k.slice(0,100)}`);continue}
    const f=ilkFark(A[k],B[k],'');
    if(f){fail++;if(fail<=20)console.log(`HATA [${dil}/${tur}] ${k.slice(0,100)}\n   ${f}`)}
  }
}
if(fail>20)console.log(`… ve ${fail-20} fark daha`);
console.log(`${n} altın durum, ${fail} fark`);
if(fail){console.log('Davranış bilerek değiştiyse: node test/altin.js --guncelle (PR açıklamasında nedeniyle).');process.exit(1)}
