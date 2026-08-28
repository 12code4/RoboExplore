/* RoboExplore — boss framework: multi-phase threshold guardians.
 * A boss is enemy-compatible (lives in game.enemies, game.boss) but self-lit
 * and driven by a phase/attack script. Every damaging attack is telegraphed
 * with a bright, self-lit tell so fights stay fair in the dark.
 *
 * Attacks are data-driven building blocks (radial / aimed / spiral / shockwave
 * / slam / sweep / adds / blackout / supernova) so five distinct bosses share
 * one engine. Definitions live in RE.BOSSES.
 */
(function (RE) {
  'use strict';
  const M = RE.M, CFG = RE.CFG, Particles = RE.Particles, TAU = Math.PI * 2;

  function makeBoss(defId, x, y, sector) {
    const def = RE.BOSSES[defId];
    const b = {
      type: 'enemy', isBoss: true, alive: true, def, id: defId,
      name: def.name, x, y, vx: 0, vy: 0,
      r: def.radius, color: def.color, glow: def.glow,
      hp: def.hp, maxHp: def.hp, sector,
      dmgMul: Math.max(1, 1 + (sector - 15) * 0.02),
      phaseIndex: 0, phase: def.phases[0],
      facing: 0, hitFlash: 0, marked: 0, vis: 1, awake: true, elite: false,
      attackCd: 1.2, atkIndex: 0,
      tele: null,            // active telegraph {type,t,dur,data,exec}
      rings: [],             // shockwaves
      addTimer: 0,
      moveT: Math.random() * 10,
      invuln: def.introInvuln || 0,
      _blackoutT: 0,
      dead: false,

      takeDamage(dmg, kx, ky, game) {
        if (!this.alive || this.invuln > 0) { Particles.burst(this.x, this.y, 2, { speed: 40, color: '#fff', life: 0.15, size: 2, kind: 'spark' }); return; }
        let d = dmg;
        if (this.marked > 0) d *= CFG.player.markDamageMul;
        this.hp -= d;
        this.hitFlash = 0.08;
        Particles.burst(this.x, this.y, 3, { speed: 90, color: this.glow, life: 0.2, size: 2.5, kind: 'spark' });
        if (this.hp <= 0) this.die(game);
      },
      onSwept(pulse, game) { this.marked = Math.max(this.marked, CFG.player.markTime); if (game.player.stats.echoDamage) this.takeDamage(game.player.stats.echoDamage, 0, 0, game); },

      die(game) {
        if (this.dead) return;
        this.dead = true; this.alive = false;
        game.echoDisabled = false;
        for (let i = 0; i < 5; i++) setTimeoutBurst(this, i);
        Particles.burst(this.x, this.y, 60, { speed: 360, color: this.glow, life: 1.2, size: 4, kind: 'spark' });
        Particles.ring(this.x, this.y, { color: this.glow, size: this.r, life: 0.9 });
        game.camera.addTrauma(0.9); game.hitStop(0.1); game.triggerSlowmo(0.9);
        game.screenFlash(this.glow, 0.3, 0.5);
        RE.Audio.sfx('boss');
        game.onEnemyKilled(this);
      },

      update(dt, game) {
        const p = game.player;
        this.moveT += dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;
        if (this.marked > 0) this.marked -= dt;
        if (this.invuln > 0) this.invuln -= dt;
        this.facing = Math.atan2(p.y - this.y, p.x - this.x);
        // echo-resonance marking from pulses
        const sw = RE.Echo.pulseSweeping(this.x, this.y, this.r);
        if (sw && this._pingedBy !== sw.id) { this._pingedBy = sw.id; this.onSwept(sw, game); }

        // phase transition
        const frac = this.hp / this.maxHp;
        while (this.phaseIndex < def.phases.length - 1 && frac <= def.phases[this.phaseIndex + 1].threshold) {
          this.phaseIndex++; this.phase = def.phases[this.phaseIndex];
          this._enterPhase(game);
        }

        // movement: hover, keep mid distance, orbit slowly
        const desired = this.phase.keepDist || 220;
        const d = M.dist(this.x, this.y, p.x, p.y);
        const orbit = Math.atan2(this.y - p.y, this.x - p.x) + 0.5 * dt;
        let tx, ty;
        if (d > desired + 60) { tx = p.x; ty = p.y; }
        else if (d < desired - 60) { tx = this.x + (this.x - p.x); ty = this.y + (this.y - p.y); }
        else { tx = p.x + Math.cos(orbit) * desired; ty = p.y + Math.sin(orbit) * desired; }
        const spd = (this.phase.moveSpeed || 60);
        this.vx = M.damp(this.vx, Math.max(-spd, Math.min(spd, (tx - this.x))), 2, dt);
        this.vy = M.damp(this.vy, Math.max(-spd, Math.min(spd, (ty - this.y))), 2, dt);
        this.x += M.clamp(this.vx, -spd, spd) * dt;
        this.y += M.clamp(this.vy, -spd, spd) * dt;
        const res = game.map.collideCircle(this.x, this.y, this.r);
        this.x = res.x; this.y = res.y;

        // adds spawner
        if (this.phase.adds) {
          this.addTimer -= dt;
          if (this.addTimer <= 0) {
            this.addTimer = this.phase.adds.every;
            // count only THIS boss's summoned adds, not the whole arena
            const alive = game.enemies.filter(e => e.isBossAdd && e.alive).length;
            if (alive < (this.phase.adds.cap || 4)) {
              for (let i = 0; i < this.phase.adds.count; i++) {
                const a = Math.random() * TAU, rr = 120 + Math.random() * 80;
                const add = game._scaleEnemy(RE.makeEnemy(this.phase.adds.id, this.x + Math.cos(a) * rr, this.y + Math.sin(a) * rr, this.sector, false));
                add.isBossAdd = true;
                game.enemies.push(add);
              }
            }
          }
        }

        // telegraph / attack cycle
        if (this.tele) {
          this.tele.t += dt;
          if (this.tele.t >= this.tele.dur) { const ex = this.tele.exec; this.tele = null; ex(game); }
        } else {
          this.attackCd -= dt;
          if (this.attackCd <= 0) this._nextAttack(game, p);
        }

        // shockwave rings
        for (let i = this.rings.length - 1; i >= 0; i--) {
          const rg = this.rings[i];
          rg.pr = rg.r; rg.r += rg.speed * dt;
          if (!rg.hit && p.alive && p.iframes <= 0) {
            const pd = M.dist(rg.x, rg.y, p.x, p.y);
            if (pd >= rg.r - rg.band && pd <= rg.r + rg.band) { rg.hit = true; game.damagePlayer(rg.dmg, { x: rg.x, y: rg.y }); }
          }
          if (rg.r > rg.max) this.rings.splice(i, 1);
        }

        // blackout upkeep (game applies echoDisabled before the player updates)
        if (this._blackoutT > 0) this._blackoutT -= dt;

        // contact damage
        if (d < this.r + p.radius && (this._contactCd = (this._contactCd || 0) - dt) <= 0) {
          this._contactCd = 0.6;
          game.damagePlayer((this.phase.contact || 14) * this.dmgMul, this);
        }

        // keep self-lit
        RE.Echo.washSoft(this.x, this.y, this.r + 40, 0.3);
      },

      _enterPhase(game) {
        RE.HUD.showBanner(this.name, this.phase.title || '', 1.6);
        RE.Audio.sfx('boss');
        game.camera.addTrauma(0.5);
        this._shockwave(game, 300, 40, 16);
        this.atkIndex = 0; this.attackCd = 1.0;
        if (this.phase.onEnter) this.phase.onEnter(this, game);
      },

      _nextAttack(game, p) {
        const atks = this.phase.attacks;
        const atk = atks[this.atkIndex % atks.length];
        this.atkIndex++;
        this.attackCd = atk.cd || 2.2;
        // start telegraph — commit the aim NOW so the tell is honest
        const dur = atk.tell != null ? atk.tell : 0.7;
        const aimAtTell = this.facing;
        this.tele = {
          type: atk.type, t: 0, dur,
          aim: aimAtTell,
          data: atk,
          exec: (g) => this._exec(atk, g, p, aimAtTell),
        };
        if (atk.type === 'sweep' || atk.type === 'gaze') this.tele.beamAngle = aimAtTell;
      },

      _exec(atk, game, p, telAim) {
        switch (atk.type) {
          case 'radial': this._radial(game, atk.count, atk.speed, atk.dmg, atk.offset || 0); break;
          case 'aimed': this._aimed(game, telAim, atk.count, atk.speed, atk.dmg, atk.spread || 0.2); break;
          case 'spiral': this._spiral(game, atk); break;
          case 'shockwave': this._shockwave(game, atk.max || 360, atk.speed || 300, atk.dmg || 18); break;
          case 'slam': this._slam(game, telAim, atk); break;
          case 'sweep': this._sweep(game, atk, telAim); break;
          case 'gaze': this._sweep(game, atk, telAim); break;
          case 'blackout': this._blackout(game, atk); break;
          case 'supernova': this._supernova(game, atk); break;
          default: break;
        }
        RE.Audio.sfx('shoot_heavy');
        game.camera.addTrauma(0.12);
      },

      _radial(game, n, speed, dmg, off) {
        dmg *= this.dmgMul;
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * TAU;
          game.spawnEnemyProjectile(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, Math.cos(a) * speed, Math.sin(a) * speed, dmg, this.glow);
        }
      },
      _aimed(game, aim, n, speed, dmg, spread) {
        dmg *= this.dmgMul;
        for (let i = 0; i < n; i++) {
          const a = aim + (n > 1 ? (i / (n - 1) - 0.5) * spread * 2 : 0);
          game.spawnEnemyProjectile(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, Math.cos(a) * speed, Math.sin(a) * speed, dmg, this.glow);
        }
      },
      _spiral(game, atk) {
        // fire a quick burst offset by moveT to create a rotating stream
        const base = this.moveT * (atk.turn || 3);
        const dmg = (atk.dmg || 10) * this.dmgMul;
        for (let k = 0; k < (atk.arms || 3); k++) {
          const a = base + k / (atk.arms || 3) * TAU;
          game.spawnEnemyProjectile(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, Math.cos(a) * (atk.speed || 180), Math.sin(a) * (atk.speed || 180), dmg, this.glow);
        }
      },
      _shockwave(game, max, speed, dmg) {
        this.rings.push({ x: this.x, y: this.y, r: this.r, pr: this.r, max, speed, dmg: dmg * this.dmgMul, band: 26, hit: false });
        Particles.ring(this.x, this.y, { color: this.glow, size: this.r, life: 0.5 });
        game.camera.addTrauma(0.15);
      },
      _slam(game, aim, atk) {
        // lunge toward the telegraphed spot then shockwave
        const dist = atk.dist || 200;
        this.x += Math.cos(aim) * dist * 0.5; this.y += Math.sin(aim) * dist * 0.5;
        const res = game.map.collideCircle(this.x, this.y, this.r); this.x = res.x; this.y = res.y;
        this._shockwave(game, atk.max || 300, atk.speed || 320, atk.dmg || 20);
      },
      _sweep(game, atk, telAim) {
        // spawn a rotating beam; start at the telegraphed angle with a short
        // grace (tick 0.2) so it never hits on its first frame.
        game.bossBeams = game.bossBeams || [];
        game.bossBeams.push({ boss: this, x: this.x, y: this.y, angle: telAim != null ? telAim : this.facing, len: atk.len || 320, arc: atk.arc || 0.32, rot: atk.rot || 1.0, life: atk.dur || 3, t: 0, dmg: (atk.dmg || 8) * this.dmgMul, color: this.glow, tick: 0.2 });
      },
      _blackout(game, atk) {
        this._blackoutT = atk.dur || 4;   // game applies echoDisabled from this
        game.player.energy = Math.min(game.player.energy, atk.drainTo != null ? atk.drainTo : game.player.energy);
        RE.HUD.showBanner('SIGHT STOLEN', '', 1.4);
        RE.Audio.sfx('boss');
      },
      _supernova(game, atk) {
        // arena fills with light-death except a safe zone hugging the boss
        this._shockwave(game, 900, 380, atk.dmg || 26);
        this._radial(game, 24, 200, 12, this.moveT);
        RE.HUD.showBanner('SUPERNOVA', 'get close', 1.6);
        game.camera.addTrauma(0.8);
      },

      visibility() { return 1; },

      render(ctx, cam, echo, player) {
        // shockwaves
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const rg of this.rings) {
          const t = rg.r / rg.max;
          ctx.strokeStyle = RE.M.rgba(this.glow, (1 - t) * 0.7);
          ctx.lineWidth = rg.band * 0.7 * (1 - t) + 2;
          ctx.beginPath(); ctx.arc(rg.x - cam.x, rg.y - cam.y, rg.r, 0, TAU); ctx.stroke();
        }
        ctx.restore();

        const sx = this.x - cam.x, sy = this.y - cam.y;
        ctx.save();
        ctx.translate(sx, sy);
        // aura — large & bright so the boss always reads against its biome
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r * 3.4);
        gr.addColorStop(0, RE.M.rgba(this.glow, 0.7));
        gr.addColorStop(0.4, RE.M.rgba(this.glow, 0.28));
        gr.addColorStop(1, RE.M.rgba(this.glow, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, this.r * 3.4, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // telegraph flash
        if (this.tele) {
          const k = this.tele.t / this.tele.dur;
          ctx.strokeStyle = RE.M.rgba('#ffffff', 0.4 + 0.4 * Math.sin(k * 20));
          ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, this.r + 6 + k * 8, 0, TAU); ctx.stroke();
          if (this.tele.type === 'aimed' || this.tele.type === 'slam') {
            ctx.strokeStyle = RE.M.rgba(this.glow, 0.5); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(this.tele.aim) * 400, Math.sin(this.tele.aim) * 400); ctx.stroke();
          } else if (this.tele.type === 'sweep' || this.tele.type === 'gaze') {
            const atk = this.tele.data, len = atk.len || 320, arc = atk.arc || 0.32, ang = this.tele.beamAngle;
            const flick = 0.18 + 0.12 * Math.sin(k * 22);
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = RE.M.rgba(this.glow, flick);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, len, ang - arc / 2, ang + arc / 2); ctx.closePath(); ctx.fill();
            // bright edges so the beam's path reads clearly
            ctx.strokeStyle = RE.M.rgba('#ffffff', 0.5 + 0.3 * Math.sin(k * 22)); ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang - arc / 2) * len, Math.sin(ang - arc / 2) * len);
            ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang + arc / 2) * len, Math.sin(ang + arc / 2) * len);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
          }
        }

        ctx.rotate(this.moveT * 0.4);
        const flash = this.hitFlash > 0 || this.invuln > 0;
        ctx.fillStyle = flash ? '#fff' : this.color;
        ctx.strokeStyle = this.glow; ctx.lineWidth = 2.5;
        // core body: layered polygon
        const spikes = def.spikes || 8;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const a = (i / (spikes * 2)) * TAU;
          const rad = (i % 2 === 0) ? this.r : this.r * 0.7;
          const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.strokeStyle = this.glow; ctx.lineWidth = 3; ctx.stroke();
        // inner eye (pulsing core)
        ctx.globalCompositeOperation = 'lighter';
        const corePulse = 0.7 + 0.3 * Math.sin(this.moveT * 5);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, this.r * 0.42 * corePulse, 0, TAU); ctx.fill();
        ctx.fillStyle = RE.M.rgba(this.glow, 0.8);
        ctx.beginPath(); ctx.arc(0, 0, this.r * 0.6, 0, TAU); ctx.fill();
        ctx.restore();
      },
    };
    return b;
  }

  function setTimeoutBurst(b, i) {
    // deterministic-ish staggered death burst (no timers in headless dependence)
    Particles.burst(b.x + (Math.random() - 0.5) * b.r, b.y + (Math.random() - 0.5) * b.r, 12, { speed: 200, color: b.glow, life: 0.8, size: 3, kind: 'spark' });
  }

  RE.makeBoss = makeBoss;
})(window.RE = window.RE || {});
