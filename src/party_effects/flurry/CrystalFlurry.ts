import {float, hash, instanceIndex, mix, positionGeometry, select, uv, vec3} from 'three/tsl'
import {PlaneGeometry} from 'three/webgpu'

import {crystalSector, stellarPlate} from '#src/lib/materials/snowCrystal.ts'
import {coverage} from '#src/orbs/lib/fill.ts'

import {partyPoint, screenAxes} from '../lib/billboards.ts'
import EffectSprites from '../lib/EffectSprites.ts'

/** Flight envelope in meters and seconds, shared with the camera framing the show. */
export const flurry = {
  delay: 0.8,
  life: 2.9,
  radius: 0.125,
  spread: 1.75,
  out: 1.6,
  lift: 0.95,
  fall: 1.05,
} as const

/** An independent fraction per flake, constant over its flight. */
const roll = (salt: number) => hash(instanceIndex.add(salt))

/** A gust unrolls in front of the portal, broad flakes flashing face-on among grains of powder. The GPU flies every flake; there is no particle simulation to start or reset. */
export default class CrystalFlurry extends EffectSprites {
  constructor() {
    super('party-flurry', new PlaneGeometry(1, 1), 192)
    const {material} = this
    const {clock, floor, normal, tangent} = this.uniforms
    const age = clock.sub(roll(43).mul(flurry.delay))
    const progress = age.div(roll(151).mul(0.8).add(flurry.life - 0.8)).clamp()
    const thrown = progress.mul(-5).exp().oneMinus()
    const angle = roll(557).mul(2 * Math.PI).add(progress.mul(2.3)).add(thrown.mul(0.8))
    const reach = thrown.mul(roll(721).mul(0.75).add(0.25)).mul(flurry.spread)
    const size = roll(113).pow3().mul(flurry.radius - 0.014).add(0.014)
    const y = angle.sin().mul(reach).mul(0.62).add(progress.mul(Math.PI).sin().mul(flurry.lift)).sub(progress.pow2().mul(flurry.fall))
    const out = thrown.mul(0.35).add(progress.mul(0.65)).mul(roll(997).mul(0.67).add(0.33)).mul(flurry.out)
    const center = partyPoint(tangent, normal, angle.cos().mul(reach), y.max(floor.add(size)), out)
    const spin = progress.mul(roll(631).mul(6).add(3)).add(angle)
    const {right, up} = screenAxes(angle.add(progress.mul(1.8)))
    const facing = spin.cos().abs()
    const tilt = facing.mul(0.84).add(0.16)
    const presence = progress.smoothstep(0, 0.06).mul(progress.smoothstep(0.68, 1).oneMinus())
    const unit = size.mul(presence).mul(2)
    material.positionNode = center.add(right.mul(positionGeometry.x.mul(unit).mul(tilt))).add(up.mul(positionGeometry.y.mul(unit)))
    const point = uv().mul(2).sub(1)
    // Small grains of diamond dust have a solid silhouette; only the large plates resolve into dendrites.
    const sector = crystalSector(point)
    const edge = select(size.lessThan(0.038), float(0.72).sub(sector.x), stellarPlate(sector))
    const glint = facing.pow(12)
    material.colorNode = mix(vec3(0.26, 0.59, 0.86), vec3(1.15, 1.29, 1.35), facing.mul(0.73).add(glint.mul(0.27)))
    material.opacityNode = coverage(edge).mul(mix(float(0.6), float(1), glint)).mul(presence)
  }
}
