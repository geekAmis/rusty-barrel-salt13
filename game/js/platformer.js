/* ============================================================
   RUSTY BARREL — PLATFORMER / PSEUDO-3D PIXEL ENGINE
   Боковой вид, гравитация, прыжки, параллакс, низкое разрешение.
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});
  const BaseWorld = RB.World;
  const BasePlayer = RB.Player;
  const BaseEnemy = RB.Enemy;
  const T = 48;

  const SOLID = { '#': 1, 'B': 1, 'C': 1, 'P': 1, '^': 1 };

  /* ================= ГЕНЕРАТОР ================= */
  const ZONE_NAMES = {
    office: ['ПРОХОДНАЯ', 'БУХГАЛТЕРИЯ', 'КАБИНЕТ'],
    storage: ['СКЛАД', 'ТАРНЫЙ СКЛАД', 'КЛАДОВАЯ'],
    production: ['ЦЕХ', 'ЛИНИЯ', 'РАЗДЕЛОЧНЫЙ'],
    lab: ['ЛАБОРАТОРИЯ', 'ПАЛАТА', 'ПРОЦЕДУРНАЯ'],
    utility: ['БОЙЛЕРНАЯ', 'ЩИТОВАЯ', 'НАСОСНАЯ'],
    archive: ['АРХИВ', 'КАРТОТЕКА', 'ЧИТАЛЬНЫЙ ЗАЛ'],
    gate: ['ВОРОТА', 'ШЛЮЗ', 'ПОГРУЗОЧНАЯ'],
    flooded: ['КЕССОН', 'НИЖНИЙ ЯРУС', 'ЗАТОПЛЕННЫЙ ЦЕХ']
  };

  function sideGen(chapter, seedNum) {
    const rnd = RB.mulberry32(seedNum >>> 0);
    const W = 126, H = 50;
    const g = [];
    for (let y = 0; y < H; y++) g.push(new Array(W).fill('.'));
    for (let x = 0; x < W; x++) { g[0][x] = '#'; g[H - 1][x] = '#'; }
    for (let y = 0; y < H; y++) { g[y][0] = '#'; g[y][W - 1] = '#'; }

    const levelYs = [44, 36, 28, 20];
    const roomW = 11;
    const elevatorXs = [13, 37, 61, 85, 109];

    // прямые коридоры-этажи с комнатами
    for (let li = 0; li < levelYs.length; li++) {
      const fy = levelYs[li];
      const cy = fy - 5;
      for (let x = 1; x < W - 1; x++) {
        g[fy][x] = '#';
        g[fy + 1][x] = '#';
        g[cy][x] = '#';
        g[cy - 1][x] = '#';
      }
      // стены комнат с проёмами
      for (let x = 5 + roomW; x < W - 6; x += roomW) {
        for (let y = cy + 1; y < fy; y++) g[y][x] = '#';
        g[fy - 1][x] = '.';
        g[fy - 2][x] = '.';
        g[fy - 3][x] = '.';
      }
      // небольшие верхние антресоли в комнатах
      for (let x = 6; x < W - 6; x += roomW) {
        if (rnd() < 0.55) {
          const px = x + 2;
          for (let k = 0; k < 4; k++) if (g[fy - 4] && g[fy - 4][px + k] !== '#') g[fy - 4][px + k] = '=';
        }
      }
    }

    const start = { x: 4 * T + T / 2, y: (levelYs[0] - 1) * T };
    const exitTx = W - 7;
    const exitTy = levelYs[3] - 1;

    const rooms = [];
    const themes = ['office', 'production', 'storage', 'lab', 'archive', 'utility'];
    const names = {
      office: ['КАБИНЕТ', 'БУХГАЛТЕРИЯ'], production: ['ЦЕХ', 'ЛИНИЯ'],
      storage: ['СКЛАД', 'КЛАДОВАЯ'], lab: ['ЛАБОРАТОРИЯ', 'ПАЛАТА'],
      archive: ['АРХИВ', 'КАРТОТЕКА'], utility: ['ЩИТОВАЯ', 'НАСОСНАЯ']
    };
    for (let li = 0; li < levelYs.length; li++) {
      const count = Math.floor((W - 6) / roomW);
      for (let i = 0; i < count; i++) {
        const theme = themes[Math.floor(rnd() * themes.length)];
        const pool = names[theme];
        rooms.push({
          x: (2 + i * roomW) * T, y: (levelYs[li] - 5) * T,
          w: roomW * T, h: 6 * T, theme,
          name: li === 0 && i === 0 ? (chapter.gen.start.name || 'КОРИДОР') : pool[Math.floor(rnd() * pool.length)]
        });
      }
    }

    const objects = [], enemies = [];
    const used = new Set();
    const key = (x, y) => x + ',' + y;
    const floorSpots = [];
    for (let li = 0; li < levelYs.length; li++) {
      const fy = levelYs[li];
      for (let x = 3; x < W - 4; x++) {
        if (g[fy][x] === '#' && g[fy - 1][x] === '.' && g[fy - 2][x] === '.') floorSpots.push({ x, y: fy - 1, li });
      }
    }
    const nearElevator = (x) => elevatorXs.some((ex) => Math.abs(ex - x) < 3);
    const nearWall = (x) => {
      const m = (x - 5) % roomW;
      return m === 0 || m === roomW - 1;
    };
    const pick = (pred) => {
      for (let i = 0; i < 120; i++) {
        const sp = floorSpots[Math.floor(rnd() * floorSpots.length)];
        if (!sp || used.has(key(sp.x, sp.y))) continue;
        if (Math.abs(sp.x - 4) < 4 || nearElevator(sp.x) || nearWall(sp.x)) continue;
        if (pred && !pred(sp)) continue;
        used.add(key(sp.x, sp.y));
        return sp;
      }
      return null;
    };
    const add = (kind, data, pred) => {
      const sp = pick(pred);
      if (!sp) return null;
      objects.push(Object.assign({ kind, tx: sp.x, ty: sp.y, x: sp.x * T + T / 2, y: sp.y * T + T / 2 }, data));
      return sp;
    };

    // лифты: вверх/вниз на каждом этаже
    for (let li = 0; li < levelYs.length; li++) {
      const fy = levelYs[li];
      for (const ex of elevatorXs) {
        if (li < levelYs.length - 1) {
          objects.push({
            kind: 'elevator', dir: 'up', level: li,
            x: ex * T + T / 2, y: (fy - 1) * T + T / 2,
            tx: ex, ty: fy - 1,
            targetLevel: li + 1,
            targetX: ex * T + T / 2,
            targetY: (levelYs[li + 1] - 1) * T + T / 2,
            anim: 0, seed: 1
          });
        }
        if (li > 0) {
          objects.push({
            kind: 'elevator', dir: 'down', level: li,
            x: (ex + 1.5) * T + T / 2, y: (fy - 1) * T + T / 2,
            tx: ex + 1.5, ty: fy - 1,
            targetLevel: li - 1,
            targetX: (ex + 1.5) * T + T / 2,
            targetY: (levelYs[li - 1] - 1) * T + T / 2,
            anim: 0, seed: 2
          });
        }
      }
      const cp = 6 + li * 2;
      objects.push({ kind: 'checkpoint', tx: cp, ty: fy - 1, x: cp * T + T / 2, y: (fy - 1) * T + T / 2, taken: false });
    }

    // квестовые предметы — по этажам
    let levelCursor = 0;
    for (const gl of (chapter.goals || [])) {
      if (gl.type !== 'collect') continue;
      for (let i = 0; i < (gl.count || 0); i++) {
        const li = levelCursor++ % levelYs.length;
        add('quest', { item: gl.item, label: gl.itemLabel || gl.text }, (sp) => sp.li === li);
      }
    }
    for (const n of (chapter.notes || [])) add('note', { noteId: n.id, label: 'Документ' });
    for (const wid of (chapter.gen.weapons || [])) add('weapon', { weapon: wid, label: wid });
    const items = chapter.gen.items || {};
    for (const it of ['medkit', 'ammo', 'battery', 'painkiller', 'adrenaline', 'salt', 'food']) {
      for (let i = 0; i < (items[it] || 0); i++) {
        const itemId = it === 'ammo' ? 'ammo_9x18' : it;
        const cnt = it === 'ammo' ? 8 : 1;
        add('item', { item: itemId, count: cnt, label: (RB.Items.get(itemId) || {}).name || it });
      }
    }
    for (const id of (chapter.gen.npcs || [])) {
      const sp = add('npc', { npcId: id, label: 'NPC' });
    }
    if (chapter.gen.shop !== false) {
      const sp = add('shop', { stock: [] });
      if (sp) {
        const obj = objects[objects.length - 1];
        const pool = (RB.ShopPool || []).slice();
        for (let k = 0; k < 5 && pool.length; k++) {
          const idx = Math.floor(rnd() * pool.length);
          obj.stock.push(Object.assign({}, pool[idx]));
          pool.splice(idx, 1);
        }
      }
    }

    if (chapter.gen.factionShop && RB.FisherShop) {
      add('shop', {
        faction: 'fishers', label: 'РЫБАКИ',
        stock: RB.FisherShop.map((x) => Object.assign({}, x))
      });
    }

    // изометрические двери в комнатах
    let doorCount = 0;
    for (let li = 0; li < levelYs.length && doorCount < 4; li++) {
      for (let x = 5 + roomW; x < W - 6 && doorCount < 4; x += roomW * 2) {
        objects.push({
          kind: 'door', tx: x, ty: levelYs[li] - 1,
          x: x * T + T / 2, y: (levelYs[li] - 1) * T + T / 2,
          label: 'ДВЕРЬ', seed: seedNum + x * 7 + li, anim: 0
        });
        doorCount++;
      }
    }

    // рычаги и тайники
    for (let li = 0; li < levelYs.length; li++) {
      const fy = levelYs[li];
      const lx = 8 + li * 7;
      if (g[fy][lx] === '#') {
        objects.push({ kind: 'lever', tx: lx, ty: fy - 1, x: lx * T + T / 2, y: (fy - 1) * T + T / 2, on: false });
      }
      const cx = 18 + li * 9;
      if (g[fy][cx] === '#') {
        objects.push({ kind: 'cache', tx: cx, ty: fy - 1, x: cx * T + T / 2, y: (fy - 1) * T + T / 2, taken: false });
      }
    }

    // улики для фото
    for (let li = 0; li < levelYs.length; li++) {
      const cx = 24 + li * 3;
      if (g[levelYs[li]][cx] === '#') {
        objects.push({
          kind: 'clue', tx: cx, ty: levelYs[li] - 1,
          x: cx * T + T / 2, y: (levelYs[li] - 1) * T + T / 2,
          taken: false, label: 'УЛИКА'
        });
      }
    }

    // ключи, кнопки и сигил — элементы графа замков
    const reqs = {};
    const freeSpot = (startX, li) => {
      let x = startX;
      for (let tries = 0; tries < 30; tries++, x++) {
        if (x > 0 && x < W - 1 && g[levelYs[li]][x] === '#' && !objects.some((o) => o.tx === x && o.ty === levelYs[li] - 1)) {
          return x;
        }
      }
      return startX;
    };
    if (chapter.gen.keyLock) {
      const kx = freeSpot(30, 0);
      objects.push({
        kind: 'key', tx: kx, ty: levelYs[0] - 1,
        x: kx * T + T / 2, y: (levelYs[0] - 1) * T + T / 2,
        taken: false, label: 'КЛЮЧ'
      });
      reqs.key = true;
    }
    if (chapter.gen.button) {
      const bx = freeSpot(34, 0);
      objects.push({
        kind: 'button', tx: bx, ty: levelYs[0] - 1,
        x: bx * T + T / 2, y: (levelYs[0] - 1) * T + T / 2,
        pressed: false, label: 'ПРЕСС'
      });
      reqs.button = true;
    }
    if (chapter.gen.code) reqs.code = String(chapter.gen.code);
    if (chapter.gen.sigil) {
      const sx = freeSpot(exitTx - 5, levelYs.length - 1);
      objects.push({
        kind: 'sigil', tx: sx, ty: exitTy,
        x: sx * T + T / 2, y: exitTy * T + T / 2,
        done: false, label: 'СИГИЛ'
      });
      reqs.sigil = true;
    }
    // игральные кости
    const gx = freeSpot(42, 0);
    objects.push({
      kind: 'gamble', tx: gx, ty: levelYs[0] - 1,
      x: gx * T + T / 2, y: (levelYs[0] - 1) * T + T / 2,
      label: 'КОСТИ'
    });
    // укрытие
    const shx = freeSpot(45, 0);
    objects.push({
      kind: 'shelter', tx: shx, ty: levelYs[0] - 1,
      x: shx * T + T / 2, y: (levelYs[0] - 1) * T + T / 2,
      label: 'ШКАФ'
    });
    // служебные терминалы: почта и консоль смены
    const mlx = freeSpot(9, 0);
    objects.push({
      kind: 'mail', chapter: chapter.id, tx: mlx, ty: levelYs[0] - 1,
      x: mlx * T + T / 2, y: (levelYs[0] - 1) * T + T / 2,
      label: 'ПОЧТА'
    });
    const csx = freeSpot(14, 0);
    objects.push({
      kind: 'console', chapter: chapter.id, tx: csx, ty: levelYs[0] - 1,
      x: csx * T + T / 2, y: (levelYs[0] - 1) * T + T / 2,
      label: 'КОНСОЛЬ', hacked: false
    });
    // головоломки
    (chapter.gen.puzzles || []).forEach((pid, pi) => {
      const px = freeSpot(48 + pi * 3, Math.min(pi, levelYs.length - 1));
      const py = levelYs[Math.min(pi, levelYs.length - 1)] - 1;
      objects.push({
        kind: 'puzzle', puzzle: pid, tx: px, ty: py,
        x: px * T + T / 2, y: py * T + T / 2,
        done: false, label: pid.toUpperCase()
      });
    });
    // секретная комната за стеной
    const secx = freeSpot(6, 1);
    objects.push({
      kind: 'secret', tx: secx, ty: levelYs[1] - 1,
      x: secx * T + T / 2, y: (levelYs[1] - 1) * T + T / 2,
      taken: false, label: 'СЕКРЕТ'
    });
    // спасение рабочего
    const rx = freeSpot(52, 0);
    objects.push({
      kind: 'rescue', tx: rx, ty: levelYs[0] - 1,
      x: rx * T + T / 2, y: (levelYs[0] - 1) * T + T / 2,
      taken: false, label: 'РАБОЧИЙ'
    });
    // тайники с замками
    for (let si = 0; si < 2; si++) {
      const li = Math.min(si, levelYs.length - 1);
      const sx = freeSpot(20 + si * 8, li);
      objects.push({
        kind: 'stash', tx: sx, ty: levelYs[li] - 1,
        x: sx * T + T / 2, y: (levelYs[li] - 1) * T + T / 2,
        taken: false, tier: 1 + Math.min(2, Math.floor(chapter.id / 2)), label: 'ТАЙНИК'
      });
    }
    // брошенная одежда
    const wearables = ['hat_01', 'hat_02', 'hat_03', 'hat_04', 'shirt_01', 'shirt_02', 'shirt_03', 'sweater_01', 'sweater_02', 'jacket_01', 'jacket_02', 'pants_01', 'pants_02', 'pants_03', 'boots_01', 'boots_02', 'rps_01', 'helmet_01'];
    for (let wi = 0; wi < 2; wi++) {
      const li = Math.min(wi, levelYs.length - 1);
      const wx = freeSpot(56 + wi * 4, li);
      objects.push({
        kind: 'item', item: wearables[Math.floor(rnd() * wearables.length)],
        tx: wx, ty: levelYs[li] - 1,
        x: wx * T + T / 2, y: (levelYs[li] - 1) * T + T / 2,
        label: 'ОДЕЖДА'
      });
    }
    // магазины к оружию внутри локации
    const mags = ['mag_pm', 'mag_pm', 'mag_ak', 'mag_ak', 'mag_flame'];
    for (let mi = 0; mi < 3; mi++) {
      const li = Math.min(mi, levelYs.length - 1);
      const mx = freeSpot(62 + mi * 3, li);
      objects.push({
        kind: 'item', item: mags[Math.floor(rnd() * mags.length)],
        tx: mx, ty: levelYs[li] - 1,
        x: mx * T + T / 2, y: (levelYs[li] - 1) * T + T / 2,
        label: 'МАГАЗИН'
      });
    }

    // выход на верхнем этаже
    const exit = {
      kind: 'exit', tx: exitTx, ty: exitTy,
      x: exitTx * T + T / 2, y: exitTy * T + T / 2,
      locked: true, label: chapter.gen.exit.label || 'Выход',
      reqs
    };
    objects.push(exit);
    let finale = null;
    if (chapter.gen.finale) {
      const fx = W - 10;
      finale = Object.assign({ kind: 'finale', tx: fx, ty: exitTy, x: fx * T + T / 2, y: exitTy * T + T / 2 }, chapter.gen.finale);
      objects.push(finale);
    }

    // враги по этажам
    const weights = chapter.gen.enemyWeights || { sledok: 1 };
    const pool = [];
    for (const k in weights) for (let i = 0; i < weights[k]; i++) pool.push(k);
    let budget = chapter.gen.enemyBudget || 4;
    let guard = 0;
    while (budget > 0 && guard++ < 200) {
      const sp = pick();
      if (!sp) continue;
      enemies.push({ type: pool[Math.floor(rnd() * pool.length)], tx: sp.x, ty: sp.y, x: sp.x * T + T / 2, y: sp.y * T + T / 2 });
      budget--;
    }
    if (chapter.gen.boss) {
      const btype = chapter.gen.bossType || 'boss';
      const bx = W - 12, by = exitTy;
      objects.push({
        kind: 'boss', tx: bx, ty: by,
        x: bx * T + T / 2, y: by * T + T / 2,
        bossType: btype, negotiated: false, label: 'БОСС'
      });
      const tx = W - 15;
      objects.push({ kind: 'trap', tx, ty: by, x: tx * T + T / 2, y: by * T + T / 2, label: 'ЛЕБЁДКА' });
      const kx = freeSpot(46, 0);
      const bossNames = { boss: 'Надзиратель', mat: 'Мать Смены', chorus: 'Соляной Хор', dvoynik: 'Двойник' };
      objects.push({
        kind: 'bosskey', tx: kx, ty: levelYs[0] - 1,
        x: kx * T + T / 2, y: (levelYs[0] - 1) * T + T / 2,
        taken: false, bossName: bossNames[btype] || 'БОСС', label: 'КЛЮЧ — ' + (bossNames[btype] || 'БОСС')
      });
    }

    return {
      w: W, h: H, grid: g, start, rooms, objects, enemies,
      exit, finale, seed: seedNum >>> 0, sideView: true
    };
  }

  RB.Gen.generate = function (chapter, seed) { return sideGen(chapter, seed); };

  /* ================= МИР ================= */
  class PWorld extends BaseWorld {
    constructor(data) {
      super(data);
      this.sideView = true;
      this.enemies = data.enemies.map((e) => new RB.Enemy(e.type, e.x, e.y));
      this.saltPuddles = this.saltPuddles || [];
      this.limbs = this.limbs || [];
      this.projectiles = [];
      this.corpses = [];
    }

    updateProjectiles(dt, player, game) {
      for (const c of this.corpses || []) c.life -= dt;
      if (this.corpses && this.corpses.length) this.corpses = this.corpses.filter((c) => c.life > 0);
      for (const pr of this.projectiles.slice()) {
        pr.life -= dt;
        pr.vy += 520 * dt;
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        let hit = false;
        if (this.solidAt(pr.x, pr.y)) hit = true;
        if (!hit && RB.dist(pr.x, pr.y, player.x, player.y) < 22) {
          player.damage(pr.dmg * (game.enemyDamageMul || 1), this, game, pr.x, pr.y);
          hit = true;
          RB.Sound.play('flesh');
          this.spawnParticles(pr.x, pr.y, 6, { speed: [30, 90], life: [0.2, 0.5], size: [1, 3], color: '#7a5a3a', drag: 4 });
        }
        if (hit || pr.life <= 0) {
          if (hit) this.spawnParticles(pr.x, pr.y, 5, { speed: [20, 80], life: [0.2, 0.5], size: [1, 2], color: '#5a4a3a', drag: 5 });
          this.projectiles.splice(this.projectiles.indexOf(pr), 1);
        }
      }
    }

    isPlatform(x, y) {
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
      return this.grid[ty][tx] === '=';
    }

    solidAt(x, y) {
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
      return !!SOLID[this.grid[ty][tx]];
    }

    platformAt(x, y) {
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
      return this.grid[ty][tx] === '=';
    }

    actorBlocked(cx, cy, hw, hh, self) {
      for (const e of this.enemies) {
        if (e === self || e.dead) continue;
        const ew = (e.w || e.r * 2) / 2;
        const eh = (e.h || e.r * 2) / 2;
        if (Math.abs(cx - e.x) < hw + ew - 4 && Math.abs(cy - e.y) < hh + eh - 4) return true;
      }
      const pl = this.playerRef;
      if (pl && pl !== self && !pl.dead) {
        const pw = (pl.w || 26) / 2;
        const ph = (pl.h || 46) / 2;
        if (Math.abs(cx - pl.x) < hw + pw - 4 && Math.abs(cy - pl.y) < hh + ph - 4) return true;
      }
      return false;
    }

    rectBlocked(cx, cy, hw, hh) {
      // проверка прямоугольника по тайлам
      const x0 = Math.floor((cx - hw) / T), x1 = Math.floor((cx + hw) / T);
      const y0 = Math.floor((cy - hh) / T), y1 = Math.floor((cy + hh) / T);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
          if (SOLID[this.grid[ty][tx]]) return true;
        }
      }
      return false;
    }

    moveEntity(e, dx, dy, r) {
      const hw = (e.w || r * 2) / 2;
      const hh = (e.h || r * 2) / 2;
      let moved = 0;
      const checkH = Math.max(2, hw - 2);
      const checkV = Math.max(2, hh - 8);

      if (dx) {
        const nx = e.x + dx;
        if (!this.rectBlocked(nx, e.y - 2, checkH, checkV) && !this.actorBlocked(nx, e.y, checkH, checkV, e)) {
          e.x = nx;
          moved += Math.abs(dx);
        }
      }

      if (dy) {
        if (dy > 0) {
          const feet = e.y + hh;
          const newFeet = feet + dy;
          const fty = Math.floor((newFeet + 1) / T);
          const txL = Math.floor((e.x - hw + 4) / T);
          const txR = Math.floor((e.x + hw - 4) / T);
          let floorY = null;
          for (let tx = txL; tx <= txR; tx++) {
            if (this.solidTile(tx, fty) || (this.grid[fty] && this.grid[fty][tx] === '=')) {
              const top = fty * T;
              if (top >= feet - 8) floorY = top;
              break;
            }
          }
          if (floorY != null) {
            e.y = floorY - hh;
            e.vy = 0;
            e.onGround = true;
          } else {
            const ny = e.y + dy;
            if (!this.rectBlocked(e.x, ny, checkH, checkV) && !this.actorBlocked(e.x, ny, checkH, checkV, e)) {
              e.y = ny;
              e.onGround = false;
              moved += Math.abs(dy);
            } else {
              e.vy = 0;
            }
          }
        } else {
          const ny = e.y + dy;
          if (!this.rectBlocked(e.x, ny - 2, checkH, checkV) && !this.actorBlocked(e.x, ny, checkH, checkV, e)) {
            e.y = ny;
            moved += Math.abs(dy);
          } else {
            e.vy = 0;
          }
        }
      }

      if (!e.onGround) {
        const feet = e.y + hh;
        const fty = Math.floor((feet + 2) / T);
        const txL = Math.floor((e.x - hw + 4) / T);
        const txR = Math.floor((e.x + hw - 4) / T);
        for (let tx = txL; tx <= txR; tx++) {
          if (this.solidTile(tx, fty) || (this.grid[fty] && this.grid[fty][tx] === '=')) {
            e.onGround = true;
            break;
          }
        }
      }
      return moved;
    }

    canStand(x, y, r) {
      return !this.solidAt(x, y) && !this.solidAt(x, y + (r || 16));
    }

    isIso() { return this.mode === 'iso'; }
  }

  /* ================= ИГРОК ================= */
  class PPlayer extends BasePlayer {
    constructor(x, y) {
      super(x, y);
      this.w = 34;
      this.h = 64;
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.lastSafe = { x, y };
      this.facing = 1;
      this.platformer = true;
    }

    update(dt, input, world, game) {
      if (this.dead) return;
      if (world.mode === 'iso') { this.updateIso(dt, input, world, game); return; }
      this.invuln = Math.max(0, this.invuln - dt);
      this.fireCd = Math.max(0, this.fireCd - dt);
      this.meleeCd = Math.max(0, this.meleeCd - dt);
      this.stompCd = Math.max(0, (this.stompCd || 0) - dt);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
      this.muzzle = Math.max(0, this.muzzle - dt * 12);
      this.recoil = Math.max(0, this.recoil - dt * 8);
      this.saltVision = Math.max(0, this.saltVision - dt);
      this.adrenaline = Math.max(0, this.adrenaline - dt);
      this.painkiller = Math.max(0, this.painkiller - dt);
      this.redLight = Math.max(0, this.redLight - dt);

      if (this.bleed > 0) {
        this.bleed -= dt;
        this.hp -= 7 * dt;
        if (this.hp <= 0) { this.hp = 0; this.dead = true; RB.Sound.play('death'); game.onDeath(); return; }
      }
      if (this.hidden) { this.vx = 0; this.vy = 0; return; }

      if (this.reloadTimer > 0) {
        this.reloadTimer -= dt;
        if (this.reloadTimer <= 0 && !this.inv) {
          const w = RB.Weapons[this.weapon];
          const need = w.mag - this.ammo;
          const take = Math.min(need, this.reserve);
          this.ammo += take;
          this.reserve -= take;
          RB.Sound.play('reload');
        }
      }

      const water = world.waterAt(this.x, this.y + this.h / 2);
      const salt = world.inSalt ? world.inSalt(this.x, this.y) : false;
      const moving = Math.abs(input.move.x) > 0.15;
      const speed = (water ? 120 : 215) * (salt ? 0.55 : 1) * (this.adrenaline > 0 ? 1.35 : 1) * (this.drugCap || 1);
      const accel = this.onGround ? 2200 : 900;
      const target = input.move.x * speed;
      this.vx += RB.clamp(target - this.vx, -accel * dt, accel * dt);
      if (!moving && this.onGround) this.vx *= Math.pow(0.0015, dt);
      if (Math.abs(this.vx) > 8) this.facing = this.vx > 0 ? 1 : -1;

      // прыжок
      if (input.consume('jump')) this.jumpBuffer = 0.14;
      this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
      this.coyote = this.onGround ? 0.1 : Math.max(0, this.coyote - dt);
      if (this.jumpBuffer > 0 && this.coyote > 0) {
        this.vy = -720;
        this.onGround = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.stamina = RB.clamp(this.stamina - 7, 0, 100);
        RB.Sound.play('step', { vol: 0.8 });
      }
      if (this.vy < 0 && !input.held('jump') && !this.jumpCut) { this.vy *= 0.55; this.jumpCut = true; }
      if (this.onGround) this.jumpCut = false;
      this.vy += (water ? 900 : 1850) * dt;
      this.vy = Math.min(this.vy, 1100);
      if (input.move.y > 0.6) this.vy += 1400 * dt; // быстрое падение

      const fallVy = this.vy;
      world.moveEntity(this, this.vx * dt, this.vy * dt, 13);
      // пасхалка на Марио: прыжок на голову
      if (fallVy > 120 && this.stompCd <= 0) {
        const feet = this.y + this.h / 2;
        for (const e of world.enemies) {
          if (e.dead) continue;
          const ew = (e.w || e.r * 2) / 2;
          const eh = (e.h || e.r * 2) / 2;
          const top = e.y - eh;
          if (Math.abs(this.x - e.x) > ew + 12) continue;
          if (feet < top - 6 || feet > top + 26) continue;
          if (this.y > e.y) continue;
          this.stompCd = 0.45;
          e.hurt(4 * (this.legPower || 1), world, game, Math.PI / 2, { limbChance: 0.2, weapon: 'stomp' });
          world.addBlood(e.x, e.y, 10);
          world.spawnParticles(e.x, top, 8, {
            speed: [30, 110], life: [0.2, 0.5], size: [1, 2.5], color: '#d8cdb0', drag: 4
          });
          this.vy = -560;
          this.onGround = false;
          RB.Sound.play('step', { vol: 1.1 });
          RB.Sound.play('flesh');
          game.ui.toast('ПРЫЖОК НА ГОЛОВУ · +' + (4 * (this.legPower || 1)).toFixed(0));
          break;
        }
      }
      if (this.onGround) {
        this.lastSafe = { x: this.x, y: this.y - 2 };
        this.stamina = RB.clamp(this.stamina + 18 * dt * this.staminaRegen, 0, 100);
      }
      if (this.vy > 900 && this.onGround) {
        this.damage(12, world, game, null, null);
      }
      this.vy = Math.max(this.vy, -1200);

      // падение в яму
      if (this.y > world.pxH + 120) {
        this.x = this.lastSafe.x;
        this.y = this.lastSafe.y;
        this.vx = 0; this.vy = 0;
        this.damage(18, world, game, null, null);
        game.shake(8, 0.4);
      }

      // шипы
      const feetTy = Math.floor((this.y + this.h / 2 + 4) / T);
      const tx = Math.floor(this.x / T);
      if (world.grid[feetTy] && world.grid[feetTy][tx] === '^') {
        this.damage(10, world, game, this.x - this.facing * 20, this.y);
      }

      if (moving) {
        this.noise = 0.55;
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) {
          this.stepTimer = 0.4;
          RB.Sound.play(water ? 'splash' : 'step');
        }
        this.walkPhase += dt * 10;
      } else {
        this.noise = 0.15;
      }

      // фонарь
      if (input.consume('flashlight')) {
        if (this.battery > 0) { this.flashlight = !this.flashlight; RB.Sound.play('ui'); }
        else RB.Sound.play('dry');
      }
      if (this.flashlight) {
        this.battery = RB.clamp(this.battery - 1.05 * dt, 0, 100);
        if (this.battery <= 0) { this.flashlight = false; RB.Sound.play('deny'); }
      }

      // прицел
      if (input.touchMode) {
        if (input.aiming) this.angle = input.aimAngle;
      } else {
        const p = game.screenToWorld(input.mouse.x, input.mouse.y);
        if (RB.dist(p.x, p.y, this.x, this.y) > 6) this.angle = Math.atan2(p.y - this.y, p.x - this.x);
        if (input.firing) this.angle = Math.atan2(p.y - this.y, p.x - this.x);
      }

      if (input.firing) { if (this.reloadTimer <= 0) this.tryShoot(world, game); }
      if (input.consume('reload')) this.startReload();
      if (input.consume('melee')) this.melee(world, game);
      if (input.consume('weapon')) this.cycleWeapon();
      if (input.consume('laser') && this.laserOwned) {
        this.laser = !this.laser;
        RB.Sound.play('ui');
        game.ui.toast(this.laser ? 'ЛАЗЕР ВКЛ' : 'ЛАЗЕР ВЫКЛ');
      }

      if (input.consume('record')) this.startRecord(game);
      if (this.recording) {
        this.recordTimer -= dt;
        const can = Math.abs(input.move.x) < 0.2 && this.onGround;
        if (!can || this.invuln > 0.9) {
          this.recording = false; this.recordTimer = 0;
          game.ui.toast('ЗАПИСЬ ПРЕРВАНА');
          RB.Sound.play('deny');
        } else if (this.recordTimer <= 0) {
          this.recording = false;
          this.records++;
          this.attention = RB.clamp(this.attention - 32, 0, 100);
          RB.Sound.play('stamp');
          game.onRecorded();
        }
      }

      // внимание
      let att = -0.55;
      if (this.flashlight && this.battery > 0) att += 0.35;
      if (this.noise > 0.6) att += (this.noise - 0.6) * 1.6;
      for (const e of world.enemies) {
        if (e.dead) continue;
        const d = RB.dist(e.x, e.y, this.x, this.y);
        if (d < 380 && world.lineOfSight(e.x, e.y, this.x, this.y, 380)) att += (1 - d / 380) * 2.2;
      }
      if (this.hp < 35) att += 0.7;
      this.attention = RB.clamp(this.attention + att * dt * this.attentionMul, 0, 100);

      // регенерация
      if (this.hp < this.maxHp && this.attention < 30) this.hp = RB.clamp(this.hp + 1.1 * dt, 0, this.maxHp);
    }
  }

  PPlayer.prototype.updateIso = function (dt, input, world, game) {
    const p = this;
    p.invuln = Math.max(0, p.invuln - dt);
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.meleeCd = Math.max(0, p.meleeCd - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt * 2.5);
    p.saltVision = Math.max(0, p.saltVision - dt);
    p.adrenaline = Math.max(0, p.adrenaline - dt);
    p.painkiller = Math.max(0, p.painkiller - dt);
    p.redLight = Math.max(0, p.redLight - dt);

    if (p.reloadTimer > 0) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) {
        const w = RB.Weapons[p.weapon];
        const take = Math.min(w.mag - p.ammo, p.reserve);
        p.ammo += take; p.reserve -= take;
        RB.Sound.play('reload');
      }
    }

    const sp = 175 * (p.adrenaline > 0 ? 1.35 : 1) * (world.inSalt(p.x, p.y) ? 0.6 : 1);
    const hw = p.w / 2 - 2, hh = p.h / 2 - 3;
    // стик задан в экранных осях: в изометрии переводим в мировые
    let mx = input.move.x, my = input.move.y;
    const mag = Math.hypot(mx, my);
    if (mag > 0.001) {
      const wv = RB.Iso.screenVecToWorld(mx, my);
      const wl = Math.hypot(wv.x, wv.y) || 1;
      mx = (wv.x / wl) * mag;
      my = (wv.y / wl) * mag;
    }
    const nx = p.x + mx * sp * dt;
    if (!world.rectBlocked(nx, p.y, hw, hh) && !world.actorBlocked(nx, p.y, hw, hh, p)) p.x = nx;
    const ny = p.y + my * sp * dt;
    if (!world.rectBlocked(p.x, ny, hw, hh) && !world.actorBlocked(p.x, ny, hw, hh, p)) p.y = ny;
    p.onGround = true; p.vy = 0;

    if (input.touchMode) {
      if (input.aiming) p.angle = RB.Iso.screenAngleToWorld(input.aimAngle);
    } else {
      const m = game.screenToWorld(input.mouse.x, input.mouse.y);
      if (RB.dist(m.x, m.y, p.x, p.y) > 6) p.angle = Math.atan2(m.y - p.y, m.x - p.x);
    }
    if (input.firing) p.tryShoot(world, game);
    if (input.consume('reload')) p.startReload();
    if (input.consume('melee')) p.melee(world, game);
    if (input.consume('weapon')) p.cycleWeapon();
    if (input.consume('flashlight')) {
      if (p.battery > 0) { p.flashlight = !p.flashlight; RB.Sound.play('ui'); }
    }
    if (p.flashlight) {
      p.battery = RB.clamp(p.battery - 1.05 * dt, 0, 100);
      if (p.battery <= 0) p.flashlight = false;
    }
    let att = -0.5;
    for (const e of world.enemies) {
      if (e.dead) continue;
      const d = RB.dist(e.x, e.y, p.x, p.y);
      if (d < 360) att += (1 - d / 360) * 2;
    }
    p.attention = RB.clamp(p.attention + att * dt * p.attentionMul, 0, 100);
    if (p.hp < p.maxHp && p.attention < 30) p.hp = RB.clamp(p.hp + 1.1 * dt, 0, p.maxHp);
  };

  /* ================= ВРАГИ ================= */
  class PEnemy extends BaseEnemy {
    constructor(type, x, y) {
      super(type, x, y);
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.jumpCd = 0;
      this.w = Math.max(22, this.r * 2);
      this.h = Math.max(30, this.r * 2);
    }

    update(dt, world, player, game) {
      if (this.dead) return;
      if (world.mode === 'iso') { this.updateIso(dt, world, player, game); return; }
      this.hitFlash = Math.max(0, this.hitFlash - dt * 3);
      this.pinned = this.pinned || 0;
      this.burning = this.burning || 0;
      if (this.pinned > 0) {
        this.pinned -= dt;
        if (Math.random() < dt * 0.45) {
          this.pinned = 0;
          this.state = 'chase';
          this.alertTimer = 6;
          world.spawnParticles(this.x, this.y, 8, { speed: [30, 120], life: [0.2, 0.5], size: [1, 3], color: '#5a120c', drag: 4 });
        }
        return;
      }
      if (this.burning > 0) {
        this.burning -= dt;
        this.hp -= dt * 1.4;
        if (this.hp <= 0) { this.dead = true; this.reviveTimer = 34; world.kills++; world.addBlood(this.x, this.y, 20); return; }
      }
      this.jumpCd = Math.max(0, this.jumpCd - dt);
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      this.bob += dt * 3;

      if (this.collectMode) { this.collectMove(dt, world, player, game); return; }

      const d = RB.dist(this.x, this.y, player.x, player.y);
      const sees = this.canSee(world, player);
      const hears = this.hears(player);
      this.throwCd = Math.max(0, (this.throwCd || 0) - dt);
      this.throwWindup = this.throwWindup || 0;
      this.fleeTimer = this.fleeTimer || 0;

      // культист сдаётся, если понял, что не победит
      if (this.type === 'cultist' && !this.surrendered && this.hp <= this.maxHp * 0.3) {
        this.surrendered = true;
        this.state = 'surrender';
        this.surrenderTimer = 10;
        if (game && game.ui) game.ui.toast('КУЛЬТИСТ ПРОСИТ ПОЩАДЫ');
      }
      if (this.state === 'surrender') {
        this.surrenderTimer -= dt;
        this.vx = 0;
        this.vy += 1850 * dt;
        world.moveEntity(this, 0, this.vy * dt, this.r);
        if (this.surrenderTimer <= 0) { this.state = 'chase'; this.surrendered = false; }
        return;
      }

      // метательные враги
      if (['cultist', 'noschik', 'propovednik'].includes(this.type) && sees && this.state !== 'flee' && d > 90 && d < 380) {
        if (this.throwCd <= 0 && this.throwWindup <= 0) {
          this.throwCd = 3.4;
          this.throwWindup = 0.45;
        }
      }
      if (this.throwWindup > 0) {
        this.throwWindup -= dt;
        if (this.throwWindup <= 0) {
          const dir = Math.sign(player.x - this.x) || 1;
          world.projectiles.push({
            x: this.x, y: this.y - 12,
            vx: dir * 230, vy: -110,
            dmg: this.type === 'propovednik' ? 14 : 9,
            life: 3.2, type: 'throw'
          });
          RB.Sound.play('whoosh');
        }
      }

      const witness = this.type === 'svidetel';
      if (witness) {
        if (sees || hears) {
          if (this.fleeTimer <= 0) this.screamed = false;
          this.fleeTimer = 2.4;
        }
        if (this.fleeTimer > 0) {
          this.fleeTimer -= dt;
          this.state = 'flee';
          if (!this.screamed) {
            this.screamed = true;
            for (const e of world.enemies) {
              if (e === this || e.dead) continue;
              if (RB.dist(e.x, e.y, this.x, this.y) < 520) {
                e.state = 'chase';
                e.alertTimer = 7;
                e.lastKnown = { x: player.x, y: player.y };
              }
            }
            if (game && game.player) {
              game.player.attention = RB.clamp((game.player.attention || 0) + 18, 0, 100);
              if (game.shake) game.shake(4, 0.3);
              if (game.ui) game.ui.subtitle('СВИДЕТЕЛЬ ЗАКРИЧАЛ. ОН ВЕДЁТ ИХ К ТЕБЕ.', 3);
            }
            RB.Sound.play('whisper');
          }
        } else if (this.state === 'flee') {
          this.state = 'idle';
        }
      } else if (sees || hears) {
        this.state = 'chase';
        this.alertTimer = 7;
        this.lastKnown = { x: player.x, y: player.y };
      }
      if (this.state === 'chase') {
        this.alertTimer -= dt;
        if (this.alertTimer <= 0 && !sees) this.state = 'idle';
      }

      let dir = 0;
      if (this.state === 'chase') dir = Math.sign(player.x - this.x) || 0;
      else if (this.state === 'flee') dir = -(Math.sign(player.x - this.x) || 1);
      else {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = RB.rand(2, 5);
          this.wanderDir = RB.rand(0, Math.PI * 2);
        }
        dir = Math.sign(Math.cos(this.wanderDir)) * 0.5;
      }

      const sp = (this.state === 'chase' ? this.def.chase
        : this.state === 'flee' ? this.def.chase * 1.05
        : this.def.speed * 0.5) * this.speedFactor();
      this.vx = dir * sp;
      this.vy += 1850 * dt;
      this.vy = Math.min(this.vy, 1000);

      if (dir !== 0) {
        const aheadX = this.x + dir * (this.w / 2 + 6);
        const feetY = this.y + this.h / 2 + 6;
        const wallAhead = world.solidAt(aheadX, this.y - 4);
        const gapAhead = !world.solidAt(aheadX, feetY) && !world.platformAt(aheadX, feetY);
        if (this.onGround && (wallAhead || (gapAhead && this.state === 'chase')) && this.jumpCd <= 0) {
          this.vy = -660;
          this.onGround = false;
          this.jumpCd = 0.9;
        }
      }
      world.moveEntity(this, this.vx * dt, this.vy * dt, this.r);

      this.attackWindup = Math.max(0, (this.attackWindup || 0) - dt);
      this.attackPending = this.attackPending || 0;
      if (this.attackPending > 0) {
        this.attackPending -= dt;
        if (this.attackPending <= 0) {
          if (!player.hidden) {
            player.damage(this.def.damage * this.damageFactor() * (game.enemyDamageMul || 1), world, game, this.x, this.y);
            RB.Sound.play('flesh');
          }
          this.attackPending = 0;
        }
      } else if (!player.hidden && this.type !== 'svidetel' && d < 58 && Math.abs(player.y - this.y) < 60 && this.attackTimer <= 0 && this.state === 'chase') {
        this.attackTimer = this.def.attackCd;
        this.attackPending = 0.26;
        this.attackWindup = 0.26;
        this.attackKind = this.type === 'noschik' ? 'bite' : (this.missingArms && this.missingArms() >= 2 ? 'bite' : 'weapon');
        RB.Sound.play('whoosh');
      }
      if (world.waterAt(this.x, this.y) && Math.random() < dt * 2) {
        world.spawnParticles(this.x, this.y, 1, { speed: [5, 25], life: [0.3, 0.7], size: [1, 2], color: '#6d8791', drag: 4 });
      }
    }

    collectMove(dt, world, player, game) {
      const parts = this.collectParts.filter((p) => !p.taken);
      if (!parts.length) { this.collectMode = false; this.state = 'chase'; return; }
      let best = parts[0], bd = RB.dist2(this.x, this.y, parts[0].x, parts[0].y);
      for (const p of parts) { const d = RB.dist2(this.x, this.y, p.x, p.y); if (d < bd) { bd = d; best = p; } }
      const dir = Math.sign(best.x - this.x);
      this.vx = dir * 80;
      this.vy += 1850 * dt;
      this.vy = Math.min(this.vy, 900);
      if (this.onGround && best.y < this.y - 30 && this.jumpCd <= 0) { this.vy = -660; this.jumpCd = 0.9; }
      world.moveEntity(this, this.vx * dt, this.vy * dt, this.r);
      if (RB.dist(this.x, this.y, best.x, best.y) < 30) {
        this.restoreLimb(best);
        RB.Sound.play('stamp');
      }
    }
  }

  PEnemy.prototype.updateIso = function (dt, world, player, game) {
    const e = this;
    e.hitFlash = Math.max(0, e.hitFlash - dt * 3);
    e.attackTimer = Math.max(0, e.attackTimer - dt);
    const d = RB.dist(e.x, e.y, player.x, player.y);
    if (!player.hidden && d < 400 && world.lineOfSight(e.x, e.y, player.x, player.y, 420)) {
      e.state = 'chase'; e.alertTimer = 6;
    }
    if (e.state === 'chase' && d > 34) {
      const a = Math.atan2(player.y - e.y, player.x - e.x);
      const sp = e.def.chase;
      const nx = e.x + Math.cos(a) * sp * dt;
      const ny = e.y + Math.sin(a) * sp * dt;
      if (!world.rectBlocked(nx, e.y, e.r, e.r) && !world.actorBlocked(nx, e.y, e.r, e.r, e)) e.x = nx;
      if (!world.rectBlocked(e.x, ny, e.r, e.r) && !world.actorBlocked(e.x, ny, e.r, e.r, e)) e.y = ny;
      e.angle = a;
    }
    if (d < 54 && e.attackTimer <= 0 && e.state === 'chase') {
      e.attackTimer = e.def.attackCd;
      player.damage(e.def.damage * e.damageFactor() * (game.enemyDamageMul || 1), world, game, e.x, e.y);
      RB.Sound.play('flesh');
    }
  };

  RB.World = PWorld;
  RB.Player = PPlayer;
  RB.Enemy = PEnemy;
  RB.PlatformMode = true;
})();
