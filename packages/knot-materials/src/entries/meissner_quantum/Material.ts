import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_noise_float, time, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.2)
    this.name = knotData.id
    const {p, grazing, rim, near, intimate} = viewerFrame()
    // Flux tubes run along local Z: depth must not select a different pinning site.
    const latticeCoord = p.xy.mul(16)
    const cellId = latticeCoord.floor()
    const local = latticeCoord.fract()
    const footprint = latticeCoord.fwidth().length().max(0.0001)
    const filter = footprint.min(0.1)
    const visibility = footprint.smoothstep(0.25, 1).oneMinus()
    const ringVisibility = footprint.mul(38).smoothstep(0.6, 3).oneMinus()
    let core: Node<'float'> = float(0)
    let supercurrent: Node<'float'> = float(0)
    let phaseRings: Node<'float'> = float(0)
    let fluxHop: Node<'float'> = float(0)
    let currentTangent: Node<'vec2'> = vec2(0)
    let coreLight: Node<'vec3'> = vec3(0)
    // A ring can cross its source cell boundary; evaluate the neighboring sites too.
    for (let x = -1;x <= 1;x++) {
      for (let y = -1;y <= 1;y++) {
        const offset = vec2(x, y)
        const cellRnd = cellNoiseVec3(vec3(cellId.add(offset), 0))
        const pinCenter = cellRnd.xy.mul(0.25).add(0.375)
        const rel = local.sub(offset.add(pinCenter))
        const r = rel.length()
        const pinCore = r.smoothstep(0.04, filter.add(0.18)).oneMinus().mul(visibility)
        const current = r.smoothstep(0.04, 0.14).mul(r.smoothstep(0.16, 0.46).oneMinus()).mul(visibility)
        const phase = r.mul(38).sub(time.mul(2.2)).add(cellRnd.z.mul(6.28))
        // Differentiate the unwrapped lattice, not a per-cell phase that changes identity.
        const rings = phase.cos().mul(ringVisibility).mul(0.5).add(0.5).mul(current)
        const tangent = vec2(rel.y.negate(), rel.x).div(r.max(0.001))
        const slipStutter = mx_cell_noise_float(
          vec3(time.mul(14).floor().add(0.5), cellRnd.x.mul(11.3), cellRnd.y.mul(7.7)),
        ).smoothstep(0.72, 0.76)
        core = core.max(pinCore)
        supercurrent = supercurrent.max(current)
        phaseRings = phaseRings.add(rings)
        fluxHop = fluxHop.add(slipStutter.mul(pinCore).mul(intimate))
        currentTangent = currentTangent.add(tangent.mul(current))
        const coreTint = mix(color(hsl.integer(199, 100, 86.5)), color(hsl.integer(304, 85, 41)), r.mul(2.8).clamp())
        coreLight = coreLight.add(coreTint.mul(pinCore))
      }
    }
    // Ceramic cuprate background grain
    const cuprateGrain = mx_noise_float(p.mul(42)).mul(0.5).add(0.5)
    const ceramicBase = mix(color(hsl.integer(258, 22, 7)), color(hsl.integer(260, 31, 15)), cuprateGrain.mul(0.2))
    // Total Meissner diamagnetic expulsion: metallic mirror luster at grazing angles
    const meissnerMirror = grazing.pow(1.8)
    this.colorNode = mix(ceramicBase, color(hsl.integer(220, 100, 77)), core.mul(0.4))
    this.metalnessNode = mix(float(0.15), float(0.96), meissnerMirror.max(supercurrent.mul(0.4)))
    this.roughnessNode = mix(float(0.36), float(0.04), meissnerMirror.max(core.mul(0.8)))
    // Anisotropic reflections swirling around each vortex core
    this.anisotropy = 0.85
    this.anisotropyNode = currentTangent.div(currentTangent.length().max(1)).mul(0.75)
    // Clearcoat ceramic glaze
    this.clearcoat = 0.85
    this.clearcoatRoughness = 0.035
    // Magnetic flux tube depression in the surface normal
    const fluxIndent = core.mul(-0.0028).add(phaseRings.mul(0.0008))
    this.normalNode = proceduralNormal(fluxIndent, 0.7)
    // Radiation: cyan vortex singularities + concentric phase rings + quantum avalanche sparks
    const coreEmission = coreLight.mul(near.mul(0.4).add(0.6)).mul(3.6)
    const ringEmission = color(hsl.integer(219, 100, 66.5)).mul(phaseRings).mul(1.2)
    const sparkEmission = color(hsl.integer(0, 0, 100)).mul(fluxHop).mul(4.8)
    const meissnerRim = color(hsl.integer(209, 100, 82)).mul(rim.pow(3)).mul(0.35)
    this.emissiveNode = coreEmission
      .add(ringEmission)
      .add(sparkEmission)
      .add(meissnerRim)
  }
}
