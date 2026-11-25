import type {ColorRepresentation} from 'three/webgpu'

import hsl from 'okhsl'
import {float, normalView, positionViewDirection} from 'three/tsl'
import {CustomBlending, MeshPhysicalNodeMaterial, OneFactor, OneMinusSrcAlphaFactor} from 'three/webgpu'

export type ClearGlassOptions = {
  /** share of the view behind the pane that is lost even head-on, from absorption and the faint haze of real glass */
  absorption: number
  clearcoat?: number
  envMapIntensity?: number
  ior: number
  iridescence?: number
  iridescenceIOR?: number
  iridescenceThicknessMaximum?: number
  iridescenceThicknessMinimum?: number
  name: string
  specularColor?: ColorRepresentation
}

/**
 * Share of the backdrop that survives the Fresnel reflections at the front and the back face of a pane, including the inner bounces between them.
 * Follows the material’s own normal, so a perturbed `normalNode` also perturbs the transmission.
 */
export function paneFresnelTransmittance(ior: number) {
  const reflectance = ((ior - 1) / (ior + 1)) ** 2
  const cosine = normalView.dot(positionViewDirection).abs().clamp(0, 1)
  const surface = float(reflectance).add(float(1 - reflectance).mul(float(1).sub(cosine).pow(5)))
  const bothFaces = surface.mul(2).div(surface.add(1))
  return float(1).sub(bothFaces)
}

/**
 * Thin, flat window glass that keeps the view behind it pixel-sharp.
 *
 * Physical transmission resamples the backdrop through a smoothing bicubic filter, which visibly softens anything seen through a pane.
 * Flat glass does not bend the view, so this material instead blends over the untouched backdrop: the lit, reflection-only surface is added on top,
 * and the backdrop is dimmed by the same Fresnel reflectance of both faces, so panes turn mirror-like at grazing angles exactly like real glass.
 */
export default class ClearGlassMaterial extends MeshPhysicalNodeMaterial {
  constructor({absorption, clearcoat = 0, envMapIntensity = 1, ior, iridescence = 0, iridescenceIOR = 1.3, iridescenceThicknessMaximum = 400, iridescenceThicknessMinimum = 100, name, specularColor = hsl.integer(0, 0, 100)}: ClearGlassOptions) {
    super({
      // A black body leaves only reflections; everything else comes from the backdrop.
      color: hsl.integer(0, 0, 0),
      metalness: 0,
      roughness: 0,
      ior,
      specularIntensity: 1,
      specularColor,
      clearcoat,
      clearcoatRoughness: 0.02,
      iridescence,
      iridescenceIOR,
      iridescenceThicknessMinimum,
      iridescenceThicknessMaximum,
      envMapIntensity,
      transparent: true,
      depthWrite: false,
      // Reflections are already weighted by Fresnel, so they add instead of being scaled by alpha again.
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: OneFactor,
      blendDstAlpha: OneMinusSrcAlphaFactor,
    })
    this.name = name
    this.opacityNode = float(1).sub(float(1 - absorption).mul(paneFresnelTransmittance(ior)))
  }
}
