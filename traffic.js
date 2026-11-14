'use strict';
/* Other trains running on the second track, in the opposite direction. They never stop; they are only there for the feeling of a busy line. */
class Traffic {
  constructor(scene, track, quality) {
    this.track = track; this.list = []; this.t = 0;
    const n = quality === 'high' ? 3 : quality === 'medium' ? 2 : 1, ids = ['orange', 'talgo', 'third', 'dmu', 'bluecom', 'emuyellow', 'freight', 'cargo-cont', 'hitachi', 'vip', 'sleeper', 'g22', 'es40-white', 'marlboro', 'alstom', 'de2550', 'turbine'], R = U.rng(4242);
    for (let i = 0; i < n; i++) {
      const type = TRAIN_TYPES.find((x) => x.id === ids[Math.floor(R() * ids.length)]) || TRAIN_TYPES[0], train = new Train(scene, track, 'low', type, true);
      train.rev = true; train.lat = TRACK_SP * (1 + (NTRACKS > 2 ? i % (NTRACKS - 1) : 0));
      this.list.push({ train, s: (i + 0.5) / n * track.L, v: 16 + R() * 14, shown: true, len: train.vehicles.reduce((a, v) => a + v.len, 0) });
    }
  }

  /* sPlayer: the player's position on the line. Trains far away are only moved, not drawn. */
  update(dt, sPlayer, time) {
    const L = this.track.L;
    for (const o of this.list) {
      o.s = ((o.s - o.v * dt) % L + L) % L;
      const d = Math.abs(((o.s - sPlayer + L / 2) % L + L) % L - L / 2), near = d < 900;
      if (near !== o.shown) { o.shown = near; for (const v of o.train.vehicles) { v.body.visible = near; for (const b of v.bogies) b.g.visible = near; } }
      if (near) { o.train.place(o.s, time, o.v, 0); o.train.spin(o.v * dt); }
    }
  }
}
