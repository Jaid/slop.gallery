import type {FrameSurface} from './frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_noise_float, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'

import {frameSurface as readSurface} from './frameAttributes.ts'
import frameStudio from './frameStudio.ts'

/** a layer painted over the ground: where it lies, 0 to 1, what color it has, and how it shines */
export type PaintLayer = {
  color: Node<'vec3'>
  /** relief in meters over the ground, for raised or incised decoration */
  height?: Float
  mask: Float
  metalness?: number
  roughness?: number
}

export type FramePaintOptions = {
  /** a clear coat over the paint, 0 for none */
  clearcoat?: number
  color: string
  /** how much dirt has settled in the hollows, 0 to 1 */
  grime?: number
  /** decoration painted, gilded or inlaid over the ground, the last on top */
  layers?: (surface: FrameSurface) => ReadonlyArray<PaintLayer>
  roughness?: number
  /** what shows where the paint is worn through on the ridges */
  under?: string
  /** how much of the ridges is worn through, 0 to 1 */
  wear?: number
}

type Float = Node<'float'>

/**
 * Painted or lacquered frames: a ground color worn through to what lies under it on the ridges and darkened in the hollows, with any number of painted, gilded or inlaid layers on top, which read the frame’s attributes like the gilding does.
 */
export default class FramePaintMaterial extends MeshPhysicalNodeMaterial {
  constructor({clearcoat = 0, color: ground, grime = 0.4, layers, roughness = 0.55, under = '#2a1d14', wear = 0}: FramePaintOptions) {
    super({
      roughness,
      envMap: frameStudio,
      envMapIntensity: 0.8,
      clearcoat,
      clearcoatRoughness: 0.06,
    })
    const surface = readSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('paintFootprint')
    const ridge = surface.cavity.mul(-1).smoothstep(0.2, 0.75)
    const hollow = surface.cavity.smoothstep(0.1, 0.8)
    const patches = mx_noise_float(p.mul(42).add(surface.piece.mul(5))).mul(0.5).add(0.5)
    const worn = ridge.mul(patches.smoothstep(1 - wear * 0.8, 1.05 - wear * 0.6)).mul(wear > 0 ? 1 : 0)
    const mottle = mx_noise_float(p.mul(9).add(surface.piece.mul(2))).mul(0.5).add(0.5)
    let surfaceColor: Node<'vec3'> = mix(color(ground).mul(mottle.mul(0.08).add(0.96)), color(under), worn).mul(float(1).sub(hollow.mul(grime * 0.4)))
    let surfaceMetalness: Float = float(0)
    let surfaceRoughness: Float = float(roughness).add(hollow.mul(grime * 0.15)).add(worn.mul(0.2))
    let height: Float = mx_noise_float(p.mul(260)).mul(0.00001).mul(visibleDetail(footprint, 0.004))
    for (const layer of layers?.(surface) ?? []) {
      surfaceColor = mix(surfaceColor, layer.color, layer.mask)
      surfaceMetalness = mix(surfaceMetalness, float(layer.metalness ?? 0), layer.mask)
      surfaceRoughness = mix(surfaceRoughness, float(layer.roughness ?? roughness), layer.mask)
      if (layer.height) {
        height = height.add(layer.height)
      }
    }
    this.colorNode = surfaceColor
    this.metalnessNode = surfaceMetalness
    this.roughnessNode = surfaceRoughness
    this.normalNode = heightNormal(height)
  }
}

/** a gold for painted layers, which shine like leaf laid over the paint */
export const layerGold = vec3(0.88, 0.56, 0.22)
