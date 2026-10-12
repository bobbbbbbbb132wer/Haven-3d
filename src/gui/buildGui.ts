// WHAT THIS FILE DOES
// The build menu: a draggable panel with a category sidebar, a grid of building cards,
// and a details panel. Cards come from the buildings that have a real model.
import type { Engine } from '@babylonjs/core/Engines/engine'
import type { Scene } from '@babylonjs/core/scene'
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle'
import { Grid } from '@babylonjs/gui/2D/controls/grid'
import { Button } from '@babylonjs/gui/2D/controls/button'
import { Image as GuiImage } from '@babylonjs/gui/2D/controls/image'
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock'
import { Control } from '@babylonjs/gui/2D/controls/control'
import { generateIcons } from './iconGenerator'
import { BUILDINGS as ICON_DEFS } from './iconDefs'
import { BUILDINGS as REAL, RESOURCES, type BuildingDef } from '../sim/buildings'
import { CATEGORIES, buildSeconds, metaOf } from '../sim/buildingMeta'
import { THEME } from './theme'
import { setHover } from '../core/uiHover'

const W = 780 // panel size (in UI units)
const H = 470
const HEAD = 40
const SIDE = 150 // category sidebar width
const COLS = 3
const CARD = 118
const GAP = 8
const GRID_W = COLS * (CARD + GAP)
const DETAILS_W = W - SIDE - GRID_W
const BODY_H = H - HEAD

function costText(cost: Record<string, number>) {
  return Object.entries(cost)
    .map(([r, n]) => `${RESOURCES[r]?.icon ?? ''} ${n} ${RESOURCES[r]?.name ?? r}`)
    .join('\n')
}

function text(str: string, size: number, color: string = THEME.text) {
  const t = new TextBlock('', str)
  t.color = color
  t.fontFamily = THEME.font
  t.fontSize = size
  return t
}

