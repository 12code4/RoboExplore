/* RoboExplore — enemy registry.
 * The 10 designed creatures of the Hollow, each built around the echo/dark
 * mechanic. `ai` selects a behavior implemented in entities/enemy.js.
 */
(function (RE) {
  'use strict';

  const ENEMIES = {
    skitter: {
      id: 'skitter', name: 'Skitter', ai: 'chaser', shape: 'crawler',
      hp: 10, radius: 10, speed: 130, touchDamage: 6, danger: 2,
      color: '#ff5a6e', glow: '#ff9aa8', salvage: [1, 3], firstSector: 1,
    },
    lumen_moth: {
      id: 'lumen_moth', name: 'Lumen Moth', ai: 'moth', shape: 'moth',
      hp: 8, radius: 8, speed: 95, touchDamage: 6, danger: 3,
      color: '#ff9a3c', glow: '#ffca7a', salvage: [1, 2], firstSector: 1,
      pod: [3, 6], lureRange: 340, lureSpeed: 150, lureTime: 2.5, contactCd: 0.8,
    },
    silt_lurker: {
      id: 'silt_lurker', name: 'Silt Lurker', ai: 'buried', shape: 'lurker',
      hp: 22, radius: 13, speed: 80, touchDamage: 16, danger: 4,
      color: '#7a8a66', glow: '#c8e08a', salvage: [2, 4], firstSector: 1,
      windup: 0.5, lungeSpeed: 190, lungeTime: 0.42, lungeMax: 120, exposed: 1.5, triggerRange: 60,
    },
    gloom_crawler: {
      id: 'gloom_crawler', name: 'Gloom Crawler', ai: 'freezer', shape: 'crawler',
      hp: 34, radius: 13, speed: 145, touchDamage: 12, danger: 5,
      color: '#6a6488', glow: '#e8e6ff', salvage: [3, 5], firstSector: 2,
      contactCd: 0.8, litArmor: 0.5, unfreezeTell: 0.3,
    },
    sparkfly_swarm: {
      id: 'sparkfly_swarm', name: 'Sparkfly', ai: 'orbiter', shape: 'spark',
      hp: 6, radius: 7, speed: 130, touchDamage: 5, danger: 4,
      color: '#4fd6ff', glow: '#bff0ff', salvage: [1, 2], firstSector: 2,
      pod: [6, 9], orbitDist: 140, chargeEvery: 3, diveSpeed: 240, selfLit: true,
    },
    rift_spitter: {
      id: 'rift_spitter', name: 'Rift Spitter', ai: 'spitter', shape: 'spitter',
      hp: 46, radius: 15, speed: 60, touchDamage: 8, danger: 5,
      color: '#7cc23a', glow: '#c6ff7a', salvage: [3, 6], firstSector: 3,
      range: 380, aimTime: 0.9, projSpeed: 160, projDamage: 10, fireCd: 2.2,
      puddleDamage: 4, puddleLife: 2.5, puddleR: 44,
    },
    warden_node: {
      id: 'warden_node', name: 'Warden Node', ai: 'turret', shape: 'warden',
      hp: 120, radius: 16, speed: 0, touchDamage: 0, danger: 6,
      color: '#c0424f', glow: '#ff6a7a', salvage: [5, 9], firstSector: 3,
      beamLen: 220, beamArc: 0.31, beamRotSpeed: 1.05, sweepTime: 4, cooldown: 2.5,
      spinup: 0.8, beamDamage: 8, beamTickCd: 0.4, proxRange: 100, pulseCharges: 2,
    },
    echo_wraith: {
      id: 'echo_wraith', name: 'Echo Wraith', ai: 'wraith', shape: 'wraith',
      hp: 40, radius: 13, speed: 110, touchDamage: 0, danger: 6,
      color: '#e8ecff', glow: '#ffffff', salvage: [4, 7], firstSector: 4,
      materialTime: 1.6, blinkDelay: 0.4, slashDamage: 18, slashReach: 40,
    },
    barnacle_mine: {
      id: 'barnacle_mine', name: 'Barnacle', ai: 'mine', shape: 'mine',
      hp: 14, radius: 10, speed: 0, touchDamage: 0, danger: 5,
      color: '#d63a2f', glow: '#ff8a6a', salvage: [1, 3], firstSector: 4,
      armTime: 0.9, blastR: 90, blastMax: 30, blastMin: 12, chainR: 70,
    },
    hollow_stalker: {
      id: 'hollow_stalker', name: 'Hollow Stalker', ai: 'stalker', shape: 'stalker',
      hp: 90, radius: 15, speed: 120, touchDamage: 10, danger: 8,
      color: '#8a3244', glow: '#ff6a8a', salvage: [6, 10], firstSector: 5,
      crouch: 0.6, pounceSpeed: 300, pounceMax: 200, pounceDamage: 24, recover: 1.2, pounceEvery: 5,
    },
    leviathan_eye: {
      id: 'leviathan_eye', name: 'Abyssal Eye', ai: 'eye', shape: 'eye',
      hp: 240, radius: 30, speed: 40, touchDamage: 0, danger: 9,
      color: '#b03cff', glow: '#e0a6ff', salvage: [12, 20], firstSector: 7,
      openTime: 0.7, gazeLen: 340, gazeArc: 0.45, gazeTrack: 0.7, gazeTime: 1.5,
      gazeDamage: 6, gazeTickCd: 0.3, closeTime: 1.2, cooldown: 3,
    },
  };

  // Which enemies can appear in a biome, by biome id (from biomes.js).
  RE.ENEMIES = ENEMIES;
})(window.RE = window.RE || {});
