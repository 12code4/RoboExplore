/* RoboExplore — enemy definitions (registry).
 * The `ai` field selects a behavior implemented in entities/enemy.js.
 * This is the vertical-slice roster; the design bible expands it during alpha.
 */
(function (RE) {
  'use strict';

  const ENEMIES = {
    crawler: {
      id: 'crawler', name: 'Skitter', ai: 'chaser',
      hp: 22, radius: 11, speed: 92, accel: 900,
      touchDamage: 10, color: '#ff5a6e', glow: '#ff9aa8',
      xp: 3, salvage: [1, 3], danger: 2,
      sight: 260, wakeOnPing: true,
      desc: 'A four-legged husk that scuttles toward heat.',
    },
    spitter: {
      id: 'spitter', name: 'Spitter', ai: 'ranged',
      hp: 26, radius: 12, speed: 55, accel: 500,
      touchDamage: 8, color: '#ffb14a', glow: '#ffd79a',
      xp: 4, salvage: [2, 4], danger: 3,
      sight: 340, wakeOnPing: true,
      range: 300, projSpeed: 220, projDamage: 9, fireCd: 1.9, keepDist: 190,
      desc: 'Lobs corrosive sparks from range. Keeps its distance.',
    },
    lurker: {
      id: 'lurker', name: 'Lurker', ai: 'ambusher',
      hp: 30, radius: 13, speed: 150, accel: 1400,
      touchDamage: 16, color: '#b06bff', glow: '#d9b6ff',
      xp: 6, salvage: [3, 6], danger: 5,
      sight: 220, wakeOnPing: true,
      desc: 'Invisible until a pulse washes over it — then it charges.',
      invisibleUntilPinged: true,
    },
    drone: {
      id: 'drone', name: 'Sentry Drone', ai: 'orbiter',
      hp: 18, radius: 10, speed: 130, accel: 800,
      touchDamage: 6, color: '#4ad6ff', glow: '#a6ecff',
      xp: 4, salvage: [2, 4], danger: 3,
      sight: 360, range: 320, projSpeed: 260, projDamage: 7, fireCd: 1.3, orbitDist: 170,
      desc: 'Orbits and pelts you with pulse-fire.',
    },
  };

  RE.ENEMIES = ENEMIES;
})(window.RE = window.RE || {});
