/* ============================================================
   RUSTY BARREL — мини-игры (мобильные, тач)
   stamp · radio · wires · shells · count · hor · pipes · xray
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});

  const TITLES = {
    lockpick: ['ТАЙНИК · ОТМЫЧКА', 'ЗАМОК'],
    hack: ['ТЕРМИНАЛ · ВЗЛОМ', 'КОНСОЛЬ СМЕНЫ'],
    sigil: ['ЗАМОК · КУЛЬТ', 'СОЛЬ · СМЕНА · ИМЯ'],
    valves: ['ЗАДАЧА · ДАВЛЕНИЕ', 'ТРИ ВЕНТИЛЯ'],
    cameras: ['ЗАДАЧА · НАБЛЮДЕНИЕ', 'КАМЕРЫ'],
    weights: ['ЗАДАЧА · СКЛАД', 'ВЕС БОЧЕК'],
    stamp: ['КВЕСТ · ЗОЯ', 'ПЕЧАТЬ'],
    radio: ['КВЕСТ · ВЕРА', 'ЧАСТОТА'],
    wires: ['КВЕСТ · СЛАВА', 'ПРОВОДА'],
    shells: ['КВЕСТ · ТИМКА', 'ТРИ БОЧКИ'],
    count: ['КВЕСТ · АСЯ', 'СЧИТАЛКА'],
    hor: ['КВЕСТ · ИГНАТ', 'ХОР'],
    pipes: ['КВЕСТ · ГРИША', 'ДАВЛЕНИЕ'],
    xray: ['КВЕСТ · КИМ', 'РЕНТГЕН']
  };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  const M = {
    start(type, onDone, arg) {
      const host = document.getElementById('minigame');
      const body = document.getElementById('mg-body');
      const foot = document.getElementById('mg-foot');
      const kicker = document.getElementById('mg-kicker');
      const title = document.getElementById('mg-title');
      const meta = TITLES[type] || ['КВЕСТ', 'ЗАДАНИЕ'];
      kicker.textContent = meta[0];
      title.textContent = meta[1];
      body.innerHTML = '';
      foot.innerHTML = '';
      host.classList.remove('hidden');
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        host.classList.add('hidden');
        onDone && onDone(ok);
      };
      const exit = el('button', 'menu-btn', 'ВЫЙТИ');
      exit.type = 'button';
      exit.addEventListener('click', () => { RB.Sound.play('ui'); finish(null); });
      foot.appendChild(exit);
      const fn = this['g_' + type];
      if (!fn) { finish(true); return; }
      fn(body, foot, finish, arg);
    },

    /* ---------------- взлом консоли ---------------- */
    g_hack(body, foot, finish, arg) {
      const lines = (arg && arg.logs) || [
        '> connect 10.13.0.1:1984',
        '> auth keycard ... OK',
        '> ps aux | grep shift',
        'shift.exe PID 13 state RUNNING',
        '> kill -9 shift.exe',
        'ACCESS GRANTED'
      ];
      const wrap = el('div');
      wrap.style.cssText = 'max-width:620px;margin:0 auto;border:1px solid #3f7a4a;background:#041006;box-shadow:0 0 24px rgba(70,180,90,0.18) inset;';
      const top = el('div', '', 'SHIFT-13 // TTY0 // 03:13');
      top.style.cssText = 'padding:7px 10px;border-bottom:1px solid #2a5a34;color:#8ee6a0;font:11px "Courier New",monospace;letter-spacing:1px;background:rgba(40,120,60,0.12);';
      const screen = el('div');
      screen.style.cssText = 'height:210px;overflow:hidden;padding:10px 12px;color:#8ee6a0;font:12px/1.5 "Courier New",monospace;text-shadow:0 0 6px rgba(80,230,120,0.35);';
      const bar = el('div');
      bar.style.cssText = 'height:6px;background:rgba(80,200,110,0.12);';
      const fill = el('div');
      fill.style.cssText = 'height:100%;width:0%;background:#4fbf68;transition:width .3s;';
      bar.appendChild(fill);
      wrap.appendChild(top); wrap.appendChild(screen); wrap.appendChild(bar);
      body.appendChild(wrap);
      const hint = el('div', 'mg-hint', 'Ключ-карта принята. Нажмите «ВЗЛОМ», чтобы запустить цепочку команд.');
      body.appendChild(hint);
      let started = false;
      let idx = 0;
      let timer = null;
      const startBtn = el('button', 'menu-btn primary', 'ВЗЛОМ');
      startBtn.type = 'button';
      const start = () => {
        if (started) return;
        if (document.getElementById('minigame').classList.contains('hidden')) return;
        started = true;
        startBtn.disabled = true;
        startBtn.style.opacity = '0.45';
        hint.textContent = 'Идёт внедрение в shift.exe. Не отключайте терминал.';
        RB.Sound.play('ui');
        timer = setInterval(() => {
          if (document.getElementById('minigame').classList.contains('hidden')) {
            clearInterval(timer);
            timer = null;
            return;
          }
          if (idx >= lines.length) {
            clearInterval(timer);
            timer = null;
            fill.style.width = '100%';
            const ok = el('div', '', '> ACCESS GRANTED · 15 T · 3 SALT-13');
            ok.style.cssText = 'margin-top:8px;color:#e8dcc2;font-weight:bold;';
            screen.appendChild(ok);
            screen.scrollTop = screen.scrollHeight;
            hint.textContent = 'ВЗЛОМ ЗАВЕРШЁН. Награда зачислена.';
            RB.Sound.play('stinger');
            setTimeout(() => finish(true), 700);
            return;
          }
          const line = lines[idx++];
          const d = el('div', '', line);
          if (line.indexOf('ACCESS') >= 0 || line.indexOf('GRANTED') >= 0) d.style.color = '#e8dcc2';
          if (line.indexOf('ERR') >= 0 || line.indexOf('denied') >= 0) d.style.color = '#d8452a';
          screen.appendChild(d);
          screen.scrollTop = screen.scrollHeight;
          fill.style.width = Math.round((idx / lines.length) * 100) + '%';
          if (idx % 3 === 0) RB.Sound.play('ui');
        }, 380);
      };
      startBtn.addEventListener('click', start);
      foot.appendChild(startBtn);
      setTimeout(() => { if (!started) start(); }, 1200);
    },

    /* ---------------- отмычка ---------------- */
    g_lockpick(body, foot, finish, arg) {
      const diff = Math.max(1, Math.min(3, arg || 1));
      const tol = [0, 0.38, 0.24, 0.14][diff];
      let picks = [0, 4, 3, 2][diff];
      let progress = 0, angle = -1.2, target = rnd(0, Math.PI * 2);
      const hint = el('div', 'mg-hint', 'Веди отмычку по замку. Когда почувствуешь зацеп — дави. Сложность: ' + diff + '. Отмычек: ' + picks + '.');
      body.appendChild(hint);
      const cv = el('canvas');
      cv.width = 380; cv.height = 250;
      cv.style.cssText = 'display:block;margin:0 auto;background:rgba(0,0,0,0.35);border:1px solid #6a6a3a;touch-action:none;';
      body.appendChild(cv);
      const g = cv.getContext('2d');
      const draw = () => {
        g.clearRect(0, 0, cv.width, cv.height);
        g.fillStyle = '#0a0d08'; g.fillRect(0, 0, cv.width, cv.height);
        const cx = 190, cy = 145, r = 78;
        g.strokeStyle = '#6a6a3a'; g.lineWidth = 10;
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = '#2a2a1a'; g.lineWidth = 3;
        g.beginPath(); g.arc(cx, cy, r - 7, 0, Math.PI * 2); g.stroke();
        // замочная скважина
        g.fillStyle = '#1a1a12';
        g.fillRect(cx - 3, cy - 14, 6, 22);
        g.beginPath(); g.arc(cx, cy - 18, 7, 0, Math.PI * 2); g.fill();
        // отмычка
        g.strokeStyle = '#c9a05a'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(angle) * (r - 4), cy + Math.sin(angle) * (r - 4)); g.stroke();
        g.fillStyle = '#e8dcc2';
        g.beginPath(); g.arc(cx + Math.cos(angle) * (r - 4), cy + Math.sin(angle) * (r - 4), 3, 0, Math.PI * 2); g.fill();
        // прогресс
        g.fillStyle = '#7fae86';
        for (let i = 0; i < 3; i++) if (i < progress) g.fillRect(20 + i * 18, 20, 13, 5);
        g.fillStyle = '#8a7a5a'; g.font = '12px "Courier New", monospace';
        g.fillText('ОТМЫЧЕК: ' + picks, 20, 228);
        g.fillText('ЗАЦЕП: ' + (Math.abs(RB.angDiff(angle, target)) < 0.5 ? '...' : '—'), 240, 228);
      };
      cv.addEventListener('pointermove', (e) => {
        const rect = cv.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (cv.width / rect.width) - 190;
        const y = (e.clientY - rect.top) * (cv.height / rect.height) - 145;
        angle = Math.atan2(y, x);
        draw();
      });
      const attempt = () => {
        const d = Math.abs(RB.angDiff(angle, target));
        if (d < tol) {
          progress++;
          target = rnd(0, Math.PI * 2);
          RB.Sound.play('ui');
          if (progress >= 3) { RB.Sound.play('stinger'); finish(true); return; }
        } else {
          picks--;
          RB.Sound.play('deny');
          if (picks <= 0) { hint.textContent = 'Отмычка сломалась. Замок заклинило.'; setTimeout(() => finish(false), 600); return; }
        }
        draw();
      };
      const turn = el('button', 'menu-btn', 'ДАВИТЬ');
      turn.type = 'button';
      turn.style.marginTop = '10px';
      turn.addEventListener('click', attempt);
      body.appendChild(turn);
      draw();
      hint.textContent = 'Веди отмычку по замку. Зацеп — короткий скрип. Отмычек: ' + picks + '.';
    },

    /* ---------------- вентили ---------------- */
    g_valves(body, foot, finish) {
      const target = [2, 0, 3];
      const val = [0, 0, 0];
      let tries = 3;
      const hint = el('div', 'mg-hint', 'Выставь давление: левый — 2, средний — 0, правый — 3.');
      body.appendChild(hint);
      const wrap = el('div', 'mg-form');
      wrap.style.cssText = 'display:flex;gap:20px;justify-content:center;align-items:flex-end;flex-wrap:wrap;';
      const labels = ['ЛИНИЯ A', 'ЛИНИЯ B', 'ЛИНИЯ C'];
      const turns = [];
      for (let i = 0; i < 3; i++) {
        const col = el('div');
        col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;';
        const wheel = el('div', '', '0');
        wheel.style.cssText = 'width:64px;height:64px;border:3px solid #8fa7c9;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:26px;color:#dce8f5;background:rgba(20,30,40,0.5);';
        const name = el('div', '', labels[i]);
        name.style.cssText = 'font-size:9px;letter-spacing:2px;color:#7a8a9a;';
        const btn = el('button', 'menu-btn', 'ПОВЕРНУТЬ');
        btn.type = 'button';
        btn.style.cssText = 'font-size:10px;padding:6px 8px;';
        btn.addEventListener('click', () => {
          val[i] = (val[i] + 1) % 4;
          RB.Sound.play('ui');
          draw();
        });
        col.appendChild(wheel); col.appendChild(name); col.appendChild(btn);
        wrap.appendChild(col);
        turns.push(wheel);
      }
      body.appendChild(wrap);
      const draw = () => {
        for (let i = 0; i < 3; i++) turns[i].textContent = val[i];
        hint.textContent = 'Попыток: ' + tries + '. Нужно: 2 · 0 · 3.';
      };
      const check = el('button', 'menu-btn', 'ВЫРОВНЯТЬ');
      check.type = 'button';
      check.style.marginTop = '16px';
      check.addEventListener('click', () => {
        if (val.every((v, i) => v === target[i])) { RB.Sound.play('stinger'); finish(true); return; }
        tries--;
        RB.Sound.play('deny');
        if (tries <= 0) { hint.textContent = 'Трубу сорвало. Давление не прощает.'; setTimeout(() => finish(false), 700); return; }
        draw();
      });
      body.appendChild(check);
      draw();
    },

    /* ---------------- камеры ---------------- */
    g_cameras(body, foot, finish) {
      const seq = [0, 4, 8, 2];
      let input = [];
      let locked = true;
      const hint = el('div', 'mg-hint', 'Смотри на камеры. Повтори последовательность из четырёх вспышек.');
      body.appendChild(hint);
      const grid = el('div', 'mg-form');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,64px);gap:8px;justify-content:center;';
      const cells = [];
      for (let i = 0; i < 9; i++) {
        const c = el('button', 'menu-btn', '');
        c.type = 'button';
        c.style.cssText = 'width:64px;height:64px;font-size:18px;padding:0;';
        c.addEventListener('click', () => {
          if (locked) return;
          RB.Sound.play('ui');
          input.push(i);
          c.style.background = 'rgba(201,160,90,0.5)';
          setTimeout(() => { c.style.background = ''; }, 180);
          if (input[input.length - 1] !== seq[input.length - 1]) {
            locked = true;
            hint.textContent = 'Не та камера. Наблюдение сорвано.';
            setTimeout(() => finish(false), 650);
            return;
          }
          if (input.length === seq.length) { locked = true; RB.Sound.play('stinger'); finish(true); }
        });
        grid.appendChild(c);
        cells.push(c);
      }
      body.appendChild(grid);
      const flash = (i) => {
        const c = cells[seq[i]];
        c.style.background = '#d8c078';
        c.style.backgroundImage = 'none';
        c.style.boxShadow = '0 0 26px #c9a05a, inset 0 0 18px #fff2b0';
        c.style.transform = 'scale(1.08)';
        c.style.borderColor = '#ffe9a8';
        hint.textContent = 'ВСПЫШКА ' + (i + 1) + ' / ' + seq.length;
        RB.Sound.play('ui');
        setTimeout(() => {
          c.style.background = '';
          c.style.backgroundImage = '';
          c.style.boxShadow = '';
          c.style.transform = '';
          c.style.borderColor = '';
        }, 420);
      };
      seq.forEach((_, i) => setTimeout(() => flash(i), 900 + i * 680));
      setTimeout(() => { locked = false; hint.textContent = 'Повтори: ' + seq.length + ' вспышки.'; }, 900 + seq.length * 680 + 250);
    },

    /* ---------------- вес бочек ---------------- */
    g_weights(body, foot, finish) {
      const weights = [2, 3, 4, 5, 6];
      const picked = [];
      let tries = 3;
      const hint = el('div', 'mg-hint', 'Выбери две бочки, чтобы получить ровно 9.');
      body.appendChild(hint);
      const wrap = el('div', 'mg-form');
      wrap.style.cssText = 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap;';
      const cards = [];
      weights.forEach((w, i) => {
        const b = el('button', 'menu-btn', String(w));
        b.type = 'button';
        b.style.cssText = 'width:58px;height:74px;font-size:22px;';
        b.addEventListener('click', () => {
          const idx = picked.indexOf(i);
          if (idx >= 0) { picked.splice(idx, 1); b.style.borderColor = ''; }
          else if (picked.length < 2) { picked.push(i); b.style.borderColor = '#7fae86'; }
          RB.Sound.play('ui');
          draw();
        });
        wrap.appendChild(b);
        cards.push(b);
      });
      body.appendChild(wrap);
      const draw = () => {
        const sum = picked.reduce((a, i) => a + weights[i], 0);
        hint.textContent = 'Сумма: ' + sum + '. Попыток: ' + tries + '. Нужно ровно 9.';
      };
      const check = el('button', 'menu-btn', 'ВЗВЕСИТЬ');
      check.type = 'button';
      check.style.marginTop = '16px';
      check.addEventListener('click', () => {
        const sum = picked.reduce((a, i) => a + weights[i], 0);
        if (sum === 9 && picked.length === 2) { RB.Sound.play('stinger'); finish(true); return; }
        tries--;
        RB.Sound.play('deny');
        if (tries <= 0) { hint.textContent = 'Бочки сорвались. Склад не прощает.'; setTimeout(() => finish(false), 700); return; }
        draw();
      });
      body.appendChild(check);
      draw();
    },

    /* ---------------- сигил культа ---------------- */
    g_sigil(body, foot, finish) {
      const target = [1, 2, 3];
      const rot = [0, 0, 0];
      let tries = 3;
      const hint = el('div', 'mg-hint', 'Три кольца. Соль — 1, смена — 2, имя — 3. Поверни кольца так, чтобы числа совпали.');
      body.appendChild(hint);
      const wrap = el('div', 'mg-form');
      wrap.style.cssText = 'display:flex;gap:22px;justify-content:center;align-items:flex-end;flex-wrap:wrap;';
      const rings = [];
      const glyph = ['○', '◔', '◑', '◕'];
      for (let i = 0; i < 3; i++) {
        const col = el('div');
        col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;';
        const ring = el('div', '', glyph[0]);
        ring.style.cssText = 'width:76px;height:76px;border:3px solid #c9a05a;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:34px;color:#e8dcc2;background:rgba(0,0,0,0.35);';
        const name = el('div', '', ['СОЛЬ', 'СМЕНА', 'ИМЯ'][i]);
        name.style.cssText = 'font-size:10px;letter-spacing:2px;color:#8a7a5a;';
        const btn = el('button', 'menu-btn', 'ПОВЕРНУТЬ');
        btn.type = 'button';
        btn.style.cssText = 'font-size:10px;padding:6px 10px;';
        btn.addEventListener('click', () => {
          rot[i] = (rot[i] + 1) % 4;
          RB.Sound.play('ui');
          draw();
        });
        col.appendChild(ring); col.appendChild(name); col.appendChild(btn);
        wrap.appendChild(col);
        rings.push(ring);
      }
      body.appendChild(wrap);
      const draw = () => {
        for (let i = 0; i < 3; i++) rings[i].textContent = glyph[rot[i]];
        hint.textContent = 'Попыток: ' + tries + '. Соль — 1, смена — 2, имя — 3.';
      };
      const check = el('button', 'menu-btn', 'СОБРАТЬ СИГИЛ');
      check.type = 'button';
      check.style.marginTop = '16px';
      check.addEventListener('click', () => {
        if (rot.every((r, i) => r === target[i])) {
          RB.Sound.play('stinger');
          finish(true);
          return;
        }
        tries--;
        RB.Sound.play('deny');
        if (tries <= 0) { hint.textContent = 'Сигил рассыпался. Соль не любит ошибок.'; setTimeout(() => finish(false), 700); return; }
        draw();
      });
      body.appendChild(check);
      draw();
    },

    /* ---------------- Печать ---------------- */
    g_stamp(body, foot, finish) {
      body.appendChild(el('div', 'mg-hint', 'Перетащи штамп в рамку и поставь ровно. Три попытки.'));
      const form = el('div', 'mg-form');
      const frame = el('div', 'mg-frame');
      form.appendChild(frame);
      const stamp = el('div', 'mg-stamp', 'ПЕЧАТЬ');
      form.appendChild(stamp);
      body.appendChild(form);

      let sx = 22, sy = 30, ang = -9;
      let tries = 3;
      let tol = 14;
      const apply = () => {
        stamp.style.left = sx + '%';
        stamp.style.top = sy + '%';
        stamp.style.transform = `translate(-50%, -50%) rotate(${ang}deg)`;
      };
      apply();

      let drag = null;
      stamp.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        stamp.setPointerCapture(e.pointerId);
        drag = { dx: e.clientX, dy: e.clientY, sx, sy };
      });
      stamp.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const r = form.getBoundingClientRect();
        sx = drag.sx + ((e.clientX - drag.dx) / r.width) * 100;
        sy = drag.sy + ((e.clientY - drag.dy) / r.height) * 100;
        sx = RB.clamp(sx, 4, 96);
        sy = RB.clamp(sy, 4, 96);
        apply();
      });
      stamp.addEventListener('pointerup', () => { drag = null; });
      stamp.addEventListener('pointercancel', () => { drag = null; });

      const rot = (d) => {
        ang = RB.clamp(ang + d, -40, 40);
        apply();
        RB.Sound.play('ui');
      };
      const b1 = el('button', 'mg-mini', '↺');
      const b2 = el('button', 'mg-mini', '↻');
      b1.type = b2.type = 'button';
      b1.addEventListener('click', () => rot(5));
      b2.addEventListener('click', () => rot(-5));
      const ctr = el('div', 'mg-row');
      ctr.appendChild(b1); ctr.appendChild(b2);
      body.appendChild(ctr);

      const go = el('button', 'menu-btn primary', 'ПОСТАВИТЬ');
      go.type = 'button';
      go.addEventListener('click', () => {
        const dx = Math.abs(sx - 50), dy = Math.abs(sy - 50), da = Math.abs(((ang % 360) + 360) % 360);
        if (dx < tol && dy < tol && (da < 6 || da > 354)) {
          RB.Sound.play('stamp');
          finish(true);
        } else {
          tries--;
          tol = Math.max(6, tol - 3);
          RB.Sound.play('deny');
          if (tries <= 0) finish(false);
          else body.querySelector('.mg-hint').textContent = `Мимо. Осталось попыток: ${tries}`;
        }
      });
      foot.appendChild(go);
    },

    /* ---------------- Частота ---------------- */
    g_radio(body, foot, finish) {
      body.appendChild(el('div', 'mg-hint', 'Поймай три несущие. Кнопка «зафиксировать» работает только у цели.'));
      const targets = [Math.round(rnd(15, 35) * 10) / 10, Math.round(rnd(45, 65) * 10) / 10, Math.round(rnd(72, 90) * 10) / 10];
      let idx = 0;
      const bands = el('div', 'mg-bands');
      const bars = [];
      for (let i = 0; i < 3; i++) {
        const b = el('div', 'mg-band');
        bands.appendChild(b);
        bars.push(b);
      }
      body.appendChild(bands);
      const slider = el('input', 'mg-slider');
      slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.step = '0.5'; slider.value = '50';
      body.appendChild(slider);
      const sig = el('div', 'mg-hint', 'СИГНАЛ: 0%');
      body.appendChild(sig);

      let fails = 0;
      const update = () => {
        const v = parseFloat(slider.value);
        const d = Math.abs(v - targets[idx]);
        const p = Math.max(0, Math.round(100 - d * 14));
        sig.textContent = `СИГНАЛ: ${p}%   ·   ${idx + 1}/3`;
        bars[idx].style.opacity = 1;
        bars[idx].style.background = `linear-gradient(90deg, #3a4a3f ${p}%, rgba(30,30,26,0.6) ${p}%)`;
      };
      slider.addEventListener('input', () => { update(); RB.Sound.play('tic'); });
      update();

      const go = el('button', 'menu-btn primary', 'ЗАФИКСИРОВАТЬ');
      go.type = 'button';
      go.addEventListener('click', () => {
        const v = parseFloat(slider.value);
        if (Math.abs(v - targets[idx]) <= 2.5) {
          RB.Sound.play('pickup');
          bars[idx].style.background = 'linear-gradient(90deg,#7fae86,#cfe6c4)';
          idx++;
          if (idx >= 3) { finish(true); return; }
          slider.value = '50';
          update();
        } else {
          fails++;
          RB.Sound.play('deny');
          if (fails >= 4) finish(false);
          else body.querySelector('.mg-hint').textContent = `Помехи. Попыток: ${4 - fails}`;
        }
      });
      foot.appendChild(go);
    },

    /* ---------------- Провода ---------------- */
    g_wires(body, foot, finish) {
      body.appendChild(el('div', 'mg-hint', 'Соедини пары: тап слева, потом справа. Три ошибки — замыкание.'));
      const colors = ['#b4552a', '#7fae86', '#c9a05a', '#8fa7c9', '#b07ac9', '#c9c05a'];
      const shuffle = (a) => a.map((v) => ({ v, k: Math.random() })).sort((x, y) => x.k - y.k).map((x) => x.v);
      const left = shuffle(colors.slice());
      const right = shuffle(colors.slice());
      const wrap = el('div', 'mg-wires');
      const colL = el('div', 'mg-col');
      const colR = el('div', 'mg-col');
      wrap.appendChild(colL); wrap.appendChild(colR);
      body.appendChild(wrap);
      let picked = null;
      let mistakes = 0;
      let solved = 0;
      const mkBtn = (c, side) => {
        const b = el('button', 'mg-node');
        b.type = 'button';
        b.style.background = c;
        b.dataset.color = c;
        b.addEventListener('click', () => {
          if (b.disabled) return;
          if (side === 'L') {
            if (picked) picked.el.style.outline = 'none';
            picked = { el: b, color: c };
            b.style.outline = '3px solid #fff';
            RB.Sound.play('ui');
          } else {
            if (!picked) return;
            if (picked.color === c) {
              picked.el.disabled = true; b.disabled = true;
              picked.el.style.opacity = '0.25'; b.style.opacity = '0.25';
              picked.el.style.outline = 'none';
              solved++;
              picked = null;
              RB.Sound.play('pickup');
              if (solved >= colors.length) finish(true);
            } else {
              mistakes++;
              RB.Sound.play('hit');
              b.style.outline = '3px solid #d8452a';
              setTimeout(() => { b.style.outline = 'none'; }, 240);
              if (mistakes >= 3) finish(false);
            }
          }
        });
        return b;
      };
      left.forEach((c) => colL.appendChild(mkBtn(c, 'L')));
      right.forEach((c) => colR.appendChild(mkBtn(c, 'R')));
    },

    /* ---------------- Три бочки ---------------- */
    g_shells(body, foot, finish) {
      body.appendChild(el('div', 'mg-hint', 'Угадай, под какой бочкой ключ. Три раунда, нужно два.'));
      const row = el('div', 'mg-cups');
      const cups = [];
      for (let i = 0; i < 3; i++) {
        const c = el('button', 'mg-cup');
        c.type = 'button';
        c.textContent = '\\_/';
        cups.push(c);
        row.appendChild(c);
      }
      body.appendChild(row);
      const msg = el('div', 'mg-hint', 'РАУНД 1 / 3');
      body.appendChild(msg);
      let round = 0, wins = 0, key = Math.floor(Math.random() * 3), locked = true;

      const setLocked = (v) => {
        locked = v;
        cups.forEach((c) => { c.disabled = v; });
      };
      setLocked(true);

      const shuffleAnim = () => {
        let n = 0;
        const tick = () => {
          if (n++ > 5) {
            setLocked(false);
            msg.textContent = `РАУНД ${round + 1} / 3 — ВЫБИРАЙ`;
            return;
          }
          cups.forEach((c, i) => {
            c.style.transform = `translateX(${rnd(-18, 18)}px) rotate(${rnd(-4, 4)}deg)`;
          });
          RB.Sound.play('step', { vol: 0.5 });
          setTimeout(() => {
            cups.forEach((c) => { c.style.transform = 'none'; });
            n++;
            setTimeout(tick, 120);
          }, 160);
        };
        setTimeout(tick, 250);
      };

      cups.forEach((c, i) => {
        c.addEventListener('click', () => {
          if (locked) return;
          setLocked(true);
          if (i === key) { wins++; c.textContent = '★'; }
          else { c.textContent = '×'; }
          RB.Sound.play(i === key ? 'pickup' : 'deny');
          round++;
          setTimeout(() => {
            cups.forEach((x) => { x.textContent = '\\_/'; });
            if (round >= 3) {
              finish(wins >= 2);
            } else {
              key = Math.floor(Math.random() * 3);
              msg.textContent = `РАУНД ${round + 1} / 3 — ШАФЛ`;
              shuffleAnim();
            }
          }, 650);
        });
      });
      shuffleAnim();
    },

    /* ---------------- Считалка ---------------- */
    g_count(body, foot, finish) {
      body.appendChild(el('div', 'mg-hint', 'Запомни стуки и повтори. Ошибка — смена начинается заново.'));
      const pads = el('div', 'mg-pads');
      const btns = [];
      for (let i = 0; i < 3; i++) {
        const b = el('button', 'mg-pad');
        b.type = 'button';
        btns.push(b);
        pads.appendChild(b);
      }
      body.appendChild(pads);
      const msg = el('div', 'mg-hint', 'ПРИГОТОВЬСЯ');
      body.appendChild(msg);
      const seq = [];
      const len = 5 + Math.floor(Math.random() * 3);
      for (let i = 0; i < len; i++) seq.push(Math.floor(Math.random() * 3));
      let idx = 0, accept = false, errors = 0, playing = true;

      const flash = (i, cb) => {
        btns[i].classList.add('on');
        RB.Sound.play('step', { vol: 1.4 });
        setTimeout(() => { btns[i].classList.remove('on'); cb && cb(); }, 260);
      };
      const show = (n) => {
        if (n >= seq.length) { accept = true; playing = false; msg.textContent = 'ТЕПЕРЬ ТЫ'; return; }
        msg.textContent = 'СЛУШАЙ';
        flash(seq[n], () => setTimeout(() => show(n + 1), 140));
      };
      setTimeout(() => show(0), 700);

      btns.forEach((b, i) => {
        b.addEventListener('click', () => {
          if (!accept) return;
          flash(i);
          if (i === seq[idx]) {
            idx++;
            if (idx >= seq.length) finish(true);
          } else {
            errors++;
            idx = 0;
            RB.Sound.play('deny');
            if (errors >= 3) finish(false);
            else { msg.textContent = 'СБИЛСЯ. СЛУШАЙ СНОВА'; accept = false; setTimeout(() => show(0), 800); }
          }
        });
      });
    },

    /* ---------------- Хор ---------------- */
    g_hor(body, foot, finish) {
      body.appendChild(el('div', 'mg-hint', 'Попади в такт: тапай по кругу, когда он вспыхивает. Нужно 3 из 5.'));
      const circle = el('button', 'mg-hit');
      circle.type = 'button';
      body.appendChild(circle);
      const msg = el('div', 'mg-hint', 'ПРИГОТОВЬСЯ');
      body.appendChild(msg);
      let beat = 0, hits = 0, active = false, ended = false;
      const period = 820;

      const nextBeat = () => {
        if (ended) return;
        if (beat >= 5) {
          msg.textContent = `ПОПАДАНИЙ: ${hits} / 5`;
          setTimeout(() => {
            if (!ended) { ended = true; finish(hits >= 3); }
          }, 500);
          return;
        }
        beat++;
        msg.textContent = `УДАР ${beat} / 5`;
        active = true;
        circle.classList.add('on');
        RB.Sound.play('step', { vol: 1.2 });
        setTimeout(() => {
          circle.classList.remove('on');
          active = false;
        }, 420);
        setTimeout(nextBeat, period);
      };

      circle.addEventListener('click', () => {
        if (!active || ended) return;
        active = false;
        hits++;
        circle.classList.remove('on');
        RB.Sound.play('pickup');
        msg.textContent = `ПОПАДАНИЕ · ${hits} / 5`;
      });

      setTimeout(nextBeat, 900);
    },

    /* ---------------- Трубы ---------------- */
    g_pipes(body, foot, finish) {
      body.appendChild(el('div', 'mg-hint', 'Поворачивай сегменты. Соедини пар от котла (верх) к турбине (низ).'));
      const N = 4;
      const BASE = [5, 10, 3, 6, 12, 9];
      const rotMask = (m, r) => {
        let x = m;
        for (let i = 0; i < r; i++) x = ((x << 1) & 15) | ((x >> 3) & 1);
        return x;
      };
      const CH = {
        0: '·', 1: '╵', 2: '╶', 3: '└', 4: '╷', 5: '│', 6: '┌', 7: '├',
        8: '╴', 9: '┘', 10: '─', 11: '┴', 12: '┐', 13: '┤', 14: '┬', 15: '┼'
      };
      const grid = [];
      for (let y = 0; y < N; y++) {
        const row = [];
        for (let x = 0; x < N; x++) row.push({ base: BASE[Math.floor(Math.random() * BASE.length)], rot: Math.floor(Math.random() * 4) });
        grid.push(row);
      }
      // гарантированный вертикальный путь по колонке 1
      for (let y = 0; y < N; y++) grid[y][1] = { base: 5, rot: Math.floor(Math.random() * 4) };

      const wrap = el('div', 'mg-pipes');
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const c = el('button', 'mg-pipe');
          c.type = 'button';
          const draw = () => {
            const m = rotMask(grid[y][x].base, grid[y][x].rot);
            c.textContent = CH[m] || '·';
          };
          draw();
          c.addEventListener('click', () => {
            grid[y][x].rot = (grid[y][x].rot + 1) % 4;
            draw();
            RB.Sound.play('tic');
          });
          wrap.appendChild(c);
        }
      }
      body.appendChild(wrap);

      const go = el('button', 'menu-btn primary', 'ПУСТИТЬ ПАР');
      go.type = 'button';
      go.addEventListener('click', () => {
        const dirs = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]];
        const seen = new Set(['1,0']);
        const q = [[1, 0]];
        let reached = false;
        while (q.length) {
          const [x, y] = q.pop();
          if (y === N - 1) { reached = true; break; }
          const bits = rotMask(grid[y][x].base, grid[y][x].rot);
          for (const [dx, dy, outBit, inBit] of dirs) {
            if (!(bits & outBit)) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
            const nb = rotMask(grid[ny][nx].base, grid[ny][nx].rot);
            if (!(nb & inBit)) continue;
            const k = nx + ',' + ny;
            if (seen.has(k)) continue;
            seen.add(k); q.push([nx, ny]);
          }
        }
        if (reached) { RB.Sound.play('generator'); finish(true); }
        else {
          RB.Sound.play('deny');
          body.querySelector('.mg-hint').textContent = 'Пар не дошёл. Попробуй ещё.';
        }
      });
      foot.appendChild(go);
    },

    /* ---------------- Рентген ---------------- */
    g_xray(body, foot, finish) {
      body.appendChild(el('div', 'mg-hint', 'Найди три отличия на правом снимке. Тапай по области.'));
      const wrap = el('div', 'mg-xray');
      const left = el('div', 'mg-film');
      const right = el('div', 'mg-film');
      left.innerHTML = '<b>1983</b>';
      right.innerHTML = '<b>1994</b>';
      wrap.appendChild(left); wrap.appendChild(right);
      body.appendChild(wrap);
      const spots = [
        { x: 24, y: 38 }, { x: 62, y: 22 }, { x: 48, y: 70 }
      ];
      const marks = [];
      spots.forEach((s, i) => {
        const d = el('div', 'mg-diff d' + i);
        d.style.left = s.x + '%';
        d.style.top = s.y + '%';
        right.appendChild(d);
        const m = el('div', 'mg-spot');
        right.appendChild(m);
        marks.push(m);
      });
      let found = 0, wrong = 0;
      const onTap = (e) => {
        const r = right.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        let hit = -1;
        spots.forEach((s, i) => {
          if (marks[i].classList.contains('found')) return;
          if (Math.hypot(s.x - x, s.y - y) < 16) hit = i;
        });
        if (hit >= 0) {
          marks[hit].classList.add('found');
          marks[hit].style.left = spots[hit].x + '%';
          marks[hit].style.top = spots[hit].y + '%';
          found++;
          RB.Sound.play('pickup');
          if (found >= 3) finish(true);
        } else {
          wrong++;
          RB.Sound.play('deny');
          if (wrong >= 5) finish(false);
        }
      };
      right.addEventListener('click', onTap);
    }
  };

  RB.Minigames = M;
})();
