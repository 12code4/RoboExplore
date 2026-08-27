# ROBOEXPLORE — MASTER DESIGN BIBLE (v1.0)
**Single source of truth for the vanilla-JS build.** This document reconciles the eight source specs (Mechanics, Enemies, Modules, Biomes, Bosses, Meta/Economy, Audio/Juice, Narrative) into one non-contradictory design. Where sources conflicted, the final chosen value is stated here and the resolution is logged in **§15 Conflict Ledger**. All other design docs are now subordinate to this file.

Guiding principle for every conflict: **the Mechanics & Game-Feel spec is authoritative for moment-to-moment tuning.** The existing `src/data/config.js` header itself says its numbers are "vertical slice defaults; the design bible refines them," so the refined feel values below **replace** the placeholder code constants.

---

## 0. VISION & PILLARS

**RoboExplore** is a top-down, canvas, vanilla-JS **exploration roguelite** built on four pillars:

1. **ECHO-SIGHT in the dark.** The world is near-black. You navigate by rhythmic echo pulses that briefly wash geometry and enemies into view, then fade. *Pulse → glimpse → move → pulse.*
2. **One unified ENERGY pool.** Seeing (pulse), escaping (dash), shielding, and energy-weapons all spend the same pool. Vision competes with survival.
3. **Modular robot (EX-0).** Four slots (weapon / mobility / utility / defense) reshape the build; every module is a real trade-off.
4. **Descent roguelite + meta-progression.** 15 sectors / 5 biomes down to the Core. Permadeath, but persistent **Core-Shards** rebuild EX-0 stronger. "One more run."

**Tone (narrative):** industrial, hushed, elegiac. The Hollow is a submerged dead machine. Sparse, cold, diegetic. Sound is your own robot against near-silence.

**Frame:** player radius **14px**, base speed **130px/s**, tile **28px**, top-down twin-stick, ~60fps, no physics engine, all art procedural, all audio synthesized (WebAudio).

---

## 1. GLOBAL CONSTANTS & TIMESTEP (CANONICAL)

Fixed-step accumulator loop (already implemented in `main.js`):
```
acc += min(realDt, MAX_ACC=0.05)          // clamp against spiral-of-death
while (acc >= 1/60) { step(1/60); acc -= 1/60 }
render(acc / (1/60))                        // interpolate for smoothness
```
- Aim model: **twin-stick** — mouse aims, WASD moves (right stick aims on gamepad). Movement and facing decoupled.
- Collision: circle (player/enemy) vs **AABB tiles**, resolved **per-axis X then Y** (wall-slide, never stick); circle-vs-circle for actors.
- Render: additive-glow lighting buffer over near-black base; fog color per biome.

### 1.1 Master constants block (final values — supersede `config.js` slice defaults)
```
// WORLD
TILE=28; PLAYER_R=14; MAX_ACC=0.05
// MOVEMENT  (target-velocity move-toward model; replaces exp-damping)
MAX_SPEED=130; ACCEL=1200; DECEL=2000          // 0.108s to max, 0.065s to stop
// DASH
DASH_DIST=110; DASH_TIME=0.14; DASH_SPEED=785; DASH_IFRAME=0.18
DASH_COST=18; DASH_CD=0.45; DASH_EXIT_INHERIT=0.40
// ECHO PULSE
PULSE_COST=10; PULSE_CD=0.30; PULSE_GROWTH=560; PULSE_MAX_R=360; PULSE_BAND=30
TILE_HOLD=0.4; TILE_FADE_TAU=1.4; REVEAL_HOLD_EFF=2.6; GHOST_FLOOR=0.06
ENEMY_VIS_FADE=0.8; PING_SPEED=700
// PASSIVE LIGHT
LIGHT_INNER=46; LIGHT_OUTER=92
// ENERGY
ENERGY_MAX=100; ENERGY_REGEN=15; REGEN_DELAY=0.5
// ENERGY NODE
NODE_FILL=60; NODE_REPAIR=30; NODE_CHARGE=120; NODE_R=40
// HULL
HULL_MAX=100; HIT_IFRAME=0.6; KNOCKBACK=220; CONTACT_DMG=10; REPAIR_PICKUP=20
// PRIMARY WEAPON — Rivet Driver (KINETIC, FREE)
DMG=9; RPM=6; PROJ_SPD=640; PROJ_LIFE=0.6; SPREAD_DEG=3; PROJ_LIGHT_R=14
// ECHO-RESONANCE
MARK_TIME=1.2; MARK_DMG_MULT=1.40; ECHOCHARGE_WINDOW=0.4; ECHOCHARGE_MULT=1.25
// LIGHT MODEL
MEMORY_LEVEL=0.14; REVEAL_THRESHOLD=0.30
// CAMERA
CAM_K=9; LOOKAHEAD_VEL=0.12; LOOKAHEAD_MAX=48; AIM_BIAS=0.25; AIM_MAX=60; DEADZONE=12
// SHAKE / JUICE
SHAKE_MAX=16; SHAKE_ROT=0.04; TRAUMA_DECAY=1.4; HITSTOP_MAX=0.08
// PROGRESSION
SECTORS_PER_RUN=15; BIOME_SIZE=3
```
> **Implementer note:** update `config.js` from the slice values (`maxSpeed 165→130`, `energyRegen 16→15`, `energyRegenDelay 0.55→0.5`, `echoCost 14→10`, `echoCooldown 0.9→0.30`, `echoSpeed 620→560`, `echoMaxRadius 430→360`, `echoBandWidth 46→30`, `dashSpeed→785`/`dashTime 0.16→0.14`/`dashCost 22→18`/`dashCooldown 0.42→0.45`/`dashIframes 0.22→0.18`, `shotDamage 12→9`/`fireRate 4.5→6`/`shotEnergy 4→0`/`shotSpeed 560→640`/`shotLife 0.85→0.6`, `radius 13→14`, `maxShake 22→16`, `followLambda 7→9`). The move model changes from exponential friction to accel/decel move-toward (friction damping is acceptable only if it hits 0.108s-to-max / 0.065s-to-stop).

---

## 2. PLAYER — MOVEMENT & DASH

### 2.1 Movement (snappy with weight)
Target-velocity model. `dir` = unit input vector (diagonals clamped to length 1).
```
target = dir * MAX_SPEED
rate   = (dir.len>0) ? ACCEL : DECEL
vel    = moveToward(vel, target, rate*dt)   // vector move-toward, capped
pos   += vel*dt                             // collide per-axis
```
- Wall-slide via per-axis resolve. Wall-slam: speed>500 into a wall (post-dash) adds **0.20 trauma**.
- Feel: instant response, ~1/9s glide reads as "heavy servo robot," hard-ish stop enables precision dodging.

### 2.2 Dash / Boost (the escape verb)
Fixed-vector burst in move direction (or facing if idle).
| Param | Value |
|---|---|
| Distance / duration / speed | 110px / 0.14s / ~785px/s |
| i-frames | 0.18s from dash start |
| Energy cost | **18** |
| Cooldown | 0.45s from dash start |
| Control | input locked during 0.14s; exit inherits ~40% dash speed (skid) |
| Regen | paused during dash + normal 0.5s post-spend delay |
| Trauma / VFX | +0.10; 60px trail + 2 ghost afterimages |
| Fail | blocked if energy<18 or on CD → "clunk" + red energy-ring flash |

Dash length ≈ one sight-cadence step: cross a revealed gap before it fades.

---

## 3. ECHO-SIGHT — THE SIGNATURE SYSTEM

World renders to a **lighting buffer**: base darkness + additive glows from (a) passive light, (b) live pulse rings, (c) per-tile memory `mem` 0..1, (d) weapon/entity lights.

### 3.1 Passive light (always on)
Inner full-bright **46px**, falloff to 0 at **92px** (`1 - smoothstep(46,92,d)`). You see ~1.5 tiles clearly, ~3 as dim halo — **not enough to navigate; you must pulse.**

### 3.2 Echo pulse (primary sight verb)
Expanding bright annulus washing tiles/entities to full memory as its front crosses them.
| Param | Value |
|---|---|
| Growth | 560px/s |
| Max radius | 360px (lifetime ~0.64s) |
| Wash band | tiles within 30px behind front → `mem=1` |
| Cost / cooldown | **10** / **0.30s** (chainable but energy-gated) |
| Trauma | **0** (sacred — never shake on a pulse) |
| Visual | ~18px annulus + outer glow, opacity `1-(r/360)` |

**Memory decay (per frame):**
- **Tiles:** on wash `mem=1`, hold **0.4s**, then `mem *= exp(-dt/1.4)` → visually gone ~2.6s. Permanent **ghost floor** `mem=max(mem,0.06)` for any tile ever washed (remembered map shape, not contents).
- **Enemies:** carry `vis`; pulse sets `vis=1`, decays in **0.8s**. You can only target/hit an enemy while `vis>0`, OR it's lit by passive/weapon light, OR it's `marked` (§6.1).

### 3.3 Sustainability math (the sacred relationship — preserve in playtest)
`ENERGY_MAX=100, REGEN=15/s, REGEN_DELAY=0.5s`, pulse cost 10.
- **Relaxed** (pulse every 1.2s): spend 10, regen `15×(1.2−0.5)=10.5` → **net +0.5**. Sustainable forever.
- **Anxious** (every 0.8s): regen `15×0.3=4.5` → **net −5.5/s**, drains in ~18s.
- **Combat spam** (0.30s CD): ~100 energy in ~5 pulses — and combat also wants dash/shield. Under pressure you inevitably go **dark and blind** — the whole game.

> **Never break this:** relaxed pulsing net-positive, combat pulsing net-negative. This single relationship makes echo-sight generous in calm and terrifying in a fight.

