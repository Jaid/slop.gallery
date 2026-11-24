import type {Node, Texture} from 'three/webgpu'

import {cameraPosition, luminance, modelWorldMatrixInverse, positionLocal, texture, uv, vec4} from 'three/tsl'

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
  /** UV distance per meter along each axis of the image plane, including a turntable’s crop */
  uvPerMeter: Node<'vec2'>
  /** the direction toward the camera in the image plane’s own space, which faces +z */
  view: Node<'vec3'>
}

type Float = Node<'float'>

/** The surface of the image plane showing the texture, its features at `scale` times the size they were made at. */
export function canvasSurface(map: Texture, scale: number): CanvasSurface {
  const meters = positionLocal.xy
  const pixel = meters.fwidth()
  const footprint = pixel.x.max(pixel.y)
  const image = texture(map).rgb
  return {
    map,
    image,
    luminance: luminance(image),
    position: meters.div(scale).toVar('canvasPosition'),
    // On a portrait plane U is affine in X and V in Y. The ratios stay the same under perspective and don't depend on the image resolution.
    uvPerMeter: uv().fwidth().div(pixel.max(1e-8)).toVar('canvasUvPerMeter'),
    view: modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(positionLocal).normalize(),
    footprint,
    fine: size => footprint.smoothstep(size * scale * 0.15, size * scale * 0.6).oneMinus(),
  }
}
