// Kabul testi: temizlik maddelerinin "Otoriteler" sekmesinde Türkiye'nin sınıflandırması AB'den farklıysa ayrı bir
// Türkiye satırı görünür (SEA Yönetmeliği Ek-6, RG 10.12.2020); aynıysa Türkiye satırı eklenmez. AB satırı (CLP Ek VI)
// her maddede kalır; renk (risk düzeyi) AB'ye göre verilir ve değişmez.
// Farklı beş madde ve Türkiye satırında beklenen:
//   BIT 2634-33-5: "SEA", "613-088-00-6", farkta "Acute Tox. 2 (Inhalation)"
//   2-Bütoksietanol 111-76-2: "SEA", "603-014-00-0", farkta "Acute Tox. 4 (Inhalation)"
//   Sitrik Asit 77-92-9: "SEA", Türkiye listesinde olmadığı ("listesinde yok")
//   d-Limonen 5989-27-5: "SEA", "601-029-00-7"
//   CMIT/MIT 55965-84-9: "SEA", "613-167-00-5", farkta "EUH071"
// Aynı olanlar (satır yok, "SEA" geçmez): Sodyum Hidroksit 1310-73-2, Sodyum Hipoklorit 7681-52-9.
// İngilizcede BIT'in Türkiye satırı da görünür (en.json ulke.ad.tr: "Türkiye") ve çevrilmemiş olarak işaretlenmez
// (en.json veri.cevrilmedi: "not yet translated"; aria: "This text has not yet been translated …").
//
// Kullanıcı yolu: ansiklopedi.html açılır, Temizlik/Cleaning seçilir, arama kutusuna CAS yazılır, sonuç bağlantısına
// basılır, "Otoriteler"/"Authorities" sekmesi açılır; o sekmenin panelinin (rol: tabpanel) görünen metni okunur.
// Panelde her kurum satırı "Kurum · Bölge · Yıl" başlık satırıyla başlar (bugün: "European Commission · AB · 2025");
// satırlar bu başlıklardan bölünür, Türkiye satırı bölge adı "Türkiye" olan satırdır.
const {ac,gorunur}=require('./_ortak.js');

const DIL={
  tr:{locale:'tr-TR',tur:'Temizlik',ara:'Madde ara',sekme:'Otoriteler',ab:'AB',tr:'Türkiye'},
  en:{locale:'en-US',tur:'Cleaning',ara:'Search substances',sekme:'Authorities',ab:'EU',tr:'Türkiye'},
};

// Farklı beş madde. abNo: AB satırında bugün görünen CLP Ek VI dizin no; duzey: bugün görünen risk düzeyi yazısı
const FARKLI=[
  {cas:'2634-33-5',ad:'Benzizotiyazolinon (BIT)',abNo:'613-088-00-6',duzey:'Uyarı',tr:[/(?<!\p{L})SEA(?!\p{L})/u,/613-088-00-6/,/Acute Tox\. 2 \(Inhalation\)/]},
  {cas:'111-76-2',ad:'2-Bütoksietanol',abNo:'603-014-00-0',duzey:'Uyarı',tr:[/(?<!\p{L})SEA(?!\p{L})/u,/603-014-00-0/,/Acute Tox\. 4 \(Inhalation\)/]},
  {cas:'77-92-9',ad:'Sitrik Asit',abNo:'607-750-00-3',duzey:'Dikkat',tr:[/(?<!\p{L})SEA(?!\p{L})/u,/listesinde yok/i]},
  {cas:'5989-27-5',ad:'d-Limonen',abNo:'601-096-00-2',duzey:'Uyarı',tr:[/(?<!\p{L})SEA(?!\p{L})/u,/601-029-00-7/]},
  {cas:'55965-84-9',ad:'CMIT/MIT',abNo:'613-167-00-5',duzey:'Uyarı',tr:[/(?<!\p{L})SEA(?!\p{L})/u,/613-167-00-5/,/EUH071/]},
];
const AYNI=[{cas:'1310-73-2',ad:'Sodyum Hidroksit',abNo:'011-002-00-6'},{cas:'7681-52-9',ad:'Sodyum Hipoklorit',abNo:'017-011-00-1'}];

const kacis=s=>s.replace(/[.*+?^${}()|[\]\\-]/g,'\\$&');
// Panel metnini kurum satırlarına böler: "… · Bölge · Yıl" ya da "… · Bölge" başlık satırından sonraki başlığa kadar
function satirlar(metin){
  const out=[];let cur=null;
  for(const l of metin.split('\n')){
    const m=l.match(/^.+?\s·\s(.+?)(?:\s·\s\d{4})?\s*$/);
    if(m){cur={bolge:m[1].trim(),baslik:l,metin:''};out.push(cur)}
    else if(cur)cur.metin+=l+'\n';
  }
  return out;
}

