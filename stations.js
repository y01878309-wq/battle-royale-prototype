'use strict';
/* Stations (four sizes), signals, speed zones and lineside signs. Positions come from the Route. */
const STOP_BACK = 12;   // the stop mark sits this far before the end of the platform

/* Look of a station by region (see regionOf in data.js): wall colours, roof shape and colour, platform canopy colour, front colonnade, extras. */
const STATION_STYLES = {
  cairo: { tints: [0xe3d6b8, 0xd9cdb0, 0xe8e1d0], roof: 'slab', roofCol: 0x6d7378, canopy: 0x6d7378 },
  delta: { tints: [0xb5523a, 0xa8553f, 0xc27a52], roof: 'gable', roofCol: 0x8a3b28, canopy: 0x7a2d24 },
  alex: { tints: [0xf0ece0, 0xe7e2d3], roof: 'slab', roofCol: 0x2f5f8f, canopy: 0x2f5f8f, colonnade: 'arcade', tower: true },
  canal: { tints: [0xe8cd6e, 0xeadd9a], roof: 'hip', roofCol: 0x9a3f2a, canopy: 0x9a3f2a, colonnade: 'veranda' },
  middle: { tints: [0xd9b98a, 0xcfa878], roof: 'slab', roofCol: 0x8a7a62, canopy: 0x8a6a4a, cornice: true },
  upper: { tints: [0xe0b377, 0xd8a96b], roof: 'slab', roofCol: 0xb08a5a, canopy: 0xa07a4a, colonnade: 'papyrus', cornice: true },
  luxor: { tints: [0xe6c28a, 0xdfb97c], roof: 'slab', roofCol: 0xb08a5a, canopy: 0xb08a5a, pylon: true, cornice: true },
  aswan: { tints: [0xe28a68, 0xe9b04a, 0x5fb0b8, 0xe8d9d0], roof: 'slab', roofCol: 0xf0ede4, canopy: 0x3a8a9a, dome: true }
};

class Stations {
  constructor(scene, track, quality, route, vmax, brake) {
    this.scene = scene; this.track = track; this.q = quality; this.route = route; this.vmax = vmax;
    this.list = route.stations;
    this.zones = [];
    // the 90 km/h zone must start far enough out for the train to slow down from its top speed (a high-speed train needs about 2 km)
    const bd = Math.max(500, ((vmax / 3.6) ** 2 - 25 ** 2) / (2 * 0.8 * (brake || 1.0)) + 300);
    for (const st of this.list) this.zones.push({ s0: st.s - 600 - bd, s1: st.s - 600, lim: 90 }, { s0: st.s - 600, s1: st.s + st.pl / 2 + 60, lim: 60 });
    for (const c of route.crossings) this.zones.push({ s0: c - 250, s1: c + 250, lim: 80 });
  }

  /* Speed limit in km/h at distance s along the line. */
  limitAt(s) {
    const L = this.track.L; let lim = this.vmax;
    for (const z of this.zones) { const rel = ((s - z.s0) % L + L) % L; if (rel < z.s1 - z.s0) lim = Math.min(lim, z.lim); }
    return lim;
  }

