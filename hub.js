'use strict';
/* The main menu ("hub"): a 3D background with the player's train, the home screen, garage, map, contests and the settings screen. */
const Hub = {
  NEWS: [
    { tag: 'قطارات جديدة', title: 'ضواحي أزرق وكهربائي أصفر', text: 'قطارين جداد في المتجر. العربيات المرتفعة والكابينة بأزرارها الشغالة.' },
    { tag: 'خطوط جديدة', title: 'مطروح وسفاجا وكل الدلتا', text: 'اتضاف خطوط مطروح وسفاجا والفيوم والمنوفية وكفر الشيخ، وكل محطة بشكل مختلف.' },
    { tag: 'سكة مزدوجة', title: 'رصيفين وقطارات من الاتجاه التاني', text: 'سكتين متجاورتين وقطارات بتعدي عليك. الأرض الرملية في الصعيد.' }
  ],
  NEWS_EN: [
    { tag: 'New trains', title: 'Blue commuter and yellow EMU', text: 'Two new trains in the shop, with a working cab.' },
    { tag: 'New lines', title: 'Matrouh, Safaga and the whole Delta', text: 'New lines, and every station looks different.' },
    { tag: 'Double track', title: 'Two platforms and oncoming trains', text: 'Two tracks side by side, with sandy ground in Upper Egypt.' }
  ],
  TZ: 2 * 3600000,
  tickers: [], scr: '',
  $: (id) => document.getElementById(id),
  L: (a, e) => Settings.L(a, e),
  esc: (s) => Menu.esc(s),
  news() { return Settings.lang === 'en' ? this.NEWS_EN : this.NEWS; },
  fmt(n) { return Math.round(n).toLocaleString(Settings.lang === 'en' ? 'en-US' : 'ar-EG'); },

  /* Weekend (Friday and Saturday) pays double on finished trips. */
  mult() { const d = new Date(Date.now() + this.TZ).getUTCDay(); return d === 5 || d === 6 ? 2 : 1; },
  last() { try { return JSON.parse(localStorage.getItem('qs-last') || 'null'); } catch (e) { return null; } },
  ago(t) { const m = Math.max(1, Math.round((Date.now() - t) / 60000)); return m < 60 ? this.L(m + ' دقيقة', m + ' min') : m < 1440 ? this.L(Math.round(m / 60) + ' ساعة', Math.round(m / 60) + ' h') : this.L(Math.round(m / 1440) + ' يوم', Math.round(m / 1440) + ' d'); },

  init(api) {
    this.api = api; this.root = this.$('hub'); this.ui = this.$('hubUi'); this.bgCanvas = this.$('hubGl');
    if (Account.d && !Account.d.rec) { Account.d.rec = Account.makeRec(); Account.save(); }
  },

  /* ---------- screens ---------- */
  show(name, arg) {
    this.clearTick(); this.scr = name; this.root.hidden = false;
    this.bgMode = name === 'garage' ? 'garage' : 'home';
    if (name === 'garage') this.gsel = this.api.trainId();
    try { this.startBg(); this.bgTrainFor(TRAIN_TYPES.find((x) => x.id === (name === 'garage' ? this.gsel : this.api.trainId())) || TRAIN_TYPES[0]); } catch (e) { this.bgFail(e); }
    if (this.bg) this.bg.resize();
    ({ home: () => this.home(), garage: () => this.garage(), map: () => this.map(), compete: () => this.compete(arg) }[name] || (() => this.home()))();
  },
  hide() { this.clearTick(); this.root.hidden = true; this.stopBg(); },
  clearTick() { this.tickers.forEach(clearInterval); this.tickers = []; },
  every(fn, ms) { fn(); this.tickers.push(setInterval(fn, ms)); },

  topbar(title, icon) {
    const a = Account.d || { coins: 0 };
    return `<div class="sc-top"><button class="sc-back" data-a="home" aria-label="${this.L('رجوع', 'Back')}">→</button><div class="sc-title"><span>${icon || ''}</span>${this.esc(title)}</div><div class="sc-coins"><b>${this.fmt(a.coins || 0)}</b><i class="coin"></i></div></div>`;
  },
  wire(root, fn) { root.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => fn(b.dataset.a, b); }); },

  home() {
    const a = Account.d || { name: '', coins: 0, xp: 0 }, lv = levelOf(a.xp || 0), L = (x, y) => this.L(x, y), last = this.last(), nw = this.news();
    let seen = 0; try { seen = +localStorage.getItem('qs-news') || 0; } catch (e) { /* */ } const unread = Math.max(0, this.NEWS.length - seen);
    const m = this.mult(), day = new Date(Date.now() + this.TZ).getUTCDay();
    const ev = m > 1 ? L('🚆 النهارده الأجرة ×2 على كل رحلة!', '🚆 Today every trip pays x2!') : L('🚆 الجمعة والسبت: الأجرة ×2 على كل رحلة', '🚆 Fridays and Saturdays: trips pay x2');
    this.ui.innerHTML = `<div class="hb">
      <div class="hb-lv"><b>${lv.level}</b><div class="hb-lvt"><span>${this.esc(a.name || '')} · ${L(lv.title, 'Driver')}</span><div class="xpbar"><i style="width:${Math.round(100 * lv.into / lv.need)}%"></i></div></div><small>${lv.into} / ${lv.need}</small></div>
      <div class="hb-news"><span>📢</span><div id="hbTick"></div></div>
      <div class="hb-icons">
        <div class="hb-coins"><b>${this.fmt(a.coins || 0)}</b><button data-a="topup" aria-label="+">+</button></div><div class="hb-coins" style="margin-inline-start:6px"><b>💎 ${this.fmt(a.gems || 0)}</b></div>
        <button class="hb-ic" data-a="compete" aria-label="🏆">🏆</button><button class="hb-ic" data-a="settings" aria-label="⚙">⚙</button>
        <button class="hb-ic" data-a="bell" aria-label="🔔">🔔${unread ? '<i class="dot">' + unread + '</i>' : ''}</button>
      </div>
      <div class="hb-event${m > 1 ? ' on' : ''}">${ev}</div>
      <button class="hb-contest" data-a="compete"><span>🏆</span><b>${L('مسابقة شغالة', 'Contest live')}</b><span>${L('باقي', 'ends in')}</span><b id="hbTimer" dir="ltr">--:--:--</b></button>
      <div class="hb-logo"><b>${L('قطارات مصر', 'Egypt Trains')}</b><small>QITARAT MISR</small></div>
      <div class="hb-cards">${nw.slice(0, 2).map((n, i) => `<button class="hb-card" data-a="bell"><em>${this.esc(n.tag)}</em><b>${this.esc(n.title)}</b><small>${this.esc(n.text)}</small></button>`).join('')}</div>
      ${last ? `<div class="hb-cont"><button class="hb-play" data-a="continue" aria-label="play">▶</button><div><b>${L('كمّل من آخر مكان', 'Continue where you left off')}</b><span>${this.esc(last.trainName)}: ${this.esc(last.lineName)}</span><small>${L(last.score + ' نقطة · من ' + this.ago(last.t), last.score + ' pts · ' + this.ago(last.t) + ' ago')}</small></div><button class="hb-x" data-a="hideLast" aria-label="x">✕</button></div>` : ''}
      <div class="hb-menu">
        <button class="hb-main" data-a="play"><span><b>${L('ابدأ اللعب', 'Play')}</b><small>${L('اختار الخط والقطر وانطلق', 'Pick a line and a train')}</small></span><i>▶</i></button>
        <button class="hb-btn" data-a="trains"><i>🚆</i><span><b>${L('القطارات والمترو', 'Trains & Metro')}</b><small>${L('سوق القطارات من هنا على طول', 'Buy trains here')}</small></span></button>
        <button class="hb-btn" data-a="online"><i>🏁</i><b>${L('سباق أونلاين', 'Play online')}</b></button>
        <button class="hb-btn" data-a="garage"><i>🎨</i><b>${L('الجراج', 'Garage')}</b></button>
        <button class="hb-btn" data-a="map"><i>📍</i><b>${L('الخريطة', 'Map')}</b></button>
        <button class="hb-btn" data-a="topup"><i>🛒</i><b>${L('المتجر', 'Shop')}</b></button>
        <button class="hb-btn" data-a="ach"><i>🏆</i><b>${L('الإنجازات والمهام', 'Achievements')}</b></button>
        <button class="hb-btn" data-a="settings"><i>⚙</i><b>${L('الإعدادات', 'Settings')}</b></button>
      </div></div>`;
    this.wire(this.ui, (act) => this.act(act));
    let k = 0; const tick = this.$('hbTick');
    this.every(() => { const n = nw[k++ % nw.length]; tick.textContent = n.tag + ': ' + n.title + ' — ' + n.text; }, 6000);
    this.every(() => { const T = this.$('hbTimer'); if (!T) return; const left = Math.max(0, Math.floor((Date.now() + this.TZ) / 86400000 + 1) * 86400000 - this.TZ - Date.now()), p = (n) => String(n).padStart(2, '0'); T.textContent = p(Math.floor(left / 3600000)) + ':' + p(Math.floor(left % 3600000 / 60000)) + ':' + p(Math.floor(left % 60000 / 1000)); }, 1000);
  },

  act(a) {
    const A = this.api;
    if (a === 'home') this.show('home');
    else if (a === 'play') A.setup(false);
    else if (a === 'online') A.setup(true);
    else if (a === 'continue') { const l = this.last(); if (l) A.setup(false, l); }
    else if (a === 'hideLast') { try { localStorage.removeItem('qs-last'); } catch (e) { /* */ } this.show('home'); }
    else if (a === 'trains') Menu.shop();
    else if (a === 'topup') Menu.topup();
    else if (a === 'ach') Menu.missions('m');
    else if (a === 'garage') this.show('garage');
    else if (a === 'map') this.show('map');
    else if (a === 'compete') this.show('compete');
    else if (a === 'settings') SetUI.open(() => { this.show(this.scr || 'home'); });
    else if (a === 'bell') this.bell();
    else if (a === 'topup') Menu.topup();
  },

  bell() {
    try { localStorage.setItem('qs-news', String(this.NEWS.length)); } catch (e) { /* */ }
    Menu.modal(this.L('الأخبار والتحديثات', 'News'), (b) => { for (const n of this.news()) b.appendChild(Menu.el('div', 'item', `<em class="tag">${this.esc(n.tag)}</em><b>${this.esc(n.title)}</b><small>${this.esc(n.text)}</small>`)); });
    const d = this.root.querySelector('.hb-ic .dot'); if (d) d.remove();
  },

  /* ---------- 3D background: the player's train on a short loop of track ---------- */
  startBg() {
    if (this.bg) { this.bg.run = true; return; }
    if (!window.THREE) return;
    let r; try { r = new THREE.WebGLRenderer({ canvas: this.bgCanvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return; }
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); r.setSize(window.innerWidth, window.innerHeight);
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.3, 20000);
    const track = new Track(2600); track.buildMeshes(scene, 'medium');
    const sky = new Sky(r, scene); sky.setShadowQuality('medium'); sky.apply('sunset');
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: 0x8c7d57, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);
    this.bg = { r, scene, camera, track, sky, run: true, t: 0, added: [], s: 400 };
    this.bg.resize = () => { const W = window.innerWidth, H = window.innerHeight; r.setSize(W, H); camera.aspect = W / H; if (this.bgMode === 'garage') camera.clearViewOffset(); else camera.setViewOffset(W, H, W * 0.1, 0, W, H); camera.updateProjectionMatrix(); };
    window.addEventListener('resize', this.bg.resize);
    const FR = Track.makeFrame();
    const loop = (now) => {
      const b = this.bg; if (!b) return; requestAnimationFrame(loop);
      if (!b.run || b.dead) return; if (now - (b.last || 0) < 33) return; const dt = Math.min(0.1, (now - (b.last || now)) / 1000); b.last = now; b.t += dt;
      const lo = b.train.loco.body; lo.updateMatrixWorld(true); const c = lo.getWorldPosition(new THREE.Vector3()), garage = this.bgMode === 'garage';
      b.track.frame(b.s, FR);
      const f = FR, ang = garage ? 0.7 + b.t * 0.22 : -0.55 + Math.sin(b.t * 0.12) * 0.12, d = garage ? 30 : 34;
      // look at the loco from its left-front corner; the home screen shifts the train to the right of the screen where the buttons are not
      const ax = f.fwd.x * Math.cos(ang) - f.right.x * Math.sin(ang), az = f.fwd.z * Math.cos(ang) - f.right.z * Math.sin(ang);
      camera.position.set(c.x + ax * d, c.y + (garage ? 7 : 5.5), c.z + az * d); camera.lookAt(c.x - f.fwd.x * 4, c.y + 2.2, c.z - f.fwd.z * 4);
      try { sky.update(camera, c, b.t); b.train.setDoors(0.0); r.render(scene, camera); } catch (e) { this.bgFail(e); }
    };
    requestAnimationFrame(loop);
  },
  bgTrain() { this.bgTrainFor(TRAIN_TYPES.find((x) => x.id === this.api.trainId()) || TRAIN_TYPES[0], true); },
  bgPlatform() {
    const b = this.bg, f = Track.makeFrame(); b.track.frame(b.s - 40, f);
    const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0xb9b3a3, roughness: 0.9 }), line = new THREE.MeshStandardMaterial({ color: 0xe8c43a, roughness: 0.8 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.0, 300), mat); slab.position.set(4.6, 0.5, 0); slab.receiveShadow = true; slab.castShadow = true; g.add(slab);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 300), line); st.position.set(2.1, 1.02, 0); g.add(st);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.25, 120), new THREE.MeshStandardMaterial({ color: 0x2f6a3e, roughness: 0.7 })); roof.position.set(5.2, 5.4, 0); roof.castShadow = true; g.add(roof);
    for (let z = -55; z <= 55; z += 22) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.4, 8), new THREE.MeshStandardMaterial({ color: 0x595c60, metalness: 0.6, roughness: 0.5 })); p.position.set(3.0, 3.2, z); g.add(p); }
    g.position.copy(f.pos); g.position.y = 0; g.rotation.y = Math.atan2(f.fwd.x, f.fwd.z); b.scene.add(g); b.added.push(g);
  },
  bgFail(e) { try { console.warn('hub background', e); } catch (x) { /* */ } if (this.bg) { this.bg.run = false; this.bg.dead = true; } },
  stopBg() { const b = this.bg; if (!b) return; b.run = false; },
  killBg() { const b = this.bg; if (!b) return; this.bg = null; window.removeEventListener('resize', b.resize); try { b.r.dispose(); b.r.forceContextLoss(); } catch (e) { /* */ } },

  /* ---------- garage ---------- */
  TOP: [['أحمر', 0xc4161c], ['برتقالي', 0xe8761c], ['أصفر', 0xe4a321], ['أخضر', 0x2f6a3e], ['أخضر فاتح', 0x3fa55a], ['سماوي', 0x59b3e6], ['أزرق', 0x2455b5], ['كحلي', 0x1d3f73], ['بنفسجي', 0x6a3d9a], ['وردي', 0xd95a8c], ['أسود', 0x222222], ['أبيض', 0xf1f1ee]],
  BODY: [['أبيض', 0xe6e4dc], ['كريمي', 0xd8d0b5], ['رمادي فاتح', 0xb9bdc1], ['رمادي', 0x7d8186], ['سماوي فاتح', 0x8fc8ee], ['أصفر فاتح', 0xf0d98a], ['أخضر فاتح', 0xa9d6b0], ['فضي', 0xc9ccd0]],
  garage() {
    const L = (x, y) => this.L(x, y), hex = (n) => '#' + n.toString(16).padStart(6, '0');
    const sel = this.gsel || this.api.trainId(); this.gsel = sel; const t = TRAIN_TYPES.find((x) => x.id === sel) || TRAIN_TYPES[0], own = Account.d ? Account.owns(t) : isFree(t), pt = Settings.d.paint[t.id] || {};
    const curTop = pt.top != null ? pt.top : t.loco.top, curBody = pt.body != null ? pt.body : t.loco.low;
    this.ui.innerHTML = `<div class="sc">${this.topbar(L('الجراج', 'Garage'), '🎨')}
      <div class="gr"><div class="gr-list">${TRAIN_TYPES.map((x) => `<button data-a="t:${x.id}" class="${x.id === sel ? 'on' : ''}"><b>${this.esc(x.name)}</b><small>${(Account.d ? Account.owns(x) : isFree(x)) ? L('معاك', 'Owned') : '🔒 ' + priceTag(x)}</small></button>`).join('')}</div>
      <div class="gr-side"><h4>${L('لون القطر', 'Main colour')}</h4><div class="sw">${this.TOP.map(([n, c]) => `<button data-a="top:${c}" class="${c === curTop ? 'on' : ''}" style="background:${hex(c)}" aria-label="${n}"></button>`).join('')}</div>
        <h4>${L('لون الجسم', 'Body colour')}</h4><div class="sw">${this.BODY.map(([n, c]) => `<button data-a="body:${c}" class="${c === curBody ? 'on' : ''}" style="background:${hex(c)}" aria-label="${n}"></button>`).join('')}</div>
        <div class="gr-btns"><button class="mbtn" data-a="reset">${L('الألوان الأصلية', 'Original colours')}</button>
        <button class="mbtn primary" data-a="pick">${own ? L('اختار القطر ده', 'Use this train') : L('اشتريه 🔒 ' + priceTag(t), 'Buy 🔒 ' + priceTag(t))}</button></div></div></div></div>`;
    this.wire(this.ui, (a) => {
      if (a === 'home') return this.show('home');
      if (a.startsWith('t:')) { this.gsel = a.slice(2); return this.garage(); }
      if (a.startsWith('top:') || a.startsWith('body:')) { const [k, v] = a.split(':'); Settings.d.paint[t.id] = Object.assign({}, Settings.d.paint[t.id], { [k]: +v }); Settings.save(); return this.garage(); }
      if (a === 'reset') { delete Settings.d.paint[t.id]; Settings.save(); return this.garage(); }
      if (a === 'pick') { if (own) { this.api.setTrain(t.id); this.show('home'); } else Menu.shop(); }
    });
    const lst = this.ui.querySelector('.gr-list .on'); if (lst && lst.scrollIntoView) lst.scrollIntoView({ block: 'nearest' });
    this.bgTrainFor(t);
  },
  bgTrainFor(t, force) {
    if (!this.bg) return; const sig = t.id + JSON.stringify(Settings.d.paint[t.id] || {}); if (!force && this.bg.shown === sig) return; this.bg.shown = sig;
    const b = this.bg; for (const o of b.added) b.scene.remove(o); b.added = [];
    const n0 = b.scene.children.length; b.train = new Train(b.scene, b.track, 'medium', Settings.paintType(t)); b.train.setCabView(false);
    for (let i = n0; i < b.scene.children.length; i++) b.added.push(b.scene.children[i]);
    b.s = 160 + b.train.length * 0.5; b.train.place(b.s, 0, 0, 0); b.train.setDoors(0); this.bgPlatform();
  },

  /* ---------- map ---------- */
  CITY: { 'القاهرة': [31.25, 30.06], 'الجيزة': [31.21, 30.01], 'شبرا': [31.25, 30.1], 'بشتيل': [31.2, 30.06], 'البدرشين': [31.28, 29.85], 'العياط': [31.25, 29.62], 'الواسطى': [31.2, 29.33], 'ببا': [31.09, 29.18], 'بني سويف': [31.1, 29.07], 'الفشن': [30.9, 28.82], 'مغاغة': [30.84, 28.65], 'بني مزار': [30.8, 28.5], 'سمالوط': [30.71, 28.31], 'المنيا': [30.74, 28.11], 'ملوي': [30.84, 27.73], 'ديروط': [30.81, 27.56], 'منفلوط': [30.96, 27.31], 'أسيوط': [31.18, 27.18], 'أبو تيج': [31.32, 27.05], 'طهطا': [31.5, 26.77], 'سوهاج': [31.69, 26.56], 'جرجا': [31.89, 26.34], 'البلينا': [32.02, 26.23], 'نجع حمادي': [32.24, 26.05], 'دشنا': [32.46, 26.13], 'قنا': [32.72, 26.16], 'قوص': [32.76, 25.91], 'الأقصر': [32.64, 25.7], 'أرمنت': [32.53, 25.62], 'إسنا': [32.55, 25.29], 'إدفو': [32.87, 24.98], 'كوم أمبو': [32.93, 24.47], 'السد العالي': [32.88, 23.97], 'أسوان': [32.9, 24.09],
    'شبرا الخيمة': [31.25, 30.13], 'قليوب': [31.2, 30.18], 'قها': [31.2, 30.28], 'بنها': [31.18, 30.46], 'طوخ': [31.2, 30.35], 'طنطا': [31.0, 30.79], 'كفر الزيات': [30.81, 30.82], 'إيتاي البارود': [30.67, 30.88], 'دمنهور': [30.47, 31.04], 'أبو حمص': [30.31, 31.1], 'كفر الدوار': [30.13, 31.14], 'سيدي جابر': [29.94, 31.22], 'محرم بك': [29.9, 31.19], 'الإسكندرية': [29.91, 31.2],
    'عين شمس': [31.32, 30.13], 'المرج': [31.34, 30.15], 'بلبيس': [31.56, 30.42], 'أبو حماد': [31.67, 30.48], 'الزقازيق': [31.5, 30.58], 'فاقوس': [31.8, 30.72], 'أبو صوير': [32.1, 30.55], 'التل الكبير': [31.88, 30.54], 'الإسماعيلية': [32.27, 30.6], 'القنطرة غرب': [32.3, 30.8], 'بورسعيد': [32.3, 31.26], 'فايد': [32.3, 30.34], 'الجناين': [32.45, 30.05], 'السويس': [32.54, 29.97],
    'السنطة': [30.96, 30.75], 'المحلة الكبرى': [31.17, 30.97], 'السنبلاوين': [31.47, 30.88], 'ميت غمر': [31.26, 30.72], 'المنصورة': [31.38, 31.04], 'طلخا': [31.37, 31.05], 'فارسكور': [31.72, 31.33], 'كفر سعد': [31.67, 31.35], 'الزرقا': [31.64, 31.33], 'دمياط': [31.82, 31.42], 'قويسنا': [31.15, 30.57], 'بركة السبع': [31.0, 30.63], 'شبين الكوم': [31.0, 30.55], 'أشمون': [30.98, 30.3], 'منوف': [30.94, 30.47], 'كفر الشيخ': [30.94, 31.11], 'بيلا': [30.94, 31.19], 'دسوق': [30.65, 31.13], 'قلين': [30.7, 31.08],
    'طامية': [30.97, 29.48], 'الفيوم': [30.84, 29.31], 'سنورس': [30.87, 29.42], 'الحمام': [29.38, 30.83], 'العلمين': [28.96, 30.83], 'الضبعة': [28.45, 31.0], 'مرسى مطروح': [27.24, 31.35], 'السلوم': [25.16, 31.57], 'سفاجا': [33.94, 26.74] },
  OUT: [[25, 31.6], [27.2, 31.35], [29, 30.9], [31, 31.5], [31.8, 31.5], [32.3, 31.3], [34.2, 31.3], [34.9, 29.5], [34.25, 27.75], [33.2, 28.7], [32.55, 29.95], [32.7, 29.3], [33.1, 28.3], [33.8, 27.3], [34.9, 25.1], [35.5, 23.5], [36.9, 22], [25, 22]],
  COLORS: ['#e8b04a', '#4aa8e8', '#e86a4a', '#7bd36a', '#c58af0', '#4ad1c2', '#f08ab6', '#d9d34a', '#8aa0f0', '#f0a04a', '#6ad39a', '#e84a7a'],
  map() {
    const L = (x, y) => this.L(x, y), P = ([lo, la]) => [((lo - 24.5) * 46).toFixed(1), ((32 - la) * 52).toFixed(1)], sel = this.msel || 'upper';
    const base = (n) => String(n).replace(/\s*\(.*\)/, '').trim();
    const pts = (l) => l.stations.map((s) => this.CITY[base(s[0])]).filter(Boolean).map(P);
    const out = this.OUT.map(P).map((p) => p.join(',')).join(' ');
    const svg = LINES.map((l, i) => { const p = pts(l); if (p.length < 2) return ''; const on = l.id === sel; return `<polyline data-a="l:${l.id}" points="${p.map((q) => q.join(',')).join(' ')}" fill="none" stroke="${this.COLORS[i % 12]}" stroke-width="${on ? 5 : 2.6}" stroke-linecap="round" stroke-linejoin="round" opacity="${on ? 1 : 0.55}"/>`; }).join('');
    const cur = LINES.find((l) => l.id === sel) || LINES[0], cp = pts(cur), dots = cur.stations.map((s) => this.CITY[base(s[0])]).filter(Boolean).map((c, i, all) => { const q = P(c); return `<circle cx="${q[0]}" cy="${q[1]}" r="${i === 0 || i === all.length - 1 ? 4.5 : 2.4}" fill="#fff"/>`; }).join('');
    const names = [cur.stations[0], cur.stations[cur.stations.length - 1]].map((s) => { const c = this.CITY[base(s[0])]; if (!c) return ''; const q = P(c); return `<text x="${+q[0] + 8}" y="${+q[1] + 4}" fill="#fff" font-size="13" font-weight="700">${this.esc(base(s[0]))}</text>`; }).join('');
    this.ui.innerHTML = `<div class="sc">${this.topbar(L('الخريطة', 'Map'), '📍')}
      <div class="mp"><div class="mp-map"><svg viewBox="0 0 580 540" preserveAspectRatio="xMidYMid meet"><polygon points="${out}" fill="#2b3342" stroke="#56627a" stroke-width="2"/>${svg}${dots}${names}</svg><small>${L('خريطة تقريبية للخطوط', 'Schematic map')}</small></div>
      <div class="mp-side"><div class="mp-list">${LINES.map((l, i) => `<button data-a="l:${l.id}" class="${l.id === sel ? 'on' : ''}"><i style="background:${this.COLORS[i % 12]}"></i><span><b>${this.esc(l.name)}</b><small>${l.stations.length} ${L('محطة', 'stations')} · ${l.stations[l.stations.length - 1][1]} ${L('كم', 'km')}</small></span></button>`).join('')}</div>
      <div class="mp-info"><b>${this.esc(cur.name)}</b><div class="mp-st">${cur.stations.map((s) => this.esc(s[0])).join(' ← ')}</div><button class="mbtn primary" data-a="go">${L('العب الخط ده', 'Play this line')}</button></div></div></div></div>`;
    this.wire(this.ui, (a) => { if (a === 'home') return this.show('home'); if (a === 'go') return this.api.setup(false, { line: sel }); if (a.startsWith('l:')) { this.msel = a.slice(2); this.map(); } });
    void cp;
  },

  /* ---------- contests ---------- */
  CONTESTS: [
    { id: 'daily', name: 'ملوك الإيراد اليومي', en: 'Daily earnings kings', icon: '💰', desc: 'أعلى جنيه لعبة كسبتها من الرحلات النهارده', unit: 'جنيه', day: true },
    { id: 'score', name: 'بطولة أفضل رحلة', en: 'Best trip', icon: '🎯', desc: 'أعلى نقاط في رحلة واحدة النهارده', unit: 'نقطة', day: true },
    { id: 'marathon', name: 'ماراثون الأسبوع', en: 'Weekly marathon', icon: '🛤️', desc: 'أكتر كيلومترات قطعتها الأسبوع ده', unit: 'كم', day: false }
  ],
  PRIZES: { top: [300, 200, 100], r10: 50, r25: 25 },
  async compete(arg) {
    const L = (x, y) => this.L(x, y), tab = (arg && arg.tab) || this.ctab || 'now', cid = (arg && arg.cid) || this.ccid || 'daily'; this.ctab = tab; this.ccid = cid;
    this.ui.innerHTML = `<div class="sc cp"><div class="sc-top"><button class="sc-back" data-a="home">→</button><div class="sc-title gold"><span>🏆</span>${L('المسابقات', 'Contests')}</div>
      <div class="cp-tabs"><button data-a="tab:now" class="${tab === 'now' ? 'on' : ''}">${L('الحالية', 'Live')}</button><button data-a="tab:next" class="${tab === 'next' ? 'on' : ''}">${L('اللي جاية', 'Next')}</button><button data-a="tab:res" class="${tab === 'res' ? 'on' : ''}">${L('النتايج', 'Results')}</button></div>
      <div class="sc-coins"><b>${this.fmt((Account.d || {}).coins || 0)}</b><i class="coin"></i></div></div><div class="cp-body"><div class="cp-load">${L('بحمّل المسابقات…', 'Loading…')}</div></div></div>`;
    this.wire(this.ui, (a) => { if (a === 'home') return this.show('home'); if (a.startsWith('tab:')) return this.compete({ tab: a.slice(4), cid }); if (a.startsWith('c:')) return this.compete({ tab, cid: a.slice(2) }); if (a === 'play') this.api.setup(false); });
    const res = await Account.contests(); if (this.scr !== 'compete') return;
    const body = this.ui.querySelector('.cp-body'), meta = this.CONTESTS.find((c) => c.id === cid) || this.CONTESTS[0], srv = res.online ? res.list.find((c) => c.id === cid) : null, st = Stats.load();
    const chips = `<div class="cp-chips">${this.CONTESTS.map((c) => `<button data-a="c:${c.id}" class="${c.id === cid ? 'on' : ''}">${c.icon} ${L(c.name, c.en)}</button>`).join('')}</div>`;
    const mine = cid === 'daily' ? (st.daily.earn || 0) : cid === 'score' ? (st.daily.best || 0) : ((st.wk && st.wk.km) || 0), end = srv ? srv.endsAt : (meta.day ? Math.floor((Date.now() + this.TZ) / 86400000 + 1) * 86400000 - this.TZ : Math.floor((Date.now() + this.TZ) / 86400000 / 7 + 1) * 7 * 86400000 - this.TZ);
    const P = this.PRIZES, top = srv ? srv.top : [], me = srv ? srv.me : null;
    if (tab === 'next') {
      body.innerHTML = chips + `<div class="cp-card"><b>${meta.icon} ${L(meta.name, meta.en)}</b><p>${this.esc(meta.desc)}</p><p>${meta.day ? L('بتبدأ من جديد كل يوم الساعة 12 بالليل بتوقيت القاهرة.', 'Resets every day at midnight Cairo time.') : L('بتبدأ من جديد كل أسبوع.', 'Resets every week.')}</p>${this.prizeHtml()}</div>`;
      this.wire(body, (a) => { if (a.startsWith('c:')) this.compete({ tab, cid: a.slice(2) }); }); return;
    }
    if (tab === 'res') {
      const last = srv && srv.last;
      body.innerHTML = chips + `<div class="cp-card"><b>${L('نتايج المسابقة اللي فاتت', 'Last results')}</b>${last && last.length ? last.map((r, i) => `<div class="cp-row"><i>${i + 1}</i><span>${this.esc(r.n)}</span><b>${this.fmt(r.v)} ${this.esc(meta.unit)}</b></div>`).join('') : `<p>${res.online ? L('لسه مفيش نتايج. أول مسابقة لما تخلص هتظهر هنا.', 'No finished contest yet.') : L('النتايج بتظهر لما تتصل بالإنترنت.', 'Results appear when online.')}</p>`}</div>`;
      this.wire(body, (a) => { if (a.startsWith('c:')) this.compete({ tab, cid: a.slice(2) }); }); return;
    }
    const pod = (i) => top[i] ? `<div class="pod p${i + 1}"><i>${this.esc(top[i].n.slice(0, 1))}</i><b>${this.esc(top[i].n)}</b><small>${this.fmt(top[i].v)} ${this.esc(meta.unit)}</small><u>${i + 1}</u></div>` : `<div class="pod p${i + 1} empty"><i>؟</i><b>—</b><small></small><u>${i + 1}</u></div>`;
    body.innerHTML = chips + `<div class="cp-grid"><div class="cp-left"><div class="cp-card live"><em>${L('مسابقة ' + (meta.day ? 'يومية' : 'أسبوعية') + ' · شغالة دلوقتي', 'Live ' + (meta.day ? 'daily' : 'weekly') + ' contest')}</em><b class="cp-t">${meta.icon} ${L(meta.name, meta.en)}</b><p>${this.esc(meta.desc)}</p><div class="cp-time" dir="ltr"><span id="cpH">00</span>:<span id="cpM">00</span>:<span id="cpS">00</span></div></div>
      <div class="cp-card">${this.prizeHtml()}</div></div>
      <div class="cp-right">${res.online ? `<div class="podium">${pod(1)}${pod(0)}${pod(2)}</div><div class="cp-rows">${top.slice(3).map((r, i) => `<div class="cp-row"><i>${i + 4}</i><span>${this.esc(r.n)}</span><b>${this.fmt(r.v)} ${this.esc(meta.unit)}</b></div>`).join('') || (top.length ? '' : '<p class="dim">' + L('لسه مفيش حد دخل. كون أول واحد!', 'Nobody yet. Be the first!') + '</p>')}</div>` : `<div class="cp-card offline"><b>${L('الترتيب مع اللاعبين التانيين', 'Player ranking')}</b><p>${L('محتاج إنترنت عشان تشوف ترتيب اللاعبين. من غيره بتشوف أرقامك إنت بس.', 'Needs the internet to show the ranking. Until then only your own numbers are shown.')}</p></div>`}</div></div>
      <div class="cp-me"><div><b>${L('انت', 'You')} · ${this.esc((Account.d || {}).name || '')}</b><small>${res.online ? (me ? L('مركزك ' + me.rank + ' من ' + srv.count, 'Rank ' + me.rank + ' of ' + srv.count) : L('لسه مدخلتش. أي رحلة دلوقتي بتتحسب ليك.', 'Not in yet. Any trip now counts.')) : L('أرقامك على الجهاز ده', 'Your numbers on this device')}</small></div><b class="cp-val">${this.fmt(me ? me.v : mine)} ${this.esc(meta.unit)}</b><button class="hb-play wide" data-a="play">▶ ${L('العب دلوقتي', 'Play now')}</button></div>`;
    this.wire(body, (a) => { if (a.startsWith('c:')) this.compete({ tab, cid: a.slice(2) }); else if (a === 'play') this.api.setup(false); });
    this.every(() => { const left = Math.max(0, end - Date.now()), p = (n) => String(n).padStart(2, '0'), h = Math.floor(left / 3600000); const H = this.$('cpH'); if (!H) return; H.textContent = p(h); this.$('cpM').textContent = p(Math.floor(left % 3600000 / 60000)); this.$('cpS').textContent = p(Math.floor(left % 60000 / 1000)); }, 1000);
  },
  prizeHtml() {
    const L = (x, y) => this.L(x, y), P = this.PRIZES;
    return `<div class="cp-prz"><b>${L('الجوايز', 'Prizes')}</b><div class="cp-p3">${P.top.map((v, i) => `<div class="m${i + 1}"><i>${i + 1}</i><b>${v}</b><small>${L('جنيه لعبة', 'coins')}</small></div>`).join('')}</div><div class="cp-row"><span>${L('من المركز 4 لـ 10', 'Ranks 4-10')}</span><b>${P.r10} ${L('لكل واحد', 'each')}</b></div><div class="cp-row"><span>${L('من المركز 11 لـ 25', 'Ranks 11-25')}</span><b>${P.r25} ${L('لكل واحد', 'each')}</b></div></div>`;
  }
};

