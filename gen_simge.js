// Uygulama simgeleri: kaynak/simge/*.svg → kökteki PNG'ler (manifest, sayfaların sekme simgesi, Apple, paylaşım kartı logosu).
// Simge değişince yalnızca SVG düzenlenir, sonra: node gen_simge.js && python3 uret.py (sw.js önbellek adı yenilensin).
// Tarayıcıyla çizer (Playwright 1.47.2, arayüz testiyle aynı kurulum); CI'da çalışmaz, PNG'ler depoya eklenir.
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const K=path.join(__dirname,'kaynak','simge');
const CIKTI=[  // [svg, png, boyut]
  ['umi.svg','icon-512.png',512],
  ['umi.svg','icon-192.png',192],
  ['umi.svg','apple-touch-icon.png',180],
  ['umi-maskable.svg','icon-maskable-512.png',512],
  ['umi-32.svg','favicon-32.png',32],
  ['umi-16.svg','favicon-16.png',16],
];

(async()=>{
  const br=await chromium.launch();
  for(const [svg,png,n] of CIKTI){
    const p=await br.newPage({viewport:{width:n,height:n},deviceScaleFactor:1});
    const s=fs.readFileSync(path.join(K,svg),'utf8').replace('<svg ','<svg width="'+n+'" height="'+n+'" ');
    await p.setContent('<html><body style="margin:0;background:transparent">'+s+'</body></html>');
    await p.screenshot({path:path.join(__dirname,png),omitBackground:true,clip:{x:0,y:0,width:n,height:n}});
    await p.close();
    console.log(png,n+'x'+n);
  }
  await br.close();
})();
