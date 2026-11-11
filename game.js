'use strict';
/* Driving physics, station stops, speed limits and scoring. No rendering here, so it can be tested alone. */
class Game {
  /* phys: { mass (kg), fmax (N), power (W), brake (m/s2), vmax (km/h) } */
  constructor(L, stations, limitAt, phys) {
    this.L = L; this.st = stations; this.limitAt = limitAt;
    const p = phys || {};
    this.MASS = p.mass || 360000; this.FMAX = p.fmax || 300000; this.POWER = p.power || 2.9e6; this.BRAKE = p.brake || 1.15; this.VMAX = (p.vmax || 120) / 3.6;
    this.TOL = p.tolerance || 25;   // km/h over the limit that the train can take for a while before it leaves the rails
    this.reset();
  }

  reset() {
    this.s = this.st[0].stopS; this.v = 0; this.a = 0; this.t = 0;
    this.brakeCmd = 0; this.brake = 0; this.power = 0; this.doors = 0; this.doorWant = 0; this._autoOpen = false;
    this.phase = 'running'; this.nextIdx = 1; this.prevStopS = this.st[0].stopS;
    this.score = 0; this.rec = []; this.penalty = { speed: 0, other: 0 }; this.missed = 0;
    this.dwellT = 0; this.legT = 0; this.overT = 0; this.overAcc = 0; this.stoppedFar = 0; this.warned = false; this.finished = false;
    this.travelled = 0; this.risk = 0; this.derailed = false; this.derailT = 0; this.derailWhy = ''; this._riskWarn = 0; this._spad = -1;
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
    if (this.derailed) { this.derailT += dt; this.v = Math.max(0, this.v - 4.5 * dt); const dd = this.v * dt; this.s += dd; this.d = dd; return ev; }
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
    const dec = this.brake * (inp.emergency ? this.BRAKE * 1.5 : this.BRAKE) * (v > 0.01 ? 1 : 0);
    let a = (F - R) / this.MASS - dec; if (v <= 0.01 && a < 0) a = 0;
    this.a = a; this.v = U.clamp(v + a * dt, 0, this.VMAX * 1.25);
    const d = this.v * dt; this.s += d; this.travelled += d;
    this.d = d;

    // speed limit
    if (this.over && this.phase === 'running') {
      this.overT += dt; this.overAcc += dt;
      if (this.overAcc >= 1) { const hard = this.kmh > this.limit + 15; this.overAcc = 0; const p = hard ? 5 : 2; this.penalty.speed += p; this.score = Math.max(0, this.score - p); }
      if (!this.warned) { this.warned = true; ev.push({ type: 'over' }); }
    } else { this.overAcc = 0; if (this.warned && !this.over) this.warned = false; }

    // derailment: well over the limit builds up risk (faster the worse it is); driving carefully lets it fall again
    const excess = this.kmh - (this.limit + 10);
    this.risk = U.clamp(this.risk + (excess > 0 ? excess / this.TOL * 0.22 * dt : -0.12 * dt), 0, 1);
    if (this.risk > 0.45 && this.t - this._riskWarn > 3) { this._riskWarn = this.t; ev.push({ type: 'danger', risk: this.risk }); }
    if (this.risk >= 1) return this.derail(ev, 'speed');

    if (this.phase === 'running') {
      const st = this.st[this.nextIdx], dist = this.distToStop();
      // starter signal stands 28 m beyond the stop mark and is red until the train has been dealt with
      if (st && this._spad !== this.nextIdx && dist < -28 && dist > -60 && this.kmh > 5) {
        this._spad = this.nextIdx; this.score = Math.max(0, this.score - 100); this.penalty.other += 100;
        ev.push({ type: 'spad', idx: this.nextIdx, kmh: this.kmh });
        if (this.kmh > 40) return this.derail(ev, 'signal');
      }
      if (st) {
        if (this.v < 0.15 && dist > -30 && dist < 60) {
          const err = dist, ae = Math.abs(err);
          let pts = ae <= 1.5 ? 100 : ae <= 4 ? 85 : ae <= 8 ? 65 : ae <= 15 ? 45 : ae <= 30 ? 25 : 10;
          const planned = ((st.stopS - this.prevStopS) % this.L + this.L) % this.L / (this.VMAX * 0.21) + 30;
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
      // doors are opened and closed by the driver (button / key); they open by themselves on arrival and close by themselves after a while
      if (T > 0.6 && T < 0.8 && !this._autoOpen) { this._autoOpen = true; this.doorWant = 1; }
      if (T > 24 && this.doorWant) this.doorWant = 0;
      this.doors = U.clamp(this.doors + Math.sign((this.doorWant ? 1 : 0) - this.doors) * Math.min(Math.abs((this.doorWant ? 1 : 0) - this.doors), dt / 2), 0, 1);
      if (this.v > 0.6 && this.doors > 0.05 && !this._moved) { this._moved = true; this.score = Math.max(0, this.score - 30); this.penalty.other += 30; ev.push({ type: 'moved' }); }
      if (T >= 16 && this.doors < 0.02) {
        this._moved = false; this._autoOpen = false; this.doorWant = 0; const idx = this.nextIdx; this.prevStopS = this.st[idx].stopS; this.legT = 0; this.nextIdx++;
        ev.push({ type: 'depart', idx });
        if (this.nextIdx >= this.st.length) { this.finished = true; ev.push({ type: 'finish' }); } else this.phase = 'running';
      }
    }
    return ev;
  }

  /* Driver presses the door button: only works while stopped at a station. */
  toggleDoors() { if (this.phase !== 'dwell' || this.v > 0.3) return false; this.doorWant = this.doorWant ? 0 : 1; this._autoOpen = true; return true; }

  derail(ev, why) {
    this.derailed = true; this.derailWhy = why; this.derailT = 0; this.phase = 'derailed'; this.brakeCmd = 1;
    this.score = Math.max(0, this.score * 0.4); ev.push({ type: 'derail', why, kmh: this.kmh }); return ev;
  }

  grade() {
    if (this.derailed) return 'القطر خرج عن القضبان';
    const sc = this.score;
    return sc >= 380 ? 'ممتاز، سواق محترف' : sc >= 280 ? 'جيد جدًا' : sc >= 180 ? 'جيد' : 'محتاج تدريب أكتر';
  }
}
