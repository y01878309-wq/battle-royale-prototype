'use strict';
/* Trains: a locomotive (or DMU cab car) plus a consist of coaches or wagons. Every vehicle sits on two
 * bogies that follow the track. Livery and shape come from a TRAIN_TYPES entry in data.js. */
class Train {
  constructor(scene, track, quality, type) {
    this.scene = scene; this.track = track; this.q = quality; this.type = type;
    this.vehicles = []; this.doors = []; this.cabMode = false;
    const paint = (hex, cc) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.38, metalness: 0.15, clearcoat: cc, clearcoatRoughness: 0.28 });
    const common = {
      glass: new THREE.MeshStandardMaterial({ color: 0x0a1319, roughness: 0.06, metalness: 0.2, envMapIntensity: 1.8 }),
      winLit: new THREE.MeshStandardMaterial({ color: 0x0a1319, roughness: 0.08, metalness: 0.2, envMapIntensity: 1.8, emissive: 0xffd9a0, emissiveIntensity: 0 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.65, metalness: 0.4 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.45, metalness: 0.85 }),
      roof: new THREE.MeshStandardMaterial({ color: 0xa6a69f, roughness: 0.7, metalness: 0.2 }),
      lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 1.2 }),
      redlamp: new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2010, emissiveIntensity: 1.0 }),
      opening: new THREE.MeshStandardMaterial({ color: 0x0b0a08, roughness: 1 })
    };
    this.lm = Object.assign({ blue: paint(type.loco.top, 0.8), cream: paint(type.loco.low, 0.5), yellow: new THREE.MeshStandardMaterial({ color: type.loco.trim, roughness: 0.5 }) }, common);
    this.cm = Object.assign({ blue: paint(type.coach.band, 0.8), cream: paint(type.coach.body, 0.5), yellow: new THREE.MeshStandardMaterial({ color: type.coach.trim, roughness: 0.5 }) }, common);
    this.build();
  }

  /* Total length in metres, known before anything is built (the route needs it for platforms). */
  static lengthOf(type) {
    const L = { coach: 22.2, old: 20.4, talgo: 14.6, tank: 13.6, box: 13.6, flat: 13.6, cab: type.loco.len };
    return type.loco.len + type.consist.reduce((a, k) => a + (L[k] || 22.2) + 0.9, 0);
  }

  extrudeBody(pts, width) {
    const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: width - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, steps: 1 });
    g.translate(0, 0, -(width - 0.16) / 2); g.rotateY(-Math.PI / 2);   // shape x -> train z (forward), width -> x
    return g;
  }

  box(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }

  makeBogie(axles, spacing) {
    const M = this.lm, g = new THREE.Group(), sets = [];
    this.box(2.1, 0.25, spacing * (axles - 1) + 1.2, M.dark, 0, 0.66, 0, g);
    for (const sx of [-0.95, 0.95]) this.box(0.2, 0.3, spacing * (axles - 1) + 0.9, M.steel, sx, 0.62, 0, g);
    for (let i = 0; i < axles; i++) {
      const z = (i - (axles - 1) / 2) * spacing, ws = new THREE.Group(); ws.position.set(0, 0.46, z);
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.8, 8), M.steel); axle.rotation.z = Math.PI / 2; ws.add(axle);
      for (const sx of [-0.7175, 0.7175]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.13, 20), M.steel); w.rotation.z = Math.PI / 2; w.position.x = sx; w.castShadow = true; ws.add(w);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 10), M.dark); hub.rotation.z = Math.PI / 2; hub.position.x = sx * 1.03; ws.add(hub);
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.82, 0.04), M.dark); spoke.position.x = sx * 1.02; ws.add(spoke);
      }
      g.add(ws); sets.push(ws);
    }
    this.scene.add(g); return { g, sets };
  }

  addDoors(body, M, zs, h0, h1) {
    for (const sx of [-1, 1]) for (const ez of zs) {
      this.box(0.03, h1, 1.15, M.opening, sx * 1.56, h0, ez, body);
      const door = this.box(0.05, h1, 1.1, M.blue, sx * 1.6, h0, ez, body); door.userData = { z0: ez, dir: ez > 0 ? -1 : 1 }; this.doors.push(door);
      this.box(0.04, 0.5, 0.7, M.glass, 0, h1 * 0.23, 0, door).position.set(0.03, h1 * 0.23, 0);
    }
  }

  /* Locomotive or DMU cab car. 'driver' adds the cab interior, view anchors and the headlight beam. */
  buildLoco(spec, driver) {
    const M = this.lm, h = spec.len / 2, dmu = spec.kind === 'dmu', body = new THREE.Group(), hull = new THREE.Group();
    const shell = new THREE.Mesh(this.extrudeBody([[-h, 1.0], [-h, 3.95], [-h + 0.3, 4.2], [h - 2.4, 4.2], [h, 2.6], [h, 1.0]], 3.0), M.blue);
    shell.castShadow = true; shell.receiveShadow = true; hull.add(shell);
    this.box(3.2, 1.3, spec.len + 0.1, M.cream, 0, 1.72, 0, hull);
    this.box(3.21, 0.16, spec.len + 0.1, M.blue, 0, 1.18, 0, hull);
    this.box(3.21, 0.07, spec.len + 0.1, M.yellow, 0, 2.42, 0, hull);
    this.box(2.7, 0.14, spec.len * 0.82, M.roof, 0, 4.26, -spec.len * 0.06, hull);
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 20), M.dark); f.position.set(0, 4.4, -h + 1.8 + i * 2.6); hull.add(f); }
    this.box(1.6, 0.35, 3.2, M.roof, 0, 4.45, -1.0, hull); this.box(1.0, 0.3, 2.0, M.roof, 0, 4.4, h - 7.4, hull);
    // windscreen on the sloped nose
    const n = new THREE.Vector3(0, 0.832, 0.555), th = -Math.atan2(n.y, n.z);
    const mid = new THREE.Vector3(0, 3.4, h - 1.2);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 2.1), M.glass); gl.position.copy(mid).addScaledVector(n, 0.12); gl.rotation.x = th; hull.add(gl);
    if (driver) this.glass = gl;
    for (const sx of [-1.0, 1.0]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16), M.lamp); l.rotation.x = Math.PI / 2; l.position.set(sx, 1.7, h + 0.1); hull.add(l); }
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16), M.lamp); hl.rotation.x = Math.PI / 2; hl.position.set(0, 2.45, h + 0.1); hull.add(hl);
    for (const sx of [-1.25, 1.25]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), M.redlamp); r.rotation.x = Math.PI / 2; r.position.set(sx, 1.7, -h - 0.1); hull.add(r); }
    this.box(3.0, 0.32, 0.3, M.dark, 0, 1.05, h + 0.2, hull); this.box(3.0, 0.32, 0.3, M.dark, 0, 1.05, -h - 0.2, hull);
    for (const sx of [-1.0, 1.0]) for (const e of [-1, 1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 12), M.steel); b.rotation.x = Math.PI / 2; b.position.set(sx, 1.05, e * (h + 0.45)); hull.add(b); }
    for (const sx of [-1, 1]) {
      if (dmu) for (let z = -h + 2.2; z < h - 6.5; z += 2.2) this.box(0.03, 1.0, 1.5, M.winLit, sx * 1.6, 2.9, z, hull);
      else for (let i = 0; i < 9; i++) this.box(0.03, 0.8, 0.5, M.dark, sx * 1.6, 3.0, -h + 1.6 + i * 0.75, hull);
      this.box(0.03, 1.0, 1.9, M.glass, sx * 1.6, 3.35, h - 4.1, hull);
      this.box(0.03, 2.5, 1.1, M.dark, sx * 1.6, 2.5, h - 5.9, hull);
      this.box(0.03, 0.7, 1.0, M.glass, sx * 1.62, 3.55, h - 5.9, hull);
      for (const sy of [1.25, 1.85]) this.box(0.5, 0.05, 0.7, M.steel, sx * 1.8, sy, h - 5.9, hull);
      for (const z of [h - 6.55, h - 5.25]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6), M.steel); r.position.set(sx * 1.68, 2.55, z); hull.add(r); }
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.62), new THREE.MeshStandardMaterial({ map: Tex.sign('السكك الحديدية المصرية', 768, 104, '#8f1a22', '#f4f0e6'), roughness: 0.6 }));
      plate.position.set(sx * 1.605, 1.78, dmu ? -2 : -2.6); plate.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; hull.add(plate);
      const num = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), new THREE.MeshStandardMaterial({ map: Tex.sign(spec.kind === 'dmu' ? '٧١٠٢' : '٣٠١٦', 256, 116, '#1b1a19', '#f4f0e6'), roughness: 0.6 }));
      num.position.set(sx * 1.605, 2.95, h - 3.5); num.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; hull.add(num);
      const hn = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.55, 10), M.steel); hn.rotation.x = Math.PI / 2; hn.position.set(sx * 0.35, 4.42, h - 4); hull.add(hn);
    }
    if (!dmu) this.box(2.3, 0.7, 6.4, M.dark, 0, 0.78, 0, hull);
    for (const wx of [-0.65, 0.65]) { const w = this.box(0.03, 0.9, 0.04, M.dark, wx, 3.4, h - 1.3, hull); w.rotation.x = 0.97; w.rotation.z = 0.5 * Math.sign(wx); }
    body.add(hull);
    if (dmu) this.addDoors(body, M, [-h + 2.4, h - 8.4], 2.3, 2.4);
    let eye = null, nose = null;
    if (driver) {
      this.locoHull = hull;
      const cab = new THREE.Group(), ic = new THREE.MeshStandardMaterial({ color: 0x9a9384, roughness: 0.85 }), dk = new THREE.MeshStandardMaterial({ color: 0x242321, roughness: 0.7 });
      this.box(3.0, 0.12, 6.6, new THREE.MeshStandardMaterial({ color: 0x3b3a36, roughness: 0.9 }), 0, 1.09, 6.1, cab);
      this.box(3.0, 0.14, 5.6, ic, 0, 4.12, 5.4, cab);
      for (const sx of [-1, 1]) { this.box(0.12, 1.5, 4.2, ic, sx * 1.46, 1.9, 5.3, cab); this.box(0.12, 0.22, 4.2, ic, sx * 1.46, 3.95, 5.3, cab); this.box(0.14, 2.9, 0.16, dk, sx * 1.45, 2.65, 7.0, cab); }
      this.box(3.0, 2.9, 0.1, ic, 0, 2.6, 2.9, cab);
      for (const x of [-1.32, 0, 1.32]) { const p = new THREE.Mesh(new THREE.BoxGeometry(x === 0 ? 0.05 : 0.15, 0.1, 3.0), dk); p.position.set(x, 4.2 - 0.83, 7.4 + 1.2); p.rotation.x = Math.atan2(1.65, 2.4); cab.add(p); }
      this.box(2.9, 0.62, 1.0, dk, 0, 2.18, 6.5, cab);
      this.box(2.9, 0.08, 0.9, new THREE.MeshStandardMaterial({ color: 0x35332f, roughness: 0.6 }), 0, 2.52, 6.4, cab).rotation.x = 0.25;
      this.box(0.5, 0.7, 0.5, dk, -0.75, 1.5, 4.4, cab); this.box(0.5, 0.55, 0.1, dk, -0.75, 2.0, 4.15, cab);
      const ey = new THREE.Vector3(-0.75, 3.05, 5.0);
      this.dials = [];
      for (const [x, max, lab, big] of [[-0.75, 160, 'كم/س', 0.34], [-0.15, 10, 'بار', 0.26], [0.35, 10, 'قوة', 0.26]]) {
        const grp = new THREE.Group(); grp.position.set(x, 2.58, 6.2);
        grp.add(new THREE.Mesh(new THREE.PlaneGeometry(big, big), new THREE.MeshBasicMaterial({ map: Tex.dial(max, lab), transparent: true })));
        const needle = new THREE.Group(), nm = new THREE.Mesh(new THREE.BoxGeometry(0.008, big * 0.4, 0.002), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
        nm.position.y = big * 0.2; needle.add(nm); needle.position.z = 0.003; grp.add(needle);
        cab.add(grp); grp.lookAt(ey.x, ey.y, ey.z); this.dials.push({ needle, max });
      }
      cab.position.z = h - 9.8; cab.visible = false; body.add(cab); this.cab = cab;
      eye = new THREE.Object3D(); eye.position.set(ey.x, ey.y, ey.z + h - 9.8); eye.rotation.y = Math.PI; body.add(eye);
      nose = new THREE.Object3D(); nose.position.set(0, 1.6, h + 0.6); nose.rotation.y = Math.PI; body.add(nose);
      this.spot = new THREE.SpotLight(0xfff0d0, 0, 400, 0.34, 0.5, 1.2); this.spot.position.set(0, 2.4, h); this.spot.target.position.set(0, 0.5, h + 50);
      body.add(this.spot, this.spot.target);
      this.eye = eye; this.nose = nose;
    }
    this.scene.add(body);
    const ax = dmu ? 2 : 3, sp = dmu ? 2.5 : 1.9;
    return { body, len: spec.len, bs: dmu ? 15.6 : 11.4, bogies: [this.makeBogie(ax, sp), this.makeBogie(ax, sp)], loco: driver };
  }

  /* Passenger coaches in three styles. */
  buildCoach(style) {
    const M = this.cm, body = new THREE.Group();
    let len, prof, nWin, ww, wh, wy, wStart, wStep, doorZ, bs, hRoof;
    if (style === 'talgo') {
      len = 14.6; hRoof = 3.3; prof = [[-7.3, 0.55], [-7.3, 3.0], [-6.7, 3.3], [6.7, 3.3], [7.3, 3.0], [7.3, 0.55]];
      nWin = 5; ww = 1.8; wh = 0.85; wy = 2.2; wStep = 2.4; wStart = -4.8; doorZ = [-6.2, 6.2]; bs = 10.2;
    } else if (style === 'old') {
      len = 20.4; hRoof = 3.85; prof = [[-10.2, 0.85], [-10.2, 3.5], [-9.7, 3.85], [9.7, 3.85], [10.2, 3.5], [10.2, 0.85]];
      nWin = 11; ww = 0.95; wh = 0.85; wy = 2.7; wStep = 1.55; wStart = -7.75; doorZ = [-9.0, 9.0]; bs = 14.2;
    } else {
      len = 22.2; hRoof = 3.95; prof = [[-11, 0.85], [-11, 3.4], [-10.3, 3.95], [10.3, 3.95], [11, 3.4], [11, 0.85]];
      nWin = 8; ww = 1.5; wh = 1.05; wy = 2.8; wStep = 1.95; wStart = -7.3; doorZ = [-9.7, 9.7]; bs = 15.6;
    }
    const shell = new THREE.Mesh(this.extrudeBody(prof, style === 'talgo' ? 2.9 : 3.0), M.cream);
    shell.castShadow = true; shell.receiveShadow = true; body.add(shell);
    const low = style === 'talgo' ? 0.55 : 0.85;
    this.box(3.2, low, len + 0.1, M.blue, 0, 0.85 + low / 2 - (style === 'talgo' ? 0.2 : 0), 0, body);
    this.box(3.2, 0.12, len + 0.1, M.yellow, 0, 1.82 - (style === 'talgo' ? 0.2 : 0), 0, body);
    this.box(3.1, 0.14, len - 0.8, M.roof, 0, hRoof + 0.03, 0, body).scale.x = 0.8;
    if (style === 'std') for (let k = 0; k < 4; k++) this.box(1.4, 0.3, 2.2, M.roof, 0, 4.15, -7.5 + k * 5, body);
    if (style === 'old') for (let k = 0; k < 6; k++) { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 10), M.dark); v.position.set(0, hRoof + 0.2, -7 + k * 2.8); body.add(v); }
    for (const sx of [-1, 1]) for (let k = 0; k < nWin; k++) this.box(0.03, wh, ww, M.winLit, sx * 1.58, wy, wStart + k * wStep + (style === 'std' && k > 3 ? 0.4 : 0), body);
    this.addDoors(body, M, doorZ, style === 'talgo' ? 1.85 : 2.3, style === 'talgo' ? 2.0 : 2.4);
    for (const e of [-1, 1]) this.box(2.5, hRoof - 0.9, 0.4, M.dark, 0, (hRoof + 0.6) / 2, e * (len / 2 + 0.1), body);
    this.box(2.2, 0.4, len * 0.66, M.dark, 0, 0.78, 0, body);
    this.scene.add(body);
    return { body, len, bs, bogies: [this.makeBogie(2, 2.5), this.makeBogie(2, 2.5)], loco: false };
  }

  /* Freight wagons: tank, box car, flat car with containers. */
  buildWagon(kind, i) {
    const M = this.cm, body = new THREE.Group(), len = 13.6;
    this.box(3.0, 0.4, len, M.dark, 0, 1.1, 0, body);
    if (kind === 'tank') {
      const g = new THREE.CylinderGeometry(1.3, 1.3, len - 1.6, 20); g.rotateX(Math.PI / 2);
      const t = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: i % 2 ? 0x2b2b2a : 0x4a4f54, roughness: 0.5, metalness: 0.4 })); t.position.y = 2.55; t.castShadow = true; body.add(t);
      this.box(0.8, 0.3, 0.8, M.dark, 0, 3.9, 0, body);
    } else if (kind === 'box') {
      this.box(2.9, 2.8, len - 1, M.cream, 0, 2.7, 0, body);
      for (const sx of [-1, 1]) this.box(0.06, 2.4, 2.4, M.blue, sx * 1.46, 2.7, 0, body);
      this.box(3.0, 0.14, len - 0.6, M.roof, 0, 4.15, 0, body);
    } else {
      const cols = [0x2a4f86, 0xc8571a, 0x3c7a4a, 0xa8262d, 0xe4e0d4, 0x6a6f74];
      for (const z of [-3.2, 3.2]) this.box(2.5, 2.6, 6.0, new THREE.MeshStandardMaterial({ color: cols[(i + (z > 0 ? 2 : 0)) % cols.length], roughness: 0.6, metalness: 0.2 }), 0, 2.6, z, body);
    }
    this.scene.add(body);
    return { body, len, bs: 9.4, bogies: [this.makeBogie(2, 1.8), this.makeBogie(2, 1.8)], loco: false };
  }

  build() {
    this.loco = this.buildLoco(this.type.loco, true); this.vehicles.push(this.loco);
    this.type.consist.forEach((k, i) => {
      let v;
      if (k === 'cab') { v = this.buildLoco(this.type.loco, false); v.flip = true; }
      else if (k === 'tank' || k === 'box' || k === 'flat') v = this.buildWagon(k, i);
      else v = this.buildCoach(k === 'old' ? 'old' : k === 'talgo' ? 'talgo' : 'std');
      this.vehicles.push(v);
    });
    this.length = this.vehicles.reduce((a, v) => a + v.len + 0.9, 0);
    this.vehicles.forEach((v) => v.body.traverse((o) => { if (o.isMesh) o.castShadow = true; }));
    this.fa = Track.makeFrame(); this.fb = Track.makeFrame(); this.tmp = new THREE.Vector3();
  }

  setCabView(on) { this.cabMode = on; this.locoHull.visible = !on; this.cab.visible = on; }

  /* Place every vehicle. sHead is the distance of the loco's front buffer. */
  place(sHead, time, speed) {
    const tr = this.track; let center = sHead - this.loco.len / 2;
    this.vehicles.forEach((v, idx) => {
      if (idx > 0) { const p = this.vehicles[idx - 1]; center -= p.len / 2 + 0.9 + v.len / 2; }
      const fa = tr.frame(center + v.bs / 2, this.fa), fb = tr.frame(center - v.bs / 2, this.fb);
      this.tmp.copy(fa.pos).sub(fb.pos); const dir = this.tmp.clone().normalize();
      v.body.position.copy(fa.pos).add(fb.pos).multiplyScalar(0.5); v.body.position.y = RAIL_TOP;
      v.body.lookAt(v.body.position.x + dir.x, RAIL_TOP, v.body.position.z + dir.z);
      if (v.flip) v.body.rotateY(Math.PI);
      const sway = Math.sin(time * 1.3 + idx * 1.7) * 0.003 * Math.min(1, speed / 20) + Math.sin(time * 9 + idx) * 0.0012 * Math.min(1, speed / 25);
      v.body.rotateZ(sway); v.body.position.y += Math.sin(time * 11 + idx * 2) * 0.004 * Math.min(1, speed / 25);
      [fa, fb].forEach((f, bi) => {
        const b = v.bogies[bi].g; b.position.set(f.pos.x, RAIL_TOP, f.pos.z); b.lookAt(f.pos.x + f.fwd.x, RAIL_TOP, f.pos.z + f.fwd.z);
      });
      v.center = center;
    });
  }

  spin(dist) {
    const a = dist / 0.46;
    for (const v of this.vehicles) for (const b of v.bogies) for (const ws of b.sets) ws.rotation.x += a;
  }

  setDoors(open) { for (const d of this.doors) d.position.z = d.userData.z0 + d.userData.dir * open * 1.18; }

  setDials(kmh, brake, power) {
    const vals = [kmh, brake * 5, power * 10];
    this.dials.forEach((d, i) => { const a = Math.PI * 0.75 + U.clamp(vals[i] / d.max, 0, 1) * Math.PI * 1.5; d.needle.rotation.z = Math.atan2(-Math.cos(a), -Math.sin(a)); });
  }

  setNight(on) { this.lm.winLit.emissiveIntensity = on ? 1.4 : 0; this.cm.winLit.emissiveIntensity = on ? 1.4 : 0; }

  setHeadlights(on) { this.spot.intensity = on ? 7 : 0; this.lm.lamp.emissiveIntensity = on ? 3 : 1.2; }
}
