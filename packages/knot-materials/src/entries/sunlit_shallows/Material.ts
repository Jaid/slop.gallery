import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, normalWorld, positionWorld, refract, time, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {knotFrame} from '../../candidates/claude_opus/lib/knotFrameSurface.ts'
import {localDirection, worldDirection} from '../../candidates/claude_opus/lib/localDirection.ts'
import {knotCircumference, knotLength, tubeMetric} from '../../candidates/claude_opus/lib/tubeMetric.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const waterIndex = 1.333
type Wave = {
  amplitude: number
  k: [number, number]
  omega: number
  phase: number
}
/** Sum-of-sines swell on the tube’s arc-length coordinates; wave numbers are whole cycles around and along, so the surface closes over both seams. */
const makeWaves = (specs: Array<[number, number, number]>, slope: number, speed: number): Array<Wave> => specs.map(([degrees, wavelength, weight], index) => {
  const angle = degrees * Math.PI / 180
  const m = Math.round(knotLength * Math.cos(angle) / wavelength)
  const n = Math.round(knotCircumference * Math.sin(angle) / wavelength)
  const k: [number, number] = [TAU * m / knotLength, TAU * n / knotCircumference]
  const magnitude = Math.hypot(...k)
  return {
    k,
    amplitude: slope * weight / magnitude,
    omega: Math.sqrt(magnitude) * speed,
    phase: index * 2.399,
  }
})
const swell = makeWaves([[12, 0.23, 1], [78, 0.19, 0.85], [-38, 0.16, 0.75], [128, 0.13, 0.6], [27, 0.1, 0.45], [-74, 0.11, 0.45], [158, 0.085, 0.35], [52, 0.07, 0.3]], 0.085, 0.6)
const ripples = makeWaves([[33, 0.03, 1], [-61, 0.026, 1], [101, 0.022, 0.9], [-5, 0.019, 0.8]], 0.16, 0.9)
/** Height gradient and Hessian (xx, yy, xy) of a wave train at arc-length coordinates `x`. */
function waveField(x: Node<'vec2'>, waves: Array<Wave>) {
  let gradient: Node<'vec2'> = vec2(0)
  let hessian: Node<'vec3'> = vec3(0)
  for (const wave of waves) {
    const k = vec2(...wave.k)
    const phase = x.dot(k).sub(time.mul(wave.omega)).add(wave.phase)
    gradient = gradient.add(k.mul(phase.cos().mul(wave.amplitude)))
    hessian = hessian.sub(vec3(wave.k[0] * wave.k[0], wave.k[1] * wave.k[1], wave.k[0] * wave.k[1]).mul(phase.sin().mul(wave.amplitude)))
  }
  return {
    gradient,
    hessian,
  }
}
/**
 * Caustic irradiance on the floor: light refracted by the swell lands at x + D·∇h, so the energy density is
 * 1 / |det(I + D·H)|. One fixed-point step finds which part of the surface lit a floor point.
 */
