/* RoboExplore — camera with smooth follow, look-ahead, and trauma-based shake. */
(function (RE) {
  'use strict';
  const M = RE.M;

  const Camera = {
    x: 0, y: 0,            // top-left of view in world space
    tx: 0, ty: 0,          // desired center target
    viewW: 960, viewH: 540,
    trauma: 0,             // 0..1, decays over time
    shakeT: 0,
    _seed: Math.random() * 1000,
    zoom: 1,

    init(viewW, viewH) {
      this.viewW = viewW; this.viewH = viewH;
      this.trauma = 0;
    },

    // Center immediately on a point (e.g. new sector).
    snapTo(x, y) {
      this.tx = x; this.ty = y;
      this.x = x - this.viewW / 2;
      this.y = y - this.viewH / 2;
    },

    follow(targetX, targetY, vx, vy, cfg, dt, bounds, cursor) {
      // velocity lead — so pulses reveal ahead of your motion
      let leadX = M.clamp((vx || 0) * cfg.lookAheadVel, -cfg.lookAheadMax, cfg.lookAheadMax);
      let leadY = M.clamp((vy || 0) * cfg.lookAheadVel, -cfg.lookAheadMax, cfg.lookAheadMax);
      // aim bias — bias the view toward where you're aiming
      if (cursor) {
        leadX += M.clamp((cursor.x - targetX) * cfg.aimBias, -cfg.aimMax, cfg.aimMax);
        leadY += M.clamp((cursor.y - targetY) * cfg.aimBias, -cfg.aimMax, cfg.aimMax);
      }
      this.tx = targetX + leadX;
      this.ty = targetY + leadY;
      const cx = this.x + this.viewW / 2;
      const cy = this.y + this.viewH / 2;
      // deadzone kills micro-jitter when nearly settled
      const dz = cfg.deadzone || 0;
      let tx = this.tx, ty = this.ty;
      if (Math.abs(tx - cx) < dz && Math.abs(vx || 0) < 6) tx = cx;
      if (Math.abs(ty - cy) < dz && Math.abs(vy || 0) < 6) ty = cy;
      const ncx = M.damp(cx, tx, cfg.followLambda, dt);
      const ncy = M.damp(cy, ty, cfg.followLambda, dt);
      this.x = ncx - this.viewW / 2;
      this.y = ncy - this.viewH / 2;
      if (bounds) this._clamp(bounds);
    },

    _clamp(b) {
      // b = {w, h} world size in px. Keep view inside, or center if smaller.
      if (b.w <= this.viewW) this.x = (b.w - this.viewW) / 2;
      else this.x = M.clamp(this.x, 0, b.w - this.viewW);
      if (b.h <= this.viewH) this.y = (b.h - this.viewH) / 2;
      else this.y = M.clamp(this.y, 0, b.h - this.viewH);
    },

    addTrauma(amount) {
      this.trauma = M.clamp(this.trauma + amount, 0, 1);
    },

    update(dt) {
      this.shakeT += dt;
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
    },

    // Returns the shake offset to apply when rendering.
    shakeOffset(maxShake) {
      if (this.trauma <= 0) return { x: 0, y: 0 };
      const s = this.trauma * this.trauma; // quadratic feels better
      const mag = (maxShake || 20) * s;
      const t = this.shakeT * 42 + this._seed;
      // pseudo-noise via layered sines
      const nx = Math.sin(t * 1.3) * 0.6 + Math.sin(t * 2.7) * 0.4;
      const ny = Math.cos(t * 1.1) * 0.6 + Math.cos(t * 3.1) * 0.4;
      return { x: nx * mag, y: ny * mag };
    },

    // World -> screen using an optional shake offset.
    toScreen(wx, wy, off) {
      return { x: wx - this.x + (off ? off.x : 0), y: wy - this.y + (off ? off.y : 0) };
    },
    // Screen (view coords) -> world.
    toWorld(sx, sy) {
      return { x: sx + this.x, y: sy + this.y };
    },
  };

  RE.Camera = Camera;
})(window.RE = window.RE || {});