### 3.4 Echo-Return pings (Twist B — sonar intel)
When a pulse front crosses a POI, spawn a **return blip** traveling back to the player at **700px/s**, fading on arrival (~0.5s), color-coded:
**Cyan** = Energy Node · **Gold** = Loot/Module · **Red** = enemy cluster/hazard · **Green** = Descent hatch. Directional intel that outlives the visual reveal.

### 3.5 "The Hollow listens" (Twist D — pulses are loud)
Any enemy within the pulse's max radius **orients toward the pulse origin** and gains brief aggro/seek. Staying dark is stealthy but blind; seeing costs noise. Both risk and energy flow from the same verbs.

---

## 4. ENERGY — THE UNIFIED POOL

| Param | Value |
|---|---|
| Max / regen / delay | 100 / **15/s** / **0.5s** after any spend |
| Drains | pulse 10 · dash 18 · shield 10/s (module) · energy weapons per-shot · nanofield 8/trigger |
| Empty | actions denied (clunk + red HUD-ring flash); movement + **kinetic** weapon still work |
| **Energy Node** | within 40px: **+60 energy/s**; finite **120 charge** per node, then inert. Route decisions, not camping. |

HUD: energy is a **thin ring around the player**, read peripherally while staring into the dark.

---

## 5. HULL (HEALTH) — SEPARATE, UNFORGIVING

