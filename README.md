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
- Find the exit and **descend**. Enemies and hazards escalate with depth.
- Die and you restart — but **✦ core-shards** persist, spent at the
  **Reconstructor** to permanently strengthen future runs.

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
