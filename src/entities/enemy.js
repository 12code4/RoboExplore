/* RoboExplore — enemies with echo-aware AI.
 * Enemies are shadows until echo/light touches them. A pulse "pings" them,
 * revealing them for a while and (for most) waking them. The Lurker is fully
 * invisible until pinged, then lunges.
 */
(function (RE) {
  'use strict';
  const M = RE.M, Particles = RE.Particles;

  function makeEnemy(defId, x, y, sector) {
    const def = RE.ENEMIES[defId];
    const sc = 1 + (sector - 1) * 0.06; // gentle stat scaling with depth
    const e = {
      type: 'enemy',
      def, id: defId, alive: true,
      x, y, vx: 0, vy: 0,
      r: def.radius,
      hp: Math.round(def.hp * sc), maxHp: Math.round(def.hp * sc),
      speed: def.speed, accel: def.accel || 800,
      facing: Math.random() * Math.PI * 2,
      awake: false,
      revealT: 0,              // seconds remaining fully-revealed (from a ping)
      state: 'idle',
      stateT: 0,
      fireCd: (def.fireCd || 1) * (0.5 + Math.random() * 0.5),
      touchCd: 0,
      hitFlash: 0,
      knockx: 0, knocky: 0,
      orbitDir: Math.random() < 0.5 ? 1 : -1,
      wobble: Math.random() * Math.PI * 2,
      sector,
      damageMul: sc,

      takeDamage(dmg, kx, ky, game) {
        if (!this.alive) return;
        this.hp -= dmg;
        this.hitFlash = 0.12;
        this.awake = true;
        this.revealT = Math.max(this.revealT, 0.5);
        const km = 1;
        this.vx += (kx || 0) * km;
        this.vy += (ky || 0) * km;
        Particles.burst(this.x, this.y, 4, { speed: 90, color: def.glow, life: 0.25, size: 2.5, kind: 'spark' });
        if (this.hp <= 0) this.die(game);
      },

      die(game) {
        if (!this.alive) return;
        this.alive = false;
        RE.Audio.sfx('enemy_die');
        Particles.burst(this.x, this.y, 18, { speed: 200, color: def.glow, life: 0.6, size: 3.4, kind: 'spark' });
        Particles.burst(this.x, this.y, 10, { speed: 90, color: def.color, life: 0.5, size: 3, kind: 'dot' });
        Particles.ring(this.x, this.y, { color: def.glow, size: this.r, life: 0.4 });
        game.camera.addTrauma(0.12);
        game.onEnemyKilled(this);
      },

      _ping() {
        if (!this.revealT) {
          Particles.ring(this.x, this.y, { color: def.glow, size: this.r + 3, life: 0.35 });
        }
        this.revealT = Math.max(this.revealT, RE.Echo.hold * 0.7);
        if (def.wakeOnPing) this.awake = true;
      },

      update(dt, game) {
        const p = game.player;
        this.stateT += dt;
        this.wobble += dt * 3;
        if (this.hitFlash > 0) this.hitFlash -= dt;
        if (this.revealT > 0) this.revealT -= dt;
        if (this.touchCd > 0) this.touchCd -= dt;

        // Echo ping detection.
        const sweep = RE.Echo.pulseSweeping(this.x, this.y, this.r);
        if (sweep) this._ping();

        // Passive light also reveals.
        const light = RE.Echo.lightAt(this.x, this.y, p);
        if (light > 0.5) { this.revealT = Math.max(this.revealT, 0.12); if (def.wakeOnPing) this.awake = true; }

        if (!p || !p.alive) { this._friction(dt); this._integrate(dt, game); return; }

        const dToPlayer = M.dist(this.x, this.y, p.x, p.y);
        // Wake if player is close.
        if (!this.awake && dToPlayer < def.sight * 0.55) this.awake = true;

        // AI dispatch.
        switch (def.ai) {
          case 'chaser':   this._aiChaser(dt, game, p, dToPlayer); break;
          case 'ranged':   this._aiRanged(dt, game, p, dToPlayer); break;
          case 'ambusher': this._aiAmbusher(dt, game, p, dToPlayer); break;
          case 'orbiter':  this._aiOrbiter(dt, game, p, dToPlayer); break;
          default:         this._aiChaser(dt, game, p, dToPlayer); break;
        }

        this._separate(dt, game);
        this._integrate(dt, game);

        // Contact damage.
        if (dToPlayer < this.r + p.radius && this.touchCd <= 0) {
          if (game.damagePlayer(def.touchDamage * this.damageMul, this)) {
            this.touchCd = RE.CFG.player.contactDamageCd;
            const a = Math.atan2(this.y - p.y, this.x - p.x);
            this.vx += Math.cos(a) * 160;
            this.vy += Math.sin(a) * 160;
          }
        }
      },

      _steerTo(tx, ty, dt, mul) {
        const a = Math.atan2(ty - this.y, tx - this.x);
        this.facing = a;
        const spd = this.speed * (mul || 1);
        const dvx = Math.cos(a) * spd, dvy = Math.sin(a) * spd;
        this.vx = M.damp(this.vx, dvx, 6, dt);
        this.vy = M.damp(this.vy, dvy, 6, dt);
      },

      _aiChaser(dt, game, p, d) {
        if (!this.awake) { this._friction(dt); return; }
        if (d < def.sight) this._steerTo(p.x, p.y, dt);
        else this._friction(dt);
      },

      _aiRanged(dt, game, p, d) {
        if (!this.awake) { this._friction(dt); return; }
        const keep = def.keepDist || 190;
        const hasLOS = game.map.hasLOS(this.x, this.y, p.x, p.y);
        if (d < keep * 0.8) {
          // back away
          const a = Math.atan2(this.y - p.y, this.x - p.x);
          this._steerTo(this.x + Math.cos(a) * 60, this.y + Math.sin(a) * 60, dt, 0.9);
        } else if (d > keep * 1.4) {
          this._steerTo(p.x, p.y, dt, 0.8);
        } else {
          // strafe
          const a = Math.atan2(p.y - this.y, p.x - this.x) + Math.PI / 2 * this.orbitDir;
          this._steerTo(this.x + Math.cos(a) * 40, this.y + Math.sin(a) * 40, dt, 0.5);
          this.facing = Math.atan2(p.y - this.y, p.x - this.x);
        }
        this.fireCd -= dt;
        if (this.fireCd <= 0 && d < (def.range || 300) && hasLOS) {
          this.fireCd = def.fireCd;
          this._fire(game, p);
        }
      },

      _aiAmbusher(dt, game, p, d) {
        // Invisible & still until pinged/awake; then lunge in bursts.
        if (!this.awake) { this._friction(dt); this.state = 'hide'; return; }
        if (this.state === 'hide' || this.state === 'idle') { this.state = 'wind'; this.stateT = 0; }
        if (this.state === 'wind') {
          this._friction(dt);
          this.facing = Math.atan2(p.y - this.y, p.x - this.x);
          if (this.stateT > 0.35) { this.state = 'lunge'; this.stateT = 0;
            const a = this.facing;
            this.vx = Math.cos(a) * this.speed * 2.4;
            this.vy = Math.sin(a) * this.speed * 2.4;
            RE.Audio.sfx('dash');
          }
        } else if (this.state === 'lunge') {
          if (this.stateT > 0.45) { this.state = 'recover'; this.stateT = 0; }
        } else if (this.state === 'recover') {
          this._friction(dt);
          if (this.stateT > 0.7) { this.state = 'wind'; this.stateT = 0; }
        }
      },

      _aiOrbiter(dt, game, p, d) {
        if (!this.awake) { this._friction(dt); return; }
        const orbit = def.orbitDist || 170;
        const ang = Math.atan2(this.y - p.y, this.x - p.x);
        const targetAng = ang + this.orbitDir * 0.9 * dt * (this.speed / orbit);
        const tx = p.x + Math.cos(targetAng) * orbit;
        const ty = p.y + Math.sin(targetAng) * orbit;
        this._steerTo(tx, ty, dt, 1);
        this.facing = Math.atan2(p.y - this.y, p.x - this.x);
        this.fireCd -= dt;
        if (this.fireCd <= 0 && d < (def.range || 320) && game.map.hasLOS(this.x, this.y, p.x, p.y)) {
          this.fireCd = def.fireCd;
          this._fire(game, p);
        }
      },

      _fire(game, p) {
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        const spd = def.projSpeed || 240;
        game.spawnEnemyProjectile(
          this.x + Math.cos(a) * (this.r + 4),
          this.y + Math.sin(a) * (this.r + 4),
          Math.cos(a) * spd, Math.sin(a) * spd,
          (def.projDamage || 8) * this.damageMul, def.glow
        );
        RE.Audio.sfx('shoot_heavy');
        Particles.burst(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, 3,
          { speed: 80, color: def.glow, life: 0.2, size: 2, dir: a, spread: 0.6, kind: 'spark' });
      },

      _friction(dt) {
        const d = Math.exp(-4 * dt);
        this.vx *= d; this.vy *= d;
      },

      // Soft separation so enemies don't stack.
      _separate(dt, game) {
        let px = 0, py = 0, n = 0;
        for (const o of game.enemies) {
          if (o === this || !o.alive) continue;
          const dx = this.x - o.x, dy = this.y - o.y;
          const d2 = dx * dx + dy * dy;
          const rr = (this.r + o.r) * 1.05;
          if (d2 > 0 && d2 < rr * rr) {
            const d = Math.sqrt(d2);
            px += (dx / d) * (rr - d);
            py += (dy / d) * (rr - d);
            n++;
          }
        }
        if (n) { this.vx += px * 6 * dt / n; this.vy += py * 6 * dt / n; }
      },

      _integrate(dt, game) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        const res = game.map.collideCircle(this.x, this.y, this.r);
        this.x = res.x; this.y = res.y;
        if (res.hitX) this.vx *= -0.3;
        if (res.hitY) this.vy *= -0.3;
      },

      // Visibility: revealed by ping timer or ambient light. Awake enemies
      // have a faint self-glow so combat stays readable once engaged.
      visibility(player) {
        if (RE.CFG.debug && RE.CFG.debug.revealAll) return 1;
        const light = RE.Echo.lightAt(this.x, this.y, player);
        let v = light;
        if (this.revealT > 0) v = Math.max(v, Math.min(1, this.revealT / (RE.Echo.hold * 0.7)));
        if (this.awake && !this.def.invisibleUntilPinged) v = Math.max(v, 0.16);
        return v;
      },

      render(ctx, cam, echo, player) {
        const vis = this.visibility(player);
        if (vis < 0.04) return;
        const sx = this.x - cam.x, sy = this.y - cam.y;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.globalAlpha = vis;

        // outer glow
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r * 2.4);
        gr.addColorStop(0, RE.M.rgba(this.def.glow, 0.4 * vis));
        gr.addColorStop(1, RE.M.rgba(this.def.glow, 0));
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(0, 0, this.r * 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        ctx.rotate(this.facing);
        const flash = this.hitFlash > 0;
        const body = flash ? '#ffffff' : this.def.color;

        // body per archetype
        ctx.fillStyle = body;
        ctx.strokeStyle = RE.M.rgba(this.def.glow, 0.9);
        ctx.lineWidth = 1.5;
        if (this.def.ai === 'chaser') this._drawSpider(ctx);
        else if (this.def.ai === 'ranged') this._drawSpitter(ctx);
        else if (this.def.ai === 'ambusher') this._drawLurker(ctx, vis);
        else if (this.def.ai === 'orbiter') this._drawDrone(ctx);
        else this._drawSpider(ctx);

        // eye
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = flash ? '#fff' : this.def.glow;
        ctx.beginPath(); ctx.arc(this.r * 0.4, 0, this.r * 0.28, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // hp bar when hurt & visible
        if (this.hp < this.maxHp && vis > 0.3) {
          const w = this.r * 2.2, h = 3;
          ctx.globalAlpha = vis;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(sx - w / 2, sy - this.r - 9, w, h);
          ctx.fillStyle = this.def.glow;
          ctx.fillRect(sx - w / 2, sy - this.r - 9, w * (this.hp / this.maxHp), h);
          ctx.globalAlpha = 1;
        }
      },

      _drawSpider(ctx) {
        const r = this.r;
        // legs
        ctx.strokeStyle = this.def.color; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.sin(this.wobble + i) * 0.2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6);
          ctx.stroke();
        }
        ctx.fillStyle = this.def.color;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.stroke();
      },
      _drawSpitter(ctx) {
        const r = this.r;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r * 0.7, r * 0.9);
        ctx.lineTo(-r * 0.4, 0);
        ctx.lineTo(-r * 0.7, -r * 0.9);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      },
      _drawLurker(ctx, vis) {
        const r = this.r;
        // jagged blade-like form
        ctx.beginPath();
        const spikes = 7;
        for (let i = 0; i < spikes * 2; i++) {
          const a = (i / (spikes * 2)) * Math.PI * 2;
          const rad = (i % 2 === 0) ? r * 1.3 : r * 0.6;
          const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      },
      _drawDrone(ctx) {
        const r = this.r;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + this.wobble * 0.3;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      },
    };
    return e;
  }

  RE.makeEnemy = makeEnemy;
})(window.RE = window.RE || {});
