'use strict';
/* Lines, stations and train types.
 *
 * LINES: each station is [name, km from the first station, size].
 *   size: 'terminal' (big city terminal) | 'major' | 'town' | 'halt' (small rural stop)
 *   env:  'valley' (Nile valley with desert cliffs) | 'delta' (flat Delta farmland to the horizon)
 * The kilometre figures are approximate and written from memory. They only set the order of
 * stations and the relative gaps; the game compresses distances so one trip stays playable.
 * To add a line or station, add an entry here. Nothing else needs to change.
 */
const LINES = [
  { id: 'giza-minya', name: 'الجيزة – المنيا', env: 'valley', stations: [
    ['الجيزة', 0, 'major'], ['الواسطى', 83, 'town'], ['بني سويف', 111, 'major'], ['المنيا', 233, 'major']] },
  { id: 'upper', name: 'القاهرة – أسوان (خط الصعيد)', env: 'valley', stations: [
    ['القاهرة (رمسيس)', 0, 'terminal'], ['الجيزة', 12, 'major'], ['البدرشين', 33, 'halt'], ['العياط', 56, 'halt'],
    ['الواسطى', 95, 'town'], ['بني سويف', 123, 'major'], ['الفشن', 150, 'halt'], ['مغاغة', 190, 'town'],
    ['المنيا', 245, 'major'], ['ملوي', 300, 'town'], ['ديروط', 350, 'halt'], ['أسيوط', 375, 'major'],
    ['سوهاج', 467, 'major'], ['جرجا', 500, 'town'], ['نجع حمادي', 590, 'town'], ['قنا', 604, 'major'],
    ['الأقصر', 670, 'major'], ['إسنا', 710, 'halt'], ['إدفو', 790, 'town'], ['كوم أمبو', 830, 'town'], ['أسوان', 879, 'terminal']] },
  { id: 'alex', name: 'القاهرة – الإسكندرية', env: 'delta', stations: [
    ['القاهرة (رمسيس)', 0, 'terminal'], ['قليوب', 14, 'halt'], ['بنها', 47, 'major'], ['طنطا', 93, 'major'],
    ['كفر الزيات', 110, 'town'], ['دمنهور', 150, 'major'], ['كفر الدوار', 176, 'town'], ['سيدي جابر', 205, 'major'],
    ['الإسكندرية (مصر)', 208, 'terminal']] },
  { id: 'canal', name: 'القاهرة – بورسعيد', env: 'delta', stations: [
    ['القاهرة (رمسيس)', 0, 'terminal'], ['بلبيس', 55, 'halt'], ['الزقازيق', 80, 'major'], ['أبو صوير', 105, 'halt'],
    ['الإسماعيلية', 128, 'major'], ['القنطرة', 175, 'halt'], ['بورسعيد', 235, 'terminal']] }
];

/* Latin spellings for platform name boards. */
const EN_NAMES = { 'الجيزة': 'Giza', 'الواسطى': 'Wasta', 'بني سويف': 'Beni Suef', 'المنيا': 'Minya', 'القاهرة (رمسيس)': 'Ramses', 'البدرشين': 'Badrashin', 'العياط': 'Ayat', 'الفشن': 'Fashn', 'مغاغة': 'Maghagha', 'ملوي': 'Mallawi', 'ديروط': 'Dairut', 'أسيوط': 'Asyut', 'سوهاج': 'Sohag', 'جرجا': 'Girga', 'نجع حمادي': 'Nag Hammadi', 'قنا': 'Qena', 'الأقصر': 'Luxor', 'إسنا': 'Esna', 'إدفو': 'Edfu', 'كوم أمبو': 'Kom Ombo', 'أسوان': 'Aswan', 'قليوب': 'Qalyub', 'بنها': 'Banha', 'طنطا': 'Tanta', 'كفر الزيات': 'Kafr El Zayat', 'دمنهور': 'Damanhur', 'كفر الدوار': 'Kafr El Dawwar', 'سيدي جابر': 'Sidi Gaber', 'الإسكندرية (مصر)': 'Alexandria (Misr)', 'بلبيس': 'Bilbeis', 'الزقازيق': 'Zagazig', 'أبو صوير': 'Abu Suwir', 'الإسماعيلية': 'Ismailia', 'القنطرة': 'Qantara', 'بورسعيد': 'Port Said' };

/* TRAIN TYPES. Colours are approximate. loco.kind: 'ge' (sloped-nose GE diesel) | 'box' (flat-front box-cab diesel) | 'velaro' (high-speed head car) | 'dmu'.
 * 'top/low/trim' paint the locomotive (top = upper body, low = lower band, trim = stripe); 'body/band/trim' the coaches.
 * consist: 'coach' | 'old' | 'talgo' | 'vcoach' (Velaro middle car) | 'cab' (rear cab car of a DMU or Velaro) | 'tank' | 'box' | 'flat' | 'cont' | 'hopper' | 'gond'.
 * mass in tonnes per vehicle, fmax in kN, power in MW, vmax in km/h, brake in m/s2 at full service.
 * price: cost in game coins to unlock the train (0 = free from the start). Coins are earned by finishing trips (see wallet in main.js).
 * snd.horn lists the chime pitches in Hz. The GE profile is measured from a recording (five chimes); the others are estimates. */
