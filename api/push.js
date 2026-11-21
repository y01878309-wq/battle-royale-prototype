// Vercel function: POST /api/push  { key, title, body, subs:[{endpoint,p256dh,auth}] }  -> sends a Web Push to every phone in subs.
// Vercel environment variables needed: VAPID_PRIVATE (private key) and PUSH_KEY (the secret typed in the admin page). Optional: PUSH_SUB (contact URL for the push services).
const crypto = require('crypto');
const PUB = 'BGJX4qrYDfhWxNPjAw-75xaGP3GOM_Z4LqkHQYjV11qAb45r9vUFX4bunjlPY_OCFvFS8ByMHzM58fwm2Hy8PsA', X = 'YlfiqtgN-FbE0-MDD7vnFoY_cY4z9nguqQdBiNXXWoA', Y = 'b45r9vUFX4bunjlPY_OCFvFS8ByMHzM58fwm2Hy8PsA';
const b64 = (b) => Buffer.from(b).toString('base64url');

function jwt(aud) {
  const head = b64(JSON.stringify({ typ: 'JWT', alg: 'ES256' })), body = b64(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: process.env.PUSH_SUB || 'https://qitarat-misr.firebaseapp.com' }));
  const key = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: process.env.VAPID_PRIVATE, x: X, y: Y }, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key, dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64(sig);
}
/* RFC 8291 (aes128gcm) payload encryption */
function encrypt(sub, text) {
  const ua = Buffer.from(sub.p256dh, 'base64url'), auth = Buffer.from(sub.auth, 'base64url');
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys(); const asPub = ecdh.getPublicKey(), secret = ecdh.computeSecret(ua);
  const prk = Buffer.from(crypto.hkdfSync('sha256', secret, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub]), 32));
  const salt = crypto.randomBytes(16), cek = Buffer.from(crypto.hkdfSync('sha256', prk, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16)), nonce = Buffer.from(crypto.hkdfSync('sha256', prk, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce), enc = Buffer.concat([c.update(Buffer.concat([Buffer.from(text), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, enc]);
}
async function send(sub, payload) {
  const aud = new URL(sub.endpoint).origin;
  const r = await fetch(sub.endpoint, { method: 'POST', headers: { Authorization: 'vapid t=' + jwt(aud) + ', k=' + PUB, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal' }, body: encrypt(sub, payload) });
  return r.status;
}
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'content-type'); res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!process.env.VAPID_PRIVATE || !process.env.PUSH_KEY) { res.status(500).json({ error: 'missing env VAPID_PRIVATE / PUSH_KEY on Vercel' }); return; }
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (b.key !== process.env.PUSH_KEY) { res.status(403).json({ error: 'wrong key' }); return; }
  const subs = Array.isArray(b.subs) ? b.subs.slice(0, 200) : [], payload = JSON.stringify({ title: String(b.title || 'قطارات مصر').slice(0, 80), body: String(b.body || '').slice(0, 240), url: './' });
  let ok = 0; const dead = [], bad = [];
  await Promise.all(subs.map(async (s) => { try { const st = await send(s, payload); if (st >= 200 && st < 300) ok++; else if (st === 404 || st === 410) dead.push(s.endpoint); else bad.push(st); } catch (e) { bad.push(String(e.message).slice(0, 60)); } }));
  res.status(200).json({ ok, dead, failed: bad.length, why: bad.slice(0, 3) });
};
module.exports._encrypt = encrypt;
