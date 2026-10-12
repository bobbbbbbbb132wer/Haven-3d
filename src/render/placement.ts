// WHAT THIS FILE DOES
// Placement mode: a ghost model follows the mouse over the ground (green = ok, red = blocked
// or too expensive). Left-click places a construction site that takes a few seconds, then the
// real model appears. Click = place once, Shift+click = keep placing, R rotates,
// Escape or a quick right-click cancels.
import type { Engine } from '@babylonjs/core/Engines/engine'
import type { Scene } from '@babylonjs/core/scene'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import '@babylonjs/core/Rendering/outlineRenderer' // needed for the ghost tint and outline
import '@babylonjs/core/Culling/ray' // needed for createPickingRay (mouse to ground)
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents'
import { models } from '../assets'
import { loadModel } from './assetLoader'
import { addCampfireEffects } from './campfireEffects'
import { BUILDINGS, canAfford } from '../sim/buildings'
import { buildSeconds, metaOf } from '../sim/buildingMeta'
import {
  addSite,
  overlaps,
  progress,
  type Footprint,
  type Site,
} from '../sim/construction'
import type { World } from '../sim/world'
import { footprintHeight, getTerrain, raycastGround } from '../sim/terrain'
import {
  commitChanges,
  FOUNDATION_LABEL,
  FOUNDATION_MODES,
  getTerrainVersion,
  planFoundation,
  type Foundation,
  type FoundationMode,
} from '../sim/terrainEdit'
import { syncTerrainMesh } from './terrain'
import { hideTerrainPreview, showTerrainPreview } from './terrainPreview'
import { createSupports } from './supports'
import { reserve } from '../sim/resources'

interface Model {
  holder: TransformNode
  meshes: AbstractMesh[]
  nodes: TransformNode[]
}

interface Active {
  id: string
  rot: number
  model: Model
  fp: Footprint | null
  valid: boolean | null
  /** How the ground is prepared: level, raised or natural. V cycles it. */
  mode: FoundationMode
  plan: Foundation | null
  planKey: string
}

interface SiteVisual {
  root: TransformNode
  box: Mesh
  fill: Mesh
  /** Wireframe of the real building model, shown while it is being built. */
  wire: Model | null
}

// Loads a building's model, sizes it to its footprint, centres it and sits it on the ground.
async function loadBuildingModel(scene: Scene, id: string, width: number): Promise<Model> {
  const holder = new TransformNode(`b_${id}`, scene)
  if (!(id in models)) {
    const m = metaOf(id)
    const box = MeshBuilder.CreateBox('fallback', { width: m.w, depth: m.d, height: 1 }, scene)
    box.parent = holder
    box.position.y = 0.5
    return { holder, meshes: [box], nodes: [] }
  }
  const { meshes, transformNodes } = await loadModel(scene, id)
  const root = meshes[0]
  root.parent = holder
  const first = root.getHierarchyBoundingVectors(true)
  root.scaling.scaleInPlace(width / (first.max.x - first.min.x))
  root.computeWorldMatrix(true)
  const b = root.getHierarchyBoundingVectors(true)
  root.position.x -= (b.min.x + b.max.x) / 2
  root.position.z -= (b.min.z + b.max.z) / 2
  root.position.y -= b.min.y
  return { holder, meshes, nodes: transformNodes }
}

// Snap to the tile grid: odd sizes centre on a tile, even sizes sit on a grid line.
const snap = (v: number, size: number) => (size % 2 === 0 ? Math.round(v) : Math.floor(v) + 0.5)

// Height of the ground under a footprint, and whether it is flat and free to build on.
function groundY(fp: Footprint) {
  const t = getTerrain()
  return t ? footprintHeight(t, fp) : 0
}
// Height a placed site stands at: the foundation height chosen when it was placed.
const siteY = (s: Site) => s.y ?? groundY(s)

// The wireframe overlay can be switched off with T. The choice is remembered.
const WIRE_PREF = 'colony.ghostWireframe'
function readWirePref() {
  try {
    return localStorage.getItem(WIRE_PREF) !== '0'
  } catch {
    return true // storage not available: default to on
  }
}
function saveWirePref(on: boolean) {
  try {
    localStorage.setItem(WIRE_PREF, on ? '1' : '0')
  } catch {
    // storage not available: the choice just is not remembered
  }
}

