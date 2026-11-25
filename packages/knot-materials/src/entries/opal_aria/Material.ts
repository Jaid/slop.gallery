import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, exp, float, Fn, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, positionViewDirection, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/deepseek/lib/bumpNormal.ts'
import {spectralBand} from '../../candidates/deepseek/lib/spectralBand.ts'
import {voronoiSurface} from '../../candidates/deepseek/lib/voronoiSurface.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A slow, polished swell so the stone has a cabochon silhouette without ever becoming a crystal. */
const opalHeight = Fn(([tube]: [Node<'vec2'>]) => {
  const {position: p, normal} = knotFrame(tube)
  const swell = mx_noise_float(p.mul(2.15).add(vec3(0.07, 0.03, 0.05))).mul(0.006)
  const fine = mx_noise_float(p.mul(5.4).add(vec3(2.1, 7.3, 1.7))).mul(0.0018)
  return p.add(normal.mul(swell.add(fine)))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const tube = uv()
    this.positionNode = opalHeight(tube)
    const epsilon = 0.0004
    const du = opalHeight(tube.add(vec2(epsilon, 0))).sub(opalHeight(tube.sub(vec2(epsilon, 0))))
    const dv = opalHeight(tube.add(vec2(0, epsilon))).sub(opalHeight(tube.sub(vec2(0, epsilon))))
    const surfaceNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const {p, view, grazing, near} = viewerFrame()
    const domainPoint = uv().mul(vec2(64, 8)).add(mx_noise_vec3(p.mul(2.4).add(vec3(0.4, 1.7, 3.1))).xy.mul(0.42))
    const cells = voronoiSurface(domainPoint, vec2(64, 8), 5.9)
    const edge = cells.edge.toVar()
    const domain = edge.smoothstep(0, 0.055)
    const milled = mx_fractal_noise_float(p.mul(4.1), 4, 2.02, 0.56).mul(0.5).add(0.5)
    const milk = mx_noise_float(p.mul(12.5).add(vec3(4.2, 1.1, 7.7))).mul(0.5).add(0.5)
// The potch stays nearly black so every photon of fire reads as pure spectral color.
    const potch = mix(color(hsl.integer(237, 53, 3)), color(hsl.integer(204, 58, 11)), milled.smoothstep(0.24, 0.78))
    const cloudy = mix(potch, color(hsl.integer(171, 17, 67)), milk.mul(0.055))
// Each domain is a tiny diffraction grating: its own axis, spacing and flash threshold.
    const axis = cells.random.mul(2).sub(1).normalize()
    const bragg = axis.dot(view)
    const hueRegion = mx_noise_float(p.mul(1.35).add(vec3(4.1, 7.2, 2.6))).mul(0.22)
    const hue = cells.random.x.mul(0.42).add(0.24).add(hueRegion).add(bragg.mul(0.22)).add(cells.d1.mul(0.1)).add(mx_noise_float(p.mul(24)).mul(0.025))
    const play = spectralBand(hue, 1.55)
    const flash = bragg.smoothstep(-0.32, 0.7).mul(cells.random.z.mul(0.4).add(0.6))
      .add(bragg.negate().smoothstep(0.3, 0.92).mul(0.2))
    const precious = cells.random.y.smoothstep(0.08, 0.42)
// Even a resting domain carries a little color; the flash decides how much of it ignites.
    const playMask = precious.mul(flash.mul(0.6).add(0.16)).mul(domain).clamp()
    const body = mix(cloudy, play.mul(0.75).add(cloudy.mul(0.25)), playMask)
    this.colorNode = body
    this.metalness = 0
    this.roughnessNode = float(0.045).add(milk.mul(0.025)).add(domain.oneMinus().mul(0.055))
    this.ior = 1.46
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.009).add(milk.mul(0.022))
// A polished but never perfectly flat dome: cell borders are hairline grooves, the interiors bow.
    const groove = domain.oneMinus().pow(2).mul(-0.0042)
    const bevel = exp(edge.sub(0.09).pow2().mul(-1400)).mul(0.0017)
    const dome = exp(cells.d1.pow2().mul(-14)).mul(cells.random.z.mul(0.0017).add(0.0004))
    const orangePeel = mx_noise_float(p.mul(46)).mul(near.mul(0.00032))
    const detailHeight = groove.add(bevel).add(dome).add(orangePeel)
    const detailFootprint = edge.fwidth()
    const detailStrength = detailFootprint.smoothstep(0.012, 0.075).oneMinus().mul(0.72)
    const bump = bumpNormal(detailHeight, surfaceNormal, detailStrength)
    this.normalNode = bump
    this.clearcoatNormalNode = bump
    const facing = surfaceNormal.dot(positionViewDirection).abs().clamp()
    const scatter = color(hsl.integer(198, 69, 47)).mul(grazing.pow(3)).mul(0.24)
    const pinfireMask = mx_cell_noise_float(p.mul(92)).smoothstep(0.74, 0.88).mul(near)
    const pinfire = glints(surfaceNormal, 110).mul(pinfireMask).mul(1.2)
    this.emissiveNode = play.mul(playMask).mul(0.12)
      .add(scatter)
      .add(vec3(1, 0.88, 0.68).mul(pinfire))
      .add(color(hsl.integer(197, 66, 22)).mul(facing.pow(5)).mul(0.1))
  }
}
