// WHAT THIS FILE DOES
// Connects all the parts: the world data, the 3D picture, the buttons, and the game loop.
// Think of it as the person who introduces everyone at a party.
import { createWorld } from '../sim/world'
import { createScene } from '../render/scene'
import { initUI } from '../gui/gui'
import { startLoop } from './loop'
import { initDebugKeys } from './debugKeys'
import { sample } from '../sim/resources'
import { initDaylight } from '../render/daylight'
import { spawnShowroom } from '../render/showroom'

export async function startGame() {
  const world = createWorld()
  const view = await createScene(document.getElementById('app')!)
  initDaylight(view.scene, world)
  spawnShowroom(view.scene, world, view.engine).catch((e) => console.error('Showroom failed:', e))
  initUI(document.getElementById('ui')!, world, view.engine, view.scene)
  initDebugKeys(world)
  sample(world, performance.now())
  setInterval(() => sample(world, performance.now()), 1000)
  startLoop(world, view)
}
