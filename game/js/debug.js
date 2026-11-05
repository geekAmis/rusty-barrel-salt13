/* ============================================================
   RUSTY BARREL — debug overlay и профилировщик (R003/R006)
   F3 — оверлей, F4 — к чекпоинту, F5 — лечение.
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});

  RB.Profiler = {
    frames: 0,
    acc: 0,
    avgMs: 0,
    fps: 0,
    worstMs: 0,
    tick(dt) {
      const ms = dt * 1000;
      this.frames++;
      this.acc += ms;
      if (ms > this.worstMs) this.worstMs = ms;
      if (this.frames >= 30) {
        this.avgMs = this.acc / this.frames;
        this.fps = Math.round(1000 / Math.max(1, this.avgMs));
        this.frames = 0;
        this.acc = 0;
        this.worstMs = 0;
      }
    }
  };

  RB.CrashLog = {
    key: 'rb_crash',
    add(err) {
      try {
        const list = RB.store.get(this.key, []);
        list.unshift({
          t: new Date().toISOString(),
          m: err && err.message ? err.message : String(err),
          s: err && err.stack ? String(err.stack).slice(0, 1200) : ''
        });
        RB.store.set(this.key, list.slice(0, 10));
      } catch (e) {}
    },
    list() { return RB.store.get(this.key, []); },
    clear() { RB.store.del(this.key); }
  };

  RB.Debug = {
    game: null,
    visible: false,
    el: null,
    timer: 0,

    init(game) {
      this.game = game;
      const el = document.createElement('div');
      el.id = 'debug-overlay';
      el.style.cssText = [
        'position:fixed', 'left:8px', 'top:70px', 'z-index:60',
        'padding:8px 10px', 'background:rgba(0,0,0,0.78)',
        'border:1px solid rgba(197,106,53,0.6)', 'color:#d9cba8',
        'font:10px/1.45 "Courier New",monospace', 'white-space:pre',
        'pointer-events:none', 'display:none', 'text-shadow:1px 1px 0 #000'
      ].join(';');
      document.getElementById('app').appendChild(el);
      this.el = el;

      window.addEventListener('keydown', (e) => {
        const k = e.key;
        if (k === 'F3') { e.preventDefault(); this.toggle(); }
        if (k === 'F4') { e.preventDefault(); this.toCheckpoint(); }
        if (k === 'F5') { e.preventDefault(); this.heal(); }
      });
      this.update(0);
    },

    toggle() {
      this.visible = !this.visible;
      if (this.el) this.el.style.display = this.visible ? 'block' : 'none';
    },

    toCheckpoint() {
      const g = this.game;
      if (!g || !g.player) return;
      const c = g.checkpoint;
      if (c && g.world) {
        g.player.x = c.x;
        g.player.y = c.y;
        g.player.vx = 0; g.player.vy = 0;
      }
    },

    heal() {
      const g = this.game;
      if (!g || !g.player) return;
      g.player.hp = g.player.maxHp;
      g.player.battery = 100;
      g.player.hunger = 100;
      g.player.bleed = 0;
      g.ui && g.ui.toast('DEBUG: ЛЕЧЕНИЕ');
    },

    update(dt) {
      if (!this.visible || !this.el || !this.game) return;
      this.timer -= dt;
      if (this.timer > 0) return;
      this.timer = 0.2;
      const g = this.game;
      const p = g.player;
      const w = g.world;
      const room = p && w ? w.roomAt(p.x, p.y) : null;
      const prof = RB.Profiler;
      const lines = [
        'F3 DEBUG   F4 checkpoint   F5 heal',
        'fps ' + (prof.fps || window.__rbFps || '—') + '   frame ' + prof.avgMs.toFixed(1) + ' ms',
        'state ' + g.state + '   mode ' + (w ? (w.mode === 'iso' ? 'iso' : 'side') : '—'),
        'chapter ' + g.chapterIndex + '   seed ' + g.seedText,
        p ? 'player ' + Math.round(p.x) + ',' + Math.round(p.y) + '  hp ' + Math.round(p.hp) + '  att ' + Math.round(p.attention) : 'player —',
        p ? 'weapon ' + p.weapon + '  ammo ' + p.ammo + '/' + p.reserve + '  hunger ' + Math.round(p.hunger || 0) : '',
        room ? 'room ' + room.name : 'room —',
        w ? 'enemies ' + w.enemies.filter((e) => !e.dead).length + '  objects ' + w.objects.filter((o) => !o.taken).length : '',
        w ? 'particles ' + w.particles.length + '  salt ' + (w.saltPuddles || []).length : '',
        'quality ' + (g.lowQuality ? 'low' : 'high') + '   flags ' + Object.keys(g.flags || {}).length
      ];
      this.el.textContent = lines.filter(Boolean).join('\n');
    }
  };
})();
