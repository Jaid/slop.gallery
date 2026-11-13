import type {TransmittingEmission} from '../rendering/AlbedoRenderPipeline.ts'
import type {Node} from 'three/webgpu'

import {cameraFar, cameraNear, cameraProjectionMatrix, color, float, fwidth, hash, max, mix, mx_noise_float, normalLocal, perspectiveDepthToViewZ, positionLocal, positionView, positionViewDirection, pow, screenUV, smoothstep, sqrt, transformNormalToView, vec2, vec3, vec4} from 'three/tsl'
import {Color, MeshPhysicalNodeMaterial} from 'three/webgpu'

import {liveViewportDepthTexture, liveViewportMipTexture, liveViewportSafeUV} from './liveViewport.ts'

export type CastFloorGlassOptions = {
  /** slab thickness in meters */
  thickness: number
  /** Edge length of one cast paver in meters. Joints fall on multiples of it, measured from the mesh origin. */
  tileSize: number
}

const ior = 1.52
/** Paver rise over its pillowed arris, in meters. */
const pillowHeight = 0.005
/** Width of the pillowed arris, in meters. */
const pillowWidth = 0.07
/** The hammered relief that ripples the view, as amplitude in meters and spatial frequency in cycles per meter. */
const hammered = {
  amplitude: 0.0022,
  frequency: 7,
}
/** A finer seed texture riding on the hammered relief. */
const seeds = {
  amplitude: 0.00025,
  frequency: 31,
}
/** Half-width of the dark structural joint between pavers, in meters. */
const jointHalfWidth = 0.005
/** Finite-difference step for the relief gradient, in meters. */
const gradientStep = 0.002
/** Beyond this gap between glass and backdrop in meters, the rippled image stops drifting further, keeping distant rooms recognizable. */
const maximumRefractionGap = 6
/** Relative spread of the red and blue refraction, the glass’s dispersion. */
const dispersion = 0.06
/** Iron-green body color the light picks up per {@link attenuationDepth} meters inside the glass. */
const attenuation = new Color('#7ecdc0')
const attenuationColor = vec3(attenuation.r, attenuation.g, attenuation.b)
const attenuationDepth = 0.3

/**
 * Walk-on cast glass pavers whose hammered relief bends the room below into a rippling view with faint spectral fringes.
 * Pillowed arrises and dark joints keep the grid legible as a floor, and each paver is cast with its own relief.
 *
 * Physical transmission only offsets its backdrop sample by the slab thickness, which leaves a 12 cm slab optically flat.
 * Real cast glass bends every ray by a small angle that keeps drifting all the way to whatever lies beyond it, so this material
 * refracts the backdrop itself: each relief facet deviates the ray like a thin prism, and the depth buffer tells how far it travels.
 */
export default class CastFloorGlassMaterial extends MeshPhysicalNodeMaterial implements TransmittingEmission {
  readonly emissionIsTransmission = true

