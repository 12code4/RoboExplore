# Changelog

All notable changes to RoboExplore are documented here. This project uses a
descent through milestones: vertical slice → **1.0-alpha** → **1.0** → post-1.0
content & polish updates.

## [0.1.0-slice] — Vertical Slice
The bootable core: prove the game feels good before building out content.

### Added
- Zero-dependency engine: fixed-timestep loop, aspect-preserving canvas,
  seeded RNG, vector/easing math, pooled particles, trauma-based camera shake.
- **Echo-Sight** system: dark world revealed by expanding echo pulses, passive
  light, and dim "memory" of seen tiles.
- Procedural cavern generation (cellular automata) with guaranteed connectivity
  and far-apart spawn/exit placement.
- Player robot: acceleration movement, dash with i-frames, echo pulse, unified
  energy pool, modular weapon fire.
- Four enemy archetypes with echo-aware AI: chaser, ranged, invisible ambusher,
  and orbiter.
- Pickups (salvage, energy, hull, modules, core-shards) that are dim until
  revealed by light.
- Modules across weapon/mobility/utility/defense slots with real trade-offs.
- Three biomes, sector descent, module-cache reward screen, meta-progression
  (Reconstructor) with persistent core-shard upgrades.
- WebAudio synth SFX + shifting ambient music bed.
- HUD, title/pause/game-over/reward/meta menus with mouse + keyboard nav.
- Headless Playwright smoke test.
