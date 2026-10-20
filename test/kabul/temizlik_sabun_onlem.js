// Kabul testi: önlem ifadesi P302+P352'nin 2013 yazımı "Bol sabun ve su ile yıkayın" der. Etikette bu ifade geçince
// "Sabun" içerik grubu (AB 648/2004 Ek VII) bulunmuş sayılıyordu; bu yanlış. İçerik grupları aranırken tanınan tehlike/
// önlem ifadelerinin metni sayılmaz. Etiket Oku'da temizlik ürünü metninde:
//  1. İçerik listesi yok, yalnızca "CİLT İLE TEMAS HALİNDE İSE: Bol sabun ve su ile yıkayın." var → "Sabun" içerik
//     grubu görünmez; P302+P352 önlem ifadeleri arasında listelenir.
//  2. Öteki eski yazımlar ("… Bol su ve sabun ile yıkayın.", "DERİ İLE TEMAS HALİNDE İSE: Bol sabun ve su ile
//     yıkayın.") için de aynısı: "Sabun" grubu görünmez, P302+P352 listelenir.
//  3. Hem içerik listesinde sabun ("İçindekiler: %5'ten az sabun, parfüm.") hem bu önlem ifadesi varsa → "Sabun"
//     grubu görünür (gerçek içerik kaybolmaz), P302+P352 de listelenir.
//  4. Yalnızca içerik listesinde sabun (önlem ifadesi yok) → "Sabun" görünür (korunacak davranış).
// Metinler kaynak/temizlik_onlemler.tsv'den (P302+P352 satırının 5. sütunu, eski yazımlar) birebir alındı.
//
// Kullanıcı yolu: Etiket Oku açılır, "Temizlik" seçilir, "Okunan Metin" açılıp kutuya etiket metni yazılır. Ürünün
// temizlik ürünü sayılması için metne bir tehlike ifadesi ("Su ile şiddetli tepkime verir.", EUH014) eklenir.
// "Sabun" sözcüğü önlem ifadesinin satırında da geçebilir; bu yüzden denetim içerik grupları bölümüyle sınırlıdır:
//  - "İçerik Grupları (n)" başlığına basılıp bölüm açılır; bölümün görünen metni başlıktan bir sonraki bölüme (alt not
//    "Yüzde bantları", "Tanınan Maddeler (", "Sonuçlar yalnızca") kadar alınır. Grup yoksa başlık da yoktur.
//  - Bölümde grup adı satırın başındadır ("Sabun" ya da "Sabun%5'ten az"); açıklama satırı ("Yağ asidi tuzları…")
//    sabun sözcüğüyle başlamaz. Ayrıca Özet'teki "İçerik grubu" satırının değeri ("1: Sabun") de okunur.
// Her durum ayrı sayfada açılır (biri ötekinin bıraktığı duruma dayanmasın).
const {ac,gorunur}=require('./_ortak.js');

const TEHLIKE='Su ile şiddetli tepkime verir.';
const P302_2013a='CİLT İLE TEMAS HALİNDE İSE: Bol sabun ve su ile yıkayın.';
const P302_2013b='CİLT İLE TEMAS HALİNDE İSE: Bol su ve sabun ile yıkayın.';
const P302_2013c='DERİ İLE TEMAS HALİNDE İSE: Bol sabun ve su ile yıkayın.';
const ICERIK="İçindekiler: %5'ten az sabun, parfüm.";
const KOD='P302+P352';

// Başlık (ör. "İçerik Grupları (") ile ilk bitiş işareti arasındaki görünen metin; başlık yoksa ''
function kes(t,bas,bitisler){
  const i=t.indexOf(bas);
  if(i<0)return '';
  let j=t.length;
  for(const b of bitisler){const k=t.indexOf(b,i+bas.length);if(k>=0&&k<j)j=k}
  return t.slice(i,j);
}
const GRUP_SON=['Yüzde bantları','Tanınan Maddeler (','Önlem İfadeleri (','Dikkat Gerektirenler','Sonuçlar yalnızca'];
const ONLEM_SON=['İçerik Grupları (','Tanınan Maddeler (','Sonuçlar yalnızca'];
// Grup adıyla başlayan satır var mı (sabun / sabunlar değil, yalnızca "Sabun" adı; ardından bant yazısı gelebilir)
const grupVar=(bolum,ad)=>bolum.split('\n').slice(1).some(s=>new RegExp('^'+ad+'(?![a-zçğıöşü])').test(s.trim()));
const satir=(metin,kod)=>(metin.split('\n').find(s=>s.trim().startsWith(kod+' '))||'').trim();

