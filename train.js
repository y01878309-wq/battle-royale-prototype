'use strict';
/* Trains: a locomotive (or DMU cab car) plus a consist of coaches or wagons. Every vehicle sits on two
 * bogies that follow the track. Livery and shape come from a TRAIN_TYPES entry in data.js. */
class Train {
  constructor(scene, track, quality, type, ghost) {
    this.scene = scene; this.track = track; this.q = quality; this.type = type; this.ghost = !!ghost;   // a ghost is another player's train: no cab, dials or headlight beam
    this.vehicles = []; this.doors = []; this.cabMode = false; this.dialMax = Math.max(40, Math.ceil(type.vmax / 20) * 20);
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
    const L = { coach: 22.2, old: 20.4, talgo: 14.6, vcoach: 24, tank: 13.6, box: 13.6, flat: 13.6, hopper: 13.6, gond: 13.6, cont: 13.6, cab: type.loco.len };
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

  plane(map, w, h, x, y, z, ry, parent, basic) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic ? new THREE.MeshBasicMaterial({ map }) : new THREE.MeshStandardMaterial({ map, roughness: 0.55 }));
    m.position.set(x, y, z); m.rotation.y = ry || 0; parent.add(m); return m;
  }

  /* Locomotive, DMU cab car or high-speed power car.
   * kind 'ge'    sloped-nose diesel (GE ES40ACi style): body colour on top, a sweeping grey band, black skirt, chevron buffer beam
   * kind 'box'   flat-fronted box-cab diesel (Hitachi style)
   * kind 'velaro' streamlined electric power car
   * kind 'dmu'   diesel multiple unit cab car
   * 'driver' adds the cab interior, view anchors and the headlight beam. */
  buildLoco(spec, driver) {
    const M = this.lm, h = spec.len / 2, kind = spec.kind, dmu = kind === 'dmu', vel = kind === 'velaro', boxy = kind === 'box', diesel = !dmu && !vel;
    const body = new THREE.Group(), hull = new THREE.Group(), W = vel ? 2.95 : 3.0, X = W / 2 + 0.06;
    let prof, win;   // win: windscreen centre, size and tilt
    if (vel) { prof = [[-h, 0.9], [-h, 3.8], [-h + 0.5, 4.0], [h - 9, 4.0], [h - 4.2, 3.55], [h - 1.2, 2.45], [h, 1.7], [h, 0.9]]; win = { y: 3.0, z: h - 2.7, th: -Math.atan2(0.939, 0.344), w: 2.3, h: 2.5, n: [0.939, 0.344] }; }
    else if (boxy) { prof = [[-h, 1.0], [-h, 3.7], [-h + 0.4, 3.95], [h - 0.4, 3.95], [h, 3.7], [h, 1.0]]; win = { y: 3.25, z: h + 0.02, th: 0, w: 2.7, h: 1.2, n: [0, 1] }; }
    else { prof = [[-h, 1.0], [-h, 3.95], [-h + 0.3, 4.2], [h - 2.4, 4.2], [h, 2.6], [h, 1.0]]; win = { y: 3.4, z: h - 1.2, th: -Math.atan2(0.832, 0.555), w: 2.55, h: 2.1, n: [0.832, 0.555] }; }
    const main = vel ? M.cream : M.blue;
    const shell = new THREE.Mesh(this.extrudeBody(prof, W), main); shell.castShadow = true; shell.receiveShadow = true; hull.add(shell);
    if (diesel) {
      // sweeping grey band: flat along the hood, rising at the cab and dipping to the nose
      const bp = boxy ? [[-h, 1.45], [-h, 2.5], [h + 0.02, 2.5], [h + 0.02, 1.45]] : [[-h, 1.45], [-h, 2.5], [h - 9.5, 2.5], [h - 4.2, 2.95], [h + 0.02, 2.25], [h + 0.02, 1.45]];
      const band = new THREE.Mesh(this.extrudeBody(bp, W + 0.06), M.cream); band.castShadow = true; hull.add(band);
      this.box(W + 0.04, 0.5, spec.len + 0.1, M.dark, 0, 1.25, 0, hull);                       // black skirt and underframe
      this.box(W + 0.1, 0.05, spec.len + 0.1, M.yellow, 0, 2.53, 0, hull);                      // pinstripe on the band
      this.box(2.7, 0.14, spec.len * 0.82, M.roof, 0, boxy ? 3.99 : 4.26, -spec.len * 0.06, hull);
      for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 20), M.dark); f.position.set(0, boxy ? 4.1 : 4.4, -h + 1.8 + i * 2.6); hull.add(f); }
      this.box(1.6, 0.35, 3.2, M.roof, 0, boxy ? 4.15 : 4.45, -1.0, hull);
      for (const [i, ch] of [0.5, 0.62, 0.74, 0.62, 0.5].entries()) { const hn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, ch, 8), M.steel); hn.position.set(-0.4 + i * 0.2, (boxy ? 4.0 : 4.3) + ch / 2, h - (boxy ? 3 : 4.6)); hull.add(hn); }   // five-chime horn
      if (!boxy) this.box(1.0, 0.3, 2.0, M.roof, 0, 4.4, h - 7.4, hull);
    } else if (dmu) {
      this.box(3.2, 1.3, spec.len + 0.1, M.cream, 0, 1.72, 0, hull);
      this.box(3.21, 0.16, spec.len + 0.1, M.blue, 0, 1.18, 0, hull);
      this.box(3.21, 0.07, spec.len + 0.1, M.yellow, 0, 2.42, 0, hull);
      this.box(2.7, 0.14, spec.len * 0.82, M.roof, 0, 4.26, -spec.len * 0.06, hull);
      for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 20), M.dark); f.position.set(0, 4.4, -h + 1.8 + i * 2.6); hull.add(f); }
      this.box(1.6, 0.35, 3.2, M.roof, 0, 4.45, -1.0, hull);
    } else {
      // high-speed: dark skirt, accent stripe, roof gear
      this.box(W + 0.02, 0.45, spec.len - 0.2, M.dark, 0, 1.12, -0.1, hull);
      this.box(W + 0.03, 0.12, spec.len - 9.5, M.blue, 0, 2.25, -(spec.len - (spec.len - 9.5)) / 2 + 0.2, hull);
      this.box(1.8, 0.35, 5, M.roof, 0, 4.1, -4, hull);
    }
    // windscreen
    const wm = new THREE.MeshStandardMaterial({ map: Tex.louver(diesel), roughness: 0.08, metalness: 0.25, envMapIntensity: 1.8 });
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), wm);
    gl.position.set(0, win.y + win.n[0] * 0.12 * 0, win.z); if (!boxy) { gl.position.y = win.y + win.n[0] * 0.12; gl.position.z = win.z + win.n[1] * 0.12; } gl.rotation.x = win.th; hull.add(gl);
    if (boxy) { this.box(2.9, 0.1, 0.45, M.blue, 0, 3.92, h + 0.2, hull); }
    if (driver) this.glass = gl;
    // front lamps, tail lamps, buffer beam, buffers
    const lampY = vel ? 1.35 : 1.7, lampX = vel ? 0.95 : 1.0, lampZ = vel ? h + 0.02 : h + 0.1;
    for (const sx of [-lampX, lampX]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16), M.lamp); l.rotation.x = Math.PI / 2; l.position.set(sx, lampY, lampZ); hull.add(l); }
    if (!vel) { const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16), M.lamp); hl.rotation.x = Math.PI / 2; hl.position.set(0, boxy ? 2.2 : 2.45, h + 0.1); hl.visible = !boxy; hull.add(hl); }
    for (const sx of [-1.25, 1.25]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), M.redlamp); r.rotation.x = Math.PI / 2; r.position.set(sx, 1.7, -h - 0.1); hull.add(r); }
    if (!vel) {
      this.box(3.0, 0.5, 0.3, M.dark, 0, 1.08, h + 0.2, hull); this.box(3.0, 0.5, 0.3, M.dark, 0, 1.08, -h - 0.2, hull);
      this.plane(Tex.chevron(), 2.96, 0.46, 0, 1.08, h + 0.352, 0, hull, true); this.plane(Tex.chevron(), 2.96, 0.46, 0, 1.08, -h - 0.352, Math.PI, hull, true);
      for (const sx of [-1.0, 1.0]) for (const e of [-1, 1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 12), M.steel); b.rotation.x = Math.PI / 2; b.position.set(sx, 1.1, e * (h + 0.55)); hull.add(b); }
    }
    // sides
    const flag = Tex.flag(), face = (sx) => (sx > 0 ? Math.PI / 2 : -Math.PI / 2);
    for (const sx of [-1, 1]) {
      if (dmu) {
        for (let z = -h + 2.2; z < h - 6.5; z += 2.2) this.box(0.03, 1.0, 1.5, M.winLit, sx * 1.6, 2.9, z, hull);
      } else if (vel) {
        this.box(0.03, 0.95, spec.len - 15, M.winLit, sx * (W / 2 + 0.01), 3.1, -h + 8 + (spec.len - 15) / 2 - 0.5, hull);
        this.box(0.03, 0.8, 1.6, M.glass, sx * (W / 2 + 0.01), 3.2, h - 6.4, hull);
        for (const z of [-h + 2.4, h - 8.4]) { this.box(0.03, 2.35, 1.15, M.opening, sx * (W / 2 + 0.02), 2.2, z, hull); }
      } else {
        for (const z of [-h + 3.3, -h + 7.4]) this.plane(Tex.grille(3.4, 1.15), 3.4, 1.15, sx * 1.512, 3.5, z + (boxy ? 1.2 : 0), face(sx), hull);   // radiator and engine-room grilles
        this.box(0.03, 1.0, 1.9, M.glass, sx * 1.6, 3.35, h - 4.1, hull);
        this.box(0.03, 2.5, 1.1, M.dark, sx * 1.6, 2.5, h - 5.9, hull);
        this.box(0.03, 0.7, 1.0, M.glass, sx * 1.62, 3.55, h - 5.9, hull);
        for (const sy of [1.25, 1.85]) this.box(0.5, 0.05, 0.7, M.steel, sx * 1.8, sy, h - 5.9, hull);
        for (const z of [h - 6.55, h - 5.25]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6), M.steel); r.position.set(sx * 1.68, 2.55, z); hull.add(r); }
        this.plane(flag, 0.72, 0.48, sx * 1.612, 2.05, h - 9.4, face(sx), hull);
        for (let k = 0; k < 4; k++) this.box(0.02, 0.5, 0.9, M.dark, sx * 1.51, 1.2, -h + 2 + k * 3.6, hull);   // fuel-tank access panels
      }
      if (!vel) {
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.62), new THREE.MeshStandardMaterial({ map: Tex.sign('السكك الحديدية المصرية', 768, 104, '#8f1a22', '#f4f0e6'), roughness: 0.6 }));
        plate.position.set(sx * 1.605, 1.98, dmu ? -2 : -2.6); plate.rotation.y = face(sx); hull.add(plate);
      }
      const num = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), new THREE.MeshStandardMaterial({ map: Tex.sign(spec.num || (dmu ? '٧١٠٢' : '٣٠١٦'), 256, 116, '#1b1a19', '#f4f0e6'), roughness: 0.6 }));
      num.position.set(sx * (W / 2 + 0.105), vel ? 2.0 : 2.95, vel ? -h + 5 : h - 3.5); num.rotation.y = face(sx); hull.add(num);
      if (dmu) { const hn = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.55, 10), M.steel); hn.rotation.x = Math.PI / 2; hn.position.set(sx * 0.35, 4.42, h - 4); hull.add(hn); }
    }
    if (diesel) this.box(2.3, 0.7, 6.4, M.dark, 0, 0.78, 0, hull);
    if (!vel && !boxy) for (const wx of [-0.65, 0.65]) { const w = this.box(0.03, 0.9, 0.04, M.dark, wx, 3.4, h - 1.3, hull); w.rotation.x = 0.97; w.rotation.z = 0.5 * Math.sign(wx); }   // wipers
    body.add(hull);
    if (dmu || vel) this.addDoors(body, M, [-h + 2.4, h - 8.4], 2.3, 2.4);
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
      for (const [x, max, lab, big] of [[-0.75, this.dialMax, 'كم/س', 0.34], [-0.15, 10, 'بار', 0.26], [0.35, 10, 'قوة', 0.26]]) {
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
    const ax = dmu || vel ? 2 : 3, sp = dmu || vel ? 2.5 : 1.9;
    return { body, len: spec.len, bs: vel ? 17.4 : dmu ? 15.6 : 11.4, bogies: [this.makeBogie(ax, sp), this.makeBogie(ax, sp)], loco: driver };
  }

  /* Passenger coaches in three styles. */
  buildCoach(style, ci) {
    const M = this.cm, body = new THREE.Group();
    if (style === 'velaro') {
      const len = 24, W = 2.95, sh = new THREE.Mesh(this.extrudeBody([[-12, 0.9], [-12, 3.6], [-11.3, 3.95], [11.3, 3.95], [12, 3.6], [12, 0.9]], W), M.cream);
      sh.castShadow = true; sh.receiveShadow = true; body.add(sh);
      this.box(W + 0.02, 0.45, len - 0.3, M.dark, 0, 1.12, 0, body);
      this.box(W + 0.03, 0.12, len - 0.4, M.blue, 0, 2.25, 0, body);
      for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) this.box(0.03, 0.95, 2.4, M.winLit, sx * (W / 2 + 0.01), 3.1, -8.0 + k * 3.2, body);
      this.addDoors(body, M, [-10.4, 10.4], 2.3, 2.4);
      this.box(1.9, 0.3, len - 3, M.roof, 0, 4.0, 0, body);
      if (ci % 3 === 1) {   // pantograph
        this.box(1.4, 0.25, 2.0, M.dark, 0, 4.2, 2, body);
        for (const e of [-1, 1]) { const arm = this.box(0.06, 1.7, 0.06, M.steel, 0, 5.05, 2 + e * 0.5, body); arm.rotation.x = e * 0.55; }
        this.box(1.7, 0.06, 0.12, M.steel, 0, 5.85, 2, body);
      }
      this.scene.add(body);
      return { body, len, bs: 17.4, bogies: [this.makeBogie(2, 2.5), this.makeBogie(2, 2.5)], loco: false };
    }
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

  /* Freight wagons: tank, covered box, hopper, open gondola, flat car with containers. */
  buildWagon(kind, i) {
    const M = this.cm, body = new THREE.Group(), len = 13.6;
    const mat = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r === undefined ? 0.65 : r, metalness: m === undefined ? 0.15 : m });
    this.box(3.0, 0.4, len, M.dark, 0, 1.1, 0, body);
    for (const e of [-1, 1]) for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.45, 10), M.steel); b.rotation.x = Math.PI / 2; b.position.set(sx * 1.0, 1.15, e * (len / 2 + 0.3)); body.add(b); }
    if (kind === 'tank') {
      const cols = [0x2b2b2a, 0x4a4f54, 0x6d2a22, 0x3a4b3d];
      const g = new THREE.CylinderGeometry(1.3, 1.3, len - 1.6, 20); g.rotateX(Math.PI / 2);
      const t = new THREE.Mesh(g, mat(cols[i % cols.length], 0.5, 0.4)); t.position.y = 2.55; t.castShadow = true; body.add(t);
      this.box(0.8, 0.3, 0.8, M.dark, 0, 3.9, 0, body);
      this.box(0.5, 0.06, len - 2.5, M.steel, 0, 3.86, 0, body);      // walkway
      for (const sx of [-1, 1]) this.box(0.06, 1.5, 0.5, M.steel, sx * 1.55, 2.1, len / 2 - 1.2, body);   // ladder
    } else if (kind === 'box') {
      const cols = [0xcdc7b6, 0x8f3a2e, 0x4c6a8c, 0x6b4a35];
      const bm = mat(cols[i % cols.length], 0.7);
      this.box(2.9, 2.8, len - 1, bm, 0, 2.7, 0, body);
      for (const sx of [-1, 1]) { this.box(0.06, 2.4, 2.4, M.dark, sx * 1.46, 2.7, 0, body); this.box(0.07, 2.4, 0.08, M.steel, sx * 1.47, 2.7, 1.2, body); this.box(0.07, 2.4, 0.08, M.steel, sx * 1.47, 2.7, -1.2, body); }
      this.box(3.0, 0.14, len - 0.6, M.roof, 0, 4.15, 0, body);
    } else if (kind === 'hopper') {
      const cols = [0xcfc8b4, 0x7a7a74, 0x8a5a38], c = cols[i % cols.length];
      this.box(3.0, 1.5, len - 1.2, mat(c, 0.75), 0, 3.4, 0, body);
      for (const z of [-3.3, 3.3]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(1.98, 0.45, 1.3, 4, 1), mat(c, 0.75)); f.rotation.y = Math.PI / 4; f.scale.z = 2.0; f.position.set(0, 1.95, z); f.castShadow = true; body.add(f); }
      for (const z of [-3.3, 3.3]) this.box(0.8, 0.12, 0.8, M.dark, 0, 4.18, z, body);   // loading hatches
    } else if (kind === 'gond') {
      const cols = [0x5a4a3a, 0x3f4b57, 0x6a3b2a], c = cols[i % cols.length];
      this.box(3.0, 0.2, len, mat(c), 0, 1.35, 0, body);
      for (const sx of [-1, 1]) this.box(0.12, 1.9, len, mat(c), sx * 1.44, 2.35, 0, body);
      for (const e of [-1, 1]) this.box(3.0, 1.9, 0.12, mat(c), 0, 2.35, e * (len / 2 - 0.06), body);
      const pile = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.9, len - 1.0), mat(i % 2 ? 0x1b1a19 : 0x8a8579, 0.95, 0)); pile.position.y = 2.7; body.add(pile);   // coal or aggregate
    } else {
      const cols = ['#2a4f86', '#c8571a', '#3c7a4a', '#a8262d', '#d8d3c6', '#5d646b'], labels = ['NILE', 'DELTA', 'SUEZ', 'CAIRO', 'ALEX', 'SINAI'];
      this.box(2.6, 0.12, len - 0.4, M.dark, 0, 1.36, 0, body);
      for (const z of [-3.3, 3.3]) {
        const k = (i + (z > 0 ? 2 : 0)) % cols.length, cm = new THREE.MeshStandardMaterial({ color: cols[k], roughness: 0.6, metalness: 0.2 });
        this.box(2.5, 2.6, 6.0, cm, 0, 2.72, z, body);
        for (const sx of [-1, 1]) this.plane(Tex.container(cols[k], labels[k]), 5.9, 2.5, sx * 1.255, 2.72, z, sx > 0 ? Math.PI / 2 : -Math.PI / 2, body);
      }
    }
    this.scene.add(body);
    return { body, len, bs: 9.4, bogies: [this.makeBogie(2, 1.8), this.makeBogie(2, 1.8)], loco: false };
  }

  build() {
    this.loco = this.buildLoco(this.type.loco, !this.ghost); this.vehicles.push(this.loco);
    this.type.consist.forEach((k, i) => {
      let v;
      if (k === 'cab') { v = this.buildLoco(this.type.loco, false); v.flip = true; }
      else if (['tank', 'box', 'flat', 'cont', 'hopper', 'gond'].includes(k)) v = this.buildWagon(k, i);
      else v = this.buildCoach(k === 'old' ? 'old' : k === 'talgo' ? 'talgo' : k === 'vcoach' ? 'velaro' : 'std', i);
      this.vehicles.push(v);
    });
    this.length = this.vehicles.reduce((a, v) => a + v.len + 0.9, 0);
    this.vehicles.forEach((v) => v.body.traverse((o) => { if (o.isMesh) o.castShadow = true; }));
    this.fa = Track.makeFrame(); this.fb = Track.makeFrame(); this.tmp = new THREE.Vector3();
  }

  setCabView(on) { this.cabMode = on; this.locoHull.visible = !on; this.cab.visible = on; }

  /* Place every vehicle. sHead is the distance of the loco's front buffer. */
  place(sHead, time, speed, derailT) {
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
      // derailment: each vehicle tips over in turn, starting with the locomotive, and slides off to one side
      let k = 0; if (derailT > 0) { k = U.clamp((derailT - idx * 0.22) / 1.4, 0, 1); k = k * k * (3 - 2 * k); if (k > 0) { v.body.rotateZ(k * 1.4); v.body.translateX(-k * 1.3); v.body.position.y -= k * 0.15; } }
      [fa, fb].forEach((f, bi) => {
        const b = v.bogies[bi].g; b.position.set(f.pos.x, RAIL_TOP, f.pos.z); b.lookAt(f.pos.x + f.fwd.x, RAIL_TOP, f.pos.z + f.fwd.z);
        if (k > 0) { b.rotateZ(k * 1.25); b.translateX(-k * 1.0); }
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
    if (!this.dials) return;
    this.dials.forEach((d, i) => { const a = Math.PI * 0.75 + U.clamp(vals[i] / d.max, 0, 1) * Math.PI * 1.5; d.needle.rotation.z = Math.atan2(-Math.cos(a), -Math.sin(a)); });
  }

  setNight(on) { this.lm.winLit.emissiveIntensity = on ? 1.4 : 0; this.cm.winLit.emissiveIntensity = on ? 1.4 : 0; }

  setHeadlights(on) { if (this.spot) this.spot.intensity = on ? 7 : 0; this.lm.lamp.emissiveIntensity = on ? 3 : 1.2; }
}
