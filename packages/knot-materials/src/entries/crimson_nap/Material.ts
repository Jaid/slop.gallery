import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_fractal_noise_float, mx_noise_float, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {lampFlash} from '../../candidates/space_bunny/lib/lampFlash.ts'
import {loopDrift} from '../../candidates/space_bunny/lib/loopClock.ts'
import {surfaceFrame} from '../../candidates/space_bunny/lib/surfaceFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Half-drop brocade repeat: a ring of petals, a bud and the ogee lattice that carries it. */
function damaskMotif(q: Node<'vec2'>) {
  const id = q.floor()
  const local = q.fract().sub(vec2(id.y.mod(2).mul(0.5), 0)).sub(0.5)
  const radius = local.length()
  const angle = atan(local.y, local.x)
  const petal = radius.mul(6.5).add(angle.mul(5)).sin().mul(0.5).add(0.5)
  const ring = radius.sub(0.29).abs().smoothstep(0.035, 0.085).oneMinus()
  const inner = radius.sub(0.185).abs().smoothstep(0.02, 0.05).oneMinus()
  const bud = radius.sub(0.1).smoothstep(0.02, 0.055).oneMinus().mul(petal.mul(0.6).add(0.4))
  const ogee = local.x.abs().add(local.y.abs().mul(0.85)).sub(0.46).abs().smoothstep(0.012, 0.03).oneMinus()
  return ring.mul(0.75).add(inner.mul(0.45)).add(bud.mul(0.85)).add(ogee.mul(0.35)).clamp()
}
/** Museum velvet. The pile is a field of upright fibres, so almost all of its light is retro-reflected: the surface goes almost black head-on and ignites along every silhouette. The nap has been brushed in broad swirls, so the sheen streaks travel with the pile instead of the geometry, and a woven damask hides inside those streaks – it only resolves when you are close enough for the sheen to spread out, which is why leaning in is rewarded. Nothing here is painted on: it is all direction. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const {tangent, bitangent} = surfaceFrame()
// The nap: broad crush marks that lay the pile over, drifting slowly as the cloth relaxes.
    const crush = mx_fractal_noise_float(loopDrift(p.mul(1.35), 0.22), 3, 2.1, 0.55)
    const napAngle = mx_noise_float(loopDrift(p.mul(0.85), 0.14, 2).add(vec3(4.2, -1.3, 6.7))).mul(2.6).add(crush.mul(0.8))
    const napDir = tangent.mul(napAngle.cos()).add(bitangent.mul(napAngle.sin()))
// Individual fibres, only worth shading once they are wider than a pixel.
    const fibre = mx_noise_float(vec3(p.dot(vec3(41, 7, 53)), p.dot(vec3(-29, 63, 17)), p.dot(vec3(11, 83, -37)))).mul(0.5).add(0.5)
    const weave = uv().mul(vec2(38, 6))
    const motif = damaskMotif(weave)
    const lay = crush.mul(0.5).add(0.5)
    const crimson = mix(color(hsl.integer(11, 78, 5.7)), color(hsl.integer(23, 94, 25)), lay)
    const weaveTone = mix(crimson, color(hsl.integer(21, 88, 38)), motif.mul(0.55))
    const deep = mix(weaveTone, color(hsl.integer(17, 83, 9)), motif.oneMinus().mul(0.45))
    this.colorNode = deep.mul(fibre.mul(near).mul(0.06).add(0.94))
    this.metalness = 0
    this.roughnessNode = float(0.88).add(lay.mul(0.06)).sub(motif.mul(0.12)).clamp(0.4, 1)
    this.ior = 1.42
    this.specularIntensity = 0.28
    this.anisotropyNode = vec2(napDir.dot(tangent), napDir.dot(bitangent)).mul(0.62)
    this.sheen = 1
    this.sheenNode = float(0.75).add(motif.mul(1.15)).add(grazing.mul(0.7))
    this.sheenColor.set(hsl.integer(41, 100, 87))
    this.sheenRoughnessNode = float(0.42).sub(motif.mul(0.22)).add(lay.mul(0.08)).clamp(0.1, 0.7)
    this.normalNode = proceduralNormal(fibre.mul(near).mul(0.6).add(motif.mul(0.45)).add(crush.mul(0.25)), 0.0016)
// Loose fibres stand off the pile and catch the lamps before the cloth does.
    const stray = lampFlash(transformNormalToView(napDir).normalize(), 140)
    this.emissiveNode = color(hsl.integer(35, 100, 72.7)).mul(grazing.pow(5).mul(intimate.mul(0.5).add(0.5)).mul(0.05))
      .add(color(hsl.integer(46, 100, 89)).mul(stray).mul(fibre.mul(near)).mul(motif.oneMinus()).mul(0.6))
  }
}
