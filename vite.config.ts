import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [viteSingleFile()],
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.obj', '**/*.babylon'],
  build: {
    assetsInlineLimit: 100000000, // inline everything (wasm, models, images) into the one html
    target: 'es2020',
  },
})
