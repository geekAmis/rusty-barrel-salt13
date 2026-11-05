/* RUSTY BARREL — загрузчик готовых ассетов (v2) */
(function () {
  const RB = (window.RB = window.RB || {});
  RB.Assets = {
    cache: new Map(),
    img(src) {
      if (!src) return null;
      if (!this.cache.has(src)) {
        const im = new Image();
        im.src = src;
        this.cache.set(src, im);
      }
      return this.cache.get(src);
    },
    ready(im) { return !!(im && im.complete && im.naturalWidth > 0); },
    icon(id, count) {
      const d = RB.Items && RB.Items.get(id);
      if (!d) return 'assets/icons/res1.png';
      if (d.kind === 'ammo' && count != null && count < 15) {
        if (d.family === '9x18') return 'assets/icons/ammo1.png';
        if (d.family === '545') return 'assets/icons/ammo9.png';
        if (d.family === '12') return 'assets/icons/ammo44.png';
        if (d.family === 'harpoon') return 'assets/icons/ammo11.png';
        return 'assets/icons/ammo7.png';
      }
      if (d.iconSvg) return d.iconSvg;
      if (d.iconFile) return 'assets/icons/' + d.iconFile;
      let n = 1;
      for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) % 997;
      if (d.kind === 'ammo' || d.kind === 'mag') return 'assets/icons/ammo' + (1 + n % 12) + '.png';
      if (d.kind === 'med') return 'assets/icons/med' + (1 + n % 12) + '.png';
      if (d.kind === 'weapon') return 'assets/icons/melee' + (1 + n % 10) + '.png';
      if (d.kind === 'clothing') {
        if (d.slot === 'armor' || d.slot === 'rps') return 'assets/icons/equip' + (1 + n % 12) + '.png';
        if (d.slot === 'hat' || d.slot === 'helmet') return 'assets/icons/cloth' + (13 + n % 4) + '.png';
        return 'assets/icons/cloth' + (1 + n % 12) + '.png';
      }
      if (d.kind === 'tool' || d.kind === 'key') return 'assets/icons/equip' + (1 + n % 12) + '.png';
      return 'assets/icons/res' + (1 + n % 12) + '.png';
    },
    playerPortrait(ratio, state) {
      const r = (ratio == null) ? 1 : ratio;
      const st = state || {};
      if (st.salt) return 'assets/portraits/player_salt.png';
      if (st.withdraw && r > 0.5) return 'assets/portraits/player_withdraw.png';
      if (r > 0.8) return 'assets/portraits/player_ok.png';
      if (r >= 0.6) return 'assets/portraits/player_80.png';
      if (r >= 0.4) return 'assets/portraits/player_60.png';
      if (r >= 0.3) return 'assets/portraits/player_40.png';
      if (r >= 0.2) return 'assets/portraits/player_30.png';
      if (r >= 0.05) return 'assets/portraits/player_20.png';
      return 'assets/portraits/player_5.png';
    },
    portrait(kind) {
      const map = {
        player: 'assets/portraits/player.png', zoya: 'assets/portraits/zoya.png',
        grisha: 'assets/portraits/grisha.png', vera: 'assets/portraits/vera.png',
        timka: 'assets/portraits/timka.png', kim: 'assets/portraits/kim.png',
        slava: 'assets/portraits/slava.png', ignat: 'assets/portraits/ignat.png',
        asya: 'assets/portraits/asya.png', boss: 'assets/portraits/boss.png'
      };
      return map[kind] || map.player;
    },
    zombie(type) {
      if (type === 'obryvok') return 1;
      if (type === 'sledok') return 2;
      if (type === 'svidetel') return 4;
      if (type === 'noschik') return 1;
      return 3;
    },
    sheet(src, frame, frames) {
      const im = this.img(src);
      if (!this.ready(im)) return null;
      const fw = im.naturalWidth / frames;
      return { im, sx: Math.floor(frame % frames) * fw, sy: 0, sw: fw, sh: im.naturalHeight };
    }
  };
})();
