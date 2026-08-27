/* RoboExplore — boss definitions (five threshold guardians).
 * Each caps a biome (sectors 3/6/9/12/15). Phases trigger at HP fractions;
 * attacks are building blocks resolved by entities/boss.js. Every attack has a
 * telegraph (`tell`, seconds) so the fight is fair in the dark.
 */
(function (RE) {
  'use strict';

  const BOSSES = {
    vaulk: {
      id: 'vaulk', name: 'VAULK, the Drowned Warden',
      hp: 620, radius: 30, color: '#1d5a6e', glow: '#4fd6ff', spikes: 8,
      phases: [
        { threshold: 1.0, title: 'surfaced', keepDist: 200, moveSpeed: 78, contact: 16, attacks: [
          { type: 'slam', tell: 0.9, cd: 3.2, dist: 200, max: 300, speed: 300, dmg: 18 },
          { type: 'aimed', tell: 0.7, cd: 2.6, count: 3, speed: 210, spread: 0.35, dmg: 12 },
          { type: 'radial', tell: 0.6, cd: 2.8, count: 12, speed: 180, dmg: 9 },
        ] },
        { threshold: 0.6, title: 'submerge hunt', keepDist: 170, moveSpeed: 120, contact: 16,
          adds: { id: 'skitter', count: 2, every: 6, cap: 5 }, attacks: [
          { type: 'shockwave', tell: 1.0, cd: 3.0, max: 340, speed: 300, dmg: 20 },
          { type: 'radial', tell: 0.6, cd: 2.4, count: 10, speed: 200, dmg: 10 },
          { type: 'aimed', tell: 0.6, cd: 2.2, count: 4, speed: 220, spread: 0.5, dmg: 11 },
        ] },
        { threshold: 0.3, title: 'maelstrom', keepDist: 150, moveSpeed: 90, contact: 18, attacks: [
          { type: 'spiral', tell: 0.4, cd: 0.28, arms: 2, turn: 4, speed: 200, dmg: 9 },
          { type: 'shockwave', tell: 0.8, cd: 3.0, max: 360, speed: 320, dmg: 20 },
        ] },
      ],
    },

    atlas: {
      id: 'atlas', name: 'ATLAS-7, the Bloom-Furnace',
      hp: 860, radius: 34, color: '#5a3a22', glow: '#ffb14a', spikes: 6,
      phases: [
        { threshold: 1.0, title: 'vent cycle', keepDist: 230, moveSpeed: 40, contact: 16, attacks: [
          { type: 'sweep', tell: 0.8, cd: 4.2, len: 300, arc: 0.32, rot: 1.0, dur: 3.0, dmg: 12 },
          { type: 'aimed', tell: 1.1, cd: 2.8, count: 2, speed: 190, spread: 0.4, dmg: 16 },
        ] },
        { threshold: 0.65, title: 'blackout burn', keepDist: 200, moveSpeed: 70, contact: 16,
          adds: { id: 'sparkfly_swarm', count: 3, every: 7, cap: 6 }, attacks: [
          { type: 'blackout', tell: 0.8, cd: 6.0, dur: 4.0 },
          { type: 'aimed', tell: 0.7, cd: 1.6, count: 3, speed: 180, spread: 0.3, dmg: 12 },
          { type: 'radial', tell: 0.6, cd: 3.0, count: 14, speed: 170, dmg: 10 },
        ] },
        { threshold: 0.35, title: 'meltdown', keepDist: 999, moveSpeed: 0, contact: 20, attacks: [
          { type: 'shockwave', tell: 0.7, cd: 2.0, max: 420, speed: 300, dmg: 20 },
          { type: 'radial', tell: 0.5, cd: 1.8, count: 18, speed: 190, dmg: 11, offset: 0.2 },
        ] },
      ],
    },

    mneme: {
      id: 'mneme', name: 'MNEME, the Archivist',
      hp: 1040, radius: 28, color: '#3a2a5a', glow: '#c88bff', spikes: 10,
      phases: [
        { threshold: 1.0, title: 'recitation', keepDist: 210, moveSpeed: 90, contact: 12, attacks: [
          { type: 'slam', tell: 0.6, cd: 3.0, dist: 240, max: 260, speed: 300, dmg: 14 },
          { type: 'aimed', tell: 0.7, cd: 2.4, count: 3, speed: 320, spread: 0.25, dmg: 14 },
          { type: 'spiral', tell: 0.3, cd: 0.3, arms: 3, turn: 2.5, speed: 160, dmg: 9 },
        ] },
        { threshold: 0.7, title: 'chorus of copies', keepDist: 190, moveSpeed: 120, contact: 12,
          adds: { id: 'sparkfly_swarm', count: 4, every: 8, cap: 8 }, attacks: [
          { type: 'aimed', tell: 0.8, cd: 2.0, count: 5, speed: 300, spread: 0.6, dmg: 12 },
          { type: 'radial', tell: 0.5, cd: 2.4, count: 12, speed: 200, dmg: 10 },
        ] },
        { threshold: 0.35, title: 'null cascade', keepDist: 160, moveSpeed: 100, contact: 14, attacks: [
          { type: 'spiral', tell: 0.25, cd: 0.24, arms: 4, turn: -3, speed: 180, dmg: 10 },
          { type: 'aimed', tell: 0.7, cd: 2.6, count: 6, speed: 260, spread: 0.9, dmg: 12 },
        ] },
      ],
    },

    rig: {
      id: 'rig', name: 'RIG-0, the Overseer',
      hp: 1320, radius: 36, color: '#2f5a72', glow: '#b8f0ff', spikes: 7,
      phases: [
        { threshold: 1.0, title: 'suppression', keepDist: 260, moveSpeed: 50, contact: 18, attacks: [
          { type: 'aimed', tell: 0.7, cd: 2.4, count: 3, speed: 420, spread: 0.15, dmg: 20 },
          { type: 'sweep', tell: 0.8, cd: 5.0, len: 340, arc: 0.28, rot: 0.7, dur: 3.5, dmg: 12 },
        ] },
        { threshold: 0.7, title: 'assembly line', keepDist: 180, moveSpeed: 90, contact: 20,
          adds: { id: 'skitter', count: 3, every: 5, cap: 7 }, attacks: [
          { type: 'slam', tell: 0.9, cd: 3.2, dist: 220, max: 340, speed: 320, dmg: 20 },
          { type: 'spiral', tell: 0.3, cd: 0.3, arms: 3, turn: 2, speed: 200, dmg: 12 },
        ] },
        { threshold: 0.4, title: 'overdrive purge', keepDist: 999, moveSpeed: 0, contact: 22, attacks: [
          { type: 'aimed', tell: 0.6, cd: 1.8, count: 3, speed: 420, spread: 0.2, dmg: 22 },
          { type: 'spiral', tell: 0.25, cd: 0.26, arms: 5, turn: 3, speed: 200, dmg: 12 },
        ] },
      ],
    },

    axis: {
      id: 'axis', name: 'AXIS, the Hollow Heart',
      hp: 1900, radius: 40, color: '#3a1060', glow: '#e0a6ff', spikes: 12, introInvuln: 1.5,
      phases: [
        { threshold: 1.0, title: 'the sleeping core', keepDist: 240, moveSpeed: 40, contact: 16, attacks: [
          { type: 'sweep', tell: 0.9, cd: 4.0, len: 360, arc: 0.3, rot: 0.9, dur: 3.0, dmg: 14 },
          { type: 'shockwave', tell: 1.0, cd: 3.0, max: 420, speed: 250, dmg: 16 },
          { type: 'radial', tell: 0.6, cd: 3.0, count: 16, speed: 190, dmg: 12 },
        ] },
        { threshold: 0.6, title: 'the waking', keepDist: 210, moveSpeed: 80, contact: 18, attacks: [
          { type: 'blackout', tell: 1.0, cd: 7.0, dur: 4.5, drainTo: 0 },
          { type: 'sweep', tell: 0.8, cd: 3.5, len: 380, arc: 0.32, rot: 1.1, dur: 3.0, dmg: 16 },
          { type: 'aimed', tell: 0.6, cd: 2.0, count: 4, speed: 360, spread: 0.4, dmg: 16 },
        ] },
        { threshold: 0.3, title: 'the hollow heart', keepDist: 180, moveSpeed: 90, contact: 20, attacks: [
          { type: 'spiral', tell: 0.25, cd: 0.24, arms: 4, turn: 3, speed: 200, dmg: 12 },
          { type: 'sweep', tell: 0.7, cd: 3.0, len: 400, arc: 0.34, rot: -1.2, dur: 3.0, dmg: 18 },
          { type: 'supernova', tell: 1.6, cd: 8.0, dmg: 26 },
        ] },
      ],
    },
  };

  // Which boss guards each biome (threshold sectors 3/6/9/12/15).
  const BIOME_BOSS = { intake: 'vaulk', hollows: 'atlas', vaults: 'mneme', cryostacks: 'rig', marrow: 'axis' };

  RE.BOSSES = BOSSES;
  RE.BIOME_BOSS = BIOME_BOSS;
})(window.RE = window.RE || {});
