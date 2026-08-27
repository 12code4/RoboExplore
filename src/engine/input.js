/* RoboExplore — input (keyboard + mouse + basic gamepad + touch fallback).
 * Exposes edge-triggered "pressed" queries and continuous "down" state,
 * plus a world-space aim vector supplied by the game each frame.
 */
(function (RE) {
  'use strict';

  const Input = {
    keys: Object.create(null),       // current down state by code
    _pressed: Object.create(null),   // pressed-this-frame
    _released: Object.create(null),
    mouse: { x: 0, y: 0, sx: 0, sy: 0, down: false, _pressed: false, right: false },
    wheel: 0,
    pad: null,
    canvas: null,
    // mapping of logical actions -> key codes
    bindings: {
      up: ['KeyW', 'ArrowUp'],
      down: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      dash: ['ShiftLeft', 'ShiftRight', 'Space'],
      echo: ['KeyE', 'KeyQ'],
      shield: ['KeyF'],
      pause: ['Escape', 'KeyP'],
      map: ['Tab', 'KeyM'],
      confirm: ['Enter', 'Space'],
      interact: ['KeyR'],
      swap: ['KeyQ'],
      mute: ['KeyM'],
    },

    init(canvas) {
      this.canvas = canvas;
      window.addEventListener('keydown', (e) => {
        if (!this.keys[e.code]) this._pressed[e.code] = true;
        this.keys[e.code] = true;
        // Prevent page scroll for game keys.
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) {
          e.preventDefault();
        }
      }, { passive: false });
      window.addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
        this._released[e.code] = true;
      });
      window.addEventListener('blur', () => { this.keys = Object.create(null); });

      const setMouse = (e) => {
        const r = canvas.getBoundingClientRect();
        this.mouse.sx = (e.clientX - r.left) / r.width;
        this.mouse.sy = (e.clientY - r.top) / r.height;
      };
      canvas.addEventListener('mousemove', setMouse);
      canvas.addEventListener('mousedown', (e) => {
        setMouse(e);
        if (e.button === 0) { this.mouse.down = true; this.mouse._pressed = true; }
        if (e.button === 2) { this.mouse.right = true; }
      });
      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.mouse.down = false;
        if (e.button === 2) this.mouse.right = false;
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

      // Touch: single-touch acts like a pointer + tap.
      const touch = (e) => {
        if (e.touches && e.touches[0]) {
          const t = e.touches[0];
          const r = canvas.getBoundingClientRect();
          this.mouse.sx = (t.clientX - r.left) / r.width;
          this.mouse.sy = (t.clientY - r.top) / r.height;
        }
      };
      canvas.addEventListener('touchstart', (e) => { touch(e); this.mouse.down = true; this.mouse._pressed = true; e.preventDefault(); }, { passive: false });
      canvas.addEventListener('touchmove', (e) => { touch(e); e.preventDefault(); }, { passive: false });
      canvas.addEventListener('touchend', () => { this.mouse.down = false; }, { passive: false });

      window.addEventListener('gamepadconnected', () => {});
    },

    _anyDown(codes) { for (const c of codes) if (this.keys[c]) return true; return false; },
    _anyPressed(codes) { for (const c of codes) if (this._pressed[c]) return true; return false; },

    // Logical action queries.
    down(action) { return this._anyDown(this.bindings[action] || []); },
    pressed(action) { return this._anyPressed(this.bindings[action] || []); },

    // Raw code query.
    keyPressed(code) { return !!this._pressed[code]; },
    keyDown(code) { return !!this.keys[code]; },

    // Normalized movement vector from WASD/arrows (+ gamepad left stick).
    moveVector() {
      let x = 0, y = 0;
      if (this.down('left')) x -= 1;
      if (this.down('right')) x += 1;
      if (this.down('up')) y -= 1;
      if (this.down('down')) y += 1;
      const pad = this._pollPad();
      if (pad) {
        const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
        if (Math.abs(ax) > 0.22) x += ax;
        if (Math.abs(ay) > 0.22) y += ay;
      }
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      return { x, y, len: Math.min(len, 1) };
    },

    _pollPad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) if (p) return p;
      return null;
    },

    // Called by the game once per frame with the resolved mouse position in
    // internal view coordinates (0..viewW, 0..viewH).
    setViewMouse(x, y) { this.mouse.x = x; this.mouse.y = y; },

    mousePressed() { return this.mouse._pressed; },

    // Clear per-frame edge state. Call at the very end of the frame.
    endFrame() {
      this._pressed = Object.create(null);
      this._released = Object.create(null);
      this.mouse._pressed = false;
      this.wheel = 0;
    },
  };

  RE.Input = Input;
})(window.RE = window.RE || {});
