'use strict';
/* Player settings (kept in localStorage) and the code that applies them: language, graphics, controls, sound, camera, interface. */
const GFX_PRESETS = { low: { detail: 0, shadows: 0, reflect: 0, view: 0 }, medium: { detail: 1, shadows: 1, reflect: 1, view: 1 }, high: { detail: 2, shadows: 2, reflect: 2, view: 2 }, ultra: { detail: 3, shadows: 3, reflect: 3, view: 3 } };
const Settings = {
  def: {
    lang: 'ar', gfx: 'high', detail: 2, shadows: 2, reflect: 2, view: 2, autoDN: true, weather: false,
    route: true, limits: true, notif: true, ctl: 'lever', sens: 1, invert: false,
    vMaster: 1, vEngine: 1, vVoice: 1, cam: 0, fov: 1, shake: true, uiScale: 1, uiAlpha: 1, atc: false, cine: false, paint: {}
  },
  d: null,
  load() {
    let v = null; try { v = JSON.parse(localStorage.getItem('qs-set') || 'null'); } catch (e) { /* no storage */ }
    this.d = Object.assign({}, this.def, v || {}); this.d.paint = Object.assign({}, (v && v.paint) || {});
    return this.d;
  },
  save() { try { localStorage.setItem('qs-set', JSON.stringify(this.d)); } catch (e) { /* no storage */ } },
  set(k, v) { this.d[k] = v; this.save(); this.apply(); },
  setPreset(name) { Object.assign(this.d, GFX_PRESETS[name], { gfx: name }); this.save(); },
  reset() { this.d = Object.assign({}, this.def, { paint: {} }); this.save(); this.apply(); },

  /* Language for the menu screens: 'ar', 'en', or the device language. */
  get lang() { const l = this.d.lang; return l === 'auto' ? ((navigator.language || 'ar').toLowerCase().startsWith('ar') ? 'ar' : 'en') : l; },
  L(ar, en) { return this.lang === 'en' && en ? en : ar; },

  /* Quality values the 3D code understands. */
  quality() { const n = this.d.detail; return n <= 0 ? 'low' : n === 1 ? 'medium' : 'high'; },
  pixelRatio() { return Math.min(window.devicePixelRatio || 1, [1, 1.5, 2, 2.5][this.d.detail] || 2); },
  shadowQ() { const n = this.d.shadows; return n <= 0 ? 'low' : n >= 3 ? 'high' : 'medium'; },
  fogMul() { return [2.2, 1.5, 1, 0.7][this.d.view] || 1; },

  /* The time of day when the player lets the game pick it: it follows the clock of the device. */
  autoTime() { const h = new Date().getHours(); return h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 16 ? 'noon' : h >= 16 && h < 19 ? 'sunset' : 'night'; },

  /* A copy of a train type with the colours the player chose in the garage. */
  paintType(t) {
    const p = this.d.paint[t.id]; if (!p) return t;
    return Object.assign({}, t, { loco: Object.assign({}, t.loco, p.top != null ? { top: p.top } : {}, p.body != null ? { low: p.body } : {}), coach: Object.assign({}, t.coach, p.top != null ? { band: p.top } : {}, p.body != null ? { body: p.body } : {}) });
  },

  apply() {
    const d = this.d, root = document.documentElement;
    root.lang = this.lang; root.dir = this.lang === 'en' ? 'ltr' : 'rtl';
    root.style.setProperty('--ui', d.uiScale); root.style.setProperty('--uia', d.uiAlpha);
    if (typeof Sound !== 'undefined') Sound.applyVolumes();
    document.body.classList.toggle('no-route', !d.route); document.body.classList.toggle('no-limits', !d.limits);
    document.body.dataset.ctl = d.ctl;
  }
};
Settings.load();
