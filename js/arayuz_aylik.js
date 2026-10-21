/* Arayüz: Aylık Özetim (YOL_HARITASI.md U-09, 21.10.2026). Saf mantık js/aylik.js; Profilim'de #aylikbar → ocr.html#aylik → #aylik ekranı (body.mode-aylik).
   Kayıt: tarama geçmişine yazılan her taramada (js/arayuz_karsilastir.js histSave; "Örnek metin dene" sayılmaz), bu cihazdan gönderilen barkod katkısında
   (js/arayuz_barkod.js) ve yeni rozet kademesinde (js/arayuz_rozet.js, js/arayuz_eklediklerim.js). Yalnızca cihazda; ekran hiçbir istek göndermez. */
var AYLIK_GOSTER=null;   // ekrandaki ay ("YYYY-AA"); açılışta bu ay
function aylikLoad(){return aylikNorm(depoJson("aylik",null))}
function aylikStore(o){return depoYaz("aylik",o)}
/* Maddenin ansiklopedi kimliği: gıdada tek E kodu, kozmetikte INCI → KIDX.ans, temizlikte madde notu → TIDX.ans */
function aylikAns(mode){
  return function(it){
    if(mode==="gida"){var e=(it.ids||[]).filter(function(id){return /^E\d/.test(id)});return e.length===1?e[0]:null}
    if(mode==="koz")return typeof KIDX!=="undefined"&&KIDX&&KIDX.ans?KIDX.ans[it.key]||null:null;
    if(mode==="tem")return it.kind==="sub"&&typeof TIDX!=="undefined"&&TIDX&&TIDX.ans?TIDX.ans[it.key]||null:null;
    return null;
  };
}
function aylikTaramaYaz(id,P){if(!P)return;try{aylikStore(aylikTarama(aylikLoad(),Date.now(),id,aylikUrun(P,aylikAns(P.mode))))}catch(e){}}
function aylikKatkiYaz(kod){try{aylikStore(aylikKatki(aylikLoad(),Date.now(),kod))}catch(e){}}
function aylikRozetYaz(r){try{aylikStore(aylikRozet(aylikLoad(),Date.now(),r))}catch(e){}}

