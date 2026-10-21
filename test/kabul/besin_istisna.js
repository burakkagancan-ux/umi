// Kabul testi: A-08, besin değerlerinde ürün tipi istisnası (kullanıcının onayladığı iş).
// İstenen davranış: az miktarda tüketilen ürün tiplerinde (baharat, tuz, sirke, sakız), kuru ürünü tartılan kahve ve
// çayda, bebek gıdasında "Besin Değerleri" kartı değerleri yine gösterir ama hiçbir satırda düzey etiketi
// (Düşük/Orta/Yüksek; İngilizcede Low/Medium/High) görünmez ve nedeni yazılır. Tip bilinmiyorsa bugünkü davranış sürer.
//
// Kullanıcı yolu: Etiket Oku > Gıda > "Okunan Metin" açılır, kutuya içerik listesi ve 100 g'lık besin tablosu yazılır;
// "Besin Değerleri" kartının görünen metni okunur (başlığından sonraki karta / alt bilgiye kadar).
// Barkod yolu: "Barkod okut" > "Barkod numarası" kutusuna 8699118059905 yazılıp "Ara" (ürün uygulamadaki çevrimdışı
// barkod verisinden gelir; Worker'a giden istek _ortak.js'te kapalıdır).
// İngilizce yol: Profilim > "Dil · Language" seçiminde English; aynı yol İngilizce etiketlerle izlenir.
//
// Neden metinlerinin yalnızca ayırt edici parçası aranır: "renk gösterilmez" (+ tip adı, AB 1169/2011),
// "kuru ürün" (kahve/çay), "ayrı mevzuat" (bebek gıdası). İngilizce metin bilinmediği için orada neden satırı,
// istisna kartında olup olumsuz durumun kartında olmayan uzun bir satır olarak aranır.
// Değerler bugünkü denetimin ("okunan değerler tutarlı görünmüyor") devreye girmeyeceği biçimde seçildi
// (enerji ≈ 9×yağ + 4×karbonhidrat + 4×protein), yoksa düzey etiketi istisna yüzünden değil şüphe yüzünden kaybolurdu.
const {ac,gorunur}=require('./_ortak.js');

const tablo=(kcal,yag,doy,karb,sek,pro,tuz,birim)=>'\nBesin değerleri '+(birim||'100 g')+' için\nEnerji '+kcal+' kcal\nYağ '+yag+
  ' g\nDoymuş yağ '+doy+' g\nKarbonhidrat '+karb+' g\nŞekerler '+sek+' g\nProtein '+pro+' g\nTuz '+tuz+' g';

// İstisna durumları: ad, metin, görünmesi gereken değer, neden deseni(leri)
const ISTISNA=[
  {ad:'baharat',metin:'İçindekiler: Kimyon, karabiber, pul biber.'+tablo(343,15,2,40,8,12,'0,1'),
   deger:[/(^|\n)15 g/,/(^|\n)2 g/,/(^|\n)8 g/,/0,1 g/],neden:[/renk gösterilmez/i,/baharat/i,/1169\/2011/]},
  {ad:'tuz',metin:'İçindekiler: İyotlu tuz (potasyum iyodat).'+tablo(0,0,0,0,0,0,99),
   deger:[/99 g/],neden:[/renk gösterilmez/i,/tuz\)/i,/1169\/2011/]},
  {ad:'sirke',metin:'İçindekiler: Üzüm sirkesi.'+tablo(3,0,0,'0,6','0,4',0,'0,1'),
   deger:[/0,4 g/],neden:[/renk gösterilmez/i,/sirke/i,/1169\/2011/]},
  {ad:'sakız',metin:'İçindekiler: Tatlandırıcılar (sorbitol, maltitol), sakız mayası, aroma vericiler, nemlendirici (gliserol).'+tablo(265,'0,5','0,4',65,0,0,'0,1'),
   deger:[/0,5 g/],neden:[/renk gösterilmez/i,/sakız/i,/1169\/2011/]},
  {ad:'çay',metin:'İçindekiler: Siyah çay.'+tablo(298,2,'0,5',50,1,20,'0,1'),
   deger:[/(^|\n)2 g/],neden:[/kuru ürün/i]},
  {ad:'kahve',metin:'İçindekiler: %100 Arabica kahve.'+tablo(293,13,5,30,4,14,'0,1'),
   deger:[/13 g/],neden:[/kuru ürün/i]},
  {ad:'bebek gıdası',metin:'6. aydan itibaren.\nİçindekiler: Pirinç unu, süt tozu, şeker, bitkisel yağlar, vitaminler.'+tablo(418,10,4,70,25,12,'0,3'),
   deger:[/10 g/,/25 g/],neden:[/ayrı mevzuat/i,/609\/2013/]},
];

