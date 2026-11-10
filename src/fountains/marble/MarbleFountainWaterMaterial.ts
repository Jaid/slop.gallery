import type {Node} from 'three/webgpu'

import {abs, atan, attribute, color, exp, float, length, max, mix, mod, mx_noise_float, normalLocal, positionGeometry, sqrt, time, uv, vec3} from 'three/tsl'
import {DoubleSide, FrontSide, MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal} from '#src/lib/materials/filters.ts'

import fountain, {jetLanding, sheetLanding} from './config.ts'

type Float = Node<'float'>

const unit = (node: Float) => node.mul(0.5).add(0.5)
const {pools, veils, basinNozzles, lilyJets} = fountain
/** the rim arcs land on a ring in the lower pool, one per octagon corner; the lily jets likewise in the upper pool */
const arcLanding = jetLanding(basinNozzles[0].jet)
const arcLandingRadius = Math.hypot(arcLanding[0], arcLanding[2])
const lilyLanding = jetLanding(lilyJets[0].jet)
const lilyLandingRadius = Math.hypot(lilyLanding[0], lilyLanding[2])
/**
 * Distance from a point in the pool to the nearest of `count` landing spots on a ring of `radius`, the first at `phase`.
 *
 * Folding the angle into one sector lets a single distance stand for all the spots, so every arc’s rings cost as much as one.
 */
function ringDistance(polar: {
  angle: Float
  radius: Float
}, count: number, radius: number, phase: number) {
  const sector = Math.PI * 2 / count
  const local = mod(polar.angle.sub(phase).add(sector / 2), sector).sub(sector / 2)
  return sqrt(polar.radius.mul(polar.radius).add(radius * radius).sub(polar.radius.mul(2 * radius).mul(local.cos())).max(0))
}
/** Rings spreading from a disturbance: a damped wave train leaving at `speed` m/s with crests `wavelength` apart. */
function ripples(distance: Float, amplitude: number, wavelength: number, speed: number, reach: number) {
  return distance.mul(Math.PI * 2 / wavelength).sub(time.mul(Math.PI * 2 * speed / wavelength)).sin().mul(exp(distance.mul(-1 / reach))).mul(amplitude)
}

/**
 * Fountain water, either the still pools or the falling veils, arcs and jet.
 *
 * Pools are clear: in heavy mode they refract the marble under them through their own depth and tint it with the water’s color, and
 * their surface rings outward from where the veils and the arcs land, with a sheen of fine ripples and lines of foam at every
 * impact. Falling water is a thin sheet whose streaks travel at the water’s own speed – its UV v is the age of the water in seconds –
 * and which tears into strands and turns white with air as it falls (`waterFall`, 0 at the lip and 1 at the pool); scalloped lips
 * pour thicker ropes from their troughs (`waterLobe`).
 */
