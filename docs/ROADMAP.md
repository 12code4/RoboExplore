# RoboExplore — Development Roadmap

This project is being taken from nothing to a polished, content-rich game through
a deliberate sequence of milestones. Each milestone is a tagged, playable build
verified by the headless smoke test.

## Milestones

| Version | Milestone | Goal |
| --- | --- | --- |
| `0.1.0-slice` | **Vertical Slice** ✅ | Bootable core loop: prove Echo-Sight feels good. |
| `0.5.0-alpha` | **1.0-Alpha** | The whole core loop, playable end to end: all core systems, full enemy/module rosters, biomes, bosses, meta-progression, story fragments. Feature-complete but rough. |
| `0.9.0` | **Build-out & Polish** | New content, tuning, game feel, juice, accessibility, balance. Bring it up to release quality. |
| `1.0.0` | **1.0 Release** 🚀 | Polished, complete, shippable. |
| `1.1.0` | **Content Update 1** | New content drop. |
| `1.2.0` | **Content Update 2** | New content drop. |
| `1.3.0` | **Content Update 3** | New content drop. |
| `1.3.x` | **Polish Pass A** | Post-content refinement. |
| `1.3.y` | **Polish Pass B** | Final refinement. |

## Principles

1. **Always shippable.** Every milestone ends green (smoke test passes, no
   runtime errors) and is committed.
2. **Feel first.** Movement, echo rhythm, and combat readability come before
   raw content volume.
3. **Zero dependencies.** Pure vanilla JS + Canvas + WebAudio; runs by opening
   `index.html`. No build step ever.
4. **Deterministic core.** Seeded RNG so worlds and bugs are reproducible.
5. **Verify by playing.** The smoke test drives real input and screenshots are
   reviewed at each step.

## Design source of truth

`docs/DESIGN.md` — the reconciled design bible (mechanics, enemies, modules,
biomes, bosses, meta-economy, audio/juice, narrative).
