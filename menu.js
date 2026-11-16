'use strict';
/* Profile bar, shop with top-up box, missions and achievements, first-launch name entry. */
const Stats = {
  d: null, day() { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); },
  load() {
    if (!this.d) { try { this.d = JSON.parse(localStorage.getItem('qs-stats') || 'null'); } catch (e) { /* */ } }
    if (!this.d) this.d = { all: {}, daily: {}, day: '' };
    if (this.d.day !== this.day()) { this.d.day = this.day(); this.d.daily = {}; }
    return this.d;
  },
  save() { try { localStorage.setItem('qs-stats', JSON.stringify(this.d)); } catch (e) { /* */ } },
  /* Called when a trip ends. */
  weekKey() { return Math.floor((Date.now() + 2 * 3600000) / 86400000 / 7); },
  record(game, type, extra) {
    const d = this.load(), add = (k, n) => { d.all[k] = (d.all[k] || 0) + n; d.daily[k] = (d.daily[k] || 0) + n; };
    if (extra) {   // numbers for the contests: coins earned and best score today, kilometres this week
      d.daily.earn = (d.daily.earn || 0) + (extra.earn || 0); d.daily.best = Math.max(d.daily.best || 0, extra.score || 0);
      if (!d.wk || d.wk.k !== this.weekKey()) d.wk = { k: this.weekKey(), km: 0 }; d.wk.km += extra.km || 0;
    }
    const clean = !game.derailed && !game.penalty.speed;
    add('trips', game.finished && !game.derailed ? 1 : 0); add('stops', game.rec.length);
    add('perfect', game.rec.filter((r) => r.pts >= 85).length); add('ontime', game.rec.filter((r) => r.bonus > 0).length);
    add('clean', game.finished && clean ? 1 : 0); add('freight', game.finished && !game.derailed && /^(freight|cargo)/.test(type.id) ? 1 : 0);
    this.save();
  }
};

