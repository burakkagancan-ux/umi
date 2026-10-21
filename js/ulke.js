/* Ülke mevzuat katmanı (B-05): saf mantık (DOM yok; testler de yükler). Veri data/ulke.json (gen_ulke.py, kaynak/ulke/).
   Bütün ülkeler aynı modelde; bu dosyada ve arayüzde ülke adı geçmez: ülkeye özgü kart ve satırlar "oz" (özellik) bayraklarıyla,
   katkı maddesinin o ülkedeki durumu "k" tablosuyla gelir. Yeni ülke = kaynak/ulke/ulkeler.json'a kayıt + kaynak dosyası. */
export var ULKE_DURUMLAR=["izinli","kisitli","izinli_degil","iptal","belirsiz"];
/* veri: data/ulke.json, kod: seçili ülke (ISO 3166, "" = seçilmedi). Döner: {kod, oz, kaynak: {ad, kisa, url, okundu} | null, katki(id)} ya da null */
export function ulkeKatman(veri,kod){
  var u=veri&&veri.u&&kod?veri.u[kod]:null;if(!u)return null;
  var ks=veri.meta&&veri.meta.kaynaklar||{};
  return {kod:kod,oz:u.oz||{},kaynak:ks[u.kaynak]||null,katki:function(id){
    var r=u.k&&u.k[id];if(!r||ULKE_DURUMLAR.indexOf(r[0])<0)return null;
    return {d:r[0],ad:r[1]||"",not:r[2]||""};
  }};
}
/* Kayıttaki not: düz metin (kaynak dilde; çevirisi veri çeviri anahtarıyla) ya da {tr, en, …} (seçili dil → İngilizce → boş) */
export function ulkeNot(not,dil){
  if(!not)return "";
  if(typeof not==="string")return not;
  return not[dil]||not.en||"";
}
/* Ülke özelliği: K.oz[ad] (yoksa null). Arayüz ülke koşulu yerine bunu sorar ("bu ülkede marka listesi kartı var mı"). */
export function ulkeOzellik(K,ad){return K&&K.oz&&K.oz[ad]!=null?K.oz[ad]:null}
