import type {Node, UniformNode} from 'three/webgpu'

import hsl from 'okhsl'
import {float, max, mix, mx_fractal_noise_float, normalWorldGeometry, pow, smoothstep, time, uniform, vec2, vec3} from 'three/tsl'
import {Color, Vector3} from 'three/webgpu'

/** The colors and weather of the sky; colors are packed sRGB. */
export type SkyPalette = {
  /** multiplies everything but the sun’s disc */
  brightness: number
  /** share of the sky covered by clouds, 0–1 */
  cloudCover: number
  /** thin cloud edges */
  cloudLit: number
  /** thick cloud cores, seen from below */
  cloudShade: number
  /** added to clouds on the sunward side of the sky */
  cloudWarm: number
  /** the aureole around the sun */
  glow: number
  horizon: number
  /** the disc */
  sun: number
  /** linear radiance of the disc; above the bloom threshold of 1 it flares */
  sunRadiance: number
  /** straight up, and straight down as well */
  zenith: number
}

export type ProceduralSkyOptions = Partial<SkyPalette> & {
  /** unit vector toward the sun */
  sunDirection: Vector
}

type Vector = readonly [number, number, number]

/** Angular radius of the sun’s disc, a little larger than the real 0.27° so it reads at game resolutions. */
const sunRadius = 0.6 * Math.PI / 180
/** Height of the cloud deck in the projection, against which directions are traced; larger is flatter. */
const cloudHeight = 0.35
/** Sine of the elevation within which the gradient rounds off its minimum at the horizon. */
const horizonRounding = 0.015
/** Cloud deck units per second, a slow drift toward the north-east. */
const wind = [0.0016, -0.0011] as const

/** A clear, blue daytime sky. */
export const daytimeSky: SkyPalette = {
  brightness: 0.82,
  cloudCover: 0.42,
  cloudLit: hsl.integer(248, 9, 97),
  cloudShade: hsl.integer(260, 13, 71),
  cloudWarm: hsl.integer(83, 100, 96),
  glow: hsl.integer(87, 100, 95.5),
  horizon: hsl.integer(245, 61, 87),
  sun: hsl.integer(84, 100, 97),
  sunRadiance: 40,
  zenith: hsl.integer(258, 88, 52),
}

const colorKeys = ['cloudLit', 'cloudShade', 'cloudWarm', 'glow', 'horizon', 'sun', 'zenith'] as const

/**
 * A procedural sky with a sun and fair-weather cumulus, by default a clear, blue daytime one.
 *
 * Returns a linear color for a world direction: a zenith that pales toward a hazy horizon and deepens again below it, a soft glow around the
 * sun with a bright disc in it, and drifting clouds traced on a flat deck overhead. The sky has no ground, so it surrounds the world at every height. The clouds are lit from the sun’s side,
 * darker underneath and fade into the haze toward the horizon, where the deck’s projection would get too fine to draw.
 * Everything but the sun stays below the gallery’s bloom threshold of 1. Pass a {@link SkyLook} to change it later.
 */
export default function proceduralSky(options: ProceduralSkyOptions | SkyLook, direction: Node<'vec3'> = normalWorldGeometry.normalize()) {
  const look = options instanceof SkyLook ? options : new SkyLook(options)
  const {colors} = look
  const sun = look.sunDirection
  const up = direction.y
  // The zenith pales to a hazy horizon, mirrored below it. The height is rounded off within a degree of the horizon, where the mirrored gradient would crease into a bright line.
  const height = up.mul(up).add(horizonRounding ** 2).sqrt().sub(horizonRounding)
  let sky: Node<'vec3'> = mix(colors.horizon, colors.zenith, pow(height, float(0.55)))
  const cosine = direction.dot(sun).clamp(-1, 1)
  // A wide, faint aureole and a tighter, brighter one. Like the clouds, it is weighed against the daytime brightness of 0.82.
  const aureole = pow(cosine.max(0), float(6)).mul(0.16 / 0.82).add(pow(cosine.max(0), float(160)).mul(0.5 / 0.82))
  sky = sky.add(colors.glow.mul(aureole))
  // Clouds: a flat deck overhead, traced along the view direction and drifting with the wind.
  const deck = vec2(direction.x, direction.z).div(up.add(cloudHeight * 0.3).max(0.02)).mul(cloudHeight).add(vec2(...wind).mul(time))
  const shape = mx_fractal_noise_float(vec3(deck.mul(2.2), 3.7), 5, 2, 0.5).mul(0.5).add(0.5)
  const detail = mx_fractal_noise_float(vec3(deck.mul(9), 11.3), 3, 2, 0.5).mul(0.5).add(0.5)
  const threshold = float(1).sub(look.cloudCover.mul(0.75))
  const density = smoothstep(threshold.sub(0.12), threshold.add(0.18), shape.add(detail.sub(0.5).mul(0.25)))
  // Toward the horizon the deck is seen ever more edge-on: its clouds thin out into the haze instead of crawling.
  const visible = smoothstep(0.04, 0.3, up)
  const coverage = density.mul(visible)
  // Thick cores are darker underneath, thin edges glow; the sunward side of the sky lights them warmer.
  const shade = mix(colors.cloudLit, colors.cloudShade, smoothstep(0.35, 1, density).mul(0.75))
  const lit = shade.add(colors.cloudWarm.mul(pow(cosine.max(0), float(4)).mul(0.25))).mul(0.9 / 0.82)
  sky = mix(sky, lit, coverage.mul(0.92)).mul(look.brightness)
  // The sun’s disc, softened by a pixel-scale rim and veiled where a cloud passes in front of it.
  const disc = smoothstep(Math.cos(sunRadius * 1.15), Math.cos(sunRadius * 0.85), cosine)
  sky = sky.add(colors.sun.mul(disc.mul(float(1).sub(coverage.mul(0.85))).mul(look.sunRadiance)))
  return max(sky, vec3(0))
}

/** The uniforms of a {@link proceduralSky}: changing its palette or sun never recompiles the sky. */
export class SkyLook {
  readonly brightness = uniform(1)
  readonly cloudCover = uniform(0)
  readonly colors = Object.fromEntries(colorKeys.map(key => [key, uniform(new Color)])) as Record<typeof colorKeys[number], UniformNode<'color', Color>>
  readonly sunDirection = uniform(new Vector3(0, 1, 0))
  readonly sunRadiance = uniform(0)

  constructor(options: ProceduralSkyOptions) {
    this.set(options)
  }

  set({sunDirection, ...palette}: ProceduralSkyOptions) {
    const {brightness, cloudCover, sunRadiance, ...colors} = {
      ...daytimeSky,
      ...palette,
    }
    if (!(cloudCover >= 0 && cloudCover <= 1)) {
      throw new RangeError('Cloud cover has to be between 0 and 1.')
    }
    const length = Math.hypot(...sunDirection)
    if (!(length > 0)) {
      throw new RangeError('The sun needs a direction.')
    }
    this.sunDirection.value.set(...sunDirection).divideScalar(length)
    this.brightness.value = brightness
    this.cloudCover.value = cloudCover
    this.sunRadiance.value = sunRadiance
    for (const key of colorKeys) {
      this.colors[key].value.set(colors[key])
    }
  }
}