const Menu = {
  el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; },
  esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },
  copy(text) { try { navigator.clipboard.writeText(text); } catch (e) { /* */ } },

  init(onChange) { this.onChange = onChange || (() => {}); },

  refresh() {
    if (this.bar) this.refreshBar(); if (typeof Hub !== 'undefined' && Hub.api && !Hub.root.hidden && Hub.scr === 'home') Hub.show('home');
  },

  refreshBar() {
    const a = Account.d; if (!a) { this.bar.textContent = ''; return; }
    const lv = levelOf(a.xp || 0), title = lv.title;
    this.bar.innerHTML = `<div class="pname"><b>${this.stickerEmoji()}${this.esc(a.name)}</b> <small>${this.esc(title)}</small></div>
      <div class="pmeta"><span>مستوى ${lv.level}</span><span>💰 ${a.coins}</span><span class="pid" title="انسخ">ID: ${this.esc(a.id)}</span></div>
      <div class="xpbar"><i style="width:${Math.round(100 * lv.into / lv.need)}%"></i></div>`;
    this.bar.querySelector('.pid').onclick = () => this.copy(a.id);
    this.bar.querySelector('.pname').onclick = () => this.askName(true);
  },

  modal(title, build) {
    this.close();
    const ov = this.el('div', 'modal'), box = this.el('div', 'modal-box'), h = this.el('div', 'modal-h', `<b>${title}</b>`), x = this.el('button', 'mbtn', '✕');
    x.type = 'button'; x.onclick = () => this.close(); h.appendChild(x); box.appendChild(h);
    const body = this.el('div', 'modal-body'); box.appendChild(body); ov.appendChild(box); document.body.appendChild(ov); this.ov = ov; build(body, ov); return ov;
  },
  close() { if (this.ov) { this.ov.remove(); this.ov = null; } },

  askName(rename) {
    this.modal(rename ? 'غيّر اسمك' : 'اهلاً بيك! اكتب اسمك', (b) => {
      const inp = this.el('input'); inp.maxLength = 16; inp.placeholder = 'اسمك'; inp.value = rename && Account.d ? Account.d.name : ''; b.appendChild(inp);
      const ok = this.el('button', 'mbtn primary', 'تمام'); ok.type = 'button';
      ok.onclick = async () => { const n = inp.value.trim() || 'سواق'; ok.disabled = true; if (rename) await Account.rename(n); else await Account.register(n); this.close(); this.refresh(); this.onChange(); };
      b.appendChild(ok); setTimeout(() => inp.focus(), 50);
    });
  },

  /* A side-view picture of the whole train (locomotive and coaches) drawn from the train's own colours, for the store. */
  trainSVG(t) {
    const hx = (n) => '#' + (n | 0).toString(16).padStart(6, '0'), k = t.loco.kind, W = 300, H = 74, y0 = 52;
    const n = Math.min(4, t.consist.length), cl = [];
    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="tsvg"><rect width="${W}" height="${H}" rx="8" fill="#1d2636"/><rect y="${y0 + 8}" width="${W}" height="${H - y0 - 8}" fill="#2c2f33"/><rect y="${y0 + 7}" width="${W}" height="2" fill="#8d8780"/>`;
    if (k === 'velaro' && t.id === 'monorail') svg += `<rect x="0" y="${y0 + 4}" width="${W}" height="6" fill="#6b7280"/>`;
    const car = (x, w, o) => {   // one coach / wagon
      const c = o.body, b = o.band, tr = o.trim, fr = o.freight;
      let r = `<rect x="${x}" y="${y0 - 28}" width="${w}" height="26" rx="${o.rx || 3}" fill="${c}"/><rect x="${x}" y="${y0 - 9}" width="${w}" height="5" fill="${b}"/><rect x="${x}" y="${y0 - 14}" width="${w}" height="1.6" fill="${tr}"/>`;
      if (!fr) for (let i = 0; i < Math.floor((w - 8) / 9); i++) r += `<rect x="${x + 5 + i * 9}" y="${y0 - 24}" width="6" height="7" rx="1" fill="#1b2a3a"/>`;
      else r = `<rect x="${x}" y="${y0 - 20}" width="${w}" height="16" rx="2" fill="${c}"/><rect x="${x}" y="${y0 - 8}" width="${w}" height="3" fill="${b}"/>`;
      r += `<circle cx="${x + 9}" cy="${y0 + 1}" r="3.6" fill="#16181b"/><circle cx="${x + w - 9}" cy="${y0 + 1}" r="3.6" fill="#16181b"/>`; return r;
    };
    const lw = k === 'velaro' ? 70 : k === 'dmu' ? 56 : 62, top = hx(t.loco.top), low = hx(t.loco.low), trm = hx(t.loco.trim);
    // locomotive on the right (the train heads right)
    let x = W - lw - 6, loco = '';
    if (k === 'ge') loco = `<path d="M${x} ${y0 - 24} h${lw - 20} l16 8 v14 h-${lw - 4} z" fill="${low}"/><path d="M${x} ${y0 - 24} h${lw - 20} l16 8 v5 h-${lw - 4} z" fill="${top}"/><rect x="${x + lw - 26}" y="${y0 - 21}" width="12" height="8" rx="1" fill="#17222e"/><rect x="${x}" y="${y0 - 10}" width="${lw - 4}" height="3" fill="${trm}"/>`;
    else if (k === 'hood') loco = `<rect x="${x}" y="${y0 - 18}" width="${lw - 22}" height="16" fill="${low}"/><rect x="${x + lw - 24}" y="${y0 - 30}" width="22" height="28" rx="2" fill="${top}"/><rect x="${x + lw - 20}" y="${y0 - 26}" width="13" height="9" fill="#17222e"/><rect x="${x}" y="${y0 - 8}" width="${lw - 2}" height="3" fill="${trm}"/>`;
    else if (k === 'box') loco = `<rect x="${x}" y="${y0 - 26}" width="${lw}" height="24" rx="3" fill="${top}"/><rect x="${x}" y="${y0 - 14}" width="${lw}" height="12" fill="${low}"/><rect x="${x + lw - 17}" y="${y0 - 22}" width="13" height="9" fill="#17222e"/><rect x="${x}" y="${y0 - 14}" width="${lw}" height="2" fill="${trm}"/>`;
    else if (k === 'dmu') loco = `<path d="M${x} ${y0 - 26} h${lw - 14} q14 4 14 18 v${6} h-${lw} z" fill="${low}"/><rect x="${x}" y="${y0 - 9}" width="${lw}" height="5" fill="${top}"/><path d="M${x + lw - 22} ${y0 - 22} h12 q6 2 8 8 h-20 z" fill="#17222e"/><rect x="${x}" y="${y0 - 14}" width="${lw}" height="1.6" fill="${trm}"/>`;
    else loco = `<path d="M${x} ${y0 - 26} h${lw - 30} q30 2 30 22 v2 h-${lw} z" fill="${low}"/><rect x="${x}" y="${y0 - 8}" width="${lw}" height="4" fill="${trm}"/><path d="M${x + lw - 34} ${y0 - 21} h16 q10 2 12 10 h-28 z" fill="#17222e"/>`;
    loco += `<circle cx="${x + 12}" cy="${y0 + 1}" r="3.8" fill="#16181b"/><circle cx="${x + lw - 14}" cy="${y0 + 1}" r="3.8" fill="#16181b"/>`;
    const freight = ['tank', 'box', 'flat', 'hopper', 'gond', 'cont'].includes(t.consist[0]), cw = (W - lw - 18) / n - 3;
    for (let i = 0; i < n; i++) cl.push(car(8 + i * (cw + 3), cw, { body: freight ? (['#6b4a35', '#4b5563', '#7a5a2a', '#3f5f4a'][i % 4]) : hx(t.coach.body), band: freight ? '#2a2a2a' : hx(t.coach.band), trim: hx(t.coach.trim), freight }));
    return svg + cl.join('') + loco + '</svg>';
  },

  /* Store: trains, metro and monorail, stickers and top-up packages. Trains are bought here only. */
  stickerEmoji() { const t = STICKERS.find((x) => x.id === this.sticker() && Account.d && Account.owns(x)); return t ? t.emoji + ' ' : ''; },
  sticker() { try { return localStorage.getItem('qs-sticker') || ''; } catch (e) { return ''; } },
  shop(tab) {
    if (!Account.d) return this.askName();
    tab = tab || this._shopTab || 'trains'; this._shopTab = tab;
    this.modal('🛒 المتجر', (b) => {
      const a = Account.d, pay = window.QS_PAY || {};
      b.appendChild(this.el('div', 'wallet', `رصيدك: <b>🪙 ${a.coins}</b> جنيه لعبة · <b>💎 ${a.gems || 0}</b> ماسة`));
      const tabs = this.el('div', 'tabs');
      for (const [k, t] of [['trains', '🚆 القطارات'], ['metro', '🚇 المترو والمونوريل'], ['cabs', '🪑 الكبائن'], ['stickers', '⭐ الملصقات'], ['packs', '💎 الباكدجات والشحن']]) {
        const x = this.el('button', 'mbtn' + (k === tab ? ' primary' : ''), t); x.type = 'button'; x.onclick = () => this.shop(k); tabs.appendChild(x);
      }
      b.appendChild(tabs);
      const grid = this.el('div', 'shop');
      const buyBtn = (t, own, c, onOwn) => {
        const btn = this.el('button', 'mbtn ' + (own ? '' : 'primary'), own ? (onOwn ? onOwn[0] : '✔ معاك') : 'اشتري'); btn.type = 'button'; btn.disabled = own && !onOwn;
        btn.onclick = async () => {
          if (own) { onOwn && onOwn[1](); return; }
          btn.disabled = true; const r = await Account.buy(t);
          if (r === 'ok') { this.refresh(); this.shop(tab); this.onChange(); } else if (r === 'coins' || r === 'gems') { btn.disabled = false; btn.textContent = 'رصيدك مش كفاية'; this.noFunds(r, t); } else { btn.disabled = false; btn.textContent = 'مفيش اتصال بالإنترنت'; }
        };
        c.appendChild(btn);
      };
      const hex = (n) => '#' + (n | 0).toString(16).padStart(6, '0');
      if (tab === 'trains' || tab === 'metro') {
        for (const t of TRAIN_TYPES.filter((x) => (x.cat || 'train') === (tab === 'metro' ? 'metro' : 'train'))) {
          const own = Account.owns(t), c = this.el('div', 'item' + (own ? ' own' : ''));
          const sw = this.trainSVG(t);
          c.innerHTML = `<img class="tsvg" alt="" src="thumbs/${t.id}.jpg?v=${window.QS_BUILD || 1}"><b>${this.esc(t.name)}</b><small>${this.esc(t.desc || '')}</small><span>${own ? '✔ معاك' : '🔒 ' + priceTag(t) + (t.gems ? ' (شحن فقط)' : '')} · ${t.vmax} كم/س</span>`;
          { const im = c.querySelector('img'); im.onerror = () => { const d = document.createElement('div'); d.innerHTML = sw; im.replaceWith(d.firstChild); }; }
          buyBtn(t, own, c, own ? ['اختار', () => { document.getElementById('optTrain').value = t.id; this.close(); this.onChange(); }] : null);
          grid.appendChild(c);
        }
      } else if (tab === 'cabs') {
        let cur = 'terra'; try { cur = localStorage.getItem('qs-cab') || 'terra'; } catch (e) { /* */ }
        const note = this.el('p', 'dim', 'الكابينة بتظهر لما تسوق بكاميرا «من جوه». المترو ليه كابينته الخاصة.'); grid.appendChild(note);
        for (const t of CABS) {
          const own = Account.owns(t), c = this.el('div', 'item' + (own ? ' own' : ''));
          c.innerHTML = `<img class="tsvg" alt="" src="thumbs/cab-${t.id}.jpg?v=${window.QS_BUILD || 1}"><b>${this.esc(t.name)}</b><small>${this.esc(t.desc)}</small><span>${own ? (cur === t.id ? '✔ مستخدمة' : '✔ معاك') : '🔒 ' + priceTag(t) + ' (جواهر فقط)'}</span>`;
          c.querySelector('img').onerror = function () { this.remove(); };
          buyBtn(t, own, c, own ? [cur === t.id ? 'مستخدمة' : 'استخدمها', () => { try { localStorage.setItem('qs-cab', t.id); } catch (e) { /* */ } this.shop(tab); }] : null);
          grid.appendChild(c);
        }
      } else if (tab === 'stickers') {
        const cur = this.sticker();
        for (const t of STICKERS) {
          const own = Account.owns(t), c = this.el('div', 'item' + (own ? ' own' : ''));
          c.innerHTML = `<div class="stk">${t.emoji}</div><b>${this.esc(t.name)}</b><small>${this.esc(t.desc)}</small><span>${own ? (cur === t.id ? '✔ مستخدم' : '✔ معاك') : '🔒 ' + priceTag(t)}</span>`;
          buyBtn(t, own, c, own ? [cur === t.id ? 'شيل الملصق' : 'استخدمه', () => { try { localStorage.setItem('qs-sticker', cur === t.id ? '' : t.id); } catch (e) { /* */ } this.refresh(); this.shop(tab); }] : null);
          grid.appendChild(c);
        }
      } else {
        const packs = pay.packs || [];
        const top = this.el('div', 'topup');
        top.innerHTML = `<h4>شحن الرصيد</h4><p>${this.esc(pay.note || '')}</p>
          <div class="row"><span>فودافون كاش</span><b dir="ltr">${this.esc(pay.vodafone || '')}</b><button type="button" class="mbtn" data-c="${this.esc(pay.vodafone || '')}">نسخ</button></div>
          <div class="row"><span>الـ ID بتاعك</span><b dir="ltr">${this.esc(a.id)}</b><button type="button" class="mbtn" data-c="${this.esc(a.id)}">نسخ</button></div>`;
        top.querySelectorAll('button[data-c]').forEach((x) => { x.onclick = () => this.copy(x.dataset.c); });
        b.appendChild(top);
        for (const k of packs) {
          const c = this.el('div', 'item'), msg = 'عايز أشحن باكدج ' + k.name + ' (' + k.egp + ' جنيه) في لعبة قطارات مصر. الـ ID: ' + a.id;
          c.innerHTML = `<div class="stk">${k.gems ? '💎' : '🪙'}</div><b>${this.esc(k.name)}</b><small>${k.gems ? k.gems + ' ماسة' : k.coins + ' جنيه لعبة'}${k.bonus ? ' + ' + this.esc(k.bonus) : ''}</small><span>${k.egp} جنيه مصري</span>`;
          const w = this.el('a', 'mbtn primary', 'ابعت على واتساب'); w.target = '_blank'; w.rel = 'noopener'; w.href = 'https://wa.me/2' + String(pay.vodafone || '') + '?text=' + encodeURIComponent(msg); c.appendChild(w); grid.appendChild(c);
        }
      }
      b.appendChild(grid);
    });
  },

  /* "رصيدك خلص": shown when a buy fails for lack of coins/gems, with the number to top up and the player's ID */
  noFunds(kind, t) {
    if (!Account.d) return;
    this.modal('رصيدك خلص 💔', (b) => {
      const a = Account.d, pay = window.QS_PAY || {}, gem = kind === 'gems', need = gem ? t.gems : t.price, have = gem ? (a.gems || 0) : a.coins;
      b.appendChild(this.el('div', 'wallet', `${this.esc(t.name)} سعره <b>${gem ? '💎 ' + need + ' ماسة' : '🪙 ' + need + ' جنيه لعبة'}</b> ورصيدك <b>${have}</b> بس.`));
      const top = this.el('div', 'topup');
      top.innerHTML = `<h4>يرجى شحن رصيد</h4><p>ابعت المبلغ على فودافون كاش على الرقم ده، وابعت الـ ID بتاعك، وهنشحنلك الرصيد في أقرب وقت.</p>
        <div class="row"><span>فودافون كاش</span><b dir="ltr">${this.esc(pay.vodafone || '')}</b><button type="button" class="mbtn" data-c="${this.esc(pay.vodafone || '')}">نسخ</button></div>
        <div class="row"><span>الـ ID بتاعك</span><b dir="ltr">${this.esc(a.id)}</b><button type="button" class="mbtn" data-c="${this.esc(a.id)}">نسخ</button></div>
        <p><a class="mbtn primary" target="_blank" rel="noopener" href="https://wa.me/2${this.esc(pay.vodafone || '')}?text=${encodeURIComponent('عايز أشحن رصيد في لعبة قطارات مصر. الـ ID: ' + a.id)}">كلّمنا على واتساب</a></p>`;
      top.querySelectorAll('button[data-c]').forEach((x) => { x.onclick = () => this.copy(x.dataset.c); });
      b.appendChild(top);
    });
  },

  topup() {
    if (!Account.d) return this.askName();
    this.modal('المتجر والشحن', (b) => {
      const a = Account.d, pay = window.QS_PAY || {};
      b.appendChild(this.el('div', 'wallet', `رصيدك: <b>🪙 ${a.coins}</b> جنيه لعبة · <b>💎 ${a.gems || 0}</b> ماسة`));
      const top = this.el('div', 'topup');
      top.innerHTML = `<h4>شحن الرصيد</h4><p>${this.esc(pay.note || '')}</p>
        <div class="row"><span>فودافون كاش</span><b dir="ltr">${this.esc(pay.vodafone || '')}</b><button type="button" class="mbtn" data-c="${this.esc(pay.vodafone || '')}">نسخ</button></div>
        <div class="row"><span>الـ ID بتاعك</span><b dir="ltr">${this.esc(a.id)}</b><button type="button" class="mbtn" data-c="${this.esc(a.id)}">نسخ</button></div>
        ${Account.server ? '' : '<p class="warn">الحساب ده على جهازك بس (' + (Account.error || '') + ' ' + (FB.error || '') + '). الشحن بيشتغل لما تتصل بالإنترنت وتفتح اللعبة تاني.</p>'}`;
      top.querySelectorAll('button[data-c]').forEach((x) => { x.onclick = () => this.copy(x.dataset.c); });
      b.appendChild(top);
    });
  },

  missions(tab) {
    if (!Account.d) return this.askName();
    this.modal(tab === 'm' ? 'المهام اليومية' : 'الإنجازات', (b) => {
      const tabs = this.el('div', 'tabs'); for (const [k, t] of [['m', '🎯 المهام اليومية'], ['a', '🏆 الإنجازات']]) { const x = this.el('button', 'mbtn' + (k === tab ? ' primary' : ''), t); x.type = 'button'; x.onclick = () => this.missions(k); tabs.appendChild(x); } b.appendChild(tabs);
      const st = Stats.load(), day = Stats.day(), list = tab === 'm' ? MISSIONS : ACHIEVEMENTS;
      for (const m of list) {
        const have = (tab === 'm' ? st.daily : st.all)[m.stat] || 0, key = tab === 'm' ? m.id + '@' + day : m.id, done = have >= m.goal, got = Account.d.claimed.includes(key);
        const r = this.el('div', 'item mission' + (got ? ' own' : ''));
        r.innerHTML = `<b>${this.esc(m.name || m.title || m.id)}</b><small>${this.esc(m.desc || '')}</small><div class="xpbar"><i style="width:${Math.min(100, Math.round(100 * have / m.goal))}%"></i></div><span>${Math.min(have, m.goal)} / ${m.goal} · 💰 ${m.reward}</span>`;
        const btn = this.el('button', 'mbtn ' + (done && !got ? 'primary' : ''), got ? 'اتاخدت' : 'استلم'); btn.type = 'button'; btn.disabled = !done || got;
        btn.onclick = async () => { btn.disabled = true; if (await Account.claim(key, m.reward)) { this.refresh(); this.missions(tab); this.onChange(); } else btn.disabled = false; };
        r.appendChild(btn); b.appendChild(r);
      }
    });
  }
};
