/* Paylaşılabilir sonuç kartı: saf mantık (DOM yok). Kart modeli, paylaşım metni, satır kırma ve canvas çizimi.
   Çizim yalnızca verilen 2B bağlamı (ctx) kullanır; testler sahte bir bağlamla çizilen metinleri denetler.
   Seviye (lvl): 0 özel uyarı yok, 1 dikkat, 2 uyarı. Skor yok. Kişisel (profil) uyarılar yalnızca opt.kisisel açıkken karta girer. */
var PAY_LBL=["risk.yok","risk.dikkat","risk.uyari"];   // çeviri anahtarları
/* Tarih dile göre (Intl): "5 Ekim 2026", "5 Ekim 14:30" */
function payGun(ms){return dilTarih(ms,"gun")}
function payTarih(ms){return dilTarih(ms,"gunsaat")}
/* Kartta ürün adı: kullanıcının verdiği ad; otomatik ad ("Tarama 3") ise sıra + tarih ve saat */
function payAd(e,now){
  if(!e)return t("pay.ad_tarih",{ad:t("pay.tarama"),d:payTarih(now||Date.now())});
  var no=histOtoNo(e.name);
  if(no||!(e.name||"").trim())return t("pay.ad_tarih",{ad:no?t("kars.tarama_n",{n:no}):t("pay.tarama"),d:payTarih(e.t||now||Date.now())});
  return e.name.trim();
}
/* Otomatik ad mı (tarih kartın başında ayrıca yazılmaz)? */
function payOtoAd(name){var T=t("pay.tarama");return name===T||(name||"").indexOf(T+" ")===0}
function payUniq(items){var by={},out=[];items.forEach(function(it){var k=it.name;if(by[k]){if(it.lvl>by[k].lvl){by[k].lvl=it.lvl;by[k].why=it.why||""}return}by[k]={name:it.name,lvl:it.lvl,why:it.why||""};out.push(by[k])});return out}
/* Gıda maddesinin karttaki kısa gerekçesi: en önemli bayraktan bir olgu (kaynak ve ayrıntı sonuç ekranında). Metin: pay.neden.<bayrak> */
var PAY_NEDEN_E=[["banned_eu",1],["eu_warning_label",1],["hyperactivity","eu_warning_label"],["fda_banned",1],
  ["iarc_listed",null],["reproductive_toxicity",1],["allergen_sulphite",1],["phenylalanine",1],
  ["laxative_polyols",1],["fodmap",1],["adi",null],["debated",1],["sodium",1]];
