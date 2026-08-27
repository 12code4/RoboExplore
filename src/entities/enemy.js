/* RoboExplore — enemies with echo-aware AI.
 * Shared toolkit: reveal (`vis`) that decays over enemyVisFade unless re-lit;
 * echo-resonance marking (+40% dmg for MARK_TIME when a pulse washes them);
 * flinch; "the Hollow listens" aggro toward pulse origins. Each `ai` is a small
 * state machine faithful to the design bestiary.
 */
(function (RE) {
  'use strict';
  const M = RE.M, CFG = RE.CFG, Particles = RE.Particles;

  function makeEnemy(defId, x, y, sector, elite) {
    const def = RE.ENEMIES[defId];
    const hpMul = (1 + (sector - 1) * 0.06) * (elite ? 2 : 1);
    const dmgMul = (1 + (sector - 1) * 0.05) * (elite ? 1.3 : 1);
    const spdMul = 1 + (sector - 1) * 0.02;

    const e = {
      type: 'enemy', def, id: defId, alive: true, elite: !!elite,
      x, y, vx: 0, vy: 0,
      r: def.radius,
      hp: Math.round(def.hp * hpMul), maxHp: Math.round(def.hp * hpMul),
      speed: def.speed * spdMul, dmgMul, sector,
      facing: Math.random() * Math.PI * 2,
      awake: false, vis: 0, marked: 0, lensMarked: false,
      hitFlash: 0, touchCd: 0,
      state: 'idle', stateT: 0,
      fireCd: (def.fireCd || 1) * (0.4 + Math.random() * 0.6),
      orbitDir: Math.random() < 0.5 ? 1 : -1,
      wobble: Math.random() * Math.PI * 2,
      _pingedBy: -1, _curContact: 0,
      // per-ai scratch
      podAngle: Math.random() * Math.PI * 2, aimT: 0, charges: 0, beamAngle: Math.random() * Math.PI * 2,
      _homeX: x, _homeY: y, driftA: Math.random() * Math.PI * 2,

      // ---- damage / death ----
      effectiveArmor() {
        // Gloom Crawler is armored while frozen (lit).
        if (this.def.ai === 'freezer' && this.state === 'frozen') return this.def.litArmor || 0.5;
        // Hollow Stalker takes +50% in recover.
        if (this.def.ai === 'stalker' && this.state === 'recover') return 1.5;
        return 1;
      },
      takeDamage(dmg, kx, ky, game) {
        if (!this.alive) return;
        // Abyssal Eye only takes damage while open.
        if (this.def.ai === 'eye' && this.state !== 'open') { this._deflect(); return; }
        // Warden armored shell handled by hp (simplified).
        let d = dmg * this.effectiveArmor();
        if (this.marked > 0) d *= CFG.player.markDamageMul;
        this.hp -= d;
        this.hitFlash = 0.12;
        this.awake = true;
        this.vis = Math.max(this.vis, 0.6);
        this.vx += (kx || 0); this.vy += (ky || 0);
        Particles.burst(this.x, this.y, 4, { speed: 90, color: def.glow, life: 0.25, size: 2.5, kind: 'spark' });
        if (this.hp <= 0) this.die(game);
      },
      _deflect() {
        Particles.burst(this.x, this.y, 3, { speed: 60, color: '#fff', life: 0.2, size: 2, kind: 'spark' });
      },
      die(game) {
        if (!this.alive) return;
        this.alive = false;
        RE.Audio.sfx('enemy_die');
        Particles.burst(this.x, this.y, 16, { speed: 200, color: def.glow, life: 0.6, size: 3.4, kind: 'spark' });
        Particles.burst(this.x, this.y, 8, { speed: 90, color: def.color, life: 0.5, size: 3, kind: 'dot' });
        Particles.ring(this.x, this.y, { color: def.glow, size: this.r, life: 0.4 });
        game.camera.addTrauma(0.12);
        if (this.def.ai === 'mine') this._detonate(game);
        game.onEnemyKilled(this);
      },

      // ---- reveal / mark ----
      onSwept(pulse, game) {
        if (this._pingedBy === pulse.id) return;
        this._pingedBy = pulse.id;
        this.vis = 1;
        const p = game.player;
        // base echo-resonance mark
        this.marked = Math.max(this.marked, CFG.player.markTime);
        if (p.stats.markFromEcho) { this.marked = Math.max(this.marked, p.stats.markDur); this.lensMarked = true; }
        // Warden Node is charged (awoken) by pulses washing it.
        if (this.def.ai === 'turret') this.charges++;
        // fragile flinch
        if (this.maxHp <= 24 && this.state !== 'lunge' && this.state !== 'pounce') { this.state = 'flinch'; this.stateT = 0; }
        // resonant cannon echo damage
        if (p.stats.echoDamage > 0) this.takeDamage(p.stats.echoDamage, 0, 0, game);
        if (this.def.wakeOnPing !== false) this.awake = true;
        // directional ping intel
        game.spawnEnemyPing(this.x, this.y);
      },

      update(dt, game) {
        const p = game.player;
        this.stateT += dt; this.wobble += dt * 3;
        if (this.hitFlash > 0) this.hitFlash -= dt;
        if (this.touchCd > 0) this.touchCd -= dt;
        if (this.marked > 0) { this.marked -= dt; if (this.marked <= 0) this.lensMarked = false; }
        this._curContact = 0;

        // reveal by pulse sweep
        const sweep = RE.Echo.pulseSweeping(this.x, this.y, this.r);
        if (sweep) this.onSwept(sweep, game);
        // reveal by ambient light
        const light = RE.Echo.lightAt(this.x, this.y, p);
        if (light > 0.45) { this.vis = Math.max(this.vis, Math.min(1, light)); }
        // vis decay
        if (this.def.selfLit) this.vis = 1;
        else if (this.vis > 0) { this.vis -= dt / CFG.player.enemyVisFade; if (this.vis < 0) this.vis = 0; }

        if (this.state === 'flinch') { this._friction(dt); if (this.stateT > 0.15) { this.state = 'idle'; } this._integrate(dt, game); return; }

        if (!p || !p.alive) { this._friction(dt); this._integrate(dt, game); return; }
        const d = M.dist(this.x, this.y, p.x, p.y);

        switch (def.ai) {
          case 'moth': this._aiMoth(dt, game, p, d, light); break;
          case 'buried': this._aiBuried(dt, game, p, d); break;
          case 'freezer': this._aiFreezer(dt, game, p, d, light); break;
          case 'orbiter': this._aiOrbiter(dt, game, p, d); break;
          case 'spitter': this._aiSpitter(dt, game, p, d); break;
          case 'turret': this._aiTurret(dt, game, p, d); break;
          case 'wraith': this._aiWraith(dt, game, p, d); break;
          case 'mine': this._aiMine(dt, game, p, d); break;
          case 'stalker': this._aiStalker(dt, game, p, d); break;
          case 'eye': this._aiEye(dt, game, p, d); break;
          default: this._aiChaser(dt, game, p, d); break;
        }

        if (def.speed > 0) this._separate(dt, game);
        this._integrate(dt, game);

        // contact damage
        if (this._curContact > 0 && d < this.r + p.radius && this.touchCd <= 0) {
          if (game.damagePlayer(this._curContact * this.dmgMul, this)) {
            this.touchCd = CFG.player.contactDamageCd;
          }
        }
      },

      // ===== AI behaviors =====
      _aiChaser(dt, game, p, d) {
        if (!this.awake && d > 260) { this._friction(dt); return; }
        this.awake = true;
        this._steerTo(p.x, p.y, dt);
        this._curContact = def.touchDamage;
      },

      // Lumen Moth — drifts near-invisible; lured by pulses/light toward source.
      _aiMoth(dt, game, p, d, light) {
        const heard = game.lastPulse && (game.time - game.lastPulse.t) < 0.2 && M.dist(this.x, this.y, game.lastPulse.x, game.lastPulse.y) < def.lureRange;
        if (this.state === 'lured') {
          this._steerTo(p.x, p.y, dt, def.lureSpeed / this.speed);
          this._curContact = def.touchDamage;
          if (this.stateT > def.lureTime) { this.state = 'drift'; this.stateT = 0; }
        } else {
          // drift
          this.driftA += (Math.random() - 0.5) * dt * 3;
          this.vx = M.damp(this.vx, Math.cos(this.driftA) * this.speed * 0.4, 4, dt);
          this.vy = M.damp(this.vy, Math.sin(this.driftA) * this.speed * 0.4, 4, dt);
          if (heard || this.marked > 0 || d < 90) { this.state = 'lured'; this.stateT = 0; RE.Audio.sfx('blip', 900); }
        }
      },

      // Silt Lurker — buried until pulsed; lunges when the player nears.
      _aiBuried(dt, game, p, d) {
        if (this.state === 'idle' || this.state === 'buried') {
          this.state = 'buried'; this._friction(dt);
          if (d < def.triggerRange) { this.state = 'windup'; this.stateT = 0; this.facing = Math.atan2(p.y - this.y, p.x - this.x); }
        } else if (this.state === 'windup') {
          this._friction(dt);
          if (this.stateT > def.windup) {
            this.state = 'lunge'; this.stateT = 0;
            this.vx = Math.cos(this.facing) * def.lungeSpeed;
            this.vy = Math.sin(this.facing) * def.lungeSpeed;
            RE.Audio.sfx('dash'); this.vis = 1;
          }
        } else if (this.state === 'lunge') {
          this._curContact = def.touchDamage;
          if (this.stateT > def.lungeTime) { this.state = 'exposed'; this.stateT = 0; }
        } else if (this.state === 'exposed') {
          this._steerTo(p.x, p.y, dt, 0.6);
          this.vis = Math.max(this.vis, 0.5);
          if (this.stateT > def.exposed) { this.state = 'buried'; this.stateT = 0; }
        }
      },

      // Gloom Crawler — weeping angel: hunts in dark, freezes when lit.
      _aiFreezer(dt, game, p, d, light) {
        const lit = light > 0.15 || RE.Echo.pulseSweeping(this.x, this.y, this.r);
        if (lit) {
          if (this.state !== 'frozen') { this.state = 'frozen'; this.stateT = 0; }
          this._friction(dt); this.vis = Math.max(this.vis, 0.9);
          this._litTimer = 0.3;
        } else {
          if (this._litTimer > 0) { this._litTimer -= dt; this._friction(dt); return; }
          if (this.state === 'frozen') { this.state = 'hunt'; this.stateT = 0; RE.Audio.sfx('blip', 120); }
          this.state = 'hunt'; this.awake = true;
          this._steerTo(p.x, p.y, dt);
          this._curContact = def.touchDamage;
        }
      },

      // Sparkfly — self-lit pod orbiting the player, peeling off to dive.
      _aiOrbiter(dt, game, p, d) {
        this.awake = true;
        if (this.state === 'dive') {
          this._steerTo(p.x, p.y, dt, def.diveSpeed / this.speed);
          this._curContact = def.touchDamage;
          if (this.stateT > 0.6 || d < this.r + p.radius) { this.state = 'orbit'; this.stateT = 0; }
        } else {
          this.podAngle += this.orbitDir * dt * 1.3;
          const tx = p.x + Math.cos(this.podAngle) * def.orbitDist;
          const ty = p.y + Math.sin(this.podAngle) * def.orbitDist;
          this._steerTo(tx, ty, dt, 0.9);
          this.fireCd -= dt;
          if (this.fireCd <= 0) { this.fireCd = def.chargeEvery * (0.7 + Math.random() * 0.6); if (Math.random() < 0.5) { this.state = 'dive'; this.stateT = 0; RE.Audio.sfx('blip', 1200); } }
        }
      },

      // Rift Spitter — ranged; lights the room when it aims and fires puddles.
      _aiSpitter(dt, game, p, d) {
        if (!this.awake && d > def.range) { this._friction(dt); return; }
        this.awake = true;
        const hasLOS = game.map.hasLOS(this.x, this.y, p.x, p.y);
        if (this.state === 'aim') {
          this._friction(dt); this.facing = Math.atan2(p.y - this.y, p.x - this.x);
          this.vis = Math.max(this.vis, 0.4 + 0.4 * (this.stateT / def.aimTime));
          RE.Echo.washSoft(this.x, this.y, 70, 0.35);
          if (this.stateT > def.aimTime) { this._fireGlob(game, p); this.state = 'roam'; this.stateT = 0; this.fireCd = def.fireCd; }
        } else {
          // roam / keep distance
          if (d < def.range * 0.5) { const a = Math.atan2(this.y - p.y, this.x - p.x); this._steerTo(this.x + Math.cos(a) * 60, this.y + Math.sin(a) * 60, dt, 0.7); }
          else this._steerTo(p.x, p.y, dt, 0.4);
          this.fireCd -= dt;
          if (this.fireCd <= 0 && d < def.range && hasLOS) { this.state = 'aim'; this.stateT = 0; }
        }
      },
      _fireGlob(game, p) {
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        const proj = game.spawnEnemyProjectile(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r,
          Math.cos(a) * def.projSpeed, Math.sin(a) * def.projSpeed, def.projDamage, def.glow);
        if (proj) { proj.illuminate = 70; proj.onExpire = () => game.spawnHazard(proj.x, proj.y, def.puddleR, def.puddleDamage, def.puddleLife, def.glow); proj.puddleOnHit = true; }
        RE.Audio.sfx('shoot_heavy');
      },

      // Warden Node — dormant turret; pulses charge it; sweeps a beam.
      _aiTurret(dt, game, p, d) {
        if (this.state === 'idle' || this.state === 'dormant') {
          this.state = 'dormant';
          // charged by pulses (onSwept increments) or proximity
          if (this.charges >= def.pulseCharges || d < def.proxRange) { this.state = 'spinup'; this.stateT = 0; RE.Audio.sfx('lowpower'); }
        } else if (this.state === 'spinup') {
          this.vis = Math.max(this.vis, 0.6);
          if (this.stateT > def.spinup) { this.state = 'sweep'; this.stateT = 0; this.beamAngle = Math.atan2(p.y - this.y, p.x - this.x); }
        } else if (this.state === 'sweep') {
          this.vis = 1;
          this.beamAngle += def.beamRotSpeed * dt;
          RE.Echo.washSoft(this.x, this.y, def.beamLen * 0.6, 0.25);
          this._beamDamage(dt, game, p, this.beamAngle, def.beamArc, def.beamLen, def.beamDamage);
          if (this.stateT > def.sweepTime) { this.state = 'cooldown'; this.stateT = 0; this.charges = 0; }
        } else if (this.state === 'cooldown') {
          this.vis = Math.max(this.vis, 0.4);
          if (this.stateT > def.cooldown) { this.state = (d < def.proxRange ? 'spinup' : 'dormant'); this.stateT = 0; }
        }
      },

      // Echo Wraith — phased/invisible until pulsed, then blinks onto you.
      _aiWraith(dt, game, p, d) {
        if (this.state === 'idle' || this.state === 'phased') {
          this.state = 'phased';
          this._steerTo(p.x, p.y, dt, 1);   // drifts toward player intangibly
          this.vis *= 0.9;
          if (this._pingedBy >= 0 && RE.Echo.pulseSweeping(this.x, this.y, this.r)) { this.state = 'material'; this.stateT = 0; this.vis = 1; }
        } else if (this.state === 'material') {
          this._friction(dt); this.vis = 1;
          this.facing = Math.atan2(p.y - this.y, p.x - this.x);
          if (this.stateT > def.blinkDelay && !this._blinked) {
            this._blinked = true;
            const a = Math.atan2(p.y - this.y, p.x - this.x);
            this.x = p.x - Math.cos(a) * 30; this.y = p.y - Math.sin(a) * 30;
            this._curContact = def.slashDamage;
            Particles.burst(this.x, this.y, 12, { speed: 200, color: '#fff', life: 0.3, size: 3, kind: 'spark' });
          }
          if (this.stateT > def.materialTime) { this.state = 'phased'; this.stateT = 0; this._blinked = false; }
        }
      },

      // Barnacle — proximity mine, cloaked until pulsed.
      _aiMine(dt, game, p, d) {
        this._friction(dt);
        if (this.state === 'idle' || this.state === 'cloaked') {
          this.state = 'cloaked';
          if (d < 55) { this.state = 'armed'; this.stateT = 0; }
        } else if (this.state === 'armed') {
          this.vis = Math.max(this.vis, 0.5);
          const freq = 2 + (this.stateT / def.armTime) * 8;
          if (Math.sin(this.stateT * freq * Math.PI * 2) > 0.9) RE.Audio.sfx('blip', 1400);
          if (this.stateT > def.armTime) this.die(game);
        }
      },
      _detonate(game) {
        const p = game.player;
        Particles.burst(this.x, this.y, 26, { speed: 320, color: def.glow, life: 0.6, size: 3.5, kind: 'spark' });
        RE.Echo.pulse(this.x, this.y, { maxR: def.blastR, speed: 900, strength: 0.8 });
        game.camera.addTrauma(0.3);
        RE.Audio.sfx('enemy_die');
        if (p && p.alive) {
          const d = M.dist(this.x, this.y, p.x, p.y);
          if (d < def.blastR) {
            const t = 1 - d / def.blastR;
            game.damagePlayer(M.lerp(def.blastMin, def.blastMax, t), this);
          }
        }
        // chain
        for (const o of game.enemies) {
          if (o !== this && o.alive && o.def.ai === 'mine' && M.dist(this.x, this.y, o.x, o.y) < def.chainR) {
            o.state = 'armed'; o.stateT = def.armTime - 0.25;
          }
        }
      },

      // Hollow Stalker — elite apex pouncer.
      _aiStalker(dt, game, p, d) {
        this.awake = true;
        if (this.state === 'pounce') {
          this._curContact = def.pounceDamage;
          if (this.stateT > 0.55 || M.dist(this.x, this.y, this._pounceTx, this._pounceTy) < 20) { this.state = 'recover'; this.stateT = 0; this._friction(dt); }
        } else if (this.state === 'recover') {
          this._steerTo(p.x, p.y, dt, 0.4); this.vis = Math.max(this.vis, 0.5);
          if (this.stateT > def.recover) this.state = 'circle';
        } else if (this.state === 'crouch') {
          this._friction(dt); this.vis = Math.max(this.vis, 0.7);
          this.facing = Math.atan2(p.y - this.y, p.x - this.x);
          if (this.stateT > def.crouch) {
            this.state = 'pounce'; this.stateT = 0;
            this.vx = Math.cos(this.facing) * def.pounceSpeed;
            this.vy = Math.sin(this.facing) * def.pounceSpeed;
            this._pounceTx = p.x; this._pounceTy = p.y;
            RE.Audio.sfx('dash');
          }
        } else {
          // circle just outside light
          const ang = Math.atan2(this.y - p.y, this.x - p.x) + this.orbitDir * 0.7 * dt;
          const tx = p.x + Math.cos(ang) * 150, ty = p.y + Math.sin(ang) * 150;
          this._steerTo(tx, ty, dt, 0.8);
          this.fireCd -= dt;
          if (this.fireCd <= 0 && game.map.hasLOS(this.x, this.y, p.x, p.y)) { this.fireCd = def.pounceEvery; this.state = 'crouch'; this.stateT = 0; }
        }
      },

      // Abyssal Eye — opens to light, fires a tracking gaze, only-then vulnerable.
      _aiEye(dt, game, p, d) {
        this.vx = 0; this.vy = 0;
        if (this.state === 'idle' || this.state === 'shut') {
          this.state = 'shut';
          if (RE.Echo.pulseSweeping(this.x, this.y, this.r) || RE.Echo.lightAt(this.x, this.y, p) > 0.5) { this.state = 'opening'; this.stateT = 0; RE.Audio.sfx('lowpower'); }
        } else if (this.state === 'opening') {
          this.vis = Math.max(this.vis, this.stateT / def.openTime);
          if (this.stateT > def.openTime) { this.state = 'open'; this.stateT = 0; this.beamAngle = Math.atan2(p.y - this.y, p.x - this.x); }
        } else if (this.state === 'open') {
          this.vis = 1;
          const target = Math.atan2(p.y - this.y, p.x - this.x);
          this.beamAngle = M.rotateToward(this.beamAngle, target, def.gazeTrack * dt);
          RE.Echo.washSoft(this.x, this.y, def.gazeLen * 0.5, 0.3);
          this._beamDamage(dt, game, p, this.beamAngle, def.gazeArc, def.gazeLen, def.gazeDamage);
          if (this.stateT > def.gazeTime) { this.state = 'closing'; this.stateT = 0; }
        } else if (this.state === 'closing') {
          this.vis = Math.max(0, 1 - this.stateT / def.closeTime);
          if (this.stateT > def.closeTime) { this.state = 'cooldown'; this.stateT = 0; }
        } else if (this.state === 'cooldown') {
          if (this.stateT > def.cooldown) { this.state = 'shut'; this.stateT = 0; }
        }
      },

      _beamDamage(dt, game, p, ang, arc, len, dmg) {
        const d = M.dist(this.x, this.y, p.x, p.y);
        if (d > len) return;
        const toP = Math.atan2(p.y - this.y, p.x - this.x);
        if (Math.abs(M.angleDiff(ang, toP)) < arc * 0.5) {
          this._beamTick = (this._beamTick || 0) - dt;
          if (this._beamTick <= 0) { this._beamTick = 0.3; game.damagePlayer(dmg * this.dmgMul, this); }
        }
      },

      // ===== helpers =====
      _steerTo(tx, ty, dt, mul) {
        const a = Math.atan2(ty - this.y, tx - this.x);
        this.facing = a;
        const spd = this.speed * (mul || 1);
        this.vx = M.damp(this.vx, Math.cos(a) * spd, 6, dt);
        this.vy = M.damp(this.vy, Math.sin(a) * spd, 6, dt);
      },
      _friction(dt) { const f = Math.exp(-5 * dt); this.vx *= f; this.vy *= f; },
      _separate(dt, game) {
        let px = 0, py = 0, n = 0;
        for (const o of game.enemies) {
          if (o === this || !o.alive || o.def.speed === 0) continue;
          const dx = this.x - o.x, dy = this.y - o.y;
          const d2 = dx * dx + dy * dy;
          const rr = (this.r + o.r) * 1.05;
          if (d2 > 0 && d2 < rr * rr) { const dd = Math.sqrt(d2); px += (dx / dd) * (rr - dd); py += (dy / dd) * (rr - dd); n++; }
        }
        if (n) { this.vx += px * 6 * dt / n; this.vy += py * 6 * dt / n; }
      },
      _integrate(dt, game) {
        // wraith phases through walls & enemies
        if (this.def.ai === 'wraith' && this.state === 'phased') { this.x += this.vx * dt; this.y += this.vy * dt; return; }
        this.x += this.vx * dt; this.y += this.vy * dt;
        const res = game.map.collideCircle(this.x, this.y, this.r);
        this.x = res.x; this.y = res.y;
        if (res.hitX) this.vx *= -0.3;
        if (res.hitY) this.vy *= -0.3;
      },

      // ===== rendering =====
      visibility(player) {
        if (RE.CFG.debug && RE.CFG.debug.revealAll) return 1;
        let v = this.vis;
        if (this.lensMarked && this.marked > 0) v = Math.max(v, 0.5);
        if (this.awake && this.def.ai !== 'wraith' && this.def.ai !== 'buried' && this.def.ai !== 'mine' && !this.def.selfLit) v = Math.max(v, 0.12);
        return M.clamp(v, 0, 1);
      },

      render(ctx, cam, echo, player) {
        // beams render even if body dim
        if ((this.def.ai === 'turret' && this.state === 'sweep') || (this.def.ai === 'eye' && this.state === 'open')) {
          this._renderBeam(ctx, cam);
        }
        const vis = this.visibility(player);
        if (vis < 0.04) { this._renderTells(ctx, cam, vis); return; }
        const sx = this.x - cam.x, sy = this.y - cam.y;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.globalAlpha = vis;

        // marked outline
        if (this.marked > 0) {
          ctx.strokeStyle = RE.M.rgba('#ff6a8a', 0.5 * vis);
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, 0, this.r + 4, 0, Math.PI * 2); ctx.stroke();
        }

        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r * 2.4);
        gr.addColorStop(0, RE.M.rgba(def.glow, 0.4 * vis));
        gr.addColorStop(1, RE.M.rgba(def.glow, 0));
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(0, 0, this.r * 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        ctx.rotate(this.facing);
        const flash = this.hitFlash > 0;
        ctx.fillStyle = flash ? '#fff' : def.color;
        ctx.strokeStyle = RE.M.rgba(def.glow, 0.9); ctx.lineWidth = 1.5;
        this._drawShape(ctx);
        // eye
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = flash ? '#fff' : def.glow;
        ctx.beginPath(); ctx.arc(this.r * 0.35, 0, this.r * 0.24, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        if (this.elite) {
          ctx.save(); ctx.globalAlpha = vis * 0.8;
          ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(sx, sy, this.r + 6, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }

        if (this.hp < this.maxHp && vis > 0.3) {
          const w = this.r * 2.2, h = 3;
          ctx.globalAlpha = vis;
          ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx - w / 2, sy - this.r - 9, w, h);
          ctx.fillStyle = def.glow; ctx.fillRect(sx - w / 2, sy - this.r - 9, w * M.clamp(this.hp / this.maxHp, 0, 1), h);
          ctx.globalAlpha = 1;
        }
      },

      // Some tells are visible even when the body is dark (armed mine, crouch).
      _renderTells(ctx, cam, vis) {
        const sx = this.x - cam.x, sy = this.y - cam.y;
        if (this.def.ai === 'mine' && this.state === 'armed') {
          const freq = 2 + (this.stateT / this.def.armTime) * 8;
          const blink = 0.5 + 0.5 * Math.sin(this.stateT * freq * Math.PI * 2);
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = RE.M.rgba('#ff3a2a', 0.4 * blink);
          ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, this.def.blastR, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = RE.M.rgba('#ff5a3a', blink); ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        if (this.def.ai === 'stalker' && this.state === 'crouch') {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const g = 0.5 + 0.5 * Math.sin(this.wobble * 3);
          ctx.fillStyle = RE.M.rgba('#ff6a8a', 0.6 * g);
          ctx.beginPath(); ctx.arc(sx + Math.cos(this.facing) * this.r, sy + Math.sin(this.facing) * this.r, 4, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      },

      _renderBeam(ctx, cam) {
        const sx = this.x - cam.x, sy = this.y - cam.y;
        const isEye = this.def.ai === 'eye';
        const len = isEye ? this.def.gazeLen : this.def.beamLen;
        const arc = isEye ? this.def.gazeArc : this.def.beamArc;
        const col = isEye ? '#c88bff' : '#ff5a6e';
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(this.beamAngle);
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createLinearGradient(0, 0, len, 0);
        grad.addColorStop(0, RE.M.rgba(col, 0.5));
        grad.addColorStop(1, RE.M.rgba(col, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, len, -arc / 2, arc / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      },

      _drawShape(ctx) {
        const r = this.r, shape = def.shape;
        if (shape === 'moth') { this._poly(ctx, 3, r); }
        else if (shape === 'lurker') { this._spikes(ctx, r, 6); }
        else if (shape === 'crawler') { this._spider(ctx, r); }
        else if (shape === 'spark') { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        else if (shape === 'spitter') { this._poly(ctx, 5, r); }
        else if (shape === 'warden') { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.stroke(); }
        else if (shape === 'wraith') { this._spikes(ctx, r, 8); }
        else if (shape === 'mine') { this._spikes(ctx, r, 5); }
        else if (shape === 'stalker') { this._spider(ctx, r * 1.1); }
        else if (shape === 'eye') { this._eye(ctx, r); }
        else { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      },
      _poly(ctx, n, r) { ctx.beginPath(); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.fill(); ctx.stroke(); },
      _spikes(ctx, r, n) { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2; const rad = (i % 2 === 0) ? r * 1.3 : r * 0.55; const x = Math.cos(a) * rad, y = Math.sin(a) * rad; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.fill(); ctx.stroke(); },
      _spider(ctx, r) { ctx.strokeStyle = def.color; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.sin(this.wobble + i) * 0.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6); ctx.stroke(); } ctx.fillStyle = this.hitFlash > 0 ? '#fff' : def.color; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = RE.M.rgba(def.glow, 0.9); ctx.stroke(); },
      _eye(ctx, r) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); const open = (this.state === 'open' || this.state === 'opening'); if (open) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = def.glow; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.7, r * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2); ctx.fill(); } },
    };
    e._litTimer = 0;
    return e;
  }

  RE.makeEnemy = makeEnemy;
})(window.RE = window.RE || {});
