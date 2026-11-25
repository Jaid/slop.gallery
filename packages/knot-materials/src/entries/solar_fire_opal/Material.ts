import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, Fn as fn, Loop as loop, mix, mx_noise_float, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Sum whole subsurface inclusions instead of clipping their colors at cell walls. */
const harlequinField = fn(([cellCoord, view]: [Node<'vec3'>, Node<'vec3'>]) => {
  const cell = cellCoord.floor()
  const local = cellCoord.fract()
  const footprint = cellCoord.fwidth().length().max(0.0001)
  const filter = footprint.min(0.12)
  const visibility = footprint.smoothstep(0.18, 0.7).oneMinus()
  const fire = vec3(0).toVar()
  loop(27, ({i}) => {
    const offset = vec3(i.mod(3), i.div(3).mod(3), i.div(9)).sub(1)
    const rnd = cellNoiseVec3(cell.add(offset))
    const center = rnd.mul(0.55).add(0.22)
    const cellDist = local.sub(offset.add(center)).length()
    const facetMask = cellDist.smoothstep(filter.negate().add(0.38), filter.add(0.46)).oneMinus()
    // Internal crystal lattice orientation for this inclusion
    const latticeNorm = rnd.sub(0.5).normalize()
    const viewLattice = view.dot(latticeNorm).abs()
    // Bragg condition: light fires in narrow angular windows as camera turns
    const braggPhase = viewLattice.mul(Math.PI * 5).add(rnd.x.mul(15.7))
    const flash = braggPhase.cos().smoothstep(0.76, 0.98)
    // Chromatic dispersion: color shifts across the optical spectrum with incidence angle
    const spectralPhase = viewLattice.mul(3.6).add(rnd.y.mul(2.4))
    const harlequinColor = cosinePalette(
      spectralPhase,
      [0.55, 0.48, 0.52],
      [0.5, 0.48, 0.45],
      [1, 1, 1],
      [0, 0.33, 0.67],
    )
    fire.addAssign(harlequinColor.mul(flash).mul(facetMask))
  })
  return fire.mul(visibility)
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.25)
    this.name = knotData.id
    const {p, view, rim, near, intimate} = viewerFrame()
    // Primary harlequin mosaic cells sampled beneath the clear glass surface
    const subSurfaceP = p.sub(view.mul(0.038))
    const cellCoord = subSurfaceP.mul(14.5)
    const harlequinFire = harlequinField(cellCoord, view)
    // Secondary "pinfire" micro-glints deep in the matrix, visible on close inspection
    const pinP = p.sub(view.mul(0.016))
    const pinCoord = pinP.mul(62)
    const pinRnd = cellNoiseVec3(pinCoord)
    const pinCenter = pinRnd.mul(0.5).add(0.25)
    const pinDist = pinCoord.fract().sub(pinCenter).length()
    const pinFoot = pinCoord.fwidth().length().max(0.0001)
    const pinPoint = pinDist.smoothstep(0.06, pinFoot.add(0.2).min(0.24)).oneMinus().mul(pinFoot.smoothstep(0.2, 0.8).oneMinus()).mul(intimate)
    const pinNorm = pinRnd.sub(0.5).normalize()
    const pinAngle = view.dot(pinNorm).abs()
    const pinFlash = pinAngle.mul(Math.PI * 9).add(pinRnd.z.mul(25)).cos().smoothstep(0.86, 0.99)
    const pinColor = spectralColor(pinRnd.x.mul(12).add(pinAngle.mul(4)))
    // Volcanic obsidian host matrix with smoky swirls
    const smoke = mx_noise_float(p.mul(5.5)).mul(0.5).add(0.5)
    const hostTint = mix(color(hsl.integer(309, 20, 4.5)), color(hsl.integer(304, 39, 9)), smoke.mul(0.35))
    // Physical surface properties
    this.colorNode = hostTint
    this.metalness = 0
    this.roughness = 0.022
    this.ior = 1.46
    this.clearcoat = 1
    this.clearcoatRoughness = 0.014
    // Thin-film silica interference on surface
    this.iridescence = 0.35
    this.iridescenceIOR = 1.42
    this.iridescenceThicknessNode = smoke.mul(180).add(280)
    // Harlequin flash emission + pinfire sparkles + deep smoky backlight
    const harlequinEmission = harlequinFire.mul(near.mul(0.4).add(0.7)).mul(3.4)
    const pinfireEmission = pinColor.mul(pinPoint).mul(pinFlash).mul(4.8)
    const glowTint = mx_noise_float(subSurfaceP.mul(2.5)).mul(0.5).add(0.5)
    const deepGlow = mix(color(hsl.integer(34, 96.7, 56)), color(hsl.integer(226, 100, 74)), glowTint).mul(smoke.pow(2)).mul(intimate).mul(0.4)
    const rimViolet = color(hsl.integer(283, 84, 50)).mul(rim.pow(3)).mul(0.3)
    this.emissiveNode = harlequinEmission
      .add(pinfireEmission)
      .add(deepGlow)
      .add(rimViolet)
  }
}
