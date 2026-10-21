// Yöntem sayfası (E-01): sayfadaki tırnak içindeki kart etiketleri uygulamanın aynı dildeki etiketleriyle aynı; HTML'deki metin tr.json ile aynı.
// Bozma turu (21.10.2026): İngilizcede "May cause cancer" yazıyordu, kart "Possible carcinogen" diyor. Çalıştır: node test/yontem.js
const fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
const ETIKET=['risk.uyari','risk.dikkat','risk.yok','koz.seviye.red','koz.seviye.kanserojen','tem.seviye.red','tem.seviye.info'];
for(const d of ['tr','en']){
  const j=JSON.parse(fs.readFileSync(path.join(R,'i18n',d+'.json'),'utf8'));
  const etiketler=new Set(ETIKET.map(k=>j[k].toLocaleLowerCase(d)));
  for(const [k,v] of Object.entries(j)){
    if(!k.startsWith('yontem.')||!/\((kartta|on the card):/.test(v))continue;
    const alinti=[...v.matchAll(/“([^”]+)”/g)].map(m=>m[1]).filter((x,i,a)=>v.indexOf('“'+x)<v.indexOf(')'));
    ok(alinti.length,d+' '+k+': kart etiketi tırnak içinde yazılı');
    alinti.forEach(a=>ok(etiketler.has(a.toLocaleLowerCase(d)),d+' '+k+': "'+a+'" uygulamanın kart etiketlerinden biri değil'));
  }
}
console.log(n+' yöntem denetimi, '+fail+' hata');process.exit(fail?1:0);
