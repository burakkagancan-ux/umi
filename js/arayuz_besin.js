/* Arayüz: besin değeri tablosu (A-02, 3. adım). Saf mantık js/besin.js. Gıda sonucunda özetin altında kart: yağ, doymuş yağ, şekerler, tuz
   100 g (içecekte 100 ml) başına; renk yalnızca değerler tutarlıysa ve birim biliniyorsa (emin olunmayan renk gösterilmez).
   Değerin kaynağı sırayla: kullanıcının düzelttiği değerler (localStorage "besin_elle", metne bağlı) → okunan metindeki tablo
   → barkoddan gelen Open Food Facts değerleri. "Tablonun fotoğrafını ekle": okunan tablo metni içerik metninin sonuna eklenir,
   aynı tarama güncellenir (kayıt ve geçmişle birlikte saklanır). Kayıtlı üründe gösterilen tablo kaynağıyla birlikte saklanır (kayıt.besin). */
var BESIN_SOZ=null;    // besinSozluk(data/besin.json)
var BESIN_EKLE=null;   // {taban: fotoğraftan önceki metin, n: fotoğrafın OKU.n'i (seçilince), t}
var BESIN_EKLE_SURE=5*60000;
function besinYukle(){
  if(BESIN_SOZ)return Promise.resolve(BESIN_SOZ);
  return getJson("data/besin.json").then(function(j){BESIN_SOZ=besinSozluk(j);return BESIN_SOZ}).catch(function(){return null});
}
function besinElleListe(){return depoDizi("besin_elle")}
function besinElleYaz(a){return depoYaz("besin_elle",a)}
/* Ekrandaki metnin tablosu: {k: besinGorunum girdisi, kaynak: "elle"|"etiket"|"off", t, okunan: metinden ayrıştırılan (düzeltme formu için)} ya da null.
   Sıra: bu cihazda elle düzeltilen → kayıtlı üründe saklanan elle değerler (başka cihaz, yedek) → okunan metindeki tablo → barkoddan OFF
   → kayıtlı üründe saklanan diğer değerler (kayıt barkodsuz açıldığında OFF değerleri). kayitsiz: kayıtta saklananlar sayılmaz (kaydı yenilerken). */
