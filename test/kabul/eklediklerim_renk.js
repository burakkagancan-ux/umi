// Kabul testi: Eklediklerim her zaman görünsün + kazanımlar; Aylık Özetim kahve; zemin bir tık gri, kartlar beyaz.
// Kullanıcının isteği (değiştirmeden):
//  "Eklediklerim kısmı hiç ekleme yoksa profilde gözükmüyor. Gözüksün ama açılınca ürün eklemediniz gibi bir şey yazsın.
//   İlerleyen zamanda ürün eklediğinde hem kullanıcı hem bizim için kazanımlarını yazalım."
//  "Aylık özetin profildeki rengini değiştirelim" (kullanıcı kahveyi seçti).
//  "Arka fon ve kartların rengi; beyaz kontürü biraz belirgin yapsak ya da rengini bir tık koyu yapsak … göz yormayacak
//   şekilde" (kullanıcı 'zemin bir tık gri, kartlar beyaz, çizgiler belirgin' seçeneğini seçti).
//
// Kabul ölçütleri (Etiket Oku ocr.html, Profilim; Türkçe ve İngilizce):
//  1. Hiç ürün eklenmemişken (temiz depo) Profilim'de "Eklediklerim" düğmesi görünür; altyazısı "Henüz ürün eklemediniz"
//     (EN "You haven't added any products yet").
//  2. Düğmeye basınca Eklediklerim ekranı: "Henüz ürün eklemediniz." + nasıl eklenir cümlesi; "Ürün Eklediğinizde"
//     başlığı ve "Siz: …" / "Herkes: …" satırları (tam metinler aşağıda). Geri düğmesi Profilim'e döner.
//  3. Ürün eklemiş kullanıcı: POST …/katki {kim} yanıtı iki ürün (1 doğrulanmış ve Öncü, 1 bekleyen). Mevcut özetin
//     ("2 ürün eklediniz, 1 tanesi doğrulandı.") altında "Kazanımlarınız" başlığı, "Siz: …" ve "Herkes: …" satırları.
//     Öncü 0 ise "Siz" satırında Öncü yarısı yok; doğrulanmış 0 ise "Siz: ürünleriniz doğrulanınca rozetlerinize sayılacak."
//  4. Renkler: açık temada sayfa zemini #F3F5F3, sonuç kartı ve Profilim kutusu #FFFFFF; koyu temada zemin #0B0E0D, kart
//     #1A1F1C. Profilim'de "Aylık Özetim" başlık yazısı açıkta #6B4A2E zemini #F2EBE3, koyuda yazı #D8B48F zemin #2A2018;
//     Eklediklerim düğmesinin renginden farklı. Koyu tema Profilim > Görünüm seçiminden.
//  5. Değişmez: bu ekranlarda "güvenli/uygun" (EN safe/suitable) geçmez.
//
// Kullanıcı yolu (uygulamada gözlendi, 22.10.2026): Profilim = ocr.html#profil; kısayollar düğmedir (ad: başlık + altyazı).
// Katkıcı kimliği gerçek ekleme akışıyla oluşur: Etiket Oku > "Barkod okut" > "Barkod numarası" 8691234567890 > "Ara"
// (Worker'a giden ürün aramaları kapalı → "bulunamadı") > "Galeriden ya da dosyadan fotoğraf yükle" (dosya seçici, beyaz
// PNG) > Worker OCR taklidi metni döndürür > "Bu ürünün içeriğini … kaydedelim mi?" > "Kaydet" (POST …/urun taklidi
// {ok:true}). Gönderilen "kim", sonra POST …/katki gövdesindeki kimlikle aynı olmalıdır.
// Renkler ekran görüntüsünden piksel okunarak ölçülür (evaluate yok): zemin, kenar boşluğundaki piksel; kart, yazının
// solundaki iç boşluk; düğme zemini, düğmenin sağ iç kenarı; başlık yazısı, yazı kutusunda zeminden en uzak piksel.
const zlib=require('zlib');
const {ac,gorunur}=require('./_ortak.js');

