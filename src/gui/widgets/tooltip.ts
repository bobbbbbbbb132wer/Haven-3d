// WHAT THIS FILE DOES
// Small hover text box that follows the mouse.

export interface TooltipLine {
  text: string
  color?: string
  bold?: boolean
}

export function createTooltip(root: HTMLElement) {
  const box = document.createElement('div')
  box.style.cssText =
    'position:fixed;left:0;top:0;display:none;padding:6px 9px;z-index:50;white-space:nowrap;' +
    'background:#101216ee;border:1px solid #fff3;border-radius:6px;color:#ddd;' +
    'font:13px/1.4 monospace;pointer-events:none'
  root.appendChild(box)

  const move = (x: number, y: number) => {
    const gap = 14
    const width = box.offsetWidth
    const height = box.offsetHeight
    const left = x + gap + width > window.innerWidth ? x - gap - width : x + gap
    const top = y + gap + height > window.innerHeight ? y - gap - height : y + gap
    box.style.transform = `translate(${Math.max(0, left)}px, ${Math.max(0, top)}px)`
  }

  return {
    show(lines: TooltipLine[], x: number, y: number) {
      box.replaceChildren(
        ...lines.map((line) => {
          const row = document.createElement('div')
          row.textContent = line.text
          if (line.color) row.style.color = line.color
          if (line.bold) row.style.fontWeight = 'bold'
          return row
        }),
      )
      box.style.display = 'block'
      move(x, y)
    },
    move,
    hide() {
      box.style.display = 'none'
    },
  }
}
