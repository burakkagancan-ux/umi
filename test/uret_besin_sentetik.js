// A-02 / O-27 ölçüm seti üreticisi: yapay besin tablosu etiketleri tarayıcıda çizilir, beş hâlde (düz, 6° eğik, perspektif, silindire
// sarılı, bulanık + düşük JPEG) fotoğrafa çevrilir ve uygulamanın Worker'ıyla (Google Cloud Vision, kutu:true) bir kez okunur.
// Çalıştır: node test/uret_besin_sentetik.js [foto_klasörü]   → test/veri/besin_sentetik.json (Worker'ın yanıtı olduğu gibi saklanır:
// metin + boyut + sözcük kutuları; gözlem 0018: yarının yöntemi bugün kullanılmayan alana ihtiyaç duyabilir).
// Fotoğraflar depoda değil (varsayılan ~/Documents/Claude_Yedek/besin_sentetik_foto/); betik aynı etiketleri yeniden çizer.
// Etiket tasarımı gerçek etiketlerde görülen okuma sorunlarını taklit eder (TEKNIK_BORC "Besin tablosu okuma oranı"): çok sütunlu ızgara,
// adlardan uzak sağa yaslı değerler, iki dilli adlar, ayrı kJ/kcal satırları, yatay tablo, içerik listesiyle yan yana küçük tablo.
// Doğru değerler (d) çizilen tablodan gelir; enerji makrolarla tutarlıdır (9/4/4/2 kcal/g).
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),os=require('os');
const OCR_URL='https://inapp-ocr-3a8f.burakkagancan.workers.dev',ORIGIN='https://burakkagancan-ux.github.io';
const DIZIN=process.argv[2]||path.join(os.homedir(),'Documents/Claude_Yedek/besin_sentetik_foto');
const CIKTI=path.join(__dirname,'veri/besin_sentetik.json');

// d: [kcal, yag, doymus, karb, seker, lif, protein, tuz]
function kcal(d){return Math.round(9*d[1]+4*d[3]+4*d[6]+2*(d[5]||0))}
const v=x=>String(x).replace('.',',');
function por(d,g){return d.map(x=>x==null?null:Math.round(x*g/100*10)/10)}
const ICERIK='İçindekiler: Buğday unu, şeker, bitkisel yağ (palm), kakao tozu (%4,5), glukoz şurubu, tuz, kabartıcı (sodyum bikarbonat), emülgatör (soya lesitini), aroma verici (vanilin). Fındık ve susam içerebilir.';
const STIL=`body{margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#111}
.e{width:860px;padding:28px;background:#fff}.ic{font-size:19px;line-height:1.35;margin-bottom:18px}
table{border-collapse:collapse;width:100%;font-size:21px}td,th{padding:5px 10px}th{text-align:right;font-weight:bold}th:first-child,td:first-child{text-align:left}
td{text-align:right}.g td,.g th{border:1.5px solid #111}.alt td:first-child{padding-left:34px}h3{margin:0 0 8px;font-size:23px}.dip{font-size:15px;margin-top:8px}`;

