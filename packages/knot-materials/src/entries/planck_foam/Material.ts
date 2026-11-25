import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_noise_float, mx_worley_noise_float, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, near} = viewerFrame()
    const q = p.mul(24).add(vec3(time.mul(0.2), time.mul(-0.15), time.mul(0.1)))
    // Jitter 0.8 preserves the original centers in [0.1, 0.9], but includes neighboring bubbles.
    // Style 0 returns Euclidean distance, not the nearest cell's random identity.
    const dist = mx_worley_noise_float(q, 0.8, 0)
    const bubble = dist.smoothstep(0.04, 0.28).oneMinus()
    const fluctuate = mx_noise_float(q.mul(0.25).add(time.mul(0.6))).mul(0.5).add(0.5)
    const foam = bubble.mul(fluctuate)
    const chroma = spectralColor(dist.mul(12).add(time.mul(0.4)).add(view.x.mul(1.5)))
    this.colorNode = color(hsl.integer(261, 62, 3))
    this.transmission = 0.96
    this.thickness = 0.3
    this.ior = 1.03
    this.roughness = 0.015
    this.metalness = 0
    this.envMapIntensity = 1.3
    this.iridescence = 1
    this.iridescenceIOR = 1.1
    this.iridescenceThicknessNode = foam.mul(450).add(120)
    this.normalNode = proceduralNormal(foam, 0.0005)
    this.emissiveNode = chroma.mul(foam).mul(near.mul(1.1).add(0.4)).add(color(hsl.integer(0, 0, 100)).mul(foam.pow(5)).mul(0.6))
  }
}
