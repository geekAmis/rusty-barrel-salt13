/* RUSTY BARREL — интерактивная карта с туманом войны (v2) */
(function () {
  const RB = (window.RB = window.RB || {});

  const COLORS = {
    enemy: '#a3271b', npc: '#7fae86', item: '#c9a05a', note: '#d8ceb0',
    exit: '#8fa7c9', shop: '#c56a35', weapon: '#8fa7c9', clue: '#9ac9d8',
    key: '#e8dcc2', boss: '#d8452a', stash: '#c9a05a', craft: '#b08ad8',
    mail: '#7fae86', console: '#8ee6a0',
    gamble: '#c9a05a', shelter: '#6a8a6a', secret: '#b08ad8', rescue: '#7fae86'
  };

  RB.MapView = {
    view: { zoom: 1, ox: 0, oy: 0, dragging: false, lx: 0, ly: 0, moved: 0 },
    game: null,
    onClose: null,

    open(game, onClose) {
      this.game = game;
      this.onClose = onClose;
      const screen = document.getElementById('map-screen');
      const cv = document.getElementById('map-canvas');
      if (!screen || !cv) { onClose && onClose(); return; }
      document.getElementById('hud').classList.add('hidden');
      document.getElementById('touch-controls').classList.add('hidden');
      document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
      screen.classList.remove('hidden');
      const obj = document.getElementById('map-objective');
      if (obj) {
        const en = RB.I18n && RB.I18n.lang === 'en';
        obj.textContent = (en ? 'MAIN OBJECTIVE: ' : 'ГЛАВНАЯ ЦЕЛЬ: ') +
          (game.goals || []).map((g) => (g.done ? '✓ ' : '• ') + g.text).join('   ');
      }
      this.view = { zoom: 1.15, ox: 0, oy: 0, dragging: false, lx: 0, ly: 0, moved: 0 };
      this.bind(screen, cv);
      this.draw();
    },

    close() {
      const screen = document.getElementById('map-screen');
      if (screen) screen.classList.add('hidden');
      this.onClose && this.onClose();
    },

    bind(screen, cv) {
      if (screen.dataset.bound) return;
      screen.dataset.bound = '1';
      const v = this.view;
      cv.addEventListener('pointerdown', (e) => {
        v.dragging = true; v.lx = e.clientX; v.ly = e.clientY; v.moved = 0;
        cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      });
      cv.addEventListener('pointermove', (e) => {
        if (!v.dragging) return;
        const dx = e.clientX - v.lx, dy = e.clientY - v.ly;
        v.ox += dx; v.oy += dy; v.lx = e.clientX; v.ly = e.clientY;
        v.moved += Math.abs(dx) + Math.abs(dy);
        this.draw();
      });
      const up = (e) => {
        if (!v.dragging) return;
        v.dragging = false;
        if (v.moved < 8) this.tap(e.clientX, e.clientY);
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', () => { v.dragging = false; });
      cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        v.zoom = RB.clamp(v.zoom * Math.exp(-e.deltaY * 0.0012), 0.5, 4);
        this.draw();
      }, { passive: false });
      document.getElementById('map-close').onclick = () => this.close();
      document.getElementById('map-plus').onclick = () => { v.zoom = RB.clamp(v.zoom * 1.2, 0.5, 4); this.draw(); };
      document.getElementById('map-minus').onclick = () => { v.zoom = RB.clamp(v.zoom / 1.2, 0.5, 4); this.draw(); };
      document.getElementById('map-center').onclick = () => { v.ox = 0; v.oy = 0; v.zoom = 1.15; this.draw(); };
      window.addEventListener('resize', () => this.draw());
    },

    bounds(game) {
      const rooms = (game.world && game.world.rooms) || [];
      if (!rooms.length) return { x: 0, y: 0, w: game.world ? game.world.w * 48 : 1000, h: game.world ? game.world.h * 48 : 1000 };
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const r of rooms) {
        x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
        x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    },

    transform(cv, b) {
      const v = this.view;
      const cw = cv.clientWidth, ch = cv.clientHeight;
      const base = Math.min(cw / Math.max(1, b.w), ch / Math.max(1, b.h)) * 0.82;
      const s = base * v.zoom;
      return {
        s,
        tx: cw / 2 - (b.x + b.w / 2) * s + v.ox,
        ty: ch / 2 - (b.y + b.h / 2) * s + v.oy
      };
    },

    draw() {
      const game = this.game;
      if (!game) return;
      const cv = document.getElementById('map-canvas');
      if (!cv) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.max(1, cv.clientWidth), ch = Math.max(1, cv.clientHeight);
      if (cv.width !== Math.floor(cw * dpr) || cv.height !== Math.floor(ch * dpr)) {
        cv.width = Math.floor(cw * dpr); cv.height = Math.floor(ch * dpr);
      }
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#070806';
      g.fillRect(0, 0, cw, ch);
      // сетка
      g.strokeStyle = 'rgba(90,110,80,0.10)';
      g.lineWidth = 1;
      for (let x = 0; x < cw; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, ch); g.stroke(); }
      for (let y = 0; y < ch; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(cw, y); g.stroke(); }

      const b = this.bounds(game);
      const t = this.transform(cv, b);
      const rooms = (game.world && game.world.rooms) || [];
      const explored = game.explored || {};
      const cur = game.world && game.world.roomAt(game.player.x, game.player.y);

      for (let i = 0; i < rooms.length; i++) {
        const r = rooms[i];
        const key = 'ch' + game.chapterIndex + ':' + i;
        const e = explored[key];
        if (!e) continue;
        const x = t.tx + r.x * t.s, y = t.ty + r.y * t.s;
        const w = Math.max(4, r.w * t.s), h = Math.max(4, r.h * t.s);
        const isCur = r === cur;
        g.fillStyle = isCur ? 'rgba(90,120,80,0.30)' : 'rgba(46,62,46,0.20)';
        g.fillRect(x, y, w, h);
        g.strokeStyle = isCur ? '#7fae86' : 'rgba(127,174,134,0.35)';
        g.lineWidth = isCur ? 2 : 1;
        g.strokeRect(x, y, w, h);
        if (w > 46 && h > 24) {
          g.fillStyle = isCur ? '#d8e0c8' : 'rgba(216,224,200,0.55)';
          g.font = '9px "Courier New", monospace';
          g.textAlign = 'center';
          g.fillText(RB.L ? RB.L.room(e.name) : e.name, x + w / 2, y + h / 2 + 3);
        }
        // маркеры
        for (const o of (e.objects || [])) {
          const col = COLORS[o.kind] || '#8a7a5a';
          g.fillStyle = col;
          const mx = t.tx + o.x * t.s, my = t.ty + o.y * t.s;
          g.fillRect(mx - 2, my - 2, 4, 4);
        }
        for (const en of (e.enemies || [])) {
          g.fillStyle = en.boss ? '#ff4a2a' : COLORS.enemy;
          const mx = t.tx + en.x * t.s, my = t.ty + en.y * t.s;
          g.beginPath(); g.arc(mx, my, en.boss ? 4 : 2.5, 0, Math.PI * 2); g.fill();
        }
      }

      // игрок
      if (game.player) {
        const px = t.tx + game.player.x * t.s, py = t.ty + game.player.y * t.s;
        g.fillStyle = '#e8e8dc';
        g.beginPath(); g.arc(px, py, 4, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke();
        g.strokeStyle = 'rgba(232,232,220,0.35)';
        g.beginPath(); g.arc(px, py, 10, 0, Math.PI * 2); g.stroke();
      }

      // легенда
      const legend = [
        ['enemy', 'ВРАГ'], ['npc', 'NPC'], ['item', 'ПРЕДМЕТ'], ['exit', 'ВЫХОД'], ['craft', 'КРАФТ']
      ];
      g.font = '9px "Courier New", monospace';
      g.textAlign = 'left';
      let lx = 12;
      for (const [k, label] of legend) {
        g.fillStyle = COLORS[k];
        g.fillRect(lx, ch - 18, 5, 5);
        g.fillStyle = 'rgba(216,224,200,0.7)';
        g.fillText(label, lx + 9, ch - 13);
        lx += 16 + g.measureText(label).width;
      }
    },

    tap(sx, sy) {
      const game = this.game;
      const cv = document.getElementById('map-canvas');
      if (!game || !cv) return;
      const b = this.bounds(game);
      const t = this.transform(cv, b);
      const rooms = (game.world && game.world.rooms) || [];
      const explored = game.explored || {};
      for (let i = 0; i < rooms.length; i++) {
        const r = rooms[i];
        if (!explored['ch' + game.chapterIndex + ':' + i]) continue;
        const x = t.tx + r.x * t.s, y = t.ty + r.y * t.s;
        const w = r.w * t.s, h = r.h * t.s;
        if (sx >= x && sx <= x + w && sy >= y && sy <= y + h) {
          const e = explored['ch' + game.chapterIndex + ':' + i];
          const foot = document.getElementById('map-foot');
          if (foot) {
            const en = RB.I18n && RB.I18n.lang === 'en';
            foot.textContent = (RB.L ? RB.L.room(r.name) : r.name) + ' · ' +
              (en ? 'objects: ' : 'объектов: ') + (e.objects || []).length + ' · ' +
              (en ? 'enemies: ' : 'врагов: ') + (e.enemies || []).length;
          }
          return;
        }
      }
    }
  };
})();