const GE_HORN = [320, 382, 439, 498, 643];
const TRAIN_TYPES = [
  { id: 'vip', price: 0, name: 'الجنرال GE (ركاب مكيّف)', desc: 'جرار GE أحمر وفضي مع سبع عربيات مكيّفة. سريع ومريح.',
    loco: { kind: 'ge', len: 19.9, top: 0xc4161c, low: 0xbfc4c8, trim: 0xe9e9e4, num: '٢٦١٢' },
    coach: { style: 'std', body: 0xdfe2e4, band: 0xc4161c, trim: 0x2a4f86 }, consist: Array(7).fill('coach'),
    locoMass: 95, vehMass: 48, fmax: 300, power: 2.9, vmax: 120, brake: 1.15,
    snd: { base: 28, span: 17, horn: GE_HORN, turbo: 0.06 } },
  { id: 'orange', price: 40, name: 'الجنرال GE البرتقالي (ركاب)', desc: 'جرار برتقالي بخط رمادي وعربيات بيضا. اللي بتشوفه في رمسيس.',
    loco: { kind: 'ge', len: 19.9, top: 0xe8761c, low: 0xb9bdc1, trim: 0xe6e4dc, num: '١٠١٢' },
    coach: { style: 'std', body: 0xe6e4dc, band: 0xe8761c, trim: 0x8a8d90 }, consist: Array(8).fill('coach'),
    locoMass: 95, vehMass: 46, fmax: 300, power: 2.9, vmax: 110, brake: 1.1,
    snd: { base: 28, span: 17, horn: GE_HORN, turbo: 0.06 } },
  { id: 'hitachi', price: 60, name: 'هيتاشي (الأخضر بالشريط الكريمي)', desc: 'جرار ياباني أخضر بمقدمة مسطحة وعربيات زرقا. ثقيل وثابت.',
    loco: { kind: 'box', len: 17.6, top: 0x2f6a3e, low: 0x2f6a3e, trim: 0xe9dfb8, num: '٢٠٩٥' },
    coach: { style: 'std', body: 0x3c5a9a, band: 0xe9dfb8, trim: 0xf0ece0 }, consist: Array(8).fill('coach'),
    locoMass: 110, vehMass: 46, fmax: 320, power: 2.4, vmax: 100, brake: 1.0,
    snd: { base: 26, span: 18, horn: [262, 330, 392, 523], turbo: 0.05 } },
  { id: 'velaro', price: 100, name: 'فيلارو مصر (القطار السريع)', desc: 'قطار كهربائي أبيض سريع جدًا. فرامله قوية لكن يحتاج تركيز.',
    loco: { kind: 'velaro', len: 25.6, top: 0xf1f1ee, low: 0xf1f1ee, trim: 0xb3222a, num: '٣٠٠١' },
    coach: { style: 'velaro', body: 0xf1f1ee, band: 0x59606a, trim: 0xb3222a }, consist: ['vcoach', 'vcoach', 'vcoach', 'vcoach', 'vcoach', 'vcoach', 'cab'],
    locoMass: 60, vehMass: 52, fmax: 360, power: 8.0, vmax: 230, brake: 1.3,
    snd: { base: 40, span: 22, horn: [415, 523], turbo: 0.1 } },
  { id: 'talgo', price: 60, name: 'تالجو', desc: 'عربيات منخفضة وطويلة. أسرع قطر ديزل وأهدى سواقة.',
    loco: { kind: 'ge', len: 19.9, top: 0xe8e6df, low: 0xb9c0c8, trim: 0x2a4f86, num: '٢٧٠٣' },
    coach: { style: 'talgo', body: 0xe8e6df, band: 0x2a4f86, trim: 0xc8873a }, consist: Array(10).fill('talgo'),
    locoMass: 90, vehMass: 38, fmax: 280, power: 3.2, vmax: 140, brake: 1.2,
    snd: { base: 28, span: 17, horn: [277, 349, 415, 523], turbo: 0.08 } },
  { id: 'sleeper', price: 40, name: 'قطر النوم', desc: 'عربيات نوم زرقا. تقيل وبطيء في الفرملة.',
    loco: { kind: 'ge', len: 19.9, top: 0x1d3f73, low: 0xd7d2c2, trim: 0xd9a63a, num: '٢٦٠٥' },
    coach: { style: 'std', body: 0x274d8a, band: 0xd9a63a, trim: 0xe9e4d6 }, consist: Array(8).fill('coach'),
    locoMass: 95, vehMass: 52, fmax: 300, power: 2.9, vmax: 110, brake: 1.05,
    snd: { base: 27, span: 17, horn: GE_HORN, turbo: 0.06 } },
  { id: 'tahsin', price: 40, name: 'القطر المحسّن', desc: 'قطر ركاب عادي أحسن. تسع عربيات.',
    loco: { kind: 'ge', len: 19.9, top: 0x2c5b46, low: 0xd8d0b5, trim: 0xe2c14a, num: '٢٢٤٠' },
    coach: { style: 'std', body: 0xd8d0b5, band: 0x2c5b46, trim: 0xe2c14a }, consist: Array(9).fill('coach'),
    locoMass: 90, vehMass: 44, fmax: 290, power: 2.6, vmax: 110, brake: 1.1,
    snd: { base: 26, span: 18, horn: [247, 311, 370, 466], turbo: 0.05 } },
  { id: 'third', price: 0, name: 'القطر العادي (ثالثة)', desc: 'عربيات قديمة بشبابيك صغيرة. بطيء ويقف في كل محطة.',
    loco: { kind: 'box', len: 17.6, top: 0x3f4a2c, low: 0x9a8f72, trim: 0xb8452a, num: '٤٠٨٨' },
    coach: { style: 'old', body: 0x8d6b3a, band: 0x3f4a2c, trim: 0xd6c38a }, consist: Array(10).fill('old'),
    locoMass: 88, vehMass: 40, fmax: 270, power: 2.3, vmax: 100, brake: 1.0,
    snd: { base: 24, span: 18, horn: [196, 247, 294, 370], turbo: 0.04 } },
  { id: 'dmu', price: 0, name: 'قطر الضواحي (ديزل)', desc: 'وحدة ديزل بكابينة من الطرفين.',
    loco: { kind: 'dmu', len: 22, top: 0xe4a321, low: 0xe9e6dc, trim: 0x2a4f86, num: '٧١٠٢' },
    coach: { style: 'std', body: 0xe9e6dc, band: 0xe4a321, trim: 0x2a4f86 }, consist: ['coach', 'cab'],
    locoMass: 50, vehMass: 42, fmax: 190, power: 1.6, vmax: 110, brake: 1.2,
    snd: { base: 32, span: 20, horn: [330, 392, 494], turbo: 0.1 } },
  { id: 'freight', price: 60, name: 'شحن: بترول وبضاعة مختلطة', desc: 'قاطرة وأربع عشرة عربية (صهاريج وصناديق وحاويات). تقيل وفرامله ضعيفة.',
    loco: { kind: 'ge', len: 19.9, top: 0xc8571a, low: 0x2e2e2c, trim: 0xe8c43a, num: '٢٨١٠' },
    coach: { style: 'std', body: 0x6b4a35, band: 0x3a3a38, trim: 0xe8c43a },
    consist: ['tank', 'box', 'cont', 'gond', 'tank', 'hopper', 'cont', 'tank', 'box', 'hopper', 'cont', 'tank', 'gond', 'cont'],
    locoMass: 110, vehMass: 70, fmax: 320, power: 2.6, vmax: 80, brake: 0.6,
    snd: { base: 26, span: 18, horn: [147, 185, 220, 277], turbo: 0.05 } },
  { id: 'cargo-cont', price: 80, name: 'شحن: حاويات (ميناء)', desc: 'عربيات حاويات ملونة. ثقيل ومناسب لخطوط الدلتا.',
    loco: { kind: 'ge', len: 19.9, top: 0x1d3f73, low: 0x2e2e2c, trim: 0xe8c43a, num: '٢٩٠٣' },
    coach: { style: 'std', body: 0x6b4a35, band: 0x3a3a38, trim: 0xe8c43a }, consist: Array(16).fill('cont'),
    locoMass: 110, vehMass: 58, fmax: 330, power: 2.7, vmax: 90, brake: 0.65,
    snd: { base: 26, span: 18, horn: GE_HORN, turbo: 0.05 } },
  { id: 'cargo-phos', price: 80, name: 'شحن: فوسفات وحبوب', desc: 'عربيات مفتوحة من فوق (هوبر). ثقيلة جدًا.',
    loco: { kind: 'box', len: 17.6, top: 0x2f6a3e, low: 0x2f6a3e, trim: 0xe9dfb8, num: '٢٠٩٨' },
    coach: { style: 'std', body: 0x6b4a35, band: 0x3a3a38, trim: 0xe8c43a }, consist: Array(18).fill('hopper'),
    locoMass: 110, vehMass: 82, fmax: 340, power: 2.4, vmax: 70, brake: 0.55,
    snd: { base: 25, span: 18, horn: [262, 330, 392, 523], turbo: 0.05 } }
];

