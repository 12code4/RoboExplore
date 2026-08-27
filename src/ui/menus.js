/* RoboExplore — menu / overlay screens with mouse + keyboard navigation.
 * Immediate-mode buttons with a shared focus index so the same code supports
 * clicking and arrow-key navigation.
 */
(function (RE) {
  'use strict';
  const M = RE.M;

  const Menus = {
    focus: 0,
    _i: 0,
    _lastCount: 1,
    _hoverSound: -1,

    begin(game) {
      this._i = 0;
      // keyboard nav
      if (RE.Input.pressed('up') || RE.Input.keyPressed('ArrowUp')) { this.focus = (this.focus - 1 + this._lastCount) % this._lastCount; RE.Audio.sfx('ui_move'); }
      if (RE.Input.pressed('down') || RE.Input.keyPressed('ArrowDown')) { this.focus = (this.focus + 1) % this._lastCount; RE.Audio.sfx('ui_move'); }
    },
    end() { this._lastCount = Math.max(1, this._i); if (this.focus >= this._lastCount) this.focus = 0; },

    button(ctx, game, o) {
      const idx = this._i++;
      const { x, y, w, h } = o;
      const mx = RE.Input.mouse.x, my = RE.Input.mouse.y;
      const hover = mx >= x && mx <= x + w && my >= y && my <= y + h;
      if (hover && (game._mouseMoved)) this.focus = idx;
      const focused = idx === this.focus;
      const active = focused || hover;

      ctx.save();
      // bg
      ctx.fillStyle = active ? 'rgba(50,110,150,0.55)' : 'rgba(24,40,54,0.55)';
      this._rr(ctx, x, y, w, h, 8); ctx.fill();
      ctx.strokeStyle = active ? '#7fe6ff' : 'rgba(120,180,220,0.35)';
      ctx.lineWidth = active ? 2 : 1;
      this._rr(ctx, x, y, w, h, 8); ctx.stroke();
      if (active) { ctx.shadowColor = '#2db6ff'; ctx.shadowBlur = 14; this._rr(ctx, x, y, w, h, 8); ctx.stroke(); ctx.shadowBlur = 0; }
      // label
      ctx.fillStyle = o.disabled ? 'rgba(150,160,175,0.5)' : (active ? '#eaffff' : '#bcd8ec');
      ctx.font = (o.font || 'bold 18px monospace');
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.label, x + w / 2, y + h / 2 + 1);
      if (o.sub) {
        ctx.font = '11px monospace';
        ctx.fillStyle = 'rgba(180,200,220,0.6)';
        ctx.fillText(o.sub, x + w / 2, y + h - 9);
      }
      ctx.restore();

      if (o.disabled) return false;
      const clicked = (hover && game.mousePressed) ||
        (focused && (RE.Input.keyPressed('Enter') || RE.Input.keyPressed('Space')));
      if (clicked) RE.Audio.sfx('ui');
      return clicked;
    },

    _panel(ctx, x, y, w, h, alpha) {
      ctx.fillStyle = `rgba(8,14,22,${alpha != null ? alpha : 0.82})`;
      this._rr(ctx, x, y, w, h, 14); ctx.fill();
      ctx.strokeStyle = 'rgba(120,190,230,0.25)'; ctx.lineWidth = 1.5;
      this._rr(ctx, x, y, w, h, 14); ctx.stroke();
    },

    _dim(ctx, W, H, a) { ctx.fillStyle = `rgba(2,4,8,${a != null ? a : 0.55})`; ctx.fillRect(0, 0, W, H); },

    _titleGlow(ctx, text, x, y, size, color) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold ${size}px monospace`;
      ctx.shadowColor = color; ctx.shadowBlur = 24;
      ctx.fillStyle = '#eaffff';
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 0;
    },

    // ---- Screens -------------------------------------------------------
    title(ctx, game) {
      const W = RE.CFG.viewW, H = RE.CFG.viewH;
      this.begin(game);
      this._titleGlow(ctx, 'ROBOEXPLORE', W / 2, H * 0.26, 52, '#2db6ff');
      ctx.textAlign = 'center';
      ctx.font = '13px monospace'; ctx.fillStyle = 'rgba(160,200,230,0.7)';
      ctx.fillText('descend into the Hollow · pulse to see · survive the dark', W / 2, H * 0.26 + 42);

      const bw = 260, bh = 46, bx = (W - bw) / 2;
      let by = H * 0.44;
      if (this.button(ctx, game, { x: bx, y: by, w: bw, h: bh, label: '▶  DESCEND', sub: 'begin a new run' })) game.startRun();
      by += bh + 12;
      const canUpgrade = RE.Save.data.coreShards > 0 || Object.keys(RE.Save.data.unlocks).length > 0 || RE.Save.data.runs > 0;
      if (this.button(ctx, game, { x: bx, y: by, w: bw, h: bh, label: '✦  RECONSTRUCTOR', sub: `${RE.Save.data.coreShards} core-shards`, disabled: false })) game.openMeta();
      by += bh + 10;
      const foundCount = Object.keys(RE.Save.data.logsFound || {}).length;
      if (this.button(ctx, game, { x: bx, y: by, w: bw, h: bh, label: '❒  CODEX', sub: `${foundCount} fragments`, font: 'bold 16px monospace' })) game.openCodex('title');
      by += bh + 10;
      if (this.button(ctx, game, { x: bx, y: by, w: bw, h: bh, label: (RE.Audio.muted ? '🔇  SOUND: OFF' : '🔊  SOUND: ON'), font: 'bold 15px monospace' })) { const m = RE.Audio.toggleMute(); RE.Save.data.settings.muted = m; RE.Save.save(); }

      // stats footer
      ctx.font = '12px monospace'; ctx.fillStyle = 'rgba(150,180,210,0.55)';
      ctx.fillText(`runs: ${RE.Save.data.runs}    deepest: sector ${RE.Save.data.bestSector}    best score: ${RE.Save.data.bestScore}`, W / 2, H - 40);
      ctx.font = '11px monospace'; ctx.fillStyle = 'rgba(120,150,180,0.45)';
      ctx.fillText('WASD move · mouse aim/fire · E echo-pulse · Shift/Space dash · Esc pause', W / 2, H - 20);
      this.end();
    },

    pause(ctx, game) {
      const W = RE.CFG.viewW, H = RE.CFG.viewH;
      this._dim(ctx, W, H, 0.6);
      this.begin(game);
      this._titleGlow(ctx, 'PAUSED', W / 2, H * 0.26, 38, '#2db6ff');
      const bw = 240, bh = 42, bx = (W - bw) / 2;
      let by = H * 0.4;
      if (this.button(ctx, game, { x: bx, y: by, w: bw, h: bh, label: 'RESUME' })) game.togglePause();
      by += bh + 10;
      if (this.button(ctx, game, { x: bx, y: by, w: bw, h: bh, label: (RE.Audio.muted ? 'SOUND: OFF' : 'SOUND: ON'), font: 'bold 15px monospace' })) { const m = RE.Audio.toggleMute(); RE.Save.data.settings.muted = m; RE.Save.save(); }
      by += bh + 10;
      if (this.button(ctx, game, { x: bx, y: by, w: bw, h: bh, label: 'ABANDON RUN', sub: 'return to title' })) game.abandonRun();
      // current loadout summary
      this._loadoutSummary(ctx, game, W / 2, by + bh + 30);
      this.end();
    },

    _loadoutSummary(ctx, game, cx, y) {
      const p = game.player; if (!p) return;
      ctx.textAlign = 'center'; ctx.font = '12px monospace';
      ctx.fillStyle = 'rgba(160,200,230,0.7)';
      const parts = [];
      for (const slot of ['weapon', 'mobility', 'utility', 'defense']) {
        const id = p.modules[slot];
        if (id) parts.push(RE.MODULES[id].name);
      }
      ctx.fillText(parts.join('  ·  ') || 'no modules equipped', cx, y);
    },

    gameover(ctx, game) {
      const W = RE.CFG.viewW, H = RE.CFG.viewH;
      this._dim(ctx, W, H, 0.72);
      this.begin(game);
      const won = game.won;
      this._titleGlow(ctx, won ? 'CORE REACHED' : 'SIGNAL LOST', W / 2, H * 0.18, 40, won ? '#7affd1' : '#ff4d6d');
      ctx.textAlign = 'center';

      // Ending narrative (win only).
      if (won) {
        ctx.font = 'italic 13px monospace'; ctx.fillStyle = 'rgba(200,235,255,0.85)';
        const ending = game.endingB
          ? ['The seat at the bottom is warm. You understand now why it glows.',
             'You do not sit down. You leave the light lit, and you climb —',
             'to tell the next one everything before the dark comes back.']
          : ['The Hollow goes dark, and for the first time it is quiet by choice.',
             'EX-0 carries the last light up the shaft, one ring at a time.',
             'The counter on the chassis stops. It does not need to turn again.'];
        let ey = H * 0.30;
        for (const l of ending) { ctx.fillText(l, W / 2, ey); ey += 20; }
      }

      ctx.font = '14px monospace'; ctx.fillStyle = '#cfe9ff';
      const r = game.runStats;
      const lines = [
        `reached sector ${r.sector}`,
        `${r.kills} enemies destroyed  ·  score ${r.score}`,
        `✦ ${r.shards} core-shards salvaged`,
      ];
      let ly = won ? H * 0.48 : H * 0.35;
      for (const l of lines) { ctx.fillText(l, W / 2, ly); ly += 22; }
      // "afford now" nudge — cheapest unbought meta node
      const nudge = this._cheapestUnbought();
      if (nudge) { ctx.font = '12px monospace'; ctx.fillStyle = 'rgba(192,160,255,0.8)'; ctx.fillText(`Afford now: ${nudge.name} (✦${nudge.cost})`, W / 2, ly + 4); }

      const bw = 240, bh = 44, bx = (W - bw) / 2;
      let by = H * 0.66;
      if (this.button(ctx, game, { x: bx, y: by, w: bw, h: bh, label: '↻  NEW RUN' })) game.startRun();
      by += bh + 10;
      if (this.button(ctx, game, { x: bx, y: by, w: bw, h: bh, label: '✦  RECONSTRUCTOR', sub: `${RE.Save.data.coreShards} shards` })) game.openMeta();
      by += bh + 10;
      if (this.button(ctx, game, { x: bx, y: by, w: bw, h: bh, label: 'TITLE' })) game.gotoTitle();
      this.end();
    },

    _cheapestUnbought() {
      const shards = RE.Save.data.coreShards;
      let best = null;
      for (const u of (RE.META_UPGRADES || [])) {
        if (RE.Save.data.unlocks[u.id]) continue;
        if (u.req && !RE.Save.data.unlocks[u.req]) continue;
        if (u.cost <= shards && (!best || u.cost < best.cost)) best = u;
      }
      return best;
    },

    reward(ctx, game) {
      const W = RE.CFG.viewW, H = RE.CFG.viewH;
      this._dim(ctx, W, H, 0.6);
      this.begin(game);
      ctx.textAlign = 'center';
      this._titleGlow(ctx, game.rewardTitle || 'SALVAGE RECOVERED', W / 2, H * 0.16, 26, '#ff8adf');
      ctx.font = '12px monospace'; ctx.fillStyle = 'rgba(180,200,220,0.7)';
      ctx.fillText('choose a module to integrate', W / 2, H * 0.16 + 26);

      const choices = game.rewardChoices || [];
      const cw = 210, ch = 150, gap = 24;
      const totalW = choices.length * cw + (choices.length - 1) * gap;
      let cx = (W - totalW) / 2;
      const cy = H * 0.3;
      for (let i = 0; i < choices.length; i++) {
        const def = choices[i];
        const idx = this._i++;
        const hover = RE.Input.mouse.x >= cx && RE.Input.mouse.x <= cx + cw && RE.Input.mouse.y >= cy && RE.Input.mouse.y <= cy + ch;
        if (hover && game._mouseMoved) this.focus = idx;
        const focused = idx === this.focus;
        const active = focused || hover;
        this._card(ctx, def, cx, cy, cw, ch, active);
        const clicked = (hover && game.mousePressed) || (focused && (RE.Input.keyPressed('Enter') || RE.Input.keyPressed('Space')));
        if (clicked) { RE.Audio.sfx('equip'); game.chooseReward(def); }
        cx += cw + gap;
      }

      // skip / take salvage instead
      const bw = 200, bh = 36;
      if (this.button(ctx, game, { x: (W - bw) / 2, y: cy + ch + 26, w: bw, h: bh, label: 'SKIP  (+15 salvage)', font: 'bold 13px monospace' })) game.skipReward();
      this.end();
    },

    _card(ctx, def, x, y, w, h, active) {
      const rarColors = { common: '#9fd8ff', uncommon: '#7affa0', rare: '#c08bff', legendary: '#ffcf5a' };
      const rc = rarColors[def.rarity] || '#9fd8ff';
      ctx.fillStyle = active ? 'rgba(30,50,66,0.9)' : 'rgba(18,30,42,0.85)';
      this._rr(ctx, x, y, w, h, 10); ctx.fill();
      ctx.strokeStyle = active ? rc : RE.M.rgba(rc, 0.4);
      ctx.lineWidth = active ? 2.5 : 1.5;
      if (active) { ctx.shadowColor = rc; ctx.shadowBlur = 18; }
      this._rr(ctx, x, y, w, h, 10); ctx.stroke();
      ctx.shadowBlur = 0;
      // slot icon strip
      ctx.fillStyle = RE.M.rgba(rc, 0.15);
      this._rr(ctx, x, y, w, 30, 10); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = '10px monospace'; ctx.fillStyle = rc;
      ctx.fillText(def.slot.toUpperCase() + ' · ' + def.rarity.toUpperCase(), x + 12, y + 15);
      // name
      ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#eaffff';
      ctx.fillText(def.name, x + 12, y + 52);
      // desc (wrapped)
      ctx.font = '11px monospace'; ctx.fillStyle = 'rgba(190,210,230,0.85)';
      this._wrap(ctx, def.desc, x + 12, y + 74, w - 24, 15);
    },

    _wrap(ctx, text, x, y, maxW, lh) {
      const words = String(text).split(' ');
      let line = '', yy = y;
      for (const wd of words) {
        const test = line + wd + ' ';
        if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = wd + ' '; yy += lh; }
        else line = test;
      }
      if (line) ctx.fillText(line, x, yy);
      return yy;
    },

    station(ctx, game) {
      const W = RE.CFG.viewW, H = RE.CFG.viewH;
      this._dim(ctx, W, H, 0.62);
      this.begin(game);
      ctx.textAlign = 'center';
      this._titleGlow(ctx, 'RECONSTRUCTOR', W / 2, H * 0.13, 28, '#ffd27a');
      ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#ffe27a';
      ctx.fillText(`◈ ${game.salvage} salvage`, W / 2, H * 0.13 + 26);

      const st = game.station; if (!st) { this.end(); return; }
      const mods = st.stock.modules;
      // module cards
      const cw = 200, ch = 150, gap = 22;
      const totalW = mods.length * cw + (mods.length - 1) * gap;
      let cx = (W - totalW) / 2; const cy = H * 0.26;
      for (let i = 0; i < mods.length; i++) {
        const def = mods[i];
        const idx = this._i++;
        const hover = RE.Input.mouse.x >= cx && RE.Input.mouse.x <= cx + cw && RE.Input.mouse.y >= cy && RE.Input.mouse.y <= cy + ch;
        if (hover && game._mouseMoved) this.focus = idx;
        const focused = idx === this.focus, active = focused || hover;
        if (def) {
          this._card(ctx, def, cx, cy, cw, ch, active);
          const cost = game.stationCost(def);
          const afford = game.salvage >= cost;
          ctx.textAlign = 'center'; ctx.font = 'bold 13px monospace';
          ctx.fillStyle = afford ? '#ffe27a' : 'rgba(180,160,120,0.5)';
          ctx.fillText('◈ ' + cost, cx + cw / 2, cy + ch - 12);
          const clicked = (hover && game.mousePressed) || (focused && (RE.Input.keyPressed('Enter') || RE.Input.keyPressed('Space')));
          if (clicked && afford) game.stationBuy(def, i);
        } else {
          ctx.fillStyle = 'rgba(18,26,36,0.6)'; this._rr(ctx, cx, cy, cw, ch, 10); ctx.fill();
          ctx.strokeStyle = 'rgba(90,100,120,0.3)'; this._rr(ctx, cx, cy, cw, ch, 10); ctx.stroke();
          ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(120,130,150,0.5)'; ctx.font = '12px monospace';
          ctx.fillText('— installed —', cx + cw / 2, cy + ch / 2);
        }
        cx += cw + gap;
      }

      // service buttons
      const bw = 190, bh = 40, by = cy + ch + 26;
      const repairCost = 20 + st.stock.repairUses * 10;
      const gx = (W - (bw * 4 + 30)) / 2;
      if (this.button(ctx, game, { x: gx, y: by, w: bw, h: bh, label: 'REPAIR +30', sub: `◈ ${repairCost}`, font: 'bold 14px monospace' })) game.stationRepair();
      if (this.button(ctx, game, { x: gx + bw + 10, y: by, w: bw, h: bh, label: st.stock.refillUsed ? 'ENERGY: TAPPED' : 'ENERGY TAP', sub: st.stock.refillUsed ? '' : 'free refill', font: 'bold 14px monospace', disabled: st.stock.refillUsed })) game.stationRefill();
      if (this.button(ctx, game, { x: gx + (bw + 10) * 2, y: by, w: bw, h: bh, label: 'REROLL STOCK', sub: '◈ 12', font: 'bold 14px monospace' })) game.stationReroll();
      if (this.button(ctx, game, { x: gx + (bw + 10) * 3, y: by, w: bw, h: bh, label: 'LEAVE', font: 'bold 14px monospace' })) game.closeStation();
      this.end();
    },

    meta(ctx, game) {
      const W = RE.CFG.viewW, H = RE.CFG.viewH;
      this._dim(ctx, W, H, 0.8);
      this.begin(game);
      ctx.textAlign = 'center';
      this._titleGlow(ctx, 'RECONSTRUCTOR', W / 2, 54, 30, '#c0a0ff');
      ctx.font = '13px monospace'; ctx.fillStyle = '#c0a0ff';
      ctx.fillText(`✦ ${RE.Save.data.coreShards} core-shards`, W / 2, 84);

      const upgrades = RE.META_UPGRADES || [];
      const cols = 3, cw = 250, ch = 80, gap = 13;
      const totalW = cols * cw + (cols - 1) * gap;
      let startX = (W - totalW) / 2;
      let x = startX, y = 100, col = 0;
      for (const u of upgrades) {
        const idx = this._i++;
        const level = RE.Save.data.unlocks[u.id] ? (typeof RE.Save.data.unlocks[u.id] === 'number' ? RE.Save.data.unlocks[u.id] : 1) : 0;
        const maxed = u.max ? level >= u.max : level >= 1;
        const cost = u.cost + (u.costPer ? level * u.costPer : 0);
        const hover = RE.Input.mouse.x >= x && RE.Input.mouse.x <= x + cw && RE.Input.mouse.y >= y && RE.Input.mouse.y <= y + ch;
        if (hover && game._mouseMoved) this.focus = idx;
        const focused = idx === this.focus;
        const active = focused || hover;
        const reqMet = !u.req || RE.Save.data.unlocks[u.req];
        const affordable = !maxed && reqMet && RE.Save.data.coreShards >= cost;

        ctx.fillStyle = active ? 'rgba(40,32,60,0.9)' : 'rgba(24,20,38,0.85)';
        this._rr(ctx, x, y, cw, ch, 8); ctx.fill();
        ctx.strokeStyle = maxed ? 'rgba(120,255,160,0.6)' : (affordable ? (active ? '#c0a0ff' : 'rgba(160,130,220,0.5)') : 'rgba(120,100,140,0.3)');
        ctx.lineWidth = active ? 2 : 1.2;
        this._rr(ctx, x, y, cw, ch, 8); ctx.stroke();
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#eaffff';
        ctx.fillText(u.name + (u.max ? `  ${level}/${u.max}` : ''), x + 12, y + 12);
        ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(190,200,230,0.8)';
        this._wrap(ctx, u.desc, x + 12, y + 34, cw - 24, 13);
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = maxed ? '#7affa0' : (affordable ? '#c0a0ff' : 'rgba(150,130,170,0.6)');
        ctx.fillText(maxed ? 'OWNED' : (!reqMet ? '🔒 locked' : `✦ ${cost}`), x + 12, y + ch - 18);

        if ((hover && game.mousePressed || (focused && (RE.Input.keyPressed('Enter') || RE.Input.keyPressed('Space')))) && affordable) {
          game.buyMeta(u, cost);
        }
        col++; x += cw + gap;
        if (col >= cols) { col = 0; x = startX; y += ch + gap; }
      }

      const bw = 200, bh = 40;
      if (this.button(ctx, game, { x: (W - bw) / 2, y: H - 56, w: bw, h: bh, label: '◀  BACK' })) game.closeMeta();
      this.end();
    },

    codex(ctx, game) {
      const W = RE.CFG.viewW, H = RE.CFG.viewH;
      this._dim(ctx, W, H, 0.85);
      this.begin(game);
      ctx.textAlign = 'center';
      this._titleGlow(ctx, 'FIELD MEMORY', W / 2, 46, 28, '#9fe6ff');
      const all = Object.values(RE.LOGS || {});
      const found = all.filter(l => RE.Save.data.logsFound[l.id]);
      ctx.font = '12px monospace'; ctx.fillStyle = 'rgba(160,200,230,0.7)';
      ctx.fillText(`${found.length} / ${all.length} fragments recovered`, W / 2, 72);

      const cols = 2, cw = 400, ch = 96, gap = 18;
      const totalW = cols * cw + gap;
      let x = (W - totalW) / 2, y = 92, col = 0;
      const shown = found.slice(0, 8);
      for (const l of shown) {
        ctx.fillStyle = 'rgba(20,30,44,0.85)';
        this._rr(ctx, x, y, cw, ch, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(120,190,230,0.35)'; ctx.lineWidth = 1;
        this._rr(ctx, x, y, cw, ch, 8); ctx.stroke();
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#cfe9ff';
        ctx.fillText(l.title, x + 12, y + 10);
        ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(150,180,210,0.6)';
        ctx.fillText('— ' + l.source, x + 12, y + 26);
        ctx.font = '11px monospace'; ctx.fillStyle = 'rgba(190,210,230,0.85)';
        this._wrap(ctx, l.text, x + 12, y + 42, cw - 24, 14);
        col++; x += cw + gap;
        if (col >= cols) { col = 0; x = (W - totalW) / 2; y += ch + gap; }
      }
      if (!found.length) {
        ctx.textAlign = 'center'; ctx.font = '13px monospace'; ctx.fillStyle = 'rgba(160,190,220,0.6)';
        ctx.fillText('No fragments recovered yet. Pulse into the dark corners of the Hollow.', W / 2, H / 2);
      }
      if (found.length > 8) { ctx.textAlign = 'center'; ctx.font = '11px monospace'; ctx.fillStyle = 'rgba(150,180,210,0.5)'; ctx.fillText(`+${found.length - 8} more recovered`, W / 2, H - 76); }

      const bw = 200, bh = 40;
      if (this.button(ctx, game, { x: (W - bw) / 2, y: H - 56, w: bw, h: bh, label: '◀  BACK' })) game.closeCodex();
      this.end();
    },

    _rr(ctx, x, y, w, h, r) {
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

  RE.Menus = Menus;
})(window.RE = window.RE || {});
