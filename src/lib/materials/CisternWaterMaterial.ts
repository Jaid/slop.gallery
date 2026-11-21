import type {Node} from 'three/webgpu'

import {color, exp, float, mix, mx_noise_float, time, uv, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal} from './filters.ts'

type Float = Node<'float'>

const unit = (node: Float) => node.mul(0.5).add(0.5)
/** how fast the water runs, in meters a second */
const flow = 0.45

/**
 * The dark, cold water of the Bastion’s cistern: running along its channel, its UV v the distance along it in meters and u across it, or standing in the drain’s sump.
 * Small ripples drift downstream on it, and pale streaks of scum ride along, a little faster in its middle than along the sides; its surface mirrors the lantern sharply wherever it lies still enough.
 * Where a stream pours into it, `inflow` meters along, it churns white and ripples harder, settling over the next meter downstream.
 */
export default class CisternWaterMaterial extends MeshStandardNodeMaterial {
  constructor(inflow?: number) {
    super({
      color: '#28302b',
      roughness: 0.06,
      metalness: 0,
      envMapIntensity: 0.5,
    })
    this.name = inflow === undefined ? 'Cistern water' : 'Cistern channel water'
    const across = uv().x
    // faster in the middle than along the sides, where the stone holds it back
    const drift = time.mul(float(flow).mul(across.sub(0.5).abs().mul(-0.8).add(1)))
    const along = uv().y.sub(drift)
    const ripples = unit(mx_noise_float(vec3(across.mul(2.5), along.mul(7), time.mul(0.8)))).mul(0.6).add(unit(mx_noise_float(vec3(across.mul(6), along.mul(17), time.mul(1.4)))).mul(0.4))
    const scum = unit(mx_noise_float(vec3(across.mul(3.5), along.mul(2.2), 4.7))).smoothstep(0.62, 0.85).toVar('cisternScum')
    if (inflow === undefined) {
      this.colorNode = mix(color('#232b27'), color('#6f7a70'), scum.mul(0.45))
      this.roughnessNode = scum.mul(0.5).add(0.05)
      this.normalNode = heightNormal(ripples.mul(0.002))
      return
    }
    // Up the channel from the stream, the backwater only stirs; downstream, the churned water drifts off and settles.
    const below = uv().y.sub(inflow)
    const stir = exp(below.max(0).mul(-2.2)).mul(exp(below.min(0).mul(9))).toVar('cisternStir')
    const churn = unit(mx_noise_float(vec3(across.mul(9), along.mul(11), time.mul(2.6)))).smoothstep(0.35, 0.8)
    const foam = stir.mul(churn).mul(0.9).toVar('cisternFoam')
    this.colorNode = mix(mix(color('#232b27'), color('#6f7a70'), scum.mul(0.45)), color('#c5ccc4'), foam)
    this.roughnessNode = scum.mul(0.5).add(0.05).add(foam.mul(0.45))
    this.normalNode = heightNormal(ripples.mul(stir.mul(0.006).add(0.002)))
  }
}
