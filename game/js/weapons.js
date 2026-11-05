/* ============================================================
   RUSTY BARREL — оружие (T36)
   ПМ · огнемёт · дробовик · АК-74Н · гарпун
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});

  RB.Weapons = {
    pistol: {
      id: 'pistol', name: 'ПМ', short: 'ПМ',
      mag: 8, startReserve: 16, reload: 1.4, fire: 0.38,
      dmg: 0.8, pellets: 1, spread: 0.045, range: 650,
      ammoName: '9×18', color: '#c9a05a', limbChance: 0.08,
      sound: 'shot', auto: false, price: 8, ammoPrice: 1, noise: 8
    },
    shotgun: {
      id: 'shotgun', name: 'ДРОБОВИК', short: 'ДРОБЬ',
      mag: 2, startReserve: 8, reload: 2.2, fire: 0.85,
      dmg: 0.85, pellets: 6, spread: 0.26, range: 340,
      ammoName: '12К', color: '#b4552a', limbChance: 0.45,
      sound: 'shotgun', auto: false, price: 22, ammoPrice: 3, noise: 14
    },
    ak74: {
      id: 'ak74', name: 'АК-74Н', short: 'АК',
      mag: 30, startReserve: 60, reload: 2.4, fire: 0.11,
      dmg: 0.55, pellets: 1, spread: 0.065, range: 820,
      ammoName: '5.45×39', color: '#8fa7c9', limbChance: 0.2,
      sound: 'ak', auto: true, price: 34, ammoPrice: 4, noise: 12,
      laser: true
    },
    flamethrower: {
      id: 'flamethrower', name: 'ОГНЕМЁТ', short: 'ОГОНЬ',
      mag: 50, startReserve: 100, reload: 3.0, fire: 0.1,
      dmg: 0.55, pellets: 1, spread: 0.22, range: 230,
      ammoName: 'СМЕСЬ', color: '#d8452a', limbChance: 0.25,
      sound: 'flame', auto: true, price: 55, ammoPrice: 6, noise: 10,
      burn: true
    },
    harpoon: {
      id: 'harpoon', name: 'ГАРПУН', short: 'ГАРПУН',
      mag: 1, startReserve: 2, reload: 2.0, fire: 1.1,
      dmg: 2.2, pellets: 1, spread: 0.012, range: 700, pin: 5,
      ammoName: 'ГАРП.', color: '#7fae86', limbChance: 0.25,
      sound: 'harpoon', auto: false, price: 28, ammoPrice: 5, noise: 9,
      pin: 180
    }
  };

  RB.WeaponOrder = ['pistol', 'shotgun', 'ak74', 'flamethrower', 'harpoon'];
})();
