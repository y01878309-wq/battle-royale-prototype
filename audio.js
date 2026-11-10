'use strict';
/* Procedural sound: diesel engine, wheel noise and rail-joint clacks, wind, horn, brakes, bells. */
const Sound = {
  ctx: null, muted: false, joint: 0, buf: {}, engSrc: null, hornSrc: null,
  prof: { base: 22, span: 38, horn: [233, 293.7, 349.2], turbo: 0.06 },

  setProfile(p) { if (p) this.prof = p; },

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC(), out = this.master = c.createGain(); out.gain.value = this.muted ? 0 : 0.8; out.connect(c.destination);
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
    for (const [type, mul, vol] of [['sawtooth', 1, 0.5], ['square', 2.01, 0.18], ['sawtooth', 0.5, 0.45]]) {
      const o = c.createOscillator(); o.type = type; const g = c.createGain(); g.gain.value = vol; o.connect(g); g.connect(this.eng.f); o.start(); this.eng.o.push({ o, mul });
    }
    this.eng.f.connect(am); am.connect(this.eng.g); this.eng.g.connect(out);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 12; lg.gain.value = 0.35; lfo.connect(lg); lg.connect(am.gain); lfo.start(); this.eng.lfo = lfo;
    this.turbo = noise('bandpass', 1800, 2); this.rumble = noise('lowpass', 160, 0.7);
    this.wheel = noise('bandpass', 700, 0.6); this.wind = noise('highpass', 1400, 0.4); this.squeal = noise('bandpass', 2600, 12); this.hiss = noise('highpass', 4200, 0.5);
    // horn
    // air horn: three tones, each a saw plus a square, with slight vibrato and a breathy noise layer
    this.horns = this.prof.horn.map((fq, i) => {
      const f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.value = 1500; g.gain.value = 0; f.connect(g); g.connect(out);
      for (const [type, mul, vol] of [['sawtooth', 1, 0.6], ['square', 1.005, 0.25]]) { const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.value = fq * mul; og.gain.value = vol; o.connect(og); og.connect(f); o.start(); if (i === 0 && type === 'sawtooth') this.hornOsc = o; }
      return g;
    });
    this.loadSamples();
    this.bellG = c.createGain(); this.bellG.gain.value = 0; const bo = c.createOscillator(); bo.type = 'sine'; bo.frequency.value = 1720; bo.connect(this.bellG); this.bellG.connect(out); bo.start();
    this.lastBrake = 0;
  },

  clack(vol) {
    const c = this.ctx; if (!c) return;
    if (this.buf.clack) { const s = c.createBufferSource(), g = c.createGain(); s.buffer = this.buf.clack; s.playbackRate.value = 0.92 + Math.random() * 0.16; g.gain.value = Math.min(1, vol * 3); s.connect(g); g.connect(this.master); s.start(); return; }
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500 + Math.random() * 500; f.Q.value = 1.4;
    const g = c.createGain(), t = c.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + 0.12);
  },

  /* v m/s, throttle 0..1, brake 0..1, d metres moved this frame */
  update(st) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, v = st.v, kmh = v * 3.6, sm = (p, val, tc) => p.setTargetAtTime(val, t, tc || 0.08);
    const rpm = 0.25 + 0.75 * Math.max(st.throttle, Math.min(1, kmh / 140) * 0.35);
    const P = this.prof, synth = this.engSrc ? 0 : 1, base = P.base + rpm * P.span;
    for (const o of this.eng.o) sm(o.o.frequency, base * o.mul, 0.15);
    sm(this.eng.lfo.frequency, 6 + rpm * 16, 0.2);
    sm(this.eng.f.frequency, 160 + rpm * 520 + st.throttle * 500, 0.2);
    sm(this.eng.g.gain, synth * (0.16 + 0.22 * st.throttle + 0.05 * rpm), 0.2);
    if (this.engSrc) { sm(this.engSrc.src.playbackRate, 0.55 + 0.9 * rpm, 0.15); sm(this.engSrc.g.gain, 0.35 + 0.55 * st.throttle, 0.2); }
    sm(this.turbo.g.gain, synth * (0.012 + P.turbo * st.throttle * st.throttle), 0.3); sm(this.turbo.f.frequency, 1400 + 2200 * st.throttle, 0.3);
    sm(this.rumble.g.gain, synth * (0.22 + 0.25 * st.throttle), 0.3);
    const sp = Math.min(1, v / 38);
    sm(this.wheel.g.gain, 0.002 + 0.1 * sp * sp, 0.2); sm(this.wheel.f.frequency, 500 + 900 * sp, 0.2);
    sm(this.wind.g.gain, 0.12 * sp * sp * sp, 0.3);
    sm(this.squeal.g.gain, st.brake > 0.15 && v > 0.8 && v < 9 ? 0.03 * st.brake * (1 - v / 9) : 0, 0.1); sm(this.squeal.f.frequency, 2200 + v * 120, 0.1);
    const rel = this.lastBrake - st.brake; if (rel > 0.02 && st.brake < this.lastBrake) { this.hiss.g.gain.setTargetAtTime(Math.min(0.12, rel * 3), t, 0.01); this.hiss.g.gain.setTargetAtTime(0, t + 0.05, 0.25); }
    this.lastBrake = st.brake;
    // rail joints: one clack every 18 m for each bogie, two bogies close together
    this.joint += st.d;
    while (this.joint >= 18) { this.joint -= 18; const vol = 0.05 + 0.2 * sp; this.clack(vol); setTimeout(() => this.clack(vol * 0.8), Math.max(30, 2500 / Math.max(v, 1))); }
    sm(this.bellG.gain, st.bell ? (Math.floor(t * 5) % 2 ? 0.05 : 0.0) : 0, 0.005);
    if (st.over && Math.floor(t * 3) % 2) this.beep(1100, 0.1);
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
    this.horns.forEach((g, i) => { g.gain.cancelScheduledValues(c.currentTime); g.gain.setTargetAtTime(on ? 0.11 : 0, c.currentTime, on ? 0.06 : 0.18); });
  },

  /* Optional recordings: put audio/manifest.json next to index.html, e.g.
     { "engine": "engine.mp3", "horn": "horn.mp3", "clack": "clack.mp3", "chime": "chime.mp3" }
     engine is looped and pitched by throttle; horn plays while the key is held. Missing files fall back to the synthesised sound. */
  async loadSamples() {
    const c = this.ctx;
    try {
      const r = await fetch('audio-manifest.json'); if (!r.ok) return;
      const m = await r.json();
      for (const k of ['engine', 'horn', 'clack', 'chime']) {
        if (!m[k]) continue;
        try { const rr = await fetch(m[k]); this.buf[k] = await c.decodeAudioData(await rr.arrayBuffer()); } catch (e) { /* skip this file */ }
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

  speak(text) {
    if (this.muted || !('speechSynthesis' in window)) return;
    try { const u = new SpeechSynthesisUtterance(text); u.lang = 'ar-EG'; u.rate = 0.95; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch (e) { /* no voice available */ }
  },

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.8; if (m && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }
};
