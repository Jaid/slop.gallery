import type {OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import {array, Break, float, Fn, If, Loop, max, min, mix, time, vec3} from 'three/tsl'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {rgb, spinAroundY} from '../lib/fill.ts'
import {impastoPalette, impastoStrokes} from './strokes.ts'

/** The name is supported by TSL but not yet declared by @types/three. Keeping the options in a variable preserves it without a cast. */
const march = {
  start: 0,
  end: 256,
  type: 'int',
  name: 'impastoStep',
} as const
const paints = array([...impastoPalette, '#674434'].map(rgb))
const centers = array(impastoStrokes.map(stroke => vec3(stroke.center)))
const longs = array(impastoStrokes.map(stroke => vec3(stroke.along)))
const widths = array(impastoStrokes.map(stroke => vec3(stroke.across)))
const normals = array(impastoStrokes.map(stroke => vec3(stroke.normal)))
const radii = array(impastoStrokes.map(stroke => vec3(...stroke.radii)))
const pigments = array(impastoStrokes.map(stroke => float(stroke.pigment)))
const light = vec3(-0.45, 0.8, 0.65).normalize()
/** A knife-laid slab in normalized stroke coordinates: broad at the loaded end, drawn to a narrow tail, with torn sides, a beveled underside and ridges pulled up along the top. All relief is geometry in the ray, not stripes painted onto a smooth ellipsoid. */
const paintDistance = Fn(([p]: [Node<'vec3'>]) => {
  const taper = p.x.smoothstep(-1, 0.7).mul(0.4).add(0.55)
  const torn = p.x.mul(19).sin().mul(0.035).add(p.x.mul(43).sin().mul(0.015))
  const furrow = p.y.mul(18).add(p.x.mul(3).sin().mul(0.7))
  const ridges = furrow.sin().mul(0.04).add(furrow.mul(2.3).sin().mul(0.012))
  // The knife lifts off at the narrow tail, leaving a thin scrape there and a thick lip at the loaded end.
  const height = p.x.smoothstep(-0.95, 0.5).mul(0.28).add(0.18).add(ridges)
  const q = vec3(p.x, p.y.sub(p.x.mul(2).sin().mul(0.12)).div(taper.add(torn)), p.z.sub(height.mul(0.45))).abs().sub(vec3(0.72, 0.65, height))
  return q.max(0).length().add(q.x.max(q.y).max(q.z).min(0)).sub(0.25)
})

/** A slowly turning sculpture of overlapping knife strokes inside clear glass. Each dab is a solid ridged slab, ray marched only inside its bounding box. Unlike the Paint Orb’s liquid ribbons, these strokes keep their shape. */
export default class ImpastoOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-impasto',
      tint: '#fff4df',
    })
  }

  protected override fill(ray: OrbRay) {
    const angle = time.mul(-0.09)
    const origin = spinAroundY(ray.origin, angle).toVar('impastoOrigin')
    const direction = spinAroundY(ray.direction, angle).toVar('impastoDirection')
    const lighting = spinAroundY(light, angle)
    const nearest = ray.length.toVar('impastoDepth')
    const covered = float(0).toVar('impastoCovered')
    const local = vec3(0).toVar('impastoLocal')
    const normal = vec3(0, 1, 0).toVar('impastoNormal')
    const pigment = float(0).toVar('impastoPigment')
    // A little umber underpainting holds the dabs together. Clear glass remains outside the sculpture.
    const approach = origin.dot(direction).negate()
    const miss = origin.add(direction.mul(approach)).lengthSq()
    const coreDepth = approach.sub(float(0.55 ** 2).sub(miss).max(0).sqrt())
    If(miss.lessThan(0.55 ** 2).and(coreDepth.greaterThan(0)).and(coreDepth.lessThan(nearest)), () => {
      nearest.assign(coreDepth)
      covered.assign(1)
      normal.assign(origin.add(direction.mul(coreDepth)).normalize())
      pigment.assign(impastoPalette.length)
    })
    Loop(impastoStrokes.length, ({i}) => {
      const along = longs.element(i)
      const across = widths.element(i)
      const outward = normals.element(i)
      const size = radii.element(i)
      const offset = origin.sub(centers.element(i))
      const o = vec3(offset.dot(along), offset.dot(across), offset.dot(outward)).div(size).toVar()
      const d = vec3(direction.dot(along), direction.dot(across), direction.dot(outward)).div(size).toVar()
      // A padded local box contains the torn sides and the highest paint ridge. Guard parallel rays without changing their sign.
      const inverse = d.sign().add(vec3(d.equal(0))).div(d.abs().max(1e-6))
      const first = vec3(-1.1).sub(o).mul(inverse)
      const last = vec3(1.1).sub(o).mul(inverse)
      const entry = min(first, last)
      const exit = max(first, last)
      const start = entry.x.max(entry.y).max(entry.z).max(0)
      const end = exit.x.min(exit.y).min(exit.z).min(nearest)
      If(start.lessThan(end), () => {
        const depth = start.toVar()
        // Nested TSL loops need distinct names; otherwise the march index shadows the stroke index in array lookups.
        Loop(march, () => {
          const point = o.add(d.mul(depth)).toVar()
          const distance = paintDistance(point).toVar()
          If(distance.lessThan(0.006), () => {
            nearest.assign(depth)
            covered.assign(1)
            local.assign(point)
            // Gradient in world radii, not in the stretched coordinates of the stroke.
            const step = 0.008
            const gradient = vec3(
              paintDistance(point.add(vec3(step, 0, 0))).sub(paintDistance(point.sub(vec3(step, 0, 0)))),
              paintDistance(point.add(vec3(0, step, 0))).sub(paintDistance(point.sub(vec3(0, step, 0)))),
              paintDistance(point.add(vec3(0, 0, step))).sub(paintDistance(point.sub(vec3(0, 0, step)))),
            ).div(size)
            normal.assign(along.mul(gradient.x).add(across.mul(gradient.y)).add(outward.mul(gradient.z)).normalize())
            pigment.assign(pigments.element(i))
            Break()
          })
          // The warped field is not an exact distance. A conservative stride keeps the march from skipping the knife ridges.
          depth.addAssign(distance.mul(size.z).mul(0.3).max(0.00015))
          If(depth.greaterThanEqual(end), () => {
            Break()
          })
        })
      })
    })
    const diffuse = normal.dot(lighting).max(0).mul(0.78).add(0.22)
    const gloss = normal.dot(lighting.sub(direction).normalize()).max(0).pow(64).mul(0.38)
    const paint = paints.element(pigment.toInt())
    // Only a faint trace of the knife’s previous load; the relief, not painted bands, defines the furrows.
    const streak = local.y.mul(18).add(local.x.mul(3).sin().mul(0.7)).sin().smoothstep(0.8, 1).mul(0.045)
    const body = mix(paint, rgb('#fff0ce'), streak).mul(diffuse).mul(nearest.mul(-0.12).exp())
    return {
      radiance: body.add(vec3(gloss)).mul(covered),
      transmittance: covered.oneMinus(),
    }
  }
}
