/* RoboExplore — procedural cave generation.
 * Cellular-automata caverns with guaranteed connectivity, a spawn and an exit
 * placed far apart, plus feature slots (energy nodes, salvage, stations,
 * pickups, enemy spawn hints, log fragments). Fully seeded/deterministic.
 */
(function (RE) {
  'use strict';

  const WALL = 1, FLOOR = 0;

  function generate(opts) {
    const rng = opts.rng;
    const W = opts.w, H = opts.h;
    const fill = opts.fill != null ? opts.fill : 0.46;   // initial wall probability
    const steps = opts.steps != null ? opts.steps : 5;
    const openness = opts.openness != null ? opts.openness : 0; // -1 tighter, +1 more open

    let grid = new Uint8Array(W * H);
    const at = (x, y) => grid[y * W + x];
    const set = (x, y, v) => { grid[y * W + x] = v; };

    // 1. Random fill with solid border.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) set(x, y, WALL);
        else set(x, y, rng.next() < fill ? WALL : FLOOR);
      }
    }

    // 2. Smoothing iterations (4-5 rule variant).
    const birth = 5 - Math.max(0, openness);
    const survive = 4 + Math.min(0, openness);
    for (let s = 0; s < steps; s++) {
      const next = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) { next[y * W + x] = WALL; continue; }
          let n = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              if (at(x + dx, y + dy) === WALL) n++;
            }
          const cur = at(x, y);
          if (cur === WALL) next[y * W + x] = (n >= survive) ? WALL : FLOOR;
          else next[y * W + x] = (n > birth) ? WALL : FLOOR;
        }
      }
      grid = next;
    }
    const at2 = (x, y) => grid[y * W + x];

    // 3. Flood fill to find the largest open region; fill the rest.
    const region = new Int32Array(W * H).fill(-1);
    let bestId = -1, bestSize = 0, regionCount = 0;
    const regions = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (grid[i] === FLOOR && region[i] === -1) {
          // BFS
          const id = regionCount++;
          const stack = [i]; region[i] = id;
          const cells = [];
          while (stack.length) {
            const c = stack.pop();
            cells.push(c);
            const cx = c % W, cy = (c / W) | 0;
            const neigh = [c - 1, c + 1, c - W, c + W];
            for (const nn of neigh) {
              const nx = nn % W, ny = (nn / W) | 0;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              if (grid[nn] === FLOOR && region[nn] === -1) { region[nn] = id; stack.push(nn); }
            }
          }
          regions.push(cells);
          if (cells.length > bestSize) { bestSize = cells.length; bestId = id; }
        }
      }
    }
    // Fill non-main regions (keep only the biggest cavern for guaranteed connectivity).
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === FLOOR && region[i] !== bestId) grid[i] = WALL;
    }
    const openCells = regions[bestId] || [];

    // If the main region is too small, retry with different fill.
    if (openCells.length < (W * H) * 0.16 && (opts._retry || 0) < 4) {
      return generate(Object.assign({}, opts, { fill: fill - 0.03, _retry: (opts._retry || 0) + 1 }));
    }

    // 4. Choose spawn & exit far apart (via BFS distance from a random cell).
    const cellXY = (i) => ({ x: i % W, y: (i / W) | 0 });
    function bfsFarthest(startIdx) {
      const dist = new Int32Array(grid.length).fill(-1);
      const q = [startIdx]; dist[startIdx] = 0;
      let far = startIdx, farD = 0, head = 0;
      while (head < q.length) {
        const c = q[head++];
        const d = dist[c];
        const cx = c % W, cy = (c / W) | 0;
        const neigh = [c - 1, c + 1, c - W, c + W];
        for (const nn of neigh) {
          const nx = nn % W, ny = (nn / W) | 0;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (grid[nn] === FLOOR && dist[nn] === -1) {
            dist[nn] = d + 1; q.push(nn);
            if (dist[nn] > farD) { farD = dist[nn]; far = nn; }
          }
        }
      }
      return { far, dist, farD };
    }
    const seed0 = openCells[(rng.next() * openCells.length) | 0];
    const a = bfsFarthest(seed0);
    const b = bfsFarthest(a.far);       // b.far is the true diameter endpoint
    const spawnIdx = a.far;
    const exitIdx = b.far;
    const distFromSpawn = bfsFarthest(spawnIdx).dist;

    // 5. Feature placement — pick cells with min distance apart.
    const usedFeature = new Set([spawnIdx, exitIdx]);
    function tooClose(idx, minTiles) {
      const { x, y } = cellXY(idx);
      for (const u of usedFeature) {
        const ux = u % W, uy = (u / W) | 0;
        if (Math.abs(ux - x) + Math.abs(uy - y) < minTiles) return true;
      }
      return false;
    }
    // reachable cells sorted by distance from spawn (used for progression pacing)
    const reachable = openCells.filter(i => distFromSpawn[i] >= 0);
    function pickFeatureCell(minDistFromSpawn, minApart) {
      let tries = 0;
      while (tries++ < 60) {
        const c = reachable[(rng.next() * reachable.length) | 0];
        if (distFromSpawn[c] < minDistFromSpawn) continue;
        if (tooClose(c, minApart || 4)) continue;
        usedFeature.add(c);
        return c;
      }
      // fallback: any free cell
      for (const c of reachable) if (!usedFeature.has(c)) { usedFeature.add(c); return c; }
      return spawnIdx;
    }

    return {
      w: W, h: H, grid, WALL, FLOOR,
      openCells, reachable, region, mainRegion: bestId,
      spawn: cellXY(spawnIdx), exit: cellXY(exitIdx),
      spawnIdx, exitIdx, distFromSpawn,
      cellXY, pickFeatureCell, rng,
      diameter: b.farD,
    };
  }

  RE.Gen = { generate, WALL, FLOOR };
})(window.RE = window.RE || {});
