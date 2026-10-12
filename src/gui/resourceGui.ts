// WHAT THIS FILE DOES
// The resource card across the top (always visible) and the Colony Economy panel
// (click a tile or press M). Both only READ numbers from sim/resources.ts.
import type { Engine } from '@babylonjs/core/Engines/engine'
import type { Scene } from '@babylonjs/core/scene'
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle'
import { Grid } from '@babylonjs/gui/2D/controls/grid'
import { Button } from '@babylonjs/gui/2D/controls/button'
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock'
import { Control } from '@babylonjs/gui/2D/controls/control'
import { RESOURCES } from '../sim/buildings'
import { availableOf, reservedOf, sample, trendPerMin } from '../sim/resources'
import type { World } from '../sim/world'
import { setHover } from '../core/uiHover'
import { THEME } from './theme'

const LOW = 10 // below this many available, a material counts as "low"
const GOOD = '#7fe06a'
const BAD = '#ff6b5e'
const MUTED = '#9aa7b5'
const LINE = 'rgba(255,255,255,0.12)'
const TILE_BG = 'rgba(48,60,74,0.95)'

function text(str: string, size: number, color: string = THEME.text) {
  const t = new TextBlock('', str)
  t.color = color
  t.fontFamily = THEME.font
  t.fontSize = size
  t.isHitTestVisible = false
  return t
}

function fmtTrend(t: number) {
  const r = Math.round(Math.abs(t) * 10) / 10
  if (r < 0.1) return '±0/min'
  return `${t > 0 ? '+' : '−'}${r}/min`
}

const trendColor = (t: number) => (t > 0.05 ? GOOD : t < -0.05 ? BAD : MUTED)

