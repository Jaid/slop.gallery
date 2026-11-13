import type {TransmittingEmission} from '../rendering/AlbedoRenderPipeline.ts'
import type {ClearGlassOptions} from './ClearGlassMaterial.ts'
import type {ColorRepresentation, Node} from 'three/webgpu'

import {cameraFar, cameraNear, cameraProjectionMatrix, cross, dFdx, dFdy, float, fwidth, max, min, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, perspectiveDepthToViewZ, positionView, screenUV, smoothstep, uv, vec2, vec3, vec4} from 'three/tsl'
import {Color} from 'three/webgpu'

import ClearGlassMaterial, {paneFresnelTransmittance} from './ClearGlassMaterial.ts'
import {liveViewportDepthTexture, liveViewportSafeUV, liveViewportTexture} from './liveViewport.ts'

export type CrownGlassOptions = ClearGlassOptions & {
  /** color the view picks up through the iron in the glass, on top of the neutral {@link ClearGlassOptions.absorption} */
  bodyColor?: ColorRepresentation
  /** Share of the view lost in the grime that settled along the frame, at its densest. */
  grime: number
  /** color of the grime along the frame */
  grimeColor?: ColorRepresentation
  /** Pale veil the glass scatters even where it is clean, as a share of the view behind it. */
  haze: number
  /** color of the light scattered by the haze and the smudges */
  hazeColor?: ColorRepresentation
  /** Face size in meters, as width along the face’s u axis and height along its v axis. Grime and every pattern are measured from it. */
  paneSize: [number, number]
  /** Share of the view lost under the densest wiped smudges. */
  smudges: number
  /** Height of the drawn ripples in meters. They bend both the reflections and the view through the pane, like old cylinder glass. */
  waviness: number
}

/** Ripple wavelengths in meters: long along the pane’s width, where the cylinder was drawn, short across it. */
const rippleLength = {
  along: 0.9,
  across: 0.24,
}
/** Width of the grime band from the pane’s edge, in meters, wide enough to show past a glazing stop. Dust settles deeper on the sill. */
const grimeWidth = {
  frame: 0.065,
  sill: 0.12,
}
/** Finite-difference step for the ripple gradient, in meters. */
const gradientStep = 0.002
/**
 * Drawn glass is not a perfect slab: both faces ripple slightly out of step, so each spot acts as a weak prism.
 * This is the share of the surface slope that the two faces do not share.
 */
const wedge = 0.4
/** Beyond this gap between pane and backdrop in meters, the view stops drifting further, keeping the room behind recognizable. */
const maximumRefractionGap = 4
/**
 * View-space normal of a surface whose height has the given slope over the face coordinates `point`, both in meters.
 *
 * The built-in `bumpMap` differentiates by resampling textures at offset UVs, which leaves procedural heights flat.
 * This applies Mikkelsen’s surface gradient with the chain rule instead, so the screen-space height change is exact on a flat face.
 */
function surfaceGradientNormal(slope: Node<'vec2'>, point: Node<'vec2'>) {
  const normal = normalViewGeometry
  const sigmaX = dFdx(positionView)
  const sigmaY = dFdy(positionView)
  const r1 = cross(sigmaY, normal)
  const r2 = cross(normal, sigmaX)
  const determinant = sigmaX.dot(r1)
  const heightX = slope.dot(dFdx(point))
  const heightY = slope.dot(dFdy(point))
  const gradient = r1.mul(heightX).add(r2.mul(heightY)).mul(determinant.sign())
  return normal.mul(determinant.abs()).sub(gradient).normalize()
}

/**
 * Old drawn window glass in a lived-in cabin.
 *
 * A perfectly clean, flat pane reads as an empty opening. Real old glass gives itself away through its imperfections instead:
 * drawn ripples make the room behind it and the reflections on it wobble, a faint veil scatters light,
 * wiped streaks dull the shine in patches and grime settles along the frame.
 *
 * Unlike {@link ClearGlassMaterial}, the material resamples the backdrop itself to bend it. It reads a full-resolution copy of the frame,
 * so the view through the glass stays as sharp as the ripples allow.
 */
export default class CrownGlassMaterial extends ClearGlassMaterial implements TransmittingEmission {
  readonly emissionIsTransmission = true

