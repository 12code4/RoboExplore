/* RoboExplore — destructible walls (v1.4).
 *
 * Every wall tile carries hit points. Player fire (and player AoE) chips them
 * down; a fraction of each hit bleeds to the surrounding walls (up to a couple
 * of hops) so damage spreads instead of drilling a needle. A wall reduced to 0
 * HP is carved open (becomes floor) — a permanent tunnel through the Hollow.
 * Damaged-but-standing walls slowly regenerate after a lull, so breaching takes
 * sustained fire, not a stray shot.
 *
 * Walls also read as a "dark rainbow" damage gauge: undamaged tiles keep the
 * biome's near-black stone; as they take damage they tint through purple → blue
 * → green → orange → red (each a dark shade), so you can see what's about to
 * give. The map grid (RE.Tilemap) is kept in sync so collision, echo, and
 * pathing see carved tunnels immediately.
 */
(function (RE) {
  'use strict';
  const M = RE.M;

  const Walls = {
    map: null, W: 0, H: 0,
    hp: null,        // Float32 current HP (0 for non-wall / carved)
    max: null,       // Float32 max HP (Infinity for the indestructible border)
    since: null,     // Float32 seconds since last damaged
    damaged: null,   // Set<int> of tile indices with hp<max (needs regen + colored)
    cfg: null,
    onBreak: null,   // optional callback(tx,ty) when a wall is carved open

    reset(map, cfg) {
      this.map = map; this.cfg = cfg.walls;
      this.W = map.w; this.H = map.h;
      const n = this.W * this.H;
      this.hp = new Float32Array(n);
      this.max = new Float32Array(n);
      this.since = new Float32Array(n);
      this.damaged = new Set();
      this.onBreak = null;
      const base = this.cfg.baseHp;
      const W = this.W, H = this.H, grid = map.grid, WALL = map.gen.WALL;
      for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
          const i = ty * W + tx;
          if (grid[i] !== WALL) continue;
          // The 2-tile solid border is indestructible so the void stays sealed.
          const border = tx < 2 || ty < 2 || tx >= W - 2 || ty >= H - 2;
          this.max[i] = border ? Infinity : base;
          this.hp[i] = border ? Infinity : base;
        }
      }
    },

    _isWall(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return false;
      return this.map.grid[ty * this.W + tx] === this.map.gen.WALL;
    },

    // Turn a tile into a fortified wall (fortress construction). Keeps the
    // collision grid in sync and registers its (raised) HP.
    fortifyTile(tx, ty, mult) {
      if (tx < 1 || ty < 1 || tx >= this.W - 1 || ty >= this.H - 1) return;
      const i = ty * this.W + tx;
      this.map.grid[i] = this.map.gen.WALL;
      const hp = this.cfg.baseHp * (mult || this.cfg.fortifyMul);
      this.max[i] = hp; this.hp[i] = hp; this.since[i] = 0;
      this.damaged.delete(i);
    },

    // Carve a tile to floor (fortress interior). Keeps the grid in sync.
    clearTile(tx, ty) {
      const i = ty * this.W + tx;
      this.map.grid[i] = this.map.gen.FLOOR;
      this.hp[i] = 0; this.max[i] = 0; this.damaged.delete(i);
    },

    damageWorld(px, py, dmg) {
      const tx = (px / this.map.tile) | 0, ty = (py / this.map.tile) | 0;
      this._apply(tx, ty, dmg, 0, null);
    },
    damageTile(tx, ty, dmg) { this._apply(tx, ty, dmg, 0, null); },

    _apply(tx, ty, dmg, step, seen) {
      if (dmg <= 0 || !this._isWall(tx, ty)) return;
      const i = ty * this.W + tx;
      const mx = this.max[i];
      if (!isFinite(mx) || mx <= 0) return;   // indestructible border / not tracked
      if (seen) { if (seen.has(i)) return; seen.add(i); }

      this.hp[i] -= dmg;
      this.since[i] = 0;
      if (this.hp[i] < this.max[i]) this.damaged.add(i);

      if (this.hp[i] <= 0) {
        this._break(tx, ty, i);
      }

      // Bleed a share of the damage to surrounding walls (bounded hops).
      if (step < this.cfg.spreadSteps) {
        const spread = dmg * this.cfg.spreadFrac;
        if (spread > 0.05) {
          const s = seen || new Set([i]);
          // collect standing wall neighbors (8-dir)
          const nb = [];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = tx + dx, ny = ty + dy;
              if (this._isWall(nx, ny) && !s.has(ny * this.W + nx) && isFinite(this.max[ny * this.W + nx])) nb.push([nx, ny]);
            }
          }
          if (nb.length) {
            const share = spread / nb.length;
            for (const [nx, ny] of nb) this._apply(nx, ny, share, step + 1, s);
          }
        }
      }
    },

    _break(tx, ty, i) {
      this.hp[i] = 0; this.max[i] = 0;
      this.damaged.delete(i);
      this.map.grid[i] = this.map.gen.FLOOR;   // carve the tunnel
      const T = this.map.tile;
      const cx = (tx + 0.5) * T, cy = (ty + 0.5) * T;
      RE.Particles.burst(cx, cy, 12, { speed: 170, color: '#c9b7a0', life: 0.5, size: 3, kind: 'spark' });
      RE.Particles.burst(cx, cy, 6, { speed: 70, color: '#6b5c4c', life: 0.6, size: 3.5, kind: 'dot' });
      RE.Audio.sfx('wall_break');
      if (this.onBreak) this.onBreak(tx, ty);
    },

    update(dt) {
      if (!this.damaged || !this.damaged.size) return;
      const delay = this.cfg.regenDelay, frac = this.cfg.regenFrac;
      for (const i of this.damaged) {
        this.since[i] += dt;
        if (this.since[i] >= delay) {
          this.hp[i] = Math.min(this.max[i], this.hp[i] + this.max[i] * frac * dt);
          if (this.hp[i] >= this.max[i]) this.damaged.delete(i);
        }
      }
    },

    // Damage fraction [0..1] for a tile (0 = pristine, →1 = about to give).
    damageFrac(tx, ty) {
      const i = ty * this.W + tx;
      const mx = this.max[i];
      if (!isFinite(mx) || mx <= 0) return 0;
      const hp = this.hp[i];
      if (hp >= mx) return 0;
      return M.clamp(1 - hp / mx, 0, 1);
    },

    // The wall's base color given the biome stone — a dark rainbow keyed to HP.
    // Undamaged returns the biome color (fast path). Damage tints through
    // purple → blue → green → yellow → orange → red, kept dark ("a dark version
    // of themselves").
    wallColor(tx, ty, baseHex) {
      const d = this.damageFrac(tx, ty);
      if (d <= 0.001) return baseHex;
      // hue sweeps 270° (purple) down to 0° (red) as damage rises.
      const hue = 270 * (1 - d);
      const dark = M.hslHex(hue, 0.85, 0.30);
      // color appears quickly but the tile darkens toward red near collapse.
      const t = Math.pow(d, 0.6);
      return M.mixHexHex(baseHex, dark, t);
    },
  };

  RE.Walls = Walls;
})(window.RE = window.RE || {});
