// WHAT THIS FILE DOES
// The showroom: a flat grid beside the world (not connected to it). Every model in
// src/assets/models (the campfire plus the whole Modular Terrain Pack) stands on a pedestal at
// its real size, grouped by kind, one group per row, spinning slowly. Name labels only appear
// for pedestals near the camera. A tilted status board on the ground shows the day, time of day,
// resources and other stats live. Press X to fly the camera there, X again to go back.
import type { Scene } from '@babylonjs/core/scene'
import type { Engine } from '@babylonjs/core/Engines/engine'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle'
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock'
import { models } from '../assets'
import { loadModel } from './assetLoader'
import { getTerrain } from '../sim/terrain'
import type { World } from '../sim/world'
import { SHOWROOM } from './showroomSpec'
import { drawStats, STATS_H, STATS_W } from './statsDisplay'
import { chunksPerSide } from './chunkData'

const COLS = 28
const SPACING = 4
const FIRST_ROW_Z = -54
const MAX_FIT = 3.6 // models wider than this are shrunk to fit their pedestal
const BOARD = { w: 32, h: 16, z: 40, y: 3, tilt: 0.35 }
const GROUP_ORDER = [
  'campfire', 'Hilly_Terrain', 'Mountain', 'Shared_Terrain', 'Hilly_Prop', 'Shared_Prop',
  'Beach_Terrain', 'Beach_Prop', 'Cliff_Terrain', 'Cliff_Prop', 'Escarpment_Terrain',
  'Cave_Terrain', 'Cave_Cliff', 'Cave_Prop',
]

const groupOf = (n: string) =>
  n === 'campfire' ? 'campfire'
  : n.startsWith('Mountain') ? 'Mountain'
  : n.startsWith('Cave_Cliff') ? 'Cave_Cliff'
  : n.split('_').slice(0, 2).join('_')

/** One slot per model: each group starts on a fresh row. */
function layout(names: string[]) {
  const byGroup = new Map<string, string[]>()
  for (const n of names) {
    const g = groupOf(n)
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g)!.push(n)
  }
  const groups = [...byGroup.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a)
    const ib = GROUP_ORDER.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
  })
  const slots: { name: string; x: number; z: number }[] = []
  let row = 0
  for (const g of groups) {
    const list = byGroup.get(g)!.sort((a, b) => a.localeCompare(b))
    list.forEach((name, i) => {
      slots.push({
        name,
        x: ((i % COLS) - (COLS - 1) / 2) * SPACING,
        z: FIRST_ROW_Z + (row + Math.floor(i / COLS)) * SPACING,
      })
    })
    row += Math.ceil(list.length / COLS)
  }
  return slots
}

function gridMaterial(scene: Scene, size: number) {
  const tex = new DynamicTexture('showroomGridTex', { width: 1024, height: 1024 }, scene, true)
  const ctx = tex.getContext() as CanvasRenderingContext2D
  ctx.fillStyle = '#2a3037'
  ctx.fillRect(0, 0, 1024, 1024)
  const cells = size / 4
  ctx.strokeStyle = '#3a444f'
  ctx.lineWidth = 2
  for (let k = 0; k <= cells; k++) {
    const p = (k / cells) * 1024
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 1024); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(1024, p); ctx.stroke()
  }
  ctx.strokeStyle = '#7ec8a0'
  ctx.lineWidth = 10
  ctx.strokeRect(0, 0, 1024, 1024)
  tex.update()
  const mat = new StandardMaterial('showroomGridMat', scene)
  mat.diffuseTexture = tex
  mat.specularColor = Color3.Black()
  mat.freeze()
  return mat
}

