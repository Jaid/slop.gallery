import type {OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {Break, color, float, Fn, hash, If, Loop, mix, reflect, refract, select, time, vec2, vec3} from 'three/tsl'

import {crystalSector, stellarPlate} from '#src/lib/materials/snowCrystal.ts'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {spinAroundY, turn} from '../lib/fill.ts'
import {orbNoise} from '../lib/noise.ts'

/** A capped column: a stellar dendrite has grown from one end of a hollow hexagonal seed. All dimensions are in orb radii. */
const plateRadius = 0.64
const plateZ = 0.067
const bound = 0.65
const field = Fn(([p]: [Node<'vec3'>]) => {
  const q = crystalSector(p.xy)
  const edge = stellarPlate(q.div(plateRadius)).mul(plateRadius)
  const above = p.z.sub(plateZ).abs()
  // Bevels run up both faces to a narrow keel, clipped to a little flat table on the seed.
  const plate = edge.negate().max(above.sub(0.017)).max(above.sub(edge.mul(0.68)).sub(0.0014).mul(0.81))
  // On the reverse, the faces grow more slowly than their rims, leaving a deep hexagonal cup when seen through the crystal.
  const depth = p.z.negate().add(plateZ)
  const lip = depth.mul(0.48).add(0.046).min(0.123)
  const shell = q.x.sub(lip).max(lip.sub(0.017).sub(q.x)).mul(0.89)
  const cup = shell.max(depth.negate()).max(depth.sub(0.19))
  return plate.min(cup)
})
const yaw = () => time.mul(-0.16).add(0.3)
const roll = () => time.mul(0.09).add(0.27)
/** Into the crystal’s frame. */
function crystalSpace(p: Node<'vec3'>) {
  const spun = spinAroundY(p, yaw())
  const nodded = vec3(spun.x, turn(spun.yz, float(0.34)))
  return vec3(turn(nodded.xy, roll()), nodded.z)
}
/** The inverse of crystalSpace, for rays leaving the ice to travel on through the liquid. */
function liquidSpace(p: Node<'vec3'>) {
  const unrolled = vec3(turn(p.xy, roll().negate()), p.z)
  return spinAroundY(vec3(unrolled.x, turn(unrolled.yz, float(-0.34))), yaw().negate())
}
/** A veil of powder carried around the crystal by the wind. A jittered cell on a cube projected onto the sphere never pinches to a singularity at its poles. */
function spindrift(at: Node<'vec3'>, speed: number, cells: number, outer: boolean, footprint: Node<'float'>) {
  const p = spinAroundY(at, time.mul(speed).add(at.y.mul(1.5)))
  const a = p.abs()
  const u = select(a.x.greaterThan(a.z), p.zy, p.xy)
  const polar = a.y.greaterThan(a.x.max(a.z))
  const face = select(polar, p.y.sign().mul(3), select(a.x.greaterThan(a.z), p.x.sign(), p.z.sign().mul(2)))
  const plane = select(polar, p.xz, u).div(a.x.max(a.y).max(a.z).max(0.001))
  const grid = plane.add(1).mul(cells)
  const cell = grid.floor().dot(vec2(1, 59)).add(face.add(3).mul(2503)).add(cells * 151)
  const seed = hash(cell)
  const delta = grid.fract().sub(vec2(seed, hash(cell.add(1987))).mul(0.6).add(0.2))
  const size = hash(cell.add(397)).pow3().mul(0.096).add(0.035)
  const pixel = footprint.mul(cells).max(0.018)
  const seedCoverage = size.mul(2).div(pixel).min(1).pow2()
  const dust = size.sub(delta.mul(vec2(0.92, 1.15)).length()).div(pixel).add(0.5).clamp().mul(seedCoverage)
  const axy = delta.abs()
  const star = size.mul(1.86).sub(axy.x.max(axy.y).add(axy.x.min(axy.y).mul(6))).div(pixel).add(0.5).clamp()
  const glint = star.mul(seedCoverage).mul(size.smoothstep(0.1, 0.13)).mul(time.mul(1.3).add(seed.mul(85)).sin().smoothstep(0.52, 1))
  // Long strands sweep sideways through the powder, strongest along a wavering band, never outlining the shell itself.
  const wind = orbNoise(p.mul(vec3(2.1, 6, 2.1)).add(cells)).x
  const latitude = p.y.add(p.z.mul(0.32)).add(p.x.mul(p.z).mul(0.36)).add(wind.mul(0.11))
  const ribbon = latitude.abs().smoothstep(0.03, 0.33).oneMinus().mul(wind.smoothstep(-0.23, 0.46))
  const powder = dust.mul(wind.smoothstep(-0.42, 0.38)).mul(seed.mul(0.75).add(0.25)).mul(ribbon.mul(1.8).add(0.65))
  const scatter = vec3(0.78, 1, 1.19).mul(powder.add(glint.mul(0.74)))
  if (!outer) {
    return scatter.add(vec3(0.14, 0.47, 0.83).mul(ribbon.mul(0.09)))
  }
  // A little auroral curtain billows through the outer gust. Fine vertical streamers rise from its mint hem into violet, leaving clear glass between folds.
  const height = latitude.add(p.x.mul(3.8).sin().mul(0.13)).sub(0.13)
  const streamers = orbNoise(p.mul(vec3(11, 0.9, 11)).add(0.7)).z.mul(0.7).add(0.5).clamp()
  const hem = height.abs().mul(-15).exp()
  const veil = height.smoothstep(-0.06, 0.035).mul(height.smoothstep(0.03, 0.37).oneMinus()).mul(streamers)
  const aurora = mix(vec3(0.065, 0.91, 0.56), vec3(0.59, 0.22, 1), height.smoothstep(-0.01, 0.24))
  return scatter.add(aurora.mul(hem.mul(0.32).add(veil.mul(0.37))).mul(wind.mul(0.7).add(0.53)))
}

/** A stellar snow crystal suspended in polar-blue glass. Trace only its bounded solid; the two depths of blowing powder on either side need no volume march. */
export default class FrostOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-frost',
      fillIor: 1.29,
      tint: hsl.integer(219, 38, 90),
    })
  }

  protected override fill(ray: OrbRay) {
    const o = crystalSpace(ray.origin).toVar()
    const d = crystalSpace(ray.direction).toVar()
    const mid = o.dot(d).negate()
    const miss = o.add(d.mul(mid)).lengthSq()
    const hit = ray.length.toVar('frostDepth')
    const ice = vec3(0).toVar()
    const clarity = float(1).toVar()
    const bend = vec3(0).toVar()
    If(miss.lessThan(bound ** 2), () => {
      const span = float(bound ** 2).sub(miss).sqrt()
      const depth = mid.sub(span).toVar()
      Loop(80, () => {
        const p = o.add(d.mul(depth))
        const distance = field(p)
        If(distance.lessThan(0.00045), () => {
          hit.assign(depth)
          Break()
        })
        depth.addAssign(distance.mul(0.92))
        If(depth.greaterThan(mid.add(span)), () => {
          Break()
        })
      })
    })
    const solid = hit.lessThan(ray.length)
    If(solid, () => {
      const p = o.add(d.mul(hit))
      // Central differences round just the very edges, which catch the narrow white reflections.
      const e = 0.0008
      const slope = (v: Node<'vec3'>) => field(p.add(v)).sub(field(p.sub(v)))
      const n = vec3(slope(vec3(e, 0, 0)), slope(vec3(0, e, 0)), slope(vec3(0, 0, e))).normalize()
      const reflected = liquidSpace(reflect(d, n))
      const grazing = n.dot(d).abs().clamp().oneMinus()
      // The facets return long strips of sky rather than Lambertian white. Only the tiny edges that reflect the key flash white.
      const sky = reflected.y.add(reflected.x.mul(0.27))
      const strip = sky.sub(0.29).abs().smoothstep(0.015, 0.28).oneMinus()
      const key = reflected.dot(vec3(-0.48, 0.71, 0.52).normalize()).max(0).pow(18)
      const q = crystalSector(p.xy)
      // Thin terraces inside the faces mark pauses in growth. Tiny inclusions interrupt their hexagonal bands.
      const grain = orbNoise(p.mul(24)).x
      const ridge = q.x.add(q.y.mul(0.57)).add(grain.mul(0.0012)).mul(328).cos().smoothstep(0.77, 1)
      const facets = mix(color(hsl.integer(258, 82, 27)), color(hsl.integer(195, 79, 72)), sky.smoothstep(-0.7, 0.85))
      const polish = strip.mul(0.75).add(key.mul(1.6)).add(grazing.pow2().mul(0.66))
      // A thin spectrum at the shoulder of the reflected strip, most visible as a facet turns away from white.
      const dispersion = mix(vec3(0.65, 0.26, 0.1), vec3(0.21, 0.2, 0.75), sky.smoothstep(0.21, 0.35)).mul(strip.mul(strip.oneMinus()).mul(0.74))
      ice.assign(dispersion.add(facets.mul(0.57)).add(vec3(0.66, 0.92, 1.08).mul(polish)).add(vec3(0.43, 0.78, 0.91).mul(ridge.mul(grain.mul(0.12).add(0.15)))))
      clarity.assign(polish.mul(-0.63).add(0.85).clamp(0.12, 0.8))
      bend.assign(liquidSpace(refract(d, n, 1 / 1.31).sub(d)))
    })
    // The clear rim takes its color from the actual room; blue deepens toward the center of the lens.
    const body = miss.smoothstep(0.24, 0.57).oneMinus()
    const water = mix(vec3(0.007, 0.011, 0.026), vec3(0.013, 0.072, 0.125), body)
    const light = ice.add(water.mul(clarity)).toVar('frostLight')
    const footprint = ray.origin.fwidth().length()
    for (const [radius, speed, cells, aurora] of [[0.72, 0.18, 8, true], [0.535, 0.31, 6, false]] as const) {
      const span = float(radius ** 2).sub(miss).max(0).sqrt()
      // Taper at grazing incidence, where the front and back meet. No hard rim as a veil turns edge-on.
      const weight = span.smoothstep(0, 0.16)
      for (const depth of [mid.sub(span), mid.add(span)]) {
        const throughIce = depth.sub(hit).max(0)
        const at = ray.origin.add(ray.direction.mul(depth)).add(bend.mul(throughIce)).div(radius)
        const visible = select(depth.lessThan(hit), float(1), clarity)
        light.addAssign(spindrift(at, speed, cells, aurora, footprint).mul(visible).mul(weight).mul(depth.mul(-0.85).exp()))
      }
    }
    return {
      radiance: light,
      transmittance: ray.length.mul(body.mul(0.52).add(0.12)).negate().exp().mul(clarity),
    }
  }
}
