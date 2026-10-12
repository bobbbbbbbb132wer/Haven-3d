// WHAT THIS FILE DOES
// Creates both cameras and lets you switch between them.
//   F = switch between the main city-builder camera and the debug free-fly camera
//   Z = jump to a high overview of the whole world; Z again = back to exactly where you were
import type { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { createRtsCamera } from './rtsCamera'
import { createFlyCamera } from './flyCamera'
import { WORLD_SIZE } from '../sim/terrain'

export type CameraMode = 'rts' | 'fly'

export function createCameras(scene: Scene, canvas: HTMLCanvasElement) {
  const rts = createRtsCamera(scene, canvas)
  const fly = createFlyCamera(scene, canvas)
  let mode: CameraMode = 'rts'

  const setMode = (next: CameraMode) => {
    mode = next
    if (next === 'fly') {
      // Start flying from wherever the main camera is
      fly.camera.position.copyFrom(rts.camera.position)
      fly.camera.setTarget(rts.getFocus())
      rts.setEnabled(false)
      fly.setEnabled(true)
      scene.activeCamera = fly.camera
    } else {
      fly.setEnabled(false)
      rts.setEnabled(true)
      scene.activeCamera = rts.camera
    }
    window.dispatchEvent(new CustomEvent('cameramodechange', { detail: next }))
  }

  // Z: overview of the whole world and back. Works in both camera modes.
  let saved: {
    mode: CameraMode
    rts: ReturnType<typeof rts.getView>
    flyPos: Vector3
    flyRot: Vector3
  } | null = null

  const toggleInspect = () => {
    if (!saved) {
      saved = {
        mode,
        rts: rts.getView(),
        flyPos: fly.camera.position.clone(),
        flyRot: fly.camera.rotation.clone(),
      }
      rts.setInspect(true, 6)
      rts.setView({ x: 0, z: 0, yaw: 0, pitch: 60, zoom: WORLD_SIZE * 0.9 })
      if (mode === 'fly') {
        fly.camera.position.set(0, WORLD_SIZE * 0.6, WORLD_SIZE * 0.55)
        fly.camera.setTarget(new Vector3(0, 4, 0))
      }
    } else {
      const s = saved
      saved = null
      rts.setInspect(false)
      rts.setView(s.rts)
      if (mode !== s.mode) setMode(s.mode)
      fly.camera.position.copyFrom(s.flyPos)
      fly.camera.rotation.copyFrom(s.flyRot)
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return
    if (e.code === 'KeyF') setMode(mode === 'rts' ? 'fly' : 'rts')
    if (e.code === 'KeyZ') toggleInspect()
  })

  setMode('rts')
  return { rts, fly, getMode: () => mode }
}
