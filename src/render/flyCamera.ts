// WHAT THIS FILE DOES
// Debug free-fly camera (press F to switch to it).
//   W A S D = fly, Q / E = down / up, Shift = faster
//   L = lock / unlock the mouse. While locked, moving the mouse looks around.
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Scene } from '@babylonjs/core/scene'
import { CONFIG } from '../config'

export function createFlyCamera(scene: Scene, canvas: HTMLCanvasElement) {
  const camera = new UniversalCamera('flyCamera', new Vector3(0, 10, -10), scene)
  camera.minZ = 0.1
  camera.maxZ = 1000
  camera.speed = CONFIG.cameraSpeed
  camera.inertia = 0.8

  // Key codes: W A S D, arrow keys, Q (down), E (up)
  camera.keysUp = [87, 38]
  camera.keysDown = [83, 40]
  camera.keysLeft = [65, 37]
  camera.keysRight = [68, 39]
  camera.keysUpward = [69]
  camera.keysDownward = [81]
  camera.inputs.removeByType('FreeCameraMouseInput') // no drag-to-look

  let enabled = false
  const isLocked = () => document.pointerLockElement === canvas
  const maxPitch = Math.PI / 2 - 0.01

  window.addEventListener('mousemove', (e) => {
    if (!enabled || !isLocked()) return
    camera.rotation.y += e.movementX * CONFIG.cameraLookSensitivity
    camera.rotation.x += e.movementY * CONFIG.cameraLookSensitivity
    camera.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, camera.rotation.x))
  })

  window.addEventListener('keydown', (e) => {
    if (!enabled || e.code !== 'KeyL') return
    if (isLocked()) document.exitPointerLock()
    else canvas.requestPointerLock()
  })

  const setFast = (fast: boolean) => {
    camera.speed = CONFIG.cameraSpeed * (fast ? CONFIG.cameraFastMultiplier : 1)
  }
  window.addEventListener('keydown', (e) => e.key === 'Shift' && setFast(true))
  window.addEventListener('keyup', (e) => e.key === 'Shift' && setFast(false))
  window.addEventListener('blur', () => setFast(false))

  return {
    camera,
    setEnabled(on: boolean) {
      enabled = on
      if (on) {
        camera.attachControl(canvas, true)
      } else {
        camera.detachControl()
        if (isLocked()) document.exitPointerLock()
      }
    },
  }
}
