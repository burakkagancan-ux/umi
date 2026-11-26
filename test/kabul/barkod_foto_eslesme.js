// Kabul testi: barkod okutulduktan sonra çekilen içerik fotoğrafının barkodla eşleşmesi (kullanıcının isteği: "A ürününün
// barkodunu okuttum barkodu okudu ürünü buldu ama içeriğini bulamadı sonra B ürünün fotoğraf çek adımından içindekiler
// fotoğrafını çektim sanki A ürünün barkodu B ye aitmiş gibi kaydetme seçeneği sunduk. Burada A ürününün barkodunu
// okuttuktan sonra içerik listesini fotoğrafladan giderse çekilen içerik ile barkodu eşleştirsin ama ana fotoğraf çekten
// giderse refresh etsin.").
//
// İstenen davranış (yazanla kararlaştırılmış ölçütler 2-5):
//  2. Barkod okutulur; ürün bulunamaz ya da adı bulunur ama içeriği bulunamaz → "İçerik listesini fotoğrafla" kartı çıkar.
//     Fotoğraf BU KARTTAKİ düğmeyle (kamera ya da "Galeriden ya da dosyadan fotoğraf yükle") verilirse okunan içerik o
//     barkodla eşleşir: "Bu ürünün içeriğini başka kullanıcılar için kaydedelim mi?" önerisi o barkodla çıkar (bugünkü davranış).
//  3. Aynı durumda fotoğraf sayfanın ANA "Fotoğraf çek" ya da ana "Galeriden" düğmesiyle verilirse barkod unutulur: metin
//     barkodsuz yeni bir tarama gibi işlenir, o barkoda kaydetme önerisi çıkmaz, barkod kartı ekranda kalmaz.
//  4. 3'ten sonra sayfa yeniden yüklense de eski barkodun kartı ya da eşleşmesi geri gelmez (yeniden yüklemeden sonra ana
//     düğmeyle verilen bir fotoğraf da o barkoda bağlanmaz).
//  5. Kart düğmesine basılır, sayfa yeniden yüklenir (telefon kamerayı açarken sekmeyi yeniden yükler), fotoğraf kartın
//     düğmesiyle verilir → eşleşme yine olur (bugünkü davranış).
//
// Kullanıcı yolu: Etiket Oku > "Barkod okut" > (kamera testte açılmaz) "Barkod numarası" yazılır > "Ara". Worker
// (inapp-ocr-…workers.dev) dış servistir: ürün sorgusu (GET) kesilir, yani barkod veritabanında bulunmaz; OCR isteği
// (gövdesinde "image" olan POST) testin metniyle yanıtlanır. "Adı bulunur, içeriği yok" durumu uygulamanın kendi barkod
// verisindeki bir kayıtla (0000869379248, "Uludağ gazoz 2,5 lt efsane"; 02.11.2026'da tarayıcıda gözlendi) kurulur; kayıt
// veriden çıkarsa ön koşul denetimi düşer. Dosya seçimi filechooser ile; telefonun yeniden yüklemesi reload ile.
// Metinler i18n/tr.json'dan (barkod.*, foto.*).
const {ac,gorunur,yerlesince}=require('./_ortak.js');

const ean=b=>{let s=0;[...b].forEach((c,i)=>s+=+c*(i%2?3:1));return b+((10-s%10)%10)};
const YOK=ean('869999912345');        // veritabanında yok
const ADLI='0000869379248';            // adı var, içeriği yok
const ADLI_AD=/Uludağ gazoz 2,5 lt efsane: içerik listesi henüz veritabanında yok/;

const T={
  dugme:'Barkod okut',elle:'Barkod numarası',ara:'Ara',
  yokBaslik:'Bu ürün henüz veritabanında yok',kartFoto:'İçerik listesini fotoğrafla',
  kartGaleri:'Galeriden ya da dosyadan fotoğraf yükle',anaFoto:'Fotoğraf çek',anaGaleri:'Galeriden',
  tamam:/Okuma tamamlandı/,soru:'Bu ürünün içeriğini başka kullanıcılar için kaydedelim mi?',
  ne:k=>new RegExp('^Barkod '+k+' ve okunan içerik metni kaydedilir'),kod:k=>'Barkod: '+k,eslesti:/barkoduyla eşleş/,
};
// B ürününün içerik listesi; sonuçta "E322 · Lesitinler" satırıyla tanınır
const B_METNI='İçindekiler: Buğday unu, şeker, palm yağı, tuz, E322.';
const B_SONUC=/E322 · Lesitinler/;

