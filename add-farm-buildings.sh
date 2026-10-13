set -e
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"   # run from the project root (where package.json is)
[ -f package.json ] || { echo "run this from the project root"; exit 1; }

# 1) unzip the pack into the git-ignored raw folder (originals kept, not embedded in the game)
ZIP=$(ls Farm*Buildings*Quaternius*.zip 2>/dev/null | head -n1)
[ -n "$ZIP" ] || { echo "put the Farm Buildings zip in the project root first"; exit 1; }
mkdir -p src/assets/raw/farm-buildings scripts
unzip -q -o "$ZIP" -d src/assets/raw/farm-buildings
OBJDIR=$(find src/assets/raw/farm-buildings -type d -name OBJ | head -n1)

# 2) new files
cat > src/sim/farmBuildings.ts <<'EOF_FILE'
// WHAT THIS FILE DOES
// The Farm Buildings pack (Quaternius, CC0) as plain data: which building ids exist, what model
// each one uses, its footprint in tiles and its cost. Pure data, no 3D in here.
// The models are src/assets/models/Farm_<Name>.glb (made by scripts/import-farm-buildings.mjs).
// The building menu and placement system read this through sim/buildings.ts and
// sim/buildingMeta.ts, so a new farm piece is one line here.
// To add one: add a line below + the .glb in src/assets/models. Nothing else.
import type { BuildingDef } from './buildings'
import type { BuildingMeta } from './buildingMeta'

export interface FarmBuilding {
  def: BuildingDef
  meta: BuildingMeta
  /** Key in src/assets/models (file name without .glb). */
  model: string
}

// Footprints are the model's real size rounded to whole tiles, so scale stays within about
// +-20% of the original. Proportions are never stretched (placement scales uniformly).
export const FARM_BUILDINGS: FarmBuilding[] = [
  {
    model: 'Farm_Barn',
    def: { id: 'barn', name: 'Barn', icon: '🏚️', cost: { wood: 40, stone: 10 }, startsUnlocked: true },
    meta: { category: 'storage', w: 8, d: 8 },
  },
  {
    model: 'Farm_BigBarn',
    def: { id: 'big_barn', name: 'Big Barn', icon: '🏚️', cost: { wood: 50, stone: 20 }, startsUnlocked: true },
    meta: { category: 'storage', w: 8, d: 8 },
  },
  {
    model: 'Farm_SmallBarn',
    def: { id: 'small_barn', name: 'Small Barn', icon: '🏠', cost: { wood: 30, stone: 5 }, startsUnlocked: true },
    meta: { category: 'storage', w: 6, d: 6 },
  },
  {
    model: 'Farm_OpenBarn',
    def: { id: 'open_barn', name: 'Open Barn', icon: '🛖', cost: { wood: 25 }, startsUnlocked: true },
    meta: { category: 'storage', w: 6, d: 6 },
  },
  {
    model: 'Farm_Silo',
    def: { id: 'silo', name: 'Silo', icon: '🌾', cost: { wood: 20, stone: 15 }, startsUnlocked: true },
    meta: { category: 'storage', w: 4, d: 4 },
  },
  {
    model: 'Farm_SiloHouse',
    def: { id: 'silo_house', name: 'Silo House', icon: '🏡', cost: { wood: 35, stone: 20 }, startsUnlocked: true },
    meta: { category: 'housing', w: 5, d: 4 },
  },
  {
    model: 'Farm_ChickenCoop',
    def: { id: 'chicken_coop', name: 'Chicken Coop', icon: '🐔', cost: { wood: 15 }, startsUnlocked: true },
    meta: { category: 'farming', w: 2, d: 2 },
  },
  {
    model: 'Farm_Windmill',
    def: { id: 'windmill', name: 'Windmill', icon: '🌬️', cost: { wood: 40, stone: 15, metal: 5 }, startsUnlocked: true },
    meta: { category: 'production', w: 7, d: 2 },
  },
  {
    model: 'Farm_TowerWindmill',
    def: { id: 'tower_windmill', name: 'Tower Windmill', icon: '🌬️', cost: { wood: 45, stone: 25, metal: 5 }, startsUnlocked: true },
    meta: { category: 'production', w: 8, d: 5 },
  },
  {
    model: 'Farm_WaterTower',
    def: { id: 'water_tower', name: 'Water Tower', icon: '💧', cost: { wood: 20, stone: 20, metal: 5 }, startsUnlocked: true },
    meta: { category: 'farming', w: 3, d: 3 },
  },
  {
    model: 'Farm_Fence',
    def: { id: 'fence', name: 'Fence', icon: '🚧', cost: { wood: 4 }, startsUnlocked: true },
    meta: { category: 'defense', w: 6, d: 1 },
  },
  {
    model: 'Farm_Fence2',
    def: { id: 'fence2', name: 'Fence (Rails)', icon: '🚧', cost: { wood: 4 }, startsUnlocked: true },
    meta: { category: 'defense', w: 6, d: 1 },
  },
]

