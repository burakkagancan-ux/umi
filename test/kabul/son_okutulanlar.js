// Kabul testi: Son Okutulanlar (kullanıcının isteği: "sonuç kaybolma işini etiket oku en ekranında son okutulan 10 ürünü
// gösterme olarak çözelim."). Bağlam: sonuçtan başka sayfaya (yöntem bağlantısı "Bu nasıl değerlendirildi?", alt menü,
// tarayıcı Geri) gidip Etiket Oku'ya dönünce okunan metin ve sonuç kayboluyordu.
//
// İstenen davranış (yazanla kararlaştırılmış ölçütler):
//  1. Etiket Oku'da sonuç yokken, daha önce okutulmuş ürün varsa "Son Okutulanlar" (EN "Recently Scanned") bölümü görünür;
//     hiç tarama yoksa görünmez.
//  2. En çok 10 ürün, en yeni en üstte; 11+ farklı taramada en eskiler listede yok.
//  3. Her satır bir düğme; erişilebilir adında ürün adı ("Tarama N" ya da kaydedilen ad); satırda tür (Gıda/Kozmetik/Temizlik).
//  4. Satıra dokununca o ürünün sonucu açılır, tür seçici o türe geçer; bu açılış yeni tarama sayılmaz.
//  5. Sonuç ekrandayken liste görünmez.
//  6. Tarama → "Bu nasıl değerlendirildi?" → tarayıcı Geri (ya da yeniden yükleme) → listede o ürün en üstte → dokun → sonuç
//     geri gelir; takılı kalmış "henüz yüklenmedi" yazısı kalmaz.
//  7. Kaydet ile ad verilen ürün listede o adla görünür.
//  8. İngilizce arayüzde başlık "Recently Scanned".
//  9. Liste yalnızca cihazdadır: liste görüntülenirken ve satıra dokunulurken dışarıya (Worker dahil) istek gitmez.
//
// Kullanıcı yolu: Etiket Oku > tür seçilir > "Okunan Metin" açılır, kutuya içerik listesi yazılır (sonuç kendiliğinden gelir).
// Her tarama sayfa yeniden açılarak yapılır (aynı açılışta metni düzeltmek aynı ürünün düzeltmesidir, yeni tarama değildir).
// Ürünler, sonuçta görünen tek bir maddeyle tanınır ("E100 · Kurkumin" gibi); "Tarama N" numarasına dayanılmaz.
const {ac,gorunur}=require('./_ortak.js');

const BASLIK='Son Okutulanlar',BASLIK_EN='Recently Scanned';
const SATIR=/Tarama \d+/;
// 12 farklı gıda taraması: her biri sonuçta "Exxx · Ad" satırıyla tanınır
const ON_IKI=[['E100','Kurkumin'],['E120','Karmin'],['E160a','Karotenler'],['E200','Sorbik asit'],['E260','Asetik asit'],
  ['E270','Laktik asit'],['E290','Karbondioksit'],['E300','Askorbik asit'],['E322','Lesitinler'],['E330','Sitrik asit'],
  ['E406','Agar'],['E415','Ksantan zamkı']];
const madde=(k,a)=>new RegExp(k+' · '+a);
const dis=u=>!/^http:\/\/localhost:/.test(u);

// Sayfayı açar; dışarıya giden istekleri (Worker dahil; _ortak.js onları zaten keser) kaydeder
async function sayfa(ctx,adres){
  const r=await ac(ctx,adres);
  r.istek=[];
  r.p.on('request',q=>{if(dis(q.url()))r.istek.push(q.url())});
  return r;
}
// Sonuç bölümünün görünen metni ("Sonuç" başlığından alt bilgiye kadar); yoksa ''
async function sonuc(p){
  const t=await p.locator('body').innerText();
  const i=t.search(/\n(Sonuç|Result)\n/);
  if(i<0)return '';
  const s=t.slice(i);
  const j=s.search(/\n(Deneme Sürümü|Trial Version)\n/);
  return j<0?s:s.slice(0,j);
}
async function sonucBekle(p,desen,ms){
  for(let k=0;k<(ms||8000)/200;k++){if(desen.test(await sonuc(p)))return true;await p.waitForTimeout(200)}
  return false;
}
// Bir tarama: tür seç, Okunan Metin aç (kapalıysa), metni yaz, sonucun gelmesini bekle
async function tara(p,tur,metin,desen,en){
  await p.getByRole('radio',{name:tur}).click();
  const kutu=p.getByPlaceholder(en?/The text that was read appears here/:/Okunan metin burada görünür/);
  if(!await gorunur(kutu,500))await p.getByText(en?'Text Read':'Okunan Metin',{exact:true}).click();
  await kutu.first().fill(metin);
  return sonucBekle(p,desen);
}
const satirlar=p=>p.getByRole('button',{name:SATIR});
// Liste yüklendikten sonra (sayfa açılışının ardından) yerleşmesi için kısa bekleme
async function yerles(p){await p.waitForLoadState('networkidle');await p.waitForTimeout(800)}

