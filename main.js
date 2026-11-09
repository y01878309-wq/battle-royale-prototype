'use strict';
/* Boot, render loop, cameras and glue between the game logic, the 3D world, sound and the HUD. */
(function () {
  const ui = new UI();
  let renderer, scene, camera, track, sky, world, stations, train, game;
  let started = false, paused = false, camIdx = 0, last = 0, hornOn = false, sideS = -1e9, lastBoard = -1;
  const v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), q4 = new THREE.Quaternion(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

  async function boot() {
    const t = (id) => document.getElementById(id);
    if (!window.THREE) { t('loadMsg').textContent = 'تعذر تحميل مكتبة Three.js. اتأكد من الاتصال أو حط الملف في vendor/three.min.js'; return; }
    try {
      await Promise.race([Promise.all([document.fonts.load('700 40px "Reem Kufi"'), document.fonts.load('500 20px Tajawal')]), new Promise((r) => setTimeout(r, 2500))]);
    } catch (e) { /* fonts are optional */ }
    try { const s = JSON.parse(localStorage.getItem('qs-opts') || '{}'); if (s.time) ui.el.optTime.value = s.time; if (s.q) ui.el.optQuality.value = s.q; } catch (e) { /* no storage */ }
    t('loading').hidden = true; t('menu').hidden = false;
    ui.on({
      start: startGame, restart: restart, camera: cycleCamera, pause: togglePause, autoPause: () => { if (started && !paused) togglePause(); },
      mute: () => { Sound.setMuted(!Sound.muted); ui.setMuteLabel(Sound.muted); },
      horn: (on) => { hornOn = on; Sound.horn(on); }
    });
  }

  async function startGame() {
    const quality = ui.el.optQuality.value, time = ui.el.optTime.value;
    try { localStorage.setItem('qs-opts', JSON.stringify({ time, q: quality })); } catch (e) { /* no storage */ }
    Sound.init();
    ui.el.menu.hidden = true; ui.el.loading.hidden = false; U.setProgress(0.02, 'جاري تجهيز السكة…');
    await U.tick();

    const canvas = document.getElementById('gl');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = quality !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.25, 20000);
    window.addEventListener('resize', onResize);

    track = new Track(); sky = new Sky(renderer, scene); sky.setShadowQuality(quality); sky.apply(time);
    track.buildMeshes(scene, quality); await U.tick();
    world = new World(scene, track, sky, quality); await world.build();
    U.setProgress(0.9, 'المحطات والقطر…'); await U.tick();
    stations = new Stations(scene, track, quality); stations.build();
    train = new Train(scene, track, quality); train.setHeadlights(time === 'sunset' || time === 'night' || time === 'overcast'); train.setNight(time === 'night');
    game = new Game(track.L, stations.list, (s) => stations.limitAt(s));
    stations.list.forEach((_, i) => stations.setSignal(i, i === 0)); stations.setNight(time === 'night');
    renderer.compile(scene, camera);
    U.setProgress(1, 'جاهز');
    ui.el.loading.hidden = true; ui.el.hud.hidden = false; started = true;
    applyCamera(); ui.setMuteLabel(Sound.muted);
    ui.toast('اضغط W علشان تزود القوة. وسّع الفرامل قبل المحطة بـ 300 م', '', 5200);
    window.__game = { game, track, train, stations, world, sky, renderer, scene, camera };
    last = performance.now(); requestAnimationFrame(frame);
  }

  function restart() {
    ui.el.result.hidden = true; game.reset(); ui.input.notch = 0; ui.el.touchThrottle.value = 0; ui.input.brakeHeld = false; ui.input.emergency = false;
    stations.list.forEach((st, i) => { stations.setBoarding(i, 0); stations.setSignal(i, i === 0); });
    train.setDoors(0); sideS = -1e9; ui.last = {};
    ui.toast('رحلة جديدة. بالتوفيق!', '', 3000);
  }

  function onResize() { renderer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); }

  function togglePause() { paused = !paused; ui.el.pause.hidden = !paused; if (Sound.ctx) { paused ? Sound.ctx.suspend() : Sound.ctx.resume(); } last = performance.now(); }

  function cycleCamera() { camIdx = (camIdx + 1) % CAMERAS.length; applyCamera(); }
  function applyCamera() {
    const k = CAMERAS[camIdx][0]; train.setCabView(k === 'cab'); ui.setCamLabel(CAMERAS[camIdx][1]);
    camera.fov = k === 'cab' ? 70 : 60; camera.updateProjectionMatrix(); sideS = -1e9;
  }

  function handle(ev) {
    for (const e of ev) {
      const st = stations.list[e.idx];
      if (e.type === 'arrive') {
        const ae = Math.abs(e.err), word = ae <= 1.5 ? 'وقفة مظبوطة!' : ae <= 4 ? 'وقفة ممتازة' : ae <= 8 ? 'وقفة كويسة' : e.err > 0 ? 'وقفت قبل العلامة' : 'عديت العلامة';
        ui.toast(`${st.name}: ${word} (${e.err > 0 ? '−' : '+'}${ae.toFixed(1)} م) ${e.pts + e.bonus}+ نقطة`, 'good', 4500);
        Sound.chime(true); Sound.speak('محطة ' + st.name);
      } else if (e.type === 'depart') { stations.setSignal(e.idx, true); stations.setBoarding(e.idx, 1); Sound.chime(true); if (!game.finished) ui.toast('الإشارة خضرا. تقدر تتحرك', 'good'); }
      else if (e.type === 'missed') { ui.toast('فوّتّ محطة ' + st.name + '. خصم 50 نقطة', 'bad', 4500); Sound.chime(false); }
      else if (e.type === 'moved') { ui.toast('اتحركت والأبواب مفتوحة! خصم 30 نقطة', 'bad'); Sound.chime(false); }
      else if (e.type === 'over') { ui.toast('السرعة أعلى من المسموح', 'bad', 2200); }
      else if (e.type === 'tooFar') { ui.toast('بعيد عن الرصيف. قرّب لحد علامة قف', '', 3500); }
      else if (e.type === 'finish') { setTimeout(showResults, 3500); }
    }
  }

  function showResults() {
    const rows = game.rec.map((r) => [r.name, `${r.pts} + ${r.bonus} نقطة (انحراف ${Math.abs(r.err).toFixed(1)} م)`]);
    if (game.penalty.speed) rows.push(['تجاوز السرعة', '−' + game.penalty.speed]);
    if (game.missed) rows.push(['محطات فاتت', game.missed]);
    let best = 0; try { best = +localStorage.getItem('qs-best') || 0; if (game.score > best) { best = game.score; localStorage.setItem('qs-best', String(best)); } } catch (e) { /* no storage */ }
    rows.push(['أفضل نتيجة ليك', best]);
    ui.results(rows, Math.round(game.score), game.grade());
  }

  function updateCamera(dt) {
    const k = CAMERAS[camIdx][0], body = train.loco.body; body.updateMatrixWorld(true);
    if (k === 'cab') {
      train.eye.getWorldPosition(camera.position); train.eye.getWorldQuaternion(camera.quaternion);
      const f = Math.min(1, game.v / 25);
      camera.position.y += Math.sin(game.t * 17) * 0.004 * f + Math.sin(game.t * 5.3) * 0.006 * f;
      camera.position.x += Math.sin(game.t * 3.1) * 0.004 * f;
    } else if (k === 'front') {
      train.nose.getWorldPosition(camera.position); train.nose.getWorldQuaternion(camera.quaternion);
    } else if (k === 'chase') {
      body.localToWorld(camPos.set(4.5, 6.5, -27)); body.localToWorld(camLook.set(-0.5, 2.6, 12));
      camera.position.lerp(camPos, 1 - Math.exp(-6 * dt)); if (camera.position.distanceTo(camPos) > 30) camera.position.copy(camPos);
      camera.lookAt(camLook);
    } else if (k === 'side') {
      const rel = ((sideS - game.s) % track.L + track.L) % track.L;
      if (sideS < -1e8 || rel > track.L / 2 || rel < 0 + 0) { sideS = game.s + 90 + game.v * 4; }
      const d = ((sideS - game.s) % track.L + track.L) % track.L;
      if (d > track.L / 2) sideS = game.s + 90 + game.v * 4;
      track.at(sideS, -11, 2.1, camera.position); body.getWorldPosition(camLook); camLook.y += 2.2; camera.lookAt(camLook);
    }
    sky.update(camera, body.getWorldPosition(v4), game.t);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (paused) return;
    const inp = ui.input, ev = game.step(dt, inp);
    if (ev.length) handle(ev);
    train.place(game.s, game.t, game.v); train.spin(game.d || 0); train.setDoors(game.doors);
    train.setDials(game.kmh, game.brake, game.power);
    world.update(dt, game.t); world.scenery.trainS = game.s; world.scenery.trainLen = train.length;
    // passengers board during the dwell
    if (game.phase === 'dwell' && !game.finished) {
      const p = U.clamp((game.dwellT - 2) / 12, 0, 1), key = Math.floor(p * 20);
      if (key !== lastBoard) { lastBoard = key; stations.setBoarding(game.nextIdx, p); }
    } else lastBoard = -1;
    const near = world.scenery.crossings.some((c) => { const a = ((c.s - game.s) % track.L + track.L) % track.L; return a < 320 || a > track.L - train.length - 20; });
    Sound.update({ v: game.v, throttle: game.power, brake: game.brake, d: game.d || 0, bell: near, over: game.over });
    updateCamera(dt);
    const idx = Math.min(game.nextIdx, stations.list.length - 1), st = stations.list[idx], dwell = game.phase === 'dwell';
    const m = Math.floor(game.t / 60), s = Math.floor(game.t % 60);
    ui.update({
      kmh: game.kmh, limit: game.limit, over: game.over && game.phase === 'running', notch: inp.notch, brake: game.brake,
      doorsOpen: game.doors > 0.5, nextName: st.name, nextLabel: dwell ? 'واقف في محطة' : game.finished ? 'وصلنا' : 'المحطة الجاية',
      dist: dwell ? Math.max(0, Math.ceil(16 - game.dwellT)) + ' ث' : Math.round(Math.max(0, game.distToStop())) + ' م',
      score: Math.round(game.score), clock: String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
    });
    renderer.render(scene, camera);
  }

  boot();
})();
