# Changelog

All notable changes to RoboExplore are documented here. This project uses a
descent through milestones: vertical slice → **1.0-alpha** → **1.0** → post-1.0
content & polish updates.

## [1.0.0] — Release 🚀
The complete game: a full descent from the Drowned Intake to the Hollow Heart.

### Added
- **Five bespoke, multi-phase bosses** — VAULK, ATLAS-7, MNEME, RIG-0, and the
  finale AXIS — each with self-lit, telegraphed attack scripts (radial, aimed,
  spiral, shockwave, slam, rotating sweep-beams, add-spawns, sight-stealing
  blackout, and AXIS's supernova) and a boss health bar. Beating AXIS wins.
- **Reconstructor Stations** — an in-run salvage economy: install rarity-priced
  modules, repair, tap free energy, or reroll stock (press R when near one).
- **Environmental hazards** per biome: EM surges that jam echo + arc floors
  (Vaults), lava rifts + idle-overheat (Marrow), spore clouds (Hollows), and
  ice-slide movement (Cryostacks).
- **The Reclaimer** overstay hunter — escalating self-lit pursuers if you camp
  a sector past ~2.5 minutes.
- **Two endings** (the ascent, and a hidden twist when both key logs are found),
  first-run onboarding tips, a Codex log reader (title & pause), and an
  "afford now" meta-nudge on death.
- Juice: atmospheric vignette, hurt/impact screen flash, low-energy heartbeat,
  kill-only hit-stop, velocity + aim camera look-ahead, a glowing echo annulus.

### Changed / Fixed
- Retuned every core constant to the canonical design values; kinetic free
  "Rivet Driver" default weapon.
- Balance & correctness pass from an adversarial multi-dimension code review
  (14 verified findings): the Echo Wraith now deals damage; mines survive
  pulses; Nanofield stun works; Skitter no longer outruns the player; weapon
  base damage matches canon; heavy filler enemies are capped per sector.

## [0.5.0-alpha] — 1.0-Alpha
Feature-complete core loop, playable end to end and reconciled against the full
design bible (`docs/DESIGN.md`).

### Added
- **The four signature twists.** Echo-Resonance (pulses mark enemies for +40%
  damage) + Echo-Charge (shots fired just after a pulse hit harder & pierce);
  Echo-Return pings (colored blips travel back to you, giving directional intel
  that outlives the reveal); "the Hollow listens" (pulses aggro nearby enemies).
- **10 designed enemies**, each built around light/darkness: Lumen Moth
  (pulse-drawn swarm), Silt Lurker (buried ambush), Gloom Crawler (weeping-angel
  that freezes when lit), Sparkfly (self-lit orbiting pod), Rift Spitter (caustic
  puddles), Warden Node (pulse-charged beam turret), Echo Wraith (phase predator),
  Barnacle (proximity mine), Hollow Stalker (apex pouncer), Abyssal Eye
  (open-to-damage gaze) — plus the Skitter filler.
- **18 modules** across weapon/mobility/utility/defense with a data-driven weapon
  system (scatter, ricochet, charge-lance, echo-damage, surge), phase/blink dash,
  momentum regen, shields, reactive defenses, and a lethal-save Core Vent.
- **5 biomes** (the echo-arc: dark → bright → attacked → extended → weaponized)
  with distinct palettes, cave-gen tuning, enemy pools, and echo/energy modifiers.
- **Threshold guardians** with a boss health bar gating each biome's exit.
- **Finite energy nodes** (dock to recharge & repair) reinforcing route decisions.
- **Meta-progression** "Reconstructor" Dry Dock tree (persistent core-shards,
  prereq-gated upgrades) applied at run start; first-reach depth milestones.
- **Narrative**: 16 discoverable log fragments + a Codex reader.
- Retuned to the canonical design constants (movement, dash, echo, energy, camera).
- Player-centered camera; on-robot energy ring; hazard zones (spitter puddles).

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
