'use strict';
/* The railway: a closed spline, sampled every metre, plus ballast, rails and sleepers. */
const RAIL_TOP = 0.59;      // height of rail head above ground
const GAUGE = 1.435;
let NTRACKS = 2;           // 2, 3 or 4 parallel tracks (chosen in the game settings)
const TX = () => (NTRACKS - 1) * 4.6;   // lateral offset of the outermost track
const TRACK_SP = 4.6;      // distance between the two tracks (centre to centre). The player's track is lateral 0, the opposite track at +TRACK_SP

class Track {
  constructor(Ltarget) {
    const a = Ltarget / 5.32, b = a * 0.66, pts = [], n = 64;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const r = 1 + 0.07 * Math.sin(3 * th + 1.0) + 0.045 * Math.sin(5 * th + 2.0) + 0.03 * Math.sin(2 * th + 0.4);
      pts.push(new THREE.Vector3(Math.cos(th) * a * r, 0, Math.sin(th) * b * r));
    }
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.curve.arcLengthDivisions = Math.min(60000, Math.max(14000, Math.ceil(Ltarget / 2)));
    this.L = this.curve.getLength();
    this.M = Math.ceil(this.L);
    this.ds = this.L / this.M;
    const M = this.M;
    this.P = new Float32Array(M * 3); this.F = new Float32Array(M * 3); this.Rt = new Float32Array(M * 3);
    for (let i = 0; i < M; i++) {
      const u = i / M, p = this.curve.getPointAt(u), t = this.curve.getTangentAt(u);
      t.y = 0; t.normalize();
      this.P.set([p.x, 0, p.z], i * 3);
      this.F.set([t.x, 0, t.z], i * 3);
      this.Rt.set([-t.z, 0, t.x], i * 3);
    }
  }

  wrap(s) { const L = this.L; return ((s % L) + L) % L; }

  /* Fills out.pos, out.fwd, out.right for distance s along the line. */
  frame(s, out) {
    const f = this.wrap(s) / this.ds, i0 = Math.floor(f) % this.M, i1 = (i0 + 1) % this.M, k = f - Math.floor(f);
    const lerp3 = (arr, v) => v.set(
      arr[i0 * 3] + (arr[i1 * 3] - arr[i0 * 3]) * k, arr[i0 * 3 + 1] + (arr[i1 * 3 + 1] - arr[i0 * 3 + 1]) * k,
      arr[i0 * 3 + 2] + (arr[i1 * 3 + 2] - arr[i0 * 3 + 2]) * k);
    lerp3(this.P, out.pos); lerp3(this.F, out.fwd); out.fwd.normalize(); lerp3(this.Rt, out.right); out.right.normalize();
    return out;
  }

  /* Proper rotation basis for an object on the track: local +z forward, +y up, +x left. */
  static basis(m, fr, up) { return m.makeBasis(Track._l.copy(fr.right).negate(), up, fr.fwd); }

  static makeFrame() { return { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3() }; }

  /* World position at distance s, lateral offset (+ right), height y. */
  at(s, lat, y, v) {
    const fr = this._tmp || (this._tmp = Track.makeFrame());
    this.frame(s, fr);
    return (v || new THREE.Vector3()).copy(fr.pos).addScaledVector(fr.right, lat).setY(y || 0);
  }

  /* Extrude a 2D profile [[lateral, height], ...] along the track. */
  ribbon(profile, step, closed, uvScale) {
    const n = Math.ceil(this.L / step), np = profile.length, fr = Track.makeFrame();
    const pos = [], uv = [], idx = [];
    const cum = [0];
    for (let j = 1; j < np; j++) cum.push(cum[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
    for (let k = 0; k <= n; k++) {
      const s = k * (this.L / n);
      this.frame(s, fr);
      for (let j = 0; j < np; j++) {
        pos.push(fr.pos.x + fr.right.x * profile[j][0], profile[j][1], fr.pos.z + fr.right.z * profile[j][0]);
        uv.push(cum[j] / uvScale, s / uvScale);
      }
    }
    const segs = closed ? np : np - 1;
    for (let k = 0; k < n; k++) for (let j = 0; j < segs; j++) {
      const a = k * np + j, b = k * np + (j + 1) % np, c = (k + 1) * np + j, d = (k + 1) * np + (j + 1) % np;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  /* ---- junctions: a siding (the extra track) that branches off to the left of the player's track, runs parallel and rejoins ---- */
  divLatJ(j, s) {
    const rel = this.wrap(s - j.s0); if (rel > j.len) return 0;
    const sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    return -TRACK_SP * sm(rel / j.R) * (1 - sm((rel - (j.len - j.R)) / j.R));
  }

  ribbonJ(j, profile, step, closed, uvScale) {
    const n = Math.max(2, Math.ceil(j.len / step)), np = profile.length, fr = Track.makeFrame(), pos = [], uv = [], idx = [], cum = [0];
    for (let q = 1; q < np; q++) cum.push(cum[q - 1] + Math.hypot(profile[q][0] - profile[q - 1][0], profile[q][1] - profile[q - 1][1]));
    for (let k = 0; k <= n; k++) {
      const s = j.s0 + k * (j.len / n); this.frame(s, fr); const c = this.divLatJ(j, s);
      for (let q = 0; q < np; q++) { const l = profile[q][0] + c; pos.push(fr.pos.x + fr.right.x * l, profile[q][1], fr.pos.z + fr.right.z * l); uv.push(cum[q] / uvScale, (k * j.len / n) / uvScale); }
    }
    const segs = closed ? np : np - 1;
    for (let k = 0; k < n; k++) for (let q = 0; q < segs; q++) { const a = k * np + q, b = k * np + (q + 1) % np, c2 = (k + 1) * np + q, d = (k + 1) * np + (q + 1) % np; idx.push(a, b, c2, b, d, c2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  /* Adds one junction starting at s0 and len metres long: ballast, two rails, sleepers and the warning boards. */
  addJunction(scene, s0, len) {
    const j = { s0, len, R: Math.min(120, len * 0.3) }; (this.junctions = this.junctions || []).push(j);
    const grp = new THREE.Group();
    const bt = Tex.ballast(); bt.repeat.set(1, 1);
    const bm = new THREE.MeshStandardMaterial({ map: bt, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const ballast = new THREE.Mesh(this.ribbonJ(j, [[-2.5, -0.2], [-2.3, 0.31], [2.3, 0.31], [2.5, -0.2]], 4, false, 3), bm); ballast.receiveShadow = true; grp.add(ballast);
    const rp = [[-.075, 0], [.075, 0], [.075, .03], [.02, .04], [.02, .13], [.04, .15], [.04, .17], [-.04, .17], [-.04, .15], [-.02, .13], [-.02, .04], [-.075, .03]];
    const railMat = new THREE.MeshStandardMaterial({ color: 0x74665c, roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide });
    for (const side of [-1, 1]) grp.add(new THREE.Mesh(this.ribbonJ(j, rp.map(([l, y]) => [l + side * GAUGE / 2, y + RAIL_TOP - 0.17 + 0.004]), 2, true, 10), railMat));
    const n = Math.floor(len / 0.65), sl = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.2, 0.26), new THREE.MeshStandardMaterial({ color: 0x7a6a58, roughness: 0.95 }), n);
    const fr = Track.makeFrame(), m = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) { const s = s0 + i * 0.65, c = this.divLatJ(j, s); this.frame(s, fr); Track.basis(m, fr, up); m.setPosition(fr.pos.x + fr.right.x * c, 0.325, fr.pos.z + fr.right.z * c); sl.setMatrixAt(i, m); }
    sl.instanceMatrix.needsUpdate = true; sl.receiveShadow = true; grp.add(sl);
    // boards 300 m before and at the turnout: "junction, 45 km/h"
    const mat = new THREE.MeshStandardMaterial({ map: Tex.sign('تحويلة ← ٤٥', 384, 128, '#1b5e3a', '#ffffff'), roughness: 0.6 }), post = new THREE.MeshStandardMaterial({ color: 0x59606a, metalness: 0.6, roughness: 0.5 });
    for (const d of [-300, -20]) {
      const f = this.frame(s0 + d, Track.makeFrame()), x = -3.4 - (d === -20 ? 0 : 0.4), g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), post); pole.position.y = 1.6; g.add(pole);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.64), mat); board.position.y = 3.3; g.add(board);
      g.position.set(f.pos.x + f.right.x * x, 0, f.pos.z + f.right.z * x); g.rotation.y = Math.atan2(-f.fwd.x, -f.fwd.z); grp.add(g);
    }
    scene.add(grp); (this.jgroups = this.jgroups || []).push(grp); return j;
  }

  /* The junction (if any) between 0 and maxAhead metres in front of distance s. */
  junctionAhead(s, maxAhead) {
    for (const j of this.junctions || []) { const a = this.wrap(j.s0 - s); if (a > 0 && a < maxAhead) return { j, dist: a }; }
    return null;
  }

  buildMeshes(scene, quality) {
    const group = new THREE.Group();
    const ballastTex = Tex.ballast(); ballastTex.repeat.set(1, 1);
    const ballast = new THREE.Mesh(
      this.ribbon([[-4.6, -0.2], [-2.3, 0.30], [TX() + 2.3, 0.30], [TX() + 4.6, -0.2]], 4, false, 3),
      new THREE.MeshStandardMaterial({ map: ballastTex, roughness: 1, metalness: 0 }));
    ballast.receiveShadow = true; group.add(ballast);

    const rp = [[-.075, 0], [.075, 0], [.075, .03], [.02, .04], [.02, .13], [.04, .15], [.04, .17], [-.04, .17], [-.04, .15], [-.02, .13], [-.02, .04], [-.075, .03]];
    const railMat = new THREE.MeshStandardMaterial({ color: 0x74665c, roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide });
    const railSides = []; for (let k = 0; k < NTRACKS; k++) for (const v of [-1, 1]) railSides.push(v + 2 * k * TRACK_SP / GAUGE);
    for (const side of railSides) {
      const prof = rp.map(([l, y]) => [l + side * GAUGE / 2, y + RAIL_TOP - 0.17]);
      const rail = new THREE.Mesh(this.ribbon(prof, 2, true, 10), railMat);
      rail.receiveShadow = true; rail.castShadow = false; group.add(rail);
    }

    const spacing = 0.65, count = Math.floor(this.L / spacing);
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.2, 0.26),
      new THREE.MeshStandardMaterial({ color: 0x7a6a58, roughness: 0.95 }), count * NTRACKS);
    const fr = Track.makeFrame(), m = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color(), R = U.rng(11);
    for (let i = 0; i < count; i++) {
      this.frame(i * spacing, fr);
      Track.basis(m, fr, up); m.setPosition(fr.pos.x, 0.32, fr.pos.z);
      sl.setMatrixAt(i, m);
      const k = 0.8 + R() * 0.3; sl.setColorAt(i, col.setRGB(k, k, k));
      for (let t = 1; t < NTRACKS; t++) { m.setPosition(fr.pos.x + fr.right.x * TRACK_SP * t, 0.32, fr.pos.z + fr.right.z * TRACK_SP * t); sl.setMatrixAt(count * t + i, m); sl.setColorAt(count * t + i, col.setRGB(k * 0.97, k * 0.97, k * 0.97)); }
    }
    sl.instanceMatrix.needsUpdate = true; sl.instanceColor.needsUpdate = true;
    sl.receiveShadow = true; group.add(sl);

    scene.add(group);
    this.group = group;
    return group;
  }
}

Track._l = new THREE.Vector3();
