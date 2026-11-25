import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, Fn as fn, Loop as loop, mix, modelWorldMatrixInverse, mx_noise_float, positionGeometry, positionView, time, vec2, vec3, vec4} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

/** Neighbor traversal keeps stars and connecting segments whole across grid boundaries. */
const constellation = fn(([q]: [Node<'vec3'>]) => {
  const cell = q.floor()
  const local = q.fract()
  const footprint = q.fwidth().length().max(0.001)
  const filter = footprint.min(0.08)
  const visibility = footprint.smoothstep(0.2, 0.8).oneMinus()
  const stars = float(0).toVar()
  const links = float(0).toVar()
  loop(27, ({i}) => {
    const offset = vec3(i.mod(3), i.div(3).mod(3), i.div(9)).sub(1)
    const identity = cell.add(offset)
    const random = cellNoiseVec3(identity)
    const center = offset.add(random.mul(0.5).add(0.25))
    const radius = random.z.mul(0.055).add(0.035)
    const star = local.sub(center).length().smoothstep(radius.sub(filter).max(0), radius.add(filter)).oneMinus()
    const twinkle = time.mul(random.x.mul(8).add(1)).add(random.y.mul(Math.PI * 2)).sin().mul(0.45).add(0.6)
    stars.addAssign(star.mul(random.y.pow(3).add(0.1)).mul(twinkle).mul(radius.div(radius.add(filter)).pow2()))
    // One deterministic forward neighbor per star; both endpoints share the star positions.
    const axis = random.x.mul(3).floor()
    const direction = vec3(axis.equal(0).select(1, 0), axis.equal(1).select(1, 0), axis.equal(2).select(1, 0))
    const neighbor = cellNoiseVec3(identity.add(direction))
    const end = offset.add(direction).add(neighbor.mul(0.5).add(0.25))
    const segment = end.sub(center)
    const relative = local.sub(center)
    const along = relative.dot(segment).div(segment.dot(segment).max(0.0001)).clamp()
    const distance = relative.sub(segment.mul(along)).length()
    const line = distance.smoothstep(0.008, filter.add(0.018)).oneMinus()
    const connected = random.z.smoothstep(0.55, 0.75)
    links.addAssign(line.mul(connected).mul(float(0.018).div(filter.add(0.018))))
  })
  return vec2(stars, links).mul(visibility)
})

/** A pocket astrolabe. The knot is engraved with the constellations of a single imagined sky: gunmetal blue-black, fine gold filaments for the star lines, and emissive pin-points for the stars themselves. The star points live in the original (parallax-stable) surface so they do not drift as you orbit; only the nebular gas behind them shifts. Each star twinkles on its own clock while the constellation connections stay anchored. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.45)
    this.name = knotData.id
    this.envMapIntensity = 0.55
    const p = positionGeometry
    const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
    const viewDir = cameraLocal.sub(p).normalize()
    const distance = positionView.length()
    const near = distance.smoothstep(1.25, 5.5).oneMinus()
    const intimate = distance.smoothstep(0.8, 2.7).oneMinus()
    // ---- substrate ----
    // A very dark gunmetal blue with a faint brushed structure, so that
    // the gold lines and stars have something to read against.
    const brush = mx_noise_float(p.mul(38)).mul(0.5).add(0.5)
    const sky = mix(color(hsl.integer(276, 41, 7)), color(hsl.integer(274, 44, 14)), brush.mul(0.6))
    const deep = color(hsl.integer(272, 50, 3))
    // ---- star field ----
    const starField = constellation(p.mul(13))
    const starEnergy = starField.x
    const linkMask = starField.y
    // ---- nebular gas ----
    // A drifting haze behind the stars, with parallax along the view
    // direction so it shifts as you circle. Two stacked fractal noise
    // bands, one near and one far.
    const drift = vec3(time.mul(0.04), time.mul(-0.025), time.mul(0.02))
    const nearHaze = mx_noise_float(p.add(viewDir.mul(0.04)).add(drift))
      .mul(mx_noise_float(p.add(viewDir.mul(0.04)).add(drift).mul(2.3)).add(0.5))
    const farHaze = mx_noise_float(p.add(viewDir.mul(-0.08)).add(drift.mul(0.6)))
      .mul(mx_noise_float(p.add(viewDir.mul(-0.08)).add(drift.mul(0.6)).mul(2.7)).add(0.5))
    const haze = nearHaze.mul(0.5).add(0.5).mul(farHaze.mul(0.5).add(0.5))
    // ---- colour composition ----
    const nebulaColour = mix(color(hsl.integer(285, 72, 12)), color(hsl.integer(309, 69, 27)), haze)
    const baseColour = mix(deep, sky, distance.sub(1).mul(0.5).add(0.4).clamp()).add(nebulaColour.mul(near.mul(0.55).add(0.3).mul(0.55)))
    this.colorNode = baseColour
    this.metalness = 0.55
    this.roughness = 0.32
    this.normalNode = proceduralNormal(brush.mul(0.0004).add(haze.mul(0.0009)), 0.7)
    // ---- emissive ----
    const starGlow = color(hsl.integer(80, 100, 93)).mul(starEnergy).mul(intimate.mul(2).add(0.5))
    const linkGlow = color(hsl.integer(80, 76, 71)).mul(linkMask).mul(near.mul(0.5).add(0.4)).mul(4)
    const nebulaGlow = nebulaColour.mul(haze.mul(0.5).add(0.2)).mul(near.mul(0.4).add(0.25))
    this.emissiveNode = starGlow.add(linkGlow).add(nebulaGlow)
  }
}
