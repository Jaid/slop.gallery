import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, positionGeometry} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

/** Dark iron, heat-darkened and roughened around the top of the lantern, not along its suspension. */
export default class LanternMetalMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      color: hsl.integer(69, 28, 19),
      metalness: 0.75,
      roughness: 0.4,
    })
    const p = positionGeometry
    const heat = p.y.smoothstep(0, 0.2).mul(p.y.smoothstep(0.4, 0.3)).mul(mx_noise_float(p.mul(14)).mul(0.3).add(0.7))
    this.colorNode = mix(color(hsl.integer(69, 28, 19)), color(hsl.integer(45, 24, 9)), heat.mul(0.7))
    this.roughnessNode = float(0.4).add(heat.mul(0.3))
  }
}
