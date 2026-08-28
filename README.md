# RoboExplore

**Descend into the Hollow. Pulse to see. Survive the dark.**

RoboExplore is a standalone, zero-dependency **exploration roguelite** that runs
in any modern browser. You pilot **EX-0**, an exploration robot reactivated in
the powered-down lower levels of a colossal derelict structure — the *Hollow* —
and descend sector by sector toward its Core.

## The hook: Echo-Sight

The world is **dark**. You have a faint light, but you truly *see* by emitting
**echo pulses** — expanding rings of sonar that briefly illuminate geometry and
enemies they wash over, then fade. Exploration is rhythmic and tense: *pulse,
glimpse, move, pulse.* Some enemies are invisible until a pulse reveals them.

Everything active — dashing, pulsing, shielding, and firing energy weapons —
draws from a single **Energy** pool. Manage energy against the darkness and the
things living in it.

## Play

Just open **`index.html`** in a browser. No build step, no server, no
dependencies. (Or serve the folder with any static file server.)

Prefer a **single portable file**? Open **`roboexplore.html`** — the whole game
(all code, styling, procedural art, and synth audio) inlined into one file you
can double-click or share. Rebuild it any time with `npm run build`.

### Controls

| Action | Keys |
| --- | --- |
| Move | `W A S D` / arrow keys |
| Aim & fire | Mouse |
| Echo pulse | `E` (or `Q`) |
| Dash | `Shift` / `Space` |
| Pause | `Esc` / `P` |
| Sound toggle | via title / pause menu |

Gamepad and touch input are also supported.

## Loop

- Explore procedurally generated caverns lit only by your echo.
- Salvage **◈ salvage** and pick up **modules** that reshape your robot.
- Spend salvage at **Reconstructor Stations** mid-run; find the exit and
  **descend**. Enemies, bosses, and hazards escalate with depth.
- Die and you restart — but **✦ core-shards** persist, spent at the
  **Reconstructor** to permanently strengthen future runs.

## Features

- **15 sectors across 5 biomes** — the echo-arc from honest dark, to a
  bioluminescent grotto, to machinery that jams your sight, to echo-conducting
  ice, to a self-lit furnace where echo becomes a weapon.
- **11 echo-aware enemies**, each built around light and darkness — invisible
  ambushers, weeping-angel hunters that freeze when lit, pulse-drawn swarms,
  phase predators, and an open-to-damage mini-boss eye.
- **5 multi-phase bosses** with self-lit, telegraphed attacks — one guards each
  biome, culminating in AXIS, the Hollow Heart.
- **18 modules** across weapon / mobility / utility / defense, with real
  trade-offs and synergies, plus a persistent **Reconstructor** upgrade tree.
- **Signature twists**: Echo-Resonance (pulses mark enemies), Echo-Charge (shots
  hit harder right after a pulse), Echo-Return pings, and enemies that hear you.
- 16 discoverable **log fragments**, a Codex, and two endings.
- **Replayability**: a **Daily Run** (one deterministic seed shared by everyone,
  with a per-day best) and **The Deep Descent** — New Game+ difficulty tiers that
  unlock as you clear, scaling enemies and rewards.
- **Accessibility**: screen-shake toggle, sound toggle, mouse/keyboard, gamepad,
  and touch input.

## Tech

Pure vanilla JavaScript + HTML5 Canvas. All art is drawn procedurally (no image
assets); all audio is synthesized live with the WebAudio API (no sound files).
Source is organized under `src/` and loaded as classic scripts on a global `RE`
namespace, so the game runs straight from the filesystem.

See [`CHANGELOG.md`](CHANGELOG.md) for version history and
[`docs/`](docs/) for design notes.

## Development

A headless smoke test (Playwright) boots the game, drives input, and checks for
runtime errors:

```bash
npm install --no-save playwright
node tools/smoke-test.js
```
