# Changelog

All notable changes to RoboExplore are documented here. This project uses a
descent through milestones: vertical slice → **1.0-alpha** → **1.0** → post-1.0
content & polish updates.

## [1.3.2] — Polish Pass B
Final refinement sweep.

### Added / Changed
- Clearer boss sweep/gaze telegraphs: a bright wedge preview traces the beam's
  path during the tell (with a short grace so it never hits on frame one).
- A driving, pulsing boss-fight music layer over the ambient bed.
- README documents the Daily Run, Deep Descent, and accessibility options.
- Verified no regressions from the Pass A fixes via the full test suite, boss
  runs, the playtest bot, and a Daily-determinism check.

## [1.3.1] — Polish Pass A
Feel, fairness, and correctness across the post-1.0 systems, plus fixes from a
second adversarial multi-dimension code review (21 verified findings).

### Added / Changed
- Cinematic boss-death slow-motion + flash; descend whoosh; size-varied enemy
  death sounds; biome ambient motes (Hollows/Marrow); reticle flares gold during
  the Echo-Charge window; unmistakable pulsing danger-edges on hazards.
- Accessibility: screen-shake toggle (Full/Low/Off) in the pause menu.

### Fixed (review)
- Boss telegraphs are now honest: slam/aimed commit to the telegraphed angle
  instead of re-aiming at fire time; sweep beams show a wedge preview and never
  hit on frame one; boss add-caps count only summoned adds; boss damage scales
  with Deep Descent tiers; the dead boss dmgMul formula now works.
- Daily runs are reproducible: the module/station/reroll economy draws from
  dedicated deterministic streams instead of the master RNG (kills no longer
  desync a shared seed); log rolls are save-independent.
- Marrow overheat no longer bypasses the Emergency Reboot grace (no death-loop);
  environmental hazards ignore kinetic shields; periodic hazards use a local
  clock so they do not tick untelegraphed after a pause.
- Bulwark Field no longer grants free i-frames per hit, refills only when newly
  equipped, delays its reform on any hit, and consumes the projectile it blocks.
- Boss blackout now actually jams the player echo; core-shards honor the reward
  multiplier; a station Escape no longer also opens the pause menu; stations no
  longer offer already-equipped modules; unaffordable station buttons disable.

## [1.3.0] — Content Update: The Deep Descent (New Game+)
Escalating optional difficulty for players who have reached the Core.

### Added
- **The Deep Descent** — clearing the game unlocks Deep I; clearing each tier
  unlocks the next (up to Deep III). Higher tiers spawn more enemies with more
  hull and damage (bosses included) and pay out proportionally richer salvage
  and bonus core-shards. Selectable from the title once unlocked; the active
  tier is tagged in the HUD.

## [1.2.0] — Content Update: Daily Seed
A shared, deterministic run of the day, with a per-day personal best.

### Added
- **Daily Run** — one seed derived from the UTC date, so everyone descends the
  same Hollow that day. Score is tracked as a per-day best on the title screen,
  and the run tags its seed in the HUD for comparison.

## [1.1.0] — Content Update: New Modules
Four new drop-pool modules, each introducing a fresh engine capability.

### Added
- **Homing Swarm** (weapon) — fires seeking micro-missiles that hunt the nearest
  foe in the dark.
- **Bulwark Field** (defense) — a rechargeable omni-directional bubble that
  absorbs damage from any angle, then reforms.
- **Chrono Dilate** (mobility) — dashing briefly slows enemies, enemy fire, and
  boss beams while you move at full speed: dodge into bullet-time.
- **Echo Nova** (utility) — your echo pulse also detonates, dealing a damaging
  shockwave with knockback around you.

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
