// Kabul testi (yol haritası E-01): herkese açık yöntem sayfası. Renk ölçütleri (K1–K7, K4b), renk vermediğimiz durumlar
// (şüpheli değer, 100 g / 100 ml belirsizliği, az miktarda tüketilen ürün tipleri — AB 1169/2011 Ek V —, bebek gıdası),
// eşik kaynağı, kaynak öncelik sırası, neden puan vermediğimiz, teşhis koymadığımız, bağımsızlık. Türkçe ve İngilizce
// yayında; Etiket Oku sonucundan ("Bu nasıl değerlendirildi?") ve Profilim'den ("Yöntem") ulaşılır.
//
// Kullanıcı yolu:
//  1) yontem.html açılır: h1 "Yöntem", alt menü (Ansiklopedi, Etiket Oku, Profilim), sekiz bölüm başlığı (h2), her
//     bölümde istenen içerik; sayfanın hiçbir yerinde onay sözcüğü ("güvenli/uygun/zararsız") yok (guvenli_demez.js kuralı).
//  2) Etiket Oku: Gıda, Kozmetik, Temizlik'te "Örnek metin dene"; Gıda'da ayrıca "Okunan Metin" kutusuna metin yazılır.
//     Her sonuçta "Bu nasıl değerlendirildi?" bağlantısı görünür; tıklanınca yontem.html açılır, h1 "Yöntem".
//  3) Profilim'de "Yöntem" bağlantısı aynı sayfayı açar.
//  4) Profilim > Dil · Language > English: yontem.html İngilizce başlıklarla açılır, Türkçe harf (ğ ı ş İ) geçmez;
//     sonuçtaki bağlantı "How was this assessed?", Profilim'deki "Method".
// Bölüm içeriği, sayfanın görünen metninde o bölümün başlığından bir sonraki bölüm başlığına kadar olan kısımdan okunur.
// Başlık satırı büyük/küçük harf duyarsız eşlenir (CSS büyük harfe çevirse de bulunsun).
const {ac,gorunur}=require('./_ortak.js');

const BOLUMLER={
  tr:['Ne Yapıyoruz, Ne Yapmıyoruz','Gıdada Renkler','Kozmetikte Renkler','Temizlikte Renkler','Besin Değerleri',
      'Kaynaklar ve Öncelik Sırası','Neden puan vermiyoruz?','Bağımsızlık'],
  en:["What We Do and Don't Do",'Colours in Food','Colours in Cosmetics','Colours in Cleaning Products','Nutrition Values',
      'Sources and Priority',"Why don't we give a score?",'Independence'],
};
const DIL={
  tr:{h1:'Yöntem',nav:['Ansiklopedi','Etiket Oku','Profilim'],profil:'Profilim',yontemBag:'Yöntem',
      turler:['Gıda','Kozmetik','Temizlik'],ornek:'Örnek metin dene',sonucBag:'Bu nasıl değerlendirildi?',kucuk:'tr'},
  en:{h1:'Method',nav:['Encyclopedia','Read Label','My Profile'],profil:'My Profile',yontemBag:'Method',
      turler:['Food','Cosmetics','Cleaning'],ornek:'Try sample text',sonucBag:'How was this assessed?',kucuk:'en'},
};

// Onay anlamında sözcükler (guvenli_demez.js ile aynı kural; İngilizce karşılıkları da)
const ONAY_TR=/(?<!\p{L})(güvenli(?:dir)?|güvenle|zararsız(?:dır)?|uygun(?:dur)?)(?!\p{L})(?!\s+(?:değil|olduğu anlamına gelmez|olmayabilir))/iu;
const ONAY_EN=/(?<!\p{L})(safe|safely|harmless|suitable)(?!\p{L})/iu;

// Gıda ölçütleri: kod ve kısa açıklamasında geçmesi gereken sözcükler (kodun ardından gelen ~300 karakterde aranır)
const OLCUT={
  tr:{K1:[/AB/,/yasak|listede (yok|bulunma)/i],K2:[/Southampton/],K3:[/ABD/,/yasak/i],K4:[/IARC/],K4b:[/\p{L}{3,}/u],
      K5:[/alerjen/i,/fenilalanin/i,/laksatif/i],K6:[/EFSA/,/ADI|günlük/i],K7:[/üreme/i]},
  en:{K1:[/EU/,/ban|not (on the|listed|authori[sz]ed)/i],K2:[/Southampton/],K3:[/US|United States/,/ban/i],K4:[/IARC/],
      K4b:[/\p{L}{3,}/u],K5:[/allergen/i,/phenylalanine/i,/laxative/i],K6:[/EFSA/,/ADI|daily/i],K7:[/reproduct/i]},
};

