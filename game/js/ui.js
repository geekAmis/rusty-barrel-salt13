/* ============================================================
   RUSTY BARREL — интерфейс (DOM-слои, окна, HUD)
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});

  class UI {
    constructor(game) {
      this.game = game;
      const $ = (id) => document.getElementById(id);
      this.$ = $;

      this.hud = $('hud');
      this.menu = $('menu');
      this.modal = $('modal');
      this.pause = $('pause');
      this.invScreen = $('inv-screen');
      this.invBody = $('inv-body');
      this.tradeScreen = $('trade-screen');
      this.tradeBody = $('trade-body');
      this.settings = $('settings');
      this.fadeEl = $('fade');
      this.objList = $('obj-list');
      this.roomLabel = $('room-label');
      this.promptEl = $('prompt');
      this.subtitleEl = $('subtitle');
      this.toastEl = $('toast');
      this.ammoEl = $('ammo-count');
      this.barHp = $('bar-hp');
      this.barSt = $('bar-stamina');
      this.barBat = $('bar-battery');
      this.barAtt = $('bar-attention');
      this.weaponLabel = $('weapon-label');
      this.tokensEl = $('tokens');
      this.touch = $('touch-controls');

      this.last = {};
      this.promptText = null;
      this.subTimer = 0;
      this.roomTimer = 0;
      this.toastTimer = 0;
      this.typeTimer = null;
      this.settingsFrom = 'menu';
      this.editor = $('layout-editor');
      this.layoutSnapshot = null;

      if (this.promptEl) {
        this.promptEl.addEventListener('pointerdown', (e) => {
          if (RB.editLayout) return;
          e.preventDefault();
          e.stopPropagation();
          RB.Sound.init();
          RB.Sound.play('ui');
          this.game.input.press('interact');
        });
      }
      this.bindSettings();
      this.bindLayout();
      if (RB.store.get('rb_layout_ver', 0) < 2) {
        RB.store.del('rb_btn_layout');
        RB.store.set('rb_layout_ver', 2);
      }
      this.applyLayout(RB.store.get('rb_btn_layout', null) || RB.DefaultLayout, true);
    }

    bindLayout() {
      const btn = document.getElementById('btn-layout');
      if (btn) btn.addEventListener('click', () => { RB.Sound.play('ui'); this.openLayoutEditor(); });
      const save = document.getElementById('btn-layout-save');
      const reset = document.getElementById('btn-layout-reset');
      const cancel = document.getElementById('btn-layout-cancel');
      if (save) save.addEventListener('click', () => this.closeLayoutEditor(true));
      if (cancel) cancel.addEventListener('click', () => this.closeLayoutEditor(false));
      if (reset) reset.addEventListener('click', () => {
        RB.store.del('rb_btn_layout');
        this.applyLayout(RB.DefaultLayout, true);
        RB.Sound.play('ui');
      });

      const buttons = Array.from(document.querySelectorAll('#touch-controls .tbtn'));
      for (const el of buttons) {
        let drag = null;
        el.addEventListener('pointerdown', (e) => {
          if (!RB.editLayout) return;
          e.preventDefault();
          e.stopPropagation();
          const r = el.getBoundingClientRect();
          drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
          try { el.setPointerCapture(e.pointerId); } catch (err) {}
        });
        el.addEventListener('pointermove', (e) => {
          if (!RB.editLayout || !drag) return;
          e.preventDefault();
          const w = window.innerWidth, h = window.innerHeight;
          let x = ((e.clientX - drag.dx) / w) * 100;
          let y = ((e.clientY - drag.dy) / h) * 100;
          x = RB.clamp(x, 0, 100 - (el.offsetWidth / w) * 100);
          y = RB.clamp(y, 0, 100 - (el.offsetHeight / h) * 100);
          el.style.left = x + '%';
          el.style.top = y + '%';
          el.style.right = 'auto';
          el.style.bottom = 'auto';
        });
        const stop = () => { drag = null; };
        el.addEventListener('pointerup', stop);
        el.addEventListener('pointercancel', stop);
      }
    }

    openLayoutEditor() {
      if (!this.editor) return;
      RB.editLayout = true;
      document.body.classList.add('editing');
      this.layoutSnapshot = [];
      const w = window.innerWidth, h = window.innerHeight;
      for (const el of document.querySelectorAll('#touch-controls .tbtn')) {
        const r = el.getBoundingClientRect();
        el.style.left = (r.left / w) * 100 + '%';
        el.style.top = (r.top / h) * 100 + '%';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        this.layoutSnapshot.push({ id: el.id, left: el.style.left, top: el.style.top });
      }
      this.hideScreens();
      this.hud.classList.add('hidden');
      this.touch.classList.remove('hidden');
      this.editor.classList.remove('hidden');
    }

    closeLayoutEditor(save) {
      RB.editLayout = false;
      document.body.classList.remove('editing');
      if (save) {
        const layout = {};
        for (const el of document.querySelectorAll('#touch-controls .tbtn')) {
          layout[el.id] = { left: el.style.left, top: el.style.top };
        }
        RB.store.set('rb_btn_layout', layout);
        this.applyLayout(layout, false);
      } else {
        for (const s of (this.layoutSnapshot || [])) {
          const el = document.getElementById(s.id);
          if (!el) continue;
          el.style.left = s.left || '';
          el.style.top = s.top || '';
        }
        this.applyLayout(RB.store.get('rb_btn_layout', null) || RB.DefaultLayout, true);
      }
      if (this.editor) this.editor.classList.add('hidden');
      this.touch.classList.add('hidden');
      this.showSettings('menu');
    }

    applyLayout(layout, clear) {
      for (const el of document.querySelectorAll('#touch-controls .tbtn')) {
        if (clear) {
          el.style.left = '';
          el.style.top = '';
          el.style.right = '';
          el.style.bottom = '';
        }
        const p = layout && layout[el.id];
        if (p && p.left) {
          el.style.left = p.left;
          el.style.top = p.top;
          el.style.right = 'auto';
          el.style.bottom = 'auto';
        }
      }
    }

    bindSettings() {
      const vol = this.$('vol');
      const qual = this.$('qual');
      const vib = this.$('vib');
      vol.value = Math.round(RB.Sound.volume * 100);
      vol.addEventListener('input', () => {
        RB.Sound.init();
        RB.Sound.setVolume(vol.value / 100);
      });
      this.qualityBtn = qual;
      this.vibrationBtn = vib;
      const updateQuality = () => {
        qual.textContent = this.game.lowQuality ? RB.I18n.t('low') : RB.I18n.t('high');
      };
      const updateVib = () => {
        vib.textContent = this.game.vibration ? RB.I18n.t('on') : RB.I18n.t('off');
      };
      const langBtn = this.$('lang');
      if (langBtn) {
        langBtn.addEventListener('click', () => {
          RB.I18n.toggle();
          this.showSettings(this.settingsFrom);
        });
      }
      const contrastBtn = this.$('contrast');
      const motionBtn = this.$('motion');
      const updateContrast = () => {
        if (contrastBtn) contrastBtn.textContent = this.game.highContrast ? RB.I18n.t('on') : RB.I18n.t('off');
      };
      const updateMotion = () => {
        if (motionBtn) motionBtn.textContent = this.game.reduceMotion ? RB.I18n.t('on') : RB.I18n.t('off');
      };
      this.updateContrastLabel = updateContrast;
      this.updateMotionLabel = updateMotion;
      if (contrastBtn) {
        contrastBtn.addEventListener('click', () => {
          this.game.highContrast = !this.game.highContrast;
          RB.store.set('rb_contrast', this.game.highContrast);
          document.body.classList.toggle('high-contrast', this.game.highContrast);
          updateContrast();
        });
      }
      if (motionBtn) {
        motionBtn.addEventListener('click', () => {
          this.game.reduceMotion = !this.game.reduceMotion;
          RB.store.set('rb_motion', this.game.reduceMotion);
          document.body.classList.toggle('reduce-motion', this.game.reduceMotion);
          updateMotion();
        });
      }
      this.updateQualityLabel = updateQuality;
      this.updateVibLabel = updateVib;
      const crashBtn = this.$('btn-crash');
      if (crashBtn) {
        crashBtn.addEventListener('click', () => {
          const list = RB.CrashLog ? RB.CrashLog.list() : [];
          const lines = list.length
            ? list.map((c) => c.t + ' · ' + c.m)
            : ['Ошибок не зафиксировано.'];
          this.openModal({
            kicker: 'ДИАГНОСТИКА',
            title: 'ОТЧЁТ ОБ ОШИБКАХ',
            lines,
            hint: false,
            buttons: [
              { label: 'ОЧИСТИТЬ', onClick: () => { if (RB.CrashLog) RB.CrashLog.clear(); this.toast('ЛОГ ОЧИЩЕН'); } },
              { label: 'НАЗАД', onClick: () => this.showSettings('menu') }
            ]
          });
        });
      }
      const voice = this.$('voice');
      if (voice) {
        const updateVoice = () => { voice.textContent = RB.Voice.enabled ? RB.I18n.t('on') : RB.I18n.t('off'); };
        this.updateVoiceLabel = updateVoice;
        voice.addEventListener('click', () => {
          RB.Voice.setEnabled(!RB.Voice.enabled);
          updateVoice();
          RB.Sound.play('ui');
        });
        updateVoice();
      }
      qual.addEventListener('click', () => {
        this.game.setLowQuality(!this.game.lowQuality);
        updateQuality();
        RB.Sound.play('ui');
      });
      vib.addEventListener('click', () => {
        this.game.vibration = !this.game.vibration;
        RB.store.set('rb_vib', this.game.vibration);
        updateVib();
        RB.Sound.play('ui');
      });
      updateQuality();
      updateVib();
    }

    /* ---------- экраны ---------- */
    hideScreens() {
      this.menu.classList.add('hidden');
      this.modal.classList.add('hidden');
      this.pause.classList.add('hidden');
      if (this.invScreen) this.invScreen.classList.add('hidden');
      if (this.tradeScreen) this.tradeScreen.classList.add('hidden');
      const ms = document.getElementById('map-screen');
      if (ms) ms.classList.add('hidden');
      this.settings.classList.add('hidden');
    }

    fadeOut(cb) {
      this.fadeEl.classList.remove('hidden');
      requestAnimationFrame(() => this.fadeEl.classList.add('on'));
      setTimeout(() => {
        cb && cb();
        this.fadeEl.classList.remove('on');
        setTimeout(() => this.fadeEl.classList.add('hidden'), 560);
      }, 560);
    }

    showMenu(hasSave) {
      if (RB.I18n) RB.I18n.apply();
      const foot = document.querySelector('.menu-foot');
      if (foot && RB.VERSION) foot.textContent = '21+ · кровь · соль · канцелярия · v' + RB.VERSION;
      this.hideScreens();
      this.hud.classList.add('hidden');
      this.touch.classList.add('hidden');
      this.menu.classList.remove('hidden');
      const ng = RB.store.get('rb_ngplus', null);
      const ngBtn = this.$('btn-ngplus');
      if (ngBtn) ngBtn.classList.toggle('hidden', !ng);
      this.$('btn-continue').classList.toggle('hidden', !hasSave);
    }

    showHUD() {
      this.menu.classList.add('hidden');
      this.modal.classList.add('hidden');
      this.pause.classList.add('hidden');
      if (this.invScreen) this.invScreen.classList.add('hidden');
      if (this.tradeScreen) this.tradeScreen.classList.add('hidden');
      const ms = document.getElementById('map-screen');
      if (ms) ms.classList.add('hidden');
      this.settings.classList.add('hidden');
      this.hud.classList.remove('hidden');
      this.touch.classList.toggle('hidden', !this.game.input.touchMode);
    }

    showPause(stats, seedText) {
      if (RB.I18n) RB.I18n.apply();
      const pk = this.$('pause-kicker');
      const pt = this.$('pause-title');
      if (pk) pk.textContent = RB.I18n.t('pause_kicker');
      if (pt) pt.textContent = RB.I18n.t('pause_title');
      this.hideScreens();
      this.touch.classList.add('hidden');
      this.pause.classList.remove('hidden');
      const s = stats || {};
      const en = RB.I18n && RB.I18n.lang === 'en';
      const gp = window.game && window.game.player;
      const face = gp ? `<img src="${RB.Assets.playerPortrait(gp.hp / (gp.maxHp || 100), {
        salt: (gp.saltVision || 0) > 0,
        withdraw: !!(gp.drug && gp.drug.penalty > 0)
      })}" alt="ВИК" style="float:left;width:64px;height:64px;object-fit:contain;margin:0 10px 6px 0;border:1px solid rgba(201,160,90,0.35);background:rgba(0,0,0,0.25)">` : '';
      this.$('pause-stats').innerHTML = face +
        (en ? 'CASE ' : 'НАРЯД ') + `<b>${s.caseId || '13'}</b><br>` +
        (en ? 'CHAPTER ' : 'ГЛАВА ') + `<b>${s.chapter || 1} — ${s.chapterTitle || ''}</b><br>` +
        (en ? 'TIME ' : 'ВРЕМЯ ') + `<b>${s.time || '0:00'}</b><br>` +
        (en ? 'KILLED ' : 'ОТРАЖЕНО ') + `<b>${s.kills || 0}</b>` + (en ? ' · RECORDS ' : ' · ЗАПИСЕЙ ') + `<b>${s.records || 0}</b><br>` +
        (en ? 'DOCUMENTS ' : 'ДОКУМЕНТОВ ') + `<b>${s.notes || 0} / ${s.notesTotal || 0}</b><br>` +
        (en ? 'STRESS ' : 'СТРЕСС ') + `<b>${s.attention || 0}%</b> · FPS <b>${s.fps || '—'}</b><br>` +
        (en ? 'PHOTO CLUES ' : 'ФОТОУЛИКИ ') + `<b>${s.photos || 0}</b>` + (en ? ' · CULT ' : ' · КУЛЬТ ') + `<b>${s.cultRep || 0}%</b><br>` +
        (en ? 'QUESTS ' : 'КВЕСТЫ ') + `<b>${s.questsDone || 0} / ${s.questsTotal || 8}</b>` +
        (s.questList ? `<div class="pause-quests">${s.questList.map((q) => `${q.name}${q.done ? ' ✓' : ' ·'}`).join('  ')}</div>` : '');
      this.$('pause-seed').textContent = (en ? 'SEED: ' : 'СИД: ') + (seedText || '—') + (en ? ' · COPYING PROHIBITED' : ' · КОПИРОВАНИЕ ЗАПРЕЩЕНО');
    }

    showSettings(from) {
      this.settingsFrom = from || 'menu';
      if (RB.I18n) RB.I18n.apply();
      this.hideScreens();
      this.settings.classList.remove('hidden');
      this.updateQualityLabel && this.updateQualityLabel();
      this.updateVibLabel && this.updateVibLabel();
      this.updateVoiceLabel && this.updateVoiceLabel();
      this.updateContrastLabel && this.updateContrastLabel();
      this.updateMotionLabel && this.updateMotionLabel();
    }

    closeSettings() {
      if (this.settingsFrom === 'pause') {
        this.settings.classList.add('hidden');
        this.pause.classList.remove('hidden');
      } else {
        this.settings.classList.add('hidden');
        this.menu.classList.remove('hidden');
      }
    }

    /* ---------- универсальное окно ---------- */
    openModal(opts) {
      this.hideScreens();
      this.hud.classList.add('hidden');
      this.touch.classList.add('hidden');
      this.modal.classList.remove('hidden');
      this.$('modal-kicker').textContent = opts.kicker || '';
      this.$('modal-title').textContent = opts.title || '';
      this.$('modal-subtitle').textContent = opts.subtitle || '';
      const inner = this.modal.querySelector('.modal-inner');
      if (inner) {
        inner.classList.toggle('stalker', !!opts.stalker);
        const old = inner.querySelector('.stalker-head');
        if (old) old.remove();
        if (opts.stalker) {
          const head = document.createElement('div');
          head.className = 'stalker-head';
          const face = document.createElement('div');
          face.className = 'stalker-face';
          if (opts.portraitPath) {
            const pim = document.createElement('img');
            pim.src = opts.portraitPath;
            pim.alt = opts.name || '';
            face.appendChild(pim);
          } else {
            face.style.background = 'linear-gradient(160deg, ' + (opts.portrait || '#4a5a50') + ', #0b0f0a)';
            face.textContent = (opts.name || '?').slice(0, 1);
          }
          const who = document.createElement('div');
          who.className = 'stalker-who';
          who.appendChild(Object.assign(document.createElement('div'), { className: 'stalker-name', textContent: opts.name || opts.title || '' }));
          if (opts.meta) who.appendChild(Object.assign(document.createElement('div'), { className: 'stalker-meta', textContent: opts.meta }));
          head.appendChild(face); head.appendChild(who);
          inner.insertBefore(head, inner.firstChild);
        }
      }
      const text = this.$('modal-text');
      text.innerHTML = '';
      (opts.lines || []).forEach((line, i) => {
        const p = document.createElement('p');
        p.textContent = line;
        if (opts.mono) p.className = 'mono';
        text.appendChild(p);
        setTimeout(() => p.classList.add('show'), 60 + i * (opts.stagger || 0.35) * 1000);
      });
      const buttons = this.$('modal-buttons');
      buttons.innerHTML = '';
      (opts.buttons || []).forEach((b, bi) => {
        const el = document.createElement('button');
        el.className = 'menu-btn' + (b.primary ? ' primary' : '');
        el.textContent = (opts.numbered ? (bi + 1) + '. ' : '') + b.label;
        if (b.disabled) {
          el.disabled = true;
          el.style.opacity = '0.42';
          el.style.filter = 'grayscale(0.6)';
        }
        el.addEventListener('click', () => {
          RB.Sound.play('ui');
          b.onClick && b.onClick();
        });
        buttons.appendChild(el);
      });
      const hint = this.$('modal-hint');
      if (opts.hint === false) hint.classList.add('hidden');
      else {
        hint.classList.remove('hidden');
        hint.textContent = opts.hint || 'нажмите, чтобы продолжить';
      }
      this.currentModal = opts;
      if (opts.onShow) opts.onShow();
    }

    closeModal() {
      this.modal.classList.add('hidden');
    }

    /* ---------- главы / пролог ---------- */
    showSequence(opts) {
      this.openModal({
        kicker: opts.kicker || '',
        title: opts.title || '',
        subtitle: opts.subtitle || '',
        name: opts.title || '',
        meta: opts.kicker || '',
        portrait: '#2a3a2a',
        stalker: true,
        lines: opts.lines || [],
        stagger: opts.stagger || 0.55,
        buttons: [{ label: opts.button || 'ПРОДОЛЖИТЬ', primary: true, onClick: opts.onDone }],
        hint: false
      });
    }

    showChapterCard(chapter, onDone) {
      this.showSequence({
        kicker: 'НАРЯД 13 · ГЛАВА ' + chapter.id,
        title: chapter.title,
        subtitle: chapter.date,
        lines: chapter.intro,
        button: 'ВОЙТИ',
        onDone
      });
    }

    showOutro(chapter, onDone) {
      this.showSequence({
        kicker: 'ГЛАВА ' + chapter.id + ' · ЗАКРЫТА',
        title: chapter.title,
        lines: chapter.outro,
        button: 'ДАЛЬШЕ',
        onDone
      });
    }

    /* ---------- документ ---------- */
    showNote(note, onClose) {
      this.hideScreens();
      this.hud.classList.add('hidden');
      this.touch.classList.add('hidden');
      const vn = document.getElementById('vn');
      if (!vn) {
        // резервный путь
        this.openModal({ kicker: 'ДОКУМЕНТ', title: note.title, lines: [note.text], hint: false,
          buttons: [{ label: 'ЗАКРЫТЬ', onClick: onClose }] });
        return;
      }
      vn.classList.remove('hidden');
      const code = document.getElementById('vn-code');
      const title = document.getElementById('vn-title');
      const text = document.getElementById('vn-text');
      const line = document.getElementById('vn-line');
      code.textContent = note.code || 'ДОКУМЕНТ ИЗ АРХИВА';
      title.textContent = note.title || 'ДОКУМЕНТ';
      text.textContent = '';
      line.textContent = '';
      this.drawPortrait();

      const close = () => {
        RB.Voice.stop();
        clearInterval(this.vnTimer);
        vn.classList.add('hidden');
        onClose && onClose();
      };
      this.vnClose = close;

      const voiceBtn = document.getElementById('vn-voice');
      if (voiceBtn) {
        voiceBtn.textContent = 'ГОЛОС: ' + (RB.Voice.enabled ? 'ВКЛ' : 'ВЫКЛ');
        voiceBtn.onclick = () => {
          RB.Voice.setEnabled(!RB.Voice.enabled);
          voiceBtn.textContent = 'ГОЛОС: ' + (RB.Voice.enabled ? 'ВКЛ' : 'ВЫКЛ');
          if (!RB.Voice.enabled) RB.Voice.stop();
          RB.Sound.play('ui');
        };
      }
      const closeBtn = document.getElementById('vn-close');
      if (closeBtn) closeBtn.onclick = () => { RB.Sound.play('ui'); close(); };
      text.onclick = () => {
        clearInterval(this.vnTimer);
        text.textContent = note.text;
      };

      // комментарий героя
      const comments = RB.L ? { [note.id]: RB.L.noteComment(note.id) } : ((RB.Story && RB.Story.noteComments) || {});
      const comment = comments[note.id] || 'Я знаю этот почерк. Он мой.';
      let ci = 0;
      clearInterval(this.vnCommentTimer);
      this.vnCommentTimer = setInterval(() => {
        ci += 2;
        line.textContent = comment.slice(0, ci);
        if (ci >= comment.length) clearInterval(this.vnCommentTimer);
      }, 26);

      // сам документ — с эффектом машинки
      let i = 0;
      clearInterval(this.vnTimer);
      this.vnTimer = setInterval(() => {
        i += 1;
        text.textContent = note.text.slice(0, i);
        if (i >= note.text.length) clearInterval(this.vnTimer);
      }, 14);

      // голос 34-летнего мужчины
      setTimeout(() => {
        if (!vn.classList.contains('hidden')) RB.Voice.speak(note.text);
      }, 350);
    }

    drawPortrait() {
      const c = document.getElementById('vn-portrait');
      if (!c) return;
      const g = c.getContext('2d');
      const W = c.width, H = c.height;
      g.clearRect(0, 0, W, H);
      // плечи / пальто
      g.fillStyle = '#16171a';
      g.beginPath();
      g.moveTo(30, H);
      g.lineTo(60, 390);
      g.quadraticCurveTo(210, 330, 360, 390);
      g.lineTo(390, H);
      g.closePath();
      g.fill();
      // воротник
      g.fillStyle = '#2a2f36';
      g.beginPath();
      g.moveTo(150, 360);
      g.lineTo(210, 420);
      g.lineTo(270, 360);
      g.lineTo(240, 345);
      g.lineTo(210, 380);
      g.lineTo(180, 345);
      g.closePath();
      g.fill();
      // шея
      g.fillStyle = '#9a7a60';
      g.fillRect(186, 310, 48, 60);
      // голова
      const grd = g.createRadialGradient(180, 220, 30, 210, 240, 120);
      grd.addColorStop(0, '#c9a184');
      grd.addColorStop(0.7, '#a8836a');
      grd.addColorStop(1, '#6e5544');
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(210, 235, 78, 98, 0, 0, Math.PI * 2);
      g.fill();
      // уши
      g.beginPath(); g.ellipse(132, 240, 13, 24, 0, 0, Math.PI * 2); g.fillStyle = '#a8836a'; g.fill();
      g.beginPath(); g.ellipse(288, 240, 13, 24, 0, 0, Math.PI * 2); g.fill();
      // волосы
      g.fillStyle = '#221b16';
      g.beginPath();
      g.ellipse(210, 168, 80, 48, 0, Math.PI, Math.PI * 2);
      g.fill();
      g.fillRect(132, 168, 12, 55);
      g.fillRect(276, 168, 12, 55);
      // брови
      g.strokeStyle = '#2a211a'; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(160, 218); g.lineTo(196, 212); g.stroke();
      g.beginPath(); g.moveTo(224, 212); g.lineTo(260, 218); g.stroke();
      // глаза
      g.fillStyle = '#1a1512';
      g.beginPath(); g.ellipse(178, 238, 9, 5, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(242, 238, 9, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(200,170,120,0.5)';
      g.beginPath(); g.arc(180, 237, 2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(240, 237, 2, 0, Math.PI * 2); g.fill();
      // нос
      g.strokeStyle = 'rgba(80,55,40,0.55)'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(208, 240); g.lineTo(204, 270); g.lineTo(216, 274); g.stroke();
      // рот
      g.strokeStyle = '#5a3a30'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(188, 300); g.quadraticCurveTo(210, 308, 232, 300); g.stroke();
      // щетина
      g.fillStyle = 'rgba(40,30,24,0.22)';
      g.beginPath(); g.ellipse(210, 292, 55, 42, 0, 0, Math.PI * 2); g.fill();
      // шрам
      g.strokeStyle = 'rgba(140,70,55,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(252, 205); g.lineTo(262, 245); g.stroke();
      // боковой свет
      g.globalCompositeOperation = 'source-atop';
      const lg = g.createLinearGradient(300, 0, 120, 0);
      lg.addColorStop(0, 'rgba(255,220,160,0.16)');
      lg.addColorStop(0.5, 'rgba(255,220,160,0.04)');
      lg.addColorStop(1, 'rgba(255,220,160,0)');
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }

    typeText(el, full, speed) {
      clearInterval(this.typeTimer);
      let i = 0;
      el.textContent = '';
      const sp = speed || 16;
      this.typeTimer = setInterval(() => {
        i += 1;
        el.textContent = full.slice(0, i);
        if (i >= full.length) clearInterval(this.typeTimer);
      }, sp);
    }

    skipType(el, full) {
      clearInterval(this.typeTimer);
      el.textContent = full;
    }

    /* ---------- смерть ---------- */
    showDeath(message, stats, onRetry, onMenu) {
      const lines = [
        message,
        '',
        `ДЕЛО ${stats.caseId} · ГЛАВА ${stats.chapter} · ${stats.chapterTitle}`,
        `ВРЕМЯ ${stats.time} · ОТРАЖЕНО ${stats.kills} · СТРЕСС ${stats.attention}%`
      ];
      this.openModal({
        kicker: 'СМЕРТЬ',
        title: 'ВАС ОФОРМИЛИ',
        lines,
        mono: true,
        stagger: 0.3,
        hint: false,
        buttons: [
          { label: 'ПОПРОБОВАТЬ СНОВА', primary: true, onClick: onRetry },
          { label: 'В ГЛАВНОЕ МЕНЮ', onClick: onMenu }
        ]
      });
    }

    showMap(game, onClose) {
      if (RB.MapView) {
        RB.MapView.open(game, onClose);
        return;
      }
      onClose && onClose();
    }

    showInventory(game, onClose) {
      const p = game.player;
      if (!p || !p.inv) { onClose && onClose(); return; }
      const en = RB.I18n && RB.I18n.lang === 'en';
      const root = this.invBody;
      let selected = null;
      const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
      };
      const close = () => {
        this.invScreen.classList.add('hidden');
        onClose && onClose();
      };
      this.hideScreens();
      this.hud.classList.add('hidden');
      this.touch.classList.add('hidden');
      this.invScreen.classList.remove('hidden');

      const short = (it) => {
        const d = RB.Items.get(it.id) || { name: it.id };
        let n = it.customName || d.name || it.id;
        if (n.length > 14) n = n.slice(0, 13) + '…';
        return n;
      };

      const render = () => {
        root.innerHTML = '';
        const head = el('div', 'inv-head');
        head.appendChild(el('div', 'inv-kicker', en ? 'PERSONAL FILE' : 'ЛИЧНОЕ ДЕЛО'));
        head.appendChild(el('h2', 'inv-title', en ? 'INVENTORY' : 'ИНВЕНТАРЬ'));
        const face = el('img', 'inv-face');
        const withdrawing = !!(p.drug && p.drug.penalty > 0);
        face.src = RB.Assets.playerPortrait(p.hp / (p.maxHp || 100), {
          salt: (p.saltVision || 0) > 0,
          withdraw: withdrawing
        });
        face.alt = en ? 'Vik' : 'ВИК';
        face.style.cssText = 'width:42px;height:42px;object-fit:contain;border:1px solid rgba(201,160,90,0.35);background:rgba(0,0,0,0.25);';
        head.appendChild(face);
        const stats = el('div', 'inv-stats',
          (en ? 'HP ' : 'HP ') + Math.round(p.hp) + '/' + Math.round(p.maxHp) +
          ' · ' + (en ? 'TOKENS ' : 'ТАЛОНЫ ') + p.tokens +
          ' · ' + (en ? 'BATTERY ' : 'ФОНАРЬ ') + Math.round(p.battery) + '%');
        head.appendChild(stats);
        const hb = el('div', 'inv-head-btns');
        const craft = el('button', 'menu-btn small', en ? 'CRAFT' : 'КРАФТ');
        craft.type = 'button';
        craft.onclick = () => { this.showCraft(game, () => { render(); }); };
        const closeBtn = el('button', 'menu-btn small', en ? 'CLOSE' : 'ЗАКРЫТЬ');
        closeBtn.type = 'button';
        closeBtn.onclick = close;
        hb.appendChild(craft); hb.appendChild(closeBtn);
        head.appendChild(hb);
        root.appendChild(head);

        const cols = el('div', 'inv-cols');
        const eq = el('div', 'inv-equip');
        const slots = [
          ['weapon', en ? 'WEAPON' : 'ОРУЖИЕ'],
          ['armor', en ? 'ARMOR' : 'БРОНЯ'],
          ['rps', en ? 'RIG' : 'РПС'],
          ['coat', en ? 'COAT' : 'ПАЛЬТО'],
          ['jacket', en ? 'JACKET' : 'КУРТКА'],
          ['sweater', en ? 'SWEATER' : 'КОФТА'],
          ['shirt', en ? 'SHIRT' : 'ФУТБОЛКА'],
          ['hat', en ? 'HAT' : 'ГОЛОВНОЙ УБОР'],
          ['pants', en ? 'PANTS' : 'ШТАНЫ'],
          ['boots', en ? 'BOOTS' : 'САПОГИ'],
          ['gloves', en ? 'GLOVES' : 'ПЕРЧАТКИ'],
          ['helmet', en ? 'HELMET' : 'КАСКА'],
          ['mask', en ? 'MASK' : 'МАСКА']
        ];
        for (const [slot, label] of slots) {
          const it = game.getEquip(p, slot);
          const d = it && RB.Items.get(it.id);
          const row = el('button', 'inv-slot' + (it ? ' filled' : ''), '');
          row.type = 'button';
          row.appendChild(el('span', 'inv-slot-label', label));
          row.appendChild(el('span', 'inv-slot-item', it ? (d ? d.name : it.id) : '—'));
          row.onclick = () => {
            if (!it) return;
            game.unequipSlot(slot);
            selected = null;
            render();
          };
          eq.appendChild(row);
        }
        cols.appendChild(eq);

        const grids = el('div', 'inv-grids');
        const gridKeys = ['backpack', 'pockets'];
        if (game.getEquip(p, 'rps')) gridKeys.push('rps');
        for (const key of gridKeys) {
          const c = p.inv[key];
          const wrap = el('div', 'inv-container');
          const title = key === 'backpack' ? (en ? 'BACKPACK' : 'РЮКЗАК') : key === 'pockets' ? (en ? 'POCKETS' : 'КАРМАНЫ') : (en ? 'RIG · 12 MAG SLOTS' : 'РПС · 12 ЯЧЕЕК');
          wrap.appendChild(el('div', 'inv-container-title', title + '  ' + c.w + '×' + c.h));
          const grid = el('div', 'inv-grid');
          grid.style.cssText = '--cols:' + c.w + ';--rows:' + c.h + ';';
          const cell = 46;
          grid.onclick = (ev) => {
            const r = grid.getBoundingClientRect();
            const x = Math.floor((ev.clientX - r.left) / (r.width / c.w));
            const y = Math.floor((ev.clientY - r.top) / (r.height / c.h));
            const hit = c.items.find((it) => x >= it.x && x < it.x + it.w && y >= it.y && y < it.y + it.h);
            if (selected && hit && selected.uid !== hit.uid) {
              const sd = RB.Items.get(selected.id) || {};
              if (sd.kind === 'ammo' && hit.kind === 'mag') {
                game.loadMagFromAmmo(selected.uid, hit.uid);
                selected = null;
                render();
                return;
              }
              if (sd.kind === 'ammo' && hit.kind === 'ammo' && sd.stack > 0 && selected.id === hit.id) {
                game.mergeAmmo(selected.uid, hit.uid);
                render();
                return;
              }
            }
            if (selected && selected.uid !== (hit && hit.uid)) {
              const f = RB.Inv.findUid(p, selected.uid);
              if (f) {
                const moved = RB.Inv.move(p, selected.uid, c, x, y);
                if (moved) {
                  selected = f.item; game.saveProgress(); render(); return;
                }
              }
            }
            selected = hit || null;
            render();
          };
          for (const it of c.items) {
            const d = RB.Items.get(it.id) || { name: it.id, kind: 'misc' };
            const tile = el('div', 'inv-item kind-' + (d.kind || 'misc') + (selected && selected.uid === it.uid ? ' selected' : ''), '');
            tile.draggable = true;
            tile.addEventListener('dragstart', (e) => { this._dragUid = it.uid; try { e.dataTransfer.setData('text/plain', it.uid); } catch (err) {} });
            tile.addEventListener('dragover', (e) => e.preventDefault());
            tile.addEventListener('drop', (e) => {
              e.preventDefault();
              const src = this._dragUid || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
              if (!src || src === it.uid) return;
              const f = RB.Inv.findUid(p, src);
              if (!f) return;
              const sd = RB.Items.get(f.item.id) || {};
              if (sd.kind === 'ammo' && it.kind === 'mag') {
                game.loadMagFromAmmo(src, it.uid);
                this._dragUid = null;
                render();
              } else if (sd.kind === 'ammo' && it.kind === 'ammo' && f.item.id === it.id) {
                game.mergeAmmo(it.uid, src);
                this._dragUid = null;
                render();
              }
            });
            tile.style.left = 'calc(' + it.x + ' * (100% / ' + c.w + '))';
            tile.style.top = 'calc(' + it.y + ' * (100% / ' + c.h + '))';
            tile.style.width = 'calc(' + it.w + ' * (100% / ' + c.w + '))';
            tile.style.height = 'calc(' + it.h + ' * (100% / ' + c.h + '))';
            tile.appendChild(el('span', 'inv-item-name', short(it)));
            if (RB.Assets) {
              const im = document.createElement('img');
              im.src = RB.Assets.icon(it.id, it.count);
              im.className = 'inv-item-img';
              im.draggable = false;
              tile.appendChild(im);
            }
            if (d.icon) tile.appendChild(el('span', 'inv-item-icon', d.icon));
            if (it.count > 1) tile.appendChild(el('span', 'inv-item-count', '×' + it.count));
            if (d.kind === 'mag') tile.appendChild(el('span', 'inv-item-count', (it.rounds || 0) + '/' + (it.cap || 0)));
            grid.appendChild(tile);
          }
          wrap.appendChild(grid);
          grids.appendChild(wrap);
        }
        cols.appendChild(grids);
        root.appendChild(cols);

        const info = el('div', 'inv-info');
        if (!selected) {
          info.appendChild(el('div', 'inv-hint', en ? 'Tap an item to select, tap a cell to move. Equipment: tap to remove.' : 'Нажми предмет, затем ячейку — перенос. Слот экипировки: нажми, чтобы снять.'));
        } else {
          const d = RB.Items.get(selected.id) || { name: selected.id, kind: 'misc' };
          info.appendChild(el('div', 'inv-info-name', (selected.customName || d.name) + (selected.count > 1 ? ' ×' + selected.count : '')));
          const meta = (selected.w || 1) + '×' + (selected.h || 1) + ' · ' + (d.kind || 'misc');
          info.appendChild(el('div', 'inv-info-meta', meta + (d.kind === 'mag' ? ' · ' + (selected.rounds || 0) + '/' + (selected.cap || 0) : '')));
          const acts = el('div', 'inv-actions');
          const act = (label, fn, disabled) => {
            const b = el('button', 'menu-btn small', label);
            b.type = 'button';
            if (disabled) b.disabled = true;
            b.onclick = () => { fn(); render(); };
            acts.appendChild(b);
          };
          if (d.use) act(en ? 'USE' : 'ИСПОЛЬЗОВАТЬ', () => game.useItem(selected.uid));
          if (d.kind === 'weapon' || d.kind === 'clothing') act(en ? 'EQUIP' : 'НАДЕТЬ', () => game.equipUid(p, selected.uid));
          if (d.kind === 'mag') act(en ? 'LOAD' : 'СНАРЯДИТЬ', () => game.loadMag(selected.uid));
          if (d.kind === 'recipe') act(en ? 'LEARN' : 'ИЗУЧИТЬ', () => game.useItem(selected.uid));
          act(en ? 'DROP' : 'ВЫБРОСИТЬ', () => {
            game.dropItem(selected.uid);
            selected = null;
          });
          info.appendChild(acts);
        }
        root.appendChild(info);
      };
      render();
    }

    showCraft(game, onClose) {
      const p = game.player;
      const en = RB.I18n && RB.I18n.lang === 'en';
      const recipes = RB.Recipes || {};
      const known = (game.flags.recipes = game.flags.recipes || { flame: true });
      const lines = [];
      for (const id in recipes) {
        if (!known[id]) continue;
        const r = recipes[id];
        const ings = Object.keys(r.ingredients).map((k) => {
          const d = RB.Items.get(k);
          return (d ? d.name : k) + ' ' + (RB.Inv.total(p, k)) + '/' + r.ingredients[k];
        }).join(' · ');
        lines.push({ id, text: r.name + ' → ' + (RB.Items.get(r.result) ? RB.Items.get(r.result).name : r.result) + ' ×' + r.count + ' | ' + ings });
      }
      const buttons = Object.keys(recipes).filter((id) => known[id]).map((id) => ({
        label: (en ? 'CRAFT: ' : 'СКРАФТИТЬ: ') + recipes[id].name,
        onClick: () => {
          if (game.craftRecipe(id)) {
            RB.Sound.play('pickup');
            this.toast((en ? 'CRAFTED: ' : 'СКРАФЧЕНО: ') + recipes[id].name);
          } else {
            RB.Sound.play('deny');
            this.toast(en ? 'NOT ENOUGH MATERIALS' : 'НЕ ХВАТАЕТ МАТЕРИАЛОВ');
          }
          this.showCraft(game, onClose);
        }
      }));
      buttons.push({ label: en ? 'BACK' : 'НАЗАД', onClick: () => {
        this.closeModal();
        if (game.craftReturn === 'table') { game.craftReturn = null; onClose && onClose(); }
        else { this.invScreen.classList.remove('hidden'); onClose && onClose(); }
      } });
      this.openModal({
        kicker: en ? 'WORKBENCH' : 'ВЕРСТАК',
        title: en ? 'CRAFTING' : 'КРАФТ',
        subtitle: en ? 'Known recipes' : 'Известные рецепты',
        lines: lines.length ? lines.map((l) => l.text) : [en ? 'No recipes known.' : 'Рецептов нет.'],
        mono: true,
        hint: false,
        buttons
      });
    }

    showDev(rpg, onBuy, onClose) {
      const up = rpg.upgrades;
      const rows = [
        ['hp', 'ЦЕЛОСТНОСТЬ +15', up.hp],
        ['stamina', 'ВЫНОСЛИВОСТЬ +15%', up.stamina],
        ['attention', 'СОПРОТИВЛЕНИЕ ВНИМАНИЮ', up.attention],
        ['damage', 'УРОН +8%', up.damage],
        ['meds', 'АПТЕЧКИ +8', up.meds],
        ['leg', 'СИЛА НОГИ +25%', up.leg || 0]
      ];
      const buttons = rows.map(([key, label, lvl]) => ({
        label: label + ' · ур.' + lvl,
        disabled: rpg.points <= 0 || (key === 'leg' && lvl >= 4),
        onClick: () => onBuy(key)
      }));
      buttons.push({ label: 'НАЗАД', onClick: onClose });
      this.openModal({
        kicker: 'РАЗВИТИЕ · УРОВЕНЬ ' + rpg.level,
        title: 'ОЧКОВ: ' + rpg.points,
        subtitle: 'XP ' + rpg.xp + ' / ' + (60 + rpg.level * 40),
        lines: ['Каждая смена делает тебя чуть менее человеком. Но чуть более живым.'],
        stagger: 0.2,
        hint: false,
        buttons
      });
    }

    showMail(mails, onClose) {
      const list = () => {
        this.openModal({
          kicker: 'СЛУЖЕБНАЯ ПОЧТА · ТЕРМИНАЛ',
          title: 'ВХОДЯЩИЕ',
          subtitle: mails.length + ' писем · часть адресована вам до приезда',
          lines: ['Терминал мигает. Клавиатура тёплая. Кто-то читал эти письма раньше вас.'],
          hint: false,
          buttons: mails.map((m, i) => ({
            label: (i + 1) + '. ' + m.subject,
            onClick: () => read(m)
          })).concat([{ label: 'ЗАКРЫТЬ', onClick: onClose }])
        });
      };
      const read = (m) => {
        this.openModal({
          kicker: 'ПИСЬМО · ' + m.from,
          title: m.subject,
          subtitle: m.date,
          lines: m.lines,
          hint: false,
          buttons: [
            { label: '← К СПИСКУ', onClick: list },
            { label: 'ЗАКРЫТЬ', onClick: onClose }
          ]
        });
      };
      list();
    }

    showConsoleLogs(logs, onClose) {
      this.openModal({
        kicker: 'КОНСОЛЬ СМЕНЫ · ЖУРНАЛ',
        title: 'ACCESS GRANTED',
        subtitle: 'терминал уже вскрыт',
        lines: logs,
        mono: true,
        hint: false,
        buttons: [{ label: 'ЗАКРЫТЬ', onClick: onClose }]
      });
    }

    showShop(shop, tokens, onBuy, onClose) {
      const buttons = [];
      for (const it of shop.stock) {
        if (it.sold) continue;
        const affordable = tokens >= it.price;
        const itl = RB.L ? RB.L.shop(it) : it;
        buttons.push({
          label: itl.name + ' · ' + it.price + (RB.I18n && RB.I18n.lang === 'en' ? ' T' : ' Т'),
          disabled: !affordable,
          onClick: () => onBuy(it)
        });
      }
      buttons.push({ label: RB.I18n && RB.I18n.lang === 'en' ? 'LEAVE' : 'УЙТИ', onClick: onClose });
      const en = RB.I18n && RB.I18n.lang === 'en';
      this.openModal({
        kicker: en ? 'TRADER' : 'ТОРГОВЕЦ',
        title: (en ? 'TOKENS: ' : 'ТАЛОНЫ: ') + tokens,
        subtitle: en ? 'Stock changes. Tokens are non-refundable.' : 'Ассортимент меняется. Талоны не возвращаются.',
        lines: [en ? 'Take while they give. Soon they will stop.' : '«Бери, пока дают. Потом давать перестанут».'],
        stagger: 0.2,
        hint: false,
        buttons
      });
    }

    /* ---------- NPC ---------- */
    showNpc(npc, done, onQuest, onClose, scheduleLines, state, onTrade) {
      const lines = done ? npc.lines.done : (scheduleLines || npc.lines.first);
      const buttons = [];
      if (!done) {
        buttons.push({ label: 'КВЕСТ: ' + npc.quest.title, primary: true, onClick: onQuest });
        buttons.push({ label: 'О ЧЁМ ЭТО?', onClick: () => this.showNpcTalk(npc, onQuest, onClose, state, onTrade) });
      } else {
        buttons.push({ label: 'ПОГОВОРИТЬ', onClick: () => this.showNpcTalk(npc, onQuest, onClose, state, onTrade) });
      }
      buttons.push({ label: 'ТОРГОВАТЬ', onClick: onTrade });
      buttons.push({ label: 'УЙТИ', onClick: onClose });
      const meta = state ? ('УР. ' + state.level + ' · ТАЛОНЫ ' + state.currency) : '';
      this.openModal({
        kicker: npc.role.toUpperCase(),
        title: npc.name,
        subtitle: npc.story,
        name: npc.name,
        meta,
        portrait: npc.color,
        portraitPath: RB.Assets ? RB.Assets.portrait(npc.id) : null,
        stalker: true,
        numbered: true,
        lines: ['ВЫ: «Здравствуй, ' + npc.name + '».'].concat(lines.map((l) => npc.name + ': «' + l + '»')),
        stagger: 0.25,
        hint: false,
        buttons
      });
    }

    showNpcTalk(npc, onQuest, onClose, state, onTrade) {
      const buttons = [];
      const replies = [
        { label: 'КТО ТЫ?', q: 'Кто ты?', a: npc.story || (npc.lines.first || []).join(' ') },
        { label: 'ЧТО ЗДЕСЬ ПРОИСХОДИТ?', q: 'Что здесь происходит?', a: (npc.lines.quest || npc.lines.idle || []).join(' ') },
        { label: 'О СМЕНЕ', q: 'Что такое смена?', a: (npc.lines.idle || npc.lines.first || []).join(' ') }
      ];
      const fl = (window.game && window.game.flags) || {};
      const extras = (RB.Story.npcExtras && RB.Story.npcExtras[npc.id]) || [];
      for (const q of extras) {
        if (q.require && !fl[q.require]) continue;
        replies.push({ label: q.label, q: q.q, a: q.a });
      }
      for (const q of (RB.Story.sharedQuestions || [])) {
        if (q.require && !fl[q.require]) continue;
        if (replies.some((x) => x.label === q.label)) continue;
        replies.push({ label: q.label, q: q.q, a: q.a });
      }
      for (const r of replies) {
        buttons.push({ label: r.label, onClick: () => this.showNpcReply(npc, r.q, r.a, onQuest, onClose, state, onTrade) });
      }
      if (npc.quest) buttons.push({ label: 'ЗАДАНИЕ: ' + npc.quest.title, primary: true, onClick: onQuest });
      buttons.push({ label: 'ТОРГОВАТЬ', onClick: onTrade });
      buttons.push({ label: 'НАЗАД', onClick: () => this.showNpc(npc, false, onQuest, onClose, null, state, onTrade) });
      const meta = state ? ('УР. ' + state.level + ' · ТАЛОНЫ ' + state.currency) : '';
      this.openModal({
        kicker: npc.role.toUpperCase(),
        title: npc.name,
        subtitle: 'ВЫ: МЕЧЕНЫЙ · ' + (state ? 'ТАЛОНЫ ' + state.currency : ''),
        name: npc.name,
        meta,
        portrait: npc.color,
        portraitPath: RB.Assets ? RB.Assets.portrait(npc.id) : null,
        stalker: true,
        numbered: true,
        lines: ['ВЫ: «' + replies[0].q + '»', npc.name + ': «' + replies[0].a + '»'],
        stagger: 0.2,
        hint: false,
        buttons
      });
    }

    showNpcReply(npc, question, answer, onQuest, onClose, state, onTrade) {
      const meta = state ? ('УР. ' + state.level + ' · ТАЛОНЫ ' + state.currency) : '';
      this.openModal({
        kicker: npc.role.toUpperCase(),
        title: npc.name,
        subtitle: 'ДИАЛОГ',
        name: npc.name,
        meta,
        portrait: npc.color,
        portraitPath: RB.Assets ? RB.Assets.portrait(npc.id) : null,
        stalker: true,
        numbered: true,
        lines: ['ВЫ: «' + question + '»', npc.name + ': «' + answer + '»'],
        hint: false,
        buttons: [
          { label: 'ЕЩЁ ВОПРОС', onClick: () => this.showNpcTalk(npc, onQuest, onClose, state, onTrade) },
          { label: 'ТОРГОВАТЬ', onClick: onTrade },
          { label: 'НАЗАД', onClick: () => this.showNpc(npc, false, onQuest, onClose, null, state, onTrade) }
        ]
      });
    }

    showNpcTrade(npc, st, stock, player, onBuy, onSell, onBargain, onClose) {
      const en = RB.I18n && RB.I18n.lang === 'en';
      const root = this.tradeBody;
      let selected = null;
      const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
      };
      this.hideScreens();
      this.hud.classList.add('hidden');
      this.touch.classList.add('hidden');
      this.tradeScreen.classList.remove('hidden');
      const render = () => {
        root.innerHTML = '';
        const head = el('div', 'trade-head');
        const face = el('img', 'trade-face');
        face.src = RB.Assets ? RB.Assets.portrait(npc.id) : '';
        face.alt = npc.name;
        const who = el('div', 'trade-who');
        who.appendChild(el('div', 'trade-name', npc.name));
        who.appendChild(el('div', 'trade-meta', (en ? 'LVL ' : 'УР. ') + st.level + ' · ' + (en ? 'TOKENS ' : 'ТАЛОНЫ ') + st.currency + ' · ' + (st.bargain ? (en ? 'DISCOUNT 15%' : 'СКИДКА 15%') : (en ? 'NO DISCOUNT' : 'БЕЗ СКИДКИ'))));
        const close = el('button', 'menu-btn small', en ? 'CLOSE' : 'ЗАКРЫТЬ');
        close.type = 'button'; close.onclick = onClose;
        head.appendChild(face); head.appendChild(who); head.appendChild(close);

        const cols = el('div', 'trade-cols');
        const stockWrap = el('div', 'trade-col');
        stockWrap.appendChild(el('div', 'trade-title', en ? 'SELLER STOCK' : 'ТОВАР'));
        const stockGrid = el('div', 'trade-grid');
        for (const it of stock) {
          if (it.sold) continue;
          const price = Math.round(it.price * (st.bargain ? 0.85 : 1));
          const tile = el('button', 'trade-tile' + (selected && selected.it === it ? ' selected' : ''));
          tile.type = 'button';
          const stockCount = it.count || it.amount || (it.weapon === 'shotgun' ? 8 : it.weapon === 'ak74' ? 30 : 16);
          const im = el('img', 'trade-icon'); im.src = RB.Assets ? RB.Assets.icon(RB.Items.get(it.item) ? it.item : (it.weapon ? 'w_' + it.weapon : it.id), stockCount) : '';
          tile.appendChild(im);
          tile.appendChild(el('span', 'trade-tile-name', it.name));
          tile.appendChild(el('span', 'trade-tile-price', price + ' T'));
          tile.onclick = () => { selected = { type: 'stock', it, price }; render(); };
          stockGrid.appendChild(tile);
        }
        stockWrap.appendChild(stockGrid);

        const playerWrap = el('div', 'trade-col');
        playerWrap.appendChild(el('div', 'trade-title', en ? 'YOUR ITEMS' : 'ВАШИ ВЕЩИ'));
        const playerGrid = el('div', 'trade-grid');
        const items = [];
        for (const key of ['backpack', 'pockets', 'rps']) {
          const c = player.inv[key];
          if (!c) continue;
          for (const it of c.items) {
            if (it.kind === 'key' || it.kind === 'document') continue;
            items.push(it);
          }
        }
        for (const it of items) {
          const d = RB.Items.get(it.id) || { name: it.id };
          const price = Math.max(1, Math.floor(RB.Items.value(it.id) * 0.5));
          const tile = el('button', 'trade-tile' + (selected && selected.uid === it.uid ? ' selected' : ''));
          tile.type = 'button';
          const im = el('img', 'trade-icon'); im.src = RB.Assets ? RB.Assets.icon(it.id, it.count) : '';
          tile.appendChild(im);
          tile.appendChild(el('span', 'trade-tile-name', it.customName || d.name));
          tile.appendChild(el('span', 'trade-tile-price', (it.count > 1 ? '×' + it.count + ' · ' : '') + price + ' T'));
          tile.onclick = () => { selected = { type: 'player', uid: it.uid, price }; render(); };
          playerGrid.appendChild(tile);
        }
        playerWrap.appendChild(playerGrid);
        cols.appendChild(stockWrap); cols.appendChild(playerWrap);

        const info = el('div', 'trade-info');
        if (!selected) info.appendChild(el('div', 'inv-hint', en ? 'Pick an item. Then buy or sell.' : 'Выбери предмет, затем купи или продай.'));
        else {
          const name = selected.type === 'stock' ? selected.it.name : ((RB.Items.get((RB.Inv.findUid(player, selected.uid) || {}).item ? RB.Inv.findUid(player, selected.uid).item.id : '') || {}).name || 'предмет');
          info.appendChild(el('div', 'inv-info-name', name + ' · ' + selected.price + ' T'));
          const acts = el('div', 'inv-actions');
          if (selected.type === 'stock') {
            const b = el('button', 'menu-btn', en ? 'BUY' : 'КУПИТЬ'); b.type = 'button'; b.onclick = () => onBuy(selected.it); acts.appendChild(b);
          } else {
            const b = el('button', 'menu-btn', en ? 'SELL' : 'ПРОДАТЬ'); b.type = 'button'; b.onclick = () => onSell(selected.uid); acts.appendChild(b);
          }
          info.appendChild(acts);
        }
        const bar = el('div', 'inv-actions trade-actions');
        const bargain = el('button', 'menu-btn small', en ? 'BARGAIN' : 'ПОТОРГОВАТЬСЯ');
        bargain.type = 'button'; bargain.onclick = onBargain;
        const back = el('button', 'menu-btn small', en ? 'BACK' : 'НАЗАД');
        back.type = 'button'; back.onclick = onClose;
        bar.appendChild(bargain); bar.appendChild(back);
        root.appendChild(head); root.appendChild(cols); root.appendChild(info); root.appendChild(bar);
      };
      render();
    }

    /* ---------- финальный выбор ---------- */
    showChoice(choices, onPick) {
      this.openModal({
        kicker: 'КЕССОН 9 · 03:13',
        title: 'КРЫШКА НЕ ЗАПЕРТА',
        subtitle: 'ВНУТРИ КТО-ТО ДЫШИТ',
        lines: ['На крышке сидит девочка в белом халате. Она считает вслух. Братья стоят вокруг и ждут.'],
        stagger: 0.2,
        hint: false,
        buttons: choices.map((c) => ({
          label: c.disabled ? c.label + ' · НЕДОСТУПНО' : c.label,
          primary: !c.disabled,
          onClick: () => {
            if (c.disabled) {
              this.toast(c.hint || 'НЕ ХВАТАЕТ УСЛОВИЙ');
              RB.Sound.play('deny');
              return;
            }
            onPick(c.id);
          }
        }))
      });
    }

    showEnding(ending, onMenu) {
      this.openModal({
        kicker: 'КОНЕЦ',
        title: ending.title,
        lines: ending.lines,
        stagger: 0.8,
        hint: false,
        buttons: [{ label: 'В ГЛАВНОЕ МЕНЮ', primary: true, onClick: onMenu }]
      });
    }

    showAbout(onBack) {
      this.openModal({
        kicker: 'ОБ ИГРЕ · 21+',
        title: 'РЖАВАЯ БОЧКА',
        lines: [
          'Хоррор-выживание сверху. Остров Крутой, рыбзавод «Бочка», 1994.',
          '',
          'Соль-13 сохраняет не жизнь, а привычку. Смена из сохранённых рабочих не нападает — она оформляет. Культ «Братья Тихого берега» считает это чудом.',
          '',
          'Пять глав, восемь NPC с необязательными квестами и мини-играми, четыре концовки. Планировка, лут и враги зависят от сида.',
          '',
          'Управление: левый стик — движение, правый — прицел и огонь. Справа: фонарь, перезарядка, удар, действие, запись времени. На ПК: WASD, мышь, R, F, E, Q, ПРОБЕЛ, SHIFT, ESC.',
          '',
          'Фонарь удерживает Тихих, но Мокрый идёт на свет. Патроны не убивают — дают отсрочку. Аптечки лечат и дают побочки. Кровь, расчленёнка и вещества — 21+.',
          '',
          'Игра сделана для телефона: одна рука — движение, вторая — огонь и действия.'
        ],
        stagger: 0.18,
        hint: false,
        buttons: [{ label: 'НАЗАД', onClick: onBack }]
      });
    }

    /* ---------- HUD ---------- */
    setRecordEnabled(on) {
      const b = this.$('btn-record');
      if (!b) return;
      b.disabled = !on;
      b.classList.toggle('disabled', !on);
      b.style.opacity = on ? '' : '0.35';
      b.style.filter = on ? '' : 'grayscale(1)';
    }

    setPrompt(text) {
      if (text === this.promptText) return;
      this.promptText = text;
      if (!text) this.promptEl.classList.add('hidden');
      else {
        this.promptEl.textContent = text;
        this.promptEl.classList.remove('hidden');
      }
    }

    toast(text) {
      this.toastEl.textContent = text;
      this.toastEl.classList.add('show');
      this.toastTimer = 2.6;
    }

    subtitle(text, dur) {
      this.subtitleEl.textContent = text;
      this.subtitleEl.classList.add('show');
      this.subTimer = dur || 4.5;
    }

    roomName(name) {
      this.roomLabel.textContent = RB.L ? RB.L.room(name) : name;
      this.roomLabel.classList.add('show');
      this.roomTimer = 3.4;
    }

    update(dt) {
      if (this.subTimer > 0) {
        this.subTimer -= dt;
        if (this.subTimer <= 0) this.subtitleEl.classList.remove('show');
      }
      if (this.roomTimer > 0) {
        this.roomTimer -= dt;
        if (this.roomTimer <= 0) this.roomLabel.classList.remove('show');
      }
      if (this.toastTimer > 0) {
        this.toastTimer -= dt;
        if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
      }
      if (this.typeTimer) {
        // таймер сам себя очистит
      }
    }

    updateHUD(game) {
      const p = game.player;
      if (!p) return;
      const hp = Math.round(p.hp);
      if (this.last.hp !== hp) {
        this.last.hp = hp;
        this.barHp.style.width = Math.max(0, (p.hp / p.maxHp) * 100) + '%';
        this.barHp.classList.toggle('low', p.hp < 35);
      }
      const st = Math.round(p.stamina);
      if (this.last.st !== st) {
        this.last.st = st;
        this.barSt.style.width = st + '%';
      }
      const bat = Math.round(p.battery);
      if (this.last.bat !== bat) {
        this.last.bat = bat;
        this.barBat.style.width = bat + '%';
        this.barBat.classList.toggle('low', bat < 25);
      }
      if (this.tokensEl && this.last.tokens !== p.tokens) {
        this.last.tokens = p.tokens;
        this.tokensEl.textContent = 'ТАЛОНЫ: ' + p.tokens;
      }
      const att = Math.round(p.attention);
      if (this.last.att !== att) {
        this.last.att = att;
        this.barAtt.style.width = att + '%';
        this.barAtt.classList.toggle('high', att > 70);
      }
      const ammoStr = p.ammo + '|' + p.reserve;
      if (this.last.ammo !== ammoStr) {
        this.last.ammo = ammoStr;
        this.ammoEl.innerHTML = p.ammo + '<span>/' + p.reserve + '</span>';
        this.ammoEl.classList.toggle('empty', p.ammo === 0);
      }
      const w = RB.Weapons && RB.Weapons[p.weapon];
      const wsig = p.weapon + '|' + p.laser + '|' + (p.reloadTimer > 0 ? 1 : 0);
      if (w && this.last.weapon !== wsig) {
        this.last.weapon = wsig;
        this.weaponLabel.textContent = ((RB.L && RB.L.weapon(p.weapon)) || w.name) + (p.reloadTimer > 0 ? (RB.I18n && RB.I18n.lang === 'en' ? ' · RELOADING' : ' · ПЕРЕЗАРЯДКА') : '') + (p.laser && p.laserOwned && w.laser ? (RB.I18n && RB.I18n.lang === 'en' ? ' · LASER' : ' · ЛАЗЕР') : '');
        this.weaponLabel.style.color = p.reloadTimer > 0 ? '#c9a05a' : w.color;
      }
      // цели
      const goals = game.goals || [];
      const sig = goals.map((g) => g.text + ':' + (g.done ? 1 : 0) + ':' + g.have).join('§');
      if (this.last.goals !== sig) {
        this.last.goals = sig;
        this.objList.innerHTML = '';
        for (const g of goals) {
          const li = document.createElement('li');
          if (g.done) li.className = 'done';
          li.textContent = g.text;
          if (!g.done && g.need > 1) {
            const sp = document.createElement('span');
            sp.className = 'count';
            sp.textContent = `  ${g.have}/${g.need}`;
            li.appendChild(sp);
          }
          this.objList.appendChild(li);
        }
      }
    }
  }

  RB.UI = UI;
})();
