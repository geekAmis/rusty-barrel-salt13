/* ============================================================
   RUSTY BARREL — процедурный звук (WebAudio, без файлов)
   ============================================================ */
(function () {
  const RB = (window.RB = window.RB || {});

  class SoundSystem {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.ambientGain = null;
      this.ened = false;
      this.noiseBuf = null;
      this.volume = RB.store.get('rb_vol', 0.8);
      this.muted = RB.store.get('rb_mute', false);
      this.heartTimer = 0;
      this.whisperTimer = 6;
    }

    init() {
      if (this.ctx) {
        this.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.noiseBuf = this.makeNoise(2.0);
      this.startAmbient();
    }

    setVolume(v) {
      this.volume = RB.clamp(v, 0, 1);
      RB.store.set('rb_vol', this.volume);
      if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    }

    setMuted(m) {
      this.muted = m;
      RB.store.set('rb_mute', m);
      if (this.master) this.master.gain.value = m ? 0 : this.volume;
    }

    suspend() {
      try { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); } catch (e) {}
    }

    resume() {
      try {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
        if (this.ambientGain) this.ambientGain.gain.value = 0.55;
      } catch (e) {}
    }

    stopAll() {
      try {
        if (!this.ctx) return;
        if (this.master) {
          this.master.gain.cancelScheduledValues(this.ctx.currentTime);
          this.master.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        if (this.ambientGain) this.ambientGain.gain.value = 0;
        this.ctx.suspend();
      } catch (e) {}
    }

    makeNoise(seconds) {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * seconds);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    startAmbient() {
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.gain.value = 0.0;
      g.connect(this.master);
      this.ambientGain = g;

      // низкий гул завода
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 41.2;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      const og = ctx.createGain();
      og.gain.value = 0.09;
      osc1.connect(lp); lp.connect(og); og.connect(g);
      osc1.start();

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 55;
      const og2 = ctx.createGain();
      og2.gain.value = 0.05;
      osc2.connect(og2); og2.connect(g);
      osc2.start();

      // "дыхание" завода — шум сквозь полосовой фильтр
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 320;
      bp.Q.value = 0.6;
      const ng = ctx.createGain();
      ng.gain.value = 0.05;
      src.connect(bp); bp.connect(ng); ng.connect(g);
      src.start();

      // медленная модуляция — эффект "дыхания"
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.07;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 60;
      lfo.connect(lfoG); lfoG.connect(bp.frequency);
      lfo.start();

      g.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 4);
      this.ambient = g;
      this.ambientBP = bp;
    }

    ambientTension(fear) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(0.45 + fear * 0.5, t, 0.6);
      if (this.ambientBP) this.ambientBP.frequency.setTargetAtTime(280 + fear * 500, t, 0.8);
    }

    env(node, attack, decay, peak) {
      const t = this.ctx.currentTime;
      const g = node.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(0.0001, t);
      g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
      g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }

    noise(dur, freq, q, gain, type = 'bandpass') {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.playbackRate.value = RB.rand(0.85, 1.15);
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      src.connect(f); f.connect(g); g.connect(this.master);
      this.env(g, 0.005, dur, gain);
      src.start();
      src.stop(ctx.currentTime + dur + 0.1);
      return { src, f, g };
    }

    tone(freq, dur, type, gain, slideTo, delay = 0) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = type;
      const t0 = ctx.currentTime + delay;
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      const g = ctx.createGain();
      o.connect(g); g.connect(this.master);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
      return o;
    }

    play(name, opts = {}) {
      if (!this.ctx || this.muted) return;
      const pan = opts.pan || 0;
      switch (name) {
        case 'shot':
          this.noise(0.22, 900, 0.7, 0.9, 'lowpass');
          this.tone(160, 0.16, 'square', 0.22, 45);
          this.noise(0.5, 220, 0.4, 0.25, 'lowpass');
          break;
        case 'shotgun':
          this.noise(0.34, 620, 0.8, 0.9, 'lowpass');
          this.tone(110, 0.24, 'square', 0.25, 40);
          this.noise(0.5, 180, 0.4, 0.22, 'lowpass');
          break;
        case 'ak':
          this.noise(0.1, 1500, 0.8, 0.5, 'bandpass');
          this.tone(190, 0.08, 'square', 0.14, 70);
          break;
        case 'flame':
          this.noise(0.22, 900 + RB.rand(0, 300), 0.7, 0.22, 'bandpass');
          this.tone(70, 0.18, 'sawtooth', 0.05, 50);
          break;
        case 'harpoon':
          this.noise(0.18, 2200, 1.2, 0.18, 'bandpass');
          this.tone(320, 0.3, 'sawtooth', 0.1, 90);
          break;
        case 'dry':
          this.tone(1200, 0.03, 'square', 0.06, 700);
          break;
        case 'reload':
          this.tone(760, 0.05, 'square', 0.07, 420);
          this.tone(300, 0.09, 'square', 0.06, 200, 0.18);
          this.noise(0.08, 2600, 2, 0.12, 'bandpass');
          break;
        case 'melee':
          this.noise(0.14, 1400, 0.8, 0.28, 'bandpass');
          this.tone(90, 0.12, 'triangle', 0.12, 60);
          break;
        case 'hit':
          this.noise(0.12, 260, 0.9, 0.4, 'lowpass');
          this.tone(70, 0.18, 'sine', 0.35, 40);
          break;
        case 'flesh':
          this.noise(0.16, 500, 1.2, 0.35, 'bandpass');
          break;
        case 'hurt':
          this.noise(0.3, 380, 0.7, 0.5, 'lowpass');
          this.tone(220, 0.35, 'sawtooth', 0.18, 70);
          break;
        case 'step':
          this.noise(0.07, 640, 1.1, 0.09 * (opts.vol || 1), 'lowpass');
          break;
        case 'splash':
          this.noise(0.25, 1500, 0.6, 0.16, 'bandpass');
          break;
        case 'pickup':
          this.tone(660, 0.12, 'sine', 0.12);
          this.tone(990, 0.22, 'sine', 0.1, 990, 0.08);
          break;
        case 'note':
          this.tone(392, 0.5, 'sine', 0.07, 392);
          this.tone(523, 0.7, 'sine', 0.05, 523, 0.1);
          break;
        case 'door':
          this.noise(0.7, 420, 0.5, 0.18, 'bandpass');
          this.tone(120, 0.8, 'sawtooth', 0.07, 62);
          break;
        case 'growl':
          this.noise(0.9, 900 + RB.rand(0, 500), 1.8, 0.10, 'bandpass');
          this.tone(48 + RB.rand(0, 10), 1.1, 'sine', 0.05, 36);
          break;
        case 'rustle':
          this.noise(0.55, 1400, 1.2, 0.09, 'bandpass');
          break;
        case 'paper':
          this.noise(0.35, 2400, 1.5, 0.08, 'bandpass');
          this.noise(0.5, 700, 0.8, 0.04, 'lowpass');
          break;
        case 'paperBurst':
          this.noise(0.5, 1200, 0.9, 0.28, 'bandpass');
          this.noise(0.25, 320, 0.7, 0.14, 'lowpass');
          break;
        case 'stamp':
          this.tone(90, 0.18, 'sine', 0.28, 42);
          this.noise(0.09, 500, 1.4, 0.16, 'bandpass');
          break;
        case 'radio':
          this.noise(0.9, 1800, 0.7, 0.06, 'bandpass');
          this.tone(880, 0.1, 'square', 0.03, 880);
          break;
        case 'shriek':
          this.tone(900, 0.5, 'sawtooth', 0.1, 300);
          this.noise(0.5, 2200, 1.2, 0.16, 'bandpass');
          break;
        case 'heartbeat':
          this.tone(54, 0.16, 'sine', 0.3, 34);
          this.tone(48, 0.2, 'sine', 0.2, 30, 0.18);
          break;
        case 'whisper':
          this.noise(1.4, 900 + RB.rand(0, 1500), 3, 0.05, 'bandpass');
          break;
        case 'generator':
          this.tone(60, 2.2, 'sawtooth', 0.1, 120);
          this.noise(2.0, 400, 0.6, 0.2, 'lowpass');
          break;
        case 'flare':
          this.noise(1.2, 1200, 0.5, 0.3, 'bandpass');
          this.tone(200, 1.0, 'sawtooth', 0.12, 60);
          break;
        case 'ui':
          this.tone(520, 0.05, 'square', 0.05, 520);
          break;
        case 'screech':
          this.noise(0.55, 2600, 2.4, 0.28, 'bandpass');
          this.tone(1200, 0.55, 'sawtooth', 0.12, 220);
          this.noise(0.8, 600, 0.9, 0.16, 'lowpass');
          break;
        case 'tic':
          this.tone(1800, 0.02, 'square', 0.03, 1400);
          break;
        case 'deny':
          this.tone(150, 0.16, 'square', 0.08, 110);
          break;
        case 'death':
          this.tone(50, 3.0, 'sawtooth', 0.25, 22);
          this.noise(2.5, 180, 0.5, 0.25, 'lowpass');
          break;
        case 'stinger':
          this.tone(110, 1.4, 'sawtooth', 0.16, 55);
          this.noise(1.2, 600, 0.8, 0.2, 'bandpass');
          this.tone(1400, 0.7, 'sine', 0.06, 500);
          break;
      }
    }

    /* Сердцебиение и шёпот в зависимости от страха */
    update(dt, fear, paused) {
      if (!this.ctx || this.muted) return;
      this.ambientTension(fear);
      if (paused) return;
      this.heartTimer -= dt;
      if (fear > 0.25 && this.heartTimer <= 0) {
        this.play('heartbeat');
        this.heartTimer = RB.lerp(1.15, 0.42, RB.clamp(fear, 0, 1));
      }
      this.whisperTimer -= dt;
      if (fear > 0.5 && this.whisperTimer <= 0) {
        this.play('whisper');
        this.whisperTimer = RB.rand(7, 16) * (1.2 - fear * 0.5);
      }
    }
  }

  RB.Sound = new SoundSystem();
})();
