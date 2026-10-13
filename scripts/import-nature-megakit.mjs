// WHAT THIS FILE DOES
// Imports the Quaternius "Stylized Nature MegaKit" (Standard, CC0): converts each glTF to one
// self-contained .glb in src/assets/models as Nature_<Name>.glb.
// Everything is kept as in the pack: geometry, colours, scale, orientation and the original
// full-size textures (including normal maps). Nothing is shrunk or removed.
// Usage: node scripts/import-nature-megakit.mjs <folder with the glTF files>
import { readdirSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/import-nature-megakit.mjs <glTF folder>')
  process.exit(1)
}
const out = join(import.meta.dirname, '..', 'src', 'assets', 'models')
mkdirSync(out, { recursive: true })
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

const files = readdirSync(src).filter((f) => f.toLowerCase().endsWith('.gltf'))
if (!files.length) {
  console.error(`no .gltf files found in ${src}`)
  process.exit(1)
}
let total = 0
for (const f of files) {
  const doc = await io.read(join(src, f))
  await io.write(join(out, `Nature_${basename(f, '.gltf')}.glb`), doc)
  total++
}
console.log(`imported ${total} nature models -> src/assets/models/Nature_*.glb`)
