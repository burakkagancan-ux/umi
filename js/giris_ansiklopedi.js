/* Ansiklopedi (ansiklopedi.html) sayfasının saf mantık modülleri. Klasik arayüz betikleri (defer) bunlardan sonra çalışır. */
import {kopru} from "./kopru.js";
import * as ceviri from "./ceviri.js";
import * as ortak from "./ortak.js";
import * as ansiklopedi from "./ansiklopedi.js";
import * as paylas_ayar from "./paylas_ayar.js";
import * as rozet from "./rozet.js";
kopru(ceviri, ortak, ansiklopedi, paylas_ayar, rozet);