/**
 * The existing Well building keeps its id, cost and unlock; it only gains the Farm_Well model.
 * 1x1 footprint: the model is about 1.3 m wide.
 */
export const WELL_MODEL = 'Farm_Well'
export const WELL_META: BuildingMeta = { category: 'farming', w: 1, d: 1 }

/** Building id -> model key, for every building that uses a model whose name differs from its id. */
export const MODEL_OF: Record<string, string> = {
  well: WELL_MODEL,
  ...Object.fromEntries(FARM_BUILDINGS.map((f) => [f.def.id, f.model])),
}
EOF_FILE

cat > scripts/import-farm-buildings.mjs <<'EOF_FILE'
// WHAT THIS FILE DOES
// Imports the Quaternius "Farm Buildings" pack: converts each OBJ (+ .mtl colours) to a
// self-contained .glb in src/assets/models as Farm_<Name>.glb.
// The pack is Y-up, about 1 unit = 1 metre, flat-colour materials (no textures), so geometry,
// colours and proportions are kept exactly: no scale or rotation is applied here.
// Usage: node scripts/import-farm-buildings.mjs <folder with the OBJ files>
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import obj2gltf from 'obj2gltf'

const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/import-farm-buildings.mjs <OBJ folder>')
  process.exit(1)
}
const out = join(import.meta.dirname, '..', 'src', 'assets', 'models')
mkdirSync(out, { recursive: true })

const NAMES = {
  Barn: 'Farm_Barn', BigBarn: 'Farm_BigBarn', SmallBarn: 'Farm_SmallBarn', OpenBarn: 'Farm_OpenBarn',
  Silo: 'Farm_Silo', Silo_House: 'Farm_SiloHouse', ChickenCoop: 'Farm_ChickenCoop',
  Windmill: 'Farm_Windmill', TowerWindmill: 'Farm_TowerWindmill', WaterTower: 'Farm_WaterTower',
  Well: 'Farm_Well', Fence: 'Farm_Fence', Fence2: 'Farm_Fence2',
}

const files = readdirSync(src).filter((f) => f.toLowerCase().endsWith('.obj'))
if (!files.length) {
  console.error(`no .obj files found in ${src}`)
  process.exit(1)
}
for (const f of files) {
  const base = basename(f, '.obj')
  const name = NAMES[base]
  if (!name) {
    console.warn(`skipped ${f} (not in the name table)`)
    continue
  }
  const glb = await obj2gltf(join(src, f), { binary: true })
  writeFileSync(join(out, `${name}.glb`), glb)
  console.log(`${f} -> src/assets/models/${name}.glb (${(glb.length / 1024).toFixed(0)} KB)`)
}
EOF_FILE

# 3) patch existing files (safe to run twice)
cat > /tmp/farm_patch.py <<'EOF_PY'
import re, sys, pathlib
root = pathlib.Path(sys.argv[1])
def edit(rel, pairs):
    p = root / rel
    s = p.read_text()
    for old, new in pairs:
        if new in s:
            continue  # already applied
        assert s.count(old) == 1, f"{rel}: expected exactly one match for: {old[:60]!r}"
        s = s.replace(old, new)
    p.write_text(s)

