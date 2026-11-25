import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'

import PlanarMirrorMaterial from './PlanarMirrorMaterial.ts'

export type WoodFloorVarnish = {
  /** radius of the Gaussian blur over the mirror, in pixels of a 1080-row image */
  gaussianBlur?: number
  roughness?: number
}

/** Satin-varnished wood in heavy mode, as glossy as `varnish` says; matte wood in fast mode. */
export default class WoodFloorMaterial extends PlanarMirrorMaterial {
  constructor(map: Texture, reflections = true, {gaussianBlur = 20, roughness = 0.2}: WoodFloorVarnish = {}) {
    super(map, {
      color: hsl.integer(67, 34, 70),
      roughness: reflections ? roughness : 0.72,
      reflection: reflections ? {
        strength: 0.2,
        grazingStrength: 0,
        gaussianBlur,
        loss: 0,
      } : undefined,
    })
  }
}
