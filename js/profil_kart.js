/* Profil kartlarının verisi (U-07 6. adım, 15.10.2026): Profilim'deki seçimlere göre sonuç ekranında çıkan kişisel kartlar. Saf mantık (DOM yok).
   Kart: {cls: "r" | "y" | "g", title, lines: [metin | {ozel: "zehir"} (Zehir Danışma Hattı kutusu) | boş (gösterilmez)]}.
   Arayüz kartı çizer (js/arayuz.js kartEl); paylaşım kartının kişisel satırları da buradan (kisiselSatirlar). Hiçbir zaman "uygun" denmez.
   prof: localStorage "profil" biçimi (PROF). Eskiden kartlar doğrudan DOM olarak üretiliyordu; metin ve kurallar birebir aynı. */
import {DIL, t} from "./ceviri.js";
import {ozelAraHepsi, ozelGoster} from "./ortak.js";
import {hzKisa} from "./temizlik.js";
export function kartVeri(cls,title,lines){return {cls:cls,title:title,lines:lines||[]}}
/* Paylaşım kartının kişisel satırları: yalnızca kırmızı/sarı kartlar, başlık + ilk dolu satır (satır başlıkla başlıyorsa yalnızca satır) */
export function kisiselSatirlar(kartlar){
  return kartlar.filter(function(c){return c.cls==="r"||c.cls==="y"}).map(function(c){
    var b=c.title||"",l=c.lines.filter(function(x){return typeof x==="string"&&x})[0]||"";
    return {t:l&&l.indexOf(b)===0?l:b+(l?": "+l:""),lvl:c.cls==="r"?2:1};
  });
}
/* Profilim'de elle eklenen alerjenler: etiket metninde bulunanlar (sözlükteki bütün dil karşılıklarıyla) */
function ozelSatirlar(metin,prof){
  var o={yes:[],may:[]};
  prof.alOzel.forEach(function(ad){var r=ozelAraHepsi(metin,ad),g=ozelGoster(ad,DIL.kod);if(r.yes.length)o.yes.push(g+": "+r.yes.join(", "));if(r.may.length)o.may.push(g+": "+r.may.join(", "))});
  return o;
}
/* Kozmetik ve temizlikte yalnızca eklenen alerjenlerin kartı (gıdada seçilen alerjenlerle tek kart) */
export function ozelKartVeri(metin,prof){
  if(!prof.alOzel.length)return null;var o=ozelSatirlar(metin,prof);
  if(o.yes.length)return kartVeri("r",t("gida.prof.alerjen_var"),o.yes.concat(o.may.length?[t("gida.prof.ayrica_icerebilir",{l:o.may.join("; ")})]:[]));
  if(o.may.length)return kartVeri("y",t("gida.prof.alerjen_icerebilir"),o.may);
  return kartVeri("g",t("gida.prof.alerjen_yok"),[t("profil.ozel.yok_not")]);
}
/* Gıda: alerjen, laktoz, vegan, vejetaryen ve yaşam evresi kartları. alAd(kimlik): alerjenin görünen adı */
export function profilKartGida(S,metin,prof,alAd){
  var out=[];   // her kart kendi profil seçeneğiyle açılır; hiçbiri seçili değilse kart yok
  if(prof.al.length||prof.alOzel.length){
    var yes=[],may=[],oz=ozelSatirlar(metin,prof);
    prof.al.forEach(function(f){var a=S.allergen[f];if(!a)return;if(a.yes.length)yes.push(alAd(f)+": "+a.yes.join(", "));if(a.may.length)may.push(alAd(f)+": "+a.may.join(", "))});
    yes=yes.concat(oz.yes);may=may.concat(oz.may);
    if(yes.length)out.push(kartVeri("r",t("gida.prof.alerjen_var"),yes.concat(may.length?[t("gida.prof.ayrica_icerebilir",{l:may.join("; ")})]:[])));
    else if(may.length)out.push(kartVeri("y",t("gida.prof.alerjen_icerebilir"),may));
    else out.push(kartVeri("g",t("gida.prof.alerjen_yok"),[t("gida.prof.alerjen_yok_not")].concat(prof.alOzel.length?[t("profil.ozel.yok_not")]:[])));
  }
  if(prof.lactose){
    var L=S.lactose;
    if(L.yes.length)out.push(kartVeri("r",t("gida.prof.laktoz_var"),[L.yes.join(", ")].concat(L.low.length?[t("gida.prof.laktoz_dusuk_l",{l:L.low.join(", ")})]:[])));
    else if(L.low.length||L.may.length)out.push(kartVeri("y",t("gida.prof.laktoz_belirsiz"),[L.low.length?t("gida.prof.laktoz_dusuk_l",{l:L.low.join(", ")}):"",L.may.length?t("gida.prof.laktoz_aroma",{l:L.may.join(", ")}):""]));
    else out.push(kartVeri("g",t("gida.prof.laktoz_yok"),[t("ortak.onay_degil_etiket")]));
  }
  if(prof.vegan){
    var V=S.vegan;
    if(V.no.length)out.push(kartVeri("r",t("gida.prof.vegan_degil"),[V.no.join(", ")].concat(V.unsure.length?[t("gida.prof.kaynak_belirsiz",{l:V.unsure.join(", ")})]:[])));
    else if(V.unsure.length)out.push(kartVeri("y",t("gida.prof.vegan_belirsiz"),[t("gida.prof.vegan_belirsiz_l",{l:V.unsure.join(", ")})]));
    else out.push(kartVeri("g",t("gida.prof.hayvansal_yok"),[t("ortak.onay_degil_vegan")]));
  }
  if(prof.veg){
    var G=S.veg;
    if(G.no.length||G.insect.length)out.push(kartVeri("r",t("gida.prof.vejetaryen_degil"),[G.no.length?G.no.join(", "):"",G.insect.length?t("gida.prof.bocek",{l:G.insect.join(", ")}):""].concat(G.unsure.length?[t("gida.prof.kaynak_belirsiz",{l:G.unsure.join(", ")})]:[])));
    else if(G.unsure.length)out.push(kartVeri("y",t("gida.prof.vejetaryen_belirsiz"),[t("gida.prof.kaynak_belirsiz",{l:G.unsure.join(", ")})]));
    else out.push(kartVeri("g",t("gida.prof.et_yok"),[t("ortak.onay_degil_etiket")]));
  }
  return out.concat(yasamKartlari(S.life,S.sodium,prof));
}
/* Yaşam evresi, PKU ve evcil hayvan kartları. Satır: [seviye "r"/"y", metin]. */
export function yasamKart(title,rows,okTitle,okNote,extra){
  rows=rows.filter(function(r){return r});
  if(!rows.length)return kartVeri("g",okTitle,[okNote]);
  var red=rows.some(function(r){return r[0]==="r"});
  return kartVeri(red?"r":"y",title,rows.map(function(r){return r[1]}).concat(extra?[extra]:[]));
}
export function yasamKartlari(L,NA,prof){
  var out=[],j=function(a){return a.join(", ")};
  var raw=L.raw.length?["r",t("gida.yasam.cig",{l:j(L.raw)})]:null;
  var alc=L.alcohol.length?["r",t("gida.yasam.alkol",{l:j(L.alcohol)})]:null;
  var trace=L.alcoholTrace.length?["y",t("gida.yasam.alkolsuz")]:null;
  var hyp=L.hyper.length?["y",t("gida.yasam.renk",{l:j(L.hyper)})]:null;
  if(prof.preg)out.push(yasamKart(t("gida.yasam.hamile"),[alc,raw,
    L.caffeine.length?["y",t("gida.yasam.kafein_hamile",{l:j(L.caffeine)})]:null,trace],
    t("gida.yasam.hamile_yok"),t("gida.yasam.onay_doktor")));
  if(prof.emziriyorum)out.push(yasamKart(t("gida.yasam.emzirme"),[alc,raw,trace],
    t("gida.yasam.emzirme_yok"),t("gida.yasam.onay_doktor")));
  if(prof.baby)out.push(yasamKart(t("gida.yasam.bebek"),[
    L.honey.length?["r",t("gida.yasam.bal")]:null,alc,
    L.caffeine.length?["r",t("gida.yasam.kafein",{l:j(L.caffeine)})]:null,raw,
    L.sweet.length?["y",t("gida.yasam.tatlandirici_bebek",{l:j(L.sweet)})]:null,hyp,trace],
    t("gida.yasam.bebek_yok"),t("gida.yasam.bebek_onay")));
  if(prof.child)out.push(yasamKart(t("gida.yasam.cocuk"),[alc,hyp,
    L.caffeine.length?["y",t("gida.yasam.kafein_cocuk",{l:j(L.caffeine)})]:null,
    L.sweet.length?["y",t("gida.yasam.tatlandirici",{l:j(L.sweet)})]:null,trace],
    t("gida.yasam.cocuk_yok"),t("ortak.onay_degil_etiket")));
  if(prof.pku)out.push(yasamKart(t("gida.yasam.pku"),[L.phe.length?["r",t("gida.yasam.aspartam",{l:j(L.phe)})]:null],
    t("gida.yasam.aspartam_yok"),t("gida.yasam.pku_not")));
  if(prof.pet)out.push(yasamKart(t("gida.yasam.pet"),[L.pet.length?["r",t("gida.yasam.pet_l",{l:j(L.pet)})]:null],
    t("gida.yasam.pet_yok"),t("gida.yasam.pet_onay"),
    t("gida.yasam.pet_ek")));
  if(prof.salt&&NA)out.push(yasamKart(t("gida.yasam.tuz"),[
    NA.salt.length?["y",NA.saltOrd&&NA.saltOrd<=3?t("gida.yasam.tuz_sira",{n:NA.saltOrd}):t("gida.yasam.tuz_var")]:null,
    NA.hidden.length?["y",t("gida.yasam.sodyum_gizli",{l:j(NA.hidden)})]:null],
    t("gida.yasam.tuz_yok"),t("gida.yasam.tuz_onay"),
    t("gida.yasam.tuz_ek")));
  return out;
}
/* Kozmetik. ptype: ürün tipi (Profilim'deki seçim dışında "bebek ürünü" seçilmişse çocuk kartları) */
export function profilKartKoz(S,res,metin,prof,ptype){
  var out=[],j=function(a){return a.join(", ")},oz=ozelKartVeri(metin,prof);
  if(oz)out.push(oz);
  if(prof.koku){
    if(S.fragrance.length)out.push(kartVeri("r",t("koz.prof.koku_var"),[j(S.fragrance)].concat(S.parfum?[t("koz.prof.koku_parfum")]:[])));
    else if(S.parfum)out.push(kartVeri("y",t("koz.prof.parfum"),[t("koz.prof.parfum_not")]));
    else out.push(kartVeri("g",t("koz.prof.koku_yok"),[t("ortak.onay_degil_okuma")]));
  }
  if(prof.vegan){
    var no=S.nonVeg.concat(S.nonVegan);
    if(no.length)out.push(kartVeri("r",t("gida.prof.vegan_degil"),[j(no)].concat(S.veganUnsure.length?[t("gida.prof.kaynak_belirsiz",{l:j(S.veganUnsure)})]:[])));
    else if(S.veganUnsure.length)out.push(kartVeri("y",t("gida.prof.vegan_belirsiz"),[t("koz.prof.vegan_belirsiz_l",{l:j(S.veganUnsure)})]));
    else out.push(kartVeri("g",t("koz.prof.hayvansal_yok"),[t("ortak.onay_degil_vegan")]));
  }
  if(prof.veg){
    if(S.nonVeg.length)out.push(kartVeri("r",t("gida.prof.vejetaryen_degil"),[t("koz.prof.kesim_l",{l:j(S.nonVeg)})]));
    else out.push(kartVeri("g",t("koz.prof.kesim_yok"),[t("ortak.onay_degil_etiket")]));
  }
  // Endokrin bozucu şüphesi: hamilelik ve küçük çocuklar için ayrı kart (yalnızca madde bulunursa)
  if((prof.preg||prof.baby||prof.child||ptype==="baby")&&(S.ed.length||S.child.length)){
    var el2=[];
    if(S.ed.length)el2.push(t("koz.prof.endokrin_l",{l:j(S.ed)}));
    if(S.child.length&&(prof.baby||prof.child||ptype==="baby"))el2.push(t("koz.prof.danimarka",{l:j(S.child)}));
    el2.push(prof.preg?t("koz.prof.hamile_doktor"):t("koz.prof.cocuk_doktor"));
    out.push(kartVeri("y",t("koz.ozet.endokrin"),el2));
  }
  if(prof.preg){
    if(S.vitA.length)out.push(kartVeri("y",t("koz.prof.hamile"),[t("koz.prof.vita",{l:j(S.vitA)})]));
    else out.push(kartVeri("g",t("gida.yasam.hamile_yok"),[t("koz.prof.hamile_onay")]));
  }
  if(prof.baby||prof.child||ptype==="baby"){
    var rows=[];res.forEach(function(r){var a=null;r.reg.forEach(function(e){if(e.kids_under&&(a===null||e.kids_under<a))a=e.kids_under});if(a)rows.push(t("koz.prof.cocuk_satir",{ad:r.name,n:a}))});
    if(rows.length)out.push(kartVeri("y",t("koz.prof.cocuk"),rows.concat([t("koz.prof.cocuk_not")])));
    else out.push(kartVeri("g",t("koz.prof.cocuk_yok"),[t("ortak.onay_degil_etiket")]));
  }
  return out;
}
/* Temizlik. T: temizlik dizini (H/EUH kodunun kısa adı) */
export function profilKartTem(S,A,metin,prof,T){
  var out=[],j=function(a){return a.join(", ")},has=function(c){return A.hazards.some(function(x){return x.code===c})};
  function name(c){return c+" ("+hzKisa(T.byCode[c])+")"}
  var oz=ozelKartVeri(metin,prof);if(oz)out.push(oz);
  if(prof.koku){
    var e208=has("EUH208")?[A.euh208&&A.euh208.length?t("tem.prof.euh208_l",{l:A.euh208.join("; ")}):t("tem.prof.euh208")]:[];
    if(S.fragrance.length)out.push(kartVeri("r",t("koz.prof.koku_var"),[j(S.fragrance)].concat(e208,S.parfum?[t("tem.prof.parfum_ek")]:[])));
    else if(S.parfum||e208.length)out.push(kartVeri("y",t("koz.prof.parfum"),e208.concat([t("tem.prof.parfum_not")])));
    else out.push(kartVeri("g",t("koz.prof.koku_yok"),[t("ortak.onay_degil_okuma")]));
  }
  if(prof.astim){
    var rows=[];
    if(S.resp.length)rows.push([S.resp.some(function(c){return /^(H334|EUH071)$/.test(c)})?"r":"y",t("tem.prof.solunum_l",{l:S.resp.map(name).join("; ")})]);
    if(S.enzyme)rows.push(["y",t("tem.prof.enzim")]);
    if(["H222","H223","H229","EUH211"].some(has))rows.push(["y",t("tem.prof.sprey")]);
    if(S.parfum)rows.push(["y",t("tem.prof.parfum_var")]);
    out.push(yasamKart(t("tem.prof.astim"),rows,t("tem.prof.solunum_yok"),t("ortak.onay_degil_okuma")));
  }
  if(prof.preg||prof.baby||prof.child){
    var r2=[];
    if(S.cmr.length)r2.push(["r",t("tem.prof.cmr_l",{l:S.cmr.map(name).join("; ")})]);
    if(S.ed.length)r2.push(["r",t("tem.prof.ed_l",{l:S.ed.map(name).join("; ")})]);
    if(prof.baby||prof.child){
      var sw=S.swallow.concat(S.eye).filter(function(c){return T.byCode[c].level==="red"});
      if(sw.length)r2.push(["r",t("tem.prof.yutma_ciddi",{l:sw.map(name).join("; ")})]);
      else if(S.swallow.length||S.eye.length)r2.push(["y",t("tem.prof.yutma",{l:S.swallow.concat(S.eye).map(name).join("; ")})]);
    }
    if((prof.baby||prof.child)&&A.capsule)r2.push(["r",t("tem.prof.kapsul")]);
    var who=prof.preg?"hamile":prof.baby?"bebek":"cocuk";
    out.push(yasamKart(t("tem.prof."+who),r2,t("tem.prof."+who+"_yok"),t("tem.prof.onay_sakla"),r2.length?{ozel:"zehir"}:null));
  }
  return out;
}