// Olumsuz durumlar: bugünkü davranış sürer, düzey etiketi görünür ve istisna nedeni görünmez
const OLUMSUZ=[
  // Şekerler 25 g: İngiltere eşiğinde yüksek > 22,5 g (22 g orta kalırdı)
  {ad:'ketçap (sirke ve baharat var ama tek başına değil)',metin:'İçindekiler: Domates, şeker, sirke, tuz, baharat.'+tablo(116,'0,1',0,27,25,'1,2','1,8'),
   duzey:/(^|\s)Yüksek$/m},
  {ad:'tuzlu fıstık',metin:'İçindekiler: Yer fıstığı, tuz.'+tablo(594,50,7,10,4,26,'1,2'),duzey:/(^|\s)Yüksek$/m},
  {ad:'hazır kahve içeceği (kahve var, başka bileşen de var)',metin:'İçindekiler: Su, kahve, şeker, süt tozu.'+tablo(56,'1,5',1,9,8,'1,5','0,1','100 ml'),
   duzey:/(^|\s)(Düşük|Orta|Yüksek)$/m},
  {ad:'bal (bebek uyarısı bebek gıdası değil)',metin:'İçindekiler: Çiçek balı.\n1 yaşından küçük bebeklere verilmemelidir.'+tablo(329,0,0,82,82,'0,3','0,1'),
   duzey:/(^|\s)Yüksek$/m},
];

const DUZEY_TR=/(^|\s)(Düşük|Orta|Yüksek)$/m;
const DUZEY_EN=/(^|\s)(Low|Medium|High)$/m;
const NEDEN_HEPSI=/renk gösterilmez|kuru ürün|ayrı mevzuat/i;

// "Besin Değerleri" / "Nutrition" kartının görünen metni: başlıktan sonraki karta ya da alt bilgiye kadar
async function kart(p){
  const t=await p.locator('body').innerText();
  const m=t.match(/\n(Besin Değerleri|Nutrition)( \([^)\n]*\))?\n/);
  if(!m)return '';
  const s=t.slice(m.index+1);
  const j=s.search(/\n(Okunan Diğer İçerik|Other Ingredients Read|Sonuçlar yalnızca|Results are based|Deneme Sürümü|Trial Version)/);
  return j<0?s:s.slice(0,j);
}
// Kart görünene dek bekler (en çok ~8 sn), sonra yerleşmesi için kısa bir süre daha
async function kartBekle(p){
  for(let k=0;k<40;k++){if(/Yağ|Fat/.test(await kart(p)))break;await p.waitForTimeout(200)}
  await p.waitForTimeout(600);
  return kart(p);
}
async function metinle(ctx,B,metin,dil){
  const en=dil==='en';
  const {p,errs}=await ac(ctx,B+'ocr.html');
  await p.getByRole('radio',{name:en?'Food':'Gıda'}).click();
  await p.getByText(en?'Text Read':'Okunan Metin',{exact:true}).click();
  await p.getByPlaceholder(en?/The text that was read appears here/:/Okunan metin burada görünür/).fill(metin);
  return {p,errs,k:await kartBekle(p)};
}

