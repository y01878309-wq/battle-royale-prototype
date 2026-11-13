'use strict';
/* Player account: name, numeric ID, coins, bought trains, experience and claimed rewards.
 * With Firebase reachable the account lives in Firestore (players/{ID}); the security rules in firebase/firestore.rules are the
 * only thing that decides what a player may change, and the owner tops players up by ID from admin.html.
 * Without Firebase (offline, or the SDK blocked) the account is local to this device: it works, but cannot be topped up. */
const Account = {
  d: null, error: '',

  get server() { return !!FB.ok && !!this.d && !this.d.local; },

  load() { try { const v = JSON.parse(localStorage.getItem('qs-acct') || 'null'); if (v && v.name) this.d = v; } catch (e) { /* no storage */ } return this.d; },
  save() { try { localStorage.setItem('qs-acct', JSON.stringify(this.d)); } catch (e) { /* no storage */ } },

  col(n) { return FB.db.collection(n); },
  pref(id) { return FB.db.collection('players').doc(String(id || this.d.id)); },
  code10(rec) { return String(rec || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); },
  take(j) {
    const d = this.d;
    Object.assign(d, { name: j.name, coins: j.coins || 0, gems: j.gems || 0, owned: j.owned || [], xp: j.xp || 0, claimed: j.claimed || [], rec: j.rec || d.rec || '', contact: j.contact || '', earnedDay: j.earnedDay || 0, earnedSum: j.earnedSum || 0 });
    this.save();
  },
  /* Reload the player's document from Firestore. */
  async refresh() { const s = await this.pref().get(); if (s.exists) this.take(s.data()); return s.exists; },

  /* Called once at start. Returns false when there is no account yet (the menu then asks for a name). */
  async init() {
    this.load(); this.error = '';
    await FB.init();
    if (!FB.ok) { this.error = 'offline'; return !!this.d; }
    try {
      let snap = null;
      if (this.d && !this.d.local && this.d.id) { try { const s = await this.pref(this.d.id).get(); if (s.exists) snap = s; } catch (e) { /* not ours any more: look it up below */ } }
      if (!snap) { const q = await this.col('players').where('owner', '==', FB.uid).limit(1).get(); if (!q.empty) snap = q.docs[0]; }
      if (snap) { this.d = { id: snap.id, local: false }; this.take(snap.data()); return true; }
    } catch (e) { this.error = 'offline'; return !!this.d; }
    if (this.d && this.d.local) { await this.register(this.d.name); return true; }   // Firebase appeared: open the real account
    if (this.d) { this.error = 'lost'; this.d = null; try { localStorage.removeItem('qs-acct'); } catch (e) { /* */ } }
    return false;
  },

  makeRec() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 10; i++) r += A[Math.floor(Math.random() * A.length)]; return r.slice(0, 5) + '-' + r.slice(5); },

  async register(name) {
    name = String(name || '').trim().slice(0, 16) || 'سواق';
    if (await FB.init()) {
      for (let i = 0; i < 8; i++) {
        const id = String(Math.floor(100000 + Math.random() * 900000)), rec = this.makeRec(), pref = this.pref(id), rrf = this.col('recov').doc(this.code10(rec));
        const doc = { owner: FB.uid, name, coins: 50, gems: 0, xp: 0, owned: [], claimed: [], rec, contact: '', earnedDay: 0, earnedSum: 0, lastEarn: FB.now() };
        try {
          await FB.db.runTransaction(async (tx) => { const s = await tx.get(pref); if (s.exists) throw new Error('taken'); tx.set(pref, doc); tx.set(rrf, { pid: id }); });
          this.d = { id, local: false }; this.take({ name, coins: 50, gems: 0, xp: 0, owned: [], claimed: [], rec, contact: '', earnedDay: 0, earnedSum: 0 }); this.error = ''; return true;
        } catch (e) { if (!/taken/.test(String(e && e.message))) { this.error = (e && e.code) === 'permission-denied' ? 'rules' : 'offline'; break; } }
      }
    } else this.error = 'offline';
    if (!this.d || !this.d.local) this.d = { id: 'L' + String(Math.floor(10000 + Math.random() * 90000)), name, coins: 50, gems: 0, owned: [], xp: 0, claimed: [], local: true, rec: Account.makeRec(), contact: '' };
    else this.d.name = name;
    this.save(); return false;
  },

  async rename(name) {
    name = String(name || '').trim().slice(0, 16); if (!name) return;
    if (this.server) { try { await this.pref().update({ name }); this.d.name = name; this.save(); return; } catch (e) { /* offline: keep it local below */ } }
    this.d.name = name; this.save();
  },

  /* Another device: get the account back with its recovery code. Returns 'ok' | 'wrong' | 'offline' | 'noserver'. */
  async recover(code) {
    if (!(await FB.init())) return 'noserver';
    const c = this.code10(code); if (c.length !== 10) return 'wrong';
    try {
      const r = await this.col('recov').doc(c).get(); if (!r.exists) return 'wrong';
      const pid = r.data().pid, nrec = this.makeRec(), old = this.d && !this.d.local ? this.d : null;
      const b = FB.db.batch();
      b.update(this.pref(pid), { owner: FB.uid, xfer: c, rec: nrec });
      b.delete(r.ref); b.set(this.col('recov').doc(this.code10(nrec)), { pid });
      await b.commit();
      if (old && old.id !== pid && (old.coins || 0) <= 50 && !(old.xp || 0)) {   // the empty account this phone had just made is no longer needed
        try { const o = FB.db.batch(); o.delete(this.pref(old.id)); o.delete(this.col('recov').doc(this.code10(old.rec))); await o.commit(); } catch (e) { /* harmless leftovers */ }
      }
      this.d = { id: pid, local: false }; const s = await this.pref(pid).get(); this.take(s.data()); return 'ok';
    } catch (e) { return e && e.code === 'permission-denied' ? 'wrong' : 'offline'; }
  },
  async setContact(c) {
    c = String(c || '').trim().slice(0, 60);
    if (this.server) { try { await this.pref().update({ contact: c }); this.d.contact = c; this.save(); return true; } catch (e) { return false; } }
    this.d.contact = c; this.save(); return true;
  },

  /* A gift code. Returns { ok, coins } or { ok: false, why: 'invalid' | 'used' | 'offline' | 'noserver' }. */
  async gift(code) {
    if (!this.server) return { ok: false, why: 'noserver' };
    code = String(code || '').trim().toUpperCase().slice(0, 24); if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return { ok: false, why: 'invalid' };
    const gref = this.col('gifts').doc(code), pref = this.pref(), pid = this.d.id; let got = 0;
    try {
      await FB.db.runTransaction(async (tx) => {
        const g = await tx.get(gref); if (!g.exists) throw new Error('invalid');
        const gd = g.data(); if ((gd.used || []).length >= gd.max) throw new Error('invalid'); if ((gd.used || []).includes(pid)) throw new Error('used');
        const p = await tx.get(pref); got = gd.coins;
        tx.update(pref, { coins: p.data().coins + gd.coins, lastGift: code }); tx.update(gref, { used: [...gd.used, pid] });
      });
    } catch (e) { const m = String((e && e.message) || ''); return { ok: false, why: /used/.test(m) ? 'used' : (e && e.code === 'permission-denied') || /invalid/.test(m) ? 'invalid' : 'offline' }; }
    await this.refresh().catch(() => {}); return { ok: true, coins: got };
  },

  /* The contests: from Firestore when online, otherwise only this player's own numbers on this device. */
  async contests() {
    if (!this.server) return { online: false, list: null };
    const TZ = FB.TZ, day = FB.dayIdx(), wk = FB.weekIdx(), dEnd = (day + 1) * 86400000 - TZ, wEnd = (wk + 1) * 7 * 86400000 - TZ;
    try {
      const out = [];
      for (const [id, key, end] of [['daily', 'daily-' + day, dEnd], ['score', 'score-' + day, dEnd], ['marathon', 'marathon-' + wk, wEnd]]) {
        const [qs, rs] = await Promise.all([this.col('board').doc(key).collection('rows').orderBy('v', 'desc').limit(25).get(), this.col('results').doc(id).get()]);
        const rows = qs.docs.map((x) => Object.assign({ pid: x.id }, x.data())), i = rows.findIndex((r) => r.pid === this.d.id);
        out.push({ id, endsAt: end, top: rows.slice(0, 10).map((r) => ({ n: r.n, v: Math.round(r.v) })), count: rows.length, me: i < 0 ? null : { rank: i + 1, v: Math.round(rows[i].v) }, last: rs.exists ? (rs.data().rows || []) : [] });
      }
      return { online: true, list: out };
    } catch (e) { return { online: false, list: null }; }
  },

  owns(t) { return isFree(t) || this.d.owned.includes('train:' + t.id); },

  /* Buys a train (game coins, or gems for the gem-only trains). Returns 'ok' | 'coins' | 'gems' | 'offline'. */
  async buy(t) {
    if (this.owns(t)) return 'ok';
    if (this.server) {
      const item = 'train:' + t.id, pref = this.pref();
      try {
        const r = await FB.db.runTransaction(async (tx) => {
          const p = (await tx.get(pref)).data(); if (p.owned.includes(item)) return 'ok';
          if (t.gems) { if ((p.gems || 0) < t.gems) return 'gems'; tx.update(pref, { gems: (p.gems || 0) - t.gems, owned: [...p.owned, item] }); return 'ok'; }
          if (p.coins < t.price) return 'coins';
          tx.update(pref, { coins: p.coins - t.price, owned: [...p.owned, item] }); return 'ok';
        });
        await this.refresh().catch(() => {}); return r;
      } catch (e) { return 'offline'; }
    }
    if (t.gems) return (this.d.gems || 0) < t.gems ? 'gems' : 'offline';
    if (this.d.coins < t.price) return 'coins';
    this.d.coins -= t.price; this.d.owned.push('train:' + t.id); this.save(); return 'ok';
  },

  /* Coins and experience for a finished trip. Also records the trip in today's contests. Returns the coins actually paid. */
  async trip(coins, xp, extra) {
    const before = this.d.coins; extra = extra || {};
    const cl = (v, m) => Math.max(0, Math.min(m, Math.floor(+v || 0)));
    if (this.server) {
      coins = cl(coins, 400); xp = cl(xp, 500);
      const day = FB.dayIdx(), wk = FB.weekIdx(), pid = this.d.id, pref = this.pref(), board = (k) => this.col('board').doc(k).collection('rows').doc(pid);
      const rd = board('daily-' + day), rs = board('score-' + day), rm = board('marathon-' + wk);
      try {
        await FB.db.runTransaction(async (tx) => {
          const p = (await tx.get(pref)).data(), s0 = await tx.get(rs), m0 = await tx.get(rm);
          const base = p.earnedDay === day ? p.earnedSum : 0, gain = Math.max(0, Math.min(coins, 3000 - base)), sum = base + gain;
          tx.update(pref, { coins: p.coins + gain, xp: (p.xp || 0) + xp, earnedDay: day, earnedSum: sum, lastEarn: FB.now() });
          tx.set(rd, { n: p.name, v: sum, owner: FB.uid });
          tx.set(rs, { n: p.name, v: Math.max(s0.exists ? s0.data().v : 0, cl(extra.score, 2000)), owner: FB.uid });
          tx.set(rm, { n: p.name, v: Math.min(6000, (m0.exists ? m0.data().v : 0) + cl(extra.km, 800)), owner: FB.uid });
        });
      } catch (e) { /* too soon after the last trip, or offline: nothing is paid, like a refused request */ }
      await this.refresh().catch(() => {}); return this.d.coins - before;
    }
    this.d.coins += coins; this.d.xp = (this.d.xp || 0) + xp; this.save(); return coins;
  },

  /* Claims a finished mission (key 'id@day') or achievement (key 'id'). */
  async claim(key, reward) {
    if (this.d.claimed.includes(key)) return false;
    if (this.server) {
      const pref = this.pref();
      try {
        const ok = await FB.db.runTransaction(async (tx) => {
          const p = (await tx.get(pref)).data(); if (p.claimed.includes(key)) return false;
          tx.update(pref, { claimed: [...p.claimed, key], coins: p.coins + reward }); return true;
        });
        await this.refresh().catch(() => {}); return ok;
      } catch (e) { return false; }
    }
    this.d.claimed.push(key); this.d.coins += reward; this.save(); return true;
  }
};
