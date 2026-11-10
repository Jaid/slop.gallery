import type {LashingTendril} from './flights.ts'
import type {Node} from 'three/webgpu'

import {attribute, cameraPosition, cross, exp, float, mix, modelPosition, mx_noise_float, positionGeometry, select, sin, smoothstep, uv, vec2, vec3} from 'three/tsl'
import {PlaneGeometry} from 'three/webgpu'

import {coverage, rgb} from '#src/orbs/lib/fill.ts'

import {partyPoint} from '../lib/billboards.ts'
import EffectSprites, {instanceAttribute} from '../lib/EffectSprites.ts'
import {lashing, snapping} from './flights.ts'

/** how many segments a tendril’s ribbon bends in along its length */
const segments = 40
/** how far its ribbon reaches to either side of its line, in its radii, with room for its outline’s antialiasing */
const margin = 1.2
/** how far apart the suckers along its underside are, in meters */
const suckerSpacing = 0.045
const fleshColors = {
  dark: rgb('#3e070d'),
  light: rgb('#9a2f35'),
  tip: rgb('#22050a'),
  vein: rgb('#2a0a26'),
  sucker: rgb('#d88a86'),
  shine: rgb('#fff2f0'),
}
/** eases from 0 to 1 as `progress` goes from 0 to 1, overshooting a little before it settles */
function overshoot(progress: Node<'float'>) {
  const left = progress.clamp(0, 1).sub(1)
  return left.mul(left).mul(left).mul(2.7).add(left.mul(left).mul(1.7)).add(1)
}

/**
 * Fleshy tendrils lashing out of their origin: each shoots out of it the way the site faces, overshooting, and writhes there, waves running along it, its tip hooking and groping about while a swelling pulses along it toward its tip, until it snaps back into the origin. Wet, veined flesh with a row of suckers along its underside, animated entirely on the GPU by the clock, each a ribbon bending along its length, turned toward the camera around its line.
 */
export default class WrithingTendrils extends EffectSprites {
  constructor(tendrils: ReadonlyArray<LashingTendril>) {
    const geometry = new PlaneGeometry(1, 1, 1, segments)
    instanceAttribute(geometry, 'tendrilTimes', tendrils.map(({delay, phase, retract, width}) => [delay, retract, phase, width]))
    instanceAttribute(geometry, 'tendrilPath', tendrils.map(({angle, curl, length, out}) => [angle, out, length, curl]))
    super('party-tendrils', geometry, tendrils.length, {toneMapped: true})
    const {material} = this
    const {clock, normal, tangent} = this.uniforms
    const times = attribute<'vec4'>('tendrilTimes', 'vec4')
    const path = attribute<'vec4'>('tendrilPath', 'vec4')
    const [delay, retract, phase, width] = [times.x, times.y, times.z, times.w]
    const [angle, out, length, curl] = [path.x, path.y, path.z, path.w]
    const age = clock.sub(delay)
    const since = age.max(0)
    // How far out it is: it lashes out, overshooting, and snaps back ever faster.
    const back = clock.sub(retract).div(snapping).clamp(0, 1)
    const extension = overshoot(since.div(lashing)).mul(float(1).sub(back.mul(back)))
    const reach = partyPoint(tangent, normal, angle.cos().mul(float(1).sub(out)), angle.sin().mul(float(1).sub(out)), out).normalize()
    const sideways = cross(reach, vec3(0, 1, 0)).normalize()
    const upward = cross(sideways, reach)
    const writhing = clock.add(phase.mul(10))
    const amplitude = length.mul(0.09)
    // Where along its line a share of its length lies, writhing and hooking at its tip, sagging a little.
    const bent = (share: Node<'float'>) => {
      const reaching = share.pow(1.2)
      const wave = sin(share.mul(7).sub(writhing.mul(9))).mul(amplitude).mul(reaching)
      const sway = sin(share.mul(5).sub(writhing.mul(6.5)).add(phase.mul(12))).mul(amplitude.mul(0.8)).mul(reaching)
      const hook = curl.mul(share.pow(3)).mul(length).mul(sin(writhing.mul(2)).mul(0.4).add(0.6))
      const sag = share.mul(share).mul(length).mul(0.12).mul(float(1).sub(out))
      return reach.mul(share.mul(length)).add(sideways.mul(wave).add(upward.mul(sway.add(hook))).sub(vec3(0, sag, 0))).mul(extension).add(normal.mul(0.04))
    }
    const share = positionGeometry.y.add(0.5)
    const point = bent(share)
    const along = bent(share.add(0.01)).sub(point).normalize()
    // A swelling pulses along it toward its tip.
    const swelling = smoothstep(0.09, 0, share.sub(writhing.mul(0.9).fract()).abs()).mul(0.2).add(1)
    // It swells into a knot of flesh where it comes out of the origin.
    const root = smoothstep(0.14, 0, share).mul(0.6).add(1)
    const thickness = width.mul(0.5).mul(float(1).sub(share).max(0).pow(0.55).mul(0.92).add(0.08)).mul(root).mul(swelling).mul(extension.mul(0.5).add(0.5))
    const side = cross(cameraPosition.sub(modelPosition.add(point)), along).normalize()
    const placed = point.add(side.mul(positionGeometry.x.mul(thickness).mul(margin * 2)))
    material.positionNode = select(age.greaterThan(0), placed, vec3(0, 0, 0))
    // Across it, in its radii: a round, wet body lit from above, darker at its edges and toward its tip.
    const across = uv().x.sub(0.5).mul(margin * 2)
    const lengthwise = uv().y
    const meters = lengthwise.mul(length).mul(extension)
    const depth = float(1).sub(across.mul(across)).max(0).sqrt()
    const light = vec2(across, depth).dot(vec2(-0.45, 0.89)).max(0).mul(0.75).add(0.25)
    const veins = float(1).sub(mx_noise_float(vec3(across.mul(2.2), meters.mul(9), phase.mul(7))).abs().mul(9)).max(0).pow(2)
    const cell = meters.div(suckerSpacing).fract().sub(0.5)
    const suckerSize = float(1).sub(lengthwise).mul(0.32).add(0.08)
    const sucker = vec2(across.sub(0.55).div(0.45), cell).length().div(suckerSize.mul(1.6))
    const suckerRing = smoothstep(1, 0.75, sucker).mul(smoothstep(0.35, 0.6, sucker))
    const suckerHole = smoothstep(0.45, 0.25, sucker)
    const shine = exp(across.add(0.38).div(0.13).pow2().negate()).mul(mx_noise_float(vec3(meters.mul(14), phase.mul(3), 0.5)).smoothstep(-0.2, 0.5))
    const flesh = mix(fleshColors.dark, fleshColors.light, light)
    const skin = mix(mix(flesh, fleshColors.vein, veins.mul(0.6)), fleshColors.tip, smoothstep(0.55, 1, lengthwise).mul(0.7)).mul(depth.mul(0.5).add(0.5))
    const color = mix(mix(skin, fleshColors.sucker, suckerRing.mul(0.85)), fleshColors.dark.mul(0.4), suckerHole).add(fleshColors.shine.mul(shine).mul(0.3))
    const presence = select(age.greaterThan(0), smoothstep(0, 0.04, age).mul(smoothstep(0.98, 0.85, back)), float(0))
    material.colorNode = color
    material.opacityNode = coverage(float(1).sub(across.abs())).mul(presence)
  }
}