async function dene(ctx,B,ok,ad,metin){
  const {p,errs}=await ac(ctx,B+'ocr.html');
  await p.getByRole('radio',{name:'Temizlik'}).click();
  await p.getByText('Okunan Metin',{exact:true}).click();
  const kutu=p.getByPlaceholder(/Okunan metin burada görünür/);
  ok(await gorunur(kutu,3000),ad+': metin kutusu açılmadı');
  await kutu.fill(TEHLIKE+' '+metin);
  // Sonuç hazır: tehlike ifadesi her durumda var, "Dikkat Gerektirenler" bölümü görünür
  ok(await gorunur(p.getByText(/EUH014/),8000),ad+': sonuç oluşmadı (EUH014 tanınmadı)');
  await p.waitForTimeout(400);
  const onlemBaslik=p.getByText(/^Önlem İfadeleri \(\d+\)/);
  if(await gorunur(onlemBaslik,1500)){
    await onlemBaslik.first().click();
    await gorunur(p.getByText(/^P302\+P352\b/),3000);
  }
  const grupBaslik=p.getByText(/^İçerik Grupları \(\d+\)/);
  const grupBaslikVar=await gorunur(grupBaslik,1500);
  if(grupBaslikVar){
    await grupBaslik.first().click();
    await p.waitForTimeout(400);
  }
  const t=await p.locator('body').innerText();
  const grup=kes(t,'İçerik Grupları (',GRUP_SON);
  const onlem=kes(t,'Önlem İfadeleri (',ONLEM_SON);
  // Özet satırı: "İçerik grubu" etiketinden sonraki satır (ör. "1: Sabun" ya da "Bulunamadı")
  const oz=t.split('\n');const oi=oz.findIndex(s=>s.trim()==='İçerik grubu');
  const ozet=oi>=0?(oz[oi+1]||'').trim():'';
  ok(errs.length===0,ad+': sayfa hatası: '+errs.join(' | '));
  await p.close();
  return {grup,onlem,ozet,p302:satir(onlem,KOD),sabun:grupVar(grup,'Sabun'),ozetSabun:/(^|[\s:,])Sabun(?![a-zçğıöşü])/.test(ozet)};
}

module.exports=async({br,B,opt,ok})=>{
  const ctx=await br.newContext(opt);
  try{
    // 1) Yalnızca önlem ifadesi (2013 yazımı): Sabun grubu yok, P302+P352 listelenir
    let r=await dene(ctx,B,ok,'1. yalnız önlem',P302_2013a);
    ok(!r.sabun,'1. yalnız önlem ifadesi: "Sabun" içerik grubu görünüyor (önlem metni içerik sayıldı): '+r.grup.slice(0,200));
    ok(!r.ozetSabun,'1. yalnız önlem ifadesi: Özet\'te "İçerik grubu" satırı Sabun diyor: '+r.ozet);
    ok(r.p302!=='','1. yalnız önlem ifadesi: P302+P352 önlem ifadeleri arasında listelenmedi: '+r.onlem.slice(0,200));

    // 2) Öteki eski yazımlar: aynı sonuç
    for(const [ad,m] of [['2a. su ve sabun',P302_2013b],['2b. DERİ İLE',P302_2013c]]){
      r=await dene(ctx,B,ok,ad,m);
      ok(!r.sabun,ad+': "Sabun" içerik grubu görünüyor (önlem metni içerik sayıldı): '+r.grup.slice(0,200));
      ok(!r.ozetSabun,ad+': Özet\'te "İçerik grubu" satırı Sabun diyor: '+r.ozet);
      ok(r.p302!=='',ad+': P302+P352 önlem ifadeleri arasında listelenmedi: '+r.onlem.slice(0,200));
    }

    // 3) İçerik listesinde sabun + önlem ifadesi: Sabun grubu kalır, P302+P352 listelenir
    r=await dene(ctx,B,ok,'3. içerik + önlem',ICERIK+' '+P302_2013a);
    ok(r.sabun,'3. içerik + önlem: içerik listesindeki sabun "Sabun" grubu olarak görünmüyor (gerçek içerik kayboldu): '+r.grup.slice(0,200));
    ok(r.ozetSabun,'3. içerik + önlem: Özet\'te "İçerik grubu" satırı Sabun demiyor: '+r.ozet);
    ok(r.p302!=='','3. içerik + önlem: P302+P352 listelenmedi: '+r.onlem.slice(0,200));

    // 4) Yalnızca içerik listesinde sabun: Sabun grubu görünür (korunacak davranış)
    r=await dene(ctx,B,ok,'4. yalnız içerik',ICERIK);
    ok(r.sabun,'4. yalnız içerik: "Sabun" içerik grubu görünmüyor: '+r.grup.slice(0,200));
    ok(r.ozetSabun,'4. yalnız içerik: Özet\'te "İçerik grubu" satırı Sabun demiyor: '+r.ozet);
  }finally{await ctx.close()}
};
