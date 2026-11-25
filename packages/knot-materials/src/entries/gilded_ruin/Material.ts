import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, Fn, mix, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {fbm} from '../../candidates/space_bunny/lib/fbm.ts'
import {ridgeBand} from '../../candidates/space_bunny/lib/ridgeBand.ts'
import {normalDetail} from '../../candidates/space_bunny/lib/surfaceGradient.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Domain-warped fbm level sets: connected branching networks, the way lacquer actually crazes. */
function fissures(q: Node<'vec3'>) {
  const warp = fbm(q.mul(2.3))
  const warpB = fbm(q.mul(2.3).add(vec3(4.1, -1.7, 2.8)))
  const veinField = fbm(q.mul(3.1).add(warpB.mul(2.6)))
  const hairField = fbm(q.mul(10.5).add(warp.mul(3.2)))
  const swell = fbm(q.mul(1.15), 2)
  return {
    swell,
    seam: ridgeBand(veinField, 0, 0.05),
    hairline: ridgeBand(hairField, 0, 0.03),
  }
}
/** Gold reached some cracks and is still creeping along the rest. */
function pour(q: Node<'vec3'>, seam: Node<'float'>, clock: Node<'float'>) {
  const drift = fbm(q.mul(0.9).add(vec3(clock.mul(0.02), 0, clock.mul(-0.013))))
  return drift.mul(1.7).add(seam.mul(0.6)).smoothstep(0.08, 0.32).mul(seam)
}
const relief = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  const {seam, hairline} = fissures(position)
  const height = seam.mul(-0.55).add(hairline.mul(-0.14)).add(pour(position, seam, time).mul(0.38))
  return position.add(normal.mul(height.mul(knotData.displacement)))
})
/** Urushi lacquer mended in gold. The lacquer is a black mirror that swallows the room; the repairs are poured metal that flares as the studio sweeps past, and the pour has never quite finished creeping outward. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.4)
    this.name = knotData.id
    const tube = uv()
    const {p, grazing, near, intimate} = viewerFrame()
    this.positionNode = relief(tube)
    const epsilon = 0.0002
    const du = relief(tube.add(vec2(epsilon, 0))).sub(relief(tube.sub(vec2(epsilon, 0))))
    const dv = relief(tube.add(vec2(0, epsilon))).sub(relief(tube.sub(vec2(0, epsilon))))
    const reliefNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const {seam, hairline, swell} = fissures(p)
    const gold = pour(p, seam, time)
    const goldCore = gold.pow(1.35)
    const lacquer = color(hsl.integer(51, 32, 4)).mul(swell.mul(0.5).add(0.8))
    const goldTint = mix(color(hsl.integer(61, 90, 31)), color(hsl.integer(82, 100, 84.4)), goldCore.pow(0.3).mul(0.55).add(grazing.mul(0.45)))
    this.colorNode = mix(lacquer, goldTint, gold).mul(hairline.mul(-0.4).add(1))
    this.metalnessNode = gold
    this.roughnessNode = gold.mul(0.26).add(0.045).add(hairline.mul(0.08)).add(grazing.mul(0.04))
    this.clearcoat = 1
    this.clearcoatRoughnessNode = gold.oneMinus().mul(0.045).add(0.015)
    const micro = fbm(p.mul(44), 2).mul(0.4).add(fbm(p.mul(115), 2).mul(0.12))
    const hammer = fbm(p.mul(18), 2).mul(gold)
    const surface = seam.mul(-0.3).add(hairline.mul(-0.14)).add(goldCore.mul(0.14)).add(micro.mul(near.mul(0.85).add(0.15))).add(hammer)
    this.normalNode = normalDetail(reliefNormal, surface.mul(0.0018), 0.9)
    const leafFleck = fbm(p.mul(55), 2).smoothstep(0.2, 0.3).mul(gold).mul(near)
    this.emissiveNode = color(hsl.integer(45, 100, 65)).mul(seam.mul(gold.oneMinus()).mul(0.85))
      .add(color(hsl.integer(75, 100, 82)).mul(goldCore).mul(intimate.mul(0.5).add(0.75)))
      .add(color(hsl.integer(90, 100, 97)).mul(leafFleck).mul(0.9))
    this.envMapIntensity = 0.4
  }
}
