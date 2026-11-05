/* ============================================================
   RUSTY BARREL — рендер: статический слой, свет, эффекты
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});
  const T = 48;

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = RB.clamp(Math.round(r + amt), 0, 255);
    g = RB.clamp(Math.round(g + amt), 0, 255);
    b = RB.clamp(Math.round(b + amt), 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.light = document.createElement('canvas');
      this.lctx = this.light.getContext('2d');
      this.staticCanvas = null;
      this.vignette = null;
      this.grain = this.makeGrain();
      this.ambientSprite = this.makeGlowSprite(256, [[0, 0.92], [0.55, 0.55], [1, 0]], [0, 0, 0]);
      this.lampSprite = this.makeGlowSprite(256, [[0, 0.8], [0.5, 0.4], [1, 0]], [0, 0, 0]);
      this.warmSprite = this.makeGlowSprite(128, [[0, 1], [0.5, 0.5], [1, 0]], [200, 226, 220]);
      this.dpr = 1;
      this.w = 0; this.h = 0;
      this.t = 0;
      this.resize();
    }

    makeGrain() {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const img = g.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 120 + Math.random() * 135;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return c;
    }

    resize() {
      const rect = this.cv.getBoundingClientRect();
      this.w = Math.max(1, Math.floor(rect.width));
      this.h = Math.max(1, Math.floor(rect.height));
      const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      const cap = this.lowQuality ? 1 : (touch ? 1.25 : 1.75);
      this.dpr = Math.min(window.devicePixelRatio || 1, cap);
      this.cv.width = Math.floor(this.w * this.dpr);
      this.cv.height = Math.floor(this.h * this.dpr);
      this.light.width = this.w;
      this.light.height = this.h;
      this.buildVignette();
    }

    makeGlowSprite(size, stops, color) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
      for (const [p, a] of stops) gr.addColorStop(p, `rgba(${color[0]},${color[1]},${color[2]},${a})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, size, size);
      return c;
    }

    buildVignette() {
      const c = document.createElement('canvas');
      c.width = this.w; c.height = this.h;
      const g = c.getContext('2d');
      const r = Math.hypot(this.w, this.h) * 0.55;
      const grad = g.createRadialGradient(this.w / 2, this.h / 2, r * 0.25, this.w / 2, this.h / 2, r);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.62, 'rgba(0,0,0,0.20)');
      grad.addColorStop(1, 'rgba(0,0,0,0.62)');
      g.fillStyle = grad;
      g.fillRect(0, 0, this.w, this.h);
      this.vignette = c;
    }

    /* ---------- статический слой ---------- */
    buildStatic(world) {
      const c = document.createElement('canvas');
      c.width = world.pxW;
      c.height = world.pxH;
      const g = c.getContext('2d');
      g.fillStyle = '#0d0c0a';
      g.fillRect(0, 0, c.width, c.height);

      for (let y = 0; y < world.h; y++) {
        for (let x = 0; x < world.w; x++) {
          this.paintFloor(g, world, x, y);
        }
      }
      for (let y = 0; y < world.h; y++) {
        for (let x = 0; x < world.w; x++) {
          const ch = world.grid[y][x];
          if (ch === '#') this.paintWall(g, world, x, y);
          else if (ch === 'B') this.paintBarrel(g, x * T + T / 2, y * T + T / 2, 19, x * 7 + y * 13);
          else if (ch === 'C') this.paintCrate(g, x * T + T / 2, y * T + T / 2, 36, x + y * 3);
          else if (ch === 'P') this.paintPillar(g, x * T + T / 2, y * T + T / 2);
        }
      }
      this.paintWallShadows(g, world);
      this.staticCanvas = c;
      this.staticWorld = world;
    }

    paintFloor(g, world, x, y) {
      const ch = world.grid[y][x];
      const px = x * T, py = y * T;
      const h = RB.hash2(x, y, 11);
      if (ch === '~') {
        g.fillStyle = '#101c23';
        g.fillRect(px, py, T, T);
        g.fillStyle = 'rgba(70,110,120,0.18)';
        for (let i = 0; i < 3; i++) {
          const yy = py + 8 + ((i * 17 + h * 20) % 40);
          g.beginPath();
          g.ellipse(px + T / 2, yy, 14 + h * 8, 2, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(px, py, T, 2);
        return;
      }
      // бетон
      const base = 48 + Math.floor(h * 12);
      g.fillStyle = `rgb(${base + 4},${base},${base - 5})`;
      g.fillRect(px, py, T, T);
      // швы плит
      g.strokeStyle = 'rgba(0,0,0,0.22)';
      g.lineWidth = 1;
      g.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      // пятна и мусор
      if (h > 0.55) {
        g.fillStyle = 'rgba(20,16,12,0.28)';
        const bx = px + 6 + RB.hash2(x, y, 3) * 34;
        const by = py + 6 + RB.hash2(x, y, 4) * 34;
        g.beginPath();
        g.ellipse(bx, by, 4 + h * 9, 3 + h * 6, h * 6, 0, Math.PI * 2);
        g.fill();
      }
      if (h > 0.82) {
        g.fillStyle = 'rgba(120,96,64,0.16)';
        g.fillRect(px + 10 + h * 18, py + 8, 2, 10);
      }
      if (h > 0.93) {
        // обрывок бумаги
        g.save();
        g.translate(px + 8 + h * 22, py + 10 + h * 22);
        g.rotate((h - 0.5) * 2.2);
        g.fillStyle = 'rgba(214,204,178,0.30)';
        g.fillRect(-4, -3, 9, 6);
        g.fillStyle = 'rgba(60,50,40,0.35)';
        g.fillRect(-2, -1, 5, 1);
        g.restore();
      }
      if (ch === ',') {
        g.strokeStyle = 'rgba(8,7,6,0.6)';
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(px + 10, py + 14);
        g.lineTo(px + 22, py + 26);
        g.lineTo(px + 18, py + 36);
        g.stroke();
      }
    }

    paintWall(g, world, x, y) {
      const px = x * T, py = y * T;
      const h = Math.floor(RB.hash2(x, y, 21) * 12);
      g.fillStyle = `rgb(${48 + h},${42 + h},${36 + h})`;
      g.fillRect(px, py, T, T);
      // ржавые потёки
      if (h > 6) {
        g.fillStyle = 'rgba(92,52,26,0.30)';
        g.fillRect(px + 6 + h, py, 3, T);
      }
      if (RB.hash2(x, y, 22) > 0.7) {
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(px + 4, py + 8, T - 10, 5);
      }
      // кромки стен, граничащих с полом
      const floorAt = (dx, dy) => {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) return false;
        return world.grid[ny][nx] !== '#';
      };
      const edge = (side) => {
        g.fillStyle = 'rgba(150,128,96,0.20)';
        if (side === 'top') g.fillRect(px, py, T, 3);
        if (side === 'bottom') g.fillRect(px, py + T - 3, T, 3);
        if (side === 'left') g.fillRect(px, py, 3, T);
        if (side === 'right') g.fillRect(px + T - 3, py, 3, T);
      };
      // выцветший плакат с красной полосой
      if (RB.hash2(x, y, 31) > 0.94 && floorAt(0, 1)) {
        g.save();
        g.translate(px + T / 2, py + T - 6);
        g.rotate((RB.hash2(x, y, 32) - 0.5) * 0.25);
        g.fillStyle = 'rgba(198,188,162,0.32)';
        g.fillRect(-11, -15, 22, 15);
        g.fillStyle = 'rgba(163,39,27,0.45)';
        g.fillRect(-8, -11, 16, 3);
        g.fillStyle = 'rgba(40,32,24,0.4)';
        g.fillRect(-8, -6, 11, 1.5);
        g.fillRect(-8, -3, 8, 1.5);
        g.restore();
      }
      if (floorAt(0, -1)) edge('top');
      if (floorAt(0, 1)) edge('bottom');
      if (floorAt(-1, 0)) edge('left');
      if (floorAt(1, 0)) edge('right');
    }

    paintWallShadows(g, world) {
      for (let y = 0; y < world.h; y++) {
        for (let x = 0; x < world.w; x++) {
          if (world.grid[y][x] !== '#') continue;
          const px = x * T, py = y * T;
          const shadow = (rx, ry, rw, rh, grad) => {
            g.fillStyle = grad;
            g.fillRect(rx, ry, rw, rh);
          };
          const check = (dx, dy) => {
            const nx = x + dx, ny = y + dy;
            return nx >= 0 && ny >= 0 && nx < world.w && ny < world.h && world.grid[ny][nx] !== '#';
          };
          if (check(0, 1)) {
            const gr = g.createLinearGradient(0, py + T, 0, py + T + 14);
            gr.addColorStop(0, 'rgba(0,0,0,0.45)');
            gr.addColorStop(1, 'rgba(0,0,0,0)');
            shadow(px, py + T, T, 14, gr);
          }
          if (check(1, 0)) {
            const gr = g.createLinearGradient(px + T, 0, px + T + 14, 0);
            gr.addColorStop(0, 'rgba(0,0,0,0.35)');
            gr.addColorStop(1, 'rgba(0,0,0,0)');
            shadow(px + T, py, 14, T, gr);
          }
        }
      }
    }

    paintBarrel(g, cx, cy, r, seed) {
      const h = RB.hash2(seed, 3, 7);
      // тень
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath(); g.ellipse(cx + 3, cy + 4, r, r * 0.55, 0, 0, Math.PI * 2); g.fill();
      // корпус
      const grd = g.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.2, cx, cy, r);
      grd.addColorStop(0, h > 0.5 ? '#7d4a2c' : '#6a4529');
      grd.addColorStop(0.55, '#4a2f1d');
      grd.addColorStop(1, '#251710');
      g.fillStyle = grd;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      // обручи
      g.strokeStyle = 'rgba(150,120,80,0.55)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, r * 0.78, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(cx, cy, r * 0.46, 0, Math.PI * 2); g.stroke();
      // крышка
      g.fillStyle = 'rgba(20,12,8,0.55)';
      g.beginPath(); g.arc(cx, cy, r * 0.3, 0, Math.PI * 2); g.fill();
      // ржавые пятна
      g.fillStyle = 'rgba(140,80,40,0.45)';
      for (let i = 0; i < 4; i++) {
        const a = RB.hash2(seed, i, 9) * Math.PI * 2;
        const rr = RB.hash2(seed, i, 10) * r * 0.7;
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2 + RB.hash2(seed, i, 11) * 4, 1.5 + RB.hash2(seed, i, 12) * 3, a, 0, Math.PI * 2);
        g.fill();
      }
      // предупреждающая полоса
      g.save();
      g.beginPath(); g.arc(cx, cy, r * 0.92, 0.4, 1.15); g.strokeStyle = 'rgba(190,150,40,0.35)'; g.lineWidth = 4; g.stroke();
      g.restore();
    }

    paintCrate(g, cx, cy, s, seed) {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(cx - s / 2 + 3, cy - s / 2 + 4, s, s);
      g.fillStyle = '#4a3724';
      g.fillRect(cx - s / 2, cy - s / 2, s, s);
      g.strokeStyle = 'rgba(120,90,55,0.5)';
      g.lineWidth = 2;
      g.strokeRect(cx - s / 2 + 2, cy - s / 2 + 2, s - 4, s - 4);
      g.beginPath();
      g.moveTo(cx - s / 2 + 4, cy - s / 2 + 4);
      g.lineTo(cx + s / 2 - 4, cy + s / 2 - 4);
      g.moveTo(cx + s / 2 - 4, cy - s / 2 + 4);
      g.lineTo(cx - s / 2 + 4, cy + s / 2 - 4);
      g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(cx - s / 2, cy + s / 2 - 5, s, 5);
    }

    paintPillar(g, cx, cy) {
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.beginPath(); g.ellipse(cx + 5, cy + 7, 24, 18, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#332c24';
      g.fillRect(cx - 21, cy - 21, 42, 42);
      g.fillStyle = '#211c16';
      g.fillRect(cx - 17, cy - 17, 34, 34);
      g.strokeStyle = 'rgba(120,100,70,0.25)';
      g.strokeRect(cx - 21, cy - 21, 42, 42);
    }

    /* ---------- камера ---------- */
    cameraFor(world, player, dt) {
      const targetX = player.x - this.w / 2;
      const targetY = player.y - this.h / 2;
      const maxX = Math.max(0, world.pxW - this.w);
      const maxY = Math.max(0, world.pxH - this.h);
      const cx = RB.clamp(targetX, 0, maxX);
      const cy = RB.clamp(targetY, 0, maxY);
      if (!this.cam) this.cam = { x: cx, y: cy };
      const k = 1 - Math.pow(0.001, dt || 0.016);
      this.cam.x = RB.lerp(this.cam.x, cx, k);
      this.cam.y = RB.lerp(this.cam.y, cy, k);
      return this.cam;
    }

    /* ---------- основной кадр ---------- */
    draw(game, dt) {
      const ctx = this.ctx;
      const world = game.world;
      const player = game.player;
      if (!world || !player) return;
      this.t += dt;

      const shake = game.shakeMag || 0;
      const shx = shake ? RB.rand(-shake, shake) : 0;
      const shy = shake ? RB.rand(-shake, shake) : 0;

      const cam = this.cameraFor(world, player, dt);
      const camX = cam.x + shx, camY = cam.y + shy;

      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.fillStyle = '#070605';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.save();
      ctx.translate(-camX, -camY);

      if (!this.staticCanvas || this.staticWorld !== world) this.buildStatic(world);
      ctx.drawImage(this.staticCanvas, 0, 0);

      this.drawWaterAnim(ctx, world, camX, camY);
      this.drawDecals(ctx, world);
      this.drawSaltPuddles(ctx, world);
      this.drawLimbs(ctx, world);
      this.drawObjects(ctx, world, game);
      this.drawTracers(ctx, game);
      this.drawParticles(ctx, world);

      for (const e of world.enemies) if (!e.dead) this.drawEnemy(ctx, e, world);
      this.drawPlayer(ctx, player, world);

      ctx.restore();

      this.drawLighting(ctx, world, player, camX, camY, game);
      this.drawGlows(ctx, world, player, camX, camY, game);

      // виньетка
      if (this.vignette) ctx.drawImage(this.vignette, 0, 0);

      // урон: брызги крови на экране
      if (player.hurtFlash > 0) {
        ctx.fillStyle = `rgba(120,10,8,${player.hurtFlash * 0.30})`;
        ctx.fillRect(0, 0, this.w, this.h);
        const n = 7;
        for (let i = 0; i < n; i++) {
          const seed = i * 97 + Math.floor(player.hurtFlash * 10);
          const x = (RB.hash2(seed, i, 1) * this.w);
          const y = (RB.hash2(seed, i, 2) * this.h);
          const rr = 6 + RB.hash2(seed, i, 3) * 26;
          ctx.fillStyle = `rgba(110,12,8,${player.hurtFlash * 0.35})`;
          ctx.beginPath();
          ctx.ellipse(x, y, rr, rr * 0.55, RB.hash2(seed, i, 4) * 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // страх
      const fear = player.attention / 100;
      if (fear > 0.55) {
        const a = (fear - 0.55) / 0.45;
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 4.2);
        ctx.fillStyle = `rgba(70,4,4,${a * 0.16 * (0.6 + pulse * 0.4)})`;
        ctx.fillRect(0, 0, this.w, this.h);
      }
      // зерно: паттерн создаём один раз
      if (!game.lowQuality) {
        if (!this.grainPattern) this.grainPattern = ctx.createPattern(this.grain, 'repeat');
        ctx.save();
        ctx.globalAlpha = 0.045 + fear * 0.04;
        ctx.fillStyle = this.grainPattern;
        ctx.fillRect(0, 0, this.w, this.h);
        ctx.restore();
      }

      // «сканирование» при высоком ВНИМАНИИ
      if (player.attention > 65) {
        const a = RB.clamp((player.attention - 65) / 35, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.10 + 0.18 * a;
        ctx.fillStyle = '#050505';
        const bars = 2 + Math.floor(a * 6);
        for (let i = 0; i < bars; i++) {
          if (Math.random() < 0.65) {
            ctx.fillRect(0, Math.random() * this.h, this.w, 1 + Math.random() * 5);
          }
        }
        if (Math.random() < 0.35 + a * 0.3) {
          ctx.globalAlpha = 0.10 + 0.16 * a;
          ctx.fillStyle = '#a3271b';
          ctx.fillRect(0, Math.random() * this.h, this.w, 1.5);
        }
        ctx.restore();
      }

      // подсказка к цели
      this.drawObjectiveArrow(ctx, game, camX, camY);

      if (game.input) game.input.draw(ctx, this.w, this.h);
    }

    drawWaterAnim(ctx, world, camX, camY) {
      if (this.lowQuality) return;
      if (Math.floor(this.t * 30) % 2) return;
      const x0 = Math.max(0, Math.floor(camX / T) - 1);
      const y0 = Math.max(0, Math.floor(camY / T) - 1);
      const x1 = Math.min(world.w - 1, Math.ceil((camX + this.w) / T) + 1);
      const y1 = Math.min(world.h - 1, Math.ceil((camY + this.h) / T) + 1);
      ctx.save();
      ctx.strokeStyle = 'rgba(140,180,190,0.16)';
      ctx.lineWidth = 1;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (world.grid[y][x] !== '~') continue;
          if (RB.hash2(x, y, 6) < 0.5) continue;
          const ph = this.t * 1.2 + RB.hash2(x, y, 5) * 6.28;
          const px = x * T + T / 2 + Math.sin(ph) * 6;
          const py = y * T + T / 2 + Math.cos(ph * 0.8) * 4;
          ctx.beginPath();
          ctx.ellipse(px, py, 12, 2.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    drawLimbs(ctx, world) {
      for (const p of world.limbs || []) {
        if (p.taken) continue;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.seed);
        ctx.fillStyle = 'rgba(60,8,6,0.5)';
        ctx.beginPath(); ctx.ellipse(2, 3, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
        if (p.limb === 'head') {
          ctx.fillStyle = '#c9b18a';
          ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#2a0c08';
          ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = p.limb.indexOf('arm') === 0 ? '#8a6a4a' : '#6a5a48';
          ctx.fillRect(-9, -3, 18, 6);
          ctx.fillStyle = 'rgba(90,10,8,0.7)';
          ctx.fillRect(-9, -1, 18, 2);
        }
        ctx.restore();
      }
    }

    drawSaltPuddles(ctx, world) {
      for (const s of world.saltPuddles || []) {
        const g = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, s.r);
        g.addColorStop(0, 'rgba(225,220,200,0.55)');
        g.addColorStop(0.6, 'rgba(200,195,175,0.30)');
        g.addColorStop(1, 'rgba(200,195,175,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(240,236,220,0.35)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + s.x * 0.01;
          const rr = s.r * (0.3 + (i % 3) * 0.2);
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(a) * rr * 0.5, s.y + Math.sin(a) * rr * 0.5);
          ctx.lineTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr);
          ctx.stroke();
        }
      }
    }

    drawDecals(ctx, world) {
      for (const d of world.decals) {
        ctx.fillStyle = 'rgba(24,22,20,0.55)';
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.r, d.r * 0.7, d.seed, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(200,190,165,0.20)';
        ctx.fillRect(d.x + d.r * 0.2, d.y - 1, 3, 2);
      }
    }

    drawObjects(ctx, world, game) {
      for (const o of world.objects) {
        if (o.taken) continue;
        if (o.kind === 'note') this.drawNote(ctx, o);
        else if (o.kind === 'quest') this.drawQuestItem(ctx, o);
        else if (o.kind === 'item') this.drawItem(ctx, o);
        else if (o.kind === 'exit') this.drawExit(ctx, o, game);
        else if (o.kind === 'finale') continue;
        else if (o.kind === 'weapon') this.drawWeaponItem(ctx, o);
        else if (o.kind === 'shop') this.drawShop(ctx, o);
        else if (o.kind === 'trap') this.drawTrap(ctx, o);
        else if (o.kind === 'boss') continue;
        else if (o.kind === 'lamp') this.drawLampBase(ctx, o);
        else if (o.kind === 'corpse') this.drawCorpse(ctx, o);
        else if (o.kind === 'npc') this.drawNpc(ctx, o, world, game);
        else if (o.kind === 'mail') this.drawMail(ctx, o);
        else if (o.kind === 'console') this.drawConsole(ctx, o, game);
      }
      if (world.finale) this.drawFinale(ctx, world.finale, game);
    }

    drawNote(ctx, o) {
      const bob = Math.sin(this.t * 2 + o.x) * 2;
      ctx.save();
      ctx.translate(o.x, o.y + bob);
      ctx.rotate(-0.15 + Math.sin(this.t + o.x) * 0.04);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-11, -8, 24, 20);
      ctx.fillStyle = '#d9cba8';
      ctx.fillRect(-12, -10, 24, 20);
      ctx.strokeStyle = 'rgba(80,60,40,0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-8, -5 + i * 5);
        ctx.lineTo(6, -5 + i * 5);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawQuestItem(ctx, o) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 3 + o.x * 0.01);
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.fillStyle = `rgba(190,120,50,${0.10 + pulse * 0.18})`;
      ctx.beginPath(); ctx.arc(0, 0, 26 + pulse * 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c98a3a';
      ctx.strokeStyle = '#2a1a10';
      ctx.lineWidth = 2;
      if (o.item === 'key') {
        ctx.beginPath(); ctx.arc(-4, 0, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(12, 0); ctx.lineTo(12, 5); ctx.stroke();
      } else if (o.item === 'valve') {
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + this.t;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
          ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
          ctx.stroke();
        }
      } else if (o.item === 'fuse') {
        ctx.fillRect(-5, -9, 10, 18);
        ctx.fillStyle = '#151210';
        ctx.fillRect(-5, -9, 10, 3);
        ctx.fillRect(-5, 6, 10, 3);
      } else {
        ctx.fillRect(-8, -6, 16, 12);
        ctx.strokeRect(-8, -6, 16, 12);
      }
      ctx.restore();
    }

    drawItem(ctx, o) {
      const bob = Math.sin(this.t * 3 + o.x * 0.05) * 2;
      const drop = o.dropStart ? -(1 - Math.min(1, (performance.now() - o.dropStart) / 280)) * 18 : 0;
      ctx.save();
      ctx.translate(o.x, o.y + bob + drop);
      const icon = RB.Assets ? RB.Assets.img(RB.Assets.icon(o.item, o.count)) : null;
      if (icon && RB.Assets.ready(icon)) {
        ctx.drawImage(icon, -11, -11, 22, 22);
        ctx.restore();
        return;
      }
      ctx.scale(0.62, 0.62);
      if (o.item === 'medkit') {
        ctx.fillStyle = '#d8d2c4';
        ctx.fillRect(-10, -8, 20, 16);
        ctx.fillStyle = '#a52020';
        ctx.fillRect(-3, -6, 6, 12);
        ctx.fillRect(-8, -2, 16, 4);
      } else if (o.item === 'ammo') {
        ctx.fillStyle = '#5b4a2a';
        ctx.fillRect(-9, -6, 18, 12);
        ctx.fillStyle = '#caa84e';
        for (let i = 0; i < 4; i++) ctx.fillRect(-7 + i * 4, -3, 2, 6);
      } else if (o.item === 'battery') {
        ctx.fillStyle = '#2c2c2a';
        ctx.fillRect(-5, -9, 10, 18);
        ctx.fillStyle = '#c7a13c';
        ctx.fillRect(-5, 6, 10, 3);
        ctx.fillStyle = '#8a8a80';
        ctx.fillRect(-2, -12, 4, 3);
      } else if (o.item === 'flare') {
        ctx.fillStyle = '#b03a2a';
        ctx.fillRect(-3, -10, 6, 20);
        ctx.fillStyle = '#e0d5a8';
        ctx.fillRect(-3, -12, 6, 4);
      } else if (o.item === 'painkiller') {
        ctx.fillStyle = '#d8d2c4';
        ctx.fillRect(-6, -8, 12, 16);
        ctx.fillStyle = '#7fae86';
        ctx.fillRect(-6, -8, 12, 4);
        ctx.fillStyle = '#3a3a34';
        ctx.fillRect(-3, -2, 6, 2);
      } else if (o.item === 'adrenaline') {
        ctx.fillStyle = '#c9c4b8';
        ctx.fillRect(-9, -3, 16, 5);
        ctx.fillStyle = '#b03a2a';
        ctx.fillRect(-2, -4, 5, 7);
        ctx.fillStyle = '#8a8a80';
        ctx.fillRect(7, -2, 6, 2);
      } else if (o.item === 'salt') {
        ctx.fillStyle = 'rgba(230,220,190,0.25)';
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d8cdb0';
        ctx.fillRect(-4, -8, 8, 16);
        ctx.fillStyle = '#8a2a1e';
        ctx.fillRect(-4, -8, 8, 3);
        ctx.fillStyle = '#f2ead6';
        ctx.fillRect(-2, 0, 4, 6);
      }
      ctx.restore();
    }

    drawCorpse(ctx, o) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.seed);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(3, 4, 22, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#453a30';
      ctx.beginPath(); ctx.ellipse(0, 0, 19, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7c6a52';
      ctx.beginPath(); ctx.arc(-16, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(60,8,6,0.5)';
      ctx.beginPath(); ctx.ellipse(4, 6, 16, 7, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawWeaponItem(ctx, o) {
      const w = RB.Weapons[o.weapon] || { color: '#c9a05a' };
      const bob = Math.sin(this.t * 2.5 + o.x) * 2;
      const drop = o.dropStart ? -(1 - Math.min(1, (performance.now() - o.dropStart) / 280)) * 18 : 0;
      ctx.save();
      ctx.translate(o.x, o.y + bob + drop);
      const icon = RB.Assets ? RB.Assets.img(RB.Assets.icon('w_' + o.weapon)) : null;
      if (icon && RB.Assets.ready(icon)) {
        ctx.drawImage(icon, -16, -8, 32, 16);
        ctx.restore();
        return;
      }
      ctx.scale(0.7, 0.7);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-15, -7, 30, 16);
      ctx.fillStyle = '#2a2620';
      ctx.fillRect(-16, -9, 32, 16);
      ctx.fillStyle = w.color;
      ctx.fillRect(-10, -6, 18, 3);
      ctx.fillStyle = 'rgba(220,210,180,0.7)';
      ctx.fillRect(-10, -1, 6, 6);
      ctx.restore();
    }

    drawShop(ctx, o) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-24, -16, 48, 34);
      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(-26, -20, 52, 30);
      ctx.fillStyle = '#c9a05a';
      ctx.fillRect(-26, -20, 52, 4);
      ctx.fillStyle = 'rgba(255,220,150,0.8)';
      ctx.beginPath(); ctx.arc(0, -26, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(217,203,168,0.85)';
      ctx.font = '9px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ТОВАР', 0, 24);
      ctx.restore();
    }

    drawMail(ctx, o) {
      const bob = Math.sin(this.t * 2 + o.x * 0.03) * 1.5;
      ctx.save();
      ctx.translate(o.x, o.y + bob);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-17, -12, 34, 28);
      ctx.fillStyle = '#2a2620';
      ctx.fillRect(-18, -16, 36, 26);
      ctx.fillStyle = '#0d1a10';
      ctx.fillRect(-14, -12, 28, 14);
      ctx.strokeStyle = '#7fae86';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-4, -4); ctx.lineTo(2, -8); ctx.stroke();
      ctx.fillStyle = '#c9a05a';
      ctx.fillRect(-14, 6, 28, 4);
      ctx.fillStyle = 'rgba(216,205,176,0.85)';
      ctx.font = '7px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ПОЧТА', 0, 19);
      ctx.restore();
    }

    drawConsole(ctx, o, game) {
      const ch = o.chapter || (game && game.chapter && game.chapter.id) || 1;
      const hacked = !!(game && game.flags && game.flags['console_' + ch]);
      const col = hacked ? '#e8dcc2' : '#8ee6a0';
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-20, -14, 40, 34);
      ctx.fillStyle = '#1a1c1a';
      ctx.fillRect(-19, -18, 38, 26);
      ctx.fillStyle = '#041006';
      ctx.fillRect(-16, -15, 32, 17);
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(this.t * 6 + o.x);
      for (let i = 0; i < 3; i++) ctx.fillRect(-13, -12 + i * 4, 10 + (i * 7) % 15, 1.5);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#2a2620';
      ctx.fillRect(-16, 4, 32, 5);
      for (let i = 0; i < 5; i++) ctx.fillRect(-14 + i * 6, 5, 4, 3);
      ctx.fillStyle = 'rgba(216,205,176,0.85)';
      ctx.font = '7px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(hacked ? 'ACCESS' : 'CONSOLE', 0, 21);
      ctx.restore();
    }

    drawTrap(ctx, o) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-14, -10, 28, 22);
      ctx.fillStyle = '#4a4a44';
      ctx.fillRect(-12, -12, 24, 18);
      ctx.strokeStyle = '#c9a05a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -3, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 4); ctx.stroke();
      ctx.restore();
    }

    drawNpc(ctx, o, world, game) {
      const npc = RB.Story.npcs[o.npcId];
      if (!npc) return;
      const done = game.flags && game.flags[npc.id];
      const t = this.t;
      ctx.save();
      ctx.translate(o.x, o.y);
      // тень
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(3, 8, 17, 8, 0, 0, Math.PI * 2); ctx.fill();
      // аура
      if (!done) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + o.x);
        ctx.fillStyle = `rgba(200,180,130,${0.05 + pulse * 0.06})`;
        ctx.beginPath(); ctx.arc(0, 0, 30 + pulse * 5, 0, Math.PI * 2); ctx.fill();
      }
      // балахон/пальто
      const g = ctx.createLinearGradient(0, -20, 0, 18);
      g.addColorStop(0, npc.color || '#8a8272');
      g.addColorStop(1, '#1d1b18');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-12, 16); ctx.lineTo(-9, -10); ctx.lineTo(9, -10); ctx.lineTo(12, 16);
      ctx.closePath(); ctx.fill();
      // голова
      ctx.fillStyle = '#c8b49a';
      ctx.beginPath(); ctx.arc(0, -16, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(20,18,15,0.75)';
      ctx.beginPath(); ctx.arc(0, -18, 7, Math.PI, Math.PI * 2); ctx.fill();
      // бирка на шее
      ctx.fillStyle = 'rgba(210,198,170,0.85)';
      ctx.fillRect(-3, -6, 6, 4);
      ctx.strokeStyle = 'rgba(40,35,28,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, -6); ctx.stroke();
      // маркер квеста
      if (!done) {
        ctx.fillStyle = `rgba(230,200,120,${0.7 + 0.3 * Math.sin(t * 4)})`;
        ctx.font = 'bold 13px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('!', 0, -32);
      }
      // имя
      ctx.font = '10px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(217,203,168,0.8)';
      ctx.fillText(npc.name.toUpperCase(), 0, 28);
      ctx.restore();
    }

    drawLampBase(ctx, o) {
      const flick = o.flicker ? (RB.hash2(Math.floor(this.t * 9), o.seed | 0, 3) > 0.25 ? 1 : 0.15) : 1;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.fillStyle = '#26211b';
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,220,150,${0.55 * flick})`;
      ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawExit(ctx, o, game) {
      const open = !o.locked;
      ctx.save();
      ctx.translate(o.x, o.y);
      // рама
      ctx.fillStyle = '#241d16';
      ctx.fillRect(-42, -46, 84, 92);
      ctx.strokeStyle = open ? '#5f7a4a' : '#6d3a26';
      ctx.lineWidth = 4;
      ctx.strokeRect(-42, -46, 84, 92);
      // створки
      ctx.fillStyle = open ? 'rgba(70,90,60,0.55)' : 'rgba(90,50,34,0.85)';
      ctx.fillRect(-38, -42, 36, 84);
      ctx.fillRect(2, -42, 36, 84);
      // штанги
      ctx.strokeStyle = 'rgba(190,170,130,0.35)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-34, -30 + i * 20);
        ctx.lineTo(34, -30 + i * 20);
        ctx.stroke();
      }
      ctx.fillStyle = open ? '#8fd47a' : '#e04a2a';
      ctx.beginPath(); ctx.arc(0, -52, 5, 0, Math.PI * 2); ctx.fill();
      if (open) {
        ctx.save();
        ctx.rotate(-0.1);
        ctx.strokeStyle = 'rgba(163,39,27,0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-28, -12, 56, 24);
        ctx.fillStyle = 'rgba(180,55,35,0.85)';
        ctx.font = 'bold 9px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ЭМБАРГО', 0, 1);
        ctx.restore();
      }
      ctx.restore();
    }

    drawFinale(ctx, o, game) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 1.6);
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.fillStyle = `rgba(160,40,30,${0.10 + pulse * 0.14})`;
        ctx.beginPath(); ctx.arc(0, 0, 60 + pulse * 10, 0, Math.PI * 2); ctx.fill();
        this.paintBarrel(ctx, 0, 0, 34, 9);
      ctx.fillStyle = 'rgba(230,220,190,0.8)';
      ctx.font = 'bold 15px Georgia';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('9', 0, -3);
      ctx.font = 'bold 9px Georgia';
      ctx.fillText('Б', 0, 10);
      ctx.restore();
    }

    drawTracers(ctx, game) {
      for (const t of game.tracers) {
        ctx.strokeStyle = `rgba(255,225,160,${Math.max(0, t.life / 0.06) * 0.8})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(t.x2, t.y2);
        ctx.stroke();
      }
    }

    drawParticles(ctx, world) {
      for (const p of world.particles) {
        const a = RB.clamp(p.life / 0.6, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    drawPlayer(ctx, p, world) {
      ctx.save();
      ctx.translate(p.x, p.y);
      // тень
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(3, 5, 16, 10, 0, 0, Math.PI * 2); ctx.fill();

      ctx.rotate(p.angle);
      const walk = Math.sin(p.walkPhase) * 3;
      const opm = !!(p.opm || (p.bald && p.cape));

      // красный плащ (пасхалка на Ванпанчмена)
      if (opm) {
        const flap = Math.sin(this.t * 5 + (p.walkPhase || 0)) * 2;
        ctx.fillStyle = '#a3271b';
        ctx.beginPath();
        ctx.moveTo(-4, -12);
        ctx.quadraticCurveTo(-26, -8 + flap, -23, 0);
        ctx.quadraticCurveTo(-26, 8 + flap, -4, 12);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#5e110c';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,210,160,0.16)';
        ctx.beginPath();
        ctx.moveTo(-8, -8);
        ctx.quadraticCurveTo(-18, 0, -8, 8);
        ctx.quadraticCurveTo(-13, 0, -8, -8);
        ctx.fill();
      }

      // ноги
      ctx.fillStyle = '#1a1c20';
      ctx.beginPath(); ctx.ellipse(-7, -6 + walk, 7, 4.5, 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-7, 6 - walk, 7, 4.5, -0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#101114';
      ctx.fillRect(-12, -7 + walk, 5, 3);
      ctx.fillRect(-12, 4 - walk, 5, 3);

      // куртка оператора
      const coat = ctx.createRadialGradient(-1, -4, 2, 0, 0, 19);
      coat.addColorStop(0, '#586274');
      coat.addColorStop(0.55, '#3a4350');
      coat.addColorStop(1, '#1c2027');
      ctx.fillStyle = coat;
      ctx.beginPath(); ctx.ellipse(-1, 0, 14, 11, 0, 0, Math.PI * 2); ctx.fill();
      // воротник и молния
      ctx.strokeStyle = 'rgba(160,170,180,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(4, -1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, 1); ctx.lineTo(-10, 4); ctx.stroke();
      // погоны
      ctx.fillStyle = 'rgba(150,160,170,0.3)';
      ctx.fillRect(-7, -11, 7, 3);
      ctx.fillRect(-7, 8, 7, 3);
      // красный пропуск
      ctx.fillStyle = 'rgba(163,39,27,0.8)';
      ctx.fillRect(-11, -2, 4, 4);
      ctx.fillStyle = 'rgba(226,216,190,0.75)';
      ctx.fillRect(-10.5, -1, 3, 1);
      // разгрузка
      ctx.fillStyle = 'rgba(30,28,24,0.55)';
      ctx.fillRect(-4, -8, 8, 3);

      // руки + оружие
      ctx.strokeStyle = '#3b4350';
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(2, 5);
      ctx.lineTo(14, 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, -5);
      ctx.lineTo(14, -2);
      ctx.stroke();
      ctx.fillStyle = '#b08a6c';
      ctx.beginPath(); ctx.arc(14, 2.5, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(14, -2.5, 2.2, 0, Math.PI * 2); ctx.fill();
      const wp = p.weapon || 'pistol';
      if (wp === 'pistol') {
        ctx.fillStyle = '#8f8a7c'; ctx.fillRect(12, -2, 12, 4);
        ctx.fillStyle = '#2c2a24'; ctx.fillRect(14, -3, 6, 6);
      } else if (wp === 'shotgun') {
        ctx.fillStyle = '#5a4630'; ctx.fillRect(10, -3, 26, 5);
        ctx.fillStyle = '#2c2a24'; ctx.fillRect(12, -4, 10, 7);
      } else if (wp === 'ak74') {
        ctx.fillStyle = '#3a3a34'; ctx.fillRect(10, -2, 30, 4);
        ctx.fillStyle = '#5a4a2a'; ctx.fillRect(16, 2, 8, 8);
        ctx.fillStyle = '#8fa7c9'; ctx.fillRect(30, -1, 3, 2);
      } else if (wp === 'flamethrower') {
        ctx.fillStyle = '#4a2a1a'; ctx.fillRect(6, -6, 10, 12);
        ctx.fillStyle = '#8a8a80'; ctx.fillRect(14, -2, 22, 5);
        ctx.fillStyle = '#d8452a'; ctx.fillRect(34, -1, 4, 3);
      } else if (wp === 'harpoon') {
        ctx.fillStyle = '#6a5a40'; ctx.fillRect(8, -2, 28, 4);
        ctx.fillStyle = '#7fae86'; ctx.fillRect(34, -1, 8, 2);
        ctx.strokeStyle = 'rgba(180,170,140,0.5)';
        ctx.beginPath(); ctx.moveTo(12, 3); ctx.lineTo(18, 8); ctx.stroke();
      }

      // голова
      ctx.fillStyle = '#2a201a';
      ctx.beginPath(); ctx.arc(1, 0, 7.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b08a6c';
      ctx.beginPath(); ctx.arc(3.2, 0, 6.1, 0, Math.PI * 2); ctx.fill();
      if (opm) {
        // лысина с бликом
        ctx.fillStyle = 'rgba(255,235,210,0.35)';
        ctx.beginPath(); ctx.arc(1.4, -2.2, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(90,60,40,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(1, 0, 6.2, Math.PI * 0.55, Math.PI * 1.45); ctx.stroke();
      } else {
        ctx.fillStyle = '#241b15';
        ctx.beginPath(); ctx.arc(1.2, 0, 6.2, Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.arc(5, 1.5, 1.1, 0, Math.PI * 2); ctx.fill();

      // фонарь
      if (p.flashlight && p.battery > 0) {
        ctx.fillStyle = 'rgba(255,240,180,0.95)';
        ctx.beginPath(); ctx.arc(23, -7, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,240,180,0.18)';
        ctx.beginPath(); ctx.arc(23, -7, 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // анимация перезарядки
      if (p.reloadTimer > 0) {
        const total = p.reloadTotal || 1.5;
        const k = RB.clamp(1 - p.reloadTimer / total, 0, 1);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.strokeStyle = 'rgba(197,106,53,0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
        ctx.stroke();
        // магазин/патрон двигается к оружию
        const ang = p.angle;
        const mx = Math.cos(ang) * (18 + 10 * Math.sin(k * Math.PI));
        const my = Math.sin(ang) * (18 + 10 * Math.sin(k * Math.PI));
        ctx.translate(mx, my);
        ctx.rotate(ang);
        ctx.fillStyle = '#c9a05a';
        ctx.fillRect(-2, -6 + (1 - k) * 8, 4, 9);
        ctx.fillStyle = '#3a3a34';
        ctx.fillRect(-4, -8 + (1 - k) * 8, 8, 3);
        ctx.restore();
      }

      // индикатор
      if (p.invuln > 0 && Math.floor(this.t * 20) % 2 === 0) {
        ctx.strokeStyle = 'rgba(220,60,40,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2); ctx.stroke();
      }
    }

    drawEnemy(ctx, e, world) {
      const d = e.def;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath(); ctx.ellipse(3, 6, e.r * 1.1, e.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(e.angle);

      const hurt = e.hitFlash;
      if (e.type === 'boss') {
        const wob = Math.sin(e.bob * 2) * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.ellipse(0, 0, 26, 20, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hurt > 0 ? '#6a5a4a' : '#2a2620';
        ctx.beginPath(); ctx.ellipse(0, 0, 25, 21 + wob, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#b8a88c';
        ctx.beginPath(); ctx.arc(-6, 0, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#120e0a';
        ctx.beginPath(); ctx.arc(-8, -3, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-8, 3, 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#8a8a80';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(6, -14); ctx.lineTo(24, -20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6, 14); ctx.lineTo(24, 20); ctx.stroke();
        ctx.fillStyle = 'rgba(163,39,27,0.6)';
        ctx.fillRect(-14, 10, 8, 6);
      } else if (e.type === 'sledok') {
        const wob = Math.sin(e.bob * 2) * 1.2;
        // руки-ветви
        ctx.strokeStyle = '#2c2a26';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(19, -14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2, 10); ctx.lineTo(19, 14); ctx.stroke();
        // тёмное пальто
        const grd = ctx.createRadialGradient(-4, -4, 3, 0, 0, 22);
        grd.addColorStop(0, hurt > 0 ? '#8d8577' : '#4c4a43');
        grd.addColorStop(0.6, hurt > 0 ? '#6a6255' : '#2c2b27');
        grd.addColorStop(1, '#151412');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(0, 0, 18, 14 + wob * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        // белая маска без глаз
        ctx.fillStyle = hurt > 0 ? '#fffaf0' : '#e4ddc8';
        ctx.beginPath(); ctx.ellipse(-5, 0, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(70,60,50,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-9, -1); ctx.lineTo(-1, -1); ctx.stroke();
        // лист в руке
        ctx.fillStyle = 'rgba(226,216,190,0.85)';
        ctx.save();
        ctx.translate(14, -14);
        ctx.rotate(-0.3 + wob * 0.05);
        ctx.fillRect(-5, -6, 10, 13);
        ctx.strokeStyle = 'rgba(60,50,40,0.5)';
        ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(3, -2); ctx.stroke();
        ctx.restore();
        if (e.frozen) {
          ctx.strokeStyle = 'rgba(255,245,210,0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(255,245,210,0.10)';
          ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
        }
      } else if (e.type === 'svidetel') {
        const wob = Math.sin(e.bob * 3) * 3;
        // вытянутое бледное тело
        const grd = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
        grd.addColorStop(0, hurt > 0 ? '#fff8ea' : '#cfd2c4');
        grd.addColorStop(0.65, '#8e958a');
        grd.addColorStop(1, '#3d443f');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(0, 0, 18 + wob, 8, 0, 0, Math.PI * 2); ctx.fill();
        // длинные руки
        ctx.strokeStyle = '#dfe3d6';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(6, -6); ctx.lineTo(26, -13 + wob); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6, 6); ctx.lineTo(26, 13 - wob); ctx.stroke();
        // голова с пустыми глазницами
        ctx.fillStyle = hurt > 0 ? '#fffaf0' : '#e8e8dc';
        ctx.beginPath(); ctx.arc(11, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1a18';
        ctx.beginPath(); ctx.arc(14, -2, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(14, 2, 1.8, 0, Math.PI * 2); ctx.fill();
        // «приглашение» — лента на шее
        ctx.strokeStyle = 'rgba(163,39,27,0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(6, 5); ctx.lineTo(12, 9); ctx.stroke();
      } else if (e.type === 'cultist') {
        const wob = Math.sin(e.bob * 2.5) * 2;
        const grd = ctx.createRadialGradient(0, -4, 3, 0, 0, 22);
        grd.addColorStop(0, hurt > 0 ? '#fff8ea' : '#ddd6c4');
        grd.addColorStop(0.7, hurt > 0 ? '#cfc4a8' : '#8f8672');
        grd.addColorStop(1, '#3a342a');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(0, 0, 15, 18 + wob * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a2620';
        ctx.beginPath(); ctx.arc(-2, 0, 7.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c9b18a';
        ctx.beginPath(); ctx.arc(-4, 0, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(200,190,160,0.9)';
        ctx.fillRect(-1, 8, 6, 4);
        ctx.strokeStyle = '#8a8a80';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(8, -10);
        ctx.lineTo(20, -14);
        ctx.arc(20, -10, 4, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(110,18,12,0.55)';
        ctx.beginPath(); ctx.ellipse(4, 6, 5, 7, 0.3, 0, Math.PI * 2); ctx.fill();
      } else {
        const wob = Math.sin(e.bob * 4) * 2;
        // обрывки бумаги
        ctx.fillStyle = hurt > 0 ? '#e6dcc2' : '#bdb298';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + wob * 0.1;
          ctx.save();
          ctx.rotate(a);
          ctx.fillRect(2, -3, 9, 6);
          ctx.restore();
        }
        ctx.fillStyle = '#3a352c';
        ctx.beginPath(); ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d8cdb0';
        ctx.beginPath(); ctx.arc(-6, -2, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-6, 2, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // культи и состояния
      if (!e.limbs || !e.limbs.head) {
        const hx = e.type === 'svidetel' ? 11 : e.type === 'obryvok' ? -6 : -4;
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);
        ctx.fillStyle = '#2a0c08';
        ctx.beginPath(); ctx.ellipse(hx, 0, 8, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(120,14,10,0.8)';
        ctx.fillRect(hx - 3, -6, 6, 2);
        ctx.restore();
      }
      if (e.pinned > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(127,174,134,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, 24, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.angle) * 26, e.y + Math.sin(e.angle) * 26); ctx.stroke();
        ctx.restore();
      }
      if (e.collectMode) {
        ctx.save();
        ctx.fillStyle = 'rgba(120,14,10,0.35)';
        ctx.beginPath(); ctx.ellipse(e.x - 10, e.y + 8, 14, 5, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      if (e.hp < e.maxHp) {
        const w = 34;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 16, w, 4);
        ctx.fillStyle = '#a12a1e';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 16, w * (e.hp / e.maxHp), 4);
      }
    }

    /* ---------- свет ---------- */
    drawLighting(ctx, world, player, camX, camY, game) {
      const l = this.lctx;
      const w = this.w, h = this.h;
      l.setTransform(1, 0, 0, 1, 0, 0);
      l.globalCompositeOperation = 'source-over';
      l.clearRect(0, 0, w, h);
      const dk = RB.clamp((world.darkness || 0.9) - (player.saltVision > 0 ? 0.3 : 0), 0.45, 0.95);
      l.fillStyle = `rgba(4,4,6,${dk})`;
      l.fillRect(0, 0, w, h);

      l.globalCompositeOperation = 'destination-out';

      const px = player.x - camX;
      const py = player.y - camY;

      // круг вокруг игрока: спереди видно, сзади — нет
      const ambient = player.saltVision > 0 ? 190 : 152;
      l.save();
      if (player.saltVision <= 0) {
        l.beginPath();
        l.moveTo(px, py);
        l.arc(px, py, ambient, player.angle - 2.15, player.angle + 2.15);
        l.closePath();
        l.clip();
      }
      l.drawImage(this.ambientSprite, px - ambient, py - ambient, ambient * 2, ambient * 2);
      l.restore();
      let grd;

      // конус фонаря
      if (player.flashlight && player.battery > 0) {
        const len = 590;
        const spread = 0.46;
        l.save();
        l.beginPath();
        l.moveTo(px, py);
        l.arc(px, py, len, player.angle - spread, player.angle + spread);
        l.closePath();
        l.clip();
        grd = l.createRadialGradient(px, py, 30, px, py, len);
        grd.addColorStop(0, 'rgba(0,0,0,1)');
        grd.addColorStop(0.28, 'rgba(0,0,0,0.96)');
        grd.addColorStop(0.62, 'rgba(0,0,0,0.72)');
        grd.addColorStop(0.86, 'rgba(0,0,0,0.28)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        l.fillStyle = grd;
        l.fillRect(px - len, py - len, len * 2, len * 2);
        l.restore();
      }

      // вспышка выстрела
      if (player.muzzle > 0.05) {
        grd = l.createRadialGradient(px, py, 10, px, py, 300);
        grd.addColorStop(0, `rgba(0,0,0,${0.9 * player.muzzle})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        l.fillStyle = grd;
        l.fillRect(0, 0, w, h);
      }

      // лампы
      for (const o of world.objects) {
        if (o.kind !== 'lamp') continue;
        const ox = o.x - camX, oy = o.y - camY;
        if (ox < -220 || oy < -220 || ox > w + 220 || oy > h + 220) continue;
        let flick = 1;
        if (o.flicker) flick = RB.hash2(Math.floor(this.t * 9), o.seed | 0, 3) > 0.25 ? 1 : 0.2;
        const rad = (o.radius || 150) * (0.9 + flick * 0.1);
        l.globalAlpha = flick;
        l.drawImage(this.lampSprite, ox - rad, oy - rad, rad * 2, rad * 2);
        l.globalAlpha = 1;
      }

      // выход
      const ex = world.exitObj.x - camX, ey = world.exitObj.y - camY;
      l.globalAlpha = 0.6;
      l.drawImage(this.lampSprite, ex - 130, ey - 130, 260, 260);
      l.globalAlpha = 1;

      if (world.finale) {
        const fx = world.finale.x - camX, fy = world.finale.y - camY;
        l.globalAlpha = 0.75;
        l.drawImage(this.lampSprite, fx - 170, fy - 170, 340, 340);
        l.globalAlpha = 1;
      }

      ctx.drawImage(this.light, 0, 0);

      if (player.redLight > 0) {
        const a = Math.min(1, player.redLight) * 0.42;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(px, py, 20, px, py, 560);
        rg.addColorStop(0, `rgba(220,30,20,${a})`);
        rg.addColorStop(0.5, `rgba(160,20,12,${a * 0.45})`);
        rg.addColorStop(1, 'rgba(120,10,6,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.arc(px, py, 560, player.angle - 0.5, player.angle + 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // тёплое свечение поверх (аддитивно)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (player.flashlight && player.battery > 0) {
        const g2 = ctx.createRadialGradient(px, py, 20, px, py, 380);
        g2.addColorStop(0, 'rgba(255,226,160,0.045)');
        g2.addColorStop(1, 'rgba(255,226,160,0)');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.arc(px, py, 380, player.angle - 0.4, player.angle + 0.4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    drawGlows(ctx, world, player, camX, camY, game) {
      if (game.lowQuality) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const o of world.objects) {
        if (o.kind !== 'lamp') continue;
        const ox = o.x - camX, oy = o.y - camY;
        if (ox < -100 || oy < -100 || ox > this.w + 100 || oy > this.h + 100) continue;
        let flick = 1;
        if (o.flicker) flick = RB.hash2(Math.floor(this.t * 9), o.seed | 0, 3) > 0.25 ? 1 : 0.15;
        ctx.globalAlpha = 0.11 * flick;
        ctx.drawImage(this.warmSprite, ox - 80, oy - 80, 160, 160);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    drawObjectiveArrow(ctx, game, camX, camY) {
      const p = game.player;
      const target = game.nearestObjective();
      if (!target) return;
      const d = RB.dist(p.x, p.y, target.x, target.y);
      if (d < 320) return;
      const ang = Math.atan2(target.y - p.y, target.x - p.x);
      const px = p.x - camX, py = p.y - camY;
      const dist = 70;
      const ax = px + Math.cos(ang) * dist;
      const ay = py + Math.sin(ang) * dist;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(this.t * 3);
      ctx.fillStyle = '#c9a05a';
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  RB.Renderer = Renderer;
})();

