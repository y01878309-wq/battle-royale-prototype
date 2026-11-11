'use strict';
/* Input (keyboard, mouse, touch) and the HUD. */
const CAMERAS = [['cab', 'داخل الكابينة'], ['chase', 'من ورا'], ['top', 'من فوق'], ['front', 'من قدام'], ['side', 'من جنب السكة']];

class UI {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.$ = $;
    this.rh = {}; for (const k of ['rhNext','rhDist','rhName','rhTimes','rhNow','rhPause','rhBack','rhSalary','rhFines','rhPax','rhRoute','rhTitle','rhLine','rhHorn','rhDoor','rhDial','rhLimit','rhNextLim','rhSigD','rhBrakeDial','rhBrakeBtn','rhEmerg','rhLever','rhKnob','rhPow','rhToggle']) this.rh[k] = $(k);
    this.el = {
      menu: $('menu'), hud: $('hud'), result: $('result'), pause: $('pause'), loading: $('loading'), toast: $('toast'), help: $('help'),
      speedNum: $('speedNum'), speedBar: $('speedBar'), limitMark: $('limitMark'), limitNum: $('limitNum'), limitSign: $('limitSign'),
      notches: $('notches'), brakeFill: $('brakeFill'), doorState: $('doorState'), nextName: $('nextName'), nextDist: $('nextDist'), nextLabel: $('nextLabel'),
      score: $('score'), clock: $('clock'), camBtn: $('camBtn'), muteBtn: $('muteBtn'), helpBtn: $('helpBtn'), helpClose: $('helpClose'),
      startBtn: $('startBtn'), againBtn: $('againBtn'), optLine: $('optLine'), optTrain: $('optTrain'), optTime: $('optTime'), optQuality: $('optQuality'), optOnline: $('optOnline'), optName: $('optName'), optServer: $('optServer'), netBox: $('netBox'), trainDesc: $('trainDesc'),
      btnUp: $('btnUp'), btnDown: $('btnDown'), btnBrake: $('btnBrake'), btnHorn: $('btnHorn'), btnDoor: $('btnDoor'), btnEmerg: $('btnEmerg'),
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
    this.api = {};
    const emerg = (on) => { I.emergency = on; e.btnEmerg.classList.toggle('on', on); if (on) this.toast('فرملة طوارئ', 'bad', 1800); };
    this.api.horn = horn; this.api.emerg = emerg;
    window.addEventListener('keydown', (ev) => {
      if (ev.repeat && ev.code !== 'KeyW' && ev.code !== 'KeyS' && ev.code !== 'ArrowUp' && ev.code !== 'ArrowDown') return;
      switch (ev.code) {
        case 'KeyW': case 'ArrowUp': this.setNotch(I.notch + 1); ev.preventDefault(); break;
        case 'KeyS': case 'ArrowDown': this.setNotch(I.notch - 1); ev.preventDefault(); break;
        case 'Space': I.brakeHeld = true; e.btnBrake.classList.add('on'); ev.preventDefault(); break;
        case 'KeyE': emerg(!I.emergency); break;
        case 'KeyH': horn(true); break;
        case 'KeyU': this.cycleHud(); break;
        case 'KeyN': H.comm && H.comm(); break;
        case 'KeyO': H.doors && H.doors(); break;
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
    const r = this.rh;
    hold(r.rhBrakeBtn, () => { I.brakeHeld = true; r.rhBrakeBtn.classList.add('on'); }, () => { I.brakeHeld = false; r.rhBrakeBtn.classList.remove('on'); });
    hold(r.rhHorn, () => horn(true), () => horn(false));
    r.rhEmerg.addEventListener('click', () => emerg(!I.emergency));
    r.rhDoor.addEventListener('click', () => H.doors && H.doors());
    r.rhPause.addEventListener('click', () => H.pause && H.pause());
    r.rhBack.addEventListener('click', () => H.camera && H.camera());
    r.rhToggle.addEventListener('click', () => this.cycleHud());
    const lv = (ev) => { const b = r.rhLever.getBoundingClientRect(); this.setNotch(Math.round((1 - (ev.clientY - b.top) / b.height) * 8)); };
    let drag = false; r.rhLever.addEventListener('pointerdown', (ev) => { drag = true; r.rhLever.setPointerCapture && r.rhLever.setPointerCapture(ev.pointerId); lv(ev); ev.preventDefault(); });
    r.rhLever.addEventListener('pointermove', (ev) => { if (drag) lv(ev); }); r.rhLever.addEventListener('pointerup', () => { drag = false; });
    this.hudMode = 0; try { this.hudMode = +localStorage.getItem('qs-hud') || 0; } catch (err) { /* */ } this.applyHud();
    e.btnDoor.addEventListener('click', () => H.doors && H.doors());
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

  /* 0 = full HUD like the reference, 1 = hidden (only the toggle stays) */
  cycleHud() { this.hudMode = this.hudMode ? 0 : 1; try { localStorage.setItem('qs-hud', String(this.hudMode)); } catch (e) { /* */ } this.applyHud(); }
  applyHud() { this.el.hud.classList.toggle('rh-off', this.hudMode === 1); }

  drawDial(h) {
    const c = this.rh.rhDial, g = c.getContext('2d'), W = c.width, R = W / 2 - 8, a0 = 0.75 * Math.PI, sweep = 1.5 * Math.PI, vmax = 160;
    g.clearRect(0, 0, W, W); g.save(); g.translate(W / 2, W / 2);
    const gr = g.createRadialGradient(0, 0, 10, 0, 0, R); gr.addColorStop(0, '#6a6e72'); gr.addColorStop(1, '#3d4044');
    g.beginPath(); g.arc(0, 0, R, 0, 7); g.fillStyle = '#d8dadc'; g.fill(); g.beginPath(); g.arc(0, 0, R - 9, 0, 7); g.fillStyle = gr; g.fill();
    g.beginPath(); g.arc(0, 0, R - 22, a0 + sweep * 120 / vmax, a0 + sweep, false); g.strokeStyle = '#e24a3a'; g.lineWidth = 9; g.stroke();
    g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.font = '600 24px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let v = 0; v <= vmax; v += 10) { const a = a0 + sweep * v / vmax, big = v % 20 === 0, r1 = R - 12, r2 = R - (big ? 28 : 20); g.lineWidth = big ? 3 : 1.5; g.beginPath(); g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); g.stroke(); if (big) g.fillText(v, Math.cos(a) * (R - 48), Math.sin(a) * (R - 48)); }
    const a = a0 + sweep * Math.min(1, h.kmh / vmax); g.strokeStyle = '#ff5a3c'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * (R - 26), Math.sin(a) * (R - 26)); g.stroke();
    g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fillStyle = '#aaa'; g.fill();
    g.fillStyle = '#f0b43a'; g.font = '700 26px sans-serif'; g.fillText('السرعة', 0, R * 0.38); g.fillStyle = '#ddd'; g.font = '16px sans-serif'; g.fillText('كم/ساعة', 0, R * 0.38 + 24);
    g.fillStyle = '#fff'; g.font = '700 62px sans-serif'; g.fillText(Math.round(h.kmh), 0, R * 0.38 + 66);
    g.restore();
  }

  drawBrake(b) {
    const c = this.rh.rhBrakeDial, g = c.getContext('2d'), W = c.width, H = c.height; g.clearRect(0, 0, W, H); g.save(); g.translate(W / 2, H - 14);
    const R = 112; g.beginPath(); g.arc(0, 0, R, Math.PI, 2 * Math.PI); g.closePath(); g.fillStyle = '#4a4d51'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#cfd1d3'; g.stroke();
    const col = ['#58c26a', '#e8c63a', '#e24a3a']; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, R - 14, Math.PI + i * Math.PI / 3, Math.PI + (i + 1) * Math.PI / 3); g.strokeStyle = col[i]; g.lineWidth = 8; g.stroke(); }
    const a = Math.PI + Math.PI * (0.08 + 0.84 * b); g.strokeStyle = '#eee'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * (R - 22), Math.sin(a) * (R - 22)); g.stroke();
    g.beginPath(); g.arc(Math.cos(a) * (R - 22), Math.sin(a) * (R - 22), 12, 0, 7); g.fillStyle = '#d33'; g.fill(); g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fillStyle = '#e8d9a0'; g.fill(); g.restore();
  }

