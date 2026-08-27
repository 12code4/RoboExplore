/* RoboExplore — tilemap wrapper: collision queries against the generated grid.
 * Coordinates: world px. Tile size from CFG.tile.
 */
(function (RE) {
  'use strict';
  const M = RE.M;

  function makeTilemap(gen, tileSize) {
    const W = gen.w, H = gen.h, T = tileSize;
    const grid = gen.grid;

    const map = {
      w: W, h: H, tile: T,
      pxW: W * T, pxH: H * T,
      grid, gen,

      isWallTile(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
        return grid[ty * W + tx] === gen.WALL;
      },
      isWallPx(px, py) {
        return this.isWallTile((px / T) | 0, (py / T) | 0);
      },
      tileAtPx(px, py) {
        return { tx: (px / T) | 0, ty: (py / T) | 0 };
      },
      centerOfTile(tx, ty) {
        return { x: (tx + 0.5) * T, y: (ty + 0.5) * T };
      },

      // Resolve a circle (cx,cy,r) against walls; returns corrected {x,y,hitX,hitY}.
      // Samples the 3x3 tile neighborhood and pushes out of overlapping walls.
      collideCircle(cx, cy, r) {
        let hitX = false, hitY = false;
        const minTx = ((cx - r) / T | 0) - 1;
        const maxTx = ((cx + r) / T | 0) + 1;
        const minTy = ((cy - r) / T | 0) - 1;
        const maxTy = ((cy + r) / T | 0) + 1;
        for (let ty = minTy; ty <= maxTy; ty++) {
          for (let tx = minTx; tx <= maxTx; tx++) {
            if (!this.isWallTile(tx, ty)) continue;
            const rx = tx * T, ry = ty * T;
            // closest point on tile AABB to circle center
            const nx = M.clamp(cx, rx, rx + T);
            const ny = M.clamp(cy, ry, ry + T);
            let dx = cx - nx, dy = cy - ny;
            const d2 = dx * dx + dy * dy;
            if (d2 < r * r) {
              let d = Math.sqrt(d2);
              if (d === 0) {
                // center inside tile — push along least-penetration axis
                const left = cx - rx, right = rx + T - cx;
                const top = cy - ry, bottom = ry + T - cy;
                const mMin = Math.min(left, right, top, bottom);
                if (mMin === left) { cx = rx - r; hitX = true; }
                else if (mMin === right) { cx = rx + T + r; hitX = true; }
                else if (mMin === top) { cy = ry - r; hitY = true; }
                else { cy = ry + T + r; hitY = true; }
              } else {
                const push = (r - d);
                cx += (dx / d) * push;
                cy += (dy / d) * push;
                if (Math.abs(dx) > Math.abs(dy)) hitX = true; else hitY = true;
              }
            }
          }
        }
        return { x: cx, y: cy, hitX, hitY };
      },

      // Line-of-sight / raycast against walls (DDA). Returns hit point or null.
      // Used for enemy vision and projectile wall checks.
      raycast(x0, y0, x1, y1) {
        const dx = x1 - x0, dy = y1 - y0;
        const steps = Math.ceil(Math.hypot(dx, dy) / (T * 0.4));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const px = x0 + dx * t, py = y0 + dy * t;
          if (this.isWallPx(px, py)) return { x: px, y: py, t, tx: (px / T) | 0, ty: (py / T) | 0 };
        }
        return null;
      },
      hasLOS(x0, y0, x1, y1) { return this.raycast(x0, y0, x1, y1) === null; },
    };
    return map;
  }

  RE.Tilemap = { make: makeTilemap };
})(window.RE = window.RE || {});
