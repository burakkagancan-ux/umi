// Konumdan besin tablosu (A-02 / O-27, js/besin.js besinKonumSec) bozma turu gerileme testleri (22.10.2026, Reality Checker):
// (1) çok sütunlu tabloda satırından düşen 100 g hücresi porsiyon değerini 100 g sütununa kaydırıyordu (yanlış renk);
// (2) rastgele yapay tablolar (fuzz): dönüş, kavis, titreme, kayma, porsiyon sütunu, yan yana / alttaki içerik listesi, okuma sırası
//     (satır, sütun, karışık). Ölçüt: konumdan kurulan tablo renk gösteriyorsa her değeri doğrudur. Sabit tohumlar; 300 etiket ~0,1 sn.
// Çalıştır: node test/besin_konum.js [tohum adet]   (tohum verilirse yalnızca o tarama, hatalı etiketin metniyle)
const fs=require('fs'),path=require('path');
Object.assign(globalThis,require('./yukle.js'));
const S=besinSozluk(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','besin.json'),'utf8')));
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};

// Yapay Vision yanıtı: sözcükler {s, x, y, blok}; sira: metnin (ve kutuların) okuma sırası; rot: derece
const CW=14,H=30;
function kutu(s,x,y,rot){
  const w=s.length*CW,p=[[x,y],[x+w,y],[x+w,y+H],[x,y+H]],r=(rot||0)*Math.PI/180,c=Math.cos(r),sn=Math.sin(r);
  return p.map(([a,b])=>[Math.round(a*c-b*sn+5000),Math.round(a*sn+b*c+5000)]).flat();
}
function yap(soz,rot,sira){
  sira=sira||soz.map((_,i)=>i);let text='';const K=[];
  sira.forEach((i,k)=>{const w=soz[i],nx=soz[sira[k+1]],sonu=!nx||nx.y!==w.y||w.blok!==nx.blok;
    text+=w.s+(sonu?'\n':' ');K.push([w.s,...kutu(w.s,w.x,w.y,rot),w.blok||0,sonu?1:0])});
  return {text:text.trim(),boyut:[2000,2000],kutu_surum:1,kutu:K};
}
// satırlar: [[y, [x,'a b c'], …]]; blokSutun: her hücre sütunu ayrı Vision bloğu
function izgara(satirlar,blokSutun){
  const out=[];satirlar.forEach(([y,...hucre])=>hucre.forEach(([x,t],hi)=>{let xx=x;t.split(' ').forEach(s=>{out.push({s,x:xx,y,blok:blokSutun?hi:0});xx+=s.length*CW+CW})}));return out;
}
function renkli(tx){const r=besinAyristir(tx,S);if(!r||r.durum!=='tamam')return null;const g=besinGorunum({b:r.b,lt:r.lt,birim:r.birim,sorun:r.sorun,por:r.por});return g&&g.renk?r:null}

// (1) 100 g sütununun sayısı satırından 24 px (yazı 30 px) aşağıda, Vision sütun sütun okumuş: porsiyon değeri kaymamalı
{
  const T=[[100,[100,'Besin değerleri'],[400,'100 g'],[700,'Porsiyon (30 g)']],[160,[100,'Enerji'],[400,'2059 kJ / 492 kcal'],[700,'618 kJ / 148 kcal']],
    [220,[100,'Yağ'],[400,'39,6 g'],[700,'11,9 g']],[280,[100,'Doymuş yağ'],[400,'1,6 g'],[700,'0,5 g']],[340,[100,'Karbonhidrat'],[400,'14 g'],[700,'4,2 g']],
    [400,[100,'Şekerler'],[400,'10 g'],[700,'3 g']],[460,[100,'Lif'],[400,'8 g'],[700,'2,4 g']],[520,[100,'Protein'],[400,'16 g'],[700,'4,8 g']],[580,[100,'Tuz'],[400,'2,3 g'],[700,'0,7 g']]];
  const W=izgara(T,true);W.forEach(w=>{if((w.y===280||w.y===400)&&w.x===400)w.y+=24});
  const sira=W.map((w,i)=>i).sort((a,b)=>W[a].blok-W[b].blok||W[a].y-W[b].y||W[a].x-W[b].x);
  const V=yap(W,0,sira),r=renkli(besinKonumSec(V.text,V,S));
  ok(!r||r.b.doymus===1.6&&r.b.seker===10,'satırından düşen 100 g hücresi: porsiyon değeri 100 g sütununa kaymaz '+JSON.stringify(r&&r.b));
}

