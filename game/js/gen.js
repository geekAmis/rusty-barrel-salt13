/* ============================================================
   RUSTY BARREL — генератор уровней
   Гибрид: сюжетный каркас (роли комнат) + случайная планировка,
   коридоры, лут, враги и декор. Всё детерминировано сидом.
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});

  const PASSABLE = { '.': 1, ',': 1, '~': 1 };

  class Builder {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.g = [];
      for (let y = 0; y < h; y++) {
        const row = new Array(w).fill('#');
        this.g.push(row);
      }
    }
    inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    get(x, y) { return this.inside(x, y) ? this.g[y][x] : '#'; }
    set(x, y, c) {
      if (this.inside(x, y)) this.g[y][x] = c;
      return this;
    }
    fillRect(x, y, w, h, c) {
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
      return this;
    }
    room(r) { return this.fillRect(r.x, r.y, r.w, r.h, '.'); }
    corridor(x1, y1, x2, y2, thick, rnd) {
      const t = thick || 2;
      const roll = rnd ? rnd() : Math.random();
      if (roll < 0.5) {
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
          for (let d = 0; d < t; d++) this.set(x, y1 + d, '.');
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
          for (let d = 0; d < t; d++) this.set(x2 + d, y, '.');
      } else {
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
          for (let d = 0; d < t; d++) this.set(x1 + d, y, '.');
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
          for (let d = 0; d < t; d++) this.set(x, y1 + d, '.');
      }
      return this;
    }
    walkable(x, y) { return !!PASSABLE[this.g[y] && this.g[y][x]]; }
  }

  function roomsOverlap(a, b, pad) {
    return (
      a.x - pad < b.x + b.w &&
      a.x + a.w + pad > b.x &&
      a.y - pad < b.y + b.h &&
      a.y + a.h + pad > b.y
    );
  }

  function tryPlace(rnd, b, placed, area, w, h) {
    for (let attempt = 0; attempt < 220; attempt++) {
      const x = area.x + Math.floor(rnd() * (area.w - w));
      const y = area.y + Math.floor(rnd() * (area.h - h));
      const cand = { x, y, w, h };
      if (x < area.x || y < area.y) continue;
      if (x + w > area.x + area.w || y + h > area.y + area.h) continue;
      let ok = true;
      for (const r of placed) {
        if (roomsOverlap(cand, r, 2)) { ok = false; break; }
      }
      if (ok) return cand;
    }
    return null;
  }

  function roomCenter(r) {
    return { x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) };
  }

  function bfsReach(grid, w, h, sx, sy) {
    const seen = new Uint8Array(w * h);
    const q = [sx + sy * w];
    seen[sx + sy * w] = 1;
    const order = [];
    while (q.length) {
      const i = q.pop();
      order.push(i);
      const x = i % w, y = (i / w) | 0;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of nb) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = nx + ny * w;
        if (seen[j]) continue;
        if (!PASSABLE[grid[ny][nx]]) continue;
        seen[j] = 1;
        q.push(j);
      }
    }
    return { seen, order };
  }

  function randomFloorInRoom(rnd, grid, r, occupied) {
    const spots = [];
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (!PASSABLE[grid[y][x]]) continue;
        if (x <= r.x || y <= r.y || x >= r.x + r.w - 1 || y >= r.y + r.h - 1) continue;
        const k = x + ',' + y;
        if (occupied.has(k)) continue;
        spots.push({ x, y });
      }
    }
    if (!spots.length) {
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++)
          if (PASSABLE[grid[y][x]] && !occupied.has(x + ',' + y)) spots.push({ x, y });
    }
    if (!spots.length) return null;
    return spots[Math.floor(rnd() * spots.length)];
  }

  const GENERIC_NAMES = {
    office: ['Кабинет', 'Бухгалтерия', 'Отдел кадров', 'Проходная'],
    storage: ['Склад', 'Кладовая', 'Тарный склад', 'Склад тары'],
    production: ['Цех', 'Конвейерный зал', 'Разделочный цех', 'Линия №2'],
    lab: ['Лаборатория', 'Палата', 'Процедурная', 'Аналитическая'],
    utility: ['Бойлерная', 'Насосная', 'Щитовая', 'Машинный зал'],
    gate: ['Ворота', 'Шлюз', 'Погрузочная', 'Док'],
    archive: ['Архивохранилище', 'Читальный зал', 'Картотека', 'Серверная'],
    flooded: ['Затопленный цех', 'Нижний ярус', 'Кессон', 'Дно']
  };

  RB.Gen = {
    /* Генерация уровня по главе.
       chapter.gen — параметры, chapter.goals, chapter.notes */
    generate(chapter, seedNum) {
      const rnd = RB.mulberry32(seedNum >>> 0);
      const cfg = chapter.gen;
      const w = cfg.w, h = cfg.h;
      const b = new Builder(w, h);
      const area = { x: 2, y: 2, w: w - 4, h: h - 4 };
      const placed = [];
      const rooms = [];

      const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
      const makeRoom = (spec, role) => {
        const rw = spec.w ? ri(spec.w[0], spec.w[1]) : ri(spec.w0 || 7, spec.w1 || 11);
        const rh = spec.h ? ri(spec.h[0], spec.h[1]) : ri(spec.h0 || 6, spec.h1 || 9);
        let rect = null;
        if (spec.fixed) rect = { x: spec.fixed[0], y: spec.fixed[1], w: rw, h: rh };
        else rect = tryPlace(rnd, b, placed, area, rw, rh);
        if (!rect) {
          for (let k = 0; k < 40 && !rect; k++) {
            const ww = Math.max(6, rw - 2), hh = Math.max(5, rh - 2);
            rect = tryPlace(rnd, b, placed, area, ww, hh);
            if (rect) { rect.w = ww; rect.h = hh; }
          }
        }
        if (!rect) return null;
        rect.role = role;
        rect.name = spec.name || null;
        rect.theme = spec.theme || 'production';
        placed.push(rect);
        rooms.push(rect);
        b.room(rect);
        return rect;
      };

      // 1. Стартовая комната — у края карты
      const start = makeRoom(Object.assign({}, cfg.start), 'start');
      if (!start) return null;
      const scSafe = roomCenter(start);

      // 2. Заготовка под финальную комнату (роль назначим после
      //    размещения — самой дальней от старта)
      makeRoom(Object.assign({}, cfg.exit, { name: null }), 'generic');

      // 3. Сюжетные и обычные комнаты
      const generic = cfg.generic || {};
      const total = generic.count || 4;
      const themes = generic.themes || ['storage', 'production', 'office'];
      for (let i = 0; i < total; i++) {
        const theme = themes[Math.floor(rnd() * themes.length)];
        const names = GENERIC_NAMES[theme] || GENERIC_NAMES.production;
        makeRoom({
          w: generic.w || [7, 12],
          h: generic.h || [6, 10],
          theme,
          name: names[Math.floor(rnd() * names.length)]
        }, 'generic');
      }

      // 4. Самая дальняя от старта комната становится финальной
      const scc = roomCenter(start);
      let exitRoom = null;
      for (const r of rooms) {
        if (r === start) continue;
        const c = roomCenter(r);
        const d = Math.abs(c.x - scc.x) + Math.abs(c.y - scc.y);
        if (!exitRoom || d > exitRoom._d) { exitRoom = r; exitRoom._d = d; }
      }
      if (!exitRoom) return null;
      exitRoom.role = 'exit';
      exitRoom.name = cfg.exit.name;
      exitRoom.theme = cfg.exit.theme;

      // 5. Связность: MST по центрам + пара петель
      const centers = rooms.map(roomCenter);
      const inMst = [0];
      const edges = [];
      while (inMst.length < rooms.length) {
        let best = null;
        for (const i of inMst) {
          for (let j = 0; j < rooms.length; j++) {
            if (inMst.includes(j)) continue;
            const d = Math.abs(centers[i].x - centers[j].x) + Math.abs(centers[i].y - centers[j].y);
            if (!best || d < best.d) best = { i, j, d };
          }
        }
        if (!best) break;
        inMst.push(best.j);
        edges.push(best);
      }
      for (const e of edges) {
        const a = centers[e.i], c = centers[e.j];
        b.corridor(a.x, a.y, c.x, c.y, 2, rnd);
      }
      // дополнительные петли — чтобы уровень не был деревом
      const extra = Math.max(1, Math.floor(rooms.length / 3));
      for (let k = 0; k < extra; k++) {
        const i = Math.floor(rnd() * rooms.length);
        const j = Math.floor(rnd() * rooms.length);
        if (i === j) continue;
        const a = centers[i], c = centers[j];
        if (Math.abs(a.x - c.x) + Math.abs(a.y - c.y) > 34) continue;
        b.corridor(a.x, a.y, c.x, c.y, 2, rnd);
      }

      // 5. Декор, который влияет на проходимость
      const occupied = new Set();

      // колонны в больших помещениях
      for (const r of rooms) {
        if (r.w >= 9 && r.h >= 7 && rnd() < 0.65) {
          const px = r.x + 2 + Math.floor(rnd() * (r.w - 4));
          const py = r.y + 2 + Math.floor(rnd() * (r.h - 4));
          const cells = [[px, py]];
          if (r.w >= 11) cells.push([px + 1, py]);
          for (const [cx, cy] of cells) if (b.walkable(cx, cy) && Math.abs(cx - scSafe.x) > 2) b.set(cx, cy, 'P');
        }
      }

      // вода (затопленные главы)
      if (cfg.water > 0) {
        for (const r of rooms) {
          if (rnd() > cfg.water) continue;
          for (let y = r.y; y < r.y + r.h; y++) {
            for (let x = r.x; x < r.x + r.w; x++) {
              if (b.get(x, y) !== '.') continue;
              if (x < r.x + 1 || y < r.y + 1 || x > r.x + r.w - 2 || y > r.y + r.h - 2) continue;
              if (RB.hash2(x, y, seedNum & 1023) < 0.55) b.set(x, y, '~');
            }
          }
        }
      }

      // лужи/трещины — чисто визуально
      for (const r of rooms) {
        for (let y = r.y; y < r.y + r.h; y++) {
          for (let x = r.x; x < r.x + r.w; x++) {
            if (b.get(x, y) !== '.') continue;
            if (RB.hash2(x, y, seedNum & 511) < 0.10) b.set(x, y, ',');
          }
        }
      }

      // бочки вдоль стен
      let barrelCount = cfg.barrels | 0;
      for (const r of rooms) {
        const perRoom = Math.max(0, Math.round(rnd() * (barrelCount / rooms.length + 1)));
        for (let i = 0; i < perRoom; i++) {
          const edge = Math.floor(rnd() * 4);
          let x, y;
          if (edge === 0) { x = r.x + Math.floor(rnd() * r.w); y = r.y; }
          else if (edge === 1) { x = r.x + Math.floor(rnd() * r.w); y = r.y + r.h - 1; }
          else if (edge === 2) { x = r.x; y = r.y + Math.floor(rnd() * r.h); }
          else { x = r.x + r.w - 1; y = r.y + Math.floor(rnd() * r.h); }
          if (b.get(x, y) === '.' || b.get(x, y) === ',') {
            if (Math.abs(x - scSafe.x) <= 2 && Math.abs(y - scSafe.y) <= 2) continue;
            b.set(x, y, 'B');
          }
        }
      }

      // ящики
      let crateCount = cfg.crates | 0;
      while (crateCount-- > 0) {
        const r = rooms[Math.floor(rnd() * rooms.length)];
        const x = r.x + Math.floor(rnd() * r.w);
        const y = r.y + Math.floor(rnd() * r.h);
        if (Math.abs(x - scSafe.x) <= 2 && Math.abs(y - scSafe.y) <= 2) continue;
        if ((b.get(x, y) === '.' || b.get(x, y) === ',') && rnd() < 0.85) b.set(x, y, 'C');
      }

      // 6. Проверка достижимости и починка
      const grid = () => b.g;
      b.set(scSafe.x, scSafe.y, '.');
      const sc = roomCenter(start);
      let reach = bfsReach(b.g, w, h, sc.x, sc.y);
      for (const r of rooms) {
        const c = roomCenter(r);
        if (!reach.seen[c.x + c.y * w]) {
          // соединяем с ближайшей достижимой комнатой
          let best = null;
          for (const other of rooms) {
            if (other === r) continue;
            const oc = roomCenter(other);
            if (!reach.seen[oc.x + oc.y * w]) continue;
            const d = Math.abs(oc.x - c.x) + Math.abs(oc.y - c.y);
            if (!best || d < best.d) best = { d, oc };
          }
          if (best) {
            b.corridor(c.x, c.y, best.oc.x, best.oc.y, 2, rnd);
            reach = bfsReach(b.g, w, h, sc.x, sc.y);
          }
        }
      }
      reach = bfsReach(b.g, w, h, sc.x, sc.y);

      const objects = [];
      const enemies = [];

      // бочки-засады (T39)
      const ambushTypes = ['sledok', 'obryvok', 'svidetel'];
      for (let yy = 0; yy < h; yy++) {
        for (let xx = 0; xx < w; xx++) {
          if (b.g[yy][xx] !== 'B') continue;
          if (rnd() > (cfg.ambush != null ? cfg.ambush : 0.22)) continue;
          objects.push({
            kind: 'ambush',
            tx: xx, ty: yy,
            x: xx * 48 + 24, y: yy * 48 + 24,
            type: ambushTypes[Math.floor(rnd() * ambushTypes.length)],
            triggered: false
          });
        }
      }
      const used = new Set();
      const key = (x, y) => x + ',' + y;

      const placeObject = (r, obj) => {
        const spot = randomFloorInRoom(rnd, b.g, r, used);
        if (!spot) return null;
        if (!reach.seen[spot.x + spot.y * w]) return null;
        used.add(key(spot.x, spot.y));
        const o = Object.assign({}, obj, {
          tx: spot.x, ty: spot.y,
          x: spot.x * 48 + 24,
          y: spot.y * 48 + 24
        });
        objects.push(o);
        return o;
      };

      // 7. Квестовые предметы — в разные комнаты, кроме стартовой
      const questRooms = RB.shuffle(
        rooms.filter((r) => r.role !== 'start'),
        rnd
      );
      let qi = 0;
      const goals = chapter.goals || [];
      for (const g of goals) {
        if (g.type !== 'collect') continue;
        for (let i = 0; i < g.count; i++) {
          const rm = questRooms[qi % questRooms.length] || rooms[1];
          qi++;
          placeObject(rm, { kind: 'quest', item: g.item, label: g.itemLabel || g.text });
        }
      }

      // 7.5. Оружие
      for (const wid of (cfg.weapons || [])) {
        const rm = questRooms[(qi++) % questRooms.length] || rooms[1];
        placeObject(rm, { kind: 'weapon', weapon: wid, label: RB.Weapons[wid] ? RB.Weapons[wid].name : wid });
      }

      // 8. Записки
      const notes = chapter.notes || [];
      for (const n of notes) {
        const rm = questRooms[(qi++) % questRooms.length] || rooms[1];
        placeObject(rm, { kind: 'note', noteId: n.id, label: 'Записка' });
      }

      // 9. Расходники
      const itemsCfg = cfg.items || {};
      const addItems = (type, count) => {
        for (let i = 0; i < count; i++) {
          const rm = rooms[Math.floor(rnd() * rooms.length)];
          placeObject(rm, { kind: 'item', item: type, label: type });
        }
      };
      addItems('medkit', itemsCfg.medkit || 0);
      addItems('ammo', itemsCfg.ammo || 0);
      addItems('battery', itemsCfg.battery || 0);
      addItems('painkiller', itemsCfg.painkiller || 0);
      addItems('adrenaline', itemsCfg.adrenaline || 0);
      addItems('salt', itemsCfg.salt || 0);
      addItems('flare', itemsCfg.flare || 0);

      // 10. Лампы (свет, мерцание)
      let lampCount = cfg.lamps || 0;
      while (lampCount-- > 0) {
        const rm = rooms[Math.floor(rnd() * rooms.length)];
        const spot = randomFloorInRoom(rnd, b.g, rm, used);
        if (!spot) continue;
        used.add(key(spot.x, spot.y));
        objects.push({
          kind: 'lamp',
          tx: spot.x, ty: spot.y,
          x: spot.x * 48 + 24, y: spot.y * 48 + 24,
          radius: cfg.lampRadius || 185,
          seed: rnd() * 1000,
          flicker: rnd() < 0.45
        });
      }

      // 11. Трупы / сюжетный декор
      const corpses = cfg.corpses || 0;
      for (let i = 0; i < corpses; i++) {
        const rm = rooms[Math.floor(rnd() * rooms.length)];
        const spot = randomFloorInRoom(rnd, b.g, rm, used);
        if (!spot) continue;
        used.add(key(spot.x, spot.y));
        objects.push({
          kind: 'corpse',
          tx: spot.x, ty: spot.y,
          x: spot.x * 48 + 24, y: spot.y * 48 + 24,
          seed: rnd() * 100
        });
      }

      // 11.5. NPC — необязательные персонажи
      const npcIds = cfg.npcs || [];
      if (npcIds.length) {
        const npcRooms = RB.shuffle(rooms.filter((r) => r.role !== 'start'), rnd);
        let ni = 0;
        for (const npcId of npcIds) {
          let spot = null;
          let rm = null;
          for (let attempt = 0; attempt < npcRooms.length; attempt++) {
            rm = npcRooms[(ni + attempt) % npcRooms.length];
            spot = randomFloorInRoom(rnd, b.g, rm, used);
            if (spot) { ni += attempt + 1; break; }
          }
          if (!spot) continue;
          used.add(key(spot.x, spot.y));
          objects.push({
            kind: 'npc', npcId, label: 'NPC',
            tx: spot.x, ty: spot.y,
            x: spot.x * 48 + 24, y: spot.y * 48 + 24
          });
        }
      }

      // 11.7. Магазин
      if (cfg.shop !== false) {
        const rm = rooms[Math.floor(rnd() * rooms.length)];
        const spot = randomFloorInRoom(rnd, b.g, rm, used);
        if (spot) {
          used.add(key(spot.x, spot.y));
          const pool = (RB.ShopPool || []).filter((it) => {
            if (it.kind === 'weapon') return cfg.weaponTier !== 0;
            return true;
          });
          const stock = [];
          const n = 4 + Math.floor(rnd() * 3);
          for (let k = 0; k < n && pool.length; k++) {
            const idx = Math.floor(rnd() * pool.length);
            stock.push(Object.assign({}, pool[idx]));
            pool.splice(idx, 1);
          }
          objects.push({
            kind: 'shop', stock,
            tx: spot.x, ty: spot.y,
            x: spot.x * 48 + 24, y: spot.y * 48 + 24
          });
        }
      }

      // 12. Выход/финал
      const ec = roomCenter(exitRoom);
      let exitSpot = null;
      if (!used.has(key(ec.x, ec.y)) && reach.seen[ec.x + ec.y * w]) {
        exitSpot = { x: ec.x, y: ec.y };
      } else {
        exitSpot = randomFloorInRoom(rnd, b.g, exitRoom, used);
      }
      if (!exitSpot) exitSpot = { x: ec.x, y: ec.y };
      used.add(key(exitSpot.x, exitSpot.y));
      const exitObj = {
        kind: 'exit',
        tx: exitSpot.x, ty: exitSpot.y,
        x: exitSpot.x * 48 + 24, y: exitSpot.y * 48 + 24,
        locked: true,
        label: cfg.exit.label || 'Выход'
      };
      objects.push(exitObj);

      // босс и ловушка
      if (cfg.boss) {
        const bspot = randomFloorInRoom(rnd, b.g, exitRoom, used) || ec;
        used.add(key(bspot.x, bspot.y));
        const bx = bspot.x * 48 + 24, by = bspot.y * 48 + 24;
        enemies.push({ type: 'boss', tx: bspot.x, ty: bspot.y, x: bx, y: by });
        objects.push({ kind: 'boss', tx: bspot.x, ty: bspot.y, x: bx, y: by });
        const tspot = randomFloorInRoom(rnd, b.g, exitRoom, used) || ec;
        used.add(key(tspot.x, tspot.y));
        objects.push({
          kind: 'trap', tx: tspot.x, ty: tspot.y,
          x: tspot.x * 48 + 24, y: tspot.y * 48 + 24,
          label: 'ЛЕБЁДКА'
        });
      }

      let finale = null;
      if (cfg.finale) {
        finale = placeObject(exitRoom, Object.assign({ kind: 'finale' }, cfg.finale));
      }

      // 13. Враги — вдали от старта
      const startPx = { x: sc.x * 48 + 24, y: sc.y * 48 + 24 };
      const weights = cfg.enemyWeights || { sledok: 1 };
      const typePool = [];
      for (const t in weights) for (let i = 0; i < weights[t]; i++) typePool.push(t);

      let budget = cfg.enemyBudget || 3;
      let guard = 0;
      while (budget > 0 && guard++ < 300) {
        const rm = rooms[Math.floor(rnd() * rooms.length)];
        if (rm.role === 'start') continue;
        const spot = randomFloorInRoom(rnd, b.g, rm, used);
        if (!spot) continue;
        const px = spot.x * 48 + 24, py = spot.y * 48 + 24;
        if (RB.dist(px, py, startPx.x, startPx.y) < 48 * 8) continue;
        used.add(key(spot.x, spot.y));
        enemies.push({
          type: typePool[Math.floor(rnd() * typePool.length)],
          tx: spot.x, ty: spot.y, x: px, y: py
        });
        budget--;
      }

      // 14. Метки комнат для HUD
      const roomLabels = rooms.map((r) => ({
        x: r.x * 48, y: r.y * 48, w: r.w * 48, h: r.h * 48,
        name: r.name, theme: r.theme, role: r.role
      }));

      return {
        w, h, grid: b.g,
        start: { x: startPx.x, y: startPx.y },
        rooms: roomLabels,
        objects,
        enemies,
        exit: exitObj,
        finale,
        seed: seedNum >>> 0
      };
    }
  };
})();
