'use strict';
/* Player settings (kept in localStorage) and the code that applies them: language, graphics, controls, sound, camera, interface. */
const GFX_PRESETS = { low: { detail: 0, shadows: 0, reflect: 0, view: 0 }, medium: { detail: 1, shadows: 1, reflect: 1, view: 1 }, high: { detail: 2, shadows: 2, reflect: 2, view: 2 }, ultra: { detail: 3, shadows: 3, reflect: 3, view: 3 } };
const Settings = {
  def: {
    lang: 'ar', gfx: 'medium', detail: 1, shadows: 1, reflect: 1, view: 1, autoDN: true, weather: false,
    route: true, limits: true, notif: true, ctl: 'lever', sens: 1, invert: false,
    vMaster: 1, vEngine: 1, vVoice: 1, cam: 0, fov: 1, shake: true, lockres: true, uiScale: 1, uiAlpha: 1, atc: false, cine: false, tracks: 3, paint: {}, texts: {}
  },
  d: null, remote: {},
  fresh: false,   // true once the live config was read this session (so an old saved "maintenance" flag can never lock someone out while offline)
  /* Maintenance: when the admin closes the game, every player who is online sees this blocking screen with the message and the re-opening time; it checks again every minute and opens by itself. */
  adminPass() { try { return localStorage.getItem('qs-adminpass') === '1'; } catch (e) { return false; } },
  maint() {
    const R = this.remote || {}, on = this.fresh && R.maintenance && !/nomaint/.test(location.search) && !this.adminPass(), esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let el = document.getElementById('maintBox'); clearTimeout(this._mt);
    if (!on) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'maintBox'; el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:linear-gradient(180deg,#0b1220,#1b2a44);display:grid;place-items:center;text-align:center;color:#fff;padding:24px;direction:rtl;font-family:inherit'; document.body.appendChild(el); }
    const fmt = (ms) => { try { return new Date(+ms).toLocaleString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
    el.innerHTML = '<div style="max-width:540px"><div style="font-size:72px">🔧</div><h2 style="margin:8px 0">اللعبة تحت الصيانة</h2><p style="font-size:18px;line-height:1.8">' + esc(R.maintMsg || 'بنظبّط حاجات عشان تلعب أحسن. شكراً لصبرك.') + '</p>'
      + (R.reopenAt ? '<p style="font-size:18px">هتفتح تاني: <b style="color:#ffd35c">' + fmt(R.reopenAt) + '</b></p>' : '') + (R.updateNote ? '<p style="font-size:16px;opacity:.9">التحديث الجاي: <b>' + esc(R.updateNote) + '</b></p>' : '')
      + '<button id="maintRetry" style="margin-top:14px;padding:12px 26px;border:0;border-radius:12px;background:#ffd35c;color:#222;font:700 17px inherit">جرّب تاني</button></div>';
    const again = async () => { try { const g = await Account.col('config').doc('game').get(); if (g.exists) { this.remote = g.data() || {}; try { localStorage.setItem('qs-remote', JSON.stringify(this.remote)); } catch (e) { /* */ } } this.maint(); } catch (e) { this._mt = setTimeout(again, 60000); } };
    document.getElementById('maintRetry').onclick = again; this._mt = setTimeout(again, 60000);
  },
  load() {
    try { this.remote = JSON.parse(localStorage.getItem('qs-remote') || '{}') || {}; } catch (e) { this.remote = {}; }
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
  pixelRatio() { const dt = this.remote.maxDetail != null ? Math.min(this.d.detail, this.remote.maxDetail) : this.d.detail; return Math.min(window.devicePixelRatio || 1, [1, 1.5, 2.25, 3][dt] || 2); },
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