export default class MarbleFountainWaterMaterial extends MeshPhysicalNodeMaterial {
  constructor(falling = false, heavy = true) {
    super({
      color: '#ffffff',
      metalness: 0,
      roughness: falling ? 0.04 : 0.02,
      ior: 1.333,
      transmission: heavy ? 1 : 0,
      // Local thickness that the refracted view is shifted by; the pools’ real depth, and an exaggeration for the thin sheets so their ripples bend what is behind them.
      thickness: falling ? 0.07 : 0.3,
      // Clear water with a faint blue-green cast over its depth; the bowls are shallow, so most of the marble shows through.
      attenuationColor: '#8ccfc3',
      attenuationDistance: falling ? 0.8 : 1.4,
      transparent: falling || !heavy,
      opacity: 1,
      depthWrite: !falling,
      side: falling ? DoubleSide : FrontSide,
      envMapIntensity: heavy ? 1.2 : 0.8,
      clearcoat: falling ? 0 : 1,
      clearcoatRoughness: 0.03,
      specularIntensity: 1,
    })
    this.name = falling ? 'Fountain falling water' : 'Fountain pool water'
    if (falling) {
      const fall = attribute<'float'>('waterFall', 'float')
      const air = attribute<'float'>('waterAir', 'float')
      const lobe = attribute<'float'>('waterLobe', 'float')
      // The azimuth around a veil or a stream as a point on a circle of its girth, so streaks run continuously across the seam and are finer around a wide veil than around a thin stream.
      const around = attribute<'vec2'>('waterAround', 'vec2')
      const emitted = time.sub(uv().y)
      const octaves = (scale: number, speed: number, offset: Float) => mx_noise_float(vec3(around.mul(scale), emitted.mul(speed).add(offset))).mul(0.65)
        .add(mx_noise_float(vec3(around.mul(scale * 2.7).add(7.3), emitted.mul(speed * 1.9).add(offset))).mul(0.35))
        .mul(0.5).add(0.5)
      const streaks = octaves(4.6, 3, float(0))
      // Two scales of tearing, so the strands fray at their edges instead of ending in smooth teeth.
      const tears = octaves(2.6, 5, fall.mul(2)).mul(0.7).add(octaves(8.2, 8, fall.mul(3).add(5)).mul(0.3))
      // The sheet is whole at the lip and frays into strands toward the pool, sooner where a scalloped lip pours thin, and the last strands dissolve into the splash.
      const threshold = fall.pow(1.5).mul(0.8).sub(0.08).sub(lobe.sub(0.5).mul(0.2))
      const coverage = tears.smoothstep(threshold, threshold.add(0.14)).mul(fall.smoothstep(1, 0.9))
      const foam = air.add(streaks.sub(0.5).mul(0.5)).add(lobe.mul(0.12)).clamp()
      // Slow, broad wobble so the curtain never reads as a rigid shell.
      const wobble = mx_noise_float(vec3(around.mul(0.8), emitted.mul(1.3)))
      this.colorNode = mix(color('#d6efe9'), color('#ffffff'), foam)
      this.opacityNode = coverage.mul(mix(float(heavy ? 0.42 : 0.55), float(0.95), foam)).mul(streaks.mul(0.6).add(0.55)).clamp()
      // Only the aerated water scatters; the clear film shows what is behind it.
      this.transmissionNode = heavy ? float(1).sub(foam.mul(0.85)) : float(0)
      this.normalNode = heightNormal(streaks.mul(0.004).add(tears.mul(0.003)).add(wobble.mul(0.006)))
      this.positionNode = positionGeometry.add(normalLocal.mul(streaks.sub(0.5).mul(0.004).add(wobble.mul(fall).mul(0.012))))
      this.roughnessNode = foam.mul(0.35).add(0.03)
      return
    }
    const p = positionGeometry.xz
    const radius = length(p).toVar('poolRadius')
    const angle = atan(p.y, p.x).toVar('poolAngle')
    const polar = {
      angle,
      radius,
    }
    const y = positionGeometry.y
    const isBasin = y.lessThan(pools.basin + 0.05).select(float(1), float(0)).toVar('poolIsBasin')
    const isLower = abs(y.sub(pools.lower)).lessThan(0.05).select(float(1), float(0)).toVar('poolIsLower')
    const isUpper = abs(y.sub(pools.upper)).lessThan(0.05).select(float(1), float(0)).toVar('poolIsUpper')
    // Where the veil above each pool lands, and where the arcs land.
    const veilRing = abs(radius.sub(isBasin.mul(sheetLanding(veils.lower)).add(isLower.mul(sheetLanding(veils.upper))))).toVar('poolFromVeil')
    const fromArc = mix(float(10), ringDistance(polar, basinNozzles.length, arcLandingRadius, basinNozzles[0].angle), isLower).toVar('poolFromArc')
    const fromLily = mix(float(10), ringDistance(polar, lilyJets.length, lilyLandingRadius, lilyJets[0].angle), isUpper).toVar('poolFromLily')
    const fromJet = mix(float(10), radius, isUpper)
    const veilRipples = ripples(veilRing, 0.004, 0.14, 0.9, 0.3).mul(isBasin.add(isLower))
    const arcRipples = ripples(fromArc, 0.005, 0.07, 0.7, 0.16)
    const lilyRipples = ripples(fromLily, 0.0012, 0.04, 0.5, 0.07)
    const jetRipples = ripples(fromJet, 0.0025, 0.06, 0.6, 0.12)
    // A sheen of small wind-and-splash ripples, drifting, and a faint flow toward each bowl’s lip.
    const grain = mx_noise_float(vec3(p.mul(9), time.mul(0.6)))
    const sheen = mx_noise_float(vec3(p.mul(28).add(time.mul(0.4)), time.mul(1.1))).mul(0.0006)
      .add(p.x.mul(9).add(p.y.mul(5)).sub(time.mul(1.7)).sin().mul(0.0016))
      .add(p.x.mul(-6).add(p.y.mul(11)).sub(time.mul(2.3)).sin().mul(0.0012))
    const flow = radius.mul(70).sub(time.mul(5)).sin().mul(0.0005).mul(isBasin.oneMinus())
    const height = veilRipples.add(arcRipples).add(lilyRipples).add(jetRipples).add(sheen).add(flow).add(grain.mul(0.0004)).toVar('poolHeight')
    // Foam gathers where the water hits, torn into patches by the grain and drifting off with it.
    const churn = unit(mx_noise_float(vec3(p.mul(14), time.mul(0.9)))).smoothstep(0.3, 0.8)
    const foam = max(
      max(exp(veilRing.mul(-22)).mul(isBasin.add(isLower)), exp(fromArc.mul(-16)).mul(1.2)),
      max(exp(fromLily.mul(-40)), exp(fromJet.mul(-14)).mul(isUpper)),
    ).mul(churn.mul(0.6).add(0.4)).mul(0.9).clamp().toVar('poolFoam')
    // Ring crests catch a little light even where the reflected room is uniform.
    const crest = height.div(0.004).clamp(-1, 1).mul(0.5).add(0.5).mul(exp(veilRing.min(fromArc).mul(-5))).mul(0.12)
    // In heavy mode the color only tints what shows through the water; in fast mode it stands in for the marble under it.
    this.colorNode = mix(color(heavy ? '#f2f9f7' : '#5aa89d'), color('#f6fcfa'), foam.add(crest).clamp())
    // Clear water shows the marble through it; foam is opaque.
    this.transmissionNode = heavy ? float(1).sub(foam.mul(0.95)) : float(0)
    this.opacityNode = heavy ? float(1) : float(0.62).add(foam.mul(0.38))
    this.normalNode = heightNormal(height)
    this.roughnessNode = foam.mul(0.35).add(0.02)
    this.clearcoatRoughnessNode = foam.mul(0.3).add(0.03)
  }
}
