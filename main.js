'use strict';
/* Boot, render loop, cameras and glue between the game logic, the 3D world, sound and the HUD. */
(function () {
  const ui = new UI();
  let renderer, scene, camera, track, route, sky, world, stations, train, game, type, line, crowd, net = null, online = false;
  let started = false, paused = false, camIdx = 0, last = 0, sideS = -1e9, lastBoard = -1, baseFov = 62;
  const cam = { yaw: 0, pitch: 0, zoom: 1 };
  const occRay = new THREE.Raycaster(), occDir = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), tgt = new THREE.Vector3(), want = new THREE.Vector3(), eq = new THREE.Quaternion(), oq = new THREE.Quaternion(), eu = new THREE.Euler(0, 0, 0, 'YXZ');

  /* Wallet: game coins and the trains bought with them, kept in localStorage (so it can be edited by the player; real payments would need a server). */
  const START_COINS = 50;
  const wallet = {
    d: null,
    load() { if (this.d) return this.d; try { const v = JSON.parse(localStorage.getItem('qs-wallet') || 'null'); if (v && typeof v.coins === 'number') this.d = v; } catch (err) { /* no storage */ } if (!this.d) this.d = { coins: START_COINS, owned: [] }; return this.d; },
    save() { try { localStorage.setItem('qs-wallet', JSON.stringify(this.d)); } catch (err) { /* no storage */ } },
    owns(t) { return !t.price || this.load().owned.includes(t.id); },
    buy(t) { const w = this.load(); if (this.owns(t)) return true; if (w.coins < t.price) return false; w.coins -= t.price; w.owned.push(t.id); this.save(); return true; },
    add(n) { const w = this.load(); w.coins += n; this.save(); }
  };
  function refreshMenu() {
    const e = ui.el, x = TRAIN_TYPES.find((y) => y.id === e.optTrain.value), w = wallet.load();
    [...e.optTrain.options].forEach((o) => { const t = TRAIN_TYPES.find((y) => y.id === o.value); o.textContent = t.name + (wallet.owns(t) ? '' : ' 🔒 ' + t.price + ' ج'); });
    e.trainDesc.textContent = `${x.desc} السرعة القصوى ${x.vmax} كم/س. رصيدك: ${w.coins} جنيه لعبة.` + (wallet.owns(x) ? '' : ` القطر ده مقفول، سعره ${x.price} جنيه لعبة.`);
    e.startBtn.textContent = wallet.owns(x) ? 'ابدأ الرحلة' : `افتح القطر بـ ${x.price} جنيه لعبة` + (w.coins < x.price ? ' (رصيدك مش كفاية)' : '');
  }

  async function boot() {
    const t = (id) => document.getElementById(id);
    if (!window.THREE) { t('loadMsg').textContent = 'تعذر تحميل مكتبة Three.js. اتأكد من الاتصال أو حط الملف في vendor/three.min.js'; return; }
    try { await Promise.race([Promise.all([document.fonts.load('700 40px "Reem Kufi"'), document.fonts.load('500 20px Tajawal')]), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* fonts are optional */ }
    const e = ui.el;
    e.optLine.innerHTML = LINES.map((l) => `<option value="${l.id}">${l.name} (${l.stations.length} محطة)</option>`).join('');
    e.optTrain.innerHTML = TRAIN_TYPES.map((x) => `<option value="${x.id}">${x.name}</option>`).join('');
    const showDesc = () => refreshMenu();
    const netToggle = () => document.querySelectorAll('.net-only').forEach((el) => { el.hidden = e.optOnline.value !== '1'; });
    e.optOnline.addEventListener('change', netToggle);
    try { const sv = JSON.parse(localStorage.getItem('qs-opts') || '{}'); if (sv.online) e.optOnline.value = sv.online; if (sv.name) e.optName.value = sv.name; e.optServer.value = sv.server || window.QS_SERVER || ''; } catch (err) { e.optServer.value = window.QS_SERVER || ''; }
    netToggle();
    e.optTrain.addEventListener('change', showDesc);
    try { const s = JSON.parse(localStorage.getItem('qs-opts') || '{}'); for (const [k, el] of [['time', e.optTime], ['q', e.optQuality], ['line', e.optLine], ['train', e.optTrain]]) if (s[k] && [...el.options].some((o) => o.value === s[k])) el.value = s[k]; } catch (err) { /* no storage */ }
    showDesc();
    t('loading').hidden = true; t('menu').hidden = false;
    ui.on({
      start: startGame, restart: restart, camera: (i) => cycleCamera(i), resetCam: () => resetCam(), pause: togglePause, autoPause: () => { if (started && !paused) togglePause(); },
      mute: () => { Sound.setMuted(!Sound.muted); ui.setMuteLabel(Sound.muted); },
      horn: (on) => { Sound.horn(on); if (on && net && net.on) net.horn(); }
    });
  }

  async function startGame() {
    const e = ui.el, quality = e.optQuality.value, time = e.optTime.value;
    line = LINES.find((l) => l.id === e.optLine.value); type = TRAIN_TYPES.find((x) => x.id === e.optTrain.value);
    const wantOnline = e.optOnline.value === '1', srv = (e.optServer.value || window.QS_SERVER || '').trim(), pname = (e.optName.value || '').trim() || 'سواق';
    online = wantOnline && !!srv;
    try { localStorage.setItem('qs-opts', JSON.stringify({ time, q: quality, line: line.id, train: type.id, online: e.optOnline.value, name: pname, server: e.optServer.value })); } catch (err) { /* no storage */ }
    if (!wallet.owns(type)) { if (wallet.buy(type)) { refreshMenu(); } else refreshMenu(); return; }   // a locked train: the first press unlocks it with coins, a second press starts
    Sound.setProfile(type.snd); Sound.init();
    e.menu.hidden = true; e.loading.hidden = false; U.setProgress(0.02, 'جاري تجهيز السكة…');
    await U.tick();

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: quality !== 'low', powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = quality !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.25, 20000);
    window.addEventListener('resize', onResize); bindPointer(renderer.domElement);

    route = new Route(line, online ? Math.max(ONLINE_REF_LEN, Train.lengthOf(type)) : Train.lengthOf(type));   // online: everyone builds the same track
    track = new Track(route.Ltarget); route.bind(track);
    sky = new Sky(renderer, scene); sky.setShadowQuality(quality); sky.apply(time);
    track.buildMeshes(scene, quality); await U.tick();
    world = new World(scene, track, sky, quality, route); await world.build();
    U.setProgress(0.9, 'المحطات والقطر…'); await U.tick();
    stations = new Stations(scene, track, quality, route, type.vmax, type.brake); stations.build();
    train = new Train(scene, track, quality, type);
    crowd = new Crowd(scene, track, quality, stations, train.length); crowd.prepare(0);
    train.setHeadlights(time === 'sunset' || time === 'night' || time === 'overcast'); train.setNight(time === 'night'); stations.setNight(time === 'night');
    const phys = { mass: (type.locoMass + type.vehMass * type.consist.length) * 1000, fmax: type.fmax * 1000, power: type.power * 1e6, brake: type.brake, vmax: type.vmax, tolerance: type.id.startsWith('cargo') || type.id === 'freight' ? 18 : 25 };
    game = new Game(track.L, stations.list, (s) => stations.limitAt(s), phys);
    stations.list.forEach((_, i) => stations.setSignal(i, i === 0));
    let netNote = wantOnline && !srv ? 'اكتب عنوان السيرفر في القايمة علشان تلعب أونلاين. هلعب لوحدي دلوقتي' : '';
    if (online) {
      U.setProgress(0.95, 'بتتصل بالسيرفر…'); net = new Online(scene, track, game); net.onEvent = onNet;
      if (!(await net.connect(srv, { name: pname, line: line.id, type: type.id }))) { net.close(); net = null; netNote = 'مقدرتش أتصل بالسيرفر. هلعب لوحدي'; }
      else netNote = 'اتصلت بالسيرفر. القطارات التانية على نفس الخط هتظهر قدامك';
    }
    renderer.compile(scene, camera);
    U.setProgress(1, 'جاهز');
    e.loading.hidden = true; e.hud.hidden = false; started = true;
    applyCamera(0); ui.setMuteLabel(Sound.muted);
    if (netNote) setTimeout(() => ui.toast(netNote, net ? 'good' : 'bad', 4500), 6200);
    ui.toast('اضغط W علشان تزود القوة، وابدأ الفرملة قبل علامة «قف» بـ 300 م', '', 5600);
    window.__game = { game, track, train, stations, world, sky, renderer, scene, camera, route };
    last = performance.now(); requestAnimationFrame(frame);
  }

  function restart() {
    ui.el.result.hidden = true; game.reset(); ui.input.notch = 0; ui.input.brakeHeld = false; ui.input.emergency = false;
    stations.list.forEach((st, i) => stations.setSignal(i, i === 0)); crowd.cur = -1; crowd.hideAll(); crowd.prepare(0);
    train.setDoors(0); sideS = -1e9; ui.last = {};
    ui.toast('رحلة جديدة. بالتوفيق!', '', 3000);
  }

  function onResize() { renderer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); }
  function togglePause() { paused = !paused; ui.el.pause.hidden = !paused; if (Sound.ctx) { paused ? Sound.ctx.suspend() : Sound.ctx.resume(); } last = performance.now(); }

  /* Cameras: drag to look around or orbit, wheel / pinch to zoom, V to reset. */
  function bindPointer(el) {
    const ptr = new Map(); let pinch = 0;
    el.addEventListener('pointerdown', (ev) => { ptr.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); el.setPointerCapture(ev.pointerId); pinch = 0; });
    el.addEventListener('pointermove', (ev) => {
      const p = ptr.get(ev.pointerId); if (!p) return;
      const dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
      if (ptr.size === 2) {
        const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) cam.zoom = U.clamp(cam.zoom * (pinch / d), 0.4, 3); pinch = d; return;
      }
      const k = CAMERAS[camIdx][0];
      if (k === 'cab' || k === 'side') { cam.yaw = U.clamp(cam.yaw + dx * 0.005, -2.4, 2.4); cam.pitch = U.clamp(cam.pitch + dy * 0.004, -0.9, 0.9); }
      else { cam.yaw -= dx * 0.005; cam.pitch = U.clamp(cam.pitch + dy * 0.004, -0.1, 1.45); }
    });
    for (const t of ['pointerup', 'pointercancel']) el.addEventListener(t, (ev) => { ptr.delete(ev.pointerId); pinch = 0; });
    el.addEventListener('wheel', (ev) => { ev.preventDefault(); cam.zoom = U.clamp(cam.zoom * Math.exp(ev.deltaY * 0.0012), 0.4, 3); }, { passive: false });
    el.addEventListener('dblclick', resetCam);
  }

  const DEFAULT = { cab: [0, 0], chase: [0, 0.3], top: [0, 1.15], front: [0.15, 0.12], side: [0, 0] };
  function resetCam() { const d = DEFAULT[CAMERAS[camIdx][0]]; cam.yaw = d[0]; cam.pitch = d[1]; cam.zoom = 1; }
  function cycleCamera(i) { applyCamera(typeof i === 'number' ? i : (camIdx + 1) % CAMERAS.length); }
  function applyCamera(i) {
    camIdx = U.clamp(i, 0, CAMERAS.length - 1); const k = CAMERAS[camIdx][0];
    train.setCabView(k === 'cab'); ui.setCamLabel(CAMERAS[camIdx][1]); baseFov = k === 'cab' ? 70 : 60; resetCam(); sideS = -1e9;
  }

  function orbit(dist, headingOffset, dt, height) {
    const body = train.loco.body; body.getWorldPosition(tgt); tgt.y += height;
    body.getWorldDirection(v3); const psi = Math.atan2(v3.x, v3.z), a = psi + headingOffset + cam.yaw, p = cam.pitch, d = dist * cam.zoom;
    want.set(tgt.x + Math.sin(a) * Math.cos(p) * d, tgt.y + Math.sin(p) * d + 1.2, tgt.z + Math.cos(a) * Math.cos(p) * d);
    if (want.y < 1.0) want.y = 1.0;
    // keep the camera in front of roofs, canopies and the footbridge when the train is in a station
    for (const st of stations.list) {
      const f = st.fr; if (!f || !st.occ.length) continue; const dx = tgt.x - f.pos.x, dz = tgt.z - f.pos.z;
      if (Math.abs(dx * f.fwd.x + dz * f.fwd.z) > st.pl / 2 + 120 || Math.abs(dx * f.right.x + dz * f.right.z) > 120) continue;
      occDir.copy(want).sub(tgt); const dd = occDir.length(); if (dd < 0.01) break; occDir.multiplyScalar(1 / dd);
      occRay.set(tgt, occDir); occRay.far = dd; const hit = occRay.intersectObjects(st.occ, false);
      if (hit.length) { const k = Math.max(3, hit[0].distance - 0.7); want.copy(tgt).addScaledVector(occDir, k); }
      break;
    }
    camera.position.lerp(want, 1 - Math.exp(-12 * dt)); if (camera.position.distanceTo(want) > 40) camera.position.copy(want);
    camera.lookAt(tgt);
  }

  function updateCamera(dt) {
    const k = CAMERAS[camIdx][0], body = train.loco.body; body.updateMatrixWorld(true);
    camera.fov = baseFov; const f = Math.min(1, game.v / 25);
    if (k === 'cab') {
      train.eye.getWorldPosition(camera.position); train.eye.getWorldQuaternion(camera.quaternion);
      camera.position.y += Math.sin(game.t * 17) * 0.004 * f + Math.sin(game.t * 5.3) * 0.006 * f; camera.position.x += Math.sin(game.t * 3.1) * 0.004 * f;
      if (game.derailed) { const q = Math.min(1, game.derailT) * 0.12 * Math.max(0, 1 - game.derailT / 4); camera.position.x += (Math.random() - 0.5) * q; camera.position.y += (Math.random() - 0.5) * q; camera.rotateZ(Math.min(1, game.derailT / 1.5) * 0.5); }
      eq.setFromEuler(eu.set(cam.pitch, cam.yaw + Math.PI * 0, 0, 'YXZ')); camera.quaternion.multiply(eq); camera.fov = U.clamp(baseFov / cam.zoom, 28, 100);
    } else if (k === 'front') { orbit(20, 0, dt, 2.2); }
    else if (k === 'chase') { orbit(42, Math.PI, dt, 2.6); }
    else if (k === 'top') { orbit(60, Math.PI, dt, 1.0); }
    else {
      const d = ((sideS - game.s) % track.L + track.L) % track.L;
      if (sideS < -1e8 || d > track.L / 2) sideS = game.s + 90 + game.v * 4;
      track.at(sideS, -11, 2.1, camera.position); body.getWorldPosition(tgt); tgt.y += 2.2;
      camera.lookAt(tgt); camera.fov = U.clamp(baseFov / cam.zoom, 20, 90);
      camera.rotateY(cam.yaw * 0.3); camera.rotateX(-cam.pitch * 0.3);
    }
    camera.updateProjectionMatrix();
    sky.update(camera, body.getWorldPosition(v4), game.t);
  }

  function onNet(ev) {
    if (ev.type === 'join') ui.toast(ev.name + ' دخل على الخط', 'good', 2500);
    else if (ev.type === 'leave') ui.toast(ev.name + ' خرج من اللعبة', '', 2500);
    else if (ev.type === 'full') ui.toast('الغرفة مليانة. جرّب خط تاني', 'bad', 3500);
    else if (ev.type === 'disconnected') { ui.toast('اتقطع الاتصال بالسيرفر. كمّل لوحدك', 'bad', 4500); if (net) { net.close(); net = null; ui.el.netBox.hidden = true; } }
    else if (ev.type === 'chat') ui.toast(ev.name + ': ' + ev.text, '', 3500);
    else if (ev.type === 'horn' && net) { const r = net.remote.get(ev.id); if (r && Math.abs(r.sDisp - game.s) < 700 && !ui.input.horn) { Sound.horn(true); setTimeout(() => Sound.horn(false), 650); } }
  }

  function updateNetBox() {
    const b = ui.el.netBox; if (!net) { b.hidden = true; return; }
    const a = net.ahead; let html = `أونلاين: <b>${net.count}</b> لاعب`; b.classList.remove('warn');
    if (a && a.gap < 900) { html += `<br>${a.derail ? 'قطر واقع' : 'قطر قدامك'} (${a.name}) على ${Math.round(a.gap)} م`; if (a.gap < 250 && (game.v - a.v > 3 || a.derail)) b.classList.add('warn'); }
    if (b.innerHTML !== html) b.innerHTML = html; b.hidden = false;
  }

  function handle(ev) {
    for (const e of ev) {
      const st = stations.list[e.idx];
      if (e.type === 'arrive') {
        const ae = Math.abs(e.err), word = ae <= 1.5 ? 'وقفة مظبوطة!' : ae <= 4 ? 'وقفة ممتازة' : ae <= 8 ? 'وقفة كويسة' : e.err > 0 ? 'وقفت قبل العلامة' : 'عديت العلامة';
        ui.toast(`${st.name}: ${word} (${ae.toFixed(1)} م) +${e.pts + e.bonus} نقطة`, 'good', 4500);
        Sound.chime(true); Sound.speak('محطة ' + st.name);
      } else if (e.type === 'depart') { stations.setSignal(e.idx, true); stations.setBoarding(e.idx, 1); Sound.chime(true); if (!game.finished) ui.toast('الإشارة خضرا. تقدر تتحرك', 'good'); }
      else if (e.type === 'missed') { ui.toast('فوّتّ محطة ' + st.name + '. خصم 50 نقطة', 'bad', 4500); Sound.chime(false); }
      else if (e.type === 'moved') { ui.toast('اتحركت والأبواب مفتوحة! خصم 30 نقطة', 'bad'); Sound.chime(false); }
      else if (e.type === 'over') { ui.toast('السرعة أعلى من المسموح', 'bad', 2200); }
      else if (e.type === 'tooFar') { ui.toast('بعيد عن الرصيف. قرّب لحد علامة قف', '', 3500); }
      else if (e.type === 'danger') { ui.toast('خطر! السرعة عالية جدًا والقطر ممكن يقلب. فرمل حالًا', 'bad', 2500); Sound.beep(1400, 0.2); }
      else if (e.type === 'spad') { ui.toast('عديت إشارة حمرا! خصم 100 نقطة', 'bad', 4000); Sound.chime(false); }
      else if (e.type === 'derail') { Sound.crash(); Sound.horn(true); setTimeout(() => Sound.horn(false), 2500); ui.toast(e.why === 'signal' ? 'عديت الإشارة الحمرا بسرعة والقطر خرج عن القضبان عند التحويلة' : e.why === 'collision' ? 'اتصادمت بقطر تاني! القطر خرج عن القضبان' : 'السرعة كانت أعلى من اللي القطر يستحمله. القطر قلب', 'bad', 6000); setTimeout(showResults, 5500); }
      else if (e.type === 'finish') { setTimeout(showResults, 3500); }
    }
  }

  function showResults() {
    const rows = game.rec.map((r) => [r.name, `${r.pts} + ${r.bonus} نقطة (انحراف ${Math.abs(r.err).toFixed(1)} م)`]);
    if (game.derailed) rows.unshift(['انقلاب القطر', game.derailWhy === 'signal' ? 'عدّيت إشارة حمرا بسرعة' : game.derailWhy === 'collision' ? 'اصطدام بقطر تاني' : 'تجاوز السرعة المسموحة']);
    if (game.penalty.speed) rows.push(['تجاوز السرعة', '−' + game.penalty.speed]);
    if (game.missed) rows.push(['محطات فاتت', game.missed]);
    let best = 0, key = 'qs-best-' + line.id + '-' + type.id;
    try { best = +localStorage.getItem(key) || 0; if (game.score > best) { best = Math.round(game.score); localStorage.setItem(key, String(best)); } } catch (err) { /* no storage */ }
    rows.push(['أفضل نتيجة ليك على الخط ده', best]);
    { const earn = game.derailed ? 0 : Math.max(0, Math.round(game.score / 5)); if (earn) { wallet.add(earn); rows.push(['جنيه لعبة اتكسبت', '+' + earn]); } rows.push(['رصيدك', wallet.load().coins]); }
    ui.results(rows, Math.round(game.score), game.grade(), line.name);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (paused) return;
    const inp = ui.input, ev = game.step(dt, inp);
    if (ev.length) handle(ev);
    train.place(game.s, game.t, game.v, game.derailT); train.spin(game.d || 0); train.setDoors(game.doors);
    train.setDials(game.kmh, game.brake, game.power);
    world.update(dt, game.t); world.scenery.trainS = game.s; world.scenery.trainLen = train.length;
    if (net) { net.setState(game, train.length); const hit = net.update(dt, game.t, train.length); if (hit && !game.derailed) handle(game.derail([], 'collision')); updateNetBox(); }
    { const idn = game.nextIdx, dd = game.distToStop(); if (idn < stations.list.length && dd < 1200 && dd > -150) crowd.prepare(idn); crowd.update(dt, game, train); }
    const L = track.L, near = world.scenery.crossings.some((c) => { const a = ((c.s - game.s) % L + L) % L; return a < 320 || a > L - train.length - 20; });
    Sound.update({ v: game.v, throttle: game.power, brake: game.brake, d: game.d || 0, bell: near, over: game.over });
    updateCamera(dt);
    const idx = Math.min(game.nextIdx, stations.list.length - 1), st = stations.list[idx], dwell = game.phase === 'dwell';
    const m = Math.floor(game.t / 60), s = Math.floor(game.t % 60);
    ui.update({
      kmh: game.kmh, vmax: type.vmax, limit: game.limit, over: game.over && game.phase === 'running', notch: inp.notch, brake: game.brake,
      doorsOpen: game.doors > 0.5, nextName: st.name, nextLabel: dwell ? 'واقف في محطة' : game.finished ? 'وصلنا' : 'المحطة الجاية',
      dist: dwell ? Math.max(0, Math.ceil(16 - game.dwellT)) + ' ث' : Math.round(Math.max(0, game.distToStop())) + ' م',
      score: Math.round(game.score), clock: String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
    });
    renderer.render(scene, camera);
  }

  boot();
})();
