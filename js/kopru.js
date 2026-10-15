/* Geçiş köprüsü (U-07, 15.10.2026): saf mantık ES modüllerinin dışa aktardıklarını, henüz klasik betik olan arayüz dosyaları için
   window'a bağlar. Okuma her seferinde modüldeki güncel değeri verir (ör. DIL); dışarıdan yazma hata verir (sessizce yutulmasın). Hata metinleri geliştirici içindir, kullanıcıya gösterilmez (İngilizce).
   Sayfa girişleri (giris_*.js) çağırır. Arayüz dosyaları modüle geçince bu dosya kalkar. */
export function kopru(...modlar){
  for(const m of modlar)for(const k of Object.keys(m)){
    if(Object.prototype.hasOwnProperty.call(window,k))throw new Error("kopru: global name already defined: "+k);
    Object.defineProperty(window,k,{get(){return m[k]},set(){throw new TypeError(k+": module binding is read-only")},configurable:true,enumerable:true});
  }
}
