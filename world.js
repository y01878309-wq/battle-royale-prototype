'use strict';
/* Terrain, Nile, desert cliffs, the Giza plateau and river boats. */
class World {
  constructor(scene, track, sky, quality, route) {
    this.scene = scene; this.track = track; this.sky = sky; this.quality = quality; this.route = route;
    this.W = route.scale; this.delta = route.env === 'delta';
    this.boats = []; this.waterTex = null; this.time = 0;
  }

  /* The Nile runs alongside the line on the right-hand side. */
  static riverLat(s) { return 250 + 55 * Math.sin(s / 800) + 30 * Math.sin(s / 310 + 1); }
  static riverWidth(s) { return 170 + 40 * Math.sin(s / 530); }

  async build() {
    U.setProgress(0.12, 'الأرض والزراعات…');
    this.buildGround(); await U.tick();
    U.setProgress(0.3, 'الصحرا والجبل…');
    this.buildDesert(); await U.tick();
    U.setProgress(0.42, 'النيل…');
    this.buildRiver(); await U.tick();
    U.setProgress(0.5, 'الأهرامات…');
    this.buildPyramids(); await U.tick();
    this.buildBoats();
    this.scenery = new Scenery(this.scene, this.track, this.quality, this.route);
    await this.scenery.build();
  }

  buildGround() {
    const R = (this.delta ? 9000 : 5600) * this.W, t = Tex.ground(); t.repeat.set(R * 2 / 140, R * 2 / 140);
    const m = new THREE.Mesh(new THREE.CircleGeometry(R, 96),
      new THREE.MeshStandardMaterial({ map: t, roughness: 1, metalness: 0 }));
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true; this.scene.add(m);
    this.ground = m;
  }

  buildDesert() {
    const st = Tex.sand(); st.repeat.set(200 * this.W, 200 * this.W);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(60000 * this.W, 60000 * this.W),
      new THREE.MeshStandardMaterial({ map: st, roughness: 1 }));
    plane.rotation.x = -Math.PI / 2; plane.position.y = -0.6; this.scene.add(plane);
    if (this.delta) return;                       // Delta: flat farmland, no cliffs
    const W = this.W;

    const nr = 44, nt = 220, r0 = 4600 * W, r1 = 9800 * W, pos = [], col = [], idx = [];
    const strata = [[0.80, 0.66, 0.46], [0.74, 0.58, 0.40], [0.86, 0.72, 0.52], [0.70, 0.54, 0.38]];
    for (let i = 0; i <= nr; i++) for (let j = 0; j <= nt; j++) {
      const r = r0 + (r1 - r0) * i / nr, th = (j / nt) * Math.PI * 2;
      const n = U.fbm(Math.cos(th) * 3 + 8, Math.sin(th) * 3 + 8, 1000, 3, 61);
      const n2 = U.fbm(r / 260, th * 12, 64, 3, 62);
      let h = U.smooth(4700 * W, 6600 * W, r) * (1 - U.smooth(8200 * W, 9800 * W, r)) * (50 + 150 * n) + 14 * n2 * U.smooth(4700 * W, 5600 * W, r);
      const terr = Math.floor(h / 16) * 16; h = U.lerp(h, terr, 0.55);
      pos.push(Math.cos(th) * r, h - 0.3, Math.sin(th) * r);
      const sc = strata[Math.floor(h / 16) % 4], k = 0.9 + 0.2 * n2;
      col.push(sc[0] * k, sc[1] * k, sc[2] * k);
    }
    for (let i = 0; i < nr; i++) for (let j = 0; j < nt; j++) {
      const a = i * (nt + 1) + j, b = a + 1, c = a + nt + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const ring = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
    ring.receiveShadow = true; this.scene.add(ring);
  }

