/* Real 3D models (converted to a compact format: models/<name>.bin + jpg textures). Loaded on demand; the game works without them. */
const Models = {
  cache: {}, ready: {},
  /* which real model stands in for each procedural loco kind (the procedural one stays as a fallback while the file loads or if it is missing) */
  REAL: { ge: 'ge777', box: 'f59', hood: 'sd40' },
  /* which real loco model a train type uses: a stable variety so the different types in the shop do not all look the same */
  pickFor(type) {
    if (type.real) return type.real.head;
    const k = type.loco.kind; if (k !== 'ge' && k !== 'box' && k !== 'hood') return null;
    let h = 0; for (const c of type.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return k === 'box' ? 'f59' : k === 'hood' ? 'sd40' : ['ge777', 'ge767', 'sd40', 'f59'][h % 4];
  },
  preload(names) { return Promise.all(names.map((n) => this.load(n).catch(() => null))); },
  /* synchronous copy, only if already loaded; scaled to len metres */
  get(name, len) { const g = this.ready[name]; if (!g) return null; const c = g.clone(true), d = this.DEFS[name]; c.scale.setScalar(len / d.len); return c; },
  /* length: the model is scaled so its long axis (z) is this many metres */
  DEFS: {
    ge767: { len: 21.6, credit: 'GE AC4400CW "Awvr 767" by zairiq-zairiq-123-pixar-cars-bfdi (CC BY 4.0, Sketchfab)' },
    ge777: { len: 21.6, credit: 'GE AC4400CW "Awvr 777" by zairiq-zairiq-123-pixar-cars-bfdi (CC BY 4.0, Sketchfab)' },
    f59: { len: 17.5, credit: 'Metrolink EMD F59PH by Trashbulldogproductions (CC BY 4.0, Sketchfab)' },
    sd40: { len: 20.5, credit: 'BNSF EMD SD40 by zairiq zairiq 8 (CC BY 4.0, Sketchfab)' },
    coach1: { len: 26.2, credit: 'Simple Train Passenger Carriage by maryssoul24 (CC BY 4.0, Sketchfab)' },
    wh: { len: 20.4, credit: 'Sydney Trains Waratah (head car) by PolyDucky (CC BY 4.0, Sketchfab)' },
    wm: { len: 19.0, credit: 'Sydney Trains Waratah (car) by PolyDucky (CC BY 4.0, Sketchfab)' },
    wn: { len: 19.0, credit: 'Sydney Trains Waratah (car) by PolyDucky (CC BY 4.0, Sketchfab)' },
    waratah: { len: 150, credit: 'Sydney Trains Waratah by PolyDucky (CC BY 4.0, Sketchfab)' }
  },
  CREDITS() { return Object.keys(this.DEFS).map((k) => this.DEFS[k].credit).filter((c, i, a) => c.indexOf('(head car)') < 0 && c.indexOf('(car)') < 0 && a.indexOf(c) === i); },
  load(name) {
    if (this.cache[name]) return this.cache[name];
    const def = this.DEFS[name]; if (!def || !window.THREE) return Promise.reject(new Error('no model ' + name));
    return (this.cache[name] = fetch('models/' + name + '.bin').then((r) => { if (!r.ok) throw new Error('model ' + name); return r.arrayBuffer(); }).then((buf) => {
      const hl = new DataView(buf).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
      let off = 4 + hl; const root = new THREE.Group(), loader = new THREE.TextureLoader(), mats = [], waits = [];
      const bb = head.bbox, len = bb[1][2] - bb[0][2], s = def.len / len, cx = (bb[0][0] + bb[1][0]) / 2, cz = (bb[0][2] + bb[1][2]) / 2, y0 = bb[0][1];
      const inner = new THREE.Group(); root.add(inner); inner.scale.setScalar(s); inner.position.set(-cx * s, -y0 * s, -cz * s);
      for (const m of head.mats) {
        const P = new Float32Array(buf, off, m.n * 3); off += m.n * 12; const N = new Float32Array(buf, off, m.n * 3); off += m.n * 12; const U = new Float32Array(buf, off, m.n * 2); off += m.n * 8; const I = new Uint32Array(buf, off, m.ni); off += m.ni * 4;
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setIndex(new THREE.BufferAttribute(I, 1));
        const glass = /glass|window/i.test(m.name), c = m.color;
        const mat = new THREE.MeshStandardMaterial({ color: m.tex ? 0xffffff : new THREE.Color(c[0], c[1], c[2]), roughness: glass ? 0.12 : Math.max(0.55, m.rough), metalness: glass ? 0.6 : 0.1, side: m.ds ? THREE.DoubleSide : THREE.FrontSide });
        if (glass) { mat.color = new THREE.Color(0x1c2a33); }
        if (m.tex) { let ok; waits.push(new Promise((res) => { ok = res; })); const t = loader.load('models/' + m.tex, () => ok(), undefined, () => ok()); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; mat.map = t; }
        const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; inner.add(mesh); mats.push(mat);
      }
      root.userData.size = [(bb[1][0] - bb[0][0]) * s, (bb[1][1] - bb[0][1]) * s, def.len];
      return Promise.all(waits).then(() => { this.ready[name] = root; return root; });   // only 'ready' once the textures are in, so a model never shows up black
    }));
  },
  /* a fresh independent copy (shares geometry/textures) */
  clone(name) { return this.load(name).then((g) => g.clone(true)); }
};

/* People: skinned Mixamo figures baked into a few vertex-animation frames (models/<name>.pbin), cheap to draw and no skeleton code needed. */
const People = {
  cache: {}, ready: {},
  DEFS: {
    father: { credit: 'FATHER Walking From Mixamo by lukuta (CC BY 4.0, Sketchfab)' },
    police: { credit: 'Police Man from the U.S.A. (T-pose rig mixamo) by ustoopia (CC BY 4.0, Sketchfab)' }
  },
  CREDITS() { return Object.keys(this.DEFS).map((k) => this.DEFS[k].credit); },
  load(name) {
    if (this.cache[name]) return this.cache[name];
    return (this.cache[name] = fetch('models/' + name + '.pbin').then((r) => { if (!r.ok) throw new Error('person ' + name); return r.arrayBuffer(); }).then((buf) => {
      const hl = new DataView(buf).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))); let off = 4 + hl;
      const K = head.frames, parts = [], waits = [], loader = new THREE.TextureLoader();
      for (const m of head.mats) {
        const UV = new Float32Array(buf, off, m.n * 2); off += m.n * 8; const I = new Uint32Array(buf, off, m.ni); off += m.ni * 4;
        const pos = [], nor = [];
        for (let k = 0; k < K; k++) { pos.push(new THREE.BufferAttribute(new Int16Array(buf, off, m.n * 3), 3, true)); off += m.n * 6; }
        for (let k = 0; k < K; k++) { nor.push(new THREE.BufferAttribute(new Int8Array(buf, off, m.n * 3), 3, true)); off += m.n * 3; }
        off = (off + 3) & ~3;
        const c = m.color, mat = new THREE.MeshStandardMaterial({ color: m.tex ? 0xffffff : new THREE.Color(c[0], c[1], c[2]), roughness: 0.85, metalness: 0, side: m.ds || m.alpha ? THREE.DoubleSide : THREE.FrontSide });
        if (m.tex) { let ok; waits.push(new Promise((res) => { ok = res; })); const t = loader.load('models/' + m.tex, () => ok(), undefined, () => ok()); t.encoding = THREE.sRGBEncoding; t.flipY = false; t.anisotropy = 2; mat.map = t; }
        if (m.alpha) { mat.alphaTest = 0.5; mat.transparent = false; }
        parts.push({ UV: new THREE.BufferAttribute(UV, 2), I: new THREE.BufferAttribute(I, 1), pos, nor, mat });
      }
      const def = { K, rad: head.rad, dur: head.dur || 1, parts };
      return Promise.all(waits).then(() => { this.ready[name] = def; return def; });
    }));
  },
  /* one independent figure (shares buffers and materials); height in metres is already baked */
  make(name) {
    const d = this.ready[name]; if (!d) return null; const g = new THREE.Group(), meshes = [];
    for (const p of d.parts) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', p.pos[0]); geo.setAttribute('normal', p.nor[0]); geo.setAttribute('uv', p.UV); geo.setIndex(p.I); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.2);
      const m = new THREE.Mesh(geo, p.mat); m.scale.setScalar(d.rad); m.castShadow = true; m.frustumCulled = false; g.add(m); meshes.push([m, p]);
    }
    g.userData.frame = -1;
    g.userData.set = (k) => { k = ((k % d.K) + d.K) % d.K; if (k === g.userData.frame) return; g.userData.frame = k; for (const [m, p] of meshes) { m.geometry.setAttribute('position', p.pos[k]); m.geometry.setAttribute('normal', p.nor[k]); } };
    g.userData.K = d.K; g.userData.dur = d.dur; g.userData.set(0); return g;
  }
};
