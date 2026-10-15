/* İki ürünü (gıda, kozmetik ya da temizlik) karşılaştırma: saf mantık (DOM yok); testler de yükler. Skor yok: karar madde seviyelerine, profile ve alerjenlere dayanır.
   Seviye (rank): 0 özel uyarı yok, 1 doğrulanmadı, 2 dikkat, 3 uyarı (gida.js RANK). Bileşenler (seviyesiz) 0 sayılır. */
import {DIL, t} from "./ceviri.js";
/* Ürün modeli (cmpProduct, cmpProductK, cmpProductT, profil uyumsuzluğu) js/degerlendirme.js'te; burada karar, farklar ve tarama geçmişi */
/* Karar cümlelerinde seviye adı ve madde sözcüğü: çeviri anahtarları kars.sev.0-3, kars.noun.madde/tem */

/* Madde farkları: anahtar madde kimliğidir (E322 ile "soya lesitini" aynı madde) */
export function cmpDiff(A,B){
  var kb={},ka={},o={onlyA:[],onlyB:[],both:[]};
  B.items.forEach(function(it){kb[it.key]=it});A.items.forEach(function(it){ka[it.key]=it});
  A.items.forEach(function(it){if(kb[it.key])o.both.push({key:it.key,ids:it.ids,name:it.name,rank:Math.max(it.rank,kb[it.key].rank),dogal:it.dogal,kind:it.kind,x:it.x});else o.onlyA.push(it)});
  B.items.forEach(function(it){if(!ka[it.key])o.onlyB.push(it)});
  return o;
}

export function cmpHighUnknown(P,cfg){return P.unknown.total>=cfg.enAzParca&&P.unknown.ratio>cfg.taninmayanOran}

/* Karar (sırayla): profil uyumu, en riskli maddenin seviyesi, dikkat (sarı) madde sayısı, yoksa "Benzer".
   Tanınmayan oranı yüksek üründe kazanan ilan edilmez. Dil: "içerik açısından daha iyi görünüyor"; "sağlıklı" denmez. */
export function cmpDecide(A,B,cfg){
  var P={A:A,B:B},o=function(w,kind,title,reason){return {winner:w,kind:kind,title:title,reason:reason||""}};
  var other=function(k){return k==="A"?"B":"A"};
  var winT=function(k){return t("kars.karar.daha_iyi",{ad:P[k].name})};
  var mA=A.misfit.length>0,mB=B.misfit.length>0;
  if(mA&&mB)return o(null,"ikisi_uyumsuz",t("kars.karar.ikisi_uyumsuz"),t("kars.karar.ikisi_uyumsuz_not"));
  if(mA||mB){
    var lk=mA?"A":"B",wk=other(lk),why=t("kars.karar.uymuyor",{ad:P[lk].name,l:P[lk].misfit[0]});
    if(cmpHighUnknown(P[wk],cfg))return o(null,"taninmadi",t("kars.karar.taninamadi_bir",{ad:P[wk].name}),why+" "+t("kars.karar.diger_karar_yok"));
    return o(wk,"profil",winT(wk),why);
  }
  var hu=["A","B"].filter(function(k){return cmpHighUnknown(P[k],cfg)});
  if(hu.length)return o(null,"taninmadi",hu.length>1?t("kars.karar.taninamadi_iki",{a:P[hu[0]].name,b:P[hu[1]].name}):t("kars.karar.taninamadi_bir",{ad:P[hu[0]].name}),t("kars.karar.kontrol"));
  var w,l,r;
  if(A.maxRank!==B.maxRank){
    w=A.maxRank<B.maxRank?"A":"B";l=other(w);
    r=t("kars.karar.yalnizca",{sev:t("kars.sev."+P[l].maxRank),noun:t("kars.noun."+(P[l].noun||"madde")),l:P[l].top.slice(0,2).map(function(x){return x.name}).join(", "),ad:P[l].name});
    return o(w,"en_riskli",winT(w),cmpExtra(r,P[w],P[l]));
  }
  if(A.yellow!==B.yellow){
    w=A.yellow<B.yellow?"A":"B";l=other(w);
    r=t("kars.karar.dikkat_sayisi",{noun:t("kars.noun."+(P[w].noun||"madde")),a:P[w].name,na:P[w].yellow,b:P[l].name,nb:P[l].yellow});
    return o(w,"dikkat",winT(w),cmpExtra(r,P[w],P[l]));
  }
  return o(null,"benzer",t("kars.karar.benzer"),t("kars.karar.benzer_not"));
}
/* Kazananın lehine tek bir ek fark (yalnızca gıda): palm yağı ya da şeker kaynağı sayısı */
export function cmpExtra(r,W,L){
  if(!L.palm||!W.palm)return r;   // kozmetik ve temizlikte bu ek fark yok
  if(L.palm.length&&!W.palm.length)return r+" "+t("kars.karar.palm",{ad:L.name});
  if(L.sugar.length>W.sugar.length)return r+" "+t("kars.karar.seker",{a:W.name,na:W.sugar.length,b:L.name,nb:L.sugar.length});
  return r;
}

/* Tarama geçmişi: en yeni başta, aynı tür + aynı metin tekrar eklenmez, en fazla max kayıt */
/* Varsayılan ad: "Tarama N" (dile göre kars.tarama_n); N, geçmişteki en büyük sıra numarasının bir fazlası */
export function histName(list){var n=0;(list||[]).forEach(function(x){var k=histOtoNo(x.name);if(k>n)n=k});return t("kars.tarama_n",{n:n+1})}
/* Otomatik ad mı? Yüklü her dilin biçimi tanınır (dil değişse de eski "Tarama 3" otomatik sayılır); sıra numarasını, değilse 0 döndürür */
export function histOtoNo(name){
  name=name||"";
  for(var k in DIL.sozluk){var p=DIL.sozluk[k]&&DIL.sozluk[k]["kars.tarama_n"];if(!p||p.indexOf("{n}")<0)continue;
    var re=new RegExp("^"+p.split("{n}").map(function(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}).join("(\\d+)")+"$"),m=re.exec(name);if(m)return +m[1]}
  return 0;
}
export function histAdd(list,e,max){
  var tx=(e.text||"").trim();if(!tx)return list.slice(0,max);
  var out=(list||[]).filter(function(x){return !(x.mode===e.mode&&(x.text||"").trim()===tx)});
  out.unshift(e);return out.slice(0,max);
}
