import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec2} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

/** A celadon-glazed porcelain bowl shattered and mended with lacquered gold. The cracks come from a Voronoi cell boundary field; the gold that fills them has its own anisotropic sheen, so a slow orbit makes every seam brighten and dim in turn. The porcelain itself is a translucent ivory with the gentlest celadon tint; from within, a warm glow answers the studio light, brightest at the cracks where the gold lets it through. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    this.envMapIntensity = 1.4
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2.2)
    const distance = positionView.length()
    const near = distance.smoothstep(1.25, 5.5).oneMinus()
    const intimate = distance.smoothstep(0.8, 2.7).oneMinus()
    // ---- porcelain body ----
    // A cool ivory celadon with subtle body noise. Deep enough that the gold
    // seams can read against it.
    const bodyNoise = mx_noise_float(p.mul(9)).mul(0.5).add(0.5)
    const porcelainBase = color(hsl.integer(124, 21, 89)).mul(bodyNoise.mul(0.18).add(0.82))
    const crackle = mx_noise_float(p.mul(34)).mul(0.5).add(0.5).smoothstep(0.45, 0.55)
    // ---- crack pattern ----
    // Voronoi cell boundaries give a network of branching seams.
    const crackField = cellularBoundary(p.mul(2.6))
    const crackCore = filteredRibbon(crackField, 0.03)
    const crackWide = filteredRibbon(crackField, 0.07)
    const crackMask = crackCore.add(crackWide.mul(0.4)).clamp()
    const branchField = cellularBoundary(p.mul(7))
    const branchMask = filteredRibbon(branchField, 0.012).mul(crackMask.mul(0.85).add(0.15)).clamp()
    const goldSeam = crackMask.add(branchMask.mul(0.5)).clamp()
    // ---- porcelain shading ----
    this.colorNode = porcelainBase
    this.metalness = 0
    this.roughnessNode = float(0.36).sub(crackle.mul(0.06)).add(goldSeam.mul(0.2))
    this.sheen = 0.5
    this.sheenColor.set(hsl.integer(89, 100, 93))
    this.sheenRoughness = 0.55
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.06
    this.transmission = 0.22
    this.thickness = 0.5
    this.ior = 1.5
    this.attenuationColor.set(hsl.integer(150, 56, 19))
    this.attenuationDistance = 0.7
    this.normalNode = proceduralNormal(crackle.mul(0.001).add(goldSeam.mul(0.003)), 0.7)
    // ---- gold seams ----
    const goldBase = color(hsl.integer(79, 77, 65))
    const goldWarm = color(hsl.integer(82, 78, 82))
    const goldCool = color(hsl.integer(78, 85, 53))
    const gradientX = crackField.dFdx()
    const gradientY = crackField.dFdy()
    const seamDir = vec2(gradientX, gradientY)
    const seamFacing = seamDir.dot(seamDir).sqrt().clamp(0.0001)
    const seamDirection = seamDir.div(seamFacing).add(vec2(1, 0)).mul(0.5)
    const t = time.mul(0.2).add(seamDirection.x).fract()
    const pulseR = mix(goldWarm.r, goldCool.r, t)
    const pulseG = mix(goldWarm.g, goldCool.g, t)
    const pulseB = mix(goldWarm.b, goldCool.b, t)
    const seamR = mix(goldBase.r, pulseR, float(0.5))
    const seamG = mix(goldBase.g, pulseG, float(0.5))
    const seamB = mix(goldBase.b, pulseB, float(0.5))
    const seamColor = color(seamR, seamG, seamB)
    this.colorNode = (mix as unknown as (a: any, b: any, t: any) => Node<'color'>)(
      this.colorNode,
      seamColor,
      goldSeam,
    )
    this.metalnessNode = mix(float(0.02), float(1), goldSeam.pow(0.5))
    this.roughnessNode = (mix as unknown as (a: any, b: any, t: any) => Node<'float'>)(
      this.roughnessNode,
      float(0.08),
      goldSeam,
    )
    this.anisotropy = 0.95
    this.anisotropyNode = vec2(seamDirection.x.sub(0.5).mul(0.9), seamDirection.y.sub(0.5).mul(0.9)).mul(goldSeam)
    // ---- emissive inner glow ----
    const glow = float(0.3).add(goldSeam.mul(0.85)).add(intimate.mul(0.25))
    const innerGlow = color(hsl.integer(92, 100, 94.7)).mul(glow).mul(near.mul(0.55).add(0.45))
    const seamGlow = color(hsl.integer(84, 100, 87)).mul(goldSeam).mul(facing.pow(1.5)).mul(3.5)
    const rimHaze = mix(color(hsl.integer(87, 33, 75)), color(hsl.integer(92, 100, 94.7)), facing).mul(rim.pow(2)).mul(0.25)
    this.emissiveNode = innerGlow.add(seamGlow).add(rimHaze)
  }
}
