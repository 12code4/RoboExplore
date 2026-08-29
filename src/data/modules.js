/* RoboExplore — module definitions (loadout parts).
 *
 * v1.4 loadout model: modules STACK. You accumulate an arbitrary list of
 * upgrades and every effect composes — except within a `group`, where a new
 * module replaces the old (a "direct conflict", e.g. two primary guns, or two
 * dash overrides). `stack: true` marks additive upgrades worth taking more than
 * once; those may be re-offered so you can pile them up.
 *
 * `slot` is now purely cosmetic (icon + card tag). apply(stats, player) mutates
 * the stat block; behavioral modules set flags or a `stats.weapon` override that
 * the player's data-driven weapon system reads.
 */
(function (RE) {
  'use strict';

  const MODULES = {
    // ============ WEAPON ============
    // Primary guns share group 'gun' — only one can be active at a time.
    'w-scatter': {
      id: 'w-scatter', name: 'Scatter Emitter', slot: 'weapon', rarity: 'uncommon', group: 'gun',
      desc: '3-pellet cone: brutal point-blank, weak at range. 6 energy/shot.',
      apply: (s) => { s.weapon = { name: 'Scatter Emitter', damage: 7, fireRate: 4.5, count: 3, spread: 0.244, speed: 500, life: 0.5, radius: 3, energy: 6, color: '#ffd27a', illuminate: 12 }; },
    },
    'w-rail': {
      id: 'w-rail', name: 'Rail Lance', slot: 'weapon', rarity: 'rare', group: 'gun',
      desc: 'Charge, then fire a piercing lance that lights its path. 42 dmg, 20 energy.',
      apply: (s) => { s.weapon = { name: 'Rail Lance', charge: 0.55, damage: 42, fireRate: 1.2, count: 1, spread: 0, speed: 900, life: 0.5, radius: 5, energy: 20, color: '#c88bff', illuminate: 40, heavy: true, pierce: 999 }; },
    },
    'w-ricochet': {
      id: 'w-ricochet', name: 'Ricochet Array', slot: 'weapon', rarity: 'uncommon', group: 'gun',
      desc: 'Shots ricochet off walls x3 at full damage — hit around corners.',
      apply: (s) => { s.weapon = { name: 'Ricochet Array', damage: 9, fireRate: 6, count: 1, spread: 0.05, speed: 440, life: 1.3, radius: 3.4, energy: 0, bounce: 3, color: '#9fe4ff', illuminate: 12 }; },
    },
    'w-siege': {
      id: 'w-siege', name: 'Siege Capacitor', slot: 'weapon', rarity: 'legendary', group: 'gun',
      desc: 'Every 5th shot SURGES: big damage, splash, knockback. Rewards aggression.',
      apply: (s) => { s.weapon = { name: 'Siege Capacitor', damage: 9, fireRate: 6, count: 1, spread: 0.05, speed: 640, life: 0.6, radius: 4, energy: 4, color: '#ffb14a', surgeEvery: 5, surgeDamage: 34, surgeEnergy: 14, splash: 44, splashDamage: 16, knockback: 200, illuminate: 14 }; },
    },
    'w-swarm': {
      id: 'w-swarm', name: 'Homing Swarm', slot: 'weapon', rarity: 'rare', group: 'gun',
      desc: 'Seeking micro-missiles that hunt the nearest foe within short range.',
      apply: (s) => { s.weapon = { name: 'Homing Swarm', damage: 7, fireRate: 3.2, count: 2, spread: 0.5, speed: 300, life: 1.7, radius: 3, energy: 3, color: '#ff9adf', homing: true, homTurn: 3.4, homRange: 240, illuminate: 16 }; },
    },
    // Augments (no gun conflict — they stack onto whatever gun you carry).
    'w-resonant': {
      id: 'w-resonant', name: 'Resonant Cannon', slot: 'weapon', rarity: 'rare', stack: true,
      desc: 'Your echo ring deals 14 damage. Shots hit +4 briefly after each pulse. Stacks.',
      apply: (s) => { s.echoDamage += 14; s.echoBuffDamage += 4; },
    },
    'w-overcharge': {
      id: 'w-overcharge', name: 'Overcharge Coil', slot: 'weapon', rarity: 'uncommon', stack: true,
      desc: '+18% weapon damage. Stacks — pile them on.',
      apply: (s) => { s.damageMul *= 1.18; },
    },
    'w-breaker': {
      id: 'w-breaker', name: 'Breaker Rounds', slot: 'weapon', rarity: 'common', stack: true,
      desc: 'Shots tear terrain apart: +150% wall damage. Carve the Hollow. Stacks.',
      apply: (s) => { s.wallDamageMul *= 2.5; },
    },

    // ============ MOBILITY ============
    'm-servos': {
      id: 'm-servos', name: 'Kinetic Servos', slot: 'mobility', rarity: 'common', stack: true,
      desc: '+22% move speed, +18% dash distance. You outrun your own light.',
      apply: (s) => { s.speedMul *= 1.22; s.dashDistMul *= 1.18; },
    },
    'm-treads': {
      id: 'm-treads', name: 'Grip Treads', slot: 'mobility', rarity: 'common', stack: true,
      desc: '+12% move speed. Simple, and it stacks.',
      apply: (s) => { s.speedMul *= 1.12; },
    },
    'm-phaserush': {
      id: 'm-phaserush', name: 'Phase Rush', slot: 'mobility', rarity: 'rare', group: 'dash',
      desc: 'Dash phases through enemies and ends in a free reveal micro-pulse.',
      apply: (s) => { s.phaseDash = true; s.dashMicroPulse = true; s.dashCostAdd += 6; s.dashCdAdd += 0.12; },
    },
    'm-blink': {
      id: 'm-blink', name: 'Blink Core', slot: 'mobility', rarity: 'legendary', group: 'dash',
      desc: 'Instant blink with full i-frames, always lands clear. Costlier, longer CD.',
      apply: (s) => { s.blinkDash = true; s.dashCostAdd += 8; },
    },
    'm-momentum': {
      id: 'm-momentum', name: 'Momentum Cells', slot: 'mobility', rarity: 'uncommon',
      desc: 'Move fast: +10 regen and no post-spend delay. Refuel mid-fight.',
      apply: (s) => { s.momentumRegen = true; },
    },
    'm-chrono': {
      id: 'm-chrono', name: 'Chrono Dilate', slot: 'mobility', rarity: 'legendary',
      desc: 'Dashing briefly slows everything but you — dodge into bullet-time.',
      apply: (s) => { s.chronoDilate = true; },
    },

    // ============ UTILITY ============
    'u-amplifier': {
      id: 'u-amplifier', name: 'Echo Amplifier', slot: 'utility', rarity: 'uncommon', stack: true,
      desc: 'Echo reaches farther and wider, costs less — but you pulse slower.',
      apply: (s) => { s.echoRangeMul *= 1.35; s.echoBandMul *= 1.4; s.echoHoldAdd += 1.4; s.echoCostAdd -= 3; s.echoCdAdd += 0.3; },
    },
    'u-twinpulse': {
      id: 'u-twinpulse', name: 'Twin-Pulse Resonator', slot: 'utility', rarity: 'rare',
      desc: 'Every echo fires two rings: double reveal & echo-hits. Pricier.',
      apply: (s) => { s.twinPulse = true; s.echoCostAdd += 5; },
    },
    'u-magnet': {
      id: 'u-magnet', name: 'Salvage Magnet', slot: 'utility', rarity: 'common',
      desc: 'Pulls in salvage and energy within 130px. Nodes yield more.',
      apply: (s) => { s.magnetRange = Math.max(s.magnetRange, 130); s.magnetBonus = 20; },
    },
    'u-battery': {
      id: 'u-battery', name: 'Static Battery', slot: 'utility', rarity: 'uncommon', stack: true,
      desc: '+40 max energy and a much shorter regen delay. A deep tank.',
      apply: (s) => { s.energyMaxAdd += 40; s.regenDelayAdd -= 0.25; },
    },
    'u-reserves': {
      id: 'u-reserves', name: 'Reserve Cells', slot: 'utility', rarity: 'common', stack: true,
      desc: '+25 max energy. Feed the battery. Stacks.',
      apply: (s) => { s.energyMaxAdd += 25; },
    },
    'u-lens': {
      id: 'u-lens', name: 'Predator Lens', slot: 'utility', rarity: 'rare',
      desc: 'Echo/light MARKS foes 3.5s: +30% damage, outlined even in the dark.',
      apply: (s) => { s.markFromEcho = true; s.markDur = 3.5; },
    },
    'u-floodlight': {
      id: 'u-floodlight', name: 'Floodlight Rig', slot: 'utility', rarity: 'uncommon',
      desc: 'Your flashlight throws a wider, longer cone and sips less battery.',
      apply: (s) => { s.flashRangeMul *= 1.4; s.flashArcMul *= 1.4; s.flashDrainMul *= 0.6; },
    },
    'u-lumen': {
      id: 'u-lumen', name: 'Lumen Plating', slot: 'utility', rarity: 'common', stack: true,
      desc: '+20% passive light radius. See a little more of the dark. Stacks.',
      apply: (s) => { s.lightInnerMul *= 1.2; s.lightOuterMul *= 1.2; },
    },
    'u-nova': {
      id: 'u-nova', name: 'Echo Nova', slot: 'utility', rarity: 'legendary', stack: true,
      desc: 'Your echo pulse also detonates: a damaging shockwave that flings foes back. Stacks.',
      apply: (s) => { s.echoNova += 26; },
    },

    // ============ DEFENSE ============
    'd-deflector': {
      id: 'd-deflector', name: 'Deflector Shield', slot: 'defense', rarity: 'common',
      desc: 'Hold [Right-Mouse]: frontal shield blocks projectiles. Drains energy, slows you.',
      apply: (s) => { s.shieldHold = true; },
    },
    'd-hardplate': {
      id: 'd-hardplate', name: 'Hardplate', slot: 'defense', rarity: 'common', stack: true,
      desc: '+40 hull, -25% damage taken. But -15% speed and a costlier dash.',
      apply: (s) => { s.hullMaxAdd += 40; s.armorMul *= 0.75; s.speedMul *= 0.85; s.dashCostAdd += 4; },
    },
    'd-plating': {
      id: 'd-plating', name: 'Ablative Plating', slot: 'defense', rarity: 'common', stack: true,
      desc: '+25 max hull. No downside. Stacks.',
      apply: (s) => { s.hullMaxAdd += 25; },
    },
    'd-nanofield': {
      id: 'd-nanofield', name: 'Reactive Nanofield', slot: 'defense', rarity: 'rare',
      desc: 'On hit: retaliation burst reveals, damages (12), and stuns attackers.',
      apply: (s) => { s.retaliate = 12; s.retaliateStun = 0.4; s.retaliateEnergy = 8; },
    },
    'd-corevent': {
      id: 'd-corevent', name: 'Core Vent', slot: 'defense', rarity: 'legendary',
      desc: 'Once/sector: a lethal hit leaves you at 1 hull, venting all energy as a nuke.',
      apply: (s) => { s.coreVent = true; },
    },
    'd-bulwark': {
      id: 'd-bulwark', name: 'Bulwark Field', slot: 'defense', rarity: 'rare',
      desc: 'A rechargeable bubble absorbs damage from any direction, then reforms.',
      apply: (s) => { s.bulwark += 45; s.bulwarkRegenDelay = 4; s.bulwarkRegen = 18; },
    },
  };

  function bySlot(slot) { return Object.values(MODULES).filter(m => m.slot === slot); }

  RE.MODULES = MODULES;
  RE.modulesBySlot = bySlot;
})(window.RE = window.RE || {});
