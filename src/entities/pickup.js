/* RoboExplore — pickups: salvage, energy, hull, modules, core-shards, logs,
 * and the sector exit. Pickups are dim until echo/light reveals them, which
 * reinforces the core loop: pulse to find what's worth grabbing.
 */
(function (RE) {
  'use strict';
  const M = RE.M, Particles = RE.Particles;

  const KIND = {
    salvage:  { r: 8,  color: '#ffe27a', glow: '#fff2b0', sfx: 'pickup' },
    energy:   { r: 9,  color: '#4ad6ff', glow: '#b6ecff', sfx: 'energy' },
    hull:     { r: 9,  color: '#5affa0', glow: '#c4ffe0', sfx: 'pickup' },
    module:   { r: 12, color: '#ff8adf', glow: '#ffc9ef', sfx: 'pickup_big' },
    shard:    { r: 10, color: '#c0a0ff', glow: '#e6d9ff', sfx: 'pickup_big' },
    log:      { r: 10, color: '#9fe6ff', glow: '#d6f5ff', sfx: 'pickup' },
    exit:     { r: 20, color: '#7affd1', glow: '#d0fff0', sfx: null },
    station:  { r: 18, color: '#ffd27a', glow: '#fff0c4', sfx: null },
  };

  function makePickup(kind, x, y, opts) {
    opts = opts || {};
    const k = KIND[kind] || KIND.salvage;
    return {
      type: 'pickup',
      kind, alive: true,
      x, y, r: opts.r || k.r,
      color: k.color, glow: k.glow,
      value: opts.value || 0,
      data: opts.data || null,     // module def, log text, etc.
      magnetized: false,
      bob: Math.random() * Math.PI * 2,
      spin: Math.random() * Math.PI * 2,
      collectible: kind !== 'exit' && kind !== 'station',
      solidStation: kind === 'station',
      used: false,

      update(dt, game) {
        this.bob += dt * 2.2;
        this.spin += dt * (this.kind === 'module' ? 1.4 : 0.8);
        const p = game.player;
        if (!p || !p.alive) return;
        const d = M.dist(this.x, this.y, p.x, p.y);

        // Magnet attraction for collectibles.
        if (this.collectible) {
          const magnet = p.stats.magnetRange || 0;
          const baseRange = 40 + magnet;
          if (d < baseRange) {
            this.magnetized = true;
          }
          if (this.magnetized) {
            const pull = M.lerp(80, 520, 1 - M.clamp(d / (baseRange + 20), 0, 1));
            const a = Math.atan2(p.y - this.y, p.x - this.x);
            this.x += Math.cos(a) * pull * dt;
            this.y += Math.sin(a) * pull * dt;
          }
          if (d < p.radius + this.r * 0.7) {
            this.collect(game);
          }
        }
      },

      collect(game) {
        if (!this.alive || this.used) return;
        this.used = true; this.alive = false;
        const k = KIND[this.kind];
        game.onCollect(this);
        if (k.sfx) RE.Audio.sfx(k.sfx);
        Particles.burst(this.x, this.y, this.kind === 'module' ? 16 : 8, {
          speed: 130, color: this.glow, life: 0.5, size: 3, kind: 'dot',
        });
        Particles.ring(this.x, this.y, { color: this.glow, size: this.r, life: 0.4 });
      },

      // How brightly it renders — dim until echo/light touches it.
      render(ctx, cam, echo, player) {
        const light = echo ? echo.lightAt(this.x, this.y, player) : 1;
        const baseGlimmer = 0.14;         // faint always-on shimmer
        const vis = Math.max(baseGlimmer, light);
        if (vis < 0.03) return;
        const sx = this.x - cam.x, sy = this.y - cam.y;
        const bobY = Math.sin(this.bob) * 2.5;
        ctx.save();
        ctx.translate(sx, sy + bobY);
        ctx.globalAlpha = vis;

        if (this.kind === 'exit') { this._renderExit(ctx, light); ctx.restore(); return; }
        if (this.kind === 'station') { this._renderStation(ctx, light); ctx.restore(); return; }

        // glow halo
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r * 3);
        gr.addColorStop(0, RE.M.rgba(this.glow, 0.6 * vis));
        gr.addColorStop(1, RE.M.rgba(this.glow, 0));
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(0, 0, this.r * 3, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        ctx.rotate(this.spin);
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        if (this.kind === 'salvage') this._poly(ctx, 4, this.r);
        else if (this.kind === 'energy') this._bolt(ctx);
        else if (this.kind === 'hull') this._cross(ctx);
        else if (this.kind === 'module') this._hex(ctx);
        else if (this.kind === 'shard') this._poly(ctx, 3, this.r);
        else if (this.kind === 'log') this._poly(ctx, 6, this.r);
        else this._poly(ctx, 5, this.r);
        ctx.restore();
      },

      _poly(ctx, n, r) {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      },
      _hex(ctx) { this._poly(ctx, 6, this.r); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, this.r * 0.35, 0, Math.PI * 2); ctx.fill(); },
      _bolt(ctx) {
        ctx.beginPath();
        ctx.moveTo(-3, -this.r); ctx.lineTo(3, -2); ctx.lineTo(0, -2);
        ctx.lineTo(4, this.r); ctx.lineTo(-2, 2); ctx.lineTo(1, 2);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      },
      _cross(ctx) {
        const a = this.r * 0.4;
        ctx.fillRect(-a, -this.r, a * 2, this.r * 2);
        ctx.fillRect(-this.r, -a, this.r * 2, a * 2);
      },
      _renderExit(ctx, light) {
        const vis = Math.max(0.25, light);
        ctx.globalAlpha = vis;
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.6 + 0.4 * Math.sin(this.bob * 1.5);
        for (let ring = 0; ring < 3; ring++) {
          const rr = this.r + ring * 8 + pulse * 6;
          ctx.strokeStyle = RE.M.rgba(this.glow, (0.5 - ring * 0.14) * vis);
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = RE.M.rgba(this.color, 0.9 * vis);
        ctx.beginPath();
        // downward chevrons (descend)
        for (let i = 0; i < 2; i++) {
          const yy = -6 + i * 8;
          ctx.moveTo(-8, yy - 3); ctx.lineTo(0, yy + 4); ctx.lineTo(8, yy - 3);
        }
        ctx.lineWidth = 3; ctx.strokeStyle = this.color; ctx.stroke();
      },
      _renderStation(ctx, light) {
        const vis = Math.max(0.3, light);
        ctx.globalAlpha = vis;
        ctx.fillStyle = RE.M.rgba('#2a2010', 0.9);
        ctx.strokeStyle = this.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.5 + 0.5 * Math.sin(this.bob);
        ctx.fillStyle = RE.M.rgba(this.glow, 0.5 * pulse * vis);
        ctx.beginPath(); ctx.arc(0, 0, this.r * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = this.color;
        ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('₪', 0, 1);
      },
    };
  }

  RE.makePickup = makePickup;
  RE.PICKUP_KINDS = KIND;
})(window.RE = window.RE || {});
