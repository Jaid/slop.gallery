import {color, float, hash, mix, mx_noise_float, positionWorld, vec2} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import forge, {forgeGauge, forgeVestibule} from '#src/lib/gallery/forge.ts'

import {heightNormal, insideBy, visibleDetail} from '../filters.ts'

/** Creosoted end-grain blocks like a machine shop floor: quieter and kinder to a dropped tool than stone. Brass gauge strips lead up the aisle; the circular threshold has a pair of rings inlaid in the same alloy. */
export default class EndGrainMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({envMapIntensity: 0.65})
    this.name = 'End-grain block paving with brass gauge'
    const p = positionWorld.xz.sub(vec2(...forge.center))
    const pixel = p.fwidth().x.max(p.fwidth().y)
    const v = p.y.div(0.21)
    const u = p.x.div(0.31).add(v.floor().mod(2).mul(0.5))
    const cell = vec2(u.fract(), v.fract()).sub(0.5).mul(vec2(0.31, 0.21))
    const key = v.floor().add(512).mul(2048).add(u.floor()).add(512)
    const tone = hash(key)
    const eccentric = vec2(hash(key.add(7417)), hash(key.add(71_227))).sub(0.5).mul(0.68)
    const radius = cell.add(eccentric).mul(vec2(0.87, 1.22)).length()
    const saw = mx_noise_float(p.mul(32)).mul(visibleDetail(pixel, 0.035))
    const ring = radius.mul(tone.mul(95).add(385)).add(saw.mul(0.9)).sin().smoothstep(0.18, 0.98).mul(visibleDetail(pixel, 0.024))
    const wood = mix(color('#836047'), color('#be9262'), tone.mul(0.78).add(0.1)).mul(ring.mul(-0.19).add(saw.mul(0.048)).add(1))
    const edge = float(0.155).sub(cell.x.abs()).min(float(0.105).sub(cell.y.abs()))
    const joint = insideBy(edge.sub(0.002), pixel)
    // Tick every decimeter, with longer half-meter and meter divisions. Nothing is raised above the orb’s rolling surface.
    const rule = p.x.abs().sub(forgeGauge.offset)
    const stripe = (distance: typeof rule, half: number) => insideBy(distance.abs().sub(half), pixel).mul(float(2 * half).div(pixel.max(0.00001)).min(1))
    const tick = (step: number, length: number) => stripe(p.y.div(step).sub(p.y.div(step).round()).mul(step), 0.005).mul(insideBy(rule.sub(length / 2).abs().sub(length / 2), pixel))
    const tracks = forgeGauge.ticks.reduce((marks, [step, length]) => marks.max(tick(step, length)), stripe(rule, forgeGauge.strip / 2))
    const inHall = insideBy(p.y.abs().sub(forge.size[1] / 2 - forgeGauge.inset), pixel)
    const radial = positionWorld.xz.sub(vec2(...forgeVestibule.center)).length()
    const brass = tracks.mul(inHall).max(stripe(radial.sub(1.78), 0.018)).max(stripe(radial.sub(1.89), 0.008))
    this.colorNode = mix(mix(wood, color('#504437'), joint), color('#d2a55d'), brass)
    this.metalnessNode = brass.mul(0.58)
    this.roughnessNode = mix(tone.mul(0.12).add(0.52).add(joint.mul(0.22)), float(0.34), brass)
    this.normalNode = heightNormal(edge.smoothstep(0.001, 0.008).mul(0.0015).sub(ring.mul(0.00009)).mul(brass.oneMinus()).mul(visibleDetail(pixel, 0.035)))
  }
}
