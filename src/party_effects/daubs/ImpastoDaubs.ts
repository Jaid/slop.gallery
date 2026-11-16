import type {PaletteDaub} from './flights.ts'
import type {Node} from 'three/webgpu'

import {attribute, exp, float, max, mix, mx_noise_float, positionGeometry, select, smoothstep, uv, vec2, vec3} from 'three/tsl'
import {PlaneGeometry} from 'three/webgpu'

import {paintColor} from '#src/lib/materials/oilPaints.ts'
import {coverage} from '#src/orbs/lib/fill.ts'

import {partyPoint, screenAxes} from '../lib/billboards.ts'
import EffectSprites, {instanceAttribute} from '../lib/EffectSprites.ts'

type Float = Node<'float'>

/** how strongly the normalized UV surface gradient tilts the normal */
const relief = 0.42
/** raking light from above and slightly right */
const light = vec3(0.42, 0.88, 0.36).normalize()

/**
 * Thick palette-knife scoops of unmixed oil paint burst out around the portal, each turning gently in view as it floats forward, its sculpted trowel mound and lifted crest catching sharp wet-oil highlights before crusting and flaking away.
 */
export default class ImpastoDaubs extends EffectSprites {
  constructor(daubs: ReadonlyArray<PaletteDaub>) {
    const geometry = new PlaneGeometry(1, 1)
    instanceAttribute(geometry, 'daubTimes', daubs.map(({delay, flight, life, phase}) => [delay, flight, life, phase]))
    instanceAttribute(geometry, 'daubMotion', daubs.map(({angle, reach, out}) => [angle, reach[0], reach[1], out[0]]))
    instanceAttribute(geometry, 'daubShape', daubs.map(({out, size, tilt}) => [out[1], ...size, tilt]))
    instanceAttribute(geometry, 'daubStyle', daubs.map(({paint, spin}) => [spin, paint[0], paint[1]]))
    super('party-daubs', geometry, daubs.length)
    const {material} = this
    const {clock, normal, tangent} = this.uniforms
    const times = attribute<'vec4'>('daubTimes', 'vec4')
    const motion = attribute<'vec4'>('daubMotion', 'vec4')
    const shape = attribute<'vec4'>('daubShape', 'vec4')
    const style = attribute<'vec3'>('daubStyle', 'vec3')
    const [delay, flight, life, phase] = [times.x, times.y, times.z, times.w]
    const [angle, startReach, endReach, startOut] = [motion.x, motion.y, motion.z, motion.w]
    const [endOut, width, height, tilt] = [shape.x, shape.y, shape.z, shape.w]
    const [spin, primaryPaint, secondaryPaint] = [style.x, style.y, style.z]
    const age = clock.sub(delay)
    const since = age.max(0)
    const share = since.div(flight).clamp(0, 1)
    const eased = float(1).sub(float(1).sub(share).pow(3))
    const distance = mix(startReach, endReach, eased)
    const upOffset = max(float(-0.85), angle.sin().mul(distance))
    const outOffset = mix(startOut, endOut, eased).add(max(float(0), since.sub(flight)).mul(0.08))
    const center = partyPoint(tangent, normal, angle.cos().mul(distance), upOffset, outOffset)
    const roll = tilt.add(spin.mul(since))
    const axes = screenAxes(roll)
    const pop = smoothstep(0, 0.08, since).mul(0.35).add(0.65)
    const placed = center.add(axes.right.mul(positionGeometry.x.mul(width).mul(pop))).add(axes.up.mul(positionGeometry.y.mul(height).mul(pop)))
    material.positionNode = select(age.greaterThan(0).and(age.lessThan(life)), placed, vec3(0, 0, 0))
    const local = uv().sub(0.5).mul(2)
    // Organic pointed palette-knife scoop shape: rounded heel on the left, curved trowel crest, tapered point on the right.
    const warp = mx_noise_float(vec3(local.x.mul(2.4), local.y.mul(2.4), phase.mul(27))).mul(0.14)
    const widthAt = float(1).sub(local.x.add(0.15).mul(0.55).clamp(0, 1).pow(1.6)).mul(0.75).add(0.22)
    const scoop = vec2(local.x.mul(1.05), local.y.div(widthAt)).length().sub(0.78).sub(warp)
    const slabHeight = (u: Float, v: Float) => {
      const w = float(1).sub(u.add(0.15).mul(0.55).clamp(0, 1).pow(1.6)).mul(0.75).add(0.22)
      const r = vec2(u.mul(1.05), v.div(w)).length().div(0.78).clamp(0, 1)
      const mound = float(1).sub(r.pow2()).max(0).pow(0.75).mul(0.9)
      // Curved asymmetric knife ridge near u ≈ 0.25 and a gentle bevel along the trowel curve.
      const ridge = exp(u.sub(0.22).add(v.pow2().mul(0.35)).div(0.2).pow2().negate()).mul(0.65).mul(float(1).sub(r.pow2()).max(0))
      const grain = mx_noise_float(vec3(u.mul(2.5), v.mul(6.5), phase.mul(19))).mul(0.1)
      return mound.add(ridge).add(grain)
    }
    const surface = slabHeight(local.x, local.y)
    const dU = slabHeight(local.x.add(0.05), local.y).sub(surface).div(0.05)
    const dV = slabHeight(local.x, local.y.add(0.05)).sub(surface).div(0.05)
    const facing = vec3(dU.mul(-relief), dV.mul(-relief), 1).normalize()
    // Rich single-sweep marbled blend of two unmixed pigments along the knife curve (no stripes).
    const swirl = mx_noise_float(vec3(local.x.mul(1.8), local.y.mul(2.2), phase.mul(31)))
    const paint = mix(paintColor(primaryPaint), paintColor(secondaryPaint), smoothstep(-0.1, 0.35, swirl.add(local.y.mul(0.6))))
    const tone = mx_noise_float(vec3(local.x.mul(2), local.y.mul(2), phase.mul(13))).mul(0.1).add(0.98)
    const drying = smoothstep(life.mul(0.62), life, age)
    const wet = float(1).sub(drying)
    const bevel = smoothstep(-0.08, -0.35, scoop).mul(0.35).add(0.65)
    const lit = max(facing.dot(light), 0).mul(0.95).add(0.28)
    const halfway = light.add(vec3(0, 0, 1)).normalize()
    const gloss = max(facing.dot(halfway), 0).pow(36).mul(0.9).add(max(facing.dot(halfway), 0).pow(10).mul(0.15)).mul(wet)
    material.colorNode = paint.mul(tone).mul(lit).mul(bevel).add(vec3(gloss))
    const flakes = mx_noise_float(vec3(local.x.mul(7), local.y.mul(7), phase.mul(41))).mul(0.5).add(0.5)
    const crumble = select(drying.lessThanEqual(0), float(1), smoothstep(drying.mul(1.2).sub(0.12), drying.mul(1.2).add(0.06), flakes))
    const alive = age.greaterThan(0).and(age.lessThan(life))
    material.opacityNode = select(alive, coverage(scoop.negate()).mul(crumble), float(0))
  }
}
