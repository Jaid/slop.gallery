import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_noise_vec3, mx_worley_noise_float, normalLocal, normalViewGeometry, refract, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Analytical spectral color mapping for diffracted wavelengths (400 nm to 700 nm). Produces pure, laser-saturated monochromatic interference colors. */
function wavelengthToRGB(wavelengthNm: Node<'float'>) {
  // Normalized visible spectrum parameter [0, 1]
  const t = wavelengthNm.sub(400).div(300).clamp()
  const violet = vec3(0.55, 0, 1)
  const cobalt = vec3(0, 0.25, 1)
  const cyan = vec3(0, 0.95, 1)
  const emerald = vec3(0, 1, 0.25)
  const yellowGold = vec3(1, 0.85, 0)
  const flameOrange = vec3(1, 0.38, 0)
  const laserRed = vec3(1, 0, 0.12)
  return mix(
    violet,
    mix(
      cobalt,
      mix(
        cyan,
        mix(
          emerald,
          mix(
            yellowGold,
            mix(flameOrange, laserRed, t.smoothstep(0.82, 1)),
            t.smoothstep(0.65, 0.82),
          ),
          t.smoothstep(0.48, 0.65),
        ),
        t.smoothstep(0.32, 0.48),
      ),
      t.smoothstep(0.16, 0.32),
    ),
    t.smoothstep(0, 0.16),
  )
}
/** Evaluates a volumetric Bragg diffraction stratum of precious black opal. */
function opalDiffractionStratum(
  pInternal: Node<'vec3'>,
  halfA: Node<'vec3'>,
  halfB: Node<'vec3'>,
  halfC: Node<'vec3'>,
  scale: number,
  depthAbsorption: number,
) {
  // Warp a Voronoi grain field rather than coloring whole Cartesian cells.
  const warp = mx_noise_vec3(pInternal.mul(scale * 0.4)).mul(0.35)
  const coord = pInternal.mul(scale).add(warp)
  const feature = mx_worley_noise_float(coord, 1, 1)
  const cell = vec3(feature.mul(65_536), 7, 19)
  // Extinguish each grain at its boundary before its orientation and color switch.
  const footprint = coord.fwidth().length()
  const grainMask = cellularBoundary(coord).smoothstep(0.03, footprint.add(0.16))
  // Random 3D orientation vector for the silica sphere stack in this grain
  const latticeNormal = cellNoiseVec3(cell).mul(2).sub(1).normalize()
  const cellNoise = mx_cell_noise_float(cell.add(vec3(31.7, 12.4, 85.1)))
  const sphereSpacing = cellNoise.mul(130).add(170) // 170 nm to 300 nm sphere arrays
  // Angular Bragg alignment across three studio lamps
  const alignA = latticeNormal.dot(halfA).abs()
  const alignB = latticeNormal.dot(halfB).abs()
  const alignC = latticeNormal.dot(halfC).abs()
  const maxAlign = alignA.max(alignB).max(alignC)
  // Narrow angular extinction: 70%+ of the stone remains pitch-black N1 body tone
  const flashLobe = maxAlign.smoothstep(0.72, 0.98).pow(3)
  // Diffracted wavelength: lambda = 2 * d * cos(theta)
  const lambda = sphereSpacing.mul(2 * 1.45).mul(maxAlign)
  const spectralColor = wavelengthToRGB(lambda)
  // Beer-Lambert volume absorption through smoky potch
  return spectralColor.mul(flashLobe).mul(grainMask).mul(float(depthAbsorption))
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85) // Crisp reflections of studio softboxes on optical-grade silica
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    // 1. Snell's Law Refraction into the silica cabochon (n = 1.45)
    const normal = normalLocal.normalize()
    const refractedRay = refract(view.negate(), normal, float(1 / 1.45)).normalize()
    // 2. Three representative studio illumination directions
    const lampA = vec3(0.35, 0.78, 0.52).normalize()
    const lampB = vec3(-0.62, 0.28, 0.73).normalize()
    const lampC = vec3(0.1, -0.35, 0.93).normalize()
    // Keep refraction, lamp directions and half-vectors in object-local space.
    const halfA = lampA.sub(refractedRay).normalize()
    const halfB = lampB.sub(refractedRay).normalize()
    const halfC = lampC.sub(refractedRay).normalize()
    // 3. Multi-Strata 3D Volumetric Bragg Diffraction
    // Stratum 1: Shallow Harlequin flagstone layer (depth = 0.014)
    const pStratum1 = p.add(refractedRay.mul(0.014))
    const fireLayer1 = opalDiffractionStratum(pStratum1, halfA, halfB, halfC, 14, 1)
    // Stratum 2: Deeper fine-grain Harlequin layer (depth = 0.032, Beer-Lambert potch absorption = 0.65)
    const pStratum2 = p.add(refractedRay.mul(0.032))
    const fireLayer2 = opalDiffractionStratum(pStratum2, halfA, halfB, halfC, 24, 0.65)
    // 4. Pinfire Opal: high-frequency sparkling stardust points
    const pinCoord = pStratum1.mul(70)
    const pinMask = cellularPoints(pinCoord, 0.03, 0.16, 0.72)
    const pinFire = vec3(1, 0.2, 0.5).mul(pinMask).mul(intimate.mul(0.8).add(0.4))
    // 5. Quartz micro-crystallites that glint under gallery lamps
    const quartzSparkle = glints(normalViewGeometry, 85).mul(0.4).mul(intimate)
    // Ultra-deep N1 body tone: pitch-black obsidian/potch matrix
    this.colorNode = color(hsl.integer(282, 42, 2))
    this.metalness = 0
    this.roughness = 0.04
    // Flawless, mirror-smooth polished cabochon clearcoat
    this.clearcoat = 1
    this.clearcoatRoughness = 0.008
    this.ior = 1.45 // Natural amorphous hydrated silica
    // Pure additive Bragg diffraction emission
    // Flashes ignite with blinding spectral fire while the rest remains pitch-black N1
    this.emissiveNode = fireLayer1
      .add(fireLayer2)
      .mul(near.mul(0.4).add(0.9))
      .mul(5.5)
      .add(pinFire.mul(3.2))
      .add(color(hsl.integer(0, 0, 100)).mul(quartzSparkle))
      .add(color(hsl.integer(269, 46, 5)).mul(grazing.pow(3)).mul(0.15))
  }
}