  toggleHelp() { this.el.help.hidden = !this.el.help.hidden; }

  toast(msg, kind, ms) {
    const t = this.el.toast; t.textContent = msg; t.className = 'toast ' + (kind || ''); t.hidden = false;
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => (t.hidden = true), ms || 3200);
  }

  set(key, fn, val) { if (this.last[key] !== val) { this.last[key] = val; fn(val); } }

  update(h) {
    const e = this.el, r = this.rh;
    if (this.hudMode === 0 && h.rh) {
      const q = h.rh;
      this.set('rd', () => this.drawDial(h), Math.round(h.kmh));
      this.set('rb', () => this.drawBrake(h.brake), Math.round(h.brake * 20));
      this.set('rl', (v) => { r.rhLimit.firstChild.textContent = v; }, h.limit); r.rhLimit.classList.toggle('over', h.over);
      this.set('rnl', (v) => { r.rhNextLim.textContent = v; r.rhNextLim.hidden = !v; }, q.nextLimit);
      this.set('rsd', (v) => { r.rhSigD.textContent = v; }, q.sigDist);
      this.set('rsig', (v) => { r.rhSigD.parentNode.dataset.s = v; }, q.sig);
      this.set('rdn', (v) => { r.rhName.textContent = v; }, h.nextName);
      this.set('rdd', (v) => { r.rhDist.textContent = v; }, h.dist);
      this.set('rt', (v) => { r.rhTimes.textContent = v; }, q.times);
      this.set('rn', (v) => { r.rhNow.textContent = v; r.rhNow.classList.toggle('late', q.late); }, q.now);
      this.set('rs', (v) => { r.rhSalary.textContent = v; }, 'المرتب ' + q.salary + ' ج');
      this.set('rf', (v) => { r.rhFines.textContent = v; }, 'غرامات −' + q.fines + ' ج');
      this.set('rp', (v) => { r.rhPax.textContent = v; }, q.pax + ' راكب');
      this.set('rti', (v) => { r.rhTitle.textContent = v; }, q.title);
      this.set('rr', (v) => { r.rhLine.innerHTML = v; }, q.routeHtml);
      this.set('rk', (v) => { r.rhKnob.style.bottom = (v / 8 * 100) + '%'; r.rhPow.textContent = 'الباور ' + v; }, h.notch);
      r.rhDoor.classList.toggle('on', h.doorsOpen); r.rhHorn.classList.toggle('on', !!this.input.horn);
    }
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
