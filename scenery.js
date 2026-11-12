'use strict';
/* Palms, trees, villages with mosques, telegraph poles and level crossings. */
class Scenery {
  constructor(scene, track, quality, route) {
    this.scene = scene; this.track = track; this.q = quality; this.route = route;
    this.k0 = quality === 'high' ? 1 : quality === 'medium' ? 0.65 : 0.35;
    this.k = this.k0 * Math.min(1.8, 0.6 + 0.4 * route.scale);
    this.R = U.rng(2024);
    this.crossings = []; this.trainS = 0; this.trainLen = 150;
  }

  inStation(s) {
    const L = this.track.L;
    return this.route.stations.some((st) => Math.abs(((s - st.s + L / 2) % L + L) % L - L / 2) < st.pl / 2 + 70);
  }

  /* How sandy the ground is at s (0 = green farmland, 1 = desert): Upper Egypt, the coast road to Matrouh and the Red Sea side. */
  sandAt(s) {
    const rg = this.regionAt(s), b = { upper: 0.8, luxor: 0.85, aswan: 0.95, matrouh: 0.9, redsea: 1, newvalley: 1, middle: 0.45, canal: 0.35 }[rg] || 0;
    return b * (0.85 + 0.3 * U.fbm(s / 900, 2.5, 7, 3, 33));
  }

  /* Sand either side of the line where the ground is desert, replacing the farmland pattern. */
  buildSand() {
    const tr = this.track, L = tr.L, step = 30, pos = [], uv = [], idx = [], fr = Track.makeFrame();
    let n = 0, runStart = -1;
    const flush = () => { runStart = -1; };
    const strips = [];
    let cur = null;
    for (let s = 0; s < L; s += step) { const on = this.sandAt(s) > 0.5; if (on) { if (!cur) cur = [s, s]; cur[1] = s + step; } else if (cur) { strips.push(cur); cur = null; } }
    if (cur) strips.push(cur);
    for (const [a, b] of strips) {
      const base = pos.length / 3, m = Math.max(1, Math.round((b - a) / step));
      for (let k = 0; k <= m; k++) {
        const sc = a + (b - a) * k / m, riverEdge = World.riverLat(sc) - World.riverWidth(sc) / 2 - 14;
        const left = -700, right = Math.min(700, riverEdge);
        for (const [lat, u] of [[left, 0], [-26, 1], [26, 2], [right, 3]]) { const w = tr.at(sc, lat, 0.04); pos.push(w.x, w.y, w.z); uv.push(lat / 40, sc / 40); }
      }
      for (let k = 0; k < m; k++) for (const q of [0, 2]) { const i = base + k * 4 + q, j = i + 4; idx.push(i, j, i + 1, i + 1, j, j + 1); }
    }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const t = Tex.sand(); t.repeat.set(1, 1);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, color: 0xffe6b8, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.receiveShadow = true; this.scene.add(m);
  }

  /* Region of the nearest station to s (see regionOf in data.js). */
  regionAt(s) {
    const L = this.track.L; let best = 'delta', bd = 1e12;
    for (const st of this.route.stations) { const d = Math.abs(((s - st.s + L / 2) % L + L) % L - L / 2); if (d < bd) { bd = d; best = regionOf(st.name); } }
    return best;
  }

  /* A random place beside the line that is not on the track, a station or the river. */
  spot(minLat, maxLeft, R) {
    for (let i = 0; i < 40; i++) {
      const s = R() * this.track.L, left = R() < 0.62;
      let lat;
      if (left) lat = -(minLat + Math.pow(R(), 1.6) * maxLeft);
      else { const edge = World.riverLat(s) - World.riverWidth(s) / 2 - 28; if (edge <= minLat + 8) continue; lat = minLat + R() * (edge - minLat); }
      if (R() < this.sandAt(s) * 0.55) continue;   // fewer trees and houses in the desert
      if (Math.abs(lat) < 14 + 0 && this.inStation(s)) continue;
      if (this.inStation(s) && Math.abs(lat) < 60) continue;
      return { s, lat };
    }
    return null;
  }

