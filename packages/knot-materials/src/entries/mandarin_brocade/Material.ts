import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, time, vec2} from 'three/tsl'

import {tubeCoordinates} from '../../candidates/claude_haiku/lib/tubeCoordinates.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Motif tiles per revolution along the tube and around it. Integers keep the weave seamless at both UV wraps. */
const tilesAlong = 24
const tilesAround = 3
/** Thread counts per tile: warp ends run along the tube, weft picks wrap around it. */
const warpPerTile = 12
const weftPerTile = 12
/** Anti-aliased coverage of the disc of radius `radius` around the tile's scallop centre. */
const disc = (distance: Node<'float'>, radius: number) => {
  const aa = distance.fwidth().max(0.001)
  return distance.smoothstep(float(radius).sub(aa), float(radius).add(aa)).oneMinus()
}

/** Mandarin silk: midnight weft covers the knot, and gold warp floats rise where a seigaiha wave pattern calls for them. Warp floats run along the tube and weft runs around it, so the anisotropic highlight changes direction between motifs as you circle. Sheen rakes across the silk at grazing angles, and one brighter current of light travels the length of the weave on a two-second loop. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const {grazing, intimate} = viewerFrame()
    const {along, around} = tubeCoordinates()
// Each tile is a half-disc scalloped from its lower edge; the scallop rings alternate between gold and silk.
    const a = along.mul(tilesAlong)
    const b = around.mul(tilesAround)
    const local = vec2(a.fract().sub(0.5), b.fract())
    const distance = local.length()
    const rings = distance.mul(8).mul(Math.PI).sin()
    const ringAA = rings.fwidth().max(0.001).mul(1.5)
    const evenRing = rings.smoothstep(ringAA.negate(), ringAA)
    const field = disc(distance, 0.5)
    const centre = disc(distance, 0.125)
    const goldMask = field.mul(evenRing.oneMinus())
    const roseMask = centre
// Thread ridges: warp is a bundle of cylinders around the tube, weft a bundle of cylinders along it. Ridges fade once unresolved.
    const warpPhase = around.mul(tilesAround * warpPerTile)
    const weftPhase = along.mul(tilesAlong * weftPerTile)
    const warpRidge = warpPhase.mul(TAU).cos()
    const weftRidge = weftPhase.mul(TAU).cos()
    const warpSeen = warpPhase.fwidth().smoothstep(0.2, 0.5).oneMinus().mul(intimate.mul(0.6).add(0.4))
    const weftSeen = weftPhase.fwidth().smoothstep(0.2, 0.5).oneMinus().mul(intimate.mul(0.6).add(0.4))
    const warpShade = float(1).sub(warpRidge.mul(0.5).add(0.5).oneMinus().mul(0.3).mul(warpSeen))
    const weftShade = float(1).sub(weftRidge.mul(0.5).add(0.5).oneMinus().mul(0.4).mul(weftSeen))
    const gold = mix(color(hsl.integer(72, 78, 49)), color(hsl.integer(86, 73, 85)), warpShade)
    const silk = mix(color(hsl.integer(267, 73, 21)), color(hsl.integer(266, 66, 34)), weftShade)
    const rose = color(hsl.integer(8, 66, 44)).mul(weftShade.mul(0.8).add(0.2))
    this.colorNode = mix(mix(silk, rose, roseMask), gold, goldMask)
    this.metalnessNode = goldMask
    this.roughnessNode = mix(float(0.55), float(0.2), goldMask).add(warpSeen.mul(goldMask).mul(0.04))
// Warp floats are brushed along the tube, weft along the cross-section. The vector is (tangent, bitangent) strength.
    this.anisotropyNode = mix(vec2(0, 0.55), vec2(0.85, 0), goldMask)
    this.sheenNode = color(hsl.integer(270, 63, 58)).mul(grazing.pow(2).mul(0.6).add(0.12)).mul(goldMask.oneMinus())
    this.sheenRoughnessNode = float(0.38)
    this.clearcoat = 0.2
    this.clearcoatRoughness = 0.15
    const height = warpRidge.mul(0.0012).mul(warpSeen).mul(goldMask).add(weftRidge.mul(0.0009).mul(weftSeen).mul(goldMask.oneMinus()))
    this.normalNode = proceduralNormal(height, 1)
// A bright current of light travels the length of the knot: one period around the loop, once per two seconds.
    const sweep = along.mul(TAU).sub(time.mul(Math.PI)).cos().mul(0.5).add(0.5).pow(8)
    this.emissiveNode = color(hsl.integer(86, 73, 85)).mul(goldMask).mul(sweep.mul(0.3).add(0.02))
      .add(color(hsl.integer(8, 66, 44)).mul(roseMask).mul(0.04))
      .add(color(hsl.integer(270, 100, 70)).mul(grazing.pow(3)).mul(0.03))
  }
}
