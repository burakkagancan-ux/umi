// A-04 otomatik kırpma önerisi (js/foto.js): sözcük kutularından içerik listesi bölgesi, iz uyarısı ve besin tablosunun korunması, sınır durumlar.
// Gerçek Vision yanıtlarıyla eşik: test/veri/foto_sentetik.json (ölçüm ayrıntısı: node test/olcum_foto.js).
Object.assign(globalThis,require('./yukle.js'));
const {olc}=require('./olcum_foto.js');
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
const SET=require('./veri/foto_sentetik.json').etiketler;

// Eşik (CI): her etikette öneri var; öneriyle hiçbir beklenen alerjen/E kodu kaybolmaz, gürültü bulgusu kalmaz; tüm metin gürültülüdür (set anlamlı)
const o=olc(SET);
ok(o.toplam===16&&o.bulunan===16,'16 etiketin hepsinde öneri: '+o.bulunan+'/'+o.toplam);
ok(o.oneri.eksik===0,'öneri hiçbir beklenen bulguyu kaybetmez: '+JSON.stringify(o.etiket.filter(e=>e.oneri.eksik.length).map(e=>e.ad+' '+e.oneri.eksik)));
ok(o.oneri.fazla===0,'öneride gürültü bulgusu yok: '+JSON.stringify(o.etiket.filter(e=>e.oneri.fazla.length).map(e=>e.ad+' '+e.oneri.fazla)));
ok(o.tam.fazla>=8,'set gürültülü (tüm metinde en az 8 fazla bulgu): '+o.tam.fazla);

// Bölge: oran 0–1 içinde; yan yana ikinci dil sütunu (Ingredients) Türkçe öneriye girmez; İngilizce arayüzde İngilizce liste seçilir
for(const e of SET){const B=icerikBolge(e.vision,'tr');
  ok(B&&B.x>=0&&B.y>=0&&B.w>0&&B.h>0&&B.x+B.w<=1.0001&&B.y+B.h<=1.0001,e.ad+': bölge fotoğraf içinde '+JSON.stringify(B&&[B.x,B.y,B.w,B.h]));
  ok(B&&/^İçindekiler/.test(B.metin)&&!/Ingredients|Zutaten|Enerji|Üretici/.test(B.metin),e.ad+': yalnızca Türkçe liste: '+(B&&B.metin.slice(0,80)));}
const iki=SET.find(e=>e.ad==='iki_dil_yan_yana_tablo__duz'),Ben=icerikBolge(iki.vision,'en');
ok(Ben&&Ben.dil==='en'&&/^Ingredients/.test(Ben.metin)&&!/İçindekiler/.test(Ben.metin),'İngilizce arayüzde İngilizce liste: '+(Ben&&Ben.metin.slice(0,40)));
const tr=icerikBolge(iki.vision,'tr');ok(tr.x+tr.w<=Ben.x+0.01,'Türkçe sütun İngilizcenin solunda');
const de=SET.find(e=>e.ad==='cok_dil_alt_alta__duz');ok(icerikBolge(de.vision,'de').dil==='de','Almanca liste dil=de');
ok(icerikBolge(de.vision,'fr').dil==='de','arayüz dilinde liste yoksa okuma sırasında ilk (Almanca üstte)');

// İz uyarısı ve alerjen bildirimi liste dışındaysa korunur; besin tablosu gıdada korunur, öteki türde eklenmez
const uy=SET.find(e=>e.ad==='uyari_ve_adres_ustte__duz'),Bu=icerikBolge(uy.vision,'tr'),Mu=kirpMetni(uy.vision,Bu,true);
ok(/tesiste üretilmiştir/.test(Mu)&&!/tesiste/.test(Bu.metin),'listenin üstündeki "tesiste üretilmiştir" uyarısı eklenir');
ok(/Besin Değerleri/.test(Mu)&&/Tuz/.test(Mu),'gıdada besin tablosu korunur');
ok(!/Besin Değerleri/.test(kirpMetni(uy.vision,Bu,false)),'gıda dışında besin tablosu eklenmez');
ok(!/Üretici|0850/.test(Mu),'adres ve tüketici hattı çıkar');
ok(!/Ingredients|Water, sugar/.test(besinBolum(iki.vision)),'besin tablosu bölümü öteki dilin içerik listesinde biter: '+besinBolum(iki.vision).slice(0,60));
ok(/Contains milk/.test(kirpMetni(iki.vision,tr,true)),'öteki dildeki "Contains milk" bildirimi korunur');
ok(/Kann Spuren von Milch/.test(kirpMetni(de.vision,icerikBolge(de.vision,'tr'),true)),'öteki dildeki iz uyarısı korunur');
ok(izCumleleri('Saklayınız. Fındık içerebilir. Net 100 g').join('|')==='Fındık içerebilir.','iz cümlesi ayrılır');
ok(izCumleleri('Laktoz içerir. May contain nuts. Peut contenir du lait.').length===3,'içerir / may contain / peut contenir');
ok(izCumleleri('Net: 150 g. Serin yerde saklayınız.').length===0,'iz olmayan cümle alınmaz');

// Sınır durumlar: başlık yok, metin zaten yalnızca liste, çok kısa, bozuk girdi
const kutu=(s,x,y,b,son)=>[s,x,y,x+10*s.length,y,x+10*s.length,y+20,x,y+20,b,son?1:0];
const V=(sozler,boyut)=>({text:sozler.map(z=>z[0]).join(' '),boyut:boyut||[800,600],kutu:sozler.map(z=>kutu(...z))});
ok(icerikBolge(V([['Su',10,10,0],['şeker',40,10,0],['tuz',100,10,0,1]]),'tr')===null,'içerik başlığı yoksa öneri yok');
const yalniz=V([['İçindekiler:',10,10,0],['su,',140,10,0],['şeker,',180,10,0],['tuz,',250,10,0],['sirke.',300,10,0,1]]);
ok(icerikBolge(yalniz,'tr')===null,'metnin tamamı listeyse öneri gereksiz');
const kisa=V([['İçindekiler:',10,10,0],['su',140,10,0,1],['Üretici:',10,300,1],['Örnek',100,300,1],['A.Ş.',170,300,1],['İstanbul',220,300,1],['Türkiye',300,300,1,1]]);
ok(icerikBolge(kisa,'tr')===null,'listede en az 4 sözcük');
ok(icerikBolge(null,'tr')===null&&icerikBolge({text:'x'},'tr')===null&&icerikBolge({text:'x',kutu:[],boyut:[0,0]},'tr')===null,'bozuk girdi null');
ok(icerikBolge({text:'İçindekiler: a b c d',kutu:[['İçindekiler:',0,0,1,0,1,1,0,1,0,0],'bozuk',[3]],boyut:[10,10]},'tr')===null,'bozuk kutu atlanır, çökme yok');
// Uzak satır bölgeyi bitirir (aynı sütun, büyük boşluk)
const uzak=V([['İçindekiler:',10,10,0],['su,',140,10,0],['şeker,',180,10,0],['tuz,',250,10,0],['sirke.',300,10,0,1],['Kampanya',10,400,1],['kodu',100,400,1],['ambalajın',150,400,1],['içindedir',250,400,1,1]]);
const Bz=icerikBolge(uzak,'tr');ok(Bz&&!/Kampanya/.test(Bz.metin)&&Bz.y+Bz.h<0.2,'uzaktaki satır bölgeye girmez: '+(Bz&&Bz.metin));

console.log(n+' test, '+fail+' hata');process.exit(fail?1:0);