const DIL={
  tr:{
    ekle:/Eklediklerim/,ekleBaslik:'Eklediklerim',altBos:'Henüz ürün eklemediniz',
    bos:'Henüz ürün eklemediniz.',
    nasil:'Veritabanında bulunmayan bir barkodu okutup içindekiler bölümünün fotoğrafını çektiğinizde ürünü eklemeniz önerilir.',
    ekleyince:'Ürün Eklediğinizde',
    siz:'Siz: ürün doğrulanınca rozetlerinize sayılır; bir barkodu ilk ekleyen sizseniz Öncü rozetini kazanırsınız.',
    herkes:'Herkes: ürün, aynı barkodu okutan herkese içeriğiyle açılır; doğrulanınca Topluluk\'un ortak hedefine sayılır.',
    geri:/←\s*Profilim|Geri/,profil:'Profilim',aylik:/Aylık Özetim/,
    ozet:'2 ürün eklediniz, 1 tanesi doğrulandı.',kazanim:'Kazanımlarınız',
    sizDog:/Siz: 1 ürününüz doğrulandı ve rozetlerinize sayıldı/,sizOncu:/1 üründe Öncü oldunuz/,
    sizOncuYok:'Siz: 1 ürününüz doğrulandı ve rozetlerinize sayıldı.',
    herkesKaz:/Herkes: eklediğiniz 2 ürün, aynı barkodu okutan herkese içeriğiyle açılıyor; doğrulanan 1 ürün Topluluk'un ortak hedefine sayıldı/,
    sizSifir:'Siz: ürünleriniz doğrulanınca rozetlerinize sayılacak.',
    yasak:/güvenli|uygun/i},
  en:{
    ekle:/Products I Added/,ekleBaslik:'Products I Added',altBos:'You haven\'t added any products yet',
    bos:'You haven\'t added any products yet.',
    nasil:'When you scan a barcode that is not in the database and photograph its ingredients list, you are offered to add the product.',
    ekleyince:'When You Add a Product',
    siz:'You: once verified, the product counts toward your badges; if you are the first to add a barcode, you earn the Pioneer badge.',
    herkes:'Everyone: the product opens with its ingredients for anyone who scans the same barcode; once verified, it counts toward the Community goal.',
    geri:/←\s*My profile|Back/,profil:'My Profile',aylik:/My Monthly Summary/,
    kazanim:'What You\'ve Achieved',
    sizDog:/You: 1 of your products is verified and counted toward your badges/,sizOncu:/you are the Pioneer on 1 product/,
    herkesKaz:/Everyone: the 2 products you added open with their ingredients for anyone who scans the same barcode/,
    herkesKaz2:/1 verified product counted toward the Community goal/,
    sizSifir:'You: your products will count toward your badges once verified.',
    yasak:/\bsafe\b|suitable/i},
};

const KOD='8691234567890';
const IKI=[{kod:'8690000000001',tur:'gida',t:Date.now()-86400000,dogrulandi:true,oncu:true,dogrulayici:false,ozet:'Buğday unu, şeker'},
  {kod:'8690000000002',tur:'koz',t:Date.now()-3600000,dogrulandi:false,oncu:false,dogrulayici:false,ozet:'Aqua, glycerin'}];
const ONCUSUZ=[{...IKI[0],oncu:false},IKI[1]];
const SIFIR=[{...IKI[0],dogrulandi:false,oncu:false},IKI[1]];
const H={'access-control-allow-origin':'*'};
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:H,body:JSON.stringify(o)});