function png(){return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64')}

async function sayfa(ctx,B){
  const r=await ac(ctx,B+'ocr.html');
  r.ocr=0;
  await r.p.route(/inapp-ocr-[^/]*\.workers\.dev/,q=>{
    const rq=q.request();
    if(rq.method()==='POST'&&/"image"/.test(rq.postData()||'')){r.ocr++;
      return q.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({text:B_METNI})})}
    return q.abort();
  });
  return r;
}
async function barkodAra(p,kod){
  await p.getByRole('button',{name:T.dugme}).click();
  const el=p.getByLabel(T.elle);
  await el.first().fill(kod);
  await p.getByRole('button',{name:T.ara,exact:true}).click();
}
// Barkod kartı ekranda mı: "Barkod: <kod>" ve kartın fotoğraf düğmesi görünür. Süre 20 sn (04.11.2026): kart data/barkod_off.json (528 KB) inince çizilir;
// paralel koşuda 5 sn aşılıyordu (main CI 02.11.2026'dan beri kırmızı). Veri 5,5 sn geciktirilince 5 sn ile 18 hata, 20 sn ile 0.
async function kartVar(p,kod,ms){return await gorunur(p.getByText(T.kod(kod),{exact:true}),ms||20000)&&await gorunur(p.getByRole('button',{name:T.kartFoto}),500)}
async function dosyaVer(p,loc){
  const fc=p.waitForEvent('filechooser',{timeout:5000});
  await loc.click();
  await (await fc).setFiles({name:'icerik.png',mimeType:'image/png',buffer:png()});
}
const kartFoto=p=>p.getByRole('button',{name:T.kartFoto});
const kartGaleri=p=>p.getByText(T.kartGaleri,{exact:true});
const anaFoto=p=>p.getByText(T.anaFoto,{exact:true});
const anaGaleri=p=>p.getByText(T.anaGaleri,{exact:true});
const govde=p=>yerlesince(()=>p.locator('body').innerText(),8000,400);

// Öneri o barkodla çıktı mı
async function eslesti(ad,p,kod,ok){
  ok(await gorunur(p.getByText(T.soru,{exact:true}),10000),ad+': kart düğmesiyle verilen içerik fotoğrafından sonra "'+T.soru+'" önerisi çıkmadı');
  ok(await gorunur(p.getByText(T.ne(kod)),2000),ad+': öneri '+kod+' barkoduyla değil');
}
// Barkod unutuldu mu: öneri yok, barkod kartı ve numarası ekranda yok, B'nin sonucu ekranda
async function unutuldu(ad,p,kod,ok){
  ok(!await gorunur(p.getByText(T.soru,{exact:true}),3000),ad+': ana düğmeyle verilen fotoğraftan sonra "'+T.soru+'" önerisi çıktı (barkod '+kod+' unutulmadı)');
  const t=await govde(p);
  ok(!t.includes(kod),ad+': barkod '+kod+' hâlâ ekranda: '+t.split('\n').filter(x=>x.includes(kod)).join(' | '));
  ok(!t.includes(T.yokBaslik)&&!ADLI_AD.test(t),ad+': barkod kartı ("'+T.yokBaslik+'" / içerik yok) hâlâ ekranda');
  ok(!T.eslesti.test(t),ad+': "barkoduyla eşleştirildi" yazısı görünüyor');
}

async function durum(br,B,opt,ok,ad,fn){
  const ctx=await br.newContext(opt);
  try{
    const r=await sayfa(ctx,B);
    await fn(r);
    ok(r.errs.length===0,ad+': sayfa hatası: '+r.errs.join(' | '));
  }finally{await ctx.close()}
}

