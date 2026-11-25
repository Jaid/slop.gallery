import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_hsvtorgb, mx_noise_float, mx_noise_vec3, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {voronoiCells} from '../../candidates/deepseek/lib/voronoiCells.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Saturated single-wavelength color, the way a diffraction grating answers the eye. */
const spectral = (hue: Node<'float'>, saturation: number) => mx_hsvtorgb(vec3(hue, saturation, 1))
/** Noble opal. A milky silica gel hides a three-dimensional diffraction grating built from packed microspheres. Every domain has its own sphere size and lattice orientation, so it answers a different wavelength at a different angle: turn the knot and whole fields of the stone trade their green for blue, their blue for fire. The pinfire specks are the smallest domains, which only resolve when the viewer comes close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, grazing, intimate} = viewerFrame()
    const warp = mx_noise_vec3(p.mul(3.1)).mul(0.1)
    const q = p.add(view.mul(0.06)).add(warp)
// Harlequin fields: broad, angular domains of coherent color.
    const fields = voronoiCells(q.mul(11))
    const fieldRandom = cellNoiseVec3(fields.identity)
    const fieldRandom2 = cellNoiseVec3(fields.identity.add(19.1))
    const grating = fieldRandom.mul(2).sub(1).normalize()
    const align = view.dot(grating).abs()
// Sphere size sets the wavelength; the viewing angle slides it along the spectrum.
    const spacing = fieldRandom2.x.mul(0.55).add(0.45)
    const phase = spacing.mul(align.oneMinus()).mul(0.7).add(fieldRandom2.y)
    const fieldSpectral = spectral(phase.fract(), 1)
    const fieldFlash = align.smoothstep(0.42, 0.62).mul(fieldRandom2.z.smoothstep(0.08, 0.62).mul(0.65).add(0.35))
// Pinfire: the smallest domains, only resolved at arm's length.
    const pin = voronoiCells(q.mul(34))
    const pinRandom = cellNoiseVec3(pin.identity.add(5.7))
    const pinGrating = pinRandom.mul(2).sub(1).normalize()
    const pinAlign = view.dot(pinGrating).abs()
    const pinPhase = pinRandom.y.mul(1.6).add(pinAlign.oneMinus().mul(0.6)).add(pinRandom.z)
    const pinSpectral = spectral(pinPhase.fract(), 1)
    const pinFlash = pinAlign.smoothstep(0.5, 0.72).mul(pinRandom.x.smoothstep(0.35, 0.8)).mul(intimate)
// Milky potch body: a translucent gel with a faint blue cast.
    const gel = mx_noise_float(p.mul(6)).mul(0.5).add(0.5)
    const grain = mx_noise_float(p.mul(90)).mul(0.5).add(0.5)
    const body = mix(color(hsl.integer(255, 15, 40)), color(hsl.integer(90, 14, 55)), gel.mul(0.6).add(grain.mul(0.25)))
// Light that scatters sideways through the gel, so the fire sits in a soft bloom.
    const bloom = align.smoothstep(0.1, 0.75).mul(0.22).add(pinAlign.smoothstep(0.1, 0.9).mul(0.12).mul(intimate))
    const fire = fieldSpectral.mul(fieldFlash).add(pinSpectral.mul(pinFlash))
    const fireBloom = fieldSpectral.mul(bloom).add(pinSpectral.mul(bloom.mul(0.4)))
// A slow drift keeps the fire breathing instead of frozen.
    const breath = time.mul(0.25).add(fieldRandom.z.mul(6.283)).sin().mul(0.05).add(0.95)
    this.colorNode = body.add(fire.mul(0.35)).add(fireBloom.mul(0.16))
    this.metalness = 0
    this.roughnessNode = float(0.07).sub(fire.mul(0.02)).clamp(0.04, 0.1)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.ior = 1.44
    this.iridescence = 0.2
    this.iridescenceIOR = 1.4
    this.iridescenceThicknessNode = fieldRandom2.x.mul(180).add(220)
    const relief = gel.mul(0.4).add(grain.mul(0.3)).add(fields.edge.smoothstep(0, 0.02).oneMinus().mul(0.25))
    this.normalNode = proceduralNormal(relief, 0.0004)
    this.clearcoatNormalNode = this.normalNode
    this.emissiveNode = fire.mul(2.2).mul(breath).add(fireBloom.mul(0.4)).add(color(hsl.integer(255, 100, 90)).mul(grazing.pow(4)).mul(0.02))
    this.aoNode = float(0.95)
    this.positionNode = positionGeometry.add(normalLocal.mul(fields.edge.smoothstep(0, 0.02).oneMinus().mul(-0.0004)))
  }
}
