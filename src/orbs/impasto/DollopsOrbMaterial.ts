import type {FillLayer, OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import {float, mix, mx_cell_noise_vec3, mx_noise_float, normalize, smoothstep, time, vec3} from 'three/tsl'

import {oilPaints} from '#src/lib/materials/oilPaints.ts'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {ellipsoidHit, rgb, spinAroundY} from '../lib/fill.ts'
import {orbFractalNoise, orbNoise} from '../lib/noise.ts'

/** the most steps the march takes through the fill */
const steps = 40
/** where the light falls into the orb from, in its own frame: from above, a little from the front and the right, raking over the paint */
const light = normalize(vec3(0.35, 1, 0.45))
/** the amber oil the dollops drift in */
const oilColor = rgb('#c98f2a')
type Vec = readonly [number, number, number]
/**
 * One dollop of paint squeezed out of its tube and troweled to a soft peak: where it drifts, how large it is, its paint and the second one streaked through it without mixing in, which way its peak points, and what sets its bobbing apart from the others’.
 * Centers and sizes are in radii of the orb, and every dollop stays clear of the glass.
 */
const dollops: ReadonlyArray<{
  center: Vec
  paint: string
  phase: number
  size: number
  streak?: string
  tilt: Vec
}> = [
  {
    center: [-0.35, 0.25, -0.1],
    size: 0.26,
    paint: oilPaints.cadmiumYellow,
    tilt: [0.2, 1, 0.1],
    phase: 0,
  },
  {
    center: [0.3, 0.35, 0.15],
    size: 0.22,
    paint: oilPaints.vermilion,
    streak: oilPaints.titaniumWhite,
    tilt: [-0.3, 1, 0.2],
    phase: 1.7,
  },
  {
    center: [0, -0.05, -0.35],
    size: 0.28,
    paint: oilPaints.ultramarine,
    tilt: [0.1, 1, -0.3],
    phase: 3.1,
  },
  {
    center: [0.45, -0.2, -0.2],
    size: 0.2,
    paint: oilPaints.titaniumWhite,
    streak: oilPaints.cadmiumYellow,
    tilt: [0.4, 0.8, 0],
    phase: 4.6,
  },
  {
    center: [-0.45, -0.25, 0.2],
    size: 0.22,
    paint: oilPaints.viridian,
    tilt: [-0.2, 1, 0.3],
    phase: 2.2,
  },
  {
    center: [0.05, 0.5, -0.25],
    size: 0.18,
    paint: oilPaints.titaniumWhite,
    streak: oilPaints.vermilion,
    tilt: [0, 1, 0.4],
    phase: 5.3,
  },
  {
    center: [-0.15, -0.45, -0.15],
    size: 0.24,
    paint: oilPaints.vermilion,
    tilt: [0.3, 0.9, -0.2],
    phase: 0.9,
  },
  {
    center: [0.2, 0.05, 0.4],
    size: 0.2,
    paint: oilPaints.ultramarine,
    streak: oilPaints.titaniumWhite,
    tilt: [-0.4, 1, 0],
    phase: 6.1,
  },
  {
    center: [-0.3, 0.05, 0.4],
    size: 0.17,
    paint: oilPaints.cadmiumYellow,
    streak: oilPaints.viridian,
    tilt: [0.2, 0.8, 0.3],
    phase: 2.8,
  },
  {
    center: [0.5, 0.15, 0.3],
    size: 0.17,
    paint: oilPaints.viridian,
    tilt: [0, 1, -0.2],
    phase: 4.1,
  },
  {
    center: [0, -0.55, 0.25],
    size: 0.18,
    paint: oilPaints.ultramarine,
    streak: oilPaints.cadmiumYellow,
    tilt: [-0.3, 1, 0.1],
    phase: 1.2,
  },
  {
    center: [-0.55, 0.4, -0.3],
    size: 0.15,
    paint: oilPaints.titaniumWhite,
    tilt: [0.4, 1, 0.2],
    phase: 5.8,
  },
]
/** A right-handed frame from the way `up` points: across, up along the peak and out. */
function basis(up: Vec): [Vec, Vec, Vec] {
  const length = Math.hypot(...up)
  const y: Vec = [up[0] / length, up[1] / length, up[2] / length]
  const helper: Vec = Math.abs(y[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
  const cross: Vec = [y[1] * helper[2] - y[2] * helper[1], y[2] * helper[0] - y[0] * helper[2], y[0] * helper[1] - y[1] * helper[0]]
  const across = Math.hypot(...cross)
  const x: Vec = [cross[0] / across, cross[1] / across, cross[2] / across]
  const z: Vec = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]]
  return [x, y, z]
}

/** Chunky dollops of oil paint adrift in amber oil, each squeezed out of its tube and pulled up into a soft peak as the knife lifted off, some streaked with a second paint: they turn slowly as one and bob a little each, their ridged faces lit from above, glossy where they swell, the oil between them faintly clouded with pigment. */
export default class DollopsOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-impasto',
      fillIor: 1.46,
      tint: '#f0d9a0',
    })
  }

  protected override fill(ray: OrbRay) {
    const {direction, origin} = ray
    // The whole fill turns slowly, as if the oil had just been stirred.
    const spin = time.mul(0.06)
    const layers: Array<FillLayer> = []
    for (const {center, paint, phase, size, streak, tilt} of dollops) {
      const middle = spinAroundY(vec3(...center), spin).add(vec3(0, time.mul(0.5).add(phase).sin().mul(0.02), 0))
      const frame = basis(tilt)
      const axes: [Node<'vec3'>, Node<'vec3'>, Node<'vec3'>] = [spinAroundY(vec3(...frame[0]), spin), spinAroundY(vec3(...frame[1]), spin), spinAroundY(vec3(...frame[2]), spin)]
      const up = axes[1]
      // The mound, flattened, and the peak the knife pulled out of it, tipped a little to the side as the knife lifted off.
      const parts: Array<{
        at: Node<'vec3'>
        radii: [number, number, number]
      }> = [
        {
          at: middle,
          radii: [size, size * 0.55, size * 0.85],
        },
        {
          at: middle.add(up.mul(size * 0.32)).add(axes[0].mul(size * 0.12)),
          radii: [size * 0.38, size * 0.42, size * 0.38],
        },
      ]
      for (const {at, radii} of parts) {
        const {coverage, depth} = ellipsoidHit(origin, direction, at, axes, radii)
        const point = origin.add(direction.mul(depth))
        const local = point.sub(at)
        const along = axes.map((axis, index) => local.dot(axis).div(radii[index]))
        const facing = axes[0].mul(along[0].div(radii[0])).add(axes[1].mul(along[1].div(radii[1]))).add(axes[2].mul(along[2].div(radii[2]))).normalize()
        // The knife left the surface faceted and ridged, never smooth: every cell of it troweled flat its own way, facing more its facet’s way than the mound’s, with finer ridges dragged over the facets.
        const warped = point.mul(10).add(orbNoise(point.mul(3).add(phase)).xyz.mul(2.5))
        const facet = mx_cell_noise_vec3(warped.add(phase)).sub(0.5).normalize()
        const normal = mix(facing, facet, 0.55).add(orbNoise(point.mul(18).add(phase * 2.7)).xyz.mul(0.2)).normalize()
        const base = rgb(paint)
        const streaked = streak ? mix(base, rgb(streak), mx_noise_float(point.mul(3.5).add(vec3(phase, 0, 0))).smoothstep(-0.1, 0.3).mul(0.85)) : base
        // Its tone breaks up along the ridges, as paint dragged thin over peaks pales.
        const color = streaked.mul(mx_noise_float(point.mul(22).add(vec3(0, phase, 0))).mul(0.14).add(1))
        const lit = normal.dot(light).max(0).mul(0.8).add(0.25).mul(smoothstep(-1, 1, point.y).mul(0.25).add(0.75))
        const gloss = normal.dot(light.sub(direction).normalize()).max(0).pow(22).mul(0.28)
        // The oil in front of a dollop dims it the deeper it lies.
        const depthShade = depth.mul(-0.3).exp()
        layers.push({
          depth,
          coverage,
          color: color.mul(lit).mul(depthShade).add(vec3(gloss)),
        })
      }
    }
    return this.march(ray, steps, point => {
      // The oil is faintly clouded where pigment has washed off the dollops.
      const cloud = orbFractalNoise(spinAroundY(point, spin).mul(1.6).add(vec3(0, time.mul(0.03), 0)), 3, 2.1)
      const wall = smoothstep(1, 0.85, point.length())
      return {
        absorption: float(0.15),
        density: cloud.smoothstep(0.15, 0.6).mul(0.3).mul(wall),
        color: oilColor.mul(0.6),
      }
    }, layers)
  }
}
