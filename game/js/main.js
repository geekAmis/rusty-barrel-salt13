/* ============================================================
   RUSTY BARREL — запуск
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});

  function boot() {
    const canvas = document.getElementById('game');
    const game = new RB.Game(canvas);
    window.game = game;
    if (RB.Debug) RB.Debug.init(game);

    // отладка: ?play=1&ch=2&seed=123456 — сразу в игру, без карточек
    const params = new URLSearchParams(location.search);
    if (params.has('play')) {
      const ch = RB.clamp(parseInt(params.get('ch') || '1', 10) || 1, 1, 5);
      game.seedText = params.get('seed') || '424242';
      game.ui.showChapterCard = (chapter, done) => {
        game.state = 'playing';
        game.ui.showHUD();
        done && done();
      };
      game.ui.showSequence = (opts) => { opts.onDone && opts.onDone(); };
      const langParam = params.get('lang');
      if (langParam && RB.I18n) RB.I18n.set(langParam);
      if (params.has('skipscenes') && RB.Story.scenes) {
        for (const k in RB.Story.scenes) game.scenesSeen[k] = true;
      }
      game.startChapter(ch);

      const dbg = params.get('dbg');
      if (dbg) {
        setTimeout(() => {
          if (dbg === 'note') game.ui.showNote(RB.Story.notes.n1, () => {});
          if (dbg === 'pause') game.togglePause();
          if (dbg === 'choice') game.openFinale();
          if (dbg === 'ending') game.ui.showEnding(RB.Story.endings.find((e) => e.id === 'salt') || RB.Story.endings[0], () => {});
          if (dbg === 'death') game.ui.showDeath(RB.Story.deathMessages[0], game.getStats(), () => {}, () => {});
          if (dbg === 'move') {
            setTimeout(function () { game.input.keys.d = true; }, 1200);
            setTimeout(function () {
              try {
                const pl = game.player, w = game.world;
                const before = pl.x;
                const blocked = w.rectBlocked(pl.x + 6, pl.y - 2, 15, 24);
                const moved = w.moveEntity(pl, 6, 0, 13);
                console.log('FORCETEST before=' + Math.round(before) + ' after=' + Math.round(pl.x) + ' moved=' + moved + ' blocked=' + blocked + ' feet=' + Math.round(pl.y + pl.h / 2));
              } catch (e) { console.log('FORCETEST ERR ' + e.message); }
              console.log('MOVEDBG x=' + Math.round(game.player.x) + ' y=' + Math.round(game.player.y) + ' vx=' + Math.round(game.player.vx) + ' h=' + game.player.h + ' state=' + game.state + ' mx=' + game.input.move.x);
              document.title = 'MOVE X:' + Math.round(game.player.x) + ' Y:' + Math.round(game.player.y) + ' STATE:' + game.state + ' MX:' + game.input.move.x + ' D:' + game.input.keys.d + ' ERR:' + window.__lastErr;
            }, 2800);
            setTimeout(function () { game.input.keys.d = false; }, 3200);
          }
          if (dbg === 'iso') {
            try {
              const dr = game.world && game.world.objects.find((x) => x.kind === 'door');
              if (dr) game.enterIso(dr);
            } catch (e) { document.title = 'ISOERR: ' + e.message; }
          }
          if (dbg === 'isoaim') {
            try {
              const dr = game.world && game.world.objects.find((x) => x.kind === 'door');
              if (dr) game.enterIso(dr);
              game.player.flashlight = true;
              game.player.battery = 100;
              game.player.angle = RB.Iso.screenAngleToWorld(-Math.PI / 2);
            } catch (e) { document.title = 'ISOERR: ' + e.message; }
          }
          if (dbg === 'layout') game.ui.openLayoutEditor();
          if (dbg === 'shop') {
            const sh = game.world && game.world.objects.find((x) => x.kind === 'shop');
            if (sh) game.openShop(sh);
          }
          if (dbg === 'dev') game.openDev();
          if (dbg === 'boss') {
            const b = game.world && game.world.enemies.find((x) => x.def && x.def.isBoss);
            if (b) { game.player.x = b.x; game.player.y = b.y + 110; }
          }
          if (dbg === 'npc') {
            const o = game.world && game.world.objects.find((x) => x.kind === 'npc');
            if (o) game.talkTo(o);
          }
          if (dbg === 'elevator') {
            const e = game.world && game.world.objects.find((x) => x.kind === 'elevator');
            if (e) game.startElevator(e);
          }
          if (dbg === 'map') game.openMap();
          if (dbg === 'inventory') game.openInventory();
          if (dbg === 'puzzle') {
            const o = game.world && game.world.objects.find((x) => x.kind === 'puzzle');
            if (o) game.openPuzzle(o);
          }
          if (dbg === 'gamble') {
            const o = game.world && game.world.objects.find((x) => x.kind === 'gamble');
            if (o) game.openGamble(o);
          }
          if (dbg === 'shelter') {
            const o = game.world && game.world.objects.find((x) => x.kind === 'shelter');
            if (o) game.toggleShelter(o);
          }
          if (dbg === 'secret') {
            const o = game.world && game.world.objects.find((x) => x.kind === 'secret');
            if (o) game.enterSecret(o);
          }
          if (dbg === 'rescue') {
            const o = game.world && game.world.objects.find((x) => x.kind === 'rescue');
            if (o) { game.player.x = o.x; game.player.y = o.y; game.openRescue(o); }
          }
          if (dbg === 'cutscene') {
            const sc = RB.Story.scenes && RB.Story.scenes.capture;
            if (sc) { game.state = 'cutscene'; RB.Cutscene.play(game.ui, sc, () => { game.state = 'playing'; game.ui.showHUD(); }); }
          }
          if (dbg === 'bossfight') {
            const b = game.world && game.world.objects.find((x) => x.kind === 'boss');
            if (b) {
              for (const h of game.goals) h.done = true;
              game.flags['bossTalk_' + game.chapter.id] = true;
              game.addItem('key_boss', 1);
              game.startBossFight(b);
            }
          }
          if (dbg === 'deathanim') {
            RB.DeathAnim.play('devour', () => {});
          }
          if (dbg === 'drug') {
            game.player.drug = { doses: 0, penalty: 0, relief: 0, tick: 0, boost: 0 };
            game.useDrug();
          }
          if (dbg === 'stash') {
            const s = game.world && game.world.objects.find((x) => x.kind === 'stash');
            if (s) { game.player.x = s.x; game.player.y = s.y; game.openStash(s); }
          }
          if (dbg === 'craft') {
            const dr = game.world && game.world.objects.find((x) => x.kind === 'door');
            if (dr) game.enterIso(dr);
            const c = game.world && game.world.objects.find((x) => x.kind === 'craft');
            if (c) game.openCraftTable(c);
          }
          if (dbg === 'mail') {
            const o = game.world && game.world.objects.find((x) => x.kind === 'mail');
            if (o) game.openMail(o);
          }
          if (dbg === 'console') {
            game.addItem('keycard_' + game.chapter.id, 1);
            const o = game.world && game.world.objects.find((x) => x.kind === 'console');
            if (o) game.openConsole(o);
          }
          if (dbg === 'leg') {
            game.rpg.points = 4;
            for (let i = 0; i < 4; i++) game.buyUpgrade('leg');
          }
          if (dbg === 'trade') {
            const npc = RB.Story.npcs.zoya;
            game.openNpcTrade(npc, game.npcState.zoya, () => { game.state = 'playing'; game.ui.closeModal(); game.ui.showHUD(); });
          }
          if (dbg === 'reloadtest') {
            game.initInventory(game.player);
            game.addItem('mag_pm', 1);
            game.addItem('ammo_9x18', 16);
            const wi = game.getWeaponItem(game.player);
            const mag = wi ? game.getWeaponMag(game.player, wi) : null;
            if (mag) { mag.rounds = 0; mag.ammo = undefined; }
            game.reloadWeapon(game.player);
            game.ui.toast('RELOADTEST AMMO=' + game.player.ammo);
          }
          if (dbg.indexOf('mg:') === 0) {
            game.state = 'minigame';
            game.ui.hud.classList.add('hidden');
            game.ui.touch.classList.add('hidden');
            RB.Minigames.start(dbg.slice(3), () => { game.state = 'playing'; game.ui.showHUD(); game.ui.updateHUD(game); });
          }
        }, 900);
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        try { game.saveProgress(); } catch (e) {}
        RB.Voice.stop();
        RB.Sound.stopAll();
      } else {
        RB.Sound.resume();
      }
    });

    if (RB.CrashLog) {
      window.addEventListener('error', (e) => RB.CrashLog.add(e.error || e.message));
      window.addEventListener('unhandledrejection', (e) => RB.CrashLog.add(e.reason || 'rejection'));
    }
    window.addEventListener('error', (e) => {
      document.title = 'ERR: ' + (e.message || 'unknown');
    });
    window.addEventListener('unhandledrejection', (e) => {
      document.title = 'ERR: ' + (e.reason && e.reason.message ? e.reason.message : e.reason);
    });

    window.addEventListener('error', (e) => {
      console.error('WINERR', e.message, (e.filename || '') + ':' + (e.lineno || 0));
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('WINERR-PROMISE', e.reason && e.reason.message ? e.reason.message : String(e.reason));
    });

    // скрываем подсказку о повороте через 6 секунд
    setTimeout(() => {
      const hint = document.getElementById('rotate-hint');
      if (hint) hint.style.opacity = '0.25';
    }, 6000);

    let last = RB.now();
    let fpsAcc = 0, fpsFrames = 0;
    function frame(now) {
      let dt = (now - last) / 1000;
      last = now;
      if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
      dt = Math.min(dt, 0.05);

      try {
        game.update(dt);
        game.draw(dt);
      } catch (err) {
        console.error('RBSTACK ' + (err && err.stack ? err.stack : err && err.message));
        if (RB.CrashLog) RB.CrashLog.add(err);
        window.__lastErr = err && err.message; document.title = 'ERR: ' + (err && err.message);
      }

      if (RB.Profiler) RB.Profiler.tick(dt);
      if (RB.Debug) RB.Debug.update(dt);
      fpsAcc += dt; fpsFrames++;
      if (fpsAcc > 2) { window.__rbFps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // первый жест включает звук (политика браузеров)
    const unlockAudio = () => {
      RB.Sound.init();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    // жесты/скролл не должны мешать игре
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => {
      if (e.target === canvas) e.preventDefault();
    }, { passive: false });
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // мост для Android
    window.androidBackPressed = () => game.androidBackPressed();

    // смена ориентации — пересчёт виньетки
    window.addEventListener('resize', () => {
      setTimeout(() => game.renderer.resize(), 120);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
