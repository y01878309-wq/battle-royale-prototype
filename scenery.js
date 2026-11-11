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
      if (Math.abs(lat) < 14 + 0 && this.inStation(s)) continue;
      if (this.inStation(s) && Math.abs(lat) < 60) continue;
      return { s, lat };
    }
    return null;
  }

  async build() {
    U.setProgress(0.55, 'النخيل والشجر…'); this.buildPalms(); await U.tick();
    U.setProgress(0.68, 'القرى والمآذن…'); this.buildVillages(); await U.tick();
    U.setProgress(0.82, 'أعمدة التلغراف والمزلقانات…'); this.buildPoles(); this.buildCrossings(); await U.tick();
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
        const p = new THREE.Vector3().copy(fr.pos).addScaledVector(fr.right, side * 5.2);
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