export async function initBuildGui(engine: Engine, scene: Scene, onSelect: (id: string) => void) {
  let icons: Record<string, string> = {}
  try {
    icons = await generateIcons(engine, ICON_DEFS, { size: 256, angled: false })
    console.log('icons generated:', Object.keys(icons))
  } catch (err) {
    console.error('icon generation failed:', err)
  }

  const ui = AdvancedDynamicTexture.CreateFullscreenUI('ui', true, scene)
  ui.idealHeight = 1080
  ui.renderAtIdealSize = true
  const canvas = engine.getRenderingCanvas() as HTMLCanvasElement

  // ---- the panel (anchored top-left, moved by changing left/top) ----
  const panel = new Rectangle('buildPanel')
  panel.width = `${W}px`
  panel.height = `${H}px`
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  panel.leftInPixels = 16
  panel.topInPixels = 72
  panel.background = THEME.panelBg
  panel.color = THEME.border
  panel.thickness = 2
  panel.cornerRadius = 10
  panel.isPointerBlocker = true
  ui.addControl(panel)
  const hover = (over: boolean) => setHover('build', over)
  panel.onPointerEnterObservable.add(() => hover(true))
  panel.onPointerOutObservable.add(() => hover(false))

  // ---- header: title + close button, also the drag handle ----
  const header = new Rectangle('header')
  header.height = `${HEAD}px`
  header.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  header.background = 'rgba(60,72,86,0.9)'
  header.thickness = 0
  header.cornerRadius = 8
  header.isPointerBlocker = true
  header.hoverCursor = 'grab'
  panel.addControl(header)

  const title = text('Build  (drag me, B to toggle)', 16)
  title.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  title.paddingLeftInPixels = 12
  title.isHitTestVisible = false
  header.addControl(title)

  const close = Button.CreateSimpleButton('close', '✕')
  close.width = '28px'
  close.height = '28px'
  close.color = THEME.text
  close.background = 'rgba(0,0,0,0.25)'
  close.thickness = 0
  close.cornerRadius = 6
  close.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT
  close.paddingRightInPixels = 6
  close.onPointerClickObservable.add(() => {
    panel.isVisible = false
    hover(false)
  })
  header.addControl(close)

  // ---- dragging ----
  let dragging = false
  let mx = 0
  let my = 0
  header.onPointerDownObservable.add(() => {
    dragging = true
    header.hoverCursor = 'grabbing'
  })
  window.addEventListener('pointermove', (e) => {
    if (dragging) {
      const k = canvas.clientHeight / ui.idealHeight // screen px per UI unit
      const maxLeft = canvas.clientWidth / k - W
      const maxTop = canvas.clientHeight / k - HEAD
      panel.leftInPixels = Math.min(Math.max(panel.leftInPixels + (e.clientX - mx) / k, 0), maxLeft)
      panel.topInPixels = Math.min(Math.max(panel.topInPixels + (e.clientY - my) / k, 0), maxTop)
    }
    mx = e.clientX
    my = e.clientY
  })
  window.addEventListener('pointerup', () => {
    dragging = false
    header.hoverCursor = 'grab'
  })

  // ---- data: only buildings that have a real model ----
  const cardDefs = ICON_DEFS.map((d) => REAL.find((b) => b.id === d.id)).filter(
    (b): b is BuildingDef => !!b,
  )
  let selectedId = ''

  // ---- details panel (right side) ----
  const details = new Rectangle('details')
  details.width = `${DETAILS_W}px`
  details.height = `${BODY_H}px`
  details.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT
  details.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
  details.thickness = 0
  panel.addControl(details)

  const placeholder = text('Select a building', 16, '#9aa7b5')
  details.addControl(placeholder)

  const dContent = new Rectangle('dContent')
  dContent.thickness = 0
  dContent.isVisible = false
  details.addControl(dContent)

  const dImg = new GuiImage('dImg', '')
  dImg.width = '140px'
  dImg.height = '140px'
  dImg.stretch = GuiImage.STRETCH_UNIFORM
  dImg.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  dImg.topInPixels = 8
  dContent.addControl(dImg)

  const dName = text('', 20)
  dName.height = '28px'
  dName.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  dName.topInPixels = 156
  dContent.addControl(dName)

  const dInfo = text('', 14, '#b8c4d0')
  dInfo.height = '22px'
  dInfo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  dInfo.topInPixels = 188
  dContent.addControl(dInfo)

  const dCost = text('', 15)
  dCost.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  dCost.topInPixels = 216
  dCost.height = '80px'
  dCost.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  dContent.addControl(dCost)

  const placeHint = text(
    'Now click the ground to place.\nR rotate  |  Esc cancel',
    13,
    THEME.accent,
  )
  placeHint.height = '44px'
  placeHint.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
  placeHint.topInPixels = -10
  dContent.addControl(placeHint)

  // ---- card grid (middle) ----
  const gridArea = new Rectangle('gridArea')
  gridArea.width = `${GRID_W}px`
  gridArea.height = `${BODY_H}px`
  gridArea.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  gridArea.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
  gridArea.leftInPixels = SIDE
  gridArea.thickness = 0
  panel.addControl(gridArea)

  const emptyText = text('Nothing here yet', 15, '#9aa7b5')
  gridArea.addControl(emptyText)

  let grid: Grid | null = null

  function showDetails(def: BuildingDef) {
    selectedId = def.id
    const m = metaOf(def.id)
    placeholder.isVisible = false
    dContent.isVisible = true
    if (icons[def.id]) dImg.source = icons[def.id]
    dName.text = def.name
    dInfo.text = `Size ${m.w}×${m.d}   ⏱ ${buildSeconds(def.id).toFixed(1)}s`
    dCost.text = costText(def.cost)
  }

  function makeCard(def: BuildingDef) {
    const card = new Rectangle(`card_${def.id}`)
    card.width = `${CARD}px`
    card.height = `${CARD}px`
    card.background = THEME.slotBg
    card.color = def.id === selectedId ? THEME.accent : THEME.border
    card.thickness = 2
    card.cornerRadius = 6
    card.isPointerBlocker = true
    card.hoverCursor = 'pointer'

    if (icons[def.id]) {
      const img = new GuiImage(`icon_${def.id}`, icons[def.id])
      img.width = '70px'
      img.height = '70px'
      img.stretch = GuiImage.STRETCH_UNIFORM
      img.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
      img.topInPixels = 6
      card.addControl(img)
    } else {
      card.addControl(text('?', 36, THEME.accent))
    }

    const name = text(def.name, 14)
    name.height = '18px'
    name.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
    name.topInPixels = -24
    card.addControl(name)

    const cost = text(
      Object.entries(def.cost)
        .map(([r, n]) => `${RESOURCES[r]?.icon ?? ''}${n}`)
        .join('  '),
      12,
      '#b8c4d0',
    )
    cost.height = '16px'
    cost.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
    cost.topInPixels = -6
    card.addControl(cost)

    card.onPointerEnterObservable.add(() => {
      if (def.id !== selectedId) card.color = THEME.text
    })
    card.onPointerOutObservable.add(() => {
      if (def.id !== selectedId) card.color = THEME.border
    })
    card.onPointerClickObservable.add(() => {
      showDetails(def)
      onSelect(def.id)
      if (grid)
        for (const c of grid.children) c.color = c.name === card.name ? THEME.accent : THEME.border
    })
    return card
  }

  // ---- category sidebar (left) ----
  const sidebar = new Rectangle('sidebar')
  sidebar.width = `${SIDE}px`
  sidebar.height = `${BODY_H}px`
  sidebar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  sidebar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
  sidebar.background = 'rgba(0,0,0,0.22)'
  sidebar.thickness = 0
  panel.addControl(sidebar)

  const catButtons = new Map<string, Rectangle>()

  function showCategory(catId: string) {
    for (const [id, r] of catButtons) {
      r.background = id === catId ? 'rgba(240,160,48,0.28)' : 'rgba(0,0,0,0)'
    }
    if (grid) {
      gridArea.removeControl(grid)
      grid.dispose()
      grid = null
    }
    const list = cardDefs.filter((b) => catId === 'all' || metaOf(b.id).category === catId)
    emptyText.isVisible = list.length === 0
    if (list.length === 0) return

    const rows = Math.ceil(list.length / COLS)
    const g = new Grid('grid')
    for (let c = 0; c < COLS; c++) g.addColumnDefinition(CARD + GAP, true)
    for (let r = 0; r < rows; r++) g.addRowDefinition(CARD + GAP, true)
    g.width = `${GRID_W}px`
    g.height = `${rows * (CARD + GAP)}px`
    g.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    g.topInPixels = GAP
    list.forEach((def, i) => g.addControl(makeCard(def), Math.floor(i / COLS), i % COLS))
    gridArea.addControl(g)
    grid = g
  }

  const cats = [{ id: 'all', name: 'All', icon: '📋' }, ...CATEGORIES]
  cats.forEach((cat, i) => {
    const count = cardDefs.filter(
      (b) => cat.id === 'all' || metaOf(b.id).category === cat.id,
    ).length
    const row = new Rectangle(`cat_${cat.id}`)
    row.width = `${SIDE - 16}px`
    row.height = '38px'
    row.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
    row.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    row.leftInPixels = 8
    row.topInPixels = 10 + i * 44
    row.thickness = 0
    row.cornerRadius = 6
    row.isPointerBlocker = true
    row.hoverCursor = 'pointer'

    const label = text(`${cat.icon} ${cat.name}  (${count})`, 15, count ? THEME.text : '#7d8996')
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
    label.paddingLeftInPixels = 8
    label.isHitTestVisible = false
    row.addControl(label)

    row.onPointerClickObservable.add(() => showCategory(cat.id))
    sidebar.addControl(row)
    catButtons.set(cat.id, row)
  })

  showCategory('all')

  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'b') {
      panel.isVisible = !panel.isVisible
      hover(false)
    }
  })

  return { ui, panel }
}