function etiketler(){
  const L=[];
  // 1) Izgara: ad | 100 g | porsiyon (25 g) | %BRD
  {const d=[0,26,13,62,31,2.4,6.8,0.65];d[0]=kcal(d);const p=por(d,25),kj=x=>Math.round(x*4.184);
   const brd=[d[0]/20,d[1]/0.7,d[2]/0.2,d[3]/2.6,d[4]/0.9,null,d[6]/0.5,d[7]/0.06].map(x=>x==null?'':'%'+Math.round(x*25/100));
   const ad=['Enerji','Yağ','Doymuş Yağ','Karbonhidrat','Şekerler','Lif','Protein','Tuz'];
   const satir=ad.map((a,i)=>i===0?`<tr><td>${a}</td><td>${kj(d[0])} kJ / ${d[0]} kcal</td><td>${kj(p[0])} kJ / ${p[0]} kcal</td><td>${brd[0]}</td></tr>`
     :`<tr><td>${a}</td><td>${v(d[i])} g</td><td>${v(p[i])} g</td><td>${brd[i]}</td></tr>`).join('');
   L.push({etiket:'izgara_dort_sutun',d,birim:'g',html:`<div class="e"><h3>Besin Öğeleri</h3><table class="g"><tr><th></th><th>100 g</th><th>1 Porsiyon (25 g)</th><th>%BRD*</th></tr>${satir}</table><div class="dip">*Referans alım: ortalama bir yetişkin (8400 kJ / 2000 kcal)</div></div>`});}
  // 2) Adlar solda, değerler en sağda, çizgisiz, aralarında geniş boşluk
  {const d=[0,3.4,2.1,4.8,4.8,null,3.3,0.12];d[0]=kcal(d);
   const ad=['Enerji','Yağ','Doymuş yağ','Karbonhidrat','Şekerler','Protein','Tuz'],ix=[0,1,2,3,4,6,7];
   const satir=ix.map((i,j)=>`<tr><td>${ad[j]}</td><td style="width:60%"></td><td>${i===0?Math.round(d[0]*4.184)+' kJ / '+d[0]+' kcal':v(d[i])+' g'}</td></tr>`).join('');
   L.push({etiket:'genis_bosluk_sag',d,birim:'ml',html:`<div class="e"><div class="ic">İçindekiler: İnek sütü, süt tozu, stabilizör (karragenan).</div><h3>Besin değerleri 100 ml için</h3><table>${satir}</table></div>`});}
  // 3) İki dilli adlar, 100 ml ve 250 ml
  {const d=[0,0,0,10.6,10.6,null,0,0.02];d[0]=kcal(d);const p=por(d,250);
   const ad=['Enerji / Energy','Yağ / Fat','Doymuş Yağ / Saturates','Karbonhidrat / Carbohydrate','Şekerler / Sugars','Protein / Protein','Tuz / Salt'],ix=[0,1,2,3,4,6,7];
   const satir=ix.map((i,j)=>i===0?`<tr><td>${ad[j]}</td><td>${Math.round(d[0]*4.184)} kJ<br>${d[0]} kcal</td><td>${Math.round(p[0]*4.184)} kJ<br>${p[0]} kcal</td></tr>`:`<tr><td>${ad[j]}</td><td>${v(d[i])} g</td><td>${v(p[i])} g</td></tr>`).join('');
   L.push({etiket:'iki_dil_ml',d,birim:'ml',html:`<div class="e"><h3>Besin Değerleri / Nutrition Facts</h3><table class="g"><tr><th></th><th>100 ml</th><th>250 ml</th></tr>${satir}</table></div>`});}
  // 4) kJ ve kcal ayrı satır, girintili alt satırlar
  {const d=[0,18,6.5,52,4.1,9.5,11,1.1];d[0]=kcal(d);
   const r=(a,x,c)=>`<tr${c?' class="alt"':''}><td>${a}</td><td>${x}</td></tr>`;
   const satir=r('Enerji',Math.round(d[0]*4.184)+' kJ')+r('',d[0]+' kcal')+r('Yağ',v(d[1])+' g')+r('bunlardan doymuş yağ',v(d[2])+' g',1)+r('Karbonhidrat',v(d[3])+' g')+r('bunlardan şekerler',v(d[4])+' g',1)+r('Lif',v(d[5])+' g')+r('Protein',v(d[6])+' g')+r('Tuz',v(d[7])+' g');
   L.push({etiket:'kj_kcal_ayri_girintili',d,birim:'g',html:`<div class="e"><div class="ic">${ICERIK.replace('Buğday unu','Tam buğday unu, yulaf ezmesi')}</div><table class="g" style="width:70%"><tr><th style="text-align:left">Ortalama besin değerleri</th><th>100 g</th></tr>${satir}</table></div>`});}
  // 5) Yatay tablo: adlar üst satırda, değerler altında
  {const d=[0,21,9.8,58,27,null,7.2,0.4];d[0]=kcal(d);
   const ad=['Enerji','Yağ','Doymuş yağ','Karbonhidrat','Şeker','Protein','Tuz'],ix=[0,1,2,3,4,6,7];
   const ust=ad.map(a=>`<th style="text-align:center">${a}</th>`).join(''),alt=ix.map(i=>`<td style="text-align:center">${i===0?d[0]+' kcal':v(d[i])+' g'}</td>`).join('');
   L.push({etiket:'yatay_tablo',d,birim:'g',html:`<div class="e"><div class="ic">${ICERIK}</div><div style="font-size:19px;font-weight:bold">Besin değerleri (100 g)</div><table class="g" style="font-size:17px"><tr>${ust}</tr><tr>${alt}</tr></table></div>`});}
  // 6) İçerik listesiyle yan yana küçük, sık tablo
  {const d=[0,30,4.2,45,3.3,6.1,9.4,1.6];d[0]=kcal(d);
   const ad=['Enerji','Yağ','Doymuş yağ','Karbonhidrat','Şekerler','Lif','Protein','Tuz'];
   const satir=ad.map((a,i)=>`<tr><td style="padding:1px 4px">${a}</td><td style="padding:1px 4px">${i===0?Math.round(d[0]*4.184)+'kJ/'+d[0]+'kcal':v(d[i])+'g'}</td></tr>`).join('');
   L.push({etiket:'yan_yana_kucuk',d,birim:'g',html:`<div class="e" style="display:flex;gap:22px"><div class="ic" style="flex:1.3;font-size:16px">${ICERIK.replace('Buğday unu','Mısır, ayçiçek yağı, peynir tozu (süt)')} Serin ve kuru yerde saklayınız. Üretici: Örnek Gıda A.Ş. İstanbul.</div><div style="flex:1"><div style="font-size:15px;font-weight:bold">Besin değerleri / 100 g</div><table class="g" style="font-size:14px">${satir}</table></div></div>`});}
  return L;
}

