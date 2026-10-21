// Kabul testi: içerik grubu yanlış pozitifinin kalanı. Önlem/talimat cümlesindeki "sabun"/"soap" Sabun içerik grubu
// (AB 648/2004 Ek VII) sayılmaz. Önceki test (temizlik_sabun_onlem.js) tek geçen, veride bulunan yazımları kapsıyordu;
// bu test kalanları kapsar. Etiket Oku'da temizlik ürünü metninde:
//  1. "CİLT İLE TEMAS HALİNDE İSE: Bol sabun ve su ile yıkayın." metinde İKİ kez (ön ve arka yüz) → "Sabun" grubu
//     görünmez; P302+P352 önlem ifadeleri arasında listelenir.
//  2. "IF ON SKIN: Wash with plenty of soap and water." (CLP 1272/2008 ilk metni, OJ L 353, 31.12.2008) → "Sabun"
//     grubu görünmez; P302+P352 listelenir.
//  3. Başlıksız "Bol sabun ve su ile yıkayın." ve "Bol sabun ve suyla yıkayın." (ayrı durumlar) → "Sabun" grubu
//     görünmez (P302+P352'nin listelenmesi bu durumlarda istenmez, denetlenmez).
//  4. Korunacak: içerik listesinde sabun bu talimatlardan biriyle birlikte → "Sabun" görünür; Türkçe
//     ("İçindekiler: %5'ten az sabun, parfüm.") ve İngilizce ("Ingredients: less than 5% soap, perfume." + İngilizce
//     talimat) için ayrı ayrı.
//
// Kullanıcı yolu ve bölüm kesme temizlik_sabun_onlem.js ile aynı: Etiket Oku açılır, "Temizlik" seçilir, "Okunan
// Metin" kutusuna metin yazılır; temizlik ürünü sayılsın diye "Su ile şiddetli tepkime verir." (EUH014) eklenir.
// "İçerik Grupları (n)" bölümü açılıp görünen metni bir sonraki bölüme kadar alınır; grup adı satır başındadır.
// Özet'teki "İçerik grubu" satırının değeri de okunur. Her durum ayrı sayfada açılır.
const {ac,gorunur}=require('./_ortak.js');

const TEHLIKE='Su ile şiddetli tepkime verir.';
const P302_TR='CİLT İLE TEMAS HALİNDE İSE: Bol sabun ve su ile yıkayın.';
const P302_EN_2008='IF ON SKIN: Wash with plenty of soap and water.';
const BASLIKSIZ_A='Bol sabun ve su ile yıkayın.';
const BASLIKSIZ_B='Bol sabun ve suyla yıkayın.';
const ICERIK_TR="İçindekiler: %5'ten az sabun, parfüm.";
const ICERIK_EN='Ingredients: less than 5% soap, perfume.';
const KOD='P302+P352';

function kes(t,bas,bitisler){
  const i=t.indexOf(bas);
  if(i<0)return '';
  let j=t.length;
  for(const b of bitisler){const k=t.indexOf(b,i+bas.length);if(k>=0&&k<j)j=k}
  return t.slice(i,j);
}
const GRUP_SON=['Yüzde bantları','Tanınan Maddeler (','Önlem İfadeleri (','Dikkat Gerektirenler','Sonuçlar yalnızca'];
const ONLEM_SON=['İçerik Grupları (','Tanınan Maddeler (','Sonuçlar yalnızca'];
const grupVar=(bolum,ad)=>bolum.split('\n').slice(1).some(s=>new RegExp('^'+ad+'(?![a-zçğıöşü])').test(s.trim()));
const satir=(metin,kod)=>(metin.split('\n').find(s=>s.trim().startsWith(kod+' '))||'').trim();

