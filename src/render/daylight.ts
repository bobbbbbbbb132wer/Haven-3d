// WHAT THIS FILE DOES
// Applies the day/night cycle to the 3D scene every frame: sun and moon light, sky colour.
import type { Scene } from '@babylonjs/core/scene'
import type { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { World } from '../sim/world'
import { dayFraction } from '../sim/clock'
import { lightingFor } from './daylightMath'

export function initDaylight(scene: Scene, world: World) {
  const ambient = scene.getLightByName('sun') as HemisphericLight | null
  const sun = scene.getLightByName('terrainSun') as DirectionalLight | null
  const moon = new DirectionalLight('moon', new Vector3(0, -1, 0), scene)
  moon.diffuse = new Color3(0.55, 0.65, 1)
  moon.specular = Color3.Black()

  scene.onBeforeRenderObservable.add(() => {
    const L = lightingFor(dayFraction(world.clock))
    scene.clearColor.set(L.sky[0], L.sky[1], L.sky[2], 1)
    if (ambient) {
      ambient.intensity = L.ambient
      ambient.diffuse.set(L.ambientColor[0], L.ambientColor[1], L.ambientColor[2])
    }
    if (sun) {
      sun.intensity = L.sunIntensity
      sun.diffuse.set(L.sunColor[0], L.sunColor[1], L.sunColor[2])
      sun.direction.set(L.sunDir[0], L.sunDir[1], L.sunDir[2])
    }
    moon.intensity = L.moonIntensity
    moon.direction.set(L.moonDir[0], L.moonDir[1], L.moonDir[2])
  })
}
