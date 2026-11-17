'use strict';
/* Trains: a locomotive (or DMU cab car) plus a consist of coaches or wagons. Every vehicle sits on two
 * bogies that follow the track. Livery and shape come from a TRAIN_TYPES entry in data.js. */
class Train {
  constructor(scene, track, quality, type, ghost) {
    this.scene = scene; this.track = track; this.q = quality; this.type = type; this.ghost = !!ghost;   // a ghost is another player's train: no cab, dials or headlight beam
    this.vehicles = []; this.doors = []; this.cabMode = false; this.dialMax = Math.max(40, Math.ceil(type.vmax / 20) * 20);
    /* MeshStandardMaterial, not Physical: the clear-coat shader fails to compile on some phones, and then the whole painted body is invisible (only its shadow shows). */
    const paint = (hex, cc) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.4 - 0.1 * cc, metalness: 0.2 });
    const common = {
      glass: new THREE.MeshStandardMaterial({ map: Tex.glassRefl(), color: 0xffffff, roughness: 0.04, metalness: 0.45, envMapIntensity: 2.4 }),
      winLit: new THREE.MeshStandardMaterial({ map: Tex.glassRefl(), color: 0xffffff, roughness: 0.05, metalness: 0.45, envMapIntensity: 2.4, emissive: 0xc89a55, emissiveIntensity: 0 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.65, metalness: 0.4 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.45, metalness: 0.85 }),
      roof: new THREE.MeshStandardMaterial({ color: 0xa6a69f, roughness: 0.7, metalness: 0.2 }),
      lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 1.2 }),
      redlamp: new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2010, emissiveIntensity: 1.0 }),
      opening: new THREE.MeshStandardMaterial({ color: 0x0b0a08, roughness: 1 })
    };
    this.lm = Object.assign({ blue: paint(type.loco.top, 0.8), cream: paint(type.loco.low, 0.5), yellow: new THREE.MeshStandardMaterial({ color: type.loco.trim, roughness: 0.5 }) }, common);
    this.cm = Object.assign({ blue: paint(type.coach.band, 0.8), cream: paint(type.coach.body, 0.5), yellow: new THREE.MeshStandardMaterial({ color: type.coach.trim, roughness: 0.5 }) }, common);
    this.cabStyle = Train.cabStyleFor(type);
    this.build();
  }

  /* Which interior this train shows: the metro always has its own; otherwise the one the player picked in the store (the terracotta one is gems-only). */
  static cabStyleFor(type) {
    if (type.loco.kind === 'metro') return 'metro';
    try { if (localStorage.getItem('qs-cab') === 'ge') return 'ge'; } catch (e) { /* */ }
    return 'terra';
  }

  /* Total length in metres, known before anything is built (the route needs it for platforms). */
  static lengthOf(type) {
    const L = { coach: 22.2, old: 20.4, talgo: 14.6, vcoach: 24, tank: 13.6, box: 13.6, flat: 13.6, hopper: 13.6, gond: 13.6, cont: 13.6, cab: type.loco.len, mcoach: type.loco.len };
    return type.loco.len + type.consist.reduce((a, k) => a + (L[k] || 22.2) + 0.9, 0);
  }

  extrudeBody(pts, width) {
    const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: width - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, steps: 1 });
    g.translate(0, 0, -(width - 0.16) / 2); g.rotateY(-Math.PI / 2);   // shape x -> train z (forward), width -> x
    return g;
  }

  /* Smooth hull: loft a rounded cross-section along the train. prof is the side profile polygon (z, y); the cross-section is a rounded box (super-ellipse), the ends narrow
   * slightly in plan. UVs are (z along the length, y up to 4.5 m) so a livery canvas can be painted in side-view coordinates. */
  bodyLoft(prof, W, nExp, plan) {
    const pts = prof, zmin = pts[0][0], zmax = pts[pts.length - 1][0], bot = Math.min(...pts.map((p) => p[1])), path = pts.slice(1, -1), L = zmax - zmin;
    const top = (z) => { for (let i = 0; i < path.length - 1; i++) { const a = path[i], b = path[i + 1]; if (z >= Math.min(a[0], b[0]) - 1e-6 && z <= Math.max(a[0], b[0]) + 1e-6 && Math.abs(b[0] - a[0]) > 1e-6) return a[1] + (b[1] - a[1]) * (z - a[0]) / (b[0] - a[0]); } return path[path.length - 1][1]; };
    const NS = Math.max(24, Math.round(L * 3.5)), M = 40, pos = [], uv = [], idx = [], n = nExp || 5, ex = 2 / n, taperLen = 1.0, minF = plan === undefined ? 0.8 : plan;
    for (let i = 0; i <= NS; i++) {
      const z = zmin + L * i / NS, y1 = top(z), hh = y1 - bot, ym = (y1 + bot) / 2, d = Math.min(z - zmin, zmax - z), f = d >= taperLen ? 1 : Math.sqrt(1 - Math.pow(1 - d / taperLen, 2) * (1 - minF * minF));
      for (let j = 0; j < M; j++) { const a = j / M * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pos.push(Math.sign(c) * Math.pow(Math.abs(c), ex) * W / 2 * f, ym + Math.sign(s) * Math.pow(Math.abs(s), ex) * hh / 2, z); uv.push((z - zmin) / L, (ym + Math.sign(s) * Math.pow(Math.abs(s), ex) * hh / 2) / 4.5); }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < M; j++) { const a = i * M + j, b = i * M + (j + 1) % M, c = (i + 1) * M + j, d2 = (i + 1) * M + (j + 1) % M; idx.push(a, b, c, b, d2, c); }
    for (const [i, flip] of [[0, false], [NS, true]]) {   // end caps
      const base = pos.length / 3; let cy = 0, cz = zmin + L * i / NS; for (let j = 0; j < M; j++) cy += pos[(i * M + j) * 3 + 1]; cy /= M; pos.push(0, cy, cz); uv.push(i ? 1 : 0, cy / 4.5);
      for (let j = 0; j < M; j++) { const a = i * M + j, b = i * M + (j + 1) % M; if (flip) idx.push(base, a, b); else idx.push(base, b, a); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }

  /* Livery painted in side-view coordinates for bodyLoft (z from -len/2 to len/2, y 0..4.5). regions: [[colour, [[z,y]...]], ...] painted in order over a base colour. */
  liveryTex(len, base, regions) {
    const W = 1024, H = 256, c = U.canvas(W, H), g = c.getContext('2d'), X = (z) => (z + len / 2) / len * W, Y = (y) => H - y / 4.5 * H, hex = (v) => '#' + ('000000' + v.toString(16)).slice(-6);
    g.fillStyle = hex(base); g.fillRect(0, 0, W, H);
    for (const [col, poly, line] of regions) { g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); if (line) { g.strokeStyle = hex(col); g.lineWidth = line * H / 4.5; g.stroke(); } else { g.fillStyle = hex(col); g.fill(); } }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
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
    if (spec.kind === 'metro') return this.buildMetroCar(spec, driver, true);
    const M = this.lm, h = spec.len / 2, kind = spec.kind, dmu = kind === 'dmu', vel = kind === 'velaro', hood = kind === 'hood', boxy = kind === 'box' || hood, diesel = !dmu && !vel, ry = hood ? -0.8 : 0;
    const body = new THREE.Group(), hull = new THREE.Group(), W = vel ? 2.95 : 3.0, X = W / 2 + 0.06;
    let prof, win;   // win: windscreen centre, size and tilt
    if (vel) { prof = [[-h, 0.9], [-h, 3.8], [-h + 0.5, 4.0], [h - 9, 4.0], [h - 4.2, 3.55], [h - 1.2, 2.45], [h, 1.7], [h, 0.9]]; win = { y: 3.0, z: h - 2.7, th: -Math.atan2(0.939, 0.344), w: 2.3, h: 2.5, n: [0.939, 0.344] }; }
    else if (hood) { prof = [[-h, 1.0], [-h, 3.2], [-h + 0.3, 3.4], [h - 4.6, 3.4], [h - 4.6, 4.25], [h - 0.3, 4.25], [h, 3.95], [h, 1.0]]; win = { y: 3.45, z: h + 0.02, th: 0, w: 2.2, h: 1.15, n: [0, 1] }; }
    else if (boxy) { prof = [[-h, 1.0], [-h, 3.7], [-h + 0.4, 3.95], [h - 0.4, 3.95], [h, 3.7], [h, 1.0]]; win = { y: 3.25, z: h + 0.02, th: 0, w: 2.2, h: 1.2, n: [0, 1] }; }
    else { prof = [[-h, 1.0], [-h, 3.95], [-h + 0.3, 4.2], [h - 2.4, 4.2], [h, 2.6], [h, 1.0]]; win = { y: 3.4, z: h - 1.2, th: -Math.atan2(0.832, 0.555), w: 2.55, h: 2.1, n: [0.832, 0.555] }; }
    const main = vel ? M.cream : M.blue;
    const loftOn = diesel;
    let shell; const loftD = dmu && !loftOn;
    if (vel) {
      const tex = this.liveryTex(spec.len, spec.top, [[0x59606a, [[-h - 1, 0.8], [h + 1, 0.8], [h + 1, 1.3], [-h - 1, 1.3]]], [spec.trim, [[-h - 1, 1.55], [h - 3, 1.55], [h + 1, 1.2]], 0.1]]);
      shell = new THREE.Mesh(this.bodyLoft(prof, W, 5, 0.86), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.3 }));
    } else if (loftD) {
      const tex = this.liveryTex(spec.len, spec.top, [[spec.low, [[-h - 1, 1.07], [h + 1, 1.07], [h + 1, 2.37], [-h - 1, 2.37]]], [spec.trim, [[-h - 1, 2.42], [h + 1, 2.42]], 0.07], [0x1b1a19, [[-h - 1, 0.9], [h + 1, 0.9], [h + 1, 1.07], [-h - 1, 1.07]]]]);
      shell = new THREE.Mesh(this.bodyLoft(prof, W, 5, 0.9), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.38, metalness: 0.25 }));
    } else if (loftOn) {
      const bp = boxy ? [[-h, 1.45], [-h, 2.5], [h + 0.02, 2.5], [h + 0.02, 1.45]] : [[-h, 1.45], [-h, 2.5], [h - 9.5, 2.5], [h - 4.2, 2.95], [h + 0.02, 2.25], [h + 0.02, 1.45]];
      const tex = this.liveryTex(spec.len, spec.top, [[spec.low, bp], [0x1b1a19, [[-h - 1, 0.9], [h + 1, 0.9], [h + 1, 1.45], [-h - 1, 1.45]]], [spec.trim, boxy ? [[-h, 2.5], [h + 0.02, 2.5]] : [[-h, 2.5], [h - 9.5, 2.5], [h - 4.2, 2.95], [h + 0.02, 2.25]], 0.06]]);
      shell = new THREE.Mesh(this.bodyLoft(prof, W, boxy ? 4.4 : 5.5, boxy ? 0.8 : 0.9), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.38, metalness: 0.25 }));
    } else shell = new THREE.Mesh(this.extrudeBody(prof, W), main);
    shell.castShadow = true; shell.receiveShadow = true; hull.add(shell);
    if (diesel) {
      // sweeping grey band: flat along the hood, rising at the cab and dipping to the nose
      const bp = boxy ? [[-h, 1.45], [-h, 2.5], [h + 0.02, 2.5], [h + 0.02, 1.45]] : [[-h, 1.45], [-h, 2.5], [h - 9.5, 2.5], [h - 4.2, 2.95], [h + 0.02, 2.25], [h + 0.02, 1.45]];
      if (!loftOn) { const band = new THREE.Mesh(this.extrudeBody(bp, W + 0.06), M.cream); band.castShadow = true; hull.add(band);
      this.box(W + 0.04, 0.5, spec.len + 0.1, M.dark, 0, 1.25, 0, hull);                       // black skirt and underframe
      this.box(W + 0.1, 0.05, spec.len + 0.1, M.yellow, 0, 2.53, 0, hull); } else this.box(2.4, 0.5, spec.len - 1.2, M.dark, 0, 0.92, 0, hull);   // livery is painted on the hull; underframe tank
      this.box(2.7, 0.14, spec.len * (hood ? 0.62 : 0.82), M.roof, 0, (boxy ? 3.99 : 4.26) + ry, hood ? -spec.len * 0.17 : -spec.len * 0.06, hull);
      for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 20), M.dark); f.position.set(0, (boxy ? 4.1 : 4.4) + ry, -h + 1.8 + i * 2.6); hull.add(f); const gr = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 6, 24), M.steel); gr.rotation.x = Math.PI / 2; gr.position.set(0, (boxy ? 4.19 : 4.49) + ry, -h + 1.8 + i * 2.6); hull.add(gr); }
      this.box(1.6, 0.35, 3.2, M.roof, 0, (boxy ? 4.15 : 4.45) + ry, hood ? -h + 9 : -1.0, hull);
      for (const [i, ch] of [0.5, 0.62, 0.74, 0.62, 0.5].entries()) { const hn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, ch, 8), M.steel); hn.position.set(-0.4 + i * 0.2, (hood ? 4.25 : boxy ? 4.0 : 4.3) + ch / 2, h - (boxy ? 3 : 4.6)); hull.add(hn); }   // five-chime horn
      if (!boxy) this.box(1.0, 0.3, 2.0, M.roof, 0, 4.4, h - 7.4, hull);
    } else if (dmu) {
      if (!loftD) { this.box(3.2, 1.3, spec.len + 0.1, M.cream, 0, 1.72, 0, hull);
      this.box(3.21, 0.16, spec.len + 0.1, M.blue, 0, 1.18, 0, hull);
      this.box(3.21, 0.07, spec.len + 0.1, M.yellow, 0, 2.42, 0, hull); } else this.box(2.4, 0.5, spec.len - 1.2, M.dark, 0, 0.92, 0, hull);
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
    const wm = new THREE.MeshStandardMaterial({ map: Tex.glassRefl(), roughness: 0.05, metalness: 0.45, envMapIntensity: 2.2 });
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), wm);
    gl.position.set(0, win.y + win.n[0] * 0.12 * 0, win.z); if (!boxy) { gl.position.y = win.y + win.n[0] * 0.12; gl.position.z = win.z + win.n[1] * 0.12; } gl.rotation.x = win.th; hull.add(gl);
    if (boxy) { this.box(2.9, 0.1, 0.45, M.blue, 0, hood ? 4.2 : 3.92, h + 0.2, hull); }
    if (driver) this.glass = gl;
    // front lamps, tail lamps, buffer beam, buffers
    const lampY = vel ? 1.35 : 1.7, lampX = vel ? 0.95 : ((loftOn || loftD) && !boxy ? 0.68 : 1.0), lampZ = vel ? h + 0.02 : ((loftOn || loftD) && !boxy ? h + 0.02 : h + 0.1);
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
        if (hood) {   // long hood behind a tall cab at the front: grilles on the hood, cab window and door at the front
          for (const z of [-h + 2.6, -h + 6.2]) this.plane(Tex.grille(3.2, 1.0), 3.2, 1.0, sx * 1.512, 2.5, z, face(sx), hull);
          this.box(0.025, 1.14, 2.34, M.dark, sx * 1.595, 3.6, h - 2.3, hull); this.box(0.03, 1.0, 2.2, M.glass, sx * 1.612, 3.6, h - 2.3, hull);
          this.box(0.03, 2.3, 0.9, M.dark, sx * 1.6, 2.3, h - 4.2, hull);
          for (const sy of [1.25, 1.85]) this.box(0.5, 0.05, 0.7, M.steel, sx * 1.8, sy, h - 4.2, hull);
          for (const z of [h - 4.75, h - 3.65]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6), M.steel); r.position.set(sx * 1.68, 2.4, z); hull.add(r); }
        } else {
        for (const z of [-h + 3.3, -h + 7.4]) this.plane(Tex.grille(3.4, 1.15), 3.4, 1.15, sx * 1.512, 3.5, z + (boxy ? 1.2 : 0), face(sx), hull);   // radiator and engine-room grilles
        this.box(0.025, 1.14, 2.04, M.dark, sx * 1.595, 3.35, h - 4.1, hull); this.box(0.03, 1.0, 1.9, M.glass, sx * 1.612, 3.35, h - 4.1, hull);
        this.box(0.03, 2.5, 1.1, M.dark, sx * 1.6, 2.5, h - 5.9, hull);
        this.box(0.025, 0.84, 1.14, M.dark, sx * 1.612, 3.55, h - 5.9, hull); this.box(0.03, 0.7, 1.0, M.glass, sx * 1.628, 3.55, h - 5.9, hull);
        for (const sy of [1.25, 1.85]) this.box(0.5, 0.05, 0.7, M.steel, sx * 1.8, sy, h - 5.9, hull);
        for (const z of [h - 6.55, h - 5.25]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6), M.steel); r.position.set(sx * 1.68, 2.55, z); hull.add(r); }
        }
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
    if (!vel) {   // mirrors, coupler, air hoses, stanchions
      const mz = boxy ? h - 0.9 : h - 2.9, my = boxy ? 3.4 : 3.2;
      for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 6), M.steel); arm.rotation.z = Math.PI / 2; arm.position.set(sx * (W / 2 + 0.12), my, mz); hull.add(arm);
        const mir = this.box(0.04, 0.3, 0.2, M.dark, sx * (W / 2 + 0.28), my, mz, hull); const gl = this.box(0.01, 0.26, 0.17, M.glass, sx * (W / 2 + 0.3), my, mz, hull);
        for (const e of [0.12, -0.12]) { const hs = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8), M.dark); hs.position.set(sx * 0.62 + e * 0.5, 1.08, h + 0.34); hs.rotation.x = 0.5; hull.add(hs); }
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.9, 6), M.steel); st.position.set(sx * 1.32, 1.75, h + 0.12); hull.add(st);
      }
      this.box(0.34, 0.3, 0.75, M.dark, 0, 1.02, h + 0.5, hull);
      const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 10), M.steel); kn.position.set(0, 1.02, h + 0.9); kn.rotation.x = Math.PI / 2; hull.add(kn);
    }
    if (dmu || vel) this.addDoors(body, M, [-h + 2.4, h - 8.4], 2.3, 2.4);
    let eye = null, nose = null;
    if (driver) {
      this.locoHull = hull;
      const cab = new THREE.Group(), ic = new THREE.MeshStandardMaterial({ color: 0xcdb089, roughness: 0.92 }), dk = new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 0.7 }), wood = new THREE.MeshStandardMaterial({ color: 0x6d4a30, roughness: 0.75 }), trimM = new THREE.MeshStandardMaterial({ color: 0x8a5a2c, roughness: 0.8 });
      this.cabShell(cab, this.cabStyle);
      const ey = new THREE.Vector3(-0.75, 3.05, 5.0);
      this.dials = [];
      for (const [x, max, lab, big] of [[-0.75, this.dialMax, 'كم/س', 0.34], [-0.15, 10, 'بار', 0.26], [0.35, 10, 'قوة', 0.26]]) {
        const grp = new THREE.Group(); grp.position.set(x, 2.58, 6.2);
        grp.add(new THREE.Mesh(new THREE.PlaneGeometry(big, big), new THREE.MeshBasicMaterial({ map: Tex.dial(max, lab), transparent: true })));
        const needle = new THREE.Group(), nm = new THREE.Mesh(new THREE.BoxGeometry(0.008, big * 0.4, 0.002), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
        nm.position.y = big * 0.2; needle.add(nm); needle.position.z = 0.003; grp.add(needle);
        cab.add(grp); grp.lookAt(ey.x, ey.y, ey.z); this.dials.push({ needle, max });
      }
      this.buildCabControls(cab);
      if (this.cabStyle !== 'metro') this.dials.forEach((d) => { d.needle.parent.visible = false; });   // the GE cab shows speed on its display, not on round dials
      cab.position.z = h - 9.8; cab.visible = false; body.add(cab); this.cab = cab;
      eye = new THREE.Object3D(); eye.position.set(ey.x, ey.y, ey.z + h - 9.8); eye.rotation.y = Math.PI; body.add(eye);
      nose = new THREE.Object3D(); nose.position.set(0, 1.6, h + 0.6); nose.rotation.y = Math.PI; body.add(nose);
      this.spot = new THREE.SpotLight(0xffe9c0, 0, 120, 0.30, 0.7, 2.6); this.spot.position.set(0, 1.5, h + 2.2); this.spot.target.position.set(0, 0.3, h + 60);
      body.add(this.spot, this.spot.target);
      this.eye = eye; this.nose = nose;
    }
    this.finish(hull, spec.len, W, 1.0, 3.9);
    this.scene.add(body);
    const ax = dmu || vel ? 2 : 3, sp = dmu || vel ? 2.5 : 1.9;
    return { body, len: spec.len, bs: vel ? 17.4 : dmu ? 15.6 : 11.4, bogies: [this.makeBogie(ax, sp), this.makeBogie(ax, sp)], loco: driver };
  }

  /* Finishing pass for every loco and coach: weathering overlay on both sides, underframe tanks and boxes, roof walkway strip. */
  finish(body, len, W, y0, y1) {
    const tex = Tex.weather().clone(); tex.needsUpdate = true; tex.repeat.set(Math.max(1, len / 8), 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.3, y1 - y0), mat); p.position.set(sx * (W / 2 + 0.115), (y0 + y1) / 2, 0); p.rotation.y = sx * Math.PI / 2; p.renderOrder = 2; body.add(p); }
    const M = this.lm, tank = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.6, metalness: 0.5 });
    for (let k = 0; k < 2; k++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.5, 12), tank); t.rotation.x = Math.PI / 2; t.position.set(-0.7 + k * 1.4, 0.82, -len * 0.18 + k * len * 0.1); body.add(t); }
    this.box(0.9, 0.35, 1.2, M.dark, 0.3, 0.78, len * 0.12, body);
    for (const sx of [-1, 1]) { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len * 0.5, 6), M.steel); pipe.rotation.x = Math.PI / 2; pipe.position.set(sx * 0.5, 0.66, 0); body.add(pipe); }
  }

  /* Cairo-metro style car: rounded black glass nose on the driving cars, doors and big windows along the sides, coloured stripes. */
  buildMetroCar(spec, driver, cab) {
    const M = driver || cab ? this.lm : this.cm, h = spec.len / 2, W = 2.9, body = new THREE.Group(), root = new THREE.Group(); root.add(body);
    const lo = driver || cab, bodyM = lo ? this.lm.cream : this.cm.cream, band = lo ? this.lm.blue : this.cm.blue, trim = lo ? this.lm.yellow : this.cm.yellow;
    const prof = cab ? [[-h, 0.95], [-h, 3.55], [-h + 0.3, 3.68], [h - 1.9, 3.68], [h - 0.55, 3.3], [h, 2.55], [h, 0.95]] : [[-h, 0.95], [-h, 3.55], [-h + 0.3, 3.68], [h - 0.3, 3.68], [h, 3.55], [h, 0.95]];
    const lt = this.liveryTex(spec.len, bodyM.color.getHex(), [[0x2a2c2f, [[-h - 1, 0.9], [h + 1, 0.9], [h + 1, 1.35], [-h - 1, 1.35]]], [band.color.getHex(), [[-h - 1, 1.47], [h + 1, 1.47], [h + 1, 1.73], [-h - 1, 1.73]]], [trim.color.getHex(), [[-h - 1, 1.86], [h + 1, 1.86]], 0.07]]);
    const shell = new THREE.Mesh(this.bodyLoft(prof, W, 5, cab ? 0.9 : 1), new THREE.MeshStandardMaterial({ map: lt, roughness: 0.38, metalness: 0.25 })); shell.castShadow = true; shell.receiveShadow = true; body.add(shell);
    this.box(2.3, 0.4, spec.len - 1.2, M.dark, 0, 0.98, 0, body);                           // underframe
    const winY = 2.75, winH = 1.0;
    const zs = [-h * 0.72, -h * 0.24, h * 0.24, h * 0.72];
    for (const sx of [-1, 1]) {
      for (let k = -4; k <= 4; k++) {   // windows between the doors, with dark frames
        const z = k * (spec.len / 9);
        if (zs.some((d) => Math.abs(d - z) < 1.6) || (cab && z > h - 3.2)) continue;
        this.box(0.02, winH + 0.12, 1.42, M.dark, sx * (W / 2 + 0.015), winY, z, body);
        this.box(0.03, winH, 1.3, M.winLit, sx * (W / 2 + 0.03), winY, z, body);
      }
    }
    this.addDoors(body, M, zs.filter((z) => !(cab && z > h - 3.2)), 2.15, 2.3);
    this.box(2.2, 0.3, spec.len - 3, M.roof, 0, 3.75, 0, body);                            // roof air-conditioning pods
    for (let k = 0; k < 3; k++) this.box(1.4, 0.18, 2.2, M.roof, 0, 3.92, -spec.len * 0.3 + k * spec.len * 0.3, body);
    for (const e of [-1, 1]) { if (cab && e > 0) continue; this.box(2.4, 2.1, 0.2, M.dark, 0, 2.3, e * (h + 0.05), body); }   // gangway
    let eye = null, nose = null;
    if (cab) {
      // black glass front over the slope, yellow destination strip, headlights and tail lights
      const fr = new THREE.Mesh(this.extrudeBody([[h - 1.92, 3.7], [h - 0.55, 3.32], [h + 0.02, 2.56], [h + 0.02, 1.3], [h - 1.92, 1.3]], W - 0.5), new THREE.MeshStandardMaterial({ color: 0x35566e, roughness: 0.1, metalness: 0.85 })); fr.castShadow = true; body.add(fr);
      this.box(W - 0.9, 0.06, 0.05, new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd21f, emissiveIntensity: 1.4 }), 0, 3.12, h - 0.34, body).rotation.x = -0.55;
      for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 16), M.lamp); l.rotation.x = Math.PI / 2; l.position.set(sx * 0.95, 1.55, h + 0.06); body.add(l); }
      this.box(W - 0.2, 0.2, 0.1, trim, 0, 1.34, h + 0.04, body);
      this.box(0.04, 1.15, 0.05, M.dark, 0, 2.2, h + 0.045, body);
      if (driver) {
        this.locoHull = body; const cabG = new THREE.Group(); this.cabStyle = 'metro';
        this.cabShell(cabG, 'metro'); this.cabParts = cabG;
        const ey = new THREE.Vector3(-0.75, 3.05, 5.0), ofs = h - 9.8;
        this.dials = [];
        for (const [x, max, lab, big] of [[-0.75, this.dialMax, 'كم/س', 0.34], [-0.15, 10, 'بار', 0.26], [0.35, 10, 'قوة', 0.26]]) {
          const grp = new THREE.Group(); grp.position.set(x, 2.58, 6.2);
          grp.add(new THREE.Mesh(new THREE.PlaneGeometry(big, big), new THREE.MeshBasicMaterial({ map: Tex.dial(max, lab), transparent: true })));
          const needle = new THREE.Group(), nm = new THREE.Mesh(new THREE.BoxGeometry(0.008, big * 0.4, 0.002), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
          nm.position.y = big * 0.2; needle.add(nm); needle.position.z = 0.003; grp.add(needle); cabG.add(grp); grp.lookAt(ey.x, ey.y, ey.z); this.dials.push({ needle, max });
        }
        this.buildCabControls(cabG);
        cabG.position.z = ofs; cabG.visible = false; root.add(cabG); this.cab = cabG; this.metroRoot = root;
        eye = new THREE.Object3D(); eye.position.set(ey.x, ey.y, ey.z + ofs); eye.rotation.y = Math.PI; root.add(eye);
        nose = new THREE.Object3D(); nose.position.set(0, 1.6, h + 0.6); nose.rotation.y = Math.PI; root.add(nose);
        this.spot = new THREE.SpotLight(0xffe9c0, 0, 120, 0.30, 0.7, 2.6); this.spot.position.set(0, 1.5, h + 2.2); this.spot.target.position.set(0, 0.3, h + 60);
        root.add(this.spot, this.spot.target); this.eye = eye; this.nose = nose;
      }
    }
    this.scene.add(root);
    return { body: root, len: spec.len, bs: spec.len * 0.7, bogies: [this.makeBogie(2, 2.2), this.makeBogie(2, 2.2)], loco: !!driver };
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
    const shell = new THREE.Mesh(this.bodyLoft(prof, style === 'talgo' ? 2.9 : 3.0, 6, 1), M.cream);
    shell.castShadow = true; shell.receiveShadow = true; body.add(shell);
    const low = style === 'talgo' ? 0.55 : 0.85;
    this.box(3.2, low, len + 0.1, M.blue, 0, 0.85 + low / 2 - (style === 'talgo' ? 0.2 : 0), 0, body);
    this.box(3.2, 0.12, len + 0.1, M.yellow, 0, 1.82 - (style === 'talgo' ? 0.2 : 0), 0, body);
    this.box(3.1, 0.14, len - 0.8, M.roof, 0, hRoof + 0.03, 0, body).scale.x = 0.8;
    if (style === 'std') for (let k = 0; k < 4; k++) this.box(1.4, 0.3, 2.2, M.roof, 0, 4.15, -7.5 + k * 5, body);
    if (style === 'old') for (let k = 0; k < 6; k++) { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 10), M.dark); v.position.set(0, hRoof + 0.2, -7 + k * 2.8); body.add(v); }
    for (const sx of [-1, 1]) for (let k = 0; k < nWin; k++) this.box(0.03, wh, ww, M.winLit, sx * 1.58, wy, wStart + k * wStep + (style === 'std' && k > 3 ? 0.4 : 0), body);
    // realism: dark window frames, rain gutters, underframe equipment, roof ribs, coach number plate
    for (const sx of [-1, 1]) for (let k = 0; k < nWin; k++) this.box(0.02, wh + 0.12, ww + 0.12, M.dark, sx * 1.575, wy, wStart + k * wStep + (style === 'std' && k > 3 ? 0.4 : 0), body);
    for (const sx of [-1, 1]) {
      this.box(0.08, 0.07, len - 0.4, M.steel, sx * 1.5, hRoof - 0.08, 0, body);
      this.box(0.06, 0.05, len - 0.6, M.steel, sx * 1.585, wy - wh / 2 - 0.12, 0, body);
      for (let k = 0; k < 3; k++) this.box(0.5, 0.42, 1.9, M.dark, sx * 1.1, 0.55, -len * 0.28 + k * len * 0.28, body);
    }
    for (let k = -2; k <= 2; k++) this.box(2.4, 0.05, 0.1, M.steel, 0, hRoof + 0.12, k * len * 0.18, body);
    this.box(0.8, 0.07, 0.07, M.steel, 0, 0.5, 0, body);
    this.addDoors(body, M, doorZ, style === 'talgo' ? 1.85 : 2.3, style === 'talgo' ? 2.0 : 2.4);
    for (const e of [-1, 1]) this.box(2.5, hRoof - 0.9, 0.4, M.dark, 0, (hRoof + 0.6) / 2, e * (len / 2 + 0.1), body);
    this.box(2.2, 0.4, len * 0.66, M.dark, 0, 0.78, 0, body);
    this.finish(body, len, 3.0, 0.9, hRoof - 0.1);
    this.scene.add(body);
    return { body, len, bs, bogies: [this.makeBogie(2, 2.5), this.makeBogie(2, 2.5)], loco: false };
  }

  /* weathering overlay on one flat side wall (both sides) of a freight vehicle */
  grime(body, zc, len, x, y0, y1) {
    const tex = Tex.weather().clone(); tex.needsUpdate = true; tex.repeat.set(Math.max(1, len / 8), 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(len, y1 - y0), mat); p.position.set(sx * x, (y0 + y1) / 2, zc); p.rotation.y = sx * Math.PI / 2; p.renderOrder = 2; body.add(p); }
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
      for (const e of [-1, 1]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 12), mat(cols[i % cols.length], 0.5, 0.4)); cap.scale.z = 0.32; cap.position.set(0, 2.55, e * (len - 1.6) / 2); cap.castShadow = true; body.add(cap); }
      for (let k = -2; k <= 2; k++) { const bd = new THREE.Mesh(new THREE.CylinderGeometry(1.33, 1.33, 0.12, 20), M.dark); bd.rotation.x = Math.PI / 2; bd.position.set(0, 2.55, k * 2.3); body.add(bd); }
      { const dm = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.35, 14), mat(0x55595c, 0.5, 0.6)); dm.position.set(0, 3.8, 1.5); body.add(dm); }
      this.box(0.5, 0.06, len - 2.5, M.steel, 0, 3.86, 0, body);      // walkway
      for (const sx of [-1, 1]) this.box(0.06, 1.5, 0.5, M.steel, sx * 1.55, 2.1, len / 2 - 1.2, body);   // ladder
    } else if (kind === 'box') {
      const cols = [0xcdc7b6, 0x8f3a2e, 0x4c6a8c, 0x6b4a35];
      const bm = mat(cols[i % cols.length], 0.7);
      const lh = (len - 1) / 2, ls = new THREE.Mesh(this.bodyLoft([[-lh, 1.3], [-lh, 3.95], [-lh + 0.2, 4.1], [lh - 0.2, 4.1], [lh, 3.95], [lh, 1.3]], 2.95, 7, 1), bm); ls.castShadow = true; ls.receiveShadow = true; body.add(ls);
      for (const sx of [-1, 1]) { this.box(0.06, 2.4, 2.4, M.dark, sx * 1.46, 2.7, 0, body); this.box(0.07, 2.4, 0.08, M.steel, sx * 1.47, 2.7, 1.2, body); this.box(0.07, 2.4, 0.08, M.steel, sx * 1.47, 2.7, -1.2, body); }
      for (const sx of [-1, 1]) for (let k = -5; k <= 5; k++) { if (Math.abs(k * 1.1) < 1.6) continue; this.box(0.05, 2.7, 0.12, bm, sx * 1.46, 2.7, k * 1.1, body); }   // corrugated ribs
      this.grime(body, 0, len - 1, 1.52, 1.35, 4.05);
    } else if (kind === 'hopper') {
      const cols = [0xcfc8b4, 0x7a7a74, 0x8a5a38], c = cols[i % cols.length];
      { const hm = mat(c, 0.75), lh = (len - 1.2) / 2, hs = new THREE.Mesh(this.bodyLoft([[-lh, 2.65], [-lh, 4.0], [-lh + 0.15, 4.15], [lh - 0.15, 4.15], [lh, 4.0], [lh, 2.65]], 3.0, 7, 1), hm); hs.castShadow = true; hs.receiveShadow = true; body.add(hs);
        for (const sx of [-1, 1]) { const rl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len - 1.8, 6), M.steel); rl.rotation.x = Math.PI / 2; rl.position.set(sx * 1.3, 4.35, 0); body.add(rl); } }
      for (const z of [-3.3, 3.3]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(1.98, 0.45, 1.3, 4, 1), mat(c, 0.75)); f.rotation.y = Math.PI / 4; f.scale.z = 2.0; f.position.set(0, 1.95, z); f.castShadow = true; body.add(f); }
      for (const z of [-3.3, 3.3]) this.box(0.8, 0.12, 0.8, M.dark, 0, 4.18, z, body);   // loading hatches
      this.grime(body, 0, len - 1.2, 1.52, 2.65, 4.15);
    } else if (kind === 'gond') {
      const cols = [0x5a4a3a, 0x3f4b57, 0x6a3b2a], c = cols[i % cols.length];
      this.box(3.0, 0.2, len, mat(c), 0, 1.35, 0, body);
      for (const sx of [-1, 1]) this.box(0.12, 1.9, len, mat(c), sx * 1.44, 2.35, 0, body);
      for (const e of [-1, 1]) this.box(3.0, 1.9, 0.12, mat(c), 0, 2.35, e * (len / 2 - 0.06), body);
      this.grime(body, 0, len, 1.51, 1.4, 3.3);
      for (const sx of [-1, 1]) { this.box(0.14, 0.1, len, M.steel, sx * 1.46, 3.33, 0, body); for (let k = -5; k <= 5; k++) this.box(0.08, 1.9, 0.16, M.steel, sx * 1.5, 2.35, k * 1.2, body); }
      const pile = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.9, len - 1.0), mat(i % 2 ? 0x1b1a19 : 0x8a8579, 0.95, 0)); pile.position.y = 2.7; body.add(pile);   // coal or aggregate
    } else {
      const cols = ['#2a4f86', '#c8571a', '#3c7a4a', '#a8262d', '#d8d3c6', '#5d646b'], labels = ['NILE', 'DELTA', 'SUEZ', 'CAIRO', 'ALEX', 'SINAI'];
      this.box(2.6, 0.12, len - 0.4, M.dark, 0, 1.36, 0, body);
      for (const z of [-3.3, 3.3]) {
        const k = (i + (z > 0 ? 2 : 0)) % cols.length, cm = new THREE.MeshStandardMaterial({ color: cols[k], roughness: 0.6, metalness: 0.2 });
        { const cg = new THREE.Mesh(this.bodyLoft([[-3, 1.42], [-3, 4.02], [3, 4.02], [3, 1.42]], 2.5, 12, 1), cm); cg.position.set(0, 0, z); cg.castShadow = true; cg.receiveShadow = true; body.add(cg);
          for (const sx of [-1, 1]) for (const ez of [-1, 1]) for (const cy of [1.5, 3.94]) this.box(0.2, 0.14, 0.2, M.dark, sx * 1.15, cy, z + ez * 2.9, body); }
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
      else if (k === 'mcoach') v = this.buildMetroCar(this.type.loco, false, false);
      else if (['tank', 'box', 'flat', 'cont', 'hopper', 'gond'].includes(k)) v = this.buildWagon(k, i);
      else v = this.buildCoach(k === 'old' ? 'old' : k === 'talgo' ? 'talgo' : k === 'vcoach' ? 'velaro' : 'std', i);
      this.vehicles.push(v);
    });
    this.length = this.vehicles.reduce((a, v) => a + v.len + 0.9, 0);
    this.vehicles.forEach((v) => v.body.traverse((o) => { if (o.isMesh) o.castShadow = true; }));
    this.fa = Track.makeFrame(); this.fb = Track.makeFrame(); this.tmp = new THREE.Vector3();
  }

  setCabView(on) {
    this.cabMode = on; this.cab.visible = on;
    if (this.metroRoot) { const keep = new Set([this.cab, this.eye, this.nose, this.spot, this.spot && this.spot.target]); this.metroRoot.children.forEach((c) => { if (!keep.has(c)) c.visible = !on; }); }   // the metro car is a group of parts, so hide every part except the cab
    else this.locoHull.visible = !on;
  }

  /* Place every vehicle. sHead is the distance of the loco's front buffer. */
  place(sHead, time, speed, derailT) {
    const tr = this.track, rev = !!this.rev, lat = this.lat || 0, sg = rev ? -1 : 1; let center = sHead - sg * this.loco.len / 2;   // rev: runs towards decreasing s, on the other track
    this.vehicles.forEach((v, idx) => {
      if (idx > 0) { const p = this.vehicles[idx - 1]; center -= sg * (p.len / 2 + 0.9 + v.len / 2); }
      const fa = tr.frame(center + v.bs / 2, this.fa), fb = tr.frame(center - v.bs / 2, this.fb);
      { const dj = this.divJ, la = lat + (dj ? tr.divLatJ(dj, center + v.bs / 2) : 0), lb = lat + (dj ? tr.divLatJ(dj, center - v.bs / 2) : 0); if (la) fa.pos.addScaledVector(fa.right, la); if (lb) fb.pos.addScaledVector(fb.right, lb); }
      this.tmp.copy(fa.pos).sub(fb.pos); const dir = this.tmp.clone().normalize(); if (rev) dir.negate();
      v.body.position.copy(fa.pos).add(fb.pos).multiplyScalar(0.5); v.body.position.y = RAIL_TOP;
      v.body.lookAt(v.body.position.x + dir.x, RAIL_TOP, v.body.position.z + dir.z);
      if (v.flip) v.body.rotateY(Math.PI);
      const sway = Math.sin(time * 1.3 + idx * 1.7) * 0.003 * Math.min(1, speed / 20) + Math.sin(time * 9 + idx) * 0.0012 * Math.min(1, speed / 25);
      v.body.rotateZ(sway); v.body.position.y += Math.sin(time * 11 + idx * 2) * 0.004 * Math.min(1, speed / 25);
      // derailment: each vehicle tips over in turn, starting with the locomotive, and slides off to one side
      let k = 0; if (derailT > 0) { k = U.clamp((derailT - idx * 0.22) / 1.4, 0, 1); k = k * k * (3 - 2 * k); if (k > 0) { v.body.rotateZ(k * 1.4); v.body.translateX(-k * 1.3); v.body.position.y -= k * 0.15; } }
      [fa, fb].forEach((f, bi) => {
        const b = v.bogies[bi].g; b.position.set(f.pos.x, RAIL_TOP, f.pos.z); b.lookAt(f.pos.x + sg * f.fwd.x, RAIL_TOP, f.pos.z + sg * f.fwd.z);
        if (k > 0) { b.rotateZ(k * 1.25); b.translateX(-k * 1.0); }
      });
      v.center = center;
    });
  }

  spin(dist) {
    const a = dist / 0.46;
    for (const v of this.vehicles) for (const b of v.bogies) for (const ws of b.sets) ws.rotation.x += a;
  }

  /* Working controls on the driver's desk: throttle and brake levers, horn / doors / emergency / headlight buttons, a small screen and lamps.
   * cabHits lists the meshes a click can land on (userData.act = 'throttle' | 'brake' | 'horn' | 'door' | 'emerg' | 'light'). */
  /* Rectangular window opening in a wall made of boxes: pieces around [x0..x1] x [y0..y1] on the plane z (front) or x (side). */
  wallWithOpening(cab, axis, pos, span0, span1, ya, yb, o0, o1, y0, y1, mat, th) {
    // axis 'z': wall in the plane z=pos spanning x (span0..span1); axis 'x': wall in the plane x=pos spanning z.
    const put = (a0, a1, b0, b1) => { if (a1 - a0 < 0.001 || b1 - b0 < 0.001) return; if (axis === 'z') this.box(a1 - a0, b1 - b0, th, mat, (a0 + a1) / 2, (b0 + b1) / 2, pos, cab); else this.box(th, b1 - b0, a1 - a0, mat, pos, (b0 + b1) / 2, (a0 + a1) / 2, cab); };
    put(span0, span1, ya, y0); put(span0, span1, y1, yb); put(span0, o0, y0, y1); put(o1, span1, y0, y1);
  }

  cabGE(cab, dk, glassM) {
    const tan = new THREE.MeshStandardMaterial({ color: 0xd8bb8f, roughness: 0.9 }), orange = new THREE.MeshStandardMaterial({ color: 0xbd6a24, roughness: 0.85 }), brown = new THREE.MeshStandardMaterial({ color: 0x6a4936, roughness: 0.75 });
    const navy = new THREE.MeshStandardMaterial({ color: 0x182033, roughness: 0.6 }), frame = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.7 });
    this.box(3.0, 0.12, 6.6, new THREE.MeshStandardMaterial({ color: 0x3a2c25, roughness: 0.9 }), 0, 1.09, 6.1, cab);                    // floor
    this.box(3.0, 0.12, 5.6, new THREE.MeshStandardMaterial({ color: 0xe0cba9, roughness: 0.95 }), 0, 4.16, 5.2, cab);                 // ceiling
    this.box(3.0, 2.1, 0.1, tan, 0, 3.0, 2.9, cab);                                                                                   // rear wall
    // front wall with one big windscreen, orange pillars, security bars
    this.wallWithOpening(cab, 'z', 7.45, -1.5, 1.5, 1.1, 4.16, -1.3, 1.3, 2.85, 4.04, tan, 0.1);
    for (const sx of [-1, 1]) this.box(0.2, 1.3, 0.14, orange, sx * 1.4, 3.45, 7.43, cab);
    this.box(2.7, 0.09, 0.12, frame, 0, 2.87, 7.42, cab); this.box(2.7, 0.09, 0.12, frame, 0, 4.0, 7.42, cab);
    for (let i = -7; i <= 7; i++) { const b = this.box(0.022, 1.15, 0.03, frame, i * 0.17, 3.44, 7.4, cab); b.rotation.z = i * 0.012; }
    for (const [x, r] of [[0.85, -0.55], [1.05, -0.6]]) { const b = this.box(0.02, 1.4, 0.03, frame, x, 3.45, 7.39, cab); b.rotation.z = r; }
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.18), glassM); fg.position.set(0, 3.44, 7.41); fg.rotation.y = Math.PI; cab.add(fg);
    for (const sx of [-1, 1]) {   // side walls: a big window on the driver's side, a narrower one opposite
      const z0 = sx > 0 ? 3.5 : 4.4, z1 = sx > 0 ? 6.9 : 6.6;
      this.wallWithOpening(cab, 'x', sx * 1.47, 2.9, 7.45, 1.1, 4.16, z0, z1, 2.75, 3.95, sx > 0 ? tan : orange, 0.1);
      this.box(0.12, 0.08, z1 - z0 + 0.1, frame, sx * 1.46, 2.74, (z0 + z1) / 2, cab); this.box(0.12, 0.08, z1 - z0 + 0.1, frame, sx * 1.46, 3.96, (z0 + z1) / 2, cab);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, 1.2), glassM); sg.position.set(sx * 1.45, 3.35, (z0 + z1) / 2); sg.rotation.y = -sx * Math.PI / 2; cab.add(sg);
    }
    const n0 = cab.children.length;
    // dash: sloped brown top with the instrument faces set into it, as in the reference photo (navy switch panel, centre display + button row, right display, speaker)
    this.box(2.9, 0.5, 1.2, brown, 0, 2.1, 6.85, cab); this.box(2.9, 1.0, 0.7, brown, 0, 1.6, 6.9, cab);
    const slab = this.box(2.9, 0.08, 1.15, brown, 0, 2.66, 6.7, cab); slab.rotation.x = -0.33;
    const sy = (z) => 2.66 + (z - 6.7) * 0.343 + 0.075;     // height of the sloped surface at depth z
    const face = (w, l, x, z, mat, lift) => { const m = this.box(w, 0.04, l, mat, x, sy(z) + (lift || 0), z, cab); m.rotation.x = -0.33; return m; };
    const flat = (w, l, x, z, map, lift) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ map })); p.rotation.set(-Math.PI / 2 - 0.33, 0, 0); p.position.set(x, sy(z) + (lift || 0.025), z); cab.add(p); return p; };
    const shelf = new THREE.MeshStandardMaterial({ color: 0x4b3326, roughness: 0.7 });
    this.box(2.9, 0.07, 0.14, shelf, 0, 2.93, 7.3, cab);                                        // dark brown shelf under the windscreen
    face(0.72, 0.5, -0.86, 6.62, navy); flat(0.68, 0.46, -0.86, 6.62, Tex.cabNavy());          // navy switch panel
    face(0.74, 0.64, 0.14, 6.6, dk); flat(0.62, 0.45, 0.14, 6.66, Tex.cabCentre());            // centre display + buttons
    face(0.62, 0.6, 0.8, 6.62, dk);                                                              // right display bezel (live screen is placed in buildCabControls)
    for (let i = 0; i < 8; i++) face(0.035, 0.03, 0.56 + i * 0.065, 6.9, new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.5 }), 0.035);
    for (let i = 0; i < 5; i++) face(0.03, 0.035, 1.08, 6.35 + i * 0.1, new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.5 }), 0.035);
    face(0.5, 0.1, 0.8, 6.28, new THREE.MeshStandardMaterial({ color: 0x8b8e92, roughness: 0.5 }), 0.03);   // data plate under the right display
    { const spk = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20), dk); spk.position.set(1.22, sy(6.62) + 0.04, 6.62); spk.rotation.x = -0.33; cab.add(spk);
      const rg = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 16), new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.5, roughness: 0.4 })); rg.position.set(1.22, sy(6.4) + 0.04, 6.4); rg.rotation.x = Math.PI / 2 - 0.33; cab.add(rg); }
    for (let i = n0; i < cab.children.length; i++) cab.children[i].position.x *= -1;   // the driver looks along +z, so +x is on his left: mirror everything placed in photo order (left to right) above
    for (const wx of [-0.55, 0.15]) { const w = this.box(0.025, 0.04, 1.0, dk, wx, 3.45, 7.33, cab); w.rotation.z = 0.5; }
    this.box(0.55, 0.16, 0.55, dk, -0.75, 1.55, 4.1, cab); this.box(0.5, 0.75, 0.12, dk, -0.75, 2.05, 3.8, cab);
    for (const sx of [-1, 1]) this.box(0.16, 0.9, 1.0, dk, sx * 1.35, 2.0, 3.4, cab);
  }

  cabMetro(cab, dk, glassM) {
    const wall = new THREE.MeshStandardMaterial({ color: 0xd3d9dd, roughness: 0.8 }), white = new THREE.MeshStandardMaterial({ color: 0xeef0f1, roughness: 0.7 }), teal = new THREE.MeshStandardMaterial({ color: 0x1f8f86, roughness: 0.6 });
    const frame = new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.6 }), flo = new THREE.MeshStandardMaterial({ color: 0x4a4f54, roughness: 0.9 });
    this.box(3.0, 0.12, 6.6, flo, 0, 1.09, 6.1, cab);
    this.box(3.0, 0.12, 5.6, white, 0, 4.16, 5.2, cab);
    this.box(1.8, 0.03, 0.25, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 1.1 }), 0, 4.09, 5.0, cab);
    this.box(3.0, 2.1, 0.1, wall, 0, 3.0, 2.9, cab);
    // wide panoramic windscreen with a centre emergency door frame
    this.wallWithOpening(cab, 'z', 7.45, -1.5, 1.5, 1.1, 4.16, -1.35, 1.35, 2.7, 4.06, wall, 0.1);
    this.box(2.8, 0.1, 0.12, frame, 0, 2.7, 7.42, cab); this.box(2.8, 0.1, 0.12, frame, 0, 4.05, 7.42, cab);
    for (const x of [-1.35, -0.42, 0.42, 1.35]) this.box(0.1, 1.4, 0.12, frame, x, 3.38, 7.42, cab);
    this.box(0.84, 0.05, 0.12, frame, 0, 3.6, 7.42, cab);
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.34), glassM); fg.position.set(0, 3.38, 7.41); fg.rotation.y = Math.PI; cab.add(fg);
    for (const sx of [-1, 1]) {
      this.wallWithOpening(cab, 'x', sx * 1.47, 2.9, 7.45, 1.1, 4.16, 5.2, 6.6, 2.85, 3.9, wall, 0.1);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), glassM); sg.position.set(sx * 1.45, 3.38, 5.9); sg.rotation.y = -sx * Math.PI / 2; cab.add(sg);
      this.box(0.06, 2.4, 1.1, teal, sx * 1.44, 2.4, 4.1, cab);   // driver's door
    }
    this.box(2.9, 0.5, 1.2, wall, 0, 2.1, 6.85, cab); this.box(2.9, 1.0, 0.7, wall, 0, 1.6, 6.9, cab);
    const slab = this.box(2.9, 0.08, 1.15, white, 0, 2.66, 6.7, cab); slab.rotation.x = -0.33;
    this.box(2.9, 0.04, 0.12, teal, 0, 2.64, 7.22, cab);
    for (const [x, w, tx] of [[-0.55, 0.8, 'cabScreen2'], [0.5, 0.8, 'cabScreen']]) {
      const bz = this.box(w + 0.08, 0.045, 0.56, dk, x, 2.745, 6.65, cab); bz.rotation.x = -0.33;
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.44), new THREE.MeshBasicMaterial({ map: Tex[tx]() })); sc.rotation.set(-Math.PI / 2 - 0.33, 0, 0); sc.position.set(x, 2.8, 6.65); cab.add(sc);
    }
    this.box(0.55, 0.16, 0.55, flo, -0.75, 1.55, 4.1, cab); this.box(0.5, 0.75, 0.12, flo, -0.75, 2.05, 3.8, cab);
  }

  /* Cab interiors. 'ge' (free): tan walls, slanted windscreen with bars, brown desk with black panels. 'terra' (gems): terracotta walls, rounded framed windows.
   * 'metro': light modern metro cab. The levers, dials and buttons are shared (buildCabControls); only the shell and dash differ. */
  cabShell(cab, style) {
    const dk = new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 0.7 }), trimM = new THREE.MeshStandardMaterial({ color: 0x8a5a2c, roughness: 0.8 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0xa8d0e8, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.13, depthWrite: false });
    if (style === 'ge') return this.cabGE(cab, dk, glassM);
    const metro = style === 'metro';   // the metro cab reuses the verified rounded-window shell in light grey and white with a teal stripe
    {
      // 'terra': cab shell modelled on the reference photo: terracotta walls and desk, beige perforated ceiling, rounded framed windows with glass, black screen with a row of yellow buttons
      const terra = new THREE.MeshStandardMaterial({ color: metro ? 0x7d878e : 0x80402c, roughness: 0.82 }), desk2 = new THREE.MeshStandardMaterial({ color: metro ? 0x3f474d : 0xa4552e, roughness: 0.7 }), beige = new THREE.MeshStandardMaterial({ map: metro ? null : Tex.cabCeil(), color: metro ? 0x9aa4aa : 0xffffff, roughness: 0.95 });
      const winTex = (w, h, rx, ry, rw, rh, rad, base) => { const c = U.canvas(512, Math.round(512 * h / w)), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, c.width, c.height);
        const X = rx * c.width, Y = ry * c.height, W = rw * c.width, H = rh * c.height; const rr = (x, y, w2, h2, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w2, y, x + w2, y + h2, r); g.arcTo(x + w2, y + h2, x, y + h2, r); g.arcTo(x, y + h2, x, y, r); g.arcTo(x, y, x + w2, y, r); g.closePath(); };
        g.lineWidth = 22; g.strokeStyle = '#161513'; rr(X, Y, W, H, rad); g.stroke();
        g.fillStyle = '#9a8f84'; for (let i = 0; i < 26; i++) { const t = i / 26 * Math.PI * 2, px = X + W / 2 + Math.cos(t) * (W / 2 + 3), py = Y + H / 2 + Math.sin(t) * (H / 2 + 3); g.beginPath(); g.arc(Math.max(X, Math.min(X + W, px)), Math.max(Y, Math.min(Y + H, py)), 3.5, 0, 7); g.fill(); }
        g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; rr(X, Y, W, H, rad); g.fill(); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; };
      const glass = glassM;
      const front = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.75), new THREE.MeshStandardMaterial({ map: winTex(3.0, 1.75, 0.07, 0.06, 0.86, 0.72, 60, (metro ? '#7d878e' : '#80402c')), transparent: true, alphaTest: 0.5, roughness: 0.82, side: THREE.DoubleSide }));
      front.position.set(0, 3.25, 7.45); front.rotation.y = Math.PI; cab.add(front);
      const fg = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 1.2), glass); fg.position.set(0, 3.28, 7.43); fg.rotation.y = Math.PI; cab.add(fg);
      for (const sx of [-1, 1]) {   // side walls: terracotta lower half, window with rounded frame and glass
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.75), new THREE.MeshStandardMaterial({ map: winTex(4.6, 1.75, 0.16, 0.12, 0.5, 0.6, 50, (metro ? '#7d878e' : '#80402c')), transparent: true, alphaTest: 0.5, roughness: 0.82, side: THREE.DoubleSide }));
        sw.position.set(sx * 1.47, 3.25, 5.15); sw.rotation.y = -sx * Math.PI / 2; cab.add(sw);
        const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.95), glass); sg.position.set(sx * 1.45, 3.29, 5.47); sg.rotation.y = -sx * Math.PI / 2; cab.add(sg);
      }
      this.box(3.0, 0.12, 6.6, new THREE.MeshStandardMaterial({ color: 0x2a2623, roughness: 0.9 }), 0, 1.09, 6.1, cab);        // floor
      this.box(3.0, 0.12, 5.6, beige, 0, 4.16, 5.2, cab);                                                                     // ceiling
      this.box(3.0, 2.1, 0.1, terra, 0, 3.0, 2.9, cab);                                                                       // rear wall
      this.box(0.2, 0.12, 5.6, terra, -1.3, 4.05, 5.2, cab); this.box(0.2, 0.12, 5.6, terra, 1.3, 4.05, 5.2, cab);           // ceiling rails
      this.box(2.9, 0.5, 1.2, terra, 0, 2.1, 6.85, cab);                                                                      // dash body
      const slab = this.box(2.9, 0.08, 1.15, desk2, 0, 2.66, 6.7, cab); slab.rotation.x = -0.33;                              // sloped orange-brown dash top
      this.box(2.9, 1.0, 0.7, terra, 0, 1.6, 6.9, cab);                                                                       // lower front
      if (metro) { this.box(2.92, 0.05, 0.05, new THREE.MeshStandardMaterial({ color: 0x1f8f86, roughness: 0.5 }), 0, 2.45, 7.28, cab); this.box(0.06, 2.0, 0.9, new THREE.MeshStandardMaterial({ color: 0x1f8f86, roughness: 0.6 }), -1.43, 2.2, 4.1, cab); this.box(0.06, 2.0, 0.9, new THREE.MeshStandardMaterial({ color: 0x1f8f86, roughness: 0.6 }), 1.43, 2.2, 4.1, cab); }
      { // black driver's screen set into the dash, with a row of yellow buttons under it
        const bez = this.box(1.0, 0.04, 0.72, dk, -0.55, 2.745, 6.62, cab); bez.rotation.x = -0.33;
        const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.58), new THREE.MeshBasicMaterial({ map: Tex.cabScreen() })); sc.rotation.set(-Math.PI / 2 - 0.33, 0, 0); sc.position.set(-0.55, 2.775, 6.62); cab.add(sc);
        for (let i = 0; i < 11; i++) { const bt = this.box(0.055, 0.02, 0.035, new THREE.MeshStandardMaterial({ color: 0xe9c25a, emissive: 0x5a4210, roughness: 0.5 }), -0.97 + i * 0.085, 2.72, 6.22, cab); bt.rotation.x = -0.33; }
        const side = this.box(0.3, 0.04, 0.62, dk, -1.07, 2.745, 6.62, cab); side.rotation.x = -0.33;                          // side button panel
        const side2 = this.box(0.7, 0.04, 0.62, new THREE.MeshStandardMaterial({ color: metro ? 0x5a636a : 0x8f4a2c, roughness: 0.75 }), 0.45, 2.745, 6.62, cab); side2.rotation.x = -0.33;
      }
      { // overhead panel with a round fan grille and a switch, as in the reference
        const pm = new THREE.MeshStandardMaterial({ color: metro ? 0x8c969c : 0x8a4630, roughness: 0.8 }); const hang = this.box(1.0, 0.5, 0.5, pm, -0.5, 3.9, 6.5, cab);
        const c = U.canvas(512, 256), g = c.getContext('2d'); g.fillStyle = '#1b2220'; g.fillRect(0, 0, 512, 256); const cx = 190, cy = 128;
        g.strokeStyle = '#c9ccc9'; g.lineWidth = 5; for (let r = 28; r <= 100; r += 14) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
        g.lineWidth = 3; for (let k = 0; k < 12; k++) { const t = k / 12 * 6.283; g.beginPath(); g.moveTo(cx + Math.cos(t) * 26, cy + Math.sin(t) * 26); g.quadraticCurveTo(cx + Math.cos(t + 0.5) * 70, cy + Math.sin(t + 0.5) * 70, cx + Math.cos(t + 0.9) * 106, cy + Math.sin(t + 0.9) * 106); g.stroke(); }
        g.fillStyle = '#e8e6df'; g.beginPath(); g.arc(cx, cy, 24, 0, 7); g.fill();
        g.fillStyle = '#d9d6cc'; g.fillRect(350, 70, 110, 120); g.fillStyle = '#222'; g.beginPath(); g.arc(405, 112, 26, 0, 7); g.fill(); g.fillStyle = '#d9d6cc'; g.beginPath(); g.arc(405, 112, 10, 0, 7); g.fill(); g.fillStyle = '#222'; g.fillRect(380, 156, 50, 10);
        g.fillStyle = '#9a9a96'; for (const [x, y] of [[12, 12], [500, 12], [12, 244], [500, 244]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
        const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; const face = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.42), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })); face.position.set(-0.5, 3.9, 6.24); face.rotation.y = Math.PI; cab.add(face);
        
      }
      for (const wx of [-0.55, 0.15]) { const w = this.box(0.025, 0.04, 1.0, dk, wx, 3.55, 7.33, cab); w.rotation.z = 0.5; }      // wipers
      { // driver's seat
        this.box(0.55, 0.16, 0.55, dk, -0.75, 1.55, 4.1, cab); this.box(0.5, 0.75, 0.12, dk, -0.75, 2.05, 3.8, cab);
        this.box(0.08, 0.5, 0.08, new THREE.MeshStandardMaterial({ color: 0x555a60, metalness: 0.6, roughness: 0.4 }), -0.75, 1.25, 4.1, cab);
      }
      for (const sx of [-1, 1]) this.box(0.16, 0.9, 1.4, dk, sx * 1.35, 2.0, 3.6, cab);   // side lockers
    }
  }

  /* Controls of the free GE cab, laid out as in the reference photo: two black lever boxes (left: a black-knob lever and two short silver ones; right: the tall black-knob lever
   * and a chunky red horizontal handle), a metal strip with yellow and blue push buttons at the front-left, a small switch panel and a grey ring at the right. */
  cabControlsGE(cab) {
    this.cabHits = []; const C = this.cabCtl = {}; const n0 = cab.children.length;
    const sy = (z) => 2.66 + (z - 6.7) * 0.343 + 0.075, std = (col, r, m) => new THREE.MeshStandardMaterial({ color: col, roughness: r === undefined ? 0.6 : r, metalness: m || 0 });
    const blk = std(0x17181a, 0.55), steel = std(0xb9bcc0, 0.3, 0.7);
    const desk = this.box(2.3, 0.05, 0.7, std(0x5a4030, 0.75), 0, 2.5, 5.78, cab); this.box(0.85, 0.052, 0.7, std(0x5f6064, 0.7), 0.82, 2.5, 5.78, cab);
    const hit = (mesh, act) => { mesh.userData.act = act; this.cabHits.push(mesh); };
    const lab = (txt, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshBasicMaterial({ map: Tex.sign(txt, 160, 40, '#1b1d20', '#e8e4d6'), transparent: true })); m.rotation.x = -Math.PI / 2; m.position.set(x, 2.528, z); cab.add(m); };
    this.box(0.6, 0.1, 0.5, blk, -0.33, 2.55, 5.9, cab); this.box(0.66, 0.13, 0.66, blk, 0.28, 2.565, 5.88, cab);        // the two lever boxes
    this.box(0.045, 0.012, 0.42, std(0x1d1e20, 0.4), 0.52, 2.635, 5.9, cab); this.box(0.03, 0.014, 0.4, steel, -0.04, 2.635, 5.9, cab);   // slots / silver strip
    this.box(0.04, 0.012, 0.3, steel, -0.3, 2.605, 5.9, cab); this.box(0.04, 0.012, 0.3, steel, -0.2, 2.605, 5.9, cab);
    const knob = (col, r) => { const k = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), std(col, 0.35)); k.scale.y = 1.3; return k; };
    const rod = (len) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, len, 8), std(0xa4a7ab, 0.3, 0.7)); r.position.y = len / 2; return r; };
    { const k = knob(0x0d0d0e, 0.036); k.position.set(-0.12, 2.6 + 0.3, 5.92); cab.add(k); const r = rod(0.3); r.position.set(-0.12, 2.6 + 0.15, 5.92); cab.add(r); }   // decorative black-knob lever
    for (const x of [-0.3, -0.2]) { const r = rod(0.12); r.position.set(x, 2.605 + 0.06, 5.9); cab.add(r); const tb = this.box(0.07, 0.016, 0.05, steel, x, 2.605 + 0.13, 5.9, cab); }
    // throttle: tall lever with a black knob
    { const piv = new THREE.Group(); piv.position.set(0.52, 2.64, 5.9); cab.add(piv); const r = rod(0.4); piv.add(r); const k = knob(0x0d0d0e, 0.04); k.position.y = 0.43; piv.add(k);
      const big = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); big.position.y = 0.3; piv.add(big); hit(big, 'throttle'); hit(k, 'throttle'); hit(r, 'throttle'); C.throttle = piv; lab('القوة', 0.52, 5.58); }
    // brake: short stub with a chunky red horizontal handle
    { const piv = new THREE.Group(); piv.position.set(-0.04, 2.64, 5.97); cab.add(piv); const r = rod(0.1); piv.add(r);
      const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.17, 14), std(0xd01c1c, 0.35)); hd.rotation.z = Math.PI / 2; hd.position.y = 0.12; piv.add(hd);
      for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), std(0xd01c1c, 0.35)); e.position.set(sx * 0.085, 0.12, 0); piv.add(e); }
      const big = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); big.position.y = 0.12; piv.add(big); hit(big, 'brake'); hit(hd, 'brake'); C.brake = piv; lab('فرامل', -0.04, 5.58); }
    // metal strip with the yellow (horn) and blue (doors) push buttons, a red emergency square, and a white lights button on the right panel
    this.box(0.5, 0.012, 0.24, std(0x25272a, 0.4, 0.5), -0.9, 2.527, 5.62, cab); this.box(0.1, 0.012, 0.42, std(0x25272a, 0.4, 0.5), -0.52, 2.527, 5.8, cab);
    const push = (x, z, col, act, name) => {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.03, 18), steel); base.position.set(x, 2.54, z); cab.add(base);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.04, 18), new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, emissive: col, emissiveIntensity: 0.15 })); b.position.set(x, 2.55, z); cab.add(b);
      const big = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); big.position.set(x, 2.56, z); cab.add(big); hit(b, act); hit(big, act); lab(name, x, z - 0.14); return b; };
    C.horn = push(-1.02, 5.62, 0xe8d21a, 'horn', 'زمارة'); C.door = push(-0.77, 5.62, 0x2a7fe0, 'door', 'أبواب');
    { const e = this.box(0.08, 0.035, 0.08, std(0xd32020, 0.35), -0.52, 2.55, 5.95, cab); e.material.emissive = new THREE.Color(0xd32020); e.material.emissiveIntensity = 0.15; const big = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); big.position.set(-0.52, 2.56, 5.95); cab.add(big); hit(e, 'emerg'); hit(big, 'emerg'); C.emerg = e; lab('طوارئ', -0.52, 5.7); }
    C.light = push(1.0, 5.55, 0xe8e8e0, 'light', 'أنوار');
    // right switch panel, grey ring with a red dot, loose paper
    this.box(0.62, 0.02, 0.28, std(0x1e2023, 0.5), 0.95, 2.53, 5.78, cab);
    for (let i = 0; i < 3; i++) this.box(0.035, 0.03, 0.06, std(0x909398, 0.4, 0.4), 0.72 + i * 0.1, 2.55, 5.78, cab);
    { const rg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20), std(0x77797c, 0.4, 0.6)); rg.position.set(1.12, 2.55, 5.85); cab.add(rg); const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), std(0xd32020, 0.4)); dot.position.set(1.12, 2.57, 5.85); cab.add(dot); }
    { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.2), new THREE.MeshStandardMaterial({ color: 0xe8e6de, roughness: 0.95 })); p.rotation.set(-Math.PI / 2, 0, 0.3); p.position.set(1.18, 2.527, 5.52); cab.add(p); }
    this.box(0.1, 0.1, 0.1, std(0x1c1b1a, 0.5), -0.95, 2.6, 5.95, cab);   // the black bracket
    // live screen (speed, limit, next stop) in the right display
    this.scrC = U.canvas(256, 128); this.scrT = new THREE.CanvasTexture(this.scrC); this.scrT.encoding = THREE.sRGBEncoding;
    { const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshBasicMaterial({ map: this.scrT })); sc.rotation.set(-Math.PI / 2 - 0.33, 0, 0); sc.position.set(0.8, sy(6.66) + 0.03, 6.66); cab.add(sc); }
    C.lamps = [0x2e9a58, 0xe0a82a, 0xd32020].map((c, i) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: 0x222222 })); l.position.set(-1.25 + i * 0.1, sy(6.3) + 0.04, 6.3); l.userData.on = c; cab.add(l); return l; });
    for (let i = n0; i < cab.children.length; i++) cab.children[i].position.x *= -1;
  }

  buildCabControls(cab) {
    if (this.cabStyle === 'ge') return this.cabControlsGE(cab);
    this.cabHits = []; const C = this.cabCtl = {};
    const std = (col, r, m) => new THREE.MeshStandardMaterial({ color: col, roughness: r === undefined ? 0.6 : r, metalness: m || 0 });
    const blk = std(0x17181a, 0.55), steel = std(0xb9bcc0, 0.3, 0.7), metro = this.cabStyle === 'metro';
    this.box(2.3, 0.05, 0.7, std(metro ? 0x4a535a : 0x9a4a2a, 0.75), 0, 2.5, 5.78, cab);                      // desk
    const lab = (txt, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshBasicMaterial({ map: Tex.sign(txt, 160, 40, '#1b1d20', '#e8e4d6'), transparent: true })); m.rotation.x = -Math.PI / 2; m.position.set(x, 2.528, z); cab.add(m); };
    const hit = (mesh, act) => { mesh.userData.act = act; this.cabHits.push(mesh); };
    const bigHit = (g, y, act, x, z) => { const big = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); big.position.set(x === undefined ? 0 : x, y, z === undefined ? 0 : z); g.add(big); hit(big, act); };
    // right: black lever box with the red mushroom-handled throttle on a short stem
    this.box(0.5, 0.14, 0.62, blk, -1.18, 2.57, 5.85, cab); this.box(0.12, 0.012, 0.36, std(0xe8e6de, 0.5), -1.18, 2.645, 5.85, cab);
    { const piv = new THREE.Group(); piv.position.set(-1.18, 2.64, 5.9); cab.add(piv);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.16, 8), steel); st.position.y = 0.08; piv.add(st); hit(st, 'throttle');
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 12), std(0xc01822, 0.4)); cap.scale.set(1.15, 0.7, 1.0); cap.position.y = 0.19; piv.add(cap); hit(cap, 'throttle'); bigHit(piv, 0.15, 'throttle'); C.throttle = piv; lab('القوة', -1.18, 5.52); }
    // brake: short black gear-lever on its own black box next to the screen column
    this.box(0.5, 0.1, 0.4, blk, -0.82, 2.55, 5.95, cab);
    { const piv = new THREE.Group(); piv.position.set(-0.82, 2.6, 5.95); cab.add(piv);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.2, 8), steel); st.position.y = 0.1; piv.add(st); hit(st, 'brake');
      const kn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), std(0x0f0f10, 0.35)); kn.scale.y = 1.25; kn.position.y = 0.23; piv.add(kn); hit(kn, 'brake'); bigHit(piv, 0.15, 'brake'); C.brake = piv; lab('فرامل', -0.82, 5.62); }
    const push = (x, z, col, act, name) => {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.03, 18), steel); base.position.set(x, 2.54, z); cab.add(base);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.04, 18), new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, emissive: col, emissiveIntensity: 0.15 })); b.position.set(x, 2.55, z); cab.add(b);
      const big = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); big.position.set(x, 2.56, z); cab.add(big); hit(b, act); hit(big, act); lab(name, x, z - 0.14); return b; };
    this.box(0.9, 0.012, 0.3, std(0x25272a, 0.4, 0.5), -0.3, 2.527, 5.62, cab);                                // plate for the push buttons
    C.horn = push(-0.5, 5.62, 0xe8d21a, 'horn', 'زمارة'); C.door = push(-0.3, 5.62, 0x2a7fe0, 'door', 'أبواب'); C.emerg = push(-0.1, 5.62, 0xd32020, 'emerg', 'طوارئ'); C.light = push(0.1, 5.62, 0xeeeeea, 'light', 'أنوار');
    // live display over the big screen: speed, limit and the next stop
    this.scrC = U.canvas(256, 128); this.scrT = new THREE.CanvasTexture(this.scrC); this.scrT.encoding = THREE.sRGBEncoding; this._scrKey = null;
    { const g = this.scrC.getContext('2d'); g.fillStyle = '#05080a'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#7fe0ff'; g.font = '700 54px monospace'; g.fillText('  0', 10, 62); g.font = '16px monospace'; g.fillText('KM/H', 14, 84); this.scrT.needsUpdate = true; }
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.56), new THREE.MeshBasicMaterial({ map: this.scrT })); scr.rotation.set(-Math.PI / 2 - 0.33, 0, 0); scr.position.set(-0.55, 2.78, 6.62); cab.add(scr);
    C.lamps = [0x2e9a58, 0xe0a82a, 0xd32020].map((c, i) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: 0x222222 })); l.position.set(-1.07 + i * 0.07, 2.76, 6.44); l.userData.on = c; cab.add(l); return l; });
  }

  /* info: { notch, brake, doors (0..1), emerg, lights, horn, kmh, limit, dist, name } */
  setCabState(i) {
    const C = this.cabCtl; if (!C || !this.cab || !this.cab.visible) return;
    C.throttle.rotation.x = 0.55 - (i.notch / 8) * 1.1; C.brake.rotation.x = 0.55 - i.brake * 1.1;
    C.horn.position.y = i.horn ? 2.535 : 2.55; C.emerg.position.y = i.emerg ? 2.535 : 2.55; C.door.position.y = i.doors > 0.5 ? 2.535 : 2.55;
    C.light.material.emissiveIntensity = i.lights ? 1.2 : 0.1;
    [i.doors > 0.5, i.brake > 0.1, !!i.emerg].forEach((on, k) => C.lamps[k].material.color.setHex(on ? C.lamps[k].userData.on : 0x222222));
    const t = Math.floor(i.kmh) * 1000 + i.limit + (i.dist | 0) * 7; if (this._scrKey === t) return; this._scrKey = t;
    const g = this.scrC.getContext('2d'), W = 256, H = 128; g.fillStyle = '#071018'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#7fe0ff'; g.font = '700 54px monospace'; g.textAlign = 'left'; g.fillText(String(Math.round(i.kmh)).padStart(3, ' '), 10, 62); g.font = '16px monospace'; g.fillText('KM/H', 14, 84);
    g.fillStyle = '#ff6a5a'; g.beginPath(); g.arc(200, 40, 28, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(200, 40, 21, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = '700 24px monospace'; g.textAlign = 'center'; g.fillText(i.limit, 200, 49);
    g.textAlign = 'left'; g.fillStyle = '#f0c040'; g.font = '16px sans-serif'; g.fillText(String(i.name || ''), 10, 108); g.fillStyle = '#9fe0a0'; g.fillText(i.dist, 150, 108);
    this.scrT.needsUpdate = true;
  }

  setDoors(open) { for (const d of this.doors) d.position.z = d.userData.z0 + d.userData.dir * open * 1.18; }

  setDials(kmh, brake, power) {
    const vals = [kmh, brake * 5, power * 10];
    if (!this.dials) return;
    this.dials.forEach((d, i) => { const a = Math.PI * 0.75 + U.clamp(vals[i] / d.max, 0, 1) * Math.PI * 1.5; d.needle.rotation.z = Math.atan2(-Math.cos(a), -Math.sin(a)); });
  }

  setNight(on) { this.lm.winLit.emissiveIntensity = on ? 0.45 : 0; this.cm.winLit.emissiveIntensity = on ? 0.45 : 0; }

  setHeadlights(on) { if (this.spot) this.spot.intensity = on ? 0.8 : 0; this.lm.lamp.emissiveIntensity = on ? 1.8 : 0.8; }
}