// Maddeyi açar, Otoriteler sekmesine geçer. Döner: {panel, duzey, cevrilmemis, errs, ctx}
async function otoriteler(br,B,opt,ok,dil,cas,ad){
  const d=DIL[dil],etiket=dil+' '+ad;
  const ctx=await br.newContext({...opt,locale:d.locale});
  const {p,errs}=await ac(ctx,B+'ansiklopedi.html');
  ok(await gorunur(p.getByRole('radio',{name:d.tur})),etiket+': "'+d.tur+'" türü seçeneği görünmüyor');
  await p.getByRole('radio',{name:d.tur}).click();
  const kutu=p.getByRole('searchbox',{name:d.ara});
  ok(await gorunur(kutu),etiket+': arama kutusu görünmüyor');
  await kutu.fill(cas);
  const bag=p.getByRole('link',{name:new RegExp(kacis(cas))}).first();
  ok(await gorunur(bag),etiket+': aramada '+cas+' sonucu çıkmadı');
  await bag.click();
  await p.waitForLoadState('networkidle');
  const sekme=p.getByRole('tab',{name:d.sekme});
  ok(await gorunur(sekme),etiket+': "'+d.sekme+'" sekmesi görünmüyor (madde sayfası açılmadı)');
  await sekme.click();
  await p.waitForTimeout(300);
  const tp=p.getByRole('tabpanel');
  ok(await gorunur(tp,3000),etiket+': sekme paneli görünmüyor');
  const panel=await tp.first().innerText();
  // Sayfanın risk düzeyi yazısı (renk tek başına değil); düzey adı rozetin metni olarak görünür
  const govde=await p.locator('body').innerText();
  const duzey=(govde.match(/\n(Uyarı|Dikkat|Bilgi|Warning|Caution|Info)\n/)||[])[1]||'';
  const cevrilmemis=await p.getByLabel(/has not yet been translated/i).count();
  return {panel,duzey,cevrilmemis,errs,ctx};
}

module.exports=async({br,B,opt,ok})=>{
  // 1) Türkçe: farklı beş maddede Türkiye satırı ve beklenen ifadeler; AB satırı ve risk düzeyi kalır
  for(const m of FARKLI){
    const {panel,duzey,errs,ctx}=await otoriteler(br,B,opt,ok,'tr',m.cas,m.ad);
    try{
      const s=satirlar(panel);
      // AB'de birden çok satır olabilir (ör. 648/2004 deterjan etiketi); sınıflandırma satırı dizin nosunu taşıyandır
      const ab=s.find(x=>x.bolge===DIL.tr.ab&&x.metin.includes(m.abNo)),tr=s.find(x=>x.bolge===DIL.tr.tr);
      ok(s.some(x=>x.bolge===DIL.tr.ab),'tr '+m.ad+': Otoriteler sekmesinde "AB" satırı yok');
      ok(!!ab,'tr '+m.ad+': AB satırında AB dizin no '+m.abNo+' görünmüyor');
      ok(!!tr,'tr '+m.ad+': Otoriteler sekmesinde "Türkiye" satırı yok; bölgeler: '+s.map(x=>x.bolge).join(', '));
      if(tr)for(const r of m.tr)ok(r.test(tr.baslik+'\n'+tr.metin),'tr '+m.ad+': Türkiye satırında '+r+' geçmiyor: '+tr.metin.slice(0,200));
      ok(duzey===m.duzey,'tr '+m.ad+': risk düzeyi değişti; AB\'ye göre "'+m.duzey+'" olmalı, görünen "'+duzey+'"');
      ok(errs.length===0,'tr '+m.ad+': sayfa hatası: '+errs.join(' | '));
    }finally{await ctx.close()}
  }
  // 2) Türkçe: Türkiye'de aynı olan iki maddede Türkiye satırı yok, "SEA" geçmez; AB satırı kalır
  for(const m of AYNI){
    const {panel,errs,ctx}=await otoriteler(br,B,opt,ok,'tr',m.cas,m.ad);
    try{
      const s=satirlar(panel);
      ok(!/(?<!\p{L})SEA(?!\p{L})/u.test(panel),'tr '+m.ad+': Otoriteler sekmesinde "SEA" geçiyor; Türkiye\'de sınıf aynı, satır olmamalı: '+(panel.match(/[^\n]*SEA[^\n]*/)||[''])[0]);
      ok(!s.some(x=>x.bolge===DIL.tr.tr),'tr '+m.ad+': Türkiye satırı var; Türkiye\'de sınıf aynı');
      ok(s.some(x=>x.bolge===DIL.tr.ab&&x.metin.includes(m.abNo)),'tr '+m.ad+': AB satırı ya da dizin no '+m.abNo+' görünmüyor');
      ok(errs.length===0,'tr '+m.ad+': sayfa hatası: '+errs.join(' | '));
    }finally{await ctx.close()}
  }
  // 3) İngilizce: BIT'te Türkiye satırı, "SEA" ve 613-088-00-6; çevrilmemiş işareti yok
  {
    const {panel,cevrilmemis,errs,ctx}=await otoriteler(br,B,opt,ok,'en','2634-33-5','Benzisothiazolinone (BIT)');
    try{
      const s=satirlar(panel);
      ok(s.some(x=>x.bolge===DIL.en.ab),'en BIT: Authorities sekmesinde "EU" satırı yok');
      const tr=s.find(x=>x.bolge===DIL.en.tr);
      ok(!!tr,'en BIT: Authorities sekmesinde "Türkiye" satırı yok; bölgeler: '+s.map(x=>x.bolge).join(', '));
      if(tr){
        const t=tr.baslik+'\n'+tr.metin;
        ok(/(?<!\p{L})SEA(?!\p{L})/u.test(t),'en BIT: Türkiye satırında "SEA" geçmiyor: '+tr.metin.slice(0,200));
        ok(/613-088-00-6/.test(t),'en BIT: Türkiye satırında "613-088-00-6" geçmiyor');
      }
      ok(!/not yet translated/i.test(panel),'en BIT: Authorities sekmesinde "not yet translated" işareti var');
      ok(cevrilmemis===0,'en BIT: çevrilmemiş metin işareti (aria etiketi) var');
      ok(errs.length===0,'en BIT: sayfa hatası: '+errs.join(' | '));
    }finally{await ctx.close()}
  }
};
