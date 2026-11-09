'use strict';
/* The train: one diesel locomotive and six coaches, each on two bogies that follow the track. */
class Train {
  constructor(scene, track, quality) {
    this.scene = scene; this.track = track; this.q = quality;
    this.vehicles = []; this.doors = []; this.wheelAngle = 0; this.cabMode = false;
    this.mat = {
      blue: new THREE.MeshPhysicalMaterial({ color: 0xa81f28, roughness: 0.36, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.25 }),   // ENR red
      cream: new THREE.MeshPhysicalMaterial({ color: 0xc3c7c9, roughness: 0.4, metalness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3 }),      // silver grey
      yellow: new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.5 }),
      winLit: new THREE.MeshStandardMaterial({ color: 0x0a1319, roughness: 0.08, metalness: 0.2, envMapIntensity: 1.8, emissive: 0xffd9a0, emissiveIntensity: 0 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x0a1319, roughness: 0.06, metalness: 0.2, envMapIntensity: 1.8 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.65, metalness: 0.4 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.45, metalness: 0.85 }),
      roof: new THREE.MeshStandardMaterial({ color: 0xa6a69f, roughness: 0.7, metalness: 0.2 }),
      lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 1.2 }),
      redlamp: new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2010, emissiveIntensity: 1.0 }),
      opening: new THREE.MeshStandardMaterial({ color: 0x0b0a08, roughness: 1 })
    };
    this.build();
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
    const g = new THREE.Group(), sets = [];
    this.box(2.1, 0.25, spacing * (axles - 1) + 1.2, this.mat.dark, 0, 0.66, 0, g);
    for (const sx of [-0.95, 0.95]) this.box(0.2, 0.3, spacing * (axles - 1) + 0.9, this.mat.steel, sx, 0.62, 0, g);
    for (let i = 0; i < axles; i++) {
      const z = (i - (axles - 1) / 2) * spacing, ws = new THREE.Group(); ws.position.set(0, 0.46, z);
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.8, 8), this.mat.steel); axle.rotation.z = Math.PI / 2; ws.add(axle);
      for (const sx of [-0.7175, 0.7175]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.13, 20), this.mat.steel); w.rotation.z = Math.PI / 2; w.position.x = sx; w.castShadow = true; ws.add(w);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 10), this.mat.dark); hub.rotation.z = Math.PI / 2; hub.position.x = sx * 1.03; ws.add(hub);
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.82, 0.04), this.mat.dark); spoke.position.x = sx * 1.02; ws.add(spoke);
      }
      g.add(ws); sets.push(ws);
    }
    this.scene.add(g); return { g, sets };
  }

  buildLoco() {
    const M = this.mat, body = new THREE.Group(), hull = new THREE.Group();
    const shell = new THREE.Mesh(this.extrudeBody([[-9.8, 1.0], [-9.8, 3.95], [-9.5, 4.2], [7.4, 4.2], [9.8, 2.6], [9.8, 1.0]], 3.0), M.blue);
    shell.castShadow = true; shell.receiveShadow = true; hull.add(shell);
    this.box(3.2, 1.3, 19.9, M.cream, 0, 1.72, 0, hull);
    this.box(3.21, 0.16, 19.9, M.blue, 0, 1.18, 0, hull);
    this.box(3.21, 0.07, 19.9, M.yellow, 0, 2.42, 0, hull);
    this.box(2.7, 0.14, 16.4, M.roof, 0, 4.26, -1.2, hull);
    // roof equipment
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 20), M.dark); f.position.set(0, 4.4, -8 + i * 2.6); hull.add(f); }
    this.box(1.6, 0.35, 3.2, M.roof, 0, 4.45, -1.0, hull); this.box(1.0, 0.3, 2.0, M.roof, 0, 4.4, 2.4, hull);
    // windscreen on the sloped nose
    const n = new THREE.Vector3(0, 2.4 / 2.91, 1.65 / 2.91), th = -Math.atan2(n.y, n.z);
    const mid = new THREE.Vector3(0, 4.2 - 1.65 * 0.5, 7.4 + 2.4 * 0.5);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 2.1), M.glass); gl.position.copy(mid).addScaledVector(n, 0.12); gl.rotation.x = th; hull.add(gl);
    this.glass = gl;
    // front: headlights, buffer beams, marker lights
    for (const sx of [-1.0, 1.0]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16), M.lamp); l.rotation.x = Math.PI / 2; l.position.set(sx, 1.7, 9.9); hull.add(l); }
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16), M.lamp); hl.rotation.x = Math.PI / 2; hl.position.set(0, 2.45, 9.9); hull.add(hl);
    for (const sx of [-1.25, 1.25]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), M.redlamp); r.rotation.x = Math.PI / 2; r.position.set(sx, 1.7, -9.9); hull.add(r); }
    this.box(3.0, 0.32, 0.3, M.dark, 0, 1.05, 10.0, hull); this.box(3.0, 0.32, 0.3, M.dark, 0, 1.05, -10.0, hull);
    for (const sx of [-1.0, 1.0]) for (const e of [-1, 1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 12), M.steel); b.rotation.x = Math.PI / 2; b.position.set(sx, 1.05, e * 10.25); hull.add(b); }
    // louvres, side windows, cab doors
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 9; i++) this.box(0.03, 0.8, 0.5, M.dark, sx * 1.6, 3.0, -8.2 + i * 0.75, hull);
      this.box(0.03, 1.0, 1.9, M.glass, sx * 1.6, 3.35, 5.7, hull);
      this.box(0.03, 2.5, 1.1, M.dark, sx * 1.6, 2.5, 3.9, hull).scale.x = 1;
      this.box(0.03, 0.7, 1.0, M.glass, sx * 1.62, 3.55, 3.9, hull);
    }
    // details: fuel tank, steps, handrails, horns, wipers, name plates
    this.box(2.3, 0.7, 6.4, M.dark, 0, 0.78, 0, hull);
    for (const sx of [-1, 1]) {
      for (const sy of [1.25, 1.85]) this.box(0.5, 0.05, 0.7, M.steel, sx * 1.8, sy, 3.9, hull);
      for (const z of [3.25, 4.55]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6), M.steel); r.position.set(sx * 1.68, 2.55, z); hull.add(r); }
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.62), new THREE.MeshStandardMaterial({ map: Tex.sign('السكك الحديدية المصرية', 768, 104, '#8f1a22', '#f4f0e6'), roughness: 0.6 }));
      plate.position.set(sx * 1.605, 1.78, -2.6); plate.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; hull.add(plate);
      const num = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), new THREE.MeshStandardMaterial({ map: Tex.sign('٣٠١٦', 256, 116, '#1b1a19', '#f4f0e6'), roughness: 0.6 }));
      num.position.set(sx * 1.605, 2.95, 6.3); num.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; hull.add(num);
      const hn = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.55, 10), M.steel); hn.rotation.x = Math.PI / 2; hn.position.set(sx * 0.35, 4.42, 5.8); hull.add(hn);
    }
    for (const wx of [-0.65, 0.65]) { const w = this.box(0.03, 0.9, 0.04, M.dark, wx, 3.4, 8.5, hull); w.rotation.x = 0.97; w.rotation.z = 0.5 * Math.sign(wx); }
    body.add(hull); this.locoHull = hull;

    // driver's cab, shown only in cab view
    const cab = new THREE.Group(), ic = new THREE.MeshStandardMaterial({ color: 0x9a9384, roughness: 0.85 }), dk = new THREE.MeshStandardMaterial({ color: 0x242321, roughness: 0.7 });
    this.box(3.0, 0.12, 6.6, new THREE.MeshStandardMaterial({ color: 0x3b3a36, roughness: 0.9 }), 0, 1.09, 6.1, cab);
    this.box(3.0, 0.14, 5.6, ic, 0, 4.12, 5.4, cab);
    for (const sx of [-1, 1]) { this.box(0.12, 1.5, 4.2, ic, sx * 1.46, 1.9, 5.3, cab); this.box(0.12, 0.22, 4.2, ic, sx * 1.46, 3.95, 5.3, cab); this.box(0.14, 2.9, 0.16, dk, sx * 1.45, 2.65, 7.0, cab); }
    this.box(3.0, 2.9, 0.1, ic, 0, 2.6, 2.9, cab);
    // windscreen pillars along the slope
    for (const x of [-1.32, 0, 1.32]) { const p = new THREE.Mesh(new THREE.BoxGeometry(x === 0 ? 0.05 : 0.15, 0.1, 3.0), dk); p.position.set(x, 4.2 - 0.83, 7.4 + 1.2); p.rotation.x = Math.atan2(1.65, 2.4); cab.add(p); }
    const dash = this.box(2.9, 0.62, 1.0, dk, 0, 2.18, 6.5, cab); dash.rotation.x = 0.0;
    this.box(2.9, 0.08, 0.9, new THREE.MeshStandardMaterial({ color: 0x35332f, roughness: 0.6 }), 0, 2.52, 6.4, cab).rotation.x = 0.25;
    this.box(0.5, 0.7, 0.5, dk, -0.75, 1.5, 4.4, cab);                      // driver's seat base
    this.box(0.5, 0.55, 0.1, dk, -0.75, 2.0, 4.15, cab);
    const eye = new THREE.Vector3(-0.75, 3.05, 5.0);
    this.dials = [];
    for (const [x, max, lab, big] of [[-0.75, 160, 'كم/س', 0.34], [-0.15, 10, 'بار', 0.26], [0.35, 10, 'قوة', 0.26]]) {
      const grp = new THREE.Group(); grp.position.set(x, 2.58, 6.2);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(big, big), new THREE.MeshBasicMaterial({ map: Tex.dial(max, lab), transparent: true }));
      grp.add(plane);
      const needle = new THREE.Group(); const nm = new THREE.Mesh(new THREE.BoxGeometry(0.008, big * 0.4, 0.002), new THREE.MeshBasicMaterial({ color: 0xff7a2a })); nm.position.y = big * 0.2; needle.add(nm); needle.position.z = 0.003; grp.add(needle);
      cab.add(grp); grp.lookAt(eye.x, eye.y, eye.z - 0.0); this.dials.push({ needle, max });
    }
    cab.visible = false; body.add(cab); this.cab = cab;
    this.eye = new THREE.Object3D(); this.eye.position.copy(eye); this.eye.rotation.y = Math.PI; body.add(this.eye);
    this.nose = new THREE.Object3D(); this.nose.position.set(0, 1.6, 10.4); this.nose.rotation.y = Math.PI; body.add(this.nose);

    this.spot = new THREE.SpotLight(0xfff0d0, 0, 400, 0.34, 0.5, 1.2); this.spot.position.set(0, 2.4, 10); this.spot.target.position.set(0, 0.5, 60);
    body.add(this.spot, this.spot.target);
    this.scene.add(body);
    return { body, len: 19.9, bs: 11.4, bogies: [this.makeBogie(3, 1.9), this.makeBogie(3, 1.9)], loco: true };
  }

  buildCoach(i) {
    const M = this.mat, body = new THREE.Group();
    const shell = new THREE.Mesh(this.extrudeBody([[-11, 0.85], [-11, 3.4], [-10.3, 3.95], [10.3, 3.95], [11, 3.4], [11, 0.85]], 3.0), M.cream);
    shell.castShadow = true; shell.receiveShadow = true; body.add(shell);
    this.box(3.2, 0.85, 22.1, M.blue, 0, 1.3, 0, body);
    this.box(3.2, 0.12, 22.1, M.yellow, 0, 1.82, 0, body);
    this.box(3.1, 0.14, 21.4, M.roof, 0, 3.98, 0, body).scale.x = 0.8;
    for (let k = 0; k < 4; k++) this.box(1.4, 0.3, 2.2, M.roof, 0, 4.15, -7.5 + k * 5, body);
    const wins = []; for (let k = 0; k < 8; k++) wins.push(k);
    for (const sx of [-1, 1]) {
      for (const k of wins) this.box(0.03, 1.05, 1.5, M.winLit, sx * 1.58, 2.8, -7.3 + k * 1.95 + (k > 3 ? 0.4 : 0), body);
      for (const ez of [-9.7, 9.7]) {
        this.box(0.03, 2.4, 1.15, M.opening, sx * 1.56, 2.3, ez, body);
        const door = this.box(0.05, 2.4, 1.1, M.blue, sx * 1.6, 2.3, ez, body); door.userData = { z0: ez, dir: ez > 0 ? -1 : 1 }; this.doors.push(door);
        this.box(0.04, 0.5, 0.7, M.glass, sx * 1.63, 3.15, ez, door).position.set(0.03, 0.55, 0);
      }
    }
    for (const e of [-1, 1]) this.box(2.5, 3.0, 0.4, M.dark, 0, 2.3, e * 11.2, body);
    this.box(2.2, 0.4, 14.5, M.dark, 0, 0.78, 0, body);
    this.scene.add(body);
    return { body, len: 22.2, bs: 15.6, bogies: [this.makeBogie(2, 2.5), this.makeBogie(2, 2.5)], loco: false };
  }

  build() {
    this.loco = this.buildLoco(); this.vehicles.push(this.loco);
    for (let i = 0; i < 6; i++) this.vehicles.push(this.buildCoach(i));
    this.length = this.vehicles.reduce((a, v) => a + v.len + 0.9, 0);
    this.vehicles.forEach((v) => v.body.traverse((o) => { if (o.isMesh) o.castShadow = true; }));
    this.fa = Track.makeFrame(); this.fb = Track.makeFrame(); this.tmp = new THREE.Vector3();
  }

  setCabView(on) {
    this.cabMode = on; this.locoHull.visible = !on; this.cab.visible = on;
  }

  /* Place every vehicle. sHead is the distance of the loco's front buffer. */
  place(sHead, time, speed) {
    const tr = this.track; let center = sHead - this.loco.len / 2;
    this.vehicles.forEach((v, idx) => {
      if (idx > 0) { const p = this.vehicles[idx - 1]; center -= p.len / 2 + 0.9 + v.len / 2; }
      const fa = tr.frame(center + v.bs / 2, this.fa), fb = tr.frame(center - v.bs / 2, this.fb);
      this.tmp.copy(fa.pos).sub(fb.pos); const dir = this.tmp.clone().normalize();
      v.body.position.copy(fa.pos).add(fb.pos).multiplyScalar(0.5); v.body.position.y = RAIL_TOP;
      v.body.lookAt(v.body.position.x + dir.x, RAIL_TOP, v.body.position.z + dir.z);
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

  setDoors(open) {
    for (const d of this.doors) d.position.z = d.userData.z0 + d.userData.dir * open * 1.18;
  }

  setDials(kmh, brake, power) {
    const vals = [kmh, brake * 5, power * 10];
    this.dials.forEach((d, i) => { const a = Math.PI * 0.75 + U.clamp(vals[i] / d.max, 0, 1) * Math.PI * 1.5; d.needle.rotation.z = Math.atan2(-Math.cos(a), -Math.sin(a)); });
  }

  setNight(on) { this.mat.winLit.emissiveIntensity = on ? 1.4 : 0; }

  setHeadlights(on) { this.spot.intensity = on ? 7 : 0; this.mat.lamp.emissiveIntensity = on ? 3 : 1.2; }
}
