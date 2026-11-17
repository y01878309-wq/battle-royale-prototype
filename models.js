/* Real 3D models (converted to a compact format: models/<name>.bin + jpg textures). Loaded on demand; the game works without them. */
const Models = {
  cache: {}, ready: {},
  /* which real model stands in for each procedural loco kind (the procedural one stays as a fallback while the file loads or if it is missing) */
  REAL: { ge: 'ge777', box: 'f59', hood: 'sd40' },
  preload(names) { return Promise.all(names.map((n) => this.load(n).catch(() => null))); },
  /* synchronous copy, only if already loaded; scaled to len metres */
  get(name, len) { const g = this.ready[name]; if (!g) return null; const c = g.clone(true), d = this.DEFS[name]; c.scale.setScalar(len / d.len); return c; },
  /* length: the model is scaled so its long axis (z) is this many metres */
  DEFS: {
    ge767: { len: 21.6, credit: 'GE AC4400CW "Awvr 767" by zairiq-zairiq-123-pixar-cars-bfdi (CC BY 4.0, Sketchfab)' },
    ge777: { len: 21.6, credit: 'GE AC4400CW "Awvr 777" by zairiq-zairiq-123-pixar-cars-bfdi (CC BY 4.0, Sketchfab)' },
    f59: { len: 17.5, credit: 'Metrolink EMD F59PH by Trashbulldogproductions (CC BY 4.0, Sketchfab)' },
    sd40: { len: 20.5, credit: 'BNSF EMD SD40 by zairiq zairiq 8 (CC BY 4.0, Sketchfab)' },
    waratah: { len: 150, credit: 'Sydney Trains Waratah by PolyDucky (CC BY 4.0, Sketchfab)' }
  },
  CREDITS() { return Object.keys(this.DEFS).map((k) => this.DEFS[k].credit); },
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
