import type {Node, Texture} from 'three/webgpu'

import {color, float, luminance, mix, mx_noise_float, time, uv, vec3} from 'three/tsl'

import {environmentRadiance} from '../../candidates/claude_opus/lib/environmentRadiance.ts'
import {pixelFootprint} from '../../candidates/claude_opus/lib/footprint.ts'
import {knotFrame} from '../../candidates/claude_opus/lib/knotFrameOpus55.ts'
import {tubeInterior} from '../../candidates/claude_opus/lib/tubeInterior.ts'
import {tubeRelief} from '../../candidates/claude_opus/lib/tubeRelief.ts'
import {wavelengthColor} from '../../candidates/claude_opus/lib/wavelengthColorZucconi.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const rows = 8
/** rows wind three times around the tube over the knot; any integer keeps the UV seam closed */
const rowTwist = 24
const platesPerRow = 560
const wavesPerRow = 34
/** Comb-row layout at a tube coordinate; pure UV math so it can drive both relief and shading. */
function combs(tube: Node<'vec2'>) {
  const rowCoord = tube.y.mul(rows).add(tube.x.mul(rowTwist))
  const row = rowCoord.floor().mod(rows)
// plates bow into shallow chevrons, like fused cilia fanning from the row's spine
  const across0 = rowCoord.fract().sub(0.5)
  const plateCoord = tube.x.mul(platesPerRow).add(across0.mul(across0).mul(9))
// metachronal wave: each row beats a little out of step with its neighbours
  const phase = tube.x.mul(wavesPerRow * TAU).sub(time.mul(2.1 * TAU)).add(row.mul(0.83))
// quick power stroke, slow recovery
  const stroke = phase.sin().mul(0.5).add(0.5).pow(3)
  return {
    across: across0,
    phase,
    plateCoord,
    row,
    rowCoord,
    stroke,
  }
}
/** A comb jelly drifting in the dark. Eight ciliated comb rows spiral around a body of glassy mesoglea; metachronal waves ripple down them, and each beating plate diffracts the gallery light into running rainbows whose hues slide with the viewer's angle. Meridional canals glow with bioluminescence that swells as the observer approaches, and marine snow drifts inside. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.45)
    this.name = knotData.id
    const tube = uv()
    const {objectDistance, grazing, facing} = viewerFrame()
    const startle = objectDistance.smoothstep(1.1, 2.6).oneMinus()
    const comb = combs(tube)
    const rowWidth = 0.13
    const pixel = pixelFootprint()
// rows per object unit around the tube, plates per object unit along it
    const rowFootprint = pixel.balanced.mul(rows / 0.8168)
    const rowMask = comb.across.abs().smoothstep(rowWidth, rowFootprint.add(rowWidth)).oneMinus()
// individual plates, averaged to their mean coverage once they shrink below a pixel
// plates crowd on the inside of bends and recede at the silhouette: filter with the stretched footprint
    const plateFootprint = pixel.stretched.mul(platesPerRow / 7.177 * 1.4)
    const plateLocal = comb.plateCoord.fract().sub(0.5).abs()
    const plateSharp = plateLocal.smoothstep(float(0.18).sub(plateFootprint), float(0.18).add(plateFootprint)).oneMinus()
    const plateResolved = plateFootprint.smoothstep(0.12, 0.35).oneMinus()
    const plates = mix(float(0.36), plateSharp, plateResolved)
// the whole body breathes: a slow peristaltic swell travels down the knot
    const breathing = (at: Node<'vec2'>) => at.x.mul(6 * TAU).sub(time.mul(0.7)).add(at.y.mul(TAU).sin().mul(0.6)).sin().mul(0.0045)
    const height = (at: Node<'vec2'>) => {
      const c = combs(at)
      const ridge = c.across.abs().smoothstep(0.02, rowWidth + 0.03).oneMinus()
      const plate = c.plateCoord.fract().sub(0.5).abs().smoothstep(0.1, 0.3).oneMinus()
      return ridge.mul(0.0032).add(ridge.mul(plate).mul(c.stroke).mul(0.0009)).add(breathing(at))
    }
    const relief = tubeRelief(height)
    const rest = knotFrame(tube)
    this.positionNode = rest.position.add(rest.normal.mul(breathing(tube)))
    const {objectNormal, frame} = relief
    this.normalNode = relief.viewNormal
    const interior = tubeInterior({ior: 1.34})
    const view = interior.view
// the beating plate tilts its grating; diffraction order and hue follow the tilt and the eye
    const tilt = comb.stroke.mul(0.9).sub(0.3)
    const plateNormal = objectNormal.add(frame.tangent.mul(tilt)).normalize()
    const plateAxis = frame.tangent.sub(objectNormal.mul(tilt)).normalize()
    const grating = view.dot(plateAxis)
    const wavelength = grating.mul(1.7).add(comb.stroke.mul(0.35)).add(comb.row.mul(0.137)).fract().mul(310).add(395)
    const radiance = luminance(environmentRadiance(environment, view.negate().reflect(plateNormal), 0.25))
    const combLight = wavelengthColor(wavelength)
      .mul(radiance.mul(0.9).add(0.3))
      .mul(comb.stroke.mul(0.85).add(0.15))
      .mul(plates)
      .mul(rowMask)
// meridional canals run beneath each row; bioluminescent pulses travel along them
    const canalDepth = interior.sample(0.018).tube
    const canalRow = canalDepth.y.mul(rows).add(canalDepth.x.mul(rowTwist))
    const canalAcross = canalRow.fract().sub(0.5).abs()
    const canal = canalAcross.smoothstep(0.035, rowFootprint.add(0.035)).oneMinus()
    const canalHalo = canalAcross.smoothstep(0, 0.3).oneMinus().pow(3)
    const pulseCoord = canalDepth.x.mul(5).sub(time.mul(0.23)).add(canalRow.floor().mod(rows).mul(0.377))
// a soft-fronted comet of light: quick rise, long fading tail, no hard edge at the wrap
    const pulsePhase = pulseCoord.fract()
    const pulseShape = pulsePhase.oneMinus().pow(7).mul(pulsePhase.smoothstep(0, 0.06))
    const pulse = pulseShape.add(0.05)
    const glow = canal.mul(0.8).add(canalHalo.mul(0.35)).mul(pulse.mul(startle.mul(2.2).add(0.6)))
    const bioluminescence = mix(color('#0a7dff'), color('#19ffc6'), pulseShape.pow(0.6)).mul(glow)
// marine snow and plankton drifting at several depths inside the mesoglea
    const drift = vec3(time.mul(0.004), time.mul(-0.006), time.mul(0.003))
    let snow: Node<'float'> = float(0)
    for (const [depth, scale] of [[0.03, 95], [0.06, 70], [0.1, 52]] as const) {
      const point = interior.sample(depth).position.add(drift).mul(scale)
      const resolved = pixel.balanced.mul(scale).smoothstep(0.25, 0.7).oneMinus()
      snow = snow.add(cellularPoints(point, 0, 0.17, 0.88).pow(2).mul(resolved).mul(0.7 - depth * 3))
    }
    const mesoglea = mx_noise_float(interior.sample(0.05).position.mul(6).add(drift.mul(20))).mul(0.5).add(0.5)
    const edge = grazing.pow(2.5)
// through the glassy body, the comb rows on the far wall of the tube shimmer faintly
    const farWall = combs(interior.sample(interior.chord).tube)
    const farRow = farWall.across.abs().smoothstep(0.05, 0.2).oneMinus()
    const farLight = wavelengthColor(farWall.stroke.mul(0.4).add(farWall.row.mul(0.137)).add(view.dot(frame.tangent).mul(1.3)).fract().mul(310).add(395))
      .mul(farWall.stroke.mul(0.8).add(0.2)).mul(farRow).mul(interior.chord.mul(-4).exp())
    this.colorNode = mix(color('#000003'), color('#02030c'), mesoglea)
    this.metalness = 0
    this.roughness = 0.1
    this.specularIntensity = 0.5
    this.clearcoat = 0.35
    this.clearcoatRoughness = 0.05
    this.emissiveNode = combLight.mul(1.6)
      .add(bioluminescence.mul(facing.mul(0.6).add(0.4)))
      .add(farLight.mul(0.3))
      .add(color('#0b3cff').mul(interior.chord.mul(1.1)).mul(pulse.mul(0.5).add(0.2)).mul(startle.mul(0.6).add(0.4)).mul(0.25))
      .add(color('#b9c8ff').mul(snow).mul(startle.mul(0.7).add(0.3)).mul(0.5))
      .add(mix(color('#150a52'), color('#127f9c'), mesoglea).mul(edge).mul(0.45))
      .add(color('#0b1a4a').mul(mesoglea).mul(0.06))
  }
}
