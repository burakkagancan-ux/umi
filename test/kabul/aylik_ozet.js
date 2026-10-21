// Kabul testi: U-09 Aylık özet (kullanıcının isteği: "U09 da yap"). Yol haritası: "Aylık özet. Profilim'de ay ay: taranan ürün
// sayısı (türe göre), uyarılı/dikkatli/özel uyarısız sonuç dağılımı, en sık karşılaşılan uyarılı maddeler (ansiklopedi
// bağlantısıyla), katkılar ve rozetler. Puan yok; yalnızca cihazdaki tarama geçmişinden, sunucuya bir şey gitmez."
//
// Yazanla kararlaştırılmış ölçütler:
//  1. Profilim'de "Aylık Özetim" (EN "My Monthly Summary") kısayolu; ekran başlığı aynı; "Geri"/"Back" Profilim'e döner.
//  2. Varsayılan içinde bulunulan ay ("Ekim 2026" / "October 2026"); "Önceki ay"/"Sonraki ay" düğmeleri; taraması olmayan
//     ayda "Bu ay tarama yok" ("No scans this month").
//  3. Taranan ürün sayısı toplam ve türe göre; aynı ürün (aynı tür + metin) aynı ayda yeniden okutulunca ya da metni elle
//     düzeltilince bir kez sayılır; "Örnek metin dene" sayılmaz; kendi yazılan metin sayılır.
//  4. Dağılım: uyarı / dikkat / özel uyarı yok; her ürün en yüksek seviyesiyle tek grupta. Puan, not, yüzde-skor yok.
//  5. "En Sık Karşılaşılan Uyarılı Maddeler": uyarı/dikkat maddeleri, kaç üründe görüldüğüyle, en sık önce, en çok 5;
//     ansiklopedide sayfası olan madde bağlantıdır.
//  6. page.clock ile bir ay ileri gidip tarayınca yeni ay ayrı sayılır, önceki ayın sayıları değişmez.
//  7. Not satırı: yalnızca bu cihazdaki taramalardan; ekran açılırken dışarıya istek yok.
//  8. Karşılaştır'daki "Geçmişi temizle" aylık özeti silmez.
//
// Ekim 2026'da yapılan taramalar (seviyeler bugünkü sonuç ekranından gözlendi):
//   A  Gıda     "şeker, E102, E211, su"            → uyarı (E102 uyarı, E211 dikkat)   — iki kez okutulur, 1 sayılır
//   B  Gıda     "un, E211" yazılıp "un, E211, su"e düzeltilir → dikkat                 — 1 sayılır
//   C  Gıda     "un, E330, su"                    → özel uyarı yok
//   D  Gıda     "E102, E110, E171, E211, E621, E951" → uyarı
//   K  Kozmetik "Aqua, Glycerin, Methylparaben"    → dikkat
//   T  Temizlik "su, sabun. TEHLİKE. Ciddi göz hasarına yol açar." → uyarı
//   + Gıda "Örnek metin dene" (sayılmaz)
// Beklenen Ekim: toplam 6; Gıda 4, Kozmetik 1, Temizlik 1; uyarı 3, dikkat 2, özel uyarı yok 1.
// Uyarılı maddeler: Sodyum benzoat (E211) 3 üründe (A, B, D) en üstte, Tartrazin (E102) 2 üründe ikinci; uyarı/dikkat
// düzeyinde 7'den fazla farklı madde olduğu için en çok 5'i görünür.
// Kasım 2026: B'nin aynısı yeniden okutulur → Kasım'da Gıda 1, toplam 1; Ekim değişmez.
//
// Sayılar ekranın görünen metninden okunur: etiketin (ör. "Gıda") bulunduğu satırda ya da hemen komşu satırda o sayı.
const {gorunur}=require('./_ortak.js');

const EKIM='2026-10-15T10:00:00',KASIM='2026-11-12T10:00:00';
const dis=u=>!/^http:\/\/localhost:/.test(u);

