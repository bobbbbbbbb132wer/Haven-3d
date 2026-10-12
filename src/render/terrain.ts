// WHAT THIS FILE DOES
// Draws the terrain as flat-shaded low-poly chunks (colours from slope and height, no textures),
// plus the river water. Chunks are built once; a terrain edit only rebuilds the chunks it touched.
import type { Scene } from '@babylonjs/core/scene'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Terrain } from '../sim/terrain'
import type { EditBounds } from '../sim/terrainEdit'
import { CHUNK, chunkCells, chunksPerSide, fillChunk } from './chunkData'

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

function createWater(scene: Scene, t: Terrain) {
  const r = t.river
  if (!r) return
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  const n = r.x.length
  for (let k = 0; k < n; k++) {
    const a = Math.max(0, k - 1)
    const b = Math.min(n - 1, k + 1)
    let tx = r.x[b] - r.x[a]
    let tz = r.z[b] - r.z[a]
    const len = Math.hypot(tx, tz) || 1
    tx /= len
    tz /= len
    const px = -tz
    const pz = tx // sideways
    pos.push(r.x[k] + px * r.half[k], r.y[k], r.z[k] + pz * r.half[k])
    pos.push(r.x[k] - px * r.half[k], r.y[k], r.z[k] - pz * r.half[k])
    nor.push(0, 1, 0, 0, 1, 0)
    if (k < n - 1) {
      const i = k * 2
      idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2)
    }
  }
  const mesh = new Mesh('water', scene)
  const vd = new VertexData()
  vd.positions = pos
  vd.normals = nor
  vd.indices = idx
  vd.applyToMesh(mesh)
  const mat = new StandardMaterial('waterMat', scene)
  mat.diffuseColor = new Color3(0.2, 0.5, 0.78)
  mat.emissiveColor = new Color3(0.05, 0.16, 0.26)
  mat.specularColor = new Color3(0.5, 0.5, 0.5)
  mat.specularPower = 48
  mat.alpha = 0.82
  mat.backFaceCulling = false
  mat.freeze()
  mesh.material = mat
  mesh.isPickable = false
  mesh.freezeWorldMatrix()
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

  // a sun from the side makes hills readable; turn the all-over light down a little to match
  const sun = new DirectionalLight('terrainSun', new Vector3(-0.5, -1, -0.4), scene)
  sun.intensity = 0.55
  for (const l of scene.lights) if (l.getClassName() === 'HemisphericLight') l.intensity = 0.65
}
