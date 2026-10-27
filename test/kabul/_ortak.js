// Kabul testlerinin ortak yardımcısı. Kabul testi uygulamanın içine bakmaz (kabul_denetle.py 4. kural): öğeleri rolüyle,
// görünen metniyle, aria etiketiyle bulur; sayfayı kullanıcı gibi açar. Dış servisler (OCR Worker, barkod, sayaç) testte
// kapalıdır; bir test onların yanıtını taklit etmek isterse p.route ile kendi yanıtını verir (ağ sınırı dış yüzdür).
const external=u=>!/^http:\/\/localhost:/.test(u);

// Sayfayı açar; sayfa hatalarını ve konsol hatalarını errs dizisine toplar. Döner: {p, errs}
async function ac(ctx,adres){
  const p=await ctx.newPage(),errs=[];
  p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))errs.push(m.text())});
  await p.route('**/*',r=>external(r.request().url())?r.abort():r.continue());
  await p.goto(adres);
  await p.waitForLoadState('networkidle');
  return {p,errs};
}

// Görünür mü (bekleyerek); bulunamazsa false döner, testi durdurmaz
async function gorunur(loc,ms){
  try{await loc.first().waitFor({state:'visible',timeout:ms||5000});return true}catch(e){return false}
}

// Okuyucu art arda iki kez aynı değeri verene dek okur (en çok ms), son değeri döndürür. Tahmini bekleme + tek okuma yerine:
// sayfa yeniden çizerken ya da eşzamansız yazıcısı sürerken tek okuma ara değeri yakalar (testler.md "Bekle, sonra oku yok").
// ör. const t=await yerlesince(()=>p.locator('body').innerText());
async function yerlesince(oku,ms,aralik){
  const son=Date.now()+(ms||8000);let once=await oku();
  for(;;){await new Promise(r=>setTimeout(r,aralik||250));const simdi=await oku();if(simdi===once||Date.now()>son)return simdi;once=simdi}
}

module.exports={ac,gorunur,yerlesince};