// _ortak.ac ile aynı, ek olarak saat ayarı (page.clock) ve dış istek kaydı
async function ac(ctx,adres,zaman){
  const p=await ctx.newPage(),errs=[],istek=[];
  p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))errs.push(m.text())});
  p.on('request',q=>{if(dis(q.url()))istek.push(q.url())});
  p.on('dialog',d=>d.accept());
  await p.clock.setSystemTime(new Date(zaman));
  await p.route('**/*',r=>dis(r.request().url())?r.abort():r.continue());
  await p.goto(adres);
  await p.waitForLoadState('networkidle');
  return {p,errs,istek};
}
async function sonucBekle(p,desen){
  for(let k=0;k<40;k++){
    const t=await p.locator('body').innerText();
    const i=t.indexOf('\nSonuç\n');
    if(i>=0&&desen.test(t.slice(i)))return true;
    await p.waitForTimeout(200);
  }
  return false;
}
async function kutuAc(p){
  const kutu=p.getByPlaceholder(/Okunan metin burada görünür/);
  if(!await gorunur(kutu,500))await p.getByText('Okunan Metin',{exact:true}).click();
  return kutu.first();
}
// Yeni sayfa açılışında bir tarama (metin yazılarak)
async function tara(ctx,B,zaman,tur,metin,desen){
  const {p}=await ac(ctx,B+'ocr.html',zaman);
  await p.getByRole('radio',{name:tur}).click();
  await (await kutuAc(p)).fill(metin);
  const r=await sonucBekle(p,desen);
  await p.waitForTimeout(300);
  await p.close();
  return r;
}

// Aylık özet ekranının görünen metni: "Aylık Özetim" başlığından alt menüye kadar
async function ozetMetni(p,baslik){
  const t=await p.locator('body').innerText();
  const i=t.lastIndexOf(baslik||'Aylık Özetim');
  if(i<0)return '';
  const s=t.slice(i);
  const j=s.search(/\n(Ansiklopedi|Encyclopedia)\n(Etiket Oku|Scan Label|Read Label)/);
  return j<0?s:s.slice(0,j);
}
// Profilim'den özet ekranını açar; açılış sırasında dışarıya giden istek sayısını da döndürür
async function ozetAc(ctx,B,zaman){
  const r=await ac(ctx,B+'ocr.html#profil',zaman);
  await r.p.waitForTimeout(500);
  r.istek.length=0;
  const kisa=r.p.getByRole('button',{name:/Aylık Özetim/});
  r.kisayol=await gorunur(kisa,5000);
  if(r.kisayol){
    await kisa.first().click();
    r.ekran=await gorunur(r.p.getByRole('heading',{name:'Aylık Özetim'}),5000);
    await r.p.waitForTimeout(600);
  }
  r.metin=await ozetMetni(r.p);
  return r;
}
// Etiketin satırında ya da komşu satırında n sayısı var mı (yıl satırları hariç)
function sayiVar(metin,etiket,n,haric){
  const L=metin.split('\n').map(s=>s.trim()).filter(Boolean);
  const sayi=new RegExp('(^|[^\\d])'+n+'([^\\d]|$)');
  for(let i=0;i<L.length;i++){
    if(!etiket.test(L[i])||(haric&&haric.test(L[i])))continue;
    for(const k of [i,i-1,i+1]){
      const s=L[k];
      if(s===undefined||/20\d\d/.test(s))continue;
      if(k!==i&&/[A-Za-zÇĞİÖŞÜçğıöşü]{3,}/.test(s.replace(/üründe|ürün|adet|kez|products?|scans?|times/gi,'')))continue;
      if(sayi.test(s))return true;
    }
  }
  return false;
}
// Dağılım ve sayım bölümü (en sık maddeler başlığından önce)
const ustBolum=m=>{const j=m.search(/En Sık Karşılaşılan Uyarılı Maddeler/);return j<0?m:m.slice(0,j)};
const maddeBolum=m=>{const j=m.search(/En Sık Karşılaşılan Uyarılı Maddeler/);return j<0?'':m.slice(j)};
const UYARI=/(^|[^\p{L}])uyarı(lı)?([^\p{L}]|$)/iu,OZEL_YOK=/özel uyarı(sı)? (yok|olmayan)|uyarısız/i;
const BAYRAKLI=['Sodyum benzoat','Tartrazin','Gün batımı sarısı','Titanyum dioksit','Monosodyum glutamat','Aspartam','METHYLPARABEN'];