// --- PNG (ekran görüntüsü) çözücü: 8 bit RGB/RGBA, taramasız ---
function pngCoz(buf){
  let o=8,w=0,h=0,tip=0;const idat=[];
  while(o<buf.length){
    const n=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),d=buf.subarray(o+8,o+8+n);
    if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);tip=d[9]}
    else if(t==='IDAT')idat.push(d);
    o+=12+n;
  }
  const bpp=tip===6?4:3,ham=zlib.inflateSync(Buffer.concat(idat)),st=w*bpp,px=Buffer.alloc(st*h);
  for(let y=0;y<h;y++){
    const f=ham[y*(st+1)],s=ham.subarray(y*(st+1)+1,(y+1)*(st+1));
    for(let x=0;x<st;x++){
      const a=x>=bpp?px[y*st+x-bpp]:0,b=y?px[(y-1)*st+x]:0,c=x>=bpp&&y?px[(y-1)*st+x-bpp]:0;
      let v=s[x];
      if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;
      else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c}
      px[y*st+x]=v&255;
    }
  }
  return {w,h,at:(x,y)=>{x=Math.round(x);y=Math.round(y);const i=y*st+x*bpp;return [px[i],px[i+1],px[i+2]]}};
}
const hex=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
const fark=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
const yaz=c=>'rgb('+c.join(',')+')';
async function goruntu(p){return pngCoz(await p.screenshot())}
// Yazı kutusunda zeminden en uzak piksel (yazının kendi rengi)
function yaziRengi(img,kutu,zemin){
  let en=null,d=-1;
  for(let y=Math.ceil(kutu.y);y<kutu.y+kutu.height-0.5;y++)for(let x=Math.ceil(kutu.x);x<kutu.x+kutu.width-0.5;x++){
    const c=img.at(x,y),f=fark(c,zemin);if(f>d){d=f;en=c}
  }
  return en||[0,0,0];
}

// Sayfayı açar, Worker'ı taklit eder: OCR (image), ürün kaydı (POST /urun), katkı listesi (POST /katki)
async function sayfa(ctx,adres,durum){
  const r=await ac(ctx,adres);
  r.katki=[];r.urun=[];
  await r.p.route(/inapp-ocr-[^/]*\.workers\.dev/,q=>{
    const rq=q.request();let g=null;
    if(rq.method()==='POST'){try{g=JSON.parse(rq.postData()||'')}catch(e){}}
    const u=rq.url().split('?')[0];
    if(g&&typeof g.image==='string')return json(q,{text:'İçindekiler: buğday unu, şeker, su.'});
    if(rq.method()==='POST'&&/\/urun$/.test(u)){r.urun.push(g);return json(q,{ok:true})}
    if(rq.method()==='POST'&&/\/katki$/.test(u)){r.katki.push(g);return json(q,{urunler:(durum&&durum.urunler)||[]})}
    return q.abort();
  });
  return r;
}
// Beyaz PNG (yalnızca dosya girdisi; okunan metni Worker taklidi verir)
function png(w,h){
  const T=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;T[n]=c>>>0}
  const crc=b=>{let c=0xffffffff;for(const x of b)c=T[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0};
  const parca=(tur,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(tur),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=0;
  const ham=Buffer.alloc((w+1)*h,255);for(let y=0;y<h;y++)ham[y*(w+1)]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),parca('IHDR',ih),parca('IDAT',zlib.deflateSync(ham)),parca('IEND',Buffer.alloc(0))]);
}

// Gerçek ekleme akışı (Türkçe arayüz). Döner: gönderilen katkıcı kimliği ya da null
async function urunEkle(ctx,B,ok){
  const {p,urun,errs}=await sayfa(ctx,B+'ocr.html');
  await p.getByRole('button',{name:'Barkod okut'}).click();
  const kutu=p.getByLabel('Barkod numarası');
  ok(await gorunur(kutu,3000),'ekleme akışı: "Barkod numarası" kutusu görünmüyor');
  await kutu.first().fill(KOD);
  await p.getByRole('button',{name:'Ara',exact:true}).click();
  const yukle=p.getByText('Galeriden ya da dosyadan fotoğraf yükle');
  ok(await gorunur(yukle,8000),'ekleme akışı: bulunamayan barkodda "Galeriden ya da dosyadan fotoğraf yükle" görünmüyor');
  const [fc]=await Promise.all([p.waitForEvent('filechooser'),yukle.first().click()]);
  await fc.setFiles({name:'etiket.png',mimeType:'image/png',buffer:png(600,400)});
  ok(await gorunur(p.getByText('Bu ürünün içeriğini başka kullanıcılar için kaydedelim mi?'),8000),'ekleme akışı: kaydetme sorusu çıkmadı');
  await p.getByRole('button',{name:'Kaydet',exact:true}).last().click();
  for(let k=0;k<20&&!urun.length;k++)await p.waitForTimeout(200);
  ok(urun.length===1,'ekleme akışı: Worker\'a ürün kaydı (POST /urun) gitmedi');
  ok(errs.length===0,'ekleme akışı: sayfa hatası: '+errs.join(' | '));
  await p.close();
  return urun.length&&urun[0]?urun[0].kim:null;
}

