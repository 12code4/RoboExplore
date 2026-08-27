/* RoboExplore — the player robot, EX-0.
 * Movement, dash (i-frames), echo pulse, energy management, modular weapons,
 * shields, and rendering. Everything active draws from the unified ENERGY pool.
 */
(function (RE) {
  'use strict';
  const M = RE.M, CFG = RE.CFG, Particles = RE.Particles;

  function baseStats() {
    return {
      speedMul: 1, dashCdMul: 1, dashIframeMul: 1, dashDistMul: 1, phaseDash: false,
      echoRangeMul: 1, echoHoldMul: 1,
      energyMaxAdd: 0, energyRegenMul: 1,
      hullMaxAdd: 0, magnetRange: 0,
      barrier: false, barrierCd: 6, discharge: 0,
      damageMul: 1, fireRateMul: 1,
    };
  }

  function makePlayer(x, y) {
    const p = {
      type: 'player', alive: true,
      x, y, vx: 0, vy: 0,
      radius: CFG.player.radius,
      facing: 0, moveAngle: 0,
      hull: CFG.player.hullMax, hullMax: CFG.player.hullMax,
      energy: CFG.player.energyMax, energyMax: CFG.player.energyMax,
      energyDelay: 0,
      dashing: false, dashTimer: 0, dashCd: 0, dashDirX: 1, dashDirY: 0,
      iframes: 0, hitFlash: 0,
      fireTimer: 0,
      echoCd: 0, echoReady: 1,
      lightRadius: CFG.player.passiveLight,
      thruster: 0, walkCycle: 0,
      // loadout: one slot per type
      modules: { weapon: null, mobility: null, utility: null, defense: null },
      stats: baseStats(),
      barrierCharge: 0, barrierTimer: 0,
      // stat totals (recomputed)
      _energyMax: CFG.player.energyMax,
      lowPowerWarned: false,

      equip(moduleId) {
        const def = RE.MODULES[moduleId];
        if (!def) return false;
        this.modules[def.slot] = moduleId;
        this.recompute();
        RE.Audio.sfx('equip');
        return true;
      },

      hasModule(id) { return Object.values(this.modules).includes(id); },

      recompute() {
        this.stats = baseStats();
        for (const slot of Object.keys(this.modules)) {
          const id = this.modules[slot];
          if (!id) continue;
          const def = RE.MODULES[id];
          if (def && def.apply) def.apply(this);
        }
        const s = this.stats;
        this.energyMax = CFG.player.energyMax + s.energyMaxAdd;
        this.hullMax = CFG.player.hullMax + s.hullMaxAdd;
        this.hull = Math.min(this.hull, this.hullMax);
        this.energy = Math.min(this.energy, this.energyMax);
        this.lightRadius = CFG.player.passiveLight;
        if (s.barrier && this.barrierCharge === 0) this.barrierCharge = 1;
      },

      weaponDef() {
        const id = this.modules.weapon;
        const def = id && RE.MODULES[id] && RE.MODULES[id].weapon;
        return def || RE.MODULES.blaster.weapon;
      },

      spend(amt) {
        if (this.energy < amt) return false;
        this.energy -= amt;
        this.energyDelay = CFG.player.energyRegenDelay;
        return true;
      },

      addEnergy(a) { this.energy = M.clamp(this.energy + a, 0, this.energyMax); },
      heal(a) { this.hull = M.clamp(this.hull + a, 0, this.hullMax); },

      dash(game) {
        if (this.dashing || this.dashCd > 0) return;
        if (!this.spend(CFG.player.dashCost)) { if (this.energy < CFG.player.dashCost) RE.Audio.sfx('lowpower'); return; }
        const mv = RE.Input.moveVector();
        let ang;
        if (mv.len > 0.1) ang = Math.atan2(mv.y, mv.x);
        else ang = this.facing;
        this.dashDirX = Math.cos(ang); this.dashDirY = Math.sin(ang);
        this.dashing = true;
        this.dashTimer = CFG.player.dashTime;
        this.dashCd = CFG.player.dashCooldown * this.stats.dashCdMul;
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

      echo(game) {
        if (this.echoCd > 0) return;
        if (!this.spend(CFG.player.echoCost)) { RE.Audio.sfx('lowpower'); return; }
        this.echoCd = CFG.player.echoCooldown;
        RE.Echo.pulse(this.x, this.y, {
          maxR: CFG.player.echoMaxRadius * this.stats.echoRangeMul,
        });
        // temporary boost to hold via echoHoldMul isn't per-pulse in slice; global hold reflects mod
        RE.Audio.sfx('echo');
        Particles.ring(this.x, this.y, { color: '#8ef', size: 18, life: 0.5 });
        game.camera.addTrauma(0.04);
      },

      fire(game) {
        const w = this.weaponDef();
        const interval = 1 / (w.fireRate * this.stats.fireRateMul);
        if (this.fireTimer > 0) return;
        if (this.energy < w.energy) { if (!this.lowPowerWarned) { RE.Audio.sfx('lowpower'); this.lowPowerWarned = true; } return; }
        this.lowPowerWarned = false;
        this.spend(w.energy);
        this.fireTimer = interval;
        const count = w.count || 1;
        for (let i = 0; i < count; i++) {
          const spread = (w.spread || 0);
          const off = count > 1 ? (i / (count - 1) - 0.5) * spread * 2 : (Math.random() - 0.5) * spread;
          const a = this.facing + off;
          const spd = w.shotSpeed;
          game.spawnProjectile({
            x: this.x + Math.cos(this.facing) * (this.radius + 6),
            y: this.y + Math.sin(this.facing) * (this.radius + 6),
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            r: w.radius, damage: w.damage * this.stats.damageMul,
            life: w.life, color: w.color, friendly: true, pierce: w.pierce || 0,
          });
        }
        RE.Audio.sfx(w.count > 3 ? 'shoot_heavy' : 'shoot');
        // muzzle
        Particles.burst(
          this.x + Math.cos(this.facing) * this.radius,
          this.y + Math.sin(this.facing) * this.radius,
          3, { speed: 90, color: w.color, life: 0.15, size: 2.5, dir: this.facing, spread: 0.5, kind: 'spark' });
        this.vx -= Math.cos(this.facing) * 20; // slight recoil
        this.vy -= Math.sin(this.facing) * 20;
      },

      damage(amt, source, game) {
        if (this.iframes > 0) return false;
        if (CFG.debug && CFG.debug.invincible) return false;
        // Barrier absorbs.
        if (this.stats.barrier && this.barrierCharge > 0) {
          this.barrierCharge = 0;
          this.barrierTimer = this.stats.barrierCd;
          this.iframes = 0.3;
          RE.Audio.sfx('shield_break');
          Particles.burst(this.x, this.y, 14, { speed: 220, color: '#6cf', life: 0.4, size: 3, kind: 'spark' });
          game.camera.addTrauma(0.2);
          return false;
        }
        this.hull -= amt;
        this.iframes = CFG.player.iframesOnHit;
        this.hitFlash = 0.16;
        RE.Audio.sfx('hurt');
        game.camera.addTrauma(0.32);
        game.hitStop(0.05);
        Particles.burst(this.x, this.y, 10, { speed: 160, color: '#f66', life: 0.4, size: 3, kind: 'spark' });
        // Discharge module.
        if (this.stats.discharge > 0) {
          game.dischargePulse(this.x, this.y, this.stats.discharge);
        }
        if (this.hull <= 0) { this.hull = 0; this.die(game); }
        return true;
      },

      die(game) {
        if (!this.alive) return;
        this.alive = false;
        RE.Audio.sfx('death');
        game.camera.addTrauma(0.9);
        game.hitStop(0.12);
        Particles.burst(this.x, this.y, 40, { speed: 320, color: '#8ff', life: 1.0, size: 4, kind: 'spark' });
        Particles.burst(this.x, this.y, 24, { speed: 120, color: '#fff', life: 0.8, size: 3, kind: 'dot' });
        Particles.ring(this.x, this.y, { color: '#8ff', size: 20, life: 0.8 });
        game.onPlayerDeath();
      },

      update(dt, game) {
        // timers
        if (this.dashCd > 0) this.dashCd -= dt;
        if (this.echoCd > 0) this.echoCd -= dt;
        if (this.fireTimer > 0) this.fireTimer -= dt;
        if (this.iframes > 0) this.iframes -= dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;
        if (this.energyDelay > 0) this.energyDelay -= dt;
        this.echoReady = this.echoCd <= 0 ? 1 : 0;

        // Barrier recharge.
        if (this.stats.barrier) {
          if (this.barrierCharge <= 0) {
            this.barrierTimer -= dt;
            if (this.barrierTimer <= 0) { this.barrierCharge = 1; RE.Audio.sfx('shield'); }
          }
        }

        // Aim toward mouse (world).
        const world = game.camera.toWorld(RE.Input.mouse.x, RE.Input.mouse.y);
        this.facing = Math.atan2(world.y - this.y, world.x - this.x);

        // Input actions.
        if (RE.Input.pressed('echo')) this.echo(game);
        if (RE.Input.pressed('dash')) this.dash(game);
        if (RE.Input.mouse.down) this.fire(game);

        // Energy regen after delay.
        if (this.energyDelay <= 0 && this.energy < this.energyMax) {
          this.energy = Math.min(this.energyMax,
            this.energy + CFG.player.energyRegen * this.stats.energyRegenMul * dt);
        }

        // Low-power warning ping.
        if (this.energy / this.energyMax < 0.18 && !this._lowPing) {
          this._lowPing = true; RE.Audio.sfx('lowpower');
        } else if (this.energy / this.energyMax > 0.3) this._lowPing = false;

        // Movement.
        const mv = RE.Input.moveVector();
        if (this.dashing) {
          this.dashTimer -= dt;
          this.vx = this.dashDirX * CFG.player.dashSpeed * this.stats.dashDistMul;
          this.vy = this.dashDirY * CFG.player.dashSpeed * this.stats.dashDistMul;
          if (this.dashTimer <= 0) this.dashing = false;
          if (Math.random() < 0.6) Particles.emit({ x: this.x, y: this.y, vx: 0, vy: 0, life: 0.22, size: 5, color: '#6cf', drag: 3, kind: 'dot' });
        } else {
          const maxSpd = CFG.player.maxSpeed * this.stats.speedMul;
          if (mv.len > 0.05) {
            this.moveAngle = Math.atan2(mv.y, mv.x);
            this.vx += mv.x * CFG.player.accel * dt;
            this.vy += mv.y * CFG.player.accel * dt;
            this.walkCycle += dt * 12;
          } else {
            const f = Math.exp(-CFG.player.friction * dt);
            this.vx *= f; this.vy *= f;
          }
          // clamp speed
          const sp = Math.hypot(this.vx, this.vy);
          if (sp > maxSpd) { this.vx = this.vx / sp * maxSpd; this.vy = this.vy / sp * maxSpd; }
          this.thruster = M.clamp(sp / maxSpd, 0, 1);
        }

        // Integrate + collide.
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        const res = game.map.collideCircle(this.x, this.y, this.radius);
        this.x = res.x; this.y = res.y;
        if (res.hitX) this.vx *= 0.4;
        if (res.hitY) this.vy *= 0.4;

        // Enemy projectile collisions handled in game loop.
      },

      render(ctx, cam) {
        const sx = this.x - cam.x, sy = this.y - cam.y;
        ctx.save();
        ctx.translate(sx, sy);

        // Passive light halo (subtle)
        ctx.globalCompositeOperation = 'lighter';
        const lr = this.lightRadius;
        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, lr);
        halo.addColorStop(0, 'rgba(120,210,255,0.12)');
        halo.addColorStop(0.5, 'rgba(80,160,255,0.05)');
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(0, 0, lr, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // Barrier shield ring.
        if (this.stats.barrier && this.barrierCharge > 0) {
          ctx.strokeStyle = 'rgba(120,200,255,0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2); ctx.stroke();
        }

        // Thruster flame opposite move direction.
        if (this.thruster > 0.05 && !this.dashing) {
          const ta = this.moveAngle + Math.PI;
          ctx.save();
          ctx.rotate(ta);
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

        // Body (chassis) — rotates to face aim.
        ctx.rotate(this.facing);
        const flash = this.hitFlash > 0;
        const iframeBlink = this.iframes > 0 && (Math.floor(this.iframes * 30) % 2 === 0);
        ctx.globalAlpha = iframeBlink ? 0.5 : 1;

        // hull
        ctx.fillStyle = flash ? '#fff' : '#2b5f7a';
        ctx.strokeStyle = '#7fe6ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // directional core / cannon
        ctx.fillStyle = flash ? '#fff' : '#0e2a38';
        ctx.fillRect(0, -3, this.radius + 8, 6);
        ctx.strokeRect(0, -3, this.radius + 8, 6);

        // eye
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = flash ? '#fff' : '#8ff';
        ctx.beginPath(); ctx.arc(this.radius * 0.2, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        ctx.globalAlpha = 1;
        ctx.restore();
      },
    };
    p.recompute();
    return p;
  }

  RE.makePlayer = makePlayer;
})(window.RE = window.RE || {});
