import type {Node, Texture} from 'three/webgpu'

import {cameraPosition, luminance, modelWorldMatrixInverse, positionLocal, texture, vec4} from 'three/tsl'

/** what every canvas material paints its surface from */
export type CanvasSurface = {
  /** 1 while features of `size` meters at scale 1 span several pixels, fading to 0 before they could alias */
  fine: (size: number) => Float
  /** the work’s image, as a flat work shows it */
  image: Node<'vec3'>
  /** the image’s luminance */
  luminance: Float
  map: Texture
  /** where on the image plane the fragment lies, in meters from the image’s middle, divided by the material’s scale, so every feature grows with it */
  position: Node<'vec2'>
  /** the direction toward the camera in the image plane’s own space, which faces +z */
  view: Node<'vec3'>
}

type Float = Node<'float'>

/** The surface of the image plane showing the texture, its features at `scale` times the size they were made at. */
export function canvasSurface(map: Texture, scale: number): CanvasSurface {
  const meters = positionLocal.xy
  const footprint = meters.fwidth().x.max(meters.fwidth().y).div(scale)
  const image = texture(map).rgb
  return {
    map,
    image,
    luminance: luminance(image),
    position: meters.div(scale).toVar('canvasPosition'),
    view: modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(positionLocal).normalize(),
    fine: size => footprint.smoothstep(size * 0.15, size * 0.6).oneMinus(),
  }
}