/* ---------- settings screen (also opened from the pause menu in the game) ---------- */
const SetUI = {
  TABS: [['general', 'عام', 'General', '⚙'], ['play', 'طريقة اللعب', 'Gameplay', '🎮'], ['ctl', 'طريقة التحكم', 'Controls', '🕹'], ['sound', 'الصوت', 'Sound', '🔊'], ['gfx', 'الرسوميات', 'Graphics', '🖥'], ['cam', 'الكاميرا', 'Camera', '📷'], ['ui', 'الواجهة', 'Interface', '▦'], ['credits', 'الحقوق والشروط', 'Rights', '©'], ['reset', 'إعادة تعيين', 'Reset', '↻'], ['acct', 'حسابي', 'My account', '👤']],
  tab: 'general',
  L: (a, e) => Settings.L(a, e),
  open(onClose) {
    this.onClose = onClose; this.close(true);
    const ov = document.createElement('div'); ov.id = 'setOv'; ov.className = 'set-ov'; document.body.appendChild(ov); this.ov = ov; this.render();
  },
  close(silent) { if (this.ov) { this.ov.remove(); this.ov = null; } if (!silent && this.onClose) { const f = this.onClose; this.onClose = null; f(); } },
  esc: (s) => Menu.esc(s),
  render() {
    const o = this.ov; if (!o) return; const keep = o.querySelector('.set-main'), sy = keep ? keep.scrollTop : 0, a = Account.d || { coins: 0 };
    o.innerHTML = `<div class="set"><div class="sc-top"><button class="sc-back" data-a="close">→</button><div class="sc-title"><span>⚙</span>${this.L('الإعدادات', 'Settings')}</div><div class="sc-coins"><b>${Hub.fmt(a.coins || 0)}</b><i class="coin"></i></div></div>
      <div class="set-body"><nav class="set-nav">${this.TABS.map(([k, ar, en, ic]) => `<button data-a="tab:${k}" class="${k === this.tab ? 'on' : ''}"><i>${ic}</i>${this.L(ar, en)}</button>`).join('')}</nav><div class="set-main" id="setMain"></div></div></div>`;
    o.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => { const a2 = b.dataset.a; if (a2 === 'close') this.close(); else if (a2.startsWith('tab:')) { this.tab = a2.slice(4); this.render(); } }; });
    const m = o.querySelector('#setMain'); this['t_' + this.tab](m); m.scrollTop = sy;
  },

  /* small builders */
  card(m, title, icon) { const c = Menu.el('div', 'set-card'); c.innerHTML = `<h3><span>${icon || ''}</span>${this.esc(title)}</h3>`; m.appendChild(c); return c; },
  toggle(c, key, label, desc, after) {
    const r = Menu.el('label', 'set-row'); r.innerHTML = `<span><b>${this.esc(label)}</b>${desc ? '<small>' + this.esc(desc) + '</small>' : ''}</span><input type="checkbox" class="sw-in"><i class="sw"></i>`;
    const i = r.querySelector('input'); i.checked = !!Settings.d[key]; i.onchange = () => { Settings.set(key, i.checked); if (after) after(i.checked); }; c.appendChild(r); return r;
  },
  slider(c, key, label, min, max, step, fmt, after) {
    const r = Menu.el('div', 'set-row sl'); r.innerHTML = `<span><b>${this.esc(label)}</b></span><input type="range" min="${min}" max="${max}" step="${step}"><em></em>`;
    const i = r.querySelector('input'), e = r.querySelector('em'); i.value = Settings.d[key]; e.textContent = fmt(+i.value);
    i.oninput = () => { e.textContent = fmt(+i.value); Settings.d[key] = +i.value; Settings.apply(); if (after) after(+i.value); }; i.onchange = () => Settings.save(); c.appendChild(r); return r;
  },
  seg(c, items, cur, on) {
    const g = Menu.el('div', 'set-seg'); for (const [v, label, icon, sub] of items) { const b = Menu.el('button', v === cur ? 'on' : '', `<i>${icon || ''}</i><b>${this.esc(label)}</b>${sub ? '<small>' + this.esc(sub) + '</small>' : ''}`); b.type = 'button'; b.onclick = () => on(v); g.appendChild(b); }
    c.appendChild(g); return g;
  },
  note(c, t) { c.appendChild(Menu.el('p', 'set-note', this.esc(t))); },
  btn(c, label, fn, cls) { const b = Menu.el('button', 'mbtn ' + (cls || ''), this.esc(label)); b.type = 'button'; b.onclick = () => fn(b); c.appendChild(b); return b; },
  field(c, label, value, ph, btnLabel, fn, opts) {
    const w = Menu.el('div', 'set-field'); w.innerHTML = `<label>${this.esc(label)}</label><div><input ${opts && opts.ltr ? 'dir="ltr"' : ''} maxlength="${(opts && opts.max) || 60}" placeholder="${this.esc(ph || '')}" value="${this.esc(value || '')}"><button type="button" class="mbtn">${this.esc(btnLabel)}</button></div><small class="msg"></small>`;
    const i = w.querySelector('input'), b = w.querySelector('button'), msg = w.querySelector('.msg'); b.onclick = async () => { b.disabled = true; const r = await fn(i.value.trim(), i); b.disabled = false; msg.textContent = r || ''; }; c.appendChild(w); return w;
  },

  t_general(m) {
    const L = (a, e) => this.L(a, e), c = this.card(m, L('اللغة / Language', 'Language'), '🌐');
    this.seg(c, [['ar', 'العربية', '文A'], ['en', 'English', '🌐'], ['auto', L('زي الموبايل', 'Like phone'), '📱']], Settings.d.lang, (v) => { Settings.set('lang', v); this.render(); });
    this.note(c, L('اللغة بتغيّر القوايم والإعدادات. أسماء المحطات والتعليق الصوتي بيفضلوا بالعربي.', 'Language changes the menus and settings. Station names and announcements stay Arabic.'));
    const g = this.card(m, L('عندك كود هدية؟', 'Gift code?'), '🎁');
    this.field(g, '', '', L('اكتب الكود', 'Enter code'), L('استخدم الكود', 'Redeem'), async (v) => {
      if (!v) return ''; const r = await Account.gift(v); if (r.ok) { if (!Hub.root.hidden) Hub.show(Hub.scr); this.render(); return L('تم! اتضاف ' + r.coins + ' جنيه لعبة', 'Added ' + r.coins + ' coins'); }
      return { invalid: L('الكود غلط أو خلص', 'Invalid code'), used: L('انت استخدمت الكود ده قبل كده', 'Already used'), noserver: L('الأكواد محتاجة إنترنت', 'Codes need the internet'), offline: L('مفيش اتصال بالإنترنت', 'No connection') }[r.why];
    }, { ltr: true, max: 24 });
    const f = this.card(m, L('بلّغ عن مشكلة أو اقترح', 'Report a problem or suggest'), '💬'), pay = window.QS_PAY || {}, num = String(pay.vodafone || '').replace(/^0/, '20');
    this.btn(f, L('ابعتلنا', 'Message us'), () => { window.open('https://wa.me/' + num + '?text=' + encodeURIComponent('قطارات مصر - ' + ((Account.d && Account.d.id) || '')), '_blank'); }, 'primary');
    const info = Menu.el('p', 'set-note', L('آخر تحديث للعبة: ', 'Game version: ') + (window.QS_BUILD || '2026/11/12')); f.appendChild(info);
  },
  t_play(m) {
    const L = (a, e) => this.L(a, e), c = this.card(m, L('طريقة اللعب', 'Gameplay'), '🎮');
    this.seg(c, [[2, L('سكتين', '2 tracks'), '', ''], [3, L('٣ سكك', '3 tracks'), '', ''], [4, L('٤ سكك', '4 tracks'), '', '']], Settings.d.tracks, (v) => Settings.set('tracks', +v));
    this.note(c, L('عدد السكك بيتطبق من الرحلة الجاية.', 'Applies from the next trip.'));
    this.toggle(c, 'route', L('إظهار خط السير', 'Show the route strip'), L('شريط المحطات الجاية فوق', 'The next stations bar'));
    this.toggle(c, 'limits', L('حدود السرعة', 'Speed limits'), L('علامة الحد والحد الجاي', 'The limit sign and next limit'));
    this.toggle(c, 'notif', L('إشعارات اللعبة', 'Game notifications'), L('رسايل الوصول والتنبيهات. الأخطاء بتظهر دايمًا', 'Arrival and tip messages. Errors always show'));
    this.toggle(c, 'atc', L('ATC حماية السرعة والإشارة', 'ATC speed & signal protection'), L('بيفرمل لوحده لو عديت الحد أو الإشارة', 'Brakes by itself over the limit or at a red signal'));
    this.toggle(c, 'cine', L('لقطات سينما تلقائية', 'Automatic cinematic cameras'), L('الكاميرا بتتغير لوحدها وانت ماشي', 'The camera changes by itself'));
    const r = this.toggle(c, 'comm', L('التعليق الصوتي وإعلانات المحطات', 'Commentary and announcements'), ''); const i = r.querySelector('input'); i.checked = Commentary.on; i.onchange = () => { if (Commentary.on !== i.checked) Commentary.toggle(); };
  },
  t_ctl(m) {
    const L = (a, e) => this.L(a, e), c = this.card(m, L('طريقة التحكم', 'Controls'), '🕹');
    this.seg(c, [['lever', L('ذراع القوة', 'Power lever'), '🎚'], ['buttons', L('أزرار', 'Buttons'), '➕'], ['tilt', L('إمالة الجهاز', 'Tilt phone'), '📱']], Settings.d.ctl, (v) => { Settings.set('ctl', v); this.render(); });
    this.note(c, { lever: L('اسحب الذراع على يمين الشاشة لفوق عشان تزود القوة ولتحت عشان تقللها. والفرامل والكلاكس زراير.', 'Drag the lever up for power and down to reduce.'), buttons: L('زرين + و − على جنب الشاشة بيزودوا ويقللوا القوة.', 'Two + and − buttons raise and lower the power.'), tilt: L('مِيّل الموبايل لقدام عشان تزود القوة ولورا عشان تقللها. ولو اتعكس، فعّل «اعكس الاتجاه».', 'Tilt the phone forward for power and back to reduce. Use Invert if it feels backwards.') }[Settings.d.ctl]);
    this.slider(c, 'sens', L('حساسية التحكم', 'Sensitivity'), 0.5, 2, 0.1, (v) => v.toFixed(1));
    this.toggle(c, 'invert', L('اعكس الاتجاه (لو العربية بتلف عكس صباعك)', 'Invert direction'), '');
  },
  t_sound(m) {
    const L = (a, e) => this.L(a, e), c = this.card(m, L('الصوت', 'Sound'), '🔊'), pc = (v) => Math.round(v * 100) + '%';
    this.slider(c, 'vMaster', L('الصوت العام', 'Master volume'), 0, 1, 0.05, pc);
    this.slider(c, 'vEngine', L('صوت المحرك', 'Engine'), 0, 1, 0.05, pc);
    this.slider(c, 'vVoice', L('التعليق وإعلانات المحطات', 'Commentary & announcements'), 0, 1, 0.05, pc);
    this.btn(c, L('جرّب صوت الإعلان', 'Test voice'), (b) => { const ok = Sound.testVoice(); this.note(c, ok ? L('لو سمعت صوت، الكلام شغال.', 'If you hear a voice it works.') : L('جهازك مفيهوش صوت عربي: هتسمع جرس المحطة والكلام هيظهر مكتوب. نزّل «Speech Services by Google» واللغة العربية من إعدادات الجهاز. تطبيقات الـAPK ساعات بتمنع الصوت.', 'No Arabic voice on this device: only the chime and captions.')); });
  },
  t_gfx(m) {
    const L = (a, e) => this.L(a, e), c = this.card(m, L('الرسوميات', 'Graphics'), '🖥'), names = [L('واطية', 'Low'), L('متوسطة', 'Medium'), L('عالية', 'High'), L('فائقة', 'Ultra')];
    const sub = [L('من غير ظل ولا مراية', 'No shadows or reflections'), L('ظل خفيف ومراية', 'Light shadows'), L('ظل ومراية ونعومة', 'Shadows & reflections'), L('كله وأبعد رؤية', 'Everything, far view')];
    this.seg(c, [['low', names[0], '▫', sub[0]], ['medium', names[1], '◽', sub[1]], ['high', names[2], '◼', sub[2]], ['ultra', names[3], '★', sub[3]]], Settings.d.gfx, (v) => { Settings.setPreset(v); this.render(); });
    const lv = (v) => names[v];
    for (const [k, ar, en] of [['detail', 'دقة التفاصيل', 'Detail'], ['shadows', 'ظلال', 'Shadows'], ['reflect', 'المراية', 'Reflections'], ['view', 'مدى الرؤية', 'View distance']]) this.slider(c, k, L(ar, en), 0, 3, 1, lv, () => { Settings.d.gfx = 'custom'; });
    this.note(c, L('الواطية بترسم بدقة أقل ومن غير ظلال ولا مراية، والمتوسطة دقة أقل شوية. للموبايلات الضعيفة. التغيير بيشتغل لما تبدأ رحلة جديدة.', 'Low draws less detail without shadows. Changes apply when you start a new trip.'));
    this.toggle(c, 'autoDN', L('النهار والليل حسب ساعة الجهاز 🌇', 'Day and night follow the device clock'), L('الصبح والضهر والغروب والليل بيتحددوا من الساعة', ''));
    this.toggle(c, 'weather', L('الجو: تراب في الصعيد ومطر خفيف 🌦', 'Weather: dust in the south, light rain'), '');
  },
  t_cam(m) {
    const L = (a, e) => this.L(a, e), c = this.card(m, L('الكاميرا', 'Camera'), '📷');
    this.seg(c, CAMERAS.map((x, i) => [i, x[1], ['🚂', '🎥', '🛰', '👁', '🚉'][i]]), Settings.d.cam, (v) => { Settings.set('cam', v); this.render(); });
    this.slider(c, 'fov', L('زاوية الرؤية', 'Field of view'), 0.8, 1.25, 0.05, (v) => Math.round(v * 100) + '%');
    this.toggle(c, 'shake', L('اهتزاز الكابينة', 'Cab shake'), L('اهتزاز خفيف مع السرعة', ''));
  },
  t_ui(m) {
    const L = (a, e) => this.L(a, e), c = this.card(m, L('الواجهة', 'Interface'), '▦');
    this.slider(c, 'uiScale', L('حجم الأزرار', 'Button size'), 0.7, 1.4, 0.02, (v) => Math.round(v * 100) + '%');
    this.slider(c, 'uiAlpha', L('شفافية الواجهة', 'Interface opacity'), 0.3, 1, 0.05, (v) => Math.round(v * 100) + '%');
    this.note(c, L('جوه اللعبة: زرار «واجهة» بيخفي ويظهر لوحة القيادة.', 'In the game the "HUD" button hides the dashboard.'));
  },
  t_credits(m) {
    const L = (a, e) => this.L(a, e), row = (c, a, b) => c.appendChild(Menu.el('div', 'set-row', `<span><b>${a}</b>${b ? `<small>${b}</small>` : ''}</span>`));
    let c = this.card(m, L('حقوق النشر والطباعة', 'Copyright'), '©');
    row(c, 'لعبة قطارات مصر', 'إعداد يوسف فرج، ومساعدة يوسف خربوش.');
    row(c, 'حقوق النشر والطباعة محفوظة', 'حقوق النشر والطباعة ملك ليوسف فرج ويوسف خربوش. © ٢٠٢٦ جميع الحقوق محفوظة.');
    c = this.card(m, L('ممنوع', 'Not allowed'), '⛔');
    for (const t of ['نسخ اللعبة أو أي جزء منها (الكود أو الرسومات أو الأصوات أو النصوص).', 'إعادة نشرها أو رفعها على أي موقع أو متجر تطبيقات باسم غير اسم أصحابها.', 'تعديلها أو فك تغليفها أو استخراج ملفاتها وبيعها أو إعادة استخدامها.', 'بيع حسابات اللاعبين أو العملات أو التلاعب بالرصيد أو الغش بأي طريقة.', 'الطباعة أو التصوير لأغراض تجارية من غير إذن مكتوب.']) row(c, '✖ ' + t, '');
    row(c, 'المخالفة', 'أي نسخ أو استغلال من غير إذن بيعرّض صاحبه للمساءلة القانونية، وبنحتفظ بحقنا في إيقاف أي حساب مخالف.');
    c = this.card(m, L('شروط الاستخدام', 'Terms'), '📜');
    row(c, 'اللعبة للتسلية', 'اللعبة محاكاة ترفيهية. أسماء المحطات والمسافات والمواعيد تقريبية وليست جدول السكك الحديدية الرسمي.');
    row(c, 'العملات داخل اللعبة', '«الجنيه» عملة تتكسب باللعب. «الماسة» عملة للشحن فقط ولا تتكسب باللعب، وهي افتراضية ولا يمكن تحويلها لنقود ولا استرجاعها بعد الشراء.');
    row(c, 'الشحن', 'الشحن يدوي: بتحوّل المبلغ على فودافون كاش ' + ((window.QS_PAY && QS_PAY.vodafone) || '01093706503') + ' وتبعت الـ ID بتاعك، وبنضيف الرصيد لحسابك.');
    row(c, 'اللعب النظيف', 'ممنوع الشتم أو الأسماء المسيئة في اللعب الأونلاين. لو حد ضايقك بلّغنا.');
    c = this.card(m, L('الخصوصية', 'Privacy'), '🔒');
    row(c, 'اللي بنحفظه', 'اسمك المستعار والـ ID ورصيدك ومشترياتك ونتايج المسابقات. مبنطلبش إيميل ولا رقم موبايل ولا موقعك.');
    row(c, 'التواصل', 'رقم التواصل اللي بتكتبه في حسابك اختياري، ومبيظهرش لأي لاعب.');
    c = this.card(m, L('شكر ومصادر', 'Credits'), 'ℹ');
    for (const [a, b] of [['القطارات والمحطات والعربيات والناس والمباني', 'مرسومة بالكود جوه اللعبة نفسها'], ['مكتبة الرسم ثلاثي الأبعاد', 'Three.js (MIT)'], ['الخطوط', 'Reem Kufi · Tajawal (OFL)'], ['الأصوات', 'مولّدة بالكود'], ['اللعبة مستوحاة من', 'السكك الحديدية المصرية — مع احترام كل ملاك العلامات المذكورة']]) row(c, a, b);
  },
  t_reset(m) {
    const L = (a, e) => this.L(a, e), c = this.card(m, L('إعادة تعيين', 'Reset'), '↻');
    this.btn(c, L('رجّع الإعدادات للأصل', 'Reset settings'), () => { Settings.reset(); this.render(); });
    this.note(c, L('بترجّع الرسوميات والصوت والتحكم والواجهة. مبتمسحش حسابك ولا فلوسك.', 'Resets graphics, sound, controls, interface. Your account and coins stay.'));
    const d = this.card(m, L('مسح بيانات الجهاز', 'Erase this device'), '⚠');
    this.btn(d, L('امسح الحساب والتقدم من الجهاز ده', 'Erase account and progress here'), (b) => { if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = L('متأكد؟ دوس تاني للمسح', 'Sure? press again'); return; } try { localStorage.clear(); } catch (e) { /* */ } location.reload(); }, 'danger');
    this.note(d, L('لو الحساب على السيرفر تقدر ترجعه بكود الاسترجاع. الحساب المحلي بيضيع.', 'A server account can be restored with its recovery code. A local one is lost.'));
  },
  t_acct(m) {
    const L = (a, e) => this.L(a, e), a = Account.d; if (!a) { this.card(m, L('حسابي', 'My account'), '👤'); return; }
    if (!a.rec) { a.rec = Account.makeRec(); Account.save(); }
    const c = this.card(m, L('حسابي', 'My account'), '👤'), code = (lab, v, sub) => { const r = Menu.el('div', 'set-code'); r.innerHTML = `<label>${this.esc(lab)}</label><div><b dir="ltr">${this.esc(v)}</b><button type="button" class="mbtn gold">${L('انسخ', 'Copy')}</button></div>${sub ? '<small>' + this.esc(sub) + '</small>' : ''}`; r.querySelector('button').onclick = (ev) => { Menu.copy(v); ev.target.textContent = '✔'; setTimeout(() => { ev.target.textContent = L('انسخ', 'Copy'); }, 1200); }; c.appendChild(r); };
    code(L('كودك (ID)', 'Your ID'), a.id); code(L('كود استرجاع الحساب', 'Account recovery code'), a.rec, L('احتفظ بيه في مكان أمين. لو غيّرت موبايلك اكتبه تحت في الموبايل الجديد وفلوسك ومستواك ومشترياتك هيرجعوا.', 'Keep it safe. On a new phone enter it below to get your coins and progress back.'));
    if (!Account.server) this.note(c, L('الحساب ده على جهازك بس لأن مفيش إنترنت دلوقتي. الاسترجاع والشحن والمسابقات بتشتغل لما تتصل بالإنترنت وتفتح اللعبة تاني.', 'This account is on this device only (no connection). Recovery, top-up and contests need the internet.'));
    this.field(c, L('إيميل أو رقم موبايل (اختياري)', 'Email or phone (optional)'), a.contact || '', L('01xxxxxxxxx أو إيميل', '01xxxxxxxxx or email'), L('احفظ', 'Save'), async (v) => { return (await Account.setContact(v)) ? L('اتحفظ', 'Saved') : L('مفيش اتصال بالإنترنت', 'No connection'); }, { ltr: true });
    this.note(c, L('بس عشان لو اللعبة اتمسحت نرجّع حسابك. محدش بيشوفه.', 'Only so we can help restore your account.'));
    this.field(c, L('معاك كود من موبايل تاني؟', 'Code from another phone?'), '', L('كود الاسترجاع', 'Recovery code'), L('رجّع بالكود', 'Restore'), async (v) => {
      if (!v) return ''; const r = await Account.recover(v); if (r === 'ok') { this.render(); Hub.show(Hub.scr || 'home'); return L('اتسترجع الحساب', 'Restored'); }
      return { wrong: L('الكود غلط', 'Wrong code'), offline: L('مفيش اتصال بالإنترنت', 'No connection'), noserver: L('الاسترجاع محتاج إنترنت', 'Needs an internet connection') }[r];
    }, { ltr: true, max: 14 });
    const pay = window.QS_PAY || {}, num = String(pay.vodafone || '').replace(/^0/, '20');
    this.btn(c, L('رجّع حسابك بالإيميل أو الرقم', 'Restore by email or phone'), () => { window.open('https://wa.me/' + num + '?text=' + encodeURIComponent('عايز أرجّع حسابي في قطارات مصر. الاسم: ' + a.name + ' ، الـID القديم: '), '_blank'); });
    this.field(c, L('اسمك', 'Your name'), a.name, L('اسمك', 'Name'), L('حفظ', 'Save'), async (v) => { if (!v) return ''; await Account.rename(v); Hub.show(Hub.scr || 'home'); this.render(); return L('اتحفظ', 'Saved'); }, { max: 16 });
  }
};
