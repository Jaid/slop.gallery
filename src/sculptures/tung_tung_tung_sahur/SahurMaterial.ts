import {attribute, float, mix, mx_noise_float, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

/** Honey wood finished with oil, with glossy enamel inlays instead of grain across the eyes. */
export default class SahurMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      name: 'Sahur · oiled wood and enamel',
      vertexColors: true,
      clearcoatRoughness: 0.32,
    })
    const grain = attribute<'vec3'>('sahurGrain', 'vec3')
    const enamel = attribute<'float'>('sahurEnamel', 'float')
    const [along, across, seed] = [grain.x, grain.y, grain.z.mul(13)]
    const figure = mx_noise_float(vec3(along.mul(1.6), across.mul(10), seed))
    const phase = across.mul(175).add(figure.mul(7))
    const latewood = mix(phase.cos().mul(0.5).add(0.5).pow(5), float(0.246), phase.fwidth().smoothstep(0.55, 2.3))
    const poresAt = across.mul(340)
    const pore = mx_noise_float(vec3(along.mul(6.2), poresAt, seed.add(1))).mul(poresAt.fwidth().smoothstep(0.6, 2).oneMinus())
    const value = figure.mul(0.15).add(pore.mul(0.12)).sub(latewood.mul(0.29)).add(1.045)
    this.colorNode = vec3(mix(value, float(1), enamel))
    this.roughnessNode = mix(latewood.mul(0.085).add(0.45), float(0.24), enamel)
    this.clearcoatNode = mix(float(0.12), float(0.42), enamel)
  }
}
