// Kabul testi: ülke mevzuat katmanı (YOL_HARITASI B-05). Profilim > Ülke seçimine göre gıda katkı maddesi kartının
// ayrıntısında o ülkedeki resmi durum öne çıkar.
//  - Türkiye seçiliyken bugünkü Türkiye'ye özgü satır ("Türkiye: …" notu) sürer.
//  - Birleşik Krallık ve ABD seçiliyken, maddenin o ülkedeki durumu AB'dekinden farklıysa ya da kısıtlıysa ayrıntıda
//    "<Ülke adı>: <durum>." satırı ve kaynağı görünür. Ülke adları i18n ulke.ad.* değerleri (tr: "Birleşik Krallık",
//    "Amerika Birleşik Devletleri"; en: "United Kingdom", "United States").
//  - Durum metinleri (tr / en): izinli / permitted; yalnızca belirli gıdalarda izinli / permitted only in certain foods;
//    gıda katkısı olarak izinli değil / not permitted as a food additive; izni iptal edildi / authorisation revoked;
//    durumu doğrulanmadı / status not verified.
//  - Katmanı olmayan ülkede (İrlanda) ve AB ile aynı / değerlendirilmemiş maddede (ABD'de E330) ülke satırı görünmez.
//
// Beklenenler:
//  1. GB, E171: "Birleşik Krallık: izinli." ve kaynak "FSA"; "Türkiye:" yok.
//  2. ABD, E171: "Amerika Birleşik Devletleri: izinli." ve "%1" sınırı notu; E127: "… izni iptal edildi.";
//     E124: "… gıda katkısı olarak izinli değil."; kaynak "21 CFR".
//  3. Türkiye, E171: "Türkiye:" notu var (bugünkü davranış), "Birleşik Krallık:" yok.
//  4. ABD, E330: ülke satırı yok.
//  5. İngilizce + ABD, E127: "authorisation revoked".
//  6. İrlanda, E171: hiçbir ülke satırı yok (Türkiye/Birleşik Krallık/ABD), hata yok.
//  7. Hiçbir senaryoda sayfa hatası yok.
//
// Kullanıcı yolu (uygulamada gözlendi, 21.10.2026): ocr.html açılır; alt menüde "Profilim" bağlantısı → "Ülke"
// açılır listesinden ülke seçilir; alt menüde "Etiket Oku" ile geri dönülür; "Gıda" seçilir; "Okunan Metin" açılır,
// kutuya (placeholder "Okunan metin burada görünür…") içerik yazılır; katkı kartındaki "<ad> hakkında bilgi"
// (en: "About <ad>") düğmesi ayrıntıyı açar. Ayrıntının metni sayfa metninde, kartın başlığının ("E171 · …") son
// geçtiği yerden "Ansiklopedide oku" bağlantısına kadardır (ayrıntı açılınca başlık ikinci kez görünür).
const {ac,gorunur}=require('./_ortak.js');

const DIL={
  tr:{locale:'tr-TR',profil:'Profilim',ulke:'Ülke',etiketOku:'Etiket Oku',gida:'Gıda',okunan:'Okunan Metin',
      kutu:/Okunan metin burada görünür/,bilgi:ad=>new RegExp('^'+ad+' hakkında bilgi$'),son:'Ansiklopedide oku',
      ad:{tr:'Türkiye',gb:'Birleşik Krallık',us:'Amerika Birleşik Devletleri',ie:'İrlanda'}},
  en:{locale:'en-US',profil:'My Profile',ulke:'Country',etiketOku:'Read Label',gida:'Food',okunan:'Text Read',
      kutu:/The text that was read appears here/,bilgi:ad=>new RegExp('^About '+ad+'$','i'),son:'Read in the encyclopedia',
      ad:{tr:'Türkiye',gb:'United Kingdom',us:'United States',ie:'Ireland'}},
};
// Katkı: kod, kartta görünen ad (tr / en düğme adında), içerik metni
const KATKI={
  E171:{ad:{tr:'Titanyum dioksit',en:'Titanium dioxide'},metin:'İçindekiler: şeker, renklendirici (E171).'},
  E127:{ad:{tr:'Eritrosin',en:'Erythrosine'},metin:'İçindekiler: şeker, renklendirici (E127).'},
  E124:{ad:{tr:'Ponceau 4R',en:'Ponceau 4R'},metin:'İçindekiler: şeker, renklendirici (E124).'},
  E330:{ad:{tr:'Sitrik asit',en:'Citric acid'},metin:'İçindekiler: şeker, asitlik düzenleyici (E330).'},
};
const kacis=s=>s.replace(/[.*+?^${}()|[\]\\-]/g,'\\$&');
// "<Ülke>:" etiketi; önünde harf olmayan (ör. "Türkiye'de" ya da "İrlanda'da" sayılmaz, iki nokta gerekir)
const etiketRe=ad=>new RegExp('(?<!\\p{L})'+kacis(ad)+':','u');

