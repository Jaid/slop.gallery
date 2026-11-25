import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, negateOnBackSide, normalLocal, time, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {ramp} from '../../candidates/claude_sonnet/lib/ramp.ts'
import {rainbow} from '../../candidates/claude_sonnet/lib/spectralRainbow.ts'
import {filteredRoughness} from '../../candidates/claude_sonnet/lib/specularFilter.ts'
import {knotFrame} from '../../candidates/claude_sonnet/lib/tubeBasis.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

// Anatomy. Everything is an integer count per UV period, so no pattern can break at the seams.
const rows = 8
const plates = 640
const wavelength = 16 // plates per metachronal wave; 640 / 16 = 40 waves around the knot
const sparkGrid: [number, number] = [96, 12]
// The tube is about 7.18 long and 0.82 around: lengths used to convert depth into UV units.
const lengthPerU = 7.18
const lengthPerRow = 0.8168 / rows
/** Triangle-folded fract: continuous everywhere, so a hue sweep never snaps from red back to blue. */
const fold = (x: Node<'float'>) => x.fract().mul(2).sub(1).abs()

/** A comb jelly. Eight rows of ciliary plates run the length of the tube and beat in traveling waves; every plate is a tiny diffraction grating, so its color is set by the viewing angle along the row. Canals glow under the skin and slide with parallax, bioluminescent sparks wake as you approach, and a nerve impulse races along the body. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const {p, view, facing, rim, objectDistance} = viewerFrame()
    const tube = uv()
    const basis = knotFrame(tube)
    const near = ramp(objectDistance, 3.8, 1.3)
    const viewAlong = view.dot(basis.along)
    const viewAround = view.dot(basis.around)
    const viewNormal = view.dot(basis.normal).max(0.3)
    // nerve impulse: a sharp front with a long luminous wake, every nine seconds
    const behind = time.mul(0.11).sub(tube.x).fract()
    const pulse = behind.mul(-9).exp().add(behind.oneMinus().mul(-70).exp().mul(0.5))
    // comb rows: lateral band profile with coverage compensation, so distant rows dim instead of flickering
    const rowCoord = tube.y.mul(rows)
    const rowId = rowCoord.floor().mod(rows)
    const across = rowCoord.fract().sub(0.5)
    const rowPixel = rowCoord.fwidth().max(0.0005)
    const bandHalf = float(0.17)
    const band = ramp(across.abs(), bandHalf.add(rowPixel), bandHalf.sub(rowPixel).max(0)).mul(bandHalf.div(rowPixel).min(1))
    // plates: rigid, each with its own phase in a traveling wave; unresolved plates settle to the mean beat
    const index = tube.x.mul(plates)
    const plateId = index.floor().mod(plates)
    const inPlate = index.fract()
    const plateRandom = cellNoiseVec3(vec3(plateId, rowId, 3.1))
    const resolved = ramp(index.fwidth().max(0.0005), 0.65, 0.18)
    const phase = time.mul(TAU * 1.25)
      .sub(plateId.mul(TAU / wavelength))
      .add(rowId.mul(0.9))
      .add(plateRandom.x.mul(0.35))
    const beat = phase.add(phase.sin().mul(0.6)).sin()
    const crest = mix(0.27, phase.sub(0.4).cos().mul(0.5).add(0.5).pow(4), resolved)
    // diffraction: the hue follows the view direction along the row, each plate's tilt and the position within the plate
    const sweep = viewAlong.mul(0.9).add(beat.mul(0.3)).add(inPlate.sub(0.5).mul(0.45)).add(rowId.mul(0.06)).add(0.35)
    const diffraction = rainbow(fold(sweep))
    const cilia = mix(1, across.mul(TAU * 12).cos().mul(0.35).add(0.65), ramp(rowPixel, 0.14, 0.04))
    const combs = diffraction.mul(crest.mul(1.9).add(0.12)).mul(band).mul(cilia).mul(pulse.mul(2.4).add(near.mul(0.7)).add(1))
    // canals under the rows: the parallax of the view ray pushes them sideways as you walk around the creature
    const depth = 0.045
    const shiftAcross = viewAround.div(viewNormal).mul(depth / lengthPerRow)
    const shiftAlong = viewAlong.div(viewNormal).mul(depth / lengthPerU)
    const deepAcross = rowCoord.sub(shiftAcross).fract().sub(0.5)
    const canalLine = deepAcross.mul(deepAcross).mul(-150).exp()
    const canalBeads = tube.x.sub(shiftAlong).mul(plates / 8).mul(TAU).sub(time.mul(3)).cos().mul(0.5).add(0.5).pow(2).mul(0.7).add(0.3)
    const canals = color(hsl.integer(309, 100, 58.5)).rgb.mul(canalLine).mul(canalBeads).mul(pulse.mul(1.8).add(0.55)).mul(facing.mul(0.6).add(0.4))
    // bioluminescent sparks: dormant cells wake as the viewer approaches
    const spots = tube.mul(vec2(...sparkGrid))
    const spotCell = wrapCell(spots.floor(), vec2(...sparkGrid))
    const spotLocal = spots.fract().sub(0.5)
    const sparkRandom = cellNoiseVec3(vec3(spotCell, 1.3))
    const sparkRandom2 = cellNoiseVec3(vec3(spotCell, 8.8))
    const period = sparkRandom.x.mul(5).add(2.5)
    const age = time.add(sparkRandom.y.mul(period)).mod(period)
    const threshold = near.mul(0.45).add(0.3)
    const awake = ramp(sparkRandom.z, threshold.add(0.06), threshold)
    const burst = age.mul(-3.2).exp().mul(ramp(age, 0, 0.04))
    const bead = ramp(spotLocal.sub(sparkRandom.xy.sub(0.5).mul(0.35)).length(), 0.26, 0).pow(2)
    const sparkTint = mix(color(hsl.integer(172, 100, 87.5)).rgb, color(hsl.integer(263, 100, 55.4)).rgb, sparkRandom2.x)
    const sparks = sparkTint.mul(bead).mul(burst.add(pulse.mul(0.6))).mul(awake)
    // gel: ink-blue body with a slow internal variation, a cold rim glow and a thin-film sheen
    const gel = mx_fractal_noise_float(p.mul(3.4).add(vec3(0, 0, time.mul(0.03))), 3, 2.1, 0.5).mul(0.5).add(0.5)
    const breathe = tube.x.mul(TAU * 3).sub(time.mul(0.9)).sin().mul(0.5).add(0.5)
    const body = mix(color(hsl.integer(256, 74, 4)), color(hsl.integer(248, 83, 17)), gel.smoothstep(0.25, 0.85)).rgb
    const glow = color(hsl.integer(257, 97, 45)).rgb.mul(rim).mul(breathe.mul(0.12).add(0.2))
      .add(color(hsl.integer(280, 94, 37.6)).rgb.mul(rim.pow(2)).mul(0.25))
    // plates tilt the shading normal in a sawtooth with the beat; unresolved plates fall back to the smooth gel
    const slope = inPlate.sub(0.5).mul(1.1).add(beat.mul(0.55))
    const tilt = basis.along.mul(slope).add(basis.around.mul(across.mul(2.4))).mul(band).mul(resolved).mul(0.6)
    const normal = negateOnBackSide(transformNormalToView(normalLocal.normalize().add(tilt).normalize()))
    this.colorNode = body
    this.metalness = 0
    this.roughnessNode = filteredRoughness(mix(float(0.06), float(0.16), band), normal)
    this.ior = 1.34
    this.clearcoat = 1
    this.clearcoatRoughnessNode = filteredRoughness(0.03, normal)
    this.iridescence = 0.4
    this.iridescenceIOR = 1.35
    this.iridescenceThicknessNode = gel.mul(120).add(rim.mul(260)).add(190)
    this.normalNode = normal
    this.clearcoatNormalNode = normal
    this.emissiveNode = combs.mul(1.25)
      .add(canals)
      .add(sparks.mul(2.6))
      .add(glow)
      .add(color(hsl.integer(229, 99, 81)).rgb.mul(pulse).mul(rim).mul(0.5))
  }
}