export function initResourceGui(engine: Engine, scene: Scene, world: World) {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI('resUI', true, scene)
  ui.idealHeight = 1080
  ui.renderAtIdealSize = true
  const canvas = engine.getRenderingCanvas() as HTMLCanvasElement

  const ids = Object.keys(RESOURCES)
  const n = ids.length
  let focusId = ''

  // ======================= top card =======================
  const TILE_W = 100
  const TILE_H = 84
  const TILE_STEP = TILE_W + 8
  const CARD_LEFT = 40 // nudged right so it clears the build menu
  const CARD_W = Math.max(340, n * TILE_STEP + 16)
  const CARD_H = 166

  const card = new Rectangle('resCard')
  card.width = `${CARD_W}px`
  card.height = `${CARD_H}px`
  card.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  card.leftInPixels = CARD_LEFT
  card.topInPixels = 10
  card.background = THEME.panelBg
  card.color = THEME.border
  card.thickness = 2
  card.cornerRadius = 10
  card.isPointerBlocker = true
  ui.addControl(card)
  card.onPointerEnterObservable.add(() => setHover('resbar', true))
  card.onPointerOutObservable.add(() => {
    setHover('resbar', false)
    tip.isVisible = false
    tipId = ''
  })

  const cardTitle = text('🏕️  COLONY', 17)
  cardTitle.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  cardTitle.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  cardTitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  cardTitle.leftInPixels = 14
  cardTitle.topInPixels = 8
  cardTitle.height = '24px'
  card.addControl(cardTitle)

  const cardKey = text('M: details', 12, MUTED)
  cardKey.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT
  cardKey.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  cardKey.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT
  cardKey.leftInPixels = -14
  cardKey.topInPixels = 11
  cardKey.height = '20px'
  card.addControl(cardKey)

  const divider = new Rectangle('cardLine')
  divider.width = `${CARD_W - 28}px`
  divider.height = '1px'
  divider.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  divider.topInPixels = 38
  divider.background = LINE
  divider.thickness = 0
  divider.isHitTestVisible = false
  card.addControl(divider)

  const cardFoot = text('Click a resource to open its details', 12, MUTED)
  cardFoot.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  cardFoot.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
  cardFoot.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  cardFoot.leftInPixels = 14
  cardFoot.topInPixels = -8
  cardFoot.height = '18px'
  card.addControl(cardFoot)

  const tileAmount: Record<string, TextBlock> = {}
  const tileTrend: Record<string, TextBlock> = {}

  // tooltip under the hovered tile
  const tip = new Rectangle('resTip')
  tip.width = '240px'
  tip.height = '130px'
  tip.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  tip.topInPixels = 10 + CARD_H + 6
  tip.background = 'rgba(14,18,24,0.96)'
  tip.color = THEME.border
  tip.thickness = 2
  tip.cornerRadius = 8
  tip.isVisible = false
  tip.isHitTestVisible = false
  ui.addControl(tip)
  const tipText = text('', 14)
  tipText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  tipText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  tipText.paddingLeftInPixels = 14
  tipText.paddingTopInPixels = 10
  tip.addControl(tipText)
  let tipId = ''

  function tipBody(id: string) {
    const def = RESOURCES[id]
    const avail = Math.floor(availableOf(world, id))
    const t = trendPerMin(id)
    const forecast =
      t < -0.05 && avail > 0 ? `Runs out in ~${Math.ceil(avail / -t)} min` : 'Supply is stable'
    return (
      `${def.icon} ${def.name}\n` +
      `Available: ${avail}\n` +
      `Stored: ${Math.floor(world.resources[id] ?? 0)}    Reserved: ${Math.floor(reservedOf(world, id))}\n` +
      `Net: ${fmtTrend(t)}\n` +
      forecast
    )
  }

  ids.forEach((id, i) => {
    const tile = new Rectangle(`tile_${id}`)
    tile.width = `${TILE_W}px`
    tile.height = `${TILE_H}px`
    tile.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    tile.topInPixels = 48
    tile.leftInPixels = (i - (n - 1) / 2) * TILE_STEP
    tile.background = TILE_BG
    tile.color = 'rgba(0,0,0,0)'
    tile.thickness = 2
    tile.cornerRadius = 8
    tile.isPointerBlocker = true
    tile.hoverCursor = 'pointer'
    card.addControl(tile)

    const icon = text(RESOURCES[id].icon, 24)
    icon.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    icon.topInPixels = 6
    icon.height = '30px'
    tile.addControl(icon)

    const amount = text('0', 22)
    amount.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    amount.topInPixels = 36
    amount.height = '26px'
    tile.addControl(amount)
    tileAmount[id] = amount

    const name = text(RESOURCES[id].name, 13, MUTED)
    name.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
    name.topInPixels = -6
    name.height = '18px'
    tile.addControl(name)

    const trend = text('', 12, MUTED)
    trend.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT
    trend.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    trend.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT
    trend.leftInPixels = -6
    trend.topInPixels = 6
    trend.height = '16px'
    trend.width = '44px'
    tile.addControl(trend)
    tileTrend[id] = trend

    tile.onPointerEnterObservable.add(() => {
      tile.color = THEME.accent
      tipId = id
      tip.leftInPixels = CARD_LEFT + tile.leftInPixels
      tipText.text = tipBody(id)
      tip.isVisible = true
    })
    tile.onPointerOutObservable.add(() => {
      tile.color = 'rgba(0,0,0,0)'
      tip.isVisible = false
      tipId = ''
    })
    tile.onPointerClickObservable.add(() => {
      focusId = id
      showTab('Materials')
      panel.isVisible = true
      refresh()
    })
  })

  // ======================= economy panel =======================
  const COLS = [190, 90, 90, 90, 100]
  const TABLE_W = COLS.reduce((a, b) => a + b, 0)
  const W = TABLE_W + 24
  const HEAD = 44
  const TAB_H = 36
  const ROW_H = 44
  const CONTENT_TOP = HEAD + 10 + TAB_H + 12
  const CONTENT_H = Math.max(170, 28 + n * ROW_H + 8)
  const FOOT_H = 34
  const H = CONTENT_TOP + CONTENT_H + FOOT_H

  const panel = new Rectangle('econPanel')
  panel.width = `${W}px`
  panel.height = `${H}px`
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  panel.leftInPixels = 830
  panel.topInPixels = 200
  panel.background = THEME.panelBg
  panel.color = THEME.border
  panel.thickness = 2
  panel.cornerRadius = 10
  panel.isPointerBlocker = true
  panel.isVisible = false
  ui.addControl(panel)
  panel.onPointerEnterObservable.add(() => setHover('res', true))
  panel.onPointerOutObservable.add(() => setHover('res', false))

  function toggle() {
    panel.isVisible = !panel.isVisible
    if (!panel.isVisible) setHover('res', false)
  }

  // ---- header (drag handle) ----
  const header = new Rectangle('econHeader')
  header.height = `${HEAD}px`
  header.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  header.background = 'rgba(0,0,0,0)'
  header.thickness = 0
  header.isPointerBlocker = true
  header.hoverCursor = 'grab'
  panel.addControl(header)

  const title = text('📈  Colony Economy', 19)
  title.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  title.paddingLeftInPixels = 14
  header.addControl(title)

  const close = Button.CreateSimpleButton('econClose', '✕')
  close.width = '30px'
  close.height = '30px'
  close.color = THEME.text
  close.background = 'rgba(0,0,0,0)'
  close.thickness = 0
  close.cornerRadius = 6
  close.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT
  close.paddingRightInPixels = 8
  close.onPointerClickObservable.add(() => toggle())
  header.addControl(close)

  let dragging = false
  let mx = 0
  let my = 0
  header.onPointerDownObservable.add(() => {
    dragging = true
    header.hoverCursor = 'grabbing'
  })
  window.addEventListener('pointermove', (e) => {
    if (dragging) {
      const k = canvas.clientHeight / ui.idealHeight
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

  // ---- tabs + views ----
  const TABS = ['Overview', 'Materials', 'Production', 'Storage']
  const TAB_GAP = 8
  const TAB_W = (TABLE_W - TAB_GAP * 3) / 4
  const tabBtns: Record<string, Rectangle> = {}
  const views: Record<string, Rectangle> = {}

  function showTab(name: string) {
    for (const t of TABS) {
      views[t].isVisible = t === name
      tabBtns[t].background = t === name ? 'rgba(96,120,144,0.9)' : TILE_BG
    }
  }

  TABS.forEach((name, i) => {
    const b = new Rectangle(`tab_${name}`)
    b.width = `${TAB_W}px`
    b.height = `${TAB_H}px`
    b.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
    b.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    b.leftInPixels = 12 + i * (TAB_W + TAB_GAP)
    b.topInPixels = HEAD + 10
    b.thickness = 0
    b.cornerRadius = 8
    b.isPointerBlocker = true
    b.hoverCursor = 'pointer'
    b.addControl(text(name, 15))
    b.onPointerClickObservable.add(() => showTab(name))
    panel.addControl(b)
    tabBtns[name] = b

    const v = new Rectangle(`view_${name}`)
    v.width = `${TABLE_W}px`
    v.height = `${CONTENT_H}px`
    v.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    v.topInPixels = CONTENT_TOP
    v.thickness = 0
    v.isVisible = false
    panel.addControl(v)
    views[name] = v
  })

  function rowGrid() {
    const g = new Grid()
    for (const w of COLS) g.addColumnDefinition(w, true)
    g.addRowDefinition(1)
    g.width = `${TABLE_W}px`
    return g
  }

  // ---- Materials tab ----
  const mat = views['Materials']
  const colHead = rowGrid()
  colHead.height = '24px'
  colHead.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  mat.addControl(colHead)
  ;['MATERIAL', 'STORED', 'RESERVED', 'AVAILABLE', 'TREND'].forEach((label, c) => {
    const t = text(label, 12, MUTED)
    if (c === 0) {
      t.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
      t.paddingLeftInPixels = 6
    }
    colHead.addControl(t, 0, c)
  })

  interface Row {
    bg: Rectangle
    stored: TextBlock
    reserved: TextBlock
    avail: TextBlock
    trend: TextBlock
  }
  const rows: Record<string, Row> = {}
  ids.forEach((id, i) => {
    const bg = new Rectangle(`row_${id}`)
    bg.width = `${TABLE_W}px`
    bg.height = `${ROW_H}px`
    bg.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    bg.topInPixels = 28 + i * ROW_H
    bg.background = 'rgba(0,0,0,0)'
    bg.color = THEME.accent
    bg.thickness = 0
    bg.cornerRadius = 6
    mat.addControl(bg)

    const line = new Rectangle()
    line.width = `${TABLE_W}px`
    line.height = '1px'
    line.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
    line.background = LINE
    line.thickness = 0
    line.isHitTestVisible = false
    bg.addControl(line)

    const g = rowGrid()
    bg.addControl(g)

    const name = text(`${RESOURCES[id].icon}  ${RESOURCES[id].name}`, 17)
    name.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
    name.paddingLeftInPixels = 6
    g.addControl(name, 0, 0)

    const stored = text('0', 17)
    const reservedT = text('0', 17, MUTED)
    const avail = text('0', 17)
    const trend = text('', 15, MUTED)
    g.addControl(stored, 0, 1)
    g.addControl(reservedT, 0, 2)
    g.addControl(avail, 0, 3)
    g.addControl(trend, 0, 4)
    rows[id] = { bg, stored, reserved: reservedT, avail, trend }
  })

  // ---- Overview tab ----
  const overviewText = text('', 16)
  overviewText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  overviewText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
  overviewText.paddingLeftInPixels = 6
  overviewText.paddingTopInPixels = 4
  views['Overview'].addControl(overviewText)

  // ---- Production / Storage tabs: honest placeholders ----
  const soon = (tab: string, body: string) => {
    const t = text(body, 16, MUTED)
    t.textWrapping = true
    t.width = `${TABLE_W - 40}px`
    views[tab].addControl(t)
  }
  soon(
    'Production',
    'Which buildings make and use each material will show here.\n\nIt needs production buildings (sawmill, farm, forge...), which are not in the game yet.',
  )
  soon(
    'Storage',
    'Storage capacity and where materials are kept will show here.\n\nRight now the colony shares one stockpile with no limit. Capacity comes with storage buildings.',
  )

  // ---- footer ----
  const foot = text('Rates are net change per minute over the last minute.', 12, MUTED)
  foot.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  foot.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
  foot.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  foot.leftInPixels = 14
  foot.topInPixels = -10
  foot.height = '18px'
  panel.addControl(foot)

  showTab('Materials')

  // ======================= refresh (4 times a second) =======================
  function refresh() {
    const alerts: string[] = []
    let reservedTotal = 0
    for (const id of ids) {
      const name = RESOURCES[id].name
      const res = Math.floor(reservedOf(world, id))
      reservedTotal += res
      const avail = Math.floor(availableOf(world, id))
      const t = trendPerMin(id)
      const low = avail < LOW

      tileAmount[id].text = String(avail)
      tileAmount[id].color = low ? BAD : THEME.text
      tileTrend[id].text = t > 0.05 ? `▲${Math.round(t)}` : t < -0.05 ? `▼${Math.round(-t)}` : ''
      tileTrend[id].color = trendColor(t)

      const r = rows[id]
      r.stored.text = String(Math.floor(world.resources[id] ?? 0))
      r.reserved.text = String(res)
      r.avail.text = String(avail)
      r.avail.color = low ? BAD : THEME.text
      r.trend.text = fmtTrend(t)
      r.trend.color = trendColor(t)
      r.bg.thickness = id === focusId ? 1 : 0
      r.bg.background = id === focusId ? 'rgba(240,160,48,0.10)' : 'rgba(0,0,0,0)'

      if (avail <= 0) alerts.push(`🚫  ${name} is out`)
      else if (low) alerts.push(`⚠️  ${name} is low (${avail} left)`)
      if (t < -0.05 && avail > 0)
        alerts.push(`⏳  ${name} runs out in ~${Math.ceil(avail / -t)} min`)
    }
    overviewText.text =
      `${n} materials tracked, shared colony stockpile\n` +
      `${reservedTotal} reserved for buildings under construction\n\n` +
      'ALERTS\n' +
      (alerts.length ? alerts.slice(0, 5).join('\n') : '✅  Everything looks fine')
    if (tipId) tipText.text = tipBody(tipId)
  }

  let lastRefresh = 0
  let lastSample = 0
  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now()
    if (now - lastSample >= 1000) {
      lastSample = now
      sample(world, now)
    }
    if (now - lastRefresh < 250) return
    lastRefresh = now
    refresh()
  })
  sample(world, performance.now())
  refresh()

  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm') toggle()
  })

  return { ui, panel }
}
