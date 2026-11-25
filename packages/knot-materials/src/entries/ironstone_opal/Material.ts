import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, modelWorldMatrixInverse, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, time, vec3, vec4} from 'three/tsl'

import {voronoi} from '../../candidates/claude_opus/lib/voronoi3dStruct.ts'
import {spectralHue} from '../../candidates/claude_opus/lib/wavelengthColorLobes.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/**
 * One layer of opal: a mosaic of silica-sphere domains, each a crystal with its own lattice orientation and sphere size.
 * A domain diffracts by Bragg’s law, λ = λ₀·cos θ, where θ is the angle between its lattice normal and the bisector of light and eye: it ignites in red when aligned, slides through green into violet as it tilts and then goes dark.
 */
function opalLayer(q: Node<'vec3'>, view: Node<'vec3'>, light: Node<'vec3'>, seed: number) {
  const domain = voronoi(q, 0.92)
  const id = domain.cell.add(seed)
  const orientation = cellNoiseVec3(id.add(13.1)).mul(2).sub(1).normalize()
  const traits = cellNoiseVec3(id.add(57.7))
// Red needs the largest spheres and the straightest view, so it stays the rarest color, as in real stones.
  const spacing = traits.x.pow(1.4).mul(260).add(470)
  const acceptance = traits.y.mul(0.16).add(0.76)
// Striations: stacking faults run through each domain as parallel ribbons that nudge its color.
  const faultAxis = cellNoiseVec3(id.add(91.3)).mul(2).sub(1).normalize()
  const faultPhase = q.dot(faultAxis).mul(traits.z.mul(9).add(6)).add(mx_noise_float(q.mul(2.2)).mul(2))
  const faultVisibility = faultPhase.fwidth().smoothstep(0.8, 2.5).oneMinus()
  const fault = faultPhase.sin().mul(faultVisibility)
  const flash = (bisector: Node<'vec3'>) => {
    const cosine = orientation.dot(bisector).abs()
    const wavelength = spacing.mul(cosine).add(fault.mul(14))
    return spectralHue(wavelength).mul(cosine.smoothstep(acceptance, acceptance.add(0.07)))
  }
// Light reaches the eye from the gallery behind the viewer and from the ceiling.
  const glow = flash(view).add(flash(view.add(light).normalize()).mul(0.75))
  const ribbon = fault.mul(0.22).add(0.78)
// Thin dark seams between domains keep the harlequin pattern crisp.
  const seam = domain.border.smoothstep(0, domain.border.fwidth().mul(1.5).add(0.02))
  return glow.mul(ribbon).mul(seam).mul(traits.z.mul(0.6).add(0.55))
}
/** Black opal in an ironstone matrix: a dark potch body under a mirror polish, carrying two depths of harlequin play-of-color and a pinfire of tiny grains up close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const light = modelWorldMatrixInverse.mul(vec4(0, 1, 0, 0)).xyz.normalize()
// Opal grew in folded sheets, so the domains are sheared and stretched, never a regular foam.
    const warp = mx_noise_vec3(p.mul(4.5)).mul(0.05).add(mx_noise_vec3(p.mul(13).add(5.1)).mul(0.012))
    const front = opalLayer(p.sub(view.mul(0.005)).add(warp).mul(vec3(24, 30, 27)), view, light, 0)
    const back = opalLayer(p.sub(view.mul(0.022)).add(warp.mul(1.6)).mul(vec3(13, 16, 14)), view, light, 41)
    const veil = front.length().smoothstep(0, 0.5).oneMinus().mul(0.65).add(0.35)
// Pinfire: tiny grains that each flash one color, resolving only within arm’s reach.
    const pinQ = p.sub(view.mul(0.012)).mul(150)
    const pinId = cellNoiseVec3(pinQ.floor().add(7.7))
    const pinOrientation = pinId.mul(2).sub(1).normalize()
    const pinCos = pinOrientation.dot(view).abs()
    const pinfire = spectralHue(pinCos.mul(380).add(380)).mul(cellularPoints(pinQ, 0.04, 0.2, 0.55)).mul(pinCos.smoothstep(0.5, 0.75)).mul(intimate)
// Ironstone matrix: brown veins and islands that carry no fire.
    const strata = mx_fractal_noise_float(p.mul(vec3(2.4, 3.4, 2.9)).add(warp.mul(3)), 4, 2.1, 0.55)
    const ironstone = strata.sub(0.2).abs().smoothstep(0.06, 0.035).max(strata.smoothstep(0.5, 0.56))
    const matrixGrain = mx_noise_float(p.mul(90)).mul(0.5).add(0.5)
    const matrixColor = mix(color(hsl.integer(52, 52, 12)), color(hsl.integer(55, 59, 33)), matrixGrain.mul(strata.add(0.5).clamp()))
// A breath of movement: the fire drifts very slightly, like light moving through the stone.
    const shimmer = time.mul(0.7).add(p.x.mul(9)).sin().mul(0.06).add(1)
    const fire = front.mul(1.15).add(back.mul(veil).mul(0.75)).add(pinfire.mul(1.4)).mul(shimmer).mul(near.mul(0.2).add(0.9))
    const opal = ironstone.oneMinus()
    this.colorNode = mix(color(hsl.integer(268, 37, 3)), matrixColor, ironstone)
    this.metalness = 0
    this.roughnessNode = mix(float(0.05), float(0.55).sub(matrixGrain.mul(0.15)), ironstone)
    this.clearcoatNode = opal
    this.clearcoatRoughness = 0.015
    this.specularIntensityNode = mix(float(1), float(0.35), ironstone)
// The polished opal sits proud of the weathered ironstone, which is pitted and rough.
    const relief = opal.mul(0.0012).add(matrixGrain.mul(ironstone).mul(0.0004))
    this.normalNode = proceduralNormal(relief, 1)
// A faint cold sheen from deep in the potch at grazing angles, the body color of a true black opal.
    const potchGlow = color(hsl.integer(262, 71, 12)).mul(grazing.pow(3)).mul(0.6)
    this.emissiveNode = fire.mul(opal).mul(facing.mul(0.35).add(0.65)).add(potchGlow.mul(opal))
  }
}
