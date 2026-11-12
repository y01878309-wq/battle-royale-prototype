'use strict';
/* Firebase connection: anonymous sign-in, Firestore (accounts, wallet, contests) and Realtime Database (online play).
 * The project values live in config.js (QS_FIREBASE); they only identify the project and are not secrets. What protects the data are the rules in
 * firebase/firestore.rules and firebase/database.rules.json, which must be pasted into the Firebase console. */
const FB = {
  cfg: window.QS_FIREBASE || {},
  TZ: 2 * 3600000,            // contests turn over at midnight Cairo time
  ok: false, uid: '', auth: null, db: null, rt: null, error: '', _p: null,

  dayIdx(t) { return Math.floor(((t || Date.now()) + this.TZ) / 86400000); },
  weekIdx(t) { return Math.floor(this.dayIdx(t) / 7); },
  now() { return firebase.firestore.FieldValue.serverTimestamp(); },

  /* Signs in (anonymously, the first time). Resolves true when Firestore can be used, false to play offline. */
  init() {
    if (!this._p) this._p = this._init();
    return this._p;
  },
  async _init() {
    const f = window.firebase;
    if (!f || !f.initializeApp || !f.auth || !f.firestore) { this.error = 'nosdk'; return false; }
    const wait = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
    try {
      if (!f.apps.length) f.initializeApp(this.cfg);
      this.auth = f.auth(); this.db = f.firestore();
      try { this.db.settings({ experimentalAutoDetectLongPolling: true }); } catch (e) { /* already started */ }
      let user = await wait(new Promise((res) => { const un = this.auth.onAuthStateChanged((u) => { un(); res(u); }); }), 6000);
      if (!user) user = (await wait(this.auth.signInAnonymously(), 8000)).user;
      this.uid = user.uid; this.rt = f.database ? f.database() : null; this.ok = true; this.error = '';
      return true;
    } catch (e) { this.error = String((e && e.message) || e); this._p = null; return false; }
  }
};
