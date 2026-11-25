import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time, uv} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 7. VELVET MYCELIUM Fruiting alien body weaving silken mulberry fungal velvet with a bio-digital mycorrhizal network. Grazing angles bloom in peach-velvet retroreflective sheen. Approaching triggers nervous action spikes that illuminate branching mycelial hyphae and nestled golden bioluminescent spore synapses. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    this.colorNode = mix(color(hsl.integer(321, 73, 6)), color(hsl.integer(320, 78, 12)), grazing.mul(0.6))
    this.metalness = 0
    this.roughness = 0.68
    // Velvet micro-fiber sheen backscattering
    this.sheen = 1
    this.sheenNode = mix(color(hsl.integer(356, 100, 67.6)), color(hsl.integer(86, 100, 86)), grazing.pow(1.4))
    this.sheenRoughness = 0.3
    // Branching mycorrhizal hyphae network
    const hyphaeNoise = mx_noise_float(p.mul(14)).mul(4.5).add(tube.x.mul(18)).add(tube.y.mul(6))
    const threads = opticalLine(hyphaeNoise.sin(), 0.055)
    const threadsFine = opticalLine(mx_noise_float(p.mul(30)).mul(5).add(tube.x.mul(48)).sin(), 0.04).mul(intimate)
    const hyphaeMask = threads.max(threadsFine)
    // Bio-electric synaptic pulses
    const nervePulse = time.mul(2.2).add(p.x.mul(6)).add(p.y.mul(8)).sin().mul(0.5).add(0.5).pow(3)
    // Glowing spore clusters nestled in the velvet valleys
    const sporeGrid = p.mul(44)
    const sporeRnd = cellNoiseVec3(sporeGrid)
    const sporePresent = sporeRnd.x.smoothstep(0.86, 0.91)
    const sporeDist = sporeGrid.fract().sub(0.5).length()
    const sporeDots = sporeDist.smoothstep(0.28, 0.05).mul(sporePresent).mul(intimate)
    const hyphaeGlow = color(hsl.integer(171, 100, 87)).mul(hyphaeMask).mul(nervePulse.mul(2.2).add(0.8))
    const sporeGlow = color(hsl.integer(99, 100, 92)).mul(sporeDots).mul(3.5)
    const subsurface = color(hsl.integer(304, 85, 41)).mul(facing.oneMinus().pow(2)).mul(0.35)
    this.normalNode = proceduralNormal(hyphaeMask.mul(0.25).add(sporeDots.mul(0.3)), 0.0014)
    this.emissiveNode = hyphaeGlow.add(sporeGlow).add(subsurface).mul(near.mul(0.7).add(0.4))
  }
}
