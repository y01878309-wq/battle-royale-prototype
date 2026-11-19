'use strict';
/* In-game commentary (caption + Arabic voice when the browser has one) and station announcements. */
const Commentary = {
  on: true, last: 0, queue: 0,
  init() { try { this.on = localStorage.getItem('qs-comm') !== '0'; } catch (e) { /* no storage */ } this.box = document.getElementById('caption'); },
  toggle() { this.on = !this.on; try { localStorage.setItem('qs-comm', this.on ? '1' : '0'); } catch (e) { /* */ } if (!this.on && this.box) this.box.hidden = true; return this.on; },
  /* kind: 'pa' station announcer, 'coach' tips from the instructor; key avoids repeating the same line. */
  say(text, kind, key) {
    if (!this.on || !this.box || (typeof Settings !== 'undefined' && Settings.remote && Settings.remote.commentary === false)) return;
    const now = performance.now(); if (key && this._key === key && now - this.last < 20000) return;
    this._key = key; this.last = now;
    this.box.textContent = (kind === 'pa' ? '📢 ' : '🎙️ ') + text.replace(/\|/g, ' '); this.box.className = 'caption ' + (kind || 'coach'); this.box.hidden = false;
    clearTimeout(this._t); this._t = setTimeout(() => { this.box.hidden = true; }, Math.min(9000, 2500 + text.length * 70));   // (a | in the text only marks where the voice is cut into pieces it can keep for offline play)
    if (!Sound.muted) Sound.speak(text);
  },
  /* Arabic-Indic digits, so the Arabic voice reads the number as a number. */
  ar(n) { return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]); },
  /* A stable train number per train type and line, e.g. 1012 or 2612. */
  trainNo(type, line) { if (type && type.loco && type.loco.num && /^[٠-٩0-9]+$/.test(type.loco.num)) return type.loco.num; let h = 0; for (const ch of String(type && type.id) + String(line && line.id)) h = (h * 31 + ch.charCodeAt(0)) % 9000; return this.ar(1000 + h); },
  arriving(st, line, type, eta, last) {
    const no = this.trainNo(type, line), m = eta > 75 ? 'بعد حوالي ' + this.ar(Math.round(eta / 60)) + ' دقيقة' : 'بعد حوالي ' + this.ar(Math.max(10, Math.round(eta / 5) * 5)) + ' ثانية';
    this.say('السلام عليكم يا سادة الركاب. نرجو التوجه إلى رصيف المحطة.|قطار رقم ' + no + (last ? '|المتجه إلى ' + last : '') + '|يصل إلى محطة ' + st.name + '|' + m + '.|برجاء الابتعاد عن حافة الرصيف.', 'pa', 'arr' + st.name);
  },
  depart(next, type, line, secs, last) {
    const no = this.trainNo(type, line);
    this.say('السلام عليكم يا سادة الركاب. نرجو التوجه إلى|قطار رقم ' + no + '|المتجه إلى ' + (last || next) + '|وسيتحرك خلال ' + this.ar(secs || 10) + ' ثوانٍ.|برجاء الصعود وعدم الوقوف عند الأبواب.', 'pa', 'dep' + next);
  },
  /* While online: fetch the pieces of speech this trip will need, so the voice also works with no internet next time. */
  warm(names, nos) {
    if (!navigator.onLine || typeof Sound === 'undefined') return; const p = ['السلام عليكم يا سادة الركاب.', 'نرجو التوجه إلى رصيف المحطة.', 'نرجو التوجه إلى', 'برجاء الابتعاد عن حافة الرصيف.', 'برجاء الصعود وعدم الوقوف عند الأبواب.', 'وسيتحرك خلال ' + this.ar(10) + ' ثوانٍ.', 'وقفة مظبوطة!', 'وقفة ممتازة', 'وقفة كويسة', 'وقفت قبل العلامة', 'عديت العلامة', 'الأبواب مفتوحة، متتحركش.', 'انتبه، السرعة أعلى من المسموح. خفّف القوة.'];
    for (const n of nos || []) p.push('قطار رقم ' + n); for (let m = 1; m <= 9; m++) p.push('بعد حوالي ' + this.ar(m) + ' دقيقة'); for (let s = 10; s <= 70; s += 5) p.push('بعد حوالي ' + this.ar(s) + ' ثانية');
    for (const n of names || []) { p.push('وصلنا محطة ' + n); p.push('يصل إلى محطة ' + n); p.push('المتجه إلى ' + n); }
    Sound.warmVoice(p);
  },
  tip(text, key) { this.say(text, 'coach', key); }
};
