/* RoboExplore — biome definitions (palette, hazard, gen tuning, enemy pool).
 * Each biome spans CFG.biomeSize sectors. Vertical-slice set; expanded by the
 * design bible during alpha (5 biomes total).
 */
(function (RE) {
  'use strict';

  const BIOMES = [
    {
      id: 'flooded', name: 'The Flooded Decks',
      palette: { wall: '#12303f', wallHi: '#1d4a5f', floor: '#0a1a24', accent: '#3fd6ff', fog: '#04080d' },
      gen: { fill: 0.46, steps: 5, openness: 0 },
      enemies: ['crawler', 'spitter', 'lurker'],
      music: 0,
      hazard: null,
      vibe: 'Cold water pools in the dark. Something moved.',
    },
    {
      id: 'reactor', name: 'The Reactor Warrens',
      palette: { wall: '#3a2418', wallHi: '#5a3a22', floor: '#1a1008', accent: '#ff9a3f', fog: '#0a0603' },
      gen: { fill: 0.48, steps: 5, openness: -1 },
      enemies: ['crawler', 'spitter', 'drone', 'lurker'],
      music: 1,
      hazard: null,
      vibe: 'Heat bleeds from ruptured coolant lines.',
    },
    {
      id: 'archive', name: 'The Silent Archive',
      palette: { wall: '#241a3a', wallHi: '#3a2a5a', floor: '#100a1c', accent: '#b06bff', fog: '#060410' },
      gen: { fill: 0.44, steps: 6, openness: 1 },
      enemies: ['spitter', 'drone', 'lurker'],
      music: 2,
      hazard: null,
      vibe: 'Data-ghosts flicker in the deep memory banks.',
    },
  ];

  function biomeForSector(sector) {
    const idx = Math.floor((sector - 1) / RE.CFG.biomeSize);
    return BIOMES[Math.min(idx, BIOMES.length - 1)];
  }

  RE.BIOMES = BIOMES;
  RE.biomeForSector = biomeForSector;
})(window.RE = window.RE || {});