/* DAILY MISSIONS (progress resets every day) and ACHIEVEMENTS (lifetime). 'stat' names a counter kept in main.js
 * (see tripStats): trips, stops, perfect (stops with accuracy 85+), ontime (arrived on time), clean (trip without speeding fines or derailing), freight.
 * Rewards are game coins. After changing prices or rewards run `node tools/make-catalog.js` so the server knows them. */
const MISSIONS = [
  { id: 'd_trip', name: 'رحلة النهارده', desc: 'خلّص رحلة واحدة', stat: 'trips', goal: 1, reward: 15 },
  { id: 'd_stops', name: 'خدّم 10 محطات', desc: 'وقّف في 10 محطات النهارده', stat: 'stops', goal: 10, reward: 40 },
  { id: 'd_perfect', name: 'وقفة مظبوطة × 3', desc: 'وقّف بدقة 85+ عند علامة القف 3 مرات', stat: 'perfect', goal: 3, reward: 25 },
  { id: 'd_ontime', name: 'في الميعاد × 3', desc: 'وصّل في ميعاده في 3 محطات', stat: 'ontime', goal: 3, reward: 25 },
  { id: 'd_clean', name: 'رحلة نضيفة', desc: 'خلّص رحلة من غير غرامة سرعة ومن غير انقلاب', stat: 'clean', goal: 1, reward: 30 },
  { id: 'd_freight', name: 'رحلة شحن', desc: 'خلّص رحلة بقطر شحن', stat: 'freight', goal: 1, reward: 35 }
];
const ACHIEVEMENTS = [
  { id: 'a_first', name: 'أول مشوار', desc: 'خلّص أول رحلة', stat: 'trips', goal: 1, reward: 20 },
  { id: 'a_trips10', name: '10 رحلات', desc: 'خلّص 10 رحلات', stat: 'trips', goal: 10, reward: 100 },
  { id: 'a_trips50', name: '50 رحلة', desc: 'خلّص 50 رحلة', stat: 'trips', goal: 50, reward: 400 },
  { id: 'a_stops100', name: 'خدمة 100 محطة', desc: 'وقّف في 100 محطة', stat: 'stops', goal: 100, reward: 200 },
  { id: 'a_perfect50', name: 'وقّاف محترف', desc: '50 وقفة بدقة 85+', stat: 'perfect', goal: 50, reward: 150 },
  { id: 'a_ontime50', name: 'ما بيتأخرش', desc: 'وصّل في الميعاد في 50 محطة', stat: 'ontime', goal: 50, reward: 150 },
  { id: 'a_clean10', name: '10 رحلات نضيفة', desc: 'من غير غرامات ولا انقلاب', stat: 'clean', goal: 10, reward: 150 },
  { id: 'a_freight10', name: 'سواق شحن', desc: '10 رحلات شحن', stat: 'freight', goal: 10, reward: 150 }
];
const LEVEL_TITLES = [[1, 'سواق جديد'], [3, 'سواق'], [6, 'سواق محترف'], [10, 'سواق خبير'], [15, 'أسطى القطر']];
/* Level from experience: level n needs 50 * n experience points to reach n + 1. Returns { level, into, need, title }. */
function levelOf(xp) {
  let lvl = 1, need = 50; xp = Math.max(0, Math.floor(xp));
  while (xp >= need) { xp -= need; lvl++; need = 50 * lvl; }
  let title = LEVEL_TITLES[0][1]; for (const [l, t] of LEVEL_TITLES) if (lvl >= l) title = t;
  return { level: lvl, into: xp, need, title };
}

/* Region of a station, from its name. It decides the look of the station and the houses around it (see stations.js STYLES).
 * 'cairo' Cairo and Giza, 'delta' Delta towns, 'alex' Alexandria, 'canal' Suez Canal cities, 'middle' Beni Suef to Dairut,
 * 'upper' Asyut to Qena, 'luxor' Luxor and Esna, 'aswan' Edfu to Aswan (Nubian colours). */
function regionOf(name) {
  const n = String(name || '');
  if (/الإسكندرية|سيدي جابر/.test(n)) return 'alex';
  if (/بورسعيد|الإسماعيلية|القنطرة|أبو صوير|السويس/.test(n)) return 'canal';
  if (/أسوان|إدفو|كوم أمبو/.test(n)) return 'aswan';
  if (/الأقصر|إسنا/.test(n)) return 'luxor';
  if (/أسيوط|سوهاج|جرجا|نجع حمادي|قنا/.test(n)) return 'upper';
  if (/البدرشين|العياط|الواسطى|بني سويف|الفشن|مغاغة|المنيا|ملوي|ديروط/.test(n)) return 'middle';
  if (/القاهرة|الجيزة/.test(n)) return 'cairo';
  return 'delta';
}
