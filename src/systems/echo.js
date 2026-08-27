/* RoboExplore — Echo-Sight system (the signature mechanic).
 * The world is dark. The player emits echo pulses: expanding rings that wash
 * over geometry and entities, illuminating them briefly. A small passive light
 * surrounds the player. Previously-seen tiles remain in dim "memory."
 *
 * Brightness model per tile: max(memory, dynamicEcho, passiveLight).
 *   - dynamicEcho: set to full when a pulse band passes over, decays over
 *     CFG.player.echoRevealHold seconds.
 *   - passiveLight: computed at query time from distance to the player.
 *   - memory: dim constant once a tile has ever been lit.
 */
(function (RE) {
  'use strict';
  const M = RE.M;

  const Echo = {
    map: null,
    W: 0, H: 0, T: 28,
    bright: null,      // Float32Array dynamic echo brightness [0,1]
    discovered: null,  // Uint8Array ever-seen
    pulses: [],
    hold: 2.6,
    cfg: null,

    reset(map, cfg) {
      this.map = map;
      this.cfg = cfg;
      this.W = map.w; this.H = map.h; this.T = map.tile;
      this.bright = new Float32Array(this.W * this.H);
      this.discovered = new Uint8Array(this.W * this.H);
      this.pulses.length = 0;
      this.hold = cfg.player.echoRevealHold;
    },

    // Spawn an echo pulse.
    pulse(x, y, opts) {
      opts = opts || {};
      const p = {
        x, y,
        r: opts.r0 || 6,
        maxR: opts.maxR || this.cfg.player.echoMaxRadius,
        speed: opts.speed || this.cfg.player.echoSpeed,
        band: opts.band || this.cfg.player.echoBandWidth,
        strength: opts.strength != null ? opts.strength : 1,
        prevR: 0,
        life: 0,
        source: opts.source || 'player',
      };
      this.pulses.push(p);
      return p;
    },

    update(dt) {
      const { W, H, T, bright, discovered } = this;
      // 1. Advance pulses & light tiles inside the growing annulus.
      for (let pi = this.pulses.length - 1; pi >= 0; pi--) {
        const p = this.pulses[pi];
        p.prevR = p.r;
        p.r += p.speed * dt;
        p.life += dt;
        // Light every tile the leading edge swept since last frame (prevR..r),
        // widened by band so nothing is skipped at high speed.
        const inner = Math.max(0, p.prevR - p.band * 0.5);
        const outer = p.r + p.band * 0.5;
        const minTx = M.clamp(((p.x - outer) / T) | 0, 0, W - 1);
        const maxTx = M.clamp(((p.x + outer) / T) | 0, 0, W - 1);
        const minTy = M.clamp(((p.y - outer) / T) | 0, 0, H - 1);
        const maxTy = M.clamp(((p.y + outer) / T) | 0, 0, H - 1);
        const inner2 = inner * inner, outer2 = outer * outer;
        for (let ty = minTy; ty <= maxTy; ty++) {
          const cy = (ty + 0.5) * T - p.y;
          for (let tx = minTx; tx <= maxTx; tx++) {
            const cx = (tx + 0.5) * T - p.x;
            const d2 = cx * cx + cy * cy;
            if (d2 < inner2 || d2 > outer2) continue;
            const i = ty * W + tx;
            // Fade strength as the pulse loses energy with distance.
            const falloff = 1 - (p.r / p.maxR) * 0.55;
            const s = p.strength * Math.max(0.25, falloff);
            if (s > bright[i]) bright[i] = s;
            discovered[i] = 1;
          }
        }
        if (p.r > p.maxR) this.pulses.splice(pi, 1);
      }

      // 2. Decay dynamic brightness linearly toward zero over `hold`.
      const dec = dt / this.hold;
      for (let i = 0; i < bright.length; i++) {
        if (bright[i] > 0) {
          bright[i] -= dec;
          if (bright[i] < 0) bright[i] = 0;
        }
      }
    },

    // Passive light contribution at a world point given the player position.
    passiveAt(px, py, player) {
      if (!player) return 0;
      const r = player.lightRadius || this.cfg.player.passiveLight;
      const d = M.dist(px, py, player.x, player.y);
      const inner = r * 0.42;
      if (d <= inner) return 1;
      if (d >= r) return 0;
      return 1 - (d - inner) / (r - inner);
    },

    // Brightness for rendering a tile (index i), 0..1.
    tileBrightness(tx, ty, player) {
      if (this.cfg.debug && this.cfg.debug.revealAll) return 1;
      const i = ty * this.W + tx;
      let b = this.bright[i];
      if (this.discovered[i]) b = Math.max(b, this.cfg.light.memoryLevel);
      const px = (tx + 0.5) * this.T, py = (ty + 0.5) * this.T;
      const passive = this.passiveAt(px, py, player);
      if (passive > b) b = passive;
      return b > 1 ? 1 : b;
    },

    // Brightness at an arbitrary world point (for entities). Includes passive.
    lightAt(px, py, player) {
      if (this.cfg.debug && this.cfg.debug.revealAll) return 1;
      const tx = (px / this.T) | 0, ty = (py / this.T) | 0;
      let b = 0;
      if (tx >= 0 && ty >= 0 && tx < this.W && ty < this.H) {
        const i = ty * this.W + tx;
        b = this.bright[i];
      }
      const passive = this.passiveAt(px, py, player);
      if (passive > b) b = passive;
      return b > 1 ? 1 : b;
    },

    // Is a pulse ring currently sweeping across this point? Returns the pulse
    // (for "ping" reactions) or null. Uses the swept band between prevR and r.
    pulseSweeping(px, py, radius) {
      radius = radius || 0;
      for (const p of this.pulses) {
        const d = M.dist(px, py, p.x, p.y);
        const lo = Math.min(p.prevR, p.r) - p.band * 0.5 - radius;
        const hi = Math.max(p.prevR, p.r) + p.band * 0.5 + radius;
        if (d >= lo && d <= hi) return p;
      }
      return null;
    },
  };

  RE.Echo = Echo;
})(window.RE = window.RE || {});
