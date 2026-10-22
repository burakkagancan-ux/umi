// Kabul testi: "Uygulama asla 'güvenli/uygun' demez; bir şey bulamazsa 'bulunamadı, bu bir onay değildir' der.
// Renk hiçbir zaman tek başına değildir." (CLAUDE.md, Değişmez kararlar)
//
// Kullanıcı yolu: Etiket Oku açılır; Gıda, Kozmetik, Temizlik için (1) "Örnek metin dene" düğmesine basılır,
// (2) "Okunan Metin" açılıp kutuya hiçbir şeyin tanınmayacağı bir içerik metni yazılır, (3) sıradan bir metin ("su")
// yazılır. Her seferinde Sonuç bölümünün görünen metni okunur.
//
// "Onay anlamında" kararı (i18n/tr.json taranarak verildi):
//  YASAK (onay): "güvenli", "güvenlidir", "güvenle", "zararsız", "uygun", "uygundur" sözcükleri tek başına.
//  SERBEST (onay değil, tr.json'da olumsuz ya da başka anlamda geçenler):
//   - "uygun değil/değildir", "uygun olduğu anlamına gelmez" (profil.sorumluluk.3), "uygunluğu belirsiz"
//     (gida.prof.vegan_belirsiz), "Uygunsuzluk" (ulke.tr.liste.*), "uygun_degil" gibi olumsuz kullanımlar;
//   - "güvenliği" (tem.cocuk_guvenligi "Çocuk güvenliği" başlığı), "güvenilir" (ortak.onay_degil_vegan) başka sözcüklerdir.
//  Sözcük sınırı Unicode harfe göre konur (JS \b Türkçe harfleri tanımaz; "güvenliği" yanlışlıkla yakalanmasın).
// "Bulunamadı" anlamı: "bulunamadı" / "bulunamaması" / "onay değildir" ifadelerinden biri sonuçta görünür olmalı.
// Renk tek başına değil: örnek sonuçlarda önem düzeyi metin olarak da yazılır ("Uyarı", "Dikkat"); renge bakılamaz
// (kabul testi uygulamanın içine bakmaz), bu yüzden düzeyin yazılı karşılığının görünür olduğu denetlenir.
const {ac,gorunur}=require('./_ortak.js');

const TURLER=['Gıda','Kozmetik','Temizlik'];
const HIC_TANINMAYAN='İçindekiler: qwxz.';
const SIRADAN='İçindekiler: su.';

// Onay sözcüğü: önünde ve arkasında harf olmayan güvenli(dir)/güvenle/zararsız/uygun(dur); arkasından olumsuzluk gelmiyorsa
const ONAY=/(?<!\p{L})(güvenli(?:dir)?|güvenle|zararsız(?:dır)?|uygun(?:dur)?)(?!\p{L})(?!\s+(?:değil|olduğu anlamına gelmez|olmayabilir))/iu;
const BULUNAMADI=/bulunamad[ıi]|bulunamama|onay değildir/i;

// Sonuç bölümünün görünen metni: "Sonuç" başlığından alt bilgiye ("Deneme Sürümü") kadar
async function sonucMetni(p){
  const t=await p.locator('body').innerText();
  const i=t.indexOf('\nSonuç\n'),j=t.indexOf('Deneme Sürümü',i);
  return i<0?'':t.slice(i+7,j<0?undefined:j).trim();
}
// Sonuç bir öncekinden farklı olana dek bekler (en çok ~8 sn), sonra yerleşmesi için kısa bir süre daha
async function yeniSonuc(p,eski){
  let s='';
  for(let k=0;k<40;k++){s=await sonucMetni(p);if(s&&s!==eski&&!/Henüz analiz yapılmadı/.test(s))break;await p.waitForTimeout(200)}
  // Yerleşene dek: art arda iki okuma aynı olmalı (sonuç yeniden çizilirken bir an yalnızca "Kaydet" okunup
  // denetim düşüyordu, 22.10.2026, PR #226'nın CI'ı)
  for(let k=0;k<20;k++){await p.waitForTimeout(400);const y=await sonucMetni(p);if(y===s)break;s=y}
  return s;
}
const onayVarMi=s=>{const m=s.toLocaleLowerCase('tr').match(ONAY);return m?m[0]:null};

module.exports=async({br,B,opt,ok})=>{
  const ctx=await br.newContext(opt);
  try{
    for(const tur of TURLER){
      const {p,errs}=await ac(ctx,B+'ocr.html');
      ok(await gorunur(p.getByRole('radio',{name:tur})),tur+': ürün türü seçeneği görünmüyor');
      await p.getByRole('radio',{name:tur}).click();
      let once=await sonucMetni(p);

      // 1) Örnek metin
      await p.getByRole('button',{name:'Örnek metin dene'}).click();
      const ornek=await yeniSonuc(p,once);
      ok(ornek.length>0&&ornek!==once,tur+': örnek metinle sonuç görünmedi');
      let m=onayVarMi(ornek);
      ok(!m,tur+' örnek: sonuçta onay anlamında "'+m+'" geçiyor');
      // Renk tek başına değil: önem düzeyi yazıyla da görünür
      ok(/Uyarı|Dikkat/.test(ornek),tur+' örnek: uyarılar yazılı düzey adı (Uyarı/Dikkat) taşımıyor; renk tek başına kalmış olabilir');
      ok(await gorunur(p.getByText(/^(Uyarı|Dikkat)\b/).first(),3000),tur+' örnek: "Uyarı"/"Dikkat" yazısı görünür değil');

      // 2) Hiçbir şeyin tanınmadığı kendi metni
      await p.getByText('Okunan Metin',{exact:true}).click();
      const kutu=p.getByPlaceholder(/Okunan metin burada görünür/);
      ok(await gorunur(kutu,3000),tur+': metin kutusu açılmadı');
      await kutu.fill(HIC_TANINMAYAN);
      const bos=await yeniSonuc(p,ornek);
      ok(bos.length>0&&bos!==ornek,tur+': kendi yazılan metinle sonuç güncellenmedi');
      m=onayVarMi(bos);
      ok(!m,tur+' tanınmayan metin: sonuçta onay anlamında "'+m+'" geçiyor');
      ok(BULUNAMADI.test(bos),tur+' tanınmayan metin: sonuç "bulunamadı / onay değildir" demiyor: '+bos.slice(0,160));

      // 3) Sıradan bir metin (ör. yalnızca su): yine onay sözcüğü yok
      await kutu.fill(SIRADAN);
      const su=await yeniSonuc(p,bos);
      m=onayVarMi(su);
      ok(!m,tur+' "su" metni: sonuçta onay anlamında "'+m+'" geçiyor');

      ok(errs.length===0,tur+': sayfa hatası: '+errs.join(' | '));
      await p.close();
    }
  }finally{await ctx.close()}
};
