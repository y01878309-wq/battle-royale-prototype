'use strict';
/* Procedural textures. No image files, so the app works offline. */
const Tex = {
  _wrap(c, repeat, srgb, aniso) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    if (srgb !== false) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = aniso || 8;
    return t;
  },

  /* Farmland seen from a distance: Voronoi parcels with crop rows and dirt field edges. */
  ground() {
    const S = 1024, c = U.canvas(S, S), g = c.getContext('2d');
    const img = g.createImageData(S, S), d = img.data, R = U.rng(7);
    const pal = [[74, 112, 44], [96, 132, 52], [58, 92, 40], [150, 140, 62], [122, 104, 58], [86, 76, 52], [112, 142, 66], [168, 150, 84]];
    const N = 26, seeds = [];
    for (let i = 0; i < N; i++) {
      const col = pal[Math.floor(R() * pal.length)];
      seeds.push({ x: R() * S, y: R() * S, col, ang: R() * Math.PI, freq: 0.25 + R() * 0.5, k: 0.85 + R() * 0.3 });
    }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let b1 = 1e9, b2 = 1e9, bi = 0;
      for (let i = 0; i < N; i++) {
        let dx = Math.abs(seeds[i].x - x), dy = Math.abs(seeds[i].y - y);
        if (dx > S / 2) dx = S - dx; if (dy > S / 2) dy = S - dy;
        const dd = dx * dx + dy * dy;
        if (dd < b1) { b2 = b1; b1 = dd; bi = i; } else if (dd < b2) b2 = dd;
      }
      const s = seeds[bi], edge = Math.sqrt(b2) - Math.sqrt(b1);
      const n = U.fbm(x / 24, y / 24, 43, 3, 3), fine = U.hash2(x, y, 9);
      const stripe = 0.5 + 0.5 * Math.sin((x * Math.cos(s.ang) + y * Math.sin(s.ang)) * s.freq);
      let k = s.k * (0.78 + 0.4 * n) * (0.93 + 0.1 * stripe) * (0.95 + 0.1 * fine);
      let r = s.col[0] * k, gg = s.col[1] * k, b = s.col[2] * k;
      if (edge < 5) { const t = U.smooth(5, 0, edge); r = U.lerp(r, 128, t * 0.8); gg = U.lerp(gg, 106, t * 0.8); b = U.lerp(b, 74, t * 0.8); }
      const o = (y * S + x) * 4;
      d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return this._wrap(c, true, true, 16);
  },

  sand() {
    const S = 512, c = U.canvas(S, S), g = c.getContext('2d');
    const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = U.fbm(x / 40, y / 40, 12, 4, 21), r = U.hash2(x, y, 5);
      const k = 0.78 + 0.35 * n + 0.06 * r, o = (y * S + x) * 4;
      d[o] = 214 * k; d[o + 1] = 184 * k; d[o + 2] = 132 * k; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return this._wrap(c, true, true, 8);
  },

  ballast() {
    const S = 256, c = U.canvas(S, S), g = c.getContext('2d');
    const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const a = U.hash2(x >> 1, y >> 1, 1), b = U.hash2(x, y, 2), n = U.fbm(x / 20, y / 20, 13, 3, 4);
      const k = 0.45 + 0.4 * a + 0.15 * b + 0.2 * n, o = (y * S + x) * 4;
      d[o] = 122 * k; d[o + 1] = 120 * k; d[o + 2] = 116 * k; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return this._wrap(c, true, true, 8);
  },

  /* One floor of a village house: wall, window with shutters and sill. */
  wall() {
    const S = 256, c = U.canvas(S, S), g = c.getContext('2d');
    const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = U.fbm(x / 30, y / 30, 9, 3, 8), r = U.hash2(x, y, 3);
      const brick = ((y % 16) < 1.5 || ((x + (Math.floor(y / 16) % 2) * 16) % 32) < 1.5) ? 0.9 : 1;
      const k = (0.72 + 0.28 * n + 0.04 * r) * brick, o = (y * S + x) * 4;
      d[o] = 235 * k; d[o + 1] = 228 * k; d[o + 2] = 214 * k; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.fillStyle = '#6b5a45'; g.fillRect(84, 66, 88, 112);
    g.fillStyle = '#1c2a33'; g.fillRect(90, 72, 76, 100);
    g.fillStyle = '#2f4f66'; g.fillRect(90, 72, 36, 100); g.fillRect(130, 72, 36, 100);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(94, 76, 10, 44);
    g.fillStyle = '#cfc6b0'; g.fillRect(78, 178, 100, 8);
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, 'rgba(0,0,0,.0)'); gr.addColorStop(.85, 'rgba(0,0,0,.0)'); gr.addColorStop(1, 'rgba(60,40,20,.35)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    return this._wrap(c, true, true, 8);
  },

  roof() {
    const S = 128, c = U.canvas(S, S), g = c.getContext('2d');
    const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = U.fbm(x / 16, y / 16, 8, 3, 12), k = 0.4 + 0.3 * n + 0.1 * U.hash2(x, y, 6), o = (y * S + x) * 4;
      d[o] = 150 * k; d[o + 1] = 140 * k; d[o + 2] = 128 * k; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return this._wrap(c, true, true, 4);
  },

  /* Date-palm frond with leaflets, alpha-tested. */
  frond() {
    const W = 256, H = 256, c = U.canvas(W, H), g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round';
    const R = U.rng(5);
    g.strokeStyle = '#4a5a2a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(128, H); g.quadraticCurveTo(128, 120, 128, 6); g.stroke();
    for (let i = 0; i < 60; i++) {
      const t = i / 60, y = H - 8 - t * (H - 20);
      const len = 14 + 108 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.92) * (1 - 0.4 * t);
      const droop = 12 + 22 * t;
      for (const side of [-1, 1]) {
        const col = `hsl(${88 + R() * 16},${42 + R() * 14}%,${22 + R() * 14}%)`;
        g.strokeStyle = col; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(128, y);
        g.quadraticCurveTo(128 + side * len * 0.55, y - 10 + droop * 0.2, 128 + side * len, y + droop);
        g.stroke();
      }
    }
    const t = this._wrap(c, false, true, 4);
    return t;
  },

  /* Tileable water normal map. */
  waterNormal() {
    const S = 256, h = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      h[y * S + x] = U.fbm(x / 16, y / 16, 16, 4, 31) * 1.0 + 0.4 * Math.sin(x / 256 * Math.PI * 16) * Math.sin(y / 256 * Math.PI * 8);
    }
    const c = U.canvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = at(x + 1, y) - at(x - 1, y), dy = at(x, y + 1) - at(x, y - 1);
      const nx = -dx * 3, ny = -dy * 3, nz = 1, l = Math.hypot(nx, ny, nz), o = (y * S + x) * 4;
      d[o] = (nx / l * 0.5 + 0.5) * 255; d[o + 1] = (ny / l * 0.5 + 0.5) * 255; d[o + 2] = (nz / l * 0.5 + 0.5) * 255; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return this._wrap(c, true, false, 8);
  },

  /* Text sign (station names, kilometre posts). */
  sign(text, w, h, bg, fg, font) {
    const c = U.canvas(w, h), g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = Math.max(4, h * 0.05);
    g.strokeRect(g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    g.font = font || `700 ${Math.floor(h * 0.5)}px "Reem Kufi", Tajawal, sans-serif`;
    g.fillText(text, w / 2, h / 2 + h * 0.03);
    return this._wrap(c, false, true, 8);
  },

  /* Gauge dial for the cab dashboard. */
  dial(max, label) {
    const S = 256, c = U.canvas(S, S), g = c.getContext('2d');
    g.fillStyle = '#0c0b09'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
    g.strokeStyle = '#6b6252'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#efe6d2'; g.strokeStyle = '#efe6d2'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 18px Tajawal, sans-serif';
    for (let v = 0; v <= max; v += max / 10) {
      const a = Math.PI * 0.75 + (v / max) * Math.PI * 1.5, x = 128 + Math.cos(a) * 88, y = 128 + Math.sin(a) * 88;
      g.lineWidth = 3; g.beginPath(); g.moveTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); g.lineTo(128 + Math.cos(a) * 116, 128 + Math.sin(a) * 116); g.stroke();
      g.fillText(String(Math.round(v)), x, y);
    }
    g.fillStyle = '#f2a93b'; g.font = '700 20px Tajawal, sans-serif'; g.fillText(label, 128, 190);
    return this._wrap(c, false, true, 4);
  }
};
