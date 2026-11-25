import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentLocal, color, float, mix, mx_noise_float, negateOnBackSide, normalLocal, tangentLocal, time, transformNormalToView, uv, vec3} from 'three/tsl'

import {knotLength, tubeCells, tubeMetric} from '../../candidates/claude_sonnet/lib/tubeMetric.ts'
import {voronoi} from '../../candidates/claude_sonnet/lib/voronoiCells.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Coverage of the gold lacquer within `half` cell units of a fracture, antialiased over one pixel footprint. */
const seamCoverage = (edge: Node<'float'>, half: Node<'float'>) => {
  const aa = edge.fwidth().max(0.0005)
  return edge.smoothstep(half, half.add(aa.mul(1.4))).oneMinus()
}
/** Indigo-black crackled bowl glaze, mended with fresh gold; the seams breathe slow pulses of heat. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const {p, view, facing, near, intimate} = viewerFrame()
    const tube = uv()
    const plates = voronoi(tubeCells(tube, 35, 4), [35, 4], 2.3)
    const shards = voronoi(tubeCells(tube, 105, 12), [105, 12], 7.9)
// Gold pools where the lacquer collected, and thins to a hairline elsewhere.
    const pooling = mx_noise_float(p.mul(9).add(vec3(3.1, -1.4, 5.2))).mul(0.5).add(0.5)
    const grain = mx_noise_float(p.mul(61)).mul(0.5).add(0.5)
    const mainHalf = pooling.mul(0.075).add(0.045)
    const main = seamCoverage(plates.edge, mainHalf)
// Secondary fractures only reveal themselves as the viewer steps in.
    const fineHalf = pooling.mul(0.04).add(0.022)
    const fineGate = shards.random.x.smoothstep(0.35, 0.5).mul(intimate.mul(0.85).add(0.15))
    const fine = seamCoverage(shards.edge, fineHalf).mul(fineGate).mul(main.oneMinus())
    const gold = main.max(fine)
// Each shard is faceted and domed like a real fragment, with glaze thinning toward its broken rim.
    const scatter = vec3(plates.random.x, plates.random.y, plates.random.z).sub(0.5).mul(2)
    const normal = normalLocal.normalize()
    const lean = scatter.sub(normal.mul(scatter.dot(normal)))
    const dome = plates.offset.mul(0.22)
    const tangent = vec3(tangentLocal).normalize()
    const bitangent = vec3(bitangentLocal as unknown as Node<'vec3'>).normalize()
    const facet = normal.add(lean.mul(0.11)).add(tangent.mul(dome.x)).add(bitangent.mul(dome.y)).normalize()
    const rim = plates.edge.smoothstep(0.05, 0.55).oneMinus()
    const height = plates.edge.smoothstep(0.02, 0.4).mul(0.0014).add(plates.random.z.mul(0.0008)).add(gold.mul(0.0011)).add(grain.mul(gold).mul(0.00025))
    const bump = proceduralNormal(height, 1)
    const facetView = negateOnBackSide(transformNormalToView(facet))
    this.normalNode = mix(facetView, bump, 0.6).normalize()
    this.clearcoatNormalNode = facetView
// Tenmoku glaze: ink-black with indigo depth, iron-brown where it thins and scattered silver oil spots.
    const inkA = color(hsl.integer(273, 25, 4))
    const inkB = color(hsl.integer(268, 62, 10))
    const inkC = color(hsl.integer(29, 38, 7))
    const plate = mix(mix(inkA, inkB, plates.random.y.smoothstep(0.2, 0.9)), inkC, plates.random.x.smoothstep(0.75, 1))
    const glaze = mix(plate, color(hsl.integer(45, 64, 21)), rim.pow(2).mul(0.85))
    const spots = cellularPoints(p.mul(84), 0.02, 0.13, 0.72).mul(gold.oneMinus())
    const ceramic = mix(glaze, color(hsl.integer(247, 24, 72)), spots.mul(0.6))
    const goldTone = mix(color(1, 0.68, 0.2), color(1, 0.83, 0.46), grain.smoothstep(0.3, 0.9))
    this.colorNode = mix(ceramic, goldTone, gold)
    this.metalnessNode = gold.max(spots.mul(0.5))
    this.roughnessNode = mix(float(0.06), float(0.22), gold).add(grain.mul(0.1).mul(gold)).sub(spots.mul(0.03))
    this.clearcoatNode = gold.oneMinus()
    this.clearcoatRoughnessNode = float(0.03)
    this.iridescence = 0.35
    this.iridescenceIOR = 1.6
    this.iridescenceThicknessNode = spots.mul(200).add(rim.mul(250)).add(160)
    this.aoNode = mix(float(1), float(0.55), plates.edge.smoothstep(0, 0.12).oneMinus().mul(gold.oneMinus()))
// Heat: a slow traveling front of molten light along the network, broken into blobs by noise.
    const arc = tubeMetric(tube).x
    const front = arc.mul(TAU * 4 / knotLength).sub(time.mul(0.55)).add(pooling.mul(3.4)).sin().mul(0.5).add(0.5).pow(4)
    const ember = mx_noise_float(p.mul(3.3).add(vec3(0, 0, time.mul(0.12)))).mul(0.5).add(0.5).smoothstep(0.35, 0.8)
    const heat = front.mul(ember).mul(gold)
    const fleckPulse = time.mul(plates.random.x.mul(2.4).add(1.2)).add(plates.random.y.mul(TAU)).sin().mul(0.5).add(0.5)
    const dust = cellularPoints(p.mul(310), 0.015, 0.14, 0.55).mul(main.max(fine).add(rim.mul(0.25)).clamp()).mul(fleckPulse.pow(3)).mul(intimate)
    const glint = facet.dot(view).clamp(0, 1).pow(70).mul(gold).mul(near.mul(0.5).add(0.5))
    this.emissiveNode = color(hsl.integer(55.5, 100, 70.7)).mul(heat).mul(facing.mul(0.4).add(0.6)).mul(2.4)
      .add(color(hsl.integer(95, 100, 95.2)).mul(dust).mul(1.8))
      .add(color(hsl.integer(85, 100, 88.5)).mul(glint).mul(0.6))
      .add(color(hsl.integer(284, 80, 28)).mul(float(1).sub(facing).pow(4)).mul(plates.edge.smoothstep(0.3, 0.9)).mul(0.05))
  }
}
