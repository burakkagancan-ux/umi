/* Ansiklopedi: saf mantık (DOM yok). Kayıt doğrulama, Türkçe harf duyarsız arama, profil uyarısı eşleştirme. ortak.js'ten sonra yüklenir; testler de yükler. */
import {norm} from "./ortak.js";
export var ANS={
  risk:["green","amber","red"],evidence:["strong","moderate","limited"],diet:["yes","no","unknown"],
  source:["plant","animal","insect","synthetic","mineral","plant_or_animal","unknown"],ptype:["food","cosmetic","cleaning"],
  severity:["high","medium","low"],review:["curated","auto"],production:["dogal","fermente","islenmis","sentetik","belirsiz"],
  effect:["resmi","bildirildi","tutarsiz","hayvan","asim","belirsiz","yok"],
  status:["approved","label_required","restricted","concern","classified","banned","withdrawn","not_listed","reviewed"]
};
/* Arama anahtarı: ı/i, ş/s vb. eşlenir, büyük/küçük harf, boşluk ve tire yok sayılır ("E-322" = "e322") */
export function ansFold(s){return norm(String(s||"")).replace(/ /g,"")}
export function ansSlug(s){return norm(String(s||"")).replace(/ /g,"-")}
export function ansT(T,k){return k&&T&&Object.prototype.hasOwnProperty.call(T,k)?T[k]:""}
/* Kayıt doğrulama: hata listesi döner (boşsa geçerli). ids verilirse related_ids'in varlığı da denetlenir. */
export function ansValidate(r,T,ids){
  var e=[],cur=r&&r.review==="curated";
  function need(c,m){if(!c)e.push(m)}
  function txt(k,m){need(typeof k==="string"&&ansT(T,k).trim()!=="",m)}
  function inn(v,list,m){need(list.indexOf(v)>-1,m+" geçersiz: "+v)}
  if(!r||typeof r!=="object")return["kayıt yok"];
  need(typeof r.id==="string"&&r.id!=="","id eksik");
  need(typeof r.slug==="string"&&/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug),"slug geçersiz");
  need(r.names&&typeof r.names==="object","names eksik");
  if(r.names){txt(r.names.primary,"names.primary eksik");need(Array.isArray(r.names.aliases)&&r.names.aliases.length>0,"names.aliases boş")}
  need(typeof r.category==="string"&&r.category!=="","category eksik");
  need(Array.isArray(r.product_types)&&r.product_types.length>0,"product_types boş");
  (r.product_types||[]).forEach(function(p){inn(p,ANS.ptype,"product_types")});
  inn(r.risk_level,ANS.risk,"risk_level");
  inn(r.review,ANS.review,"review");
  if(cur||r.evidence_level!=null)inn(r.evidence_level,ANS.evidence,"evidence_level");
  if(cur||r.summary!=null)txt(r.summary,"summary eksik");
  need(r.content&&typeof r.content==="object","content eksik");
  if(r.content){
    txt(r.content.what_it_does,"content.what_it_does eksik");
    need(Array.isArray(r.content.found_in)&&(!cur||r.content.found_in.length>0),"content.found_in boş");
    (r.content.found_in||[]).forEach(function(k){txt(k,"content.found_in metni eksik")});
    if(r.content.in_the_body!=null)txt(r.content.in_the_body,"content.in_the_body eksik");
  }
  // Olası etkiler: elle incelenen her kayıtta en az bir satır; her satırın düzeyi, metni ve https kaynağı olur
  need(Array.isArray(r.effects)&&(!cur||r.effects.length>0),"effects boş");
  (r.effects||[]).forEach(function(x){
    inn(x.level,ANS.effect,"effects.level");txt(x.text,"effects.text eksik");
    if(x.who!=null)txt(x.who,"effects.who eksik");if(x.amount!=null)txt(x.amount,"effects.amount eksik");
    need(x.source&&x.source.label&&/^https:\/\//.test(x.source.url||""),"effects.source geçersiz");
  });
  if(r.agency_note!=null)txt(r.agency_note,"agency_note eksik");
  need(r.diet_flags&&typeof r.diet_flags==="object","diet_flags eksik");
  if(r.diet_flags){inn(r.diet_flags.vegan,ANS.diet,"diet_flags.vegan");inn(r.diet_flags.gluten,ANS.diet,"diet_flags.gluten");inn(r.diet_flags.source,ANS.source,"diet_flags.source")}
  if(r.production!=null){inn(r.production.class,ANS.production,"production.class");txt(r.production.note,"production.note eksik")}
  need(Array.isArray(r.regulatory),"regulatory eksik");
  (r.regulatory||[]).forEach(function(g){need(g.agency,"regulatory.agency eksik");need(g.region,"regulatory.region eksik");inn(g.status,ANS.status,"regulatory.status");txt(g.detail,"regulatory.detail eksik")});
  need(Array.isArray(r.profile_warnings),"profile_warnings eksik");
  (r.profile_warnings||[]).forEach(function(w){need(typeof w.profile==="string"&&w.profile!=="","profile_warnings.profile eksik");inn(w.severity,ANS.severity,"profile_warnings.severity");txt(w.text,"profile_warnings.text eksik")});
  need(Array.isArray(r.related_ids),"related_ids eksik");
  if(ids)(r.related_ids||[]).forEach(function(x){need(ids[x]&&x!==r.id,"related_ids bulunamadı: "+x)});
  need(Array.isArray(r.sources),"sources eksik");
  (r.sources||[]).forEach(function(s){need(s.title&&s.publisher,"sources başlık/yayıncı eksik");need(s.url===""?!!s.todo:/^https:\/\//.test(s.url||""),"sources url geçersiz (bilinmiyorsa boş + todo)")});
  // Kaynak kuralı: elle incelenen her kaydın en az bir resmi kaynağı olur
  if(cur){need((r.sources||[]).some(function(s){return s.official&&s.url}),"resmi kaynak yok");need(/^\d{4}-\d\d-\d\d$/.test(r.last_reviewed||""),"last_reviewed eksik")}
  return e;
}
/* Arama dizini: her kayıt için ad, kod ve eş anlamlıların katlanmış biçimleri */
export function ansIndex(recs,T){
  return recs.map(function(r){
    var keys=[r.id,ansT(T,r.names.primary)].concat(r.names.aliases).map(ansFold).filter(function(k){return k});
    return {r:r,keys:keys};
  });
}
/* Sıra: tam eşleşme > başında geçen > içinde geçen; eşitlikte veri sırası */
export function ansSearch(idx,q,limit){
  var f=ansFold(q);if(!f)return[];
  var out=[];
  idx.forEach(function(x,i){
    var best=9;
    x.keys.forEach(function(k){var s=k===f?0:k.indexOf(f)===0?1:k.indexOf(f)>0?2:9;if(s<best)best=s});
    if(best<9)out.push({r:x.r,s:best,i:i});
  });
  out.sort(function(a,b){return a.s-b.s||a.i-b.i});
  return out.slice(0,limit||30).map(function(x){return x.r});
}
/* Profil uyarısı yalnızca kullanıcının seçtiği hassasiyetle eşleşirse döner. prof: localStorage "profil" biçimi ({al:[...], vegan:true, ...}) */
export function ansProfileWarnings(r,prof){
  if(!prof)return[];
  return (r.profile_warnings||[]).filter(function(w){
    if(w.profile.indexOf("allergen_")===0)return Array.isArray(prof.al)&&prof.al.indexOf(w.profile)>-1;
    return prof[w.profile]===true;
  });
}
