// Tarayıcı testlerinde "tahmini bekleme, ardından durum okuma" kalıbını sayar (TEKNIK gözlem 0025; testler.md "Test yazma kuralları").
// waitForTimeout(n) ve hemen ardından (aynı satırda ya da sonraki satırda) bir durum okuması, sayfanın eşzamansız işi bitmeden
// okur: yerelde geçer, CI yavaşken ara sıra düşer (22.10.2026'da iki günde dört kez). Yerine: yerlesince(okuyucu) (ortak.js /
// _ortak.js: art arda iki okuma aynı olana dek), sayfanın kendi sözü ya da MutationObserver.
// Var olan örnekler TABAN'da; sayı yalnızca azalabilir. Döngü içindeki yoklama (for/while aynı satırda) sayılmaz.
// Bilerek yapılan bir bekleme satırın sonuna "// bekleme-bilerek: <neden>" yazılarak dışarıda bırakılır.
const fs=require('fs'),path=require('path');
const K=path.join(__dirname,'..');
const OKU=/\b(textContent|innerText|inputValue|getAttribute|evaluate|isVisible|isChecked|count)\s*\(|localStorage/;
const TABAN={
  'test/arayuz/10_kirpma.js':3,'test/arayuz/2_analiz_karsilastirma_kayit.js':3,'test/arayuz/3_ansiklopedi_rozet_profil.js':1,
  'test/arayuz/6_hareket.js':2,'test/arayuz/8_ulke.js':2,'test/arayuz/9_son_aylik.js':2,'test/kabul/besin_konum.js':1,
  'test/kabul/firma_bildirim_turu.js':1,'test/kabul/kirpma_onerisi.js':2,'test/kabul/ulke_katmani.js':1,
};

function say(metin){
  const L=metin.split('\n');let n=0;
  L.forEach((s,i)=>{
    const m=s.match(/waitForTimeout\(\s*\d+\s*\)\s*;?(.*)$/);
    if(!m||/\b(for|while)\s*\(/.test(s)||/bekleme-bilerek/.test(s))return;
    if(OKU.test(m[1])||OKU.test(L[i+1]||''))n++;
  });
  return n;
}

let hata=0;
const ok=(k,m)=>{if(!k){hata++;console.log('HATA: '+m)}};
// Ölçerin kendisi: bilinen girdilerle
ok(say("await p.waitForTimeout(300);\nconst t=await p.textContent('#x');")===1,'ölçer: sonraki satırdaki okumayı saymıyor');
ok(say("await p.waitForTimeout(300);const n=await p.locator('a').count();")===1,'ölçer: aynı satırdaki okumayı saymıyor');
ok(say("for(let k=0;k<9;k++){if(await p.isVisible('a'))break;await p.waitForTimeout(100)}")===0,'ölçer: döngüdeki yoklamayı sayıyor');
ok(say("await p.waitForTimeout(300); // bekleme-bilerek: animasyon süresi\nconst t=await p.textContent('#x');")===0,'ölçer: bekleme-bilerek işaretini görmüyor');
ok(say("await p.waitForTimeout(300);\nawait p.click('#x');")===0,'ölçer: okuma olmayan satırı sayıyor');

let toplam=0;
for(const d of ['test/arayuz','test/kabul'])for(const f of fs.readdirSync(path.join(K,d)).filter(f=>f.endsWith('.js'))){
  const ad=d+'/'+f,n=say(fs.readFileSync(path.join(K,ad),'utf8')),t=TABAN[ad]||0;toplam+=n;
  ok(n<=t,`${ad}: ${n} yeni "bekle, sonra oku" (taban ${t}). waitForTimeout yerine yerlesince(okuyucu) ya da sayfanın sözünü bekle; bilerekse satıra "// bekleme-bilerek: <neden>"`);
  if(n<t)console.log(`not: ${ad} tabanın altında (${n} < ${t}); TABAN'ı ${n} yap`);
}
console.log(hata?`${hata} hata`:`tamam: bekle-sonra-oku ${toplam} (taban ${Object.values(TABAN).reduce((a,b)=>a+b,0)})`);
process.exit(hata?1:0);
