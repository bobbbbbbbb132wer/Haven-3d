// WHAT THIS FILE DOES
// Turns the terrain heights into a 3D ground mesh. Colours come from the height and steepness
// (grass, dirt, rock, snow), so there are no texture files and it works offline.
import type { Scene } from '@babylonjs/core/scene'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { smoothstep } from '../sim/noise'
import type { Terrain } from '../sim/terrain'
import type { EditBounds } from '../sim/terrainEdit'

const GRASS = [0.34, 0.6, 0.27]
const DIRT = [0.45, 0.37, 0.25]
const ROCK = [0.52, 0.52, 0.55]
const SNOW = [0.93, 0.94, 0.97]

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t)

// Colour of one ground corner: grass, dirt, rock or snow by height and steepness.
function cornerColor(t: Terrain, i: number, j: number): number[] {
  const size = t.size
  const s = size + 1
  const h = t.heights[j * s + i]
  // steepness from the neighbouring corners
  const hx = t.heights[j * s + Math.min(i + 1, size)] - t.heights[j * s + Math.max(i - 1, 0)]
  const hz = t.heights[Math.min(j + 1, size) * s + i] - t.heights[Math.max(j - 1, 0) * s + i]
  const slope = Math.hypot(hx, hz) / 2

  // a little per-corner variation so the grass isn't one flat colour
  const wobble = 0.93 + (0.14 * (((i * 73856093) ^ (j * 19349663)) % 100)) / 100
  let c = mix(GRASS, DIRT, 1 - smoothstep(-4.5, -1, h))
  c = mix(c, ROCK, Math.max(smoothstep(0.45, 0.8, slope), smoothstep(13, 17, h)))
  c = mix(c, SNOW, smoothstep(20, 23, h))
  return [c[0] * wobble, c[1] * wobble, c[2] * wobble]
}

/**
 * After the terrain heights change, update the 3D ground to match: positions, colours and
 * normals, so lighting and slope colours stay correct. Bounds are corner indices.
 */
export function syncTerrainMesh(scene: Scene, t: Terrain, b: EditBounds) {
  const mesh = scene.getMeshByName('terrain') as Mesh | null
  if (!mesh) return
  const size = t.size
  const s = size + 1
  const half = size / 2
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind)
  const colors = mesh.getVerticesData(VertexBuffer.ColorKind)
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind)
  const indices = mesh.getIndices()
  if (!positions || !colors || !normals || !indices) return

  // colours depend on the neighbours too, so refresh one corner further out
  for (let j = Math.max(0, b.j0 - 1); j <= Math.min(size, b.j1 + 1); j++) {
    for (let i = Math.max(0, b.i0 - 1); i <= Math.min(size, b.i1 + 1); i++) {
      const k = j * s + i
      positions[k * 3] = i - half
      positions[k * 3 + 1] = t.heights[k]
      positions[k * 3 + 2] = j - half
      const c = cornerColor(t, i, j)
      colors[k * 4] = c[0]
      colors[k * 4 + 1] = c[1]
      colors[k * 4 + 2] = c[2]
    }
  }
  VertexData.ComputeNormals(positions, indices, normals)
  mesh.updateVerticesData(VertexBuffer.PositionKind, positions)
  mesh.updateVerticesData(VertexBuffer.ColorKind, colors)
  mesh.updateVerticesData(VertexBuffer.NormalKind, normals)
  mesh.refreshBoundingInfo()
}

export function createTerrainMesh(scene: Scene, t: Terrain): Mesh {
  const size = t.size
  const s = size + 1
  const half = size / 2
  const positions = new Float32Array(s * s * 3)
  const colors = new Float32Array(s * s * 4)

  for (let j = 0; j < s; j++) {
    for (let i = 0; i < s; i++) {
      const k = j * s + i
      const h = t.heights[k]
      positions[k * 3] = i - half
      positions[k * 3 + 1] = h
      positions[k * 3 + 2] = j - half

      const c = cornerColor(t, i, j)
      colors[k * 4] = c[0]
      colors[k * 4 + 1] = c[1]
      colors[k * 4 + 2] = c[2]
      colors[k * 4 + 3] = 1
    }
  }

  const indices = new Uint32Array(size * size * 6)
  let n = 0
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const a = j * s + i
      const b = a + 1
      const c = a + s
      const d = c + 1
      indices[n++] = a
      indices[n++] = b
      indices[n++] = c
      indices[n++] = b
      indices[n++] = d
      indices[n++] = c
    }
  }

  const normals = new Float32Array(positions.length)
  VertexData.ComputeNormals(positions, indices, normals)

  const mesh = new Mesh('terrain', scene)
  const data = new VertexData()
  data.positions = positions
  data.indices = indices
  data.normals = normals
  data.colors = colors
  data.applyToMesh(mesh)

  const mat = new StandardMaterial('terrainMat', scene)
  mat.specularColor = Color3.Black()
  mesh.material = mat
  mesh.isPickable = false // placement uses its own ground ray (sim/terrain.ts)

  // a sun from the side makes hills readable; turn the all-over light down a little to match
  const sun = new DirectionalLight('terrainSun', new Vector3(-0.5, -1, -0.4), scene)
  sun.intensity = 0.55
  for (const l of scene.lights) if (l.getClassName() === 'HemisphericLight') l.intensity = 0.65

  return mesh
}
