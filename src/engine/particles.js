/* RoboExplore — pooled particle system.
 * Fixed-capacity ring of particle structs to avoid GC churn. Particles are
 * additive glowing dots / sparks / rings, drawn in world space.
 */
(function (RE) {
  'use strict';

  const MAX = 1400;

  function makeParticle() {
    return {
      alive: false, x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 1, size: 2, color: '#fff',
      drag: 0, grav: 0, shrink: 1, glow: true, kind: 'dot',
      rot: 0, vr: 0, seed: 0,
    };
  }

  const Particles = {
    pool: [],
    idx: 0,

    init() {
      this.pool = new Array(MAX);
      for (let i = 0; i < MAX; i++) this.pool[i] = makeParticle();
      this.idx = 0;
    },

    _spawn() {
      // Round-robin; overwrite oldest.
      const p = this.pool[this.idx];
      this.idx = (this.idx + 1) % MAX;
      return p;
    },

    emit(opts) {
      const p = this._spawn();
      p.alive = true;
      p.x = opts.x; p.y = opts.y;
      p.vx = opts.vx || 0; p.vy = opts.vy || 0;
      p.life = 0; p.maxLife = opts.life || 0.5;
      p.size = opts.size || 2.5;
      p.color = opts.color || '#8ff';
      p.drag = opts.drag != null ? opts.drag : 2.5;
      p.grav = opts.grav || 0;
      p.shrink = opts.shrink != null ? opts.shrink : 1;
      p.glow = opts.glow !== false;
      p.kind = opts.kind || 'dot';
      p.rot = opts.rot || 0;
      p.vr = opts.vr || 0;
      p.seed = Math.random();
      return p;
    },

    // Convenience burst: n particles in random directions.
    burst(x, y, n, opts) {
      opts = opts || {};
      const spd = opts.speed || 120;
      const spread = opts.spread != null ? opts.spread : Math.PI * 2;
      const dir = opts.dir != null ? opts.dir : 0;
      for (let i = 0; i < n; i++) {
        const a = dir + (Math.random() - 0.5) * spread;
        const s = spd * (0.35 + Math.random() * 0.65);
        this.emit({
          x, y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: (opts.life || 0.5) * (0.6 + Math.random() * 0.6),
          size: (opts.size || 3) * (0.6 + Math.random() * 0.7),
          color: opts.color || '#9ef',
          drag: opts.drag != null ? opts.drag : 3.5,
          grav: opts.grav || 0,
          shrink: opts.shrink != null ? opts.shrink : 1,
          kind: opts.kind || 'dot',
          glow: opts.glow !== false,
          vr: (Math.random() - 0.5) * 8,
        });
      }
    },

    ring(x, y, opts) {
      opts = opts || {};
      this.emit({
        x, y, vx: 0, vy: 0,
        life: opts.life || 0.4, size: opts.size || 8,
        color: opts.color || '#8ef', kind: 'ring', drag: 0, shrink: 0,
        glow: true,
      });
    },

    update(dt) {
      const pool = this.pool;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.alive) continue;
        p.life += dt;
        if (p.life >= p.maxLife) { p.alive = false; continue; }
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy *= d;
        p.vy += p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
    },

    render(ctx, cam) {
      const pool = this.pool;
      ctx.save();
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.alive) continue;
        const t = p.life / p.maxLife;
        const alpha = (1 - t);
        const sx = p.x - cam.x, sy = p.y - cam.y;
        // cull offscreen
        if (sx < -40 || sy < -40 || sx > cam.viewW + 40 || sy > cam.viewH + 40) continue;
        ctx.globalAlpha = Math.max(0, alpha);
        if (p.glow) ctx.globalCompositeOperation = 'lighter';
        else ctx.globalCompositeOperation = 'source-over';
        if (p.kind === 'ring') {
          const r = p.size + t * (p.size * 3.5);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(0.6, 2.5 * (1 - t));
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.kind === 'spark') {
          const len = p.size * (1 + Math.hypot(p.vx, p.vy) * 0.01);
          const ang = Math.atan2(p.vy, p.vx);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(0.6, p.size * (p.shrink ? (1 - t) : 1) * 0.6);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - Math.cos(ang) * len, sy - Math.sin(ang) * len);
          ctx.stroke();
        } else if (p.kind === 'square') {
          const s = p.size * (p.shrink ? (1 - t) : 1);
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rot);
          ctx.fillRect(-s / 2, -s / 2, s, s);
          ctx.restore();
        } else {
          const s = p.size * (p.shrink ? (1 - t) : 1);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.4, s), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },

    clear() {
      for (const p of this.pool) p.alive = false;
    },
  };

  RE.Particles = Particles;
})(window.RE = window.RE || {});
