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
    this.box.textContent = (kind === 'pa' ? '📢 ' : kind === 'radio' ? '📻 ' : '🎙️ ') + text.replace(/\|/g, ' '); this.box.className = 'caption ' + (kind || 'coach'); this.box.hidden = false;
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
  /* Ambient talk while driving: commentator remarks and control-room radio, every 25 to 50 seconds (needs no internet; the phone's own voice reads it). */
  chatter(s) {
    const now = performance.now(); if (!this.on || Sound.muted) return; if (!this.nextChat) this.nextChat = now + 12000; if (now < this.nextChat) return;
    this.nextChat = now + 25000 + Math.random() * 25000;
    const P = [];
    if (s.kmh > 100) P.push(['coach', 'القطر ماشي ' + this.ar(Math.round(s.kmh)) + ' كيلو في الساعة. سواقة محترمة.'], ['coach', 'السرعة عالية. خلي عينك على الإشارات.']);
    if (s.kmh < 15) P.push(['coach', 'ابدأ بالقوة بالتدريج. القطر تقيل.']);
    if (s.next) P.push(['radio', 'غرفة التحكم لسواق القطر. المحطة الجاية ' + s.next + '. الطريق مفتوح.'], ['coach', 'المحطة الجاية ' + s.next + '. جهّز نفسك للفرملة.']);
    P.push(['radio', 'غرفة الحركة بتنادي القطر. الإشارات مفتوحة قدامك. كمّل بحذر.'], ['radio', 'القطر اللي جاي في الاتجاه التاني عدّى. الخط قدامك فاضي.'], ['coach', 'منظر حلو على الخط النهارده. كمّل.'], ['radio', 'سلامات يا كابتن. مراقبة الخط معاك.'], ['coach', 'فرملة هادية وقت الوقوف بتخلّي الركاب مرتاحين.']);
    const p = P[Math.floor(Math.random() * P.length)]; this.say(p[1], p[0], 'ch' + Math.floor(now));
  },
  tip(text, key) { this.say(text, 'coach', key); }
};
