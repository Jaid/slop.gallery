import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, mix, mx_fractal_noise_float, mx_noise_float, normalWorld, positionWorld, time, uv, vec2, vec3} from 'three/tsl'

import {ramp} from '../../candidates/claude_opus/lib/ramp.ts'
import {tubeCells} from '../../candidates/claude_opus/lib/tubeMetric.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** World direction of the setting sun, low over the horizon. */
const sun = vec3(-0.35, 0.07, -0.93).normalize()
const rotate = (v: Node<'vec2'>, angle: Node<'float'>) => vec2(v.x.mul(angle.cos()).sub(v.y.mul(angle.sin())), v.x.mul(angle.sin()).add(v.y.mul(angle.cos())))
/** Distance from a point to a segment. */
const segment = (q: Node<'vec2'>, a: Node<'vec2'>, b: Node<'vec2'>) => {
  const ab = b.sub(a)
  const h = q.sub(a).dot(ab).div(ab.dot(ab)).clamp()
  return {
    distance: q.sub(a).sub(ab.mul(h)).length(),
    h,
  }
}
type FlockLayer = {
  along: number
  around: number
  depth: number
  drift: number
  seed: number
  size: number
}
/** The sky dome above the horizon: indigo zenith, burning horizon and stratified clouds with molten edges toward the sun. */
function skyDome(d: Node<'vec3'>) {
  const elevation = d.y.max(0)
  const toward = d.dot(sun).max(0)
  const horizon = mix(color(hsl.integer(18, 87, 52)), color(hsl.integer(54, 100, 71)), toward.pow(2)).mul(0.75)
  const middle = mix(color(hsl.integer(299, 69, 27)), color(hsl.integer(358, 65, 45)), toward.pow(3)).mul(0.7)
  const zenith = color(hsl.integer(271, 79, 9.6))
  const air = mix(mix(horizon, middle, elevation.smoothstep(0, 0.18)), zenith, elevation.smoothstep(0.12, 0.7))
  const glow = color(hsl.integer(59, 100, 75)).mul(toward.pow(16).mul(0.6).add(toward.pow(90).mul(1.8)))
  const disk = color(hsl.integer(90, 100, 96.3)).mul(toward.smoothstep(0.9985, 0.9993).mul(14))
  const ceiling = d.xz.div(elevation.add(0.08))
  const cloudField = mx_fractal_noise_float(vec3(ceiling.x.mul(0.9).add(time.mul(0.04)), ceiling.y.mul(2.2), time.mul(0.03)), 4, 2.1, 0.55)
  const cloud = cloudField.smoothstep(0.02, 0.38).mul(elevation.smoothstep(0.015, 0.06)).mul(elevation.smoothstep(0.16, 0.34).oneMinus())
  const lining = cloudField.smoothstep(0.02, 0.12).sub(cloudField.smoothstep(0.12, 0.3)).max(0)
  const cloudColor = mix(color(hsl.integer(314, 55, 14)), color(hsl.integer(40, 99, 68)), toward.pow(3).mul(0.8)).add(color(hsl.integer(77, 100, 86.5)).mul(lining).mul(toward.pow(4)).mul(2.2))
  return mix(air, cloudColor, cloud.mul(0.85)).add(glow).add(disk.mul(cloud.oneMinus()))
}
/** A dusk sky over a calm sea that mirrors it, with a shimmering path of sun glitter. */
function duskSky(direction: Node<'vec3'>) {
  const d = direction.normalize()
  const depth = d.y.negate().max(0)
  const waves = d.xz.div(depth.add(0.025))
  const swell = vec3(mx_noise_float(vec3(waves.x.mul(1.5), waves.y.mul(4), time.mul(0.3))), 0, mx_noise_float(vec3(waves.x.mul(1.5).add(9), waves.y.mul(4), time.mul(0.3))))
  const mirrored = vec3(d.x, depth, d.z).add(swell.mul(depth.mul(0.25).add(0.01))).normalize()
  const glitterField = mx_noise_float(vec3(waves.x.mul(6), waves.y.mul(18), time.mul(1.6)))
  const sunPath = mirrored.dot(sun).max(0).pow(18)
  const glitter = glitterField.smoothstep(0.45, 0.75).mul(sunPath).mul(9).add(sunPath.mul(0.4))
  const fresnel = depth.oneMinus().pow(5).mul(0.5).add(0.12)
  const sea = skyDome(mirrored).mul(fresnel).add(color(hsl.integer(69, 99, 82)).mul(glitter)).add(color(hsl.integer(303, 49, 7)).mul(0.12))
  return mix(sea, skyDome(d), d.y.smoothstep(-0.012, 0.012))
}
/**
 * Starling murmuration over a burning dusk. The tube is a lens into an endless evening sky; three strata of birds hang
 * in it at different depths and slide past each other as the visitor moves. The flock flows along the knot, folds into
 * dense dark ribbons, and ripples with waves of banking birds. Step close and the birds nearest to you scatter.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.45)
    this.name = knotData.id
    const tube = uv()
    const {p, distance, facing, grazing} = viewerFrame()
// Sky seen through the lens of the tube: walk around it and the sun wheels across the glass.
    const incident = positionWorld.sub(cameraPosition).normalize()
// A diverging lens: tube tops show the sky, undersides the sea, and the horizon runs through the middle.
    const n = normalWorld.normalize()
    const lensed = incident.add(n.sub(incident.mul(n.dot(incident))).mul(0.9)).normalize()
    const skyColor = duskSky(lensed)
// Flock shape: a folding sheet of birds with dense dark ribbons where it turns edge-on.
    const body = mx_fractal_noise_float(p.mul(1.7).add(vec3(time.mul(0.035), 0, time.mul(-0.02))), 3, 2, 0.5).smoothstep(0, 0.1)
    const fold = mx_noise_float(p.mul(3.3).add(vec3(0, time.mul(0.05), time.mul(0.03)))).abs().oneMinus().pow(5)
    const density = body.mul(fold.mul(0.45).add(0.55))
// Agitation waves roll through the flock: banking birds show their full wings and darken the sheet in moving bands.
    const waveField = p.dot(vec3(0.9, 0.3, 0.4)).mul(9).sub(time.mul(2.4)).add(mx_noise_float(p.mul(2.2)).mul(3))
    const banking = waveField.sin().smoothstep(0.55, 1)
// Step close and the nearest birds scatter; a panic ripple spreads outward from the visitor.
    const startle = ramp(distance, 0.6, 0.36)
    const panic = ramp(distance, 1.5, 0.55)
    const ripple = distance.mul(38).sub(time.mul(6)).sin().smoothstep(0.4, 1).mul(panic).mul(startle.oneMinus())
    const crowding = distance.sub(0.62).div(0.07).pow2().negate().exp().mul(panic)
    const heading = mx_noise_float(p.mul(1.4).add(vec3(5.2, time.mul(0.04), 1.1))).mul(1.3)
    const warpField = vec2(mx_noise_float(p.mul(2.1).add(vec3(0, 0, time.mul(0.07)))), mx_noise_float(p.mul(2.1).add(vec3(7.7, 3.1, time.mul(0.07)))))
    const ray = tubeRay()
    const layers: Array<FlockLayer> = [{
      along: 792,
      around: 88,
      depth: 0.13,
      drift: 0.18,
      seed: 3,
      size: 0.5,
    }, {
      along: 504,
      around: 56,
      depth: 0.06,
      drift: 0.28,
      seed: 2,
      size: 0.52,
    }, {
      along: 288,
      around: 32,
      depth: 0,
      drift: 0.42,
      seed: 1,
      size: 0.54,
    }]
// Thousands more birds too distant to resolve thicken the flock into a smoky body with dark folds.
    const distant = density.pow(1.15).mul(startle.oneMinus()).mul(0.9)
    let composite: Node<'vec3'> = mix(skyColor, skyColor.mul(0.18).add(color(hsl.integer(303, 34, 6)).mul(0.5)), distant)
    for (const [index, layer] of layers.entries()) {
      const period = vec2(layer.along, layer.around)
      const cells = tubeCells(tube, layer.along, layer.around).sub(ray.mul(period).mul(layer.depth))
      const flowing = cells.add(warpField.mul(vec2(3.2, 1.4))).sub(vec2(time.mul(layer.drift * 4), 0))
      const id = flowing.floor()
      const wrapped = wrapCell(id, period)
      const rnd = cellNoiseVec3(vec3(wrapped, layer.seed))
      const rnd2 = cellNoiseVec3(vec3(wrapped, layer.seed + 17.3))
      const footprint = flowing.fwidth().length().max(0.0001)
// Bird frame: centered in its cell, heading with the local flow, wings flapping on its own clock.
      const local = flowing.fract().sub(0.5).sub(rnd.xy.sub(0.5).mul(0.16))
      const bank = banking.mul(0.15).add(ripple.mul(0.2)).add(1)
      const size = rnd2.x.mul(0.1).add(layer.size).mul(bank)
      const q = rotate(local, heading.add(rnd.z.sub(0.5).mul(0.6)).negate()).div(size)
      const flapRate = rnd2.y.mul(4).add(8).add(startle.mul(10))
      const flap = time.mul(flapRate).add(rnd2.z.mul(TAU)).sin()
      const span = flap.abs().mul(0.2).add(0.6)
      const sweep = flap.mul(0.22).sub(0.18)
      const mirroredQ = vec2(q.x, q.y.abs())
      const wing = segment(mirroredQ, vec2(0.08, 0.02), vec2(sweep, span))
      const wingDistance = wing.distance.sub(mix(float(0.1), float(0.035), wing.h))
      const bodyDistance = vec2(q.x.div(0.32), q.y.div(0.1)).length().sub(1).mul(0.1)
      const shape = wingDistance.min(bodyDistance)
      const aa = footprint.div(size).mul(0.7).max(0.0001)
      const crisp = shape.smoothstep(aa.negate(), aa).oneMinus()
// Unresolved birds settle to their mean coverage instead of sparkling.
      const mean = float(0.12).mul(bank.pow2())
      const resolved = footprint.div(size).smoothstep(0.35, 0.8).oneMinus()
      const silhouette = mix(mean, crisp, resolved)
      const gate = density.mul(1.4).add(crowding.mul(0.5)).mul(startle.oneMinus()).sub(rnd2.x).smoothstep(0, 0.08)
      const coverage = silhouette.mul(gate).clamp()
// Aerial perspective: distant strata dissolve into the glow of the sky.
      const haze = [0.5, 0.28, 0][index]
      const birdColor = mix(color(hsl.integer(299, 38, 4)), skyColor.mul(0.55), haze).add(color(hsl.integer(56, 100, 74)).mul(banking.mul(0.05)))
      composite = mix(composite, birdColor, coverage.mul(1 - haze * 0.5))
    }
    this.colorNode = color(hsl.integer(302, 50, 2))
    this.metalness = 0
    this.roughness = 0.35
    this.specularIntensity = 0.25
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.emissiveNode = composite.mul(facing.mul(0.25).add(0.8)).add(color(hsl.integer(63, 100, 79.6)).mul(grazing.pow(4)).mul(0.08))
  }
}