module.exports=async({br,B,opt,ok})=>{
  // --- Bağlam 1: boş başlangıç, asıl senaryo, tür geçişi, kayıtlı ad, gizlilik ---
  {
    const ctx=await br.newContext(opt);
    try{
      // Ölçüt 1 (olumsuz): hiç tarama yokken başlık görünmez
      {
        const {p,errs}=await sayfa(ctx,B+'ocr.html');
        await yerles(p);
        ok(await p.getByText(BASLIK,{exact:true}).count()===0||!await gorunur(p.getByText(BASLIK,{exact:true}),500),
          'hiç tarama yokken "'+BASLIK+'" başlığı görünüyor');
        ok(errs.length===0,'boş başlangıç: sayfa hatası: '+errs.join(' | '));
        await p.close();
      }

      // Kozmetik bir tarama, ardından gıda taraması (asıl senaryo bu ikincisiyle)
      {
        const {p}=await sayfa(ctx,B+'ocr.html');
        ok(await tara(p,'Kozmetik','Ingredients: Aqua, Glycerin, Methylparaben.',/METHYLPARABEN/i),'kozmetik tarama: sonuç gelmedi');
        await p.close();
      }
      const {p,errs,istek}=await sayfa(ctx,B+'ocr.html');
      ok(await tara(p,'Gıda','İçindekiler: şeker, E102, E211, su.',/Tartrazin/),'gıda tarama: sonuç (Tartrazin) gelmedi');
      // Ölçüt 5: sonuç ekrandayken liste görünmez
      ok(!await gorunur(p.getByText(BASLIK,{exact:true}),800),'sonuç ekrandayken "'+BASLIK+'" listesi de görünüyor');

      // Ölçüt 6: yöntem bağlantısı → Geri
      const yontem=p.getByRole('link',{name:'Bu nasıl değerlendirildi?'});
      ok(await gorunur(yontem,3000),'sonuçta "Bu nasıl değerlendirildi?" bağlantısı görünmüyor');
      await yontem.first().click();
      await p.waitForLoadState('networkidle');
      ok(!/ocr\.html/.test(p.url()),'yöntem bağlantısı başka sayfaya gitmedi: '+p.url());
      await p.goBack();
      await yerles(p);
      ok(await gorunur(p.getByText(BASLIK,{exact:true}),5000),'Geri ile Etiket Oku\'ya dönünce "'+BASLIK+'" görünmüyor');
      await p.waitForTimeout(1500);
      ok(!await gorunur(p.getByText(/henüz yüklenmedi/i),300),'Geri ile dönüşte takılı kalmış "henüz yüklenmedi" yazısı görünüyor');
      // Ölçüt 1 ve 3: iki satır; en üstte gıda (en yeni), türü satırda yazılı
      const s=satirlar(p);
      ok(await s.count()===2,'iki taramadan sonra listede 2 satır beklenirken '+await s.count()+' satır var');
      if(await s.count()>0){
        const ust=await s.first().innerText();
        ok(/Gıda/.test(ust),'en üstteki satır (son tarama, gıda) türünü "Gıda" olarak yazmıyor: '+ust.replace(/\n/g,' ⏎ '));
        ok(/Kozmetik/.test(await s.last().innerText()),'alttaki satır (kozmetik tarama) türünü "Kozmetik" olarak yazmıyor');
      }
      // Ölçüt 9: liste görüntülenirken ve satıra dokunulurken dışarıya istek yok
      istek.length=0;
      // Ölçüt 4: alttaki satır (kozmetik) → sonuç açılır, tür seçici Kozmetik'e geçer
      const oncekiSay=await s.count();
      if(oncekiSay>0){
        await s.last().click();
        ok(await sonucBekle(p,/METHYLPARABEN/i),'kozmetik satırına dokununca o ürünün sonucu (METHYLPARABEN) açılmadı');
        ok(await p.getByRole('radio',{name:'Kozmetik'}).isChecked(),'kozmetik satırına dokununca tür seçici Kozmetik\'e geçmedi');
        ok(!await gorunur(p.getByText(BASLIK,{exact:true}),500),'satırdan açılan sonuç ekrandayken liste de görünüyor');
        await p.waitForTimeout(1200);
        ok(istek.length===0,'liste görüntülenirken / satıra dokununca dışarıya istek gitti: '+istek.join(' , '));
      }
      // Açılış yeni tarama sayılmaz: yeniden yüklenince satır sayısı ve sıra aynı (gıda hâlâ en üstte)
      await p.reload();await yerles(p);
      ok(await gorunur(p.getByText(BASLIK,{exact:true}),5000),'yeniden yüklemede "'+BASLIK+'" görünmüyor');
      ok(await s.count()===oncekiSay,'satırdan açmak liste uzunluğunu değiştirdi: '+oncekiSay+' → '+await s.count());
      if(await s.count()>0){
        ok(/Gıda/.test(await s.first().innerText()),'satırdan açılan kozmetik ürün yeni tarama sayılıp en üste çıktı');
        // Ölçüt 6 (yeniden yükleme yolu): en üstteki satır gıda sonucunu geri getirir, tür Gıda olur
        istek.length=0;
        await s.first().click();
        ok(await sonucBekle(p,/Tartrazin/),'yeniden yükleme sonrası en üstteki satır gıda sonucunu (Tartrazin) geri getirmedi');
        ok(await p.getByRole('radio',{name:'Gıda'}).isChecked(),'gıda satırına dokununca tür seçici Gıda\'ya geçmedi');
        await p.waitForTimeout(1200);
        ok(istek.length===0,'satıra dokununca dışarıya istek gitti: '+istek.join(' , '));
      }

      // Ölçüt 7: Kaydet ile ad verilen ürün listede o adla görünür
      ok(await tara(p,'Temizlik','İçindekiler: su, sabun.',/TEMİZLİK|Sabun/i),'temizlik tarama: sonuç gelmedi');
      await p.getByRole('button',{name:'Bu ürünü kaydet'}).click();
      const ad=p.getByLabel('Ürün adı');
      ok(await gorunur(ad,3000),'Kaydet formunda "Ürün adı" kutusu görünmüyor');
      await ad.first().fill('Kabul Sabunu');
      await p.getByRole('button',{name:'Kaydet',exact:true}).click();
      await p.waitForTimeout(800);
      await p.reload();await yerles(p);
      const kayitli=p.getByRole('button',{name:/Kabul Sabunu/});
      ok(await gorunur(kayitli,5000),'kaydedilen ad ("Kabul Sabunu") listede bir düğmenin adında görünmüyor');
      if(await kayitli.count()){
        ok(/Temizlik/.test(await kayitli.first().innerText()),'kaydedilen temizlik ürününün satırında tür ("Temizlik") yazmıyor');
        // Kaydedilen ürün en yeni tarama: en üstte
        const ilk=p.getByRole('button',{name:/Kabul Sabunu|Tarama \d+/}).first();
        ok(/Kabul Sabunu/.test((await ilk.getAttribute('aria-label'))||await ilk.innerText()),'en yeni tarama (kaydedilen) en üstte değil');
      }
      // Gizlilik: hiçbir dış istek ürün metnini ya da adını taşımadı
      ok(!istek.some(u=>/Kabul|sabun|E102|E211/i.test(decodeURIComponent(u))),'dışarıya giden bir istek ürün bilgisini taşıyor');
      ok(errs.length===0,'asıl senaryo: sayfa hatası: '+errs.join(' | '));
      await p.close();
    }finally{await ctx.close()}
  }

  // --- Bağlam 2: en çok 10, en yeni en üstte (12 farklı tarama) ---
  {
    const ctx=await br.newContext(opt);
    try{
      for(const [k,a] of ON_IKI){
        const {p}=await sayfa(ctx,B+'ocr.html');
        ok(await tara(p,'Gıda','İçindekiler: su, '+k+'.',madde(k,a)),'10 sınırı: '+k+' taraması sonuç vermedi');
        await p.close();
      }
      const {p,errs}=await sayfa(ctx,B+'ocr.html');
      await yerles(p);
      ok(await gorunur(p.getByText(BASLIK,{exact:true}),5000),'12 taramadan sonra "'+BASLIK+'" görünmüyor');
      const s=satirlar(p);
      const n=await s.count();
      ok(n===10,'12 farklı taramadan sonra listede 10 satır beklenirken '+n+' satır var');
      if(n>0){
        // En üstteki: son tarama (E415)
        await s.first().click();
        ok(await sonucBekle(p,madde('E415','Ksantan zamkı')),'en üstteki satır son taramayı (E415 Ksantan zamkı) açmadı');
        await p.reload();await yerles(p);
        // En alttaki: 3. tarama (E160a); 1. ve 2. (E100, E120) listede yok
        await s.last().click();
        const alt=await sonucBekle(p,/E\d+[a-z]? · /);
        const t=await sonuc(p);
        ok(alt&&madde('E160a','Karotenler').test(t),'en alttaki satır 3. taramayı (E160a Karotenler) açmadı: '+t.slice(0,120).replace(/\n/g,' ⏎ '));
        ok(!/E100 · Kurkumin|E120 · Karmin/.test(t),'en alttaki satır en eski taramalardan birini açtı; listede yalnızca son 10 olmalı');
        // Açılış yeni tarama sayılmaz: uzunluk 10, en üstte hâlâ E415
        await p.reload();await yerles(p);
        ok(await s.count()===10,'en alttaki satırı açmak liste uzunluğunu değiştirdi: '+await s.count());
        await s.first().click();
        ok(await sonucBekle(p,madde('E415','Ksantan zamkı')),'en alttaki satırı açmak onu en üste taşıdı (yeni tarama sayıldı)');
      }
      ok(errs.length===0,'10 sınırı: sayfa hatası: '+errs.join(' | '));
      await p.close();
    }finally{await ctx.close()}
  }

  // --- Bağlam 3: İngilizce başlık ---
  {
    const ctx=await br.newContext(opt);
    try{
      const {p:pp}=await sayfa(ctx,B+'ocr.html#profil');
      const dil=pp.getByLabel(/Dil · Language/);
      ok(await gorunur(dil,5000),'İngilizce: "Dil · Language" seçimi görünmüyor');
      await dil.first().selectOption({label:'English'});
      await pp.waitForTimeout(1500);
      await pp.close();
      {
        const {p}=await sayfa(ctx,B+'ocr.html');
        await yerles(p);
        ok(!await gorunur(p.getByText(BASLIK_EN,{exact:true}),500),'İngilizce: hiç tarama yokken "'+BASLIK_EN+'" görünüyor');
        ok(await tara(p,'Food','Ingredients: sugar, E102, water.',/Tartrazine|E102/i,true),'İngilizce: gıda taraması sonuç vermedi');
        await p.close();
      }
      const {p,errs}=await sayfa(ctx,B+'ocr.html');
      await yerles(p);
      ok(await gorunur(p.getByText(BASLIK_EN,{exact:true}),5000),'İngilizce arayüzde "'+BASLIK_EN+'" başlığı görünmüyor');
      ok(!await gorunur(p.getByText(BASLIK,{exact:true}),300),'İngilizce arayüzde Türkçe "'+BASLIK+'" başlığı görünüyor');
      const s=p.getByRole('button',{name:/Scan \d+/});
      ok(await s.count()===1,'İngilizce: listede "Scan N" adlı 1 satır beklenirken '+await s.count()+' var');
      if(await s.count())ok(/Food/.test(await s.first().innerText()),'İngilizce: satırda tür "Food" yazmıyor');
      ok(errs.length===0,'İngilizce: sayfa hatası: '+errs.join(' | '));
      await p.close();
    }finally{await ctx.close()}
  }
};
