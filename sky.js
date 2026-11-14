'use strict';
/* Sky dome, sun, haze and image-based lighting. One preset per time of day. */
const SKY_PRESETS = {
  morning: { elev: 24, az: 105, zen: [0.30, 0.52, 0.86], hor: [0.90, 0.82, 0.70], sun: [1.0, 0.86, 0.68], sunI: 2.9, hemiSky: 0xbfd2ea, hemiGnd: 0x7d6c52, hemiI: 0.75, fog: 0.00032, exp: 0.95, cover: 0.3, cloud: [1.0, 0.95, 0.9], stars: 0 },
  noon:    { elev: 64, az: 160, zen: [0.18, 0.44, 0.90], hor: [0.80, 0.86, 0.92], sun: [1.0, 0.97, 0.92], sunI: 3.4, hemiSky: 0xb7d0f0, hemiGnd: 0x8a7a5a, hemiI: 0.85, fog: 0.00026, exp: 0.9, cover: 0.35, cloud: [1.0, 1.0, 1.0], stars: 0 },
  sunset:  { elev: 7,  az: 250, zen: [0.16, 0.27, 0.56], hor: [0.98, 0.62, 0.36], sun: [1.0, 0.56, 0.26], sunI: 2.6, hemiSky: 0x8a9cc8, hemiGnd: 0x6b4c36, hemiI: 0.6,  fog: 0.00038, exp: 1.0, cover: 0.25, cloud: [1.0, 0.7, 0.55], stars: 0 },
  overcast:{ elev: 42, az: 200, zen: [0.46, 0.50, 0.56], hor: [0.72, 0.74, 0.76], sun: [0.9, 0.9, 0.9], sunI: 1.3, hemiSky: 0xc4cad2, hemiGnd: 0x7a7060, hemiI: 1.25, fog: 0.00048, exp: 1.0, cover: 0.92, cloud: [0.6, 0.62, 0.67], stars: 0 },
  night:   { elev: 38, az: 120, zen: [0.015, 0.025, 0.07], hor: [0.07, 0.09, 0.16], sun: [0.45, 0.55, 0.9], sunI: 0.22, hemiSky: 0x141c36, hemiGnd: 0x07070a, hemiI: 0.22, fog: 0.00042, exp: 0.85, cover: 0.2, cloud: [0.12, 0.14, 0.22], stars: 1 }
};

class Sky {
  constructor(renderer, scene) {
    this.renderer = renderer; this.scene = scene;
    this.uniforms = {
      zen: { value: new THREE.Vector3() }, hor: { value: new THREE.Vector3() },
      sunCol: { value: new THREE.Vector3() }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
      cover: { value: 0.3 }, cloudCol: { value: new THREE.Vector3(1, 1, 1) }, stars: { value: 0 }, time: { value: 0 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec3 vDir; uniform vec3 zen, hor, sunCol, sunDir, cloudCol; uniform float cover, stars, time;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
        float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 11.0; a *= 0.5; } return s; }
        void main(){
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 col = mix(hor, zen, pow(h, 0.42));
          float sd = max(dot(d, sunDir), 0.0);
          col += sunCol * (pow(sd, 6.0) * 0.22 + pow(sd, 120.0) * 0.55 + pow(sd, 3000.0) * 9.0);
          col = mix(col, hor * 1.02, exp(-h * 22.0) * 0.55);
          if (stars > 0.0 && d.y > 0.0) { vec2 sp = d.xz / (d.y + 0.2) * 40.0; float st = step(0.9965, h21(floor(sp))); col += vec3(st) * stars * smoothstep(0.05, 0.4, d.y); }
          if (d.y > 0.0) {
            vec2 cp = d.xz / (d.y + 0.12) * 0.9 + vec2(time * 0.004, time * 0.0015);
            float n = fbm(cp * 1.3), cl = smoothstep(1.0 - cover, 1.0 - cover + 0.28, n);
            float lit = 0.75 + 0.25 * smoothstep(0.35, 0.8, fbm(cp * 2.6 + 3.0));
            vec3 cc = cloudCol * lit + sunCol * pow(sd, 8.0) * 0.25 * (1.0 - stars);
            col = mix(col, cc, cl * smoothstep(0.0, 0.18, d.y) * 0.92);
          }
          if (d.y < 0.0) col = mix(hor, hor * 0.62, clamp(-d.y * 5.0, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
    this.dome.scale.setScalar(12000); this.dome.renderOrder = -10; this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 3);
    this.sunLight.castShadow = true;
    const sc = this.sunLight.shadow.camera; sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.near = 1; sc.far = 600;
    this.sunLight.shadow.bias = -0.0004; this.sunLight.shadow.normalBias = 0.06;
    scene.add(this.sunLight, this.sunLight.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 0.7);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xccbb99, 0.0003);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.sunDir = new THREE.Vector3();
  }

  setShadowQuality(q) {
    this.sunLight.castShadow = q !== 'low';
    this.sunLight.shadow.mapSize.set(q === 'high' ? 4096 : 2048, q === 'high' ? 4096 : 2048);
    if (this.sunLight.shadow.map) { this.sunLight.shadow.map.dispose(); this.sunLight.shadow.map = null; }
  }

  apply(name) {
    const p = SKY_PRESETS[name] || SKY_PRESETS.sunset, el = p.elev * Math.PI / 180, az = p.az * Math.PI / 180;
    this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    this.uniforms.zen.value.set(...p.zen); this.uniforms.hor.value.set(...p.hor);
    this.uniforms.sunCol.value.set(...p.sun); this.uniforms.sunDir.value.copy(this.sunDir);
    this.uniforms.cover.value = p.cover; this.uniforms.cloudCol.value.set(...p.cloud); this.uniforms.stars.value = p.stars;
    this.night = name === 'night';
    this.sunLight.color.setRGB(p.sun[0], p.sun[1], p.sun[2]); this.sunLight.intensity = p.sunI;
    this.hemi.color.set(p.hemiSky); this.hemi.groundColor.set(p.hemiGnd); this.hemi.intensity = p.hemiI;
    this.scene.fog.color.setRGB(p.hor[0] * 0.98, p.hor[1] * 0.97, p.hor[2] * 0.95); this.scene.fog.density = p.fog;
    this.renderer.toneMappingExposure = this.night ? p.exp : p.exp * 1.12;
    // Reflections: render the dome alone into a prefiltered environment map.
    const envScene = new THREE.Scene();
    const d = new THREE.Mesh(this.dome.geometry, this.dome.material); d.scale.setScalar(100); envScene.add(d);
    if (this.envTex) this.envTex.dispose();
    this.envTex = this.pmrem.fromScene(envScene, 0.02).texture;
    this.scene.environment = this.night ? null : this.envTex;   // at night the reflections of the sky dome are what used to wash everything out
    envScene.remove(d);
  }

  /* Keep the dome centred on the camera and the shadow box on the train. */
  update(camera, focus, time) {
    this.dome.position.copy(camera.position); this.uniforms.time.value = time || 0;
    this.sunLight.target.position.copy(focus);
    this.sunLight.position.copy(focus).addScaledVector(this.sunDir, 300);
    this.sunLight.target.updateMatrixWorld();
  }
}
