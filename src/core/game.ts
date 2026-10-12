// WHAT THIS FILE DOES
// Connects all the parts: the world data, the 3D picture, the buttons, and the game loop.
// Think of it as the person who introduces everyone at a party.
import { createWorld } from '../sim/world'
import { createScene } from '../render/scene'
import { initUI } from '../gui/gui'
import { startLoop } from './loop'
import { initDebugKeys } from './debugKeys'

export async function startGame() {
  const world = createWorld()
  const view = await createScene(document.getElementById('app')!)
  initUI(document.getElementById('ui')!, world, view.engine, view.scene)
  initDebugKeys(world)
  startLoop(world, view)
}
