import type {OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import {asin, atan, Break, float, Fn, If, Loop, mix, select, texture, time, vec2, vec3} from 'three/tsl'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {rgb, spinAroundY, turn} from '../lib/fill.ts'
import {impastoRelief} from './reliefTexture.ts'
import {fillIor, groundRadius, reliefLimit} from './strokes.ts'

const key = vec3(0.26, 0.85, 0.79).normalize()
const bounce = vec3(0.82, -0.27, -0.51).normalize()
const outerRadius = groundRadius + reliefLimit
const minimumStep = 0.003
// The longest search grazes the ground without hitting it. Budget for both endpoints at the minimum stride.
const march = {
  start: 0,
  end: Math.ceil(2 * Math.sqrt(outerRadius ** 2 - groundRadius ** 2) / minimumStep) + 2,
  type: 'int',
  name: 'reliefStep',
} as const
const hitTolerance = 0.00002
const refine = {
  start: 0,
  end: 5,
  type: 'int',
  name: 'reliefRefinement',
} as const

/** A miniature impasto painting in the round, turning below the glass. The pigment and height are read from the same surface. */
export default class ImpastoOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      fillIor,
      name: 'orb-impasto',
      tint: '#fcf7ec',
    })
    this.roughness = 0.06
  }

  protected override fill(ray: OrbRay) {
    const atlas = impastoRelief()
    const sample = Fn(([normal]: [Node<'vec3'>]) => {
      // Longitude is immaterial at the poles; keep atan from seeing the undefined pair (0, 0).
      const x = select(normal.x.abs().add(normal.z.abs()).lessThan(1e-6), float(1), normal.x)
      const u = atan(normal.z, x).div(2 * Math.PI).add(0.5)
      const v = asin(normal.y.clamp(-1, 1)).div(Math.PI).add(0.5)
      // The search advances independently per pixel; a derivative-based mip level would vary with its control flow.
      return texture(atlas, vec2(u, v)).level(float(0))
    })
    const radiusAt = (normal: Node<'vec3'>) => sample(normal).a.mul(reliefLimit).add(groundRadius)
    const clearance = Fn(([point]: [Node<'vec3'>]) => {
      const radius = point.length().toVar()
      return radius.sub(radiusAt(point.div(radius.max(1e-5))))
    })
    const angle = time.mul(-0.09)
    const orient = (point: Node<'vec3'>) => {
      const spun = spinAroundY(point, angle).toVar()
      return vec3(turn(spun.xy, float(0.26)), spun.z)
    }
    const origin = orient(ray.origin).toVar('impastoOrigin')
    const direction = orient(ray.direction).toVar('impastoDirection')
    const approach = origin.dot(direction).negate().toVar()
    const miss = origin.add(direction.mul(approach)).lengthSq().toVar()
    const radiance = vec3(0).toVar()
    const covered = float(0).toVar()
    If(miss.lessThan(outerRadius ** 2), () => {
      const chord = float(outerRadius ** 2).sub(miss).max(0).sqrt().toVar()
      const depth = approach.sub(chord).max(0).toVar()
      const previous = depth.toVar()
      // A ray that reaches the gesso can stop there. Grazing rays outside it may hit relief farther along the chord.
      const groundHit = approach.sub(float(groundRadius ** 2).sub(miss).max(0).sqrt())
      const end = select(miss.lessThan(groundRadius ** 2), groundHit, approach.add(chord)).min(ray.length).toVar()
      Loop(march, () => {
        const gap = clearance(origin.add(direction.mul(depth))).toVar()
        If(gap.lessThanEqual(hitTolerance), () => {
          covered.assign(1)
          // Recover the first surface between these samples instead of shading at an interior point.
          Loop(refine, () => {
            const middle = depth.add(previous).mul(0.5).toVar()
            If(clearance(origin.add(direction.mul(middle))).greaterThan(hitTolerance), () => {
              previous.assign(middle)
            }).Else(() => {
              depth.assign(middle)
            })
          })
          Break()
        })
        If(depth.greaterThanEqual(end), () => {
          Break()
        })
        previous.assign(depth)
        // Outside the relief, radial clearance buys longer steps. Near the paint, small steps pick up the thin knife trails.
        depth.assign(depth.add(gap.mul(0.15).max(minimumStep)).min(end))
      })
      If(covered.greaterThan(0), () => {
        const point = origin.add(direction.mul(depth)).toVar()
        const radial = point.normalize().toVar()
        const swatch = sample(radial).toVar()
        const tangent = radial.cross(select(radial.y.abs().lessThan(0.9), vec3(0, 1, 0), vec3(1, 0, 0))).normalize().toVar()
        const bitangent = radial.cross(tangent).toVar()
        // Differentiate the radial field in orthogonal surface directions, including at the poles.
        const delta = 0.004
        const slope = (axis: Node<'vec3'>) => radiusAt(radial.add(axis.mul(delta)).normalize()).sub(radiusAt(radial.sub(axis.mul(delta)).normalize())).div(2 * delta)
        const normal = radial.sub(tangent.mul(slope(tangent)).add(bitangent.mul(slope(bitangent))).div(point.length())).normalize().toVar()
        const light = orient(key).toVar()
        // Low-angle rays from the broad key catch the raised lips and leave short contact shadows in the gesso.
        const shade = float(1).toVar()
        for (const offset of [0.027, 0.063, 0.12]) {
          shade.mulAssign(clearance(point.add(light.mul(offset))).smoothstep(-0.034, 0).mul(0.42).add(0.58))
        }
        const diffuse = normal.dot(light).max(0).mul(shade).mul(0.72)
        const fill = normal.dot(orient(bounce)).max(0).mul(0.26).add(0.31)
        const gloss = swatch.a.smoothstep(0.005, 0.32)
        const halfway = light.sub(direction).toVar()
        const glint = normal.dot(halfway).div(halfway.length().max(1e-4)).clamp()
        const shine = glint.pow(mix(18, 48, gloss)).mul(gloss.mul(0.3).add(0.008)).mul(shade)
        radiance.assign(swatch.rgb.mul(rgb('#fff2de').mul(diffuse).add(rgb('#d8e7ff').mul(fill))).add(rgb('#fff0d8').mul(shine)))
      })
    })
    return {
      radiance,
      transmittance: covered.oneMinus(),
    }
  }
}
