// WHAT THIS FILE DOES
// Builds the terrain test chunk from sim/terrainSample.ts as stylised flat-shaded low-poly meshes
// (4 quadrant meshes so off-screen parts are skipped), a display skirt, and a flat river ribbon.
// Built ONCE; every mesh and material is frozen so there is no per-frame cost.
import type { Scene } from '@babylonjs/core/scene'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle'
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock'
import { generateSample, SAMPLE, type Sample } from '../sim/terrainSample'
import { faceColor } from './terrainSampleColors'

function finish(mesh: Mesh, positions: number[], normals: number[], colors: number[]) {
  const vd = new VertexData()
  vd.positions = positions
  vd.normals = normals
  vd.colors = colors
  vd.indices = Uint32Array.from({ length: positions.length / 3 }, (_, i) => i) // un-shared = flat shading
  vd.applyToMesh(mesh)
  mesh.isPickable = false
  mesh.freezeWorldMatrix()
  mesh.doNotSyncBoundingInfo = true
}

/** Flat-shaded terrain for the cells [i0,i1) x [j0,j1). */
function buildTerrainPart(scene: Scene, s: Sample, mat: StandardMaterial, name: string, i0: number, i1: number, j0: number, j1: number) {
  const S = s.n + 1
  const H = s.n / 2
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const hAt = (i: number, j: number) => s.heights[j * S + i]

  const tri = (ai: number, aj: number, bi: number, bj: number, ci: number, cj: number) => {
    const ax = ai - H, ay = hAt(ai, aj), az = aj - H
    const bx = bi - H, by = hAt(bi, bj), bz = bj - H
    const cx = ci - H, cy = hAt(ci, cj), cz = cj - H
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay)
    let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az)
    let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len; ny /= len; nz /= len
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz } // ground faces always point up
    const ka = aj * S + ai, kb = bj * S + bi, kc = cj * S + ci
    const jitter = (((ai * 73856093) ^ (aj * 19349663) ^ (ci * 83492791) ^ (cj * 2654435)) & 255) / 127.5 - 1
    const c = faceColor(
      (ay + by + cy) / 3,
      1 - ny,
      (s.tint[ka] + s.tint[kb] + s.tint[kc]) / 3,
      (s.bank[ka] + s.bank[kb] + s.bank[kc]) / 3,
      jitter,
    )
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz)
    for (let q = 0; q < 3; q++) {
      nor.push(nx, ny, nz)
      col.push(c[0], c[1], c[2], 1)
    }
  }

  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      // a=(i,j) b=(i+1,j) c=(i,j+1) d=(i+1,j+1); alternate the diagonal so it never looks combed
      if ((i + j) & 1) {
        tri(i, j, i + 1, j, i + 1, j + 1)
        tri(i, j, i + 1, j + 1, i, j + 1)
      } else {
        tri(i, j, i + 1, j, i, j + 1)
        tri(i + 1, j, i + 1, j + 1, i, j + 1)
      }
    }
  }
  const mesh = new Mesh(name, scene)
  finish(mesh, pos, nor, col)
  mesh.material = mat
  return mesh
}

/** Outer walls + bottom so the chunk looks like a display block. */
function buildSkirt(scene: Scene, s: Sample, mat: StandardMaterial) {
  const S = s.n + 1
  const H = s.n / 2
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const TOP: [number, number, number, number] = [0.45, 0.34, 0.23, 1]
  const BOT: [number, number, number, number] = [0.22, 0.17, 0.13, 1]
  const y0 = SAMPLE.skirtY
  const quad = (x1: number, z1: number, h1: number, x2: number, z2: number, h2: number, nx: number, nz: number) => {
    // two triangles: top1, top2, bottom2 / top1, bottom2, bottom1
    const v = [
      [x1, h1, z1, TOP], [x2, h2, z2, TOP], [x2, y0, z2, BOT],
      [x1, h1, z1, TOP], [x2, y0, z2, BOT], [x1, y0, z1, BOT],
    ] as const
    for (const [x, y, z, c] of v) {
      pos.push(x, y, z)
      nor.push(nx, 0, nz)
      col.push(c[0], c[1], c[2], c[3])
    }
  }
  const hAt = (i: number, j: number) => s.heights[j * S + i]
  for (let q = 0; q < s.n; q++) {
    quad(q - H, -H, hAt(q, 0), q + 1 - H, -H, hAt(q + 1, 0), 0, -1) // north
    quad(q - H, H, hAt(q, s.n), q + 1 - H, H, hAt(q + 1, s.n), 0, 1) // south
    quad(-H, q - H, hAt(0, q), -H, q + 1 - H, hAt(0, q + 1), -1, 0) // west
    quad(H, q - H, hAt(s.n, q), H, q + 1 - H, hAt(s.n, q + 1), 1, 0) // east
  }
  // bottom plate
  const b = [[-H, -H], [H, -H], [H, H], [-H, -H], [H, H], [-H, H]]
  for (const [x, z] of b) {
    pos.push(x, y0, z)
    nor.push(0, -1, 0)
    col.push(BOT[0], BOT[1], BOT[2], 1)
  }
  const mesh = new Mesh('terrainSampleSkirt', scene)
  finish(mesh, pos, nor, col)
  mesh.material = mat
  return mesh
}

