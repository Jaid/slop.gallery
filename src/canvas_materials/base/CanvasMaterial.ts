import type {CanvasSurface, ImageSize} from '../lib/canvasSurface.ts'
import type {Influence} from '../lib/influence.ts'
import type {Texture} from 'three/webgpu'

import {mix, output, vec4} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import frameStudio from '#src/frames/lib/materials/frameStudio.ts'

import {canvasSurface} from '../lib/canvasSurface.ts'

/**
 * A kind of surface a work’s image is painted or printed on, like linen, cotton rag or watered silk, which shows over the flat image the way the work’s image plane would catch the light.
 *
 * A canvas material shades the image plane physically, lit by the room and mirroring the dim gallery its frames mirror, and then mixes that over the flat image, which every other work shows unlit, by its {@link strength}: a faint finish keeps the image’s own colors and only adds its relief and its sheen. The image plane lies around the image’s middle facing +z, in meters, so a material builds its features at their real size on a work of any size, and whatever it reads from the image, like a blur, a contour’s width or the strokes laid along it, it measures in meters as well.
 */
export default abstract class CanvasMaterial {
  /** a sentence on what it looks like and what it is made of */
  abstract readonly description: string
  /** how large its features are against the size they were made at */
  readonly scale: number = 1
  /** how much of the lit finish shows over the flat image, 0 for the image alone and 1 for the finish as it was made */
  abstract readonly strength: number
  abstract readonly title: string
  /** how much of the lit surface the finish mixes over the flat image at full strength */
  protected readonly weight: number = 1

  /** what in the work’s surroundings changes how it looks, in the order of `influenceBases`, each with how it does on the material as it ships; every material answers the light and paints the image */
  abstract get influences(): ReadonlyArray<Influence>

  /** A material of its own for an image plane showing the texture over `size`, which goes with whatever the material made from it. */
  createMaterial(map: Texture, size: ImageSize) {
    const material = new MeshPhysicalNodeMaterial({
      toneMapped: false,
      envMap: frameStudio,
      envMapIntensity: 0.7,
    })
    const surface = canvasSurface(map, size, this.scale)
    this.paint(material, surface)
    // Mixed in linear light after the shading, so the relief and the reflected light both go along.
    material.outputNode = vec4(mix(surface.image, output.rgb, this.strength * this.weight), output.a)
    return material
  }

  /** Paints the finish onto the material: its color, normals, roughness and whatever else the surface has. */
  protected abstract paint(material: MeshPhysicalNodeMaterial, surface: CanvasSurface): void
}