# --- sim/buildings.ts: farm buildings join BUILDINGS
edit('src/sim/buildings.ts', [
 ("import { availableOf } from './resources'\n",
  "import { availableOf } from './resources'\nimport { FARM_BUILDINGS } from './farmBuildings'\n"),
 ("  },\n]\n\nexport function isUnlocked",
  "  },\n  // Farm Buildings pack (Quaternius): data lives in sim/farmBuildings.ts\n  ...FARM_BUILDINGS.map((f) => f.def),\n]\n\nexport function isUnlocked"),
])

# --- sim/buildingMeta.ts: footprints + modelOf()
edit('src/sim/buildingMeta.ts', [
 ("// Pure data, no 3D in here. To categorise a new building, add one line to META.\n",
  "// Pure data, no 3D in here. To categorise a new building, add one line to META.\nimport { FARM_BUILDINGS, MODEL_OF, WELL_META } from './farmBuildings'\n"),
 ("  well: { category: 'farming', w: 2, d: 2 },\n}",
  "  well: WELL_META,\n  ...Object.fromEntries(FARM_BUILDINGS.map((f) => [f.def.id, f.meta])),\n}\n\n/** Key of the model in src/assets/models for a building (defaults to the building id). */\nexport function modelOf(id: string): string {\n  return MODEL_OF[id] ?? id\n}"),
])

# --- render/placement.ts: load the model named by modelOf()
edit('src/render/placement.ts', [
 ("import { buildSeconds, metaOf } from '../sim/buildingMeta'",
  "import { buildSeconds, metaOf, modelOf } from '../sim/buildingMeta'"),
 ("  if (!(id in models)) {\n    const m = metaOf(id)",
  "  const modelKey = modelOf(id)\n  if (!(modelKey in models)) {\n    const m = metaOf(id)"),
 ("await loadModel(scene, id)\n  const root = meshes[0]",
  "await loadModel(scene, modelKey)\n  const root = meshes[0]"),
])

# --- gui/iconDefs.ts: icons for buildings whose model name differs from the id
edit('src/gui/iconDefs.ts', [
 ("import { BUILDINGS as REAL_BUILDINGS } from '../sim/buildings'\n",
  "import { BUILDINGS as REAL_BUILDINGS } from '../sim/buildings'\nimport { modelOf } from '../sim/buildingMeta'\n"),
 ("REAL_BUILDINGS.filter((b) => b.id in models)", "REAL_BUILDINGS.filter((b) => modelOf(b.id) in models)"),
 ("await loadModel(scene, b.id)", "await loadModel(scene, modelOf(b.id))"),
])

