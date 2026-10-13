// WHAT THIS FILE DOES
// One step of the game rules. core/loop.ts calls this at a fixed speed (CONFIG.ticksPerSecond),
// so game speed never depends on the frame rate. Pure data, no 3D in here.
import type { World } from './world'
import { BUILDINGS } from './buildings'
import { tick, type Site } from './construction'
import { consume } from './resources'
import { advanceClock } from './clock'

/** Advances the whole sim by dt seconds. Returns the buildings that finished this step. */
export function updateWorld(world: World, dt: number): Site[] {
  advanceClock(world.clock, dt)
  const done = tick(world.construction, dt)
  for (const s of done) {
    const cost = BUILDINGS.find((b) => b.id === s.id)?.cost
    if (cost) consume(world, cost)
  }
  // TODO: colonists, jobs...
  return done
}