async function dene(ctx,B,ok,ad,metin){
  const {p,errs}=await ac(ctx,B+'ocr.html');
  await p.getByRole('radio',{name:'Temizlik'}).click();
  await p.getByText('Okunan Metin',{exact:true}).click();
  const kutu=p.getByPlaceholder(/Okunan metin burada görünür/);
  ok(await gorunur(kutu,3000),ad+': metin kutusu açılmadı');
  await kutu.fill(TEHLIKE+' '+metin);
  ok(await gorunur(p.getByText(/EUH014/),8000),ad+': sonuç oluşmadı (EUH014 tanınmadı)');
  await p.waitForTimeout(400);
  const onlemBaslik=p.getByText(/^Önlem İfadeleri \(\d+\)/);
  if(await gorunur(onlemBaslik,1500)){
    await onlemBaslik.first().click();
    await gorunur(p.getByText(/^P302\+P352\b/),3000);
  }
  const grupBaslik=p.getByText(/^İçerik Grupları \(\d+\)/);
  if(await gorunur(grupBaslik,1500)){
    await grupBaslik.first().click();
    await p.waitForTimeout(400);
  }
  const t=await p.locator('body').innerText();
  const grup=kes(t,'İçerik Grupları (',GRUP_SON);
  const onlem=kes(t,'Önlem İfadeleri (',ONLEM_SON);
  const oz=t.split('\n');const oi=oz.findIndex(s=>s.trim()==='İçerik grubu');
  const ozet=oi>=0?(oz[oi+1]||'').trim():'';
  ok(errs.length===0,ad+': sayfa hatası: '+errs.join(' | '));
  await p.close();
  return {grup,onlem,ozet,p302:satir(onlem,KOD),sabun:grupVar(grup,'Sabun'),ozetSabun:/(^|[\s:,])Sabun(?![a-zçğıöşü])/.test(ozet)};
}

module.exports=async({br,B,opt,ok})=>{
  const ctx=await br.newContext(opt);
  const yok=(ad,r)=>{
    ok(!r.sabun,ad+': "Sabun" içerik grubu görünüyor (talimat metni içerik sayıldı): '+r.grup.slice(0,200));
    ok(!r.ozetSabun,ad+': Özet\'te "İçerik grubu" satırı Sabun diyor: '+r.ozet);
  };
  const var_=(ad,r)=>{
    ok(r.sabun,ad+': içerik listesindeki sabun "Sabun" grubu olarak görünmüyor (gerçek içerik kayboldu): '+r.grup.slice(0,200));
    ok(r.ozetSabun,ad+': Özet\'te "İçerik grubu" satırı Sabun demiyor: '+r.ozet);
  };
  try{
    // 1) Aynı önlem ifadesi iki kez (ön ve arka yüz)
    let ad='1. iki kez',r=await dene(ctx,B,ok,ad,P302_TR+' '+P302_TR);
    yok(ad,r);
    ok(r.p302!=='',ad+': P302+P352 önlem ifadeleri arasında listelenmedi: '+r.onlem.slice(0,200));

    // 2) CLP'nin ilk İngilizcesi (2008)
    ad='2. EN 2008';r=await dene(ctx,B,ok,ad,P302_EN_2008);
    yok(ad,r);
    ok(r.p302!=='',ad+': P302+P352 önlem ifadeleri arasında listelenmedi: '+r.onlem.slice(0,200));

    // 3) Başlıksız talimatlar (P302+P352 denetlenmez)
    for(const [a,m] of [['3a. başlıksız "su ile"',BASLIKSIZ_A],['3b. başlıksız "suyla"',BASLIKSIZ_B]]){
      yok(a,await dene(ctx,B,ok,a,m));
    }

    // 4) Korunacak: içerik listesinde sabun + talimat → Sabun görünür
    for(const [a,m] of [
      ['4a. TR içerik + iki kez önlem',ICERIK_TR+' '+P302_TR+' '+P302_TR],
      ['4b. TR içerik + başlıksız',ICERIK_TR+' '+BASLIKSIZ_B],
      ['4c. EN içerik + EN 2008 talimat',ICERIK_EN+' '+P302_EN_2008],
    ]){
      var_(a,await dene(ctx,B,ok,a,m));
    }
  }finally{await ctx.close()}
};