/* ---------- Profilim: "Aylık Özetim" düğmesi ---------- */
function aylikProfil(){
  var box=$("aylikbar");if(!box)return;box.textContent="";
  var b=el("button","kayitac");b.type="button";
  b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 15h2M12 15h4"/></svg>';
  var n=aylikOzet(aylikLoad(),ayAnahtar(Date.now())).toplam;
  var s=el("span","kt");s.appendChild(el("b",null,t("aylik.baslik")));s.appendChild(el("span","mut say",n?t("aylik.bu_ay",{n:n}):t("aylik.alt")));b.appendChild(s);
  b.onclick=function(){location.hash="#aylik"};box.appendChild(b);
}
/* ---------- Aylık Özetim ekranı ---------- */
function aylikAc(){
  var box=$("aylik");box.textContent="";
  var simdi=ayAnahtar(Date.now());if(!AYLIK_GOSTER||AYLIK_GOSTER>simdi)AYLIK_GOSTER=simdi;
  var bk=el("button","alt kback",t("kayit.geri"));bk.type="button";bk.setAttribute("aria-label",t("aylik.geri"));bk.onclick=aylikKapat;box.appendChild(bk);
  box.appendChild(el("h2",null,t("aylik.baslik")));
  var o=aylikLoad(),aylar=aylikAylar(o),ay=AYLIK_GOSTER;
  // Ay seçici: önceki ay yalnızca daha eski kayıt varsa, sonraki ay bu aya kadar
  var nav=el("div","aynav");
  var on=el("button","alt",t("aylik.onceki"));on.type="button";on.setAttribute("aria-label",t("aylik.onceki"));on.textContent="‹";
  var sn=el("button","alt",t("aylik.sonraki"));sn.type="button";sn.setAttribute("aria-label",t("aylik.sonraki"));sn.textContent="›";
  on.disabled=!aylar.some(function(a){return a<ay});sn.disabled=ay>=simdi;
  on.onclick=function(){AYLIK_GOSTER=ayKaydir(ay,-1);aylikAc();var b=document.querySelector("#aylik .aynav button");if(b&&!b.disabled)b.focus()};
  sn.onclick=function(){AYLIK_GOSTER=ayKaydir(ay,1);aylikAc();var b=document.querySelectorAll("#aylik .aynav button")[1];if(b&&!b.disabled)b.focus()};
  var ad=el("h3","ayad",dilTarih(ayZaman(ay),"ayyil"));ad.setAttribute("aria-live","polite");
  nav.appendChild(on);nav.appendChild(ad);nav.appendChild(sn);box.appendChild(nav);
  var z=aylikOzet(o,ay);
  if(!z.toplam&&!z.katki&&!z.rozetler.length){box.appendChild(el("p","mut",t("aylik.bos")))}
  else{
    // Taranan ürünler: toplam ve türe göre
    var c1=el("div","res u aykart");c1.appendChild(el("div","t",t("aylik.taranan",{n:z.toplam})));
    var tl=el("div","ln aytur");["gida","koz","tem"].forEach(function(m){var ch=el("span","chip turr",t("ortak.baslik_sayi",{ad:t("kayit.tur."+m),n:z.tur[m]}));ch.setAttribute("data-tur",m);tl.appendChild(ch);tl.appendChild(document.createTextNode(" "))});
    c1.appendChild(tl);box.appendChild(c1);
    // Sonuç dağılımı: her ürün en yüksek düzeyiyle bir grupta; puan yok
    if(z.toplam){
      var c2=el("div","res u aykart");c2.appendChild(el("div","t",t("aylik.sonuclar")));
      [["uyari",3],["dikkat",2],["yok",0]].forEach(function(x){var l=el("div","ln aydag");l.appendChild(cmpIcon(x[1]));l.appendChild(document.createTextNode(t("aylik.dag."+x[0],{n:z.dag[x[0]]})));c2.appendChild(l)});
      box.appendChild(c2);
    }
    // En sık karşılaşılan uyarı/dikkat maddeleri; ansiklopedide sayfası olan bağlantı
    if(z.maddeler.length){
      var c3=el("div","res u aykart");c3.appendChild(el("div","t",t("aylik.maddeler")));
      z.maddeler.forEach(function(m){
        var l=el("div","ln aymad");l.appendChild(cmpIcon(m.rank>=3?3:2));
        var nm=m.name;if(m.mode==="gida"&&m.ans&&typeof IDX!=="undefined"&&IDX&&IDX.byId[m.ans])nm=m.ans+" · "+itAd(IDX.byId[m.ans]);   // gıdada ad seçili dilde
        if(m.ans){var a=el("a",null,nm);a.href="ansiklopedi.html?id="+encodeURIComponent(m.ans);l.appendChild(a)}else l.appendChild(el("span",null,nm));
        l.appendChild(el("span","mut",t("aylik.urunde",{n:m.n})));c3.appendChild(l);
      });
      box.appendChild(c3);
    }
    // Eklediklerim ve rozetler
    var c4=el("div","res u aykart");c4.appendChild(el("div","t",t("aylik.katkilar")));
    c4.appendChild(el("div","ln",t("aylik.eklenen",{n:z.katki})));
    c4.appendChild(el("div","ln",z.rozetler.length?t("aylik.rozetler",{l:z.rozetler.map(function(r){return (r[3]?t(r[3]):"")+" ("+t("rozet."+r[0]+".ad")+" · "+t("kayit.tur."+r[1])+")"}).join(", ")}):t("aylik.rozet_yok")));
    box.appendChild(c4);
  }
  box.appendChild(el("p","how it",t("aylik.not")));
  document.body.classList.add("mode-aylik");box.hidden=false;window.scrollTo(0,0);bk.focus();
}
function aylikKapat(){
  document.body.classList.remove("mode-aylik");$("aylik").hidden=true;
  if(location.hash==="#aylik")location.replace("#profil");
}
function aylikHash(){if(location.hash==="#aylik"){AYLIK_GOSTER=null;aylikAc()}else if(document.body.classList.contains("mode-aylik")){document.body.classList.remove("mode-aylik");$("aylik").hidden=true}}
window.addEventListener("hashchange",function(){if(location.hash==="#profil")aylikProfil()});   // Profilim'e her girişte bu ayın sayısı güncel
