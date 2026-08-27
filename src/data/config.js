/* RoboExplore — central configuration & tunables.
 * Kept in one place so game feel can be tuned quickly. Numbers here are the
 * "vertical slice" defaults; the design bible refines them over the alpha.
 */
(function (RE) {
  'use strict';

  const CFG = {
    version: '0.1.0-slice',

    // Rendering ----------------------------------------------------------
    // Internal design resolution (letterboxed to fit the window).
    viewW: 960,
    viewH: 540,
    maxDPR: 2,

    // World --------------------------------------------------------------
    tile: 28,              // px per tile
    mapW: 72,              // tiles wide (varies per sector, this is a base)
    mapH: 72,

    // Player -------------------------------------------------------------
    player: {
      radius: 13,
      accel: 1500,         // px/s^2
      friction: 9,         // exponential damping factor
      maxSpeed: 165,       // px/s
      hullMax: 100,
      energyMax: 100,
      energyRegen: 16,     // per second
      energyRegenDelay: 0.55, // seconds after spending before regen resumes
      iframesOnHit: 0.7,   // invulnerability after taking damage
      contactDamageCd: 0.5,
      // Dash
      dashSpeed: 620,
      dashTime: 0.16,      // seconds of dash impulse
      dashCost: 22,
      dashCooldown: 0.42,
      dashIframes: 0.22,
      // Echo pulse
      echoCost: 14,
      echoCooldown: 0.9,
      echoSpeed: 620,      // ring expansion px/s
      echoMaxRadius: 430,
      echoRevealHold: 2.6, // seconds tiles stay bright after being washed
      echoBandWidth: 46,   // thickness of the illuminating ring band
      passiveLight: 92,    // radius of always-on light
      // Primary weapon (default blaster)
      fireRate: 4.5,       // shots/sec
      shotSpeed: 560,
      shotDamage: 12,
      shotEnergy: 4,
      shotLife: 0.85,
      shotRadius: 4,
    },

    // Echo / lighting ----------------------------------------------------
    light: {
      memoryLevel: 0.14,   // brightness of previously-seen-but-dark tiles
      revealThreshold: 0.30, // brightness at/above which entities are visible
      fogColor: '#04060b',
    },

    // Camera -------------------------------------------------------------
    camera: {
      followLambda: 7,     // higher = snappier
      lookAhead: 0.10,     // fraction of velocity to lead
      maxShake: 22,
    },

    // Combat / juice -----------------------------------------------------
    hitStopMax: 0.08,      // seconds

    // Progression --------------------------------------------------------
    sectorsPerRun: 15,
    biomeSize: 3,          // sectors per biome

    // Debug --------------------------------------------------------------
    debug: {
      showColliders: false,
      revealAll: false,
      invincible: false,
      fps: false,
    },
  };

  RE.CFG = CFG;
})(window.RE = window.RE || {});
