// WHAT THIS FILE DOES
// Remembers which UI panels the mouse is over, so placement knows to hide the ghost and
// not place a building through a menu. Each panel reports in with its own name.
const over = new Set<string>()

export function setHover(id: string, isOver: boolean) {
  if (isOver) over.add(id)
  else over.delete(id)
  window.dispatchEvent(new CustomEvent('buildmenuhover', { detail: over.size > 0 }))
}
