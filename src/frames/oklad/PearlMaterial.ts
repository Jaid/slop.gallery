import hsl from 'okhsl'
import {color, mix, mx_noise_float, normalView, positionLocal, positionViewDirection} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import frameStudio from '../lib/materials/frameStudio.ts'

/**
 * A river pearl: nacre built up in thin layers, which mirror the room sharply off its polished skin over a soft glow, and whose layers split the light into an orient of rose and green shifting toward its edges, each pearl a little whiter, creamier or rosier than the next.
 */
export default class PearlMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      sheen: 1,
      sheenRoughness: 0.3,
      sheenColor: hsl.integer(10, 60, 84),
      iridescence: 1,
      iridescenceIOR: 1.5,
      envMap: frameStudio,
      envMapIntensity: 1.7,
    })
    // Slow enough to change little across one pearl, quick enough to tell the pearls round a stone apart.
    const tone = mx_noise_float(positionLocal.mul(70)).mul(0.5).add(0.5)
    const layers = mx_noise_float(positionLocal.mul(900)).mul(0.5).add(0.5)
    this.colorNode = mix(mix(color(hsl.integer(90, 14, 94)), color(hsl.integer(75, 30, 91)), tone.smoothstep(0.2, 0.6)), color(hsl.integer(20, 26, 91)), tone.smoothstep(0.6, 0.95))
    this.iridescenceThicknessNode = tone.mul(200).add(layers.mul(80)).add(280)
    // The glow of the light the nacre scatters back from below its skin, strongest where the pearl faces the viewer.
    const facing = normalView.dot(positionViewDirection).clamp(0, 1)
    this.emissiveNode = color(hsl.integer(80, 22, 78)).mul(facing.pow(2).mul(0.07))
  }
}
