// Kozmetik veri dosyalarının (data/kozmetik.json, data/kozmetik_inci.json) temel denetimi.
// Çalıştır: node test/kozmetik_veri.js
const fs = require('fs');
const K = JSON.parse(fs.readFileSync(__dirname + '/../data/kozmetik.json'));
const I = JSON.parse(fs.readFileSync(__dirname + '/../data/kozmetik_inci.json'));
const by = {};
for (const e of K.entries) for (const a of e.inci) (by[a] = by[a] || []).push(e);
const inci = {};
for (const it of I.items) inci[it[0]] = it;

// [INCI adı, beklenen en yüksek seviye ya da null (kayıt olmamalı), beklenen bayrak]
const cases = [
  ['BUTYLPHENYL METHYLPROPIONAL', 'red'],            // Lilial, 2022'den beri yasak
  ['ZINC PYRITHIONE', 'red'],
  ['TRIMETHYLBENZOYL DIPHENYLPHOSPHINE OXIDE', 'red', 'cmr_ban'], // TPO, 2025/877
  ['4-METHYLBENZYLIDENE CAMPHOR', 'red'],            // 2024/996
  ['HYDROXYISOHEXYL 3-CYCLOHEXENE CARBOXALDEHYDE', 'red'], // HICC (Lyral)
  ['ATRANOL', 'red'],
  ['MERCURY', 'red'],
  ['DIBUTYL PHTHALATE', 'red'],
  ['CYCLOTETRASILOXANE', 'red'],                     // D4
  ['COLLOIDAL SILVER (NANO)', 'red', 'nano'],
  ['HYDROQUINONE', 'red', 'cmr2_carc'],
  ['RETINOL', 'yellow'],                             // 2024/996
  ['DMDM HYDANTOIN', 'yellow', 'formaldehyde_releaser'],
  ['METHYLISOTHIAZOLINONE', 'yellow', 'allergen_preservative'],
  ['P-PHENYLENEDIAMINE', 'yellow', 'allergen_hairdye'],
  ['LINALOOL', 'info', 'allergen_fragrance'],
  ['LIMONENE', 'info', 'allergen_fragrance'],
  ['LAVANDULA OIL/EXTRACT', null, 'allergen_fragrance'], // 2023/1545 toplu etiket adı
  ['VANILLIN', null, 'allergen_fragrance'],
  ['PHENOXYETHANOL', 'info'],
  ['CI 77891', 'info'],
  ['AQUA', null], ['GLYCERIN', null], ['PARFUM', null], ['CITRIC ACID', null], ['SODIUM LAURETH SULFATE', null],
];
const rank = { info: 0, yellow: 1, orange: 2, red: 3 };
let fail = 0;
for (const [name, lvl, flag] of cases) {
  const es = by[name] || [];
  const top = es.reduce((m, e) => (m && rank[m] >= rank[e.level] ? m : e.level), null);
  const flags = es.flatMap(e => e.flags);
  let ok = true;
  if (lvl === null && flag === undefined) ok = es.length === 0;
  else if (lvl !== null && top !== lvl) ok = false;
  if (flag && !flags.includes(flag)) ok = false;
  if (!ok) { fail++; console.log('HATA', name, 'beklenen', lvl, flag || '', 'bulunan', top, flags.join(',')); }
}
// TPO artık Ek III'te olmamalı; 4-MBC UV filtresi listesinden çıkmış olmalı
if (K.entries.some(e => e.id === 'III/311' || e.id === 'VI/18')) { fail++; console.log('HATA: III/311 ya da VI/18 silinmemiş'); }
// Her kayıtta seviye ve Türkçe gerekçe olmalı
for (const e of K.entries) if (!e.level || !e.reason || !e.inci.length) { fail++; console.log('HATA: eksik alan', e.id); }
// INCI listesi: işlev ve bayraklar
const f = it => (it && it[2]) || [];
const checks = [['AQUA', it => it && it[1].length > 0], ['LANOLIN', it => f(it).includes('non_vegan')],
  ['CERA ALBA', it => f(it).includes('non_vegan')], ['HYDROLYZED COLLAGEN', it => f(it).includes('non_veg')],
  ['PTFE', it => f(it).includes('pfas')], ['HONEYSUCKLE FLOWER EXTRACT', it => !it || !f(it).length],
  ['SQUALANE', it => f(it).includes('vegan_unsure')], ['COCONUT MILK', it => !it || !f(it).includes('non_vegan')]];
for (const [n, fn] of checks) if (!fn(inci[n])) { fail++; console.log('HATA INCI', n, JSON.stringify(inci[n])); }
console.log(K.entries.length + ' düzenlenmiş kayıt, ' + I.items.length + ' INCI adı; ' + (cases.length + checks.length) + ' denetim, ' + fail + ' hata');
process.exit(fail ? 1 : 0);
