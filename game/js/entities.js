/* ============================================================
   RUSTY BARREL — мир, игрок, монстры, частицы
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});
  const T = 48;
  const SOLID = { '#': 1, 'B': 1, 'C': 1, 'P': 1 };

  class World {
    constructor(data) {
      this.w = data.w;
      this.h = data.h;
      this.grid = data.grid;
      this.tile = T;
      this.objects = data.objects;
      this.rooms = data.rooms;
      this.exitObj = data.exit;
      this.finale = data.finale;
      this.start = data.start;
      this.seed = data.seed;
      this.enemies = data.enemies.map((e) => new Enemy(e.type, e.x, e.y));
      this.particles = [];
      this.decals = [];
      this.saltPuddles = [];
      this.limbs = [];
      this.time = 0;
      this.generatorOn = false;
      this.finaleUsed = false;
      this.kills = 0;
      this.pathCache = new Map();
    }

    get pxW() { return this.w * T; }
    get pxH() { return this.h * T; }

    tileAt(x, y) {
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return '#';
      return this.grid[ty][tx];
    }
    solidTile(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
      return !!SOLID[this.grid[ty][tx]];
    }
    solidAt(x, y) { return this.solidTile(Math.floor(x / T), Math.floor(y / T)); }
    waterAt(x, y) { return this.tileAt(x, y) === '~'; }

    inSalt(x, y) {
      for (const p of this.saltPuddles) {
        if (RB.dist(x, y, p.x, p.y) < p.r) return true;
      }
      return false;
    }

    canStand(x, y, r) {
      if (this.solidAt(x, y)) return false;
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        if (this.solidAt(x + Math.cos(a) * r, y + Math.sin(a) * r)) return false;
      }
      return true;
    }

    moveEntity(e, dx, dy, r) {
      let moved = 0;
      if (dx !== 0 && this.canStand(e.x + dx, e.y, r)) { e.x += dx; moved += Math.abs(dx); }
      if (dy !== 0 && this.canStand(e.x, e.y + dy, r)) { e.y += dy; moved += Math.abs(dy); }
      return moved;
    }

    lineOfSight(x1, y1, x2, y2, maxDist) {
      const d = RB.dist(x1, y1, x2, y2);
      if (maxDist && d > maxDist) return false;
      const steps = Math.ceil(d / 12);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        if (this.solidAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
      }
      return true;
    }

    roomAt(x, y) {
      for (const r of this.rooms) {
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
      }
      return null;
    }

    /* Поиск пути по тайлам (BFS). Возвращает массив точек-центров. */
    findPath(sx, sy, tx, ty) {
      const startX = RB.clamp(Math.floor(sx / T), 0, this.w - 1);
      const startY = RB.clamp(Math.floor(sy / T), 0, this.h - 1);
      const goalX = RB.clamp(Math.floor(tx / T), 0, this.w - 1);
      const goalY = RB.clamp(Math.floor(ty / T), 0, this.h - 1);
      if (startX === goalX && startY === goalY) return [];
      if (this.solidTile(goalX, goalY)) return [];

      const key = startX + ',' + startY + '>' + goalX + ',' + goalY;
      const cached = this.pathCache.get(key);
      if (cached && cached.time > this.time - 0.15) return cached.path;

      const total = this.w * this.h;
      const prev = new Int32Array(total).fill(-1);
      const seen = new Uint8Array(total);
      const q = new Int32Array(total);
      let qh = 0, qt = 0;
      const s = startX + startY * this.w;
      const g = goalX + goalY * this.w;
      q[qt++] = s;
      seen[s] = 1;
      let found = false;
      let guard = 0;
      while (qh < qt && guard++ < total * 4) {
        const cur = q[qh++];
        if (cur === g) { found = true; break; }
        const cx = cur % this.w, cy = (cur / this.w) | 0;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
          const ni = nx + ny * this.w;
          if (seen[ni] || this.solidTile(nx, ny)) continue;
          seen[ni] = 1;
          prev[ni] = cur;
          q[qt++] = ni;
        }
      }
      let path = [];
      if (found) {
        let cur = g;
        while (cur !== s && cur !== -1) {
          path.push({ x: (cur % this.w) * T + T / 2, y: ((cur / this.w) | 0) * T + T / 2 });
          cur = prev[cur];
        }
        path.reverse();
      }
      this.pathCache.set(key, { path, time: this.time });
      return path;
    }

    spawnParticles(x, y, n, opts) {
      const room = 260 - this.particles.length;
      if (room <= 0) return;
      n = Math.min(n, room);
      for (let i = 0; i < n; i++) {
        const a = opts.angle != null ? opts.angle + RB.rand(-opts.spread, opts.spread) : RB.rand(0, Math.PI * 2);
        const sp = RB.rand(opts.speed[0], opts.speed[1]);
        this.particles.push({
          x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: RB.rand(opts.life[0], opts.life[1]),
          max: 0,
          size: RB.rand(opts.size[0], opts.size[1]),
          color: opts.color,
          drag: opts.drag != null ? opts.drag : 4,
          glow: opts.glow || false,
          grav: opts.grav || 0
        });
      }
    }

    addBlood(x, y, n) {
      // «кровь» объекта — чернила и обрывки бумаги
      this.spawnParticles(x, y, n, {
        speed: [30, 160], life: [0.25, 0.8], size: [1.5, 4], color: '#26221d', drag: 6
      });
      this.spawnParticles(x, y, Math.max(2, n >> 1), {
        speed: [20, 120], life: [0.4, 1.1], size: [1, 3], color: '#cfc4a8', drag: 4, grav: 40
      });
      this.decals.push({ x, y, r: RB.rand(6, 16), seed: Math.random() * 100 });
      if (this.decals.length > 80) this.decals.shift();
    }

    update(dt, player, game) {
      this.time += dt;
      for (const e of this.enemies) {
        if (e.dead) {
          if (e.reviveTimer > 0) {
            e.reviveTimer -= dt;
            if (e.reviveTimer <= 0 && RB.dist(e.spawnX, e.spawnY, player.x, player.y) > 560) {
              e.revive();
            }
          }
          continue;
        }
        e.update(dt, this, player, game);
      }
      // частицы
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) { this.particles.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.grav * dt;
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d; p.vy *= d;
      }
    }
  }

  class Player {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.r = 13;
      this.angle = -Math.PI / 2;
      this.hp = 100; this.maxHp = 100;
      this.stamina = 100;
      this.saltVision = 0;
      this.redLight = 0;
      this.adrenaline = 0;
      this.painkiller = 0;
      this.bleed = 0;
      this.medkitTimes = [];
      this.attention = 0;
      this.recordTimer = 0;
      this.recording = false;
      this.records = 0;
      this.weapon = 'pistol';
      this.owned = { pistol: true };
      this.mags = {};
      this.reserves = {};
      for (const id of RB.WeaponOrder) {
        const w = RB.Weapons[id];
        this.mags[id] = w.mag;
        this.reserves[id] = w.startReserve;
      }
      this.laser = false;
      this.laserOwned = false;
      this.tokens = 6;
      this.damageMul = 1;
      this.attentionMul = 1;
      this.medBonus = 0;
      this.staminaRegen = 1;
      this.battery = 100;
      this.flashlight = true;
      this.invuln = 0;
      this.fireCd = 0;
      this.meleeCd = 0;
      this.reloadTimer = 0;
      this.reloadTotal = 0;
      this.dead = false;
      this.stepTimer = 0;
      this.sprinting = false;
      this.noise = 0.15;
      this.walkPhase = 0;
      this.hurtFlash = 0;
      this.recoil = 0;
      this.muzzle = 0;
      this.lastAim = -Math.PI / 2;
      this.speedNow = 0;
    }

    get ammo() { return this.mags[this.weapon] || 0; }
    set ammo(v) { this.mags[this.weapon] = v; }
    get reserve() { return this.reserves[this.weapon] || 0; }
    set reserve(v) { this.reserves[this.weapon] = v; }

    switchWeapon(id) {
      if (!this.owned[id]) return false;
      this.weapon = id;
      this.reloadTimer = 0;
      this.fireCd = Math.max(this.fireCd, 0.12);
      RB.Sound.play('reload');
      return true;
    }

    cycleWeapon() {
      const order = RB.WeaponOrder;
      const start = order.indexOf(this.weapon);
      for (let i = 1; i <= order.length; i++) {
        const id = order[(start + i) % order.length];
        if (this.owned[id]) return this.switchWeapon(id);
      }
      return false;
    }

    unlockWeapon(id) {
      if (!RB.Weapons[id]) return;
      this.owned[id] = true;
      const w = RB.Weapons[id];
      this.mags[id] = w.mag;
      this.reserves[id] = Math.max(this.reserves[id] || 0, w.startReserve);
    }

    update(dt, input, world, game) {
      if (this.dead) return;
      this.invuln = Math.max(0, this.invuln - dt);
      this.fireCd = Math.max(0, this.fireCd - dt);
      this.meleeCd = Math.max(0, this.meleeCd - dt);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
      this.muzzle = Math.max(0, this.muzzle - dt * 12);
      this.recoil = Math.max(0, this.recoil - dt * 8);
      this.saltVision = Math.max(0, this.saltVision - dt);
      this.redLight = Math.max(0, this.redLight - dt);
      this.adrenaline = Math.max(0, this.adrenaline - dt);
      this.painkiller = Math.max(0, this.painkiller - dt);

      // кровотечение от передозировки
      if (this.bleed > 0) {
        this.bleed -= dt;
        this.hp -= 7 * dt;
        if (Math.random() < dt * 6) {
          world.spawnParticles(this.x, this.y, 1, {
            speed: [10, 40], life: [0.3, 0.7], size: [1.5, 3], color: '#6b110c', drag: 5, grav: 120
          });
        }
        if (this.hp <= 0) {
          this.hp = 0;
          this.dead = true;
          RB.Sound.play('death');
          game.onDeath();
          return;
        }
      }

      // перезарядка
      if (this.reloadTimer > 0) {
        this.reloadTimer -= dt;
        if (this.reloadTimer <= 0) {
          const w = RB.Weapons[this.weapon];
          const need = w.mag - this.ammo;
          const take = Math.min(need, this.reserve);
          this.ammo += take;
          this.reserve -= take;
          RB.Sound.play('reload');
        }
      }

      const water = world.waterAt(this.x, this.y);
      const wantSprint = this.stamina > 1 && !water;
      const base = water ? 92 : 142;
      const boost = this.adrenaline > 0 ? 1.4 : 1;
      const saltSlow = world.inSalt ? world.inSalt(this.x, this.y) : false;
      const speed = (wantSprint ? (water ? 92 : 208) : base) * boost * (saltSlow ? 0.55 : 1);
      this.sprinting = wantSprint && (input.move.x !== 0 || input.move.y !== 0);

      if (this.sprinting) {
        this.stamina = RB.clamp(this.stamina - 26 * dt, 0, 100);
      } else {
        this.stamina = RB.clamp(this.stamina + 17 * dt * this.staminaRegen, 0, 100);
      }

      const mx = input.move.x, my = input.move.y;
      const len = Math.hypot(mx, my);
      this.speedNow = len > 0 ? speed * Math.min(1, len) : 0;
      if (len > 0.01) {
        world.moveEntity(this, (mx / len) * this.speedNow * dt, (my / len) * this.speedNow * dt, this.r);
        this.walkPhase += dt * (this.sprinting ? 13 : 8);
      } else {
        this.walkPhase += dt * 1.5;
      }

      // шум
      if (len > 0.05) {
        this.noise = (this.sprinting ? 1.0 : 0.45) + (water ? 0.25 : 0);
      } else {
        this.noise = 0.12;
      }

      // шаги
      if (this.speedNow > 10) {
        this.stepTimer -= dt * (this.sprinting ? 1.7 : 1);
        if (this.stepTimer <= 0) {
          this.stepTimer = water ? 0.32 : 0.46;
          RB.Sound.play(water ? 'splash' : 'step', { vol: this.sprinting ? 1.2 : 0.8 });
          if (water) world.spawnParticles(this.x, this.y, 4, {
            speed: [10, 45], life: [0.2, 0.5], size: [1, 2.5], color: '#7f9aa8', drag: 5
          });
        }
      }

      // фонарь / батарея
      if (input.consume('flashlight')) {
        if (this.battery > 0) {
          this.flashlight = !this.flashlight;
          RB.Sound.play('ui');
        } else RB.Sound.play('dry');
      }
      if (this.flashlight) {
        this.battery = RB.clamp(this.battery - 1.05 * dt, 0, 100);
        if (this.battery <= 0) {
          this.flashlight = false;
          RB.Sound.play('deny');
        }
      }

      // прицел
      if (input.touchMode) {
        if (input.aiming) this.angle = input.aimAngle;
      } else {
        const p = game.screenToWorld(input.mouse.x, input.mouse.y);
        if (RB.dist(p.x, p.y, this.x, this.y) > 6) this.angle = Math.atan2(p.y - this.y, p.x - this.x);
        if (input.firing) this.angle = Math.atan2(p.y - this.y, p.x - this.x);
      }

      // стрельба
      if (input.firing) {
        if (this.reloadTimer <= 0) this.tryShoot(world, game);
      }
      if (input.consume('reload')) this.startReload();
      if (input.consume('melee')) this.melee(world, game);
      if (input.consume('weapon')) this.cycleWeapon();
      if (input.consume('laser') && this.laserOwned) {
        this.laser = !this.laser;
        RB.Sound.play('ui');
        game.ui.toast(this.laser ? 'ЛАЗЕР ВКЛ' : 'ЛАЗЕР ВЫКЛ');
      }

      // запись времени — снижает внимание объекта
      if (input.consume('record')) this.startRecord(game);
      if (this.recording) {
        this.recordTimer -= dt;
        const moving = Math.hypot(input.move.x, input.move.y) > 0.2;
        if (moving || this.invuln > 0.9) {
          this.recording = false;
          this.recordTimer = 0;
          game.ui.toast('ЗАПИСЬ ПРЕРВАНА');
          RB.Sound.play('deny');
        } else if (this.recordTimer <= 0) {
          this.recording = false;
          this.records++;
          this.attention = RB.clamp(this.attention - 32, 0, 100);
          RB.Sound.play('stamp');
          world.spawnParticles(this.x, this.y, 12, {
            speed: [10, 60], life: [0.4, 1.1], size: [1, 2.6], color: '#d8cdb0', drag: 4, grav: 30
          });
          game.onRecorded();
        }
      }

      // ВНИМАНИЕ объекта
      let attDelta = -0.55;
      if (this.flashlight && this.battery > 0) attDelta += 0.35;
      if (this.noise > 0.6) attDelta += (this.noise - 0.6) * 1.6;
      let nearest = 9999;
      for (const e of world.enemies) {
        if (e.dead) continue;
        const d = RB.dist(e.x, e.y, this.x, this.y);
        if (d < nearest) nearest = d;
        if (d < 380 && world.lineOfSight(e.x, e.y, this.x, this.y, 380)) {
          attDelta += (1 - d / 380) * 2.2;
        }
      }
      if (this.hp < 35) attDelta += 0.7;
      if (this.recording) attDelta -= 1.2;
      this.attention = RB.clamp(this.attention + attDelta * dt * this.attentionMul, 0, 100);

      // регенерация после безопасного времени
      if (nearest > 500 && this.hp < this.maxHp) {
        this.hp = RB.clamp(this.hp + 1.2 * dt, 0, this.maxHp);
      }
    }

    startRecord(game) {
      if (this.recording) return;
      if (game && (game.inIso || (game.world && game.world.bossFight))) {
        RB.Sound.play('deny');
        game.ui.toast('В КОМНАТЕ ЗАПИСЬ НЕДОСТУПНА');
        return;
      }
      if (game && game.recordBlocked > 0) {
        RB.Sound.play('deny');
        game.ui.toast('ЗАПИСЬ ЗАБЛОКИРОВАНА: ' + Math.ceil(game.recordBlocked) + ' с');
        return;
      }
      this.recording = true;
      this.recordTimer = 1.7;
      RB.Sound.play('paper');
      game.ui.toast('ЗАПИСЬ ВРЕМЕНИ...');
    }

    startReload() {
      if (this.reloadTimer > 0) return;
      if (this.game && this.game.reloadWeapon) { this.game.reloadWeapon(this); return; }
      const w = RB.Weapons[this.weapon];
      if (this.ammo >= w.mag || this.reserve <= 0) {
        RB.Sound.play('dry');
        return;
      }
      this.reloadTimer = w.reload;
      this.reloadTotal = w.reload;
      RB.Sound.play('reload');
    }

    tryShoot(world, game) {
      if (this.fireCd > 0) return;
      if (this.reloadTimer > 0) return;
      const w = RB.Weapons[this.weapon];
      if (this.ammo <= 0) {
        RB.Sound.play('dry');
        this.fireCd = 0.35;
        return;
      }
      this.ammo--;
      if (game.consumeRound) game.consumeRound(this);
      this.fireCd = w.fire;
      this.recoil = 1;
      this.muzzle = 1;
      this.attention = RB.clamp(this.attention + w.noise, 0, 100);
      RB.Sound.play(w.sound || 'shot');
      game.shake(w.id === 'shotgun' ? 9 : w.id === 'ak74' ? 4 : 6, 0.18);

      const laser = this.laser && this.laserOwned && w.laser;
      const spreadMul = laser ? 0.4 : 1;
      const pellets = this.ammoPellets || w.pellets;
      const dmg = w.dmg * (this.ammoMul || 1) * (this.drugDamage || 1);
      for (let i = 0; i < pellets; i++) {
        const spread = RB.rand(-w.spread, w.spread) * spreadMul;
        this.shootRay(world, game, this.angle + spread, w.range, dmg, {
          limbChance: w.limbChance,
          burn: !!w.burn || !!this.ammoBurn,
          pin: w.pin || 0,
          weapon: w.id
        });
      }
      if (this.ammoTracer) {
        world.spawnParticles(this.x + Math.cos(this.angle) * 30, this.y + Math.sin(this.angle) * 30, 6, {
          angle: this.angle, spread: 0.06, speed: [180, 300], life: [0.12, 0.3],
          size: [1, 2], color: '#ffd27a', drag: 1
        });
      }
      // гильза
      if (w.id === 'pistol' || w.id === 'shotgun' || w.id === 'ak74') {
        world.spawnParticles(this.x + Math.cos(this.angle) * 16, this.y + Math.sin(this.angle) * 16, 3, {
          angle: this.angle + Math.PI / 2, spread: 0.6, speed: [40, 110], life: [0.3, 0.6],
          size: [1, 2.2], color: '#c9a24b', drag: 6, grav: 260
        });
      }
      if (w.id === 'flamethrower') {
        for (let i = 0; i < 4; i++) {
          world.spawnParticles(
            this.x + Math.cos(this.angle) * RB.rand(20, 200),
            this.y + Math.sin(this.angle) * RB.rand(20, 200),
            2, { angle: this.angle, spread: 0.5, speed: [30, 120], life: [0.2, 0.5], size: [2, 5], color: '#ff8a3a', drag: 4 }
          );
        }
      }
    }

    shootRay(world, game, ang, maxDist, dmg, opts) {
      opts = opts || {};
      let hit = null;
      let hitDist = maxDist;
      for (const e of world.enemies) {
        if (e.dead) continue;
        const dx = e.x - this.x, dy = e.y - this.y;
        const proj = dx * Math.cos(ang) + dy * Math.sin(ang);
        if (proj < 0 || proj > hitDist) continue;
        const perp = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
        if (perp > e.r + 6) continue;
        if (!world.lineOfSight(this.x, this.y, e.x, e.y, maxDist)) continue;
        hitDist = proj;
        hit = e;
      }
      // стены
      let wallDist = maxDist;
      for (let d = 8; d < Math.min(maxDist, hitDist); d += 8) {
        if (world.solidAt(this.x + Math.cos(ang) * d, this.y + Math.sin(ang) * d)) {
          wallDist = d;
          break;
        }
      }
      if (hit && hitDist <= wallDist) {
        hit.hurt((dmg || 1) * (this.damageMul || 1), world, game, ang, opts);
        world.addBlood(hit.x, hit.y, 10);
        if (opts.burn) hit.burning = 4;
        if (opts.pin) hit.pinned = Math.max(hit.pinned || 0, opts.pin);
        if (opts.weapon === 'harpoon') {
          world.spawnParticles(hit.x, hit.y, 8, {
            speed: [20, 90], life: [0.3, 0.8], size: [1, 2.5], color: '#7fae86', drag: 5
          });
        }
      } else {
        const d = wallDist;
        const x = this.x + Math.cos(ang) * d;
        const y = this.y + Math.sin(ang) * d;
        world.spawnParticles(x, y, 7, {
          angle: ang + Math.PI, spread: 0.9, speed: [40, 180], life: [0.2, 0.5],
          size: [1, 2.6], color: '#d6c39a', drag: 7
        });
      }
      game.tracers.push({ x1: this.x, y1: this.y, x2: this.x + Math.cos(ang) * wallDist, y2: this.y + Math.sin(ang) * wallDist, life: 0.06 });
      // фонарь вспышка шума
      this.noise = 1.0;
    }

    melee(world, game) {
      if (this.meleeCd > 0) return;
      this.meleeCd = 0.52;
      this.stamina = RB.clamp(this.stamina - 8, 0, 100);
      RB.Sound.play('melee');
      game.shake(3, 0.12);
      const range = 54 + ((this.legPower || 1) - 1) * 10;
      const legMul = this.legPower || 1;
      let hitAny = false;
      for (const e of world.enemies) {
        if (e.dead) continue;
        const d = RB.dist(e.x, e.y, this.x, this.y);
        if (d > range + e.r) continue;
        const a = Math.atan2(e.y - this.y, e.x - this.x);
        if (Math.abs(RB.angDiff(this.angle, a)) > 0.9) continue;
        if (!world.lineOfSight(this.x, this.y, e.x, e.y, 80)) continue;
        e.hurt(2 * legMul * (this.damageMul || 1), world, game, this.angle, { limbChance: 0.5, weapon: 'melee' });
        world.addBlood(e.x, e.y, 14);
        hitAny = true;
      }
      if (hitAny) RB.Sound.play('flesh');
      world.spawnParticles(
        this.x + Math.cos(this.angle) * 34,
        this.y + Math.sin(this.angle) * 34,
        5, { angle: this.angle, spread: 1.1, speed: [30, 90], life: [0.1, 0.3], size: [1, 2], color: '#9a8f76', drag: 9 }
      );
    }

    damage(amount, world, game, fromX, fromY) {
      if (this.invuln > 0 || this.dead) return;
      if (this.painkiller > 0) amount *= 0.5;
      this.hp -= amount;
      this.invuln = 1.15;
      this.hurtFlash = 1;
      this.attention = RB.clamp(this.attention + 26, 0, 100);
      RB.Sound.play('hurt');
      game.shake(12, 0.4);
      world.addBlood(this.x, this.y, 12);
      if (fromX != null) {
        const a = Math.atan2(this.y - fromY, this.x - fromX);
        world.moveEntity(this, Math.cos(a) * 26, Math.sin(a) * 26, this.r);
      }
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
        RB.Sound.play('death');
        game.onDeath();
      }
    }
  }

  const ENEMY_DEFS = {
    sledok: {
      name: 'Тихий', hp: 6, speed: 40, chase: 68, r: 17, damage: 24,
      hearRange: 420, sight: 340, attackRange: 50, attackCd: 1.25, freezeLight: true, xp: 1
    },
    svidetel: {
      name: 'Свидетель', hp: 3, speed: 58, chase: 112, r: 15, damage: 15,
      hearRange: 200, sight: 300, attackRange: 42, attackCd: 0.95, lightRange: 640, xp: 1
    },
    obryvok: {
      name: 'Обрывок', hp: 2, speed: 88, chase: 160, r: 12, damage: 10,
      hearRange: 260, sight: 260, attackRange: 36, attackCd: 0.8, xp: 1
    },
    noschik: {
      name: 'Носитель', hp: 5, speed: 48, chase: 98, r: 18, damage: 20,
      hearRange: 330, sight: 320, attackRange: 52, attackCd: 1.1, xp: 1
    },
    propovednik: {
      name: 'Проповедник', hp: 8, speed: 42, chase: 88, r: 19, damage: 26,
      hearRange: 420, sight: 380, attackRange: 56, attackCd: 1.2, xp: 1
    },
    mat: {
      name: 'Мать Смены', hp: 60, speed: 34, chase: 64, r: 30, damage: 28,
      hearRange: 560, sight: 560, attackRange: 70, attackCd: 1.5, xp: 1, isBoss: true
    },
    chorus: {
      name: 'Соляной Хор', hp: 50, speed: 40, chase: 78, r: 24, damage: 22,
      hearRange: 600, sight: 500, attackRange: 64, attackCd: 1.3, xp: 1, isBoss: true
    },
    dvoynik: {
      name: 'Двойник', hp: 55, speed: 60, chase: 105, r: 22, damage: 24,
      hearRange: 600, sight: 600, attackRange: 62, attackCd: 1.1, xp: 1, isBoss: true
    },
    boss: {
      name: 'Надзиратель', hp: 70, speed: 38, chase: 72, r: 27, damage: 30,
      hearRange: 520, sight: 520, attackRange: 62, attackCd: 1.4, xp: 1, isBoss: true
    },
    cultist: {
      name: 'Брат', hp: 4, speed: 55, chase: 96, r: 15, damage: 18,
      hearRange: 320, sight: 340, attackRange: 44, attackCd: 1.05, xp: 1
    }
  };

  class Enemy {
    constructor(type, x, y) {
      this.type = type;
      this.def = ENEMY_DEFS[type] || ENEMY_DEFS.sledok;
      this.x = x; this.y = y;
      this.spawnX = x; this.spawnY = y;
      this.r = this.def.r;
      this.hp = this.def.hp;
      this.maxHp = this.def.hp;
      this.angle = RB.rand(0, Math.PI * 2);
      this.state = 'idle';
      this.path = [];
      this.pathTimer = 0;
      this.attackTimer = 0;
      this.dead = false;
      this.reviveTimer = 0;
      this.wanderTimer = RB.rand(0, 2);
      this.wanderDir = RB.rand(0, Math.PI * 2);
      this.lastKnown = null;
      this.alertTimer = 0;
      this.hitFlash = 0;
      this.bob = RB.rand(0, 10);
      this.growlTimer = RB.rand(2, 8);
      this.stuckTimer = 0;
      this.wake = false;
      this.frozen = false;
      this.pinned = 0;
      this.burning = 0;
      this.angry = false;
      this.limbs = { armL: true, armR: true, legL: true, legR: true, head: true };
      this.collectMode = false;
      this.collectParts = [];
    }

    revive() {
      this.dead = false;
      this.frozen = false;
      this.hp = this.maxHp;
      this.x = this.spawnX;
      this.y = this.spawnY;
      this.state = 'idle';
      this.alertTimer = 0;
      this.lastKnown = null;
      this.path = [];
      this.reviveTimer = 0;
      this.limbs = { armL: true, armR: true, legL: true, legR: true, head: true };
      this.collectMode = false;
      this.collectParts = [];
    }

    missingArms() { return (this.limbs.armL ? 0 : 1) + (this.limbs.armR ? 0 : 1); }
    missingLegs() { return (this.limbs.legL ? 0 : 1) + (this.limbs.legR ? 0 : 1); }
    damageFactor() {
      if (!this.limbs.head) return 0;
      const m = this.missingArms();
      return m >= 2 ? 0.15 : m === 1 ? 0.5 : 1;
    }
    speedFactor() {
      const m = this.missingLegs();
      if (m >= 2) return 0.25;
      if (m === 1) return 0.5;
      return 1;
    }

    hurt(amount, world, game, dir, opts) {
      if (this.dead) return;
      opts = opts || {};
      this.hp -= amount;
      if (opts.limbChance && this.hp > 0 && Math.random() < opts.limbChance) {
        this.severLimb(world, dir);
      }
      this.hitFlash = 1;
      this.angry = true;
      this.state = 'chase';
      this.frozen = false;
      this.alertTimer = 6;
      this.lastKnown = { x: game.player.x, y: game.player.y };
      this.wake = true;
      if (dir != null) {
        world.moveEntity(this, Math.cos(dir) * 12, Math.sin(dir) * 12, this.r);
      }
      if (this.hp <= 0) {
        this.dead = true;
        this.reviveTimer = (this.def && this.def.isBoss) ? 0 : 34;
        this.frozen = false;
        world.kills++;
        world.corpses = world.corpses || [];
        world.corpses.push({ x: this.x, y: this.y, type: this.type, angle: this.angle || 0, seed: Math.random() * 100, life: 40 });
        if (world.corpses.length > 16) world.corpses.shift();
        if (game && game.player && Math.random() < 0.25) game.player.tokens += 1;
        if (this.type === 'svidetel' && game && game.player) {
          game.player.attention = RB.clamp((game.player.attention || 0) + 25, 0, 100);
          if (game.ui) game.ui.toast('СВИДЕТЕЛЬ УБИТ · ВНИМАНИЕ +25');
        }
        RB.Sound.play('paperBurst');
        world.addBlood(this.x, this.y, 26);
        // расчленёнка: крупные куски
        world.spawnParticles(this.x, this.y, 9, {
          speed: [70, 240], life: [0.5, 1.2], size: [3, 7], color: '#5e120d', drag: 3, grav: 320
        });
        if (Math.random() < 0.3) {
          world.objects.push({
            kind: 'item', item: 'ammo', label: 'ammo',
            x: this.x, y: this.y, tx: Math.floor(this.x / 48), ty: Math.floor(this.y / 48), dropped: true
          });
        }
      }
    }

    severLimb(world, dir) {
      const pool = [];
      if (this.limbs.armL) pool.push('armL');
      if (this.limbs.armR) pool.push('armR');
      if (this.limbs.legL) pool.push('legL');
      if (this.limbs.legR) pool.push('legR');
      if (this.limbs.head) pool.push('head');
      if (!pool.length) return;
      const key = pool[Math.floor(Math.random() * pool.length)];
      this.limbs[key] = false;
      const a = dir != null ? dir : RB.rand(0, Math.PI * 2);
      const d = RB.rand(22, 58);
      world.limbs = world.limbs || [];
      const part = {
        kind: 'limb', limb: key, owner: this,
        x: this.x + Math.cos(a) * d,
        y: this.y + Math.sin(a) * d,
        taken: false, seed: Math.random() * 100
      };
      world.limbs.push(part);
      this.collectParts.push(part);
      world.addBlood(this.x, this.y, 14);
      RB.Sound.play('flesh');
      if (key === 'head' || this.missingArms() >= 2 || this.missingLegs() >= 2) {
        this.collectMode = true;
        this.state = 'collect';
      }
    }

    restoreLimb(part) {
      this.limbs[part.limb] = true;
      part.taken = true;
      this.collectParts = this.collectParts.filter((p) => p !== part);
      const stillMissing = Object.values(this.limbs).some((v) => !v);
      if (!stillMissing) {
        this.collectMode = false;
        this.state = 'chase';
        this.alertTimer = 8;
      }
    }

    updateCollect(dt, world, player, game) {
      const parts = this.collectParts.filter((p) => !p.taken);
      if (!parts.length) {
        this.collectMode = false;
        this.state = 'chase';
        return;
      }
      let best = parts[0], bd = RB.dist2(this.x, this.y, parts[0].x, parts[0].y);
      for (const p of parts) {
        const d = RB.dist2(this.x, this.y, p.x, p.y);
        if (d < bd) { bd = d; best = p; }
      }
      const a = Math.atan2(best.y - this.y, best.x - this.x);
      this.angle = RB.angleLerp(this.angle, a, Math.min(1, dt * 5));
      const sp = this.def.chase * this.speedFactor() * 0.8;
      const moved = world.moveEntity(this, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt, this.r);
      if (moved < 1) this.path = [];
      if (RB.dist(this.x, this.y, best.x, best.y) < 24) {
        this.restoreLimb(best);
        RB.Sound.play('stamp');
        world.spawnParticles(best.x, best.y, 6, {
          speed: [10, 50], life: [0.2, 0.5], size: [1, 2.5], color: '#6b110c', drag: 5
        });
      }
    }

    canSee(world, player) {
      if (!this.limbs.head) return false;
      if (player.hidden) return false;
      const d = RB.dist(this.x, this.y, player.x, player.y);
      if (this.type === 'svidetel') {
        if (player.flashlight && d < this.def.lightRange) {
          return world.lineOfSight(this.x, this.y, player.x, player.y, this.def.lightRange);
        }
        if (d < 150) return world.lineOfSight(this.x, this.y, player.x, player.y, 200);
        return false;
      }
      if (this.type === 'sledok' && player.flashlight && player.battery > 0 && d < 480) {
        const a = Math.atan2(this.y - player.y, this.x - player.x);
        if (Math.abs(RB.angDiff(player.angle, a)) < 0.55 &&
            world.lineOfSight(this.x, this.y, player.x, player.y, 480)) {
          return true;
        }
      }
      if (d < this.def.sight) {
        const visible = !player.flashlight || d < this.def.sight * 0.7;
        if (visible && world.lineOfSight(this.x, this.y, player.x, player.y, this.def.sight)) return true;
      }
      return false;
    }

    hears(player) {
      if (player.hidden) return false;
      const d = RB.dist(this.x, this.y, player.x, player.y);
      return d < this.def.hearRange * (0.25 + player.noise);
    }

    update(dt, world, player, game) {
      if (this.dead) return;
      this.hitFlash = Math.max(0, this.hitFlash - dt * 3);
      if (this.pinned > 0) {
        this.pinned -= dt;
        this.bob += dt * 8;
        if (Math.random() < dt * 5) {
          world.spawnParticles(this.x, this.y + 6, 1, {
            speed: [5, 30], life: [0.3, 0.7], size: [1, 2], color: '#7fae86', drag: 5
          });
        }
        return;
      }
      if (this.burning > 0) {
        this.burning -= dt;
        this.hp -= dt * 1.4;
        if (Math.random() < dt * 8) {
          world.spawnParticles(this.x, this.y, 1, {
            speed: [10, 50], life: [0.2, 0.6], size: [2, 4], color: '#ff7a2a', drag: 4, grav: -30
          });
        }
        if (this.hp <= 0) {
          this.dead = true;
          this.reviveTimer = 34;
          world.kills++;
          world.addBlood(this.x, this.y, 22);
          RB.Sound.play('paperBurst');
          return;
        }
      }
      if (this.collectMode) {
        this.updateCollect(dt, world, player, game);
        return;
      }
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      this.pathTimer -= dt;
      this.growlTimer -= dt;
      this.bob += dt * 3;

      if (this.growlTimer <= 0) {
        this.growlTimer = RB.rand(4, 11);
        if (RB.dist(this.x, this.y, player.x, player.y) < 520) {
          RB.Sound.play('growl');
        }
      }

      const d = RB.dist(this.x, this.y, player.x, player.y);
      if (this.type === 'cultist' && game.flags && (game.flags.ignat || game.flags.cultAlliance) && !this.angry) {
        this.state = 'idle';
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = RB.rand(2, 5);
          this.wanderDir = RB.rand(0, Math.PI * 2);
        }
        const sx = Math.cos(this.wanderDir) * 30 * dt;
        const sy = Math.sin(this.wanderDir) * 30 * dt;
        world.moveEntity(this, sx, sy, this.r);
        return;
      }
      const sees = this.canSee(world, player);
      const hears = this.hears(player);

      // Тихий замирает, пока на него направлен луч
      if (this.def.freezeLight) {
        const a = Math.atan2(this.y - player.y, this.x - player.x);
        const inBeam = player.flashlight && player.battery > 0 && d < 480 &&
          Math.abs(RB.angDiff(player.angle, a)) < 0.5 &&
          world.lineOfSight(this.x, this.y, player.x, player.y, 480);
        this.frozen = inBeam;
        if (inBeam) {
          this.state = 'frozen';
          this.alertTimer = 7;
          this.lastKnown = { x: player.x, y: player.y };
          this.angle = RB.angleLerp(this.angle, a + Math.PI, Math.min(1, dt * 2));
          if (Math.random() < dt * 2) {
            world.spawnParticles(this.x, this.y - 10, 1, {
              speed: [3, 18], life: [0.5, 1.3], size: [1, 2.2], color: '#cfc4a8', drag: 3, grav: 20
            });
          }
          return;
        }
        if (this.state === 'frozen') this.state = 'chase';
      }

      if (sees || hears) {
        this.state = 'chase';
        this.alertTimer = 7;
        this.wake = true;
        this.lastKnown = { x: player.x, y: player.y };
      }

      if (this.state === 'chase') {
        this.alertTimer -= dt;
        if (this.alertTimer <= 0 && !sees) {
          this.state = 'idle';
          this.lastKnown = null;
        }
      }

      let target = null;
      let speed = this.def.speed;

      if (this.state === 'chase') {
        target = this.lastKnown ? { x: this.lastKnown.x, y: this.lastKnown.y } : { x: player.x, y: player.y };
        speed = this.def.chase * this.speedFactor();
        if (d < this.def.attackRange && sees) {
          // атака
          if (this.attackTimer <= 0) {
            this.attackTimer = this.def.attackCd;
            player.damage(this.def.damage * this.damageFactor(), world, game, this.x, this.y);
            RB.Sound.play('flesh');
          }
        }
      } else {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = RB.rand(1.6, 4.5);
          this.wanderDir = RB.rand(0, Math.PI * 2);
          this.wanderTimer2 = RB.rand(0.4, 1.2);
        }
        const wx = Math.cos(this.wanderDir) * 40;
        const wy = Math.sin(this.wanderDir) * 40;
        target = { x: this.x + wx, y: this.y + wy };
        speed = this.def.speed * 0.45 * this.speedFactor();
      }

      if (!target) return;

      // путь
      if (this.pathTimer <= 0 || this.path.length === 0) {
        this.pathTimer = this.state === 'chase' ? 0.55 : 1.2;
        this.path = world.findPath(this.x, this.y, target.x, target.y);
      }

      let tx = target.x, ty = target.y;
      if (this.path.length) {
        const wp = this.path[0];
        tx = wp.x; ty = wp.y;
        if (RB.dist(this.x, this.y, wp.x, wp.y) < 18) this.path.shift();
      }
      const ang = Math.atan2(ty - this.y, tx - this.x);
      this.angle = RB.angleLerp(this.angle, ang, Math.min(1, dt * 5));

      if (d > this.def.attackRange * 0.8) {
        const mx = Math.cos(ang) * speed * dt;
        const my = Math.sin(ang) * speed * dt;
        const moved = world.moveEntity(this, mx, my, this.r);
        if (moved < 1) {
          this.stuckTimer += dt;
          if (this.stuckTimer > 0.5) {
            this.path = [];
            this.stuckTimer = 0;
            this.wanderDir = ang + RB.rand(-1.4, 1.4);
          }
        } else this.stuckTimer = 0;
      }

      if (world.waterAt(this.x, this.y) && Math.random() < dt * 3) {
        world.spawnParticles(this.x, this.y, 1, {
          speed: [5, 25], life: [0.3, 0.7], size: [1, 2.4], color: '#6d8791', drag: 4
        });
      }
      if (this.state === 'chase' && Math.random() < dt * 2) {
        world.spawnParticles(this.x, this.y + 8, 1, {
          speed: [5, 20], life: [0.4, 0.9], size: [1.5, 3], color: '#3f2a20', drag: 3, grav: -12
        });
      }
    }
  }

  RB.SOLID = SOLID;
  RB.World = World;
  RB.Player = Player;
  RB.Enemy = Enemy;
  RB.ENEMY_DEFS = ENEMY_DEFS;
})();