module.exports=async({br,B,opt,ok})=>{
  await Promise.all([
    // 2a: bulunamayan barkod → kartın kamera düğmesi → eşleşme (bugünkü davranış)
    durum(br,B,opt,ok,'2a kart kamera',async({p})=>{
      const ad='2a kart kamera';
      await barkodAra(p,YOK);
      ok(await kartVar(p,YOK),ad+': '+YOK+' için "'+T.kartFoto+'" kartı çıkmadı (test önkoşulu)');
      ok(await gorunur(p.getByText(T.yokBaslik,{exact:true}),500),ad+': "'+T.yokBaslik+'" görünmüyor');
      await dosyaVer(p,kartFoto(p));
      ok(await gorunur(p.getByText(B_SONUC),10000),ad+': içerik fotoğrafının sonucu gelmedi');
      await eslesti(ad,p,YOK,ok);
    }),
    // 2b: adı bulunan ama içeriği olmayan barkod → kartın galeri düğmesi → eşleşme (bugünkü davranış)
    durum(br,B,opt,ok,'2b kart galeri',async({p})=>{
      const ad='2b kart galeri';
      await barkodAra(p,ADLI);
      ok(await kartVar(p,ADLI),ad+': '+ADLI+' için "'+T.kartFoto+'" kartı çıkmadı (test önkoşulu)');
      ok(await gorunur(p.getByText(ADLI_AD),500),ad+': "<ad>: içerik listesi henüz veritabanında yok" görünmüyor (test önkoşulu: kayıt veride mi?)');
      await dosyaVer(p,kartGaleri(p));
      ok(await gorunur(p.getByText(B_SONUC),10000),ad+': içerik fotoğrafının sonucu gelmedi');
      await eslesti(ad,p,ADLI,ok);
    }),
    // 3 + 4: bulunamayan barkod → ANA "Fotoğraf çek" → barkod unutulur; yeniden yüklemede geri gelmez
    durum(br,B,opt,ok,'3a ana kamera',async(r)=>{
      const {p}=r,ad='3a ana kamera';
      await barkodAra(p,YOK);
      ok(await kartVar(p,YOK),ad+': kart çıkmadı (test önkoşulu)');
      await dosyaVer(p,anaFoto(p));
      ok(await gorunur(p.getByText(B_SONUC),10000),ad+': ana düğmeyle verilen fotoğrafın sonucu gelmedi (barkodsuz tarama gibi işlenmeli)');
      ok(r.ocr===1,ad+': Worker\'a '+r.ocr+' okuma isteği (1 bekleniyordu)');
      await unutuldu(ad,p,YOK,ok);
      // 4: yeniden yükleme
      await p.reload();await p.waitForLoadState('networkidle');
      ok(!await kartVar(p,YOK,2500),ad+' + yeniden yükleme: eski barkodun ('+YOK+') kartı geri geldi');
      await unutuldu(ad+' + yeniden yükleme',p,YOK,ok);
      // 4: yeniden yüklemeden sonra ana düğmeyle yeni bir fotoğraf da o barkoda bağlanmaz
      await dosyaVer(p,anaGaleri(p));
      ok(await gorunur(p.getByText(B_SONUC),10000),ad+' + yeniden yükleme + yeni fotoğraf: sonuç gelmedi');
      await unutuldu(ad+' + yeniden yükleme + yeni fotoğraf',p,YOK,ok);
    }),
    // 3 + 4: adı bulunan barkod → ANA "Galeriden" → barkod unutulur; yeniden yüklemede geri gelmez
    durum(br,B,opt,ok,'3b ana galeri',async({p})=>{
      const ad='3b ana galeri';
      await barkodAra(p,ADLI);
      ok(await kartVar(p,ADLI),ad+': kart çıkmadı (test önkoşulu)');
      await dosyaVer(p,anaGaleri(p));
      ok(await gorunur(p.getByText(B_SONUC),10000),ad+': ana düğmeyle verilen fotoğrafın sonucu gelmedi');
      await unutuldu(ad,p,ADLI,ok);
      await p.reload();await p.waitForLoadState('networkidle');
      ok(!await kartVar(p,ADLI,2500),ad+' + yeniden yükleme: eski barkodun ('+ADLI+') kartı geri geldi');
      await unutuldu(ad+' + yeniden yükleme',p,ADLI,ok);
    }),
    // 5: kart düğmesine basılır, kamera açılırken sayfa yeniden yüklenir, fotoğraf kartın düğmesiyle verilir → eşleşme
    durum(br,B,opt,ok,'5 kart + yeniden yükleme',async({p})=>{
      const ad='5 kart + yeniden yükleme';
      await barkodAra(p,YOK);
      ok(await kartVar(p,YOK),ad+': kart çıkmadı (test önkoşulu)');
      const fc=p.waitForEvent('filechooser',{timeout:5000});
      await kartFoto(p).click();
      await fc;                                   // kamera açıldı; fotoğraf gelmeden sekme yeniden yüklenir
      await p.reload();await p.waitForLoadState('networkidle');
      ok(await kartVar(p,YOK,5000),ad+': yeniden yüklemeden sonra '+YOK+' kartı yok; kullanıcı fotoğrafı verecek yeri bulamaz');
      if(await gorunur(kartFoto(p),500))await dosyaVer(p,kartFoto(p));
      ok(await gorunur(p.getByText(B_SONUC),10000),ad+': içerik fotoğrafının sonucu gelmedi');
      await eslesti(ad,p,YOK,ok);
    }),
  ]);
};
