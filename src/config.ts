// WHAT THIS FILE DOES
// Every setting you might want to change lives here, in plain words.

export const CONFIG = {
  /** Size of the flat test pad (tiles per side). */
  flatSize: 64,

  /** How big one tile is in the 3D world. */
  tileSize: 1,

  /** How many simulation updates happen per second (game logic speed). */
  ticksPerSecond: 20,

  // ---------- Main camera (city-builder style) ----------

  /** How fast WASD slides the camera (world units per second, when zoomed to 20). */
  cameraPanSpeed: 10,

  /** Hold Shift to move this many times faster. */
  cameraFastMultiplier: 2.5,

  /** How fast Q / E rotate the view (degrees per second). */
  cameraRotateSpeed: 90,

  /** Right-mouse-drag orbit sensitivity (degrees per pixel). */
  cameraOrbitSensitivity: 0.25,

  /** Viewing angle looking down. 90 = straight down, 0 = flat horizon. */
  cameraStartPitch: 55,
  cameraMinPitch: 25,
  cameraMaxPitch: 80,

  /** Distance from the focus point. Smaller = closer. */
  cameraStartZoom: 28,
  cameraMinZoom: 5,
  cameraMaxZoom: 80,

  /** How much one mouse-wheel notch zooms. */
  cameraZoomSpeed: 0.001,

  /** How snappy the camera feels. Higher = snappier, lower = floatier. */
  cameraSmoothing: 12,

  // ---------- Debug free-fly camera (press F to switch) ----------

  /** Free-fly speed. */
  cameraSpeed: 0.6,

  /** Free-fly mouse look sensitivity. */
  cameraLookSensitivity: 0.002,

  /** Colonist walking speed in tiles per second. */
  colonistSpeed: 2,
}

/** Campfire look. Tweak these to change the fire. */
export const FIRE = {
  lightColor: [1, 0.55, 0.2],
  lightIntensity: 2,
  lightRange: 8,
  /** 0 = steady glow, 1 = wild flicker. */
  lightFlicker: 0.25,
  /** How much the flames stretch and shrink. */
  flameWobble: 0.12,
  /** 1 = normal speed, 2 = twice as fast. */
  flameSpeed: 1,
  embersPerSecond: 18,
  smokePerSecond: 6,
}
