/* Liste (index.html) sayfasının saf mantık modülleri. Klasik arayüz betikleri (defer) bunlardan sonra çalışır. */
import {kopru} from "./kopru.js";
import * as ceviri from "./ceviri.js";
kopru(ceviri);
