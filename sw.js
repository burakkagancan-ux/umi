// Uygulamanın çevrimdışı da açılabilmesi için ilk kurulumda önbelleğe alınan dosyalar (CORE) ve önbellek adı (CACHE): gen_sw.py üretir
// <uretilen gen_sw.py>
// Elle düzenlenmez: python3 uret.py (gen_sw.py) yazar. CACHE dosya içeriklerinin özeti; CORE kurulumda önbelleğe alınanlar.
const CACHE = "tagsis-c2063b862561";
const CORE = [
  "./",
  "index.html",
  "ocr.html",
  "ansiklopedi.html",
  "manifest.webmanifest",
  "favicon-16.png",
  "favicon-32.png",
  "icon-192.png",
  "apple-touch-icon.png",
  "fonts/ansiklopedi.css",
  "tema.css",
  "css/liste.css",
  "js/depo.js",
  "js/veri_surum.js",
  "js/giris_liste.js",
  "js/dil.js",
  "js/yukari.js",
  "js/alt_menu.js",
  "js/arayuz_liste.js",
  "css/ocr.css",
  "js/giris_ocr.js",
  "js/arayuz_ortak.js",
  "js/arayuz_profil.js",
  "js/arayuz_sonuc.js",
  "js/arayuz_kozmetik.js",
  "js/arayuz_temizlik.js",
  "js/arayuz_karsilastir.js",
  "js/arayuz_paylas.js",
  "js/arayuz_kayit.js",
  "js/arayuz_barkod.js",
  "js/arayuz_rozet.js",
  "js/arayuz_eklediklerim.js",
  "js/arayuz_topluluk.js",
  "js/arayuz_besin.js",
  "js/arayuz_olcum.js",
  "js/arayuz_sayfa.js",
  "css/ansiklopedi.css",
  "js/giris_ansiklopedi.js",
  "js/arayuz_ansiklopedi.js",
  "js/kopru.js",
  "js/ceviri.js",
  "js/ortak.js",
  "js/gida.js",
  "js/kozmetik.js",
  "js/eslesme.js",
  "js/degerlendirme.js",
  "js/temizlik.js",
  "js/karsilastir_ayar.js",
  "js/karsilastir.js",
  "js/paylas_ayar.js",
  "js/paylas.js",
  "js/kayit.js",
  "js/besin.js",
  "js/barkod.js",
  "js/topluluk.js",
  "js/rozet.js",
  "js/profil_kart.js",
  "js/olcum.js",
  "js/ansiklopedi.js",
  "fonts/manrope-latin-ext-wght-normal.woff2",
  "fonts/manrope-latin-wght-normal.woff2",
  "icon-512.png",
  "icon-maskable-512.png",
  "data/ansiklopedi.json",
  "data/besin.json",
  "data/kozmetik.json",
  "data/kozmetik_inci.json",
  "data/tagsis.json",
  "data/arsiv.json",
  "data/durum.json",
  "data/e_kodlari.json",
  "data/eslesmeler.json",
  "data/bilesenler.json",
  "data/alerjen_sozluk.json",
  "data/rozetler.json",
  "data/e_aciklama.json",
  "data/temizlik.json",
  "i18n/diller.json",
  "i18n/tr.json",
  "data/ansiklopedi_tr.json",
];
// </uretilen>
// Kurulumda inmeyen, dile ve sayfaya bağlı dosyalar: i18n/<dil>.json, i18n/veri/<dil>.json, data/ansiklopedi_<dil>.json, data/ansiklopedi/…,
// dile özel yazı tipi, i18n/manifest/<dil>.webmanifest. Kullanıcı yalnızca kendi dilini ve açtığı sayfaları indirir (YOL_HARITASI.md O-10). Boyut bütçesi: test/onbellek.js
const DINAMIK = /^(i18n\/|data\/ansiklopedi[_/]|fonts\/)[\w./-]+\.(json|css|woff2|webmanifest)$/;
const yol = (u) => new URL(u, self.registration.scope).pathname.slice(new URL(self.registration.scope).pathname.length);
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null))))   // biri alınamazsa kurulum yine tamamlanır
      .then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => caches.open(CACHE).then((yeni) => Promise.all(keys.filter((k) => k !== CACHE).map((k) =>
        caches.open(k).then((eski) => tasi(eski, yeni)).then(() => caches.delete(k))))))
      .then(() => self.clients.claim())
  );
});
// Önce ağ (güncel veri), ağ yoksa son kaydedilen kopya (çevrimdışı açılış).
// cache: "no-cache": tarayıcının HTTP önbelleği (GitHub Pages max-age=600) atlanır, her dosya sunucuya sorulur (değişmediyse 304, ucuz).
// Yoksa yayından sonraki 10 dakikada yeni tr.json ile eski arayuz.js karışıp ekranda çeviri anahtarı görünebiliyordu (14.10.2026, profil.bki.aciklama).
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const nav = req.mode === "navigate";
  e.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      // index.html?q=... gibi adresler için sorgu kısmı yok sayılır
      .catch(() => caches.match(req, { ignoreSearch: nav }).then((hit) => hit || (nav ? caches.match("./") : undefined)))
  );
});
// Sayfa kullandığı dile ve sayfaya bağlı dosyaları bildirir (js/dil.js dilOnbellege); önbellekte yoksa indirilir
self.addEventListener("message", (e) => {
  const u = e.data && e.data.onbellek;
  if (!Array.isArray(u)) return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(u.filter((x) => typeof x === "string" && DINAMIK.test(x)).map((x) =>
    c.match(x).then((hit) => hit || c.add(x).catch(() => null))))));
});
// Sürüm değişince dile ve sayfaya bağlı dosyalar kaybolmasın: ağdan yenisi, ağ yoksa eski kopya
function tasi(eski, yeni) {
  return eski.keys().then((reqs) => Promise.all(reqs.filter((r) => DINAMIK.test(yol(r.url))).map((r) =>
    yeni.match(r).then((hit) => hit || yeni.add(r.url).catch(() => eski.match(r).then((res) => res && yeni.put(r, res)))))));
}
