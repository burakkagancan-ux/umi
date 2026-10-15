/* "Birlikte dikkat" eşleşmeleri (gıda ve kozmetik). Saf mantık; testler de yükler. */
import {itAd} from "./gida.js";
/* "Birlikte dikkat" eşleşmeleri (data/eslesmeler.json). items: [{keys:[E kodu ya da INCI adı], label}]
   cift: her gruptan en az bir madde (aynı madde iki grubu birden karşılayamaz); toplam: aynı gruptan en az R.min farklı madde */
export function findCombos(rules,mode,items){
  var out=[];
  (rules||[]).forEach(function(R){
    if(R.mode!==mode)return;
    var per=R.groups.map(function(g){var set={};(g.ids||g.inci||[]).forEach(function(x){set[x]=1});
      return items.filter(function(it){return it.keys.some(function(k){return set[k]})})});
    if(R.type==="cift"){
      if(!per.every(function(h){return h.length}))return;
      if(per.length===2&&per[0].length===1&&per[1].length===1&&per[0][0]===per[1][0])return;
    }else if(per[0].length<(R.min||2))return;
    out.push({rule:R,hits:per.map(function(h){return h.map(function(it){return it.label}).filter(function(x,i,a){return a.indexOf(x)===i})})});
  });
  return out;
}
export function comboItemsFood(res,idx){
  return res.filter(function(r){return !r.isB&&!r.neg&&!r.may}).map(function(r){
    return {keys:r.ids,label:r.ids.length===1?r.ids[0]+" "+itAd(idx.byId[r.ids[0]]):r.text}});
}
export function comboItemsK(res){
  return res.filter(function(r){return r.found&&!r.may}).map(function(r){return {keys:[r.name].concat(r.name.split(" / ")),label:r.name}});
}
