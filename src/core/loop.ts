// WHAT THIS FILE DOES
// The game's heartbeat. The sim ticks at a fixed speed, the picture redraws every frame.
// VSync ON  = draw once per screen refresh (normal).
// VSync OFF = draw as fast as possible. Browsers can't truly disable VSync, so you
//             won't see the extra frames, but the FPS counter will show them.
import type { World } from '../sim/world'
import type { View } from '../render/scene'
import { CONFIG } from '../config'
import { updateWorld } from '../sim/simulate'

/** How many frames have been drawn so far. The FPS counter reads this. */
export const frameStats = { frames: 0 }

let vsyncOn = true
let applyVsync: (on: boolean) => void = () => {}

export const isVsyncOn = () => vsyncOn

export function setVsync(on: boolean) {
  vsyncOn = on
  applyVsync(on)
}

export function startLoop(world: World, view: View) {
  const tickLength = 1000 / CONFIG.ticksPerSecond
  let leftover = 0
  let lastTime = performance.now()

  const drawFrame = () => {
    const now = performance.now()
    leftover += Math.min(now - lastTime, 250)
    lastTime = now
    while (leftover >= tickLength) {
      for (const site of updateWorld(world, tickLength / 1000)) {
        // tell the 3D side a building finished (it swaps the scaffold for the real model)
        window.dispatchEvent(new CustomEvent('sitefinished', { detail: site }))
      }
      leftover -= tickLength
    }
    view.scene.render()
    frameStats.frames++
  }

  // Uncapped loop: a message to ourselves each frame, which is much faster than a timer
  const channel = new MessageChannel()
  let uncapped = false
  let generation = 0 // stops old loops from running after you switch modes

  const nextUncappedFrame = (id: number) => {
    if (document.hidden) setTimeout(() => channel.port2.postMessage(id), 250)
    else channel.port2.postMessage(id)
  }

  channel.port1.onmessage = (event) => {
    if (!uncapped || event.data !== generation) return
    view.engine.beginFrame()
    drawFrame()
    view.engine.endFrame()
    nextUncappedFrame(generation)
  }

  applyVsync = (on) => {
    view.engine.stopRenderLoop()
    generation++
    uncapped = !on
    if (on) view.engine.runRenderLoop(drawFrame)
    else nextUncappedFrame(generation)
  }

  applyVsync(vsyncOn)
}
