// WHAT THIS FILE DOES
// Starts the GUI: FPS counter, VSync button, resources, control hints and the build menu.
import type { World } from '../sim/world'
import { BUILDINGS } from '../sim/buildings'
import { createFpsCounter } from './hud/fpsCounter'
import { createVsyncToggle } from './hud/vsyncToggle'
import type { Engine } from '@babylonjs/core/Engines/engine'
import type { Scene } from '@babylonjs/core/scene'
import { initBuildGui } from './buildGui'
import { initPlacement } from '../render/placement'

export function initUI(root: HTMLElement, world: World, engine: Engine, scene: Scene) {
  createFpsCounter(root)
  createVsyncToggle(root)

  const hint = document.createElement('div')
  hint.style.cssText =
    'position:fixed;left:12px;bottom:12px;padding:6px 10px;background:#000a;color:#fff;' +
    'font:14px sans-serif;border-radius:6px;pointer-events:none'
  root.appendChild(hint)

  let mode = 'rts'
  let message = ''
  let messageTimer = 0
  let note = '' // status from placement / terrain tools

  const update = () => {
    if (message) hint.textContent = message
    else if (note) hint.textContent = note
    else if (mode === 'rts') {
      hint.textContent =
        'WASD move | Q/E rotate | Scroll zoom | Right-drag orbit | Shift fast | B build | F free-fly | Z overview, X showroom'
    } else if (document.pointerLockElement) {
      hint.textContent =
        'FREE-FLY: mouse looks, WASD/QE fly, Shift fast, L = free mouse, B build, Z overview, X showroom, F = back'
    } else {
      hint.textContent =
        'FREE-FLY: press L to lock mouse and look, B build, Z overview, X showroom, F = back to main camera'
    }
  }

  window.addEventListener('cameramodechange', (e) => {
    mode = (e as CustomEvent<string>).detail
    update()
  })
  document.addEventListener('pointerlockchange', update)

  // Build menu (created after the hint so it draws on top)
  const placement = initPlacement(engine, scene, world)
  window.addEventListener('placementstatus', (e) => {
    note = (e as CustomEvent<string>).detail
    update()
  })
  initBuildGui(engine, scene, (id) => {
    placement.start(id)
    window.dispatchEvent(new CustomEvent('buildingpicked', { detail: id }))
  })
  window.addEventListener('buildingpicked', (e) => {
    const id = (e as CustomEvent<string>).detail
    const name = BUILDINGS.find((b) => b.id === id)?.name ?? id
    message = `Selected: ${name} (click to place, R rotate, V foundation, T wireframe, Esc cancel)`
    update()
    window.clearTimeout(messageTimer)
    messageTimer = window.setTimeout(() => {
      message = ''
      update()
    }, 3000)
  })

  update()
}
