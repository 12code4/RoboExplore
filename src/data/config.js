/* RoboExplore — central configuration & tunables.
 * Values follow the design bible's Core Mechanics spec. One place to tune feel.
 */
(function (RE) {
  'use strict';

  const CFG = {
    version: '1.3.1',

    // Rendering ----------------------------------------------------------
    viewW: 960,
    viewH: 540,
    maxDPR: 2,

    // World --------------------------------------------------------------
    tile: 28,

    // Player -------------------------------------------------------------
    player: {
      radius: 14,
      // movement (target-velocity move-toward model)
      maxSpeed: 130,
      accel: 1200,         // px/s^2 toward target velocity
      decel: 2000,         // px/s^2 when no input
      // dash
      dashDist: 110,
      dashTime: 0.14,      // dashSpeed = dist/time ~= 785 px/s
      dashIframes: 0.18,
      dashCost: 18,
      dashCooldown: 0.45,
      dashExitInherit: 0.40,
      // echo pulse
      echoCost: 10,
      echoCooldown: 0.30,
      echoSpeed: 560,      // ring growth px/s
      echoMaxRadius: 360,
      echoBandWidth: 30,   // wash band behind the front
      echoTileHold: 0.4,   // tiles stay full-bright this long
      echoTileFadeTau: 1.4,// then decay with this exponential tau
      ghostFloor: 0.06,    // permanent dim memory of ever-seen tiles
      enemyVisFade: 0.8,   // seconds for enemy reveal to fade
      // passive light
      lightInner: 46,
      lightOuter: 92,
      // hull
      hullMax: 100,
      hitIframes: 0.6,
      knockback: 220,
      contactDamageCd: 0.5,
      // energy
      energyMax: 100,
      energyRegen: 15,
      energyRegenDelay: 0.5,
      // default weapon: Rivet Driver (kinetic, free)
      weaponDamage: 9,
      fireRate: 6,
      shotSpeed: 640,
      shotLife: 0.6,
      shotSpread: 0.052,   // ~3 degrees
      shotRadius: 3.2,
      shotLightR: 14,      // light-caster reveal radius
      shotEnergy: 0,       // kinetic
      // twists
      markTime: 1.2,       // echo-resonance mark duration
      markDamageMul: 1.4,
      echoChargeWindow: 0.4,
      echoChargeMul: 1.25,
      pingSpeed: 700,
    },

    // Echo / lighting ----------------------------------------------------
    light: {
      memoryLevel: 0.06,     // ghost floor
      revealThreshold: 0.28, // entity visibility threshold from ambient light
      fogColor: '#04060b',
    },

    // Energy nodes -------------------------------------------------------
    node: {
      radius: 40,
      fill: 60,            // energy/s while docked
      repair: 30,          // hull/s while docked
      charge: 120,         // total budget before inert
    },

    // Camera -------------------------------------------------------------
    camera: {
      followLambda: 9,
      lookAheadVel: 0.12,
      lookAheadMax: 48,
      aimBias: 0.25,
      aimMax: 60,
      deadzone: 12,
      maxShake: 16,
      shakeRot: 0.04,
      traumaDecay: 1.4,
    },

    // Combat / juice -----------------------------------------------------
    hitStopKill: 0.02,
    hitStopHurt: 0.05,
    hitStopBoss: 0.12,
    hitStopMax: 0.12,

    // Progression --------------------------------------------------------
    sectorsPerRun: 15,
    biomeSize: 3,

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