// (2) Fuzz
function tara(tohum,adet,yaz){
  let seed=tohum;const R=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff};
  const ri=(a,b)=>a+Math.floor(R()*(b-a+1)),pick=a=>a[Math.floor(R()*a.length)],fmt=v=>String(Math.round(v*10)/10).replace('.',',');
  const YAN=['İçindekiler: buğday unu, şeker,','bitkisel yağ (palm), kakao','%12, fındık %8, süt tozu,','tuz, emülgatör (soya lesitini),','kabartıcı. Eser miktarda','yer fıstığı içerebilir.','',''];
  function tablo(){
    const yag=ri(0,40)+ri(0,9)/10,doy=Math.round(yag*R()*10)/10,karb=ri(0,80),sek=Math.round(karb*R()),pro=ri(0,25),lif=ri(0,8),tuz=Math.round(R()*30)/10;
    const kcal=Math.round(9*yag+4*karb+4*pro+2*lif),kj=Math.round(kcal*4.184),pf=0.3;
    const rows=[['Enerji',`${kj} kJ / ${kcal} kcal`,`${Math.round(kj*pf)} kJ / ${Math.round(kcal*pf)} kcal`],['Yağ',fmt(yag)+' g',fmt(yag*pf)+' g'],['Doymuş yağ',fmt(doy)+' g',fmt(doy*pf)+' g'],
      ['Karbonhidrat',fmt(karb)+' g',fmt(karb*pf)+' g'],['Şekerler',fmt(sek)+' g',fmt(sek*pf)+' g'],['Lif',fmt(lif)+' g',fmt(lif*pf)+' g'],['Protein',fmt(pro)+' g',fmt(pro*pf)+' g'],['Tuz',fmt(tuz)+' g',fmt(tuz*pf)+' g']];
    const d={kcal,yag:+fmt(yag).replace(',','.'),doymus:+fmt(doy).replace(',','.'),karb,seker:sek,lif,protein:pro,tuz:+fmt(tuz).replace(',','.')};
    return {rows,por:R()<0.5,d};
  }
  function kur(T,o){
    let y=100;const g=o.gap,ilk=o.porOnce&&T.por;
    const hdr=T.por?(ilk?[[g,'Porsiyon (30 g)'],[g*2,'100 g']]:[[g,'100 g'],[g*2,'Porsiyon (30 g)']]):[[g,'100 g']];
    const satir=[[y,[0,'Besin değerleri'],...hdr]];
    T.rows.forEach(r=>{y+=o.rh;const c=[[0,r[0]],[g,ilk?r[2]:r[1]]];if(T.por)c.push([g*2,ilk?r[1]:r[2]]);satir.push([y,...c])});
    if(o.yan)satir.forEach((s,i)=>{const t=o.yan[i];if(t)s.push([g*(T.por?3:2)+o.yanX,t])});
    const w=izgara(satir,true);
    if(o.alt){y+=o.rh*2;izgara([[y,[0,o.alt]]],false).forEach(x=>{x.blok=9;w.push(x)})}
    w.forEach(q=>{q.y=Math.round((q.y+(o.kavis*(q.x-g)*(q.x-g))/1000+o.ji*(R()-0.5)*2+(q.x>g*0.8?o.kay:0))*100)/100;q.x+=o.ji*(R()-0.5)*2});
    return w;
  }
  function sira(W,tip){const ix=W.map((_,i)=>i);
    if(tip==='satir')return ix.sort((a,b)=>(W[a].blok===9)-(W[b].blok===9)||W[a].y-W[b].y||W[a].x-W[b].x);
    if(tip==='sutun')return ix.sort((a,b)=>W[a].blok-W[b].blok||W[a].y-W[b].y||W[a].x-W[b].x);
    return ix.sort(()=>R()-0.5).sort((a,b)=>W[a].blok-W[b].blok);}
  const o={n:0,konum:0,hata:[]};
  for(let t=0;t<adet;t++){
    const T=tablo(),op={gap:ri(250,500),rh:ri(32,60),kavis:pick([0,0,0.02,0.05,0.1,-0.05]),ji:pick([0,2,5,10]),kay:pick([0,0,0,8,15,-15]),porOnce:R()<0.3,yan:R()<0.3?YAN:null,yanX:ri(20,200),alt:R()<0.3?'İçindekiler: süt, şeker, fındık. Gluten içerir.':null};
    const W=kur(T,op),rot=pick([0,0,0,2,5,-5,90,180,-90,15]),V=yap(W,rot,sira(W,pick(['satir','sutun','karisik'])));o.n++;
    let yeni;try{yeni=besinKonumSec(V.text,V,S)}catch(e){o.hata.push('istisna t='+t+' '+e.message);continue}
    if(yeni===V.text)continue;o.konum++;
    const r=renkli(yeni);if(!r)continue;
    const fark=BESIN_ALAN.filter(a=>r.b[a]!=null&&Math.abs(r.b[a]-T.d[a])>0.051);
    if(fark.length)o.hata.push(`tohum ${tohum} t=${t} rot ${rot} ${JSON.stringify(op).slice(0,160)}: ${fark.map(a=>a+' '+r.b[a]+'≠'+T.d[a]).join(', ')}`+(yaz?'\n'+yeni:''));
  }
  return o;
}
if(process.argv[2]){const o=tara(+process.argv[2],+process.argv[3]||300,true);console.log(o.hata.join('\n\n')||'hata yok',{n:o.n,konum:o.konum});process.exit(o.hata.length?1:0)}
// 22.10.2026: 16 tohum × 300 etiket, düzeltmelerden sonra 0 hata (önce: tohum 7 ve 14'te protein/tuz kayması)
let top=0,kon=0;
for(const t of [1,2,3,7,14,21]){const o=tara(t,300);top+=o.n;kon+=o.konum;o.hata.forEach(h=>ok(false,'fuzz: '+h))}
ok(kon>top*0.25,`fuzz: konumdan kurulan ${kon}/${top} (tarama gerçekten konum yolunu sınıyor)`);
console.log(n+' konum denetimi ('+top+' rastgele etiket, konumdan '+kon+'), '+fail+' hata');process.exit(fail?1:0);