function besinKaynak(tx,kayitsiz){
  var okunan=BESIN_SOZ?besinAyristir(tx,BESIN_SOZ):null;
  var e=besinElleBul(besinElleListe(),besinMetinAnahtar("gida",tx));
  if(e)return {k:{b:e.b,lt:e.lt||{},birim:e.birim,sorun:[],onay:true},kaynak:"elle",t:e.t,okunan:okunan};
  var kb=kayitsiz?null:besinKayitli(tx);
  if(kb&&kb.kaynak==="elle")return besinKayittan(kb,okunan);
  if(okunan)return {k:okunan,kaynak:"etiket",okunan:okunan};
  var r=BARKOD&&BARKOD.r;
  if(r&&r.besin&&BARKOD.metin&&tx.trim()===BARKOD.metin.trim())return {k:{b:r.besin,lt:r.besinLt||{},birim:r.besin.birim,sorun:[],por:r.besinPor||null},kaynak:r.besinKaynak==="topluluk"?"topluluk":"off",t:r.besinT||r.t,dogrulandi:!!r.besinDogrulandi};
  return kb?besinKayittan(kb,okunan):null;
}
function besinKayitli(tx){
  if(typeof kayitFind!=="function")return null;
  var k=kayitFind(kayitLoad(),"gida",tx);return k&&k.besin?besinKayitNorm(k.besin):null;
}
function besinKayittan(bs,okunan){return {k:{b:bs.b,lt:bs.lt,birim:bs.birim,sorun:bs.sorun,onay:bs.onay,por:bs.por||null},kaynak:bs.kaynak,t:bs.t,okunan:okunan,kayit:true}}
/* Metin kayıtlı bir gıdaysa saklanan tabloyu ekrandaki kaynakla yeniler (elle düzeltme ya da düzeltmeyi geri alma sonrası) */
function besinKayitYenile(tx){
  if(typeof kayitLoad!=="function")return;
  var a=kayitLoad(),k=kayitFind(a,"gida",tx);if(!k)return;
  var bs=besinKayitKopya(besinKaynak(tx,true));
  if(bs)k.besin=bs;else if(k.besin&&k.besin.kaynak==="elle")delete k.besin;else return;
  kayitStore(a);
}
function besinDeger(v,lt){var s=t("birim.g_l",{n:sayi(v)});return lt?t("besin.kucuktur",{d:s}):s}
function besinKart(tx){
  var d=el("div","res u besin");
  if(!BESIN_SOZ){besinYukle().then(function(){if(d.isConnected)d.replaceWith(besinKart(tx))});return d}
  var K=besinKaynak(tx),G=K?besinGorunum(K.k):null,hd=el("div","hd");
  d.appendChild(hd);
  if(!G){
    hd.appendChild(el("div","t",t("besin.baslik")));
    d.appendChild(el("div","ln",t("besin.yok")));
    var fr=besinFotoDugmeler(tx),eb=besinIkonDugme("alt","besin.elle_gir",BESIN_IKON.kalem);
    eb.onclick=function(){besinForm(tx,{k:{b:{},lt:{},birim:""},kaynak:"yok"},eb,d)};
    fr.appendChild(eb);d.appendChild(fr);
    return d;
  }
  hd.appendChild(el("div","t",t(G.birim?"besin.baslik_"+G.birim:"besin.baslik")));
  var ib=el("button","info sm","i");ib.type="button";ib.setAttribute("aria-label",t("besin.esik_aria"));ib.setAttribute("aria-expanded","false");hd.appendChild(ib);
  var tb=el("div","btab");
  G.satir.forEach(function(s){
    var r=el("div","brow");r.appendChild(el("span","bad",t("besin.alan."+s.alan)));
    r.appendChild(el("span","bdeg",s.v==null?"—":besinDeger(s.v,s.lt)));
    if(s.duzey)r.appendChild(el("span","bdz "+s.duzey,t("besin.duzey."+s.duzey)));
    tb.appendChild(r);
  });
  if(G.enerji!=null){var r=el("div","brow");r.appendChild(el("span","bad",t("besin.alan.kcal")));r.appendChild(el("span","bdeg",t("besin.kcal",{n:sayi(Math.round(G.enerji))})));tb.appendChild(r)}
  d.appendChild(tb);
  if(G.neden==="suphe"){
    var w=el("div","ln bsuphe",t("besin.suphe"));d.appendChild(w);
    d.appendChild(el("div","how",t("besin.sorunlar",{l:G.sorun.map(function(s){return t("besin.sorun."+s)}).join("; ")})));
  }else if(G.neden==="birim"){
    d.appendChild(el("div","ln",t("besin.birim_sor")));
    var row=el("div","row");
    ["g","ml"].forEach(function(b){var x=el("button","alt",t("besin.birim_"+b));x.type="button";x.onclick=function(){besinElleKaydet(tx,{b:K.k.b,lt:K.k.lt,birim:b});d.replaceWith(besinKart(tx))};row.appendChild(x)});
    d.appendChild(row);
  }
  var eksik=G.satir.filter(function(s){return s.v==null}).map(function(s){return t("besin.alan."+s.alan)});
  if(eksik.length)d.appendChild(el("div","how",t("besin.eksik",{l:eksik.join(", ")})));
  // ABD/Kanada etiketi: değerler porsiyon başına yazılı, 100 g'a çevrildi (O-23)
  if(G.por)d.appendChild(el("div","how",t(G.birim==="ml"?"besin.porsiyon_cevrildi_ml":"besin.porsiyon_cevrildi_g",{m:t(G.por.u==="ml"?"birim.ml_l":"birim.g_l",{n:sayi(G.por.m)})})));
  d.appendChild(el("div","how",K.kaynak==="elle"?t("besin.kaynak_elle",{tarih:dilTarih(K.t,"gun")}):K.kaynak==="off"?(K.t?t("besin.kaynak_off",{tarih:dilTarih(K.t,"gun")}):t("besin.kaynak_off_tarihsiz")):
    K.kaynak==="topluluk"?t(K.dogrulandi?"besin.kaynak_topluluk_dogrulandi":"besin.kaynak_topluluk",{tarih:dilTarih(K.t,"gun")}):t("besin.kaynak_etiket")));
  var pn=el("div","ipanel");pn.hidden=true;besinEsikPanel(pn);d.appendChild(pn);
  ib.onclick=function(){pn.hidden=!pn.hidden;ib.setAttribute("aria-expanded",pn.hidden?"false":"true");ib.classList.toggle("on",!pn.hidden)};
  var db=besinIkonDugme("alt","besin.duzelt",BESIN_IKON.kalem);db.onclick=function(){besinForm(tx,K,db,d)};
  // Metinde okunmuş bir tablo varsa yeni fotoğraf metne eklenmez (iki tablo karışır); okunan değerler düzeltme formunda onaya gelir
  var fr=besinFotoDugmeler(tx,!(K.kaynak==="off"||K.kaynak==="topluluk"||!K.okunan));
  fr.insertBefore(db,fr.firstChild);d.appendChild(fr);
  return d;
}
/* Eşiklerin kaynağı ve değerleri (BESIN_ESIK'ten; sayılar dilin biçiminde) */
function besinEsikPanel(pn){
  ["g","ml"].forEach(function(b){
    var h=el("div","ln");h.appendChild(el("b",null,t("besin.esik_"+b)));pn.appendChild(h);
    BESIN_AYAR.anaSatir.forEach(function(a){var e=BESIN_ESIK[b][a];pn.appendChild(el("div","how",t("besin.esik_satir",{ad:t("besin.alan."+a),a:sayi(e[0]),b:sayi(e[1])})))});
  });
  pn.appendChild(el("div","how",t("besin.hukum_not")));
  pn.appendChild(el("div","how",t("besin.porsiyon_not")));
  pn.appendChild(el("div","how",t("besin.enerji_not")));
  var s=el("div","how");s.appendChild(document.createTextNode(t("ortak.kaynak")));
  var l=el("a",null,t("besin.esik_kaynak"));l.href=BESIN_ESIK.url;l.target="_blank";l.rel="noopener";s.appendChild(l);pn.appendChild(s);
}
/* "Tablonun fotoğrafını ekle": kamera ya da galeri; okunan metin içerik metninin sonuna eklenir (js/arayuz_sayfa.js besinEkMetin).
   yeniden: tablo zaten okunmuş; yeni fotoğraf metne eklenmez, değerleri düzeltme formunda gelir (besinYenidenOku) */
