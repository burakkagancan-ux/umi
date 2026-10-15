/* Arayüz: Topluluk (YOL_HARITASI.md G-04). Yalnızca ocr.html (OCR_URL, barkodWorker, barkodIsle gerekir). Saf mantık js/topluluk.js.
   - Ortak hedef: toplulukta doğrulanmış ürün sayısı ve sıradaki eşik (ilerleme çubuğu). Kişisel sıralama yok.
   - Eksik ürünler: çok aranan ama içeriği olmayan barkodlar; "Bu ürün elimde" barkodu Etiket Oku'da açar, içerik fotoğrafı istenir.
   - Arama bildirimi: barkodda içerik bulunamayınca (barkodYok) barkod ve tür bir kez POST /aranan ile bildirilir; kimlik gitmez. */
var TOPLULUK_SUZ=null;   // ekrandaki tür süzgeci (açılışta seçili mod)
function arananLoad(){return depoDizi("aranan")}
/* barkodYok çağırır: içerik bulunamayan barkod bu cihazdan bir kez bildirilir; sunucu kaç kez arandığını döndürürse goster(n) */
function arananBildir(kod,tur,goster){
  if(!OCR_URL)return Promise.resolve(null);
  var l=arananEkle(arananLoad(),kod);if(!l)return Promise.resolve(null);
  depoYaz("aranan",l);
  return barkodWorker("/aranan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kod:kod,tur:tur})}).then(function(j){
    if(j&&+j.n>1&&goster)goster(+j.n);
    return j;
  });
}

