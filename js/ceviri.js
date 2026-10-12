/* Çok dil: saf mantık (DOM yok; testler de yükler). Arayüz metinleri i18n/<dil>.json'da, anahtarla: t("gida.ozet.palm", {n:2}).
   Eksik çeviride sıra: seçili dil → İngilizce → Türkçe; hiçbirinde yoksa anahtarın kendisi döner (test/ceviri.js yakalar).
   Değer düz metin ya da çoğul nesnesi {"one":"…","other":"…"} (biçimi Intl.PluralRules seçer; sayı v.n). Yer tutucu {ad}.
   Veri metinleri (gerekçe, not) ayrı: veriMetin(trMetin, anahtar) çeviri yoksa Türkçeyi "çevrilmedi" işaretiyle döndürür. */
var DIL={kod:"tr",yerel:"tr",yon:"ltr",sira:["tr"],sozluk:{},veri:{},yazi:null,bilgi:{}};
var DIL_KAYNAK="tr",DIL_YEDEK="en";   // kaynak dil (eksiksiz) ve ilk yedek
/* kod: seçili dil; sozluk: {tr:{…}, en:{…}, …}; bilgi: i18n/diller.json kaydı ({ad, yon, yazi}); veri: {kod: {anahtar: metin}} */
function dilKur(kod,sozluk,bilgi,veri){
  var b=(bilgi&&bilgi[kod])||{};
  DIL.kod=kod;DIL.yerel=b.yerel||kod;DIL.yon=b.yon==="rtl"?"rtl":"ltr";DIL.yazi=b.yazi||null;DIL.bilgi=bilgi||{};   // yerel: Intl yerel ayarı (ör. en → en-GB: AB İngilizcesi tarih biçimi)
  DIL.sozluk=sozluk||{};DIL.veri=veri||{};
  DIL.sira=[kod,DIL_YEDEK,DIL_KAYNAK].filter(function(x,i,a){return a.indexOf(x)===i});
  DIL_COGUL={};DIL_BICIM={};
}
var DIL_COGUL={},DIL_BICIM={};
function dilCogul(kod,n){
  try{var p=DIL_COGUL[kod]||(DIL_COGUL[kod]=new Intl.PluralRules(kod));return p.select(n)}catch(e){return n===1?"one":"other"}
}
function dilBul(k){
  for(var i=0;i<DIL.sira.length;i++){var d=DIL.sozluk[DIL.sira[i]];if(d&&Object.prototype.hasOwnProperty.call(d,k))return {s:d[k],kod:DIL.sira[i]}}
  return null;
}
function t(k,v){
  var f=dilBul(k);if(!f)return k;
  var s=f.s;
  if(s&&typeof s==="object"){var n=v&&typeof v.n==="number"?v.n:0;s=s[dilCogul(f.kod,n)]!=null?s[dilCogul(f.kod,n)]:s.other}
  if(!v)return s;
  return s.replace(/\{(\w+)\}/g,function(m,a){return v[a]!=null?String(v[a]):m});
}
function tVar(k){return !!dilBul(k)}
/* Belirli bir dilin sözlüğünden (yüklüyse) biçimler; ör. veriyle karşılaştırmak için Türkçe metin */
function tDil(kod,k,v){var d=DIL.sozluk[kod],s=d&&d[k];if(s==null)return k;if(typeof s==="object")s=s.other;return v?s.replace(/\{(\w+)\}/g,function(m,a){return v[a]!=null?String(v[a]):m}):s}
/* Sayı: Türkçede "62,5"; binlik ayırıcı yok (eski görünüm). ond: en çok ondalık (varsayılan 2); sabit: ondalık hane sayısı sabit ("2,0") */
function dilSayi(x,ond,sabit){
  ond=ond==null?2:ond;
  var o={maximumFractionDigits:ond,minimumFractionDigits:sabit?ond:0,useGrouping:false},k="n"+ond+(sabit?"s":"");
  try{var f=DIL_BICIM[k]||(DIL_BICIM[k]=new Intl.NumberFormat(DIL.yerel,o));return f.format(x)}catch(e){return String(x)}
}
/* Tarih: bicim "gun" (5 Ekim 2026), "gunsaat" (5 Ekim 14:30), "ayyil" (Ekim 2026) */
var DIL_TARIH={gun:{day:"numeric",month:"long",year:"numeric"},gunsaat:{day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"},ayyil:{month:"long",year:"numeric"}};
function dilTarih(ms,bicim){
  var k="t"+bicim;
  try{var f=DIL_BICIM[k]||(DIL_BICIM[k]=new Intl.DateTimeFormat(DIL.yerel,DIL_TARIH[bicim]||DIL_TARIH.gun));return f.format(new Date(ms))}catch(e){return new Date(ms).toISOString().slice(0,10)}
}
/* Sıralama ve harf duyarsız karşılaştırma için dilin yerel ayarı */
function dilKarsilastir(a,b){return a.localeCompare(b,DIL.yerel)}
/* Veri metni (gerekçe, not, etiket; kaynak Türkçe). Sıra: veride kaynağın kendi metni (resmi: {en: CLP ifadesi, name_en…}) seçili dilde
   → i18n/veri/<dil>.json'da anahtarla (ör. "e.E100.reason") → aynı dosyada metnin kendisiyle ("metin:<Türkçe>"; kimliği olmayan kısa etiketler)
   → resmi İngilizce → Türkçe. Seçili dilde değilse cevrilmedi=true (arayüz yanına "henüz çevrilmedi" işareti koyar); kod: metnin dili. */
function veriMetin(tr,anahtar,resmi){
  var kod=DIL.kod;
  if(kod===DIL_KAYNAK||tr==null||tr==="")return {s:tr,cevrilmedi:false,kod:DIL_KAYNAK};
  if(resmi&&resmi[kod])return {s:resmi[kod],cevrilmedi:false,kod:kod};
  var d=DIL.veri[kod];
  if(d&&anahtar&&d[anahtar]!=null)return {s:d[anahtar],cevrilmedi:false,kod:kod};
  if(d&&d["metin:"+tr]!=null)return {s:d["metin:"+tr],cevrilmedi:false,kod:kod};
  if(resmi&&resmi[DIL_YEDEK])return {s:resmi[DIL_YEDEK],cevrilmedi:true,kod:DIL_YEDEK};
  return {s:tr,cevrilmedi:true,kod:DIL_KAYNAK};
}
/* Yalnızca metin (işaret konamayan yerler: listeler, birleşik cümleler) */
function veriS(tr,anahtar,resmi){return veriMetin(tr,anahtar,resmi).s}
/* Ülke katmanı (B-05 ilk adımı, 09.10.2026): ülkeye özgü bilgiler (yerel mevzuat adı, zehir danışma hattı, Bakanlık listesi)
yalnızca seçilen ülkede gösterilir. Kayıtlı seçim ("" = seçilmedi) > dil Türkçeyse Türkiye > seçilmedi. Yeni ülke ULKELER'e eklenir. */
var ULKELER=["TR"];
function ulkeSec(kayitli,dil){
  if(kayitli===""||ULKELER.indexOf(kayitli)>-1)return kayitli;
  return dil==="tr"?"TR":"";
}
/* Dil seçimi: kayıtlı seçim > tarayıcı dilleri (ilk desteklenen; "en-US" → "en") > İngilizce */
function dilSec(kayitli,tarayici,destek){
  if(kayitli&&destek.indexOf(kayitli)>-1)return kayitli;
  for(var i=0;i<(tarayici||[]).length;i++){var k=String(tarayici[i]).toLowerCase(),a=k.split("-")[0];if(destek.indexOf(k)>-1)return k;if(destek.indexOf(a)>-1)return a}
  return destek.indexOf(DIL_YEDEK)>-1?DIL_YEDEK:destek[0];
}
