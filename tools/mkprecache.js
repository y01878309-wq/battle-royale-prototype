// node tools/mkprecache.js  -> writes precache.json (list of files the service worker keeps for offline play)
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..'), out = [];
const walk = (d) => { for (const f of fs.readdirSync(path.join(root, d))) { const p = d ? d + '/' + f : f, s = fs.statSync(path.join(root, p)); if (s.isDirectory()) { if (!/^(tools|firebase|node_modules|\.git)$/.test(f)) walk(p); } else if (!/^(admin\.html|README\.md|package\.json|vercel\.json|catalog\.json|precache\.json|sw\.js)$/.test(f)) out.push(p); } };
walk('');
fs.writeFileSync(path.join(root, 'precache.json'), JSON.stringify({ core: out.filter((f) => /\.(js|css|html|json|webmanifest)$/.test(f) && !/^models\//.test(f)), assets: out.filter((f) => !/\.(js|css|html|json)$/.test(f) || /^models\//.test(f)) }));
console.log(out.length, 'files');
