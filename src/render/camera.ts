// WHAT THIS FILE DOES
// Creates both cameras and lets you switch between them.
//   F = switch between the main city-builder camera and the debug free-fly camera
//   Z = jump to a high overview of the whole world      X = jump to the showroom
//   Press the same key again (or the other one to switch) and Z/X again to return to exactly
//   where you were. Works in both camera modes.
import type { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { createRtsCamera } from './rtsCamera'
import { createFlyCamera } from './flyCamera'
import { WORLD_SIZE } from '../sim/terrain'
import { SHOWROOM } from './showroomSpec'

export type CameraMode = 'rts' | 'fly'
type V3 = [number, number, number]

const VIEWS: Record<'overview' | 'showroom', { x: number; z: number; pitch: number; zoom: number; focusY: number; flyPos: V3; flyAim: V3 }> = {
  overview: { x: 0, z: 0, pitch: 60, zoom: WORLD_SIZE * 0.9, focusY: 6, flyPos: [0, WORLD_SIZE * 0.6, WORLD_SIZE * 0.55], flyAim: [0, 4, 0] },
  showroom: { x: SHOWROOM.cx, z: SHOWROOM.cz - 6, pitch: 58, zoom: 165, focusY: 3, flyPos: [SHOWROOM.cx, 70, SHOWROOM.cz + 90], flyAim: [SHOWROOM.cx, 2, SHOWROOM.cz - 6] },
}
type ViewName = keyof typeof VIEWS

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

  let saved: {
    mode: CameraMode
    rts: ReturnType<typeof rts.getView>
    flyPos: Vector3
    flyRot: Vector3
  } | null = null
  let current: ViewName | null = null

  const showView = (name: ViewName) => {
    if (!saved) {
      saved = {
        mode,
        rts: rts.getView(),
        flyPos: fly.camera.position.clone(),
        flyRot: fly.camera.rotation.clone(),
      }
    }
    current = name
    const v = VIEWS[name]
    rts.setInspect(true, v.focusY)
    rts.setView({ x: v.x, z: v.z, yaw: 0, pitch: v.pitch, zoom: v.zoom })
    if (mode === 'fly') {
      fly.camera.position.set(v.flyPos[0], v.flyPos[1], v.flyPos[2])
      fly.camera.setTarget(new Vector3(v.flyAim[0], v.flyAim[1], v.flyAim[2]))
    }
  }

  const goBack = () => {
    if (!saved) return
    const s = saved
    saved = null
    current = null
    rts.setInspect(false)
    rts.setView(s.rts)
    if (mode !== s.mode) setMode(s.mode)
    fly.camera.position.copyFrom(s.flyPos)
    fly.camera.rotation.copyFrom(s.flyRot)
  }

  const toggleView = (name: ViewName) => (current === name ? goBack() : showView(name))

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return
    if (e.code === 'KeyF') setMode(mode === 'rts' ? 'fly' : 'rts')
    if (e.code === 'KeyZ') toggleView('overview')
    if (e.code === 'KeyX') toggleView('showroom')
  })

  setMode('rts')
  return { rts, fly, getMode: () => mode }
}
