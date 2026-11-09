'use strict';
/* Stations on the Giza - Minya line, speed zones, signals and lineside signs. */
const STATION_DEFS = [
  { name: 'الجيزة', u: 0.04 },
  { name: 'الواسطى', u: 0.28 },
  { name: 'بني سويف', u: 0.52 },
  { name: 'المنيا', u: 0.78 }
];
const LINE_SPEED = 120;          // km/h
const PLATFORM_LEN = 210;        // m
const STOP_OFFSET = 88;          // stop mark: metres ahead of platform centre (loco front stops here)

class Stations {
  constructor(scene, track, quality) {
    this.scene = scene; this.track = track; this.q = quality;
    this.list = STATION_DEFS.map((d) => ({ name: d.name, s: d.u * track.L, stopS: d.u * track.L + STOP_OFFSET, signal: null, people: null }));
    this.zones = [];
    for (const st of this.list) { this.zones.push({ s0: st.s - 1100, s1: st.s - 600, lim: 90 }, { s0: st.s - 600, s1: st.s + 260, lim: 60 }); }
    for (const u of [0.16, 0.40, 0.65]) { const c = u * track.L; this.zones.push({ s0: c - 250, s1: c + 250, lim: 80 }); }
  }

  /* Speed limit in km/h at distance s along the line. */
  limitAt(s) {
    const L = this.track.L; let lim = LINE_SPEED;
    for (const z of this.zones) { const rel = ((s - z.s0) % L + L) % L; if (rel < z.s1 - z.s0) lim = Math.min(lim, z.lim); }
    return lim;
  }

  build() {
    this.mats = {
      concrete: new THREE.MeshStandardMaterial({ color: 0xb4ad9f, roughness: 0.92 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xe2b02a, roughness: 0.6 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x59606a, roughness: 0.5, metalness: 0.7 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x7a2d24, roughness: 0.7, metalness: 0.2 }),
      wall: new THREE.MeshStandardMaterial({ color: 0xe0cfa6, roughness: 0.9 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x232220, roughness: 0.7 }),
      lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c0, emissiveIntensity: 0.15 })
    };
    this.list.forEach((st, i) => this.buildStation(st, i));
    this.buildLineside();
  }

  place(obj, s, lat, y) {
    const fr = Track.makeFrame(), m = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
    this.track.frame(s, fr);
    obj.position.set(fr.pos.x + fr.right.x * lat, y, fr.pos.z + fr.right.z * lat);
    obj.quaternion.setFromRotationMatrix(m.makeBasis(fr.right, up, fr.fwd));
    this.scene.add(obj); return obj;
  }

  mesh(geo, mat, parent, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }

  buildStation(st, idx) {
    const M = this.mats, root = new THREE.Group(), R = U.rng(300 + idx);
    const half = PLATFORM_LEN / 2;
    for (const side of [-1, 1]) {
      const x = side * 4.5;
      this.mesh(new THREE.BoxGeometry(5.4, 1.0, PLATFORM_LEN), M.concrete, root, x, 0.5, 0);
      this.mesh(new THREE.BoxGeometry(0.3, 0.02, PLATFORM_LEN), M.yellow, root, side * 2.3, 1.01, 0);
      // canopy columns and roof
      for (let z = -half + 10; z <= half - 10; z += 15) this.mesh(new THREE.BoxGeometry(0.25, 4.2, 0.25), M.metal, root, side * 6.6, 3.1, z);
      this.mesh(new THREE.BoxGeometry(6.2, 0.18, PLATFORM_LEN - 40), M.roof, root, side * 5.3, 5.25, 0);
      for (let z = -half + 20; z <= half - 20; z += 30) {
        this.mesh(new THREE.BoxGeometry(2.4, 0.08, 0.7), M.lamp, root, side * 5.6, 5.0, z);                        // light fittings
        const b = this.mesh(new THREE.BoxGeometry(1.6, 0.1, 0.45), M.dark, root, side * 5.7, 1.5, z + 6);          // bench
        this.mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), M.dark, root, side * 5.95, 1.8, z + 6);
      }
      // name boards facing the track
      for (const z of [-60, 0, 60]) {
        const t = Tex.sign(st.name, 512, 128, '#1b3d70', '#f4f0e6');
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: t }));
        sign.position.set(side * 2.5 + side * 0.01, 4.55, z); sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 4.1), M.dark); back.position.set(side * 2.55 + side * 0.1, 4.55, z);
        root.add(sign, back);
      }
    }
    // station building behind the river-side-opposite platform
    const bx = -17;
    this.mesh(new THREE.BoxGeometry(11, 7, 56), M.wall, root, bx, 3.5, 20);
    this.mesh(new THREE.BoxGeometry(12, 0.5, 58), M.roof, root, bx, 7.2, 20);
    for (let z = -4; z <= 44; z += 6) this.mesh(new THREE.BoxGeometry(0.1, 2.2, 1.6), new THREE.MeshStandardMaterial({ color: 0x1f3a4a, roughness: 0.2, metalness: 0.2 }), root, bx + 5.55, 3.2, z);
    const bs = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.5), new THREE.MeshBasicMaterial({ map: Tex.sign('محطة ' + st.name, 768, 160, '#8a2a20', '#f4f0e6') }));
    bs.position.set(bx + 5.62, 6.2, 20); bs.rotation.y = Math.PI / 2; root.add(bs);
    this.place(root, st.s, 0, 0);

    // waiting passengers
    const n = Math.floor(70 * (this.q === 'low' ? 0.4 : 1)), body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.26, 1.25, 8), new THREE.MeshStandardMaterial({ roughness: 0.9 }), n);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.8 }), n);
    const cols = [0xf0ece0, 0xf0ece0, 0x3b4a66, 0x7a5a3c, 0x1d1d1f, 0x6f8a6a, 0xb9a98a, 0x8a3a3a], c = new THREE.Color(), fr = Track.makeFrame(), o = new THREE.Object3D(), m = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
    st.people = { body, head, items: [], n };
    for (let k = 0; k < n; k++) {
      const side = R() < 0.5 ? -1 : 1, s = st.s + (R() - 0.5) * (PLATFORM_LEN - 30), lat = side * (3.0 + R() * 3.4);
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
    for (const f of [0, Math.PI]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.82), new THREE.MeshBasicMaterial({ map: stopTex, side: THREE.FrontSide })); p.position.set(0, 3.1, 0.04 * (f ? -1 : 1)); p.rotation.y = f; sb.add(p); }
    this.place(sb, st.stopS + 3, 3.0, 0);
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
      o.position.set(it.x, on ? 1.0 + 0.63 : -50, it.z); o.rotation.set(0, 0, 0); o.scale.set(1, it.h, 1); o.updateMatrix(); p.body.setMatrixAt(k, o.matrix);
      o.position.y = on ? 1.0 + 1.25 * it.h + 0.1 : -50; o.scale.set(1, 1, 1); o.updateMatrix(); p.head.setMatrixAt(k, o.matrix);
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
    for (const z of this.zones) { addSign(z.s0, z.lim); addSign(z.s1, this.limitAt(z.s1 + 1)); }
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