/* Aşağıdaki düzenli ifadeler veri metnine (e_kodlari.json reason, Türkçe) bakar; arayüz metni değildir */
var PAY_ADI=/ADI|alım değer/,PAY_ADI_ASIM=/aş(ıl|ab|ım)|üzerinde olduğ/;   // EFSA'nın tahmini alım ADI'yi aşabilir dediği maddeler (K6)
function payNedenE(ids,idx){
  var its=ids.map(function(id){return idx.byId[id]}).filter(function(it){return it&&!it.isB});
  for(var k=0;k<PAY_NEDEN_E.length;k++)for(var j=0;j<its.length;j++){
    var it=its[j],rs=it.reason||"";
    if(PAY_NEDEN_E[k][0]==="adi"){if(PAY_ADI.test(rs)&&PAY_ADI_ASIM.test(rs))return t("pay.neden.adi");continue}
    if((it.flags||[]).indexOf(PAY_NEDEN_E[k][0])<0)continue;
    if(PAY_NEDEN_E[k][1])return t("pay.neden."+(PAY_NEDEN_E[k][1]===1?PAY_NEDEN_E[k][0]:PAY_NEDEN_E[k][1]));
    // IARC grubu maddenin kendisine değil de oluşabilen ya da yan ürün olan maddeye aitse karta öyle yazılır (benzoatlarda benzen, karamelde 4-MEI, E239'da formaldehit)
    var g=/Grup (1|2A|2B)\b/.exec(rs);
    if(/formaldehite ayrış/i.test(rs))return t("pay.neden.formaldehit");
    if(/benzen/i.test(rs))return t("pay.neden.benzen");
    if(/yan ürün/i.test(rs))return g?t("pay.neden.yan_urun_grup",{g:g[1]}):t("pay.neden.yan_urun");
    return g?t("pay.neden.iarc_grup",{g:g[1]}):t("pay.neden.iarc");
  }
  return its.length?veriS(its[0].category||"",null):"";
}
/* Gıda: karşılaştırmadaki ürün özeti (cmpProduct) kullanılır; rank 3 uyarı, 2 dikkat, 1 doğrulanmadı, 0 özel uyarı yok */
function payFromFood(text,idx){
  var P=cmpProduct(text,idx,null,""),items=[],unv=0,S=P.S,L=S.life,f=[];
  P.items.forEach(function(it){if(it.rank===1){unv++;return}items.push({name:it.name,lvl:it.rank===3?2:it.rank===2?1:0,why:it.rank>1?payNedenE(it.ids,idx):""})});
  var a=P.allergen,al=(a.yes.length?t("ortak.icerir_l",{l:a.yes.join(", ")}):"")+(a.yes.length&&a.may.length?" · ":"")+(a.may.length?t("ortak.icerebilir_l",{l:a.may.join(", ")}):"");
  // Ürüne ait olgular (kişisel değil): gri bilgi etiketi olarak çizilir
  if(P.vegan==="degil")f.push(t("gida.prof.vegan_degil"));
  if(P.palm.length)f.push(t("pay.olgu.palm"));
  if(P.sugar.length)f.push(P.sugar.length>1?t("pay.olgu.seker_tur",{n:P.sugar.length}):t("pay.olgu.seker"));
  if(L.sweet.length)f.push(t("pay.olgu.tatlandirici"));
  if(L.caffeine.length)f.push(t("pay.olgu.kafein"));
  if(L.alcohol.length)f.push(t("pay.olgu.alkol"));
  return {mode:"gida",items:payUniq(items),unverified:unv,allergens:al,facts:f,recog:{total:P.unknown.total,found:P.unknown.found}};
}
/* Kozmetik maddesinin kısa gerekçesi. K: kozmetik dizini (watchLists için; yoksa liste kimliği yazılmaz) */
var PAY_NEDEN_K=["cmr2_carc","cmr2","formaldehyde_releaser","pfas","allergen_preservative","allergen_hairdye","allergen_fragrance"];   // sırayla; metin pay.nedenk.<bayrak>
function payNedenK(r,K){
  if(r.level==="red"&&(r.reg||[]).some(function(e){return e.annex==="II"}))return t("koz.seviye.red");
  var W=(K&&K.watchLists)||{},k3=(r.k3||[]).filter(function(w){return W[w.list]}).map(function(w){var L=W[w.list];return {level:L.level,chip:veriS(L.chip,"k.liste."+w.list+".cip")}});
  var o=k3.filter(function(L){return L.level==="orange"})[0];if(r.level==="orange"&&o)return o.chip;
  var fl=[];(r.reg||[]).forEach(function(e){fl=fl.concat(e.flags||[])});fl=fl.concat(r.iflags||[]);
  for(var k=0;k<PAY_NEDEN_K.length;k++)if(fl.indexOf(PAY_NEDEN_K[k])>-1)return t("pay.nedenk."+PAY_NEDEN_K[k]);
  var y=k3.filter(function(L){return L.level!=="info"})[0];if(y)return y.chip;
  var an=(r.reg||[]).map(function(e){return e.annex}).filter(Boolean)[0];
  return an?t("pay.nedenk.sinirli",{ek:String(an).trim()}):"";
}
/* Kozmetik: AB'de yasak ve başka pazarda yasak (red/orange) uyarı, yellow dikkat */
function payFromK(res,S,K){
  var items=[],f=[];
  res.forEach(function(r){if(!r.found)return;var l=r.level==="red"||r.level==="orange"?2:r.level==="yellow"?1:0;items.push({name:r.name,lvl:l,why:l?payNedenK(r,K):""})});
  if(S&&(S.nonVegan||[]).concat(S.nonVeg||[]).length)f.push(t("gida.prof.vegan_degil"));
  return {mode:"koz",items:payUniq(items),unverified:0,allergens:S&&S.fragrance.length?S.fragrance.join(", "):"",facts:f,
    recog:S&&S.total?{total:S.total,found:S.found}:null};
}
/* Temizlik: tehlike ifadeleri ve madde notları; ciddi tehlike (red) uyarı, yellow dikkat */
function payFromT(A,S){
  var items=[],L=function(l){return l==="red"?2:l==="yellow"?1:0},f=[];
  A.hazards.forEach(function(x){var l=L(x.h.level);items.push({name:x.code+" "+hzKisa(x.h),lvl:l})});   // ifadenin kendisi açıklayıcı; iki satıra tam yazılır
  A.subs.forEach(function(x){var l=L(x.s.level);items.push({name:x.s.inci.length>1?t("tem.enzim_l",{l:x.s.inci.join(", ").toLowerCase()}):x.s.inci[0],lvl:l,why:l&&x.s.mix?t("pay.neden.gaz"):""})});
  A.inci.forEach(function(x){items.push({name:x.name,lvl:0})});
  if(A.signal)f.push(t("pay.olgu.kelime",{l:t(A.signal==="tehlike"?"kars.satir.tehlike_buyuk":"kars.satir.dikkat_buyuk")}));
  if(A.capsule)f.push(t("pay.olgu.kapsul"));
  return {mode:"tem",items:payUniq(items),unverified:0,allergens:S&&S.fragrance.length?S.fragrance.join(", "):"",facts:f,recog:null};
}
/* Kart modeli. src: {mode, items:[{name,lvl,why}], unverified, allergens, facts, recog, personal:[{t:metin, lvl:1|2}]}; opt: {name, kisisel, t}; L: yerleşim (madde sayısı için) */
function payModel(src,opt,cfg,L){
  opt=opt||{};cfg=cfg||PAYLAS_AYAR;
  var items=(src.items||[]).slice(),c=[0,0,0];
  items.forEach(function(it){c[it.lvl]++});
  var risky=items.filter(function(it){return it.lvl>0}).map(function(it,i){return {name:it.name,lvl:it.lvl,why:it.why||"",i:i}});
  risky.sort(function(a,b){return b.lvl-a.lvl||a.i-b.i});   // en riskliden başlayarak, eşitlikte okunduğu sıra
  var n=(L&&L.enFazlaMadde)||cfg.enFazlaMadde,top=risky.slice(0,n).map(function(x){return {name:x.name,lvl:x.lvl,why:x.why}});
  var pers=opt.kisisel?(src.personal||[]).slice(0,cfg.enFazlaKisisel):[];
  return {mode:src.mode,name:opt.name||t("pay.tarama"),counts:{ok:c[0],dikkat:c[1],uyari:c[2]},unverified:src.unverified||0,
    total:items.length,top:top,more:Math.max(0,risky.length-n),allergens:src.allergens||"",personal:pers,
    facts:(src.facts||[]).slice(),recog:src.recog||null,t:opt.t||null,
    okNames:items.filter(function(it){return it.lvl===0}).map(function(it){return it.name}),
    hasPersonal:!!(src.personal&&src.personal.length)};
}
/* Ürün adının altındaki tek satırlık olgu özeti (skor değil, yalnızca sayı) */
function payOzet(M){
  var n=M.counts.dikkat+M.counts.uyari;
  if(!n)return "";
  return t(M.mode==="tem"?"pay.ozet_tem":"pay.ozet",{toplam:M.total,n:n});
}
/* Paylaşım metni (görselle birlikte) */
function payText(M,cfg){
  cfg=cfg||PAYLAS_AYAR;
  var n=M.counts.dikkat+M.counts.uyari,tm=M.mode==="tem"?"_tem":"";
  var s=n?t("pay.metin.var"+tm,{n:n}):t("pay.metin.yok"+tm);
  return t("pay.metin",{ad:M.name,s:s,uyg:cfg.uygulamaAdi,adres:cfg.adres});
}
/* Metni en çok maxLines satıra böler; sığmayan son satır "…" ile kısaltılır. measure(metin) → piksel genişliği */
function payWrap(text,maxW,maxLines,measure){
  var words=String(text||"").replace(/\s+/g," ").trim().split(" ").filter(Boolean),lines=[],cur="";
  function cut(s){if(measure(s)<=maxW)return s;while(s.length>1&&measure(s+"…")>maxW)s=s.slice(0,-1);return s.replace(/[\s,·:;-]+$/,"")+"…"}
  words.forEach(function(w){var c=cur?cur+" "+w:w;if(measure(c)<=maxW||!cur)cur=c;else{lines.push(cur);cur=w}});
  if(cur)lines.push(cur);
  if(lines.length>maxLines)lines=lines.slice(0,maxLines-1).concat([lines.slice(maxLines-1).join(" ")]);
  return lines.map(cut);
}
/* ---------- Çizim ---------- */
var PAY_RENK={bg:"#F5F1E8",card:"#FFFFFF",line:"#E4DED2",ok:"#1F4D3A",okbg:"#E6EFE9",ink:"#1B211E",mute:"#5A615C",amb:"#8A5A00",ambbg:"#FFF3D1",hi:"#A4470B",hibg:"#FCE9DA",red:"#B3261E",redbg:"#FBE9E7",sunk:"#EEE9DD",bant2:"#CFE0D6",notr:"#8A8F8B"};
var PAY_HF='"Bricolage Grotesque",system-ui,sans-serif',PAY_BF='"Figtree",system-ui,sans-serif';
/* Dil dosyasında yazı tipi tanımlıysa (i18n/diller.json "yazi": Latin dışı alfabe) kartta da o kullanılır */
function payYazi(hf){var y=typeof DIL!=="undefined"&&DIL.yazi;return hf?(y&&y.baslik)||PAY_HF:(y&&y.govde)||PAY_BF}
function payRR(x,X,Y,W,H,r){x.beginPath();x.moveTo(X+r,Y);x.lineTo(X+W-r,Y);x.quadraticCurveTo(X+W,Y,X+W,Y+r);x.lineTo(X+W,Y+H-r);x.quadraticCurveTo(X+W,Y+H,X+W-r,Y+H);x.lineTo(X+r,Y+H);x.quadraticCurveTo(X,Y+H,X,Y+H-r);x.lineTo(X,Y+r);x.quadraticCurveTo(X,Y,X+r,Y);x.closePath()}
/* Seviye simgesi (sonuç ekranıyla aynı): gri daire + tire (özel uyarı yok; yeşil onay yalnızca doğal kaynaklı tek maddede, kartta madde düzeyinde gösterilmez), amber üçgen + ünlem, koyu turuncu daire + ünlem; cx,cy merkez, s boyut */
function payIcon(x,lvl,cx,cy,s,red){
  var k=s/24;x.save();x.translate(cx-s/2,cy-s/2);x.scale(k,k);
  x.lineCap="round";x.lineJoin="round";x.strokeStyle="#FFFFFF";x.lineWidth=2.4;
  if(lvl===1){x.fillStyle=PAY_RENK.amb;x.beginPath();x.moveTo(12,2.5);x.lineTo(23,21.5);x.lineTo(1,21.5);x.closePath();x.fill();
    x.beginPath();x.moveTo(12,9);x.lineTo(12,15);x.stroke();x.fillStyle="#FFFFFF";x.beginPath();x.arc(12,18.2,1.4,0,Math.PI*2);x.fill()}
  else{x.fillStyle=lvl===2?(red?PAY_RENK.red:PAY_RENK.hi):PAY_RENK.notr;x.beginPath();x.arc(12,12,10,0,Math.PI*2);x.fill();
    if(lvl===2){x.beginPath();x.moveTo(12,6.5);x.lineTo(12,13.5);x.stroke();x.fillStyle="#FFFFFF";x.beginPath();x.arc(12,17.2,1.5,0,Math.PI*2);x.fill()}
    else{x.beginPath();x.moveTo(7.5,12);x.lineTo(16.5,12);x.stroke()}}
  x.restore();
}
function payFont(x,w,px,hf){x.font=w+" "+px+"px "+payYazi(hf)}
/* Gri bilgi etiketlerini (olgular) satırlara yerleştirir: [{s, x, w, row}] */
function payChips(x,list,maxW,maxRows){
  var out=[],cx=0,row=0,pad=22,gap=12;
  for(var i=0;i<list.length;i++){
    var w=x.measureText(list[i]).width+2*pad;if(w>maxW)continue;
    if(cx&&cx+w>maxW){row++;cx=0}
    if(row>=maxRows)break;
    out.push({s:list[i],x:cx,w:w,row:row});cx+=w+gap;
  }
  return out;
}
/* Kartı çizer. L: yerleşim (PAYLAS_AYAR.yerlesim[boyut]); logo: yüklenmiş görüntü ya da null. Çizilen metinler sırayla döner (test için).
   Bölümler yukarıdan aşağı akar; sığmazsa önce madde satırı sayısı azalır ("+N madde daha"), sonra bilgi etiketleri düşer. Not ve alt bant sabit. */
