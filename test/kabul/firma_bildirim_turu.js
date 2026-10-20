// Kabul testi: temizlik maddelerinde sınıf bilgisinin hangi ECHA bildiriminden geldiği doğru yazılır.
// AB'de uyumlaştırılmış sınıflandırması olmayan bir maddede ansiklopedi, sınıfın ECHA'daki öne çıkan bildirimden
// geldiğini söyler. Trisodyum MGDA'da (CAS 164462-16-2) öne çıkan bildirim REACH ortak bildirimi değil, firmaların CLP
// bildirimidir: sayfa "ortak bildirim" demez, "CLP bildirimi" der ve oranı (%66,1) gösterir. Sodyum Bikarbonat'ta
// (CAS 144-55-8) gerçekten REACH ortak bildirimidir: "ortak bildirim" ve %99,0 kalır.
// İngilizcede MGDA "joint notification" demez, "CLP notification" der ve metin çevrilmemiş olarak işaretlenmez
// (i18n/en.json veri.cevrilmedi: "not yet translated"; aria: "This text has not yet been translated …").
//
// Kullanıcı yolu: ansiklopedi.html açılır, ürün türü olarak Temizlik/Cleaning seçilir, arama kutusuna CAS yazılır,
// sonuç bağlantısına basılır; maddenin her sekmesi (Genel, Otoriteler, Kaynaklar) açılıp görünen metin toplanır.
const {ac,gorunur}=require('./_ortak.js');

const DIL={
  tr:{locale:'tr-TR',tur:'Temizlik',ara:'Madde ara',sekmeler:['Genel','Otoriteler','Kaynaklar']},
  en:{locale:'en-US',tur:'Cleaning',ara:'Search substances',sekmeler:['General','Authorities','Sources']},
};

// Maddenin sayfasını açar, bütün sekmelerin görünen metnini birleştirip döner. Döner: {metin, errs, cevrilmemis, ctx}
async function maddeSayfasi(br,B,opt,ok,dil,cas,ad){
  const d=DIL[dil];
  const ctx=await br.newContext({...opt,locale:d.locale});
  const {p,errs}=await ac(ctx,B+'ansiklopedi.html');
  const etiket=dil+' '+ad;
  ok(await gorunur(p.getByRole('radio',{name:d.tur})),etiket+': "'+d.tur+'" türü seçeneği görünmüyor');
  await p.getByRole('radio',{name:d.tur}).click();
  const kutu=p.getByRole('searchbox',{name:d.ara});
  ok(await gorunur(kutu),etiket+': arama kutusu görünmüyor');
  await kutu.fill(cas);
  const bag=p.getByRole('link',{name:new RegExp(cas.replace(/[-]/g,'\\-'))}).first();
  ok(await gorunur(bag),etiket+': aramada '+cas+' sonucu çıkmadı');
  await bag.click();
  await p.waitForLoadState('networkidle');
  ok(await gorunur(p.getByRole('tab',{name:d.sekmeler[0]})),etiket+': madde sayfası açılmadı (sekmeler yok)');
  let metin='',cevrilmemis=0;
  for(const s of d.sekmeler){
    const sekme=p.getByRole('tab',{name:s});
    ok(await gorunur(sekme,3000),etiket+': "'+s+'" sekmesi görünmüyor');
    await sekme.click();
    await p.waitForTimeout(300);
    metin+='\n'+await p.locator('body').innerText();
    // Çevrilmemiş işaretinin aria etiketi (en.json veri.cevrilmedi_aria); her sekmede ayrı sayılır
    cevrilmemis+=await p.getByLabel(/has not yet been translated/i).count();
  }
  return {metin,errs,cevrilmemis,ctx};
}

module.exports=async({br,B,opt,ok})=>{
  // 1) Türkçe, Trisodyum MGDA: "ortak bildirim" yok; "CLP bildirimi" ve %66,1 var
  {
    const {metin,errs,ctx}=await maddeSayfasi(br,B,opt,ok,'tr','164462-16-2','Trisodyum MGDA');
    try{
      ok(/Trisodyum MGDA/.test(metin),'tr MGDA: madde sayfası açılmadı');
      ok(!/ortak bildirim/i.test(metin),'tr MGDA: sayfada "ortak bildirim" geçiyor; öne çıkan bildirim REACH ortak bildirimi değil, CLP bildirimi: '+(metin.match(/[^\n]*ortak bildirim[^\n]*/i)||[''])[0]);
      ok(/CLP bildirimi/i.test(metin),'tr MGDA: sayfada "CLP bildirimi" geçmiyor');
      ok(/%66,1/.test(metin),'tr MGDA: bildirim oranı "%66,1" görünmüyor');
      ok(errs.length===0,'tr MGDA: sayfa hatası: '+errs.join(' | '));
    }finally{await ctx.close()}
  }
  // 2) Türkçe, Sodyum Bikarbonat: "ortak bildirim" ve %99,0 kalır
  {
    const {metin,errs,ctx}=await maddeSayfasi(br,B,opt,ok,'tr','144-55-8','Sodyum Bikarbonat');
    try{
      ok(/Sodyum Bikarbonat/.test(metin),'tr Bikarbonat: madde sayfası açılmadı');
      ok(/ortak bildirim/i.test(metin),'tr Bikarbonat: sayfada "ortak bildirim" artık geçmiyor; bu maddede REACH ortak bildirimi doğru');
      ok(/%99,0/.test(metin),'tr Bikarbonat: bildirim oranı "%99,0" görünmüyor');
      ok(errs.length===0,'tr Bikarbonat: sayfa hatası: '+errs.join(' | '));
    }finally{await ctx.close()}
  }
  // 3) İngilizce, Trisodyum MGDA: "joint notification" yok; "CLP notification" var; çevrilmemiş işareti yok
  {
    const {metin,errs,cevrilmemis,ctx}=await maddeSayfasi(br,B,opt,ok,'en','164462-16-2','Trisodium MGDA');
    try{
      ok(/Trisodium MGDA/.test(metin),'en MGDA: madde sayfası İngilizce açılmadı');
      ok(!/joint notification/i.test(metin),'en MGDA: sayfada "joint notification" geçiyor: '+(metin.match(/[^\n]*joint notification[^\n]*/i)||[''])[0]);
      ok(/CLP notification/i.test(metin),'en MGDA: sayfada "CLP notification" geçmiyor');
      ok(!/not yet translated/i.test(metin),'en MGDA: sayfada "not yet translated" işareti var');
      ok(cevrilmemis===0,'en MGDA: çevrilmemiş metin işareti (aria etiketi) var');
      ok(errs.length===0,'en MGDA: sayfa hatası: '+errs.join(' | '));
    }finally{await ctx.close()}
  }
};
