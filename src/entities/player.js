/* RoboExplore — the player robot, EX-0.
 * Move-toward movement, dash (with phase/blink variants), echo pulse with
 * Echo-Charge, unified energy, a data-driven modular weapon system, shields,
 * and reactive defenses. Everything active draws from the ENERGY pool.
 */
(function (RE) {
  'use strict';
  const M = RE.M, CFG = RE.CFG, Particles = RE.Particles;

  function baseStats() {
    return {
      speedMul: 1,
      dashDistMul: 1, dashCostAdd: 0, dashCdAdd: 0, dashIframeMul: 1,
      phaseDash: false, phaseWalls: false, dashMicroPulse: false, blinkDash: false,
      energyMaxAdd: 0, energyRegenAdd: 0, energyRegenMul: 1, regenDelayAdd: 0,
      echoRangeMul: 1, echoBandMul: 1, echoHoldAdd: 0, echoCostAdd: 0, echoCdAdd: 0,
      twinPulse: false,
      markFromEcho: false, markDur: 3.5,   // Predator Lens: extends duration/sources only (no extra mult)
      damageMul: 1, armorMul: 1, hullMaxAdd: 0, wallDamageMul: 1,
      lightInnerMul: 1, lightOuterMul: 1,
      flashRangeMul: 1, flashArcMul: 1, flashDrainMul: 1,
      magnetRange: 0, magnetBonus: 0,
      momentumRegen: false, momentumSpeed: 120, momentumBonus: 10,
      shieldHold: false, retaliate: 0, retaliateStun: 0.4, retaliateEnergy: 8,
      coreVent: false, coreVentUsed: false,
      // v1.1 modules
      echoNova: 0, chronoDilate: false,
      bulwark: 0, bulwarkRegenDelay: 4, bulwarkRegen: 18,
      echoDamage: 0, echoBuffDamage: 0, echoBuffTime: 0,   // Resonant Cannon
      weapon: null,   // override weapon config; null => default Rivet Driver
    };
  }

  const DEFAULT_WEAPON = {
    name: 'Rivet Driver', kinetic: true,
    damage: CFG.player.weaponDamage, fireRate: CFG.player.fireRate,
    count: 1, spread: CFG.player.shotSpread, speed: CFG.player.shotSpeed,
    life: CFG.player.shotLife, radius: CFG.player.shotRadius, pierce: 0, bounce: 0,
    energy: 0, color: '#bfe9ff', illuminate: CFG.player.shotLightR,
  };

  function makePlayer(x, y) {
    const p = {
      type: 'player', alive: true,
      x, y, vx: 0, vy: 0,
      radius: CFG.player.radius,
      facing: 0, moveAngle: 0,
      hull: CFG.player.hullMax, hullMax: CFG.player.hullMax,
      energy: CFG.player.energyMax, energyMax: CFG.player.energyMax,
      energyDelay: 0,
      lightInner: CFG.player.lightInner, lightOuter: CFG.player.lightOuter,
      dashing: false, dashTimer: 0, dashCd: 0, dashDirX: 1, dashDirY: 0, dashSpeed: 0,
      iframes: 0, hitFlash: 0,
      fireTimer: 0, sinceFire: 99,
      echoCd: 0, sincePulse: 99,
      surgeCharge: 0, weaponCharge: 0, charging: false,
      shieldActive: false, shieldAngle: 0,
      barrierTimer: 0,
      bulwarkShield: 0, bulwarkTimer: 0,
      thruster: 0, walkCycle: 0,
      flashOn: false,
      upgrades: [],   // stacking loadout: list of equipped module ids
      stats: baseStats(),
      speed: 0,
      _lowPing: false, retaliateCd: 0,

      // Install a module. Modules stack; within a conflict `group` a new module
      // replaces the old (two guns can't coexist). Returns {added, replaced}.
      equip(moduleId) {
        const def = RE.MODULES[moduleId];
        if (!def) return { added: false, replaced: null };
        let replaced = null;
        if (def.group) {
          // replace any existing member of the same conflict group
          for (let i = 0; i < this.upgrades.length; i++) {
            const od = RE.MODULES[this.upgrades[i]];
            if (od && od.group === def.group) { replaced = this.upgrades[i]; this.upgrades.splice(i, 1); break; }
          }
          this.upgrades.push(moduleId);
        } else if (def.stack) {
          this.upgrades.push(moduleId);   // duplicates allowed: they compound
        } else {
          if (!this.upgrades.includes(moduleId)) this.upgrades.push(moduleId);
        }
        this.recompute();
        return { added: true, replaced };
      },
      hasModule(id) { return this.upgrades.includes(id); },
      hasGroup(group) { return this.upgrades.some(id => RE.MODULES[id] && RE.MODULES[id].group === group); },
      upgradeCount(id) { let n = 0; for (const u of this.upgrades) if (u === id) n++; return n; },

      recompute() {
        this.stats = baseStats();
        for (const id of this.upgrades) {
          const def = RE.MODULES[id];
          if (def && def.apply) def.apply(this.stats, this);
        }
        const s = this.stats;
        this.energyMax = CFG.player.energyMax + s.energyMaxAdd;
        this.hullMax = CFG.player.hullMax + s.hullMaxAdd;
        this.lightInner = CFG.player.lightInner * s.lightInnerMul;
        this.lightOuter = CFG.player.lightOuter * s.lightOuterMul;
        this.hull = Math.min(this.hull, this.hullMax);
        this.energy = Math.min(this.energy, this.energyMax);
        // Fill the Bulwark shield only when it's newly equipped; otherwise
        // clamp the existing charge to the (possibly new) max.
        if (s.bulwark > 0) { this.bulwarkShield = this._hadBulwark ? Math.min(this.bulwarkShield, s.bulwark) : s.bulwark; this._hadBulwark = true; }
        else { this.bulwarkShield = 0; this._hadBulwark = false; }
      },

      weaponDef() { return this.stats.weapon || DEFAULT_WEAPON; },

      spend(amt) {
        if (amt <= 0) return true;
        if (this.energy < amt) return false;
        this.energy -= amt;
        this.energyDelay = Math.max(0, CFG.player.energyRegenDelay + this.stats.regenDelayAdd);
        return true;
      },
      addEnergy(a) { this.energy = M.clamp(this.energy + a, 0, this.energyMax); },
      heal(a) { this.hull = M.clamp(this.hull + a, 0, this.hullMax); },

      // ---- Dash (with Phase / Blink variants) --------------------------
      dash(game) {
        if (this.dashing || this.dashCd > 0) return;
        const cost = CFG.player.dashCost + this.stats.dashCostAdd;
        if (this.energy < cost) { RE.Audio.sfx('lowpower'); game.flashEnergy(); return; }
        this.spend(cost);
        if (this.stats.chronoDilate) game.triggerChrono(0.9);
        const mv = RE.Input.moveVector();
        const ang = mv.len > 0.1 ? Math.atan2(mv.y, mv.x) : this.facing;
        this.dashDirX = Math.cos(ang); this.dashDirY = Math.sin(ang);
        const dist = CFG.player.dashDist * this.stats.dashDistMul;

        if (this.stats.blinkDash) {
          // Instant teleport to max unobstructed distance up to `dist`.
          this._blink(game, ang, dist);
          this.dashCd = CFG.player.dashCooldown + 0.25 + this.stats.dashCdAdd;
          this.iframes = Math.max(this.iframes, CFG.player.dashIframes * this.stats.dashIframeMul);
          return;
        }
        this.dashSpeed = dist / CFG.player.dashTime;
        this.dashing = true;
        this.dashTimer = CFG.player.dashTime;
        this.dashCd = CFG.player.dashCooldown + this.stats.dashCdAdd;
        this.iframes = Math.max(this.iframes, CFG.player.dashIframes * this.stats.dashIframeMul);
        RE.Audio.sfx('dash');
        game.camera.addTrauma(0.10);
        for (let i = 0; i < 8; i++) {
          Particles.emit({
            x: this.x, y: this.y,
            vx: -this.dashDirX * 120 + (Math.random() - 0.5) * 60,
            vy: -this.dashDirY * 120 + (Math.random() - 0.5) * 60,
            life: 0.3, size: 4, color: '#8ff', drag: 4, kind: 'spark',
          });
        }
      },

      _blink(game, ang, dist) {
        const step = 6; let travelled = 0;
        let nx = this.x, ny = this.y;
        while (travelled < dist) {
          const tx = nx + Math.cos(ang) * step, ty = ny + Math.sin(ang) * step;
          if (game.map.isWallPx(tx, ty)) break;
          nx = tx; ny = ty; travelled += step;
        }
        Particles.burst(this.x, this.y, 12, { speed: 200, color: '#b6f', life: 0.4, size: 3, kind: 'spark' });
        this.x = nx; this.y = ny; this.vx = 0; this.vy = 0;
        Particles.burst(this.x, this.y, 12, { speed: 200, color: '#b6f', life: 0.4, size: 3, kind: 'spark' });
        RE.Audio.sfx('dash');
        if (this.stats.dashMicroPulse) this._microPulse(game);
      },

      _endDash(game) {
        this.dashing = false;
        // inherit a fraction of dash velocity for a satisfying skid
        this.vx = this.dashDirX * this.dashSpeed * CFG.player.dashExitInherit;
        this.vy = this.dashDirY * this.dashSpeed * CFG.player.dashExitInherit;
        if (this.stats.dashMicroPulse) this._microPulse(game);
      },
      _microPulse(game) {
        RE.Echo.pulse(this.x, this.y, { maxR: 130, speed: 700, strength: 0.9 });
        game.onPulse(this.x, this.y, 130);
      },

      // ---- Flashlight (steady directional cone; drains the battery) -----
      toggleFlashlight() {
        this.flashOn = !this.flashOn;
        RE.Audio.sfx(this.flashOn ? 'ui' : 'ui_move');
        if (this.flashOn && this.energy <= 0) { this.flashOn = false; RE.Audio.sfx('lowpower'); }
      },
      flashParams() {
        return {
          range: CFG.player.flashRange * this.stats.flashRangeMul,
          half: CFG.player.flashHalfArc * this.stats.flashArcMul,
        };
      },
      _flashlight(dt, game) {
        if (!this.flashOn) return;
        if (this.energy <= 0) { this.flashOn = false; RE.Audio.sfx('lowpower'); return; }
        const drain = CFG.player.flashDrain * this.stats.flashDrainMul * dt;
        this.energy = Math.max(0, this.energy - drain);
        this.energyDelay = Math.max(this.energyDelay, 0.3);   // suppress passive regen while lit
        const { range, half } = this.flashParams();
        RE.Echo.washCone(this.x, this.y, this.facing, range, half, CFG.player.flashLevel, game.map);
        if (this.energy <= 0) { this.flashOn = false; RE.Audio.sfx('lowpower'); }
      },

      // ---- Echo pulse (with Echo-Charge + Twin-Pulse) ------------------
      echo(game) {
        if (this.echoCd > 0) return;
        if (game.echoDisabled) { RE.Audio.sfx('lowpower'); RE.HUD.toast('SIGNAL JAMMED', { color: '#ff9a3f', life: 1.0 }); return; }
        const cost = Math.max(1, CFG.player.echoCost + this.stats.echoCostAdd);
        if (!this.spend(cost)) { RE.Audio.sfx('lowpower'); game.flashEnergy(); return; }
        this.echoCd = CFG.player.echoCooldown + this.stats.echoCdAdd;
        this.sincePulse = 0;
        const maxR = CFG.player.echoMaxRadius * this.stats.echoRangeMul * (game.biomeMod.echoRangeMul || 1);
        const band = CFG.player.echoBandWidth * this.stats.echoBandMul;
        RE.Echo.pulse(this.x, this.y, { maxR, band });
        if (this.stats.twinPulse) {
          // second, tighter ring launched slightly behind the first
          RE.Echo.pulse(this.x, this.y, { maxR: maxR * 0.65, band: band * 0.65, r0: -30, strength: 0.9 });
        }
        // Resonant Cannon buff window
        if (this.stats.echoBuffDamage) this.stats.echoBuffTime = 1.6;
        game.onPulse(this.x, this.y, maxR);
        // Echo Nova: the pulse detonates for AoE damage + knockback.
        if (this.stats.echoNova > 0) {
          const R = 155;
          for (const e of game.enemies) {
            if (!e.alive) continue;
            const d = M.dist(this.x, this.y, e.x, e.y);
            if (d < R) { const a = Math.atan2(e.y - this.y, e.x - this.x); e.takeDamage(this.stats.echoNova * (1 - d / R * 0.4), Math.cos(a) * 260, Math.sin(a) * 260, game); }
          }
          Particles.burst(this.x, this.y, 18, { speed: 320, color: '#8ef', life: 0.45, size: 3, kind: 'spark' });
          game.camera.addTrauma(0.2);
        }
        RE.Audio.sfx('echo');
        Particles.ring(this.x, this.y, { color: '#8ef', size: 18, life: 0.5 });
      },

      // ---- Fire (data-driven weapon; charge weapons handled in update) --
      fire(game) {
        const w = this.weaponDef();
        const interval = 1 / w.fireRate;
        if (this.fireTimer > 0) return;
        if (this.energy < (w.energy || 0)) { if (!this._lowPing) { RE.Audio.sfx('lowpower'); this._lowPing = true; } return; }
        this._lowPing = false;
        this.fireTimer = interval;
        this._emitShots(game, w, 1);
        RE.Audio.sfx(w.heavy ? 'shoot_heavy' : 'shoot');
      },

      _emitShots(game, w, mult) {
        this.spend((w.energy || 0) * mult);
        // Echo-Charge buff
        const charged = this.sincePulse <= CFG.player.echoChargeWindow;
        let dmgMul = this.stats.damageMul * (charged ? CFG.player.echoChargeMul : 1);
        let bonusPierce = charged ? 1 : 0;
        // Resonant buff
        if (this.stats.echoBuffTime > 0) dmgMul *= 1 + (this.stats.echoBuffDamage / w.damage);
        // Siege surge
        let dmg = w.damage, splash = 0, splashDmg = 0, knock = 0;
        if (w.surgeEvery) {
          this.surgeCharge++;
          if (this.surgeCharge >= w.surgeEvery) {
            this.surgeCharge = 0; dmg = w.surgeDamage; splash = w.splash; splashDmg = w.splashDamage; knock = w.knockback;
            this.spend(w.surgeEnergy - (w.energy || 0));
            RE.Audio.sfx('shoot_heavy');
          }
        }
        const count = w.count || 1;
        for (let i = 0; i < count; i++) {
          const off = count > 1 ? (i / (count - 1) - 0.5) * (w.spread || 0) * 2 : (Math.random() - 0.5) * (w.spread || 0);
          const a = this.facing + off;
          game.spawnProjectile({
            x: this.x + Math.cos(this.facing) * (this.radius + 6),
            y: this.y + Math.sin(this.facing) * (this.radius + 6),
            vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
            r: w.radius, damage: dmg * dmgMul,
            life: w.life, color: w.color, friendly: true,
            pierce: (w.pierce || 0) + bonusPierce, bounce: w.bounce || 0,
            illuminate: w.illuminate || 0, splash, splashDmg, knockback: knock,
            homing: w.homing, homTurn: w.homTurn, homRange: w.homRange,
            wallDamage: w.damage * this.stats.wallDamageMul,
          });
        }
        Particles.burst(this.x + Math.cos(this.facing) * this.radius, this.y + Math.sin(this.facing) * this.radius,
          3, { speed: 90, color: w.color, life: 0.15, size: 2.5, dir: this.facing, spread: 0.5, kind: 'spark' });
        // (no velocity pushback — it accumulated into backward drift during auto-fire)
        game.camera.addTrauma(w.heavy ? 0.18 : 0.03);
      },

      _releaseCharge(game) {
        const w = this.weaponDef();
        if (!w.charge) { this.charging = false; this.weaponCharge = 0; return; }
        if (this.weaponCharge >= w.charge && this.energy >= w.energy) {
          // piercing lance: fast, high-pierce projectile that illuminates
          this.spend(w.energy);
          game.spawnProjectile({
            x: this.x + Math.cos(this.facing) * (this.radius + 6),
            y: this.y + Math.sin(this.facing) * (this.radius + 6),
            vx: Math.cos(this.facing) * w.speed, vy: Math.sin(this.facing) * w.speed,
            r: w.radius, damage: w.damage * this.stats.damageMul,
            life: w.life, color: w.color, friendly: true,
            pierce: 999, illuminate: 40, beam: true,
            wallDamage: w.damage * this.stats.wallDamageMul,
          });
          RE.Audio.sfx('shoot_heavy');
          game.camera.addTrauma(0.22);
        }
        this.charging = false; this.weaponCharge = 0;
      },

      // ---- Damage / death ----------------------------------------------
      damage(amt, source, game) {
        if (this.iframes > 0) return false;
        if (CFG.debug && CFG.debug.invincible) return false;
        // Deflector shield: block frontal (kinetic — does not stop environmental hazards)
        if (this.shieldActive && source && source.x != null && !source.hazard) {
          const ang = Math.atan2(source.y - this.y, source.x - this.x);
          const diff = Math.abs(M.angleDiff(this.facing, ang));
          if (diff < 1.22) { // ~140deg arc (±70deg)
            this.spend(5);
            Particles.burst(this.x + Math.cos(ang) * this.radius, this.y + Math.sin(ang) * this.radius, 6,
              { speed: 160, color: '#6cf', life: 0.3, size: 2.5, dir: ang + Math.PI, spread: 1, kind: 'spark' });
            return true;   // handled: consume the incoming projectile
          } else amt *= 0.6;
        }
        amt *= this.stats.armorMul;
        // Bulwark Field: rechargeable bubble absorbs before hull (not vs hazards).
        if (this.stats.bulwark > 0 && !(source && source.hazard)) {
          this.bulwarkTimer = this.stats.bulwarkRegenDelay;   // any hit delays reform
          if (this.bulwarkShield > 0) {
            if (this.bulwarkShield >= amt) {
              this.bulwarkShield -= amt;
              RE.Audio.sfx('shield'); game.screenFlash('#6cf', 0.12, 0.15);
              Particles.burst(this.x, this.y, 8, { speed: 180, color: '#6cf', life: 0.3, size: 2.5, kind: 'spark' });
              game.camera.addTrauma(0.15);
              return true;   // handled: consume the projectile, no i-frame freebie
            }
            amt -= this.bulwarkShield; this.bulwarkShield = 0; RE.Audio.sfx('shield_break');
          }
        }
        // Core Vent: lethal-save once per sector
        if (this.stats.coreVent && !this.stats.coreVentUsed && amt >= this.hull) {
          this.stats.coreVentUsed = true;
          const e = this.energy;
          this.energy = 0; this.hull = 1; this.iframes = 1.5;
          game.dischargePulse(this.x, this.y, e * 2, 220);
          RE.HUD.showBanner('CORE VENT', '', 1.4);
          game.camera.addTrauma(0.7);
          return true;
        }
        this.hull -= amt;
        this.iframes = CFG.player.hitIframes;
        this.hitFlash = 0.16;
        RE.Audio.sfx('hurt');
        game.screenFlash('#ff3a4a', 0.22, 0.22);
        game.camera.addTrauma(0.4 * M.clamp(amt / 25, 0.4, 1));
        game.hitStop(CFG.hitStopHurt);
        // knockback
        if (source && source.x != null) {
          const a = Math.atan2(this.y - source.y, this.x - source.x);
          this.vx += Math.cos(a) * CFG.player.knockback;
          this.vy += Math.sin(a) * CFG.player.knockback;
        }
        Particles.burst(this.x, this.y, 10, { speed: 160, color: '#f66', life: 0.4, size: 3, kind: 'spark' });
        // Reactive Nanofield
        if (this.stats.retaliate > 0 && this.retaliateCd <= 0) {
          this.retaliateCd = 1.2;
          const hasE = this.energy >= this.stats.retaliateEnergy;
          if (hasE) this.spend(this.stats.retaliateEnergy);
          RE.Echo.pulse(this.x, this.y, { maxR: 160, band: 60, speed: 700 });
          game.onPulse(this.x, this.y, 160);
          if (hasE) game.dischargePulse(this.x, this.y, this.stats.retaliate, 160, this.stats.retaliateStun);
        }
        if (this.hull <= 0) { this.hull = 0; this.die(game); }
        return true;
      },

      die(game) {
        if (!this.alive) return;
        this.alive = false;
        RE.Audio.sfx('death');
        game.camera.addTrauma(0.9);
        game.hitStop(CFG.hitStopBoss);
        Particles.burst(this.x, this.y, 40, { speed: 320, color: '#8ff', life: 1.0, size: 4, kind: 'spark' });
        Particles.burst(this.x, this.y, 24, { speed: 120, color: '#fff', life: 0.8, size: 3, kind: 'dot' });
        Particles.ring(this.x, this.y, { color: '#8ff', size: 20, life: 0.8 });
        game.onPlayerDeath();
      },

      // ---- Update ------------------------------------------------------
      update(dt, game) {
        if (this.dashCd > 0) this.dashCd -= dt;
        if (this.echoCd > 0) this.echoCd -= dt;
        if (this.fireTimer > 0) this.fireTimer -= dt;
        if (this.iframes > 0) this.iframes -= dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;
        if (this.energyDelay > 0) this.energyDelay -= dt;
        if (this.retaliateCd > 0) this.retaliateCd -= dt;
        if (this.energyFlash > 0) this.energyFlash -= dt;
        // Bulwark Field recharge.
        if (this.stats.bulwark > 0 && this.bulwarkShield < this.stats.bulwark) {
          this.bulwarkTimer -= dt;
          if (this.bulwarkTimer <= 0) this.bulwarkShield = Math.min(this.stats.bulwark, this.bulwarkShield + this.stats.bulwarkRegen * dt);
        }
        this.sincePulse += dt; this.sinceFire += dt;
        if (this.stats.echoBuffTime > 0) this.stats.echoBuffTime -= dt;

        // Aim toward mouse (twin-stick).
        const world = game.camera.toWorld(RE.Input.mouse.x, RE.Input.mouse.y);
        this.facing = Math.atan2(world.y - this.y, world.x - this.x);

        // Actions.
        if (RE.Input.pressed('echo')) this.echo(game);
        if (RE.Input.pressed('dash')) this.dash(game);
        if (RE.Input.pressed('flashlight')) this.toggleFlashlight();

        // Flashlight: a steady directional cone that drains the battery.
        this._flashlight(dt, game);

        // Shield hold (Deflector) — held on right-mouse (or [C]).
        this.shieldActive = false;
        const shieldHeld = RE.Input.mouse.right || RE.Input.down('shield');
        if (this.stats.shieldHold && shieldHeld && this.energy > 0) {
          this.shieldActive = true;
          this.spend(10 * dt);
          this.shieldAngle = this.facing;
        }

        // Fire (charge weapons handled on release).
        const w = this.weaponDef();
        if (w.charge) {
          if (RE.Input.mouse.down) { this.charging = true; this.weaponCharge = Math.min(w.charge, this.weaponCharge + dt); }
          else if (this.charging) { this._releaseCharge(game); }
        } else if (RE.Input.mouse.down && !this.shieldActive) {
          this.fire(game);
        }

        // Energy regen (Momentum Cells override).
        const moving = Math.hypot(this.vx, this.vy) > this.stats.momentumSpeed;
        if (this.stats.momentumRegen && moving) {
          this.energy = Math.min(this.energyMax, this.energy + (CFG.player.energyRegen + this.stats.momentumBonus) * dt);
        } else if (this.energyDelay <= 0 && this.energy < this.energyMax) {
          const regen = (CFG.player.energyRegen + this.stats.energyRegenAdd) * this.stats.energyRegenMul * (game.biomeMod.energyRegenMul || 1);
          this.energy = Math.min(this.energyMax, this.energy + regen * dt);
        }

        // Low-power heartbeat warning.
        if (this.energy / this.energyMax < 0.16) {
          this._heartbeat = (this._heartbeat || 0) - dt;
          if (this._heartbeat <= 0) { this._heartbeat = 1.1; RE.Audio.sfx('lowpower'); }
        } else this._heartbeat = 0;

        // Movement (move-toward).
        if (this.dashing) {
          this.dashTimer -= dt;
          this.vx = this.dashDirX * this.dashSpeed;
          this.vy = this.dashDirY * this.dashSpeed;
          if (this.dashTimer <= 0) this._endDash(game);
          if (Math.random() < 0.6) Particles.emit({ x: this.x, y: this.y, vx: 0, vy: 0, life: 0.22, size: 5, color: '#6cf', drag: 3, kind: 'dot' });
        } else {
          const mv = RE.Input.moveVector();
          const speedMul = this.stats.speedMul * (game.biomeMod.speedMul || 1);
          const maxSpd = CFG.player.maxSpeed * speedMul;
          const tvx = mv.x * maxSpd, tvy = mv.y * maxSpd;
          const decel = CFG.player.decel * (game.biomeMod.decelMul || 1);   // ice slides
          const rate = (mv.len > 0.05 ? CFG.player.accel : decel) * dt;
          this.vx = M.approach(this.vx, tvx, rate);
          this.vy = M.approach(this.vy, tvy, rate);
          if (mv.len > 0.05) { this.moveAngle = Math.atan2(mv.y, mv.x); this.walkCycle += dt * 12; }
          // biome push (currents)
          if (game.biomeMod.push) { this.vx += game.biomeMod.push.x * dt; this.vy += game.biomeMod.push.y * dt; }
        }

        // Integrate + collide (per-axis for wall-slide).
        const preVx = this.vx, preVy = this.vy;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        const res = game.map.collideCircle(this.x, this.y, this.radius);
        this.x = res.x; this.y = res.y;
        if (res.hitX) this.vx = 0;
        if (res.hitY) this.vy = 0;
        // wall-slam trauma post-dash
        if ((res.hitX || res.hitY) && Math.hypot(preVx, preVy) > 500) game.camera.addTrauma(0.2);

        this.speed = Math.hypot(this.vx, this.vy);
        this.thruster = M.clamp(this.speed / CFG.player.maxSpeed, 0, 1);

        // Biome: overheat when idling too long (The Core Marrow).
        this.overheating = false;
        if (game.biomeMod.overheat && !this.dashing) {
          if (this.speed < 16) this._stillT = (this._stillT || 0) + dt; else this._stillT = 0;
          if (this._stillT > 2.5) {
            this.overheating = true;
            if (Math.random() < 0.3) Particles.emit({ x: this.x + (Math.random() - 0.5) * 18, y: this.y - 8, vx: 0, vy: -46, life: 0.5, size: 3, color: '#ff6a2a', drag: 1, kind: 'dot' });
            // i-frames (dash, and the reboot grace) protect against overheat —
            // prevents an undodgeable death-loop after Emergency Reboot.
            if (this.iframes <= 0) {
              const rate = 1.5 * (1 + (this._stillT - 2.5) * 0.35);
              this.hull -= rate * dt;
              if (this.hull <= 0) { this.hull = 0; this.die(game); }
            }
          }
        } else this._stillT = 0;
      },

      render(ctx, cam) {
        const sx = this.x - cam.x, sy = this.y - cam.y;
        ctx.save();
        ctx.translate(sx, sy);

        // Passive light halo.
        ctx.globalCompositeOperation = 'lighter';
        const lr = this.lightOuter;
        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, lr);
        halo.addColorStop(0, 'rgba(120,210,255,0.14)');
        halo.addColorStop(0.5, 'rgba(80,160,255,0.05)');
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(0, 0, lr, 0, Math.PI * 2); ctx.fill();

        // Flashlight cone glow (warm, in the aim direction).
        if (this.flashOn) {
          const { range, half } = this.flashParams();
          const cone = ctx.createRadialGradient(0, 0, 0, 0, 0, range);
          cone.addColorStop(0, 'rgba(255,244,210,0.20)');
          cone.addColorStop(0.6, 'rgba(255,232,170,0.08)');
          cone.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = cone;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, range, this.facing - half, this.facing + half);
          ctx.closePath(); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';

        // Deflector shield arc.
        if (this.shieldActive) {
          ctx.strokeStyle = 'rgba(120,200,255,0.6)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 0, this.radius + 8, this.shieldAngle - 1.22, this.shieldAngle + 1.22);
          ctx.stroke();
        }
        // Bulwark bubble.
        if (this.stats.bulwark > 0 && this.bulwarkShield > 0) {
          const frac = this.bulwarkShield / this.stats.bulwark;
          ctx.strokeStyle = RE.M.rgba('#6cf', 0.25 + 0.4 * frac);
          ctx.lineWidth = 2 + 2 * frac;
          ctx.beginPath(); ctx.arc(0, 0, this.radius + 9, 0, Math.PI * 2); ctx.stroke();
        }

        // charge indicator (rail)
        const w = this.weaponDef();
        if (w.charge && this.charging) {
          const frac = M.clamp(this.weaponCharge / w.charge, 0, 1);
          ctx.strokeStyle = frac >= 1 ? '#b6f' : 'rgba(180,120,255,0.5)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, this.radius + 12, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
        }

        // Thruster flame.
        if (this.thruster > 0.05 && !this.dashing) {
          const ta = this.moveAngle + Math.PI;
          ctx.save(); ctx.rotate(ta);
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = 'rgba(120,210,255,' + (0.4 * this.thruster) + ')';
          ctx.beginPath();
          ctx.moveTo(this.radius, 0);
          ctx.lineTo(this.radius + 10 * this.thruster, 4);
          ctx.lineTo(this.radius + 16 * this.thruster + Math.random() * 4, 0);
          ctx.lineTo(this.radius + 10 * this.thruster, -4);
          ctx.closePath(); ctx.fill();
          ctx.restore();
          ctx.globalCompositeOperation = 'source-over';
        }

        // Chassis.
        ctx.rotate(this.facing);
        const flash = this.hitFlash > 0;
        const iframeBlink = this.iframes > 0 && !this.dashing && (Math.floor(this.iframes * 30) % 2 === 0);
        ctx.globalAlpha = iframeBlink ? 0.5 : 1;
        ctx.fillStyle = flash ? '#fff' : '#2b5f7a';
        ctx.strokeStyle = '#7fe6ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = flash ? '#fff' : '#0e2a38';
        ctx.fillRect(0, -3, this.radius + 8, 6);
        ctx.strokeRect(0, -3, this.radius + 8, 6);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = flash ? '#fff' : '#8ff';
        ctx.beginPath(); ctx.arc(this.radius * 0.2, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.restore();

        // Energy ring around player (peripheral read).
        this._energyRing(ctx, sx, sy);
      },

      _energyRing(ctx, sx, sy) {
        const frac = this.energy / this.energyMax;
        const r = this.radius + 6;
        ctx.save();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(20,40,60,0.5)';
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
        const col = frac < 0.18 ? '#ff5a6e' : (this.energyFlash > 0 ? '#ff5a6e' : '#2db6ff');
        ctx.strokeStyle = col;
        ctx.beginPath(); ctx.arc(sx, sy, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
        ctx.restore();
      },
      energyFlash: 0,
    };
    p.recompute();
    return p;
  }

  RE.makePlayer = makePlayer;
  RE.DEFAULT_WEAPON = DEFAULT_WEAPON;
})(window.RE = window.RE || {});
