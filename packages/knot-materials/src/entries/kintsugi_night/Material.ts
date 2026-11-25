import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_noise_float, positionGeometry, vec3} from 'three/tsl'

import {glitter} from '../../candidates/claude_sonnet/lib/glitter.ts'
import {loopPhase} from '../../candidates/claude_sonnet/lib/loopClock.ts'
import {rgb} from '../../candidates/claude_sonnet/lib/rgb.ts'
import {voronoi} from '../../candidates/claude_sonnet/lib/voronoi.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Plates per object unit for the large shards, and for the secondary hairline mends. */
const shardScale = 6.2
const hairScale = 17
/** Black crackle-glaze porcelain, shattered along a 3D Voronoi lattice and mended with hammered gold. The seams stand proud of the glaze as real relief, so the gold's reflections roll around each rounded bead; heat travels through the mends in slow waves and the glaze beside them blushes with the same warm light, as if a lamp had been left burning inside the wound. Every shard is warped a little differently, so its reflection of the room breaks at the seam – walk around and the plates flash one after another. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const p = positionGeometry
    const {near, intimate, grazing, facing} = viewerFrame()
    const shards = voronoi(p.mul(shardScale))
    const shardWall = shards.x.div(shardScale)
    const shardId = shards.yzw
    const shard = cellNoiseVec3(shardId.add(11.3))
    const hair = voronoi(p.mul(hairScale).add(40))
    const hairWall = hair.x.div(hairScale)
    const hairRegion = mx_noise_float(p.mul(3.1).add(vec3(7, 2, -4))).mul(0.5).add(0.5).smoothstep(0.5, 0.62)
// A brushed lacquer line is never uniform: it swells and thins along its length.
    const swell = mx_noise_float(p.mul(21).add(5)).mul(0.5).add(0.5)
    const halfWidth = swell.mul(0.0032).add(0.0028).add(shard.x.mul(0.0012))
    const hairWidth = swell.mul(0.0009).add(0.0011)
    const footprint = shardWall.fwidth().max(1e-5)
    const goldMain = shardWall.smoothstep(halfWidth, halfWidth.add(footprint.mul(1.1))).oneMinus()
    const hairFootprint = hairWall.fwidth().max(1e-5)
    const goldHair = hairWall.smoothstep(hairWidth, hairWidth.add(hairFootprint.mul(1.1))).oneMinus().mul(hairRegion).mul(hairFootprint.smoothstep(0.004, 0.016).oneMinus())
    const gold = goldMain.max(goldHair)
// Section of a rounded bead: full height at the middle of the seam, falling to the glaze at its edge.
    const bead = shardWall.div(halfWidth).clamp(0, 1).pow2().oneMinus().sqrt().mul(goldMain)
    const beadHair = hairWall.div(hairWidth).clamp(0, 1).pow2().oneMinus().sqrt().mul(goldHair)
    const hammer = mx_noise_float(p.mul(210)).mul(near.mul(0.7).add(0.15)).mul(0.00045).mul(footprint.smoothstep(0.0004, 0.0016).oneMinus())
    const shardWarp = mx_noise_float(p.mul(8.5).add(shard.mul(9))).mul(0.0026).add(shard.x.sub(0.5).mul(0.0042))
    const relief = mix(shardWarp, bead.mul(0.0046).add(beadHair.mul(0.0024)).add(hammer), gold)
    this.normalNode = proceduralNormal(relief, 1)
    this.clearcoatNormalNode = proceduralNormal(shardWarp.mul(gold.oneMinus()), 1)
    const ink = rgb(hsl.integer(273, 38, 3.4))
    const glaze = mix(mix(ink, rgb(hsl.integer(263, 55, 9)), shard.y), mix(rgb(hsl.integer(350, 56, 7)), rgb(hsl.integer(185, 80, 12)), shard.z), shard.x.smoothstep(0.62, 0.8).mul(0.75))
    const goldColor = rgb(hsl.integer(74, 100, 78.9))
    const bright = rgb(hsl.integer(86, 100, 90.7))
    this.colorNode = mix(glaze.mul(shard.z.mul(0.5).add(0.6)), mix(goldColor, bright, bead.mul(0.4)), gold)
    this.metalnessNode = gold
    this.roughnessNode = mix(float(0.06), mix(float(0.27), float(0.14), bead), gold)
    this.clearcoatNode = gold.oneMinus()
    this.clearcoatRoughness = 0.018
    this.iridescenceNode = gold.oneMinus().mul(0.3)
    this.iridescenceIOR = 1.45
    this.iridescenceThicknessNode = mx_noise_float(p.mul(5.5)).mul(180).add(330)
// Slow waves of heat travelling through the mends, and the halo they throw onto the glaze.
    const along = p.x.mul(0.8).add(p.y.mul(0.55)).add(p.z.mul(1.1))
    const wave = along.mul(9).sub(loopPhase).sin().mul(0.5).add(0.5).pow(3)
    const slow = along.mul(-4.5).add(p.y.mul(6)).add(loopPhase.mul(2)).sin().mul(0.5).add(0.5)
    const heat = wave.mul(0.6).add(slow.mul(0.4)).mul(intimate.mul(0.5).add(0.5))
    const halo = shardWall.mul(-70).exp().mul(gold.oneMinus()).mul(0.75)
    const ember = rgb(hsl.integer(49, 100, 68))
    const sparkle = glitter(p, 0.0065, 140, 0.6).sparkle
    this.emissiveNode = ember.mul(gold.mul(heat.mul(0.55).add(0.06)).add(halo.mul(heat.mul(0.11).add(0.012))))
      .add(bright.mul(sparkle).mul(gold).mul(0.5))
      .add(rgb(hsl.integer(65, 100, 76.3)).mul(grazing.pow(3)).mul(gold).mul(facing.add(0.4)).mul(0.03))
  }
}
