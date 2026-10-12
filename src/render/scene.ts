// WHAT THIS FILE DOES
// Creates the 3D window: engine, scene, light, cameras, a small flat test pad and the showroom.
import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { createCameras } from './camera'
import { CONFIG } from '../config'
import { generateTerrain, setTerrain } from '../sim/terrain'
import { createTerrainMesh } from './terrain'
import { spawnShowroom } from './showroom'
import { spawnTerrainSample } from './terrainSample'

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
  // Small flat test pad: build on the south part, models are on show along the north edge.
  const terrain = generateTerrain(1337, CONFIG.flatSize, true)
  setTerrain(terrain)
  createTerrainMesh(scene, terrain)
  spawnShowroom(scene, terrain).catch((error) => console.error('Showroom failed:', error))
  try {
    spawnTerrainSample(scene) // east of the pad; press Z to inspect it
  } catch (error) {
    console.error('Terrain sample failed:', error)
  }

  window.addEventListener('resize', () => engine.resize())
  return { engine, scene, cameras }
}
