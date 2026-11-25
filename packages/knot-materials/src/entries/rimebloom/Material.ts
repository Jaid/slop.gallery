import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, Fn, max, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, positionViewDirection, sin, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/deepseek/lib/bumpNormal.ts'
import {voronoiSurface} from '../../candidates/deepseek/lib/voronoiSurface.ts'
import {beads} from '../../lib/beads.ts'
import {filament} from '../../lib/filament.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const largePeriod = vec2(28, 4)
const finePeriod = vec2(80, 10)
/** A crystalline star grown from one frozen nucleus inside each Voronoi cell. */
function frostStar(point: Node<'vec2'>, period: Node<'vec2'>, seed: number, spokes: number) {
  const cells = voronoiSurface(point, period, seed)
  const local = point.sub(cells.cell)
  const centre = cells.random.xy.mul(0.8).add(0.1)
  const radial = local.sub(centre).add(vec2(0.0001))
  const radius = radial.length()
  const angle = atan(radial.y, radial.x)
  const count = cells.random.z.mul(4).add(spokes)
  const wobble = sin(radius.mul(24).add(cells.random.x.mul(TAU))).mul(1.15)
  const needle = sin(angle.mul(count).add(wobble).add(cells.random.y.mul(TAU))).max(0).pow(16)
  const reach = radius.smoothstep(0.45, 0.85).oneMinus().mul(cells.edge.smoothstep(0.005, 0.06))
  const star = needle.mul(reach)
  return {
    cells,
    radius,
    star,
  }
}
const frostPosition = Fn(([tube]: [Node<'vec2'>]) => {
  const {position: p, normal} = knotFrame(tube)
  const patch = mx_fractal_noise_float(p.mul(1.7).add(vec3(3.7, 8.1, 1.4)), 4, 2.04, 0.55).mul(0.5).add(0.5)
  const crust = patch.smoothstep(0.3, 0.6).mul(0.0042)
  const swell = mx_noise_float(p.mul(2.35).add(vec3(0.8, 2.1, 7.2))).mul(0.0024)
  return p.add(normal.mul(crust.add(swell)))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const tube = uv()
    this.positionNode = frostPosition(tube)
    const epsilon = 0.0004
    const du = frostPosition(tube.add(vec2(epsilon, 0))).sub(frostPosition(tube.sub(vec2(epsilon, 0))))
    const dv = frostPosition(tube.add(vec2(0, epsilon))).sub(frostPosition(tube.sub(vec2(0, epsilon))))
    const surfaceNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const {p, grazing, near} = viewerFrame()
    const largeWarp = mx_noise_vec3(p.mul(2.1).add(vec3(1.1, 4.3, 8.7))).xy.mul(0.48)
    const fineWarp = mx_noise_vec3(p.mul(5.4).add(vec3(6.2, 2.8, 0.4))).xy.mul(0.3)
    const large = frostStar(tube.mul(largePeriod).add(largeWarp), largePeriod, 3.3, 6)
    const fine = frostStar(tube.mul(finePeriod).add(fineWarp), finePeriod, 7.7, 11)
    const largePoint = tube.mul(largePeriod).add(largeWarp)
    const finePoint = tube.mul(finePeriod).add(fineWarp)
    const largeFade = largePoint.fwidth().length().smoothstep(0.06, 0.22).oneMinus()
    const fineFade = finePoint.fwidth().length().smoothstep(0.05, 0.2).oneMinus()
    const patch = mx_fractal_noise_float(p.mul(1.7).add(vec3(3.7, 8.1, 1.4)), 4, 2.04, 0.55).mul(0.5).add(0.5)
    const breath = sin(time.mul(0.09).add(p.x.mul(2.2)).add(p.z.mul(1.3))).mul(0.028)
    const region = mx_noise_float(p.mul(1.15).add(vec3(8.2, 3.4, 6.1))).mul(0.5).add(0.5)
    const frostMask = patch.add(breath).smoothstep(0.4, 0.56).mul(region.smoothstep(0.25, 0.55).mul(0.72).add(0.28))
    const dust = mx_noise_float(p.mul(48).add(vec3(2.3, 7.6, 0.9))).smoothstep(0.68, 0.92).mul(frostMask)
    const largeStar = large.star.mul(largeFade)
    const fineStar = fine.star.mul(fineFade)
    const frostLine = max(largeStar, fineStar.mul(0.72))
    const frostHaze = largeStar.pow(0.3).mul(0.42).add(dust.mul(0.35)).add(mx_noise_float(p.mul(14).add(vec3(4.1, 2.8, 6.3))).mul(0.12)).mul(frostMask)
    const frostBase = frostMask.mul(0.5).add(dust.mul(0.16)).add(mx_noise_float(p.mul(21).add(vec3(7.3, 1.1, 3.4))).mul(0.08)).mul(frostMask)
    const frostAmount = frostBase.add(frostLine.mul(frostMask).mul(0.55)).add(frostHaze).clamp()
// The ice below the rime is a deep, cracked window into another winter.
    const iceVeinField = mx_fractal_noise_float(p.mul(5.2).add(vec3(0.4, 6.7, 3.8)), 4, 2.02, 0.58)
    const iceVein = filament(iceVeinField, 0.012).mul(0.5)
    const bubble = beads(p.mul(36), 2.3)
    const bubbles = bubble.mask.mul(near).mul(0.75)
    const iceCloud = mx_fractal_noise_float(p.mul(2.8).add(vec3(5.1, 1.4, 9.2)), 4, 2.03, 0.58).mul(0.5).add(0.5)
    const ice = mix(mix(color(hsl.integer(262, 75, 5)), color(hsl.integer(255, 75, 18)), iceCloud.smoothstep(0.2, 0.82)), color(hsl.integer(284, 78, 17)), iceCloud.smoothstep(0.55, 0.95).mul(0.4))
    const iceLit = mix(ice, color(hsl.integer(249, 100, 73)), iceVein.mul(0.26).add(bubbles.mul(0.12)))
    const frostColor = mix(color(hsl.integer(212, 100, 97)), color(hsl.integer(216, 55, 86.5)), large.radius.mul(0.3).add(dust.mul(0.5)).smoothstep(0.1, 0.8))
    const body = mix(iceLit, frostColor, frostAmount)
    this.colorNode = body
    this.metalnessNode = float(0.02)
    this.roughnessNode = mix(float(0.06), float(0.24), frostAmount)
    this.ior = 1.31
    this.clearcoat = 1
    this.clearcoatRoughnessNode = mix(float(0.025), float(0.12), frostAmount)
    this.iridescenceNode = frostAmount.mul(0.4).add(0.06)
    this.iridescenceIOR = 1.34
    this.iridescenceThicknessNode = large.radius.mul(180).add(frostAmount.mul(280)).add(230)
// Needle relief, bubbles, frozen cracks and a fine facet texture; all of it fades before it can alias.
    const needleRelief = frostLine.mul(0.0009).add(frostBase.mul(0.00022)).add(frostHaze.mul(0.00014))
    const veinRelief = iceVein.mul(-0.00045)
    const bubbleRelief = bubble.cap.mul(near).mul(0.0005)
    const facets = mx_noise_float(p.mul(88).add(vec3(2.8, 5.5, 1.9))).mul(near.mul(0.00026)).add(mx_noise_float(p.mul(31).add(time.mul(0.02))).mul(0.0002))
    const detailHeight = needleRelief.add(veinRelief).add(bubbleRelief).add(facets)
    const bump = bumpNormal(detailHeight, surfaceNormal, 1.25)
    this.normalNode = bump
    this.clearcoatNormalNode = bump
    const facing = surfaceNormal.dot(positionViewDirection).abs().clamp()
    const twinkle = sin(time.mul(2.3).add(mx_cell_noise_float(p.mul(52)).mul(TAU))).mul(0.35).add(0.65)
    const sparkle = glints(surfaceNormal, 95).mul(frostAmount.add(dust.mul(0.3))).mul(near).mul(twinkle).mul(1.35)
    const frostGlow = color(hsl.integer(214, 100, 95)).mul(frostAmount.mul(0.055)).mul(near.mul(0.4).add(0.6))
    const coldRim = color(hsl.integer(214, 99, 84)).mul(grazing.pow(4)).mul(0.3)
    const iceGlow = color(hsl.integer(206, 88, 72)).mul(iceVein.mul(0.12)).mul(near.mul(0.5).add(0.3))
    this.emissiveNode = frostGlow.add(coldRim).add(iceGlow).add(color(hsl.integer(0, 0, 100)).mul(sparkle))
      .add(color(hsl.integer(228, 100, 89)).mul(bubbles.mul(0.05)))
      .add(color(hsl.integer(215, 47, 77)).mul(facing.pow(6)).mul(0.035))
      .add(color(hsl.integer(176, 99, 88.4)).mul(grazing.pow(3)).mul(0.07))
      .add(color(hsl.integer(294, 100, 59)).mul(grazing.pow(6)).mul(0.11))
      .add(color(hsl.integer(211, 100, 93.5)).mul(frostAmount.mul(grazing.pow(2)).mul(0.1)))
  }
}