function besinFotoDugmeler(tx,yeniden){
  var row=el("div","row bikon");
  var b=besinIkonDugme(yeniden?"alt":"",yeniden?"besin.foto_yeniden":"besin.foto_ekle",BESIN_IKON.kamera);b.onclick=function(){besinFotoIste(tx,"foto",yeniden)};
  var g=besinIkonDugme("alt","foto.dosya",BESIN_IKON.galeri);g.onclick=function(){besinFotoIste(tx,"dosya",yeniden)};
  row.appendChild(b);row.appendChild(g);return row;
}
/* Kartın üç işlevi yazısız ikon düğmesi; ad aria-label ve title (uzun basma / üzerine gelme ipucu) */
var BESIN_IKON={
  kalem:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  kamera:'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  galeri:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'
};
function besinIkonDugme(cls,ad,yol){
  var b=el("button",(cls?cls+" ":"")+"ikb");b.type="button";
  b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+yol+'</svg>';
  b.setAttribute("aria-label",t(ad));b.title=t(ad);return b;
}
function besinFotoIste(tx,inp,yeniden){BESIN_EKLE={taban:tx,n:null,t:Date.now(),son:null,yeniden:!!yeniden};$(inp).click()}
/* Fotoğraf seçildi (fotoSec, OKU.n arttıktan sonra): bekleyen istek bu fotoğrafa bağlanır; başka bir fotoğraf istek biter */
function besinFotoSecildi(){
  if(!BESIN_EKLE)return;
  if(BESIN_EKLE.n==null&&Date.now()-BESIN_EKLE.t<BESIN_EKLE_SURE)BESIN_EKLE.n=OKU.n;else BESIN_EKLE=null;
}
/* Okunan metin tablo fotoğrafına aitse eklenmiş metin, değilse null. n: okunan fotoğrafın OKU.n'i */
function besinEkMetin(n,tx){
  if(!BESIN_EKLE||BESIN_EKLE.n!==n||BESIN_EKLE.yeniden)return null;
  var taban=BESIN_EKLE.taban.trim();return (taban?taban+"\n\n":"")+String(tx||"").trim();
}
/* Tablo metne eklendi (fotoOku yaz, kutu değişmeden önce): ekrandaki metin kayıtlı bir üründeyse kayıt yeni metne taşınır, tablosu
   ve özeti yenilenir (kayıt metne bağlıdır; yoksa "Kaydet" ikinci bir kayıt açardı). Çerçeve değişip tablo yeniden okununca son metinle
   bulunur. Barkodun ekranındaysa tablo barkoda da bağlanabilir (js/arayuz_barkod.js barkodBesinEk). */
