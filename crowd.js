'use strict';
/* People. Articulated low-poly figures (head, hair or scarf, torso or galabeya, two arms, two legs, a bag) drawn as
 * instanced meshes. One pool of agents is reused for whichever station the train is approaching:
 *   - they wait on the platform facing the track, in a mix of clothes (shirts, galabeyas, hijabs, children, bags);
 *   - when the doors open some walk to the nearest door and board, and others step out of a door and walk away
 *     (into the station building, or along the platform to its end).
 * Positions are kept in station coordinates: x across the track (right is positive), z along it. */
class Crowd {
  constructor(scene, track, quality, stations, trainLen) {
    this.scene = scene; this.track = track; this.stations = stations; this.trainLen = trainLen;
    this.N = Math.min(240, Math.ceil(Math.max(...stations.list.map((s) => s.crowdN || 0)) * 1.55) + 6);
    this.cur = -1; this.st = null; this.started = false; this.agents = [];
    this.base = new THREE.Vector3(); this.fwd = new THREE.Vector3(); this.right = new THREE.Vector3();
    this.o = new THREE.Object3D(); this.fr = Track.makeFrame(); this.tmp = new THREE.Vector3();
    const N = this.N, geo = (g, tx, ty, tz) => { g.translate(tx || 0, ty || 0, tz || 0); return g; };
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
    const shirtMat = new THREE.MeshStandardMaterial({ map: Tex.plaid(), roughness: 0.9 });
    const im = (g, cast, mt) => { const m = new THREE.InstancedMesh(g, mt || mat, N); m.frustumCulled = false; m.castShadow = !!cast; m.count = N; scene.add(m); return m; };
    this.m = {
      legL: im(geo(new THREE.CylinderGeometry(0.085, 0.07, 0.82, 8), 0, -0.41, 0), true),
      legR: im(geo(new THREE.CylinderGeometry(0.085, 0.07, 0.82, 8), 0, -0.41, 0), true),
      armL: im(geo(new THREE.CylinderGeometry(0.055, 0.045, 0.5, 8), 0, -0.25, 0), false, shirtMat),
      armR: im(geo(new THREE.CylinderGeometry(0.055, 0.045, 0.5, 8), 0, -0.25, 0), false, shirtMat),
      handL: im(new THREE.SphereGeometry(0.052, 8, 6), false),
      handR: im(new THREE.SphereGeometry(0.052, 8, 6), false),
      shoeL: im(geo(new THREE.BoxGeometry(0.14, 0.09, 0.28), 0, 0, 0.04), false),
      shoeR: im(geo(new THREE.BoxGeometry(0.14, 0.09, 0.28), 0, 0, 0.04), false),
      neck: im(geo(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), 0, 0, 0), false),
      torso: im(geo(new THREE.CylinderGeometry(0.235, 0.2, 0.58, 10), 0, 0.29, 0), true, shirtMat),
      robe: im(geo(new THREE.CylinderGeometry(0.21, 0.31, 1.28, 10), 0, 0.64, 0), true),
      head: im(new THREE.SphereGeometry(0.115, 8, 6), true),
      hair: im(new THREE.SphereGeometry(0.128, 8, 6), false),
      bag: im(new THREE.BoxGeometry(1, 1, 1), false)
    };
    for (const k in this.m) { const m = this.m[k]; for (let i = 0; i < N; i++) m.setColorAt(i, new THREE.Color(0xffffff)); m.instanceColor.needsUpdate = true; }
    this.hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < N; i++) this.agents.push({ vis: false });
    this.hideAll();
  }

  hideAll() { for (const k in this.m) { for (let i = 0; i < this.N; i++) this.m[k].setMatrixAt(i, this.hide); this.m[k].instanceMatrix.needsUpdate = true; } for (const a of this.agents) a.vis = false; }

  /* Fill the pool with the waiting passengers of station idx. Called when the train is a few hundred metres away. */
  prepare(idx) {
    if (idx === this.cur || idx < 0 || idx >= this.stations.list.length) return;
    const st = this.stations.list[idx]; this.cur = idx; this.st = st; this.started = false; this.T0 = 0;
    this.track.frame(st.s, this.fr); this.base.copy(this.fr.pos); this.fwd.copy(this.fr.fwd); this.right.copy(this.fr.right);
    const R = U.rng(900 + idx), n = Math.min(st.crowdN || 0, this.N), cols = this.cols || (this.cols = {
      shirt: [0xf0ece0, 0xdcd6c6, 0x6f8fb5, 0x3b4a66, 0x8a8f94, 0x7a5a3c, 0xc4433a, 0x4f8a5c, 0xe0b53a, 0x2d2d30, 0x2e86a8, 0xe0702a, 0x7a4aa8, 0x3a6ad0, 0xd8587a],
      trouser: [0x23262b, 0x3a3f4a, 0x1d1d1f, 0x4a4137, 0x2c3a52, 0x2f5083, 0x3d6aa5, 0x5a5a42, 0x6a5a48],
      robe: [0xf2efe6, 0xd8cdb5, 0xb7b9bd, 0x8da6c4, 0x6b5a48, 0xe8e2d0],
      abaya: [0x16151a, 0x2b2530, 0x1f3040, 0x4a3b32, 0x5a2d3a, 0x2f4a3f, 0x7a3b6a],
      scarf: [0x101012, 0xf4f0e6, 0x8a2f4f, 0x2a5a8a, 0x3a6a4a, 0xc9a24a, 0x7a4a9a, 0xd36a7a],
      skin: [0xd9a77d, 0xc68e63, 0xb67f55, 0xa06c46, 0x8a583a, 0xe3b98f],
      hair: [0x16120e, 0x241a12, 0x3a2a1c, 0x8a8a8a]
    });
    const pick = (a) => a[Math.floor(R() * a.length)], c = new THREE.Color();
    const zLo = st.pl / 2 - 12 - this.trainLen - 6, zHi = st.pl / 2 - 12 + 6;   // along the stopped train
    this.agents.forEach((a, i) => {
      Object.assign(a, { vis: false, role: 'stay', go: false, way: null, moving: false, phase: R() * 6, speed: 0 });
      if (i >= n) return;
      const side = -1, kind = R(), child = kind > 0.93, woman = kind > 0.62 && !child, robe = !woman && !child && kind < 0.2;
      Object.assign(a, {
        vis: true, x: side * (2.5 + R() * 3.6), z: zLo + R() * (zHi - zLo), yaw: 0, child, woman, robe,
        h: child ? 0.66 : 0.92 + R() * 0.14, role: R() < 0.58 ? 'board' : 'stay', delay: 0.5 + R() * 9, bag: R() < 0.45 ? (R() < 0.5 ? 1 : 2) : 0, bagCol: pick(cols.trouser),
        skin: pick(cols.skin), hairC: woman ? pick(cols.scarf) : pick(cols.hair), top: woman ? pick(cols.abaya) : robe ? pick(cols.robe) : child ? pick(cols.shirt) : pick(cols.shirt),
        leg: woman ? pick(cols.abaya) : pick(cols.trouser), face: -side, idleT: R() * 6
      });
      a.yaw = this.yawOf(-side * 1, 0);
    });
    const set = (m, i, hex) => { this.m[m].setColorAt(i, c.setHex(hex)); };
    this.agents.forEach((a, i) => {
      if (!a.vis) return;
      set('torso', i, a.top); set('armL', i, a.top); set('armR', i, a.top); set('robe', i, a.top); set('legL', i, a.leg); set('legR', i, a.leg);
      set('head', i, a.skin); set('hair', i, a.hairC); set('bag', i, a.bagCol); set('handL', i, a.skin); set('handR', i, a.skin); set('neck', i, a.skin); set('shoeL', i, 0x1a1815); set('shoeR', i, 0x1a1815);
    });
    for (const k in this.m) this.m[k].instanceColor.needsUpdate = true;
    for (const a of this.agents) a.dirty = true; this.dirtyAll = true;
    this.pose();
  }

  yawOf(dx, dz) { const wx = this.right.x * dx + this.fwd.x * dz, wz = this.right.z * dx + this.fwd.z * dz; return Math.atan2(wx, wz); }

  /* Door positions in station coordinates, from the train's door meshes. */
  doorList(train) {
    const out = [], v = this.tmp;
    for (const d of train.doors) {
      // the door opening in world space (not the sliding leaf): its local position in the vehicle, through the vehicle's matrix
      d.parent.updateWorldMatrix(true, false); const e = d.parent.matrixWorld.elements, lx = d.position.x, ly = d.position.y, lz = d.userData.z0;
      v.set(e[0] * lx + e[4] * ly + e[8] * lz + e[12], 0, e[2] * lx + e[6] * ly + e[10] * lz + e[14]);
      const rx = v.x - this.base.x, rz = v.z - this.base.z, x = rx * this.right.x + rz * this.right.z, z = rx * this.fwd.x + rz * this.fwd.z;
      if (Math.abs(x) < 2.4 && Math.abs(z) < this.st.pl / 2 + 20) out.push({ x, z, side: x < 0 ? -1 : 1 });
    }
    return out;
  }

  /* Doors have just opened: plan who boards and who gets off. */
  startDwell(train) {
    this.started = true; const st = this.st, doors = this.doorList(train); this.doors = doors;
    if (!doors.length) return;
    const R = U.rng(1700 + this.cur), per = (st.crowdN || 0), nAl = Math.min(Math.round(per * 0.45), this.N - this.agents.filter((a) => a.vis).length);
    // boarders choose the nearest door on their side
    for (const a of this.agents) {
      if (!a.vis || a.role !== 'board') continue;
      const side = -1, cand = doors.filter((d) => d.side === side); if (!cand.length) { a.role = 'stay'; continue; }
      let best = cand[0]; for (const d of cand) if (Math.abs(d.z - a.z) < Math.abs(best.z - a.z)) best = d;
      a.way = [[side * 1.95, best.z + (R() - 0.5) * 0.5], [side * 1.3, best.z]]; a.door = best;
    }
    // alighters appear at random doors, a few seconds apart
    const free = this.agents.filter((a) => !a.vis); let k = 0; const dl = doors.filter((q) => q.side < 0);   // double track: only the platform on the player's side is used
    for (let j = 0; dl.length && j < nAl && j < free.length; j++) {
      const a = free[j], d = dl[Math.floor(R() * dl.length)], kind = R(), child = kind > 0.94, woman = kind > 0.6 && !child, robe = !woman && !child && kind < 0.2, cols = this.cols, pick = (arr) => arr[Math.floor(R() * arr.length)];
      const toBuilding = d.side < 0, way = toBuilding ? [[d.side * 2.6, d.z], [d.side * 4.5, d.z * 0.5 + 4], [-9.4, 10]] : [[d.side * 2.6, d.z], [4.5, d.z + (R() < 0.5 ? 1 : -1) * 6], [4.5, (R() < 0.5 ? 1 : -1) * (st.pl / 2 - 4)]];
      Object.assign(a, {
        vis: false, role: 'alight', go: false, delay: 1 + R() * 9, way, moving: false, x: d.side * 1.2, z: d.z + (R() - 0.5) * 0.4, phase: R() * 6, speed: 0,
        child, woman, robe, h: child ? 0.66 : 0.92 + R() * 0.14, bag: R() < 0.6 ? (R() < 0.5 ? 1 : 2) : 0, bagCol: pick(cols.trouser), skin: pick(cols.skin),
        hairC: woman ? pick(cols.scarf) : pick(cols.hair), top: woman ? pick(cols.abaya) : robe ? pick(cols.robe) : pick(cols.shirt), leg: woman ? pick(cols.abaya) : pick(cols.trouser), face: 0, idleT: 0
      });
      const c = new THREE.Color(), i = this.agents.indexOf(a), set = (m, hex) => this.m[m].setColorAt(i, c.setHex(hex));
      set('torso', a.top); set('armL', a.top); set('armR', a.top); set('robe', a.top); set('legL', a.leg); set('legR', a.leg); set('head', a.skin); set('hair', a.hairC); set('bag', a.bagCol); set('handL', a.skin); set('handR', a.skin); set('neck', a.skin); set('shoeL', 0x1a1815); set('shoeR', 0x1a1815); k++;
    }
    if (k) for (const m in this.m) this.m[m].instanceColor.needsUpdate = true;
  }

  /* Doors closing for departure: anyone still on the platform who meant to board is considered inside. */
  endDwell() {
    this.started = false;
    for (const a of this.agents) if (a.role === 'board' && a.vis) { a.vis = false; a.dirty = true; }
    this.dirtyAll = true; this.pose();
  }

  update(dt, game, train) {
    if (!this.st) return;
    const dwell = game.phase === 'dwell' && game.nextIdx === this.cur;
    if (dwell && !this.started && game.dwellT >= 2.2) this.startDwell(train);
    if (!dwell && this.started) this.endDwell();
    const T = dwell ? game.dwellT - 2.2 : 0; let changed = false;
    const spd = 1.25;
    for (let i = 0; i < this.N; i++) {
      const a = this.agents[i];
      if (a.role === 'stay' || !a.way) continue;
      if (!a.go) {
        if (this.started && T >= a.delay) { a.go = true; a.moving = true; if (a.role === 'alight') { a.vis = true; a.dirty = true; } a.wi = 0; }
        continue;
      }
      if (!a.moving || !a.way) continue;
      const w = a.way[a.wi]; let dx = w[0] - a.x, dz = w[1] - a.z; const dist = Math.hypot(dx, dz), step = Math.min(dist, spd * (a.child ? 0.8 : 1) * dt);
      if (dist < 0.05) {
        a.wi++;
        if (a.wi >= a.way.length) { a.moving = false; a.vis = false; a.way = null; a.speed = 0; a.dirty = true; this.dirtyAll = true; continue; }
      } else {
        a.x += dx / dist * step; a.z += dz / dist * step; a.speed = spd; a.phase += step * 4.4;
        const ty = this.yawOf(dx, dz); let dy = ty - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt * 9); a.dirty = true;
      }
      changed = true;
    }
    if (changed || this.dirtyAll) this.pose();
  }

  /* Write the matrices of every agent that moved (or all, after a change of cast). */
  pose() {
    const o = this.o, M = this.m, B = this.base, bx = this.right.x, bz = this.right.z, fx = this.fwd.x, fz = this.fwd.z, ph = (this.st && this.st.ph) || 1;
    for (let i = 0; i < this.N; i++) {
      const a = this.agents[i];
      if (!this.dirtyAll && !a.dirty) continue; a.dirty = false;
      if (!a.vis) { for (const k in M) M[k].setMatrixAt(i, this.hide); continue; }
      const wx = B.x + bx * a.x + fx * a.z, wz = B.z + bz * a.x + fz * a.z, h = a.h, yaw = a.yaw, cs = Math.cos(yaw), sn = Math.sin(yaw);
      const sw = Math.sin(a.phase) * 0.55 * (a.speed ? 1 : 0), bob = Math.abs(Math.cos(a.phase)) * 0.025 * (a.speed ? 1 : 0), y0 = ph + bob * h;
      const put = (mesh, ox, oy, oz, pitch, sx, sy, sz) => {
        o.position.set(wx + (ox * cs + oz * sn) * h, y0 + oy * h, wz + (-ox * sn + oz * cs) * h);
        o.rotation.set(pitch, yaw, 0, 'YXZ'); o.scale.set(sx * h, sy * h, sz * h); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
      };
      const hide = this.hide;
      if (a.robe) { put(M.robe, 0, 0.1, 0, 0, 1.1, 1, 0.82); M.torso.setMatrixAt(i, hide); M.legL.setMatrixAt(i, hide); M.legR.setMatrixAt(i, hide); }
      else { put(M.torso, 0, 0.86, 0, 0, 1, 1, 1); put(M.legL, -0.1, 0.86, 0, sw, 1, 1, 1); put(M.legR, 0.1, 0.86, 0, -sw, 1, 1, 1); M.robe.setMatrixAt(i, hide); }
      const carry = a.bag === 2 ? 0.05 : 0;
      put(M.armL, -0.27, 1.4, 0, a.robe || a.bag ? -sw * 0.4 : -sw * 0.8, 1, 1, 1); put(M.armR, 0.27, 1.4, 0, carry ? 0.1 : sw * 0.8, 1, 1, 1);
      const sL = a.robe || a.bag ? -sw * 0.4 : -sw * 0.8, sR = carry ? 0.1 : sw * 0.8, AL = 0.5, ft = a.robe ? 0.04 : 0.04;
      put(M.handL, -0.27, 1.4 - AL * Math.cos(sL), -AL * Math.sin(sL), 0, 1, 1, 1); put(M.handR, 0.27, 1.4 - AL * Math.cos(sR), -AL * Math.sin(sR), 0, 1, 1, 1);
      put(M.shoeL, -0.1, 0.86 - 0.82 * Math.cos(sw) + ft, -0.82 * Math.sin(sw), -sw * 0.3, 1, 1, 1); put(M.shoeR, 0.1, 0.86 - 0.82 * Math.cos(sw) + ft, 0.82 * Math.sin(sw), sw * 0.3, 1, 1, 1);
      put(M.neck, 0, 1.5, 0, 0, 1, 1, 1);
      put(M.head, 0, 1.6, 0.01, 0, 1, 1.12, 1);
      if (a.woman) put(M.hair, 0, 1.61, -0.04, 0, 1.08, 1.02, 1.02); else put(M.hair, 0, 1.64, -0.03, 0, 0.98, 0.7, 1.0);
      if (a.bag === 1) put(M.bag, 0, 1.12, -0.18, 0, 0.3, 0.4, 0.14); else if (a.bag === 2) put(M.bag, 0.3, 0.52, 0.02, 0, 0.12, 0.34, 0.26); else M.bag.setMatrixAt(i, hide);
    }
    this.dirtyAll = false;
    for (const k in M) M[k].instanceMatrix.needsUpdate = true;
  }
}
