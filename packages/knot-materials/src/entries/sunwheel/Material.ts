import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, exp, float, Fn, max, mix, mx_noise_float, mx_noise_vec3, positionViewDirection, sin, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/deepseek/lib/bumpNormal.ts'
import {voronoiSurface} from '../../candidates/deepseek/lib/voronoiSurface.ts'
import {filament} from '../../lib/filament.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const medallionCenters = [1.75, 3.55, 5.35] as const
/** Engine-turned waves, barleycorn cells and three sunburst medallions in one continuous dial. */
function dialFields(tube: Node<'vec2'>) {
  const q = vec2(tube.x.mul(88), tube.y.mul(10))
  const warp = mx_noise_vec3(q.mul(0.17).add(vec3(3.1, 7.7, 1.2))).xy
  const waveA = sin(q.x.mul(1.7).add(sin(q.y.mul(1.4).add(warp.y)).mul(1.6)).add(warp.x.mul(1.2)))
  const waveB = sin(q.y.mul(2.2).sub(sin(q.x.mul(1.1)).mul(1.3)))
  const wave = waveA.mul(0.6).add(waveB.mul(0.4))
  const cells = voronoiSurface(q.mul(vec2(0.5, 0.6)), vec2(44, 6), 13.1)
  const barley = sin(cells.d1.mul(TAU * 5).add(cells.random.x.mul(TAU))).mul(0.5).add(0.5)
  const rib = sin(q.x.mul(3.6).add(sin(q.y.mul(2.4)).mul(1.6)).add(warp.y.mul(0.8))).mul(0.5).add(0.5)
  const ribLine = rib.pow(2.4)
  const ribAa = rib.fwidth().max(0.001)
  const ribVisibility = ribAa.smoothstep(0.07, 0.22).oneMinus()
  const ribSharp = rib.smoothstep(float(0.56).sub(ribAa.mul(0.25)), float(0.72).add(ribAa.mul(0.25))).mul(ribVisibility).add(float(0.16).mul(ribVisibility.oneMinus()))
  let medallion: Node<'float'> = float(0)
  let dome: Node<'float'> = float(0)
  let goldRing: Node<'float'> = float(0)
  let jewel: Node<'float'> = float(0)
  for (const centre of medallionCenters) {
    const delta = vec2(tube.x.mul(7.177).sub(centre), tube.y.mul(0.8168).sub(0.408))
    const radius = delta.length()
    const angle = atan(delta.y, delta.x)
    const inside = radius.smoothstep(0.225, 0.252).oneMinus()
    const rays = sin(angle.mul(32).add(radius.mul(11)).add(time.mul(0.028))).mul(0.5).add(0.5)
    const rings = sin(radius.mul(112).add(time.mul(0.015))).mul(0.5).add(0.5)
    medallion = medallion.add(inside.mul(rays.mul(0.64).add(rings.mul(0.36))))
    dome = dome.add(inside)
    goldRing = max(goldRing, exp(radius.sub(0.238).pow2().mul(-16_000)))
    jewel = max(jewel, radius.smoothstep(0.026, 0.042).oneMinus())
  }
  const pattern = wave.mul(0.38).add(barley.mul(0.24)).add(ribLine.mul(0.34)).add(medallion.mul(0.86))
  return {
    barley,
    rib,
    ribLine,
    ribSharp,
    dome,
    goldRing,
    jewel,
    medallion,
    pattern,
    q,
  }
}
const dialPosition = Fn(([tube]: [Node<'vec2'>]) => {
  const {position: p, normal} = knotFrame(tube)
  const fields = dialFields(tube)
  const swell = sin(fields.q.x.mul(0.18).add(sin(fields.q.y.mul(0.42)).mul(0.85))).mul(0.0028)
  const height = swell.add(fields.dome.mul(0.0032)).add(fields.goldRing.mul(0.0013)).add(fields.jewel.mul(0.0008))
  return p.add(normal.mul(height))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.72)
    this.name = knotData.id
    const tube = uv()
    this.positionNode = dialPosition(tube)
    const epsilon = 0.0004
    const du = dialPosition(tube.add(vec2(epsilon, 0))).sub(dialPosition(tube.sub(vec2(epsilon, 0))))
    const dv = dialPosition(tube.add(vec2(0, epsilon))).sub(dialPosition(tube.sub(vec2(0, epsilon))))
    const surfaceNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const {grazing, near} = viewerFrame()
    const fields = dialFields(tube)
    const aa = fields.pattern.fwidth().max(0.01)
    const goldMask = fields.pattern.smoothstep(float(0.12).sub(aa), float(0.66).add(aa)).mul(0.8).add(fields.goldRing.mul(0.9)).max(fields.ribSharp.mul(0.85)).clamp()
    const enamelMask = goldMask.oneMinus()
    const patina = mx_noise_float(fields.q.mul(0.65).add(vec3(1.3, 6.4, 8.8))).mul(0.5).add(0.5)
    const goldBase = mix(color(hsl.integer(47, 88, 14)), color(hsl.integer(72, 88, 64)), fields.pattern.mul(0.5).add(0.5).add(patina.mul(0.1)).clamp())
    const gold = mix(goldBase, color(hsl.integer(89, 100, 92)), fields.pattern.smoothstep(0.86, 1).mul(0.26))
    const enamel = mix(mix(color(hsl.integer(260, 70, 3.4)), color(hsl.integer(262, 91, 24)), fields.pattern.mul(0.5).add(0.5)), color(hsl.integer(286, 78, 12)), patina.mul(0.4))
    const ruby = mix(color(hsl.integer(13, 100, 11)), color(hsl.integer(19, 100, 59.8)), fields.jewel.pow(2).mul(0.85))
    const body = mix(mix(enamel, gold, goldMask), ruby, fields.jewel)
    this.colorNode = body
    this.metalnessNode = goldMask.mul(fields.jewel.oneMinus())
    this.roughnessNode = mix(mix(float(0.14), float(0.13), goldMask), float(0.045), fields.jewel)
    this.ior = 1.52
    this.clearcoatNode = enamelMask.mul(0.92).add(fields.jewel)
    this.clearcoatRoughnessNode = float(0.028).add(patina.mul(0.018))
// The groove direction is almost longitudinal, so every carved line catches the panels independently.
    this.anisotropyNode = vec2(1, sin(fields.q.x.mul(0.06)).mul(0.36)).normalize().mul(0.86)
// Crisp engraving relief over the broad domes, with a few microscopic scratches at close range.
    const scratch = filament(mx_noise_float(fields.q.mul(0.34).add(vec3(4.1, 2.2, 7.3))), 0.0025).mul(near).mul(0.00018)
    const engraved = fields.pattern.mul(0.00062).add(fields.ribLine.mul(0.00034)).add(fields.barley.mul(0.00012)).add(fields.medallion.mul(0.00024)).add(fields.goldRing.mul(0.0007)).add(fields.jewel.mul(0.0005)).add(scratch)
    const detailFade = fields.q.fwidth().length().smoothstep(0.05, 0.28).oneMinus()
    const bump = bumpNormal(engraved, surfaceNormal, detailFade.mul(1.15).add(0.2))
    this.normalNode = bump
    this.clearcoatNormalNode = bump
    const facing = surfaceNormal.dot(positionViewDirection).abs().clamp()
    const beat = sin(time.mul(1.1)).max(0).pow(6).mul(0.55).add(0.45)
    const rubyGlow = color(hsl.integer(20, 100, 59.3)).mul(fields.jewel.mul(beat).mul(0.28))
    const goldGlint = glints(surfaceNormal, 75).mul(goldMask).mul(near.mul(0.35).add(0.15)).mul(0.42)
    const enamelRim = color(hsl.integer(271, 100, 51)).mul(grazing.pow(3)).mul(0.16)
    this.emissiveNode = rubyGlow.add(color(hsl.integer(88, 100, 94)).mul(goldGlint)).add(enamelRim)
      .add(color(hsl.integer(89, 62, 48)).mul(facing.pow(6)).mul(0.025))
  }
}