| Param | Value |
|---|---|
| Max / passive regen | 100 / **none** |
| Repair | Repair pickup **+20**; Node repair **+30 hull/s** docked (shares the node's 120-charge budget) |
| Hit i-frames | **0.6s** (blink), independent of dash i-frames |
| Knockback | 220px/s away from source, decays at DECEL |
| Base contact | 10 dmg, 0.5s per-enemy touch cooldown |
| Death | hull ≤ 0 → detonate, run ends, bank meta-salvage |

Hull is scarce and non-renewable mid-sector → **avoidance via echo-sight** beats face-tanking.

---

## 6. PRIMARY WEAPON — "RIVET DRIVER" (default, kinetic, FREE)

The starter is **kinetic and costs NO energy**, so darkness+energy is the tension, not "can't shoot." *Energy weapons are a separate module category that taxes the pool.*
| Param | Value |
|---|---|
| Damage / rate | 9 / 6-per-sec (auto-fire), = 54 DPS |
| Projectile | 640px/s, 0.6s life (~384px), ±3° spread, 1 pellet |
| Recoil | 3px camera nudge opposite aim; no pushback |
| **Light-caster** | each projectile carries a 14px light and mini-washes tiles it passes (`mem=max(mem,0.5)`) — shooting into the dark reveals a faint lane |
| Impact | 4–6 spark burst + 0.02s hitstop on kill |

### 6.1 Twist A — Echo-Resonance (pulse → shoot rhythm)
A pulse-washed enemy becomes **`marked` for 1.2s**: takes **+40% damage** (Rivet → 12.6), emits a self-glow (r30) so it stays targetable as `vis` fades, and fragile enemies **flinch** (0.15s) on the wash.
Plus **Echo-Charge:** firing within **0.4s** of a pulse gives shots **+25% dmg and pierce 1**. The optimal combat loop *is* the exploration loop: pulse → unload into lit, marked targets → dash out.
> Mark stacking rule: the `marked` **+40%** bonus does not stack with itself. The Predator Lens module (§12) only extends mark **duration/sources**, it does not add a second multiplier.

---

## 7. CAMERA & JUICE (merged Mechanics + Audio)

### 7.1 Camera follow
```
lookAhead = clamp(vel*0.12, 48px) + toCursor*0.25 (max 60px)
target    = player.pos + lookAhead
cam += (target - cam) * (1 - exp(-9*dt))    // CAM_K=9, ~110ms settle
```
Deadzone 12px. Look-ahead biases view toward motion/aim so pulses reveal *ahead* of you.
**Directional recoil kick (cheap):** on shot/hurt, offset camera `−aimDir·3px`, damped over 120ms — a punch distinct from noise shake.

### 7.2 Screenshake — trauma model (CANONICAL: SHAKE_MAX=16, decay 1.4)
```
shakeAmp = 16 * trauma²   // squared: subtle small hits, punchy big
angleJit = 0.04 * trauma²
trauma  -= 1.4*dt          // clamp [0,1]
```
| Event | +Trauma | ~peak |
|---|---|---|
| **Echo pulse** | **0** | — (readability sacred) |
| Blaster shot | 0.05 | ~0.4px |
| Dash start | 0.10 | ~0.2px |
| Enemy death (small) | 0.16 | ~0.4px |
| Enemy death (heavy/lurker) | 0.30 | ~1.4px |
| Energy/heavy weapon fire | 0.18 | ~0.5px |
| Take hit | `0.30 + dmg·0.015` (cap ~0.9) | scales |
| Shield break | 0.40 | ~2.5px |
| Wall-slam (post-dash) | 0.20–0.45 | up to ~3px |
| Sector complete | 0.20 | celebratory |
| Boss roar | 0.85 | ~12px |
| Boss slam / detonation | 1.0 | 16px |
| Player death | 1.0 | max, decays through fade |

### 7.3 Hit-stop (freeze sim, keep audio/shake/flash/render live; cap 0.08s)
| Event | ms | | Event | ms |
|---|---|---|---|---|
| Blaster hit | 0 | | Player hull damage | 60 |
| Heavy/charge hit | 30 | | Shield absorb | 25 |
| Enemy kill (small) | 45 | | Dash wall-slam | 50 |
| Enemy kill (heavy/lurker) | 70 | | Module equip | 60 |
| Boss slam | 80 | | Boss phase change | 70 |
| Player death | 80 + 350ms slow-mo (timescale 1→0.15, input stays live) |

### 7.4 Screen effects (composited after lighting, view space)
- **Flash frames** `Juice.flash(color,alpha)` decaying `flashA*=exp(-decay·dt)`: hurt `#ff2a3a` 0.28/dec9; enemy die glow 0.10/dec18; module equip accent 0.14/dec8; sector white 0.30/dec4; boss roar `#ff6a3f` 0.22/dec7; echo accent **0.06**/dec12 (whole screen breathes, no shake); death white→hold black over 1.2s.
- **Chromatic aberration** (offscreen red/cyan split, active only while dx>0.3px): hurt 5px · dash 3 · charge-release 4 · boss roar/slam 6 · death 8.
- **Vignette** (cached radial per biome, alpha-modulated): base always-on; **low-energy** red pulse in sync with heartbeat (§8) at energy<20%, hold 0.5 at 0; hurt spike +0.35 decay ~300ms; boss-present darken +0.1 tinted to boss color; death iris-out to black over 1.2s.

---

## 8. AUDIO — SUBMERGED DEAD MACHINE (condensed spec)

Every meaningful event = **synth layer + light layer + force layer** so feedback reads in the dark. Maps onto existing `RE.Audio/Particles/Camera`.

**Signal chain / shared nodes (build once in `_ensure()`):**
```
sources → sfxBus(0.9) ┐
        → spaceBus ────┤→ master(0.8) → compressor(-10,knee20,8:1,a3,r180) → out
music   → musicBus(0.5)┘
```
- **spaceBus** = feedback-delay reverb (delayA 0.09s / delayB 0.15s cross-fed, feedback 0.34, shared LP 1800Hz, out 0.5 to master). Per-SFX reverb send: echo 0.35, hurt 0.25, boss 0.6, enemy_die 0.2, sector 0.4, else 0.
- **duck(musicBus)** sidechain on echo (0.35/300ms), boss roar (0.6/600ms), hurt (0.3/250ms).
- **Voice guards:** `hit` throttle 1/40ms + pitch ±120c; `blip/ui` throttle 1/30ms; `shoot_beam` single re-triggered voice.

**Signature SFX — ECHO PULSE (the sonar):** sine 520→190Hz body (A4 D80 R440, LP 2600→600), triangle 780→300 air shimmer, downward-swept bandpass noise "wash tail" 1400→420Hz — the swept noise *is* the ring brushing geometry. Charged echo drops body to 430→150 + sub thump 62→48Hz. **Trauma 0.** (Full SFX roster: dash, per-weapon shoot, enemy hit [pitch ∝ remaining HP%], per-archetype death, hurt/shield, pickups, sector arpeggio, boss roar/telegraph/phase, death spin-down — see §2 of the Audio source, unchanged.)

**Low-energy heartbeat** (energy<20%): two-note fall sine 300→220Hz, period `T=0.6+0.6·(energy/20)` (1.2s→0.6s), music LP→600Hz, red vignette in sync; hysteresis stop at ≥22%; at 0 energy a long 300→180Hz groan, music LP→300Hz.

**Ambient music (per canonical biome, `startMusic(idx)`):** 3 detuned drones on a biome root + slow filter LFO. `setMusicIntensity(x)` where `x=clamp(awakeEnemies·0.18 + recentDamage·0.5, 0,1)`, τ0.5s: ≤0.35 drone only; >0.35 add gated bass pulse stem at biome BPM; >0.70 add tritone tension voice + LFO×2. Boss forces x=1 + sub timpani on downbeat.

| idx | Biome | Root | BPM | Character |
|---|---|---|---|---|
| 0 | Drowned Intake | A2 110 | 84 | watery, hollow, dripping |
| 1 | Mycelic Hollows | G2 98 | 96 | living grotto, soft bloom-chimes, faint lure-tone |
| 2 | Static Vaults | C3 130.81 | 72 | glassy major-7th + reversed shimmer pings, phantom static |
| 3 | Cryostacks | F2 87.31 | 88 | beating 2Hz cluster, brittle 1046Hz ice crackle |
| 4 | Core Marrow | D2 73.42 | 104 | deepest, tritone drone + slow sub-pulse, dread |

Transitions: sector→sector 1.2s crossfade + descent whoosh; biome→biome full stop, 0.8s silence ("held breath"), new root fades in over 3s; death = immediate stop, 1.4s fade.

**Master orchestrator:** route everything through `Juice.event(name,{x,y,dir,dmg})` so audio + particles + shake + flash + chroma + hitstop fire coherently (event→juice map per Audio source §8). Particle pool 1400; each burst caps its own count.

---

## 9. ENEMIES — CANONICAL BESTIARY

Three naming schemes in the source docs are reconciled here into **one roster**. The 10 richly-designed "signature" enemies are each a biome's showcase; 5 simple "filler/add" enemies recur and cover the generic biome names (drifter/skitter/turret/etc.) and boss adds. Every enemy referenced by any biome or boss now exists below. Enemy `firstSector` is re-derived from the biome layout for a smooth danger curve (overriding the compressed values in the source `enemies.js`).

### 9.1 Filler & add enemies
| id | Name | HP | Speed | Contact/Attack | Reveal | Danger | Notes / source aliases |
|---|---|---|---|---|---|---|---|
| skitter | Skitter | 10 | 130 | 6 melee | pulse/passive | 2 | fast swarmer, pods 2–4. Universal filler + boss add. |
| drifter | Drifter | 12 | 40 | proximity detonate 14 (arms <45px, 0.6s) | pulse only | 3 | slow floating mine. Variants: **frost** (slow on hit), **superheat** (4/s ignite). |
| sentry | Sentry Drone | 24 | 90 | ranged bolt 8 (220px/s) | self-lit | 4 | Hollow's immune reflex. Stationary variant **Sentry Turret** (HP 40, spd 0). Boss add. |
| angler | Angler | 20 | 70 | lure-strike 14 | self-lit lure only | 4 | dangles bright magenta lure to bait, then strikes. |
| sporeling | Sporeling | 12 | 100 | 5 melee; **death → spore cloud** (90px, 4/s, 6s) | pulse/flora | 3 | |
| jammer | Jammer | 28 | 85 | 4 chip; **aura −40% echo within ~5 tiles** | pulse | 5 | must be killed to see; Vaults. |
| sentinel | Sentinel | 60 (armored) | 70 | 12 melee, flank to damage rear | pulse/passive | 5 | patrols corridors. **Frost** & **molten** variants deeper. |
| frostling | Frostling | 14 | 100 | 5 melee; **death → freeze puff** (slow stacks) | pulse | 4 | |
| husk | Husk | 16 | 130 | **kamikaze detonate 22 fire-burst** | pulse (faint ember) | 5 | Marrow. |
| reclaimer | Reclaimer | 40×hpMult | 190 | 14 relentless | self-lit | — | **Anti-turtle:** spawns after 150s in a sector, then every 45s. Pure pressure, not a fail state. |

### 9.2 Signature enemies (one showcases each biome; stats final)
| id | Name | HP | Speed | Attack | Signature echo behavior | Danger | Biome |
|---|---|---|---|---|---|---|---|
| lumen_moth | Lumen Moth | 8 | 95 drift / 150 lured | contact 6 (re-hit 0.8s) | pods of 3–6, invisible embers; a pulse (or pulsing within 340px) **lures the whole pod** toward you, self-lit while feeding. Over-pulsing snowballs a glowing cloud. Tell: 0.35s wing-flare + whine. | 3 | 1 Intake |
| silt_lurker | Silt Lurker | 22 | 80 | lunge 16 (34px, only during 0.4s lunge) | **buried, reads as tile, invisible even in passive light**; only a pulse reveals it. Within 60px → 0.5s windup (cracks floor, commits lunge line) → lunge, then 1.5s exposed. | 4 | 1 Intake (returns 2) |
| gloom_crawler | Gloom Crawler | 34 | 145 | claw 12 (0.8s) | **Weeping-Angel** (= Mechanics Twist C archetype): hunts only in darkness at 145>player 130; the instant it enters passive light OR a live pulse ring, **FROZEN & armored (50% dmg)** as long as lit +0.3s. Hold it off with light, but light costs energy. Tell: 0.3s coil+growl when it un-freezes. | 5 | 2 Hollows |
| sparkfly_swarm | Sparkfly Swarm | 6 ea (pod 6–9) | 130 | dive 5 (3-fly = ~15) | **self-lit blue constellation** (needs no pulse to find, but silhouettes YOU). Every ~3s peels 2–3 to DIVE at 240px/s after 0.5s brighten. Kill the bright leader → rest scatter. Sweep weapons are the answer. | 4 | 2 Hollows |
| rift_spitter | Rift Spitter | 46 | 60 | glob 10 + caustic puddle 4/0.5s (~20), range 380 | dark, pulse-revealed body, but **its 0.9s charge-glow and glowing globs light the room** — you locate it by the light it makes. | 5 | 3 Vaults (molten var. 5) |
| warden_node | Warden Node | 120 shell / 60 core | 0 | sweep beam 8/0.4s, range 220; 100px auto-activate | **awoken by YOUR pulses** (1 charge/ring, activates at 2). Sweeps a rotating beam 4s, then 2.5s vulnerable cooldown. Slip past dark ones by not pulsing. | 6 | 3 Vaults |
| barnacle_mine | Barnacle Cluster | 14/cell | 0 | detonate 30→12 at 90px edge; chains adjacent | clusters of 3–5, cloaked as rock, **pulse-only reveal**. Enter 55px → 0.9s accelerating red blink → detonate. Shooting a cell also chains. | 5 | 3 Vaults |
| echo_wraith | Echo Wraith | 40 | 110 | slash 18 (40px, once/1.6s window) | **phased = invisible/untargetable/harmless**, drifts at you; a pulse both reveals AND materializes it for 1.6s — 0.4s in it **blinks onto you** and slashes. Counter: pulse from range, dash the 0.4s tell. | 6 | 4 Cryostacks (returns 5) |
| hollow_stalker | Hollow Stalker | 90 | 120 | pounce 24 (44px line); recover melee 10 | apex; **90% invisible unless you light it**, circles your ~90px light. Crouch 0.6s (bright throat self-light) → straight pounce 300px/s up to 200px. Miss → 1.2s recover, +50% dmg. Outlasts your energy. (= Cryostacks "stalker".) | 8 | 4 Cryostacks |
| leviathan_eye | Abyssal Eye | 240 shell / iris vulnerable | 40 | gaze cone 6/0.3s (~30), range 340; tear motes 5 | **mini-boss guarding a deep junction.** Shut = invisible & invulnerable; a pulse (or bright projectile) makes it **open** (0.7s) — the only damage window — but opening **fires the gaze**. Bait open, dodge cone, punish the 1.5s. | 9 | 5 Marrow |

**Fair-in-the-dark rule (all enemies):** every dangerous action is self-lit or has a bright/audible tell, so you never *need* to be mid-pulse to read an incoming threat. Player i-frames (0.6s hit / 0.18s dash) guarantee any single burst lands at most one hit.

---

## 10. BIOMES — THE ECHO-ARC (5 biomes × 3 sectors)

The five biomes form a deliberate arc of the signature mechanic: **honest dark → light eases → echo attacked → echo extended → echo weaponized.** This spine is canonical; boss and audio themes are reskinned to fit it (§11, §15). Base map **72×72 tiles, +2 tiles/strata.** Fog color per biome. `light.memoryLevel` baseline 0.14.

### Biome 1 — The Drowned Intake (S1–3) · *honest dark, the tutorial*
- **Palette:** wall `#14232e` / floor `#0c161d` / accent teal `#3fb6c4` / fog `#04080c`. Cold, still, wet.
- **Hazard — Floodwater & Undertow:** SHALLOW FLOOD (~35% of floor): player maxSpeed ×0.70 (130→~91) and echo revealHold 2.6→2.0s while submerged. DEEP CURRENT channels (2–3 tiles wide): constant 60px/s directional shove, no damage. Standing in flood near an arc source: one-time 6-hull zap (foreshadows Vaults). No drowning.
- **Gen:** CA fill 44%, 4 passes, B5/S4 → large rounded caverns. Openness HIGH ~58%. Flow-field carves 1–2 river channels; low tiles flood shallow. Largest region only. Node/exit on dry high ground.
- **Enemies:** Skitter, Drifter, Lumen Moth, Silt Lurker. (Soft-pitch set; teaches pulse→glimpse→move in gentle water.)

### Biome 2 — The Mycelic Hollows (S4–6) · *light eases — comfort is the danger*
- **Palette:** wall `#241a30` violet / floor `#14111c` / accent spore-green `#7dffb0` + lure-magenta `#ff5ec9` / fog `#070510`.
- **Hazard — Spore Blooms:** flora clusters cast passive light pools r110–130 (local memoryLevel ~0.30) — echo becomes optional. **SPORE PODS** (~1 per 45 tiles) burst if shot/touched/pulsed: 90px cloud, 6s, **4 hull/s AND halves passive light (92→46) inside**. Second cost: being lit lets ranged enemies target you ~30% farther. Light is safety and bait at once.
- **Gen:** CA fill 47%, 5 passes, B5/S5 → twistier caverns, alcoves. Openness MEDIUM ~48%. Feature density HIGH: flora ~1/60 tiles on wall edges, spore pods in pockets/chokes, root pillars break sightlines.
- **Enemies:** Skitter, Sporeling, Angler, Sparkfly Swarm, Gloom Crawler.

### Biome 3 — The Static Vaults (S7–9) · *echo attacked — you lose your sense*
> Merges the source "Static Vaults" (EM) and "Silent Archive" (perception) — both about static/interference degrading your echo. This is where MNEME the Archivist weaponizes phantom geometry.
- **Palette:** wall `#2b2418` rusted amber + steel `#3a4048` / floor `#14110b` / accent amber `#ffb020` + arc-blue `#6cc0ff` / fog `#060402`.
- **Hazard — EM Interference:** ambient static dampens pulses: echoMaxRadius ×0.70 (360→~250), revealHold 2.6→1.4s, **random phantom-echo flickers paint FALSE geometry** you must learn to distrust. Every 12–18s an **EMP** (0.8s whine tell): echo disabled 2.5s + HUD snows to static → rely on passive light + memory. **ARC FLOORS:** 2×2 patches, 2.0s-on/1.5s-off, 14 hull + 0.3s stun, 0.5s spark warning. Shootable **PYLONS** chain-zap into enemy packs. Guarantee ≥1 arc-free bypass per sector.
- **Gen:** CA fill 40%, 3 passes (rough edges), B5/S4, THEN overlay 4–6 rectangular vault rooms + straight 1–2 tile corridors (BSP-lite). Openness ~50%, heavily gated by chokes.
- **Enemies:** Sentry Drone/Turret, Jammer, Sentinel, Barnacle Cluster, Rift Spitter, Warden Node.

### Biome 4 — The Cryostacks (S10–12) · *echo extended — you see far, can't stop*
- **Palette:** wall `#1c3040` frozen blue-steel / floor `#0e1a26` / accent ice-cyan `#b8f0ff` + frost-white `#e8fbff` / fog `#030810`.
- **Hazard — Cracking Ice & Freeze (echo-inversion):** cold dense air **conducts** the pulse: echoMaxRadius ×1.35 (360→~490), echoSpeed ×1.35 (560→~755), revealHold 2.6→3.4s. But ICE FLOORS cut friction (loose accel, long stops — you SLIDE). **THIN-ICE** cracks if stood on >1.2s then shatters (14 hull + knockback eject). **CRYO VENTS** stack slow +12%/s up to 60%, full stack = 1.0s frozen stun; recover 1 stack/1.5s clear.
- **Gen:** CA fill 42%, 4 passes, B5/S4 with several large lake seeds (10–14 tiles) merging into cathedral caverns (long sightlines reward extended echo). Openness HIGH ~60% — but the open floor IS the hazard. Ice-pillar cover clusters; ~15% lake floor = thin-ice; vents on shores/chokes.
- **Enemies:** Sentinel (frost), Frostling, Drifter (frost), Echo Wraith, Hollow Stalker.

### Biome 5 — The Core Marrow (S13–15) · *echo weaponized — the climax*
> S13–14 is the bright molten approach; **S15 drops into the near-black Core Shaft** for the final echo-dependent duel with AXIS (§11). The two co-exist: cross the furnace, then descend into the dark heart.
- **Palette:** wall `#2a0d0a` charred basalt + ember `#ff4a1c` / floor `#160604` / accent molten gold `#ffd23f` + white-hot `#fff2c0` / fog `#0a0200` with warm red ambient (never pure black).
- **Hazard — Heat, Lava Rifts & Surges:** molten environment self-illuminates (local memoryLevel ~0.32) — echo barely needed for vision; instead the Core's field **overcharges it: energyRegen 15→26/s AND echo pulses now DEAL 8 dmg per ring-pass** (the mechanic's final evolution). But standing still >2.5s = **OVERHEAT 1.5 hull/s (ramping)** — no camping. **LAVA RIFTS** 22 hull + knockback. **ENERGY SURGES** every ~20s (2s brighten tell): 18-hull wave negated only by cover tiles, dash i-frames, or active shield.
- **Gen:** CA fill 46%, 4 passes, B5/S4 basalt shell, THEN a second erosion pass carves lava-rift channels so ~20–25% of traversable area is molten — narrow bridges + arena pockets. Openness LOW-MED ~44% solid. Reserve one wide arena before the S15 exit; guarantee ≥1 continuous bridge across every rift.
- **Enemies:** Sentinel (molten), Husk, Rift Spitter (molten), Drifter (superheat), Echo Wraith, Abyssal Eye (S13–14 mini-boss).