function payDraw(x,M,L,cfg,logo){
  cfg=cfg||PAYLAS_AYAR;
  var W=L.w,H=L.h,P=L.pad,CW=W-2*P,out=[],R=PAY_RENK,draw=true,tem=M.mode==="tem";
  // Sağdan sola dillerde (DIL.yon "rtl") yerleşim aynalanır: x koordinatları W-x, hizalama ters, metin yönü rtl
  var rtl=typeof DIL!=="undefined"&&DIL.yon==="rtl",AL={left:"right",right:"left",center:"center"};
  function mx(X){return rtl?W-X:X}
  function meas(s){return x.measureText(s).width}
  function txt(s,X,Y,col,al){if(!draw)return;x.fillStyle=col;x.textAlign=rtl?AL[al||"left"]:al||"left";if(rtl)x.direction="rtl";x.fillText(s,mx(X),Y);out.push(s)}
  function box(X,Y,w,h,r,col){if(!draw)return;x.fillStyle=col;payRR(x,rtl?W-X-w:X,Y,w,h,r);x.fill()}
  function icon(l,cx,cy,sz,red){if(draw)payIcon(x,l,mx(cx),cy,sz,red)}
  x.textBaseline="alphabetic";
  var foot=H-L.bant,risky=M.top.length>0;
  // Alt bölüm (sabit): tanınma satırı + not
  payFont(x,400,26);
  var notL=payWrap(cfg.not+" "+t("pay.kart.not_ek"),CW,2,meas);
  var recog=M.recog&&M.recog.total>=3?t("pay.kart.taninma",{toplam:M.recog.total,n:M.recog.found}):"";
  var bottomH=notL.length*34+(recog?40:0)+36,maxY=foot-bottomH-24;
  // Üst bölüm
  function head(y){
    payFont(x,600,30);
    var tl=t("pay.kart.ust_"+M.mode);
    txt(tl,P,y+30,R.ok);
    if(M.t&&!payOtoAd(M.name)){payFont(x,400,30);txt(payGun(M.t),W-P,y+30,R.mute,"right")}
    y+=58;payFont(x,700,L.ad,true);
    payWrap(M.name,CW,L.adSatir,meas).forEach(function(l){y+=L.ad*1.08;txt(l,P,y,R.ink)});
    var oz=payOzet(M);
    if(oz){payFont(x,600,36);y+=60;txt(oz,P,y,R.ink)}
    return y+44;
  }
  // Kutu etiketi: sığmazsa yazı küçülür, en küçük boyutta da sığmazsa iki satıra bölünür (dile göre uzunluk değişir: "özel uyarı yok" / "no specific warning").
  // Satırlar Y'den yukarı doğru yerleşir (son satır Y'de); iki satıra bölünürse son satır kaydir kadar aşağı iner
  function etiket(s,px,maxW,X,Y,col,kaydir){payFont(x,600,px);while(px>22&&meas(s)>maxW){px-=2;payFont(x,600,px)}
    var ls=meas(s)>maxW?payWrap(s,maxW,2,meas):[s];if(ls.length>1)Y+=kaydir||0;ls.forEach(function(l,i){txt(l,X,Y-(ls.length-1-i)*px*1.1,col)})}
  // Sayı kutuları: renkli zemin + şekil; sıfır olan kutu soluk
  function counts(y){
    var gap=20,bw=(CW-2*gap)/3,tek=L.kutuTek,bh=tek?L.sayi+44:L.sayi+116;   // kutuTek: simge + etiket + sayı tek satırda (kısa kart)
    [[0,M.counts.ok,t("pay.kart.kutu_yok"),R.sunk,R.ink],[1,M.counts.dikkat,t("pay.kart.kutu_dikkat"),R.ambbg,R.amb],[2,M.counts.uyari,t("pay.kart.kutu_uyari"),R.hibg,R.hi]].forEach(function(b,i){
      var bx=P+i*(bw+gap),on=b[1]>0;
      box(bx,y,bw,bh,28,on?b[3]:R.card);
      if(draw&&!on){x.strokeStyle=R.line;x.lineWidth=2;payRR(x,bx+1,y+1,bw-2,bh-2,27);x.stroke()}
      if(tek){
        icon(b[0],bx+44,y+42,36);etiket(b[2],28,bw-48,bx+24,y+bh-24,on?R.ink:R.mute);
        payFont(x,700,L.sayi,true);txt(String(b[1]),bx+bw-24,y+L.sayi*0.78+14,on?b[4]:R.mute,"right");
      }else{
        icon(b[0],bx+50,y+52,40);
        etiket(b[2],30,bw-82-20,bx+82,y+63,on?R.ink:R.mute,26);
        payFont(x,700,L.sayi,true);txt(String(b[1]),bx+30,y+bh-30,on?b[4]:R.mute);
      }
    });
    y+=bh;
    if(M.unverified){payFont(x,400,28);y+=42;txt(t("pay.kart.dogrulanmadi",{n:M.unverified}),P,y,R.mute)}
    return y+40;
  }
  // Öne çıkan maddeler: ad + kısa gerekçe + seviye etiketi
  function rows(y,n){
    var rh=L.maddeSatir,more=M.more+(M.top.length-n),bh=n*rh+(more?60:0)+16;
    box(P,y,CW,bh,28,R.card);
    M.top.slice(0,n).forEach(function(it,i){
      var ry=y+8+i*rh,cy=ry+rh/2;
      if(i&&draw){x.fillStyle=R.line;x.fillRect(P+32,ry,CW-64,2)}
      icon(it.lvl,P+58,cy,48);
      payFont(x,600,30);var lb=t(PAY_LBL[it.lvl]),pw=meas(lb)+40;
      box(P+CW-32-pw,cy-26,pw,52,26,it.lvl===2?R.hibg:R.ambbg);
      txt(lb,P+CW-32-pw/2,cy+10,it.lvl===2?R.hi:R.amb,"center");
      var fw=CW-108-pw-52,fs=L.madde;payFont(x,600,fs);
      var nm=payWrap(it.name,fw,1,meas);
      if(meas(it.name)>fw){fs=Math.round(L.madde*0.8);payFont(x,600,fs);nm=payWrap(it.name,fw,it.why?1:2,meas)}
      var lines=nm.length+(it.why?1:0),lh=fs*1.15,top=cy-(lines*lh)/2;
      nm.forEach(function(l,k){txt(l,P+108,top+fs*0.85+k*lh,R.ink)});
      if(it.why){payFont(x,400,28);txt(payWrap(it.why,fw,1,meas)[0],P+108,top+nm.length*lh+24,R.mute)}
    });
    if(more){payFont(x,400,30);txt(t(tem?"pay.kart.daha_tem":"pay.kart.daha",{n:more}),P+108,y+8+n*rh+40,R.mute)}
    return y+bh+36;
  }
  // Hiç riskli madde yoksa: olumlu kutu (onay dili yok) + okunan maddeler
  function olumlu(y){
    var h=L.h>1600?300:236;box(P,y,CW,h,28,R.sunk);
    icon(0,P+80,y+h/2,72);
    payFont(x,700,48,true);var t1=payWrap(t(tem?"pay.kart.olumlu_tem":"pay.kart.olumlu"),CW-180,2,meas);
    payFont(x,400,32);var t2=payWrap(M.total?t(tem?"pay.kart.olumlu_say_tem":"pay.kart.olumlu_say",{n:M.total}):t("pay.kart.olumlu_metin"),CW-180,2,meas);
    var th=t1.length*56+t2.length*42+8,ty=y+(h-th)/2;
    payFont(x,700,48,true);t1.forEach(function(l,i){txt(l,P+144,ty+44+i*56,R.ink)});
    payFont(x,400,32);t2.forEach(function(l,i){txt(l,P+144,ty+t1.length*56+40+i*42,R.ink)});
    return y+h+40;
  }
  function okunan(y,maxRows){
    if(!M.okNames.length||maxRows<1)return y;
    payFont(x,600,30);txt(t(tem?"pay.kart.okunan_tem":"pay.kart.okunan"),P,y+30,R.mute);y+=52;
    payFont(x,400,30);var list=M.okNames.slice(),ch=payChips(x,list,CW,maxRows);
    var left=list.length-ch.length;
    if(left){ch=payChips(x,list.slice(0,ch.length-1).concat([t("pay.kart.arti_daha",{n:left+1})]),CW,maxRows)}
    ch.forEach(function(c){var cy=y+c.row*64;box(P+c.x,cy,c.w,52,26,R.card);txt(c.s,P+c.x+22,cy+36,R.ink)});
    return y+(ch.length?(ch[ch.length-1].row+1)*64:0)+24;
  }
  function facts(y){
    payFont(x,600,30);var ch=payChips(x,M.facts,CW,2);if(!ch.length)return y;
    ch.forEach(function(c){var cy=y+c.row*68;box(P+c.x,cy,c.w,56,28,R.sunk);txt(c.s,P+c.x+22,cy+38,R.ink)});
    return y+(ch[ch.length-1].row+1)*68+20;
  }
  function allergens(y){
    if(!M.allergens)return y;
    payFont(x,600,34);var lb=t(M.mode==="gida"?"pay.kart.alerjenler":"pay.kart.koku"),lw=meas(lb);txt(lb,P,y+30,R.ink);
    payFont(x,400,34);var al=payWrap(M.allergens,CW-lw,2,meas);
    al.forEach(function(l,i){txt(l,P+(i?0:lw),y+30+i*46,R.ink)});
    return y+30+(al.length-1)*46+40;
  }
  function personal(y){
    if(!M.personal.length)return y;
    var ph=36+M.personal.length*56;
    box(P,y,CW,ph,24,R.redbg);if(draw){x.fillStyle=R.red;x.fillRect(P,y+12,8,ph-24)}
    M.personal.forEach(function(p,i){var cy=y+18+i*56+28;icon(p.lvl,P+50,cy,34,true);payFont(x,600,32);txt(payWrap(p.t,CW-120,1,meas)[0]||"",P+86,cy+11,R.ink)});
    return y+ph+28;
  }
  // Yerleşim: önce ölçülür (çizmeden), sığana kadar madde satırı ve bilgi etiketi azaltılır
  var n=M.top.length,keepFacts=true;
  function flow(){
    var y=head(P);
    if(risky){y=counts(y);y=rows(y,n)}
    if(keepFacts)y=facts(y);
    y=allergens(y);y=personal(y);
    return y;
  }
  draw=false;
  while(flow()>maxY){if(n>2)n--;else if(keepFacts&&M.facts.length)keepFacts=false;else if(n>1)n--;else break}
  draw=true;
  x.fillStyle=R.bg;x.fillRect(0,0,W,H);
  var y=head(P);
  if(risky){y=counts(y);y=rows(y,n)}
  else{
    y=olumlu(y);
    draw=false;var after=personal(allergens(keepFacts?facts(0):0)),r=0;
    while(r<8&&okunan(y,r+1)+after<=maxY)r++;   // okunan maddeler kalan yere sığdığı kadar satır
    draw=true;y=okunan(y,r);
  }
  if(keepFacts)y=facts(y);
  y=allergens(y);y=personal(y);
  // Alt bölüm: tanınma + not
  var ny=foot-36-(notL.length-1)*34;
  payFont(x,400,26);
  notL.forEach(function(l,i){txt(l,P,ny+i*34,R.mute)});
  if(recog){payFont(x,400,28);txt(recog,P,ny-48,R.mute)}
  // Alt bant (ince): logo açık çerçeveyle (koyu zeminde kaybolmasın), ad + slogan solda, adres sağda
  x.fillStyle=R.ok;x.fillRect(0,foot,W,L.bant);
  var ls=Math.min(112,L.bant-40),ly=foot+(L.bant-ls)/2,ince=L.bant<180;
  var lx=rtl?W-P-ls:P;
  if(logo){x.fillStyle="#FFFFFF";payRR(x,lx-4,ly-4,ls+8,ls+8,ls*0.28);x.fill();x.save();payRR(x,lx,ly,ls,ls,ls*0.23);x.clip();x.drawImage(logo,lx,ly,ls,ls);x.restore()}
  var bx=P+(logo?ls+28:0);
  payFont(x,700,ince?38:50,true);txt(cfg.uygulamaAdi,bx,ly+(ince?ls*0.48:48),"#FFFFFF");
  payFont(x,600,ince?26:34);txt(cfg.slogan,bx,ly+(ince?ls*0.95:94),R.bant2);
  payFont(x,400,ince?26:28);txt(cfg.adres.replace(/^https?:\/\//,"").replace(/\/$/,""),W-P,ly+(ince?ls*0.48:48),R.bant2,"right");
  return out;
}