  async build() {
    U.setProgress(0.52, 'الرمال…'); this.buildSand(); U.setProgress(0.55, 'النخيل والشجر…'); this.buildPalms(); await U.tick();
    U.setProgress(0.68, 'القرى والمآذن…'); this.buildVillages(); await U.tick();
    U.setProgress(0.82, 'أعمدة التلغراف والمزلقانات…'); this.buildPoles(); this.buildCrossings(); await U.tick();
    U.setProgress(0.9, 'العمارات والطريق السريع…'); this.buildBlocks(); this.buildTraffic(); await U.tick();
  }

  buildPalms() {
    const R = this.R, n = Math.floor(2000 * this.k), tr = this.track;
    // frond crown: 14 arched leaves around the top of the trunk
    const parts = [];
    for (let i = 0; i < 14; i++) {
      const g = new THREE.PlaneGeometry(1.9, 5, 2, 6), p = g.attributes.position;
      for (let v = 0; v < p.count; v++) {
        const x = p.getX(v), y = p.getY(v), t = (y + 2.5) / 5;
        p.setXYZ(v, x * (0.55 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.05))), 1.5 * t - 3.1 * t * t + (i % 3) * 0.25, t * 5);
      }
      g.rotateY((i / 14) * Math.PI * 2 + (i % 2) * 0.2); g.computeVertexNormals(); parts.push(g);
    }
    const crown = U.merge(parts);
    const trunkG = new THREE.CylinderGeometry(0.2, 0.34, 1, 7, 1, true); trunkG.translate(0, 0.5, 0);
    const trunk = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x6d5a40, roughness: 1 }), n);
    const crowns = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ map: Tex.frond(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, color: 0xdfeacb }), n);
    const o = new THREE.Object3D(), top = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const clusters = []; for (let i = 0; i < 70; i++) { const p = this.spot(18, 420, R); if (p) clusters.push(p); }
    let c = 0;
    for (let i = 0; i < n; i++) {
      let s, lat;
      if (R() < 0.6 && clusters.length) { const cl = clusters[Math.floor(R() * clusters.length)]; s = cl.s + (R() - 0.5) * 90; lat = cl.lat + (R() - 0.5) * 70; }
      else { const p = this.spot(16, 420, R); if (!p) continue; s = p.s; lat = p.lat; }
      if (lat > 0 && lat > World.riverLat(s) - World.riverWidth(s) / 2 - 22) continue;
      if (Math.abs(lat) < 11 || (this.inStation(s) && Math.abs(lat) < 60)) continue;
      const w = tr.at(s, lat, 0), h = 6 + R() * 9, sc = 0.8 + R() * 0.5;
      const lx = (R() - 0.5) * 0.12, lz = (R() - 0.5) * 0.12;
      o.position.copy(w); o.rotation.set(lx, R() * 6.28, lz); o.scale.set(sc, h, sc); o.updateMatrix(); trunk.setMatrixAt(c, o.matrix);
      top.copy(up).applyEuler(o.rotation).multiplyScalar(h).add(w);
      o.position.copy(top); o.scale.setScalar(sc * (0.9 + h / 20)); o.updateMatrix(); crowns.setMatrixAt(c, o.matrix);
      c++;
    }
    trunk.count = crowns.count = c;
    trunk.castShadow = crowns.castShadow = true; trunk.receiveShadow = true;
    this.scene.add(trunk, crowns);

    // Broadleaf trees (ficus, eucalyptus) for variety.
    const tn = Math.floor(450 * this.k);
    const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.95 }), tn);
    const tg = new THREE.CylinderGeometry(0.15, 0.25, 1, 6); tg.translate(0, 0.5, 0);
    const stem = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 }), tn);
    const col = new THREE.Color(); c = 0;
    for (let i = 0; i < tn; i++) {
      const p = this.spot(14, 380, R); if (!p) continue;
      if (p.lat > 0 && p.lat > World.riverLat(p.s) - World.riverWidth(p.s) / 2 - 22) continue;
      const w = tr.at(p.s, p.lat, 0), h = 3 + R() * 4, r = 2 + R() * 2.4;
      o.position.copy(w); o.rotation.set(0, 0, 0); o.scale.set(1, h, 1); o.updateMatrix(); stem.setMatrixAt(c, o.matrix);
      o.position.set(w.x, h + r * 0.6, w.z); o.scale.set(r, r * 0.85, r); o.rotation.y = R() * 6; o.updateMatrix(); canopy.setMatrixAt(c, o.matrix);
      canopy.setColorAt(c, col.setHSL(0.24 + R() * 0.07, 0.4, 0.2 + R() * 0.1)); c++;
    }
    canopy.count = stem.count = c; canopy.instanceColor.needsUpdate = true;
    canopy.castShadow = stem.castShadow = true; this.scene.add(canopy, stem);
  }

  buildVillages() {
    const R = this.R, tr = this.track, nv = Math.floor(22 * Math.max(this.k0, 0.5) * Math.min(2.5, this.route.scale)), wallTex = Tex.wall(), roofTex = Tex.roof();
    const wallM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
    const roofM = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 1 });
    const mats = [wallM, wallM, roofM, roofM, wallM, wallM];
    const per = [[], [], [], []];
    const grid = new Map(), o = new THREE.Object3D(), fr = Track.makeFrame();
    const tanks = [], rebar = [];
    for (let v = 0; v < nv; v++) {
      const p = this.spot(50, 200, R); if (!p) continue; p.rg = this.regionAt(p.s);
      const cnt = Math.floor((24 + R() * 30) * Math.max(this.k, 0.5));
      tr.frame(p.s, fr); const yaw = Math.atan2(fr.fwd.x, fr.fwd.z);
      for (let i = 0; i < cnt; i++) {
        const dx = (R() - 0.5) * 150, dz = (R() - 0.5) * 120;
        const w = tr.at(p.s + dz, p.lat + dx, 0);
        const lat = p.lat + dx, s = p.s + dz;
        if (Math.abs(lat) < 24 || (this.inStation(s) && Math.abs(lat) < 70)) continue;
        if (lat > 0 && lat > World.riverLat(s) - World.riverWidth(s) / 2 - 30) continue;
        const key = Math.round(w.x / 12) + ',' + Math.round(w.z / 12); if (grid.has(key)) continue; grid.set(key, 1);
        const rg = p.rg, f = rg === 'upper' || rg === 'aswan' ? (R() < 0.6 ? 1 : 2) : rg === 'cairo' || rg === 'alex' ? (R() < 0.15 ? 2 : 3) : R() < 0.4 ? 1 : R() < 0.65 ? 2 : 3, sx = 6 + R() * 5, sz = 6 + R() * 4;
        const a = yaw + (R() < 0.15 ? (R() - 0.5) * 1.2 : 0);
        o.position.copy(w); o.rotation.set(0, a, 0); o.scale.set(sx, 1, sz); o.updateMatrix();
        per[f].push({ m: o.matrix.clone(), t: R(), rg });
        const roofY = 3.2 * f;
        if (R() < 0.4) { o.position.set(w.x, roofY + 0.6, w.z); o.scale.set(1, 1, 1); o.rotation.set(0, 0, 0); o.updateMatrix(); tanks.push(o.matrix.clone()); }
        if (f > 1 && R() < 0.35) for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const lx = ox * sx * 0.45, lz = oz * sz * 0.45, c = Math.cos(a), sn = Math.sin(a);
          o.position.set(w.x + lx * c + lz * sn, roofY + 0.8, w.z - lx * sn + lz * c); o.rotation.set(0, a, 0); o.scale.set(1, 1, 1); o.updateMatrix(); rebar.push(o.matrix.clone());
        }
      }
      this.addMosque(p.s + 10, p.lat + (R() - 0.5) * 30, yaw);
    }
    const tints = [[1, .93, .8], [.95, .82, .7], [.82, .88, .9], [.96, .9, .62], [.85, .84, .82], [1, 1, .97], [.9, .72, .62]];
    // house colours by region: red brick in the Delta, mud and sand in Upper Egypt, bright Nubian colours near Aswan
    const RT = {
      delta: [[1.0, .62, .5], [.95, .55, .42], [.88, .5, .4], [.85, .84, .82]],
      cairo: [[.85, .84, .82], [.95, .88, .75], [.9, .8, .7], [.8, .82, .85]],
      alex: [[1, 1, .97], [.95, .95, .9], [.85, .9, .95], [.92, .88, .8]],
      canal: [[1, .93, .6], [.95, .85, .55], [.9, .9, .85], [.9, .7, .55]],
      middle: [[.9, .78, .6], [.85, .72, .55], [.95, .85, .7], [.8, .7, .58]],
      upper: [[.82, .68, .5], [.78, .62, .45], [.88, .74, .56], [.7, .6, .48]],
      luxor: [[.9, .76, .55], [.85, .7, .5], [.95, .85, .65]],
      matrouh: [[1, 1, .95], [.95, .93, .85], [.85, .9, .95]],
      redsea: [[.92, .85, .7], [.85, .8, .7]],
      newvalley: [[.85, .7, .52], [.78, .64, .48]],
      aswan: [[1, .55, .4], [1, .85, .35], [.4, .75, .8], [.95, .9, .85], [.75, .5, .7], [.5, .75, .5]]
    };
    const col = new THREE.Color();
    for (let f = 1; f <= 3; f++) {
      const list = per[f]; if (!list.length) continue;
      const g = new THREE.BoxGeometry(1, 3.2 * f, 1); g.translate(0, 1.6 * f, 0);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * f);
      const im = new THREE.InstancedMesh(g, mats, list.length);
      list.forEach((h, i) => { im.setMatrixAt(i, h.m); const pal = RT[h.rg] || tints, t = pal[Math.floor(h.t * pal.length) % pal.length]; im.setColorAt(i, col.setRGB(t[0], t[1], t[2])); });
      im.instanceColor.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; this.scene.add(im);
    }
    if (tanks.length) {
      const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.5 }), tanks.length);
      tanks.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; this.scene.add(im);
    }
    if (rebar.length) {
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 1.6, 0.28), new THREE.MeshStandardMaterial({ color: 0x7a746a, roughness: 1 }), rebar.length);
      rebar.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; this.scene.add(im);
    }
  }

  addMosque(s, lat, yaw) {
    const w = this.track.at(s, lat, 0), g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 });
    const dome = new THREE.MeshStandardMaterial({ color: 0x4f7f6c, roughness: 0.45, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(13, 8, 13), stone); body.position.y = 4; g.add(body);
    const d = new THREE.Mesh(new THREE.SphereGeometry(4.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), dome); d.position.y = 8; g.add(d);
    const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 2, 6), new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 0.8, roughness: 0.3 })); fin.position.y = 14; g.add(fin);
    const mx = 8, shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.1, 24, 12), stone); shaft.position.set(mx, 12, mx); g.add(shaft);
    const bal = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.5, 0.6, 12), stone); bal.position.set(mx, 19, mx); g.add(bal);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 5, 12), stone); top.position.set(mx, 22, mx); g.add(top);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.95, 3, 12), dome); cone.position.set(mx, 26, mx); g.add(cone);
    const cres = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.07, 6, 12, Math.PI * 1.5), fin.material); cres.position.set(mx, 28.2, mx); g.add(cres);
    g.position.copy(w); g.rotation.y = yaw; g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    this.scene.add(g);
  }

  /* How built-up the ground beside the line is at s (0..1): rows of apartment blocks appear where it is high. */
  urban(s) {
    const rg = this.regionAt(s), base = { cairo: 0.75, delta: 0.55, alex: 0.7, canal: 0.5, middle: 0.38, matrouh: 0.3, upper: 0.2, luxor: 0.25, aswan: 0.15, redsea: 0.1, newvalley: 0.15 }[rg] || 0.4;
    return base * (0.45 + 1.1 * U.fbm(s / 700, 0.5, 5, 3, 21));
  }

  /* Rows of tall apartment blocks along both sides, with shops on the ground floor, and a highway beside them. */
  buildBlocks() {
    const tr = this.track, L = tr.L, R = U.rng(909), fr = Track.makeFrame(), o = new THREE.Object3D();
    const aptM = new THREE.MeshStandardMaterial({ map: Tex.apt(), roughness: 0.95 }), shopM = new THREE.MeshStandardMaterial({ map: Tex.shops(), roughness: 0.9 });
    const roofM = new THREE.MeshStandardMaterial({ color: 0x8a857c, roughness: 1 });
    const per = {}, shops = [], tanks = [], runs = [];
    let run = null;
    const step = 14;
    for (let s = 60; s < L - 60; s += step) {
      const u = this.urban(s), on = u > 0.5 && !this.inStation(s);
      if (!on) { if (run) { if (run[1] - run[0] > 120) runs.push(run); run = null; } continue; }
      if (!run) run = [s, s];
      run[1] = s;
      tr.frame(s, fr); const yaw = Math.atan2(fr.fwd.x, fr.fwd.z);
      for (const side of [-1, 1]) {
        const lat = side * (side < 0 ? 44 : 40) + (R() - 0.5) * 3;
        if (side > 0 && lat > World.riverLat(s) - World.riverWidth(s) / 2 - 36) continue;
        if (R() < 0.12) continue;                                                                           // gap between blocks
        const rg = this.regionAt(s), tall = rg === 'cairo' || rg === 'alex' ? 6 : 4, F = tall + Math.floor(R() * 4), w = tr.at(s, lat, 0);
        o.position.copy(w); o.rotation.set(0, yaw, 0); o.scale.set(14, 1, 11 + R() * 2); o.updateMatrix();
        (per[F] = per[F] || []).push({ m: o.matrix.clone(), t: R() });
        o.position.y = 0; o.scale.set(14.2, 1, 11.2); o.updateMatrix(); shops.push(o.matrix.clone());
        if (R() < 0.5) { o.position.set(w.x, F * 3.2 + 0.7, w.z); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); tanks.push(o.matrix.clone()); }
      }
    }
    if (run && run[1] - run[0] > 120) runs.push(run);
    this.runs = runs;
    const tints = [[1, .9, .8], [.95, .78, .62], [.85, .8, .72], [.9, .7, .55], [1, .95, .85], [.78, .72, .65], [.92, .82, .6]], col = new THREE.Color();
    for (const F of Object.keys(per)) {
      const list = per[F], n = +F, g = new THREE.BoxGeometry(1, 3.2 * n, 1); g.translate(0, 1.6 * n, 0);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i) * n / 2);
      const im = new THREE.InstancedMesh(g, [aptM, aptM, roofM, roofM, aptM, aptM], list.length);
      list.forEach((h, i) => { im.setMatrixAt(i, h.m); const t = tints[Math.floor(h.t * tints.length) % tints.length]; im.setColorAt(i, col.setRGB(t[0], t[1], t[2])); });
      im.instanceColor.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; this.scene.add(im);
    }
    if (shops.length) {
      const g = new THREE.BoxGeometry(1, 3.4, 1); g.translate(0, 1.7, 0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i));
      const im = new THREE.InstancedMesh(g, shopM, shops.length); shops.forEach((m, i) => im.setMatrixAt(i, m)); im.receiveShadow = true; this.scene.add(im);
    }
    if (tanks.length) {
      const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.8, 0.8, 1.3, 12), new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.5 }), tanks.length);
      tanks.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; this.scene.add(im);
    }
  }

  /* Highway beside the line through the built-up stretches, with cars driving both ways, plus cars waiting at level crossings. */
  buildTraffic() {
    const tr = this.track, runs = this.runs || [], HW = 24, LAT = -22;
    this.cars = [];
    const roadM = new THREE.MeshStandardMaterial({ map: Tex.road(), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const [a, b] of runs) {
      const a2 = a - 60, b2 = b + 60, n = Math.ceil((b2 - a2) / 10), pos = [], uv = [], idx = [];
      for (let k = 0; k <= n; k++) { const s = a2 + (b2 - a2) * k / n; for (const sd of [-1, 1]) { const w = tr.at(s, LAT + sd * HW / 2, 0.06); pos.push(w.x, w.y, w.z); uv.push(sd < 0 ? 0 : 1, (s - a2) / 12); } }
      for (let k = 0; k < n; k++) { const i = k * 2; idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, roadM); m.receiveShadow = true; this.scene.add(m);
    }
    const R = U.rng(321), q = this.q === 'high' ? 1 : this.q === 'medium' ? 0.6 : 0.3;
    for (const [a, b] of runs) { const cnt = Math.min(14, Math.floor((b - a) / 60 * q)); for (let i = 0; i < cnt; i++) this.cars.push({ kind: 'road', a: a - 60, b: b + 60, s: a + R() * (b - a), dir: R() < 0.5 ? 1 : -1, v: 10 + R() * 12, k: Math.floor(R() * 5) }); }
    for (let ci = 0; ci < this.crossings.length; ci++) for (let i = 0; i < 3; i++) this.cars.push({ kind: 'x', c: this.crossings[ci], lat: (i - 1) * 30 + R() * 10, dir: i % 2 ? 1 : -1, v: 6 + R() * 3, k: Math.floor(R() * 5), cur: 0 });
    if (!this.cars.length) return;
    // body + cabin as two instanced meshes; kind decides colour and size
    const spec = [[0xf0c020, 4.4, 1.5], [0xf2f2ee, 5.2, 2.0], [0x1d1d1d, 2.7, 1.7], [0xc43a2e, 4.3, 1.4], [0x3a6ac4, 4.5, 1.5]], n = this.cars.length;
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), n);
    const cab = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.7, 0.55), new THREE.MeshStandardMaterial({ color: 0x1a2630, roughness: 0.3 }), n);
    this.carSpec = spec; this.carBody = body; this.carCab = cab; const c = new THREE.Color();
    this.cars.forEach((car, i) => { body.setColorAt(i, c.setHex(spec[car.k][0])); });
    body.instanceColor.needsUpdate = true; body.frustumCulled = cab.frustumCulled = false; this.scene.add(body, cab);
    this._o = new THREE.Object3D(); this._p = new THREE.Vector3(); this._p2 = new THREE.Vector3();
  }

  updateTraffic(dt) {
    if (!this.cars || !this.cars.length) return;
    const tr = this.track, o = this._o, p = this._p, p2 = this._p2;
    this.cars.forEach((car, i) => {
      const sp = this.carSpec[car.k]; let yaw;
      if (car.kind === 'road') {
        car.s += car.dir * car.v * dt; if (car.s > car.b) car.s = car.a; else if (car.s < car.a) car.s = car.b;
        const lat = (-22) + car.dir * 3.2; tr.at(car.s, lat, 0.06, p); tr.at(car.s + car.dir, lat, 0.06, p2); yaw = Math.atan2(p2.x - p.x, p2.z - p.z);
      } else {
        const gate = car.c, stopAt = 10; let v = car.v;
        if (gate.closed) { const sr = stopAt + TRACK_SP;   // right-hand queue waits beyond the second track
          if (car.dir > 0 && car.lat < -stopAt - 2 && car.lat > -stopAt - 14 && -stopAt - car.lat < 5) v = 0;
          else if (car.dir < 0 && car.lat > sr + 2 && car.lat < sr + 14 && car.lat - sr < 5) v = 0; }
        car.lat += car.dir * v * dt; if (car.lat > 55) car.lat = -55; else if (car.lat < -55) car.lat = 55;
        const fr = this._fr || (this._fr = Track.makeFrame()); tr.frame(gate.s, fr);
        p.copy(fr.pos).addScaledVector(fr.right, car.lat).setY(0.5 + 0.06); yaw = Math.atan2(fr.right.x, fr.right.z) + (car.dir > 0 ? 0 : Math.PI);
        p.addScaledVector(fr.fwd, car.dir > 0 ? 1.6 : -1.6);
      }
      o.position.copy(p); o.position.y += sp[2] * 0.5 + 0.3; o.rotation.set(0, yaw, 0); o.scale.set(1, sp[2], sp[1]); o.updateMatrix(); this.carBody.setMatrixAt(i, o.matrix);
      o.position.y += sp[2] * 0.5 + 0.2; o.scale.set(1, 1, sp[1] * 0.55); o.updateMatrix(); this.carCab.setMatrixAt(i, o.matrix);
    });
    this.carBody.instanceMatrix.needsUpdate = true; this.carCab.instanceMatrix.needsUpdate = true;
  }

  buildPoles() {
    const tr = this.track, step = 55, n = Math.floor(tr.L / step), fr = Track.makeFrame();
    const o = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
    const pg = new THREE.CylinderGeometry(0.1, 0.16, 8.4, 6); pg.translate(0, 4.2, 0);
    const poles = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0x5b4a38, roughness: 1 }), n);
    const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x4a3c2e, roughness: 1 }), n);
    const wires = [], tops = [];
    for (let i = 0; i < n; i++) {
      tr.frame(i * step, fr);
      const lat = -8.5, x = fr.pos.x + fr.right.x * lat, z = fr.pos.z + fr.right.z * lat;
      o.position.set(x, 0, z); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); poles.setMatrixAt(i, o.matrix);
      Track.basis(m, fr, up); m.setPosition(x, 7.9, z); arms.setMatrixAt(i, m);
      tops.push([x, z, fr.right.x, fr.right.z]);
    }
    poles.castShadow = true; this.scene.add(poles, arms);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = tops[i], b = tops[(i + 1) % n];
      for (const off of [-0.95, 0, 0.95]) {
        let px = a[0] + a[2] * off, pz = a[1] + a[3] * off;
        for (let k = 1; k <= 6; k++) {
          const t = k / 6, qx = U.lerp(a[0] + a[2] * off, b[0] + b[2] * off, t), qz = U.lerp(a[1] + a[3] * off, b[1] + b[3] * off, t);
          const y0 = 7.85 - Math.sin(((k - 1) / 6) * Math.PI) * 0.7, y1 = 7.85 - Math.sin((t) * Math.PI) * 0.7;
          pts.push(px, y0, pz, qx, y1, qz); px = qx; pz = qz;
        }
      }
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x1b1b1b })));
  }

  buildCrossings() {
    const tr = this.track, fr = Track.makeFrame(), up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
    const road = new THREE.MeshStandardMaterial({ color: 0x3b3935, roughness: 0.95 });
    const sc = U.canvas(64, 8), g = sc.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f0e6' : '#c8372b'; g.fillRect(i * 8, 0, 8, 8); }
    const st = new THREE.CanvasTexture(sc); st.encoding = THREE.sRGBEncoding;
    const armM = new THREE.MeshStandardMaterial({ map: st, roughness: 0.6 });
    const postM = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.6 });
    for (const s of this.route.crossings) {
      tr.frame(s, fr);
      const q = new THREE.Quaternion().setFromRotationMatrix(Track.basis(m, fr, up));
      const slab = new THREE.Mesh(new THREE.BoxGeometry(110, 0.14, 5.6), road);
      slab.position.set(fr.pos.x, 0.43, fr.pos.z); slab.quaternion.copy(q); slab.receiveShadow = true; this.scene.add(slab);
      const lamps = [], arms = [];
      for (const side of [-1, 1]) {
        const p = new THREE.Vector3().copy(fr.pos).addScaledVector(fr.right, side * 5.2 + (side > 0 ? TRACK_SP : 0));
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 8), postM); post.position.set(p.x, 1.7, p.z); post.castShadow = true; this.scene.add(post);
        const grp = new THREE.Group(); grp.position.set(p.x, 1.1, p.z).addScaledVector(fr.fwd, -3.2); grp.quaternion.copy(q);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 6.4), armM); arm.position.z = 3.2; arm.castShadow = true;
        const pivot = new THREE.Group(); pivot.add(arm); grp.add(pivot);
        this.scene.add(grp); arms.push(pivot);
        for (const k of [-1, 1]) {
          const lm = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2010, emissiveIntensity: 0, roughness: 0.4 });
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lm);
          lamp.position.set(p.x, 3.5, p.z).addScaledVector(fr.fwd, k * 0.35); this.scene.add(lamp); lamps.push({ lm, k });
        }
      }
      this.crossings.push({ s, arms, lamps, ang: 0, closed: false });
    }
  }

  update(dt, time) {
    const L = this.track.L;
    this._tt = (this._tt || 0) + dt; if (this._tt > 0.033) { this.updateTraffic(this._tt); this._tt = 0; }
    for (const c of this.crossings) {
      const ahead = ((c.s - this.trainS) % L + L) % L;
      const closed = ahead < 650 || ahead > L - this.trainLen - 14;
      const target = closed ? 0 : -1.35;
      const moving = Math.abs(c.ang - target) > 0.01;
      if (closed !== c.closed) c.closed = closed;
      c.ang += Math.sign(target - c.ang) * Math.min(Math.abs(target - c.ang), dt * 0.3);
      for (const a of c.arms) a.rotation.x = c.ang;
      const flash = closed || moving;
      for (const l of c.lamps) l.lm.emissiveIntensity = flash ? (((Math.floor(time * 2.5) + (l.k > 0 ? 1 : 0)) % 2) ? 3 : 0.1) : 0;
    }
  }
}