export function initPlacement(engine: Engine, scene: Scene, world: World) {
  const con = world.construction
  const visuals = new Map<number, SiteVisual>()
  let active: Active | null = null
  let token = 0
  let menuHover = false
  let lastMode: FoundationMode = 'level' // remembered between buildings
  let ghostSupports: TransformNode | null = null
  let lastNote = ''
  let wireOn = readWirePref()
  let wireMat: StandardMaterial | null = null
  let wireMeshes: AbstractMesh[] = []

  const green = new Color3(0.2, 0.9, 0.3)
  const red = new Color3(0.95, 0.2, 0.2)

  const solid = (hex: string, alpha = 1) => {
    const m = new StandardMaterial('m', scene)
    m.emissiveColor = Color3.FromHexString(hex)
    m.disableLighting = true
    m.backFaceCulling = false
    m.alpha = alpha
    return m
  }

  // Where the mouse points on the ground (y = 0). Returns null if the ray misses it.
  function groundPoint(): Vector3 | null {
    const cam = scene.activeCamera
    if (!cam) return null
    const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, Matrix.Identity(), cam)
    const terrain = getTerrain()
    if (terrain) {
      const o = ray.origin
      const d = ray.direction
      const hit = raycastGround(terrain, o.x, o.y, o.z, d.x, d.y, d.z)
      return hit ? new Vector3(hit.x, hit.y, hit.z) : null
    }
    if (Math.abs(ray.direction.y) < 1e-6) return null
    const t = -ray.origin.y / ray.direction.y
    if (t < 0) return null
    return ray.origin.add(ray.direction.scale(t))
  }

  // Is this one ground tile covered by a building or construction site?
  const tileTaken = (ti: number, tj: number) => {
    const t = getTerrain()
    if (!t) return true
    const half = t.size / 2
    return overlaps(con, { x: ti - half + 0.5, z: tj - half + 0.5, w: 1, d: 1 })
  }

  function planFor(fp: Footprint, mode: FoundationMode): Foundation {
    const t = getTerrain()
    if (!t) return { ok: true, reason: '', mode, y: 0, changes: [], supports: false }
    return planFoundation(t, fp, mode, tileTaken)
  }

  // Tells the hint line what is wrong (or which foundation is active) while placing
  function setNote(text: string) {
    if (text === lastNote) return
    lastNote = text
    window.dispatchEvent(new CustomEvent('placementstatus', { detail: text }))
  }

  // Ghost extras: the terrain-change preview and the support posts
  function clearExtras() {
    if (ghostSupports) {
      ghostSupports.dispose(false, true)
      ghostSupports = null
    }
    hideTerrainPreview()
  }

  function updateExtras(plan: Foundation, fp: Footprint) {
    clearExtras()
    const t = getTerrain()
    if (t && plan.changes.length) showTerrainPreview(scene, t, plan.changes)
    if (plan.supports) ghostSupports = createSupports(scene, fp, plan.y, 0.5)
  }

  function footprintAt(id: string, rot: number, p: Vector3): Footprint {
    const m = metaOf(id)
    const swap = rot % 2 === 1
    const w = swap ? m.d : m.w
    const d = swap ? m.w : m.d
    return { x: snap(p.x, w), z: snap(p.z, d), w, d }
  }

  // Wireframe overlay: a clone of each ghost mesh that shares the same vertex data (no duplicate
  // geometry), parented to the same node so it follows the ghost's position, rotation and scale.
  // It is never pickable, so it cannot touch mouse picking, the ground ray or placement checks.
  function removeWire() {
    for (const m of wireMeshes) m.dispose()
    wireMeshes = []
    wireMat?.dispose()
    wireMat = null
  }

  function addWire() {
    removeWire()
    if (!wireOn || !active) return
    const mat = new StandardMaterial('ghostWire', scene)
    mat.wireframe = true // thin 1px lines along the real triangle edges
    mat.disableLighting = true
    mat.backFaceCulling = false
    mat.alpha = 0.85
    mat.emissiveColor.copyFrom(active.valid === false ? red : green)
    wireMat = mat
    for (const m of active.model.meshes) {
      if (m.getTotalVertices() === 0) continue
      const w = m.clone(`${m.name}_wire`, m.parent, true)
      if (!w) continue
      w.material = mat
      w.visibility = 1
      w.isPickable = false
      w.checkCollisions = false
      w.renderOverlay = false
      w.renderOutline = false
      wireMeshes.push(w)
    }
  }

  function tint(a: Active, ok: boolean) {
    if (a.valid === ok) return
    a.valid = ok
    const c = ok ? green : red
    if (wireMat) wireMat.emissiveColor.copyFrom(c)
    for (const m of a.model.meshes) {
      if (m.getTotalVertices() === 0) continue
      m.renderOverlay = true
      m.overlayColor = c
      m.overlayAlpha = 0.3
      m.renderOutline = true
      m.outlineColor = c
      m.outlineWidth = 0.04
    }
  }

  // Runs every frame while placing: ghost follows the cursor, or hides when there is no ground.
  let warned = false
  function refresh() {
    try {
      refreshInner()
    } catch (err) {
      if (!warned) console.error('placement refresh failed:', err)
      warned = true
    }
  }

  function refreshInner() {
    if (!active) return
    const p = menuHover || document.pointerLockElement ? null : groundPoint()
    if (!p) {
      active.fp = null
      active.valid = null
      active.model.holder.setEnabled(false)
      active.plan = null
      active.planKey = ''
      clearExtras()
      return
    }
    const fp = footprintAt(active.id, active.rot, p)
    active.fp = fp
    active.model.holder.setEnabled(true)
    // Work out the foundation again only when something it depends on changed
    const key = `${fp.x},${fp.z},${fp.w},${fp.d},${active.mode},${getTerrainVersion()},${con.sites.length},${con.built.length}`
    if (key !== active.planKey || !active.plan) {
      active.planKey = key
      active.plan = planFor(fp, active.mode)
      updateExtras(active.plan, fp)
    }
    const plan = active.plan
    active.model.holder.position.set(fp.x, plan.y, fp.z)
    active.model.holder.rotation.y = (active.rot * Math.PI) / 2
    const def = BUILDINGS.find((b) => b.id === active!.id)
    const affordable = !!def && canAfford(world, def)
    const free = !overlaps(con, fp)
    tint(active, affordable && free && plan.ok)
    const why = !affordable
      ? 'Not enough resources'
      : !free
        ? 'Another building is in the way'
        : plan.ok
          ? 'OK'
          : plan.reason
    setNote(`${FOUNDATION_LABEL[active.mode]} (V foundation, T wireframe): ${why}`)
  }

  async function start(id: string) {
    cancel()
    // Placement needs the real cursor: release the mouse if free-fly had it locked
    if (document.pointerLockElement) document.exitPointerLock()
    const mine = ++token
    try {
      const model = await loadBuildingModel(scene, id, metaOf(id).w)
      if (mine !== token) {
        model.holder.dispose()
        return
      }
      for (const m of model.meshes) {
        m.isPickable = false // the ghost never blocks its own placement
        m.visibility = 0.5
      }
      active = { id, rot: 0, model, fp: null, valid: null, mode: lastMode, plan: null, planKey: '' }
      addWire()
      refresh()
    } catch (err) {
      console.error(`could not start placing ${id}:`, err)
    }
  }

  function cancel() {
    token++
    removeWire()
    if (active) {
      active.model.holder.dispose()
      active = null
    }
    clearExtras()
    setNote('')
  }

  function makeSiteVisual(site: Site) {
    const root = new TransformNode(`site_${site.uid}`, scene)
    root.position.set(site.x, siteY(site), site.z)

    const box = MeshBuilder.CreateBox('site', { width: site.w, depth: site.d, height: 1 }, scene)
    box.parent = root
    box.material = solid('#f0a030', 0.45)
    box.isPickable = false

    const bar = new TransformNode('bar', scene)
    bar.parent = root
    bar.position.y = 2.2
    bar.billboardMode = TransformNode.BILLBOARDMODE_ALL

    const bg = MeshBuilder.CreatePlane('barbg', { width: 1.2, height: 0.14 }, scene)
    bg.parent = bar
    bg.position.z = 0.01
    bg.material = solid('#1a1f26')
    bg.isPickable = false

    const fill = MeshBuilder.CreatePlane('barfill', { width: 1.2, height: 0.14 }, scene)
    fill.parent = bar
    fill.position.z = -0.01
    fill.material = solid('#7fe06a')
    fill.isPickable = false

    const visual: SiteVisual = { root, box, fill, wire: null }
    visuals.set(site.uid, visual)
    if (wireOn) void addSiteWire(site, visual)
  }

  // While a building is under construction, trace the real model in amber wireframe (same
  // geometry, position and rotation as the finished building). Not pickable, so it never
  // affects clicks, the ground ray or placement checks. It is removed when construction ends.
  async function addSiteWire(site: Site, v: SiteVisual) {
    try {
      const model = await loadBuildingModel(scene, site.id, metaOf(site.id).w)
      if (visuals.get(site.uid) !== v) {
        model.holder.dispose(false, true) // the building finished while the model was loading
        return
      }
      const mat = new StandardMaterial('siteWire', scene)
      mat.wireframe = true
      mat.disableLighting = true
      mat.backFaceCulling = false
      mat.emissiveColor = Color3.FromHexString('#ffb040')
      for (const m of model.meshes) {
        m.isPickable = false
        m.checkCollisions = false
        if (m.getTotalVertices() > 0) m.material = mat
      }
      model.holder.position.set(site.x, siteY(site), site.z)
      model.holder.rotation.y = (site.rot * Math.PI) / 2
      v.wire = model
    } catch (err) {
      console.error(`could not draw the wireframe for ${site.id}:`, err)
    }
  }

  function disposeSiteVisual(v: SiteVisual | undefined) {
    if (!v) return
    v.wire?.holder.dispose(false, true)
    v.root.dispose()
  }

  function updateSiteVisual(site: Site) {
    const v = visuals.get(site.uid)
    if (!v) return
    const p = Math.min(Math.max(progress(site), 0), 1)
    v.box.scaling.y = 0.2 + 1.2 * p
    v.box.position.y = v.box.scaling.y / 2
    v.fill.scaling.x = Math.max(p, 0.001)
    v.fill.position.x = -0.6 * (1 - p)
  }

  async function spawn(site: Site) {
    try {
      const model = await loadBuildingModel(scene, site.id, metaOf(site.id).w)
      model.holder.position.set(site.x, siteY(site), site.z)
      model.holder.rotation.y = (site.rot * Math.PI) / 2
      if (site.id === 'campfire') {
        addCampfireEffects(
          scene,
          [...model.meshes, ...model.nodes],
          new Vector3(site.x, siteY(site), site.z),
        )
      }
    } catch (err) {
      console.error(`could not finish building ${site.id}:`, err)
    }
  }

  // Places at the ghost's exact position (no recalculation). Returns true if it worked.
  function place(): boolean {
    if (!active || menuHover || !active.fp || !active.valid) return false
    const def = BUILDINGS.find((b) => b.id === active!.id)
    if (!def) return false
    // Check the foundation once more right now, so what gets built is exactly what is valid
    const plan = planFor(active.fp, active.mode)
    if (!plan.ok) return false
    reserve(world, def.cost)
    const t = getTerrain()
    if (t && plan.changes.length) {
      const bounds = commitChanges(t, plan.changes) // real terrain data...
      if (bounds) syncTerrainMesh(scene, t, bounds) // ...then the 3D ground follows
    }
    const site = addSite(con, active.id, active.fp, active.rot, buildSeconds(active.id))
    site.y = plan.y
    site.foundation = plan.mode
    if (plan.supports) createSupports(scene, active.fp, plan.y)
    makeSiteVisual(site)
    active.valid = null // re-check next frame: we may not afford another one now
    return true
  }

  // Mouse: left = place (Shift keeps placing), quick right-click = cancel, wheel = camera only
  let rightDown: { x: number; y: number } | null = null
  scene.onPointerObservable.add((info) => {
    if (!active) return
    const e = info.event as PointerEvent
    if (info.type === PointerEventTypes.POINTERDOWN) {
      if (e.button === 0) {
        if (place() && !e.shiftKey) cancel()
      } else if (e.button === 2) rightDown = { x: e.clientX, y: e.clientY }
    } else if (info.type === PointerEventTypes.POINTERUP && e.button === 2 && rightDown) {
      if (Math.hypot(e.clientX - rightDown.x, e.clientY - rightDown.y) < 5) cancel()
      rightDown = null
    }
  })

  // The menu tells us when the mouse is over it, so the ghost hides and clicks don't place
  window.addEventListener('buildmenuhover', (e) => {
    menuHover = (e as CustomEvent<boolean>).detail
  })

  window.addEventListener('keydown', (e) => {
    if (!active) return
    if (e.key === 'Escape') cancel()
    else if (e.key.toLowerCase() === 'r') {
      active.rot = (active.rot + 1) % 4
      active.valid = null
    } else if (e.key.toLowerCase() === 'v') {
      const next =
        FOUNDATION_MODES[(FOUNDATION_MODES.indexOf(active.mode) + 1) % FOUNDATION_MODES.length]
      active.mode = lastMode = next
      active.planKey = ''
      active.valid = null
    } else if (e.key.toLowerCase() === 't') {
      wireOn = !wireOn
      saveWirePref(wireOn)
      addWire()
    }
  })

  // Every frame: move the ghost, advance construction, update scaffolds, swap in finished buildings
  scene.onBeforeRenderObservable.add(() => {
    refresh()
    for (const s of con.sites) updateSiteVisual(s)
  })

  // The sim (core/loop.ts) advances construction and pays for finished buildings.
  // Here we only swap the scaffold for the real model.
  window.addEventListener('sitefinished', (e) => {
    const s = (e as CustomEvent<Site>).detail
    disposeSiteVisual(visuals.get(s.uid))
    visuals.delete(s.uid)
    void spawn(s)
  })

  return { start, cancel, tileTaken }
}
