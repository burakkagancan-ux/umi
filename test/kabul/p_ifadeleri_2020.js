// Kabul testi: SEA Yönetmeliği 2020 değişikliğiyle önlem ifadelerinin (P) Türkçesi 2020 resmi metnine geçti; piyasada
// hâlâ 2013 yazımıyla basılmış etiketler var. Etiket Oku'da temizlik ürünü metninde:
//  1. P263'ün 2020 yazımı geçerse P263 listelenir, "benzer yazım, kontrol edin" notu yoktur.
//  2. P263'ün 2013 yazımı birebir geçerse de P263 listelenir ve not yoktur (eski resmi yazım tam tanınmış sayılır).
//  3. P305+P351+P338'in 2013 yazımı tanınır, not yoktur; ekranda 2020 yazımı gösterilir, 2013 yazımı gösterilmez.
//  4. OCR hatalı bir yazım ("kaçınm.") hâlâ tanınır ve "benzer yazım, kontrol edin" notu görünür (korunacak davranış).
// Metinler kaynak/temizlik_onlemler.tsv'den (2. sütun güncel, 5. sütun eski yazımlar) birebir alındı.
//
// Kullanıcı yolu: Etiket Oku açılır, "Temizlik" seçilir, "Okunan Metin" açılıp kutuya etiket metni yazılır. Ürünün
// temizlik ürünü sayılması için metne bir tehlike ifadesi ("Su ile şiddetli tepkime verir.", EUH014) eklenir.
// Sonuçta "Önlem İfadeleri (n)" başlığına basılıp bölüm açılır; ifadenin satırı (kodla başlayan satır) okunur.
// Her durum ayrı sayfada açılır (biri ötekinin bıraktığı duruma dayanmasın).
const {ac,gorunur}=require('./_ortak.js');

const TEHLIKE='Su ile şiddetli tepkime verir.';
const P263_2020='Hamilelikte ve anne sütü verirken temastan kaçının.';
const P263_2013='Hamilelikte/anne sütü verirken temastan kaçının.';
const P263_BOZUK='Hamilelikte ve anne sütü verirken temastan kaçınm.';
const P305_2013='GÖZ İLE TEMASI HALİNDE: Su ile birkaç dakika dikkatlice durulayın. Takılı ve yapması kolaysa, kontak lensleri çıkartın. Durulamaya devam edin.';
const P305_2020='GÖZLERDE İSE: Birkaç dakika su ile dikkatlice durulayın.';
const BENZER=/benzer yazım,?\s*kontrol edin/i;

// "Önlem İfadeleri" bölümünün görünen metni: başlıktan sayfanın alt notuna ("Sonuçlar yalnızca") kadar
async function onlemMetni(p){
  const t=await p.locator('body').innerText();
  const i=t.indexOf('Önlem İfadeleri (');
  if(i<0)return '';
  const j=t.indexOf('Sonuçlar yalnızca',i);
  return t.slice(i,j<0?undefined:j);
}
// Kodla başlayan satır (ör. "P263 …" ya da "P305+P351+P338 …"); yoksa ''
const satir=(metin,kod)=>(metin.split('\n').find(s=>s.trim().startsWith(kod+' '))||'').trim();

async function dene(ctx,B,ok,ad,metin,kod){
  const {p,errs}=await ac(ctx,B+'ocr.html');
  await p.getByRole('radio',{name:'Temizlik'}).click();
  await p.getByText('Okunan Metin',{exact:true}).click();
  const kutu=p.getByPlaceholder(/Okunan metin burada görünür/);
  ok(await gorunur(kutu,3000),ad+': metin kutusu açılmadı');
  await kutu.fill(TEHLIKE+' '+metin);
  const baslik=p.getByText(/^Önlem İfadeleri \(\d+\)/);
  const var_=await gorunur(baslik,8000);
  ok(var_,ad+': sonuçta "Önlem İfadeleri" bölümü görünmedi (ifade tanınmadı)');
  let s='',bolum='';
  if(var_){
    await p.waitForTimeout(400);
    await baslik.first().click();
    await gorunur(p.getByText(new RegExp('^'+kod.replace(/\+/g,'\\+')+'\\b')),3000);
    bolum=await onlemMetni(p);
    s=satir(bolum,kod);
  }
  ok(errs.length===0,ad+': sayfa hatası: '+errs.join(' | '));
  await p.close();
  return {s,bolum};
}

module.exports=async({br,B,opt,ok})=>{
  const ctx=await br.newContext(opt);
  try{
    // 1) 2020 yazımı: tanınır, benzer notu yok
    let r=await dene(ctx,B,ok,'1. P263 2020',P263_2020,'P263');
    ok(r.s!=='','1. P263 2020 yazımı: P263 önlem ifadesi olarak listelenmedi: '+r.bolum.slice(0,200));
    ok(!BENZER.test(r.s),'1. P263 2020 yazımı: "benzer yazım" notu var: '+r.s);

    // 2) 2013 yazımı birebir: tanınır, benzer notu yok
    r=await dene(ctx,B,ok,'2. P263 2013',P263_2013,'P263');
    ok(r.s!=='','2. P263 2013 yazımı: P263 önlem ifadesi olarak listelenmedi: '+r.bolum.slice(0,200));
    ok(!BENZER.test(r.s),'2. P263 2013 yazımı: eski resmi yazım birebir yazıldığı halde "benzer yazım" notu var: '+r.s);

    // 3) P305+P351+P338 2013 yazımı: tanınır, not yok, gösterilen metin 2020 yazımı
    r=await dene(ctx,B,ok,'3. P305 2013',P305_2013,'P305+P351+P338');
    ok(r.s!=='','3. P305+P351+P338 2013 yazımı: ifade listelenmedi: '+r.bolum.slice(0,200));
    ok(!BENZER.test(r.s),'3. P305+P351+P338 2013 yazımı: "benzer yazım" notu var: '+r.s);
    ok(r.s.includes(P305_2020),'3. P305+P351+P338: gösterilen Türkçe metin 2020 yazımı değil: '+r.s);
    ok(!r.bolum.includes('GÖZ İLE TEMASI HALİNDE'),'3. P305+P351+P338: sonuçta 2013 yazımı gösteriliyor: '+r.s);

    // 4) Bozuk (OCR hatalı) yazım: tanınır, benzer notu görünür
    r=await dene(ctx,B,ok,'4. P263 bozuk',P263_BOZUK,'P263');
    ok(r.s!=='','4. P263 bozuk yazım: P263 listelenmedi (benzer yazımla tanıma kayboldu): '+r.bolum.slice(0,200));
    ok(BENZER.test(r.s),'4. P263 bozuk yazım: "benzer yazım, kontrol edin" notu görünmüyor: '+r.s);
  }finally{await ctx.close()}
};
