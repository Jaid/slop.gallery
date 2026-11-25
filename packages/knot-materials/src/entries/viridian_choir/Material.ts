import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, uv, vec2} from 'three/tsl'

import {buriedUv, reflectedLight} from '../../candidates/gpt_sol/lib/exhibition/buriedOptics.ts'
import {exhibitionPhase} from '../../candidates/gpt_sol/lib/exhibition/clock.ts'
import {fill, resolved, stroke, tiles, turn} from '../../candidates/gpt_sol/lib/exhibition/ornamentFields.ts'
import {beads} from '../../lib/beads.ts'
import {displacementView} from '../../lib/displacementView.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function fern(tube: Node<'vec2'>, counts: [number, number], seed: number, openness: Node<'float'>) {
  const {local, random} = tiles(tube, counts, seed)
  const gust = exhibitionPhase.mul(2).add(tube.x.mul(TAU * 4)).add(tube.y.mul(TAU * 2)).sin()
  const q = turn(local, random.z.sub(0.5).mul(0.7)).sub(vec2(gust.mul(0.017), 0))
  const axis = q.x.sub(q.y.mul(6).sin().mul(0.026))
  const stem = stroke(axis, 0.006).mul(fill(q.y.abs().sub(0.415)))
  let foliage: Node<'float'> = stem
  let veins: Node<'float'> = stem
  let raw: Node<'float'> = float(0)
  let light: Node<'float'> = float(0)
  for (let i = 0;i < 6;i++) {
    for (const side of [-1, 1]) {
      const y = -0.315 + i * 0.116
      const length = 0.068 + Math.sin((i + 0.5) / 6 * Math.PI) * 0.034
      const center = vec2(side * 0.118 + Math.sin(y * 6) * 0.026, y + 0.022)
      const leaf = turn(q.sub(center), openness.mul(0.2).add(0.28).mul(-side))
      const ellipsoid = vec2(leaf.x.div(length), leaf.y.div(openness.mul(0.013).add(0.019))).length()
      const body = fill(ellipsoid.sub(1))
      const rawBody = ellipsoid.smoothstep(0.87, 1.08).oneMinus()
      const vein = stroke(leaf.y, 0.0025).mul(body)
      const tinyVeins = stroke(leaf.x.mul(105).add(leaf.y.abs().mul(195)).sin(), 0.11).mul(body).mul(0.42)
      foliage = foliage.max(body)
      veins = veins.max(vein).max(tinyVeins)
      raw = raw.max(rawBody.mul(ellipsoid.pow2().oneMinus().max(0).sqrt()))
      light = light.max(body.mul(leaf.x.mul(side).div(length).mul(0.25).add(0.6)).mul(0.55 + i * 0.07))
    }
  }
  return {
    foliage,
    veins,
    raw,
    light,
    random,
    q,
  }
}

/** Overlapping fern pinnae with embossed midribs, a living moss floor, clear dew and drifting pollen. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near} = viewerFrame()
    const {intimate} = displacementView()
    const openness = intimate.mul(0.7).add(exhibitionPhase.sin().mul(0.07)).add(0.23).clamp()
    const upper = fern(tube, [30, 4], 127, openness)
    const lower = fern(buriedUv(tube, view, 0.016, 1.18), [20, 3], 137, openness.mul(0.6))
    const mossQ = p.mul(160)
    const moss = mx_noise_float(mossQ).mul(resolved(mossQ)).mul(0.5).add(0.5)
    const humidity = mx_noise_float(p.mul(7)).mul(0.5).add(0.5)
    const floor = mix(color(hsl.integer(171, 78, 10)), color(hsl.integer(146, 87, 26)), moss.mul(0.6).add(humidity.mul(0.4)))
    const oldLeaves = mix(color(hsl.integer(168, 86, 21)), color(hsl.integer(148, 83, 48)), lower.light)
    let forest: Node<'vec3'> = mix(floor, oldLeaves, lower.foliage.mul(0.7))
    const leafColor = mix(color(hsl.integer(158, 95, 36)), color(hsl.integer(125, 77, 80)), upper.light.mul(0.67).add(upper.random.y.mul(0.14)))
    forest = mix(forest, leafColor, upper.foliage)
    forest = mix(forest, color(hsl.integer(121, 64, 81)), upper.veins.mul(0.26))
// A few five-petal flowers, small enough to reward a close visit rather than cover the whole forest.
    const flowerP = upper.q.sub(vec2(0.22, 0.3))
    const flowerAngle = flowerP.y.atan(flowerP.x)
    const flowerR = flowerP.length()
    const flower = fill(flowerR.sub(flowerAngle.mul(5).cos().mul(0.009).add(0.031)))
      .mul(upper.random.x.smoothstep(0.87, 0.9))
    const pollenHeart = fill(flowerR.sub(0.009)).mul(flower)
    forest = mix(forest, color(hsl.integer(96, 57, 93.5)), flower)
    forest = mix(forest, color(hsl.integer(78, 90, 70)), pollenHeart)
    const dewQ = p.mul(74).add(13.5)
    const dew = beads(dewQ, 149)
    const droplets = dew.mask.mul(humidity.smoothstep(0.4, 0.65)).mul(near)
    this.colorNode = mix(forest, color(hsl.integer(152, 45, 60)), droplets.mul(0.18))
    this.metalness = 0
    this.roughnessNode = float(0.75).sub(upper.foliage.mul(0.3)).sub(droplets.mul(0.4)).clamp(0.055, 0.8)
    this.clearcoatNode = upper.foliage.mul(0.28).max(droplets.mul(0.98))
    this.clearcoatRoughnessNode = mix(float(0.19), float(0.025), droplets)
    this.sheenNode = color(hsl.integer(140, 72, 73)).mul(upper.foliage).mul(0.16)
    this.sheenRoughness = 0.65
    this.ior = 1.36
    const relief = upper.raw.mul(0.0046).add(humidity.mul(0.0007))
    this.positionNode = positionGeometry.add(normalLocal.mul(relief))
    this.normalNode = proceduralNormal(relief.add(upper.veins.mul(0.00032)).add(dew.cap.mul(droplets).mul(0.0014)).add(moss.mul(intimate).mul(0.00008)), 1)
    const drift = vec2(exhibitionPhase.cos(), exhibitionPhase.sin()).mul(0.14)
    const pollenUv = buriedUv(tube, view, -0.012, 1.18).add(drift.div(vec2(310, 36)))
    const pollenCells = tiles(pollenUv, [310, 36], 151, false)
    const pollenCenter = vec2(pollenCells.random.y, pollenCells.random.z).sub(0.5).mul(0.5)
    const pollen = stroke(pollenCells.local.sub(pollenCenter).length(), 0.027)
      .mul(pollenCells.random.x.smoothstep(0.96, 0.975)).mul(resolved(pollenCells.coordinate)).mul(intimate)
    const glints = reflectedLight(environment, normalLocal.normalize(), 0.035).mul(droplets).mul(dew.cap)
    this.emissiveNode = color(hsl.integer(87, 86, 83)).mul(pollen).mul(0.7)
      .add(glints.mul(0.13)).add(color(hsl.integer(134, 75, 70)).mul(upper.light).mul(upper.foliage).mul(facing.mul(0.7).add(grazing)).mul(0.035))
  }
}
