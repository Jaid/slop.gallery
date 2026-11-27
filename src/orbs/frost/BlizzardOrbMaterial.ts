import type {FillLayer, OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, smoothstep, time, vec2, vec3} from 'three/tsl'

import {snowColors, snowflakeShape} from '#src/lib/materials/snowflake.ts'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {coverage, planeDepth, rgb, spinAroundY} from '../lib/fill.ts'
import {orbFractalNoise, orbNoise} from '../lib/noise.ts'

const steps = 40
/** how tall the snow that settled at the bottom stands, in radii of the orb */
const settledTop = -0.62
/** the radius of the frozen flake turning in the middle, in radii of the orb */
const flakeRadius = 0.5
const stormColor = color(hsl.integer(232, 62, 58))
const deepColor = color(hsl.integer(252, 66, 13))
const brightColor = rgb(snowColors.bright)
const glowColor = rgb(snowColors.glow)
const shadowColor = rgb(snowColors.shadow)
/** a curtain of aurora far behind the storm */
const auroraColor = color(hsl.integer(163, 88, 62))
/** One face of the frozen flake in the middle: a perfect stellar snowflake in the upright plane that `turn` radians around the orb’s axis turns it into, glowing pale blue, its heart and the ridges of its arms brightest; the crossed faces take the light in `shade` shares, so they stand apart as it turns. */
function flakeFace(origin: Node<'vec3'>, direction: Node<'vec3'>, turn: number, shade: number): FillLayer {
  const along = vec3(Math.cos(turn), 0, Math.sin(turn))
  const normal = vec3(-Math.sin(turn), 0, Math.cos(turn))
  const spin = time.mul(0.22)
  const right = spinAroundY(along, spin)
  const facing = spinAroundY(normal, spin)
  const depth = planeDepth(origin, direction, vec3(0, 0, 0), facing)
  const offset = origin.add(direction.mul(depth))
  const point = vec2(offset.dot(right), offset.y).div(flakeRadius)
  const inside = snowflakeShape(point)
  const ridge = inside.mul(9).clamp()
  const outside = inside.negate().max(0)
  // A face seen edge-on all but vanishes, like a real ice plate, instead of painting its arm across the flake behind it.
  const foreshortened = facing.dot(direction).abs().pow(0.55)
  return {
    color: mix(shadowColor.mul(2.2), brightColor.mul(2.6), ridge).add(glowColor.mul(ridge.mul(0.5))).mul(shade),
    coverage: coverage(inside).mul(0.94).mul(foreshortened),
    depth,
    glow: glowColor.mul(outside.mul(-7).exp()).mul(0.5).mul(foreshortened),
  }
}

/** A blizzard sealed in glass like a snow globe’s: a vortex of wind-whipped snow whirls around a great frozen snowflake of three crossed faces, slowly turning as it glows, gusts thicken and thin the storm, fine flakes streak through it, what falls settles into a sparkling drift at the bottom and a curtain of aurora shimmers far behind it all. */
export default class BlizzardOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-blizzard',
      tint: hsl.integer(224, 84, 84),
    })
  }

  protected override fill(ray: OrbRay) {
    const {origin, direction} = ray
    // Three faces of one flake, crossed like a tin star, so it holds up from every side.
    const layers = [0, 1, 2].map(face => flakeFace(origin, direction, face * Math.PI / 3, [1, 0.82, 0.66][face]))
    // The storm comes in gusts: a slow swell that thickens it and speeds its turning.
    const gust = mx_noise_float(vec3(time.mul(0.21), 3.7, 8.1)).mul(0.5).add(0.5).smoothstep(0.15, 0.85).toVar('blizzardGust')
    const fill = this.march(ray, steps, point => {
      const distance = point.length()
      // The wind whirls the snow around the middle, faster the nearer it is and rising as it turns, while snow streaks down through it.
      const whirl = time.mul(0.95).add(gust.mul(0.8)).add(distance.oneMinus().mul(2.4)).add(point.y.mul(1.5))
      const swirling = spinAroundY(point, whirl).mul(vec3(1.7, 2.7, 1.7)).add(vec3(0, time.mul(-0.55), 0))
      const warped = swirling.add(orbNoise(swirling.mul(0.7).add(vec3(0, 0, time.mul(0.07)))).xyz.mul(0.7))
      const cloud = orbFractalNoise(warped.mul(1.25), 3, 2.05, 0.55)
      // Fine flakes drifting in the wind and single grains among them, each no more than a brightening of the snow it rides on.
      const flakes = orbNoise(swirling.mul(4.6).add(5.3)).z.smoothstep(0.42, 0.78)
      const grains = orbNoise(swirling.mul(9.2).add(11.1)).w.smoothstep(0.52, 0.85)
      const storm = cloud.smoothstep(-0.08, 0.5).add(flakes.mul(0.55)).add(grains.mul(0.65))
      // The vortex stands denser around its axis, a white column round the flake.
      const column = smoothstep(0.62, 0.18, point.xz.length()).mul(0.35)
      const wall = smoothstep(1, 0.87, distance)
      // What has fallen settles at the bottom, its top drifted uneven, sparkling where its crystals catch the light.
      const drifted = float(settledTop).add(orbNoise(vec3(point.x, 0, point.z).mul(2.3)).x.mul(0.08))
      const settled = smoothstep(drifted.add(0.035), drifted.sub(0.05), point.y)
      const sparkle = orbNoise(point.mul(26)).y.smoothstep(0.62, 0.9).pow(2)
      // The flake lights the storm from the middle; the top of the globe takes the room’s light besides.
      const coreLight = float(0.05).div(distance.pow2().add(0.04))
      const lit = mix(deepColor, stormColor, coreLight.smoothstep(0.1, 1.1)).mul(coreLight.mul(1.15).add(0.16)).add(brightColor.mul(flakes.mul(0.35).add(grains.mul(0.85))))
      const snow = brightColor.mul(point.y.sub(settledTop).mul(0.6).add(0.84)).add(vec3(sparkle.mul(2.4)))
      return {
        absorption: float(0.3),
        color: mix(lit, snow, settled),
        density: storm.add(column).mul(gust.mul(0.9).add(1.15)).mul(1.7).mul(wall).add(settled.mul(16)),
        // Snow right around the flake catches its glow and carries it outward, and single grains glint through the storm.
        emission: glowColor.mul(float(0.006).div(distance.sub(flakeRadius).abs().pow2().add(0.01))).mul(storm.add(0.25)).add(brightColor.mul(grains.mul(0.09))),
      }
    }, layers)
    // Behind the storm, deep polar night, lit from the middle and crossed by a slow aurora.
    const miss = origin.add(direction.mul(origin.dot(direction).negate())).length()
    const curtain = origin.y.sub(0.28).sub(origin.x.mul(3.1).add(time.mul(0.24)).sin().mul(0.16))
    const aurora = curtain.abs().mul(-5).exp().mul(origin.x.mul(13).sub(time.mul(0.8)).sin().mul(0.25).add(0.75))
    const sky = mix(glowColor.mul(1.5), deepColor, miss.smoothstep(0.15, 0.95)).add(auroraColor.mul(aurora.mul(0.4)))
    return {
      radiance: fill.radiance.add(sky.mul(fill.transmittance)),
      transmittance: fill.transmittance.mul(0.28),
    }
  }
}
