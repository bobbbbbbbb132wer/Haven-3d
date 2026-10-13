// WHAT THIS FILE DOES
// A small, cheap shader for the river surface: it nudges each vertex up and down in a travelling
// sine wave that runs along the local flow direction (so bends and changing widths still look
// continuous), and adds a soft, moving specular sparkle. Everything else (colour, transparency,
// flat shading) comes from the vertex data built in waterData.ts, same as before. Scaled for a
// river/stream, not an ocean: a few centimetres of bob, nothing that would clash with the low-poly
// art style. Lighting direction/colour are kept in step with the day/night cycle (daylight.ts).
import type { Scene } from '@babylonjs/core/scene'
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial'
import { Effect } from '@babylonjs/core/Materials/effect'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'

export const WATER_FLOW_KIND = 'flow'

const VERTEX_SHADER = `
  precision highp float;
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec4 color;
  attribute vec2 flow;

  uniform mat4 world;
  uniform mat4 worldViewProjection;
  uniform float time;

  varying vec4 vColor;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  void main() {
    // two overlapping sine ripples travelling downstream, so the surface never looks perfectly
    // periodic; amplitude is tiny (river scale, not ocean swell)
    float phase = dot(position.xz, flow) * 0.9 - time * 1.6;
    float ripple = sin(phase) * 0.05 + sin(phase * 2.3 + 1.7) * 0.02;
    vec3 displaced = position + vec3(0.0, ripple, 0.0);

    vColor = color;
    vNormalW = normalize((world * vec4(normal, 0.0)).xyz);
    vPositionW = (world * vec4(displaced, 1.0)).xyz;
    gl_Position = worldViewProjection * vec4(displaced, 1.0);
  }
`

const FRAGMENT_SHADER = `
  precision highp float;
  varying vec4 vColor;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  uniform vec3 cameraPosition;
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  uniform float ambient;
  uniform float time;

  void main() {
    vec3 n = normalize(vNormalW);
    float lambert = max(dot(n, -sunDirection), 0.0);
    vec3 lit = vColor.rgb * (ambient + lambert * sunColor);

    // a soft, slowly-shifting highlight standing in for a reflection, cheap enough for every pixel
    vec3 viewDir = normalize(cameraPosition - vPositionW);
    vec3 halfDir = normalize(viewDir - sunDirection);
    float spec = pow(max(dot(n, halfDir), 0.0), 40.0);
    float shimmer = 0.6 + 0.4 * sin(vPositionW.x * 1.3 + vPositionW.z * 1.1 + time * 1.4);
    lit += sunColor * spec * 0.55 * shimmer;

    gl_FragColor = vec4(lit, vColor.a);
  }
`

let registered = false
function registerShaders() {
  if (registered) return
  registered = true
  Effect.ShadersStore['haven_waterVertexShader'] = VERTEX_SHADER
  Effect.ShadersStore['haven_waterFragmentShader'] = FRAGMENT_SHADER
}

/** Builds the water's animated material and starts its per-frame time/lighting updates. */
export function createWaterMaterial(scene: Scene): ShaderMaterial {
  registerShaders()
  const mat = new ShaderMaterial(
    'waterMat',
    scene,
    { vertex: 'haven_water', fragment: 'haven_water' },
    {
      attributes: ['position', 'normal', 'color', WATER_FLOW_KIND],
      uniforms: ['world', 'worldViewProjection', 'cameraPosition', 'time', 'sunDirection', 'sunColor', 'ambient'],
      needAlphaBlending: true,
    },
  )
  mat.backFaceCulling = false
  mat.setFloat('time', 0)
  mat.setFloat('ambient', 0.45)
  mat.setVector3('sunDirection', new Vector3(-0.5, -1, -0.4))
  mat.setColor3('sunColor', new Color3(1, 1, 1))

  let t = 0
  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000
    t += Math.min(dt, 0.1) // guards against a huge jump after a tab was backgrounded
    mat.setFloat('time', t)
    // follow the same sun the terrain uses, so water lighting stays consistent through the day
    const sun = scene.getLightByName('terrainSun') as DirectionalLight | null
    if (sun) {
      mat.setVector3('sunDirection', sun.direction)
      mat.setColor3('sunColor', sun.diffuse)
      const ambient = scene.getLightByName('sun')
      mat.setFloat('ambient', 0.3 + (ambient ? ambient.intensity * 0.4 : 0.15))
    }
  })
  return mat
}