  build() {
    this.mats = {
      concrete: new THREE.MeshStandardMaterial({ color: 0xb4ad9f, roughness: 0.92 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xe2b02a, roughness: 0.6 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x59606a, roughness: 0.5, metalness: 0.7 }),
      roofRed: new THREE.MeshStandardMaterial({ color: 0x7a2d24, roughness: 0.7, metalness: 0.2 }),
      roofGrey: new THREE.MeshStandardMaterial({ color: 0x6d7378, roughness: 0.6, metalness: 0.4 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x232220, roughness: 0.7 }),
      lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c0, emissiveIntensity: 0.15 }),
      tile: new THREE.MeshStandardMaterial({ color: 0xa5502e, roughness: 0.8 })
    };
    this.tileTex = Tex.tile();
    this.list.forEach((st, i) => this.buildStation(st, i));
    this.buildLineside();
  }

  place(obj, s, lat, y) {
    const fr = Track.makeFrame(), m = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
    this.track.frame(s, fr);
    obj.position.set(fr.pos.x + fr.right.x * lat, y, fr.pos.z + fr.right.z * lat);
    obj.quaternion.setFromRotationMatrix(Track.basis(m, fr, up));
    this.scene.add(obj); return obj;
  }

  mesh(geo, mat, parent, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }

  /* Building by station size. Local +x is to the left of the track, +z along it. */
  /* Cached plain material, so many stations of one region share it. */
  cmat(color, rough) { const k = color + '/' + (rough || 0.85); this._cm = this._cm || {}; return this._cm[k] || (this._cm[k] = new THREE.MeshStandardMaterial({ color, roughness: rough || 0.85 })); }
  styleOf(st) { return STATION_STYLES[st.region || regionOf(st.name)] || STATION_STYLES.cairo; }

  /* Front colonnade, cornice, pylons and domes that give a region its character. */
  regionDecor(root, st, spec, bx, front, z0, S, wallM) {
    const white = this.cmat(0xf2efe6), big = st.type === 'terminal' || st.type === 'major', n = Math.min(26, Math.floor((spec.len - 4) / 4.4));
    if (S.colonnade && st.type !== 'halt') {
      const ch = S.colonnade === 'papyrus' ? 4.4 : S.colonnade === 'veranda' ? 3.6 : 4.6, x = front - 1.6, cm = S.colonnade === 'papyrus' ? this.cmat(S.tints[0], 0.9) : white;
      for (let k = 0; k < n; k++) {
        const z = z0 - spec.len / 2 + 2.8 + k * ((spec.len - 5.6) / Math.max(1, n - 1));
        if (S.colonnade === 'papyrus') { const c = this.mesh(new THREE.CylinderGeometry(0.62, 0.34, ch, 10), cm, root, x, ch / 2, z); c.castShadow = true; }
        else { const c = this.mesh(new THREE.CylinderGeometry(0.2, 0.24, ch, 10), cm, root, x, ch / 2, z); c.castShadow = true; }
      }
      this.mesh(new THREE.BoxGeometry(2.7, 0.3, spec.len - 1.5), S.colonnade === 'papyrus' ? this.cmat(S.roofCol) : white, root, front - 1.45, ch + 0.15, z0);
      if (S.colonnade === 'arcade') for (let k = 0; k < n - 1; k++) { const z = z0 - spec.len / 2 + 2.8 + (k + 0.5) * ((spec.len - 5.6) / Math.max(1, n - 1)); const a = this.mesh(new THREE.TorusGeometry(1.0, 0.1, 6, 12, Math.PI), white, root, x, ch - 1.0, z); a.rotation.y = Math.PI / 2; }
    }
    if (S.cornice) { this.mesh(new THREE.BoxGeometry(spec.w + 1.6, 0.35, spec.len + 1.6), this.cmat(S.tints[0] + 0x101010, 0.9), root, bx, spec.h + 0.5, z0); }
    if (S.pylon && st.type !== 'halt') {
      const stone = this.cmat(S.tints[0], 0.95), dz = Math.min(spec.len / 2 - 3, 9);
      for (const e of [-1, 1]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 3.3, spec.h + 3.5, 4, 1), stone); t.geometry.rotateY(Math.PI / 4); t.position.set(front - 1.8, (spec.h + 3.5) / 2, z0 + e * dz); t.castShadow = true; root.add(t); }
      this.mesh(new THREE.BoxGeometry(2.6, 1.0, dz * 2 + 1), stone, root, front - 1.8, spec.h + 2.4, z0);
      this.mesh(new THREE.BoxGeometry(0.4, spec.h * 0.55, 3.6), this.cmat(0x2a2118), root, front - 0.4, spec.h * 0.275, z0);
    }
    if (S.dome) {
      const dm = this.cmat(0xf0ede4, 0.6), r = big ? 3.4 : 2.2;
      const d = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), dm); d.position.set(bx, spec.h + 0.5, z0); d.castShadow = true; root.add(d);
      for (const e of [-1, 1]) { const c = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dm); c.position.set(bx, spec.h + 0.5, z0 + e * (spec.len / 2 - 2.5)); root.add(c); }
      this.mesh(new THREE.BoxGeometry(spec.w + 0.2, 0.45, spec.len + 0.2), this.cmat(0xf0ede4), root, bx, spec.h - 0.8, z0);   // white band
    }
    if (S.tower && st.type === 'major') {
      this.mesh(new THREE.BoxGeometry(4, 15, 4), wallM, root, bx, 7.5, z0 + spec.len / 4);
      const c = this.mesh(new THREE.ConeGeometry(3.2, 4.5, 4), this.cmat(S.roofCol, 0.5), root, bx, 17.2, z0 + spec.len / 4); c.rotation.y = Math.PI / 4;
    }
  }

  buildBuilding(root, st, R) {
    const M = this.mats, S = this.styleOf(st), tints = S.tints;
    let h = 0; for (const ch of st.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const j = ((h >> 5) % 21 - 10) / 100;   // each station gets its own shade, size and extras
    const tint = new THREE.Color(tints[h % tints.length]).offsetHSL(((h >> 9) % 9 - 4) / 200, 0, j), roofMat = this.cmat(S.roofCol, 0.7);
    const spec = { terminal: { w: 16, h: 14, len: 84, fl: 2 }, major: { w: 11, h: 9.5, len: 54, fl: 2 }, town: { w: 8, h: 5.4, len: 28, fl: 1 }, halt: { w: 4, h: 3.2, len: 8, fl: 1 } }[st.type];
    spec.len = Math.round(spec.len * (0.85 + ((h >> 3) % 31) / 100)); spec.h *= 0.92 + ((h >> 7) % 17) / 100;
    const bx = 9 + spec.w / 2, front = bx - spec.w / 2, z0 = st.type === 'halt' ? -8 : 10;
    const wallM = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.92 });
    this.mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.len), wallM, root, bx, spec.h / 2, z0);
    const tex = Tex.facade(tint.getHex ? tint.getHex() : tint); tex.repeat.set(spec.len / 8.4, spec.fl);
    const fac = new THREE.Mesh(new THREE.PlaneGeometry(spec.len, spec.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    fac.position.set(front - 0.03, spec.h / 2, z0); fac.rotation.y = -Math.PI / 2; fac.receiveShadow = true; root.add(fac);
    if (st.type === 'town' || st.type === 'halt' || (S.roof === 'gable' && st.type !== 'terminal')) {
      // gabled tile roof
      const r = (spec.h * 0.42) / 1.5, geo = new THREE.CylinderGeometry(r, r, spec.len + 1.2, 3);
      geo.rotateX(-Math.PI / 2);                       // axis along the track, apex up
      const pr = new THREE.Mesh(geo, S.roof === 'slab' && st.type === 'halt' ? M.roofGrey : roofMat);
      pr.scale.x = (spec.w + 1.4) / 2 / (0.866 * r); pr.position.set(bx, spec.h + r / 2, z0); pr.castShadow = true; root.add(pr);
    } else if (S.roof === 'hip' && st.type !== 'terminal') {
      const hr = spec.h * 0.42, g = new THREE.ConeGeometry(1, 1, 4, 1); g.rotateY(Math.PI / 4);
      const hm = new THREE.Mesh(g, roofMat); hm.scale.set((spec.w + 1.6) / Math.SQRT2, hr, (spec.len + 1.6) / Math.SQRT2); hm.position.set(bx, spec.h + hr / 2, z0); hm.castShadow = true; root.add(hm);
    } else {
      this.mesh(new THREE.BoxGeometry(spec.w + 0.8, 0.5, spec.len + 0.8), S.roof === 'slab' && S.roofCol !== 0x6d7378 && st.type !== 'terminal' ? roofMat : M.concrete, root, bx, spec.h + 0.25, z0);       // roof slab
      this.mesh(new THREE.BoxGeometry(0.4, 0.8, spec.len + 0.8), M.concrete, root, front - 0.3, spec.h + 0.9, z0);      // parapet
    }
    this.regionDecor(root, st, spec, bx, front, z0, S, wallM);
    if (st.type !== 'halt') {   // advertising boards along the front, different text per station
      const ads = [['مياه نقية', '#0b6aa8'], ['اتصالات سريعة', '#c8102e'], ['بنك الصعيد', '#1b5e3b'], ['عصير طازج', '#e07a10'], ['سفر آمن', '#0a2a6a'], ['ألبان الريف', '#1a8a4a'], ['شاي الصباح', '#7a2a20']];
      const na = st.type === 'town' ? 1 : 2;
      for (let a = 0; a < na; a++) {
        const ad = ads[(h + a * 3) % ads.length], w = 4.2, hh = 2.2;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ map: Tex.sign(ad[0], 512, Math.round(512 * hh / w), ad[1], '#ffffff') }));
        m.position.set(front - 0.08, 2.4, z0 - spec.len / 2 + 5 + a * Math.min(10, spec.len / 3)); m.rotation.y = -Math.PI / 2; root.add(m);
      }
    }
    // station sign above the entrance
    const big = st.type === 'terminal' || st.type === 'major', sw = big ? 9 : 5, sh = big ? 1.8 : 1;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: Tex.sign('محطة ' + st.name, 768, Math.round(768 * sh / sw), '#8a2a20', '#f4f0e6') }));
    sign.position.set(front - 0.1, spec.h + (big ? 2.4 : 0.9), z0); sign.rotation.y = -Math.PI / 2; root.add(sign);
    if (st.type === 'terminal') {
      // clock tower
      this.mesh(new THREE.BoxGeometry(6, 24, 6), wallM, root, bx, 12, z0);
      const ct = Tex.clock();
      for (const [dx, dz, ry] of [[-3.03, 0, -Math.PI / 2], [3.03, 0, Math.PI / 2], [0, 3.03, 0], [0, -3.03, Math.PI]]) {
        const c = new THREE.Mesh(new THREE.CircleGeometry(2, 28), new THREE.MeshBasicMaterial({ map: ct })); c.position.set(bx + dx, 20.5, z0 + dz); c.rotation.y = ry; root.add(c);
      }
      const cone = this.mesh(new THREE.ConeGeometry(4.6, 6, 4), roofMat, root, bx, 27, z0); cone.rotation.y = Math.PI / 4;
    }
    if (big) {
      // footbridge over both platforms and the track
      const fz = -34, deck = new THREE.MeshStandardMaterial({ color: 0x5c6670, roughness: 0.6, metalness: 0.5 });
      this.mesh(new THREE.BoxGeometry(19, 0.3, 2.6), deck, root, 0, 6.8, fz);
      this.mesh(new THREE.BoxGeometry(19.4, 0.16, 3.4), M.roofGrey, root, 0, 8.7, fz);
      for (const sx of [-1, 1]) {
        this.mesh(new THREE.BoxGeometry(2.6, 6.8, 2.8), M.concrete, root, sx * 8.9, 3.4, fz);
        for (const e of [-1, 1]) this.mesh(new THREE.BoxGeometry(0.14, 1.9, 0.14), M.metal, root, sx * 8.9, 7.8, fz + e * 1.5);
      }
      for (const e of [-1, 1]) this.mesh(new THREE.BoxGeometry(19, 0.08, 0.08), M.metal, root, 0, 7.5, fz + e * 1.25);
    }
    if (st.type === 'major' || st.type === 'town') {
      // water tank on legs behind the building
      const tx = bx + spec.w / 2 + 6, tz = z0 + spec.len / 2 - 4;
      this.mesh(new THREE.CylinderGeometry(2.6, 2.6, 4, 16), M.roofGrey, root, tx, 11, tz);
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) this.mesh(new THREE.BoxGeometry(0.3, 9, 0.3), M.metal, root, tx + a * 1.8, 4.5, tz + b * 1.8);
    }
    return spec;
  }

  /* Big glazed barrel vault with steel arch ribs over the tracks and platforms of a terminal (Ramses style). */
  buildVault(root, st) {
    const M = this.mats, cl = st.pl - 30, a = 7.9, b = 6.0, y0 = 5.2;
    const g = new THREE.CylinderGeometry(1, 1, cl, 32, 1, true, -Math.PI / 2, Math.PI); g.rotateX(-Math.PI / 2);
    const glass = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xa9bcc6, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }));
    glass.scale.set(a, b, 1); glass.position.set(0, y0, 0); root.add(glass);
    const pts = []; for (let k = 0; k <= 24; k++) { const t = Math.PI * k / 24; pts.push(new THREE.Vector3(Math.cos(t) * a, y0 + Math.sin(t) * b, 0)); }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.13, 6, false), step = Math.max(9, cl / 22);
    for (let z = -cl / 2; z <= cl / 2 + 0.1; z += step) { const rib = new THREE.Mesh(geo, M.metal); rib.position.z = z; rib.castShadow = true; root.add(rib); }
    for (const x of [-4, 0, 4]) { const ph = Math.sqrt(Math.max(0, 1 - (x / a) * (x / a))) * b + y0; this.mesh(new THREE.BoxGeometry(0.1, 0.1, cl), M.metal, root, x, ph, 0); }   // purlins
    for (const sx of [-1, 1]) for (let z = -cl / 2; z <= cl / 2 + 0.1; z += step) this.mesh(new THREE.BoxGeometry(0.3, y0, 0.3), M.metal, root, sx * a, y0 / 2, z);
  }

  buildStation(st, idx) {
    const M = Object.assign({}, this.mats), root = new THREE.Group(), R = U.rng(300 + idx);
    st.region = regionOf(st.name); M.roofRed = this.cmat(this.styleOf(st).canopy, 0.7);   // canopies and kiosk roofs take the region's colour
    const half = st.pl / 2, ph = st.type === 'halt' ? 0.6 : 1.0;
    const canopy = { terminal: 1, major: 0.7, town: 0.4, halt: 0 }[st.type];
    for (const side of [-1, 1]) {
      const x = side * 4.5;
      this.mesh(new THREE.BoxGeometry(5.4, ph, st.pl), M.concrete, root, x, ph / 2, 0);
      this.mesh(new THREE.BoxGeometry(0.45, 0.02, st.pl), M.yellow, root, side * 2.4, ph + 0.012, 0);
      if (st.type !== 'halt') {   // terracotta tile surface
        const tt = this.tileTex.clone(); tt.needsUpdate = true; tt.repeat.set(2.4 / 2, st.pl / 2);
        const tp = new THREE.Mesh(new THREE.PlaneGeometry(4.8, st.pl), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.85 }));
        tp.rotation.x = -Math.PI / 2; tp.position.set(side * 4.8, ph + 0.004, 0); tp.receiveShadow = true; root.add(tp);
      }
      if (canopy > 0) {
        const cl = (st.pl - 30) * canopy, c0 = st.type === 'terminal' ? 0 : 10;
        for (let z = -cl / 2 + 5; z <= cl / 2 - 5; z += 15) this.mesh(new THREE.BoxGeometry(0.25, 4.2, 0.25), M.metal, root, side * 6.6, 3.1, c0 + z);
        if (st.type !== 'terminal') this.mesh(new THREE.BoxGeometry(6.2, 0.18, cl), M.roofRed, root, side * 5.3, 5.25, c0);
        for (let z = -cl / 2 + 8; z <= cl / 2 - 8; z += 30) this.mesh(new THREE.BoxGeometry(2.4, 0.08, 0.7), M.lamp, root, side * 5.6, 5.0, c0 + z);
      } else {
        for (const z of [-30, 30]) { this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6), M.dark, root, side * 6.6, 2.7, z); this.mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), M.lamp, root, side * 6.6, 4.9, z); }
      }
      for (let z = -half + 25; z <= half - 25; z += 40) {
        this.mesh(new THREE.BoxGeometry(1.6, 0.1, 0.45), M.dark, root, side * 5.7, ph + 0.5, z + 6);
        this.mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), M.dark, root, side * 5.95, ph + 0.8, z + 6);
      }
      // name boards facing the track (hung from the canopy, or on posts at halts)
      for (const z of [-60, 0, 60]) {
        const t = Tex.board(st.name, EN_NAMES[st.name], 512, 160);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.25), new THREE.MeshBasicMaterial({ map: t }));
        const yy = canopy > 0 ? 4.55 : 3.2;
        sign.position.set(side * 2.9, yy, z); sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 4.1), M.dark); back.position.set(side * 2.95 + side * 0.06, yy, z);
        root.add(sign, back);
      }
      if (canopy === 0 || idx % 2 === 0) { // ticket kiosk with awning
        this.mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x6c8a7c, roughness: 0.8 }), root, side * 6.1, ph + 1.2, -half + 14);
        this.mesh(new THREE.BoxGeometry(3.2, 0.12, 3.2), M.roofRed, root, side * 5.6, ph + 2.6, -half + 14);
      }
    }
    if (st.type === 'terminal') this.buildVault(root, st);
    this.buildBuilding(root, st, R);
    this.place(root, st.s, 0, 0);
    // things the chase camera must not poke through: roofs, canopies, footbridge, buildings (big boxes that reach above head height)
    st.occ = []; root.updateMatrixWorld(true);
    root.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry') { const q = o.geometry.parameters; if (Math.max(q.width, q.height, q.depth) > 2 && o.position.y + q.height / 2 > 3.4 && q.height < 40) st.occ.push(o); } });
    const f = Track.makeFrame(); this.track.frame(st.s, f); st.fr = { pos: f.pos.clone(), fwd: f.fwd.clone(), right: f.right.clone() };

    // waiting passengers come from the Crowd (crowd.js); here only the head count and platform height are recorded
    st.crowdN = Math.floor({ terminal: 120, major: 85, town: 50, halt: 22 }[st.type] * (this.q === 'low' ? 0.4 : 1)); st.ph = ph;

    // stop board and starter signal
    const sb = new THREE.Group();
    this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), M.dark, sb, 0, 2.3, 0);
    const stopTex = Tex.sign('قف', 256, 192, '#c8372b', '#f4f0e6');
    for (const f of [0, Math.PI]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.82), new THREE.MeshBasicMaterial({ map: stopTex })); p.position.set(0, 3.1, 0.04 * (f ? -1 : 1)); p.rotation.y = f; sb.add(p); }
    this.place(sb, st.stopS + 3, 3.0, ph - 0.0);
    const sg = new THREE.Group();
    this.mesh(new THREE.CylinderGeometry(0.07, 0.07, 5, 8), M.dark, sg, 0, 2.5, 0);
    this.mesh(new THREE.BoxGeometry(0.5, 1.5, 0.35), M.dark, sg, 0, 5.1, 0);
    st.signal = { red: new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2010, emissiveIntensity: 3 }), green: new THREE.MeshStandardMaterial({ color: 0x002200, emissive: 0x20ff40, emissiveIntensity: 0 }) };
    const lr = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), st.signal.red); lr.position.set(0, 5.4, -0.2); sg.add(lr);
    const lg = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), st.signal.green); lg.position.set(0, 4.85, -0.2); sg.add(lg);
    this.place(sg, st.stopS + 28, -4.2, 0).rotation.y += Math.PI;
    this.setSignal(idx, false);
  }

  setNight(on) { this.mats.lamp.emissiveIntensity = on ? 3 : 0.15; }

  setSignal(i, green) { const s = this.list[i].signal; s.red.emissiveIntensity = green ? 0.1 : 3; s.green.emissiveIntensity = green ? 3 : 0; }

  /* Kept for older callers: passengers are now animated by Crowd. */
  setBoarding() {}

  speedSign(lim) {
    const c = U.canvas(256, 256), g = c.getContext('2d');
    g.fillStyle = '#d9d4c4'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#f4f0e6'; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.fill();
    g.strokeStyle = '#c8372b'; g.lineWidth = 22; g.stroke();
    g.fillStyle = '#111'; g.font = '700 110px "Reem Kufi", Tajawal, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(lim), 128, 138);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }

  buildLineside() {
    const M = this.mats;
    const addSign = (s, lim) => {
      const g = new THREE.Group();
      this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), M.dark, g, 0, 1.5, 0);
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ map: this.speedSign(lim) })); p.position.set(0, 3.1, -0.04); p.rotation.y = Math.PI; g.add(p);
      this.place(g, s, -3.6, 0);
    };
    const seen = new Set();
    for (const z of this.zones) {
      addSign(z.s0, z.lim);
      const after = this.limitAt(z.s1 + 1), key = Math.round(z.s1 / 10);
      if (!seen.has(key)) { seen.add(key); addSign(z.s1, after); }
    }
    // 3-2-1 distance boards before every stop mark
    for (const st of this.list) for (let k = 3; k >= 1; k--) {
      const c = U.canvas(128, 256), g = c.getContext('2d'); g.fillStyle = '#1b3d70'; g.fillRect(0, 0, 128, 256); g.fillStyle = '#f4f0e6';
      for (let b = 0; b < k; b++) g.fillRect(24 + b * 36, 40, 20, 176);
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
      const grp = new THREE.Group(); this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), M.dark, grp, 0, 1.2, 0);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), new THREE.MeshBasicMaterial({ map: t })); p.position.set(0, 2.9, -0.04); p.rotation.y = Math.PI; grp.add(p);
      this.place(grp, st.stopS - k * 100, -3.4, 0);
    }
  }
}
