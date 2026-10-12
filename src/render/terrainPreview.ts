// WHAT THIS FILE DOES
// Shows a see-through overlay of what a ground edit WOULD change before you confirm it:
// orange where ground is cut away, blue where it is filled in. Nothing here changes the terrain.
import type { Scene } from '@babylonjs/core/scene'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { HeightChange } from '../sim/terrainEdit'
import type { Terrain } from '../sim/terrain'

let mesh: Mesh | null = null

export function hideTerrainPreview() {
  if (!mesh) return
  mesh.dispose(false, true)
  mesh = null
}

export function showTerrainPreview(scene: Scene, t: Terrain, changes: HeightChange[]) {
  hideTerrainPreview()
  if (!changes.length) return
  let i0 = Infinity
  let j0 = Infinity
  let i1 = -Infinity
  let j1 = -Infinity
  for (const c of changes) {
    i0 = Math.min(i0, c.i)
    j0 = Math.min(j0, c.j)
    i1 = Math.max(i1, c.i)
    j1 = Math.max(j1, c.j)
  }
  i0 = Math.max(0, i0 - 1)
  j0 = Math.max(0, j0 - 1)
  i1 = Math.min(t.size, i1 + 1)
  j1 = Math.min(t.size, j1 + 1)

  const half = t.size / 2
  const s = t.size + 1
  const w = i1 - i0 + 1
  const h = j1 - j0 + 1
  const byCorner = new Map<number, HeightChange>()
  for (const c of changes) byCorner.set(c.j * s + c.i, c)

  const positions = new Float32Array(w * h * 3)
  const colors = new Float32Array(w * h * 4)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const gi = i0 + i
      const gj = j0 + j
      const c = byCorner.get(gj * s + gi)
      const k = j * w + i
      positions[k * 3] = gi - half
      positions[k * 3 + 1] = (c ? c.to : t.heights[gj * s + gi]) + 0.08
      positions[k * 3 + 2] = gj - half
      const cut = c ? c.to < c.from : false
      colors[k * 4] = cut ? 1 : 0.25
      colors[k * 4 + 1] = cut ? 0.55 : 0.7
      colors[k * 4 + 2] = cut ? 0.15 : 1
      colors[k * 4 + 3] = c ? 0.55 : 0 // unchanged corners fade out
    }
  }
  const indices: number[] = []
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const a = j * w + i
      indices.push(a, a + 1, a + w, a + 1, a + w + 1, a + w)
    }
  }

  mesh = new Mesh('terrainPreview', scene)
  const data = new VertexData()
  data.positions = positions
  data.indices = indices
  data.colors = colors
  data.applyToMesh(mesh)
  mesh.hasVertexAlpha = true
  mesh.isPickable = false

  const mat = new StandardMaterial('terrainPreviewMat', scene)
  mat.disableLighting = true
  mat.emissiveColor = Color3.White()
  mat.backFaceCulling = false
  mat.zOffset = -2
  mesh.material = mat
}
