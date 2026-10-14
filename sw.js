const CACHE = "tagsis-v51";
// Uygulamanın çevrimdışı da açılabilmesi için ilk kurulumda önbelleğe alınan dosyalar
const CORE = [
  "./", "index.html", "ocr.html", "ansiklopedi.html", "manifest.webmanifest",
  "js/veri_surum.js", "js/ceviri.js", "js/dil.js", "i18n/diller.json", "i18n/tr.json",   // yalnızca kaynak dil; seçili dilin dosyaları sayfa açılınca iner (DINAMIK)
  "js/ortak.js", "js/gida.js", "js/kozmetik.js", "js/eslesme.js", "js/temizlik.js", "js/karsilastir_ayar.js", "js/karsilastir.js", "js/paylas_ayar.js", "js/paylas.js", "js/kayit.js", "js/arayuz_kayit.js", "js/arayuz_liste.js", "js/besin.js", "js/barkod.js", "js/arayuz_barkod.js", "js/arayuz_besin.js", "data/besin.json", "js/rozet.js", "js/arayuz_rozet.js", "js/arayuz_eklediklerim.js", "js/topluluk.js", "js/arayuz_topluluk.js", "data/rozetler.json",
  "js/arayuz.js", "js/arayuz_kozmetik.js", "js/arayuz_temizlik.js", "js/arayuz_karsilastir.js", "js/arayuz_paylas.js", "js/arayuz_sayfa.js",
  "js/ansiklopedi.js", "js/arayuz_ansiklopedi.js", "data/ansiklopedi.json", "data/ansiklopedi_tr.json",   // ansiklopedi dizini; madde sayfaları açılınca iner
  "icon-192.png", "icon-512.png", "apple-touch-icon.png",
  "data/tagsis.json", "data/durum.json", "data/arsiv.json", "data/e_kodlari.json", "data/bilesenler.json", "data/e_aciklama.json",
  "data/eslesmeler.json", "data/kozmetik.json", "data/kozmetik_inci.json", "data/temizlik.json",   // kozmetik ve temizlik modu internetsiz de açılsın (~2,8 MB)
  "tema.css",
  "fonts/ansiklopedi.css", "fonts/bricolage-grotesque-latin-700-normal.woff2", "fonts/bricolage-grotesque-latin-ext-700-normal.woff2",
  "fonts/figtree-latin-400-normal.woff2", "fonts/figtree-latin-ext-400-normal.woff2", "fonts/figtree-latin-600-normal.woff2", "fonts/figtree-latin-ext-600-normal.woff2",
];
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
// Önce ağ (güncel veri), ağ yoksa son kaydedilen kopya (çevrimdışı açılış)
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const nav = req.mode === "navigate";
  e.respondWith(
    fetch(req)
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
