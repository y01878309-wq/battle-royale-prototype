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

  /* Apartment block: two floors, two bays: windows with green shutters, balconies with railings, air-conditioners, brick colour in the pattern. */
  apt() {
    const S = 256, c = U.canvas(S, S), g = c.getContext('2d'), R = U.rng(77);
    const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = U.fbm(x / 24, y / 24, 5, 3, 11), o = (y * S + x) * 4, brick = ((y % 8) < 1 || ((x + (Math.floor(y / 8) % 2) * 8) % 16) < 1) ? 0.9 : 1;
      const k = (0.78 + 0.22 * n) * brick; d[o] = 232 * k; d[o + 1] = 224 * k; d[o + 2] = 210 * k; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (let f = 0; f < 2; f++) for (let b = 0; b < 2; b++) {
      const x0 = b * 128, y0 = f * 128;
      g.fillStyle = '#3d3b37'; g.fillRect(x0 + 30, y0 + 22, 68, 80);                        // opening
      g.fillStyle = '#243846'; g.fillRect(x0 + 34, y0 + 26, 60, 72);                        // glass
      g.fillStyle = '#4c7a45'; g.fillRect(x0 + 34, y0 + 26, 24, 72); g.fillRect(x0 + 70, y0 + 26, 24, 72);   // green shutters
      g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x0 + 60, y0 + 28, 6, 40);
      g.fillStyle = '#c9c2b0'; g.fillRect(x0 + 18, y0 + 102, 92, 9);                          // balcony slab
      g.strokeStyle = '#3a3a3a'; g.lineWidth = 2; for (let r = 0; r <= 7; r++) { g.beginPath(); g.moveTo(x0 + 20 + r * 12.5, y0 + 102); g.lineTo(x0 + 20 + r * 12.5, y0 + 84); g.stroke(); }
      g.beginPath(); g.moveTo(x0 + 20, y0 + 84); g.lineTo(x0 + 108, y0 + 84); g.stroke();
      if (R() < 0.35) { g.fillStyle = '#e9e9e4'; g.fillRect(x0 + 100, y0 + 40, 18, 14); g.fillStyle = '#888'; g.fillRect(x0 + 103, y0 + 46, 12, 2); }
      else if (R() < 0.3) { g.fillStyle = ['#c94a3a', '#e8d26a', '#4a7ac9'][Math.floor(R() * 3)]; g.fillRect(x0 + 40, y0 + 86, 20, 14); }
    }
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 124, S, 4); g.fillRect(0, 252, S, 4);   // floor lines
    return this._wrap(c, true, true, 8);
  },

  /* Ground-floor shops: roll-up shutters and coloured signs. */
  shops() {
    const W = 512, H = 128, c = U.canvas(W, H), g = c.getContext('2d'), R = U.rng(5);
    g.fillStyle = '#b9b2a2'; g.fillRect(0, 0, W, H);
    const cols = ['#c23b2e', '#2e6cc2', '#e0a82a', '#2e9a58', '#7a3ba8', '#d8d8d0', '#e0702a'];
    for (let i = 0; i < 6; i++) {
      const x = i * 85 + 3; g.fillStyle = '#6c6a66'; g.fillRect(x, 40, 79, 88);
      g.strokeStyle = '#555'; g.lineWidth = 1; for (let y = 46; y < 128; y += 6) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 79, y); g.stroke(); }
      if (R() < 0.45) { g.fillStyle = '#f0dfb0'; g.fillRect(x + 8, 48, 63, 60); g.fillStyle = '#2a2a2a'; g.fillRect(x + 8, 48, 63, 6); }
      g.fillStyle = cols[Math.floor(R() * cols.length)]; g.fillRect(x, 8, 79, 28);
      g.fillStyle = 'rgba(255,255,255,.85)'; for (let k = 0; k < 4; k++) g.fillRect(x + 8 + k * 16, 18, 11, 6);
    }
    return this._wrap(c, true, true, 8);
  },

  /* Highway asphalt: dashed centre line, solid edge lines. Repeats along the road (v). */
  road() {
    const W = 128, H = 128, c = U.canvas(W, H), g = c.getContext('2d');
    const img = g.createImageData(W, H), d = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = 0.8 + 0.2 * U.hash2(x, y, 4), o = (y * W + x) * 4; d[o] = 62 * k; d[o + 1] = 62 * k; d[o + 2] = 64 * k; d[o + 3] = 255; }
    g.putImageData(img, 0, 0);
    g.fillStyle = '#e8e4d4'; g.fillRect(4, 0, 3, H); g.fillRect(W - 7, 0, 3, H); g.fillStyle = '#f0c93a'; g.fillRect(W / 2 - 1, 0, 3, 64);
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

  /* One floor of a station facade: two arched windows between a cornice and a plinth. */
  facade(hex) {
    const W = 512, H = 256, c = U.canvas(W, H), g = c.getContext('2d');
    const r = (hex >> 16) & 255, gg = (hex >> 8) & 255, b = hex & 255;
    const img = g.createImageData(W, H), d = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = U.fbm(x / 28, y / 28, 18, 3, 14), k = 0.8 + 0.3 * n + 0.04 * U.hash2(x, y, 4), o = (y * W + x) * 4;
      d[o] = Math.min(255, r * k); d[o + 1] = Math.min(255, gg * k); d[o + 2] = Math.min(255, b * k); d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, 0, W, 16);
    g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, H - 22, W, 22);
    for (const cx of [128, 384]) {
      g.fillStyle = '#e9e0c8'; g.beginPath(); g.moveTo(cx - 44, 214); g.lineTo(cx - 44, 92); g.arc(cx, 92, 44, Math.PI, 0); g.lineTo(cx + 44, 214); g.fill();
      g.fillStyle = '#1f3140'; g.beginPath(); g.moveTo(cx - 34, 214); g.lineTo(cx - 34, 92); g.arc(cx, 92, 34, Math.PI, 0); g.lineTo(cx + 34, 214); g.fill();
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(cx - 28, 96, 18, 100);
      g.fillStyle = '#e9e0c8'; g.fillRect(cx - 2, 60, 4, 154); g.fillRect(cx - 34, 150, 68, 4);
      g.fillStyle = '#cfc4a6'; g.fillRect(cx - 52, 214, 104, 8);
    }
    return this._wrap(c, true, true, 8);
  },

  clock() {
    const S = 256, c = U.canvas(S, S), g = c.getContext('2d');
    g.fillStyle = '#efe8d6'; g.beginPath(); g.arc(128, 128, 122, 0, 7); g.fill();
    g.strokeStyle = '#2a2622'; g.lineWidth = 8; g.stroke(); g.lineWidth = 5;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100); g.lineTo(128 + Math.sin(a) * 114, 128 - Math.cos(a) * 114); g.stroke(); }
    g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(2.1) * 62, 128 - Math.cos(2.1) * 62); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(0.4) * 92, 128 - Math.cos(0.4) * 92); g.stroke();
    return this._wrap(c, false, true, 4);
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

  /* Yellow/black warning chevrons for the buffer beam. */
  chevron() {
    const W = 512, H = 96, c = U.canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#e8c21a'; g.fillRect(0, 0, W, H); g.fillStyle = '#17160f';
    for (let x = -H; x < W + H; x += 64) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + 32, H); g.lineTo(x + 32 + H * 0.6, 0); g.lineTo(x + H * 0.6, 0); g.fill(); }
    g.strokeStyle = '#17160f'; g.lineWidth = 5; g.strokeRect(0, 0, W, H);
    return this._wrap(c, false, true, 8);
  },

  /* Radiator / engine-room grille: dark panel with vertical louvres. */
  grille(w, h) {
    const W = 256, H = Math.round(256 * h / w), c = U.canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#141311'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#3a3935'; g.lineWidth = 3;
    for (let x = 10; x < W - 4; x += 12) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x, H - 6); g.stroke(); }
    g.lineWidth = 6; g.strokeStyle = '#2a2926'; g.strokeRect(3, 3, W - 6, H - 6);
    return this._wrap(c, false, true, 4);
  },

  /* Cab windscreen seen from outside: dark glass with brownish sun-blind slats in the upper part, centre pillar. */
  louver(blind) {
    const W = 512, H = 256, c = U.canvas(W, H), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a3a46'); gr.addColorStop(1, '#0b1217'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (blind) {
      g.fillStyle = 'rgba(168,104,52,0.88)';
      for (let y = 6; y < H * 0.62; y += 11) g.fillRect(8, y, W / 2 - 14, 7), g.fillRect(W / 2 + 6, y, W / 2 - 14, 7);
    }
    g.fillStyle = '#101010'; g.fillRect(W / 2 - 9, 0, 18, H);
    g.strokeStyle = '#0b0b0b'; g.lineWidth = 12; g.strokeRect(0, 0, W, H);
    return this._wrap(c, false, true, 4);
  },

  /* Egyptian flag, small, for the loco sides. */
  flag() {
    const W = 192, H = 128, c = U.canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#ce1126'; g.fillRect(0, 0, W, H / 3); g.fillStyle = '#f4f0e6'; g.fillRect(0, H / 3, W, H / 3); g.fillStyle = '#111'; g.fillRect(0, 2 * H / 3, W, H / 3);
    g.fillStyle = '#c09300'; g.beginPath(); g.arc(W / 2, H / 2, 11, 0, 7); g.fill();
    return this._wrap(c, false, true, 4);
  },

  /* Shipping container side: corrugated, door lines and a name. */
  container(color, label) {
    const W = 512, H = 128, c = U.canvas(W, H), g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.2)'; for (let x = 4; x < W; x += 12) g.fillRect(x, 0, 4, H);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, 8); g.fillRect(0, H - 8, W, 8);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '800 54px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, W / 2, H / 2);
    return this._wrap(c, false, true, 8);
  },

  /* Plain lettering plate for wagons (cargo name). */
  plate(text, w, h, bg, fg) { return this.sign(text, w, h, bg, fg); },

  /* Terracotta platform tiles with grout. One canvas covers 2 m x 2 m (4 x 4 tiles). */
  tile() {
    const S = 256, c = U.canvas(S, S), g = c.getContext('2d'), R = U.rng(21);
    g.fillStyle = '#cfc6b8'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const v = (R() - 0.5) * 14; g.fillStyle = `rgb(${Math.round(196 + v)},${Math.round(108 + v)},${Math.round(70 + v)})`; g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
    }
    return this._wrap(c, true, true, 8);
  },

  /* Platform name board: Arabic on top, Latin below, white on blue. */
  board(ar, en, w, h) {
    const c = U.canvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#1b3d70'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f4f0e6'; g.lineWidth = Math.max(4, h * 0.04); g.strokeRect(g.lineWidth, g.lineWidth, w - 2 * g.lineWidth, h - 2 * g.lineWidth);
    g.fillStyle = '#f4f0e6'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    g.font = `700 ${Math.floor(h * (en ? 0.42 : 0.5))}px "Reem Kufi", Tajawal, sans-serif`; g.fillText(ar, w / 2, h * (en ? 0.38 : 0.52));
    if (en) { g.direction = 'ltr'; g.font = `700 ${Math.floor(h * 0.2)}px Arial, sans-serif`; g.fillText(en.toUpperCase(), w / 2, h * 0.78); }
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
