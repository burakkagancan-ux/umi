// Cihaz deposu (js/depo.js): okuma varsayılanları, bozuk veri, hata veren depo, yazma sonucu. Çalıştır: node test/depo.js
const fs=require('fs'),vm=require('vm');
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('HATA',m)}};
const c=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/../js/depo.js','utf8'),c);
const D=vm.runInContext('({depoMetin,depoJson,depoDizi,depoYaz,depoYazMetin,depoSil,arka:function(a){DEPO_ARKA=a}})',c);
const bellek=(o)=>({v:Object.assign({},o||{}),getItem(k){return k in this.v?this.v[k]:null},setItem(k,s){this.v[k]=String(s)},removeItem(k){delete this.v[k]}});
const j=JSON.stringify;
// Depo yok (window yok, arka uç yok): okuma varsayılan, yazma false, hata yok
ok(D.depoMetin('dil')===null&&j(D.depoDizi('kayitli'))==='[]'&&D.depoJson('profil',null)===null&&D.depoYaz('x',1)===false&&D.depoSil('x')===false,'depo yokken varsayılanlar');
// Bellek deposu
const b=bellek({dil:'en',bozuk:'{x',nesne:'{"a":1}',dizi:'[1,2]',bos:''});D.arka(b);
ok(D.depoMetin('dil')==='en'&&D.depoMetin('yok')===null,'metin okuma');
ok(D.depoJson('bozuk','V')==='V'&&D.depoJson('bos','V')==='V'&&D.depoJson('yok','V')==='V','bozuk, boş ya da olmayan JSON varsayılana düşer');
ok(j(D.depoJson('nesne',null))==='{"a":1}'&&j(D.depoDizi('dizi'))==='[1,2]'&&j(D.depoDizi('nesne'))==='[]','JSON ve dizi okuma; dizi olmayan boş dizi');
ok(D.depoYaz('k',{a:[1]})===true&&b.v.k==='{"a":[1]}'&&D.depoYazMetin('m',5)===true&&b.v.m==='5','yazma');
ok(D.depoSil('k')===true&&D.depoMetin('k')===null,'silme');
// Hata veren depo (gizli sekme, kota dolu): sayfa kırılmaz
D.arka({getItem(){throw new Error('kapalı')},setItem(){throw new Error('kota')},removeItem(){throw new Error('kapalı')}});
ok(D.depoMetin('dil')===null&&D.depoJson('p',7)===7&&j(D.depoDizi('a'))==='[]'&&D.depoYaz('a',[])===false&&D.depoYazMetin('a','x')===false&&D.depoSil('a')===false,'hata veren depo: varsayılanlar ve false');
console.log(n+' depo denetimi, '+fail+' hata');process.exit(fail?1:0);
