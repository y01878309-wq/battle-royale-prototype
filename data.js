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

/* TRAIN TYPES. Colours are approximate. 'top/low/trim' paint the locomotive, 'body/band/trim' the coaches.
 * consist: list of vehicle kinds: 'coach' | 'old' | 'talgo' | 'cab' (DMU end car) | 'tank' | 'box' | 'flat'.
 * mass in tonnes per vehicle, fmax in kN, power in MW, vmax in km/h, brake in m/s2 at full service. */
const TRAIN_TYPES = [
  { id: 'vip', name: 'القطر المكيّف (VIP)', desc: 'قاطرة ديزل وسبع عربيات مكيّفة. سريع ومريح.',
    loco: { kind: 'ge', len: 19.9, top: 0x8c1b23, low: 0xc3c7c9, trim: 0xe9e9e4 },
    coach: { style: 'std', body: 0xc3c7c9, band: 0x8c1b23, trim: 0xe9e9e4 }, consist: Array(7).fill('coach'),
    locoMass: 95, vehMass: 48, fmax: 300, power: 2.9, vmax: 120, brake: 1.15,
    snd: { base: 22, span: 38, horn: [233, 293.7, 349.2], turbo: 0.06 } },
  { id: 'talgo', name: 'تالجو', desc: 'عربيات منخفضة وطويلة. أسرع قطر وأهدى سواقة.',
    loco: { kind: 'ge', len: 19.9, top: 0xe8e6df, low: 0xb9c0c8, trim: 0x2a4f86 },
    coach: { style: 'talgo', body: 0xe8e6df, band: 0x2a4f86, trim: 0xc8873a }, consist: Array(10).fill('talgo'),
    locoMass: 90, vehMass: 38, fmax: 280, power: 3.2, vmax: 140, brake: 1.2,
    snd: { base: 24, span: 36, horn: [277, 349, 415], turbo: 0.08 } },
  { id: 'sleeper', name: 'قطر النوم', desc: 'عربيات نوم زرقا. تقيل وبطيء في الفرملة.',
    loco: { kind: 'ge', len: 19.9, top: 0x1d3f73, low: 0xd7d2c2, trim: 0xd9a63a },
    coach: { style: 'std', body: 0x274d8a, band: 0xd9a63a, trim: 0xe9e4d6 }, consist: Array(8).fill('coach'),
    locoMass: 95, vehMass: 52, fmax: 300, power: 2.9, vmax: 110, brake: 1.05,
    snd: { base: 21, span: 38, horn: [220, 277, 330], turbo: 0.06 } },
  { id: 'tahsin', name: 'القطر المحسّن', desc: 'قطر ركاب عادي أحسن. تسع عربيات.',
    loco: { kind: 'ge', len: 19.9, top: 0x2c5b46, low: 0xd8d0b5, trim: 0xe2c14a },
    coach: { style: 'std', body: 0xd8d0b5, band: 0x2c5b46, trim: 0xe2c14a }, consist: Array(9).fill('coach'),
    locoMass: 90, vehMass: 44, fmax: 290, power: 2.6, vmax: 110, brake: 1.1,
    snd: { base: 20, span: 40, horn: [196, 247, 294], turbo: 0.05 } },
  { id: 'third', name: 'القطر العادي (ثالثة)', desc: 'عربيات قديمة بشبابيك صغيرة. بطيء ويقف في كل محطة.',
    loco: { kind: 'ge', len: 19.9, top: 0x3f4a2c, low: 0x9a8f72, trim: 0xb8452a },
    coach: { style: 'old', body: 0x8d6b3a, band: 0x3f4a2c, trim: 0xd6c38a }, consist: Array(10).fill('old'),
    locoMass: 88, vehMass: 40, fmax: 270, power: 2.3, vmax: 100, brake: 1.0,
    snd: { base: 19, span: 42, horn: [185, 233, 277], turbo: 0.04 } },
  { id: 'dmu', name: 'قطر الضواحي (ديزل)', desc: 'وحدة ديزل من ثلاث عربيات بكابينة من الطرفين.',
    loco: { kind: 'dmu', len: 22, top: 0xe4a321, low: 0xe9e6dc, trim: 0x2a4f86 },
    coach: { style: 'std', body: 0xe9e6dc, band: 0xe4a321, trim: 0x2a4f86 }, consist: ['coach', 'cab'],
    locoMass: 50, vehMass: 42, fmax: 190, power: 1.6, vmax: 110, brake: 1.2,
    snd: { base: 30, span: 45, horn: [330, 392, 494], turbo: 0.1 } },
  { id: 'freight', name: 'قطر بضاعة', desc: 'قاطرة وأربع عشرة عربية بضاعة. تقيل جدًا وفرامله ضعيفة.',
    loco: { kind: 'ge', len: 19.9, top: 0xc8571a, low: 0x2e2e2c, trim: 0xe8c43a },
    coach: { style: 'std', body: 0x6b4a35, band: 0x3a3a38, trim: 0xe8c43a },
    consist: ['tank', 'box', 'flat', 'box', 'tank', 'box', 'flat', 'tank', 'box', 'box', 'flat', 'tank', 'box', 'flat'],
    locoMass: 110, vehMass: 70, fmax: 320, power: 2.6, vmax: 80, brake: 0.6,
    snd: { base: 17, span: 44, horn: [147, 185, 220], turbo: 0.05 } }
];
