// WHAT THIS FILE DOES
// A button under the FPS counter that turns VSync on and off.
import { isVsyncOn, setVsync } from '../../core/loop'

export function createVsyncToggle(root: HTMLElement) {
  const button = document.createElement('button')
  button.style.cssText =
    'position:fixed;top:48px;right:12px;padding:4px 8px;background:#000a;font:14px monospace;' +
    'border:1px solid #fff4;border-radius:6px;cursor:pointer'
  button.title =
    'ON: one frame per screen refresh. OFF: render as fast as possible (uses more GPU/battery). ' +
    'Browsers cannot truly disable VSync, so extra frames are not shown on screen.'
  root.appendChild(button)

  const update = () => {
    const on = isVsyncOn()
    button.textContent = `VSync: ${on ? 'ON' : 'OFF'}`
    button.style.color = on ? '#0f0' : '#fa0'
  }
  button.addEventListener('click', () => {
    setVsync(!isVsyncOn())
    update()
    button.blur() // so Space/Enter don't re-press it
  })
  update()
}
