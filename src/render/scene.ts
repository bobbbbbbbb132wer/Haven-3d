// WHAT THIS FILE DOES
// Creates the 3D window: engine, scene, light, cameras and the generated terrain.
// Only terrain is generated: no trees, rocks, buildings or other decorations.
import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { createCameras } from './camera'
import { WORLD_SIZE, setTerrain } from '../sim/terrain'
import { generateWorld } from '../sim/worldgen'
import { createTerrainMesh } from './terrain'

export interface View {
  engine: Engine
  scene: Scene
  cameras: ReturnType<typeof createCameras>
}

export async function createScene(container: HTMLElement): Promise<View> {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'width:100%;height:100%;display:block;outline:none'
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  container.appendChild(canvas)

  const engine = new Engine(canvas, true)
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.55, 0.75, 0.95, 1) // sky blue

  new HemisphericLight('sun', new Vector3(0.3, 1, 0.2), scene)

  const cameras = createCameras(scene, canvas)
  // Fixed seed: the same world every time.
  const terrain = generateWorld(1337, WORLD_SIZE)
  setTerrain(terrain)
  createTerrainMesh(scene, terrain)

  window.addEventListener('resize', () => engine.resize())
  return { engine, scene, cameras }
}
