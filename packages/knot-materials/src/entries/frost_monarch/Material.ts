import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {
  color,
  float,
  mix,
  mx_atan2,
  mx_noise_float,
  normalViewGeometry,
  uv,
  vec2,
} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1) // Crisp studio reflections on glassy glacial ice
    this.name = knotData.id
    const tube = uv()
    const {p, view, grazing, near, intimate} = viewerFrame()
    // 1. Subsurface Optical Depth into Glacial Interior
    const iceDepth = 0.038
    const q = p.sub(view.mul(iceDepth))
    // 2. Hexagonal Dendritic Hoarfrost Crystals (Ice Ih 6-Fold Symmetry)
    const frostGrid = vec2(tube.x.mul(28), tube.y.mul(8))
    const frostLocal = frostGrid.fract().sub(0.5)
    const r = frostLocal.length()
    const theta = mx_atan2(frostLocal.y, frostLocal.x) as unknown as import('three/webgpu').Node<'float'>
    // 6-fold dendritic stellar arms
    const hexArms = theta.mul(6).cos().mul(0.5).add(0.5)
    // Microscopic secondary fern needles branching from the main arms
    const fernNeedles = r.mul(38).add(theta.mul(12)).cos().mul(0.5).add(0.5)
    const crystalShape = hexArms.mul(0.28).add(fernNeedles.mul(0.12))
    const dendrite = r.sub(crystalShape).smoothstep(0.03, 0.09).oneMinus()
    // High-frequency micro-rime along frost needle edges
    const rimeNoise = mx_noise_float(p.mul(55)).mul(0.5).add(0.5)
    const hoarfrost = dendrite.mul(rimeNoise.mul(0.4).add(0.6))
    // Sharp micro-facets on crystalline hoarfrost needles
    const frostHeight = hoarfrost.mul(0.0028).add(rimeNoise.mul(0.0004))
    this.normalNode = proceduralNormal(frostHeight, 1)
    // 3. Trapped Prehistoric Atmospheric Air Bubbles
    const bubbleCoord = q.mul(60)
    const bubbleMask = cellularPoints(bubbleCoord, 0.03, 0.17, 0.68)
    const diamondGlints = glints(normalViewGeometry, 85).mul(bubbleMask).mul(intimate)
    // 4. Glacial Ice Base Color
    const clearGlacialIce = color(hsl.integer(223, 71, 95))
    const powderyHoarfrost = color(hsl.integer(0, 0, 100))
    const deepGlacialCyan = color(hsl.integer(231, 100, 71.6))
    this.colorNode = mix(clearGlacialIce, powderyHoarfrost, hoarfrost)
    // PBR Optical Properties: Glacial Ice Ih
    this.transmission = 0.82
    this.thickness = 0.55
    this.ior = 1.31 // Natural water ice
    this.dispersion = 0.14 // Strong prismatic chromatic dispersion along silhouette
    this.attenuationColor.set(hsl.integer(233, 87, 31)) // Deep glacial selective red absorption
    this.attenuationDistance = 0.72
    // Roughness: glassy smooth ice (0.025) vs powdery crystalline hoarfrost (0.65)
    this.roughnessNode = mix(float(0.025), float(0.65), hoarfrost)
    // Clearcoat: glassy meltwater film over ice, broken by frosty needles
    this.clearcoat = 1
    this.clearcoatRoughnessNode = mix(float(0.015), float(0.5), hoarfrost)
    // Anisotropic sheen aligned with ice needle growth
    const armTangent = vec2(frostLocal.y.negate(), frostLocal.x).normalize()
    this.anisotropy = 0.75
    this.anisotropyNode = armTangent.mul(0.75).mul(hoarfrost)
    // 5. Deep Glacial Core Luminescence
    // Ancient pressurized blue ice radiates ethereal cold cyan light from within
    this.emissiveNode = deepGlacialCyan
      .mul(0.32)
      .mul(near.mul(0.4).add(0.7))
      .add(powderyHoarfrost.mul(hoarfrost.pow(2)).mul(0.4))
      .add(color(hsl.integer(0, 0, 100)).mul(diamondGlints).mul(2.5))
      .add(color(hsl.integer(225, 100, 87.4)).mul(grazing.pow(2.2)).mul(0.4))
  }
}
