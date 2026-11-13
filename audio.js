'use strict';
/* Procedural sound: diesel engine, wheel noise and rail-joint clacks, wind, horn, brakes, bells. */
const Sound = {
  ctx: null, muted: false, joint: 0, buf: {}, engSrc: null, hornSrc: null,
  prof: { base: 28, span: 17, horn: [320, 382, 439, 498, 643], turbo: 0.06 },

  setProfile(p) { if (p) this.prof = p; },

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC(), out = this.master = c.createGain(); out.gain.value = this.muted ? 0 : 0.8 * this.vol('vMaster'); out.connect(c.destination);
    const len = c.sampleRate * 2, nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    const noise = (type, freq, q) => {
      const s = c.createBufferSource(); s.buffer = nb; s.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(out); s.start(); return { g, f };
    };
    // engine
    this.eng = { g: c.createGain(), f: c.createBiquadFilter(), o: [] };
    this.eng.g.gain.value = 0; this.eng.f.type = 'lowpass'; this.eng.f.frequency.value = 300;
    const am = c.createGain(); am.gain.value = 1; this.eng.am = am;
    // Diesel firing comb. A recording of a GE loco showed a steady comb at multiples of 41.8 Hz (3x to 6x strongest),
    // so the oscillators are the fundamental plus those harmonics, with a little sub-octave rumble.
    for (const [type, mul, vol] of [['sine', 0.5, 0.35], ['sawtooth', 1, 0.3], ['sine', 3, 0.5], ['sine', 4, 0.55], ['sine', 5, 0.7], ['sine', 6, 0.62], ['sine', 8, 0.2]]) {
      const o = c.createOscillator(); o.type = type; const g = c.createGain(); g.gain.value = vol * 0.8; o.connect(g); g.connect(this.eng.f); o.start(); this.eng.o.push({ o, mul });
    }
    this.eng.f.connect(am); am.connect(this.eng.g); this.eng.g.connect(out);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 12; lg.gain.value = 0.35; lfo.connect(lg); lg.connect(am.gain); lfo.start(); this.eng.lfo = lfo;
    this.turbo = noise('bandpass', 1800, 2); this.rumble = noise('lowpass', 160, 0.7);
    this.wheel = noise('bandpass', 700, 0.6); this.wind = noise('highpass', 1400, 0.4); this.squeal = noise('bandpass', 2600, 12); this.hiss = noise('highpass', 4200, 0.5);
    // Horn: one saw + one slightly detuned square per chime, through a low-pass, plus a breath of noise.
    // The GE profile uses the five chime pitches measured from a recording (about 320, 382, 439, 498 and 643 Hz).
    // small "outdoor" reverb shared by the horn and the clacks
    const rl = Math.floor(c.sampleRate * 1.4), rb = c.createBuffer(2, rl, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const rd = rb.getChannelData(ch); for (let i = 0; i < rl; i++) rd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.6); }
    this.rev = c.createConvolver(); this.rev.buffer = rb; this.revG = c.createGain(); this.revG.gain.value = 0.5; this.rev.connect(this.revG); this.revG.connect(out);
    this.hornOscs = [];
    this.horns = this.prof.horn.map((fq, i) => {
      const f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.value = 1900; f.Q.value = 0.9; g.gain.value = 0; f.connect(g); g.connect(out); g.connect(this.rev);
      for (const [type, mul, vol] of [['sawtooth', 1, 0.5], ['sawtooth', 1.006, 0.3], ['square', 0.5, 0.12], ['sine', 2, 0.2]]) { const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.value = fq * mul; og.gain.value = vol; o.connect(og); og.connect(f); o.start(); this.hornOscs.push({ o, f: fq * mul }); }
      return g;
    });
    const hb = c.createBufferSource(); hb.buffer = nb; hb.loop = true; const hf = c.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 1300; hf.Q.value = 0.8; this.hornBreath = c.createGain(); this.hornBreath.gain.value = 0; hb.connect(hf); hf.connect(this.hornBreath); this.hornBreath.connect(out); hb.start();
    this.loadSamples();
    this.bellG = c.createGain(); this.bellG.gain.value = 0; const bo = c.createOscillator(); bo.type = 'sine'; bo.frequency.value = 1720; bo.connect(this.bellG); this.bellG.connect(out); bo.start();
    this.lastBrake = 0;
  },

  clack(vol) {
    const c = this.ctx; if (!c) return;
    if (this.buf.clack) { const s = c.createBufferSource(), g = c.createGain(); s.buffer = this.buf.clack; s.playbackRate.value = 0.92 + Math.random() * 0.16; g.gain.value = Math.min(1, vol * 3); s.connect(g); g.connect(this.master); s.start(); return; }
    const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 700; f.Q.value = 1.1;
    const g = c.createGain(); g.gain.setValueAtTime(vol * 1.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + 0.1);
    // low thump of the wheel dropping on the joint, and a short metallic ring
    const th = c.createOscillator(), tg = c.createGain(); th.type = 'sine'; th.frequency.setValueAtTime(95, t); th.frequency.exponentialRampToValueAtTime(45, t + 0.12); tg.gain.setValueAtTime(vol * 1.3, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.16); th.connect(tg); tg.connect(this.master); th.start(t); th.stop(t + 0.2);
    const rg = c.createGain(), ro = c.createOscillator(); ro.type = 'triangle'; ro.frequency.value = 1180 + Math.random() * 200; rg.gain.setValueAtTime(vol * 0.12, t); rg.gain.exponentialRampToValueAtTime(0.001, t + 0.18); ro.connect(rg); rg.connect(this.master); ro.start(t); ro.stop(t + 0.2);
  },

  /* v m/s, throttle 0..1, brake 0..1, d metres moved this frame */
  update(st) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, v = st.v, kmh = v * 3.6, sm = (p, val, tc) => p.setTargetAtTime(val, t, tc || 0.08);
    const rpm = 0.25 + 0.75 * Math.max(st.throttle, Math.min(1, kmh / 140) * 0.35);
    const P = this.prof, synth = this.engSrc ? 0 : 1, base = P.base + rpm * P.span;   // fundamental in Hz, about 42 at a working notch
    for (const o of this.eng.o) sm(o.o.frequency, base * o.mul, 0.15);
    sm(this.eng.lfo.frequency, 6 + rpm * 16, 0.2);
    sm(this.eng.f.frequency, 380 + rpm * 500 + st.throttle * 500, 0.2);
    const ev = this.vol('vEngine'); sm(this.eng.g.gain, ev * synth * (0.16 + 0.22 * st.throttle + 0.05 * rpm), 0.2);
    if (this.engSrc) { sm(this.engSrc.src.playbackRate, 0.55 + 0.9 * rpm, 0.15); sm(this.engSrc.g.gain, ev * (0.35 + 0.55 * st.throttle), 0.2); }
    sm(this.turbo.g.gain, ev * synth * (0.012 + P.turbo * st.throttle * st.throttle), 0.3); sm(this.turbo.f.frequency, 1400 + 2200 * st.throttle, 0.3);
    const sp = Math.min(1, v / 38);
    sm(this.wheel.g.gain, 0.004 + 0.22 * sp * (0.4 + 0.6 * sp), 0.2); sm(this.wheel.f.frequency, 400 + 1100 * sp, 0.2);
    sm(this.rumble.g.gain, ev * synth * (0.22 + 0.25 * st.throttle) + 0.25 * sp, 0.3);
    sm(this.wind.g.gain, 0.05 * sp + 0.16 * sp * sp * sp, 0.3); sm(this.wind.f.frequency, 900 + 1800 * sp, 0.3);
    sm(this.squeal.g.gain, st.brake > 0.15 && v > 0.8 && v < 9 ? 0.03 * st.brake * (1 - v / 9) : 0, 0.1); sm(this.squeal.f.frequency, 2200 + v * 120, 0.1);
    const rel = this.lastBrake - st.brake; if (rel > 0.02 && st.brake < this.lastBrake) { this.hiss.g.gain.setTargetAtTime(Math.min(0.12, rel * 3), t, 0.01); this.hiss.g.gain.setTargetAtTime(0, t + 0.05, 0.25); }
    this.lastBrake = st.brake;
    // rail joints: one clack every 18 m for each bogie, two bogies close together
    this.joint += st.d;
    while (this.joint >= 15) { this.joint -= 15; const vol = 0.08 + 0.3 * sp; this.clack(vol); setTimeout(() => this.clack(vol * 0.8), Math.max(30, 2500 / Math.max(v, 1))); }
    sm(this.bellG.gain, st.bell ? (Math.floor(t * 5) % 2 ? 0.05 : 0.0) : 0, 0.005);
    if (st.over && Math.floor(t * 3) % 2) this.beep(1100, 0.1);
  },

  /* Crash: a noise burst with a falling low-pass, a metal screech and a few later bangs. */
  crash() {
    const c = this.ctx; if (!c) return; const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3500, t); f.frequency.exponentialRampToValueAtTime(120, t + 3);
    const g = c.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.01, t + 3.2); s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 3.3);
    const o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(700, t + 1.6);
    og.gain.setValueAtTime(0.12, t); og.gain.exponentialRampToValueAtTime(0.001, t + 1.7); o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 1.8);
    for (let i = 1; i <= 4; i++) setTimeout(() => this.clack(0.9), i * 380 + Math.random() * 200);
  },

  beep(fq, dur) {
    const c = this.ctx; if (!c || this._beeping) return; this._beeping = true; setTimeout(() => (this._beeping = false), 330);
    const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = fq; g.gain.value = 0.05; o.connect(g); g.connect(this.master); o.start(); o.stop(c.currentTime + dur);
  },

  horn(on) {
    const c = this.ctx; if (!c) return;
    if (this.buf.horn) {
      const t = c.currentTime;
      if (on) { if (this.hornSrc) return; const s = c.createBufferSource(), g = c.createGain(); s.buffer = this.buf.horn; g.gain.value = 1; s.connect(g); g.connect(this.master); s.start(); this.hornSrc = { s, g }; s.onended = () => { this.hornSrc = null; }; }
      else if (this.hornSrc) { const h = this.hornSrc; h.g.gain.setTargetAtTime(0, t, 0.1); h.s.stop(t + 0.5); this.hornSrc = null; }
      return;
    }
    const t = c.currentTime, n = this.horns.length, lvl = 0.5 / Math.sqrt(n);
    if (on) for (const h of this.hornOscs) { h.o.frequency.cancelScheduledValues(t); h.o.frequency.setValueAtTime(h.f * 0.9, t); h.o.frequency.exponentialRampToValueAtTime(h.f, t + 0.22); }   // the blat: pitch rises into the note
    this.horns.forEach((g, i) => { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(on ? lvl : 0, t + i * 0.02, on ? 0.07 : 0.22); });
    this.hornBreath.gain.cancelScheduledValues(t); this.hornBreath.gain.setTargetAtTime(on ? 0.05 : 0, t, on ? 0.04 : 0.12);
  },

  /* Optional recordings: put audio/manifest.json next to index.html, e.g.
     { "engine": "engine.mp3", "horn": "horn.mp3", "clack": "clack.mp3", "chime": "chime.mp3" }
     engine is looped and pitched by throttle; horn plays while the key is held. Missing files fall back to the synthesised sound. */
  async loadSamples() {
    const c = this.ctx;
    try {
      const r = await fetch('audio/manifest.json'); if (!r.ok) return;
      const m = await r.json();
      for (const k of ['engine', 'horn', 'clack', 'chime']) {
        if (!m[k]) continue;
        try { const rr = await fetch('audio/' + m[k]); this.buf[k] = await c.decodeAudioData(await rr.arrayBuffer()); } catch (e) { /* skip this file */ }
      }
      if (this.buf.engine) { const src = c.createBufferSource(), g = c.createGain(); src.buffer = this.buf.engine; src.loop = true; g.gain.value = 0.3; src.connect(g); g.connect(this.master); src.start(); this.engSrc = { src, g }; }
    } catch (e) { /* no recordings, keep the synthesised sounds */ }
  },

  chime(good) {
    const c = this.ctx; if (!c) return;
    if (this.buf.chime && good) { const s = c.createBufferSource(); s.buffer = this.buf.chime; s.connect(this.master); s.start(); return; }
    const seq = good ? [660, 880, 1100] : [440, 330];
    seq.forEach((fq, i) => { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.16; o.type = 'sine'; o.frequency.value = fq; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.14, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.7); });
  },

  vol(k) { return typeof Settings !== 'undefined' && Settings.d ? Settings.d[k] : 1; },
  applyVolumes() { if (this.master) this.master.gain.value = this.muted ? 0 : 0.8 * this.vol('vMaster'); },

  /* Station-announcement chime (ding-dong): used before the voice, and alone when the device has no Arabic voice. */
  paChime() {
    const c = this.ctx; if (!c) return;
    [[784, 0], [622, 0.38]].forEach(([fq, dt]) => { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + dt; o.type = 'sine'; o.frequency.value = fq; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1); o.connect(g); g.connect(this.master); if (this.rev) g.connect(this.rev); o.start(t); o.stop(t + 1.2); });
  },
  voice() {
    const vs = ('speechSynthesis' in window && window.speechSynthesis.getVoices()) || [];
    return vs.find((v) => /^ar[-_]EG/i.test(v.lang)) || vs.find((v) => /^ar/i.test(v.lang)) || null;
  },
  speak(text) {
    if (this.muted || this.vol('vVoice') <= 0) return;
    this.paChime();
    if (!('speechSynthesis' in window)) return;
    const ss = window.speechSynthesis, go = () => {
      const v = this.voice(); if (!v) return;   // no Arabic voice on this device: the chime and the caption are all it can do
      try {
        const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; u.rate = 0.92; u.volume = Math.min(1, this.vol('vVoice'));
        if (ss.speaking || ss.pending) { ss.cancel(); setTimeout(() => ss.speak(u), 120); } else ss.speak(u);
      } catch (e) { /* no voice available */ }
    };
    if (!ss.getVoices().length) { let done = false; const once = () => { if (done) return; done = true; go(); }; ss.addEventListener('voiceschanged', once, { once: true }); setTimeout(once, 700); } else setTimeout(go, 900);
  },
  /* Settings: lets the player hear whether the device can speak Arabic. */
  testVoice() { this.init(); this.speak('السادة الركاب، قطر قطارات مصر يصل بعد قليل. برجاء الابتعاد عن حافة الرصيف.'); return !!this.voice(); },

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.8 * this.vol('vMaster'); if (m && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }
};
