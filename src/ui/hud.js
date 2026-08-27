/* RoboExplore — heads-up display drawn to the canvas each frame. */
(function (RE) {
  'use strict';
  const M = RE.M;

  const HUD = {
    // Toast messages (log fragments, pickups, tips).
    toasts: [],
    banner: null,

    reset() { this.toasts.length = 0; this.banner = null; },

    toast(text, opts) {
      opts = opts || {};
      this.toasts.push({ text, t: 0, life: opts.life || 3.2, color: opts.color || '#cfe9ff', big: opts.big });
      if (this.toasts.length > 5) this.toasts.shift();
    },

    showBanner(title, subtitle, life) {
      this.banner = { title, subtitle: subtitle || '', t: 0, life: life || 2.6 };
    },

    update(dt) {
      for (let i = this.toasts.length - 1; i >= 0; i--) {
        this.toasts[i].t += dt;
        if (this.toasts[i].t >= this.toasts[i].life) this.toasts.splice(i, 1);
      }
      if (this.banner) { this.banner.t += dt; if (this.banner.t >= this.banner.life) this.banner = null; }
    },

    render(ctx, game) {
      const W = RE.CFG.viewW, H = RE.CFG.viewH;
      const p = game.player;
      if (!p) return;
      ctx.save();

      // Low-energy / low-hull vignette.
      const hullFrac = p.hull / p.hullMax;
      const enFrac = p.energy / p.energyMax;
      if (hullFrac < 0.35 || enFrac < 0.2) {
        const danger = Math.max(1 - hullFrac / 0.35, 0) * 0.5;
        const pulse = 0.5 + 0.5 * Math.sin(game.time * 6);
        const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, `rgba(${hullFrac < 0.35 ? 180 : 40},30,60,${(0.25 + danger) * (0.6 + 0.4 * pulse)})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
      }

      // --- Bottom-left status cluster ---
      const bx = 18, by = H - 64;
      // Hull bar
      this._bar(ctx, bx, by, 210, 14, hullFrac, '#ff4d6d', '#ff97ac', 'HULL', Math.ceil(p.hull) + '/' + p.hullMax);
      // Energy bar
      this._bar(ctx, bx, by + 22, 210, 14, enFrac, '#2db6ff', '#9fe4ff', 'ENERGY', Math.ceil(p.energy) + '/' + p.energyMax);

      // Echo cooldown pip
      const echoFrac = 1 - M.clamp(p.echoCd / RE.CFG.player.echoCooldown, 0, 1);
      this._pip(ctx, bx + 232, by + 4, 16, echoFrac, '#8ef', 'E');
      const dashFrac = 1 - M.clamp(p.dashCd / (RE.CFG.player.dashCooldown * p.stats.dashCdMul), 0, 1);
      this._pip(ctx, bx + 268, by + 4, 16, dashFrac, '#7dd', '⇢');

      // --- Top-left: sector / biome ---
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#cfe9ff';
      ctx.fillText(`SECTOR ${game.sector}`, 18, 14);
      ctx.font = '12px monospace';
      ctx.fillStyle = 'rgba(160,200,230,0.7)';
      ctx.fillText(game.biome ? game.biome.name : '', 18, 33);

      // --- Top-right: salvage / shards / score ---
      ctx.textAlign = 'right';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#ffe27a';
      ctx.fillText(`◈ ${game.salvage}`, W - 18, 14);
      ctx.fillStyle = '#c0a0ff';
      ctx.font = '12px monospace';
      ctx.fillText(`✦ ${RE.Save.data.coreShards + game.runShards}`, W - 18, 34);
      ctx.fillStyle = 'rgba(200,220,240,0.65)';
      ctx.fillText(`SCORE ${game.score}`, W - 18, 50);

      // --- Loadout icons (bottom-right) ---
      this._loadout(ctx, game, W - 18, H - 30);

      // --- Boss health bar ---
      if (game.boss && game.boss.alive) this._bossBar(ctx, game.boss, W, H, game);

      // --- Enemies remaining hint (subtle) ---
      // (kept minimal to preserve tension)

      // --- Banner ---
      if (this.banner) this._banner(ctx, W, H);

      // --- Toasts (center-bottom stack) ---
      this._toasts(ctx, W, H, game);

      // FPS
      if (RE.CFG.debug.fps || RE.Save.data.settings.showFps) {
        ctx.textAlign = 'left'; ctx.fillStyle = '#6f8'; ctx.font = '11px monospace';
        ctx.fillText(`${game.fps | 0} fps  e:${game.enemies.length} p:${game.projectiles.length}`, 18, H - 16);
      }

      ctx.restore();
    },

    _bar(ctx, x, y, w, h, frac, c1, c2, label, valText) {
      frac = M.clamp(frac, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      this._roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      this._roundRect(ctx, x, y, w, h, 3); ctx.fill();
      const grad = ctx.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, c1); grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      this._roundRect(ctx, x, y, Math.max(0, w * frac), h, 3); ctx.fill();
      ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(label, x + 5, y + h / 2 + 0.5);
      ctx.textAlign = 'right';
      ctx.fillText(valText, x + w - 5, y + h / 2 + 0.5);
    },

    _pip(ctx, x, y, r, frac, color, glyph) {
      ctx.save();
      ctx.translate(x + r, y + r);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = frac >= 1 ? color : 'rgba(255,255,255,0.4)';
      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(glyph, 0, 1);
      ctx.restore();
    },

    _loadout(ctx, game, x, y) {
      const p = game.player;
      const slots = ['weapon', 'mobility', 'utility', 'defense'];
      const icons = { weapon: '⚔', mobility: '⇢', utility: '⚙', defense: '◈' };
      const size = 22, gap = 6;
      let cx = x - (size + gap) * slots.length + gap;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const slot of slots) {
        const id = p.modules[slot];
        ctx.fillStyle = id ? 'rgba(40,70,90,0.7)' : 'rgba(30,30,40,0.4)';
        this._roundRect(ctx, cx, y - size, size, size, 4); ctx.fill();
        ctx.strokeStyle = id ? 'rgba(140,220,255,0.6)' : 'rgba(120,120,140,0.3)';
        ctx.lineWidth = 1; ctx.stroke();
        ctx.font = '12px monospace';
        ctx.fillStyle = id ? '#cfe9ff' : 'rgba(120,120,140,0.5)';
        ctx.fillText(icons[slot], cx + size / 2, y - size / 2 + 1);
        cx += size + gap;
      }
    },

    _bossBar(ctx, boss, W, H, game) {
      const w = W * 0.6, x = (W - w) / 2, y = 24;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#ff9aa8';
      ctx.fillText(boss.name || 'GUARDIAN', W / 2, y - 4);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      this._roundRect(ctx, x - 2, y - 2, w + 4, 12, 4); ctx.fill();
      const frac = M.clamp(boss.hp / boss.maxHp, 0, 1);
      const grad = ctx.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, '#ff2d55'); grad.addColorStop(1, '#ff9a3f');
      ctx.fillStyle = grad;
      this._roundRect(ctx, x, y, w * frac, 8, 3); ctx.fill();
    },

    _banner(ctx, W, H) {
      const b = this.banner;
      const t = b.t / b.life;
      let a = 1;
      if (t < 0.15) a = t / 0.15;
      else if (t > 0.7) a = 1 - (t - 0.7) / 0.3;
      ctx.globalAlpha = M.clamp(a, 0, 1);
      ctx.textAlign = 'center';
      ctx.font = 'bold 34px monospace';
      ctx.fillStyle = '#cfe9ff';
      ctx.shadowColor = '#2db6ff'; ctx.shadowBlur = 20;
      ctx.fillText(b.title, W / 2, H * 0.36);
      ctx.shadowBlur = 0;
      if (b.subtitle) {
        ctx.font = '15px monospace';
        ctx.fillStyle = 'rgba(180,210,235,0.8)';
        ctx.fillText(b.subtitle, W / 2, H * 0.36 + 28);
      }
      ctx.globalAlpha = 1;
    },

    _toasts(ctx, W, H, game) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let y = H * 0.66;
      for (let i = 0; i < this.toasts.length; i++) {
        const t = this.toasts[i];
        const k = t.t / t.life;
        let a = 1;
        if (k < 0.1) a = k / 0.1; else if (k > 0.75) a = 1 - (k - 0.75) / 0.25;
        ctx.globalAlpha = M.clamp(a, 0, 1);
        ctx.font = (t.big ? 'bold 16px' : '13px') + ' monospace';
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, W / 2, y);
        y += 22;
      }
      ctx.globalAlpha = 1;
    },

    _roundRect(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },
  };

  RE.HUD = HUD;
})(window.RE = window.RE || {});
