/* ============================================================
   RUSTY BARREL — изометрические комнаты за дверями
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});
  const T = 48;

  RB.Iso = {
    project(x, y, W, H) {
      const ox = W / 2, oy = H * 0.14;
      return { x: ox + (x - y) / 4, y: oy + (x + y) / 8 };
    },
    unproject(sx, sy, W, H) {
      const ox = W / 2, oy = H * 0.14;
      const a = (sx - ox) * 4;
      const b = (sy - oy) * 8;
      return { x: (a + b) / 2, y: (b - a) / 2 };
    },
    screenVecToWorld(dx, dy) {
      return { x: 2 * dx + 4 * dy, y: 4 * dy - 2 * dx };
    },
    worldVecToScreen(dx, dy) {
      return { x: (dx - dy) / 4, y: (dx + dy) / 8 };
    },
    screenAngleToWorld(a) {
      const v = this.screenVecToWorld(Math.cos(a), Math.sin(a));
      return Math.atan2(v.y, v.x);
    },
    worldAngleToScreen(a) {
      const v = this.worldVecToScreen(Math.cos(a), Math.sin(a));
      return Math.atan2(v.y, v.x);
    }
  };

  RB.IsoGen = {
    generate(chapter, seedNum) {
      const rnd = RB.mulberry32((seedNum >>> 0) ^ 0x9e3779b9);
      const w = 18, h = 14;
      const grid = [];
      for (let y = 0; y < h; y++) grid.push(new Array(w).fill('.'));
      for (let x = 0; x < w; x++) { grid[0][x] = '#'; grid[h - 1][x] = '#'; }
      for (let y = 0; y < h; y++) { grid[y][0] = '#'; grid[y][w - 1] = '#'; }
      // колонны и хлам
      for (let i = 0; i < 7; i++) {
        const x = 2 + Math.floor(rnd() * (w - 4));
        const y = 2 + Math.floor(rnd() * (h - 4));
        if (grid[y][x] === '.') grid[y][x] = rnd() < 0.5 ? 'C' : 'P';
      }
      const objects = [];
      const enemies = [];
      const start = { x: 9 * T, y: 11 * T };
      objects.push({ kind: 'isoExit', tx: 9, ty: 2, x: 9 * T + T / 2, y: 2 * T + T / 2, label: 'ВЫХОД' });
      // записка/лут
      if (rnd() < 0.8) {
        const n = (chapter.notes || [])[0];
        if (n) objects.push({ kind: 'note', noteId: n.id, tx: 3, ty: 4, x: 3 * T + T / 2, y: 4 * T + T / 2, label: 'Документ' });
      }
      objects.push({ kind: 'item', item: 'battery', tx: 14, ty: 5, x: 14 * T + T / 2, y: 5 * T + T / 2, label: 'battery' });
      objects.push({ kind: 'item', item: rnd() < 0.5 ? 'mag_pm' : 'mag_ak', tx: 15, ty: 8, x: 15 * T + T / 2, y: 8 * T + T / 2, label: 'МАГАЗИН' });
      objects.push({
        kind: 'stash', tx: 5, ty: 10,
        x: 5 * T + T / 2, y: 10 * T + T / 2,
        taken: false, tier: 2, label: 'ТАЙНИК'
      });
      if (rnd() < 0.75) {
        objects.push({
          kind: 'craft', tx: 13, ty: 10,
          x: 13 * T + T / 2, y: 10 * T + T / 2,
          label: 'СТОЛ КРАФТА'
        });
      }
      const types = ['sledok', 'obryvok', 'cultist'];
      for (let i = 0; i < 2; i++) {
        const tx = 3 + Math.floor(rnd() * (w - 6));
        const ty = 3 + Math.floor(rnd() * (h - 6));
        enemies.push({ type: types[Math.floor(rnd() * types.length)], tx, ty, x: tx * T + T / 2, y: ty * T + T / 2 });
      }
      return {
        w, h, grid, start, objects, enemies,
        rooms: [{ x: 0, y: 0, w: w * T, h: h * T, name: 'КОМНАТА', theme: 'lab' }],
        exit: objects[0], finale: null, seed: seedNum >>> 0,
        sideView: false, mode: 'iso'
      };
    }
  };
})();
