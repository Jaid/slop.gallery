import type {Triple} from '../../lib/Triple.ts'
import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, negateOnBackSide, normalLocal, time, transformNormalToView, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Quicksilver: a bead of liquid mercury. Surface tension keeps the silhouette taut, so the waves live almost entirely in the normal; they are summed analytically, which keeps the mirror smooth at any distance instead of faceting. A nanometric oxide skin tints the crests with thin-film color. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const {p, grazing, near} = viewerFrame()
    const waves: Array<{
      amplitude: number
      direction: Triple
      frequency: number
      speed: number
    }> = [
      {
        amplitude: 0.001,
        direction: [0.68, 0.52, 0.52],
        frequency: 31,
        speed: 1.2,
      },
      {
        amplitude: 0.0007,
        direction: [-0.42, 0.79, 0.44],
        frequency: 47,
        speed: -0.95,
      },
      {
        amplitude: 0.00048,
        direction: [0.21, -0.61, 0.76],
        frequency: 64,
        speed: 0.78,
      },
      {
        amplitude: 0.00032,
        direction: [0.84, -0.31, -0.44],
        frequency: 87,
        speed: -0.62,
      },
      {
        amplitude: 0.0002,
        direction: [-0.61, -0.49, 0.62],
        frequency: 117,
        speed: 0.5,
      },
      {
        amplitude: 0.00012,
        direction: [0.33, 0.28, -0.9],
        frequency: 155,
        speed: -0.4,
      },
    ]
    let height: Node<'float'> = float(0)
    let gradient: Node<'vec3'> = vec3(0)
    for (const wave of waves) {
      const direction = vec3(...wave.direction)
      const phase = p.dot(direction).mul(wave.frequency).sub(time.mul(wave.speed))
      height = height.add(phase.sin().mul(wave.amplitude))
      gradient = gradient.add(direction.mul(wave.frequency).mul(phase.cos()).mul(wave.amplitude))
    }
    const normal = normalLocal.normalize()
    const tangentGradient = gradient.sub(normal.mul(gradient.dot(normal)))
    this.normalNode = negateOnBackSide(transformNormalToView(normal.sub(tangentGradient.mul(1.1)).normalize()))
    const slope = gradient.length()
    const film = mx_noise_float(p.mul(3.3).add(vec3(7.1, 2.9, 5.5))).mul(0.5).add(0.5).smoothstep(0.62, 0.92)
    const silver = mix(color(hsl.integer(250, 12, 63)), color(hsl.integer(248, 24, 86)), mx_noise_float(p.mul(4.1)).mul(0.5).add(0.5))
    this.colorNode = mix(silver, color(hsl.integer(253, 13, 43)), film.mul(0.35))
    this.metalness = 1
    this.roughnessNode = float(0.025).add(slope.mul(0.012)).add(grazing.mul(0.008))
    this.iridescence = 0.4
    this.iridescenceIOR = 1.42
    this.iridescenceThicknessNode = height.mul(60_000).add(280).clamp(180, 620)
    this.clearcoat = 0.2
    this.clearcoatRoughness = 0.015
    this.emissiveNode = color(hsl.integer(238, 100, 85)).mul(slope.mul(9)).mul(near.mul(0.35).add(0.04)).mul(0.3)
      .add(color(hsl.integer(236, 100, 96)).mul(grazing.pow(4)).mul(0.05))
  }
}