module.exports=async({br,B,opt,ok})=>{
  const ctx=await br.newContext(opt);
  try{
    // Ölçüt 1 ve 2: istisna tipleri
    for(const d of ISTISNA){
      const {p,errs,k}=await metinle(ctx,B,d.metin);
      ok(k.length>0,d.ad+': Besin Değerleri kartı görünmedi');
      for(const ad of ['Yağ','Doymuş yağ','Şekerler','Tuz'])ok(new RegExp('(^|\\n)'+ad+'\\n').test(k),d.ad+': kartta "'+ad+'" satırı yok');
      for(const v of d.deger)ok(v.test(k),d.ad+': kartta değer görünmüyor ('+v+')');
      const dz=k.match(DUZEY_TR);
      ok(!dz,d.ad+': kartta düzey etiketi görünüyor ("'+(dz&&dz[2])+'"); bu ürün tipinde renk/düzey gösterilmemeli');
      for(const n of d.neden)ok(n.test(k),d.ad+': kartta istisna nedeni görünmüyor ('+n+')');
      ok(errs.length===0,d.ad+': sayfa hatası: '+errs.join(' | '));
      await p.close();
    }

    // Ölçüt 3: olumsuz durumlar, bugünkü davranış
    for(const d of OLUMSUZ){
      const {p,errs,k}=await metinle(ctx,B,d.metin);
      ok(k.length>0,d.ad+': Besin Değerleri kartı görünmedi');
      ok(d.duzey.test(k),d.ad+': beklenen düzey etiketi görünmüyor ('+d.duzey+'); bu ürün istisna sayılmamalı. Kart: '+k.replace(/\n/g,' ⏎ ').slice(0,200));
      const n=k.match(NEDEN_HEPSI);
      ok(!n,d.ad+': kartta istisna nedeni görünüyor ("'+(n&&n[0])+'"); bu ürün istisna sayılmamalı');
      ok(errs.length===0,d.ad+': sayfa hatası: '+errs.join(' | '));
      await p.close();
    }

    // Ölçüt 4: barkod yolu (çevrimdışı barkod verisi; OFF kategorisi baharat)
    {
      const {p,errs}=await ac(ctx,B+'ocr.html');
      await p.getByRole('radio',{name:'Gıda'}).click();
      await p.getByRole('button',{name:'Barkod okut'}).click();
      const kutu=p.getByLabel('Barkod numarası');
      ok(await gorunur(kutu,3000),'barkod: "Barkod numarası" kutusu görünmüyor');
      await kutu.first().fill('8699118059905');
      await p.getByRole('button',{name:'Ara'}).click();
      ok(await gorunur(p.getByText(/Ürün bulundu \(8699118059905\)/),8000),'barkod: 8699118059905 bulunamadı (çevrimdışı barkod verisi)');
      const k=await kartBekle(p);
      ok(k.length>0,'barkod: Besin Değerleri kartı görünmedi');
      ok(/(^|\n)Yağ\n/.test(k)&&/(^|\n)Tuz\n/.test(k),'barkod: kartta değer satırları görünmüyor');
      const dz=k.match(DUZEY_TR);
      ok(!dz,'barkod 8699118059905 (baharat): kartta düzey etiketi görünüyor ("'+(dz&&dz[2])+'")');
      ok(/renk gösterilmez/i.test(k),'barkod 8699118059905 (baharat): kartta istisna nedeni ("renk gösterilmez") görünmüyor');
      ok(errs.length===0,'barkod: sayfa hatası: '+errs.join(' | '));
      await p.close();
    }

    // Ölçüt 5: İngilizce arayüz
    {
      const {p}=await ac(ctx,B+'ocr.html#profil');
      const dil=p.getByLabel(/Dil · Language/);
      ok(await gorunur(dil,5000),'İngilizce: "Dil · Language" seçimi görünmüyor');
      await dil.first().selectOption({label:'English'});
      await p.waitForTimeout(1500);
      await p.close();
      const ENT=(kcal,yag,doy,karb,sek,pro,tuz)=>'\nNutrition per 100 g\nEnergy '+kcal+' kcal\nFat '+yag+' g\nof which saturates '+doy+
        ' g\nCarbohydrate '+karb+' g\nof which sugars '+sek+' g\nProtein '+pro+' g\nSalt '+tuz+' g';
      const ol=await metinle(ctx,B,'Ingredients: Peanuts, salt.'+ENT(594,50,7,10,4,26,'1.2'),'en');
      ok(DUZEY_EN.test(ol.k),'İngilizce olumsuz durum (tuzlu fıstık): Low/Medium/High görünmüyor; karşılaştırma tabanı kurulamadı. Kart: '+ol.k.replace(/\n/g,' ⏎ ').slice(0,200));
      const is=await metinle(ctx,B,'Ingredients: Cumin, black pepper, chilli flakes.'+ENT(343,15,2,40,8,12,'0.1'),'en');
      ok(is.k.length>0&&/(^|\n)Fat\n/.test(is.k),'İngilizce istisna (baharat): Nutrition kartı ya da Fat satırı görünmüyor');
      ok(/15 g/.test(is.k),'İngilizce istisna (baharat): değer (15 g) görünmüyor');
      const dz=is.k.match(DUZEY_EN);
      ok(!dz,'İngilizce istisna (baharat): kartta düzey etiketi görünüyor ("'+(dz&&dz[2])+'")');
      // Neden satırı: istisna kartında olup olumsuz kartta olmayan, "Source:" ile başlamayan uzun bir satır
      const olSatir=new Set(ol.k.split('\n').map(s=>s.trim()));
      const yeni=is.k.split('\n').map(s=>s.trim()).filter(s=>s.length>30&&!olSatir.has(s)&&!/^Source:/.test(s));
      ok(yeni.length>0,'İngilizce istisna (baharat): kartta olumsuz durumda olmayan bir neden satırı görünmüyor');
      ok(!NEDEN_HEPSI.test(is.k),'İngilizce istisna (baharat): neden Türkçe yazılmış');
      ok(!/[ğışİ]/.test(yeni.join(' ')),'İngilizce istisna (baharat): neden satırında Türkçe harf var: '+yeni.join(' | '));
      ok(is.errs.length===0&&ol.errs.length===0,'İngilizce: sayfa hatası: '+is.errs.concat(ol.errs).join(' | '));
      await is.p.close();await ol.p.close();
    }
  }finally{await ctx.close()}
};