/** Flat translucent ribbon that follows the river. */
function buildWater(scene: Scene, s: Sample, mat: StandardMaterial) {
  const r = s.river
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
    tx /= len; tz /= len
    const px = -tz, pz = tx // sideways
    pos.push(r.x[k] + px * r.half[k], r.y[k], r.z[k] + pz * r.half[k])
    pos.push(r.x[k] - px * r.half[k], r.y[k], r.z[k] - pz * r.half[k])
    nor.push(0, 1, 0, 0, 1, 0)
    if (k < n - 1) {
      const i = k * 2
      idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2)
    }
  }
  const mesh = new Mesh('terrainSampleWater', scene)
  const vd = new VertexData()
  vd.positions = pos
  vd.normals = nor
  vd.indices = idx
  vd.applyToMesh(mesh)
  mesh.material = mat
  mesh.isPickable = false
  mesh.freezeWorldMatrix()
  return mesh
}

export function spawnTerrainSample(scene: Scene) {
  const s = generateSample()
  console.log(
    `terrain sample: ${s.stats.ms.toFixed(0)} ms, height ${s.stats.min.toFixed(1)} to ${s.stats.max.toFixed(1)} m`,
  )

  const root = new TransformNode('terrainSample', scene)
  root.position.set(SAMPLE.cx, 0, SAMPLE.cz)

  const land = new StandardMaterial('terrainSampleMat', scene)
  land.specularColor = Color3.Black()
  land.freeze()
  const skirtMat = new StandardMaterial('terrainSampleSkirtMat', scene)
  skirtMat.specularColor = Color3.Black()
  skirtMat.backFaceCulling = false
  skirtMat.freeze()
  const waterMat = new StandardMaterial('terrainSampleWaterMat', scene)
  waterMat.diffuseColor = new Color3(0.2, 0.5, 0.78)
  waterMat.emissiveColor = new Color3(0.05, 0.16, 0.26)
  waterMat.specularColor = new Color3(0.5, 0.5, 0.5)
  waterMat.specularPower = 48
  waterMat.alpha = 0.82
  waterMat.backFaceCulling = false
  waterMat.freeze()

  const h = s.n / 2
  const parts = [
    buildTerrainPart(scene, s, land, 'terrainSampleNW', 0, h, 0, h),
    buildTerrainPart(scene, s, land, 'terrainSampleNE', h, s.n, 0, h),
    buildTerrainPart(scene, s, land, 'terrainSampleSW', 0, h, h, s.n),
    buildTerrainPart(scene, s, land, 'terrainSampleSE', h, s.n, h, s.n),
    buildSkirt(scene, s, skirtMat),
    buildWater(scene, s, waterMat),
  ]
  for (const m of parts) m.parent = root

  // name label above the north edge
  const ui = AdvancedDynamicTexture.CreateFullscreenUI('terrainSampleLabel', true, scene)
  const anchor = MeshBuilder.CreateBox('terrainSampleAnchor', { size: 0.1 }, scene)
  anchor.isVisible = false
  anchor.isPickable = false
  anchor.position.set(SAMPLE.cx, s.stats.max + 4, SAMPLE.cz - h)
  const label = new Rectangle()
  label.width = '260px'
  label.height = '26px'
  label.background = 'rgba(20,24,30,0.8)'
  label.color = '#5b6b7d'
  label.thickness = 1
  label.cornerRadius = 6
  const text = new TextBlock('', 'Terrain sample - press Z to inspect')
  text.color = '#e8edf2'
  text.fontSize = 13
  label.addControl(text)
  ui.addControl(label)
  label.linkWithMesh(anchor)
}
