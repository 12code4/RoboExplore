/* RoboExplore — heuristic playtest bot.
 * Drives the game with a simple competent policy (pulse on a cadence, move
 * toward the exit, shoot the nearest revealed enemy, dash when hit) and reports
 * how a run unfolds: sector reached, time per sector, hull/energy pressure.
 * A QA/balance instrument, not a correctness test.
 *
 *   node tools/playbot.js [seconds]
 */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const SECONDS = +(process.argv[2] || 120);
const START_SECTOR = +(process.argv[3] || 1);

function findChrome() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const d of fs.readdirSync(base)) if (d.startsWith('chromium_headless_shell')) return path.join(base, d, 'chrome-linux', 'headless_shell');
  for (const d of fs.readdirSync(base)) if (d.startsWith('chromium-')) return path.join(base, d, 'chrome-linux', 'chrome');
}

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(300);

  const report = await page.evaluate(({ SECONDS, START_SECTOR }) => {
    const G = RE.Game, I = RE.Input;
    G.startRun();
    if (START_SECTOR > 1) { G.loadSector(START_SECTOR); G.state = 'playing'; }
    const STEP = 1 / 60, N = Math.floor(SECONDS / STEP);
    const set = (code, v) => { I.keys[code] = v; };
    const press = (code) => { I._pressed[code] = true; };
    const clearEdges = () => { I._pressed = Object.create(null); I.mouse._pressed = false; };
    let sinceEcho = 0, lastHull = G.player.hull, hitReactT = 0;
    let prevSector = 1, sectorStart = 0; const times = [];
    let minHull = 100, deaths = 0, sectorReached = 1;
    let stuckT = 0, wander = 0, lastX = G.player.x, lastY = G.player.y;
    const VW = RE.CFG.viewW, VH = RE.CFG.viewH;

    for (let f = 0; f < N; f++) {
      const t = f * STEP;
      if (G.state !== 'playing') {
        // handle non-play states so the bot keeps going
        if (G.state === 'reward') { G.chooseReward(G.rewardChoices[0]); }
        else if (G.state === 'station') { G.stationRefill(); G.closeStation(); }
        else if (G.state === 'dead') { deaths++; break; }
        clearEdges(); continue;
      }
      const p = G.player, cam = G.camera;
      // aim at nearest revealed enemy, else toward exit
      let target = null, bestD = 1e9;
      for (const e of G.enemies) { if (!e.alive) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < 340 && d < bestD && (e.visibility ? e.visibility(p) > 0.2 : true)) { bestD = d; target = e; } }
      const exit = G.pickups.find(pk => pk.kind === 'exit');
      const aimAt = target || exit || { x: p.x + 1, y: p.y };
      // set aim via sx/sy so game.update's setViewMouse resolves it correctly
      I.mouse.sx = (aimAt.x - cam.x) / VW; I.mouse.sy = (aimAt.y - cam.y) / VH;
      I.mouse.down = !!(target && bestD < 300);

      // biased random walk: explores the cave while drifting toward the exit,
      // steering harder to wander when progress stalls (walls in the dark).
      stuckT += STEP;
      const moved = Math.hypot(p.x - lastX, p.y - lastY);
      if (f % 30 === 0) { if (moved < 24) wander += (Math.random() - 0.5) * 3.0; lastX = p.x; lastY = p.y; }
      wander += (Math.random() - 0.5) * 0.4;
      const bias = Math.atan2(exit ? exit.y - p.y : 0, exit ? exit.x - p.x : 1);
      // blend wander toward exit bias
      let ang = Math.atan2(0.55 * Math.sin(wander) + 0.45 * Math.sin(bias), 0.55 * Math.cos(wander) + 0.45 * Math.cos(bias));
      const dx = Math.cos(ang), dy = Math.sin(ang);
      set('KeyW', dy < -0.35); set('KeyS', dy > 0.35); set('KeyA', dx < -0.35); set('KeyD', dx > 0.35);

      // pulse on a ~1.1s cadence when we have energy
      sinceEcho += STEP;
      if (sinceEcho > 1.1 && p.energy > 25 && p.echoCd <= 0) { press('KeyE'); sinceEcho = 0; }

      // dash away when we just took a hit
      if (p.hull < lastHull) hitReactT = 0.25;
      lastHull = p.hull;
      if (hitReactT > 0) { hitReactT -= STEP; if (p.dashCd <= 0 && p.energy > 20) press('Space'); }

      G.update(STEP);   // full update (handles view-mouse + play)
      clearEdges();

      minHull = Math.min(minHull, p.hull / p.hullMax);
      if (G.sector !== prevSector) { times.push({ sector: prevSector, seconds: +(t - sectorStart).toFixed(1) }); sectorStart = t; prevSector = G.sector; }
      sectorReached = Math.max(sectorReached, G.sector);
    }
    return { startSector: START_SECTOR, state: G.state, sectorReached, won: G.won, deaths, minHullPct: +(minHull * 100).toFixed(0), times, finalHull: Math.round(G.player.hull), salvage: G.salvage, kills: G.kills };
  }, { SECONDS, START_SECTOR });

  await browser.close();
  console.log(JSON.stringify(report, null, 1));
  if (errors.length) { console.error('RUNTIME ERRORS:', errors.slice(0, 8)); process.exit(1); }
  process.exit(0);
})().catch(e => { console.error('BOT ERROR', e); process.exit(2); });
