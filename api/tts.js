// Vercel function: /api/tts?q=<arabic text>  ->  mp3 (a same-origin copy of the speech so the game can keep it for offline play).
module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || '').slice(0, 200);
  if (!q.trim()) { res.status(400).end('missing q'); return; }
  try {
    const r = await fetch('https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ar&q=' + encodeURIComponent(q), { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', Referer: 'https://translate.google.com/' } });
    if (!r.ok) { res.status(502).end('tts failed'); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg'); res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); res.status(200).end(buf);
  } catch (e) { res.status(502).end('tts error'); }
};
