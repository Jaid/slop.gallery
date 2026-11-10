import type {Node, Texture} from 'three/webgpu'

import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, time, uv, vec3} from 'three/tsl'

import {environmentRadiance} from '../../candidates/claude_opus/lib/environmentRadiance.ts'
import {coverage, pixelFootprint} from '../../candidates/claude_opus/lib/footprint.ts'
import {knotFrame} from '../../candidates/claude_opus/lib/knotFrameOpus55.ts'
import {tubeInterior} from '../../candidates/claude_opus/lib/tubeInterior.ts'
import {tubeRelief} from '../../candidates/claude_opus/lib/tubeRelief.ts'
import {voronoi3d} from '../../candidates/claude_opus/lib/voronoi3d.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {knotCurve} from '../../lib/knotCurve.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const shardScale = 2.1
/** The mended fracture network: signed distance to the gold lacquer (object units, negative inside). */
function fracture(position: Node<'vec3'>) {
  const warp = mx_noise_vec3(position.mul(1.3).add(5.1)).mul(0.42)
  const shards = voronoi3d(position.mul(shardScale).add(warp), 3)
// F2 − F1 is about twice the distance to the break
  const distance = shards.gap.div(shardScale * 2)
// broad meanders, plus chipped, jagged lips where the shards met
  const meander = mx_noise_float(position.mul(46)).mul(0.0009).add(mx_noise_float(position.mul(210)).mul(0.00035))
  const halfWidth = mx_noise_float(position.mul(9).add(2.7)).mul(0.0016).add(0.0042)
// some breaks were never filled: they stay hairline cracks
  const filled = mx_noise_float(position.mul(1.6).add(11)).smoothstep(-0.42, -0.15)
  return {
    crack: distance.add(meander),
    gold: distance.add(meander).sub(halfWidth.mul(filled)).add(filled.oneMinus().mul(0.01)),
    halfWidth,
    shard: shards.identity,
  }
}
/** Crackle lines of a craquelure network at `scale`, as a distance in object units. */
function crackle(position: Node<'vec3'>, scale: number, seed: number) {
  const warp = mx_noise_vec3(position.mul(scale * 0.35).add(seed)).mul(0.35)
  return voronoi3d(position.mul(scale).add(warp), seed).gap.div(scale * 2)
}
/** Kintsugi on Ge-ware celadon. A thick jade glaze, pooled darker where it ran deep, is crazed twice over: bold "iron wire" cracks and a finer "gold thread" net just beneath the surface, shifting with parallax. Across it run the old breaks, filled with raised gold lacquer — and the gold is not quite cold: a slow light travels along the scars, warming as the visitor draws near. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const tube = uv()
    const {objectDistance, grazing} = viewerFrame()
    const intimate = objectDistance.smoothstep(0.9, 2.3).oneMinus()
    const pixel = pixelFootprint().balanced
    const frame = knotFrame(tube)
    const surface = frame.position
// glaze runs off the outer curves and pools on the inside of every bend
    const bendAngle = tube.x.mul(Math.PI * 4)
    const curvature = knotCurve(bendAngle.add(0.02)).add(knotCurve(bendAngle.sub(0.02))).sub(frame.center.mul(2))
    const inside = frame.normal.dot(curvature.normalize()).mul(curvature.length().mul(900).clamp()).smoothstep(-0.3, 0.8)
    const breaks = fracture(surface)
    const gold = coverage(breaks.gold, pixel)
// craquelure lies inside the glaze, so it drifts against the surface as the head moves
    const interior = tubeInterior({ior: 1.55})
    const glazeDepth = interior.sample(0.0035).position
    const ironWire = crackle(glazeDepth, 11, 21)
    const goldThread = crackle(interior.sample(0.0015).position, 31, 43)
    const lineCover = (distance: Node<'float'>, halfWidth: number) => coverage(distance.sub(halfWidth), pixel).mul(float(halfWidth * 2.5).div(pixel).min(1))
    const iron = lineCover(ironWire, 0.0008)
    const thread = lineCover(goldThread, 0.0003).mul(intimate.mul(0.6).add(0.4))
    const hairline = lineCover(breaks.crack, 0.0005).mul(gold.oneMinus())
// glaze pooled in slow runs: thicker glaze is deeper and greener
    const pooling = mx_fractal_noise_float(surface.mul(vec3(2.2, 2.2, 3.1)), 3, 2, 0.5).mul(0.35).add(inside.mul(0.9)).sub(0.05)
    const shardTone = breaks.shard.x.sub(0.5).mul(0.06)
    const glaze = mix(color('#5f9270'), color('#1f5236'), pooling.pow(1.2).add(shardTone).clamp()).mul(mx_noise_float(surface.mul(90)).mul(0.03).add(1))
    const crazed = mix(mix(glaze, color('#a07a2e'), thread.mul(0.6)), color('#15110d'), iron.mul(0.9))
    const craquelure = mix(crazed, color('#2a2016'), hairline)
    const lacquer = mix(color('#b8862b'), color('#f2cf73'), mx_noise_float(surface.mul(160)).mul(0.5).add(0.5).mul(0.5).add(breaks.shard.y.mul(0.2)))
// raw urushi shows as a dark lip where the gold powder thinned out
    const lip = coverage(breaks.gold.sub(0.0007), pixel).mul(gold.oneMinus())
// the glaze pools and darkens against the raised seam
    const seamPool = breaks.gold.div(0.006).clamp().oneMinus().mul(gold.oneMinus())
// makie: gold powder sparkles in the lacquer
    const powder = cellularPoints(surface.mul(700), 0.03, 0.16, 0.55).mul(pixel.mul(700).smoothstep(0.3, 0.8).oneMinus())
    this.colorNode = mix(mix(craquelure.mul(seamPool.mul(-0.45).add(1)), color('#2b1609'), lip), lacquer.mul(powder.mul(0.35).add(0.85)), gold)
    this.metalnessNode = gold
    this.roughnessNode = mix(float(0.16).add(pooling.mul(0.05)).add(iron.mul(0.2)), mx_noise_float(surface.mul(220)).mul(0.08).add(0.24).sub(powder.mul(0.12)), gold)
    this.clearcoatNode = gold.oneMinus().mul(0.6)
    this.clearcoatRoughness = 0.07
    this.specularIntensity = 0.5
    this.ior = 1.55
// lacquer stands proud of the glaze in a rounded bead; open cracks dip slightly
    this.normalNode = tubeRelief(at => {
      const b = fracture(knotFrame(at).position)
      const bead = b.gold.negate().div(b.halfWidth).clamp().sqrt().mul(0.0026)
      const dip = b.crack.div(0.0008).clamp().oneMinus().mul(-0.00012)
      return bead.add(dip)
    }).viewNormal
// tiny seed bubbles suspended in the glaze catch the light like dew
    const bubbles = cellularPoints(interior.sample(0.006).position.mul(260), 0.04, 0.14, 0.82).mul(pixel.mul(260).smoothstep(0.3, 0.8).oneMinus())
// light scattered inside the thick glaze gives it the soft inner glow of jade
    const glazeGlow = environmentRadiance(environment, interior.direction, 0.6).mul(vec3(0.08, 0.3, 0.15)).mul(pooling.mul(0.08).add(0.05))
// the living scar: light flows slowly along the gold, and warms toward an approaching visitor
    const flow = mx_noise_float(surface.mul(3.1).add(vec3(time.mul(0.11), time.mul(-0.07), time.mul(0.05)))).mul(2.4).add(surface.dot(vec3(1.3, -0.7, 0.9)).mul(9)).sub(time.mul(0.9)).sin().mul(0.5).add(0.5).pow(4)
    const warmth = color('#ff9a3c').mul(flow.mul(0.8).add(0.12)).mul(intimate.mul(0.75).add(0.1)).mul(gold).mul(grazing.oneMinus().mul(0.5).add(0.5))
    this.emissiveNode = warmth.add(color('#eef8f0').mul(bubbles).mul(0.25)).add(glazeGlow.mul(gold.oneMinus()))
  }
}
