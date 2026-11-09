'use strict';
/* Driving physics, station stops, speed limits and scoring. No rendering here, so it can be tested alone. */
class Game {
  constructor(L, stations, limitAt) {
    this.L = L; this.st = stations; this.limitAt = limitAt;
    this.MASS = 360000; this.FMAX = 300000; this.POWER = 2.9e6;
    this.reset();
  }

  reset() {
    this.s = this.st[0].stopS; this.v = 0; this.a = 0; this.t = 0;
    this.brakeCmd = 0; this.brake = 0; this.power = 0; this.doors = 0;
    this.phase = 'running'; this.nextIdx = 1; this.prevStopS = this.st[0].stopS;
    this.score = 0; this.rec = []; this.penalty = { speed: 0, other: 0 }; this.missed = 0;
    this.dwellT = 0; this.legT = 0; this.overT = 0; this.overAcc = 0; this.stoppedFar = 0; this.warned = false; this.finished = false;
    this.travelled = 0;
  }

  /* Metres from the loco front to the next stop mark, negative once passed. */
  distToStop() {
    const st = this.st[this.nextIdx]; if (!st) return 0;
    let d = ((st.stopS - this.s) % this.L + this.L) % this.L; if (d > this.L / 2) d -= this.L; return d;
  }

  get kmh() { return this.v * 3.6; }
  get limit() { return this.limitAt(this.s); }
  get over() { return this.kmh > this.limit + 3; }

  step(dt, inp) {
    const ev = [];
    if (this.finished) { this.v = Math.max(0, this.v - 1.2 * dt); return ev; }
    this.t += dt; this.legT += dt;
    // brake: graduated application, slower release, faster in an emergency
    this.brakeCmd = U.clamp(this.brakeCmd + (inp.brakeHeld ? 0.9 : -1.3) * dt, 0, 1);
    const tgt = inp.emergency ? 1 : this.brakeCmd, rate = inp.emergency ? 2.5 : (tgt > this.brake ? 1.0 : 0.6);
    this.brake += Math.sign(tgt - this.brake) * Math.min(Math.abs(tgt - this.brake), rate * dt);
    // traction, cut while braking or with the doors open
    const allowed = this.brake < 0.05 && this.doors < 0.02 && this.phase === 'running';
    const ptgt = allowed ? inp.notch / 8 : 0, pr = ptgt > this.power ? 0.6 : 2.5;
    this.power += Math.sign(ptgt - this.power) * Math.min(Math.abs(ptgt - this.power), pr * dt);
    const v = this.v, F = Math.min(this.FMAX * this.power, this.POWER * this.power / Math.max(v, 0.5));
    const R = v > 0.01 ? 6000 + 140 * v + 8 * v * v : 0;
    const dec = this.brake * (inp.emergency ? 1.7 : 1.15) * (v > 0.01 ? 1 : 0);
    let a = (F - R) / this.MASS - dec; if (v <= 0.01 && a < 0) a = 0;
    this.a = a; this.v = U.clamp(v + a * dt, 0, 45);
    const d = this.v * dt; this.s += d; this.travelled += d;
    this.d = d;

    // speed limit
    if (this.over && this.phase === 'running') {
      this.overT += dt; this.overAcc += dt;
      if (this.overAcc >= 1) { const hard = this.kmh > this.limit + 15; this.overAcc = 0; const p = hard ? 5 : 2; this.penalty.speed += p; this.score = Math.max(0, this.score - p); }
      if (!this.warned) { this.warned = true; ev.push({ type: 'over' }); }
    } else { this.overAcc = 0; if (this.warned && !this.over) this.warned = false; }

    if (this.phase === 'running') {
      const st = this.st[this.nextIdx], dist = this.distToStop();
      if (st) {
        if (this.v < 0.15 && dist > -30 && dist < 60) {
          const err = dist, ae = Math.abs(err);
          let pts = ae <= 1.5 ? 100 : ae <= 4 ? 85 : ae <= 8 ? 65 : ae <= 15 ? 45 : ae <= 30 ? 25 : 10;
          const planned = ((st.stopS - this.prevStopS) % this.L + this.L) % this.L / 25 + 30;
          const bonus = this.legT <= planned ? 50 : Math.max(0, Math.round(50 - (this.legT - planned) * 0.5));
          if (inp.emergency) pts = Math.max(0, pts - 20);
          this.score += pts + bonus;
          this.rec.push({ name: st.name, err, pts, bonus, time: this.legT });
          this.phase = 'dwell'; this.dwellT = 0; this.stoppedFar = 0; this.brakeCmd = Math.max(this.brakeCmd, 0.6);
          ev.push({ type: 'arrive', idx: this.nextIdx, err, pts, bonus });
        } else if (this.v < 0.15 && dist >= 60 && dist < 400) {
          this.stoppedFar += dt; if (this.stoppedFar > 2.5) { this.stoppedFar = -6; ev.push({ type: 'tooFar', dist }); }
        } else if (dist <= -60) {
          this.missed++; this.score = Math.max(0, this.score - 50); this.penalty.other += 50;
          ev.push({ type: 'missed', idx: this.nextIdx });
          this.prevStopS = st.stopS; this.legT = 0; this.nextIdx++;
          if (this.nextIdx >= this.st.length) { this.finished = true; ev.push({ type: 'finish' }); }
        }
      }
    } else if (this.phase === 'dwell') {
      this.dwellT += dt; const T = this.dwellT;
      this.doors = T < 2 ? T / 2 : T < 14 ? 1 : T < 16 ? 1 - (T - 14) / 2 : 0;
      if (this.v > 0.6 && this.doors > 0.05 && !this._moved) { this._moved = true; this.score = Math.max(0, this.score - 30); this.penalty.other += 30; ev.push({ type: 'moved' }); }
      if (T >= 16) {
        this._moved = false; const idx = this.nextIdx; this.prevStopS = this.st[idx].stopS; this.legT = 0; this.nextIdx++;
        ev.push({ type: 'depart', idx });
        if (this.nextIdx >= this.st.length) { this.finished = true; ev.push({ type: 'finish' }); } else this.phase = 'running';
      }
    }
    return ev;
  }

  grade() {
    const sc = this.score;
    return sc >= 380 ? 'ممتاز، سواق محترف' : sc >= 280 ? 'جيد جدًا' : sc >= 180 ? 'جيد' : 'محتاج تدريب أكتر';
  }
}