function caustic(floor: Node<'vec2'>, spread: Node<'float'>) {
  const source = floor.sub(waveField(floor, swell).gradient.mul(spread))
  const h = waveField(source, swell).hessian
  const determinant = h.x.mul(spread).add(1).mul(h.y.mul(spread).add(1)).sub(h.z.mul(spread).pow2())
  return determinant.abs().add(0.06).reciprocal()
}
/**
 * Shallow water over rippled sand. The swell is a real height field: it bends the view of the bottom, focuses noon
 * light into caustic nets with rainbow fringes from dispersion, and reflects the gallery. Seen straight down it is a
 * window; toward the silhouette Fresnel turns it into a mirror and the deeper channels go teal.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing} = viewerFrame()
    const frame = knotFrame(tube)
    const n = normalLocal.normalize()
    const surface = tubeMetric(tube)
// Sandbars and channels: the water depth changes along the knot.
    const depth = mx_fractal_noise_float(p.mul(2.1).add(7.3), 2, 2, 0.5).smoothstep(-0.25, 0.3).oneMinus().mul(0.045).add(0.018)
// The swell at the surface, as a tangent vector in object space.
    const surfaceSwell = waveField(surface, swell)
    const surfaceRipples = waveField(surface, ripples)
    const slope = frame.along.mul(surfaceSwell.gradient.x).add(frame.around.mul(surfaceSwell.gradient.y))
    const fineSlope = frame.along.mul(surfaceRipples.gradient.x).add(frame.around.mul(surfaceRipples.gradient.y))
    const waterNormal = n.sub(slope).normalize()
// View ray refracted through the wavy surface down to the bottom.
    const refracted = refract(view.negate(), waterNormal, float(1 / waterIndex)).normalize()
    const descent = refracted.dot(n).negate().max(0.2)
    const travel = refracted.sub(n.mul(refracted.dot(n))).mul(depth.div(descent))
    const floor3 = p.add(travel).sub(n.mul(depth))
    const floor = surface.add(vec2(travel.dot(frame.along), travel.dot(frame.around)))
// Caustics with dispersion: red focuses a little deeper than blue, fringing every bright seam.
    const spread = depth.mul(4.2)
    const light = vec3(caustic(floor, spread.mul(0.965)), caustic(floor, spread), caustic(floor, spread.mul(1.04)))
    const sunAngle = normalWorld.y.smoothstep(-0.7, 0.8).mul(0.75).add(0.25)
// Sand ripple marks with asymmetric crests, scattered pebbles and shell grit.
    const rippleAxis = vec3(0.3, 0.8, -0.5).normalize()
    const ripplePhase = floor3.dot(rippleAxis).mul(95).add(mx_noise_float(floor3.mul(6)).mul(3.2))
    const ripple = ripplePhase.sin().mul(0.5).add(0.5).pow(1.6)
    const rippleResolved = ripplePhase.fwidth().smoothstep(0.8, 2.5).oneMinus()
    const grain = mx_noise_float(floor3.mul(420)).mul(0.5).add(0.5)
    const grainResolved = floor3.mul(420).fwidth().length().smoothstep(0.4, 1.2).oneMinus()
    const pebbleCell = floor3.mul(55)
    const pebbleRandom = cellNoiseVec3(pebbleCell.floor())
    const pebble = pebbleCell.fract().sub(pebbleRandom.mul(0.5).add(0.25)).length().smoothstep(0.06, pebbleRandom.z.mul(0.12).add(0.1)).oneMinus().mul(pebbleRandom.x.smoothstep(0.78, 0.82))
    const pebbleColor = mix(color(hsl.integer(65, 25, 33)), color(hsl.integer(88, 26, 90)), pebbleRandom.y)
    const patches = mx_fractal_noise_float(floor3.mul(9), 3, 2, 0.5).mul(0.5).add(0.5)
    const sand = mix(color(hsl.integer(83, 47, 79)), color(hsl.integer(87, 70, 95.3)), patches).mul(ripple.sub(0.5).mul(0.3).mul(rippleResolved).add(1)).mul(grain.mul(0.18).mul(grainResolved).add(0.91))
// Dark weed beds and stones gather in the deeper channels.
    const weedField = mx_fractal_noise_float(floor3.mul(18).add(vec3(0, time.mul(0.05), 0)), 3, 2, 0.5)
    const weed = weedField.smoothstep(0.15, 0.32).mul(depth.smoothstep(0.035, 0.055))
    const weedColor = mix(color(hsl.integer(128, 60, 16)), color(hsl.integer(122, 76, 35)), weedField.mul(0.5).add(0.5))
    const bottom = mix(mix(sand, weedColor, weed), pebbleColor, pebble)
// Light that reaches the bottom and comes back: absorption along both legs, red first.
    const path = depth.mul(descent.reciprocal().add(1))
    const transmittance = path.mul(vec3(6.5, 1.7, 1.05)).negate().exp()
    const inscatter = transmittance.oneMinus().mul(color(hsl.integer(209, 91, 61))).mul(0.4)
// Ripple crests catch the focused light; troughs lie in their shadow.
    const crestLight = ripple.mul(0.5).mul(rippleResolved).add(0.75)
    const sunlit = bottom.mul(light.pow(1.25)).mul(crestLight).mul(sunAngle)
// Motes of plankton drifting at mid-depth catch the beams.
    const moteSpace = p.add(travel.mul(0.5)).mul(140).add(vec3(time.mul(0.1), time.mul(0.06), 0))
    const moteRandom = cellNoiseVec3(moteSpace.floor())
    const mote = moteSpace.fract().sub(moteRandom.mul(0.6).add(0.2)).length().smoothstep(0.02, 0.09).oneMinus().mul(moteRandom.y.smoothstep(0.9, 0.93))
      .mul(moteSpace.fwidth().length().smoothstep(0.15, 0.5).oneMinus())
// Sun glitter on the surface wavelets, only where the eye catches the reflected sun.
    const sun = localDirection([0.25, 0.92, 0.3])
    const glitterNormal = waterNormal.sub(fineSlope).normalize()
    const glitter = view.negate().reflect(glitterNormal).dot(sun).max(0).pow(900).mul(18)
    const incident = positionWorld.sub(cameraPosition).normalize()
    const skyward = incident.reflect(worldDirection(glitterNormal)).y.smoothstep(-0.1, 0.6)
// Skylight alone leaves the bottom in soft shade; the sun’s caustics carry the light.
    this.colorNode = bottom.mul(transmittance).mul(0.22).add(inscatter.mul(0.5))
    this.metalness = 0
    this.roughness = 0.9
    this.specularIntensity = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.015
    this.clearcoatNormalNode = transformNormalToView(waterNormal.sub(fineSlope.mul(0.5)).normalize())
    this.emissiveNode = sunlit.mul(transmittance).mul(color(hsl.integer(87, 100, 95.5))).mul(0.62)
      .add(inscatter.mul(light.y.mul(0.5)).mul(0.6))
      .add(color(hsl.integer(91, 100, 97)).mul(mote).mul(light.y.mul(0.3).add(0.4)))
      .add(color(hsl.integer(87, 100, 97.7)).mul(glitter).mul(facing.oneMinus().mul(0.6).add(0.4)).mul(skyward.mul(0.5).add(0.5)))
  }
}
