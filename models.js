/* Real 3D models (converted to a compact format: models/<name>.bin + jpg textures). Loaded on demand; the game works without them. */
const Models = {
  cache: {}, ready: {},
  /* which real model stands in for each procedural loco kind (the procedural one stays as a fallback while the file loads or if it is missing) */
  REAL: { ge: 'gegyp', box: 'f59', hood: 'sd40' },
  /* which real loco model a train type uses: a stable variety so the different types in the shop do not all look the same */
  pickFor(type) {
    if (type.real) return type.real.head;
    const k = type.loco.kind; if (k !== 'ge' && k !== 'box' && k !== 'hood') return null;
    let h = 0; for (const c of type.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return k === 'box' ? 'f59' : k === 'hood' ? 'sd40' : 'gegyp';
  },
  preload(names) { return Promise.all(names.map((n) => this.load(n).catch(() => null))); },
  /* synchronous copy, only if already loaded; scaled to len metres */
  get(name, len, tint) {
    const g = this.ready[name]; if (!g) return null; const c = g.clone(true), d = this.DEFS[name]; c.scale.setScalar(len / (d.h || d.len));
    if (tint) c.traverse((o) => { if (o.isMesh && o.material.map) { const t = this.tinted(o.material.map, tint); if (t) { o.material = o.material.clone(); o.material.map = t; } } });
    return c;
  },
  /* repaint the saturated livery pixels of a texture with the train's own colours (red/orange -> top, yellow -> trim, blue -> low); greys, blacks and whites are kept */
  tinted(map, tint) {
    const img = map.image; if (!img || !img.width || typeof document === 'undefined') return null;
    const key = (tint.top | 0) + '_' + (tint.low | 0) + '_' + (tint.trim | 0); map.userData = map.userData || {}; const cache = map.userData.tints || (map.userData.tints = {});
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const id = cx.getImageData(0, 0, cv.width, cv.height), p = id.data, hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
    const T = tint.top != null ? hex(tint.top) : null, L = tint.low != null ? hex(tint.low) : null, R = tint.trim != null ? hex(tint.trim) : null;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], g = p[i + 1], b = p[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, s = mx ? (mx - mn) / mx : 0;
      if (s < 0.38 || v < 0.22) continue;
      let h = 0; const d = mx - mn; if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h = (h * 60 + 360) % 360;
      const tg = h >= 190 && h <= 270 ? L : h >= 20 && h <= 75 ? R : T; if (!tg) continue;
      const k = Math.min(1.25, v / 0.85); p[i] = Math.min(255, tg[0] * k); p[i + 1] = Math.min(255, tg[1] * k); p[i + 2] = Math.min(255, tg[2] * k);
    }
    cx.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.flipY = map.flipY; t.wrapS = map.wrapS; t.wrapT = map.wrapT; t.anisotropy = map.anisotropy; return (cache[key] = t);
  },
  /* length: the model is scaled so its long axis (z) is this many metres */
  DEFS: {
    gegyp: { len: 21.6, credit: 'GE AC4400CW "Awvr 777" by zairiq-zairiq-123-pixar-cars-bfdi (CC BY 4.0, Sketchfab), repainted in an Egyptian livery' },
    ge767: { len: 21.6, credit: 'GE AC4400CW "Awvr 767" by zairiq-zairiq-123-pixar-cars-bfdi (CC BY 4.0, Sketchfab)' },
    ge777: { len: 21.6, credit: 'GE AC4400CW "Awvr 777" by zairiq-zairiq-123-pixar-cars-bfdi (CC BY 4.0, Sketchfab)' },
    f59: { len: 17.5, credit: 'Metrolink EMD F59PH by Trashbulldogproductions (CC BY 4.0, Sketchfab)' },
    sd40: { len: 20.5, credit: 'BNSF EMD SD40 by zairiq zairiq 8 (CC BY 4.0, Sketchfab)' },
    honda: { len: 4.6, credit: '1994 Honda Accord Sedan low-poly by claries (CC BY 4.0, Sketchfab)' },
    signal: { h: 4.6, credit: 'Subway traffic light (game ready) by Xlay3D (CC BY 4.0, Sketchfab)' },
    coach1: { len: 26.2, credit: 'Simple Train Passenger Carriage by maryssoul24 (CC BY 4.0, Sketchfab)' },
    wh: { len: 20.4, credit: 'Sydney Trains Waratah (head car) by PolyDucky (CC BY 4.0, Sketchfab)' },
    wm: { len: 19.0, credit: 'Sydney Trains Waratah (car) by PolyDucky (CC BY 4.0, Sketchfab)' },
    wn: { len: 19.0, credit: 'Sydney Trains Waratah (car) by PolyDucky (CC BY 4.0, Sketchfab)' },
    tgh: { len: 26, fy: 0.74, credit: 'Tangara Sydney Trains T set (head car) by PolyDucky (CC BY 4.0, Sketchfab)' },
    tgm: { len: 26, fy: 0.74, credit: 'Tangara Sydney Trains T set (car) by PolyDucky (CC BY 4.0, Sketchfab)' },
    wbox: { len: 13.6, credit: 'Railway Boxcar Freight Wagon by saadthedesigner314 (CC BY 4.0, Sketchfab)' },
    whop: { len: 13.6, credit: 'Coal Hopper Railway Wagon by saadthedesigner314 (CC BY 4.0, Sketchfab)' },
    waratah: { len: 150, credit: 'Sydney Trains Waratah by PolyDucky (CC BY 4.0, Sketchfab)' }
  },
  CREDITS() { return Object.keys(this.DEFS).map((k) => this.DEFS[k].credit).filter((c, i, a) => c.indexOf('(head car)') < 0 && c.indexOf('(car)') < 0 && a.indexOf(c) === i); },
  load(name) {
    if (this.cache[name]) return this.cache[name];
    const def = this.DEFS[name]; if (!def || !window.THREE) return Promise.reject(new Error('no model ' + name));
    return (this.cache[name] = fetch('models/' + name + '.bin').then((r) => { if (!r.ok) throw new Error('model ' + name); return r.arrayBuffer(); }).then((buf) => {
      const hl = new DataView(buf).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
      let off = 4 + hl; const root = new THREE.Group(), loader = new THREE.TextureLoader(), mats = [], waits = [];
      const bb = head.bbox, len = bb[1][2] - bb[0][2], s = def.h ? def.h / (bb[1][1] - bb[0][1]) : def.len / len, cx = (bb[0][0] + bb[1][0]) / 2, cz = (bb[0][2] + bb[1][2]) / 2, y0 = bb[0][1];
      const inner = new THREE.Group(); root.add(inner); const fy = def.fy || 1; inner.scale.set(s, s * fy, s); inner.position.set(-cx * s, -y0 * s * fy, -cz * s);
      for (const m of head.mats) {
        const P = new Float32Array(buf, off, m.n * 3); off += m.n * 12; const N = new Float32Array(buf, off, m.n * 3); off += m.n * 12; const U = new Float32Array(buf, off, m.n * 2); off += m.n * 8; const I = new Uint32Array(buf, off, m.ni); off += m.ni * 4;
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setIndex(new THREE.BufferAttribute(I, 1));
        const glass = /glass|window/i.test(m.name), c = m.color;
        const mat = new THREE.MeshStandardMaterial({ color: m.tex ? 0xffffff : new THREE.Color(c[0], c[1], c[2]), roughness: glass ? 0.12 : Math.max(0.55, m.rough), metalness: glass ? 0.6 : 0.1, side: m.ds ? THREE.DoubleSide : THREE.FrontSide });
        if (glass && !m.tex) { mat.color = new THREE.Color(0x1c2a33); }
        if (m.tex) { let ok; waits.push(new Promise((res) => { ok = res; })); const t = loader.load('models/' + m.tex, () => ok(), undefined, () => ok()); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; mat.map = t; }
        const mesh = new THREE.Mesh(g, mat); mesh.castShadow = !(name === 'tgm' || name === 'wm' || name === 'wn' || name === 'coach1' || name === 'wh'); mesh.receiveShadow = true; inner.add(mesh); mats.push(mat); (root.userData.parts = root.userData.parts || []).push({ g, mat });
      }
      root.userData.bake = { s, ox: -cx * s, oy: -y0 * s, oz: -cz * s }; root.userData.size = [(bb[1][0] - bb[0][0]) * s, (bb[1][1] - bb[0][1]) * s, def.len];
      return Promise.all(waits).then(() => { this.ready[name] = root; return root; });   // only 'ready' once the textures are in, so a model never shows up black
    }));
  },
  /* a fresh independent copy (shares geometry/textures) */
  /* one merged geometry plus a material per part, ready for an InstancedMesh (len metres long, origin at the centre of the wheels' ground line) */
  bake(name, len) {
    const g = this.ready[name]; if (!g) return null; const d = this.DEFS[name], k = g.userData.bake, f = len / d.len, pos = [], nor = [], uv = [], idx = [], groups = [], mats = []; let off = 0, ioff = 0;
    for (const p of g.userData.parts) {
      const a = p.g.attributes.position, n = p.g.attributes.normal, u = p.g.attributes.uv, ix = p.g.index;
      for (let i = 0; i < a.count; i++) { pos.push(a.getX(i) * k.s * f + k.ox * f, a.getY(i) * k.s * f + k.oy * f, a.getZ(i) * k.s * f + k.oz * f); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
      for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
      groups.push([ioff, ix.count, mats.length]); mats.push(p.mat); off += a.count; ioff += ix.count;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    for (const q of groups) geo.addGroup(q[0], q[1], q[2]); return { geo, mats };
  },
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
  /* a figure sitting on a chair (hips at 0.5 m, thighs forward, shins down), made by folding the legs of a standing one */
  makeSeated(name) {
    const d = this.ready[name]; if (!d) return null; const g = new THREE.Group(), R = d.rad;
    let y0 = 1e9, y1 = -1e9; for (const p of d.parts) { const a = p.pos[0]; for (let i = 0; i < a.count; i++) { const y = a.getY(i) / 32767 * R; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    const H = y1 - y0, hip = y0 + 0.52 * H, knee = y0 + 0.285 * H, lim = 0.19 * H, sh = hip - 0.5, fwd = hip - knee;
    for (const p of d.parts) {
      const a = p.pos[0], nn = p.nor[0], n = a.count, P = new Float32Array(n * 3), N = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        let x = a.getX(i) / 32767 * R, y = a.getY(i) / 32767 * R, z = a.getZ(i) / 32767 * R, nx = nn.getX(i) / 127, ny = nn.getY(i) / 127, nz = nn.getZ(i) / 127;
        if (y < hip && Math.abs(x) < lim) {
          if (y >= knee) { const dy = y - hip, ty = ny; y = hip + z; z = -dy; ny = nz; nz = -ty; }
          else { y = hip + (y - knee); z += fwd; }
        }
        P[i * 3] = x; P[i * 3 + 1] = y - sh; P[i * 3 + 2] = z; N[i * 3] = nx; N[i * 3 + 1] = ny; N[i * 3 + 2] = nz;
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('uv', p.UV); geo.setIndex(p.I);
      const m = new THREE.Mesh(geo, p.mat); m.castShadow = false; m.frustumCulled = false; g.add(m);
    }
    return g;
  },
  /* one independent figure (shares buffers and materials); height in metres is already baked */
  make(name) {
    const d = this.ready[name]; if (!d) return null; const g = new THREE.Group(), meshes = [];
    for (const p of d.parts) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', p.pos[0]); geo.setAttribute('normal', p.nor[0]); geo.setAttribute('uv', p.UV); geo.setIndex(p.I); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.2);
      const m = new THREE.Mesh(geo, p.mat); m.scale.setScalar(d.rad); m.castShadow = false; m.frustumCulled = false; g.add(m); meshes.push([m, p]);
    }
    g.userData.frame = -1;
    g.userData.set = (k) => { k = ((k % d.K) + d.K) % d.K; if (k === g.userData.frame) return; g.userData.frame = k; for (const [m, p] of meshes) { m.geometry.setAttribute('position', p.pos[k]); m.geometry.setAttribute('normal', p.nor[k]); } };
    g.userData.K = d.K; g.userData.dur = d.dur; g.userData.set(0); return g;
  }
};