function besinEkUygula(ek){
  if(!BESIN_EKLE)return;
  var eski=[BESIN_EKLE.taban,BESIN_EKLE.son].filter(function(x){return x!=null});BESIN_EKLE.son=ek;
  if(typeof barkodBesinEk==="function")barkodBesinEk(eski,ek);
  if(typeof kayitLoad!=="function"||MODE!=="gida")return;
  var a=kayitLoad(),k=null;
  eski.forEach(function(x){k=k||kayitFind(a,"gida",x)});
  if(!k||kayitFind(a,"gida",ek))return;
  k.text=ek.trim();k.u=Date.now();
  var bs=besinKayitKopya(besinKaynak(ek,true));if(bs)k.besin=bs;
  var oz=kayitSimdi("gida",ek);if(oz)k.oz=oz;
  kayitStore(a);
}
/* Tablonun yeniden çekilen fotoğrafı okundu: metin değişmez, okunan değerler düzeltme formunda onaya gelir (kaydedilince elle değer
   sayılır, barkoda bağlanabilir). Döner: null (bu fotoğraf tablo için değil) ya da durum mesajı. Çerçeve değişip yeniden okununca form yenilenir. */
function besinYenidenOku(n,tx){
  if(!BESIN_EKLE||BESIN_EKLE.n!==n||!BESIN_EKLE.yeniden)return null;
  var taban=BESIN_EKLE.taban,kart=$("sonuc").querySelector(".res.besin");
  if(!kart||$("metin").value.trim()!==taban.trim()){BESIN_EKLE=null;return null}
  var k=BESIN_SOZ?besinAyristir(tx,BESIN_SOZ):null;
  if(!k)return t("besin.foto_okunamadi");
  closeSheet();besinForm(taban,{k:k,kaynak:"etiket"},kart.querySelector("button"),kart,t("besin.yeniden_not"));
  return t("besin.yeniden_okundu");
}
function besinEkMesaj(metin,msj){return BESIN_SOZ&&!besinAyristir(metin,BESIN_SOZ)?t("besin.foto_okunamadi"):msj}
function besinElleKaydet(tx,k){
  var a=besinElleEkle(besinElleListe(),besinMetinAnahtar("gida",tx),{b:k.b,birim:k.birim,t:Date.now()});
  if(k.lt&&Object.keys(k.lt).length)a[0].lt=k.lt;
  if(!besinElleYaz(a))return false;
  besinKayitYenile(tx);
  if(typeof barkodBesinKatki==="function"&&barkodEkranda(tx))barkodBesinKatki();   // düzeltilen tablo barkoda bağlanabilir
  return true;
}
/* Düzeltme formu: sekiz satır (boş = okunmadı; "<0,5" yazılabilir) ve birim. Kaydedilen değerler kullanıcı onayı sayılır. */
function besinForm(tx,K,ret,kart,not){
  var body=el("div","kform bform"),b=K.k.b,lt=K.k.lt||{},inp={};
  if(not)body.appendChild(el("div","ln",not));
  body.appendChild(el("div","how",t("besin.form.not")));
  var bs=el("div","row brad"),birim=K.k.birim==="ml"?"ml":K.k.birim==="g"?"g":"";
  var bb={};["g","ml"].forEach(function(x){var q=el("button","alt"+(birim===x?" on":""),t("besin.birim_"+x));q.type="button";q.setAttribute("aria-pressed",birim===x?"true":"false");
    q.onclick=function(){birim=x;Object.keys(bb).forEach(function(y){bb[y].classList.toggle("on",y===x);bb[y].setAttribute("aria-pressed",y===x?"true":"false")})};bb[x]=q;bs.appendChild(q)});
  var bl=el("div","ln",t("besin.form.birim"));body.appendChild(bl);body.appendChild(bs);
  BESIN_ALAN.forEach(function(a){
    var l=el("label","kname");l.appendChild(el("span",null,t("besin.alan."+a)+" ("+(a==="kcal"?"kcal":"g")+")"));
    var i=document.createElement("input");i.type="text";i.inputMode="decimal";i.autocomplete="off";i.setAttribute("data-alan",a);
    i.value=b[a]==null?"":(lt[a]?"<":"")+dilSayi(a==="kcal"?Math.round(b[a]):Math.round(b[a]*100)/100);
    l.appendChild(i);body.appendChild(l);inp[a]=i;
  });
  var msg=el("div","how");
  var go=el("button",null,t("besin.form.kaydet"));go.type="button";
  go.onclick=function(){
    var nb={},nlt={},hata=null;
    BESIN_ALAN.forEach(function(a){
      var s=inp[a].value.trim().replace(/\s+/g,"");if(!s){nb[a]=null;return}
      var m=/^([<≤])?(\d+(?:[.,]\d+)?)$/.exec(s);
      if(!m){if(!hata)hata=a;return}
      nb[a]=Number(m[2].replace(",","."));if(m[1])nlt[a]=true;
    });
    if(hata){msg.textContent=t("besin.form.gecersiz",{ad:t("besin.alan."+hata)});inp[hata].focus();return}
    if(!birim){msg.textContent=t("besin.form.birim_sec");return}
    if(BESIN_ALAN.every(function(a){return nb[a]==null})){msg.textContent=t("besin.form.bos");return}
    if(!besinElleKaydet(tx,{b:nb,lt:nlt,birim:birim})){msg.textContent=t("kayit.form.yer_yok");return}
    closeSheet();if(kart.isConnected)kart.replaceWith(besinKart(tx));
  };
  body.appendChild(go);body.appendChild(msg);
  if(K.kaynak==="elle"){
    var geri=el("button","alt",t("besin.form.geri"));geri.type="button";
    geri.onclick=function(){var k=besinMetinAnahtar("gida",tx);besinElleYaz(besinElleListe().filter(function(x){return x&&x.k!==k}));besinKayitYenile(tx);closeSheet();kart.replaceWith(besinKart(tx))};
    body.appendChild(geri);
  }
  openSheet(t("besin.form.baslik"),null,body,ret);
}