  buildRiver() {
    const tr = this.track, n = Math.ceil(tr.L / 8), fr = Track.makeFrame();
    const wp = [], wu = [], bp = [], bu = [], wi = [], bi = [];
    for (let k = 0; k <= n; k++) {
      const s = k * tr.L / n; tr.frame(s, fr);
      const c = World.riverLat(s), hw = World.riverWidth(s) / 2;
      const put = (arr, uvs, lat, y, u) => { arr.push(fr.pos.x + fr.right.x * lat, y, fr.pos.z + fr.right.z * lat); uvs.push(u, s / 30); };
      put(wp, wu, c - hw, 0.06, 0); put(wp, wu, c + hw, 0.06, hw * 2 / 30);
      // Banks: wet mud sloping into the water, then a low levee.
      put(bp, bu, c - hw - 12, 0.0, 0); put(bp, bu, c - hw - 3, 0.5, 0.3); put(bp, bu, c - hw + 4, 0.08, 0.6);
      put(bp, bu, c + hw - 4, 0.08, 0); put(bp, bu, c + hw + 3, 0.5, 0.3); put(bp, bu, c + hw + 12, 0.0, 0.6);
    }
    for (let k = 0; k < n; k++) {
      const a = k * 2; wi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      for (const o of [0, 3]) for (let j = 0; j < 2; j++) {
        const q = k * 6 + o + j, w = q + 6;
        bi.push(q, q + 1, w, q + 1, w + 1, w);
      }
    }
    const mk = (p, u, ix) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); g.setIndex(ix); g.computeVertexNormals(); return g; };
    this.waterTex = Tex.waterNormal(); this.waterTex.repeat.set(1, 1);
    const water = new THREE.Mesh(mk(wp, wu, wi), new THREE.MeshStandardMaterial({
      color: 0x2c5f5b, roughness: 0.07, metalness: 0.15, normalMap: this.waterTex, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 1.6
    }));
    water.receiveShadow = true; this.scene.add(water); this.water = water;
    const bank = new THREE.Mesh(mk(bp, bu, bi), new THREE.MeshStandardMaterial({ color: 0x6a5a3e, roughness: 1, side: THREE.DoubleSide }));
    bank.receiveShadow = true; this.scene.add(bank);
  }

  buildPyramids() {
    const giza = this.route.stations.find((x) => x.name === 'الجيزة');
    if (!giza || this.delta) return;
    const tr = this.track, s0 = giza.s, fr = tr.frame(s0, Track.makeFrame());
    const out = fr.right.clone().multiplyScalar(-1);            // away from the river
    const c = fr.pos.clone().addScaledVector(out, 2400).addScaledVector(fr.fwd, 400);
    const st = Tex.sand(); st.repeat.set(30, 30);
    const plateau = new THREE.Mesh(new THREE.CylinderGeometry(900, 1100, 3, 48), new THREE.MeshStandardMaterial({ map: st, roughness: 1 }));
    plateau.position.set(c.x, 1.4, c.z); plateau.receiveShadow = true; this.scene.add(plateau);
    const lim = Tex.sand(); lim.repeat.set(10, 10);
    const mat = new THREE.MeshStandardMaterial({ map: lim, color: 0xe3cf9c, roughness: 0.95 });
    const defs = [[230, 139, 0, 0], [215, 136, 330, -260], [103, 65, 590, -480]];
    for (const [base, h, dx, dz] of defs) {
      const p = new THREE.Mesh(new THREE.ConeGeometry(base / Math.SQRT2, h, 4, 1), mat);
      p.rotation.y = Math.PI / 4 + Math.atan2(out.x, out.z) * 0.0; p.position.set(c.x + dx * fr.fwd.x + dz * out.x, 3 + h / 2, c.z + dx * fr.fwd.z + dz * out.z);
      p.castShadow = true; p.receiveShadow = true; this.scene.add(p);
    }
  }

  buildBoats() {
    const R = U.rng(77), hullM = new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.85 });
    const sailM = new THREE.MeshStandardMaterial({ color: 0xf2ecde, roughness: 0.9, side: THREE.DoubleSide });
    const mastM = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.9 });
    const sailGeo = new THREE.BufferGeometry();
    sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.2, -0.2, 0, 8.6, 0.1, 0, 1.3, 5.8], 3));
    sailGeo.computeVertexNormals();
    const count = this.quality === 'low' ? 4 : 9;
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 7.5), hullM); hull.position.y = 0.3; g.add(hull);
      const bow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 4), hullM); bow.rotation.x = Math.PI / 2; bow.rotation.z = Math.PI / 4; bow.position.set(0, 0.55, 4.7); g.add(bow);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 8.6, 6), mastM); mast.position.set(0, 4.4, 0.6); g.add(mast);
      const sail = new THREE.Mesh(sailGeo, sailM); sail.position.set(0.0, 0.2, -2.0); sail.rotation.y = 0; g.add(sail);
      hull.castShadow = sail.castShadow = true;
      this.scene.add(g);
      this.boats.push({ g, s: R() * this.track.L, off: (R() - 0.5) * 70, sp: 0.8 + R() * 1.6, ph: R() * 6.28 });
    }
  }

  update(dt, time) {
    if (this.waterTex) { this.waterTex.offset.x += dt * 0.004; this.waterTex.offset.y -= dt * 0.012; }
    const fr = this._f || (this._f = Track.makeFrame());
    for (const b of this.boats) {
      b.s = this.track.wrap(b.s + b.sp * dt);
      this.track.frame(b.s, fr);
      const lat = World.riverLat(b.s) + b.off;
      b.g.position.set(fr.pos.x + fr.right.x * lat, 0.12 + Math.sin(time * 0.9 + b.ph) * 0.05, fr.pos.z + fr.right.z * lat);
      b.g.rotation.set(Math.sin(time * 0.7 + b.ph) * 0.03, Math.atan2(fr.fwd.x, fr.fwd.z), Math.sin(time * 0.8 + b.ph) * 0.04, 'YXZ');
    }
    if (this.scenery) this.scenery.update(dt, time);
  }
}
