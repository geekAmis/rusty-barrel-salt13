/* ============================================================
   RUSTY BARREL — утилиты, математика, ГПСЧ (seeded random)
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});

  RB.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  RB.lerp = (a, b, t) => a + (b - a) * t;
  RB.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  RB.dist2 = (ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
  };
  RB.angDiff = (a, b) => {
    let d = (b - a + Math.PI) % (Math.PI * 2);
    if (d < 0) d += Math.PI * 2;
    return d - Math.PI;
  };
  RB.angleLerp = (a, b, t) => a + RB.angDiff(a, b) * t;

  RB.rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  RB.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  RB.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  RB.chance = (p) => Math.random() < p;

  /* Детерминированный ГПСЧ (mulberry32) — чтобы уровень
     с одним и тем же сидом всегда был одинаковым. */
  RB.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  RB.hashSeed = function (str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  /* Детерминированный "шум" для текстур пола/стен */
  RB.hash2 = function (x, y, s) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  RB.shuffle = function (arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  RB.store = {
    get(key, def) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? def : JSON.parse(raw);
      } catch (e) {
        return def;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch (e) { /* приватный режим */ }
    },
    del(key) {
      try { localStorage.removeItem(key); } catch (e) {}
    }
  };

  RB.editLayout = false;

  // Эталонная раскладка (снята с рабочего телефона).
  RB.DefaultLayout = {
    'btn-pause':    { left: '46.67%', top: '2%' },
    'btn-record':   { left: '56%',    top: '3%' },
    'btn-weapon':   { left: '64%',    top: '3%' },
    'btn-melee':    { left: '72%',    top: '3%' },
    'btn-reload':   { left: '88%',    top: '18%' },
    'btn-light':    { left: '88%',    top: '32%' },
    'btn-fire':     { left: '78%',    top: '56%' },
    'btn-jump':     { left: '78%',    top: '78%' }
  };

  RB.now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  RB.smooth = (t) => t * t * (3 - 2 * t);
  RB.pad2 = (n) => (n < 10 ? '0' + n : '' + n);

  /* Простое AABB-пересечение */
  RB.rectsOverlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
})();
