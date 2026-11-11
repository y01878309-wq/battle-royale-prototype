'use strict';
/* In-game commentary (caption + Arabic voice when the browser has one) and station announcements. */
const Commentary = {
  on: true, last: 0, queue: 0,
  init() { try { this.on = localStorage.getItem('qs-comm') !== '0'; } catch (e) { /* no storage */ } this.box = document.getElementById('caption'); },
  toggle() { this.on = !this.on; try { localStorage.setItem('qs-comm', this.on ? '1' : '0'); } catch (e) { /* */ } if (!this.on && this.box) this.box.hidden = true; return this.on; },
  /* kind: 'pa' station announcer, 'coach' tips from the instructor; key avoids repeating the same line. */
  say(text, kind, key) {
    if (!this.on || !this.box) return;
    const now = performance.now(); if (key && this._key === key && now - this.last < 20000) return;
    this._key = key; this.last = now;
    this.box.textContent = (kind === 'pa' ? '📢 ' : '🎙️ ') + text; this.box.className = 'caption ' + (kind || 'coach'); this.box.hidden = false;
    clearTimeout(this._t); this._t = setTimeout(() => { this.box.hidden = true; }, Math.min(9000, 2500 + text.length * 70));
    if (!Sound.muted) Sound.speak(text);
  },
  arriving(st, line, trainName) { this.say('السادة الركاب، قطر ' + trainName + ' يصل بعد قليل إلى محطة ' + st.name + '. برجاء الابتعاد عن حافة الرصيف.', 'pa', 'arr' + st.name); },
  depart(next) { this.say('نرجو من السادة الركاب الصعود. القطر متجه إلى ' + next + '. أغلق الأبواب وتحرك عند الإشارة الخضراء.', 'pa', 'dep' + next); },
  tip(text, key) { this.say(text, 'coach', key); }
};
