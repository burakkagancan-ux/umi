// Cihazdaki kullanıcı verisinin sürümü (YOL_HARITASI.md O-06): sürümsüz veriden yükseltme, bozuk kayıtlar, ileri sürüm, yarıda kalan adım.
// Çalıştır: node test/veri_surum.js
const fs=require('fs');
eval(fs.readFileSync(__dirname+'/../js/veri_surum.js','utf8')+';global.V={veriGoc,veriSurumu,VERI_SURUM,VERI_GOC,VERI_ANAHTAR}');
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
// localStorage taklidi
function depo(o){const m=new Map(Object.entries(o||{}));return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}}

// Sürümsüz (bugünkü) veri: geçerli kayıtlar aynen kalır, sürüm yazılır
const kayit=JSON.stringify([{id:'k1',t:1,u:1,mode:'gida',name:'Gofret',note:'',text:'Şeker',oz:null}]);
let d=depo({kayitli:kayit,taramalar:'[]',yerimleri:'["e322"]',profil:'{"al":[],"vegan":true}',kayit_suz:'{"mode":"","sira":"ad"}',dil:'tr',ulke:'TR',tur:'koz',katkici:'0123456789abcdef0123456789abcdef'});
let r=V.veriGoc(d);
ok(r.once===0&&r.simdi===V.VERI_SURUM&&r.adim===V.VERI_SURUM&&!r.ileri,'sürümsüz veri yükseltilir: '+JSON.stringify(r));
ok(d.getItem('veri_surum')===String(V.VERI_SURUM),'sürüm yazılır');
ok(d.getItem('kayitli')===kayit&&d.getItem('yerimleri')==='["e322"]'&&d.getItem('profil')==='{"al":[],"vegan":true}','geçerli kayıtlar değişmez');
ok(d.getItem('dil')==='tr'&&d.getItem('ulke')==='TR'&&d.getItem('tur')==='koz'&&d.getItem('katkici').length===32,'düz metin ayarlar değişmez');
// İkinci açılış: hiçbir şey yapılmaz
r=V.veriGoc(d);ok(r.adim===0&&r.once===V.VERI_SURUM,'güncel veride adım yok');

// Bozuk kayıtlar silinir (okuyan her yer zaten boş sayıyordu), eski önbellek kaldırılır
d=depo({kayitli:'{bozuk',taramalar:'{"a":1}',yerimleri:'null',profil:'[1,2]',kayit_suz:'"x"',tagsis_raw:'[...]',dil:'en'});
V.veriGoc(d);
ok(['kayitli','taramalar','yerimleri','profil','kayit_suz','tagsis_raw'].every(k=>d.getItem(k)===null),'bozuk JSON kayıtları ve tagsis_raw silinir: '+JSON.stringify([...d.m]));
ok(d.getItem('dil')==='en','bozuk kayıt temizliği ayarlara dokunmaz');

// Boş depo (ilk ziyaret)
d=depo();r=V.veriGoc(d);ok(r.simdi===V.VERI_SURUM&&d.m.size===1,'boş depoda yalnızca sürüm yazılır');

// Daha yeni sürümün yazdığı veri (ör. önbellekten eski sayfa açıldı): dokunulmaz
d=depo({veri_surum:String(V.VERI_SURUM+1),kayitli:'{bozuk'});r=V.veriGoc(d);
ok(r.ileri&&r.adim===0&&d.getItem('kayitli')==='{bozuk'&&d.getItem('veri_surum')===String(V.VERI_SURUM+1),'ileri sürüm verisine dokunulmaz');

// Sayı olmayan sürüm 0 sayılır
ok(V.veriSurumu(depo({veri_surum:'abc'}))===0&&V.veriSurumu(depo({veri_surum:'-3'}))===0,'geçersiz sürüm 0 sayılır');

// Çok adımlı yükseltme ve yarıda kalan adım (gelecekteki VERI_GOC[2], [3] için mekanizma)
const eski={...V.VERI_GOC},sira=[];
V.VERI_GOC[2]=x=>{sira.push(2);x.setItem('yeni','1')};
V.VERI_GOC[3]=()=>{sira.push(3);throw new Error('yarıda')};
d=depo({veri_surum:'1'});r=V.veriGoc(d,3);
ok(sira.join()==='2,3'&&r.simdi===2&&d.getItem('veri_surum')==='2'&&d.getItem('yeni')==='1','adımlar sırayla; hata veren adımda sürüm yazılmaz: '+JSON.stringify(r));
delete V.VERI_GOC[3];sira.length=0;
d=depo();r=V.veriGoc(d,5);
ok(sira.join()==='2'&&r.simdi===2,'tanımsız adımda durur: '+JSON.stringify(r));
Object.keys(V.VERI_GOC).forEach(k=>{if(!eski[k])delete V.VERI_GOC[k]});

// Her sürüm için bir göç adımı var
for(let i=1;i<=V.VERI_SURUM;i++)ok(typeof V.VERI_GOC[i]==='function','VERI_GOC['+i+'] tanımlı');

// Kodda localStorage'a yazılan/okunan her anahtar VERI_ANAHTAR'da (yeni anahtar eklenince listeye ve gerekirse göçe girsin)
const js=fs.readdirSync(__dirname+'/../js').filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(__dirname+'/../js/'+f,'utf8')).join('\n');
const kullanilan=new Set([...js.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\("([^"]+)"/g)].map(m=>m[1]));
const bilinen=new Set([...Object.keys(V.VERI_ANAHTAR),'tagsis_raw']);
const eksik=[...kullanilan].filter(k=>!bilinen.has(k));
ok(!eksik.length,'VERI_ANAHTAR listesinde olmayan localStorage anahtarı: '+eksik.join(', '));
ok(kullanilan.size>=10,'anahtar taraması çalışıyor ('+kullanilan.size+')');

console.log(n+' test, '+fail+' hata');process.exit(fail?1:0);