/* ---------- Profilim: "Topluluk" düğmesi (herkese) ---------- */
function toplulukProfil(){
  var box=$("toplulukbar");if(!box)return;box.textContent="";
  if(!OCR_URL)return;
  var b=el("button","kayitac");b.type="button";
  b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9" r="2.6"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15 14.6c.6-.1 1.3-.1 2-.1 2.6 0 4 1.7 4 4.5"/></svg>';
  var s=el("span","kt");s.appendChild(el("b",null,t("topluluk.baslik")));s.appendChild(el("span","mut",t("topluluk.alt")));b.appendChild(s);
  b.onclick=function(){location.hash="#topluluk"};box.appendChild(b);
}
/* ---------- Topluluk ekranı ---------- */
function toplulukAc(){
  var box=$("topluluk");box.textContent="";
  var bk=el("button","alt kback",t("kayit.geri"));bk.type="button";bk.onclick=toplulukKapat;box.appendChild(bk);
  box.appendChild(el("h2",null,t("topluluk.baslik")));
  var hd=el("div","res u tphedef");hd.appendChild(el("p","mut",t("ortak.yukleniyor")));box.appendChild(hd);
  box.appendChild(el("h3",null,t("topluluk.eksik_baslik")));
  box.appendChild(el("p","how",t("topluluk.eksik_not")));
  if(!TOPLULUK_SUZ)TOPLULUK_SUZ=MODE;
  var seg=el("div","seg");seg.setAttribute("role","radiogroup");seg.setAttribute("aria-label",t("sayfa.urun_turu"));
  ["gida","koz","tem"].forEach(function(tur){
    var b=el("button",null,t("kayit.tur."+tur));b.type="button";b.setAttribute("role","radio");b.setAttribute("data-tur",tur);
    b.setAttribute("aria-checked",String(tur===TOPLULUK_SUZ));
    b.onclick=function(){TOPLULUK_SUZ=tur;seg.querySelectorAll("button").forEach(function(x){x.setAttribute("aria-checked",String(x===b))});toplulukListe(hd,ul)};
    seg.appendChild(b);
  });
  box.appendChild(seg);
  var ul=el("div","klistk");box.appendChild(ul);
  box.appendChild(el("p","how",t("topluluk.gizlilik")));
  document.body.classList.add("mode-topluluk");box.hidden=false;window.scrollTo(0,0);bk.focus();
  toplulukListe(hd,ul);
}
function toplulukListe(hd,ul){
  var tur=TOPLULUK_SUZ;
  ul.textContent="";ul.appendChild(el("p","mut",t("ortak.yukleniyor")));
  Promise.all([barkodWorker("/topluluk?tur="+tur),barkodOffYukle()]).then(function(s){
    if(!document.body.classList.contains("mode-topluluk")||tur!==TOPLULUK_SUZ)return;
    var j=s[0];ul.textContent="";
    if(!j||j.devreDisi||!Array.isArray(j.eksik)){hd.textContent="";hd.appendChild(el("p","mut",t("ekle.ulasilamadi")));return}
    toplulukHedefCiz(hd,j.sayilar||{});
    var l=toplulukEksik(j.eksik,s[1],barkodSira());
    if(!l.length){ul.appendChild(el("p","mut",t("topluluk.eksik_bos")));return}
    l.forEach(function(u){ul.appendChild(toplulukSatir(u))});
  });
}
/* Ortak hedef kartı: doğrulanmış ürün sayısı / sıradaki eşik, ilerleme çubuğu, türlere göre eklenen ve doğrulanan */
function toplulukHedefCiz(hd,say){
  hd.textContent="";
  var d=say.dogrulanan||{},u=say.urun||{},h=toplulukHedef(toplulukToplam(d));
  hd.appendChild(el("div","t",t("topluluk.hedef_baslik")));
  hd.appendChild(el("div","ln",t(h.tamam?"topluluk.hedef_tamam":"topluluk.hedef_metin",{h:dilSayi(h.hedef)})));
  var bar=el("div","rzbar");bar.setAttribute("role","progressbar");bar.setAttribute("aria-valuemin","0");bar.setAttribute("aria-valuemax","100");
  bar.setAttribute("aria-valuenow",String(Math.round(h.oran*100)));bar.setAttribute("aria-label",t("topluluk.hedef_baslik"));
  var ic=el("span");ic.style.width=Math.round(h.oran*100)+"%";bar.appendChild(ic);hd.appendChild(bar);
  hd.appendChild(el("div","tpsay",t("topluluk.hedef_sayi",{n:h.n,s:dilSayi(h.n),h:dilSayi(h.hedef)})));
  ["gida","koz","tem"].forEach(function(k){hd.appendChild(el("div","how",t("kayit.tur."+k)+": "+t("topluluk.tur_sayi",{n:+u[k]||0,s:dilSayi(+u[k]||0),d:dilSayi(+d[k]||0)})))});
  hd.appendChild(el("div","how",t("topluluk.hedef_not")));
}
function toplulukSatir(u){
  var c=el("div","kitem ekitem tpitem");
  var ad=u.ad?((u.marka&&u.ad.toLocaleLowerCase(DIL.yerel).indexOf(u.marka.toLocaleLowerCase(DIL.yerel))<0?u.marka+" ":"")+u.ad):"";
  if(ad)c.appendChild(el("b",null,ad));
  c.appendChild(el("span","kin",u.kod));
  c.appendChild(el("span","kis",t("topluluk.arandi",{n:u.n,s:dilSayi(u.n)})+" · "+t("topluluk.son",{tarih:dilTarih(u.son,"gun")})));
  var b=el("button","alt",t("topluluk.elimde"));b.type="button";
  b.onclick=function(){toplulukUrun(u.kod,u.tur)};c.appendChild(b);
  return c;
}
/* "Bu ürün elimde": ekran kapanır, ürünün türüne geçilir, barkod Etiket Oku'da aranır (bulunamazsa içerik fotoğrafı istenir, katkı önerisi her zamanki gibi) */
function toplulukUrun(kod,tur){
  document.body.classList.remove("mode-topluluk");$("topluluk").hidden=true;
  if($("pd"))$("pd").open=false;
  history.replaceState(null,"",location.pathname+location.search);tabSync();
  window.scrollTo(0,0);
  if(tur&&tur!==MODE){$("metin").value="";setMode(tur,true)}
  barkodIsle(kod);
}
function toplulukKapat(){
  document.body.classList.remove("mode-topluluk");$("topluluk").hidden=true;
  if(location.hash==="#topluluk")location.replace("#profil");
}
function toplulukHash(){if(location.hash==="#topluluk")toplulukAc();else if(document.body.classList.contains("mode-topluluk")){document.body.classList.remove("mode-topluluk");$("topluluk").hidden=true}}