export async function spawnShowroom(scene: Scene, world: World, engine: Engine) {
  const { cx, cz, size } = SHOWROOM
  const root = new TransformNode('showroom', scene)
  root.position.set(cx, 0, cz)

  // ground slab (top surface at y = 0)
  const ground = MeshBuilder.CreateBox('showroomGround', { width: size, depth: size, height: 1 }, scene)
  ground.parent = root
  ground.position.y = -0.5
  ground.material = gridMaterial(scene, size)
  ground.isPickable = false
  ground.freezeWorldMatrix()

  // ---- status board: tilted panel on four short legs ----
  const boardTex = new DynamicTexture('statsTex', { width: STATS_W, height: STATS_H }, scene, false)
  const boardCtx = boardTex.getContext() as CanvasRenderingContext2D
  const boardMat = new StandardMaterial('statsMat', scene)
  boardMat.diffuseColor = Color3.Black()
  boardMat.specularColor = Color3.Black()
  boardMat.emissiveTexture = boardTex // glows, so it stays readable at night
  boardMat.backFaceCulling = false
  const board = MeshBuilder.CreatePlane('statsBoard', { width: BOARD.w, height: BOARD.h }, scene)
  board.parent = root
  board.position.set(0, BOARD.y, BOARD.z)
  board.rotation.set(Math.PI / 2 - BOARD.tilt, Math.PI, 0) // lies back toward the viewer at the south
  board.material = boardMat
  board.isPickable = false
  const legMat = new StandardMaterial('statsLegMat', scene)
  legMat.diffuseColor = new Color3(0.2, 0.24, 0.28)
  legMat.specularColor = Color3.Black()
  for (const sx of [-BOARD.w / 2 + 0.7, BOARD.w / 2 - 0.7]) {
    for (const dz of [-6, 6]) {
      const h = BOARD.y - dz * Math.tan(BOARD.tilt) - 0.08 // north side is higher
      const leg = MeshBuilder.CreateBox('statsLeg', { width: 0.6, depth: 0.6, height: h }, scene)
      leg.parent = root
      leg.position.set(sx, h / 2, BOARD.z + dz)
      leg.material = legMat
      leg.isPickable = false
      leg.freezeWorldMatrix()
    }
  }

  const t = getTerrain()
  const buildablePct = t ? Math.round((t.buildable.reduce((a, b) => a + b, 0) / t.buildable.length) * 100) : 0
  let lastDraw = -1e9
  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now()
    if (now - lastDraw < 250) return
    const cam = scene.activeCamera
    if (cam) {
      const p = cam.globalPosition
      if (Math.hypot(p.x - cx, p.z - cz) > 190) return // far away: skip the redraw entirely
    }
    lastDraw = now
    drawStats(boardCtx, world, {
      fps: engine.getFps(),
      seed: t?.seed ?? 0,
      size: t?.size ?? 0,
      chunks: t ? chunksPerSide(t) ** 2 : 0,
      buildablePct,
    })
    boardTex.update()
  })

  // ---- the models ----
  const slots = layout(Object.keys(models))
  const ui = AdvancedDynamicTexture.CreateFullscreenUI('showroomLabels', true, scene)
  const spinners: TransformNode[] = []
  const labels: { label: Rectangle; holder: TransformNode; shown: boolean }[] = []
  const padMat = new StandardMaterial('padMat', scene)
  padMat.diffuseColor = new Color3(0.25, 0.28, 0.32)
  padMat.specularColor = Color3.Black()
  let padSource: Mesh | null = null

  let tick = 0
  scene.onBeforeRenderObservable.add(() => {
    const cam = scene.activeCamera
    if (!cam) return
    const p = cam.globalPosition
    if (Math.hypot(p.x - cx, p.z - cz) > 190) return // not looking at the showroom: no spin, no labels
    const dt = scene.getEngine().getDeltaTime() / 1000
    for (const s of spinners) s.rotation.y += dt * 0.5
    if (++tick % 8) return
    // only the labels near the camera exist on screen, which keeps the GUI cheap
    for (const l of labels) {
      const q = l.holder.getAbsolutePosition()
      const near = Math.hypot(q.x - p.x, q.z - p.z) < 34 && Math.abs(q.y - p.y) < 90
      if (near && !l.shown) {
        ui.addControl(l.label) // must be added before it can be linked to a mesh
        l.label.linkWithMesh(l.holder)
        l.label.linkOffsetY = 26
        l.shown = true
      }
      else if (!near && l.shown) { ui.removeControl(l.label); l.shown = false }
    }
  })

  const place = async (slot: { name: string; x: number; z: number }) => {
    try {
      const { meshes } = await loadModel(scene, slot.name)
      const holder = new TransformNode(`show_${slot.name}`, scene)
      const modelRoot = meshes[0]
      modelRoot.parent = holder

      // real size, centred on its pedestal; only shrink pieces that are too big for it
      const first = modelRoot.getHierarchyBoundingVectors(true)
      const k = Math.min(1, MAX_FIT / Math.max(first.max.x - first.min.x, first.max.z - first.min.z, 0.001))
      modelRoot.scaling.scaleInPlace(k)
      modelRoot.computeWorldMatrix(true)
      const b = modelRoot.getHierarchyBoundingVectors(true)
      modelRoot.position.x -= (b.min.x + b.max.x) / 2
      modelRoot.position.z -= (b.min.z + b.max.z) / 2
      modelRoot.position.y -= b.min.y
      for (const m of meshes) m.isPickable = false

      holder.parent = root
      holder.position.set(slot.x, 0.1, slot.z)
      spinners.push(holder)

      // one real pedestal, the rest are cheap instances of it
      let pad
      if (!padSource) {
        padSource = MeshBuilder.CreateCylinder('padSource', { diameter: 3.4, height: 0.1 }, scene)
        padSource.material = padMat
        padSource.isPickable = false
        pad = padSource
      } else pad = padSource.createInstance(`pad_${slot.name}`)
      pad.parent = root
      pad.position.set(slot.x, 0.05, slot.z)

      const label = new Rectangle()
      label.width = '230px'
      label.height = '22px'
      label.background = 'rgba(20,24,30,0.85)'
      label.color = '#5b6b7d'
      label.thickness = 1
      label.cornerRadius = 6
      const text = new TextBlock('', slot.name.replace(/_/g, ' '))
      text.color = '#e8edf2'
      text.fontSize = 12
      label.addControl(text)
      labels.push({ label, holder, shown: false })
    } catch (err) {
      console.error(`showroom: ${slot.name} failed:`, err)
    }
  }

  // load in small parallel batches: much faster than one at a time, still gentle on the browser
  for (let i = 0; i < slots.length; i += 8) {
    await Promise.all(slots.slice(i, i + 8).map(place))
  }
}
