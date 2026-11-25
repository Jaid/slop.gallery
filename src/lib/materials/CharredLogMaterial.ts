import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, materialReference, max, mix, mx_noise_float, mx_worley_noise_vec2, normalGeometry, positionGeometry, smoothstep, time, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial, NodeMaterialInstance} from 'three/webgpu'

import {heightNormal} from './filters.ts'
import fireColor from './fireColor.ts'

/** a number of the log being drawn, from its own material instance */
const logValue = (name: 'halfLength' | 'inward' | 'radius') => materialReference(name, 'float') as unknown as Node<'float'>
/**
 * A burning log for a `LogGeometry` lying on its side, turned by 90° around z so its y axis runs along the log.
 *
 * The log is charred into alligator checks stretched along the grain, its cool top crusted with pale, clumping ash; only a few patches of bark survive on its outer flank. Where it faces the flames or the coal bed below, the checks glow orange from within and pulse as the flames lick past. The glow fades toward the sawn ends, which show growth rings inside a charred rim.
 *
 * Every log is a {@link NodeMaterialInstance} of this one material, which reads each log’s `inward`, `halfLength` and `radius` from the log’s own material, so all logs share a single shader build; see {@link createCharredLogMaterial}.
 */
class CharredLogMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.7,
      envMapIntensity: 0.15,
    })
    this.name = 'lodge-charred-log'
    const p = positionGeometry
    const n = normalGeometry
    // Turned by 90° around z, the log’s local −x points down toward the embers.
    // The direction toward the fire along the log’s local z axis
    const inward = logValue('inward')
    const facing = n.z.mul(inward)
    const downward = n.x.negate()
    const along = p.y.abs().div(logValue('halfLength'))
    // Ragged, so the glowing zone never ends in a straight line along the log.
    const ragged = mx_noise_float(p.mul(vec3(14, 3, 14))).mul(0.35)
    const exposure = max(smoothstep(-0.2, 0.8, facing.add(ragged)), smoothstep(0, 0.9, downward.add(ragged)).mul(0.75)).mul(smoothstep(0.6, 0.97, along.add(ragged.mul(0.3))).oneMinus())
    // Stretched along the grain, the way charcoal checks.
    const warp = mx_noise_float(p.mul(vec3(6, 1.5, 6))).mul(0.06)
    const cells = mx_worley_noise_vec2(p.add(warp).mul(vec3(30, 4, 30)))
    const border = cells.y.sub(cells.x)
    const crack = smoothstep(0.015, 0.1, border).oneMinus()
    // White-hot deep in the checks, cooling to red on their lips.
    const depth = smoothstep(0, 0.035, border).oneMinus()
    const pulse = mx_noise_float(vec3(p.y.mul(4), time.mul(0.8), inward.mul(3).add(5))).mul(0.5).add(0.5)
    const glow = crack.mul(0.55).add(depth.mul(0.45)).mul(exposure.pow(1.3)).mul(pulse.mul(0.8).add(0.4)).add(exposure.pow(4).mul(pulse).mul(0.12))
    const patches = mx_noise_float(p.mul(vec3(7, 2.5, 7)))
    const bark = smoothstep(0.55, 0.85, facing.add(patches.mul(0.5)).negate()).mul(smoothstep(-0.1, 0.3, downward.negate()))
    const barkColor = mix(color(hsl.integer(54, 42, 19)), color(hsl.integer(55, 34, 11)), mx_noise_float(p.mul(vec3(30, 3, 30))).mul(0.5).add(0.5))
    const charColor = mix(color(hsl.integer(61, 10, 17)), color(hsl.integer(52, 14, 4)), crack)
    // A crust of pale ash clumps over the cool top, unbroken over the checks and away from the bark.
    const ashMask = smoothstep(0.3, 0.65, mx_noise_float(p.mul(18)).mul(0.5).add(0.5)).mul(smoothstep(0, 0.8, n.x)).mul(crack.oneMinus()).mul(bark.oneMinus())
    const ashColor = mix(color(hsl.integer(102, 8, 44)), color(hsl.integer(43, 7, 19)), mx_noise_float(p.mul(55)).mul(0.5).add(0.5))
    const side = mix(mix(charColor, barkColor, bark), ashColor, ashMask.mul(0.55))
    // Sawn ends: growth rings around the pith, charred from the rim inward.
    const radiusNode = logValue('radius')
    const across = p.xz.length().div(radiusNode)
    const rings = across.mul(radiusNode.mul(220)).add(mx_noise_float(p.mul(9)).mul(2.5)).sin().mul(0.5).add(0.5)
    const sawn = mix(mix(color(hsl.integer(57, 39, 25)), color(hsl.integer(57, 36, 16)), rings), color(hsl.integer(60, 15, 5)), smoothstep(0.55, 0.9, across))
    const end = smoothstep(0.6, 0.85, n.y.abs())
    this.colorNode = mix(side, sawn, end)
    this.roughnessNode = mix(mix(float(0.86), float(0.97), max(crack, bark)), float(0.9), end)
    this.emissiveNode = fireColor(glow.mul(end.oneMinus())).mul(2.6)
    this.normalNode = heightNormal(crack.mul(-0.003).add(mx_noise_float(p.mul(110)).mul(0.0003)).mul(end.oneMinus()))
  }
}
let shared: CharredLogMaterial | undefined

/** A burning log’s material, an instance of the one {@link CharredLogMaterial} every log shares, which lives as long as the page. */
export function createCharredLogMaterial(inward: -1 | 0 | 1, halfLength: number, radius: number) {
  shared ??= new CharredLogMaterial
  return Object.assign(new NodeMaterialInstance(shared), {
    halfLength,
    inward,
    radius,
  })
}
