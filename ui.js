'use strict';
/* Input (keyboard + touch) and the cab HUD. */
const CAMERAS = [['cab', 'داخل الكابينة'], ['chase', 'من ورا'], ['side', 'من جنب السكة'], ['front', 'من قدام']];

class UI {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      menu: $('menu'), hud: $('hud'), result: $('result'), pause: $('pause'), loading: $('loading'), toast: $('toast'),
      speedNum: $('speedNum'), speedBar: $('speedBar'), limitMark: $('limitMark'), limitNum: $('limitNum'), limitSign: $('limitSign'),
      notches: $('notches'), brakeFill: $('brakeFill'), doorState: $('doorState'), nextName: $('nextName'), nextDist: $('nextDist'), nextLabel: $('nextLabel'),
      score: $('score'), clock: $('clock'), camBtn: $('camBtn'), muteBtn: $('muteBtn'), startBtn: $('startBtn'), againBtn: $('againBtn'),
      optTime: $('optTime'), optQuality: $('optQuality'), touchThrottle: $('touchThrottle'), touchBrake: $('touchBrake'), touchHorn: $('touchHorn'),
      resTable: $('resTable'), resGrade: $('resGrade'), resTitle: $('resTitle')
    };
    for (let i = 0; i < 8; i++) this.el.notches.appendChild(document.createElement('i'));
    this.notchEls = [...this.el.notches.children];
    this.input = { notch: 0, brakeHeld: false, emergency: false, horn: false };
    this.handlers = {}; this.toastTimer = 0; this.last = {};
  }

  on(h) { this.handlers = h; this.bind(); }

  bind() {
    const I = this.input, H = this.handlers;
    window.addEventListener('keydown', (e) => {
      if (e.repeat && e.code !== 'KeyW' && e.code !== 'KeyS') return;
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': I.notch = Math.min(8, I.notch + 1); this.el.touchThrottle.value = I.notch; break;
        case 'KeyS': case 'ArrowDown': I.notch = Math.max(0, I.notch - 1); this.el.touchThrottle.value = I.notch; break;
        case 'Space': I.brakeHeld = true; e.preventDefault(); break;
        case 'KeyE': I.emergency = !I.emergency; this.toast(I.emergency ? 'فرملة طوارئ' : 'تم إلغاء الطوارئ', I.emergency ? 'bad' : ''); break;
        case 'KeyH': if (!I.horn) { I.horn = true; H.horn && H.horn(true); } break;
        case 'KeyC': H.camera && H.camera(); break;
        case 'KeyP': H.pause && H.pause(); break;
        case 'KeyM': H.mute && H.mute(); break;
        case 'Digit0': I.notch = 0; this.el.touchThrottle.value = 0; break;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') I.brakeHeld = false;
      if (e.code === 'KeyH') { I.horn = false; H.horn && H.horn(false); }
    });
    const hold = (el, on, off) => { el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); }); for (const t of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(t, off); };
    hold(this.el.touchBrake, () => (I.brakeHeld = true), () => (I.brakeHeld = false));
    hold(this.el.touchHorn, () => { I.horn = true; H.horn && H.horn(true); }, () => { if (I.horn) { I.horn = false; H.horn && H.horn(false); } });
    this.el.touchThrottle.addEventListener('input', () => (I.notch = +this.el.touchThrottle.value));
    this.el.camBtn.addEventListener('click', () => H.camera && H.camera());
    this.el.muteBtn.addEventListener('click', () => H.mute && H.mute());
    this.el.startBtn.addEventListener('click', () => H.start && H.start());
    this.el.againBtn.addEventListener('click', () => H.restart && H.restart());
    document.addEventListener('visibilitychange', () => { if (document.hidden && H.autoPause) H.autoPause(); });
  }

  toast(msg, kind, ms) {
    const t = this.el.toast; t.textContent = msg; t.className = 'toast ' + (kind || ''); t.hidden = false;
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => (t.hidden = true), ms || 3200);
  }

  set(key, el, val) { if (this.last[key] !== val) { this.last[key] = val; el(val); } }

  update(h) {
    const e = this.el;
    this.set('spd', (v) => (e.speedNum.textContent = v), Math.round(h.kmh));
    e.speedBar.style.width = Math.min(100, h.kmh / 140 * 100) + '%';
    this.set('lim', (v) => { e.limitNum.textContent = v; e.limitMark.style.left = (v / 140 * 100) + '%'; }, h.limit);
    e.limitSign.classList.toggle('over', h.over);
    this.set('notch', (v) => this.notchEls.forEach((n, i) => n.classList.toggle('on', i < v)), h.notch);
    e.brakeFill.style.width = Math.round(h.brake * 100) + '%';
    this.set('door', (v) => { e.doorState.textContent = v ? 'الأبواب مفتوحة' : 'الأبواب مقفولة'; e.doorState.classList.toggle('open', v); }, h.doorsOpen);
    this.set('nn', (v) => (e.nextName.textContent = v), h.nextName);
    this.set('nl', (v) => (e.nextLabel.textContent = v), h.nextLabel);
    this.set('nd', (v) => (e.nextDist.textContent = v), h.dist);
    this.set('sc', (v) => (e.score.textContent = v), h.score);
    this.set('clk', (v) => (e.clock.textContent = v), h.clock);
  }

  setCamLabel(txt) { this.el.camBtn.textContent = txt; }
  setMuteLabel(m) { this.el.muteBtn.textContent = m ? 'صامت' : 'صوت'; }

  results(rows, total, grade) {
    const e = this.el;
    e.resTable.innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('') + `<tr><td><b>المجموع</b></td><td>${total}</td></tr>`;
    e.resGrade.textContent = grade; e.result.hidden = false;
  }
}
