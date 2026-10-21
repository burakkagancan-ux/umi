/* Arayüz ortak (Etiket Oku): yardımcılar (el, $, vEl), durum satırı, veri yükleme, alt sayfa, kart çizimi. Klasik betik; sayfadaki ilk arayüz dosyası.
   15.10.2026'ya kadar js/arayuz.js'in ilk bölümüydü (U-07 6. adım: arayuz_ortak, arayuz_profil, arayuz_sonuc olarak bölündü; sıra ve kod aynı). */
var OCR_URL="https://inapp-ocr-3a8f.burakkagancan.workers.dev";   // Cloudflare Worker adresi; boşsa telefonda Tesseract kullanılır
var DB=null,BDB=null,ABOUT={},IDX=null,FLAGS={},BRANDS=null,ST=document.getElementById("st"),LAST=[],LASTSUM=null,LASTBR=[];
var CLS=["g","u","y","r"],LBL_K=["risk.yok","risk.dogrulanmadi","risk.dikkat","risk.uyari"];
function LBL(i){return t(LBL_K[i])}
/* Ortak değerlendirme modelinin (js/degerlendirme.js) dizinleri: yüklenmemiş olan null */
function degBaglam(){return {idx:IDX,K:typeof KIDX!=="undefined"?KIDX:null,T:typeof TIDX!=="undefined"?TIDX:null,ptype:typeof PTYPE!=="undefined"?PTYPE:""}}
function $(i){return document.getElementById(i)}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
/* Sonuç ekranından ve Profilim'den yöntem sayfasına bağlantı (E-01) */
function yontemBag(cls,anahtar){var a=el("a",cls||"yontem-bag",t(anahtar||"yontem.bag"));a.href="yontem.html";return a}
/* Özet kartının satırı (gıda, kozmetik, temizlik; 17.10.2026): üstte ad, altında değer (telefonda dar iki sütun 4-5 satıra kırılıyordu). Değerin düzeyi
   (r/o uyarı, y dikkat) adın önünde sonuç kartlarındaki renk + şekil simgesiyle; ekran okuyucuya düzeyin adı metin olarak. Değer metni yazı renginde, kalın. */
function ozetSatir(d,label,val,cls){
  var r=el("div","srow"+(cls?" "+cls:"")),l=el("span","sl");
  if(cls){var lv=cls==="y"?"y":"r",ic=el("span","ic "+lv);ic.setAttribute("aria-hidden","true");l.appendChild(ic);l.appendChild(el("span","vh",t(lv==="y"?"risk.dikkat":"risk.uyari")+": "))}
  l.appendChild(document.createTextNode(label));r.appendChild(l);
  var v=el("span","sv"+(cls?" "+cls:""));if(typeof val==="string")v.textContent=val;else v.appendChild(val);r.appendChild(v);d.appendChild(r);
}
/* Veri metni öğesi: seçili dilde çevirisi yoksa metin kendi dilinde (lang) gösterilir, yanına küçük "henüz çevrilmedi" işareti eklenir (js/ceviri.js veriMetin) */
function vEl(tag,cls,tr,anahtar,resmi){var r=veriMetin(tr,anahtar,resmi);return vIsaret(el(tag,cls,r.s),r)}
function vIsaret(e,r){if(!r||!r.cevrilmedi)return e;e.lang=r.kod;var m=el("span","cvm",t("veri.cevrilmedi"));m.title=t("veri.cevrilmedi_aria");e.appendChild(document.createTextNode(" "));e.appendChild(m);return e}
function secBox(box,title,n){var d=el("details","sec");d.appendChild(el("summary",null,t("ortak.baslik_sayi",{ad:title,n:n})));box.appendChild(d);return d}   // varsayılan kapalı açılır bölüm
/* Durum satırı her mod için ayrı tutulur; mod değişince o modun mesajı gösterilir */
var STMSG={gida:"",koz:"",tem:""};
/* Durum satırı. bilgi=true: yalnızca bilgi ("listeler yüklendi"), ekranda gösterilmez; başka bir mesaj yazılınca satır yine görünür */
var ST_BILGI={};
function setSt(mode,msg,bilgi){STMSG[mode]=msg;if(bilgi)ST_BILGI[msg]=1;if((typeof MODE==="undefined"||!MODE?"gida":MODE)===mode)ST.textContent=msg}
new MutationObserver(function(){ST.classList.toggle("bilgi",!!ST_BILGI[ST.textContent])}).observe(ST,{childList:true,characterData:true,subtree:true});
window.onerror=function(m,src,l){ST.textContent=t("ortak.sayfa_hatasi",{m:m,l:l});};

