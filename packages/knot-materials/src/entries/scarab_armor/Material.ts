import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalViewGeometry, time, uv, vec2} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.2)
    this.name = knotData.id
    const {facing, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
// Hexagonal shingled armor lattice wrapping the knot manifold
    const u = tube.x.mul(24)
    const v = tube.y.mul(8)
    const row = v.floor()
    const rowParity = row.mod(2)
    const uOffset = mix(float(0), float(0.5), rowParity)
    const scaleUv = vec2(u.add(uOffset).fract().sub(0.5), v.fract().sub(0.5))
// Hexagonal distance function for shield-shaped cuticle scales
    const dx = scaleUv.x.abs().mul(0.866)
    const dy = scaleUv.y.abs().mul(0.5)
    const dHex = dx.add(dy).max(scaleUv.y.abs())
// Individual scale relief: domed plate with raised central dorsal keel
    const plateMask = float(1).sub(dHex.mul(2.1)).clamp(0, 1)
    const keel = plateMask.mul(float(1).sub(scaleUv.x.abs().mul(2.6)).clamp(0, 1))
    const scaleRelief = plateMask.pow(1.6).mul(0.0045).add(keel.mul(0.0022))
// Inter-scale flexible connective seam margin
    const seamMargin = dHex.smoothstep(0.42, 0.49)
    const isPlate = float(1).sub(seamMargin)
// Multi-layer cuticle thin-film interference (quarter-wave interference stack)
// Normal incidence reflects longer wavelengths (emerald and bronze); oblique shifts to violet and peacock blue
    const lamellaPhase = facing.mul(3.2).add(keel.mul(1.5)).add(grazing.mul(1.8))
    const structuralColor = cosinePalette(lamellaPhase, [0.32, 0.56, 0.48], [0.35, 0.44, 0.48], [1, 1, 1], [0.12, 0.42, 0.76])
// Dark chitin base under-layer
    const deepChitin = color(hsl.integer(174, 10, 6))
    const plateBase = mix(deepChitin, structuralColor, isPlate.mul(0.92))
// Inter-scale flexible membrane with breathing bioluminescent heat vents
    const breath = time.mul(1.6).sin().mul(0.35).add(0.65)
    const ventGlow = seamMargin.mul(breath).mul(near.mul(0.7).add(0.4))
    const ventColor = color(hsl.integer(33, 100, 60))
// Micro-grooved diffraction grating striations
    const microGrooves = scaleUv.x.mul(72).sin().mul(0.5).add(0.5)
    let compColor = mix(plateBase, color(hsl.integer(40, 29, 7)), seamMargin)
    compColor = mix(compColor, ventColor, ventGlow.mul(0.6))
    this.colorNode = compColor
// Physical properties
    this.metalnessNode = isPlate.mul(0.88).add(0.06)
    this.roughnessNode = mix(float(0.12), float(0.45), seamMargin).add(microGrooves.mul(0.04))
// Mirror cuticle clearcoat
    this.clearcoat = 1
    this.clearcoatRoughness = 0.025
    this.iridescence = 0.95
    this.iridescenceIOR = 1.65
    this.iridescenceThicknessNode = facing.mul(320).add(190)
// Normal map: raised shield scales, beveled edges and central dorsal keel
    this.normalNode = proceduralNormal(scaleRelief.sub(seamMargin.mul(0.0025)), 0.92)
// Diamond micro-glints on plate edges
    const scaleGlint = glints(normalViewGeometry, 90).mul(isPlate).mul(near)
// Structural luminescence and intersegmental vent glow
    this.emissiveNode = structuralColor.mul(isPlate).mul(facing.pow(2)).mul(0.4)
      .add(ventColor.mul(ventGlow).mul(2.2))
      .add(color(hsl.integer(0, 0, 100)).mul(scaleGlint).mul(2.5))
      .add(color(hsl.integer(297, 96, 40.2)).mul(rim).mul(grazing.pow(3)).mul(0.5))
      .add(color(hsl.integer(36, 100, 62.4)).mul(seamMargin).mul(intimate).mul(0.4))
  }
}