// Bir bağlam açar, ülkeyi seçer. Döner: {ctx, p, errs}
async function ulkeSec(br,B,opt,ok,dil,ulke){
  const d=DIL[dil];
  const ctx=await br.newContext({...opt,locale:d.locale});
  const {p,errs}=await ac(ctx,B+'ocr.html');
  const prof=p.getByRole('link',{name:d.profil});
  ok(await gorunur(prof),dil+' '+ulke+': "'+d.profil+'" bağlantısı görünmüyor');
  await prof.first().click();
  const sec=p.getByRole('combobox',{name:d.ulke});
  ok(await gorunur(sec),dil+' '+ulke+': "'+d.ulke+'" seçimi görünmüyor');
  await sec.first().selectOption({label:d.ad[ulke]});
  await p.waitForTimeout(300);
  await p.getByRole('link',{name:d.etiketOku}).first().click();
  await p.waitForLoadState('networkidle');
  return {ctx,p,errs};
}

// İçeriği yazar, katkı kartının ayrıntısını açar; ayrıntının görünen metnini döndürür
async function ayrinti(p,ok,dil,kod,etiket){
  const d=DIL[dil],k=KATKI[kod];
  await p.getByRole('radio',{name:d.gida}).click();
  const kutu=p.getByPlaceholder(d.kutu);
  if(!(await kutu.isVisible().catch(()=>false)))await p.getByText(d.okunan,{exact:true}).click();
  ok(await gorunur(kutu),etiket+': "'+d.okunan+'" kutusu görünmüyor');
  await kutu.fill(k.metin);
  const bilgi=p.getByRole('button',{name:d.bilgi(k.ad[dil])});
  ok(await gorunur(bilgi,8000),etiket+': '+kod+' kartında "'+k.ad[dil]+'" bilgi düğmesi görünmüyor');
  await bilgi.first().click();
  const son=p.getByRole('link',{name:d.son});
  ok(await gorunur(son,5000),etiket+': '+kod+' ayrıntısı açılmadı ("'+d.son+'" görünmüyor)');
  await p.waitForTimeout(300);
  const t=await p.locator('body').innerText();
  const i=t.lastIndexOf(kod+' · '),j=t.indexOf(d.son,i);
  return i<0?'':t.slice(i,j<0?undefined:j);
}

async function senaryo(br,B,opt,ok,dil,ulke,kod,denet){
  const etiket=dil+' '+ulke+' '+kod;
  const {ctx,p,errs}=await ulkeSec(br,B,opt,ok,dil,ulke);
  try{
    const t=await ayrinti(p,ok,dil,kod,etiket);
    ok(t.length>0,etiket+': ayrıntı metni okunamadı');
    denet(t,etiket);
    ok(errs.length===0,etiket+': sayfa hatası: '+errs.join(' | '));
  }finally{await ctx.close()}
}

const satir=(t,ad)=>(t.match(new RegExp('(?<!\\p{L})'+kacis(ad)+':[^\\n]*','u'))||[''])[0];