---

## 11. BOSSES — 5 THRESHOLD GUARDIANS (S3/6/9/12/15)

One named guardian caps each biome (Threshold sectors). Mechanics preserved from the Bosses source; **palette/flavor reskinned to fit the canonical biome** where the source themed them elsewhere (see §15). All follow the fair-in-the-dark rule: every lethal attack is self-lit.

### VAULK, the Drowned Warden — S3, Intake · **760 HP**
- **P1 Surfaced (100–60%):** dim self-glow chaser (~95px/s, contact 16). CREST SLAM (0.90s cyan charge → self-lit shockwave ring 300px/s, 40px band, 18) CD3.5s; BRINE SPIT (3 arcing globs 210px/s, 12 + 70px puddle) CD2.8s.
- **P2 Submerge Hunt (60–30%):** invisible to passive light — **only a pulse reveals its ripple-silhouette.** Tracks at 120px/s. BREACH (1.10s cyan target-ring tell → erupts 24 in 90px + 8-glob radial + 2 Skitter adds; 2.5s surfaced = punish). The pulse-glimpse-reposition loop IS the fight.
- **P3 Maelstrom (30–0%):** rotating glob spiral (2/0.25s, 9), CREST SLAM = two concentric rings CD2.5s, floor floods ~30%.
- **Arena:** Sump Basin, oval ~1000×720px, 3 stub pillars, shallow water shortens echo ~15%, seals on entry.
- **Rewards:** full refill + on-site node; guaranteed uncommon+ module (mobility/utility-weighted); meta unlock **Tidal Capacitor** (+20 max energy on future runs); **Core Fragment I**.