function ekimDenetle(ok,m,ad){
  const u=ustBolum(m);
  ok(/Ekim 2026/.test(m),ad+': ay adı ve yıl ("Ekim 2026") yazmıyor');
  ok(!/Bu ay tarama yok/.test(m),ad+': taraması olan ayda "Bu ay tarama yok" yazıyor');
  ok(sayiVar(u,/Toplam|Taranan|ürün/i,6,/Gıda|Kozmetik|Temizlik/),ad+': toplam taranan ürün sayısı 6 görünmüyor (aynı ürünün yeniden okutulması / düzeltilmesi / örnek metin sayılmış olabilir)');
  ok(sayiVar(u,/Gıda/,4),ad+': Gıda sayısı 4 görünmüyor (A iki kez okutuldu, B düzeltildi, örnek metin sayılmaz)');
  ok(sayiVar(u,/Kozmetik/,1),ad+': Kozmetik sayısı 1 görünmüyor');
  ok(sayiVar(u,/Temizlik/,1),ad+': Temizlik sayısı 1 görünmüyor');
  ok(sayiVar(u,UYARI,3,OZEL_YOK),ad+': uyarılı ürün sayısı 3 görünmüyor');
  ok(sayiVar(u,/dikkat/i,2,/uyarı/i),ad+': dikkatli (uyarısız) ürün sayısı 2 görünmüyor');
  ok(sayiVar(u,OZEL_YOK,1),ad+': özel uyarı olmayan ürün sayısı 1 görünmüyor');
  ok(!/puan|skor|not:\s*\d|\d+\s*\/\s*(10|100)\b|%\s*\d|\d\s*%/i.test(m),ad+': ekranda puan / skor / yüzde var');
  // En sık uyarılı maddeler
  const b=maddeBolum(m);
  ok(b.length>0,ad+': "En Sık Karşılaşılan Uyarılı Maddeler" bölümü yok');
  const i211=b.indexOf('Sodyum benzoat'),i102=b.indexOf('Tartrazin');
  ok(i211>=0,ad+': en sık uyarılı maddelerde Sodyum benzoat (3 üründe) yok');
  ok(i102>=0,ad+': en sık uyarılı maddelerde Tartrazin (2 üründe) yok');
  ok(i211>=0&&i102>=0&&i211<i102,ad+': en sık önce değil (Sodyum benzoat 3 üründe, Tartrazin 2 üründe)');
  ok(sayiVar(b,/Sodyum benzoat/,3),ad+': Sodyum benzoat\'ın kaç üründe görüldüğü (3) yazmıyor');
  ok(sayiVar(b,/Tartrazin/,2),ad+': Tartrazin\'in kaç üründe görüldüğü (2) yazmıyor');
  const say=BAYRAKLI.filter(x=>b.includes(x)).length;
  ok(say<=5,ad+': en sık uyarılı maddelerde 5\'ten fazla madde var ('+say+')');
  ok(say===5,ad+': uyarı/dikkat düzeyinde 7 farklı madde varken 5 madde görünmüyor ('+say+')');
  ok(!/Sitrik asit/.test(b),ad+': özel uyarısı olmayan madde (Sitrik asit) uyarılı maddeler arasında');
}

