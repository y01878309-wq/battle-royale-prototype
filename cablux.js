/* CabLux: the "luxury Egyptian cab" (ENR) exactly as authored by the game's owner (his three.js code, kept as written: walls, rounded windscreen, stepped walnut console,
 * sloped screen box, every button / lever / lamp / label, the seat, the phone, the ceiling fan). Only adapted to the game:
 *   - built inside a mount group that maps his axes (x forward, z across) onto the cab's (z forward, x across) and scales it to fit the loco;
 *   - the levers, buttons and screens are exposed so the game can drive them (speed, brake, horn, doors, emergency, lights);
 *   - a few real-cab details he had not modelled are added in the "additions" block;
 *   - colours / textures are converted to the game's sRGB output. */
const CabLux = (() => {
  function build() {
    let airTex = null;
    function put(parent, mesh, x, y, z, rx = 0, ry = 0, rz = 0) {
      mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); parent.add(mesh); return mesh;
    }

    const DESK_TOP = 0.812;

    // ========= خامات فخمة للأرضية الخشب وسطح الجوز والجلد =========
    function makeWoodFloorTex() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 512;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#4a3525'; ctx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 64) {
        ctx.fillStyle = y % 128 === 0 ? 'rgba(255,215,170,0.06)' : 'rgba(0,0,0,0.08)';
        ctx.fillRect(0, y, 512, 62);
        ctx.fillStyle = '#241810'; ctx.fillRect(0, y + 62, 512, 2);
      }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
    }

    function makeDeskWalnutTex() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 512;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3d2f27'; ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 600; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,235,210,0.03)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(Math.random()*512, Math.random()*512, 40 + Math.random()*80, 2);
      }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    }

    const M = {
      wall: new THREE.MeshStandardMaterial({ color: 0xe3dcd0, roughness: 0.72 }), // عاجي/شامبين فخم
      floor: new THREE.MeshStandardMaterial({ map: makeWoodFloorTex(), roughness: 0.55, metalness: 0.08 }),
      desk: new THREE.MeshStandardMaterial({ map: makeDeskWalnutTex(), roughness: 0.42, metalness: 0.14 }),
      baseDark: new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.52, metalness: 0.2 }),
      hood: new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.40, metalness: 0.25 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.78 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xd0d8e4, metalness: 0.94, roughness: 0.14 }),
      crimson: new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.25, roughness: 0.28 }),
      blue: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.30 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.30 }),
      orange: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.30 }),
      green: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.30 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.38 }),
      seat: new THREE.MeshStandardMaterial({ color: 0x15223b, roughness: 0.65, metalness: 0.08 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xcbe9ff, transparent: true, opacity: 0.16, metalness: 0.35, roughness: 0.05, side: THREE.DoubleSide })
    };

    function addRoundedRect(path, x, y, w, h, r, cw = false) {
      if (!cw) {
        path.moveTo(x+r, y); path.lineTo(x+w-r, y); path.quadraticCurveTo(x+w, y, x+w, y+r);
        path.lineTo(x+w, y+h-r); path.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
        path.lineTo(x+r, y+h); path.quadraticCurveTo(x, y+h, x, y+h-r);
        path.lineTo(x, y+r); path.quadraticCurveTo(x, y, x+r, y);
      } else {
        path.moveTo(x+r, y); path.lineTo(x, y+r); path.lineTo(x, y+h-r); path.quadraticCurveTo(x, y+h, x+r, y+h);
        path.lineTo(x+w-r, y+h); path.quadraticCurveTo(x+w, y+h, x+w, y+h-r);
        path.lineTo(x+w, y+r); path.quadraticCurveTo(x+w, y, x+w-r, y); path.lineTo(x+r, y);
      }
    }

    function createRubberGasket(w, h, r, thick = 0.055) {
      const s = new THREE.Shape();
      addRoundedRect(s, -w/2 - thick, -h/2 - thick, w + thick*2, h + thick*2, r + 0.03, false);
      const hole = new THREE.Path(); addRoundedRect(hole, -w/2, -h/2, w, h, r, true);
      s.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, curveSegments: 8 });
      g.translate(0, 0, -0.03);
      return new THREE.Mesh(g, M.rubber);
    }

    // ========= خامات الشاشات والعدادات والتيكتات =========
    const emCanvas = document.createElement('canvas'); emCanvas.width = 512; emCanvas.height = 256;
    const emTex = new THREE.CanvasTexture(emCanvas);
    function drawEM(notch) {
      const ctx = emCanvas.getContext('2d');
      ctx.fillStyle='#050f1d'; ctx.fillRect(0,0,512,256);
      ctx.fillStyle='#102e52'; ctx.fillRect(0,0,512,34);
      ctx.fillStyle='#38bdf8'; ctx.font='bold 17px Tahoma';
      ctx.fillText('EM2000  •  حالة الجرار ٢٤٨٠', 18, 23);
      [[18,48,145,76],[180,48,145,76],[342,48,150,76],[18,136,145,76],[180,136,145,76]].forEach(b=>{
        ctx.fillStyle='#0c1f36'; ctx.fillRect(...b); ctx.strokeStyle='#255082'; ctx.strokeRect(...b);
      });
      ctx.fillStyle='#ffffff'; ctx.font='bold 24px Arial';
      ctx.fillText('A ' + (420 + notch*65), 210, 96);
      ctx.fillText('rpm ' + (650 + notch*85), 358, 96);
      ctx.fillText('62%', 58, 184); ctx.fillText('bar 4.6', 206, 184);
      ctx.fillStyle='#94a3b8'; ctx.font='15px Arial'; ctx.fillText('81°', 68, 98);
      ['الرئيسية','الأعطال','الموتور','الجر','الفرامل'].forEach((t, i)=>{
        ctx.fillStyle='#1a3352'; ctx.fillRect(18+i*96, 224, 88, 22);
        ctx.fillStyle='#cbd5e1'; ctx.font='12px Tahoma'; ctx.fillText(t, 34+i*96, 239);
      });
      emTex.needsUpdate = true;
    }

    const spCanvas = document.createElement('canvas'); spCanvas.width = 256; spCanvas.height = 256;
    const spTex = new THREE.CanvasTexture(spCanvas);
    function drawSpeedo(notch) {
      const ctx = spCanvas.getContext('2d'), spd = notch * 17;
      ctx.fillStyle='#0b1220'; ctx.beginPath(); ctx.arc(128,128,122,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#d0d8e4'; ctx.lineWidth=6; ctx.stroke();
      for (let i=0; i<=16; i++) {
        const a = Math.PI*0.75 + (i/16)*Math.PI*1.5;
        ctx.strokeStyle = i>=14 ? '#ef4444' : '#e2e8f0'; ctx.lineWidth = i%2===0?3:1.5;
        ctx.beginPath(); ctx.moveTo(128+Math.cos(a)*88, 128+Math.sin(a)*88); ctx.lineTo(128+Math.cos(a)*106, 128+Math.sin(a)*106); ctx.stroke();
      }
      ctx.fillStyle='#facc15'; ctx.font='bold 14px Arial'; ctx.textAlign='center'; ctx.fillText('EMD • ENR', 128, 200);
      ctx.fillStyle='#ffffff'; ctx.font='bold 22px Arial'; ctx.fillText(spd + '', 128, 174);
      const ang = Math.PI*0.75 + (spd/160)*Math.PI*1.5;
      ctx.strokeStyle='#f97316'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(128,128); ctx.lineTo(128+Math.cos(ang)*82, 128+Math.sin(ang)*82); ctx.stroke();
      spTex.needsUpdate = true;
    }

    const atcCanvas = document.createElement('canvas'); atcCanvas.width = 128; atcCanvas.height = 128;
    const atcTex = new THREE.CanvasTexture(atcCanvas);
    function drawAtc(notch) {
      const ctx = atcCanvas.getContext('2d'), spd = notch * 17;
      ctx.fillStyle='#0a1424'; ctx.fillRect(0,0,128,128);
      ctx.strokeStyle='#1e3a5f'; ctx.lineWidth=8; ctx.beginPath(); ctx.arc(64,68,38,Math.PI*0.75,Math.PI*2.25); ctx.stroke();
      ctx.strokeStyle='#facc15'; ctx.beginPath(); ctx.arc(64,68,38,Math.PI*0.75,Math.PI*(0.75+1.5*(spd/140))); ctx.stroke();
      ctx.fillStyle='#ffffff'; ctx.font='bold 28px Arial'; ctx.textAlign='center'; ctx.fillText(spd, 64, 78);
      atcTex.needsUpdate = true;
    }

    function makeAirTex() {
      const c = document.createElement('canvas'); c.width=512; c.height=256;
      const ctx = c.getContext('2d'); ctx.fillStyle='#050f1d'; ctx.fillRect(0,0,512,256);
      ctx.fillStyle='#102e52'; ctx.fillRect(0,0,512,34);
      ctx.fillStyle='#38bdf8'; ctx.font='bold 17px Tahoma'; ctx.fillText('الهواء والفرامل', 18, 23);
      [['bar 9.4',320,'#38bdf8',62],['bar 5.0',220,'#f8fafc',110],['bar 5.0',220,'#f8fafc',158],['bar 0.3',45,'#22c55e',206]].forEach(([lbl,w,col,y])=>{
        ctx.fillStyle='#e2e8f0'; ctx.font='bold 18px Arial'; ctx.fillText(lbl, 18, y+18);
        ctx.fillStyle='#1e293b'; ctx.fillRect(110,y,370,22); ctx.fillStyle=col; ctx.fillRect(110,y,w,22);
      });
      return new THREE.CanvasTexture(c);
    }

    function makeDialTex(ang = 2.4) {
      const c = document.createElement('canvas'); c.width=128; c.height=128;
      const ctx = c.getContext('2d'); ctx.fillStyle='#0b1220'; ctx.beginPath(); ctx.arc(64,64,60,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#d0d8e4'; ctx.lineWidth=5; ctx.stroke();
      ctx.strokeStyle='#ef4444'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(64,64); ctx.lineTo(64+Math.cos(ang)*44, 64+Math.sin(ang)*44); ctx.stroke();
      ctx.strokeStyle='#f8fafc'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(64,64); ctx.lineTo(64+Math.cos(ang+1.1)*38, 64+Math.sin(ang+1.1)*38); ctx.stroke();
      return new THREE.CanvasTexture(c);
    }

    function makeScaleTex() {
      const c = document.createElement('canvas'); c.width=64; c.height=256;
      const ctx = c.getContext('2d'); ctx.fillStyle='#111827'; ctx.fillRect(0,0,64,256);
      const cols = ['#ef4444','#f97316','#facc15','#facc15','#22c55e','#22c55e','#22c55e','#38bdf8','#38bdf8'];
      for (let i=0; i<9; i++) {
        ctx.fillStyle = cols[i]; ctx.fillRect(8, 12 + i*26, 26, 12);
        ctx.fillStyle = '#f1f5f9'; ctx.font='bold 14px Arial'; ctx.fillText(8-i, 42, 23 + i*26);
      }
      return new THREE.CanvasTexture(c);
    }

    function makePhoneTex() {
      const c = document.createElement('canvas'); c.width=256; c.height=160;
      const ctx = c.getContext('2d'); ctx.fillStyle='#c4bcb0'; ctx.fillRect(0,0,256,160);
      ctx.fillStyle='#6b655d'; ctx.beginPath(); ctx.arc(64,80,44,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#e7e5e4'; ctx.fillRect(128,22,110,55);
      ctx.fillStyle='#292524'; for(let r=0;r<3;r++) for(let k=0;k<4;k++) ctx.fillRect(132+k*26, 90+r*20, 18, 13);
      return new THREE.CanvasTexture(c);
    }

    function makeLabelTex(txt) {
      const c = document.createElement('canvas'); c.width=128; c.height=48;
      const ctx = c.getContext('2d'); ctx.fillStyle='#f1f5f9'; ctx.fillRect(0,0,128,48);
      ctx.strokeStyle='#334155'; ctx.lineWidth=4; ctx.strokeRect(0,0,128,48);
      ctx.fillStyle='#0f172a'; ctx.font='bold 24px Tahoma'; ctx.textAlign='center'; ctx.fillText(txt, 64, 32);
      return new THREE.CanvasTexture(c);
    }

    function makeSignTex(txt) {
      const c = document.createElement('canvas'); c.width=256; c.height=64;
      const ctx = c.getContext('2d'); ctx.fillStyle='#090d16'; ctx.fillRect(0,0,256,64);
      ctx.fillStyle='#facc15'; ctx.font='bold 28px Tahoma'; ctx.textAlign='center'; ctx.fillText(txt, 128, 42);
      return new THREE.CanvasTexture(c);
    }

    // ========= بناء الكابينة الفخمة الكاملة =========
    const cabRoot = new THREE.Group(); cabRoot.name = 'Egyptian_Cab_Luxury_Complete';

    // الأرضية الخشب الباركيه + السقف الشامبين + الحائط الخلفي
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.08, 2.86), M.floor), 0.02, 0.04, 0);
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(2.40, 0.06, 2.86), M.wall), -0.10, 2.26, 0);

    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.22, 2.86), M.wall), -1.28, 1.15, 0);
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.75, 0.72), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.45 })), -1.22, 0.96, 0);
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.15, 0.64), M.hood), -1.16, 1.18, -0.88);
    [-0.18, 0, 0.18].forEach(bz => put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.04), M.crimson), -1.08, 1.25, -0.88+bz));
    put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.46, 14), M.crimson), -1.16, 0.56, 0.88);

    // مروحة السقف + شاشة القطار العلوية
    put(cabRoot, new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.012, 8, 22), M.rubber), 0.28, 2.09, -0.18, Math.PI/2.3, 0, 0);
    const fanBlades = put(cabRoot, new THREE.Group(), 0.28, 2.09, -0.18, Math.PI/2.3, 0, 0);
    for (let i=0; i<3; i++) put(fanBlades, new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.01, 0.06), M.chrome), 0, 0, 0, 0, (i*Math.PI)/3, 0);

    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.14, 0.52), M.hood), 0.85, 2.15, 0);
    put(cabRoot, new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.10), new THREE.MeshBasicMaterial({ map: makeSignTex('قطر ١٢٠٥ • ENR') })), 0.795, 2.15, 0, 0, -Math.PI/2, 0);

    // الواجهة الأمامية بالشباكين المدورين + المساحات المتحركة
    const frontWallShape = new THREE.Shape();
    addRoundedRect(frontWallShape, -1.42, 0.08, 2.84, 2.22, 0.05, false);
    const winHoleL = new THREE.Path(); addRoundedRect(winHoleL, -1.26, 1.12, 1.14, 0.98, 0.14, true);
    const winHoleR = new THREE.Path(); addRoundedRect(winHoleR,  0.12, 1.12, 1.14, 0.98, 0.14, true);
    frontWallShape.holes.push(winHoleL, winHoleR);

    const frontWallGeo = new THREE.ExtrudeGeometry(frontWallShape, { depth: 0.10, bevelEnabled: false, curveSegments: 8 });
    const frontWallGroup = put(cabRoot, new THREE.Group(), 1.38, 0.02, 0);
    frontWallGroup.rotation.order = 'YXZ'; frontWallGroup.rotation.y = -Math.PI/2; frontWallGroup.rotation.x = +0.26;
    put(frontWallGroup, new THREE.Mesh(frontWallGeo, M.wall), 0, 0, 0);

    const wiperPivots = [];
    [-0.69, 0.69].forEach(wx => {
      put(frontWallGroup, createRubberGasket(1.14, 0.98, 0.14, 0.048), wx, 1.61, 0.05);
      put(frontWallGroup, new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.96), M.glass), wx, 1.61, 0.05);
      const wp = put(frontWallGroup, new THREE.Group(), wx + (wx<0?0.35:-0.25), 1.14, 0.10, 0, 0, wx<0?0.35:-0.35);
      put(wp, new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.72, 0.03), M.rubber), 0, 0.36, 0);
      wiperPivots.push(wp);
      put(frontWallGroup, new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.14, 0.02), M.rubber), wx, 2.04, -0.04, 0.35, 0, 0);
    });

    // الجدران الجانبية (الخط القرمزي اللامع + العتبات البيضاء + الماسورة الكروم + المراية)
    function buildSideWall(zPos, winW, hasPole, hasMirror) {
      const swShape = new THREE.Shape();
      addRoundedRect(swShape, -1.32, 0.08, 2.60, 2.18, 0.02, false);
      const swHole = new THREE.Path(); addRoundedRect(swHole, -0.35, 1.04, winW, 0.94, 0.14, true);
      swShape.holes.push(swHole);
      put(cabRoot, new THREE.Mesh(new THREE.ExtrudeGeometry(swShape, { depth: 0.08, bevelEnabled: false, curveSegments: 8 }), M.wall), 0, 0, zPos);

      const winCx = -0.35 + winW/2;
      put(cabRoot, createRubberGasket(winW, 0.94, 0.14, 0.045), winCx, 1.51, zPos + 0.04);
      put(cabRoot, new THREE.Mesh(new THREE.PlaneGeometry(winW, 0.92), M.glass), winCx, 1.51, zPos + 0.04);

      const inSide = zPos < 0 ? 0.10 : -0.02;
      put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(winW + 0.16, 0.06, 0.13), M.white), winCx, 0.99, zPos + inSide);
      put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(2.50, 0.055, 0.02), M.crimson), 0, 0.72, zPos + (zPos<0?0.085:-0.005));

      if (hasPole) {
        put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.92, 0.06), M.rubber), winCx - 0.05, 1.51, zPos + 0.04);
        put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.11, 0.04), M.white), winCx - 0.07, 1.51, zPos + 0.08);
        put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.18, 12), M.chrome), -0.05, 1.15, zPos + 0.15);
      }
      if (hasMirror) put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.16), M.rubber), winCx + 0.45, 1.52, zPos - 0.18);
    }
    buildSideWall(-1.42, 1.12, true, true);
    buildSideWall( 1.34, 0.92, false, false);

    // ========= الكونسول الفخم المتدرج + الإضاءة الحمراء السفلية =========
    const deskShape = new THREE.Shape();
    deskShape.moveTo(0.32, 1.34); deskShape.lineTo(1.22, 1.34); deskShape.lineTo(1.22, -1.34);
    deskShape.lineTo(0.64, -1.34); deskShape.lineTo(0.44, -0.52); deskShape.lineTo(0.32, -0.35); deskShape.closePath();

    const deskGeo = new THREE.ExtrudeGeometry(deskShape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012 });
    deskGeo.rotateX(-Math.PI/2);
    put(cabRoot, new THREE.Mesh(deskGeo, M.desk), 0, 0.75, 0);

    const baseGeo = new THREE.ExtrudeGeometry(deskShape, { depth: 0.72, bevelEnabled: false });
    baseGeo.rotateX(-Math.PI/2);
    const baseMesh = put(cabRoot, new THREE.Mesh(baseGeo, M.baseDark), -0.02, 0.02, 0);
    baseMesh.scale.set(0.96, 1, 0.99);

    const redLipGeo = new THREE.ExtrudeGeometry(deskShape, { depth: 0.018, bevelEnabled: false });
    redLipGeo.rotateX(-Math.PI/2);
    put(cabRoot, new THREE.Mesh(redLipGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 })), 0, 0.72, 0);

    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.45), M.baseDark), 0.32, 0.11, 0.38, 0, 0, -0.25);
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.18), M.chrome),   0.31, 0.15, 0.38, 0, 0, -0.25);

    // ========= صندوق الشاشات المائل (بإطارات كروم فخمة وكل الأزرار بدون نسيان!) =========
    const wedgeShape = new THREE.Shape();
    wedgeShape.moveTo(0.72, DESK_TOP); wedgeShape.lineTo(1.18, DESK_TOP);
    wedgeShape.lineTo(1.18, 1.24); wedgeShape.lineTo(0.94, 1.24); wedgeShape.closePath();
    const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, { depth: 1.46, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012 });
    wedgeGeo.translate(0, 0, -0.90);
    put(cabRoot, new THREE.Mesh(wedgeGeo, M.hood), 0, 0, 0);

    const slopeAngle = Math.atan2(0.94 - 0.72, 1.24 - DESK_TOP);
    const hoodFace = put(cabRoot, new THREE.Group(), (0.72+0.94)/2, (DESK_TOP+1.24)/2, -0.17, 0, 0, -slopeAngle);

    // إطارات الشاشات والعداد الأوسط
    [-0.44, 0.44].forEach(sz => put(hoodFace, new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.21, 0.47), M.chrome), -0.011, 0.095, sz));
    put(hoodFace, new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.19), new THREE.MeshBasicMaterial({ map: emTex })), -0.017, 0.095, -0.44, 0, -Math.PI/2, 0);
    put(hoodFace, new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.008, 10, 24), M.chrome), -0.014, 0.095, 0.00, 0, -Math.PI/2, 0);
    put(hoodFace, new THREE.Mesh(new THREE.CircleGeometry(0.080, 24), new THREE.MeshBasicMaterial({ map: spTex })), -0.015, 0.095, 0.00, 0, -Math.PI/2, 0);
    put(hoodFace, new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.19), new THREE.MeshBasicMaterial({ map: (airTex = makeAirTex()) })), -0.017, 0.095, 0.44, 0, -Math.PI/2, 0);

    // الصف السفلي على اللوحة المائلة (كل زر وتيكت)
    [-0.58, -0.44, -0.30, -0.16].forEach((kz, i) => {
      put(hoodFace, new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.024, 0.025, 14), M.chrome), -0.015, -0.095, kz, 0, 0, Math.PI/2);
      put(hoodFace, new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.010, 0.036), i===3?M.rubber:M.chrome), -0.028, -0.095, kz, 0.4*(i%2?1:-1), 0, 0);
      put(hoodFace, new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.022), new THREE.MeshBasicMaterial({ map: makeLabelTex(['نور','رمل','تكييف','مفتاح'][i]) })), -0.014, -0.145, kz, 0, -Math.PI/2, 0);
    });
    put(hoodFace, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.025, 14), new THREE.MeshBasicMaterial({ color: 0x22c55e })), -0.016, -0.095, -0.01, 0, 0, Math.PI/2);
    put(hoodFace, new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.022), new THREE.MeshBasicMaterial({ map: makeLabelTex('تشغيل') })), -0.014, -0.145, -0.01, 0, -Math.PI/2, 0);

    put(hoodFace, new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.095), new THREE.MeshBasicMaterial({ map: atcTex })), -0.015, -0.095, 0.19, 0, -Math.PI/2, 0);
    put(hoodFace, new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), M.orange), -0.018, -0.072, 0.295);
    put(hoodFace, new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), M.blue),   -0.018, -0.115, 0.295);
    put(hoodFace, new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.012, 0.02, 10), M.chrome), -0.018, -0.095, 0.345, 0, 0, Math.PI/2);
    put(hoodFace, new THREE.Mesh(new THREE.TorusGeometry(0.051, 0.006, 8, 20), M.chrome), -0.014, -0.095, 0.52, 0, -Math.PI/2, 0);
    put(hoodFace, new THREE.Mesh(new THREE.CircleGeometry(0.048, 18), new THREE.MeshBasicMaterial({ map: makeDialTex(1.8) })), -0.015, -0.095, 0.52, 0, -Math.PI/2, 0);

    // ========= كل أزرار ودراعات سطح الطاولة =========
    // 1. زرار الطوارئ + 3 لمبات البيان
    put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.056, 0.026, 16), M.yellow),  0.48, DESK_TOP+0.013, -1.14);
    const emBtn = put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.034, 0.032, 16), M.crimson), 0.48, DESK_TOP+0.040, -1.14);
    put(cabRoot, new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.026), new THREE.MeshBasicMaterial({ map: makeLabelTex('طوارئ') })), 0.39, DESK_TOP+0.004, -1.14, -Math.PI/2, 0, -Math.PI/2);

    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.18), M.rubber), 0.56, DESK_TOP+0.007, -0.92);
    [[-0.98, 0xfacc15], [-0.92, 0xef4444], [-0.86, 0xfacc15]].forEach(([lz, col]) => {
      put(cabRoot, new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), new THREE.MeshBasicMaterial({ color: col })), 0.56, DESK_TOP+0.020, lz);
    });

    // 2. العدادين المائلين الشمال بإطار كروم
    [-1.16, -1.01].forEach((gz, i) => {
      const pod = put(cabRoot, new THREE.Group(), 0.78, 0.89, gz, 0, 0, -0.58);
      put(pod, new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.08, 18), M.rubber), 0, 0, 0, 0, 0, Math.PI/2);
      put(pod, new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.006, 8, 20), M.chrome), -0.043, 0, 0, 0, -Math.PI/2, 0);
      put(pod, new THREE.Mesh(new THREE.CircleGeometry(0.056, 18), new THREE.MeshBasicMaterial({ map: makeDialTex(2.2 + i*0.8) })), -0.044, 0, 0, 0, -Math.PI/2, 0);
    });

    // 3. الدراع الأحمر الشمال + كاوتش القاعدة + مقياس 8 درجات
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.024, 0.08), M.rubber), 0.58, DESK_TOP+0.012, -0.66);
    put(cabRoot, new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.18), new THREE.MeshBasicMaterial({ map: makeScaleTex() })), 0.44, DESK_TOP+0.004, -0.66, -Math.PI/2, 0, -Math.PI/2);
    put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.036, 0.04, 12), M.rubber), 0.58, DESK_TOP+0.03, -0.66);
    const brakePivot = put(cabRoot, new THREE.Group(), 0.58, DESK_TOP+0.03, -0.66);
    put(brakePivot, new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 10), M.chrome), 0, 0.09, 0);
    put(brakePivot, new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.018, 0.09, 10), M.crimson), 0, 0.21, 0);

    // 4. الأزرار الثلاثة (أزرق / أصفر / أزرق) + تيكتاتها
    const deskBtns = {};
    [[-0.38, M.blue, 'كشاف'], [-0.23, M.yellow, 'سارينة'], [-0.08, M.blue, 'أبواب']].forEach(([bz, mat0, lbl]) => {
      const mat = mat0.clone();
      put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.016, 12), M.rubber), 0.49, DESK_TOP+0.008, bz);
      deskBtns[lbl] = put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.022, 0.026, 12), mat),      0.49, DESK_TOP+0.026, bz);
      put(cabRoot, new THREE.Mesh(new THREE.PlaneGeometry(0.065, 0.022), new THREE.MeshBasicMaterial({ map: makeLabelTex(lbl) })), 0.41, DESK_TOP+0.004, bz, -Math.PI/2, 0, -Math.PI/2);
    });

    // 5. دراع السرعة الرئيسي T-bar + المقياس المضيء 0-8
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.024, 0.09), M.rubber), 0.60, DESK_TOP+0.012, 0.14);
    put(cabRoot, new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.22), new THREE.MeshBasicMaterial({ map: makeScaleTex() })), 0.44, DESK_TOP+0.004, 0.14, -Math.PI/2, 0, -Math.PI/2);
    const throttlePivot = put(cabRoot, new THREE.Group(), 0.60, DESK_TOP+0.022, 0.14);
    put(throttlePivot, new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.03), M.chrome), 0, 0.08, 0);
    put(throttlePivot, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 12), M.rubber), 0, 0.16, 0, Math.PI/2, 0, 0);
    put(throttlePivot, new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.04, 12), M.crimson), 0, 0.16, -0.08, Math.PI/2, 0, 0);

    // 6. وحدة العكاس الكاملة (3 لمبات عمودية + زرارين مربعين + العكاس + 5 لمبات خلفية + 4 مفاتيح قلاب!)
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.022, 0.30), M.rubber), 0.62, DESK_TOP+0.011, 0.41);
    [[0.70, 0x22c55e], [0.64, 0xfacc15], [0.58, 0xef4444]].forEach(([lx, col]) => {
      put(cabRoot, new THREE.Mesh(new THREE.SphereGeometry(0.010, 8, 8), new THREE.MeshBasicMaterial({ color: col })), lx, DESK_TOP+0.024, 0.29);
    });
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.014, 0.032), M.green),   0.68, DESK_TOP+0.026, 0.36);
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.014, 0.032), M.crimson), 0.60, DESK_TOP+0.026, 0.36);
    const revPivot = put(cabRoot, new THREE.Group(), 0.68, DESK_TOP+0.022, 0.44);
    put(revPivot, new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.15, 8), M.chrome), 0, 0.075, 0);
    put(revPivot, new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 12), M.crimson), 0, 0.155, 0);
    [0.52, 0.57, 0.62, 0.67, 0.72].forEach((lx, i) => {
      const c = [0xef4444, 0x22c55e, 0xf8fafc, 0x94a3b8, 0x94a3b8][i];
      put(cabRoot, new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 8), new THREE.MeshBasicMaterial({ color: c })), lx, DESK_TOP+0.024, 0.52);
    });
    [[0.51, 0.34], [0.51, 0.40], [0.51, 0.47], [0.59, 0.51]].forEach(([tx, tz]) => {
      put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.035, 8), M.chrome), tx, DESK_TOP+0.036, tz, 0, 0, 0.2);
    });

    // 7. التليفون بسلكه الحلزوني + الأجندة
    const phoneGrp = put(cabRoot, new THREE.Group(), 0.88, 0.86, 0.78, 0, 0, -0.22);
    put(phoneGrp, new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.30), new THREE.MeshStandardMaterial({ map: makePhoneTex() })), 0, 0, 0);
    put(phoneGrp, new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.04, 0.055), M.rubber), -0.02, 0.05, -0.14);
    const cordPts = [];
    for (let i=0; i<=14; i++) cordPts.push(new THREE.Vector3(-0.08 - Math.sin(i*1.2)*0.02, 0.02 - i*0.004, -0.16 + i*0.008));
    put(phoneGrp, new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts), 16, 0.006, 6, false), M.rubber), 0, 0, 0);

    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.018, 0.18), M.white), 0.86, DESK_TOP+0.009, 1.14);
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.022, 0.09), M.chrome), 0.75, DESK_TOP+0.016, 1.14);

    // 8. كرسي السواق الكحلي الفخم
    const seat = put(cabRoot, new THREE.Group(), -0.22, 0.08, 0.44);
    put(seat, new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.30, 0.05, 18), M.hood), 0, 0.025, 0);
    put(seat, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 12), M.chrome), 0, 0.24, 0);
    put(seat, new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.11, 0.48), M.seat), 0, 0.46, 0);
    put(seat, new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.64, 0.46), M.seat), -0.20, 0.80, 0, 0, 0, 0.1);
    put(seat, new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.22, 0.28), M.seat), -0.24, 1.20, 0);
    [-0.26, 0.26].forEach(az => put(seat, new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.045, 0.055), M.hood), 0.02, 0.68, az));

    // ========= additions: real details the original did not have =========
    const FLOOR = 0.08;
    const steel = M.chrome, red = M.crimson;
    const stripeTex = (() => { const c = document.createElement('canvas'); c.width = 16; c.height = 256; const g = c.getContext('2d'); for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#101010' : '#f2c200'; g.fillRect(0, i * 16, 16, 16); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6); return t; })();
    { const hz = put(cabRoot, new THREE.Mesh(new THREE.PlaneGeometry(0.05, 2.6), new THREE.MeshBasicMaterial({ map: stripeTex })), 0.245, FLOOR + 0.002, 0, -Math.PI / 2, 0, 0); hz.rotation.x = -Math.PI / 2; }   // hazard strip along the desk
    // dead-man pedal on the floor under the console (right foot)
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.26), M.rubber), 0.50, FLOOR + 0.02, 0.30, 0, 0, -0.18);
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.2), M.chrome), 0.50, FLOOR + 0.042, 0.30, 0, 0, -0.18);
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.012, 0.34), M.rubber), 0.30, FLOOR + 0.008, -0.20);      // rubber foot mat
    // dome light fixture and a grab rail along the ceiling
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.035, 0.18), new THREE.MeshBasicMaterial({ color: 0xfff6e0 })), 0, 2.225, 0);
    put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.5, 10), M.chrome), -0.62, 2.14, 0, Math.PI / 2, 0, 0);
    [-1.1, 1.1].forEach(bz => put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.09, 0.025), M.chrome), -0.62, 2.18, bz));
    // back wall: door to the engine room (handle + small window), fire extinguisher, first-aid box, flag and ENR plates
    put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 10), M.chrome), -1.17, 1.0, 0.24, Math.PI / 2, 0, 0);
    put(cabRoot, new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.30), M.glass), -1.198, 1.55, 0, 0, Math.PI / 2, 0);
    put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.32, 0.28), M.rubber), -1.201, 1.55, 0);
    put(cabRoot, new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.28), M.glass), -1.188, 1.55, 0, 0, Math.PI / 2, 0);
    { const fe = put(cabRoot, new THREE.Group(), -1.17, 0.62, 1.12);
      put(fe, new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.38, 16), red), 0, 0, 0);
      put(fe, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.06, 10), M.chrome), 0, 0.22, 0);
      put(fe, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.05), M.rubber), 0, 0.27, 0.0);
      put(fe, new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 16), M.chrome), 0, 0.10, 0, Math.PI / 2, 0, 0);
      put(fe, new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 16), M.chrome), 0, -0.10, 0, Math.PI / 2, 0, 0);
      put(fe, new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.1), new THREE.MeshBasicMaterial({ map: makeLabelTex('طفاية') })), 0.062, 0.0, 0, 0, Math.PI / 2, 0); }
    { const fa = put(cabRoot, new THREE.Group(), -1.205, 1.28, 0.92);
      put(fa, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.3), M.white), 0, 0, 0);
      put(fa, new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.03), M.green), 0.028, 0, 0);
      put(fa, new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.1), M.green), 0.028, 0, 0);
      put(fa, new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.04), new THREE.MeshBasicMaterial({ map: makeLabelTex('إسعافات') })), 0.03, -0.075, 0, 0, Math.PI / 2, 0); }
    const flagTex = (() => { const c = document.createElement('canvas'); c.width = 192; c.height = 128; const g = c.getContext('2d');
      g.fillStyle = '#ce1126'; g.fillRect(0, 0, 192, 43); g.fillStyle = '#ffffff'; g.fillRect(0, 43, 192, 42); g.fillStyle = '#000000'; g.fillRect(0, 85, 192, 43);
      g.fillStyle = '#c09300'; g.beginPath(); g.ellipse(96, 64, 14, 17, 0, 0, 7); g.fill(); g.fillRect(86, 76, 20, 6); g.fillRect(78, 58, 8, 14); g.fillRect(106, 58, 8, 14);
      return new THREE.CanvasTexture(c); })();
    put(cabRoot, new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.20), new THREE.MeshBasicMaterial({ map: flagTex })), -1.236, 1.92, 0.82, 0, Math.PI / 2, 0);
    put(cabRoot, new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.075), new THREE.MeshBasicMaterial({ map: makeSignTex('السكك الحديدية المصرية') })), -1.236, 1.74, 0.82, 0, Math.PI / 2, 0);
    // side doors: seals, handles and a window sill grab-bar on both sides
    [-1, 1].forEach(sd => {
      const wz = sd < 0 ? -1.335 : 1.335;
      [-1.2, -0.52].forEach(sx => put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.014, 2.0, 0.008), M.rubber), sx, 1.18, wz));
      put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.68), M.rubber), -0.86, 2.17, wz);
      put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.20, 8), M.chrome), -0.60, 1.14, wz - sd * 0.03, 0, 0, 0);
      put(cabRoot, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.05), M.chrome), -0.60, 1.14, wz - sd * 0.015);
      put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.7, 8), M.chrome), -0.86, 1.0, wz - sd * 0.05, Math.PI / 2, 0, Math.PI / 2);
    });
    // cab radio handset on a hook (right wall) with its coiled cord, and a speaker grille on the front pillar
    { const rh = put(cabRoot, new THREE.Group(), -0.98, 1.28, 1.30);
      put(rh, new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.04), M.hood), 0, 0, 0);
      put(rh, new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 10), M.rubber), 0, -0.02, -0.04);
      put(rh, new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), M.rubber), 0, 0.09, -0.04);
      put(rh, new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), M.rubber), 0, -0.13, -0.04); }
    // a glass of tea (very Egyptian) on a saucer next to the phone
    put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.008, 18), M.white), 0.52, DESK_TOP + 0.004, 1.02);
    put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.075, 16), new THREE.MeshStandardMaterial({ color: 0xb2561a, transparent: true, opacity: 0.85, roughness: 0.1 })), 0.52, DESK_TOP + 0.045, 1.02);
    put(cabRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.1, 6), M.chrome), 0.535, DESK_TOP + 0.07, 1.02, 0, 0, 0.3);

    // ========= game hook-up =========
    const hits = [];
    const hit = (m, act) => { m.userData.act = act; hits.push(m); };
    const big = (parent, x, y, z, r, act) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); put(parent, m, x, y, z); hit(m, act); };
    throttlePivot.traverse(o => { if (o.isMesh) hit(o, 'throttle'); }); big(throttlePivot, 0, 0.12, 0, 0.12, 'throttle');
    brakePivot.traverse(o => { if (o.isMesh) hit(o, 'brake'); }); big(brakePivot, 0, 0.12, 0, 0.12, 'brake');
    const horn = deskBtns['سارينة'], door = deskBtns['أبواب'], lite = deskBtns['كشاف'];
    hit(horn, 'horn'); big(cabRoot, horn.position.x, horn.position.y, horn.position.z, 0.07, 'horn');
    hit(door, 'door'); big(cabRoot, door.position.x, door.position.y, door.position.z, 0.07, 'door');
    hit(lite, 'light'); big(cabRoot, lite.position.x, lite.position.y, lite.position.z, 0.07, 'light');
    hit(emBtn, 'emerg'); big(cabRoot, emBtn.position.x, emBtn.position.y, emBtn.position.z, 0.09, 'emerg');
    const y0 = { horn: horn.position.y, door: door.position.y, lite: lite.position.y, em: emBtn.position.y };
    lite.material.emissive = new THREE.Color(0x2563eb); door.material.emissive = new THREE.Color(0x2563eb); horn.material.emissive = new THREE.Color(0xfacc15); emBtn.material.emissive = new THREE.Color(0xb91c1c);

    // live displays (same layout/colours as his, filled with the real run data)
    const rr = (ctx, x, y, w, h) => { ctx.fillRect(x, y, w, h); };
    function drawEM2(i, max) {
      const ctx = emCanvas.getContext('2d'); ctx.textAlign = 'left';
      ctx.fillStyle = '#050f1d'; ctx.fillRect(0, 0, 512, 256); ctx.fillStyle = '#102e52'; ctx.fillRect(0, 0, 512, 34);
      ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 17px Tahoma'; ctx.fillText('ENR  •  ' + (i.name || ''), 18, 23);
      [[18, 48, 145, 76], [180, 48, 145, 76], [342, 48, 150, 76], [18, 136, 145, 76], [180, 136, 145, 76]].forEach(b => { ctx.fillStyle = '#0c1f36'; ctx.fillRect(...b); ctx.strokeStyle = '#255082'; ctx.strokeRect(...b); });
      const n = i.notch | 0;
      ctx.fillStyle = '#7fe0ff'; ctx.font = 'bold 38px Arial'; ctx.fillText(String(Math.round(i.kmh)), 30, 96); ctx.fillStyle = '#94a3b8'; ctx.font = '14px Arial'; ctx.fillText('km/h', 30, 116);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px Arial'; ctx.fillText('A ' + (n ? 420 + n * 65 : 0), 196, 96); ctx.fillText('rpm ' + (650 + n * 85), 352, 96);
      ctx.fillStyle = i.limit < i.kmh - 2 ? '#ef4444' : '#22c55e'; ctx.font = 'bold 30px Arial'; ctx.fillText(String(i.limit), 56, 184); ctx.fillStyle = '#94a3b8'; ctx.font = '14px Arial'; ctx.fillText('limit', 30, 204);
      ctx.fillStyle = '#f0c040'; ctx.font = 'bold 20px Tahoma'; ctx.fillText(String(i.dist || ''), 196, 182);
      ctx.fillStyle = '#94a3b8'; ctx.font = '15px Arial'; ctx.fillText('N' + n, 352, 184);
      ['الرئيسية', 'الأعطال', 'الموتور', 'الجر', 'الفرامل'].forEach((t, k) => { ctx.fillStyle = '#1a3352'; ctx.fillRect(18 + k * 96, 224, 88, 22); ctx.fillStyle = '#cbd5e1'; ctx.font = '12px Tahoma'; ctx.fillText(t, 34 + k * 96, 239); });
      emTex.needsUpdate = true;
    }
    function drawSpeedo2(kmh, max) {
      const ctx = spCanvas.getContext('2d'); ctx.textAlign = 'center';
      ctx.fillStyle = '#0b1220'; ctx.beginPath(); ctx.arc(128, 128, 122, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#d0d8e4'; ctx.lineWidth = 6; ctx.stroke();
      const step = max > 200 ? 20 : 10, nn = Math.round(max / step);
      for (let k = 0; k <= nn; k++) { const a = Math.PI * 0.75 + (k / nn) * Math.PI * 1.5; ctx.strokeStyle = k >= nn - 1 ? '#ef4444' : '#e2e8f0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); ctx.lineTo(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108); ctx.stroke();
        if (k % 2 === 0) { ctx.fillStyle = '#cbd5e1'; ctx.font = 'bold 14px Arial'; ctx.fillText(String(k * step), 128 + Math.cos(a) * 76, 133 + Math.sin(a) * 76); } }
      ctx.fillStyle = '#facc15'; ctx.font = 'bold 14px Arial'; ctx.fillText('EMD • ENR', 128, 200); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px Arial'; ctx.fillText(String(Math.round(kmh)), 128, 174);
      const ang = Math.PI * 0.75 + Math.min(1, kmh / max) * Math.PI * 1.5; ctx.strokeStyle = '#f97316'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(ang) * 82, 128 + Math.sin(ang) * 82); ctx.stroke();
      spTex.needsUpdate = true;
    }
    function drawAtc2(limit, max) {
      const ctx = atcCanvas.getContext('2d'); ctx.textAlign = 'center'; ctx.fillStyle = '#0a1424'; ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(64, 68, 38, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
      ctx.strokeStyle = '#facc15'; ctx.beginPath(); ctx.arc(64, 68, 38, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * Math.min(1, limit / max))); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px Arial'; ctx.fillText(String(limit), 64, 78); atcTex.needsUpdate = true;
    }
    function drawAir2(brake) {
      const t = airTex, ctx = t.image.getContext('2d'); ctx.textAlign = 'left'; ctx.fillStyle = '#050f1d'; ctx.fillRect(0, 0, 512, 256); ctx.fillStyle = '#102e52'; ctx.fillRect(0, 0, 512, 34);
      ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 17px Tahoma'; ctx.fillText('الهواء والفرامل', 18, 23);
      const bc = 5 * brake;
      [['bar 9.4', 320, '#38bdf8', 62], ['bar ' + (5 - 1.4 * brake).toFixed(1), 220 - 30 * brake, '#f8fafc', 110], ['bar ' + (5 - 1.4 * brake).toFixed(1), 220 - 30 * brake, '#f8fafc', 158], ['bar ' + bc.toFixed(1), 12 + 70 * brake, brake > 0.1 ? '#f59e0b' : '#22c55e', 206]].forEach(([lbl, w, col, y]) => {
        ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 18px Arial'; ctx.fillText(lbl, 18, y + 18); ctx.fillStyle = '#1e293b'; ctx.fillRect(110, y, 370, 22); ctx.fillStyle = col; ctx.fillRect(110, y, w, 22); });
      t.needsUpdate = true;
    }
    drawEM(0); drawSpeedo(0); drawAtc(0); if (airTex) drawAir2(0);

    // convert his colours/textures to the game's sRGB pipeline and give the interior a gentle self-light so it never goes black at night
    const seen = new Set();
    cabRoot.traverse(o => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => {
      if (seen.has(m)) return; seen.add(m);
      if (m.color) m.color.convertSRGBToLinear();
      if (m.map) { m.map.encoding = THREE.sRGBEncoding; m.map.anisotropy = 4; m.map.needsUpdate = true; }
      if (m.emissive && m.emissive.getHex() !== 0) m.emissive.convertSRGBToLinear();
      else if (m.isMeshStandardMaterial && !m.transparent) { m.emissive = m.color.clone().multiplyScalar(0.22); if (m.map) m.emissiveMap = m.map; }
      if (m.transparent) m.depthWrite = false;
      m.needsUpdate = true; }); });

    // mount: his x (forward) -> cab z, his z (across) -> cab -x, scaled up from his seated-desk size to the cab's size
    const mount = new THREE.Group(); mount.rotation.y = -Math.PI / 2; mount.scale.set(1.25, 1.25, 1.12); mount.position.set(0, 1.05, 5.475); mount.add(cabRoot);

    let t0 = performance.now(), key = '';
    function update(i, max) {
      const now = performance.now(), dt = Math.min(0.1, (now - t0) / 1000); t0 = now; max = max || 160;
      fanBlades.rotation.y += dt * 12;
      throttlePivot.rotation.z = 0.38 - (i.notch / 8) * 0.78; brakePivot.rotation.z = 0.38 - i.brake * 0.78; revPivot.rotation.z = -0.32;
      horn.position.y = y0.horn - (i.horn ? 0.014 : 0); emBtn.position.y = y0.em - (i.emerg ? 0.016 : 0); door.position.y = y0.door - (i.doors > 0.5 ? 0.012 : 0);
      lite.material.emissiveIntensity = i.lights ? 1.0 : 0.15; door.material.emissiveIntensity = i.doors > 0.5 ? 1.0 : 0.15; horn.material.emissiveIntensity = i.horn ? 1.0 : 0.15;
      if (i.wipers) { const sw = Math.sin(now / 250) * 0.5; wiperPivots[0].rotation.z = 0.35 + sw; wiperPivots[1].rotation.z = -0.35 + sw; }
      const k = Math.round(i.kmh) + '|' + i.limit + '|' + (i.dist || '') + '|' + (i.name || '') + '|' + (i.notch | 0) + '|' + Math.round(i.brake * 20);
      if (k === key) return; key = k;
      drawEM2(i, max); drawSpeedo2(i.kmh, max); drawAtc2(i.limit, max); if (airTex) drawAir2(i.brake);
    }
    return { mount, hits, update };
  }
  return { build };
})();
