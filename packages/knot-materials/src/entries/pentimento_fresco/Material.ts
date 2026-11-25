import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, vec3} from 'three/tsl'

import {cellGrain} from '../../candidates/gpt_sol/lib/cellGrain.ts'
import {filament} from '../../candidates/gpt_sol/lib/filament.ts'
import {multiGlint} from '../../candidates/gpt_sol/lib/multiGlint.ts'
import {viewerFrame} from '../../candidates/gpt_sol/lib/viewerFrame.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.62
    const {p, view, grazing, near, intimate} = viewerFrame()
    const topGesture = mx_fractal_noise_float(p.mul(3.1), 3, 2, 0.5)
      .mul(0.5)
      .add(0.5)
    const topVein = mx_noise_float(p.mul(8.5).add(topGesture.mul(1.7)))
      .mul(0.5)
      .add(0.5)
    const ochreLayer = mix(color(hsl.integer(68, 41, 50)), color(hsl.integer(79, 47, 68)), topGesture)
    const upperFresco = mix(ochreLayer, color(hsl.integer(170, 14, 47)), topVein
      .smoothstep(0.57, 0.82)
      .mul(0.48))
    const parallaxDepth = grazing
      .mul(0.052)
      .add(intimate.mul(0.016))
      .add(0.012)
    const inner = p.sub(view.mul(parallaxDepth))
    const underNoise = mx_noise_float(inner.mul(4.2))
    const gesturePhase = inner
      .dot(vec3(0.35, 0.88, -0.31))
      .mul(10.5)
      .add(underNoise.mul(3.1))
    const counterPhase = inner
      .dot(vec3(-0.79, 0.22, 0.57))
      .mul(8.3)
      .sub(underNoise.mul(2.4))
    const gesture = gesturePhase
      .sin()
      .mul(0.5)
      .add(0.5)
    const counter = counterPhase
      .cos()
      .mul(0.5)
      .add(0.5)
    const underBase = mix(color(hsl.integer(263, 87, 29)), color(hsl.integer(181, 73, 43)), counter.pow(1.35))
    const underPigment = mix(underBase, color(hsl.integer(38, 70, 45)), gesture.pow(2).mul(0.68))
    const drawing = filament(gesturePhase.sin(), 0.055).max(filament(counterPhase.cos(), 0.05))
    const illuminatedUnderpainting = mix(underPigment, color(hsl.integer(90, 59, 77)), drawing.mul(0.55))
    const crackGuide = mx_noise_float(p.mul(4.5).add(7.4))
    const crackField = mx_noise_float(p.mul(27)
      .add(crackGuide.mul(2.1))
      .add(vec3(3.1, -6.4, 9.2)))
    const cracks = filament(crackField.add(crackGuide.mul(0.18)), 0.022)
    const erosion = mx_fractal_noise_float(p.mul(6.5).add(4.8), 4, 2, 0.5)
      .mul(0.5)
      .add(0.5)
    const viewKey = view
      .dot(vec3(0.62, -0.29, 0.73).normalize())
      .mul(0.5)
      .add(0.5)
    const erosionEdge = float(0.7)
      .sub(grazing.mul(0.2))
      .sub(intimate.mul(0.09))
      .add(viewKey.mul(0.05))
    const reveal = erosion
      .smoothstep(erosionEdge, erosionEdge.add(0.13))
      .mul(0.84)
      .add(cracks.mul(0.35))
      .clamp()
    const plaster = mix(color(hsl.integer(86, 25, 70)), color(hsl.integer(90, 35, 85)), topVein)
    const chalk = erosion
      .smoothstep(0.9, 0.98)
      .mul(near.mul(0.4).add(0.25))
    const layered = mix(upperFresco, illuminatedUnderpainting, reveal)
    const withPlaster = mix(layered, plaster, chalk.mul(0.42))
    this.colorNode = mix(withPlaster, color(hsl.integer(64, 20, 18)), cracks.mul(0.7))
    this.metalness = 0
    this.roughnessNode = float(0.76)
      .sub(reveal.mul(0.08))
      .add(chalk.mul(0.12))
      .sub(cracks.mul(0.05))
      .clamp(0.58, 0.9)
    this.clearcoat = 0.035
    this.clearcoatRoughness = 0.8
    const frescoNormal = proceduralNormal(erosion
      .mul(0.18)
      .add(cracks.mul(0.42))
      .add(topVein.mul(0.08)), 0.0016)
    this.normalNode = frescoNormal
    const mica = cellGrain(inner, 105, 0.993)
    const micaGlint = multiGlint(frescoNormal, 105)
    this.specularIntensityNode = float(0.28)
      .add(mica.mask.mul(0.7))
    this.emissiveNode = color(hsl.integer(268, 100, 61))
      .mul(mica.mask)
      .mul(micaGlint)
      .mul(intimate)
      .mul(1.15)
      .add(illuminatedUnderpainting
        .mul(drawing)
        .mul(reveal)
        .mul(intimate)
        .mul(0.04))
  }
}
