import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, positionGeometry, time, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/claude_sonnet/lib/bumpNormal.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Thin-film interference: each channel is a cosine of the optical path, so thickness maps to Newton's color series. */
const film = (path: import('three/webgpu').Node<'float'>) => {
  const t = path.mul(Math.PI * 2)
  const wavelengths = vec3(1, 1.18, 1.42)
  const c = t.mul(wavelengths).cos().mul(-0.5).add(0.5)
  return c.mul(c).mul(1.4)
}
/** A soap film stretched around a fluid ghost of the knot. Gravity drains the film so its top runs thin and black, vortices stir the colors into slow rivers, and the optical path grows toward the silhouette, so every step around the object rewrites the whole rainbow. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const {near, intimate, grazing, facing} = viewerFrame()
    const p = positionGeometry
  // Marangoni flow: a curl-like warp advected around the tube.
    const flowA = mx_noise_float(p.mul(2.2).add(vec3(0, time.mul(-0.05), time.mul(0.03))))
    const flowB = mx_noise_float(p.mul(2.2).add(vec3(7.1, 3.3, time.mul(0.04))))
    const swirl = mx_fractal_noise_float(p.mul(3.4).add(vec3(flowA, flowB, flowA.sub(flowB)).mul(0.9)).add(vec3(0, 0, time.mul(0.03))), 4, 2.05, 0.5).mul(0.5).add(0.5)
    const eddies = mx_noise_float(p.mul(9).add(vec3(flowB, flowA, 0).mul(1.6))).mul(0.5).add(0.5)
  // Drainage: thickness grows downward (world up is +Y), pooled with turbulence.
    const drain = p.y.mul(-0.85).add(0.5).clamp(0, 1)
    const thickness = drain.mul(0.9).add(swirl.mul(0.55)).add(eddies.mul(0.12)).add(near.mul(0.04))
    const path = thickness.div(facing.max(0.22).mul(0.6).add(0.4)).mul(1.15)
    const rainbow = film(path)
  // Very thin film reflects almost nothing – the black patches near the crown.
    const thin = thickness.smoothstep(0.05, 0.32).oneMinus()
    const gaze = grazing.pow(1.5).mul(0.7).add(0.16)
    const reflected = rainbow.mul(thin.oneMinus()).mul(gaze)
    this.colorNode = color(hsl.integer(248, 32, 4))
    this.metalness = 0
    this.roughness = 0.02
    this.transmission = 0.94
    this.thickness = 0.02
    this.ior = 1.33
    this.dispersion = 0.25
    this.iridescence = 1
    this.iridescenceIOR = 1.33
    this.iridescenceThicknessNode = thickness.mul(700).add(120)
    this.clearcoat = 1
    this.clearcoatRoughness = 0
    this.attenuationColor.set(hsl.integer(0, 0, 100))
    this.attenuationDistance = 4
    this.normalNode = bumpNormal(normalViewGeometry.normalize(), swirl.mul(0.0025).add(eddies.mul(0.0006)))
    const twinkle = mx_noise_float(p.mul(30).add(vec3(0, 0, time.mul(0.8)))).mul(0.5).add(0.5).pow(6)
    this.emissiveNode = reflected.mul(intimate.mul(0.25).add(0.75)).mul(1.15)
      .add(mix(color(hsl.integer(240, 100, 77.4)), color(hsl.integer(343, 100, 78)), swirl).mul(twinkle).mul(grazing).mul(0.25).mul(near))
      .add(float(0).add(color(hsl.integer(224, 100, 95)).mul(grazing.pow(6)).mul(0.25)))
  }
}