const kodRe=k=>new RegExp('(?<![\\p{L}\\d])'+k+'(?![\\p{L}\\d])','u');

// Görünen metni bölümlere ayırır: {başlık: metin}. Başlık satırı bulunamazsa o bölüm undefined kalır.
function bolumle(metin,basliklar,kucuk){
  const satirlar=metin.split('\n'),norm=s=>s.trim().toLocaleLowerCase(kucuk);
  const yer=basliklar.map(b=>satirlar.findIndex(l=>norm(l)===norm(b)));
  const out={};
  basliklar.forEach((b,i)=>{
    if(yer[i]<0)return;
    const sonraki=yer.filter(y=>y>yer[i]).sort((a,c)=>a-c)[0];
    out[b]=satirlar.slice(yer[i]+1,sonraki===undefined?undefined:sonraki).join('\n');
  });
  return out;
}

// Cümle içinde birlikte geçme: bir cümlede bütün desenler varsa true
const cumledeBirlikte=(metin,desenler)=>metin.split(/[.!?\n]+/).some(c=>desenler.every(d=>d.test(c)));

// Yöntem sayfasının içeriğini denetler (p: açık yontem.html)
async function sayfayiDenetle(p,errs,ok,dil){
  const d=DIL[dil],E=dil+' yöntem';
  ok(/yontem\.html/.test(p.url()),E+': adres yontem.html değil: '+p.url());
  ok(await gorunur(p.getByRole('heading',{level:1,name:d.h1,exact:true})),E+': h1 "'+d.h1+'" görünmüyor');
  for(const n of d.nav)ok(await gorunur(p.getByRole('link',{name:n,exact:true}),3000),E+': alt menüde "'+n+'" bağlantısı görünmüyor');
  for(const b of BOLUMLER[dil])
    ok(await gorunur(p.getByRole('heading',{level:2,name:b,exact:true}),3000),E+': h2 "'+b+'" görünmüyor');

  const metin=await p.locator('body').innerText();
  const B=bolumle(metin,BOLUMLER[dil],d.kucuk),bol=i=>B[BOLUMLER[dil][i]]||'';
  const var_=(s,re,ne)=>ok(re.test(s),E+': '+ne);

  // Onay sözcüğü hiçbir yerde yok
  const m=(dil==='tr'?metin.toLocaleLowerCase('tr').match(ONAY_TR):metin.match(ONAY_EN));
  ok(!m,E+': sayfada onay anlamında "'+(m&&m[0])+'" geçiyor');

  if(dil==='tr'){
    const s0=bol(0);
    var_(s0,/teşhis/i,'"Ne Yapıyoruz" bölümü teşhis koymadığımızı söylemiyor');
    var_(s0,/puan/i,'"Ne Yapıyoruz" bölümü puan vermediğimizi söylemiyor');
    var_(s0,/bulunamad/i,'"Ne Yapıyoruz" bölümünde "bulunamadı" yok');
    var_(s0,/onay değildir/i,'"Ne Yapıyoruz" bölümünde "bu bir onay değildir" yok');
  }else{
    const s0=bol(0);
    var_(s0,/diagnos/i,'"What We Do" bölümü teşhis (diagnosis) koymadığımızı söylemiyor');
    var_(s0,/score/i,'"What We Do" bölümü puan (score) vermediğimizi söylemiyor');
    var_(s0,/not found/i,'"What We Do" bölümünde "not found" yok');
    var_(s0,/not (an )?approval/i,'"What We Do" bölümünde "not an approval" yok');
  }

  // Gıdada renkler: her ölçüt kodu ve kısa açıklaması
  const gida=bol(1);
  ok(gida.length>0,E+': "'+BOLUMLER[dil][1]+'" bölümü boş ya da bulunamadı');
  for(const [k,desenler] of Object.entries(OLCUT[dil])){
    const i=gida.search(kodRe(k));
    ok(i>=0,E+': gıda ölçütü '+k+' yazılmamış');
    if(i<0)continue;
    const pencere=gida.slice(i+k.length,i+k.length+300);
    for(const re of desenler)ok(re.test(pencere),E+': '+k+' açıklamasında '+re+' yok: '+pencere.slice(0,120).replace(/\n/g,' / '));
  }
  // Kırmızı "yasak" demek değildir
  ok(dil==='tr'?cumledeBirlikte(metin,[/kırmızı/i,/yasak/i,/değil|gelmez/i])
               :cumledeBirlikte(metin,[/red/i,/ban/i,/not|n't/i]),
     E+': kırmızının "yasak" demek olmadığı söylenmiyor');
  ok(bol(2).trim().length>0,E+': "'+BOLUMLER[dil][2]+'" bölümü boş');
  ok(bol(3).trim().length>0,E+': "'+BOLUMLER[dil][3]+'" bölümü boş');

  // Besin değerleri: renk göstermediğimiz durumlar ve eşik kaynağı
  const besin=bol(4);
  const BESIN=dil==='tr'
    ?[[/tutarsız|şüpheli/i,'tutarsız/şüpheli değer'],[/100 ?g/,'100 g'],[/100 ?ml/,'100 ml'],[/baharat/i,'baharat'],[/tuz/i,'tuz'],
      [/sirke/i,'sirke'],[/sakız/i,'sakız'],[/çay/i,'çay'],[/kahve/i,'kahve'],[/1169\/2011/,'AB 1169/2011'],[/Ek V(?![IVX])/,'Ek V'],
      [/bebek/i,'bebek gıdası'],[/Birleşik Krallık/,'Birleşik Krallık (eşik kaynağı)'],[/2016/,'2016 kılavuzu']]
    :[[/inconsistent|implausib|suspicious|doubtful/i,'inconsistent/suspicious values'],[/100 ?g/,'100 g'],[/100 ?ml/,'100 ml'],
      [/spice/i,'spices'],[/salt/i,'salt'],[/vinegar/i,'vinegar'],[/chewing gum|gum/i,'chewing gum'],[/tea/i,'tea'],[/coffee/i,'coffee'],
      [/1169\/2011/,'EU 1169/2011'],[/Annex V(?![IVX])/,'Annex V'],[/infant|baby/i,'baby food'],[/United Kingdom|UK/,'United Kingdom (threshold source)'],
      [/2016/,'2016 guidance']];
  for(const [re,ne] of BESIN)var_(besin,re,'besin değerleri bölümünde "'+ne+'" yok');

  // Kaynak öncelik sırası: resmi mevzuat → resmi kurum görüşleri → hakemli yayın → sanayi destekli (işaretlenerek)
  const kay=bol(5);
  for(const k of ['EFSA','JECFA','SCCS','ECHA','IARC'])var_(kay,new RegExp(k),'kaynaklar bölümünde '+k+' yok');
  const sira=dil==='tr'?[/mevzuat/i,/EFSA/,/hakemli/i,/sanayi/i]:[/legislation|regulation|law/i,/EFSA/,/peer[- ]reviewed/i,/industry/i];
  const yerler=sira.map(re=>kay.search(re));
  ok(yerler.every(y=>y>=0),E+': kaynak sırasındaki adımlardan biri yok ('+sira.filter((r,i)=>yerler[i]<0).join(', ')+')');
  ok(yerler.every((y,i)=>i===0||y>yerler[i-1]),E+': kaynak öncelik sırası mevzuat → resmi kurum → hakemli → sanayi değil');
  var_(kay,dil==='tr'?/işaret/i:/flag|mark|label/i,'sanayi destekli değerlendirmenin işaretlendiği söylenmiyor');

  // Neden puan vermiyoruz
  var_(bol(6),/\p{L}{3,}/u,'"'+BOLUMLER[dil][6]+'" bölümü boş');

  // Bağımsızlık
  const bag=bol(7);
  if(dil==='tr'){
    var_(bag,/marka/i,'bağımsızlık bölümünde "marka" yok');
    var_(bag,/para|ücret/i,'bağımsızlık bölümünde markadan para almadığımız yok');
    var_(bag,/reklam/i,'bağımsızlık bölümünde reklam olmadığı yok');
    var_(bag,/sıralama/i,'bağımsızlık bölümünde ücretli sıralama olmadığı yok');
  }else{
    var_(bag,/brand/i,'bağımsızlık bölümünde "brand" yok');
    var_(bag,/money|pay|paid/i,'bağımsızlık bölümünde markadan para almadığımız yok');
    var_(bag,/advert/i,'bağımsızlık bölümünde reklam olmadığı yok');
    var_(bag,/rank|placement|order/i,'bağımsızlık bölümünde ücretli sıralama olmadığı yok');
  }

  if(dil==='en'){
    const tr=metin.match(/[^\n]*[ğışİĞŞ][^\n]*/);
    ok(!tr,E+': İngilizce sayfada Türkçe harf geçiyor: '+(tr&&tr[0].slice(0,120)));
  }
  ok(errs.length===0,E+': sayfa hatası: '+errs.join(' | '));
}

// Bağlantıya basar; aynı sekmede ya da yeni sekmede açılan sayfayı döner
async function tiklaAc(ctx,p,bag){
  const yeni=ctx.waitForEvent('page',{timeout:3000}).catch(()=>null);
  await bag.click();
  const q=(await yeni)||p;
  await q.waitForLoadState('networkidle');
  return q;
}

// Etiket Oku ve Profilim'den yöntem sayfasına ulaşma
async function ulasim(ctx,B,ok,dil){
  const d=DIL[dil];
  for(const [i,tur] of d.turler.entries()){
    const {p,errs}=await ac(ctx,B+'ocr.html');
    const E=dil+' '+tur;
    ok(await gorunur(p.getByRole('radio',{name:tur})),E+': ürün türü seçeneği görünmüyor');
    await p.getByRole('radio',{name:tur}).click();
    await p.getByRole('button',{name:d.ornek}).click();
    const bag=p.getByRole('link',{name:d.sonucBag});
    ok(await gorunur(bag,8000),E+' örnek: sonuçta "'+d.sonucBag+'" bağlantısı görünmüyor');
    // Gıda'da: kendi yazılan metinle de bağlantı görünür, ve bağlantı yöntem sayfasını açar
    if(i===0&&dil==='tr'){
      await p.getByText('Okunan Metin',{exact:true}).click();
      const kutu=p.getByPlaceholder(/Okunan metin burada görünür/);
      ok(await gorunur(kutu,3000),E+': metin kutusu açılmadı');
      await kutu.fill('İçindekiler: şeker, tartrazin, aspartam.');
      await p.waitForTimeout(1200);
      ok(await gorunur(bag,8000),E+' kendi metni: sonuçta "'+d.sonucBag+'" bağlantısı görünmüyor');
    }
    if(i===0&&await gorunur(bag,1000)){
      const q=await tiklaAc(ctx,p,bag.first());
      ok(/yontem\.html/.test(q.url()),E+': bağlantı yontem.html açmadı: '+q.url());
      ok(await gorunur(q.getByRole('heading',{level:1,name:d.h1,exact:true})),E+': bağlantıdan açılan sayfada h1 "'+d.h1+'" yok');
      if(q!==p)await q.close();
    }
    ok(errs.length===0,E+': sayfa hatası: '+errs.join(' | '));
    await p.close();
  }
  // Profilim > Yöntem
  const {p,errs}=await ac(ctx,B+'ocr.html');
  await p.getByRole('link',{name:d.profil,exact:true}).click();
  await p.waitForTimeout(600);
  const yb=p.getByRole('link',{name:d.yontemBag,exact:true});
  ok(await gorunur(yb,5000),dil+' Profilim: "'+d.yontemBag+'" bağlantısı görünmüyor');
  if(await gorunur(yb,500)){
    const q=await tiklaAc(ctx,p,yb.first());
    ok(/yontem\.html/.test(q.url()),dil+' Profilim: bağlantı yontem.html açmadı: '+q.url());
    ok(await gorunur(q.getByRole('heading',{level:1,name:d.h1,exact:true})),dil+' Profilim: açılan sayfada h1 "'+d.h1+'" yok');
    if(q!==p)await q.close();
  }
  ok(errs.length===0,dil+' Profilim: sayfa hatası: '+errs.join(' | '));
  await p.close();
}

module.exports=async({br,B,opt,ok})=>{
  // Türkçe
  {
    const ctx=await br.newContext(opt);
    try{
      const {p,errs}=await ac(ctx,B+'yontem.html');
      await sayfayiDenetle(p,errs,ok,'tr');
      await p.close();
      await ulasim(ctx,B,ok,'tr');
    }finally{await ctx.close()}
  }
  // İngilizce: Profilim > Dil · Language > English (sayfa yeniden yüklenir), sonra yöntem sayfası
  {
    const ctx=await br.newContext(opt);
    try{
      const {p,errs}=await ac(ctx,B+'ocr.html');
      await p.getByRole('link',{name:'Profilim',exact:true}).click();
      const dil=p.getByRole('combobox',{name:/Language/});
      ok(await gorunur(dil),'en: dil seçimi görünmüyor');
      await Promise.all([p.waitForEvent('load',{timeout:8000}).catch(()=>null),dil.selectOption({label:'English'})]);
      await p.waitForLoadState('networkidle');
      ok(await gorunur(p.getByRole('link',{name:'My Profile',exact:true})),'en: dil İngilizceye geçmedi');
      ok(errs.length===0,'en dil seçimi: sayfa hatası: '+errs.join(' | '));
      await p.close();
      const y=await ac(ctx,B+'yontem.html');
      await sayfayiDenetle(y.p,y.errs,ok,'en');
      await y.p.close();
      await ulasim(ctx,B,ok,'en');
    }finally{await ctx.close()}
  }
};
