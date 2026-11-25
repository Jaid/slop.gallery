import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, time, uv, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function nacreField(p: Node<'vec3'>, tube: Node<'vec2'>) {
  // Object-space domain warping keeps the shell layers continuous around the
  // torus and through the seam; the UV accent must also complete whole cycles.
  const slow = mx_fractal_noise_float(p.mul(2.1).add(vec3(0, time.mul(0.018), 0)), 3, 2.05, 0.56)
  const warp = p.dot(vec3(4.2, 2.7, -3.6)).add(slow.mul(4.4)).add(tube.x.mul(TAU * 2))
  const plateNoise = mx_noise_float(p.mul(6.8).add(vec3(slow.mul(1.7), slow.mul(-1.1), slow.mul(0.8))))
  const growthLine = warp.sin().abs().smoothstep(0.035, 0.17).oneMinus()
  const layer = warp.sin().mul(0.5).add(0.5)
  const plate = plateNoise.sin().mul(0.5).add(0.5)
  const fineNoise = mx_noise_float(p.mul(24).add(vec3(0, time.mul(0.03), 0)))
  const hair = fineNoise.abs().smoothstep(0.08, 0.32).oneMinus()
  return {
    slow,
    layer,
    growthLine,
    plate,
    hair,
  }
}

/** A living stellar bestiary drawn from connected pinpricks of light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const p = positionGeometry
    const tube = uv()
    const {view, grazing, near, intimate} = viewerFrame()
    const field = nacreField(p, tube)
    const incidence = view.dot(vec3(-0.36, 0.26, 0.9).normalize()).mul(0.5).add(0.5)
    const hue = incidence.mul(1.5).add(field.plate.mul(0.5)).add(field.layer.mul(0.22)).add(field.slow.mul(0.12))
    const pearl = spectralColor(hue).mul(0.6).add(color(hsl.integer(123, 45, 93.3)).mul(0.32))
    const deep = mix(color(hsl.integer(247, 66, 11)), color(hsl.integer(228, 67, 23)), field.layer.mul(0.42).add(0.18))
    const plateTint = mix(color(hsl.integer(237, 69, 24)), pearl, field.plate.mul(0.66).add(0.18))
    const height = field.growthLine.mul(0.018).add(field.hair.mul(0.006)).add(field.plate.mul(0.005))
    this.positionNode = p.add(normalLocal.mul(height.mul(near.mul(0.35).add(0.65)).mul(0.0015)))
    this.colorNode = mix(deep, plateTint, field.growthLine.mul(0.58).add(field.plate.mul(0.3)).add(field.hair.mul(0.12)))
    this.metalness = 0.16
    this.roughnessNode = float(0.1).add(field.growthLine.mul(0.13)).sub(field.plate.mul(0.035)).clamp(0.055, 0.27)
    this.clearcoat = 0.95
    this.clearcoatRoughness = 0.035
    this.ior = 1.5
    this.iridescence = 0.9
    this.iridescenceIOR = 1.33
    this.iridescenceThicknessNode = hue.mul(360).add(field.layer.mul(80)).add(130)
    this.normalNode = proceduralNormal(height.mul(1.8), 0.0011)
    const edgeFlash = field.growthLine.mul(grazing).mul(near)
    this.emissiveNode = pearl.mul(edgeFlash.mul(0.18)).add(color(hsl.integer(180, 99, 94)).mul(field.plate.mul(intimate).mul(grazing).mul(0.1)))
    this.aoNode = float(0.78).add(field.growthLine.mul(0.22))
  }
}
