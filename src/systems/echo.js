/* RoboExplore — Echo-Sight system (the signature mechanic).
 *
 * Lighting model (design bible §3): the world is dark. A tile's brightness is
 *   max( dynamicLight, ghostFloor(if ever seen), passiveLight(distance) ).
 * A pulse washes tiles to full brightness as its front crosses them; tiles hold
 * full for echoTileHold, then decay exponentially (tau = echoTileFadeTau) down
 * to a permanent dim "ghost floor" so you remember the map's shape, not its
 * contents. Weapon light does a soft, no-hold wash.
 *
 * Also hosts Echo-Return pings (Twist B): colored blips that travel back to the
 * player when a pulse crosses a point of interest, giving directional intel that
 * outlives the visual reveal.
 */
(function (RE) {
  'use strict';
  const M = RE.M;

  const Echo = {
    map: null, cfg: null,
    W: 0, H: 0, T: 28,
    light: null,       // Float32 dynamic brightness [0,1]
    holdT: null,       // Float32 remaining full-bright hold time
    seen: null,        // Uint8 ever-washed
    pulses: [],
    pings: [],
    hold: 0.4, tau: 1.4,

    reset(map, cfg) {
      this.map = map; this.cfg = cfg;
      this.W = map.w; this.H = map.h; this.T = map.tile;
      const n = this.W * this.H;
      this.light = new Float32Array(n);
      this.holdT = new Float32Array(n);
      this.seen = new Uint8Array(n);
      this.pulses.length = 0;
      this.pings.length = 0;
      this.hold = cfg.player.echoTileHold;
      this.tau = cfg.player.echoTileFadeTau;
    },

    pulse(x, y, opts) {
      opts = opts || {};
      const p = {
        x, y,
        r: opts.r0 || 4,
        maxR: opts.maxR != null ? opts.maxR : this.cfg.player.echoMaxRadius,
        speed: opts.speed != null ? opts.speed : this.cfg.player.echoSpeed,
        band: opts.band != null ? opts.band : this.cfg.player.echoBandWidth,
        strength: opts.strength != null ? opts.strength : 1,
        prevR: opts.r0 || 4,
        life: 0,
        source: opts.source || 'player',
        id: (Echo._pid = (Echo._pid || 0) + 1),
      };
      this.pulses.push(p);
      return p;
    },
    _pid: 0,

    // Soft wash (weapon light / flora): brighten tiles within radius, no hold.
    washSoft(x, y, radius, level) {
      const { W, H, T, light, seen } = this;
      const r2 = radius * radius;
      const minTx = M.clamp(((x - radius) / T) | 0, 0, W - 1);
      const maxTx = M.clamp(((x + radius) / T) | 0, 0, W - 1);
      const minTy = M.clamp(((y - radius) / T) | 0, 0, H - 1);
      const maxTy = M.clamp(((y + radius) / T) | 0, 0, H - 1);
      for (let ty = minTy; ty <= maxTy; ty++) {
        const cy = (ty + 0.5) * T - y;
        for (let tx = minTx; tx <= maxTx; tx++) {
          const cx = (tx + 0.5) * T - x;
          if (cx * cx + cy * cy > r2) continue;
          const i = ty * W + tx;
          if (light[i] < level) light[i] = level;
          seen[i] = 1;
        }
      }
    },

    // Flashlight cone: wash tiles inside an angular wedge, occluded by walls so
    // the beam actually stops at stone. `map` supplies line-of-sight.
    washCone(x, y, ang, range, half, level, map) {
      const { W, H, T, light, seen } = this;
      const r2 = range * range;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const cosHalf = Math.cos(half);
      const minTx = M.clamp(((x - range) / T) | 0, 0, W - 1);
      const maxTx = M.clamp(((x + range) / T) | 0, 0, W - 1);
      const minTy = M.clamp(((y - range) / T) | 0, 0, H - 1);
      const maxTy = M.clamp(((y + range) / T) | 0, 0, H - 1);
      for (let ty = minTy; ty <= maxTy; ty++) {
        const cy = (ty + 0.5) * T - y;
        for (let tx = minTx; tx <= maxTx; tx++) {
          const cx = (tx + 0.5) * T - x;
          const d2 = cx * cx + cy * cy;
          if (d2 > r2 || d2 < 1) continue;
          const d = Math.sqrt(d2);
          if ((cx * ca + cy * sa) / d < cosHalf) continue;   // outside the wedge
          // occlusion: sample just short of the tile so the near wall face lights
          if (map && d > T * 0.7) {
            const back = d - T * 0.6;
            if (!map.hasLOS(x, y, x + (cx / d) * back, y + (cy / d) * back)) continue;
          }
          const i = ty * W + tx;
          const lv = level * (1 - (d / range) * 0.65);
          if (light[i] < lv) light[i] = lv;
          seen[i] = 1;
        }
      }
    },

    spawnPing(x, y, color) {
      // Cap concurrent pings for readability.
      if (this.pings.length > 40) this.pings.shift();
      this.pings.push({ x, y, color, t: 0, life: 0.9, arrived: false });
    },

    update(dt, player) {
      const { W, H, T, light, holdT, seen } = this;
      // 1. Advance pulses, wash swept tiles.
      for (let pi = this.pulses.length - 1; pi >= 0; pi--) {
        const p = this.pulses[pi];
        p.prevR = p.r;
        p.r += p.speed * dt;
        p.life += dt;
        const inner = Math.max(0, p.prevR - p.band);
        const outer = p.r + p.band * 0.5;
        const minTx = M.clamp(((p.x - outer) / T) | 0, 0, W - 1);
        const maxTx = M.clamp(((p.x + outer) / T) | 0, 0, W - 1);
        const minTy = M.clamp(((p.y - outer) / T) | 0, 0, H - 1);
        const maxTy = M.clamp(((p.y + outer) / T) | 0, 0, H - 1);
        const inner2 = inner * inner, outer2 = outer * outer;
        const strength = p.strength * (1 - (p.r / p.maxR) * 0.45);
        for (let ty = minTy; ty <= maxTy; ty++) {
          const cy = (ty + 0.5) * T - p.y;
          for (let tx = minTx; tx <= maxTx; tx++) {
            const cx = (tx + 0.5) * T - p.x;
            const d2 = cx * cx + cy * cy;
            if (d2 < inner2 || d2 > outer2) continue;
            const i = ty * W + tx;
            const s = Math.max(0.3, strength);
            if (s >= light[i]) { light[i] = s; holdT[i] = this.hold; }
            seen[i] = 1;
          }
        }
        if (p.r > p.maxR) this.pulses.splice(pi, 1);
      }

      // 2. Decay: precompute constant factor (dt is fixed).
      const decay = Math.exp(-dt / this.tau);
      const ghost = this.cfg.player.ghostFloor;
      for (let i = 0; i < light.length; i++) {
        if (holdT[i] > 0) { holdT[i] -= dt; continue; }
        let v = light[i];
        if (v > 0) {
          v *= decay;
          if (v < 0.004) v = 0;
          light[i] = v;
        }
      }

      // 3. Pings travel back to the player.
      if (player) {
        for (let i = this.pings.length - 1; i >= 0; i--) {
          const ping = this.pings[i];
          ping.t += dt;
          const dx = player.x - ping.x, dy = player.y - ping.y;
          const d = Math.hypot(dx, dy);
          const step = this.cfg.player.pingSpeed * dt;
          if (d <= step || ping.t > ping.life) { this.pings.splice(i, 1); continue; }
          ping.x += dx / d * step; ping.y += dy / d * step;
        }
      }
    },

    passiveAt(px, py, player) {
      if (!player) return 0;
      const inner = player.lightInner || this.cfg.player.lightInner;
      const outer = player.lightOuter || this.cfg.player.lightOuter;
      const d = M.dist(px, py, player.x, player.y);
      if (d <= inner) return 1;
      if (d >= outer) return 0;
      // smoothstep falloff
      const t = 1 - (d - inner) / (outer - inner);
      return t * t * (3 - 2 * t);
    },

    tileBrightness(tx, ty, player) {
      if (this.cfg.debug && this.cfg.debug.revealAll) return 1;
      const i = ty * this.W + tx;
      let b = this.light[i];
      if (this.seen[i]) { const g = this.cfg.player.ghostFloor; if (g > b) b = g; }
      const px = (tx + 0.5) * this.T, py = (ty + 0.5) * this.T;
      const passive = this.passiveAt(px, py, player);
      if (passive > b) b = passive;
      return b > 1 ? 1 : b;
    },

    // Brightness at an arbitrary world point (entities); includes passive.
    lightAt(px, py, player) {
      if (this.cfg.debug && this.cfg.debug.revealAll) return 1;
      const tx = (px / this.T) | 0, ty = (py / this.T) | 0;
      let b = 0;
      if (tx >= 0 && ty >= 0 && tx < this.W && ty < this.H) b = this.light[ty * this.W + tx];
      const passive = this.passiveAt(px, py, player);
      if (passive > b) b = passive;
      return b > 1 ? 1 : b;
    },

    // The strongest pulse currently sweeping across a point, or null. Used for
    // reveal, marking, aggro (Twist D), and ping spawning.
    pulseSweeping(px, py, radius) {
      radius = radius || 0;
      let best = null;
      for (const p of this.pulses) {
        const d = M.dist(px, py, p.x, p.y);
        const lo = Math.min(p.prevR, p.r) - p.band - radius;
        const hi = Math.max(p.prevR, p.r) + p.band * 0.5 + radius;
        if (d >= lo && d <= hi) { if (!best || p.strength > best.strength) best = p; }
      }
      return best;
    },
  };

  RE.Echo = Echo;
})(window.RE = window.RE || {});
