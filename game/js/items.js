/* RUSTY BARREL — предметы и сеточный инвентарь (v2) */
(function () {
  const RB = (window.RB = window.RB || {});

  const DEFS = {
    medkit: { name: 'Аптечка ВИК', w: 2, h: 1, stack: 1, kind: 'med', use: { hp: 45, healInjuries: true, attention: 4 } },
    food: { name: 'Консервы «Бочка»', w: 2, h: 1, stack: 3, kind: 'food', use: { hp: 15, stamina: 20, hunger: 35 } },
    battery: { name: 'Батарейка', w: 1, h: 1, stack: 4, kind: 'tool', use: { battery: 40 } },
    painkiller: { name: 'Обезболивающее', w: 1, h: 1, stack: 4, kind: 'med', use: { painkiller: 20, attention: -5 } },
    adrenaline: { name: 'Адреналин', w: 1, h: 1, stack: 4, kind: 'med', use: { adrenaline: 10, stamina: 100 } },
    salt: { name: 'Доза «Соль-13»', w: 1, h: 1, stack: 3, kind: 'med', use: { saltVision: 30, attention: 40 } },
    calm: { name: 'Успокоительное', w: 1, h: 1, stack: 4, kind: 'med', use: { calm: 300, attention: -100 } },
    lockpick: { name: 'Отмычка', w: 1, h: 1, stack: 1, kind: 'tool', uses: 8 },

    ammo_9x18: { name: 'Патроны 9×18', w: 1, h: 1, stack: 120, kind: 'ammo', ammo: '9x18', family: '9x18', damageMul: 1 },
    ammo_9x18_ap: { name: '9×18 бронебойные', w: 1, h: 1, stack: 90, kind: 'ammo', ammo: '9x18', family: '9x18', damageMul: 1.25, pen: 2 },
    ammo_9x18_tr: { name: '9×18 трассирующие', w: 1, h: 1, stack: 90, kind: 'ammo', ammo: '9x18', family: '9x18', damageMul: 0.9, tracer: true },
    ammo_12: { name: 'Патроны 12К дробь', w: 1, h: 1, stack: 60, kind: 'ammo', ammo: '12', family: '12', damageMul: 1, pellets: 6 },
    ammo_12_slug: { name: '12К пуля', w: 1, h: 1, stack: 40, kind: 'ammo', ammo: '12', family: '12', damageMul: 2.4, pellets: 1, pen: 2 },
    ammo_12_inc: { name: '12К зажигательные', w: 1, h: 1, stack: 40, kind: 'ammo', ammo: '12', family: '12', damageMul: 1.1, pellets: 5, burn: true },
    ammo_545: { name: 'Патроны 5.45', w: 1, h: 1, stack: 120, kind: 'ammo', ammo: '545', family: '545', damageMul: 1 },
    ammo_545_ap: { name: '5.45 бронебойные', w: 1, h: 1, stack: 90, kind: 'ammo', ammo: '545', family: '545', damageMul: 1.3, pen: 3 },
    ammo_545_tr: { name: '5.45 трассирующие', w: 1, h: 1, stack: 90, kind: 'ammo', ammo: '545', family: '545', damageMul: 0.9, tracer: true },
    ammo_flame: { name: 'Топливо для огнемёта', w: 2, h: 1, stack: 80, kind: 'ammo', ammo: 'flame', family: 'flame', damageMul: 1 },
    ammo_harpoon: { name: 'Гарпуны', w: 1, h: 1, stack: 12, kind: 'ammo', ammo: 'harpoon', family: 'harpoon', damageMul: 1 },

    mag_pm: { name: 'Магазин ПМ (8)', w: 1, h: 1, stack: 1, kind: 'mag', cap: 8, ammo: '9x18', forWeapon: 'pistol' },
    mag_shotgun: { name: 'Магазин 12К (6)', w: 1, h: 2, stack: 1, kind: 'mag', cap: 6, ammo: '12', forWeapon: 'shotgun' },
    mag_ak: { name: 'Магазин АК (30)', w: 1, h: 1, stack: 1, kind: 'mag', cap: 30, ammo: '545', forWeapon: 'ak74' },
    mag_flame: { name: 'Баллон огнемёта', w: 2, h: 1, stack: 1, kind: 'mag', cap: 40, ammo: 'flame', forWeapon: 'flamethrower' },
    mag_harpoon: { name: 'Кассета гарпуна', w: 1, h: 1, stack: 1, kind: 'mag', cap: 2, ammo: 'harpoon', forWeapon: 'harpoon' },

    w_pistol: { name: 'ПМ', w: 1, h: 1, stack: 1, kind: 'weapon', weapon: 'pistol' },
    w_shotgun: { name: 'Дробовик', w: 2, h: 1, stack: 1, kind: 'weapon', weapon: 'shotgun', noMag: true, cap: 6 },
    w_ak74: { name: 'АК-74Н', w: 2, h: 1, stack: 1, kind: 'weapon', weapon: 'ak74' },
    w_flamethrower: { name: 'Огнемёт', w: 3, h: 1, stack: 1, kind: 'weapon', weapon: 'flamethrower' },
    w_harpoon: { name: 'Гарпун', w: 4, h: 1, stack: 1, kind: 'weapon', weapon: 'harpoon', noMag: true, cap: 1 },

    coat_worker: { name: 'Рабочий ватник', w: 2, h: 2, stack: 1, kind: 'clothing', slot: 'coat', outfit: { coat: '#3f4a58', coatDark: '#2c333d' }, armor: 0 },
    coat_fisher: { name: 'Просоленный ватник', w: 2, h: 2, stack: 1, kind: 'clothing', slot: 'coat', outfit: { coat: '#5a5246', coatDark: '#3a352e' }, armor: 0.1 },
    pants_worker: { name: 'Рабочие штаны', w: 2, h: 1, stack: 1, kind: 'clothing', slot: 'pants', outfit: { pants: '#23272d', pantsDark: '#16191d' } },
    boots_worker: { name: 'Кирзовые сапоги', w: 2, h: 1, stack: 1, kind: 'clothing', slot: 'boots', outfit: { boots: '#141414', bootsDark: '#0a0a0a' } },
    gloves_worker: { name: 'Брезентовые рукавицы', w: 1, h: 1, stack: 1, kind: 'clothing', slot: 'gloves', outfit: { gloves: '#4a3a2a' } },
    helmet_worker: { name: 'Каска солевика', w: 2, h: 1, stack: 1, kind: 'clothing', slot: 'helmet', outfit: { helmet: '#6a6a5a' }, armor: 0.08 },
    mask_gas: { name: 'Противогаз', w: 2, h: 1, stack: 1, kind: 'clothing', slot: 'mask', outfit: { mask: '#2a2a24' }, armor: 0.04 },
    armor_plate: { name: 'Бронеплита', w: 2, h: 2, stack: 1, kind: 'clothing', slot: 'armor', outfit: { armor: '#5a5a50' }, armor: 0.2 },

    gasoline: { name: 'Бензин', w: 2, h: 1, stack: 5, kind: 'material' },
    phosphorus: { name: 'Красный фосфор', w: 1, h: 1, stack: 5, kind: 'material' },
    silver: { name: 'Серебрянка', w: 1, h: 1, stack: 5, kind: 'material' },
    napalm: { name: 'Напалм', w: 2, h: 1, stack: 20, kind: 'material' },
    recipe_napalm: { name: 'Рецепт: напалм', w: 1, h: 1, stack: 1, kind: 'recipe', recipe: 'napalm' },
    recipe_flame: { name: 'Рецепт: топливо огнемёта', w: 1, h: 1, stack: 1, kind: 'recipe', recipe: 'flame' },
    recipe_medkit: { name: 'Рецепт: аптечка', w: 1, h: 1, stack: 1, kind: 'recipe', recipe: 'medkit' },
    recipe_salt13: { name: 'Чертёж: соль-13', w: 1, h: 1, stack: 1, kind: 'recipe', recipe: 'salt13' },

    key_workshop: { name: 'Ключ от цеха', w: 1, h: 1, stack: 1, kind: 'key', key: 'workshop' },
    key_boss: { name: 'Ключ от комнаты босса', w: 1, h: 1, stack: 1, kind: 'key', key: 'boss' },
    photo: { name: 'Фотоулика', w: 1, h: 1, stack: 10, kind: 'clue' },
    note: { name: 'Документ', w: 1, h: 1, stack: 10, kind: 'document' },
    tokens: { name: 'Талон', w: 1, h: 1, stack: 999, kind: 'currency' }
  };

  // ---- ключ-карты терминалов: по одной на каждую смену ----
  const CARD_COLORS = ['#8a2a1e', '#b4552a', '#7fae86', '#8fa7c9', '#c9a05a'];
  const CARD_NAMES = ['ПРОХОДНАЯ', 'ЦЕХ', 'ЛАБОРАТОРИЯ', 'АРХИВ', 'КЕССОН'];
  for (let i = 1; i <= 5; i++) {
    DEFS['keycard_' + i] = {
      name: 'Ключ-карта · ' + CARD_NAMES[i - 1],
      w: 1, h: 1, stack: 1, kind: 'key', keycard: i, chapter: i
    };
    DEFS['keycard_' + i].iconSvg = null;
  }

  // ---- явные иконки: то, что раньше выбиралось случайно ----
  const svgIcon = (body) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + body + '</svg>'
  );

  const ICON_FILES = {
    medkit: 'med1.png', painkiller: 'med23.png', adrenaline: 'med6.png', calm: 'med19.png',
    ammo_9x18: 'ammo40.png', ammo_9x18_ap: 'ammo40.png', ammo_9x18_tr: 'ammo40.png',
    ammo_12: 'ammo36.png', ammo_12_slug: 'ammo38.png', ammo_12_inc: 'ammo41.png',
    ammo_545: 'ammo24.png', ammo_545_ap: 'ammo24.png', ammo_545_tr: 'ammo24.png',
    ammo_flame: 'ammo7.png', ammo_harpoon: 'ammo11.png',
    mag_pm: 'ammo40.png', mag_shotgun: 'ammo36.png', mag_ak: 'ammo24.png',
    mag_flame: 'ammo7.png', mag_harpoon: 'ammo11.png',
    armor_plate: 'equip1.png'
  };

  const saltIcon = svgIcon(
    '<path d="M18 11h28l7 12v30H11V23z" fill="#d8cdb0" stroke="#241b15" stroke-width="3"/>' +
    '<path d="M18 11l-7 12h42l-7-12z" fill="#b8ac92" stroke="#241b15" stroke-width="3"/>' +
    '<rect x="18" y="28" width="28" height="16" fill="#8a2a1e"/>' +
    '<text x="32" y="40" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#f2ead6">S-13</text>'
  );
  const foodIcon = svgIcon(
    '<rect x="17" y="10" width="30" height="44" rx="3" fill="#c9c4b8" stroke="#241b15" stroke-width="3"/>' +
    '<rect x="17" y="10" width="30" height="7" fill="#8a8a80"/>' +
    '<rect x="17" y="22" width="30" height="18" fill="#6a3a2a"/>' +
    '<text x="32" y="34" text-anchor="middle" font-family="monospace" font-size="8" fill="#f2ead6">БОЧКА</text>' +
    '<path d="M22 46h20" stroke="#8a8a80" stroke-width="3"/>'
  );
  const batteryIcon = svgIcon(
    '<rect x="21" y="9" width="22" height="46" rx="3" fill="#2c2c2a" stroke="#e8dcc2" stroke-width="3"/>' +
    '<rect x="27" y="4" width="10" height="7" fill="#8a8a80"/>' +
    '<rect x="21" y="20" width="22" height="6" fill="#c7a13c"/>' +
    '<path d="M32 30v14M26 36h12" stroke="#e8dcc2" stroke-width="3"/>'
  );
  const flareIcon = svgIcon(
    '<rect x="27" y="22" width="10" height="34" rx="3" fill="#b03a2a" stroke="#241b15" stroke-width="3"/>' +
    '<path d="M32 22c-8-7-3-13 0-17 3 4 8 10 0 17z" fill="#ffb15a" stroke="#8a2a1e" stroke-width="2"/>' +
    '<rect x="24" y="28" width="16" height="5" fill="#e0d5a8"/>'
  );
  const lockpickIcon = svgIcon(
    '<path d="M20 48L44 20c4-5 10-3 9 3-1 4-5 8-9 10l-6-4" fill="none" stroke="#c9a05a" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M20 48l-6 6" stroke="#8a6a3a" stroke-width="6" stroke-linecap="round"/>' +
    '<circle cx="48" cy="15" r="4" fill="none" stroke="#e8dcc2" stroke-width="3"/>'
  );
  const keyIcon = (color) => svgIcon(
    '<circle cx="22" cy="22" r="10" fill="none" stroke="' + color + '" stroke-width="6"/>' +
    '<path d="M29 29l22 22M44 44l6-6M49 49l6-6" stroke="' + color + '" stroke-width="6" stroke-linecap="round"/>' +
    '<circle cx="22" cy="22" r="3" fill="#241b15"/>'
  );
  const cardIcon = (color, label) => svgIcon(
    '<rect x="7" y="16" width="50" height="33" rx="4" fill="' + color + '" stroke="#241b15" stroke-width="3"/>' +
    '<rect x="7" y="22" width="50" height="8" fill="rgba(0,0,0,0.28)"/>' +
    '<rect x="13" y="35" width="11" height="8" rx="1" fill="#e8dcc2"/>' +
    '<text x="40" y="42" text-anchor="middle" font-family="monospace" font-size="9" font-weight="bold" fill="#f2ead6">' + label + '</text>'
  );
  const tokenIcon = svgIcon(
    '<path d="M9 17h46v30H9z" fill="#c9a05a" stroke="#241b15" stroke-width="3"/>' +
    '<path d="M14 17v30M50 17v30" stroke="#8a6a3a" stroke-width="2" stroke-dasharray="3 3"/>' +
    '<text x="32" y="38" text-anchor="middle" font-family="monospace" font-size="12" font-weight="bold" fill="#241b15">13</text>'
  );
  const docIcon = svgIcon(
    '<path d="M15 7h26l9 9v41H15z" fill="#d8ceb0" stroke="#241b15" stroke-width="3"/>' +
    '<path d="M41 7v9h9" fill="#b8ac92" stroke="#241b15" stroke-width="2"/>' +
    '<path d="M21 25h23M21 32h23M21 39h16" stroke="#5a4a3a" stroke-width="2"/>'
  );
  const photoIcon = svgIcon(
    '<rect x="9" y="12" width="46" height="40" fill="#e8dcc2" stroke="#241b15" stroke-width="3"/>' +
    '<rect x="14" y="17" width="36" height="26" fill="#3a4a58"/>' +
    '<circle cx="32" cy="28" r="6" fill="#c9a05a"/>' +
    '<path d="M14 43h36" stroke="#5a4a3a" stroke-width="3"/>'
  );
  const weaponIcon = (body) => svgIcon('<g stroke="#241b15" stroke-width="2">' + body + '</g>');

  const ICON_SVG = {
    salt: saltIcon, food: foodIcon, battery: batteryIcon, flare: flareIcon, lockpick: lockpickIcon,
    key_workshop: keyIcon('#c9a05a'), key_boss: keyIcon('#a3271b'),
    tokens: tokenIcon, note: docIcon, photo: photoIcon,
    w_pistol: weaponIcon('<path d="M12 22h28v8H30l-2 8h-8l2-8H12z" fill="#8f8a7c"/><path d="M22 30h8v14h-8z" fill="#3a3a34"/>'),
    w_shotgun: weaponIcon('<path d="M6 24h44v5H6z" fill="#5a4630"/><path d="M12 29h10v10H12z" fill="#3a2a1c"/><path d="M44 21h8v10h-8z" fill="#2c2a24"/>'),
    w_ak74: weaponIcon('<path d="M6 24h42v5H6z" fill="#3a3a34"/><path d="M20 29h9v14h-9z" fill="#5a4a2a"/><path d="M44 21h8v9h-8z" fill="#2c2a24"/><path d="M12 29h7v7h-7z" fill="#5a4a2a"/>'),
    w_flamethrower: weaponIcon('<rect x="8" y="22" width="12" height="14" rx="3" fill="#4a2a1a"/><path d="M20 27h24v5H20z" fill="#8a8a80"/><path d="M44 26l8 3-8 3z" fill="#d8452a"/>'),
    w_harpoon: weaponIcon('<path d="M6 30h42v4H6z" fill="#6a5a40"/><path d="M48 24l10 8-10 8z" fill="#7fae86"/><path d="M14 34h6v8h-6z" fill="#4a3a2a"/>')
  };

  for (let i = 1; i <= 5; i++) {
    DEFS['keycard_' + i].iconSvg = cardIcon(CARD_COLORS[i - 1], '13-' + i);
  }
  for (const [id, file] of Object.entries(ICON_FILES)) {
    if (DEFS[id]) DEFS[id].iconFile = file;
  }
  for (const [id, svg] of Object.entries(ICON_SVG)) {
    if (DEFS[id]) DEFS[id].iconSvg = svg;
  }


  const LOOT = {
    stash_easy: ['ammo_9x18', 'food', 'battery', 'painkiller', 'tokens', 'hat_01', 'shirt_02', 'pants_02', 'calm'],
    stash_mid: ['ammo_12', 'mag_pm', 'medkit', 'recipe_medkit', 'gasoline', 'sweater_01', 'boots_02', 'jacket_01', 'pants_17', 'boots_07'],
    stash_hard: ['ammo_545', 'mag_ak', 'recipe_napalm', 'phosphorus', 'silver', 'armor_plate', 'rps_02', 'helmet_01', 'ammo_9x18_ap',
      'rps_03', 'rps_04', 'jacket_05', 'pants_18', 'pants_19', 'pants_20', 'pants_21', 'boots_08', 'boots_09', 'boots_10', 'boots_11', 'boots_12']
  };


  // ================= гардероб v2 =================
  const wear = (prefix, slot, names, colors, extra) => {
    names.forEach((name, i) => {
      const id = prefix + '_' + String(i + 1).padStart(2, '0');
      const c = colors[i % colors.length];
      DEFS[id] = Object.assign({
        name, w: 1, h: 1, stack: 1, kind: 'clothing', slot,
        icon: (extra && extra.icon) || '▣',
        outfit: Object.assign({}, extra && extra.base, extra && extra.key ? { [extra.key]: c } : {})
      }, extra && extra.armor ? { armor: extra.armor } : {});
    });
  };

  wear('hat', 'hat', [
    'Кепка солевика', 'Фуражка инспектора', 'Вязаная шапка', 'Ушанка', 'Капюшон ватника',
    'Берет рыбака', 'Шляпа технолога', 'Панама', 'Балаклава', 'Шапка-петушок',
    'Кепка «Бочка»', 'Фуражка охраны', 'Мокрый колпак', 'Рваная шапка'
  ], ['#2a2620', '#3a3a30', '#4a3524', '#5a4a3a', '#262a2e', '#6a5a40', '#1a1a1a'], { key: 'hat', icon: '⌂' });

  wear('shirt', 'shirt', [
    'Тельняшка', 'Белая футболка', 'Чёрная футболка', 'Футболка «Смена 9»',
    'Футболка рыбака', 'Серая футболка', 'Зелёная футболка', 'Рваная футболка',
    'Футболка с биркой', 'Красная футболка'
  ], ['#d8d0bc', '#e8e8dc', '#1a1a1a', '#2a3a4a', '#5a6a5a', '#6a6a6a', '#4a6a3a', '#7a4a3a', '#c9a05a', '#8a2a1e'], { key: 'shirt', icon: 'T' });

  wear('sweater', 'sweater', [
    'Свитер вахтёра', 'Кофта кочегара', 'Вязаный свитер', 'Свитер с оленями',
    'Тёплая кофта', 'Свитер технолога', 'Просоленная кофта'
  ], ['#3a2f24', '#4a3524', '#5a5a4a', '#6a3a2a', '#2a3a3a', '#4a4a5a', '#6a6a50'], { key: 'sweater', icon: 'W' });

  wear('jacket', 'jacket', [
    'Ватник', 'Куртка рыбака', 'Бушлат', 'Плащ инспектора', 'Пончо', 'Белые рваные лохмотья'
  ], ['#3f4a58', '#5a5246', '#2a2f24', '#2a2620', '#4a5a32', '#b8b8b0'], { key: 'coat', icon: 'J' });

  wear('pants', 'pants', [
    'Рабочие штаны', 'Джинсы', 'Спортивные штаны', 'Камуфляж', 'Брезентовые штаны',
    'Штаны технолога', 'Мокрые штаны', 'Штаны с заплатами', 'Штаны охраны', 'Комбинезон',
    'Штаны рыбака', 'Рваные штаны', 'Штаны «Смена»', 'Тёплые штаны', 'Штаны с карманами', 'Просоленные штаны',
    'Штаны «Горка»', 'Штаны «Флора»', 'Штаны «Городской камуфляж»', 'Штаны «Песчаный камуфляж»', 'Штаны «Зелёный камуфляж»'
  ], ['#23272d', '#2a3a4a', '#1a1a1a', '#3a4a2a', '#4a3a2a', '#2a2a2a', '#3a3a3a', '#5a4a3a', '#4a5a32', '#6a5a3a', '#2a3a2a', '#6a6a60'], { key: 'pants', icon: 'P' });

  wear('boots', 'boots', [
    'Кирзовые сапоги', 'Резиновые сапоги', 'Ботинки рабочего', 'Кроссовки',
    'Валенки', 'Сапоги рыбака', 'Берцы «Мультикам песочные»', 'Берцы «Лесной камуфляж»',
    'Чёрные берцы', 'Кроссовки синие', 'Кроссовки с высоким берцем', 'Кеды Vanes'
  ], ['#141414', '#1a2a2a', '#2a2018', '#3a3a3a', '#4a4a40', '#2a1a1a', '#8a7a5a', '#4a5a32', '#181818', '#6a7a8a', '#7a2a2a', '#1a1a1a'], { key: 'boots', icon: 'B' });

  wear('helmet', 'helmet', [
    'Каска солевика', 'Каска инспектора', 'Ржавая каска'
  ], ['#6a6a5a', '#4a5a4a', '#5a4a3a'], { key: 'helmet', icon: 'H', armor: 0.08 });

  wear('armor', 'armor', [
    'Бронеплита', 'Самодельная броня', 'Броня культа'
  ], ['#5a5a50', '#4a4a3a', '#2a2620'], { key: 'armor', icon: 'A', armor: 0.2 });

  const rpsColors = ['#4a4a3a', '#2a3a2a', '#3a2a24', '#1f2a30'];
  ['РПС «Смена»', 'РПС рыбака', 'РПС культа', 'РПС инспектора'].forEach((name, i) => {
    const id = 'rps_' + String(i + 1).padStart(2, '0');
    DEFS[id] = {
      name, w: 2, h: 2, stack: 1, kind: 'clothing', slot: 'rps', icon: 'R',
      outfit: { rps: rpsColors[i] }, armor: 0.05 + i * 0.02
    };
  });

  // точные иконки одежды и снаряжения (из набора пользователя)
  const OUTFIT_ICONS = {
    rps_01: 'equip10.png', rps_02: 'equip14.png', rps_03: 'equip13.png', rps_04: 'equip12.png',
    jacket_05: 'cloth6.png', jacket_06: 'cloth11b.png',
    pants_17: 'cloth25.png', pants_18: 'equip28.png', pants_19: 'equip27.png',
    pants_20: 'equip26.png', pants_21: 'equip25.png',
    boots_07: 'equip29.png', boots_08: 'equip31.png', boots_09: 'equip46.png',
    boots_10: 'cloth35.png', boots_11: 'cloth34.png', boots_12: 'cloth31.png'
  };
  for (const [id, file] of Object.entries(OUTFIT_ICONS)) {
    if (DEFS[id]) DEFS[id].iconFile = file;
  }

  RB.Items = {
    defs: DEFS,
    loot: LOOT,
    values: {
      medkit: 7, food: 3, battery: 4, painkiller: 5, adrenaline: 6, salt: 8, lockpick: 5,
      ammo_9x18: 1, ammo_12: 1, ammo_545: 1, ammo_flame: 2, ammo_harpoon: 4,
      ammo_9x18_ap: 2, ammo_9x18_tr: 1, ammo_545_ap: 2, ammo_545_tr: 1,
      ammo_12_slug: 2, ammo_12_inc: 3,
      mag_pm: 6, mag_shotgun: 7, mag_ak: 14, mag_flame: 12, mag_harpoon: 8,
      w_pistol: 10, w_shotgun: 24, w_ak74: 38, w_flamethrower: 60, w_harpoon: 30,
      coat_worker: 4, coat_fisher: 12, pants_worker: 3, boots_worker: 3, gloves_worker: 2,
      helmet_worker: 10, mask_gas: 8, armor_plate: 18,
      gasoline: 5, phosphorus: 7, silver: 6, napalm: 12,
      recipe_napalm: 18, recipe_flame: 14, recipe_medkit: 10
    },
    value(id) { return this.values[id] || 2; },
    get(id) { return DEFS[id] || null; }
  };

  RB.Recipes = {
    flame: {
      name: 'Топливо огнемёта', result: 'ammo_flame', count: 20,
      ingredients: { gasoline: 1, phosphorus: 1, silver: 1 }
    },
    napalm: {
      name: 'Напалм', result: 'napalm', count: 1,
      ingredients: { gasoline: 2, phosphorus: 1, silver: 2 }
    },
    napalm_fuel: {
      name: 'Топливо из напалма', result: 'ammo_flame', count: 40,
      ingredients: { napalm: 1, gasoline: 1 }
    },
    medkit: {
      name: 'Аптечка', result: 'medkit', count: 1,
      ingredients: { food: 1, salt: 1 }
    },
    mag_pm: { name: 'Магазин ПМ', result: 'mag_pm', count: 1, ingredients: { silver: 1 } },
    mag_ak: { name: 'Магазин АК', result: 'mag_ak', count: 1, ingredients: { silver: 2, phosphorus: 1 } },
    mag_flame: { name: 'Баллон огнемёта', result: 'mag_flame', count: 1, ingredients: { silver: 2, gasoline: 1 } },
    harpoon: { name: 'Гарпун', result: 'w_harpoon', count: 1, ingredients: { silver: 2, phosphorus: 1 } },
    salt13: { name: 'Соль-13', result: 'salt', count: 1, ingredients: { silver: 1 } }
  };

  let uid = 1;
  RB.Inv = {
    uid() { return 'i' + (uid++); },
    make(id, count) {
      const d = DEFS[id];
      if (!d) return null;
      const it = {
        uid: this.uid(), id, kind: d.kind, count: Math.max(1, count || 1),
        x: 0, y: 0, w: d.w, h: d.h
      };
      if (d.kind === 'mag') { it.rounds = 0; it.ammo = d.ammo; it.cap = d.cap; it.loaded = null; }
      if (d.kind === 'ammo') { it.ammo = d.ammo; it.family = d.family || d.ammo; it.damageMul = d.damageMul || 1; it.pellets = d.pellets || 0; it.burn = !!d.burn; it.tracer = !!d.tracer; }
      if (d.kind === 'weapon') { it.weapon = d.weapon; it.magUid = null; if (d.noMag) { it.noMag = true; it.cap = d.cap || 1; it.internalRounds = 0; it.internalLoaded = null; } }
      if (d.kind === 'tool' && d.uses) it.uses = d.uses;
      return it;
    },
    container(w, h, name) { return { w, h, name: name || '', items: [] }; },
    fits(c, it) {
      if (!c || it.x < 0 || it.y < 0 || it.x + it.w > c.w || it.y + it.h > c.h) return false;
      for (const o of c.items) {
        if (o === it) continue;
        if (it.x < o.x + o.w && it.x + it.w > o.x && it.y < o.y + o.h && it.y + it.h > o.y) return false;
      }
      return true;
    },
    autoPlace(c, it) {
      for (let y = 0; y <= c.h - it.h; y++) {
        for (let x = 0; x <= c.w - it.w; x++) {
          it.x = x; it.y = y;
          if (this.fits(c, it)) { c.items.push(it); return true; }
        }
      }
      return false;
    },
    addObject(c, it) {
      it.x = 0; it.y = 0;
      return this.autoPlace(c, it);
    },
    add(c, id, count) {      const d = DEFS[id];
      if (!d) return null;
      count = Math.max(1, count || 1);
      if (d.stack > 1) {
        for (const o of c.items) {
          if (o.id === id && o.count < d.stack) {
            const take = Math.min(d.stack - o.count, count);
            o.count += take; count -= take;
            if (count <= 0) return o;
          }
        }
      }
      while (count > 0) {
        const take = Math.min(d.stack, count);
        const it = this.make(id, take);
        if (!this.autoPlace(c, it)) return null;
        count -= take;
      }
      return true;
    },
    remove(c, it) {
      const i = c.items.indexOf(it);
      if (i >= 0) c.items.splice(i, 1);
      return i >= 0;
    },
    findById(c, id) { return c.items.find((o) => o.id === id) || null; },
    findUid(p, u) {
      for (const key of ['backpack', 'pockets', 'rps']) {
        const c = p.inv[key];
        if (!c) continue;
        const it = c.items.find((o) => o.uid === u);
        if (it) return { container: c, item: it, where: key };
      }
      return null;
    },
    move(p, u, container, x, y) {
      const f = this.findUid(p, u);
      if (!f) return false;
      const it = f.item;
      const old = { x: it.x, y: it.y, c: f.container };
      f.container.items.splice(f.container.items.indexOf(it), 1);
      it.x = x; it.y = y;
      if (!this.fits(container, it)) {
        old.c.items.push(it); it.x = old.x; it.y = old.y;
        return false;
      }
      container.items.push(it);
      return true;
    },
    total(p, id) {
      let n = 0;
      for (const key of ['backpack', 'pockets', 'rps']) {
        for (const it of p.inv[key].items) if (it.id === id) n += it.count;
      }
      return n;
    }
  };
})();
