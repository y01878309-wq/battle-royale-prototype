'use strict';
/* Online play. Everyone on the same line shares one track (the route is built for a fixed reference train length when
 * online, so positions agree on every device). Each client simulates its own train, sends its state ten times a second
 * and draws the other players' trains from the states the server relays. Collisions are detected locally against the
 * trains it can see: a train that runs into another (or into a wreck) derails. */
const ONLINE_REF_LEN = 300;

class Online {
  constructor(scene, track, game) {
    this.scene = scene; this.track = track; this.game = game;
    this.ws = null; this.on = false; this.id = 0; this.remote = new Map(); this.ghosts = new Map(); this.count = 1;
    this.lastState = null; this.hb = null; this.onEvent = () => {}; this.ahead = null;
  }

  /* Opens the connection; resolves true when the server has welcomed us, false on any failure. */
  connect(url, join) {
    return new Promise((resolve) => {
      let done = false; const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
      try { this.ws = new WebSocket(url); } catch (e) { finish(false); return; }
      const timer = setTimeout(() => { finish(false); try { this.ws.close(); } catch (e) { /* ignore */ } }, 6000);
      this.ws.onopen = () => this.ws.send(JSON.stringify(Object.assign({ t: 'join' }, join)));
      this.ws.onerror = () => { clearTimeout(timer); finish(false); };
      this.ws.onclose = () => { clearTimeout(timer); const was = this.on; this.on = false; clearInterval(this.hb); finish(false); if (was) this.onEvent({ type: 'disconnected' }); };
      this.ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.t === 'welcome') { clearTimeout(timer); this.on = true; this.id = m.id; this.count = m.count; this.hb = setInterval(() => this.flush(), 120); finish(true); }
        else if (m.t === 'full') { clearTimeout(timer); this.onEvent({ type: 'full' }); finish(false); }
        else if (m.t === 'players') this.receive(m.list);
        else if (m.t === 'leave') this.drop(m.id);
        else if (m.t === 'chat') this.onEvent({ type: 'chat', name: m.name, text: m.text });
        else if (m.t === 'horn') this.onEvent({ type: 'horn', id: m.id });
      };
    });
  }

  /* Remember the latest own state; it is sent by the heartbeat (so the server keeps hearing from us even when the tab is paused). */
  setState(g, len) { this.lastState = { t: 'state', s: +g.s.toFixed(2), v: +g.v.toFixed(2), L: len, derail: g.derailed, dt: +g.derailT.toFixed(1), doors: +g.doors.toFixed(2) }; }
  flush() { if (this.on && this.lastState && this.ws.readyState === 1) this.ws.send(JSON.stringify(this.lastState)); }
  horn() { if (this.on && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'horn' })); }
  chat(text) { if (this.on && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'chat', text })); }
  close() { this.on = false; clearInterval(this.hb); try { this.ws && this.ws.close(); } catch (e) { /* ignore */ } for (const id of [...this.ghosts.keys()]) this.removeGhost(id); this.remote.clear(); }

  receive(list) {
    const now = performance.now(), seen = new Set();
    for (const p of list) {
      seen.add(p.id); let r = this.remote.get(p.id);
      if (!r) { r = { id: p.id, name: p.name, type: p.type, sDisp: p.s, derailAt: 0, wreckAt: 0 }; this.remote.set(p.id, r); this.onEvent({ type: 'join', name: p.name }); }
      r.s = p.s; r.v = p.v; r.L = p.L || 200; r.derail = p.derail; r.doors = p.doors; r.recv = now;
      if (p.derail && !r.derailAt) r.derailAt = now - (p.dt || 0) * 1000;
    }
    for (const id of [...this.remote.keys()]) if (!seen.has(id)) this.drop(id);
    this.count = this.remote.size + 1;
  }

  /* A player left. If their train was derailed it stays on the track as a wreck for a minute. */
  drop(id) {
    const r = this.remote.get(id); if (!r) return;
    if (r.derail && !r.wreckAt) { r.wreckAt = performance.now(); r.v = 0; r.gone = true; this.onEvent({ type: 'leave', name: r.name }); return; }
    if (!r.gone) this.onEvent({ type: 'leave', name: r.name });
    this.remove(id);
  }
  remove(id) { this.remote.delete(id); this.removeGhost(id); }
  removeGhost(id) { const g = this.ghosts.get(id); if (!g) return; for (const v of g.train.vehicles) { this.scene.remove(v.body); for (const b of v.bogies) this.scene.remove(b.g); } if (g.label) this.scene.remove(g.label); this.ghosts.delete(id); }

  makeGhost(r) {
    const type = TRAIN_TYPES.find((t) => t.id === r.type) || TRAIN_TYPES[0], train = new Train(this.scene, this.track, 'low', type, true);
    const c = U.canvas(256, 64), g = c.getContext('2d'); g.fillStyle = 'rgba(20,17,13,0.78)'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#f2a93b'; g.font = '700 34px "Reem Kufi", Tajawal, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText(r.name, 128, 34);
    const tex = new THREE.CanvasTexture(c), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(8, 2, 1); sp.renderOrder = 10; this.scene.add(sp);
    const gh = { train, label: sp, type }; this.ghosts.set(r.id, gh); return gh;
  }

  /* Per frame: move the other players' trains, check for collisions, find the nearest train ahead. Returns 'collision' or ''. */
  update(dt, time, myLen) {
    const L = this.track.L, now = performance.now(), me = this.game, tmp = this.tmpV || (this.tmpV = new THREE.Vector3());
    const mod = (x) => ((x % L) + L) % L; let hit = '', ahead = null;
    for (const [id, r] of this.remote) {
      if (r.wreckAt && now - r.wreckAt > 60000) { this.remove(id); continue; }
      const lag = Math.min(0.6, (now - (r.recv || now)) / 1000), target = r.s + r.v * lag;
      let diff = mod(target - r.sDisp + L / 2) - L / 2; if (Math.abs(diff) > 200) r.sDisp = target; else r.sDisp += diff * Math.min(1, dt * 8);
      const gh = this.ghosts.get(id) || this.makeGhost(r), dT = r.derail && r.derailAt ? (now - r.derailAt) / 1000 : 0;
      gh.train.place(r.sDisp, time, r.v, dT); gh.train.spin(r.v * dt);
      gh.train.setDoors(r.doors || 0);
      const b = gh.train.vehicles[0].body; tmp.copy(b.position); tmp.y += 6.5; gh.label.position.copy(tmp);
      const rl = gh.train.length;
      // gap from my front to the rear of the train ahead, and from the rear of mine to the front of the train behind
      const gapAhead = mod(r.sDisp - rl - me.s), gapBehind = mod(me.s - myLen - r.sDisp);
      if (gapAhead < L / 2 && (!ahead || gapAhead < ahead.gap)) ahead = { gap: gapAhead, v: r.v, name: r.name, derail: r.derail };
      if (!me.derailed) {
        if (gapAhead < 4 && (me.v - r.v > 2 || (r.derail && me.v > 2))) hit = 'collision';
        if (gapBehind < 4 && r.v - me.v > 2 && !r.derail) hit = 'collision';
      }
    }
    this.ahead = ahead; return hit;
  }
}
