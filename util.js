'use strict';
/* Shared helpers: seeded random, math, noise, geometry merging. */
const U = {
  rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  clamp: (x, a, b) => Math.min(b, Math.max(a, x)),
  lerp: (a, b, t) => a + (b - a) * t,
  smooth(a, b, x) { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); },
  canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
  hash2(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + (seed || 0) * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },
  /* Tileable value noise, period p cells. */
  vnoise(x, y, p, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const m = (a) => ((a % p) + p) % p;
    const a = U.hash2(m(xi), m(yi), seed), b = U.hash2(m(xi + 1), m(yi), seed);
    const c = U.hash2(m(xi), m(yi + 1), seed), d = U.hash2(m(xi + 1), m(yi + 1), seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  },
  fbm(x, y, p, oct, seed) {
    let s = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += amp * U.vnoise(x * f, y * f, p * f, seed + i); n += amp; amp *= 0.5; f *= 2; }
    return s / n;
  },
  /* Merge BufferGeometries that share the same attributes (non-indexed ok). */
  merge(list) {
    const pos = [], nor = [], uv = [], idx = [];
    let off = 0;
    for (const g of list) {
      const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        nor.push(n.getX(i), n.getY(i), n.getZ(i));
        uv.push(t ? t.getX(i) : 0, t ? t.getY(i) : 0);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
      else for (let i = 0; i < p.count; i++) idx.push(i + off);
      off += p.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    out.setIndex(idx);
    return out;
  },
  setProgress(p, msg) {
    const f = document.getElementById('loadFill'), m = document.getElementById('loadMsg');
    if (f) f.style.width = Math.round(p * 100) + '%';
    if (m && msg) m.textContent = msg;
  },
  tick() { return new Promise((r) => setTimeout(r, 0)); }
};
