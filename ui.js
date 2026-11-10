'use strict';
/* Input (keyboard, mouse, touch) and the HUD. */
const CAMERAS = [['cab', 'داخل الكابينة'], ['chase', 'من ورا'], ['top', 'من فوق'], ['front', 'من قدام'], ['side', 'من جنب السكة']];

class UI {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.$ = $;
    this.el = {
      menu: $('menu'), hud: $('hud'), result: $('result'), pause: $('pause'), loading: $('loading'), toast: $('toast'), help: $('help'),
      speedNum: $('speedNum'), speedBar: $('speedBar'), limitMark: $('limitMark'), limitNum: $('limitNum'), limitSign: $('limitSign'),
      notches: $('notches'), brakeFill: $('brakeFill'), doorState: $('doorState'), nextName: $('nextName'), nextDist: $('nextDist'), nextLabel: $('nextLabel'),
      score: $('score'), clock: $('clock'), camBtn: $('camBtn'), muteBtn: $('muteBtn'), helpBtn: $('helpBtn'), helpClose: $('helpClose'),
      startBtn: $('startBtn'), againBtn: $('againBtn'), optLine: $('optLine'), optTrain: $('optTrain'), optTime: $('optTime'), optQuality: $('optQuality'), optOnline: $('optOnline'), optName: $('optName'), optServer: $('optServer'), netBox: $('netBox'), trainDesc: $('trainDesc'),
      btnUp: $('btnUp'), btnDown: $('btnDown'), btnBrake: $('btnBrake'), btnHorn: $('btnHorn'), btnEmerg: $('btnEmerg'),
      resTable: $('resTable'), resGrade: $('resGrade'), resTitle: $('resTitle'), resEyebrow: $('resEyebrow')
    };
    for (let i = 0; i < 8; i++) this.el.notches.appendChild(document.createElement('i'));
    this.notchEls = [...this.el.notches.children];
    this.input = { notch: 0, brakeHeld: false, emergency: false, horn: false };
    this.handlers = {}; this.toastTimer = 0; this.last = {};
  }

  on(h) { this.handlers = h; this.bind(); }

  setNotch(n) { this.input.notch = U.clamp(n, 0, 8); }

  bind() {
    const I = this.input, H = this.handlers, e = this.el;
    const horn = (on) => { if (I.horn !== on) { I.horn = on; H.horn && H.horn(on); e.btnHorn.classList.toggle('on', on); } };
    const emerg = (on) => { I.emergency = on; e.btnEmerg.classList.toggle('on', on); if (on) this.toast('فرملة طوارئ', 'bad', 1800); };
    window.addEventListener('keydown', (ev) => {
      if (ev.repeat && ev.code !== 'KeyW' && ev.code !== 'KeyS' && ev.code !== 'ArrowUp' && ev.code !== 'ArrowDown') return;
      switch (ev.code) {
        case 'KeyW': case 'ArrowUp': this.setNotch(I.notch + 1); ev.preventDefault(); break;
        case 'KeyS': case 'ArrowDown': this.setNotch(I.notch - 1); ev.preventDefault(); break;
        case 'Space': I.brakeHeld = true; e.btnBrake.classList.add('on'); ev.preventDefault(); break;
        case 'KeyE': emerg(!I.emergency); break;
        case 'KeyH': horn(true); break;
        case 'KeyC': H.camera && H.camera(); break;
        case 'KeyV': H.resetCam && H.resetCam(); break;
        case 'KeyP': H.pause && H.pause(); break;
        case 'KeyM': H.mute && H.mute(); break;
        case 'KeyK': this.toggleHelp(); break;
        case 'Digit0': this.setNotch(0); break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': H.camera && H.camera(+ev.code.slice(5) - 1); break;
      }
    });
    window.addEventListener('keyup', (ev) => {
      if (ev.code === 'Space') { I.brakeHeld = false; e.btnBrake.classList.remove('on'); }
      if (ev.code === 'KeyH') horn(false);
    });
    const hold = (el, on, off) => { el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); el.setPointerCapture && el.setPointerCapture(ev.pointerId); on(); }); for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, off); };
    hold(e.btnBrake, () => { I.brakeHeld = true; e.btnBrake.classList.add('on'); }, () => { I.brakeHeld = false; e.btnBrake.classList.remove('on'); });
    hold(e.btnHorn, () => horn(true), () => horn(false));
    e.btnEmerg.addEventListener('click', () => emerg(!I.emergency));
    e.btnUp.addEventListener('click', () => this.setNotch(I.notch + 1));
    e.btnDown.addEventListener('click', () => this.setNotch(I.notch - 1));
    this.notchEls.forEach((n, i) => n.addEventListener('click', () => this.setNotch(I.notch === i + 1 ? i : i + 1)));
    e.camBtn.addEventListener('click', () => H.camera && H.camera());
    e.muteBtn.addEventListener('click', () => H.mute && H.mute());
    e.helpBtn.addEventListener('click', () => this.toggleHelp());
    e.helpClose.addEventListener('click', () => this.toggleHelp());
    e.startBtn.addEventListener('click', () => H.start && H.start());
    e.againBtn.addEventListener('click', () => H.restart && H.restart());
    document.addEventListener('visibilitychange', () => { if (document.hidden && H.autoPause) H.autoPause(); });
  }

  toggleHelp() { this.el.help.hidden = !this.el.help.hidden; }

  toast(msg, kind, ms) {
    const t = this.el.toast; t.textContent = msg; t.className = 'toast ' + (kind || ''); t.hidden = false;
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => (t.hidden = true), ms || 3200);
  }

  set(key, fn, val) { if (this.last[key] !== val) { this.last[key] = val; fn(val); } }

  update(h) {
    const e = this.el;
    this.set('spd', (v) => (e.speedNum.textContent = v), Math.round(h.kmh));
    e.speedBar.style.width = Math.min(100, h.kmh / h.vmax * 100) + '%';
    this.set('lim', (v) => { e.limitNum.textContent = v; e.limitMark.style.left = (v / h.vmax * 100) + '%'; }, h.limit);
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

  results(rows, total, grade, title) {
    const e = this.el;
    e.resTitle.textContent = title || 'الرحلة خلصت';
    e.resTable.innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('') + `<tr><td><b>المجموع</b></td><td>${total}</td></tr>`;
    e.resGrade.textContent = grade; e.result.hidden = false;
  }
}
