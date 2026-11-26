import type {Node, Texture} from 'three/webgpu'

import {cameraPosition, luminance, modelWorldMatrixInverse, positionLocal, texture, vec2, vec4} from 'three/tsl'

/** what every canvas material paints its surface from */
export type CanvasSurface = {
  /** 1 while features of `size` meters at scale 1 span several pixels, fading to 0 before they could alias */
  fine: (size: number) => Float
  /** largest span of a pixel on the plane, in meters */
  footprint: Float
  /** the work’s image, as a flat work shows it */
  image: Node<'vec3'>
  /** the image’s luminance */
  luminance: Float
  map: Texture
  /** where on the image plane the fragment lies, in meters from the image’s middle, divided by the material’s scale, so every feature grows with it */
  position: Node<'vec2'>
  /** how large the whole image is on the work */
  size: ImageSize
  /** UV distance per meter along each axis of the image plane, including a turntable’s crop */
  uvPerMeter: Node<'vec2'>
  /** the direction toward the camera in the image plane’s own space, which faces +z */
  view: Node<'vec3'>
}

/** how large the whole image of a texture is on a work, in meters, including whatever of it a crop hides */
export type ImageSize = {
  height: number
  width: number
}

type Float = Node<'float'>

/** The pixel footprints in meters between which `fine(extent)` fades features out, on a material of `scale`: from where a pixel spans 15% of them to where it spans 60%. */
export const fineRange = (extent: number, scale: number) => [extent * scale * 0.15, extent * scale * 0.6] as const

/** The surface of the image plane showing the texture over `size`, its features at `scale` times the size they were made at. */
export function canvasSurface(map: Texture, size: ImageSize, scale: number): CanvasSurface {
  const meters = positionLocal.xy
  const pixel = meters.fwidth()
  const footprint = pixel.x.max(pixel.y)
  const image = texture(map).rgb
  return {
    map,
    image,
    luminance: luminance(image),
    position: meters.div(scale).toVar('canvasPosition'),
    size,
    uvPerMeter: vec2(1 / size.width, 1 / size.height),
    view: modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(positionLocal).normalize(),
    footprint,
    fine: extent => footprint.smoothstep(...fineRange(extent, scale)).oneMinus(),
  }
}