module.exports=async({br,B,opt,ok})=>{
  const ctx=await br.newContext(opt);
  try{
    // Ölçüt 1 ve 2 (boş): hiç tarama yokken kısayol, başlık, ay, "Bu ay tarama yok", geri
    {
      const r=await ozetAc(ctx,B,EKIM);
      ok(r.kisayol,'Profilim\'de "Aylık Özetim" kısayolu (düğme) yok');
      ok(r.ekran,'"Aylık Özetim" kısayoluna dokununca "Aylık Özetim" başlıklı ekran açılmadı');
      ok(/Ekim 2026/.test(r.metin),'boş durumda içinde bulunulan ay ("Ekim 2026") yazmıyor');
      ok(/Bu ay tarama yok/.test(r.metin),'taraması olmayan ayda "Bu ay tarama yok" yazmıyor');
      ok(/yalnızca bu cihaz/i.test(r.metin),'not satırında "yalnızca bu cihaz…" (cihazdaki taramalardan hesaplandığı) yazmıyor');
      ok(r.istek.length===0,'aylık özet açılırken dışarıya istek gitti: '+r.istek.join(' , '));
      if(r.ekran){
        const geri=r.p.getByRole('button',{name:/Geri/});
        ok(await gorunur(geri,2000),'aylık özet ekranında "Geri" düğmesi yok');
        if(await geri.count()){
          await geri.first().click();
          ok(!await gorunur(r.p.getByRole('heading',{name:'Aylık Özetim'}),800),'"Geri" sonrasında aylık özet ekranı hâlâ açık');
          ok(await gorunur(r.p.getByRole('button',{name:/Aylık Özetim/}),3000)&&await gorunur(r.p.getByText('Profilim',{exact:true}),1000),
            '"Geri" Profilim\'e dönmedi');
        }
      }
      ok(r.errs.length===0,'boş özet: sayfa hatası: '+r.errs.join(' | '));
      await r.p.close();
    }

    // Ekim taramaları
    ok(await tara(ctx,B,EKIM,'Gıda','İçindekiler: şeker, E102, E211, su.',/Tartrazin/),'A taraması sonuç vermedi');
    ok(await tara(ctx,B,EKIM,'Gıda','İçindekiler: şeker, E102, E211, su.',/Tartrazin/),'A (yeniden) taraması sonuç vermedi');
    {
      const {p}=await ac(ctx,B+'ocr.html',EKIM);
      await p.getByRole('radio',{name:'Gıda'}).click();
      const kutu=await kutuAc(p);
      await kutu.fill('İçindekiler: un, E211');
      ok(await sonucBekle(p,/Sodyum benzoat/),'B taraması sonuç vermedi');
      await p.waitForTimeout(500);
      await kutu.fill('İçindekiler: un, E211, su.'); // elle düzeltme
      await p.waitForTimeout(1200);
      await p.close();
    }
    ok(await tara(ctx,B,EKIM,'Gıda','İçindekiler: un, E330, su.',/Sitrik asit/),'C taraması sonuç vermedi');
    ok(await tara(ctx,B,EKIM,'Gıda','İçindekiler: E102, E110, E171, E211, E621, E951.',/Aspartam/),'D taraması sonuç vermedi');
    ok(await tara(ctx,B,EKIM,'Kozmetik','Ingredients: Aqua, Glycerin, Methylparaben.',/METHYLPARABEN/i),'K taraması sonuç vermedi');
    ok(await tara(ctx,B,EKIM,'Temizlik','İçindekiler: su, sabun. TEHLİKE. Ciddi göz hasarına yol açar.',/göz hasarı/i),'T taraması sonuç vermedi');
    {
      const {p}=await ac(ctx,B+'ocr.html',EKIM);
      await p.getByRole('radio',{name:'Gıda'}).click();
      await p.getByRole('button',{name:'Örnek metin dene'}).click();
      ok(await sonucBekle(p,/Tartrazin/),'örnek metin sonuç vermedi');
      await p.waitForTimeout(500);
      await p.close();
    }

    // Ölçüt 2-5, 7: Ekim özeti
    {
      const r=await ozetAc(ctx,B,EKIM);
      ok(r.ekran,'Ekim: aylık özet ekranı açılmadı');
      ekimDenetle(ok,r.metin,'Ekim');
      ok(r.istek.length===0,'Ekim: aylık özet açılırken dışarıya istek gitti: '+r.istek.join(' , '));
      ok(/yalnızca bu cihaz/i.test(r.metin),'Ekim: not satırında "yalnızca bu cihaz…" yazmıyor');
      ok(/Rozet|Eklediğim/i.test(r.metin),'Ekim: katkılar / rozetler satırı ("Rozet" ya da "Eklediğim") yok');
      // Ansiklopedi bağlantısı
      const bag=r.p.getByRole('link',{name:/Sodyum benzoat/});
      ok(await gorunur(bag,2000),'Ekim: Sodyum benzoat ansiklopedi bağlantısı değil');
      if(await bag.count()){
        await bag.first().click();
        await r.p.waitForLoadState('networkidle');
        ok(/ansiklopedi\.html/.test(r.p.url()),'Sodyum benzoat bağlantısı ansiklopediye gitmedi: '+r.p.url());
        ok(await gorunur(r.p.getByText(/Sodyum benzoat/),5000),'ansiklopedi sayfasında Sodyum benzoat görünmüyor');
      }
      ok(r.errs.length===0,'Ekim özeti: sayfa hatası: '+r.errs.join(' | '));
      await r.p.close();
    }

    // Ölçüt 8: "Geçmişi temizle" aylık özeti silmez
    {
      const {p}=await ac(ctx,B+'ocr.html',EKIM);
      await p.getByRole('button',{name:'Karşılaştır'}).click();
      const tem=p.getByRole('button',{name:'Geçmişi temizle'});
      ok(await gorunur(tem,3000),'Karşılaştır\'da "Geçmişi temizle" düğmesi görünmüyor');
      if(await tem.count())await tem.first().click();
      await p.waitForTimeout(800);
      await p.close();
      const r=await ozetAc(ctx,B,EKIM);
      ok(sayiVar(ustBolum(r.metin),/Gıda/,4)&&!/Bu ay tarama yok/.test(r.metin),'"Geçmişi temizle" aylık özeti sildi ya da değiştirdi');
      await r.p.close();
    }

    // Ölçüt 6: Kasım; önce boş, sonra B'nin aynısı okutulur
    {
      const r=await ozetAc(ctx,B,KASIM);
      ok(/Kasım 2026/.test(r.metin),'Kasım: ay adı ("Kasım 2026") yazmıyor');
      ok(/Bu ay tarama yok/.test(r.metin),'Kasım (henüz tarama yok): "Bu ay tarama yok" yazmıyor');
      await r.p.close();
    }
    ok(await tara(ctx,B,KASIM,'Gıda','İçindekiler: un, E211, su.',/Sodyum benzoat/),'Kasım taraması sonuç vermedi');
    {
      const r=await ozetAc(ctx,B,KASIM);
      const u=ustBolum(r.metin);
      ok(/Kasım 2026/.test(r.metin),'Kasım: ay adı ("Kasım 2026") yazmıyor');
      ok(!/Bu ay tarama yok/.test(r.metin),'Kasım taramasından sonra "Bu ay tarama yok" yazıyor');
      ok(sayiVar(u,/Gıda/,1),'Kasım: Gıda sayısı 1 görünmüyor (yeni ay ayrı sayılmalı)');
      ok(!sayiVar(u,/Gıda/,4)&&!sayiVar(u,/Gıda/,5),'Kasım: Ekim\'in sayıları Kasım\'a karışmış');
      ok(sayiVar(u,/dikkat/i,1,/uyarı/i),'Kasım: dikkatli ürün sayısı 1 görünmüyor');
      // Önceki ay → Ekim değişmemiş
      const onceki=r.p.getByRole('button',{name:'Önceki ay'});
      ok(await gorunur(onceki,2000),'"Önceki ay" düğmesi görünmüyor');
      if(await onceki.count()){
        await onceki.first().click();
        await r.p.waitForTimeout(800);
        ekimDenetle(ok,await ozetMetni(r.p),'Kasım\'dan Ekim\'e dönüş');
        const sonraki=r.p.getByRole('button',{name:'Sonraki ay'});
        ok(await gorunur(sonraki,2000),'"Sonraki ay" düğmesi görünmüyor');
        if(await sonraki.count()){
          await sonraki.first().click();
          await r.p.waitForTimeout(800);
          ok(/Kasım 2026/.test(await ozetMetni(r.p)),'"Sonraki ay" Kasım 2026\'ya geçmedi');
        }
      }
      ok(r.errs.length===0,'Kasım özeti: sayfa hatası: '+r.errs.join(' | '));
      await r.p.close();
    }
  }finally{await ctx.close()}

  // İngilizce: kısayol, başlık, ay, boş ay, geri
  {
    const ctx2=await br.newContext(opt);
    try{
      const {p:pp}=await ac(ctx2,B+'ocr.html#profil',EKIM);
      const dil=pp.getByLabel(/Dil · Language/);
      ok(await gorunur(dil,5000),'İngilizce: "Dil · Language" seçimi görünmüyor');
      await dil.first().selectOption({label:'English'});
      await pp.waitForTimeout(1500);
      await pp.close();
      const {p,errs}=await ac(ctx2,B+'ocr.html#profil',EKIM);
      const kisa=p.getByRole('button',{name:/My Monthly Summary/});
      ok(await gorunur(kisa,5000),'İngilizce: "My Monthly Summary" kısayolu yok');
      if(await kisa.count()){
        await kisa.first().click();
        ok(await gorunur(p.getByRole('heading',{name:'My Monthly Summary'}),5000),'İngilizce: "My Monthly Summary" başlıklı ekran açılmadı');
        await p.waitForTimeout(800);
        const m=await ozetMetni(p,'My Monthly Summary');
        ok(/October 2026/.test(m),'İngilizce: "October 2026" yazmıyor');
        ok(/No scans this month/.test(m),'İngilizce: "No scans this month" yazmıyor');
        ok(!/Aylık Özetim|Bu ay tarama yok|Ekim/.test(m),'İngilizce: ekranda Türkçe metin var');
        const geri=p.getByRole('button',{name:/Back/});
        ok(await gorunur(geri,2000),'İngilizce: "Back" düğmesi yok');
        if(await geri.count()){
          await geri.first().click();
          ok(await gorunur(p.getByRole('button',{name:/My Monthly Summary/}),3000),'İngilizce: "Back" Profilim\'e dönmedi');
        }
      }
      ok(errs.length===0,'İngilizce: sayfa hatası: '+errs.join(' | '));
      await p.close();
    }finally{await ctx2.close()}
  }
};
