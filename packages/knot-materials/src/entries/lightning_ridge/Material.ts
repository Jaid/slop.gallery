import type {Node, Texture} from 'three/webgpu'

import {color, float, mix, mx_fractal_noise_float, mx_fractal_noise_vec3, mx_noise_float, refract, time, vec3} from 'three/tsl'

import {environmentContrast} from '../../candidates/claude_opus/lib/environmentLight.ts'
import {parallaxOffset, surfaceFrame} from '../../candidates/claude_opus/lib/knotSpace.ts'
import {wavelengthToRgb} from '../../candidates/claude_opus/lib/spectrum.ts'
import {voronoiCells} from '../../candidates/claude_opus/lib/voronoi3.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const silicaIndex = 1.45
/** The gallery’s lights, in object space: overhead, the key light, a low fill. */
const lamps: Array<[[number, number, number], number]> = [[[0, 1, 0.15], 1], [[-0.17, 0.49, -0.86], 0.9], [[0.62, 0.25, 0.74], 0.6]]
/** One layer of play-of-color. Every domain is a crystal of silica spheres: a Bragg mirror with its own lattice normal and spacing, reflecting a single pure wavelength – and only when the light, the lattice and the eye line up. Mosaic spread inside a domain makes the flash roll across it instead of switching all at once. */
function playOfColor(environment: Texture, position: Node<'vec3'>, inside: Node<'vec3'>, scale: number, seed: number) {
  const cells = voronoiCells(position.mul(scale).add(seed))
  const identity = cellNoiseVec3(cells.cell.add(seed))
  const spacing = cellNoiseVec3(cells.cell.add(seed + 41.7))
// Lattice normal: random per domain, gently precessing, and rippled by mosaic spread within the domain.
  const drift = vec3(time.mul(0.07).add(identity.x.mul(6.3)).sin(), time.mul(0.053).add(identity.y.mul(6.3)).cos(), 0).mul(0.05)
  const mosaic = mx_fractal_noise_vec3(position.mul(scale * 3.2).add(seed), 2, 2, 0.5).mul(0.22)
  const lattice = identity.mul(2).sub(1).add(drift).add(mosaic).normalize()
// Sphere spacing sets the reflected wavelength; larger spheres reach into the reds, so red fire is rarest.
  const sphereSpacing = spacing.x.pow(1.6).mul(95).add(165)
  let fire: Node<'vec3'> = vec3(0)
  for (const [direction, strength] of lamps) {
    const lamp = vec3(...direction).normalize()
    const scatter = lamp.add(inside)
    const alignment = scatter.normalize().dot(lattice).abs()
    const wavelength = sphereSpacing.mul(2 * silicaIndex).mul(scatter.length().mul(0.5)).mul(alignment)
    const lobe = alignment.sub(1).mul(32).exp().add(alignment.sub(1).mul(6).exp().mul(0.12))
    fire = fire.add(wavelengthToRgb(wavelength).mul(lobe).mul(strength))
  }
// The room itself: each domain mirrors whatever bright source lies in its Bragg direction.
  const mirrored = inside.negate().reflect(lattice)
  const roomCosine = inside.dot(lattice).abs()
  const roomWavelength = sphereSpacing.mul(2 * silicaIndex).mul(roomCosine)
  const room = wavelengthToRgb(roomWavelength).mul(environmentContrast(environment, mirrored, 0.12).sub(0.6).max(0)).mul(0.6)
  const brilliance = spacing.y.smoothstep(0.08, 0.4).mul(0.75).add(0.25)
// Domain walls scatter instead of diffract.
  const wall = cells.border.smoothstep(0, cells.border.fwidth().mul(1.5).add(0.015))
  return {
    fire: fire.add(room).mul(brilliance).mul(wall),
    identity,
  }
}
/** Black opal in an ironstone matrix. Two layers of play-of-color sit at different depths beneath the polished surface, so the harlequin patches slide over one another with every step; ironstone veins and sandy boulder rock thread through. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const {normal} = surfaceFrame()
    const inside = refract(view.negate(), normal, 1 / silicaIndex).negate().normalize()
// Ironstone: warped veins of the host boulder running through the opal.
    const veinWarp = mx_fractal_noise_vec3(p.mul(1.6), 2, 2, 0.5).mul(0.35)
    const veinField = voronoiCells(p.mul(3.4).add(veinWarp)).border
    const veinWidth = mx_noise_float(p.mul(5).add(3.1)).mul(0.5).add(0.5).mul(0.07).add(0.012)
    const veinFootprint = veinField.fwidth().max(0.0001)
    const vein = veinField.smoothstep(veinWidth.sub(veinFootprint), veinWidth.add(veinFootprint)).oneMinus().mul(mx_noise_float(p.mul(2.2).add(9.4)).smoothstep(-0.2, 0.15))
    const shallow = playOfColor(environment, p.add(parallaxOffset(view, normal, 0.004)), inside, 30, 0)
    const deep = playOfColor(environment, p.add(parallaxOffset(view, normal, 0.013)), inside, 18, 57.3)
    const fire = shallow.fire.add(deep.fire.mul(0.55)).mul(vein.oneMinus())
// Potch: the black body color, with a faint blue haze of scattered fire.
    const haze = mx_fractal_noise_float(p.mul(9), 2, 2, 0.5).mul(0.5).add(0.5)
    const potch = mix(color('#030407'), color('#0a0d18'), haze)
    const sand = mx_noise_float(p.mul(160)).mul(0.5).add(0.5)
    const ironstone = mix(color('#3b2213'), color('#6b4423'), sand.mul(0.7).add(mx_noise_float(p.mul(12)).mul(0.3)))
    this.colorNode = mix(potch, ironstone, vein)
    this.metalness = 0
    this.roughnessNode = mix(float(0.05), float(0.7), vein)
    this.ior = silicaIndex
    this.specularIntensity = 0.6
    this.clearcoatNode = vein.oneMinus()
    this.clearcoatRoughness = 0.01
    const surfaceNormal = proceduralNormal(vein.mul(-0.0006).add(sand.mul(vein).mul(0.00015)), 1)
    this.normalNode = surfaceNormal
// Quartz grains in the ironstone glitter for the close viewer.
    const ironstoneGlint = cellularPoints(p.mul(240), 0.03, 0.15, 0.75).mul(vein).mul(glints(surfaceNormal, 80))
// Opal fire fades a little at grazing angles, where the surface mirror takes over.
    const fresnel = facing.oneMinus().pow(5).mul(0.96).add(0.04)
    this.emissiveNode = fire.mul(fresnel.oneMinus()).mul(near.mul(0.2).add(0.9)).mul(1.4)
      .add(color('#1a2a6a').mul(haze).mul(grazing.pow(2)).mul(0.05).mul(vein.oneMinus()))
      .add(color('#d9b38a').mul(ironstoneGlint).mul(intimate).mul(0.25))
  }
}
