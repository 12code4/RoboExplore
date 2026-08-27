/* RoboExplore — module definitions (loadout parts).
 * Slots: weapon / mobility / utility / defense. The player has limited slots.
 * `apply` mutates player stats when equipped; `hooks` provide event behavior.
 * Vertical-slice set; design bible expands to the full ~18 during alpha.
 */
(function (RE) {
  'use strict';

  const MODULES = {
    // --- Weapons -------------------------------------------------------
    blaster: {
      id: 'blaster', name: 'Pulse Blaster', slot: 'weapon', rarity: 'common',
      desc: 'Reliable rapid energy bolts.',
      weapon: { fireRate: 4.5, shotSpeed: 560, damage: 12, energy: 4, spread: 0.04, count: 1, radius: 4, color: '#8ff', life: 0.85 },
    },
    scatter: {
      id: 'scatter', name: 'Scatter Coil', slot: 'weapon', rarity: 'uncommon',
      desc: 'Fires a close-range spray. Brutal up close, weak at range.',
      weapon: { fireRate: 1.7, shotSpeed: 500, damage: 6, energy: 7, spread: 0.5, count: 6, radius: 3, color: '#ffd27a', life: 0.35 },
    },
    railcaster: {
      id: 'railcaster', name: 'Railcaster', slot: 'weapon', rarity: 'rare',
      desc: 'Slow, piercing high-damage lance.',
      weapon: { fireRate: 1.1, shotSpeed: 820, damage: 34, energy: 12, spread: 0, count: 1, radius: 5, color: '#b6f', life: 1.1, pierce: 3 },
    },

    // --- Mobility ------------------------------------------------------
    overclock: {
      id: 'overclock', name: 'Overclock Servos', slot: 'mobility', rarity: 'uncommon',
      desc: '+22% move speed, faster dash recovery.',
      apply: (p) => { p.stats.speedMul *= 1.22; p.stats.dashCdMul *= 0.7; },
    },
    phase: {
      id: 'phase', name: 'Phase Dash', slot: 'mobility', rarity: 'rare',
      desc: 'Dash passes through enemies and grants longer i-frames.',
      apply: (p) => { p.stats.dashIframeMul *= 2.2; p.stats.phaseDash = true; p.stats.dashDistMul *= 1.15; },
    },

    // --- Utility -------------------------------------------------------
    echoamp: {
      id: 'echoamp', name: 'Echo Amplifier', slot: 'utility', rarity: 'common',
      desc: 'Echo pulses reach 35% farther and reveal longer.',
      apply: (p) => { p.stats.echoRangeMul *= 1.35; p.stats.echoHoldMul *= 1.4; },
    },
    magnet: {
      id: 'magnet', name: 'Salvage Magnet', slot: 'utility', rarity: 'common',
      desc: 'Pulls nearby salvage and energy toward you.',
      apply: (p) => { p.stats.magnetRange = Math.max(p.stats.magnetRange, 140); },
    },
    capacitor: {
      id: 'capacitor', name: 'Capacitor Bank', slot: 'utility', rarity: 'uncommon',
      desc: '+40 max energy, +30% regen.',
      apply: (p) => { p.stats.energyMaxAdd += 40; p.stats.energyRegenMul *= 1.3; },
    },

    // --- Defense -------------------------------------------------------
    plating: {
      id: 'plating', name: 'Ablative Plating', slot: 'defense', rarity: 'common',
      desc: '+35 max hull. Slightly heavier.',
      apply: (p) => { p.stats.hullMaxAdd += 35; p.stats.speedMul *= 0.96; },
    },
    barrier: {
      id: 'barrier', name: 'Kinetic Barrier', slot: 'defense', rarity: 'uncommon',
      desc: 'Regenerating shield absorbs one hit every few seconds.',
      apply: (p) => { p.stats.barrier = true; p.stats.barrierCd = 6; },
    },
    thorns: {
      id: 'thorns', name: 'Discharge Coat', slot: 'defense', rarity: 'rare',
      desc: 'Taking a hit releases a damaging discharge pulse.',
      apply: (p) => { p.stats.discharge = 28; },
    },
  };

  // Convenience: list by slot for reward rolls.
  function bySlot(slot) {
    return Object.values(MODULES).filter(m => m.slot === slot);
  }

  RE.MODULES = MODULES;
  RE.modulesBySlot = bySlot;
})(window.RE = window.RE || {});
