// node tools/make-catalog.js  ->  rewrites catalog.json from data.js (train/sticker prices, mission rewards)
const vm = require('vm'), fs = require('fs'), ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../data.js', 'utf8') + ';this.o={T:TRAIN_TYPES,S:STICKERS,M:MISSIONS,A:ACHIEVEMENTS};', ctx);
const cat = { prices: {}, rewards: {}, gems: {} };
for (const t of ctx.o.T) { if (t.gems) cat.gems['train:' + t.id] = t.gems; else cat.prices['train:' + t.id] = t.price || 0; }
for (const s of ctx.o.S) cat.prices['sticker:' + s.id] = s.price;
for (const m of [...ctx.o.M, ...ctx.o.A]) cat.rewards[m.id] = m.reward;
fs.writeFileSync(__dirname + '/../catalog.json', JSON.stringify(cat, null, 2) + '\n');
console.log(Object.keys(cat.prices).length + ' prices, ' + Object.keys(cat.gems).length + ' gem items, ' + Object.keys(cat.rewards).length + ' rewards');
