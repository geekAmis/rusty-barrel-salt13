/* ============================================================
   RUSTY BARREL — PIXEL SIDE-VIEW RENDERER
   Низкое разрешение + параллакс + псевдо-3D глубина.
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});
  const T = 48;

  class PixelRenderer {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.low = document.createElement('canvas');
      this.lctx = this.low.getContext('2d');
      this.light = document.createElement('canvas');
      this.lightCtx = this.light.getContext('2d');
      this.w = 1; this.h = 1; this.scale = 3;
      this.cam = { x: 0, y: 0 };
      this.t = 0;
      this.staticCanvas = null;
      this.staticWorld = null;
      this.lowQuality = false;
      this.resize();
    }

    resize() {
      const rect = this.cv.getBoundingClientRect();
      this.w = Math.max(1, Math.floor(rect.width));
      this.h = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cv.width = Math.floor(this.w * dpr);
      this.cv.height = Math.floor(this.h * dpr);
      this.dpr = dpr;
      this.scale = Math.max(2, Math.round(this.w / 440));
      this.low.width = Math.ceil(this.w / this.scale);
      this.low.height = Math.ceil(this.h / this.scale);
      this.light.width = this.low.width;
      this.light.height = this.low.height;
      this.lctx.imageSmoothingEnabled = false;
      this.lightCtx.imageSmoothingEnabled = false;
      this.ctx.imageSmoothingEnabled = false;
    }

    buildStatic() {}

    cameraFor(world, player) {
      const targetX = player.x + (player.vx || 0) * 0.12 - this.w / 2;
      const targetY = player.y - this.h / 2 - 40;
      const maxX = Math.max(0, world.pxW - this.w);
      const maxY = Math.max(0, world.pxH - this.h);
      const cx = RB.clamp(targetX, 0, maxX);
      const cy = RB.clamp(targetY, 0, maxY);
      if (!this.cam) this.cam = { x: cx, y: cy };
      this.cam.x = cx;
      this.cam.y = cy;
      return this.cam;
    }

    sx(x) { return Math.round((x - this.cam.x) / this.scale); }
    sy(y) { return Math.round((y - this.cam.y) / this.scale); }
    ss(v) { return Math.max(1, Math.round(v / this.scale)); }

    draw(game, dt) {
      this.t += dt;
      const world = game.world;
      const p = game.player;
      if (!world || !p) return;
      if (world.mode === 'iso') { this.drawIso(game, dt); return; }
      const cam = this.cameraFor(world, p);
      const g = this.lctx;
      const W = this.low.width, H = this.low.height;
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#070605';
      g.fillRect(0, 0, W, H);

      this.drawParallax(g, cam, W, H);
      this.drawWorld(g, world, cam, W, H);
      this.drawDecals(g, world);
      this.drawObjects(g, world, game);
      this.drawLimbs(g, world);
      this.drawProjectiles(g, world);
      this.drawCorpses(g, world);
      for (const e of world.enemies) if (!e.dead) this.drawEnemy(g, e);
      this.drawPlayer(g, p);
      this.drawParticles(g, world);
      this.drawLighting(g, world, p, W, H, game);
      this.drawFog(g, W, H, p);

      this.drawCrosshair(g, game, W, H);

      // апскейл на экран
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.cv.width, this.cv.height);
      ctx.drawImage(this.low, 0, 0, this.cv.width, this.cv.height);

      if (game.input) {
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        game.input.draw(ctx, this.w, this.h);
      }
    }

    drawCrosshair(g, game, W, H) {
      const p = game.player;
      if (!p || p.dead) return;
      let dist = 150;
      const ang = p.angle;
      for (let d = 18; d < 240; d += 6) {
        if (game.world.solidAt(p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d)) {
          dist = d - 6;
          break;
        }
      }
      let cx, cy;
      if (game.world.mode === 'iso') {
        const hit = RB.Iso.project(
          p.x + Math.cos(ang) * dist,
          p.y + Math.sin(ang) * dist,
          W, H
        );
        cx = hit.x;
        cy = hit.y;
      } else {
        cx = this.sx(p.x + Math.cos(ang) * dist);
        cy = this.sy(p.y + Math.sin(ang) * dist) - 6;
      }
      const alpha = this.crossAlpha != null ? this.crossAlpha : 1;
      g.save();
      g.globalAlpha = alpha;
      const fear = RB.clamp(p.attention / 100, 0, 1);
      const shake = 1 + fear * fear * 7;
      cx += RB.rand(-shake, shake);
      cy += RB.rand(-shake, shake);
      const col = fear > 0.66 ? '#d8452a' : fear > 0.33 ? '#c9a05a' : '#e6dcc2';
      const gap = 2, len = 4;
      g.strokeStyle = 'rgba(0,0,0,0.75)';
      g.lineWidth = 2;
      const draw = (ox, oy) => {
        g.beginPath();
        g.moveTo(cx - gap - len + ox, cy + oy);
        g.lineTo(cx - gap + ox, cy + oy);
        g.moveTo(cx + gap + ox, cy + oy);
        g.lineTo(cx + gap + len + ox, cy + oy);
        g.moveTo(cx + ox, cy - gap - len + oy);
        g.lineTo(cx + ox, cy - gap + oy);
        g.moveTo(cx + ox, cy + gap + oy);
        g.lineTo(cx + ox, cy + gap + len + oy);
        g.stroke();
      };
      draw(0, 0);
      g.strokeStyle = col;
      g.lineWidth = 1;
      draw(0, 0);
      g.fillStyle = col;
      g.fillRect(cx - 1, cy - 1, 2, 2);
      g.restore();
    }

    drawIso(game, dt) {
      const world = game.world;
      const p = game.player;
      const g = this.lctx;
      const W = this.low.width, H = this.low.height;
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#070605';
      g.fillRect(0, 0, W, H);

      const proj = (x, y) => RB.Iso.project(x, y, W, H);
      const T = 48;

      // пол под всеми тайлами
      for (let ty = 0; ty < world.h; ty++) {
        for (let tx = 0; tx < world.w; tx++) {
          const c = proj(tx * T + T / 2, ty * T + T / 2);
          const grime = ((tx * 7 + ty * 13) % 5) / 100;
          g.fillStyle = ((tx + ty) % 2 === 0) ? '#2f3d34' : '#26332c';
          g.beginPath();
          g.moveTo(c.x, c.y - 8); g.lineTo(c.x + 12, c.y);
          g.lineTo(c.x, c.y + 8); g.lineTo(c.x - 12, c.y);
          g.closePath(); g.fill();
          g.strokeStyle = 'rgba(90,110,95,0.30)';
          g.lineWidth = 1;
          g.stroke();
          if (grime > 0.01) {
            g.fillStyle = 'rgba(10,14,12,' + (0.18 + grime) + ')';
            g.beginPath();
            g.moveTo(c.x, c.y - 5); g.lineTo(c.x + 7, c.y + 1);
            g.lineTo(c.x, c.y + 6); g.lineTo(c.x - 7, c.y + 1);
            g.closePath(); g.fill();
          }
        }
      }

      // высокие объекты: стены, колонны, ящики
      const solids = [];
      for (let ty = 0; ty < world.h; ty++) {
        for (let tx = 0; tx < world.w; tx++) {
          const ch = world.grid[ty][tx];
          if (ch === '#' || ch === 'C' || ch === 'P') {
            solids.push({ solid: true, ch, tx, ty, depth: tx + ty + 1 });
          }
        }
      }

      const drawBlock = (c, h, top, left, right, edge) => {
        g.fillStyle = top;
        g.beginPath();
        g.moveTo(c.x, c.y - h - 8); g.lineTo(c.x + 12, c.y - h);
        g.lineTo(c.x, c.y - h + 8); g.lineTo(c.x - 12, c.y - h);
        g.closePath(); g.fill();
        g.fillStyle = left;
        g.beginPath();
        g.moveTo(c.x - 12, c.y - h); g.lineTo(c.x, c.y - h + 8);
        g.lineTo(c.x, c.y + 8); g.lineTo(c.x - 12, c.y);
        g.closePath(); g.fill();
        g.fillStyle = right;
        g.beginPath();
        g.moveTo(c.x + 12, c.y - h); g.lineTo(c.x, c.y - h + 8);
        g.lineTo(c.x, c.y + 8); g.lineTo(c.x + 12, c.y);
        g.closePath(); g.fill();
        g.strokeStyle = edge; g.lineWidth = 1; g.globalAlpha = 0.55;
        g.beginPath();
        g.moveTo(c.x - 12, c.y - h); g.lineTo(c.x, c.y - h + 8);
        g.lineTo(c.x + 12, c.y - h); g.moveTo(c.x, c.y - h + 8);
        g.lineTo(c.x, c.y + 8);
        g.stroke();
        g.globalAlpha = 1;
      };

      const drawSolid = (s) => {
        const c = proj(s.tx * T + T / 2, s.ty * T + T / 2);
        if (s.ch === '#') {
          drawBlock(c, 28, '#46564b', '#1b2520', '#27342c', '#0b100d');
        } else if (s.ch === 'C') {
          // колонна: узкий высокий блок
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.beginPath(); g.ellipse(c.x, c.y + 2, 12, 5, 0, 0, Math.PI * 2); g.fill();
          drawBlock(c, 48, '#5a6a5e', '#2c3a32', '#3a4a40', '#101712');
          g.fillStyle = '#6f8072';
          g.fillRect(c.x - 1, c.y - 50, 2, 40);
        } else if (s.ch === 'P') {
          // ящик/бочка
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.beginPath(); g.ellipse(c.x, c.y + 2, 9, 4, 0, 0, Math.PI * 2); g.fill();
          drawBlock(c, 18, '#7a5a36', '#3a2a1a', '#4a3622', '#160f08');
          g.fillStyle = 'rgba(201,160,90,0.5)';
          g.fillRect(c.x - 7, c.y - 18, 14, 2);
        }
      };

      const drawObject = (o) => {
        const c = proj(o.x, o.y);
        if (o.kind === 'isoExit') {
          const pulse = 0.5 + 0.5 * Math.sin(this.t * 2.5);
          g.fillStyle = 'rgba(127,174,134,' + (0.10 + pulse * 0.10) + ')';
          g.beginPath(); g.arc(c.x, c.y - 12, 20, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#2a2018'; g.fillRect(c.x - 8, c.y - 28, 16, 30);
          g.strokeStyle = '#7fae86'; g.lineWidth = 1; g.strokeRect(c.x - 8, c.y - 28, 16, 30);
          g.fillStyle = '#7fae86'; g.fillRect(c.x - 1, c.y - 20, 2, 10);
          g.fillStyle = 'rgba(210,230,200,0.85)';
          g.font = '6px monospace'; g.textAlign = 'center';
          g.fillText('ВЫХОД', c.x, c.y - 32);
        } else if (o.kind === 'note') {
          g.fillStyle = '#d8ceb0'; g.fillRect(c.x - 5, c.y - 8, 10, 10);
          g.fillStyle = '#6a5a40'; g.fillRect(c.x - 3, c.y - 6, 6, 1);
        } else if (o.kind === 'item' || o.kind === 'weapon') {
          g.fillStyle = '#c9c4b8'; g.fillRect(c.x - 5, c.y - 5, 10, 8);
          g.fillStyle = '#2a2620'; g.fillRect(c.x - 3, c.y - 3, 6, 4);
        } else if (o.kind === 'stash') {
          g.fillStyle = '#3a2a1c'; g.fillRect(c.x - 9, c.y - 10, 18, 11);
          g.fillStyle = '#c9a05a'; g.fillRect(c.x - 2, c.y - 7, 4, 5);
          g.strokeStyle = '#c9a05a'; g.lineWidth = 1; g.strokeRect(c.x - 9, c.y - 10, 18, 11);
        } else if (o.kind === 'craft') {
          g.fillStyle = '#3a2a1c'; g.fillRect(c.x - 12, c.y - 11, 24, 9);
          g.fillStyle = '#7fae86'; g.fillRect(c.x - 7, c.y - 16, 5, 4);
          g.fillStyle = '#c9a05a'; g.fillRect(c.x + 2, c.y - 15, 4, 3);
          g.fillStyle = 'rgba(127,174,134,0.18)'; g.fillRect(c.x - 14, c.y - 18, 28, 20);
        }
      };

      const items = [];
      for (const s of solids) items.push({ solid: s, depth: s.depth });
      for (const o of world.objects) {
        if (o.taken) continue;
        items.push({ obj: o, depth: (o.x + o.y) / T });
      }
      const ents = [];
      for (const e of world.enemies) if (!e.dead) ents.push({ ent: e, depth: (e.x + e.y) / T });
      ents.push({ ent: p, depth: (p.x + p.y) / T, player: true });
      for (const e of ents) items.push(e);
      items.sort((a, b) => a.depth - b.depth);

      for (const item of items) {
        if (item.solid) { drawSolid(item.solid); continue; }
        if (item.obj) { drawObject(item.obj); continue; }
        const ent = item.ent;
        const c = proj(ent.x, ent.y);
        const ang = ent.angle || 0;
        const sang = RB.Iso.worldAngleToScreen(ang);
        const dir = Math.cos(sang) >= 0 ? 1 : -1;
        const L = ent.limbs || { armL: true, armR: true, legL: true, legR: true, head: true };
        const walk = Math.sin((ent.bob || 0) * 6) * 2;
        if (item.player) {
          g.fillStyle = 'rgba(0,0,0,0.45)';
          g.beginPath(); g.ellipse(c.x, c.y + 2, 8, 4, 0, 0, Math.PI * 2); g.fill();
          this.drawHumanoid(g, ent, c.x, c.y + 2, 0.92);
          if (ent.flashlight && ent.battery > 0) {
            g.save();
            g.globalAlpha = 0.16;
            g.fillStyle = '#ffe9a8';
            g.beginPath();
            g.moveTo(c.x, c.y - 16);
            g.lineTo(c.x + Math.cos(sang - 0.4) * 40, c.y - 16 + Math.sin(sang - 0.4) * 40);
            g.lineTo(c.x + Math.cos(sang + 0.4) * 40, c.y - 16 + Math.sin(sang + 0.4) * 40);
            g.closePath(); g.fill();
            g.restore();
          }
        } else {
          const hurt = ent.hitFlash > 0;
          g.fillStyle = 'rgba(0,0,0,0.4)';
          g.beginPath(); g.ellipse(c.x, c.y + 1, 8, 4, 0, 0, Math.PI * 2); g.fill();
          const legs = (L.legL ? 1 : 0) + (L.legR ? 1 : 0);
          if (legs > 0) {
            g.fillStyle = '#1a1c20';
            if (L.legL) g.fillRect(c.x - 5, c.y - 7, 4, 9);
            if (L.legR) g.fillRect(c.x + 1, c.y - 7, 4, 9);
          }
          const col = ent.type === 'cultist' ? '#d8d0bc'
            : ent.type === 'svidetel' ? '#b8c4b8'
            : ent.def && ent.def.isBoss ? '#2a2620' : '#4c4a43';
          g.fillStyle = hurt ? '#e0d6c4' : col;
          g.fillRect(c.x - 7, c.y - 24, 14, 17);
          g.fillStyle = 'rgba(0,0,0,0.45)';
          g.fillRect(c.x - 7, c.y - 8, 14, 2);
          if (L.armL) {
            g.strokeStyle = col; g.lineWidth = 3;
            g.beginPath(); g.moveTo(c.x - 6, c.y - 20); g.lineTo(c.x - 11, c.y - 12 + walk); g.stroke();
          }
          if (L.armR) {
            g.strokeStyle = col; g.lineWidth = 3;
            g.beginPath(); g.moveTo(c.x + 6, c.y - 20); g.lineTo(c.x + 11, c.y - 12 - walk); g.stroke();
          }
          if (L.head) {
            g.fillStyle = ent.type === 'cultist' ? '#2a2620' : '#c8b49a';
            g.fillRect(c.x - 4, c.y - 32, 8, 8);
            g.fillStyle = '#151210';
            g.fillRect(c.x + dir * 1, c.y - 29, 2, 2);
          } else {
            g.fillStyle = '#5a120c';
            g.fillRect(c.x - 4, c.y - 26, 8, 3);
          }
          if (ent.attackWindup > 0) {
            g.fillStyle = '#d8452a';
            g.fillRect(c.x - 1, c.y - 42, 2, 7);
            g.fillRect(c.x - 1, c.y - 34, 2, 2);
          }
        }
      }

      const pp = proj(p.x, p.y);
      const l = this.lightCtx;
      l.setTransform(1, 0, 0, 1, 0, 0);
      l.globalCompositeOperation = 'source-over';
      l.clearRect(0, 0, W, H);
      l.fillStyle = 'rgba(4,5,6,0.6)';
      l.fillRect(0, 0, W, H);
      l.globalCompositeOperation = 'destination-out';
      let grd = l.createRadialGradient(pp.x, pp.y, 3, pp.x, pp.y, 46);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = grd;
      l.beginPath(); l.arc(pp.x, pp.y, 46, 0, Math.PI * 2); l.fill();
      if (p.flashlight && p.battery > 0) {
        const len = 110, spread = 0.62;
        l.save();
        l.beginPath(); l.moveTo(pp.x, pp.y);
        l.arc(pp.x, pp.y, len, p.angle - spread, p.angle + spread);
        l.closePath(); l.clip();
        grd = l.createRadialGradient(pp.x, pp.y, 4, pp.x, pp.y, len);
        grd.addColorStop(0, 'rgba(0,0,0,0.95)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        l.fillStyle = grd;
        l.fillRect(pp.x - len, pp.y - len, len * 2, len * 2);
        l.restore();
      }
      g.drawImage(this.light, 0, 0);

      const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.38)');
      g.fillStyle = vg;
      g.fillRect(0, 0, W, H);

      this.drawCrosshair(g, game, W, H);
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.low, 0, 0, this.cv.width, this.cv.height);
      if (game.input) {
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        game.input.draw(ctx, this.w, this.h);
      }
    }

    drawParallax(g, cam, W, H) {
      // дальний слой: силуэты завода
      const farX = cam.x * 0.12;
      g.fillStyle = '#19221f';
      for (let i = -1; i < 12; i++) {
        const bx = ((i * 60 - (farX / this.scale) % 60) + W + 60) % (W + 120) - 60;
        const bh = 30 + ((i * 37) % 45);
        g.fillRect(bx, H - bh - 10, 34, bh);
        g.fillStyle = '#0a0d0e';
        g.fillRect(bx + 8, H - bh - 22, 6, 12);
        g.fillStyle = '#19221f';
      }
      // средний слой: стены и трубы
      const midX = cam.x * 0.35;
      g.fillStyle = '#1d2623';
      g.fillRect(0, H * 0.18, W, H);
      for (let i = -1; i < 10; i++) {
        const bx = ((i * 84 - (midX / this.scale) % 84) + W + 84) % (W + 168) - 84;
        g.fillStyle = 'rgba(30,38,36,0.55)';
        g.fillRect(bx, H * 0.2, 30, H * 0.8);
        g.fillStyle = 'rgba(20,26,24,0.7)';
        g.fillRect(bx + 34, H * 0.26, 8, H * 0.74);
        g.fillStyle = 'rgba(60,70,62,0.12)';
        g.fillRect(bx + 4, H * 0.35, 2, H * 0.5);
      }
      // провода и плакаты
      for (let i = -1; i < 12; i++) {
        const bx = ((i * 96 - (midX / this.scale) % 96) + W + 96) % (W + 192) - 96;
        g.strokeStyle = 'rgba(70, 62, 50, 0.45)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(bx, 0);
        g.quadraticCurveTo(bx + 18, H * 0.22, bx + 44, 0);
        g.stroke();
        if (i % 3 === 0) {
          g.fillStyle = 'rgba(180, 170, 145, 0.10)';
          g.fillRect(bx + 10, H * 0.30, 14, 18);
          g.fillStyle = 'rgba(163, 39, 27, 0.30)';
          g.fillRect(bx + 12, H * 0.33, 10, 3);
        }
      }
      // туман глубины
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, 'rgba(4,6,7,0.55)');
      grd.addColorStop(0.55, 'rgba(4,6,7,0.25)');
      grd.addColorStop(1, 'rgba(4,6,7,0.65)');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    }

    drawWorld(g, world, cam, W, H) {
      const x0 = Math.max(0, Math.floor(cam.x / T) - 1);
      const x1 = Math.min(world.w - 1, Math.ceil((cam.x + this.w) / T) + 1);
      const y0 = Math.max(0, Math.floor(cam.y / T) - 1);
      const y1 = Math.min(world.h - 1, Math.ceil((cam.y + this.h) / T) + 1);
      const ts = this.ss(T);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const ch = world.grid[ty][tx];
          const px = this.sx(tx * T);
          const py = this.sy(ty * T);
          if (ch === '.') continue;
          if (ch === '#') {
            const h = RB.hash2(tx, ty, 11);
            g.fillStyle = h > 0.5 ? '#5c675f' : '#525c56';
            g.fillRect(px, py, ts, ts);
            g.fillStyle = 'rgba(80,90,78,0.22)';
            g.fillRect(px, py, ts, 1);
            g.fillStyle = 'rgba(0,0,0,0.45)';
            g.fillRect(px, py + ts - 2, ts, 2);
            if (h > 0.7) {
              g.fillStyle = 'rgba(120,70,40,0.16)';
              g.fillRect(px + 2, py + 3, 2, ts - 6);
            }
          } else if (ch === '=') {
            g.fillStyle = '#b08a5c';
            g.fillRect(px, py, ts, Math.max(2, ts * 0.22));
            g.fillStyle = 'rgba(200,160,100,0.35)';
            g.fillRect(px, py, ts, 1);
            g.fillStyle = 'rgba(0,0,0,0.4)';
            g.fillRect(px, py + Math.max(2, ts * 0.22), ts, 1);
          } else if (ch === '~') {
            g.fillStyle = '#122226';
            g.fillRect(px, py, ts, ts);
            g.fillStyle = 'rgba(110,160,160,0.18)';
            const wob = Math.sin(this.t * 2 + tx) * 2;
            g.fillRect(px, py + ts * 0.35 + wob, ts, 1);
          } else if (ch === 'B' || ch === 'C' || ch === 'P') {
            if (ch === 'B') {
              g.fillStyle = '#4a2c1b';
              g.fillRect(px + 1, py + 1, ts - 2, ts - 2);
              g.fillStyle = 'rgba(160,110,60,0.4)';
              g.fillRect(px + 2, py + ts * 0.28, ts - 4, 1);
              g.fillRect(px + 2, py + ts * 0.7, ts - 4, 1);
            } else if (ch === 'C') {
              g.fillStyle = '#3a2a1a';
              g.fillRect(px + 1, py + 1, ts - 2, ts - 2);
              g.strokeStyle = 'rgba(160,120,70,0.4)';
              g.strokeRect(px + 2, py + 2, ts - 4, ts - 4);
            } else {
              g.fillStyle = '#2c3330';
              g.fillRect(px + 2, py + 2, ts - 4, ts - 4);
            }
          } else if (ch === '^') {
            g.fillStyle = '#8a8a80';
            for (let k = 0; k < 4; k++) {
              g.beginPath();
              g.moveTo(px + k * ts / 4, py + ts);
              g.lineTo(px + k * ts / 4 + ts / 8, py + ts * 0.4);
              g.lineTo(px + k * ts / 4 + ts / 4, py + ts);
              g.closePath();
              g.fill();
            }
          }
        }
      }
    }

    drawDecals(g, world) {
      for (const d of world.decals || []) {
        g.fillStyle = 'rgba(40,10,8,0.5)';
        g.fillRect(this.sx(d.x) - 4, this.sy(d.y) - 1, 8, 3);
      }
      for (const s of world.saltPuddles || []) {
        g.fillStyle = 'rgba(220,214,196,0.35)';
        g.fillRect(this.sx(s.x - s.r) / 1, this.sy(s.y), this.ss(s.r * 2), 3);
      }
    }

    drawObjects(g, world, game) {
      for (const o of world.objects) {
        if (o.taken) continue;
        const x = this.sx(o.x), y = this.sy(o.y);
        if (o.kind === 'note') {
          g.fillStyle = '#d8ceb0'; g.fillRect(x - 4, y - 5, 9, 11);
          g.fillStyle = '#6a5a40'; g.fillRect(x - 2, y - 3, 5, 1); g.fillRect(x - 2, y, 5, 1);
        } else if (o.kind === 'quest') {
          const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
          g.fillStyle = `rgba(200,150,70,${0.3 + pulse * 0.4})`;
          g.fillRect(x - 7, y - 7, 14, 14);
          g.fillStyle = '#c9a05a'; g.fillRect(x - 3, y - 3, 6, 6);
        } else if (o.kind === 'item' || o.kind === 'weapon') {
          const iconId = o.kind === 'weapon' ? 'w_' + o.weapon : o.item;
          const d = RB.Items && RB.Items.get(iconId);
          const slot = d && d.slot;
          if (slot === 'hat' || slot === 'helmet') {
            g.fillStyle = d.outfit && (d.outfit.hat || d.outfit.helmet) || '#c9c4b8';
            g.fillRect(x - 6, y - 7, 12, 4);
            g.fillRect(x - 4, y - 11, 8, 5);
          } else if (slot === 'shirt' || slot === 'sweater' || slot === 'jacket') {
            g.fillStyle = d.outfit && (d.outfit.shirt || d.outfit.sweater || d.outfit.coat) || '#c9c4b8';
            g.fillRect(x - 5, y - 9, 10, 9);
            g.fillRect(x - 8, y - 8, 3, 6); g.fillRect(x + 5, y - 8, 3, 6);
          } else if (slot === 'pants') {
            g.fillStyle = d.outfit && d.outfit.pants || '#4a4a4a';
            g.fillRect(x - 5, y - 9, 10, 5);
            g.fillRect(x - 5, y - 4, 4, 8); g.fillRect(x + 1, y - 4, 4, 8);
          } else if (slot === 'boots') {
            g.fillStyle = d.outfit && d.outfit.boots || '#2a2a2a';
            g.fillRect(x - 6, y - 4, 5, 8); g.fillRect(x + 1, y - 4, 5, 8);
          } else if (slot === 'armor' || slot === 'rps') {
            g.fillStyle = d.outfit && (d.outfit.armor || d.outfit.rps) || '#4a4a3a';
            g.fillRect(x - 6, y - 9, 12, 10);
            g.fillStyle = 'rgba(0,0,0,0.35)';
            g.fillRect(x - 4, y - 6, 3, 4); g.fillRect(x + 1, y - 6, 3, 4);
          } else {
            g.fillStyle = o.kind === 'weapon' ? '#8fa7c9' : '#c9c4b8';
            g.fillRect(x - 5, y - 4, 10, 8);
            g.fillStyle = '#2a2620'; g.fillRect(x - 3, y - 2, 6, 4);
          }
          const im = RB.Assets && RB.Assets.img(RB.Assets.icon(iconId, o.count));
          if (RB.Assets && RB.Assets.ready(im)) {
            g.drawImage(im, x - 9, y - 14, 18, 18);
          }
        } else if (o.kind === 'mail') {
          g.fillStyle = '#2a2620'; g.fillRect(x - 7, y - 12, 14, 12);
          g.fillStyle = '#0d1a10'; g.fillRect(x - 5, y - 10, 10, 5);
          g.strokeStyle = '#7fae86'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(x - 4, y - 9); g.lineTo(x - 1, y - 7); g.lineTo(x + 2, y - 9); g.stroke();
          g.fillStyle = '#c9a05a'; g.fillRect(x - 7, y - 2, 14, 2);
          g.fillStyle = 'rgba(127,174,134,0.18)'; g.fillRect(x - 9, y - 14, 18, 16);
        } else if (o.kind === 'console') {
          const hacked = !!(game && game.flags && game.flags['console_' + (o.chapter || game.chapter.id)]);
          g.fillStyle = '#1a1c1a'; g.fillRect(x - 8, y - 14, 16, 14);
          g.fillStyle = '#041006'; g.fillRect(x - 6, y - 12, 12, 8);
          g.fillStyle = hacked ? '#e8dcc2' : '#8ee6a0';
          g.fillRect(x - 4, y - 10, 7, 1); g.fillRect(x - 4, y - 8, 5, 1);
          g.fillStyle = '#2a2620'; g.fillRect(x - 7, y - 1, 14, 2);
          g.fillStyle = 'rgba(142,230,160,0.16)'; g.fillRect(x - 10, y - 16, 20, 18);
        } else if (o.kind === 'exit') {
          g.fillStyle = '#2a2018'; g.fillRect(x - 12, y - 28, 24, 36);
          g.strokeStyle = o.locked ? '#a3271b' : '#7fae86'; g.lineWidth = 2;
          g.strokeRect(x - 12, y - 28, 24, 36);
        } else if (o.kind === 'shop') {
          g.fillStyle = '#3a2a1c'; g.fillRect(x - 12, y - 12, 24, 18);
          g.fillStyle = '#c9a05a'; g.fillRect(x - 12, y - 12, 24, 2);
          g.fillStyle = 'rgba(255,220,150,0.7)'; g.fillRect(x - 1, y - 16, 2, 2);
        } else if (o.kind === 'trap') {
          g.fillStyle = '#4a4a44'; g.fillRect(x - 7, y - 10, 14, 10);
          g.strokeStyle = '#c9a05a'; g.lineWidth = 1; g.strokeRect(x - 6, y - 9, 12, 8);
        } else if (o.kind === 'checkpoint') {
          g.fillStyle = '#2a2620'; g.fillRect(x - 1, y - 22, 2, 22);
          g.fillStyle = o.taken ? '#7fae86' : '#c9a05a';
          g.fillRect(x - 5, y - 24, 11, 4);
          g.fillStyle = 'rgba(255,220,150,0.25)'; g.fillRect(x - 7, y - 26, 15, 8);
        } else if (o.kind === 'gamble') {
          g.fillStyle = '#3a2a1c'; g.fillRect(x - 9, y - 6, 18, 6);
          g.fillStyle = '#e8dcc2'; g.fillRect(x - 6, y - 9, 4, 4); g.fillRect(x + 2, y - 8, 4, 4);
          g.fillStyle = '#1a1512'; g.fillRect(x - 5, y - 8, 1, 1); g.fillRect(x + 3, y - 7, 1, 1);
        } else if (o.kind === 'secret') {
          g.fillStyle = '#3a2f24'; g.fillRect(x - 9, y - 26, 18, 28);
          g.strokeStyle = '#c9a05a'; g.lineWidth = 1; g.strokeRect(x - 9, y - 26, 18, 28);
          g.strokeStyle = 'rgba(0,0,0,0.6)';
          g.beginPath(); g.moveTo(x - 4, y - 24); g.lineTo(x + 2, y - 14); g.lineTo(x - 3, y - 4); g.stroke();
          g.fillStyle = 'rgba(201,160,90,0.25)'; g.fillRect(x - 12, y - 29, 24, 33);
        } else if (o.kind === 'rescue') {
          g.fillStyle = '#2a2620'; g.fillRect(x - 1, y - 30, 2, 30);
          g.fillStyle = '#b8a88c'; g.fillRect(x - 6, y - 24, 12, 13);
          g.fillStyle = '#5a120c'; g.fillRect(x - 5, y - 16, 10, 2);
          g.fillStyle = '#c9a05a'; g.fillRect(x - 7, y - 26, 14, 2);
          g.fillStyle = 'rgba(201,160,90,0.2)'; g.fillRect(x - 10, y - 30, 20, 34);
        } else if (o.kind === 'puzzle') {
          g.fillStyle = '#1e2a30'; g.fillRect(x - 9, y - 16, 18, 18);
          g.strokeStyle = o.done ? '#7fae86' : '#8fa7c9'; g.lineWidth = 2;
          g.strokeRect(x - 9, y - 16, 18, 18);
          g.fillStyle = o.done ? '#7fae86' : '#c9a05a';
          g.fillRect(x - 4, y - 11, 8, 2); g.fillRect(x - 4, y - 7, 8, 2);
        } else if (o.kind === 'shelter') {
          g.fillStyle = '#2a2018'; g.fillRect(x - 8, y - 26, 16, 28);
          g.fillStyle = '#4a3724'; g.fillRect(x - 7, y - 25, 14, 26);
          g.fillStyle = '#c9a05a'; g.fillRect(x + 3, y - 15, 2, 4);
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x - 5, y - 23, 10, 3);
        } else if (o.kind === 'craft') {
          g.fillStyle = '#3a2a1c'; g.fillRect(x - 12, y - 12, 24, 10);
          g.fillStyle = '#6a5a40'; g.fillRect(x - 12, y - 14, 24, 3);
          g.fillStyle = '#c9a05a'; g.fillRect(x - 8, y - 18, 4, 4);
          g.fillStyle = '#7fae86'; g.fillRect(x + 3, y - 17, 5, 3);
          g.fillStyle = 'rgba(127,174,134,0.2)'; g.fillRect(x - 15, y - 20, 30, 22);
        } else if (o.kind === 'stash') {
          g.fillStyle = '#3a2a1c'; g.fillRect(x - 9, y - 12, 18, 14);
          g.fillStyle = '#6a5a40'; g.fillRect(x - 9, y - 12, 18, 3);
          g.fillStyle = '#c9a05a'; g.fillRect(x - 2, y - 7, 4, 5);
          g.fillStyle = 'rgba(201,160,90,0.18)'; g.fillRect(x - 11, y - 14, 22, 18);
        } else if (o.kind === 'bosskey') {
          g.fillStyle = '#c9a05a'; g.fillRect(x - 7, y - 5, 10, 3);
          g.fillRect(x + 2, y - 9, 3, 9); g.fillRect(x + 5, y - 5, 3, 3);
          g.fillStyle = 'rgba(216,69,42,0.4)'; g.fillRect(x - 9, y - 11, 16, 13);
        } else if (o.kind === 'key') {
          g.fillStyle = '#c9a05a'; g.fillRect(x - 6, y - 5, 9, 3);
          g.fillRect(x + 1, y - 8, 3, 8); g.fillRect(x + 4, y - 5, 3, 3);
          g.fillStyle = 'rgba(201,160,90,0.3)'; g.fillRect(x - 8, y - 10, 14, 12);
        } else if (o.kind === 'button') {
          g.fillStyle = '#2a2620'; g.fillRect(x - 8, y - 5, 16, 5);
          g.fillStyle = o.pressed ? '#7fae86' : '#a3271b';
          g.fillRect(x - 5, o.pressed ? y - 7 : y - 10, 10, 4);
        } else if (o.kind === 'sigil') {
          const pulse = 0.5 + 0.5 * Math.sin(this.t * 2.5);
          g.strokeStyle = o.done ? '#7fae86' : '#c9a05a'; g.lineWidth = 2;
          g.beginPath(); g.arc(x, y - 10, 11, 0, Math.PI * 2); g.stroke();
          g.beginPath(); g.arc(x, y - 10, 5 + pulse * 2, 0, Math.PI * 2); g.stroke();
          g.fillStyle = o.done ? '#7fae86' : '#c9a05a';
          g.fillRect(x - 1, y - 15, 2, 10);
        } else if (o.kind === 'lever') {
          g.fillStyle = '#2a2620'; g.fillRect(x - 3, y - 14, 6, 14);
          g.fillStyle = o.on ? '#7fae86' : '#c9a05a';
          g.fillRect(x - 1, o.on ? y - 12 : y - 18, 8, 3);
        } else if (o.kind === 'cache') {
          g.fillStyle = '#4a3724'; g.fillRect(x - 7, y - 10, 14, 10);
          g.fillStyle = '#c9a05a'; g.fillRect(x - 7, y - 10, 14, 2);
          g.fillStyle = 'rgba(255,220,150,0.22)'; g.fillRect(x - 9, y - 12, 18, 14);
        } else if (o.kind === 'clue') {
          g.fillStyle = '#2a2620'; g.fillRect(x - 6, y - 8, 12, 8);
          g.fillStyle = '#8fa7c9'; g.fillRect(x - 2, y - 6, 4, 4);
          g.fillStyle = 'rgba(143,167,201,0.3)'; g.fillRect(x - 8, y - 10, 16, 12);
        } else if (o.kind === 'door') {
          g.fillStyle = '#241d16'; g.fillRect(x - 10, y - 30, 20, 32);
          g.strokeStyle = '#a3271b'; g.lineWidth = 2; g.strokeRect(x - 10, y - 30, 20, 32);
          g.fillStyle = '#6d3a26'; g.fillRect(x - 7, y - 27, 14, 26);
        } else if (o.kind === 'elevator') {
          const open = o.anim || 0;
          g.fillStyle = '#1a1512'; g.fillRect(x - 14, y - 34, 28, 36);
          g.strokeStyle = o.dir === 'up' ? '#c9a05a' : '#8fa7c9';
          g.lineWidth = 2; g.strokeRect(x - 14, y - 34, 28, 36);
          g.fillStyle = '#3a2f24';
          g.fillRect(x - 12 + open * 11, y - 30, 10, 28);
          g.fillRect(x + 2 - open * 11, y - 30, 10, 28);
        } else if (o.kind === 'npc') {
          const npc = RB.Story.npcs[o.npcId];
          g.fillStyle = npc ? npc.color : '#8a8272';
          g.fillRect(x - 5, y - 22, 10, 22);
          g.fillStyle = '#c8b49a'; g.fillRect(x - 3, y - 28, 6, 6);
          g.fillStyle = 'rgba(210,198,170,0.9)'; g.fillRect(x - 2, y - 18, 4, 3);
        } else if (o.kind === 'corpse') {
          g.fillStyle = '#3a2f26'; g.fillRect(x - 8, y - 3, 16, 5);
        }
      }
      if (world.finale) {
        const f = world.finale;
        const x = this.sx(f.x), y = this.sy(f.y);
        g.fillStyle = '#4a2c1b'; g.fillRect(x - 10, y - 14, 20, 24);
        g.fillStyle = 'rgba(220,70,50,0.25)'; g.fillRect(x - 14, y - 18, 28, 32);
        g.fillStyle = '#d8ceb0'; g.font = '8px monospace'; g.textAlign = 'center';
        g.fillText('9', x, y);
      }
    }

    drawCorpses(g, world) {
      if (!world.corpses) return;
      for (const c of world.corpses) {
        const x = this.sx(c.x), y = this.sy(c.y);
        const a = c.life / 40;
        g.save();
        g.globalAlpha = Math.min(1, a + 0.25);
        g.fillStyle = 'rgba(90,10,8,0.5)';
        g.beginPath(); g.ellipse(x, y + 8, 14, 5, 0, 0, Math.PI * 2); g.fill();
        g.translate(x, y + 6);
        g.rotate(c.angle + Math.PI / 2);
        g.fillStyle = '#22201a';
        g.fillRect(-7, -5, 14, 10);
        g.fillStyle = '#4a4338';
        g.fillRect(-4, -12, 8, 7);
        g.restore();
      }
    }

    drawProjectiles(g, world) {
      if (!world.projectiles) return;
      for (const pr of world.projectiles) {
        const x = this.sx(pr.x), y = this.sy(pr.y);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x - 2, y + 8, 5, 2);
        g.fillStyle = '#b8a88c';
        g.fillRect(x - 2, y - 2, 4, 4);
        g.strokeStyle = 'rgba(201,160,90,0.45)';
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - pr.vx * 0.02, y - pr.vy * 0.02); g.stroke();
      }
    }

    drawLimbs(g, world) {
      for (const l of world.limbs || []) {
        if (l.taken) continue;
        g.fillStyle = '#7a5a40';
        g.fillRect(this.sx(l.x) - 3, this.sy(l.y) - 2, 6, 4);
      }
    }

    drawParticles(g, world) {
      for (const p of world.particles) {
        g.globalAlpha = RB.clamp(p.life / 0.6, 0, 1);
        g.fillStyle = p.color;
        g.fillRect(this.sx(p.x), this.sy(p.y), Math.max(1, this.ss(p.size * 2)), Math.max(1, this.ss(p.size * 2)));
      }
      g.globalAlpha = 1;
    }

    drawHumanoid(g, p, x, feet, scale) {
      scale = scale || 1;
      const o = p.outfit || {};
      const skin = o.skin || '#b08a6c';
      const skinD = o.skinDark || '#8a6650';
      const dir = (p.facing || 1) >= 0 ? 1 : -1;
      const phase = p.walkPhase || 0;
      const moving = Math.abs(p.vx || 0) > 10 || !!p.sprinting;
      const swing = moving ? Math.sin(phase) * 3.2 * scale : 0;
      const bob = (moving ? Math.abs(Math.sin(phase * 2)) * 0.7 : Math.sin(this.t * 1.6) * 0.45) * scale;
      const lean = (p.sprinting ? 2 : 0) * scale * dir;
      const aim = p.angle || 0;
      const aimDir = Math.cos(aim) >= 0 ? 1 : -1;
      const dead = !!p.dead;

      g.save();
      if (dead) {
        g.translate(x, feet);
        g.rotate(-Math.PI / 2 * 0.9);
        g.translate(-x, -feet + 6 * scale);
      }
      g.translate(lean, 0);

      // ноги
      const hipY = feet - 13 * scale + bob;
      const legW = 3.4 * scale;
      const pants = o.pants || (p.naked ? skin : '#23272d');
      const pantsD = o.pantsDark || (p.naked ? skinD : '#16191d');
      const boot = o.boots || '#141414';
      const bootD = o.bootsDark || '#0a0a0a';
      const legSwing = moving ? swing : 0;
      // задняя нога
      g.fillStyle = pantsD;
      g.fillRect(x - 4.2 * scale, hipY, legW, 10 * scale);
      g.fillRect(x - 4.4 * scale + legSwing * 0.4, hipY + 10 * scale, legW + 0.8 * scale, 3 * scale);
      g.fillStyle = bootD;
      g.fillRect(x - 5 * scale + legSwing * 0.5, feet - 3 * scale, 5 * scale, 3 * scale);
      // передняя нога
      g.fillStyle = pants;
      g.fillRect(x + 0.8 * scale, hipY, legW, 10 * scale);
      g.fillRect(x + 0.4 * scale - legSwing * 0.4, hipY + 10 * scale, legW + 0.8 * scale, 3 * scale);
      g.fillStyle = boot;
      g.fillRect(x - 0.4 * scale - legSwing * 0.5, feet - 3 * scale, 5 * scale, 3 * scale);

      // торс / одежда
      const torsoTop = feet - 27 * scale + bob;
      const torsoH = 15 * scale;
      const torsoW = 11 * scale;
      const shirt = o.shirt || '#6a6a5a';
      const coat = o.coat;
      if (p.naked || (!coat && !o.shirt && !o.sweater && !o.jacket)) {
        g.fillStyle = skin;
        g.fillRect(x - torsoW / 2, torsoTop + 2 * scale, torsoW, torsoH - 2 * scale);
        g.fillStyle = '#2a2620';
        g.fillRect(x - torsoW / 2, torsoTop + torsoH * 0.62, torsoW, 4 * scale);
        g.fillStyle = skinD;
        g.fillRect(x - torsoW / 2, torsoTop + 2 * scale, 1.4 * scale, torsoH - 2 * scale);
      } else {
        g.fillStyle = o.sweater || shirt;
        g.fillRect(x - torsoW / 2, torsoTop, torsoW, torsoH);
        g.fillStyle = skinD;
        g.fillRect(x - 1.4 * scale, torsoTop, 2.8 * scale, 2.4 * scale);
        if (coat || o.jacket) {
          const outer = coat || o.jacket;
          g.fillStyle = outer;
          g.beginPath();
          g.moveTo(x - torsoW / 2 - 1.4 * scale, torsoTop + 1 * scale);
          g.lineTo(x + torsoW / 2 + 1.4 * scale, torsoTop + 1 * scale);
          g.lineTo(x + torsoW / 2 + 1.8 * scale, feet - 8 * scale);
          g.lineTo(x - torsoW / 2 - 1.8 * scale, feet - 8 * scale);
          g.closePath(); g.fill();
          g.fillStyle = o.coatDark || '#252b34';
          g.fillRect(x - torsoW / 2 - 1.8 * scale, feet - 10 * scale, torsoW + 3.6 * scale, 2 * scale);
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.fillRect(x - 0.6 * scale, torsoTop + 1 * scale, 1.2 * scale, torsoH);
        }
      }

      // броня / РПС
      if (o.armor || o.rps) {
        g.fillStyle = o.rps || o.armor || '#4a4a40';
        g.fillRect(x - torsoW / 2 + 0.5 * scale, torsoTop + 3 * scale, torsoW - 1 * scale, 8 * scale);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x - torsoW / 2 + 1.5 * scale, torsoTop + 5 * scale, 2.4 * scale, 3 * scale);
        g.fillRect(x + 0.6 * scale, torsoTop + 5 * scale, 2.4 * scale, 3 * scale);
        g.fillRect(x - torsoW / 2 + 1.5 * scale, torsoTop + 9 * scale, 2.4 * scale, 2 * scale);
      }

      // руки
      const shoulderY = torsoTop + 2.5 * scale;
      const armSwing = moving ? -swing * 0.8 : 0;
      const glove = o.gloves || skinD;
      // задняя рука
      g.strokeStyle = coat || o.jacket || shirt || skin;
      g.lineWidth = 2.6 * scale;
      g.beginPath();
      g.moveTo(x - dir * 3.5 * scale, shoulderY);
      g.lineTo(x - dir * 5.5 * scale + armSwing * 0.5, shoulderY + 9 * scale);
      g.stroke();
      g.fillStyle = glove;
      g.fillRect(x - dir * 6 * scale + armSwing * 0.5, shoulderY + 8 * scale, 2.4 * scale, 2.4 * scale);

      // передняя рука с оружием
      const handX = x + Math.cos(aim) * 10 * scale;
      const handY = torsoTop + 5 * scale + Math.sin(aim) * 7 * scale;
      g.strokeStyle = coat || o.jacket || shirt || skin;
      g.lineWidth = 3 * scale;
      g.beginPath();
      g.moveTo(x + dir * 3.5 * scale, shoulderY);
      g.lineTo(handX, handY);
      g.stroke();
      g.fillStyle = glove;
      g.beginPath(); g.arc(handX, handY, 1.7 * scale, 0, Math.PI * 2); g.fill();
      // оружие
      const wid = p.weapon;
      if (wid) {
        const len = wid === 'ak74' ? 10 : wid === 'shotgun' ? 9 : wid === 'flamethrower' ? 8 : wid === 'harpoon' ? 9 : 6;
        g.strokeStyle = '#1a1a1a'; g.lineWidth = 1.7 * scale;
        g.beginPath();
        g.moveTo(handX, handY);
        g.lineTo(handX + Math.cos(aim) * len * scale, handY + Math.sin(aim) * len * scale);
        g.stroke();
        if (wid === 'flamethrower') {
          g.fillStyle = '#3a4a40';
          g.fillRect(x - dir * 6 * scale, torsoTop + 4 * scale, 3 * scale, 8 * scale);
        }
      }

      // голова
      const headY = torsoTop - 7 * scale;
      const opm = !!(p.opm || (p.bald && p.cape));
      if (opm) {
        const flap = Math.sin(this.t * 5 + phase) * 2.2 * scale;
        g.fillStyle = '#a3271b';
        g.beginPath();
        g.moveTo(x - dir * 3 * scale, torsoTop + 1 * scale);
        g.quadraticCurveTo(x - dir * 11 * scale, torsoTop + 9 * scale + flap, x - dir * 10 * scale, feet - 12 * scale);
        g.quadraticCurveTo(x - dir * 6 * scale, feet - 14 * scale, x - dir * 2 * scale, feet - 15 * scale);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,210,160,0.18)';
        g.fillRect(x - dir * 6 * scale, torsoTop + 5 * scale, 1.4 * scale, 9 * scale);
      }
      g.fillStyle = skinD;
      g.fillRect(x - 1.4 * scale, torsoTop - 1.5 * scale, 2.8 * scale, 2.5 * scale);
      g.fillStyle = skin;
      g.fillRect(x - 3.4 * scale, headY, 6.8 * scale, 7 * scale);
      g.fillStyle = skinD;
      g.fillRect(x - 3.4 * scale, headY, 1.2 * scale, 7 * scale);
      // волосы
      if (!o.hat && !o.helmet && !o.mask && !opm) {
        g.fillStyle = '#2a1e16';
        g.fillRect(x - 3.8 * scale, headY - 1 * scale, 7.6 * scale, 2.4 * scale);
        g.fillRect(x - 3.8 * scale, headY - 0.4 * scale, 1.6 * scale, 4 * scale);
      }
      if (opm) {
        g.fillStyle = 'rgba(255,235,210,0.4)';
        g.fillRect(x - 2.4 * scale, headY + 0.6 * scale, 2.2 * scale, 1.2 * scale);
      }
      // глаза
      g.fillStyle = '#151210';
      g.fillRect(x + dir * 0.8 * scale, headY + 2.6 * scale, 1.1 * scale, 1.1 * scale);
      g.fillRect(x - dir * 2 * scale, headY + 2.6 * scale, 0.9 * scale, 0.9 * scale);
      // шлем / кепка
      if (o.helmet) {
        g.fillStyle = o.helmet;
        g.beginPath();
        g.moveTo(x - 4.2 * scale, headY + 1 * scale);
        g.lineTo(x + 4.2 * scale, headY + 1 * scale);
        g.lineTo(x + 3.2 * scale, headY - 2.8 * scale);
        g.lineTo(x - 3.2 * scale, headY - 2.8 * scale);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x - 4.4 * scale, headY + 0.8 * scale, 8.8 * scale, 1.2 * scale);
      } else if (o.hat) {
        g.fillStyle = o.hat;
        g.fillRect(x - 4.2 * scale, headY - 1.8 * scale, 8.4 * scale, 2.6 * scale);
        g.fillRect(x - 5 * scale + dir * 1 * scale, headY + 0.6 * scale, 5 * scale, 1.2 * scale);
      }
      if (o.mask) {
        g.fillStyle = o.mask;
        g.fillRect(x - 3.2 * scale, headY + 2 * scale, 6.4 * scale, 3.6 * scale);
        g.fillStyle = 'rgba(180,200,180,0.35)';
        g.fillRect(x - 2.4 * scale, headY + 2.8 * scale, 1.8 * scale, 1.2 * scale);
        g.fillRect(x + 0.6 * scale, headY + 2.8 * scale, 1.8 * scale, 1.2 * scale);
      }
      if (p.hurtFlash > 0.2) {
        g.fillStyle = 'rgba(220,40,25,0.25)';
        g.fillRect(x - 7 * scale, headY - 2 * scale, 14 * scale, 32 * scale);
      }
      g.restore();
    }

    drawPlayer(g, p) {
      if (p.rideHidden) return;
      const x = this.sx(p.x);
      const feet = this.sy(p.y + p.h / 2);
      const scale = Math.max(0.8, this.ss(p.h) / 32);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(x - 8 * scale, feet - 2, 16 * scale, 3);
      this.drawHumanoid(g, p, x, feet, scale);
    }

    enemySprite(e, x, y, h, w) {
      if (!RB.Assets || e.pinned > 0 || e.state === 'surrender' || e.collectMode) return null;
      if (['boss', 'mat', 'chorus', 'dvoynik'].includes(e.type)) return null;
      const L = e.limbs;
      if (!L || !L.head || !L.armL || !L.armR || !L.legL || !L.legR) return null;
      const z = RB.Assets.zombie(e.type);
      const attacking = e.attackWindup > 0 || e.attackPending > 0;
      const moving = e.state === 'chase' || Math.abs(e.vx || 0) > 8;
      const kind = attacking ? 'attack' : moving ? 'walk' : 'idle';
      const src = 'assets/sprites/zombie' + z + '_' + kind + '.png';
      const im = RB.Assets.img(src);
      if (!RB.Assets.ready(im)) return null;
      const frames = Math.max(1, Math.round(im.naturalWidth / im.naturalHeight));
      const fw = im.naturalWidth / frames;
      const frame = Math.floor(this.t * (attacking ? 12 : moving ? 9 : 4)) % frames;
      const dh = Math.max(14, h * 1.6);
      const dw = dh * (fw / im.naturalHeight);
      const dir = Math.cos(e.angle || 0) >= 0 ? 1 : -1;
      return { im, sx: Math.floor(frame) * fw, sy: 0, sw: fw, sh: im.naturalHeight, dw, dh, flip: dir < 0 };
    }

    drawEnemy(g, e) {
      let x = this.sx(e.x);
      const y = this.sy(e.y);
      if (e.pinned > 0) x += Math.sin(this.t * 42) * 1.6;
      if (e.attackWindup > 0) x += (Math.cos(e.angle || 0) >= 0 ? 1 : -1) * 3 * Math.min(1, e.attackWindup / 0.26);
      const h = this.ss(e.h || e.r * 2), w = this.ss(e.w || e.r * 2);
      const hurt = e.hitFlash > 0;
      const dir = Math.cos(e.angle || 0) >= 0 ? 1 : -1;
      const L = e.limbs || { armL: true, armR: true, legL: true, legR: true, head: true };
      const legs = (L.legL ? 1 : 0) + (L.legR ? 1 : 0);
      const arms = (L.armL ? 1 : 0) + (L.armR ? 1 : 0);
      const crawl = legs === 0;
      const bob = Math.sin((e.bob || 0) * 3) * 1.2;
      const hipY = crawl ? y + h * 0.3 : y + h * 0.05;
      const feet = y + h / 2;
      const walk = Math.sin((e.bob || 0) * 8) * 2;

      if (e.state === 'surrender') {
        g.fillStyle = 'rgba(0,0,0,0.42)';
        g.fillRect(x - w / 2, feet - 2, w, 3);
        g.fillStyle = '#d8d0bc';
        g.fillRect(x - w / 3, feet - 14, w * 0.66, 14);
        g.fillStyle = '#c8b49a';
        g.fillRect(x - 4, feet - 22, 8, 7);
        g.strokeStyle = '#d8d0bc'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x - 4, feet - 15); g.lineTo(x - 10, feet - 26); g.stroke();
        g.beginPath(); g.moveTo(x + 4, feet - 15); g.lineTo(x + 10, feet - 26); g.stroke();
        g.fillStyle = '#e8e0c0'; g.fillRect(x - 1, feet - 30, 2, 8);
        g.fillRect(x - 5, feet - 30, 10, 4);
        return;
      }

      if (!L.head && e.collectMode) {
        g.fillStyle = 'rgba(0,0,0,0.42)';
        g.fillRect(x - w / 2, feet - 2, w, 3);
        g.fillStyle = '#4c4a43';
        g.fillRect(x - w / 2, feet - 13, w, 11);
        g.fillStyle = '#5a120c';
        g.fillRect(x - 4, feet - 13, 8, 3);
        g.strokeStyle = '#4c4a43'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x - 4, feet - 12); g.lineTo(x - w / 2 - 6, feet - 2); g.stroke();
        g.beginPath(); g.moveTo(x + 4, feet - 12); g.lineTo(x + w / 2 + 6, feet - 2); g.stroke();
        g.fillStyle = '#151210';
        g.fillRect(x - 6, feet - 9, 2, 2);
        g.fillRect(x + 4, feet - 9, 2, 2);
        return;
      }

      if (e.pinned > 0) {
        g.strokeStyle = '#8a6a3a'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x - 18, y - 10); g.lineTo(x + 18, y - 10); g.stroke();
        g.fillStyle = '#5a120c';
        g.fillRect(x - 2, y - 13, 4, 5);
        g.strokeStyle = 'rgba(180,30,20,0.55)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x - 8, y - 8); g.lineTo(x - 12, y + 4); g.stroke();
      }

      // готовые спрайты зомби
      const spr = this.enemySprite(e, x, y, h, w);
      if (spr) {
        g.fillStyle = 'rgba(0,0,0,0.42)';
        g.fillRect(x - w / 2, feet - 2, w, 3);
        g.save();
        if (spr.flip) {
          g.translate(x, 0); g.scale(-1, 1); g.translate(-x, 0);
        }
        g.drawImage(spr.im, spr.sx, spr.sy, spr.sw, spr.sh, x - spr.dw / 2, feet - spr.dh + 2, spr.dw, spr.dh);
        g.restore();
        if (e.hitFlash > 0) {
          g.fillStyle = 'rgba(220,40,25,0.28)';
          g.fillRect(x - spr.dw / 2, feet - spr.dh, spr.dw, spr.dh);
        }
        return;
      }

      // тень
      g.fillStyle = 'rgba(0,0,0,0.42)';
      g.fillRect(x - w / 2, feet - 2, w, 3);

      const palette = RB.Sprites ? RB.Sprites.enemy(e.type, hurt) : {
        body: hurt ? '#8d8577' : '#4c4a43',
        edge: '#22221f', face: '#e4ddc8', eye: '#151210'
      };

      if (e.type === 'obryvok') {
        // бумажный обрывок: пучок листов с лапками
        g.fillStyle = palette.body;
        for (let i = 0; i < 5; i++) {
          g.fillRect(x - w / 2 + (i % 2) * 3, y - h / 4 + i * 3, w - (i % 2) * 3, 3);
        }
        g.fillStyle = palette.eye;
        g.fillRect(x - 3, y - 2, 2, 2);
        g.fillRect(x + 1, y - 2, 2, 2);
        if (L.legL) g.fillRect(x - 4, feet - 5, 2, 5);
        if (L.legR) g.fillRect(x + 2, feet - 5, 2, 5);
        if (L.armL) g.fillRect(x - w / 2 - 2, y - 2, 3, 2);
        if (L.armR) g.fillRect(x + w / 2 - 1, y - 2, 3, 2);
      } else {
        // ноги
        const legW = Math.max(2, Math.round(w * 0.22));
        if (L.legL) {
          g.fillStyle = palette.edge;
          g.fillRect(x - legW - 1, hipY, legW, feet - hipY - 2 - walk);
          g.fillStyle = '#0d0e10';
          g.fillRect(x - legW - 2, feet - 3 - walk, legW + 2, 3);
        } else {
          g.fillStyle = '#5a120c';
          g.fillRect(x - legW - 1, hipY, legW, 3);
        }
        if (L.legR) {
          g.fillStyle = palette.edge;
          g.fillRect(x + 1, hipY, legW, feet - hipY - 2 + walk);
          g.fillStyle = '#0d0e10';
          g.fillRect(x, feet - 3 + walk, legW + 2, 3);
        } else {
          g.fillStyle = '#5a120c';
          g.fillRect(x + 1, hipY, legW, 3);
        }

        // торс
        const torsoTop = crawl ? y - h * 0.05 : y - h * 0.3;
        const torsoH = crawl ? h * 0.35 : h * 0.36;
        g.fillStyle = palette.body;
        g.fillRect(x - w / 2, torsoTop, w, torsoH);
        g.fillStyle = palette.edge;
        g.fillRect(x - w / 2, torsoTop, 1, torsoH);
        g.fillRect(x + w / 2 - 1, torsoTop, 1, torsoH);
        if (e.type === 'cultist') {
          g.fillStyle = 'rgba(210,198,170,0.9)';
          g.fillRect(x - 2, torsoTop + 3, 4, 3);
          g.fillStyle = 'rgba(140,20,14,0.6)';
          g.fillRect(x - 2, torsoTop + 8, 4, 5);
        }
        if (e.type === 'boss') {
          g.fillStyle = 'rgba(163,39,27,0.65)';
          g.fillRect(x - w / 2 + 2, torsoTop + 4, 4, 6);
        }
        // силуэты архетипов
        if (e.type === 'dvoynik') {
          g.save();
          g.globalAlpha = 0.28;
          g.fillStyle = '#8fa7c9';
          g.fillRect(x - w / 2 - 10, torsoTop - 2, w, h * 0.7);
          g.restore();
        }
        if (e.type === 'propovednik') {
          g.fillStyle = palette.body;
          g.beginPath();
          g.moveTo(x - w / 2 - 3, torsoTop);
          g.lineTo(x + w / 2 + 3, torsoTop);
          g.lineTo(x + w / 2 + 8, feet);
          g.lineTo(x - w / 2 - 8, feet);
          g.closePath(); g.fill();
          g.strokeStyle = palette.edge; g.lineWidth = 1; g.stroke();
        }
        if (e.type === 'mat') {
          g.fillStyle = '#d8d0bc';
          g.fillRect(x - w / 2 + 2, torsoTop + 8, w - 4, Math.max(8, feet - torsoTop - 12));
          g.fillStyle = '#8a2a1e';
          g.fillRect(x - w / 2 + 2, torsoTop + 8, w - 4, 2);
        }
        if (e.type === 'noschik') {
          g.fillStyle = palette.edge;
          g.fillRect(x - w / 2 - 3, torsoTop + 1, 4, 7);
          g.fillRect(x + w / 2 - 1, torsoTop + 1, 4, 7);
        }

        // руки: подняты при замахе, опущены при ходьбе
        const shoulderY = torsoTop + 2;
        const wind = e.attackWindup > 0;
        const armLen = Math.max(5, Math.round(h * 0.26));
        if (L.armL) {
          g.strokeStyle = palette.edge;
          g.lineWidth = Math.max(2, Math.round(w * 0.16));
          g.beginPath();
          g.moveTo(x - w / 2 + 1, shoulderY);
          if (wind) g.lineTo(x - w / 2 - 2, shoulderY - armLen);
          else g.lineTo(x - w / 2 - 2, shoulderY + armLen);
          g.stroke();
          g.fillStyle = '#5a120c';
        } else {
          g.fillStyle = '#5a120c';
          g.fillRect(x - w / 2 - 1, shoulderY, 3, 3);
        }
        if (L.armR) {
          g.strokeStyle = palette.edge;
          g.lineWidth = Math.max(2, Math.round(w * 0.16));
          g.beginPath();
          g.moveTo(x + w / 2 - 1, shoulderY);
          if (wind) g.lineTo(x + w / 2 + 2, shoulderY - armLen);
          else g.lineTo(x + w / 2 + 2, shoulderY + armLen);
          g.stroke();
        } else {
          g.fillStyle = '#5a120c';
          g.fillRect(x + w / 2 - 2, shoulderY, 3, 3);
        }

        // оружие/укус в замахе
        if (wind && e.attackKind === 'weapon' && L.armR) {
          g.strokeStyle = '#1a1a1a'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(x + w / 2 + 2, shoulderY - armLen + 2); g.lineTo(x + w / 2 + 8, shoulderY - armLen - 4); g.stroke();
        }
        if (wind && e.attackKind === 'bite') {
          g.fillStyle = '#e8e0d0';
          for (let i = -2; i <= 2; i++) g.fillRect(x + i * 3, torsoTop - 6, 2, 4);
          g.fillStyle = '#5a120c';
          g.fillRect(x - 6, torsoTop - 2, 12, 2);
        }

        // голова
        if (L.head) {
          const headY = crawl ? torsoTop - 4 : torsoTop - 5;
          g.fillStyle = palette.face;
          g.fillRect(x - 3, headY - 1, 7, 7);
          g.fillStyle = palette.eye;
          g.fillRect(x + dir * 1, headY + 2, 2, 1);
          g.fillRect(x - dir * 2, headY + 2, 1, 1);
          if (e.type === 'cultist') {
            g.fillStyle = palette.edge;
            g.fillRect(x - 4, headY - 2, 9, 3);
            g.fillRect(x - 4, headY - 2, 2, 6);
            g.fillRect(x + 3, headY - 2, 2, 6);
          }
          if (e.type === 'boss') {
            g.fillStyle = '#120e0a';
            g.fillRect(x - 4, headY - 3, 9, 3);
          }
          if (e.type === 'chorus') {
            g.fillStyle = palette.face;
            g.fillRect(x - 12, headY - 1, 5, 5);
            g.fillRect(x + 8, headY - 1, 5, 5);
            g.fillStyle = palette.eye;
            g.fillRect(x - 11, headY + 1, 1, 1);
            g.fillRect(x + 10, headY + 1, 1, 1);
          }
          if (e.type === 'mat') {
            g.fillStyle = '#d8d0bc';
            g.fillRect(x - 4, headY - 3, 9, 3);
            g.fillRect(x - 5, headY - 1, 2, 5);
            g.fillRect(x + 4, headY - 1, 2, 5);
          }
          if (e.type === 'svidetel') {
            g.fillStyle = palette.edge;
            g.fillRect(x - 1, headY + 6, 2, 5);
          }
        } else {
          g.fillStyle = '#5a120c';
          g.fillRect(x - 3, torsoTop - 3, 7, 3);
          g.fillStyle = 'rgba(120,14,10,0.8)';
          g.fillRect(x - 2, torsoTop - 4, 2, 1);
        }
      }

      // телеграф
      if (e.attackWindup > 0) {
        g.fillStyle = 'rgba(216,69,42,0.95)';
        g.fillRect(x - 1, y - h / 2 - 14, 2, 6);
        g.fillRect(x - 1, y - h / 2 - 7, 2, 2);
        g.fillStyle = 'rgba(216,69,42,0.16)';
        g.beginPath(); g.arc(x, y, w, 0, Math.PI * 2); g.fill();
      }
      if (e.pinned > 0) {
        g.strokeStyle = 'rgba(127,174,134,0.85)';
        g.strokeRect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
      }
      if (e.hp < e.maxHp) {
        g.fillStyle = 'rgba(0,0,0,0.6)';
        g.fillRect(x - w / 2, y - h / 2 - 4, w, 2);
        g.fillStyle = '#a12a1e';
        g.fillRect(x - w / 2, y - h / 2 - 4, w * (e.hp / e.maxHp), 2);
      }
    }

    drawLighting(g, world, p, W, H, game) {
      const l = this.lightCtx;
      l.setTransform(1, 0, 0, 1, 0, 0);
      l.globalCompositeOperation = 'source-over';
      l.clearRect(0, 0, W, H);
      const dk = RB.clamp((world.darkness || 0.9) - (p.saltVision > 0 ? 0.45 : 0), 0.2, 0.7);
      l.fillStyle = `rgba(3,4,5,${dk})`;
      l.fillRect(0, 0, W, H);
      l.globalCompositeOperation = 'destination-out';

      const px = this.sx(p.x), py = this.sy(p.y);
      let grd = l.createRadialGradient(px, py, 2, px, py, 12);
      grd.addColorStop(0, 'rgba(0,0,0,0.95)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = grd;
      l.beginPath(); l.arc(px, py, 72, 0, Math.PI * 2); l.fill();

      if (p.flashlight && p.battery > 0) {
        const len = 340, spread = 0.75;
        l.save();
        l.beginPath();
        l.moveTo(px, py);
        l.arc(px, py, len, p.angle - spread, p.angle + spread);
        l.closePath();
        l.clip();
        grd = l.createRadialGradient(px, py, 4, px, py, len);
        grd.addColorStop(0, 'rgba(0,0,0,1)');
        grd.addColorStop(0.6, 'rgba(0,0,0,0.6)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        l.fillStyle = grd;
        l.fillRect(px - len, py - len, len * 2, len * 2);
        l.restore();
      }

      for (const o of world.objects) {
        if (o.kind !== 'lamp') continue;
        const ox = this.sx(o.x), oy = this.sy(o.y);
        let flick = 1;
        if (o.flicker) flick = RB.hash2(Math.floor(this.t * 9), o.seed | 0, 3) > 0.25 ? 1 : 0.2;
        grd = l.createRadialGradient(ox, oy, 2, ox, oy, 22);
        grd.addColorStop(0, `rgba(0,0,0,${0.8 * flick})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        l.fillStyle = grd;
        l.beginPath(); l.arc(ox, oy, 22, 0, Math.PI * 2); l.fill();
      }

      g.drawImage(this.light, 0, 0);

      if (p.redLight > 0) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(180,30,20,${Math.min(1, p.redLight) * 0.22})`;
        g.fillRect(0, 0, W, H);
        g.restore();
      }
    }

    drawFog(g, W, H, p) {
      // низкая палитра / виньетка
      const grd = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.38)');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      // пиксельная зернистость
      if (!this.lowQuality) {
        g.fillStyle = 'rgba(255,255,255,0.025)';
        for (let i = 0; i < 30; i++) {
          g.fillRect(Math.random() * W | 0, Math.random() * H | 0, 1, 1);
        }
      }
    }
  }

  RB.Renderer = PixelRenderer;
  RB.PixelScale = true;
})();
