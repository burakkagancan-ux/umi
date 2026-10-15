/* Etiket Oku (ocr.html) sayfasının saf mantık modülleri. Klasik arayüz betikleri (defer) bunlardan sonra, sayfadaki sırayla çalışır. */
import {kopru} from "./kopru.js";
import * as ceviri from "./ceviri.js";
import * as ortak from "./ortak.js";
import * as gida from "./gida.js";
import * as kozmetik from "./kozmetik.js";
import * as eslesme from "./eslesme.js";
import * as temizlik from "./temizlik.js";
import * as karsilastir_ayar from "./karsilastir_ayar.js";
import * as karsilastir from "./karsilastir.js";
import * as paylas_ayar from "./paylas_ayar.js";
import * as paylas from "./paylas.js";
import * as kayit from "./kayit.js";
import * as besin from "./besin.js";
import * as barkod from "./barkod.js";
import * as topluluk from "./topluluk.js";
import * as rozet from "./rozet.js";
kopru(ceviri, ortak, gida, kozmetik, eslesme, temizlik, karsilastir_ayar, karsilastir, paylas_ayar, paylas, kayit, besin, barkod, topluluk, rozet);
