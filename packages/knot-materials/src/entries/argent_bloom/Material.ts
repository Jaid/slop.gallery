import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, negateOnBackSide, normalLocal, time, transformNormalToView, vec2, vec3} from 'three/tsl'

import {coverage, resolved} from '../../candidates/gpt_sol/lib/gallerySurface.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Analytic wave gradients give the silver an unbroken, liquid specular surface at any distance. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.25)
    this.name = data.id
    const {p, grazing, intimate, view} = viewerFrame()
    const a = vec3(6, 9, -4)
    const b = vec3(-8, 3, 7)
    const A = p.dot(a).add(time.mul(0.22))
    const B = p.dot(b).sub(time.mul(0.17))
    const warp = A.sin().mul(0.7).add(B.sin().mul(0.55))
    const warpGradient = a.mul(A.cos()).mul(0.7).add(b.mul(B.cos()).mul(0.55))
    const c = vec3(26, -15, 18)
    const d = vec3(-13, 31, 9)
    const C = p.dot(c).add(warp).sub(time.mul(0.38))
    const D = p.dot(d).sub(warp.mul(0.7)).add(time.mul(0.27))
    const gradient = c.add(warpGradient).mul(C.cos()).mul(0.0055)
      .add(d.sub(warpGradient.mul(0.7)).mul(D.cos()).mul(0.0045)).toVar()
    const n = normalLocal.normalize()
    const normal = n.sub(gradient.sub(n.mul(gradient.dot(n)))).normalize()
    this.normalNode = negateOnBackSide(transformNormalToView(normal))
    this.clearcoatNormalNode = this.normalNode
    // Fine concentric interference engravings settle into a satin mean when they become unresolved.
    const radius = p.sub(vec3(0.18, -0.11, 0.04)).length()
    const rings = radius.mul(290).add(A.sin().mul(3)).sub(time.mul(0.8))
    const ringVisibility = resolved(rings, 0.5, 2.8)
    const cut = coverage(rings.sin(), 0.075, rings.fwidth()).mul(ringVisibility).mul(intimate).toVar()
    const wave = C.sin().mul(D.sin()).mul(0.5).add(0.5).toVar()
    const silver = mix(color(hsl.integer(242, 17, 61)), color(hsl.integer(209, 20, 95)), wave.mul(0.5).add(0.2))
    const patina = mx_noise_float(p.mul(11)).smoothstep(0.2, 0.7).mul(0.18)
    const angular = view.dot(vec3(0.3, 0.7, -0.4)).mul(0.5).add(0.5)
    this.colorNode = mix(silver, mix(color(hsl.integer(232, 35, 34)), color(hsl.integer(73, 35, 59)), angular), patina).mul(cut.mul(0.22).oneMinus())
    this.metalness = 1
    this.roughnessNode = float(0.105).add(wave.mul(0.095)).add(cut.mul(0.1)).sub(grazing.mul(0.025))
    this.anisotropyNode = vec2(Math.cos(0.4), Math.sin(0.4)).mul(cut.mul(0.5).add(0.2))
    this.clearcoat = 0.5
    this.clearcoatRoughness = 0.08
    this.emissiveNode = color(hsl.integer(225, 32, 77)).mul(grazing.pow(5)).mul(0.018)
  }
}
