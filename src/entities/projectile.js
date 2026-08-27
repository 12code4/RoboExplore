/* RoboExplore — projectiles (player bolts and enemy shots).
 * Glowing energy — always visible in the dark. Pooled-ish via alive flag.
 */
(function (RE) {
  'use strict';
  const Particles = RE.Particles;

  function makeProjectile(opts) {
    return {
      type: 'projectile',
      alive: true,
      x: opts.x, y: opts.y,
      vx: opts.vx, vy: opts.vy,
      r: opts.r || 4,
      damage: opts.damage || 8,
      life: 0,
      maxLife: opts.life || 0.85,
      color: opts.color || '#8ff',
      friendly: !!opts.friendly,
      pierce: opts.pierce || 0,
      hitSet: null,
      trail: 0,
      spawnGrace: opts.spawnGrace || 0,

      update(dt, game) {
        this.life += dt;
        if (this.life >= this.maxLife) { this.alive = false; return; }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        // Wall collision.
        if (game.map.isWallPx(this.x, this.y)) {
          this.alive = false;
          this._impact(game, true);
          return;
        }
        // Occasional trail spark.
        this.trail += dt;
        if (this.trail > 0.02) {
          this.trail = 0;
          Particles.emit({
            x: this.x, y: this.y, vx: 0, vy: 0, life: 0.18,
            size: this.r * 0.8, color: this.color, drag: 4, kind: 'dot',
          });
        }
      },

      _impact(game, wall) {
        Particles.burst(this.x, this.y, wall ? 5 : 7, {
          speed: 130, color: this.color, life: 0.32, size: this.r * 0.7, kind: 'spark',
        });
        if (wall) RE.Audio.sfx('hit');
      },

      render(ctx, cam) {
        const sx = this.x - cam.x, sy = this.y - cam.y;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // glow
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.r * 4);
        g.addColorStop(0, this.color);
        g.addColorStop(0.3, RE.M.rgba(this.color, 0.5));
        g.addColorStop(1, RE.M.rgba(this.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, this.r * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(sx, sy, this.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    };
  }

  RE.makeProjectile = makeProjectile;
})(window.RE = window.RE || {});
