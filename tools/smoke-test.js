/* RoboExplore — headless smoke test.
 * Boots the game in a headless browser, drives real input across the core
 * loop (run start → move/echo/dash/fire → sector transition → reward → death),
 * and fails on any uncaught runtime error.
 *
 *   npm install --no-save playwright
 *   node tools/smoke-test.js
 *
 * Set RE_CHROME to override the browser binary; otherwise common Playwright
 * headless-shell / chromium locations are tried.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'index.html');

function findChrome() {
  if (process.env.RE_CHROME && fs.existsSync(process.env.RE_CHROME)) return process.env.RE_CHROME;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const candidates = [];
  try {
    for (const d of fs.readdirSync(base)) {
      if (d.startsWith('chromium_headless_shell')) candidates.push(path.join(base, d, 'chrome-linux', 'headless_shell'));
    }
    for (const d of fs.readdirSync(base)) {
      if (d.startsWith('chromium-')) candidates.push(path.join(base, d, 'chrome-linux', 'chrome'));
    }
  } catch (e) { /* ignore */ }
  return candidates.find(p => fs.existsSync(p)) || undefined;
}

function assert(cond, msg) { if (!cond) throw new Error('ASSERT FAILED: ' + msg); }

(async () => {
  const exe = findChrome();
  const browser = await chromium.launch({
    executablePath: exe,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '')));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ERROR: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(350);

  const info = await page.evaluate(() => ({ hasGame: !!(window.RE && RE.Game), state: RE.Game.state }));
  assert(info.hasGame, 'RE.Game defined');
  assert(info.state === 'title', 'starts on title');

  await page.evaluate(() => RE.Game.startRun());
  await page.waitForTimeout(200);
  const run = await page.evaluate(() => ({
    state: RE.Game.state, alive: RE.Game.player.alive,
    enemies: RE.Game.enemies.length, floors: RE.Game.gen.openCells.length,
  }));
  assert(run.state === 'playing', 'run started');
  assert(run.alive, 'player alive');
  assert(run.enemies > 0, 'enemies spawned');
  assert(run.floors > 500, 'cave has open space');

  await page.mouse.move(900, 360);
  await page.keyboard.down('KeyW');
  await page.mouse.down();
  for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(110); if (i % 2 === 0) await page.keyboard.press('Space'); }
  await page.keyboard.up('KeyW');
  await page.mouse.up();
  await page.waitForTimeout(250);

  await page.evaluate(() => RE.Game.nextSector());
  await page.waitForTimeout(120);
  const s2 = await page.evaluate(() => RE.Game.sector);
  assert(s2 === 2, 'descended to sector 2');

  await page.evaluate(() => RE.Game.presentReward(RE.Game._rollModules(3), 'TEST'));
  const rew = await page.evaluate(() => RE.Game.rewardChoices.length);
  assert(rew === 3, 'reward offers 3 modules');
  await page.evaluate(() => RE.Game.chooseReward(RE.Game.rewardChoices[0]));
  assert(await page.evaluate(() => RE.Game.state) === 'playing', 'reward resumes play');

  await page.evaluate(() => { RE.Game.player.iframes = 0; RE.Game.damagePlayer(9999); });
  await page.waitForTimeout(120);
  const dead = await page.evaluate(() => ({ state: RE.Game.state, alive: RE.Game.player.alive }));
  assert(dead.state === 'dead' && !dead.alive, 'death → game over');

  await browser.close();

  if (errors.length) {
    console.error('\n✗ SMOKE TEST FAILED — ' + errors.length + ' runtime error(s):\n');
    errors.forEach(e => console.error(e));
    process.exit(1);
  }
  console.log('✓ smoke test passed — core loop runs without runtime errors');
  process.exit(0);
})().catch(e => { console.error('✗ HARNESS ERROR:', e); process.exit(2); });
