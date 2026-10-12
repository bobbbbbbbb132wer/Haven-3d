# Start here

## What is where?
| Folder        | In plain words                                            |
|---------------|-----------------------------------------------------------|
| src/config.ts | Numbers you can tweak (camera, tick speed, test pad size) |
| src/sim/      | The game's brain: data and rules (no 3D, no DOM)          |
| src/render/   | The game's eyes: draws the data in 3D                     |
| src/gui/      | Build menu, resource panel, HUD                           |
| src/core/     | Glue: game start, the fixed-speed loop, debug keys        |
| src/assets/   | Drop models here (file name = id)                         |
| src/physics/, src/save/ | Not built yet (stubs)                           |

## The one big rule
The brain (sim) never touches the eyes (render).
Sim holds the facts and advances them in `sim/simulate.ts` at a fixed speed (20 ticks/s).
Render only reads them and draws. When the sim finishes something it announces it with an event
(for example `sitefinished`) and render reacts.

## Commands
- `npm run dev`     start the game while you work
- `npm run check`   look for type mistakes
- `npm run format`  tidy all the code
- `npm run build`   make the single offline file at dist/index.html

## How the game starts right now
A small flat test pad (`CONFIG.flatSize`) with a showroom along the north edge showing every
model at in-game size. The showroom tiles are blocked; build on the open ground south of it.
The old hills-and-forest generator is still in `sim/terrain.ts` and `sim/scenery.ts`. To bring it
back, edit `render/scene.ts`: call `generateTerrain(seed, WORLD_SIZE)` and `scatterScenery`.

## Keys
- Camera: WASD move, Q/E rotate, scroll zoom, right-drag orbit, Shift fast, F free-fly.
- B build menu, M economy panel.
- Placing: click place, Shift+click keep placing, R rotate, V foundation, T wireframe, Esc cancel.
- Test keys (src/core/debugKeys.ts): G = +50 of every resource, U = unlock everything.

## Recipes
**Add a building:** add one line to BUILDINGS in src/sim/buildings.ts and one to META in
src/sim/buildingMeta.ts. It gets a coloured placeholder box automatically.
**Give it a real model:** put `<building id>.glb` in src/assets/models (e.g. tent.glb).
**Add scenery:** put the .glb in src/assets/models and add a size line in SCENERY (sim/scenery.ts).
**Where do costs live?** `world.resources` (stored) and `world.reserved` (promised to sites).

## Before you save your work
Run `npm run check` and `npm run format`. Then commit.
