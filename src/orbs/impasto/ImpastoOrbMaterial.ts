import type {OrbFill, OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import {Break, cross, float, If, Loop, mix, mx_cell_noise_float, mx_noise_float, normalize, select, smoothstep, time, vec3} from 'three/tsl'

import {oilPaints} from '#src/lib/materials/oilPaints.ts'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {rgb, spinAroundY} from '../lib/fill.ts'

/** the most steps the march takes toward the impasto core */
const steps = 96
/** shortest and longest step size, in radii of the orb */
const stride = [0.0025, 0.03] as const
/** step offset when sampling the sculpted surface gradient */
const normalStep = 0.004
/** warm raking light from above-right */
const keyLight = normalize(vec3(0.45, 0.86, 0.42))
/** warm amber bounce from below-left */
const bounceLight = normalize(vec3(-0.45, -0.7, -0.35))
/** bold, unmuddy oil pigments */
const pigments = [
  oilPaints.cadmiumYellow,
  oilPaints.vermilion,
  oilPaints.titaniumWhite,
  oilPaints.ultramarine,
  oilPaints.viridian,
  '#e3941c',
  '#b53b16',
].map(rgb)
/** Picks one of the impasto pigments for a stroke id and layer. */
function pigmentOf(id: Node<'vec3'>, layer: number) {
  const index = mx_cell_noise_float(id.add(vec3(layer * 13.7, layer * 7.3, layer * 19.1))).mul(pigments.length).floor()
  let pigment: Node<'vec3'> = pigments[0]
  for (const [order, color] of pigments.entries()) {
    if (order) {
      pigment = select(index.greaterThanEqual(order), color, pigment)
    }
  }
  return pigment
}
/**
 * One sculpted layer of broad, overlapping palette-knife sweeps along `axisB`: smooth buttery wedges that rise toward a single lifted knife crest (`t ≈ 0.78`) and taper cleanly at their ends without periodic ribs or hollow caps.
 */
function knifeSweep(q: Node<'vec3'>, axisA: Node<'vec3'>, axisB: Node<'vec3'>, scale: number, family: number) {
  const u = q.dot(axisA).mul(scale).add(q.dot(axisB).mul(1.15).sin().mul(0.6))
  const v = q.dot(axisB).mul(scale * 0.48).add(q.dot(axisA).mul(0.85).cos().mul(0.4))
  const phase = u.div(Math.PI)
  const acrossCell = phase.floor()
  const t = phase.fract()
  // Smooth asymmetric knife sweep: shallow concave belly rising to one crisp bevel crest.
  const ramp = t.div(0.78).clamp(0, 1).pow(1.25)
  const cliff = float(1).sub(t.sub(0.78).div(0.22).clamp(0, 1).pow(1.35))
  const profile = select(t.lessThan(0.78), ramp, cliff)
  const alongPhase = v.add(mx_cell_noise_float(vec3(acrossCell, family, 3.1)).mul(2.5))
  const alongCell = alongPhase.floor()
  const alongT = alongPhase.fract()
  const lengthEnvelope = alongT.mul(Math.PI).sin().max(0).pow(0.6)
  const height = profile.mul(lengthEnvelope)
  return {
    acrossT: t,
    axisB,
    flowAlong: v,
    flowAcross: u,
    height,
    id: vec3(acrossCell, alongCell, family),
  }
}
/**
 * Signed distance to the swirling sculptural impasto mass inside the orb.
 * Kept within radius ~0.55 so the ~1.48 refractive oil shell leaves a crisp curved glass rim around the sculpted paint.
 */
function impastoField(point: Node<'vec3'>) {
  const swirled = spinAroundY(point, time.mul(0.08).add(point.length().oneMinus().mul(1.25)))
  const warp = vec3(
    swirled.y.mul(2.2).add(swirled.z.mul(1.8)).sin(),
    swirled.z.mul(2).sub(swirled.x.mul(1.9)).cos(),
    swirled.x.mul(2.4).add(swirled.y.mul(1.6)).sin(),
  ).mul(0.14)
  const q = swirled.add(warp)
  const a = knifeSweep(q, normalize(vec3(0.84, 0.44, 0.31)), normalize(vec3(-0.35, 0.88, -0.32)), 3.8, 1)
  const b = knifeSweep(q, normalize(vec3(-0.44, 0.6, 0.67)), normalize(vec3(0.72, -0.35, 0.6)), 3.4, 2)
  const abPick = a.height.greaterThan(b.height.mul(0.95))
  const relief = a.height.max(b.height.mul(0.95))
  const pick = <T extends Node>(valA: T, valB: T): T => select(abPick, valA, valB) as T
  return {
    acrossT: pick(a.acrossT, b.acrossT),
    axisB: pick(a.axisB, b.axisB),
    distance: point.length().sub(float(0.42).add(relief.mul(0.18))),
    flowAcross: pick(a.flowAcross, b.flowAcross),
    flowAlong: pick(a.flowAlong, b.flowAlong),
    id: pick(a.id, b.id),
    relief,
  }
}

/**
 * Heavy, sculptural palette-knife sweeps of unmixed oil paint floating inside clear golden oil, lit with dramatic raking chiaroscuro highlights along every lifted knife crest.
 */
export default class ImpastoOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-impasto',
      fillIor: 1.48,
      tint: '#f3d38b',
    })
  }

  protected override fill(ray: OrbRay): OrbFill {
    const hit = float(0).toVar('impastoHit')
    const depth = ray.jitter.mul(stride[0]).toVar('impastoDepth')
    const previous = float(1).toVar('impastoPrevious')
    const previousDepth = float(0).toVar('impastoPreviousDepth')
    Loop({
      start: 0,
      end: steps,
      type: 'int',
    }, () => {
      If(depth.greaterThan(ray.length), () => {
        Break()
      })
      const {distance} = impastoField(ray.origin.add(ray.direction.mul(depth)))
      If(distance.lessThan(0), () => {
        const back = distance.negate().div(previous.sub(distance).max(1e-4)).clamp(0, 1)
        depth.assign(depth.sub(back.mul(depth.sub(previousDepth))))
        hit.assign(1)
        Break()
      })
      previous.assign(distance)
      previousDepth.assign(depth)
      depth.addAssign(distance.mul(0.45).clamp(stride[0], stride[1]))
    })
    const low = depth.sub(stride[1] * 0.5).max(0).toVar('impastoLow')
    const high = depth.add(stride[0]).min(ray.length).toVar('impastoHigh')
    If(hit.greaterThan(0.5), () => {
      Loop({
        start: 0,
        end: 4,
        type: 'int',
      }, () => {
        const mid = low.add(high).mul(0.5)
        const d = impastoField(ray.origin.add(ray.direction.mul(mid))).distance
        If(d.lessThan(0), () => {
          high.assign(mid)
        }).Else(() => {
          low.assign(mid)
        })
      })
      depth.assign(low.add(high).mul(0.5))
    })
    const point = ray.origin.add(ray.direction.mul(depth)).toVar('impastoPoint')
    const {acrossT, axisB, distance, flowAcross, flowAlong, id, relief} = impastoField(point)
    const macroNormal = vec3(
      impastoField(point.add(vec3(normalStep, 0, 0))).distance.sub(distance),
      impastoField(point.add(vec3(0, normalStep, 0))).distance.sub(distance),
      impastoField(point.add(vec3(0, 0, normalStep))).distance.sub(distance),
    ).normalize().toVar('impastoMacroNormal')
    // Subtle, silky brush/knife striations stretched along the stroke sweep.
    const tangentAlong = axisB.sub(macroNormal.mul(macroNormal.dot(axisB))).normalize()
    const tangentAcross = cross(macroNormal, tangentAlong).normalize()
    const seed = id.x.mul(3.17).add(id.y.mul(7.43)).add(id.z.mul(13.1))
    const striation = (u: Node<'float'>, v: Node<'float'>) => mx_noise_float(vec3(u.mul(1.8), v.mul(9), seed)).mul(0.6).add(mx_noise_float(vec3(u.mul(4), v.mul(18), seed.add(5.3))).mul(0.4))
    const s0 = striation(flowAlong, flowAcross)
    const dAlong = striation(flowAlong.add(0.03), flowAcross).sub(s0).div(0.03)
    const dAcross = striation(flowAlong, flowAcross.add(0.03)).sub(s0).div(0.03)
    const normal = macroNormal.sub(tangentAlong.mul(dAlong.mul(0.04))).sub(tangentAcross.mul(dAcross.mul(0.08))).normalize().toVar('impastoNormal')
    // Each broad sweep carries one dominant pigment with a single soft unmixed blend toward its edge (no striped banding).
    const blendNoise = mx_noise_float(vec3(flowAlong.mul(0.85), flowAcross.mul(0.85), seed.add(2.1)))
    const streakMask = smoothstep(0.15, 0.72, blendNoise.add(acrossT.sub(0.35)))
    const strokeColor = mix(pigmentOf(id, 1), pigmentOf(id, 2), streakMask)
    const crest = smoothstep(0.72, 0.96, relief)
    const crevice = smoothstep(0.04, 0.42, relief).mul(0.55).add(0.45)
    const paint = mix(strokeColor, rgb('#faf4e4'), crest.mul(0.24))
    const keyDiffuse = normal.dot(keyLight).max(0).mul(0.82).add(0.18)
    const bounce = normal.dot(bounceLight).max(0).mul(0.24)
    const lit = paint.mul(keyDiffuse).add(paint.mul(rgb('#f0ad4e')).mul(bounce)).mul(crevice)
    const halfway = keyLight.sub(ray.direction).normalize()
    const gloss = normal.dot(halfway).max(0).pow(48).mul(0.7).add(normal.dot(halfway).max(0).pow(14).mul(0.12))
    const depthShade = depth.mul(-0.2).exp()
    return {
      radiance: lit.mul(depthShade).add(vec3(gloss)).mul(hit),
      transmittance: hit.oneMinus(),
    }
  }
}
