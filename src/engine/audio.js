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
        case 'enemy_die': {
          const m = param || 1;  // pitch multiplier: bigger enemies die lower
          this.noise({ dur: 0.32, freq: 900 * m, to: 120 * m, gain: 0.24, type: 'bandpass', q: 0.8 });
          this.tone({ type: 'square', freq: 200 * m, to: 60 * m, dur: 0.26, gain: 0.14 });
          break;
        }
        case 'descend':
          this.tone({ type: 'sine', freq: 620, to: 130, dur: 0.7, gain: 0.2, filter: { type: 'lowpass', freq: 1800, to: 400 } });
          this.noise({ dur: 0.6, freq: 1400, to: 200, gain: 0.14, type: 'lowpass' });
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
        case 'wall_break':
          this.noise({ dur: 0.34, freq: 520, to: 90, gain: 0.22, type: 'lowpass', q: 0.7 });
          this.tone({ type: 'square', freq: 140, to: 50, dur: 0.2, gain: 0.12, filter: { type: 'lowpass', freq: 700 } });
          break;
        case 'spawn':
          this.tone({ type: 'sawtooth', freq: 160, to: 420, dur: 0.22, gain: 0.12, filter: { type: 'bandpass', freq: 900, q: 3 } });
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

    // --- Generative music: a drone bed under intermingled eerie phrases -----
    //
    // Each sector gets a quiet biome drone plus a scheduler that strings ~20-40s
    // instrumental "phrases" (music-box, bells, pad swells, tolls, whispers)
    // back to back in varying order, so the loop never repeats the same way.

    startMusic(biomeIndex) {
      if (!this._ensure()) return;
      this.stopMusic();
      const ctx = this.ctx, bus = this.musicBus;
      const MOODS = [
        { scale: 'minor',     root: 146.83 }, // Intake — D
        { scale: 'harmMinor', root: 130.81 }, // Hollows — C
        { scale: 'phrygian',  root: 138.59 }, // Vaults — C#
        { scale: 'wholeTone', root: 155.56 }, // Cryostacks — D#
        { scale: 'octatonic', root: 123.47 }, // Marrow — B
      ];
      this._mood = MOODS[(biomeIndex || 0) % MOODS.length];

      // Drone bed (quiet foundation).
      const root = this._mood.root / 2;
      const voices = [];
      const makeDrone = (mult, type, gain, detune) => {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = root * mult; o.detune.value = detune || 0;
        const g = ctx.createGain(); g.gain.value = 0;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
        o.connect(f); f.connect(g); g.connect(bus);
        o.start();
        g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 4);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.04 + Math.random() * 0.05;
        const lfoG = ctx.createGain(); lfoG.gain.value = 180;
        lfo.connect(lfoG); lfoG.connect(f.frequency); lfo.start();
        voices.push({ o, g, lfo });
      };
      makeDrone(1, 'sawtooth', 0.07, -4);
      makeDrone(1.5, 'triangle', 0.045, 6);   // fifth
      makeDrone(2, 'sine', 0.035, 0);          // octave
      this._music = { voices };

      // Phrase bus + lookahead scheduler.
      const pbus = ctx.createGain(); pbus.gain.value = 0.9; pbus.connect(bus);
      this._phraseBus = pbus;
      this._intensity = 0;
      this._lastPhrase = -1;
      this._nextPhraseAt = ctx.currentTime + 2.5;   // let the drone settle first
      this._musicTimer = setInterval(() => this._musicTick(), 300);
    },

    _musicTick() {
      if (!this.ready || !this._phraseBus || this.muted) return;
      const ctx = this.ctx, LOOK = 0.8;
      if (ctx.currentTime + LOOK < this._nextPhraseAt) return;
      const start = Math.max(this._nextPhraseAt, ctx.currentTime + 0.06);
      const dur = this._schedulePhrase(start);
      // overlap successive phrases slightly so they melt together (a looping track)
      this._nextPhraseAt = start + dur - (1.5 + Math.random() * 1.5);
    },

    // Build + schedule one phrase; returns its duration (s).
    _schedulePhrase(t0) {
      const gens = ['musicBox', 'padSwell', 'toll', 'whisper', 'spiral'];
      // Combat leans on drones/tolls; calm leans on melodic music-boxes.
      let weights = { musicBox: 3, padSwell: 2.4, toll: 2, whisper: 1.6, spiral: 1.6 };
      if (this._intensity > 0.5) { weights = { musicBox: 1, padSwell: 3, toll: 3, whisper: 2, spiral: 1 }; }
      // avoid repeating the same phrase twice
      let pick, guard = 0;
      do { pick = this._weightedGen(gens, weights); } while (pick === this._lastPhrase && guard++ < 4);
      this._lastPhrase = pick;
      const ph = this['_ph_' + pick](this._mood);
      for (const nt of ph.notes) this._instr(nt.voice, nt.f, t0 + nt.t, nt.dur, nt.gain);
      // occasionally lay a soft pad under a melodic phrase for depth
      if ((pick === 'musicBox' || pick === 'spiral') && Math.random() < 0.5) {
        const bed = this._ph_padSwell(this._mood, 0.5);
        for (const nt of bed.notes) if (nt.t < ph.dur) this._instr(nt.voice, nt.f, t0 + nt.t, nt.dur, nt.gain * 0.7);
      }
      return ph.dur;
    },

    _weightedGen(keys, weights) {
      let total = 0; for (const k of keys) total += weights[k] || 0;
      let r = Math.random() * total;
      for (const k of keys) { r -= weights[k] || 0; if (r <= 0) return k; }
      return keys[0];
    },

    // scale degree -> frequency (degree can span octaves, +/-)
    _deg(mood, i) {
      const S = { minor: [0, 2, 3, 5, 7, 8, 10], harmMinor: [0, 2, 3, 5, 7, 8, 11], phrygian: [0, 1, 3, 5, 7, 8, 10], wholeTone: [0, 2, 4, 6, 8, 10], octatonic: [0, 1, 3, 4, 6, 7, 9, 10] }[mood.scale];
      const n = S.length;
      const oct = Math.floor(i / n);
      const step = ((i % n) + n) % n;
      return mood.root * Math.pow(2, (S[step] + 12 * oct) / 12);
    },

    // --- Instruments (schedule one note at absolute time t) ----------------
    _instr(voice, freq, t, dur, gain) {
      if (!this.ready || t < this.ctx.currentTime - 0.05) return;
      ({ pluck: this._vPluck, bell: this._vBell, pad: this._vPad, toll: this._vToll, breath: this._vBreath })[voice].call(this, freq, t, dur, gain);
    },
    _vPluck(freq, t, dur, gain) {
      const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = freq;
      f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(600, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(this._phraseBus); o.start(t); o.stop(t + dur + 0.05);
    },
    _vBell(freq, t, dur, gain) {
      const ctx = this.ctx;
      [[1, gain], [2.76, gain * 0.35], [5.4, gain * 0.14]].forEach(([mult, gg], k) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = freq * mult;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gg, t + 0.006 + k * 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this._phraseBus); o.start(t); o.stop(t + dur + 0.05);
      });
    },
    _vPad(freq, t, dur, gain) {
      const ctx = this.ctx;
      [-6, 7].forEach((det) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = 900;
        const atk = dur * 0.4, rel = dur * 0.5;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + atk); g.gain.setValueAtTime(gain, t + dur - rel); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f); f.connect(g); g.connect(this._phraseBus); o.start(t); o.stop(t + dur + 0.05);
      });
    },
    _vToll(freq, t, dur, gain) {
      const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sine'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.98, t + dur);
      f.type = 'lowpass'; f.frequency.value = 500;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(this._phraseBus); o.start(t); o.stop(t + dur + 0.05);
    },
    _vBreath(freq, t, dur, gain) {
      const ctx = this.ctx, len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this._phraseBus); src.start(t); src.stop(t + dur + 0.05);
    },

    // --- Phrase generators (each returns {notes, dur}, ~20-40s) ------------
    _ph_musicBox(m) {
      const notes = [], reps = 3 + (Math.random() * 2 | 0);
      let t = 0;
      for (let r = 0; r < reps; r++) {
        // a sparse descending figure from the upper octaves
        let deg = 9 + (Math.random() * 3 | 0);
        const steps = 4 + (Math.random() * 3 | 0);
        for (let s = 0; s < steps; s++) {
          notes.push({ voice: Math.random() < 0.35 ? 'bell' : 'pluck', f: this._deg(m, deg), t, dur: 1.4 + Math.random() * 1.2, gain: 0.05 });
          t += 0.5 + Math.random() * 0.7;
          deg -= 1 + (Math.random() < 0.3 ? 1 : 0);
        }
        t += 1.6 + Math.random() * 2.2;   // breath between figures
      }
      return { notes, dur: Math.max(20, t) };
    },
    _ph_padSwell(m, scale) {
      const notes = []; scale = scale || 1;
      const chords = 3 + (Math.random() * 2 | 0);
      let t = 0;
      for (let c = 0; c < chords; c++) {
        const rootDeg = [0, 3, 4, -3][c % 4] + (Math.random() < 0.3 ? 7 : 0);
        const dur = 7 + Math.random() * 4;
        for (const iv of [0, 2, 4]) notes.push({ voice: 'pad', f: this._deg(m, rootDeg + iv), t, dur, gain: 0.03 * scale });
        t += dur - 2;   // overlap chords
      }
      return { notes, dur: Math.max(20, t + 2) };
    },
    _ph_toll(m) {
      const notes = []; let t = 0;
      const n = 6 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) {
        notes.push({ voice: 'toll', f: this._deg(m, -7 + (Math.random() < 0.25 ? 2 : 0)), t, dur: 3.2 + Math.random(), gain: 0.06 });
        if (Math.random() < 0.5) notes.push({ voice: 'bell', f: this._deg(m, 7 + (Math.random() * 4 | 0)), t: t + 1.2, dur: 2.4, gain: 0.03 });
        t += 3.4 + Math.random() * 1.6;
      }
      return { notes, dur: Math.max(20, t) };
    },
    _ph_whisper(m) {
      const notes = []; let t = 0;
      const n = 5 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) {
        const f = this._deg(m, 4 + (Math.random() * 8 | 0)) * (2 + Math.random() * 2);
        notes.push({ voice: 'breath', f, t, dur: 3 + Math.random() * 2, gain: 0.035 });
        if (Math.random() < 0.4) notes.push({ voice: 'pad', f: this._deg(m, (Math.random() < 0.5 ? 1 : 6)), t: t + 0.5, dur: 4, gain: 0.02 });
        t += 2.6 + Math.random() * 2.4;
      }
      return { notes, dur: Math.max(20, t) };
    },
    _ph_spiral(m) {
      const notes = []; let t = 0;
      const motif = [0, 3, 1, 4];
      const reps = 5 + (Math.random() * 3 | 0);
      let shift = 0, step = 0.42;
      for (let r = 0; r < reps; r++) {
        for (const mdeg of motif) {
          notes.push({ voice: Math.random() < 0.3 ? 'bell' : 'pluck', f: this._deg(m, mdeg + shift + 7), t, dur: 0.9 + Math.random() * 0.6, gain: 0.04 });
          t += step;
        }
        shift += (Math.random() < 0.5 ? 1 : -1);
        step = Math.max(0.28, step - 0.015);   // subtle accelerando
        t += 0.6;
      }
      return { notes, dur: Math.max(20, t + 1) };
    },

    stopMusic() {
      this.stopBossLayer();
      if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
      const ctx = this.ctx;
      if (this._phraseBus) {
        try {
          this._phraseBus.gain.cancelScheduledValues(ctx.currentTime);
          this._phraseBus.gain.setValueAtTime(this._phraseBus.gain.value, ctx.currentTime);
          this._phraseBus.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        } catch (e) {}
        this._phraseBus = null;
      }
      if (!this._music) return;
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
      this._intensity = x;
      if (this._music && this.musicBus) {
        this.musicBus.gain.setTargetAtTime(0.3 + x * 0.4, this.ctx.currentTime, 0.5);
      }
    },

    // A driving, pulsing bass layer for boss fights (added over the ambient bed).
    startBossLayer() {
      if (!this._ensure() || this._bossLayer || this.muted) return;
      const ctx = this.ctx, bus = this.musicBus;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240;
      o.connect(f); f.connect(g); g.connect(bus); o.start();
      g.gain.exponentialRampToValueAtTime(0.11, ctx.currentTime + 2);
      // 2 Hz rhythmic pulse via a square LFO on the gain
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 2;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.06;
      lfo.connect(lfoG); lfoG.connect(g.gain); lfo.start();
      this._bossLayer = { o, g, lfo };
    },
    stopBossLayer() {
      if (!this._bossLayer) return;
      const ctx = this.ctx, { o, g, lfo } = this._bossLayer;
      try {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1);
        o.stop(ctx.currentTime + 1.1); lfo.stop(ctx.currentTime + 1.1);
      } catch (e) {}
      this._bossLayer = null;
    },
  };

  RE.Audio = Audio;
})(window.RE = window.RE || {});
