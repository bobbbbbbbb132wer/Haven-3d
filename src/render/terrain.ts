// WHAT THIS FILE DOES
// Draws the terrain as flat-shaded low-poly chunks (colours from slope and height, no textures),
// the river's water surface, and the pack's Mountain models crowning the highest ridges.
// Chunks are built once; a terrain edit only rebuilds the chunks it touched.
import type { Scene } from '@babylonjs/core/scene'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Terrain } from '../sim/terrain'
import type { EditBounds } from '../sim/terrainEdit'
import { CHUNK, chunkCells, chunksPerSide, fillChunk } from './chunkData'
import { buildWater } from './waterData'
import { createWaterMaterial, WATER_FLOW_KIND } from './waterMaterial'
import { loadModel } from './assetLoader'

const chunks = new Map<string, Mesh>()

/** After the terrain heights change, rebuild only the chunks that touch the changed corners. */
export function syncTerrainMesh(_scene: Scene, t: Terrain, b: EditBounds) {
  const last = chunksPerSide(t) - 1
  const c0 = Math.max(0, Math.floor((b.i0 - 1) / CHUNK))
  const c1 = Math.min(last, Math.floor(b.i1 / CHUNK))
  const r0 = Math.max(0, Math.floor((b.j0 - 1) / CHUNK))
  const r1 = Math.min(last, Math.floor(b.j1 / CHUNK))
  for (let cj = r0; cj <= r1; cj++) {
    for (let ci = c0; ci <= c1; ci++) {
      const mesh = chunks.get(`${ci}_${cj}`)
      if (!mesh) continue
      const { nx, nz } = chunkCells(t, ci, cj)
      const n = nx * nz * 6 * 3
      const pos = new Float32Array(n)
      const nor = new Float32Array(n)
      const col = new Float32Array(nx * nz * 6 * 4)
      fillChunk(t, ci, cj, pos, nor, col)
      mesh.updateVerticesData(VertexBuffer.PositionKind, pos)
      mesh.updateVerticesData(VertexBuffer.NormalKind, nor)
      mesh.updateVerticesData(VertexBuffer.ColorKind, col)
      mesh.refreshBoundingInfo()
    }
  }
}

/** One continuous low-poly water surface that fills the lowered river channel, with gentle waves. */
function createWater(scene: Scene, t: Terrain) {
  const w = buildWater(t)
  if (!w) return
  const mesh = new Mesh('water', scene)
  const vd = new VertexData()
  vd.positions = w.pos
  vd.normals = w.nor
  vd.colors = w.col
  vd.indices = Uint32Array.from({ length: w.pos.length / 3 }, (_, i) => i) // un-shared = flat shading
  vd.applyToMesh(mesh)
  mesh.setVerticesData(WATER_FLOW_KIND, w.flow, false, 2)
  mesh.hasVertexAlpha = true // clearer in the shallows, so the riverbed shows through
  mesh.material = createWaterMaterial(scene)
  mesh.isPickable = false
  // not frozen: the vertex shader animates position every frame
}

/** The pack's Mountain models, cloned onto the ridge crowns chosen by the world generator. */
async function spawnPeaks(scene: Scene, t: Terrain) {
  const peaks = t.peaks ?? []
  const sources = new Map<string, Mesh | TransformNode | null>()
  for (let n = 0; n < peaks.length; n++) {
    const p = peaks[n]
    try {
      if (!sources.has(p.id)) {
        const { meshes } = await loadModel(scene, p.id)
        meshes[0].setEnabled(false) // the original stays hidden, the copies are what you see
        sources.set(p.id, meshes[0] as unknown as TransformNode)
      }
      const src = sources.get(p.id) as TransformNode
      const holder = new TransformNode(`peak_${n}`, scene)
      holder.position.set(p.x, p.y, p.z)
      holder.rotation.y = p.yaw
      holder.scaling.setAll(p.scale)
      const copy = src.clone(`peakModel_${n}`, holder)
      if (copy) {
        copy.setEnabled(true)
        for (const m of copy.getChildMeshes()) m.isPickable = false
      }
    } catch (err) {
      console.warn(`mountain ${p.id} skipped:`, err)
    }
  }
}

export function createTerrainMesh(scene: Scene, t: Terrain) {
  chunks.clear()
  const mat = new StandardMaterial('terrainMat', scene)
  mat.specularColor = Color3.Black()
  mat.freeze()
  const side = chunksPerSide(t)
  const fullIndices = Uint32Array.from({ length: CHUNK * CHUNK * 6 }, (_, i) => i) // un-shared = flat shading

  for (let cj = 0; cj < side; cj++) {
    for (let ci = 0; ci < side; ci++) {
      const { nx, nz } = chunkCells(t, ci, cj)
      const verts = nx * nz * 6
      const pos = new Float32Array(verts * 3)
      const nor = new Float32Array(verts * 3)
      const col = new Float32Array(verts * 4)
      fillChunk(t, ci, cj, pos, nor, col)
      const mesh = new Mesh(`terrain_${ci}_${cj}`, scene)
      const vd = new VertexData()
      vd.positions = pos
      vd.normals = nor
      vd.colors = col
      vd.indices = fullIndices.subarray(0, verts)
      vd.applyToMesh(mesh, true) // updatable: terraforming rewrites it
      mesh.material = mat
      mesh.isPickable = false // placement uses its own ground ray (sim/terrain.ts)
      mesh.freezeWorldMatrix()
      chunks.set(`${ci}_${cj}`, mesh)
    }
  }
  createWater(scene, t)
  void spawnPeaks(scene, t)

  // a sun from the side makes hills readable; turn the all-over light down a little to match
  const sun = new DirectionalLight('terrainSun', new Vector3(-0.5, -1, -0.4), scene)
  sun.intensity = 0.55
  for (const l of scene.lights) if (l.getClassName() === 'HemisphericLight') l.intensity = 0.65
}