  constructor({thickness, tileSize}: CastFloorGlassOptions) {
    super({
      // The body only reflects; everything seen through the glass comes from the refracted backdrop below.
      color: '#000000',
      metalness: 0,
      roughness: 0.05,
      ior,
      specularIntensity: 1,
      envMapIntensity: 1.15,
      // Transparent materials render after all opaque ones, so the backdrop copy contains the whole room below.
      transparent: true,
      opacity: 1,
    })
    this.name = 'lobby-glass-heavy'
    // Box faces are axis-aligned, so the walking surface and the underside share one relief plane in local XZ.
    const plane = positionLocal.xz
    // Relief finer than a pixel would only shimmer, so each octave fades out once a pixel spans a quarter of its wavelength.
    const footprint = max(fwidth(plane.x), fwidth(plane.y))
    const octave = (frequency: number) => float(1).sub(smoothstep(0.1 / frequency, 0.25 / frequency, footprint))
    const coarseFade = octave(hammered.frequency)
    const fineFade = octave(seeds.frequency)
    const jointDistance = (point: Node<'vec2'>) => {
      const local = point.div(tileSize).fract().sub(0.5).abs()
      return float(0.5).sub(max(local.x, local.y)).mul(tileSize)
    }
    const height = (point: Node<'vec2'>) => {
      const cell = point.div(tileSize).floor().add(4096)
      const seed = hash(cell.x.add(cell.y.mul(8192))).mul(53)
      const pillow = smoothstep(0, pillowWidth, jointDistance(point)).mul(pillowHeight)
      const hammer = mx_noise_float(vec3(point.mul(hammered.frequency), seed)).mul(hammered.amplitude).mul(coarseFade)
      const grain = mx_noise_float(vec3(point.mul(seeds.frequency).add(seed), seed.add(17))).mul(seeds.amplitude).mul(fineFade)
      return pillow.add(hammer).add(grain)
    }
    const center = height(plane)
    const slope = vec2(
      height(plane.add(vec2(gradientStep, 0))).sub(center),
      height(plane.add(vec2(0, gradientStep))).sub(center),
    ).div(gradientStep)
    // Only the walking surface and the underside are cast; the slab edges stay plain.
    const facing = normalLocal.y.abs()
    const relief = vec3(slope.x.negate(), 0, slope.y.negate()).mul(facing)
    const flatNormal = transformNormalToView(normalLocal).normalize()
    const castNormal = transformNormalToView(normalLocal.add(relief)).normalize()
    this.normalNode = castNormal
    const joint = jointDistance(plane)
    const antialias = max(fwidth(joint), 0.0005)
    const pane = smoothstep(float(jointHalfWidth).sub(antialias), float(jointHalfWidth).add(antialias), joint).mul(facing).add(float(1).sub(facing))
    // Joints are a dark silicone bead that neither transmits nor shines like the glass.
    this.colorNode = mix(color('#121718'), color('#000000'), pane)
    this.roughnessNode = mix(float(0.6), float(0.05), pane)
    // A thin prism deviates the ray by (n − 1) times its facet tilt, and the ray keeps drifting across the whole gap to whatever lies beyond the glass.
    const backdropViewZ = perspectiveDepthToViewZ(liveViewportDepthTexture(screenUV), cameraNear, cameraFar)
    const gap = backdropViewZ.sub(positionView.z).negate().clamp(0, maximumRefractionGap)
    const backdrop = positionView.mul(backdropViewZ.div(positionView.z))
    const drift = castNormal.xy.sub(flatNormal.xy).mul(ior - 1).mul(gap)
    const sample = (spread: number) => {
      const clip = cameraProjectionMatrix.mul(vec4(backdrop.xy.add(drift.mul(1 + spread)), backdrop.z, 1))
      const uv = clip.xy.div(clip.w).mul(vec2(0.5, -0.5)).add(0.5).clamp(0, 1)
      // Anything in front of the glass, like a visitor’s own shoes, must not be refracted into it.
      return liveViewportMipTexture(liveViewportSafeUV(uv)) as Node<'vec4'>
    }
    const transmitted = vec3(sample(-dispersion).r, sample(0).g, sample(dispersion).b)
    // Fresnel at the cast surface decides how much of the backdrop gets through; the rest is the reflection the lighting already adds.
    const cosine = castNormal.dot(positionViewDirection).abs().clamp(0, 1)
    const reflectance = float(((ior - 1) / (ior + 1)) ** 2)
    const fresnel = reflectance.add(float(1).sub(reflectance).mul(float(1).sub(cosine).pow(5)))
    const refractedCosine = sqrt(float(1).sub(float(1).sub(cosine.mul(cosine)).div(ior * ior)))
    const tint = pow(attenuationColor, vec3(float(thickness).div(refractedCosine.mul(attenuationDepth))))
    this.emissiveNode = transmitted.mul(tint).mul(float(1).sub(fresnel)).mul(pane)
  }
}
