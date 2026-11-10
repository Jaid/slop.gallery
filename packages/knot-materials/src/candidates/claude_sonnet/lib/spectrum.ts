import type {Triple} from '../../../lib/Triple.ts'
import type {Node} from 'three/webgpu'

import {float, vec3} from 'three/tsl'

import {TAU} from '../../../lib/TAU.ts'

const lobe = (wavelength: number, center: number, left: number, right: number) => Math.exp(-0.5 * ((wavelength - center) / (wavelength < center ? left : right)) ** 2)
/** Linear sRGB radiance of a monochromatic wavelength in nanometers (multi-lobe CIE 1931 fit), clipped to the gamut. */
export function wavelengthRgb(wavelength: number): Triple {
  const x = 1.056 * lobe(wavelength, 599.8, 37.9, 31) + 0.362 * lobe(wavelength, 442, 16, 26.7) - 0.065 * lobe(wavelength, 501.1, 20.4, 26.2)
  const y = 0.821 * lobe(wavelength, 568.8, 46.9, 40.5) + 0.286 * lobe(wavelength, 530.9, 16.3, 31.1)
  const z = 1.217 * lobe(wavelength, 437, 11.8, 36) + 0.681 * lobe(wavelength, 459, 26, 13.8)
  return [Math.max(0, 3.2406 * x - 1.5372 * y - 0.4986 * z), Math.max(0, -0.9689 * x + 1.8758 * y + 0.0415 * z), Math.max(0, 0.0557 * x - 0.204 * y + 1.057 * z)]
}
const filmWavelengths = Array.from({length: 14}, (_, index) => 404 + index * 22)
const filmWeights = filmWavelengths.map(wavelengthRgb)
const filmNormalization = filmWeights.reduce<Triple>((sum, weight) => [sum[0] + weight[0], sum[1] + weight[1], sum[2] + weight[2]], [0, 0, 0])
/** Two-beam interference reflectance of a thin film, integrated over the visible spectrum instead of three fake RGB wavelengths, so thick films fade toward pastel exactly like real soap and oil. `opticalPath` is n·d·cosθt in nanometers; a film of zero thickness reflects nothing, a quarter-wave film reflects its wavelength fully. */
export function thinFilm(opticalPath: Node<'float'>) {
  let sum: Node<'vec3'> = vec3(0)
  for (const [index, wavelength] of filmWavelengths.entries()) {
    const [r, g, b] = filmWeights[index]
    const reflectance = opticalPath.mul(TAU / wavelength).sin().pow2()
    sum = sum.add(vec3(r / filmNormalization[0], g / filmNormalization[1], b / filmNormalization[2]).mul(reflectance))
  }
  return sum
}
const nodeLobe = (wavelength: Node<'float'>, center: number, left: number, right: number) => {
  const offset = wavelength.sub(center)
  return offset.div(offset.lessThan(0).select(float(left), float(right))).pow2().mul(-0.5).exp()
}
/** Linear sRGB radiance of a monochromatic wavelength node in nanometers; the continuous counterpart of `wavelengthRgb`. */
export function wavelengthColor(wavelength: Node<'float'>) {
  const x = nodeLobe(wavelength, 599.8, 37.9, 31).mul(1.056).add(nodeLobe(wavelength, 442, 16, 26.7).mul(0.362)).sub(nodeLobe(wavelength, 501.1, 20.4, 26.2).mul(0.065))
  const y = nodeLobe(wavelength, 568.8, 46.9, 40.5).mul(0.821).add(nodeLobe(wavelength, 530.9, 16.3, 31.1).mul(0.286))
  const z = nodeLobe(wavelength, 437, 11.8, 36).mul(1.217).add(nodeLobe(wavelength, 459, 26, 13.8).mul(0.681))
  return vec3(x.mul(3.2406).sub(y.mul(1.5372)).sub(z.mul(0.4986)), x.mul(-0.9689).add(y.mul(1.8758)).add(z.mul(0.0415)), x.mul(0.0557).sub(y.mul(0.204)).add(z.mul(1.057))).max(0)
}
/** Gain that lifts the dim violet and deep-red ends of `wavelengthColor` so its brightest channel reaches 1, fading to zero beyond the visible band (about 390–720 nm). A tile whose diffraction wavelength leaves the band therefore simply goes dark. */
export function spectrumIntensity(wavelength: Node<'float'>) {
  const color = wavelengthColor(wavelength)
  const peak = color.x.max(color.y).max(color.z).max(0.05)
  const band = wavelength.smoothstep(385, 425).mul(wavelength.smoothstep(680, 725).oneMinus())
  return peak.reciprocal().min(6).mul(band)
}
