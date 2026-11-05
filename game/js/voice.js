/* ============================================================
   RUSTY BARREL — голос героя (TTS, ru-RU)
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});

  RB.Voice = {
    enabled: RB.store.get('rb_voice', true),
    synth: typeof window !== 'undefined' ? window.speechSynthesis : null,
    voice: null,
    utter: null,

    pickVoice() {
      if (!this.synth) return null;
      const voices = this.synth.getVoices ? this.synth.getVoices() : [];
      if (!voices || !voices.length) return null;
      const ru = voices.filter((v) => (v.lang || '').toLowerCase().indexOf('ru') === 0);
      const male = ru.find((v) => /yuri|pavel|dmitry|artem|ivan|maxim|male|муж/i.test(v.name || ''));
      return male || ru[0] || null;
    },

    refresh() {
      this.voice = this.pickVoice();
    },

    setEnabled(v) {
      this.enabled = !!v;
      RB.store.set('rb_voice', this.enabled);
      if (!this.enabled) this.stop();
    },

    speak(text) {
      if (!this.enabled || !text) return;
      try {
        if (window.AndroidHost && window.AndroidHost.speak) {
          this.stop();
          window.AndroidHost.speak(String(text).replace(/\s+/g, ' ').trim());
          return;
        }
      } catch (e) {}
      if (!this.synth) return;
      try {
        this.stop();
        const clean = String(text).replace(/\s+/g, ' ').trim();
        const u = new SpeechSynthesisUtterance(clean);
        u.lang = 'ru-RU';
        u.pitch = 0.78;      // ниже — ближе к мужскому голосу 34 лет
        u.rate = 0.92;
        u.volume = 1;
        if (!this.voice) this.refresh();
        if (this.voice) u.voice = this.voice;
        this.utter = u;
        this.synth.speak(u);
      } catch (e) {
        // нет TTS — просто молчим
      }
    },

    stop() {
      try {
        if (window.AndroidHost && window.AndroidHost.stopSpeaking) window.AndroidHost.stopSpeaking();
      } catch (e) {}
      try {
        if (this.synth) this.synth.cancel();
      } catch (e) {}
      this.utter = null;
    }
  };

  if (RB.Voice.synth) {
    RB.Voice.refresh();
    if (typeof RB.Voice.synth.addEventListener === 'function') {
      RB.Voice.synth.addEventListener('voiceschanged', () => RB.Voice.refresh());
    }
  }
})();