module.exports=async({br,B,opt,ok})=>{
  const T=DIL.tr.ad;
  // 1) Birleşik Krallık, E171: izinli, kaynak FSA; Türkiye satırı yok
  await senaryo(br,B,opt,ok,'tr','gb','E171',(t,e)=>{
    ok(/(?<!\p{L})Birleşik Krallık: izinli\./u.test(t),e+': "Birleşik Krallık: izinli." görünmüyor; ayrıntı: '+t.slice(0,400));
    ok(/(?<!\p{L})FSA(?!\p{L})/u.test(t),e+': kaynak "FSA" görünmüyor');
    ok(!etiketRe(T.tr).test(t),e+': "Türkiye:" satırı görünüyor; ülke Birleşik Krallık: '+satir(t,T.tr));
  });
  // 2) ABD: E171 izinli + %1 sınırı; E127 izni iptal edildi; E124 izinli değil; kaynak 21 CFR
  await senaryo(br,B,opt,ok,'tr','us','E171',(t,e)=>{
    ok(/(?<!\p{L})Amerika Birleşik Devletleri: izinli\./u.test(t),e+': "Amerika Birleşik Devletleri: izinli." görünmüyor; ayrıntı: '+t.slice(0,400));
    ok(/%\s?1(?![\d,.])/.test(satir(t,T.us))||/%\s?1(?![\d,.])/.test(t),e+': "%1" sınırı notu görünmüyor');
    ok(/21 CFR/.test(t),e+': kaynak "21 CFR" görünmüyor');
    ok(!etiketRe(T.tr).test(t),e+': "Türkiye:" satırı görünüyor; ülke ABD');
  });
  await senaryo(br,B,opt,ok,'tr','us','E127',(t,e)=>{
    ok(/(?<!\p{L})Amerika Birleşik Devletleri: izni iptal edildi\./u.test(t),e+': "Amerika Birleşik Devletleri: izni iptal edildi." görünmüyor; ülke satırı: "'+satir(t,T.us)+'"');
    ok(/21 CFR/.test(t),e+': kaynak "21 CFR" görünmüyor');
  });
  await senaryo(br,B,opt,ok,'tr','us','E124',(t,e)=>{
    ok(/(?<!\p{L})Amerika Birleşik Devletleri: gıda katkısı olarak izinli değil\./u.test(t),e+': "Amerika Birleşik Devletleri: gıda katkısı olarak izinli değil." görünmüyor; ülke satırı: "'+satir(t,T.us)+'"');
    ok(/21 CFR/.test(t),e+': kaynak "21 CFR" görünmüyor');
  });
  // 3) Türkiye, E171: bugünkü "Türkiye:" notu sürer; Birleşik Krallık satırı yok
  await senaryo(br,B,opt,ok,'tr','tr','E171',(t,e)=>{
    ok(etiketRe(T.tr).test(t),e+': "Türkiye:" notu görünmüyor (bugünkü davranış bozuldu); ayrıntı: '+t.slice(0,400));
    ok(!etiketRe(T.gb).test(t),e+': "Birleşik Krallık:" satırı görünüyor; ülke Türkiye');
    ok(!etiketRe(T.us).test(t),e+': "Amerika Birleşik Devletleri:" satırı görünüyor; ülke Türkiye');
  });
  // 4) ABD, E330: AB'de izinli, ABD satırı değerlendirilmedi → ülke satırı yok
  await senaryo(br,B,opt,ok,'tr','us','E330',(t,e)=>{
    ok(!etiketRe(T.us).test(t),e+': ülke satırı görünüyor: "'+satir(t,T.us)+'"');
    ok(!etiketRe(T.tr).test(t)&&!etiketRe(T.gb).test(t),e+': başka bir ülke satırı görünüyor');
  });
  // 5) İngilizce + ABD, E127: "authorisation revoked"
  await senaryo(br,B,opt,ok,'en','us','E127',(t,e)=>{
    ok(/(?<!\p{L})United States: authorisation revoked\./u.test(t)||/authorisation revoked/.test(satir(t,DIL.en.ad.us)),e+': "United States: authorisation revoked." görünmüyor; ülke satırı: "'+satir(t,DIL.en.ad.us)+'"');
    ok(!/not yet translated/i.test(satir(t,DIL.en.ad.us)),e+': ülke satırı çevrilmemiş olarak işaretli');
  });
  // 6) İrlanda (katmanı yok), E171: hiçbir ülke satırı yok
  await senaryo(br,B,opt,ok,'tr','ie','E171',(t,e)=>{
    for(const ad of [T.tr,T.gb,T.us,T.ie])ok(!etiketRe(ad).test(t),e+': "'+ad+':" satırı görünüyor; İrlanda için ülke katmanı yok: "'+satir(t,ad)+'"');
  });
};
