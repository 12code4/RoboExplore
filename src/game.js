/* RoboExplore — game core: state machine, world building, simulation glue,
 * rendering with echo-lit tiles, rewards, and meta-progression.
 */
(function (RE) {
  'use strict';
  const M = RE.M, CFG = RE.CFG;

  // Meta-progression upgrade tree (spend core-shards, persistent).
  RE.META_UPGRADES = [
    { id: 'hull', name: 'Reinforced Hull', desc: '+12 max hull per level.', cost: 3, costPer: 2, max: 5 },
    { id: 'energy', name: 'Power Cells', desc: '+12 max energy per level.', cost: 3, costPer: 2, max: 5 },
    { id: 'regen', name: 'Fast Recharge', desc: '+12% energy regen per level.', cost: 4, costPer: 2, max: 4 },
    { id: 'salvage', name: 'Refinery', desc: '+20% salvage gained per level.', cost: 4, costPer: 3, max: 3 },
    { id: 'echo', name: 'Deep Echo', desc: '+12% echo range per level.', cost: 3, costPer: 2, max: 3 },
    { id: 'start_capacitor', name: 'Field Kit: Capacitor', desc: 'Start each run with a Capacitor Bank.', cost: 8, max: 1 },
    { id: 'start_overclock', name: 'Field Kit: Servos', desc: 'Start each run with Overclock Servos.', cost: 8, max: 1 },
    { id: 'revive', name: 'Backup Core', desc: 'Revive once per run at 40% hull.', cost: 14, max: 1 },
  ];

  const Game = {
    canvas: null, ctx: null,
    state: 'title',      // title | playing | paused | reward | dead | meta
    prevState: 'title',
    time: 0, fps: 60, _frames: 0, _fpsT: 0,
    hitStopT: 0,
    _mouseMoved: false, _lastMouse: { x: -1, y: -1 },

    // run state
    seed: 0, rng: null,
    sector: 1, biome: null, biomeIndex: -1,
    salvage: 0, runShards: 0, score: 0, kills: 0,
    player: null, map: null,
    enemies: [], projectiles: [], pickups: [], boss: null,
    camera: RE.Camera,
    won: false,
    runStats: { sector: 0, kills: 0, score: 0, shards: 0 },
    rewardChoices: null, rewardTitle: '', _rewardResumeState: 'playing',
    revivesLeft: 0,
    _descending: false,
    logsThisRun: {},

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      RE.Save.load();
      RE.Audio.setMuted(RE.Save.data.settings.muted);
      CFG.debug.fps = RE.Save.data.settings.showFps;
      RE.Particles.init();
      RE.Input.init(canvas);
      this.camera.init(CFG.viewW, CFG.viewH);
      this.state = 'title';
      RE.HUD.reset();
    },

    // ---- Run lifecycle -------------------------------------------------
    startRun() {
      RE.Audio.resume();
      this.seed = RE.RNG.randomSeed();
      this.rng = RE.RNG.make(this.seed);
      this.sector = 1;
      this.salvage = 0; this.runShards = 0; this.score = 0; this.kills = 0;
      this.biomeIndex = -1; this.won = false; this._descending = false;
      this.logsThisRun = {};
      // build player with meta applied
      this.player = RE.makePlayer(0, 0);
      this.player.equip('blaster');
      this._applyMeta(this.player);
      this.enemies = []; this.projectiles = []; this.pickups = []; this.boss = null;
      RE.HUD.reset();
      RE.Particles.clear();
      this.loadSector(1);
      this.state = 'playing';
    },

    _applyMeta(p) {
      const u = RE.Save.data.unlocks;
      const lvl = (id) => (typeof u[id] === 'number' ? u[id] : (u[id] ? 1 : 0));
      if (lvl('hull')) p.stats.hullMaxAdd += 12 * lvl('hull');
      if (lvl('energy')) p.stats.energyMaxAdd += 12 * lvl('energy');
      if (lvl('regen')) p.stats.energyRegenMul *= (1 + 0.12 * lvl('regen'));
      if (lvl('echo')) p.stats.echoRangeMul *= (1 + 0.12 * lvl('echo'));
      this.salvageMul = 1 + 0.2 * lvl('salvage');
      p.recompute();
      p.hull = p.hullMax; p.energy = p.energyMax;
      if (u.start_capacitor) p.equip('capacitor');
      if (u.start_overclock) p.equip('overclock');
      this.revivesLeft = u.revive ? 1 : 0;
      p.hull = p.hullMax; p.energy = p.energyMax;
    },

    loadSector(n) {
      this.sector = n;
      this._descending = false;
      const biome = RE.biomeForSector(n);
      const biomeChanged = biome !== this.biome;
      this.biome = biome;
      // Map size scales gently with depth.
      const size = Math.min(96, 58 + n * 2);
      const srng = this.rng.fork('sector' + n);
      const gen = RE.Gen.generate({
        rng: srng, w: size, h: size,
        fill: biome.gen.fill, steps: biome.gen.steps, openness: biome.gen.openness,
      });
      this.gen = gen;
      this.map = RE.Tilemap.make(gen, CFG.tile);
      RE.Echo.reset(this.map, CFG);

      // Place player at spawn.
      const sp = this.map.centerOfTile(gen.spawn.x, gen.spawn.y);
      this.player.x = sp.x; this.player.y = sp.y;
      this.player.vx = 0; this.player.vy = 0;
      // small progression refill
      this.player.energy = this.player.energyMax;
      if (n > 1) this.player.heal(this.player.hullMax * 0.08);

      // clear transient
      this.enemies.length = 0;
      this.projectiles.length = 0;
      this.pickups.length = 0;
      this.boss = null;
      RE.Particles.clear();

      // Exit.
      const ex = this.map.centerOfTile(gen.exit.x, gen.exit.y);
      this.pickups.push(RE.makePickup('exit', ex.x, ex.y));

      this._populateSector(n, biome, srng);

      // Opening echo so the player isn't fully blind.
      RE.Echo.pulse(sp.x, sp.y, { maxR: 260 });

      this.camera.snapTo(sp.x, sp.y);
      RE.HUD.showBanner('SECTOR ' + n, biome.name, 2.4);
      if (this.sector % CFG.biomeSize === 1 || biomeChanged) HUDToastVibe(biome);
      if (biomeChanged) { RE.Audio.startMusic(biome.music); }
      RE.Audio.sfx('sector');

      function HUDToastVibe(b) { if (b.vibe) RE.HUD.toast(b.vibe, { life: 4, color: 'rgba(180,210,235,0.8)' }); }
    },

    _populateSector(n, biome, rng) {
      const map = this.map, gen = this.gen;
      const cell = (idx) => { const c = gen.cellXY(idx); return map.centerOfTile(c.x, c.y); };
      const minSpawnDist = 8;

      // Enemies scale with depth.
      const count = Math.round(4 + n * 1.4);
      const pool = biome.enemies;
      for (let i = 0; i < count; i++) {
        const idx = gen.pickFeatureCell(10, 3);
        const pos = cell(idx);
        // weight toward earlier enemies in shallow sectors
        const id = rng.pick(pool);
        this.enemies.push(RE.makeEnemy(id, pos.x, pos.y, n));
      }

      // Energy nodes.
      const energyN = 2 + (rng.next() < 0.5 ? 1 : 0);
      for (let i = 0; i < energyN; i++) {
        const pos = cell(gen.pickFeatureCell(6, 5));
        this.pickups.push(RE.makePickup('energy', pos.x, pos.y, { value: 45 }));
      }
      // Salvage scatter.
      const salvageN = 5 + Math.floor(n * 0.6);
      for (let i = 0; i < salvageN; i++) {
        const pos = cell(gen.pickFeatureCell(4, 2));
        this.pickups.push(RE.makePickup('salvage', pos.x, pos.y, { value: rng.int(4, 9) }));
      }
      // Hull repair (sometimes).
      if (rng.next() < 0.7) {
        const pos = cell(gen.pickFeatureCell(6, 5));
        this.pickups.push(RE.makePickup('hull', pos.x, pos.y, { value: 30 }));
      }
      // Module cache (most sectors).
      if (rng.next() < 0.85) {
        const pos = cell(gen.pickFeatureCell(9, 6));
        this.pickups.push(RE.makePickup('module', pos.x, pos.y));
      }
      // Core-shard (rarely, more likely deeper).
      if (rng.next() < 0.25 + n * 0.03) {
        const pos = cell(gen.pickFeatureCell(10, 6));
        this.pickups.push(RE.makePickup('shard', pos.x, pos.y, { value: 1 }));
      }
    },

    nextSector() {
      if (this._descending) return;
      this._descending = true;
      if (this.sector >= CFG.sectorsPerRun) { this.win(); return; }
      RE.HUD.showBanner('DESCENDING', '', 1.2);
      // brief delay via banner; load next immediately for simplicity
      this.loadSector(this.sector + 1);
    },

    win() {
      this.won = true;
      this._endRun();
    },

    onPlayerDeath() {
      if (this.revivesLeft > 0) {
        this.revivesLeft--;
        this.player.alive = true;
        this.player.hull = this.player.hullMax * 0.4;
        this.player.energy = this.player.energyMax;
        this.player.iframes = 2;
        RE.HUD.showBanner('BACKUP CORE', 'system rebooted', 2);
        RE.Audio.sfx('shield');
        RE.Particles.burst(this.player.x, this.player.y, 30, { speed: 260, color: '#7affd1', life: 0.8, size: 3, kind: 'spark' });
        return;
      }
      this._endRun();
    },

    _endRun() {
      this.won = this.won || false;
      // convert leftover into a couple shards for progress
      const bonusShards = Math.floor(this.salvage / 120);
      this.runShards += bonusShards;
      this.score += this.sector * 100 + this.kills * 10;
      this.runStats = { sector: this.sector, kills: this.kills, score: this.score, shards: this.runShards };
      RE.Save.addShards(this.runShards);
      RE.Save.recordRun({ sector: this.sector, score: this.score, kills: this.kills });
      RE.Audio.stopMusic();
      this.state = 'dead';
    },

    // ---- Spawning helpers ---------------------------------------------
    spawnProjectile(opts) { this.projectiles.push(RE.makeProjectile(opts)); },
    spawnEnemyProjectile(x, y, vx, vy, dmg, color) {
      this.projectiles.push(RE.makeProjectile({ x, y, vx, vy, damage: dmg, color, friendly: false, r: 5, life: 3 }));
    },
    damagePlayer(amt, source) {
      if (!this.player || !this.player.alive) return false;
      return this.player.damage(amt, source, this);
    },
    dischargePulse(x, y, dmg) {
      RE.Particles.burst(x, y, 22, { speed: 300, color: '#8ff', life: 0.4, size: 3, kind: 'spark' });
      RE.Echo.pulse(x, y, { maxR: 130, speed: 900 });
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (M.dist(x, y, e.x, e.y) < 120) {
          const a = Math.atan2(e.y - y, e.x - x);
          e.takeDamage(dmg, Math.cos(a) * 200, Math.sin(a) * 200, this);
        }
      }
    },
    hitStop(t) { this.hitStopT = Math.max(this.hitStopT, Math.min(t, CFG.hitStopMax)); },

    onEnemyKilled(e) {
      this.kills++;
      this.score += (e.def.danger || 1) * 5;
      // drop salvage
      const [lo, hi] = e.def.salvage || [1, 3];
      const n = this.rng ? this.rng.int(lo, hi) : lo;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * 14;
        this.pickups.push(RE.makePickup('salvage', e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, { value: 3 }));
      }
      if (this.boss === e) { this.boss = null; }
    },

    onCollect(pickup) {
      const p = this.player;
      switch (pickup.kind) {
        case 'salvage': {
          const v = Math.round(pickup.value * (this.salvageMul || 1));
          this.salvage += v; this.score += v; break;
        }
        case 'energy': p.addEnergy(pickup.value); RE.HUD.toast('+' + pickup.value + ' energy', { color: '#4ad6ff', life: 1.4 }); break;
        case 'hull': p.heal(pickup.value); RE.HUD.toast('+' + pickup.value + ' hull', { color: '#5affa0', life: 1.4 }); break;
        case 'shard': this.runShards += pickup.value; this.score += pickup.value * 20; RE.HUD.toast('✦ core-shard recovered', { color: '#c0a0ff', life: 2.2, big: true }); break;
        case 'module': this.presentReward(this._rollModules(3), 'MODULE CACHE'); break;
        case 'log': break;
        default: break;
      }
    },

    _rollModules(count) {
      const all = Object.values(RE.MODULES).filter(m => !m._noReward);
      const rng = this.rng || RE.RNG.make(1);
      const weights = { common: 5, uncommon: 3, rare: 1.4, legendary: 0.6 };
      const chosen = [];
      const bag = all.slice();
      for (let i = 0; i < count && bag.length; i++) {
        const pickIdx = weightedIndex(bag, m => weights[m.rarity] || 1);
        chosen.push(bag[pickIdx]);
        bag.splice(pickIdx, 1);
      }
      return chosen;
      function weightedIndex(arr, wf) {
        let total = 0; for (const a of arr) total += wf(a);
        let r = rng.next() * total;
        for (let i = 0; i < arr.length; i++) { r -= wf(arr[i]); if (r <= 0) return i; }
        return arr.length - 1;
      }
    },

    presentReward(choices, title) {
      this.rewardChoices = choices;
      this.rewardTitle = title || 'SALVAGE RECOVERED';
      this._rewardResumeState = 'playing';
      this.state = 'reward';
      RE.Menus.focus = 0;
    },
    chooseReward(def) {
      const prev = this.player.modules[def.slot];
      this.player.equip(def.id);
      RE.HUD.toast('EQUIPPED: ' + def.name, { color: '#ff8adf', life: 2.4, big: true });
      if (prev && prev !== def.id) RE.HUD.toast('replaced ' + RE.MODULES[prev].name, { color: 'rgba(200,200,200,0.7)', life: 2 });
      this.rewardChoices = null;
      this.state = 'playing';
    },
    skipReward() {
      this.salvage += 15; this.score += 15;
      RE.HUD.toast('+15 salvage', { color: '#ffe27a', life: 1.6 });
      this.rewardChoices = null;
      this.state = 'playing';
    },

    // ---- Meta screen ---------------------------------------------------
    openMeta() { this.prevState = this.state; this.state = 'meta'; RE.Menus.focus = 0; },
    closeMeta() { this.state = (this.prevState === 'meta' ? 'title' : this.prevState) || 'title'; RE.Menus.focus = 0; },
    buyMeta(u, cost) {
      if (!RE.Save.spendShards(cost)) return;
      const cur = RE.Save.data.unlocks[u.id];
      const lvl = (typeof cur === 'number' ? cur : (cur ? 1 : 0)) + 1;
      RE.Save.data.unlocks[u.id] = u.max ? lvl : true;
      RE.Save.save();
      RE.Audio.sfx('pickup_big');
    },

    // ---- Pause / title -------------------------------------------------
    togglePause() {
      if (this.state === 'playing') { this.state = 'paused'; RE.Menus.focus = 0; }
      else if (this.state === 'paused') { this.state = 'playing'; }
    },
    abandonRun() { this._endRun(); this.state = 'title'; RE.Audio.stopMusic(); },
    gotoTitle() { this.state = 'title'; RE.Menus.focus = 0; RE.Audio.stopMusic(); },
    get mousePressed() { return RE.Input.mousePressed(); },

    // ---- Update --------------------------------------------------------
    update(dt) {
      this.time += dt;
      // fps
      this._frames++; this._fpsT += dt;
      if (this._fpsT >= 0.5) { this.fps = this._frames / this._fpsT; this._frames = 0; this._fpsT = 0; }

      // resolve view mouse & movement flag
      RE.Input.setViewMouse(RE.Input.mouse.sx * CFG.viewW, RE.Input.mouse.sy * CFG.viewH);
      this._mouseMoved = (RE.Input.mouse.x !== this._lastMouse.x || RE.Input.mouse.y !== this._lastMouse.y);
      this._lastMouse.x = RE.Input.mouse.x; this._lastMouse.y = RE.Input.mouse.y;

      // global mute toggle handled in menus; pause key
      if (this.state === 'playing' || this.state === 'paused') {
        if (RE.Input.pressed('pause')) this.togglePause();
      } else if (this.state === 'reward') {
        // allow escape to skip
      } else if (this.state === 'meta') {
        if (RE.Input.keyPressed('Escape')) this.closeMeta();
      }

      if (this.state === 'playing') this._updatePlaying(dt);
      else if (this.state === 'reward' || this.state === 'paused') { /* frozen */ }

      RE.HUD.update(this.state === 'playing' ? dt : dt * 0.0 + dt); // toasts still fade
    },

    _updatePlaying(dt) {
      // hit-stop freezes the simulation briefly for impact.
      if (this.hitStopT > 0) { this.hitStopT -= dt; if (this.hitStopT > 0) { RE.Particles.update(dt * 0.15); return; } }

      const p = this.player;
      RE.Echo.update(dt);
      p.update(dt, this);

      // enemies
      for (const e of this.enemies) if (e.alive) e.update(dt, this);

      // projectiles
      for (const pr of this.projectiles) if (pr.alive) pr.update(dt, this);
      this._projectileCollisions();

      // pickups
      for (const pk of this.pickups) if (pk.alive) pk.update(dt, this);

      // exit check
      this._checkExit();

      RE.Particles.update(dt);

      // camera
      this.camera.follow(p.x, p.y, p.vx, p.vy, CFG.camera, dt, { w: this.map.pxW, h: this.map.pxH });
      this.camera.update(dt);

      // prune dead
      if (this._frames % 1 === 0) {
        this.enemies = this.enemies.filter(e => e.alive);
        this.projectiles = this.projectiles.filter(pr => pr.alive);
        this.pickups = this.pickups.filter(pk => pk.alive);
      }

      // music intensity from nearby awake enemies
      let threat = 0;
      for (const e of this.enemies) if (e.awake && M.dist(e.x, e.y, p.x, p.y) < 360) threat++;
      RE.Audio.setMusicIntensity(M.clamp(threat / 5, 0, 1));
    },

    _projectileCollisions() {
      const p = this.player;
      for (const pr of this.projectiles) {
        if (!pr.alive) continue;
        if (pr.friendly) {
          for (const e of this.enemies) {
            if (!e.alive) continue;
            if (pr.hitSet && pr.hitSet.has(e)) continue;
            if (M.circleOverlap(pr.x, pr.y, pr.r, e.x, e.y, e.r)) {
              const a = Math.atan2(pr.vy, pr.vx);
              e.takeDamage(pr.damage, Math.cos(a) * 120, Math.sin(a) * 120, this);
              pr._impact(this, false);
              this.hitStop(0.012);
              if (pr.pierce > 0) {
                pr.pierce--;
                if (!pr.hitSet) pr.hitSet = new Set();
                pr.hitSet.add(e);
              } else { pr.alive = false; break; }
            }
          }
        } else {
          if (p.alive && p.iframes <= 0 && M.circleOverlap(pr.x, pr.y, pr.r, p.x, p.y, p.radius)) {
            if (this.damagePlayer(pr.damage, pr)) { pr.alive = false; pr._impact(this, false); }
          }
        }
      }
    },

    _checkExit() {
      for (const pk of this.pickups) {
        if (pk.kind === 'exit' && pk.alive) {
          if (M.dist(pk.x, pk.y, this.player.x, this.player.y) < pk.r + this.player.radius) {
            this.nextSector();
          }
        }
      }
    },

    // ---- Render --------------------------------------------------------
    render() {
      const ctx = this.ctx;
      const W = CFG.viewW, H = CFG.viewH;
      ctx.fillStyle = CFG.light.fogColor;
      ctx.fillRect(0, 0, W, H);

      if (this.state === 'title') { this._renderTitleBg(ctx); RE.Menus.title(ctx, this); this._cursor(ctx); return; }
      if (this.state === 'meta') {
        if (this.prevState === 'playing' || this.prevState === 'paused' || this.prevState === 'dead') this._renderWorld(ctx);
        else this._renderTitleBg(ctx);
        RE.Menus.meta(ctx, this); this._cursor(ctx); return;
      }

      this._renderWorld(ctx);
      RE.HUD.render(ctx, this);

      if (this.state === 'paused') RE.Menus.pause(ctx, this);
      else if (this.state === 'reward') RE.Menus.reward(ctx, this);
      else if (this.state === 'dead') RE.Menus.gameover(ctx, this);
      this._cursor(ctx);
    },

    _cursor(ctx) {
      // custom reticle at mouse
      const mx = RE.Input.mouse.x, my = RE.Input.mouse.y;
      ctx.save();
      ctx.strokeStyle = 'rgba(150,220,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - 11, my); ctx.lineTo(mx - 4, my);
      ctx.moveTo(mx + 4, my); ctx.lineTo(mx + 11, my);
      ctx.moveTo(mx, my - 11); ctx.lineTo(mx, my - 4);
      ctx.moveTo(mx, my + 4); ctx.lineTo(mx, my + 11);
      ctx.stroke();
      ctx.restore();
    },

    _renderWorld(ctx) {
      const cam = this.camera;
      const shake = cam.shakeOffset(CFG.camera.maxShake * (RE.Save.data.settings.screenShake || 1));
      ctx.save();
      ctx.translate(shake.x, shake.y);
      const camX = cam.x, camY = cam.y;

      this._renderTiles(ctx, camX, camY);
      this._renderEchoRings(ctx, camX, camY);

      // pickups (under entities)
      for (const pk of this.pickups) if (pk.alive) pk.render(ctx, cam, RE.Echo, this.player);
      // enemies
      for (const e of this.enemies) if (e.alive) e.render(ctx, cam, RE.Echo, this.player);
      // projectiles
      for (const pr of this.projectiles) if (pr.alive) pr.render(ctx, cam);
      // player
      if (this.player && this.player.alive) this.player.render(ctx, cam);
      // particles
      RE.Particles.render(ctx, { x: camX, y: camY, viewW: CFG.viewW, viewH: CFG.viewH });

      ctx.restore();
    },

    _renderTiles(ctx, camX, camY) {
      const map = this.map; if (!map) return;
      const T = map.tile;
      const b = this.biome.palette;
      const p = this.player;
      const minTx = Math.max(0, (camX / T | 0) - 1);
      const maxTx = Math.min(map.w - 1, ((camX + CFG.viewW) / T | 0) + 1);
      const minTy = Math.max(0, (camY / T | 0) - 1);
      const maxTy = Math.min(map.h - 1, ((camY + CFG.viewH) / T | 0) + 1);

      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          const bright = RE.Echo.tileBrightness(tx, ty, p);
          if (bright <= 0.02) continue;
          const wall = map.isWallTile(tx, ty);
          const sx = tx * T - camX, sy = ty * T - camY;
          if (wall) {
            // wall block with lit top edge
            ctx.fillStyle = shade(b.wall, bright);
            ctx.fillRect(sx, sy, T + 1, T + 1);
            if (bright > 0.25) {
              ctx.fillStyle = shade(b.wallHi, bright);
              ctx.fillRect(sx, sy, T + 1, 3);
              ctx.fillRect(sx, sy, 3, T + 1);
            }
          } else {
            ctx.fillStyle = shade(b.floor, bright);
            ctx.fillRect(sx, sy, T + 1, T + 1);
            // subtle floor speckle
            if (bright > 0.4 && ((tx * 31 + ty * 17) % 7 === 0)) {
              ctx.fillStyle = RE.M.rgba(b.accent, 0.08 * bright);
              ctx.fillRect(sx + T * 0.4, sy + T * 0.4, 3, 3);
            }
          }
        }
      }

      function shade(hex, bright) {
        return RE.M.mixHex(b.fog, hex, Math.min(1, bright));
      }
    },

    _renderEchoRings(ctx, camX, camY) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const pulse of RE.Echo.pulses) {
        const t = pulse.r / pulse.maxR;
        const alpha = (1 - t) * 0.5;
        if (alpha <= 0.01) continue;
        ctx.strokeStyle = RE.M.rgba(this.biome.palette.accent, alpha);
        ctx.lineWidth = 2.5 * (1 - t) + 0.5;
        ctx.beginPath();
        ctx.arc(pulse.x - camX, pulse.y - camY, pulse.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },

    _renderTitleBg(ctx) {
      // slow drifting echo rings for ambiance
      const W = CFG.viewW, H = CFG.viewH;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const r = ((this.time * 60 + i * 140) % 420);
        const a = (1 - r / 420) * 0.12;
        ctx.strokeStyle = `rgba(60,140,220,${a})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(W / 2, H * 0.26, r + 40, 0, Math.PI * 2); ctx.stroke();
      }
      // floating specks
      for (let i = 0; i < 40; i++) {
        const x = (i * 97 + this.time * 8 * (1 + (i % 3))) % W;
        const y = (i * 53 + Math.sin(this.time * 0.3 + i) * 20 + i * 7) % H;
        ctx.fillStyle = `rgba(120,180,240,${0.05 + (i % 5) * 0.01})`;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.restore();
    },
  };

  RE.Game = Game;
})(window.RE = window.RE || {});
