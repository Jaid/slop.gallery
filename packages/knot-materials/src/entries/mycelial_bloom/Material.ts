import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_noise_vec3, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {voronoiCells} from '../../candidates/deepseek/lib/voronoiCells.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Mycelium. A knot of damp bark has been colonised: pale hyphae run along every fissure, fuse where they meet, and carry a slow chemical signal that glows cold green in the dark. The light does not sit still – it travels outward from a handful of sources, so the whole colony breathes. Come close and the finest threads resolve out of the mat. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const warp = mx_noise_vec3(p.mul(5.5)).mul(0.42)
    const q = p.add(warp)
// The colony: a Voronoi skeleton whose walls become the hyphae.
    const colony = voronoiCells(q.mul(7))
    const threadAA = colony.edge.fwidth().max(0.0004)
    const threadWidth = mx_noise_float(q.mul(14)).mul(0.5).add(0.5).mul(0.045).add(0.03)
    const thread = colony.edge.smoothstep(threadWidth, threadWidth.add(threadAA.mul(2.5))).oneMinus()
// Primary cords: the thick rhizomorphs that the fine mesh hangs from.
    const cords = voronoiCells(q.mul(3.1))
    const cordAA = cords.edge.fwidth().max(0.0004)
    const cordWidth = mx_noise_float(q.mul(6)).mul(0.5).add(0.5).mul(0.05).add(0.055)
    const cord = cords.edge.smoothstep(cordWidth, cordWidth.add(cordAA.mul(2.5))).oneMinus()
    const network = thread.max(cord)
// A finer mesh of hyphae, only resolved at arm's length.
    const hyphae = voronoiCells(q.mul(22))
    const hyphaeAA = hyphae.edge.fwidth().max(0.0004)
    const hyphaeMask = hyphae.edge.smoothstep(0.02, hyphaeAA.mul(2.5).add(0.02)).oneMinus().mul(intimate)
// Damp bark beneath: dark, warm, with a faint sheen.
    const bark = mx_noise_float(p.mul(5)).mul(0.5).add(0.5)
    const barkFine = mx_noise_float(p.mul(60)).mul(0.5).add(0.5)
    const substrate = mix(color(hsl.integer(79, 34, 5)), color(hsl.integer(71, 39, 12)), bark.mul(0.6).add(barkFine.mul(0.3)))
// The signal: waves that travel outward from a few fixed sources.
    const sourceA = vec3(0.31, -0.22, 0.44)
    const sourceB = vec3(-0.38, 0.29, -0.18)
    const sourceC = vec3(0.12, 0.41, 0.27)
    const waveA = p.sub(sourceA).length().mul(9).sub(time.mul(0.9)).sin()
    const waveB = p.sub(sourceB).length().mul(12).sub(time.mul(0.7)).sin()
    const waveC = p.sub(sourceC).length().mul(7).sub(time.mul(1.15)).sin()
    const signal = waveA.add(waveB).add(waveC).mul(0.333).mul(0.5).add(0.5)
    const pulse = signal.pow(3).mul(0.85).add(0.15)
// Fruiting bodies: compact points that glow hardest.
    const nodes = cellularPoints(p.mul(11), 0.03, 0.13, 0.55)
    const nodeGlow = nodes.mul(intimate.mul(0.6).add(0.4))
    const threadColor = mix(color(hsl.integer(90, 29, 79)), color(hsl.integer(93, 44, 93)), mx_noise_float(q.mul(30)).mul(0.5).add(0.5))
    const glowColor = mix(color(hsl.integer(161, 100, 86.77)), color(hsl.integer(172, 100, 92)), signal)
// The vertex stage cannot use derivatives, so the relief uses a fixed width.
    const threadRelief = colony.edge.smoothstep(threadWidth, threadWidth.add(0.006)).oneMinus()
    const cordRelief = cords.edge.smoothstep(cordWidth, cordWidth.add(0.01)).oneMinus()
    const hyphaeRelief = hyphae.edge.smoothstep(0.02, 0.05).oneMinus().mul(intimate)
    const barkRelief = mx_noise_float(p.mul(9)).mul(0.5).add(0.5).mul(0.0016).add(mx_noise_float(p.mul(26)).mul(0.5).add(0.5).mul(0.0007))
    const height = threadRelief.mul(0.0026).add(cordRelief.mul(0.0042)).add(hyphaeRelief.mul(0.0008)).add(nodeGlow.mul(0.0018)).add(barkRelief)
    this.colorNode = mix(substrate, threadColor.mul(0.12), network.mul(0.85)).add(glowColor.mul(network).mul(pulse).mul(0.1))
    this.metalness = 0
    this.roughnessNode = mix(float(0.85).sub(bark.mul(0.15)).sub(barkFine.mul(0.1)), float(0.36), network)
    this.clearcoat = 0.12
    this.clearcoatRoughness = 0.2
    this.sheen = 0.3
    this.sheenColor.set(hsl.integer(158, 36, 89))
    this.sheenRoughness = 0.4
    this.normalNode = proceduralNormal(height.add(mx_noise_float(p.mul(70)).mul(0.5).add(0.5).mul(0.0004)), 1)
    this.clearcoatNormalNode = this.normalNode
    this.emissiveNode = glowColor.mul(network).mul(pulse).mul(near.mul(0.5).add(0.55)).mul(2.2).add(glowColor.mul(nodeGlow).mul(1.1)).add(color(hsl.integer(167, 100, 89.9)).mul(hyphaeMask).mul(pulse).mul(0.5)).add(color(hsl.integer(167, 83, 39)).mul(grazing.pow(3)).mul(0.06))
    this.aoNode = network.mul(0.2).oneMinus().mul(0.3).add(0.7)
    this.positionNode = positionGeometry.add(normalLocal.mul(height))
  }
}
