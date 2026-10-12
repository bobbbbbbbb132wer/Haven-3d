// WHAT THIS FILE DOES
// Takes a picture of each building's real model (side-on, transparent background)
// and returns it as an embedded image, so the menu needs no image files.
import type { Engine } from '@babylonjs/core/Engines/engine'
import '@babylonjs/core/Engines/Extensions/engine.renderTarget'
import '@babylonjs/core/Misc/dumpTools'
import { CreateScreenshotUsingRenderTargetAsync } from '@babylonjs/core/Misc/screenshotTools'
import { Scene } from '@babylonjs/core/scene'
import { Camera } from '@babylonjs/core/Cameras/camera'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { IconDef } from './iconDefs'

async function renderIcon(
  engine: Engine,
  def: IconDef,
  size: number,
  angled: boolean,
): Promise<string> {
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0, 0, 0, 0) // transparent background

  await def.build(scene)
  scene.meshes.forEach((m) => m.computeWorldMatrix(true))

  // Bounding box of the real geometry only (skips the empty root node)
  let min = new Vector3(Infinity, Infinity, Infinity)
  let max = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const m of scene.meshes) {
    if (m.getTotalVertices() === 0) continue
    const b = m.getBoundingInfo().boundingBox
    min = Vector3.Minimize(min, b.minimumWorld)
    max = Vector3.Maximize(max, b.maximumWorld)
  }
  const center = Vector3.Center(min, max)
  const ext = max.subtract(min)

  // Straight-on side view (angled = false) or a slight 3/4 view (angled = true)
  const cam = new ArcRotateCamera(
    'iconCam',
    angled ? -Math.PI / 2 + 0.55 : -Math.PI / 2,
    angled ? 1.1 : Math.PI / 2,
    30,
    center,
    scene,
  )
  cam.mode = Camera.ORTHOGRAPHIC_CAMERA
  const half = (angled ? ext.length() / 2 : Math.max(ext.x, ext.y) / 2) * 1.15
  cam.orthoLeft = -half
  cam.orthoRight = half
  cam.orthoTop = half
  cam.orthoBottom = -half
  cam.minZ = 0.1
  cam.maxZ = 200

  // Same lighting for every icon
  const hemi = new HemisphericLight('h', new Vector3(0.2, 1, -0.4), scene)
  hemi.intensity = 0.9
  const dir = new DirectionalLight('d', new Vector3(-0.4, -0.6, 0.7), scene)
  dir.intensity = 0.7

  await new Promise<void>((res) => scene.executeWhenReady(() => res()))
  const url = await CreateScreenshotUsingRenderTargetAsync(
    engine,
    cam,
    { width: size, height: size },
    'image/png',
    4,
    true,
  )
  scene.dispose()
  return url
}

// Returns { buildingId: base64 PNG data URL }
export async function generateIcons(
  engine: Engine,
  defs: IconDef[],
  opts: { size?: number; angled?: boolean } = {},
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const def of defs) {
    try {
      out[def.id] = await renderIcon(engine, def, opts.size ?? 256, opts.angled ?? false)
    } catch (err) {
      console.error(`icon failed for ${def.id}:`, err)
    }
  }
  return out
}
