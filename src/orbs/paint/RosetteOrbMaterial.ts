import type {OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import {array, atan, Break, float, Fn, If, int, Loop, mix, select, time, vec2, vec3, vec4} from 'three/tsl'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {rgb, spinAroundY} from '../lib/fill.ts'
import {orbNoise} from '../lib/noise.ts'
import {blade, whorls} from './whorls.ts'

const shapes = array(whorls.map(({root, tip, depth, loft}) => vec4(root, tip, depth, loft)))
const fans = array(whorls.map(({count, turn, phase, slope}) => vec4(count, turn, phase, slope)))
const bodies = array(whorls.map(({body}) => rgb(body)))
const loads = array(whorls.map(({load}) => rgb(load)))
// A step can cross a grazing lip. Once inside, bisect the bracket rather than leaving a jagged silhouette or a glint at the wrong depth.
const minimumStep = 0.002
const cylinders = whorls.map(({root, tip, depth, loft, slope}) => {
  const heel = depth + root * slope
  const toe = depth + tip * slope
  return {
    radius: tip,
    center: (heel + toe) / 2,
    halfHeight: Math.abs(heel - toe) / 2 + loft,
  }
})
const bounds = array(cylinders.map(({radius, center, halfHeight}) => vec3(radius * radius, center, halfHeight)))
// Even an edge-on ray taking only minimum steps can traverse the whole cylinder. TSL needs distinct indices for nested loops.
const march = {
  start: 0,
  end: Math.ceil(2 * Math.max(...cylinders.map(({radius, halfHeight}) => Math.hypot(radius, halfHeight))) / minimumStep) + 1,
  type: 'int',
  name: 'knifeStep',
} as const
const refine = {
  start: 0,
  end: 5,
  type: 'int',
  name: 'knifeRefinement',
} as const
/** From the turning globe into the plane of the flower, which nods toward the viewer rather than lying flat on the holder. */
function inBloom(point: Node<'vec3'>, angle: Node<'float'>) {
  const p = spinAroundY(point, angle)
  return vec3(p.x, p.y.mul(Math.cos(0.36)).sub(p.z.mul(Math.sin(0.36))), p.y.mul(Math.sin(0.36)).add(p.z.mul(Math.cos(0.36))))
}
/** Knife coordinates: heel to lifted point, side to side, above the rolled lip and a stable seed per load. Folding the angle first means the cost of evaluating a whorl is independent of how many dabs there are. */
const knife = Fn(([point, shape, fan]: [Node<'vec3'>, Node<'vec4'>, Node<'vec4'>]) => {
  const r = point.xy.length()
  const reach = r.sub(shape.x).div(shape.y.sub(shape.x))
  const t = reach.clamp()
  const sweep = t.mul(t.mul(-0.44).add(1.44)).mul(fan.y)
  const sector = atan(point.y, point.x).sub(fan.z).sub(sweep).mul(fan.x.div(2 * Math.PI)).add(0.5).add(fan.x)
  const side = sector.fract().mul(2).sub(1)
  const seed = sector.floor().mod(fan.x).add(fan.z).mul(7.13).sin()
  // Individual pulls fall short of the rim by different amounts. The loaded heel is broad, the dragged end lean; both come to a point.
  const u = reach.mul(seed.mul(0.09).add(2.11)).sub(1)
  const width = t.mul(-blade.taper).add(blade.heel).add(seed.mul(blade.variation))
  const wander = width.oneMinus().mul(blade.wander).mul(seed).mul(t.mul(Math.PI).sin())
  const v = side.sub(wander).div(width)
  const face = select(shape.z.lessThan(0), float(-1), float(1))
  const z = point.z.sub(shape.z).sub(r.mul(fan.w)).div(shape.w).mul(face)
  // The blade dipped, rocked onto one edge, then lifted. A little of its previous load winds through the resulting furrows.
  const bed = t.mul(t).mul(0.94).sub(t.mul(0.25)).sub(0.32).add(side.mul(0.26)).add(side.mul(side).mul(0.15))
  const track = knifeTrack(u, v, seed)
  const ridges = track.sin().mul(0.065).add(track.mul(1.83).sin().mul(0.019))
  const w = z.sub(bed).sub(ridges).div(0.62)
  return vec4(u, v, w, seed)
})
function knifeTrack(u: Node<'float'>, v: Node<'float'>, seed: Node<'float'>) {
  return v.mul(14).add(u.mul(2.6).add(seed).sin().mul(1.6)).add(seed.mul(3)).add(v.mul(6).sin().mul(0.7))
}
/** Zero on the surface. The slab guard keeps even a frayed tip out of the next tier. */
function field(p: Node<'vec3'>, shape: Node<'vec4'>, fan: Node<'vec4'>) {
  return knife(p, shape, fan).xyz.length().sub(1).max(p.z.sub(shape.z).sub(p.xy.length().mul(fan.w)).abs().div(shape.w).sub(1))
}
/** Entry and exit depths in the whorl’s finite cylinder, inverted on a miss. The cylinder also encloses the tier when seen exactly along or across the flower’s axis. */
function cylinderInterval(o: Node<'vec3'>, d: Node<'vec3'>, cylinder: Node<'vec3'>) {
  const nz = select(d.z.greaterThanEqual(0), d.z.max(1e-6), d.z.min(-1e-6))
  const mid = cylinder.y.sub(o.z).div(nz)
  const span = cylinder.z.div(nz.abs())
  const a = d.xy.dot(d.xy).max(1e-10)
  const b = o.xy.dot(d.xy)
  const c = o.xy.dot(o.xy).sub(cylinder.x)
  const disc = b.mul(b).sub(a.mul(c))
  const delta = disc.max(0).sqrt()
  const enter = mid.sub(span).max(b.negate().sub(delta).div(a))
  const exit = mid.add(span).min(b.negate().add(delta).div(a))
  return select(disc.lessThan(0), vec2(1, 0), vec2(enter, exit))
}

/** A double rosette sculpted entirely from thick knife-loads of paint. The ray passes through clear glass between them, including between the small curls at the heart. */
export default class RosetteOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-rosette',
      tint: '#fff6eb',
    })
  }

  protected override fill(ray: OrbRay) {
    const angle = time.mul(-0.09).add(0.98)
    const origin = inBloom(ray.origin, angle).toVar('bloomOrigin')
    const dir = inBloom(ray.direction, angle).toVar('bloomDirection')
    const depth = ray.length.toVar('bloomDepth')
    const layer = int(-1).toVar('bloomLayer')
    Loop(whorls.length, ({i}) => {
      const shape = shapes.element(i)
      const fan = fans.element(i)
      const interval = cylinderInterval(origin, dir, bounds.element(i))
      const enter = interval.x.max(0)
      const exit = interval.y.min(depth)
      If(enter.lessThan(exit), () => {
        const d = enter.toVar()
        const previous = enter.toVar()
        Loop(march, () => {
          const p = origin.add(dir.mul(d))
          const distance = field(p, shape, fan)
          If(distance.lessThan(0), () => {
            layer.assign(i)
            Loop(refine, () => {
              const mid = previous.add(d).mul(0.5).toVar()
              If(field(origin.add(dir.mul(mid)), shape, fan).greaterThan(0), () => {
                previous.assign(mid)
              }).Else(() => {
                d.assign(mid)
              })
            })
            depth.assign(d)
            Break()
          })
          // An angular unit shrinks toward the center. Bound its physical stride there, as well as at the steep folds of a lip.
          const unit = p.xy.length().max(shape.x).mul(Math.PI).div(fan.x).min(shape.w).mul(0.1)
          const r = p.xy.length()
          const toBand = p.z.sub(shape.z).sub(r.mul(fan.w)).abs().sub(shape.w).div(fan.w.mul(fan.w).add(1).sqrt())
          previous.assign(d)
          d.addAssign(distance.mul(unit).max(shape.x.sub(r)).max(toBand).max(minimumStep))
          If(d.greaterThanEqual(exit), () => {
            Break()
          })
        })
      })
    })
    const color = vec3(0).toVar('bloomPaint')
    If(layer.greaterThanEqual(0), () => {
      const shape = shapes.element(layer)
      const fan = fans.element(layer)
      const p = origin.add(dir.mul(depth)).toVar()
      const k = knife(p, shape, fan).toVar()
      const step = 0.00045
      const derivative = (offset: Node<'vec3'>) => field(p.add(offset), shape, fan).sub(field(p.sub(offset), shape, fan))
      const n = vec3(derivative(vec3(step, 0, 0)), derivative(vec3(0, step, 0)), derivative(vec3(0, 0, step))).normalize()
      // Both pigments are carried on the same knife. Folds expose the darker load and a few pale filaments split off the lighter one as the blade runs dry.
      const drag = orbNoise(vec3(k.x.mul(2.3), k.y.mul(9), k.w.add(k.z.mul(0.3)))).x
      const track = knifeTrack(k.x, k.y, k.w).add(drag.mul(0.9))
      const fold = k.y.add(k.x.mul(2).add(k.w).sin().mul(0.23)).add(drag.mul(0.13))
      const load = fold.add(k.w.mul(0.29)).smoothstep(-0.05, 0.45).mul(0.64).add(track.sin().mul(0.5).add(0.5).pow(3).mul(0.22)).add(k.x.mul(0.08).add(0.08)).clamp()
      const filament = track.mul(2.76).add(drag.mul(3)).sin().smoothstep(0.72, 1).mul(fold.smoothstep(-0.3, 0.75)).mul(0.21)
      const paint = mix(mix(bodies.element(layer), loads.element(layer), load), rgb('#fff2dc'), filament)
      const light = inBloom(vec3(-0.35, 0.84, 0.52).normalize(), angle)
      const diffuse = n.dot(light).mul(0.6).add(0.66).clamp(0.24, 1.2)
      const gloss = n.dot(light.sub(dir).normalize()).max(0).pow(37).mul(0.23)
      // Paint packed toward a heel is in the shade of the curled lip in front of it; deep marks lose light in the oil as well.
      const shadow = k.x.smoothstep(-0.97, 0.54).mul(0.29).add(0.71).mul(depth.mul(-0.37).exp())
      color.assign(paint.mul(diffuse).mul(shadow).add(vec3(gloss)))
    })
    return {
      radiance: color,
      transmittance: float(layer.lessThan(0)),
    }
  }
}
