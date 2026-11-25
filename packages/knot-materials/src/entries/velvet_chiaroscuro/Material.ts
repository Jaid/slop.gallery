import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentView, color, float, mix, mx_noise_float, positionViewDirection, tangentView, uv, vec3} from 'three/tsl'

import {cellGrain} from '../../candidates/gpt_sol/lib/cellGrain.ts'
import {multiGlint} from '../../candidates/gpt_sol/lib/multiGlint.ts'
import {viewerFrame} from '../../candidates/gpt_sol/lib/viewerFrame.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

function resolvedCosine(phase: Node<'float'>) {
  const visibility = phase.fwidth().smoothstep(0.65, 2.8).oneMinus()
  return phase.cos().mul(visibility)
}

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.72
    const {p, view, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const orientation = mx_noise_float(p.mul(3.1))
      .mul(2.4)
      .add(tube.x.mul(TAU * 3))
      .add(tube.y.mul(TAU * 2))
    const bitangent = vec3(bitangentView as unknown as Node<'vec3'>).normalize()
    const fibre = tangentView
      .mul(orientation.cos())
      .add(bitangent.mul(orientation.sin()))
      .normalize()
    const alignment = fibre
      .dot(positionViewDirection)
      .abs()
    const flash = alignment
      .sub(0.34)
      .abs()
      .smoothstep(0.035, 0.25)
      .oneMinus()
    const brushPhase = tube.x
      .mul(TAU * 9)
      .add(tube.y
        .mul(TAU * 5)
        .sin()
        .mul(0.7))
      .add(mx_noise_float(p.mul(4.2)).mul(1.8))
    const brushed = brushPhase
      .cos()
      .mul(0.5)
      .add(0.5)
    const warpPhase = tube.x.mul(TAU * 240)
    const weftPhase = tube.y
      .mul(TAU * 52)
      .add(tube.x
        .mul(TAU * 7)
        .sin()
        .mul(0.35))
    const weaveSignal = resolvedCosine(warpPhase).mul(resolvedCosine(weftPhase))
    const weaveLight = weaveSignal
      .mul(0.5)
      .add(0.5)
    const base = mix(color(hsl.integer(316, 36, 3)), color(hsl.integer(312, 70, 10)), brushed
      .mul(0.45)
      .add(grazing.mul(0.15))
      .clamp())
    const angleKey = view
      .dot(vec3(0.7, 0.19, -0.69).normalize())
      .mul(0.5)
      .add(0.5)
    const pileTint = mix(color(hsl.integer(292, 85, 40)), color(hsl.integer(44, 67, 56)), angleKey)
    this.colorNode = mix(base, pileTint, flash
      .mul(0.24)
      .add(weaveLight
        .mul(intimate)
        .mul(0.06))
      .clamp())
    this.metalness = 0
    this.roughnessNode = float(0.74)
      .sub(flash.mul(0.16))
      .sub(intimate.mul(0.06))
      .clamp(0.48, 0.78)
    this.anisotropy = 0.72
    this.anisotropyRotation = Math.PI * 0.5
    this.specularIntensity = 0.38
    this.sheen = 1
    this.sheenNode = pileTint.mul(flash
      .mul(0.85)
      .add(grazing.mul(0.28))
      .add(0.08))
    this.sheenRoughnessNode = float(0.29)
      .sub(flash.mul(0.11))
      .add(brushed.mul(0.05))
      .clamp(0.16, 0.36)
    this.retroreflectivityNode = flash
      .mul(0.62)
      .add(grazing.mul(0.08))
      .clamp()
    const weaveHeight = warpPhase
      .sin()
      .mul(0.00016)
      .add(weftPhase
        .sin()
        .mul(0.00013))
      .mul(intimate)
      .add(brushed.mul(0.0007))
    const velvetNormal = proceduralNormal(weaveHeight, 1)
    this.normalNode = velvetNormal
    const lint = cellGrain(p, 145, 0.995)
    const lintGlint = multiGlint(velvetNormal, 115)
    this.emissiveNode = mix(color(hsl.integer(297, 100, 84)), color(hsl.integer(64, 100, 88)), angleKey)
      .mul(lint.mask)
      .mul(lintGlint)
      .mul(intimate)
      .mul(0.75)
      .add(pileTint
        .mul(flash)
        .mul(near)
        .mul(0.018))
  }
}