  constructor({bodyColor = '#ffffff', grime, grimeColor = '#2b2721', haze, hazeColor = '#c9d0c2', paneSize, smudges, waviness, ...options}: CrownGlassOptions) {
    super(options)
    const point = uv().mul(vec2(...paneSize))
    // Detail finer than a pixel would only shimmer, so it fades to its average once a pixel spans a sixth of its scale.
    const footprint = max(fwidth(point.x), fwidth(point.y))
    const fade = (scale: number) => float(1).sub(smoothstep(scale / 12, scale / 6, footprint))
    const rippleHeight = (at: Node<'vec2'>) => mx_noise_float(vec3(at.x.div(rippleLength.along), at.y.div(rippleLength.across), 0.5))
      .add(mx_noise_float(vec3(at.x.div(rippleLength.along / 2.3), at.y.div(rippleLength.across / 2.1), 7.3)).mul(0.3))
      .mul(waviness)
    const center = rippleHeight(point)
    const slope = vec2(
      rippleHeight(point.add(vec2(gradientStep, 0))).sub(center),
      rippleHeight(point.add(vec2(0, gradientStep))).sub(center),
    ).div(gradientStep).mul(fade(rippleLength.across))
    const rippledNormal = surfaceGradientNormal(slope, point)
    this.normalNode = rippledNormal
    // Wiped streaks: long, gently curving strokes of a cloth, gathered in a few patches.
    const patches = smoothstep(0.2, 0.6, mx_fractal_noise_float(vec3(point.x.mul(1.1), point.y.mul(1.8), 3.1), 2))
    const strokeCoordinate = point.y.add(mx_noise_float(vec3(point.x.mul(0.7), point.y.mul(0.7), 9.4)).mul(0.18))
    const strokes = mx_noise_float(vec3(point.x.mul(1.5), strokeCoordinate.mul(34), 11.7)).mul(0.5).add(0.5)
    const strokeFade = fade(1 / 34)
    const smudge = patches.mul(smoothstep(0.4, 0.85, strokes).mul(strokeFade).add(float(0.25).mul(float(1).sub(strokeFade))))
    const edge = min(min(point.x, float(paneSize[0]).sub(point.x)), float(paneSize[1]).sub(point.y))
    // Grime creeps in unevenly, so its border is ragged at two scales.
    const ragged = mx_noise_float(vec3(point.mul(14), 5.2)).mul(0.5).add(0.5).mul(fade(1 / 14))
      .add(mx_noise_float(vec3(point.mul(3.5), 8.6)).mul(0.5).add(0.5).mul(2))
      .div(3)
    const frameGrime = float(1).sub(smoothstep(0, grimeWidth.frame, edge.sub(ragged.mul(0.03))))
    const sillGrime = float(1).sub(smoothstep(0, grimeWidth.sill, point.y.sub(ragged.mul(0.07)))).pow(1.5)
    const dirt = max(frameGrime, sillGrime)
    const veil = float(haze).add(smudge.mul(smudges))
    const soil = dirt.mul(grime)
    const scatter = veil.add(soil).clamp(0, 0.9)
    // The veil and the grime are lit like matte films; a black body keeps the clean glass reflection-only.
    const veilTint = new Color(hazeColor)
    const soilTint = new Color(grimeColor)
    this.colorNode = vec3(veilTint.r, veilTint.g, veilTint.b).mul(veil).add(vec3(soilTint.r, soilTint.g, soilTint.b).mul(soil))
    // Smudges and grime spread the highlights they catch, including the clearcoat’s sheen. Rougher grime would smear nearby lamps into glowing bands along the frame.
    const dullness = smudge.mul(0.2).add(dirt.mul(0.22)).clamp(0, 0.3)
    this.roughnessNode = dullness
    this.clearcoatRoughnessNode = dullness.add(0.02)
    // Each ripple deviates the ray like a thin prism, and the ray keeps drifting across the whole gap to whatever lies behind the pane.
    const backdropViewZ = perspectiveDepthToViewZ(liveViewportDepthTexture(screenUV), cameraNear, cameraFar)
    const gap = backdropViewZ.sub(positionView.z).negate().clamp(0, maximumRefractionGap)
    const backdrop = positionView.mul(backdropViewZ.div(positionView.z))
    const drift = rippledNormal.xy.sub(normalViewGeometry.xy).mul((options.ior - 1) * wedge).mul(gap)
    const clip = cameraProjectionMatrix.mul(vec4(backdrop.xy.add(drift), backdrop.z, 1))
    const refractedUV = clip.xy.div(clip.w).mul(vec2(0.5, -0.5)).add(0.5).clamp(0, 1)
    // Anything in front of the pane, like its own frame, must not be pulled into it.
    // The pane copies the frame just before it draws, so transparent things behind it, like orbs, knots and the fire, are included regardless of which
    // other glass drew earlier. The copy has no mipmaps, so the view stays pixel-sharp.
    const transmitted = (liveViewportTexture(liveViewportSafeUV(refractedUV)) as Node<'vec4'>).rgb
    const transmittance = float(1 - options.absorption).mul(paneFresnelTransmittance(options.ior)).mul(float(1).sub(scatter))
    const body = new Color(bodyColor)
    this.emissiveNode = transmitted.mul(vec3(body.r, body.g, body.b)).mul(transmittance)
    // The backdrop arrives through the emissive term, so the pane itself is opaque.
    this.opacityNode = float(1)
  }
}
