// WHAT THIS FILE DOES
// TEMPORARY cheat keys for testing the menus. Delete this file when real gameplay exists.
//   G = +50 of every resource      U = unlock every building
import type { World } from '../sim/world'
import { BUILDINGS, RESOURCES } from '../sim/buildings'

export function initDebugKeys(world: World) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return
    if (e.code === 'KeyG') {
      for (const id of Object.keys(RESOURCES)) world.resources[id] = (world.resources[id] ?? 0) + 50
    }
    if (e.code === 'KeyU') world.unlockedBuildings = BUILDINGS.map((b) => b.id)
  })
}
