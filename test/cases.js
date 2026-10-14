const {idx,L,tg}=require('./run.js');
function ids(t){return L.analyze(t,idx).map(x=>x.ids.join('+')+(x.may?'~may':'')+(x.neg?'~neg':'')+(x.aroma?'~aroma':''))}
const cases=[
 ["Un, su, tuz, maya", ["B:un","B:n_hamur_mayasi"], []],
 ["Mısır unu, pirinç unu, şeker", ["B:n_glutensiz_un","B:seker"], ["B:un","B:bugday"]],
 ["Hindistan cevizi sütü, kakao yağı, badem sütü", ["B:n_hindistan","B:n_kakao","B:badem"], ["B:sut","B:tereyagi"]],
 ["Şeker, süt aroması, tereyağı aroması", ["B:n_sut_aroma"], ["B:sut","B:tereyagi"]],
 ["Şeker, peynir aromalı çeşni", [], []],
 ["İçindekiler: şeker, kakao, süt tozu, fındık ezmesi, emülgatör (soya lesitini) Eser miktarda yer fıstığı içerebilir", ["B:findik","B:yer_fistigi~may"], ["B:findik~may"]],
 ["şeker, buğday unu, süt tozu, fındık, susam içerebilir", ["B:susam~may","B:findik~may"], []],
 ["Bu ürün yer fıstığı ve susam kullanılan aynı tesiste üretilmiştir. İçindekiler: mısır, tuz.", ["B:yer_fistigi~may","B:susam~may"], []],
 ["Buğday glukoz şurubu, dekstroz", ["B:bugday_glukoz","B:dekstroz"], ["B:bugday","B:glukoz_surubu"]],
 ["Renklendirici (karamel), karamel aroması", [], []],
 ["Palm yağı içermez. Ayçiçek yağı, şeker", ["B:palm~neg","B:seker"], ["B:palm"]],
 ["süt ve yumurta içermez", ["B:sut~neg","B:yumurta~neg"], ["B:sut"]],
 // Sıralı olumsuzluk (05.10.2026): öndeki madde varmış gibi gösterilmez
 ["Alkol ve domuz içermez", ["B:alkol~neg","B:domuz~neg"], ["B:alkol","B:domuz"]],
 ["Alkol, domuz ürünü içermez", ["B:alkol~neg","B:domuz~neg"], ["B:alkol","B:domuz"]],
 ["İçindekiler: şeker, su. Alkol ve domuz eti içermemektedir.", ["B:seker","B:alkol~neg","B:domuz~neg"], ["B:alkol","B:domuz"]],
 ["Alkol içermez, domuz kaynaklı madde içermez", ["B:alkol~neg","B:domuz~neg"], ["B:domuz"]],
 ["Alkol ve domuz ürünleri ile katkı maddesi içermez", ["B:alkol~neg","B:domuz~neg"], ["B:alkol","B:domuz"]],
 ["Alkol veya domuz yağı yoktur", ["B:alkol~neg","B:domuz~neg"], ["B:alkol"]],
 // Kullanıcı tespiti (14.10.2026): "katkıları" ve "bulunmamaktadır" olumsuzluğu bölmüyordu, domuz içerikte varmış gibi görünüyordu
 ["Domuz yağı ve katkıları yoktur.", ["B:domuz~neg"], ["B:domuz"]],
 ["İçindekiler: un, tuz. Ürünümüzde domuz yağı ve katkıları bulunmamaktadır.", ["B:un","B:tuz","B:domuz~neg"], ["B:domuz"]],
 ["Domuz kökenli katkı maddeleri içermez", ["B:domuz~neg"], ["B:domuz"]],
 ["İçindekiler: buğday unu, domuz yağı, tuz.", ["B:domuz"], ["B:domuz~neg"]],
 ["İçindekiler: şeker, süt, palm yağı içermez", ["B:seker","B:sut","B:palm~neg"], ["B:sut~neg","B:seker~neg"]],
 ["Şeker ve süt", ["B:seker","B:sut"], ["B:sut~neg"]],
 ["Bal kabağı çekirdeği, tuz", ["B:n_balkabagi"], ["B:bal"]],
 ["Mürekkep balığı, karides", ["B:yumusakca","B:kabuklu"], ["B:balik"]],
 ["Askorbil palmitat, E304", [], ["B:palm"]],
 ["Tavuk eti, mekanik ayrılmış kanatlı eti, jelatin (sığır)", ["B:tavuk","E441"], []],
 ["glukoz-fruktoz şurubu, invert şeker şurubu", ["B:gfs","B:invert"], []],
 ["Laktozsuz süt, laktaz enzimi", ["B:sut"], []],
 ["peynir mayası, mikrobiyal peynir mayası", ["B:peynir_mayasi","B:mikrobiyal_maya"], []],
 ["Antep fıstığı, çam fıstığı, fıstık", ["B:antep","B:n_cam_fistigi","B:fistik"], []],
 // TGK karşılaştırması (03.10.2026)
 ["Kuru kayısı, koruyucu (sülfit)", ["E220+E221+E222+E223+E224+E226+E227+E228"], ["E228"]],
 ["Kükürt dioksit ve sülfitler", ["B:sulfit"], ["E220"]],
 ["tatlandırıcı (sorbitol), mannitol, guar gam, jellan gam, şellak", ["E420","E421","E412","E418","E904"], []],
 ["Koşineal, karmosin, ponzo 4R, pancar kökü kırmızısı", ["E120","E122","E124","E162"], []],
 ["brezilya fındığı, queensland fındığı, tritikale unu, kılçıksız buğday", ["B:pikan","B:bugday","B:spelt"], ["B:findik"]],
 ["balık jelatini, bitkisel steroller, rafine soya fasulyesi yağı", ["B:balik_jelatini","B:n_sterol","B:soya_yagi"], ["B:balik","B:soya"]],
 // Faz 2: yaşam evresi / evcil hayvan
 ["Kakao yağı, kakao tozu, bal kabağı çekirdeği, kahverengi şeker", ["B:n_kakao","B:kakao","B:n_balkabagi","B:seker"], ["B:kafein","B:bal"]],
 ["Kafeinsiz kahve, şeker", ["B:n_kafeinsiz"], ["B:kafein"]],
 ["Rom aroması, şeker alkolü (maltitol)", ["E965"], ["B:alkol"]],
 ["Alkol içermez. Üzüm pekmezi, soğanlı, sarımsak tozu", ["B:alkol~neg","B:pekmez","B:sogan"], ["B:uzum","B:alkol"]],
 ["Çiğ süt, kuru üzüm, makadamya", ["B:cig_sut","B:uzum","B:makadamya"], ["B:sut","B:pikan"]],
];
let fail=0;
for(const [t,must,mustNot] of cases){
  const got=ids(t);const miss=must.filter(m=>!got.includes(m));const bad=mustNot.filter(m=>got.includes(m));
  if(miss.length||bad.length){fail++;console.log('HATA:',t,'\n  bulunan:',got.join(', '),'\n  eksik:',miss,' fazla:',bad)}
}
console.log(cases.length+' durum, '+fail+' hata');
// Karamel bağlamı
console.log('karamel:',ids("Renklendirici (karamel), karamel aroması").join(', '));
console.log('peynir aromalı:',ids("Şeker, peynir aromalı çeşni").join(', '));
// Marka
const br=L.buildBrands(tg);console.log('marka sayısı',Object.keys(br).length);
console.log(L.findBrands("Üretici: DOY HOREKA Gıda. İçindekiler: süt, tuz",br));
console.log(L.findBrands("İçindekiler: doğal köy yoğurdu, petek bal, royal jelly, yıldız",br));

// Faz 2 özet kontrolleri
const life=t=>L.summarize(L.analyze(t,idx),idx).life;
const lc=[
 ["Bal, şeker, etil alkol, kahve", l=>l.honey.length&&l.alcohol.length&&l.caffeine.length],
 ["tatlandırıcı (aspartam, asesülfam K), renklendirici (E 110)", l=>l.phe.length&&l.sweet.length>=2&&l.hyper.length],
 ["Ksilitol, çikolata, kuru üzüm, soğan tozu", l=>l.pet.length===4],
 ["Alkolsüz bira", l=>l.alcoholTrace.length&&!l.alcohol.length],
 ["Rom aroması, şeker", l=>!l.alcohol.length&&!l.pet.length],
 ["Çiğ sütten yapılmış peynir", l=>l.raw.length],
 ["Şeker. Eser miktarda kakao içerebilir", l=>!l.pet.length],
];
let lf=0;for(const [t,f] of lc){if(!f(life(t))){lf++;console.log('YAŞAM HATA:',t,JSON.stringify(life(t)))}}
console.log(lc.length+' yaşam evresi durumu, '+lf+' hata');
