// WHAT THIS FILE DOES
// The showroom: every model in src/assets/models stands on a slowly spinning pedestal along the
// north edge of the test pad, at its real in-game size, with a name label. Drop in a new .glb and
// it appears here automatically. The showroom tiles are blocked so you can't build on them.
import type { Scene } from '@babylonjs/core/scene'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle'
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock'
import { models } from '../assets'
import { loadModel } from './assetLoader'
import { SCENERY } from '../sim/scenery'
import { metaOf } from '../sim/buildingMeta'
import type { Terrain } from '../sim/terrain'

const COLS = 10
const SPACING = 5
const FIRST_ROW_Z = -31 // z of the first row of pedestals
const ROOM_EDGE_Z = -13 // everything north of this is showroom (not buildable)

export async function spawnShowroom(scene: Scene, terrain: Terrain) {
  // block the showroom tiles so buildings can't be placed on the models
  const half = terrain.size / 2
  for (let j = 0; j < terrain.size; j++) {
    if (j - half + 0.5 >= ROOM_EDGE_Z) break
    for (let i = 0; i < terrain.size; i++) terrain.blocked[j * terrain.size + i] = 1
  }

  // buildings first, then scenery, each sorted by name
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
      const root = meshes[0]
      const holder = new TransformNode(`show_${name}`, scene)
      root.parent = holder

      // same sizing rules as the game: scenery uses SCENERY, buildings use their footprint width
      const first = root.getHierarchyBoundingVectors(true)
      const def = SCENERY[name]
      const k = def?.h
        ? def.h / Math.max(first.max.y - first.min.y, 0.001)
        : (def?.w ?? metaOf(name).w) /
          Math.max(first.max.x - first.min.x, first.max.z - first.min.z, 0.001)
      root.scaling.scaleInPlace(k)
      root.computeWorldMatrix(true)
      const b = root.getHierarchyBoundingVectors(true)
      root.position.x -= (b.min.x + b.max.x) / 2
      root.position.z -= (b.min.z + b.max.z) / 2
      root.position.y -= b.min.y
      for (const m of meshes) m.isPickable = false

      const x = ((n % COLS) - (COLS - 1) / 2) * SPACING
      const z = FIRST_ROW_Z + Math.floor(n / COLS) * SPACING
      holder.position.set(x, 0.1, z)
      spinners.push(holder)

      const pad = MeshBuilder.CreateCylinder(`pad_${name}`, { diameter: 3.6, height: 0.1 }, scene)
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
