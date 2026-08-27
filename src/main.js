/* RoboExplore — bootstrap: canvas sizing (aspect-preserving), fixed-timestep
 * loop with accumulator, and the render/update pump.
 */
(function (RE) {
  'use strict';
  const CFG = RE.CFG;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(window.devicePixelRatio || 1, CFG.maxDPR);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, CFG.maxDPR);
    const winW = window.innerWidth, winH = window.innerHeight;
    const scale = Math.min(winW / CFG.viewW, winH / CFG.viewH);
    const cssW = Math.floor(CFG.viewW * scale);
    const cssH = Math.floor(CFG.viewH * scale);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(CFG.viewW * dpr);
    canvas.height = Math.floor(CFG.viewH * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  RE.Game.init(canvas);

  // Fixed timestep simulation for deterministic, stable feel.
  const STEP = 1 / 60;
  const MAX_ACC = 0.1;      // avoid spiral of death
  let acc = 0;
  let last = 0; // filled on first frame

  function frame(now) {
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > MAX_ACC) dt = MAX_ACC;
    acc += dt;

    let steps = 0;
    while (acc >= STEP && steps < 6) {
      RE.Game.update(STEP);
      acc -= STEP;
      steps++;
    }
    // If we couldn't keep up, drop remaining accumulator.
    if (acc > STEP * 6) acc = 0;

    // Render once per animation frame. Menus consume input here (immediate
    // mode), so edge-triggered input is flushed AFTER render, once per frame.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    RE.Game.render();
    RE.Input.endFrame();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Resume audio on first interaction (autoplay policy).
  const kick = () => { RE.Audio.resume(); };
  window.addEventListener('pointerdown', kick, { once: true });
  window.addEventListener('keydown', kick, { once: true });
})(window.RE = window.RE || {});
