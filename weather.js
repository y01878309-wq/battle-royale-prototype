'use strict';
/* Weather: light rain, and dust haze in the sandy regions. Only runs when the player turns weather on in the settings. */
class Weather {
  constructor(scene, sky) {
    this.scene = scene; this.sky = sky; this.on = false; this.k = 0;   // k: 0..1 how strongly the weather is showing
    this.baseCol = scene.fog.color.clone(); this.baseDen = scene.fog.density; this.dust = new THREE.Color(0xc9a977);
    const N = 900; this.N = N; this.off = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) this.off.set([(Math.random() - 0.5) * 70, Math.random() * 34 - 6, (Math.random() - 0.5) * 70], i * 3);
    const pos = new Float32Array(N * 6), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.pos = pos; this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd6dde6, transparent: true, opacity: 0.0, depthWrite: false }));
    this.rain.frustumCulled = false; this.rain.visible = false; scene.add(this.rain);
  }

  /* Call again whenever the sky preset changes, so the haze fades back to the right colour. */
  rebase() { this.baseCol.copy(this.scene.fog.color); this.baseDen = this.scene.fog.density; }

  update(dt, camera, sand) {
    const want = this.on ? 1 : 0; this.k += (want - this.k) * Math.min(1, dt * 0.6);
    const fog = this.scene.fog, dusty = this.on && sand > 0.5, rainy = this.on && !dusty;
    this.dk = (this.dk || 0) + ((dusty ? 1 : 0) - (this.dk || 0)) * Math.min(1, dt * 0.5);
    fog.color.copy(this.baseCol).lerp(this.dust, 0.65 * this.dk); fog.density = this.baseDen * (1 + 1.6 * this.dk + 0.5 * (rainy ? this.k : 0));
    this.rk = (this.rk || 0) + ((rainy ? 1 : 0) - (this.rk || 0)) * Math.min(1, dt * 0.8);
    this.rain.visible = this.rk > 0.02; if (!this.rain.visible) return;
    this.rain.material.opacity = 0.32 * this.rk; this.rain.position.copy(camera.position);
    const o = this.off, p = this.pos, sp = 22 * dt;
    for (let i = 0; i < this.N; i++) {
      let y = o[i * 3 + 1] - sp; if (y < -6) y += 34; o[i * 3 + 1] = y;
      const x = o[i * 3], z = o[i * 3 + 2], j = i * 6;
      p[j] = x; p[j + 1] = y; p[j + 2] = z; p[j + 3] = x + 0.04; p[j + 4] = y + 0.7; p[j + 5] = z;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }
}
