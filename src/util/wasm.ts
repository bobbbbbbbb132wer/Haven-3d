// WHAT THIS FILE DOES
// A small helper so the physics engine works in an offline file.

// Helper: decode a base64 data URL into an ArrayBuffer for wasmBinary
export function dataUrlToBuffer(url: string): ArrayBuffer {
  const bin = atob(url.split(',')[1])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}
