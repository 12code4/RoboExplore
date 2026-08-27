/* RoboExplore — projectiles (player bolts and enemy shots).
 * Glowing energy — always visible in the dark. Player shots are light-casters:
 * they softly wash the tiles they pass, faintly revealing a lane. Supports
 * wall-bounce, piercing, splash, and an on-expire hook (spitter puddles).
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
      bounce: opts.bounce || 0,
      illuminate: opts.illuminate || 0,
      splash: opts.splash || 0,
      splashDmg: opts.splashDmg || 0,
      knockback: opts.knockback || 0,
      beam: !!opts.beam,
      hitSet: null,
      trail: 0,
      onExpire: opts.onExpire || null,
      puddleOnHit: opts.puddleOnHit || false,

      update(dt, game) {
        this.life += dt;
        if (this.life >= this.maxLife) { this.alive = false; if (this.onExpire) this.onExpire(); return; }
        const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
        if (game.map.isWallPx(nx, ny)) {
          if (this.bounce > 0) {
            // reflect off the offending axis
            const hitX = game.map.isWallPx(this.x + this.vx * dt, this.y);
            const hitY = game.map.isWallPx(this.x, this.y + this.vy * dt);
            if (hitX) this.vx = -this.vx;
            if (hitY) this.vy = -this.vy;
            if (!hitX && !hitY) { this.vx = -this.vx; this.vy = -this.vy; }
            this.bounce--;
            Particles.burst(this.x, this.y, 3, { speed: 90, color: this.color, life: 0.2, size: this.r * 0.6, kind: 'spark' });
          } else {
            this.alive = false; this._impact(game, true); if (this.onExpire) this.onExpire(); return;
          }
        } else { this.x = nx; this.y = ny; }

        // light-caster reveal
        if (this.illuminate > 0 && this.friendly) RE.Echo.washSoft(this.x, this.y, this.illuminate, 0.5);

        this.trail += dt;
        if (this.trail > 0.02) {
          this.trail = 0;
          Particles.emit({ x: this.x, y: this.y, vx: 0, vy: 0, life: 0.18, size: this.r * 0.8, color: this.color, drag: 4, kind: 'dot' });
        }
      },

      _impact(game, wall) {
        Particles.burst(this.x, this.y, wall ? 5 : 7, { speed: 130, color: this.color, life: 0.32, size: this.r * 0.7, kind: 'spark' });
        if (this.puddleOnHit && this.onExpire) { this.onExpire(); this.onExpire = null; }
        if (wall) RE.Audio.sfx('hit');
      },

      render(ctx, cam) {
        const sx = this.x - cam.x, sy = this.y - cam.y;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.r * 4);
        gr.addColorStop(0, this.color);
        gr.addColorStop(0.3, RE.M.rgba(this.color, 0.5));
        gr.addColorStop(1, RE.M.rgba(this.color, 0));
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(sx, sy, this.r * 4, 0, Math.PI * 2); ctx.fill();
        if (this.beam) {
          // draw a short streak for the lance
          const a = Math.atan2(this.vy, this.vx);
          ctx.strokeStyle = this.color; ctx.lineWidth = this.r;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - Math.cos(a) * 40, sy - Math.sin(a) * 40); ctx.stroke();
        }
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(sx, sy, this.r * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      },
    };
  }

  RE.makeProjectile = makeProjectile;
})(window.RE = window.RE || {});