// Eklediklerim ekranının görünen metni (başlıktan alt menüye kadar)
async function ekranMetni(p,d){
  const t=await p.locator('body').innerText();
  const i=t.lastIndexOf(d.ekleBaslik);
  if(i<0)return '';
  const s=t.slice(i),j=s.search(/\n(Ansiklopedi|Encyclopedia)\n/);
  return j<0?s:s.slice(0,j);
}
// Profilim'i açar, Eklediklerim düğmesini bulur
async function profil(ctx,B,durum){
  const r=await sayfa(ctx,B+'ocr.html#profil',durum);
  await r.p.waitForTimeout(800);
  return r;
}
async function ekleAc(r,d){
  const dg=r.p.getByRole('button',{name:d.ekle});
  r.dugme=await gorunur(dg,5000);
  r.alt=r.dugme?await dg.first().innerText():'';
  if(r.dugme){await dg.first().click();await r.p.waitForTimeout(1200)}
  r.metin=await ekranMetni(r.p,d);
  return r;
}
async function dilSec(ctx,B,dil,ok){
  const {p}=await ac(ctx,B+'ocr.html#profil');
  const s=p.getByLabel(/Dil · Language/);
  ok(await gorunur(s,5000),'"Dil · Language" seçimi görünmüyor');
  await s.first().selectOption({label:dil});
  await p.waitForTimeout(1500);
  await p.close();
}

// Geri → Profilim (ekranda görünen bir metin, Geri sonrasında görünmemeli)
async function geriDenetle(r,d,e,ekranda,ok){
  const geri=r.p.getByRole('button',{name:d.geri});
  ok(await gorunur(geri,2000),e+': Eklediklerim ekranında Geri düğmesi yok');
  if(!await geri.count())return;
  await geri.first().click();
  await r.p.waitForTimeout(800);
  ok(await gorunur(r.p.getByRole('heading',{name:d.profil,exact:true}),3000)&&await gorunur(r.p.getByRole('button',{name:d.aylik}),2000),
    e+': Geri Profilim\'e dönmedi');
  ok(!await gorunur(r.p.getByText(ekranda,{exact:true}),500),e+': Geri sonrasında Eklediklerim ekranı hâlâ açık ("'+ekranda+'" görünüyor)');
}

