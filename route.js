'use strict';
/* Turns a line from data.js into distances along the closed track: station positions,
 * platform lengths, stop marks and level crossings. Real distances are compressed. */
class Route {
  constructor(line, trainLen) {
    this.line = line; this.name = line.name; this.env = line.env;
    const src = line.stations, base = { terminal: 300, major: 250, town: 210, halt: 140 };
    let s = 450; this.stations = [];
    src.forEach((e, i) => {
      if (i > 0) s += U.clamp(900 + (e[1] - src[i - 1][1]) * 40, 2200, 3600);
      const pl = Math.max(base[e[2]] || 200, trainLen + 50);
      this.stations.push({ name: e[0], type: e[2], km: e[1], s, pl, stopS: s + pl / 2 - 12 });
    });
    const span = s - 450;
    this.ret = Math.max(3000, span * 0.2);
    this.Ltarget = s + this.ret;
    this.a = this.Ltarget / 5.32;                  // ellipse half-width that gives this perimeter
    this.scale = Math.max(1, this.a / 2160);        // world is scaled up for long routes
    this.crossings = [];
    for (let i = 0; i + 1 < this.stations.length && this.crossings.length < 14; i++) {
      const g = this.stations[i + 1].s - this.stations[i].s;
      if (g >= 2400) this.crossings.push(this.stations[i].s + g * 0.5);
    }
    this.crossings.push(s + this.ret * 0.5);
    this.L = this.Ltarget;
  }

  /* The spline's real length differs a little from the target, so stretch positions to match. */
  bind(track) {
    const k = track.L / this.Ltarget;
    for (const st of this.stations) { st.s *= k; st.stopS *= k; }
    this.crossings = this.crossings.map((c) => c * k);
    this.L = track.L;
  }
}
