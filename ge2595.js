/* Egyptian GE "General" 2595 locomotive, built in code (author's own model). Long axis is X in the source; build() returns it rotated so the front points to +z. */
const Ge2595 = (() => {
  let cache = null;
  function make() {
        function add(parent, mesh, x, y, z, rx = 0, ry = 0, rz = 0) {
          mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); parent.add(mesh); return mesh;
        }

        const M = {
          black: new THREE.MeshStandardMaterial({ color: 0x151921, metalness: 0.45, roughness: 0.55 }),
          navyDark: new THREE.MeshStandardMaterial({ color: 0x0d1522, metalness: 0.35, roughness: 0.38 }),
          iron: new THREE.MeshStandardMaterial({ color: 0x262d38, metalness: 0.65, roughness: 0.48 }),
          steel: new THREE.MeshStandardMaterial({ color: 0xb0bac8, metalness: 0.92, roughness: 0.18 }),
          brass: new THREE.MeshStandardMaterial({ color: 0xd4a038, metalness: 0.88, roughness: 0.22 }),
          red: new THREE.MeshStandardMaterial({ color: 0xd9121a, metalness: 0.18, roughness: 0.28 }),
          silver: new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 0.35, roughness: 0.30 }),
          glass: new THREE.MeshStandardMaterial({ color: 0x091422, metalness: 0.95, roughness: 0.06, transparent: true, opacity: 0.85 }),
          lampW: new THREE.MeshBasicMaterial({ color: 0xfffbeb }),
          lampA: new THREE.MeshBasicMaterial({ color: 0xf97316 }),
          lampR: new THREE.MeshBasicMaterial({ color: 0xef4444 })
        };

        function createDiamondPlateTex() {
          const c = document.createElement('canvas'); c.width=128; c.height=128;
          const ctx = c.getContext('2d'); ctx.fillStyle='#2b313a'; ctx.fillRect(0,0,128,128);
          ctx.fillStyle='#64748b';
          for (let y=8; y<128; y+=16) for (let x=8; x<128; x+=16) {
            ctx.fillRect(x, y, 6, 2); ctx.fillRect(x+8, y+8, 2, 6);
          }
          const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); return t;
        }

        function createLedDotTex(bgCol, dotCol) {
          const c = document.createElement('canvas'); c.width = 128; c.height = 128;
          const ctx = c.getContext('2d'); ctx.fillStyle = bgCol; ctx.fillRect(0,0,128,128); ctx.fillStyle = dotCol;
          for (let y=26; y<=102; y+=19) for (let x=26; x<=102; x+=19) {
            if (Math.hypot(x-64, y-64) < 46) { ctx.beginPath(); ctx.arc(x,y,5.5,0,Math.PI*2); ctx.fill(); }
          }
          return new THREE.CanvasTexture(c);
        }

        function createChevronTex() {
          const c = document.createElement('canvas'); c.width = 512; c.height = 64;
          const ctx = c.getContext('2d'); ctx.fillStyle = '#eab308'; ctx.fillRect(0,0,512,64); ctx.fillStyle = '#111827';
          for (let i=-32; i<256; i+=38) { ctx.beginPath(); ctx.moveTo(i,64); ctx.lineTo(i+19,64); ctx.lineTo(i+44,0); ctx.lineTo(i+25,0); ctx.closePath(); ctx.fill(); }
          for (let i=256; i<544; i+=38) { ctx.beginPath(); ctx.moveTo(i,64); ctx.lineTo(i+19,64); ctx.lineTo(i-6,0); ctx.lineTo(i-25,0); ctx.closePath(); ctx.fill(); }
          return new THREE.CanvasTexture(c);
        }

        function heightToNormal(heightCanvas, strength = 2.6) {
          const w = heightCanvas.width, h = heightCanvas.height;
          const src = heightCanvas.getContext('2d').getImageData(0,0,w,h).data;
          const outC = document.createElement('canvas'); outC.width = w; outC.height = h;
          const oCtx = outC.getContext('2d'), img = oCtx.createImageData(w,h), dst = img.data;
          const smp = (x,y) => src[(Math.max(0,Math.min(h-1,y))*w + Math.max(0,Math.min(w-1,x)))*4]/255;
          for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
            const tl=smp(x-1,y-1), t=smp(x,y-1), tr=smp(x+1,y-1), l=smp(x-1,y), r=smp(x+1,y), bl=smp(x-1,y+1), b=smp(x,y+1), br=smp(x+1,y+1);
            const dx=(tr+2*r+br)-(tl+2*l+bl), dy=(bl+2*b+br)-(tl+2*t+tr);
            let nx=-dx*strength, ny=dy*strength, nz=1.0, len=Math.hypot(nx,ny,nz);
            const i=(y*w+x)*4;
            dst[i]=Math.round((nx/len*0.5+0.5)*255); dst[i+1]=Math.round((ny/len*0.5+0.5)*255); dst[i+2]=Math.round((nz/len*0.5+0.5)*255); dst[i+3]=255;
          }
          oCtx.putImageData(img,0,0); const tex=new THREE.CanvasTexture(outC); tex.anisotropy=8; return tex;
        }

        function create2595SidePBR() {
          const w=2048, h=512;
          const cA=document.createElement('canvas'); cA.width=w; cA.height=h;
          const cH=document.createElement('canvas'); cH.width=w; cH.height=h;
          const cR=document.createElement('canvas'); cR.width=w; cR.height=h;
          const ctxA=cA.getContext('2d'), ctxH=cH.getContext('2d'), ctxR=cR.getContext('2d');

          ctxA.fillStyle='#d5dae0'; ctxA.fillRect(0,0,w,h);
          ctxH.fillStyle='#808080'; ctxH.fillRect(0,0,w,h);
          ctxR.fillStyle='#505050'; ctxR.fillRect(0,0,w,h);

          ctxA.fillStyle='#d9121a'; ctxA.fillRect(0,0,w,52);
          ctxA.beginPath(); ctxA.moveTo(0,0); ctxA.lineTo(310,0); ctxA.lineTo(185,220); ctxA.lineTo(0,220); ctxA.closePath(); ctxA.fill();
          ctxA.beginPath(); ctxA.moveTo(w,0); ctxA.lineTo(w-310,0); ctxA.lineTo(w-185,220); ctxA.lineTo(w,220); ctxA.closePath(); ctxA.fill();
          ctxA.fillRect(0,415,w,97);
          ctxA.beginPath(); ctxA.moveTo(0,330); ctxA.lineTo(240,330); ctxA.lineTo(360,415); ctxA.lineTo(0,415); ctxA.closePath(); ctxA.fill();
          ctxA.beginPath(); ctxA.moveTo(w,330); ctxA.lineTo(w-240,330); ctxA.lineTo(w-360,415); ctxA.lineTo(w,415); ctxA.closePath(); ctxA.fill();

          // أثر عوادم خفيف واقعي قرب السقف والرادياتير
          const soot = ctxA.createRadialGradient(980, 10, 20, 980, 40, 260);
          soot.addColorStop(0, 'rgba(15,15,18,0.35)'); soot.addColorStop(1, 'rgba(15,15,18,0)');
          ctxA.fillStyle = soot; ctxA.fillRect(680, 0, 600, 260);

          const drawWin = (wx, flip) => {
            ctxA.fillStyle='#0f172a'; ctxA.strokeStyle='#e5e7eb'; ctxA.lineWidth=7;
            ctxA.beginPath();
            if (!flip) { ctxA.moveTo(wx,65); ctxA.lineTo(wx+132,65); ctxA.lineTo(wx+132,196); ctxA.lineTo(wx-24,196); }
            else       { ctxA.moveTo(wx,65); ctxA.lineTo(wx-132,65); ctxA.lineTo(wx-132,196); ctxA.lineTo(wx+24,196); }
            ctxA.closePath(); ctxA.fill(); ctxA.stroke();
            ctxA.fillStyle='#e5e7eb'; ctxA.fillRect(flip?wx-80:wx+76, 65, 6, 131);
            ctxR.fillStyle='#141414'; ctxR.fillRect(flip?wx-132:wx-24, 65, 156, 131);
          };
          drawWin(72, false); drawWin(w-72, true);

          [255, w-315].forEach(lx => {
            ctxA.fillStyle='#6b1414'; ctxA.fillRect(lx,250,58,165); ctxH.fillStyle='#202020'; ctxH.fillRect(lx,250,58,165);
            for (let sy=270; sy<405; sy+=34) { ctxA.fillStyle='#e5e7eb'; ctxA.fillRect(lx+8,sy,42,7); ctxH.fillStyle='#d0d0d0'; ctxH.fillRect(lx+8,sy,42,7); }
          });

          const louver = (x,y,lw,lh) => {
            ctxA.fillStyle='#14181f'; ctxA.fillRect(x,y,lw,lh);
            ctxH.fillStyle='#202020'; ctxH.fillRect(x,y,lw,lh);
            ctxR.fillStyle='#e0e0e0'; ctxR.fillRect(x,y,lw,lh);
            for (let ly=y+6; ly<y+lh-4; ly+=8) { ctxA.fillStyle='#2d3542'; ctxA.fillRect(x+4,ly,lw-8,3); ctxH.fillStyle='#c8c8c8'; ctxH.fillRect(x+4,ly,lw-8,3); }
          };
          louver(355,60,165,98); louver(w-520,60,165,98);
          [605,695,785,875].forEach(x => louver(x,60,62,54));
          louver(1415,118,185,294);

          for (let x=330; x<1410; x+=155) {
            ctxA.strokeStyle='rgba(0,0,0,0.3)'; ctxA.lineWidth=2; ctxA.strokeRect(x,128,138,285);
            ctxH.strokeStyle='#303030'; ctxH.lineWidth=4; ctxH.strokeRect(x,128,138,285);
            ctxH.fillStyle='#d8d8d8'; ctxH.fillRect(x+118,255,8,26); ctxA.fillStyle='#475569'; ctxA.fillRect(x+118,255,8,26);
          }

          const drawFlag = (fx, fy) => {
            ctxA.fillStyle='#ce1126'; ctxA.fillRect(fx,fy,64,14); ctxA.fillStyle='#ffffff'; ctxA.fillRect(fx,fy+14,64,14); ctxA.fillStyle='#000000'; ctxA.fillRect(fx,fy+28,64,14);
          };
          drawFlag(128,226); drawFlag(w-192,226);
          ctxA.fillStyle='#1e293b'; ctxA.textAlign='center'; ctxA.font='bold 42px Tahoma';
          ctxA.fillText('٢٥٩٥', 160, 315); ctxA.fillText('٢٥٩٥', w-160, 315);
          ctxA.font='bold 46px Tahoma'; ctxA.fillText('١', 265, 225); ctxA.fillText('٢', w-265, 225);
          ctxA.strokeStyle='#c8102e'; ctxA.lineWidth=6; ctxA.beginPath(); ctxA.arc(1020,295,38,0,Math.PI*2); ctxA.stroke();
          ctxA.fillStyle='#c8102e'; ctxA.font='bold 24px Arial'; ctxA.fillText('ENR', 1020, 303);

          const map=new THREE.CanvasTexture(cA); map.anisotropy=8;
          return { map, normalMap: heightToNormal(cH, 2.5), roughnessMap: new THREE.CanvasTexture(cR) };
        }

        function createNoseTex() {
          const c=document.createElement('canvas'); c.width=512; c.height=512;
          const ctx=c.getContext('2d'); ctx.fillStyle='#d9121a'; ctx.fillRect(0,0,512,512);
          ctx.fillStyle='#d8dde3';
          ctx.beginPath(); ctx.moveTo(0,178); ctx.quadraticCurveTo(256,224,512,178);
          ctx.lineTo(512,336); ctx.quadraticCurveTo(256,382,0,336); ctx.closePath(); ctx.fill();
          ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=3;
          ctx.beginPath(); ctx.moveTo(96,0); ctx.lineTo(96,512); ctx.moveTo(416,0); ctx.lineTo(416,512); ctx.stroke();
          ctx.fillStyle='#f1f5f9'; ctx.font='bold 16px Arial'; ctx.textAlign='center';
          ctx.fillText('EGYPTIAN NATIONAL RAILWAYS', 256, 170);
          return new THREE.CanvasTexture(c);
        }

        const locoRoot = new THREE.Group(); locoRoot.name = 'ENR_General_2595_Ultra';
        const wheelsList = [], fansList = [];

        function createBogie3(posX) {
          const bogie = add(locoRoot, new THREE.Group(), posX, 0, 0);
          [-1.08, 1.08].forEach(z => {
            add(bogie, new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.36, 0.22), M.iron), 0, 0.62, z);
            add(bogie, new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 0.18), M.iron), 0, 0.40, z);
            add(bogie, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 10), M.black), 0, 0.86, z+(z>0?0.12:-0.12), 0, 0, Math.PI/3);
          });
          [-1.78, 0, 1.78].forEach(ax => {
            add(bogie, new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 1.72, 12), M.black), ax, 0.52, 0, Math.PI/2, 0, 0);
            add(bogie, new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.44, 0.88), M.iron), ax+(ax>=0?-0.22:0.22), 0.54, 0);
            [-0.74, 0.74].forEach(wz => {
              const wg = add(bogie, new THREE.Group(), ax, 0.52, wz);
              add(wg, new THREE.Mesh(new THREE.CylinderGeometry(0.485, 0.485, 0.135, 28), M.steel), 0, 0, 0, Math.PI/2, 0, 0);
              add(wg, new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.49, 0.032, 28), M.steel), 0, 0, wz>0?-0.065:0.065, Math.PI/2, 0, 0);
              add(wg, new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 14), M.black), 0, 0, 0, Math.PI/2, 0, 0);
              wheelsList.push(wg);
              add(bogie, new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.13), M.black), ax+0.49, 0.55, wz);
            });
            [-1.08, 1.08].forEach(sz => {
              add(bogie, new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.30, 0.28), M.black), ax, 0.52, sz);
              [-0.22, 0.22].forEach(cx => add(bogie, new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.28, 10), M.steel), ax+cx, 0.80, sz));
            });
          });
          return bogie;
        }

        add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(20.6, 0.30, 2.94), M.black), 0, 0.96, 0);
        add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.62, 2.15), M.black), 0, 0.52, 0);
        [-1.18, 1.18].forEach(z => {
          add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.48, 0.22), M.iron), -1.7, 0.62, z);
          add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 2.9, 14), M.steel), 1.1, 0.68, z, 0, 0, Math.PI/2);
        });
        createBogie3(5.8); createBogie3(-5.8);

        const hullShape = new THREE.Shape();
        hullShape.moveTo(-1.47, 1.02); hullShape.lineTo(1.47, 1.02); hullShape.lineTo(1.47, 3.88);
        hullShape.quadraticCurveTo(1.38, 4.18, 0.95, 4.24);
        hullShape.quadraticCurveTo(0.00, 4.34, -0.95, 4.24);
        hullShape.quadraticCurveTo(-1.38, 4.18, -1.47, 3.88); hullShape.closePath();
        const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 16.0, bevelEnabled: false, curveSegments: 8 });
        hullGeo.rotateY(Math.PI/2); hullGeo.translate(-8.0, 0, 0);
        locoRoot.add(new THREE.Mesh(hullGeo, M.red));

        const sidePBR = create2595SidePBR();
        const sideMat = new THREE.MeshStandardMaterial({ map: sidePBR.map, normalMap: sidePBR.normalMap, roughnessMap: sidePBR.roughnessMap, metalness: 0.22, roughness: 0.55 });
        [-1.475, 1.475].forEach((z, i) => add(locoRoot, new THREE.Mesh(new THREE.PlaneGeometry(16.0, 2.86), sideMat), 0, 2.45, z, 0, i===0?Math.PI:0, 0));

        // أجنحة الرادياتير البارزة + المراوح + المدخنة + التكييف + 3 أبواق
        add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.44, 3.16), M.red), -3.8, 3.92, 0);
        [-4.8, -2.8].forEach(fx => {
          add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.76, 0.14, 20), M.black), fx, 4.30, 0);
          add(locoRoot, new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.035, 8, 20), M.steel), fx, 4.38, 0, Math.PI/2, 0, 0);
          const bg = add(locoRoot, new THREE.Group(), fx, 4.34, 0);
          for (let b=0; b<3; b++) add(bg, new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.025, 0.15), M.steel), 0, 0, 0, 0, (b*Math.PI)/3, 0);
          fansList.push(bg);
        });
        add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.65), M.black), 0.6, 4.34, 0);
        [-6.7, 6.7].forEach(ax => {
          add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.20, 1.24), M.silver), ax, 4.34, 0);
          const hc = add(locoRoot, new THREE.Group(), ax>0?5.4:-5.4, 4.35, 0);
          [-0.14, 0, 0.14].forEach((hz, idx) => add(hc, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 0.34+idx*0.08, 10), M.brass), 0, 0, hz, 0, 0, ax>0?-Math.PI/2:Math.PI/2));
        });

        // مجسمات 3D بارزة للشبكات الجانبية الكبيرة على الجنبين
        [-1.48, 1.48].forEach(z => {
          add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.65, 0.04), M.black), -3.8, 2.35, z);
        });

        function createArchedCab(dir) {
          const ringSpec = [
            { y: 1.02, xF: 10.28, xB: 8.00, zW: 1.47, ch: 0.28, bow: 0.06, crown: 0.00 },
            { y: 2.48, xF: 10.20, xB: 8.00, zW: 1.47, ch: 0.28, bow: 0.06, crown: 0.00 },
            { y: 3.92, xF: 9.64,  xB: 8.00, zW: 1.45, ch: 0.30, bow: 0.05, crown: 0.00 },
            { y: 4.24, xF: 9.42,  xB: 8.00, zW: 1.15, ch: 0.20, bow: 0.04, crown: 0.08 }
          ];
          const makeRing = (r) => {
            const zC = r.zW - r.ch;
            return [
              [dir*(r.xF+r.bow*0.3), r.y+r.crown*0.5, +zC], [dir*(r.xF+r.bow), r.y+r.crown, 0], [dir*(r.xF+r.bow*0.3), r.y+r.crown*0.5, -zC],
              [dir*(r.xF-r.ch), r.y, -r.zW], [dir*r.xB, r.y, -r.zW], [dir*r.xB, r.y, +r.zW], [dir*(r.xF-r.ch), r.y, +r.zW]
            ];
          };
          const rings = ringSpec.map(makeRing), pos=[], uvs=[];
          const pushTri = (a,b,c) => { if(dir===1) pos.push(...a,...b,...c); else pos.push(...a,...c,...b); uvs.push(0,0,1,0,1,1); };
          const addQuad = (a,b,c,d) => { pushTri(a,b,c); pushTri(a,c,d); };
          for (let r=0; r<rings.length-1; r++) for (let k=0; k<7; k++) addQuad(rings[r][k], rings[r][(k+1)%7], rings[r+1][(k+1)%7], rings[r+1][k]);
          const top=rings[rings.length-1], bot=rings[0];
          for (let i=1; i<6; i++) pushTri(top[0], top[i], top[i+1]);
          for (let i=1; i<6; i++) pushTri(bot[0], bot[i+1], bot[i]);
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
          geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
          geo.computeVertexNormals(); return geo;
        }

        const noseMat = new THREE.MeshStandardMaterial({ map: createNoseTex(), roughness: 0.30, metalness: 0.18 });
        const chevronMat = new THREE.MeshStandardMaterial({ map: createChevronTex(), roughness: 0.5 });
        const diamondMat = new THREE.MeshStandardMaterial({ map: createDiamondPlateTex(), metalness: 0.7, roughness: 0.4 });
        const ledWhiteMat = new THREE.MeshBasicMaterial({ map: createLedDotTex('#e2e8f0', '#fffbeb') });
        const ledAmberMat = new THREE.MeshBasicMaterial({ map: createLedDotTex('#7c2d12', '#fb923c') });
        const winTilt = Math.atan2(0.56, 1.44);

        [1, -1].forEach(dir => {
          locoRoot.add(new THREE.Mesh(createArchedCab(dir), M.red));
          const nf = add(locoRoot, new THREE.Mesh(new THREE.PlaneGeometry(2.34, 1.42), noseMat), dir*10.285, 1.75, 0);
          nf.rotation.order='YXZ'; nf.rotation.y=dir===1?Math.PI/2:-Math.PI/2; nf.rotation.x=-0.055;

          for (let r=0; r<3; r++) for (let col=-1; col<=1; col++) add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.036, 0.24), M.iron), dir*10.30, 1.56+r*0.11, col*0.34);
          [-0.86, 0.86].forEach(sz => add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.16), M.red), dir*10.29, 1.24, sz));

          const visor = add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(2.36, 1.62, 0.05), M.navyDark), dir*9.95, 3.24, 0);
          visor.rotation.order='YXZ'; visor.rotation.y=dir===1?Math.PI/2:-Math.PI/2; visor.rotation.x=-winTilt;

          add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.44), M.silver), dir*9.56, 4.10, 0);
          [-0.10, 0.10].forEach(lz => add(locoRoot, new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), ledWhiteMat), dir*9.65, 4.10, lz, 0, dir===1?Math.PI/2:-Math.PI/2, 0));

          [-0.52, 0.52].forEach(wz => {
            const glass = add(locoRoot, new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.06), M.glass), dir*9.98, 3.20, wz);
            glass.rotation.order='YXZ'; glass.rotation.y=dir===1?Math.PI/2:-Math.PI/2; glass.rotation.x=-winTilt;

            for (let b=-0.40; b<=0.40; b+=0.088) {
              const bar = add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1.04, 6), M.black), dir*10.00, 3.20, wz+b);
              bar.rotation.order='YXZ'; bar.rotation.y=dir===1?Math.PI/2:-Math.PI/2; bar.rotation.x=-winTilt;
            }

            const wiper = add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.64, 0.025), M.black), dir*9.99, 3.44, wz+(wz>0?-0.08:0.08));
            wiper.rotation.order='YXZ'; wiper.rotation.y=dir===1?Math.PI/2:-Math.PI/2; wiper.rotation.x=-winTilt; wiper.rotation.z=wz>0?0.35:-0.35;

            add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.56, 8), M.steel), dir*10.26, 2.52, wz, Math.PI/2, 0, 0);
          });

          [-0.92, 0.92].forEach(lz => {
            add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.06, 16), M.silver), dir*10.27, 2.34, lz, 0, 0, Math.PI/2);
            add(locoRoot, new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), dir===1?ledAmberMat:M.lampR), dir*10.305, 2.34, lz, 0, dir===1?Math.PI/2:-Math.PI/2, 0);
            add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 16), M.silver), dir*10.27, 2.16, lz+(lz>0?-0.13:0.13), 0, 0, Math.PI/2);
            add(locoRoot, new THREE.Mesh(new THREE.CircleGeometry(0.068, 16), dir===1?ledWhiteMat:M.lampR), dir*10.305, 2.16, lz+(lz>0?-0.13:0.13), 0, dir===1?Math.PI/2:-Math.PI/2, 0);
          });

          [-1.33, 1.33].forEach(cz => {
            add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.05), M.silver), dir*10.10, 1.72, cz, 0, dir*(cz>0?-Math.PI/4:Math.PI/4), 0);
            add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.58, 8), M.steel), dir*10.14, 1.88, cz+(cz>0?0.05:-0.05));
          });

          // دواستين صاج البقلاوة المخرم
          [-0.74, 0.74].forEach(sz => add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.54), diamondMat), dir*10.34, 1.06, sz));

          [-1.50, 1.50].forEach(mz => {
            add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.16), M.black), dir*9.02, 3.00, mz+(mz>0?0.06:-0.06));
            add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.35, 8), M.steel), dir*9.85, 1.75, mz>0?1.48:-1.48);
          });

          add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.62, 2.90), M.black), dir*10.22, 0.74, 0);
          [-0.86, 0.86].forEach(bz => {
            add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 0.44), M.iron), dir*10.46, 0.78, bz);
            add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.16), M.red), dir*10.40, 0.92, bz);
          });

          // القطرة + الخطاف الأزرق + ذراع فك القطرة المعدني + 4 خراطيم هواء بمشابك
          add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.20, 0.26), M.steel), dir*10.36, 0.72, 0);
          add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.08), new THREE.MeshStandardMaterial({ color: 0x1d4ed8 })), dir*10.48, 0.65, 0);
          add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.8, 8), M.steel), dir*10.38, 0.88, 0, Math.PI/2, 0, 0);

          [-0.42, -0.28, 0.28, 0.42].forEach(hz => {
            const curve = new THREE.CatmullRomCurve3([
              new THREE.Vector3(dir*10.36, 0.84, hz),
              new THREE.Vector3(dir*10.46, 0.62, hz*0.9),
              new THREE.Vector3(dir*10.38, 0.42, hz*0.7)
            ]);
            locoRoot.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.020, 8, false), M.black));
          });

          add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 2.66), chevronMat), dir*10.16, 0.28, 0, 0, 0, dir*0.22);
        });

    /* ---- additions: details of the real General that were missing from the base model ---- */
    const baseM = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, metalness: 0.2, roughness: 0.4 });
    // continuous grab-rails on both sides along the walkway, with their posts
    [-1.5, 1.5].forEach((z) => {
      add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 14.6, 8), M.steel), 0, 1.22, z, 0, 0, Math.PI / 2);
      for (let x = -7.2; x <= 7.2; x += 1.8) add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), M.steel), x, 1.1, z);
    });
    // fuel tank and under-frame pipes with brake cylinders
    add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 5.6, 20), M.black), 0, 0.62, 0, 0, 0, Math.PI / 2);
    add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.1, 1.3), M.iron), 0, 0.3, 0);
    [-1, 1].forEach((sz) => { add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 12.5, 8), M.steel), 0, 0.82, sz * 0.72, 0, 0, Math.PI / 2); add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 12), M.iron), sz * 3.2, 0.66, sz * 1.05, Math.PI / 2, 0, 0); });
    // roof: radio antennas, strobe, bell and the cooling-fan cage rails
    [[-6.0, 0.55], [2.6, -0.55]].forEach(([x, z]) => { add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 6), M.black), x, 4.88, z); add(locoRoot, new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M.red), x, 5.44, z); });
    add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.24), M.black), 8.7, 4.34, 0.6);
    add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.24), M.black), -8.7, 4.34, -0.6);
    [-1.2, 1.2].forEach((z) => add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 4.2, 6), M.steel), -3.8, 4.46, z, 0, 0, Math.PI / 2));
    [1, -1].forEach((dir) => {
      // sun visor and cab-door grab handles
      const vis = add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.05, 0.42), baseM), dir * 9.62, 4.06, 0); vis.rotation.y = dir === 1 ? Math.PI / 2 : -Math.PI / 2; vis.rotation.x = 0.28 * dir;
      [-1.52, 1.52].forEach((z) => { add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.05, 8), baseM), dir * 8.6, 2.2, z); add(locoRoot, new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.05, 8), baseM), dir * 8.18, 2.2, z); });
      // number board and flag on the nose
      const nb = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.26), new THREE.MeshStandardMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 108; const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, 256, 108); g.fillStyle = '#fff'; g.font = 'bold 74px Tahoma'; g.textAlign = 'center'; g.fillText('٢٥٩٥', 128, 84); return new THREE.CanvasTexture(c); })(), roughness: 0.5 }));
      add(locoRoot, nb, dir * 10.3, 2.62, 0.0, 0, dir === 1 ? Math.PI / 2 : -Math.PI / 2, 0); nb.rotation.x = -0.055;
      // front step plates with edge grips either side of the coupler
      [-1.2, 1.2].forEach((z) => add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.4), diamondMat), dir * 10.2, 1.28, z));
      // grey louvre band under the windscreen (as on the real nose)
      for (let r = 0; r < 5; r++) add(locoRoot, new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.028, 1.1), M.iron), dir * 10.31, 1.96 + r * 0.055, 0);
    });
    return { root: locoRoot, wheels: wheelsList, fans: fansList };
  }
  return {
    build(len) {
      if (!cache) cache = make();
      const g = cache.root.clone(true), wrap = new THREE.Group(); g.rotation.y = -Math.PI / 2; wrap.add(g);
      const s = (len || 21) / 20.9; wrap.scale.set(s, s, s);
      wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return wrap;
    }
  };
})();
