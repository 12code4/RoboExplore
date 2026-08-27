/* RoboExplore — seeded pseudo-random number generation
 * Deterministic RNG so a given seed reproduces a run's world.
 */
(function (RE) {
  'use strict';

  // mulberry32: fast, decent-quality 32-bit PRNG.
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Hash a string into a 32-bit seed (xfnv1a-ish).
  function hashSeed(str) {
    str = String(str);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeRNG(seed) {
    const numSeed = typeof seed === 'number' ? (seed >>> 0) : hashSeed(seed);
    const next = mulberry32(numSeed);
    const api = {
      seed: numSeed,
      next,                                   // float [0,1)
      float: (min, max) => min + next() * (max - min),
      int: (min, max) => Math.floor(min + next() * (max - min + 1)), // inclusive
      range: (min, max) => min + next() * (max - min),
      bool: (p = 0.5) => next() < p,
      sign: () => (next() < 0.5 ? -1 : 1),
      pick: (arr) => arr[(next() * arr.length) | 0],
      // Weighted pick: items = [{w, ...}] or ([item], [weight]).
      weighted: (items, weightFn) => {
        let total = 0;
        for (const it of items) total += weightFn ? weightFn(it) : (it.w || 1);
        let r = next() * total;
        for (const it of items) {
          r -= weightFn ? weightFn(it) : (it.w || 1);
          if (r <= 0) return it;
        }
        return items[items.length - 1];
      },
      shuffle: (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = (next() * (i + 1)) | 0;
          const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      },
      // Angle in radians, full circle.
      angle: () => next() * Math.PI * 2,
      // Fork a child RNG (deterministic, independent stream).
      fork: (salt) => makeRNG((numSeed ^ hashSeed('' + salt)) >>> 0),
    };
    return api;
  }

  // A default, non-deterministic seed generator for run seeds.
  function randomSeed() {
    return (Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  RE.RNG = { make: makeRNG, hashSeed, randomSeed, mulberry32 };
})(window.RE = window.RE || {});
