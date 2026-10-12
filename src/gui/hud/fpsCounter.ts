// WHAT THIS FILE DOES
// Small frames-per-second counter in the top right corner of the screen.
import { frameStats } from '../../core/loop'

export function createFpsCounter(root: HTMLElement) {
  const box = document.createElement('div')
  box.style.cssText =
    'position:fixed;top:12px;right:12px;padding:4px 8px;background:#000a;color:#0f0;' +
    'font:14px monospace;border-radius:6px;pointer-events:none'
  box.textContent = 'FPS: --'
  root.appendChild(box)

  let lastFrames = frameStats.frames
  let lastTime = performance.now()
  setInterval(() => {
    const now = performance.now()
    const fps = ((frameStats.frames - lastFrames) * 1000) / (now - lastTime)
    box.textContent = `FPS: ${Math.round(fps)}`
    lastFrames = frameStats.frames
    lastTime = now
  }, 500)
}
