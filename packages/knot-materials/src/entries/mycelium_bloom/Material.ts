import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, uv, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 7. MYCELIUM BLOOM A damp, dark forest floor woven into a knot. Branching hyphae thread the substrate; every few seconds a wave of bioluminescence races the length of the tendril, setting clustered fungal nodes alight like tiny lanterns. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, grazing, rim, intimate} = viewerFrame()
    const tube = uv()
    // Substrate — moss, humus, damp earth.
    const substrate = mx_fractal_noise_float(p.mul(7), 4, 2, 0.55).mul(0.5).add(0.5)
    const substrateFine = mx_noise_float(p.mul(42)).mul(0.4).add(0.6)
    const soil = mix(color(hsl.integer(136, 51, 5.5)), color(hsl.integer(132, 66, 17)), substrate)
    const soilRich = mix(soil, color(hsl.integer(128, 66, 25)), substrateFine.mul(0.35))
    const mossy = mix(soilRich, color(hsl.integer(128, 80, 34)), substrate.pow(1.4).mul(0.7))
    // Branching hyphae threads.
    const hyphaeBase = mx_fractal_noise_float(p.mul(26).add(vec3(time.mul(0.02), 0, time.mul(0.03))), 3, 2, 0.5).mul(2.8)
    const hyphae = opticalLine(hyphaeBase.fract().sub(0.5), 0.035)
    const hyphaeCoarse = opticalLine(mx_noise_float(p.mul(14).add(mx_noise_float(p.mul(3)).mul(2))), 0.05)
    // Fungal nodes — clustered fruiting bodies.
    const nodeQ = p.mul(58)
    const nodeRnd = cellNoiseVec3(nodeQ)
    const nodeRnd2 = cellNoiseVec3(nodeQ.add(vec3(41.1, 17.3, 88.7)))
    const nodeDist = nodeQ.fract().sub(nodeRnd.mul(0.5).add(0.25)).length()
    const nodeFp = nodeQ.fwidth().length().max(0.002)
    const node = nodeDist.smoothstep(0.16, nodeFp.add(0.22)).oneMinus()
    const nodeSmall = nodeDist.smoothstep(0.22, nodeFp.add(0.3)).oneMinus()
      .mul(nodeRnd2.y.smoothstep(0.5, 0.6))
    // Travelling pulse — a slow, beautiful wave of bioluminescence.
    const pulsePrimary = tube.x.mul(Math.PI * 2).sub(time.mul(1.6))
      .sin().mul(0.5).add(0.5).pow(5)
    const pulseSecondary = tube.x.mul(Math.PI * 2 * 2).add(time.mul(1.05))
      .add(tube.y.mul(Math.PI * 2)).sin().mul(0.5).add(0.5).pow(7)
    const pulseTertiary = tube.x.mul(Math.PI * 2 * 3).sub(time.mul(0.65))
      .sin().mul(0.5).add(0.5).pow(9).mul(0.6)
    // Nearby spores. Use compact round features; thresholding raw cell noise
    // lights whole lattice cells, which reads as tiny floating rectangles.
    const sporeQ = p.mul(140).add(vec3(time.mul(0.08), 0, time.mul(-0.06)))
    const spores = cellularPoints(sporeQ, 0.03, 0.13, 0.78)
    // Colour pair — cyan when the pulse passes, violet behind it.
    const bioCyan = color(hsl.integer(177, 100, 88.5))
    const bioViolet = color(hsl.integer(301, 100, 60))
    const bioPink = color(hsl.integer(339, 100, 75))
    const bioCol = mix(bioViolet, bioCyan, pulsePrimary)
    const bioEdge = mix(bioCyan, bioPink, pulseSecondary.mul(0.6))
    const nodeGlow = node.mul(pulsePrimary.mul(1.2).add(0.15))
    const hyphaeGlow = hyphae.mul(pulsePrimary.add(pulseSecondary.mul(0.5)).add(0.25))
    const coarseGlow = hyphaeCoarse.mul(pulseTertiary.add(0.2))
    this.colorNode = mossy
    this.metalness = 0.05
    this.roughnessNode = float(0.9).sub(node.mul(0.35)).sub(hyphae.mul(0.15))
    this.clearcoat = 0.28
    this.clearcoatRoughness = 0.45
    this.normalNode = proceduralNormal(hyphae.mul(0.35)
      .add(node.mul(0.75))
      .add(nodeSmall.mul(0.4))
      .add(substrate.mul(0.15)), 0.0035)
    this.emissiveNode
      = bioCol.mul(hyphaeGlow).mul(2.2)
        .add(bioEdge.mul(coarseGlow).mul(1.1))
        .add(bioCyan.mul(nodeGlow).mul(2.6))
        .add(bioViolet.mul(nodeSmall).mul(0.9))
        .add(color(hsl.integer(0, 0, 100)).mul(spores).mul(intimate.mul(0.8).add(0.4)).mul(1.6))
        .add(bioCyan.mul(grazing).mul(0.06))
        .add(color(hsl.integer(164, 100, 90.3)).mul(rim).mul(0.14))
  }
}
