// WHAT THIS FILE DOES
// Automatically finds every model/texture/sound you drop in the assets folders.

// Every file dropped into these folders is auto-imported as a base64 data URL,
// so it gets embedded in the final single HTML (no fetch, works on file://).
// Keys are the file name without extension, e.g. models/colonist.glb -> models.colonist

function byName(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [path, url] of Object.entries(files)) {
    const name = path
      .split('/')
      .pop()!
      .replace(/\.[^.]+$/, '')
    out[name] = url
  }
  return out
}

export const models = byName(
  import.meta.glob('./models/*.{glb,gltf,obj,babylon}', {
    query: '?url',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
)
export const textures = byName(
  import.meta.glob('./textures/*.{png,jpg,jpeg,webp}', {
    query: '?url',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
)
export const audio = byName(
  import.meta.glob('./audio/*.{mp3,ogg,wav}', {
    query: '?url',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
)

// UI icons (e.g. building icons). Used from code: icons.campfire -> data URL
export const icons = byName(
  import.meta.glob('./ui/icons/*.{png,webp,svg}', {
    query: '?url',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
)
