Drop files here and they are embedded into the single HTML automatically.

- models/ .glb (best), .gltf, .obj, .babylon
- textures/ .png .jpg .webp
- audio/ .mp3 .ogg .wav
- fonts/ .woff2 (reference from ui.css)
  Prefer .glb: one self-contained file with textures baked in.
  Keep total size in mind: everything ends up inside one HTML file.

Farm Buildings (Quaternius, CC0)
- Originals (OBJ/FBX/Blend) are kept in src/assets/raw/farm-buildings (git-ignored, not embedded).
- scripts/import-farm-buildings.mjs converts them to models/Farm_<Name>.glb (npm run import:farm).
- The building data (ids, footprints, costs, model names) is sim/farmBuildings.ts.

Stylized Nature MegaKit Standard (Quaternius, CC0)
- Originals are kept in src/assets/raw/nature-megakit (git-ignored, not embedded).
- scripts/import-nature-megakit.mjs converts them to models/Nature_<Name>.glb (npm run import:nature).
- Textures are kept at full size (no shrinking, normal maps kept).
- The old Hilly/Beach/Cliff/Shared nature props were moved to src/assets/raw/replaced-nature.

Colony Characters (Quaternius Universal Base Characters + Colony Animation Library, CC0)
- models/Colonist_Male.glb and Colonist_Female.glb: 65-bone humanoid rig with 26 animations baked in.
- Original zip contents are kept in src/assets/raw/colony-characters (git-ignored, not embedded).
- Code: render/colonistView.ts (spawnColonist, COLONIST_ANIMS).