// Ölçüt 1 ve 2: boş durum (dil d)
async function bosDenetle(ctx,B,d,e,ok){
  const r=await ekleAc(await profil(ctx,B),d);
  ok(r.dugme,e+': hiç ürün eklenmemişken Profilim\'de "'+d.ekleBaslik+'" düğmesi görünmüyor');
  ok(r.alt.includes(d.altBos),e+': düğme altyazısı "'+d.altBos+'" değil: "'+r.alt.replace(/\n/g,' ⏎ ')+'"');
  const m=r.metin;
  ok(r.dugme&&m.length>0,e+': düğmeye basınca "'+d.ekleBaslik+'" ekranı açılmadı');
  ok(m.includes(d.bos),e+': boş ekranda "'+d.bos+'" yazmıyor');
  ok(m.includes(d.nasil),e+': boş ekranda nasıl ekleneceği ("'+d.nasil.slice(0,40)+'…") yazmıyor');
  ok(await gorunur(r.p.getByText(d.ekleyince,{exact:true}),2000),e+': boş ekranda "'+d.ekleyince+'" başlığı yok');
  ok(m.includes(d.siz),e+': boş ekranda "Siz" satırı ("'+d.siz.slice(0,40)+'…") yok');
  ok(m.includes(d.herkes),e+': boş ekranda "Herkes" satırı ("'+d.herkes.slice(0,40)+'…") yok');
  const iY=m.indexOf(d.ekleyince),iS=m.indexOf(d.siz),iH=m.indexOf(d.herkes),iB=m.indexOf(d.bos);
  ok(iB>=0&&iY>iB&&iS>iY&&iH>iY,e+': "'+d.ekleyince+'" başlığı boş metnin altında ve Siz/Herkes satırlarının üstünde değil');
  ok(!d.yasak.test(m)&&!d.yasak.test(r.alt),e+': Eklediklerim ekranında/düğmesinde "güvenli/uygun" geçiyor');
  await geriDenetle(r,d,e,d.bos,ok);
  ok(r.errs.length===0,e+': sayfa hatası: '+r.errs.join(' | '));
  await r.p.close();
}

