/* RoboExplore — biome definitions (the "echo-arc": dark → bright → attacked →
 * extended → weaponized). Each spans CFG.biomeSize sectors. Palette, cave-gen
 * tuning, enemy pool, boss guardian, music index, and echo/movement modifiers.
 */
(function (RE) {
  'use strict';

  const BIOMES = [
    {
      id: 'intake', name: 'The Drowned Intake',
      palette: { wall: '#14232e', wallHi: '#1d4150', floor: '#0a1a24', accent: '#3fb6c4', fog: '#04080c' },
      gen: { fill: 0.44, steps: 4, openness: 1 },
      enemies: ['skitter', 'lumen_moth', 'silt_lurker'],
      boss: null, music: 0,
      mod: {},   // honest dark; the baseline
      vibe: 'The first breath of a dead machine. Cold water pools in the dark.',
    },
    {
      id: 'hollows', name: 'The Mycelic Hollows',
      palette: { wall: '#241a30', wallHi: '#3a2a5a', floor: '#14111c', accent: '#7dffb0', fog: '#070510' },
      gen: { fill: 0.47, steps: 5, openness: 0 },
      enemies: ['skitter', 'sparkfly_swarm', 'gloom_crawler', 'silt_lurker'],
      boss: null, music: 1,
      mod: { memoryFloor: 0.16 },   // bioluminescent: brighter ambient
      vibe: 'Beautiful and toxic. Here you can finally see — and that is the danger.',
    },
    {
      id: 'vaults', name: 'The Static Vaults',
      palette: { wall: '#2b2418', wallHi: '#3a4048', floor: '#14110b', accent: '#ffb020', fog: '#060402' },
      gen: { fill: 0.40, steps: 3, openness: 0 },
      enemies: ['skitter', 'sparkfly_swarm', 'rift_spitter', 'warden_node'],
      boss: null, music: 2,
      mod: { echoRangeMul: 0.75, emp: true },   // EM interference dampens echo
      vibe: 'The machine is awake and it does not want you here. Your sight falters.',
    },
    {
      id: 'cryostacks', name: 'The Cryostacks',
      palette: { wall: '#1c3040', wallHi: '#2f5a72', floor: '#0e1a26', accent: '#b8f0ff', fog: '#030810' },
      gen: { fill: 0.42, steps: 4, openness: 1 },
      enemies: ['gloom_crawler', 'rift_spitter', 'echo_wraith', 'hollow_stalker'],
      boss: null, music: 3,
      mod: { echoRangeMul: 1.35, ice: true, decelMul: 0.35 },   // cold air conducts: echo reaches far, floor slides
      vibe: 'Cold, immense, lethally beautiful. You see far — but cannot brake.',
    },
    {
      id: 'marrow', name: 'The Core Marrow',
      palette: { wall: '#2a0d0a', wallHi: '#5a1a10', floor: '#160604', accent: '#ffd23f', fog: '#0a0200' },
      gen: { fill: 0.46, steps: 4, openness: 0 },
      enemies: ['barnacle_mine', 'rift_spitter', 'echo_wraith', 'hollow_stalker', 'leviathan_eye'],
      boss: null, music: 4,
      mod: { memoryFloor: 0.20, energyRegenMul: 1.6, overheat: true },   // self-lit furnace, energy overcharged
      vibe: 'Blinding, roaring, alive with power. The ground itself burns toward the Core.',
    },
  ];

  function biomeForSector(sector) {
    const idx = Math.floor((sector - 1) / RE.CFG.biomeSize);
    return BIOMES[Math.min(idx, BIOMES.length - 1)];
  }

  // Guardian for a threshold sector (every biomeSize sectors). Alpha uses
  // scaled apex enemies as guardians; bespoke bosses arrive at 1.0.
  const GUARDIANS = {
    intake: 'silt_lurker',
    hollows: 'gloom_crawler',
    vaults: 'warden_node',
    cryostacks: 'hollow_stalker',
    marrow: 'leviathan_eye',
  };

  RE.BIOMES = BIOMES;
  RE.biomeForSector = biomeForSector;
  RE.GUARDIANS = GUARDIANS;
})(window.RE = window.RE || {});
