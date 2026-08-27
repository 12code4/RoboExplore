/* RoboExplore — game core: state machine, world building, simulation glue,
 * echo-lit rendering, rewards, meta-progression, biomes, hazards, and endings.
 */
(function (RE) {
  'use strict';
  const M = RE.M, CFG = RE.CFG;

  // Meta-progression tree ("The Dry Dock"), spend core-shards. Applied to
  // p.stats at run start BEFORE modules equip, so meta + modules compose.
  RE.META_UPGRADES = [
    { id: 'hull1', name: 'Reinforced Hull I', desc: '+15 max hull.', cost: 6, apply: s => s.hullMaxAdd += 15 },
    { id: 'hull2', name: 'Reinforced Hull II', desc: '+20 max hull.', cost: 14, req: 'hull1', apply: s => s.hullMaxAdd += 20 },
    { id: 'cap1', name: 'Capacitor I', desc: '+15 max energy.', cost: 6, apply: s => s.energyMaxAdd += 15 },
    { id: 'cap2', name: 'Capacitor II', desc: '+20 max energy.', cost: 14, req: 'cap1', apply: s => s.energyMaxAdd += 20 },
    { id: 'regen', name: 'Recirculator', desc: '+20% energy regen.', cost: 12, apply: s => s.energyRegenMul *= 1.2 },
    { id: 'servo', name: 'Servo Tune', desc: '+6% move speed.', cost: 12, apply: s => s.speedMul *= 1.06 },
    { id: 'echoeff', name: 'Echo Efficiency', desc: 'Echo costs 2 less energy.', cost: 16, apply: s => s.echoCostAdd -= 2 },
    { id: 'dasheff', name: 'Dash Efficiency', desc: 'Dash costs 3 less energy.', cost: 16, apply: s => s.dashCostAdd -= 3 },
    { id: 'salvage', name: 'Refinery', desc: '+15% salvage & shard yield.', cost: 10 },
    { id: 'magnet', name: 'Field Magnet', desc: 'Start with a +90 salvage magnet.', cost: 8, apply: s => s.magnetRange = Math.max(s.magnetRange, 90) },
    { id: 'draft', name: 'Draft Kit', desc: 'Start each run with a chosen module.', cost: 18 },
    { id: 'revive', name: 'Emergency Reboot', desc: 'Revive once per run at 30 hull.', cost: 30 },
  ];

  const Game = {
    canvas: null, ctx: null,
    state: 'title', prevState: 'title',
    time: 0, fps: 60, _frames: 0, _fpsT: 0,
    hitStopT: 0,
    _mouseMoved: false, _lastMouse: { x: -1, y: -1 },

    seed: 0, rng: null,
    sector: 1, biome: null, biomeMod: {}, salvageMul: 1,
    salvage: 0, runShards: 0, score: 0, kills: 0,
    player: null, map: null, gen: null,
    enemies: [], projectiles: [], pickups: [], hazards: [], boss: null,
    camera: RE.Camera,
    won: false,
    runStats: { sector: 0, kills: 0, score: 0, shards: 0 },
    rewardChoices: null, rewardTitle: '',
    revivesLeft: 0, _descending: false,
    lastPulse: null,
    codexReturn: 'title',

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
      this.biome = null; this.won = false; this._descending = false;
      this.player = RE.makePlayer(0, 0);
      this._applyMeta(this.player);
      this.enemies = []; this.projectiles = []; this.pickups = []; this.hazards = []; this.boss = null;
      RE.HUD.reset();
      RE.Particles.clear();
      this.loadSector(1);
      this.state = 'playing';
    },

    _applyMeta(p) {
      const u = RE.Save.data.unlocks;
      for (const up of RE.META_UPGRADES) {
        if (u[up.id] && up.apply) up.apply(p.stats);
      }
      this.salvageMul = u.salvage ? 1.15 : 1;
      p.recompute();
      p.hull = p.hullMax; p.energy = p.energyMax;
      this.revivesLeft = u.revive ? 1 : 0;
      // Draft handled at title (choose module) — for alpha, grant Kinetic Servos.
      if (u.draft) p.equip('m-servos');
      p.recompute(); p.hull = p.hullMax; p.energy = p.energyMax;
    },

    loadSector(n) {
      this.sector = n;
      this._descending = false;
      const biome = RE.biomeForSector(n);
      const biomeChanged = biome !== this.biome;
      this.biome = biome;
      this.biomeMod = biome.mod || {};
      const isThreshold = (n % CFG.biomeSize === 0);

      const size = Math.min(96, 56 + n * 2);
      const srng = this.rng.fork('sector' + n);
      const gen = RE.Gen.generate({ rng: srng, w: size, h: size, fill: biome.gen.fill, steps: biome.gen.steps, openness: biome.gen.openness });
      this.gen = gen;
      this.map = RE.Tilemap.make(gen, CFG.tile);
      RE.Echo.reset(this.map, CFG);
      // apply echo hold bonus from modules
      RE.Echo.hold = CFG.player.echoTileHold + (this.player.stats.echoHoldAdd || 0);

      const sp = this.map.centerOfTile(gen.spawn.x, gen.spawn.y);
      this.player.x = sp.x; this.player.y = sp.y; this.player.vx = 0; this.player.vy = 0;
      this.player.energy = this.player.energyMax;
      this.player.stats.coreVentUsed = false;
      if (n > 1) this.player.heal(this.player.hullMax * 0.06);

      this.enemies.length = 0; this.projectiles.length = 0; this.pickups.length = 0; this.hazards.length = 0;
      this.boss = null;
      this.lastPulse = null;
      this._empT = 9; this._empWas = false; this.echoDisabled = false;  // first EM surge ~6s after entry
      this.bossBeams = [];
      this._reclaimT = 0; this._reclaimWarned = false;
      RE.Particles.clear();

      const ex = this.map.centerOfTile(gen.exit.x, gen.exit.y);
      this.pickups.push(RE.makePickup('exit', ex.x, ex.y));

      this._populateSector(n, biome, srng, isThreshold);

      RE.Echo.pulse(sp.x, sp.y, { maxR: 260 });
      // First-run onboarding tips (once ever).
      this._sectorT = 0;
      this._introTips = [];
      if (n === 1 && !RE.Save.data.seenIntro) {
        this._introTips = [
          { t: 1.6, text: 'The Hollow is dark. Press [E] to emit an echo pulse and glimpse the world.' },
          { t: 6.5, text: 'Everything you do drains ENERGY — the ring around you. It recharges over time and at nodes.' },
          { t: 12, text: 'Shots fired just after a pulse hit harder. Find the glowing exit shaft to descend.' },
        ];
        RE.Save.data.seenIntro = true; RE.Save.save();
      }
      this.camera.snapTo(sp.x, sp.y);
      RE.HUD.showBanner('SECTOR ' + n, biome.name, 2.4);
      if (biomeChanged) { RE.Audio.startMusic(biome.music); if (biome.vibe) RE.HUD.toast(biome.vibe, { life: 4.2, color: 'rgba(180,210,235,0.8)' }); }
      RE.Audio.sfx('sector');
    },

    _populateSector(n, biome, rng, isThreshold) {
      const map = this.map, gen = this.gen;
      const cell = (idx) => { const c = gen.cellXY(idx); return map.centerOfTile(c.x, c.y); };
      const eliteChance = n < 4 ? 0 : Math.min(0.25, (n - 3) * 0.03);

      // Boss guardian on threshold sectors.
      if (isThreshold) {
        const bid = RE.BIOME_BOSS[biome.id];
        const pos = cell(gen.exitIdx);
        const boss = RE.makeBoss(bid, pos.x, pos.y, n);
        this.enemies.push(boss);
        this.boss = boss;
        RE.HUD.showBanner(boss.name.split(',')[0], 'guardian of the shaft', 3);
      }

      const count = Math.min(22, Math.round(5 + n * 0.85));
      const pool = biome.enemies;
      // per-type filler caps: heavy/mini-boss enemies must stay rare
      const caps = { leviathan_eye: 1, warden_node: 2 };
      const counts = {};
      for (let i = 0; i < count; i++) {
        const idx = gen.pickFeatureCell(10, 3);
        const pos = cell(idx);
        let id = rng.pick(pool), tries = 0;
        while (caps[id] && (counts[id] || 0) >= caps[id] && tries++ < 6) id = rng.pick(pool);
        counts[id] = (counts[id] || 0) + 1;
        const elite = id !== 'leviathan_eye' && rng.next() < eliteChance;
        this.enemies.push(RE.makeEnemy(id, pos.x, pos.y, n, elite));
      }

      // Energy node (finite dock) — guaranteed.
      { const pos = cell(gen.pickFeatureCell(8, 6)); const nd = RE.makePickup('node', pos.x, pos.y, { charge: CFG.node.charge }); nd.maxCharge = CFG.node.charge; this.pickups.push(nd); }
      // small energy orbs
      const energyN = 1 + (rng.next() < 0.5 ? 1 : 0);
      for (let i = 0; i < energyN; i++) { const pos = cell(gen.pickFeatureCell(5, 4)); this.pickups.push(RE.makePickup('energy', pos.x, pos.y, { value: 30 })); }
      // salvage
      const salvageN = 4 + Math.floor(n * 0.5);
      for (let i = 0; i < salvageN; i++) { const pos = cell(gen.pickFeatureCell(4, 2)); this.pickups.push(RE.makePickup('salvage', pos.x, pos.y, { value: rng.int(4, 9) })); }
      // hull repair
      if (rng.next() < 0.65) { const pos = cell(gen.pickFeatureCell(6, 5)); this.pickups.push(RE.makePickup('hull', pos.x, pos.y, { value: 30 })); }
      // module cache
      if (isThreshold || rng.next() < 0.8) { const pos = cell(gen.pickFeatureCell(9, 6)); this.pickups.push(RE.makePickup('module', pos.x, pos.y)); }
      // Reconstructor Station (guaranteed on threshold, ~35% otherwise).
      if (isThreshold || rng.next() < 0.35) {
        const pos = cell(gen.pickFeatureCell(8, 7));
        const st = RE.makePickup('station', pos.x, pos.y);
        st.stock = { modules: this._rollModules(3), repairUses: 0, refillUsed: false };
        this.pickups.push(st);
      }
      // core-shard (deeper = likelier; guaranteed on threshold)
      if (isThreshold || rng.next() < 0.22 + n * 0.02) { const pos = cell(gen.pickFeatureCell(10, 6)); this.pickups.push(RE.makePickup('shard', pos.x, pos.y, { value: 1 })); }
      // log fragment
      const logs = RE.logsForBiome(biome.id).filter(l => !RE.Save.data.logsFound[l.id]);
      if (logs.length && rng.next() < 0.6) { const pos = cell(gen.pickFeatureCell(7, 5)); const log = rng.pick(logs); this.pickups.push(RE.makePickup('log', pos.x, pos.y, { data: log })); }

      // ---- Environmental hazards per biome ----
      if (biome.id === 'marrow') {          // lava rifts (permanent)
        const rifts = 5 + Math.floor(n * 0.2);
        for (let i = 0; i < rifts; i++) { const pos = cell(gen.pickFeatureCell(7, 3)); this.spawnHazard(pos.x, pos.y, rng.int(34, 54), 22, 0, '#ff4a1c', { permanent: true }); }
      } else if (biome.id === 'vaults') {   // arc floors (periodic)
        const arcs = 5 + Math.floor(n * 0.2);
        for (let i = 0; i < arcs; i++) { const pos = cell(gen.pickFeatureCell(6, 3)); this.spawnHazard(pos.x, pos.y, 36, 14, 0, '#6cc0ff', { permanent: true, periodic: { on: 2.0, off: 1.6 }, phase: rng.float(0, 3.6) }); }
      } else if (biome.id === 'hollows') {  // spore clouds (permanent, mild)
        const pods = 3 + Math.floor(n * 0.2);
        for (let i = 0; i < pods; i++) { const pos = cell(gen.pickFeatureCell(7, 5)); this.spawnHazard(pos.x, pos.y, rng.int(50, 78), 4, 0, '#7dffb0', { permanent: true }); }
      }
    },

    nextSector() {
      if (this._descending) return;
      // gate: on a threshold sector, the guardian must fall first
      if (this.boss && this.boss.alive) { RE.HUD.toast('the guardian blocks the shaft', { color: '#ff9aa8', life: 1.6 }); return; }
      this._descending = true;
      if (this.sector >= CFG.sectorsPerRun) { this.win(); return; }
      RE.HUD.showBanner('DESCENDING', '', 1.1);
      this.loadSector(this.sector + 1);
    },

    win() { this.won = true; this._endRun(); },

    onPlayerDeath() {
      if (this.revivesLeft > 0) {
        this.revivesLeft--;
        this.player.alive = true;
        this.player.hull = this.player.hullMax * 0.3;
        this.player.energy = this.player.energyMax;
        this.player.iframes = 2;
        RE.HUD.showBanner('EMERGENCY REBOOT', 'systems restored', 2);
        RE.Audio.sfx('shield');
        RE.Particles.burst(this.player.x, this.player.y, 30, { speed: 260, color: '#7affd1', life: 0.8, size: 3, kind: 'spark' });
        return;
      }
      this._endRun();
    },

    _endRun() {
      if (this.won) {
        RE.Save.data.clears = (RE.Save.data.clears || 0) + 1;
        RE.Save.data.unlocks.ngplus = true;              // unlock post-1.0 content hook
        // Ending B (the twist) if both key logs were ever recovered.
        this.endingB = !!(RE.Save.data.logsFound['a_before'] && RE.Save.data.logsFound['a_none']);
      }
      const bonusShards = Math.floor(this.salvage / 120);
      this.runShards += bonusShards;
      // first-reach milestone shards
      const milestones = { 3: 2, 6: 3, 9: 4, 12: 5, 15: 8 };
      let milestoneBonus = 0;
      for (const k of Object.keys(milestones)) {
        if (this.sector >= +k && !RE.Save.data.milestones[k]) { RE.Save.data.milestones[k] = true; milestoneBonus += milestones[k]; }
      }
      this.runShards += milestoneBonus;
      this.score += this.sector * 100 + this.kills * 10;
      this.runStats = { sector: this.sector, kills: this.kills, score: this.score, shards: this.runShards };
      RE.Save.addShards(this.runShards);
      RE.Save.recordRun({ sector: this.sector, score: this.score, kills: this.kills });
      RE.Audio.stopMusic();
      this.state = 'dead';
    },

    // ---- Pulse / pings / hazards --------------------------------------
    onPulse(x, y, r) {
      this.lastPulse = { x, y, t: this.time };
      // "The Hollow listens": nearby enemies orient/aggro.
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (M.dist(x, y, e.x, e.y) < r && e.def.wakeOnPing !== false) e.awake = true;
      }
    },
    spawnEnemyPing(x, y) { RE.Echo.spawnPing(x, y, '#ff5a6e'); },

    flashEnergy() { if (this.player) this.player.energyFlash = 0.3; },

    screenFlash(color, amt, dur) { this.flashColor = color; this.flashAmt = amt || 0.25; this.flashT = dur || 0.25; this.flashMax = this.flashT; },

    dischargePulse(x, y, dmg, radius, stun) {
      radius = radius || 130;
      RE.Particles.burst(x, y, 22, { speed: 300, color: '#8ff', life: 0.4, size: 3, kind: 'spark' });
      RE.Echo.pulse(x, y, { maxR: radius, speed: 900, strength: 0.9 });
      this.onPulse(x, y, radius);
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = M.dist(x, y, e.x, e.y);
        if (d < radius) {
          const a = Math.atan2(e.y - y, e.x - x);
          e.takeDamage(dmg * (1 - d / radius * 0.5), Math.cos(a) * 200, Math.sin(a) * 200, this);
          // flinch lasts ~0.15s + stun (stateT counts up, exits at >0.15)
          if (stun) { e.state = 'flinch'; e.stateT = -stun; }
        }
      }
    },

    spawnHazard(x, y, r, dmg, life, color, opts) {
      opts = opts || {};
      this.hazards.push({ x, y, r, dmg, life, maxLife: life, color, tickCd: 0, active: true, permanent: !!opts.permanent, periodic: opts.periodic || null, phase: opts.phase || 0 });
    },

    hitStop(t) { this.hitStopT = Math.max(this.hitStopT, Math.min(t, CFG.hitStopMax)); },

    // ---- Spawning ------------------------------------------------------
    spawnProjectile(opts) { this.projectiles.push(RE.makeProjectile(opts)); },
    spawnEnemyProjectile(x, y, vx, vy, dmg, color) {
      const pr = RE.makeProjectile({ x, y, vx, vy, damage: dmg, color, friendly: false, r: 5, life: 3 });
      this.projectiles.push(pr);
      return pr;
    },
    damagePlayer(amt, source) {
      if (!this.player || !this.player.alive) return false;
      return this.player.damage(amt, source, this);
    },

    onEnemyKilled(e) {
      this.kills++;
      this.score += (e.def.danger || 1) * 5 * (e.elite ? 2 : 1);
      const [lo, hi] = e.def.salvage || [1, 3];
      let n = this.rng ? this.rng.int(lo, hi) : lo;
      if (e.elite) n = Math.round(n * 1.5);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, dd = Math.random() * 14;
        this.pickups.push(RE.makePickup('salvage', e.x + Math.cos(a) * dd, e.y + Math.sin(a) * dd, { value: 3 }));
      }
      if (this.boss === e) {
        this.boss = null;
        // Final guardian (AXIS) — beating it wins the run.
        if (this.sector >= CFG.sectorsPerRun) { this.win(); return; }
        RE.HUD.showBanner('GUARDIAN FELLED', 'the shaft opens', 2.2);
        RE.Audio.sfx('sector');
        this.pickups.push(RE.makePickup('module', e.x, e.y));
        this.pickups.push(RE.makePickup('shard', e.x + 30, e.y, { value: 1 }));
      }
    },

    onCollect(pickup) {
      const p = this.player;
      switch (pickup.kind) {
        case 'salvage': { const v = Math.round(pickup.value * (this.salvageMul || 1)); this.salvage += v; this.score += v; break; }
        case 'energy': p.addEnergy(pickup.value); break;
        case 'hull': p.heal(pickup.value); RE.HUD.toast('+' + pickup.value + ' hull', { color: '#5affa0', life: 1.4 }); break;
        case 'shard': { const b = Math.round(pickup.value * (this.salvageMul || 1)); this.runShards += pickup.value; this.score += pickup.value * 20; RE.HUD.toast('✦ core-shard recovered', { color: '#c0a0ff', life: 2.2, big: true }); break; }
        case 'module': this.presentReward(this._rollModules(3), 'MODULE CACHE'); break;
        case 'log': this._collectLog(pickup.data); break;
        default: break;
      }
    },

    _collectLog(log) {
      if (!log) return;
      const isNew = !RE.Save.data.logsFound[log.id];
      RE.Save.foundLog(log.id);
      if (isNew) { this.runShards += 1; this.score += 20; }
      RE.HUD.toast('LOG RECOVERED — ' + log.title, { color: '#9fe6ff', life: 3, big: true });
      RE.HUD.toast('“' + log.text + '”', { color: 'rgba(180,210,235,0.85)', life: 5 });
    },

    _rollModules(count) {
      const all = Object.values(RE.MODULES);
      const rng = this.rng || RE.RNG.make(1);
      const rareBoost = RE.Save.data.unlocks.raredrops ? 1.5 : 1;
      const weights = { common: 5, uncommon: 3, rare: 1.4 * rareBoost, legendary: 0.6 * rareBoost };
      const chosen = [], bag = all.slice();
      for (let i = 0; i < count && bag.length; i++) {
        let total = 0; for (const m of bag) total += weights[m.rarity] || 1;
        let r = rng.next() * total, idx = bag.length - 1;
        for (let j = 0; j < bag.length; j++) { r -= weights[bag[j].rarity] || 1; if (r <= 0) { idx = j; break; } }
        chosen.push(bag[idx]); bag.splice(idx, 1);
      }
      return chosen;
    },

    // ---- Reconstructor stations ---------------------------------------
    _stationProximity() {
      this._nearStation = null;
      const p = this.player;
      for (const pk of this.pickups) {
        if (pk.kind !== 'station' || !pk.alive) continue;
        if (M.dist(pk.x, pk.y, p.x, p.y) < pk.r + p.radius + 18) {
          this._nearStation = pk;
          if (RE.Input.pressed('interact')) this.openStation(pk);
          break;
        }
      }
    },
    openStation(st) { this.station = st; this.state = 'station'; RE.Menus.focus = 0; RE.Audio.sfx('equip'); },
    closeStation() { this.station = null; this.state = 'playing'; },
    stationRepair() {
      const st = this.station; const cost = 20 + st.stock.repairUses * 10;
      if (this.salvage < cost) { RE.Audio.sfx('lowpower'); return; }
      this.salvage -= cost; st.stock.repairUses++;
      this.player.heal(30); RE.Audio.sfx('pickup'); RE.HUD.toast('+30 hull', { color: '#5affa0', life: 1.4 });
    },
    stationRefill() {
      const st = this.station;
      if (st.stock.refillUsed) return;
      st.stock.refillUsed = true;
      this.player.energy = this.player.energyMax; RE.Audio.sfx('energy');
    },
    stationReroll() {
      if (this.salvage < 12) { RE.Audio.sfx('lowpower'); return; }
      this.salvage -= 12; this.station.stock.modules = this._rollModules(3); RE.Audio.sfx('ui');
    },
    stationBuy(def, idx) {
      const cost = { common: 40, uncommon: 75, rare: 130, legendary: 200 }[def.rarity] || 60;
      if (this.salvage < cost) { RE.Audio.sfx('lowpower'); return; }
      this.salvage -= cost;
      const prev = this.player.modules[def.slot];
      this.player.equip(def.id);
      this.station.stock.modules[idx] = null;
      RE.Audio.sfx('equip'); RE.HUD.toast('INSTALLED: ' + def.name, { color: '#ff8adf', life: 2.2, big: true });
      if (prev && prev !== def.id) RE.HUD.toast('replaced ' + RE.MODULES[prev].name, { color: 'rgba(200,200,200,0.7)', life: 1.8 });
    },
    stationCost(def) { return { common: 40, uncommon: 75, rare: 130, legendary: 200 }[def.rarity] || 60; },

    presentReward(choices, title) { this.rewardChoices = choices; this.rewardTitle = title || 'SALVAGE RECOVERED'; this.state = 'reward'; RE.Menus.focus = 0; },
    chooseReward(def) {
      const prev = this.player.modules[def.slot];
      this.player.equip(def.id);
      RE.HUD.toast('EQUIPPED: ' + def.name, { color: '#ff8adf', life: 2.4, big: true });
      if (prev && prev !== def.id) RE.HUD.toast('replaced ' + RE.MODULES[prev].name, { color: 'rgba(200,200,200,0.7)', life: 2 });
      this.rewardChoices = null; this.state = 'playing';
    },
    skipReward() { this.salvage += 15; this.score += 15; RE.HUD.toast('+15 salvage', { color: '#ffe27a', life: 1.6 }); this.rewardChoices = null; this.state = 'playing'; },

    // ---- Meta / codex --------------------------------------------------
    openMeta() { this.prevState = this.state; this.state = 'meta'; RE.Menus.focus = 0; },
    closeMeta() { this.state = (this.prevState === 'meta' ? 'title' : this.prevState) || 'title'; RE.Menus.focus = 0; },
    buyMeta(u, cost) {
      if (!RE.Save.spendShards(cost)) return;
      RE.Save.data.unlocks[u.id] = true; RE.Save.save(); RE.Audio.sfx('pickup_big');
    },
    openCodex(ret) { this.codexReturn = ret || this.state; this.prevState = this.state; this.state = 'codex'; RE.Menus.focus = 0; },
    closeCodex() { this.state = this.codexReturn || 'title'; RE.Menus.focus = 0; },

    togglePause() {
      if (this.state === 'playing') { this.state = 'paused'; RE.Menus.focus = 0; }
      else if (this.state === 'paused') this.state = 'playing';
    },
    abandonRun() { this._endRun(); this.state = 'title'; RE.Audio.stopMusic(); },
    gotoTitle() { this.state = 'title'; RE.Menus.focus = 0; RE.Audio.stopMusic(); },
    get mousePressed() { return RE.Input.mousePressed(); },

    // ---- Update --------------------------------------------------------
    update(dt) {
      this.time += dt;
      this._frames++; this._fpsT += dt;
      if (this._fpsT >= 0.5) { this.fps = this._frames / this._fpsT; this._frames = 0; this._fpsT = 0; }

      RE.Input.setViewMouse(RE.Input.mouse.sx * CFG.viewW, RE.Input.mouse.sy * CFG.viewH);
      this._mouseMoved = (RE.Input.mouse.x !== this._lastMouse.x || RE.Input.mouse.y !== this._lastMouse.y);
      this._lastMouse.x = RE.Input.mouse.x; this._lastMouse.y = RE.Input.mouse.y;

      if (this.state === 'playing' || this.state === 'paused') { if (RE.Input.pressed('pause')) this.togglePause(); }
      else if (this.state === 'meta') { if (RE.Input.keyPressed('Escape')) this.closeMeta(); }
      else if (this.state === 'codex') { if (RE.Input.keyPressed('Escape')) this.closeCodex(); }
      else if (this.state === 'station') { if (RE.Input.keyPressed('Escape')) this.closeStation(); }

      if (this.state === 'playing') this._updatePlaying(dt);
      if (this.flashT > 0) this.flashT -= dt;
      RE.HUD.update(dt);
    },

    _updatePlaying(dt) {
      if (this.hitStopT > 0) { this.hitStopT -= dt; if (this.hitStopT > 0) { RE.Particles.update(dt * 0.15); return; } }
      const p = this.player;

      // Biome EM surges (Static Vaults): periodic echo blackout.
      this.echoDisabled = false;
      if (this.biomeMod.emp) {
        const period = 15;
        this._empT = (this._empT || 0) + dt;
        const phase = this._empT % period;
        this.echoDisabled = phase < 2.5;
        if (this.echoDisabled && !this._empWas) { RE.Audio.sfx('boss'); RE.HUD.showBanner('EM SURGE', 'echo jammed', 1.4); this.camera.addTrauma(0.3); }
        this._empWas = this.echoDisabled;
      }

      // release onboarding tips on a timer
      this._sectorT = (this._sectorT || 0) + dt;
      if (this._introTips && this._introTips.length && this._sectorT >= this._introTips[0].t) {
        RE.HUD.toast(this._introTips.shift().text, { life: 5.5, color: 'rgba(180,225,255,0.92)' });
      }

      RE.Echo.update(dt, p);
      p.update(dt, this);

      for (const e of this.enemies) if (e.alive) e.update(dt, this);
      for (const pr of this.projectiles) if (pr.alive) pr.update(dt, this);
      this._projectileCollisions();
      for (const pk of this.pickups) if (pk.alive) pk.update(dt, this);
      this._nodeDocking(dt);
      this._stationProximity();
      this._pickupPings();
      this._updateHazards(dt);
      this._updateBossBeams(dt);
      this._checkExit();

      RE.Particles.update(dt);
      // Keep the player centered (no hard bounds clamp) — the dark void beyond
      // the map border is invisible, and centering reads far better. Lead the
      // view by velocity + aim so pulses reveal where you're going/looking.
      const cursor = this.camera.toWorld(RE.Input.mouse.x, RE.Input.mouse.y);
      this.camera.follow(p.x, p.y, p.vx, p.vy, CFG.camera, dt, null, cursor);
      this.camera.update(dt);

      this.enemies = this.enemies.filter(e => e.alive);
      this.projectiles = this.projectiles.filter(pr => pr.alive);
      this.pickups = this.pickups.filter(pk => pk.alive);

      // Reclaimer overstay hunter (anti-camp): darkness is the pressure, but
      // past 150s in a sector the Hollow sends escalating self-lit hunters.
      if (this._sectorT > 150 && !this._descending && !(this.boss && this.boss.alive)) {
        if (!this._reclaimWarned) { this._reclaimWarned = true; RE.HUD.showBanner('THE HOLLOW STIRS', 'something is coming', 2.6); RE.Audio.sfx('boss'); }
        this._reclaimT = (this._reclaimT || 0) - dt;
        if (this._reclaimT <= 0) {
          this._reclaimT = Math.max(9, 20 - (this._sectorT - 150) * 0.05);
          const count = this.enemies.reduce((n, e) => n + (e.id === 'reclaimer' && e.alive ? 1 : 0), 0);
          if (count < 6) {
            const c = this.gen.cellXY(this.gen.pickFeatureCell(14, 3));
            const pos = this.map.centerOfTile(c.x, c.y);
            const r = RE.makeEnemy('reclaimer', pos.x, pos.y, this.sector + 2, false);
            r.awake = true; this.enemies.push(r);
          }
        }
      }

      let threat = 0;
      for (const e of this.enemies) if (e.awake && M.dist(e.x, e.y, p.x, p.y) < 360) threat++;
      RE.Audio.setMusicIntensity(this.boss && this.boss.alive ? 1 : M.clamp(threat / 5, 0, 1));
    },

    _nodeDocking(dt) {
      const p = this.player;
      for (const nd of this.pickups) {
        if (nd.kind !== 'node') { continue; }
        const d = M.dist(nd.x, nd.y, p.x, p.y);
        nd.docked = d < CFG.node.radius && nd.charge > 0;
        if (nd.docked) {
          const bonus = (p.stats.magnetBonus && !nd._touched) ? p.stats.magnetBonus : 0;
          nd._touched = true;
          const eNeed = p.energyMax - p.energy;
          const hNeed = p.hullMax - p.hull;
          let drain = 0;
          if (eNeed > 0) { const add = Math.min(CFG.node.fill * dt + bonus, eNeed, nd.charge); p.addEnergy(add); drain += add; }
          if (hNeed > 0 && nd.charge - drain > 0) { const add = Math.min(CFG.node.repair * dt, hNeed, nd.charge - drain); p.heal(add); drain += add; }
          nd.charge -= drain;
          if (Math.random() < 0.4) RE.Particles.emit({ x: nd.x + (Math.random() - 0.5) * 20, y: nd.y + (Math.random() - 0.5) * 20, vx: (p.x - nd.x) * 1.5, vy: (p.y - nd.y) * 1.5, life: 0.3, size: 2.5, color: '#b6ecff', drag: 3, kind: 'dot' });
        }
      }
    },

    _pickupPings() {
      for (const pk of this.pickups) {
        if (!pk.alive) continue;
        const sweep = RE.Echo.pulseSweeping(pk.x, pk.y, pk.r);
        if (sweep && pk._pingedBy !== sweep.id) {
          pk._pingedBy = sweep.id;
          let col = '#ffe27a';
          if (pk.kind === 'energy' || pk.kind === 'node') col = '#4ad6ff';
          else if (pk.kind === 'exit') col = '#7affd1';
          else if (pk.kind === 'module' || pk.kind === 'shard' || pk.kind === 'log') col = '#c0a0ff';
          RE.Echo.spawnPing(pk.x, pk.y, col);
        }
      }
    },

    _updateBossBeams(dt) {
      if (!this.bossBeams || !this.bossBeams.length) return;
      const p = this.player;
      for (let i = this.bossBeams.length - 1; i >= 0; i--) {
        const bm = this.bossBeams[i];
        bm.t += dt; bm.tick -= dt;
        bm.angle += bm.rot * dt;
        if (bm.boss && bm.boss.alive) { bm.x = bm.boss.x; bm.y = bm.boss.y; }
        RE.Echo.washSoft(bm.x, bm.y, bm.len * 0.5, 0.28);
        if (bm.t >= bm.life) { this.bossBeams.splice(i, 1); continue; }
        if (p.alive && p.iframes <= 0) {
          const d = M.dist(bm.x, bm.y, p.x, p.y);
          if (d < bm.len) {
            const toP = Math.atan2(p.y - bm.y, p.x - bm.x);
            if (Math.abs(M.angleDiff(bm.angle, toP)) < bm.arc * 0.5 && bm.tick <= 0) { bm.tick = 0.3; this.damagePlayer(bm.dmg, { x: bm.x, y: bm.y }); }
          }
        }
      }
    },
    _renderBossBeams(ctx, camX, camY) {
      if (!this.bossBeams) return;
      for (const bm of this.bossBeams) {
        ctx.save();
        ctx.translate(bm.x - camX, bm.y - camY);
        ctx.rotate(bm.angle);
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createLinearGradient(0, 0, bm.len, 0);
        grad.addColorStop(0, RE.M.rgba(bm.color, 0.55));
        grad.addColorStop(1, RE.M.rgba(bm.color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, bm.len, -bm.arc / 2, bm.arc / 2); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    },

    _updateHazards(dt) {
      const p = this.player;
      for (let i = this.hazards.length - 1; i >= 0; i--) {
        const h = this.hazards[i];
        h.tickCd -= dt;
        if (!h.permanent) { h.life -= dt; if (h.life <= 0) { this.hazards.splice(i, 1); continue; } }
        if (h.periodic) {
          const cyc = h.periodic.on + h.periodic.off;
          h.active = ((this.time + h.phase) % cyc) < h.periodic.on;
        }
        if (h.active && p.alive && M.dist(h.x, h.y, p.x, p.y) < h.r + p.radius && h.tickCd <= 0) {
          h.tickCd = 0.5;
          this.damagePlayer(h.dmg, { x: h.x, y: h.y });
        }
      }
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
              const kb = pr.knockback || 120;
              e.takeDamage(pr.damage, Math.cos(a) * kb, Math.sin(a) * kb, this);
              pr._impact(this, false);
              // hit-stop only on a KILL (weightier for tough foes) — a stop on
              // every bullet would micro-stutter the whole game while firing.
              if (!e.alive) { const heavy = (e.def.danger || 0) >= 5 || e.isBoss; this.hitStop(heavy ? 0.07 : CFG.hitStopKill); }
              if (pr.splash > 0) {
                for (const o of this.enemies) { if (o !== e && o.alive && M.dist(pr.x, pr.y, o.x, o.y) < pr.splash) o.takeDamage(pr.splashDmg, 0, 0, this); }
                RE.Particles.burst(pr.x, pr.y, 10, { speed: 200, color: pr.color, life: 0.4, size: 3, kind: 'spark' });
              }
              if (pr.pierce > 0) { pr.pierce--; if (!pr.hitSet) pr.hitSet = new Set(); pr.hitSet.add(e); }
              else { pr.alive = false; break; }
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
        if (pk.kind === 'exit' && pk.alive && M.dist(pk.x, pk.y, this.player.x, this.player.y) < pk.r + this.player.radius) {
          this.nextSector();
        }
      }
    },

    // ---- Render --------------------------------------------------------
    render() {
      const ctx = this.ctx, W = CFG.viewW, H = CFG.viewH;
      ctx.fillStyle = (this.biome && this.biome.palette.fog) || CFG.light.fogColor;
      ctx.fillRect(0, 0, W, H);

      if (this.state === 'title') { this._renderTitleBg(ctx); RE.Menus.title(ctx, this); this._cursor(ctx); return; }
      if (this.state === 'meta') { this._renderTitleBg(ctx); RE.Menus.meta(ctx, this); this._cursor(ctx); return; }
      if (this.state === 'codex') { this._renderTitleBg(ctx); RE.Menus.codex(ctx, this); this._cursor(ctx); return; }

      this._renderWorld(ctx);
      // subtle atmospheric vignette (frames the dark, focuses the lit center)
      if (!this._vignette) {
        this._vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
        this._vignette.addColorStop(0, 'rgba(0,0,0,0)');
        this._vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
      }
      ctx.fillStyle = this._vignette; ctx.fillRect(0, 0, W, H);
      RE.HUD.render(ctx, this);
      // full-screen hurt/impact flash
      if (this.flashT > 0 && this.flashMax > 0) {
        ctx.fillStyle = M.rgba(this.flashColor || '#ff3a4a', this.flashAmt * (this.flashT / this.flashMax));
        ctx.fillRect(0, 0, W, H);
      }

      if (this.state === 'paused') RE.Menus.pause(ctx, this);
      else if (this.state === 'reward') RE.Menus.reward(ctx, this);
      else if (this.state === 'station') RE.Menus.station(ctx, this);
      else if (this.state === 'dead') RE.Menus.gameover(ctx, this);
      this._cursor(ctx);
    },

    _cursor(ctx) {
      const mx = RE.Input.mouse.x, my = RE.Input.mouse.y;
      ctx.save();
      ctx.strokeStyle = 'rgba(150,220,255,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - 11, my); ctx.lineTo(mx - 4, my); ctx.moveTo(mx + 4, my); ctx.lineTo(mx + 11, my);
      ctx.moveTo(mx, my - 11); ctx.lineTo(mx, my - 4); ctx.moveTo(mx, my + 4); ctx.lineTo(mx, my + 11);
      ctx.stroke(); ctx.restore();
    },

    _renderWorld(ctx) {
      const cam = this.camera;
      const shake = cam.shakeOffset(CFG.camera.maxShake * (RE.Save.data.settings.screenShake || 1));
      ctx.save();
      ctx.translate(shake.x, shake.y);
      const camX = cam.x, camY = cam.y;
      this._renderTiles(ctx, camX, camY);
      this._renderHazards(ctx, camX, camY);
      this._renderBossBeams(ctx, camX, camY);
      this._renderEchoRings(ctx, camX, camY);
      for (const pk of this.pickups) if (pk.alive) pk.render(ctx, cam, RE.Echo, this.player);
      for (const e of this.enemies) if (e.alive) e.render(ctx, cam, RE.Echo, this.player);
      for (const pr of this.projectiles) if (pr.alive) pr.render(ctx, cam);
      if (this.player && this.player.alive) this.player.render(ctx, cam);
      RE.Particles.render(ctx, { x: camX, y: camY, viewW: CFG.viewW, viewH: CFG.viewH });
      this._renderPings(ctx, camX, camY);
      ctx.restore();
    },

    _renderTiles(ctx, camX, camY) {
      const map = this.map; if (!map) return;
      const T = map.tile, b = this.biome.palette, p = this.player;
      const floorMem = this.biomeMod.memoryFloor || CFG.player.ghostFloor;
      const minTx = Math.max(0, (camX / T | 0) - 1), maxTx = Math.min(map.w - 1, ((camX + CFG.viewW) / T | 0) + 1);
      const minTy = Math.max(0, (camY / T | 0) - 1), maxTy = Math.min(map.h - 1, ((camY + CFG.viewH) / T | 0) + 1);
      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          let bright = RE.Echo.tileBrightness(tx, ty, p);
          if (RE.Echo.seen[ty * map.w + tx] && floorMem > bright) bright = floorMem;
          if (bright <= 0.02) continue;
          const wall = map.isWallTile(tx, ty);
          const sx = tx * T - camX, sy = ty * T - camY;
          if (wall) {
            ctx.fillStyle = M.mixHex(b.fog, b.wall, Math.min(1, bright));
            ctx.fillRect(sx, sy, T + 1, T + 1);
            if (bright > 0.25) { ctx.fillStyle = M.mixHex(b.fog, b.wallHi, Math.min(1, bright)); ctx.fillRect(sx, sy, T + 1, 3); ctx.fillRect(sx, sy, 3, T + 1); }
          } else {
            ctx.fillStyle = M.mixHex(b.fog, b.floor, Math.min(1, bright));
            ctx.fillRect(sx, sy, T + 1, T + 1);
            if (bright > 0.4 && ((tx * 31 + ty * 17) % 7 === 0)) { ctx.fillStyle = RE.M.rgba(b.accent, 0.08 * bright); ctx.fillRect(sx + T * 0.4, sy + T * 0.4, 3, 3); }
          }
        }
      }
    },

    _renderHazards(ctx, camX, camY) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const h of this.hazards) {
        let a = h.permanent ? 0.5 : M.clamp(h.life / h.maxLife, 0, 1) * 0.4;
        if (h.periodic && !h.active) a *= 0.18;  // dim + warn when off
        const sx = h.x - camX, sy = h.y - camY;
        const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, h.r);
        gr.addColorStop(0, RE.M.rgba(h.color, a)); gr.addColorStop(1, RE.M.rgba(h.color, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx, sy, h.r, 0, Math.PI * 2); ctx.fill();
        // active-edge ring for periodic hazards
        if (h.periodic) {
          ctx.strokeStyle = RE.M.rgba(h.color, (h.active ? 0.6 : 0.25));
          ctx.lineWidth = h.active ? 2 : 1;
          ctx.beginPath(); ctx.arc(sx, sy, h.r * 0.7, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.restore();
    },

    _renderEchoRings(ctx, camX, camY) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const accent = this.biome.palette.accent;
      for (const pulse of RE.Echo.pulses) {
        const t = pulse.r / pulse.maxR;
        if (t >= 1 || pulse.r < 1) continue;
        const a = 1 - t;
        const sx = pulse.x - camX, sy = pulse.y - camY;
        // soft wide band — the glowing annulus (design §3.2)
        ctx.strokeStyle = RE.M.rgba(accent, 0.16 * a);
        ctx.lineWidth = 16 * a + 4;
        ctx.beginPath(); ctx.arc(sx, sy, pulse.r, 0, Math.PI * 2); ctx.stroke();
        // bright leading edge
        ctx.strokeStyle = RE.M.rgba('#eaffff', 0.5 * a);
        ctx.lineWidth = 2 * a + 0.6;
        ctx.beginPath(); ctx.arc(sx, sy, pulse.r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    },

    _renderPings(ctx, camX, camY) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const ping of RE.Echo.pings) {
        const a = M.clamp(1 - ping.t / ping.life, 0, 1);
        ctx.fillStyle = RE.M.rgba(ping.color, a * 0.9);
        ctx.beginPath(); ctx.arc(ping.x - camX, ping.y - camY, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = RE.M.rgba(ping.color, a * 0.4); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ping.x - camX, ping.y - camY, 6, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    },

    _renderTitleBg(ctx) {
      const W = CFG.viewW, H = CFG.viewH;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const r = ((this.time * 60 + i * 140) % 420); const a = (1 - r / 420) * 0.12;
        ctx.strokeStyle = `rgba(60,140,220,${a})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(W / 2, H * 0.26, r + 40, 0, Math.PI * 2); ctx.stroke();
      }
      for (let i = 0; i < 40; i++) {
        const x = (i * 97 + this.time * 8 * (1 + (i % 3))) % W;
        const y = (i * 53 + Math.sin(this.time * 0.3 + i) * 20 + i * 7) % H;
        ctx.fillStyle = `rgba(120,180,240,${0.05 + (i % 5) * 0.01})`; ctx.fillRect(x, y, 2, 2);
      }
      ctx.restore();
    },
  };

  RE.Game = Game;
})(window.RE = window.RE || {});
