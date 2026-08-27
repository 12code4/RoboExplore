/* RoboExplore — WebAudio synthesizer.
 * All sound is generated live: oscillators, noise, filters, envelopes.
 * No audio files. A master bus with gain + soft limiter feeds destination.
 */
(function (RE) {
  'use strict';

  const Audio = {
    ctx: null,
    master: null,
    musicBus: null,
    sfxBus: null,
    ready: false,
    muted: false,
    volume: 0.8,
    _music: null,

    init() {
      // Created lazily on first user gesture (autoplay policy).
    },

    _ensure() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.volume;
      // Gentle limiter to avoid clipping on stacked SFX.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 20;
      comp.ratio.value = 8;
      comp.attack.value = 0.003;
      comp.release.value = 0.18;
      master.connect(comp);
      comp.connect(ctx.destination);
      this.master = master;

      const sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
      const musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
      this.sfxBus = sfxBus;
      this.musicBus = musicBus;
      this.ready = true;
      return true;
    },

    resume() {
      if (!this._ensure()) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : this.volume;
    },
    toggleMute() { this.setMuted(!this.muted); return this.muted; },

    _now() { return this.ctx.currentTime; },

    // --- Primitive builders ------------------------------------------------
    _env(gain, t0, a, d, s, r, peak, sustain) {
      const g = gain.gain;
      g.cancelScheduledValues(t0);
      g.setValueAtTime(0.0001, t0);
      g.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + a);
      g.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t0 + a + d);
      // release handled by caller via stop time
    },

    // A tone with envelope. opts: {type,freq,to,dur,a,d,peak,gain,bus,detune,slideDur}
    tone(opts) {
      if (!this.ready || this.muted) return;
      const ctx = this.ctx, t0 = this._now();
      const o = ctx.createOscillator();
      o.type = opts.type || 'sine';
      o.frequency.setValueAtTime(opts.freq, t0);
      if (opts.to != null) {
        o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + (opts.slideDur || opts.dur || 0.15));
      }
      if (opts.detune) o.detune.setValueAtTime(opts.detune, t0);
      const g = ctx.createGain();
      const peak = (opts.gain != null ? opts.gain : 0.3);
      const dur = opts.dur || 0.18;
      const a = opts.a != null ? opts.a : 0.005;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      let node = g;
      if (opts.filter) {
        const f = ctx.createBiquadFilter();
        f.type = opts.filter.type || 'lowpass';
        f.frequency.setValueAtTime(opts.filter.freq || 1200, t0);
        if (opts.filter.to != null) f.frequency.exponentialRampToValueAtTime(opts.filter.to, t0 + dur);
        f.Q.value = opts.filter.q || 1;
        g.connect(f); node = f;
      }
      node.connect(opts.bus || this.sfxBus);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    },

    // Filtered noise burst. opts: {dur,gain,type,freq,to,q,bus}
    noise(opts) {
      if (!this.ready || this.muted) return;
      const ctx = this.ctx, t0 = this._now();
      const dur = opts.dur || 0.2;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = opts.type || 'bandpass';
      f.frequency.setValueAtTime(opts.freq || 900, t0);
      if (opts.to != null) f.frequency.exponentialRampToValueAtTime(Math.max(30, opts.to), t0 + dur);
      f.Q.value = opts.q || 1;
      const g = ctx.createGain();
      const peak = opts.gain != null ? opts.gain : 0.25;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(opts.bus || this.sfxBus);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    },

    // --- SFX library -------------------------------------------------------
    sfx(name, param) {
      if (!this.ready || this.muted) return;
      switch (name) {
        case 'echo':
          this.tone({ type: 'sine', freq: 520, to: 190, dur: 0.5, gain: 0.28, filter: { type: 'lowpass', freq: 2600, to: 600 } });
          this.tone({ type: 'triangle', freq: 780, to: 300, dur: 0.35, gain: 0.12 });
          break;
        case 'dash':
          this.noise({ dur: 0.18, freq: 1800, to: 300, gain: 0.22, type: 'bandpass', q: 0.7 });
          this.tone({ type: 'sawtooth', freq: 320, to: 130, dur: 0.16, gain: 0.16, filter: { type: 'lowpass', freq: 1400, to: 400 } });
          break;
        case 'shoot':
          this.tone({ type: 'square', freq: 620, to: 260, dur: 0.09, gain: 0.14, filter: { type: 'lowpass', freq: 2400 } });
          break;
        case 'shoot_heavy':
          this.tone({ type: 'sawtooth', freq: 240, to: 90, dur: 0.16, gain: 0.2, filter: { type: 'lowpass', freq: 1400 } });
          break;
        case 'hit': {
          const m = param || 1;   // pitch multiplier (tracks target HP)
          this.noise({ dur: 0.09, freq: 2200 * m, to: 700 * m, gain: 0.16, type: 'highpass', q: 0.6 });
          break;
        }
        case 'enemy_die':
          this.noise({ dur: 0.32, freq: 900, to: 120, gain: 0.24, type: 'bandpass', q: 0.8 });
          this.tone({ type: 'square', freq: 200, to: 60, dur: 0.26, gain: 0.14 });
          break;
        case 'hurt':
          this.tone({ type: 'sawtooth', freq: 180, to: 70, dur: 0.3, gain: 0.3, filter: { type: 'lowpass', freq: 900 } });
          this.noise({ dur: 0.14, freq: 500, to: 120, gain: 0.16, type: 'lowpass' });
          break;
        case 'pickup':
          this.tone({ type: 'triangle', freq: 660, to: 990, dur: 0.12, gain: 0.18 });
          break;
        case 'pickup_big':
          this.tone({ type: 'triangle', freq: 520, dur: 0.1, gain: 0.2 });
          this.tone({ type: 'triangle', freq: 780, dur: 0.12, gain: 0.16 });
          this.tone({ type: 'sine', freq: 1040, dur: 0.16, gain: 0.14 });
          break;
        case 'energy':
          this.tone({ type: 'sine', freq: 420, to: 900, dur: 0.16, gain: 0.16 });
          break;
        case 'equip':
          this.tone({ type: 'square', freq: 300, to: 600, dur: 0.14, gain: 0.16, filter: { type: 'lowpass', freq: 1800 } });
          this.tone({ type: 'triangle', freq: 900, dur: 0.1, gain: 0.1 });
          break;
        case 'sector':
          [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone({ type: 'triangle', freq: f, dur: 0.22, gain: 0.16 }), i * 90));
          break;
        case 'lowpower':
          this.tone({ type: 'sine', freq: 300, to: 220, dur: 0.5, gain: 0.14 });
          break;
        case 'shield':
          this.tone({ type: 'sine', freq: 220, to: 440, dur: 0.2, gain: 0.16, filter: { type: 'bandpass', freq: 800, q: 3 } });
          break;
        case 'shield_break':
          this.noise({ dur: 0.3, freq: 1400, to: 200, gain: 0.24, type: 'highpass' });
          break;
        case 'boss':
          this.tone({ type: 'sawtooth', freq: 90, to: 55, dur: 1.1, gain: 0.32, filter: { type: 'lowpass', freq: 500, to: 180 } });
          this.noise({ dur: 0.9, freq: 200, to: 60, gain: 0.18, type: 'lowpass' });
          break;
        case 'ui':
          this.tone({ type: 'square', freq: 440, dur: 0.05, gain: 0.08 });
          break;
        case 'ui_move':
          this.tone({ type: 'square', freq: 320, dur: 0.04, gain: 0.06 });
          break;
        case 'death':
          this.tone({ type: 'sawtooth', freq: 240, to: 40, dur: 1.4, gain: 0.3, filter: { type: 'lowpass', freq: 1200, to: 120 } });
          break;
        case 'blip':
          this.tone({ type: 'sine', freq: param || 700, dur: 0.06, gain: 0.1 });
          break;
        default: break;
      }
    },

    // --- Ambient music bed (drone that shifts by biome) --------------------
    startMusic(biomeIndex) {
      if (!this._ensure()) return;
      this.stopMusic();
      const ctx = this.ctx, bus = this.musicBus;
      const roots = [110, 98, 130.81, 87.31, 73.42]; // A2, G2, C3, F2, D2
      const root = roots[(biomeIndex || 0) % roots.length];
      const voices = [];
      const makeDrone = (mult, type, gain, detune) => {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = root * mult; o.detune.value = detune || 0;
        const g = ctx.createGain(); g.gain.value = 0;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
        o.connect(f); f.connect(g); g.connect(bus);
        o.start();
        g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 3);
        // slow LFO on filter for movement
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.06;
        const lfoG = ctx.createGain(); lfoG.gain.value = 220;
        lfo.connect(lfoG); lfoG.connect(f.frequency); lfo.start();
        voices.push({ o, g, lfo });
        return { o, g, f, lfo };
      };
      makeDrone(1, 'sawtooth', 0.10, -4);
      makeDrone(1.5, 'triangle', 0.06, 5);   // fifth
      makeDrone(2, 'sine', 0.05, 0);          // octave
      this._music = { voices };
    },

    stopMusic() {
      if (!this._music) return;
      const ctx = this.ctx;
      for (const v of this._music.voices) {
        try {
          v.g.gain.cancelScheduledValues(ctx.currentTime);
          v.g.gain.setValueAtTime(v.g.gain.value, ctx.currentTime);
          v.g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
          v.o.stop(ctx.currentTime + 1.4);
          if (v.lfo) v.lfo.stop(ctx.currentTime + 1.4);
        } catch (e) {}
      }
      this._music = null;
    },

    setMusicIntensity(x) {
      if (this._music && this.musicBus) {
        this.musicBus.gain.setTargetAtTime(0.3 + x * 0.4, this.ctx.currentTime, 0.5);
      }
    },
  };

  RE.Audio = Audio;
})(window.RE = window.RE || {});