module.exports=async({br,B,opt,ok})=>{
  const T=DIL.tr,E=DIL.en;
  await Promise.all([
    // --- Türkçe: boş durum, sonra gerçek ekleme ve kazanımlar ---
    (async()=>{
      const ctx=await br.newContext(opt);
      try{
        await bosDenetle(ctx,B,T,'TR boş',ok);
        const kim=await urunEkle(ctx,B,ok);
        ok(!!kim,'ekleme akışı: ürün kaydında katkıcı kimliği ("kim") yok');
        // İki ürün: 1 doğrulanmış + Öncü, 1 bekleyen
        {
          const r=await ekleAc(await profil(ctx,B,{urunler:IKI}),T);
          ok(r.katki.length>0,'TR: Eklediklerim açılırken Worker\'a POST /katki gitmedi');
          ok(r.katki.length>0&&r.katki.every(g=>g&&g.kim===kim),'TR: POST /katki gövdesindeki kimlik eklemedeki kimlikle aynı değil: '+JSON.stringify(r.katki));
          ok(r.dugme,'TR: ürün eklemiş kullanıcıda "Eklediklerim" düğmesi yok');
          const m=r.metin;
          ok(m.includes(T.ozet),'TR: "'+T.ozet+'" özeti yok');
          ok(await gorunur(r.p.getByText(T.kazanim,{exact:true}),2000),'TR: "'+T.kazanim+'" başlığı yok');
          ok(T.sizDog.test(m),'TR: "Siz: 1 ürününüz doğrulandı ve rozetlerinize sayıldı" yok');
          ok(T.sizOncu.test(m),'TR: "1 üründe Öncü oldunuz" yok');
          ok(T.herkesKaz.test(m),'TR: "Herkes: eklediğiniz 2 ürün, … doğrulanan 1 ürün Topluluk\'un ortak hedefine sayıldı" yok');
          const iO=m.indexOf(T.ozet),iK=m.indexOf(T.kazanim),iS=m.search(T.sizDog),iH=m.search(T.herkesKaz);
          ok(iO>=0&&iK>iO&&iS>iK&&iH>iK,'TR: "'+T.kazanim+'" özetin altında ve Siz/Herkes satırlarının üstünde değil');
          ok(!m.includes(T.bos),'TR: ürün eklemiş kullanıcıda "'+T.bos+'" yazıyor');
          ok(!r.alt.includes(T.altBos),'TR: ürün eklemiş kullanıcıda düğme altyazısı hâlâ "'+T.altBos+'"');
          ok(!T.yasak.test(m),'TR: kazanımlar ekranında "güvenli/uygun" geçiyor');
          await geriDenetle(r,T,'TR kazanımlar',T.ozet,ok);
          ok(r.errs.length===0,'TR kazanımlar: sayfa hatası: '+r.errs.join(' | '));
          await r.p.close();
        }
        // Öncü 0
        {
          const r=await ekleAc(await profil(ctx,B,{urunler:ONCUSUZ}),T);
          ok(r.metin.includes(T.sizOncuYok),'TR Öncü 0: "'+T.sizOncuYok+'" yok');
          ok(!/Öncü oldunuz/.test(r.metin),'TR Öncü 0: "Öncü oldunuz" yarısı yazılıyor');
          await r.p.close();
        }
        // Doğrulanmış 0
        {
          const r=await ekleAc(await profil(ctx,B,{urunler:SIFIR}),T);
          ok(r.metin.includes(T.sizSifir),'TR doğrulanmış 0: "'+T.sizSifir+'" yok');
          ok(!/ürününüz doğrulandı/.test(r.metin),'TR doğrulanmış 0: "… ürününüz doğrulandı" yazılıyor');
          await r.p.close();
        }
      }finally{await ctx.close()}
    })(),

    // --- İngilizce: boş durum ---
    (async()=>{
      const ctx=await br.newContext(opt);
      try{
        await dilSec(ctx,B,'English',ok);
        await bosDenetle(ctx,B,E,'EN boş',ok);
      }finally{await ctx.close()}
    })(),

    // --- İngilizce: ürün eklemiş kullanıcı (ekleme Türkçe arayüzde, sonra dil İngilizce) ---
    (async()=>{
      const ctx=await br.newContext(opt);
      try{
        const kim=await urunEkle(ctx,B,ok);
        await dilSec(ctx,B,'English',ok);
        {
          const r=await ekleAc(await profil(ctx,B,{urunler:IKI}),E);
          ok(r.katki.length>0&&r.katki.every(g=>g&&g.kim===kim),'EN: POST /katki eklemedeki kimlikle gitmedi');
          const m=r.metin;
          ok(await gorunur(r.p.getByText(E.kazanim,{exact:true}),3000),'EN: "'+E.kazanim+'" başlığı yok');
          ok(E.sizDog.test(m),'EN: "You: 1 of your products is verified and counted toward your badges" yok');
          ok(E.sizOncu.test(m),'EN: "you are the Pioneer on 1 product" yok');
          ok(E.herkesKaz.test(m),'EN: "Everyone: the 2 products you added open with their ingredients …" yok');
          ok(E.herkesKaz2.test(m),'EN: "1 verified product counted toward the Community goal" yok');
          ok(!/Kazanımlarınız|Siz:|Herkes:/.test(m),'EN: kazanımlar ekranında Türkçe metin var');
          ok(!E.yasak.test(m),'EN: kazanımlar ekranında "safe/suitable" geçiyor');
          ok(r.errs.length===0,'EN kazanımlar: sayfa hatası: '+r.errs.join(' | '));
          await r.p.close();
        }
        {
          const r=await ekleAc(await profil(ctx,B,{urunler:SIFIR}),E);
          ok(r.metin.includes(E.sizSifir),'EN doğrulanmış 0: "'+E.sizSifir+'" yok');
          await r.p.close();
        }
      }finally{await ctx.close()}
    })(),

    // --- Renkler: açık ve koyu tema ---
    (async()=>{
      const ctx=await br.newContext(opt);
      try{
        for(const [tema,R] of [['Açık',{zemin:'#F3F5F3',kart:'#FFFFFF',yazi:'#6B4A2E',dz:'#F2EBE3'}],
                               ['Koyu',{zemin:'#0B0E0D',kart:'#1A1F1C',yazi:'#D8B48F',dz:'#2A2018'}]]){
          const e=tema+' tema';
          {
            const {p}=await ac(ctx,B+'ocr.html#profil');
            const g=p.getByLabel('Görünüm');
            ok(await gorunur(g,5000),e+': Profilim\'de "Görünüm" seçimi yok');
            await g.first().selectOption({label:tema});
            await p.waitForTimeout(800);
            await p.close();
          }
          // Profilim
          {
            const {p,errs}=await ac(ctx,B+'ocr.html#profil');
            await p.waitForTimeout(1000);
            const ay=p.getByRole('button',{name:/Aylık Özetim/}),ek=p.getByRole('button',{name:/Eklediklerim/});
            const al=p.getByText('Alerjenler',{exact:true});
            ok(await gorunur(ay,5000),e+': "Aylık Özetim" düğmesi yok');
            const img=await goruntu(p);
            const zem=[img.at(4,200),img.at(385,200),img.at(4,450)];
            ok(zem.every(c=>fark(c,hex(R.zemin))<=3),e+': Profilim sayfa zemini '+R.zemin+' değil: '+zem.map(yaz).join(' '));
            const ab=await al.first().boundingBox();
            // satır kutunun neredeyse tam genişliğinde: başlık yazısı ile sağdaki ok arasındaki boş yer (kutunun içi)
            if(ab){const c=img.at(ab.x+ab.width*0.6,ab.y+ab.height/2);ok(fark(c,hex(R.kart))<=3,e+': Profilim kutusu ("Sizin İçin Uyarılar" seçimleri) '+R.kart+' değil: '+yaz(c))}
            else ok(false,e+': "Alerjenler" kutusu bulunamadı');
            const bb=await ay.first().boundingBox();
            const tb=await ay.first().getByText('Aylık Özetim',{exact:true}).boundingBox();
            if(bb&&tb){
              const dz=img.at(bb.x+bb.width-8,bb.y+bb.height/2);
              ok(fark(dz,hex(R.dz))<=3,e+': "Aylık Özetim" düğme zemini '+R.dz+' (kahve) değil: '+yaz(dz));
              const yz=yaziRengi(img,tb,dz);
              ok(fark(yz,hex(R.yazi))<=12,e+': "Aylık Özetim" başlık yazısı '+R.yazi+' (kahve) değil: '+yaz(yz));
              const eb=await gorunur(ek,500)?await ek.first().boundingBox():null;
              if(eb){
                const ez=img.at(eb.x+eb.width-8,eb.y+eb.height/2);
                ok(fark(ez,dz)>10,e+': "Eklediklerim" düğmesi "Aylık Özetim" ile aynı renkte: '+yaz(ez));
                const et=await ek.first().getByText('Eklediklerim',{exact:true}).boundingBox();
                if(et)ok(fark(yaziRengi(img,et,ez),yz)>10,e+': "Eklediklerim" başlık yazısı "Aylık Özetim" ile aynı renkte');
              }else ok(false,e+': renk karşılaştırması için "Eklediklerim" düğmesi görünmüyor');
            }else ok(false,e+': "Aylık Özetim" düğmesinin yeri ölçülemedi');
            ok(errs.length===0,e+' Profilim: sayfa hatası: '+errs.join(' | '));
            await p.close();
          }
          // Etiket Oku: sayfa zemini ve sonuç kartı
          {
            const {p,errs}=await ac(ctx,B+'ocr.html');
            await p.getByText('Örnek metin dene',{exact:true}).click();
            const oz=p.getByText('Özet',{exact:true});
            ok(await gorunur(oz,8000),e+': örnek metinden sonuç ("Özet" kartı) gelmedi');
            await oz.first().scrollIntoViewIfNeeded();
            await p.waitForTimeout(600);
            const img=await goruntu(p);
            const ob=await oz.first().boundingBox();
            if(ob){
              const c=img.at(ob.x-8,ob.y+ob.height/2);
              ok(fark(c,hex(R.kart))<=3,e+': sonuç kartı ("Özet") '+R.kart+' değil: '+yaz(c));
              const z=img.at(4,ob.y+ob.height/2);
              ok(fark(z,hex(R.zemin))<=3,e+': Etiket Oku sayfa zemini (sonuç kartının yanı) '+R.zemin+' değil: '+yaz(z));
            }else ok(false,e+': sonuç kartının yeri ölçülemedi');
            ok(errs.length===0,e+' Etiket Oku: sayfa hatası: '+errs.join(' | '));
            await p.close();
          }
        }
      }finally{await ctx.close()}
    })(),
  ]);
};
