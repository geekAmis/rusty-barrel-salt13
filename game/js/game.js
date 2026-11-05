/* ============================================================
   RUSTY BARREL — игра: состояния, главы, цели, финал
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});

  class Game {
    constructor(canvas) {
      this.canvas = canvas;

      this.lowQuality = RB.store.get('rb_lowq', false);
      this.vibration = RB.store.get('rb_vib', true);

      this.state = 'menu';
      this.world = null;
      this.player = null;
      this.chapter = null;
      this.chapterIndex = 1;
      this.seedText = '000000';
      this.goals = [];
      this.tracers = [];
      this.shakeMag = 0;
      this.shakeTime = 0;
      this.playTime = 0;
      this.kills = 0;
      this.deaths = 0;
      this.notesRead = new Set();
      this.notesTotal = 0;
      for (const ch of RB.Story.chapters) this.notesTotal += (ch.notes || []).length;

      this.controlMode = RB.store.get('rb_control', 0);
      this.fontSize = RB.store.get('rb_font', 1);
      this.shakeScale = RB.store.get('rb_shake', 1);
      this.crosshairAlpha = RB.store.get('rb_cross', 1);
      this.highContrast = RB.store.get('rb_contrast', false);
      this.reduceMotion = RB.store.get('rb_motion', false);
      this.save = this.loadSave();
      this.flags = (this.save && this.save.flags) || {};
      this.npcState = (this.save && this.save.npcState) || null;
      this.explored = (this.save && this.save.explored) || {};
      this.carry = (this.save && this.save.carry) || null;
      this.inIso = false;
      this.scenesSeen = {};
      this.rpg = (this.save && this.save.rpg) || { xp: 0, level: 1, points: 0, upgrades: { hp: 0, stamina: 0, attention: 0, damage: 0, meds: 0, leg: 0 } };
      this.endingsUnlocked = RB.store.get('rb_endings', []);

      this.input = new RB.Input(canvas);
      this.renderer = new RB.Renderer(canvas);
      this.renderer.lowQuality = this.lowQuality;
      this.renderer.crossAlpha = this.crosshairAlpha;
      this.renderer.resize();
      document.body.classList.toggle('font-lg', this.fontSize === 1);
      document.body.classList.toggle('font-xl', this.fontSize === 2);
      document.body.classList.toggle('high-contrast', !!this.highContrast);
      document.body.classList.toggle('reduce-motion', !!this.reduceMotion);
      this.ui = new RB.UI(this);

      this.whisperTimer = 0;
      this.ambientTimer = RB.rand(40, 90);
      this.lastRoom = null;
      this.hudTick = 0;

      this.bindUI();
      this.bindResize();

      this.ui.showMenu(!!this.save);
    }

    discoverRoom(room) {
      if (!room || !this.world) return;
      this.explored = this.explored || {};
      const rooms = this.world.rooms || [];
      const idx = rooms.indexOf(room);
      if (idx < 0) return;
      const key = 'ch' + this.chapterIndex + ':' + idx;
      const inRoom = (x, y) => x >= room.x - 40 && x <= room.x + room.w + 40 && y >= room.y - 40 && y <= room.y + room.h + 40;
      const objects = [];
      for (const o of this.world.objects) {
        if (o.taken || !inRoom(o.x, o.y)) continue;
        if (['elevator', 'checkpoint', 'door', 'isoExit'].includes(o.kind)) continue;
        objects.push({ kind: o.kind, x: o.x, y: o.y });
      }
      const enemies = [];
      for (const e of this.world.enemies) {
        if (e.dead || !inRoom(e.x, e.y)) continue;
        enemies.push({ type: e.type, x: e.x, y: e.y, boss: !!(e.def && e.def.isBoss) });
      }
      this.explored[key] = {
        name: room.name, x: room.x, y: room.y, w: room.w, h: room.h,
        objects, enemies, visitedAt: Date.now()
      };
      this.saveProgress();
    }

    initNpcState() {
      if (this.npcState) return;
      const rnd = RB.mulberry32(RB.hashSeed(this.seedText + ':npc'));
      this.npcState = {};
      for (const id in RB.Story.npcs) {
        this.npcState[id] = {
          level: 1 + Math.floor(rnd() * 9),
          currency: 8 + Math.floor(rnd() * 50),
          attitude: 0
        };
      }
      this.explored = this.explored || {};
    }

    refreshRecordButton() {
      if (!this.ui || !this.ui.setRecordEnabled) return;
      const ok = !this.inIso && !(this.world && this.world.bossFight) && !(this.recordBlocked > 0);
      this.ui.setRecordEnabled(ok);
    }

    initInventory(p) {
      const Inv = RB.Inv;
      this.flags.recipes = this.flags.recipes || { flame: true, mag_pm: true, mag_ak: true, mag_flame: true, harpoon: true };
      p.inv = {
        backpack: Inv.container(5, 3, 'РЮКЗАК'),
        pockets: Inv.container(2, 2, 'КАРМАНЫ'),
        rps: Inv.container(4, 3, 'РПС'),
        equipped: {},
        equipment: {
          weapon: null, armor: null, coat: null, jacket: null, sweater: null, shirt: null,
          hat: null, pants: null, boots: null, gloves: null, helmet: null, mask: null, rps: null
        }
      };
      p.outfit = {};
      p.naked = false;
      Inv.add(p.inv.pockets, 'w_pistol', 1);
      const mag = Inv.add(p.inv.pockets, 'mag_pm', 1);
      const magItem = Inv.findById(p.inv.pockets, 'mag_pm');
      if (magItem) { magItem.rounds = 8; magItem.loaded = 'ammo_9x18'; }
      Inv.add(p.inv.pockets, 'ammo_9x18', 16);
      Inv.add(p.inv.backpack, 'medkit', 1);
      Inv.add(p.inv.backpack, 'lockpick', 1);
      Inv.add(p.inv.backpack, 'food', 1);
      Inv.add(p.inv.backpack, 'coat_worker', 1);
      Inv.add(p.inv.backpack, 'pants_worker', 1);
      Inv.add(p.inv.backpack, 'boots_worker', 1);
      Inv.add(p.inv.backpack, 'hat_01', 1);
      Inv.add(p.inv.backpack, 'shirt_01', 1);
      // надеть стартовую одежду
      for (const id of ['coat_worker', 'pants_worker', 'boots_worker', 'hat_01', 'shirt_01']) {
        let it = Inv.findUid(p, (p.inv.equipment && p.inv.equipment[id]) || '');
        if (!it) it = Inv.findById(p.inv.pockets, id) || Inv.findById(p.inv.backpack, id);
        if (it) this.equipUid(p, it.item ? it.item.uid : it.uid, true);
      }
      const w = Inv.findUid(p, p.inv.equipment.weapon) || Inv.findById(p.inv.pockets, 'w_pistol');
      const wi = Inv.findById(p.inv.pockets, 'w_pistol') || Inv.findById(p.inv.backpack, 'w_pistol');
      if (wi) {
        if (magItem) wi.magUid = magItem.uid;
        this.equipUid(p, wi.uid, true);
      }
      this.applyOutfit(p);
      this.syncAmmo(p);
    }

    getEquip(p, slot) {
      if (!p.inv) return null;
      if (p.inv.equipped && p.inv.equipped[slot]) return p.inv.equipped[slot];
      if (!p.inv.equipment) return null;
      const u = p.inv.equipment[slot];
      if (!u) return null;
      const f = RB.Inv.findUid(p, u);
      return f ? f.item : null;
    }

    getWeaponItem(p) {
      const it = this.getEquip(p, 'weapon');
      return it && it.kind === 'weapon' ? it : null;
    }

    ammoForWeapon(w) {
      return { pistol: '9x18', shotgun: '12', ak74: '545', flamethrower: 'flame', harpoon: 'harpoon' }[w] || '9x18';
    }

    getWeaponMag(p, wItem) {
      if (!wItem) return null;
      if (wItem.noMag) {
        return {
          internal: true, uid: 'internal_' + wItem.uid,
          rounds: wItem.internalRounds || 0, cap: wItem.cap || 1,
          ammo: this.ammoForWeapon(wItem.weapon), loaded: wItem.internalLoaded || null
        };
      }
      if (!wItem.magUid) return null;
      const f = RB.Inv.findUid(p, wItem.magUid);
      return f ? f.item : null;
    }

    findMagFor(p, wItem) {
      if (!p.inv || !wItem) return null;
      let any = null;
      for (const key of ['backpack', 'pockets', 'rps']) {
        const c = p.inv[key];
        if (!c) continue;
        for (const o of c.items) {
          if (o.kind !== 'mag' || o.forWeapon !== wItem.weapon) continue;
          if (o.rounds > 0) return o;
          if (!any) any = o;
        }
      }
      return any;
    }

    magAmmoOf(mag) {
      if (!mag) return null;
      if (mag.ammo) return mag.ammo;
      const d = RB.Items.get(mag.id);
      if (d && d.ammo) { mag.ammo = d.ammo; return d.ammo; }
      if (mag.forWeapon) { mag.ammo = this.ammoForWeapon(mag.forWeapon); return mag.ammo; }
      return null;
    }

    syncAmmo(p) {
      if (!p || !p.inv) return;
      const wItem = this.getWeaponItem(p);
      if (!wItem) { p.mags[p.weapon] = 0; p.reserves[p.weapon] = 0; return; }
      const mag = this.getWeaponMag(p, wItem);
      p.mags[p.weapon] = mag ? (mag.rounds || 0) : 0;
      const ft = mag ? this.magAmmoOf(mag) : null;
      let total = 0;
      for (const key of ['backpack', 'pockets', 'rps']) {
        for (const it of p.inv[key].items) {
          if (it.kind === 'ammo' && it.family === ft) total += it.count;
        }
      }
      p.reserves[p.weapon] = total;
      const ad = mag && mag.loaded ? RB.Items.get(mag.loaded) : null;
      p.ammoMul = ad && ad.damageMul ? ad.damageMul : 1;
      p.ammoPellets = ad && ad.pellets ? ad.pellets : 0;
      p.ammoBurn = !!(ad && ad.burn);
      p.ammoTracer = !!(ad && ad.tracer);
    }

    consumeRound(p) {
      const wItem = this.getWeaponItem(p);
      if (!wItem) return;
      if (wItem.noMag) {
        wItem.internalRounds = Math.max(0, (wItem.internalRounds || 0) - 1);
      } else {
        const mag = this.getWeaponMag(p, wItem);
        if (mag && mag.rounds > 0) mag.rounds--;
      }
      this.syncAmmo(p);
    }

    reloadWeapon(p) {
      if (!p || !p.inv) return;
      if (p.reloadTimer > 0) return;
      const wItem = this.getWeaponItem(p);
      if (!wItem) { this.ui.toast('ОРУЖИЕ НЕ В РУКАХ'); RB.Sound.play('deny'); return; }
      let mag = this.getWeaponMag(p, wItem);
      const internal = !!wItem.noMag;
      if (!mag) {
        mag = this.findMagFor(p, wItem);
        if (mag) {
          wItem.magUid = mag.uid;
          this.ui.toast('МАГАЗИН ВСТАВЛЕН');
        }
      }
      if (!mag) { this.ui.toast('НЕТ МАГАЗИНА ДЛЯ ' + wItem.name); RB.Sound.play('deny'); return; }
      const magType = this.magAmmoOf(mag);
      if (!magType) { this.ui.toast('МАГАЗИН БЕЗ ТИПА ПАТРОНОВ'); RB.Sound.play('deny'); return; }
      // если текущий пуст, а есть другой полный — переставить
      if (!internal && mag.rounds <= 0) {
        const alt = this.findMagFor(p, wItem);
        if (alt && alt.rounds > 0 && alt.uid !== mag.uid) {
          wItem.magUid = alt.uid;
          mag = alt;
          this.ui.toast('МАГАЗИН ЗАМЕНЁН');
        }
      }
      if (mag.rounds >= mag.cap) { this.ui.toast('МАГАЗИН ПОЛОН'); RB.Sound.play('dry'); return; }
      let need = mag.cap - mag.rounds;
      let taken = 0;
      for (const key of ['backpack', 'pockets', 'rps']) {
        const c = p.inv[key];
        for (const it of c.items.slice()) {
          if (need <= 0) break;
          if (it.kind !== 'ammo' || it.family !== magType) continue;
          const take = Math.min(need, it.count);
          it.count -= take; mag.rounds += take; need -= take; taken += take;
          mag.loaded = it.id;
          if (internal) { wItem.internalRounds = mag.rounds; wItem.internalLoaded = it.id; }
          if (it.count <= 0) RB.Inv.remove(c, it);
        }
      }
      if (!taken) { this.ui.toast('НЕТ ПАТРОНОВ ' + (magType || '—')); RB.Sound.play('deny'); return; }
      if (internal) { wItem.internalRounds = mag.rounds; wItem.internalLoaded = mag.loaded; }
      const w = RB.Weapons[p.weapon];
      p.reloadTimer = w ? w.reload : 1.2;
      p.reloadTotal = p.reloadTimer;
      RB.Sound.play('reload');
      this.syncAmmo(p);
      this.ui.updateHUD(this);
    }

    addItem(id, count) {
      const p = this.player;
      if (!p || !p.inv) { this.giveImmediate(id, count); return true; }
      const d = RB.Items.get(id);
      if (!d) return false;
      let ok = false;
      if (d.kind === 'mag' && p.inv.rps && this.getEquip(p, 'rps')) ok = RB.Inv.add(p.inv.rps, id, count);
      if (!ok) ok = RB.Inv.add(p.inv.backpack, id, count);
      if (!ok) ok = RB.Inv.add(p.inv.pockets, id, count);
      if (!ok) {
        this.ui.toast('НЕТ МЕСТА В ИНВЕНТАРЕ');
        RB.Sound.play('deny');
        return false;
      }
      this.ui.toast((d.name || id).toUpperCase() + ' · В ИНВЕНТАРЬ');
      this.syncAmmo(p);
      this.saveProgress();
      return true;
    }

    giveImmediate(id, count) {
      const p = this.player;
      const d = RB.Items.get(id);
      if (!d) return;
      const u = Object.assign({}, d.use || {});
      if (u.hp) p.hp = RB.clamp(p.hp + u.hp, 0, p.maxHp);
      if (u.battery) p.battery = RB.clamp(p.battery + u.battery, 0, 100);
      if (u.stamina) p.stamina = RB.clamp(p.stamina + u.stamina, 0, 100);
      if (u.hunger) p.hunger = RB.clamp((p.hunger || 0) + u.hunger, 0, 100);
      if (u.painkiller) p.painkiller = u.painkiller;
      if (u.adrenaline) p.adrenaline = u.adrenaline;
      if (u.saltVision) p.saltVision = u.saltVision;
      if (u.attention) p.attention = RB.clamp((p.attention || 0) + u.attention, 0, 100);
      if (u.healInjuries) { p.legHurt = false; p.armHurt = false; p.bleed = 0; }
    }

    dropItem(uid) {
      const p = this.player;
      const f = RB.Inv.findUid(p, uid);
      if (!f) return false;
      const it = f.item;
      const wItem = this.getWeaponItem(p);
      if (wItem && wItem.magUid === it.uid) wItem.magUid = null;
      RB.Inv.remove(f.container, it);
      this.dropItemNear(it.id, it.count || 1, {
        rounds: it.rounds, loaded: it.loaded,
        internalRounds: it.internalRounds, internalLoaded: it.internalLoaded
      });
      this.ui.toast('ВЫБРОШЕНО: ' + ((RB.Items.get(it.id) || {}).name || it.id));
      RB.Sound.play('pickup');
      this.syncAmmo(p);
      this.saveProgress();
      return true;
    }

    dropItemNear(id, count, extra) {
      const p = this.player;
      const world = this.world;
      if (!p || !world) return null;
      const def = RB.Items.get(id);
      const footY = (world.mode === 'iso') ? p.y : p.y + (p.h || 40) / 2 - 8;
      const dists = [58, 74, 46, 88];
      const dirs = [p.facing || 1, -(p.facing || 1), 1, -1];
      let spot = null;
      for (const d of dists) {
        for (const dir of dirs) {
          const nx = p.x + dir * d;
          const ny = footY;
          if (nx < 30 || ny < 30) continue;
          if (world.solidAt && world.solidAt(nx, ny)) continue;
          if (world.mode !== 'iso' && world.solidAt && !world.solidAt(nx, ny + 18)) continue;
          spot = { x: nx, y: ny };
          break;
        }
        if (spot) break;
      }
      if (!spot) spot = { x: p.x + 48, y: footY };
      const o = Object.assign({
        kind: 'item', item: id, count: count || 1,
        tx: Math.floor(spot.x / 48), ty: Math.floor(spot.y / 48),
        x: spot.x, y: spot.y, taken: false,
        pickupAt: Date.now() + 900,
        dropStart: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
        label: (def && def.name) || id
      }, extra || {});
      world.objects.push(o);
      return o;
    }

    grantOrDrop(id, count, extra) {
      const def = RB.Items.get(id);
      if (this.addItem(id, count) !== false) return true;
      this.dropItemNear(id, count, extra);
      this.ui.toast('ИНВЕНТАРЬ ПОЛОН · ' + ((def && def.name) || id) + ' НА ПОЛУ');
      return false;
    }

    mergeAmmo(dstUid, srcUid) {
      const p = this.player;
      const fd = RB.Inv.findUid(p, dstUid);
      const fs = RB.Inv.findUid(p, srcUid);
      if (!fd || !fs || fd.item === fs.item) return false;
      const dst = fd.item, src = fs.item;
      if (dst.kind !== 'ammo' || src.kind !== 'ammo') return false;
      if (dst.id !== src.id) { this.ui.toast('РАЗНЫЕ ТИПЫ ПАТРОНОВ'); return false; }
      const def = RB.Items.get(dst.id) || { stack: 120 };
      const cap = def.stack || 120;
      if (dst.count >= cap) { this.ui.toast('СТАК ПАТРОНОВ ПОЛОН'); return false; }
      const take = Math.min(cap - dst.count, src.count);
      dst.count += take;
      src.count -= take;
      if (src.count <= 0) RB.Inv.remove(fs.container, src);
      this.ui.toast('ПАТРОНЫ ОБЪЕДИНЕНЫ: ' + dst.count);
      RB.Sound.play('pickup');
      this.syncAmmo(p);
      this.saveProgress();
      return true;
    }

    useItem(uid) {
      const p = this.player;
      if (!p || !p.inv) return;
      const f = RB.Inv.findUid(p, uid);
      if (!f) return;
      const it = f.item;
      const d = RB.Items.get(it.id);
      if (!d) return;
      if (d.kind === 'weapon' || d.kind === 'clothing') return this.equipUid(p, uid);
      if (d.kind === 'recipe') {
        this.flags.recipes = this.flags.recipes || {};
        this.flags.recipes[d.recipe] = true;
        RB.Inv.remove(f.container, it);
        this.ui.toast('РЕЦЕПТ ИЗУЧЕН: ' + d.name);
        RB.Sound.play('paper');
        this.saveProgress();
        return;
      }
      if (d.kind === 'mag') { return this.loadMag(uid); }
      if (it.id === 'salt') {
        this.useDrug();
        it.count--;
        if (it.count <= 0) RB.Inv.remove(f.container, it);
        this.saveProgress();
        return;
      }
      if (it.id === 'calm') {
        p.calmTimer = 300;
        p.recordBlocked = 0;
        p.attention = 0;
        it.count--;
        if (it.count <= 0) RB.Inv.remove(f.container, it);
        this.ui.toast('УСПОКОИТЕЛЬНОЕ · СТРЕСС 0% НА 5 МИН');
        this.ui.updateHUD(this);
        this.saveProgress();
        return;
      }
      if (!d.use) { this.ui.toast('НЕЛЬЗЯ ИСПОЛЬЗОВАТЬ'); return; }
      this.giveImmediate(it.id, 1);
      it.count--;
      if (it.count <= 0) RB.Inv.remove(f.container, it);
      this.ui.toast((d.name || it.id).toUpperCase() + ' ИСПОЛЬЗОВАН');
      RB.Sound.play('pickup');
      this.syncAmmo(p);
      this.saveProgress();
    }

    craftRecipe(id) {
      const r = RB.Recipes && RB.Recipes[id];
      if (!r) return false;
      this.flags.recipes = this.flags.recipes || { flame: true, mag_pm: true, mag_ak: true, mag_flame: true, harpoon: true };
      if (!this.flags.recipes[id]) return false;
      const p = this.player;
      for (const k in r.ingredients) {
        if (RB.Inv.total(p, k) < r.ingredients[k]) return false;
      }
      for (const k in r.ingredients) {
        let need = r.ingredients[k];
        for (const key of ['backpack', 'pockets', 'rps']) {
          const c = p.inv[key];
          for (const it of c.items.slice()) {
            if (need <= 0) break;
            if (it.id !== k) continue;
            const take = Math.min(need, it.count);
            it.count -= take; need -= take;
            if (it.count <= 0) RB.Inv.remove(c, it);
          }
        }
      }
      this.addItem(r.result, r.count);
      this.saveProgress();
      return true;
    }

    useDrug() {
      const p = this.player;
      const d = p.drug || (p.drug = { doses: 0, penalty: 0, relief: 0, tick: 0, boost: 0 });
      d.doses++;
      if (d.doses >= 3) {
        p.hp = 0;
        p.dead = true;
        this.deathCause = 'suffocation';
        this.ui.subtitle('ТЫ ПРИНЯЛ ТРЕТЬЮ ДОЗУ. ГОРЛО СЖИМАЕТСЯ.', 5);
        this.onDeath();
        return;
      }
      const restore = () => {
        p.hp = p.maxHpBase || p.maxHp;
        p.stamina = 100;
        p.attention = RB.clamp(p.attention - 30, 0, 100);
        p.bleed = 0;
        p.legHurt = false;
        p.armHurt = false;
        p.battery = RB.clamp(p.battery + 40, 0, 100);
      };
      if (d.doses === 1) {
        restore();
        d.penalty = 0; d.relief = 0; d.boost = 0;
        this.ui.toast('ПОЛНОЕ ВОССТАНОВЛЕНИЕ');
      } else if (d.relief > 0) {
        d.penalty = Math.min(90, d.penalty + 15);
        d.relief = 600;
        d.boost = 1;
        restore();
        this.ui.toast('ДОСРОЧНАЯ ДОЗА · x2 HP И УРОН');
      } else {
        d.penalty = 30 + Math.max(0, d.doses - 2) * 2;
        d.relief = 600;
        d.boost = 0;
        restore();
        this.ui.toast('ПРИХОД НА 10 МИНУТ · ПОТОМ ' + d.penalty + '%');
      }
      this.applyDrugStats();
      this.ui.updateHUD(this);
    }

    applyDrugStats() {
      const p = this.player;
      if (!p || !p.drug) return;
      const d = p.drug;
      const relief = d.relief > 0;
      p.drugCap = relief ? 1 : (d.penalty > 0 ? Math.max(0.1, 1 - d.penalty / 100) : 1);
      const boost = relief && d.boost ? 2 : 1;
      p.maxHp = Math.max(10, Math.round((p.maxHpBase || 100) * p.drugCap * boost));
      p.drugDamage = boost;
      p.hp = RB.clamp(p.hp, 1, p.maxHp);
    }

    updateCalm(dt) {
      const p = this.player;
      if (!p) return;
      if (p.calmTimer > 0) {
        p.calmTimer -= dt;
        p.attention = 0;
        if (p.calmTimer <= 0) {
          p.calmTimer = 0;
          p.attention = 80;
          p.recordBlocked = 60;
          this.ui.toast('УСПОКОИТЕЛЬНОЕ ОТПУСТИЛО · СТРЕСС 80%');
          this.ui.subtitle('Руки трясутся. Запись недоступна минуту.', 4);
          this.refreshRecordButton();
        }
      }
      if (p.recordBlocked > 0) {
        p.recordBlocked -= dt;
        if (p.recordBlocked <= 0) {
          p.recordBlocked = 0;
          this.ui.toast('ЗАПИСЬ СНОВА ДОСТУПНА');
          this.refreshRecordButton();
        }
      }
    }

    updateDrug(dt) {
      const p = this.player;
      if (!p || !p.drug) return;
      const d = p.drug;
      if (d.relief > 0) {
        d.relief -= dt;
        if (d.relief <= 0) {
          d.relief = 0;
          d.boost = 0;
          this.ui.toast('ПРИХОД КОНЧИЛСЯ');
          this.applyDrugStats();
        }
      }
      if (d.penalty > 0 && d.relief <= 0) {
        d.tick += dt;
        if (d.tick >= 12) {
          d.tick -= 12;
          p.hp -= 0.1;
          if (p.hp <= 0) { p.hp = 0; p.dead = true; this.deathCause = 'suffocation'; this.onDeath(); return; }
        }
      }
    }

    loadMagFromAmmo(ammoUid, magUid) {
      const p = this.player;
      const fa = RB.Inv.findUid(p, ammoUid);
      const fm = RB.Inv.findUid(p, magUid);
      if (!fa || !fm || fm.item.kind !== 'mag') return false;
      const ammo = fa.item, mag = fm.item;
      if (ammo.kind !== 'ammo' || ammo.family !== this.magAmmoOf(mag)) { this.ui.toast('НЕПОДХОДЯЩИЙ ПАТРОН'); return false; }
      const need = mag.cap - mag.rounds;
      if (need <= 0) { this.ui.toast('МАГАЗИН ПОЛОН'); return false; }
      const take = Math.min(need, ammo.count);
      ammo.count -= take; mag.rounds += take; mag.loaded = ammo.id;
      if (ammo.count <= 0) RB.Inv.remove(fa.container, ammo);
      this.syncAmmo(p);
      this.ui.toast('ПАТРОНЫ В МАГАЗИН: +' + take);
      RB.Sound.play('reload');
      this.saveProgress();
      return true;
    }

    loadMag(uid) {
      const p = this.player;
      const f = RB.Inv.findUid(p, uid);
      if (!f || f.item.kind !== 'mag') return;
      const mag = f.item;
      const magType = this.magAmmoOf(mag);
      if (!magType) { this.ui.toast('МАГАЗИН БЕЗ ТИПА ПАТРОНОВ'); return; }
      let need = mag.cap - mag.rounds;
      if (need <= 0) { this.ui.toast('МАГАЗИН ПОЛОН'); return; }
      let taken = 0;
      for (const key of ['backpack', 'pockets', 'rps']) {
        const c = p.inv[key];
        for (const it of c.items.slice()) {
          if (need <= 0) break;
          if (it.kind !== 'ammo' || it.family !== magType) continue;
          const take = Math.min(need, it.count);
          it.count -= take; mag.rounds += take; need -= take; taken += take;
          mag.loaded = it.id;
          if (it.count <= 0) RB.Inv.remove(c, it);
        }
      }
      this.ui.toast(taken ? 'МАГАЗИН СНАРЯЖЁН' : 'НЕТ ПАТРОНОВ ' + (magType || '—'));
      RB.Sound.play(taken ? 'reload' : 'deny');
      this.syncAmmo(p);
      this.saveProgress();
    }

    equipUid(p, uid, silent) {
      p.inv.equipped = p.inv.equipped || {};
      const f = RB.Inv.findUid(p, uid);
      let it = f ? f.item : null;
      if (!it) {
        for (const k in p.inv.equipped) if (p.inv.equipped[k].uid === uid) it = p.inv.equipped[k];
      }
      if (!it) return;
      const d = RB.Items.get(it.id);
      if (!d) return;
      const slot = d.kind === 'weapon' ? 'weapon' : d.slot;
      if (d.kind !== 'weapon' && d.kind !== 'clothing') return;
      // старый предмет вернуть в рюкзак
      const old = p.inv.equipped[slot];
      if (old && old.uid !== it.uid) {
        const back = p.inv.backpack;
        if (!RB.Inv.addObject(back, old) && !RB.Inv.addObject(p.inv.pockets, old)) {
          this.ui.toast('НЕТ МЕСТА, ЧТОБЫ СНЯТЬ ' + (RB.Items.get(old.id) ? RB.Items.get(old.id).name : old.id));
          return;
        }
      }
      if (f) RB.Inv.remove(f.container, it);
      p.inv.equipped[slot] = it;
      p.inv.equipment[slot] = it.uid;
      if (d.kind === 'weapon') {
        p.weapon = d.weapon;
        p.owned[d.weapon] = true;
        if (!it.magUid) {
          const mag = this.findMagFor(p, it);
          if (mag) it.magUid = mag.uid;
        }
        this.syncAmmo(p);
        if (!silent) this.ui.toast('ОРУЖИЕ: ' + d.name);
      } else {
        this.applyOutfit(p);
        if (!silent) this.ui.toast('НАДЕТО: ' + d.name);
      }
      this.ui.updateHUD(this);
      this.saveProgress();
    }

    unequipSlot(slot) {
      const p = this.player;
      if (!p || !p.inv) return;
      p.inv.equipped = p.inv.equipped || {};
      const it = p.inv.equipped[slot];
      if (!it) { p.inv.equipment[slot] = null; return; }
      let placed = RB.Inv.addObject(p.inv.backpack, it);
      if (!placed) placed = RB.Inv.addObject(p.inv.pockets, it);
      if (!placed) { this.ui.toast('НЕТ МЕСТА В ИНВЕНТАРЕ'); RB.Sound.play('deny'); return; }
      delete p.inv.equipped[slot];
      p.inv.equipment[slot] = null;
      if (slot === 'weapon') { p.weapon = 'pistol'; p.mags[p.weapon] = 0; }
      this.applyOutfit(p);
      this.syncAmmo(p);
      this.ui.updateHUD(this);
      this.saveProgress();
    }

    applyOutfit(p) {
      if (!p) return;
      const o = { skin: '#b08a6c', skinDark: '#8a6650', coat: null, coatDark: null, jacket: null, sweater: null, shirt: null, hat: null, rps: null, pants: null, pantsDark: null, boots: null, bootsDark: null, gloves: null, helmet: null, mask: null, armor: null };
      for (const slot of ['coat', 'jacket', 'sweater', 'shirt', 'hat', 'rps', 'pants', 'boots', 'gloves', 'helmet', 'mask', 'armor']) {
        const it = this.getEquip(p, slot);
        const d = it && RB.Items.get(it.id);
        if (d && d.outfit) Object.assign(o, d.outfit);
      }
      p.outfit = o;
      p.naked = !this.getEquip(p, 'coat') && !this.getEquip(p, 'jacket') && !this.getEquip(p, 'shirt') && !this.getEquip(p, 'sweater') && !this.getEquip(p, 'pants');
      let armor = 0;
      for (const slot of ['coat', 'jacket', 'helmet', 'mask', 'armor', 'rps']) {
        const it = this.getEquip(p, slot);
        const d = it && RB.Items.get(it.id);
        if (d && d.armor) armor += d.armor;
      }
      p.armorValue = RB.clamp(armor, 0, 0.6);
      p.armor = p.armorValue > 0;
    }

    bindResize() {
      let raf = null;
      const onResize = () => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          this.renderer.resize();
          raf = null;
        });
      };
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);
    }

    bindUI() {
      const $ = (id) => document.getElementById(id);
      const click = (id, fn) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener('click', (e) => {
          e.preventDefault();
          RB.Sound.init();
          RB.Sound.play('ui');
          fn();
        });
      };

      click('btn-new', () => this.newGame(false));
      click('btn-ngplus', () => this.newGame(true));
      click('btn-continue', () => this.continueGame());
      click('btn-settings', () => this.ui.showSettings('menu'));
      click('btn-about', () => this.ui.showAbout(() => this.ui.showMenu(!!this.save)));
      click('btn-settings-close', () => this.ui.closeSettings());
      click('btn-resume', () => this.resume());
      click('btn-pause-settings', () => this.ui.showSettings('pause'));
      click('btn-dev', () => this.openDev());
      click('btn-map', () => this.openMap());
      click('btn-inv', () => this.openInventory());
      click('btn-pause-menu', () => this.toMenu());

      this.input.bindButton($('btn-light'), 'flashlight');
      this.input.bindButton($('btn-reload'), 'reload');
      this.input.bindButton($('btn-melee'), 'melee');
      this.input.bindButton($('btn-fire'), 'fire');
      this.input.bindButton($('btn-record'), 'record');
      this.input.bindButton($('btn-weapon'), 'weapon');
      this.input.bindButton($('btn-jump'), 'jump');

      const pauseBtn = $('btn-pause');
      if (pauseBtn) {
        pauseBtn.addEventListener('pointerdown', (e) => {
          if (RB.editLayout) return;
          e.preventDefault();
          e.stopPropagation();
          if (this.state === 'playing') {
            RB.Sound.init();
            this.togglePause();
          }
        });
      }

      window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if ((k === 'escape' || k === 'p') && (this.state === 'playing' || this.state === 'paused')) {
          e.preventDefault();
          this.togglePause();
        }
        if (k === 'e' && this.state === 'playing') this.input.press('interact');
        if (k === 'q' && this.state === 'playing') this.input.press('record');
        if (k === 'm' && this.state === 'playing') this.openMap();
        if (k === 'r' && this.state === 'playing') this.input.press('reload');
        if (k === 'f' && this.state === 'playing') this.input.press('flashlight');
        if (k === ' ' && this.state === 'playing') this.input.press('jump');
        if (k === 'x' && this.state === 'playing') this.input.press('melee');
        if (k === 'l' && this.state === 'playing') this.input.press('laser');
        if (/^[1-5]$/.test(k) && this.state === 'playing') {
          const id = RB.WeaponOrder[parseInt(k, 10) - 1];
          if (id) this.player.switchWeapon(id);
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'playing') this.togglePause();
      });
    }

    /* ---------------- новая игра / продолжение ---------------- */
    newGame(ngplus) {
      const ng = RB.store.get('rb_ngplus', null);
      this.seedText = String(RB.randInt(100000, 999999));
      this.chapterIndex = 1;
      this.playTime = 0;
      this.kills = 0;
      this.deaths = 0;
      this.notesRead = new Set(ngplus && ng && ng.notes ? ng.notes : []);
      this.endingsUnlocked = [];
      this.flags = {};
      this.carry = null;
      this.resumeRun = null;
      this.checkpoint = null;
      this.rpg = (ngplus && ng && ng.rpg) ? ng.rpg
        : { xp: 0, level: 1, points: 0, upgrades: { hp: 0, stamina: 0, attention: 0, damage: 0, meds: 0, leg: 0 } };
      this.save = null;
      RB.store.del('rb_save');

      this.state = 'card';
      this.ui.showHUD();
      this.ui.showSequence({
        kicker: (RB.I18n && RB.I18n.lang === 'en') ? 'PROLOGUE' : 'ПРОЛОГ',
        title: (RB.I18n && RB.I18n.lang === 'en') ? 'THE LETTER' : 'ПИСЬМО',
        subtitle: (RB.I18n && RB.I18n.lang === 'en') ? 'BARREL PLANT · OCTOBER 1994' : 'ЗАВОД «БОЧКА» · ОКТЯБРЬ 1994',
        lines: (RB.L && RB.I18n && RB.I18n.lang === 'en') ? RB.EN.prologue : RB.Story.prologue,
        button: (RB.I18n && RB.I18n.lang === 'en') ? 'ARRIVE' : 'ПРИЕХАТЬ',
        onDone: () => this.startChapter(1)
      });
    }

    continueGame() {
      const s = this.save;
      if (!s) return this.newGame();
      this.seedText = s.seedText;
      this.chapterIndex = s.chapter || 1;
      this.notesRead = new Set(s.notes || []);
      this.flags = s.flags || {};
      this.carry = s.carry || null;
      this.resumeRun = s.run || null;
      this.rpg = s.rpg || { xp: 0, level: 1, points: 0, upgrades: { hp: 0, stamina: 0, attention: 0, damage: 0, meds: 0, leg: 0 } };
      this.playTime = s.playTime || 0;
      this.kills = s.kills || 0;
      this.deaths = s.deaths || 0;
      this.startChapter(this.chapterIndex);
    }

    loadSave() {
      let s = RB.store.get('rb_save', null);
      if (!s || typeof s !== 'object') return null;
      if (!s.version) s.version = 1;
      if (s.version < 2) {
        s.version = 2;
        s.checkpoint = s.checkpoint || null;
        s.carry = s.carry || null;
        s.rpg = s.rpg || { xp: 0, level: 1, points: 0, upgrades: { hp: 0, stamina: 0, attention: 0, damage: 0, meds: 0, leg: 0 } };
        if (!Array.isArray(s.notes)) s.notes = [];
        if (!s.flags || typeof s.flags !== 'object') s.flags = {};
      }
      if (s.version < 3) {
        s.version = 3;
        s.inv = s.inv || null;
        s.outfit = s.outfit || null;
        s.npcState = s.npcState || null;
        s.explored = s.explored || {};
      }
      if (s.inv && RB.Items) {
        for (const key of ['backpack', 'pockets', 'rps']) {
          const c = s.inv[key];
          if (!c || !c.items) continue;
          for (const it of c.items) {
            const d = RB.Items.get(it.id);
            if (d && !it.kind) { it.kind = d.kind; it.w = d.w; it.h = d.h; }
            if (d && d.kind === 'ammo' && !it.family) { it.family = d.family || d.ammo; it.ammo = d.ammo; }
            if (d && d.kind === 'mag') {
              it.cap = it.cap || d.cap;
              it.ammo = it.ammo || d.ammo;
              it.forWeapon = it.forWeapon || d.forWeapon;
              if (it.rounds == null) it.rounds = 0;
            }
            if (d && d.kind === 'weapon' && !it.weapon) it.weapon = d.weapon;
            if (d && d.kind === 'weapon' && d.noMag && !it.noMag) { it.noMag = true; it.cap = d.cap || 1; it.internalRounds = it.internalRounds || 0; }
          }
        }
      }
      RB.store.set('rb_save', s);
      if (!s.chapter || s.chapter < 1 || s.chapter > 5) return null;
      return s;
    }

    saveProgress() {
      if (!this.chapter || !this.chapter.id || this.state === 'menu' || this.state === 'card') return;
      const canRun = this.world && this.player && !this.inIso && this.state !== 'dead' && this.state !== 'ending';
      if (this.save) RB.store.set('rb_save_backup', this.save);
      this.save = {
        version: 3,
        updated: Date.now(),
        chapter: this.chapterIndex,
        seedText: this.seedText,
        notes: Array.from(this.notesRead),
        flags: this.flags,
        carry: this.carry,
        rpg: this.rpg,
        inv: this.player ? this.player.inv : null,
        outfit: this.player ? this.player.outfit : null,
        npcState: this.npcState || null,
        explored: this.explored || null,
        run: canRun ? this.captureRun() : (this.save && this.save.run) || null,
        playTime: this.playTime,
        kills: this.kills,
        deaths: this.deaths
      };
      RB.store.set('rb_save', this.save);
    }

    captureRun() {
      const w = this.world;
      const p = this.player;
      if (!w || !p) return null;
      return {
        v: 1,
        chapter: this.chapterIndex,
        seed: this.seedText,
        grid: w.grid.map((row) => row.join('')),
        goals: this.goals.map((x) => ({ have: x.have, done: x.done })),
        player: {
          x: p.x, y: p.y, angle: p.angle,
          hp: p.hp, stamina: p.stamina, attention: p.attention,
          battery: p.battery, flashlight: p.flashlight,
          weapon: p.weapon, owned: p.owned, mags: p.mags, reserves: p.reserves,
          laser: p.laser, laserOwned: p.laserOwned, tokens: p.tokens,
          adrenaline: p.adrenaline, painkiller: p.painkiller,
          saltVision: p.saltVision, bleed: p.bleed, records: p.records,
          drug: p.drug, maxHpBase: p.maxHpBase
        },
        objects: w.objects.map((o) => ({
          taken: !!o.taken,
          triggered: !!o.triggered,
          pressed: !!o.pressed,
          done: !!o.done,
          on: !!o.on,
          stock: o.stock ? o.stock.map((s) => !!s.sold) : null
        })),
        enemies: w.enemies.map((e) => ({
          type: e.type, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp,
          dead: !!e.dead, reviveTimer: e.reviveTimer || 0,
          pinned: e.pinned || 0, burning: e.burning || 0,
          state: e.state, limbs: Object.assign({}, e.limbs),
          collectMode: !!e.collectMode, alertTimer: e.alertTimer || 0
        })),
        limbs: (w.limbs || []).map((l) => ({
          limb: l.limb, x: l.x, y: l.y, taken: !!l.taken,
          seed: l.seed, ownerIndex: w.enemies.indexOf(l.owner)
        })),
        salt: w.saltPuddles || [],
        exitLocked: w.exitObj ? !!w.exitObj.locked : true,
        generatorOn: !!w.generatorOn,
        worldTime: w.time,
        playTime: this.playTime,
        kills: this.kills,
        flags: this.flags,
        rpg: this.rpg,
        notes: Array.from(this.notesRead),
        scenesSeen: this.scenesSeen
      };
    }

    applyRun(run) {
      if (!run || !run.grid || run.chapter !== this.chapterIndex) return false;
      const w = this.world;
      const p = this.player;
      if (!w || !p) return false;

      w.grid = run.grid.map((row) => row.split(''));
      if (run.goals) {
        run.goals.forEach((saved, i) => {
          if (this.goals[i]) {
            this.goals[i].have = saved.have;
            this.goals[i].done = saved.done;
          }
        });
      }

      if (run.objects) {
        run.objects.forEach((saved, i) => {
          const o = w.objects[i];
          if (!o) return;
          o.taken = saved.taken;
          o.triggered = saved.triggered;
          if (saved.pressed != null) o.pressed = saved.pressed;
          if (saved.done != null) o.done = saved.done;
          if (saved.on != null) o.on = saved.on;
          if (o.stock && saved.stock) saved.stock.forEach((sold, k) => { if (o.stock[k]) o.stock[k].sold = sold; });
        });
      }

      if (run.enemies) {
        w.enemies = run.enemies.map((s) => {
          const e = new RB.Enemy(s.type, s.x, s.y);
          e.x = s.x; e.y = s.y;
          e.hp = s.hp; e.maxHp = s.maxHp || e.maxHp;
          e.dead = !!s.dead;
          e.reviveTimer = s.reviveTimer || 0;
          e.pinned = s.pinned || 0;
          e.burning = s.burning || 0;
          e.state = s.state || 'idle';
          e.alertTimer = s.alertTimer || 0;
          if (s.limbs) e.limbs = Object.assign({}, s.limbs);
          e.collectMode = !!s.collectMode;
          return e;
        });
      }

      w.limbs = (run.limbs || []).map((s) => ({
        kind: 'limb', limb: s.limb, x: s.x, y: s.y, taken: !!s.taken,
        seed: s.seed || 0,
        owner: w.enemies[s.ownerIndex] || null
      }));
      for (const e of w.enemies) {
        e.collectParts = w.limbs.filter((l) => l.owner === e);
      }

      w.saltPuddles = run.salt || [];
      w.time = run.worldTime || 0;
      if (w.exitObj) w.exitObj.locked = run.exitLocked !== false;
      w.generatorOn = !!run.generatorOn;

      if (run.player) {
        const s = run.player;
        p.x = s.x; p.y = s.y; p.angle = s.angle;
        p.hp = RB.clamp(s.hp, 1, p.maxHp);
        p.stamina = s.stamina;
        p.attention = s.attention;
        p.battery = s.battery;
        p.flashlight = s.flashlight;
        p.weapon = s.weapon;
        p.owned = Object.assign({ pistol: true }, s.owned || {});
        p.mags = Object.assign({}, s.mags || p.mags);
        p.reserves = Object.assign({}, s.reserves || p.reserves);
        p.laser = !!s.laser;
        p.laserOwned = !!s.laserOwned;
        p.tokens = s.tokens != null ? s.tokens : p.tokens;
        p.adrenaline = s.adrenaline || 0;
        p.painkiller = s.painkiller || 0;
        p.saltVision = s.saltVision || 0;
        p.bleed = s.bleed || 0;
        p.records = s.records || 0;
        if (s.drug) p.drug = s.drug;
        if (s.maxHpBase) p.maxHpBase = s.maxHpBase;
        if (this.applyDrugStats) this.applyDrugStats();
      }

      this.playTime = run.playTime || this.playTime;
      this.kills = run.kills || 0;
      if (run.flags) this.flags = run.flags;
      if (run.rpg) this.rpg = run.rpg;
      if (run.notes) this.notesRead = new Set(run.notes);
      if (run.scenesSeen) this.scenesSeen = run.scenesSeen;

      this.lastRoom = null;
      this.renderer.cam = null;
      this.renderer.staticCanvas = null;
      this.renderer.staticWorld = null;
      return true;
    }

    /* ---------------- загрузка главы ---------------- */
    startChapter(n) {
      const story = RB.Story.chapters;
      const idx = RB.clamp(n, 1, story.length);
      const chapter = RB.L ? RB.L.chapter(story[idx - 1]) : story[idx - 1];

      let level = null;
      let seedNum = RB.hashSeed(this.seedText + ':ch' + chapter.id);
      for (let attempt = 0; attempt < 8 && !level; attempt++) {
        level = RB.Gen.generate(chapter, seedNum + attempt * 7919);
      }
      if (!level) {
        this.ui.toast('ОШИБКА ГЕНЕРАЦИИ УРОВНЯ');
        return;
      }

      this.chapter = chapter;
      this.chapterIndex = chapter.id;
      this.inIso = false;
      this.world = new RB.World(level);
      this.world.playerRef = this.player;
      this.world.darkness = RB.PlatformMode ? Math.min((chapter.gen && chapter.gen.darkness) || 0.85, 0.36) : ((chapter.gen && chapter.gen.darkness) || 0.92);
      this.player = new RB.Player(level.start.x, level.start.y);
      this.player.game = this;
      if (this.save && this.save.inv) {
        this.player.inv = this.save.inv;
        this.player.outfit = this.save.outfit || {};
        this.applyOutfit(this.player);
        this.syncAmmo(this.player);
      } else if (!this.player.inv) {
        this.initInventory(this.player);
      }
      this.initNpcState();
      this.enemyDamageMul = 1 + (this.flags.cultMercy || 0) * 0.1;
      this.refreshRecordButton();
      this.player.maxHpBase = this.player.maxHp;
      if (!this.player.drug) this.player.drug = { doses: 0, penalty: 0, relief: 0, tick: 0, boost: 0 };
      this.player.drugCap = 1;
      this.player.drugDamage = 1;
      this.input.resetSticks();
      this.applyRpg();
      if (this.carry) this.applyCarry(this.carry);
      this.goals = (chapter.goals || []).map((g) => ({
        type: g.type,
        item: g.item,
        text: g.text,
        need: g.count || 1,
        have: 0,
        done: false
      }));
      this.tracers = [];
      this.lastRoom = null;
      this.whisperTimer = RB.rand(20, 40);
      this.mimicSpawned = false;
      this.ambientTimer = RB.rand(40, 90);
      this.renderer.cam = null;
      this.renderer.staticCanvas = null;
      this.renderer.staticWorld = null;

      this.saveProgress();

      this.state = 'card';
      this.ui.showHUD();
      this.ui.updateHUD(this);
      let resumed = false;
      if (this.resumeRun) {
        const run = this.resumeRun;
        this.resumeRun = null;
        try { resumed = this.applyRun(run); } catch (e) { resumed = false; }
      }
      if (resumed) {
        this.saveProgress();
        this.state = 'playing';
        this.ui.showHUD();
        this.ui.updateHUD(this);
        this.ui.toast('СМЕНА ПРОДОЛЖЕНА');
        const roomR = this.world.roomAt(this.player.x, this.player.y);
        if (roomR) { this.lastRoom = roomR; this.ui.roomName(roomR.name); }
        return;
      }

      const sceneMap = {
        1: ['procession'],
        2: ['conveyor', 'capture', 'cell', 'interrogation', 'escape'],
        3: ['mother'],
        4: ['cult'],
        5: ['asya']
      };
      const sceneIds = sceneMap[chapter.id] || [];

      const enter = () => {
        this.state = 'playing';
        this.ui.showHUD();
        this.ui.updateHUD(this);
        const room = this.world.roomAt(this.player.x, this.player.y);
        if (room) {
          this.ui.roomName(room.name);
          this.lastRoom = room;
          this.discoverRoom(room);
        }
        const tip = RB.pick((RB.EN && RB.I18n && RB.I18n.lang === 'en') ? RB.EN.tips : RB.Story.tips);
        setTimeout(() => this.ui.subtitle(tip, 5), 1800);
      };

      this.ui.showChapterCard(chapter, () => {
        const playNext = (idx) => {
          while (idx < sceneIds.length && this.scenesSeen[sceneIds[idx]]) idx++;
          if (idx >= sceneIds.length) { enter(); return; }
          const sid = sceneIds[idx];
          const raw = RB.Story.scenes && RB.Story.scenes[sid];
          const sc = RB.L ? RB.L.scene(raw, sid) : raw;
          if (!sc) { playNext(idx + 1); return; }
          this.scenesSeen[sid] = true;
          this.state = 'cutscene';
          RB.Cutscene.play(this.ui, sc, () => {
            this.ui.showHUD();
            if (sid === 'interrogation' && !this.flags.interrogationDone) {
              this.showInterrogationChoice(() => playNext(idx + 1));
              return;
            }
            playNext(idx + 1);
          });
        };
        playNext(0);
      });
    }

    setLowQuality(v, silent) {
      this.lowQuality = !!v;
      RB.store.set('rb_lowq', this.lowQuality);
      this.renderer.lowQuality = this.lowQuality;
      this.renderer.resize();
      document.body.classList.toggle('lowq', this.lowQuality);
      if (!silent) this.ui.toast(this.lowQuality ? 'НИЗКОЕ КАЧЕСТВО' : 'ВЫСОКОЕ КАЧЕСТВО');
    }

    snapshotPlayer() {
      const p = this.player;
      if (!p) return null;
      return {
        hp: p.hp,
        stamina: p.stamina,
        battery: p.battery,
        flashlight: p.flashlight,
        weapon: p.weapon,
        owned: Object.assign({}, p.owned),
        mags: Object.assign({}, p.mags),
        reserves: Object.assign({}, p.reserves),
        laser: p.laser,
        laserOwned: p.laserOwned,
        tokens: p.tokens
      };
    }

    applyCarry(c) {
      const p = this.player;
      if (!p || !c) return;
      p.maxHp = Math.max(p.maxHp, c.hp || p.maxHp);
      p.hp = RB.clamp(c.hp != null ? c.hp : p.hp, 1, p.maxHp);
      p.stamina = RB.clamp(c.stamina != null ? c.stamina : p.stamina, 0, 100);
      p.battery = RB.clamp(c.battery != null ? c.battery : p.battery, 0, 100);
      p.flashlight = c.flashlight !== false;
      p.owned = Object.assign({ pistol: true }, c.owned || {});
      p.mags = Object.assign({}, c.mags || p.mags);
      p.reserves = Object.assign({}, c.reserves || p.reserves);
      p.laser = !!c.laser;
      p.laserOwned = !!c.laserOwned;
      p.tokens = c.tokens != null ? c.tokens : p.tokens;
      if (!p.owned[p.weapon]) p.weapon = 'pistol';
      if (c.weapon) p.weapon = c.weapon;
    }

    applyRpg() {
      const p = this.player;
      if (!p) return;
      const u = this.rpg.upgrades;
      if (u.leg == null) u.leg = 0;
      p.maxHp = 100 + u.hp * 15;
      p.hp = p.maxHp;
      p.damageMul = 1 + u.damage * 0.08;
      p.attentionMul = Math.pow(0.9, u.attention);
      p.medBonus = u.meds * 8;
      p.staminaRegen = 1 + u.stamina * 0.15;
      p.legPower = 1 + u.leg * 0.25;
      p.opm = u.leg >= 4;
      p.bald = u.leg >= 4;
      p.cape = u.leg >= 4;
    }

    addXp(n) {
      this.rpg.xp += n;
      let need = 60 + this.rpg.level * 40;
      while (this.rpg.xp >= need) {
        this.rpg.xp -= need;
        this.rpg.level++;
        this.rpg.points++;
        need = 60 + this.rpg.level * 40;
        this.ui.toast('УРОВЕНЬ ' + this.rpg.level + ' · +1 ОЧКО');
        RB.Sound.play('stinger');
      }
      this.saveProgress();
    }

    buyUpgrade(key) {
      if (this.rpg.points <= 0) {
        RB.Sound.play('deny');
        return false;
      }
      const prevLeg = this.rpg.upgrades.leg || 0;
      if (key === 'leg' && prevLeg >= 4) {
        this.ui.toast('СИЛА НОГИ НА МАКСИМУМЕ');
        RB.Sound.play('deny');
        return false;
      }
      this.rpg.points--;
      this.rpg.upgrades[key] = (this.rpg.upgrades[key] || 0) + 1;
      this.applyRpg();
      if (this.player) this.player.hp = this.player.maxHp;
      if (key === 'leg' && this.rpg.upgrades.leg >= 4 && prevLeg < 4) {
        this.ui.toast('СИЛА НОГИ MAX · ТЫ ЛЫСЫЙ');
        this.ui.subtitle('Плащ найден в шкафу. Лысина — прилагается. Один удар — и смена закончится.', 4);
        RB.Sound.play('stinger');
      } else {
        this.ui.toast('ПРОКАЧКА: ' + key.toUpperCase() + ' · УР.' + this.rpg.upgrades[key]);
      }
      this.saveProgress();
      RB.Sound.play('pickup');
      return true;
    }

    /* ---------------- пауза и меню ---------------- */
    togglePause() {
      if (this.state === 'playing') {
        RB.Voice.stop();
        this.input.left.active = false;
        this.input.right.active = false;
        this.saveProgress();
        this.state = 'paused';
        this.ui.showPause(this.getStats(), '#' + this.seedText);
        RB.Sound.play('ui');
      } else if (this.state === 'paused') {
        this.resume();
      }
    }

    enterIso(door) {
      if (this.inIso) return;
      this.player.hidden = false;
      this.inIso = true;
      this.refreshRecordButton();
      this.isoReturn = {
        world: this.world,
        x: this.player.x, y: this.player.y,
        chapter: this.chapterIndex
      };
      const data = RB.IsoGen.generate(this.chapter, (door.seed || 1) + this.chapterIndex * 977);
      this.world = new RB.World(data);
      this.world.playerRef = this.player;
      this.world.mode = 'iso';
      this.world.darkness = 0.34;
      this.player.x = data.start.x;
      this.player.y = data.start.y;
      this.player.vx = 0; this.player.vy = 0;
      this.player.onGround = true;
      this.renderer.cam = null;
      this.renderer.staticCanvas = null;
      this.renderer.staticWorld = null;
      this.ui.roomName('КОМНАТА');
      RB.Sound.play('door');
    }

    enterSecret(o) {
      if (this.inIso) return;
      o.taken = true;
      this.flags['secret_' + this.chapter.id] = (this.flags['secret_' + this.chapter.id] || 0) + 1;
      this.flags.secret_found = true;
      this.isoReturn = {
        world: this.world,
        x: this.player.x, y: this.player.y,
        chapter: this.chapterIndex
      };
      const data = RB.IsoGen.generate(this.chapter, (o.tx * 97 + this.chapterIndex * 131) >>> 0);
      data.objects.push({
        kind: 'cache', tx: 12, ty: 6,
        x: 12 * 48 + 24, y: 6 * 48 + 24,
        taken: false, label: 'ТАЙНИК'
      });
      data.objects.push({
        kind: 'clue', tx: 13, ty: 7,
        x: 13 * 48 + 24, y: 7 * 48 + 24,
        taken: false, label: 'УЛИКА'
      });
      // ключ-карта от консоли смены — всегда в тайной комнате
      let cardSpot = null;
      for (let y = 4; y < data.h - 2 && !cardSpot; y++) {
        for (let x = 3; x < data.w - 3; x++) {
          if (data.grid[y][x] !== '.') continue;
          if (x === 12 && y === 6) continue;
          if (x === 13 && y === 7) continue;
          cardSpot = { tx: x, ty: y };
          break;
        }
      }
      if (cardSpot) {
        data.objects.push({
          kind: 'item', item: 'keycard_' + this.chapter.id,
          tx: cardSpot.tx, ty: cardSpot.ty,
          x: cardSpot.tx * 48 + 24, y: cardSpot.ty * 48 + 24,
          taken: false, label: 'КЛЮЧ-КАРТА'
        });
      }
      this.world = new RB.World(data);
      this.world.playerRef = this.player;
      this.world.mode = 'iso';
      this.world.darkness = 0.4;
      this.player.x = data.start.x;
      this.player.y = data.start.y;
      this.player.vx = 0; this.player.vy = 0;
      this.inIso = true;
      this.state = 'playing';
      this.refreshRecordButton();
      this.renderer.cam = null;
      this.renderer.staticCanvas = null;
      this.renderer.staticWorld = null;
      this.ui.showHUD();
      this.ui.toast('СЕКРЕТНАЯ КОМНАТА');
      RB.Sound.play('door');
      this.saveProgress();
    }

    hasKeycard(chapterId) {
      const id = 'keycard_' + chapterId;
      const p = this.player;
      if (!p || !p.inv) return false;
      for (const key of ['backpack', 'pockets', 'rps']) {
        if (p.inv[key] && p.inv[key].items.some((it) => it.id === id)) return true;
      }
      return false;
    }

    removeKeycard(chapterId) {
      const id = 'keycard_' + chapterId;
      const p = this.player;
      for (const key of ['backpack', 'pockets', 'rps']) {
        const c = p.inv[key];
        if (!c) continue;
        const it = c.items.find((x) => x.id === id);
        if (it) { RB.Inv.remove(c, it); return true; }
      }
      return false;
    }

    openMail(o) {
      const ch = o.chapter || this.chapter.id;
      const mails = (RB.Story.mail && RB.Story.mail[ch]) || [];
      this.flags['mail_' + ch] = true;
      this.flags.mail_read = true;
      this.state = 'paused';
      const back = () => {
        this.state = 'playing';
        this.ui.showHUD();
        this.ui.updateHUD(this);
        this.input.pressed = Object.create(null);
        this.saveProgress();
      };
      this.ui.showMail(mails, back);
    }

    openConsole(o) {
      const ch = o.chapter || this.chapter.id;
      const logs = (RB.Story.consoleLogs && RB.Story.consoleLogs[ch]) || [];
      if (this.flags['console_' + ch]) {
        this.state = 'paused';
        this.ui.showConsoleLogs(logs, () => {
          this.state = 'playing';
          this.ui.showHUD();
          this.ui.updateHUD(this);
          this.input.pressed = Object.create(null);
        });
        return;
      }
      if (!this.hasKeycard(ch)) {
        this.ui.toast(RB.Story.terminalHints ? RB.Story.terminalHints.consoleLocked : 'НУЖНА КЛЮЧ-КАРТА');
        RB.Sound.play('deny');
        return;
      }
      this.state = 'minigame';
      this.ui.hud.classList.add('hidden');
      this.ui.touch.classList.add('hidden');
      RB.Minigames.start('hack', (ok) => {
        this.state = 'playing';
        this.ui.showHUD();
        this.ui.updateHUD(this);
        this.input.pressed = Object.create(null);
        if (!ok) return;
        this.removeKeycard(ch);
        this.player.tokens += 15;
        this.grantOrDrop('salt', 3);
        this.flags['console_' + ch] = true;
        this.flags.console_hacked = true;
        this.ui.toast('КОНСОЛЬ ВСКРЫТА · +15 ТАЛОНОВ · +3 СОЛЬ-13');
        this.ui.subtitle('На экране мигнуло: «ACCESS GRANTED». Где-то внизу остановился конвейер.', 3.5);
        RB.Sound.play('stinger');
        this.saveProgress();
      }, { chapter: ch, logs });
    }

    openCraftTable(o) {
      const p = this.player;
      if (!p || p.battery < 5) { this.ui.toast('НУЖЕН ЗАРЯД ФОНАРЯ · 5%'); RB.Sound.play('deny'); return; }
      p.battery = RB.clamp(p.battery - 5, 0, 100);
      this.state = 'paused';
      this.craftReturn = 'table';
      this.ui.showCraft(this, () => {
        this.state = 'playing';
        this.ui.showHUD();
        this.ui.updateHUD(this);
        this.saveProgress();
      });
    }

    openStash(o) {
      if (o.taken) return;
      const p = this.player;
      const lock = (() => {
        for (const key of ['backpack', 'pockets', 'rps']) {
          const it = p.inv[key].items.find((x) => x.id === 'lockpick' && (x.uses == null || x.uses > 0));
          if (it) return { item: it, container: p.inv[key] };
        }
        return null;
      })();
      if (!lock) { this.ui.toast('НУЖНА ОТМЫЧКА'); RB.Sound.play('deny'); return; }
      this.state = 'minigame';
      this.ui.hud.classList.add('hidden');
      this.ui.touch.classList.add('hidden');
      RB.Minigames.start('lockpick', (ok) => {
        this.state = 'playing';
        this.ui.showHUD();
        this.ui.updateHUD(this);
        lock.item.uses = (lock.item.uses == null ? 4 : lock.item.uses) - 1;
        if (lock.item.uses <= 0) RB.Inv.remove(lock.container, lock.item);
        if (!ok) { this.ui.toast('ОТМЫЧКА СЛОМАЛАСЬ'); this.saveProgress(); return; }
        o.taken = true;
        const tier = o.tier || 1;
        const table = tier >= 3 ? RB.Items.loot.stash_hard : tier === 2 ? RB.Items.loot.stash_mid : RB.Items.loot.stash_easy;
        const picks = 2 + tier;
        for (let i = 0; i < picks; i++) {
          const id = table[Math.floor(Math.random() * table.length)];
          const count = id === 'tokens' ? 4 : 1;
          if (this.addItem(id, count) === false) {
            this.world.objects.push({
              kind: 'item', item: id, count,
              x: o.x + RB.rand(-16, 16), y: o.y + RB.rand(-4, 6),
              tx: o.tx, ty: o.ty, taken: false, label: id
            });
          }
        }
        this.flags.stashes = (this.flags.stashes || 0) + 1;
        RB.Sound.play('pickup');
        this.ui.toast('ТАЙНИК ВСКРЫТ');
        this.saveProgress();
      }, o.tier || 1);
    }

    openRescue(o) {
      if (o.taken) return;
      o.taken = true;
      this.flags.rescued = (this.flags.rescued || 0) + 1;
      this.player.tokens += 4;
      this.player.attention = RB.clamp(this.player.attention - 12, 0, 100);
      this.ui.toast('РАБОЧИЙ СПАСЁН · +4 ТАЛОНА');
      this.ui.subtitle('Он не говорит. Он показывает наверх и считает до девяти.', 3.5);
      RB.Sound.play('pickup');
      this.saveProgress();
      this.ui.updateHUD(this);
    }

    exitIso() {
      if (!this.inIso || !this.isoReturn) return;
      this.world = this.isoReturn.world;
      this.player.x = this.isoReturn.x;
      this.player.y = this.isoReturn.y;
      this.player.vx = 0; this.player.vy = 0;
      this.player.onGround = true;
      this.inIso = false;
      this.refreshRecordButton();
      this.renderer.cam = null;
      this.renderer.staticCanvas = null;
      this.renderer.staticWorld = null;
      this.ui.toast('НАРУЖУ');
      RB.Sound.play('door');
    }

    bossEnemy() {
      return this.world && this.world.enemies.find((e) => e.def && e.def.isBoss && !e.dead);
    }

    useTrap(o) {
      const boss = this.bossEnemy();
      if (!boss) {
        this.ui.toast('ЛЕБЁДКА ПУСТА');
        return;
      }
      if (RB.dist(o.x, o.y, boss.x, boss.y) > 170) {
        RB.Sound.play('deny');
        this.ui.toast('НУЖНО ЗАМАНИТЬ ЕГО БЛИЖЕ');
        return;
      }
      boss.dead = true;
      boss.reviveTimer = 0;
      this.flags.bossDead = true;
      this.world.kills++;
      this.addXp(80);
      RB.Sound.play('stamp');
      this.shake(8, 0.4);
      this.ui.toast('ЛЕБЁДКА ЗАКРЫТА. НАДЗИРАТЕЛЬ ЗАПЕРТ');
      this.ui.subtitle('Он бьёт по металлу. Металл не отвечает.', 4);
    }

    hasItem(id) {
      const p = this.player;
      if (!p || !p.inv) return false;
      for (const key of ['backpack', 'pockets', 'rps']) {
        if (p.inv[key].items.some((it) => it.id === id)) return true;
      }
      return false;
    }

    bossGateState() {
      const key = this.hasItem('key_boss');
      const talk = !!this.flags['bossTalk_' + this.chapter.id];
      const goals = this.allGoalsDone();
      return { key, talk, goals, ready: key && talk && goals };
    }

    talkBoss(o) {
      const gate = this.bossGateState();
      if (o.bossDefeated || this.flags['bossDefeated_' + this.chapter.id]) {
        this.ui.toast('ЗДЕСЬ БОЛЬШЕ НЕКОГО ЖДАТЬ');
        return;
      }
      if (gate.ready) { this.startBossFight(o); return; }
      this.state = 'boss';
      const en = RB.I18n && RB.I18n.lang === 'en';
      const st = gate;
      const missing = [];
      if (!st.key) missing.push(en ? 'boss room key' : 'ключ от арены');
      if (!st.talk) missing.push(en ? 'failed negotiation' : 'провал переговоров');
      if (!st.goals) missing.push(en ? 'main objective' : 'главный квест');
      const buttons = [];
      buttons.push({
        label: en ? 'TRY TO NEGOTIATE' : 'ПОПРОБОВАТЬ ДОГОВОРИТЬСЯ',
        onClick: () => {
          this.flags['bossTalk_' + this.chapter.id] = true;
          this.flags['bossRefused_' + this.chapter.id] = true;
          this.player.attention = RB.clamp(this.player.attention + 20, 0, 100);
          this.ui.toast(en ? 'HE REFUSED' : 'ОН ОТКАЗАЛ');
          this.ui.subtitle(en ? '«You will not pass. Not as yourself.»' : '«Ты не пройдёшь. Не как ты».', 3.5);
          this.saveProgress();
          this.state = 'playing';
          this.ui.closeModal();
          this.ui.showHUD();
        }
      });
      buttons.push({
        label: en ? 'FIGHT (LOCKED)' : 'ДРАТЬСЯ (ЗАКРЫТО)',
        disabled: true,
        onClick: () => {}
      });
      buttons.push({ label: en ? 'BACK AWAY' : 'ОТОЙТИ', onClick: () => { this.state = 'playing'; this.ui.closeModal(); this.ui.showHUD(); } });
      this.ui.openModal({
        kicker: this.chapter.gen.bossType === 'mat' ? (en ? 'MOTHER OF THE SHIFT' : 'МАТЬ СМЕНЫ') : (en ? 'BOSS ROOM' : 'КОМНАТА БОССА'),
        title: en ? 'NEGOTIATION' : 'ПЕРЕГОВОРЫ',
        subtitle: en ? 'The gate is sealed. He is waiting.' : 'Ворота запечатаны. Он ждёт.',
        stalker: true,
        name: en ? 'BOSS' : 'БОСС',
        meta: (en ? 'MISSING: ' : 'НЕ ХВАТАЕТ: ') + missing.join(', '),
        portrait: '#5a2a1a',
        portraitPath: RB.Assets ? RB.Assets.portrait('boss') : null,
        numbered: true,
        lines: en
          ? ['«You came for the shift. The shift is already yours».', 'He does not move. The barrel behind him breathes.']
          : ['«Ты пришёл за сменой. Смена уже твоя».', 'Он не двигается. Бочка за его спиной дышит.'],
        hint: false,
        buttons
      });
    }

    startBossFight(o) {
      const data = RB.IsoGen.generate(this.chapter, (o.tx * 131 + this.chapterIndex * 977) >>> 0);
      data.objects = (data.objects || []).filter((it) => it.kind !== 'isoExit');
      data.enemies = [];
      const btype = o.bossType || this.chapter.gen.bossType || 'boss';
      data.enemies.push({ type: btype, tx: 9, ty: 4, x: 9 * 48 + 24, y: 4 * 48 + 24 });
      this.isoReturn = {
        world: this.world, x: this.player.x, y: this.player.y,
        chapter: this.chapterIndex, boss: true
      };
      this.world = new RB.World(data);
      this.world.playerRef = this.player;
      this.world.mode = 'iso';
      this.world.darkness = 0.48;
      this.world.bossFight = true;
      this.world.bossType = btype;
      this.player.x = data.start.x;
      this.player.y = data.start.y;
      this.player.vx = 0; this.player.vy = 0;
      this.inIso = true;
      this.state = 'playing';
      this.refreshRecordButton();
      this.renderer.cam = null;
      this.renderer.staticCanvas = null;
      this.renderer.staticWorld = null;
      this.ui.showHUD();
      this.ui.toast('АРЕНА · ИЗОМЕТРИЯ');
      this.ui.subtitle('Выход закрыт. Только один из вас выйдет отсюда.', 4);
      RB.Sound.play('stinger');
      this.saveProgress();
    }

    winBossFight() {
      const type = this.world.bossType || 'boss';
      this.flags['bossDefeated_' + this.chapter.id] = true;
      this.flags.bossDefeated = true;
      this.player.tokens += 20;
      this.ui.toast('БОСС ПОВЕРЖЕН · +20 ТАЛОНОВ');
      this.addXp(120);
      RB.Sound.play('stinger');
      this.exitIso();
      if (this.world && this.world.exitObj) this.world.exitObj.locked = false;
      this.saveProgress();
    }

    bossEnemy() {
      return this.world && this.world.enemies.find((e) => e.def && e.def.isBoss && !e.dead);
    }

    showInterrogationChoice(done) {
      this.state = 'choice';
      const pick = (kind) => {
        this.flags.interrogation = kind;
        this.flags.interrogationDone = true;
        if (kind === 'agree') {
          this.flags.cultAlliance = true;
          this.ui.toast('ТЫ СОГЛАСИЛСЯ · КУЛЬТ ДОВОЛЕН');
        } else if (kind === 'lie') {
          this.flags.ignatLied = true;
          this.player.attention = RB.clamp(this.player.attention + 10, 0, 100);
          this.ui.toast('ТЫ СОЛГАЛ · СТРЕСС +10');
        } else {
          this.flags.ignatRefused = true;
          this.player.attention = RB.clamp(this.player.attention + 18, 0, 100);
          this.ui.toast('ТЫ ПРОМОЛЧАЛ · СТРЕСС +18');
        }
        this.saveProgress();
        this.state = 'playing';
        this.ui.showHUD();
        this.ui.updateHUD(this);
        done && done();
      };
      this.ui.openModal({
        kicker: 'ДОПРОС · ВЫБОР',
        title: 'ЧТО СКАЗАТЬ ИГНАТУ',
        subtitle: 'ОН ЖДЁТ ОТВЕТА. ПОЛОВНИК ЛЕЖИТ НА ПОЛУ.',
        lines: ['«Скажи, что ты видел бочку №9, и я дам тебе умереть человеком».'],
        hint: false,
        buttons: [
          { label: 'СОВРАТЬ', onClick: () => pick('lie') },
          { label: 'СОГЛАСИТЬСЯ', onClick: () => pick('agree') },
          { label: 'МОЛЧАТЬ', onClick: () => pick('refuse') }
        ]
      });
    }

    openSigil(o) {
      this.state = 'minigame';
      this.ui.hud.classList.add('hidden');
      this.ui.touch.classList.add('hidden');
      RB.Sound.play('paper');
      RB.Minigames.start('sigil', (ok) => {
        this.state = 'playing';
        this.ui.showHUD();
        this.ui.updateHUD(this);
        if (!ok) { this.ui.toast('СИГИЛ НЕ СЛОЖИЛСЯ'); return; }
        o.done = true;
        this.flags['sigil_' + this.chapter.id] = true;
        this.ui.toast('СИГИЛ АКТИВЕН · ЗАМОК СНЯТ');
        RB.Sound.play('stinger');
        if (this.allGoalsDone()) this.unlockExit();
        this.saveProgress();
      });
    }

    openCodeLock(o) {
      this.state = 'paused';
      const code = String(o.code || (o.reqs && o.reqs.code) || '0919');
      let entry = '';
      const render = () => {
        const buttons = [];
        for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
          buttons.push({
            label: d,
            onClick: () => {
              if (entry.length >= 4) return;
              entry += d;
              RB.Sound.play('ui');
              if (entry.length === 4) {
                if (entry === code) {
                  this.flags['code_' + this.chapter.id] = true;
                  o.codeDone = true;
                  this.ui.toast('КОД ПРИНЯТ');
                  RB.Sound.play('stinger');
                  this.state = 'playing';
                  this.ui.showHUD();
                  if (this.allGoalsDone()) this.unlockExit();
                  this.saveProgress();
                  return;
                }
                entry = '';
                RB.Sound.play('deny');
                this.ui.toast('КОД НЕВЕРЕН');
              }
              render();
            }
          });
        }
        buttons.push({ label: 'СБРОС', onClick: () => { entry = ''; render(); } });
        buttons.push({
          label: 'ЗАКРЫТЬ',
          onClick: () => { this.state = 'playing'; this.ui.showHUD(); this.ui.updateHUD(this); }
        });
        this.ui.openModal({
          kicker: 'КОДОВЫЙ ЗАМОК',
          title: 'ТАБЛО',
          subtitle: 'ВВЕДЕНО: ' + (entry.padEnd(4, '·')),
          lines: ['Четыре цифры. На бирке смены выбито 09.19.'],
          hint: false,
          buttons
        });
      };
      render();
    }

    useLever(o) {
      if (o.on) { this.ui.toast('РЫЧАГ УЖЕ ОПУЩЕН'); return; }
      o.on = true;
      this.player.tokens += 2;
      this.flags['lever_' + o.tx + '_' + o.ty] = true;
      RB.Sound.play('stamp');
      this.ui.toast('РЫЧАГ: +2 ТАЛОНА');
      this.shake(3, 0.2);
      this.saveProgress();
    }

    openPuzzle(o) {
      this.state = 'minigame';
      this.ui.hud.classList.add('hidden');
      this.ui.touch.classList.add('hidden');
      RB.Sound.play('paper');
      RB.Minigames.start(o.puzzle, (ok) => {
        this.state = 'playing';
        this.ui.showHUD();
        this.ui.updateHUD(this);
        if (ok === null) return;
        if (!ok) { this.ui.toast('ГОЛОВОЛОМКА ПРОВАЛЕНА'); return; }
        o.done = true;
        this.flags['puzzle_' + o.puzzle] = true;
        this.player.tokens += 4;
        this.ui.toast('ГОЛОВОЛОМКА РЕШЕНА · +4 ТАЛОНА');
        RB.Sound.play('stinger');
        this.saveProgress();
      });
    }

    toggleShelter(o) {
      const p = this.player;
      if (!p) return;
      if (p.hidden) {
        p.hidden = false;
        this.ui.toast('ТЫ ВЫШЕЛ ИЗ УКРЫТИЯ');
      } else {
        p.hidden = true;
        p.x = o.x;
        p.y = o.y - 4;
        p.vx = 0;
        p.vy = 0;
        this.flags.shelterUsed = true;
        this.ui.toast('ТЫ В УКРЫТИИ · ОНИ ТЕБЯ НЕ ВИДЯТ');
      }
      RB.Sound.play('door');
    }

    openGamble(o) {
      this.state = 'gambling';
      const bet = 3;
      const render = (result) => {
        const p = this.player;
        const buttons = [{
          label: 'БРОСИТЬ КОСТИ · ' + bet + ' Т',
          disabled: p.tokens < bet,
          onClick: () => {
            if (p.tokens < bet) return;
            p.tokens -= bet;
            const a = RB.randInt(1, 6), b = RB.randInt(1, 6);
            const c = RB.randInt(1, 6), d = RB.randInt(1, 6);
            const mine = a + b, his = c + d;
            let text;
            if (mine > his) { p.tokens += bet * 2; text = 'ТВОИ ' + mine + ' · ЕГО ' + his + '. ТЫ ВЫИГРАЛ ' + (bet * 2) + ' Т.'; RB.Sound.play('pickup'); }
            else if (mine === his) { text = 'ТВОИ ' + mine + ' · ЕГО ' + his + '. НИЧЬЯ. СТАВКА УХОДИТ.'; RB.Sound.play('deny'); }
            else { text = 'ТВОИ ' + mine + ' · ЕГО ' + his + '. ТЫ ПРОИГРАЛ.'; RB.Sound.play('deny'); }
            this.ui.updateHUD(this);
            render(text);
          }
        }, {
          label: 'УЙТИ',
          onClick: () => {
            this.state = 'playing';
            this.ui.showHUD();
            this.ui.updateHUD(this);
            this.input.pressed = Object.create(null);
          }
        }];
        this.ui.openModal({
          kicker: 'ИГРА В КОСТИ',
          title: 'ТАЛОНЫ: ' + p.tokens,
          subtitle: 'ДВЕ КОСТИ. БОЛЬШЕ — ЗАБИРАЕШЬ.',
          lines: [
            result || 'Стол липкий. Кости стёрты до белых пятен.',
            'Правила простые: больше — забираешь вдвое. Меньше — платишь.',
            'Никто не следит, чтобы ты остановился.'
          ],
          hint: false,
          buttons
        });
      };
      render(null);
    }

    openCache(o) {
      if (o.taken) return;
      o.taken = true;
      const roll = Math.random();
      if (roll < 0.4) { this.player.reserves.pistol = (this.player.reserves.pistol || 0) + 8; this.ui.toast('ТАЙНИК: ПАТРОНЫ'); }
      else if (roll < 0.75) { this.player.tokens += 3; this.ui.toast('ТАЙНИК: +3 ТАЛОНА'); }
      else { this.player.hp = RB.clamp(this.player.hp + 25, 0, this.player.maxHp); this.ui.toast('ТАЙНИК: АПТЕЧКА'); }
      RB.Sound.play('pickup');
      this.saveProgress();
    }

    startElevator(o) {
      if (this.state !== 'playing') return;
      this.player.hidden = false;
      this.player.rideHidden = true;
      this.state = 'elevator';
      this.elevator = {
        o, t: 0, phase: 'open',
        sx: this.player.x, sy: this.player.y
      };
      o.anim = 0;
      this.player.vx = 0;
      this.player.vy = 0;
      this.ui.setPrompt('');
      RB.Sound.play('door');
    }

    updateElevator(dt) {
      const e = this.elevator;
      if (!e) { this.state = 'playing'; return; }
      e.t += dt;
      const o = e.o;
      if (e.phase === 'open') {
        o.anim = RB.clamp(e.t / 0.5, 0, 1);
        if (e.t >= 0.55) { e.phase = 'move'; e.t = 0; }
      } else if (e.phase === 'move') {
        const k = RB.clamp(e.t / 1.1, 0, 1);
        const ease = k * k * (3 - 2 * k);
        this.player.x = e.sx + (o.targetX - e.sx) * ease;
        this.player.y = e.sy + (o.targetY - e.sy) * ease;
        if (k >= 1) {
          e.phase = 'close';
          e.t = 0;
          o.anim = 1;
          this.player.vx = 0;
          this.player.vy = 0;
          RB.Sound.play('stamp');
        }
      } else if (e.phase === 'close') {
        o.anim = RB.clamp(1 - e.t / 0.45, 0, 1);
        if (e.t >= 0.5) {
          o.anim = 0;
          this.elevator = null;
          this.state = 'playing';
          this.player.rideHidden = false;
          if (this.player.onGround !== undefined) this.player.onGround = true;
          this.input.pressed = Object.create(null);
          this.saveProgress();
        }
      }
    }

    npcStock(npc, st) {
      if (st.stock) return st.stock;
      const rnd = RB.mulberry32(RB.hashSeed(this.seedText + ':stock:' + npc.id));
      const pool = RB.ShopPool.filter((it) => it.kind !== 'repair' && it.kind !== 'craft' && it.kind !== 'trade' && it.kind !== 'armor');
      const picked = [];
      const copy = pool.slice();
      while (picked.length < 4 && copy.length) {
        const i = Math.floor(rnd() * copy.length);
        const it = Object.assign({}, copy[i]);
        copy.splice(i, 1);
        if (picked.some((p) => p.id === it.id)) continue;
        it.price = Math.max(2, Math.round(it.price * (0.85 + rnd() * 0.55) + st.level * 0.4));
        picked.push(it);
      }
      st.stock = picked;
      return picked;
    }

    openNpcTrade(npc, st, back) {
      this.state = 'shop';
      const render = () => {
        const stock = this.npcStock(npc, st);
        this.ui.showNpcTrade(npc, st, stock, this.player,
          (item) => {
            if (item.sold) return;
            const price = Math.round(item.price * (st.bargain ? 0.85 : 1));
            if (this.player.tokens < price) { RB.Sound.play('deny'); return; }
            const iid = this.stockItemId(item);
            const added = this.addItem(iid, 1) !== false;
            if (!added) {
              this.dropItemNear(iid, 1);
              this.ui.toast('ИНВЕНТАРЬ ПОЛОН · ПОКУПКА НА ПОЛУ');
            } else if (item.kind === 'weapon') {
              this.player.unlockWeapon(item.weapon);
            }
            this.player.tokens -= price;
            st.currency += price;
            item.sold = true;
            RB.Sound.play('pickup');
            this.saveProgress();
            render();
          },
          (uid) => {
            const f = RB.Inv.findUid(this.player, uid);
            if (!f) return;
            const price = Math.max(1, Math.floor(RB.Items.value(f.item.id) * 0.5));
            if (st.currency < price) { RB.Sound.play('deny'); this.ui.toast('У НЕГО НЕТ ТАЛОНОВ'); return; }
            const d = RB.Items.get(f.item.id);
            const wi = this.getWeaponItem(this.player);
            if (wi && wi.magUid === uid) wi.magUid = null;
            RB.Inv.remove(f.container, f.item);
            this.player.tokens += price;
            st.currency -= price;
            this.ui.toast('ПРОДАНО: ' + (d ? d.name : f.item.id) + ' · +' + price);
            RB.Sound.play('pickup');
            this.saveProgress();
            render();
          },
          () => {
            if (st.bargain) { this.ui.toast('ОН УЖЕ УСТУПИЛ'); return; }
            const chance = 0.35 + st.level * 0.035;
            if (Math.random() < chance) {
              st.bargain = true;
              st.attitude = (st.attitude || 0) + 1;
              this.ui.toast('ТОРГ: СКИДКА 15%');
              RB.Sound.play('ui');
            } else {
              st.attitude = (st.attitude || 0) - 1;
              this.ui.toast('ОН НЕ УСТУПИЛ');
              RB.Sound.play('deny');
            }
            render();
          },
          back);
      };
      render();
    }

    stockItemId(it) {
      if (it.kind === 'ammo') {
        const ammoMap = { pistol: 'ammo_9x18', shotgun: 'ammo_12', ak74: 'ammo_545', flamethrower: 'ammo_flame', harpoon: 'ammo_harpoon' };
        return ammoMap[it.weapon] || 'ammo_9x18';
      }
      if (it.kind === 'weapon') return 'w_' + it.weapon;
      if (it.kind === 'item') return it.item;
      if (it.kind === 'armor') return 'armor_plate';
      return it.id;
    }

    openShop(o) {
      this.state = 'shop';
      const rep = this.cultReputation();
      let discount = rep >= 50 ? 0.8 : rep >= 25 ? 0.9 : 1;
      if (o.faction === 'fishers' && (this.flags.vera || this.flags.timka)) discount = Math.min(discount, 0.9);
      if (o.faction === 'fishers' && o.stock !== RB.FisherShop) {
        o.stock = RB.FisherShop.map((x) => Object.assign({}, x));
      }
      if (discount < 1) {
        for (const it of o.stock) {
          if (!it._disc) { it.origPrice = it.price; it.price = it.price > 0 ? Math.max(1, Math.round(it.price * discount)) : 0; it._disc = true; }
        }
      }
      const render = () => {
        this.ui.showShop(o, this.player.tokens, (it) => this.buyItem(o, it, render), () => {
          this.state = 'playing';
          this.ui.showHUD();
          this.ui.updateHUD(this);
          this.input.pressed = Object.create(null);
        });
      };
      render();
    }

    grantStockItem(it) {
      if (it.kind === 'ammo') {
        const ammoMap = { pistol: ['ammo_9x18', 16], shotgun: ['ammo_12', 8], ak74: ['ammo_545', 30], flamethrower: ['ammo_flame', 40], harpoon: ['ammo_harpoon', 2] };
        const a = ammoMap[it.weapon] || ['ammo_9x18', it.amount || 8];
        return this.addItem(a[0], it.amount || a[1]) !== false;
      } else if (it.kind === 'weapon') {
        const ok = this.addItem('w_' + it.weapon, 1) !== false;
        if (ok) this.player.unlockWeapon(it.weapon);
        return ok;
      } else if (it.kind === 'laser') {
        this.player.laserOwned = true;
        this.player.laser = true;
        return true;
      } else if (it.kind === 'item') {
        return this.addItem(it.item, it.count || 1) !== false;
      } else if (it.kind === 'armor') {
        const armorItem = it.id === 'fish_armor' ? 'coat_fisher' : 'armor_plate';
        return this.addItem(armorItem, 1) !== false;
      } else if (it.kind === 'craft') {
        return this.addItem(it.item, 1) !== false;
      }
      return true;
    }

    stockDropSpec(it) {
      if (it.kind === 'ammo') {
        const ammoMap = { pistol: ['ammo_9x18', 16], shotgun: ['ammo_12', 8], ak74: ['ammo_545', 30], flamethrower: ['ammo_flame', 40], harpoon: ['ammo_harpoon', 2] };
        const a = ammoMap[it.weapon] || ['ammo_9x18', it.amount || 8];
        return [a[0], it.amount || a[1]];
      }
      if (it.kind === 'weapon') return ['w_' + it.weapon, 1];
      if (it.kind === 'item') return [it.item, it.count || 1];
      if (it.kind === 'armor') return [it.id === 'fish_armor' ? 'coat_fisher' : 'armor_plate', 1];
      if (it.kind === 'craft') return [it.item, 1];
      return null;
    }

    buyItem(shop, it, rerender) {
      if (it.sold) return;
      if (it.kind === 'trade' && it.trade === 'photo' && !(this.flags.photos > 0)) {
        RB.Sound.play('deny');
        this.ui.toast('НЕТ ФОТОУЛИК ДЛЯ ОБМЕНА');
        return;
      }
      if (this.player.tokens < it.price) {
        RB.Sound.play('deny');
        return;
      }
      this.player.tokens -= it.price;
      it.sold = true;
      if (it.kind !== 'repair' && it.kind !== 'trade') {
        const ok = this.grantStockItem(it);
        if (!ok) {
          const spec = this.stockDropSpec(it);
          if (spec) this.dropItemNear(spec[0], spec[1]);
          this.ui.toast('ИНВЕНТАРЬ ПОЛОН · ПОКУПКА НА ПОЛУ');
        }
      }
      if (it.kind === 'repair') {
        this.player.legHurt = false;
        this.player.armHurt = false;
        this.player.bleed = 0;
        this.player.hp = this.player.maxHp;
        this.ui.toast('ТРАВМЫ ВЫЛЕЧЕНЫ');
      } else if (it.kind === 'trade' && it.trade === 'photo') {
        this.flags.photos = Math.max(0, (this.flags.photos || 0) - 1);
        if (this.flags.photoList) this.flags.photoList.pop();
        this.player.tokens += it.reward || 6;
        it.sold = false;
        this.ui.toast('УЛИКА СДАНА · +' + (it.reward || 6) + ' ТАЛОНОВ');
      }
      RB.Sound.play('pickup');
      this.saveProgress();
      this.ui.updateHUD(this);
      rerender();
    }

    giveItem(item) {
      const p = this.player;
      if (p && p.inv && RB.Items.get(item)) {
        this.addItem(item, 1);
        return;
      }
      if (item === 'medkit') {
        p.hp = RB.clamp(p.hp + 45 + (p.medBonus || 0), 0, p.maxHp);
        p.legHurt = false;
        p.armHurt = false;
        p.bleed = 0;
      }
      else if (item === 'battery') p.battery = RB.clamp(p.battery + 40, 0, 100);
      else if (item === 'painkiller') p.painkiller = 20;
      else if (item === 'adrenaline') { p.adrenaline = 10; p.stamina = 100; }
      else if (item === 'salt') { p.saltVision = 30; p.attention = RB.clamp(p.attention + 40, 0, 100); }
      else if (item === 'food') { p.hp = RB.clamp(p.hp + 15, 0, p.maxHp); p.stamina = RB.clamp(p.stamina + 20, 0, 100); }
      this.ui.toast(item.toUpperCase());
    }

    openMap() {
      this.state = 'paused';
      this.ui.showMap(this, () => {
        this.state = 'paused';
        this.ui.showPause(this.getStats(), '#' + this.seedText);
      });
    }

    openInventory() {
      this.state = 'paused';
      this.ui.showInventory(this, () => {
        this.state = 'paused';
        this.ui.showPause(this.getStats(), '#' + this.seedText);
      });
    }

    openDev() {
      this.state = 'dev';
      const render = () => {
        this.ui.showDev(this.rpg, (key) => {
          if (this.buyUpgrade(key)) render();
        }, () => {
          this.state = 'paused';
          this.ui.showPause(this.getStats(), '#' + this.seedText);
        });
      };
      render();
    }

    resume() {
      if (!this.world) return;
      this.input.resetSticks();
      this.state = 'playing';
      this.ui.showHUD();
      this.ui.updateHUD(this);
      this.input.pressed = Object.create(null);
    }

    toMenu() {
      RB.Voice.stop();
      RB.Sound.stopAll();
      this.state = 'menu';
      this.world = null;
      this.player = null;
      this.ui.showMenu(!!this.save);
      RB.Sound.ambientTension(0);
    }

    cultReputation() {
      const f = this.flags || {};
      let r = 0;
      if (f.ignat) r += 15;
      if (f.cultAlliance) r += 25;
      if (f.asya) r += 10;
      if (f.zoya) r += 5;
      if (f.ignatRefused) r -= 20;
      if (f.photos) r += Math.min(15, (f.photos || 0) * 3);
      return RB.clamp(r, 0, 100);
    }

    applyLanguage() {
      if (!this.chapter || !RB.L) return;
      const base = RB.Story.chapters[this.chapterIndex - 1];
      if (!base) return;
      const loc = RB.L.chapter(base);
      this.chapter.title = loc.title;
      this.chapter.date = loc.date;
      this.chapter.intro = loc.intro;
      this.chapter.outro = loc.outro;
      if (this.goals && loc.goals) {
        this.goals.forEach((g, i) => { if (loc.goals[i]) g.text = loc.goals[i].text; });
      }
      this.ui.updateHUD(this);
    }

    getStats() {
      return {
        chapter: this.chapterIndex,
        chapterTitle: this.chapter ? this.chapter.title : '',
        time: this.formatTime(this.playTime),
        kills: this.kills,
        notes: this.notesRead.size,
        notesTotal: this.notesTotal,
        attention: this.player ? Math.round(this.player.attention) : 0,
        records: this.player ? this.player.records : 0,
        photos: this.flags.photos || 0,
        cultRep: this.cultReputation(),
        questsDone: Object.keys(this.flags || {}).filter((k) => RB.Story.npcs[k]).length,
        questsTotal: Object.keys(RB.Story.npcs).length,
        questList: Object.values(RB.Story.npcs).map((n) => ({
          name: n.name,
          done: !!this.flags[n.id]
        })),
        caseId: RB.Story.caseId,
        fps: (typeof window !== 'undefined' && window.__rbFps) || 0
      };
    }

    formatTime(t) {
      const s = Math.floor(t);
      return Math.floor(s / 60) + ':' + RB.pad2(s % 60);
    }

    /* ---------------- смерть ---------------- */
    onDeath() {
      if (this.state === 'dead') return;
      RB.Voice.stop();
      this.state = 'dead';
      this.deaths++;
      if (this.player) this.player.hidden = false;
      if (this.save) this.save.run = null;
      this.vibrate(280);
      RB.store.set('rb_save', this.save);
      const boss = this.bossEnemy();
      const byBoss = boss && RB.dist(boss.x, boss.y, this.player.x, this.player.y) < 220;
      const msg = RB.pick((RB.EN && RB.I18n && RB.I18n.lang === 'en') ? RB.EN.deathMessages : RB.Story.deathMessages);
      const showDeath = () => {
        this.ui.showDeath(msg, this.getStats(),
          () => this.startChapter(this.chapterIndex),
          () => this.toMenu()
        );
      };
      const cause = this.deathCause;
      this.deathCause = null;
      const animType = cause === 'suffocation' ? 'suffocation' : (byBoss ? 'barrel' : 'devour');
      const afterAnim = () => {
        if (byBoss && RB.Story.scenes && RB.Story.scenes.bossBarrel) {
          const sc = RB.L ? RB.L.scene(RB.Story.scenes.bossBarrel, 'bossBarrel') : RB.Story.scenes.bossBarrel;
          RB.Cutscene.play(this.ui, sc, showDeath);
        } else {
          showDeath();
        }
      };
      if (RB.DeathAnim) RB.DeathAnim.play(animType, afterAnim);
      else afterAnim();
    }

    /* ---------------- финал ---------------- */
    openFinale() {
      this.state = 'choice';
      RB.Sound.play('stinger');
      const choices = (RB.L ? RB.Story.finaleChoices.map((c) => RB.L.choice(c)) : RB.Story.finaleChoices).map((c) => {
        const needPhotos = c.photos || 0;
        const photos = this.flags.photos || 0;
        const locked = (c.requires || []).some((f) => !this.flags[f]) || photos < needPhotos;
        let hint = c.hint;
        if (photos < needPhotos) hint = 'НУЖНЫ ФОТОУЛИКИ: ' + photos + '/' + needPhotos;
        return Object.assign({}, c, {
          disabled: locked,
          hint: locked
            ? (photos < needPhotos ? hint : 'НУЖНО: ' + (c.requires || []).filter((f) => !this.flags[f])
              .map((f) => (RB.Story.npcs[f] ? RB.Story.npcs[f].name : f)).join(', '))
            : c.hint
        });
      });
      this.ui.showChoice(choices, (id) => this.finishGame(id));
    }

    finishGame(id) {
      RB.Voice.stop();
      try {
        RB.store.set('rb_ngplus', {
          rpg: this.rpg,
          notes: Array.from(this.notesRead),
          endings: this.endingsUnlocked.concat([id])
        });
      } catch (e) {}
      const ending = RB.L ? RB.L.ending(RB.Story.endings.find((e) => e.id === id) || RB.Story.endings[0])
        : (RB.Story.endings.find((e) => e.id === id) || RB.Story.endings[0]);
      this.state = 'ending';
      this.endingsUnlocked = Array.from(new Set(this.endingsUnlocked.concat([id])));
      RB.store.set('rb_endings', this.endingsUnlocked);
      RB.store.del('rb_save');
      this.save = null;
      RB.Sound.play('death');
      const scene = RB.Story.endingScenes && RB.Story.endingScenes[id];
      const locScene = scene && RB.L ? RB.L.endingScene(scene, id) : scene;
      const show = () => this.ui.showEnding(ending, () => this.toMenu());
      if (locScene) {
        this.state = 'cutscene';
        RB.Cutscene.play(this.ui, locScene, show);
      } else {
        show();
      }
    }

    /* ---------------- цели ---------------- */
    goalFor(item) {
      return this.goals.find((g) => g.item === item && !g.done);
    }

    allGoalsDone() {
      return this.goals.every((g) => g.done);
    }

    onQuestPickup(item) {
      const g = this.goalFor(item);
      if (!g) return;
      g.have++;
      if (g.have >= g.need) g.done = true;
      RB.Sound.play('pickup');
      this.ui.toast(g.itemLabel || g.text);
      RB.Sound.play('note');
      if (this.allGoalsDone()) this.unlockExit();
      this.ui.updateHUD(this);
    }

    canUnlockExit() {
      const w = this.world;
      if (!w || !w.exitObj) return false;
      const r = w.exitObj.reqs || {};
      const ch = this.chapter ? this.chapter.id : 0;
      if (r.key && !this.flags['key_' + ch]) return false;
      if (r.button && !this.flags['button_' + ch]) return false;
      if (r.code && !this.flags['code_' + ch]) return false;
      if (r.sigil && !this.flags['sigil_' + ch]) return false;
      return true;
    }

    exitRequirementHint() {
      const w = this.world;
      const r = (w && w.exitObj && w.exitObj.reqs) || {};
      const ch = this.chapter ? this.chapter.id : 0;
      const parts = [];
      if (r.key && !this.flags['key_' + ch]) parts.push('нужен ключ');
      if (r.button && !this.flags['button_' + ch]) parts.push('нужен пресс');
      if (r.code && !this.flags['code_' + ch]) parts.push('нужен код');
      if (r.sigil && !this.flags['sigil_' + ch]) parts.push('нужен сигил');
      return parts.length ? 'ЗАМОК: ' + parts.join(', ').toUpperCase() : '';
    }

    unlockExit() {
      if (!this.world || !this.world.exitObj) return;
      if (!this.canUnlockExit()) {
        this.ui.toast(this.exitRequirementHint() || 'ЗАМОК ЗАКРЫТ');
        return;
      }
      this.world.exitObj.locked = false;
      RB.Sound.play('stinger');
      this.ui.toast('ЭМБАРГО РАЗРЕШЕНО');
      setTimeout(() => {
        this.ui.subtitle('Принтер в стене напечатал ещё одну строку. Она датирована завтра.', 4.5);
      }, 900);
      this.vibrate(120);
      // объект «прочитал» маршрут — появляется слепок
      const spots = [];
      for (let i = 0; i < 14; i++) {
        const a = RB.rand(0, Math.PI * 2);
        const d = RB.rand(420, 760);
        const x = this.player.x + Math.cos(a) * d;
        const y = this.player.y + Math.sin(a) * d;
        if (this.world.canStand(x, y, 18)) spots.push({ x, y });
      }
      const types = ['sledok', 'obryvok'];
      for (let i = 0; i < Math.min(2, spots.length); i++) {
        const e = new RB.Enemy(types[i % types.length], spots[i].x, spots[i].y);
        e.state = 'chase';
        e.alertTimer = 12;
        e.lastKnown = { x: this.player.x, y: this.player.y };
        e.wake = true;
        this.world.enemies.push(e);
      }
      this.player.attention = RB.clamp(this.player.attention + 25, 0, 100);
    }

    nearestObjective() {
      if (!this.world) return null;
      const p = this.player;
      let best = null, bd = Infinity;
      for (const o of this.world.objects) {
        if (o.taken) continue;
        if (o.kind !== 'quest') continue;
        const g = this.goalFor(o.item);
        if (!g) continue;
        const d = RB.dist2(p.x, p.y, o.x, o.y);
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    }

    /* ---------------- взаимодействия ---------------- */
    findInteractable() {
      const p = this.player;
      let best = null, bd = 74 * 74;
      for (const o of this.world.objects) {
        if (o.taken) continue;
        if (!(o.kind === 'note' || o.kind === 'quest' || o.kind === 'exit' || o.kind === 'npc' || o.kind === 'weapon' || o.kind === 'shop' || o.kind === 'trap' || o.kind === 'boss' || o.kind === 'door' || o.kind === 'isoExit' || o.kind === 'elevator' || o.kind === 'lever' || o.kind === 'cache' || o.kind === 'clue' || o.kind === 'key' || o.kind === 'button' || o.kind === 'sigil' || o.kind === 'gamble' || o.kind === 'shelter' || o.kind === 'puzzle' || o.kind === 'secret' || o.kind === 'rescue' || o.kind === 'stash' || o.kind === 'craft' || o.kind === 'bosskey' || o.kind === 'mail' || o.kind === 'console')) continue;
        const d = RB.dist2(p.x, p.y, o.x, o.y);
        if (d < bd) { bd = d; best = o; }
      }
      if (this.world.finale) {
        const f = this.world.finale;
        const d = RB.dist2(p.x, p.y, f.x, f.y);
        if (d < 100 * 100 && d < bd) best = f;
      }
      return best;
    }

    promptFor(o) {
      if (!o) return null;
      if (o.kind === 'note') return 'ПРОЧИТАТЬ ДОКУМЕНТ';
      if (o.kind === 'quest') return 'ВЗЯТЬ: ' + (o.label || 'ПРЕДМЕТ');
      if (o.kind === 'npc') {
        const npc = RB.Story.npcs[o.npcId];
        if (!npc) return null;
        return 'ГОВОРИТЬ: ' + npc.name.toUpperCase() + (this.flags[npc.id] ? ' ✓' : ' !');
      }
      if (o.kind === 'key') return 'ВЗЯТЬ КЛЮЧ';
      if (o.kind === 'button') return o.pressed ? 'ПРЕСС ОПУЩЕН' : 'НАЖАТЬ ПРЕСС';
      if (o.kind === 'sigil') return o.done ? 'СИГИЛ АКТИВЕН' : 'РЕШИТЬ СИГИЛ';
      if (o.kind === 'gamble') return 'ИГРАТЬ В КОСТИ';
      if (o.kind === 'shelter') return this.player && this.player.hidden ? 'ВЫЙТИ ИЗ УКРЫТИЯ' : 'СПРЯТАТЬСЯ';
      if (o.kind === 'puzzle') return o.done ? 'ГОЛОВОЛОМКА РЕШЕНА' : 'РЕШИТЬ: ' + (o.label || 'ГОЛОВОЛОМКА');
      if (o.kind === 'secret') return 'ОТКРЫТЬ СЕКРЕТНУЮ КОМНАТУ';
      if (o.kind === 'rescue') return 'ОСВОБОДИТЬ РАБОЧЕГО';
      if (o.kind === 'stash') return 'ВСКРЫТЬ ТАЙНИК · ОТМЫЧКА';
      if (o.kind === 'craft') return 'СТОЛ КРАФТА · 5% ЗАРЯДА';
      if (o.kind === 'bosskey') return 'ВЗЯТЬ КЛЮЧ ОТ АРЕНЫ';
      if (o.kind === 'mail') return this.flags['mail_' + (o.chapter || this.chapter.id)] ? 'ПОЧТА · ПРОЧИТАНО' : 'ОТКРЫТЬ СЛУЖЕБНУЮ ПОЧТУ';
      if (o.kind === 'console') {
        if (this.flags['console_' + (o.chapter || this.chapter.id)]) return 'КОНСОЛЬ · ДОСТУП ЕСТЬ';
        return this.hasKeycard(o.chapter || this.chapter.id) ? 'ВСКРЫТЬ КОНСОЛЬ · КЛЮЧ-КАРТА' : 'КОНСОЛЬ · НУЖНА КЛЮЧ-КАРТА';
      }
      if (o.kind === 'boss') return this.bossGateState().ready ? 'БОЙ С БОССОМ' : 'ПЕРЕГОВОРЫ С БОССОМ';
      if (o.kind === 'lever') return o.on ? 'РЫЧАГ ОПУЩЕН' : 'ДЁРНУТЬ РЫЧАГ';
      if (o.kind === 'clue') return 'СФОТОГРАФИРОВАТЬ УЛИКУ';
      if (o.kind === 'cache') return 'ОТКРЫТЬ ТАЙНИК';
      if (o.kind === 'elevator') return 'ЛИФТ ' + (o.dir === 'up' ? 'ВВЕРХ' : 'ВНИЗ');
      if (o.kind === 'door') return 'ВОЙТИ В ДВЕРЬ';
      if (o.kind === 'isoExit') return 'ВЫЙТИ';
      if (o.kind === 'trap') return 'ЛЕБЁДКА';
      if (o.kind === 'boss') return 'НАДЗИРАТЕЛЬ';
      if (o.kind === 'shop') return 'ТОРГОВЕЦ';
      if (o.kind === 'weapon') return 'ПОДОБРАТЬ: ' + (RB.Weapons[o.weapon] ? RB.Weapons[o.weapon].name : 'ОРУЖИЕ');
      if (o.kind === 'finale') return 'БОЧКА №9';
      if (o.kind === 'exit') {
        if (!o.locked) return 'ВЫЙТИ';
        const g = this.goals.find((x) => !x.done);
        if (!g && !this.canUnlockExit()) return this.exitRequirementHint();
        return 'ЗАПЕРТО: ' + (g ? g.text.toUpperCase() : 'ЗАМОК');
      }
      return null;
    }

    interact() {
      const o = this.findInteractable();
      if (!o) {
        const mercy = this.world.enemies.find((e) => !e.dead && e.state === 'surrender' && RB.dist(e.x, e.y, this.player.x, this.player.y) < 72);
        if (mercy) return this.spareCultist(mercy);
        return;
      }
      if (o.kind === 'note') return this.openNote(o);
      if (o.kind === 'quest') return this.pickupQuest(o);
      if (o.kind === 'npc') return this.talkTo(o);
      if (o.kind === 'key') {
        o.taken = true;
        this.flags['key_' + this.chapter.id] = true;
        this.ui.toast('КЛЮЧ ПОЛУЧЕН');
        RB.Sound.play('pickup');
        if (this.allGoalsDone()) this.unlockExit();
        this.saveProgress();
        return;
      }
      if (o.kind === 'button') {
        if (o.pressed) return;
        o.pressed = true;
        this.flags['button_' + this.chapter.id] = true;
        this.ui.toast('ПРЕСС ОПУЩЕН · ЗАМОК СНЯТ');
        RB.Sound.play('stamp');
        this.shake(4, 0.25);
        if (this.allGoalsDone()) this.unlockExit();
        this.saveProgress();
        return;
      }
      if (o.kind === 'sigil') {
        if (o.done) return;
        return this.openSigil(o);
      }
      if (o.kind === 'gamble') return this.openGamble(o);
      if (o.kind === 'shelter') return this.toggleShelter(o);
      if (o.kind === 'puzzle') {
        if (o.done) return;
        return this.openPuzzle(o);
      }
      if (o.kind === 'secret') return this.enterSecret(o);
      if (o.kind === 'rescue') return this.openRescue(o);
      if (o.kind === 'stash') return this.openStash(o);
      if (o.kind === 'craft') return this.openCraftTable(o);
      if (o.kind === 'mail') return this.openMail(o);
      if (o.kind === 'console') return this.openConsole(o);
      if (o.kind === 'bosskey') {
        o.taken = true;
        this.addItem('key_boss', 1);
        const all = [this.player.inv.backpack.items, this.player.inv.pockets.items, this.player.inv.rps.items].flat();
        const key = all.find((it) => it.id === 'key_boss' && !it.customName);
        if (key) key.customName = 'Ключ — ' + (o.bossName || 'БОСС');
        RB.Sound.play('pickup');
        this.ui.toast('КЛЮЧ ПОЛУЧЕН: ' + (o.bossName || 'БОСС'));
        this.saveProgress();
        return;
      }
      if (o.kind === 'lever') return this.useLever(o);
      if (o.kind === 'clue') {
        if (o.taken) return;
        o.taken = true;
        this.flags.photos = (this.flags.photos || 0) + 1;
        this.flags.photoList = (this.flags.photoList || []).concat([{
          ch: this.chapterIndex, label: o.label || 'УЛИКА'
        }]);
        this.player.tokens += 1;
        this.ui.toast('УЛИКА СНЯТА · +1 ТАЛОН');
        RB.Sound.play('pickup');
        this.saveProgress();
        return;
      }
      if (o.kind === 'cache') return this.openCache(o);
      if (o.kind === 'elevator') return this.startElevator(o);
      if (o.kind === 'door') return this.enterIso(o);
      if (o.kind === 'isoExit') return this.exitIso();
      if (o.kind === 'trap') return this.useTrap(o);
      if (o.kind === 'boss') return this.talkBoss(o);
      if (o.kind === 'shop') return this.openShop(o);
      if (o.kind === 'weapon') {
        o.taken = true;
        const iid = 'w_' + o.weapon;
        this.player.unlockWeapon(o.weapon);
        this.addItem(iid, 1);
        const wi = RB.Inv.findById(this.player.inv.backpack, iid) || RB.Inv.findById(this.player.inv.pockets, iid);
        if (wi && !this.getWeaponItem(this.player)) this.equipUid(this.player, wi.uid);
        RB.Sound.play('pickup');
        this.ui.toast('ОРУЖИЕ: ' + RB.Weapons[o.weapon].name + ' · В ИНВЕНТАРЬ');
        this.ui.updateHUD(this);
        return;
      }
      if (o.kind === 'finale') return this.openFinale();
      if (o.kind === 'exit') {
        if (o.locked) {
          const g = this.goals.find((x) => !x.done);
          if (!g && o.reqs && o.reqs.code && !this.flags['code_' + this.chapter.id]) {
            return this.openCodeLock(o);
          }
          RB.Sound.play('deny');
          this.ui.toast(!g ? this.exitRequirementHint() : g.text);
          return;
        }
        return this.completeChapter();
      }
    }

    spareCultist(e) {
      if (!e || e.dead) return;
      e.dead = true;
      e.surrendered = false;
      this.flags.cultMercy = (this.flags.cultMercy || 0) + 1;
      this.player.attention = RB.clamp(this.player.attention - 35, 0, 100);
      this.player.tokens += 2;
      this.enemyDamageMul = 1 + this.flags.cultMercy * 0.1;
      this.ui.toast('ПОЩАДА · +2 ТАЛОНА · СТРЕСС -35');
      this.ui.subtitle('Он кланяется и уходит. Следующий уровень будет злее.', 4);
      RB.Sound.play('paper');
      this.saveProgress();
      this.ui.updateHUD(this);
    }

    talkTo(o) {
      const npc = RB.L ? RB.L.npc(RB.Story.npcs[o.npcId]) : RB.Story.npcs[o.npcId];
      if (!npc) return;
      const done = !!this.flags[npc.id];
      const st = (this.npcState && this.npcState[npc.id]) || { level: 1, currency: 10 };
      const back = () => this.talkTo(o);
      this.state = 'npc';
      RB.Sound.play('paper');
      const close = () => {
        this.state = 'playing';
        this.ui.showHUD();
        this.ui.updateHUD(this);
        this.input.pressed = Object.create(null);
      };
      this.ui.showNpc(
        npc,
        done,
        () => this.startNpcQuest(npc, close),
        close,
        npc.schedule ? npc.schedule[this.chapterIndex] : null,
        st,
        () => this.openNpcTrade(npc, st, back)
      );
    }

    startNpcQuest(npc, close) {
      this.ui.closeModal();
      this.ui.hud.classList.add('hidden');
      this.ui.touch.classList.add('hidden');
      this.state = 'minigame';
      RB.Sound.play('ui');
      RB.Minigames.start(npc.quest.minigame, (ok) => {
        if (ok === null) {
          // отмена
          this.state = 'playing';
          this.ui.showHUD();
          this.ui.updateHUD(this);
          return;
        }
        if (ok) this.completeNpcQuest(npc);
        else {
          RB.Sound.play('deny');
          this.ui.toast('ПРОВАЛ. ' + npc.name.toUpperCase() + ' НЕ ПОМОЖЕТ');
          this.player.attention = RB.clamp(this.player.attention + 12, 0, 100);
        }
        this.state = 'playing';
        this.ui.showHUD();
        this.ui.updateHUD(this);
        this.input.pressed = Object.create(null);
      });
    }

    completeNpcQuest(npc) {
      this.flags[npc.id] = true;
      if (npc.quest.serum) this.flags.serum = true;
      if (npc.quest.trueName) this.flags.trueName = true;
      if (npc.id === 'kim') this.flags.motherSeen = this.flags.motherSeen || true;
      if (npc.id === 'ignat') {
        this.flags.recipes = this.flags.recipes || {};
        this.flags.recipes.salt13 = true;
        this.addItem('recipe_salt13', 1);
        this.ui.subtitle('Игнат отдаёт чертёж: соль-13, серебро 1 шт.', 5);
      }
      this.addXp(40);
      RB.Sound.play('pickup');
      this.ui.toast('КВЕСТ ВЫПОЛНЕН: ' + npc.quest.title.toUpperCase());
      this.ui.subtitle(npc.quest.reward, 5);
      this.saveProgress();
      this.kills = this.world.kills;
      this.ui.updateHUD(this);
    }

    pickupQuest(o) {
      o.taken = true;
      for (const e of this.world.enemies) {
        if (RB.dist(e.x, e.y, o.x, o.y) < 400) {
          e.state = 'chase';
          e.alertTimer = 8;
          e.lastKnown = { x: this.player.x, y: this.player.y };
        }
      }
      this.onQuestPickup(o.item);
    }

    openNote(o) {
      o.taken = true;
      this.state = 'note';
      if (!this.notesRead.has(o.noteId)) {
        this.notesRead.add(o.noteId);
        this.player.attention = RB.clamp(this.player.attention + 18, 0, 100);
        this.saveProgress();
        this.addXp(5);
        this.ui.toast('СТРЕСС +18');
      }
      RB.Sound.play('paper');
      const rawNote = RB.Story.notes[o.noteId] || { title: 'ДОКУМЕНТ', text: '…', code: '' };
      const note = RB.L ? RB.L.note(rawNote) : rawNote;
      this.ui.showNote(note, () => {
        this.state = 'playing';
        this.ui.showHUD();
        this.ui.updateHUD(this);
        this.input.pressed = Object.create(null);
        if (this.player.attention > 75) {
          this.ui.subtitle('Объект прочитал документ вместе с тобой. Он читает быстрее.', 4.5);
        }
      });
    }

    onRecorded() {
      this.saveProgress();
      this.ui.toast('ВРЕМЯ ЗАПИСАНО · 19:50:08');
    }

    completeChapter() {
      if (this.state !== 'playing') return;
      if (this.chapter.id >= RB.Story.chapters.length) return this.openFinale();
      this.state = 'card';
      this.carry = this.snapshotPlayer();
      this.saveProgress();
      const chapter = this.chapter;
      RB.Sound.play('stinger');
      this.vibrate(90);
      const next = chapter.id + 1;
      this.ui.showOutro(chapter, () => {
        this.startChapter(next);
      });
    }

    /* ---------------- бочки-засады (T39) ---------------- */
    checkAmbush() {
      const p = this.player;
      const w = this.world;
      if (!p.flashlight || p.battery <= 0) return;
      for (const o of w.objects) {
        if (o.kind !== 'ambush' || o.triggered) continue;
        const d = RB.dist(p.x, p.y, o.x, o.y);
        if (d > 470) continue;
        const a = Math.atan2(o.y - p.y, o.x - p.x);
        if (Math.abs(RB.angDiff(p.angle, a)) > 0.5) continue;
        if (!w.lineOfSight(p.x, p.y, o.x, o.y, 470)) continue;
        this.triggerAmbush(o);
      }
    }

    triggerAmbush(o) {
      o.triggered = true;
      this.world.grid[o.ty][o.tx] = '.';
      this.world.saltPuddles.push({ x: o.x, y: o.y, r: 74 });
      const e = new RB.Enemy(o.type, o.x, o.y);
      e.state = 'chase';
      e.alertTimer = 14;
      e.lastKnown = { x: this.player.x, y: this.player.y };
      e.wake = true;
      this.world.enemies.push(e);
      this.player.redLight = 1.6;
      this.player.attention = RB.clamp(this.player.attention + 14, 0, 100);
      RB.Sound.play('screech');
      this.shake(9, 0.45);
      this.vibrate(140);
      this.world.spawnParticles(o.x, o.y, 26, {
        speed: [30, 170], life: [0.4, 1.1], size: [1, 3], color: '#e2dcc8', drag: 4, grav: 80
      });
      this.world.spawnParticles(o.x, o.y, 10, {
        speed: [60, 200], life: [0.2, 0.6], size: [1, 3], color: '#8a5a2a', drag: 5
      });
      this.ui.toast('БОЧКА ОТКРЫЛАСЬ');
      this.ui.subtitle('Скрежет металла. Соль хрустит под ногами.', 3.5);
      this.renderer.staticCanvas = null;
      this.renderer.staticWorld = null;
    }

    /* ---------------- лут ---------------- */
    checkPickups() {
      const p = this.player;
      const world = this.world;
      for (const o of world.objects) {
        if (o.taken || o.kind !== 'item') continue;
        if (o.pickupAt && Date.now() < o.pickupAt) continue;
        if (RB.dist2(p.x, p.y, o.x, o.y) > 34 * 34) continue;
        o.taken = true;
        const map = {
          medkit: ['medkit', 1], ammo: ['ammo_9x18', 8], battery: ['battery', 1],
          painkiller: ['painkiller', 1], adrenaline: ['adrenaline', 1], salt: ['salt', 1],
          food: ['food', 1], gasoline: ['gasoline', 1], phosphorus: ['phosphorus', 1],
          silver: ['silver', 1], napalm: ['napalm', 1], lockpick: ['lockpick', 1],
          ammo_12: ['ammo_12', 6], ammo_545: ['ammo_545', 20]
        };
        const m = map[o.item];
        let added = true;
        if (m) added = this.addItem(m[0], o.count || m[1]) !== false;
        else if (RB.Items.get(o.item)) added = this.addItem(o.item, o.count || 1) !== false;
        else if (o.item === 'flare') {
          p.attention = RB.clamp(p.attention - 35, 0, 100);
          p.battery = RB.clamp(p.battery + 15, 0, 100);
          world.spawnParticles(p.x, p.y, 20, {
            speed: [40, 140], life: [0.4, 1.2], size: [1, 3], color: '#ffb15a', drag: 3
          });
          this.ui.toast('ФАЛЬШФЕЙЕР');
        }
        if (!added) { o.taken = false; this.ui.toast('НЕТ МЕСТА · ПРЕДМЕТ НА ЗЕМЛЕ'); return; }
        const def = RB.Items.get(o.item);
        if (def && def.kind === 'weapon' && def.weapon) this.player.unlockWeapon(def.weapon);
        if (def && def.kind === 'key' && String(o.item).indexOf('keycard_') === 0) {
          this.ui.toast('КЛЮЧ-КАРТА · ТЕРМИНАЛ РАЗБЛОКИРОВАН');
        }
        if (o.rounds != null || o.internalRounds != null) {
          const all = [this.player.inv.backpack.items, this.player.inv.pockets.items, this.player.inv.rps.items].flat();
          const it = all.slice().reverse().find((x) => x.id === o.item);
          if (it) {
            if (o.rounds != null) { it.rounds = o.rounds; }
            if (o.loaded) it.loaded = o.loaded;
            if (o.internalRounds != null) { it.internalRounds = o.internalRounds; it.internalLoaded = o.internalLoaded; }
          }
        }
        RB.Sound.play('pickup');
        this.ui.updateHUD(this);
      }
    }

    /* ---------------- цикл ---------------- */
    update(dt) {
      if (this.state === 'playing' || this.state === 'paused' || this.state === 'note' || this.state === 'dead') {
        this.ui.update(dt);
      }
      RB.Sound.update(dt, this.player ? this.player.attention / 100 : 0, this.state !== 'playing');

      if (this.shakeTime > 0) {
        this.shakeTime -= dt;
        this.shakeMag = RB.lerp(this.shakeMag, 0, Math.min(1, dt * 9));
        if (this.shakeTime <= 0) this.shakeMag = 0;
      } else if (this.shakeMag > 0) {
        this.shakeMag = RB.lerp(this.shakeMag, 0, Math.min(1, dt * 9));
      }

      for (let i = this.tracers.length - 1; i >= 0; i--) {
        this.tracers[i].life -= dt;
        if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
      }

      if (this.state === 'elevator') { this.updateElevator(dt); return; }
      if (this.state !== 'playing') return;

      this.playTime += dt;
      this.autoSaveTimer = (this.autoSaveTimer || 0) + dt;
      if (this.autoSaveTimer > 12) {
        this.autoSaveTimer = 0;
        this.saveProgress();
      }
      this.perfTimer = (this.perfTimer || 0) + dt;
      if (this.perfTimer > 4) {
        this.perfTimer = 0;
        const fps = window.__rbFps || 60;
        if (!this.lowQuality && fps > 0 && fps < 42 && this.playTime > 8) {
          this.setLowQuality(true);
        }
      }
      const p = this.player;
      const world = this.world;
      const input = this.input;

      input.update();
      if (this.controlMode === 1) {
        let best = null, bd = 700 * 700;
        for (const e of world.enemies) {
          if (e.dead) continue;
          const d = RB.dist2(e.x, e.y, p.x, p.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          input.aimAngle = Math.atan2(best.y - p.y, best.x - p.x);
          input.aiming = true;
          p.angle = input.aimAngle;
        }
      }
      this.updateDrug(dt);
      this.updateCalm(dt);
      p.update(dt, input, world, this);
      world.update(dt, p, this);
      if (world.updateProjectiles) world.updateProjectiles(dt, p, this);
      if (world.kills > this.kills) {
        this.addXp((world.kills - this.kills) * 10);
        this.kills = world.kills;
      }

      if (p.dead) return;

      this.checkAmbush();
      this.checkPickups();

      if (input.consume('interact')) this.interact();
      const target = this.findInteractable();
      const mercy = world.enemies.find((e) => !e.dead && e.state === 'surrender' && RB.dist(e.x, e.y, p.x, p.y) < 72);
      if (!target && mercy) this.ui.setPrompt('ПОЩАДИТЬ КУЛЬТИСТА');
      else this.ui.setPrompt(RB.L ? RB.L.prompt(this.promptFor(target)) : this.promptFor(target));

      // метка комнаты
      const room = world.roomAt(p.x, p.y);
      if (room && room !== this.lastRoom) {
        this.lastRoom = room;
        this.ui.roomName(room.name);
        this.discoverRoom(room);
      }
      if (world.bossFight && !world.enemies.some((e) => e.def && e.def.isBoss && !e.dead)) {
        this.winBossFight();
      }

      // стресс объекта
      if (p.attention > 55) {
        this.whisperTimer -= dt;
        if (this.whisperTimer <= 0) {
          this.whisperTimer = RB.rand(14, 30) * (1.3 - p.attention / 140);
          this.ui.subtitle(this.whisperLine(), 4);
          RB.Sound.play('whisper');
        }
      }

      // объект начинает читать игрока
      if (p.attention > 82 && !this.mimicSpawned) {
        this.mimicSpawned = true;
        this.spawnMimic();
      }

      // редкие звуки архива
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0) {
        this.ambientTimer = RB.rand(35, 80);
        const r = Math.random();
        if (r < 0.35) RB.Sound.play('door');
        else if (r < 0.65) RB.Sound.play('rustle');
        else if (r < 0.85) RB.Sound.play('radio');
        else RB.Sound.play('step', { vol: 0.4 });
      }

      // HUD (не каждый кадр)
      this.hudTick += dt;
      if (this.hudTick > 0.1) {
        this.hudTick = 0;
        this.ui.updateHUD(this);
      }

      if (p.attention > 85 && Math.random() < dt * 1.5) {
        this.shake(1.4, 0.2);
      }
    }

    spawnMimic() {
      const p = this.player;
      for (let i = 0; i < 20; i++) {
        const a = RB.rand(0, Math.PI * 2);
        const d = RB.rand(520, 760);
        const x = p.x + Math.cos(a) * d;
        const y = p.y + Math.sin(a) * d;
        if (!this.world.canStand(x, y, 18)) continue;
        const e = new RB.Enemy('sledok', x, y);
        e.state = 'chase';
        e.alertTimer = 20;
        e.lastKnown = { x: p.x, y: p.y };
        e.wake = true;
        this.world.enemies.push(e);
        this.ui.toast('СТРЕСС: ОБЪЕКТ ЧИТАЕТ');
        RB.Sound.play('stinger');
        this.vibrate(140);
        return;
      }
    }

    whisperLine() {
      const lines = [
        'Ты слышишь? Это не трубы. Это чтение.',
        'Кто-то считает: один… сорок один…',
        'Не отвечай.',
        'Твоё имя уже в оглавлении.',
        'Он уже надел твоё лицо. Осталось подписать.',
        'Пахнет бумагой и рассолом.',
        'Бочка помнит тебя.',
        'Ты уже внутри. Просто ещё не расписался.'
      ];
      return RB.pick(lines);
    }

    shake(amount, time) {
      if (!this.shakeScale) return;
      if (this.reduceMotion) amount *= 0.25;
      this.shakeMag = Math.max(this.shakeMag, amount);
      this.shakeTime = Math.max(this.shakeTime, time);
    }

    vibrate(ms) {
      if (!this.vibration) return;
      try {
        if (window.AndroidHost && window.AndroidHost.vibrate) window.AndroidHost.vibrate(ms);
        else if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms);
      } catch (e) {}
    }

    screenToWorld(sx, sy) {
      const r = this.renderer;
      if (this.world && this.world.mode === 'iso' && RB.Iso) {
        const scale = r.scale || 1;
        return RB.Iso.unproject(sx / scale, sy / scale, r.low.width, r.low.height);
      }
      const cam = r.cam || { x: 0, y: 0 };
      const scale = r.scale || 1;
      return { x: sx * scale + cam.x, y: sy * scale + cam.y };
    }

    draw(dt) {
      if (!this.world || !this.player) return;
      this.renderer.draw(this, dt);
    }

    /* вызов из Android при кнопке «назад» */
    androidBackPressed() {
      if (this.state === 'playing') {
        this.togglePause();
        return 'paused';
      }
      if (this.state === 'paused') return 'exit';
      if (this.state === 'note') return 'note';
      if (this.state === 'menu') return 'exit';
      return 'stay';
    }
  }

  RB.Game = Game;
})();