# --- render/showroom.ts: farm row with roomy pedestals; replaced props hidden
edit('src/render/showroom.ts', [
 ("// src/assets/models (the campfire plus the whole Modular Terrain Pack) stands",
  "// src/assets/models (the campfire, the Farm Buildings and the Modular Terrain Pack) stands"),
 ("const GROUP_ORDER = [\n  'campfire', 'Hilly_Terrain',",
  "const GROUP_ORDER = [\n  'campfire', 'Farm', 'Hilly_Terrain',"),
 ("const groupOf = (n: string) =>\n  n === 'campfire' ? 'campfire'\n",
  "// Old terrain-pack structures the Farm Buildings replace in the showroom (files stay for later).\nconst REPLACED_BY_FARM = (n: string) => n === 'Hilly_Prop_Camp_Lean_To' || n.startsWith('Hilly_Prop_Fence_')\n\n// Farm buildings are big: they get wider rows and pedestals, still at their real size.\nconst FARM = { cols: 9, spacing: 12, fit: 10, pad: 10 }\n\nconst groupOf = (n: string) =>\n  n === 'campfire' ? 'campfire'\n  : n.startsWith('Farm_') ? 'Farm'\n"),
 ("  const slots: { name: string; x: number; z: number }[] = []\n  let row = 0\n  for (const g of groups) {\n    const list = byGroup.get(g)!.sort((a, b) => a.localeCompare(b))\n    list.forEach((name, i) => {\n      slots.push({\n        name,\n        x: ((i % COLS) - (COLS - 1) / 2) * SPACING,\n        z: FIRST_ROW_Z + (row + Math.floor(i / COLS)) * SPACING,\n      })\n    })\n    row += Math.ceil(list.length / COLS)\n  }\n  return slots",
  "  const slots: { name: string; x: number; z: number; fit: number; pad: number }[] = []\n  let row = 0\n  for (const g of groups) {\n    const list = byGroup.get(g)!.sort((a, b) => a.localeCompare(b))\n    const farm = g === 'Farm'\n    const cols = farm ? FARM.cols : COLS\n    const gap = farm ? FARM.spacing : SPACING\n    const rowStep = gap / SPACING // a farm row is as deep as several normal rows\n    list.forEach((name, i) => {\n      const inRow = Math.min(cols, list.length - Math.floor(i / cols) * cols)\n      slots.push({\n        name,\n        x: ((i % cols) - (inRow - 1) / 2) * gap,\n        z: FIRST_ROW_Z + (row + Math.floor(i / cols) * rowStep) * SPACING,\n        fit: farm ? FARM.fit : MAX_FIT,\n        pad: farm ? FARM.pad : 3.4,\n      })\n    })\n    row += Math.ceil(list.length / cols) * rowStep\n  }\n  return slots"),
 ("  const slots = layout(Object.keys(models))",
  "  const slots = layout(Object.keys(models).filter((n) => !REPLACED_BY_FARM(n)))"),
 ("  let padSource: Mesh | null = null\n",
  "  // one real pedestal (hidden), every pedestal is a cheap instance of it, scaled to its slot\n  const padSource: Mesh = MeshBuilder.CreateCylinder('padSource', { diameter: 1, height: 0.1 }, scene)\n  padSource.material = padMat\n  padSource.isPickable = false\n  padSource.isVisible = false\n"),
 ("const place = async (slot: { name: string; x: number; z: number }) => {",
  "const place = async (slot: { name: string; x: number; z: number; fit: number; pad: number }) => {"),
 ("Math.min(1, MAX_FIT / Math.max(", "Math.min(1, slot.fit / Math.max("),
 ("      // one real pedestal, the rest are cheap instances of it\n      let pad\n      if (!padSource) {\n        padSource = MeshBuilder.CreateCylinder('padSource', { diameter: 3.4, height: 0.1 }, scene)\n        padSource.material = padMat\n        padSource.isPickable = false\n        pad = padSource\n      } else pad = padSource.createInstance(`pad_${slot.name}`)\n      pad.parent = root\n      pad.position.set(slot.x, 0.05, slot.z)\n",
  "      const pad = padSource.createInstance(`pad_${slot.name}`)\n      pad.parent = root\n      pad.position.set(slot.x, 0.05, slot.z)\n      pad.scaling.set(slot.pad, 1, slot.pad)\n"),
])

# --- assets README
p = root / 'src/assets/README.md'
s = p.read_text()
if 'Farm Buildings' not in s:
    s += """
Farm Buildings (Quaternius, CC0)
- Originals (OBJ/FBX/Blend) are kept in src/assets/raw/farm-buildings (git-ignored, not embedded).
- scripts/import-farm-buildings.mjs converts them to models/Farm_<Name>.glb (npm run import:farm).
- The building data (ids, footprints, costs, model names) is sim/farmBuildings.ts.
"""
    p.write_text(s)

# --- package.json script + devDependency note
import json
pj = root / 'package.json'
d = json.loads(pj.read_text())
d.setdefault('scripts', {})['import:farm'] = 'node scripts/import-farm-buildings.mjs src/assets/raw/farm-buildings/OBJ'
pj.write_text(json.dumps(d, indent=2) + '\n')
print('patched')
EOF_PY
python3 /tmp/farm_patch.py .

# 4) converter dependency, convert OBJ -> GLB into src/assets/models, type-check
npm i -D obj2gltf
node scripts/import-farm-buildings.mjs "$OBJDIR"
npm run check
echo "Done. Run: npm run dev  (press U to unlock, G for resources, B to build, X for the showroom)"