/* ---------- Veri yükleme ---------- */
var PATHS=["data/e_kodlari.json","e_kodlari.json"];
var COMBO=null;getJson("data/eslesmeler.json").then(function(j){COMBO=j.rules}).catch(function(){COMBO=null});
/* Ülke mevzuat katmanı (B-05, js/ulke.js): seçili ülkenin özellikleri ve katkı durumları. Ülke koşulu kodda yazılmaz, ulkeOz ile sorulur. */
var ULKE_VERI=null,ULKE_HAZIR=getJson("data/ulke.json").then(function(j){
  ULKE_VERI=j;if(ULKE_GEC&&typeof run==="function"&&$("metin").value.trim())run();   // gıda listesi beklemeden açıldıysa sonuç ülke satırlarıyla yeniden çizilir
},function(){ULKE_VERI=null}),ULKE_GEC=false;
/* Gıda listesi ülke verisini en çok 3 sn bekler (askıda kalan tek dosya ana listeyi kilitlemesin; bozma turu 21.10.2026) */
function ulkeBekle(){return Promise.race([ULKE_HAZIR,new Promise(function(r){setTimeout(function(){ULKE_GEC=!ULKE_VERI;r()},3000)})])}
function ulkeK(){return ulkeKatman(ULKE_VERI,ulke())}
function ulkeOz(ad){return ulkeOzellik(ulkeK(),ad)}
function getJson(p){return fetch(p,{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error(t("ortak.dosya_yok",{p:p}));return r.json()})}
function loadDb(i){
  if(i>=PATHS.length){var msg=t("gida.liste_yok");setSt("gida",msg);$("sonuc").textContent=msg;return}
  getJson(PATHS[i]).then(function(j){
    DB=j;FLAGS=(j.meta&&j.meta.flags)||{};
    return Promise.all([getJson("data/bilesenler.json").then(function(b){BDB=b},function(){BDB=null}),
      getJson("data/alerjen_sozluk.json").then(ozelSozlukKur,function(){}),ulkeBekle()]);   // sözlük yoksa elle eklenen ad yalnızca yazıldığı gibi aranır
  }).then(function(){
    IDX=buildIndex(DB,BDB);
    setSt("gida",BDB?t("gida.yuklendi",{n:DB.ingredients.length,b:BDB.items.length}):t("gida.yuklendi_bilesensiz",{n:DB.ingredients.length}),true);
    buildProfile();
  }).catch(function(){if(!DB)loadDb(i+1)});
}

/* ---------- Alt sayfa ---------- */
/* Alt sayfa: başlık, durum satırı ve içerik; kapatınca odak açan düğmeye döner.
   cls verilirse (ör. "yuzen") sayfaya eklenir; her açılışta sıfırlanır.
   kapaninca verilirse sayfa hangi yoldan kapanırsa kapansın (×, arka plan, Esc, üstüne başka sayfa açılması) bir kez çağrılır (barkod: kamerayı durdurur) */
var SHEET_RET=null,SHEET_KAPAN=null;
function sheetTemizle(){var k=SHEET_KAPAN;SHEET_KAPAN=null;if(k)k()}
function openSheet(title,how,body,ret,cls,kapaninca){
  sheetTemizle();SHEET_KAPAN=kapaninca||null;
  $("sheet").className="sheet"+(cls?" "+cls:"");$("sheet-t").textContent=title;var sb=$("sheet-b");sb.textContent="";
  if(how)sb.appendChild(el("div","how",how));sb.appendChild(body);
  SHEET_RET=ret||null;$("sheet").hidden=false;document.body.style.overflow="hidden";$("sheet-x").focus();
}
function closeSheet(){if($("sheet").hidden)return;sheetTemizle();$("sheet").hidden=true;document.body.style.overflow="";if(SHEET_RET)SHEET_RET.focus()}
$("sheet-x").onclick=closeSheet;$("sheet-bg").onclick=closeSheet;
document.addEventListener("keydown",function(e){if(e.key==="Escape")closeSheet()});
/* ---------- Kart ---------- */
function card(cls,title,lines){
  var d=el("div","res prof "+cls);d.appendChild(el("div","t",title));
  (lines||[]).forEach(function(l){if(l)d.appendChild(typeof l==="string"?el("div","ln",l):l)});
  return d;
}
/* Profil kartı verisini (js/profil_kart.js) çizer; {ozel:"zehir"} satırı Zehir Danışma Hattı kutusu (js/arayuz_temizlik.js) */
function kartEl(v){return card(v.cls,v.title,v.lines.map(function(l){return typeof l==="string"?l:l&&l.ozel==="zehir"?zehirHatti():null}))}