// Bozulmalar tarayıcıda: düz görüntü bir tuvalde dönüştürülür; çıktı uygulamadaki gibi en çok 1800 px, JPEG 0,85 (bulanıkta 0,5)
const DONUSTUR=`async (src,donus)=>{
  const im=new Image();im.src=src;await im.decode();
  const W=im.width,H=im.height,c=document.createElement('canvas'),x=c.getContext('2d');
  if(donus==='egik'){const a=6*Math.PI/180,w=Math.ceil(W*Math.cos(a)+H*Math.sin(a)),h=Math.ceil(W*Math.sin(a)+H*Math.cos(a));c.width=w;c.height=h;x.fillStyle='#8a8f88';x.fillRect(0,0,w,h);x.translate(w/2,h/2);x.rotate(a);x.drawImage(im,-W/2,-H/2)}
  else if(donus==='perspektif'){c.width=W;c.height=H;x.fillStyle='#8a8f88';x.fillRect(0,0,W,H);
    for(let i=0;i<H;i++){const s=0.82+0.18*i/H,w=W*s;x.drawImage(im,0,i,W,1,(W-w)/2,i,w,1)}}
  else if(donus==='kavis'){c.width=W;c.height=H+Math.round(H*0.12);x.fillStyle='#8a8f88';x.fillRect(0,0,c.width,c.height);
    const R=W/2/Math.sin(1.1);for(let i=0;i<W;i++){const t=(i-W/2)/R,xx=W/2+R*Math.sin(t)*0.95,dy=R*(1-Math.cos(t))*0.35;x.drawImage(im,i,0,1,H,xx,dy,1.6,H)}}
  else{c.width=W;c.height=H;if(donus==='bulanik')x.filter='blur(1.6px)';x.drawImage(im,0,0)}
  const k=Math.min(1,1800/Math.max(c.width,c.height)),o=document.createElement('canvas');o.width=Math.round(c.width*k);o.height=Math.round(c.height*k);
  o.getContext('2d').drawImage(c,0,0,o.width,o.height);return o.toDataURL('image/jpeg',donus==='bulanik'?0.5:0.85);
}`;
const DONUSLER=['duz','egik','perspektif','kavis','bulanik'];

(async()=>{
  fs.mkdirSync(DIZIN,{recursive:true});
  const ONB=path.join(DIZIN,'vision_onbellek.json'),ONBELLEK=fs.existsSync(ONB)?JSON.parse(fs.readFileSync(ONB,'utf8')):{};
  const br=await chromium.launch(),p=await br.newPage({deviceScaleFactor:1.6});
  const out=[];
  for(const e of etiketler()){
    await p.setContent(`<style>${STIL}</style>${e.html}`);
    const png=await (await p.$('.e')).screenshot({type:'png'});
    for(const donus of DONUSLER){
      const url=await p.evaluate(`(${DONUSTUR})('data:image/png;base64,${png.toString('base64')}','${donus}')`);
      const b64=url.split(',')[1],ad=e.etiket+'__'+donus;
      fs.writeFileSync(path.join(DIZIN,ad+'.jpg'),Buffer.from(b64,'base64'));
      // Vision'ın dakikadaki istek kotası bilerek düşük (worker/README.md): istekler aralıklı, 429'da bir dakika beklenip yeniden denenir
      if(ONBELLEK[ad]){out.push({ad,etiket:e.etiket,donus,d:e.d,birim:e.birim,vision:ONBELLEK[ad]});console.log(ad,'önbellekten');continue}
      let r,j;
      for(let dene=0;;dene++){
        r=await fetch(OCR_URL,{method:'POST',headers:{'Content-Type':'application/json',Origin:ORIGIN},body:JSON.stringify({image:b64,kutu:true})});
        j=await r.json();if(r.status!==429&&r.status<500||dene>=5)break;
        console.log(ad,r.status,'65 sn bekleniyor');await new Promise(z=>setTimeout(z,65000));
      }
      if(!r.ok||j.error)throw new Error(ad+': '+(j.error||r.status));
      await new Promise(z=>setTimeout(z,15000));
      out.push({ad,etiket:e.etiket,donus,d:e.d,birim:e.birim,vision:j});
      ONBELLEK[ad]=j;fs.writeFileSync(ONB,JSON.stringify(ONBELLEK));   // yarıda kalırsa okunanlar yeniden okunmaz (fotoğraflar aynı çizilir)
      console.log(ad,(j.kutu||[]).length,'kutu');
    }
  }
  await br.close();
  fs.writeFileSync(CIKTI,JSON.stringify({meta:{aciklama:'A-02 / O-27 ölçüm seti: yapay besin tablosu etiketleri (test/uret_besin_sentetik.js) tarayıcıda çizildi, beş hâlde fotoğrafa çevrildi ve uygulamanın Worker\'ıyla (Google Cloud Vision, kutu:true) bir kez okundu. Fotoğraflar depoda değil; betik aynı etiketleri yeniden çizer.',
    tarih:new Date().toISOString().slice(0,10),kutu_surum:1,alanlar:'ad, etiket, donus (duz|egik|perspektif|kavis|bulanik), d: doğru değerler [kcal, yag, doymus, karb, seker, lif, protein, tuz] (null = etikette yok), birim (g|ml), vision: Worker yanıtı olduğu gibi {text, boyut, kutu_surum, kutu}'},
    etiketler:out}));
  console.log('yazıldı',CIKTI,out.length);
})().catch(e=>{console.error(e);process.exit(1)});
