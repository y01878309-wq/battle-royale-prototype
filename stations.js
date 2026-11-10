'use strict';
/* Stations (four sizes), signals, speed zones and lineside signs. Positions come from the Route. */
const STOP_BACK = 12;   // the stop mark sits this far before the end of the platform

class Stations {
  constructor(scene, track, quality, route, vmax) {
    this.scene = scene; this.track = track; this.q = quality; this.route = route; this.vmax = vmax;
    this.list = route.stations;
    this.zones = [];
    for (const st of this.list) this.zones.push({ s0: st.s - 1100, s1: st.s - 600, lim: 90 }, { s0: st.s - 600, s1: st.s + st.pl / 2 + 60, lim: 60 });
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
  buildBuilding(root, st, R) {
    const M = this.mats, tints = [0xe3c88a, 0xe0b9a0, 0xe8e4d8, 0xb9c9a0, 0x9fb8c8, 0xc9a36a];
    let h = 0; for (const ch of st.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const tint = tints[h % tints.length];
    const spec = { terminal: { w: 16, h: 14, len: 84, fl: 2 }, major: { w: 11, h: 9.5, len: 54, fl: 2 }, town: { w: 8, h: 5.4, len: 28, fl: 1 }, halt: { w: 4, h: 3.2, len: 8, fl: 1 } }[st.type];
    const bx = 9 + spec.w / 2, front = bx - spec.w / 2, z0 = st.type === 'halt' ? -8 : 10;
    const wallM = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.92 });
    this.mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.len), wallM, root, bx, spec.h / 2, z0);
    const tex = Tex.facade(tint); tex.repeat.set(spec.len / 8.4, spec.fl);
    const fac = new THREE.Mesh(new THREE.PlaneGeometry(spec.len, spec.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    fac.position.set(front - 0.03, spec.h / 2, z0); fac.rotation.y = -Math.PI / 2; fac.receiveShadow = true; root.add(fac);
    if (st.type === 'town' || st.type === 'halt') {
      // gabled tile roof
      const r = (spec.h * 0.42) / 1.5, geo = new THREE.CylinderGeometry(r, r, spec.len + 1.2, 3);
      geo.rotateX(-Math.PI / 2);                       // axis along the track, apex up
      const pr = new THREE.Mesh(geo, st.type === 'town' ? M.tile : M.roofGrey);
      pr.scale.x = (spec.w + 1.4) / 2 / (0.866 * r); pr.position.set(bx, spec.h + r / 2, z0); pr.castShadow = true; root.add(pr);
    } else {
      this.mesh(new THREE.BoxGeometry(spec.w + 0.8, 0.5, spec.len + 0.8), M.concrete, root, bx, spec.h + 0.25, z0);       // roof slab
      this.mesh(new THREE.BoxGeometry(0.4, 0.8, spec.len + 0.8), M.concrete, root, front - 0.3, spec.h + 0.9, z0);      // parapet
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
      const cone = this.mesh(new THREE.ConeGeometry(4.6, 6, 4), M.roofGrey, root, bx, 27, z0); cone.rotation.y = Math.PI / 4;
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

  buildStation(st, idx) {
    const M = this.mats, root = new THREE.Group(), R = U.rng(300 + idx);
    const half = st.pl / 2, ph = st.type === 'halt' ? 0.6 : 1.0;
    const canopy = { terminal: 1, major: 0.7, town: 0.4, halt: 0 }[st.type];
    for (const side of [-1, 1]) {
      const x = side * 4.5;
      this.mesh(new THREE.BoxGeometry(5.4, ph, st.pl), M.concrete, root, x, ph / 2, 0);
      this.mesh(new THREE.BoxGeometry(0.3, 0.02, st.pl), M.yellow, root, side * 2.3, ph + 0.01, 0);
      if (canopy > 0) {
        const cl = (st.pl - 30) * canopy, c0 = st.type === 'terminal' ? 0 : 10;
        for (let z = -cl / 2 + 5; z <= cl / 2 - 5; z += 15) this.mesh(new THREE.BoxGeometry(0.25, 4.2, 0.25), M.metal, root, side * 6.6, 3.1, c0 + z);
        this.mesh(new THREE.BoxGeometry(6.2, 0.18, cl), st.type === 'terminal' ? M.roofGrey : M.roofRed, root, side * 5.3, 5.25, c0);
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
        const t = Tex.sign(st.name, 512, 128, '#1b3d70', '#f4f0e6');
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: t }));
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
    this.buildBuilding(root, st, R);
    this.place(root, st.s, 0, 0);

    // waiting passengers, more at big stations
    const per = { terminal: 120, major: 85, town: 50, halt: 22 }[st.type], n = Math.floor(per * (this.q === 'low' ? 0.4 : 1));
    const body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.26, 1.25, 8), new THREE.MeshStandardMaterial({ roughness: 0.9 }), n);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.8 }), n);
    const cols = [0xf0ece0, 0xf0ece0, 0x3b4a66, 0x7a5a3c, 0x1d1d1f, 0x6f8a6a, 0xb9a98a, 0x8a3a3a], c = new THREE.Color(), fr = Track.makeFrame();
    st.people = { body, head, items: [], n, ph };
    for (let k = 0; k < n; k++) {
      const side = R() < 0.5 ? -1 : 1, s = st.s + (R() - 0.5) * (st.pl - 30), lat = side * (3.0 + R() * 3.4);
      this.track.frame(s, fr);
      st.people.items.push({ x: fr.pos.x + fr.right.x * lat, z: fr.pos.z + fr.right.z * lat, h: 0.95 + R() * 0.12, t: R() });
      body.setColorAt(k, c.setHex(cols[Math.floor(R() * cols.length)]));
    }
    body.castShadow = true; head.castShadow = true; this.scene.add(body, head); body.instanceColor.needsUpdate = true;
    this.setBoarding(idx, 0);

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

  /* progress 0..1 of passengers boarding: hides people one by one. */
  setBoarding(i, progress) {
    const p = this.list[i].people, o = new THREE.Object3D();
    p.items.forEach((it, k) => {
      const on = it.t >= progress;
      o.position.set(it.x, on ? p.ph + 0.63 * it.h : -50, it.z); o.rotation.set(0, 0, 0); o.scale.set(1, it.h, 1); o.updateMatrix(); p.body.setMatrixAt(k, o.matrix);
      o.position.y = on ? p.ph + 1.25 * it.h + 0.1 : -50; o.scale.set(1, 1, 1); o.updateMatrix(); p.head.setMatrixAt(k, o.matrix);
    });
    p.body.instanceMatrix.needsUpdate = true; p.head.instanceMatrix.needsUpdate = true;
  }

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
