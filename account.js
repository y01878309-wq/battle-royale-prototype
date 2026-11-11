'use strict';
/* Player account: name, numeric ID, coins, bought trains, experience and claimed rewards.
 * With a server address configured (config.js or the menu) the account lives on the server (see server/server.js), which is the
 * only place coins can be added or spent, and the owner tops players up by ID from its /admin page.
 * Without a server the account is local to this device: it works, but cannot be topped up and can be edited by the player. */
const Account = {
  d: null, url: '', error: '',

  httpBase() {
    let u = (this.url || '').trim(); if (!u) return '';
    u = u.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:'); if (!/^https?:/i.test(u)) u = 'https://' + u;
    return u.replace(/\/+$/, '');
  },
  get server() { return !!this.httpBase() && !!this.d && !this.d.local; },

  load() { try { const v = JSON.parse(localStorage.getItem('qs-acct') || 'null'); if (v && v.name) this.d = v; } catch (e) { /* no storage */ } return this.d; },
  save() { try { localStorage.setItem('qs-acct', JSON.stringify(this.d)); } catch (e) { /* no storage */ } },

  async call(path, data) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch(this.httpBase() + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data), signal: ctl.signal });
      return { s: r.status, j: await r.json().catch(() => ({})) };
    } catch (e) { return { s: 0, j: { error: 'network' } }; } finally { clearTimeout(t); }
  },
  take(j) { const d = this.d; Object.assign(d, { name: j.name, coins: j.coins, owned: j.owned || [], xp: j.xp || 0, claimed: j.claimed || [] }); if (j.token) d.token = j.token; this.save(); },

  /* Called once at start. Returns false when there is no account yet (the menu then asks for a name). */
  async init(url) {
    this.url = url || ''; this.load(); this.error = '';
    if (!this.d) return false;
    const base = this.httpBase();
    if (base && this.d.local) { await this.register(this.d.name); return true; }   // a server appeared: open the real account
    if (base && this.d.token) {
      const r = await this.call('/api/me', { id: this.d.id, token: this.d.token });
      if (r.s === 200) this.take(r.j); else if (r.s === 401) this.error = 'lost'; else this.error = 'offline';
    }
    return true;
  },

  async register(name) {
    name = String(name || '').trim().slice(0, 16) || 'سواق';
    if (this.httpBase()) {
      const r = await this.call('/api/register', { name });
      if (r.s === 200) { this.d = { id: r.j.id, token: r.j.token, local: false }; this.take(r.j); this.error = ''; return true; }
      this.error = r.s === 429 ? 'limit' : 'offline';
    }
    if (!this.d || !this.d.local) this.d = { id: 'L' + String(Math.floor(10000 + Math.random() * 90000)), name, coins: 50, owned: [], xp: 0, claimed: [], local: true };
    else this.d.name = name;
    this.save(); return false;
  },

  async rename(name) {
    name = String(name || '').trim().slice(0, 16); if (!name) return;
    if (this.server) { const r = await this.call('/api/rename', { id: this.d.id, token: this.d.token, name }); if (r.s === 200) { this.take(r.j); return; } }
    this.d.name = name; this.save();
  },

  owns(t) { return !t.price || this.d.owned.includes('train:' + t.id); },

  /* Buys a train. Returns 'ok' | 'coins' | 'offline'. */
  async buy(t) {
    if (this.owns(t)) return 'ok';
    if (this.server) {
      const r = await this.call('/api/buy', { id: this.d.id, token: this.d.token, item: 'train:' + t.id });
      if (r.s === 200) { this.take(r.j); return 'ok'; } if (r.s === 402) { this.take(r.j); return 'coins'; } return 'offline';
    }
    if (this.d.coins < t.price) return 'coins';
    this.d.coins -= t.price; this.d.owned.push('train:' + t.id); this.save(); return 'ok';
  },

  /* Coins and experience for a finished trip. Returns the coins actually paid. */
  async trip(coins, xp) {
    const before = this.d.coins;
    if (this.server) { const r = await this.call('/api/trip', { id: this.d.id, token: this.d.token, coins, xp }); if (r.s === 200 || r.s === 429) this.take(r.j); return this.d.coins - before; }
    this.d.coins += coins; this.d.xp = (this.d.xp || 0) + xp; this.save(); return coins;
  },

  /* Claims a finished mission (key 'id@day') or achievement (key 'id'). */
  async claim(key, reward) {
    if (this.d.claimed.includes(key)) return false;
    if (this.server) { const r = await this.call('/api/claim', { id: this.d.id, token: this.d.token, key }); if (r.s === 200) { this.take(r.j); return true; } return false; }
    this.d.claimed.push(key); this.d.coins += reward; this.save(); return true;
  }
};
