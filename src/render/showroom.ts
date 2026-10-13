// WHAT THIS FILE DOES
// The showroom: a small flat grid beside the world (not connected to it). Every model in
// src/assets/models stands on a slowly spinning pedestal with a name label, and a tilted status
// board on the ground shows the day, time of day, resources and other stats live.
// Press X to fly the camera there, X again to go back.
import type { Scene } from '@babylonjs/core/scene'
import type { Engine } from '@babylonjs/core/Engines/engine'
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
import { SCENERY } from '../sim/scenery'
import { metaOf } from '../sim/buildingMeta'
import { getTerrain } from '../sim/terrain'
import type { World } from '../sim/world'
import { SHOWROOM } from './showroomSpec'
import { drawStats, STATS_H, STATS_W } from './statsDisplay'
import { chunksPerSide } from './chunkData'

const COLS = 6
const SPACING = 7
const FIRST_ROW_Z = -22
const BOARD = { w: 24, h: 12, z: 17, y: 2.2, tilt: 0.35 }

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
    for (const dz of [-4.5, 4.5]) {
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
      if (Math.hypot(p.x - cx, p.z - cz) > 140) return // far away: skip the redraw entirely
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

  // ---- the models: buildings first, then scenery, each sorted by name ----
  const names = Object.keys(models).sort(
    (a, b) => Number(a in SCENERY) - Number(b in SCENERY) || a.localeCompare(b),
  )
  const ui = AdvancedDynamicTexture.CreateFullscreenUI('showroomLabels', true, scene)
  const spinners: TransformNode[] = []
  const padMat = new StandardMaterial('padMat', scene)
  padMat.diffuseColor = new Color3(0.25, 0.28, 0.32)
  padMat.specularColor = Color3.Black()

  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000
    for (const s of spinners) s.rotation.y += dt * 0.6
  })

  for (let n = 0; n < names.length; n++) {
    const name = names[n]
    try {
      const { meshes } = await loadModel(scene, name)
      const holder = new TransformNode(`show_${name}`, scene)
      const modelRoot = meshes[0]
      modelRoot.parent = holder

      // same sizing rules as the game: scenery uses SCENERY, buildings use their footprint width
      const first = modelRoot.getHierarchyBoundingVectors(true)
      const def = SCENERY[name]
      const k = def?.h
        ? def.h / Math.max(first.max.y - first.min.y, 0.001)
        : (def?.w ?? metaOf(name).w) /
          Math.max(first.max.x - first.min.x, first.max.z - first.min.z, 0.001)
      modelRoot.scaling.scaleInPlace(k)
      modelRoot.computeWorldMatrix(true)
      const b = modelRoot.getHierarchyBoundingVectors(true)
      modelRoot.position.x -= (b.min.x + b.max.x) / 2
      modelRoot.position.z -= (b.min.z + b.max.z) / 2
      modelRoot.position.y -= b.min.y
      for (const m of meshes) m.isPickable = false

      const x = ((n % COLS) - (COLS - 1) / 2) * SPACING
      const z = FIRST_ROW_Z + Math.floor(n / COLS) * SPACING
      holder.parent = root
      holder.position.set(x, 0.1, z)
      spinners.push(holder)

      const pad = MeshBuilder.CreateCylinder(`pad_${name}`, { diameter: 4.5, height: 0.1 }, scene)
      pad.parent = root
      pad.position.set(x, 0.05, z)
      pad.material = padMat
      pad.isPickable = false

      const label = new Rectangle()
      label.width = '170px'
      label.height = '24px'
      label.background = 'rgba(20,24,30,0.8)'
      label.color = '#5b6b7d'
      label.thickness = 1
      label.cornerRadius = 6
      const text = new TextBlock('', name.replace(/_/g, ' '))
      text.color = '#e8edf2'
      text.fontSize = 13
      label.addControl(text)
      ui.addControl(label)
      label.linkWithMesh(holder)
      label.linkOffsetY = 28
    } catch (err) {
      console.error(`showroom: ${name} failed:`, err)
    }
  }
}
