/* ============================================================
   RUSTY BARREL — ввод: клавиатура/мышь + два виртуальных стика
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});

  class Input {
    constructor(canvas) {
      this.canvas = canvas;
      this.keys = Object.create(null);
      this.pressed = Object.create(null);
      this.buttons = Object.create(null); // удержание экранных кнопок
      this.mouse = { x: 0, y: 0, down: false };
      this.touchMode = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      this.controlMode = RB.store.get('rb_control', 0);
      this.deadzone = 0.2;

      const stick = () => ({ id: null, ox: 0, oy: 0, x: 0, y: 0, active: false });
      this.left = stick();
      this.right = stick();

      this.move = { x: 0, y: 0 };
      this.aimAngle = -Math.PI / 2;
      this.aiming = false;
      this.firing = false;
      this.mouseAim = false;

      this.bind();
    }

    bind() {
      const c = this.canvas;

      window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
        if (!this.keys[k]) this.pressed[k] = true;
        this.keys[k] = true;
        if (k === 'shift') this.keys.shift = true;
      });
      window.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        this.keys[k] = false;
      });
      window.addEventListener('blur', () => {
        this.keys = Object.create(null);
        this.left.active = false;
        this.right.active = false;
        this.mouse.down = false;
      });

      c.addEventListener('contextmenu', (e) => e.preventDefault());

      c.addEventListener('pointerdown', (e) => {
        c.setPointerCapture && c.setPointerCapture(e.pointerId);
        this.touchMode = e.pointerType === 'touch';
        const pos = this.localPos(e);
        if (e.pointerType === 'mouse') {
          if (e.button === 0) { this.mouse.down = true; this.mouseAim = true; }
          this.mouse.x = pos.x; this.mouse.y = pos.y;
          return;
        }
        if (this.left.id === null) {
          this.left = { id: e.pointerId, ox: pos.x, oy: pos.y, x: pos.x, y: pos.y, active: true };
        }
      });

      c.addEventListener('pointermove', (e) => {
        const pos = this.localPos(e);
        if (e.pointerType === 'mouse') { this.mouse.x = pos.x; this.mouse.y = pos.y; return; }
        if (e.pointerId === this.left.id) { this.left.x = pos.x; this.left.y = pos.y; }
      });

      const up = (e) => {
        if (e.pointerType === 'mouse') { this.mouse.down = false; return; }
        if (e.pointerId === this.left.id) {
          this.left = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false };
          this.aiming = false;
        }
      };
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    }

    localPos(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    /* подключение экранных кнопок из ui.js */
    bindButton(el, action) {
      if (!el) return;
      const on = (e) => {
        if (RB.editLayout) return;
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('active');
        this.buttons[action] = true;
        this.pressed[action] = true;
        RB.Sound.init();
      };
      const off = (e) => {
        e.preventDefault();
        el.classList.remove('active');
        this.buttons[action] = false;
      };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    }

    resetSticks() {
      this.left = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false };
      this.right = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false };
      this.aiming = false;
      this.mouse.down = false;
      this.firing = false;
    }

    press(name) { this.pressed[name] = true; }

    consume(name) {
      if (this.pressed[name]) { this.pressed[name] = false; return true; }
      return false;
    }

    held(name) {
      return !!this.buttons[name] || !!this.keys[name];
    }

    stickVec(s) {
      if (!s.active) return { x: 0, y: 0, len: 0 };
      let dx = (s.x - s.ox) / 64;
      let dy = (s.y - s.oy) / 64;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      return { x: dx, y: dy, len: Math.min(1, len) };
    }

    update() {
      // клавиатура
      let kx = 0, ky = 0;
      if (this.keys.a || this.keys.arrowleft) kx -= 1;
      if (this.keys.d || this.keys.arrowright) kx += 1;
      if (this.keys.w || this.keys.arrowup) ky -= 1;
      if (this.keys.s || this.keys.arrowdown) ky += 1;
      const kl = Math.hypot(kx, ky);
      if (kl > 0) { kx /= kl; ky /= kl; }

      const lv = this.stickVec(this.left);
      let mx = kx, my = ky;
      if (lv.len > this.deadzone) {
        // один стик: угол = направление руки с оружием
        if (this.controlMode !== 1) {
          this.aimAngle = Math.atan2(lv.y, lv.x);
          this.aiming = true;
        }
        if (lv.len > 0.5) {
          const t = RB.clamp((lv.len - 0.5) / 0.5, 0, 1);
          const len = Math.hypot(lv.x, lv.y) || 1;
          mx = (lv.x / len) * t;
          my = (lv.y / len) * t;
        } else {
          mx = 0;
          my = 0;
        }
      } else {
        this.aiming = false;
      }
      this.move.x = mx;
      this.move.y = my;

      this.firing = this.mouse.down || !!this.buttons.fire;
      this.sprint = false;
    }

    draw(ctx, w, h) {
      if (!this.touchMode) return;
      const drawStick = (s, color) => {
        if (!s.active) return;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.ox, s.oy, 64, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.22;
        ctx.beginPath(); ctx.arc(s.ox, s.oy, 32, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.5;
        const v = this.stickVec(s);
        const px = s.ox + v.x * 64, py = s.oy + v.y * 64;
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(px, py, 26, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };
      drawStick(this.left, '#c9b28a');
    }
  }

  RB.Input = Input;
})();