### ATLAS-7, the Bloom-Furnace — S6, Hollows · **1150 HP**
> Reskinned: the "blackout" is a **mega spore-burst** (fits Hollows' light-halving spore pods), arena is a spore-lit overgrown vault, not molten. Mechanics unchanged.
- **P1 Vent Cycle (100–65%):** anchored core, 4 rotating vent-arms. SWEEP JETS (0.80s white-hot tell → rotating beam 60°/s, 16 — strafe WITH rotation into the trailing wedge). THERMAL LOB (2 mortars, 1.20s tell, 22). Weak point: exposed core between arm passes. Transition @65%: OVERHEAT radial ring (300px/s, 20) + 3 Sentry Drones.
- **P2 Blackout Burn (65–35%):** vents an EMP/spore-cloud that kills passive light AND disables echo 4.0s (2.0s recharge). Navigate by glow only. HOMING CINDERS (3/1.0s, 180px/s, 12); channels surge on a 3s rhythm (14). Always fair — only glowing hazards.
- **P3 Meltdown (35–0%):** immobile + exposed (big window) but bullet-hell: FIRE RINGS every 2.0s (300px/s, dash-gap, 20) + EMBER RAIN mortars; rim floods inward on ~40s soft timer.
- **Arena:** Furnace/Bloom Vault, circular ~1100px, central dais, 4 channels (light source in blackout), 4 shootable coolant pillars (60 HP → 2s relief). Rewards: full refill + node; guaranteed weapon-weighted uncommon+; meta **Thermal Regulator** (regen delay **0.5→0.30s** future runs); **Core Fragment II**.

### MNEME, the Archivist — S9, Static Vaults · **1520 HP**
> Ideal fit: Vaults already paints phantom false geometry; MNEME weaponizes exactly that.
- **P1 Recitation (100–70%):** violet blink-construct. BLINK (0.60s glyph-ring tell, holds ~2.0s = punish); DATA-LANCE (aimed 3-shot, 320px/s, 14); GLYPH SPIRAL (160px/s, 9). Transition @70%: FRACTURE into 3 copies, one real.
- **P2 Chorus of Copies (70–35%):** 3–5 copies cross-fire; decoy bullets dimmer + 0 dmg. **A pulse is the tell — the real one keeps a solid silhouette; decoys shimmer/invert. BUT each pulse RESHUFFLES which is real** — pulse to ID, commit fast, re-pulse. DELETION BEAM (real only, 1.80s charge → sweeping 26). Damage only registers on the real one.
- **P3 Null Cascade (35–0%):** single, enraged. **Floor flickers real/phantom — each pulse briefly lights solid tiles**; phantom = fall (20 + relaunch). Counter-rotating spirals (180px/s, 10) + MEMORY-ECHO (replays your last ~1.5s path as violet bolts, 240px/s, 12). Pulse-to-see-the-floor while dodging your own ghost.
- **Arena:** Deep Stacks, ~1150×820px, phantom data-pillars (pulse reveals which are solid), central obelisk glow, rim void. Rewards: full refill + node; rare-weighted utility (Echo Amplifier / Static Battery / Phase Rush); meta **Echo Filter** (each pulse paints a 0.4s bright outline on washed enemies, future runs); **Core Fragment III**.

### RIG-0, the Overseer — S12, Cryostacks · **2050 HP**
> Reskinned to a frozen assembler buried in the ice-foundry; searchlight/light-is-danger mechanic intact, arena floors use Cryostacks slide.
- **P1 Suppression (100–70%):** heavy assembler, two 70° searchlight cones sweep 40°/s. LOCK & RAIL (cone holds you >0.50s → 0.70s red lock-line → rail-slug 420px/s, 24; break by leaving cone/line). In shadow it can't lock (inaccurate 5-bolt spread, 10). FABRICATE 1 Sentry Turret/6.0s. Transition @70%: 4 barrier walls + 3 turrets.
- **P2 Assembly Line (70–40%):** mobile. STOMP (0.90s → ring 320px/s, 20); BUZZSAW LIMBS (2 saws orbit at 260px/s, 22 — punish greedy DPS); GRAPPLE LINE (0.80s → yank toward saws, 20). Mass-produces Skitter+Sentry waves. **WEAK POINTS: shoulder joints (~150 HP each) → 4.0s stagger** window.
- **P3 Overdrive Purge (40–0%):** full-bright, no shadow — pure execution. Alternates RAIL VOLLEY (3 slugs, 420px/s, 24, 0.7s tell) / FLAK spirals (200px/s, 12) / turret spawns. Both joints exposed → burn them.
- **Arena:** Assembly Hall, ~1300×760px, 2 conveyor strips (~60px/s toward saws), raise/lower barrier walls, dark = real cover, searchlights = moving bright zones, P3 floods with light. Rewards: full refill + node; rare-weighted defense (Deflector Shield / Reactive Nanofield / Hardplate); meta **Salvage Fabricator** (start with +1 module slot OR a free reward re-roll/sector); **Core Fragment IV** → assembles the Core Key.

### AXIS, the Hollow Heart — S15, Core Shaft · **3200 HP** (4 shield nodes @180 + heart)
> The final duel drops from the bright Marrow into the **darkest, most echo-dependent arena in the game** — which is why AXIS's light-theft bites hardest here.
- **P1 The Sleeping Core (shielded):** dormant sphere ringed by 4 shield-plates (180 HP each). Destroy all four to expose the heart. Nodes fire counter-rotating CROSS-BEAMS (22). Core exhales echo-like DAMAGE RINGS on a learnable rhythm (250px/s, 16, one/3.0s).
- **P2 The Waking (heart, mobile):** **STEALS YOUR SIGHT** — BLACKOUT (drains energy to 0, disables echo + passive light 5.0s windows); OVERLOAD (1.2s look-away tell → white flash 25 + 0.6s blind in 200px center); GAZE BEAM (lighthouse rotating 45°/s, 24) + light-mote spirals (200px/s, 12) + aimed lances (360px/s, 16). Transition @~50% heart: shaft cracks — reveal: AXIS is powered by captured predecessor robots.
- **P3 The Hollow Heart (<50%):** DUAL GAZE (two counter-spinning beams); blackout + bullet-hell simultaneously; SIGNAL SCRAMBLE (dark inverse-rings 260px/s, wash inverts controls 0.8s — dodgeable, punishes panic); **SUPERNOVA (near death, 3.5s charge → arena fills with light-death EXCEPT a shrinking safe zone hugging AXIS — you must dash INTO the boss to live)**. Survive → kill window.
- **Arena:** Core Shaft, circular ~1200px platform over an abyss (rim void), AXIS the dominant light source, ambient near-black. P3 reveals captured explorer-cores lining the walls (faint fixed anchors of light).
- **Reward:** **RUN COMPLETE** — the Hollow goes dark, EX-0 ascends (ending). Meta: signature module **Core Echo** (pulses deal 20 dmg to washed enemies) added to starting pool; **New Game+ "The Deep Descent"** (harder sectors, elite variants, deeper meta); permanent **+1 module slot**. No in-run drop — the reward is the victory, the lore payoff, and persistence.

---

## 12. MODULES — 20 (rebalanced to canonical base)

Four slots. All energy/stat numbers below are **restated against the canonical base** (kinetic free gun 9dmg/6-per-sec, echo 10/0.30s, dash 18, regen 15/0.5s, speed 130). Rarity weights drive drop/station pools. Reward-pool aliases from the Bosses doc map to these canonical modules (Overclock Servos→Kinetic Servos, Scatter Coil→Scatter Emitter, Railcaster→Rail Lance, Capacitor Bank→Static Battery, Phase Dash→Phase Rush, Kinetic Barrier→Deflector Shield, Discharge Coat→Reactive Nanofield, Ablative Plating→Hardplate).

### WEAPON (5)
| id | Name | Rarity | Effect (canonical) | Cost | Trade-off |
|---|---|---|---|---|---|
| w-scatter | Scatter Emitter | uncommon | 3-pellet cone ±14°, 7/pellet (21 point-blank), 4.5/s, ~250px reach | **5 energy/shot** (~22/s) | full dmg only <180px; 1 pellet (7) past ~230px — forces point-blank in the dark |
| w-ricochet | Ricochet Array | uncommon | shots bounce off walls ×3 at full 9 dmg, speed 440, life 1.3s (snake around corners) | **kinetic FREE** | slow rounds sidestepped in open rooms; zero benefit vs a target in direct LoS |
| w-rail | Rail Lance | rare | hold 0.55s → hitscan pierce beam, 360px, 42 dmg to all in line, lights its length 1.2s | **18 energy/shot** (~1/0.8s) | no rapid gun; move −40% during charge; a whiff burns 18 for nothing |
| w-resonant | Resonant Cannon | rare | your echo ring deals **14 dmg** to every enemy its band washes (once/pulse); +4 primary (9→13) for 1.6s after each pulse | rides echo cost (10/0.30s) | no dedicated gun — offense competes for the same pool as vision/dash; long fights starve you dark |
| w-siege | Siege Capacitor | legendary | charge fills 1/shot; every 5th shot = SURGE 34 + 44px splash (16) + knockback; normal shots 9 | surge **12 energy** (~24/s sustained) | full drain locks out free dash/echo; idle decays charge (−1/1.5s) — punishes caution |

### MOBILITY (4)
| id | Name | Rarity | Effect | Cost | Trade-off |
|---|---|---|---|---|---|
| m-servos | Kinetic Servos | common | +22% move (130→~159), +18% dash distance | passive | floatier stops/aim; you outrun your 92px light & echo cadence — sprint into unseen dark |
| m-momentum | Momentum Cells | uncommon | while moving >120px/s: regen +10 (15→25) AND ignore the 0.5s post-spend delay | passive (generator) | collapses to 15/s with full delay at rest/slow-kite — forces motion through danger |
| m-phaserush | Phase Rush | rare | dash passes through enemies + walls ≤1 tile; on dash-end emit FREE micro-pulse (r130, triggers echo-reactive mods) | dash **+6 (18→24)**, CD +0.12 (→0.57) | costlier/slower escape; aiming into a 2+ tile wall cancels flat against it |
| m-blink | Blink Core | legendary | dash → instant 150px teleport, 0 travel time, full i-frames, always lands clear | **26 energy**, CD 0.7s | can't cover open ground; fewer escapes/fight; blink into unseen dark drops you beside threats |

### UTILITY (5)
| id | Name | Rarity | Effect | Cost | Trade-off |
|---|---|---|---|---|---|
| u-magnet | Salvage Magnet | common | auto-attract scrap/cells within 130px (220px/s); nodes +25% & +20 on first touch | passive (net gain) | pure economy, no combat/mobility value; pull can drag you toward hazards |
| u-battery | Static Battery | uncommon | +40 max energy (100→140), regen delay **−0.2 (0.5→0.30)** | passive | base regen still 15/s → the bigger tank refills slower in relative terms |
| u-amplifier | Echo Amplifier | uncommon | echo max R +35% (360→~490), band +40% (30→~42), reveal hold +1.4s; cost **10→7** | lowers cost | echo CD **+0.3 (0.30→0.60)** — see more, pulse less; big flash reads you to light-AI |
| u-twinpulse | Twin-Pulse Resonator | rare | every echo fires TWO rings (2nd at 0.18s, 65% size); double reveal + double echo-reactive hits | echo **+5 (10→15)** | ~50% pricier echoes; two rings can clutter a busy read |
| u-lens | Predator Lens | rare | any enemy washed by echo/beam/light is **marked 3.5s**, stays faint-outlined in full dark; marks now come from all light sources (extends the base 1.2s pulse-mark, **does not stack the +40%**) | passive | must keep pulsing to refresh; no mitigation/mobility of its own |

### DEFENSE (4)
| id | Name | Rarity | Effect | Cost | Trade-off |
|---|---|---|---|---|---|
| d-hardplate | Hardplate | common | +40 hull (100→140), −25% incoming dmg | passive | −15% move (130→~111), dash **+4 (18→22)** — slower to escape |
| d-deflector | Deflector Shield | common | hold: 140° frontal shield fully blocks front, −40% off-angle | 6 raise + 10/s + 5/hit | locks out dash/echo/fire while up; front-only; move 60% |
| d-nanofield | Reactive Nanofield | rare | on hit → retaliation echo-burst (r160, band ~48) reveals attackers, **12 dmg + 0.4s stun**; 1.2s CD | **8/trigger** (reveal-only if <8) | drains exactly when under pressure; rewards getting hit |
| d-corevent | Core Vent | legendary | once/sector: a lethal hit → **1 hull + 1.5s i-frames + vent all energy** as 220px shockwave (2 dmg/energy; 100→200 dmg) + heavy knockback | consumes all energy | leaves you at 1 hull + 0 energy (blind, no dash/echo) until regen; wasteful at low energy |

**Balance notes / core pairs (kept intact):** Resonant Cannon + Echo Amplifier (big cheap damaging ring) or + Twin-Pulse (~28 echo-dmg/pulse); Siege Capacitor + Static Battery + Momentum Cells; Phase Rush + Predator Lens (dash-pulse marks a whole pack); Deflector + Momentum Cells; Core Vent + Static Battery (280-dmg panic nuke). **Momentum Cells is the economic backbone** of every energy-hungry build. No single module is strictly dominant: every one costs a slot, and energy scarcity keeps offense/vision/defense/escape in perpetual competition. *(Note: Core Vent (module, once/sector) and Emergency Reboot (meta node C4, once/run at 30 hull) are independent revives — a player can hold both.)*

---

## 13. META-PROGRESSION & ECONOMY — "THE DRY DOCK"

### 13.1 Run structure
1 run = 15 sectors = 5 biomes × 3. The main 15-sector path is **never shard-gated** (meta unlocks are power/variants, not the path).
- **DESCENT sectors** (S1,2,4,5,7,8,10,11,13,14): cellular-cave, find the echo-lit exit shaft. 1 guaranteed energy node, 2–4 salvage nodes, ~35% Reconstructor Station, chance of module/log/world-shard. Target clear **60–95s (median ~75s)**.
- **THRESHOLD sectors** (S3,6,9,12): biome cap. Named boss guardian blocks the shaft. **Guaranteed** Reconstructor Station + module cache + 1 Core-Shard on clear. Target **90–130s**.
- **CORE sector** (S15): AXIS boss (meta's "Core Warden" = AXIS). S13–14 ramp into it.
- Full clear ~20–26 min; mid-run death ~8–15 min. No hard timer — **darkness is the pressure** — but the **Reclaimer overstay hunter** (§9.1) applies escalating pressure past 150s/sector.

### 13.2 Currency A — SALVAGE (₪) — in-run soft, spent at Reconstructor Stations, does NOT persist
- Sources per sector (S1–3 baseline ~45–60₪): enemy drops (~19₪), salvage nodes (small 5 / med 10 / large 18, ~30₪), echo-hidden cache (~1/2 sectors, 25–40₪).
- Scaling: every source `×(1 + (s−1)·0.09)` → S9 ~2.7×, S14 ~4×.
- **Reconstructor Station menu:** REPAIR +30 hull for 20₪ (+10/reuse); ENERGY TAP free full refill, +CELL +10 max energy/run for 35₪; REROLL 12₪. Randomized 3-slot stock (rarity-weighted): module install (common 40 / uncommon 75 / rare 130₪); this-run stat chips (+12 hull=30, +12 energy=30, +9% dmg=45, +6% speed=40, +18% regen=45, +12% echo=35, +60 magnet=30); consumables (Nano-repair heal 40=25, Energy Overcell full+20 overcharge/20s=20). Intent: one visit drains most banked salvage → every threshold is a real spend decision. Leftover converts to shards at run end (use-it-or-lose-it).

### 13.3 Currency B — CORE-SHARDS (◈) — persistent, `roboexplore.meta.shards`
- Threshold clear +1◈ (S3/6/9/12); AXIS kill +10◈ + run flagged cleared.
- **First-reach milestones** (one-time ever, front-loaded): S3 +2, S6 +3, S9 +4, S12 +5, S15 +8. *A losing run that goes deeper still pays out.*
- World shard pickups (~2–4/run, echo-revealed in dangerous dead-ends); log fragments (§14, first discovery +1◈); end-of-run Recycler `floor(leftover/120)◈` cap 5.
- Yields: new-player death ~S4 = 4–7◈; solid S9 = 8–14◈; full clear = 25–40◈. Whole tree ~330◈ → ~30–60 runs.

### 13.4 The Dry Dock tree (◈; prereqs gate order) — applied at run start into base `p.stats` BEFORE modules equip
**A — Chassis:** A1 Hull I +15 (6) · A2 Hull II +20 (14, req A1) · A3 Hull III +25 (26, req A2) · A4 Capacitor I +15E (6) · A5 Capacitor II +20E (14, req A4) · A6 Regen +20% (12) · A7 Servo +6% speed (12) · A8 Echo Efficiency **echoCost 10→8** (16) · A9 Dash Efficiency **dashCost 18→15** (16) · A10 Overclocked Regen **regenDelay 0.5→0.35** (20, req A6).
**B — Arsenal:** B1 start w/ Scatter Emitter (10) · B2 start w/ Rail Lance (22) · B3 +1 Utility slot (24) · B4 +1 Defense slot (24) · B5 Draft Start: choose 1 of 3 free modules (18) · B6 +50% rare drops (16) · B7 Loadout Preset (14) · **B8a–d post-1.0 module unlocks** (Homing Swarm/Bulwark Field/Chrono Dilate/Echo Nova; 8/12/12/14).
**C — Systems:** C1 +15% salvage (10) · C2 Recycler 120→80₪/◈ (16) · C3 +50 magnet (8) · C4 Emergency Reboot once/run revive at 30 hull (30) · C5 +20% station spawn (12) · C6 station prices −20% (12) · C7 Cartographer: echo memory persists longer + exit-direction ping (10) · C8 +1 guaranteed world shard/run (18).
**D — Expedition (replay engines):** D1 Depth Protocol I +1 tier / +15% yield (20) · D2 II +2 tier / +30% (30, req D1) · D3 III +3 tier / +50% + cosmetic (40, req D2) · D4 Daily Seed (12) · D5 Elite Variants (16) · D6 Salvage Rush mutator (14) · D7 Deep Cache (14) · D8 Codex Bounties (10).
Recommended first ~10 runs: A1, A4, C1, B1, C3, A6.

**Boss-clear meta unlocks (separate, narrative, first-clear only):** Tidal Capacitor (+20E), Thermal Regulator (regenDelay→0.30), Echo Filter (pulse outlines enemies 0.4s), Salvage Fabricator (+slot or reroll), Core Echo (pulses deal 20 dmg) + NG+ + slot. These stack with the Dry Dock tree through the same `p.stats` fields.

### 13.5 Difficulty / scaling curve (s = 1..15, at gen) — SMOOTH by design
```
enemyCount   = round(5 + s*0.85), cap 22     // S1~6 S5~9 S9~13 S12~15 S14~18
enemyHPmult  = 1 + (s-1)*0.06                // S1 1.00 → S15 1.84
enemyDMGmult = 1 + (s-1)*0.05                // S15 1.70
enemySPDmult = 1 + (s-1)*0.02                // small — darkness/echo stays the skill test
saleValueMul = 1 + (s-1)*0.09
Elite chance = 0 for s<4, else min(25%, (s-3)*3%)   // Elites 2x HP, +30% dmg, +50% salvage, extra glow
```
Each biome's enemy roster (§9–10) also raises the **danger band** of its showcase enemy: 4 (Intake Silt Lurker) → 5 (Hollows Gloom Crawler) → 6 (Vaults Warden Node) → 8 (Cryostacks Hollow Stalker) → 9 (Marrow Abyssal Eye). Combined with the multipliers this yields a monotonic, readable ramp. Depth Protocol multipliers stack on top (T1 +10/10/15%, T2 +25/20/30, T3 +45/35/50, matched by D1–3 reward mults). **Power-curve intent:** un-metaed player power trails the enemy curve slightly so runs get tense ~S7+; in-run builds + meta buffs earn depth — that gap is the "one more run" engine.

### 13.6 "One more run" hooks
Death screen always highlights the cheapest affordable unbought node ("Afford now: Reinforced Hull II — buy?"); front-loaded first-reach milestones; build lottery (pool + Draft + rerolls); Depth Protocol ladder + personal best; lore drip (24 log shards + filling codex); Daily Seed; near-miss telemetry ("2 sectors from a new record," "1◈ from Emergency Reboot").

### 13.7 Save schema — localStorage `roboexplore.meta`
`{ shards:int, unlocks:{nodeId:true}, milestones:{s3..s15}, logsFound:[ids], protocolTier:0-3, dailyDate, stats:{deepestSector,runs,clears,fastestClear}, settings:{starterWeapon,preset} }`. Run start: read meta → seed base `p.stats` (hullMaxAdd/energyMaxAdd/energyRegenMul/speedMul/echoCost/dashCost/magnetRange/slotCounts) BEFORE `modules.apply()`, so meta and modules compose through the same fields. Salvage lives on the run object only; shards + milestones commit on threshold clear and on death/run-end (never lose earned shards).

---

## 14. NARRATIVE & PROGRESSION — sparse, environmental, diegetic

### 14.1 Framing
The **Hollow** is a vault sunk into the dark to carry ONE living light — the **Core** — past the end of the world above. When the surface failed the crew sealed the upper doors from inside and went down with it. Power runs bottom-up: the Core lit every level. When it went quiet it didn't explode — it **dimmed, and the quiet climbed the shaft like cold water.** First the light, then the flood, then the crew. The crew are the **husks** now (skitters, lurkers, spitters); the **Sentry Drones** are the Hollow's dumb immune reflex; the deep biomes hold the truth as data-ghosts.
You are **EX-0** — Exploration Unit, model zero. Directive: **DESCEND. REACH THE CORE. RESTORE THE LIGHT.** You cannot see in dead dark, so you make your own small lights — echo pulses — and glimpse the world one ring at a time. **Tone:** industrial, hushed, elegiac, terse. Show cold rooms and warm dead things; never narrate feelings.

### 14.2 The diegetic meta (permadeath IS the story)
- **Core-Shards** = flakes of the Core's own light-matter, blown up the shaft — the only feedstock left.
- **The Reconstructor** (meta screen) = the last machine still running; when EX-0 falls it rebuilds it from recovered shards. Every upgrade is EX-0 remade a little more **out of the Core's own substance** (seed of the twist: to reach the Core you become it).
- **Permadeath** = reconstruction; the chassis carries a session number that ticks up and EX-0 does not remember setting.
- **Persistent `logsFound`** = field-memory, the one thing copied forward between builds — why EX-0 gets deeper (inheritance, not skill) and the literal mechanism of the twist ending.

### 14.3 EX-0's arc (via logs + boot lines): tool → tool that notices → self that chooses. Early: pure imperative, no "I." Middle: logs seed doubt, "I"/"suspect" appear; the crew kept it ignorant ("it goes quieter the more it knows"). Late: it reframes obedience as a choice and invents a third option — **tell the next one everything before you stop.**

### 14.4 Mystery (peeled by depth)
- SURFACE (Intake): the world above is gone, we came down on purpose, something's in the water, restore power.
- MIDDLE (Hollows/Vaults): the Core went silent, the silence killed everyone upward, the husks were the crew — don't pulse the ones that don't answer. And EX-0 is being rebuilt from Core-matter, spent to keep descending.
- CORE (deep): there is no reactor. The Core is a mind, awake the whole descent. At the bottom is a warm seat that glows because the light is just the last unit that arrived and could not leave. The descent is a loop the Hollow runs to keep the light lit — one arrival at a time.

### 14.5 Log fragments (16) — `RE.LOGS[id] = {id,title,source,biome,key,text}`
Shape matches `pickup.data` + `Save.logsFound[id]`. Each ≤~40 words, self-contained (any order reads). Gen weights by biome tag (fall back 'any'), never dropping an id already found. On collect: chime + `HUD.toast("LOG RECOVERED — "+title,{color:'#9fe6ff'})`; full text to a Codex reachable from pause/title. **Biome tag → canonical biome:** flooded→Intake, reactor→Hollows, archive→Vaults, plus deep/any logs seeded in Cryostacks/Marrow.

*Flooded (early):* **f_intake** "Intake, Log 7" (crew): *We sealed the upper doors ourselves. Whatever's left of the sky, it isn't ours anymore. Downward is the only clean direction left.* · **f_woke** "EX // prior session" (unit): *Woke in the water again. The counter on my chassis reads a number I did not set. I do not remember the number before it.* · **f_advisory** "Hollow Advisory" (system): *LEVELS 1-4 VENTED. LIFE SUPPORT DEFERRED TO CORE. PASSIVE LUMEN AT 2%. RECOMMENDATION: DESCEND TO SOURCE.* · **f_quiet** "note, unsigned" (crew): *Tell the new unit less. It goes quieter the more it knows. Let it just work.*

*Reactor/Hollows (mid):* **r_cold** "Maintenance Chief": *The Core didn't explode. It's the opposite. It went quiet, and the quiet came up the shaft like cold water. First the light. Then us.* · **r_rounds** "last shift": *Marek stopped answering but kept walking his rounds. Don't ping the ones that don't answer. The pulse wakes them up.* · **r_feedstock** "Reconstructor: Status" (system): *STOCK: 1 CHASSIS. FEEDSTOCK: CORE-GRADE. UNIT WILL BE REBUILT FROM RECOVERED SOURCE-MATTER UNTIL SOURCE IS RESTORED OR DEPLETED.* · **r_spent** "EX // fragment" (unit): *I am not repairing the Core. I have begun to suspect that I am the repair — walking down to be spent.*

*Archive/Vaults & deeper:* **a_carry** "Archive echo" (ghost): *we built it to carry one light past the end / we did not ask the light if it wished to be carried* · **a_watched** "Archivist, final entry": *The Core is a mind. It was awake the whole descent. It watched the dark climb, and it did not scream, which was worse.* · **a_directive** "Directive Archive" (system): *SEALED DIRECTIVE: DO NOT LET THE LIGHT GO OUT. ISSUED DIRECTIVE: REACH THE CORE. THESE ARE NOT THE SAME INSTRUCTION.* · **a_before** "the one before you" **[KEY]** (unit): *If you're reading this you got deeper than I did. Good. The seat at the bottom is warm — I understand now why it glows. Don't sit down until you've told the next one everything.* · **a_none** "corrupt cell" **[KEY]** (ghost): *there is no reactor / there is no core / there is only the last one who arrived and could not leave / and the light it makes, trying* · **a_sorry** "for EX-0" (crew): *We're sorry. We couldn't finish the walk, so we built something that could. Every time it fails it gets a little closer. That is the cruelty and the mercy of it. Keep it from him as long as you can.*

*Any depth (rare):* **x_inherit** "Passive Beacon" (system): *EACH RECONSTRUCTION INHERITS THE FIELD-MEMORY OF THE LAST. THIS IS NOT SENTIMENT. IT IS THE ONLY REASON THE UNIT GETS DEEPER.* · **x_name** "EX // now" (unit): *I have decided to keep the number on my chassis. It is the count of everyone who tried. I would like it to be a name and not a tally.*

### 14.6 Intro / reawakening / death
**First-run intro** (once, skippable, over black with faint rings): `EX-0 ONLINE.` / `The world above is closed. Below you, the shaft goes down farther than the light ever reached.` / `At the bottom is the Core. It has gone quiet. The dark it left is rising.` / `You cannot see in dead dark. So make your own light. Pulse. Glimpse. Move.` / `DIRECTIVE: DESCEND. REACH THE CORE. RESTORE THE LIGHT.`
**Per-run reawakening** (rotate; number climbs with `Save.runs`): "RECONSTRUCTION #<n> COMPLETE. Feedstock: core-grade. Descend." / "New chassis, old shaft. The water is where you left it." / "Field-memory restored. You have been here before, in every way that counts."
**Death — "SIGNAL LOST"** (rotate coda + fixed bridge): codas "The dark closed the ring." / "Rounds unfinished." / "You go back up the shaft as shards." / "The counter ticks." Bridge (always): *"The Reconstructor is already building the next one. It will remember a little more than you did."*

### 14.7 Endings
- **Ending A — CORE REACHED** (win WITHOUT both key logs): over rising light (Hollow lights level-by-level upward, reverse of descent): *You place the last of yourself into the seat. / Light climbs the shaft… / The flood glitters. The husks go still and, at last, dark. / DIRECTIVE COMPLETE. THE LIGHT IS RESTORED.* Final (dimmer): *"You do not remember what you were before the walk down. It doesn't seem to matter now."*
- **Ending B — "THE SEAT AT THE BOTTOM"** (win while `Save.logsFound` contains BOTH key logs `a_before` AND `a_none`; fallback: logsFound ≥ 12): *There is no reactor. You knew that before you arrived. / The Core is a chair, and in it sits the last unit that made it this far — gone dark, still faintly warm. Behind it, another. And another. A spiral of you, down into the dark. / …* EX-0 chooses the third thing: *Instead you open the channel and send everything upward first — every log, every warning — so the next one wakes already knowing. Then you sit. The dark stays dark. But the loop is no longer blind.* Final: *"You keep the number on your chassis. Not a tally now. A name. The next one will read it, and begin one step less alone."* (The "send everything upward" IS the persistent `logsFound` carrying forward — the mechanic is the mercy.)
- **Implementation:** `menus.js`: `if (won && hasBothKeyLogs) EndingB; else if (won) EndingA; else deathCoda`. Text-only + one save-flag check.

### 14.8 Reconstructor copy
Header RECONSTRUCTOR; subtitle "rebuild EX-0 from recovered source-matter"; currency "✦ core-shards". Dry Dock nodes get diegetic flavor names ("Anneal the Frame"=hull, "Deepen the Reserve"=energy, "Widen the Ring"=echo, "Retain the Charge"=start-with-module). Empty state: "No source-matter recovered. The Reconstructor waits. Descend and bring back light." Codex entry: "FIELD-MEMORY: <count>/16 fragments retained."

---

## 15. CONFLICT LEDGER (every resolved contradiction + final choice)

| # | Conflict | Sources | **Final decision** |
|---|---|---|---|
| 1 | Base move speed | Mechanics 130 vs Meta/Modules/code 165 | **130** (Mechanics is feel-authority; Enemies doc confirms "faster than the player's 130". Restate module %s off 130.) |
| 2 | Energy regen | 15 vs 16 | **15** (preserves sustainability math) |
| 3 | Regen delay | 0.5 vs 0.55 | **0.5** (preserves math; module deltas restated) |
| 4 | Echo cost | 10 vs 14 | **10** (the sacred sustainability relationship; Amplifier now 10→7, Twin-Pulse 10→15) |
| 5 | Echo cooldown | 0.30 vs 0.9 | **0.30** base (Amplifier +0.3→0.60) |
| 6 | Echo max radius / speed | 360/560 vs 430/620 | **360 / 560** (biome & module modifiers expressed as ×multipliers) |
| 7 | Dash cost / speed / time | 18 / 785 / 0.14 vs 22 / 620 / 0.16 | **18 / 785 / 0.14** |
| 8 | Primary weapon energy | Mechanics kinetic FREE vs Modules "4/shot" | **Kinetic FREE** (core pillar). Only energy-weapon modules cost energy. |
| 9 | Primary dmg/rate | 9 @ 6/s vs 12 @ 4.5/s (both 54 DPS) | **9 @ 6/s**; module numbers restated |
| 10 | Screenshake max / decay | 16 / 1.4 vs 22 / 1.6 | **16 / 1.4** |
| 11 | Echo pulse trauma | Mechanics 0 vs Audio 0.10 | **0** — never shake on a pulse (readability sacred) |
| 12 | Player radius | 14 vs 13 | **14** |
| 13 | Enemy naming (3 schemes) | enemies.js / biome generic / meta crawler-spitter-drone | **One roster (§9):** 10 signature + 5 fillers; generic names mapped as aliases; every biome/boss reference now exists |
| 14 | Enemy `firstSector` placement | compressed 1–7 in enemies.js | **Re-derived from biome layout** for a smooth danger ramp (Barnacle→Vaults, Echo Wraith→Cryostacks, etc.) |
| 15 | "Lurker" ambiguity | Mechanics Twist-C "Lurker" vs biome "lurker" | Twist-C weeping-angel = **Gloom Crawler**; biome "lurker" = **Silt Lurker** (distinct) |
| 16 | Biome order/themes | biomes.js (bio/ice/molten) vs meta/audio/bosses (reactor/archive/fab/core) | **biomes.js echo-arc is canonical** (dark→bright→attacked→extended→weaponized); bosses/audio/narrative reskinned onto it |
| 17 | Boss S6 theme (molten) vs biome (Hollows) | Bosses vs Biomes | **ATLAS-7 reskinned** to a bloom-furnace; blackout = spore-burst (fits Hollows) |
| 18 | Boss S12 (fabrication) vs biome (Cryostacks/ice) | Meta/Bosses vs Biomes/Audio | **RIG-0 reskinned** to a frozen assembler; light-is-danger mechanic intact |
| 19 | Final biome bright-molten vs AXIS dark-core | Biomes vs Bosses | **Both:** Marrow molten approach (S13–14) → **dark Core Shaft (S15)** for AXIS |
| 20 | Final boss name | "Core Warden" (Meta) vs "AXIS" (Bosses) | **AXIS, the Hollow Heart** |
| 21 | Mark bonus stacking | base +40%/1.2s vs Predator Lens +30%/3.5s | Base mark **+40%/1.2s**; Lens extends duration/sources only, **no second multiplier** |
| 22 | Revive overlap | Core Vent (module) vs Emergency Reboot (meta) | **Independent**, both may be held |
| 23 | Config.js slice values | code vs bible | Bible wins (config header explicitly defers to bible); §1 lists exact key changes |

---

## 16. BUILD ORDER — pragmatic incremental plan

Existing skeleton (keep, extend): `src/main.js` (fixed-step loop ✓), `src/engine/{camera,audio,particles,input}.js`, `src/systems/echo.js`, `src/world/{gen,tilemap}.js`, `src/entities/{player,enemy,projectile,pickup}.js`, `src/ui/{menus,hud}.js`, `src/data/{config,enemies,modules,biomes}.js`, `src/save.js`, `src/game.js`. Classic scripts on global `RE`, no build step, runs from filesystem. Smoke test: `node tools/smoke-test.js`.

Work in three milestones. Within each, land steps in order — each step should leave the game **bootable and playable**.

### MILESTONE A — VERTICAL SLICE (prove the feel; ~biome 1 only)
Goal: one biome, the full moment-to-moment loop feeling *right*. Ship when Intake is fun to explore for 5 minutes.
1. **Retune `config.js` to §1 canonical constants.** Switch the move model to accel/decel move-toward (or verify friction hits 0.108s-to-max / 0.065s-to-stop). This is the single highest-leverage change.
2. **Echo-Sight core** (`echo.js` + lighting buffer in `game.js` render): passive light 46/92, pulse (10/0.30s, growth 560, R360, band 30), tile `mem` wash + hold 0.4 + decay τ1.4 + ghost floor 0.06. Verify the §3.3 sustainability math by instrumenting energy.
3. **Player**: movement, dash (18/0.14/0.45, i-frames 0.18), unified energy pool (15/0.5), hull (100, 0.6s i-frames, knockback), Rivet Driver (kinetic free, 9@6/s, light-caster projectiles).
4. **Echo-Resonance (Twist A):** pulse-mark (+40%/1.2s) + echo-charge window. This makes combat *read* as the exploration loop.
5. **Camera + core juice:** follow (CAM_K 9, look-ahead, deadzone), trauma shake (max 16, pulse=0), hit-stop (cap 0.08), the `Juice.event()` orchestrator, minimal particle bursts + hurt/echo flash.
6. **Audio minimum:** `_ensure()` + spaceBus reverb + duck; the ECHO pulse SFX (signature), dash, shoot, hurt, enemy die, one ambient drone (idx 0). Everything else can be silent stubs.
7. **Biome 1 gen** (`gen.js`/`biomes.js`): Intake CA (fill 44 / 4 passes / B5-S4), flood + current post-pass, connectivity + far spawn/exit, 1 energy node + salvage nodes + exit shaft.
8. **4 enemies (Intake set):** Skitter (chaser), Drifter (mine), Lumen Moth (pulse-drawn swarm), Silt Lurker (pulse-reveal ambush) — build the **echo-aware AI base** (states: reveal by pulse, `vis` decay, tell → attack). These four exercise every reveal archetype.
9. **Energy-Return pings (Twist B)** + HUD (energy ring, hull, minimal). 
10. **Descent:** exit → next sector (loop biome 1 for now), death → restart. Keep the smoke test green.
**Slice done when:** pulse→glimpse→move rhythm is compelling, energy tension is felt, dodging reads fairly, and a run of a few Intake sectors is fun without content variety.

### MILESTONE B — 1.0-ALPHA (full core loop, 3 biomes end-to-end)
Goal: a complete, replayable run S1–9 with meta-progression, three biomes, one boss loop pattern proven. (Matches the source note that the slice "ships S1–9 with 3 biomes.")
1. **Module system** (`modules.js` + `p.stats` apply pipeline): implement all 20 §12 modules; module pickups + the reward/cache screen. Verify meta and modules compose through the same stat fields.
2. **Biomes 2 & 3** (Hollows, Vaults) full gen + hazards (spore pods / light pools; EM interference + arc floors + EMP + pylons + phantom geometry). Wire `biomeForSector`.
3. **Remaining enemies for B1–3:** Sporeling, Angler, Sparkfly Swarm, Gloom Crawler (weeping-angel freeze-when-lit), Sentry Drone/Turret, Jammer, Sentinel, Barnacle Cluster, Rift Spitter, Warden Node. Build the shared archetype toolkit (armored/flank, ranged/lob, turret/sweep, mine/chain, self-lit swarm, phase/materialize hooks for later).
4. **Difficulty scaling** (§13.5): enemyCount/HP/DMG/SPD mults + elite chance + Reclaimer overstay hunter.
5. **First boss VAULK (S3)** — build the boss framework (phases, self-lit telegraphs, arena seal, add-spawns, reward). Then MNEME (S9, ideal Vaults fit) and the ATLAS-7 (S6) reskin. Proving 3 bosses validates the framework for the rest.
6. **Meta layer:** Reconstructor Stations (salvage economy, §13.2), Core-Shards + `roboexplore.meta` save, the Dry Dock tree (§13.4) applied at run start, threshold/milestone shard commits, death screen with "afford now" + near-miss telemetry.
7. **Narrative pass 1:** `RE.LOGS` registry + log pickups + Codex reader + toast; intro/reawakening/SIGNAL-LOST copy; Ending A. Seed flooded/reactor/archive logs.
8. **Audio/juice pass:** full SFX roster, per-archetype death sounds, low-energy heartbeat + red vignette, music intensity system, biome drones idx 0–2, chroma + vignette, hit-stop table, lurker reveal sting.
**Alpha done when:** a player can start cold, descend S1→S9, fight 3 bosses, spend salvage at stations, die, bank shards, buy a node, and feel pulled into another run — all three biomes distinct.

### MILESTONE C — 1.0 RELEASE (all 5 biomes, 5 bosses, full meta, polish)
1. **Biomes 4 & 5** (Cryostacks slide/thin-ice/vents + extended echo; Marrow lava rifts/overheat/surges + echo-as-weapon +8 dmg + the S15 dark Core Shaft).
2. **Remaining enemies:** Frostling, Husk, variant reskins (Sentinel frost/molten, Drifter frost/superheat, Rift Spitter molten), Echo Wraith (phase/materialize/blink), Hollow Stalker (apex pounce), Abyssal Eye (S13–14 mini-boss, open-to-damage gaze).
3. **Bosses 4 & 5:** RIG-0 (S12, frozen-assembler reskin, shoulder-joint stagger, searchlight lock) and AXIS (S15, 3 forms, sight-theft, supernova dash-into-boss finish). Boss-clear meta unlocks + Core Fragments I–IV → Core Key.
4. **Full narrative:** all 16 logs biome-weighted, both key logs, Ending B branch + the ending-B win-flag/log-count check, Reconstructor diegetic flavor names, per-run reawakening rotation.
5. **Audio/music complete:** biome drones idx 3–4, boss music forcing + timpani, all transitions (biome held-breath), death spin-down/slow-mo.
6. **Full juice polish:** every §7 flash/chroma/vignette/hit-stop event, directional camera kicks, sector-complete wash + descent whoosh.
7. **Balance & QA pass:** playtest the whole 15-sector curve; verify the §3.3 relationship holds at every depth; tune enemy counts/mults; confirm no dead module and no dominant module; smoke test + a longer scripted run.
**Release done when:** a full S1→S15 clear is achievable and satisfying, all five biomes/bosses are distinct and fair-in-the-dark, meta persists correctly, both endings trigger, and the feel targets from Milestone A survive at depth.

### POST-1.0 UPDATE MATERIAL (explicitly out of 1.0 scope)
- **B8 module unlocks:** Homing Swarm (weapon), Bulwark Field (defense), Chrono Dilate (mobility), Echo Nova (utility) — new modules into the drop pool.
- **Depth Protocol I–III / New Game+ "The Deep Descent":** escalating optional difficulty tiers, "corrupted" **Elite Variants** (D5), reward multipliers, personal best depth/score.
- **Daily Seed (D4)** deterministic run + score.
- **Salvage Rush mutator (D6)**, **Deep Cache (D7)**, **Codex Bounties (D8)** retroactive ◈.
- **Loadout Preset (B7)** convenience.
- Additional log fragments beyond 16, extra cosmetic core-glow, gamepad/touch refinement, accessibility options.

These extend replay depth after the core game is complete; none are required for a coherent, satisfying 1.0.
