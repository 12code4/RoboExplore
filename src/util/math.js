/* RoboExplore — math & small helpers */
(function (RE) {
  'use strict';

  const TAU = Math.PI * 2;

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  // Frame-rate independent smoothing factor for exponential lerp.
  const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

  const dist2 = (ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
  };
  const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

  // Shortest signed angular difference b - a, in (-PI, PI].
  function angleDiff(a, b) {
    let d = (b - a) % TAU;
    if (d < -Math.PI) d += TAU;
    if (d > Math.PI) d -= TAU;
    return d;
  }
  // Rotate `a` toward `b` by at most `maxStep` radians.
  function rotateToward(a, b, maxStep) {
    const d = angleDiff(a, b);
    if (Math.abs(d) <= maxStep) return b;
    return a + Math.sign(d) * maxStep;
  }

  // Easing functions.
  const ease = {
    inQuad: t => t * t,
    outQuad: t => t * (2 - t),
    inOutQuad: t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    outCubic: t => (--t) * t * t + 1,
    inCubic: t => t * t * t,
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: t => {
      const c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  };

  // Circle vs circle overlap.
  function circleOverlap(ax, ay, ar, bx, by, br) {
    const r = ar + br;
    return dist2(ax, ay, bx, by) < r * r;
  }

  // Approach a value toward target by a fixed step (per call).
  function approach(v, target, step) {
    if (v < target) return Math.min(v + step, target);
    if (v > target) return Math.max(v - step, target);
    return v;
  }

  // Color helpers ---------------------------------------------------------
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgba(hex, a) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  }
  function mixHex(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    const r = Math.round(lerp(a.r, b.r, t));
    const g = Math.round(lerp(a.g, b.g, t));
    const bl = Math.round(lerp(a.b, b.b, t));
    return `rgb(${r},${g},${bl})`;
  }

  RE.M = {
    TAU, clamp, lerp, invLerp, damp, dist, dist2, angleDiff, rotateToward,
    ease, circleOverlap, approach, hexToRgb, rgba, mixHex,
    PI: Math.PI,
  };
})(window.RE = window.RE || {});
