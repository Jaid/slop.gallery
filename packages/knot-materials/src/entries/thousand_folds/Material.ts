import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, time, vec2, vec3} from 'three/tsl'

import {debugLayer} from '../../candidates/claude_fable/lib/debugLayer.ts'
import {environmentHighlight, studioSheen} from '../../candidates/claude_fable/lib/environmentHighlight.ts'
import {glints} from '../../candidates/claude_fable/lib/glints.ts'
import {proceduralNormal} from '../../candidates/claude_fable/lib/proceduralNormal.ts'
import {rgb} from '../../candidates/claude_fable/lib/rgb.ts'
import {tubeCoordinates, tubeNoiseCoordinate} from '../../candidates/claude_fable/lib/tubeCoordinates.ts'
import {viewerFrame} from '../../candidates/claude_fable/lib/viewerFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import knotData from './data.ts'

/** Pattern-welded steel. The billet is a stack of alternating bright (nickel) and dark (carbon) layers, folded and twisted; the knot's surface cuts through that stack, so the pattern is a true 3D slice and flows around the tube in the topographic ribbons of real Damascus. Acid etching leaves the dark layers recessed and matte while the bright layers stay polished and brushed, and heat has tinted the bright steel with the straw–bronze–purple–blue oxide colors of tempering, which shift with the viewing angle as thin films do. Close up, the etched grooves keep a faint memory of the forge. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.2)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const {along, around} = tubeCoordinates()
// The stack: layers along one axis, folded by low-frequency warps and twisted along the tube.
    const twist = along.mul(Math.PI * 2 * 6)
    const twistedX = p.x.mul(twist.cos()).sub(p.y.mul(twist.sin()))
    const warp = mx_fractal_noise_float(p.mul(3.1), 3, 2.2, 0.55).mul(0.32).add(mx_noise_float(p.mul(11)).mul(0.04))
    const stack = twistedX.mul(1.9).add(p.z.mul(0.7)).add(warp)
    const layerCount = 34
    const layerPhase = stack.mul(layerCount)
// Bright layers are a little narrower than dark ones; the transition is filtered so distant views settle to gray.
    const footprint = layerPhase.fwidth().max(0.001)
    const profile = layerPhase.fract().sub(0.5).abs().mul(2)
    const bright = profile.smoothstep(float(0.42).sub(footprint), float(0.42).add(footprint))
    const resolved = footprint.smoothstep(0.35, 1).oneMinus()
    const brightMix = mix(float(0.55), bright, resolved)
// Etching relief: dark layers recessed; brushed micro-grooves along the tube on the bright ones.
    const grain = mx_noise_float(tubeNoiseCoordinate(along, around, 9, 420)).mul(0.5).add(0.5)
    const relief = brightMix.mul(0.0016).add(grain.mul(brightMix).mul(0.0002))
    const surfaceNormal = proceduralNormal(relief, 1)
    this.normalNode = surfaceNormal
// Tempering colors: an oxide film whose thickness grows along the knot, with a hand-held torch's unevenness.
    const heat = along.mul(Math.PI * 2).sin().mul(0.5).add(0.5).mul(0.7).add(mx_noise_float(p.mul(2.3)).mul(0.3))
    const oxideThickness = heat.mul(330).add(120)
    const brightSteel = rgb(hsl.integer(258, 21, 93))
    const darkSteel = rgb(hsl.integer(258, 9, 9))
    this.colorNode = mix(darkSteel, brightSteel, brightMix)
    this.metalness = 1
    this.roughnessNode = mix(float(0.6), float(0.1).add(grain.mul(0.05)), brightMix).add(grazing.mul(0.03))
    this.anisotropyNode = vec2(1, 0).mul(brightMix.mul(0.6).add(0.15))
    this.iridescenceNode = brightMix.mul(heat.smoothstep(0.15, 0.5)).mul(0.9)
    this.iridescenceIOR = 2.4
    this.iridescenceThicknessNode = oxideThickness
// The room's lights as crisp bands on the bright steel and a light-tent gradient for contrast.
    const highlight = environmentHighlight(environment, n, 0.06).mul(brightMix).mul(0.8)
    const sheen = studioSheen(n).mul(brightSteel).mul(brightMix).mul(0.2)
// The forge's memory: at close range, the etched grooves warm to a deep ember that breathes slowly.
    const breath = time.mul(0.45).add(along.mul(Math.PI * 4)).sin().mul(0.5).add(0.5)
    const ember = rgb(hsl.integer(35, 100, 61)).mul(brightMix.oneMinus()).mul(intimate).mul(breath.mul(0.6).add(0.2)).mul(facing).mul(0.08)
    const glint = glints(surfaceNormal, 90).mul(brightMix).mul(brightSteel).mul(0.12).mul(near.mul(0.5).add(0.5))
    const {emissive, isolated} = debugLayer({
      bright,
      brightMix,
      heat,
      highlight,
      ember,
      glint,
      relief: relief.mul(500),
    }, () => highlight.add(sheen).add(ember).add(glint))
    this.emissiveNode = emissive
    if (isolated) {
      this.colorNode = vec3(0)
      this.envMapIntensity = 0
      this.iridescence = 0
    }
  }
}
