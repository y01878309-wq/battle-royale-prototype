'use strict';
/* Online play. Everyone on the same line shares one track (the route is built for a fixed reference train length when
 * online, so positions agree on every device). Each client simulates its own train, sends its state ten times a second
 * and draws the other players' trains from the states the server relays. Collisions are detected locally against the
 * trains it can see: a train that runs into another (or into a wreck) derails. */
const ONLINE_REF_LEN = 300;

class Online {
  constructor(scene, track, game) {
    this.scene = scene; this.track = track; this.game = game;
    this.on = false; this.id = 0; this.remote = new Map(); this.ghosts = new Map(); this.count = 1;
    this.lastState = null; this.hb = null; this.onEvent = () => {}; this.ahead = null;
  }

  /* Joins the room of the line on Firebase Realtime Database: every player writes his own node (rooms/<line>/<uid>) and listens to the
   * whole room. Resolves true when we are in, false on any failure (the game then continues alone). */
  async connect(join) {
    if (!FB.ok || !FB.rt || !window.firebase) return false;
    const to = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
    try {
      const rt = FB.rt, SV = firebase.database.ServerValue;
      this.room = rt.ref('rooms/' + join.line); this.me = this.room.child(FB.uid); this.SV = SV; this.id = FB.uid; this.seen = new Map(); this.offset = 0;
      rt.ref('.info/serverTimeOffset').on('value', (s) => { this.offset = s.val() || 0; });
      this.me.onDisconnect().remove();
      await to(this.me.set({ name: join.name, type: join.type, s: 0, v: 0, L: 200, derail: false, dt: 0, doors: 0, h: 0, t: SV.TIMESTAMP }), 7000);
      this.room.on('value', (snap) => { this.lastVal = snap.val() || {}; this.onRoom(this.lastVal); });
      this.on = true; this.tk = 0; this.hb = setInterval(() => { this.flush(); if (++this.tk % 15 === 0 && this.lastVal) this.onRoom(this.lastVal); }, 200); return true;
    } catch (e) { try { this.room && this.room.off(); } catch (x) { /* */ } return false; }
  }

  /* The room changed: drop stale players, tell the game about new horns and chat lines, then hand the rest to receive(). */
  onRoom(val) {
    const now = Date.now() + (this.offset || 0), list = [];
    for (const id of Object.keys(val)) {
      const p = val[id]; if (id === this.id || !p || typeof p.s !== 'number') continue;
      if (p.t && now - p.t > 12000) continue;                                   // no news for 12 s: the player is gone
      const prev = this.seen.get(id) || { h: p.h || 0, c: (p.c && p.c.n) || 0 };
      if ((p.h || 0) > prev.h) this.onEvent({ type: 'horn', id });
      if (p.c && p.c.n > prev.c && p.c.text) this.onEvent({ type: 'chat', name: p.name, text: p.c.text });
      this.seen.set(id, { h: p.h || 0, c: (p.c && p.c.n) || 0 });
      list.push({ id, name: p.name, type: p.type, s: p.s, v: p.v, L: p.L, derail: !!p.derail, dt: p.dt || 0, doors: p.doors || 0 });
    }
    this.receive(list);
  }

  /* Remember the latest own state; it is sent by the heartbeat (so the others keep hearing from us even when the tab is paused). */
  setState(g, len) { this.lastState = { s: +g.s.toFixed(2), v: +g.v.toFixed(2), L: len, derail: !!g.derailed, dt: +g.derailT.toFixed(1), doors: +g.doors.toFixed(2) }; }
  flush() { if (this.on && this.lastState) this.me.update(Object.assign({ t: this.SV.TIMESTAMP }, this.lastState)).catch(() => {}); }
  horn() { if (this.on) { this.hornN = (this.hornN || 0) + 1; this.me.update({ h: this.hornN }).catch(() => {}); } }
  chat(text) { if (this.on) { this.chatN = (this.chatN || 0) + 1; this.me.update({ c: { n: this.chatN, text: String(text).slice(0, 80) } }).catch(() => {}); } }
  close() {
    this.on = false; clearInterval(this.hb);
    try { if (this.room) this.room.off(); if (this.me) { this.me.onDisconnect().cancel(); this.me.remove(); } } catch (e) { /* ignore */ }
    for (const id of [...this.ghosts.keys()]) this.removeGhost(id); this.remote.clear();
  }

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
