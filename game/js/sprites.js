/* ============================================================
   RUSTY BARREL — sprite/palette pipeline
   Центральная палитра, кэш кадров, помощники отрисовки.
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});

  const PALETTE = {
    ink: '#070605',
    paper: '#e3d8bd',
    paperDim: '#b7aa8d',
    rust: '#c56a35',
    rustDark: '#4a2c1b',
    blood: '#a3271b',
    bone: '#d8cdb0',
    steel: '#7f8e8f',
    coat: '#3f4a58',
    coatDark: '#2c333d',
    skin: '#b08a6c',
    hair: '#221c17',
    salt: '#e2dcc8',
    water: '#122226'
  };

  const ENEMY = {
    sledok: { body: '#4c4a43', edge: '#22221f', face: '#e4ddc8', eye: '#151210', blood: '#5a120c' },
    cultist: { body: '#d8d0bc', edge: '#5a5246', face: '#c9b18a', eye: '#2a1a12', blood: '#5a120c' },
    svidetel: { body: '#b8c4b8', edge: '#4a5a52', face: '#e8e8dc', eye: '#101010', blood: '#5a120c' },
    boss: { body: '#2a2620', edge: '#100e0b', face: '#b8a88c', eye: '#120e0a', blood: '#5a120c' },
    obryvok: { body: '#bdb298', edge: '#5a5240', face: '#d8cdb0', eye: '#2a241c', blood: '#5a120c' },
    noschik: { body: '#6a4a2c', edge: '#2a1a10', face: '#c9b18a', eye: '#ffdf8a', blood: '#5a120c' },
    propovednik: { body: '#d8d0bc', edge: '#5a5246', face: '#c9b18a', eye: '#a3271b', blood: '#5a120c' },
    mat: { body: '#4a3a30', edge: '#1a120e', face: '#b8a88c', eye: '#d8452a', blood: '#5a120c' },
    chorus: { body: '#b8c4b8', edge: '#4a5a52', face: '#e8e8dc', eye: '#7fae86', blood: '#5a120c' },
    dvoynik: { body: '#3f4a58', edge: '#222830', face: '#b08a6c', eye: '#d8452a', blood: '#5a120c' },
    default: { body: '#4c4a43', edge: '#22221f', face: '#e4ddc8', eye: '#151210', blood: '#5a120c' }
  };

  const PLAYER = {
    coat: PALETTE.coat,
    coatDark: PALETTE.coatDark,
    legs: '#171a1f',
    boots: '#0d0e10',
    skin: PALETTE.skin,
    hair: PALETTE.hair,
    badge: '#a3271b',
    strap: '#1a1d22'
  };

  RB.Palette = PALETTE;

  RB.Sprites = {
    palette: PALETTE,
    player: PLAYER,
    enemy(type, hurt) {
      const base = ENEMY[type] || ENEMY.default;
      if (!hurt) return base;
      return Object.assign({}, base, {
        body: '#e0d6c4',
        face: '#fff4e4',
        edge: '#7a6a56'
      });
    },
    cache: new Map(),
    frame(key, w, h, draw) {
      if (this.cache.has(key)) return this.cache.get(key);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      draw(g, w, h);
      this.cache.set(key, c);
      return c;
    },
    clearCache() { this.cache.clear(); }
  };
})();
