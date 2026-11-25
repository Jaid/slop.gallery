import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, negateOnBackSide, normalLocal, transformNormalToView, vec3} from 'three/tsl'

import {voronoi3} from '../../candidates/deepseek/lib/voronoi.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Linear ramp that is 0 below `a` and 1 above `b`. */
const ramp = (x: Node<'float'>, a: number, b: number) => x.sub(a).div(b - a).clamp()
/** Approximation of the visible spectrum in linear light: the classic piecewise-linear fit of the RGB primaries plus the luminosity roll-off at both ends of the band, so the Bragg wavelength of an opal turns into the familiar violet → blue → green → yellow → red march. */
function wavelengthToLinearColor(wavelength: Node<'float'>) {
  const w = wavelength
  const r = ramp(w, 505, 580).mul(ramp(w, 640, 700).oneMinus())
  const g = ramp(w, 430, 490).mul(ramp(w, 510, 590).oneMinus())
  const b = ramp(w, 380, 440).mul(ramp(w, 470, 520).oneMinus())
  const shoulder = ramp(w, 380, 425).mul(0.35).add(0.65)
  const tail = ramp(w, 640, 690).mul(0.5).add(0.5)
  const rolloff = shoulder.mul(tail).mul(ramp(w, 690, 780).oneMinus())
  return vec3(r, g, b).mul(rolloff)
}

/** Precious opal: a sediment of silica microspheres whose regular lattice diffracts white light into a single wavelength per domain. Each domain has its own sphere diameter and its own grating orientation, so the fire slides across the stone as you walk past — exactly the way the real mineral behaves. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const scale = 9
    const q = p.mul(scale).add(mx_fractal_noise_float(p.mul(3.4)).mul(0.35))
    const cell = voronoi3(q)
    const footprint = q.fwidth().length().max(0.0001)
    const identity = cellNoiseVec3(cell.key)
    const identity2 = cellNoiseVec3(cell.key.add(vec3(7.3, 19.1, 3.7)))
// The lattice planes of this domain, and the sphere diameter that sets its wavelength.
    const grating = identity.mul(2).sub(1).add(vec3(0.021, 0.013, 0.037)).normalize()
    const diameter = identity2.x.mul(118).add(104)
    const refractive = 1.45
    const cosTheta = view.dot(grating)
// Bragg: m·λ = 2·d·sqrt(n² − sin²θ), and we keep the first order.
    const wavelength = diameter.mul(2).mul(cosTheta.mul(cosTheta).add(refractive * refractive - 1).max(0.001).sqrt())
    const vivid = (tint: ReturnType<typeof wavelengthToLinearColor>) => {
      const gray = tint.dot(vec3(0.2126, 0.7152, 0.0722))
      return gray.add(tint.sub(gray).mul(2.2)).clamp(0, 1)
    }
    const fire = vivid(wavelengthToLinearColor(wavelength))
// Domains only resolve as discrete patches when they are larger than a pixel; beyond that the
// whole surface settles into a single average shimmer instead of aliasing into confetti.
    const resolved = footprint.smoothstep(0.12, 0.75).oneMinus()
    const domain = cell.edge.smoothstep(0, footprint.mul(0.7).add(0.03))
// A finer second lattice of spheres appears as you step closer.
    const fineCell = voronoi3(q.mul(3.1).add(vec3(31.7, 5.3, 17.9)))
    const fineId = cellNoiseVec3(fineCell.key)
    const fineGrating = fineId.mul(2).sub(1).add(vec3(0.017, 0.029, 0.011)).normalize()
    const fineCos = view.dot(fineGrating)
    const fineWavelength = fineId.y.mul(150).add(150).mul(2).mul(fineCos.mul(fineCos).add(refractive * refractive - 1).max(0.001).sqrt())
    const fineFire = vivid(wavelengthToLinearColor(fineWavelength))
    const fineMask = fineCell.edge.smoothstep(0, 0.06).mul(near).mul(resolved).mul(0.55)
    const strength = fire.mul(domain).add(fineFire.mul(fineMask)).mul(resolved.mul(0.8).add(0.2)).clamp(0, 1)
    const fireColor = fire.mul(domain).add(fineFire.mul(fineMask)).div(strength.max(0.02)).clamp(0, 1)
// A milky silica body, faintly translucent, so the fire sits inside the stone.
    const body = mix(color(hsl.integer(92, 13, 24)), color(hsl.integer(79, 11, 43)), mx_fractal_noise_float(p.mul(7), 3, 2.1, 0.5).mul(0.5).add(0.5))
    this.colorNode = mix(body, fireColor.mul(strength.mul(0.5).add(0.5)), strength.mul(0.95))
    this.metalnessNode = strength.mul(0.45)
    this.roughnessNode = mix(float(0.3), float(0.05), strength)
    this.transmission = 0.08
    this.thickness = 0.3
    this.ior = 1.45
    this.attenuationColor.set(hsl.integer(260, 32, 85))
    this.attenuationDistance = 1.2
    this.clearcoat = 0.22
    this.clearcoatRoughness = 0.05
    this.normalNode = negateOnBackSide(transformNormalToView(normalLocal.normalize().add(cell.offset.div(scale).mul(0.02))))
    this.emissiveNode = fireColor.mul(strength).mul(facing.pow(1.4)).mul(near.mul(0.35).add(0.4)).mul(0.28)
      .add(fireColor.mul(strength).mul(grazing.pow(2)).mul(intimate.mul(0.5).add(0.25)).mul(0.22))
      .add(color(hsl.integer(77, 100, 93.4)).mul(grazing.pow(9)).mul(0.1))
  }
}
