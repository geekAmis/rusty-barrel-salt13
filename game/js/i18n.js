/* RUSTY BARREL — i18n framework (R007) */
(function () {
  const RB = (window.RB = window.RB || {});
  const dict = {
    ru: {
      new_game: 'НОВАЯ СМЕНА', new_game_plus: 'НОВАЯ СМЕНА+', continue: 'ПРОДОЛЖИТЬ СМЕНУ', settings: 'НАСТРОЙКИ',
      archive: 'АРХИВ', resume: 'ПРОДОЛЖИТЬ', menu: 'В ГЛАВНОЕ МЕНЮ',
      difficulty: 'Сложность', control: 'Управление', voice: 'Голос героя',
      quality: 'Качество графики', volume: 'Громкость', vibration: 'Вибрация',
      font: 'Размер текста', shake: 'Тряска', crosshair: 'Прозрачность крестика',
      contrast: 'Высокий контраст', motion: 'Меньше тряски',
      pause_kicker: 'ДЕЛО ПРИОСТАНОВЛЕНО', pause_title: 'АРХИВ ЖДЁТ',
      map: 'КАРТА', inventory: 'ИНВЕНТАРЬ', dev: 'РАЗВИТИЕ',
      settings_kicker: 'НАСТРОЙКИ', settings_title: 'СЛУХ И ЗРЕНИЕ', language: 'Язык',
      layout: 'РАСПОЛОЖЕНИЕ КНОПОК', crash: 'ОТЧЁТ ОБ ОШИБКЕ', back: 'НАЗАД',
      hud_objective: 'ЗАДАЧА', hud_hp: 'ЦЕЛОСТНОСТЬ', hud_stamina: 'ВЫНОСЛИВОСТЬ',
      hud_battery: 'ФОНАРЬ', hud_attention: 'СТРЕСС', tokens: 'ТАЛОНЫ',
      on: 'ВКЛ', off: 'ВЫКЛ', high: 'ВЫСОКОЕ', low: 'НИЗКОЕ',
      lang_ru: 'РУССКИЙ', lang_en: 'ENGLISH'
    },
    en: {
      new_game: 'NEW SHIFT', new_game_plus: 'NEW SHIFT+', continue: 'CONTINUE SHIFT', settings: 'SETTINGS',
      archive: 'ARCHIVE', resume: 'RESUME', menu: 'MAIN MENU',
      difficulty: 'Difficulty', control: 'Controls', voice: 'Hero voice',
      quality: 'Graphics quality', volume: 'Volume', vibration: 'Vibration',
      font: 'Text size', shake: 'Screen shake', crosshair: 'Crosshair opacity',
      contrast: 'High contrast', motion: 'Reduce motion',
      pause_kicker: 'CASE SUSPENDED', pause_title: 'THE ARCHIVE WAITS',
      map: 'MAP', inventory: 'INVENTORY', dev: 'DEVELOPMENT',
      settings_kicker: 'SETTINGS', settings_title: 'SIGHT AND SOUND', language: 'Language',
      layout: 'BUTTON LAYOUT', crash: 'ERROR REPORT', back: 'BACK',
      hud_objective: 'OBJECTIVE', hud_hp: 'INTEGRITY', hud_stamina: 'STAMINA',
      hud_battery: 'FLASHLIGHT', hud_attention: 'ATTENTION', tokens: 'TOKENS',
      on: 'ON', off: 'OFF', high: 'HIGH', low: 'LOW',
      lang_ru: 'РУССКИЙ', lang_en: 'ENGLISH'
    }
  };
  RB.I18n = {
    lang: (function () {
      try { return localStorage.getItem('rb_lang') === 'en' ? 'en' : 'ru'; } catch (e) { return 'ru'; }
    })(),
    set(lang) {
      this.lang = lang === 'en' ? 'en' : 'ru';
      try { localStorage.setItem('rb_lang', this.lang); } catch (e) {}
      if (RB.store) RB.store.set('rb_lang', this.lang);
      this.apply();
      try {
        if (typeof window !== 'undefined' && window.game && window.game.applyLanguage) window.game.applyLanguage();
      } catch (e) {}
    },
    toggle() { this.set(this.lang === 'en' ? 'ru' : 'en'); },
    t(key) { const d = dict[this.lang] || dict.ru; return d[key] || key; },
    apply() {
      if (typeof document === 'undefined') return;
      const set = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.textContent = this.t(key);
      };
      set('btn-continue', 'continue');
      set('btn-ngplus', 'new_game_plus');
      set('btn-new', 'new_game');
      set('btn-settings', 'settings');
      set('btn-about', 'archive');
      set('btn-resume', 'resume');
      set('btn-map', 'map');
      set('btn-inv', 'inventory');
      set('btn-dev', 'dev');
      set('btn-pause-settings', 'settings');
      set('btn-pause-menu', 'menu');
      set('settings-kicker', 'settings_kicker');
      set('settings-title', 'settings_title');
      set('btn-layout', 'layout');
      set('btn-crash', 'crash');
      set('btn-settings-close', 'back');
      set('label-lang', 'language');
      set('label-vol', 'volume');
      set('label-qual', 'quality');
      set('label-vib', 'vibration');
      set('label-voice', 'voice');
      set('label-contrast', 'contrast');
      set('label-motion', 'motion');
      set('obj-title', 'hud_objective');
      set('hud-hp', 'hud_hp');
      set('hud-stamina', 'hud_stamina');
      set('hud-battery', 'hud_battery');
      set('hud-attention', 'hud_attention');
      const langBtn = document.getElementById('lang');
      if (langBtn) langBtn.textContent = this.lang === 'en' ? 'ENGLISH' : 'РУССКИЙ';
      const html = document.documentElement;
      if (html) html.lang = this.lang;
    }
  };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => RB.I18n.apply());
    else RB.I18n.apply();
  }
})();
