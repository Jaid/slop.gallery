import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** A woven damask medallion in a diamond trellis. The medallion is an eight-petalled rosette with two engraved rings, a raised heart and veins running out along every petal; neighboring cells are stitched together by the trellis and its corner beads, so the cloth reads as one continuous brocade rather than a sheet of stamps. */
function damask(tube: Node<'vec2'>) {
  const grid = vec2(16, 3)
  const q = tube.mul(grid)
  const cell = wrapCell(q.floor(), grid)
  const local = q.fract().sub(0.5)
  const random = cellNoiseVec3(vec3(cell, 4.73))
  const aa = q.fwidth().length().max(0.001)
  // Medallions are woven ovals, longer along the cloth than across it.
  const r = vec2(local.x.mul(0.82), local.y.mul(1.08)).length().max(0.0001)
  const angle = mx_atan2(local.y, local.x.add(0.000001)) as unknown as Node<'float'>
  const petalBoundary = angle
    .mul(8)
    .cos()
    .mul(0.048)
    .add(angle.mul(4).cos().mul(0.018))
    .add(0.325)
  const motif = r.smoothstep(petalBoundary.sub(aa), petalBoundary.add(aa)).oneMinus()
  const ring = filteredRibbon(r.sub(0.232), 0.016)
  const innerRing = filteredRibbon(r.sub(0.135), 0.009)
  const center = r.smoothstep(0.04, 0.08).oneMinus()
  const petalVein = angle.mul(8).cos().mul(0.5).add(0.5)
  const diamond = local.x.abs().add(local.y.abs())
  const trellis = filteredRibbon(diamond.sub(0.485), 0.014)
  const cornerDist = vec2(local.x.abs().sub(0.5), local.y.abs().sub(0.5)).length()
  const cornerDot = cornerDist.smoothstep(0.045, 0.085).oneMinus()
  const leafDist = vec2(local.x.abs().sub(0.5), local.y.abs()).length().min(vec2(local.x.abs(), local.y.abs().sub(0.5)).length())
  const edgeLeaf = leafDist.smoothstep(0.035, 0.07).oneMinus()
  // Gold thread is laid diagonally across every medallion, never quite alike.
  const threadBands = opticalBands(local.x.mul(42).add(local.y.mul(17)).add(random.x.mul(6.2831)))
  return {
    angle,
    center,
    cornerDot,
    edgeLeaf,
    innerRing,
    local,
    motif,
    petalVein,
    q,
    random,
    ring,
    threadBands,
    trellis,
  }
}
/** Plain-weave silk at thread scale: warp and weft take turns passing over one another, producing the tiny checkerboard relief a fingertip would feel. The weave is honestly resolved – as soon as a thread falls below a pixel it retires into smooth silk instead of shimmering – and a slow diagonal slub keeps long runs of ground cloth from ever looking printed. */
function weave(tube: Node<'vec2'>) {
  const threads = tube.mul(vec2(430, 130))
  const resolved = threads.fwidth().length().smoothstep(0.4, 1.3).oneMinus()
  const warp = threads.x.mul(TAU).sin()
  const weft = threads.y.mul(TAU).sin()
  const height = warp.mul(weft).mul(0.00042).mul(resolved)
  const slub = opticalBands(tube.x.mul(TAU * 46).add(tube.y.mul(TAU * 7)))
  return {
    height,
    resolved,
    slub,
  }
}

/** Imperial plum silk under gold thread. The damask obeys the oldest trick of jacquard weaving: face a medallion squarely and it nearly vanishes into the ground, caught in passing it blazes – so the pattern does not sit on the knot, it patrols it as you walk. Under the gold, plain-weave threads cross at fingertip scale and retire politely with distance, the silk ground shifts from plum to peacock in the sheen, and once per exhibition loop a slow shimmer crosses the court like light moving along a hem. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, grazing, intimate} = viewerFrame()
    const pattern = damask(tube)
    const cloth = weave(tube)
    const loop = time.mul(Math.PI)
    const silkWarp = mx_noise_float(p.mul(2.6)).mul(0.5).add(0.5).clamp()
    let silk = mix(color(hsl.integer(358, 69, 10)), color(hsl.integer(5, 77, 25)), silkWarp)
    silk = mix(silk, color(hsl.integer(6, 76, 32)), cloth.slub.mul(0.2))
    const goldDust = cellularPoints(p.mul(24), 0.04, 0.16, 0.72).mul(intimate.mul(0.5).add(0.2))
    const goldMask = pattern.motif
      .mul(0.92)
      .add(pattern.ring)
      .add(pattern.innerRing.mul(0.7))
      .add(pattern.center)
      .add(pattern.trellis.mul(0.75))
      .add(pattern.cornerDot.mul(0.8))
      .add(pattern.edgeLeaf.mul(0.55))
      .add(goldDust.mul(0.35))
      .clamp()
    let gold = mix(color(hsl.integer(48, 91, 29)), color(hsl.integer(75, 79, 74)), pattern.threadBands)
    gold = mix(gold, color(hsl.integer(92, 100, 92.7)), facing.pow(2).mul(0.55)).mul(pattern.petalVein.mul(0.25).add(0.82))
    const jacquard = float(0.52).add(grazing.pow(1.35).mul(0.55))
    const shimmer = tube.x.mul(TAU * 2).sub(loop).sin().mul(0.5).add(0.5)
    const sparkle = glints(normalViewGeometry, 120)
      .mul(goldMask)
      .mul(pattern.random.z.smoothstep(0.55, 0.85))
      .mul(shimmer.mul(0.45).add(0.75))
    const height = pattern.motif
      .mul(0.0018)
      .add(pattern.ring.mul(0.0026))
      .add(pattern.center.mul(0.0032))
      .add(pattern.trellis.mul(0.0011))
      .add(pattern.edgeLeaf.mul(0.0015))
      .add(cloth.height.mul(intimate.mul(0.7).add(0.3)))
    this.colorNode = mix(silk, gold, goldMask.mul(jacquard).clamp())
    this.metalnessNode = goldMask.mul(0.9)
    this.roughnessNode = mix(float(0.54), float(0.23).add(pattern.threadBands.mul(0.2)), goldMask)
    this.normalNode = proceduralNormal(height, 1)
    this.aoNode = float(0.76).add(goldMask.mul(0.24))
    this.anisotropy = 0.7
    this.anisotropyNode = mix(vec2(0.12, 0), vec2(0.82, 0), goldMask)
    this.sheenNode = mix(color(hsl.integer(5, 76, 31)), color(hsl.integer(187, 91, 41)), grazing.pow(2))
      .mul(pattern.motif.mul(0.35).add(0.95))
      .mul(1.15)
    this.sheenRoughnessNode = mix(float(0.48), float(0.3), goldMask)
    this.clearcoat = 0.12
    this.clearcoatRoughness = 0.5
    this.emissiveNode = color(hsl.integer(92, 100, 92.7))
      .mul(sparkle.mul(0.55))
      .add(gold.mul(grazing.pow(4)).mul(goldMask).mul(0.22))
  }
}
