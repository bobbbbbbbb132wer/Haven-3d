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
